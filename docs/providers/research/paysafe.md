# Paysafe (adapter id `paysafe`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Paysafe's first-party documentation (developer portal, Payments API OpenAPI file, reference pages), Paysafe's own websites and Paysafe's official SDK repositories as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Scope: the Paysafe payments platform as exposed through the **Payments API** (`/paymenthub/v1/`, payment handles, payments, settlements, refunds, voids, standalone and original credits) and its webhooks. Skrill has its own adapter and research file (`docs/providers/high-risk/research/skrill.md`); Skrill's own merchant APIs are out of scope here. Neteller, PaysafeCard and PaysafeCash appear here only as payment methods inside the Payments API.
- Method: pages on `developer.paysafe.com` were discovered through the site's `llms.txt` index and its sitemap (`/sitemap_index.xml`, linked from `robots.txt`), downloaded as server-rendered HTML and read as text. The Payments API reference page is a Stoplight viewer that loads one OpenAPI 3.0 file; that YAML file was downloaded and parsed, and every code table in section 4 was extracted mechanically from it (or from the HTML page named in the table title) and checked value by value against the extraction, so code values are exact; meanings are paraphrased. SDK repository files were read through `raw.githubusercontent.com` and the public GitHub API without logging in.
- Brand and legacy names: the Payments API base path is `paymenthub`, webhook links point to `alternatepayments/v1/accounts/{accountId}/...`, the legacy card API is `cardpayments/v1/accounts/{accountId}/...`, and older hosts are `api.netbanx.com` / `api.test.netbanx.com` (the site footer says the NETBANX trademark belongs to Paysafe Processing Limited). Real payloads and logs can carry any of these names.

---

## Summary

| Item                                | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                             | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Classification                      | `card_processing`, `acquiring`, `gateway`, `alternative_payment_method`, `wallet` (Paysafe owns and offers Skrill, Neteller and PaysafeCard, which the Payments API accepts as payment types). `payment_facilitator`: Paysafe serves payfacs and platforms (sub-merchant fields, PayFac Sub-merchant API) but does not call itself a payfac in the pages read. `orchestration` and `merchant_account_intermediary` are not claimed                                                                      |
| Documented sectors                  | iGaming, video gaming, crypto, forex and online trading, financial services (fintechs, eWallets, PSPs and payment facilitators, digital banking), eCommerce (ticketing and sports, subscriptions, bill payments, property management), travel and airlines, charities and nonprofits, retail and hospitality, plus SMB categories (auto repair, chiropractors, dental, government and utilities, petroleum, restaurants). A first-party list of rejected sectors also exists (section "Classification") |
| Documentation access                | **Public** (no login) for the guides, the OpenAPI file, the code tables and the webhook pages. The Business Portal and Merchant Back Office (API keys, webhook configuration, reports, chargeback reports, Direct Debit return-code reports) need a merchant login and were not used. Test accounts are issued by Paysafe on request                                                                                                                                                                    |
| API family to implement first       | **Payments API v1** (`https://api.paysafe.com/paymenthub/v1/`) JSON responses: the `error` object (`code`, `message`, `details`, `fieldErrors`, `additionalDetails`), resource `status`, `gatewayResponse`, `settlements[]`; together with **Payments API webhooks** (JSON, `eventName`, `payload`, `attemptNumber`, `resourceId`, `Signature` header)                                                                                                                                                  |
| Documented codes (values per table) | **1,219** across 25 tables (section 4.28), plus 97 client-side SDK error codes listed by group (section 4.26)                                                                                                                                                                                                                                                                                                                                                                                           |
| Biggest limitations                 | No first-party chargeback or dispute API or webhook for the Payments API (chargebacks are handled through the back office). Three different webhook envelope shapes appear in the docs, and several webhook examples are not valid JSON. Parent links (payment to refund, payment to void) are carried in URL paths, not in response bodies. Numeric code spaces overlap between tables (for example `3060` and `4002`, section 10)                                                                     |
| White-label                         | No. Paysafe exposes its own JSON formats. It routes card authorizations to several processors (raw codes for OPN/NAG, MON, TAS/VPS, FRD and VAN are documented; the OpenAPI text names "Worldpay (VAN)" as one acquirer) and routes APMs to Skrill Quick Checkout, PayPal, SafetyPay and others, but the merchant receives Paysafe's own response and webhook format with the downstream data nested in `gatewayResponse`                                                                               |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://developer.paysafe.com/en`. "Sitemap lastmod" is the `<lastmod>` value from the site's page sitemap where one was listed.

| URL                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Sitemap lastmod / version                                        | What it covers                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://developer.paysafe.com/robots.txt, https://developer.paysafe.com/llms.txt, https://developer.paysafe.com/sitemap_index.xml, D/sitemap.xml and its `?sitemap=pages` child                                                                                                                                                                                                                                                                      | n/a                                                              | Page discovery only                                                                                                                                                                                                     |
| D/payments-api/                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-01-08                                                       | Payments API reference shell (Stoplight); loads the OpenAPI file below                                                                                                                                                  |
| https://developer.paysafe.com/fileadmin/openapi-spec/payments-api/apis/paysafe-ph-payments-api.yaml                                                                                                                                                                                                                                                                                                                                                  | OpenAPI 3.0.0, `info.version` 1.0, HTTP Last-Modified 2026-10-19 | **Main source.** Endpoints, schemas, statuses, 190 response examples, the introduction (environments, webhooks notes, pagination) and the **Error Summary** with all core code tables and the processor response tables |
| D/api-docs/payments-api/overview/                                                                                                                                                                                                                                                                                                                                                                                                                    | n/a                                                              | Payments API features, supported payment methods by category                                                                                                                                                            |
| D/api-docs/payments-api/get-started/                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-03-04                                                       | API key format, payment handle concept, single-use and multi-use handle states, `action`, `usage`, `executionMode`, webhook vs GET guidance                                                                             |
| D/api-docs/payments-api/configure-webhooks/                                                                                                                                                                                                                                                                                                                                                                                                          | 2026-01-08                                                       | Webhook transport, `Signature` header, HMAC-SHA256 recipe, example payload                                                                                                                                              |
| D/api-docs/paysafe-checkout/webhoooks/ (spelling as published)                                                                                                                                                                                                                                                                                                                                                                                       | n/a                                                              | Same webhook description for Paysafe Checkout                                                                                                                                                                           |
| D/api-docs/paysafe-checkout/webhook-events/                                                                                                                                                                                                                                                                                                                                                                                                          | 2026-01-08                                                       | **Webhook event list** by category                                                                                                                                                                                      |
| D/api-docs/payments-api/add-payment-methods/cards/about-card-payments/                                                                                                                                                                                                                                                                                                                                                                               | 2026-01-08                                                       | Card flows, card webhook status table and **card webhook examples**                                                                                                                                                     |
| D/api-docs/payments-api/add-payment-methods/cards/card-errors/                                                                                                                                                                                                                                                                                                                                                                                       | 2026-01-08                                                       | **Error object description**, error examples, HTTP status meanings, card-specific code tables, **merchant advice codes** and **ISO response codes**                                                                     |
| D/api-docs/payments-api/add-payment-methods/cards/3ds/                                                                                                                                                                                                                                                                                                                                                                                               | n/a                                                              | 3DS redirect flow, handle states, `threeDResult` / ECI / CAVV table by card brand                                                                                                                                       |
| D/api-docs/payments-api/add-payment-methods/cards/simulating-card-payments/                                                                                                                                                                                                                                                                                                                                                                          | n/a                                                              | Test amounts that trigger specific codes                                                                                                                                                                                |
| D/api-docs/payments-api/settlement-flow-diagrams/                                                                                                                                                                                                                                                                                                                                                                                                    | n/a                                                              | One-step vs two-step settlement; shared payment and settlement ID                                                                                                                                                       |
| D/api-docs/payments-api/test-and-go-live/troubleshooting-api-requests/                                                                                                                                                                                                                                                                                                                                                                               | 2026-01-08                                                       | Common integration errors, content type                                                                                                                                                                                 |
| D/api-docs/payments-api/add-payment-methods/eps/webhooks/                                                                                                                                                                                                                                                                                                                                                                                            | n/a                                                              | **Full webhook envelope examples** (payment handle, payment, refund, standalone credit) with error objects                                                                                                              |
| D/api-docs/payments-api/add-payment-methods/openbucks-us-gift-cards/webhooks/                                                                                                                                                                                                                                                                                                                                                                        | n/a                                                              | Webhook examples, `statusReason` values                                                                                                                                                                                 |
| D/api-docs/payments-api/add-payment-methods/safetypay-express/webhooks-and-get-calls/                                                                                                                                                                                                                                                                                                                                                                | n/a                                                              | Webhook examples with `statusReason` `AUTH_EXPIRED` and `AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE`                                                                                                                            |
| D/api-docs/payments-api/add-payment-methods/safetypay-express/error-codes/                                                                                                                                                                                                                                                                                                                                                                           | n/a                                                              | SafetyPay to Paysafe code mapping                                                                                                                                                                                       |
| D/api-docs/payments-api/add-payment-methods/pay-by-bank-us/webhooks/                                                                                                                                                                                                                                                                                                                                                                                 | n/a                                                              | Pay by Bank webhook events including `SA_CREDIT_RETURN_COMPLETED`                                                                                                                                                       |
| D/api-docs/payments-api/add-payment-methods/rapid-transfer/webhooks/                                                                                                                                                                                                                                                                                                                                                                                 | n/a                                                              | Rapid Transfer webhook events                                                                                                                                                                                           |
| D/api-docs/payments-api/add-payment-methods/about-paypal/webhooks/                                                                                                                                                                                                                                                                                                                                                                                   | n/a                                                              | PayPal webhook events                                                                                                                                                                                                   |
| D/api-docs/payments-api/add-payment-methods/paypal/error-codes-and-transaction-status/                                                                                                                                                                                                                                                                                                                                                               | 2026-01-08                                                       | **PayPal status and error mapping** to Paysafe codes                                                                                                                                                                    |
| D/api-docs/payments-api/add-payment-methods/paypal/api-request-and-responses/                                                                                                                                                                                                                                                                                                                                                                        | n/a                                                              | PayPal handle and payment examples                                                                                                                                                                                      |
| D/api-docs/payments-api/add-payment-methods/skrill/, .../neteller/, .../paysafecard/                                                                                                                                                                                                                                                                                                                                                                 | n/a                                                              | Wallet payment methods inside the Payments API; `gatewayResponse.processor` values                                                                                                                                      |
| D/api-docs/payments-api/add-payment-methods/apple-pay/apple-pay-paysafe-js-error-codes/                                                                                                                                                                                                                                                                                                                                                              | n/a                                                              | Client-side Apple Pay error codes                                                                                                                                                                                       |
| D/api-docs/paysafe-js/tokenize/, D/api-docs/paysafe-js/setup-function/                                                                                                                                                                                                                                                                                                                                                                               | n/a                                                              | Client-side Paysafe JS error codes and the client error object                                                                                                                                                          |
| D/api-docs/paysafe-checkout/setup-and-callbacks/callbacks/                                                                                                                                                                                                                                                                                                                                                                                           | n/a                                                              | Paysafe Checkout callback `error` and `result` objects                                                                                                                                                                  |
| D/api-docs/server-side-sdks-payments-api/, .../java/, .../php/                                                                                                                                                                                                                                                                                                                                                                                       | n/a                                                              | Official SDKs, exception mapping, webhook handler, a third webhook example shape                                                                                                                                        |
| https://api.github.com/repos/paysafegroup/paysafe-payments-api-sdk-java and https://api.github.com/repos/paysafegroup/paysafe-payments-api-sdk-php (metadata and file trees)                                                                                                                                                                                                                                                                         | Java last push 2026-07-27, PHP last push 2026-07-01, both MIT    | Official SDK repositories                                                                                                                                                                                               |
| https://raw.githubusercontent.com/paysafegroup/paysafe-payments-api-sdk-java/main/ `src/main/java/com/paysafe/payments/errorhandling/ExceptionBuilder.java`, `.../webhookhandler/SignatureVerifier.java`, `.../webhookhandler/model/WebhookEvent.java`, `src/test/resources/__files/error/402_request_declined_response.json`, `404_entity_not_found_response.json`, `409_request_conflict_response.json`, `500_internal_server_error_response.json` | 2026 copyright headers                                           | Correlation header name, HTTP-to-exception mapping, signature computation, webhook event fields, error fixtures                                                                                                         |
| https://raw.githubusercontent.com/paysafegroup/paysafe-payments-api-sdk-php/main/README.md                                                                                                                                                                                                                                                                                                                                                           | n/a                                                              | PHP webhook handler and error handling notes                                                                                                                                                                            |
| D/api-docs/cards/overview/, D/api-docs/cards/using-the-api/api-endpoints/, D/api-docs/cards/typical-api-calls/process-a-purchase/, D/api-docs/cards/test-and-go-live/card-errors/                                                                                                                                                                                                                                                                    | n/a                                                              | **Legacy Cards API** (North America only): endpoints, response example, legacy hosts                                                                                                                                    |
| D/support/reference-information/rest-api-architecture/, .../authentication/, .../api-versioning/, .../codes/, .../glossary/, .../other-documentation/                                                                                                                                                                                                                                                                                                | `codes` 2026-01-08                                               | Content type, Basic authentication, key format, versioning policy, ISO reference tables                                                                                                                                 |
| D/support/reference-information/transactions-and-chargebacks/                                                                                                                                                                                                                                                                                                                                                                                        | n/a                                                              | **Chargebacks and RFIs** (back office only), auto-representment, settlement cancellation window                                                                                                                         |
| D/support/reference-information/onboarding-criteria/                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-01-08                                                       | Rejected merchant sectors                                                                                                                                                                                               |
| D/support/reference-information/documentation-changelog/                                                                                                                                                                                                                                                                                                                                                                                             | 2026-10-20                                                       | Activity evidence (entries through October 2026)                                                                                                                                                                        |
| D/api-docs/, D/legal-regulatory/                                                                                                                                                                                                                                                                                                                                                                                                                     | n/a                                                              | API family index; regulatory footer                                                                                                                                                                                     |
| https://www.paysafe.com/en/, https://www.paysafe.com/en/industries-we-serve/, .../igaming/, .../ecommerce/, .../financial-services/, .../travel/, .../charities-and-nonprofits/, https://www.paysafe.com/en/video-gaming/, https://www.paysafe.com/en/crypto/, https://www.paysafe.com/en/forex/, https://www.paysafe.com/en/retail-and-hospitality/                                                                                                 | n/a                                                              | Company activity and sectors in Paysafe's own words                                                                                                                                                                     |
| https://www.paysafe.com/en/paysafegroup/regulatory-disclosures/                                                                                                                                                                                                                                                                                                                                                                                      | n/a                                                              | Legal entities and regulators                                                                                                                                                                                           |
| https://docs.paysafe.com/robots.txt, https://docs.paysafe.com/sitemap.xml                                                                                                                                                                                                                                                                                                                                                                            | n/a                                                              | Discovery of the second Paysafe portal (digital wallets, embedded wallets, PaysafeCard and PaysafeCash APIs); used only to name those families                                                                          |

Also tried: `https://docs.paysafe.com/llms.txt` returns the site's HTML 404 page; `https://developer.paysafe.com/sitemap.xml` returns 404 (the real index is `sitemap_index.xml`).

Not read: the legacy Customer Vault, Direct Debit, Hosted Payments, 3D Secure 2 and Payment Scheduler API references, the Applications API, the docs.paysafe.com API families (Embedded Wallets, PaysafeCard and PaysafeCash REST APIs, Crypto On-Ramp) and the per-method pages not listed above. Facts that would come only from those pages are marked **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | Documentation changelog has entries for every month through October 2026 ("Added a Mobile Integration Guidelines page for Pay by Bank", October 2026); site footer "Copyright 2026 Paysafe Holdings UK Limited"; the OpenAPI file was modified 2026-10-19                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Payment service operational      | yes    | OpenAPI introduction documents a test URL `https://api.test.paysafe.com/paymenthub/v1/` and a production URL `https://api.paysafe.com/paymenthub/v1/`; payment methods were added in 2026 (BLIK, ePay, Pay with Crypto, Openbucks, Paze per the changelog)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | Docs publicly accessible         | yes    | Guides, OpenAPI file, code tables and webhook pages load without login. API keys, webhook configuration ("open a service request in the Business Portal"), transaction reports and Direct Debit return-code reports need the Business Portal or Merchant Back Office login. Test accounts come from the account manager or `integrations@paysafe.com`                                                                                                                                                                                                                                                                                                                              |
| 4   | API families/versions identified | yes    | Payments API v1 (`/paymenthub/v1/`, OpenAPI `info.version` 1.0; versioning page: major version in the path, about 2 years of deprecation for a major change); Payments API webhooks; legacy Cards API v1 (`/cardpayments/v1/`, North America only) and sibling legacy APIs (`customervault`, `directdebit`, `threedsecure`); client SDKs (Paysafe Checkout, Paysafe JS, mobile)                                                                                                                                                                                                                                                                                                    |
| 5   | Offline-examinable formats       | yes    | OpenAPI schemas with 190 response examples; card error JSON examples; full webhook JSON examples for card, EPS, Openbucks and SafetyPay flows; SDK test fixtures for error bodies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | Sectors documented               | yes    | paysafe.com industry pages (see Classification) and the developer onboarding criteria page, which lists sectors Paysafe rejects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Regional/regulatory limits       | yes    | Regulatory disclosures: UK FCA e-money firms (Paysafe Financial Services Limited FRN 900015, Skrill Limited FRN 900001, Prepaid Services Company Limited FRN 900021), Central Bank of Ireland (Paysafe Payment Solutions Limited, also authorised under MiCA; Paysafe Prepaid Services Limited), FINTRAC and Revenu Quebec MSB licences, Skrill USA registered with FinCEN; footer: Paysafe is a registered ISO/MSP of several US banks. Docs: legacy Cards API "available to Platform Partners in North America only"; code `3060` "Applies for Acquiring (UK/EU)" (simulation page); recipient data only for MCC 6012 with a UK trading address; Pay by Bank (US) is a US method |
| 8   | Diagnostic value                 | yes    | 1,219 documented code values in 25 tables, explicit statuses for every resource, merchant advice codes with retry guidance, raw processor codes, webhook events with error objects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | Own technical formats            | yes    | Paysafe-specific JSON (`paymentHandleToken`, `merchantRefNum`, `settleWithAuth`, `availableToSettle`, `gatewayResponse`, `error.fieldErrors`, `eventName`). Downstream processors and APMs (including Skrill Quick Checkout and PayPal) are wrapped in Paysafe's format, not passed through. Not a resale of a gateway PandaPayLens supports                                                                                                                                                                                                                                                                                                                                       |
| 10  | No credentials needed to analyse | yes    | All examples and tables are public. Webhook signatures need the merchant's HMAC key, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`                                      | Payments API card payments, authorizations, settlements, voids, refunds, verifications and card payouts (standalone and original credits)                                                                                                                                                                                                                 |
| `acquiring`                                            | Site footer: "Paysafe is a registered ISO/MSP of Deutsche Bank AG, New York, NY; Citizens Bank, N.A. ..." (several US banks); eCommerce page: "Paysafe Acquiring offers seamless integration, enhanced acceptance rates and minimized chargebacks"; simulation page: code `3060` "Applies for Acquiring (UK/EU)"                                          |
| `gateway`                                              | One API for many methods ("accept payments via multiple payment methods using a single endpoint integration", overview); raw responses from several processors are relayed in `gatewayResponse` ("the read-only raw response returned by an acquirer or PSP", OpenAPI)                                                                                    |
| `alternative_payment_method`                           | Overview lists bank transfers (BLIK, EPS, iDEAL, Interac e-Transfer, Mazooma, Pay by Bank (US), VIP Preferred), cash (PaysafeCash), crypto (Pay with Crypto), direct debit (ACH, BACS, EFT, SEPA), SafetyPay Express (Boleto Bancario, Khipu, MACH, Online Bank Transfer, Pix, SafetyPay Cash), vouchers (MULTIBANCO, Openbucks, PaysafeCard) and wallets |
| `wallet`                                               | Paysafe's own wallets Skrill and Neteller are payment types in the Payments API; paysafe.com lists Skrill, Neteller, PaysafeCard, PaysafeWallet and PaysafeCash as consumer products                                                                                                                                                                      |
| `payment_facilitator` (serves, not claimed for itself) | `paymentFacilitator` / `payFacSubMerchant` request objects; API index lists a "PayFac Sub-merchant API" to "Onboard your PayFac Submerchants"; financial services page names "PSPs and payment facilitators" as customers                                                                                                                                 |
| Not claimed                                            | `orchestration`, `merchant_account_intermediary`                                                                                                                                                                                                                                                                                                          |

Sectors, in Paysafe's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                   | Source and wording                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iGaming                  | https://www.paysafe.com/en/industries-we-serve/igaming/: "It starts here in iGaming"; "As a global leader in iGaming"; "30+ years of experience in high-risk industries"                                                                           |
| Video gaming             | https://www.paysafe.com/en/video-gaming/: "Are you offering gamers their favorite way to pay?"                                                                                                                                                     |
| Crypto                   | https://www.paysafe.com/en/crypto/: "Meet the only crypto payment solution your business will ever need"; "all the gamers, gamblers and traders you could ask for"                                                                                 |
| Forex and online trading | https://www.paysafe.com/en/forex/: "The one-stop-shop payment solution for forex platforms"                                                                                                                                                        |
| Financial services       | https://www.paysafe.com/en/industries-we-serve/financial-services/: fintechs and financial institutions; segments "eWallets", "PSPs and payment facilitators", "Digital banking"; "Need a reliable way to process low-risk or high-risk payments?" |
| eCommerce sub-segments   | https://www.paysafe.com/en/industries-we-serve/ecommerce/: "Ticketing & Sports", "Subscriptions", "Bill Payments", "Property Management"                                                                                                           |
| Travel and airlines      | https://www.paysafe.com/en/industries-we-serve/travel/: "We understand the unique payment requirements for travel and airline businesses"                                                                                                          |
| Charities and nonprofits | https://www.paysafe.com/en/industries-we-serve/charities-and-nonprofits/: "Powerful payment processing for nonprofits"                                                                                                                             |
| Retail and hospitality   | https://www.paysafe.com/en/retail-and-hospitality/ (linked from the industry index as "Retail")                                                                                                                                                    |
| SMB categories           | https://www.paysafe.com/en/industries-we-serve/: cards for "Auto repair", "Chiropractors", "Dental practice", "Government & utilities", "Petroleum", "Restaurants"                                                                                 |

Rejected sectors (D/support/reference-information/onboarding-criteria/): Paysafe "accepts merchants from any sector that does not pose a reputational, credit, legal, or chargeback risk" and lists sectors whose applications "are also rejected", among them alcohol sales by internet or mail order, cigarette and tobacco sales, counterfeit goods, credit restoration, drug paraphernalia, firearms, investment clubs and sale of securities, non-prescription drugs "such as pharmaceutical wonder drugs, steroids, diet pills & all Internet drug stores", pawn shops, pyramid sales, "Sexual Encounter Firms" and timeshares (with named exceptions). Some categories (auction houses, political organizations, timeshares) need approval by the Chief Risk Officer. Adult content other than that entry, nutraceuticals as a named sector and CBD: **NOT DOCUMENTED** in the pages read.

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                                                                                                                         | Endpoint(s) / delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Format                                                                                                                                                          | Relevance                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments API v1**                                                                                                            | `https://api.paysafe.com/paymenthub/v1/` (production), `https://api.test.paysafe.com/paymenthub/v1/` (test). Resources: `/paymenthandles`, `/singleusepaymenthandles/search`, `/verifications`, `/payments`, `/payments/{paymentId}/voidauths`, `/voidauths`, `/payments/{paymentId}/settlements`, `/settlements`, `/settlements/{settlementId}/refunds`, `/refunds`, `/standalonecredits`, `/originalcredits`, `/customers` (+ payment handles, addresses, single-use tokens, mandates), `/sightline/registrations`, `/vippreferred/registrations`, `/paymentmethods`, `/balances`, `/banks`, `/paysafecashstores`, `/monitor` | JSON responses; HTTP Basic authentication; HTTP status codes plus an `error` object                                                                             | **Primary**                                                                                                                                                                                        |
| **Payments API webhooks**                                                                                                      | HTTPS POST to a URL configured through the Business Portal, port 443 only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | JSON body; `Signature` header (HMAC-SHA256, Base64)                                                                                                             | **Primary** for asynchronous methods and status changes                                                                                                                                            |
| Legacy Cards API v1 and siblings                                                                                               | `https://api.paysafe.com/cardpayments/v1/accounts/{account_id}/auths` and similar; `customervault`, `directdebit`, `threedsecure` in the same pattern; older hosts `api.netbanx.com`, `api.test.netbanx.com`                                                                                                                                                                                                                                                                                                                                                                                                                    | JSON; resources carry `links[]` with `rel` `self` / `settlement`                                                                                                | Secondary. Marked "Legacy" and "available to Platform Partners in North America only". Shares many codes with the Payments API (its card errors page was read) but its full reference was not read |
| Paysafe Checkout, Paysafe JS, mobile SDKs                                                                                      | Browser or app SDKs that create payment handles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | JavaScript callbacks with `code`, `displayMessage`, `detailedMessage`, `correlationId` (Paysafe JS) or `message`, `detailedMessage`, `correlationId` (Checkout) | Out of first scope. Client-side codes are summarized in section 4.26                                                                                                                               |
| Payment Scheduler                                                                                                              | Separate API; only its webhook events were read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | JSON webhooks                                                                                                                                                   | Secondary (subscription events)                                                                                                                                                                    |
| Applications API, PayFac Sub-merchant API, Merchant Termination Inquiry, Customer Identity, Bank Account Validation, FX Rates  | Onboarding and value-added services                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | JSON                                                                                                                                                            | Out of scope (not payment diagnostics)                                                                                                                                                             |
| docs.paysafe.com families: Skrill digital wallet APIs, Embedded Wallets, PaysafeCard and PaysafeCash REST APIs, Crypto On-Ramp | Separate portal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Various                                                                                                                                                         | Out of scope. Skrill is covered by the `skrill` adapter; the others were not read                                                                                                                  |

**Recommendation: implement first** the Payments API v1 JSON responses (error object plus resource bodies for payment handles, payments, settlements, refunds, voids, standalone credits and original credits) and the Payments API webhooks. These are what a developer is most likely to paste, they share one error object and one status vocabulary, and the OpenAPI file documents them with examples. Add the processor `gatewayResponse.responseCode` tables and the merchant advice codes in the same step, because they arrive inside the same payloads. Leave the legacy Cards API, client SDK callbacks and Direct Debit return codes (back-office reports only) for later.

