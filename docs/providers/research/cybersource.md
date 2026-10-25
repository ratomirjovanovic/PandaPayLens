# Cybersource (adapter id `cybersource`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Cybersource's first-party documentation and official SDK repositories as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: developer pages were downloaded as raw Markdown (`https://developer.cybersource.com/<path>.md`, the format the site advertises in its own `llms.txt` index) and read in full or by section. The machine-readable response code file (`responsecode.json`) and the official merged OpenAPI 2.0 specification shipped in the Java SDK repository were parsed with a local script. Company pages on www.cybersource.com were downloaded as HTML and reduced to text. One support article was read through a summarizing page fetcher. No login, sandbox account or merchant relationship was used. Transcribed JSON examples keep the published keys, values and order; only indentation was normalized by the repository formatter.
- Brand note: the site describes Cybersource as "part of Visa Acceptance Solutions". The same documentation is mirrored on developer.visaacceptance.com; the `responsecode.json` file on both hosts is byte-identical (63,810 bytes). Cybersource also owns Authorize.net (company "About" page), which is a separate gateway with its own formats and is not covered here.

---

## 0. Summary

| Item                 | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome              | `documentation_verified` (gate items 1-5, 8, 9, 10 = yes)                                                                                                                                                                                                                                                                                                                                                                                            |
| Classification       | `gateway` (strong), `orchestration` (strong, self-described); `card_processing` unclear (Visa Platform Connect is a Visa processing connection, but acquiring stays with third parties); not `acquiring`                                                                                                                                                                                                                                             |
| Documented sectors   | General use cases only (lodging, auto rental, e-commerce, restaurants, mass transit, bill payment, quasi-cash as a transaction type, a charity case study). **No high-risk sector is named.**                                                                                                                                                                                                                                                        |
| Documentation access | **Public.** Developer guides, API field reference, response code file and OpenAPI spec load without login. Gated: Business Center (transaction search UI, key creation), the webhook Postman collection (via account manager), payment event webhooks (must be enabled by support).                                                                                                                                                                  |
| API family first     | **REST Payments API v2** (`/pts/v2/...`, JSON): synchronous `status` + `errorInformation.reason` (or top-level `reason` on HTTP 400/502) plus `processorInformation`. Then Transaction Details (`/tss/v2/transactions/{id}`) and the Webhooks notification envelope (version 3).                                                                                                                                                                     |
| Documented codes     | REST `status`: 20 values. REST `reason`: 77 distinct values (63 for the payment services, 14 for address verification, payer authentication and Decision Manager services). Numeric reason codes (Simple Order table, also exposed by REST Transaction Details): 89. AVS: 29. CVN: 11. Merchant advice: 20 (Visa 3, Mastercard 17) plus Barclays-specific values. Payment insights categories: 7. Webhook event types: 45 rows, 42 distinct strings. |
| Biggest limitation   | Payment event webhooks require message-level encryption; the decrypted payload shape for card payment events is **NOT DOCUMENTED**. Raw processor codes (`processorInformation.responseCode`) depend on the processor (30+), with no universal table.                                                                                                                                                                                                |
| White-label note     | Cybersource formats are its own. The Visa Acceptance Solutions brand serves the same docs and code file. Processor-specific guide variants exist (for example `docs/barclays/...`), but the REST JSON format is the same.                                                                                                                                                                                                                            |

---

## 1. Sources

All URLs below were read on 2026-10-25. "Revision" is the newest entry in the document's own "Recent Revisions" section where present.

| URL                                                                                                                                              | Revision | What it covers                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://developer.cybersource.com/llms.txt                                                                                                       | n/a      | Docs index; states REST is preferred and Simple Order (SOAP) is deprecated; "30+ payment processors"                                                                 |
| https://developer.visaacceptance.com/llms.txt                                                                                                    | n/a      | Mirror index (compared only)                                                                                                                                         |
| https://developer.cybersource.com/api/reference/response-codes.md                                                                                | n/a      | "Transaction response codes" page: definitions of status, reason, service, HTTP 201/400/502                                                                          |
| https://developer.cybersource.com/content/dam/cybsdeveloper2021/responsecode.json                                                                | n/a      | **Main REST status/reason table** with message and recommended action per service and HTTP code                                                                      |
| https://developer.visaacceptance.com/content/dam/cybsdeveloper2021/responsecode.json                                                             | n/a      | Same file on the Visa Acceptance host (byte-identical)                                                                                                               |
| https://developer.cybersource.com/docs/cybs/en-us/payments/developer/ctv/rest/payments.md                                                        | 26.09.01 | Payments Developer Guide (Visa Platform Connect variant): lifecycle, endpoints, response examples, declined authorization categories, timeout and duplicate guidance |
| https://developer.cybersource.com/docs/cybs/en-us/payments/developer/ctv/rest/payments/payments-intro.md                                         | n/a      | Guide intro (stub)                                                                                                                                                   |
| https://developer.cybersource.com/docs/cybs/en-us/payments/developer/ctv/rest/payments/payments-processing-basic-intro.md                        | n/a      | Section stub                                                                                                                                                         |
| https://developer.cybersource.com/docs/cybs/en-us/webhooks/implementation/all/rest/webhooks.md                                                   | 26.7.01  | Webhooks Implementation Guide: products and event types, signature header, MLE, retry policy, notification fields, example notification                              |
| https://developer.cybersource.com/docs/cybs/en-us/platform/developer/all/rest/rest-getting-started.md                                            | 26.07.01 | REST authentication (JWT, HTTP Signature), request headers, response message-level encryption (`encryptedResponse`)                                                  |
| https://developer.cybersource.com/docs/cybs/en-us/txn-search/developer/all/rest/txn-search.md                                                    | n/a      | Transaction Search and Details API, `applications` service names, HTTP codes                                                                                         |
| https://developer.cybersource.com/docs/cybs/en-us/reason-codes-so/reference/all/so/reason-codes-so/reason-codes-so.md                            | n/a      | Numeric reason codes (Simple Order API)                                                                                                                              |
| https://developer.cybersource.com/docs/cybs/en-us/avs-codes/reference/all/na/avs-codes.md                                                        | n/a      | AVS codes (general, Visa Platform Connect, Cielo / Latin American Processing)                                                                                        |
| https://developer.cybersource.com/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance/sa-cvn-codes.md                                   | n/a      | CVN result codes (published in the Secure Acceptance guide)                                                                                                          |
| https://developer.cybersource.com/docs/cybs/en-us/api-fields/reference/all/rest/api-fields.md                                                    | n/a      | REST API field reference (`processorInformation.*`, `clientReferenceInformation.*`); China UnionPay and Mastercard VPC response code lists                           |
| https://developer.cybersource.com/docs/cybs/en-us/recurring-billing/developer/all/rest/recurring-billing-dev/recur-bill-addl-feat.md             | n/a      | Recurring Billing retry logic and customer email notifications                                                                                                       |
| https://developer.cybersource.com/docs/cybs/en-us/pay-by-bank/developer/all/rest/pay-by-bank/paybybank-intro-services/paybybank-webhook-intro.md | n/a      | Pay by Bank webhook: notification statuses, encrypted and decrypted notification example                                                                             |
| https://developer.cybersource.com/docs/cybs/en-us/paybylink/developer/all/rest/paybylink/paybylink-webhooks-intro.md                             | n/a      | Pay by Link webhook event types                                                                                                                                      |
| https://developer.cybersource.com/docs/cybs/en-us/unified-checkout/developer/all/rest/unified-checkout/uc-intro-setup.md                         | n/a      | Unified Checkout configuration (stub only, no webhook payload)                                                                                                       |
| https://raw.githubusercontent.com/CyberSource/cybersource-rest-client-java/master/generator/cybersource-rest-spec.json                           | n/a      | **Official merged OpenAPI 2.0 spec** (`info.version` 0.0.1, 176 paths): response schemas, `status` and `reason` enums, field descriptions                            |
| https://raw.githubusercontent.com/CyberSource/cybersource-rest-client-node/master/src/authentication/util/MLEUtility.js                          | n/a      | SDK handling of `encryptedResponse` bodies                                                                                                                           |
| https://raw.githubusercontent.com/CyberSource/cybersource-rest-client-node/master/src/authentication/logging/SensitiveDataTags.js                | n/a      | SDK list of field names masked in logs                                                                                                                               |
| https://raw.githubusercontent.com/CyberSource/cybersource-rest-client-node/master/src/authentication/util/Constants.js                           | n/a      | SDK header constants (`v-c-merchant-id`, `v-c-correlation-id`)                                                                                                       |
| https://github.com/CyberSource (repository list via the GitHub API)                                                                              | n/a      | Official SDKs for Java, Node.js, Python, PHP, .NET, Ruby; samples; legacy SOAP toolkits                                                                              |
| https://www.cybersource.com/en-us.html                                                                                                           | n/a      | Home page: "160+ countries and territories", Decision Manager                                                                                                        |
| https://www.cybersource.com/en-us/about.html                                                                                                     | n/a      | Company history (Visa acquisition 2010, Authorize.net 2007), "more than 450,000 businesses"                                                                          |
| https://www.cybersource.com/en-us/why-cybersource/payments-orchestration.html                                                                    | n/a      | "payments orchestration platform", open architecture                                                                                                                 |
| https://www.cybersource.com/en-us/why-cybersource/merchant-payment-processing.html                                                               | n/a      | Merchant offering, case studies                                                                                                                                      |
| https://www.cybersource.com/en-us/solutions/payment-acceptance.html                                                                              | n/a      | Global Gateway, Payouts, payment methods                                                                                                                             |
| https://support.visaacceptance.com/knowledgebase/article/KA-04103/en-us                                                                          | n/a      | Support article on numeric reason codes and SCMP reply flags (read through a summarizing fetcher, so only paraphrased here)                                          |

Also tried and not usable: `https://developer.cybersource.com/docs/cybs/en-us/cvn-codes/reference/all/na/cvn-codes.md` (HTTP 500), `https://developer.cybersource.com/docs/cybs/en-us/tms/developer/all/rest/tms/tms-overview-webhook.md` (HTTP 500), `https://developer.cybersource.com/docs/barclays/en-us/payments/developer/all/rest/payments/CVN.md` (served the generic home page), `https://www.cybersource.com/` (HTTP 403 to a scripted download), `https://www.cybersource.com/en-us/about-us.html` (HTTP 404).

---

## 2. Qualification gate

