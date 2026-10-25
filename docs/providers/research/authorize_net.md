# Authorize.net (adapter id `authorize_net`): provider research

Status: research notes for building a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Authorize.net's first-party documentation, its own web pages and its official GitHub repositories as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: pages were downloaded as HTML and converted to text, then read. The response code reference was read both as the published HTML table and as the two JSON files the developer site serves; the API schema (XSD) was read to confirm element names. No login, sandbox account or access request was used.

---

## 0. Summary

| Item                 | Finding                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome              | `documentation_verified` (gate items 1-5, 8, 9, 10 = yes)                                                                                                                                                                                                                                                                                                                                                |
| Classification       | `gateway` (strong evidence); `merchant_account_intermediary` (limited, through the "All-in-one" plan); not `acquiring`                                                                                                                                                                                                                                                                                   |
| Documented sectors   | No high-risk sector is named on any page read. General mentions only: nonprofits, subscriptions/retainers/payment plans, B2B.                                                                                                                                                                                                                                                                            |
| Documentation access | **Public.** developer.authorize.net, the API reference, the response code reference and the XSD load without login. Only the Merchant Interface (credentials, Signature Key) needs a login, which offline analysis does not need.                                                                                                                                                                        |
| API family first     | **Authorize.net API, JSON flavor** (`createTransactionResponse` from `POST https://api.authorize.net/xml/v1/request.api`), then **Webhooks** JSON notifications (`net.authorize.*`).                                                                                                                                                                                                                     |
| Documented codes     | Response code reference: **479** codes (12 `I` informational, 161 `E` API message codes, 306 numeric transaction response reason codes). One more numeric code (`2201`) appears only in a second JSON file. Plus `responseCode` 4 values, AVS 13, CVV 5, CAVV 13 (including blank), `transactionStatus` 18 (reference) / 24 (XSD), AFDS filter actions 5, subscription status 5, webhook event types 29. |
| Biggest limitation   | Webhook payloads are thin (no reason code, no parent transaction ID, no invoice number, no currency) and their field set is shown only by examples. Many reason codes share identical customer-facing text and differ only in the separate "suggestions" fields, and reason codes 1-4 collide numerically with `responseCode` 1-4. Chargebacks are not delivered as webhooks.                            |

---

## 1. Sources

All URLs below were read on 2026-10-25.

| URL                                                                                                      | What it covers                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://developer.authorize.net/api/reference/index.html                                                 | **API reference** (single page): endpoints, JSON support note, `createTransactionRequest`/`createTransactionResponse` field tables and XML/JSON examples for every transaction type, Fraud Management, Recurring Billing, Transaction Reporting (`transactionStatus` list), Accept Suite |
| https://developer.authorize.net/api/reference/responseCodes.html                                         | Response Code Tool page (explains API-level vs transaction-level codes; data loaded from a JSON file)                                                                                                                                                                                    |
| https://developer.authorize.net/api/reference/dist/json/responseCodes.json                               | **Response code list** linked as "download the latest version": 479 entries with `code`, `text`, `description`, `integration_suggestions`, `other_suggestions`                                                                                                                           |
| https://developer.authorize.net/content/dam/data/anetd/responseCodes.json                                | Second JSON file referenced by the Response Code Tool page: 474 entries keyed by code (`status`, `reason`, `message`, `action`). Differs from the file above (see section 12)                                                                                                            |
| https://developer.authorize.net/api/reference/features/errorandresponsecodes.html                        | Static HTML table of all response codes (same 479 codes as `dist/json/responseCodes.json`)                                                                                                                                                                                               |
| https://developer.authorize.net/api/reference/features/webhooks.html                                     | **Webhooks**: event types, payload examples, `X-ANET-Signature` (HMAC-SHA512), retry schedule, notification history API                                                                                                                                                                  |
| https://developer.authorize.net/api/reference/features/payment-transactions.html                         | Transaction stages and types (auth, capture, prior auth capture, capture only, void, credit), 30-day auth expiry, 180-day refund window, `duplicateWindow`, partial authorization, AVS/CCV filters                                                                                       |
| https://developer.authorize.net/support/hash_upgrade.html                                                | `transHash` (MD5) phase-out and `transHashSHA2` (HMAC-SHA512) computation                                                                                                                                                                                                                |
| https://developer.authorize.net/api/upgrade_guide.html                                                   | Status of legacy AIM, SIM, DPM, SOAP, Hosted CIM, HTTP GET, WebLink                                                                                                                                                                                                                      |
| https://developer.authorize.net/hello_world/testing_guide.html                                           | Sandbox test cards, ZIP-code and card-code triggers for decline, AVS, CVV, partial authorization; test mode returns transaction ID 0                                                                                                                                                     |
| https://developer.authorize.net/api/reference/features/card-on-file.html                                 | Card-on-file / MIT rules (`networkTransId`, `originalNetworkTransId`), EEA notes                                                                                                                                                                                                         |
| https://developer.authorize.net/api/reference/features/recurring-billing.html                            | ARB subscriptions, subscription statuses, merchant emails, link to webhooks                                                                                                                                                                                                              |
| https://developer.authorize.net/api/reference/features/transaction-reporting.html                        | Reporting API overview, 24-hour batch settlement                                                                                                                                                                                                                                         |
| https://developer.authorize.net/api/reference/features/echeck.html                                       | eCheck return and NOC codes (pointer only)                                                                                                                                                                                                                                               |
| https://developer.authorize.net/api/reference/features/accept-hosted.html                                | Accept Hosted iframe `transactResponse` JSON message and held-transaction behavior                                                                                                                                                                                                       |
| https://developer.authorize.net/hello_world/common_setup_questions.html                                  | Sandbox notes (currency per sandbox account)                                                                                                                                                                                                                                             |
| https://developer.authorize.net/support/faqs.html                                                        | Relay Response deprecated in favor of Webhooks                                                                                                                                                                                                                                           |
| https://developer.authorize.net/api/changes.html                                                         | API change log (JSON beta 2014, Webhooks 2016, `transHash` stopped sending values 2019, card-on-file 2019)                                                                                                                                                                               |
| https://developer.authorize.net/sitemap.xml                                                              | Discovery only                                                                                                                                                                                                                                                                           |
| https://api.authorize.net/xml/v1/schema/AnetApiSchema.xsd                                                | **API schema**: element names of `transactionResponse`, enums (`transactionStatusEnum`, `transactionTypeEnum`, `messageTypeEnum`, `cardTypeEnum`, `FDSFilterActionEnum`, `ARBSubscriptionStatusEnum`, `settlementStateEnum`)                                                             |
| https://www.authorize.net/                                                                               | Company home page (active, products, Visa backing)                                                                                                                                                                                                                                       |
| https://www.authorize.net/about-us.html                                                                  | Company description: wholly owned subsidiary of Visa, payment gateway since 1996, sold through resellers                                                                                                                                                                                 |
| https://www.authorize.net/sign-up/pricing.html                                                           | All-in-one vs Gateway only plans, eCheck only for U.S. businesses, underwriting considers industry                                                                                                                                                                                       |
| https://www.authorize.net/sitemap.html                                                                   | Discovery (no sector or country pages found)                                                                                                                                                                                                                                             |
| https://www.authorize.net/about-us/terms.html                                                            | Site terms (no merchant sector list)                                                                                                                                                                                                                                                     |
| https://www.authorize.net/blog/features/canada-pilot-guide.html                                          | Authorize.net moving onto the Visa Acceptance Platform; Canada pilot                                                                                                                                                                                                                     |
| https://status.authorize.net/                                                                            | Status page: "All Systems Operational" with per-component status (API, AIM, SIM, Webhooks, processors)                                                                                                                                                                                   |
| https://api.github.com/orgs/AuthorizeNet/repos                                                           | Official GitHub organization repository list (discovery)                                                                                                                                                                                                                                 |
| https://github.com/AuthorizeNet/sdk-php (`lib/net/authorize/util/AuthorizedNetSensitiveTagsConfig.json`) | SDK list of tags it masks in logs                                                                                                                                                                                                                                                        |
| https://github.com/AuthorizeNet/sdk-java (`resources/AuthorizedNetSensitiveTagsConfig.json`)             | Same list (Java variant)                                                                                                                                                                                                                                                                 |
| https://github.com/AuthorizeNet/sdk-node (`lib/apicontrollersbase.js`, `lib/constants.js`)               | Node SDK endpoints (`apitest.authorize.net`, `api2.authorize.net`) and JSON request handling                                                                                                                                                                                             |
| https://github.com/AuthorizeNet/sample-code-node (`Sha512/compute_trans_hashSHA2.js`)                    | Sample computation of `transHashSha2`                                                                                                                                                                                                                                                    |
| https://github.com/AuthorizeNet/webhooks-sample-app (`server.js`, `README.md`)                           | Webhooks sample app (no signature verification code found)                                                                                                                                                                                                                               |
| https://github.com/AuthorizeNet/webhooks-postman-collection (`webhooks.postman_collection.json`)         | Postman collection for the Webhooks REST API                                                                                                                                                                                                                                             |

Also tried, returned HTTP 404: `.../api/reference/features/fraud_management.html`, `.../features/advanced_fraud_detection_suite.html`, `.../features/applepay.html`, `.../features/visa_checkout.html`, `.../features/webhooks_rest_api.html`, `.../api/changelog.html`. The legacy AIM NVP and SIM guides are PDFs linked from the upgrade guide and were **not** read, because those formats are out of scope (section 4).

---

## 2. Qualification gate

| #   | Item                                                        | Answer             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Company/product active                                      | yes                | about-us: "Authorize.net is a wholly owned subsidiary of Visa", working with merchants "since 1996". Pages carry "© 2018-2026". The home page announces a redesigned product.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | Payment service operational                                 | yes                | status.authorize.net shows "All Systems Operational" with "Authorize.net API", "Webhooks", "Payment Gateway Processing" and individual processors marked Operational. The API reference lists live sandbox and production endpoints.                                                                                                                                                                                                                                                                                                                                                             |
| 3   | Docs publicly accessible                                    | yes                | API reference, response codes, webhooks, testing guide and XSD load without login. Gated: the Merchant Interface (API Login ID, Transaction Key, Signature Key), which is not needed to read payloads.                                                                                                                                                                                                                                                                                                                                                                                           |
| 4   | API families/versions identified                            | yes                | Authorize.net API (XML or JSON, `POST /xml/v1/request.api`, schema `AnetApiSchema.xsd`); Webhooks REST API (`/rest/v1/webhooks`, `/rest/v1/notifications`, `/rest/v1/eventtypes`); Accept Suite (Accept.js, Accept Hosted). Legacy AIM, SIM, DPM, SOAP are "Deprecated" (upgrade guide). No version numbers beyond the `v1` path segments.                                                                                                                                                                                                                                                       |
| 5   | Offline-examinable formats/examples                         | yes                | JSON and XML response examples for every transaction type (API reference), JSON webhook payload examples for payment, customer, payment profile, subscription, fraud and boarding events (webhooks page), downloadable response code JSON.                                                                                                                                                                                                                                                                                                                                                       |
| 6   | Sectors documented by provider                              | yes (general only) | Home page: Simple Checkout is "ideal for nonprofits and merchants selling single items or low-volume products". Pricing: recurring billing for "subscriptions, retainers, or payment plans"; "Best for: Large invoices, recurring payments, subscriptions, and B2B transactions". No high-risk sector named. See section 3.                                                                                                                                                                                                                                                                      |
| 7   | Regional/regulatory limits identified                       | unclear            | Partial only: pricing says "eCheck only available for businesses based in the U.S."; reason code 240 says DCC currency must be US dollars; the API reference marks `email` and billing names as required "only when using a European payment processor"; reason code 325 names processors (AIBMS UK, Barclays, Cardnet, HBOS, HSBC, Streamline, FdiAus, Westpac) that require billing fields; card-on-file page limits MIT rules to EEA cards; Canada is the pilot market for the Visa Acceptance Platform move. A list of supported merchant countries is **NOT DOCUMENTED** on the pages read. |
| 8   | Diagnostic value                                            | yes                | 479 documented codes with texts and integration suggestions, `responseCode` 1-4, AVS/CVV/CAVV tables, `transactionStatus` list, 29 webhook event types.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | Own technical format (not a white-label of another gateway) | yes                | Authorize.net publishes its own schema (`AnetApi/xml/v1/schema/AnetApiSchema.xsd`), its own codes and its own webhook format. It is sold through resellers (about-us: ISOs, MSPs, financial institutions) under its own name. The Canada pilot blog says Authorize.net "is now powered by the Visa Acceptance Platform" but that merchants keep the same experience; whether API payloads change for migrated merchants is **NOT DOCUMENTED**.                                                                                                                                                   |
| 10  | No credentials needed for examples                          | yes                | All examples and code tables are public. Analysis of pasted payloads needs no account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Outcome: `documentation_verified`.**

---

## 3. Classification and documented sectors