### 3. Response and error formats

#### 3.1 Content type, transport and headers

- **Requests and responses**: JSON. Troubleshooting page: calls should use `Content-Type: application/json` or `application/json; charset=UTF-8`. The OpenAPI introduction and the overview also say the API "Receives form-encoded request bodies" while every example and the troubleshooting page use JSON (section 10).
- **Authentication**: HTTP Basic. The key is `username:password` Base64-encoded; documented passwords look like `B-tst1-0-51ed39e4-...` and `B-qa2-0-579b6aec-0-...`. Sensitive.
- **HTTP status**: errors use HTTP status codes (400, 401, 402, 403, 404, 405, 406, 409, 415, 429, 500, 502, 504 appear in the tables). Card errors page: "402 Payment Required: The parameters were valid but the request failed." 402 is used for declines.
- **`X-Application-Status-Code` response header**: carries the same value as `error.code` (OpenAPI `error.code` description and card errors page).
- **`X-INTERNAL-CORRELATION-ID` response header**: read by the official Java SDK (`ExceptionBuilder.HEADER_X_INTERNAL_CORRELATION_ID`) and exposed as `internalCorrelationId` / `correlationId`, "unique ID returned by the Payments API that can be provided to the Paysafe Support team" (Java SDK page). Not described in the OpenAPI file.
- **402 responses carry the resource**: the Java SDK parses a 402 body as the expected resource type (for example a Payment) with an `error` member, while other error statuses are parsed as an error-only body (`ErrorResponse`). The card errors page examples confirm that declines include `id`, `merchantRefNum` and `settleWithAuth` beside `error`.
- **Request headers that can appear in pasted logs**: `Simulator` (`INTERNAL` default or `EXTERNAL`, test only), `X-Platform-Identifier` (optional platform or orchestrator name on Process Payment), `MID` (example of an additional header in the Java SDK page).
- **Pagination**: GET by merchant reference returns the first 10 records by default with HATEOAS links; list responses have a `meta` object (`numberOfRecords`, `limit`, `page`).

#### 3.2 Error object

| Field                       | Type         | Meaning (card errors page and OpenAPI `error` schema)                                                                                                                                                      |
| --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error.code`                | string       | Paysafe error code; also in `X-Application-Status-Code`. Values are numeric strings (`"5068"`), `PAYMENTHUB-1`, `ALTERNATE-PAYMENTS-GATEWAY-<n>`, and (only in an SDK test fixture) `DW-CUSTOMER-CONFLICT` |
| `error.message`             | string       | Short text (examples: `Field error(s)`, `Field Error(s)`, `External Gateway Error`, `Over refund`)                                                                                                         |
| `error.details`             | string array | Longer explanations; for APMs it can carry the downstream text (PayPal descriptions, `GENERIC_ERROR` in an EPS example)                                                                                    |
| `error.fieldErrors[]`       | object array | `field` (JSON path such as `billingDetails.state`) and `error` (text)                                                                                                                                      |
| `error.additionalDetails[]` | object array | `type`, `code`, `message`; documented types `ADVICE` (merchant advice codes, 4.11) and `ISO_RESPONSE` (4.12). The SDK 409 fixture shows `type` `Duplication` with `code` `22`                              |

Errors also appear inside resources and webhook payloads (`payment.error`, `settlement.error`, `refunds.error`, `authentication.error`, `payload.error`).

#### 3.3 Status and outcome fields

| Field                                                                               | Where                              | Values                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                                                                            | payment handle                     | `INITIATED`, `PAYABLE`, `PROCESSING`, `FAILED`, `EXPIRED`, `COMPLETED` (OpenAPI enum); the get-started page adds `CANCELLED` and `ERROR`; webhook pages show `ERROR`                                                                        |
| `status`                                                                            | payment                            | `RECEIVED`, `PROCESSING`, `COMPLETED`, `HELD`, `FAILED`, `CANCELLED`, `PENDING`                                                                                                                                                             |
| `status`                                                                            | settlement, refund                 | `RECEIVED`, `INITIATED`, `PENDING`, `FAILED`, `CANCELLED`, `EXPIRED`, `COMPLETED`; webhook examples also show `ERROR` for refunds                                                                                                           |
| `status`                                                                            | void authorization                 | `RECEIVED`, `COMPLETED`, `HELD`, `FAILED`, `CANCELLED`, `PENDING`                                                                                                                                                                           |
| `status`                                                                            | standalone credit, original credit | `INITIATED`, `RECEIVED`, `PENDING`, `FAILED`, `CANCELLED`, `EXPIRED`, `COMPLETED`; webhook examples also show `ERROR`                                                                                                                       |
| `status`                                                                            | verification                       | `RECEIVED`, `ERROR` (non-business failure, not HTTP 402), `FAILED` (business decline, HTTP 402), `COMPLETED`                                                                                                                                |
| `status` / `statusReason`                                                           | mandate                            | `PENDING`, `ACTIVE`, `CANCELLED`, `INACTIVE` / `MERCHANT_CANCELLED`, `BANK_CANCELLED`, `DECLINED`, `REJECTED`, `DISPUTED`, `UNAUTHORIZED`, `TRANSFERRED`                                                                                    |
| `statusReason`                                                                      | payment and webhook payloads       | "present in the case where status is ERROR, FAILURE, or HELD" (OpenAPI). Values seen in examples: `PSP_REJECTED`, `AUTH_EXPIRED`, `AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE` (Paysafe will call `/payments` itself). Full list **NOT DOCUMENTED** |
| `action`                                                                            | payment handle                     | `NONE` (pay now) or `REDIRECT` (send the customer to `links[]` `rel` `redirect_payment`)                                                                                                                                                    |
| `gatewayResponse.avsResponse`                                                       | card                               | `MATCH`, `MATCH_ADDRESS_ONLY`, `MATCH_ZIP_ONLY`, `NO_MATCH`, `NOT_PROCESSED`, `UNKNOWN`                                                                                                                                                     |
| `gatewayResponse.cvvVerification`                                                   | card                               | `MATCH`, `NO_MATCH`, `NOT_PROCESSED`, `UNKNOWN`                                                                                                                                                                                             |
| `gatewayResponse.nameVerification`, `firstNameVerification`, `lastNameVerification` | card                               | `MATCH`, `PARTIAL_MATCH`, `NO_MATCH`, `NOT_PROCESSED`, `UNKNOWN`                                                                                                                                                                            |
| `authentication.threeDResult`                                                       | card 3DS                           | OpenAPI enum `Y`, `A`, `N`, `U`, `E`; the 3DS page also uses `R`; a webhook example shows `C`                                                                                                                                               |
| `authentication.signatureStatus`, `threeDEnrollment`                                | card 3DS                           | `Y`, `N` / `Y`, `N`, `U`                                                                                                                                                                                                                    |
| `riskReasonCode`                                                                    | payment, settlement, refund        | "An array of integers ... detailed Risk reason codes if your transaction was declined", only when the account is configured. Values **NOT DOCUMENTED**                                                                                      |
| `gatewayResponse.status`                                                            | APMs                               | Raw downstream status, for example `"2"`, `"-2"`, `"1"` with `processor` `SKRILL_QCO`, or `"100"`, `"101"`, `"102"` with `processor` `SAFETYPAY`. Meanings **NOT DOCUMENTED** on the Paysafe pages read                                     |

`liveMode` (`true` production, `false` non-production) and `simulator` (`INTERNAL` / `EXTERNAL`) tell test from live payloads.

#### 3.4 Examples

Example A: card decline with a merchant advice code. **Transcribed from https://developer.paysafe.com/en/api-docs/payments-api/add-payment-methods/cards/card-errors/** ("Transaction Errors"):

```json
{
  "error": {
    "code": "3009",
    "message": "Your request has been declined by the issuing bank.",
    "additionalDetails": [
      {
        "type": "ADVICE",
        "code": "ADVICE-03",
        "message": "Revalidate payment information. Please do not retry more than 10 times over 30 days."
      }
    ]
  },
  "id": "b0d1d3c0-f3b3-4743-9bff-16aec8e56022",
  "merchantRefNum": "bcc8fbad-9b9a-4df9-a54c-b98ddcefa282",
  "settleWithAuth": true
}
```

Example B: field validation error on payment handle creation. **Transcribed from the same page** ("Payment Handle Errors"):

```json
{
  "error": {
    "code": "5068",
    "message": "Field error(s)",
    "details": [
      "Either you submitted a request that is missing a mandatory field or the value of a field does not match the format expected."
    ],
    "fieldErrors": [
      {
        "field": "billingAddress.street",
        "error": "size must be between 0 and 50"
      }
    ]
  }
}
```

Example C: APM decline with the raw downstream text. **Transcribed from https://raw.githubusercontent.com/paysafegroup/paysafe-payments-api-sdk-java/main/src/test/resources/__files/error/402_request_declined_response.json** (official SDK test fixture):

```json
{
  "merchantRefNum": "12345",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "gatewayResponse": {
    "responseCodeDescription": "Refer to Issuer"
  },
  "error": {
    "code": "ALTERNATE-PAYMENTS-GATEWAY-4",
    "message": "Transaction declined",
    "details": [
      "The transaction was declined by the processing gateway.",
      "Merchant configuration is incorrect. Verify setup in Netbanx."
    ]
  }
}
```

Example D: successful card payment with automatic settlement. **Transcribed from the OpenAPI file** (`POST /v1/payments`, response example "Card - with Settlement"); excerpt, with `billingDetails`, `merchantDescriptor` and `card.holderName` left out:

```json
{
  "id": "398e086d-f47b-4b3f-8a18-621e7ed35378",
  "paymentType": "CARD",
  "paymentHandleToken": "SC2INoYvSe2MzQuB",
  "merchantRefNum": "fc5b62df1202e491475d",
  "currencyCode": "USD",
  "settleWithAuth": true,
  "txnTime": "2023-01-27T10:15:29Z",
  "status": "COMPLETED",
  "amount": 500,
  "preAuth": false,
  "availableToSettle": 0,
  "gatewayResponse": {
    "code": "VPS",
    "responseCode": "00",
    "responseCodeDescription": "Approved and completed",
    "avsCode": "X",
    "authCode": "130416",
    "avsResponse": "MATCH",
    "cvvVerification": "MATCH",
    "serializable": true
  },
  "settlements": [
    {
      "merchantRefNum": "fc5b62df1202e491475d",
      "amount": 500,
      "id": "398e086d-f47b-4b3f-8a18-621e7ed35378",
      "availableToRefund": 500,
      "txnTime": 1674814529000,
      "status": "PENDING"
    }
  ],
  "card": {
    "cardExpiry": { "month": "10", "year": "2025" },
    "cardType": "VI",
    "cardBin": "400000",
    "lastDigits": "1026",
    "cardCategory": "CREDIT",
    "issuingCountry": "US"
  },
  "cardSchemeTransactionId": "SIM1UZ3YM7IS1",
  "paymentAccountReference": "500191I1FZYVC34ZZTQK697M7TWBA"
}
```

Note the settlement `id` equals the payment `id`, and `settlements[].txnTime` is an epoch number in milliseconds while the payment `txnTime` is an ISO string.

Example E: card payment failure webhook. **Transcribed from https://developer.paysafe.com/en/api-docs/payments-api/add-payment-methods/cards/about-card-payments/** ("Payment status: FAILED"):

```json
{
  "attemptNumber": "1",
  "payload": {
    "id": "2502ae05-59ad-492c-aa9b-2e72404ba7af",
    "status": "FAILED",
    "error": {
      "code": "3028",
      "message": "The external processing gateway has reported a system error."
    },
    "txnTime": "2025-04-10T17:32:22Z",
    "merchantRefNum": "1292dbbe-7c55-439c-b1b3-520998757067",
    "amount": "6",
    "currencyCode": "USD",
    "cardBin": "400000",
    "lastDigits": "2719",
    "cardType": "VI"
  },
  "resourceId": "2502ae05-59ad-492c-aa9b-2e72404ba7af",
  "type": "PAYMENT",
  "eventDate": "2025-04-10T17:32:22Z",
  "links": [
    {
      "rel": "payment"
    }
  ],
  "eventName": "PAYMENT_FAILED"
}
```

Example F: refund failure webhook. **Transcribed from https://developer.paysafe.com/en/api-docs/payments-api/add-payment-methods/eps/webhooks/** ("Refund status: FAILED"):

```json
{
  "payload": {
    "accountId": "1002786770",
    "id": "6f2a3317-af01-4aac-a0c9-0fc9999376ec",
    "merchantRefNum": "a23daa0a-adbf-4bd5-9da6-5a32ca9dbe1a",
    "amount": 1122,
    "currencyCode": "EUR",
    "source": "SingleAPI",
    "status": "FAILED",
    "paymentType": "EPS",
    "txnTime": "2025-03-24T13:05:05Z",
    "error": {
      "code": "ALTERNATE-PAYMENTS-GATEWAY-6",
      "message": "Over refund",
      "details": ["The total refund amount cannot exceed the original payment amount."]
    }
  },
  "eventType": "REFUND_FAILED",
  "attemptNumber": "1",
  "resourceId": "6f2a3317-af01-4aac-a0c9-0fc9999376ec",
  "eventDate": "2025-03-24T13:05:05Z",
  "links": [
    {
      "href": "https://api.test.paysafe.com/alternatepayments/v1/accounts/1002786770/refunds/6f2a3317-af01-4aac-a0c9-0fc9999376ec",
      "rel": "refund"
    }
  ],
  "mode": "live",
  "eventName": "REFUND_FAILED"
}
```

### 4. Codes

Sources of the tables: the OpenAPI "Error Summary" for 4.1 to 4.11, 4.13, 4.14 and 4.17 to 4.25 (rows marked "card page only" come from the card errors page, which also repeats most OpenAPI card rows); the card errors page for 4.12; the SafetyPay and PayPal pages for 4.15 and 4.16. In 4.1 and 4.2 the meaning column notes where the two pages differ.

Where codes appear in a payload:

1. **`error.code`** with the HTTP status (tables 4.1 to 4.10, 4.15 targets, 4.16 targets). The same numeric code can appear in several tables (for example `4002` in 4.2 and 4.9, `5068` everywhere); the meaning is the same unless section 10 says otherwise.
2. **`error.additionalDetails[]`**: `type` `ADVICE` with `ADVICE-nn` codes (4.11) and `type` `ISO_RESPONSE` with two-digit network codes (4.12). The card errors page says Paysafe adds these "where possible".
3. **`gatewayResponse.responseCode` and `responseCodeDescription`**: raw acquirer or processor responses. The OpenAPI file documents five processor tables (4.17 to 4.21) by processor name but does not say which field carries them; the link is an inference from the OpenAPI example where `gatewayResponse.code` is `VPS` and `responseCode` `00` reads "Approved and completed", which matches row `00` of the TAS/VPS table. `gatewayResponse.code` is described as the "acquirer identification code, such as VPS, GPS"; a webhook example also has `settlements[].processorCode` `TAS`. The mapping from `gatewayResponse.code` values to table names is otherwise **NOT DOCUMENTED** (`GPS` has no table).
4. **Interchecks, SafetyPay and PayPal codes** (4.13 to 4.16) are downstream codes that Paysafe maps to its own `error.code`. Where the downstream code itself appears in the Paysafe payload is **NOT DOCUMENTED**; for PayPal the Paysafe `error.details` repeats PayPal's description text, so the PayPal name can be recovered only by matching that text.
5. **Direct Debit return codes** (4.22 to 4.25) are bank-scheme returns that "you cannot be notified of ... via the API response"; they are visible in Merchant Back Office reports. Whether they appear in any webhook is **NOT DOCUMENTED**.

Categories and retry classes in every table are **suggestions** made for PandaPayLens, not Paysafe statements, except where the meaning column quotes Paysafe's own retry advice (for example `1100`, `ADVICE-01` to `ADVICE-14`, VSPS rows).

#### 4.1 Common errors: 39 codes

| Code   | HTTP | Meaning (paraphrased)                                                        | Category (suggested) | Retry (suggested)               |
| ------ | ---- | ---------------------------------------------------------------------------- | -------------------- | ------------------------------- |
| `1000` | 500  | Internal Paysafe error                                                       | provider_unavailable | retry_conditionally             |
| `1001` | 502  | The external processing gateway returned an error                            | provider_unavailable | retry_conditionally             |
| `1002` | 500  | Internal error (card page: database error)                                   | provider_unavailable | retry_conditionally             |
| `1003` | 500  | Internal error                                                               | provider_unavailable | retry_conditionally             |
| `1007` | 500  | Internal error (card page: gateway error; simulator: clearing house timeout) | network_or_timeout   | retry_conditionally             |
| `1008` | 500  | Internal error                                                               | provider_unavailable | retry_conditionally             |
| `1100` | 502  | Service overloaded; Paysafe says to retry later                              | provider_unavailable | safe_to_retry_technical_request |
| `1200` | 429  | Call rate limit exceeded                                                     | rate_limiting        | safe_to_retry_technical_request |
| `5000` | 401  | Merchant authentication failed: bad key or IP address not allowed            | configuration        | do_not_retry                    |
| `5001` | 400  | Currency code invalid or not enabled on the account                          | invalid_request      | do_not_retry                    |
| `5003` | 400  | Invalid amount                                                               | invalid_amount       | do_not_retry                    |
| `5004` | 400  | Invalid account type                                                         | invalid_request      | do_not_retry                    |
| `5005` | 400  | Invalid operation type                                                       | invalid_request      | do_not_retry                    |
| `5010` | 400  | Invalid country code                                                         | invalid_request      | do_not_retry                    |
| `5016` | 400  | Merchant account not found                                                   | configuration        | do_not_retry                    |
| `5017` | 400  | Merchant account disabled                                                    | configuration        | do_not_retry                    |
| `5021` | 402  | Transaction declined (generic)                                               | card_declined        | customer_action_required        |
| `5023` | 400  | Request body cannot be parsed                                                | invalid_request      | do_not_retry                    |
| `5031` | 409  | Transaction already processed (card page: duplicate merchant reference)      | duplicate_request    | do_not_retry                    |
| `5040` | 401  | Account not configured for the attempted transaction                         | configuration        | do_not_retry                    |
| `5042` | 400  | Merchant reference number missing, invalid or too long                       | invalid_request      | do_not_retry                    |
| `5068` | 400  | Mandatory field missing or field format wrong (see `fieldErrors`)            | invalid_request      | do_not_retry                    |
| `5077` | 400  | `dynamicMerchantUrl` not allowed for the account                             | configuration        | do_not_retry                    |
| `5269` | 404  | ID in the URL does not match any record                                      | invalid_request      | do_not_retry                    |
| `5270` | 403  | Credentials do not allow access to the requested data                        | configuration        | do_not_retry                    |
| `5271` | 406  | `Accept` header asks for an unsupported format                               | invalid_request      | do_not_retry                    |
| `5272` | 406  | Unsupported `Content-Type` (card page lists HTTP 415)                        | invalid_request      | do_not_retry                    |
| `5273` | 404  | Invalid URL                                                                  | invalid_request      | do_not_retry                    |
| `5275` | 401  | Credentials expired                                                          | configuration        | do_not_retry                    |
| `5276` | 401  | Credentials disabled                                                         | configuration        | do_not_retry                    |
| `5277` | 401  | Credentials locked after repeated authentication failures                    | configuration        | manual_review                   |
| `5278` | 401  | Credentials rejected for an unknown reason                                   | configuration        | manual_review                   |
| `5279` | 401  | Invalid credentials                                                          | configuration        | do_not_retry                    |
| `5280` | 401  | Credentials missing                                                          | configuration        | do_not_retry                    |
| `5281` | 405  | HTTP method not supported by the resource                                    | invalid_request      | do_not_retry                    |
| `5283` | 400  | Operation needs a payment handle in status `PAYABLE`                         | invalid_request      | do_not_retry                    |
| `5500` | 400  | Payment token invalid, or profile or card not active (card page only)        | invalid_request      | do_not_retry                    |
| `5501` | 400  | Profile has no active card                                                   | invalid_request      | do_not_retry                    |
| `5502` | 400  | Payment token invalid, or profile or bank account not active                 | invalid_request      | do_not_retry                    |

#### 4.2 Payment and authorization errors: 75 codes

| Code           | HTTP | Meaning (paraphrased)                                                                                            | Category (suggested)       | Retry (suggested)        |
| -------------- | ---- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `PAYMENTHUB-1` | 400  | Payment type and currency combination not supported for the account                                              | configuration              | do_not_retry             |
| `1020`         | 504  | Gateway timeout (card page only)                                                                                 | network_or_timeout         | retry_conditionally      |
| `3002`         | 400  | Invalid card number or brand, or the two do not match                                                            | invalid_request            | customer_action_required |
| `3004`         | 400  | Zip or postal code required for the AVS check                                                                    | invalid_request            | customer_action_required |
| `3005`         | 400  | Incorrect CVV submitted                                                                                          | invalid_request            | customer_action_required |
| `3006`         | 400  | Card expired                                                                                                     | card_declined              | customer_action_required |
| `3007`         | 402  | AVS check failed; the amount stays reserved for 3 to 5 business days (sub-values in 4.3)                         | fraud_or_risk              | customer_action_required |
| `3008`         | 400  | Card type not configured on the merchant account                                                                 | payment_method_unavailable | customer_action_required |
| `3009`         | 402  | Declined by the issuer                                                                                           | card_declined              | customer_action_required |
| `3010`         | 402  | Insufficient funds (appears only as a mapping target in the Interchecks issuer table)                            | insufficient_funds         | customer_action_required |
| `3011`         | 402  | Restricted card                                                                                                  | card_declined              | customer_action_required |
| `3012`         | 402  | Issuer says the expiry date is invalid                                                                           | card_declined              | customer_action_required |
| `3013`         | 402  | Problem with the card account                                                                                    | card_declined              | customer_action_required |
| `3014`         | 402  | Issuer returned an unknown response                                                                              | card_declined              | manual_review            |
| `3015`         | 402  | Issuer asks for a voice authorization (call the issuer)                                                          | card_declined              | customer_action_required |
| `3016`         | 402  | Pick up card, possibly lost or stolen                                                                            | fraud_or_risk              | do_not_retry             |
| `3017`         | 402  | Invalid card number                                                                                              | invalid_request            | customer_action_required |
| `3018`         | 402  | Bank asks to retry                                                                                               | card_declined              | retry_conditionally      |
| `3019`         | 402  | CVV check failed; the amount may stay reserved for 3 to 5 business days                                          | card_declined              | customer_action_required |
| `3020`         | 402  | Bank asks to retry                                                                                               | card_declined              | retry_conditionally      |
| `3021`         | 404  | Confirmation number not found                                                                                    | invalid_request            | do_not_retry             |
| `3022`         | 402  | Insufficient funds                                                                                               | insufficient_funds         | customer_action_required |
| `3023`         | 402  | Declined under the issuer's own card activity rules                                                              | card_declined              | customer_action_required |
| `3024`         | 402  | Issuer does not allow this transaction on the card                                                               | card_declined              | customer_action_required |
| `3025`         | 400  | Gateway reports invalid data                                                                                     | invalid_request            | do_not_retry             |
| `3026`         | 400  | Gateway reports an invalid account type                                                                          | invalid_request            | do_not_retry             |
| `3027`         | 402  | Gateway reports a limit exceeded                                                                                 | card_declined              | retry_conditionally      |
| `3028`         | 502  | Gateway system error                                                                                             | provider_unavailable       | retry_conditionally      |
| `3029`         | 402  | Gateway rejected the transaction                                                                                 | card_declined              | manual_review            |
| `3030`         | 402  | Gateway reports the transaction as unauthorized                                                                  | card_declined              | manual_review            |
| `3031`         | 400  | Confirmation number refers to a transaction that is not on hold                                                  | invalid_request            | do_not_retry             |
| `3032`         | 402  | Card found in an issuer or gateway negative database                                                             | fraud_or_risk              | do_not_retry             |
| `3035`         | 402  | PIN attempts exceeded                                                                                            | card_declined              | customer_action_required |
| `3036`         | 402  | Invalid issuer                                                                                                   | invalid_request            | customer_action_required |
| `3037`         | 402  | Invalid transaction                                                                                              | card_declined              | do_not_retry             |
| `3038`         | 402  | Customer cancellation                                                                                            | card_declined              | customer_action_required |
| `3039`         | 402  | Invalid authentication value                                                                                     | authentication_failed      | customer_action_required |
| `3040`         | 402  | Request type not permitted on the card                                                                           | card_declined              | customer_action_required |
| `3041`         | 402  | Declined because of a timeout                                                                                    | network_or_timeout         | retry_conditionally      |
| `3042`         | 402  | Cryptographic error                                                                                              | provider_unavailable       | retry_conditionally      |
| `3044`         | 402  | Duplicate request                                                                                                | duplicate_request          | do_not_retry             |
| `3045`         | 402  | Invalid date format                                                                                              | invalid_request            | do_not_retry             |
| `3046`         | 402  | Amount is zero                                                                                                   | invalid_amount             | do_not_retry             |
| `3047`         | 402  | Amount above the floor limit                                                                                     | invalid_amount             | do_not_retry             |
| `3048`         | 402  | Amount below the floor limit                                                                                     | invalid_amount             | do_not_retry             |
| `3049`         | 402  | Pick up card: card expired                                                                                       | card_declined              | do_not_retry             |
| `3050`         | 402  | Pick up card: fraud suspected                                                                                    | fraud_or_risk              | do_not_retry             |
| `3051`         | 402  | Pick up card: contact the acquirer                                                                               | card_declined              | manual_review            |
| `3052`         | 402  | Pick up card: restricted card                                                                                    | card_declined              | do_not_retry             |
| `3053`         | 402  | Pick up card: call the acquirer                                                                                  | card_declined              | manual_review            |
| `3054`         | 402  | Suspected fraud                                                                                                  | fraud_or_risk              | do_not_retry             |
| `3055`         | 402  | Transaction type not supported                                                                                   | configuration              | do_not_retry             |
| `3056`         | 402  | Original transaction type does not match                                                                         | invalid_request            | do_not_retry             |
| `3057`         | 402  | Cardholder must call the issuer; do not retry                                                                    | card_declined              | do_not_retry             |
| `3060`         | 402  | Strong Customer Authentication required (card page); the Interchecks table uses 3060 for an unsolicited reversal | authentication_required    | customer_action_required |
| `3061`         | 400  | Invalid initial transaction reference (card page only)                                                           | invalid_request            | do_not_retry             |
| `3073`         | 400  | Customer account closed (card page only)                                                                         | card_declined              | customer_action_required |
| `3091`         | 402  | PIN cannot be verified                                                                                           | authentication_failed      | customer_action_required |
| `3092`         | 402  | No financial impact: the original was already declined                                                           | card_declined              | do_not_retry             |
| `3103`         | 400  | Stored-credential installments not allowed for this merchant category code                                       | configuration              | do_not_retry             |
| `3104`         | 400  | Stored-credential installments not allowed for the configured processor                                          | configuration              | do_not_retry             |
| `3105`         | 400  | Stored-credential installments not allowed for this card brand                                                   | configuration              | do_not_retry             |
| `3703`         | 400  | External gateway reports an invalid amount (card page only; Interchecks: invalid format)                         | invalid_amount             | do_not_retry             |
| `4001`         | 402  | Card number or email is in Paysafe's negative database (card page only)                                          | fraud_or_risk              | do_not_retry             |
| `4002`         | 402  | Declined by Paysafe risk management (card page and Direct Debit table)                                           | fraud_or_risk              | manual_review            |
| `5034`         | 400  | Invalid email address (card page only)                                                                           | invalid_request            | customer_action_required |
| `5037`         | 400  | Invalid zip or postal code (card page only)                                                                      | invalid_request            | customer_action_required |
| `5050`         | 500  | Merchant account configuration error (card page only)                                                            | configuration              | manual_review            |
| `5284`         | 409  | An entity with this identifier already exists                                                                    | duplicate_request          | do_not_retry             |
| `5286`         | 400  | Card with this identifier does not exist                                                                         | invalid_request            | do_not_retry             |
| `5288`         | 404  | Card does not belong to this consumer                                                                            | invalid_request            | do_not_retry             |
| `5303`         | 400  | Payment instrument already exists                                                                                | duplicate_request          | do_not_retry             |
| `5304`         | 400  | Expired card                                                                                                     | card_declined              | customer_action_required |
| `5309`         | 403  | Maximum amount for the operation exceeded                                                                        | invalid_amount             | do_not_retry             |
| `9000`         | 500  | No child accounts available for load balancing (card page only)                                                  | configuration              | manual_review            |

#### 4.3 AVS sub-values reported with error `3007`: 20 values

Category for all: `fraud_or_risk` (suggested); retry: `customer_action_required` (suggested). The table lists them under HTTP 402 (403 for `Z`).

| AVS code | Meaning (paraphrased)                                                       |
| -------- | --------------------------------------------------------------------------- |
| `A`      | Street address matches, ZIP does not (same text as Y)                       |
| `B`      | Street matches; postal code in the wrong format (international)             |
| `C`      | Street address and postal code in the wrong formats                         |
| `D`      | Street address and postal code match (international issuer; same text as I) |
| `E`      | AVS error                                                                   |
| `F`      | Address and five-digit ZIP compare (UK only)                                |
| `G`      | Service not supported by a non-US issuer                                    |
| `H`      | Address not verified by an international issuer                             |
| `I`      | Street address and postal code match (international issuer)                 |
| `M`      | Neither street nor ZIP match                                                |
| `N`      | No response sent                                                            |
| `O`      | Postal code matches; street not verified because of incompatible formats    |
| `P`      | Retry: system unavailable or timed out                                      |
| `R`      | Service not supported by the issuer                                         |
| `S`      | Address information unavailable                                             |
| `U`      | Nine-digit ZIP matches, street does not                                     |
| `W`      | Exact AVS match                                                             |
| `X`      | Street and five-digit ZIP match                                             |
| `Y`      | Street address matches, ZIP does not                                        |
| `Z`      | Five-digit ZIP matches, street does not (listed with HTTP 403)              |

#### 4.4 Void authorization errors: 8 codes

| Code   | HTTP | Meaning (paraphrased)                                          | Category (suggested) | Retry (suggested)   |
| ------ | ---- | -------------------------------------------------------------- | -------------------- | ------------------- |
| `3500` | 400  | Confirmation number not found                                  | invalid_request      | do_not_retry        |
| `3501` | 402  | Void amount exceeds the remaining authorized amount            | invalid_amount       | do_not_retry        |
| `3502` | 402  | Authorization already settled; cannot void                     | invalid_request      | do_not_retry        |
| `3503` | 402  | Void not supported for the card type                           | configuration        | do_not_retry        |
| `3504` | 402  | Gateway does not support partial voids                         | configuration        | do_not_retry        |
| `3505` | 500  | Void could not be completed                                    | provider_unavailable | retry_conditionally |
| `3506` | 402  | Void amount exceeds the remaining authorized amount            | invalid_amount       | do_not_retry        |
| `3507` | 402  | Authorization does not support a partial void (card page only) | configuration        | do_not_retry        |

#### 4.5 Settlement errors: 8 codes

| Code   | HTTP | Meaning (paraphrased)                                     | Category (suggested) | Retry (suggested) |
| ------ | ---- | --------------------------------------------------------- | -------------------- | ----------------- |
| `3200` | 400  | Authorization ID badly formatted                          | invalid_request      | do_not_retry      |
| `3201` | 404  | Authorization ID not found                                | invalid_request      | do_not_retry      |
| `3202` | 402  | Maximum number of settlements reached                     | invalid_request      | do_not_retry      |
| `3203` | 402  | Authorization fully settled or cancelled                  | invalid_request      | do_not_retry      |
| `3204` | 402  | Settlement amount exceeds the remaining authorized amount | invalid_amount       | do_not_retry      |
| `3205` | 402  | Authorization expired                                     | invalid_request      | do_not_retry      |
| `3206` | 402  | Gateway rejected the settlement                           | card_declined        | manual_review     |
| `3207` | 402  | Issuer policy does not allow this transaction type        | card_declined        | do_not_retry      |

#### 4.6 Refund errors: 21 codes

| Code   | HTTP | Meaning (paraphrased)                                       | Category (suggested) | Retry (suggested)   |
| ------ | ---- | ----------------------------------------------------------- | -------------------- | ------------------- |
| `3402` | 402  | Refund amount exceeds the remaining settled amount          | invalid_amount       | do_not_retry        |
| `3403` | 402  | Maximum number of refunds for the settlement reached        | invalid_request      | do_not_retry        |
| `3404` | 402  | Settlement already fully refunded                           | invalid_request      | do_not_retry        |
| `3405` | 402  | Settlement too old to refund                                | invalid_request      | do_not_retry        |
| `3406` | 402  | Settlement not batched yet, so no settled funds to refund   | invalid_request      | retry_conditionally |
| `3407` | 400  | Settlement for the given ID not found                       | invalid_request      | do_not_retry        |
| `3408` | 400  | Purchase or settlement ID badly formatted                   | invalid_request      | do_not_retry        |
| `3412` | 402  | Refund refused: merchant account in overdraft               | configuration        | manual_review       |
| `3413` | 402  | Refund exceeds the permitted Visa credit ratio              | configuration        | manual_review       |
| `3414` | 400  | Refund for the given ID not found                           | invalid_request      | do_not_retry        |
| `3415` | 402  | Cannot cancel: no longer pending                            | invalid_request      | do_not_retry        |
| `3416` | 402  | Gateway does not support partial settlements                | configuration        | do_not_retry        |
| `3417` | 402  | Another request on the same transaction is in progress      | duplicate_request    | retry_conditionally |
| `3418` | 402  | Gateway does not support partial credits                    | configuration        | do_not_retry        |
| `3419` | 402  | Transaction type cannot be refunded                         | invalid_request      | do_not_retry        |
| `3420` | 500  | Error while processing the purchase return authorization    | provider_unavailable | retry_conditionally |
| `3421` | 402  | Purchase return authorization declined by the issuer        | card_declined        | manual_review       |
| `3422` | 402  | Purchase return authorization failed                        | card_declined        | manual_review       |
| `3423` | 500  | Error while reversing the purchase return authorization     | provider_unavailable | manual_review       |
| `3424` | 500  | Purchase return authorization failed; Paysafe says to retry | provider_unavailable | retry_conditionally |
| `3425` | 402  | Refund blocked because a chargeback exists (OpenAPI only)   | invalid_request      | do_not_retry        |

#### 4.7 Customer Vault errors: 18 codes

| Code   | HTTP | Meaning (paraphrased)                                     | Category (suggested) | Retry (suggested)        |
| ------ | ---- | --------------------------------------------------------- | -------------------- | ------------------------ |
| `7503` | 409  | Card already stored on this profile                       | duplicate_request    | do_not_retry             |
| `7504` | 409  | Card already used on the maximum number of profiles       | invalid_request      | customer_action_required |
| `7505` | 409  | `merchantCustomerId` already used for another profile     | duplicate_request    | do_not_retry             |
| `7506` | 409  | Bank account already in use on the profile                | duplicate_request    | do_not_retry             |
| `7507` | 409  | Mandate reference already in use                          | duplicate_request    | do_not_retry             |
| `7508` | 400  | Invalid card number or brand, or the two do not match     | invalid_request      | customer_action_required |
| `7509` | 409  | Bank account has mandates, so its details cannot change   | invalid_request      | do_not_retry             |
| `7510` | 400  | Bank account details invalid for the banking scheme       | invalid_request      | customer_action_required |
| `7511` | 404  | Address ID not found                                      | invalid_request      | do_not_retry             |
| `7512` | 400  | Merchant Apple Pay configuration not found                | configuration        | do_not_retry             |
| `7513` | 400  | Apple Pay token invalid                                   | invalid_request      | customer_action_required |
| `7514` | 404  | Payment token expired                                     | invalid_request      | customer_action_required |
| `7515` | 409  | Profile already holds the maximum number of cards         | invalid_request      | do_not_retry             |
| `7516` | 400  | At least one search parameter required                    | invalid_request      | do_not_retry             |
| `7517` | 400  | Dates must use the format YYYY-MM-DDTHH24:MI:SSZ          | invalid_request      | do_not_retry             |
| `7518` | 400  | Date range too long                                       | invalid_request      | do_not_retry             |
| `7519` | 400  | Pagination limit too high                                 | invalid_request      | do_not_retry             |
| `7520` | 409  | Profile already holds the maximum number of bank accounts | invalid_request      | do_not_retry             |

#### 4.8 Alternate payments errors: 20 codes

| Code                            | HTTP | Meaning (paraphrased)                                                  | Category (suggested)       | Retry (suggested)        |
| ------------------------------- | ---- | ---------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `ALTERNATE-PAYMENTS-GATEWAY-1`  | 402  | Cancelled at the gateway                                               | card_declined              | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-4`  | 402  | Declined by the gateway (also the target for many PayPal errors, 4.16) | card_declined              | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-5`  | 402  | Operation needs a completed transaction                                | invalid_request            | do_not_retry             |
| `ALTERNATE-PAYMENTS-GATEWAY-6`  | 402  | Over refund: total refunds above the payment                           | invalid_amount             | do_not_retry             |
| `ALTERNATE-PAYMENTS-GATEWAY-7`  | 402  | Payment expired                                                        | invalid_request            | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-8`  | 402  | Over settlement: total settled above the authorized amount             | invalid_amount             | do_not_retry             |
| `ALTERNATE-PAYMENTS-GATEWAY-9`  | 402  | Gateway reported a risk issue                                          | fraud_or_risk              | manual_review            |
| `ALTERNATE-PAYMENTS-GATEWAY-10` | 502  | Payment type temporarily unavailable (maintenance)                     | payment_method_unavailable | retry_conditionally      |
| `ALTERNATE-PAYMENTS-GATEWAY-11` | 402  | Void exceeds the amount still to settle                                | invalid_amount             | do_not_retry             |
| `ALTERNATE-PAYMENTS-GATEWAY-12` | 402  | Payment already partly or fully settled                                | invalid_request            | do_not_retry             |
| `ALTERNATE-PAYMENTS-GATEWAY-13` | 402  | Transaction not refundable yet                                         | invalid_request            | retry_conditionally      |
| `ALTERNATE-PAYMENTS-GATEWAY-14` | 402  | Partial settlement not possible for the payment method                 | configuration              | do_not_retry             |
| `ALTERNATE-PAYMENTS-GATEWAY-16` | 402  | Amount above the maximum for the payment type                          | invalid_amount             | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-17` | 504  | Request timed out                                                      | network_or_timeout         | retry_conditionally      |
| `ALTERNATE-PAYMENTS-GATEWAY-19` | 402  | Insufficient funds on the payment instrument                           | insufficient_funds         | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-20` | 402  | Third-party account not activated                                      | payment_method_unavailable | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-21` | 402  | Amount below the minimum for the payment type                          | invalid_amount             | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-22` | 402  | Identity details differ from those already on file                     | fraud_or_risk              | manual_review            |
| `ALTERNATE-PAYMENTS-GATEWAY-23` | 402  | KYC documents could not be verified                                    | fraud_or_risk              | customer_action_required |
| `ALTERNATE-PAYMENTS-GATEWAY-24` | 402  | A third-party account with these details already exists                | duplicate_request          | do_not_retry             |