| #   | Item                                                        | Answer             | Evidence                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active                                      | yes                | About page: "more than 450,000 businesses worldwide use Cybersource and Authorize.net solutions"; footer "1997-2026". Payments guide revision 26.09.01; SDK repositories pushed in October 2026.                                                                                                                                  |
| 2   | Payment service operational                                 | yes                | Payments guide lists production `POST https://api.cybersource.com/pts/v2/payments` and test `https://apitest.cybersource.com/pts/v2/payments`; orchestration page claims "99.999% uptime".                                                                                                                                        |
| 3   | Docs publicly accessible                                    | yes                | developer.cybersource.com guides, field reference, `responsecode.json` and the OpenAPI spec on GitHub load without login. Gated: Business Center (transaction details UI, key generation), webhook Postman collection ("Contact your account manager"), payment event webhooks ("Contact our support team to enable the events"). |
| 4   | API families/versions identified                            | yes                | REST Payments `/pts/v2/...`, Transaction Search/Details `/tss/v2/...`, Webhooks `/notification-subscriptions/v2/webhooks` with notification format "version 3", Reporting `/reporting/v3/...`; Simple Order API (SOAP) marked deprecated in `llms.txt`.                                                                           |
| 5   | Offline-examinable formats/examples                         | yes                | JSON response examples for authorization, decline, partial authorization, sale, capture, reversal, refund, void and HTTP 502 timeouts (payments guide); webhook notification example with headers (webhooks guide); schemas and enums in the OpenAPI spec. Payment event webhook bodies are encrypted (see section 8).            |
| 6   | Sectors documented by provider                              | yes (general only) | Pre-authorizations "typically used for lodging, auto rental, e-commerce, and restaurant transactions"; mass transit (reason code 263); Mastercard bill payments; charity case study (tiptap). No high-risk sector named. See section 3.                                                                                           |
| 7   | Regional/regulatory limits identified                       | yes (partial)      | PSD2 SCA for EU/EEA pre-authorizations; fast refunds "only available for Visa cards in India"; processor response `70` and `1A` limited to listed countries; separate "Log in (India)"; "160+ countries and territories". No full country restriction list.                                                                       |
| 8   | Diagnostic value                                            | yes                | `status` + `reason` with message and recommended action per service (77 reasons), 89 numeric reason codes, AVS/CVN tables, merchant advice codes, payment insights categories, timeout and duplicate guidance, 42 webhook event types.                                                                                            |
| 9   | Own technical format (not a white-label of another gateway) | yes                | Cybersource is the gateway: "global payment gateway supporting ... 30+ payment processors" (`llms.txt`). It routes to processors and acquirers but the REST JSON format is its own. Authorize.net (also owned by Cybersource) has separate formats.                                                                               |
| 10  | No credentials needed for examples                          | yes                | All examples and schemas are public; analysis needs no account.                                                                                                                                                                                                                                                                   |

**Outcome: `documentation_verified`.** The REST synchronous formats are fully documented with schemas and examples. Webhook parsing is weaker because payment event bodies are encrypted (section 8, section 13).

---

## 3. Classification and documented sectors