| Value                                  | Applies | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`                              | yes     | about-us: "a leading provider of payment gateway services, managing the submission of billions of transactions to processing networks on behalf of merchant customers". payment-transactions: merchants "connect to the Authorize.net Payment Gateway". The status page lists many back-end processors (Chase Paymentech, Elavon, EVO, First Data Nashville/Omaha, Global Payments, Heartland, Worldpay, Barclays, HSBC, and others). |
| `merchant_account_intermediary`        | limited | pricing: "Authorize.net's All-in-one plan includes both" a gateway and a merchant account; the merchant account "holds funds from card transactions and deposits them directly into your business bank account". Who underwrites that account is **NOT DOCUMENTED** on the pages read. The "Gateway only" plan connects to any merchant account provider.                                                                             |
| `acquiring`                            | no      | payment-transactions describes the acquiring bank as a separate actor that "underwrites merchants". No page claims Authorize.net is an acquirer.                                                                                                                                                                                                                                                                                      |
| `card_processing`                      | no      | Processing is done by the merchant's processor; Authorize.net routes to it (processor-specific reason codes such as FDC Omaha 200-224, Concord EFS 170-175).                                                                                                                                                                                                                                                                          |
| `payment_facilitator`                  | no      | Not described on any page read.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `wallet`, `alternative_payment_method` | no      | Authorize.net accepts PayPal, Apple Pay, Google Pay and eCheck.Net through the gateway (API reference sections), but does not operate those wallets. eCheck.Net is Authorize.net's ACH product, not a separate APM brand.                                                                                                                                                                                                             |
| `orchestration`                        | no      | Each merchant account is tied to one processor configuration; no routing across providers is documented.                                                                                                                                                                                                                                                                                                                              |

Sectors documented by Authorize.net (quotes, not inferences):

- "nonprofits" (home page, Simple Checkout).
- "subscriptions, retainers, or payment plans" and "B2B transactions" (pricing).
- The pricing FAQ says the underwriter "will look at your industry". No allowed or prohibited industry list was found.
- The Level 3 `productCode` enumeration in the API reference contains values such as `adult_content` and `subscription`. These are line-item product codes, not a statement that any sector is accepted.

Eligibility always depends on jurisdiction, licensing and underwriting by the merchant account provider. Nothing here implies that Authorize.net accepts any particular sector.

---

## 4. API families and versions in scope

| Family                                                                                                                                            | Endpoint(s)                                                                                                                                                                                                            | Request                                                                          | Response                                                                                    | Relevance to PandaPayLens                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authorize.net API, JSON**                                                                                                                       | `POST https://apitest.authorize.net/xml/v1/request.api` (sandbox), `POST https://api.authorize.net/xml/v1/request.api` (production). The Node SDK uses `https://api2.authorize.net/xml/v1/request.api` for production. | `application/json`, root key named after the method (`createTransactionRequest`) | JSON (`transactionResponse`, `refId`, `messages`)                                           | **Primary**. `createTransactionResponse` carries all the diagnostic fields                                                                                 |
| Authorize.net API, XML                                                                                                                            | same endpoints                                                                                                                                                                                                         | `text/xml`, namespace `AnetApi/xml/v1/schema/AnetApiSchema.xsd`                  | XML with the same element names                                                             | Same data; in scope later (the JSON is a translation of the XML, see section 5.1)                                                                          |
| **Webhooks** (notifications)                                                                                                                      | POST from Authorize.net to the merchant's registered URL                                                                                                                                                               | n/a                                                                              | JSON envelope `notificationId`, `eventType`, `eventDate`, `webhookId`, `payload`            | **Primary**. Asynchronous events for transactions, fraud review, profiles, subscriptions                                                                   |
| Webhooks REST API (management)                                                                                                                    | `https://apitest.authorize.net/rest/v1/webhooks`, `/rest/v1/notifications`, `/rest/v1/eventtypes`; production on `api.authorize.net`                                                                                   | JSON, HTTP Basic auth                                                            | JSON; notification history includes `deliveryStatus`, `retryLog` and the original `payload` | Secondary. A pasted notification-history record is a useful timeline source                                                                                |
| Transaction Reporting (`getTransactionDetails`, `getTransactionList`, `getUnsettledTransactionList`, `getSettledBatchList`, `getBatchStatistics`) | same API endpoint                                                                                                                                                                                                      | JSON/XML                                                                         | JSON/XML with `transactionStatus`, `responseReasonCode`, `batch`, `FDSFilters`              | Secondary. Gives the settlement-side status that webhooks do not carry                                                                                     |
| Accept Hosted iframe message                                                                                                                      | browser `postMessage` to the merchant's iframe communicator                                                                                                                                                            | n/a                                                                              | `action=transactResponse&response={JSON}`                                                   | Secondary. Different JSON shape (`authorization`, `totalAmount`, `dateTime`)                                                                               |
| Recurring Billing (ARB), Customer Profiles (CIM), Fraud Management                                                                                | same API endpoint                                                                                                                                                                                                      | JSON/XML                                                                         | JSON/XML with `messages` only or with `transactionResponse`                                 | Secondary (E codes)                                                                                                                                        |
| Legacy AIM NVP (`transact.dll`, `x_` fields), SIM, DPM, WebLink, SOAP, Silent Post, Relay Response                                                | `https://secure.authorize.net/gateway/transact.dll`, `secure2...`                                                                                                                                                      | form fields `x_*`                                                                | delimited/name-value strings                                                                | **Out of scope.** Upgrade guide: AIM, SIM, DPM, SOAP "Deprecated"; WebLink, HTTP GET, Hosted CIM "End of life". Webhooks "replace the Silent Post method". |
| In-person SDKs, Merchant Boarding API                                                                                                             | various                                                                                                                                                                                                                | n/a                                                                              | n/a                                                                                         | Out of scope (boarding webhooks noted in section 8)                                                                                                        |

The status page still lists "Advance Integration Method (AIM)" and "Server Integration Method (SIM)" as Operational, so legacy traffic exists, but it is not targeted.

**Recommendation: implement first** the JSON `createTransactionResponse` (all `transactionType` values share it) together with the Webhooks notification envelope and its `net.authorize.payment.*` events. Then add: the XML flavor of the same response (identical element names), the notification-history record (`retryLog`), `getTransactionDetails` (status timeline), and the Accept Hosted `transactResponse` message.

---

## 5. Response and error formats

### 5.1 Content type and structure

- The API reference: "The Authorize.net API, which is not based on REST, offers JSON support through a translation of JSON elements to XML elements." Element order matters on requests ("XML requires strict ordering").
- JSON request bodies have a single root key named after the method (`{"createTransactionRequest": {...}}`). The JSON **response** examples have **no** root key: the object starts directly with `transactionResponse`, `refId`, `messages`. The XML response root is `<createTransactionResponse>`. A parser should accept both an unwrapped object and one wrapped in `createTransactionResponse` (a wrapped JSON response is **NOT DOCUMENTED**, but users may paste one built from XML).
- Two separate result layers:
  - **API level** `messages.resultCode` = `Ok` or `Error`, with `messages.message[]` items `{code, text}`. Codes are `I` + 5 digits (informational) or `E` + 5 digits (error).
  - **Transaction level** `transactionResponse.responseCode` = `1` Approved, `2` Declined, `3` Error, `4` Held for Review. Details are in `transactionResponse.messages[]` items `{code, description}` (on approval) or `transactionResponse.errors[]` items `{errorCode, errorText}` (on decline/error). These numeric codes are the "response reason codes".
- In JSON the transaction-level `messages` and `errors` are arrays directly under `transactionResponse` (no inner `message`/`error` key), while the top-level `messages` is an object holding a `message` array. In XML both use wrappers (`<messages><message>`, `<errors><error>`).
- HTTP status for API errors: **NOT DOCUMENTED**. All examples are returned as normal response bodies with `resultCode` `Error`.
- Character set: the hash guide says "All Authorize.net values ... use ISO 8859-1 characters". The JSON response charset and any byte order mark are **NOT DOCUMENTED**.
- Value types: in createTransactionResponse JSON, codes and IDs are strings (`"responseCode": "1"`, `"transId": "2157047189"`). In webhook payloads, `responseCode` and `authAmount` are numbers and `id` is a string.

### 5.2 `transactionResponse` fields

From the API reference field table and `AnetApiSchema.xsd` (element order follows the XSD).

| Field                                                                                    | Type / values                                                                                                                                                                               | Meaning                                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `responseCode`                                                                           | string `1`/`2`/`3`/`4`                                                                                                                                                                      | Overall result: approved, declined, error, held for review                                                           |
| `rawResponseCode`                                                                        | string                                                                                                                                                                                      | In XSD and in a PayPal JSON example (`"0"`). Meaning **NOT DOCUMENTED**                                              |
| `authCode`                                                                               | string, up to 6                                                                                                                                                                             | Issuer authorization code                                                                                            |
| `avsResultCode`                                                                          | 1 char (section 6.4)                                                                                                                                                                        | AVS result                                                                                                           |
| `cvvResultCode`                                                                          | 1 char (section 6.5)                                                                                                                                                                        | Card code result                                                                                                     |
| `cavvResultCode`                                                                         | 1 char or blank (section 6.6)                                                                                                                                                               | 3-D Secure CAVV validation result                                                                                    |
| `transId`                                                                                | numeric string                                                                                                                                                                              | Gateway transaction ID. `"0"` in error examples and in test mode                                                     |
| `refTransID`                                                                             | numeric string or empty                                                                                                                                                                     | Related (original) transaction. Spelled with capital `ID` in responses and the XSD, `refTransId` in requests         |
| `transHash`                                                                              | string (32 hex in examples)                                                                                                                                                                 | Deprecated MD5 hash. Change log: production stopped sending a value on 2019-06-27                                    |
| `testRequest`                                                                            | string (`"0"` in example)                                                                                                                                                                   | In example and XSD; meaning **NOT DOCUMENTED** in the field table                                                    |
| `accountNumber`                                                                          | masked string (`XXXX1111`)                                                                                                                                                                  | Masked card or bank account number                                                                                   |
| `entryMode`                                                                              | string                                                                                                                                                                                      | Change log: returned only for card-present transactions                                                              |
| `accountType`                                                                            | `Visa`, `Mastercard`, `Discover`, `AmericanExpress`, `DinersClub`, `JCB`, `UnionChinaPay`, `eCheck` (examples also show `PayPal`)                                                           | Payment type                                                                                                         |
| `splitTenderId`                                                                          | numeric string                                                                                                                                                                              | Partial authorization group                                                                                          |
| `prePaidCard` (`requestedAmount`, `approvedAmount`, `balanceOnCard`)                     | strings                                                                                                                                                                                     | Prepaid / partial authorization amounts                                                                              |
| `messages[]` `{code, description}`                                                       | code = reason code                                                                                                                                                                          | Present on approval                                                                                                  |
| `errors[]` `{errorCode, errorText}`                                                      | errorCode = reason code                                                                                                                                                                     | Present on decline/error                                                                                             |
| `splitTenderPayments[]`                                                                  | `transId`, `responseCode`, `responseToCustomer` (described as "The response reason code"), `authCode`, `accountNumber`, `accountType`, `requestedAmount`, `approvedAmount`, `balanceOnCard` | One entry per partial payment                                                                                        |
| `userFields[]` `{name, value}`                                                           | up to 20                                                                                                                                                                                    | Merchant pass-through, echoed back unchanged and not stored                                                          |
| `shipTo`                                                                                 | object                                                                                                                                                                                      | In XSD; content **NOT DOCUMENTED** in the response table                                                             |
| `secureAcceptance` (`SecureAcceptanceUrl`, `PayerID`, `PayerEmail`)                      | strings                                                                                                                                                                                     | PayPal Express Checkout redirect and payer data                                                                      |
| `emvResponse` (`tlvData`, `tags[]`)                                                      | strings                                                                                                                                                                                     | Card-present EMV data                                                                                                |
| `transHashSha2`                                                                          | 128 hex (uppercase in examples)                                                                                                                                                             | HMAC-SHA512 response hash (section 8). The hash guide spells it `transHashSHA2`                                      |
| `profile` (`customerProfileId`, `customerPaymentProfileId`, `customerShippingProfileId`) | numeric strings                                                                                                                                                                             | Profile created from the transaction                                                                                 |
| `networkTransId`                                                                         | string, up to 255                                                                                                                                                                           | Card network transaction ID for card-on-file follow-ups                                                              |
| `merchantAdvice` (`code`, `description`)                                                 | strings                                                                                                                                                                                     | "merchant advice information returned by the TSYS payment processor". Code values **NOT DOCUMENTED**                 |
| `SupplementalDataQualificationIndicator`                                                 | number (`0`)                                                                                                                                                                                | Appears only in the Charge a Credit Card JSON example; not in the field table or the XSD; meaning **NOT DOCUMENTED** |

Top-level siblings: `refId` (merchant reference, up to 20, echoed only if sent), `messages`, and `profileResponse` (result of `createProfile`).

### 5.3 Examples

Example A: approved authCapture, JSON. **Transcribed from https://developer.authorize.net/api/reference/index.html** (Charge a Credit Card, JSON response; indentation normalized):

```json
{
  "transactionResponse": {
    "responseCode": "1",
    "authCode": "HW617E",
    "avsResultCode": "Y",
    "cvvResultCode": "",
    "cavvResultCode": "",
    "transId": "2157047189",
    "refTransID": "",
    "transHash": "E7CEB0A9F1BECA32A02493E1B31D5955",
    "testRequest": "0",
    "accountNumber": "XXXX1111",
    "accountType": "Visa",
    "messages": [
      {
        "code": "1",
        "description": "This transaction has been approved."
      }
    ],
    "transHashSha2": "D0C4FFF5648511A5862B917CFD9BB78ABF8A6E1D90C119CBBC4C0B454F4FF40DED15B204E042F36ECA5FB15D02588E4E4A7B85B94E7279599CE6020462CB7DEE",
    "SupplementalDataQualificationIndicator": 0,
    "networkTransId": "123456789NNNH"
  },
  "messages": {
    "resultCode": "Ok",
    "message": [
      {
        "code": "I00001",
        "text": "Successful."
      }
    ]
  }
}
```

Example B: error on an eCheck credit whose reference is not found, JSON. **Transcribed from https://developer.authorize.net/api/reference/index.html** (Credit a Bank Account, JSON response; indentation normalized):

```json
{
  "transactionResponse": {
    "responseCode": "3",
    "authCode": "",
    "avsResultCode": "P",
    "cvvResultCode": "",
    "cavvResultCode": "",
    "transId": "0",
    "refTransID": "2149181544",
    "transHash": "D6C9036F443BADE785D57DA2B44CD190",
    "accountNumber": "XXXX5678",
    "accountType": "eCheck",
    "errors": [
      {
        "errorCode": "16",
        "errorText": "The transaction cannot be found."
      }
    ]
  },
  "refId": "123456",
  "messages": {
    "resultCode": "Error",
    "message": [
      {
        "code": "E00027",
        "text": "The transaction was unsuccessful."
      }
    ]
  }
}
```

Example C: API-level error only (no `transactionResponse`), JSON. **Transcribed from https://developer.authorize.net/api/reference/index.html** (Update Split Tender Group). Note the `text` differs from the reference text for `E00027`:

