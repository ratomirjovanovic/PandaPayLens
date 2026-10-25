# EBANX (adapter id `ebanx`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from EBANX's first-party documentation, EBANX's own OpenAPI files and websites, and EBANX's official GitHub organization as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: the docs site publishes a machine-readable page index (`https://docs.ebanx.com/llms.txt`, allowed by its `robots.txt`) that lists every guide page as raw Markdown (`<page>.md`). All 228 listed pages were downloaded; the pages named in the Sources table were read in full, and the rest were searched by keyword for status values, codes and timing statements. The interactive API reference loads two OpenAPI 3.0.2 files and two example ("scenario") files named in `https://docs.ebanx.com/api-reference/manifest.json`; those four JSON files were downloaded and every code enumeration in them was extracted mechanically and compared with the guide pages. Code values in this file are exact; meanings are paraphrased.
- Brand and host note: current hosts are `api.ebanxpay.com` / `sandbox.ebanxpay.com` (cross-border tenant) and `api-local-latam.ebanxpay.com` / `sandbox-local-latam.ebanxpay.com` (local tenant). The docs say the older `ebanx.com` hosts (`api.ebanx.com`, `sandbox.ebanx.com`, and the `-local-latam` equivalents) still work for backward compatibility, so pasted logs may contain either. Pix Automatico examples carry `"acquirer": "EBANX IP"` instead of `"EBANX"`.

---

## Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Classification                     | `card_processing`, `acquiring` (local acquiring and sub-acquirer licences as EBANX states them), `gateway`, `alternative_payment_method`. Not claimed by the pages read: `payment_facilitator`, `wallet`, `orchestration`, `merchant_account_intermediary`                                                                                                                                                                                                                                 |
| Documented sectors                 | SaaS and cloud, gaming, shared economy, e-commerce, streaming, digital ads, travel and OTA, airlines, B2B "high tickets" (EBANX industries pages and the "What types of businesses do we serve" article). iGaming, gambling, adult, crypto exchanges and forex: **NOT DOCUMENTED** as served sectors in the pages read                                                                                                                                                                     |
| Documentation access               | **Public** (no login) for all guides, both OpenAPI files, the example files and the code tables. The Merchant Area (dashboard), SFTP reports and the Postman collection were not used                                                                                                                                                                                                                                                                                                      |
| API family to implement first      | **Pay-in Direct API JSON responses** (`/ws/direct`, `/ws/query`, `/ws/capture`, `/ws/cancel`, `/ws/refund`): success envelope `{"payment": {...}, "status": "SUCCESS"}` with `payment.status` (OP/PE/CO/CA) and `payment.transaction_status`, and error envelope `{"status": "ERROR", "status_code", "status_message"}`. Second: the form-encoded **payment notification** (`operation`, `notification_type`, `hash_codes`). Third: **Payout API** (`type`, `payout.status`, `HP-*` codes) |
| Documented codes (distinct values) | 986 code values across the tables in section 4 (484 pay-in API `status_code` values, 173 payout codes, 81 card and 66 APM `description_code` values, 64 ISO 8583, 14 MAC, 7 ECI, 22 enrollment reasons, 69 chargeback reasons, 6 `transaction_status.code` values) (see 4.14 for the breakdown), plus value sets for 3DS status, liability, network token status, enrollment status and dispute status                                                                                     |
| Biggest limitations                | Notifications carry only identifiers (no status, no amount, no event id), so a timeline needs `/ws/query` responses as well. Several codes have two different meanings depending on the page (for example `BP-R-5`, `BP-DR-62`, `BP-DR-63`, `BP-DR-132`, `BP-US-*`). Many examples use placeholders such as `{{YYYY-MM-DD HH:mm:ss}}`. Notification retry schedule and ordering are not documented                                                                                         |
| White-label                        | No. EBANX documents its own request, response and notification formats. EBANX can also act as the processor behind Braintree, Worldpay, Spreedly, Yuno, DEUNA, Xsolla, Chargebee, Recurly and Zuora connections; in those setups the merchant sees the partner's format, not EBANX's                                                                                                                                                                                                       |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://docs.ebanx.com/docs`. Guide pages were read through their `.md` form (`D/<path>.md`); the same content is served at `D/<path>`.

| URL                                                                                                                                                                                                                           | What it covers                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.ebanx.com/robots.txt, https://docs.ebanx.com/sitemap.xml, https://docs.ebanx.com/llms.txt                                                                                                                        | Page discovery; `llms.txt` also states the status flow, hosts and integration methods                                                              |
| https://docs.ebanx.com/api-reference/manifest.json                                                                                                                                                                            | Names the OpenAPI and example files used by the interactive API reference                                                                          |
| https://docs.ebanx.com/api-reference/pay-in/openapi.json                                                                                                                                                                      | **Pay-in OpenAPI 3.0.2**, `info.version` 1.0.6: 24 endpoints, response schemas, 35 code enumerations (error codes, description codes, statuses)    |
| https://docs.ebanx.com/api-reference/pay-in/scenarios.json                                                                                                                                                                    | 160 example request/response pairs for pay-in endpoints (cards, 3DS, Pix, OXXO, SPEI, capture, query, refund, errors)                              |
| https://docs.ebanx.com/api-reference/payout/openapi.json                                                                                                                                                                      | **Payout OpenAPI 3.0.2**, `info.version` 1.0.0: 17 endpoints (payout, payee, transfer, verify account)                                             |
| https://docs.ebanx.com/api-reference/payout/scenarios.json                                                                                                                                                                    | Payout example requests and responses                                                                                                              |
| D/pay-in/dev-tools/response-codes/api-error-codes                                                                                                                                                                             | **Main pay-in error table** (`status_code` values), error object, HTTP 401/429/503, payment page errors                                            |
| D/pay-in/dev-tools/response-codes/card-error-codes                                                                                                                                                                            | `payment.transaction_status` for cards; 23 card response descriptions                                                                              |
| D/pay-in/dev-tools/response-codes/apm-error-codes                                                                                                                                                                             | APM `transaction_status` with `description_code` values                                                                                            |
| D/pay-in/dev-tools/response-codes/iso8583-codes                                                                                                                                                                               | `iso_code` and `mac_code` fields, ISO 8583 and Mastercard MAC tables, brand retry limits                                                           |
| D/pay-in/dev-tools/response-codes/eci-responses                                                                                                                                                                               | ECI values and liability                                                                                                                           |
| D/pay-in/dev-tools/response-codes/enrollment-error-codes                                                                                                                                                                      | Enrollment `reason_code` values                                                                                                                    |
| D/pay-in/dev-tools/sandbox-simulation/system-failures                                                                                                                                                                         | Sandbox failure simulation header; meaning of `BP-DR-119`, `BP-DR-120`, `BP-DR-143`, `BP-DR-60`, `BP-DR-182`, `BP-R-5`, `BP-R-6`, HTTP 500/503/504 |
| D/pay-in/dev-tools/sandbox-simulation/test-credit-cards                                                                                                                                                                       | Sandbox cards and expected outcomes                                                                                                                |
| D/pay-in/management/status-and-retrieval/payment-notifications                                                                                                                                                                | **Payment notification**: body, `notification_type` values, signature headers, acknowledgement, query example with `chargeback` node               |
| D/pay-in/management/status-and-retrieval/enrollment-notification                                                                                                                                                              | Enrollment notification body and fields                                                                                                            |
| D/pay-in/management/status-and-retrieval/retrieve-payment                                                                                                                                                                     | `/ws/query` request and responses (success with `refunds`, error `BP-Q-2`)                                                                         |
| D/pay-in/management/post-payment/refund-payment                                                                                                                                                                               | `/ws/refund` request, cancel, response, refund statuses                                                                                            |
| D/pay-in/management/post-payment/cancel-payment                                                                                                                                                                               | `/ws/cancel` request and responses (`BP-CAN-2`, `BP-CAN-3`)                                                                                        |
| D/pay-in/management/post-payment/chargeback-dispute                                                                                                                                                                           | Chargeback reason codes, dispute statuses, SFTP report, evidence API and `BP-CH-*` codes                                                           |
| D/pay-in/management/post-payment/med-pix-overview                                                                                                                                                                             | Pix MED claims and the `claims` node in `/ws/query`                                                                                                |
| D/pay-in/solution/integration-methods/direct-api, D/pay-in/solution/integration-methods/payment-page, D/pay-in/processing/payment-page                                                                                        | Direct API and hosted payment page flows                                                                                                           |
| D/pay-in/processing/payment-methods/multi-country/cards/credit-cards                                                                                                                                                          | Card flow, capture of pre-authorized payments, network token and wallet fields                                                                     |
| D/pay-in/processing/payment-methods/country-specific/brazil/boleto                                                                                                                                                            | Boleto voucher flow, PE to CO or CA                                                                                                                |
| D/pay-in/processing/payment-methods/country-specific/brazil/pix-automatico/canceling-and-errors/error-scenarios                                                                                                               | Pix Automatico synchronous errors, retry errors `BP-R-3` to `BP-R-6`, cancellation `description_code` values                                       |
| D/get-started/api-endpoints, D/get-started/api-operability, D/get-started/api-ecosystem, D/get-started/api-status, D/get-started/api-authentication/jws-authentication                                                        | Tenants and hosts, country and method availability, settlement, payout availability, status page, JWS request signing                              |
| D/payout/payouts-overview, D/payout/get-started, D/payout/general/notification, D/payout/general/consult-payout, D/payout/general/cancel-payout                                                                               | **Payout** flow, prerequisites, notification `operation` values, retrieve/search/cancel responses                                                  |
| D/payout/create-payout/errors/payout-error-codes, D/payout/create-payout/errors/canceled-errors/payout-canceled-errors-general, D/payout/create-payout/errors/canceled-errors/remittance/payout-canceled-errors-remittance-br | Payout `HP-*` error codes and canceled-payout error codes                                                                                          |
| D/payout/balance/consult-balance, D/payout/account/verify-account                                                                                                                                                             | `HP-BA-*` codes; verify-account HTTP statuses and error body                                                                                       |
| D/payout/countries/countries-argentina, -brazil, -chile, -colombia, -mexico, -peru (searched)                                                                                                                                 | Commit step and automatic commit after 6 hours                                                                                                     |
| D/pay-in/processing/payment-methods/country-specific/brazil/pix, mexico/oxxo-pay, mexico/spei, colombia/efecty, colombia/pse, argentina/rapipago, peru/pago-efectivo (searched)                                               | Confirmation timing and expiry for vouchers and transfers                                                                                          |
| D/pay-in/processing/partners-and-connections/braintree, D/pay-in/processing/partners-and-connections/worldpay, D/pay-in/processing/partners-and-connections/channels-and-partners                                             | Partner connections where EBANX is the processor behind another platform                                                                           |
| https://docs.ebanx.com/.well-known/skills/ebanx-integration-guide/references/payment-lifecycle.md, .../common-pitfalls.md, .../direct-api.md, .../security.md                                                                 | EBANX's own condensed integration notes (status flow, duplicates, capture window); several statements differ from the main guides (see section 10) |
| https://docs.ebanx.com/ebanx-integration-prompt.txt                                                                                                                                                                           | Searched only; no format details beyond the guides                                                                                                 |
| https://www.ebanx.com/en/about-us/, https://www.ebanx.com/en/                                                                                                                                                                 | Company activity, founding year, footprint                                                                                                         |
| https://www.ebanx.com/en/industries/ and its sub-pages (`gaming`, `global-saas`, `streaming`, `travel`, `e-commerce`, `digital-ads`, `shared-economy`, `others`)                                                              | Sectors in EBANX's own words                                                                                                                       |
| https://www.ebanx.com/en/insights/articles/what-types-of-businesses-do-we-serve/                                                                                                                                              | Sector list including airlines                                                                                                                     |
| https://www.ebanx.com/en/insights/articles/payment-service-provider-license-in-uruguay/, .../in-principle-approval-singapore/, .../ebanx-enabled-as-a-cross-border-sub-acquirer-operator-in-chile/                            | Licences and authorizations as EBANX states them                                                                                                   |
| https://www.ebanx.com/en/legal/, https://www.ebanx.com/en/legal/merchants/restricted-and-prohibited-products-and-services/ (redirects to https://trustcenter.ebanx.com/en-US/grc/prohibited-products-and-services)            | Legal hub; the prohibited-products list loads client-side and did not render ("Fetching policies failed"), so its content was **not read**         |
| https://api.github.com/orgs/ebanx/repos, https://github.com/ebanx/benjamin (`src/Models/Notification.php`, `src/Models/Responses/ErrorResponse.php`, `src/Models/Responses/PaymentResponse.php`, file tree)                   | Official PHP SDK (last push 2025-07-17): notification model with `operation`, `notification_type`, `hash_codes`                                    |

Not read: the Merchant Area, SFTP report files, the Postman collection (`documenter.getpostman.com`), the payout "Payee" and "Transfer" guide pages beyond the OpenAPI file, and the country pages for every APM other than those named above. Facts that would come only from those sources are marked **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | www.ebanx.com/en/about-us: founded in 2012, "more than 700 ebankers", operating "in more than 20 countries in Latin America, Africa, and Asia". Current examples carry 2025 and 2026 dates (a chargeback example dated 2025-11-29 on the payment notification page; capture examples with a 2026-07 order number in the pay-in scenarios file)                                                                                                                                                                                                 |
| 2   | Payment service operational      | yes    | D/get-started/api-status points to a live status page (status.ebanx.com); D/get-started/api-endpoints lists production and sandbox hosts for both tenants                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | Docs publicly accessible         | yes    | All guides, both OpenAPI files and the code tables load without login. The Merchant Area (`dashboard.ebanx.com`) and SFTP need merchant access and were not used                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | API families/versions identified | yes    | Pay-in API (OpenAPI `info.version` 1.0.6; `/ws/direct`, `/ws/query`, `/ws/capture`, `/ws/cancel`, `/ws/refund`, `/ws/refundOrCancel`, `/ws/request`, token and enrollment endpoints), Payout API (OpenAPI 1.0.0; `/ws/payout/*`, `/ws/transfer/*`), payment/payout/enrollment notifications, chargeback evidence endpoint `/ws/chargeback/send-evidence`. URL paths are not versioned                                                                                                                                                          |
| 5   | Offline-examinable formats       | yes    | JSON response examples for every pay-in and payout endpoint read; form-encoded notification examples; JSON error envelopes with examples; enumerated code schemas                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | Sectors documented               | yes    | www.ebanx.com/en/industries/: "SaaS & Cloud", "Gaming", "Shared Economy", "E-commerce", "Streaming", "Digital Ads", "Travel & OTA", "Other Digital Industries"; the "What types of businesses do we serve" article adds "Airlines"                                                                                                                                                                                                                                                                                                             |
| 7   | Regional/regulatory limits       | yes    | D/get-started/api-operability: country-by-country pay-in and payout availability per tenant. Payout prerequisites (D/payout/get-started): sender outside Brazil, Chile, Colombia or Mexico, no taxes or salaries, USD 10,000 per payee document per month. Licences per EBANX articles: Payment and Collection Service Provider registration with the Central Bank of Uruguay; CMF authorization as cross-border sub-acquirer in Chile; In-Principle Approval for a Major Payment Institution licence from the Monetary Authority of Singapore |
| 8   | Diagnostic value                 | yes    | Several hundred documented `status_code` values with messages, card and APM `description_code` values, ISO 8583 and MAC codes, chargeback reason codes and dispute statuses, payout error codes, two-letter payment and payout statuses                                                                                                                                                                                                                                                                                                        |
| 9   | Own technical formats            | yes    | EBANX-specific JSON (`hash`, `merchant_payment_code`, `amount_br`, `amount_ext`, `amount_iof`, `pre_approved`, `capture_available`, `BP-*` codes) and form-encoded notifications (`hash_codes`). Not a resale of a gateway PandaPayLens supports. EBANX also works as a processor behind Braintree and Worldpay connections; those payloads reach the merchant in the partner's format                                                                                                                                                         |
| 10  | No credentials needed to analyse | yes    | All examples and code tables are public. Notification signatures can be checked only with EBANX's public certificate, which PandaPayLens does not need or use                                                                                                                                                                                                                                                                                                                                                                                  |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`            | Credit and debit card payments, pre-authorization and `/ws/capture`, 3DS, card tokens, ISO 8583 response codes (D/pay-in/processing/payment-methods/multi-country/cards/credit-cards, D/pay-in/dev-tools/response-codes/iso8583-codes)                                                                                                                                     |
| `acquiring`                  | Braintree page: merchants "process credit and debit card transactions ... with EBANX acting as the payment processor" and "through EBANX acquiring"; Chile article: CMF authorization "to operate as a cross-border sub-acquirer". The card response object reports `"acquirer": "EBANX"`. Whether EBANX is a direct scheme member is **NOT DOCUMENTED** in the pages read |
| `gateway`                    | One API in front of local methods and local acquirers in 20+ countries (D/get-started/api-ecosystem; industries/others page: "Partnerships with multiple local acquirers in each country where we operate")                                                                                                                                                                |
| `alternative_payment_method` | Boleto, Pix, OXXO, SPEI, PSE, Efecty, Yape, UPI, M-PESA and others through `payment_type_code` (D/get-started/api-operability)                                                                                                                                                                                                                                             |
| Not claimed                  | `wallet` (EBANX routes third-party wallets such as Mercado Pago, Nequi and PicPay; it does not document its own consumer wallet), `payment_facilitator` (sub-accounts exist, but the PayFac role is not stated), `orchestration` (the industries page mentions "Smart routing" as a feature only), `merchant_account_intermediary`                                         |

Sectors, in EBANX's own words. Eligibility always depends on the merchant's jurisdiction, licensing and EBANX underwriting; listing a sector here says nothing about approval.

| Sector                   | Source and wording                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SaaS and cloud           | https://www.ebanx.com/en/industries/global-saas/ and the industries hub: "The EBANX SaaS payments solutions helps companies to tackle common payment challenges in the vertical"     |
| Gaming (video games)     | https://www.ebanx.com/en/industries/gaming/: "EBANX Payment Processing for Gaming"; "pay-to-play, freemium, or subscription game business"; payouts to "gaming tournament's winners" |
| Shared economy           | https://www.ebanx.com/en/industries/shared-economy/: shared transportation, space, food, education and similar segments, including payouts to gig workers                            |
| E-commerce               | https://www.ebanx.com/en/industries/e-commerce/                                                                                                                                      |
| Streaming                | https://www.ebanx.com/en/industries/streaming/                                                                                                                                       |
| Digital ads              | https://www.ebanx.com/en/industries/digital-ads/                                                                                                                                     |
| Travel and OTA; airlines | https://www.ebanx.com/en/industries/travel/; https://www.ebanx.com/en/insights/articles/what-types-of-businesses-do-we-serve/ ("Online Travel Agencies (OTAs)", "Airlines")          |
| B2B high-value payments  | https://www.ebanx.com/en/industries/others/: "an exclusive B2B payment solution for transactions above USD 10,000"                                                                   |

The gaming pages describe video gaming (mobile, PC, console). Online gambling, betting, adult content, nutraceuticals, CBD, crypto exchanges and forex are **NOT DOCUMENTED** as served sectors in the pages read. EBANX's restricted and prohibited products list could not be read (see Sources), so it is unknown which of these it excludes. Crypto appears only as a payment method (USDC and USDT stablecoin pay-in, D/get-started/api-operability), not as a merchant sector.

---

## Technical specification

### 1. Sources and verification date

See the Sources table above. Verification date 2026-10-25. The pay-in OpenAPI file reports `info.version` 1.0.6 and the payout OpenAPI file 1.0.0; guide pages carry no per-page date.

### 2. API families and versions in scope

EBANX does not version its URL paths. Every operation is an HTTPS `POST` to `/ws/<operation>` on the tenant host (one documented exception: `GET /ws/documentbalance`). Requests are JSON; the common-pitfalls note adds that `application/x-www-form-urlencoded` requests are also accepted. Authentication is either the legacy `integration_key` body field (described as "being deprecated") or JWS with a detached payload in the `X-JWS-Signature` header (RS256, `kid` header).

| Family                        | Endpoint(s)                                                                                                                                                                                                                                                                                     | Format                                                           | Relevance to PandaPayLens                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pay-in Direct API**         | `/ws/direct` (create), `/ws/query`, `/ws/capture`, `/ws/cancel`, `/ws/refund` (`operation` = `request` or `cancel`), `/ws/refundOrCancel`, `/ws/updatecustomerbankinfo`                                                                                                                         | JSON request and JSON response                                   | **Primary.** Payment object with status, amounts, `transaction_status` and nested refunds, chargeback and claims; error envelope with `BP-*` codes |
| **Payment notifications**     | HTTP POST from EBANX to the merchant notification URL                                                                                                                                                                                                                                           | `application/x-www-form-urlencoded`, signed in HTTP headers      | **Primary for timeline.** Only identifiers and an event type; full state needs `/ws/query`                                                         |
| Hosted payment page           | `/ws/request` (returns `redirect_url` to `/checkout?hash=...`)                                                                                                                                                                                                                                  | JSON                                                             | Secondary. Same payment object; `payment_type_code` `_all`; status `OP`; separate `BP-R-*` and `RP-*` error codes                                  |
| Card tokens and verification  | `/ws/token`, `/ws/token/setCVV`, `/ws/token/query`, `/ws/token/delete`, `/ws/verifycard`, `/ws/cardbin`                                                                                                                                                                                         | JSON                                                             | Low. Same error envelope; token values are sensitive                                                                                               |
| Enrollments (recurring APMs)  | `/ws/userenrollment`, `/ws/userenrollment/cancel`, `/ws/userenrollment/update-subscription`, `/ws/userenrollments/query`; enrollment notification                                                                                                                                               | JSON; form-encoded notification                                  | Secondary. `BP-UE-*` errors, enrollment `reason_code`                                                                                              |
| Supporting utilities          | `/ws/exchange`, `/ws/exchange/getCurrencyRates`, `/ws/fxtoken/get`, `/ws/instalmentsPlan`, `/ws/getBankList`, `/ws/ewallet-availableEWallets`, `/ws/zipcode`, `GET /ws/documentbalance`                                                                                                         | JSON                                                             | Low. Same error envelope, own small code sets                                                                                                      |
| Chargeback evidence           | `/ws/chargeback/send-evidence`                                                                                                                                                                                                                                                                  | `multipart/form-data` request with JWS; JSON response            | Low. `BP-CH-00` to `BP-CH-09` codes only                                                                                                           |
| **Payout API**                | `/ws/payout/create`, `/ws/payout/commit`, `/ws/payout/cancel`, `/ws/payout/retrieve`, `/ws/payout/search`, `/ws/payout/simulate`, `/ws/payout/balance`, `/ws/payout/banks`, `/ws/payout/bankDetails`, `/ws/payout/attach`, `/ws/payee/create`, `/ws/payout/verify_account`; payout notification | JSON (different envelope from pay-in); form-encoded notification | **Third.** `type` envelope, `HP-*` codes, two-letter payout status                                                                                 |
| Balance transfers             | `/ws/transfer/create`, `/ws/transfer/commit`, `/ws/transfer/cancel`, `/ws/transfer/retrieve`, `/ws/transfer/search`                                                                                                                                                                             | JSON                                                             | Out of scope initially                                                                                                                             |
| Reports (Merchant Area, SFTP) | CSV, XLSX, XML, JSON files (settlement); `cbk_dispute_YYMMDD.csv` (chargebacks)                                                                                                                                                                                                                 | Files                                                            | Out of scope; column lists only                                                                                                                    |

**Recommendation: implement first** the Pay-in Direct API responses and errors from `/ws/direct`, `/ws/query`, `/ws/capture`, `/ws/cancel` and `/ws/refund`. They share one JSON payment object and one error envelope, they carry every documented status and decline code, and `/ws/query` is the payload EBANX tells merchants to fetch after each notification, so developers will paste it. Next, parse the payment notification body (three form fields) and correlate it by `hash_codes`. Add the Payout API afterwards: its envelope, code space and statuses are separate.

