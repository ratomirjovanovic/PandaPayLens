# Flutterwave (adapter id `flutterwave`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Flutterwave's first-party documentation (`developer.flutterwave.com`, including the OpenAPI definitions embedded in its API reference pages) and Flutterwave's own websites as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: the documentation site publishes two machine-readable page indexes, `https://developer.flutterwave.com/llms.txt` (v3, the default version) and `https://developer.flutterwave.com/v4.0/llms.txt` (v4). Every page listed in both indexes (220 v3 pages, 100 v4 pages) was downloaded as raw Markdown (`<page>.md`, the format the indexes link to) and searched mechanically for field names, status values, event names and messages. The pages in the Sources table were then read in full or in the relevant part. Code tables were extracted mechanically from the Markdown and from the embedded OpenAPI JSON, so code values and type names are exact; meanings are paraphrased. The "updatedAt" value is the page's own front-matter timestamp.
- Brand note: some v3 examples still use the legacy product name Rave (`api.ravepay.co`, `ravesandboxapi.flutterwave.com`, Python package `rave_python`, Go package `Rave-go`). Real payloads and logs may contain these hosts.
- Privacy note: several Flutterwave examples contain names, e-mail addresses, phone numbers and one BVN record that look like real personal data. The examples transcribed below keep only structural fields; customer blocks are shortened with `...` and marked as elided. Fixtures built from this file must use `PPLsynth` identifiers.

---

## Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| API versions                       | **v3** (`https://api.flutterwave.com/v3`, secret-key bearer auth) is the documentation site's default and only "stable" version. **v4** (`https://developersandbox-api.flutterwave.com` sandbox, `https://f4bexperience.flutterwave.com` production, OAuth 2.0 client credentials) is published alongside it and its OpenAPI info block describes it as "APIs for Enterprise Customers". An older **v2** documentation version exists on the same site; it was not read. All three are JSON over HTTPS                    |
| API family to implement first      | **v3 JSON responses and v3 webhooks**: envelope `status` / `message` / `data`, transaction object with `id`, `tx_ref`, `flw_ref`, `status`, `processor_response`, transfer object with `status` and `complete_message`, webhooks with `event` and `event.type`. Then **v4** as a separate parser (different envelope, error object, IDs and webhook shape)                                                                                                                                                                |
| Documented codes (distinct values) | **v4**: 180 distinct numeric code values in three tables (192 table rows): collections error codes 67 distinct (77 rows), payout error codes 68 distinct (70 rows), card `processor_response` codes 45. Plus 15 payout `provider_response.type` values. **v3**: no numeric error codes are published in readable form (the v3 payment error table is an embedded Airtable view that was not readable); v3 decoding relies on 44 documented failure message strings and the status vocabularies listed in sections 4 and 5 |
| Classification                     | `gateway`, `card_processing`, `alternative_payment_method` (mobile money, USSD, bank transfer, vouchers, QR), `wallet` (merchant balances and wallet-to-wallet transfers). Payouts are a first-class product. `acquiring`, `payment_facilitator`, `orchestration`, `merchant_account_intermediary` are not claimed (see Classification)                                                                                                                                                                                   |
| Documented sectors                 | Fintechs, banks and other financial institutions (OFIs), travel and hospitality, e-commerce, remittance, telecommunications (v4 "Use cases" pages)                                                                                                                                                                                                                                                                                                                                                                        |
| Documentation access               | **Public** (no login) for guides, both API references and the embedded OpenAPI definitions. Dashboard settings (webhook URL, secret hash, retries, API keys) need a merchant login and were not used                                                                                                                                                                                                                                                                                                                      |
| Biggest limitations                | v3 has no machine-readable decline codes (`processor_response` is free text); v3 webhooks have no event or delivery ID; v3 and v4 are structurally different and their docs cross-reference each other's field names; v4 webhook docs disagree with the v4 schema on the event ID key (`id` vs `webhook_id`) and on how the signature is computed; the v3 refund webhook has a different, PascalCase shape and no `event` key                                                                                             |
| White-label                        | No. Flutterwave documents its own formats. Card chargebacks pass through "Flutterwave's acquiring bank" (chargebacks page), but nothing in the payloads exposes that acquirer's format                                                                                                                                                                                                                                                                                                                                    |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://developer.flutterwave.com` (v3 pages; the default version, also reachable under `/v3.0.0/`). `D4` = `https://developer.flutterwave.com/v4.0.0` (v4 pages). Every page carries `updatedAt` 2026-10-19 unless another date is shown.

| URL                                                                                                                                                                                                                                                                                                                | updatedAt  | What it covers                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://developer.flutterwave.com/llms.txt, https://developer.flutterwave.com/v4.0/llms.txt, https://developer.flutterwave.com/robots.txt                                                                                                                                                                          | n/a        | Page discovery only                                                                                                                                                                                       |
| https://developer.flutterwave.com/docs (HTML shell, version metadata only)                                                                                                                                                                                                                                         | n/a        | Version list: 2.0.0, 3.0.0 (`is_stable: true`), 4.0.0 (`is_stable: false`, `is_beta: false`, created 2025-07-12); registry file names `flutterwave-v3.json` and `flutterwave-apis.json`                   |
| D/docs/common-errors.md                                                                                                                                                                                                                                                                                            |            | **v3 error format**: payment, validation (400), authorization (401) and server (500) errors; the payment error list is an embedded Airtable view                                                          |
| D/docs/handling-error-timeouts.md                                                                                                                                                                                                                                                                                  |            | v3 503 timeout after about 28 seconds; query status before retrying; verify, transfer and bill status examples                                                                                            |
| D/docs/rate-limit.md                                                                                                                                                                                                                                                                                               |            | v3 HTTP 429 and backoff advice                                                                                                                                                                            |
| D/docs/webhooks.md                                                                                                                                                                                                                                                                                                 |            | **v3 webhooks**: structure, `verif-hash` header, 60-second timeout, 3 retries 30 minutes apart, duplicates, examples for payments, transfers, subscriptions, BVN, bills, virtual cards and refunds        |
| D/docs/transaction-verification.md                                                                                                                                                                                                                                                                                 |            | Verify by `data.id`; checks to perform; success and "not found" examples                                                                                                                                  |
| D/docs/refunds.md                                                                                                                                                                                                                                                                                                  | 2026-10-19 | v3 refund request, minimums, **refund status table**, refund webhook example                                                                                                                              |
| D/docs/chargebacks.md                                                                                                                                                                                                                                                                                              |            | v3 chargeback lifecycle, response deadlines, accept/decline, **status and stage tables**, chargeback webhooks (`chargeback.initiated`, `.accepted`, `.declined`, `.lost`)                                 |
| D/docs/testing.md                                                                                                                                                                                                                                                                                                  |            | Test cards for success and failure scenarios, special OTPs, blacklisted account error, mobile money failure messages, transfer reference suffixes, Capitec scenarios                                      |
| D/docs/introduction-6.md                                                                                                                                                                                                                                                                                           |            | **v3 transfers**: statuses and `complete_message`, callbacks, transfer webhooks, resend webhook, error handling by HTTP code, supported transfer countries                                                |
| D/docs/bank-account.md                                                                                                                                                                                                                                                                                             | 2026-10-22 | Bank account transfer currencies and countries                                                                                                                                                            |
| D/docs/authentication.md, D/docs/best-practices.md (2026-10-20), D/docs/api-basics.md, D/docs/getting-started.md                                                                                                                                                                                                   |            | v3 keys (`_TEST` prefix), bearer header, secret hash recommendation                                                                                                                                       |
| D/docs/direct-card-charge.md                                                                                                                                                                                                                                                                                       |            | v3 card flow, `meta.authorization.mode` values, 3DS redirect, OTP validation, **card velocity limit messages**, card type restriction error                                                               |
| D/docs/preauthorization.md                                                                                                                                                                                                                                                                                         |            | Preauth, capture, void, refund; `preauth-card` webhook with status `pending-capture`; capture errors                                                                                                      |
| D/docs/mobile-money-1.md, D/docs/m-pesa.md                                                                                                                                                                                                                                                                         |            | Mobile money charge stays `pending` until the customer authorizes; completion by webhook                                                                                                                  |
| D/docs/ngn-bank-transfer.md, D/docs/ngn-virtual-accounts.md, D/docs/ghs-virtual-accounts.md                                                                                                                                                                                                                        |            | Pay-with-bank-transfer flow, `BANK_TRANSFER_TRANSACTION` webhook with `meta_data`, underpayment and overpayment handling                                                                                  |
| D/docs/ach-payment.md, D/docs/south-africa-account-charge.md                                                                                                                                                                                                                                                       |            | Failed bank-account charge examples ("Transaction cancelled by user", Capitec consent declined)                                                                                                           |
| D/docs/payment-methods.md, D/docs/e-commerce.md, D/docs/fx-trade.md                                                                                                                                                                                                                                                |            | `payment_options` values, Inline redirect query parameters, FX trade transfer failures (read in part)                                                                                                     |
| D/reference/introduction-1.md                                                                                                                                                                                                                                                                                      |            | v3 API protocol: REST, JSON responses, `Content-Type: application/json`, status page                                                                                                                      |
| D/reference/charge-a-card.md, validate-a-charge.md, verify-transaction.md, get-transaction-events.md, transaction-refund.md, get-transaction-refunds.md, get-all-refunds.md, capture-preauth-charge.md, void-preauth-charge.md, refund-preauth-charge.md, resend-transaction-webhook.md (each under D/reference/)  |            | v3 charge, verify, timeline, refund and preauth reference examples (embedded OpenAPI 3.1 with response examples)                                                                                          |
| D/reference/create-a-transfer.md, get-a-transfer.md, transfer-retry.md, get-a-transfer-retry.md (under D/reference/)                                                                                                                                                                                               |            | v3 transfer examples including a 400 "Processor Error" with `data.status` `FAILED`, duplicate reference, retries                                                                                          |
| D/reference/list-a-chargeback.md, list-a-chargeback-1.md, acceptdecline-a-chargeback.md (under D/reference/)                                                                                                                                                                                                       |            | v3 chargeback objects with `meta.history`                                                                                                                                                                 |
| D/reference/charge-via-mpesa.md, charge-via-bank-transfer.md, charge-via-ach-payment.md, charge-nigerian-bank-accounts.md, capitec.md, charge-via-ghana-mobile-money.md, charge-via-francophone-mobile-money.md, charge-via-ussd.md, charge-via-nqr.md, charge-with-token-1.md, create-otp.md (under D/reference/) |            | Initiation responses and 400 messages for each payment method                                                                                                                                             |
| D4/docs/getting-started.md, D4/docs/introduction-1.md, D4/docs/main-payment-flow.md                                                                                                                                                                                                                                |            | v4 general payment flow: customer, payment method, charge, `next_action`, verification                                                                                                                    |
| D4/docs/authentication.md, D4/docs/environments.md, D4/docs/api-headers.md, D4/docs/idempotency.md                                                                                                                                                                                                                 |            | v4 OAuth 2.0 token (10 minutes), base URLs, `X-Idempotency-Key`, `X-Trace-Id`, `X-Scenario-Key`, `X-Idempotency-Cache-Hit`                                                                                |
| D4/docs/common-errors.md                                                                                                                                                                                                                                                                                           |            | **v4 error object**, general, collections and payout **code tables**, `requires_requery` timeout handling, rate limit (500 requests per minute)                                                           |
| D4/docs/webhooks.md                                                                                                                                                                                                                                                                                                |            | **v4 webhooks**: structure, `flutterwave-signature` header (HMAC-SHA256), timeout, retries, idempotency                                                                                                   |
| D4/docs/testing.md                                                                                                                                                                                                                                                                                                 |            | `X-Scenario-Key` card scenarios, 45 issuer response values, mobile money and transfer scenarios                                                                                                           |
| D4/docs/card.md, D4/docs/mobile-money.md, D4/docs/pay-with-bank-transfer.md, D4/docs/general-transfer-flow.md                                                                                                                                                                                                      |            | v4 `charge.completed` and `transfer.disburse` webhook examples, transfer statuses, dynamic and static virtual accounts                                                                                    |
| D4/docs/refunds.md, D4/docs/chargebacks-1.md                                                                                                                                                                                                                                                                       |            | v4 refund statuses, chargeback statuses and stages, sandbox-only chargeback creation                                                                                                                      |
| D4/docs/fintechs.md, banks-and-ofis.md, travel-and-hospitality.md, e-commerce.md, remittance.md, telecommunications.md (under D4/docs/)                                                                                                                                                                            |            | Sectors in Flutterwave's own words                                                                                                                                                                        |
| D4/reference/charges_get.md, transfer_get.md, chargebacks_get_by_id.md, chargebacks_list.md, resend_webhook.md, refund_completed_webhook.md (under D4/reference/)                                                                                                                                                  |            | **v4 OpenAPI 3.1 definitions**: charge, transfer, chargeback and refund schemas, `processor_response` enum, `provider_response`, webhook payload schemas (`base_webhook_payload` and four event payloads) |
| https://flutterwave.com/us/                                                                                                                                                                                                                                                                                        | n/a        | Company site (activity check), country selector, FinCEN registration line                                                                                                                                 |
| https://send.flutterwave.com/legal/licenses/                                                                                                                                                                                                                                                                       | n/a        | Licence disclosure for Flutterwave's Send remittance app (entities, regulators)                                                                                                                           |