```json
{
  "messages": {
    "resultCode": "Error",
    "message": [
      {
        "code": "E00027",
        "text": "The specified SplitTenderID is invalid."
      }
    ]
  }
}
```

The API reference has **no** example of a declined (`responseCode` 2) or held (`responseCode` 4) `createTransactionResponse`. Which `messages.resultCode` and `E` code accompany a decline is therefore **NOT DOCUMENTED** by example. The `E00027` description ("An approval was not returned for the transaction") suggests it covers declines too, but this is an inference.

---

## 6. Codes

Codes and their official texts are in the Response Code Tool data (`dist/json/responseCodes.json`, mirrored by `errorandresponsecodes.html`). Meanings below are short paraphrases written for this file, often drawing on the separate "suggestions" fields because the customer-facing text is shared by many codes. **Category and retry columns are suggestions for PandaPayLens, not Authorize.net statements.** Where Authorize.net gives advice, the paraphrase reflects it.

Where each code appears:

- `I`/`E` codes: `messages.message[].code` (top level, every API method).
- Numeric reason codes: `transactionResponse.messages[].code`, `transactionResponse.errors[].errorCode`, `splitTenderPayments[].responseToCustomer` and `getTransactionDetails` `responseReasonCode`.

Reason code meaning must always be read together with `responseCode`. Many reason codes are tied to a specific processor (FDC Omaha, Concord EFS, Wells Fargo SecureSource, TSYS/Vital) or to a legacy method (SIM, AIM `x_` fields, PayPal `x_version`); the meaning column says so.

### 6.1 `responseCode` (transaction level): 4 values

| Value | Meaning                       | Suggested handling                                                                              |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `1`   | Approved                      | success                                                                                         |
| `2`   | Declined                      | card_declined unless the reason code says otherwise / customer_action_required                  |
| `3`   | Error                         | use the reason code; invalid_request or configuration in most documented cases                  |
| `4`   | Held for review (AFDS filter) | fraud_or_risk / manual_review. Not a final state; a later fraud.approved/declined event follows |

The webhook failed-delivery example carries `"responseCode": 0`, a value not in this list (section 12).

### 6.2 API message codes (`messages.message[].code`): 173 codes

#### Informational (12)

| Code     | Meaning (paraphrase)                                                | Category            | Retry   |
| -------- | ------------------------------------------------------------------- | ------------------- | ------- |
| `I00001` | Request processed successfully                                      | n/a (success)       | n/a     |
| `I00002` | Subscription was already canceled                                   | n/a (informational) | n/a     |
| `I00003` | Record was already deleted                                          | n/a (informational) | n/a     |
| `I00004` | No records match the query                                          | n/a (empty result)  | n/a     |
| `I00005` | Mobile device submitted for administrator approval                  | n/a (informational) | n/a     |
| `I00006` | Mobile device approved                                              | n/a (informational) | n/a     |
| `I00007` | Payment Gateway Account service already accepted                    | n/a (informational) | n/a     |
| `I00008` | Payment Gateway Account service already declined                    | n/a (informational) | n/a     |
| `I00009` | API user already exists                                             | n/a (informational) | n/a     |
| `I00010` | Merchant activated                                                  | n/a (informational) | n/a     |
| `I00011` | Merchant not activated                                              | n/a (informational) | n/a     |
| `I99999` | Development placeholder; documented as never released to production | unknown             | unknown |

#### Errors (161)

| Code     | Meaning (paraphrase)                                                                     | Category                   | Retry                           |
| -------- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `E00001` | Unexpected system error                                                                  | provider_unavailable       | retry_conditionally             |
| `E00002` | Content type not supported (description names only XML types)                            | invalid_request            | do_not_retry                    |
| `E00003` | XML parse error                                                                          | invalid_request            | do_not_retry                    |
| `E00004` | Method name (root node) invalid                                                          | invalid_request            | do_not_retry                    |
| `E00005` | Transaction key or API key missing or invalid                                            | configuration              | do_not_retry                    |
| `E00006` | API user name (login ID) missing or invalid                                              | configuration              | do_not_retry                    |
| `E00007` | Authentication failed; wrong credentials or wrong environment (sandbox vs production)    | configuration              | do_not_retry                    |
| `E00008` | Gateway, reseller or user account inactive                                               | configuration              | do_not_retry                    |
| `E00009` | Account in Test Mode; method cannot run                                                  | configuration              | do_not_retry                    |
| `E00010` | User not permitted to call the API                                                       | configuration              | do_not_retry                    |
| `E00011` | User not permitted to call this method                                                   | configuration              | do_not_retry                    |
| `E00012` | Duplicate subscription                                                                   | duplicate_request          | do_not_retry                    |
| `E00013` | A field value is invalid (text names the field)                                          | invalid_request            | do_not_retry                    |
| `E00014` | Required field missing                                                                   | invalid_request            | do_not_retry                    |
| `E00015` | Field length invalid                                                                     | invalid_request            | do_not_retry                    |
| `E00016` | Field type invalid                                                                       | invalid_request            | do_not_retry                    |
| `E00017` | Subscription start date in the past                                                      | invalid_request            | do_not_retry                    |
| `E00018` | Card expires before subscription start                                                   | invalid_request            | customer_action_required        |
| `E00019` | Tax ID or driver's license data required for the subscription                            | invalid_request            | do_not_retry                    |
| `E00020` | Account not enabled for eCheck subscriptions                                             | configuration              | do_not_retry                    |
| `E00021` | Account not enabled for card subscriptions                                               | configuration              | do_not_retry                    |
| `E00022` | Interval out of range (7-365 days or 1-12 months)                                        | invalid_request            | do_not_retry                    |
| `E00023` | Subscription would run longer than three years                                           | invalid_request            | do_not_retry                    |
| `E00024` | Trial occurrences required when a trial amount is given                                  | invalid_request            | do_not_retry                    |
| `E00025` | Automated Recurring Billing not enabled                                                  | configuration              | do_not_retry                    |
| `E00026` | Trial amount and trial occurrences must both be given                                    | invalid_request            | do_not_retry                    |
| `E00027` | Transaction not approved; details in `transactionResponse.errors`                        | see reason code            | see reason code                 |
| `E00028` | Trial occurrences must be fewer than total occurrences                                   | invalid_request            | do_not_retry                    |
| `E00029` | Payment information required                                                             | invalid_request            | do_not_retry                    |
| `E00030` | Payment schedule required                                                                | invalid_request            | do_not_retry                    |
| `E00031` | Subscription amount required                                                             | invalid_amount             | do_not_retry                    |
| `E00032` | Subscription start date required                                                         | invalid_request            | do_not_retry                    |
| `E00033` | Start date cannot be changed                                                             | invalid_request            | do_not_retry                    |
| `E00034` | Interval cannot be changed                                                               | invalid_request            | do_not_retry                    |
| `E00035` | Subscription not found for this merchant                                                 | invalid_request            | do_not_retry                    |
| `E00036` | Payment type (card vs eCheck) cannot be changed                                          | invalid_request            | do_not_retry                    |
| `E00037` | Expired, canceled or terminated subscription cannot be updated                           | invalid_request            | do_not_retry                    |
| `E00038` | Expired or terminated subscription cannot be canceled                                    | invalid_request            | do_not_retry                    |
| `E00039` | Duplicate customer profile, payment profile or address                                   | duplicate_request          | do_not_retry                    |
| `E00040` | Profile, payment profile, address or transaction ID not found for this merchant          | invalid_request            | do_not_retry                    |
| `E00041` | All fields empty                                                                         | invalid_request            | do_not_retry                    |
| `E00042` | Maximum number of payment profiles reached                                               | invalid_request            | do_not_retry                    |
| `E00043` | Maximum number of shipping addresses reached                                             | invalid_request            | do_not_retry                    |
| `E00044` | Customer Information Manager not enabled                                                 | configuration              | do_not_retry                    |
| `E00045` | Root node has no valid XML namespace                                                     | invalid_request            | do_not_retry                    |
| `E00046` | Generic merchant boarding insert failure                                                 | unknown                    | manual_review                   |
| `E00047` | Merchant Boarding API not enabled for the reseller                                       | configuration              | do_not_retry                    |
| `E00048` | Boarding: at least one payment method must be set                                        | invalid_request            | do_not_retry                    |
| `E00049` | Database operation timed out                                                             | network_or_timeout         | retry_conditionally             |
| `E00050` | Boarding: sell rates below buy rates                                                     | invalid_request            | do_not_retry                    |
| `E00051` | Original transaction was not made with this payment profile                              | invalid_request            | do_not_retry                    |
| `E00052` | Too many array elements                                                                  | invalid_request            | do_not_retry                    |
| `E00053` | Server too busy; try later                                                               | provider_unavailable       | safe_to_retry_technical_request |
| `E00054` | Mobile device not registered with the account                                            | configuration              | do_not_retry                    |
| `E00055` | Mobile device pending approval                                                           | configuration              | do_not_retry                    |
| `E00056` | Mobile device disabled                                                                   | configuration              | do_not_retry                    |
| `E00057` | User may not submit from a mobile device                                                 | configuration              | do_not_retry                    |
| `E00058` | Too many pending mobile devices                                                          | configuration              | do_not_retry                    |
| `E00059` | Authentication type not allowed for this method                                          | configuration              | do_not_retry                    |
| `E00060` | Transaction type invalid                                                                 | invalid_request            | do_not_retry                    |
| `E00061` | Could not decrypt DUKPT data (text is a placeholder)                                     | invalid_request            | do_not_retry                    |
| `E00062` | Fatal error calling an internal web service                                              | provider_unavailable       | retry_conditionally             |
| `E00063` | Internal web service returned an error                                                   | provider_unavailable       | retry_conditionally             |
| `E00064` | Client authorization denied                                                              | configuration              | do_not_retry                    |
| `E00065` | Prerequisite failed (no detail)                                                          | unknown                    | manual_review                   |
| `E00066` | Invalid value                                                                            | invalid_request            | do_not_retry                    |
| `E00067` | XML parse: too many nodes of a kind                                                      | invalid_request            | do_not_retry                    |
| `E00068` | XML parse: node invalid                                                                  | invalid_request            | do_not_retry                    |
| `E00069` | Boarding service already accepted; decline not allowed                                   | invalid_request            | do_not_retry                    |
| `E00070` | Boarding service already declined; agree not allowed                                     | invalid_request            | do_not_retry                    |
| `E00071` | A named field must contain data                                                          | invalid_request            | do_not_retry                    |
| `E00072` | A named node is required                                                                 | invalid_request            | do_not_retry                    |
| `E00073` | A named value is invalid                                                                 | invalid_request            | do_not_retry                    |
| `E00074` | Merchant not associated with this reseller                                               | configuration              | do_not_retry                    |
| `E00075` | XML parse: missing fields                                                                | invalid_request            | do_not_retry                    |
| `E00076` | A named field has an invalid value                                                       | invalid_request            | do_not_retry                    |
| `E00077` | A named value is too long                                                                | invalid_request            | do_not_retry                    |
| `E00078` | Pending status, not completed                                                            | unknown                    | manual_review                   |
| `E00079` | Impersonation (partner) login ID invalid or missing                                      | configuration              | do_not_retry                    |
| `E00080` | Impersonation API key invalid or missing                                                 | configuration              | do_not_retry                    |
| `E00081` | Partner not authorized to impersonate this account                                       | configuration              | do_not_retry                    |
| `E00082` | Country invalid                                                                          | invalid_request            | do_not_retry                    |
| `E00083` | Bank payments not accepted for the business country                                      | configuration              | do_not_retry                    |
| `E00084` | Card payments not accepted for the business country                                      | configuration              | do_not_retry                    |
| `E00085` | State invalid                                                                            | invalid_request            | do_not_retry                    |
| `E00086` | Merchant declined authorization to the resource                                          | configuration              | do_not_retry                    |
| `E00087` | No subscriptions found                                                                   | n/a (empty result)         | n/a                             |
| `E00088` | Profile IDs and CreateProfile cannot be combined                                         | invalid_request            | do_not_retry                    |
| `E00089` | CreateProfile requires payment data                                                      | invalid_request            | do_not_retry                    |
| `E00090` | Payment profile and payment data cannot be combined                                      | invalid_request            | do_not_retry                    |
| `E00091` | Payment profile ID and payment data cannot be combined                                   | invalid_request            | do_not_retry                    |
| `E00092` | Shipping profile ID and shipTo data cannot be combined                                   | invalid_request            | do_not_retry                    |
| `E00093` | Payment profile and billing data cannot be combined                                      | invalid_request            | do_not_retry                    |
| `E00094` | Paging offset too large                                                                  | invalid_request            | do_not_retry                    |
| `E00095` | Shipping profile ID missing in customer profile                                          | invalid_request            | do_not_retry                    |
| `E00096` | Fingerprint value invalid                                                                | configuration              | do_not_retry                    |
| `E00097` | Fingerprint cannot be generated                                                          | configuration              | do_not_retry                    |
| `E00098` | Customer or shipping profile not found                                                   | invalid_request            | do_not_retry                    |
| `E00099` | Profile from transaction failed: transaction ID invalid (older than 30 days not allowed) | invalid_request            | do_not_retry                    |
| `E00100` | Profile from transaction failed: transaction type not supported                          | invalid_request            | do_not_retry                    |
| `E00101` | Profile from transaction failed (payment profile step)                                   | unknown                    | manual_review                   |
| `E00102` | Customer information missing                                                             | invalid_request            | do_not_retry                    |
| `E00103` | Payment method does not support profile creation                                         | payment_method_unavailable | do_not_retry                    |
| `E00104` | Server in maintenance; try later                                                         | provider_unavailable       | safe_to_retry_technical_request |
| `E00105` | Payment profile tied to an active/suspended subscription; cannot delete                  | invalid_request            | do_not_retry                    |
| `E00106` | Customer profile tied to an active/suspended subscription; cannot delete                 | invalid_request            | do_not_retry                    |
| `E00107` | Shipping profile tied to an active/suspended subscription; cannot delete                 | invalid_request            | do_not_retry                    |
| `E00108` | Customer profile ID and customer data cannot be combined                                 | invalid_request            | do_not_retry                    |
| `E00109` | Customer address ID and shipTo data cannot be combined                                   | invalid_request            | do_not_retry                    |
| `E00110` | Customer payment profile ID missing                                                      | invalid_request            | do_not_retry                    |
| `E00111` | Subscription was not created with this customer profile                                  | invalid_request            | do_not_retry                    |
| `E00112` | Report month in the future                                                               | invalid_request            | do_not_retry                    |
| `E00113` | OTS token data invalid                                                                   | invalid_request            | do_not_retry                    |
| `E00114` | OTS token invalid                                                                        | invalid_request            | do_not_retry                    |
| `E00115` | OTS token expired                                                                        | invalid_request            | customer_action_required        |
| `E00116` | Merchant has no access to this OTS token                                                 | configuration              | do_not_retry                    |
| `E00117` | OTS service validation or configuration error                                            | configuration              | do_not_retry                    |
| `E00118` | Blocked IP address                                                                       | fraud_or_risk              | do_not_retry                    |
| `E00119` | Payment data must not be sent with a hosted payment page request                         | invalid_request            | do_not_retry                    |
| `E00120` | Payment/shipping profile IDs not allowed when creating profiles                          | invalid_request            | do_not_retry                    |
| `E00121` | No default payment or shipping profile                                                   | invalid_request            | do_not_retry                    |
| `E00122` | Signature Key missing; generate one in the Merchant Interface                            | configuration              | do_not_retry                    |
| `E00123` | OAuth access token expired (tokens last 10 minutes)                                      | configuration              | retry_conditionally             |
| `E00124` | OAuth access token invalid or insufficient                                               | configuration              | do_not_retry                    |
| `E00125` | Hash does not match                                                                      | configuration              | do_not_retry                    |
| `E00126` | Shared key validation failed                                                             | configuration              | do_not_retry                    |
| `E00127` | Invoice not found                                                                        | invalid_request            | do_not_retry                    |
| `E00128` | Action not allowed in the object's current status                                        | invalid_request            | do_not_retry                    |
| `E00129` | Failed to send email                                                                     | provider_unavailable       | retry_conditionally             |
| `E00130` | Valid customer profile ID or email required                                              | invalid_request            | do_not_retry                    |
| `E00131` | Invoice created but email/status update failed                                           | unknown                    | manual_review                   |
| `E00132` | Invoicing or CIM not enabled                                                             | configuration              | do_not_retry                    |
| `E00133` | Server error                                                                             | provider_unavailable       | retry_conditionally             |
| `E00134` | Invoice due date missing or in the past                                                  | invalid_request            | do_not_retry                    |
| `E00135` | Processor information missing; cannot leave test mode                                    | configuration              | do_not_retry                    |
| `E00136` | Processor account setup still in progress                                                | configuration              | retry_conditionally             |
| `E00137` | Only one payment type (card or bank) allowed                                             | invalid_request            | do_not_retry                    |
| `E00138` | Profile IDs not allowed for a hosted payment page request                                | invalid_request            | do_not_retry                    |
| `E00139` | Access token lacks permission for this method                                            | configuration              | do_not_retry                    |
| `E00140` | Reference ID not found                                                                   | invalid_request            | do_not_retry                    |
| `E00141` | Profile from this opaque data requires `liveMode`                                        | invalid_request            | do_not_retry                    |
| `E00142` | `recurringBilling` required for recurring tokenized payments                             | invalid_request            | do_not_retry                    |
| `E00143` | Merchant ID not parseable as integer                                                     | invalid_request            | do_not_retry                    |
| `E00144` | Last subscription transaction is held for review; review before reactivating             | fraud_or_risk              | manual_review                   |
| `E00145` | Invoice canceled by its sender                                                           | invalid_request            | do_not_retry                    |
| `E00146` | Request payload could not be decrypted                                                   | invalid_request            | do_not_retry                    |
| `E00147` | No invoices found                                                                        | n/a (empty result)         | n/a                             |
| `E00148` | Logo upload rejected as malicious                                                        | invalid_request            | do_not_retry                    |
| `E00149` | Invoice locked after too many payment attempts                                           | rate_limiting              | do_not_retry                    |
| `E00150` | Invoice create/edit limit reached until a transaction succeeds                           | rate_limiting              | retry_conditionally             |
| `E00151` | Daily invoice create/edit limit reached                                                  | rate_limiting              | retry_conditionally             |
| `E00152` | Failed to send PIN (merchant user login)                                                 | provider_unavailable       | retry_conditionally             |
| `E00153` | Failed to verify PIN (merchant user login)                                               | authentication_failed      | customer_action_required        |
| `E00154` | Biometric login failed: public key expired                                               | authentication_failed      | customer_action_required        |
| `E00155` | Could not retrieve public key for login                                                  | authentication_failed      | retry_conditionally             |
| `E00156` | Login signature verification failed                                                      | authentication_failed      | do_not_retry                    |
| `E00157` | Error authenticating the user                                                            | authentication_failed      | retry_conditionally             |
| `E00158` | User password expired                                                                    | authentication_failed      | customer_action_required        |
| `E00159` | Activation code expired                                                                  | authentication_failed      | customer_action_required        |
| `E00160` | One-time password invalid                                                                | authentication_failed      | customer_action_required        |
| `E00163` | Activation code invalid                                                                  | authentication_failed      | customer_action_required        |