#### 4.9 Direct Debit errors: 9 codes

| Code   | HTTP | Meaning (paraphrased)                                           | Category (suggested) | Retry (suggested)        |
| ------ | ---- | --------------------------------------------------------------- | -------------------- | ------------------------ |
| `2004` | 400  | Direct Debit transaction not found                              | invalid_request      | do_not_retry             |
| `2008` | 400  | Invalid routing or transit number                               | invalid_request      | customer_action_required |
| `2011` | 400  | Mandate reference does not exist                                | invalid_request      | do_not_retry             |
| `2012` | 400  | Mandate reference not active yet                                | invalid_request      | retry_conditionally      |
| `2013` | 400  | Mandate reference status not valid                              | invalid_request      | do_not_retry             |
| `2014` | 400  | Mandate reference already used for this bank account            | duplicate_request    | do_not_retry             |
| `2017` | 400  | Token bank scheme differs from the merchant account bank scheme | configuration        | do_not_retry             |
| `2019` | 400  | Bank account information is in INVALID state                    | invalid_request      | customer_action_required |
| `4002` | 402  | Declined by Paysafe risk management                             | fraud_or_risk        | manual_review            |

#### 4.10 Payment handle 3DS failure codes: 27 codes

| Code   | HTTP | Meaning (paraphrased)                                      | Category (suggested)  | Retry (suggested)        |
| ------ | ---- | ---------------------------------------------------------- | --------------------- | ------------------------ |
| `5100` | -    | 3DS enrollment check failed: enrollment status N           | authentication_failed | customer_action_required |
| `5101` | -    | 3DS enrollment check failed: enrollment status U           | authentication_failed | retry_conditionally      |
| `5102` | -    | Wallet returned WALLET_FAILED (Embedded Finance flow only) | provider_unavailable  | manual_review            |
| `5103` | -    | 3DS service returned FAILED                                | provider_unavailable  | retry_conditionally      |
| `5104` | -    | 3DS API reported enrollment N                              | authentication_failed | customer_action_required |
| `5105` | -    | 3DS API reported enrollment U                              | authentication_failed | retry_conditionally      |
| `5106` | -    | Risk rule: 3DS result N                                    | authentication_failed | customer_action_required |
| `5107` | -    | Risk rule: 3DS result R (rejected)                         | authentication_failed | do_not_retry             |
| `5108` | -    | Risk rule: 3DS result U                                    | authentication_failed | retry_conditionally      |
| `5109` | -    | `deviceFingerprintingId` is null                           | invalid_request       | do_not_retry             |
| `5110` | -    | `deviceFingerprintingId` is null (same text as 5109)       | invalid_request       | do_not_retry             |
| `5111` | -    | Risk rule: signature status Y but 3DS result N             | authentication_failed | customer_action_required |
| `5112` | -    | Risk rule: 3DS result U in the authentication response     | authentication_failed | retry_conditionally      |
| `5113` | -    | Risk rule: 3DS result E in the authentication response     | authentication_failed | retry_conditionally      |
| `5114` | -    | Risk rule: signature status N                              | authentication_failed | customer_action_required |
| `5115` | -    | Risk rule: 3DS result N                                    | authentication_failed | customer_action_required |
| `5116` | -    | Risk rule: 3DS result U                                    | authentication_failed | retry_conditionally      |
| `5117` | -    | Risk rule: 3DS result R                                    | authentication_failed | do_not_retry             |
| `5118` | -    | `state` missing                                            | invalid_request       | customer_action_required |
| `5119` | -    | `holderName` missing                                       | invalid_request       | customer_action_required |
| `5120` | -    | Risk rule: third-party 3DS service error                   | provider_unavailable  | retry_conditionally      |
| `5121` | -    | Risk rule: 3DS API failed                                  | provider_unavailable  | retry_conditionally      |
| `5122` | -    | 3DS API error: invalid `merchantRefNum` (OpenAPI only)     | invalid_request       | do_not_retry             |
| `5123` | -    | 3DS library returned a null id (OpenAPI only)              | provider_unavailable  | retry_conditionally      |
| `5124` | -    | 3DS result N after the challenge or OTP step               | authentication_failed | customer_action_required |
| `5125` | -    | 3DS result U after the challenge or OTP step               | authentication_failed | retry_conditionally      |
| `6000` | -    | 3DS API field error (OpenAPI only)                         | invalid_request       | do_not_retry             |

#### 4.11 Merchant advice codes (`additionalDetails[].type` = `ADVICE`): 15 codes

| Code        | HTTP | Meaning (paraphrased)                                                      | Category (suggested) | Retry (suggested)        |
| ----------- | ---- | -------------------------------------------------------------------------- | -------------------- | ------------------------ |
| `ADVICE-01` | 402  | Issuer will never approve; do not retry                                    | card_declined        | do_not_retry             |
| `ADVICE-02` | 402  | Issuer cannot approve now; at most 10 retries in 30 days                   | card_declined        | retry_conditionally      |
| `ADVICE-03` | 402  | Revalidate payment details; at most 10 retries in 30 days                  | card_declined        | customer_action_required |
| `ADVICE-04` | 402  | Cardholder must contact the issuer; at most 10 retries in 30 days          | card_declined        | customer_action_required |
| `ADVICE-05` | 402  | Token requirements not met; get a new token; at most 10 retries in 30 days | invalid_request      | customer_action_required |
| `ADVICE-06` | 402  | Undefined response                                                         | unknown              | unknown                  |
| `ADVICE-07` | 402  | Merchant does not qualify for the product code; change parameters or stop  | configuration        | do_not_retry             |
| `ADVICE-08` | 402  | Retry after 1 hour                                                         | card_declined        | retry_conditionally      |
| `ADVICE-09` | 402  | Retry after 24 hours                                                       | card_declined        | retry_conditionally      |
| `ADVICE-10` | 402  | Retry after 48 hours                                                       | card_declined        | retry_conditionally      |
| `ADVICE-11` | 402  | Retry after 4 days                                                         | card_declined        | retry_conditionally      |
| `ADVICE-12` | 402  | Retry after 6 days                                                         | card_declined        | retry_conditionally      |
| `ADVICE-13` | 402  | Retry after 8 days                                                         | card_declined        | retry_conditionally      |
| `ADVICE-14` | 402  | Retry after 10 days                                                        | card_declined        | retry_conditionally      |
| `ADVICE-42` | 402  | Sanctions screening score above the threshold                              | fraud_or_risk        | manual_review            |

#### 4.12 ISO response codes (`additionalDetails[].type` = `ISO_RESPONSE`, card errors page): 40 codes

| Code | Meaning (paraphrased)                      | Category (suggested)  | Retry (suggested)        |
| ---- | ------------------------------------------ | --------------------- | ------------------------ |
| `00` | Approved                                   | n/a (approval)        | n/a                      |
| `01` | Refer to the issuer                        | card_declined         | customer_action_required |
| `03` | Invalid merchant                           | configuration         | manual_review            |
| `04` | Pick up card                               | fraud_or_risk         | do_not_retry             |
| `05` | Do not honour                              | card_declined         | customer_action_required |
| `08` | Honour with identification                 | n/a (approval)        | n/a                      |
| `10` | Partial approval                           | n/a (approval)        | n/a                      |
| `12` | Invalid transaction                        | card_declined         | do_not_retry             |
| `13` | Invalid amount                             | invalid_amount        | do_not_retry             |
| `14` | Invalid card number                        | invalid_request       | customer_action_required |
| `15` | Invalid issuer                             | invalid_request       | customer_action_required |
| `30` | Format error                               | invalid_request       | do_not_retry             |
| `41` | Lost card                                  | fraud_or_risk         | do_not_retry             |
| `43` | Stolen card                                | fraud_or_risk         | do_not_retry             |
| `51` | Insufficient funds                         | insufficient_funds    | customer_action_required |
| `54` | Expired card                               | card_declined         | customer_action_required |
| `55` | Wrong PIN                                  | authentication_failed | customer_action_required |
| `57` | Transaction not allowed for the card       | card_declined         | customer_action_required |
| `58` | Transaction not permitted for the terminal | configuration         | do_not_retry             |
| `61` | Withdrawal limit exceeded                  | card_declined         | customer_action_required |
| `62` | Restricted card                            | card_declined         | customer_action_required |
| `65` | Frequency limit exceeded                   | card_declined         | retry_conditionally      |
| `70` | Contact the card issuer                    | card_declined         | customer_action_required |
| `71` | PIN not changed                            | authentication_failed | customer_action_required |
| `75` | PIN tries exceeded                         | authentication_failed | customer_action_required |
| `76` | Invalid "to" account                       | invalid_request       | do_not_retry             |
| `77` | Invalid "from" account                     | invalid_request       | do_not_retry             |
| `79` | Life cycle decline                         | card_declined         | retry_conditionally      |
| `82` | Policy decline                             | card_declined         | do_not_retry             |
| `83` | Fraud or security decline                  | fraud_or_risk         | do_not_retry             |
| `84` | Invalid authorization life cycle           | invalid_request       | do_not_retry             |
| `85` | No reason to decline                       | n/a (approval)        | n/a                      |
| `86` | PIN cannot be verified                     | authentication_failed | customer_action_required |
| `87` | Purchase amount only, no cash back         | invalid_request       | do_not_retry             |
| `88` | Cryptographic error                        | provider_unavailable  | retry_conditionally      |
| `89` | PIN not acceptable                         | authentication_failed | customer_action_required |
| `91` | Request destination unreachable            | provider_unavailable  | retry_conditionally      |
| `92` | Response destination unreachable           | provider_unavailable  | retry_conditionally      |
| `94` | Already reversed                           | duplicate_request     | do_not_retry             |
| `96` | Internal error                             | provider_unavailable  | retry_conditionally      |

#### 4.13 Interchecks codes (instant card payouts): 49 names