Not read or not readable:

- The v3 "Payment Errors" table on D/docs/common-errors.md is an embedded Airtable view (`airtable.com/embed/app0K81ij4jWssnV3/shreKmXyljsYL9cE1`). Its contents are not in the page source and were not retrieved. Any v3 payment error code or message that exists only there is **NOT DOCUMENTED** in this file.
- The v2 documentation version, the v4 orchestrator, order, settlement, virtual account and wallet reference pages beyond the schemas named above, and the v3 bill payment, BVN, FX and virtual card pages beyond the values quoted here.
- Official SDK repositories were not read. The v3 pages name these packages: `flutterwave-node-v3` (npm), `flutterwavedev/flutterwave-v3` (Composer), `flutterwave_sdk` (Ruby gem), `rave_python` (pip), `github.com/Flutterwave/Rave-go/rave` (Go).
- A Paystack documentation page fetched for comparison returned HTTP 403; no Paystack facts are used as evidence here (see section 9).

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | flutterwave.com/us/ home page ("Endless possibilities for all") with a 17-entry country selector; documentation pages updated 2026-10-19 to 2026-10-22; v4 version metadata updated 2026-10-22                                                                                                                                                                                   |
| 2   | Payment service operational      | yes    | Live and sandbox base URLs documented for both versions (`https://api.flutterwave.com/v3`; `https://developersandbox-api.flutterwave.com` and `https://f4bexperience.flutterwave.com` for v4). The v3 reference introduction points to a public status page, `status.flutterwave.com`                                                                                            |
| 3   | Docs publicly accessible         | yes    | Guides, both API references and the embedded OpenAPI definitions load without login and are indexed by `llms.txt`. The dashboard (keys, webhook URL, secret hash, retry toggle, transfer settings) needs a merchant login and was not used. The v3 payment error table is an Airtable embed and was not readable                                                                 |
| 4   | API families/versions identified | yes    | v2 (older docs), v3 (stable, default; OpenAPI title `flutterwave-v3`, server `https://api.flutterwave.com/v3`), v4 (OpenAPI title "Flutterwave APIs", version "1.0", description "APIs for Enterprise Customers")                                                                                                                                                                |
| 5   | Offline-examinable formats       | yes    | JSON response examples for every v3 charge, verify, refund, chargeback and transfer endpoint read; JSON webhook examples for both versions; v4 OpenAPI schemas with enums                                                                                                                                                                                                        |
| 6   | Sectors documented               | yes    | v4 use-case pages: fintechs, banks and OFIs, travel and hospitality, e-commerce, remittance, telecommunications (see Classification)                                                                                                                                                                                                                                             |
| 7   | Regional/regulatory limits       | yes    | Payout codes `229400` (Zambia payouts only for merchants registered in Zambia), `226400` (XAF-to-XAF only without approval), `230400` (XOF mobile money destinations), `230401` (Republic of the Congo MSISDN format); v3 direct card charge requires PCI DSS certification; transfers require IP whitelisting; refund minimums NGN 100 and KES 10. Licences: see Classification |
| 8   | Diagnostic value                 | yes    | 180 distinct v4 code values with types, 45 card processor codes, explicit charge, refund, chargeback and transfer status vocabularies in both versions, documented card velocity limits, webhook retry rules                                                                                                                                                                     |
| 9   | Own technical formats            | yes    | Flutterwave-specific JSON: v3 `flw_ref`, `tx_ref`, `app_fee`, `auth_model`, `complete_message`, `event.type`, `verif-hash`; v4 `chg_` / `pmd_` / `trf_` / `wbk_` IDs, `next_action`, `error.type` + `error.code`. Not a resale of a gateway PandaPayLens supports                                                                                                                |
| 10  | No credentials needed to analyse | yes    | All examples and schemas are public. Webhook verification needs the merchant's secret hash, but PandaPayLens does not verify signatures                                                                                                                                                                                                                                          |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`                    | Merchants send card, account and alternative payment requests to Flutterwave's API and receive Flutterwave-formatted results (D/docs/direct-card-charge.md, D4/docs/main-payment-flow.md)                                                                                                                                                                                                                        |
| `card_processing`            | Direct card charge with PIN, AVS, 3DS and no-auth models; preauthorization with capture, void and refund (D/docs/direct-card-charge.md, D/docs/preauthorization.md); v4 card `processor_response` codes                                                                                                                                                                                                          |
| `alternative_payment_method` | Mobile money (M-PESA, Ghana, Rwanda, Tanzania, Uganda, Zambia, francophone), bank transfer, USSD, NQR, 1Voucher, OPay, Fawry Pay, Capitec, ACH and UK/EU account payments (v3 llms.txt sections and charge reference pages)                                                                                                                                                                                      |
| `wallet`                     | Merchant balances per currency, payouts debited "from your Flutterwave available balance", wallet-to-wallet transfers to "another Flutterwave account" (D/docs/introduction-6.md); v4 transfer `wallet.provider` enum `flutterwave`                                                                                                                                                                              |
| Not claimed                  | `acquiring`: the chargebacks page says the issuing bank raises a chargeback "through Flutterwave's acquiring bank", so acquiring is done by a partner bank in the pages read. `payment_facilitator` and `merchant_account_intermediary`: not stated. `orchestration`: v4 calls a combined endpoint the "Orchestrator flow", but it only bundles Flutterwave's own steps; no multi-provider routing is documented |

Licences: Flutterwave's licence disclosure (https://send.flutterwave.com/legal/licenses/) is published for its Send remittance app and lists, among others, Flutterwave Payments, LLC (FinCEN-registered Money Services Business, NMLS ID 2391594, US state money transmitter licences), Flutterwave Technology Solutions Ltd (Central Bank of Nigeria International Money Transfer Operator licence; the page also lists Payment System Service Provider, Switching and Processing, Settlement Bank and Microfinance Bank licences), and partner entities in the UK (FCA) and the EU (KNF). Which of these entities contracts with API merchants is **NOT DOCUMENTED** in the pages read.

Countries, only as Flutterwave states them:

| Scope                       | Source and wording                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transfers (payouts)         | D/docs/introduction-6.md: "Nigeria, United States, The United Kingdom, SEPA, Ghana, Kenya, Uganda, Tanzania, South Africa, Cameroon, Ivory Coast, Sierra Leone, Senegal, Rwanda, and over 30 other Countries"                                              |
| Bank account transfers      | D/docs/bank-account.md: EUR (SEPA countries), GBP (UK), GHS (Ghana), KES (Kenya), MWK (Malawi), NGN (Nigeria), TZS (Tanzania), UGX (Uganda), USD (United States and Nigeria domiciliary), XAF (Cameroon), XOF (Côte d'Ivoire, Senegal), ZAR (South Africa) |
| Mobile money collections    | v3 llms.txt section "Mobile Money": francophone, Ghana, Kenya (M-PESA), Rwanda, Tanzania, Uganda, Zambia                                                                                                                                                   |
| Website country selector    | flutterwave.com/us/: Cameroon, Egypt, Ghana, Ivory Coast, Kenya, Malawi, Mauritius, Nigeria, Rest of Europe, Rwanda, Senegal, South Africa, Tanzania, Uganda, United Kingdom, United States, Zambia                                                        |
| Payout restriction (Zambia) | D4/docs/common-errors.md, code `229400`: payouts to Zambia only for merchants registered in Zambia                                                                                                                                                         |

Sectors, in Flutterwave's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                 | Source and wording                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fintechs               | D4/docs/fintechs.md: "Learn how to optimize fintech operations with ease"; covers payments, lending, savings and investments businesses                   |
| Banks and OFIs         | D4/docs/banks-and-ofis.md: "Discover how banks and OFIs can streamline their operations"; names microfinance banks, mortgage and development institutions |
| Travel and hospitality | D4/docs/travel-and-hospitality.md: airlines, hotels, travel agencies and tour operators                                                                   |
| E-commerce             | D4/docs/e-commerce.md and D/docs/e-commerce.md                                                                                                            |
| Remittance             | D4/docs/remittance.md: "Learn how to deliver transparent cross border payments"                                                                           |
| Telecommunications     | D4/docs/telecommunications.md: mobile data, airtime, broadband and subscription communication services                                                    |

iGaming, adult, crypto (as a merchant sector), nutraceuticals and CBD: **NOT DOCUMENTED** in the pages read. A list of prohibited businesses was not found in the pages read.

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                     | Endpoint(s) / delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Format                                                                                                                                                                        | Relevance                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **v3 REST**                | `https://api.flutterwave.com/v3`: `POST /charges?type=<method>`, `POST /validate-charge`, `GET /transactions/{id}/verify`, `GET /transactions/verify_by_reference`, `GET /transactions/{id}/events`, `POST /transactions/{id}/refund`, `GET /refunds/{id}`, `POST /charges/{flw_ref}/capture` / `void` / `refund`, `POST /transfers`, `GET /transfers/{id}`, `POST /transfers/{id}/retries`, `GET /chargebacks`, `PUT /chargebacks/{id}`, `POST /transactions/{id}/resend-hook`, `POST /payments` (hosted Standard) | JSON (`Content-Type: application/json`); card payloads 3DES-encrypted into a `client` field; bearer secret key                                                                | **Primary.** Documentation default, stable version, most examples                                                   |
| **v3 webhooks**            | POST to the dashboard webhook URL, or to a per-request `callback_url` (transfers) / `callbackurl` (refunds)                                                                                                                                                                                                                                                                                                                                                                                                         | JSON body `{ "event", "data", "event.type", "meta_data"? }`; header `verif-hash`                                                                                              | **Primary.** Final state for asynchronous methods, transfers and chargebacks                                        |
| v3 redirect parameters     | Query string appended to `redirect_url` after Inline / Standard / 3DS: `status`, `tx_ref`, `transaction_id` (or POST body with `#redirect_as_post`)                                                                                                                                                                                                                                                                                                                                                                 | Query string                                                                                                                                                                  | Secondary. Browser-side; Flutterwave says to verify server-side                                                     |
| **v4 REST**                | `https://developersandbox-api.flutterwave.com` (sandbox), `https://f4bexperience.flutterwave.com/` (production): `/customers`, `/payment-methods`, `/charges`, `/orders`, `/orchestration/direct-charges`, `/refunds`, `/chargebacks`, `/transfers`, `/direct-transfers`, `/transfers/recipients`, `/transfers/senders`, `/virtual-accounts`, `/settlements`, `/resend-webhook`                                                                                                                                     | JSON; OAuth 2.0 access token from `https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token`; headers `X-Idempotency-Key`, `X-Trace-Id`, `X-Scenario-Key` | Second. Separate parser: different envelope (`status` `success`/`failed`), `error` object, string IDs with prefixes |
| **v4 webhooks**            | POST to the dashboard webhook URL or transfer `callback_url`                                                                                                                                                                                                                                                                                                                                                                                                                                                        | JSON `{ "webhook_id" (or "id"), "timestamp", "type", "data" }`; header `flutterwave-signature`                                                                                | Second, together with v4 REST                                                                                       |
| v2                         | Older documentation version on the same site                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | NOT DOCUMENTED here (not read)                                                                                                                                                | Out of scope                                                                                                        |
| Virtual card webhooks (v3) | Webhook URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | JSON without `event` (`TransactionId`, `Status`, `Type`, `MaskedPan`, `Otp`)                                                                                                  | Out of scope (card issuing, not payments acceptance)                                                                |

**Recommendation: implement first** the v3 transaction object (charge initiation, validate, verify, `charge.completed` webhook), the v3 transfer object (create, get, `transfer.completed` webhook) and the v3 error envelope. They share one envelope and one field vocabulary and carry the IDs needed for correlation. Add v3 refund and chargeback objects next, then v4 as a separate detector and parser (charges, transfers, `charge.completed`, `transfer.disburse`, the v4 error object and the three v4 code tables).

Which version is "current": the documentation site marks v3 as the stable default and says on D4/docs/environments.md that a merchant "on v3" sees `Public Key`, `Private Key` and `Encryption Key` and can "Switch to v4 live API keys". Flutterwave does not state a deprecation date for v3 in the pages read (**NOT DOCUMENTED**). Both versions must be expected in pasted data.

### 3. Response and error formats

#### 3.1 Content type and encoding

- v3 and v4 responses are JSON (D/reference/introduction-1.md: "You can expect all responses to be returned as JSON").
- Exceptions documented by Flutterwave: a v3 transfer 500 example is an HTML page (`<title>Error</title> ... Internal Server Error`, D/docs/introduction-6.md); a v3 503 transfer example has `status` and `data` but no `message`; v4 rate limiting may return non-JSON pages from intermediaries ("Cloudflare 1015", D4/docs/common-errors.md); the v3 500 example uses a different JSON shape (`error_id`, `message`, `code: "app_error"`, no `status`).
- v3 webhook `meta` on refunds is a JSON-encoded string inside JSON (`"meta": "{\"source\":\"ledgerbalance\"}"`).
- v3 webhook payloads contain a key with a literal dot, `"event.type"`, which must be read as one key, not as a path.

#### 3.2 v3 envelope and objects

Envelope (D/docs/common-errors.md): `status` (`"success"` or `"error"`), `message` (string), `data` (object, array or `null`). Some responses add `meta` (pagination `meta.page_info`, or `meta.authorization` for the next step of a charge). Some initiation responses have **no `data`** at all (PIN/AVS authorization prompts, bank transfer and Ghana/Rwanda/Uganda/Zambia mobile money initiation return only `meta.authorization`).

v3 transaction object (`data` of charge, validate, verify, capture and `charge.completed`), field names as used in the examples:

| Field                                                                                      | Meaning (paraphrase)                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                       | Flutterwave transaction ID (integer). Used for verify, refund, events and resend-hook                                                                    |
| `tx_ref`                                                                                   | Merchant's unique transaction reference                                                                                                                  |
| `flw_ref`                                                                                  | Flutterwave or processor reference; used for validate, capture, void and preauth refund; for NGN bank transfer it is the bank "Session ID"               |
| `order_id` / `order_ref`                                                                   | Present on some methods (francophone mobile money, UK account, Fawry)                                                                                    |
| `amount`, `charged_amount`, `app_fee`, `merchant_fee`, `amount_settled`, `currency`        | Requested amount, amount charged to the customer, Flutterwave fee, merchant-borne fee, amount the merchant receives (verify only)                        |
| `status`                                                                                   | Transaction state (section 5.1)                                                                                                                          |
| `processor_response`                                                                       | **Free-text** processor or instruction message (section 4.5)                                                                                             |
| `auth_model`                                                                               | Authorization model: `PIN`, `VBVSECURECODE`, `NOAUTH` / `noauth`, `AUTH`, `LIPA_MPESA`, `USSD`, `MOBILEMONEY`, `INTERNET_BANKING`, `CAPITEC`, `NIBSS-QR` |
| `payment_type`                                                                             | `card`, `account`, `bank_transfer`, `mpesa`, `ussd`, `mobilemoneysn`, `mobilemoneytz`, `1voucher`, `fawry_pay`, `capitec`, `nibss-qr`, `account-ach-us`  |
| `fraud_status`                                                                             | `ok` in all examples; other values NOT DOCUMENTED                                                                                                        |
| `charge_type`                                                                              | `normal` or `preauth`                                                                                                                                    |
| `auth_url`                                                                                 | Redirect URL or `N/A` / `NO-URL`                                                                                                                         |
| `device_fingerprint`, `ip`, `narration`, `created_at`, `account_id`                        | Device and IP of the payer, description, ISO 8601 timestamp, merchant account number                                                                     |
| `customer` { `id`, `name`, `phone_number`, `email`, `created_at` }                         | Customer block (personal data)                                                                                                                           |
| `card` { `first_6digits`, `last_4digits`, `issuer`, `country`, `type`, `token`, `expiry` } | Card summary; `token` (verify only) is a reusable charge token                                                                                           |
| `meta.authorization` { `mode`, `fields`, `redirect`, `endpoint`, ... }                     | Next step: `pin`, `avs_noauth`, `redirect`, `otp`, `banktransfer`, `ussd`, `qr`, `fawry_pay`, `redirecturl`                                              |

v3 transfer object (create, get, retries, `transfer.completed`): `id`, `account_number`, `bank_code`, `bank_name`, `full_name` (REST) or `fullname` (webhook), `created_at`, `currency`, `debit_currency`, `amount`, `fee`, `status`, `reference`, `meta`, `narration`, `approver`, `complete_message`, `requires_approval`, `is_approved`.

v3 refund object (REST): `id`, `account_id`, `tx_id` (create response) or `transaction_id` (fetch), `flw_ref`, `wallet_id`, `amount_refunded`, `status`, `destination`, `comment`, `settlement_id`, `meta`, `created_at`. The refund **webhook** uses other names: `AmountRefunded`, `FlwRef`, `comments`, `createdAt`, `updatedAt`, `deletedAt`, `walletId`, `AccountId`, `TransactionId`.

v3 chargeback object: `id`, `amount`, `flw_ref`, `status`, `stage`, `comment`, `meta.uploaded_proof`, `meta.history[]` (`action`, `stage`, `date`, `description`, `source`, `url`, `comment`), `due_date`, `settlement_id`, `created_at`, `transaction_id`, `tx_ref`. Chargeback webhooks carry a smaller `data`: `id`, `flw_ref`, `amount`, `comment`, `status`, `stage`, `due_date`, `type` (`local`), `created_at`, `account_id`.

v3 transaction events (`GET /transactions/{id}/events`): array of `{ note, actor, object, action, context, created_at }`, for example `"note": "card charge request successful: request for OTP"`. This is a ready-made timeline source.

#### 3.3 v4 envelope, error object and objects

Success envelope: `status` (`"success"`), `message`, `data`, optional `meta.page_info`. Error envelope (D4/docs/common-errors.md):

| Field                     | Meaning                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `status`                  | `failed`                                                                              |
| `error.type`              | Upper-case error type (`REQUEST_NOT_VALID`, `UNAUTHORIZED`, ...)                      |
| `error.code`              | Code as a **string** of digits (`"10400"`)                                            |
| `error.message`           | Short explanation                                                                     |
| `error.validation_errors` | Array of `{ field_name, message }`                                                    |
| `message`                 | Present only in the 401 and 403 schemas of the OpenAPI definitions (`"UNAUTHORIZED"`) |

v4 charge (`charges_get` schema): `id` (`chg_...`), `amount` (decimal), `fees[]` (`type` such as `vat`, `app`, `merchant`, `stamp_duty`; `amount`), `billing_details`, `currency`, `customer_id` (`cus_...`), `description`, `disputed`, `settled`, `settlement_id`, `meta`, `next_action`, `payment_method_details`, `redirect_url`, `refunded`, `reference` (merchant reference), `status`, `processor_response` { `type`, `code` (two digits), `message` }, `created_datetime`, `descriptor`.

`next_action.type` values (schema discriminator): `redirect_url`, `requires_additional_fields`, `requires_pin`, `requires_requery`, `requires_otp`, `requires_capture`, `payment_instruction`, `requires_bank_transfer`, `qr_code`.

v4 transfer (`transfer_get` schema): `id` (`trf_...`), `type` (`bank`, `mobile_money`, `wallet`, `cash_pickup`, `crypto`), `action` (`instant`, `deferred`, `scheduled`, `retry`, `duplicate`), `reference`, `status`, `reversal` { `reversal_datetime`, `initial_status`, `reconciliation_status`, `reconciliation_type` }, `narration`, `source_currency`, `destination_currency`, `amount` { `value`, `applies_to` }, `fee`, `debit_information`, `extra_information.amount_credited`, `payment_information.proof` ("Session ID"), `retry`, `duplicate`, `disburse_option`, `callback_url`, `provider_response` { `type`, `code` (four digits), `message` }, `recipient`, `sender`, `transfer_purpose`, `meta`, `created_datetime`.

v4 refund: `id` (`rfd_...`), `amount_refunded`, `meta`, `reason` (`duplicate`, `fraudulent`, `requested_by_customer`, `expired_uncaptured_charge`), `status`, `charge_id`, `created_datetime`.

v4 chargeback: `id` (`chb_...` in examples), `charge_id`, `amount`, `meta`, `stage`, `status`, `type` (`local`, `international`), `due_datetime`, `created_datetime`, `updated_datetime`, `settlement_id`, `uploaded_proof`, `comment`, `provider`, `arn`, `initiator`.

#### 3.4 Examples (transcribed; `...` marks fields elided here)

v3 verify, success (D/docs/handling-error-timeouts.md, same example on D/reference/verify-transaction.md):

```json
{
  "status": "success",
  "message": "Transaction fetched successfully",
  "data": {
    "id": 288200108,
    "tx_ref": "LiveCardTest",
    "flw_ref": "YemiDesola/FLW275407301",
    "amount": 100,
    "currency": "NGN",
    "charged_amount": 100,
    "app_fee": 1.4,
    "merchant_fee": 0,
    "processor_response": "Approved by Financial Institution",
    "auth_model": "PIN",
    "status": "successful",
    "payment_type": "card",
    "created_at": "2020-07-15T14:31:16.000Z",
    "account_id": 17321,
    "card": {
      "first_6digits": "232343",
      "last_4digits": "4567",
      "type": "VERVE",
      "token": "...",
      "expiry": "02/23"
    },
    "amount_settled": 98.6,
    "customer": { "...": "..." }
  }
}
```

v3 errors (D/docs/common-errors.md, D/docs/transaction-verification.md):

```json
{ "status": "error", "message": "Authorization required", "data": null }
```

```json
{ "status": "error", "message": "No transaction was found for this id", "data": null }
```

v3 server error, different shape (D/docs/common-errors.md):

```json
{
  "error_id": "ERRNO796977608T1620310828419",
  "message": "Application error. Please contact support",
  "code": "app_error"
}
```

v3 failed charge webhook (D/docs/webhooks.md):

```json
{
  "event": "charge.completed",
  "data": {
    "id": 408136545,
    "tx_ref": "Links-618617883594",
    "flw_ref": "NETFLIX/SM31570678271",
    "amount": 100000,
    "currency": "NGN",
    "processor_response": "invalid token supplied",
    "auth_model": "PIN",
    "status": "failed",
    "payment_type": "card",
    "created_at": "2021-04-16T14:52:37.000Z",
    "account_id": 82913,
    "customer": { "...": "..." },
    "card": { "...": "..." }
  },
  "event.type": "CARD_TRANSACTION"
}
```

v3 failed transfer returned as HTTP 400 with a transfer object (D/reference/create-a-transfer.md, example "Processor Error"):

```json
{
  "status": "error",
  "message": "Transfer creation failed",
  "data": {
    "id": 641154,
    "currency": "TZS",
    "amount": 1000,
    "fee": 1000,
    "status": "FAILED",
    "reference": "4d2ba109f22cd912",
    "complete_message": "beneficiary_name is required",
    "requires_approval": 0,
    "is_approved": 1,
    "...": "..."
  }
}
```

v3 failed transfer webhook (D/docs/webhooks.md):

```json
{
  "event": "transfer.completed",
  "event.type": "Transfer",
  "data": {
    "id": 2207648,
    "bank_code": "044",
    "currency": "NGN",
    "debit_currency": "NGN",
    "amount": 5000000000,
    "fee": 53.75,
    "status": "FAILED",
    "reference": "ionn1594072140865",
    "complete_message": "DISBURSE FAILED: You can only spend NGN 1000000.00 at once",
    "requires_approval": 0,
    "is_approved": 1,
    "...": "..."
  }
}
```

v4 validation error (D4/docs/common-errors.md):

```json
{
  "status": "failed",
  "error": {
    "type": "REQUEST_NOT_VALID",
    "code": "10400",
    "message": "Request is not valid",
    "validation_errors": [
      { "field_name": "payment_method_id", "message": "must not be null" },
      { "field_name": "currency", "message": "must not be null" }
    ]
  }
}
```

v4 charge pending after a timeout (D4/docs/common-errors.md, retrieve response; the redirect token is elided):

```json
{
  "status": "success",
  "message": "Charge fetched",
  "data": {
    "id": "chg_tSn4fdwdwR",
    "amount": 250,
    "next_action": { "type": "redirect_url", "redirect_url": { "url": "..." } },
    "payment_method_details": {
      "type": "bank_account",
      "bank_account": {},
      "id": "pmd_f5hpfzTraH",
      "meta": {}
    },
    "reference": "TRN-vL11q2TcVqhc",
    "status": "pending",
    "processor_response": { "type": "pending", "code": "02" },
    "created_datetime": "2026-05-19T21:42:10.654Z"
  }
}
```

v4 `charge.completed` webhook (D4/docs/card.md):

```json
{
  "webhook_id": "wbk_yXvsB4LzWSwhUCpAPCBR",
  "timestamp": 1739456704200,
  "type": "charge.completed",
  "data": {
    "id": "chg_zam88NgLb7",
    "amount": 2000,
    "currency": "NGN",
    "customer": { "id": "cus_dc0FUyBpd0", "...": "..." },
    "payment_method": {
      "type": "card",
      "card": { "first6": "553188", "last4": "2950", "network": "MASTERCARD", "...": "..." },
      "id": "pmd_ujxuBcf4cJ"
    },
    "reference": "ex61m23ja3feykheoidho8ilrri",
    "status": "succeeded",
    "processor_response": { "type": "approved", "code": "00" },
    "created_datetime": "2025-02-13T14:24:43.133Z"
  }
}
```

v4 `transfer.disburse` webhook (D4/docs/general-transfer-flow.md):

```json
{
  "webhook_id": "wbk_rp0bjKyAWA52ViM8xlZ0",
  "timestamp": 1739877172874,
  "type": "transfer.disburse",
  "data": {
    "id": "trf_yMZATJ11yVPNkZ",
    "type": "BANK",
    "source_currency": "NGN",
    "destination_currency": "NGN",
    "amount": 50000,
    "reference": "5748745ug8ufdgjhveyebjhcdbchb",
    "status": "SUCCESSFUL",
    "fee": { "currency": "NGN", "value": 500 },
    "payment_information": { "proof": "504828363550713897092362940989" },
    "meta": {}
  }
}
```

### 4. Codes

Code strings and type names are exactly as documented. "Meaning" is a short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not Flutterwave statements; where Flutterwave gives advice (for example "Kindly retry"), it is reflected. Unknown values must fall back to `unknown`.

**Code spaces and keys.** v4 collections codes and v4 payout codes share some values with different meanings (`301404` is `RATE_NOT_FOUND` and `TRANSFER_NOT_FOUND` in the payout table; `209400` is used for both cash pickup and mobile money payload errors). Charge and order errors reuse the same numbers (`1100409` is `CHARGE_ALREADY_EXISTS` and `ORDER_ALREADY_EXISTS`). The pair `error.code` + `error.type` decides the meaning; never decode a bare number. In the pages read, most v4 codes end in the HTTP status they accompany (`1100409`, `270400`, `1105500`); this is an observation, not a Flutterwave statement, and the payout codes `0301`-`0314` do not follow it.

#### 4.1 v4 general error codes (D4/docs/common-errors.md, "General Error Codes"): 7 codes

All seven also appear in 4.2 with the same meaning; they are counted once. The general table spells the 401 type `UNAUTHORIZATION`, the collections table and the 401 example spell it `UNAUTHORIZED`.

#### 4.2 v4 collections (inflow) error codes (D4/docs/common-errors.md): 77 rows, 67 distinct codes

| Code      | `error.type`                               | Meaning (paraphrase)                                                 | Category                   | Retry class                     |
| --------- | ------------------------------------------ | -------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `10400`   | `REQUEST_NOT_VALID`                        | Body malformed or required parameters missing                        | invalid_request            | do_not_retry                    |
| `10401`   | `UNAUTHORIZED`                             | Missing, expired or wrong credentials                                | configuration              | do_not_retry                    |
| `10403`   | `FORBIDDEN`                                | Credentials lack permission for the resource                         | configuration              | do_not_retry                    |
| `10404`   | `RESOURCE_NOT_FOUND`                       | Endpoint or object does not exist                                    | invalid_request            | do_not_retry                    |
| `10405`   | `METHOD_NOT_ALLOWED`                       | Wrong HTTP method                                                    | invalid_request            | do_not_retry                    |
| `10409`   | `RESOURCE_CONFLICT`                        | Duplicate or conflicting data                                        | duplicate_request          | do_not_retry                    |
| `10422`   | `UNPROCESSABLE`                            | Well-formed request with invalid field values                        | invalid_request            | do_not_retry                    |
| `10500`   | `INTERNAL_SERVER_ERROR`                    | Unexpected Flutterwave error                                         | provider_unavailable       | retry_conditionally             |
| `701500`  | `INVALID_PAGINATION_TYPE`                  | Page or limit parameters badly formatted                             | invalid_request            | do_not_retry                    |
| `1100409` | `CHARGE_ALREADY_EXISTS`                    | Charge reference already used                                        | duplicate_request          | do_not_retry                    |
| `1101422` | `CUSTOMER_NOT_FOUND_FOR_CHARGE`            | `customer_id` does not exist                                         | invalid_request            | do_not_retry                    |
| `1102422` | `PAYMENT_METHOD_NOT_FOUND_FOR_CHARGE`      | `payment_method_id` invalid or belongs to another customer           | invalid_request            | do_not_retry                    |
| `1104400` | `CARD_NOT_TOKENIZED`                       | Raw card data sent where a token was expected                        | invalid_request            | do_not_retry                    |
| `1105500` | `CHARGE_FAILED`                            | General processing failure upstream                                  | provider_unavailable       | retry_conditionally             |
| `1106400` | `PAYMENT_METHOD_TYPE_MISSING`              | Payment method `type` missing                                        | invalid_request            | do_not_retry                    |
| `1107500` | `CHARGE_CREATION_FAILED`                   | System error while creating the charge; Flutterwave says to retry    | provider_unavailable       | safe_to_retry_technical_request |
| `1108400` | `CARD_RETOKENIZATION_REQUIRED`             | Encryption or token invalid or expired; card must be tokenized again | invalid_request            | customer_action_required        |
| `1110404` | `CHARGE_NOT_FOUND`                         | Charge ID does not exist                                             | invalid_request            | do_not_retry                    |
| `1111400` | `CHARGE_FINALIZED`                         | Charge already has a final status                                    | invalid_request            | do_not_retry                    |
| `1112400` | `CHARGE_UPDATE_NOT_ALLOWED`                | Charge state does not allow the update                               | invalid_request            | do_not_retry                    |
| `1113500` | `CHARGE_UPDATE_FAILED`                     | System error while updating the charge                               | provider_unavailable       | retry_conditionally             |
| `1114400` | `ACCOUNT_ID_NOT_FOUND`                     | Internal merchant account configuration problem                      | configuration              | manual_review                   |
| `1118400` | `INVALID_CARD_NUMBER`                      | Wrong card number length or Luhn check failure                       | invalid_request            | customer_action_required        |
| `1119500` | `FAILED_TO_INITIATE_CHARGE`                | Payment provider rejected the initialization                         | provider_unavailable       | retry_conditionally             |
| `1121400` | `INVALID_AUTHORIZATION`                    | Wrong PIN or OTP                                                     | authentication_failed      | customer_action_required        |
| `1122400` | `FAILED_TO_VALIDATE_EXISTING_CHARGE`       | Error while checking a previous transaction                          | unknown                    | retry_conditionally             |
| `1125400` | `CURRENCY_NOT_SUPPORTED`                   | Currency not supported for this payment type                         | payment_method_unavailable | do_not_retry                    |
| `1126400` | `MOBILE_MONEY_COUNTRY_CODE_NOT_SUPPORTED`  | Country code not valid for mobile money                              | payment_method_unavailable | do_not_retry                    |
| `1127400` | `MOBILE_MONEY_NETWORK_NOT_SUPPORTED`       | Mobile network not supported in the region                           | payment_method_unavailable | do_not_retry                    |
| `1128500` | `PAYMENT_CARD_TOKENIZATION_FAILED`         | Card encryption failed; check keys and logic                         | configuration              | do_not_retry                    |
| `1130400` | `AMOUNT_BELOW_MINIMUM`                     | Amount below the minimum for the payment type                        | invalid_amount             | do_not_retry                    |
| `1134422` | `CARD_EXPIRED`                             | Card has expired                                                     | card_declined              | customer_action_required        |
| `1135422` | `CARD_EXPIRY_YEAR_OUT_OF_RANGE`            | Expiry year invalid                                                  | invalid_request            | customer_action_required        |
| `1136422` | `CARD_EXPIRY_MONTH_OUT_OF_RANGE`           | Expiry month not between 01 and 12                                   | invalid_request            | customer_action_required        |
| `1137400` | `CLIENT_ENCRYPTION_ERROR`                  | Encrypted fields could not be decrypted (wrong key or logic)         | configuration              | do_not_retry                    |
| `1138422` | `UNPROCESSABLE_F4B_RESPONSE`               | Error received from the banking partner system                       | provider_unavailable       | manual_review                   |
| `1139422` | `UNPROCESSABLE_CC_RESPONSE`                | Error received from the card network or scheme                       | provider_unavailable       | manual_review                   |
| `1140400` | `CHARGE_NOT_SUCCESSFUL`                    | Declined by the bank or by fraud checks                              | card_declined              | customer_action_required        |
| `1141400` | `REDIRECT_URL_INVALID`                     | Redirect URL format incorrect                                        | invalid_request            | do_not_retry                    |
| `1142400` | `USSD_BANK_CODE_INVALID`                   | USSD bank code incorrect                                             | invalid_request            | do_not_retry                    |
| `1150400` | `INVALID_CHARGE`                           | Bank transfer charges must use the virtual accounts resource         | invalid_request            | do_not_retry                    |
| `1100409` | `ORDER_ALREADY_EXISTS`                     | Order reference already used                                         | duplicate_request          | do_not_retry                    |
| `1101422` | `CUSTOMER_NOT_FOUND_FOR_ORDER`             | Order `customer_id` invalid                                          | invalid_request            | do_not_retry                    |
| `1102422` | `PAYMENT_METHOD_NOT_FOUND_FOR_ORDER`       | Order `payment_method_id` invalid                                    | invalid_request            | do_not_retry                    |
| `1110404` | `ORDER_NOT_FOUND`                          | Order ID does not exist                                              | invalid_request            | do_not_retry                    |
| `1111400` | `ORDER_FINALIZED`                          | Order already has a final status                                     | invalid_request            | do_not_retry                    |
| `1112400` | `ORDER_UPDATE_NOT_ALLOWED`                 | Order state does not allow updates                                   | invalid_request            | do_not_retry                    |
| `1143400` | `CAPTURE_AMOUNT_INVALID`                   | Capture amount larger than the authorized order amount               | invalid_amount             | do_not_retry                    |
| `1144400` | `PAYMENT_METHOD_MISMATCH`                  | Charge payment method differs from the order's                       | invalid_request            | do_not_retry                    |
| `1144400` | `CUSTOMER_MISMATCH`                        | Charge customer differs from the order's                             | invalid_request            | do_not_retry                    |
| `1144400` | `CURRENCY_MISMATCH`                        | Charge currency differs from the order's                             | invalid_request            | do_not_retry                    |
| `1145400` | `CAPTURE_VOID_NOT_ALLOWED`                 | Order not in a state that allows capture or void                     | invalid_request            | do_not_retry                    |
| `1145400` | `PAYMENT_METHOD_INVALID`                   | Payment method not valid for this order type                         | invalid_request            | do_not_retry                    |
| `1401404` | `REFUND_NOT_FOUND`                         | Refund ID does not exist                                             | invalid_request            | do_not_retry                    |
| `1402400` | `REFUND_AMOUNT_INVALID`                    | Refund larger than the charge amount                                 | invalid_amount             | do_not_retry                    |
| `1403400` | `REFUND_CREATION_FAILED`                   | Refund attempted on a pending transaction                            | invalid_request            | retry_conditionally             |
| `1404400` | `REFUND_ALREADY_COMPLETED`                 | Charge already fully refunded                                        | duplicate_request          | do_not_retry                    |
| `1500404` | `SETTLEMENT_NOT_FOUND`                     | Settlement ID does not exist                                         | invalid_request            | do_not_retry                    |
| `1600400` | `WEBHOOK_URL_INVALID`                      | Webhook URL not a valid HTTP/HTTPS URL                               | configuration              | do_not_retry                    |
| `1601404` | `WEBHOOK_ENDPOINT_NOT_FOUND`               | No webhook configuration for the account                             | configuration              | do_not_retry                    |
| `1602422` | `UNPROCESSABLE_SVIX_RESPONSE`              | Error from the webhook delivery provider (Svix)                      | provider_unavailable       | retry_conditionally             |
| `1603500` | `INTERNAL_SERVER_ERROR_SVIX`               | System failure at the webhook delivery provider                      | provider_unavailable       | retry_conditionally             |
| `1700404` | `CHARGEBACK_NOT_FOUND`                     | Chargeback ID does not exist                                         | invalid_request            | do_not_retry                    |
| `1703400` | `CHARGEBACK_DECLINE_INVALID`               | Declining a chargeback needs a comment and proof                     | invalid_request            | do_not_retry                    |
| `1704400` | `CHARGEBACK_PROOF_INVALID`                 | Uploaded proof corrupted or unsupported format                       | invalid_request            | do_not_retry                    |
| `1705500` | `CHARGEBACK_PROOF_UPLOAD_FAILED`           | System error while uploading proof                                   | provider_unavailable       | retry_conditionally             |
| `1706400` | `CHARGEBACK_DUE_DATE_INVALID`              | Response deadline has passed                                         | invalid_request            | do_not_retry                    |
| `1707400` | `CHARGEBACK_AMOUNT_INVALID`                | Amount does not match the dispute amount                             | invalid_amount             | do_not_retry                    |
| `1708400` | `CHARGEBACK_HAS_EXISTING_CHARGE`           | A dispute already exists for this charge                             | duplicate_request          | do_not_retry                    |
| `1800404` | `CHECKOUT_SESSION_NOT_FOUND`               | Checkout session missing or expired                                  | invalid_request            | do_not_retry                    |
| `1801409` | `CHECKOUT_SESSION_ALREADY_EXISTS`          | Checkout session reference already used                              | duplicate_request          | do_not_retry                    |
| `1900404` | `VIRTUAL_ACCOUNT_NOT_FOUND`                | Virtual account reference does not exist                             | invalid_request            | do_not_retry                    |
| `1900409` | `VIRTUAL_ACCOUNT_REFERENCE_ALREADY_EXISTS` | Virtual account reference already used                               | duplicate_request          | do_not_retry                    |
| `1900500` | `VIRTUAL_ACCOUNT_UPDATE_FAILED`            | System error while updating the virtual account                      | provider_unavailable       | retry_conditionally             |
| `1900500` | `FAILED_TO_CREATE_VIRTUAL_ACCOUNT`         | System error while creating the virtual account                      | provider_unavailable       | retry_conditionally             |
| `10503`   | `VIRTUAL_ACCOUNT_CREATE_TIMEOUT`           | Provider too slow to generate the account; Flutterwave says to retry | network_or_timeout         | safe_to_retry_technical_request |
| `19400`   | `VIRTUAL_ACCOUNT_IS_ALREADY_INACTIVE`      | Virtual account already deactivated                                  | invalid_request            | do_not_retry                    |

#### 4.3 v4 payout error codes (D4/docs/common-errors.md, "Payout Error Codes"): 70 rows, 68 distinct codes

The first 14 codes (`0301`-`0314`) match the `provider_response.type` enum in the transfer schema (section 4.6).

| Code     | `error.type`                                 | Meaning (paraphrase)                                                       | Category                   | Retry class              |
| -------- | -------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `0301`   | `TRANSFER_AMOUNT_EXCEEDS_LIMIT`              | Above the maximum for a single transfer                                    | invalid_amount             | do_not_retry             |
| `0302`   | `TRANSFER_AMOUNT_BELOW_LIMIT`                | Below the minimum transfer amount                                          | invalid_amount             | do_not_retry             |
| `0303`   | `MONTHLY_TRANSFER_LIMIT_EXCEEDED`            | Account's monthly cumulative limit reached                                 | configuration              | retry_conditionally      |
| `0304`   | `DAILY_TRANSFER_LIMIT_EXCEEDED`              | Account's daily cumulative limit reached                                   | configuration              | retry_conditionally      |
| `0305`   | `TRANSFER_LIMIT_NOT_SET_FOR_CURRENCY`        | No limit configured for the currency; contact support                      | configuration              | manual_review            |
| `0306`   | `PAYOUT_CREATION_FAILED`                     | Temporary service timeout; Flutterwave says to retry                       | network_or_timeout         | retry_conditionally      |
| `0307`   | `INSUFFICIENT_BALANCE`                       | Merchant wallet cannot cover amount plus fee                               | insufficient_funds         | retry_conditionally      |
| `0308`   | `SERVICE_UNAVAILABLE`                        | Bank maintenance or network downtime                                       | provider_unavailable       | retry_conditionally      |
| `0309`   | `TRANSFER_FAILED`                            | Destination closed or dormant, or network failure                          | unknown                    | manual_review            |
| `0310`   | `PRICING_NOT_SET`                            | Transfer fee could not be determined; contact support                      | configuration              | manual_review            |
| `0311`   | `CURRENCY_CONVERSION_NOT_SET`                | Exchange rate not configured for a cross-currency transfer                 | configuration              | manual_review            |
| `0312`   | `REJECTED_RECIPIENT_MERCHANT`                | Compliance or risk restriction on the destination                          | fraud_or_risk              | do_not_retry             |
| `0313`   | `INVALID_BANK_CODE`                          | Bank code incorrect or outdated                                            | invalid_request            | do_not_retry             |
| `0314`   | `UNABLE_TO_DETERMINE_COUNTRY`                | Country not derivable from bank code, or bank code and currency mismatch   | invalid_request            | do_not_retry             |
| `270400` | `RECIPIENT_NOT_FOUND`                        | `recipient_id` does not exist                                              | invalid_request            | do_not_retry             |
| `270409` | `RECIPIENT_ALREADY_EXISTS`                   | Recipient already created                                                  | duplicate_request          | do_not_retry             |
| `280409` | `SENDER_ALREADY_EXISTS`                      | Sender already created                                                     | duplicate_request          | do_not_retry             |
| `280400` | `SENDER_NOT_FOUND`                           | `sender_id` does not exist                                                 | invalid_request            | do_not_retry             |
| `281400` | `UNKNOWN_SENDER_TYPE`                        | Sender `type` not supported                                                | invalid_request            | do_not_retry             |
| `262400` | `ACCOUNT_DETAILS_CHANGED`                    | Bank updated or migrated the account details                               | invalid_request            | customer_action_required |
| `260400` | `BENEFICIARY_ACCOUNT_NOT_SUPPORTED`          | Receiving account type not supported                                       | payment_method_unavailable | do_not_retry             |
| `252400` | `UNKNOWN_BANK_CODE`                          | Bank code not recognized                                                   | invalid_request            | do_not_retry             |
| `251400` | `INVALID_ACCOUNT`                            | Account number invalid or nonexistent                                      | invalid_request            | customer_action_required |
| `250400` | `ACCOUNT_VERIFICATION_FAILED`                | Account details could not be verified with the bank                        | invalid_request            | customer_action_required |
| `501422` | `RATE_UNAVAILABLE_ERROR`                     | Exchange rate for the pair currently unavailable                           | provider_unavailable       | retry_conditionally      |
| `301404` | `RATE_NOT_FOUND`                             | Rate ID does not exist                                                     | invalid_request            | do_not_retry             |
| `404400` | `REQUIRES_FAILED_STATUS`                     | Only failed transfers can be retried                                       | invalid_request            | do_not_retry             |
| `201409` | `REFERENCE_ALREADY_EXISTS`                   | Transfer reference already used                                            | duplicate_request          | do_not_retry             |
| `403400` | `SCHEDULED_DEFERRED_NOT_ALLOWED`             | Scheduled or deferred transfers cannot be retried or duplicated            | invalid_request            | do_not_retry             |
| `401400` | `REQUIRES_SUCCESSFUL_STATUS`                 | Only successful transfers can be duplicated                                | invalid_request            | do_not_retry             |
| `204400` | `REQUIRES_DISBURSE_OPTION`                   | Scheduled payout without `disburse_option`                                 | invalid_request            | do_not_retry             |
| `205400` | `REQUIRES_TIMEZONE`                          | `disburse_option.timezone` missing                                         | invalid_request            | do_not_retry             |
| `206400` | `REQUIRES_DATETIME`                          | `disburse_option.date_time` missing                                        | invalid_request            | do_not_retry             |
| `231400` | `INVALID_DISBURSE_DATETIME`                  | `date_time` not in `YYYY-MM-DD HH:MM:SS` 24-hour format                    | invalid_request            | do_not_retry             |
| `207400` | `DISBURSETIME_RESTRICTION`                   | Scheduled time must be more than 30 minutes ahead                          | invalid_request            | do_not_retry             |
| `215400` | `COMPLIANCE_APPROVAL_REQUIRED`               | Merchant KYC not completed                                                 | configuration              | manual_review            |
| `214400` | `TRANSFER_SERVICE_UNAVAILABLE`               | Transfer service temporarily unavailable or disabled                       | provider_unavailable       | retry_conditionally      |
| `216400` | `TRANSFER_SOURCE_REQUIRED`                   | No transfer preference selected in dashboard settings                      | configuration              | do_not_retry             |
| `217400` | `TRANSFER_SOURCE_DISABLED`                   | Transfers disabled for the account                                         | configuration              | do_not_retry             |
| `218400` | `API_TRANSFER_DISABLED`                      | Transfers via API not enabled                                              | configuration              | do_not_retry             |
| `219400` | `NG_DOM_TRANSFER_UNAVAILABLE`                | This transfer option temporarily unavailable                               | payment_method_unavailable | retry_conditionally      |
| `220400` | `IP_WHITELISTING_REQUIRED`                   | No IP addresses whitelisted                                                | configuration              | do_not_retry             |
| `221400` | `NON_WHITELISTED_IP`                         | Request from an IP that is not whitelisted                                 | configuration              | do_not_retry             |
| `222400` | `BLACKLISTED_IP`                             | Request from a blocked IP                                                  | fraud_or_risk              | manual_review            |
| `223400` | `BLACKLISTED_ACCOUNT_NUMBER`                 | Destination account blocked                                                | fraud_or_risk              | do_not_retry             |
| `226400` | `XAF_TRANSFER_ONLY`                          | Only XAF-to-XAF transfers allowed without approval                         | configuration              | do_not_retry             |
| `405400` | `POSSIBLE_DUPLICATE_RETRIES`                 | A previous retry is pending or succeeded                                   | duplicate_request          | do_not_retry             |
| `227400` | `TRANSFER_OPTION_UNAVAILABLE`                | Requested transfer type temporarily unavailable                            | payment_method_unavailable | retry_conditionally      |
| `228400` | `TRANSFER_AMOUNT_LIMIT`                      | Amount outside the allowed minimum or maximum                              | invalid_amount             | do_not_retry             |
| `229400` | `ZAMBIA_TRANSFER_UNAVAILABLE`                | Zambia payouts only for merchants registered and approved in Zambia        | configuration              | do_not_retry             |
| `230400` | `UNSUPPORTED_MOBILE_MONEY_COUNTRY`           | XOF mobile money destination country not supported                         | payment_method_unavailable | do_not_retry             |
| `230401` | `INVALID_MOBILE_NUMBER`                      | MSISDN format invalid for the destination (Republic of the Congo XAF rule) | invalid_request            | customer_action_required |
| `301404` | `TRANSFER_NOT_FOUND`                         | Transfer ID does not exist                                                 | invalid_request            | do_not_retry             |
| `210400` | `INVALID_CURSOR`                             | Pagination cursor (`next`) invalid                                         | invalid_request            | do_not_retry             |
| `212400` | `MERCHANT_WALLET_NOT_FOUND`                  | No wallet for the destination currency                                     | configuration              | do_not_retry             |
| `213400` | `UNSUPPORTED_CURRENCY_PAIRS`                 | Source and destination currencies cannot be combined                       | payment_method_unavailable | do_not_retry             |
| `302400` | `INVALID_TRANSFER_STATUS`                    | Only transfers in `NEW` status can be updated                              | invalid_request            | do_not_retry             |
| `208400` | `INVALID_DISBURSE_ACTION`                    | Disburse `action` not one of the supported values                          | invalid_request            | do_not_retry             |
| `304400` | `TIME_LIMIT_EXCEEDED`                        | Scheduled or deferred time passed before processing                        | invalid_request            | do_not_retry             |
| `303400` | `TRANSFER_NOT_DEFERRED_SCHEDULED`            | Only deferred or scheduled transfers can be updated                        | invalid_request            | do_not_retry             |
| `211400` | `INVALID_TRANSFER_TYPE`                      | Transfer `type` not supported                                              | invalid_request            | do_not_retry             |
| `261400` | `UNABLE_TO_CONFIRM_BANK_NOT_COP_PARTICIPANT` | Beneficiary bank not in the Confirmation of Payee service                  | payment_method_unavailable | manual_review            |
| `209400` | `UNSUPPORTED_CASHPICKUP_INSTRUCTION`         | Cash pickup payload invalid (syntax error)                                 | invalid_request            | do_not_retry             |
| `232400` | `UNSUPPORTED_CRYPTO_INSTRUCTION`             | Crypto payload invalid (syntax error)                                      | invalid_request            | do_not_retry             |
| `209400` | `UNSUPPORTED_MOMO_INSTRUCTION`               | Mobile money payload invalid (syntax error)                                | invalid_request            | do_not_retry             |
| `203400` | `UNSUPPORTED_BANK_INSTRUCTION`               | Bank transfer payload invalid (syntax error)                               | invalid_request            | do_not_retry             |
| `202400` | `UNSUPPORTED_WALLET_INSTRUCTION`             | Wallet transfer payload invalid (syntax error)                             | invalid_request            | do_not_retry             |
| `202500` | `TRANSFER_HANDLER_NOT_SET`                   | Internal error; retry later                                                | provider_unavailable       | retry_conditionally      |
| `10500`  | `INTERNAL_SERVER_ERROR`                      | Unexpected error; contact support                                          | provider_unavailable       | retry_conditionally      |
| `253400` | `MERCHANT_DOES_NOT_EXIST`                    | Merchant ID (wallet transfer destination) does not exist                   | invalid_request            | do_not_retry             |

For payouts, "retry_conditionally" means: query the transfer by `reference` first; Flutterwave's v3 transfer guide says to re-initiate only when no record exists.

#### 4.4 v4 card `processor_response` (D4/reference/charges_get.md schema `processor_response` enum; the same names are the `issuer:` values on D4/docs/testing.md): 45 codes

`processor_response` is an object `{ "type", "code", "message" }`; `code` is two digits. The `message` field carries the processor's free text ("Insufficient funds." in the schema example).

| Code | `type`                                 | Meaning (paraphrase)                                  | Category                | Retry class              |
| ---- | -------------------------------------- | ----------------------------------------------------- | ----------------------- | ------------------------ |
| `00` | `approved`                             | Approved                                              | (success)               | n/a                      |
| `01` | `refer_to_issuer`                      | Issuer asks the cardholder to contact it              | card_declined           | customer_action_required |
| `02` | `refer_to_issuer_special_condition`    | Refer to issuer, special condition                    | card_declined           | customer_action_required |
| `03` | `invalid_merchant`                     | Merchant not valid for this transaction               | configuration           | manual_review            |
| `04` | `pick_up_card_no_fraud`                | Card to be retained, no fraud indicated               | card_declined           | do_not_retry             |
| `05` | `do_not_honor`                         | Generic issuer decline                                | card_declined           | customer_action_required |
| `06` | `error`                                | Processing error                                      | unknown                 | retry_conditionally      |
| `07` | `pick_up_card_fraud`                   | Card to be retained, fraud indicated                  | fraud_or_risk           | do_not_retry             |
| `10` | `partial_approval`                     | Only part of the amount approved                      | unknown                 | manual_review            |
| `12` | `invalid_transaction`                  | Transaction not valid                                 | invalid_request         | do_not_retry             |
| `13` | `invalid_amount`                       | Amount not valid                                      | invalid_amount          | do_not_retry             |
| `14` | `invalid_account_number`               | Card or account number not valid                      | card_declined           | customer_action_required |
| `15` | `no_such_issuer`                       | Issuer unknown                                        | card_declined           | customer_action_required |
| `19` | `reenter_transaction`                  | Submit the transaction again                          | network_or_timeout      | retry_conditionally      |
| `21` | `no_action_taken`                      | Issuer took no action                                 | unknown                 | manual_review            |
| `25` | `unable_to_locate_record_in_file`      | Record not found at the issuer                        | unknown                 | manual_review            |
| `28` | `file_temporarily_not_available`       | Issuer file temporarily unavailable                   | provider_unavailable    | retry_conditionally      |
| `41` | `lost_card_pick_up`                    | Card reported lost                                    | fraud_or_risk           | do_not_retry             |
| `43` | `stolen_card_pick_up`                  | Card reported stolen                                  | fraud_or_risk           | do_not_retry             |
| `51` | `insufficient_funds`                   | Not enough funds                                      | insufficient_funds      | customer_action_required |
| `52` | `no_checking_account`                  | No checking account                                   | card_declined           | customer_action_required |
| `53` | `no_savings_account`                   | No savings account                                    | card_declined           | customer_action_required |
| `54` | `expired_card`                         | Card expired                                          | card_declined           | customer_action_required |
| `55` | `incorrect_pin`                        | Wrong PIN                                             | authentication_failed   | customer_action_required |
| `57` | `transaction_not_permitted_card`       | Transaction not allowed for this card                 | card_declined           | customer_action_required |
| `58` | `transaction_not_permitted_terminal`   | Transaction not allowed for this terminal or merchant | configuration           | manual_review            |
| `59` | `suspected_fraud`                      | Issuer suspects fraud                                 | fraud_or_risk           | do_not_retry             |
| `61` | `exceeds_approval_amount_limit`        | Above the card's amount limit                         | card_declined           | customer_action_required |
| `62` | `invalid_restricted_service_code`      | Restricted card                                       | card_declined           | customer_action_required |
| `63` | `security_violation`                   | Security violation                                    | fraud_or_risk           | do_not_retry             |
| `64` | `transaction_does_not_fulfill_aml_req` | Anti-money-laundering requirement not met             | fraud_or_risk           | manual_review            |
| `65` | `exceeds_withdrawal_limit`             | Above the card's frequency or withdrawal limit        | card_declined           | customer_action_required |
| `70` | `pin_data_required`                    | PIN needed                                            | authentication_required | customer_action_required |
| `75` | `pin_entry_tries_exceeded`             | Too many wrong PIN attempts                           | authentication_failed   | customer_action_required |
| `76` | `unsolicited_reversal`                 | Reversal without a matching request                   | unknown                 | manual_review            |
| `78` | `blocked_first_use`                    | Card blocked until first use activation               | card_declined           | customer_action_required |
| `79` | `already_reversed`                     | Transaction already reversed                          | duplicate_request       | do_not_retry             |
| `82` | `negative_cvv_result`                  | CVV check failed                                      | authentication_failed   | customer_action_required |
| `85` | `no_reason_to_decline`                 | No reason to decline (verification-type answer)       | unknown                 | manual_review            |
| `86` | `cannot_verify_pin`                    | PIN could not be verified                             | authentication_failed   | customer_action_required |
| `91` | `issuer_unavailable`                   | Issuer or switch not reachable                        | provider_unavailable    | retry_conditionally      |
| `92` | `unable_to_route_transaction`          | Transaction could not be routed                       | provider_unavailable    | retry_conditionally      |
| `93` | `cannot_complete_violation_of_law`     | Cannot complete, legal violation                      | fraud_or_risk           | do_not_retry             |
| `96` | `system_error`                         | System malfunction                                    | provider_unavailable    | retry_conditionally      |
| `97` | `invalid_cvv`                          | CVV invalid                                           | invalid_request         | customer_action_required |

The v4 timeout example on D4/docs/common-errors.md uses `{ "type": "pending", "code": "02" }`, which is not in this enum and collides with `02` (`refer_to_issuer_special_condition`). The `type`, not the code alone, must decide (see section 10).

#### 4.5 v3 messages (no numeric codes)

v3 errors and declines are free text in `message` (error envelope), `data.processor_response` (transactions) or `data.complete_message` (transfers). The lists below are every relevant value found in the pages read; Flutterwave describes none of them as exhaustive. Matching should be case-insensitive and prefix-based where a message embeds variable text.

v3 error `message` values (envelope `status: "error"`):

| Message (as documented; `<...>` = variable part)                                                   | Source                                    | Category                   | Retry class              |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------- | ------------------------ |
| `merchant secret key required`                                                                     | D/docs/common-errors.md                   | configuration              | do_not_retry             |
| `Authorization required` (HTTP 401)                                                                | D/docs/common-errors.md                   | configuration              | do_not_retry             |
| `Cardno is required` (HTTP 400)                                                                    | D/docs/common-errors.md                   | invalid_request            | do_not_retry             |
| `<field> is required` (for example `amount is required`, `transaction_reference is required`)      | introduction-6, validate-a-charge         | invalid_request            | do_not_retry             |
| `Please specify the following parameters in body: <fields>`                                        | Ghana mobile money, NQR references        | invalid_request            | do_not_retry             |
| `Application error. Please contact support` (HTTP 500, `code: app_error`)                          | D/docs/common-errors.md                   | provider_unavailable       | retry_conditionally      |
| `An error occurred. Please contact support` (HTTP 503 timeout)                                     | D/docs/handling-error-timeouts.md         | network_or_timeout         | retry_conditionally      |
| `No transaction was found for this id`                                                             | D/docs/transaction-verification.md        | invalid_request            | do_not_retry             |
| `invalid currency`                                                                                 | D/reference/charge-nigerian-bank-accounts | invalid_request            | do_not_retry             |
| `Bad Request - Invalid PhoneNumber`                                                                | D/reference/charge-via-mpesa              | invalid_request            | customer_action_required |
| `Merchant is not enabled for Capitec Collections`                                                  | D/reference/capitec                       | configuration              | do_not_retry             |
| `Merchant does not accept <cardType> card type`                                                    | D/docs/direct-card-charge.md              | payment_method_unavailable | customer_action_required |
| `Wrong token or email passed`                                                                      | D/reference/charge-with-token-1           | invalid_request            | do_not_retry             |
| `Card expired. You've exceeded the failed attempt limit on this card. ... Ref: <hex>`              | D/docs/direct-card-charge.md (velocity)   | card_declined              | customer_action_required |
| `Your card has been temporarily restricted due to multiple incorrect PIN attempts. ... Ref: <hex>` | D/docs/direct-card-charge.md (velocity)   | authentication_failed      | customer_action_required |
| `Declined: Restricted card. You've exceeded the failed attempt limit on this card. ... Ref: <hex>` | D/docs/direct-card-charge.md (velocity)   | card_declined              | customer_action_required |
| `Transaction with ref <flw_ref> either does not exist or is not a valid preauth transaction`       | D/docs/preauthorization.md                | invalid_request            | do_not_retry             |
| `Total amount for multiple captures must not exceed preauth charged amount.`                       | D/docs/preauthorization.md                | invalid_amount             | do_not_retry             |
| `Amount should be above NGN100` (refund minimum)                                                   | D/docs/refunds.md                         | invalid_amount             | do_not_retry             |
| `Error: Refund Id Not Found`                                                                       | D/reference/get-transaction-refunds       | invalid_request            | do_not_retry             |
| `no hook data found` (resend webhook)                                                              | D/reference/resend-transaction-webhook    | invalid_request            | do_not_retry             |
| `Transfer creation failed` (with `data.status` `FAILED`; reason in `data.complete_message`)        | D/reference/create-a-transfer             | unknown                    | manual_review            |
| `No account number or recipient identifier passed`                                                 | D/reference/create-a-transfer             | invalid_request            | do_not_retry             |
| `Payout with this ref already exists`                                                              | D/reference/create-a-transfer             | duplicate_request          | do_not_retry             |
| `Payout was made to a blacklisted account number`                                                  | D/docs/testing.md                         | fraud_or_risk              | do_not_retry             |
| `Transfer not found` (HTTP 404)                                                                    | D/reference/get-a-transfer                | invalid_request            | do_not_retry             |
| `Insufficient funds in merchant's NGN wallet` (OTP generation)                                     | D/reference/create-otp                    | insufficient_funds         | retry_conditionally      |

Card velocity limits (D/docs/direct-card-charge.md): after certain card errors, an immediate retry returns a velocity message instead of the original error. The documented trigger errors and limits are: `Expired card` (1 attempt per month), `Expired card capture` (1 per month), `Invalid card number` (2 per 24 hours), `PIN tries exceeded` (2 per 24 hours), `Restricted card` (1 per 24 hours), `Security violation` (2 per 24 hours), `Stolen card` (1 per month), `Suspected fraud` (1 per 24 hours). Flutterwave advises against automatic retries for failed card charges. Suggested: treat all eight as `do_not_retry` for automatic retries.

v3 `processor_response` values (transaction object):

| Value(s)                                                                                                                                                                                                                                                        | Seen with `status`                                              | Suggested reading                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `Approved`, `APPROVED`, `Approved by Financial Institution`, `Approved Or Completed Successfully`, `Approved. Successful`                                                                                                                                       | `successful` (also `pending` on preauth initiation)             | Success                                           |
| `successful`, `Successful`, `success`, `Transaction successful`, `Transaction Successful`, `received successfully`, `request successful`                                                                                                                        | `successful` (`Successful` also on a pending M-PESA initiation) | Success or accepted; status decides               |
| `Transaction in progress`, `Pending validation`, `Pending Validation`, `Request is pending`, `transaction is pending`, `Pending user action`, `Request Accepted`, `QR GENERATED. PENDING VALIDATION`, `You have 10 minutes to complete this payment. Thank You` | `pending` (and `success-pending-validation`)                    | Waiting for the customer or the bank              |
| `Pending redirect to issuer's 3DS authentication page`                                                                                                                                                                                                          | `pending`                                                       | authentication_required, customer_action_required |
| `Kindly enter the OTP sent to <masked phone>`                                                                                                                                                                                                                   | `pending`                                                       | authentication_required, customer_action_required |
| `invalid token supplied`                                                                                                                                                                                                                                        | `failed`                                                        | invalid_request, do_not_retry                     |
| `Transaction cancelled by user`                                                                                                                                                                                                                                 | `failed`                                                        | customer_action_required                          |
| `Your payment has been declined. It looks like the consent request was not approved. ...`                                                                                                                                                                       | `failed` (Capitec)                                              | authentication_failed, customer_action_required   |
| `Charge voided`                                                                                                                                                                                                                                                 | `successful` (void response)                                    | Void; see section 10                              |

Test-mode failure scenarios named by Flutterwave (D/docs/testing.md), useful for synthetic fixtures but not message strings: card scenarios "Do Not Honour", "Card Fraudulent", "Insufficient Funds", "Incorrect PIN"; OTPs `5548` (wrong OTP) and `6648` (insufficient funds); mobile money "Mocked a Failed Transaction" and "Mocked a Wave Failed Transaction"; Capitec scenarios Failed, Fraud, Declined, Timeout, Pending.

v3 transfer `complete_message` values:

| Value                                                        | Source                                   | Suggested reading                         |
| ------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------- |
| empty string                                                 | `NEW` transfers                          | Not yet processed                         |
| `Transaction is currently being processed`                   | `PENDING` (also on a `FAILED` retry row) | In progress                               |
| `Transaction was successful`, `Successful`                   | `SUCCESSFUL`                             | Success                                   |
| `DISBURSE FAILED: You can only spend NGN 1000000.00 at once` | D/docs/webhooks.md                       | invalid_amount, do_not_retry              |
| `DISBURSE FAILED: Insufficient funds in customer wallet`     | D/docs/introduction-6.md                 | insufficient_funds, retry_conditionally   |
| `DISBURSE FAILED: Invalid admin user passed`                 | D/docs/introduction-6.md                 | unknown, manual_review                    |
| `Beneficiary not found`                                      | D/docs/introduction-6.md                 | invalid_request, customer_action_required |
| `Account resolve failed` (named in prose)                    | D/docs/introduction-6.md                 | invalid_request, customer_action_required |
| `beneficiary_name is required`                               | D/reference/create-a-transfer            | invalid_request, do_not_retry             |

The `DISBURSE FAILED: ` prefix also appears in the v4 `provider_response.message` example (`DISBURSE FAILED: Insufficient wallet balance`).

#### 4.6 v4 payout `provider_response.type` (D4/reference/transfer_get.md): 15 values

`transfer_amount_exceeds_limit`, `transfer_amount_below_limit`, `monthly_transfer_limit_exceeded`, `daily_transfer_limit_exceeded`, `transfer_limit_not_set_for_currency`, `payout_creation_failed`, `insufficient_balance`, `service_unavailable`, `transfer_failed`, `pricing_not_set`, `currency_conversion_not_set`, `rejected_recipient_merchant`, `invalid_bank_code`, `unable_to_determine_country` (these 14 are the lower-case forms of codes `0301`-`0314` in 4.3, and `code` is "four digits"), and `invalid_wallet_currency` (no code or meaning documented).

#### 4.7 Count summary

| Table                                  | Rows | Distinct values                                             |
| -------------------------------------- | ---- | ----------------------------------------------------------- |
| v4 collections error codes (4.2)       | 77   | 67                                                          |
| v4 payout error codes (4.3)            | 70   | 68                                                          |
| v4 card `processor_response` (4.4)     | 45   | 45                                                          |
| **v4 numeric codes, total**            | 192  | **180** (179 across tables, `10500` is in both 4.2 and 4.3) |
| v4 `provider_response.type` (4.6)      | 15   | 15 (14 map to 4.3)                                          |
| v3 error `message` values (4.5)        | 27   | 27                                                          |
| v3 failure `processor_response` values | 3    | 3 (plus pending and success phrasings)                      |
| v3 transfer failure `complete_message` | 6    | 6                                                           |
| v3 card velocity trigger errors        | 8    | 8                                                           |

### 5. Lifecycle

#### 5.1 Charges (collections)

v3 transaction `data.status` values seen in the pages read: `successful`, `failed`, `pending`, `success-pending-validation` (ACH initiation), `pending-capture` (preauth webhook). The envelope `status` (`success` / `error`) is about the API call, not the payment: Flutterwave notes that a charge can have envelope `status: "success"` and `data.status: "pending"` (D/docs/direct-card-charge.md). A complete list of `data.status` values is **NOT DOCUMENTED** for v3.

v3 card flow (D/docs/direct-card-charge.md): initiate (`POST /charges?type=card`) -> response with `meta.authorization.mode` `pin` or `avs_noauth` and no `data` -> resend with `authorization` -> `data.status` `pending` and `mode` `otp` (validate via `/validate-charge` with `flw_ref`) or `redirect` (3DS, no validation step) -> `successful` or `failed` -> verify (`/transactions/{id}/verify`). With no authorization required, the first response is already `successful` or `failed`.

v3 preauthorization (D/docs/preauthorization.md, approval required): initiate with `preauthorize: true` (`charge_type: preauth`, `data.status` `pending`, webhook `preauth-card` with `status` `pending-capture`) -> capture once or several times (`charge.completed`, `status` `successful`) -> or void (manual, or automatic after 7 days) -> refund of captured amounts.

v3 asynchronous methods: mobile money (M-PESA and the redirect-based networks), USSD, NQR, bank transfer, Fawry, Capitec and ACH return `pending` on initiation; completion arrives later by `charge.completed` webhook (D/docs/m-pesa.md, D/docs/ngn-bank-transfer.md). For NGN virtual accounts, an underpayment is reversed automatically and an overpayment is accepted with the excess reversed; for GHS virtual accounts, under- or overpayment results in a failed transaction (D/docs/ngn-virtual-accounts.md, D/docs/ghs-virtual-accounts.md).

v3 timeouts (D/docs/handling-error-timeouts.md): Flutterwave waits about 28 seconds, then returns 503. For charges, payouts and bill payments, query the status before retrying; if the status is `pending`, wait for the webhook; retry only when no transaction is found.

v4 charge `status`: `succeeded`, `pending`, `failed`, `voided` (schema `charge_status`). Authorization is driven by `next_action.type` (section 3.3) and completed with `PUT /charges/{id}` carrying an `authorization` object (`pin`, `otp`, `avs`). v4 timeouts (D4/docs/common-errors.md): charge and order requests that hit 25-28 seconds return HTTP 201 with `next_action.type` `requires_requery` and `status` `pending`; the merchant must not retry, should retrieve the charge after 20 seconds and again after 40 seconds; "Transactions that remain unresolved after a minute will transition to a failed status".

#### 5.2 Refunds

v3 (D/docs/refunds.md): `POST /transactions/{id}/refund` with optional `amount` (partial) and `comments`. Refund statuses:

| Status                    | Meaning (paraphrase)                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| `completed`               | Initiated and **waiting for disbursement** (not final, despite the name) |
| `completed-bank-transfer` | Refund to bank account succeeded                                         |
| `completed-momo`          | Refund to mobile money succeeded                                         |
| `completed-mpgs`          | Refund succeeded (card)                                                  |
| `completed-offline`       | Processed offline or manually                                            |
| `completed-preauth`       | Successful refund of a preauth card transaction                          |
| `pending-momo`            | Mobile money refund pending                                              |
| `pending-bank-transfer`   | Bank account refund pending                                              |
| `pending-mpgs`            | Card refund pending                                                      |
| `processing`              | Being processed                                                          |

Timing: card refunds 3-15 days, mobile money 3-5 days, bank accounts within 24 hours. Refund webhook `meta` may contain `disburse_status` (`failed` in both examples) and `isPartialRefund`. Minimums NGN 100 and KES 10.

v4 (D4/docs/refunds.md, schema `refund`): `new` -> `pending` -> `succeeded` or `failed`; the schema also lists `requires_action`, `cancelled` and `completed`, and the create example returns `completed`. Partial refunds allowed until the sum equals the charge amount.

#### 5.3 Chargebacks

v3 statuses (D/docs/chargebacks.md, table capitalized, payloads lower case): `initiated` (amount withheld, merchant notified), `pending` (notified, no action), `accepted`, `declined` (with proof), `won`, `lost` (dispute failed or no response before the due date), `reversed` (withheld amount restored). Stages: `new`, `second`, `pre-arbitration`. v4 adds stages `arbitration` and `invalid` and status `new` (schema). Response windows: 10 working hours (local) and 30 working hours (international) from notification on the v3 page; the `lost` row says "48 hours"; `due_date` / `due_datetime` carry the actual deadline. `meta.history[].action` values seen: `initiated`, `notification`, `accept`, `decline`. Bank transfer disputes ("reversals") are handled by e-mail and may lead to a chargeback; no API object is documented for them.

#### 5.4 Transfers (payouts), kept separate from charges

v3 `data.status` (D/docs/introduction-6.md): `NEW` (created, `complete_message` empty) -> `PENDING` (processing) -> `SUCCESSFUL` or `FAILED` (`complete_message` holds the reason). Failed transfers can be retried with `POST /transfers/{id}/retries`; each retry is a new transfer with `reference` `<original>_RETRY_<n>`. Transfers may require approval (`requires_approval`, `is_approved`, `approver`). In test mode, transfers stay `PENDING` unless the reference ends in `_PMCK` (succeeds) or `_PMCK_ST_F` (fails), optionally with `DU_<minutes>`.

v4 (schema `transfer_get`): `NEW`, `PENDING`, `FAILED`, `SUCCESSFUL`, `CANCELLED`, `INITIATED`; webhook `transfer.disburse` carries `FAILED` or `SUCCESSFUL`; a later `transfer.reversal` carries `reversal.initial_status` (`SUCCESSFUL`) and `reversal.reconciliation_status` (`REVERSED`) with `reconciliation_type` `D` or `C`. A successful payout can therefore be reversed after the fact. Actions `instant`, `deferred`, `scheduled`, `retry`, `duplicate`.

Wallet funding and payout sub-account inflows also arrive as v3 `transfer.completed` events (`narration` `WALLET FUNDING`, `debit_currency` `PSA`), so `transfer.completed` is not always an outgoing payout.

#### 5.5 Authorized, captured and settled

v3: preauth `charge_type: preauth` with capture and void as above; settlement amount in `amount_settled`, settlement linkage via refund and chargeback `settlement_id` (values such as `NEW`, `N/A` or numeric strings). v4: `settled`, `settlement_id`, `disputed`, `refunded` booleans and `next_action.type` `requires_capture`. Settlement timing is **NOT DOCUMENTED** in the pages read.

### 6. Webhooks

#### 6.1 Delivery, acknowledgement and retries

| Point           | v3 (D/docs/webhooks.md)                                                                                         | v4 (D4/docs/webhooks.md)                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Method and body | HTTPS POST, JSON                                                                                                | HTTPS POST, JSON                                                 |
| Acknowledgement | HTTP `200` only; any other code, including `3xx`, is a failure; body and headers ignored                        | Same                                                             |
| Timeout         | 60 seconds                                                                                                      | 60 seconds                                                       |
| Retries         | Only if retries are enabled in the dashboard: 3 retries, 30 minutes apart                                       | Same                                                             |
| Manual resend   | `POST /transactions/{id}/resend-hook`; `POST /transfers/{id}/resend-hook` for transfers                         | `POST /resend-webhook`                                           |
| Source IPs      | Dynamic; Flutterwave advises against IP whitelisting                                                            | NOT DOCUMENTED                                                   |
| Ordering        | **NOT DOCUMENTED**                                                                                              | **NOT DOCUMENTED**                                               |
| Other channels  | Transfer `callback_url` and refund `callbackurl` receive the same payloads; chargeback webhooks only on request | Transfer `callback_url` receives the same payload as the webhook |

#### 6.2 Event types

v3 `event` values seen: `charge.completed` (all payment methods, success and failure, preauth capture), `preauth-card`, `transfer.completed` (payouts, wallet funding, payout sub-account inflows), `chargeback.initiated`, `chargeback.accepted`, `chargeback.declined`, `chargeback.lost`, `subscription.cancelled`, `bvn.completed`, `singlebillpayment.status`, `account.tokenize`, `quote.completed`. `chargeback.won` and `chargeback.reversed` are **NOT DOCUMENTED** as event names although the statuses exist.

v3 `event.type` values seen: `CARD_TRANSACTION`, `BANK_TRANSFER_TRANSACTION`, `ACCOUNT_TRANSACTION`, `ACCOUNT-ACH-UK_TRANSACTION`, `MOBILEMONEYZM_TRANSACTION`, `OPAY_TRANSACTION`, `ENAIRA_TRANSACTION`, `FAWRY_PAY_TRANSACTION`, `CAPITEC_TRANSACTION`, `1VOUCHER_TRANSACTION`, `Transfer`, `BVN`, `QUOTE`, `SingleBillPayment`. Several examples omit `event.type`.

v3 payloads **without** an `event` key: the refund webhook (bare refund object with PascalCase keys) and the virtual card debit and OTP notifications.

v4 `type` values: `charge.completed`, `transfer.disburse`, `transfer.reversal`, `order.authorization` (schema `base_webhook_payload` enum) and `refund.completed` (separate schema).

#### 6.3 Signature fields (sensitive; PandaPayLens does not verify them)

- **v3 `verif-hash` header**: Flutterwave sends the merchant's secret hash **itself** in this header, and the merchant compares it for equality. The header value is therefore the shared secret in plain text and must always be redacted.
- **v4 `flutterwave-signature` header**: HMAC-SHA256 of the raw body keyed with the secret hash, base64-encoded (Node.js example). The same page's framework examples compare the header directly with the secret hash, as in v3 (see section 10). Treat as sensitive either way.
- Neither signature is part of the JSON body, so a pasted body alone carries no signature.

#### 6.4 Duplicate identification

- v3: Flutterwave says it "might send the same webhook event more than once" and suggests a key of `event` + `data.id` + `data.status` (D/docs/webhooks.md). There is **no event or delivery ID**. Suggested PandaPayLens dedupe key: `event` + `data.id` (or `data.reference` for transfers) + `data.status`.
- v4: payloads carry a webhook ID (`webhook_id` in the schema and most examples, `id` in the D4/docs/webhooks.md example) and a millisecond `timestamp`. Whether a retry reuses the same `webhook_id` is **NOT DOCUMENTED**. The v4 idempotency sample checks `payload.id` and `payload.status`.

### 7. Identifiers

| Field                                                                                                | Scope                                                                                      | Notes                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v3 `data.id` (integer)                                                                               | Transaction                                                                                | Key for verify, refund, events, resend-hook; equals `transaction_id` in redirect query strings and in refund and chargeback objects (`transaction_id`, `tx_id`, `TransactionId`)                                                                                                |
| v3 `tx_ref`                                                                                          | Merchant reference                                                                         | Unique per transaction; `verify_by_reference` looks up by it; echoed on redirect and in chargebacks                                                                                                                                                                             |
| v3 `flw_ref`                                                                                         | Flutterwave or processor reference                                                         | Used for validate, capture, void, preauth refund, single chargeback lookup (`/chargebacks?flw_ref=`); for NGN bank transfer it is the bank Session ID. A refund has its **own** `flw_ref` (`URF_...`), but refund webhooks' `FlwRef` matches the original charge in the example |
| v3 refund `id`                                                                                       | Refund                                                                                     | For `GET /refunds/{id}`                                                                                                                                                                                                                                                         |
| v3 chargeback `id`                                                                                   | Chargeback                                                                                 | Links to the charge via `flw_ref`, `transaction_id`, `tx_ref`                                                                                                                                                                                                                   |
| v3 transfer `id`, `reference`                                                                        | Transfer                                                                                   | Retries get `<reference>_RETRY_<n>` and a new `id`                                                                                                                                                                                                                              |
| v3 `account_id` / `AccountId`                                                                        | Merchant account                                                                           | Mask in output                                                                                                                                                                                                                                                                  |
| v3 `customer.id`, `card.token`                                                                       | Customer, stored card                                                                      | `card.token` is a reusable charge credential                                                                                                                                                                                                                                    |
| v4 `chg_...`, `cus_...`, `pmd_...`, `rfd_...`, `chb_...`, `trf_...`, `rcb_...`, `sdr_...`, `wbk_...` | Charge, customer, payment method, refund, chargeback, transfer, recipient, sender, webhook | Prefixed string IDs. Refund and chargeback link to the charge via `charge_id`                                                                                                                                                                                                   |
| v4 `reference`                                                                                       | Merchant reference                                                                         | Unique per charge or transfer (codes `1100409`, `201409`)                                                                                                                                                                                                                       |
| v4 `payment_information.proof`                                                                       | Bank session ID of a payout                                                                |                                                                                                                                                                                                                                                                                 |
| v4 `X-Trace-Id`, `X-Idempotency-Key`                                                                 | Request                                                                                    | Request headers, not in bodies; responses replayed from an idempotency key carry `X-Idempotency-Cache-Hit: true`                                                                                                                                                                |
| v4 chargeback `arn`                                                                                  | Scheme acquirer reference number                                                           |                                                                                                                                                                                                                                                                                 |

v3 and v4 identifiers do not cross-reference each other; a v3 numeric `id` cannot be linked to a v4 `chg_` ID from documented data.

### 8. Sensitive fields

Redact or mask by default (request fields included because request and response pairs get pasted):

- **Secrets and signatures**: `verif-hash` header (the secret hash itself), `flutterwave-signature` header, secret keys (`FLWSECK...`, `FLWSECK_TEST-...`), public keys (`FLWPUBK...`), encryption key, v4 `client_id`, `client_secret`, `access_token`, `Authorization` header.
- **Card data**: `card_number`, `cvv`, `expiry_month`, `expiry_year`, `authorization.pin`, OTP values (`otp`, virtual card `Otp`), v3 encrypted `client` payload, v4 `encrypted_card_number`, `encrypted_expiry_month`, `encrypted_expiry_year`, `encrypted_cvv`, `encrypted_pin`, `nonce`, `card.first_6digits` together with `card.last_4digits`, v4 `first6` / `last4`, `card.token` (`flw-t1nf-...`), `MaskedPan`, `card_holder_name`, `cof.agreement_id`.
- **Redirect and session URLs**: `auth_url`, `meta.authorization.redirect`, v4 `next_action.redirect_url.url` (contains a signed token), `redirect_url` query strings.
- **Personal data**: `customer.name`, `customer.email`, `customer.phone_number`, v4 `name`, `email`, `phone`, `address`, `billing_details`, `ip`, `client_ip`, `device_fingerprint`, `fullname` / `full_name`, `narration` (often a person's name), transfer `meta` (names, e-mail, address, mobile number), recipient and sender blocks (`national_identification`, `date_of_birth`), BVN and NIN data including `faceImage`, `meta_data.originatorname`, `meta_data.originatoraccountnumber`, mobile money `phone_number` / `msisdn`.
- **Bank data**: `account_number`, `transfer_account`, `sort_code`, `routing_number`, `swift_code`, `payment_information.proof`, `bank_code` together with `account_number`.
- **Merchant identifiers**: `account_id`, `AccountId`, `walletId`, `wallet_id`, `MerchantName`, `subaccount_id`.

### 9. Structural detection hints

Strong v3 signals (combine several):

1. Envelope `status` in {`success`, `error`} + `message` + `data`, with `data` containing **`flw_ref` and `tx_ref` together**, plus `app_fee`, `merchant_fee`, `charged_amount`, `auth_model`, `processor_response` (string), `payment_type`, often `fraud_status` and `charge_type`. `flw_ref` is the most distinctive single key.
2. `meta.authorization.mode` in {`pin`, `avs_noauth`, `redirect`, `otp`, `banktransfer`, `ussd`, `qr`} with `meta.authorization.endpoint` `/v3/validate-charge`.
3. Webhook with `event` (`charge.completed`, `transfer.completed`, `chargeback.*`) and the literal key **`"event.type"`**.
4. Transfer objects with `complete_message`, `requires_approval`, `is_approved`, `debit_currency` and upper-case `status` (`NEW`, `PENDING`, `SUCCESSFUL`, `FAILED`); `complete_message` beginning `DISBURSE FAILED:`.
5. Refund webhook with PascalCase `AmountRefunded`, `FlwRef`, `TransactionId`, `AccountId` and string-encoded `meta`.
6. Reference and token shapes: `card.token` starting `flw-t1nf-`, `flw_ref` values like `FLW-MOCK-...`, `URF_...`; hosts `api.flutterwave.com/v3`, `checkout.flutterwave.com`, `api.ravepay.co`, `ravesandboxapi.flutterwave.com`.

Strong v4 signals:

1. Error: `status: "failed"` + `error.type` (upper snake case) + `error.code` (digit string) + optional `error.validation_errors[].field_name`.
2. Prefixed IDs `chg_`, `pmd_`, `trf_`, `rfd_`, `chb_`, `wbk_` with `next_action.type`, `processor_response` as an object `{ type, code }`, `created_datetime`.
3. Webhook `webhook_id` (or `id`) starting `wbk_`, integer millisecond `timestamp`, `type` in {`charge.completed`, `transfer.disburse`, `transfer.reversal`, `order.authorization`, `refund.completed`}.
4. Hosts `developersandbox-api.flutterwave.com`, `f4bexperience.flutterwave.com`, `idp.flutterwave.com`.

How this differs from other providers:

- **Stripe**: Stripe objects carry an `object` key and IDs such as `ch_`, `pi_`, `evt_`; webhook events have `object: "event"`. Flutterwave v4 shares the dotted event style and the `cus_` customer prefix, so **`cus_` must not decide**; `chg_` (not `ch_`), `wbk_`, `pmd_`, `trf_`, the absence of `object` and the `processor_response` object separate v4 from Stripe. v3 has no prefixed IDs at all.
- **Paystack** (also African markets): Paystack research is not yet in this repository and Paystack's own documentation was not readable during this research (HTTP 403), so no Paystack field is asserted here. Fields that are generic (`status`, `message`, `data`, `event`, `data.reference`, `data.status`, `data.id`) must **not** decide between the two. Decide on Flutterwave-only markers: `flw_ref`, `tx_ref`, `"event.type"`, `app_fee`, `auth_model`, `complete_message`, `verif-hash`, `flutterwave-signature`, `flw-t1nf-` tokens, v4 `chg_` / `wbk_` IDs. The Paystack research file should add its own markers when written.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`; none appear in Flutterwave payloads.
- **payabl.**, **Nuvei**, **NMI**, **Authorize.net**: form-encoded or query-string formats (`transactionid`, `errormessage`, `ppp_status`, `responsetext`), Nuvei JSON with `gwErrorCode` and `internalRequestId`, or Authorize.net JSON with `transactionResponse.responseCode` (per their research files); Flutterwave is always JSON with `flw_ref` / `chg_` vocabulary.
- **Checkout.com, PayPal, Braintree, Mollie, Square, Worldpay, Cybersource**: their envelopes and webhook keys are described in their own research files; none uses `flw_ref`, `tx_ref`, `"event.type"`, `complete_message` or `error.type` together with a numeric-string `error.code` in the 1100000-1900000 range.
- **High-risk adapters**: a text search of every file under `docs/providers/research/` and `docs/providers/high-risk/research/` finds none of the markers `flw_ref`, `tx_ref`, `"event.type"`, `complete_message` or `verif-hash` outside this file, so overlap is limited to generic words such as `status`, `message` and `data`.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **v3 payment error table not readable**: the v3 "Payment Errors" list is an Airtable embed outside the page source. v3 decline decoding therefore relies on free-text `processor_response` and `message` strings, none described as complete.
2. **v3 `processor_response` is free text** with many spellings for the same outcome (`Approved`, `APPROVED`, `Approved by Financial Institution`, `Approved Or Completed Successfully`, `Approved. Successful`, `successful`, `Successful`, `success`). A pending M-PESA initiation carries `processor_response` `Successful` with `status` `pending`; the status field, not the message, decides.
3. **Two versions, cross-contaminated docs**: the v4 webhooks page tells the reader to check `status === "successful"` and `tx_ref` and calls `flw.Transaction.verify`, all v3 terms; v4 webhooks carry `succeeded` and `reference`. The v4 general flow's verify example uses `issuer_response` instead of `processor_response` and `customer` instead of `customer_id`.
4. **v4 webhook ID key**: the schema requires `webhook_id`; D4/docs/webhooks.md shows `id`. Its example also uses decimal epoch-second `created_datetime` values (`1735116842.116`) while other v4 examples use ISO 8601 strings, and its mobile money `country_code` is `234` for a KES charge.
5. **v4 signature**: D4/docs/webhooks.md describes HMAC-SHA256 base64 of the raw body, but the Node.js, PHP and Python examples on the same page compare the header with the secret hash directly.
6. **v4 event enum**: `base_webhook_payload.type` lists four values; `refund.completed` exists only as a separate schema default. v4 chargeback webhooks are mentioned ("available on request") but no payload is documented.
7. **v4 `processor_response` in the timeout example** (`type: "pending"`, `code: "02"`) is outside the documented enum and reuses code `02`.
8. **Duplicate and overlapping codes** in the v4 tables (section 4 introduction): `301404` and `209400` have two meanings each in the payout table; `1121400` and `1122400` share the definition "Failed to validate pre-existing charge"; the 401 type is spelled `UNAUTHORIZATION` in one table and `UNAUTHORIZED` elsewhere; some payout type cells contain stray backticks or a trailing period (`TRANSFER_NOT_DEFERRED_SCHEDULED.`).
9. **Different response shapes for errors**: v3 500 (`error_id`, `code: "app_error"`, no `status`), v3 transfer 500 (HTML), v3 transfer 503 (no `message`), a v3 400 transfer error that carries a full transfer object, and v4 non-JSON responses from intermediaries. The v3 transfer 400 example on D/docs/introduction-6.md is not valid JSON (missing commas).
10. **v3 refund status `completed`** means "initiated and pending disbursement", not finished; the final states are the suffixed `completed-*` values. Refund webhooks with `status: "completed"` can carry `meta.disburse_status: "failed"`. v4 lists seven refund statuses but the prose describes only four; the create example returns `completed` with no top-level `status`.
11. **v3 refund webhook** has no `event` key, PascalCase field names that differ from the REST refund object (`AmountRefunded` vs `amount_refunded`, `TransactionId` vs `transaction_id`), and `meta` as a string. One documented example contains unescaped quotes inside that string (invalid JSON).
12. **Chargeback deadlines**: 10 / 30 working hours in the lifecycle text vs "48 hours" in the `lost` status row (both versions). Only four of seven v3 statuses have documented event names. Chargeback IDs are integers in v3 and `chb_` strings in v4 examples, while the v4 schema example is `1`.
13. **v3 void response** reports `status` `successful` with `processor_response` `Charge voided`, `payment_type` `mobilemoneysn`, and a `card` block whose `first_6digits` and `last_4digits` are numbers and `expiry` is `0/22`. A void cannot be recognized from `status`.
14. **Resend webhook responses differ**: reference shows `message` `hook sent successfully` with `data: null`; the transfer guide shows `Hook sent successfully` with `data: "hook sent"`.
15. **Transfer object naming**: `full_name` in REST, `fullname` in webhooks; `amount` and `fee` are numbers in most examples but strings (`"10.70"`) in the wallet funding and PSA examples. `transfer.completed` covers incoming wallet funding as well as payouts.
16. **v3 status vocabulary is not enumerated**: `success-pending-validation` and `pending-capture` appear once each; other values may exist.
17. **Ordering of webhooks** is not documented in either version; retries depend on a dashboard toggle; v3 has no delivery ID.
18. **Configurable content**: webhook types per event are chosen in the dashboard ("Check all the boxes"); chargeback webhooks are enabled on request; preauthorization and direct card charge need approval (PCI DSS for direct card).
19. **Regional rules** (from codes and guides): Zambia payouts only for Zambia-registered merchants (`229400`); XAF-to-XAF only without approval (`226400`); XOF mobile money destination limits (`230400`); Republic of the Congo MSISDN format (`230401`); NGN-only bank transfer collections; refund minimums NGN 100 and KES 10.
20. **Not read**: v2 documentation, v3 bill payment, BVN, virtual card and FX details beyond quoted values, most v4 reference pages other than the schemas named in Sources, official SDK repositories. Anything only there is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **limited**   | v4 has 180 exact code values with types and 45 card processor codes, enough for full decoding of v4 errors. But v3, the stable default and most likely pasted format, publishes no readable code table: decoding depends on matching 44 documented free-text failure messages (27 error messages, 3 failure `processor_response` values, 6 transfer failure messages, 8 card velocity triggers) and status values, with variable text and no completeness claim. Unknown v3 messages must fall back to `unknown`. |
| **paymentResponses** | **supported** | Both versions have a stable, well-exemplified object: v3 `status` / `message` / `data` with `id`, `tx_ref`, `flw_ref`, `status`, `processor_response`, `complete_message`; v4 `status` / `error` and charge, transfer, refund and chargeback schemas with enums. Shape variants (no-`data` authorization prompts, HTML 500s) are documented and can be tolerated.                                                                                                                                                 |
| **webhookParsing**   | **supported** | JSON bodies with explicit event names in both versions and many examples (`charge.completed`, `transfer.completed`, `chargeback.*`, `transfer.disburse`). Caveats for tests: the v3 refund and virtual card notifications have no `event` key, `"event.type"` must be read as a literal key, v4 uses `webhook_id` or `id`, signatures are headers outside the body.                                                                                                                                               |
| **timeline**         | **limited**   | `created_at` / `created_datetime`, v3 transaction events (`/transactions/{id}/events`), chargeback `meta.history[]` and v4 webhook `timestamp` support a timeline. But v3 webhooks have no event timestamp of their own, ordering is not documented, refund `completed` is not final, voids report `successful`, and a v4 payout can be reversed after `SUCCESSFUL`.                                                                                                                                              |
| **correlation**      | **supported** | Explicit links within each version: v3 `id` = `transaction_id` / `tx_id` / `TransactionId` in refunds and chargebacks, plus `tx_ref` and `flw_ref`; transfer retries reuse the original `reference` with `_RETRY_<n>`; v4 `charge_id` on refunds and chargebacks. Not possible across v3 and v4 identifiers.                                                                                                                                                                                                      |