`E00161` and `E00162` are not in the reference. `E00152`-`E00163` concern merchant user and mobile device login, not cardholder authentication; an adapter may prefer a separate label for them.

### 6.3 Transaction response reason codes: 306 codes

| Code   | Meaning (paraphrase)                                                                                                     | Category                   | Retry                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------- |
| `0`    | Unknown error                                                                                                            | unknown                    | manual_review                   |
| `1`    | Approved                                                                                                                 | n/a (success)              | n/a                             |
| `2`    | Declined (general, no reason given)                                                                                      | card_declined              | customer_action_required        |
| `3`    | Declined: issuer referral, voice authorization needed (docs list brand phone numbers)                                    | card_declined              | manual_review                   |
| `4`    | Declined: processor says pick up the card                                                                                | fraud_or_risk              | do_not_retry                    |
| `5`    | Amount missing or not a valid number                                                                                     | invalid_amount             | do_not_retry                    |
| `6`    | Card number invalid                                                                                                      | invalid_request            | customer_action_required        |
| `7`    | Expiration date format invalid                                                                                           | invalid_request            | customer_action_required        |
| `8`    | Card expired                                                                                                             | card_declined              | customer_action_required        |
| `9`    | Routing (ABA) number invalid                                                                                             | invalid_request            | customer_action_required        |
| `10`   | Bank account number invalid                                                                                              | invalid_request            | customer_action_required        |
| `11`   | Duplicate: same amount and card within the duplicate window (two minutes by default)                                     | duplicate_request          | do_not_retry                    |
| `12`   | Authorization code required but missing                                                                                  | invalid_request            | do_not_retry                    |
| `13`   | API login ID invalid, account inactive, or wrong environment                                                             | configuration              | do_not_retry                    |
| `14`   | Relay/receipt/referrer URL invalid (SIM only)                                                                            | configuration              | do_not_retry                    |
| `15`   | Transaction ID missing or non-numeric for void, capture or credit                                                        | invalid_request            | do_not_retry                    |
| `16`   | Referenced transaction not found (for example made under another account)                                                | invalid_request            | do_not_retry                    |
| `17`   | Gateway account not set up for this card type                                                                            | payment_method_unavailable | customer_action_required        |
| `18`   | Merchant does not accept eChecks                                                                                         | payment_method_unavailable | customer_action_required        |
| `19`   | Processing error: no reply from the processor (connectivity)                                                             | network_or_timeout         | retry_conditionally             |
| `20`   | Processing error: no reply from the processor (connectivity)                                                             | network_or_timeout         | retry_conditionally             |
| `21`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `22`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `23`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `24`   | Elavon bank number or terminal ID wrong                                                                                  | configuration              | do_not_retry                    |
| `25`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `26`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `27`   | Declined by the merchant's AVS filter (address mismatch)                                                                 | fraud_or_risk              | customer_action_required        |
| `28`   | Processor not set up for this card type                                                                                  | payment_method_unavailable | customer_action_required        |
| `29`   | Paymentech client, merchant or terminal number wrong                                                                     | configuration              | do_not_retry                    |
| `30`   | Processor configuration invalid                                                                                          | configuration              | do_not_retry                    |
| `31`   | FDC merchant ID or terminal ID wrong                                                                                     | configuration              | do_not_retry                    |
| `32`   | Merchant password invalid or missing                                                                                     | configuration              | do_not_retry                    |
| `33`   | A field the merchant marked as required was not sent (text has a field placeholder)                                      | invalid_request            | do_not_retry                    |
| `34`   | VITAL identification numbers wrong                                                                                       | configuration              | do_not_retry                    |
| `35`   | Processing error; merchant set up incorrectly at the processor                                                           | configuration              | manual_review                   |
| `36`   | Authorized, but settlement failed                                                                                        | unknown                    | manual_review                   |
| `37`   | Card number invalid                                                                                                      | invalid_request            | customer_action_required        |
| `38`   | Global Payment System identification numbers wrong (second JSON file gives a currency meaning, see section 12)           | configuration              | do_not_retry                    |
| `39`   | Currency invalid, unsupported, not allowed, or no exchange rate                                                          | configuration              | do_not_retry                    |
| `40`   | Transaction must be encrypted                                                                                            | configuration              | do_not_retry                    |
| `41`   | Declined: FraudScreen.Net score above the merchant threshold                                                             | fraud_or_risk              | do_not_retry                    |
| `42`   | Required field missing or invalid (Wells Fargo SecureSource)                                                             | invalid_request            | do_not_retry                    |
| `43`   | Merchant terminal ID invalid at the processor                                                                            | configuration              | do_not_retry                    |
| `44`   | Declined: card code did not match at the issuer                                                                          | card_declined              | customer_action_required        |
| `45`   | Declined: both AVS and card code filters matched rejection rules                                                         | fraud_or_risk              | customer_action_required        |
| `46`   | Session expired or missing; log in again                                                                                 | configuration              | do_not_retry                    |
| `47`   | Capture amount greater than the authorized amount                                                                        | invalid_amount             | do_not_retry                    |
| `48`   | Processor does not allow settling less than authorized (partial reversal)                                                | invalid_amount             | do_not_retry                    |
| `49`   | Amount above the allowed maximum                                                                                         | invalid_amount             | do_not_retry                    |
| `50`   | Transaction not yet settled; cannot be refunded                                                                          | invalid_request            | retry_conditionally             |
| `51`   | Credits would exceed the original amount                                                                                 | invalid_amount             | do_not_retry                    |
| `52`   | Authorized, but the merchant system was not notified; will not be settled                                                | network_or_timeout         | manual_review                   |
| `53`   | Transaction type not valid for ACH (for example capture only)                                                            | invalid_request            | do_not_retry                    |
| `54`   | Referenced transaction not eligible for credit (unsettled, wrong type or currency, bad ID, or settled over 180 days ago) | invalid_request            | do_not_retry                    |
| `55`   | Credits would exceed the original debit                                                                                  | invalid_amount             | do_not_retry                    |
| `56`   | Merchant accepts eCheck only                                                                                             | payment_method_unavailable | customer_action_required        |
| `57`   | Processing error: processor could not interpret the data                                                                 | invalid_request            | do_not_retry                    |
| `58`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `59`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `60`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `61`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `62`   | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `63`   | Processing error; if repeated, check business country (TSYS)                                                             | configuration              | retry_conditionally             |
| `64`   | Referenced transaction was not approved (Wells Fargo SecureSource)                                                       | invalid_request            | do_not_retry                    |
| `65`   | Declined by the merchant's card code filter                                                                              | fraud_or_risk              | customer_action_required        |
| `66`   | Not accepted: sent with HTTP GET, or SIM security fields missing                                                         | configuration              | do_not_retry                    |
| `67`   | Transaction type not supported for this merchant (Wells Fargo SecureSource, capture only)                                | configuration              | do_not_retry                    |
| `68`   | Legacy `x_version` invalid                                                                                               | invalid_request            | do_not_retry                    |
| `69`   | `transactionType` invalid                                                                                                | invalid_request            | do_not_retry                    |
| `70`   | Legacy `x_method` invalid                                                                                                | invalid_request            | do_not_retry                    |
| `71`   | Bank `accountType` invalid                                                                                               | invalid_request            | do_not_retry                    |
| `72`   | `authCode` longer than six characters                                                                                    | invalid_request            | do_not_retry                    |
| `73`   | Driver's license date of birth invalid                                                                                   | invalid_request            | do_not_retry                    |
| `74`   | Duty amount invalid                                                                                                      | invalid_amount             | do_not_retry                    |
| `75`   | Freight amount invalid                                                                                                   | invalid_amount             | do_not_retry                    |
| `76`   | Tax amount invalid                                                                                                       | invalid_amount             | do_not_retry                    |
| `77`   | SSN or tax ID invalid                                                                                                    | invalid_request            | do_not_retry                    |
| `78`   | Card code format invalid                                                                                                 | invalid_request            | customer_action_required        |
| `79`   | Driver's license number invalid                                                                                          | invalid_request            | do_not_retry                    |
| `80`   | Driver's license state invalid                                                                                           | invalid_request            | do_not_retry                    |
| `81`   | Requested form type invalid; integration not compatible with AIM                                                         | configuration              | do_not_retry                    |
| `82`   | Scripts only supported in version 2.5 (no longer supported)                                                              | configuration              | do_not_retry                    |
| `83`   | Requested script invalid or no longer supported                                                                          | configuration              | do_not_retry                    |
| `84`   | `deviceType` missing or invalid (retail)                                                                                 | invalid_request            | do_not_retry                    |
| `85`   | `marketType` missing or invalid                                                                                          | invalid_request            | do_not_retry                    |
| `86`   | Legacy response format invalid                                                                                           | invalid_request            | do_not_retry                    |
| `87`   | Market type not allowed for this account (for example swipe on an e-commerce account)                                    | configuration              | do_not_retry                    |
| `88`   | Track 1 data invalid                                                                                                     | invalid_request            | customer_action_required        |
| `89`   | Track 2 data invalid                                                                                                     | invalid_request            | customer_action_required        |
| `90`   | ACH not allowed on a card-present account                                                                                | configuration              | do_not_retry                    |
| `91`   | Version 2.5 no longer supported                                                                                          | configuration              | do_not_retry                    |
| `92`   | Integration method no longer supported (often mixed methods)                                                             | configuration              | do_not_retry                    |
| `93`   | Valid country required (Wells Fargo SecureSource)                                                                        | invalid_request            | do_not_retry                    |
| `94`   | Shipping state or country invalid (Wells Fargo SecureSource)                                                             | invalid_request            | do_not_retry                    |
| `95`   | Valid state required (Wells Fargo SecureSource)                                                                          | invalid_request            | do_not_retry                    |
| `96`   | Buyer country not authorized (Wells Fargo SecureSource)                                                                  | fraud_or_risk              | do_not_retry                    |
| `97`   | SIM fingerprint expired                                                                                                  | configuration              | retry_conditionally             |
| `98`   | SIM fingerprint already used                                                                                             | duplicate_request          | do_not_retry                    |
| `99`   | SIM fingerprint does not match                                                                                           | configuration              | do_not_retry                    |
| `100`  | eCheck type invalid                                                                                                      | invalid_request            | do_not_retry                    |
| `101`  | Account name or type does not match the bank's change notice (NOC) record                                                | invalid_request            | customer_action_required        |
| `102`  | Not accepted: transaction key sent with a WebLink request (sunset method)                                                | configuration              | do_not_retry                    |
| `103`  | Not accepted; documented as no longer in use                                                                             | unknown                    | unknown                         |
| `104`  | Under review: eCheck country value failed validation                                                                     | fraud_or_risk              | manual_review                   |
| `105`  | Under review: eCheck city and country failed validation                                                                  | fraud_or_risk              | manual_review                   |
| `106`  | Under review: eCheck company failed validation                                                                           | fraud_or_risk              | manual_review                   |
| `107`  | Under review: bank account name failed validation                                                                        | fraud_or_risk              | manual_review                   |
| `108`  | Under review: eCheck first and last name failed validation                                                               | fraud_or_risk              | manual_review                   |
| `109`  | Under review: eCheck first and last name failed validation                                                               | fraud_or_risk              | manual_review                   |
| `110`  | Under review: account name has invalid characters                                                                        | fraud_or_risk              | manual_review                   |
| `111`  | Valid billing country required (Wells Fargo SecureSource)                                                                | invalid_request            | do_not_retry                    |
| `112`  | Valid billing state/province required (Wells Fargo SecureSource)                                                         | invalid_request            | do_not_retry                    |
| `113`  | Commercial card type invalid                                                                                             | invalid_request            | do_not_retry                    |
| `114`  | Account in test mode; automated (recurring) payment skipped                                                              | configuration              | do_not_retry                    |
| `115`  | Account inactive; automated payment skipped                                                                              | configuration              | do_not_retry                    |
| `116`  | Authentication indicator (ECI/UCAF) invalid                                                                              | authentication_failed      | do_not_retry                    |
| `117`  | Cardholder authentication value (CAVV/AAV) invalid                                                                       | authentication_failed      | do_not_retry                    |
| `118`  | Invalid combination of card type, indicator and authentication value                                                     | authentication_failed      | do_not_retry                    |
| `119`  | Transactions with authentication values cannot be flagged recurring                                                      | invalid_request            | do_not_retry                    |
| `120`  | Original timed out at the authorizer and the system void also failed                                                     | network_or_timeout         | manual_review                   |
| `121`  | Original hit a database error and the system void also failed                                                            | provider_unavailable       | manual_review                   |
| `122`  | Original hit a processing error and the system void also failed                                                          | provider_unavailable       | manual_review                   |
| `123`  | Personal user login used instead of the API login; permission missing                                                    | configuration              | do_not_retry                    |
| `124`  | Processor does not accept recurring transactions                                                                         | configuration              | do_not_retry                    |
| `125`  | Surcharge amount invalid                                                                                                 | invalid_amount             | do_not_retry                    |
| `126`  | Tip amount invalid                                                                                                       | invalid_amount             | do_not_retry                    |
| `127`  | AVS mismatch; the system void failed, so the authorization may stay on the card                                          | fraud_or_risk              | manual_review                   |
| `128`  | Customer's bank does not allow transactions for this account                                                             | card_declined              | customer_action_required        |
| `130`  | Gateway account closed (blacklisted)                                                                                     | configuration              | do_not_retry                    |
| `131`  | Gateway account suspended                                                                                                | configuration              | do_not_retry                    |
| `132`  | Gateway account suspended (blacklist)                                                                                    | configuration              | do_not_retry                    |
| `141`  | FraudScreen rejection; the system void failed                                                                            | fraud_or_risk              | manual_review                   |
| `145`  | Card code and AVS rejection; the system void failed                                                                      | fraud_or_risk              | manual_review                   |
| `152`  | Authorized but merchant not notified; the system void failed                                                             | network_or_timeout         | manual_review                   |
| `153`  | Error processing wallet/opaque payment data (check market type, transaction type, opaque fields)                         | invalid_request            | do_not_retry                    |
| `154`  | Apple Pay not enabled for the account                                                                                    | configuration              | do_not_retry                    |
| `155`  | Processor does not support this way of sending payment data                                                              | configuration              | do_not_retry                    |
| `156`  | Cryptogram invalid or not combinable with other parameters                                                               | invalid_request            | do_not_retry                    |
| `165`  | Card code mismatch per merchant settings; the system void failed                                                         | fraud_or_risk              | manual_review                   |
| `170`  | Concord EFS: provisioning not complete                                                                                   | configuration              | do_not_retry                    |
| `171`  | Concord EFS: request invalid                                                                                             | invalid_request            | do_not_retry                    |
| `172`  | Concord EFS: store ID invalid                                                                                            | configuration              | do_not_retry                    |
| `173`  | Concord EFS: store key invalid                                                                                           | configuration              | do_not_retry                    |
| `174`  | Concord EFS: transaction type not accepted                                                                               | configuration              | do_not_retry                    |
| `175`  | Concord EFS: credits cannot be voided                                                                                    | invalid_request            | do_not_retry                    |
| `180`  | Processor response format invalid (causes listed include voiding a refund, unenrolled AMEX CID, test cards in live)      | unknown                    | manual_review                   |
| `181`  | Invalid processor response and the system void failed                                                                    | provider_unavailable       | manual_review                   |
| `182`  | Sub-merchant values invalid                                                                                              | invalid_request            | do_not_retry                    |
| `183`  | Required sub-merchant values missing                                                                                     | invalid_request            | do_not_retry                    |
| `184`  | Token requestor name invalid                                                                                             | invalid_request            | do_not_retry                    |
| `185`  | Merchant not configured for VPOS                                                                                         | configuration              | do_not_retry                    |
| `186`  | Token requestor ID length invalid                                                                                        | invalid_request            | do_not_retry                    |
| `187`  | Token requestor ECI length invalid                                                                                       | invalid_request            | do_not_retry                    |
| `191`  | Declined (no detail)                                                                                                     | card_declined              | customer_action_required        |
| `192`  | Processing error, try again (no detail)                                                                                  | provider_unavailable       | retry_conditionally             |
| `193`  | Under review (no detail)                                                                                                 | fraud_or_risk              | manual_review                   |
| `195`  | HTML-type configuration fields look unsafe                                                                               | invalid_request            | do_not_retry                    |
| `200`  | FDC Omaha: card number invalid                                                                                           | invalid_request            | customer_action_required        |
| `201`  | FDC Omaha: expiration date invalid                                                                                       | invalid_request            | customer_action_required        |
| `202`  | FDC Omaha: transaction type invalid                                                                                      | invalid_request            | do_not_retry                    |
| `203`  | FDC Omaha: amount invalid                                                                                                | invalid_amount             | do_not_retry                    |
| `204`  | FDC Omaha: department code invalid                                                                                       | configuration              | do_not_retry                    |
| `205`  | FDC Omaha: merchant number invalid                                                                                       | configuration              | do_not_retry                    |
| `206`  | FDC Omaha: merchant not on file                                                                                          | configuration              | do_not_retry                    |
| `207`  | FDC Omaha: merchant account closed                                                                                       | configuration              | do_not_retry                    |
| `208`  | FDC Omaha: merchant not on file                                                                                          | configuration              | do_not_retry                    |
| `209`  | FDC Omaha: could not reach the processor                                                                                 | network_or_timeout         | retry_conditionally             |
| `210`  | FDC Omaha: merchant type incorrect                                                                                       | configuration              | do_not_retry                    |
| `211`  | FDC Omaha: cardholder not on file                                                                                        | card_declined              | customer_action_required        |
| `212`  | FDC Omaha: bank configuration not on file                                                                                | configuration              | do_not_retry                    |
| `213`  | FDC Omaha: merchant assessment code incorrect                                                                            | configuration              | do_not_retry                    |
| `214`  | FDC Omaha: function currently unavailable                                                                                | provider_unavailable       | retry_conditionally             |
| `215`  | FDC Omaha: encrypted PIN field format invalid                                                                            | invalid_request            | do_not_retry                    |
| `216`  | FDC Omaha: ATM terminal ID invalid                                                                                       | configuration              | do_not_retry                    |
| `217`  | FDC Omaha: general message format problem                                                                                | invalid_request            | do_not_retry                    |
| `218`  | FDC Omaha: PIN block format or PIN availability invalid                                                                  | invalid_request            | do_not_retry                    |
| `219`  | FDC Omaha: ETC void unmatched                                                                                            | invalid_request            | manual_review                   |
| `220`  | FDC Omaha: primary CPU not available                                                                                     | provider_unavailable       | retry_conditionally             |
| `221`  | FDC Omaha: SE number invalid                                                                                             | configuration              | do_not_retry                    |
| `222`  | FDC Omaha: duplicate authorization request                                                                               | duplicate_request          | do_not_retry                    |
| `223`  | FDC Omaha: unspecified error                                                                                             | unknown                    | manual_review                   |
| `224`  | FDC Omaha: re-enter the transaction                                                                                      | provider_unavailable       | retry_conditionally             |
| `225`  | DCC action invalid                                                                                                       | invalid_request            | do_not_retry                    |
| `226`  | DCC parameters incomplete                                                                                                | invalid_request            | do_not_retry                    |
| `227`  | Merchant not configured for DCC                                                                                          | configuration              | do_not_retry                    |
| `228`  | DCC not allowed for this transaction type                                                                                | invalid_request            | do_not_retry                    |
| `229`  | A conversion rate is available for this card (informational)                                                             | n/a (informational)        | n/a                             |
| `230`  | Transaction could not be found (DCC context)                                                                             | invalid_request            | do_not_retry                    |
| `231`  | Data differs from the referenced DCC transaction                                                                         | invalid_request            | do_not_retry                    |
| `232`  | Merchant not configured for DCC                                                                                          | configuration              | do_not_retry                    |
| `233`  | DCC action not possible on this transaction                                                                              | invalid_request            | do_not_retry                    |
| `234`  | Transaction already voided                                                                                               | duplicate_request          | do_not_retry                    |
| `235`  | Transaction already captured                                                                                             | duplicate_request          | do_not_retry                    |
| `236`  | DCC data for the referenced transaction unavailable                                                                      | invalid_request            | do_not_retry                    |
| `237`  | Referenced transaction has expired                                                                                       | invalid_request            | do_not_retry                    |
| `238`  | Transaction version does not support DCC                                                                                 | configuration              | do_not_retry                    |
| `239`  | Response format does not support DCC                                                                                     | configuration              | do_not_retry                    |
| `240`  | DCC currency must be US dollars                                                                                          | invalid_request            | do_not_retry                    |
| `241`  | Invalid response from the card processor                                                                                 | provider_unavailable       | retry_conditionally             |
| `242`  | Recurring flag not allowed with DCC                                                                                      | invalid_request            | do_not_retry                    |
| `243`  | Recurring billing not allowed for this eCheck type                                                                       | invalid_request            | do_not_retry                    |
| `244`  | eCheck type not allowed for this bank account type                                                                       | invalid_request            | do_not_retry                    |
| `245`  | eCheck type not allowed on the hosted payment form                                                                       | invalid_request            | do_not_retry                    |
| `246`  | eCheck type not enabled for the account (or check number sent for a type that does not use one)                          | configuration              | do_not_retry                    |
| `247`  | Transaction type and eCheck type combination not allowed                                                                 | invalid_request            | do_not_retry                    |
| `248`  | Check number invalid (letters and digits, up to 15)                                                                      | invalid_request            | do_not_retry                    |
| `250`  | Declined: submitted from a blocked IP address                                                                            | fraud_or_risk              | do_not_retry                    |
| `251`  | Declined by a Fraud Detection Suite filter                                                                               | fraud_or_risk              | do_not_retry                    |
| `252`  | Accepted but held for merchant review (not yet authorized)                                                               | fraud_or_risk              | manual_review                   |
| `253`  | Accepted, authorized, and held for merchant review                                                                       | fraud_or_risk              | manual_review                   |
| `254`  | Declined after manual review                                                                                             | fraud_or_risk              | do_not_retry                    |
| `260`  | Reversal not supported for this transaction type (only authorizations and credits)                                       | invalid_request            | do_not_retry                    |
| `261`  | Encryption error; not processed; try again                                                                               | provider_unavailable       | safe_to_retry_technical_request |
| `262`  | PayformMask invalid                                                                                                      | invalid_request            | do_not_retry                    |
| `265`  | Solution ID invalid                                                                                                      | configuration              | do_not_retry                    |
| `270`  | A line item is invalid                                                                                                   | invalid_request            | do_not_retry                    |
| `271`  | Too many line items (maximum 30)                                                                                         | invalid_request            | do_not_retry                    |
| `280`  | Auction platform name invalid                                                                                            | invalid_request            | do_not_retry                    |
| `281`  | Auction platform ID invalid                                                                                              | invalid_request            | do_not_retry                    |
| `282`  | Auction listing type invalid                                                                                             | invalid_request            | do_not_retry                    |
| `283`  | Auction listing ID invalid                                                                                               | invalid_request            | do_not_retry                    |
| `284`  | Auction seller ID invalid                                                                                                | invalid_request            | do_not_retry                    |
| `285`  | Auction buyer ID invalid                                                                                                 | invalid_request            | do_not_retry                    |
| `286`  | Required auction values missing                                                                                          | invalid_request            | do_not_retry                    |
| `287`  | Auction platform ID and name do not match                                                                                | invalid_request            | do_not_retry                    |
| `288`  | Not accepted (no detail)                                                                                                 | unknown                    | manual_review                   |
| `289`  | Processor does not accept zero-amount authorization for this card type                                                   | configuration              | do_not_retry                    |
| `290`  | Required fields missing or invalid                                                                                       | invalid_request            | do_not_retry                    |
| `295`  | Partially approved on a prepaid card; another payment needed for the balance                                             | insufficient_funds         | customer_action_required        |
| `296`  | Split tender ID invalid                                                                                                  | invalid_request            | do_not_retry                    |
| `297`  | Transaction ID and split tender ID sent together                                                                         | invalid_request            | do_not_retry                    |
| `298`  | Order already released or voided; no new associations                                                                    | invalid_request            | do_not_retry                    |
| `300`  | Device ID invalid                                                                                                        | invalid_request            | do_not_retry                    |
| `301`  | Device batch ID invalid                                                                                                  | invalid_request            | do_not_retry                    |
| `302`  | Reversal flag invalid                                                                                                    | invalid_request            | do_not_retry                    |
| `303`  | Device batch full; close it on the device                                                                                | configuration              | manual_review                   |
| `304`  | Original is in a closed (settled) batch; cannot reverse                                                                  | invalid_request            | do_not_retry                    |
| `305`  | Merchant on auto-close; batches cannot be closed manually                                                                | configuration              | do_not_retry                    |
| `306`  | Batch already closed                                                                                                     | duplicate_request          | do_not_retry                    |
| `307`  | Reversal processed successfully                                                                                          | n/a (success)              | n/a                             |
| `308`  | Original transaction for reversal not found                                                                              | invalid_request            | do_not_retry                    |
| `309`  | Device disabled                                                                                                          | configuration              | do_not_retry                    |
| `310`  | Transaction already voided                                                                                               | duplicate_request          | do_not_retry                    |
| `311`  | Transaction already captured                                                                                             | duplicate_request          | do_not_retry                    |
| `312`  | Security code (CAPTCHA) on the SIM form invalid                                                                          | invalid_request            | customer_action_required        |
| `313`  | New security code requested on the SIM form                                                                              | n/a (informational)        | customer_action_required        |
| `314`  | Cannot be processed (no detail)                                                                                          | unknown                    | manual_review                   |
| `315`  | Card number invalid (processor-issued decline)                                                                           | card_declined              | customer_action_required        |
| `316`  | Expiration date invalid (processor-issued decline)                                                                       | card_declined              | customer_action_required        |
| `317`  | Card expired (processor-issued decline)                                                                                  | card_declined              | customer_action_required        |
| `318`  | Duplicate transaction (processor-issued decline)                                                                         | duplicate_request          | do_not_retry                    |
| `319`  | Transaction not found (processor-issued decline)                                                                         | invalid_request            | do_not_retry                    |
| `320`  | Device not registered or not enabled                                                                                     | configuration              | do_not_retry                    |
| `325`  | Required-field check failed (named processors need billing name and address)                                             | invalid_request            | do_not_retry                    |
| `326`  | Request fields invalid or missing                                                                                        | invalid_request            | do_not_retry                    |
| `327`  | Void failed: type not voidable, or settlement in progress                                                                | invalid_request            | retry_conditionally             |
| `328`  | Validation error at the processor                                                                                        | invalid_request            | do_not_retry                    |
| `330`  | V.me not accepted by the merchant                                                                                        | payment_method_unavailable | customer_action_required        |
| `331`  | `x_call_id` missing                                                                                                      | invalid_request            | do_not_retry                    |
| `332`  | `x_call_id` not found or invalid                                                                                         | invalid_request            | do_not_retry                    |
| `333`  | V.me returned a validation error                                                                                         | invalid_request            | do_not_retry                    |
| `334`  | V.me transaction in an invalid state                                                                                     | invalid_request            | do_not_retry                    |
| `339`  | Send `x_method`, or only `x_call_id`, or only card/account data                                                          | invalid_request            | do_not_retry                    |
| `340`  | V.me cannot void captured or credit transactions; refund after settlement                                                | invalid_request            | retry_conditionally             |
| `341`  | `x_discount` invalid                                                                                                     | invalid_amount             | do_not_retry                    |
| `342`  | `x_giftwrap` invalid                                                                                                     | invalid_amount             | do_not_retry                    |
| `343`  | `x_subtotal` invalid                                                                                                     | invalid_amount             | do_not_retry                    |
| `344`  | `x_misc` invalid                                                                                                         | invalid_amount             | do_not_retry                    |
| `350`  | Country must be a two- or three-character value                                                                          | invalid_request            | do_not_retry                    |
| `351`  | Employee ID length out of range                                                                                          | invalid_request            | do_not_retry                    |
| `355`  | EMV data could not be parsed                                                                                             | invalid_request            | do_not_retry                    |
| `356`  | EMV not supported for this processor and card type                                                                       | payment_method_unavailable | do_not_retry                    |
| `357`  | Opaque descriptor required                                                                                               | invalid_request            | do_not_retry                    |
| `358`  | EMV not supported with this transaction type                                                                             | invalid_request            | do_not_retry                    |
| `359`  | EMV not supported with this market type                                                                                  | invalid_request            | do_not_retry                    |
| `360`  | EMV data could not be decrypted                                                                                          | invalid_request            | manual_review                   |
| `361`  | EMV version invalid                                                                                                      | invalid_request            | do_not_retry                    |
| `362`  | EMV version required                                                                                                     | invalid_request            | do_not_retry                    |
| `363`  | POS entry mode invalid                                                                                                   | invalid_request            | do_not_retry                    |
| `370`  | Signature data too large                                                                                                 | invalid_request            | do_not_retry                    |
| `371`  | Signature must be PNG data                                                                                               | invalid_request            | do_not_retry                    |
| `375`  | Terminal/lane number must be numeric                                                                                     | invalid_request            | do_not_retry                    |
| `380`  | KSN duplicated                                                                                                           | duplicate_request          | do_not_retry                    |
| `901`  | System maintenance; try later                                                                                            | provider_unavailable       | safe_to_retry_technical_request |
| `2000` | PayPal: payer consent needed (redirect via secure acceptance URL)                                                        | authentication_required    | customer_action_required        |
| `2001` | PayPal not accepted by the merchant                                                                                      | payment_method_unavailable | do_not_retry                    |
| `2002` | PayPal requires `x_version` 3.1 or later                                                                                 | configuration              | do_not_retry                    |
| `2003` | Request completed successfully (PayPal)                                                                                  | n/a (success)              | n/a                             |
| `2004` | Success URL required                                                                                                     | invalid_request            | do_not_retry                    |
| `2005` | Cancel URL required                                                                                                      | invalid_request            | do_not_retry                    |
| `2006` | Payer ID required                                                                                                        | invalid_request            | do_not_retry                    |
| `2007` | Processor does not accept zero-amount authorizations                                                                     | configuration              | do_not_retry                    |
| `2008` | Reference not eligible for a continued authorization                                                                     | invalid_request            | do_not_retry                    |
| `2009` | Reference not eligible for a continued authorization with auto capture                                                   | invalid_request            | do_not_retry                    |
| `2100` | PayPal success URL invalid                                                                                               | invalid_request            | do_not_retry                    |
| `2101` | PayPal cancel URL invalid                                                                                                | invalid_request            | do_not_retry                    |
| `2102` | PayPal payment not authorized by the buyer                                                                               | authentication_required    | customer_action_required        |
| `2103` | Already authorized                                                                                                       | duplicate_request          | do_not_retry                    |
| `2104` | Cart item totals do not match the order amount                                                                           | invalid_amount             | do_not_retry                    |
| `2105` | PayPal rejected: Payer ID invalid                                                                                        | invalid_request            | do_not_retry                    |
| `2106` | PayPal already captured this transaction                                                                                 | duplicate_request          | do_not_retry                    |
| `2107` | PayPal rejected: Payer ID belongs to another customer                                                                    | invalid_request            | do_not_retry                    |
| `2108` | PayPal rejected: header image value too long                                                                             | invalid_request            | do_not_retry                    |
| `2109` | PayPal rejected: color must be six hex characters                                                                        | invalid_request            | do_not_retry                    |
| `2200` | WePay merchants: capture amount must equal the authorized amount; void if needed                                         | invalid_amount             | do_not_retry                    |