### 3. Response and error formats

#### 3.1 Content type and encoding

- **Pay-in responses**: JSON. Success bodies have top-level `"status": "SUCCESS"` and a `payment` object (plus `redirect_url` at top level for some methods, and `operation: "cancel"` for `/ws/cancel`). Errors use `{"status": "ERROR", "status_code": "...", "status_message": "..."}`.
- **HTTP status codes (pay-in)**: the error page says that when its HTTP column is blank the response is HTTP 200, and it lists only 401 (authentication), 429 (rate limit) and 503 (temporary unavailability). Most error examples in the scenario file are HTTP 200, but some auxiliary endpoints use HTTP 400 in their examples (`/ws/ewallet-availableEWallets` `BP-DR-77`, `/ws/getBankList`, `/ws/instalmentsPlan`, `/ws/documentbalance`, `/ws/token/delete`). The chargeback evidence endpoint documents real HTTP statuses per code (400, 401, 404, 422, 500). The sandbox simulation page also produces HTTP 500 and 504.
- **Amount types**: in `/ws/direct`, `/ws/query`, `/ws/capture`, `/ws/cancel` and `/ws/refund` examples, amounts and rates are strings (`"amount_ext": "99.85"`, `"instalments": "1"`). The `/ws/request` example uses JSON numbers for the same fields (`"amount_br": 100.38`, `"instalments": 1`). Payout examples mix both (`"request_amount": 100` in the guide, `"request_amount": "10.00"` in the OpenAPI example). A parser must accept both.
- **Dates**: `YYYY-MM-DD HH:mm:ss` without zone. The OpenAPI descriptions call `status_date`, `confirm_date` and payout dates "UTC"; `due_date` is `YYYY-MM-DD`; request `due_date` is `dd/MM/yyyy`.
- **Notifications**: `application/x-www-form-urlencoded` POST body (see section 6).
- **Payout responses**: JSON with top-level `type` (`success`, `api_error`, `authentication_error`, `invalid_request_error`, `request_error`) and either a `payout` object, a `message`, or error fields (see 3.2).

#### 3.2 Envelopes and exact field names

Pay-in error envelope (D/pay-in/dev-tools/response-codes/api-error-codes; OpenAPI `apm-error-response`, `card-error-response`, `query-error-response` and others):

| Field            | Type   | Meaning                                                        |
| ---------------- | ------ | -------------------------------------------------------------- |
| `status`         | string | Always `ERROR`                                                 |
| `status_code`    | string | Code such as `BP-DR-17`, `BP-SA-2`, `DA-0`, `RP-3`, `IPBP-001` |
| `status_message` | string | Text; often embeds the offending value, the hash or the amount |

One pay-in variant differs: the update-subscription operation returns `status`, `status_code` and **`message`** (not `status_message`) per OpenAPI `update-subscription-error-response`.

Payout error envelopes (three shapes, all first-party):

| Where                                     | Fields                                                      | Example source                                                               |
| ----------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Payout API errors (create, retrieve, ...) | `type`, `message`, `status_code`, `code` (same value twice) | D/payout/create-payout/errors/payout-error-codes                             |
| Canceled payout reason                    | `code`, `message`, `gateway_details` (raw provider text)    | D/payout/create-payout/errors/canceled-errors/payout-canceled-errors-general |
| Verify account                            | `code`, `error` (and HTTP 400/401/404/424/429/500/504)      | D/payout/account/verify-account                                              |

Where the canceled-payout `code`/`message`/`gateway_details` object appears inside a retrieve response or a notification is **NOT DOCUMENTED**.

Pay-in payment object (`payment`), fields seen in the OpenAPI response schemas and examples:

| Field                                                                                                                                                                                                                                 | Meaning / notes                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hash`                                                                                                                                                                                                                                | EBANX payment identifier. OpenAPI: 48 characters. The most-used guide example (`59acc5f0...b3a475`) has 49 characters (see section 10)                                                                                                                                                                            |
| `merchant_payment_code`                                                                                                                                                                                                               | Merchant's unique payment reference, up to 40 characters                                                                                                                                                                                                                                                          |
| `order_number`                                                                                                                                                                                                                        | Optional merchant order number; several payments may share one                                                                                                                                                                                                                                                    |
| `country`                                                                                                                                                                                                                             | Two-letter code, lowercase in most examples (`br`), uppercase in Pix Automatico examples (`BR`)                                                                                                                                                                                                                   |
| `status`                                                                                                                                                                                                                              | `OP`, `PE`, `CO`, `CA` (section 5)                                                                                                                                                                                                                                                                                |
| `status_date`, `open_date`, `confirm_date`, `transfer_date`, `due_date`                                                                                                                                                               | Status change, creation, confirmation, settlement ("the payment was settled") and expiry dates                                                                                                                                                                                                                    |
| `amount_br`, `amount_ext`, `amount_iof`, `amount_ext_requested`, `amount_usd`                                                                                                                                                         | Local amount, original-currency amount, local tax amount, requested amount, USD amount. Null on pending payments before conversion per OpenAPI                                                                                                                                                                    |
| `currency_ext`, `currency_rate`, `currency_rate_usd`, `currency_ext_base`                                                                                                                                                             | Original currency and rates                                                                                                                                                                                                                                                                                       |
| `instalments`                                                                                                                                                                                                                         | Number of instalments (EBANX spelling with one "l")                                                                                                                                                                                                                                                               |
| `payment_type_code`                                                                                                                                                                                                                   | Method code (`creditcard`, `visa`, `boleto`, `pix`, `oxxopay`, `spei`, ...)                                                                                                                                                                                                                                       |
| `pre_approved`, `capture_available`                                                                                                                                                                                                   | Card authorization flags; `capture_available: true` means an authorized payment waits for `/ws/capture`                                                                                                                                                                                                           |
| `transaction_status`                                                                                                                                                                                                                  | `acquirer`, `code`, `description`, `description_code`, `authcode`, `iso_code`, `mac_code`, `details`, `brand_mandate` (section 4)                                                                                                                                                                                 |
| `threedsecure`                                                                                                                                                                                                                        | `has_threeds`, `status`, `threeds_redirect_url`, `threeds_attempts[]`, `threeds_result` (`eci`, `pares_status`, `pares_status_description`, `status_reason`, `liability`, `threeds_reference`)                                                                                                                    |
| `redirect_url`                                                                                                                                                                                                                        | Where to send the customer (3DS, bank redirect, voucher page); also repeated at top level                                                                                                                                                                                                                         |
| `boleto_url`, `boleto_barcode`, `boleto_barcode_raw`, `oxxo_url`, `oxxo_barcode`, `voucher_url`, `voucher_id`, `cip_code`, `cip_url`, `clabe_account`, `clabe_reference`, `spei_url`, `baloto_url`, `qrcode_url`, `pix.qr_code_value` | Voucher, transfer and QR data for asynchronous methods                                                                                                                                                                                                                                                            |
| `details.billing_descriptor`                                                                                                                                                                                                          | Soft descriptor                                                                                                                                                                                                                                                                                                   |
| `refunds[]` (query and refund responses)                                                                                                                                                                                              | `id`, `merchant_refund_code`, `status`, `request_date`, `pending_date`, `confirm_date`, `cancel_date`, `paid_date`, `amount_ext`, `amount_local`, `description`, `refund_method`, `refund_status_details`, `settlement`, `authcode`, `fill_bank_data_url`, `bank_info_customer_filled`, `email_quantity` and more |
| `chargeback` (query)                                                                                                                                                                                                                  | `chargeback_public_id`, `create_date`, `chargeback_date`, `description`, `reason_code`, `amount_ext`, `dispute_status`, `settled`, `settlement_date`, `settlement_amount`, `settlement_currency`                                                                                                                  |
| `claims` (query, Pix MED)                                                                                                                                                                                                             | `return_request_id`, `status` (always `Returned`), `reason`, `rejection_reason`, `claims_type` (`med`), `date_paid_to_customer`, `amount_paid_to_customer`                                                                                                                                                        |
| `transaction_references[]`                                                                                                                                                                                                            | `name` (`arn` or `tlid`), `value`; per OpenAPI an ARN can also carry `status` `available`, `not_supported` or `pending`                                                                                                                                                                                           |
| `customer` (query, cancel)                                                                                                                                                                                                            | `document`, `email`, `name`, `birth_date`, address fields, `phone_number`                                                                                                                                                                                                                                         |
| `enrollment`, `subscription`, `pix_automatico`, `payment_attempts`                                                                                                                                                                    | Recurring APM data; failed attempts carry `attempt_response` (Pix Automatico page)                                                                                                                                                                                                                                |
| `token`, `creditcard_token`, `token_available`, `masked_card_number`, `cof_info`, `card_update`                                                                                                                                       | Card token data (sensitive)                                                                                                                                                                                                                                                                                       |
| `single_transaction`, `sub_account`, `metadata`, `customer_bank_info_status`, `transactor_info`                                                                                                                                       | Split local/cross-border amounts, sub-account, provider metadata, refund bank-data check (`CORRECT`, `INCORRECT`, `UNCERTAIN`); `transactor_info` meaning **NOT DOCUMENTED**                                                                                                                                      |

Payout object (`payout`, D/payout/general/consult-payout and payout OpenAPI): `uid`, `external_reference`, `status`, `request_date`, `status_date`, `paid_date`, `cancel_date`, `payee` (`name`, `email`, `phone`, `document`, `document_type`, `birthdate`, `bank_info`), `request_amount`, `request_currency`, `request_exchange_rate`, `debit_amount`, `debit_fee`, `debit_amount_total`, `debit_currency`, `local_tax_amount`, `local_amount_total`, `local_currency`, `local_exchange_rate`, `order_number`, `target`. Search responses add `records`, `total_pages`, `per_page`, `page` and a `payouts` array.

#### 3.3 Examples

Example A: pay-in error. **Transcribed from https://docs.ebanx.com/docs/pay-in/dev-tools/response-codes/api-error-codes**:

```json
{
  "status": "ERROR",
  "status_code": "BP-SA-1",
  "status_message": "Parameter integration_key not found"
}
```

(The code table on the same page words `BP-SA-1` as "Parameter integration_key not informed"; the scenario file uses that wording.)

Example B: query after a notification, with a chargeback node. **Transcribed from https://docs.ebanx.com/docs/pay-in/management/status-and-retrieval/payment-notifications** (abridged by removing fields; the remaining values are unchanged):

```json
{
  "payment": {
    "hash": "5a15e30b970d9f9f4bc33466e42e92515c7a7ed755dc1e45",
    "merchant_payment_code": "1120a8eb178",
    "status": "CO",
    "confirm_date": "2017-11-22 20:50:18",
    "amount_br": "100.38",
    "amount_ext": "100.00",
    "amount_iof": "0.38",
    "currency_ext": "BRL",
    "payment_type_code": "visa",
    "transaction_status": {
      "acquirer": "EBANX",
      "code": "OK",
      "description": "Sandbox - Test credit card, transaction captured",
      "authcode": "45101"
    },
    "pre_approved": true,
    "capture_available": false,
    "chargeback": {
      "chargeback_public_id": "01930f1e-7c3a-7b6e-9f2a-5c8d4e1b2a37",
      "chargeback_date": "2025-11-27",
      "reason_code": "0200/15",
      "dispute_status": "Not disputed",
      "settled": false
    }
  },
  "status": "SUCCESS"
}
```

Example C: Pix Automatico payment cancelled with an APM decline. **Transcribed from https://docs.ebanx.com/api-reference/pay-in/scenarios.json** (`/ws/direct`, scenario `pix-automatico-recurring-payment`, response `recurring-payment-timeout`; abridged):

```json
{
  "payment": {
    "hash": "59acc5f00945fa382ab051651440826da7701533249b3a475",
    "country": "BR",
    "status": "CA",
    "payment_type_code": "pix-automatico",
    "transaction_status": {
      "acquirer": "EBANX IP",
      "code": "NOK",
      "description": "External service not available, try again",
      "description_code": "TIMEOUT"
    }
  },
  "status": "SUCCESS"
}
```

Example D: payment notification body. **Transcribed from https://docs.ebanx.com/docs/pay-in/management/status-and-retrieval/payment-notifications**:

```text
operation=payment_status_change&notification_type=update&hash_codes={{unique_payment_hash}}
```

Example E: payout error. **Transcribed from https://docs.ebanx.com/docs/payout/create-payout/errors/payout-error-codes**:

```json
{
  "type": "invalid_request_error",
  "message": "Empty amount",
  "status_code": "HP-CM-09",
  "code": "HP-CM-09"
}
```

Note the top-level `"status": "SUCCESS"` together with `payment.status: "CA"` in Example C: a successful API call can describe a cancelled or declined payment. The decline is in `payment.status` and `payment.transaction_status`, not in the envelope.

### 4. Codes

Code strings are exactly as documented. "Meaning" is a short original paraphrase; the source wording is on the linked page. **Category and retry columns are suggestions for PandaPayLens, not EBANX statements**; where EBANX gives explicit advice ("retry at any time", "do not retry"), the suggestion follows it and says so.

Where codes live:

- Pay-in API errors: top-level `status_code` (with `status: "ERROR"`), section 4.1 to 4.4.
- Payment outcome inside a successful API response: `payment.status` (section 5) and `payment.transaction_status.code`, `.description`, `.description_code`, `.iso_code`, `.mac_code` (sections 4.5 to 4.9).
- Chargebacks: `payment.chargeback.reason_code` and `.dispute_status` (section 4.12); enrollments: `reason_code` (section 4.11).
- Payouts: `status_code` / `code` with `type`, and the canceled-payout `code` (section 4.13).

Source column: **P** = D/pay-in/dev-tools/response-codes/api-error-codes; **O** = pay-in OpenAPI enumerations; **S** = D/pay-in/dev-tools/sandbox-simulation/system-failures; **X** = Pix Automatico error-scenarios page; **C** = chargeback-dispute page. "conflict" marks a code with two different documented meanings (section 10 lists them).

EBANX does not say these lists are complete. An adapter must keep an `unknown` fallback.

#### 4.1 Pay-in authentication, parser and request-level codes: 31 codes

| Code                   | Meaning (paraphrase)                                                       | Src  | Category          | Retry               |
| ---------------------- | -------------------------------------------------------------------------- | ---- | ----------------- | ------------------- |
| `BP-SA-1`              | `integration_key` missing                                                  | P, O | configuration     | do_not_retry        |
| `BP-SA-2`              | `integration_key` invalid or unknown                                       | P, O | configuration     | do_not_retry        |
| `BP-SA-3`              | Merchant account inactive                                                  | P, O | configuration     | manual_review       |
| `BP-SA-4`              | Test account used against production                                       | P, O | configuration     | do_not_retry        |
| `BP-SA-5`              | Production account used against sandbox                                    | P, O | configuration     | do_not_retry        |
| `BP-DPAR-1`            | Request body empty                                                         | P, O | invalid_request   | do_not_retry        |
| `BP-DPAR-2`            | Body is not valid JSON                                                     | P, O | invalid_request   | do_not_retry        |
| `BP-DPAR-3`            | `integration_key` missing (parser stage)                                   | P, O | configuration     | do_not_retry        |
| `BP-DPAR-4`            | `integration_key` rejected (parser stage)                                  | P, O | configuration     | do_not_retry        |
| `BP-DPAR-5`            | Merchant account inactive (parser stage)                                   | P, O | configuration     | manual_review       |
| `BP-DPAR-6`            | Account limited to testing, used in production                             | P, O | configuration     | do_not_retry        |
| `BP-DPAR-7`            | Production account used for testing                                        | P, O | configuration     | do_not_retry        |
| `DA-0`                 | Unknown error; EBANX says contact its integration team                     | P, O | unknown           | manual_review       |
| `DA-1`                 | `operation` empty (O adds: or invalid JSON)                                | P, O | invalid_request   | do_not_retry        |
| `DA-3`                 | Too many requests; try later                                               | O    | rate_limiting     | retry_conditionally |
| `RP-1`                 | Payment page request body empty                                            | P    | invalid_request   | do_not_retry        |
| `RP-2`                 | JSON nested too deeply                                                     | P    | invalid_request   | do_not_retry        |
| `RP-3`                 | JSON malformed                                                             | P    | invalid_request   | do_not_retry        |
| `RP-4`                 | JSON has an unexpected control character (encoding problem)                | P    | invalid_request   | do_not_retry        |
| `RP-5`                 | JSON syntax error                                                          | P    | invalid_request   | do_not_retry        |
| `RP-6`                 | JSON has invalid UTF-8                                                     | P    | invalid_request   | do_not_retry        |
| `RP-7`                 | JSON error of unknown kind                                                 | P    | invalid_request   | do_not_retry        |
| `RP-8`                 | `integration_key` missing (payment page)                                   | P    | configuration     | do_not_retry        |
| `RF-1`                 | Payment already exists (payment page; same merchant payment code)          | P    | duplicate_request | do_not_retry        |
| `BP-CH-1`              | Payment type group not active for the merchant                             | P    | configuration     | do_not_retry        |
| `BP-MF-1`              | No merchant fee spread configured for this country, entity type and method | P    | configuration     | manual_review       |
| `BP-ENC-02`            | JWE-encrypted card data invalid or cannot be decrypted                     | O    | invalid_request   | do_not_retry        |
| `BP-GP-2`              | Google Pay payload invalid                                                 | O    | invalid_request   | do_not_retry        |
| `BP-3DSR-10`           | `redirect_url` required for 3DS authentication (token endpoint)            | O    | invalid_request   | do_not_retry        |
| `BP-DMO-1`, `BP-DMO-2` | Payment to modify not found; only `OP` payments can be modified (2 codes)  | P    | invalid_request   | do_not_retry        |

HTTP-level responses with no `status_code` (P): **401** authentication failed (`integration_key` missing, invalid or not permitted), suggested configuration / do_not_retry; **429** rate limit exceeded, rate_limiting / retry_conditionally; **503** temporary overload or maintenance, EBANX recommends retry logic, provider_unavailable / safe_to_retry_technical_request after checking `/ws/query`. The sandbox page adds **500** and **504**, after which the payment state is unknown and must be reconciled with `/ws/query` (network_or_timeout / retry_conditionally).

#### 4.2 Pay-in `BP-DR-*` codes (payment creation, `/ws/direct` and related): 197 codes

Default for rows that say only "missing", "too long" or "invalid" about a request field: invalid_request / do_not_retry (fix the request). Rows that name customer-entered data use customer_action_required.

| Code        | Meaning (paraphrase)                                                                                                                                                                        | Src     | Category                           | Retry                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------- | ------------------------ |
| `BP-DR-0`   | A payment with this `merchant_payment_code` already exists (message gives its date and status)                                                                                              | P, O    | duplicate_request                  | do_not_retry             |
| `BP-DR-1`   | `mode` must be `full` or `iframe`                                                                                                                                                           | P       | invalid_request                    | do_not_retry             |
| `BP-DR-2`   | `payment` object missing                                                                                                                                                                    | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-3`   | `payment.currency_code` missing                                                                                                                                                             | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-4`   | Currency not active (O adds: or conversion not available)                                                                                                                                   | P, O    | configuration                      | do_not_retry             |
| `BP-DR-5`   | `payment.amount_total` missing                                                                                                                                                              | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-6`   | Amount below the minimum (O adds: or breaks a currency rule)                                                                                                                                | P, O    | invalid_amount                     | do_not_retry             |
| `BP-DR-7`   | Amount above the maximum                                                                                                                                                                    | P, O    | invalid_amount                     | do_not_retry             |
| `BP-DR-8`   | Items plus shipping amount differ from `amount_total` (page spells the field `amount_itens`, O `amount_items`)                                                                              | P, O    | invalid_amount                     | do_not_retry             |
| `BP-DR-9`   | `merchant_payment_code` missing; O adds "or `payment_type_code` invalid"; X uses it for a missing or invalid Pix Automatico `due_date`                                                      | P, O, X | invalid_request                    | do_not_retry             |
| `BP-DR-10`  | `merchant_payment_code` longer than 40 characters                                                                                                                                           | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-11`  | `order_number` longer than 40 characters                                                                                                                                                    | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-12`  | A parameter is longer than allowed (page: 20 characters)                                                                                                                                    | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-13`  | Customer `name` missing                                                                                                                                                                     | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-14`  | Customer `name` longer than 100 characters                                                                                                                                                  | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-15`  | Customer `email` missing                                                                                                                                                                    | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-16`  | Customer `email` longer than 100 characters                                                                                                                                                 | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-17`  | Customer `email` not valid                                                                                                                                                                  | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-18`  | Customer suspended at EBANX; contact support if unexpected                                                                                                                                  | P, O    | fraud_or_risk                      | manual_review            |
| `BP-DR-19`  | `birth_date` missing                                                                                                                                                                        | P       | invalid_request                    | customer_action_required |
| `BP-DR-20`  | `birth_date` not a valid `dd/MM/yyyy` date                                                                                                                                                  | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-21`  | Customer younger than 16                                                                                                                                                                    | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-22`  | `document` (tax id) missing                                                                                                                                                                 | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-23`  | `document` not valid for the country (CPF in Brazil; DNI, CUIT, CUIL, CDI in Argentina; RUT in Chile; CC, CE, NIT in Colombia)                                                              | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-24`  | `zipcode` missing                                                                                                                                                                           | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-25`  | `address` missing (O adds: or invalid)                                                                                                                                                      | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-26`  | `street_number` missing                                                                                                                                                                     | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-27`  | `city` missing                                                                                                                                                                              | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-28`  | `state` missing                                                                                                                                                                             | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-29`  | `state` is not a valid state code                                                                                                                                                           | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-30`  | `amount_total` is not a number                                                                                                                                                              | O       | invalid_amount                     | do_not_retry             |
| `BP-DR-31`  | `phone_number` missing                                                                                                                                                                      | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-32`  | `phone_number` not valid                                                                                                                                                                    | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-33`  | Instalment value invalid (single value)                                                                                                                                                     | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-34`  | Instalment value invalid (range)                                                                                                                                                            | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-35`  | `payment_type_code` invalid (token endpoint: card BIN not found)                                                                                                                            | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-36`  | Payment type not active for the merchant                                                                                                                                                    | P, O    | configuration                      | do_not_retry             |
| `BP-DR-37`  | Amount differs from the enrollment's fixed amount (Pix Automatico)                                                                                                                          | O       | invalid_amount                     | do_not_retry             |
| `BP-DR-38`  | Payment type not allowed in Direct API full mode                                                                                                                                            | P, O    | configuration                      | do_not_retry             |
| `BP-DR-39`  | CPF does not match the customer's name and birth date                                                                                                                                       | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-40`  | Customer's monthly (O adds: or per-payment) amount limit exceeded                                                                                                                           | P, O    | invalid_amount                     | customer_action_required |
| `BP-DR-41`  | `person_type` invalid                                                                                                                                                                       | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-42`  | `responsible` object missing (company payer)                                                                                                                                                | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-43`  | `responsible.name` missing                                                                                                                                                                  | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-44`  | `responsible.document` missing                                                                                                                                                              | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-45`  | `responsible.birth_date` missing                                                                                                                                                            | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-46`  | Company representative's CPF, name and birth date do not match                                                                                                                              | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-47`  | `directdebit.bank_account` longer than 10 characters                                                                                                                                        | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-48`  | Card object missing (page names `payment.creditcard`, O `payment.card`)                                                                                                                     | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-49`  | Card number missing                                                                                                                                                                         | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-50`  | `merchant_payment_code` or `order_number` has non-printable or non-ASCII characters                                                                                                         | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-51`  | Cardholder name missing                                                                                                                                                                     | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-53`  | `card_cvv_mode` must be `recurrent` or `provided`                                                                                                                                           | O       | invalid_request                    | do_not_retry             |
| `BP-DR-54`  | CVV missing                                                                                                                                                                                 | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-55`  | CVV too long or invalid                                                                                                                                                                     | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-56`  | Card expiry date missing                                                                                                                                                                    | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-57`  | `due_date` not in `dd/MM/yyyy` format                                                                                                                                                       | P, O, X | invalid_request                    | do_not_retry             |
| `BP-DR-58`  | `due_date` further away than allowed (X: more than 10 days for Pix Automatico)                                                                                                              | P, O, X | invalid_request                    | do_not_retry             |
| `BP-DR-59`  | `due_date` sooner than allowed (X: less than 2 days for Pix Automatico)                                                                                                                     | P, O, X | invalid_request                    | do_not_retry             |
| `BP-DR-60`  | Pix Automatico `merchant_enrollment_code` invalid or not active                                                                                                                             | O, S, X | invalid_request                    | do_not_retry             |
| `BP-DR-61`  | Card token could not be created                                                                                                                                                             | P, O    | unknown                            | manual_review            |
| `BP-DR-62`  | **conflict**. P: recurring payments not enabled for the merchant (configuration). O and X: this Pix Automatico billing cycle already has a pending or confirmed payment (duplicate_request) | P, O, X | configuration or duplicate_request | do_not_retry             |
| `BP-DR-63`  | **conflict**. P: token not found for this acquirer. O and X: payment `due_date` before the subscription start date                                                                          | P, O, X | invalid_request                    | do_not_retry             |
| `BP-DR-64`  | Card token not found                                                                                                                                                                        | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-65`  | Custom token value already used by another card                                                                                                                                             | P, O    | duplicate_request                  | do_not_retry             |
| `BP-DR-66`  | Custom token length outside 32 to 128 characters                                                                                                                                            | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-67`  | Card expiry invalid (O adds: token expired or card invalid)                                                                                                                                 | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-68`  | `directdebit.bank_account` missing                                                                                                                                                          | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-69`  | `directdebit.bank_agency` longer than 10 characters                                                                                                                                         | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-70`  | `directdebit.bank_agency` missing                                                                                                                                                           | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-71`  | `directdebit.bank_code` longer than 5 characters                                                                                                                                            | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-72`  | `directdebit.bank_code` missing                                                                                                                                                             | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-73`  | `directdebit` object required for this method                                                                                                                                               | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-75`  | Card number invalid (token endpoint: fails Luhn or format)                                                                                                                                  | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-76`  | `bank_details` or `bank_details.bank_code` required for this method                                                                                                                         | O       | invalid_request                    | customer_action_required |
| `BP-DR-77`  | Country not enabled (bank list: or no banks for this country and method)                                                                                                                    | P, O    | configuration                      | do_not_retry             |
| `BP-DR-78`  | Country (O adds: or payment type) not enabled for the merchant                                                                                                                              | P, O    | configuration                      | do_not_retry             |
| `BP-DR-79`  | More instalments than the merchant maximum                                                                                                                                                  | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-80`  | PagoEfectivo payment code (CIP) could not be generated; page says try again                                                                                                                 | P, O    | provider_unavailable               | retry_conditionally      |
| `BP-DR-81`  | Currency not allowed for this payment type                                                                                                                                                  | P, O    | configuration                      | do_not_retry             |
| `BP-DR-82`  | `note` longer than 200 characters                                                                                                                                                           | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-83`  | Card issued outside the acquirer's country cannot be processed                                                                                                                              | P, O    | payment_method_unavailable         | customer_action_required |
| `BP-DR-84`  | Same customer and amount charged within the configured minutes; blocked as a duplicate                                                                                                      | P, O    | duplicate_request                  | do_not_retry             |
| `BP-DR-85`  | `sub_account` missing                                                                                                                                                                       | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-86`  | `sub_account` invalid                                                                                                                                                                       | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-87`  | `sub_account.name` missing                                                                                                                                                                  | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-88`  | `sub_account.image_url` missing                                                                                                                                                             | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-89`  | Instalment count is on the merchant's blocked list                                                                                                                                          | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-90`  | Customer (O adds: or card) on EBANX blocklist                                                                                                                                               | P, O    | fraud_or_risk                      | do_not_retry             |
| `BP-DR-91`  | `institution_code` / `bank_code` missing or invalid (PSE, DuitNow)                                                                                                                          | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-92`  | `institution_code` is not a valid bank code                                                                                                                                                 | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-93`  | PSE ACH could not create the payment (message carries a provider code)                                                                                                                      | P, O    | provider_unavailable               | retry_conditionally      |
| `BP-DR-94`  | The tokenized card has expired                                                                                                                                                              | P       | card_declined                      | customer_action_required |
| `BP-DR-95`  | Cardholder name contains digits                                                                                                                                                             | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-96`  | Card token expired                                                                                                                                                                          | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-97`  | Instalments not allowed on prepaid cards                                                                                                                                                    | P, O    | payment_method_unavailable         | customer_action_required |
| `BP-DR-98`  | Customer email already tied to payments in another country                                                                                                                                  | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-99`  | `sub_account.image_url` must use https                                                                                                                                                      | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-100` | Instalments not allowed on debit cards                                                                                                                                                      | P, O    | payment_method_unavailable         | customer_action_required |
| `BP-DR-101` | Card cannot be used online                                                                                                                                                                  | P, O    | card_declined                      | customer_action_required |
| `BP-DR-102` | Too many attempts for the same transaction in a short time                                                                                                                                  | P, O    | rate_limiting                      | retry_conditionally      |
| `BP-DR-103` | Customer temporarily inactivated (too many cards used)                                                                                                                                      | P, O    | fraud_or_risk                      | manual_review            |
| `BP-DR-104` | `notification_url` invalid                                                                                                                                                                  | P, O    | configuration                      | do_not_retry             |
| `BP-DR-105` | `flow_payment_method` required (Flow)                                                                                                                                                       | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-106` | Processing trial limit reached; merchant must send documents                                                                                                                                | P       | configuration                      | manual_review            |
| `BP-DR-107` | Timeout talking to an external API                                                                                                                                                          | O       | network_or_timeout                 | retry_conditionally      |
| `BP-DR-108` | FX token invalid                                                                                                                                                                            | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-109` | FX token feature not enabled                                                                                                                                                                | P, O    | configuration                      | do_not_retry             |
| `BP-DR-110` | FX token currency not enabled or not found                                                                                                                                                  | P, O    | configuration                      | do_not_retry             |
| `BP-DR-111` | Customer document could not be validated; page says try again                                                                                                                               | P, O    | provider_unavailable               | retry_conditionally      |
| `BP-DR-112` | Card hit the limit of insufficient-funds attempts (page: 2 attempts)                                                                                                                        | P, O    | insufficient_funds                 | customer_action_required |
| `BP-DR-113` | Customer document blocked by compliance (O adds: or card pre-validation failure)                                                                                                            | P, O    | fraud_or_risk                      | do_not_retry             |
| `BP-DR-114` | Customer CPF blocked for fraud (Pix)                                                                                                                                                        | O       | fraud_or_risk                      | do_not_retry             |
| `BP-DR-116` | Merchant not enabled for manual review                                                                                                                                                      | O       | configuration                      | do_not_retry             |
| `BP-DR-117` | Instalment value below BRL 5.00                                                                                                                                                             | P, O    | invalid_amount                     | customer_action_required |
| `BP-DR-118` | Sub-account data invalid                                                                                                                                                                    | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-119` | Timeout with the acquirer or provider during processing; final state unknown, reconcile with `/ws/query`                                                                                    | O, S    | network_or_timeout                 | retry_conditionally      |
| `BP-DR-120` | External service not available                                                                                                                                                              | P, O, S | provider_unavailable               | retry_conditionally      |
| `BP-DR-121` | External service unavailable during creation or FX                                                                                                                                          | O       | provider_unavailable               | retry_conditionally      |
| `BP-DR-128` | Boleto BEXS not available                                                                                                                                                                   | O       | payment_method_unavailable         | do_not_retry             |
| `BP-DR-129` | Instalment payments need auto-capture                                                                                                                                                       | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-130` | 3DS cryptogram missing                                                                                                                                                                      | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-131` | 3DS ECI missing                                                                                                                                                                             | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-132` | **conflict**. P: 3DS cryptogram and ECI both missing. O (`/ws/ewallet-availableEWallets`): `country` missing                                                                                | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-133` | 3DS cryptogram and ECI must be sent together                                                                                                                                                | O       | invalid_request                    | do_not_retry             |
| `BP-DR-135` | Network token PAN invalid                                                                                                                                                                   | O       | invalid_request                    | do_not_retry             |
| `BP-DR-136` | Network token expiry invalid                                                                                                                                                                | O       | invalid_request                    | do_not_retry             |
| `BP-DR-137` | Network token cryptogram invalid                                                                                                                                                            | O       | invalid_request                    | do_not_retry             |
| `BP-DR-138` | 3DS directory server transaction id required for 3DS data-only                                                                                                                              | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-139` | `threeds_version` must be 1 or 2                                                                                                                                                            | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-140` | Affiliation id required for this method                                                                                                                                                     | O       | configuration                      | do_not_retry             |
| `BP-DR-141` | `document_country` invalid                                                                                                                                                                  | O       | invalid_request                    | customer_action_required |
| `BP-DR-142` | Merchant not allowed to charge foreign customers                                                                                                                                            | O       | configuration                      | do_not_retry             |
| `BP-DR-143` | Hard decline from the e-wallet provider after retries                                                                                                                                       | O, S    | payment_method_unavailable         | do_not_retry             |
| `BP-DR-144` | Payment could not be processed; try later                                                                                                                                                   | O       | provider_unavailable               | retry_conditionally      |
| `BP-DR-145` | Card BIN not supported for 3DS                                                                                                                                                              | O       | payment_method_unavailable         | customer_action_required |
| `BP-DR-146` | 3DS cannot be forced on a notified enrollment charge                                                                                                                                        | O       | invalid_request                    | do_not_retry             |
| `BP-DR-147` | Network token original BIN invalid                                                                                                                                                          | O       | invalid_request                    | do_not_retry             |
| `BP-DR-148` | Network token original last four digits invalid                                                                                                                                             | O       | invalid_request                    | do_not_retry             |
| `BP-DR-150` | Pix expiration time error                                                                                                                                                                   | O       | invalid_request                    | do_not_retry             |
| `BP-DR-151` | Payment not eligible for this flow                                                                                                                                                          | O       | invalid_request                    | do_not_retry             |
| `BP-DR-152` | Card-on-file `cof_type` missing                                                                                                                                                             | O       | invalid_request                    | do_not_retry             |
| `BP-DR-153` | `cof_type` value not allowed                                                                                                                                                                | O       | invalid_request                    | do_not_retry             |
| `BP-DR-154` | Card-on-file `initiator` missing                                                                                                                                                            | O       | invalid_request                    | do_not_retry             |
| `BP-DR-155` | `initiator` value not allowed                                                                                                                                                               | O       | invalid_request                    | do_not_retry             |
| `BP-DR-156` | Card-on-file `trans_type` missing                                                                                                                                                           | O       | invalid_request                    | do_not_retry             |
| `BP-DR-157` | `trans_type` value not allowed                                                                                                                                                              | O       | invalid_request                    | do_not_retry             |
| `BP-DR-158` | Merchant-initiated charge cannot open a new card-on-file agreement                                                                                                                          | O       | invalid_request                    | do_not_retry             |
| `BP-DR-164` | JWE integration key error                                                                                                                                                                   | O       | configuration                      | do_not_retry             |
| `BP-DR-166` | Indian postal code must have exactly 6 digits                                                                                                                                               | O       | invalid_request                    | customer_action_required |
| `BP-DR-167` | Customer-initiated charge cannot open a `MERCHANT_COF` agreement                                                                                                                            | O       | invalid_request                    | do_not_retry             |
| `BP-DR-168` | Merchant-initiated charge cannot use `CUSTOMER_COF`                                                                                                                                         | O       | invalid_request                    | do_not_retry             |
| `BP-DR-169` | Customer-initiated stored-credential charge must use `CUSTOMER_COF`                                                                                                                         | O       | invalid_request                    | do_not_retry             |
| `BP-DR-170` | Split payment required for this merchant and method                                                                                                                                         | O       | configuration                      | do_not_retry             |
| `BP-DR-171` | Local amount override error                                                                                                                                                                 | O       | invalid_request                    | do_not_retry             |
| `BP-DR-172` | `bank_details.account_number` required                                                                                                                                                      | O       | invalid_request                    | customer_action_required |
| `BP-DR-173` | `amount_total` contains a comma; use a dot                                                                                                                                                  | P, O    | invalid_amount                     | do_not_retry             |
| `BP-DR-174` | `metadata.upi_vpa` required for UPI                                                                                                                                                         | O       | invalid_request                    | customer_action_required |
| `BP-DR-175` | `sub_account.code` required                                                                                                                                                                 | O       | invalid_request                    | do_not_retry             |
| `BP-DR-176` | Card verification not enabled for the merchant                                                                                                                                              | O       | configuration                      | do_not_retry             |
| `BP-DR-177` | `network_token_wallet_type` value not allowed                                                                                                                                               | O       | invalid_request                    | do_not_retry             |
| `BP-DR-178` | `network_token_wallet_type` missing                                                                                                                                                         | O       | invalid_request                    | do_not_retry             |
| `BP-DR-180` | `merchant_enrollment_code` not found                                                                                                                                                        | O       | invalid_request                    | do_not_retry             |
| `BP-DR-181` | Enrollment event not found                                                                                                                                                                  | O       | invalid_request                    | do_not_retry             |
| `BP-DR-182` | Enrollment not accepted; cannot charge                                                                                                                                                      | O, S, X | payment_method_unavailable         | customer_action_required |
| `BP-DR-183` | `currency_rate_usd` not allowed for this merchant                                                                                                                                           | O       | configuration                      | do_not_retry             |
| `BP-DR-184` | `currency_rate_usd` contains a comma                                                                                                                                                        | O       | invalid_request                    | do_not_retry             |
| `BP-DR-185` | `currency_rate_usd` invalid                                                                                                                                                                 | O       | invalid_request                    | do_not_retry             |
| `BP-DR-186` | Trusted-transaction flag must be boolean                                                                                                                                                    | O       | invalid_request                    | do_not_retry             |
| `BP-DR-187` | Payment creation error                                                                                                                                                                      | O       | unknown                            | manual_review            |
| `BP-DR-188` | `iof_paid_by_merchant` invalid                                                                                                                                                              | O       | invalid_request                    | do_not_retry             |
| `BP-DR-189` | `iof_paid_by_merchant` must be boolean                                                                                                                                                      | O       | invalid_request                    | do_not_retry             |
| `BP-DR-190` | `network_token_eci` invalid                                                                                                                                                                 | O       | invalid_request                    | do_not_retry             |
| `BP-DR-191` | HSN product code validation failed (India)                                                                                                                                                  | O       | invalid_request                    | do_not_retry             |
| `BP-DR-200` | Sub-account legal name failed validation (FlyWire)                                                                                                                                          | O       | invalid_request                    | do_not_retry             |
| `BP-DR-203` | Sub-account country failed validation (FlyWire)                                                                                                                                             | O       | invalid_request                    | do_not_retry             |
| `BP-DR-204` | Sub-account missing (FlyWire)                                                                                                                                                               | O       | invalid_request                    | do_not_retry             |
| `BP-DR-205` | `merchant_associated_invoices` longer than 2550 characters                                                                                                                                  | O       | invalid_request                    | do_not_retry             |
| `BP-DR-206` | `info_to_payer` longer than 140 characters                                                                                                                                                  | O       | invalid_request                    | do_not_retry             |
| `BP-DR-207` | Customer was not notified before the enrollment charge                                                                                                                                      | O       | invalid_request                    | do_not_retry             |
| `BP-DR-208` | Integration key missing or invalid (token delete)                                                                                                                                           | O       | configuration                      | do_not_retry             |
| `BP-DR-209` | Token to delete not found                                                                                                                                                                   | O       | invalid_request                    | do_not_retry             |
| `BP-DR-210` | `merchant_enrollment_code` required                                                                                                                                                         | O       | invalid_request                    | do_not_retry             |
| `BP-DR-211` | `customer_device_info.source` invalid                                                                                                                                                       | O       | invalid_request                    | do_not_retry             |
| `BP-DR-213` | `metadata.lrs_type` required (India travel)                                                                                                                                                 | O       | invalid_request                    | do_not_retry             |
| `BP-DR-214` | `metadata.lrs_type` must be `flight`, `hotel` or `tour`                                                                                                                                     | O       | invalid_request                    | do_not_retry             |
| `BP-DR-215` | Currency not allowed for this country for the merchant                                                                                                                                      | O       | configuration                      | do_not_retry             |
| `BP-DR-216` | Payment country differs from the enrollment country                                                                                                                                         | O       | invalid_request                    | do_not_retry             |
| `BP-DR-219` | This payment type does not support enrollment                                                                                                                                               | P, O    | invalid_request                    | do_not_retry             |
| `BP-DR-220` | One-time enrollment already used; create a new one                                                                                                                                          | P, O    | invalid_request                    | customer_action_required |
| `BP-DR-221` | `device_os` required for this payment type (bank list)                                                                                                                                      | O       | invalid_request                    | do_not_retry             |
| `BP-DR-222` | `device_os` must be `android` or `ios`                                                                                                                                                      | O       | invalid_request                    | do_not_retry             |
| `BP-DR-600` | Customer document blocked after too many attempts for this payment type                                                                                                                     | O       | fraud_or_risk                      | manual_review            |
| `BP-DR-601` | Customer email blocked after too many attempts for this payment type                                                                                                                        | O       | fraud_or_risk                      | manual_review            |
| `BP-DR-602` | Declined because the amount is above a limit                                                                                                                                                | O       | invalid_amount                     | do_not_retry             |
| `BP-DR-603` | Customer phone number on blocklist                                                                                                                                                          | O       | fraud_or_risk                      | do_not_retry             |
| `BP-DR-999` | Hard decline passed on from cross-border processing                                                                                                                                         | O       | unknown                            | do_not_retry             |

#### 4.3 Refund, cancel, capture, query and status codes: 97 codes

| Code           | Meaning (paraphrase)                                                                                      | Src  | Category                   | Retry                    |
| -------------- | --------------------------------------------------------------------------------------------------------- | ---- | -------------------------- | ------------------------ |
| `BP-REF-1`     | Payment `hash` missing                                                                                    | P    | invalid_request            | do_not_retry             |
| `BP-REF-2`     | Payment not found for this merchant                                                                       | P    | invalid_request            | do_not_retry             |
| `BP-REF-3`     | `operation` missing (must be `request` or `cancel`)                                                       | P    | invalid_request            | do_not_retry             |
| `BP-REF-4`     | Refund `amount` missing                                                                                   | P    | invalid_request            | do_not_retry             |
| `BP-REF-5`     | Refund amount not positive                                                                                | P    | invalid_amount             | do_not_retry             |
| `BP-REF-6`     | Refund amount larger than the payment                                                                     | P    | invalid_amount             | do_not_retry             |
| `BP-REF-7`     | Payment is not `CO`, so it cannot be refunded                                                             | P    | invalid_request            | do_not_retry             |
| `BP-REF-8`     | Payment has a chargeback, so it cannot be refunded                                                        | P    | invalid_request            | do_not_retry             |
| `BP-REF-9`     | Pending refunds plus this one would exceed the payment amount                                             | P    | invalid_amount             | do_not_retry             |
| `BP-REF-10`    | Refund `description` missing                                                                              | P    | invalid_request            | do_not_retry             |
| `BP-REF-11`    | `refund_id` or `merchant_refund_code` missing                                                             | P    | invalid_request            | do_not_retry             |
| `BP-REF-12`    | Refund not found for that `refund_id` / `merchant_refund_code`                                            | P    | invalid_request            | do_not_retry             |
| `BP-REF-13`    | Refund already cancelled                                                                                  | P    | duplicate_request          | do_not_retry             |
| `BP-REF-14`    | Refund already confirmed                                                                                  | P    | duplicate_request          | do_not_retry             |
| `BP-REF-15`    | Operation invalid (O adds: for this payment type or environment)                                          | P, O | invalid_request            | do_not_retry             |
| `BP-REF-16`    | `merchant_refund_code` longer than 20 characters                                                          | P    | invalid_request            | do_not_retry             |
| `BP-REF-17`    | A refund with this `merchant_refund_code` already exists                                                  | P    | duplicate_request          | do_not_retry             |
| `BP-REF-18`    | Merchant balance too low for a new refund; contact EBANX finance                                          | P    | configuration              | manual_review            |
| `BP-REF-19`    | Card payment opened more than 85 days ago                                                                 | P    | invalid_request            | do_not_retry             |
| `BP-REF-20`    | Request has both `payment.card` and `payment.creditcard`                                                  | P    | invalid_request            | do_not_retry             |
| `BP-REF-21`    | Customer document blocked by compliance                                                                   | P    | fraud_or_risk              | do_not_retry             |
| `BP-REF-22`    | Partial refunds not supported for this payment type                                                       | P    | payment_method_unavailable | do_not_retry             |
| `BP-REF-23`    | Refund bank info: bank name invalid                                                                       | P    | invalid_request            | customer_action_required |
| `BP-REF-24`    | Refund bank info not allowed for this country                                                             | P    | invalid_request            | do_not_retry             |
| `BP-REF-25`    | Bank details empty for a bank that needs them                                                             | P    | invalid_request            | customer_action_required |
| `BP-REF-26`    | Bank detail operation code invalid                                                                        | P    | invalid_request            | customer_action_required |
| `BP-REF-27`    | Bank name does not exist                                                                                  | P    | invalid_request            | customer_action_required |
| `BP-REF-28`    | Account type invalid                                                                                      | P    | invalid_request            | customer_action_required |
| `BP-REF-29`    | Refunds to savings accounts not available at this bank                                                    | P    | payment_method_unavailable | customer_action_required |
| `BP-REF-30`    | Bank branch invalid                                                                                       | P    | invalid_request            | customer_action_required |
| `BP-REF-31`    | Bank account invalid                                                                                      | P    | invalid_request            | customer_action_required |
| `BP-REF-33`    | `bank_info` missing                                                                                       | P    | invalid_request            | do_not_retry             |
| `BP-REF-34`    | Refund was not created with bank info, so bank info cannot be updated                                     | P    | invalid_request            | do_not_retry             |
| `BP-REF-35`    | Refund is not waiting for bank info (status and substatus must be `CO-AW`)                                | P    | invalid_request            | do_not_retry             |
| `BP-REF-36`    | Payment hash does not match the refund id or code                                                         | P    | invalid_request            | do_not_retry             |
| `BP-REF-37`    | CLABE invalid                                                                                             | P    | invalid_request            | customer_action_required |
| `BP-REF-38`    | Bank cannot be derived from the CLABE                                                                     | P    | invalid_request            | customer_action_required |
| `BP-REF-39`    | Refund with Single Transaction cannot be cancelled                                                        | P    | invalid_request            | do_not_retry             |
| `BP-REF-40`    | Chile refunds must be at least 50.00 CLP                                                                  | P    | invalid_amount             | do_not_retry             |
| `BP-REF-41`    | Payment already fully refunded; the same code is also returned for an invalid Pix key in refund bank info | P    | duplicate_request          | do_not_retry             |
| `BP-REF-42`    | Pix key type cannot be identified                                                                         | P    | invalid_request            | customer_action_required |
| `BP-REF-43`    | Refund already being processed; cannot request again or cancel                                            | P    | duplicate_request          | do_not_retry             |
| `BP-REF-45`    | Refund simulator used outside sandbox                                                                     | P    | configuration              | do_not_retry             |
| `BP-REF-46`    | Refund simulator: `integration_key` empty                                                                 | P    | configuration              | do_not_retry             |
| `BP-REF-47`    | Refund simulator: `integration_key` invalid                                                               | P    | configuration              | do_not_retry             |
| `BP-REF-48`    | Refund simulator: refund not found                                                                        | P    | invalid_request            | do_not_retry             |
| `BP-REF-49`    | Refund simulator: form only for refunds in `PE` or `CO`                                                   | P    | invalid_request            | do_not_retry             |
| `BP-REF-50`    | Refund simulator: form only for substatus `AW`                                                            | P    | invalid_request            | do_not_retry             |
| `BP-REF-51`    | Refund simulator: substatus change not allowed from the current status                                    | P    | invalid_request            | do_not_retry             |
| `BP-REF-53`    | Refund window for this payment (UPI, India) has passed                                                    | P    | invalid_request            | do_not_retry             |
| `BP-REF-54`    | Refund simulator does not support this country                                                            | P    | configuration              | do_not_retry             |
| `BP-REF-55`    | Pix `info_to_recipient` longer than 140 characters                                                        | P    | invalid_request            | do_not_retry             |
| `BP-REF-56`    | Payment captured too long ago (180 days when the age limit is enabled)                                    | P    | invalid_request            | do_not_retry             |
| `BP-REF-57`    | Refunds blocked until the merchant's outstanding balances are settled                                     | P    | configuration              | manual_review            |
| `BP-REF-58`    | Refund simulator: refund already paid                                                                     | P    | duplicate_request          | do_not_retry             |
| `BP-REF-59`    | Customer not eligible for a refund                                                                        | P    | unknown                    | manual_review            |
| `BP-REF-60`    | Payment failed AML verification (India travel); cannot be refunded                                        | P    | fraud_or_risk              | do_not_retry             |
| `BP-REF-CAN-1` | Payment is `CA`: neither cancel nor refund possible                                                       | P    | invalid_request            | do_not_retry             |
| `BP-CAN-1`     | `hash` missing (O: `hash` or `merchant_payment_code` missing)                                             | P, O | invalid_request            | do_not_retry             |
| `BP-CAN-2`     | Payment not found for this merchant                                                                       | P, O | invalid_request            | do_not_retry             |
| `BP-CAN-3`     | Payment already cancelled                                                                                 | P, O | duplicate_request          | do_not_retry             |
| `BP-CAN-4`     | Payment cannot be cancelled (O: status is not `OP` or `PE`)                                               | P, O | invalid_request            | do_not_retry             |
| `BP-CAN-5`     | Payment cannot be cancelled (for example the method does not allow it)                                    | O    | payment_method_unavailable | do_not_retry             |
| `BP-CAN-6`     | Payment cannot be cancelled on its due date                                                               | O    | invalid_request            | do_not_retry             |
| `BP-CAN-7`     | Gateway unavailable while cancelling                                                                      | O    | provider_unavailable       | retry_conditionally      |
| `BP-CAP-1`     | `hash` or `merchant_payment_code` missing                                                                 | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-2`     | Payment not found for this merchant                                                                       | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-3`     | Payment is `CA`; cannot capture                                                                           | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-4`     | Payment already captured (`CO`)                                                                           | P, O | duplicate_request          | do_not_retry             |
| `BP-CAP-5`     | Payment is `OP`; cannot capture                                                                           | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-6`     | Payment type does not support capture                                                                     | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-7`     | Payment was created with auto-capture                                                                     | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-8`     | `capture_available` is false                                                                              | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-9`     | `pre_approved` is false (not authorized)                                                                  | P, O | invalid_request            | do_not_retry             |
| `BP-CAP-10`    | Capture amount invalid                                                                                    | P, O | invalid_amount             | do_not_retry             |
| `BP-CAP-11`    | Partial capture not available for this payment                                                            | P, O | payment_method_unavailable | do_not_retry             |
| `BP-CAP-12`    | Capture amount above the authorized maximum                                                               | P, O | invalid_amount             | do_not_retry             |
| `BP-CAP-13`    | Split missing on partial capture of a split payment                                                       | O    | invalid_request            | do_not_retry             |
| `BP-CAP-14`    | Split amounts do not add up to the captured amount                                                        | O    | invalid_amount             | do_not_retry             |
| `BP-CAP-15`    | A split amount is not positive                                                                            | O    | invalid_amount             | do_not_retry             |
| `BP-CAP-16`    | Same split recipient listed twice                                                                         | O    | invalid_request            | do_not_retry             |
| `BP-CAP-17`    | Split recipient not part of the original payment                                                          | O    | invalid_request            | do_not_retry             |
| `BP-CAP-18`    | Liability or fee responsibility cannot change at capture                                                  | O    | invalid_request            | do_not_retry             |
| `BP-CAP-19`    | Split percentages not positive or not totalling 100%                                                      | O    | invalid_request            | do_not_retry             |
| `BP-CAP-20`    | Split mixes amounts and percentages, or a rule has neither                                                | O    | invalid_request            | do_not_retry             |
| `BP-Q-1`       | `hash` or `merchant_payment_code` missing                                                                 | P, O | invalid_request            | do_not_retry             |
| `BP-Q-2`       | Payment not found for this merchant                                                                       | P, O | invalid_request            | do_not_retry             |
| `BP-US-1`      | Status update (sandbox): `hash` missing                                                                   | P    | invalid_request            | do_not_retry             |
| `BP-US-2`      | Status update (sandbox): payment not found                                                                | P    | invalid_request            | do_not_retry             |
| `BP-US-3`      | Status update (sandbox): `status` missing                                                                 | P    | invalid_request            | do_not_retry             |
| `BP-US-4`      | Status update (sandbox): status must be `CO` or `CA`                                                      | P    | invalid_request            | do_not_retry             |
| `BP-US-5`      | Status update attempted in production; only EBANX changes statuses there                                  | P    | configuration              | do_not_retry             |
| `BP-US-01`     | Subscription update failed                                                                                | O    | unknown                    | manual_review            |
| `BP-US-03`     | Subscription update: external provider not found                                                          | O    | configuration              | do_not_retry             |
| `BP-US-04`     | Subscription update: external provider invalid                                                            | O    | configuration              | do_not_retry             |
| `BP-US-05`     | Subscription update failed at the provider                                                                | O    | provider_unavailable       | retry_conditionally      |
| `BP-US-06`     | Subscription or enrollment not found for the `merchant_enrollment_code`                                   | O    | invalid_request            | do_not_retry             |