| Interchecks code                        | Paysafe HTTP/code (existing table) | Paysafe HTTP/code (new table) | Meaning (paraphrased)                                         | Category (suggested)       | Retry (suggested)        |
| --------------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------- | -------------------------- | ------------------------ |
| `ERR_CARD_INELIGIBLE`                   | 500/1001                           | 402/3017                      | Card not eligible for Interchecks                             | payment_method_unavailable | customer_action_required |
| `ERR_CREDIT_CARD_NOT_SUPPORTED`         | 500/1001                           | 402/5021                      | Credit cards not supported                                    | payment_method_unavailable | customer_action_required |
| `ERR_INVALID_EMAIL`                     | 400/5068                           | 400/3025                      | Invalid email                                                 | invalid_request            | customer_action_required |
| `ERR_EMAIL_IN_USE`                      | 500/1001                           | 502/1001                      | Recipient email already tied to another profile               | duplicate_request          | manual_review            |
| `ERR_INTERNAL_SERVER_ERROR`             | 500/1001                           | 502/1001                      | Interchecks internal error                                    | provider_unavailable       | retry_conditionally      |
| `ERR_INVALID_CARD_DETAILS`              | 400/5068                           | 402/3017                      | Invalid card details                                          | invalid_request            | customer_action_required |
| `ERR_INVALID_PAYER_ID`                  | 400/5068                           | 400/3025                      | Invalid payer ID (existing table text says "Card ineligible") | invalid_request            | do_not_retry             |
| `ERR_INVALID_RECIPIENT_EMAIL`           | 400/5068                           | 400/3025                      | Invalid recipient email                                       | invalid_request            | customer_action_required |
| `ERR_INVALID_RECIPIENT_ID`              | 400/5068                           | 400/3025                      | Invalid recipient ID (row listed twice in the new table)      | invalid_request            | do_not_retry             |
| `ERR_MISSING_RECIPIENT`                 | 400/5068                           | 400/3025                      | Recipient ID or email missing                                 | invalid_request            | do_not_retry             |
| `403 FORBIDDEN`                         | -                                  | 403/5270                      | Access forbidden                                              | configuration              | do_not_retry             |
| `ERR_ACCOUNT_PROVIDER_MISMATCH`         | -                                  | 400/5004                      | Account not valid for the provider                            | invalid_request            | do_not_retry             |
| `ERR_ACCOUNT_PROVIDER_NOT_ENABLED`      | -                                  | 400/5017                      | Payer not enabled for the account provider                    | configuration              | do_not_retry             |
| `ERR_INVALID_ACCOUNT_ID`                | -                                  | 400/5004                      | Invalid account ID                                            | invalid_request            | do_not_retry             |
| `NOT_AUTHORIZED`                        | -                                  | 401/5000                      | Unauthorized                                                  | configuration              | do_not_retry             |
| `ERR_RETRIEVING_CARD_DETAILS`           | -                                  | 502/1001                      | Card eligibility could not be determined                      | provider_unavailable       | retry_conditionally      |
| `ERR_INVALID_DATE_FORMAT`               | -                                  | 400/3025                      | Invalid date                                                  | invalid_request            | do_not_retry             |
| `ERR_INVALID_EXP_DATE`                  | -                                  | 400/3025                      | Invalid expiry date                                           | invalid_request            | customer_action_required |
| `ERR_INVALID_CURRENCY_CODE`             | -                                  | 400/3025                      | Invalid currency code                                         | invalid_request            | do_not_retry             |
| `ERR_INVALID_NAME`                      | -                                  | 400/3025                      | Name fields invalid or missing                                | invalid_request            | customer_action_required |
| `ERR_TRANSACTION_FAILURE`               | -                                  | 502/1001                      | Transaction failed (free-text reason)                         | provider_unavailable       | manual_review            |
| `ERR_RECIPIENT_NOT_FOUND`               | -                                  | 404/5269                      | Recipient email not found                                     | invalid_request            | do_not_retry             |
| `ERR_INVALID_PARAMETER`                 | -                                  | 400/3025                      | Request parameters missing or invalid                         | invalid_request            | do_not_retry             |
| `ERR_INVALID_TRANSACTION_ID`            | -                                  | 400/3025                      | Invalid transaction ID                                        | invalid_request            | do_not_retry             |
| `ERR_INSUFFICIENT_FUNDS`                | -                                  | 402/5021                      | Insufficient funds                                            | insufficient_funds         | customer_action_required |
| `ERR_VELOCITY_LIMIT`                    | -                                  | 402/3027                      | Velocity controls triggered                                   | fraud_or_risk              | retry_conditionally      |
| `ERR_ACCOUNT_SHARING_LIMIT_EXCEEDED`    | -                                  | 402/3027                      | Account sharing limit exceeded                                | fraud_or_risk              | manual_review            |
| `ERR_ACCOUNT_LIMIT_EXCEEDED`            | -                                  | 402/3027                      | Activity limit exceeded                                       | card_declined              | retry_conditionally      |
| `ERR_BANK_ACCOUNT_VALIDATION`           | -                                  | 502/1001                      | Bank account validation error                                 | provider_unavailable       | manual_review            |
| `ERR_ACCOUNT_ALREADY_REGISTERED`        | -                                  | 502/1001                      | Account already registered                                    | duplicate_request          | do_not_retry             |
| `ERR_ACCOUNT_NOT_ADDED`                 | -                                  | 502/1001                      | Account could not be added now                                | provider_unavailable       | retry_conditionally      |
| `ERR_CLIENT_ACCESS_PAYER`               | -                                  | 403/5270                      | Client has no access to the payer (text misspelled "lient")   | configuration              | do_not_retry             |
| `ERR_INELIGIBLE_RECIPIENT_ACCOUNT`      | -                                  | 502/1001                      | Account not eligible for the transaction method               | payment_method_unavailable | customer_action_required |
| `ERR_INVALID_PAYOUT_METHOD_FOR_ACCOUNT` | -                                  | 400/3025                      | Transaction method not valid for the account                  | invalid_request            | customer_action_required |
| `ERR_INVALID_RECIPIENT_REFERENCE_ID`    | -                                  | 400/3025                      | Recipient reference ID not found                              | invalid_request            | do_not_retry             |
| `ERR_OFAC_LIST_MATCH`                   | -                                  | 402/5021                      | Cancelled after an OFAC list match                            | fraud_or_risk              | manual_review            |
| `ERR_TOKENIZING_CARD`                   | -                                  | 502/1001                      | Card details could not be validated                           | provider_unavailable       | retry_conditionally      |
| `ERR_TRANSACTION_METHOD_NOT_AVAILABLE`  | -                                  | 502/1001                      | Transaction method not available                              | payment_method_unavailable | retry_conditionally      |
| `ERR_TRANSACTION_METHOD_NOT_UNIQUE`     | -                                  | 502/1001                      | Several configurations found for the method                   | configuration              | manual_review            |
| `ERR_UNSUPPORTED_CURRENCY_CODE`         | -                                  | 400/5001                      | Unsupported currency code                                     | invalid_request            | do_not_retry             |
| `ERR_VERIFICATION_NOT_ENABLED`          | -                                  | 402/5021                      | Payer not enabled for TIN verification                        | configuration              | manual_review            |
| `ERR_ACCOUNT_BALANCE_THRESHOLD`         | -                                  | 402/5021                      | Account balance insufficient                                  | insufficient_funds         | retry_conditionally      |
| `ERR_ACCOUNT_BALANCE_UNAVAILABLE`       | -                                  | 402/5021                      | Account balance unavailable                                   | provider_unavailable       | retry_conditionally      |
| `ERR_ACCOUNT_RISK_METRICS_UNAVAILABLE`  | -                                  | 502/1001                      | Account risk details unavailable                              | provider_unavailable       | retry_conditionally      |
| `ERR_ACCOUNT_RISK_LEVEL_NOT_CONFIGURED` | -                                  | 502/1001                      | Account risk level not configured                             | configuration              | manual_review            |
| `ERR_ACCOUNT_RISK_THRESHOLD`            | -                                  | 402/3027                      | Account risk threshold exceeded                               | fraud_or_risk              | manual_review            |
| `ERR_INVALID_ADDRESS_PARAMETERS`        | -                                  | 400/3025                      | Invalid address details                                       | invalid_request            | customer_action_required |
| `ERR_INVALID_COUNTRY`                   | -                                  | 400/3025                      | Invalid country                                               | invalid_request            | do_not_retry             |
| `ERR_OCT_DECLINE`                       | -                                  | see 4.14                      | Issuer declined the card payout (OCT); reason prefix in 4.14  | card_declined              | customer_action_required |

#### 4.14 Interchecks issuer reasons for `ERR_OCT_DECLINE` (prefix before the colon): 64 values

| Issuer reason | Paysafe HTTP/code | Meaning (paraphrased)                                            | Category (suggested)       | Retry (suggested)        |
| ------------- | ----------------- | ---------------------------------------------------------------- | -------------------------- | ------------------------ |
| `1`           | 402/3015          | Refer to card issuer                                             | card_declined              | customer_action_required |
| `2`           | 402/3015          | Refer to card issuer, special condition                          | card_declined              | customer_action_required |
| `3`           | 500/1003          | Invalid merchant                                                 | configuration              | manual_review            |
| `4`           | 402/3016          | Pick up card (no fraud)                                          | card_declined              | do_not_retry             |
| `5`           | 402/3009          | Do not honor                                                     | card_declined              | customer_action_required |
| `6`           | 502/3028          | Issuer error without detail                                      | provider_unavailable       | retry_conditionally      |
| `7`           | 402/3054          | Pick up card, special condition (fraud account)                  | fraud_or_risk              | do_not_retry             |
| `10`          | 502/3028          | Partial approval                                                 | card_declined              | manual_review            |
| `12`          | 402/3037          | Invalid transaction; may follow quick repeats of the same amount | card_declined              | do_not_retry             |
| `13`          | 402/3703          | Invalid amount or currency field overflow                        | invalid_amount             | do_not_retry             |
| `14`          | 402/3017          | No such account number                                           | invalid_request            | customer_action_required |
| `15`          | 402/3036          | No such issuer                                                   | invalid_request            | customer_action_required |
| `19`          | 402/3029          | Re-enter transaction                                             | card_declined              | retry_conditionally      |
| `21`          | 402/3017          | No action taken                                                  | card_declined              | customer_action_required |
| `25`          | 402/3017          | Record not found in issuer file                                  | invalid_request            | customer_action_required |
| `28`          | 502/3028          | Issuer file temporarily unavailable                              | provider_unavailable       | retry_conditionally      |
| `39`          | 402/3017          | No credit account                                                | invalid_request            | customer_action_required |
| `41`          | 402/3016          | Lost card, pick up                                               | fraud_or_risk              | do_not_retry             |
| `43`          | 402/3016          | Stolen card, pick up                                             | fraud_or_risk              | do_not_retry             |
| `46`          | 402/3013          | Account closed; do not retry with the same card                  | card_declined              | do_not_retry             |
| `51`          | 402/3010          | Insufficient funds                                               | insufficient_funds         | customer_action_required |
| `52`          | 402/3017          | No checking account                                              | invalid_request            | customer_action_required |
| `53`          | 402/3017          | No savings account                                               | invalid_request            | customer_action_required |
| `54`          | 400/3006          | Expired card or expiry missing                                   | card_declined              | customer_action_required |
| `55`          | 402/3039          | Wrong or missing PIN                                             | authentication_failed      | customer_action_required |
| `57`          | 402/3040          | Transaction not permitted to the cardholder                      | card_declined              | customer_action_required |
| `58`          | 402/3029          | Transaction not allowed at the terminal                          | configuration              | do_not_retry             |
| `59`          | 402/3054          | Suspected fraud                                                  | fraud_or_risk              | do_not_retry             |
| `61`          | 402/3027          | Exceeds approval amount limit                                    | card_declined              | customer_action_required |
| `62`          | 402/3011          | Restricted card (region or country)                              | card_declined              | customer_action_required |
| `63`          | 402/3019          | Security violation                                               | fraud_or_risk              | do_not_retry             |
| `64`          | 402/3023          | AML requirement not met                                          | fraud_or_risk              | manual_review            |
| `65`          | 402/3027          | Withdrawal frequency limit exceeded                              | card_declined              | retry_conditionally      |
| `70`          | 402/3039          | PIN data required                                                | authentication_required    | customer_action_required |
| `74`          | 402/3039          | PIN encryption value mismatch                                    | authentication_failed      | manual_review            |
| `75`          | 402/3035          | PIN tries exceeded                                               | authentication_failed      | customer_action_required |
| `76`          | 402/3060          | Unsolicited reversal                                             | unknown                    | manual_review            |
| `78`          | 402/3029          | Blocked: first use by a new cardholder, card not unblocked       | card_declined              | customer_action_required |
| `79`          | 502/1001          | Already reversed by the switch                                   | duplicate_request          | do_not_retry             |
| `80`          | 502/1001          | No financial impact                                              | unknown                    | manual_review            |
| `81`          | 402/3042          | PIN cryptographic error                                          | authentication_failed      | manual_review            |
| `82`          | 402/3019          | Negative CAM, dCVV, iCVV or CVV result                           | authentication_failed      | customer_action_required |
| `86`          | 402/3039          | PIN cannot be verified                                           | authentication_failed      | customer_action_required |
| `89`          | 502/1001          | Not eligible to receive financial position information           | unknown                    | manual_review            |
| `91`          | 502/3028          | Issuer or switch inoperative                                     | provider_unavailable       | retry_conditionally      |
| `92`          | 502/3028          | Destination cannot be found for routing                          | provider_unavailable       | retry_conditionally      |
| `93`          | 402/3023          | Violation of law                                                 | fraud_or_risk              | do_not_retry             |
| `1A`          | 402/3039          | Additional customer authentication required                      | authentication_required    | customer_action_required |
| `6P`          | 502/1001          | Verification data failed                                         | authentication_failed      | customer_action_required |
| `B1`          | 502/1001          | Surcharge not permitted on Visa or EBT food stamps (US)          | configuration              | do_not_retry             |
| `B2`          | 502/1001          | Surcharge not supported by the debit network issuer              | configuration              | do_not_retry             |
| `N0`          | 502/1001          | Force STIP                                                       | unknown                    | manual_review            |
| `N3`          | 502/1001          | Cash service not available                                       | payment_method_unavailable | do_not_retry             |
| `N4`          | 502/1001          | Cash request exceeds issuer or approved limit                    | card_declined              | customer_action_required |
| `N5`          | 502/1001          | Not eligible for resubmission                                    | card_declined              | do_not_retry             |
| `N7`          | 402/3019          | Declined for CVV2 failure                                        | card_declined              | customer_action_required |
| `N8`          | 402/3047          | Amount exceeds preauthorized approval amount                     | invalid_amount             | do_not_retry             |
| `P5`          | 402/3039          | PIN unblock or change declined                                   | authentication_failed      | customer_action_required |
| `P6`          | 402/3039          | Requested PIN change unsafe                                      | authentication_failed      | customer_action_required |
| `Q1`          | 402/3039          | Card authentication failed                                       | authentication_failed      | customer_action_required |
| `R0`          | 502/1001          | Stop payment order                                               | card_declined              | do_not_retry             |
| `R2`          | 402/3039          | Not eligible for Visa PIN                                        | authentication_failed      | customer_action_required |
| `R3`          | 502/1001          | Revocation of all authorizations                                 | card_declined              | do_not_retry             |
| `R4`          | 502/1001          | Could not go online; declined offline                            | network_or_timeout         | retry_conditionally      |

#### 4.15 SafetyPay Express codes: 13 values

Source: the SafetyPay Express error codes page. `?` means the page gives no HTTP status for that row (only the first row has one).

| SafetyPay code | Paysafe HTTP/code | Meaning (paraphrased)                                               | Category (suggested)       | Retry (suggested)        |
| -------------- | ----------------- | ------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `10105`        | 400/5003          | Amount outside the minimum or maximum                               | invalid_amount             | customer_action_required |
| `21519`        | ?/5010            | Country code required                                               | invalid_request            | do_not_retry             |
| `21523`        | ?/5068            | Bank ID code required                                               | invalid_request            | do_not_retry             |
| `21653`        | ?/5068            | `profile.email` invalid                                             | invalid_request            | customer_action_required |
| `21505`        | ?/5068            | No banks available in the country                                   | payment_method_unavailable | do_not_retry             |
| `21511`        | ?/5001            | No currencies available in the country                              | payment_method_unavailable | do_not_retry             |
| `21513`        | ?/5001            | Currency not available in the country                               | payment_method_unavailable | do_not_retry             |
| `21526`        | ?/5068            | Bank not available in the country                                   | payment_method_unavailable | customer_action_required |
| `21530`        | ?/5068            | Bank not available for this payment request                         | payment_method_unavailable | customer_action_required |
| `21531`        | ?/5003            | Bank not associated with the selected country                       | invalid_request            | customer_action_required |
| `21602`        | ?/1007            | Error handling transaction references in the bank's partner service | provider_unavailable       | retry_conditionally      |
| `21512`        | ?/1001            | Generic SafetyPay error                                             | provider_unavailable       | retry_conditionally      |
| `21600`        | ?/1007            | Unhandled error in the bank's partner service                       | provider_unavailable       | retry_conditionally      |

#### 4.16 PayPal error names surfaced through Paysafe: 93 names

Source: the PayPal error codes page. `AP-GW-4` abbreviates `ALTERNATE-PAYMENTS-GATEWAY-4`. The status column is the Paysafe resource status the page gives for each case (`FAILED` or `ERROR`).

| PayPal name                                    | Paysafe HTTP / code / status | Meaning (paraphrased)                                     | Category (suggested)       | Retry (suggested)        |
| ---------------------------------------------- | ---------------------------- | --------------------------------------------------------- | -------------------------- | ------------------------ |
| `ACTION_DOES_NOT_MATCH_INTENT`                 | 402 / AP-GW-4 / FAILED       | Action does not match the order intent                    | configuration              | do_not_retry             |
| `AUTH_CAPTURE_NOT_ENABLED`                     | 402 / AP-GW-4 / FAILED       | Authorize-and-capture not enabled for the merchant        | configuration              | do_not_retry             |
| `AGREEMENT_ALREADY_CANCELLED`                  | 402 / AP-GW-4 / FAILED       | Billing agreement already cancelled                       | invalid_request            | do_not_retry             |
| `AMOUNT_CANNOT_BE_SPECIFIED`                   | 402 / AP-GW-4 / FAILED       | Authorization amount allowed only for saved orders        | invalid_request            | do_not_retry             |
| `AMOUNT_MISMATCH`                              | 502 / 1001 / ERROR           | Amount does not equal the breakdown                       | invalid_amount             | do_not_retry             |
| `AUTHENTICATION_FAILURE`                       | 502 / 1001 / ERROR           | Authentication to PayPal failed                           | configuration              | do_not_retry             |
| `AUTHORIZATION_AMOUNT_EXCEEDED`                | 502 / 1001 / FAILED          | Authorization amount above the allowed limit              | invalid_amount             | do_not_retry             |
| `AUTHORIZATION_CURRENCY_MISMATCH`              | 502 / 1001 / FAILED          | Authorization currency differs from the order             | invalid_request            | do_not_retry             |
| `BILLING_AGREEMENT_NOT_FOUND`                  | 402 / AP-GW-4 / FAILED       | Billing agreement token not found                         | invalid_request            | do_not_retry             |
| `CANNOT_BE_NEGATIVE`                           | 502 / 1001 / ERROR           | Value must be zero or more                                | invalid_request            | do_not_retry             |
| `CANNOT_BE_ZERO_OR_NEGATIVE`                   | 502 / 1001 / ERROR           | Value must be above zero                                  | invalid_amount             | do_not_retry             |
| `CARD_TYPE_NOT_SUPPORTED`                      | 402 / AP-GW-4 / FAILED       | Card type not supported                                   | payment_method_unavailable | customer_action_required |
| `INVALID_SECURITY_CODE_LENGTH`                 | 402 / AP-GW-4 / FAILED       | Security code length wrong for the card type              | invalid_request            | customer_action_required |
| `CITY_REQUIRED`                                | 502 / 1001 / ERROR           | City required for the country                             | invalid_request            | customer_action_required |
| `COMPLIANCE_VIOLATION`                         | 402 / AP-GW-4 / FAILED       | Possible compliance violation                             | fraud_or_risk              | manual_review            |
| `CONSENT_NEEDED`                               | 402 / AP-GW-4 / FAILED       | Payer consent needed                                      | authentication_required    | customer_action_required |
| `CURRENCY_NOT_SUPPORTED_FOR_CARD_TYPE`         | 502 / 1001 / ERROR           | Currency not supported for the card type                  | invalid_request            | do_not_retry             |
| `CURRENCY_NOT_SUPPORTED_FOR_COUNTRY`           | 502 / 1001 / ERROR           | Currency not supported in the country                     | invalid_request            | do_not_retry             |
| `DECIMAL_PRECISION`                            | 502 / 1001 / ERROR           | More than two decimal places                              | invalid_request            | do_not_retry             |
| `DOMESTIC_TRANSACTION_REQUIRED`                | 502 / 1001 / ERROR           | Payer and payee must be in the same country               | configuration              | do_not_retry             |
| `DUPLICATE_INVOICE_ID`                         | 502 / 1001 / ERROR           | Invoice ID already used                                   | duplicate_request          | do_not_retry             |
| `DUPLICATE_REQUEST_ID`                         | 502 / 1001 / ERROR           | PayPal request ID header already used                     | duplicate_request          | do_not_retry             |
| `INSTRUMENT_DECLINED`                          | 402 / AP-GW-4 / FAILED       | Funding instrument declined                               | card_declined              | customer_action_required |
| `INTERNAL_SERVER_ERROR`                        | 402 / AP-GW-4 / FAILED       | PayPal internal server error                              | provider_unavailable       | retry_conditionally      |
| `INTERNAL_SERVICE_ERROR`                       | 402 / AP-GW-4 / FAILED       | PayPal internal service error                             | provider_unavailable       | retry_conditionally      |
| `INVALID_ACCOUNT_STATUS`                       | 402 / AP-GW-4 / FAILED       | Account validation failed for the user                    | card_declined              | customer_action_required |
| `INVALID_ARRAY_MAX_ITEMS`                      | 502 / 1001 / ERROR           | Too many array items                                      | invalid_request            | do_not_retry             |
| `INVALID_ARRAY_MIN_ITEMS`                      | 502 / 1001 / ERROR           | Too few array items                                       | invalid_request            | do_not_retry             |
| `INVALID_COUNTRY_CODE`                         | 502 / 1001 / ERROR           | Invalid country code                                      | invalid_request            | do_not_retry             |
| `INVALID_CURRENCY_CODE`                        | 502 / 1001 / ERROR           | Invalid or unsupported currency code                      | invalid_request            | do_not_retry             |
| `INVALID_JSON_POINTER_FORMAT`                  | 502 / 1001 / ERROR           | Invalid JSON pointer path                                 | invalid_request            | do_not_retry             |
| `INVALID_PARAMETER_SYNTAX`                     | 502 / 1001 / ERROR           | Field value has the wrong format                          | invalid_request            | do_not_retry             |
| `INVALID_PARAMETER_VALUE`                      | 502 / 1001 / ERROR           | Field value invalid                                       | invalid_request            | do_not_retry             |
| `INVALID_PARAMETER`                            | 502 / 1001 / ERROR           | Parameter not allowed in the request                      | invalid_request            | do_not_retry             |
| `INVALID_PAYER_ID`                             | 502 / 1001 / ERROR           | Invalid payer ID                                          | invalid_request            | do_not_retry             |
| `INVALID_RESOURCE_ID`                          | 502 / 1001 / ERROR           | Resource ID does not exist                                | invalid_request            | do_not_retry             |
| `INVALID_STRING_LENGTH`                        | 502 / 1001 / ERROR           | Field too short or too long                               | invalid_request            | do_not_retry             |
| `ITEM_TOTAL_MISMATCH`                          | 502 / 1001 / ERROR           | Item total does not match the items                       | invalid_amount             | do_not_retry             |
| `ITEM_TOTAL_REQUIRED`                          | 502 / 1001 / ERROR           | Item total required when items are given                  | invalid_request            | do_not_retry             |
| `MAX_AUTHORIZATION_COUNT_EXCEEDED`             | 402 / AP-GW-4 / FAILED       | Maximum number of authorizations reached                  | invalid_request            | do_not_retry             |
| `MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED`      | 402 / AP-GW-4 / FAILED       | Maximum payment attempts reached                          | card_declined              | manual_review            |
| `MAX_VALUE_EXCEEDED`                           | 502 / 1001 / ERROR           | Value above 9999999.99                                    | invalid_amount             | do_not_retry             |
| `MISSING_REQUIRED_PARAMETER`                   | 502 / 1001 / ERROR           | Required field missing                                    | invalid_request            | do_not_retry             |
| `MISSING_SHIPPING_ADDRESS`                     | 502 / 1001 / ERROR           | Shipping address required by the shipping preference      | invalid_request            | customer_action_required |
| `MULTI_CURRENCY_ORDER`                         | 502 / 1001 / ERROR           | Several currencies in one order                           | invalid_request            | do_not_retry             |
| `MULTIPLE_SHIPPING_ADDRESS_NOT_SUPPORTED`      | 502 / 1001 / ERROR           | Several shipping addresses not supported                  | invalid_request            | do_not_retry             |
| `MULTIPLE_SHIPPING_OPTION_SELECTED`            | 502 / 1001 / ERROR           | More than one shipping option selected                    | invalid_request            | do_not_retry             |
| `INVALID_PICKUP_ADDRESS`                       | 502 / 1001 / ERROR           | Pickup shipping name has the wrong form                   | invalid_request            | do_not_retry             |
| `NOT_AUTHORIZED`                               | 502 / 1001 / ERROR           | Insufficient API permissions                              | configuration              | do_not_retry             |
| `NOT_ENABLED_FOR_CARD_PROCESSING`              | 402 / AP-GW-4 / FAILED       | Caller account cannot process cards                       | configuration              | do_not_retry             |
| `NOT_SUPPORTED`                                | 502 / 1001 / ERROR           | Field not supported                                       | invalid_request            | do_not_retry             |
| `ORDER_ALREADY_AUTHORIZED`                     | 402 / AP-GW-4 / FAILED       | Order already authorized                                  | duplicate_request          | do_not_retry             |
| `ORDER_ALREADY_CAPTURED`                       | 402 / AP-GW-4 / FAILED       | Order already captured                                    | duplicate_request          | do_not_retry             |
| `ORDER_CANNOT_BE_SAVED`                        | 402 / AP-GW-4 / FAILED       | Order cannot be saved                                     | invalid_request            | do_not_retry             |
| `ORDER_COMPLETED_OR_VOIDED`                    | 402 / AP-GW-4 / FAILED       | Order completed or voided                                 | invalid_request            | do_not_retry             |
| `ORDER_EXPIRED`                                | 402 / AP-GW-4 / FAILED       | Order expired                                             | invalid_request            | customer_action_required |
| `ORDER_NOT_APPROVED`                           | 402 / AP-GW-4 / FAILED       | Payer has not approved the order                          | authentication_required    | customer_action_required |
| `ORDER_NOT_SAVED`                              | 402 / AP-GW-4 / FAILED       | Order must be saved first                                 | invalid_request            | do_not_retry             |
| `ORDER_PREVIOUSLY_VOIDED`                      | 402 / AP-GW-4 / FAILED       | Order voided earlier                                      | invalid_request            | do_not_retry             |
| `PARAMETER_VALUE_NOT_SUPPORTED`                | 502 / 1001 / ERROR           | Field value not supported                                 | invalid_request            | do_not_retry             |
| `PAYEE_ACCOUNT_INVALID`                        | 502 / 1001 / ERROR           | Payee account invalid                                     | configuration              | do_not_retry             |
| `PAYEE_ACCOUNT_LOCKED_OR_CLOSED`               | 502 / 1001 / ERROR           | Payee account locked or closed                            | configuration              | manual_review            |
| `PAYEE_ACCOUNT_RESTRICTED`                     | 502 / 1001 / ERROR           | Merchant account restricted                               | configuration              | manual_review            |
| `PAYEE_BLOCKED_TRANSACTION`                    | 402 / AP-GW-4 / FAILED       | Blocked by the seller's fraud settings                    | fraud_or_risk              | manual_review            |
| `PAYER_ACCOUNT_LOCKED_OR_CLOSED`               | 502 / 1001 / ERROR           | Payer account locked or closed                            | card_declined              | customer_action_required |
| `PAYER_ACCOUNT_RESTRICTED`                     | 502 / 1001 / ERROR           | Payer account restricted                                  | card_declined              | customer_action_required |
| `PAYER_CANNOT_PAY`                             | 402 / AP-GW-4 / FAILED       | Payer cannot pay for this transaction                     | card_declined              | customer_action_required |
| `PAYER_CONSENT_REQUIRED`                       | 402 / AP-GW-4 / FAILED       | Payer consent required                                    | authentication_required    | customer_action_required |
| `PAYER_COUNTRY_NOT_SUPPORTED`                  | 502 / 1001 / ERROR           | Payer country not supported                               | payment_method_unavailable | customer_action_required |
| `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`        | 402 / AP-GW-4 / FAILED       | Caller account cannot process cards                       | configuration              | do_not_retry             |
| `PAYMENT_INSTRUCTION_REQUIRED`                 | 402 / AP-GW-4 / FAILED       | Payment instruction required at capture                   | invalid_request            | do_not_retry             |
| `PERMISSION_DENIED`                            | 502 / 1001 / ERROR           | No permission for the resource                            | configuration              | do_not_retry             |
| `POSTAL_CODE_REQUIRED`                         | 502 / 1001 / ERROR           | Postal code required for the country                      | invalid_request            | customer_action_required |
| `PREFERRED_SHIPPING_OPTION_AMOUNT_MISMATCH`    | 502 / 1001 / ERROR           | Preferred shipping option amount mismatch                 | invalid_amount             | do_not_retry             |
| `REDIRECT_PAYER_FOR_ALTERNATE_FUNDING`         | 402 / AP-GW-4 / FAILED       | Payer must choose another funding source                  | card_declined              | customer_action_required |
| `REFERENCE_ID_NOT_FOUND`                       | 502 / 1001 / ERROR           | Reference ID filter value wrong                           | invalid_request            | do_not_retry             |
| `REFERENCE_ID_REQUIRED`                        | 502 / 1001 / ERROR           | Reference ID required for each purchase unit              | invalid_request            | do_not_retry             |
| `DUPLICATE_REFERENCE_ID`                       | 502 / 1001 / ERROR           | Reference IDs must be unique                              | invalid_request            | do_not_retry             |
| `SHIPPING_ADDRESS_INVALID`                     | 502 / 1001 / ERROR           | Shipping address invalid                                  | invalid_request            | customer_action_required |
| `SHIPPING_OPTION_NOT_SELECTED`                 | 502 / 1001 / ERROR           | No shipping option selected                               | invalid_request            | do_not_retry             |
| `SHIPPING_OPTIONS_NOT_SUPPORTED`               | 502 / 1001 / ERROR           | Shipping options not allowed with this preference         | invalid_request            | do_not_retry             |
| `TAX_TOTAL_MISMATCH`                           | 502 / 1001 / ERROR           | Tax total does not match the items                        | invalid_amount             | do_not_retry             |
| `TAX_TOTAL_REQUIRED`                           | 502 / 1001 / ERROR           | Tax total required when item tax is given                 | invalid_request            | do_not_retry             |
| `TRANSACTION_AMOUNT_EXCEEDS_MONTHLY_MAX_LIMIT` | 402 / AP-GW-4 / FAILED       | Monthly maximum exceeded                                  | invalid_amount             | manual_review            |
| `TRANSACTION_BLOCKED_BY_PAYEE`                 | 402 / AP-GW-4 / FAILED       | Blocked by the payee's fraud settings                     | fraud_or_risk              | manual_review            |
| `TRANSACTION_LIMIT_EXCEEDED`                   | 402 / AP-GW-4 / FAILED       | Transaction limit exceeded                                | invalid_amount             | manual_review            |
| `TRANSACTION_RECEIVING_LIMIT_EXCEEDED`         | 402 / AP-GW-4 / FAILED       | Payee receiving limit exceeded                            | invalid_amount             | manual_review            |
| `TRANSACTION_REFUSED`                          | 402 / AP-GW-4 / FAILED       | Transaction refused                                       | card_declined              | customer_action_required |
| `UNSUPPORTED_INTENT`                           | 502 / 1001 / ERROR           | Authorize intent not supported for several purchase units | invalid_request            | do_not_retry             |
| `UNSUPPORTED_PAYMENT_INSTRUCTION`              | 502 / 1001 / ERROR           | Payment instruction allowed only with capture intent      | invalid_request            | do_not_retry             |
| `PAYEE_ACCOUNT_NOT_SUPPORTED`                  | 502 / 1001 / ERROR           | Payee has no PayPal account                               | configuration              | do_not_retry             |
| `PAYEE_ACCOUNT_NOT_VERIFIED`                   | 502 / 1001 / ERROR           | Payee PayPal account not verified                         | configuration              | do_not_retry             |
| `PAYEE_NOT_CONSENTED`                          | 402 / AP-GW-4 / FAILED       | Payee has not given consent to the caller                 | configuration              | do_not_retry             |