Code only in `content/dam/data/anetd/responseCodes.json` (not in the reference list or the HTML table):

| Code   | Meaning (paraphrase)                              | Category            | Retry |
| ------ | ------------------------------------------------- | ------------------- | ----- |
| `2201` | Record already deleted (same wording as `I00003`) | n/a (informational) | n/a   |

"retry_conditionally" for timeouts and processor errors means: confirm the transaction's real state first (reporting API or webhook), because the original may have been authorized. Codes 120-122, 127, 141, 145, 152, 165 and 181 explicitly describe a failed automatic void, so a hold may remain on the card. Code 52 says the transaction was authorized but will not be settled.

### 6.4 AVS (`avsResultCode`, `AVSResponse` in transaction details, `avsResponse` in webhooks): 13 values

| Value | Meaning (paraphrase)                   |
| ----- | -------------------------------------- |
| `A`   | Street matched, postal code did not    |
| `B`   | No address information provided        |
| `E`   | AVS error                              |
| `G`   | Non-U.S. issuer, AVS not supported     |
| `N`   | Neither street nor postal code matched |
| `P`   | AVS not applicable                     |
| `R`   | AVS unavailable or timed out; retry    |
| `S`   | Issuer does not support AVS            |
| `U`   | Address information unavailable        |
| `W`   | ZIP+4 matched, street did not          |
| `X`   | Street and ZIP+4 matched               |
| `Y`   | Street and postal code matched         |
| `Z`   | Postal code matched, street did not    |