`BP-US-1` to `BP-US-5` (P, no leading zero) and `BP-US-01` to `BP-US-06` (O, leading zero) are different code families with different meanings; match them as exact strings.

#### 4.4 Other pay-in families: 3DS, enrollments, instalment plans, single transaction, payment page, retry, OTP, utilities and chargeback evidence: 159 codes

3DS (`BP-3DS-*`; default invalid_request / do_not_retry):

| Code                     | Meaning (paraphrase)                                                                         | Src  | Category              | Retry        |
| ------------------------ | -------------------------------------------------------------------------------------------- | ---- | --------------------- | ------------ |
| `BP-3DS-1`               | `public_integration_key` missing for 3DS 2.0                                                 | P, O | configuration         | do_not_retry |
| `BP-3DS-2`               | `public_integration_key` invalid for 3DS 2.0                                                 | P, O | configuration         | do_not_retry |
| `BP-3DS-19`              | `threeds_mode` and `threeds_force` sent together                                             | O    | invalid_request       | do_not_retry |
| `BP-3DS-20`              | `threeds_mode` value invalid                                                                 | O    | invalid_request       | do_not_retry |
| `BP-3DS-33`              | `browser_info.color_depth` must be a string                                                  | O    | invalid_request       | do_not_retry |
| `BP-3DS-34`, `BP-3DS-35` | `browser_info.screen_height` missing (data-only) / not a string                              | O    | invalid_request       | do_not_retry |
| `BP-3DS-36`, `BP-3DS-37` | `browser_info.screen_width` missing (data-only) / not a string                               | O    | invalid_request       | do_not_retry |
| `BP-3DS-38`, `BP-3DS-39` | `browser_info.timezone_offset` missing (data-only) / not a string                            | O    | invalid_request       | do_not_retry |
| `BP-3DS-40`, `BP-3DS-41` | `browser_info.javascript_enabled` missing (data-only) / not boolean                          | O    | invalid_request       | do_not_retry |
| `BP-3DS-42`, `BP-3DS-43` | `browser_info.java_enabled` missing (data-only) / not boolean                                | O    | invalid_request       | do_not_retry |
| `BP-3DS-44`              | `browser_info` required for `data_only` or `data_only_preferred`                             | O    | invalid_request       | do_not_retry |
| `BP-3DS-45`              | 3DS authentication value (UCAF) already used by another payment                              | O    | authentication_failed | do_not_retry |
| `BP-3DS-46`              | 3DS data (ECI/XID) does not match what EBANX stored, or the 3DS reference cannot be resolved | P, O | authentication_failed | do_not_retry |

User enrollments (`BP-UE-*`, `/ws/userenrollment` and recurring `/ws/direct`; O, wording also on page X for some):

| Code                   | Meaning (paraphrase)                                                         | Category                   | Retry                    |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `BP-UE-01`, `BP-UE-02` | `operation` missing / invalid                                                | invalid_request            | do_not_retry             |
| `BP-UE-03`             | Required enrollment field missing (on `/ws/direct`: enrollment code missing) | invalid_request            | do_not_retry             |
| `BP-UE-04`             | Required enrollment field empty                                              | invalid_request            | do_not_retry             |
| `BP-UE-05`             | A `back_urls` URL is invalid                                                 | invalid_request            | do_not_retry             |
| `BP-UE-06`             | `enrollment.country` invalid                                                 | invalid_request            | do_not_retry             |
| `BP-UE-07`, `BP-UE-08` | `payment_type_code` missing / invalid                                        | invalid_request            | do_not_retry             |
| `BP-UE-09`             | Payment type not enabled for this country                                    | configuration              | do_not_retry             |
| `BP-UE-10`             | Payment type not enabled in full mode for the merchant                       | configuration              | do_not_retry             |
| `BP-UE-11`             | No provider enabled for this operation                                       | configuration              | do_not_retry             |
| `BP-UE-12`             | Unexpected enrollment error                                                  | unknown                    | manual_review            |
| `BP-UE-13`             | Payment type profile not found or unsupported for this operation             | configuration              | do_not_retry             |
| `BP-UE-14`             | Enrollment not found                                                         | invalid_request            | do_not_retry             |
| `BP-UE-15`             | Provider-specific cancellation error                                         | provider_unavailable       | manual_review            |
| `BP-UE-16`             | Enrollment code already used                                                 | duplicate_request          | do_not_retry             |
| `BP-UE-17`             | Authentication failed or subscription amount invalid                         | authentication_failed      | customer_action_required |
| `BP-UE-18`             | `subscription.expiration_date` invalid                                       | invalid_request            | do_not_retry             |
| `BP-UE-19`             | `upi.vpa` missing or malformed                                               | invalid_request            | customer_action_required |
| `BP-UE-20`, `BP-UE-21` | Update has no updatable field / names a field that cannot be updated         | invalid_request            | do_not_retry             |
| `BP-UE-22`             | `enrollment` object missing                                                  | invalid_request            | do_not_retry             |
| `BP-UE-23`             | `subscription.frequency` missing                                             | invalid_request            | do_not_retry             |
| `BP-UE-24`             | `subscription.start_date` invalid (X: must be in the future)                 | invalid_request            | do_not_retry             |
| `BP-UE-25`             | `subscription.recurrence_value` must be an integer                           | invalid_request            | do_not_retry             |
| `BP-UE-26`             | `subscription.retry` invalid                                                 | invalid_request            | do_not_retry             |
| `BP-UE-27`             | `subscription.subscription_name` missing                                     | invalid_request            | do_not_retry             |
| `BP-UE-28`             | `subscription.max_amount_floor` invalid                                      | invalid_request            | do_not_retry             |
| `BP-UE-29`             | `subscription.fixed_amount` missing                                          | invalid_request            | do_not_retry             |
| `BP-UE-30`             | `enrollment.name` (X: any field) has invalid size or format                  | invalid_request            | do_not_retry             |
| `BP-UE-31`             | `yape.type` and `yape.source` required                                       | invalid_request            | do_not_retry             |
| `BP-UE-32`             | Provider internal error                                                      | provider_unavailable       | retry_conditionally      |
| `BP-UE-33`             | Provider timeout                                                             | network_or_timeout         | retry_conditionally      |
| `BP-UE-34`             | Provider rejected the parameters                                             | invalid_request            | do_not_retry             |
| `BP-UE-35`             | Document status validation failed (X: CPF/CNPJ invalid or not regular)       | invalid_request            | customer_action_required |
| `BP-UE-36`             | Subscription amount conflicts with the payment amount                        | invalid_amount             | do_not_retry             |
| `BP-UE-37`             | Document name validation failed (X: external validator unavailable)          | provider_unavailable       | retry_conditionally      |
| `BP-UE-38`, `BP-UE-39` | Authentication data missing / authentication type not allowed                | invalid_request            | do_not_retry             |
| `BP-UE-40`, `BP-UE-41` | `contract` missing / invalid                                                 | invalid_request            | do_not_retry             |
| `BP-UE-42`             | Provider rejected the enrollment                                             | payment_method_unavailable | customer_action_required |
| `BP-UE-44`, `BP-UE-45` | `Origin` header missing / origin host invalid                                | configuration              | do_not_retry             |
| `BP-UE-46`             | Provider reports incorrect customer data                                     | invalid_request            | customer_action_required |
| `BP-UE-48`             | `enrollment.identification` must be a valid CPF                              | invalid_request            | customer_action_required |
| `BP-UE-49`             | `account_details.bank_id` not a supported bank                               | invalid_request            | customer_action_required |
| `BP-UE-50`             | `start_date` cannot change once payments exist                               | invalid_request            | do_not_retry             |
| `BP-UE-51`             | Provider transaction limit exceeded                                          | invalid_amount             | customer_action_required |
| `BP-UE-52`             | Provider says the payment is not valid                                       | invalid_request            | do_not_retry             |
| `BP-UE-53`             | Provider says the amount is invalid                                          | invalid_amount             | do_not_retry             |
| `BP-UE-54`             | `enrollment.note` longer than 200 bytes                                      | invalid_request            | do_not_retry             |

Payment page (`/ws/request`) and retry codes (`BP-R-*`). The same code strings carry **two meanings**: on the payment page (P) and on `/ws/retry` for Pix Automatico (X; O and S agree with X for `BP-R-5` and `BP-R-6` but word `BP-R-5` differently). Decide by endpoint.

| Code                 | P meaning (payment page)                                                     | X / O / S meaning (retry)                                                       | Category (P / retry)                         | Retry (P / retry)                              |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `BP-R-1`             | `currency_code` missing                                                      | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-2`             | `amount` missing                                                             | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-3`             | `merchant_payment_code` missing                                              | X: payment is not pending, so it cannot be retried                              | invalid_request / invalid_request            | do_not_retry / do_not_retry                    |
| `BP-R-4`             | Customer `name` missing                                                      | X: payment not eligible for retry (policy disallows it or 7-day window passed)  | invalid_request / payment_method_unavailable | customer_action_required / do_not_retry        |
| `BP-R-5`             | Customer `email` missing                                                     | X: already retried today (one per day); O and S: another attempt is in progress | invalid_request / duplicate_request          | customer_action_required / retry_conditionally |
| `BP-R-6`             | `payment_type_code` missing                                                  | X, O, S: no retries left (maximum three)                                        | invalid_request / payment_method_unavailable | do_not_retry / do_not_retry                    |
| `BP-R-7`             | Payment type not active                                                      | (none)                                                                          | configuration                                | do_not_retry                                   |
| `BP-R-8`             | `payment_type_code` invalid                                                  | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-9`             | Amount not positive                                                          | (none)                                                                          | invalid_amount                               | do_not_retry                                   |
| `BP-R-10`            | Amount below the minimum                                                     | (none)                                                                          | invalid_amount                               | do_not_retry                                   |
| `BP-R-11`            | Payment type does not support instalments (for example Boleto)               | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-12`            | Instalment count above the limit                                             | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-13`            | Instalment value below the configured minimum                                | (none)                                                                          | invalid_amount                               | do_not_retry                                   |
| `BP-R-14`            | `merchant_payment_code` longer than 20 characters                            | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-15`            | `order_number` longer than 40 characters                                     | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-16`            | One of `user_value_1` (60) or `user_value_2` to `user_value_5` (20) too long | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-17`            | Payment is not `OP`                                                          | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-18`            | `person_type` invalid                                                        | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-19`            | Checkout by CNPJ not enabled                                                 | (none)                                                                          | configuration                                | do_not_retry                                   |
| `BP-R-20`            | `due_date` not `dd/MM/yyyy`                                                  | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-21`            | `due_date` too far away                                                      | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-22`            | `due_date` too soon                                                          | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-23`            | Currency not active                                                          | (none)                                                                          | configuration                                | do_not_retry                                   |
| `BP-R-24`            | `country` missing                                                            | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-25`, `BP-R-26` | Country not enabled / not enabled for the merchant                           | (none)                                                                          | configuration                                | do_not_retry                                   |
| `BP-R-27`            | Payment type not enabled for the merchant                                    | (none)                                                                          | configuration                                | do_not_retry                                   |
| `BP-R-28`            | Instalment count above the merchant maximum                                  | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-29`            | Instalment value invalid                                                     | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-30`            | Instalment count on the blocked list                                         | (none)                                                                          | invalid_request                              | do_not_retry                                   |
| `BP-R-31`            | `notification_url` invalid                                                   | (none)                                                                          | configuration                                | do_not_retry                                   |
| `BP-R-32`            | Amount above the maximum                                                     | (none)                                                                          | invalid_amount                               | do_not_retry                                   |
| `BP-R-34`            | Processing trial limit reached                                               | (none)                                                                          | configuration                                | manual_review                                  |

Instalment plans, single transaction, taxes, documents, OTP, FX, zip code and enrollment-related payment codes (O unless marked):

| Code                       | Meaning (paraphrase)                                                                  | Category              | Retry                    |
| -------------------------- | ------------------------------------------------------------------------------------- | --------------------- | ------------------------ |
| `BP-IP-001`, `BP-IP-002`   | Instalment plan token missing / invalid or not the merchant's                         | invalid_request       | do_not_retry             |
| `BP-IP-003`                | Instalment plan token expired                                                         | invalid_request       | do_not_retry             |
| `BP-IP-004` to `BP-IP-007` | Country, currency, amount or payment type differs from the instalment plan (4 codes)  | invalid_request       | do_not_retry             |
| `BP-IP-008`                | Chosen instalment count not in the plan                                               | invalid_request       | do_not_retry             |
| `BP-IP-009`                | Country or payment type group not valid for the plan                                  | invalid_request       | do_not_retry             |
| `IPBP-001` to `IPBP-004`   | `/ws/instalmentsPlan`: country, amount or currency missing; country invalid (4 codes) | invalid_request       | do_not_retry             |
| `IPBP-005`                 | Currency invalid or rate unavailable                                                  | configuration         | do_not_retry             |
| `IPBP-006`                 | Unexpected error                                                                      | unknown               | retry_conditionally      |
| `IPBP-007`                 | Amount must be greater than zero                                                      | invalid_amount        | do_not_retry             |
| `IPBP-008`                 | External service for instalment calculation unavailable                               | provider_unavailable  | retry_conditionally      |
| `IPBP-SA-1`, `IPBP-SA-2`   | Neither key sent / public key invalid                                                 | configuration         | do_not_retry             |
| `BP-ST-00`, `BP-ST-01`     | Single Transaction not enabled / only for the local tenant                            | configuration         | do_not_retry             |
| `BP-ST-02` to `BP-ST-04`   | `single_transaction`, `amount_local` or `amount_crossborder` missing (3 codes)        | invalid_request       | do_not_retry             |
| `BP-ST-05`, `BP-ST-06`     | Local plus cross-border amounts above / below the total                               | invalid_amount        | do_not_retry             |
| `BP-ST-13`                 | Single Transaction amounts negative                                                   | invalid_amount        | do_not_retry             |
| `BP-TX-01` to `BP-TX-03`   | `taxes` missing for local amount; `iva_co` missing; `iva_co` not a number (3 codes)   | invalid_request       | do_not_retry             |
| `BP-DOC-01`                | Document invalid (P, O)                                                               | invalid_request       | customer_action_required |
| `BP-DOC-02`                | Currency not supported for document balance (P, O)                                    | invalid_request       | do_not_retry             |
| `BP-DOC-03`, `BP-DOC-04`   | Country not supported / conversion to the currency unavailable                        | invalid_request       | do_not_retry             |
| `BP-EX-1`, `BP-EX-2`       | Currency missing / not active (P, O)                                                  | invalid_request       | do_not_retry             |
| `BP-ZIP-1` to `BP-ZIP-3`   | Zip code missing; not 8 digits; address not found (P, O; 3 codes)                     | invalid_request       | customer_action_required |
| `BP-OTP-000`               | OTP: fields missing (P)                                                               | invalid_request       | do_not_retry             |
| `BP-OTP-001`               | OTP: payment not found (P)                                                            | invalid_request       | do_not_retry             |
| `BP-OTP-002`               | OTP validation failed (P)                                                             | authentication_failed | customer_action_required |
| `BP-OTP-003`               | OTP: payment still pending (P)                                                        | unknown               | retry_conditionally      |
| `BP-OTP-004`               | OTP: charge could not be processed (P)                                                | unknown               | manual_review            |
| `BP-OTP-005`               | OTP: token invalid or expired (P)                                                     | authentication_failed | customer_action_required |
| `BP-OTP-006`               | OTP: resolver processor problem (P)                                                   | provider_unavailable  | retry_conditionally      |

Chargeback evidence upload (`/ws/chargeback/send-evidence`, C). HTTP status is part of the documented contract here:

| Code       | HTTP | Meaning (paraphrase)                                        | Category             | Retry               |
| ---------- | ---- | ----------------------------------------------------------- | -------------------- | ------------------- |
| `BP-CH-00` | 500  | Internal or unknown error                                   | provider_unavailable | retry_conditionally |
| `BP-CH-01` | 404  | Payment not found in this tenant                            | invalid_request      | do_not_retry        |
| `BP-CH-02` | 401  | Unauthorized (missing `request_body`, wrong `kid` or host)  | configuration        | do_not_retry        |
| `BP-CH-03` | 422  | Chargeback not ready for evidence                           | invalid_request      | manual_review       |
| `BP-CH-04` | 400  | Parameters missing or invalid (often the file field)        | invalid_request      | do_not_retry        |
| `BP-CH-05` | 400  | File invalid, corrupt, wrong format or above 15 MB          | invalid_request      | do_not_retry        |
| `BP-CH-06` | 422  | Evidence already submitted; submission is final             | duplicate_request    | do_not_retry        |
| `BP-CH-07` | 422  | Dispute already finished                                    | invalid_request      | do_not_retry        |
| `BP-CH-08` | 401  | SHA-256 in `request_body` does not match the uploaded file  | invalid_request      | do_not_retry        |
| `BP-CH-09` | 422  | Chargeback not disputable (possibly acquirer configuration) | configuration        | manual_review       |

EBANX advises, after a timeout on this endpoint, to check `chargeback.dispute_status` with `/ws/query` before retrying, because a repeat returns `BP-CH-06`.

#### 4.5 `payment.transaction_status.code`: 6 values

Source: OpenAPI `transaction-status-code`; the card and APM pages show only `OK` and `NOK`. EBANX's card page warns not to use these codes to confirm a payment; `payment.status` is authoritative.