| Value                                                  | Applies     | Evidence                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`                                              | yes         | `llms.txt`: "a global payment gateway supporting online, in-person, and digital commerce across 30+ payment processors"; response codes page: "Cybersource Payment Gateway". The authorization workflow shows Cybersource forwarding to "your payment processor". |
| `orchestration`                                        | yes         | Payments orchestration page: "Welcome to the world's largest payments orchestration platform"; "One connection provides access to our entire global payments ecosystem".                                                                                          |
| `card_processing`                                      | unclear     | Visa Platform Connect (VPC) is the default processing connection in the docs, but the VPC disclaimer says the VPC acquirer is responsible for declines and processing issues, and that neither Visa nor Cybersource is liable for acquirer errors.                |
| `acquiring`                                            | no          | Payments guide: "Before you can accept payments, you must register with a payment processor"; acquirers are third parties.                                                                                                                                        |
| `payment_facilitator`, `merchant_account_intermediary` | no evidence | Not claimed on any page read.                                                                                                                                                                                                                                     |
| `wallet`, `alternative_payment_method`                 | no          | Cybersource carries APMs (`ics_ap_*` services, `alternativePaymentMethods` webhook product) and digital wallets, but as a gateway, not as the wallet or APM provider.                                                                                             |

Documented sectors (provider's own words): pre-authorizations are "typically used for lodging, auto rental, e-commerce, and restaurant transactions" (payments guide); mass transit transactions (reason code 263); Mastercard bill payments (payments guide); quasi-cash is described as a transaction type covering "web wallets, travelers checks, cryptocurrency, and lottery tickets", which describes instruments, not merchant eligibility; a charity donations case study (tiptap) on the merchant page.

Cybersource documents **no** high-risk sector (adult, iGaming, nutraceuticals, crypto merchants, etc.) on any page read. Do not describe Cybersource as accepting high-risk merchants. Eligibility depends on jurisdiction, licensing, underwriting and the acquirer behind the processor connection; approval for one sector does not imply another. The payments guide warns that excessive chargebacks can lead to account termination.

---

## 4. API families and versions

| Family                                            | Endpoint(s)                                                                                                                                                                                                                                                                                                                                                                                                           | Format                                                             | Relevance                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **REST Payments API v2**                          | `POST /pts/v2/payments` (authorization or sale), `/pts/v2/payments/{id}/captures`, `/reversals`, `/refunds`, `/voids`; `/pts/v2/captures/{id}/refunds`, `/pts/v2/captures/{id}/voids`; `/pts/v2/credits`, `/pts/v2/credits/{id}/voids`; `/pts/v2/reversals` and `/pts/v2/voids` (timeout recovery); `/pts/v2/refresh-payment-status/{id}`; `/pts/v2/payouts`. Hosts `api.cybersource.com`, `apitest.cybersource.com`. | JSON request and response                                          | **Primary.** Synchronous `status`, `reason`, `processorInformation`                                         |
| Transaction Search and Details                    | `POST /tss/v2/searches`, `GET /tss/v2/searches/{searchId}`, `GET /tss/v2/transactions/{id}`                                                                                                                                                                                                                                                                                                                           | JSON                                                               | Secondary. `rootId`, `applicationInformation.applications[]`, related transaction links: good timeline data |
| Webhooks (notification subscriptions)             | Subscriptions at `/notification-subscriptions/v2/webhooks`; notifications are POSTed to the merchant `webhookUrl`; notification format "version 3"                                                                                                                                                                                                                                                                    | JSON envelope; payment and Unified Checkout events encrypted       | Secondary, limited (section 8)                                                                              |
| Reporting v3                                      | `GET /reporting/v3/chargeback-details`, `/reporting/v3/chargeback-summaries`, `/reporting/v3/notification-of-changes`                                                                                                                                                                                                                                                                                                 | JSON                                                               | Tertiary. Only documented source of chargeback records                                                      |
| REST message-level encryption (MLE) wrapper       | Any REST endpoint when MLE is enabled                                                                                                                                                                                                                                                                                                                                                                                 | `{"encryptedRequest": "<JWE>"}` / `{"encryptedResponse": "<JWE>"}` | Detect and report as encrypted; cannot be decoded offline                                                   |
| Simple Order API                                  | SOAP toolkit and name-value pairs                                                                                                                                                                                                                                                                                                                                                                                     | XML / name-value                                                   | **Out of scope** (deprecated per `llms.txt`; XML). Its numeric reason codes still matter (section 6c)       |
| SCMP API                                          | Legacy; appears only in field mapping notes (for example `auth_auth_avs`)                                                                                                                                                                                                                                                                                                                                             | NOT DOCUMENTED here                                                | Out of scope                                                                                                |
| Secure Acceptance (Hosted Checkout, Checkout API) | Legacy hosted pages                                                                                                                                                                                                                                                                                                                                                                                                   | form posts                                                         | Out of scope (deprecated, replaced by Unified Checkout per `llms.txt`)                                      |

Versioning: the version is in the path (`v2` for payments and search, `v3` for reporting). The OpenAPI spec says `info.version` `0.0.1` and does not version the schema further. The webhook guide says "The default version of the Webhooks API is version 3".

**Recommendation: implement first** the REST Payments API v2 synchronous responses (HTTP 201, 400 and 502 bodies) for authorization, sale, capture, reversal, refund, credit and void. They are fully described by the OpenAPI spec and `responsecode.json`, they are what developers paste most, and every decline carries a documented `status` and `reason`. Then add the Webhooks notification envelope (with event type mapping and explicit "encrypted payload" handling) and the Transaction Details response for timelines.

---

## 5. Formats

### 5.1 Content type and HTTP status

- REST requests and responses are JSON. The OpenAPI spec declares `application/json;charset=utf-8` for the webhook management endpoints; the payment endpoints declare JSON `produces`/`consumes` (exact charset per endpoint not checked).
- The response codes page says the Payments API uses HTTP **201**, **400** and **502**:
  - 201: a transaction resource ID was created. It is also used for declines, reviews and some failures ("Cybersource or the merchant's processor probably marked this transaction as under review, declined, or failed").
  - 400: something is wrong or missing in the request.
  - 502: server error or timeout.
- The timeout guidance also mentions load shedding with "`HTTP 429` or `HTTP 503` with `Retry-After` guidance". Their body format is **NOT DOCUMENTED**.
- Transaction Details: 200, 404 (retry after 5 minutes, at most five times), 500.

### 5.2 Response shapes

HTTP 201 (payments family) top-level fields from the OpenAPI schema for `POST /pts/v2/payments`: `_links`, `id`, `message`, `submitTimeUtc`, `createTimeUtc`, `status`, `reconciliationId`, `errorInformation`, `clientReferenceInformation`, `processingInformation`, `processorInformation`, `issuerInformation`, `paymentAccountInformation`, `paymentInformation`, `paymentInsightsInformation`, `orderInformation`, `pointOfSaleInformation`, `installmentInformation`, `tokenInformation`, `buyerInformation`, `riskInformation`, `consumerAuthenticationInformation`, `merchantInformation`, `clearingInformation`, `embeddedActions`, `watchlistScreeningInformation`.

| Field                                                                                                                                | Meaning                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                 | Request ID generated by Cybersource, max 26 characters (examples are 22 digits). Also appended to the resource path. Incremental authorizations reuse the original authorization's `id`. |
| `status`                                                                                                                             | Overall result (section 6a). The response codes page: for successful transactions, status is the only result field.                                                                      |
| `errorInformation.reason`                                                                                                            | Reason for a decline or failure inside a 201 body (section 6b).                                                                                                                          |
| `errorInformation.message`                                                                                                           | Human-readable text for the status and reason.                                                                                                                                           |
| `errorInformation.details[]`                                                                                                         | `field` (flattened JSON path) and `reason` (`MISSING_FIELD` or `INVALID_DATA`).                                                                                                          |
| `submitTimeUtc`                                                                                                                      | Request time, `YYYY-MM-DDThh:mm:ssZ`.                                                                                                                                                    |
| `reconciliationId`                                                                                                                   | Reference number for reconciliation, max 60; provided by the merchant or generated, depending on account configuration.                                                                  |
| `clientReferenceInformation.code`                                                                                                    | Merchant order reference (see section 9).                                                                                                                                                |
| `processorInformation.responseCode`                                                                                                  | Code from the issuer or processor, max 10. Docs say: do not use it to evaluate the result.                                                                                               |
| `processorInformation.responseDetails`                                                                                               | "might contain information about a decline", max 255.                                                                                                                                    |
| `processorInformation.responseCategoryCode`                                                                                          | Processor-defined category (Japanese issuers, JCN Gateway, Comercio Latino).                                                                                                             |
| `processorInformation.approvalCode`                                                                                                  | Authorization code, max 6.                                                                                                                                                               |
| `processorInformation.transactionId`, `networkTransactionId`                                                                         | Network transaction identifier; the second is documented as the same value.                                                                                                              |
| `processorInformation.avs.code` / `codeRaw`                                                                                          | AVS result (section 6d) / raw processor value for debugging only.                                                                                                                        |
| `processorInformation.cardVerification.resultCode` / `resultCodeRaw`                                                                 | CVN result (section 6d) / raw value for debugging only.                                                                                                                                  |
| `processorInformation.merchantAdvice.code` / `codeRaw`                                                                               | Card network merchant advice (section 6e).                                                                                                                                               |
| `processorInformation.systemTraceAuditNumber`, `retrievalReferenceNumber`, `merchantNumber`, `paymentAccountReferenceNumber`, `name` | Processor trace data; `name` is the processor name.                                                                                                                                      |
| `issuerInformation.responseCode`                                                                                                     | Raw association or issuer response code (HSBC, FDC Nashville Global, SIX only). The schema shows a short sample table, not a full list.                                                  |
| `paymentInsightsInformation.responseInsights.category` / `categoryCode`                                                              | Retry guidance category for declines (section 6f).                                                                                                                                       |
| `orderInformation.amountDetails.authorizedAmount`, `totalAmount`, `currency`                                                         | Amounts; partial authorization shows `authorizedAmount` lower than `totalAmount`.                                                                                                        |
| `_links.self.href` (and `capture`, `authReversal`, `void`, `reversal`)                                                               | Resource path of the created resource and allowed follow-on actions.                                                                                                                     |

Service-specific amount objects: `reversalAmountDetails.reversedAmount`, `creditAmountDetails.creditAmount`, `voidAmountDetails.voidAmount` (and `originalTransactionAmount` on timeout voids).

HTTP 400 and 502 bodies use a **flat** shape, not `errorInformation`. OpenAPI 400 schema: `submitTimeUtc`, `status` (`INVALID_REQUEST`), `reason`, `message`, `details[]` (`field`, `reason`). OpenAPI 502 schema: `submitTimeUtc`, `status` (`SERVER_ERROR`), `reason`, `message`. The documented 502 examples also contain `id`, which the 502 schema does not list.

Transaction Details (`GET /tss/v2/transactions/{id}`) adds `rootId`, `merchantId`, `submitTimeUTC` (capital `UTC`), `applicationInformation.status`, `reasonCode`, `rCode` (`-1` error, `0` declined, `1` success), `rFlag`, and `applicationInformation.applications[]` with `name` (service, for example `ics_auth`, `ics_bill`, `ics_credit`, `ics_auth_reversal`, `ics_void`, `ics_decision`), `status`, `reasonCode` ("3-digit reason code"), `rCode`, `rFlag`, `rMessage`, `reconciliationId`, `returnCode`; plus `_links.relatedTransactions[]`.

Message-level encryption: when enabled, the REST guide says the response arrives as `{"encryptedResponse": "<JWE>"}`. The Node SDK only treats a body as encrypted when it is an object with exactly one key, `encryptedResponse`.

### 5.3 Examples

Example A: successful authorization. **Transcribed from https://developer.cybersource.com/docs/cybs/en-us/payments/developer/ctv/rest/payments.md** (section "REST Example: Processing a Basic Authorization"):

```json
{
  "_links": {
    "authReversal": {
      "method": "POST",
      "href": "/pts/v2/payments/6461731521426399003473/reversals"
    },
    "self": {
      "method": "GET",
      "href": "/pts/v2/payments/6461731521426399003473"
    },
    "capture": {
      "method": "POST",
      "href": "/pts/v2/payments/6461731521426399003473/captures"
    }
  },
  "clientReferenceInformation": {
    "code": "1646173152047"
  },
  "id": "6461731521426399003473",
  "orderInformation": {
    "amountDetails": {
      "authorizedAmount": "100.00",
      "currency": "usd"
    }
  },
  "paymentAccountInformation": {
    "card": {
      "type": "001"
    }
  },
  "paymentInformation": {
    "tokenizedCard": {
      "type": "001"
    },
    "card": {
      "type": "001"
    }
  },
  "paymentInsightsInformation": {
    "responseInsights": {
      "categoryCode": "01"
    }
  },
  "processorInformation": {
    "systemTraceAuditNumber": "862481",
    "approvalCode": "831000",
    "merchantAdvice": {
      "code": "01",
      "codeRaw": "M001"
    },
    "responseDetails": "ABC",
    "networkTransactionId": "016153570198200",
    "consumerAuthenticationResponse": {
      "code": "2",
      "codeRaw": "2"
    },
    "transactionId": "016153570198200",
    "responseCode": "00",
    "avs": {
      "code": "Y",
      "codeRaw": "Y"
    }
  },
  "reconciliationId": "6461731521426399003473",
  "status": "AUTHORIZED",
  "submitTimeUtc": "2022-03-01T22:19:12Z"
}
```

Example B: declined authorization (HTTP 201), same page and section:

```json
{
  "clientReferenceInformation": {
    "code": "TC50171_3"
  },
  "errorInformation": {
    "reason": "PROCESSOR_ERROR",
    "message": "Invalid account"
  },
  "id": "6583553837826789303954",
  "paymentInsightsInformation": {
    "responseInsights": {
      "categoryCode": "01",
      "category": "ISSUER_WILL_NEVER_APPROVE"
    }
  },
  "pointOfSaleInformation": {
    "amexCapnData": "1009S0600100"
  },
  "processorInformation": {
    "systemTraceAuditNumber": "004544",
    "merchantNumber": "1231231222",
    "networkTransactionId": "431736869536459",
    "transactionId": "431736869536459",
    "responseCode": "111",
    "avs": {
      "code": "Y",
      "codeRaw": "Y"
    }
  },
  "status": "DECLINED"
}
```

Example C: processor timeout, HTTP 502, same page, section "Timeout Scenarios and Recommended Actions":

```json
{
  "id": "7871927193766252604807",
  "submitTimeUtc": "2026-08-20T02:25:49Z",
  "status": "SERVER_ERROR",
  "reason": "SERVER_TIMEOUT",
  "message": "Error - The request was received but there was a server timeout. This error does not include timeouts between the client and the server."
}
```

Example D: capture accepted (HTTP 201), same page, section "REST Example: Capturing an Authorization":

```json
{
  "_links": {
    "void": {
      "method": "POST",
      "href": "/pts/v2/captures/6662994431376681303954/voids"
    },
    "self": {
      "method": "GET",
      "href": "/pts/v2/captures/6662994431376681303954"
    }
  },
  "clientReferenceInformation": {
    "code": "1666299443215"
  },
  "id": "6662994431376681303954",
  "orderInformation": {
    "amountDetails": {
      "totalAmount": "100.00",
      "currency": "EUR"
    }
  },
  "reconciliationId": "66535942B9CGT52U",
  "status": "PENDING",
  "submitTimeUtc": "2022-10-20T20:57:23Z"
}
```

No complete HTTP 400 body example was found in the guides read; the 400 shape comes from the OpenAPI schema. The field reference for `clientReferenceInformation.transactionId` shows only a fragment (`"INVALID_REQUEST"`, `"reason": "DUPLICATE_REQUEST"`, and a message saying the transaction identifier was already used in the last 60 days) that is not valid JSON as printed.

---

## 6. Codes

Category and retry columns are **suggestions** for PandaPayLens, not Cybersource statements. Where Cybersource gives a recommended action, it is reflected and noted. Cybersource warns (Simple Order reason code page) that reason codes can be added at any time and that handlers must accept unknown values, so an adapter needs an `unknown` fallback.

### 6a. `status` values (20)

Payments family (OpenAPI enums for payments, captures, refunds, reversals, voids, credits, payouts, plus `responsecode.json`):

| `status`                    | Where                                                             | Meaning (paraphrase)                                                                                  | Category / retry suggestion                        |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `AUTHORIZED`                | payment 201, credit 201                                           | Approved (authorization, or sale when `processingInformation.capture` is true)                        | success                                            |
| `PARTIAL_AUTHORIZED`        | payment 201                                                       | Only part of the amount was approved                                                                  | success (partial); check `authorizedAmount`        |
| `AUTHORIZED_PENDING_REVIEW` | payment 201                                                       | Issuer approved, but Cybersource or Decision Manager flagged it (AVS, CVN, contact processor, review) | fraud_or_risk / manual_review                      |
| `AUTHORIZED_RISK_DECLINED`  | payment 201                                                       | Issuer approved, but risk rules declined it                                                           | fraud_or_risk / manual_review                      |
| `PENDING_AUTHENTICATION`    | payment 201                                                       | Payer authentication (3-D Secure) needed before authorization                                         | authentication_required / customer_action_required |
| `PENDING_REVIEW`            | payment 201 (enum only)                                           | Order under review; payment-specific text NOT DOCUMENTED                                              | fraud_or_risk / manual_review                      |
| `DECLINED`                  | payment, refund, credit, payout 201                               | Declined; see `errorInformation.reason`                                                               | by reason                                          |
| `INVALID_REQUEST`           | 400; also 201 with `INVALID_MERCHANT_CONFIGURATION`               | Request or configuration problem                                                                      | by reason                                          |
| `SERVER_ERROR`              | 502; also 201 with `PROCESSOR_TIMEOUT` (`responsecode.json` only) | System error or timeout; outcome may be unknown                                                       | by reason                                          |
| `PENDING`                   | capture, refund, credit 201                                       | Accepted and waiting for batch submission; webhook docs say it later becomes `BATCHED`                | success (not yet settled)                          |
| `REVERSED`                  | reversal 201                                                      | Authorization reversed                                                                                | success                                            |
| `VOIDED`                    | void 201                                                          | Capture, credit or sale voided                                                                        | success                                            |
| `CANCELLED`                 | void 201 (enum only)                                              | Meaning NOT DOCUMENTED beyond the enum                                                                | unknown                                            |
| `FAILED`                    | void 201 (enum only)                                              | Meaning NOT DOCUMENTED beyond the enum                                                                | unknown / manual_review                            |
| `ACCEPTED`                  | payouts 201; Decision Manager case 201                            | Accepted                                                                                              | success                                            |

Other services in `responsecode.json` (not payment results, but they share the vocabulary): `REJECTED` and `CHALLENGE` (Decision Manager), `AUTHENTICATION_SUCCESSFUL` and `AUTHENTICATION_FAILED` (payer authentication enrollment and validation), `COMPLETED` (list management, fraud marking, address verification, export compliance).

Status words seen only in other contexts: `BATCHED` and `NOT VOIDABLE` (webhook event descriptions); `SERVER_TIMEOUT` and `SERVICE_TIMEOUT` are listed as "statuses" in the webhook event table although the REST API uses them as reasons; Pay by Bank notifications use lowercase or other words (`ABANDONED`, `CANCELLED`, `COMPLETED`, `FAILED`, `PENDING`, `REFUNDED`, `SETTLED`, and `settled` in the decrypted example).

### 6b. REST `reason` values (77 distinct)

Location: `errorInformation.reason` in HTTP 201 bodies; top-level `reason` in HTTP 400 and 502 bodies. Source column: J = `responsecode.json`, S = OpenAPI enum. HTTP column shows where the JSON file places the value.

Payment and follow-on services (63):

| Reason                                    | Src | HTTP / status (J)                                    | Meaning (paraphrase)                                                                                                                                     | Category                   | Retry                    |
| ----------------------------------------- | --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `AVS_FAILED`                              | J S | 201 AUTHORIZED_PENDING_REVIEW                        | Issuer approved but Cybersource flagged the AVS result; capture is possible after a fraud review                                                         | fraud_or_risk              | manual_review            |
| `CONTACT_PROCESSOR`                       | J S | 201 AUTHORIZED_PENDING_REVIEW                        | Issuer has questions; a voice authorization may be obtained by calling the processor                                                                     | card_declined              | manual_review            |
| `EXPIRED_CARD`                            | J S | 201 DECLINED                                         | Card expired, or expiry date does not match issuer records                                                                                               | card_declined              | customer_action_required |
| `PROCESSOR_DECLINED`                      | J S | 201 DECLINED                                         | General decline with no further issuer detail                                                                                                            | card_declined              | customer_action_required |
| `PROCESSOR_ERROR`                         | J S | 201 DECLINED                                         | JSON text: unauthorized, pick up card, manual review. The guide's decline example pairs it with message "Invalid account" (see section 12)               | card_declined              | manual_review            |
| `INSUFFICIENT_FUND`                       | J S | 201 DECLINED                                         | Not enough funds                                                                                                                                         | insufficient_funds         | customer_action_required |
| `STOLEN_LOST_CARD`                        | J S | 201 DECLINED                                         | Card reported lost or stolen; Cybersource says review manually                                                                                           | fraud_or_risk              | manual_review            |
| `ISSUER_UNAVAILABLE`                      | J S | 201 DECLINED                                         | Issuer unreachable; Cybersource says wait a few minutes and resend                                                                                       | provider_unavailable       | retry_conditionally      |
| `UNAUTHORIZED_CARD`                       | J S | 201 DECLINED                                         | Card inactive or not allowed for card-not-present use                                                                                                    | card_declined              | customer_action_required |
| `CVN_NOT_MATCH`                           | J S | 201 DECLINED                                         | Security code did not match                                                                                                                              | card_declined              | customer_action_required |
| `EXCEEDS_CREDIT_LIMIT`                    | J S | 201 DECLINED                                         | Credit limit reached                                                                                                                                     | insufficient_funds         | customer_action_required |
| `INVALID_CVN`                             | J S | 201 DECLINED                                         | Security code invalid                                                                                                                                    | card_declined              | customer_action_required |
| `BLOCKED_BY_CARDHOLDER`                   | S   | NOT DOCUMENTED                                       | Name only; text NOT DOCUMENTED (suggestion based on the name, low confidence)                                                                            | card_declined              | do_not_retry             |
| `DECLINED_CHECK`                          | J S | 201 DECLINED                                         | Generic decline of a check (eCheck) payment                                                                                                              | card_declined              | customer_action_required |
| `BLACKLISTED_CUSTOMER`                    | J S | 201 DECLINED                                         | eCheck customer matched the processor's negative file                                                                                                    | fraud_or_risk              | manual_review            |
| `SUSPENDED_ACCOUNT`                       | J S | 201 DECLINED                                         | eCheck account frozen                                                                                                                                    | card_declined              | customer_action_required |
| `PAYMENT_REFUSED`                         | J S | 201 DECLINED                                         | Refused for one of several causes: account not set up, insufficient funds, action not permitted (for example already captured), or seller fraud settings | unknown                    | customer_action_required |
| `CV_FAILED`                               | J S | 201 AUTHORIZED_PENDING_REVIEW                        | Issuer approved but Cybersource flagged the CVN result; capture possible after review                                                                    | fraud_or_risk              | manual_review            |
| `INVALID_ACCOUNT`                         | J S | 201 DECLINED                                         | Invalid account number                                                                                                                                   | card_declined              | customer_action_required |
| `GENERAL_DECLINE`                         | J S | 201 DECLINED                                         | General decline by the processor                                                                                                                         | card_declined              | customer_action_required |
| `INVALID_MERCHANT_CONFIGURATION`          | J S | 201 INVALID_REQUEST                                  | Merchant configuration problem; do not resend, contact support                                                                                           | configuration              | do_not_retry             |
| `BOLETO_DECLINED`                         | J   | 201 DECLINED                                         | Processor declined the boleto request                                                                                                                    | card_declined              | customer_action_required |
| `PROCESSOR_TIMEOUT`                       | J   | 201 SERVER_ERROR (also 400 for credit, 502 for void) | Timeout at the processor; do not resend until the status is checked                                                                                      | network_or_timeout         | retry_conditionally      |
| `DEBIT_CARD_USAGE_LIMIT_EXCEEDED`         | J   | 201 DECLINED                                         | PINless debit frequency or per-use amount limit exceeded                                                                                                 | card_declined              | customer_action_required |
| `SCORE_EXCEEDS_THRESHOLD`                 | J S | 201 AUTHORIZED_RISK_DECLINED                         | Fraud score above the merchant threshold (soft decline)                                                                                                  | fraud_or_risk              | manual_review            |
| `CONSUMER_AUTHENTICATION_REQUIRED`        | J S | 201 PENDING_AUTHENTICATION                           | Cardholder enrolled in payer authentication; authenticate first                                                                                          | authentication_required    | customer_action_required |
| `CONSUMER_AUTHENTICATION_FAILED`          | J S | 201 DECLINED                                         | Payer authentication failed                                                                                                                              | authentication_failed      | customer_action_required |
| `DECISION_PROFILE_REVIEW`                 | J S | 201 AUTHORIZED_PENDING_REVIEW                        | Decision Manager marked the order for review                                                                                                             | fraud_or_risk              | manual_review            |
| `DECISION_PROFILE_REJECT`                 | J S | 201 AUTHORIZED_RISK_DECLINED                         | Decision Manager rejected the order                                                                                                                      | fraud_or_risk              | manual_review            |
| `PENDING_AUTHENTICATION`                  | S   | NOT DOCUMENTED                                       | Name only (same word as a status)                                                                                                                        | authentication_required    | customer_action_required |
| `ACH_VERIFICATION_FAILED`                 | S   | NOT DOCUMENTED                                       | Name only; bank account verification failure (low confidence)                                                                                            | card_declined              | customer_action_required |
| `ALLOWABLE_PIN_RETRIES_EXCEEDED`          | S   | NOT DOCUMENTED                                       | Name only; PIN retry limit reached                                                                                                                       | authentication_failed      | do_not_retry             |
| `CUSTOMER_WATCHLIST_MATCH`                | J S | 201 DECLINED (export compliance service)             | Customer is on a government restricted-party list; reject the order                                                                                      | fraud_or_risk              | do_not_retry             |
| `ADDRESS_COUNTRY_WATCHLIST_MATCH`         | J S | 201 DECLINED (export compliance service)             | Billing or shipping country embargoed, or not in the merchant's export list                                                                              | fraud_or_risk              | do_not_retry             |
| `EMAIL_COUNTRY_WATCHLIST_MATCH`           | J S | 201 DECLINED (export compliance service)             | Country associated with the email address is embargoed                                                                                                   | fraud_or_risk              | do_not_retry             |
| `IP_COUNTRY_WATCHLIST_MATCH`              | J S | 201 DECLINED (export compliance service)             | Country associated with the IP address is embargoed                                                                                                      | fraud_or_risk              | do_not_retry             |
| `DAGGREJECTED`                            | S   | NOT DOCUMENTED                                       | Meaning NOT DOCUMENTED                                                                                                                                   | unknown                    | manual_review            |
| `DAGGDENIED`                              | S   | NOT DOCUMENTED                                       | Meaning NOT DOCUMENTED                                                                                                                                   | unknown                    | manual_review            |
| `DSYSREJECTED`                            | S   | NOT DOCUMENTED                                       | Meaning NOT DOCUMENTED                                                                                                                                   | unknown                    | manual_review            |
| `RISK_CONTROL_DECLINE`                    | S   | payouts 201 (enum)                                   | Payout declined by risk controls (name only)                                                                                                             | fraud_or_risk              | manual_review            |
| `PROCESSOR_RISK_CONTROL_DECLINE`          | S   | payouts 201 (enum)                                   | Payout declined by processor risk controls (name only)                                                                                                   | fraud_or_risk              | manual_review            |
| `MISSING_FIELD`                           | J S | 400 INVALID_REQUEST                                  | Required field missing; see `details[]`                                                                                                                  | invalid_request            | do_not_retry             |
| `INVALID_DATA`                            | J S | 400 INVALID_REQUEST                                  | Field value invalid; see `details[]`                                                                                                                     | invalid_request            | do_not_retry             |
| `DUPLICATE_REQUEST`                       | J S | 400 INVALID_REQUEST                                  | Same merchant reference code as another authorization in the last 15 minutes (or a reused `transactionId`); check status before any retry                | duplicate_request          | do_not_retry             |
| `INVALID_CARD`                            | J S | 400 INVALID_REQUEST (refund, credit)                 | Invalid account number                                                                                                                                   | invalid_request            | customer_action_required |
| `CARD_TYPE_NOT_ACCEPTED`                  | J S | 400 INVALID_REQUEST                                  | Processor does not accept this card type for the merchant                                                                                                | payment_method_unavailable | do_not_retry             |
| `PROCESSOR_UNAVAILABLE`                   | J S | 400 INVALID_REQUEST                                  | Processor failure; Cybersource says wait a few minutes and resend                                                                                        | provider_unavailable       | retry_conditionally      |
| `INVALID_AMOUNT`                          | J S | 400 INVALID_REQUEST                                  | Amount must match the previous transaction amount                                                                                                        | invalid_amount             | do_not_retry             |
| `INVALID_CARD_TYPE`                       | J S | 400 INVALID_REQUEST                                  | Card type invalid or not matching the card number                                                                                                        | invalid_request            | do_not_retry             |
| `INVALID_PAYMENT_ID`                      | J S | 400 INVALID_REQUEST (capture, reversal)              | Referenced request ID is not valid for follow-on transactions                                                                                            | invalid_request            | do_not_retry             |
| `NOT_SUPPORTED`                           | S   | 400 (enum)                                           | Name only                                                                                                                                                | configuration              | do_not_retry             |
| `EXCEEDS_AUTH_AMOUNT`                     | J S | 400 INVALID_REQUEST (capture)                        | Capture amount above the authorized amount                                                                                                               | invalid_amount             | do_not_retry             |
| `AUTH_ALREADY_REVERSED`                   | J S | 400 INVALID_REQUEST (capture, reversal)              | Authorization already reversed; on a retried reversal this means the first one succeeded                                                                 | invalid_request            | do_not_retry             |
| `TRANSACTION_ALREADY_SETTLED`             | J S | 400 INVALID_REQUEST (capture, reversal)              | Transaction already settled                                                                                                                              | invalid_request            | do_not_retry             |
| `MISSING_AUTH`                            | J S | 400 INVALID_REQUEST (capture, reversal)              | No unused authorization to capture or reverse                                                                                                            | invalid_request            | do_not_retry             |
| `TRANSACTION_ALREADY_REVERSED_OR_SETTLED` | J S | 400 INVALID_REQUEST (capture, reversal)              | Already settled or reversed                                                                                                                              | invalid_request            | do_not_retry             |
| `CAPTURE_ALREADY_VOIDED`                  | J S | 400 INVALID_REQUEST (refund, credit)                 | Credit requested for a voided capture                                                                                                                    | invalid_request            | do_not_retry             |
| `ACCOUNT_NOT_ALLOWED_CREDIT`              | J S | 400 INVALID_REQUEST (refund, credit)                 | Stand-alone credits not allowed for the account; use a follow-on credit                                                                                  | configuration              | do_not_retry             |
| `NOT_VOIDABLE`                            | J S | 400 INVALID_REQUEST (void)                           | Already sent to the processor, or this transaction type cannot be voided                                                                                 | invalid_request            | do_not_retry             |
| `SYSTEM_ERROR`                            | J S | 502 SERVER_ERROR                                     | General system failure                                                                                                                                   | provider_unavailable       | retry_conditionally      |
| `SERVER_TIMEOUT`                          | J S | 502 SERVER_ERROR                                     | Server-side timeout; the processor may have approved; Cybersource may send an automatic reversal; check status before resending                          | network_or_timeout         | retry_conditionally      |
| `SERVICE_TIMEOUT`                         | J S | 502 SERVER_ERROR                                     | An internal service (Decision Manager, TMS, payer authentication) timed out; guide: low duplicate risk, retry after about 30 seconds                     | network_or_timeout         | retry_conditionally      |
| `INVALID_OR_MISSING_CONFIG`               | J   | 502 SERVER_ERROR                                     | Invalid or missing merchant configuration; do not resend                                                                                                 | configuration              | do_not_retry             |

"retry_conditionally" for timeouts means: confirm the final state first (Transaction Search/Details or the Business Center), as the timeout guidance requires.

Other services in `responsecode.json` (14): address verification (`APARTMENT_NUMBER_NOT_FOUND`, `INSUFFICIENT_ADDRESS_INFORMATION`, `HOUSE_OR_BOX_NUMBER_NOT_FOUND`, `MULTIPLE_ADDRESS_MATCHES`, `BOX_NUMBER_NOT_FOUND`, `ROUTE_SERVICE_NOT_FOUND`, `STREET_NAME_NOT_FOUND`, `POSTAL_CODE_NOT_FOUND`, `UNVERIFIABLE_ADDRESS`, `MULTIPLE_ADDRESS_MATCHES_INTERNATIONAL`, `ADDRESS_MATCH_NOT_FOUND`, `UNSUPPORTED_CHARACTER_SET`: all "ask the customer to verify the address", suggested invalid_request / customer_action_required), `AUTHENTICATION_FAILED` (payer authentication or Decision Manager case; authentication_failed / customer_action_required) and `DECISION_PROFILE_CHALLENGE` (Decision Manager or Account Takeover Protection challenge; fraud_or_risk / manual_review).

### 6c. Numeric reason codes (89)

Source: the Simple Order reason code page. They matter for REST because Transaction Details returns `applicationInformation.reasonCode` and `applications[].reasonCode` ("3-digit reason code"), and the REST timeout guidance itself cites `104`, `151` and `267`. Paraphrased; suggestions only.

| Code | Meaning (paraphrase)                                                                                           | Category                   | Retry                           |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| 100  | Success                                                                                                        | success                    | n/a                             |
| 101  | Required fields missing                                                                                        | invalid_request            | do_not_retry                    |
| 102  | Invalid field data                                                                                             | invalid_request            | do_not_retry                    |
| 104  | Duplicate merchant reference code within 15 minutes                                                            | duplicate_request          | do_not_retry                    |
| 105  | Merchant transaction identifier already used in the past 60 days                                               | duplicate_request          | do_not_retry                    |
| 110  | Partial amount approved                                                                                        | success (partial)          | n/a                             |
| 150  | System error; may also be a processor rejection of invalid data                                                | provider_unavailable       | retry_conditionally             |
| 151  | Server timeout; check status before resending                                                                  | network_or_timeout         | retry_conditionally             |
| 152  | A service did not finish in time; check status before resending                                                | network_or_timeout         | retry_conditionally             |
| 153  | Account not enabled for OCT (payouts)                                                                          | configuration              | do_not_retry                    |
| 154  | Payout failed MAC validation; not sent, safe to retry (per Cybersource)                                        | provider_unavailable       | safe_to_retry_technical_request |
| 200  | Issuer approved, but declined for AVS; capture possible after review                                           | fraud_or_risk              | manual_review                   |
| 201  | Issuer has questions; voice authorization possible                                                             | card_declined              | manual_review                   |
| 202  | Expired card or expiry mismatch                                                                                | card_declined              | customer_action_required        |
| 203  | General decline, no detail                                                                                     | card_declined              | customer_action_required        |
| 204  | Insufficient funds                                                                                             | insufficient_funds         | customer_action_required        |
| 205  | Lost or stolen card                                                                                            | fraud_or_risk              | manual_review                   |
| 207  | Issuer unavailable; resend after a few minutes                                                                 | provider_unavailable       | retry_conditionally             |
| 208  | Card inactive or not allowed for card-not-present; card-present: PIN missing or wrong                          | card_declined              | customer_action_required        |
| 209  | CVN did not match                                                                                              | card_declined              | customer_action_required        |
| 210  | Credit limit reached or amount above approved limit                                                            | insufficient_funds         | customer_action_required        |
| 211  | Invalid CVN                                                                                                    | card_declined              | customer_action_required        |
| 212  | EMV transaction rejected; resubmit with chip and PIN                                                           | card_declined              | customer_action_required        |
| 213  | Account in fraud watch status                                                                                  | fraud_or_risk              | do_not_retry                    |
| 216  | Some card data invalid (CVV, expiry, number, name)                                                             | card_declined              | customer_action_required        |
| 220  | Generic decline                                                                                                | card_declined              | customer_action_required        |
| 221  | Customer account frozen                                                                                        | card_declined              | customer_action_required        |
| 222  | Customer matched the processor's negative file                                                                 | fraud_or_risk              | manual_review                   |
| 230  | Issuer approved, but declined for CVN; capture possible after review                                           | fraud_or_risk              | manual_review                   |
| 231  | Invalid account number                                                                                         | card_declined              | customer_action_required        |
| 232  | Card type not accepted by the processor                                                                        | payment_method_unavailable | do_not_retry                    |
| 233  | Processor declined the card                                                                                    | card_declined              | customer_action_required        |
| 234  | Merchant account information incorrect                                                                         | configuration              | do_not_retry                    |
| 235  | Capture above the authorized amount (PIN debit: above approved limit)                                          | invalid_amount             | do_not_retry                    |
| 236  | Processor failure; resend after a few minutes                                                                  | provider_unavailable       | retry_conditionally             |
| 237  | Already captured                                                                                               | invalid_request            | do_not_retry                    |
| 238  | Already reversed                                                                                               | invalid_request            | do_not_retry                    |
| 239  | Amount does not match the previous transaction                                                                 | invalid_amount             | do_not_retry                    |
| 240  | Card type invalid or not matching the number                                                                   | invalid_request            | do_not_retry                    |
| 241  | PIN debit: processor declined; other methods: invalid request ID                                               | invalid_request            | do_not_retry                    |
| 242  | No unused authorization for the capture or reversal                                                            | invalid_request            | do_not_retry                    |
| 243  | Already settled or reversed                                                                                    | invalid_request            | do_not_retry                    |
| 244  | Account number failed a verification check                                                                     | card_declined              | customer_action_required        |
| 246  | Not voidable (already sent to processor, or type cannot be voided)                                             | invalid_request            | do_not_retry                    |
| 247  | Credit requested for a voided capture                                                                          | invalid_request            | do_not_retry                    |
| 248  | Boleto declined by the processor                                                                               | card_declined              | customer_action_required        |
| 250  | Timeout at the processor; check status before resending                                                        | network_or_timeout         | retry_conditionally             |
| 251  | Debit card frequency, PIN tries or daily amount limit exceeded                                                 | card_declined              | customer_action_required        |
| 254  | Stand-alone credits not allowed                                                                                | configuration              | do_not_retry                    |
| 256  | Credit amount above the account maximum                                                                        | invalid_amount             | do_not_retry                    |
| 257  | Gift or prepaid card already active                                                                            | invalid_request            | do_not_retry                    |
| 259  | Gift or prepaid card reload limit exceeded                                                                     | invalid_amount             | do_not_retry                    |
| 260  | Amount outside gift or prepaid card limits                                                                     | invalid_amount             | do_not_retry                    |
| 261  | Merchant set-up invalid or missing at the acquirer gateway                                                     | configuration              | do_not_retry                    |
| 262  | Request still in progress; wait for a response                                                                 | network_or_timeout         | retry_conditionally             |
| 263  | Mass transit transaction declined; capture may still be allowed under transit rules                            | card_declined              | manual_review                   |
| 264  | Processor missing field                                                                                        | invalid_request            | do_not_retry                    |
| 268  | Barclays: unable to confirm; do not reprocess, contact Barclays                                                | unknown                    | manual_review                   |
| 400  | Fraud score above threshold                                                                                    | fraud_or_risk              | manual_review                   |
| 403  | Communication error (HTTP errors or wrong/outdated API keys)                                                   | configuration              | do_not_retry                    |
| 428  | SCA exemption declined; SCA required                                                                           | authentication_required    | customer_action_required        |
| 450  | Apartment number missing or not found                                                                          | invalid_request            | customer_action_required        |
| 451  | Insufficient address information                                                                               | invalid_request            | customer_action_required        |
| 452  | House or box number not found on street                                                                        | invalid_request            | customer_action_required        |
| 453  | Multiple address matches                                                                                       | invalid_request            | customer_action_required        |
| 454  | P.O. box not found or out of range                                                                             | invalid_request            | customer_action_required        |
| 455  | Route service identifier not found or out of range                                                             | invalid_request            | customer_action_required        |
| 456  | Street name not found in postal code                                                                           | invalid_request            | customer_action_required        |
| 457  | Postal code not found                                                                                          | invalid_request            | customer_action_required        |
| 458  | Address cannot be verified or corrected                                                                        | invalid_request            | customer_action_required        |
| 459  | Multiple international address matches                                                                         | invalid_request            | customer_action_required        |
| 460  | No address match, no reason given                                                                              | invalid_request            | customer_action_required        |
| 461  | Unsupported character set                                                                                      | invalid_request            | do_not_retry                    |
| 465  | Payer authentication problem; payer not authenticated                                                          | authentication_failed      | customer_action_required        |
| 474  | PIN data required                                                                                              | authentication_required    | customer_action_required        |
| 475  | Cardholder enrolled in payer authentication; authenticate first                                                | authentication_required    | customer_action_required        |
| 476  | Payer authentication problem; payer not authenticated                                                          | authentication_failed      | customer_action_required        |
| 478  | SCA required                                                                                                   | authentication_required    | customer_action_required        |
| 480  | Decision Manager review; auto-rejected after 30 days without action                                            | fraud_or_risk              | manual_review                   |
| 481  | Decision Manager rejected                                                                                      | fraud_or_risk              | manual_review                   |
| 490  | Aggregator or acquirer not accepting transactions or the requested service (several messages)                  | configuration              | manual_review                   |
| 491  | Aggregator or acquirer refusing on limits or rules (velocity, card, BIN, cross-border and similar sub-reasons) | fraud_or_risk              | manual_review                   |
| 493  | Acquirer or aggregator rejection: safeguards                                                                   | fraud_or_risk              | manual_review                   |
| 494  | Internal safeguards prevent processing                                                                         | fraud_or_risk              | manual_review                   |
| 520  | Issuer approved, but declined by Smart Authorization settings                                                  | fraud_or_risk              | manual_review                   |
| 700  | Customer matched the Denied Parties List                                                                       | fraud_or_risk              | do_not_retry                    |
| 701  | Export billing or shipping country match                                                                       | fraud_or_risk              | do_not_retry                    |
| 702  | Export email country match                                                                                     | fraud_or_risk              | do_not_retry                    |
| 703  | Export hostname or IP country match                                                                            | fraud_or_risk              | do_not_retry                    |

Code `267` is cited in the REST timeout guidance as "deferred or pending timeout" but is **not in the table**. The timeout guidance also cites `ESYSTEM` and `ETIMEOUT`; the support article describes such values as SCMP reply flags (`rFlag`). The full `rFlag` vocabulary is **NOT DOCUMENTED** on the pages read.

### 6d. AVS and CVN

AVS (`processorInformation.avs.code`), general table for "Other Processors" (29 codes): `A` street match only; `B` street match, postal not verified (non-US Visa); `C` no match (non-US Visa); `D` and `M` full match (non-US Visa); `E` invalid or not allowed for the card type; `F` name mismatch, postal match (Amex); `G` non-US issuer does not support AVS; `H` name mismatch, street and postal match (Amex); `I` address not verified (non-US Visa); `K` name match only (Amex); `L` name and postal match (Amex); `N` no match; `O` name and street match (Amex); `P` postal match, street not verified (non-US Visa); `R` system unavailable; `S` US issuer does not support AVS; `T` name mismatch, street match (Amex); `U` address information unavailable; `V` name, street and postal match (Amex); `W` nine-digit postal match only; `X` street and nine-digit postal match; `Y` street and five-digit postal match; `Z` five-digit postal match only; `1` AVS not supported or disabled; `2` unrecognized processor value; `3` address confirmed (PayPal Express Checkout); `4` address not confirmed (PayPal Express Checkout); `5` no AVS code returned. Visa Platform Connect uses the subset `A, N, R, U, Y, Z` and converts Amex AVS codes to Visa codes. Cielo 3.0 and Cybersource Latin American Processing use a separate 12-code table (`D, E, F, G, I, K, L, N, O, R, T, V`) that includes CPF matching, so the same letter can mean something different there. Suggested use: informational; `N` and partial matches feed fraud_or_risk context, never a decline category on their own.

CVN (`processorInformation.cardVerification.resultCode`; table from the Secure Acceptance guide, 11 codes): `D` issuer considered the transaction suspicious; `I` failed processor data validation; `M` matched; `N` did not match; `P` not processed, unspecified reason; `S` on the card but not sent; `U` issuer does not support CVN; `X` card association does not support CVN; `1` not supported for this processor or card type; `2` unrecognized processor value; `3` no result code returned. The payments guide adds that Amex accounts not configured for CVN return `1`.

### 6e. Merchant advice codes (`processorInformation.merchantAdvice.code`)

From the OpenAPI field description (processors listed: HSBC, Barclays, FDC Nash, FDI Global, Elavon America, VPC, Rede, Paymentech Salem):

| Network    | Code | Meaning (paraphrase)                       | Retry suggestion         |
| ---------- | ---- | ------------------------------------------ | ------------------------ |
| Visa       | 1    | Issuer never approves                      | do_not_retry             |
| Visa       | 2    | Issuer cannot approve now                  | retry_conditionally      |
| Visa       | 3    | Data quality; revalidate payment details   | customer_action_required |
| Mastercard | 01   | New account information available          | customer_action_required |
| Mastercard | 02   | Try again later                            | retry_conditionally      |
| Mastercard | 03   | Do not try again                           | do_not_retry             |
| Mastercard | 04   | Token not supported                        | do_not_retry             |
| Mastercard | 21   | Do not honor                               | do_not_retry             |
| Mastercard | 22   | Merchant does not qualify for product code | do_not_retry             |
| Mastercard | 24   | Retry after 1 hour                         | retry_conditionally      |
| Mastercard | 25   | Retry after 24 hours                       | retry_conditionally      |
| Mastercard | 26   | Retry after 2 days                         | retry_conditionally      |
| Mastercard | 27   | Retry after 4 days                         | retry_conditionally      |
| Mastercard | 28   | Retry after 6 days                         | retry_conditionally      |
| Mastercard | 29   | Retry after 8 days                         | retry_conditionally      |
| Mastercard | 30   | Retry after 10 days                        | retry_conditionally      |
| Mastercard | 40   | Consumer non-reloadable prepaid card       | do_not_retry             |
| Mastercard | 41   | Consumer single-use virtual card number    | do_not_retry             |
| Mastercard | 42   | Sanctions score exceeds threshold          | manual_review            |
| Mastercard | 99   | Do not try again                           | do_not_retry             |

Barclays-specific values: `code` `00` no information, `01` new account information, `02` try later, `03` do not try again, `05` blocked by the card company; `codeRaw` `01`, `02`, `04`, `08` with similar meanings. The Visa and Mastercard code spaces overlap (`1` vs `01`), so the card network must be known before mapping. The successful authorization example carries `codeRaw` `M001`; the format of that raw value (an `M` prefix before the code) is **NOT DOCUMENTED**.

### 6f. Payment insights categories (`paymentInsightsInformation.responseInsights`)

From the "Declined Authorization" section: `01` `ISSUER_WILL_NEVER_APPROVE` (do not retry); `02` `ISSUER_CANNOT_APPROVE_AT_THIS_TIME`, `03` `ISSUER_CANNOT_APPROVE_WITH_THESE_DETAILS` (revalidate data first), `04` `GENERIC_ERROR`, `97` `PAYMENT_INSIGHTS_INTERNAL_ERROR`, `98` `OTHERS`, `99` `PAYMENT_INSIGHTS_RESPONSE_CATEGORY_MATCH_NOT_FOUND`: these may be retried at most 15 times over 30 days. This is first-party retry advice and maps directly to do_not_retry (01) and retry_conditionally (others).

### 6g. Processor response codes (`processorInformation.responseCode`)

No universal table exists. The field reference documents processor-specific lists only:

- China UnionPay: 76 codes (approval, decline, pick-up, file-processing and retry-later values).
- Visa Platform Connect, Mastercard declines: response `51` insufficient funds, `79` life cycle, `82` policy, `83` fraud or security, combined with decline reason codes `01`, `02`, `03`, `24`-`30` (same meanings as the Mastercard advice codes above); `Z5` valid account but amount not supported; `70` PIN required and `1A` additional authentication required, each only in listed countries.
- Atos: `aa,bb` (Atos code, optional bank code). Comercio Latino: `[status]:E[error]` or `[status]:R[response]`, example `2:R06`. AIBMS: `08` acceptable with identification. JCN Gateway: 3-character detail code paired with `responseCategoryCode`.
- `issuerInformation.responseCode` (HSBC, FDC Nashville Global, SIX): a 20-row sample of 3-digit Visa, Mastercard, Amex and Discover codes, explicitly not complete.

The guide's own examples show `responseCode` values `00`, `100`, `111`, `200` and `000` without explanation. An adapter should show `responseCode` verbatim, attach the processor-specific meaning only when `processorInformation.name` or other context identifies the processor, and otherwise mark it unknown. Cybersource says not to use this field to evaluate the result; `status` and `reason` are authoritative.

### 6h. Count summary

| Table                                              | Count                       |
| -------------------------------------------------- | --------------------------- |
| 6a `status` (payments family 15, other services 5) | 20                          |
| 6b REST `reason` (payments 63, other services 14)  | 77                          |
| 6c numeric reason codes                            | 89                          |
| 6d AVS (general) / Cielo-LatAm / CVN               | 29 / 12 / 11                |
| 6e merchant advice (Visa 3, Mastercard 17)         | 20 (+ Barclays 5 and raw 4) |
| 6f payment insights categories                     | 7                           |
| Transaction Details `rCode`                        | 3                           |
| 6g processor-specific (China UnionPay)             | 76 (not tabulated here)     |

---

## 7. Lifecycle

### 7.1 Operations and their result states

| Operation                      | Endpoint                                                                                                                             | Success status                    | Notes                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization                  | `POST /pts/v2/payments`                                                                                                              | `AUTHORIZED`                      | `_links` offer `capture` and `authReversal`. Holds usually expire in 5 to 7 days (issuer-defined); Cybersource keeps authorization data 180 days and is not told about expiry.                                                                                                                                  |
| Sale (authorization + capture) | `POST /pts/v2/payments` with `processingInformation.capture: true`                                                                   | `AUTHORIZED`                      | The sale example's `_links` offer `void` instead of `capture`. Dual-message vs single-message processing differ in when funds move.                                                                                                                                                                             |
| Partial authorization          | same                                                                                                                                 | `PARTIAL_AUTHORIZED`              | `authorizedAmount` below `totalAmount`; with dual-message, the capture is not processed.                                                                                                                                                                                                                        |
| Incremental authorization      | `PATCH /pts/v2/payments/{id}`                                                                                                        | `AUTHORIZED`                      | The `id` stays the same as the original authorization (OpenAPI `id` description; the guide example returns the original ID). One capture covers the initial and incremental amounts.                                                                                                                            |
| Capture                        | `POST /pts/v2/payments/{id}/captures`                                                                                                | `PENDING`                         | Batched, usually sent to the processor after midnight; funds in 2 to 4 days. "The payment processor does not notify Cybersource that the money has been transferred." Not possible while the authorization is under review.                                                                                     |
| Authorization reversal         | `POST /pts/v2/payments/{id}/reversals`                                                                                               | `REVERSED`                        | Only one successful reversal or void per transaction. Not possible while under review. Partial reversals happen automatically when capturing less than authorized.                                                                                                                                              |
| Timeout reversal               | `POST /pts/v2/reversals` with `clientReferenceInformation.transactionId`                                                             | `REVERSED`                        | Wait 60 seconds first. Cybersource may also reverse automatically after a processor timeout.                                                                                                                                                                                                                    |
| Follow-on refund               | `POST /pts/v2/payments/{id}/refunds` or `/pts/v2/captures/{id}/refunds`                                                              | `PENDING`                         | Within 180 days; multiple partial refunds allowed up to the original amount. The refund resource lives under `/pts/v2/credits/{refundId}`. Refunds can be declined (`DECLINED` with a reason) when credit authorization is enabled.                                                                             |
| Stand-alone credit             | `POST /pts/v2/credits`                                                                                                               | `PENDING` (or `AUTHORIZED`)       | Not all processors support it.                                                                                                                                                                                                                                                                                  |
| Void                           | `POST /pts/v2/payments/{id}/voids` (sale), `/pts/v2/captures/{id}/voids`, `/pts/v2/credits/{id}/voids`, `/pts/v2/refunds/{id}/voids` | `VOIDED`                          | Only before the batch is sent; after a capture void the authorization hold remains.                                                                                                                                                                                                                             |
| Timeout void                   | `POST /pts/v2/voids` with `clientReferenceInformation.transactionId`                                                                 | `VOIDED`                          | For a capture, sale, refund or credit whose response was lost.                                                                                                                                                                                                                                                  |
| Payout                         | `POST /pts/v2/payouts`                                                                                                               | `ACCEPTED`                        | Separate status and reason set.                                                                                                                                                                                                                                                                                 |
| Settlement                     | none                                                                                                                                 | NOT DOCUMENTED as a payload state | Webhook events report capture and refund moving from `PENDING` to `BATCHED`; settled funds are confirmed through processor reports.                                                                                                                                                                             |
| Chargeback                     | Reporting `GET /reporting/v3/chargeback-details`                                                                                     | n/a                               | Report rows: `requestId`, `merchantReferenceNumber`, `reasonCode`, `amount`, `sign`, `action`, `actionDescription`, `natureOfDispute`, `alertType`, `time`, `responseDueTime`, `originalSettlementTime`, `preDisputeFlag`, `applications`. No chargeback webhook event and no reason code table are documented. |

### 7.2 Timeouts and unknown outcomes

The payments guide (revision 26.09.01) treats a timeout as an unknown result, not a failure. It distinguishes four cases: request never reached Cybersource (no duplicate risk), internal service failure (`SERVICE_TIMEOUT`, low risk, retry after about 30 seconds), processor too slow (`SERVER_TIMEOUT`, high risk; Cybersource may send an automatic reversal), and approval whose response was lost (highest risk). It recommends a client timeout of 60 seconds or more, status lookup by `id` or `clientReferenceInformation.code` before any retry, and reversing the duplicate rather than the original. For a timeline this means a `SERVER_ERROR` event must be shown as "outcome unknown", and a later automatic reversal can appear without a merchant request.

### 7.3 Recurring billing

Recurring Billing retries failed charges automatically, up to five times depending on frequency (daily: once after 1 hour; weekly: every day, 3 times; monthly: every 2 days, 5 times; yearly: every 15 days, 3 times). During retries the subscription is delinquent; after a "Do Not Retry" type decline it is suspended at once. Webhook events: `rbs.subscriptions.charge.created`, `rbs.subscriptions.charge.failed`, `rbs.subscriptions.charge.pre-notified`. Their payload fields are **NOT DOCUMENTED** on the pages read.

---

## 8. Notifications (webhooks)

### 8.1 Delivery

- Transport: HTTPS POST to the subscription's `webhookUrl`. Mutual trust is mandatory: allowlist source IPs `198.241.206.21` and `198.241.207.21` and trust the "Visa Corporate Root CA - G2" certificate. OAuth or OAuth with JWT can be added.
- New or changed webhook URLs go through a review that "can take 1-2 business days".
- Content type: the example header shows `Content-Type: application/json`.
- Payment events must be enabled by support and, like Unified Checkout events, **require message-level encryption** (JSON Web Encryption, AES-GCM 256 with RSA-OAEP 2048, X.509 certificates). Pay by Bank and Pay by Link pages also say notifications with personal data are encrypted.
- Retry policy (default): 3 attempts, the first 1 minute after the failed delivery, then every 1 minute; configurable through `retryPolicy.firstRetry`, `interval`, `numberOfRetries`, `repeatSequenceCount`, `repeatSequenceWaitTime`, `deactivateFlag`. With `deactivateFlag` true and a health check URL, notifications are withheld while the endpoint is down (subscription `SUSPENDED`) and "all withheld notifications are delivered" when it recovers.
- Acknowledgement: what response counts as success is **NOT DOCUMENTED** beyond "unresponsive" URLs triggering retries.
- Ordering: **NOT DOCUMENTED**. Withheld notifications delivered after recovery can arrive late.
- Subscription statuses: `PENDING_REVIEW`, `BLOCKED`, `ACTIVE`, `INACTIVE`, `SUSPENDED`.

### 8.2 Envelope fields (notification version 3)

| Field                | Meaning                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webhookId`          | Subscription that generated the notification                                                                                                                                       |
| `transactionTraceId` | Identifier of the notification attempt. Guide: "Every retry attempt has a unique transaction trace ID." The OpenAPI test-webhook schema calls it "The identifier for the webhook". |
| `productId`          | Product (for example `payments`, `tokenManagement`)                                                                                                                                |
| `organizationId`     | Subscribed organization                                                                                                                                                            |
| `eventType`          | Event type (section 8.4)                                                                                                                                                           |
| `eventDate`          | When the event occurred (example `2022-07-20T11:38:45`, no time zone)                                                                                                              |
| `payload`            | Event data; an object in the TMS example, an encrypted string in the Pay by Bank example                                                                                           |
| `requestType`        | New notification or retry (example `NEW`; the retry value is NOT DOCUMENTED)                                                                                                       |
| `retryNumber`        | Appears in the example and in the OpenAPI test-webhook schema ("number of retry attempts"), not in the field list                                                                  |