#### 4.17 OPN/NAG processor responses: 60 codes, plus 1 VSPS code

| Code        | Meaning (paraphrased)                                             | Category (suggested)       | Retry (suggested)        |
| ----------- | ----------------------------------------------------------------- | -------------------------- | ------------------------ |
| `00`        | Approved                                                          | n/a (approval)             | n/a                      |
| `01`        | Refer to the issuer                                               | card_declined              | customer_action_required |
| `03`        | Invalid merchant                                                  | configuration              | manual_review            |
| `04`        | Pick up card                                                      | fraud_or_risk              | do_not_retry             |
| `05`        | Do not honour                                                     | card_declined              | customer_action_required |
| `06`        | Error (reversals only)                                            | provider_unavailable       | manual_review            |
| `09`        | Transaction in progress                                           | unknown                    | retry_conditionally      |
| `10`        | Partial approval                                                  | n/a (approval)             | n/a                      |
| `12`        | Invalid transaction                                               | card_declined              | do_not_retry             |
| `13`        | Invalid amount                                                    | invalid_amount             | do_not_retry             |
| `14`        | Invalid card number                                               | invalid_request            | customer_action_required |
| `15`        | Invalid issuer: BIN does not map to an issuer                     | invalid_request            | customer_action_required |
| `17`        | Customer cancellation                                             | card_declined              | customer_action_required |
| `19`        | Re-enter transaction                                              | card_declined              | retry_conditionally      |
| `30`        | Message format error                                              | invalid_request            | do_not_retry             |
| `41`        | Lost card, pick up                                                | fraud_or_risk              | do_not_retry             |
| `43`        | Stolen card, pick up                                              | fraud_or_risk              | do_not_retry             |
| `46`        | Account closed                                                    | card_declined              | do_not_retry             |
| `51`        | Insufficient funds                                                | insufficient_funds         | customer_action_required |
| `52`        | No checking account                                               | invalid_request            | customer_action_required |
| `53`        | No savings account                                                | invalid_request            | customer_action_required |
| `54`        | Expired card                                                      | card_declined              | customer_action_required |
| `55`        | Wrong PIN                                                         | authentication_failed      | customer_action_required |
| `57`        | Transaction not permitted                                         | card_declined              | customer_action_required |
| `58`        | Transaction not allowed at the terminal                           | configuration              | do_not_retry             |
| `59`        | Suspected fraud                                                   | fraud_or_risk              | do_not_retry             |
| `61`        | Usage limit exceeded                                              | card_declined              | customer_action_required |
| `62`        | Restricted card                                                   | card_declined              | customer_action_required |
| `64`        | AML requirements not met                                          | fraud_or_risk              | manual_review            |
| `65`        | Frequency limit exceeded                                          | card_declined              | retry_conditionally      |
| `68`        | Late response (timeout)                                           | network_or_timeout         | retry_conditionally      |
| `6P`        | Verification data failed                                          | authentication_failed      | customer_action_required |
| `71`        | PIN not changed                                                   | authentication_failed      | customer_action_required |
| `75`        | PIN tries exceeded                                                | authentication_failed      | customer_action_required |
| `76`        | Additional customer authentication required (contact mode or SCA) | authentication_required    | customer_action_required |
| `77`        | PIN data requested                                                | authentication_required    | customer_action_required |
| `78`        | Blocked: first use or special condition                           | card_declined              | customer_action_required |
| `79`        | Life cycle decline                                                | card_declined              | retry_conditionally      |
| `81`        | Cryptographic error                                               | provider_unavailable       | retry_conditionally      |
| `82`        | Invalid CVV2                                                      | card_declined              | customer_action_required |
| `84`        | Re-enter transaction                                              | card_declined              | retry_conditionally      |
| `85`        | Invalid CVV1 or CVV3                                              | card_declined              | customer_action_required |
| `86`        | PIN cannot be verified                                            | authentication_failed      | customer_action_required |
| `87`        | To or from account does not exist                                 | invalid_request            | do_not_retry             |
| `91`        | Authorization or issuer system inoperative                        | provider_unavailable       | retry_conditionally      |
| `92`        | Cannot route: institution or network not found                    | provider_unavailable       | retry_conditionally      |
| `93`        | Violation of law                                                  | fraud_or_risk              | do_not_retry             |
| `94`        | Duplicate transmission                                            | duplicate_request          | do_not_retry             |
| `95`        | Already reversed or reconciliation mismatch                       | duplicate_request          | manual_review            |
| `96`        | System malfunction                                                | provider_unavailable       | retry_conditionally      |
| `B1`        | Surcharge not permitted on Visa or EBT food stamps                | configuration              | do_not_retry             |
| `B2`        | Surcharge not supported by the debit network issuer               | configuration              | do_not_retry             |
| `C1`        | Invalid country code                                              | invalid_request            | do_not_retry             |
| `C2`        | Invalid region code                                               | invalid_request            | do_not_retry             |
| `N3`        | Cash service not available (POS)                                  | payment_method_unavailable | do_not_retry             |
| `N4`        | Cash request exceeds issuer or approved limit                     | card_declined              | customer_action_required |
| `R2`        | Not eligible for Visa PIN                                         | authentication_failed      | customer_action_required |
| `P5`        | PIN unblock or change declined (ATM)                              | authentication_failed      | customer_action_required |
| `N8`        | Amount exceeds preauthorized approval amount                      | invalid_amount             | do_not_retry             |
| `P6`        | Requested PIN change unsafe (ATM)                                 | authentication_failed      | customer_action_required |
| `80` (VSPS) | Cancellation in or of a recurring series; do not retry            | card_declined              | do_not_retry             |

#### 4.18 MON processor responses: 43 codes, plus 3 VSPS codes

| Code        | Meaning (paraphrased)                                       | Category (suggested)  | Retry (suggested)        |
| ----------- | ----------------------------------------------------------- | --------------------- | ------------------------ |
| `01`        | Approved                                                    | n/a (approval)        | n/a                      |
| `03`        | Invalid service code or merchant                            | configuration         | manual_review            |
| `04`        | Decline, pick up card                                       | fraud_or_risk         | do_not_retry             |
| `05`        | Do not honor                                                | card_declined         | customer_action_required |
| `07`        | Pick up card, special condition                             | fraud_or_risk         | do_not_retry             |
| `12`        | Invalid transaction code                                    | invalid_request       | do_not_retry             |
| `15`        | No such issuer                                              | invalid_request       | customer_action_required |
| `19`        | Retry transaction                                           | card_declined         | retry_conditionally      |
| `30`        | Bad message or format error                                 | invalid_request       | do_not_retry             |
| `39`        | No checking account; invalid account                        | invalid_request       | customer_action_required |
| `40`        | Invalid transaction; inquiry not allowed                    | invalid_request       | do_not_retry             |
| `41`        | Lost or stolen card                                         | fraud_or_risk         | do_not_retry             |
| `43`        | Stolen card, pick up                                        | fraud_or_risk         | do_not_retry             |
| `46`        | Account closed                                              | card_declined         | do_not_retry             |
| `50`        | Not allowed for cardholder or merchant; invalid transaction | card_declined         | do_not_retry             |
| `51`        | Low or insufficient funds                                   | insufficient_funds    | customer_action_required |
| `52`        | No checking account; invalid account                        | invalid_request       | customer_action_required |
| `53`        | No savings account; invalid account                         | invalid_request       | customer_action_required |
| `54`        | Expired card                                                | card_declined         | customer_action_required |
| `55`        | Invalid or wrong PIN                                        | authentication_failed | customer_action_required |
| `57`        | Not permitted to cardholder; card not supported             | card_declined         | customer_action_required |
| `58`        | Not permitted to acquirer                                   | configuration         | do_not_retry             |
| `59`        | Suspected fraud                                             | fraud_or_risk         | do_not_retry             |
| `62`        | Invalid status, restricted or limited card                  | card_declined         | customer_action_required |
| `63`        | No security module; security violation                      | fraud_or_risk         | do_not_retry             |
| `68`        | Timeout                                                     | network_or_timeout    | retry_conditionally      |
| `77`        | Invalid transaction date                                    | invalid_request       | do_not_retry             |
| `78`        | Card not authorized                                         | card_declined         | customer_action_required |
| `79`        | Life cycle decline; do not retry                            | card_declined         | do_not_retry             |
| `80`        | Invalid transaction                                         | card_declined         | do_not_retry             |
| `82`        | Invalid CVV; policy decline                                 | card_declined         | customer_action_required |
| `83`        | Security-related decline                                    | fraud_or_risk         | do_not_retry             |
| `86`        | Unable to authorize; security violation                     | fraud_or_risk         | do_not_retry             |
| `88`        | Unable to authorize; security violation                     | fraud_or_risk         | do_not_retry             |
| `89`        | External system problem                                     | provider_unavailable  | retry_conditionally      |
| `91`        | Cannot complete; network processing problem                 | provider_unavailable  | retry_conditionally      |
| `92`        | Invalid route service (destination)                         | provider_unavailable  | retry_conditionally      |
| `93`        | Invalid route service (destination)                         | provider_unavailable  | retry_conditionally      |
| `94`        | Duplicate transaction or request in progress                | duplicate_request     | do_not_retry             |
| `96`        | System error                                                | provider_unavailable  | retry_conditionally      |
| `6P`        | Verification data failed                                    | authentication_failed | customer_action_required |
| `N4`        | Decline (no further text)                                   | card_declined         | customer_action_required |
| `N7`        | Decline (no further text)                                   | card_declined         | customer_action_required |
| `R0` (VSPS) | Stop payment order: skip this rebill, try the next one      | card_declined         | retry_conditionally      |
| `R1` (VSPS) | Authorization revoked: stop all further transactions        | card_declined         | do_not_retry             |
| `R3` (VSPS) | All authorizations revoked: stop all; account may be closed | card_declined         | do_not_retry             |

#### 4.19 TAS/VPS processor responses: 105 codes, plus 3 VSPS codes

| Code        | Meaning (paraphrased)                                                          | Category (suggested)       | Retry (suggested)        |
| ----------- | ------------------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `00`        | Approved and completed                                                         | n/a (approval)             | n/a                      |
| `01`        | Refer to issuer                                                                | card_declined              | customer_action_required |
| `02`        | Refer to issuer, special condition                                             | card_declined              | customer_action_required |
| `03`        | Invalid merchant ID                                                            | configuration              | manual_review            |
| `04`        | Pick up card (no fraud)                                                        | card_declined              | do_not_retry             |
| `05`        | Do not honor                                                                   | card_declined              | customer_action_required |
| `06`        | General error                                                                  | provider_unavailable       | retry_conditionally      |
| `07`        | Pick up card, special condition (fraud account)                                | fraud_or_risk              | do_not_retry             |
| `08`        | Honor Mastercard with ID                                                       | n/a (approval)             | n/a                      |
| `10`        | Partial approval for the returned amount                                       | n/a (approval)             | n/a                      |
| `11`        | VIP approval                                                                   | n/a (approval)             | n/a                      |
| `12`        | Invalid transaction                                                            | card_declined              | do_not_retry             |
| `13`        | Invalid amount                                                                 | invalid_amount             | do_not_retry             |
| `14`        | Invalid card number                                                            | invalid_request            | customer_action_required |
| `15`        | No such issuer                                                                 | invalid_request            | customer_action_required |
| `19`        | Re-enter transaction                                                           | card_declined              | retry_conditionally      |
| `21`        | Cannot back out transaction                                                    | unknown                    | manual_review            |
| `25`        | Account number not found                                                       | invalid_request            | customer_action_required |
| `28`        | File temporarily unavailable                                                   | provider_unavailable       | retry_conditionally      |
| `30`        | Transaction badly formatted                                                    | invalid_request            | do_not_retry             |
| `39`        | No credit account                                                              | invalid_request            | customer_action_required |
| `41`        | Lost card, pick up (fraud account)                                             | fraud_or_risk              | do_not_retry             |
| `43`        | Stolen card, pick up (fraud account)                                           | fraud_or_risk              | do_not_retry             |
| `46`        | Account closed                                                                 | card_declined              | do_not_retry             |
| `51`        | Insufficient funds                                                             | insufficient_funds         | customer_action_required |
| `52`        | No checking account                                                            | invalid_request            | customer_action_required |
| `53`        | No savings account                                                             | invalid_request            | customer_action_required |
| `54`        | Expired card                                                                   | card_declined              | customer_action_required |
| `55`        | Wrong PIN                                                                      | authentication_failed      | customer_action_required |
| `57`        | Not permitted for the card                                                     | card_declined              | customer_action_required |
| `58`        | Not permitted for the terminal                                                 | configuration              | do_not_retry             |
| `59`        | Suspected fraud                                                                | fraud_or_risk              | do_not_retry             |
| `61`        | Exceeds approval amount limit                                                  | card_declined              | customer_action_required |
| `62`        | Invalid service code, restricted                                               | card_declined              | customer_action_required |
| `63`        | Security violation                                                             | fraud_or_risk              | do_not_retry             |
| `65`        | Withdrawal frequency limit exceeded                                            | card_declined              | retry_conditionally      |
| `6P`        | Verification data failed                                                       | authentication_failed      | customer_action_required |
| `75`        | PIN tries exceeded                                                             | authentication_failed      | customer_action_required |
| `76`        | Cannot locate, no match                                                        | invalid_request            | manual_review            |
| `77`        | Inconsistent, reversed or repeated data                                        | invalid_request            | manual_review            |
| `78`        | Blocked: first use by a new cardholder, card not unblocked                     | card_declined              | customer_action_required |
| `79`        | Already reversed at the switch                                                 | duplicate_request          | do_not_retry             |
| `80`        | No financial impact (reversal response)                                        | unknown                    | manual_review            |
| `81`        | Cryptographic error                                                            | provider_unavailable       | retry_conditionally      |
| `82`        | CVV data incorrect, or offline PIN check interrupted                           | card_declined              | customer_action_required |
| `83`        | PIN cannot be verified                                                         | authentication_failed      | customer_action_required |
| `85`        | No reason to decline                                                           | n/a (approval)             | n/a                      |
| `86`        | PIN cannot be verified                                                         | authentication_failed      | customer_action_required |
| `91`        | Issuer or switch unavailable                                                   | provider_unavailable       | retry_conditionally      |
| `92`        | Destination not found                                                          | provider_unavailable       | retry_conditionally      |
| `93`        | Violation, cannot complete                                                     | fraud_or_risk              | do_not_retry             |
| `94`        | Cannot locate, no match                                                        | invalid_request            | manual_review            |
| `96`        | System malfunction                                                             | provider_unavailable       | retry_conditionally      |
| `A1`        | POS device authentication succeeded                                            | n/a (approval)             | n/a                      |
| `A2`        | POS device authentication failed                                               | configuration              | manual_review            |
| `A3`        | POS device deactivated                                                         | n/a (approval)             | n/a                      |
| `A8`        | Invalid region code                                                            | invalid_request            | do_not_retry             |
| `A9`        | Invalid country code                                                           | invalid_request            | do_not_retry             |
| `B1`        | Surcharge not permitted on debit cards or EBT food stamps                      | configuration              | do_not_retry             |
| `B2`        | Surcharge not supported by the debit network issuer                            | configuration              | do_not_retry             |
| `CV`        | Card type verification error                                                   | invalid_request            | customer_action_required |
| `D3`        | 3-D Secure cryptogram missing or invalid                                       | authentication_failed      | customer_action_required |
| `E1`        | Encryption not configured                                                      | configuration              | manual_review            |
| `E2`        | Terminal not authenticated                                                     | configuration              | manual_review            |
| `E3`        | Data could not be decrypted                                                    | configuration              | manual_review            |
| `EA`        | Verification error                                                             | unknown                    | manual_review            |
| `EB`        | Verification error                                                             | unknown                    | manual_review            |
| `EC`        | Verification error                                                             | unknown                    | manual_review            |
| `H1-H9`     | Contact merchant services or technical support                                 | configuration              | manual_review            |
| `HV`        | Hierarchy verification error                                                   | configuration              | manual_review            |
| `K0`        | Token request processed                                                        | n/a (approval)             | n/a                      |
| `K1`        | Tokenization not configured                                                    | configuration              | manual_review            |
| `K2`        | Terminal not authenticated                                                     | configuration              | manual_review            |
| `K3`        | Data could not be de-tokenized                                                 | configuration              | manual_review            |
| `M0`        | Canada-issued Mastercard domestic debit not allowed                            | payment_method_unavailable | customer_action_required |
| `N3`        | Cash back not available                                                        | payment_method_unavailable | do_not_retry             |
| `N4`        | Exceeds issuer withdrawal limit                                                | card_declined              | customer_action_required |
| `N7`        | Invalid CVV2                                                                   | card_declined              | customer_action_required |
| `P0-P6`     | Contact merchant services or technical support                                 | configuration              | manual_review            |
| `P7`        | Terminal boarding not complete (serial number not set up)                      | configuration              | manual_review            |
| `Q1`        | Card authentication failed                                                     | authentication_failed      | customer_action_required |
| `S0`        | PAN inactive                                                                   | card_declined              | customer_action_required |
| `S1`        | Mod-10 check failed                                                            | invalid_request            | customer_action_required |
| `S5`        | No preauthorization found                                                      | invalid_request            | do_not_retry             |
| `S9`        | Maximum working balance exceeded                                               | card_declined              | do_not_retry             |
| `SA`        | Authorization server shut down                                                 | provider_unavailable       | retry_conditionally      |
| `SB`        | Card status is not active                                                      | card_declined              | customer_action_required |
| `SC`        | Unknown dealer or store code                                                   | configuration              | manual_review            |
| `SD`        | Maximum number of recharges exceeded                                           | card_declined              | do_not_retry             |
| `SE`        | Card already used                                                              | card_declined              | do_not_retry             |
| `SF`        | Manual transactions not allowed                                                | configuration              | do_not_retry             |
| `SH`        | Unknown transaction type                                                       | invalid_request            | do_not_retry             |
| `SJ`        | Invalid tender type                                                            | invalid_request            | do_not_retry             |
| `SK`        | Invalid customer type                                                          | invalid_request            | do_not_retry             |
| `SL`        | PIN locked                                                                     | authentication_failed      | customer_action_required |
| `SM`        | Maximum number of redemptions exceeded                                         | card_declined              | do_not_retry             |
| `SP`        | Maximum number of PAN tries exceeded                                           | fraud_or_risk              | do_not_retry             |
| `SR`        | Card already issued                                                            | invalid_request            | do_not_retry             |
| `SS`        | Card not issued                                                                | invalid_request            | do_not_retry             |
| `T0`        | First check accepted and converted                                             | n/a (approval)             | n/a                      |
| `T1`        | Check accepted but not convertible (declined)                                  | card_declined              | customer_action_required |
| `T2`        | Invalid ABA number, not an ACH participant                                     | invalid_request            | customer_action_required |
| `T3`        | Amount above the limit                                                         | invalid_amount             | do_not_retry             |
| `V1`        | Daily threshold exceeded                                                       | card_declined              | retry_conditionally      |
| `Z6`        | Invalid use of MCC; correct and resubmit                                       | configuration              | do_not_retry             |
| `R0` (VSPS) | Customer stopped one recurring payment: skip this rebill, try the next one     | card_declined              | retry_conditionally      |
| `R1` (VSPS) | Customer stopped all recurring payments to the merchant: stop all              | card_declined              | do_not_retry             |
| `R3` (VSPS) | All recurring payments cancelled for the card: stop all; account may be closed | card_declined              | do_not_retry             |

#### 4.20 FRD processor responses: 129 codes, plus 3 VSPS codes

