# BlueSnap (adapter id `bluesnap`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from BlueSnap's first-party developer hub (`developers.bluesnap.com`), BlueSnap's support guides (`support.bluesnap.com`), BlueSnap's company website (`www.bluesnap.com`) and BlueSnap's official GitHub organization, as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: both documentation sites are ReadMe sites that publish an `llms.txt` index per documentation version (`/llms.txt`, `/v8976-JSON/llms.txt`, `/v8976-XML/llms.txt`, `/v8976-Tools/llms.txt`, `/v8976-Extended/llms.txt`, `/v8976-Reporting/llms.txt`). Pages were downloaded as Markdown through the `.md` suffix that these indexes link to. Code tables were extracted mechanically from the downloaded text, and every code in this file was checked against that extraction, so code values and error names are exact; meanings are paraphrased. The JSON and XML versions of the same error page were compared mechanically. The "Updated" value in the source table is the page's own `updatedAt` header. The developer site answered some rapid requests with HTTP 429 (rate limit); those pages were fetched again after a pause. The marketing site (`www.bluesnap.com`) answered direct scripted requests with a Cloudflare challenge page (HTTP 403); its `robots.txt` and sitemaps loaded normally, and three marketing pages were read through an ordinary page-to-text fetch. No login, access request or challenge bypass was used.
- Brand note: BlueSnap's legacy name **Plimus** is still visible in live formats: the XML namespace is `http://ws.plimus.com`, webhooks carry `plimusNode` next to `bluesnapNode`, and the XML error container is `plimus-calculated-total`. BlueSnap's own about page states that Payroc acquired BlueSnap in 2025 and the site footer reads "BlueSnap, Powered by Payroc". The documented API formats are still BlueSnap's own.

---

## Summary

| Item                          | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                       | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Classification                | `card_processing`, `gateway`, `alternative_payment_method`, `merchant_account_intermediary`; `acquiring` only as documented for local card acquiring guides (Israel, LatAm). `payment_facilitator`, `wallet` and `orchestration` are not claimed by the pages read                                                                                                                                                                                                                                                                                                                                                                                                |
| Documented sectors            | B2B, B2C / eCommerce, SaaS, vertical software platforms, education software, healthcare software, business management software, retail, logistics and freight, manufacturing, subscriptions (`www.bluesnap.com/who-we-serve/`). BlueSnap's Prohibited Items list names internet gambling, virtual gaming credits, cryptocurrency, foreign currency exchange and binary options, debt relief and several adult categories                                                                                                                                                                                                                                          |
| Documentation access          | **Public** (no login) for the developer hub (Payment API JSON and XML, Extended Payment API, Tools, Reporting) and for the support guides, including the webhook name and parameter references. The Merchant Portal (webhook settings, security header key, reports, Order Locator) needs a merchant login and was not used                                                                                                                                                                                                                                                                                                                                       |
| API families                  | Payment API in **JSON** (`content-type: application/json`) and in **XML** (`content-type: application/xml`, namespace `http://ws.plimus.com`) over the same endpoints (`/services/2/...`); Extended Payment API (examples are XML only); Tools APIs; Reporting API; **webhooks (IPNs)** as `application/x-www-form-urlencoded` POST bodies                                                                                                                                                                                                                                                                                                                        |
| API family to implement first | **Payment API JSON** responses and error bodies (`message[]` with `errorName`, `code`, `description`, `invalidProperty`, `fraudEvents`) together with **form-encoded webhooks** (`transactionType`, `referenceNumber`, `reversalRefNum`, `declineReason`, `failureReason`, `cbStatus`). PandaPayLens rejects XML input today, so the XML Payment API and the Extended Payment API should only be detected and reported as unsupported                                                                                                                                                                                                                             |
| Documented codes              | **227 error rows** across the Payment API, Tools and fraud pages (225 `errorName`/`code` rows plus 2 Kount response keys), plus **21 ACH return codes**, giving **248 decodable codes**. Further value sets: 18 `fraudEventCode` values, 6 CVV codes, 3 AVS codes, 5 3-D Secure authentication results, 7 Hosted Payment Fields JavaScript error rows, 11 HTTP statuses, 34 webhook types. The Extended Payment API has a separate table of 142 rows (section 4.15), not counted. **Processor (issuer) decline codes are NOT DOCUMENTED as a list**: BlueSnap maps them to its own `errorName` values and may append the processor code and text to `description` |
| Biggest limitations           | One numeric `code` covers many reasons (37 different `errorName` values share `14002` on the card error page), so `errorName` decides the meaning. Webhooks have no event or delivery ID, no documented retry interval or ordering, and the security header description is internally inconsistent. Only three error-body examples exist. Some code numbers mean different things on different pages                                                                                                                                                                                                                                                              |
| White-label                   | No. BlueSnap documents its own JSON, XML and webhook formats. It routes PayPal, ACH, SEPA, BECS and Pre-Authorized Debit as alternative payment methods and uses Kount (fraud) and Chargebacks911 (dispute handling), but results reach the merchant in BlueSnap's own formats                                                                                                                                                                                                                                                                                                                                                                                    |

---

## Sources

All URLs below were read on 2026-10-25. `J` = `https://developers.bluesnap.com/v8976-JSON/reference`, `X` = `https://developers.bluesnap.com/v8976-XML/reference`, `T` = `https://developers.bluesnap.com/v8976-Tools/reference`, `E` = `https://developers.bluesnap.com/v8976-Extended/reference`, `B` = `https://developers.bluesnap.com/reference`, `S` = `https://support.bluesnap.com/docs`. Pages were read in their Markdown form (`<url>.md`).

| URL                                                                                                                                                                                                                                                                                                                                                                                                                           | Updated                            | What it covers                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://developers.bluesnap.com/robots.txt, https://developers.bluesnap.com/llms.txt, https://developers.bluesnap.com/v8976-JSON/llms.txt, https://developers.bluesnap.com/v8976-XML/llms.txt, https://developers.bluesnap.com/v8976-Tools/llms.txt, https://developers.bluesnap.com/v8976-Extended/llms.txt, https://developers.bluesnap.com/v8976-Reporting/llms.txt, https://developers.bluesnap.com/v8976-Basics/llms.txt | n/a                                | Page discovery only                                                                                                                                                         |
| J/bluesnap-payment-api-json, X/bluesnap-payment-api, E/bluesnap-extended-payment-api                                                                                                                                                                                                                                                                                                                                          | 2025-11-24, 2025-11-13, 2025-11-13 | API family overviews, base URLs, core resources                                                                                                                             |
| B/authentication, B/sandbox-production, B/idempotency                                                                                                                                                                                                                                                                                                                                                                         | 2025-11-17, 2025-11-17, 2025-11-14 | Basic authentication, `content-type` JSON or XML, `bluesnap-version` 1.0 / 2.0 / 3.0, base URLs, `idempotency-key` header (64 characters, kept 24 hours)                    |
| J/error-handling-overview                                                                                                                                                                                                                                                                                                                                                                                                     | 2025-11-18                         | **HTTP status codes** and the **`message` error format**                                                                                                                    |
| J/messages, X/messages                                                                                                                                                                                                                                                                                                                                                                                                        | 2025-11-13, 2025-11-18             | `message` object fields in JSON (`errorName`) and XML (`error-name`)                                                                                                        |
| J/card-transaction-errors, X/card-transaction-errors                                                                                                                                                                                                                                                                                                                                                                          | 2025-12-31, 2025-11-13             | **Card transaction errors** with BlueSnap's recommended action (74 rows in JSON, 70 in XML)                                                                                 |
| J/alt-transaction-errors, J/refund-errors, J/fraud-errors, J/idempotency-errors, J/subscription-billing-plan-errors, J/surcharge-errors, J/batch-errors, J/marketplace-errors, J/vaulted-shopper-errors                                                                                                                                                                                                                       | 2025-11-13 to 2026-06-29           | The other Payment API error tables; the XML versions of the alt, refund, fraud, vaulted shopper, batch, marketplace and subscription pages were compared with the JSON ones |
| J/fraud-event, J/fraud-result-info                                                                                                                                                                                                                                                                                                                                                                                            | 2025-11-18                         | `fraudEvents` structure and `fraudEventCode` values; `fraudResultInfo.deviceDataCollector`                                                                                  |
| T/hosted-payment-field-errors, T/wallet-errors, T/3-d-secure-for-api                                                                                                                                                                                                                                                                                                                                                          | 2025-11-13, 2026-02-24, 2026-03-30 | Hosted Payment Fields token errors and JavaScript errors, wallet errors, 3-D Secure error codes, authentication results and soft declines                                   |
| J/auth-capture, J/auth-only, J/capture, J/auth-reversal, J/retrieve, X/auth-capture                                                                                                                                                                                                                                                                                                                                           | 2025-11-18 to 2026-06-29           | Card transaction lifecycle, request and response examples (JSON and XML)                                                                                                    |
| J/card-transaction, J/processing-info, J/threedsecure, J/chargebacks, J/chargeback                                                                                                                                                                                                                                                                                                                                            | 2025-11-13 to 2026-06-29           | Response objects, `processingStatus` values by payment type, chargeback object                                                                                              |
| J/refund, J/refund-1, J/refunds, J/cancel-pending-refund, J/balance-funding-guide                                                                                                                                                                                                                                                                                                                                             | 2025-11-13 to 2026-06-29           | Refund request and response (`refundStatus` `SUCCESS` / `PENDING`), pending refunds, balance funding                                                                        |
| J/ach-ecp, J/create-ecp-transaction, J/sepa-direct-debit, J/paypal, J/alt-transaction                                                                                                                                                                                                                                                                                                                                         | 2026-06-29 to 2026-10-21           | Alternative payment lifecycles (pending, success, fail, refunded) and their webhooks                                                                                        |
| J/merchant-approval, J/subscription-management, J/recurring-subscription, J/verification                                                                                                                                                                                                                                                                                                                                      | 2025-11-13 to 2026-06-29           | Fraud review approval, subscription statuses, Marketplace vendor payout status                                                                                              |
| E/payment-errors                                                                                                                                                                                                                                                                                                                                                                                                              | 2025-11-13                         | Extended Payment API "Payment & Processor Errors" (142 rows), read to identify conflicts with the Payment API                                                               |
| B/avs-response-codes, B/cvv-response-codes, B/credit-card-codes                                                                                                                                                                                                                                                                                                                                                               | 2025-11-13 to 2025-11-17           | AVS, CVV and card brand value sets                                                                                                                                          |
| B/webhooks-ipns                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-04-01                         | **Webhook overview, notification configuration API, two example webhooks**                                                                                                  |
| https://support.bluesnap.com/llms.txt                                                                                                                                                                                                                                                                                                                                                                                         | n/a                                | Page discovery only                                                                                                                                                         |
| S/ipn-setup, S/ipn-faqs, S/about-ipns, S/recommended-ipns                                                                                                                                                                                                                                                                                                                                                                     | 2025-11-12 to 2026-02-03           | **Webhook delivery**: content type, `200 OK`, up to 11 retries, source IPs, security header, resend, test webhook                                                           |
| S/ipns-name-reference, S/ipn-parameter-reference                                                                                                                                                                                                                                                                                                                                                                              | 2026-07-24                         | **All 34 webhook types and their parameter lists; every webhook parameter**                                                                                                 |
| S/understanding-your-declined-authorizations, S/declined-authorizations-detailed-report                                                                                                                                                                                                                                                                                                                                       | 2025-11-12, 2026-02-24             | The only full decline error body example (JSON and XML); decline report columns                                                                                             |
| S/about-chargebacks, S/chargeback-faqs, S/representing-individual-chargebacks-reason-codes                                                                                                                                                                                                                                                                                                                                    | 2025-11-12 to 2026-06-26           | Chargeback, retrieval request and pre-arbitration flow; prevention alerts; links to card brand reason code pages                                                            |
| S/ecp                                                                                                                                                                                                                                                                                                                                                                                                                         | 2026-06-29                         | **ACH return codes** and their handling                                                                                                                                     |
| S/faqs-payout                                                                                                                                                                                                                                                                                                                                                                                                                 | 2025-11-24                         | Merchant payout schedule and methods                                                                                                                                        |
| https://www.bluesnap.com/robots.txt, https://www.bluesnap.com/sitemap_index.xml, https://www.bluesnap.com/page-sitemap.xml                                                                                                                                                                                                                                                                                                    | sitemap lastmod 2026-10-08         | Activity check and list of company pages                                                                                                                                    |
| https://www.bluesnap.com/who-we-serve/, https://www.bluesnap.com/about-bluesnap/, https://www.bluesnap.com/legal/                                                                                                                                                                                                                                                                                                             | n/a                                | Sectors in BlueSnap's own words; ownership (Payroc); legal entities, regulators and the Prohibited Items list                                                               |
| https://api.github.com/orgs/bluesnap/repos, https://github.com/bluesnap/payment-api-resources (file tree; `schemas/XSDs/messages.xsd`, `chargeback.xsd`, `processing-info.xsd`)                                                                                                                                                                                                                                               | last push 2026-10-13               | Official repositories (XSD schemas for the Payment API and Extended Payment API, mobile SDKs, plugins); XML error and chargeback schema                                     |