Headers in the example: `v-c-event-type`, `v-c-organization-id`, `v-c-product-name`, `v-c-request-type`, `v-c-retry-count`, `v-c-signature`, `v-c-transaction-trace-id`, `v-c-webhook-id`.

### 8.3 Signature (sensitive; do not verify)

`v-c-signature: t=<timestamp>;keyId=<key UUID>;sig=<Base64 HMAC-SHA256>`. Validation steps in the guide: split on `;`, fetch the key by `keyId`, compute HMAC-SHA256 over `<t>.<raw body>` with the Base64-decoded key, compare to `sig`. The guide describes `t` as "The timestamp at which the digital signature key was created", yet the sample code signs `t` together with the body like a per-message timestamp (section 12). The digital signature key must be replaced every year. PandaPayLens should redact `sig`, may report `keyId` and `t` as metadata, and never asks for the key.

### 8.4 Event types (45 rows, 42 distinct strings)

| Product ID                      | Event types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `payments` (14)                 | `payments.authorization.status.accepted` (AUTHORIZED), `.reviewed` (AUTHORIZED_PENDING_REVIEW), `.rejected` (INVALID_REQUEST, SERVER_ERROR, DECLINED, SERVER_TIMEOUT or SERVICE_TIMEOUT), `.partiallyApproved` (PARTIAL_AUTHORIZED); `payments.capture.status.accepted` (PENDING), `.updated` (PENDING to BATCHED); `payments.refund.status.accepted`, `.updated` (same pattern); `payments.credit.status.accepted`, `.updated`; `payments.void.status.accepted` (VOIDED), `.rejected` (NOT VOIDABLE); `payments.reversal.status.accepted` (REVERSED), `.rejected` |
| `alternativePaymentMethods`     | `payments.payments.updated`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `eCheck` (6)                    | `payments.credits.accepted`, `payments.credits.failed`, `payments.payments.accepted`, `payments.payments.failed`, `payments.voids.accepted`, `payments.voids.failed`                                                                                                                                                                                                                                                                                                                                                                                               |
| `decisionManager` (3)           | `risk.casemanagement.decision.accept`, `risk.casemanagement.decision.reject`, `risk.profile.decision.reject`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `fraudManagementEssentials` (6) | `risk.casemanagement.decision.accept`, `risk.casemanagement.addnote`, `risk.profile.decision.reject`, `risk.casemanagement.decision.reject`, `risk.profile.decision.monitor`, `risk.profile.decision.review`                                                                                                                                                                                                                                                                                                                                                       |
| `customerInvoicing` (6)         | `invoicing.customer.invoice.send`, `.cancel`, `.paid`, `.partial-payment`, `.reminder`, `.overdue-reminder`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `payByLink` (2)                 | `payByLink.customer.payment`, `payByLink.merchant.payment`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `recurringBilling` (3)          | `rbs.subscriptions.charge.failed`, `rbs.subscriptions.charge.pre-notified`, `rbs.subscriptions.charge.created`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tokenManagement` (3)           | `tms.networktoken.updated`, `tms.networktoken.provisioned`, `tms.networktoken.binding`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `unifiedCheckout` (1)           | `uc.orders.transactionresults`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

The event type already encodes the result for payments (`accepted`, `rejected`, `reviewed`, `partiallyApproved`, `updated`), so even with an encrypted payload an adapter can place an event on a timeline with its type and time.

### 8.5 Examples

Token Management notification. **Transcribed from https://developer.cybersource.com/docs/cybs/en-us/webhooks/implementation/all/rest/webhooks.md** (section "Example: Notification Payload"). The header block is reproduced as published, including its broken line joins and the missing colon after `v-c-signature`:

```
Headers
POST /test HTTP/1.1Host: test.test.comContent-Length: 537 Content-Type:
application/jsonv-c-event-type: product.event.typev-c-organization-id:
orgidv-c-product-name: productv-c-request-type: NEWv-c-retry-count: 0
v-c-signature "t=timestamp;keyId=key-UUID;sig=calculatedDigitalSignature"
v-c-transaction-trace-id: "7ac2ad9f-6a89-d3e9-e053-34b8d30aaf40"
v-c-webhook-id: "e339e8b1-d540-4efd-e053-8d588e0a2de5"

