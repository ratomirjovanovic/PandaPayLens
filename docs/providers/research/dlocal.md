# dLocal (adapter id `dlocal`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from dLocal's first-party documentation (`docs.dlocal.com`), dLocal's own website (`www.dlocal.com`) and repository metadata of code linked from the docs, as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: `docs.dlocal.com` is a ReadMe site. Its `robots.txt` points to `sitemap.xml`, and its `llms.txt` lists every guide and reference page. The site documents that any page is served as raw Markdown when `.md` is added to the URL (https://docs.dlocal.com/docs/using-llms.md). Pages were downloaded in that form and read as text. API reference pages embed an OpenAPI definition as JSON; those definitions were parsed locally to list response fields and examples. Code tables were extracted from the Markdown and every code in this file was checked against that extraction, so code values are exact; meanings are paraphrased. The "updated" value is the page's own `updatedAt` front matter. No login, sign-up or access request was made.

---

## Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Classification                     | `card_processing`, `alternative_payment_method` (cash vouchers, bank transfers, Pix, wallets, mobile money, virtual accounts); `merchant_account_intermediary` (a dLocal entity collects payments on behalf of merchants, and local vouchers and transfer instructions name dLocal companies as beneficiary). `acquiring`, `gateway`, `payment_facilitator`, `wallet` and `orchestration` are not claimed by the pages read                                                                                                                                       |
| Documented sectors                 | Industries named by dLocal: digital and subscriptions, eLearning, gaming (video game publishers), SaaS, streaming, crypto and stablecoins, marketplaces, retail, ride-hailing, food delivery, travel, financial services, payroll and HR, money remittance, digital advertising (www.dlocal.com/llms.txt). The docs add industry data requirements for marketplace, retail and delivery; wallets and account funding; subscriptions; platforms. Gambling, adult, forex: **NOT DOCUMENTED**                                                                        |
| Documentation access               | **Public** (no login) for all guides, the API reference, code tables and notification pages. Credentials, IP allow-listing and notification URLs are set in the Merchant Dashboard (login). Payouts v3 OAuth credentials come from a Technical Account Manager. The network-level `acquirer` decline fields are enabled on request                                                                                                                                                                                                                                |
| API family to implement first      | **Payins API** (`X-Version: 2.1`): the payment object (`status`, `status_code`, `status_detail`) returned by `POST /payments` and `GET /payments/{id}`, the same object delivered as the payment notification, the HTTP error envelope (`code`, `message`, `param`), then refunds and chargeback notifications                                                                                                                                                                                                                                                    |
| Documented codes (distinct values) | 330 across 19 tables: payment statuses 6, payment pending sub-codes 3, payment rejection codes 39, Payins payment HTTP error codes 33 (34 rows), refund statuses 4, refund HTTP error codes 23, saved-card HTTP error codes 9, chargeback statuses 7, dispute upload results 5, chargeback reason codes 107, callback statuses 4, Payouts v3 statuses 7, Payouts v3 error codes 17, Payouts v3 rejection codes 21, Payouts v2 statuses 6, account validation errors 11, enrollment statuses 5, enrollment rejection codes 12, Mastercard merchant advice codes 11 |
| Biggest limitations                | The same numbers mean different things per object: `status_code` 700 is a verified payment, a won chargeback and a compliance hold on a payout; rejection codes 301-319 differ between payments and payouts; HTTP error codes 3001, 5010, 5011, 5023 and 5050 differ between Payins families and Payouts. Notifications carry no event ID and no documented ordering. `status_code` is a string in some objects and an integer in others                                                                                                                          |
| White-label                        | No. dLocal documents its own JSON formats and identifiers. It routes cash vouchers and transfers to local providers (for example a Boleto issued through `itau`, a transfer to an account at Banco Industrial), but those results reach the merchant in dLocal's own payment object                                                                                                                                                                                                                                                                               |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://docs.dlocal.com/docs`, `R` = `https://docs.dlocal.com/reference`. Pages were read in their `.md` form (append `.md` to each URL).

| URL                                                                                                                                                                                | Updated                                        | What it covers                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://docs.dlocal.com/robots.txt, https://docs.dlocal.com/sitemap.xml, https://docs.dlocal.com/llms.txt                                                                          | n/a                                            | Page discovery                                                                                                                                               |
| D/using-llms                                                                                                                                                                       | 2026-10-06                                     | States that every page is available as raw Markdown by adding `.md`; describes `llms.txt`                                                                    |
| D/get-started                                                                                                                                                                      | 2026-06-10                                     | Products (Payins, Payouts, dLocal for Platforms), business examples, dashboard sign-up                                                                       |
| D/initial-settings                                                                                                                                                                 | 2026-03-03                                     | IP allow-list, endpoint URLs, mutual TLS alternative                                                                                                         |
| D/generate-signature                                                                                                                                                               | 2026-05-28                                     | Request signature for Payins, Payouts v2 (`Payload-Signature`) and Payouts v3 (OAuth bearer)                                                                 |
| R/payins-security                                                                                                                                                                  | 2026-03-03                                     | Payins headers, `V2-HMAC-SHA256` recipe, JWE `encrypted_data`, `X-Idempotency-Key`, `X-Dlocal-Payment-Source`                                                |
| R/api                                                                                                                                                                              | 2026-03-25                                     | API reference introduction: REST, JSON requests and responses                                                                                                |
| D/overview-payins                                                                                                                                                                  | 2026-04-28                                     | Integration types (Full API, Smart Fields, Checkout redirect, Payment links), sync vs async                                                                  |
| D/make-payment                                                                                                                                                                     | 2026-08-05                                     | Direct and redirect flows, payment method types                                                                                                              |
| D/card-payments                                                                                                                                                                    | 2026-05-06                                     | Card payment examples; `/secure_payments` vs `/payments`                                                                                                     |
| D/authorization-and-capture                                                                                                                                                        | 2026-07-27                                     | Authorization, capture, cancellation, $0 verification, refunds on captures                                                                                   |
| D/3d-secure                                                                                                                                                                        | 2026-09-23                                     | Third-party and dLocal 3DS, pending code 101, ECI table                                                                                                      |
| D/network-response-data                                                                                                                                                            | 2026-08-24                                     | `acquirer` object with raw network response and Mastercard merchant advice codes; declined examples                                                          |
| D/merchant-initiated-transactions (notice section only)                                                                                                                            | 2026-08-24                                     | `card.network_tx_reference`, `card.network_payment_reference`, `card.transaction_link_id`                                                                    |
| D/acquirer-reference-number                                                                                                                                                        | 2026-07-24                                     | ARN notifications with `type` `PAYMENT` / `REFUND` / `CHARGEBACK`                                                                                            |
| D/bank-transfer-payment                                                                                                                                                            | 2026-07-27                                     | Redirect and direct bank transfers; `bank_transfer` object example                                                                                           |
| D/cash-payments                                                                                                                                                                    | 2026-07-27                                     | Redirect and direct cash vouchers (`TICKET`), cancellation of pending vouchers                                                                               |
| D/pix-payments                                                                                                                                                                     | 2026-03-03                                     | Pix redirect and direct flows                                                                                                                                |
| D/wallet-payments (partly)                                                                                                                                                         | 2026-08-31                                     | Wallet flows, Enrollment API vs legacy `wallet.token`                                                                                                        |
| D/mobile-money-payments (partly)                                                                                                                                                   | 2026-07-29                                     | Mobile Money flows and country availability                                                                                                                  |
| D/virtual-accounts (partly)                                                                                                                                                        | 2026-07-27                                     | Virtual account creation response (`status` `CREATED`)                                                                                                       |
| D/brazil-food-vouchers (partly)                                                                                                                                                    | 2026-03-03                                     | Benefit card acceptance limited by business type (CNPJ)                                                                                                      |
| D/receive-notifications                                                                                                                                                            | 2026-07-24                                     | Payment notifications, retry schedule, signature verification                                                                                                |
| D/configure-callback-url                                                                                                                                                           | 2026-03-03                                     | Browser-side `callback_url` POST (`paymentId`, `status`, `date`, `signature`)                                                                                |
| D/refunds                                                                                                                                                                          | 2026-09-08                                     | Refund flow, synchronous vs pending, refund notification example                                                                                             |
| D/chargebacks                                                                                                                                                                      | 2026-07-27                                     | Chargeback notification fields and example, dispute flow, dispute upload result codes                                                                        |
| D/chargeback-categories                                                                                                                                                            | 2026-04-16                                     | Chargeback reason codes for Mexico domestic, Visa, Mastercard, Elo, Verve, American Express (embedded HTML tables)                                           |
| D/make-a-test-payment                                                                                                                                                              | 2026-07-27                                     | Sandbox status simulation; sandbox-tools responses                                                                                                           |
| D/requirements-per-industry                                                                                                                                                        | 2026-10-20                                     | Required data fields per industry                                                                                                                            |
| D/fraud-prevention                                                                                                                                                                 | 2026-03-03                                     | Risk scoring of every transaction                                                                                                                            |
| D/overview-payouts-v3, D/integrate-payouts-v3, D/flow-payouts-v3                                                                                                                   | 2026-03-03, 2026-08-05, 2026-08-27             | Payouts v3 overview, notifications, status flow diagrams (images only)                                                                                       |
| R/create-payment (OpenAPI)                                                                                                                                                         | 2026-10-05                                     | `POST /payments`: request schema, response schema and examples                                                                                               |
| R/retrieve-a-payment, R/retrieve-a-payment-status, R/retrieve-an-order                                                                                                             | 2026-10-05, 2026-09-17, 2026-09-17             | Payment object, status-only object, lookup by merchant `order_id`                                                                                            |
| R/cancel-alternative-payment, R/create-authorization, R/capture-authorization, R/cancel-an-authorization                                                                           | 2026-09-17, 2026-03-03, 2026-04-10, 2026-09-17 | Cancellation, authorization, capture                                                                                                                         |
| R/payment-status-codes                                                                                                                                                             | 2026-09-17                                     | **Payment statuses, rejection codes, pending codes**                                                                                                         |
| R/http-errors-payments, R/http-errors-refunds, R/http-errors-cards                                                                                                                 | 2026-09-17                                     | **Payins HTTP error codes** and the error envelope                                                                                                           |
| R/make-a-refund, R/retrieve-a-refund, R/retrieve-order-refund, R/retrieve-a-refund-status, R/refund-status-codes, R/the-refund-object                                              | 2026-09-17 (object 2026-03-03)                 | Refund endpoints, refund object, **refund statuses**                                                                                                         |
| R/chargeback-asynchronous-notification, R/retrieve-a-chargeback, R/retrieve-a-chargeback-status, R/chargeback-status, R/simulate-chargeback-sandbox-only                           | 2026-09-17                                     | Chargeback notification schema, chargeback object, **chargeback statuses**                                                                                   |
| R/enrollment-status-codes                                                                                                                                                          | 2026-07-01                                     | **Enrollment statuses and rejection codes**                                                                                                                  |
| R/country-reference                                                                                                                                                                | 2026-06-24                                     | Countries, currencies, local document (tax ID) names and formats                                                                                             |
| R/the-card-object, R/the-payer-object, R/the-ticket-object, R/the-bank-transfer-object, R/the-wallet-object, R/the-order-object, R/payment-method-object, R/3d-secure-object       | 2026-03-03 to 2026-06-09                       | Object field tables                                                                                                                                          |
| R/troubleshooting-signature, R/troubleshooting-integration                                                                                                                         | 2026-03-03                                     | Signature and credential troubleshooting                                                                                                                     |
| R/security-payouts-v3, R/environments-payouts-v3                                                                                                                                   | 2026-09-09, 2026-03-03                         | Payouts v3 OAuth token, sandbox simulation                                                                                                                   |
| R/requesting-payout-v3, R/get-payout-v3, R/cancel-payout-v3, R/release-payout-v3 (OpenAPI)                                                                                         | 2026-09-17                                     | Payouts v3 endpoints, payout object, error examples                                                                                                          |
| R/payout-status-v3, R/error-codes-payouts-v3, R/notification-parameters-payouts-v3                                                                                                 | 2026-03-03, 2026-09-09, 2026-04-15             | **Payouts v3 statuses, error codes, rejection codes**, notification body and retry logic                                                                     |
| R/account-validation-errors                                                                                                                                                        | 2026-03-03                                     | **Account validation error codes**                                                                                                                           |
| R/payouts-security, R/payout-status, R/notification-parameters-payouts                                                                                                             | 2026-03-03                                     | **Payouts v2 (legacy)**: `Payload-Signature`, statuses, form-encoded notification. Linked from D/generate-signature; not listed in `llms.txt` or the sitemap |
| R/notifications-v2-platforms                                                                                                                                                       | 2026-09-16                                     | dLocal for Platforms notifications (`event_type`, `Signature` header); read only to separate them from Payins notifications                                  |
| https://www.dlocal.com/llms.txt                                                                                                                                                    | n/a                                            | Company description, product and industry list, legal page list                                                                                              |
| https://www.dlocal.com/legal/regulatory-disclosure/                                                                                                                                | n/a                                            | Legal entities, licences and regulators                                                                                                                      |
| https://www.dlocal.com/industries/gaming-subvertical/, https://www.dlocal.com/our-industries-v2/crypto-industry/, https://www.dlocal.com/our-industries/money-remittance-industry/ | n/a                                            | Sector pages in dLocal's own words                                                                                                                           |
| https://www.dlocal.com/press-releases/                                                                                                                                             | n/a                                            | Activity check (releases dated up to October 20, 2026)                                                                                                       |
| https://github.com/tam-dlocal/Starter-Code-Examples (repository metadata, file tree, `Signatures/Javascript Payouts Payins/routes/notifications.js`)                               | last push 2025-07-15                           | Signature examples linked from R/payins-security; the notification handler only logs fields. Not used as evidence for formats                                |