Not read: the Embedded Payments documentation, the Reporting API pages beyond the index, the card brand chargeback reason code pages linked from S/representing-individual-chargebacks-reason-codes, the PayPal, BECS and Pre-Authorized Debit create and retrieve pages, the Tools pages other than those listed, and the support pages about refunds (`S/issuing-a-refund`) and payouts (`S/payout-method`). Facts that would come only from those pages are marked **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | About page: the 2025 milestone reads "Payroc acquired BlueSnap"; the footer reads "© 2026 BlueSnap, Powered by Payroc". The site sitemap shows `lastmod` 2026-10-08. Developer pages were updated as late as 2026-10-21 (J/ach-ecp)                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | Payment service operational      | yes    | Production base URL `https://ws.bluesnap.com` (B/sandbox-production); J/ach-ecp describes a NACHA-driven account deactivation rule "starting on June 21, 2026"; the official `payment-api-resources` repository was pushed on 2026-10-13                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | Docs publicly accessible         | yes    | Developer hub and support guides load without login, including all error tables and both webhook references. The Merchant Portal (webhook settings, security header key, Declined Auth Details report, Order Locator) needs a merchant login; it was not used                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | API families/versions identified | yes    | Payment API JSON (`v8976-JSON`) and XML (`v8976-XML`) over `/services/2/...`, header `bluesnap-version` 3.0, 2.0 or 1.0 (B/authentication); Extended Payment API (`v8976-Extended`); Tools (`v8976-Tools`); Reporting (`v8976-Reporting`); webhooks (IPNs)                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Offline-examinable formats       | yes    | JSON and XML request and response examples on every transaction page read; the `message` error format with one full decline example; two full webhook examples; complete webhook parameter table; XSD schemas on GitHub                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | Sectors documented               | yes    | `who-we-serve` page: B2B, B2C, SaaS, systems integrators, vertical software platforms; industry menu Software, Education Software, Healthcare Software, Business Management Software, Retail, Logistics & Freight, Manufacturing. Legal page Prohibited Items list (see Classification)                                                                                                                                                                                                                                                                                                                                                  |
| 7   | Regional/regulatory limits       | yes    | Legal page: BlueSnap Payment Services (Ireland) Ltd authorised by the Central Bank of Ireland (reference C431532); BlueSnap Payment Services Ltd authorised by the UK FCA (reference 629580); BlueSnap Payment Services Israel Ltd authorised by the Israel Securities Authority; entities in Canada, Australia, India and the US without a stated licence. Docs: `transactionRegion` legal entity values `AU`, `CA`, `EU`, `IL`, `IN`, `UK`, `US`; OFAC error `15012`; mandates "Australia and Canada only"; some card brands only for US, UK and EUR merchants; proceeding without 3-D Secure "is not available for Europe and the UK" |
| 8   | Diagnostic value                 | yes    | 227 error rows with names, BlueSnap's own retry advice on the card table, 21 ACH return codes, `processingStatus` values, 34 webhook types including decline, charge failure, chargeback and refund events                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 9   | Own technical formats            | yes    | BlueSnap-specific JSON (`cardTransactionType`, `processingInfo.processingStatus`, `message[].errorName`), XML namespace `http://ws.plimus.com`, webhook vocabulary (`referenceNumber`, `bluesnapNode`, `contractId`, `authKey`). Not a resale of a gateway PandaPayLens supports. The 2025 Payroc ownership has not changed the documented formats                                                                                                                                                                                                                                                                                       |
| 10  | No credentials needed to analyse | yes    | All tables and examples are public. `authKey` and the `Bls-Signature` header need the merchant's Data Protection Key or security header key, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                           | Evidence                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`               | `cardTransactionType` `AUTH_ONLY`, `AUTH_CAPTURE`, `CAPTURE`, `AUTH_REVERSAL`, `REFUND` (J/card-transaction)                                                                                                                                                                                                                     |
| `gateway`                       | X/bluesnap-payment-api subtitle: "Easily start processing payments with our payment gateway API"; E/bluesnap-extended-payment-api: "process payments with our gateway"                                                                                                                                                           |
| `alternative_payment_method`    | ACH/ECP, SEPA Direct Debit, BECS Direct Debit, Pre-Authorized Debit and PayPal through `/services/2/alt-transactions` (J/bluesnap-payment-api-json and the JSON index)                                                                                                                                                           |
| `merchant_account_intermediary` | BlueSnap holds the funds and pays merchants out: the `PAYOUT` webhook is "Sent to the merchant each time BlueSnap issues a payout"; default payout frequency "Daily +2 business days" (S/faqs-payout); on a chargeback "BlueSnap debits funds from the merchant" (S/about-chargebacks); webhook `targetBalance=BLUESNAP_ACCOUNT` |
| `acquiring` (limited)           | The JSON index lists guides titled "Israel Local Card Acquiring" and "LatAm Local Card Acquiring". Those guides were not read, so the scope of BlueSnap's own acquiring is **NOT DOCUMENTED** here                                                                                                                               |
| Not claimed                     | `payment_facilitator` (Embedded Payments and Marketplace onboard platforms and vendors, but the pages read do not use the term), `wallet` (Apple Pay and Google Pay are accepted, not provided), `orchestration` (a sitemap URL `/global-payments/global-payment-orchestration/` exists but was not read)                        |

Sectors, in BlueSnap's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                                                                                                                      | Source and wording                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B2B                                                                                                                         | https://www.bluesnap.com/who-we-serve/: BlueSnap "helps B2B businesses improve cash flow"                                                                                                                                                                                                    |
| B2C / eCommerce                                                                                                             | Same page: "B2C businesses can easily accept payments wherever their customers are located"                                                                                                                                                                                                  |
| SaaS                                                                                                                        | Same page: "we understand SaaS businesses and can support them on a global scale"                                                                                                                                                                                                            |
| Vertical software platforms                                                                                                 | Same page: BlueSnap "partners with vertical software platforms"                                                                                                                                                                                                                              |
| Software, Education Software, Healthcare Software, Business Management Software, Retail, Logistics & Freight, Manufacturing | Same page, industry menu labels; the sitemap has matching pages (`/payments-for-education/`, `/healthcare-payment-solution/`, `/retail-payments/`, `/logistics-freight-payment-processing/`, `/manufacturing-payment-processing/`, `/payments-for-business-management-platforms/`), not read |
| Subscriptions                                                                                                               | Same page lists "Subscription Payments" and "Subscriptions & Recurring Billing"; the Payment API documents plans and subscriptions                                                                                                                                                           |