| Code         | Meaning (paraphrased)                                                   | Category (suggested)       | Retry (suggested)        |
| ------------ | ----------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `100`        | Approved                                                                | n/a (approval)             | n/a                      |
| `109`        | Transaction processed earlier                                           | duplicate_request          | do_not_retry             |
| `200`        | Suspected fraud                                                         | fraud_or_risk              | do_not_retry             |
| `201`        | Invalid card number                                                     | invalid_request            | customer_action_required |
| `202`        | Non-numeric amount                                                      | invalid_amount             | do_not_retry             |
| `203`        | Zero amount                                                             | invalid_amount             | do_not_retry             |
| `204`        | Other error                                                             | unknown                    | manual_review            |
| `205`        | Bad total authorization amount                                          | invalid_amount             | do_not_retry             |
| `206`        | Bad anticipated amount                                                  | invalid_amount             | do_not_retry             |
| `225`        | Invalid field data                                                      | invalid_request            | do_not_retry             |
| `227`        | Companion data missing                                                  | invalid_request            | do_not_retry             |
| `231`        | Invalid division number                                                 | configuration              | manual_review            |
| `236`        | Invalid region code                                                     | invalid_request            | do_not_retry             |
| `237`        | Invalid country code                                                    | invalid_request            | do_not_retry             |
| `238`        | Invalid currency                                                        | invalid_request            | do_not_retry             |
| `239`        | Payment method invalid for the division                                 | configuration              | manual_review            |
| `241`        | Illegal action                                                          | invalid_request            | do_not_retry             |
| `242`        | Invalid temporary services data                                         | invalid_request            | do_not_retry             |
| `243`        | Invalid level 3 purchase data                                           | invalid_request            | do_not_retry             |
| `244`        | Invalid encryption format                                               | configuration              | manual_review            |
| `245`        | Secure payment data missing or invalid                                  | authentication_failed      | customer_action_required |
| `246`        | Merchant not enabled for Mastercard SecureCode                          | configuration              | manual_review            |
| `248`        | Reserved field not blank                                                | invalid_request            | do_not_retry             |
| `249`        | Invalid MCC                                                             | configuration              | manual_review            |
| `253`        | Invalid transaction type                                                | invalid_request            | do_not_retry             |
| `257`        | Customer service phone missing                                          | invalid_request            | do_not_retry             |
| `258`        | Not authorized to send the record                                       | configuration              | manual_review            |
| `262`        | Invalid authorization code response date                                | invalid_request            | do_not_retry             |
| `263`        | Partial authorization not allowed or request not valid                  | configuration              | do_not_retry             |
| `264`        | Duplicate deposit                                                       | duplicate_request          | do_not_retry             |
| `272`        | Invalid level 2 purchase data                                           | invalid_request            | do_not_retry             |
| `274`        | Transaction not supported                                               | configuration              | do_not_retry             |
| `275`        | Invalid time                                                            | invalid_request            | do_not_retry             |
| `276`        | Invalid date                                                            | invalid_request            | do_not_retry             |
| `277`        | Split shipment not allowed for eCom debit                               | configuration              | do_not_retry             |
| `288`        | Merchant daily velocity block                                           | fraud_or_risk              | manual_review            |
| `289`        | Merchant 7-day velocity block                                           | fraud_or_risk              | manual_review            |
| `290`        | Merchant 30-day velocity block                                          | fraud_or_risk              | manual_review            |
| `291`        | Daily disbursement block on the card (funding)                          | fraud_or_risk              | manual_review            |
| `292`        | 7-day disbursement block on the card (funding)                          | fraud_or_risk              | manual_review            |
| `293`        | 30-day disbursement block on the card (funding)                         | fraud_or_risk              | manual_review            |
| `294`        | Daily disbursement block on the card (payment)                          | fraud_or_risk              | manual_review            |
| `295`        | 7-day disbursement block on the card (payment)                          | fraud_or_risk              | manual_review            |
| `296`        | 30-day disbursement block on the card (payment)                         | fraud_or_risk              | manual_review            |
| `297`        | Per-transaction disbursement limit exceeded                             | invalid_amount             | do_not_retry             |
| `298`        | Disbursement manually blocked (daily, 7 or 30 days)                     | fraud_or_risk              | manual_review            |
| `299`        | Duplicate transaction                                                   | duplicate_request          | do_not_retry             |
| `301`        | Issuer unavailable                                                      | provider_unavailable       | retry_conditionally      |
| `302`        | Credit floor                                                            | card_declined              | customer_action_required |
| `303`        | Processor decline                                                       | card_declined              | customer_action_required |
| `304`        | Not on file                                                             | invalid_request            | customer_action_required |
| `305`        | Already reversed                                                        | duplicate_request          | do_not_retry             |
| `306`        | Amount mismatch                                                         | invalid_amount             | do_not_retry             |
| `307`        | Authorization not found                                                 | invalid_request            | do_not_retry             |
| `350`        | Additional customer authentication required                             | authentication_required    | customer_action_required |
| `351`        | TransArmor service unavailable                                          | provider_unavailable       | retry_conditionally      |
| `352`        | Lock expired                                                            | unknown                    | manual_review            |
| `353`        | TransArmor token or PAN invalid                                         | invalid_request            | customer_action_required |
| `354`        | TransArmor invalid result                                               | provider_unavailable       | manual_review            |
| `370`        | Deferred authorization not cancelled                                    | unknown                    | manual_review            |
| `401`        | Call the issuer                                                         | card_declined              | customer_action_required |
| `402`        | Default call                                                            | card_declined              | customer_action_required |
| `420`        | Unsupported currency                                                    | invalid_request            | do_not_retry             |
| `430`        | Prepaid card amount above the EU AMLD limit                             | invalid_amount             | customer_action_required |
| `501`        | Pick up card                                                            | fraud_or_risk              | do_not_retry             |
| `502`        | Lost or stolen card                                                     | fraud_or_risk              | do_not_retry             |
| `503`        | Fraud or security violation                                             | fraud_or_risk              | do_not_retry             |
| `506`        | Invalid institution                                                     | invalid_request            | customer_action_required |
| `508`        | Too many PIN tries                                                      | authentication_failed      | customer_action_required |
| `509`        | Over limit                                                              | card_declined              | customer_action_required |
| `510`        | Over frequency limit                                                    | card_declined              | retry_conditionally      |
| `519`        | On negative file                                                        | fraud_or_risk              | do_not_retry             |
| `521`        | Insufficient funds                                                      | insufficient_funds         | customer_action_required |
| `522`        | Card expired                                                            | card_declined              | customer_action_required |
| `523`        | Encrypted data bad                                                      | configuration              | manual_review            |
| `530`        | Do not honor                                                            | card_declined              | customer_action_required |
| `531`        | CVV2 or VAK failure                                                     | card_declined              | customer_action_required |
| `546`        | Account blocked                                                         | card_declined              | do_not_retry             |
| `551`        | Duplicate transaction                                                   | duplicate_request          | do_not_retry             |
| `580`        | Account already activated                                               | duplicate_request          | do_not_retry             |
| `581`        | Cannot void                                                             | invalid_request            | do_not_retry             |
| `584`        | Issuance below minimum amount                                           | invalid_amount             | do_not_retry             |
| `585`        | No original authorization found                                         | invalid_request            | do_not_retry             |
| `586`        | Outstanding authorization, funds on hold                                | card_declined              | retry_conditionally      |
| `587`        | Activation amount incorrect                                             | invalid_amount             | do_not_retry             |
| `588`        | Block activation failed                                                 | provider_unavailable       | manual_review            |
| `589`        | CVD value failure                                                       | card_declined              | customer_action_required |
| `590`        | Maximum redemption limit reached                                        | card_declined              | do_not_retry             |
| `591`        | Invalid card number                                                     | invalid_request            | customer_action_required |
| `592`        | Bad amount                                                              | invalid_amount             | do_not_retry             |
| `594`        | Edit error                                                              | invalid_request            | do_not_retry             |
| `595`        | New card issued; deny                                                   | card_declined              | customer_action_required |
| `596`        | Suspected fraud                                                         | fraud_or_risk              | do_not_retry             |
| `602`        | Invalid institution code                                                | invalid_request            | customer_action_required |
| `603`        | Invalid institution                                                     | invalid_request            | customer_action_required |
| `606`        | Invalid transaction type                                                | invalid_request            | do_not_retry             |
| `607`        | Invalid amount                                                          | invalid_amount             | do_not_retry             |
| `610`        | BIN blocked                                                             | fraud_or_risk              | do_not_retry             |
| `611`        | Refer: new account                                                      | card_declined              | customer_action_required |
| `612`        | Retry with 3DS                                                          | authentication_required    | customer_action_required |
| `613`        | Retry later                                                             | card_declined              | retry_conditionally      |
| `614`        | Do not retry                                                            | card_declined              | do_not_retry             |
| `740`        | Match failed                                                            | invalid_request            | customer_action_required |
| `741`        | Validation failed                                                       | invalid_request            | customer_action_required |
| `752`        | Name missing                                                            | invalid_request            | customer_action_required |
| `753`        | Invalid account type                                                    | invalid_request            | customer_action_required |
| `754`        | Account closed                                                          | card_declined              | do_not_retry             |
| `755`        | No account or cannot locate                                             | invalid_request            | customer_action_required |
| `758`        | Account frozen                                                          | card_declined              | do_not_retry             |
| `760`        | Not an ACH participant                                                  | payment_method_unavailable | customer_action_required |
| `763`        | Invalid account number                                                  | invalid_request            | customer_action_required |
| `768`        | Bad account number data                                                 | invalid_request            | customer_action_required |
| `776`        | Duplicate check                                                         | duplicate_request          | do_not_retry             |
| `777`        | Original transaction not approved                                       | invalid_request            | do_not_retry             |
| `787`        | High-risk decline                                                       | fraud_or_risk              | do_not_retry             |
| `788`        | Refund larger than the original                                         | invalid_amount             | do_not_retry             |
| `802`        | Positive ID                                                             | unknown                    | manual_review            |
| `806`        | Restraint                                                               | card_declined              | manual_review            |
| `811`        | Invalid security code                                                   | card_declined              | customer_action_required |
| `813`        | Invalid PIN                                                             | authentication_failed      | customer_action_required |
| `818`        | No savings account                                                      | invalid_request            | customer_action_required |
| `825`        | No account                                                              | invalid_request            | customer_action_required |
| `833`        | Invalid merchant                                                        | configuration              | manual_review            |
| `834`        | Unauthorized user                                                       | configuration              | manual_review            |
| `842`        | Bad EAN, SCV or CSV                                                     | invalid_request            | customer_action_required |
| `902`        | Process unavailable                                                     | provider_unavailable       | retry_conditionally      |
| `903`        | Invalid expiry date                                                     | invalid_request            | customer_action_required |
| `904`        | Invalid effective date                                                  | invalid_request            | customer_action_required |
| `997`        | Acquirer error                                                          | provider_unavailable       | retry_conditionally      |
| `570` (VSPS) | Stop payment for one recurring or installment payment: skip this rebill | card_declined              | retry_conditionally      |
| `571` (VSPS) | Authorization revoked for all recurring or installments: stop all       | card_declined              | do_not_retry             |
| `572` (VSPS) | All authorizations revoked, account closed: stop all                    | card_declined              | do_not_retry             |

#### 4.21 VAN processor responses: 110 codes, plus 3 VSPS codes

| Code          | Meaning (paraphrased)                                       | Category (suggested)  | Retry (suggested)        |
| ------------- | ----------------------------------------------------------- | --------------------- | ------------------------ |
| `00`          | Approved                                                    | n/a (approval)        | n/a                      |
| `01`          | Refer to card issuer                                        | card_declined         | customer_action_required |
| `02`          | Refer to card issuer, special conditions                    | card_declined         | customer_action_required |
| `03`          | Invalid merchant ID                                         | configuration         | manual_review            |
| `04`          | Pick up card                                                | fraud_or_risk         | do_not_retry             |
| `05`          | Generic authorization decline                               | card_declined         | customer_action_required |
| `06`          | Error                                                       | provider_unavailable  | retry_conditionally      |
| `07`          | Pick up card, special conditions                            | fraud_or_risk         | do_not_retry             |
| `08`          | Honor with identification                                   | n/a (approval)        | n/a                      |
| `09`          | Approved, special conditions                                | n/a (approval)        | n/a                      |
| `10`          | Approved for a partial amount                               | n/a (approval)        | n/a                      |
| `11`          | VIP approval                                                | n/a (approval)        | n/a                      |
| `12`          | Invalid transaction                                         | card_declined         | do_not_retry             |
| `13`          | Invalid amount                                              | invalid_amount        | do_not_retry             |
| `14`          | Invalid account number                                      | invalid_request       | customer_action_required |
| `15`          | No such issuer                                              | invalid_request       | customer_action_required |
| `17 - Debit`  | Manual PAN tries exceeded (debit)                           | fraud_or_risk         | do_not_retry             |
| `17 - Credit` | Customer cancellation (credit)                              | card_declined         | customer_action_required |
| `19`          | Retry transaction                                           | card_declined         | retry_conditionally      |
| `20`          | Approved with overdraft                                     | n/a (approval)        | n/a                      |
| `21`          | Reversal unsuccessful                                       | provider_unavailable  | manual_review            |
| `25`          | Record not found on file                                    | invalid_request       | customer_action_required |
| `27`          | File update field edit error                                | invalid_request       | do_not_retry             |
| `28`          | Update file temporarily unavailable                         | provider_unavailable  | retry_conditionally      |
| `30`          | Message format error                                        | invalid_request       | do_not_retry             |
| `32`          | Partial reversal                                            | n/a (approval)        | n/a                      |
| `33`          | Pick up card: expired                                       | card_declined         | do_not_retry             |
| `38`          | PIN tries exceeded                                          | authentication_failed | customer_action_required |
| `39`          | No credit account                                           | invalid_request       | customer_action_required |
| `40`          | Requested function not supported                            | configuration         | do_not_retry             |
| `41`          | Pick up card: lost                                          | fraud_or_risk         | do_not_retry             |
| `43`          | Pick up card: stolen                                        | fraud_or_risk         | do_not_retry             |
| `46`          | Account closed                                              | card_declined         | do_not_retry             |
| `47`          | Remote function unknown                                     | invalid_request       | do_not_retry             |
| `51`          | Insufficient funds                                          | insufficient_funds    | customer_action_required |
| `52`          | No checking account                                         | invalid_request       | customer_action_required |
| `53`          | No savings account                                          | invalid_request       | customer_action_required |
| `54`          | Expired card                                                | card_declined         | customer_action_required |
| `55`          | Wrong PIN                                                   | authentication_failed | customer_action_required |
| `56`          | Cannot process                                              | provider_unavailable  | retry_conditionally      |
| `57`          | Not permitted to cardholder                                 | card_declined         | customer_action_required |
| `58`          | Not permitted to acquirer                                   | configuration         | do_not_retry             |
| `59`          | Suspected fraud                                             | fraud_or_risk         | do_not_retry             |
| `61`          | Exceeds withdrawal limit                                    | card_declined         | customer_action_required |
| `62`          | Restricted card                                             | card_declined         | customer_action_required |
| `63`          | Security violation or invalid Amex CID                      | card_declined         | customer_action_required |
| `65 - Debit`  | Daily card ticket limit exceeded (debit)                    | card_declined         | retry_conditionally      |
| `65 - Credit` | Withdrawal frequency limit exceeded (credit)                | card_declined         | retry_conditionally      |
| `67`          | Pick up card                                                | fraud_or_risk         | do_not_retry             |
| `68`          | Response received late                                      | network_or_timeout    | retry_conditionally      |
| `69`          | Bad close (gift card)                                       | invalid_request       | do_not_retry             |
| `70`          | Invalid transaction; card already active (gift card)        | invalid_request       | do_not_retry             |
| `71`          | Card not active (gift card)                                 | card_declined         | customer_action_required |
| `72`          | Card already closed (gift card)                             | card_declined         | do_not_retry             |
| `73`          | Over maximum balance (gift card)                            | invalid_amount        | do_not_retry             |
| `74`          | Invalid activation (gift card)                              | invalid_request       | do_not_retry             |
| `75`          | PIN tries exceeded                                          | authentication_failed | customer_action_required |
| `76`          | Late reversal                                               | unknown               | manual_review            |
| `77`          | Reversal does not match the original                        | invalid_request       | manual_review            |
| `78`          | No "to" account specified                                   | invalid_request       | do_not_retry             |
| `79`          | No "from" account specified                                 | invalid_request       | do_not_retry             |
| `80`          | Processor link down; stand-in processing used               | provider_unavailable  | manual_review            |
| `81`          | PIN key synchronization error                               | provider_unavailable  | manual_review            |
| `82`          | Invalid CVV                                                 | card_declined         | customer_action_required |
| `83`          | PIN cannot be verified                                      | authentication_failed | customer_action_required |
| `85`          | No reason to decline (verification)                         | n/a (approval)        | n/a                      |
| `86`          | PIN cannot be verified                                      | authentication_failed | customer_action_required |
| `87`          | Purchase approved, cash not                                 | n/a (approval)        | n/a                      |
| `88`          | Card record not available                                   | invalid_request       | customer_action_required |
| `89`          | Invalid authorization code                                  | invalid_request       | do_not_retry             |
| `91`          | Issuer or switch inoperative (Mastercard)                   | provider_unavailable  | retry_conditionally      |
| `92`          | Cannot route transaction                                    | provider_unavailable  | retry_conditionally      |
| `93`          | Illegal transaction                                         | fraud_or_risk         | do_not_retry             |
| `94`          | Duplicate transaction                                       | duplicate_request     | do_not_retry             |
| `95`          | Reconciliation error                                        | provider_unavailable  | manual_review            |
| `96`          | System error                                                | provider_unavailable  | retry_conditionally      |
| `97`          | American Express rewards approval                           | n/a (approval)        | n/a                      |
| `98`          | Duplicate transaction                                       | duplicate_request     | do_not_retry             |
| `99`          | Preferred debit routing denied; credit may run as debit     | configuration         | manual_review            |
| `D1`          | Currency conversion done, no authorization performed        | unknown               | manual_review            |
| `E1`          | P2PE decryption request invalid                             | configuration         | manual_review            |
| `E2`          | P2PE decryption services unavailable                        | provider_unavailable  | retry_conditionally      |
| `E3`          | P2PE decryption failure                                     | configuration         | manual_review            |
| `E4`          | P2PE decryption message malformed                           | configuration         | manual_review            |
| `E6`          | Possible P2PE decryption failure                            | configuration         | manual_review            |
| `E9`          | P2PE encryption required                                    | configuration         | manual_review            |
| `FS`          | Declined by FraudSight                                      | fraud_or_risk         | do_not_retry             |
| `N7`          | CVV2 mismatch                                               | card_declined         | customer_action_required |
| `M1`          | Multi-currency DCC failure                                  | provider_unavailable  | manual_review            |
| `M2`          | Multi-currency invert failure                               | provider_unavailable  | manual_review            |
| `N0`          | Issuer or switch inoperative (Visa)                         | provider_unavailable  | retry_conditionally      |
| `RG`          | P2PE registration succeeded                                 | n/a (approval)        | n/a                      |
| `V1`          | Velocity: too many transactions                             | fraud_or_risk         | retry_conditionally      |
| `V2`          | Velocity: amount too high                                   | fraud_or_risk         | retry_conditionally      |
| `V3`          | Velocity: count or amount too high                          | fraud_or_risk         | retry_conditionally      |
| `V4`          | Velocity: negative file exception                           | fraud_or_risk         | do_not_retry             |
| `V5`          | Velocity: fraud exception                                   | fraud_or_risk         | do_not_retry             |
| `V6`          | Velocity: ZIP match failure                                 | fraud_or_risk         | customer_action_required |
| `W1`          | More prompts required                                       | invalid_request       | do_not_retry             |
| `XE`          | Card escheated (gift card)                                  | card_declined         | do_not_retry             |
| `XD`          | Merchant depleted (gift card)                               | configuration         | manual_review            |
| `XB`          | Deconverted BIN (gift card)                                 | configuration         | manual_review            |
| `Q1`          | Chip failure                                                | card_declined         | customer_action_required |
| `T1`          | Invalid 3-D Secure password                                 | authentication_failed | customer_action_required |
| `T2`          | Invalid social security number                              | invalid_request       | customer_action_required |
| `T3`          | Invalid mother's maiden name                                | invalid_request       | customer_action_required |
| `T4`          | Enrollment inquiry declined                                 | authentication_failed | customer_action_required |
| `T5`          | Social security number not available                        | invalid_request       | customer_action_required |
| `T6`          | Mother's maiden name not available                          | invalid_request       | customer_action_required |
| `T7`          | PIN already on the database                                 | invalid_request       | do_not_retry             |
| `R0` (VSPS)   | Stop payment order: skip this rebill, try the next one      | card_declined         | retry_conditionally      |
| `R1` (VSPS)   | Authorization revoked: stop all further transactions        | card_declined         | do_not_retry             |
| `R3` (VSPS)   | All authorizations revoked: stop all; account may be closed | card_declined         | do_not_retry             |

#### 4.22 ACH return codes: 93 codes

| Code           | Meaning (paraphrased)                                     | Category (suggested)       | Retry (suggested)        |
| -------------- | --------------------------------------------------------- | -------------------------- | ------------------------ |
| `RT not found` | (no description given)                                    | unknown                    | unknown                  |
| `CONFIG`       | Client configuration problem                              | configuration              | manual_review            |
| `LIMIT`        | Maximum amount per check exceeded                         | invalid_amount             | do_not_retry             |
| `INVACCT`      | Invalid account type                                      | invalid_request            | customer_action_required |
| `INVDIR`       | Invalid direction                                         | invalid_request            | do_not_retry             |
| `NOPOP`        | Merchant not set up for POP (electronic check conversion) | configuration              | manual_review            |
| `PAPER`        | Paper draft that cannot be sent on paper                  | configuration              | manual_review            |
| `PARSE`        | Parsing problem                                           | invalid_request            | do_not_retry             |
| `THOMSON`      | Rejected by the Thomson database                          | fraud_or_risk              | manual_review            |
| `UNKMER`       | Unknown merchant                                          | configuration              | manual_review            |
| `DEMO`         | Demonstration transaction or merchant                     | configuration              | do_not_retry             |
| `R90`          | Invalid MOD digit                                         | invalid_request            | customer_action_required |
| `R91`          | Invalid ABA: not nine numeric characters                  | invalid_request            | customer_action_required |
| `R92`          | ABA not active                                            | invalid_request            | customer_action_required |
| `R93`          | Invalid transaction code and SEC combination              | invalid_request            | do_not_retry             |
| `R94`          | Invalid amount for a pre-note transaction code            | invalid_amount             | do_not_retry             |
| `R95`          | Amount is zero                                            | invalid_amount             | do_not_retry             |
| `R96`          | Invalid transaction code                                  | invalid_request            | do_not_retry             |
| `R97`          | Invalid SEC code                                          | invalid_request            | do_not_retry             |
| `R98`          | Account decryption error                                  | provider_unavailable       | manual_review            |
| `R99`          | Possible OFAC match                                       | fraud_or_risk              | manual_review            |
| `R37`          | Source document presented for payment                     | duplicate_request          | manual_review            |
| `R38`          | Stop payment on the source document                       | card_declined              | do_not_retry             |
| `R39`          | Improper source document                                  | invalid_request            | manual_review            |
| `R53`          | Item and ACH entry both presented for payment             | duplicate_request          | manual_review            |
| `R75`          | Original return was not a duplicate                       | unknown                    | manual_review            |
| `R76`          | No errors found                                           | unknown                    | manual_review            |
| `R83`          | Foreign receiving bank cannot settle                      | provider_unavailable       | manual_review            |
| `R84`          | Entry not processed by the gateway operator               | provider_unavailable       | manual_review            |
| `R01`          | Insufficient funds                                        | insufficient_funds         | retry_conditionally      |
| `R02`          | Account closed                                            | payment_method_unavailable | customer_action_required |
| `R03`          | No account or account cannot be found                     | invalid_request            | customer_action_required |
| `R04`          | Invalid account number                                    | invalid_request            | customer_action_required |
| `R05`          | Reserved                                                  | unknown                    | unknown                  |
| `R06`          | Returned at the originating bank's request                | unknown                    | manual_review            |
| `R07`          | Authorization revoked by the customer                     | card_declined              | do_not_retry             |
| `R08`          | Stop payment                                              | card_declined              | do_not_retry             |
| `R09`          | Uncollected funds                                         | insufficient_funds         | retry_conditionally      |
| `R10`          | Customer says the debit was not authorized                | fraud_or_risk              | manual_review            |
| `R11`          | Check truncation entry return                             | unknown                    | manual_review            |
| `R12`          | Branch sold to another bank                               | invalid_request            | customer_action_required |
| `R13`          | Receiving bank not qualified or route invalid             | invalid_request            | customer_action_required |
| `R14`          | Payee deceased                                            | card_declined              | do_not_retry             |
| `R15`          | Beneficiary deceased                                      | card_declined              | do_not_retry             |
| `R16`          | Account frozen                                            | card_declined              | do_not_retry             |
| `R17`          | File record edit criteria                                 | invalid_request            | manual_review            |
| `R18`          | Improper effective entry date                             | invalid_request            | do_not_retry             |
| `R19`          | Amount field error                                        | invalid_amount             | do_not_retry             |
| `R20`          | Non-transaction account                                   | payment_method_unavailable | customer_action_required |
| `R21`          | Invalid company identification                            | invalid_request            | do_not_retry             |
| `R22`          | Invalid individual ID number                              | invalid_request            | customer_action_required |
| `R23`          | Receiver refused the credit                               | card_declined              | do_not_retry             |
| `R24`          | Duplicate entry                                           | duplicate_request          | do_not_retry             |
| `R25`          | Addenda error                                             | invalid_request            | do_not_retry             |
| `R26`          | Mandatory field error                                     | invalid_request            | do_not_retry             |
| `R27`          | Trace number error                                        | invalid_request            | do_not_retry             |
| `R28`          | Routing number check digit error                          | invalid_request            | customer_action_required |
| `R29`          | Corporate customer says not authorized                    | fraud_or_risk              | manual_review            |
| `R30`          | Receiving bank not in truncation program                  | payment_method_unavailable | manual_review            |
| `R31`          | Permissible return entry                                  | unknown                    | manual_review            |
| `R32`          | Receiving bank cannot settle                              | provider_unavailable       | manual_review            |
| `R33`          | Return of XCK entry                                       | unknown                    | manual_review            |
| `R34`          | Receiving bank has limited participation                  | payment_method_unavailable | manual_review            |
| `R35`          | Return of an improper debit entry                         | invalid_request            | manual_review            |
| `R36`          | Return of an improper credit entry                        | invalid_request            | manual_review            |
| `R40`          | ENR entry returned by a federal agency                    | unknown                    | manual_review            |
| `R41`          | Invalid transaction code                                  | invalid_request            | do_not_retry             |
| `R42`          | Routing number or check digit error                       | invalid_request            | customer_action_required |
| `R43`          | Invalid bank account number                               | invalid_request            | customer_action_required |
| `R44`          | Invalid individual ID number                              | invalid_request            | customer_action_required |
| `R45`          | Invalid individual or company name                        | invalid_request            | customer_action_required |
| `R46`          | Invalid representative payee indicator                    | invalid_request            | do_not_retry             |
| `R47`          | Duplicate enrollment                                      | duplicate_request          | do_not_retry             |
| `R50`          | State law affects RCK acceptance                          | configuration              | do_not_retry             |
| `R51`          | Item not eligible (RCK)                                   | invalid_request            | do_not_retry             |
| `R52`          | Stop payment on the item (RCK)                            | card_declined              | do_not_retry             |
| `R61`          | Dishonored return                                         | unknown                    | manual_review            |
| `R62`          | Dishonored return                                         | unknown                    | manual_review            |
| `R63`          | Dishonored return                                         | unknown                    | manual_review            |
| `R64`          | Dishonored return                                         | unknown                    | manual_review            |
| `R65`          | Dishonored return                                         | unknown                    | manual_review            |
| `R66`          | Dishonored return                                         | unknown                    | manual_review            |
| `R67`          | Dishonored return                                         | unknown                    | manual_review            |
| `R68`          | Dishonored return                                         | unknown                    | manual_review            |
| `R69`          | Dishonored return                                         | unknown                    | manual_review            |
| `R70`          | Dishonored return                                         | unknown                    | manual_review            |
| `R71`          | Contested dishonored return                               | unknown                    | manual_review            |
| `R72`          | Contested dishonored return                               | unknown                    | manual_review            |
| `R73`          | Contested dishonored return                               | unknown                    | manual_review            |
| `R74`          | Contested dishonored return                               | unknown                    | manual_review            |
| `R80`          | Cross-border payment coding error                         | invalid_request            | do_not_retry             |
| `R81`          | Not a cross-border participant                            | payment_method_unavailable | do_not_retry             |
| `R82`          | Invalid foreign receiving bank ID                         | invalid_request            | do_not_retry             |

#### 4.23 BACS return codes: 65 codes