Body Payload
{
    "eventType": "tms.networktoken.provisioned",
    "webhookId": "e339e8b1-d540-4efd-e053-8d588e0a2de5",
    "productId": "tokenManagement",
    "organizationId": "sampleSubscriptionHolder",
    "eventDate": "2022-07-20T11:38:45",
    "transactionTraceId": "7ac2ad9f-6a89-d3e9-e053-34b8d30aaf40",
    "retryNumber": 0,
    "payload": {
      "data": {
        "_links": {
          "paymentInstruments": [
             {
               "href": "/tms/v1/paymentinstruments/...................."
             }
           ],
           "instrumentIdentifiers": [
             {
               "href": "/tms/v1/instrumentidentifiers/...................."
                 }
            ]
          },
            "id": "...................",
            "type": "tokenizedCardEnrollments",
            "version": "1.0"
        },
        "organizationId": "sampleSelfOrChildOrg"
    },
    "requestType": "NEW"
}
```

Pay by Bank notification, **transcribed from https://developer.cybersource.com/docs/cybs/en-us/pay-by-bank/developer/all/rest/pay-by-bank/paybybank-intro-services/paybybank-webhook-intro.md**. The published text contains invisible zero-width characters inside the braces; they are removed here, and the long `payload` ciphertext is cut after its first characters:

```
{
  "eventType": "payments.payments.updated",
  "productId": "alternativePaymentMethods",
  "organizationId": "organizationId",
  "transactionTraceId": "6584251287300178228949",
  "payload": "{CBC}nL1LK67IH1LQKad3qyhilPoeDGrHo/6ClIZ17HSC5YX9TQFIgCOhVPi139kmB/... (truncated)",
      "metadata": {
          "notificationTypeID": "5",
          "notificationReason": "payment"
      }
  }