Not read: the dLocal for Platforms API beyond its notification page, KYC Verifications, Brazil Core Services, Smart Fields, the Enrollment endpoints, installments, saved cards, Checkout redirect and Payment links guides, per-country payout requirements and purpose codes, reporting. Facts that would come only from those pages are marked **NOT DOCUMENTED** here. No official server-side SDK was found linked from the docs pages read.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | www.dlocal.com/llms.txt: "dLocal is the leading payments platform for emerging markets"; it links investor relations "(NASDAQ: DLO)". Press releases page lists releases dated October 20, 2026. Docs pages updated up to 2026-10-20                                                                                                                                                                                                                     |
| 2   | Payment service operational      | yes    | Production base URL `https://api.dlocal.com` and sandbox `https://sandbox.dlocal.com` in every OpenAPI definition; D/make-a-test-payment describes the sandbox as a mirror of production; Mastercard TLID notice dated for September and October 2026 (D/merchant-initiated-transactions)                                                                                                                                                                |
| 3   | Docs publicly accessible         | yes    | All guides and reference pages load without login, also as Markdown. Merchant Dashboard (`dashboard.dlocal.com`) needs a login and was not used. Payouts v3 credentials: "Your assigned Technical Account Manager will provide this value" (R/security-payouts-v3)                                                                                                                                                                                       |
| 4   | API families/versions identified | yes    | Payins API, header `X-Version: 2.1` (R/payins-security); Payouts v3, `X-Version: 3.0`, base path `/payouts/v3`, OAuth bearer (R/security-payouts-v3); Payouts v2 legacy (`Payload-Signature`, R/payouts-security); dLocal for Platforms ("v2" in page slugs); KYC Verifications; Brazil Core Services; Smart Fields (`dlocal.js`)                                                                                                                        |
| 5   | Offline-examinable formats       | yes    | JSON response and notification examples on every endpoint read; OpenAPI response schemas; error examples; the Payouts v2 notification as a form-encoded example                                                                                                                                                                                                                                                                                          |
| 6   | Sectors documented               | yes    | www.dlocal.com/llms.txt "Industries" list; industry pages for gaming, crypto, money remittance; D/requirements-per-industry. See [Classification](#classification-and-documented-sectors)                                                                                                                                                                                                                                                                |
| 7   | Regional/regulatory limits       | yes    | Regulatory disclosure: Dlocal Ltd authorised by the MFSA (Malta) as EMI and PI, "currently operates under its Payments Institution authorisation"; Dlocal Corp LLP registered with FinCEN as an MSB; Dlocal OpCo UK Ltd authorised by the FCA as an Authorised Payment Institution. Docs: India cross-border (PACB) data rules (R/create-payment), Pix only in Brazil, Mobile Money in eight countries, Brazilian benefit cards limited by business type |
| 8   | Diagnostic value                 | yes    | 330 documented code values: payment rejection codes, HTTP error codes per family, refund, chargeback and payout statuses, payout rejection codes, network reason codes, Mastercard advice codes; documented notification retries and signatures                                                                                                                                                                                                          |
| 9   | Own technical formats            | yes    | dLocal-specific JSON (`payment_method_flow`, `status_detail`, `order_refund_id`, `chargeback_stage`, `currency_to_pay`), ID shapes (`D-4-...`, `PO-...`), signature scheme `V2-HMAC-SHA256`. Not a resale of a gateway PandaPayLens supports                                                                                                                                                                                                             |
| 10  | No credentials needed to analyse | yes    | All examples and tables are public. Signatures need the merchant secret key, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                                                                       |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                           | Evidence                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`               | Card payments with raw card data, Smart Fields tokens or saved `card_id`; authorization, capture, cancellation, $0 verification, 3DS (D/card-payments, D/authorization-and-capture, D/3d-secure)                                                                                                                                                                      |
| `alternative_payment_method`    | Payment method types `TICKET` (cash vouchers such as OXXO and Boleto, also Pix), `BANK_TRANSFER`, wallets, Mobile Money, virtual accounts (D/make-payment, D/cash-payments, D/bank-transfer-payment, D/pix-payments, D/mobile-money-payments)                                                                                                                         |
| `merchant_account_intermediary` | Regulatory disclosure: Dlocal Corp LLP "collects payments from client users' based in Emerging Markets, on behalf of the merchants". The documented Boleto example names `DLOCAL BRASIL LTDA` as `company_name`; the Argentine transfer example names `Dlocal Argentina S.A.` as `beneficiary_name`. The website also advertises a Merchant of Record offer ("dMoRe") |
| `acquiring`                     | Unclear. The docs mention an acquirer as a separate party (rejection 321 "error in acquirer", HTTP 5021, chargeback `processor_id`), but no page read says dLocal is itself an acquirer                                                                                                                                                                               |
| Not claimed                     | `gateway` (no page read describes dLocal as a gateway to acquirers chosen by the merchant), `payment_facilitator`, `wallet` (dLocal accepts third-party wallets), `orchestration` (the `X-Dlocal-Payment-Source` header exists "Only for Payment Orchestrators, PSPs & Gateways" that are dLocal clients)                                                             |

Payouts (disbursements to bank accounts, wallets, cards and Pix keys) are a separate product with its own API; none of the classification values above describes them directly.

Sectors, in dLocal's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                                                | Source and wording                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digital and subscriptions, SaaS, streaming, eLearning | www.dlocal.com/llms.txt describes its industries hub as covering digital and subscriptions, eLearning, gaming, SaaS and streaming, with a page for each. D/requirements-per-industry has a "Subscriptions" section                                             |
| Gaming (video games)                                  | https://www.dlocal.com/industries/gaming-subvertical/: "new players are joining through mobile, PC, and console titles"; "game publishers converting players in emerging markets" (llms.txt). Gambling or betting is not mentioned                             |
| Crypto and stablecoins                                | https://www.dlocal.com/our-industries-v2/crypto-industry/: "exchanges, wallets, remittance apps, Web3 platforms, and stablecoin-powered businesses"                                                                                                            |
| Money remittance, financial services, payroll and HR  | https://www.dlocal.com/our-industries/money-remittance-industry/: "a payments layer for remittance providers, banks, and money transfer fintechs"; llms.txt lists financial services and payroll and HR pages                                                  |
| Marketplaces, retail, delivery, ride-hailing          | llms.txt industry list; D/requirements-per-industry section "Marketplace, retail and delivery"; D/get-started names "marketplaces, e-commerce marketplaces, ride-hailing apps, gig economy platforms, and hospitality management systems" as platform examples |
| Travel                                                | llms.txt: travel, travel tech, travel agencies, travel aggregators and enablers, travel supply                                                                                                                                                                 |
| Digital advertising                                   | llms.txt industry list                                                                                                                                                                                                                                         |
| Wallets and account funding                           | D/requirements-per-industry: "Wallet or any industry involving account funding"; R/create-payment: beneficiary data "Required for Account funding flows (wallets, live streaming, etc)"                                                                        |

Gambling or iGaming, adult content, forex, nutraceuticals and CBD: **NOT DOCUMENTED** in the pages read.

Regional scope as dLocal states it: R/country-reference lists 64 countries with their currencies and document types (Latin America, Africa and the Middle East, Asia, including Japan and China). The website's llms.txt says "44+ countries", while the industry pages say "60+ emerging markets" (see section 10).

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                                                | Endpoint(s) / delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Format                                                                                                                                     | Relevance                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Payins API** (`X-Version: 2.1`)                     | `POST /secure_payments` (raw card data, Google Pay token), `POST /payments` (tokens, `card_id`, APMs, captures), `GET /payments/{payment_id}`, `GET /payments/{payment_id}/status`, `POST /payments/{payment_id}/cancel`, `GET /orders/{order_id}`; refunds `POST /refunds`, `GET /refunds/{refund_id}`, `GET /refunds/{refund_id}/status`, `GET /orders/refunds/{order_refund_id}`; chargebacks `GET /chargebacks/{chargeback_id}`, `GET /chargebacks/{chargeback_id}/status`, `POST /chargebacks/dispute/{chargeback_id}` | JSON request and response (`Content-Type: application/json`); errors as JSON with a 4xx or 5xx HTTP status                                 | **Primary.** One payment object shape across responses and notifications                                    |
| **Payins notifications**                              | HTTPS POST to the payment `notification_url` (or the dashboard URL); refund notifications to the refund `notification_url`; chargeback notifications to a "Merchant chargeback notification URL"                                                                                                                                                                                                                                                                                                                            | JSON body (payment, refund or chargeback object); signature in the `Authorization` header with `X-Date`                                    | **Primary**                                                                                                 |
| Callback URL POST                                     | Browser return after a `REDIRECT` flow, to `callback_url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | POST parameters `paymentId`, `status`, `date`, `signature`; the content type is **NOT DOCUMENTED**                                         | Secondary. dLocal says not to use its `status` to update the final state                                    |
| **Payouts v3**                                        | `POST /payouts/v3`, `GET /payouts/v3?payout_id=...` or `?external_id=...`, `POST /payouts/v3/cancel`, `POST /payouts/v3/release`; token from `POST /oauth/token`                                                                                                                                                                                                                                                                                                                                                            | JSON; `Authorization: Bearer ...`, `X-Version: 3.0`; notifications are JSON POSTs with the payout object                                   | **Second.** Payout object with `status`, `status_code`, `status_detail` and rejection codes                 |
| Payouts v2 (legacy)                                   | Pages reachable from D/generate-signature, not listed in `llms.txt` or the sitemap                                                                                                                                                                                                                                                                                                                                                                                                                                          | Request signed with `Payload-Signature`; notification is `application/x-www-form-urlencoded` with `cashout_id`, `status_reason`, `control` | Third. Only the status table, notification parameters and signature recipe are documented on the pages read |
| Enrollments                                           | `POST /payments` with an `enrollment` object, separate enrollment endpoints (not read)                                                                                                                                                                                                                                                                                                                                                                                                                                      | JSON with `status`, `status_code`, `status_detail` like payments                                                                           | Secondary (recurring wallets, Pix Automático)                                                               |
| dLocal for Platforms                                  | Account, bank account and transfer endpoints (not read); notifications to the account `notification_url`                                                                                                                                                                                                                                                                                                                                                                                                                    | JSON envelope with `event_type`, `account_id`, `notification_date`, `payload`; `Signature` header                                          | Out of first scope; detect separately                                                                       |
| KYC Verifications, Brazil Core Services, Smart Fields | Not read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **NOT DOCUMENTED** here                                                                                                                    | Out of scope                                                                                                |

**Recommendation: implement first** the Payins payment object and the Payins HTTP error envelope. A developer is most likely to paste either a `POST /payments` response, a `GET /payments/{id}` response or the payment notification, and all three carry the same object. The rejection code table (section 4.3) is where most diagnostic value sits. Add refunds and chargeback notifications next (they reference `payment_id`), then Payouts v3, then the Payouts v2 form-encoded notification.

### 3. Response and error formats

#### 3.1 Content type and encoding

- **Payins and Payouts v3**: JSON over HTTPS. R/api: the API "communicates using JSON for both requests and responses". Request headers for Payins: `X-Date`, `X-Login`, `X-Trans-Key`, `Content-Type: application/json`, `X-Version: 2.1`, `User-Agent`, `Authorization: V2-HMAC-SHA256, Signature: <hex>`; optional `X-Idempotency-Key` (valid 7 days, max 42 characters) and `X-Dlocal-Payment-Source`.
- **Successful and declined payments**: the `POST /payments` OpenAPI definition lists only an HTTP 200 response. Declined card payments are documented as payment objects with `status` `REJECTED` (D/network-response-data), not as error envelopes. The HTTP status of a `REJECTED` response is not stated in words.
- **Errors**: "All the errors are returned with appropriate HTTP status code, 4XX or 5XX" (R/http-errors-payments) with the body fields in 3.2.
- **Refund status endpoint**: its OpenAPI definition labels the 200 body `text/plain` although the example is JSON (section 10).
- **Payouts v2 notification**: `Content-Type: application/x-www-form-urlencoded` (R/notification-parameters-payouts).
- **Character set** of responses and notifications: **NOT DOCUMENTED**. Signature examples encode the signed string as UTF-8.
- **Dates**: payments use `2018-12-26T20:26:09.000+0000`; some examples use `2018-02-15T15:14:52-00:00`; payouts v3 use `2023-11-16T00:00:07.00Z`; Payouts v2 notifications use `YYYY-MM-DD HH:MM:SS` in GMT.

#### 3.2 Status and error fields

| Object / shape               | Status fields                                                                            | Error / reason fields                                                                                                                                                                                                                     | Notes                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment (Payins)             | `status`, `status_code` (string, for example `"300"`), `status_detail` (text)            | `status_code` 300-344 and 800 carry the rejection reason (4.3); optional `acquirer.network_response_code`, `network_response_description`, `merchant_advice_code`, `merchant_advice_description` (enabled on request, card declines only) | `status_detail` text varies in punctuation between examples, so decode by `status_code`                                                     |
| HTTP error (Payins, Payouts) | HTTP status 4xx / 5xx                                                                    | `code` (integer), `message` (string), `param` (string, "In case one parameter is wrong")                                                                                                                                                  | Same envelope for every family; the code tables differ (4.4, 4.10)                                                                          |
| Refund                       | `status` (`PENDING`, `SUCCESS`, `REJECTED`, `CANCELLED`), `status_code`, `status_detail` | No refund rejection sub-codes are documented                                                                                                                                                                                              | `status_code` is an integer in the create, retrieve and notification examples, a string in the status endpoint example and the object table |
| Chargeback                   | `status`, `status_code`, `status_detail`                                                 | `reason_code`, `reason_description`, `chargeback_stage`                                                                                                                                                                                   | `status_code` integer in the notification schema, string in the retrieve examples                                                           |
| Payout v3                    | `status`, `status_code` (string), `status_detail`, `on_hold` (boolean)                   | After a rejection, `status_code` carries the payout rejection code (4.11)                                                                                                                                                                 | `last_updated` gives the time of the last change                                                                                            |
| Payout v2 notification       | (no status field in the notification)                                                    | `status_reason` (for example `ERROR_ACCOUNT_INCORRECT`)                                                                                                                                                                                   | Full `status_reason` list **NOT DOCUMENTED**                                                                                                |
| Callback POST                | `status` (`COMPLETED`, `APPROVED`, `REJECTED`, `PENDING`)                                | none                                                                                                                                                                                                                                      | Browser-side; not final                                                                                                                     |
| Sandbox tools error          | `status` `ERROR`, `code` `0`                                                             | `message` wraps an inner error as text, for example `404 {"code":4000,...}`                                                                                                                                                               | Sandbox only (D/make-a-test-payment)                                                                                                        |

#### 3.3 Examples

Example A: declined Visa card payment with the optional `acquirer` object. **Transcribed from https://docs.dlocal.com/docs/network-response-data** ("Declined Visa payment"); `card.holder_name` omitted:

```json
{
  "id": "T-4-ab3de12f-11c4-4781-a3ea-c2e1cc5b231a",
  "amount": 10.0,
  "currency": "BRL",
  "payment_method_id": "CARD",
  "payment_method_type": "CARD",
  "payment_method_flow": "DIRECT",
  "country": "BR",
  "card": {
    "expiration_month": 6,
    "expiration_year": 2026,
    "brand": "VI",
    "last4": "1111"
  },
  "created_date": "2024-01-15T14:22:31.000+0000",
  "status": "REJECTED",
  "status_code": "302",
  "status_detail": "Insufficient amount",
  "order_id": "order-002",
  "acquirer": {
    "network_response_code": "51",
    "network_response_description": "Insufficient funds/over credit limit"
  }
}
```

Example B: Payins HTTP error. **Transcribed from https://docs.dlocal.com/reference/http-errors-payments** ("Example error"):

```json
{
  "code": 5005,
  "message": "User unauthorized due to cadastral situation"
}
```

Example C: Payouts v3 400 error with `param`. **Transcribed from https://docs.dlocal.com/reference/requesting-payout-v3** (OpenAPI example `MissingCountry`):

```json
{ "code": 3001, "message": "Empty params country", "param": "country" }
```

Example D: payment notification for a cash voucher. **Transcribed from https://docs.dlocal.com/docs/receive-notifications** ("Example Notification POST"); the `payer` object (name, `user_reference`, email) is omitted:

```json
{
  "id": "D-4-be8eda8c-5fe7-49dd-8058-4ddaac00611b",
  "amount": 72.0,
  "status": "PAID",
  "status_detail": "The payment was paid.",
  "status_code": "200",
  "currency": "USD",
  "country": "AR",
  "payment_method_id": "RP",
  "payment_method_type": "TICKET",
  "payment_method_flow": "REDIRECT",
  "order_id": "4m1OdghPUQtg",
  "notification_url": "http://www.merchant.com/notifications",
  "created_date": "2019-06-26T15:17:31.000+0000"
}
```

Example E: chargeback notification. **Transcribed from https://docs.dlocal.com/docs/chargebacks** ("Example notification (POST)"):

```json
{
  "id": "CHAR42342",
  "payment_id": "PAY245235",
  "created_date": "2025-10-21T17:38:57.000+0000",
  "currency": "UYU",
  "amount": 1000,
  "status": "PENDING",
  "status_code": 100,
  "status_detail": "The chargeback is pending.",
  "notification_url": "http://merchant.com/notifications",
  "order_id": "1122334455667788",
  "chargeback_date": "2025-10-21T17:38:57.000+0000",
  "chargeback_stage": "OTHER",
  "processor_id": "156",
  "reason_code": "10.4",
  "reason_description": "Other Fraud: Card-absent Environment/Condition.",
  "arn": "74049384186711978854903"
}
```

Example F: Payouts v2 notification (legacy, form-encoded). **Transcribed from https://docs.dlocal.com/reference/notification-parameters-payouts** ("Example"):

```text
Content-Type: application/x-www-form-urlencoded
external_id=ext123
cashout_id=123456
date=2021-04-29 02:16:24
bank_reference_id=ref321
comments=Merchant
status_reason=ERROR_ACCOUNT_INCORRECT
control=FOR59E6E3F1353305181E1DCA204157FF47D1F014F4FB603EF4
```

Other documented examples worth using as test shapes: the 3DS pending payment with `three_dsecure.redirect_url` (D/3d-secure), the capture response with `authorization_id` (D/authorization-and-capture), the direct Boleto and Pix responses with a `ticket` object (D/cash-payments, D/pix-payments), the refund notification (D/refunds), the ARN notifications with `type` (D/acquirer-reference-number) and the Payouts v3 notification (R/notification-parameters-payouts-v3; it contains full beneficiary and remitter data).

### 4. Codes

Code values are exactly as documented. "Meaning" is a short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not dLocal statements; where dLocal gives advice (for example code 5052 "Retry later" or the Mastercard advice codes), it is reflected.

**Code spaces overlap.** Status codes, rejection codes and HTTP error codes reuse numbers with different meanings across objects and API families (section 10, item 1). A decoder must key on the object type (payment, refund, chargeback, payout v3, payout v2, enrollment) and, for HTTP errors, on the API family. Never decode a bare number.

#### 4.1 Payment statuses (R/payment-status-codes): 6 values

| `status`     | `status_code` | Meaning (paraphrase)                                  | Suggested timeline state |
| ------------ | ------------- | ----------------------------------------------------- | ------------------------ |
| `PENDING`    | `100`         | Payment created, outcome not known yet                | pending                  |
| `PAID`       | `200`         | Payment completed and paid                            | succeeded                |
| `REJECTED`   | `300`         | Payment rejected (sub-codes in 4.3)                   | failed                   |
| `CANCELLED`  | `400`         | Payment cancelled (pending APM or authorization)      | cancelled                |
| `AUTHORIZED` | `600`         | Card amount authorized, waiting for capture           | authorized               |
| `VERIFIED`   | `700`         | Card verified with a $0 authorization; no money moved | verified                 |

#### 4.2 Payment pending sub-codes (R/payment-status-codes): 3 values

| `status_code` | Meaning (paraphrase)                                                                             | Category (suggested)    | Retry class (suggested)                                         |
| ------------- | ------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------- |
| `100`         | Pending without further detail (voucher not paid yet, transfer not received)                     | unknown                 | retry_conditionally (wait for the notification or query status) |
| `101`         | Pending 3D Secure authentication; the payer must be sent to `three_dsecure.redirect_url`         | authentication_required | customer_action_required                                        |
| `102`         | Pending and can be retried (the retry object for Pix Automático appears in R/retrieve-a-payment) | unknown                 | retry_conditionally                                             |

#### 4.3 Payment rejection codes (`status` `REJECTED`, R/payment-status-codes): 39 values

| `status_code` | Meaning (paraphrase)                                | Category (suggested)       | Retry class (suggested)  |
| ------------- | --------------------------------------------------- | -------------------------- | ------------------------ |
| `300`         | Rejected, no specific reason                        | card_declined              | retry_conditionally      |
| `301`         | Declined by the issuing bank                        | card_declined              | retry_conditionally      |
| `302`         | Not enough funds                                    | insufficient_funds         | customer_action_required |
| `303`         | Card is on a block list                             | fraud_or_risk              | do_not_retry             |
| `304`         | Failed risk score validation                        | fraud_or_risk              | manual_review            |
| `305`         | Maximum number of attempts reached                  | rate_limiting              | do_not_retry             |
| `306`         | Issuer asks the payer to call the bank to authorize | card_declined              | customer_action_required |
| `307`         | Duplicate payment                                   | duplicate_request          | do_not_retry             |
| `308`         | Card disabled                                       | card_declined              | customer_action_required |
| `309`         | Card expired                                        | card_declined              | customer_action_required |
| `310`         | Card reported lost                                  | fraud_or_risk              | do_not_retry             |
| `311`         | Bank asks for the card to be retained               | fraud_or_risk              | do_not_retry             |
| `312`         | Card restricted by the bank                         | card_declined              | customer_action_required |
| `313`         | Card reported stolen                                | fraud_or_risk              | do_not_retry             |
| `314`         | Card number invalid                                 | invalid_request            | customer_action_required |
| `315`         | Security code (CVV) invalid                         | invalid_request            | customer_action_required |
| `316`         | Operation not supported                             | payment_method_unavailable | do_not_retry             |
| `317`         | Rejected as high risk                               | fraud_or_risk              | do_not_retry             |
| `318`         | Transaction invalid                                 | invalid_request            | do_not_retry             |
| `319`         | Amount above an allowed limit                       | invalid_amount             | customer_action_required |
| `320`         | 3D Secure authentication is required                | authentication_required    | customer_action_required |
| `321`         | Error at the acquirer                               | provider_unavailable       | retry_conditionally      |
| `322`         | Wallet disabled                                     | payment_method_unavailable | customer_action_required |
| `323`         | Payer's user account invalid                        | invalid_request            | customer_action_required |
| `324`         | PIN invalid                                         | authentication_failed      | customer_action_required |
| `325`         | Too many transactions in a period                   | rate_limiting              | retry_conditionally      |
| `326`         | Payer's user account disabled or expired            | payment_method_unavailable | customer_action_required |
| `327`         | Error in an external network                        | network_or_timeout         | retry_conditionally      |
| `328`         | Payer token invalid                                 | invalid_request            | do_not_retry             |
| `329`         | Authorization expired                               | invalid_request            | do_not_retry             |
| `330`         | Card not enrolled for 3DS                           | authentication_failed      | customer_action_required |
| `331`         | Payer cancelled the payment                         | unknown                    | customer_action_required |
| `332`         | Wallet on hold                                      | payment_method_unavailable | customer_action_required |
| `340`         | Payment expired (for example an unpaid voucher)     | unknown                    | customer_action_required |
| `341`         | Payer did not complete the 3DS challenge            | authentication_failed      | customer_action_required |
| `342`         | Document (tax ID) invalid                           | invalid_request            | customer_action_required |
| `343`         | `payer.name` does not match the bank's records      | invalid_request            | customer_action_required |
| `344`         | Payer limit exceeded                                | invalid_amount             | customer_action_required |
| `800`         | Payment creation failed                             | provider_unavailable       | retry_conditionally      |

The meaning of the raw ISO 8583 `acquirer.network_response_code` values (examples `05`, `51`, `N7`) is not listed by dLocal; D/network-response-data says the full mapping to dLocal status codes is on R/payment-status-codes, but that page has no such mapping (section 10).

#### 4.4 Payins HTTP error codes (R/http-errors-payments 34 rows, R/http-errors-refunds 23 rows, R/http-errors-cards 9 rows)

Columns P, R and C mark which page lists the code (payments, refunds, saved cards). Where the meaning differs between pages, both are given.

| `code` | HTTP | P   | R   | C   | Meaning (paraphrase)                                                                  | Category (suggested)                | Retry class (suggested)                                           |
| ------ | ---- | --- | --- | --- | ------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `3001` | 403  | x   | x   | x   | Credentials invalid                                                                   | configuration                       | do_not_retry                                                      |
| `3002` | 403  | x   | x   | x   | Calling IP address not registered                                                     | configuration                       | do_not_retry                                                      |
| `3003` | 403  | x   | x   | x   | Merchant not authorized to use this API                                               | configuration                       | do_not_retry                                                      |
| `4000` | 404  | x   | x   |     | Payment not found (refunds page: wrong `payment_id` or outside the retrievable range) | invalid_request                     | do_not_retry                                                      |
| `4001` | 404  |     | x   |     | Refund not found                                                                      | invalid_request                     | do_not_retry                                                      |
| `5000` | 400  | x   | x   | x   | Request invalid                                                                       | invalid_request                     | do_not_retry                                                      |
| `5001` | 400  | x   | x   | x   | Parameter missing (payments) or invalid (refunds, cards); the name is in the message  | invalid_request                     | do_not_retry                                                      |
| `5002` | 400  | x   | x   |     | Transaction status does not allow the operation                                       | invalid_request                     | do_not_retry                                                      |
| `5003` | 400  | x   | x   | x   | Country not supported                                                                 | invalid_request                     | do_not_retry                                                      |
| `5004` | 400  | x   |     |     | Currency not allowed for the country                                                  | invalid_request                     | do_not_retry                                                      |
| `5005` | 400  | x   |     | x   | Payer not authorized because of the registration status of their document (tax ID)    | invalid_request                     | customer_action_required                                          |
| `5006` | 400  | x   |     |     | Payer limit exceeded                                                                  | invalid_amount                      | customer_action_required                                          |
| `5007` | 400  | x   | x   |     | Amount exceeded                                                                       | invalid_amount                      | do_not_retry                                                      |
| `5008` | 400  | x   |     | x   | Token not found or inactive                                                           | invalid_request                     | do_not_retry                                                      |
| `5009` | 400  | x   |     |     | `order_id` already used                                                               | duplicate_request                   | do_not_retry                                                      |
| `5010` | 400  | x   |     |     | Payment method not available                                                          | payment_method_unavailable          | do_not_retry                                                      |
| `5010` | 504  | x   | x   |     | Request timed out (same code, different HTTP status)                                  | network_or_timeout                  | retry_conditionally (query status first; use `X-Idempotency-Key`) |
| `5011` | 400  | x   | x   |     | Payments: enrollment not found. Refunds: `order_refund_id` already used               | invalid_request / duplicate_request | do_not_retry                                                      |
| `5012` | 400  |     | x   |     | Insufficient funds for the refund                                                     | insufficient_funds                  | manual_review                                                     |
| `5013` | 400  | x   | x   |     | Operation not supported                                                               | invalid_request                     | do_not_retry                                                      |
| `5014` | 400  | x   |     |     | Payer on a block list                                                                 | fraud_or_risk                       | do_not_retry                                                      |
| `5015` | 400  |     |     | x   | Card rejected by the bank when saving it                                              | card_declined                       | customer_action_required                                          |
| `5016` | 400  | x   | x   |     | Amount too low                                                                        | invalid_amount                      | do_not_retry                                                      |
| `5017` | 400  | x   |     |     | API version invalid                                                                   | configuration                       | do_not_retry                                                      |
| `5018` | 400  | x   | x   |     | A chargeback exists for this transaction                                              | invalid_request                     | manual_review                                                     |
| `5020` | 400  |     | x   |     | Refund window has passed                                                              | invalid_request                     | do_not_retry                                                      |
| `5021` | 400  | x   | x   |     | Acquirer could not process the request                                                | provider_unavailable                | retry_conditionally                                               |
| `5022` | 400  |     | x   |     | `order_refund_id` longer than 100 characters                                          | invalid_request                     | do_not_retry                                                      |
| `5023` | 400  | x   | x   |     | Payments: account invalid or not approved. Refunds: email in the order not supported  | configuration / invalid_request     | do_not_retry                                                      |
| `5043` | 400  | x   |     |     | Number of installments invalid                                                        | invalid_request                     | do_not_retry                                                      |
| `5044` | 400  | x   |     |     | Payment cancellation failed                                                           | unknown                             | manual_review                                                     |
| `5045` | 400  | x   |     |     | Enrollment not active                                                                 | invalid_request                     | customer_action_required                                          |
| `5046` | 400  | x   |     |     | External ID already used                                                              | duplicate_request                   | do_not_retry                                                      |
| `5049` | 400  | x   |     |     | Seller configuration invalid                                                          | configuration                       | do_not_retry                                                      |
| `5050` | 400  | x   | x   |     | Payments: cancellation period exceeded. Refunds: a field is longer than allowed       | invalid_request                     | do_not_retry                                                      |
| `5051` | 400  | x   |     |     | Account restrictions prevent processing                                               | configuration                       | manual_review                                                     |
| `5052` | 400  | x   |     |     | Another operation on this payment is in progress; dLocal says to retry later          | duplicate_request                   | safe_to_retry_technical_request                                   |
| `6000` | 429  | x   | x   |     | Too many requests                                                                     | rate_limiting                       | safe_to_retry_technical_request                                   |
| `7000` | 500  | x   | x   |     | Request could not be processed                                                        | provider_unavailable                | retry_conditionally                                               |

#### 4.5 Refund statuses (R/refund-status-codes): 4 values

| `status`    | `status_code` | Meaning (paraphrase)           | Suggested timeline state |
| ----------- | ------------- | ------------------------------ | ------------------------ |
| `PENDING`   | 100           | Refund not confirmed yet       | refund_pending           |
| `SUCCESS`   | 200           | Refund paid                    | refunded                 |
| `REJECTED`  | 300           | Refund rejected (no sub-codes) | refund_failed            |
| `CANCELLED` | 400           | Refund cancelled               | refund_cancelled         |

#### 4.6 Chargeback statuses (R/chargeback-status): 7 values

| `status`           | `status_code` | Meaning (paraphrase)                                  | Suggested timeline state |
| ------------------ | ------------- | ----------------------------------------------------- | ------------------------ |
| `PENDING`          | 100           | Chargeback received, not disputed yet                 | dispute_open             |
| `DISPUTE_RECEIVED` | 101           | Merchant's dispute documents received by dLocal       | dispute_evidence_sent    |
| `COMPLETED`        | 200           | Chargeback executed (funds debited for good)          | dispute_lost             |
| `IN_DISPUTE`       | 201           | Documents sent on to the acquirer                     | dispute_under_review     |
| `DISPUTE_LOST`     | 202           | Dispute decided for the cardholder                    | dispute_lost             |
| `REVERSAL`         | 700           | Dispute decided for the merchant; funds credited back | dispute_won              |
| `INQUIRY`          | 800           | Issuer asked for information; no funds moved yet      | dispute_inquiry          |

Retry class for every chargeback status: manual_review (suggested).

#### 4.7 Dispute upload results (D/chargebacks, "Response codes"): 5 values

| `status`    | Code  | Meaning (paraphrase)                                                          | Category (suggested) | Retry class (suggested)  |
| ----------- | ----- | ----------------------------------------------------------------------------- | -------------------- | ------------------------ |
| `SUCCESS`   | `200` | Documents received                                                            | n/a                  | n/a                      |
| `REJECTED`  | `300` | No longer disputable (not `PENDING` or `INQUIRY`, or the due date has passed) | invalid_request      | do_not_retry             |
| `REJECTED`  | `301` | File larger than 1 MB                                                         | invalid_request      | customer_action_required |
| `REJECTED`  | `302` | File is not a valid PDF                                                       | invalid_request      | customer_action_required |
| `NOT FOUND` | `404` | Chargeback not found                                                          | invalid_request      | do_not_retry             |

#### 4.8 Chargeback reason codes (`reason_code`, D/chargeback-categories): 107 distinct codes

dLocal lists the network or domestic reason codes it passes on, grouped in its own categories; the page says these "categories are informational and not returned in dispute responses". Each table also has a `None` / "Unrecognized" row, not counted. Codes are listed here with a short paraphrase per group; suggested PandaPayLens category: `fraud_or_risk` for fraud groups, `unknown` for the rest; retry class for all: manual_review (suggestions).

| Network           | dLocal category                   | Codes and short meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mexico (domestic) | Authorization issues              | `71` declined authorization, `72` above authorized amount, `75` authorization missing                                                                                                                                                                                                                                                                                                                                                                                                        |
| Mexico (domestic) | Documentation and process errors  | `60` wrong or unreadable document, `74` late submission, `79` promissory note missing, `84` signature missing, `92` irregular activity, `RT` promissory note requested                                                                                                                                                                                                                                                                                                                       |
| Mexico (domestic) | Fraud and unauthorized            | `57` several unauthorized charges, `68` remote fraud, `70` card reported                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Mexico (domestic) | Miscellaneous                     | `63` chip transaction, `76` toll charges                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Mexico (domestic) | Refunds and cancellations         | `41` cancelled recurring charge, `85` refund not processed, `94` reservation cancelled                                                                                                                                                                                                                                                                                                                                                                                                       |
| Mexico (domestic) | Transaction and processing errors | `64` manual transaction, `80` processing error, `82` duplicate processing, `86` amount altered                                                                                                                                                                                                                                                                                                                                                                                               |
| Visa              | Fraud                             | `10.1` EMV counterfeit liability shift, `10.2` EMV non-counterfeit liability shift, `10.3` other fraud card present, `10.4` other fraud card absent, `10.5` Visa fraud monitoring program                                                                                                                                                                                                                                                                                                    |
| Visa              | Authorization                     | `11.1` card recovery bulletin, `11.2` declined authorization, `11.3` no authorization                                                                                                                                                                                                                                                                                                                                                                                                        |
| Visa              | Processing errors                 | `12.1` late presentment, `12.2` wrong transaction code, `12.3` wrong currency, `12.4` wrong account number, `12.5` wrong amount, `12.6.1` duplicate, `12.6.2` paid by other means, `12.7` invalid data                                                                                                                                                                                                                                                                                       |
| Visa              | Customer disputes                 | `13.1` not received, `13.2` cancelled recurring, `13.3` not as described or defective, `13.4` counterfeit goods, `13.5` misrepresentation, `13.6` credit not processed, `13.7` cancelled goods or services, `13.8` original credit not accepted, `13.9` cash or load value not received                                                                                                                                                                                                      |
| Mastercard        | Authorization-related             | `4808` (six listed variants, for example warning bulletin, required authorization missing, multiple authorization requests), `4834` (cardholder-activated terminal, late presentment)                                                                                                                                                                                                                                                                                                        |
| Mastercard        | Point of interaction error        | `4834` (amount differs, currency conversion, duplicate or paid by other means, ATM)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Mastercard        | Loss, theft or damages            | `4837` no cardholder authorization (fraud), `4849` no cardholder authorization, `4870` questionable merchant activity, `4871` chip or chip and PIN liability shift                                                                                                                                                                                                                                                                                                                           |
| Mastercard        | Cardholder disputes               | `4853` (ten listed variants, for example recurring, not provided, not as described, credit not processed, digital goods of 25 USD or less), `4850` installment billing, `4854` not classified elsewhere (US)                                                                                                                                                                                                                                                                                 |
| Mastercard        | Legacy codes                      | `4807` warning bulletin, `4812` account number not on file, `4859` no-show, addendum or ATM, `4860` credit not processed                                                                                                                                                                                                                                                                                                                                                                     |
| Elo               | (one category per code)           | `75` not recognized, `83` card-absent fraud, `30` not received, `41` recurring after cancellation, `53` not as described, `74` late submission, `77` invalid account number, `80` terminal processing error, `82` duplicate, `85` credit not processed                                                                                                                                                                                                                                       |
| Verve             | Chargeback                        | `AA` not recognized, `AP` recurring after cancellation, `AT` declined or missing authorization or expired card, `AW` altered amount or wrong cash dispensed, `DCC` pre-arbitration disputes, `IN` invalid card number, `LP` late submission, `NF` ATM did not dispense, `PM` paid by other means, `RG` not received, `TM` automatic dispute for missing confirmation, `UA01` card-present fraud, `UA02` card-not-present fraud, `UA05` counterfeit chip fraud, `UA06` stolen card chip fraud |
| American Express  | Authorization                     | `4521` invalid authorization, `4755` no valid authorization                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| American Express  | Consumer disputes                 | `4513` credit not presented, `4515` paid by other means, `4544` cancelled recurring, `4553` not as described or defective, `4554` not received, `4750` car rental charge not qualified                                                                                                                                                                                                                                                                                                       |
| American Express  | Fraud                             | `4527` missing imprint, `4534` multiple records of charge, `4540` card not present, `4763` full recourse, `4798` counterfeit liability shift, `4799` lost, stolen or non-received liability shift                                                                                                                                                                                                                                                                                            |
| American Express  | Processing errors                 | `4507` wrong amount or account number, `4512` multiple processing, `4523` unassigned account number, `4530` currency discrepancy, `4536` late presentment, `4752` credit or debit presentment error                                                                                                                                                                                                                                                                                          |
| American Express  | Inquiry / miscellaneous           | `4516` support request not fulfilled, `4517` support request illegible or incomplete, `4754` local regulatory or legal dispute                                                                                                                                                                                                                                                                                                                                                               |

Counts: Mexico 21, Visa 25, Mastercard 13 distinct (33 rows), Elo 10, Verve 15, American Express 23. The Elo code `41`, `74`, `80`, `82`, `85` and Mexico codes with the same numbers have different networks, so `reason_code` must be read together with the card brand. Neither the chargeback notification nor the chargeback object carries the network or card brand; the brand is on the related payment's `card.brand`.

#### 4.9 Callback URL statuses (D/configure-callback-url): 4 values

| `status`    | Meaning (paraphrase)                                           | Use                                     |
| ----------- | -------------------------------------------------------------- | --------------------------------------- |
| `COMPLETED` | Cards with 3DS only: authentication done, card not charged yet | Not final; query the payment            |
| `APPROVED`  | Payment approved                                               | Not final per dLocal; query the payment |
| `REJECTED`  | Payment rejected                                               | Not final per dLocal; query the payment |
| `PENDING`   | Still waiting for confirmation                                 | Not final                               |

These words differ from the payment statuses (`APPROVED` vs `PAID`), which helps tell a callback POST from a payment object.

#### 4.10 Payouts v3 error codes (R/error-codes-payouts-v3): 17 values

dLocal groups them by range: 3xxx parameter syntax, 4xxx merchant identification, 5xxx business rules, 7xxx transactional.

| `code` | HTTP (as documented)    | Meaning (paraphrase)                                                | Category (suggested) | Retry class (suggested)  |
| ------ | ----------------------- | ------------------------------------------------------------------- | -------------------- | ------------------------ |
| `3000` | 400                     | Parameter invalid; name and reason in the message                   | invalid_request      | do_not_retry             |
| `3001` | 400                     | Parameter empty; name in the message                                | invalid_request      | do_not_retry             |
| `3003` | 400                     | Bank code invalid                                                   | invalid_request      | customer_action_required |
| `4001` | 403                     | Credentials invalid (also for an expired bearer token)              | configuration        | do_not_retry             |
| `4002` | 403                     | Calling IP address not registered                                   | configuration        | do_not_retry             |
| `5007` | 400                     | Country not available for payouts                                   | configuration        | do_not_retry             |
| `5008` | 400                     | A limit was exceeded; limit name in the message                     | invalid_amount       | manual_review            |
| `5009` | 404                     | Payout not found                                                    | invalid_request      | do_not_retry             |
| `5010` | 400                     | Payout status does not allow the action (not pending / not on hold) | invalid_request      | do_not_retry             |
| `5011` | 400                     | `external_id` already used                                          | duplicate_request    | do_not_retry             |
| `5012` | 400                     | Rejected by compliance limits                                       | fraud_or_risk        | manual_review            |
| `5013` | 400                     | Beneficiary on a block list                                         | fraud_or_risk        | do_not_retry             |
| `5014` | 400 (403 in an example) | Merchant balance too low                                            | insufficient_funds   | manual_review            |
| `5015` | 400                     | Rejected for compliance reasons                                     | fraud_or_risk        | manual_review            |
| `7002` | 400                     | Payout could not be cancelled                                       | unknown              | manual_review            |
| `7003` | 500                     | Request could not be processed                                      | provider_unavailable | retry_conditionally      |
| `7004` | 400                     | Payout could not be released because of compliance                  | fraud_or_risk        | manual_review            |

#### 4.11 Payouts v3 rejection codes (`status_code` after `REJECTED`, R/error-codes-payouts-v3): 21 values

"When a payout is rejected post its creation, the rejection code will be displayed at field `status_code`" in Get payout and in the notification.

| `status_code` | Meaning (paraphrase)                                    | Category (suggested)       | Retry class (suggested)  |
| ------------- | ------------------------------------------------------- | -------------------------- | ------------------------ |
| `301`         | Beneficiary account closed                              | invalid_request            | customer_action_required |
| `302`         | Amount wrong or not valid for the account               | invalid_amount             | customer_action_required |
| `303`         | Bank code invalid or not supported                      | invalid_request            | customer_action_required |
| `304`         | Bank branch wrong                                       | invalid_request            | customer_action_required |
| `305`         | Beneficiary document invalid                            | invalid_request            | customer_action_required |
| `306`         | Beneficiary name wrong or mismatched                    | invalid_request            | customer_action_required |
| `307`         | Rejected by the beneficiary's bank                      | payment_method_unavailable | manual_review            |
| `308`         | Other or unspecified reason                             | unknown                    | manual_review            |
| `309`         | Account type wrong for the transaction                  | invalid_request            | customer_action_required |
| `310`         | Account does not match the beneficiary document         | invalid_request            | customer_action_required |
| `311`         | Account does not match the beneficiary name             | invalid_request            | customer_action_required |
| `312`         | Account cannot receive transfers                        | payment_method_unavailable | customer_action_required |
| `313`         | Beneficiary document does not match the name            | invalid_request            | customer_action_required |
| `314`         | Account is in another currency                          | invalid_request            | customer_action_required |
| `315`         | Rejected for compliance reasons                         | fraud_or_risk              | manual_review            |
| `316`         | Beneficiary not allowed to receive payouts (compliance) | fraud_or_risk              | do_not_retry             |
| `317`         | Rejected after approval                                 | unknown                    | manual_review            |
| `318`         | Wallet key missing                                      | invalid_request            | customer_action_required |
| `319`         | Wallet key wrong                                        | invalid_request            | customer_action_required |
| `320`         | Account number wrong                                    | invalid_request            | customer_action_required |
| `332`         | External payment network temporarily unavailable        | provider_unavailable       | retry_conditionally      |

#### 4.12 Payout statuses: v3 (R/payout-status-v3) 7 values, v2 (R/payout-status) 6 values

| Version | `status`                | `status_code` | Meaning (paraphrase)                                  | Suggested timeline state |
| ------- | ----------------------- | ------------- | ----------------------------------------------------- | ------------------------ |
| v3      | `PENDING`               | 100           | Received, waiting to be processed                     | payout_pending           |
| v3      | `PAID`                  | 200           | Paid                                                  | payout_paid              |
| v3      | `REJECTED`              | 300           | Rejected (sub-codes in 4.11)                          | payout_failed            |
| v3      | `CANCELLED`             | 400           | Cancelled by the merchant                             | payout_cancelled         |
| v3      | `DELIVERED`             | 500           | Being processed (sent on)                             | payout_in_transit        |
| v3      | `ON_HOLD`               | 600           | Held by the merchant                                  | payout_on_hold           |
| v3      | `ON_HOLD_BY_COMPLIANCE` | 700           | Waiting for compliance checks                         | payout_on_hold           |
| v2      | `RECEIVED`              | 0             | Received; processed at the next cut-off               | payout_pending           |
| v2      | `COMPLETED`             | 1             | Completed and confirmed by the beneficiary's bank     | payout_paid              |
| v2      | `CANCELLED`             | 2             | Cancelled by the merchant                             | payout_cancelled         |
| v2      | `REJECTED`              | 3             | Rejected by the bank                                  | payout_failed            |
| v2      | `DELIVERED`             | 4             | Delivered to the beneficiary's bank, being processed  | payout_in_transit        |
| v2      | `ON HOLD`               | 5             | Held by the merchant or waiting for legal information | payout_on_hold           |

The v3 sandbox also documents a simulated `status` `BAD_REQUEST` with `status_code` `3000` (R/environments-payouts-v3), which is not in the status table.

#### 4.13 Account validation errors (R/account-validation-errors): 11 values

| `code` | Meaning (paraphrase)                    | Category (suggested) | Retry class (suggested)  |
| ------ | --------------------------------------- | -------------------- | ------------------------ |
| `1006` | Country invalid                         | invalid_request      | do_not_retry             |
| `1007` | Validation process failed with an error | provider_unavailable | retry_conditionally      |
| `1011` | Validation unsuccessful                 | unknown              | manual_review            |
| `1012` | Bank branch invalid                     | invalid_request      | customer_action_required |
| `1013` | Account format invalid                  | invalid_request      | customer_action_required |
| `1014` | Bank account invalid                    | invalid_request      | customer_action_required |
| `1015` | Bank code invalid                       | invalid_request      | customer_action_required |
| `1016` | Account type invalid                    | invalid_request      | customer_action_required |
| `1017` | Wallet ID (phone or email) invalid      | invalid_request      | customer_action_required |
| `1018` | Document invalid                        | invalid_request      | customer_action_required |
| `1019` | Document type invalid                   | invalid_request      | customer_action_required |

#### 4.14 Enrollment statuses and rejection codes (R/enrollment-status-codes): 5 + 12 values

| `status`    | `status_code` | Meaning (paraphrase)                                                |
| ----------- | ------------- | ------------------------------------------------------------------- |
| `PENDING`   | 100           | Waiting for the user's authorization, or a cancellation in progress |
| `ACTIVE`    | 200           | Ready for recurring payments                                        |
| `REJECTED`  | 300           | Not authorized or rejected (sub-codes below)                        |
| `CANCELLED` | 400           | Cancelled                                                           |
| `CANCELLED` | 401           | Cancelled by the user                                               |

| `status_code` | Meaning (paraphrase)                      | Category (suggested)       | Retry class (suggested)  |
| ------------- | ----------------------------------------- | -------------------------- | ------------------------ |
| `300`         | Rejected, no specific reason              | unknown                    | manual_review            |
| `301`         | User cancelled                            | unknown                    | customer_action_required |
| `302`         | User account not found                    | invalid_request            | customer_action_required |
| `303`         | User account inactive or blocked          | payment_method_unavailable | customer_action_required |
| `304`         | User not eligible                         | payment_method_unavailable | do_not_retry             |
| `305`         | Account data invalid                      | invalid_request            | customer_action_required |
| `306`         | Duplicate enrollment                      | duplicate_request          | do_not_retry             |
| `307`         | Rejected as high risk                     | fraud_or_risk              | do_not_retry             |
| `308`         | Enrollment expired                        | unknown                    | customer_action_required |
| `309`         | Rejected by the payment provider          | payment_method_unavailable | manual_review            |
| `310`         | Provider unavailable                      | provider_unavailable       | retry_conditionally      |
| `311`         | Maximum amount above the provider's limit | invalid_amount             | do_not_retry             |

#### 4.15 Mastercard merchant advice codes (`acquirer.merchant_advice_code`, D/network-response-data): 11 values

dLocal states that, when present, the advice code takes precedence over the network response code for retry decisions.

| Code | Meaning (paraphrase)                           | dLocal type | Category (suggested) | Retry class (suggested)  |
| ---- | ---------------------------------------------- | ----------- | -------------------- | ------------------------ |
| `01` | Card details must be updated before retrying   | Soft        | card_declined        | customer_action_required |
| `02` | Retry after a short delay                      | Soft        | card_declined        | retry_conditionally      |
| `03` | Do not retry                                   | Hard        | card_declined        | do_not_retry             |
| `21` | Cardholder revoked the recurring authorization | Hard        | card_declined        | do_not_retry             |
| `24` | Retry after at least 1 hour                    | Timed       | card_declined        | retry_conditionally      |
| `25` | Retry after at least 24 hours                  | Timed       | card_declined        | retry_conditionally      |
| `26` | Retry after at least 2 days                    | Timed       | card_declined        | retry_conditionally      |
| `27` | Retry after at least 4 days                    | Timed       | card_declined        | retry_conditionally      |
| `28` | Retry after at least 6 days                    | Timed       | card_declined        | retry_conditionally      |
| `29` | Retry after at least 8 days                    | Timed       | card_declined        | retry_conditionally      |
| `30` | Retry after at least 10 days                   | Timed       | card_declined        | retry_conditionally      |

The same page summarises scheme retry limits (Visa: no retry for hard declines, up to 15 attempts over 30 days for the other categories; Mastercard without an advice code: at most 15 retries in 30 days).

#### 4.16 Value sets (not counted)

- ECI by `card.brand` (`VI`/`VD` 05-07, `MC`/`MD`/`MS` 00-02, `EL`, `AE`, `DI` 05-07) with the liability-shift meaning (D/3d-secure).
- `three_dsecure.enrollment_response` `Y`/`N`/`U` and `authentication_response` `Y`/`A`/`N`/`U` (R/3d-secure-object).
- `card.account_updater_status` `NO_CHANGE`, `UPDATED`, `PREVIOUSLY_UPDATED` (R/create-payment).
- Payment method `type` `CARD`, `BANK_TRANSFER`, `DIRECT_DEBIT`, `TICKET` (R/payment-method-object); guides also use `WALLET`. Flows `DIRECT`, `REDIRECT`.
- Ticket `type` `NUMERIC`, `BARCODE`, `CUSTOM`, `REFERENCE_CODE` (R/the-ticket-object).
- ARN notification `type` `PAYMENT`, `REFUND`, `CHARGEBACK` (D/acquirer-reference-number).

#### 4.17 Count summary

| Table                                  | Values                                               |
| -------------------------------------- | ---------------------------------------------------- |
| 4.1 payment statuses                   | 6                                                    |
| 4.2 payment pending sub-codes          | 3                                                    |
| 4.3 payment rejection codes            | 39                                                   |
| 4.4 Payins payment HTTP errors         | 33 distinct (34 rows)                                |
| 4.4 Payins refund HTTP errors          | 23                                                   |
| 4.4 Payins saved-card HTTP errors      | 9                                                    |
| 4.5 refund statuses                    | 4                                                    |
| 4.6 chargeback statuses                | 7                                                    |
| 4.7 dispute upload results             | 5                                                    |
| 4.8 chargeback reason codes            | 107                                                  |
| 4.9 callback statuses                  | 4                                                    |
| 4.10 Payouts v3 error codes            | 17                                                   |
| 4.11 Payouts v3 rejection codes        | 21                                                   |
| 4.12 Payouts v3 statuses               | 7                                                    |
| 4.12 Payouts v2 statuses               | 6                                                    |
| 4.13 account validation errors         | 11                                                   |
| 4.14 enrollment statuses               | 5                                                    |
| 4.14 enrollment rejection codes        | 12                                                   |
| 4.15 Mastercard merchant advice codes  | 11                                                   |
| **Total**                              | **330**                                              |
| Distinct Payins HTTP error codes (4.4) | 38 (codes 5011, 5023, 5050 change meaning by family) |

### 5. Lifecycle

Card payments, local payment methods, refunds, chargebacks and payouts are documented separately and should stay separate in the adapter. A payment notification is always a full snapshot of the payment object, not a delta.

#### 5.1 Card payments (Payins)

- **Create**: raw card data or a Google Pay token goes to `POST /secure_payments`; `card.token` (Smart Fields), `card.card_id` (saved card) and everything else go to `POST /payments` (D/card-payments).
- **One step** (`card.capture` true, the default): `PAID` `200` with `approved_date`, or `REJECTED` with a code from 4.3.
- **3DS by dLocal**: `PENDING` `101` with `three_dsecure.redirect_url`; after authentication the payment is processed. A challenge the payer does not finish gives `341`; 3DS required but not done gives `320`. With a third-party MPI the merchant sends `three_dsecure` (`mpi`, `cavv`, `eci`, `ds_transaction_id`).
- **Card `REDIRECT` flow** (dLocal-hosted page): `PENDING` `100` with `redirect_url`; final state by notification.
- **Authorization** (`card.capture` false): `AUTHORIZED` `600`. The returned `id` is the `authorization_id`.
- **Capture**: `POST /payments` with `authorization_id` (full or partial amount). The response is a **new payment** with its own `id`, `PAID` `200` and the `authorization_id` of the original (D/authorization-and-capture). Whether several partial captures are allowed is **NOT DOCUMENTED**.
- **Cancel authorization**: `POST /payments/{authorization_id}/cancel` gives `CANCELLED` `400`. An authorization that runs out gives rejection `329`; whether a notification is sent then is **NOT DOCUMENTED**.
- **$0 verification**: `amount` 0 with `card.verify` true gives `VERIFIED` `700`.
- **Refunds** apply to the capture `id`, not the authorization `id`.
- Authorization holding period, auto-void timing and settlement to the merchant: **NOT DOCUMENTED** as payload states.

#### 5.2 Local payment methods that settle later (cash vouchers, bank transfers, Pix, wallets, Mobile Money)

- **Cash vouchers** (`payment_method_type` `TICKET`, for example OXXO `OX`, Boleto `BL`): the payment stays `PENDING` until the payer pays at a physical location or through home banking and dLocal is notified (D/cash-payments). Direct responses include a `ticket` object with `expiration_date`, `barcode`, `number`, `provider_name`. An expired voucher is shown in sandbox as `REJECTED` ("forcing an approval (`PAID`) or an expiration (`REJECTED`)", D/make-a-test-payment); rejection code `340` means the payment expired.
- **Bank transfers** (`BANK_TRANSFER`): `PENDING` "until the user completes the transfer, and dLocal gets notified"; direct responses carry `bank_transfer` with the account and `reference` the payer must use (D/bank-transfer-payment). D/make-payment: transfers "can be instant or take a few days".
- **Pix** (`PQ`, type `TICKET`): `PENDING` until the payer confirms; dLocal is notified immediately after confirmation (D/pix-payments).
- **Mobile Money**: `PENDING` until the payer approves a PIN push (direct) or completes the provider page (redirect), then `PAID` by notification (D/mobile-money-payments).
- **Wallets**: one-time payments by redirect; recurring through the Enrollment API (`enrollment.id`) or the legacy `wallet.token` (D/wallet-payments).
- **Merchant cancellation** of a pending direct APM: `POST /payments/{payment_id}/cancel` gives `CANCELLED` `400` ("Some of our DIRECT APMs tickets can be cancelled").
- **Retries**: Pix Automático payments can be `PENDING` `102` with `retry.remaining_attempts` and `retry.last_attemptable_date`; payment retries by the merchant may carry `original_order_id`.
- D/overview-payins: in Checkout redirect and Payment links "the final notification has a delay"; only the notification or a status query is authoritative.

#### 5.3 Refunds

- `POST /refunds` with `payment_id` (and optional `amount`, `currency`, `order_refund_id`, `notification_url`). Statuses in 4.5.
- Cash and bank transfer refunds "are always PENDING on the synchronous response" because they need a payout to the customer; dLocal emails the payer for bank details if they are missing (D/refunds). Some card and APM refunds return `SUCCESS` or `REJECTED` at once, but this "can vary by payment method, processor, and merchant configuration".
- Refund notifications follow "the same structure, signature, and retry behavior as payment notifications".
- The payment object has a `refunds` array; its item fields are **NOT DOCUMENTED** in R/retrieve-a-payment.
- A chargeback blocks refunds (HTTP `5018`); a refund window exists (`5020`) but its length is **NOT DOCUMENTED**.

#### 5.4 Chargebacks

- Flow (D/chargebacks): `INQUIRY` (information request, no funds moved) may come first; `PENDING` is the initial chargeback state. Without a dispute before the deadline it becomes `COMPLETED` and funds are debited permanently. With a dispute it goes to `DISPUTE_RECEIVED`, then `IN_DISPUTE` once the deadline passes (funds debited temporarily). The issuer's decision gives `REVERSAL` (funds credited back) or `DISPUTE_LOST`.
- The chargeback is a separate object with its own `id` and a `payment_id`. The payment statuses have no chargeback value, and whether the payment notification is re-sent on a chargeback is **NOT DOCUMENTED**.
- Dispute evidence: one base64 PDF of at most 1 MB through `POST /chargebacks/dispute/{chargeback_id}` (results in 4.7).
- `chargeback_stage` values beyond the example `OTHER` are **NOT DOCUMENTED**.

#### 5.5 Payouts v3

- Statuses in 4.12. Text facts: only `PENDING` or `ON_HOLD` payouts can be cancelled; only `ON_HOLD` (not `ON_HOLD_BY_COMPLIANCE`) can be released, which returns the payout to `PENDING` (release example). A rejection after creation puts the reason in `status_code` (4.11); code `317` says a payout can be rejected after approval, so a timeline must accept a late `REJECTED`.
- The completed, rejected and cancelled flows on D/flow-payouts-v3 are images only; the full transition list is **NOT DOCUMENTED** in text.
- Sandbox: `description` like `DELIVERED:PAID` or `DELIVERED:3000` drives the simulated notification.

#### 5.6 Payouts v2 (legacy)

`RECEIVED` (0) until the next cut-off, `DELIVERED` (4) to the bank, `COMPLETED` (1) when the bank confirms, or `REJECTED` (3), `CANCELLED` (2), `ON HOLD` (5). The v2 notification has no status field; it carries `status_reason` and `date` (section 6).

#### 5.7 Authorized, captured and settled

- **Authorized**: `AUTHORIZED` `600`.
- **Captured / paid**: `PAID` `200` (one step, or the capture's new payment).
- **Settled to the merchant**: **NOT DOCUMENTED** as a Payins payload state. Platforms settlements and reporting were not read.
- **Payout debit**: Payouts v3 `amount_details.debit` shows what is taken from the merchant balance, with `fees` and `taxes`.

### 6. Notifications

#### 6.1 Payins payment notifications

- **Delivery**: HTTPS POST to the payment's `notification_url` or the one in the Merchant Dashboard; port 443 with TLS 1.2 if a port is given. "The body of the request will always be the payment object" (D/receive-notifications). Sent "for every change in payment status".
- **Acknowledgement**: any `2xx` stops the retries.
- **Retries**: hourly for 6 hours (up to 6 attempts), then every 12 hours for 4 days, "Maximum attempts: 12" (the arithmetic does not add up, section 10).
- **Signature** (sensitive): header `Authorization: V2-HMAC-SHA256, Signature: <hex>`, HMAC-SHA256 with the merchant `secretKey` over `X-Login` + `X-Date` + raw body; the notification's own `X-Date` header is used. Whether the notification also carries an `X-Login` header is **NOT DOCUMENTED** (the merchant uses its own).
- **Event type**: no event type field in the documented payment notification. ARN notifications add `type` (`PAYMENT`, `REFUND`, `CHARGEBACK`) and `arn` (D/acquirer-reference-number); whether every notification carries `type` is **NOT DOCUMENTED**.
- **Enrollment**: the `enrollment` object is "Returned in GET /payments and webhook notifications" (R/retrieve-a-payment); separate enrollment notifications go to `enrollment.notification_url`, format not read.

#### 6.2 Refund and chargeback notifications

- **Refunds**: POST to the refund `notification_url`; fields include `id`, `payment_id`, `order_refund_id`, `amount`, `currency`, `status`, `status_code`, `status_detail`, `created_date`, `amount_refunded`, and in the example also `use_orig_fx`, `payment_request_amount`, `payment_request_currency`, `transaction_id`, `authorization_code`, `document_number`, `order_id`. "Please note that notification parameters may vary."
- **Chargebacks**: POST to "the registered merchant chargeback notification URL" (example placeholder `{merchant.chargeback_url}`); fields `id`, `payment_id`, `created_date`, `currency`, `amount`, `status`, `status_code`, `status_detail`, `notification_url`, `order_id`, `chargeback_date`, `chargeback_stage`, `processor_id`, `reason_code`, `reason_description`, `arn`. "Notifications from dLocal are digitally signed" with the payment notification method. Where this URL is configured is **NOT DOCUMENTED** on the pages read.

#### 6.3 Callback URL POST (browser)

POST to `callback_url` with `paymentId`, `status`, `date`, `signature`. Signature recipe (D/configure-callback-url): HMAC-SHA256 with the secret key over `X-Login` + `date` + the literal text `{status:<status>,paymentId:<paymentId>}`. dLocal: "Do not use the `status` parameter in this POST to update the final status".

#### 6.4 Payouts notifications

- **v3**: POST to the dashboard "Payouts Notification URL" or the payout's `notification_url`; body is the same as Get payout (JSON); port 443 and TLS 1.2. Retries: a failed delivery (non-2xx or connection error) goes back to a message queue and is retried "with progressive delays"; the number of attempts and intervals are **NOT DOCUMENTED**; after the last attempt it goes to a dead-letter queue for manual handling. dLocal recommends idempotent handling because "the same notification" may arrive several times. Signature: **NOT DOCUMENTED** on the v3 notification page.
- **v2**: form-encoded POST with `external_id`, `cashout_id`, `date`, `bank_reference_id`, `comments`, `status_reason`, `control` ("V2-HMAC-SHA256 signature"). The `control` recipe is **NOT DOCUMENTED** on that page.

#### 6.5 Other notification families (detect, do not parse as Payins)

dLocal for Platforms: JSON envelope `event_type` (for example `ACCOUNT_STATUS_UPDATE`, `PRICING_LEVEL_UPDATE`, `BANK_ACCOUNT_STATUS_UPDATE`), `account_id`, `account_external_reference`, `notification_date`, `payload`; header `Signature` (hex, no prefix); retried "once an hour for 7 days" (R/notifications-v2-platforms).

#### 6.6 Duplicates and ordering

- No event ID, delivery ID or attempt counter in Payins or Payouts notifications.
- Suggested dedupe key: payment and refund `id` + `status` + `status_code`; chargeback `id` + `status_code`; payout v3 `id` + `status_code` + `last_updated`; payout v2 `cashout_id` + `date` + `status_reason`. Add `type` when present (an ARN notification repeats a payment's status with a new `arn`).
- Ordering: **NOT DOCUMENTED**. Retries span up to 4 days (Payins) and an older snapshot can arrive after a newer one. Payment objects carry `created_date` and `approved_date` but no "last changed" time, so a timeline cannot order two Payins snapshots of the same status by payload alone. Payouts v3 have `last_updated`.
- Source IP addresses of notifications: **NOT DOCUMENTED**.

#### 6.7 Signature fields (sensitive; PandaPayLens does not verify them)

- Payins request and notification `Authorization` header (`V2-HMAC-SHA256, Signature: <64 hex>`), with `X-Date`, `X-Login`, `X-Trans-Key`.
- Callback `signature` parameter.
- Payouts v2 request `Payload-Signature` (HMAC-SHA256 of the payload, lowercase hex) and notification `control`.
- Payouts v3 `Authorization: Bearer <token>` (token valid 180 seconds), `client_id`, `client_secret`, `access_token`.
- Platforms `Signature` header.
- PandaPayLens should redact these, may report "signature present (64 hex)", and must never ask for the secret key.

### 7. Identifiers

| Field                                                                                     | Scope                         | Notes                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (payment)                                                                            | dLocal payment                | Examples `D-4-<uuid>`, `T-4-<uuid>`, `T-40004-<uuid>` ($0 verification), `PAY2323243343543`, and one malformed UUID. The meaning of the middle number is **NOT DOCUMENTED** for payments; for payouts the format is given as `PO-[MID]-UUID`, so it may identify the merchant account and should be masked |
| `authorization_id`                                                                        | Parent link                   | On the capture response; equals the `id` of the `AUTHORIZED` payment                                                                                                                                                                                                                                       |
| `order_id`                                                                                | Merchant reference            | Up to 125 characters; on payments, captures (the capture's own `order_id`), refunds, chargebacks; `GET /orders/{order_id}`; duplicates rejected with `5009`                                                                                                                                                |
| `original_order_id`                                                                       | Retry link                    | Merchant's `order_id` of the rejected payment being retried                                                                                                                                                                                                                                                |
| `payment_id`                                                                              | Parent link                   | On refunds, chargebacks, orders and the dispute API                                                                                                                                                                                                                                                        |
| `id` (refund), `refund_id`                                                                | dLocal refund                 | Examples `REF42342`, `REF-4-<uuid>`, `R-462778-<uuid>` (sandbox tool). `GET /orders/refunds/{order_refund_id}` returns both an `id` and a `refund_id`                                                                                                                                                      |
| `order_refund_id`                                                                         | Merchant refund reference     | Up to 100 or 125 characters (two pages differ); duplicate gives refund `5011`                                                                                                                                                                                                                              |
| `id` (chargeback)                                                                         | dLocal chargeback             | Examples `CHAR42342`, `CBK-4-3990-<uuid>`, `CBK-12345-1512742-<uuid>`                                                                                                                                                                                                                                      |
| `arn`                                                                                     | Scheme reference              | 23 digits; on chargeback notifications and ARN payment and refund notifications                                                                                                                                                                                                                            |
| `processor_id`                                                                            | Processor or acquirer         | On chargebacks; values **NOT DOCUMENTED**                                                                                                                                                                                                                                                                  |
| `transaction_id`, `authorization_code`                                                    | Processor references          | In the refund notification example only                                                                                                                                                                                                                                                                    |
| `result_info.external_reference_number`, `result_info.user_id`                            | Payment method provider       | For reconciliation (R/create-payment)                                                                                                                                                                                                                                                                      |
| `card.card_id` (`CID-...`), `card.token` (`CV-...`)                                       | Stored or temporary card      | Link payments of the same card                                                                                                                                                                                                                                                                             |
| `card.network_tx_reference`, `card.network_payment_reference`, `card.transaction_link_id` | Scheme MIT links              | The CIT reference is sent back on later MITs; Mastercard TLID returned from September 3, 2026                                                                                                                                                                                                              |
| `enrollment.id` (`E-4-...`), `enrollment.external_id`                                     | Recurring authorization       | On payments made under an enrollment                                                                                                                                                                                                                                                                       |
| `wallet.token`                                                                            | Legacy wallet token           |                                                                                                                                                                                                                                                                                                            |
| `ticket.id`, `ticket.number`, `bank_transfer.reference`                                   | Voucher or transfer reference | Shown to the payer                                                                                                                                                                                                                                                                                         |
| `id` (payout v3, `PO-[MID]-UUID`), `external_id`, `network_reference_id`                  | Payout                        | `GET /payouts/v3` by `payout_id` or `external_id`; duplicate `external_id` gives `5011`                                                                                                                                                                                                                    |
| `cashout_id`, `external_id`, `bank_reference_id`                                          | Payout v2                     |                                                                                                                                                                                                                                                                                                            |
| `X-Idempotency-Key`                                                                       | Request                       | Same key within 7 days returns the original response                                                                                                                                                                                                                                                       |
| `X-Login`, `account_id`                                                                   | Merchant / platform account   | Mask in output                                                                                                                                                                                                                                                                                             |

### 8. Sensitive fields

Redact or mask by default (request fields included because request and response pairs get pasted):

- **Card data**: `card.number`, `card.cvv`, `card.encrypted_data`, `card.token`, `card.cvv_token`, `card.card_id`, `card.cryptogram`, `card.holder_name`, `card.expiration_month` / `expiration_year`, `card.last4` together with `result_info.card.bin`, payout `beneficiary.card.number`, `wallet.token`.
- **3DS**: `three_dsecure.cavv`, `xid`, `ds_transaction_id`, `three_dsecure.redirect_url`.
- **Local tax and identity numbers**: `payer.document`, `payer.document2`, refund `document_id` and `document_number`, `result_info.payer.document`, payout `beneficiary.document.id` and `remitter.document.id` (with issue and expiry dates), `additional_risk_data.beneficiary.document`, `additional_risk_data.submerchant.document`. R/country-reference lists what these hold, for example CPF or CNPJ (Brazil), DNI, CUIT or CUIL (Argentina), CI or RUT (Chile, Uruguay), CC or NIT (Colombia), CURP or RFC (Mexico), DNI or RUC (Peru), PAN (India), NIK (Indonesia), NRIC (Malaysia), NIN (Nigeria), My Number (Japan), Emirates ID (UAE). dLocal's own `bank_transfer.beneficiary_document` (a company tax number) is not personal but can be masked the same way.
- **Personal data**: `payer.name`, `email`, `phone`, `birth_date`, `address`, `ip`, `ip_port`, `device_id`, `user_reference`; `additional_risk_data` (device IDs such as `advertising_id`, `android_id`, `vendor_id`, payer history, beneficiary and submerchant data); payout `beneficiary` and `remitter` (names, phone, email, `birth_info`, `address`, `nationality`, `funds_source`); `beneficiary.instant_payment.id` (a Pix key, which can be an email, phone or tax number); refund `beneficiary_name`, `beneficiary_lastname`, `email`, `phone`, `address`, `city`.
- **Bank data**: refund `bank`, `bank_code`, `bank_account`, `bank_account_type`, `bank_branch`, `bank_branch_name`; `result_info.payer.account` (`number`, `branch`, `ispb`); payout `beneficiary.bank_account`; virtual account `virtual_bank_account.bank_account`.
- **Dispute and scheme data**: `arn`, `card.network_tx_reference`, `card.network_payment_reference`, `card.transaction_link_id`, `authorization_code`.
- **Credentials and signatures**: section 6.7; also `X-Trans-Key`, `client_secret`, `access_token`.
- **Merchant infrastructure**: `notification_url`, `callback_url`, `redirect_url` (contains a session path), the middle segment of `D-<n>-` and `PO-<n>-` IDs.

### 9. Structural detection hints

Strong dLocal signals (combine several):

1. **Payins payment object**: `payment_method_id` + `payment_method_type` (`CARD`, `TICKET`, `BANK_TRANSFER`, `WALLET`, ...) + `payment_method_flow` (`DIRECT` or `REDIRECT`) together with `status` in {`PENDING`, `PAID`, `REJECTED`, `CANCELLED`, `AUTHORIZED`, `VERIFIED`}, `status_code` as a numeric string (`"100"` ... `"800"`), `status_detail` as an English sentence, `order_id`, `created_date` in `...000+0000` form. The `payment_method_flow` key with `status_detail` is the most distinctive pair.
2. **ID shapes**: `D-<digits>-<uuid>`, `T-<digits>-<uuid>`, `REF-<digits>-<uuid>`, `CBK-<digits>-...`, `PO-<digits>-<uuid>`, `E-<digits>-<uuid>`, `CID-<uuid>`, `CV-<uuid>`. Sample-style IDs (`PAY...`, `REF...`, `CHAR...`) also appear in the docs, so the ID alone cannot be required.
3. **Nested blocks**: `ticket` with `company_name`, `provider_name`, `provider_logo`, `image_url`; `bank_transfer` with `bank_account_label`, `user_payment_amount`, `payment_instruction`; `three_dsecure.redirect_url`; `acquirer.network_response_code`; `result_info.sub_payment_method`.
4. **Refund**: `payment_id` + `order_refund_id` and/or `amount_refunded` + `status` in {`PENDING`, `SUCCESS`, `REJECTED`, `CANCELLED`}.
5. **Chargeback**: `payment_id` + any of `chargeback_date`, `chargeback_stage`, `reason_code`, `reason_description`, `processor_id`, `arn`, or a status in {`DISPUTE_RECEIVED`, `IN_DISPUTE`, `DISPUTE_LOST`, `REVERSAL`, `INQUIRY`}.
6. **Payout v3**: `flow_type`, `currency_to_pay`, `purpose`, `statement_descriptor`, `on_hold`, `amount_details.debit`, `beneficiary` and `remitter` blocks, statuses `DELIVERED`, `ON_HOLD_BY_COMPLIANCE`.
7. **Payout v2 notification**: form-encoded `external_id` + `cashout_id` + `bank_reference_id` + `status_reason` + `control`.
8. **Error envelope**: `{code, message, param?}` with a 4-digit `code` from 4.4 or 4.10. This shape alone is generic; require a dLocal code and, when available, a dLocal host or header.
9. **Callback POST**: exactly `paymentId`, `status` (`COMPLETED`, `APPROVED`, `REJECTED`, `PENDING`), `date`, `signature`.
10. **Headers and hosts**: `X-Login`, `X-Trans-Key`, `X-Version: 2.1` or `3.0`, `Authorization: V2-HMAC-SHA256, Signature: ...`, `X-Dlocal-Payment-Source`, `Payload-Signature`; hosts `api.dlocal.com`, `sandbox.dlocal.com`, `pay.dlocal.com`, paths `/secure_payments`, `/payments/{id}/status`, `/payouts/v3`.

How this differs from supported providers and other candidates (from their research files in this repository):

- **Stripe**: `object` key and prefixed IDs (`pi_`, `ch_`, `evt_`), lowercase `status`. dLocal has no `object` key and uses uppercase statuses with a numeric `status_code`.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in dLocal payloads.
- **payabl.**: URL-encoded `transactionid` / `transid`, `errormessage`. dLocal is JSON except the legacy Payouts v2 notification, which uses `cashout_id` and `control`.
- **Checkout.com**: `pay_` / `act_` IDs, `response_code` 5-character strings, `approved` boolean, Title Case `status`, `_links`.
- **PayPal**: `status_details` is an object with `reason`; dLocal's `status_detail` (singular) is a plain string. PayPal webhooks use `event_type` and `resource`.
- **Braintree**: `bt_signature` / `bt_payload`, `processor_response_code`, GraphQL `extensions`.
- **Mollie**: `resource` key, `tr_` / `re_` / `chb_` IDs, lowercase statuses (`paid`), `amount` as `{currency, value}`.
- **Square**: `errors[]` with `category` and `code`, `amount_money`, `card_details.status`.
- **NMI**: query strings with `response`, `responsetext`, `transactionid`.
- **Worldpay**: `outcome`, `paymentId`, `commandId`, `eventDetails`, `errorName`.
- **Cybersource**: `submitTimeUtc`, `...Information` blocks, `/pts/v2/` links.
- **Authorize.net**: `transactionResponse.responseCode`, `transId`, `messages.resultCode`, `X-ANET-Signature`.
- **Nuvei**: `internalRequestId`, `gwErrorCode`, `gwExtendedErrorCode`, `ppp_status`, `advanceResponseChecksum`.
- **AstroPay**: `deposit_external_id`, `merchant_deposit_id`, `merchant_cashout_id`, `internal_term`. AstroPay cashout callbacks also contain `cashout_id`, so `cashout_id` alone must not decide; dLocal Payouts v2 pairs it with `external_id`, `bank_reference_id` and `control`.
- **NETbilling**: `status_code` there is a single character in a form-encoded reply with `trans_id`; dLocal's `status_code` is a 3-digit string inside JSON next to `status_detail`.
- **dLocal for Platforms** (same provider, different family): `event_type` + `account_id` + `payload`; detect separately from Payins.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Code reuse across objects**: `status_code` 700 means `VERIFIED` (payment), `REVERSAL` (chargeback, a won dispute) and `ON_HOLD_BY_COMPLIANCE` (payout v3); 800 means "payment creation failed" (payment) and `INQUIRY` (chargeback); 600 means `AUTHORIZED` (payment) and `ON_HOLD` (payout v3); 101 means pending 3DS (payment) and `DISPUTE_RECEIVED` (chargeback); rejection codes 301-319 have different meanings for payments, payouts v3 and enrollments; HTTP code 3001 is "invalid credentials" in Payins but "empty parameter" in Payouts v3; 5010, 5011, 5023 and 5050 change meaning between payments, refunds and payouts.
2. **One code, two errors**: Payins `5010` is listed both as 400 "method not available" and as 504 "request timeout".
3. **Type drift**: `status_code` is a string for payments, payouts, chargeback GET responses and the refund status endpoint, but an integer in refund create, retrieve and notification examples and in the chargeback notification schema. A parser should accept both.
4. **`status_detail` text varies**: "The payment was paid" vs "The payment was paid.", "Call bank for authorize" in an example vs "Call bank for authorize." in the table. Decode by code, not text.
5. **Retry arithmetic**: hourly for 6 hours (6 attempts) plus every 12 hours for 4 days (8 more) is 14, but the page says the maximum is 12.
6. **Invalid or unusual examples**: R/retrieve-a-payment has dates `2018-07-012T...` and a trailing comma inside `three_dsecure`; the Payouts v3 wallet example has a trailing comma; R/retrieve-a-refund has a `//Deprecated` comment inside JSON; R/retrieve-an-order uses a payment ID whose UUID has only four groups.
7. **ID formats differ between examples** (section 7), including three refund ID styles and three chargeback ID styles.
8. **Payment method types**: R/payment-method-object lists `CARD`, `BANK_TRANSFER`, `DIRECT_DEBIT`, `TICKET`; guides use `WALLET` too; Pix is typed `TICKET`.
9. **Missing mapping**: D/network-response-data says the full mapping between network response codes and dLocal status codes is on R/payment-status-codes; that page has no mapping. Raw ISO 8583 codes are not listed by dLocal. The `acquirer` block is opt-in, so most pasted declines will not have it.
10. **Payouts v3 authentication conflict**: D/integrate-payouts-v3 says all Payouts requests "must be signed" with `Payload-Signature`; R/security-payouts-v3 and D/generate-signature say v3 uses an OAuth bearer token and no signature. The Payouts v2 pages are reachable but not in `llms.txt` or the sitemap.
11. **Payouts v3 tables**: the 404 row is labelled "Bad Request"; the `5014` example sits under HTTP 403 while the table says 400; the rejection table header says "Code range" for single codes and lists `320` first; the sandbox returns `status` `BAD_REQUEST`, which is not a payout status; examples use both `funds_source` and `funds`, and `bank_account.type` both `SAVINGS` and `S`.
12. **Payouts v3 notification signature** is **NOT DOCUMENTED**; the retry count is **NOT DOCUMENTED**.
13. **Refund status endpoint** declares `text/plain` for a JSON body.
14. **Sandbox tool examples**: the success example for the refund status tool shows a "Payment not found" error body; error bodies nest a second JSON document inside `message`.
15. **Field name typo**: R/the-bank-transfer-object documents `benficiary_document`; the example response uses `beneficiary_document`.
16. **Required-field disagreements**: R/capture-authorization marks `amount` optional, the guide marks it required while saying it defaults to the full amount; the refund-for-captures table marks `amount` and `notification_url` required, R/make-a-refund does not. `order_refund_id` length is 125 in the request schema and 100 in error `5022`.
17. **Enrollment tables**: D/wallet-payments lists four enrollment statuses; R/enrollment-status-codes lists five (adds `CANCELLED` `401`).
18. **Notification envelope**: payment notifications carry no `type`, ARN notifications do; chargeback notifications reuse `status` `PENDING` like payments and refunds, so the object kind must be inferred from fields (section 9).
19. **Callback signature recipe** concatenates a quote-less pseudo-JSON string (`{status:...,paymentId:...}`); exact byte layout is ambiguous. Not relevant to PandaPayLens (no verification).
20. **Coverage claims differ**: the website's llms.txt says "44+ countries", the industry pages say "60+ emerging markets", and R/country-reference lists 64 countries.
21. **Not exhaustive**: `chargeback_stage`, `processor_id`, Payouts v2 `status_reason` values, refund rejection reasons and the `refunds` array items are not listed. Chargeback reason tables include an "Unrecognized" row, so unknown reason codes are expected.
22. **Not read**: Platforms (except notifications), KYC Verifications, Brazil Core Services, enrollment endpoints, installments, Checkout redirect, Payment links, purpose codes, country payout requirements. Anything from those is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | 330 first-party code values with clear meanings: 39 payment rejection codes, HTTP error tables per family, payout error and rejection codes, Mastercard advice codes with dLocal's own retry guidance. Overlapping numbers are handled by keying on object type and API family; unknown values fall back to `unknown`. Raw network codes in the opt-in `acquirer` block are not listed and stay unknown.                               |
| **paymentResponses** | **supported** | One stable payment object (`id`, `status`, `status_code`, `status_detail`, `payment_method_*`, `order_id`) across create, get, cancel, capture and notifications, with OpenAPI schemas and many examples, including declined ones. Type drift of `status_code` and text variations in `status_detail` are easy to tolerate.                                                                                                            |
| **webhookParsing**   | **limited**   | Payment, refund and chargeback notifications are documented JSON with a documented signature header and retry schedule, but there is no event type or event ID, the object kind must be inferred from fields, the Payouts v3 notification has no documented signature, and Payouts v2 uses a different form-encoded format.                                                                                                            |
| **timeline**         | **limited**   | `created_date`, `approved_date`, chargeback `chargeback_date`, payout `last_updated`, and clear status flows for 3DS, capture, vouchers, refunds, chargebacks and payouts support a timeline. Payins notifications have no change timestamp and ordering is not documented; retries can deliver older snapshots late; payout flows are only drawn as images.                                                                           |
| **correlation**      | **supported** | Explicit parent keys: `authorization_id` on captures, `payment_id` on refunds, chargebacks and disputes, `order_id` / `order_refund_id` / `external_id` merchant references, `original_order_id` for retries, `arn` for scheme matching, `enrollment.id` for recurring payments. Gaps: a capture gets a new payment `id` (refunds must use it), and chargeback notifications do not carry the card brand needed to read `reason_code`. |