AVS values are not errors by themselves. A rejection by the merchant's AVS filter shows up as reason code `27` (or `45`, `127`).

### 6.5 Card code (`cvvResultCode`, `cardCodeResponse`): 5 values

`M` matched; `N` did not match; `P` not processed; `S` should be on the card but was not indicated; `U` issuer could not process the check. Filter rejections show up as reason codes `44`, `45`, `65`, `165`.

### 6.6 CAVV (`cavvResultCode`, `CAVVResponse`): 13 values

Blank or absent: not validated. `0` not validated because of erroneous data; `1` failed; `2` passed; `3` could not be performed, issuer attempt incomplete; `4` could not be performed, issuer system error; `5` and `6` reserved; `7` failed, issuer available (U.S. card, non-U.S. acquirer); `8` passed, issuer available (same scope); `9` failed, issuer unavailable (same scope); `A` passed, issuer unavailable (same scope); `B` passed, information only, no liability shift. The reference says Mastercard transactions always return a null CAVV result.

### 6.7 Count summary

| Table                                            | Codes      |
| ------------------------------------------------ | ---------- |
| `responseCode`                                   | 4          |
| `I` informational codes                          | 12         |
| `E` error codes                                  | 161        |
| Numeric reason codes (reference list)            | 306        |
| Numeric reason code only in the second JSON file | 1 (`2201`) |
| AVS                                              | 13         |
| Card code                                        | 5          |
| CAVV (including blank)                           | 13         |
| **Response code reference total**                | **479**    |

---

## 7. Lifecycle

### 7.1 Transaction types (`transactionType`)

From payment-transactions and the XSD `transactionTypeEnum`:

| `transactionType`                                                                        | Meaning                                                                                           | Reference field               | Response `transId`                                                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `authCaptureTransaction`                                                                 | Authorize and queue for settlement in one step (default)                                          | none                          | new                                                                                                           |
| `authOnlyTransaction`                                                                    | Authorize only; expires if not captured within 30 days                                            | none                          | new                                                                                                           |
| `priorAuthCaptureTransaction`                                                            | Capture an earlier authOnly (once, amount up to the authorized amount, within 30 days)            | `refTransId` = auth `transId` | Example shows the **same** ID as the authorization (`transId` = `refTransID`)                                 |
| `captureOnlyTransaction`                                                                 | Capture with an authorization code obtained outside the gateway (voice authorization)             | `authCode`                    | new                                                                                                           |
| `voidTransaction`                                                                        | Cancel an unsettled transaction                                                                   | `refTransId`                  | Example shows the same ID as the original                                                                     |
| `refundTransaction`                                                                      | Credit a settled transaction (default within 180 days, up to the settled amount, partial allowed) | `refTransId`                  | **New** ID ("a new and distinct transaction ... with its own unique transaction ID"); `refTransID` = original |
| `authOnlyContinueTransaction`, `authCaptureContinueTransaction`, `getDetailsTransaction` | PayPal Express Checkout follow-up steps                                                           | `refTransId`                  | see PayPal examples                                                                                           |

Partial authorization / split tender: `allowPartialAuth`, then `splitTenderId` groups the payments; `splitTenderStatus` is `completed`, `held` or `voided`. Settlement happens "within 24 hours" in a daily batch.

### 7.2 Transaction status (`transactionStatus`, reporting API only)

The API reference lists 18 values: `authorizedPendingCapture`, `capturedPendingSettlement`, `communicationError`, `refundSettledSuccessfully`, `refundPendingSettlement`, `approvedReview`, `declined`, `couldNotVoid`, `expired`, `generalError`, `failedReview`, `settledSuccessfully`, `settlementError`, `underReview`, `voided`, `FDSPendingReview`, `FDSAuthorizedPendingReview`, `returnedItem`.