```

The same page shows the decrypted payload as a flat object with dotted keys:

```
{
  "id": "6584251287300178228949",
  "reconcillationID": "85100194sale",
  "status": "settled",
  "submitTimeUTC": "2022-07-21T17:38:48Z",
  "clientReferenceInformation.code": "TC85100-1",
  "orderInformation.amountDetails.totalAmount": "1999.99",
  "orderInformation.amountDetails.currency": "GBP"

  }
```

Note the misspelled `reconcillationID`, the lowercase `status`, the `{CBC}` prefix (not the JWE format described in the MLE section), and that `transactionTraceId` equals the payment `id` here. The decrypted payload of card payment events (`payments.authorization.status.*` and so on) is **NOT DOCUMENTED** on any page read.

### 8.6 Duplicate detection

There is no documented stable event ID. `transactionTraceId` changes on every retry attempt (per the guide), so it identifies a delivery, not an event. Suggested dedupe key for plain-text envelopes: `webhookId` + `eventType` + `eventDate` + the transaction `id` when the payload is readable; retries can be recognized by `requestType`/`v-c-request-type` other than `NEW` or `retryNumber`/`v-c-retry-count` above 0. For encrypted payloads, dedupe is not possible offline beyond identical ciphertext.

---

## 9. Identifiers

| Field                                                                                     | Scope                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                      | Cybersource request ID, one per operation. Each follow-on (capture, reversal, refund, void) gets its **own new `id`**; the parent `id` appears only in the request path (`/pts/v2/payments/{parentId}/captures`). The capture, refund and void responses read do **not** echo the parent ID. Incremental authorizations keep the original `id`. |
| `_links.self.href`                                                                        | Resource type and ID of the created object: `/pts/v2/payments/`, `/pts/v2/captures/`, `/pts/v2/reversals/`, `/pts/v2/credits/` (refunds and credits), `/pts/v2/voids/`. Useful to classify the operation when only the response is pasted.                                                                                                      |
| `rootId` (Transaction Details)                                                            | ID of the first transaction in the series (for example the authorization behind a capture and refund). The best documented parent link, but only in Transaction Details.                                                                                                                                                                        |
| `_links.relatedTransactions[]` (Transaction Details)                                      | Links to related transactions.                                                                                                                                                                                                                                                                                                                  |
| `reconciliationId`                                                                        | Reconciliation reference, max 60; equals `id` in the authorization example, different in capture and refund examples.                                                                                                                                                                                                                           |
| `clientReferenceInformation.code`                                                         | Merchant order reference. The guide recommends a unique value per transaction; duplicate blocking within 15 minutes depends on account settings. A capture "maps from the original authorization". Length: 50 in the field reference, 59 in the OpenAPI schema, with many processor limits.                                                     |
| `clientReferenceInformation.transactionId`                                                | Merchant transaction ID for duplicate prevention and timeout recovery (authorization, sale, credit, refund). Not available on 14 listed processors; field reference says Visa Platform Connect only.                                                                                                                                            |
| `processorInformation.transactionId` / `networkTransactionId`                             | Network transaction ID (needed for merchant-initiated follow-ups).                                                                                                                                                                                                                                                                              |
| `processorInformation.approvalCode`, `systemTraceAuditNumber`, `retrievalReferenceNumber` | Processor-level references.                                                                                                                                                                                                                                                                                                                     |
| `processorInformation.paymentAccountReferenceNumber`                                      | Payment Account Reference (PAR) linking a card account across tokens. Treat as sensitive.                                                                                                                                                                                                                                                       |
| `webhookId`, `transactionTraceId`, `organizationId`                                       | Subscription, delivery attempt and organization in notifications.                                                                                                                                                                                                                                                                               |
| Chargeback report `requestId`, `merchantReferenceNumber`, `transactionReferenceNumber`    | Link a chargeback row to the original request and order.                                                                                                                                                                                                                                                                                        |
| `processorInformation.sequenceNumber`                                                     | Identifier for initial and subsequent recurring transactions, specific to the payment brand.                                                                                                                                                                                                                                                    |

---

## 10. Sensitive fields

Redact or mask by default. Request fields are included because developers often paste request and response pairs.

- **Card data**: `paymentInformation.card.number`, `securityCode`, `expirationMonth`, `expirationYear`; `paymentInformation.tokenizedCard.*` (number, cryptogram); the SDK log mask list also covers `cardNumber`, `account`, `prefix`, `bin`, `type` and `token`.
- **Bank data**: `paymentInformation.bank.account.number`, `routingNumber`.
- **Authentication data**: `consumerAuthenticationInformation.cavv`, `xid`, payer authentication transaction IDs.
- **Personal data**: `orderInformation.billTo.*` and `shipTo.*` (names, address, email, phone), `buyerInformation.*` (including `merchantCustomerId`, `hashedPassword`), `deviceInformation.ipAddress`, `hostName`.
- **Secrets and auth material**: HTTP `Authorization` (Bearer JWT), `Signature` and `Digest` headers, JWT claims, the shared secret key, P12 certificates, the webhook digital signature key, the `sig` part of `v-c-signature`, OAuth credentials, MLE private keys.
- **Encrypted blobs**: `encryptedRequest`, `encryptedResponse`, encrypted webhook `payload` strings. They cannot be decrypted offline; report them as encrypted and do not display them in full.
- **Merchant identifiers**: `v-c-merchant-id` header, `merchantId`, `organizationId`, `processorInformation.merchantNumber`, `webhookUrl`, `healthCheckUrl`.
- **Network references**: `processorInformation.paymentAccountReferenceNumber`, `networkTransactionId` (low sensitivity, but mask in shared reports).

---

## 11. Structural detection hints

Strong Cybersource signals (combine several):

1. JSON with `submitTimeUtc` (ISO `...Z`) plus an uppercase `status` from the enums in section 6a, and an `id` of about 22 digits as a string.
2. Nested objects named with the `...Information` suffix: `clientReferenceInformation`, `processorInformation`, `orderInformation.amountDetails`, `paymentInformation`, `errorInformation`, `paymentInsightsInformation`, `pointOfSaleInformation`.
3. `_links` entries whose `href` starts with `/pts/v2/payments/`, `/pts/v2/captures/`, `/pts/v2/reversals/`, `/pts/v2/credits/`, `/pts/v2/voids/` or `/tss/v2/transactions/`, each with `method`.
4. HTTP 400/502 flat body: exactly `submitTimeUtc`, `status` (`INVALID_REQUEST` or `SERVER_ERROR`), `reason` (uppercase snake case from section 6b), `message`, optional `details[]` with `field` and `reason`.
5. Transaction Details: `rootId`, `submitTimeUTC`, `applicationInformation.applications[]` with names starting `ics_` (`ics_auth`, `ics_bill`, `ics_credit`, `ics_auth_reversal`, `ics_void`), `rCode`, `rFlag`, `rMessage`.
6. Webhook envelope: `webhookId`, `transactionTraceId`, `productId`, `organizationId`, `eventType` in lowercase dotted form (`payments.capture.status.accepted`, `tms.networktoken.provisioned`, `risk.profile.decision.review`, `rbs.subscriptions.charge.failed`), `eventDate`, `requestType`; headers prefixed `v-c-` and `v-c-signature: t=...;keyId=...;sig=...`.
7. MLE wrapper: a JSON object whose only key is `encryptedResponse` (or `encryptedRequest`) holding a JWE compact string.
8. Hosts: `api.cybersource.com`, `apitest.cybersource.com`; paths `/pts/v2/`, `/tss/v2/`, `/notification-subscriptions/`, `/reporting/v3/`.

Versus supported providers: Stripe (`object` field, `pi_`/`ch_`/`evt_` prefixes, `type` plus `data.object`), Adyen (`pspReference`, `resultCode`, `notificationItems`), Checkout.com (`type` such as `payment_captured` with `data`), PayPal (`event_type` uppercase like `PAYMENT.CAPTURE.COMPLETED`, `resource`), Braintree (form-encoded `bt_signature`/`bt_payload`), Mollie (`id=tr_...`), Square (`event_id`, `type`, `merchant_id`, `data`), payabl. (URL-encoded `transactionid`/`transid`/`errmsg`), NMI (query string `response`/`response_code`, webhook `event_id`/`event_body`, header `Webhook-Signature: t=...,s=...`). None of the Cybersource markers above (`submitTimeUtc`, `...Information` objects, `/pts/v2/` links, `transactionTraceId`, `v-c-signature` with `keyId`) appear in those formats as described in their research files.

Versus other candidates: Authorize.net is owned by Cybersource but documents its own formats, which were not researched here; do not attribute Authorize.net payloads to this adapter. The Visa Acceptance Solutions brand serves the same documentation, so a payload from a "Visa Acceptance" integration is expected to look identical and can be labeled "Cybersource-format".

False-positive risk: low for full responses. A bare `{"status": "DECLINED"}` or a lone `reason` string is too generic; require at least two markers.

---

## 12. Limitations, ambiguities, inconsistencies

1. **Payment webhook payloads are encrypted**, and the decrypted card payment event shape is NOT DOCUMENTED. Only the envelope and event types are usable offline.
2. **Two encryption formats**: the webhook MLE section says JSON Web Encryption; the Pay by Bank example shows a string starting `{CBC}` with a `metadata` object.
3. **`PROCESSOR_ERROR` meaning conflicts**: `responsecode.json` says "pick up card"; the guide's decline example pairs it with "Invalid account".
4. **`responsecode.json` vs OpenAPI**: the JSON file has `PROCESSOR_TIMEOUT`, `BOLETO_DECLINED`, `DEBIT_CARD_USAGE_LIMIT_EXCEEDED` and `INVALID_OR_MISSING_CONFIG`, which the OpenAPI enums lack; the OpenAPI enums have 14 reasons the JSON file lacks (`BLOCKED_BY_CARDHOLDER`, `DAGGREJECTED`, `DAGGDENIED`, `DSYSREJECTED`, `NOT_SUPPORTED` and others) with no description. The JSON file puts `SERVER_ERROR` in HTTP 201 (and once in HTTP 400 for credits); the OpenAPI 201 enum has no `SERVER_ERROR`. `INVALID_MERCHANT_CONFIGURATION` is listed twice in the OpenAPI payments reason enum.
5. **Wrong field name in action texts**: `responsecode.json` tells developers to read `statusInformation.details[]`, but the schemas use `errorInformation.details[]` (201) and top-level `details[]` (400).
6. **Rendering defects in `responsecode.json`**: unrendered placeholders `[[decisionManager]]` and `[[payerAuthentication]]`, and invalid bytes where apostrophes should be (the file is not valid UTF-8). A parser that loads it must tolerate this.
7. **Status vs reason confusion in webhook docs**: the event table lists `SERVER_TIMEOUT` and `SERVICE_TIMEOUT` as statuses and uses `NOT VOIDABLE` with a space; `payments.credit.status.updated` repeats the "accepted" description; `payments.reversal.status.rejected` lists `REVERSED` among rejection statuses.
8. **`transactionTraceId` description differs**: unique per retry attempt (guide) vs "The identifier for the webhook" (OpenAPI); in the Pay by Bank example it equals the payment `id`.
9. **Signature timestamp**: `t` is described as the key creation time but is used as a per-message value in the validation steps.
10. **Example inconsistencies**: a successful authorization example carries payment insights category `01` (a decline category); a declined example sits under the heading "Response to a Successful Request"; declined and partial examples show `processorInformation.responseCode` `100`; the 502 examples include `id` although the 502 schema does not.
11. **Pay by Link** event descriptions are swapped between the Pay by Link page and the webhooks guide (which event is for merchants and which for partner resellers). The subscription examples include `retryPolicy.algorithm: "ARITHMETIC"`, which the retry field list does not mention.
12. **Merchant transaction ID uniqueness**: "unique for 180 days" (timeout void section) vs "already been used in the last 60 days" (field reference and reason code 105). Availability: "broadly available" except 14 processors (guide) vs "available only on the Visa Platform Connect processor" (field reference).
13. **`clientReferenceInformation.code` length**: 50 (field reference) vs 59 (OpenAPI), with an odd "All Other Processor's Data Length: 8".
14. **Numeric code 267** is cited in the timeout guidance but missing from the reason code table; `ESYSTEM`/`ETIMEOUT` are cited without a REST definition.
15. **AVS table** header says Cybersource numeric codes are `1, 2, 3, 4`, but the table also defines `5`. AVS letters differ for Cielo / Latin American Processing.
16. **Processor dependence**: `processorInformation.responseCode`, AVS, CVN, merchant advice and many fields depend on the processor (30+); the guide read is the Visa Platform Connect variant, and other processor variants were not read.
17. **Field casing**: `submitTimeUtc` (Payments) vs `submitTimeUTC` (Transaction Details, Pay by Bank).
18. **Refund resource path**: the follow-on refund example links its void to `/pts/v2/credits/{id}/voids`, while the fast refund example and the OpenAPI spec use `/pts/v2/refunds/{id}/voids`. A parser should accept both as refund resources.
19. **Chargebacks** appear only in Reporting API rows; there is no chargeback webhook and no chargeback reason code table on the pages read.
20. **Webhook acknowledgement, ordering and the retry value of `requestType`** are NOT DOCUMENTED.
21. The `v-c-correlation-id` header appears as a constant in the Node SDK, but its meaning is NOT DOCUMENTED on the pages read.

---

## 13. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **errorDecoding**    | **supported** | First-party `status`/`reason` table with messages and recommended actions per service and HTTP code (77 reasons), OpenAPI enums, 89 numeric reason codes, AVS/CVN tables, merchant advice codes and payment insights retry categories. Caveats: some enum values have no description, `processorInformation.responseCode` is processor-specific; fall back to `unknown`. |
| **paymentResponses** | **supported** | Stable JSON schemas in the official OpenAPI spec and many guide examples for every payment operation; HTTP 201/400/502 shapes are distinct and documented. MLE-wrapped responses (`encryptedResponse`) must be detected and reported as unreadable.                                                                                                                      |
| **webhookParsing**   | **limited**   | Envelope fields, headers, signature format, retry policy and 42 event types are documented, and the event type alone carries the outcome for payment events. But payment and Unified Checkout payloads are encrypted, the decrypted card event shape is NOT DOCUMENTED, there is no stable event ID, and acknowledgement and ordering are undocumented.                  |
| **timeline**         | **limited**   | Each operation has its own response with `submitTimeUtc` and a clear status (AUTHORIZED, PENDING, REVERSED, VOIDED); webhook events add PENDING to BATCHED; Transaction Details lists applications and `rootId`. Settlement is not a payload state, chargebacks are only in reports, timeouts produce unknown outcomes and automatic reversals.                          |
| **correlation**      | **limited**   | Follow-on responses do not echo the parent `id` (only the request path and Transaction Details `rootId` link them); `clientReferenceInformation.code` is merchant-defined and only optionally unique; `reconciliationId` and network IDs help but are processor-dependent. Correlating pasted responses by `code` plus amount is reasonable but heuristic.               |