| Code | Meaning (paraphrased)                                                                     | Category (suggested)       | Retry (suggested)        |
| ---- | ----------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `YE` | Transaction code not authorised for the originating account                               | configuration              | manual_review            |
| `0`  | Refer to payer                                                                            | card_declined              | customer_action_required |
| `1`  | Instruction cancelled by the payer                                                        | card_declined              | do_not_retry             |
| `2`  | Payer deceased                                                                            | card_declined              | do_not_retry             |
| `3`  | Account transferred                                                                       | invalid_request            | customer_action_required |
| `4`  | Advance notice disputed                                                                   | fraud_or_risk              | manual_review            |
| `5`  | No account                                                                                | invalid_request            | customer_action_required |
| `6`  | No instruction                                                                            | invalid_request            | customer_action_required |
| `7`  | Amount differs                                                                            | invalid_amount             | manual_review            |
| `8`  | Amount not yet due                                                                        | invalid_request            | manual_review            |
| `9`  | Presentation overdue                                                                      | invalid_request            | manual_review            |
| `A`  | Service user differs                                                                      | invalid_request            | manual_review            |
| `B`  | Account closed                                                                            | payment_method_unavailable | customer_action_required |
| `E`  | Instruction amended                                                                       | invalid_request            | manual_review            |
| `AE` | Originating sort code or account invalid (bank originated)                                | configuration              | manual_review            |
| `BE` | Originating sort code or account invalid (customer originated)                            | configuration              | manual_review            |
| `CE` | Destination and originating sort code or account invalid (bank originated)                | invalid_request            | manual_review            |
| `DE` | Destination and originating sort code or account invalid (customer originated)            | invalid_request            | manual_review            |
| `EE` | Destination sort code invalid                                                             | invalid_request            | customer_action_required |
| `FE` | Account type and originating sort code or account invalid (bank originated)               | invalid_request            | manual_review            |
| `GE` | Account type and originating sort code or account invalid (customer originated)           | invalid_request            | manual_review            |
| `HE` | Destination sort code, account type and originating details invalid (bank originated)     | invalid_request            | manual_review            |
| `IE` | Destination sort code, account type and originating details invalid (customer originated) | invalid_request            | manual_review            |
| `JE` | Destination sort code and account type invalid                                            | invalid_request            | customer_action_required |
| `KE` | Account type invalid                                                                      | invalid_request            | customer_action_required |
| `LE` | Destination account number, name and other fields invalid                                 | invalid_request            | customer_action_required |
| `ME` | Destination account number and name invalid                                               | invalid_request            | customer_action_required |
| `NE` | Contra record amended                                                                     | unknown                    | manual_review            |
| `OE` | Reference number invalid                                                                  | invalid_request            | do_not_retry             |
| `PE` | Originating account does not support the file currency                                    | configuration              | manual_review            |
| `QE` | Automated reversal after an error                                                         | unknown                    | manual_review            |
| `RE` | Reversal of another item on the same day                                                  | unknown                    | manual_review            |
| `SE` | Automated recall                                                                          | unknown                    | manual_review            |
| `TE` | Originating account replaced by the default account, which lacks the file currency        | configuration              | manual_review            |
| `UE` | Unpaid direct debit reference in error (bank originated)                                  | invalid_request            | manual_review            |
| `XE` | Originator service user number invalid (bank originated)                                  | configuration              | manual_review            |
| `ZE` | Unpaid direct debit reference and other fields in error (bank originated)                 | invalid_request            | manual_review            |
| `1I` | Amount or date differs from the advance notice (indemnity claim)                          | fraud_or_risk              | manual_review            |
| `2I` | No advance notice, or amount disputed (indemnity claim)                                   | fraud_or_risk              | manual_review            |
| `3I` | Direct Debit Instruction cancelled by the paying bank (indemnity claim)                   | card_declined              | do_not_retry             |
| `4I` | Payer cancelled the instruction with the service user (indemnity claim)                   | card_declined              | do_not_retry             |
| `5I` | No instruction held; payer disputes giving authority (AUDDIS users)                       | fraud_or_risk              | manual_review            |
| `6I` | Signature fraudulent or not per the account mandate (AUDDIS users)                        | fraud_or_risk              | manual_review            |
| `7I` | Claim raised at the service user's request after collection                               | unknown                    | manual_review            |
| `8I` | Payer does not recognise the service user name                                            | fraud_or_risk              | manual_review            |
| `CC` | Requested by the originator                                                               | unknown                    | manual_review            |
| `0C` | Invalid details                                                                           | invalid_request            | customer_action_required |
| `2C` | Beneficiary deceased                                                                      | card_declined              | do_not_retry             |
| `3C` | Account transferred                                                                       | invalid_request            | customer_action_required |
| `5C` | No account                                                                                | invalid_request            | customer_action_required |
| `BC` | Account closed                                                                            | payment_method_unavailable | customer_action_required |
| `C`  | Account moved to another branch                                                           | invalid_request            | customer_action_required |
| `D`  | Advance notice disputed                                                                   | fraud_or_risk              | manual_review            |
| `F`  | Invalid account type                                                                      | invalid_request            | customer_action_required |
| `G`  | Bank does not accept Direct Debits on the account                                         | payment_method_unavailable | customer_action_required |
| `H`  | Instruction expired                                                                       | invalid_request            | customer_action_required |
| `I`  | Payer reference not unique                                                                | invalid_request            | do_not_retry             |
| `K`  | Instruction cancelled by the paying bank                                                  | card_declined              | do_not_retry             |
| `L`  | Incorrect payer account details                                                           | invalid_request            | customer_action_required |
| `M`  | Transaction code incompatible with user status                                            | configuration              | manual_review            |
| `N`  | Transaction not allowed at the payer's branch                                             | payment_method_unavailable | customer_action_required |
| `O`  | Invalid reference                                                                         | invalid_request            | do_not_retry             |
| `P`  | Payer name missing                                                                        | invalid_request            | customer_action_required |
| `Q`  | Service user name blank                                                                   | configuration              | manual_review            |
| `R`  | Instruction reinstated (up to 2 months after cancellation)                                | unknown                    | manual_review            |

#### 4.24 EFT return codes: 46 codes

| Code  | Meaning (paraphrased)                                                         | Category (suggested)       | Retry (suggested)        |
| ----- | ----------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `900` | Validation rejection                                                          | invalid_request            | manual_review            |
| `901` | Insufficient funds (debits only)                                              | insufficient_funds         | retry_conditionally      |
| `902` | Cannot trace                                                                  | invalid_request            | manual_review            |
| `903` | Payment stopped or recalled                                                   | card_declined              | do_not_retry             |
| `904` | Post-dated or stale-dated                                                     | invalid_request            | do_not_retry             |
| `905` | Account closed                                                                | payment_method_unavailable | customer_action_required |
| `906` | Account transferred                                                           | invalid_request            | customer_action_required |
| `907` | No chequing privileges                                                        | payment_method_unavailable | customer_action_required |
| `908` | Funds not cleared                                                             | insufficient_funds         | retry_conditionally      |
| `909` | Currency and account mismatch                                                 | invalid_request            | customer_action_required |
| `910` | Payor or payee deceased                                                       | card_declined              | do_not_retry             |
| `911` | Account frozen                                                                | card_declined              | do_not_retry             |
| `912` | Invalid or incorrect account number                                           | invalid_request            | customer_action_required |
| `914` | Incorrect payor or payee name                                                 | invalid_request            | customer_action_required |
| `915` | Refused by payor or payee                                                     | card_declined              | do_not_retry             |
| `916` | Not per agreement (personal)                                                  | fraud_or_risk              | manual_review            |
| `917` | Agreement revoked (personal)                                                  | card_declined              | do_not_retry             |
| `918` | No pre-notification (personal)                                                | fraud_or_risk              | manual_review            |
| `919` | Not per agreement (business)                                                  | fraud_or_risk              | manual_review            |
| `920` | Agreement revoked (business)                                                  | card_declined              | do_not_retry             |
| `921` | No pre-notification (business)                                                | fraud_or_risk              | manual_review            |
| `922` | Customer-initiated return, credit only                                        | unknown                    | manual_review            |
| `990` | Institution in default                                                        | provider_unavailable       | manual_review            |
| `998` | No return agreement                                                           | configuration              | manual_review            |
| `4`   | Transaction type invalid or blank (refers to an "Appendix 3" not on the page) | invalid_request            | do_not_retry             |
| `5`   | Amount blank or not above zero                                                | invalid_amount             | do_not_retry             |
| `6`   | Due date invalid or blank                                                     | invalid_request            | do_not_retry             |
| `7`   | Institution route or transit wrong, missing or unknown                        | invalid_request            | customer_action_required |
| `8`   | Account number format not valid for the institution                           | invalid_request            | customer_action_required |
| `9`   | Item trace number invalid                                                     | invalid_request            | do_not_retry             |
| `10`  | Stored transaction type invalid or blank                                      | invalid_request            | do_not_retry             |
| `11`  | Originator short name blank                                                   | configuration              | do_not_retry             |
| `12`  | Payor or payee name blank                                                     | invalid_request            | customer_action_required |
| `13`  | Originator long name blank                                                    | configuration              | do_not_retry             |
| `14`  | Originating direct clearer ID invalid or blank                                | configuration              | do_not_retry             |
| `15`  | Cross reference blank                                                         | invalid_request            | do_not_retry             |
| `16`  | Institution for returns invalid or blank                                      | configuration              | do_not_retry             |
| `19`  | Original item trace number invalid or blank                                   | invalid_request            | do_not_retry             |
| `21`  | Data element ID invalid or blank                                              | invalid_request            | do_not_retry             |
| `E`   | File accepted with errors noted                                               | unknown                    | manual_review            |
| `M`   | File rejected: MAC check failed                                               | configuration              | manual_review            |
| `P`   | File partly accepted: at least one set rejected                               | unknown                    | manual_review            |
| `R`   | File rejected                                                                 | unknown                    | manual_review            |
| `W`   | File rejected: assurance failed validity tests                                | configuration              | manual_review            |
| `X`   | File rejected: content unreadable after decryption                            | configuration              | manual_review            |
| `TR`  | Rejected by 824                                                               | unknown                    | manual_review            |

#### 4.25 SEPA return codes: 36 codes

| Code   | Meaning (paraphrased)                                      | Category (suggested)       | Retry (suggested)        |
| ------ | ---------------------------------------------------------- | -------------------------- | ------------------------ |
| `AC01` | Account identifier incorrect                               | invalid_request            | customer_action_required |
| `UPAY` | Undue payment                                              | unknown                    | manual_review            |
| `AC06` | Account blocked                                            | card_declined              | do_not_retry             |
| `AC13` | Invalid debtor account type                                | invalid_request            | customer_action_required |
| `AG01` | Direct debit forbidden on the account                      | payment_method_unavailable | customer_action_required |
| `AG02` | Invalid bank operation code                                | invalid_request            | do_not_retry             |
| `AGNT` | Incorrect agent                                            | invalid_request            | manual_review            |
| `AM04` | Insufficient funds                                         | insufficient_funds         | retry_conditionally      |
| `AM05` | Duplication                                                | duplicate_request          | do_not_retry             |
| `BE04` | Creditor address missing                                   | configuration              | do_not_retry             |
| `BE05` | Creditor not recognised                                    | configuration              | manual_review            |
| `CURR` | Incorrect currency                                         | invalid_request            | do_not_retry             |
| `CUST` | Recalled by the customer                                   | card_declined              | do_not_retry             |
| `CUTA` | Recalled because of an investigation request               | unknown                    | manual_review            |
| `DT01` | Invalid date                                               | invalid_request            | do_not_retry             |
| `DUPL` | Duplicate payment                                          | duplicate_request          | do_not_retry             |
| `ED05` | Settlement failed                                          | provider_unavailable       | manual_review            |
| `FF01` | Invalid file format                                        | invalid_request            | do_not_retry             |
| `FF05` | Direct debit type incorrect                                | invalid_request            | do_not_retry             |
| `FRAD` | Fraud                                                      | fraud_or_risk              | do_not_retry             |
| `MD01` | No valid mandate                                           | card_declined              | do_not_retry             |
| `MD02` | Mandate data missing or incorrect                          | invalid_request            | manual_review            |
| `MD06` | Debtor disputes an authorized transaction (refund request) | fraud_or_risk              | manual_review            |
| `MD07` | Debtor deceased                                            | card_declined              | do_not_retry             |
| `MS02` | Refused by the debtor                                      | card_declined              | do_not_retry             |
| `MS03` | No reason given                                            | unknown                    | manual_review            |
| `PY01` | Not routable                                               | invalid_request            | manual_review            |
| `RC01` | Bank identifier incorrect                                  | invalid_request            | customer_action_required |
| `RR01` | Debtor account or identification missing                   | invalid_request            | manual_review            |
| `RR02` | Debtor name or address missing                             | invalid_request            | manual_review            |
| `RR03` | Creditor name or address missing                           | configuration              | manual_review            |
| `RR04` | Regulatory reason                                          | fraud_or_risk              | manual_review            |
| `SL01` | Specific service offered by the debtor bank                | unknown                    | manual_review            |
| `TECH` | Technical problem                                          | provider_unavailable       | manual_review            |
| `TM01` | Invalid cut-off time                                       | invalid_request            | manual_review            |
| `AC04` | Account closed                                             | payment_method_unavailable | customer_action_required |

#### 4.26 Client-side SDK codes (Paysafe JS and Apple Pay through Paysafe JS): 97 distinct codes, listed by group

Sources: D/api-docs/paysafe-js/tokenize/ (19 codes), D/api-docs/paysafe-js/setup-function/ (28 codes), D/api-docs/payments-api/add-payment-methods/apple-pay/apple-pay-paysafe-js-error-codes/ (68 codes); 97 distinct values in total. They are returned to browser callbacks as `{code, displayMessage, detailedMessage, correlationId}`, not in server payloads, so they are summarized by group instead of row by row. Every code value is listed.

| Group                                      | Codes                                                                                                                                                                                                                                                                                                          | Meaning (paraphrased)                                                                                                                                                                                   | Category (suggested)       | Retry (suggested)        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| Connection and server communication        | `9001`, `9002`, `9014`, `9208`                                                                                                                                                                                                                                                                                 | No connection, unreadable server response, unhandled error, error raised by the API                                                                                                                     | provider_unavailable       | retry_conditionally      |
| Invalid card or 3DS fields at tokenization | `9003`                                                                                                                                                                                                                                                                                                         | One or more fields invalid (front-end checks, or `5068` / `7508` from the APIs behind the SDK)                                                                                                          | invalid_request            | customer_action_required |
| SDK setup and integration arguments        | `9004`, `9005`, `9006`, `9007`, `9008`, `9009`, `9010`, `9011`, `9012`, `9013`, `9015`, `9016`, `9017`, `9018`, `9019`, `9021`, `9022`, `9023`, `9024`, `9025`, `9026`, `9027`, `9028`, `9029`, `9030`, `9031`, `9032`, `9033`, `9078`, `9079`, `9082`, `9087`, `9091`, `9092`, `9093`, `9097`, `9209`, `9210` | Wrong arguments, options, selectors, styles, environment, events or callbacks; iframes failed to initialize                                                                                             | configuration              | do_not_retry             |
| Merchant account setup                     | `9055`, `9061`, `9073`, `9111`, `9207`, `9212`, `9213`                                                                                                                                                                                                                                                         | Invalid currency, account ID or payment method; account not configured; no account for the currency                                                                                                     | configuration              | do_not_retry             |
| Customer, billing and shipping data        | `9043`, `9044`, `9045`, `9046`, `9047`, `9048`, `9049`, `9050`, `9054`, `9115`, `9116`, `9117`, `9118`, `9119`, `9120`, `9121`, `9122`, `9204`, `9205`, `9206`, `9211`, `9214`, `9215`, `9216`, `9217`, `9218`, `9219`                                                                                         | Holder name, billing or shipping fields, amount, descriptor, merchant reference or profile fields invalid                                                                                               | invalid_request            | do_not_retry             |
| 3D Secure                                  | `9037`, `9039`, `9040`, `9041`, `9042`, `9110`, `9114`, `9125`                                                                                                                                                                                                                                                 | 3DS server unreachable, card not enrolled, authentication not accepted, no PaRes, customer aborted, 3DS SDK start or challenge failed, card brand not in the 3DS setup                                  | authentication_failed      | customer_action_required |
| Apple Pay and Google Pay                   | `9080`, `9083`, `9086`, `9088`, `9089`, `9138`                                                                                                                                                                                                                                                                 | Page not on HTTPS, wallet data unreadable, wallet not available or domain not validated, buttons cannot be shown, Apple merchant validation failed, invalid completion status                           | payment_method_unavailable | do_not_retry             |
| Codes with two meanings                    | `9072`, `9099`                                                                                                                                                                                                                                                                                                 | `9072`: accessibility error message not a string (setup page) or Apple domain not verified (tokenize page). `9099`: invalid threshold (setup page) or payment handle status not usable (Apple Pay page) | configuration              | do_not_retry             |
| Payment handle and risk                    | `9131`, `9220`, `9221`, `9222`                                                                                                                                                                                                                                                                                 | Payment handle creation failed; card likely to be declined based on past records (transaction salvage); salvage object required; valid simulator required                                               | fraud_or_risk              | customer_action_required |

#### 4.27 Other documented value sets (not counted as codes)

- **PayPal status mapping** (PayPal error codes page): PayPal payment `Completed` maps to Paysafe `COMPLETED`; `Declined` and `Failed` map to `FAILED`; `Pending` maps to `PROCESSING`, with PayPal reason values `BUYER_COMPLAINT`, `CHARGEBACK`, `ECHECK`, `INTERNATIONAL_WITHDRAWAL`, `PENDING_REVIEW`, `OTHER`, `RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION`, `REFUNDED`, `TRANSACTION_APPROVED_AWAITING_FUNDING`, `UNILATERAL`, `VERIFICATION_REQUIRED`. PayPal payouts: `PENDING` and `PROCESSING` map to `PROCESSING`, `SUCCESS` to `COMPLETED`, `DENIED` to `Failed` (spelled that way). The page also lists a "Paysafe Status Code" of 201 or 200 per row; its meaning is **NOT DOCUMENTED**.
- **Interchecks standalone credit outcomes** (OpenAPI "Standalone Credits Failure Cases"): `Canceled`, `PENDING_KYC` (amount above a threshold, KYC needed), `PAID`, `FAILED`, in a column headed "HTTP Status" with test amounts in a column headed "Amount" (section 10).
- **Registration error codes** (OpenAPI): `5068` (name format, or a blocked throwaway email) and `5284` (registration already exists for the email). **Add Card error codes** (OpenAPI): `ERR_CARD_INELIGIBLE`, `ERR_RETRIEVING_CARD_DETAILS`, `ERR_CREDIT_CARD_NOT_SUPPORTED`, each tied to sample card numbers, returned with HTTP 400 (the Interchecks tables give other statuses for the same names). **ForumPay error codes** (OpenAPI): `1000`, `1001`, `1002` ("Database Error"), `5068`. All already counted in 4.1, 4.2 or 4.13.
- **Simulator amounts** (simulating card payments page): minor-unit amounts 4, 5, 6, 11, 12, 13, 20, 23, 24, 25 and 77 return codes `3015`, `3009`, `1007`, `3022`, `3023`, `3024`, `1007`, `4002`, `3007`, `4001` and `3060`; 90 to 95 approve after a 5 to 30 second delay; 96 times out after 30 seconds with `1007`.
- **Card types** (`cardType`): `AM`, `DI`, `JC`, `MC`, `MD`, `SO`, `VI`, `VD`, `VE` (Payments API); the legacy Cards API page uses `DC` for Discover.
- **3DS outcome table** (3DS page): `threeDResult` `Y` and `A` with a CAVV make the handle `PAYABLE` (issuer liability); `N`, `R` and `U` make it `FAILED` (merchant liability). ECI values by brand: Mastercard `2` / `1` / `0`, Visa and Amex `5` / `6` / `7`.

#### 4.28 Count summary

| Table                                       | Values    |
| ------------------------------------------- | --------- |
| 4.1 common errors                           | 39        |
| 4.2 payment and authorization errors        | 75        |
| 4.3 AVS sub-values of `3007`                | 20        |
| 4.4 void errors                             | 8         |
| 4.5 settlement errors                       | 8         |
| 4.6 refund errors                           | 21        |
| 4.7 Customer Vault errors                   | 18        |
| 4.8 alternate payments errors               | 20        |
| 4.9 Direct Debit errors                     | 9         |
| 4.10 payment handle 3DS codes               | 27        |
| 4.11 merchant advice codes                  | 15        |
| 4.12 ISO response codes                     | 40        |
| 4.13 Interchecks names                      | 49        |
| 4.14 Interchecks issuer reasons             | 64        |
| 4.15 SafetyPay codes                        | 13        |
| 4.16 PayPal error names                     | 93        |
| 4.17 OPN/NAG processor codes (60 + 1 VSPS)  | 61        |
| 4.18 MON processor codes (43 + 3 VSPS)      | 46        |
| 4.19 TAS/VPS processor codes (105 + 3 VSPS) | 108       |
| 4.20 FRD processor codes (129 + 3 VSPS)     | 132       |
| 4.21 VAN processor codes (110 + 3 VSPS)     | 113       |
| 4.22 ACH return codes                       | 93        |
| 4.23 BACS return codes                      | 65        |
| 4.24 EFT return codes                       | 46        |
| 4.25 SEPA return codes                      | 36        |
| **Total**                                   | **1,219** |
| Not counted: client-side SDK codes (4.26)   | 97        |

Values are counted per table; a few numeric codes repeat across tables (for example `4002`, `5068`, `1001`), and the TAS/VPS rows `H1-H9` and `P0-P6` are ranges listed as one row each.

### 5. Lifecycle

Payment handles, card payments, APM payments, payouts and direct debits are documented separately and should stay separate in the adapter.

#### 5.1 Payment handle

- A payment handle is a token for the customer's payment instrument and profile. It is required for payments, payouts (standalone and original credits) and verifications, not for settlements, refunds or cancellations (get-started page). "You must create a separate payment handle for each transaction type."
- `transactionType` of the handle: `PAYMENT`, `STANDALONE_CREDIT`, `ORIGINAL_CREDIT`, `VERIFICATION`.
- Single-use handle states (get-started page): `INITIATED` (created, redirect pending), `PAYABLE` (ready; set after authentication or redirect), `COMPLETED` (used in a payment or payout), `EXPIRED`, `FAILED`, `CANCELLED`, `ERROR` (could not be created). The OpenAPI enum lists `INITIATED`, `PAYABLE`, `PROCESSING` (customer authorized, waiting for the PSP), `FAILED`, `EXPIRED`, `COMPLETED`.
- "Regardless of the payments call response status, the payment handle status always changes to COMPLETED when a payments call is made" (card and EPS webhook pages). A `COMPLETED` handle therefore says nothing about the payment outcome.
- Time to live: typically 15 minutes (`timeToLiveSeconds`); 299 seconds for card 3DS handles. Multi-use handles (cards, PaysafeCash, BACS, SEPA) do not expire, except PaysafeCash multi-use handles, which can be `EXPIRED`.
- `executionMode` `SYNCHRONOUS` (poll `PROCESSING` / `PENDING`) or `ASYNCHRONOUS` (result may take hours or days, for example PaysafeCash; use webhooks).
- If the merchant does not call `/payments` in time for some APMs, the handle expires with `statusReason` `AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE`, meaning "Paysafe system is going to make /payments call on your behalf" (SafetyPay webhook page), or with `AUTH_EXPIRED`.

#### 5.2 Card payments

- `POST /payments` with a `PAYABLE` handle. `settleWithAuth` `true` authorizes and settles in one call; `false` authorizes only (`availableToSettle` = authorized amount). `preAuth` exists in responses.
- Payment `status`: `RECEIVED`, `PROCESSING`, `PENDING`, `HELD` (risk hold), `COMPLETED`, `FAILED`, `CANCELLED` (fully voided).
- Settlement: `POST /payments/{paymentId}/settlements`, full or partial (errors `3202` to `3204` police the amounts). A settlement is `PENDING` until batched ("Our system has received the settlement request, but it has not yet batched", event `SETTLEMENT_PENDING`); then `PROCESSING` ("The settlement batch has started") and `COMPLETED`. Cancel with `PUT /settlements/{settlementId}` and `status` `CANCELLED` only for `CARD` in `PENDING`, before Paysafe's batch, "typically at the end of the business day" (chargebacks page).
- Void (authorization reversal): `POST /payments/{paymentId}/voidauths`, only before settlement (`3502`); partial voids depend on the gateway (`3504`, `3507`).
- Refund: `POST /settlements/{settlementId}/refunds` (the OpenAPI endpoint table writes `/payments/{settlement_id}/refunds`), only after batching (`3406`), partial or full up to `availableToRefund`; cancel with `PUT /refunds/{refundId}` while pending (`3415`).
- Partial authorization (`partialAuth`): up to three authorizations within one hour grouped by `groupId`; the merchant must reverse them if the total is not reached (OpenAPI `partialAuth` description).
- Verification: `POST /verifications` (zero-amount card check); `status` `COMPLETED`, `FAILED` (HTTP 402 business decline) or `ERROR`.
- Cancel payment: `PUT /payments/{paymentId}` with `status` `CANCELLED` exists only for PaysafeCash payments in `PROCESSING`.

#### 5.3 APM payments

- One-step methods: "corresponding Payment and Settlement resources are created simultaneously ... Both resources utilize the same unique GUID", and the payment shows the same status as the settlement (settlement flow page).
- Two-step methods: the payment status shows the authorization only; "the merchant must separately check the status of the Settlement to confirm funds have been appropriately transitioned".
- Typical webhook sequence (EPS page): handle `PROCESSING` (customer redirected), handle `PAYABLE` (customer authorized at the bank), then the merchant calls `/payments`; handle `COMPLETED` and payment `COMPLETED` or `FAILED`; or handle `FAILED` (customer did not authorize) or `EXPIRED` (not used within the TTL).
- Redirect flows are strongly recommended to use webhooks: Skrill, PaysafeCard, PaysafeCash, PayPal, Interac, VIP Preferred, Play+ (Sightline) (configure webhooks page).

#### 5.4 Payouts

- **Standalone credit** (`/standalonecredits`): payout to a payment instrument without a previous payment; card payouts can go through Interchecks (`processor`, `onHold`, `PATCH` to update). Statuses `RECEIVED`, `INITIATED`, `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED` (plus `ERROR` and `HELD` in webhook names). Pay by Bank adds `SA_CREDIT_RETURN_COMPLETED`: "initially completed, but a payout return notification was later received from the bank". Rapid Transfer: `SA_CREDIT_CANCELLED` "triggered when the transaction was canceled after it was completed"; `SA_CREDIT_FAILED` "initially completed and later failed due to some settlement error". A timeline must allow `COMPLETED` to be followed by a failure, cancellation or return.
- **Original credit** (`/originalcredits`, card only): statuses as above.

#### 5.5 Direct debit and mandates

- BACS and SEPA use multi-use handles with mandates. Mandate `status` `PENDING`, `ACTIVE`, `CANCELLED`, `INACTIVE` with `statusReason` values in 3.3. "Once the status of MANDATE is ACTIVE after 7 days, payment status will become COMPLETED and a webhook notification will be sent" (OpenAPI Process Payment description).
- Bank returns (section 4.22 to 4.25) can arrive up to about 7 days later and are only visible in back-office reports.

#### 5.6 Subscriptions (Payment Scheduler)

Webhook events only: `SCHEDULED_PAYMENT_COMPLETED` / `SCHEDULED_PAYMENT_FAILED` (execution stage `SCHEDULED_PAYMENT` or `LAST_SCHEDULED_PAYMENT`), `RETRY_COMPLETED` / `RETRY_FAILED` (auto-retry of a declined scheduled payment), `SUBSCRIPTION_SUSPENDED`, `SUBSCRIPTION_CANCELLED`, `TRIAL_PAYMENT_COMPLETED` / `TRIAL_PAYMENT_FAILED` (`TRIAL_PAYMENT` or `LAST_TRIAL_PAYMENT`). Where the execution stage appears in the payload and the payload shape are **NOT DOCUMENTED** in the pages read.