Prohibited, per BlueSnap's Prohibited Items list on https://www.bluesnap.com/legal/ (paraphrased): internet and other card-not-present gambling, gambling advice and odds making; virtual gaming chips and credits and penny auctions; cryptocurrency; foreign currency exchange services and binary options; debt collection, settlement and relief; weapons and firearms; several adult categories (illegal adult content, escort and sexual services, mail order brides). The page does not say whether any listed item can be allowed with prior approval. Nutraceuticals, travel and generic adult content: **NOT DOCUMENTED** in the pages read.

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                                                                            | Endpoint(s) / delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Format                                                                                                                | Relevance                                                                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Payment API (JSON)**                                                            | `https://sandbox.bluesnap.com/services/2/...` (sandbox), `https://ws.bluesnap.com/services/2/...` (production). Card: `POST /transactions` (Auth Only, Auth Capture), `PUT /transactions` (Capture, Auth Reversal), `GET /transactions/{transactionId}`, `GET /transactions/{merchantTransactionId},{merchantId}`. Refund: `POST /transactions/refund/{transactionId}` or `/transactions/refund/merchant/{merchantTransactionId}`; `DELETE /transactions/pending-refund/{transactionId}`. Alt: `/alt-transactions`. Also `/vaulted-shoppers`, `/recurring/plans`, `/recurring/subscriptions`, `/batch-transactions`, vendors | JSON request and response, `content-type: application/json`; errors as JSON `message` array with HTTP 4xx             | **Primary.** What developers paste: transaction responses and error bodies                                                    |
| **Webhooks (IPNs)**                                                               | HTTPS POST to merchant endpoint URLs configured in the Merchant Portal or through `/services/2/notification-config/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `application/x-www-form-urlencoded` name-value pairs (S/ipn-setup); a test webhook is an empty GET                    | **Primary.** The only source for offline events (chargebacks, chargeback status, ACH results, subscription failures, payouts) |
| Payment API (XML)                                                                 | Same endpoints, `content-type: application/xml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | XML, namespace `http://ws.plimus.com`, kebab-case element names (`card-transaction`, `processing-info`, `error-name`) | Detect and report as unsupported. Same semantics as JSON                                                                      |
| Extended Payment API                                                              | `/services/2/...` order, shopping context, shopper, catalog and subscription resources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | All 31 request examples read use `application/xml`                                                                    | Out of scope at first (XML). Its own error table conflicts with the Payment API in places (section 4.15)                      |
| Tools APIs                                                                        | 3-D Secure tokens, Hosted Payment Fields tokens (`/payment-fields-tokens`), wallets, Account Updater, chargeback representment upload, tax quotes, currency conversion                                                                                                                                                                                                                                                                                                                                                                                                                                                       | JSON or XML                                                                                                           | Secondary. Their error codes are included where they reach card transactions (wallet, Hosted Payment Fields, 3-D Secure)      |
| Browser JavaScript (Hosted Payment Fields, 3-D Secure, Secured Payment Collector) | `onError` callback with `errorCode` / `errorDescription`; `sdkResponse` object with `code`, `info.errors`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | JavaScript objects                                                                                                    | Out of scope at first; client-side, not server truth                                                                          |
| Reporting API                                                                     | `/services/2/report/...` (index only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | JSON or CSV (index only)                                                                                              | Out of scope                                                                                                                  |
| Batch transactions                                                                | `/batch-transactions` with a callback URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | JSON or XML; errors in `processingInfo.processingErrors`                                                              | Later                                                                                                                         |

**Recommendation: implement first** the Payment API JSON card transaction responses, refund responses and `message` error bodies, together with the form-encoded webhooks. PandaPayLens rejects XML input today, so the XML Payment API must not be the first target, even though its semantics are identical. A pasted XML body with `xmlns="http://ws.plimus.com"` should be recognized as BlueSnap and answered with the existing "XML not supported" message. Add alt transaction responses (ECP, SEPA, PayPal), subscription objects and batch errors next.

### 3. Response and error formats

#### 3.1 Content type, versions and HTTP statuses

- **Requests**: HTTP Basic authentication (`authorization: Basic {Base64 of username:password}`), `content-type: application/json` or `application/xml`, optional `bluesnap-version: 3.0` (or 2.0, 1.0; "If you do not specify a version, it is automatically defined for you based on your account settings"), optional `idempotency-key` on POST (B/authentication, B/idempotency).
- **Success** (J/error-handling-overview): `200` with a body, `201` with the new resource URL in the `Location` header, `204` with no body (for example Merchant Approve Transaction and the subscription event simulation).
- **Errors** (J/error-handling-overview):

| HTTP     | Meaning in BlueSnap's words (paraphrased)                                                                                                                                                                                                                                                                | Body                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 400      | Invalid data, **or the acquirer/processor had an issue processing the transaction** (so card declines are HTTP 400)                                                                                                                                                                                      | JSON `message` array (3.2)                               |
| 403      | API user lacks the role for the operation (roles depend on SAQ level); also returned when a resource (shopper, transaction) does not exist, or when the call was blocked as suspected malicious content; `INVALID_TRANSACTION_TYPE` (`7`) also uses 403                                                  | **NOT DOCUMENTED** apart from code `7`                   |
| 404      | Resource not found, for example an unknown merchant shopper ID                                                                                                                                                                                                                                           | **NOT DOCUMENTED**                                       |
| 409      | Conflict with the resource state, possibly a request with the same `idempotency-key` still in progress (`60102`)                                                                                                                                                                                         | `message` array per the idempotency page                 |
| 422      | Well-formed but semantically invalid request; also an `idempotency-key` reused with a different request (`60101`)                                                                                                                                                                                        | `message` array per the idempotency page                 |
| 429, 503 | Merchant or service exceeded call thresholds. One of these messages is "also returned": "Client request rate is too high", "Client request concurrency is too high", "Request rate for service is too high", "Request concurrency to specific service is too high", "Service is temporarily unavailable" | The field that carries the message is **NOT DOCUMENTED** |
| 500      | Unexpected error in the BlueSnap system                                                                                                                                                                                                                                                                  | **NOT DOCUMENTED**                                       |

#### 3.2 The `message` error format

From J/error-handling-overview and J/messages. On error, the body is an object with a `message` **array** of one or more objects:

| JSON field        | XML element        | Type (as documented)                                   | Notes                                                                                                       |
| ----------------- | ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `errorName`       | `error-name`       | string                                                 | Upper snake case name; **this is the key that decides the meaning** (section 4)                             |
| `code`            | `code`             | integer (JSON docs); `xs:string` in `messages.xsd`     | BlueSnap error code. Shared by many names (for example `14002`)                                             |
| `description`     | `description`      | string                                                 | Free text. For processor declines it may carry the processor code and message after a colon (example 3.4 B) |
| `invalidProperty` | `invalid-property` | documented as "string", shown as an object with `name` | The XSD defines children `name` and `message-value`                                                         |
| `fraudEvents`     | `fraud-events`     | documented as "string", shown as an object             | Only with `15011` (section 4.4)                                                                             |

The XML root is `<messages>` containing repeated `<message>`; `messages.xsd` also allows `three-d-security-info` (`payer-authentication-request`, `acs-link`, `transaction-id`) and `plimus-calculated-total` siblings. Their use in current responses is **NOT DOCUMENTED** in the guides read.

Batch transaction errors use a different shape: `processingInfo.processingStatus` (`fail`) with `processingInfo.processingErrors.processingError[]` items holding `processingErrorCode` (string), `processingErrorName`, `processingErrorDescription` (J/batch-errors).

#### 3.3 Success response fields (card transactions)

From J/card-transaction, J/processing-info and the examples on J/auth-capture and J/retrieve:

- `cardTransactionType` (`AUTH_ONLY`, `AUTH_CAPTURE`, `CAPTURE`, `AUTH_REVERSAL`, `REFUND`), `transactionId`, `merchantTransactionId`, `amount`, `usdAmount`, `currency`, `softDescriptor` (examples start with `BLS*`), `transactionApprovalDate` (`MM/DD/YYYY` in examples), `transactionApprovalTime` ("in Pacific time"), `vaultedShopperId`, `openToCapture`, `originalTransactionId` (only when retrieved by a refund ID).
- `processingInfo`: `processingStatus`, `authorizationCode`, `cvvResponseCode`, `avsResponseCodeZip`, `avsResponseCodeAddress`, `avsResponseCodeName`, `networkTransactionId`, `transactionRegion`, `supportsMultiPartialCapture`.
- `creditCard`: `cardLastFourDigits`, `cardType`, `cardSubType`, `cardCategory`, `binCategory`, `cardRegulated`, `issuingBank`, `issuingCountryCode`, `binNumber`, `expirationMonth`, `expirationYear`.
- `networkTransactionInfo.originalNetworkTransactionId` / `networkTransactionId`; `fraudResultInfo.deviceDataCollector`; `threeDSecure.authenticationResult`; `refunds.refund[]`, `refunds.balanceAmount`; `chargebacks.chargeback[]`; `surchargeInfo`; `taxReference`; `vendorsInfo`.
- Refund response (J/refund-1): `refundTransactionId`, `amount`, `currency`, `date`, `reason`, `refundStatus` (`SUCCESS` or `PENDING`), `cancelSubscriptions`, `taxAmount`, `vendorAmount`.

`processingStatus` values (J/processing-info): cards `SUCCESS`; PayPal `PENDING`, `SUCCESS`, `FAIL`, `REFUNDED`, `CHARGEBACKED`; ACH, Sofort and SEPA DD `PENDING`, `SUCCESS`, `FAIL`, `REFUNDED`; card and alt transactions in a batch `SUCCESS`, `FAIL`, `IN_PROGRESS`, `IN_QUEUE`, `PENDING`; batches `UPLOADED`, `IN_PROGRESS`, `COMPLETED`, `ERROR`, `RECOVER`; fraud review `PENDING_MERCHANT_REVIEW`. Examples use both `SUCCESS` and `success` (section 10).

A declined card payment produces **no transaction object**: the response is HTTP 400 with the `message` array, and no `transactionId` is documented in it.

#### 3.4 Examples

Example A: successful Auth Capture. **Transcribed from https://developers.bluesnap.com/v8976-JSON/reference/auth-capture** (Response, "with Basic"):

```json
{
  "cardTransactionType": "AUTH_CAPTURE",
  "transactionId": "1035511869",
  "softDescriptor": "BLS*DescTest",
  "amount": 11,
  "usdAmount": 11,
  "currency": "USD",
  "transactionApprovalDate": "09/29/2020",
  "transactionApprovalTime": "13:08:47",
  "cardHolderInfo": {
    "firstName": "test first name",
    "lastName": "test last name",
    "zip": "02453"
  },
  "vaultedShopperId": 28855193,
  "creditCard": {
    "cardLastFourDigits": "9299",
    "cardType": "VISA",
    "cardSubType": "CREDIT",
    "cardCategory": "PLATINUM",
    "binCategory": "CONSUMER",
    "cardRegulated": "N",
    "issuingBank": "ALLIED IRISH BANKS PLC",
    "issuingCountryCode": "ie"
  },
  "processingInfo": {
    "processingStatus": "success",
    "cvvResponseCode": "MA",
    "authorizationCode": "123456",
    "avsResponseCodeZip": "U",
    "avsResponseCodeAddress": "U",
    "avsResponseCodeName": "U",
    "transactionRegion": "US"
  },
  "fraudResultInfo": {}
}
```

Example B: declined card payment. **Transcribed from https://support.bluesnap.com/docs/understanding-your-declined-authorizations** ("For example, here is a `DO_NOT_HONOR` response"):

```json
{
  "message": [
    {
      "errorName": "DO_NOT_HONOR",
      "code": 14002,
      "description": "Transaction failed because of payment processing failure.: 530 - This transaction has been declined. Please check card details and try again, or contact your bank for assistance"
    }
  ]
}
```

The same page shows the XML form (`<message><error-name>DO_NOT_HONOR</error-name><code>14002</code><description>...</description></message>`). The `530 - ...` part is a processor code and text appended by BlueSnap; the processor code list behind it is **NOT DOCUMENTED**.

Example C: fraud decline. **Transcribed from https://developers.bluesnap.com/v8976-JSON/reference/fraud-errors** ("Single fraud event"):

```json
{
  "message": [
    {
      "errorName": "FRAUD_DETECTED",
      "code": 15011,
      "description": "The request cannot be fulfilled for the current shopper. Please contact BlueSnap support for further details.",
      "fraudEvents": {
        "fraudReferenceId": 3565,
        "fraudTransactionId": "DSYK0G9YPJYS"
      }
    }
  ]
}
```

The "Multiple fraud events" example on the same page adds `fraudEvents.fraudEvent[]` items with `fraudEventCode`, `fraudEventDecision` and `fraudEventExpression`; as published it is not valid JSON (missing closing braces).

Example D: refund. **Transcribed from https://developers.bluesnap.com/v8976-JSON/reference/refund** (Response Examples, "Full refund (basic or surcharge)"):

```json
{
  "refundTransactionId": 1039287689,
  "reason": "Refund for order #1039287689",
  "refundStatus": "SUCCESS"
}
```

The "Pending refund" example on the same page returns `"refundStatus": "PENDING"`. Several refund examples omit `refundStatus`.

Webhook examples: see section 6.6.

### 4. Codes

Error names and codes are exactly as documented. "Meaning" is a short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not BlueSnap statements. Where BlueSnap gives advice (the Action column of the card error page), it is summarized in the "BlueSnap advice" column and reflected in the suggestion. An adapter must handle unknown names and codes.

**Decode by `errorName` first.** The numeric `code` is a group, not a reason: on the card error page 37 names share `14002`, 5 share `10001`, 3 share `10000` and 3 share `20036`. Some numbers also mean different things on different pages (section 10). A bare number is never enough.

#### 4.1 Card transaction errors (J/card-transaction-errors): 74 rows

Returned with HTTP 400 (HTTP 403 for `7`). Rows marked `*` appear only on the JSON page, not on the XML page (X/card-transaction-errors has 70 rows).

| Code    | errorName                                         | Meaning (paraphrase)                                                       | BlueSnap advice (summary)                           | Category                   | Retry class              |
| ------- | ------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------- | ------------------------ |
| `7`     | `INVALID_TRANSACTION_TYPE`                        | Transaction type not valid; HTTP 403                                       | Validate request; then support                      | invalid_request            | do_not_retry             |
| `30`    | `MISSING_SHOPPER_OR_CARD_HOLDER`                  | Neither cardholder data nor a vaulted shopper ID was sent                  | Resend with one of them                             | invalid_request            | do_not_retry             |
| `85`    | `INVALID_HTTP_METHOD`                             | Capture was not sent with HTTP PUT                                         | Resend with PUT                                     | invalid_request            | do_not_retry             |
| `90`    | `MISSING_CARD_TYPE`                               | Card type element missing                                                  | Resend with card type                               | invalid_request            | do_not_retry             |
| `10000` | `BLS_NO_SUCH_SHOPPER_PAYMENT_METHOD` `*`          | Vaulted shopper has no saved payment method of the requested kind          | Add the method or send it in the request            | invalid_request            | do_not_retry             |
| `10000` | `INVALID_API_VERSION`                             | API version in the request is not valid                                    | Resend with a valid version                         | configuration              | do_not_retry             |
| `10000` | `PAYMENT_GENERAL_FAILURE`                         | General payment failure                                                    | Retry; then support                                 | unknown                    | retry_conditionally      |
| `10001` | `VALIDATION_GENERAL_FAILURE`                      | Request broke a validation rule; detail in `description`                   | Resend corrected                                    | invalid_request            | do_not_retry             |
| `10001` | `INVALID_MERCHANT_TRANSACTION_ID`                 | Merchant transaction ID longer than 50 characters                          | Resend corrected                                    | invalid_request            | do_not_retry             |
| `10001` | `INVALID_RECURRING_TRANSACTION`                   | Recurring transaction element missing or invalid                           | Resend with it                                      | invalid_request            | do_not_retry             |
| `10001` | `MERCHANT_CONFIGURATION_ERROR`                    | Merchant account configuration problem                                     | Contact support                                     | configuration              | manual_review            |
| `10001` | `MISSING_CARD_TYPE`                               | Card type element missing (second listing under `10001`)                   | Resend with card type                               | invalid_request            | do_not_retry             |
| `11001` | `XSS_EXCEPTION`                                   | Input suspected to be malicious                                            | Do not retry                                        | invalid_request            | do_not_retry             |
| `14002` | `THREE_D_SECURITY_AUTHENTICATION_REQUIRED`        | Soft decline: 3-D Secure authentication required                           | Retry with 3-D Secure                               | authentication_required    | customer_action_required |
| `14002` | `ACCOUNT_CLOSED`                                  | Card account is closed                                                     | Do not retry                                        | card_declined              | do_not_retry             |
| `14002` | `AUTHORIZATION_AMOUNT_ALREADY_REVERSED`           | Authorization was already reversed                                         | Do not retry                                        | invalid_request            | do_not_retry             |
| `14002` | `AUTHORIZATION_AMOUNT_NOT_VALID`                  | Amount not valid for this authorization                                    | Correct amount, else decline                        | invalid_amount             | do_not_retry             |
| `14002` | `AUTHORIZATION_EXPIRED`                           | Authorization has expired                                                  | Do not retry                                        | invalid_request            | do_not_retry             |
| `14002` | `AUTHORIZATION_REVOKED`                           | Authorization for a recurring transaction was revoked                      | Do not retry                                        | card_declined              | do_not_retry             |
| `14002` | `AUTHORIZATION_NOT_FOUND`                         | Authorization not found                                                    | Do not retry                                        | invalid_request            | do_not_retry             |
| `14002` | `BLS_CONNECTION_PROBLEM`                          | Request could not be completed                                             | Do not retry                                        | provider_unavailable       | do_not_retry             |
| `14002` | `CALL_ISSUER`                                     | Unspecified issuer error; shopper should contact the issuer                | Do not retry this card                              | card_declined              | customer_action_required |
| `14002` | `CARD_LOST_OR_STOLEN`                             | Card reported lost or stolen                                               | Different card or decline; not this card            | fraud_or_risk              | do_not_retry             |
| `14002` | `CVV_ERROR`                                       | Security code problem                                                      | Retry with correct CVV                              | card_declined              | customer_action_required |
| `14002` | `DO_NOT_HONOR`                                    | Issuer declined                                                            | Other method, or retry after 24 hours               | card_declined              | customer_action_required |
| `14002` | `EXPIRED_CARD`                                    | Card expired                                                               | Correct expiry, else other method; not this card    | card_declined              | customer_action_required |
| `14002` | `GENERAL_PAYMENT_PROCESSING_ERROR`                | Unspecified failure; `description` may hold the processor code and message | Retry; then support                                 | unknown                    | retry_conditionally      |
| `14002` | `HIGH_RISK_ERROR`                                 | Declined as high risk                                                      | Other method, or retry after 24 hours               | fraud_or_risk              | customer_action_required |
| `14002` | `INCORRECT_INFORMATION`                           | Incorrect information; detail in `description`                             | Do not retry                                        | invalid_request            | do_not_retry             |
| `14002` | `INCORRECT_SETUP`                                 | Incorrect setup                                                            | Contact support                                     | configuration              | manual_review            |
| `14002` | `INSUFFICIENT_FUNDS`                              | Insufficient funds                                                         | Other method, later, or decline                     | insufficient_funds         | customer_action_required |
| `14002` | `INVALID_AMOUNT`                                  | Amount not valid for this transaction                                      | Correct amount, else decline                        | invalid_amount             | do_not_retry             |
| `14002` | `INVALID_CARD_NUMBER`                             | Card number not valid                                                      | Correct number, else other method; not this card    | card_declined              | customer_action_required |
| `14002` | `INVALID_CARD_TYPE`                               | Card type not valid                                                        | Correct number or other method                      | payment_method_unavailable | customer_action_required |
| `14002` | `INVALID_PIN_OR_PW_OR_ID_ERROR`                   | PIN, password or ID wrong                                                  | Retry with correct value; then support              | authentication_failed      | customer_action_required |
| `14002` | `INVALID_TRANSACTION`                             | Issuer does not allow this transaction                                     | Do not retry                                        | card_declined              | do_not_retry             |
| `14002` | `LIMIT_EXCEEDED`                                  | Card limit exceeded                                                        | Other method, later, or decline                     | insufficient_funds         | customer_action_required |
| `14002` | `NEW_ACCOUNT_INFORMATION_AVAILABLE` `*`           | Account no longer active                                                   | Retry with a different card                         | card_declined              | customer_action_required |
| `14002` | `PICKUP_CARD`                                     | Card reported lost or stolen and should be removed from use                | Do not retry                                        | fraud_or_risk              | do_not_retry             |
| `14002` | `PROCESSING_AMOUNT_ERROR`                         | Amount not valid for this transaction                                      | Correct amount, else decline                        | invalid_amount             | do_not_retry             |
| `14002` | `PROCESSING_DUPLICATE`                            | Duplicate of a previous transaction                                        | Do not retry                                        | duplicate_request          | do_not_retry             |
| `14002` | `PROCESSING_GENERAL_DECLINE`                      | Unspecified decline                                                        | Retry; then issuer or decline                       | card_declined              | retry_conditionally      |
| `14002` | `PROCESSING_TIMEOUT`                              | Processing timed out                                                       | Retry; then support                                 | network_or_timeout         | retry_conditionally      |
| `14002` | `PROCESSING_TRANSACTION_NOT_AUTHORIZED` `*`       | Transaction unauthorized                                                   | Do not retry                                        | card_declined              | do_not_retry             |
| `14002` | `REFUND_FAILED`                                   | General failure on a refund                                                | Retry; then support                                 | unknown                    | retry_conditionally      |
| `14002` | `RESTRICTED_CARD`                                 | Card is restricted                                                         | Do not retry                                        | card_declined              | do_not_retry             |
| `14002` | `STRONG_CUSTOMER_AUTHENTICATION_REQUIRED`         | Soft decline: strong customer authentication missing                       | Retry with 3-D Secure and challenge                 | authentication_required    | customer_action_required |
| `14002` | `SYSTEM_TECHNICAL_ERROR`                          | Problematic transaction / technical error                                  | Do not retry (Extended page says retry, section 10) | provider_unavailable       | do_not_retry             |
| `14002` | `THE_ISSUER_IS_UNAVAILABLE_OR_OFFLINE`            | Issuer unavailable or offline                                              | Retry                                               | provider_unavailable       | retry_conditionally      |
| `14002` | `THREE_D_SECURE_FAILURE`                          | 3-D Secure failed                                                          | Do not retry                                        | authentication_failed      | do_not_retry             |
| `14011` | `PAYMENT_METHOD_NOT_SUPPORTED`                    | Operation not supported for this payment method                            | Do not retry                                        | payment_method_unavailable | do_not_retry             |
| `14016` | `NO_AVAILABLE_PROCESSORS`                         | No processor available for this request                                    | Contact support                                     | configuration              | manual_review            |
| `15008` | `SHOPPER_NOT_FOUND`                               | Vaulted shopper ID not found                                               | Resend with correct ID                              | invalid_request            | do_not_retry             |
| `15012` | `SHOPPER_COUNTRY_OFAC_SANCTIONED`                 | One of the shopper's countries is OFAC sanctioned                          | Do not retry                                        | fraud_or_risk              | do_not_retry             |
| `16003` | `MULTIPLE_PAYMENT_METHODS_NON_SELECTED`           | Shopper has several methods and none was selected                          | Resend selecting one                                | invalid_request            | do_not_retry             |
| `16006` | `PAYMENT_METHOD_LIMIT_REACHED` `*`                | Shopper reached the limit of stored payment methods                        | (none given)                                        | invalid_request            | do_not_retry             |
| `20002` | `MULTIPLE_TRANSACTIONS_FOUND`                     | Several transactions share the merchant transaction ID                     | Use a unique ID; then support                       | invalid_request            | do_not_retry             |
| `20003` | `TRANSACTION_LOCKED`                              | Transaction is locked                                                      | Contact support                                     | unknown                    | manual_review            |
| `20004` | `TRANSACTION_PAYMENT_METHOD_NOT_SUPPORTED`        | Payment method not supported                                               | Other method or decline                             | payment_method_unavailable | customer_action_required |
| `20005` | `TRANSACTION_NOT_AUTHORIZED`                      | Transaction is not authorized (for example capture without a valid auth)   | Repeat the auth correctly                           | invalid_request            | do_not_retry             |
| `20006` | `TRANSACTION_ALREADY_EXISTS`                      | Auth reversal already exists                                               | Do not retry                                        | duplicate_request          | do_not_retry             |
| `20007` | `TRANSACTION_EXPIRED`                             | Transaction expired                                                        | New transaction                                     | invalid_request            | do_not_retry             |
| `20008` | `TRANSACTION_ID_REQUIRED`                         | Transaction ID missing                                                     | Resend with it                                      | invalid_request            | do_not_retry             |
| `20009` | `INVALID_TRANSACTION_ID`                          | Transaction ID not valid                                                   | Resend corrected                                    | invalid_request            | do_not_retry             |
| `20010` | `TRANSACTION_ALREADY_CAPTURED`                    | Already captured                                                           | Do not retry                                        | duplicate_request          | do_not_retry             |
| `20017` | `TRANSACTION_CARD_NOT_VALID`                      | Capture failed because the card is no longer valid                         | Other card details                                  | card_declined              | customer_action_required |
| `20031` | `MISSING_RELEVANT_METHOD_FOR_SHOPPER`             | Shopper has no suitable payment method (for example no card)               | Add the method or send it                           | invalid_request            | do_not_retry             |
| `20036` | `CREDIT_CARD_DETAILS_PLAIN_AND_ENCRYPTED`         | Card details sent both plain and encrypted                                 | Resend corrected                                    | invalid_request            | do_not_retry             |
| `20036` | `CREDIT_CARD_ENCRYPTED_NUMBER_REQUIRED`           | Encrypted card number missing                                              | Resend with it                                      | invalid_request            | do_not_retry             |
| `20036` | `CREDIT_CARD_ENCRYPTED_SECURITY_CODE_REQUIRED`    | Encrypted security code missing                                            | Resend with it                                      | invalid_request            | do_not_retry             |
| `24012` | `USER_NOT_AUTHORIZED`                             | API user not authorized for the action                                     | (none given)                                        | configuration              | do_not_retry             |
| `43008` | `EXTERNAL_TAX_SERVICE_MISMATCH_CURRENCY`          | Currency differs from the tax quote currency                               | Same currency or new quote                          | invalid_request            | do_not_retry             |
| `43009` | `EXTERNAL_TAX_SERVICE_UNEXPECTED_TOTAL_PAYMENT`   | Total differs from the tax quote total                                     | Correct amount                                      | invalid_amount             | do_not_retry             |
| `43010` | `EXTERNAL_TAX_SERVICE_TAX_REFERENCE_ALREADY_USED` | Tax quote reference already used, not the merchant's, expired or unknown   | New tax quote                                       | invalid_request            | do_not_retry             |

#### 4.2 Alt transaction errors (J/alt-transaction-errors): 27 rows

For ACH/ECP, SEPA DD, PayPal and other alternative payment requests. Some descriptions use XML element names (`payer-info`, `vaulted-shopper-id`) even on the JSON page. J/ach-ecp adds that an invalid or not-in-good-standing bank account returns a `10001` error.

| Code    | errorName                               | Meaning (paraphrase)                                                 | Category                   | Retry class              |
| ------- | --------------------------------------- | -------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `10000` | `INVALID_API_VERSION`                   | API version not valid                                                | configuration              | do_not_retry             |
| `10000` | `SERVER_GENERAL_FAILURE`                | Documented text says the price is negative                           | invalid_amount             | do_not_retry             |
| `10001` | `VALIDATION_GENERAL_FAILURE`            | Validation rule broken; detail in `description`                      | invalid_request            | do_not_retry             |
| `11001` | `XSS_EXCEPTION`                         | Input suspected to be malicious                                      | invalid_request            | do_not_retry             |
| `14002` | `GENERAL_PAYMENT_PROCESSING_ERROR`      | Unspecified failure; may include the processor code and message      | unknown                    | retry_conditionally      |
| `14010` | `FAILED_CREATING_PAYPAL_TOKEN`          | Could not connect to PayPal; try again shortly or use another method | provider_unavailable       | retry_conditionally      |
| `14011` | `PAYMENT_METHOD_NOT_SUPPORTED`          | Selected payment method not valid                                    | payment_method_unavailable | do_not_retry             |
| `14016` | `NO_AVAILABLE_PROCESSORS`               | No processor available                                               | configuration              | manual_review            |
| `14034` | `INVALID_PAYMENT_DETAILS`               | Payment details not valid                                            | invalid_request            | customer_action_required |
| `15008` | `SHOPPER_NOT_FOUND`                     | Shopper ID not found                                                 | invalid_request            | do_not_retry             |
| `15012` | `SHOPPER_COUNTRY_OFAC_SANCTIONED`       | A shopper country is OFAC sanctioned                                 | fraud_or_risk              | do_not_retry             |
| `16003` | `MULTIPLE_PAYMENT_METHODS_NON_SELECTED` | Several methods, none selected                                       | invalid_request            | do_not_retry             |
| `17005` | `INVALID_STEP_FIELD`                    | The PLACED step was already performed for this shopping context      | duplicate_request          | do_not_retry             |
| `20002` | `MULTIPLE_TRANSACTIONS_FOUND`           | Several transactions share the merchant transaction ID               | invalid_request            | do_not_retry             |
| `20003` | `TRANSACTION_LOCKED`                    | Transaction locked                                                   | unknown                    | manual_review            |
| `20020` | `INVALID_ALT_TRANSACTION_TYPE`          | Alt transaction type not valid                                       | invalid_request            | do_not_retry             |
| `20021` | `MULTI_SHOPPER_INFORMATION`             | Both payer info and vaulted shopper ID sent                          | invalid_request            | do_not_retry             |
| `20022` | `MISSING_SHOPPER_INFORMATION`           | Neither payer info nor vaulted shopper ID sent                       | invalid_request            | do_not_retry             |
| `20023` | `MISSING_PAYER_INFO_FIELDS`             | A required payer info field is missing                               | invalid_request            | do_not_retry             |
| `20024` | `EXPECT_NO_ECP_DETAILS`                 | ECP with vaulted shopper must send an empty ECP element              | invalid_request            | do_not_retry             |
| `20025` | `INVALID_ECP_ACCOUNT_TYPE`              | ECP account type not valid                                           | invalid_request            | customer_action_required |
| `20025` | `INVALID_PAYER_INFO_FIELDS`             | A payer info value is not valid                                      | invalid_request            | customer_action_required |
| `20026` | `MISMATCH_SUBSCRIPTION_CURRENCY`        | Currency differs from the subscription currency                      | invalid_request            | do_not_retry             |
| `20027` | `PAYPAL_UNSUPPORTED_CURRENCY`           | Currency not supported with PayPal                                   | payment_method_unavailable | do_not_retry             |
| `24011` | `CURRENCY_CODE_NOT_FOUND`               | Currency code missing                                                | invalid_request            | do_not_retry             |
| `90009` | `SUBSCRIPTION_NOT_FOUND`                | Subscription ID not found                                            | invalid_request            | do_not_retry             |
| (none)  | `MISSING_ARGUMENTS`                     | PayPal cancel URL or return URL missing                              | invalid_request            | do_not_retry             |

#### 4.3 Refund errors (J/refund-errors): 16 rows

| Code    | errorName                                           | Meaning (paraphrase)                                                                    | Category                   | Retry class         |
| ------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- | ------------------- |
| `14004` | `REFUND_GENERAL_FAILURE`                            | General refund failure, or the original transaction has not cleared yet (wait 3-7 days) | unknown                    | retry_conditionally |
| `14005` | `REFUND_MIN_AMOUNT_FAILURE`                         | Refund amount below the minimum                                                         | invalid_amount             | do_not_retry        |
| `14006` | `REFUND_MAX_AMOUNT_FAILURE`                         | Refund amount above the maximum                                                         | invalid_amount             | do_not_retry        |
| `14007` | `REFUND_PERIOD_EXPIRED`                             | Refund window ended (transactions older than 2 years)                                   | invalid_request            | do_not_retry        |
| `14008` | `INSUFFICIENT_FUNDS_FOR_REFUND`                     | Not enough merchant funds for the refund                                                | insufficient_funds         | manual_review       |
| `14009` | `INVOICE_ALREADY_REFUNDED`                          | Payment already refunded                                                                | duplicate_request          | do_not_retry        |
| `14022` | `INVOICE_ALREADY_FULLY_REFUNDED`                    | Invoice already fully refunded                                                          | duplicate_request          | do_not_retry        |
| `14023` | `REFUND_IN_PROCESS`                                 | Another refund for this invoice is in progress                                          | duplicate_request          | retry_conditionally |
| `14024` | `PARTIAL_REFUND_NOT_SUPPORTED`                      | Invoice cannot be partially refunded                                                    | invalid_request            | do_not_retry        |
| `14048` | `PAYMENT_METHOD_NOT_REFUNDABLE`                     | Refund must be issued through merchant support                                          | payment_method_unavailable | manual_review       |
| `14049` | `VENDOR_INSUFFICIENT_FUNDS_FOR_REFUND`              | Not enough funds in the vendor account                                                  | insufficient_funds         | manual_review       |
| `14051` | `REFUND_TAX_AMOUNT_REQUIRED`                        | Tax amount required, even if zero                                                       | invalid_request            | do_not_retry        |
| `14052` | `REFUND_NEGATIVE_TAX_AMOUNT`                        | Tax refund amount negative                                                              | invalid_amount             | do_not_retry        |
| `14053` | `REFUND_TAX_AMOUNT_EXCEEDS_ALLOWED_REFUNDABLE`      | Tax refund above the refundable tax                                                     | invalid_amount             | do_not_retry        |
| `14054` | `REFUND_TAX_AMOUNT_EXCEEDS_REFUND_AMOUNT`           | Tax refund above the total refund                                                       | invalid_amount             | do_not_retry        |
| `14055` | `REFUND_TAX_FREE_AMOUNT_EXCEEDS_ALLOWED_REFUNDABLE` | Tax-free refund part above the refundable amount                                        | invalid_amount             | do_not_retry        |

Note: `14008` and `14049` describe the merchant's or vendor's BlueSnap balance, not the cardholder's funds. Accounts with pending refunds enabled get `refundStatus: PENDING` instead (section 5.3).

#### 4.4 Fraud errors (J/fraud-errors, J/fraud-event): 2 rows + 2 Kount keys

| Code    | errorName        | Meaning (paraphrase)                                                                                                            | Category      | Retry class   |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| `15011` | `FRAUD_DETECTED` | Fraud rules or thresholds triggered; `fraudEvents` says which and whether the order was declined (`D`) or held for review (`R`) | fraud_or_risk | manual_review |
| `15011` | `FRAUD_ERROR`    | Invalid card or invalid site reported by the fraud service; `fraudEvents` carries the fraud event ID                            | fraud_or_risk | manual_review |

Kount RIS response keys mapped by BlueSnap: `323` (Kount "Bad Site", BlueSnap "Invalid Site": site ID does not match a Kount website ID; suggested configuration / manual_review) and `332` (Kount "Bad Card", BlueSnap "Invalid Card"; suggested card_declined / customer_action_required). Where these keys appear in a payload is **NOT DOCUMENTED**.

`fraudEvents` fields: `fraudReferenceId` (BlueSnap fraud check reference), `fraudTransactionId` (Kount ID), `fraudEvent[]` with `fraudEventCode`, `fraudEventDecision` (`D` decline, `R` review), `fraudEventExpression` (why it triggered).

`fraudEventCode` values (18): CVV/AVS rules `AVS_ADDR_MISMATCH`, `AVS_ADDR_NOT_VERIFIED`, `AVS_NAME_MISMATCH`, `AVS_ZIP_MISMATCH`, `AVS_ZIP_NOT_VERIFIED`, `CVV_MISMATCH`, `CVV_NOT_VERIFIED`; configurable thresholds `blacklistIpCountryDecline`, `blacklistNetworkTypeDecline`, `blacklistPaymentCountryDecline`, `blacklistShippingCountryDecline`, `cardPtokVelocityDecline`, `deviceFingerprintVelocityDecline`, `deviceIpVelocityDecline`, `deviceToBillingAddressDecline`, `emailVelocityDecline`, `highRiskDecline`, `orderTotalDecline`. The examples use other casings and codes (`blacklistshippingcountrydecline`, `billShipAddressNotMatchDecline`), so matching must be case-insensitive and tolerant of unlisted codes.

#### 4.5 Idempotency errors (J/idempotency-errors): 5 rows

| Code    | errorName                                                                 | Meaning (paraphrase)                                    | Category             | Retry class                     |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------- | ------------------------------- |
| `60101` | `SAME_IDEMPOTENCY_KEY_WAS_ALREADY_IN_USE_WITH_PREVIOUS_DIFFERENT_REQUEST` | Key reused with a different request; HTTP 422           | invalid_request      | do_not_retry                    |
| `60102` | `REQUEST_WITH_SAME_IDEMPOTENCY_KEY_ALREADY_IN_PROGRESS`                   | Same key retried while the first request runs; HTTP 409 | duplicate_request    | retry_conditionally             |
| `60103` | `IDEMPOTENCY_KEY_MAX_LENGTH_LIMIT_EXCEEDED`                               | Key longer than 64 characters                           | invalid_request      | do_not_retry                    |
| `60104` | `INVALID_IDEMPOTENCY_KEY`                                                 | Key has characters other than letters, digits, hyphens  | invalid_request      | do_not_retry                    |
| `60106` | `IDEMPOTENCY_SERVICE_TIMEOUT`                                             | Idempotency service unavailable; try later              | provider_unavailable | safe_to_retry_technical_request |

#### 4.6 Subscription and billing plan errors (J/subscription-billing-plan-errors): 40 rows

The XML page has 39 rows (no `24023`). `${...}` placeholders are filled at runtime.

| Code    | errorName                                   | Meaning (paraphrase)                                           | Category                   | Retry class              |
| ------- | ------------------------------------------- | -------------------------------------------------------------- | -------------------------- | ------------------------ |
| `20026` | `MISMATCH_SUBSCRIPTION_CURRENCY`            | Currency differs from the subscription currency                | invalid_request            | do_not_retry             |
| `24001` | `INVALID_CHARGE_FREQUENCY`                  | Charge frequency not valid                                     | invalid_request            | do_not_retry             |
| `24002` | `MISSING_REQUIRED_FIELD`                    | A required field is missing                                    | invalid_request            | do_not_retry             |
| `24003` | `INVALID_BILLING_PLAN_CONFIGURATION`        | Two plan parameters cannot be combined                         | invalid_request            | do_not_retry             |
| `24004` | `API_CONFIGURATION_ISSUE`                   | Request failed; contact BlueSnap                               | configuration              | manual_review            |
| `24005` | `RECURRING_PRICE_MINIMUM_LIMIT_NOT_REACHED` | Recurring price must exceed 1 USD or equivalent                | invalid_amount             | do_not_retry             |
| `24006` | `PRICE_MUST_BE_POSITIVE`                    | Prices must be positive                                        | invalid_amount             | do_not_retry             |
| `24007` | `INVALID_GRACE_PERIOD`                      | Grace period not valid                                         | invalid_request            | do_not_retry             |
| `24008` | `INVALID_TRIAL_DAYS`                        | Trial days not valid                                           | invalid_request            | do_not_retry             |
| `24009` | `INVALID_MAX_NUMBER_OF_CHARGES`             | Maximum number of charges not valid                            | invalid_request            | do_not_retry             |
| `24010` | `INVALID_BILLING_PLAN_NAME_LENGTH`          | Plan name must be 1 to 199 characters                          | invalid_request            | do_not_retry             |
| `24011` | `CURRENCY_NOT_FOUND`                        | Currency not found                                             | invalid_request            | do_not_retry             |
| `24013` | `ERROR_IN_REQUEST`                          | Unexpected processing error; contact support                   | unknown                    | manual_review            |
| `24014` | `NON_UPDATABLE_FIELD`                       | Field cannot be updated; create a new plan                     | invalid_request            | do_not_retry             |
| `24015` | `CANNOT_ADD_ELEMENT`                        | Element cannot be added to an existing plan                    | invalid_request            | do_not_retry             |
| `24016` | `INVALID_STATUS`                            | Status not valid                                               | invalid_request            | do_not_retry             |
| `24017` | `CANNOT_CREATE_INACTIVE_PLAN`               | Plan cannot be created inactive                                | invalid_request            | do_not_retry             |
| `24018` | `CANNOT_DELETE_ELEMENT`                     | Element cannot be removed from an existing plan                | invalid_request            | do_not_retry             |
| `24023` | `MAX_NUMBER_PLANS_EXCEEDED`                 | Maximum number of plans reached                                | configuration              | manual_review            |
| `26001` | `NEGATIVE_PAGE_SIZE`                        | Page size negative                                             | invalid_request            | do_not_retry             |
| `26002` | `MAX_PAGE_SIZE_EXCEEDED`                    | Page size above the maximum                                    | invalid_request            | do_not_retry             |
| `26003` | `INVALID_PAGINATION_PARAMETERS`             | `before` and `after` used together                             | invalid_request            | do_not_retry             |
| `90009` | `SUBSCRIPTION_NOT_FOUND`                    | Subscription not found                                         | invalid_request            | do_not_retry             |
| `90010` | `NON_OVERRIDABLE_PLAN_TYPE`                 | Plan type does not support an initial charge                   | invalid_request            | do_not_retry             |
| `90011` | `NON_OVERRIDABLE_TRIAL_DAYS`                | Trial days cannot be overridden                                | invalid_request            | do_not_retry             |
| `90012` | `NON_OVERRIDABLE_INITIAL_CHARGE`            | Initial charge amount cannot be overridden                     | invalid_request            | do_not_retry             |
| `90013` | `NO_VAULTED_SHOPPER_FOUND`                  | No vaulted shopper with that ID                                | invalid_request            | do_not_retry             |
| `90014` | `NEGATIVE_QUANTITY`                         | Subscription quantity must be above zero                       | invalid_request            | do_not_retry             |
| `90015` | `INVALID_CURRENCY`                          | Currency is not ISO 4217                                       | invalid_request            | do_not_retry             |
| `90016` | `INVALID_OVERRIDE_TRIAL_DAYS`               | Override trial days must be a number                           | invalid_request            | do_not_retry             |
| `90017` | `INVALID_RECURRING_CHARGE_AMOUNT`           | Recurring charge amount must be above zero                     | invalid_amount             | do_not_retry             |
| `90018` | `INVALID_INITIAL_CHARGE_AMOUNT`             | Initial charge amount must be above zero                       | invalid_amount             | do_not_retry             |
| `90019` | `INCORRECT_PAYMENT_DETAILS`                 | Recurring charge failed: payment details wrong or insufficient | card_declined              | customer_action_required |
| `90020` | `MULTIPLE_CARDS_FOUND_NONE_SELECTED`        | Recurring charge failed: several cards, none selected          | invalid_request            | do_not_retry             |
| `90021` | `SWITCH_PLAN_ERROR`                         | Plan (contract) switch failed                                  | unknown                    | manual_review            |
| `90022` | `INVALID_DATE_FORMAT`                       | Date must be `YYYY-MM-DD`                                      | invalid_request            | do_not_retry             |
| `90023` | `CANNOT_UPDATE_CANCELED_SUBSCRIPTION`       | Subscription must be reactivated before changes                | invalid_request            | do_not_retry             |
| `90032` | `EXISTING_CHARGE_PENDING_APPROVAL`          | Subscription already has a payment pending approval            | duplicate_request          | retry_conditionally      |
| `90033` | `SUBSCRIPTION_INVALID_BILLING_DETAILS`      | Billing address missing or incomplete                          | invalid_request            | customer_action_required |
| `90034` | `SUBSCRIPTION_PAYMENT_METHOD_NOT_USABLE`    | Payment method cannot be used now                              | payment_method_unavailable | customer_action_required |

#### 4.7 Surcharge errors (J/surcharge-errors): 8 rows

| Code    | errorName                               | Meaning (paraphrase)                                   | Category        | Retry class              |
| ------- | --------------------------------------- | ------------------------------------------------------ | --------------- | ------------------------ |
| `10001` | `VALIDATION_GENERAL_FAILURE`            | A field is not valid                                   | invalid_request | do_not_retry             |
| `14016` | `NO_AVAILABLE_PROCESSORS`               | Processor does not support surcharges in this currency | configuration   | do_not_retry             |
| `14040` | `EXPIRED_TOKEN`                         | Surcharge token expired                                | invalid_request | retry_conditionally      |
| `16003` | `MULTIPLE_PAYMENT_METHODS_NON_SELECTED` | Several methods on the shopper, none selected          | invalid_request | do_not_retry             |
| `16101` | `SURCHARGE_NOT_ENABLED`                 | Surcharging not enabled for the account                | configuration   | manual_review            |
| `16103` | `INVALID_CARD_NUMBER`                   | Surcharge validation failed on the card number         | card_declined   | customer_action_required |
| `16104` | `INVALID_TRANSACTION_TYPE`              | Transaction type not valid                             | invalid_request | do_not_retry             |
| `24002` | `MISSING_REQUIRED_FIELD`                | A required field is missing                            | invalid_request | do_not_retry             |

#### 4.8 Batch transaction errors (J/batch-errors): 11 rows

| Code    | errorName                         | Meaning (paraphrase)                                                                       | Category          | Retry class                     |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------ | ----------------- | ------------------------------- |
| `0`     | `UNEXPECTED_ERROR`                | Unexpected error                                                                           | unknown           | manual_review                   |
| `2`     | `MISSING_CALLBACK_URL`            | Callback URL missing                                                                       | invalid_request   | do_not_retry                    |
| `3`     | `MISSING_BATCH_ID`                | Batch ID missing                                                                           | invalid_request   | do_not_retry                    |
| `4`     | `DUPLICATE_BATCH_ID`              | Batch ID already exists                                                                    | duplicate_request | do_not_retry                    |
| `6`     | `MISSING_MERCHANT_TRANSACTION_ID` | Merchant transaction ID missing on a card transaction                                      | invalid_request   | do_not_retry                    |
| `101`   | `INVALID_BATCH_ID`                | Batch ID not valid                                                                         | invalid_request   | do_not_retry                    |
| `10000` | `INVALID_API_VERSION`             | API version not valid                                                                      | configuration     | do_not_retry                    |
| `10001` | `VALIDATION_GENERAL_FAILURE`      | Validation rule broken                                                                     | invalid_request   | do_not_retry                    |
| `11001` | `XSS_EXCEPTION`                   | Input suspected to be malicious                                                            | invalid_request   | do_not_retry                    |
| `20011` | `TRANSACTION_TYPE_NOT_ALLOWED`    | Only AUTH_CAPTURE or CAPTURE card transactions, ECP or recurring PayPal allowed in a batch | invalid_request   | do_not_retry                    |
| `80002` | `BATCH_PROCESSING_IN_PROGRESS`    | Batch still processing; ask again later                                                    | unknown           | safe_to_retry_technical_request |

#### 4.9 Marketplace errors (J/marketplace-errors): 16 rows

| Code    | errorName                               | Meaning (paraphrase)                                                     | Category        | Retry class   |
| ------- | --------------------------------------- | ------------------------------------------------------------------------ | --------------- | ------------- |
| `10001` | `VALIDATION_GENERAL_FAILURE`            | Vendor (seller) request invalid, for example payout configuration rules  | invalid_request | do_not_retry  |
| `14030` | `REFUND_VENDOR_AMOUNT_NOT_SUPPORTED`    | Vendor refund amount sent for a transaction without a vendor             | invalid_request | do_not_retry  |
| `14031` | `REFUND_NEGATIVE_VENDOR_AMOUNT`         | Vendor refund amount must be above zero                                  | invalid_amount  | do_not_retry  |
| `14034` | `VENDOR_PAYOUT_VALUES_EXCEEDS_MERCHANT` | Vendor payout frequency or delay faster than the master merchant's       | configuration   | do_not_retry  |
| `14035` | `DUPLICATE_VENDOR`                      | Same vendor listed twice on one transaction                              | invalid_request | do_not_retry  |
| `14036` | `VENDOR_LIMIT_MAX`                      | More than 10 vendors on one transaction                                  | invalid_request | do_not_retry  |
| `14037` | `VENDOR_COMMISSION_EXCEEDED`            | Total commission above 100 percent or above the sale amount              | invalid_amount  | do_not_retry  |
| `14038` | `VENDOR_RESERVE_NONE_DEFAULT_METHOD`    | Reserve allowed only on the default payout method                        | invalid_request | do_not_retry  |
| `14043` | `REFUND_INVALID_VENDOR_REFUND_AMOUNT`   | Vendor refund amount not valid                                           | invalid_amount  | do_not_retry  |
| `14044` | `REFUND_VENDOR_ERROR`                   | Vendor refund parameters needed when the transaction has several vendors | invalid_request | do_not_retry  |
| `14045` | `REFUND_INVALID_VENDOR`                 | Vendor does not belong to the transaction                                | invalid_request | do_not_retry  |
| `14047` | `REFUND_NEGATIVE_MERCHANT_AMOUNT`       | Merchant refund amount negative                                          | invalid_amount  | do_not_retry  |
| `20050` | `UNAUTHORIZED_USE_OF_VENDOR`            | API user may not act on this vendor                                      | configuration   | do_not_retry  |
| `20051` | `VALIDATION_GENERAL_FAILURE`            | Vendor agreement has both percent and amount commission                  | invalid_request | do_not_retry  |
| `20052` | `INACTIVE_VENDOR`                       | Vendor inactive                                                          | configuration   | manual_review |
| `20053` | `DECLINED_VENDOR`                       | Vendor not approved for processing                                       | configuration   | manual_review |

#### 4.10 Vaulted shopper errors (J/vaulted-shopper-errors): 4 rows

| Code    | errorName                             | Meaning (paraphrase)                                                                                             | Category        | Retry class  |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------ |
| `10001` | `VALIDATION_GENERAL_FAILURE`          | Payment method to delete is tied to an active subscription or a payment pending approval                         | invalid_request | do_not_retry |
| `14110` | `DELETE_SHOPPER_VALIDATION_FAILURE`   | Shopper cannot be deleted: purchases in the last 12 months, pending SEPA or ECP payment, or active subscriptions | invalid_request | do_not_retry |
| `20030` | `MISSING_VAULTED_SHOPPER_FIELDS`      | ECP shopper needs zip or phone                                                                                   | invalid_request | do_not_retry |
| `20031` | `MISSING_RELEVANT_METHOD_FOR_SHOPPER` | No payment method on the shopper, or the requested one does not exist                                            | invalid_request | do_not_retry |

#### 4.11 Wallet errors (T/wallet-errors): 14 rows

| Code    | errorName                          | Meaning (paraphrase)                                        | Category                   | Retry class              |
| ------- | ---------------------------------- | ----------------------------------------------------------- | -------------------------- | ------------------------ |
| `23001` | `MISSING_WALLET_FIELDS`            | A required wallet element is missing                        | invalid_request            | do_not_retry             |
| `23002` | `INVALID_WALLET_FIELDS`            | Wallet type value not valid                                 | invalid_request            | do_not_retry             |
| `23003` | `WALLET_PROCESSING_FAILURE`        | Wallet processor unavailable; try later                     | provider_unavailable       | retry_conditionally      |
| `23005` | `WALLET_EXPIRED`                   | Wallet ID expired                                           | invalid_request            | customer_action_required |
| `23006` | `WALLET_DUPLICATE_PAYMENT_METHODS` | Wallet received with duplicate payment methods              | invalid_request            | do_not_retry             |
| `23007` | `WALLET_PAYMENT_NOT_ENABLED`       | Wallet type not enabled for the account                     | configuration              | manual_review            |
| `23008` | `DUPLICATE_WALLET_RESOURCE`        | Duplicate resource for the same call ID                     | duplicate_request          | do_not_retry             |
| `23009` | `WALLET_CLIENT_KEY_FAILURE`        | API key creation failed                                     | provider_unavailable       | retry_conditionally      |
| `23010` | `INVALID_WALLET_PAYMENT_DATA`      | Payment data could not be read from Apple Pay               | payment_method_unavailable | customer_action_required |
| `23011` | `WALLET_ONBOARDING_ERROR`          | Unexpected error registering with Apple Pay                 | configuration              | manual_review            |
| `23012` | `WALLET_MISSING_DOMAIN`            | Domain missing                                              | configuration              | do_not_retry             |
| `23013` | `WALLET_UNREGISTERED_DOMAIN`       | Domain not registered with Apple                            | configuration              | do_not_retry             |
| `23014` | `WALLET_CHECKOUT_CANCELED`         | Shopper cancelled the wallet checkout                       | unknown                    | customer_action_required |
| `24012` | `USER_NOT_AUTHORIZED`              | Wallet onboarding details missing or not accessible to user | configuration              | do_not_retry             |

#### 4.12 Hosted Payment Fields token errors (T/hosted-payment-field-errors): 4 rows

| Code    | errorName                            | Meaning (paraphrase)                                      | Category        | Retry class              |
| ------- | ------------------------------------ | --------------------------------------------------------- | --------------- | ------------------------ |
| `14040` | `EXPIRED_TOKEN`                      | `pfToken` expired                                         | invalid_request | retry_conditionally      |
| `14002` | `INVALID_CC_NUMBER`                  | Card number not valid                                     | card_declined   | customer_action_required |
| `14041` | `TOKEN_NOT_FOUND`                    | `pfToken` not found                                       | invalid_request | do_not_retry             |
| `14042` | `NO_PAYMENT_DETAILS_LINKED_TO_TOKEN` | Token has no payment method; check the client integration | configuration   | do_not_retry             |

Browser `onError` codes on the same page (7 rows, client side, not counted as server codes): `'10'` (field `ccn`, `cvv` or `exp` invalid or empty), `'22013'` (card type not supported by the merchant), `'14040'`, `'14041'`, `'14042'` (as above), `'400'` (session expired), `'403'`/`'404'`/`'500'` (internal server error).

#### 4.13 3-D Secure error codes and results (T/3-d-secure-for-api): 4 rows

| Code       | Meaning (paraphrase)                                                | Category              | Retry class              |
| ---------- | ------------------------------------------------------------------- | --------------------- | ------------------------ |
| `14100`    | 3-D Secure not enabled                                              | configuration         | manual_review            |
| `14101`    | 3-D Secure authentication failed; shopper should use another method | authentication_failed | customer_action_required |
| `14102/10` | 3-D Secure object lacks amount or currency                          | invalid_request       | do_not_retry             |
| `14103`    | 3-D Secure client error; BlueSnap says continue without 3DS         | unknown               | retry_conditionally      |

These are delivered to the browser `onError` callback; no `errorName` is documented for them. The JavaScript `sdkResponse.code` uses `1` for success, `10` (invalid data, blocking), `15` (invalid data, warning only) and HTTP-like values (400, 500).

`threeDSecure.authenticationResult` (API response) and webhook `3dStatus`: `AUTHENTICATION_BYPASSED`, `AUTHENTICATION_SUCCEEDED`, `AUTHENTICATION_UNAVAILABLE`, `AUTHENTICATION_FAILED`, `AUTHENTICATION_INCOMPLETE`; webhooks add `3DS Not Enabled`. Soft declines that call for 3DS are the card errors `THREE_D_SECURITY_AUTHENTICATION_REQUIRED` and `STRONG_CUSTOMER_AUTHENTICATION_REQUIRED`. External MPI fields (`threeDSecureStatus` `Y`/`N`/`U`/`A`/`C`/`R`/`D`/`I`, `enrollmentStatus` `Y`/`N`/`U`/`B`, `eci` `00`/`01`/`02`/`05`/`06`/`07`) are request values documented on J/threedsecure.

#### 4.14 ACH return codes (S/ecp): 21 codes

BlueSnap says these appear in webhook reason fields such as `cancelReason`, `declineReason` or `reversalReason`. Since 21 June 2026 (J/ach-ecp), BlueSnap deactivates the ACH account and cancels its subscriptions for `R02`, `R03`, `R04`, `R05`, `R07`, `R10` and `R29`.

| Code  | Meaning (paraphrase)                                    | BlueSnap advice (summary)                      | Category                   | Retry class              |
| ----- | ------------------------------------------------------- | ---------------------------------------------- | -------------------------- | ------------------------ |
| `R01` | Insufficient funds                                      | At most two new attempts within 30 days        | insufficient_funds         | retry_conditionally      |
| `R02` | Account closed                                          | Do not retry; account deactivated              | payment_method_unavailable | do_not_retry             |
| `R03` | No account or account cannot be located                 | Do not retry; account deactivated              | invalid_request            | do_not_retry             |
| `R04` | Invalid account number                                  | Do not retry; account deactivated              | invalid_request            | do_not_retry             |
| `R05` | Unauthorized debit entry                                | Do not retry; account deactivated              | fraud_or_risk              | do_not_retry             |
| `R06` | Returned at the originating bank's request              | Do not retry                                   | unknown                    | do_not_retry             |
| `R07` | Customer revoked the authorization                      | Do not retry; account deactivated              | card_declined              | do_not_retry             |
| `R08` | Payment stopped                                         | Needs customer authorization to retry          | card_declined              | customer_action_required |
| `R09` | Uncollected funds                                       | At most two new attempts within 30 days        | insufficient_funds         | retry_conditionally      |
| `R10` | Originator unknown to or not authorized by the receiver | Account deactivated                            | fraud_or_risk              | do_not_retry             |
| `R11` | Entry not in line with the authorization terms          | Correct and resubmit without new authorization | invalid_request            | customer_action_required |
| `R12` | Branch sold                                             | Do not retry; ask for other details            | payment_method_unavailable | customer_action_required |
| `R13` | Invalid routing number                                  | Do not retry; confirm routing number           | invalid_request            | customer_action_required |
| `R14` | Representative payee deceased or unable to act          | Do not retry                                   | payment_method_unavailable | do_not_retry             |
| `R15` | Beneficiary or account holder deceased                  | Do not retry                                   | payment_method_unavailable | do_not_retry             |
| `R16` | Account frozen                                          | Retry only after unfreezing                    | payment_method_unavailable | customer_action_required |
| `R20` | Non-transaction account                                 | Do not retry; ask for other details            | payment_method_unavailable | customer_action_required |
| `R28` | Routing number check digit error                        | Do not retry; confirm routing number           | invalid_request            | customer_action_required |
| `R29` | Corporate customer says not authorized                  | Do not retry; account deactivated              | fraud_or_risk              | do_not_retry             |
| `R31` | Permissible return entry                                | Do not retry; ask for other details            | unknown                    | customer_action_required |
| `R34` | Limited participation bank                              | Do not retry; ask for other details            | payment_method_unavailable | customer_action_required |

#### 4.15 Extended Payment API "Payment & Processor Errors" (E/payment-errors): 142 rows, not transcribed

This table belongs to the XML-only Extended Payment API (orders, shopping contexts, catalog). It repeats most Payment API card names under `14002` and adds order, cart, coupon, SKU, partial refund (`14017`-`14029`), client-side encryption (`19000`-`19002`) and subscription (`90009`-`90032`) codes; 30 rows have no code ("-") and 5 rows have no name. It is not transcribed here because PandaPayLens cannot parse that family yet. It matters for the Payment API only through the conflicts listed in section 10.

#### 4.16 Other value sets

- **CVV** (`cvvResponseCode`; B/cvv-response-codes): `MA` match, `NC` issuer not certified, `ND` check not done, `NM` no match, `NP` code should be on the card but is not present, `NR` check not requested, plus "Unknown Response". Webhook `cvvResponse` carries text instead (example `Not processed`).
- **AVS** (`avsResponseCodeZip`, `avsResponseCodeAddress`, `avsResponseCodeName`; B/avs-response-codes): `M` match, `N` no match, `U` not verified, plus "Unknown Response". Examples also show `avsResponseCode` `N` and `X` at the top level, which the page does not list. Webhook `avsResponse` carries text (example `Issuer unavailable or AVS not supported (US Issuer)`).
- **Card brands** (`cardType`; B/credit-card-codes): `AMEX`, `CHINA_UNION_PAY`, `DINERS`, `DISCOVER`, `JCB`, `MASTERCARD`, `VISA`, `ELO`, `HIPERCARD`, `NARANJA`, `CENCOSUD`, `TARJETASHOPPING`, `ARGENCARD`, `CABAL`.
- **Processor decline codes**: **NOT DOCUMENTED**. BlueSnap normalizes issuer and processor responses into the `errorName` values above; `GENERAL_PAYMENT_PROCESSING_ERROR` "will contain the error code and message sent by the processor if applicable", and the only example shows `530 - This transaction has been declined...` inside `description`. The webhook field `proccessorCode` (sic) is marked "Deprecated - Do not use"; `errorProcessingCode` is described only as "Error code".

#### 4.17 Count summary

| Table                                                | Values    |
| ---------------------------------------------------- | --------- |
| 4.1 card transaction errors (JSON page)              | 74        |
| 4.2 alt transaction errors                           | 27        |
| 4.3 refund errors                                    | 16        |
| 4.4 fraud errors                                     | 2         |
| 4.5 idempotency errors                               | 5         |
| 4.6 subscription and billing plan errors (JSON page) | 40        |
| 4.7 surcharge errors                                 | 8         |
| 4.8 batch errors                                     | 11        |
| 4.9 marketplace errors                               | 16        |
| 4.10 vaulted shopper errors                          | 4         |
| 4.11 wallet errors                                   | 14        |
| 4.12 Hosted Payment Fields token errors              | 4         |
| 4.13 3-D Secure error codes                          | 4         |
| **Error rows**                                       | **225**   |
| 4.4 Kount response keys                              | 2         |
| **Error rows including Kount keys**                  | **227**   |
| 4.14 ACH return codes                                | 21        |
| **Total decodable codes**                            | **248**   |
| Not counted: `fraudEventCode` values                 | 18        |
| Not counted: CVV / AVS / 3DS result values           | 6 / 3 / 5 |
| Not counted: Hosted Payment Fields JavaScript rows   | 7         |
| Not counted: HTTP statuses (3.1)                     | 11        |
| Not counted: Extended Payment API rows (4.15)        | 142       |

The ACH return code table on S/ecp has 21 rows (`R01`-`R16`, `R20`, `R28`, `R29`, `R31`, `R34`), so the decodable total is **248** (227 + 21).

### 5. Lifecycle

Card, alternative payment, refund, dispute, subscription and payout flows are documented separately and should stay separate in the adapter.

#### 5.1 Card payments (Payment API)

- **Auth Only** (`POST /services/2/transactions`, `cardTransactionType` `AUTH_ONLY`): checks the card and holds funds; "each credit card company will only hold the authorization for a limited period (for example, 3-10 days, depending on the credit card scheme)" (J/auth-only). Zero-amount auth is allowed. Webhook `AUTH_ONLY_SINGLE_CHARGE` on success (the `AUTH_ONLY` webhook is described for zero-amount trial subscriptions).
- **Capture** (`PUT /services/2/transactions`, `CAPTURE`): needs a prior Auth Only; the response `transactionId` "will match the `transactionId` for the initial Auth Only". `amount` optional (default full auth); partial and, when `supportsMultiPartialCapture` is true, multiple partial captures; `openToCapture` shows what remains. Wrong method gives `85 INVALID_HTTP_METHOD`. A failed capture is signalled in webhooks by `captureStatus=FAIL` and `captureReferenceNumber`.
- **Auth Capture** (`POST`, `AUTH_CAPTURE`): authorize and capture in one call. Webhook `CHARGE`.
- **Auth Reversal** (`PUT`, `AUTH_REVERSAL`): voids an uncaptured authorization in full; "must be performed within 8 days of the initial Auth Only request, or else an error will occur". Response repeats the auth with `cardTransactionType` `AUTH_REVERSAL` and the same `transactionId`.
- **Decline**: HTTP 400 with `message[]` (section 4.1). Webhooks: `DECLINE` ("rejected due to payment processing or review process", with `declineReason`), `CC_CHARGE_FAILED` (initial charge failure, with `failureReason`, `errorProcessingCode`), `FRAUD_DECLINE` (with `fraudDeclineDate`, `3dStatus`).
- **Fraud review**: `processingStatus` `PENDING_MERCHANT_REVIEW`; the merchant approves or declines with Merchant Approve Transaction (HTTP 204). Webhook `UNDER_VENDOR_REVIEW` is sent for each order when "Review all orders" is set. The merchant-approval examples show `transactionStatus` values `Waiting`, `Approved`, `Canceled`.
- **Retrieve** (`GET /services/2/transactions/{transactionId}`): returns the current `cardTransaction`, including `refunds` and `chargebacks` objects; an example shows `cardTransactionType` `REFUND` with a `refunds.refund[]` list.
- **Idempotency**: `idempotency-key` on POST requests (Auth Capture, Auth Only, Capture, Auth Reversal, PayPal, ECP, Refund, Create Vaulted Shopper, Create Plan); keys kept 24 hours; a replay returns the previous response "and includes the idempotency key". The exact place of that echo (header or body) is **NOT DOCUMENTED**.

#### 5.2 Alternative payments

- **ACH/ECP** (J/ach-ecp): invoice created `PENDING` and `CHARGE_PENDING` webhook; within 3 days the bank may reject (`FAIL`, `DECLINE` webhook); without a rejection the invoice is approved (`SUCCESS`, `CHARGE` webhook); the shopper has 60 days to dispute, then BlueSnap removes the funds, sends a `REFUND` webhook and the status becomes `REFUNDED`. `ACH_NOTIFICATION_OF_CHANGE` reports changed bank details.
- **SEPA Direct Debit** (J/sepa-direct-debit): `processingStatus` `PENDING`; debit within 5 to 6 business days, then `CHARGE` (or `RECURRING`) webhook with `sepaMandateId` and `sepaMandateDate`. Sandbox flows: pending to success, pending to fail, pending to success to refunded.
- **PayPal** (J/paypal, J/processing-info): `PENDING`, `SUCCESS`, `FAIL`, `REFUNDED`, `CHARGEBACKED`; a pending authorization flow uses `transactionType` `DO_ORDER` on the PayPal request.
- BECS Direct Debit and Pre-Authorized Debit flows: **NOT DOCUMENTED** here (pages not read).

#### 5.3 Refunds

- `POST /services/2/transactions/refund/{transactionId}` (or `/refund/merchant/{merchantTransactionId}`); full when no `amount`; partial with `amount`; refunds in the original currency; only for transactions under 2 years old; supported for ACH, cards and wallets, PayPal and SEPA (J/refund).
- "We attempt to void the transaction before issuing a refund" for cards and ACH; whether a refund became a void is not visible in the documented response (**NOT DOCUMENTED**).
- `refundStatus` `SUCCESS` or `PENDING`. Pending refunds happen when the merchant balance is insufficient; webhook `PENDING_REFUND` is sent when the refund is initiated and again when a pending refund is deleted after 3 months of failed attempts; `DELETE /transactions/pending-refund/{transactionId}` cancels it; Balance Funding (Available Funds, Add Funds) releases it.
- `cancelSubscriptions` defaults to `true`, so a refund can also cancel the linked subscription (`CANCELLATION_REFUND` webhook).
- Webhook `REFUND` carries `reversalRefNum`, `reversalAmount`, `reversalReason` and the original `referenceNumber`.

#### 5.4 Chargebacks and disputes

- API: `chargebacks.chargeback[]` on the transaction (J/chargeback): `chargebackTransactionId`, `amount` (positive), `currency`, `date`. No dispute status in the API object.
- Webhook `CHARGEBACK` (new chargeback) and `CHARGEBACK_STATUS_CHANGED` ("An event is received from Chargebacks911 that does not open a new chargeback") with `cbStatus` in {`New`, `Working`, `Completed_Won`, `Completed_Lost`, `Completed_Pending`}, `chargebackId` (Chargebacks911 case number), `reversalRefNum`, `reversalReason`, `dateDue` (`yyyy-mm-dd`, last day to dispute), `sourceInvoiceCaptureDate` (multi-capture auths), `purchaseDate`. `cycle` (`1` first chargeback, `2` second chargeback, `9` retrieval request) is listed for `CHARGEBACK_STATUS_CHANGED`.
- `CHARGEBACK_FILE_UPLOADED` after the Chargeback Representment Upload API: `status` `NEW`, `REFUND`, `COMPLETE`; `ARN`, `caseNumber`, `chargebackId`, `dateSuccessfullySubmitted`.
- Process (S/about-chargebacks): retrieval request (no money movement), chargeback (BlueSnap debits the merchant and notifies by email or webhook), representment, win or loss, possible pre-arbitration (BlueSnap debits again; BlueSnap does not recommend or support responding to pre-arbitration). Partial chargebacks are possible in pre-arbitration; "Multiple partial chargebacks cannot be created".
- Prevention alerts (Ethoca, Verifi) lead to refunds; "BlueSnap does not currently notify merchants when they receive alerts or when refunds are issued due to an alert" (S/chargeback-faqs). A refund caused by an alert is therefore indistinguishable in the documented payloads (**NOT DOCUMENTED**).
- `RDR` is listed as a `transactionType` value and as a webhook in the parameter reference, but has no entry in the name reference (section 10).
- ACH disputes appear as `REFUND` webhooks with `REFUNDED` status, not as `CHARGEBACK` (J/ach-ecp); PayPal uses `CHARGEBACKED`.

#### 5.5 Subscriptions

- Plans and subscriptions (`/services/2/recurring/plans`, `/recurring/subscriptions`) or merchant-managed subscriptions (`/recurring/ondemand`, per the guide).
- Subscription `status`: `ACTIVE`, `CANCELED`, `ON_HOLD` (outside its grace period), `SUSPENDED`, `FINISHED` (reached the plan's maximum number of charges) (J/recurring-subscription).
- Webhooks: `CHARGE` (first payment), `RECURRING` (second and later; `originalRefNum` points at the initial transaction), `SUBSCRIPTION_CHARGE_FAILURE` (`failureReason`, `errorProcessingCode`, `numberOfAttemptsDone`, `lastAttempt` Y/N, `daysTillCancelDate`), `CANCELLATION` (`cancelReason`), `CANCEL_ON_RENEWAL`, `CANCELLATION_REFUND`, `CONTRACT_CHANGE` (`oldContractId`, `newProductId`), `SUBSCRIPTION_REMINDER` (`reminderNumber`, `daysTillPaymentDue`), `ACCOUNT_UPDATER` (`responseMessage`, `linkedSubscriptions` when `responseMessage` is `501 - Account closed`).
- For ACH and SEPA subscriptions "the subscription ID is not returned in the Create Subscription response"; it is created after the payment processes (2-6 business days).
- The retry schedule for failed recurring charges is **NOT DOCUMENTED** in the pages read.

#### 5.6 Payouts

- BlueSnap pays the merchant (not cardholder payouts). Webhook `PAYOUT` per payout with indexed `amount[N]`, `currency[N]`, `legalEntity[N]`, plus `paymentId`, `destination`, `paymentCycleStartDate`, `paymentCycleEndDate`; it has no `transactionType` in its parameter list. "If there are insufficient funds for a payout, no payout notification is sent". `FAILED_PAYOUT_TRANSFER` reports a failed transfer.
- Marketplace vendors: `verification.payoutStatus` `Incomplete`, `Pending`, `Approved`, `Declined` and `processingStatus` `Active`, `Inactive`; webhooks `VENDOR_STATUS_CHANGED` and `VENDOR_REPORT_AVAILABLE`.

#### 5.7 Authorized, captured, settled

- **Authorized**: `AUTH_ONLY` with `processingStatus` success; `openToCapture` greater than zero.
- **Captured**: `CAPTURE` or `AUTH_CAPTURE` success. BlueSnap does not document a separate settlement state in API payloads (**NOT DOCUMENTED**); settlement to the merchant appears only as `PAYOUT`.
- **Voided**: `AUTH_REVERSAL` success.
- **Refunded / pending refund**: `refundStatus`; `refunds.balanceAmount` for what remains refundable.

### 6. Notifications (webhooks / IPNs)

#### 6.1 Delivery

- **Transport**: HTTPS POST to the merchant's endpoint URL; header `Content-type: "application/x-www-form-urlencoded"`; the body is the name-value string (S/ipn-setup, B/webhooks-ipns). SSL with a valid certificate is required. Several endpoint URLs can each receive different webhook types.
- **Acknowledgement**: "an empty HTTP `200 OK`". Otherwise BlueSnap retries "up to 11 times"; after the 11th attempt it emails a "Webhook Failure" notice to the contact address (S/ipn-faqs). The retry **interval is NOT DOCUMENTED**.
- **Manual resend**: from the order record in the Merchant Portal (**Resend** > **Webhook**), which produces a duplicate by design.
- **Test**: the **Test** button sends "an empty GET request".
- **One per order**: "A single webhook is sent per order" even for several contracts.
- **Ordering**: **NOT DOCUMENTED**. Retries can deliver an older event after a newer one.
- **Source IPs**: sandbox `141.226.140.200`, `141.226.141.200`, `141.226.142.200`, `141.226.143.200`; production `141.226.140.100`, `141.226.141.100`, `141.226.142.100`, `141.226.143.100` (S/ipn-setup table; the code samples on the same page list other addresses, section 10).
- **Configuration API**: `GET`/`POST`/`DELETE https://sandbox.bluesnap.com/services/2/notification-config/` with `ipnDestinations[]` (`ipnUrl` and boolean flags such as `sendCharge`, `sendChargeback`, `sendChargebackStatusChanged`, `sendDecline`, `sendRefund`, `sendPayout`, `sendFraudDecline`, `sendChargePending`), `ensureNotificationReceipt`, `receiveAffiliateNotifications` (B/webhooks-ipns). Flags not sent are set to `false`.

#### 6.2 Webhook types (S/ipns-name-reference): 34

"The webhook name is sent in the `transactionType` parameter" (S/about-ipns).

| Group                  | `transactionType` values                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments               | `CHARGE`, `CHARGE_PENDING`, `AUTH_ONLY`, `AUTH_ONLY_SINGLE_CHARGE`, `DECLINE`, `CC_CHARGE_FAILED`, `FRAUD_DECLINE`, `UNDER_VENDOR_REVIEW`, `OFFLINE_ORDER`                      |
| Refunds and disputes   | `REFUND`, `PENDING_REFUND`, `CANCELLATION_REFUND`, `CHARGEBACK`, `CHARGEBACK_STATUS_CHANGED`, `CHARGEBACK_FILE_UPLOADED`                                                        |
| Subscriptions          | `RECURRING`, `SUBSCRIPTION_CHARGE_FAILURE`, `CANCELLATION`, `CANCEL_ON_RENEWAL`, `CONTRACT_CHANGE`, `SUBSCRIPTION_REMINDER`                                                     |
| Payment methods        | `ACCOUNT_UPDATER`, `ACH_NOTIFICATION_OF_CHANGE`, `CC_STATUS_CHANGED`, `PAYMENT_METHOD_UPDATED`, `PAYMENT_METHOD_UPDATE_FAILURE`, `VAULTED_SHOPPER`                              |
| Payouts and onboarding | `PAYOUT`, `FAILED_PAYOUT_TRANSFER`, `VENDOR_STATUS_CHANGED`, `VENDOR_REPORT_AVAILABLE`, `MERCHANT_PARTNER_ONBOARDED`, `MERCHANT_PARTNER_STATUS`, `APPLICATION_DOCUMENT_REQUEST` |

BlueSnap's recommended set for API integrations: `CHARGE`, `CHARGEBACK`, `CHARGEBACK_STATUS_CHANGED`, `PAYOUT`; suggested: `DECLINE`, `CC_STATUS_CHANGED`, `FAILED_PAYOUT_TRANSFER`, `PENDING_REFUND`, `REFUND`, `VAULTED_SHOPPER` (S/recommended-ipns). The support FAQ adds that API integrations still need webhooks for "offline events such as disputes, chargebacks, and subscription cancellations".

#### 6.3 Fields an adapter needs first (S/ipn-parameter-reference)

| Field                                                                                                                               | Meaning                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `transactionType`                                                                                                                   | Webhook type (6.2)                                                                                                   |
| `referenceNumber`                                                                                                                   | "BlueSnap reference number"; "the same as an invoice, order, or transaction ID"                                      |
| `reversalRefNum`, `reversalAmount`, `reversalReason`                                                                                | Reference number, amount and reason of the refund or chargeback; the original transaction stays in `referenceNumber` |
| `originalRefNum`                                                                                                                    | Initial transaction of the recurring contract                                                                        |
| `merchantTransactionId`                                                                                                             | Merchant's transaction ID                                                                                            |
| `declineReason`                                                                                                                     | "Includes the decline reason code and description" (`DECLINE`)                                                       |
| `failureReason`, `errorProcessingCode`                                                                                              | Failure text and "Error code" (`CC_CHARGE_FAILED`, `SUBSCRIPTION_CHARGE_FAILURE`)                                    |
| `cbStatus`, `chargebackId`, `cycle`, `dateDue`                                                                                      | Chargeback state (5.4)                                                                                               |
| `cancelReason`                                                                                                                      | Subscription cancellation reason (also carries ACH return codes)                                                     |
| `captureStatus`, `captureReferenceNumber`                                                                                           | Failed capture (`captureStatus` is always `FAIL` when present)                                                       |
| `3dStatus`, `cvvResponse`, `cvvSent`, `avsResponse`, `avsSent`                                                                      | Authentication and verification outcome (text values)                                                                |
| `invoiceAmount`, `invoiceAmountUSD`, `invoiceChargeAmount`, `invoiceChargeCurrency`, `currency`, `netPaymentAmount`, `surchargeFee` | Amounts (`#,###.##` format)                                                                                          |
| `paymentMethod` / `paymentType`                                                                                                     | Method (`CC`, `ECP`, `PAYPAL`, `SEPA_DIRECT_DEBIT`, `APPLE_PAY`, `GOOGLE_PAY` and 37 more)                           |
| `transactionDate`                                                                                                                   | `mm/dd/yyyy hh:mi AM/PM`, URL-encoded (`11%2F17%2F2015+07%3A34+AM`); time zone **NOT DOCUMENTED**                    |
| `testMode`                                                                                                                          | `Y` / `N`                                                                                                            |
| `bluesnapNode` (also `plimusNode`)                                                                                                  | Data center: `1` US, `2` UK, `99` sandbox                                                                            |
| `subscriptionId`, `contractId`, `productId`, `accountId`, `vaultedShopperId`                                                        | Subscription, contract, product and shopper                                                                          |
| `authkey` / `authKey`                                                                                                               | Optional MD5 signature (6.4)                                                                                         |

#### 6.4 Authentication fields (sensitive; PandaPayLens does not verify them)

- **`authkey`** (parameter reference spelling; examples use `authKey`): empty unless a Data Protection Key is set; then `MD5(referenceNumber + contractId + DataProtectionKey)`, or for Account Updater `MD5(accountId + originalCreditCardLast4Digits + DataProtectionKey)`. A 32-hex value.
- **Security header** (optional, S/ipn-setup): `Bls-Ipn-Timestamp` (format `YYYY-MM-DD HH:MM:SS.zzz`) and `Bls-Signature`. The page describes the signature as "generated by concatenating the SHA-256 hash of `Bls-Ipn-Timestamp` value with the webhook body", shows its "format" as a timestamp, and tells the merchant to "decrypt" it with a generated encryption key. The exact algorithm is therefore **NOT DOCUMENTED** clearly (section 10).
- **Source IP allow-listing** is the other documented check.
- PandaPayLens should redact `authkey`/`authKey` and `Bls-Signature`, may report "signature present (32 hex)" for `authkey`, and must never ask for the Data Protection Key or the security header key.

#### 6.5 Duplicate identification

- Webhooks have **no event or delivery ID** and no attempt counter. Duplicates are expected from up to 11 retries and from manual resends.
- Suggested dedupe key (suggestion): `transactionType` + `referenceNumber` + `reversalRefNum` (when present) + `cbStatus` (chargeback status changes) + `transactionDate`. Whether `transactionDate` stays the same across retries is **NOT DOCUMENTED**; it has minute precision, so two genuine events in the same minute can collide.
- API: `idempotency-key` deduplicates POST requests for 24 hours; `PROCESSING_DUPLICATE` (`14002`) reports a duplicate at the processor.

#### 6.6 Examples

Both documented webhook examples (B/webhooks-ipns and S/about-ipns, identical) contain shopper names, an email address, a street address and an IP address. The excerpts below keep only non-personal parameters, in their original order, with omissions marked `...`.

Example E: `CHARGE` webhook. **Excerpt transcribed from https://developers.bluesnap.com/reference/webhooks-ipns** ("Example webhook - Charge"):

```text
...&invoiceAmount=30.00&language=ENGLISH&creditCardType=VISA&invoiceAmountUSD=30.00&templateId=91&...&contractOwner=500801&referenceNumber=1011310133&...&currency=USD&...&invoiceChargeCurrency=USD&cardSubType=CREDIT&invoiceChargeAmount=30.00&...&creditCardLastFourDigits=1111&testMode=N&contractId=2269035&addCD=N&untilDate=11%2F17%2F2015+07%3A34+AM&paymentMethod=CC&paymentType=CC&...&targetBalance=BLUESNAP_ACCOUNT&...&authKey=&transactionType=CHARGE&bluesnapNode=99&plimusNode=99&...&cvvSent=Y&avsSent=N&cvvResponse=Not+processed+&avsResponse=Issuer+unavailable+or+AVS+not+supported+%28US+Issuer%29+&transactionDate=11%2F17%2F2015+07%3A34+AM
```

Example F: `CANCELLATION` webhook. **Excerpt transcribed from the same page** ("Example webhook - Cancellation"):

```text
...&invoiceAmount=2.00&...&creditCardType=VISA&cardSubType=DEBIT&cardCategory=PEONY&invoiceAmountUSD=2.00&...&referenceNumber=38528358&...&currency=USD&cancelReason=test&...&originalRefNum=38528358&transactionType=CANCELLATION&...&testMode=N&contractId=2186556&paymentMethod=&subscriptionId=39546714&...&authKey=4df72f8c802a6caf5b0e3e4439cfb891&targetBalance=BLUESNAP_ACCOUNT&...&cancelledContractId=2186556&...&bluesnapNode=1&plimusNode=1&couponCode=&transactionDate=08%2F22%2F2016+04%3A10+PM&merchantTransactionId=&vendorId=11111&vendorName=vendor+name+test
```

Notes: values are URL-encoded with `+` for spaces; many parameters are present but empty; custom contract fields appear under their own titles (`Color=Green` in the full example), so unknown keys are normal. No documented example exists for `DECLINE`, `CHARGEBACK`, `REFUND` or `PAYOUT`; tests for those must be built from the parameter lists.

### 7. Identifiers

| Field                                                                                                 | Scope                          | Notes                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transactionId` (API), `referenceNumber` (webhook)                                                    | BlueSnap transaction / invoice | Same ID per the parameter reference ("the same as an invoice, order, or transaction ID"). Capture and Auth Reversal keep the Auth Only `transactionId`. Examples are 8-10 digit numbers, sometimes as string, sometimes as number |
| `refundTransactionId` (API), `reversalRefNum` (webhook)                                               | Refund                         | That `reversalRefNum` equals `refundTransactionId` is an inference from both descriptions, not stated                                                                                                                             |
| `chargebackTransactionId` (API), `reversalRefNum` (webhook)                                           | Chargeback                     | Same inference as above                                                                                                                                                                                                           |
| `originalTransactionId`                                                                               | Parent link                    | Only in Retrieve when looked up by a refund transaction ID                                                                                                                                                                        |
| `originalRefNum`                                                                                      | Subscription parent            | Initial transaction of a recurring contract (`RECURRING`, `CANCELLATION`, `SUBSCRIPTION_CHARGE_FAILURE`)                                                                                                                          |
| `captureReferenceNumber`                                                                              | Capture                        | Webhook only                                                                                                                                                                                                                      |
| `merchantTransactionId`                                                                               | Merchant reference             | 1-50 characters; usable for Retrieve (`{merchantTransactionId},{merchantId}`), Refund and Auth Reversal; duplicates give `20002`                                                                                                  |
| `vaultedShopperId`, `accountId`, `merchantShopperId`, `sellerShopperId`                               | Shopper                        | `accountId` is "BlueSnap account ID assigned to the shopper"; its relation to `vaultedShopperId` is **NOT DOCUMENTED**                                                                                                            |
| `subscriptionId`, `contractId`, `planId`, `productId`, `cancelledContractId`, `oldContractId`         | Subscriptions and catalog      |                                                                                                                                                                                                                                   |
| `networkTransactionId`, `originalNetworkTransactionId`                                                | Scheme                         | MIT / card-on-file chains                                                                                                                                                                                                         |
| `authorizationCode` (API), `issuerAuthCode` (webhook)                                                 | Issuer authorization           |                                                                                                                                                                                                                                   |
| `fraudReferenceId`, `fraudTransactionId`                                                              | Fraud check                    | BlueSnap and Kount IDs                                                                                                                                                                                                            |
| `chargebackId`, `caseNumber`, `ARN`                                                                   | Disputes                       | Chargebacks911 case, card brand case, acquirer reference number                                                                                                                                                                   |
| `threeDSecureReferenceId`, `dsTransactionId`, `acsTransactionId`                                      | 3-D Secure                     |                                                                                                                                                                                                                                   |
| `paymentId`                                                                                           | Payout                         | Also a column in the Declined Auth Details report                                                                                                                                                                                 |
| `batchId`, `offlineOrderId`, `accountUpdaterLineId`, `taxReference`, `surchargeReference`, `vendorId` | Other                          |                                                                                                                                                                                                                                   |
| `merchantId`                                                                                          | Merchant account               | Mask in output                                                                                                                                                                                                                    |

### 8. Sensitive fields

Redact or mask by default (request fields are included because request and response pairs get pasted):

- **Card data**: `creditCard.cardNumber`, `securityCode`, `expirationMonth`, `expirationYear`, `encryptedCardNumber` and `encryptedSecurityCode` style values (client-side encryption), `pfToken`, `securityCodePfToken`, `binNumber` together with `cardLastFourDigits` / `creditCardLastFourDigits`, `creditCardExpDate`, `dpanLastFourDigits`, `dpanExpDate`, `originalCreditCard*`, `updatedCreditCard*`, `last4digit`.
- **Wallet and 3-D Secure**: `wallet.encodedPaymentToken`, `cavv`, `xid`, `dsTransactionId`, `acsTransactionId`, `threeDSecureReferenceId`.
- **Signatures and secrets**: `authorization` header (the documentation itself contains Basic values that decode to a username and password pair), `authkey` / `authKey`, `Bls-Signature`, `surchargeToken`, `idempotency-key` (low risk).
- **Bank data**: `ecpTransaction.accountNumber` (shown unmasked in examples), `routingNumber`, `ecpPublicAccount`, `ecpPublicRouting`, `bankAccountNumber`, `bankAccountBsbNumber` / `bsbNumber`, `sepaIban` (masked `{first4}XXXXXXXXX{last4}`), `sepaMandateId`, IBAN text in `preNotificationText`.
- **Personal data**: all `cardHolderInfo`, `payerInfo`, `billingContactInfo` and `shippingContactInfo` fields; webhook `firstName`, `lastName`, `email`, `address1`, `address2`, `city`, `state`, `zipCode`, `country`, `homePhone`, `workPhone`, `mobilePhone`, `faxNumber`, `company`, all `invoice*` and `shipping*` contact fields, `credit*` name and address fields, `username`, `remoteAddress`, `personalId`, `personalIdentificationNumber`, `brazilianId`, `vatId`, `transactionFraudInfo.shopperIpAddress`, `fraudSessionId`, `customerId`.
- **Links with access keys**: `invoiceURL` / `invoiceUrl`, `invoiceInfoURL`, `shopperOrderUrl`, `shopperAdminUrl`, `paymentURL` (they carry `refId` and `acd` query values for the order locator).
- **Dispute and issuer data**: `ARN`, `caseNumber`, `chargebackId`, `authorizationCode`, `issuerAuthCode`, `licenseKey`.
- **Merchant identifiers**: `merchantId`, `contractOwner`, `merchantEmail`, `merchantName`, `payee*`, `ipnUrl`.

### 9. Structural detection hints

Strong BlueSnap signals (combine several):

1. **Error body**: top-level `message` that is an **array** of objects with `errorName` (upper snake case), `code` (integer, typical values `10000`, `10001`, `14002`, `15011`, `20xxx`, `60101`-`60106`) and `description`; optionally `invalidProperty.name` or `fraudEvents.fraudReferenceId`. in the one documented processor decline, `description` starts with `Transaction failed because of payment processing failure.:`.
2. **Card transaction JSON**: `cardTransactionType` in {`AUTH_ONLY`, `AUTH_CAPTURE`, `CAPTURE`, `AUTH_REVERSAL`, `REFUND`} with `transactionId`, `processingInfo.processingStatus`, `transactionApprovalDate` (`MM/DD/YYYY`) and `transactionApprovalTime`; also `vaultedShopperId`, `usdAmount`, `openToCapture`, `softDescriptor` beginning `BLS*`, two-letter `cvvResponseCode` (`MA`, `ND`, `NR`), `avsResponseCodeZip` / `avsResponseCodeAddress` / `avsResponseCodeName`, `fraudResultInfo`.
3. **Refund JSON**: `refundTransactionId` with `refundStatus` in {`SUCCESS`, `PENDING`} and `cancelSubscriptions`.
4. **Alt transaction JSON**: one of `ecpTransaction`, `sepaDirectDebitTransaction`, `paypalTransaction`, `becsDirectDebitTransaction`, `acssDirectDebitTransaction` plus `processingInfo.processingStatus` `PENDING` and `payerInfo` or `vaultedShopperId`.
5. **Webhook (form-encoded)**: `transactionType` with an upper snake case value from 6.2, `referenceNumber`, `bluesnapNode` and/or `plimusNode` (`1`, `2`, `99`), `contractId` / `contractName` / `contractOwner`, `invoiceAmountUSD`, `invoiceChargeCurrency`, `targetBalance` (`BLUESNAP_ACCOUNT`), `testMode` `Y`/`N`, `untilDate`, `authKey`, and dates like `11%2F17%2F2015+07%3A34+AM`. Any two of `bluesnapNode`, `plimusNode`, `referenceNumber` + `contractId`, `invoiceAmountUSD` are decisive. Links to `order_locator_info.jsp` or `show_invoice.jsp` on `sandbox.bluesnap.com` or `shoppers.bluesnap.com` also identify BlueSnap.
6. **XML (report as unsupported)**: namespace `http://ws.plimus.com`; roots `card-transaction`, `messages`, `refund`, `alt-transaction`, `vaulted-shopper`, `recurring-subscription`; elements `error-name`, `processing-info`, `processing-status`, `card-transaction-type`.
7. **Hosts, paths, headers**: `ws.bluesnap.com`, `sandbox.bluesnap.com`, `/services/2/transactions`, `/services/2/alt-transactions`, `/services/2/transactions/refund/`, `/services/2/notification-config/`; headers `bluesnap-version`, `Bls-Ipn-Timestamp`, `Bls-Signature`.

How this differs from supported providers and other candidates:

- **Stripe**: JSON with `object` and prefixed IDs (`pi_`, `ch_`, `evt_`); errors under `error.type` / `error.code` / `decline_code`. BlueSnap IDs are bare numbers and errors are a top-level `message` array.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in BlueSnap payloads.
- **payabl.**: URL-encoded `transactionid` / `transid`, `errormessage`, `security`. BlueSnap webhooks use `referenceNumber`, `transactionType`, `authKey`.
- **Checkout.com, Mollie, Square, Braintree**: their JSON envelopes and webhook keys (own research files) have no `cardTransactionType`, `processingInfo` or `errorName`.
- **PayPal**: errors use `name` + `message` (string) + `debug_id`; webhooks use dotted `event_type`. BlueSnap's `message` is an array of objects. A PayPal payment processed through BlueSnap arrives in BlueSnap's format (`paymentMethod=PAYPAL`, `paypalTransactionId`) and belongs to the BlueSnap adapter.
- **Worldpay**: also uses a camelCase `errorName`, but next to a **string** `message` at top level (worldpay research file). BlueSnap nests `errorName` inside each `message[]` item with a numeric `code`. Check the shape, not the key.
- **Authorize.net**: `messages` object with `resultCode` and codes shaped `^[IE]\d{5}$`; BlueSnap uses `message` (singular) as an array and numeric codes.
- **Cybersource**: `...Information` objects, `submitTimeUtc`, `_links`; none in BlueSnap.
- **NMI**: lowercase `response`, `responsetext`, `transactionid`; BlueSnap never uses `responsetext`.
- **Nuvei**: DMNs also carry `transactionType`, but with `Sale` / `Auth` / `Credit` values and `ppp_status`, `PPP_TransactionID`, `advanceResponseChecksum`. BlueSnap values are upper snake case (`CHARGE`, `REFUND`) and there is no `ppp_status`.
- **CCBill**: `clientAccnum` + `clientSubacc`, `eventType`; BlueSnap has neither.
- **Segpay**: `purchaseid`, `eticketid`, `trantype`, `approved=Yes|No`; BlueSnap has none of these.
- **Verotel, NETbilling, Epoch and other form-post candidates**: their decisive keys (`saleID` + `shopID`, `status_code` + `trans_id`, `Ecom_Ezic_*`) do not occur in BlueSnap webhooks. Generic keys such as `subscriptionId`, `transactionId`, `firstName`, `email` occur in several providers and must not decide alone.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Code numbers are groups, not reasons**: 37 card error names share `14002`; `10000` and `10001` cover unrelated cases. Decode by `errorName`.
2. **Same number, different meaning across pages**: `14034` is `INVALID_PAYMENT_DETAILS` (alt) and `VENDOR_PAYOUT_VALUES_EXCEEDS_MERCHANT` (marketplace); `20051` is `VALIDATION_GENERAL_FAILURE` for a vendor commission conflict; `90014` is `NEGATIVE_QUANTITY` (subscriptions) but `ORDER_NOT_FOUND` and `PERSISTED_SHOPPING_CONTEXT_NOT_FOUND` (Extended); `90032` is `EXISTING_CHARGE_PENDING_APPROVAL` (subscriptions) but `UPDATE_SUBSCRIPTION_FAILED` (Extended); `24011` is `CURRENCY_CODE_NOT_FOUND` (alt) and `CURRENCY_NOT_FOUND` (subscriptions); `14040` `EXPIRED_TOKEN` covers both Hosted Payment Fields and surcharge tokens.
3. **Same name, different code**: `THREE_D_SECURITY_AUTHENTICATION_REQUIRED` is `14002` in the Payment API and `14001` in the Extended table; `MISSING_CARD_TYPE` is listed under both `90` and `10001`; `INVALID_TRANSACTION_TYPE` is `7` (card) and `16104` (surcharge); `INVALID_CARD_NUMBER` is `14002` (card) and `16103` (surcharge).
4. **Conflicting advice**: `SYSTEM_TECHNICAL_ERROR` says "Do not retry" on the Payment API page and "Retry the transaction" on the Extended page; `PROCESSING_TIMEOUT` says "Retry" (XML page) and "Retry. If issue persists, contact BlueSnap Support" (JSON page).
5. **JSON and XML error pages differ**: the JSON card page has 4 names the XML page lacks (`BLS_NO_SUCH_SHOPPER_PAYMENT_METHOD`, `NEW_ACCOUNT_INFORMATION_AVAILABLE`, `PROCESSING_TRANSACTION_NOT_AUTHORIZED`, `PAYMENT_METHOD_LIMIT_REACHED`); the JSON subscription page has `24023`, the XML page does not. Descriptions and advice also differ slightly.
6. **`code` type**: integer in the JSON docs, `xs:string` in `messages.xsd`, string `"4"` in the batch example. `invalidProperty` and `fraudEvents` are typed "string" but are objects.
7. **Value casing**: `processingStatus` is `SUCCESS` in the table and Retrieve examples but `success` in Auth Capture examples and `fail` in the batch example; `fraudEventCode` appears as `blacklistShippingCountryDecline` (table) and `blacklistshippingcountrydecline` (example); webhook `authkey` (reference) vs `authKey` (examples); `invoiceURL` (example) vs `invoiceUrl` (reference); `transactionType` values are display names in the parameter reference ("Charge", "Fraud Decline") and upper snake case in the name reference and examples (`CHARGE`).
8. **Invalid or mislabeled examples**: the "Multiple fraud events" JSON is missing closing braces; the batch error sample is labeled `xml`, is JSON, and has an unquoted URL; one Auth Capture request example has a missing comma; the batch error page talks about `processing-info` elements but the sample uses camelCase.
9. **Type drift in examples**: `transactionId` is a string in most responses and a number in the Hosted Payment Fields and ECP examples; `vaultedShopperId` is a number or a string; `amount` is a number or a string; `softDescriptor` is shown HTML-escaped as `BLS&#x2a;...` in some examples.
10. **AVS values**: examples show `avsResponseCode` `N` and `X` at the top level of the transaction, which neither the object table nor the AVS page lists. The AVS page names XML properties (`avs-response-code-zip`) even in the shared reference.
11. **Webhook security header**: the description mixes hashing ("SHA-256 hash ... concatenating"), a format shown as a timestamp, and "decrypt" with an encryption key; the algorithm cannot be reproduced from the page.
12. **Webhook source IPs**: the table lists `141.226.14x.100` / `.200`, while the code samples on the same page list `62.216.234.216`, `209.128.93.x` and `38.99.111.x` addresses.
13. **Webhook coverage gaps**: `RDR` appears as a `transactionType` value and as a webhook in the parameter reference but has no section in the name reference; the parameter reference lists webhooks named "Payment Updated" while the name reference uses `PAYMENT_METHOD_UPDATED`; the configuration API flags (`sendPaymentUpdate`, `sendCcFailure`, `sendSubCcFailure`, `sendMerchantOnboarded`) do not map one-to-one to the 34 names; `PAYOUT` has no `transactionType` parameter in its list although the overview says the name is always sent in `transactionType`; `VENDOR_STATUS_CHANGED` description is cut off ("Sent to the Marketplace Merchant when:").
14. **Timestamps**: API `transactionApprovalTime` is Pacific time; webhook `transactionDate` has no stated time zone and minute precision; refund and chargeback `date` formats are not specified (examples `YYYY-MM-DD`); `daysTillPaymentDue` and `daysTillCancelDate` are typed as dates but described as day counts.
15. **No webhook event ID, retry interval or ordering**; manual resends create duplicates by design.
16. **Processor decline codes** are not listed anywhere read; only BlueSnap's normalized names and one embedded example (`530 - ...`) exist. `proccessorCode` is deprecated; `errorProcessingCode` is undescribed.
17. **Few error examples**: only the overview template, the `DO_NOT_HONOR` example and the two fraud examples show a `message` body. Bodies for HTTP 403, 404, 429, 500 and 503 are not shown.
18. **Surcharge page intro** says the errors are for "a subscription or billing plan request" (copied text).
19. **Ownership change**: BlueSnap states that Payroc acquired it in 2025; the developer documentation has not changed format, but future changes are possible.
20. **Not read**: Embedded Payments, BECS and Pre-Authorized Debit pages, card brand chargeback reason code pages, refund and payout support pages, Reporting API details. Anything only from those pages is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | 227 first-party error rows with stable `errorName` values, BlueSnap's own retry advice for the card table, 21 ACH return codes, CVV/AVS/3DS value sets, and a clear error envelope. Decoding keyed on `errorName` (with `code` as context) avoids the shared-number problem. Raw processor codes are not documented and stay `unknown`; text appended to `description` can be shown but not classified.                             |
| **paymentResponses** | **supported** | Every card, refund and alt transaction page read has an object table and JSON examples with a stable core (`cardTransactionType`, `transactionId`, `processingInfo.processingStatus`, `refundStatus`). Casing and type drift (`success` vs `SUCCESS`, string vs number IDs) is easy to tolerate. JSON only: XML responses must be reported as unsupported until PandaPayLens parses XML.                                            |
| **webhookParsing**   | **limited**   | A complete parameter reference, 34 named types, a documented content type and two full examples. But: no event ID, no retry interval, no ordering guarantee, unclear security header algorithm, display-name vs code mismatch for `transactionType`, missing `RDR` section, no examples for decline, refund, chargeback or payout webhooks, and free-text reason fields.                                                            |
| **timeline**         | **limited**   | Lifecycle steps are well described (auth, capture, reversal, refund, pending refund, chargeback statuses, ACH pending to success or fail, subscription events). Limits: declined API calls return no transaction ID or timestamp, `transactionApprovalTime` is Pacific time while webhook times have no time zone and minute precision, and a timeline built from webhooks cannot rely on delivery order.                           |
| **correlation**      | **limited**   | `transactionId` = `referenceNumber` is stated, Capture and Auth Reversal reuse the auth ID, `originalRefNum` links recurring charges and `merchantTransactionId` is shared by API and webhooks. However the link between `refundTransactionId` / `chargebackTransactionId` and webhook `reversalRefNum` is an inference, `accountId` vs `vaultedShopperId` is not explained, and failed API calls have no BlueSnap ID to correlate. |