| Value                    | Meaning (paraphrase)                            | Category                | Retry                    |
| ------------------------ | ----------------------------------------------- | ----------------------- | ------------------------ |
| `OK`                     | Accepted                                        | n/a (success)           | n/a                      |
| `NOK`                    | Not accepted                                    | see `description_code`  | see `description_code`   |
| `NO_RETRY`               | Not accepted; do not retry (EBANX advice)       | card_declined           | do_not_retry             |
| `RETRY`                  | Can be retried (EBANX advice)                   | unknown                 | retry_conditionally      |
| `PENDING_AUTHENTICATION` | Waiting for customer authentication such as 3DS | authentication_required | customer_action_required |
| `PENDING_CARD_PIN`       | Waiting for card PIN entry                      | authentication_required | customer_action_required |

Card verification (`/ws/verifycard`, `/ws/token` with verification) uses its own `transaction_status.code` set per OpenAPI `card-verification`: `OK`, `NOK`, `NA`, `3DS_PENDING`, `OTP_PENDING` (meanings beyond the names are **NOT DOCUMENTED**), with `transaction_type` `ZERO DOLLAR` or `GHOST AUTHORIZATION`.

#### 4.6 Card `transaction_status.description_code`: 81 values

Source: OpenAPI `card-description-code` (the guide pages do not list these machine codes). "Retry at any time" and "do not retry" advice comes from EBANX.

| Value                             | Meaning (paraphrase)                                                                              | Category                   | Retry                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `ACCEPTED`                        | Accepted                                                                                          | n/a (success)              | n/a                             |
| `3DSECURE_REQUIRED`               | Card requires 3DS                                                                                 | authentication_required    | customer_action_required        |
| `ALREADY_FULLY_REFUNDED`          | Transaction already fully refunded                                                                | duplicate_request          | do_not_retry                    |
| `AWAITING_DONT_RETRY`             | Still being processed; EBANX says do not retry                                                    | unknown                    | do_not_retry                    |
| `BLOCKED_BY_BRAND_MANDATE`        | Blocked by a card brand mandate after all acquirer routes; wait until `brand_mandate.retry_after` | card_declined              | retry_conditionally             |
| `BROKEN_COMMUNICATION`            | Connection broke; EBANX says retry at any time                                                    | network_or_timeout         | safe_to_retry_technical_request |
| `CANNOT_CANCEL_TRANSACTION`       | Could not be cancelled; do not retry                                                              | unknown                    | do_not_retry                    |
| `CANNOT_TRANSACTION`              | Acquirer cannot process now; retry at any time                                                    | provider_unavailable       | safe_to_retry_technical_request |
| `CARD_NOT_ENABLED_FOR_ECOMMERCE`  | Card not enabled for online use                                                                   | card_declined              | customer_action_required        |
| `CARD_NUMBER`                     | Card number invalid                                                                               | invalid_request            | customer_action_required        |
| `CLOSED_ACCOUNT`                  | Card account closed                                                                               | card_declined              | do_not_retry                    |
| `COMMUNICATION_MISMATCH`          | Bad communication with the acquirer; retry at any time                                            | network_or_timeout         | safe_to_retry_technical_request |
| `DECLINED_DUE_INVALID_PARAMETERS` | Declined because of invalid parameters                                                            | invalid_request            | do_not_retry                    |
| `DECLINED_DUE_SCHEME_RULES`       | Declined by card scheme rules                                                                     | card_declined              | do_not_retry                    |
| `DECLINED_DUE_TIMEOUT`            | Declined after a timeout                                                                          | network_or_timeout         | retry_conditionally             |
| `DEFAULT_ERROR`                   | Generic processing error                                                                          | unknown                    | manual_review                   |
| `DUPLICATED_REFUND_REQUEST`       | A refund request already exists                                                                   | duplicate_request          | do_not_retry                    |
| `EXCEEDS_WITHDRAWAL_LIMIT`        | Card withdrawal limit exceeded                                                                    | card_declined              | customer_action_required        |
| `EXPIRED_CARD`                    | Card expired                                                                                      | card_declined              | customer_action_required        |
| `FAILED_TO_PROCESS`               | Failed to process                                                                                 | unknown                    | manual_review                   |
| `HIGH_RISK_TRANSACTION`           | Declined as likely fraud                                                                          | fraud_or_risk              | do_not_retry                    |
| `INACTIVE_CARD`                   | Card not active; EBANX says retry at any time                                                     | card_declined              | customer_action_required        |
| `INCORRECT_CUSTOMER_DATA`         | Customer data incorrect                                                                           | invalid_request            | customer_action_required        |
| `INSTALLMENTS_NOT_AVAILABLE`      | Instalments not available for this transaction                                                    | payment_method_unavailable | customer_action_required        |
| `INSTALLMENTS_UNSUPPORTED`        | Issuer does not support this instalment count                                                     | payment_method_unavailable | customer_action_required        |
| `INSUFFICIENT_FUNDS`              | Insufficient funds                                                                                | insufficient_funds         | customer_action_required        |
| `INVALID_CARD_OR_TYPE`            | Card invalid, nonexistent or blocked                                                              | card_declined              | customer_action_required        |
| `INVALID_DUE_DATE`                | Card expiry date invalid                                                                          | invalid_request            | customer_action_required        |
| `ISSUER_DECLINE`                  | Declined by the issuer                                                                            | card_declined              | customer_action_required        |
| `ISSUER_DECLINE_SUSPECT_FRAUD`    | Issuer declined for suspected fraud                                                               | fraud_or_risk              | do_not_retry                    |
| `NO_ACCEPTED`                     | Not approved; customer should contact the issuer                                                  | card_declined              | customer_action_required        |
| `NO_ACCEPTED_RETRYABLE`           | Not approved but may be retried                                                                   | card_declined              | retry_conditionally             |
| `NO_FULFILL`                      | Could not be fulfilled or already executed; do not retry                                          | duplicate_request          | do_not_retry                    |
| `NO_RESPONSE`                     | Acquirer did not answer; retry at any time                                                        | network_or_timeout         | safe_to_retry_technical_request |
| `PAYMENT_TOO_OLD_TO_REFUND`       | Payment too old to refund                                                                         | invalid_request            | do_not_retry                    |
| `PENDING_AUTHENTICATION`          | Waiting for authentication                                                                        | authentication_required    | customer_action_required        |
| `PENDING_CARD_PIN`                | Waiting for PIN                                                                                   | authentication_required    | customer_action_required        |
| `PICKUP_CARD`                     | Issuer flagged the card for pickup; do not retry                                                  | fraud_or_risk              | do_not_retry                    |
| `PIN_TRIES_EXCEEDED`              | Too many PIN attempts                                                                             | authentication_failed      | do_not_retry                    |
| `REFUND_AMOUNT_EXCEEDED`          | Refund above the original amount                                                                  | invalid_amount             | do_not_retry                    |
| `REFUNDED`                        | Card already refunded; do not retry                                                               | duplicate_request          | do_not_retry                    |
| `RESPONSE_ERROR`                  | Acquirer answer had an error; retry at any time                                                   | provider_unavailable       | safe_to_retry_technical_request |
| `SECURITY_CODE_MISMATCH`          | CVV wrong                                                                                         | card_declined              | customer_action_required        |
| `TIMEOUT`                         | Connection timed out; retry at any time                                                           | network_or_timeout         | safe_to_retry_technical_request |
| `TRANSACTION_NOT_FOUND`           | Referenced transaction not found                                                                  | invalid_request            | do_not_retry                    |
| `UNDER_REVIEW`                    | Transaction under review                                                                          | fraud_or_risk              | manual_review                   |
| `UNKNOWN_ERROR`                   | Unknown acquirer error; retry at any time                                                         | unknown                    | retry_conditionally             |

Refund decline description codes (same OpenAPI enumeration, 34 values, all prefixed `REFUND_DECLINED_DUE_`). The suffix names the reason: `ACCOUNT_WITH_ISSUE`, `AWAITING`, `BLOCKED_CARD`, `CANNOT_TRANSACTION_NOW`, `CARD_WITH_ISSUE`, `CHARGEBACK_IN_ACQUIRER`, `CHARGEBACK_IN_ANALYSIS`, `CLOSED_ACCOUNT`, `COMMUNICATION_ERROR`, `DUPLICATE_RECORDS`, `ERROR_UNKNOWN`, `EXCEEDED_ATTEMPTS`, `EXPIRED_CARD`, `FOR_FINANCE_MANUAL_HANDLING`, `FOR_FINANCE_REMITTANCE`, `INSUFFICIENT_FUNDS`, `INVALID_AMOUNT`, `INVALID_CARD`, `INVALID_CURRENCY`, `INVALID_FIELD`, `INVALID_SETTING_IN_ACQUIRER`, `INVALID_TRANSACTION`, `INVALID_TRANSACTION_RETRYABLE`, `LOCK_ON_ACQUIRER`, `MISSING_REQUIRED_FIELD`, `NON_REFUNDABLE_TRANSACTION_TYPE`, `OLDER_TOO_OLD`, `PICKUP_CARD`, `REFUND_ALREADY_EXISTS`, `RISK_RULES`, `SCHEME_RULES`, `TRANSACTION_NOT_FOUND`, `UNAVAILABLE_OR_ERROR`, `UNSUPPORTED_PAYMENT_TYPE`. EBANX gives no longer meaning than the suffix. Suggested mapping: `CANNOT_TRANSACTION_NOW`, `COMMUNICATION_ERROR`, `UNAVAILABLE_OR_ERROR`, `INVALID_TRANSACTION_RETRYABLE` and `AWAITING` to provider_unavailable / retry_conditionally; `FOR_FINANCE_MANUAL_HANDLING`, `FOR_FINANCE_REMITTANCE`, `CHARGEBACK_IN_ANALYSIS`, `CHARGEBACK_IN_ACQUIRER`, `LOCK_ON_ACQUIRER`, `ERROR_UNKNOWN` to unknown / manual_review; `DUPLICATE_RECORDS`, `REFUND_ALREADY_EXISTS` to duplicate_request / do_not_retry; `INVALID_AMOUNT`, `INVALID_CURRENCY` to invalid_amount / do_not_retry; `RISK_RULES` to fraud_or_risk / manual_review; all others to card_declined or invalid_request / do_not_retry (a card-side refund decline usually means a different refund route is needed).

#### 4.7 Card response descriptions (`transaction_status.description`): 23 strings

Source: D/pay-in/dev-tools/response-codes/card-error-codes. These are human strings, not codes, but they are the only card outcome a merchant sees when `description_code` is absent. Sandbox responses use other strings such as `Sandbox - Test credit card, transaction captured`.

| Description string                          | Paraphrase and EBANX advice                     | Category                   | Retry                           |
| ------------------------------------------- | ----------------------------------------------- | -------------------------- | ------------------------------- |
| `Accepted`                                  | Accepted                                        | n/a (success)              | n/a                             |
| `Not accepted`                              | Not approved; customer contacts the issuer      | card_declined              | customer_action_required        |
| `Insufficient funds`                        | No funds; use another card                      | insufficient_funds         | customer_action_required        |
| `Incorrect customer data`                   | Customer should review the data                 | invalid_request            | customer_action_required        |
| `Expired card`                              | Use another card                                | card_declined              | customer_action_required        |
| `Security code mismatch`                    | CVV wrong                                       | card_declined              | customer_action_required        |
| `Invalid card or card type`                 | Invalid, nonexistent or blocked card            | card_declined              | customer_action_required        |
| `Invalid card number`                       | Review the card number                          | invalid_request            | customer_action_required        |
| `3-D Secure required`                       | Card needs 3DS; page advises another card       | authentication_required    | customer_action_required        |
| `Timeout`                                   | Timed out; retry at any time                    | network_or_timeout         | safe_to_retry_technical_request |
| `No response from acquirer`                 | Retry at any time                               | network_or_timeout         | safe_to_retry_technical_request |
| `Acquirer response error`                   | Retry at any time                               | provider_unavailable       | safe_to_retry_technical_request |
| `Broken communication`                      | Retry at any time                               | network_or_timeout         | safe_to_retry_technical_request |
| `Communication mismatch`                    | Retry at any time                               | network_or_timeout         | safe_to_retry_technical_request |
| `Cannot fulfill transaction`                | Not fulfilled or already executed; do not retry | duplicate_request          | do_not_retry                    |
| `Cannot cancel transaction`                 | Could not cancel; do not retry                  | unknown                    | do_not_retry                    |
| `Invalid due date`                          | Card expiry invalid                             | invalid_request            | customer_action_required        |
| `Inactive card`                             | Card inactive; page says retry at any time      | card_declined              | customer_action_required        |
| `Refunded`                                  | Already refunded; do not retry                  | duplicate_request          | do_not_retry                    |
| `Unknown acquirer error`                    | Retry at any time                               | unknown                    | retry_conditionally             |
| `High risk transaction`                     | Likely fraud                                    | fraud_or_risk              | do_not_retry                    |
| `Issuer does not support installments`      | Instalment count not available on this card     | payment_method_unavailable | customer_action_required        |
| `Cannot process transaction at this moment` | Retry at any time                               | provider_unavailable       | safe_to_retry_technical_request |

"Retry at any time" is EBANX's wording. Because a timed-out card authorization may still have succeeded, PandaPayLens should still advise checking `/ws/query` before a new attempt with a new `merchant_payment_code`.

#### 4.8 APM `transaction_status.description_code`: 66 values

Sources: D/pay-in/dev-tools/response-codes/apm-error-codes (63 rows) and OpenAPI `apm-description-code` (adds `CUSTOMER_NOT_FOUND`, `DEFAULT_REASON`, `HIGH_RISK_TRANSACTION`, `INCORRECT_ITEMS_DATA`). Every non-`ACCEPTED` value comes with `code: "NOK"`. Several apply to recurring APMs (Pix Automatico, UPI Autopay, Nequi, Yape and others).

| Value                                  | Meaning (paraphrase)                                                       | Category                   | Retry                    |
| -------------------------------------- | -------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `ACCEPTED`                             | Paid                                                                       | n/a (success)              | n/a                      |
| `ATTEMPTS_EXCEEDED_MPIN_OR_OTP`        | Payer entered PIN or OTP wrongly too many times                            | authentication_failed      | customer_action_required |
| `BIN_MISMATCH`                         | BIN mismatch for UPI on a credit card                                      | invalid_request            | customer_action_required |
| `BROKEN_COMMUNICATION`                 | Communication broke                                                        | network_or_timeout         | retry_conditionally      |
| `CANCELED_BY_MERCHANT`                 | Merchant cancelled                                                         | n/a (cancellation)         | do_not_retry             |
| `CANCELED_BY_PAYER`                    | Payer cancelled                                                            | n/a (cancellation)         | customer_action_required |
| `CANNOT_TRANSACTION`                   | Cannot process now                                                         | provider_unavailable       | retry_conditionally      |
| `COMMUNICATION_MISMATCH`               | Communication mismatch                                                     | network_or_timeout         | retry_conditionally      |
| `CUSTOMER_NOT_FOUND`                   | Customer unknown at the provider                                           | invalid_request            | customer_action_required |
| `CUSTOMER_NUMBER_OR_ACCOUNT_CHANGE`    | Payer's account details changed                                            | payment_method_unavailable | customer_action_required |
| `DECLINED_BY_CC_ISSUING_BANK`          | Card issuer declined (card-funded APM)                                     | card_declined              | customer_action_required |
| `DECLINED_DUE_TIMEOUT`                 | Declined after a timeout                                                   | network_or_timeout         | retry_conditionally      |
| `DEFAULT_ERROR`                        | Unknown acquirer error                                                     | unknown                    | manual_review            |
| `DEFAULT_REASON`                       | Unknown decline reason                                                     | unknown                    | manual_review            |
| `DO_NOT_HONOUR`                        | Bank rejected after internal checks                                        | card_declined              | customer_action_required |
| `DUPLICATE_TRANSACTION`                | Duplicate mandate or transaction                                           | duplicate_request          | do_not_retry             |
| `ENROLLMENT_CANCELLED`                 | Enrollment no longer active                                                | payment_method_unavailable | customer_action_required |
| `ENROLLMENT_CONFIRMATION_FAILURE`      | Payer's bank failed to confirm the enrollment                              | payment_method_unavailable | customer_action_required |
| `ENROLLMENT_NOT_ACTIVE`                | Enrollment not active                                                      | payment_method_unavailable | customer_action_required |
| `ENROLLMENT_PAUSED`                    | Payer paused the enrollment                                                | payment_method_unavailable | customer_action_required |
| `EWALLET_INSTANT_RETRY_ERROR`          | Wallet attempt failed; try again                                           | provider_unavailable       | retry_conditionally      |
| `EXPIRED_AFTER_3RETRIES`               | Cancelled after three retries                                              | insufficient_funds         | do_not_retry             |
| `EXPIRED_AFTER_7DAYS`                  | Expired at the 7-day cap                                                   | unknown                    | do_not_retry             |
| `EXPIRED_BY_USER_INACTION`             | Payer did not act in time                                                  | unknown                    | customer_action_required |
| `FRAUD_RISK`                           | Suspected fraud                                                            | fraud_or_risk              | do_not_retry             |
| `HIGH_RISK_TRANSACTION`                | Payer bank declined on risk grounds                                        | fraud_or_risk              | do_not_retry             |
| `INCORRECT_CUSTOMER_DATA`              | Customer data incorrect                                                    | invalid_request            | customer_action_required |
| `INCORRECT_ITEMS_DATA`                 | HSN product code wrong or restricted (India)                               | invalid_request            | do_not_retry             |
| `INSUFFICIENT_FUNDS`                   | Insufficient funds                                                         | insufficient_funds         | customer_action_required |
| `INSUFFICIENT_FUNDS_OR_DAILY_LIMIT`    | No funds or the payer's limit reached (Pix Automatico cannot say which)    | insufficient_funds         | customer_action_required |
| `INTERNAL_SERVER_ERROR`                | Internal server error                                                      | provider_unavailable       | retry_conditionally      |
| `INVALID_AMOUNT`                       | Amount incorrect                                                           | invalid_amount             | do_not_retry             |
| `INVALID_CARD`                         | Card expired, blocked or not allowed for this purchase                     | card_declined              | customer_action_required |
| `INVALID_CARD_DATA`                    | Payer entered wrong card data                                              | invalid_request            | customer_action_required |
| `INVALID_DUE_DATE`                     | Due date invalid                                                           | invalid_request            | do_not_retry             |
| `INVALID_MPIN_OR_OTP`                  | Payer entered wrong PIN or OTP                                             | authentication_failed      | customer_action_required |
| `INVALID_PARAMETERS`                   | Invalid parameters                                                         | invalid_request            | do_not_retry             |
| `INVALID_VPA`                          | UPI address invalid or inactive                                            | invalid_request            | customer_action_required |
| `LIMIT_EXCEEDED`                       | Amount above the payer's own maximum                                       | invalid_amount             | customer_action_required |
| `MANDATE_EXPIRED`                      | Enrollment expired                                                         | payment_method_unavailable | customer_action_required |
| `MANDATE_NOT_FOUND`                    | Enrollment unknown at the network or issuer                                | payment_method_unavailable | customer_action_required |
| `MANDATE_PAUSED`                       | Payer paused the enrollment                                                | payment_method_unavailable | customer_action_required |
| `MANDATE_REVOKED`                      | Payer revoked the enrollment                                               | payment_method_unavailable | do_not_retry             |
| `MAX_AMOUNT_EXCEEDED`                  | Amount above the payer's maximum (X: scheduling rejected)                  | invalid_amount             | customer_action_required |
| `NO_ACCEPTED`                          | Not accepted                                                               | payment_method_unavailable | customer_action_required |
| `NO_ACCEPTED_RETRYABLE`                | Not accepted; should be retried                                            | unknown                    | retry_conditionally      |
| `NO_ACTION_BY_PAYER`                   | Payer did not complete authentication                                      | authentication_required    | customer_action_required |
| `NOT_ALLOW_RETRY`                      | Settlement failed and retry impossible (X: payer cancelled the enrollment) | payment_method_unavailable | do_not_retry             |
| `NOTIFICATION_DELIVERY_FAILED`         | Pre-debit notice sent but not delivered to the payer                       | unknown                    | retry_conditionally      |
| `NOTIFICATION_NOT_FOUND`               | Pre-debit notice not sent                                                  | invalid_request            | do_not_retry             |
| `PAYEE_BLOCKED_AT_REMITTER`            | Merchant blocked at the payer's bank                                       | configuration              | manual_review            |
| `PAYMENT_NOT_VALID`                    | Invalid payment scheduling                                                 | invalid_request            | do_not_retry             |
| `PROVIDER_RESPONSE_ERROR`              | Provider returned an error                                                 | provider_unavailable       | retry_conditionally      |
| `REJECTED_BY_USER`                     | Payer rejected the enrollment                                              | payment_method_unavailable | customer_action_required |
| `REMITTER_BANK_NOT_AVAILABLE`          | Payer's bank does not support the method                                   | payment_method_unavailable | customer_action_required |
| `SUSPECTED_FRAUD_REMITTER_BANK`        | Payer's bank declined on risk score                                        | fraud_or_risk              | do_not_retry             |
| `TECHNICAL_ERROR`                      | Technical or gateway failure                                               | provider_unavailable       | retry_conditionally      |
| `TIMEOUT`                              | External service unavailable; try again                                    | network_or_timeout         | retry_conditionally      |
| `TIMEOUT_ACQUIRING_BANK_UNAVAILABLE`   | Acquiring bank unavailable; try again                                      | provider_unavailable       | retry_conditionally      |
| `TIMEOUT_BENEFICIARY_BANK_UNAVAILABLE` | Beneficiary bank unavailable; try again                                    | provider_unavailable       | retry_conditionally      |
| `TIMEOUT_NPCI_UNAVAILABLE`             | NPCI (India) unavailable; try again                                        | provider_unavailable       | retry_conditionally      |
| `TIMEOUT_REMITTER_BANK_UNAVAILABLE`    | Payer's bank unavailable; try again                                        | provider_unavailable       | retry_conditionally      |
| `TRANSACTION_NOT_FOUND`                | Transaction not found                                                      | invalid_request            | do_not_retry             |
| `USER_ACCOUNT_CLOSED`                  | Payer account closed or blocked                                            | payment_method_unavailable | do_not_retry             |
| `USER_BANK_VALIDATION_ISSUE`           | Payer's bank data validation failed                                        | invalid_request            | customer_action_required |
| `WRONG_AMOUNT_UNDERPAID`               | Payer paid less than due                                                   | invalid_amount             | manual_review            |

#### 4.9 ISO 8583 (`transaction_status.iso_code`) and Mastercard MAC (`transaction_status.mac_code`)

Source: D/pay-in/dev-tools/response-codes/iso8583-codes. Both fields appear only on declined card transactions, only when the merchant's account manager has enabled them, and (per the page) only for Argentina, Brazil, Chile, Colombia, Dominican Republic, Mexico and Peru. EBANX warns that issuers interpret ISO codes differently (especially in Mexico) and recommends relying on its `description` field. A present `mac_code` overrides the ISO code for retry decisions. The page groups codes as hard declines (do not retry), soft declines (retry possible) and data-quality issues; several codes change group by brand. Retry classes below follow EBANX's grouping.

ISO 8583 codes: 64 distinct values.