The XSD `transactionStatusEnum` adds 6 more: `pendingFinalSettlement`, `pendingSettlement`, `updatingSettlement`, `chargeback`, `chargebackReversal`, `authorizedPendingRelease`. Their meaning is **NOT DOCUMENTED**.

Suggested card timeline (inferred from the type descriptions and examples, not a published state diagram):

- authOnly approved -> `authorizedPendingCapture` -> priorAuthCapture -> `capturedPendingSettlement` -> batch -> `settledSuccessfully`; or -> void -> `voided`; or 30 days -> `expired`.
- authCapture approved -> `capturedPendingSettlement` -> `settledSuccessfully` (or `settlementError`).
- refund -> `refundPendingSettlement` -> `refundSettledSuccessfully`.
- AFDS hold (`responseCode` 4): `FDSPendingReview` (held without authorization) or `FDSAuthorizedPendingReview` (authorized and held) -> merchant approves or declines (`updateHeldTransactionRequest` action `approve`/`decline`) -> `approvedReview` / `failedReview` is the likely mapping, but the exact transitions are **NOT DOCUMENTED**.
- eCheck: `returnedItem` with `returnedItems[]` (`id`, `dateUTC`, `dateLocal`, `code` = ACH return code). `underReview` usage is **NOT DOCUMENTED** beyond the reason codes 104-110.

Other values in examples: `transactionStatus` `FDSPendingReview` in the held-transaction list; `getUnsettledTransactionList` accepts `status` `pendingApproval`.

### 7.3 Fraud review

`FDSFilterAction` / `FDSFilter.action` values: `reject`, `decline`, `hold`, `authAndHold`, `report`. The most restrictive applies when several filters match. Held transactions are `responseCode` 4 and can still carry an `authCode` when the filter action is `authAndHold`. Webhook events `net.authorize.payment.fraud.held`, `.approved`, `.declined` report the review (section 8).

### 7.4 Subscriptions (ARB)

`status`: `active`, `expired`, `suspended`, `canceled`, `terminated`. A subscription is suspended when its first payment (or the first after an edit) fails or when the card expires; if not fixed before the next run date it becomes terminated; canceled and terminated subscriptions cannot be reactivated. ARB transactions run at about 2:00 a.m. PST. Subscription-generated transactions carry `subscription.id` and `subscription.payNum` in transaction details. Webhook events: `net.authorize.customer.subscription.created|updated|suspended|terminated|cancelled|expiring|expired|failed` (note the webhook spelling `cancelled` vs status `canceled`).

### 7.5 Chargebacks, payouts, wallets

- Card chargebacks: no webhook event, no chargeback API and no chargeback reason codes are documented. The XSD has `chargeback` and `chargebackReversal` transaction statuses without description. Batch statistics report eCheck chargeback counts and amounts (`chargebackAmount`, `chargebackCount`, `chargeChargeBackAmount`, `chargeChargeBackCount`, `refundChargeBackAmount`, `refundChargeBackCount`) plus returns and notices of change.
- Payouts to the merchant: funding is done by the merchant service provider (pricing FAQ); no payout payload exists.
- Wallet semantics: Apple Pay, Google Pay and Accept.js nonces are payment data (`opaqueData.dataDescriptor` `COMMON.APPLE.INAPP.PAYMENT`, `COMMON.GOOGLE.INAPP.PAYMENT`, `COMMON.ACCEPT.INAPP.PAYMENT`); results come back as normal card `transactionResponse`. PayPal Express Checkout uses the same response with `accountType` `PayPal`, `secureAcceptance` and reason codes 2000-2109.

---

## 8. Notifications (Webhooks)

| Aspect                | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport             | HTTP POST ("post message") to the URL registered with the Webhooks REST API or the Merchant Interface. URL may contain only letters, digits, dot, hyphen, underscore and slash.                                                                                                                                                                                                                                                             |
| Body                  | JSON envelope: `notificationId` (UUID), `eventType`, `eventDate` (ISO 8601 with fractional seconds and `Z` in examples), `webhookId` (UUID), `payload`                                                                                                                                                                                                                                                                                      |
| Content-Type header   | **NOT DOCUMENTED** (examples are JSON)                                                                                                                                                                                                                                                                                                                                                                                                      |
| Payload common fields | `entityName` (`transaction`, `customerProfile`, `customerPaymentProfile`, `subscription`; boarding uses `boardingApplication`) and `id` (the `transId`, `customerProfileId`, `customerPaymentProfileId` or `subscriptionId` matching `entityName`). `merchantReferenceId` "corresponds to the refId field in the Authorize.net API".                                                                                                        |
| Transaction payload   | Examples show `responseCode` (number), `merchantReferenceId`, `authCode`, `avsResponse`, `authAmount` (number), `entityName`, `id`; fraud events add `fraudList[]` `{fraudFilter, fraudAction}`. A full field list, and whether refund/void payloads carry `refTransId`, an amount, a currency, an invoice number or a reason code, are **NOT DOCUMENTED**. The docs advise calling `getTransactionDetails` for details and current status. |
| Event types           | 23 from `GET /rest/v1/eventtypes` plus 6 partner boarding events (29 total), listed below                                                                                                                                                                                                                                                                                                                                                   |
| Signature (sensitive) | Header `X-ANET-Signature`. Value is an HMAC-SHA512 of the notification body keyed with the merchant's Signature Key; mismatches should be rejected. The exact header value format (any prefix, letter case) is **NOT DOCUMENTED** on the pages read, and no official sample verifying it was found in the GitHub repositories checked. Verification needs the Signature Key; PandaPayLens should only detect and redact the header.         |
| Acknowledgement       | HTTP 200. Docs recommend replying 200 before back-end processing.                                                                                                                                                                                                                                                                                                                                                                           |
| Retry                 | Up to 10 retries after a failed attempt: 3 at three-minute intervals, 3 at eight-hour intervals, 4 at 48-hour intervals. After all fail the webhook is set to inactive and no further notifications are sent to it.                                                                                                                                                                                                                         |
| History               | `GET /rest/v1/notifications` and `/notifications/{notificationId}` return `deliveryStatus` (`Delivered`, `Failed`), `retryLog.logs[]` (`statusCode`, `retryStage`, `retryCountInStage`, `retryDate`, `message`) and the original `payload`.                                                                                                                                                                                                 |
| Duplicates            | The history groups all attempts of one event occurrence under one `notificationId`, which suggests retries reuse it; the docs do not say so explicitly. Suggested dedupe key: `notificationId`, falling back to `eventType` + `payload.entityName` + `payload.id`.                                                                                                                                                                          |
| Ordering              | **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Testing               | `POST /rest/v1/webhooks/{id}/pings` sends a test notification, only for inactive webhooks. Test payload content is **NOT DOCUMENTED**.                                                                                                                                                                                                                                                                                                      |
| Source IPs            | **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                          |

Event types:

| Group            | Event                                                                                                                                                             | Meaning (paraphrase)                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Payment          | `net.authorize.payment.authorization.created`                                                                                                                     | An authorization (authOnly) was created                                                            |
|                  | `net.authorize.payment.authcapture.created`                                                                                                                       | An authorization and capture was created                                                           |
|                  | `net.authorize.payment.capture.created`                                                                                                                           | A capture was created                                                                              |
|                  | `net.authorize.payment.priorAuthCapture.created`                                                                                                                  | An earlier authorization was captured                                                              |
|                  | `net.authorize.payment.refund.created`                                                                                                                            | A settled transaction was refunded                                                                 |
|                  | `net.authorize.payment.void.created`                                                                                                                              | An unsettled transaction was voided                                                                |
| Fraud            | `net.authorize.payment.fraud.held`                                                                                                                                | Transaction held as suspicious                                                                     |
|                  | `net.authorize.payment.fraud.approved`                                                                                                                            | Held transaction approved                                                                          |
|                  | `net.authorize.payment.fraud.declined`                                                                                                                            | Held transaction declined                                                                          |
| Customer profile | `net.authorize.customer.created`, `.updated`, `.deleted`                                                                                                          | Profile created / updated / deleted (deleting a profile does not send events for its sub-profiles) |
| Payment profile  | `net.authorize.customer.paymentProfile.created`, `.updated`, `.deleted`                                                                                           | Payment profile created / updated / deleted                                                        |
| Subscription     | `net.authorize.customer.subscription.created`, `.updated`, `.suspended`, `.terminated`, `.cancelled`, `.expiring` (one charge left), `.expired`, `.failed`        | Subscription lifecycle                                                                             |
| Partner boarding | `net.authorize.partner.boarding.gateway.created`, `.rejected`, `.incomplete`, `.merchantAccount.created`, `.merchantAccount.rejected`, `.merchantAccount.updated` | Partner boarding progress; out of scope                                                            |

Whether `capture.created` is the event for `captureOnlyTransaction` is not stated; the description only says "a capture transaction was created".

Example: payment event. **Transcribed from https://developer.authorize.net/api/reference/features/webhooks.html** (Payment Events Payload Example; indentation normalized):

```text
{
  "notificationId": "d0e8e7fe-c3e7-4add-a480-27bc5ce28a18",
  "eventType": "net.authorize.payment.authcapture.created",
  "eventDate": "2017-03-29T20:48:02.0080095Z",
  "webhookId": "63d6fea2-aa13-4b1d-a204-f5fbc15942b7",
  "payload": {
    "responseCode": 1,
    "merchantReferenceId": "19102146534003137356",
    "authCode": "LZ6I19",
    "avsResponse": "Y",
    "authAmount": 45.00,
    "entityName": "transaction",
    "id": "60020981676"
  }
}
```

Example: fraud hold. **Transcribed from the same page** (indentation normalized):

```json
{
  "notificationId": "26024a6c-3b78-4d18-8ce7-53dd020aee72",
  "eventType": "net.authorize.payment.fraud.held",
  "eventDate": "2016-10-24T17:47:39.7740424Z",
  "webhookId": "71400fce-085f-46fe-9758-8311ca01d33e",
  "payload": {
    "responseCode": 4,
    "authCode": "24904A",
    "avsResponse": "Y",
    "authAmount": 50000.0,
    "fraudList": [
      {
        "fraudFilter": "AmountFilter",
        "fraudAction": "authAndHold"
      }
    ],
    "entityName": "transaction",
    "id": "2154067719"
  }
}
```