#### 5.7 Chargebacks and disputes

- **No chargeback or dispute resource, endpoint or webhook event is documented for the Payments API.** Chargebacks are handled through the Merchant Back Office: retrieval requests (RFIs) first, dispute documents within 5 business days, automatic representment when the transaction was refunded or 3DS-authenticated, and an optional daily chargeback report (transactions and chargebacks page).
- Indirect signals: error `3425` (refund blocked because of a chargeback); PayPal pending reason `CHARGEBACK` (4.27); `MD06` SEPA return and `R10` / `R29` ACH returns (customer says not authorized).

#### 5.8 Authorized, captured and settled

- **Authorized**: payment `COMPLETED` with `settleWithAuth` `false` and `availableToSettle` > 0.
- **Captured**: a settlement exists; `PENDING` until the end-of-day batch, then `PROCESSING` and `COMPLETED`. With `settleWithAuth` `true` the payment is `COMPLETED` with `availableToSettle` 0 and a `settlements[]` entry that is usually still `PENDING` (Example D).
- **Funds to the merchant**: **NOT DOCUMENTED** as a payload state.
- **Voided**: payment `CANCELLED` when fully voided; the void resource itself is `COMPLETED`.
- **Refunded**: refund `COMPLETED`; the settlement's `availableToRefund` drops.

### 6. Webhooks

#### 6.1 Delivery, acknowledgement and retries

- **Transport**: "Paysafe notification messages are POST requests that carry a JSON-encoded payload along with the HTTP headers" (configure webhooks page). HTTPS on port 443 only. Configured in the Business Portal ("open a service request in the Business Portal").
- **Acknowledgement**: HTTP `200 OK` or `202 ACCEPTED`; any other status counts as not received (OpenAPI introduction).
- **Retries**: "a maximum of 2 additional attempts (total 3 attempts)". The interval between attempts is **NOT DOCUMENTED**. `attemptNumber` counts the attempt.
- **No alerting**: Paysafe "does not have a notification method to alert you when callbacks are not reaching your endpoint URL".
- **Duplicates**: "In case you have received the same notification multiple times for an already processed event, we request you to ignore the duplicate notification. It is recommended to make the notification URL endpoints idempotent."
- **Ordering**: **NOT DOCUMENTED**. Retries and parallel resources (handle, payment, settlement) can arrive in any order; the get-started page recommends one GET call to reconfirm a webhook status: "This ensures that no tampering has occurred with the webhook packets".
- **Source IP addresses**: **NOT DOCUMENTED**.

#### 6.2 Envelope shapes

Three shapes appear in first-party material; a parser must accept all of them.

| Shape            | Where documented                                               | Keys                                                                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: flat resource | configure webhooks page, Paysafe Checkout webhooks page        | The resource itself (`accountId`, `id`, `merchantRefNum`, `amount`, `usage`, `executionMode`, `currencyCode`, `type` = `PAYMENT_HANDLE`, `status`, `paymentType`), no `eventName`                                                                                           |
| B: full envelope | EPS, Openbucks and SafetyPay webhook pages; some card examples | `payload` (resource), `eventType`, `eventName` (same value), `attemptNumber` (string `"1"`), `resourceId`, `eventDate`, `links[]` (`href`, `rel` = `payment_handle`, `payment`, `refund`, `standalone_credit`), `mode` (`live` in every example, even with test-host links) |
| C: SDK envelope  | Java and PHP SDK pages, `WebhookEvent` class; card examples    | `payload`, `attemptNumber` (integer in the SDK class, string in examples), `type` (category such as `PAYMENT_HANDLE`, `PAYMENT`, `REFUND`), `resourceId`, `eventDate`, `eventName`; the Java SDK example also has a top-level `settlements[]` beside `payload`              |

#### 6.3 Event names

Union of all event names seen on the pages read (the configure page points to the Paysafe Checkout "Webhook Events" page as the list):

| Category (`type`)  | Event names                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment handle     | `PAYMENT_HANDLE_INITIATED`, `PAYMENT_HANDLE_PROCESSING`, `PAYMENT_HANDLE_PAYABLE`, `PAYMENT_HANDLE_COMPLETED`, `PAYMENT_HANDLE_FAILED`; also `PAYMENT_HANDLE_EXPIRED` (APM and card pages) and `PAYMENT_HANDLE_ERRORED` (EPS and SafetyPay pages), not in the main list |
| Payment            | `PAYMENT_RECEIVED`, `PAYMENT_PROCESSING`, `PAYMENT_COMPLETED`, `PAYMENT_HELD`, `PAYMENT_FAILED`, `PAYMENT_CANCELLED`; also `PAYMENT_PENDING` (APM pages)                                                                                                                |
| Settlement         | `SETTLEMENT_RECEIVED`, `SETTLEMENT_PENDING`, `SETTLEMENT_PROCESSING`, `SETTLEMENT_COMPLETED`, `SETTLEMENT_FAILED`, `SETTLEMENT_CANCELLED`; also `SETTLEMENT_ERRORED` (PaysafeCard page)                                                                                 |
| Void authorization | `VOIDAUTH_RECEIVED`, `VOIDAUTH_PENDING`, `VOIDAUTH_COMPLETED`, `VOIDAUTH_FAILED`, `VOIDAUTH_CANCELLED` (the list also repeats `SETTLEMENT_CANCELLED` here)                                                                                                              |
| Refund             | `REFUND_RECEIVED`, `REFUND_PENDING`, `REFUND_PROCESSING`, `REFUND_COMPLETED`, `REFUND_FAILED`, `REFUND_CANCELLED`; also `REFUND_ERRORED` (EPS page)                                                                                                                     |
| Original credit    | `ORIGINAL_CREDIT_PENDING`, `ORIGINAL_CREDIT_PROCESSING`, `ORIGINAL_CREDIT_COMPLETED`, `ORIGINAL_CREDIT_FAILED`, `ORIGINAL_CREDIT_CANCELLED` (the list repeats `PAYMENT_HANDLE_COMPLETED` and `PAYMENT_HANDLE_FAILED` here)                                              |
| Standalone credit  | `SA_CREDIT_RECEIVED`, `SA_CREDIT_PENDING`, `SA_CREDIT_PROCESSING`, `SA_CREDIT_HELD`, `SA_CREDIT_COMPLETED`, `SA_CREDIT_FAILED`, `SA_CREDIT_CANCELLED`; also `SA_CREDIT_ERRORED` (APM pages) and `SA_CREDIT_RETURN_COMPLETED` (Pay by Bank)                              |
| Registration       | `REGISTRATION_COMPLETED`, `REGISTRATION_FAILED`, `REGISTRATION_DECLINED`                                                                                                                                                                                                |
| Payment Scheduler  | see 5.6                                                                                                                                                                                                                                                                 |

Paysafe Checkout's client-side `riskCallback` uses other event names (`PAYMENT_HANDLE_CREATED`, `PAYMENT_HANDLE_NOT_CREATED`, `PAYMENT_HANDLE_REDIRECT`); these are browser callbacks, not webhooks.

#### 6.4 Signature (sensitive; PandaPayLens does not verify it)

- Header example: `Signature: UMaQ4h635wUc4hp60Z5ASBC/5UtqKybAldOkLv6ngc0=` (configure webhooks page). Only this example shows the header name; no other header is documented.
- Recipe: `digest = HMAC_SHA256(hmacKey, UTF-8 JSON body)`, `signature = Base64(digest)`; the official Java `SignatureVerifier` computes HMAC-SHA256 over the raw payload with the secret key and compares in constant time. A valid value is 44 Base64 characters ending in `=`.
- The HMAC key comes from the Business Portal. PandaPayLens should redact the header, may report "signature present (44 Base64 characters)", and must never ask for the key.

#### 6.5 Duplicate identification

- No delivery ID or event ID is documented. `resourceId` equals the resource `id`, so it identifies the resource, not the event.
- Suggested dedupe key: `eventName` + `resourceId` + `payload.status` + `eventDate` (or `payload.updatedTime` / `statusTime` when present). Whether `eventDate` stays the same across retries is **NOT DOCUMENTED**; `attemptNumber` > 1 marks a redelivery.
- Requests: `dupCheck` (default `true` for refunds) rejects a reused `merchantRefNum` "within the past 90 days" (`5031`); no idempotency header is documented.

### 7. Identifiers

| Field                                                                                                        | Scope                                                                                                               | Notes                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                         | Each resource (payment handle, payment, settlement, refund, void, standalone credit, original credit, verification) | UUID. Each operation has its own `id`, but with `settleWithAuth` `true` (and for one-step APMs) the settlement `id` equals the payment `id` (Example D, settlement flow page)                                                                                                                                                        |
| `merchantRefNum`                                                                                             | Merchant reference                                                                                                  | "It must be unique for each request"; duplicate check over 90 days (`dupCheck`). Lookups `GET /payments?merchantRefNum=...` and similar. Settlement examples reuse the payment's `merchantRefNum`                                                                                                                                    |
| `paymentHandleToken`                                                                                         | Payment handle                                                                                                      | 16-character token (examples `SC2INoYvSe2MzQuB`, `PHVwMqBOgsMsX0LF`, `PHPTRF98fcZLo6ve`); appears in the handle and in the payment it funded, which links them. Also `card.paymentToken` in a card webhook example                                                                                                                   |
| Parent links                                                                                                 | Payment to settlement, refund, void                                                                                 | Carried in the request path (`/payments/{paymentId}/settlements`, `/settlements/{settlementId}/refunds`, `/payments/{paymentId}/voidauths`). The refund, settlement and void schemas have **no parent ID field**; the payment body lists `settlements[]`. Refunds and voids pasted alone cannot be linked except by `merchantRefNum` |
| `resourceId`, `links[].href`                                                                                 | Webhooks                                                                                                            | `resourceId` = payload `id`; `href` paths look like `/alternatepayments/v1/accounts/{accountId}/paymenthandles/{id}` or `.../refunds/{id}`                                                                                                                                                                                           |
| `gatewayReconciliationId`                                                                                    | Provider-side ID                                                                                                    | "Not for CARD" on payments and handles; on settlements "the id which is common between paysafe and payment service provider" (a card settlement example has `ZZ4565731420`). For Skrill-routed APMs it equals `gatewayResponse.transaction_id`                                                                                       |
| `gatewayResponse.id`, `responseId`, `requestId`, `referenceNbr`, `authCode`, `txnDateTime`, `orderId`, `sid` | Acquirer or PSP                                                                                                     | Raw downstream identifiers                                                                                                                                                                                                                                                                                                           |
| `gatewayResponse.mb_transaction_id`, `transaction_id`, `merchant_id`                                         | Skrill Quick Checkout (nested)                                                                                      | Skrill IDs inside a Paysafe payload; useful to correlate with Skrill records                                                                                                                                                                                                                                                         |
| `cardSchemeTransactionId`, `paymentAccountReference`                                                         | Card scheme                                                                                                         | Scheme transaction ID and PAR                                                                                                                                                                                                                                                                                                        |
| `authentication.id`, `directoryServerTransactionId`                                                          | 3DS                                                                                                                 | 3DS authentication                                                                                                                                                                                                                                                                                                                   |
| `partialAuth.groupId`                                                                                        | Partial authorization group                                                                                         | Links up to three partial authorizations                                                                                                                                                                                                                                                                                             |
| `customerId`, `merchantCustomerId`, `profile.id`, mandate `id`, `registrationId`                             | Customer vault, mandates, registrations                                                                             |                                                                                                                                                                                                                                                                                                                                      |
| `accountId`, `merchantAccountId`, `childAccountNum`, `gatewayResponse.mid`, `terminalId`                     | Merchant account                                                                                                    | Mask in output                                                                                                                                                                                                                                                                                                                       |
| `X-INTERNAL-CORRELATION-ID`, client `correlationId`                                                          | Support reference                                                                                                   | Per request; for Paysafe support                                                                                                                                                                                                                                                                                                     |

### 8. Sensitive fields

Redact or mask by default (request fields included because request and response pairs get pasted):

- **Card data**: `card.cardNum`, `cvv`, `cardExpiry`, `holderName`, `cardBin` together with `lastDigits`, `paymentAccountReference`, `networkToken` fields, `applePay` and `googlePay` token objects (including decrypted tokens), `card.paymentToken`.
- **3DS**: `authentication.cavv`, `xid`, `directoryServerTransactionId`, `authentication.id`, `threeDs` device and browser data.
- **Tokens and secrets**: `paymentHandleToken` (usable for a payment while `PAYABLE`), single-use customer tokens, the `Authorization: Basic ...` header and API key passwords (`B-...` format), the webhook `Signature` header and HMAC key, `sid`.
- **Personal data**: `profile` (`firstName`, `lastName`, `email`, `phone`, `mobile`, `dateOfBirth`, `gender`, `nationality`, `identityDocuments`), `billingDetails`, `shippingDetails`, `customerIp`, `consumerIp`, device fingerprint IDs (for example `threatMetrixSessionId`), `gatewayResponse.profile`, `pay_from_email`, `pay_to_email`, PaysafeCard `consumerId`, Interchecks recipient email and IDs.
- **Bank data**: `accountNumber`, `routingNumber`, `sortCode`, `iban`, `bic`, `institutionId`, `transitNumber`, `accountHolderName`, mandate references.
- **Merchant identifiers and URLs**: `accountId`, `merchantAccountId`, `childAccountNum`, `gatewayResponse.mid`, `terminalId`, `merchant_id`, `returnLinks[].href`, `merchantUrl`.

### 9. Structural detection hints

Strong Paysafe signals (combine several):

1. **Error body**: top-level `error` object whose `code` is a **string** that is a four-digit number, `PAYMENTHUB-1` or `ALTERNATE-PAYMENTS-GATEWAY-<n>`, with `message`, and optionally `details` (string array), `fieldErrors[]` of `{field, error}`, `additionalDetails[]` of `{type, code, message}` with `type` `ADVICE` (`ADVICE-nn`) or `ISO_RESPONSE`. Often accompanied by top-level `id` (UUID), `merchantRefNum` and `settleWithAuth`.
2. **Resource body**: `id` (UUID) + `merchantRefNum` + upper-case `status` from 3.3 + `txnTime` + `currencyCode` + integer minor-unit `amount`, plus any of `paymentHandleToken`, `paymentType` (upper-case enum such as `CARD`, `SKRILL`, `NETELLER`, `PAYSAFECARD`, `PAYSAFECASH`, `INTERAC_ETRANSFER`, `RAPID_TRANSFER`, `ONLINE_BANK_TRANSFER`), `settleWithAuth`, `availableToSettle`, `availableToRefund`, `settlements[]`, `gatewayResponse`, `gatewayReconciliationId`, `liveMode`, `simulator`, `dupCheck`.
3. **Payment handle**: `paymentHandleToken` + `action` (`NONE` / `REDIRECT`) + `usage` (`SINGLE_USE` / `MULTI_USE`) + `executionMode` + `timeToLiveSeconds` + `transactionType` + `returnLinks[]` / `links[]` with `rel` such as `redirect_payment`, `on_completed`, `on_failed`, `default`.
4. **`gatewayResponse`** with `code` (`VPS`, `GPS`, `VAN`...), `responseCode`, `responseCodeDescription`, `avsResponse` / `cvvVerification` from the enums in 3.3, or `processor` such as `SKRILL_QCO`, `PAYSAFE_DIGITALWALLET`, `PAYSAFECARD`, `SAFETYPAY`.
5. **Card object**: `cardType` two-letter code (`VI`, `MC`...), `cardBin`, `lastDigits`, `cardCategory`, `issuingCountry`, `cardExpiry{month, year}`.
6. **Webhook**: top-level `eventName` in UPPER_SNAKE from 6.3 + `payload` + `resourceId` + `eventDate`, with `attemptNumber` (often a string), and `eventType`, `type`, `mode` or `links[]`; header `Signature` with a 44-character Base64 value.
7. **Hosts and paths**: `api.paysafe.com/paymenthub/v1/`, `api.test.paysafe.com/paymenthub/v1/`, `/alternatepayments/v1/accounts/`, legacy `/cardpayments/v1/accounts/`, `api.netbanx.com`, `api.test.netbanx.com`.

How this differs from supported providers:

- **Skrill**: Skrill's own `status_url` posts are form-encoded with `mb_transaction_id`, `md5sig` and `status` at the top level, and its MQI/API responses are XML (skrill research file). In Paysafe payloads the same Skrill fields (`mb_transaction_id`, `pay_to_email`, `status` `"2"`, `merchant_id`) appear **nested inside `gatewayResponse`** with `processor` `SKRILL_QCO`, in a JSON body that has `paymentHandleToken`, `merchantRefNum` or `eventName` at the top level. Rule: top-level Paysafe keys win, so these payloads belong to the `paysafe` adapter even when Skrill keys are nested. The Skrill balance webhook (`notificationId`, `timestamp`, `data`, header `X-Paysafe-Signature`) is a Skrill treasury format and is not a Payments API webhook.
- **Nuvei**: REST 1.0 uses `status` `SUCCESS` / `ERROR`, integer `errCode`, `reason`, `transactionStatus`, `gwErrorCode`, `internalRequestId`; event DMNs use PascalCase `EventType` and `AttemptNumber`. Paysafe uses camelCase `attemptNumber` with `eventName`, and never `errCode` or `gwErrorCode`.
- **Stripe**: an `error` object too, but with `type` (`card_error` style), snake_case `code`, `decline_code`, `param`; resources have `object` and prefixed IDs (`pi_`, `ch_`, `evt_`). Paysafe `error.code` is numeric-string or upper-case hyphenated, IDs are UUIDs, no `object` key.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `errorCode` + `errorType` + integer `status`, `notificationItems`. None appear in Paysafe payloads.
- **payabl.**: URL-encoded key-value strings (`transactionid`, `errormessage`, `security`); Paysafe is JSON.
- **Checkout.com**: `request_id` + `error_type` + `error_codes[]`, `_links` object, five-digit `response_code`. Paysafe uses `links` / `returnLinks` arrays of `{rel, href, method}`.
- **PayPal**: errors with `name` + `debug_id` + `details[].issue`; webhooks with dotted `event_type`. Paysafe wraps PayPal results in its own `error` (`1001` or `ALTERNATE-PAYMENTS-GATEWAY-4`) with PayPal text inside `details`; such payloads belong to `paysafe`.
- **Braintree, Mollie, Square**: `bt_signature` / `bt_payload` form bodies; `resource` + `tr_` IDs + `_links.documentation`; `errors[]` with upper-case `category` + `code`. None match the Paysafe envelope.
- **NMI**: query strings with `response`, `responsetext`, `transactionid`; Paysafe is JSON.
- **Worldpay**: `outcome`, `paymentId`, `commandId`, `errorName`, `eventDetails`, and Payment Queries `events[]` with camelCase `eventName` values such as `authorizationSucceeded`. Paysafe's `eventName` is top-level and UPPER_SNAKE. Paysafe can route card authorizations to Worldpay (VAN); the raw VAN codes then arrive inside Paysafe's `gatewayResponse` and still belong to `paysafe`.
- **Cybersource, Authorize.net**: their own envelopes (`transactionResponse`, `messages.resultCode`, `net.authorize.*` event types; Cybersource structures per its research file). No shared top-level keys with Paysafe were found.
- **High-risk adapters**: eZeeWallet errors are `{"error": {"code": <integer>, "message": ...}}` (ezeewallet research file), close to Paysafe's shape; Paysafe's `code` is a **string** and from the documented set, which separates them. Verotel errors use `error.title`, `error.status`, `error.documentation`. Trustly AMER uses `merchantReference` and numeric `paymentType` / `transactionType`, not `merchantRefNum`. CCBill, Segpay, Epoch, Netbilling and Verotel postbacks are form or query-string encoded. MiFinity uses a numeric `transactionStatus`; Paymentwall Brick errors use `type: "Error"` with `code`.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **No chargeback feed** for the Payments API (5.7). Dispute timelines cannot be built from documented payloads.
2. **Three webhook envelope shapes** (6.2), with `attemptNumber` as a string in examples and an integer in the SDK class, `eventType` present only sometimes, and `mode` `live` in examples whose links point to the test host.
3. **Invalid example JSON**: the `3022` decline example on the card errors page lacks a comma after `"settleWithAuth": true`; card webhook examples have trailing commas (`"dynamicDescriptor": "OnlineStore",` before `}`, `"locale": "en",` before `}`) and `links[]` entries without `href`; the card `PAYMENT_HANDLE_PAYABLE` example has `eventDate` 2021-09-29 while its payload `txnTime` is 2025-04-10; payload `txnTime` values such as `2025-04-10T17:21:33.4` have no time zone.
4. **Type drift**: `amount` is an integer in resources but the string `"6"` in the card `PAYMENT_FAILED` webhook; `settlements[].txnTime` is epoch milliseconds in Example D, an ISO string elsewhere and `2023-01-20T13:29:13.000+0000` in the Skrill example.
5. **Statuses outside the enums**: `ERROR` appears for handles, refunds and standalone credits (webhooks, get-started page) but is not in those OpenAPI enums; `CANCELLED` for handles appears only on the get-started page; `statusReason` is "present in the case where status is ERROR, FAILURE, or HELD" although `FAILURE` is not a status; `authentication.status` enum value is `"COMPLETED "` (with a trailing space) and lacks `PENDING`, which a webhook example uses; `threeDResult` enum lacks `R` and `C`, which the 3DS page, codes `5107` / `5117` and a webhook example use.
6. **Overlapping and conflicting codes**: `3060` means "Strong Customer Authentication required" (card page) but "Unsolicited reversal" in the Interchecks issuer mapping; `3703` is an invalid amount (card page) but "invalid format" in the Interchecks mapping; `3010` (insufficient funds) appears only as an Interchecks mapping target; client codes `9072` and `9099` have two meanings (4.26). Same Interchecks name maps to different Paysafe codes in the "existing" and "new" tables, and the Add Card table gives HTTP 400 for the same names.
7. **Tables that disagree between pages**: the OpenAPI common table has `5283` and `5502` while the card errors page has `5500` (different wording) and lacks `1100`, `5077` and `5283`; `5272` is HTTP 406 in the OpenAPI file but 415 on the card page; `3425` (chargeback) is only in the OpenAPI refund table; `3507` only on the card page; the card page has eleven authorization codes that the OpenAPI payment table lacks (marked "card page only" in 4.2); `5122`, `5123` and `6000` are only in the OpenAPI handle table; `5107` text differs between the card page ("Risk rule failed") and a webhook example ("Payment Hub Risk Rule Failed - threeDResult is R").
8. **AVS table under a failure code**: every AVS letter, including `W` "Exact AVS match" and `D` / `I` (full match), is listed under error `3007` (AVS failed). `A` and `Y` share the same text; `Z` is the only row with HTTP 403.
9. **Odd table structures**: "Standalone Credits Failure Cases" puts statuses in a column headed "HTTP Status" and amounts in one headed "Amount"; the Interchecks issuer table has a free-text continuation row and a `ROW_FOR_FORMATTING` row; the Direct Debit return table has a stray `TR` row without a scheme, references "Note 2" and "Note 4" that are not on the page, and EFT code `4` refers to an "Appendix 3" that is not there.
10. **Processor tables without a field mapping**: the OpenAPI file lists processor codes per processor name but does not say which `gatewayResponse.code` value selects which table (4, item 3). Codes overlap between processors with different meanings (for example `01` is "Approved" for MON but "Refer to issuer" elsewhere; `80`, `N7`, `Q1` and `T1` also differ), so decoding must be keyed by processor and falls back to unknown when the processor is not known.
11. **Downstream raw statuses** in `gatewayResponse.status` (Skrill `"2"`, `"-2"`, `"1"`; SafetyPay `"100"` to `"102"`) are not explained on the Paysafe pages.
12. **Form-encoded claim**: the OpenAPI introduction and overview say the API "Receives form-encoded request bodies", which contradicts the JSON-only guidance and examples.
13. **Endpoint table typos**: refund creation is listed as `/payments/{settlement_id}/refunds` (the operation is `/settlements/{settlementId}/refunds`); a "Look Up a Customer Including Subcomponents" row is listed as `DELETE`; the OpenAPI payment-method table links to an internal host (`prlocal-paysafe-developer-22.eu.paysafecorp.com`).
14. **Event list oddities**: the event list repeats `SETTLEMENT_CANCELLED` under void authorizations and `PAYMENT_HANDLE_COMPLETED` / `PAYMENT_HANDLE_FAILED` under original credits, and omits `PAYMENT_HANDLE_EXPIRED`, `PAYMENT_PENDING`, the `*_ERRORED` events and `SA_CREDIT_RETURN_COMPLETED` that method pages use.
15. **Undocumented code in an SDK fixture**: `DW-CUSTOMER-CONFLICT` (HTTP 409, with `additionalDetails` type `Duplication`, code `22`) appears only in the Java SDK test fixture.
16. **Retry timing**: webhook retry intervals, webhook source IPs and the HTTP 202 behavior on the API are **NOT DOCUMENTED**.
17. **Not read**: legacy Customer Vault, Direct Debit, Hosted Payments and 3D Secure 2 references, Payment Scheduler and Applications API references, docs.paysafe.com wallet and voucher APIs, and most per-method pages. Anything from those is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | One stable error object with a documented code in `error.code` and `X-Application-Status-Code`, 1,219 documented values across 25 tables, merchant advice codes with explicit retry guidance and ISO response codes in `additionalDetails`. Processor codes need the processor name and fall back to unknown when it is missing; downstream raw statuses stay unknown |
| **paymentResponses** | **supported** | The OpenAPI file has schemas and examples for every resource and status enums; declines (HTTP 402) carry the resource plus `error`. Tests can use the transcribed examples. Status values outside the enums (section 10, item 5) must be tolerated                                                                                                                    |
| **webhookParsing**   | **limited**   | JSON with an event list and full examples, but three envelope shapes, no event ID, no documented ordering, invalid example JSON and inconsistent field types. Signature only detectable, not verifiable                                                                                                                                                               |
| **timeline**         | **limited**   | `txnTime`, `statusTime`, `updatedTime`, `eventDate` and clear handle, payment, settlement, refund and payout states support a timeline. Limits: no chargeback events, handle `COMPLETED` regardless of payment outcome, settlement batching and payout returns that change a completed state later, and mixed timestamp formats                                       |
| **correlation**      | **limited**   | `merchantRefNum`, `paymentHandleToken`, shared payment and settlement IDs, `resourceId` and `gatewayReconciliationId` link records, but refunds and voids do not carry their parent ID in the body, and nested downstream IDs (Skrill, acquirer) are present only for some methods                                                                                    |