| Code | Meaning (paraphrase)                           | EBANX group by brand                                               | Category                   | Retry                    |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `00` | Approved                                       | Approved                                                           | n/a (success)              | n/a                      |
| `03` | Invalid merchant                               | Soft (Visa, Mastercard)                                            | configuration              | retry_conditionally      |
| `04` | Pick up card                                   | Hard (Visa, Mastercard); soft (Elo)                                | fraud_or_risk              | do_not_retry             |
| `05` | Do not honor                                   | Soft (Visa, Mastercard)                                            | card_declined              | retry_conditionally      |
| `06` | Error                                          | Soft (all three)                                                   | unknown                    | retry_conditionally      |
| `07` | Pick up, special condition (fraud suspected)   | Hard (Visa, Mastercard)                                            | fraud_or_risk              | do_not_retry             |
| `12` | Invalid transaction                            | Hard                                                               | card_declined              | do_not_retry             |
| `13` | Invalid amount                                 | Hard (Elo); soft, retry with a corrected amount (Visa, Mastercard) | invalid_amount             | do_not_retry             |
| `14` | Invalid card number                            | Hard                                                               | card_declined              | customer_action_required |
| `15` | No such issuer                                 | Hard (Visa, Mastercard)                                            | card_declined              | do_not_retry             |
| `19` | Re-enter transaction                           | Hard (Elo); soft (Visa, Mastercard)                                | unknown                    | retry_conditionally      |
| `23` | Unacceptable fee                               | Hard (Elo)                                                         | card_declined              | do_not_retry             |
| `30` | Format error                                   | Hard (Elo)                                                         | invalid_request            | do_not_retry             |
| `38` | PIN tries exceeded                             | Soft (Elo)                                                         | authentication_failed      | customer_action_required |
| `39` | No credit account                              | Soft (Visa, Mastercard)                                            | card_declined              | customer_action_required |
| `41` | Lost card                                      | Hard                                                               | fraud_or_risk              | do_not_retry             |
| `43` | Stolen card                                    | Hard                                                               | fraud_or_risk              | do_not_retry             |
| `46` | Closed account                                 | Hard                                                               | card_declined              | do_not_retry             |
| `51` | Insufficient funds                             | Soft                                                               | insufficient_funds         | customer_action_required |
| `52` | No checking account                            | Soft (Visa, Mastercard)                                            | card_declined              | customer_action_required |
| `53` | No savings account                             | Soft (Visa, Mastercard)                                            | card_declined              | customer_action_required |
| `54` | Expired card                                   | Data quality                                                       | card_declined              | customer_action_required |
| `55` | Incorrect PIN                                  | Data quality                                                       | authentication_failed      | customer_action_required |
| `56` | No card record                                 | Hard (Elo)                                                         | card_declined              | do_not_retry             |
| `57` | Not permitted to cardholder                    | Hard                                                               | card_declined              | do_not_retry             |
| `58` | Not permitted to terminal                      | Hard (Elo); soft (Visa, Mastercard)                                | card_declined              | retry_conditionally      |
| `59` | Suspected fraud                                | Soft; review and retry if legitimate                               | fraud_or_risk              | manual_review            |
| `61` | Exceeds withdrawal amount limit                | Soft                                                               | card_declined              | customer_action_required |
| `62` | Restricted card                                | Soft                                                               | card_declined              | retry_conditionally      |
| `63` | Security violation                             | Data quality (Elo)                                                 | fraud_or_risk              | customer_action_required |
| `64` | Original amount incorrect                      | Hard (Elo); soft (Visa, Mastercard)                                | invalid_amount             | do_not_retry             |
| `65` | Exceeds withdrawal frequency                   | Soft                                                               | card_declined              | customer_action_required |
| `70` | PIN data required                              | Data quality (Visa, Mastercard)                                    | authentication_required    | customer_action_required |
| `74` | PIN error                                      | Soft (Visa, Mastercard)                                            | authentication_failed      | customer_action_required |
| `75` | PIN tries exceeded                             | Soft                                                               | authentication_failed      | customer_action_required |
| `76` | Invalid account                                | Hard (Elo); soft (Visa, Mastercard)                                | card_declined              | customer_action_required |
| `77` | Invalid account                                | Hard (Elo)                                                         | card_declined              | do_not_retry             |
| `78` | Card not activated                             | Soft                                                               | card_declined              | customer_action_required |
| `81` | Cryptographic error                            | Soft (Visa, Mastercard)                                            | provider_unavailable       | retry_conditionally      |
| `82` | CVV mismatch                                   | Data quality                                                       | card_declined              | customer_action_required |
| `83` | Security decline                               | Hard (Elo)                                                         | fraud_or_risk              | do_not_retry             |
| `86` | Cannot verify PIN                              | Soft (Visa, Mastercard)                                            | authentication_failed      | retry_conditionally      |
| `91` | Issuer or switch inoperative                   | Soft                                                               | provider_unavailable       | retry_conditionally      |
| `92` | Routing error                                  | Soft (Visa, Mastercard)                                            | provider_unavailable       | retry_conditionally      |
| `93` | Violation of law                               | Soft; review and retry if compliant                                | card_declined              | manual_review            |
| `94` | Duplicate transmission                         | Soft; verify status first                                          | duplicate_request          | retry_conditionally      |
| `96` | System malfunction                             | Soft (Visa, Mastercard)                                            | provider_unavailable       | retry_conditionally      |
| `1A` | Additional customer authentication required    | Data quality (Visa)                                                | authentication_required    | customer_action_required |
| `5C` | Card not on file                               | Soft (Visa)                                                        | card_declined              | customer_action_required |
| `6P` | PIN required                                   | Data quality (Visa)                                                | authentication_required    | customer_action_required |
| `9G` | Contact card issuer                            | Soft (Visa)                                                        | card_declined              | customer_action_required |
| `B1` | Surcharge not permitted                        | Generic (Visa)                                                     | invalid_amount             | do_not_retry             |
| `B2` | Surcharge not supported                        | Generic (Visa)                                                     | invalid_amount             | do_not_retry             |
| `FM` | Fraud monitoring block (Elo, Brazil)           | Hard                                                               | fraud_or_risk              | do_not_retry             |
| `N0` | Force STIP                                     | Soft (Visa)                                                        | unknown                    | retry_conditionally      |
| `N3` | Cash service not available                     | Soft (Visa)                                                        | payment_method_unavailable | retry_conditionally      |
| `N4` | Cash request above issuer limit                | Soft (Visa)                                                        | invalid_amount             | retry_conditionally      |
| `N7` | CVV mismatch                                   | Data quality (Visa)                                                | card_declined              | customer_action_required |
| `N8` | Cryptographic failure                          | Generic (Visa)                                                     | provider_unavailable       | retry_conditionally      |
| `R0` | Stop payment order                             | Hard (Visa)                                                        | card_declined              | do_not_retry             |
| `R1` | Authorization revoked                          | Hard (Visa)                                                        | card_declined              | do_not_retry             |
| `R2` | Issuer system unavailable                      | Generic (Visa)                                                     | provider_unavailable       | retry_conditionally      |
| `R3` | All authorizations revoked                     | Hard (Visa)                                                        | card_declined              | do_not_retry             |
| `Z5` | Fallback not allowed (use chip or contactless) | Generic (Visa)                                                     | payment_method_unavailable | do_not_retry             |

Mastercard MAC codes: 14 values.

| MAC  | Meaning (paraphrase)                 | EBANX group   | Retry                         |
| ---- | ------------------------------------ | ------------- | ----------------------------- |
| `01` | Updated card information needed      | Soft          | customer_action_required      |
| `02` | Try again later                      | Soft          | retry_conditionally           |
| `03` | Account closed or fraudulent         | Hard          | do_not_retry                  |
| `04` | Issuer cannot approve now            | Soft          | retry_conditionally           |
| `21` | Cardholder cancelled the agreement   | Hard          | do_not_retry                  |
| `24` | Retry after 1 hour                   | Timed retry   | retry_conditionally           |
| `25` | Retry after 24 hours                 | Timed retry   | retry_conditionally           |
| `26` | Retry after 2 days                   | Timed retry   | retry_conditionally           |
| `27` | Retry after 4 days                   | Timed retry   | retry_conditionally           |
| `28` | Retry after 6 days                   | Timed retry   | retry_conditionally           |
| `29` | Retry after 8 days                   | Timed retry   | retry_conditionally           |
| `30` | Retry after 10 days                  | Timed retry   | retry_conditionally           |
| `40` | Consumer non-reloadable prepaid card | Informational | n/a (may appear on approvals) |
| `41` | Consumer single-use virtual card     | Informational | n/a (may appear on approvals) |

Brand retry limits stated by EBANX: Visa 20 attempts in 30 rolling days; Mastercard 7 in 24 hours and 35 in 30 rolling days; Elo 15 per calendar month. After the limit, EBANX blocks further soft-decline retries until the window resets.

#### 4.10 3DS, ECI and related value sets: 7 ECI values plus 5 + 3 + 4 + 8 enumerations

ECI (D/pay-in/dev-tools/response-codes/eci-responses), returned in `threedsecure.threeds_result.eci`:

| ECI  | Scheme        | Meaning (paraphrase)                                     |
| ---- | ------------- | -------------------------------------------------------- |
| `00` | Mastercard    | Authentication failed; merchant liable                   |
| `01` | Mastercard    | Scheme authentication; issuer liable                     |
| `02` | Mastercard    | Issuer authentication; issuer liable                     |
| `04` | Mastercard    | Data-only; merchant liable                               |
| `05` | Other schemes | Issuer authentication; issuer liable                     |
| `06` | Other schemes | Scheme authentication; issuer liable                     |
| `07` | Other schemes | Visa data-only or failed authentication; merchant liable |

`threedsecure.status` and `threeds_attempts[].attempt_status` (OpenAPI `threeds-authentication-status`): `PENDING_AUTHENTICATION` (challenge not finished), `AUTHENTICATION_DONE` (cardholder verified), `UNABLE_TO_AUTHENTICATE` (issuer or directory unreachable or unsupported), `ERROR_CHECKING_AUTHENTICATION` (result check failed after the challenge), `TIMEOUT_AUTHENTICATION` (no issuer answer in time). Suggested categories: pending is authentication_required / customer_action_required; the three failures are authentication_failed / retry_conditionally.

`threeds_result.liability` (OpenAPI `threeds-liability`): `ISSUER_BANK`, `MERCHANT`, `NOT_IDENTIFIED`. `pares_status` examples show `Y` and `N` with a `pares_status_description`; the full value list is **NOT DOCUMENTED**.

`transaction_status.brand_mandate.blocking_category` (OpenAPI): `CANNOT_APPROVE_NOW` (code 2 in the example), `DATA_ERROR`, `GENERIC_ERROR`, `WILL_NEVER_APPROVE`, with numeric `blocking_category_code` 1 to 4 (the mapping of numbers to names beyond the example is **NOT DOCUMENTED**), plus `brand`, `blocking_window` and a `retry_after` timestamp.

Network token status (`/ws/token/query`, OpenAPI `network-token-status`): `ACTIVE`, `DELETED`, `FAILED_REQUEST`, `NOT_FOUND`, `NOT_PROVISIONED`, `SUSPENDED`, `UNKNOWN`, `WAIT_PROVISIONING`.

#### 4.11 Enrollment `reason_code`: 22 values

Source: D/pay-in/dev-tools/response-codes/enrollment-error-codes (the Pix Automatico page lists 11 of them). Returned by `/ws/userenrollments/query` when an enrollment is `not_accepted`, `expired`, `revoked` or `cancelled`, together with `status`, `status_date` and `description`.

| Value                               | Meaning (paraphrase)                                       | Category                   | Retry                    |
| ----------------------------------- | ---------------------------------------------------------- | -------------------------- | ------------------------ |
| `CANCELED_BY_EBANX`                 | EBANX cancelled the enrollment                             | fraud_or_risk              | manual_review            |
| `CANCELED_BY_MERCHANT`              | Merchant cancelled                                         | n/a (cancellation)         | do_not_retry             |
| `CANCELED_BY_PAYER`                 | Payer cancelled                                            | n/a (cancellation)         | customer_action_required |
| `ENROLLMENT_ALREADY_ACCEPTED`       | Already confirmed                                          | duplicate_request          | do_not_retry             |
| `ENROLLMENT_CONFIRMATION_FAILURE`   | Payer's bank failed to confirm                             | payment_method_unavailable | customer_action_required |
| `ENROLLMENT_DUPLICATED`             | Confirmed through another journey                          | duplicate_request          | do_not_retry             |
| `ENROLLMENT_NOT_ACTIVE`             | Not active                                                 | payment_method_unavailable | customer_action_required |
| `FRAUD_PREVENTION`                  | Payer's bank cancelled for fraud prevention                | fraud_or_risk              | do_not_retry             |
| `INCORRECT_OTP`                     | One-time password wrong                                    | authentication_failed      | customer_action_required |
| `INSTANT_PAYMENT_NOT_FOUND`         | The bank did not confirm the enrollment's instant payment  | payment_method_unavailable | customer_action_required |
| `INSUFFICIENT_FUNDS_OR_DAILY_LIMIT` | No funds or limit reached                                  | insufficient_funds         | customer_action_required |
| `INVALID_CARD`                      | Card linked to the wallet invalid                          | card_declined              | customer_action_required |
| `MERCHANT_COMPANY_CLOSED`           | Merchant company closed                                    | configuration              | do_not_retry             |
| `PAYER_DEATH`                       | Payer deceased                                             | payment_method_unavailable | do_not_retry             |
| `PROVIDER_RESPONSE_ERROR`           | Provider error                                             | provider_unavailable       | retry_conditionally      |
| `REJECTED_BY_USER`                  | Payer rejected                                             | payment_method_unavailable | customer_action_required |
| `TECHNICAL_ERROR`                   | Technical issue; contact support                           | provider_unavailable       | manual_review            |
| `TIMEOUT`                           | External service unavailable; try again                    | network_or_timeout         | retry_conditionally      |
| `USER_ACCOUNT_CLOSED`               | Payer account closed or blocked                            | payment_method_unavailable | do_not_retry             |
| `USER_BANK_VALIDATION_ISSUE`        | Payer's bank data validation failed                        | invalid_request            | customer_action_required |
| `AUTHORIZATION_FAILED_RETRYABLE`    | External authorization failed; retry or use another method | authentication_failed      | retry_conditionally      |
| `DEFAULT_ERROR`                     | Unknown error                                              | unknown                    | manual_review            |

Enrollment `status` values seen: `accepted`, `ACCEPTED` (case varies between examples), `revoked`, `expired`, `not_accepted`, `cancelled`. A complete enumeration is **NOT DOCUMENTED**.

#### 4.12 Chargebacks: 69 reason codes, dispute statuses and Pix MED claim reasons

Source: D/pay-in/management/post-payment/chargeback-dispute. The code arrives in `payment.chargeback.reason_code` from `/ws/query` (example value `0200/15`; the OpenAPI example shows a bare `4837`). The format is `<scheme or EBANX reason>/<sub-code>`. EBANX's own columns are "Category" (one of `UNRECOGNIZED`, `FRAUDULENT`, `GENERAL`, `PRODUCT_UNACCEPTABLE`, `PRODUCT_NOT_RECEIVED`, `CREDIT_NOT_PROCESSED`, `OVERCHARGED`, `PROCESSING_ERROR`, `PAID_BY_OTHER_MEANS`), "Group" and "Disputable"; they are reproduced as values, not as a suggestion. Chargebacks are not retryable events: the suggested PandaPayLens classification for every row is fraud_or_risk (fraud group) or unknown (others) with retry class manual_review.

| Code       | Meaning (paraphrase)                                                 | EBANX category         | Group                   | Disputable |
| ---------- | -------------------------------------------------------------------- | ---------------------- | ----------------------- | ---------- |
| `4863/75`  | Cardholder does not recognize the transaction                        | `UNRECOGNIZED`         | Fraud                   | Yes        |
| `4837/83`  | Card-not-present fraud; no cardholder authorization                  | `FRAUDULENT`           | Fraud                   | Yes        |
| `4850/57`  | Instalment dispute or several fraudulent transactions                | `GENERAL`              | Fraud                   | Yes        |
| `4853/53`  | Goods not as described, defective or counterfeit                     | `PRODUCT_UNACCEPTABLE` | Commercial Disagreement | Yes        |
| `4855/30`  | Service not provided or goods not received                           | `PRODUCT_NOT_RECEIVED` | Commercial Disagreement | Yes        |
| `4841/41`  | Cancelled or unauthorized recurring transaction                      | `CREDIT_NOT_PROCESSED` | Commercial Disagreement | Yes        |
| `4860/85`  | Credit (refund) not processed                                        | `CREDIT_NOT_PROCESSED` | Commercial Disagreement | Yes        |
| `4846/76`  | Wrong currency or transaction code                                   | `OVERCHARGED`          | Processing Error        | No         |
| `4808/77`  | Account number mismatch; authorization-related                       | `PROCESSING_ERROR`     | Processing Error        | No         |
| `4842/74`  | Late presentment                                                     | `PROCESSING_ERROR`     | Processing Error        | No         |
| `0000/73`  | Expired card                                                         | `GENERAL`              | Processing Error        | No         |
| `4834/82`  | Duplicate processing                                                 | `OVERCHARGED`          | Processing Error        | No         |
| `4831/86`  | Paid by other means, or amount/account differs                       | `PAID_BY_OTHER_MEANS`  | Processing Error        | No         |
| `4849/93`  | Questionable merchant activity / risk identification                 | `GENERAL`              | Other                   | No         |
| `0000/79`  | Retrieval request not received or illegible (Mexico only)            | `GENERAL`              | CATB (MX only)          | No         |
| `0000/78`  | Transaction split to avoid a limit (Mexico only)                     | `GENERAL`              | CATB (MX only)          | No         |
| `0000/00`  | No reason code available                                             | `GENERAL`              | Other                   | No         |
| `2000/01`  | No reason code available                                             | `GENERAL`              | Other                   | No         |
| `2000/02`  | No reason code available                                             | `GENERAL`              | Other                   | No         |
| `4837/104` | Card-not-present fraud; no cardholder authorization                  | `GENERAL`              | Fraud                   | Yes        |
| `4853/135` | Goods not as described, defective or counterfeit                     | `GENERAL`              | Commercial Disagreement | Yes        |
| `4853/134` | Goods not as described, defective or counterfeit                     | `GENERAL`              | Commercial Disagreement | Yes        |
| `4853/133` | Goods not as described, defective or counterfeit                     | `GENERAL`              | Commercial Disagreement | Yes        |
| `4855/131` | Service not provided or goods not received                           | `GENERAL`              | Commercial Disagreement | Yes        |
| `4855/137` | Service not provided or goods not received                           | `GENERAL`              | Commercial Disagreement | Yes        |
| `4841/136` | Cancelled or unauthorized recurring transaction                      | `GENERAL`              | Commercial Disagreement | Yes        |
| `4841/132` | Cancelled or unauthorized recurring transaction                      | `GENERAL`              | Commercial Disagreement | Yes        |
| `4860/138` | Credit not processed                                                 | `GENERAL`              | Processing Error        | No         |
| `4846/123` | Wrong currency or transaction code                                   | `GENERAL`              | Processing Error        | No         |
| `4846/122` | Wrong currency or transaction code                                   | `OVERCHARGED`          | Processing Error        | No         |
| `4808/127` | Account number mismatch; authorization-related                       | `GENERAL`              | Processing Error        | No         |
| `4842/121` | Late presentment                                                     | `PROCESSING_ERROR`     | Processing Error        | No         |
| `0000/113` | Expired card                                                         | `GENERAL`              | Processing Error        | No         |
| `4834/126` | Duplicate processing                                                 | `GENERAL`              | Processing Error        | No         |
| `4831/124` | Paid by other means, or amount/account differs                       | `GENERAL`              | Processing Error        | No         |
| `4831/125` | Paid by other means, or amount/account differs                       | `PAID_BY_OTHER_MEANS`  | Processing Error        | No         |
| `4849/105` | Questionable merchant activity / risk identification                 | `GENERAL`              | Other                   | No         |
| `0000/102` | Liability shift, non-counterfeit fraud                               | `GENERAL`              | Card Present Only       | No         |
| `0000/112` | Declined authorization                                               | `GENERAL`              | Card Present Only       | No         |
| `0000/127` | Invalid data                                                         | `PROCESSING_ERROR`     | Processing Error        | No         |
| `0000/138` | Original credit transaction not accepted (Europe only)               | `CREDIT_NOT_PROCESSED` | Commercial Disagreement | Yes        |
| `0000/139` | ATM withdrawal                                                       | `PRODUCT_NOT_RECEIVED` | Card Present Only       | No         |
| `0000/72`  | Signature belongs to another person                                  | `GENERAL`              | Card Present Only       | No         |
| `4515/80`  | Paid by other means, or amount/account differs                       | `GENERAL`              | Processing Error        | No         |
| `4527/103` | Card-present environment or condition                                | `GENERAL`              | Card Present Only       | No         |
| `4750/00`  | Car rental charge not qualified or not substantiated                 | `GENERAL`              | Commercial Disagreement | Yes        |
| `4801/00`  | Cardholder dispute                                                   | `GENERAL`              | Cardholder Dispute      | No         |
| `4807/111` | Cancelled card report                                                | `GENERAL`              | Authorization           | No         |
| `4808/113` | Declined authorization                                               | `GENERAL`              | Authorization           | No         |
| `4808/57`  | Instalment dispute or several fraudulent transactions                | `GENERAL`              | Fraud                   | Yes        |
| `4835/73`  | Expired card or account                                              | `GENERAL`              | Authorization           | No         |
| `4840/00`  | Fraudulent processing of transactions                                | `GENERAL`              | Card Present Only       | No         |
| `4850/00`  | Wrong number of instalments billed                                   | `GENERAL`              | Processing Error        | No         |
| `4859/00`  | ATM dispute                                                          | `GENERAL`              | Card Present Only       | No         |
| `4870/101` | Liability shift, counterfeit chip fraud                              | `GENERAL`              | Card Present Only       | No         |
| `4901/000` | Document for second presentment not received                         | `GENERAL`              | Other                   | No         |
| `4902/000` | Document received was illegible                                      | `GENERAL`              | Other                   | No         |
| `4903/000` | Scanning error: unrelated documents or partial scan                  | `GENERAL`              | Other                   | No         |
| `5002/000` | Required document not received (domestic)                            | `GENERAL`              | Other                   | No         |
| `5003/000` | Required document not received or not recognized (domestic)          | `GENERAL`              | Other                   | No         |
| `0100/10`  | EBANX found earlier chargebacks for this customer                    | `GENERAL`              | Fraud                   | Yes        |
| `0100/11`  | EBANX found a suspicious email pattern                               | `GENERAL`              | Fraud                   | Yes        |
| `0100/12`  | EBANX found suspicious purchase attempts                             | `GENERAL`              | Fraud                   | Yes        |
| `0100/13`  | EBANX found suspicious purchase history                              | `GENERAL`              | Fraud                   | Yes        |
| `0200/14`  | Earlier purchase found using an alternative payment method           | `GENERAL`              | Commercial Disagreement | Yes        |
| `0200/15`  | Earlier undisputed purchase found with any card at the same merchant | `GENERAL`              | Commercial Disagreement | Yes        |
| `0200/16`  | Earlier undisputed purchase found with the same card at any merchant | `GENERAL`              | Commercial Disagreement | Yes        |
| `0300/17`  | Sent to manual fraud-prevention review                               | `GENERAL`              | Review                  | No         |
| `0900/10`  | E-wallet commercial disagreement                                     | `GENERAL`              | Commercial Disagreement | Yes        |

The `0100`, `0200` and `0300` families describe EBANX fraud-prevention findings rather than scheme reason codes (inferred from the wording only; EBANX does not say so explicitly).

Dispute status vocabularies (three channels, different spellings):

| `chargeback.dispute_status` (`/ws/query`, OpenAPI enum) | Merchant Area filter | SFTP `cbk_dispute_YYMMDD.csv`                                   | Meaning (paraphrase)                                     |
| ------------------------------------------------------- | -------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| `Processing`                                            | Processing           | (none)                                                          | EBANX handles it internally (for example friendly fraud) |
| `Evidence Required`                                     | Evidence required    | `NeedsResponse`                                                 | Merchant must upload evidence before the deadline        |
| `Under Analysis`                                        | Under analysis       | (none; `Disputed` is said to be equivalent but produces no row) | Issuer reviewing evidence, up to 120 days                |
| `Dispute Won`                                           | Dispute won          | `Won`                                                           | Amount credited back to settlement                       |
| `Dispute Lost`                                          | Dispute lost         | `Lost`                                                          | Chargeback stands                                        |
| `Not disputed`                                          | Not disputed         | `Not_disputed`                                                  | No evidence by the deadline, or accepted                 |