Related response hash (not a webhook, but also an integrity value): `transHashSha2` = HMAC-SHA512, keyed with the Signature Key (hex-decoded to bytes), over `^` + API Login ID + `^` + `transId` + `^` + amount + `^` (hash guide; the C# and Node samples output uppercase hex). The guide says the amount comes from the response `amount` element, but `createTransactionResponse` has no `amount` element (section 12), so the value can only be checked when the request amount is known. Verification is out of scope for PandaPayLens.

---

## 9. Identifiers

| Field                                                                                                      | Where                                                              | Notes                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transId`                                                                                                  | `transactionResponse`, transaction details, webhook `payload.id`   | Numeric string, gateway-assigned. `"0"` for errors and test mode. Captures (priorAuthCapture) and voids keep the original ID in the examples; refunds get a new one |
| `refTransID` (response) / `refTransId` (request, details)                                                  | Parent link                                                        | Present on capture, void and refund responses. In transaction details it "appears only for linked credits"                                                          |
| `refId` / webhook `merchantReferenceId`                                                                    | Merchant request reference                                         | Up to 20 characters; echoed only if sent; the only merchant-side reference that reaches webhooks                                                                    |
| `order.invoiceNumber`                                                                                      | Request; transaction details; Accept Hosted (`orderInvoiceNumber`) | Up to 20 characters. **Not** returned in `createTransactionResponse` or in webhook payloads                                                                         |
| `order.purchaseOrderNumber` / `poNumber`, `supplierOrderReference`                                         | Request; details                                                   | Merchant references                                                                                                                                                 |
| `splitTenderId`                                                                                            | Response, details                                                  | Groups partial authorizations                                                                                                                                       |
| `networkTransId` / `originalNetworkTransId`                                                                | Response / request                                                 | Card network transaction ID for card-on-file chains (MIT/CIT)                                                                                                       |
| `subscriptionId`, `subscription.id`, `payNum`                                                              | ARB responses, details, webhook `id`                               | Links recurring transactions to a subscription                                                                                                                      |
| `customerProfileId`, `customerPaymentProfileId`, `customerShippingAddressId` / `customerShippingProfileId` | CIM responses, `profile`, webhooks                                 | Profile IDs (numbers in some webhook payloads, strings in others)                                                                                                   |
| `customer.id`, `merchantCustomerId`                                                                        | Request, details, customer webhook                                 | Merchant-assigned customer ID (up to 20); Authorize.net does not generate it                                                                                        |
| `batch.batchId`                                                                                            | Details, batch reports                                             | Settlement batch                                                                                                                                                    |
| `notificationId`, `webhookId`                                                                              | Webhooks                                                           | Event delivery and subscription IDs (UUID)                                                                                                                          |
| `solution.id`                                                                                              | Request                                                            | Partner solution ID (sandbox test IDs `AAA100302`, `AAA100303`, `AAA100304`)                                                                                        |
| `authCode`                                                                                                 | Response, webhooks                                                 | Issuer code; not unique                                                                                                                                             |

Correlation guidance: within API responses, `transId` + `refTransID` gives an explicit parent link. Webhooks only give `payload.id` (the transaction's own ID) and `merchantReferenceId`, so linking a refund webhook to its original sale requires a matching API response or transaction details record.

---

## 10. Sensitive fields

Redact or mask by default. Request fields are included because developers often paste request and response together.

- **Credentials and secrets**: `merchantAuthentication.name` (API Login ID), `merchantAuthentication.transactionKey`, `merchantAuthentication.accessToken` (OAuth), Signature Key, `X-ANET-Signature` header, `Authorization: Basic ...` header of the Webhooks REST API (base64 of login ID and transaction key), `transHashSha2` and `transHash` (integrity values, not secrets, but tied to the Signature Key). The API reference itself contains one sample transaction key value; never reproduce such values.
- **Card data**: `cardNumber`, `expirationDate`, `cardCode`, `trackData.track1`, `trackData.track2`, `emvResponse.tlvData`, `cardholderAuthentication.cardholderAuthenticationValue` (CAVV), `opaqueData.dataValue` (wallet/Accept nonce). Responses carry masked `accountNumber` (`XXXX1111`) and details carry masked `expirationDate` (`XXXX`).
- **Bank data**: `bankAccount.routingNumber`, `bankAccount.accountNumber`, `nameOnAccount`, `checkNumber`.
- **Personal data**: `billTo`/`shipTo` (`firstName`, `lastName`, `company`, `address`, `city`, `state`, `zip`, `country`, `phoneNumber`, `faxNumber`), `customer.email`, `customer.id`, `customerIP`, `merchantCustomerId`, profile `description`, `customerSignature`, PayPal `PayerID` and `PayerEmail`, Accept Hosted `billTo`/`shipTo`/`customerId`.
- **Merchant pass-through**: `userFields` (the reference warns not to put sensitive data there, so it may still contain some).
- **URLs with tokens**: `secureAcceptance.SecureAcceptanceUrl` (PayPal token), Accept Hosted and Accept Customer form tokens.
- The official SDKs mask these tags in their logs: `cardCode`, `cardNumber`, `expirationDate`, `accountNumber`, `nameOnAccount`, `transactionKey`, plus regexes for Visa, Mastercard, Discover/UnionPay, JCB and Amex card numbers (`AuthorizedNetSensitiveTagsConfig.json` in sdk-php and sdk-java). PandaPayLens should cover at least the same set.

---

## 11. Structural detection hints

Strong Authorize.net signals (combine several):

1. **createTransactionResponse JSON**: object with `transactionResponse` containing camelCase `responseCode` (string `1`-`4`), `transId`, `refTransID` (capital `ID`), `authCode`, `avsResultCode`, `cvvResultCode`, `cavvResultCode`, `accountNumber` starting `XXXX`, `accountType`, and either `messages[]` of `{code, description}` or `errors[]` of `{errorCode, errorText}`; plus a top-level `messages` object with `resultCode` `Ok`/`Error` and `message[]` of `{code, text}` where `code` matches `^[IE]\d{5}$`.
2. Distinctive keys: `transHashSha2` (128 hex), `transHash` (32 hex), `testRequest`, `SupplementalDataQualificationIndicator`, `networkTransId`, `splitTenderPayments`, `secureAcceptance.SecureAcceptanceUrl`, `profileResponse`.
3. **API-level response without a transaction**: only `messages` (and maybe `refId`) with an `I`/`E` code; still clearly Authorize.net because of the `^[IE]\d{5}$` code shape plus `resultCode` `Ok`/`Error`.
4. **XML**: namespace `AnetApi/xml/v1/schema/AnetApiSchema.xsd`, roots ending in `Response` (`createTransactionResponse`, `getTransactionDetailsResponse`, `ARB...Response`).
5. **Webhook**: JSON with exactly `notificationId`, `eventType` starting `net.authorize.`, `eventDate`, `webhookId`, `payload.entityName`, `payload.id`; header `X-ANET-Signature`.
6. **Notification history record**: `deliveryStatus`, `retryLog.logs[]` with `retryStage`/`retryCountInStage`, `_links.self.href` starting `/rest/v1/notifications/`.
7. **Accept Hosted message**: string `action=transactResponse&response={...}` whose JSON has `accountType`, `accountNumber`, `transId`, `responseCode`, `authorization`, `totalAmount`, `dateTime` (`M/D/YYYY h:mm:ss AM`), `orderInvoiceNumber`.
8. **Transaction details**: `transaction.transactionStatus` from the list in section 7.2, `responseReasonCode`, `responseReasonDescription`, `AVSResponse`, `cardCodeResponse`, `FDSFilterAction`, `submitTimeUTC`.
9. Hosts and paths: `api.authorize.net`, `api2.authorize.net`, `apitest.authorize.net`, `/xml/v1/request.api`, `/rest/v1/`, `accept.authorize.net`, `test.authorize.net`; legacy `secure.authorize.net/gateway/transact.dll`, `secure2.authorize.net`.

How this differs from other providers:

- **NMI**: both use a "1 approved / 2 declined / 3 error" overall result, so the number alone is not enough. NMI's Classic response is a flat URL-encoded string with lowercase keys (`response`, `responsetext`, `authcode`, `transactionid`, `avsresponse`, `cvvresponse`, `response_code` with 3-digit values such as `100`/`200`/`300`). Authorize.net uses nested JSON or XML with camelCase keys, has a fourth result `4` (held), uses reason codes that are mostly 1-3 digits without NMI's 100/200/300 banding, and has the `I`/`E` message layer. NMI webhooks use `event_id`/`event_type`/`event_body` and a `Webhook-Signature: t=...,s=...` header, not `notificationId`/`eventType`/`payload` and `X-ANET-Signature`. Attribution caveat: this repository's NMI research (`docs/providers/high-risk/research/nmi.md`) records that NMI runs an Authorize.Net emulator for the AIM/SIM/XML formats; an Authorize.net-shaped payload could therefore come from an NMI emulator endpoint. This is not verified from Authorize.net sources; host names in the paste are the only reliable tie-break.
- **Adyen**: top-level `resultCode` values are words like `Authorised`/`Refused` with `pspReference`; webhooks have `notificationItems[].NotificationRequestItem` with `eventCode`. Authorize.net's `resultCode` is only `Ok`/`Error` and lives inside `messages`.
- **Stripe**: `object` field, prefixed IDs (`pi_`, `ch_`, `evt_`), event `type` like `payment_intent.succeeded`. Authorize.net IDs are plain numbers or UUIDs and event types start with `net.authorize.`.
- **payabl.**: URL-encoded `transactionid`/`transid`, `status`/`errormessage`, negative codes such as `-6000`. No overlap in shape.
- **Checkout.com**: snake_case `response_code` (5-digit), `response_summary`, event `type` like `payment_captured`.
- **PayPal**: `event_type` in uppercase dotted form (`PAYMENT.CAPTURE.COMPLETED`), `resource`, `links`. Note Authorize.net itself returns `accountType` `PayPal` for PayPal Express Checkout through the gateway; that is an Authorize.net payload, not a PayPal one.
- **Braintree**: form-encoded `bt_signature`/`bt_payload` webhooks and XML; no `transactionResponse`.
- **Mollie**: `id` like `tr_...`, `resource: "payment"`.
- **Square**: `event_id`, `type` like `payment.updated`, `merchant_id`, `data.object`.
- **Skrill**: also has a `notificationId`, but with `timestamp` and `data.accountId`/`data.availableBalance`; no `eventType` starting with `net.authorize.`, no `webhookId`.
- **Other candidates in this repository** (CCBill, Segpay, Verotel, NetBilling, emerchantpay, Ecommpay, Paymentwall, MiFinity, AstroPay, Trustly, Inpay, PXP, Decta, Trust Payments, Finrax, ezeeWallet): none of their adapters use `transactionResponse`, `transId`, `refTransID`, `webhookId`, `entityName` or `X-ANET-Signature` (checked against the adapter sources). `responseCode`-like names appear there only in snake_case (`response_code`).

---

## 12. Limitations, ambiguities and documentation inconsistencies

1. **Two layers of codes, same numbers**: `transactionResponse.responseCode` (1-4) and the reason codes share the values 1-4 (`1` approved, `2`/`3`/`4` declines). An adapter must never look up `responseCode` in the reason code table or vice versa.
2. **Shared texts**: many reason codes have the same customer text ("This transaction has been declined.", "An error occurred during processing. Please try again.", "This transaction cannot be processed."); the difference is only in the separate suggestions fields. Codes 104-110 say "under review" in their text but their suggestions describe eCheck field validation failures.
3. **Two response code files disagree**: `dist/json/responseCodes.json` (479 entries, linked as "the latest version") vs `content/dam/data/anetd/responseCodes.json` (474 entries, used by the Code Tool page). The second lacks `E00042`, `E00043`, `E00147`-`E00151`, adds `2201` and an empty-key entry, and gives code `38` the currency text of code `39` instead of "Global Payment System identification numbers are incorrect". 29 entries have small text differences (punctuation, double periods).
4. **Code Tool page text**: says informational codes may begin with a "1" prefix, "e.g. '100004'", while every documented informational code starts with `I`.
5. **`E00002`** says only `text/xml` and `application/xml` are supported, although the same reference documents `application/json`.
6. **`E00027` text varies**: the Update Split Tender Group example returns `E00027` with "The specified SplitTenderID is invalid." instead of "The transaction was unsuccessful."
7. **No decline/held example** for `createTransactionResponse`; the `resultCode`/`E` code that accompanies `responseCode` 2 or 4 is not shown.
8. **`refTransID` vs `refTransId`**: responses (and the XSD) use `refTransID`; the response field table and requests use `refTransId`.
9. **`transHashSha2` vs `transHashSHA2`**: the reference and JSON use `transHashSha2`; the hash guide uses `transHashSHA2`. The hash guide also says to take the amount from the response `amount` element, which `createTransactionResponse` does not have.
10. **`transHash`**: the change log says production stopped sending a value on 2019-06-27, yet every current example still shows a 32-hex value. Treat a present value as possible but not expected.
11. **Fields in examples but not in tables**: `testRequest`, `rawResponseCode`, `SupplementalDataQualificationIndicator` (the last is also absent from the XSD).
12. **XML example structure**: in the Charge a Credit Card XML example `<message>` sits directly under `<transactionResponse>` without `<messages>`, while other XML examples and the XSD use `<messages><message>`.
13. **Card brand spelling**: field tables and examples use `Mastercard`; XSD `cardTypeEnum` and the Accept Hosted example use `MasterCard`. `accountType` lists `UnionChinaPay` while other tables say `ChinaUnionPay`.
14. **CAVV for Mastercard**: the reference says Mastercard always returns a null CAVV result, but the Authorize a Credit Card JSON example shows `"cavvResultCode": "6"` (a "reserved" value) on a Mastercard transaction.
15. **`transactionStatus` list**: the HTML reference lists 18 values; the XSD has 24. `chargeback`, `chargebackReversal`, `pendingFinalSettlement`, `pendingSettlement`, `updatingSettlement`, `authorizedPendingRelease` are undocumented.
16. **Webhook payload gaps**: the field set is known only from examples; the failed-delivery example has `"responseCode": 0` (not a documented value); refund and void payloads are not shown. Value types differ from API responses (numbers vs strings).
17. **Webhook example defects**: the Update a Webhook request example is missing a comma; the Boarding Event example uses typographic quotes around `processorInfo` and `EVO`, so it is not valid JSON; the boarding table lists `net.authorize.partner.boarding.merchantAccount.updated.` with a trailing dot; the verification text says a mismatch "could indicate a thread" (threat). `eventDate` has a `Z` suffix in payload examples but not in notification-history examples.
18. **Webhook spelling**: event `...subscription.cancelled` vs subscription status `canceled`.
19. **Signature header format** (`X-ANET-Signature` value layout) and notification `Content-Type` are not documented.
20. **API Login ID length**: "20-character maximum" in one table, "up to 25 characters" in the subscription status request table.
21. **Testing guide wording**: uses "Response Code" for values that are reason codes (for example `$70.05` -> `35`). Test mode returns `transId` `0`, which looks like an error.
22. **Accept Hosted**: the text says "action=transactionResponse" while the example shows `action=transactResponse`.
23. **Platform change**: the Canada pilot blog says Authorize.net is moving onto the Visa Acceptance Platform without merchant changes; whether payload formats change is not documented.
24. **Processor-specific codes**: FDC Omaha (200-224), Concord EFS (170-175), Wells Fargo SecureSource (42, 64, 67, 93-96, 111, 112), WePay (2200), TSYS `merchantAdvice` (values undocumented). Many processors named in codes may no longer be in use; the docs do not say which.
25. **Regional**: no list of supported merchant countries; eCheck limited to U.S. businesses; DCC limited to USD; some European processors need extra billing fields.
26. **Out of scope formats**: AIM NVP (`x_` fields, `transact.dll`), SIM/DPM relay responses and Silent Post were not researched; their guides are PDFs. Pastes in those formats should be reported as unsupported legacy Authorize.net formats rather than parsed.

---

## 13. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | A first-party, downloadable list of 479 codes with texts and suggestions covers both layers (`I`/`E` and reason codes), plus AVS, CVV and CAVV tables. Caveats (shared texts, the code-38 conflict, processor-specific codes, the 1-4 overlap) are handled by keeping the layers separate and showing the suggestion-based meaning with an `unknown` fallback.                                                 |
| **paymentResponses** | **supported** | `createTransactionResponse` JSON is documented with a field table, the XSD and examples for every transaction type, including error examples. The missing decline/held examples and undocumented example-only fields are minor; parsing should not depend on them.                                                                                                                                             |
| **webhookParsing**   | **limited**   | The envelope, 29 event types, retry schedule and signature method are documented, but the payload field set is known only from examples, payloads lack reason codes, parent IDs, currency and invoice numbers, the signature header format is not documented, and refund/void payloads are not shown.                                                                                                          |
| **timeline**         | **limited**   | Webhooks give `eventDate` and event types (authorization, capture, refund, void, fraud review), and the notification history gives retry timing. API responses have no timestamp; settlement status, returns and chargebacks are only in the reporting API (`transactionStatus`, `submitTimeUTC`, `batch.settlementTimeUTC`), several status values are undocumented, and ordering is not guaranteed.          |
| **correlation**      | **limited**   | API responses link follow-ups through `transId` + `refTransID` (captures and voids keep the original ID in examples, refunds get a new ID), and `refId`/`merchantReferenceId` ties webhooks to requests. Webhooks themselves carry no parent ID, `invoiceNumber` is absent from responses and webhooks, and `refId` is optional, so cross-record linking is reliable only when an API response is also pasted. |