Merchants have 5 business days to respond. A reversed chargeback is credited as a "Chargeback Credit" and triggers `notification_type=chargeback_credit` (section 6).

Pix MED claims (`payment.claims` in `/ws/query`, D/pay-in/management/post-payment/med-pix-overview): `status` is always `Returned`; `claims_type` is `med`; `reason` is one of `fraud`, `operation_flaw`, `refund_cancelled`, `money_laundering`, `authorization_issue`, `lrs_limit_exceeded` (6 values); the settlement report describes MED cases as `FRAUDULENT_ACCESS`, `SCAM`, `ACCOUNT_TAKEOVER` or `COERCION`. Only completed claims that debit the settlement are reported. Suggested category fraud_or_risk / manual_review.

#### 4.13 Payout codes: 154 API codes, 16 canceled-payout codes, 2 balance codes, 1 verify-account code

Payout API errors (D/payout/create-payout/errors/payout-error-codes; 155 rows, 154 distinct because `HP-CM-27` is listed twice, once for a Mexican CLABE of 18 digits and once for an Argentine CBU of 22 digits). Returned as `status_code` and `code` with `type` and `message`. Country column only when the page names one. Default for "Empty ..." and "Invalid ..." field rows: invalid_request / do_not_retry.

| Code                                                       | Meaning (paraphrase)                                                                                    | Country           | Category                   | Retry                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------- | ------------------------ |
| `HP-AR-01`                                                 | `custom_exchange_rate` not allowed                                                                      | Argentina         | invalid_request            | do_not_retry             |
| `HP-BI-01`                                                 | Encrypted request field could not be decrypted                                                          |                   | invalid_request            | do_not_retry             |
| `HP-BR-01`                                                 | Merchant not allowed to pay out via Pix                                                                 | Brazil            | configuration              | do_not_retry             |
| `HP-BR-02`, `HP-BR-03`                                     | Pix key empty / invalid                                                                                 | Brazil            | invalid_request            | customer_action_required |
| `HP-BR-05`, `HP-BR-06`                                     | Mercado Pago account empty / not an email                                                               |                   | invalid_request            | customer_action_required |
| `HP-BR-07`                                                 | No Pix key normalizer for the target account type                                                       | Brazil            | invalid_request            | do_not_retry             |
| `HP-BR-08`                                                 | `bank_ispb` invalid                                                                                     | Brazil            | invalid_request            | customer_action_required |
| `HP-CF-01`                                                 | Payee tax id blocked                                                                                    |                   | fraud_or_risk              | do_not_retry             |
| `HP-CM-01`, `HP-CM-02`                                     | `external_reference` empty / not 6 to 40 characters                                                     |                   | invalid_request            | do_not_retry             |
| `HP-CM-03`                                                 | A payout with this `external_reference` already exists                                                  |                   | duplicate_request          | do_not_retry             |
| `HP-CM-04`, `HP-CM-05`                                     | Country empty / not found                                                                               |                   | invalid_request            | do_not_retry             |
| `HP-CM-06`, `HP-CM-07`                                     | Country not enabled / not enabled for the account                                                       |                   | configuration              | do_not_retry             |
| `HP-CM-08`                                                 | Currency code empty                                                                                     |                   | invalid_request            | do_not_retry             |
| `HP-CM-09`, `HP-CM-10`, `HP-CM-11`                         | Amount empty / invalid / not above zero                                                                 |                   | invalid_amount             | do_not_retry             |
| `HP-CM-12`                                                 | `use_payee_hub` invalid                                                                                 |                   | invalid_request            | do_not_retry             |
| `HP-CM-13`, `HP-CM-14`                                     | Bank name empty / invalid                                                                               |                   | invalid_request            | customer_action_required |
| `HP-CM-15`, `HP-CM-16`                                     | Account type empty / invalid                                                                            |                   | invalid_request            | customer_action_required |
| `HP-CM-18`, `HP-CM-19`, `HP-CM-20`                         | Bank account / branch / details empty                                                                   |                   | invalid_request            | customer_action_required |
| `HP-CM-21`                                                 | Bank detail operation code invalid                                                                      |                   | invalid_request            | customer_action_required |
| `HP-CM-23`                                                 | Bank account invalid                                                                                    |                   | invalid_request            | customer_action_required |
| `HP-CM-24`                                                 | Payouts to savings accounts not available at this bank                                                  |                   | payment_method_unavailable | customer_action_required |
| `HP-CM-25`                                                 | CCI must be 20 digits                                                                                   | Peru              | invalid_request            | customer_action_required |
| `HP-CM-26`                                                 | Bank account must be 11 digits                                                                          | Mexico            | invalid_request            | customer_action_required |
| `HP-CM-27`                                                 | CLABE must be 18 digits (Mexico) / CBU must be 22 digits (Argentina)                                    | Mexico, Argentina | invalid_request            | customer_action_required |
| `HP-CM-28`                                                 | Payee not authorized for compliance reasons                                                             |                   | fraud_or_risk              | do_not_retry             |
| `HP-CM-29`                                                 | Payee invalid or not found                                                                              |                   | invalid_request            | do_not_retry             |
| `HP-CM-30`                                                 | Payout larger than the merchant's balance                                                               |                   | insufficient_funds         | manual_review            |
| `HP-CM-31`                                                 | Monthly limit for this payee document exceeded                                                          |                   | invalid_amount             | do_not_retry             |
| `HP-CM-32`                                                 | Balance could not be changed                                                                            |                   | unknown                    | manual_review            |
| `HP-CM-33`                                                 | Merchant not enabled                                                                                    |                   | configuration              | do_not_retry             |
| `HP-CM-34`, `HP-CM-35`                                     | Payee name empty / not 3 to 100 characters                                                              |                   | invalid_request            | customer_action_required |
| `HP-CM-36`, `HP-CM-37`, `HP-CM-38`                         | Payee email empty / invalid / not 5 to 100 characters                                                   |                   | invalid_request            | customer_action_required |
| `HP-CM-39`                                                 | Payee under age                                                                                         |                   | invalid_request            | do_not_retry             |
| `HP-CM-40`                                                 | Payee document invalid; document cannot be changed                                                      |                   | invalid_request            | do_not_retry             |
| `HP-CM-41`                                                 | Document type invalid                                                                                   |                   | invalid_request            | customer_action_required |
| `HP-CM-43`                                                 | Bank document invalid                                                                                   |                   | invalid_request            | customer_action_required |
| `HP-CM-44`                                                 | Neither `uid` nor `external_reference` sent                                                             |                   | invalid_request            | do_not_retry             |
| `HP-CM-45`, `HP-CM-46`                                     | Payout not found / not found for this account                                                           |                   | invalid_request            | do_not_retry             |
| `HP-CM-47` to `HP-CM-51`                                   | Search date range empty, `date_from` or `date_to` invalid, range reversed, range over 31 days (5 codes) |                   | invalid_request            | do_not_retry             |
| `HP-CM-52`, `HP-CM-53`, `HP-CM-54`                         | Search `page` / `status` / `per_page` invalid                                                           |                   | invalid_request            | do_not_retry             |
| `HP-CM-55`                                                 | Payout not `OP`, so it cannot be cancelled                                                              |                   | invalid_request            | do_not_retry             |
| `HP-CM-56`                                                 | Cancellation window after the request has passed                                                        |                   | invalid_request            | do_not_retry             |
| `HP-CM-57`                                                 | Payee id / customer id empty                                                                            |                   | invalid_request            | do_not_retry             |
| `HP-CM-58`                                                 | Payee not found                                                                                         |                   | invalid_request            | do_not_retry             |
| `HP-CM-59`                                                 | No transfer identifier sent                                                                             |                   | invalid_request            | do_not_retry             |
| `HP-CM-60`, `HP-CM-61`                                     | Transfer not found / not found for this account                                                         |                   | invalid_request            | do_not_retry             |
| `HP-CM-62`, `HP-CM-63`                                     | Transfer not `OP` / cancellation window passed                                                          |                   | invalid_request            | do_not_retry             |
| `HP-CM-64`                                                 | Transfer source invalid                                                                                 |                   | invalid_request            | do_not_retry             |
| `HP-CM-68`                                                 | Payment method invalid or not found                                                                     |                   | invalid_request            | do_not_retry             |
| `HP-CM-69`                                                 | Payee document blocked                                                                                  | Brazil            | fraud_or_risk              | do_not_retry             |
| `HP-CM-70`, `HP-CM-73`, `HP-CM-74`, `HP-CM-75`, `HP-CM-76` | Source bank info: bank name, whole object, holder name, account, country empty (5 codes)                |                   | invalid_request            | do_not_retry             |
| `HP-CM-78`, `HP-CM-81`                                     | `payee_uuid` invalid / empty                                                                            |                   | invalid_request            | do_not_retry             |
| `HP-CM-79`                                                 | `external_reference` invalid                                                                            |                   | invalid_request            | do_not_retry             |
| `HP-CM-82`, `HP-CM-83`                                     | Transaction type required for this country / invalid                                                    |                   | invalid_request            | do_not_retry             |
| `HP-CM-84`                                                 | `payee.birthdate` invalid                                                                               |                   | invalid_request            | customer_action_required |
| `HP-CM-85`                                                 | Bank details longer than 30 characters                                                                  |                   | invalid_request            | customer_action_required |
| `HP-CM-86`                                                 | Bank details must be a phone number                                                                     | Colombia          | invalid_request            | customer_action_required |
| `HP-CM-87`                                                 | Blocked by ARCA (tax authority) verification                                                            | Argentina         | fraud_or_risk              | manual_review            |
| `HP-CM-88`                                                 | Bre-B minimum is 1,000 COP                                                                              | Colombia          | invalid_amount             | do_not_retry             |
| `HP-CM-89`                                                 | Minimum is 1.00 PEN                                                                                     | Peru              | invalid_amount             | do_not_retry             |
| `HP-CM-90`, `HP-CM-91`                                     | `bank_branch` / `bank_account` invalid                                                                  |                   | invalid_request            | customer_action_required |
| `HP-CR-01`                                                 | Exchange rate unavailable                                                                               |                   | provider_unavailable       | retry_conditionally      |
| `HP-DF-01`, `HP-DF-02`                                     | Request empty / expression invalid                                                                      |                   | invalid_request            | do_not_retry             |
| `HP-DF-03`, `HP-DF-04`, `HP-DF-08`                         | `integration_key` empty / invalid / invalid                                                             |                   | configuration              | do_not_retry             |
| `HP-DF-05`                                                 | Account not enabled                                                                                     |                   | configuration              | do_not_retry             |
| `HP-DF-06`                                                 | Request type invalid                                                                                    |                   | invalid_request            | do_not_retry             |
| `HP-DF-07`                                                 | JSON syntax error                                                                                       |                   | invalid_request            | do_not_retry             |
| `HP-FR-01`                                                 | Declined; account blocked                                                                               | Brazil            | fraud_or_risk              | do_not_retry             |
| `HP-GN-04`                                                 | Caller is not a merchant                                                                                |                   | configuration              | do_not_retry             |
| `HP-GN-05`, `HP-GN-06`                                     | Payer account not found / not active                                                                    |                   | configuration              | do_not_retry             |
| `HP-GN-07`                                                 | Origin IP not allowed                                                                                   |                   | configuration              | do_not_retry             |
| `HP-LL-01`, `HP-LL-02`                                     | Country/currency or currency invalid for a local payout                                                 |                   | invalid_request            | do_not_retry             |
| `HP-TC-01`, `HP-TC-02`                                     | Target not enabled for this country / not found                                                         |                   | configuration              | do_not_retry             |
| `HP-TC-03`                                                 | Send either `payee.bank_info` or `target_account`, not both                                             |                   | invalid_request            | do_not_retry             |
| `HP-TC-04`                                                 | `target_account` required for this target                                                               |                   | invalid_request            | do_not_retry             |
| `HP-XB-01`                                                 | Currency invalid for this country                                                                       |                   | invalid_request            | do_not_retry             |
| `HP-XB-02`                                                 | Zero or negative fee or amount                                                                          |                   | invalid_amount             | do_not_retry             |
| `HP-XB-03`                                                 | Above the per-transaction limit                                                                         |                   | invalid_amount             | do_not_retry             |
| `HP-XB-04`                                                 | No fee configured; contact business development                                                         |                   | configuration              | manual_review            |
| `HP-XB-07`                                                 | Payee document does not match name or birth date                                                        | Brazil            | invalid_request            | customer_action_required |
| `HP-XB-08`                                                 | Payee document not valid with the Brazilian Federal Revenue                                             | Brazil            | invalid_request            | customer_action_required |
| `HP-XB-16`                                                 | Shareholders invalid                                                                                    |                   | invalid_request            | do_not_retry             |
| `HP-XB-19`                                                 | Shareholder under age                                                                                   |                   | invalid_request            | do_not_retry             |
| `HP-XB-20`, `HP-XB-21`, `HP-XB-30`                         | Company contact name / document / document type missing                                                 |                   | invalid_request            | do_not_retry             |
| `HP-XB-22`, `HP-XB-27`                                     | Shareholder document / document type invalid                                                            |                   | invalid_request            | do_not_retry             |
| `HP-XB-23`, `HP-XB-24`                                     | Shareholder document does not match name or birthday / not valid with Federal Revenue                   | Brazil            | invalid_request            | do_not_retry             |
| `HP-XB-25`                                                 | Shareholder email invalid                                                                               |                   | invalid_request            | do_not_retry             |
| `HP-XB-26`                                                 | Currency not found for this country                                                                     |                   | invalid_request            | do_not_retry             |
| `HP-XB-28`, `HP-XB-29`                                     | Shareholder document equals payee document / duplicated                                                 |                   | invalid_request            | do_not_retry             |
| `BP-HI-0001`                                               | A transfer with this `external_reference` already exists                                                |                   | duplicate_request          | do_not_retry             |
| `BP-HI-0002`                                               | Transfer below the USD minimum                                                                          |                   | invalid_amount             | do_not_retry             |
| `BP-HI-0003`, `BP-HI-0004`                                 | Daily transfer limit / transfer limit reached                                                           |                   | rate_limiting              | retry_conditionally      |
| `BP-HI-0005`                                               | Transfer source invalid                                                                                 |                   | invalid_request            | do_not_retry             |
| `BP-HI-0006`, `BP-HI-0007`                                 | Insufficient balance (USD / other currency)                                                             |                   | insufficient_funds         | manual_review            |
| `HP-DV-01`, `HP-DV-02`                                     | Document and country unknown / document empty                                                           |                   | invalid_request            | do_not_retry             |
| `HP-VT-01`, `HP-VT-02`                                     | Verify account: JSON invalid / empty                                                                    |                   | invalid_request            | do_not_retry             |
| `HP-VT-03`, `HP-VT-04`                                     | Verify account: `integration_key` empty / invalid                                                       |                   | configuration              | do_not_retry             |
| `HP-VT-05`                                                 | Verify account: account not enabled                                                                     |                   | configuration              | do_not_retry             |
| `HP-VT-06`, `HP-VT-07`                                     | Verify account: target not found / target account empty                                                 |                   | invalid_request            | do_not_retry             |
| `HP-VT-08`                                                 | Country and currency invalid for a local payout (verify page: "Invalid country")                        |                   | invalid_request            | do_not_retry             |
| `HP-VT-09`, `HP-VT-10`                                     | Target not enabled for the country / not available for query                                            |                   | configuration              | do_not_retry             |
| `HP-VT-11`, `HP-VT-12`                                     | Mercado Pago configuration missing / incomplete for the merchant                                        |                   | configuration              | do_not_retry             |
| `HP-IN-01`                                                 | Payouts to individuals not allowed for this merchant                                                    |                   | configuration              | do_not_retry             |
| `HP-ON-01`, `HP-ON-02`                                     | `order_number` not 6 to 32 characters / invalid                                                         |                   | invalid_request            | do_not_retry             |

Canceled-payout reasons (`code`, `message`, `gateway_details`). General list (D/payout/create-payout/errors/canceled-errors/payout-canceled-errors-general, 13 codes) plus 3 codes that appear only in the Brazil remittance list (`BANK_INFO`, `REJECTED_BY_BANK`, `SERVICE_UNAVAILABLE`). Retry advice follows EBANX's "merchant's action required" column.

| Code                      | Meaning (paraphrase)                                                           | Category                   | Retry                    |
| ------------------------- | ------------------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `TAX_ID_MISMATCH`         | Bank account does not belong to the given CPF/CNPJ                             | invalid_request            | customer_action_required |
| `INCORRECT_CUSTOMER_DATA` | Account, branch or Pix key invalid; provider does not say which                | invalid_request            | customer_action_required |
| `ACCOUNT_BLOCKED`         | Destination account blocked; retry once unblocked                              | payment_method_unavailable | customer_action_required |
| `UNSUPPORTED_TRANSACTION` | Account does not accept this transaction type                                  | payment_method_unavailable | customer_action_required |
| `ACCOUNT_DOESNT_EXISTS`   | Account closed or nonexistent                                                  | payment_method_unavailable | customer_action_required |
| `HIGH_RISK`               | Amount above what the receiving bank accepts; split or check                   | invalid_amount             | customer_action_required |
| `DECLINED`                | Receiving bank rejected without reason                                         | payment_method_unavailable | customer_action_required |
| `TIMEOUT`                 | Receiving bank timed out; send again                                           | network_or_timeout         | retry_conditionally      |
| `INCORRECT_ACCOUNT_TYPE`  | Account type wrong (use `C` or `S`)                                            | invalid_request            | customer_action_required |
| `PIX_NOT_ACCEPTED`        | Bank does not support Pix; use full bank details                               | payment_method_unavailable | customer_action_required |
| `RESPONSE_ERROR`          | Unknown error; retry or contact EBANX                                          | unknown                    | retry_conditionally      |
| `REJECTED`                | Rejected by the receiving method; EBANX says retry                             | unknown                    | retry_conditionally      |
| `FRAUD_RISK`              | Pix key flagged as fraudulent by the Central Bank of Brazil                    | fraud_or_risk              | do_not_retry             |
| `BANK_INFO`               | Branch, bank number, account number or receiver name wrong (Brazil remittance) | invalid_request            | customer_action_required |
| `REJECTED_BY_BANK`        | Transfer refused by the bank (Brazil remittance)                               | payment_method_unavailable | customer_action_required |
| `SERVICE_UNAVAILABLE`     | Receiving bank unavailable (Brazil remittance)                                 | provider_unavailable       | retry_conditionally      |

The remittance page also uses `ACCOUNT_BLOCKED`, `ACCOUNT_DOESNT_EXISTS`, `INCORRECT_ACCOUNT_TYPE` and `TAX_ID_MISMATCH`, with provider wording in `gateway_details`. One code can carry several `gateway_details` texts.

Balance (D/payout/balance/consult-balance): `HP-BA-01` currency invalid, `HP-BA-02` date invalid (invalid_request / do_not_retry). Verify account (D/payout/account/verify-account): error body `{"code": "limit_rate_reached", "error": "..."}` (rate_limiting / retry_conditionally) and HTTP 400 invalid request, 401 authentication, 404 account error, 424 provider unavailable, 429 rate limit, 500 server error, 504 internal error. Verify-account `status` values: `valid`, `invalid`, `pending` (Pix checks are asynchronous).

#### 4.14 Count summary

| Table                                                                                        | Distinct values |
| -------------------------------------------------------------------------------------------- | --------------- |
| 4.1 Pay-in authentication, parser and request-level `status_code`                            | 31              |
| 4.2 Pay-in `BP-DR-*`                                                                         | 197             |
| 4.3 Refund, cancel, capture, query and status-update codes                                   | 97              |
| 4.4 3DS, enrollment, payment page and retry, instalment plan, utilities, chargeback evidence | 159             |
| Subtotal: pay-in API `status_code` values (guide table plus OpenAPI plus other pages)        | 484             |
| 4.5 `transaction_status.code`                                                                | 6               |
| 4.6 Card `description_code` (47 in the table plus 34 refund-decline codes)                   | 81              |
| 4.8 APM `description_code`                                                                   | 66              |
| 4.9 ISO 8583 response codes                                                                  | 64              |
| 4.9 Mastercard MAC codes                                                                     | 14              |
| 4.10 ECI values                                                                              | 7               |
| 4.11 Enrollment `reason_code`                                                                | 22              |
| 4.12 Chargeback reason codes                                                                 | 69              |
| 4.13 Payout API codes                                                                        | 154             |
| 4.13 Canceled-payout codes                                                                   | 16              |
| 4.13 Balance (`HP-BA-*`) and verify-account (`limit_rate_reached`) codes                     | 3               |
| **Total code values**                                                                        | **986**         |

Not counted above: the 23 card response description strings (4.7), the HTTP statuses, and the value sets for 3DS status (5), liability (3), brand mandate category (4), network token status (8), card verification code (5), dispute status (6 plus SFTP spellings), MED reasons (6), payment status (4), refund status (4) and payout status (8). A few strings (`TIMEOUT`, `ACCEPTED`, `DEFAULT_ERROR`, `INCORRECT_CUSTOMER_DATA`) occur in more than one table with table-specific meaning; they are counted once per table.

### 5. Lifecycle

Payment, refund, chargeback, claim and payout states are separate objects with separate vocabularies. Do not merge them.

#### 5.1 Payment status (`payment.status`)

| Value | Meaning (paraphrase of OpenAPI `payment-status` and guide pages)                                   | Allowed next states (OpenAPI wording)                          |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `OP`  | Open: created, customer has not yet completed the payment details (hosted checkout, 3DS, redirect) | `PE` or `CA` (time out)                                        |
| `PE`  | Pending confirmation (voucher issued, transfer awaited, or card authorized but not captured)       | `CO` or `CA`                                                   |
| `CO`  | Confirmed (paid). Only `CO` payments can be refunded                                               | none listed; refunds and chargebacks live in their own objects |
| `CA`  | Cancelled, expired or failed                                                                       | none                                                           |

`llms.txt` gives the flow `OP -> PE -> CO or CA`. A declined card authorization is reported as `CA` with `transaction_status.code: "NOK"` (the 3DS `redirect-failed` example has `status: "CA"`); a successful card payment with auto-capture goes straight to `CO` in the examples.

#### 5.2 Authorization and capture (cards)

- `payment.card.auto_capture` defaults to `true`. With `false`, an approved authorization leaves the payment in `PE` with `pre_approved: true`; `capture_available` indicates whether `/ws/capture` is possible.
- `/ws/capture` takes `hash` or `merchant_payment_code`, optional `merchant_capture_code`, and optional `amount` for one partial capture (zero or absent means full). The partial-capture example returns `status: "CO"` with `amount_ext` reduced to the captured amount (`50.00`), so the original authorized amount is not kept in the response.
- Uncaptured authorizations expire automatically (credit-card guide). The capture window is **NOT DOCUMENTED** in the main guides; EBANX's condensed integration notes say "typically 5 days", after which the payment becomes `CA`.
- Instalment payments must use auto-capture (`BP-DR-129`).

#### 5.3 Cancellation

- `/ws/cancel` (`payment_hash` in the guide's parameter table, `hash` or `merchant_payment_code` per OpenAPI) works only for `OP` or `PE`; it returns the payment with `status: "CA"` and top-level `"operation": "cancel"`. No partial cancellation.
- `/ws/refundOrCancel` cancels `OP`/`PE` payments and fully refunds `CO` payments in one call.
- Vouchers and transfers left unpaid move to `CA` automatically after `due_date` (Boleto page; OXXO, SPEI, Efecty, PSE, Rapipago and PagoEfectivo pages say "eventually" or "automatically").

#### 5.4 Refunds (`payment.refunds[]`)

| Refund `status` | Meaning (refund guide)                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| `RE`            | Requested: queued at EBANX                                                        |
| `PE`            | Pending: acknowledged; for bank refunds the customer may be emailed for bank data |
| `CO`            | Confirmed: money reached the customer                                             |
| `CA`            | Cancelled by the merchant (only from `RE` or `PE`); customer not told             |

A substatus `AW` (awaiting bank info) is combined as `CO-AW` in `BP-REF-35`; where the substatus appears in a response is **NOT DOCUMENTED**. Several refunds per payment are allowed up to the payment amount (cancelled refunds excluded). Refunds are in the original currency. `refund_status_details` may carry `cancellation_reason_code`, `pending_reason_code` (example `WAITING_BANK_CONFIRMATION`) and `status_reason_code` (example `CONFIRMED`); full value lists are **NOT DOCUMENTED**. Limits seen in codes: card payments older than 85 days (`BP-REF-19`), 180-day age limit when enabled (`BP-REF-56`), UPI refund window (`BP-REF-53`), Chile minimum 50 CLP. The condensed integration notes say cash methods (OXXO, Efecty, Boleto) "typically cannot be refunded through the API"; the main refund guide instead describes bank-data collection for such refunds. A refund triggers `notification_type=refund`.

#### 5.5 Chargebacks and claims

- Card chargeback: the payment stays `CO`; a `chargeback` object appears on `/ws/query` with `chargeback_date`, `reason_code`, `dispute_status` and settlement fields; a `notification_type=chargeback` notification is sent. Funds are deducted from settlement at once. Dispute flow: `Evidence Required` (5 business days) -> `Under Analysis` (up to 120 days) -> `Dispute Won` or `Dispute Lost`, or `Not disputed`. A withdrawn chargeback is credited back ("Chargeback Credit", `notification_type=chargeback_credit`). Refunds are blocked while a chargeback exists (`BP-REF-8`).
- Pix MED claim: separate from chargebacks; reported only once completed (`claims.status: "Returned"`), deducted from settlement as "claim-MED". Can be partial. Merchants cannot dispute it.

#### 5.6 Asynchronous methods (vouchers, bank transfers, wallets)

`/ws/direct` returns `status: "PE"` plus voucher or transfer data (`boleto_url`, `boleto_barcode`, `oxxo_barcode`, `clabe_account`, `pix.qr_code_value`, `redirect_url`). Confirmation arrives later as a notification and is visible as `CO` with `confirm_date`. Documented timing: Boleto up to 3 business days; Efecty typically 1 to 2 business days; OXXO and SPEI "real time"; Pix instant. Expiry is `due_date`, after which the payment becomes `CA`. `OP` is used when the customer still has to act on an EBANX page (hosted checkout, 3DS redirect).

#### 5.7 Recurring APMs (Pix Automatico and similar)

Enrollment and payment are separate. A recurring payment starts `PE` on scheduling; the payer's bank has up to two hours to accept or reject the schedule; rejected or cancelled schedules become `CA` with a `description_code` (section 4.8). Payment attempts and retries appear under `payment_attempts` with `attempt_response` (always the generic `INSUFFICIENT_FUNDS_OR_DAILY_LIMIT` for Pix Automatico failures). Up to three merchant retries within seven days, one per day (`/ws/retry`).

#### 5.8 Payouts (`payout.status`)

| Value | Meaning (paraphrase)                                            | Source                                             |
| ----- | --------------------------------------------------------------- | -------------------------------------------------- |
| `OP`  | Open; waiting to start; can be cancelled                        | OpenAPI, consult and notification pages            |
| `CM`  | Committed (`/ws/payout/commit`, or automatically after 6 hours) | Notification page only (`payout_status_committed`) |
| `PE`  | In payment process                                              | OpenAPI and notification page                      |
| `AD`  | Awaiting documents                                              | Notification page only                             |
| `AW`  | Awaiting payment                                                | Notification page only                             |
| `PA`  | Paid                                                            | OpenAPI and notification page                      |
| `CA`  | Cancelled (from `OP`, `CM`, `PE`, `AD` or `AW`)                 | OpenAPI and notification page                      |
| `RE`  | Reverted after being paid                                       | Notification page only                             |

Notification `operation` values map to these: `payout_status_open`, `payout_status_committed`, `payout_status_processing` (to `PE`), `payout_status_awaiting_documents`, `payout_status_awaiting_payment`, `payout_status_paid`, `payout_status_canceled`, `payout_status_reverted`. The OpenAPI search filter accepts only `OP`, `PE`, `PA`, `CA`. Balance transfers use `OP`, `CO`, `PA`, `CA` (OpenAPI `transfer-search-request`).

#### 5.9 Settled

`transfer_date` on the payment is described as the settlement date. Settlement itself (Merchant Area or scheduled) produces reports, not API events. Card funds in Brazil become available after 30 days by default (debit 2 days) per the operability page.

### 6. Notifications

#### 6.1 Delivery

- Transport: HTTP POST to the notification URL set in the Merchant Area, or to the per-payment `notification_url` request field (which overrides it, per OpenAPI).
- Body: one `application/x-www-form-urlencoded` string. EBANX says the signature is computed over the raw body, so it must be checked before parsing.
- Acknowledgement: reply HTTP 200 immediately; otherwise EBANX resends. The payment page says it retries "multiple times"; the condensed integration notes say "exponential backoff". The schedule, number of attempts and give-up time are **NOT DOCUMENTED**.
- Duplicates: the enrollment page warns that a missing 200 "can lead to duplicate notifications", and the condensed security note says "EBANX may send duplicate notifications".
- Ordering: **NOT DOCUMENTED**.
- Source IP addresses: **NOT DOCUMENTED**.
- Content: notifications carry only identifiers. The payment notification page says it "does not include full payment details"; merchants must call `/ws/query`. (The condensed lifecycle note claims the payload contains the new `status`; the first-party examples do not show one.)

#### 6.2 Notification kinds and fields

| Kind       | `operation`                                     | `notification_type`                                   | Identifier field                                      | Trigger                                                                   |
| ---------- | ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Payment    | `payment_status_change`                         | `update`, `chargeback`, `refund`, `chargeback_credit` | `hash_codes`: one hash or several separated by commas | `PE` to `CO` or `CA`; chargeback; refund; chargeback credit               |
| Payout     | `payout_status_<state>` (8 values, section 5.8) | always `update`                                       | `hash_codes`: the payout `uid`                        | Payout status change (page names `PE`, `PA`, `CA`; the list covers all 8) |
| Enrollment | `enrollment_status_change`                      | always `update`                                       | `merchant_enrollment_code`                            | Enrollment accepted or revoked                                            |

The payment page's prose says notifications fire on changes to `CO` or `CA` only, yet the same page lists `chargeback`, `refund` and `chargeback_credit` types, and the MED page says a notification follows each completed claim (its type is **NOT DOCUMENTED**). The official PHP SDK models a notification as exactly `operation`, `notification_type`, `hash_codes` (`ebanx/benjamin`, `src/Models/Notification.php`).

#### 6.3 Signature fields (sensitive; PandaPayLens does not verify)

HTTP headers on every notification (payment, payout and enrollment pages):

```text
X-Signature-Type: rsa,sha1
X-Signature-Fingerprint: 4ABAD89CF66B99998465470550EB15E3E271A246
X-Signature-Content: <base64 RSA-SHA1 signature of the raw body>
```

(Transcribed from https://docs.ebanx.com/docs/pay-in/management/status-and-retrieval/payment-notifications; the example value of `X-Signature-Content` there is truncated with "...".) The fingerprint names EBANX's public certificate (`ebanx-notifications-public.pem`, downloadable over plain `http://downloads.ebanx.com/rsa/<fingerprint>/...`). The signature is not a secret, but it is authenticity material: show it as present or absent and never as evidence of validity. Request-side JWS headers (`X-JWS-Signature`) belong to merchant requests and should be redacted the same way.

#### 6.4 Duplicate identification

There is no event or delivery id. Suggested dedupe key: `operation` + `notification_type` + sorted `hash_codes` (or `merchant_enrollment_code`). Because a single notification can name several hashes, and because the same hash can receive `update`, `refund` and `chargeback` notifications, a timeline should treat each (hash, `notification_type`) pair as an event and take the actual state from the matching `/ws/query` response (`status_date`, `refunds[].request_date`, `chargeback.create_date`).

### 7. Identifiers

| Field                                                                                     | Scope                                                                      | Notes                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hash` (`payment.hash`; `hash_codes` in notifications; `payment_hash` on the cancel page) | EBANX payment id, primary correlation key                                  | Lowercase hex in examples; 48 characters per OpenAPI. Reused by capture, cancel, refund, query, chargeback evidence and notifications. Appears inside `redirect_url` (`?hash=`)                                        |
| `merchant_payment_code`                                                                   | Merchant's payment reference, up to 40 characters                          | Unique per merchant (`BP-DR-0`); accepted instead of `hash` by query, capture and evidence. The condensed integration note says a query returns the most recent payment if several share a code, and recommends `hash` |
| `order_number`                                                                            | Merchant order                                                             | Not unique; several payments may share it                                                                                                                                                                              |
| `refunds[].id` / `refund_id`                                                              | EBANX refund id (numeric string)                                           | Needed to cancel a refund                                                                                                                                                                                              |
| `refunds[].merchant_refund_code`                                                          | Merchant refund reference (20 characters on the error page, 40 in OpenAPI) | Unique (`BP-REF-17`)                                                                                                                                                                                                   |
| `merchant_capture_code`                                                                   | Optional merchant capture reference                                        | Only in the capture request                                                                                                                                                                                            |
| `chargeback.chargeback_public_id`                                                         | Chargeback id (UUID in the guide example)                                  | One `chargeback` object per payment in the examples                                                                                                                                                                    |
| `claims.return_request_id`                                                                | Pix MED claim id                                                           |                                                                                                                                                                                                                        |
| `transaction_status.authcode`                                                             | Acquirer authorization code                                                | Also on refunds                                                                                                                                                                                                        |
| `transaction_references[]` (`arn`, `tlid`)                                                | Acquirer reference number; Mastercard Transaction Link Identifier          | TLID links captures, refunds and recurring charges to the original authorization (credit-card guide)                                                                                                                   |
| `threeds_result.threeds_reference`                                                        | 3DS reference                                                              |                                                                                                                                                                                                                        |
| `token`, `creditcard_token`                                                               | Card token                                                                 | Sensitive                                                                                                                                                                                                              |
| `merchant_enrollment_code`                                                                | Recurring enrollment (mandate) reference                                   | Links recurring payments to an enrollment; enrollment notifications carry only this                                                                                                                                    |
| `payout.uid`                                                                              | EBANX payout id (41 hex characters in examples)                            | Sent as `hash_codes` in payout notifications                                                                                                                                                                           |
| `payout.external_reference`                                                               | Merchant payout reference (6 to 40 per `HP-CM-02`; 4 to 60 per OpenAPI)    | Unique (`HP-CM-03`)                                                                                                                                                                                                    |
| `sub_account.code`                                                                        | Sub-account                                                                |                                                                                                                                                                                                                        |

No parent/child id exists between a payment and its refunds, chargeback or claim: they are nested inside the payment object and inherit its `hash`.

### 8. Sensitive fields

Redact or mask by default. Request fields are listed because developers paste request and response pairs.

- **Secrets and authenticity material**: `integration_key`, `public_integration_key`, `X-JWS-Signature` header (and the JWS `kid`, which EBANX calls not sensitive but which identifies the merchant key), `X-Signature-Content`, any private key material, the chargeback `request_body` hash.
- **Card data**: `card_number`, `card_cvv`, `card_due_date`, `card_name`, `token`, `creditcard_token`, `masked_card_number`, `network_token_pan`, `network_token_cryptogram`, `network_token_expire_date`, `network_token_raw_bin` with `network_token_raw_last4`, `threeds_cryptogram`, `threeds_eci` with `threeds_trxid`, Apple Pay and Google Pay payloads, payment account reference values.
- **Tax and identity documents**: `document` (CPF or CNPJ in Brazil; DNI, CUIT, CUIL, CDI in Argentina; RUT/RUN in Chile; CC, CE, NIT, TI in Colombia; RFC, CURP in Mexico; DNI, RUC, PASS, CE in Peru; TIN, VAT in Egypt), `document_type` together with `document`, `responsible.document`, `bank_info.bank_account_holder_document`, `payee.document`, `enrollment.identification`, shareholder documents.
- **Personal data**: `name`, `email`, `birth_date`, `phone_number`, `address`, `street_number`, `street_complement`, `city`, `state`, `zipcode`, `customer.*`, `payee.*` (name, email, phone, birthdate), `customer_device_info`, device fingerprint values, IP addresses.
- **Bank and wallet data**: `bank_info.*` (`bank_account`, `bank_branch`, `bank_details`, `bank_account_holder_name`), `directdebit.*`, `pix_key`, `clabe`, `clabe_account`, `clabe_reference`, CBU/CVU, CCI, `upi.vpa` / `metadata.upi_vpa`, Mercado Pago account email, `target_account`.
- **Payable instruments** (anyone holding them can pay or view the slip): `boleto_barcode`, `boleto_barcode_raw`, `boleto_url`, `oxxo_barcode`, `oxxo_url`, `pix.qr_code_value`, `qrcode_url`, `voucher_url`, `cip_code`, `spei_url`, `redirect_url` and `threeds_redirect_url` (contain the hash or a session), `fill_bank_data_url`.
- **Merchant identifiers**: `notification_url`, `sub_account` data, billing descriptor (not personal, but merchant-identifying).

### 9. Structural detection hints

Strong EBANX signals (combine several):

1. **Pay-in envelope**: top-level `"status": "SUCCESS"` or `"ERROR"` (uppercase string) next to a `payment` object, or `status_code` + `status_message` with `status: "ERROR"`.
2. **Code shape**: `status_code` matching `^(BP|DA|RP|RF|IPBP)-` such as `BP-DR-17`, `BP-SA-2`, `BP-REF-6`, `BP-CAP-2`, `DA-0`; payouts `^(HP|BP-HI)-` such as `HP-CM-09`.
3. **Payment object keys**: `hash` (48 or 49 lowercase hex), `merchant_payment_code`, two-letter `status` in {`OP`,`PE`,`CO`,`CA`}, the trio `amount_br` / `amount_ext` / `amount_iof`, `currency_ext`, `currency_rate`, `pre_approved`, `capture_available`, `instalments` (single "l"), `transfer_date`, `due_date`, `payment_type_code`.
4. **`transaction_status` object** with `acquirer` (`EBANX` or `EBANX IP`), `code` (`OK`/`NOK`/...), `description`, optional `description_code` in SCREAMING_SNAKE_CASE, `authcode`, `iso_code`, `mac_code`.
5. **Notification body**: form-encoded `operation=payment_status_change` (or `payout_status_*`, `enrollment_status_change`) with `notification_type` and `hash_codes`; headers `X-Signature-Type: rsa,sha1` and `X-Signature-Fingerprint`.
6. **Payout envelope**: top-level `type` in {`success`, `api_error`, `authentication_error`, `invalid_request_error`, `request_error`} with `payout.uid`, `payout.external_reference`, `request_amount`, `debit_amount_total`, `local_amount_total`; or an error with both `status_code` and `code` holding the same `HP-*` value.
7. **Hosts and paths**: `ebanxpay.com`, `ebanx.com`, `sandbox-local-latam`, `/ws/direct`, `/ws/query`, `/ws/refund`, `/ws/redirect?hash=`, `/checkout?hash=`, `/print/voucher`, `downloads.ebanx.com`.
8. **Chargeback reason code** shape `NNNN/NN` (for example `0200/15`) with `dispute_status` values such as `Evidence Required`.

How EBANX differs from supported and candidate providers:

- **Stripe**: JSON objects with `object` and prefixed ids (`pi_`, `ch_`, `evt_`); errors nested under `error` with lowercase `type`/`code`. EBANX payout errors also use `"type": "invalid_request_error"`, but at top level and together with an `HP-*` `status_code`/`code`; never nested under `error`.
- **Adyen**: `pspReference`, `resultCode`, `notificationItems`. **Checkout.com**: `id` prefixed `pay_`, `approved`, `response_code`. **PayPal**: `event_type` such as `PAYMENT.CAPTURE.COMPLETED`, `links`. **Braintree**: GraphQL or XML with `processorResponseCode`. **Mollie**: `resource`, ids `tr_`. **Square**: `errors[]` with `category`. None of them uses `hash`, `merchant_payment_code` or `BP-*` codes. When EBANX processes behind Braintree or Worldpay, the merchant sees Braintree or Worldpay payloads; EBANX detection should not fire on those.
- **payabl.**: URL-encoded `transactionid`/`transid`, numeric `status` such as `-6000`. **NMI**: query-string `response`, `responsetext`, `transactionid`. **Authorize.net**: `messages.resultCode`, `transactionResponse`. **Cybersource**: `id`, `status` words such as `AUTHORIZED`, `errorInformation.reason`. **Worldpay**: XML or JSON with `outcome`/`lastEvent`. **Nuvei**: `ppp_status`, `errCode`, `gwErrorCode`, DMN `advanceResponseChecksum`.
- **NETbilling**: also has a `status_code` field, but in a form-encoded Direct Mode response with `trans_id` and one-character codes; EBANX's `status_code` is a `BP-*` string inside JSON with `status: "ERROR"`.
- **AstroPay** (also Latin America): `deposit_external_id` / `merchant_deposit_id`, word statuses `APPROVED`, `PENDING`, `CANCELLED`, and `error`/`description` error bodies. EBANX uses two-letter statuses and `hash`.
- **Other high-risk adapters** (CCBill, Segpay, Verotel, Epoch, Paymentwall, PXP, Trust Payments, emerchantpay, ecommpay, Decta, Inpay, Trustly, Skrill, MiFinity, eZeeWallet, Finrax, NETbilling, Pavilion): none of their documented formats uses the `BP-`/`HP-` code prefixes, `hash_codes`, or the `amount_br`/`amount_ext`/`amount_iof` trio.

False-positive risk: the word `hash` is common; require at least one of `merchant_payment_code`, `amount_ext`, `pre_approved`, a `BP-`/`HP-` code or `hash_codes` before claiming EBANX.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Code meaning collisions** (same string, different meaning by page):
   - `BP-R-3` to `BP-R-6`: payment page field errors (P) versus Pix Automatico retry errors (X); `BP-R-5` is also worded "attempt being processed" (O, S) versus "retried today" (X).
   - `BP-DR-62`: "recurring not enabled" (P) versus "billing cycle already has a payment" (O, X).
   - `BP-DR-63`: "token not found for acquirer" (P) versus "due date before subscription start" (O, X).
   - `BP-DR-132`: 3DS cryptogram and ECI missing (P) versus `country` missing on the e-wallet list endpoint (O).
   - `BP-DR-9`: merchant payment code missing (P) versus "or payment type invalid" (O) versus Pix Automatico due date (X).
   - `BP-US-1`..`5` (sandbox status update) versus `BP-US-01`..`06` (subscription update).
   - `BP-REF-41`: fully refunded, and also "invalid Pix key".
   - Scenario file, NuPay recurring: `BP-DR-17` "Invalid enrollment code", `BP-DR-20` "Insufficient funds", `BP-DR-18` "Enrollment has expired", which contradict the table meanings (invalid email, invalid birth date, disabled customer). An adapter should prefer `status_message` text when it disagrees with the code table, and flag the mismatch.
   - Token endpoint reuses `BP-DR-35`, `-36`, `-38`, `-48` to `-67` with token-specific wording.
2. **HTTP status**: the error page says unlisted errors return HTTP 200, but several scenario examples return 400 for the same envelope.
3. **`hash` length**: OpenAPI fixes 48 characters, while the main example hash in many guides has 49 characters and one Pix Automatico example has 47. Parsers should not enforce a fixed length.
4. **Field naming drift**: `payment.card` versus `payment.creditcard`; `hash` versus `payment_hash` on cancel; `amount_itens` versus `amount_items`; `status_message` versus `message` (update subscription); `country` lowercase versus uppercase; enrollment `status` lowercase versus uppercase.
5. **Placeholders in examples**: many guide examples use `{{YYYY-MM-DD HH:mm:ss}}`, `{{refund_id}}`, `{{tax_id}}`; they are templates, not values. A tolerant parser should accept them as strings and mark the payload as a docs example.
6. **Contradictory 3DS example**: the `three-ds-redirect` / `redirect-pending` scenario shows `threedsecure.status: "PENDING_AUTHENTICATION"` together with `status: "CO"` and a `confirm_date`, which conflicts with the stated flow (pending authentication should not be confirmed). Treat `threedsecure.status` as authoritative for authentication and flag the conflict.
7. **Notifications**: retry schedule, ordering, source IPs and the notification type for MED claims are **NOT DOCUMENTED**. The payment page's statement "CO or CA only" conflicts with its own `refund`/`chargeback` types. EBANX's condensed integration notes describe a GET query (`GET /ws/query?integration_key=...`), a refund `operation` value of `refund` and a notification payload with `status`; the main guides and OpenAPI use POST, `request`, and no status.
8. **Payout statuses**: OpenAPI lists 4 (`OP`, `PE`, `PA`, `CA`); the notification page adds `CM`, `AD`, `AW`, `RE`. Payout get-started says payouts are always cross-border and only from outside Brazil, Chile, Colombia or Mexico, while the operability page lists local payout availability in Brazil, Chile and Mexico. The payout OpenAPI sandbox server is `https://sandbox.ebanx.com` while the guides use `sandbox.ebanxpay.com`.
9. **Amount types** vary (strings versus numbers) between `/ws/direct` and `/ws/request`, and within payout examples.
10. **Refund code length**: `merchant_refund_code` maximum 20 (error page, refundOrCancel schema) versus 40 (refund request schema).
11. **Capture window** and authorization expiry are only in the condensed integration note ("typically 5 days"), not in the main guides.
12. **Raw card numbers**: `llms.txt` and the condensed integration notes say never to send raw card numbers and that the API rejects them, yet the API reference examples and the sandbox page send `card_number` directly. PandaPayLens must redact either way.
13. **ISO and MAC fields** are opt-in per merchant and limited to seven countries; most real responses will not have them.
14. **Prohibited products list** could not be read (client-side rendering failed), so sector restrictions are unknown.
15. **Not read**: Merchant Area, SFTP files, Postman collection; anything only there is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | First-party tables and OpenAPI enumerations cover several hundred `status_code` values, card and APM `description_code` values, ISO 8583 and MAC codes, payout `HP-*` codes and canceled-payout reasons, with clear meanings and some explicit retry advice. Known collisions (section 10) can be handled by endpoint context and a "conflicting documentation" warning |
| **paymentResponses** | **supported** | One stable JSON payment object for direct, query, capture, cancel and refund, with many examples; error envelope is uniform. Amount type drift and placeholders need tolerant parsing                                                                                                                                                                                   |
| **webhookParsing**   | **limited**   | The body format is documented and trivial (three form fields), but it carries no status, amount, timestamp or event id; retries and ordering are undocumented. Parsing is reliable, diagnostic content is thin without a matching `/ws/query`                                                                                                                           |
| **timeline**         | **limited**   | `/ws/query` gives `open_date`, `status_date`, `confirm_date`, `transfer_date`, refund dates and chargeback dates, enough for a good per-payment timeline; notifications add only event types. Payout notifications give a richer state sequence. Some states (`CM`, `AD`, `AW`, `RE`) are undocumented in the payout schema                                             |
| **correlation**      | **supported** | `hash` (and `hash_codes` in notifications) is shared by every pay-in operation, refunds and chargebacks are nested in the payment, `merchant_payment_code` is unique per merchant, payouts use `uid` in both API and notifications, and enrollments use `merchant_enrollment_code`                                                                                      |
