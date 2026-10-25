# PXP Financial (adapter id `pxp`): high-risk provider research

Status: qualification gate, classification and technical specification for a parse-only PandaPayLens adapter. Everything below comes from PXP's first-party sources as published on the verification date. Nothing here is a guarantee about live behavior. Where the docs are silent, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Method: developer pages were fetched anonymously as raw Markdown (`https://developer.pxp.io/<path>.md`, the format the portal itself lists in its `llms.txt` index). The OpenAPI bundles were downloaded from the portal's own "Download OpenAPI description" links. Corporate pages on `www.pxp.io` and the public status page were read as HTML. No login, sign-up or access request was made.
- Naming: the legal entity is **PXP Financial Limited** (FCA register number 504318). The product brand is **PXP**, the current platform is **PXP Unity** (launched 2025). In payloads, PXP's own acquiring appears as `providerResponse.provider` = `PXPFinancial` or `pxpfinancial`.

---

## Gate summary

| Item                 | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate outcome         | **documentation_verified**                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Classification       | `gateway`, `acquiring`, `card_processing`, `orchestration`, `alternative_payment_method` (see "Classification")                                                                                                                                                                                                                                                                                                                                                          |
| Documentation access | Public: whole developer portal, `llms.txt` index and OpenAPI 3.0.3 bundles. Login (Unity Portal) needed only for merchant setup, webhook URL/HMAC key configuration and credentials                                                                                                                                                                                                                                                                                      |
| API version          | Transactions service and Merchant webhooks service, OpenAPI `info.version` 1.0.0, URL version `/api/v1`                                                                                                                                                                                                                                                                                                                                                                  |
| Documented codes     | 44 normalized card codes (`CRD000`-`CRD185`) plus `VAN0001`; 8 pay-by-bank APM state codes seen in examples (6 in the enum); 7 APM error codes (`APM4100`-`APM4106`); 12 API `errorCode` values (examples only, no published list); 8 HTTP statuses; 3DS: 6 authentication states, 8 `transStatus` values, 30 reason codes, 11 3DS error codes, 10 `challengeCancel` values; 42 client SDK codes on the components errors page                                           |
| Webhook event types  | 38 named events in the webhook table, plus 2 card examples only in the OpenAPI (`TXN_RFU` refused, `TXN_ERR` error), 1 token example (`SchemeTokenUpdated`) and the test event `TS_TC`                                                                                                                                                                                                                                                                                   |
| Biggest limitations  | The webhook envelope has no consistent event-type field (card events often carry no `eventCode`); schema drift between examples (`amounts.transaction` vs `amounts.transactionValue`, flat vs nested `fundingData`, casing of `eventCategory` and `provider`); modifications return a new `systemTransactionId` with no documented parent field on card events; no chargeback or dispute events; raw acquirer codes in `providerResponse.code` are not documented by PXP |

---

## 1. Sources and verification date

All URLs below were read on **2026-10-25**.

### 1.1 Developer portal (developer.pxp.io)

| URL                                                                              | What it covers                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| https://developer.pxp.io/llms.txt                                                | Index of all portal pages (used to discover pages)                                                                       |
| https://developer.pxp.io/apis.md                                                 | List of API services                                                                                                     |
| https://developer.pxp.io/guides/get-started/api-overview.md                      | REST/JSON, HMAC auth, base URLs, HTTP status table, idempotency, versioning, webhook retries, `out.pxp.io` sender domain |
| https://developer.pxp.io/guides/get-started/quickstart.md                        | Request auth headers (`Authorization: PXP-UST1 {tokenId}:{timestamp}:{hmac}`, `X-Request-Id`, `X-Client-Id`)             |
| https://developer.pxp.io/guides/get-started/about-webhooks.md                    | **Webhook envelope, signature headers, event table (38 events), example `eventData` for every event**                    |
| https://developer.pxp.io/guides/get-started/manage-webhooks.md                   | Webhook setup, `/v1/merchant-webhooks` example, `{"state":"Success"}` response, duplicate handling                       |
| https://developer.pxp.io/guides/get-started/test-webhook-connectivity.md         | Test event (`eventCategory: test-connection`, `eventCode: TS_TC`), 10-second timeout                                     |
| https://developer.pxp.io/guides/transactions/how-it-works.md                     | Intents, states, **card response codes `CRD000`-`CRD185`**, APM codes `APM4100`-`APM4106`, `providerResponse` fields     |
| https://developer.pxp.io/guides/transactions/modify-transactions.md              | Modification model (capture, final capture, refund, incremental, void); new `systemTransactionId` per modification       |
| https://developer.pxp.io/guides/transactions/capture.md                          | Capture request/response                                                                                                 |
| https://developer.pxp.io/guides/transactions/final-capture.md                    | Final capture response                                                                                                   |
| https://developer.pxp.io/guides/transactions/void.md                             | Void request/response (`state: Cancelled`)                                                                               |
| https://developer.pxp.io/guides/transactions/refund.md                           | Card, SPEI, CVU, Bre-B refunds and responses                                                                             |
| https://developer.pxp.io/guides/transactions/incremental-authorisation.md        | Incremental authorisation response                                                                                       |
| https://developer.pxp.io/guides/transactions/get-transaction-details.md          | Lookup endpoint; array response; card (PXP and Elavon), FlashFlow examples                                               |
| https://developer.pxp.io/guides/transactions/e-commerce/card-transaction.md      | Card initiation request/response, CVC result values                                                                      |
| https://developer.pxp.io/guides/transactions/e-commerce/recurring-payments.md    | Processing models, scheme IDs (`schemeTransactionId`, `schemeTransactionLinkId`)                                         |
| https://developer.pxp.io/guides/transactions/e-commerce/spei-transaction.md      | SPEI deposit/payout (MXN), provider IDs                                                                                  |
| https://developer.pxp.io/guides/transactions/e-commerce/cvu-transaction.md       | CVU deposit/payout (ARS)                                                                                                 |
| https://developer.pxp.io/guides/transactions/e-commerce/bre-b-transaction.md     | Bre-B deposit/payout (COP), full webhook envelope example, event table                                                   |
| https://developer.pxp.io/guides/transactions/e-commerce/flashflow-transaction.md | FlashFlow pay-in/payout (THB), `PendingOnProvider`, `PayByBanks` quirk                                                   |
| https://developer.pxp.io/guides/transactions/release-notes.md                    | Body is "Coming soon."                                                                                                   |
| https://developer.pxp.io/guides/3ds/states.md                                    | 3DS authentication states, reason codes `01`-`30`, 3DS error codes                                                       |
| https://developer.pxp.io/guides/3ds/error-handling.md                            | 3DS failure scenarios and webhook fragments                                                                              |
| https://developer.pxp.io/guides/checkout/components/errors.md                    | Client SDK error codes `SDKxxxx`                                                                                         |
| https://developer.pxp.io/apis/transaction.md                                     | Transactions service summary, servers, endpoints                                                                         |
| https://developer.pxp.io/apis/merchant-webhook.md                                | Merchant webhooks service summary                                                                                        |
| https://developer.pxp.io/_bundle/apis/transaction.yaml                           | **Transactions OpenAPI 3.0.3**: schemas, state and `stateDataCode` enums, error examples                                 |
| https://developer.pxp.io/_bundle/apis/merchant-webhook.yaml                      | **Merchant webhooks OpenAPI 3.0.3**: `merchantWebhookRequest` schema and 65 named examples                               |
| https://developer.pxp.io/_bundle/apis/session.yaml                               | Session errors `SES4001`, `SES4006` (error sections only)                                                                |
| https://developer.pxp.io/_bundle/apis/links.yaml                                 | Links errors `INVALID_REQUEST`, `NOT_AUTHENTICATED`, `OBJECT_NOT_FOUND` (error sections only)                            |

### 1.2 Corporate site and status

| URL                                                                                                             | What it covers                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| https://www.pxp.io/our-story                                                                                    | History (Servebase 1980s, CQR/Kalixa 2001, FCA licence 2008, scheme membership 2011, PXP Unity 2025) |
| https://www.pxp.io/solutions/pxp-payments/orchestration/card-acquiring                                          | Principal memberships, FCA, US money transmitter licence, regions, 30+ acquiring partners            |
| https://www.pxp.io/solutions/pxp-payments/orchestration                                                         | Gateway + acquiring + cross-border in one orchestration layer                                        |
| https://www.pxp.io/solutions/pxp-payments/orchestration/payment-gateway                                         | Multi-acquirer gateway, smart routing, retries                                                       |
| https://www.pxp.io/gaming                                                                                       | Betting and gaming sector page                                                                       |
| https://www.pxp.io/high-risk-partners                                                                           | High-risk partner programme and listed verticals                                                     |
| https://www.pxp.io/retail, https://www.pxp.io/hospitality, https://www.pxp.io/travel, https://www.pxp.io/cruise | Sector pages                                                                                         |
| https://www.pxp.io/a-level-playing-field-for-uk-gambling-payments                                               | UK gambling (MCC 7995) working group                                                                 |
| https://www.pxp.io/termsconditions                                                                              | Contracting entities (PXP Accept GmbH for Gateway; tripartite terms for sponsored merchants)         |
| https://www.pxp.io/privacy-policy                                                                               | PXP Financial Limited (UK) and DaoPay GmbH (Austria, FMA licensed) as joint controllers for the EEA  |
| https://status.pxp.io/                                                                                          | Live component status                                                                                |

Also tried, no response (DNS/connection failure): `https://docs.pxpfinancial.com/`, `https://developer.pxpfinancial.com/`, `https://docs.pxp.io/`. `https://pxpfinancial.com/` redirects to `https://www.pxp.io/`.

---

## 2. Qualification gate

| #   | Question                                            | Answer            | Evidence                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company or product currently active                 | **yes**           | Status page lists "Transaction Processing: Operational" (https://status.pxp.io/). Docs contain dates up to 2026 (FlashFlow examples dated 2026-09-21, card scheme notices "from 1 June 2026" / "from 1 July 2026", https://developer.pxp.io/guides/transactions/how-it-works.md). Our Story: "2025 PXP Unity - our new tech platform - launches".                                                 |
| 2   | Relevant payment service operational                | **yes**           | Status page: Transaction Processing, Token Vault, Settlement, Reporting all "Operational" on 2026-10-25. One open incident is in "Monitoring" for a component named `BankTransferRedirectDeposit` ("Provider has informed that there were issues with their participating banks").                                                                                                                |
| 3   | Official developer documentation accessible         | **yes**           | Public without login: the whole developer portal, `llms.txt`, and OpenAPI YAML bundles. Behind the merchant **Unity Portal** login: webhook URL and HMAC key setup ("You can configure your HMAC key in the Unity Portal", about-webhooks), `merchant`/`site` values ("You can find these in the Unity Portal", api-overview), API credentials. None of those are needed to read payload formats. |
| 4   | API families and versions identified                | **yes**           | Transactions service: OpenAPI `version: 1.0.0`, servers `https://api-services.pxp.io/api/v1` and `https://api-services.test.pxp.io/api/v1` (https://developer.pxp.io/apis/transaction.md). Merchant webhooks service: `version: 1.0.0` (https://developer.pxp.io/apis/merchant-webhook.md). Versioning rule: "Each PXP API endpoint URL includes the version number" (api-overview).              |
| 5   | Responses/notifications examinable offline          | **yes**           | JSON response examples for authorise, refuse, error, capture, void, refund, incremental, lookup; full webhook envelope and `eventData` examples for every listed event (about-webhooks and merchant-webhook.yaml).                                                                                                                                                                                |
| 6   | Supported merchant sectors documented               | **yes**           | Sector pages for gaming ("betting and gaming operators"), retail, hospitality, travel, cruise; the high-risk partners page lists verticals. See "Sectors".                                                                                                                                                                                                                                        |
| 7   | Regional or regulatory limitations identified       | **yes (partial)** | "FCA authorised since 2008, register number 504318"; "holds a US money transmitter licence"; "Process across the UK, EU, US, Canada, and LATAM" (card-acquiring page). APMs are single-currency/region: SPEI `MXN`, CVU `ARS` and Argentina only, Bre-B `COP`, FlashFlow `THB` only. PSD2 SCA notes in 3DS docs. Per-country gambling acceptance rules are **NOT DOCUMENTED**.                    |
| 8   | Adapter gives diagnostic value                      | **yes**           | Closed enum of normalized card codes with messages, raw provider code and Mastercard-style `merchantAdvice` alongside, explicit `state` values, 3DS states and reasons, typed webhook events for deposits and payouts.                                                                                                                                                                            |
| 9   | Own technical formats, not a white label            | **yes**           | PXP documents its own JSON API and webhook format (PXP Unity Gateway). PXP is itself an acquirer ("We're not just a gateway. We're the acquirer", orchestration page). It also routes to third-party acquirers; their names and raw codes appear inside `providerResponse` (examples show `elavon` and `lloydscardnet`), but the outer format is PXP's.                                           |
| 10  | No live credentials or merchant relationship needed | **yes**           | All examples are in public docs.                                                                                                                                                                                                                                                                                                                                                                  |

**Gate outcome: `documentation_verified`** (items 1-5, 8, 9, 10 are yes).

---

## 3. Classification

| Class                           | Assigned               | Evidence                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`                       | yes                    | "The PXP Gateway is the connection point for all your payments needs" (https://www.pxp.io/solutions/pxp-payments/orchestration). Gateway T&C with PXP Accept GmbH (termsconditions).                                                                                                                                                                                               |
| `acquiring`                     | yes                    | "PXP holds principal memberships with the world's major card networks"; "Principal member of Visa and Mastercard since 2011, Diners Club and Discover since 2022" (card-acquiring page). Privacy policy: "Our acquiring license lets us collect and settle funds related to card payments".                                                                                        |
| `card_processing`               | yes                    | Card authorisation, capture, void, refund, incremental and final capture via the Transactions API; Ecom, MOTO and in-store entry types.                                                                                                                                                                                                                                            |
| `orchestration`                 | yes                    | "Route transactions intelligently across multiple acquirers" and "network of 30+ acquiring partners" (orchestration and card-acquiring pages). `providerResponse.provider` shows non-PXP acquirers.                                                                                                                                                                                |
| `alternative_payment_method`    | yes                    | PayPal, Pay Later, Venmo, Aeropay (pay by bank, US), SPEI (MX), CVU (AR), Bre-B (CO), FlashFlow (TH) processed through PXP's own API and webhooks.                                                                                                                                                                                                                                 |
| `payment_facilitator`           | not assigned (unclear) | Terms page lists "Aggregation, Gateway, Acquiring" and "Tripartite Merchant Services: These Terms & Conditions are relevant for the Sponsored Merchants". That hints at an aggregation model, but no developer documentation describes sub-merchant onboarding, so it is not assigned. The high-risk page lists payment facilitators as **partners**, which does not make PXP one. |
| `wallet`                        | no                     | PXP decrypts Apple Pay / Google Pay tokens and processes PayPal; no stored-value wallet of its own is documented.                                                                                                                                                                                                                                                                  |
| `merchant_account_intermediary` | no                     | The high-risk partner programme recruits referring partners; PXP itself is the acquirer, not an intermediary.                                                                                                                                                                                                                                                                      |

### Sectors (only as documented by PXP)

| Sector (PXP wording)                                                                                                      | Source                                                            | Quote / paraphrase                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Betting and gaming                                                                                                        | https://www.pxp.io/gaming                                         | "The complete payments setup for betting and gaming operators in one integration." "One platform for gaming deposits, payouts, fraud and reporting."                                        |
| UK regulated gambling (MCC 7995)                                                                                          | https://www.pxp.io/a-level-playing-field-for-uk-gambling-payments | Working group on "UK gambling payments"; "Regulated gambling in the UK is among the most tightly controlled merchant categories"                                                            |
| Retail                                                                                                                    | https://www.pxp.io/retail                                         | "Design the perfect retail experience"                                                                                                                                                      |
| Hospitality                                                                                                               | https://www.pxp.io/hospitality                                    | "Enhance guest experience in hotels, restaurants, bars and spas"                                                                                                                            |
| Travel                                                                                                                    | https://www.pxp.io/travel                                         | "Facilitate seamless payments for travelers"                                                                                                                                                |
| Cruise                                                                                                                    | https://www.pxp.io/cruise                                         | "cruise, river cruise and ferry customers"                                                                                                                                                  |
| Gaming platforms; Content creator platforms; Payment facilitators; Forex & Crypto; CBD and Nutraceutics; Direct marketing | https://www.pxp.io/high-risk-partners                             | Listed under "Who partners with PXP?" on a page about "high-risk and non-traditional verticals"; the page also says "High-risk merchant accounts supported by a specialized MCC processor." |

Notes:

- The high-risk list describes the kinds of businesses PXP's partner programme serves. It is not a per-merchant acceptance statement.
- "Adult" is **not** documented by PXP. Subscription businesses are not named as a sector (recurring payments are a technical feature only).
- Eligibility depends on jurisdiction, licensing and underwriting. Approval for one sector does not imply another. The 3DS states page notes that issuers may reject "Gambling merchants for cards with gambling blocks".

---

## 4. API families and versions in scope

| Family                                                          | Endpoint (production; sandbox is `api-services.test.pxp.io`)                                                                                                                                                                                                                                              | Format                    | Relevance                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| **Transactions service v1**                                     | `POST /api/v1/transactions` (initiate), `POST /api/v1/transactions/{systemTransactionId}/modifications` (capture, final capture, refund, incremental, void), `GET /api/v1/transactions/{merchant}/{site}` (lookup), `GET .../order-details`, `POST /api/v1/transaction-contexts` (CVU/Bre-B provisioning) | JSON request and response | **Primary**: synchronous outcomes with `state` and `stateData`          |
| **Merchant webhooks v1**                                        | POST from PXP to the merchant URL (sent from domain `out.pxp.io`); documented as `/v1/merchant-webhooks` in the API reference                                                                                                                                                                             | JSON                      | **Primary**: authoritative outcome for pay-by-bank deposits and payouts |
| 3DS authentication service                                      | standalone and integrated authentication                                                                                                                                                                                                                                                                  | JSON                      | Secondary (Challenge completed webhook, authentication states)          |
| Sessions, Links                                                 | `/sessions`, `/links`                                                                                                                                                                                                                                                                                     | JSON                      | Secondary (error envelope only)                                         |
| Token Vault, BIN lookup, DCC, Risk screening, Wallet decryption | various                                                                                                                                                                                                                                                                                                   | JSON                      | Out of scope initially                                                  |
| POS+, Tap+, cloud device transactions                           | various                                                                                                                                                                                                                                                                                                   | JSON / status packets     | Out of scope (in-store)                                                 |
| Checkout SDK (components, drop-in)                              | browser/mobile                                                                                                                                                                                                                                                                                            | `SDKxxxx` client errors   | Low (client-side)                                                       |

**Implement first:** Transactions service responses (initiate and modification) and the merchant webhook envelope, card and pay-by-bank events. Then 3DS authentication events and the API error envelope.

Versioning: the OpenAPI files carry `version: 1.0.0`; the URL carries `/v1`. The transactions release-notes page is empty ("Coming soon."). No change log for payload fields is published.

Auth (for context, never processed by PandaPayLens): every request is HMAC-SHA256 signed; header `Authorization: PXP-UST1 {tokenId}:{timestamp}:{hmac}` plus `X-Request-Id` and `X-Client-Id` (quickstart).

---

## 5. Response and error formats

### 5.1 Content type

- All APIs: "The PXP API is a REST API that ... returns standard HTTP status codes, communicates using JSON" (api-overview). Request and response media type is `application/json`.
- Webhooks: JSON body (`application/json` in merchant-webhook.yaml). Signature material is in HTTP headers, not in the body.

### 5.2 HTTP status codes (api-overview)

| HTTP  | PXP label                    | Meaning (paraphrase)                                                                                     | Suggested category   | Suggested retry     |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------- | ------------------- |
| `200` | Successfully Processed       | Processed; outcome is in `state`                                                                         | n/a                  | n/a                 |
| `400` | Request Interpretation Error | Bad syntax; fix before retrying                                                                          | invalid_request      | do_not_retry        |
| `401` | Authentication Needed        | Missing/invalid credentials                                                                              | configuration        | do_not_retry        |
| `403` | Access Denied                | Insufficient permissions; PXP says not to repeat                                                         | configuration        | do_not_retry        |
| `404` | Resource Unavailable         | Not found, often a wrong URL; may be retried                                                             | invalid_request      | retry_conditionally |
| `413` | Excessive Request Size       | Body over 10 MB                                                                                          | invalid_request      | do_not_retry        |
| `422` | Semantic Request Error       | Readable but semantically invalid                                                                        | invalid_request      | do_not_retry        |
| `500` | Processing Failure           | Unexpected server issue; PXP notes it can also come from bad formatting such as missing mandatory fields | provider_unavailable | retry_conditionally |

Important: a card decline is **not** an HTTP error. Declines and processing errors come back as HTTP `200` with `state: Refused` or `state: Error` and a `stateData` code.

### 5.3 Transaction response fields (card)

| Field                                                                                                                      | Type              | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`                                                                                                                    | string enum       | Transaction state (see section 7)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `stateData.code`                                                                                                           | string            | Normalized outcome code (`CRDnnn`, `APMnnn`, `APM41nn`, `VAN0001`); often `{}` (empty object) on successful modifications                                                                                                                                                                                                                                                                                                         |
| `stateData.message`                                                                                                        | string            | Text paired with the code                                                                                                                                                                                                                                                                                                                                                                                                         |
| `approvalCode`                                                                                                             | string            | Authorisation code from the authorising entity                                                                                                                                                                                                                                                                                                                                                                                    |
| `merchantTransactionId`                                                                                                    | string, max 50    | Merchant reference; idempotency key                                                                                                                                                                                                                                                                                                                                                                                               |
| `merchantTransactionDate`                                                                                                  | date-time         | Merchant-supplied timestamp                                                                                                                                                                                                                                                                                                                                                                                                       |
| `systemTransactionId`                                                                                                      | UUID string       | PXP transaction ID                                                                                                                                                                                                                                                                                                                                                                                                                |
| `providerTransactionId`                                                                                                    | string or null    | ID from the downstream provider (PayPal, SPEI, FlashFlow, Aeropay)                                                                                                                                                                                                                                                                                                                                                                |
| `merchantOrderId`                                                                                                          | string, max 50    | Optional order reference linking several transactions                                                                                                                                                                                                                                                                                                                                                                             |
| `transactionMethod.{intent, fundingType, entryType}`                                                                       | strings           | See section 7                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `amounts.{transaction, currencyCode, gratuity}`                                                                            | number / ISO 4217 | Amount in major units                                                                                                                                                                                                                                                                                                                                                                                                             |
| `fundingData.cardScheme`, `maskedPrimaryAccountNumber`, `expiryMonth`, `expiryYear`, `gatewayTokenId`, `schemeTokenNumber` | strings           | Card data (see Sensitive fields)                                                                                                                                                                                                                                                                                                                                                                                                  |
| `fundingData.cardVerificationCodeResult`, `addressVerificationServiceResult`, `nameVerificationResult`                     | enum              | PXP-normalized verification results (`NoInformationAvailable`, `CardSecurityCodeMatched`, `CardSecurityCodeNotMatched`, `CardSecurityCodeNotChecked`)                                                                                                                                                                                                                                                                             |
| `fundingData.providerResponse`                                                                                             | object            | **Raw** downstream data: `provider`, `code`, `message`, `merchantId`, `terminalId`, `cardVerificationCodeResult` (raw), `addressVerificationServiceResult` (raw), `paymentAccountReference`, `retrievalReferenceNumber`, `schemeTransactionId`, `schemeTransactionLinkId`, `electronicCommerceIndicatorAdjustment`, `merchantAdvice{code,message}`, `settlementDate`, `authorisedAmount`, `issuerResponseCode`, `emvDataResponse` |
| `fundingData.processorTransactionId`                                                                                       | UUID string       | Appears in card examples; meaning **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                              |
| `dccData`                                                                                                                  | object            | DCC result (in-store)                                                                                                                                                                                                                                                                                                                                                                                                             |

Two layers of codes matter for diagnosis: the PXP-normalized `stateData.code` and the acquirer's raw `providerResponse.code` (for example `"05"`, `"91"`, `"30"`, or Elavon's `"A"`). PXP documents only the normalized layer.

### 5.4 API error envelope

Used for HTTP 4xx/5xx on all services:

```json
{
  "correlationId": "81f32b80-2ba0-4430-8ecd-0b559274ba9c",
  "details": [],
  "errorCode": "CAR0003",
  "errorReason": "Invalid Card Details Provided"
}
```

Transcribed from https://developer.pxp.io/_bundle/apis/transaction.yaml (the `400` response example of `POST /transactions`). `correlationId`, `errorCode` and `errorReason` are required in the webhook OpenAPI `error` schema. `details` is an array of strings in the Links examples (for example `"'amounts' - The amounts field is required."`).

### 5.5 Examples

Example A: refused card authorisation, synchronous. Transcribed from https://developer.pxp.io/_bundle/apis/transaction.yaml (example "Ecom - Card refused"):

```json
{
  "state": "Refused",
  "stateData": { "code": "CRD100", "message": "Do not honour" },
  "merchantTransactionId": "This_is_my_merchant_transaction_id",
  "systemTransactionId": "1ed768bb-e88a-4636-91ae-67927ccbb02b",
  "merchantTransactionDate": "2024-01-27T08:51:02.826Z",
  "fundingData": {
    "cardScheme": "Visa",
    "primaryAccountNumber": "************1111",
    "expiryMonth": "12",
    "expiryYear": "2026",
    "gatewayTokenId": "1ed768bb-e88a-4636-91ae-67927ccbb02b",
    "schemeTokenNumber": "4837261112345678",
    "providerResponse": {
      "provider": "PXPFinancial",
      "code": "05",
      "message": "Do not honour",
      "merchantId": "77772182",
      "terminalId": "75836665",
      "retrievalReferenceNumber": "613808317649",
      "merchantAdvice": { "code": "01", "message": "New account information available" }
    }
  }
}
```

Example B: refused card transaction webhook from a third-party acquirer. Transcribed from https://developer.pxp.io/_bundle/apis/merchant-webhook.yaml (example "Transaction refused (card)"; key order as in the source):

```json
{
  "eventCategory": "transaction",
  "eventData": {
    "amounts": { "currencyCode": "GBP", "transaction": 40 },
    "eventCode": "TXN_RFU",
    "fundingData": {
      "card": {
        "cardScheme": "JCB",
        "gatewayTokenId": "821e3173-5c21-4a39-8495-627dcdfc12e8",
        "nameVerificationResult": null,
        "providerResponse": {
          "addressVerificationServiceResult": "",
          "authorisedAmount": 0,
          "cardVerificationCodeResult": "",
          "code": "30",
          "issuerResponseCode": "",
          "merchantAdvice": {},
          "merchantId": "000100800004485",
          "message": "Format error.",
          "provider": "lloydscardnet",
          "settlementDate": "2026-06-26T00:00:00.000Z",
          "terminalId": "30121285"
        }
      }
    },
    "merchant": "Unity",
    "merchantTransactionDate": "2026-06-26T11:14:02.123445+00:00",
    "merchantTransactionId": "283996_11",
    "providerTransactionId": null,
    "site": "UnityLLD",
    "state": "Refused",
    "stateData": { "code": "CRD182", "message": "Bad format" },
    "systemTransactionId": "2eb35ccd-fa18-4fe9-adb6-33f395851482",
    "transactionMethod": { "entryType": "Instore", "fundingType": "Card", "intent": "Purchase" }
  },
  "eventDate": "2026-06-26T10:34:43.2760930Z",
  "eventOwner": { "merchant": "Unity", "merchantGroup": "UnityGroup", "site": "UnityLLD" }
}
```

Example C: SPEI payout and SPEI refund responses are in https://developer.pxp.io/guides/transactions/refund.md and spei-transaction.md; a full Bre-B deposit webhook envelope is in https://developer.pxp.io/guides/transactions/e-commerce/bre-b-transaction.md (section "Webhooks").

---

## 6. Codes

Codes are exactly as documented. Meanings are short original paraphrases. **Category and retry columns are suggestions for PandaPayLens, not PXP statements.** PXP gives no retry advice per code except where noted. Adapters must treat unknown codes as `unknown`.

### 6.1 Normalized card codes (`stateData.code`): 44 codes + `VAN0001`

Source: https://developer.pxp.io/guides/transactions/how-it-works.md ("Card response codes") and the `stateDataCode` enum in transaction.yaml. PXP labels them "ISO 8535"; the codes themselves are PXP-specific identifiers. Use `state` too: the same code can arrive with `Refused` or `Error` (examples show `CRD102` and `CRD109` with `state: Error`).

| Code      | Meaning (paraphrase)                                                                            | Category                            | Retry                    |
| --------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------ |
| `CRD000`  | Approved                                                                                        | n/a (success)                       | n/a                      |
| `CRD001`  | Approved subject to identification                                                              | n/a (success)                       | n/a                      |
| `CRD002`  | Approved for a partial amount                                                                   | n/a (partial success; check amount) | manual_review            |
| `CRD003`  | Approved (VIP)                                                                                  | n/a (success)                       | n/a                      |
| `CRD004`  | Approved, track 3 to be updated                                                                 | n/a (success)                       | n/a                      |
| `CRD005`  | Approved, issuer specified account type                                                         | n/a (success)                       | n/a                      |
| `CRD006`  | Partial approval, issuer specified account type                                                 | n/a (partial success)               | manual_review            |
| `CRD007`  | Approved, chip data to be updated                                                               | n/a (success)                       | n/a                      |
| `CRD100`  | Issuer declined without a reason (do not honour)                                                | card_declined                       | customer_action_required |
| `CRD101`  | Card expired                                                                                    | card_declined                       | customer_action_required |
| `CRD102`  | Issuer or risk suspects fraud                                                                   | fraud_or_risk                       | do_not_retry             |
| `CRD103`  | Merchant should contact the acquirer                                                            | configuration                       | manual_review            |
| `CRD104`  | Card is restricted                                                                              | card_declined                       | do_not_retry             |
| `CRD105`  | Merchant should call the acquirer's security team                                               | fraud_or_risk                       | manual_review            |
| `CRD106`  | Too many PIN attempts                                                                           | authentication_failed               | do_not_retry             |
| `CRD107`  | Refer to the issuer                                                                             | card_declined                       | customer_action_required |
| `CRD108`  | Refer to the issuer, special conditions                                                         | card_declined                       | customer_action_required |
| `CRD109`  | Merchant not valid for this transaction                                                         | configuration                       | do_not_retry             |
| `CRD110`  | Amount not valid                                                                                | invalid_amount                      | do_not_retry             |
| `CRD111`  | Card number not valid                                                                           | invalid_request                     | customer_action_required |
| `CRD112`  | PIN required                                                                                    | authentication_required             | customer_action_required |
| `CRD113`  | Fee not acceptable                                                                              | invalid_amount                      | do_not_retry             |
| `CRD114`  | Requested account type does not exist on the card                                               | card_declined                       | customer_action_required |
| `CRD115`  | Function not supported                                                                          | payment_method_unavailable          | do_not_retry             |
| `CRD116`  | Insufficient funds                                                                              | insufficient_funds                  | customer_action_required |
| `CRD117`  | Wrong PIN                                                                                       | authentication_failed               | customer_action_required |
| `CRD118`  | Card record not found                                                                           | card_declined                       | do_not_retry             |
| `CRD119`  | Not allowed for this cardholder                                                                 | card_declined                       | do_not_retry             |
| `CRD120`  | Not allowed for this terminal/merchant                                                          | configuration                       | do_not_retry             |
| `CRD121`  | Amount limit exceeded                                                                           | card_declined                       | customer_action_required |
| `CRD122`  | Security violation                                                                              | fraud_or_risk                       | do_not_retry             |
| `CRD123`  | Frequency limit exceeded                                                                        | card_declined                       | retry_conditionally      |
| `CRD124`  | Legal or regulatory violation                                                                   | card_declined                       | do_not_retry             |
| `CRD125`  | Card not yet effective                                                                          | card_declined                       | customer_action_required |
| `CRD126`  | PIN block not valid                                                                             | configuration                       | manual_review            |
| `CRD127`  | PIN length wrong                                                                                | authentication_failed               | customer_action_required |
| `CRD128`  | PIN key synchronization error                                                                   | configuration                       | manual_review            |
| `CRD129`  | Card suspected counterfeit                                                                      | fraud_or_risk                       | do_not_retry             |
| `CRD180`  | Retry with chip/contact, or strong customer authentication needed for e-commerce (soft decline) | authentication_required             | customer_action_required |
| `CRD181`  | Card to be picked up (lost/stolen)                                                              | fraud_or_risk                       | do_not_retry             |
| `CRD182`  | Message format error                                                                            | invalid_request                     | do_not_retry             |
| `CRD183`  | Timeout or malfunction downstream                                                               | network_or_timeout                  | retry_conditionally      |
| `CRD184`  | Card restricted                                                                                 | card_declined                       | do_not_retry             |
| `CRD185`  | Refused by fraud or scoring rules                                                               | fraud_or_risk                       | manual_review            |
| `VAN0001` | General execution error (only in the webhook OpenAPI enum and one in-store example)             | unknown                             | manual_review            |

`retry_conditionally` for `CRD183`: the outcome may be unknown. PXP documents idempotency on `merchantTransactionId` ("PXP will recognise the `merchantTransactionId` and only process one of your requests"), so a resend with the same ID or a lookup is safer than a new ID.

### 6.2 Pay-by-bank APM state codes: 8 seen in examples

Sources: about-webhooks examples, bre-b-transaction.md, transaction.yaml. **No table defines these codes**; meanings come from the paired `message`. The transaction.yaml `stateDataCode` enum lists only `APM001`, `APM004`, `APM007`, `APM011`, `APM012`, `APM013`; `APM002` and `APM003` appear only in examples.

| Code     | Paired message                     | Seen with                                                        | Category                                                          | Retry                    |
| -------- | ---------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `APM001` | Payment executed                   | SPEI, CVU, FlashFlow `Authorised`                                | n/a (success)                                                     | n/a                      |
| `APM002` | Invalid request                    | CVU/Bre-B transaction-context response with `status: Error`      | invalid_request                                                   | do_not_retry             |
| `APM003` | Payment authorised                 | Bre-B `Authorised`                                               | n/a (success)                                                     | n/a                      |
| `APM004` | Payment declined / Payment refused | SPEI `Aborted`, CVU/Bre-B/FlashFlow `Refused`, Bre-B cross-entry | card_declined (generic decline; no bank-specific category exists) | manual_review            |
| `APM007` | Payment refunded                   | refund confirmations                                             | n/a (refund success)                                              | n/a                      |
| `APM011` | Payment expired                    | `Expired`                                                        | unknown                                                           | customer_action_required |
| `APM012` | Payment failed                     | `Refused`                                                        | unknown                                                           | manual_review            |
| `APM013` | Payment rejected                   | payout `Rejected`                                                | unknown                                                           | manual_review            |

Raw pay-by-bank provider values inside `providerResponse`: `providerResponseCode` is `EXECUTED`, `DECLINED`, `EXPIRED`, `FAILED`, `REFUNDED`, `REJECTED`, `CROSS_ENTRY` (SPEI/CVU/Bre-B) or lowercase `completed`, `expired`, `rejected` (FlashFlow). Aeropay uses `providerTransactionStatus` `live` / `pending` and `achStatus` `Approved`.

### 6.3 APM error codes (PayPal and similar): 7 codes

Source: how-it-works.md ("PXP maps provider errors to the following APM response codes").

| Code      | Meaning (paraphrase)                                            | Category             | Retry               |
| --------- | --------------------------------------------------------------- | -------------------- | ------------------- |
| `APM4100` | Internal server error                                           | provider_unavailable | retry_conditionally |
| `APM4101` | Conflict detected                                               | duplicate_request    | do_not_retry        |
| `APM4102` | Authentication with the provider failed (header or credentials) | configuration        | do_not_retry        |
| `APM4103` | Malformed or schema-invalid request                             | invalid_request      | do_not_retry        |
| `APM4104` | Not permitted                                                   | configuration        | do_not_retry        |
| `APM4105` | Business validation failed                                      | invalid_request      | manual_review       |
| `APM4106` | Resource not found                                              | invalid_request      | do_not_retry        |

### 6.4 API `errorCode` values: 12 (examples only)

PXP does **not** publish a list of `errorCode` values. These are all values seen in the read OpenAPI files.

| Code                | HTTP (as shown)             | Meaning (paraphrase)                                                    | Category             | Retry                    |
| ------------------- | --------------------------- | ----------------------------------------------------------------------- | -------------------- | ------------------------ |
| `CAR0003`           | 400                         | Card details invalid                                                    | invalid_request      | customer_action_required |
| `CAR0004`           | 401                         | Authentication failed for a card transaction                            | configuration        | do_not_retry             |
| `CAR0005`           | 403                         | Transaction not permitted                                               | configuration        | do_not_retry             |
| `CAR0006`           | 404                         | Card transaction details not found                                      | invalid_request      | do_not_retry             |
| `CAR0010`           | 422                         | Transaction data format invalid                                         | invalid_request      | do_not_retry             |
| `TOK0004`           | 413                         | Token request payload too large                                         | invalid_request      | do_not_retry             |
| `GEN0008`           | 500                         | Unexpected internal error                                               | provider_unavailable | retry_conditionally      |
| `SES4001`           | 404                         | Session not found (Sessions API)                                        | invalid_request      | do_not_retry             |
| `SES4006`           | 404 (as placed in the file) | Session cannot be changed because the transaction is already authorised | duplicate_request    | do_not_retry             |
| `INVALID_REQUEST`   | 400                         | Validation errors; see `details` (Links API)                            | invalid_request      | do_not_retry             |
| `NOT_AUTHENTICATED` | 401                         | Authorization data missing (Links API)                                  | configuration        | do_not_retry             |
| `OBJECT_NOT_FOUND`  | 404                         | Site (or other object) not found (Links API)                            | configuration        | do_not_retry             |

Prefix pattern (observation, not documented): `CAR` card, `TOK` token, `GEN` general, `SES` session.

### 6.5 3DS codes

Source: https://developer.pxp.io/guides/3ds/states.md and merchant-webhook.yaml.

- `authenticationState` (6): `PendingClientData`, `AuthenticationSuccessful`, `AuthenticationFailed` (retry possible; do not authorise with 3DS data), `AuthenticationRejected` (PXP: do not retry, cannot proceed), `AuthenticationError`, `PendingCustomerChallenge`. Suggested categories: Failed -> authentication_failed / customer_action_required; Rejected -> authentication_failed / do_not_retry; Error -> provider_unavailable / retry_conditionally (PXP: "Retry once").
- `transactionStatus` (EMV `transStatus`, 8): `Y`, `N`, `U`, `A`, `C`, `D`, `R`, `I` with the EMVCo meanings (success, not authenticated, unable, attempted, challenge, decoupled, rejected, informational).
- `transactionStatusReason` (30): `01`-`30`, EMVCo reason values (for example `01` card authentication failed, `11` suspected fraud, `14` timed out at ACS, `19` too many ACS challenges, `22` ACS technical issue). Paraphrase from the source table when implementing.
- 3DS error codes under `AuthenticationError` (11): format `101`, `102`, `201`, `203`; system `301`-`305`; timeout `402`, `403`. Suggested: format -> invalid_request / do_not_retry; system `303` (merchant not enrolled) -> configuration; others -> provider_unavailable / retry_conditionally; timeouts -> network_or_timeout / retry_conditionally.
- `challengeCancel` (10): `01`-`10` (cardholder cancel, timeouts, errors, unknown) per merchant-webhook.yaml.

### 6.6 Client SDK codes (`SDKxxxx`): 42 on the components errors page

Source: https://developer.pxp.io/guides/checkout/components/errors.md. Ranges: `SDK0000`-`SDK0001` common; `SDK0100`-`SDK0107` SDK configuration; `SDK0200`-`SDK0201` component; `SDK0304` token vault; `SDK0400`-`SDK0421` 3DS input validation; `SDK0500`-`SDK0506` transaction (network error, validation, pre-initiate failed, authentication rejected/failed, SCA exemption required or invalid). Other SDK pages mention further codes up to `SDK1200` that were not read in full. These are browser/mobile console errors, not provider payloads. Suggested: configuration and validation codes -> configuration or invalid_request / do_not_retry; `SDK0500` -> network_or_timeout / retry_conditionally; `SDK0503`-`SDK0506` -> authentication_failed or authentication_required / customer_action_required. Out of scope for the first adapter version.

### 6.7 Other value sets useful for decoding

- `providerResponse.electronicCommerceIndicatorAdjustment`: `01`, `02`, `05`, `06`, `07` with PXP's descriptions (security level after scheme adjustment).
- `providerResponse.merchantAdvice{code,message}`: card network advice; examples `01` "New account information available", `02` "Try again later". No full list is published by PXP.
- PXP verification results: `NoInformationAvailable`, `CardSecurityCodeMatched`, `CardSecurityCodeNotMatched`, `CardSecurityCodeNotChecked`.

### 6.8 Count summary

| Set                                                                               | Count                |
| --------------------------------------------------------------------------------- | -------------------- |
| Normalized card codes `CRD*`                                                      | 44                   |
| `VAN0001`                                                                         | 1                    |
| Pay-by-bank APM state codes                                                       | 8 (6 in enum)        |
| APM error codes `APM41xx`                                                         | 7                    |
| API `errorCode` examples                                                          | 12                   |
| HTTP statuses                                                                     | 8                    |
| 3DS authentication states / transStatus / reasons / error codes / challengeCancel | 6 / 8 / 30 / 11 / 10 |
| Client SDK codes (errors page)                                                    | 42                   |

---

## 7. Lifecycle

### 7.1 Transaction method

- `intent`: `Authorisation`, `EstimatedAuthorisation`, `Purchase` (auth plus immediate capture), `Payout`, `Refund`, `Verification` (initiation); webhook enum adds `Capture`, `Create`, `Void`. Webhooks for modifications carry the modification as `intent` (`Capture`, `Void`, `Refund`).
- `fundingType`: `Card`, `Paypal`, `PayByBank` (webhook enum); lookup also accepts `Cage`; FlashFlow webhooks send `PayByBanks` (plural, documented).
- `entryType`: `Ecom`, `Moto`, `Instore`.

### 7.2 States

| Source                        | Values                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| how-it-works guide            | `Authorised`, `Captured`, `Cancelled`, `Error`, `Refused`                     |
| merchant-webhook.yaml `state` | adds `Executed`, `Pending`, `Refunded`, `Aborted`, `Expired`, `Rejected` (11) |
| transaction.yaml `state`      | adds `Confirmed`, `Updated`, `Approved` (14)                                  |
| FlashFlow guide only          | `PendingOnProvider` (in no enum)                                              |

### 7.3 Card flow

1. Initiate with `intent` `Authorisation` -> `Authorised` / `Refused` / `Error`. `Purchase` -> captured in one step.
2. Modifications on the **original** `systemTransactionId` (path): `Capture` -> `Captured`; `FinalCapture` -> `Captured` and any remainder reversed; `Incremental` -> `Authorised` with higher `authorisedAmount`; `Void` (before capture) -> `Cancelled`; `Refund` (after purchase) -> see below. Each modification response returns a **new** `systemTransactionId`.
3. Refund: partial refunds supported up to the original amount. The documented card refund response shows `state: Authorised` and says a "Transaction (Authorised)" webhook follows; the webhook table lists `transaction-refunded` for cards but gives no card example (see Limitations).
4. Card payout: `Payout` is an allowed card `intent`, but no card payout response or webhook example is documented.
5. Verification: `intent: Verification` (zero-value check); response example **NOT DOCUMENTED** in the pages read.

### 7.4 Recurring (card)

Processing models (`recurring.processingModel`): `cardOnFileShopperConsent`, `cardOnFileShopperInitiated`, `merchantInitiatedReAuthorisation`, `merchantInitiatedResubmission`, `merchantInitiatedDelayedCharge`, `merchantInitiatedNoShow`, `merchantInitiatedInitialRecurring`, `merchantInitiatedSubsequentRecurring`, `merchantInitiatedUnscheduled`. Subsequent MITs link to the initial transaction via `recurring.schemeTransactionId`, `recurring.schemeTransactionLinkId` (Mastercard TLID from 1 June 2026) and `recurring.settlementDate` (Mastercard), plus the stored `gatewayTokenId`. No subscription object or rebill schedule exists on PXP's side; there are no subscription states.

### 7.5 PayPal, Pay Later, Venmo

`Create` -> webhook `transaction-created` (`state: Pending`) -> buyer approval -> `transaction-executed` (`Executed`) -> `transaction-authorised` (`Authorised`) -> `transaction-captured` (`Captured`); `transaction-cancelled` (`Cancelled`, intent `Void`); `transaction-refunded` (`Refunded`). PayPal payouts: `payout-authorised` (`Authorised`, `transactionMethod` as the string `"Payout"`, singular `amount` object).

### 7.6 Pay by bank: deposits and payouts

| Method             | Deposit (pay-in)                                                                                                                                         | Payout (withdrawal)                                                                                                                  | Refund                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| SPEI (MXN)         | `Purchase` -> `Pending` + `redirectUrl` -> webhook `executed` (`Authorised`) / `declined` (`Aborted`) / `expired` / `failed` (`Refused`)                 | `Payout` -> `Pending` -> `executed` (`Authorised`) / `declined` (`Refused`) / `rejected` (`Rejected`) / `expired` / `failed`         | Full only via modifications -> `Pending` -> `spei-transaction-order-refunded` (`Refunded`) |
| CVU (ARS, AR only) | No create call: provision a CVU via `/transaction-contexts`; first notice is webhook `cvu-transaction-order-executed` with `merchantTransactionId: null` | `Payout` -> `Pending` -> `executed` / `declined` / `failed` (`Refused`) / `rejected` / `expired`                                     | Full only -> `cvu-transaction-order-refunded`                                              |
| Bre-B (COP)        | No create call: provision a Bre-B Llave; first notice `breb-transaction-order-executed` (`merchantTransactionId: null`)                                  | `Payout` -> `Pending` -> `executed` / `declined` / `failed` / `cross-entry` (all `Refused` except executed) / `rejected` / `expired` | Full only -> `breb-transaction-order-refunded`                                             |
| FlashFlow (THB)    | `Purchase` -> `PendingOnProvider` + `iframeSrc` -> `flashflow-transaction-executed` (`Authorised`) / `expired`                                           | `Payout` -> `Pending` -> `executed` / `refused` (`Refused`)                                                                          | **NOT DOCUMENTED**                                                                         |
| Aeropay (USD)      | `Purchase`/`Authorisation` -> `TXNAP_AUTH` (`Authorised`), `TXNAP_CPT` (`Captured`), `TXNAP_CNC` (`Cancelled`)                                           | **NOT DOCUMENTED**                                                                                                                   | `TXNAP_RFD` (`Refunded`, provider status may still be `pending`)                           |

PXP repeatedly states that for SPEI, CVU, Bre-B and FlashFlow the **webhook is the authoritative outcome**, not the initiation response. Purchase and payout share event codes; `transactionMethod.intent` tells them apart.

### 7.7 3DS

`PendingClientData` -> `PendingCustomerChallenge` -> `AuthenticationSuccessful` / `AuthenticationFailed` / `AuthenticationRejected` / `AuthenticationError`; frictionless flows skip the challenge. Webhook `challenge-completed` reports the result.

### 7.8 Scheme tokens

`scheme-token-created` / `scheme-token-creation-error` / `scheme-token-card-updated` / `scheme-token-disabled` with token `state` `Completed` or `Error` (enum also lists `SchemeTokenCardUpdated`, `SchemeTokenCreated`, `SchemeTokenDisabled`, `SchemeTokenUpdated`).

### 7.9 Chargebacks and settlement

Chargebacks and disputes: **NOT DOCUMENTED** as API objects or webhook events. The `eventCategory` description mentions "chargebacks, disputes" but the enum has only `authentication`, `reporting`, `token`, `transaction`. Settlement appears only as `providerResponse.settlementDate` (Mastercard) and via reporting; no settlement event.

---

## 8. Notifications (webhooks)

### 8.1 Delivery

- Transport: HTTPS `POST` with a JSON body to the merchant URL configured in the Unity Portal (merchant group default, merchant override, or per service with optional event-type checkboxes). Sender domain `out.pxp.io`; PXP does not publish IP lists.
- Acknowledgement: `merchantWebhookResponse` is `{"state": "Success"}` (manage-webhooks). Which HTTP statuses count as success for real deliveries is **NOT DOCUMENTED** (the connectivity test treats `200`-`403` and `500`-`501` as "reachable").
- Retries: "up to another 10 times in the 10 seconds following the initial delivery attempt" (api-overview, about-webhooks). Test request timeout is 10 seconds.
- Ordering: **NOT DOCUMENTED**. Retries within seconds mean near-simultaneous duplicates are likely.

### 8.2 Envelope

```json
{
  "eventCategory": "string",
  "eventDate": "date-time",
  "eventData": {},
  "eventOwner": {
    "partner": "string",
    "merchantGroup": "string",
    "merchant": "string",
    "site": "string"
  }
}
```

Required: `eventDate`, `eventCategory`, `eventData`. `eventCategory` enum: `authentication`, `reporting`, `token`, `transaction` (lowercase in the OpenAPI and examples; capitalized in the guide table; test event uses `test-connection`). `eventOwner.partner` is in the schema only. `eventData` is a `oneOf` of 11 shapes: `authenticationData`, `transactionData`, `aeropayTransactionData`, `speiTransactionData`, `cvuTransactionData`, `brebTransactionData`, `flashflowTransactionData`, `tokenData`, `reportingData`, `userInfoData`, `aeropayUserStatusData`.

There is **no top-level event-type field and no event/delivery ID**. The event type lives in `eventData.eventCode` when present.

### 8.3 Event types (about-webhooks): 38

| Event name                                                                                                                | Category       | `eventCode` in examples                            | `state`                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `challenge-completed`                                                                                                     | authentication | none                                               | (authenticationState)                                                                   |
| `transaction-authorised`                                                                                                  | transaction    | none (card, PayPal family); `TXNAP_AUTH` (Aeropay) | `Authorised`                                                                            |
| `transaction-cancelled`                                                                                                   | transaction    | none; `TXNAP_CNC`                                  | `Cancelled`                                                                             |
| `transaction-captured`                                                                                                    | transaction    | none; `TXNAP_CPT`                                  | `Captured`                                                                              |
| `transaction-created`                                                                                                     | transaction    | none                                               | `Pending`                                                                               |
| `transaction-executed`                                                                                                    | transaction    | none                                               | `Executed`                                                                              |
| `transaction-refunded`                                                                                                    | transaction    | none; `TXNAP_RFD`                                  | `Refunded`                                                                              |
| `spei-transaction-order-executed` / `-declined` / `-expired` / `-failed` / `-refunded` / `-rejected` (6)                  | transaction    | same as event name                                 | `Authorised` / `Aborted` or `Refused` / `Expired` / `Refused` / `Refunded` / `Rejected` |
| `cvu-transaction-order-executed` / `-declined` / `-expired` / `-failed` / `-refunded` / `-rejected` (6)                   | transaction    | same as event name                                 | `Authorised` / `Refused` / `Expired` / `Refused` / `Refunded` / `Rejected`              |
| `breb-transaction-order-executed` / `-declined` / `-expired` / `-failed` / `-refunded` / `-rejected` / `-cross-entry` (7) | transaction    | same as event name                                 | `Authorised` / `Refused` / `Expired` / `Refused` / `Refunded` / `Rejected` / `Refused`  |
| `flashflow-transaction-executed` / `-expired` / `-refused` (3)                                                            | transaction    | same as event name                                 | `Authorised` / `Expired` / `Refused`                                                    |
| `payout-authorised`                                                                                                       | transaction    | none                                               | `Authorised`                                                                            |
| `user-info-created`                                                                                                       | transaction    | `TXNPP_UIC`                                        | n/a                                                                                     |
| `user-suspended`                                                                                                          | transaction    | `TXNAP_USP`                                        | n/a                                                                                     |
| `user-activated`                                                                                                          | transaction    | `TXNAP_UAC`                                        | n/a                                                                                     |
| `scheduled-report-generated`                                                                                              | reporting      | none (`eventData` is only `{url}`)                 | n/a                                                                                     |
| `scheme-token-created` / `-creation-error` / `-card-updated` / `-disabled` (4)                                            | token          | none                                               | `Completed` / `Error`                                                                   |

Additional shapes only in merchant-webhook.yaml: card refused (`eventCode: TXN_RFU`, `state: Refused`), card error (`eventCode: TXN_ERR`, `state: Error`), scheme token updated (`state: SchemeTokenUpdated`). Test event: `eventCode: TS_TC`.

Classifying an event without `eventCode`: use `eventCategory` + `eventData.state` + `transactionMethod.intent` + `fundingType` (for example `Captured` + `Capture` + `Card` -> card captured). For tokens, use `state`; the four token events are not distinguishable from the body alone (created, card updated and disabled all show `state: Completed`).

### 8.4 Fields (transaction events)

Same vocabulary as the synchronous response (section 5.3), plus: `eventCode`, `originalSystemTransactionId` (Aeropay only), `shippingAddress`, `shopperReference`, `gatewayTokenId`, `transactionUpdateDatetime` (FlashFlow), `providerResponse` at the `eventData` root for pay-by-bank and Aeropay (`provider`, `providerTransactionId`, `providerTransactionStatus`, `providerResponseCode`, `providerResponseMessage`), `fundingData.payByBank.{apmProvider, bankOwnershipDetails, achStatus, isRtp, authorisationExpiryDate, user, bank, apFee}`, `fundingData.alias` (Bre-B), `fundingData.paypal.{payeeEmailAddress, paymentSource, experienceContext, shippingSelected}`.

### 8.5 Signature (sensitive; PandaPayLens must not verify)

Headers on every webhook: `X-Request-Id`, `X-Signature-Timestamp`, `X-Signature`. PXP's recipe: concatenate request-ID header + timestamp header + raw body, UTF-8 encode, HMAC with the merchant's HMAC key, compare Base64 output with `X-Signature` (about-webhooks). The hash function for webhook HMAC is not named on that page; the webhook OpenAPI's security scheme is `PXP-UST1` "HMAC-SHA256" in an `Authorization` header, which is the request-signing scheme and conflicts with the header-based description. Signatures are not in the body, so pasted bodies usually carry no signature material; pasted headers must be redacted.

### 8.6 Duplicate identification

PXP: duplicates "will have the same values in the `eventCode` and `systemTransactionId` fields, while the `eventDate` and other fields can be different. Your server should always use the details from the latest webhook event." (manage-webhooks). Because many card and PayPal events have no `eventCode`, a practical key is (`systemTransactionId`, `eventCode` or derived event type, `state`), keeping the latest `eventDate`.

---

## 9. Identifiers

| Field                                                     | Scope                                                                              | Notes                                                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `systemTransactionId`                                     | PXP transaction, UUID (lowercase hex pattern)                                      | Each modification returns a **new** one; PXP says to always modify using "the first `systemTransactionId`" of the authorisation or purchase |
| `originalSystemTransactionId`                             | Parent link                                                                        | Only in Aeropay webhook examples (`TXNAP_CNC`, `TXNAP_CPT`, `TXNAP_RFD`); **not documented** for card or PayPal                             |
| `merchantTransactionId`                                   | Merchant reference, max 50                                                         | Idempotency key; a modification uses its own new value; may be `null` on CVU/Bre-B deposits                                                 |
| `merchantOrderId`                                         | Merchant order reference, max 50, optional                                         | "link multiple related transactions"                                                                                                        |
| `providerTransactionId`                                   | Downstream provider ID (PayPal order/capture ID, SPEI/FlashFlow/Aeropay reference) | For reconciliation only; equals `fundingData.payByBank.processorPaymentId` for SPEI when both present                                       |
| `fundingData.payByBank.paymentId`, `processorPaymentId`   | SPEI/CVU provider IDs                                                              | Reconciliation only                                                                                                                         |
| `fundingData.processorTransactionId`                      | UUID in card responses                                                             | Meaning **NOT DOCUMENTED**                                                                                                                  |
| `approvalCode`                                            | Issuer authorisation code                                                          |                                                                                                                                             |
| `providerResponse.merchantId`, `terminalId`               | Acquirer MID/TID                                                                   | Acquirer-specific; mask                                                                                                                     |
| `providerResponse.retrievalReferenceNumber`               | Acquirer RRN                                                                       | Needed with Diners NRID for MITs                                                                                                            |
| `providerResponse.schemeTransactionId`                    | Visa TID / Mastercard Banknet ref / Diners NRID                                    | Links MITs to the initial CIT                                                                                                               |
| `providerResponse.schemeTransactionLinkId`                | Mastercard TLID (22 chars)                                                         | Required for Mastercard CNP from 1 June 2026                                                                                                |
| `providerResponse.paymentAccountReference`                | PAR                                                                                | Stable across PAN changes                                                                                                                   |
| `gatewayTokenId` (also `tokenId`, `gatewayTokenIdBase32`) | PXP card or bank-account token                                                     | Links recurring payments and payouts to the same instrument                                                                                 |
| `schemeTokenId`, `externalSchemeTokenId`                  | Scheme token records                                                               | Token events                                                                                                                                |
| `authenticationId`, `directoryServerTransactionId`        | 3DS                                                                                |                                                                                                                                             |
| `correlationId`                                           | API error                                                                          | Quote this to PXP support                                                                                                                   |
| `eventOwner.merchantGroup` / `merchant` / `site`          | Merchant hierarchy                                                                 |                                                                                                                                             |

Correlation rules for an adapter: group by `systemTransactionId`; link modifications by `originalSystemTransactionId` when present, else by `merchantOrderId`, else heuristically by `gatewayTokenId` + amount + time, and flag the result as heuristic.

---

## 10. Sensitive fields

Redact or mask by default:

- **Card data**: `primaryAccountNumber` (may be full in requests and in some response examples), `cardVerificationCode`, `expiryMonth`/`expiryYear`, `holderName`, `maskedPrimaryAccountNumber`, `schemeTokenNumber` (a network token number usable like a PAN), `cardholderAuthenticationVerificationValue` and other `threeDSecureData` content, `emvDataResponse` fields (`issuerAuthenticationData`, issuer scripts).
- **Tokens and references that enable reuse**: `gatewayTokenId`, `tokenId`, `gatewayTokenIdBase32`, `schemeTokenId`, `externalSchemeTokenId`, `paymentAccountReference`.
- **Bank data**: `bankAccountNumber`, `bankCode`, `accountType`, `bankAccountHolderName`, `bankOwnershipDetails.{accountHolderFullName, accountNumber, beneficiaryAccountNumber, bankName}`, `bank.{accountId, accountLastFour}`, Bre-B `alias` / `brebKey`, CVU number and alias.
- **Personal data**: `user.{id, name, email}`, `customerInformation` (name, email, `payerId`, address), `payeeEmailAddress`, `shippingAddress`, `documentNumber`, `shopper` details, `ipAddress`, `deviceFingerprint`, `shopperReference`.
- **Secrets and auth material**: headers `X-Signature`, `X-Signature-Timestamp`, `X-Request-Id`, `Authorization` (`PXP-UST1 ...`), `X-Client-Id`; HMAC keys; Sessions `HmacKey`.
- **Session URLs**: `redirectUrl`, `iframeSrc`, Links URLs, and the `scheduled-report-generated` `url` (a report download link).
- **Merchant identifiers**: `providerResponse.merchantId`, `terminalId`, `eventOwner` values.

---

## 11. Structural detection hints

Strong PXP signals (combine several):

1. **Webhook envelope** with exactly `eventCategory` + `eventDate` + `eventData` + `eventOwner{merchantGroup, merchant, site}`; `eventCategory` one of `transaction`/`authentication`/`token`/`reporting`/`test-connection` (any case).
2. **Normalized code shape**: `stateData.code` matching `^CRD\d{3}$`, `^APM\d{3,4}$` or `VAN0001`, next to `stateData.message`.
3. **Transaction vocabulary**: `systemTransactionId` (UUID) together with `merchantTransactionId`, `merchantTransactionDate`, and `transactionMethod{intent, fundingType, entryType}` with values like `Authorisation` (British spelling), `Ecom`, `Instore`, `Moto`.
4. **Provider block**: `fundingData.providerResponse.provider` equal to `PXPFinancial`/`pxpfinancial` (or another acquirer such as `elavon`, `lloydscardnet`) with `merchantAdvice`, `electronicCommerceIndicatorAdjustment`, `schemeTransactionLinkId`, `authorisedAmount`.
5. **Event codes**: hyphenated `spei-transaction-order-*`, `cvu-transaction-order-*`, `breb-transaction-order-*`, `flashflow-transaction-*`, or short codes `TXN_RFU`, `TXN_ERR`, `TXNAP_*`, `TXNPP_UIC`, `TS_TC`.
6. **Error envelope**: `{correlationId, details, errorCode, errorReason}` with `errorCode` like `CAR0003`, `GEN0008`, `TOK0004`, `SES4001`.
7. **Hosts**: `api-services.pxp.io`, `api-services.test.pxp.io`, `out.pxp.io`.
8. **Headers**: `X-Signature` + `X-Signature-Timestamp` + `X-Request-Id`; request header `Authorization: PXP-UST1 ...`.

How it differs from supported providers:

- **Adyen** also uses `eventCode` and `merchantAccountCode`/`pspReference`, but inside `notificationItems[].NotificationRequestItem` with uppercase codes like `AUTHORISATION` and a `success` string. PXP has no `pspReference` or `notificationItems`; its `eventCode` is inside `eventData` and lowercase-hyphenated or `TXN_*`.
- **Checkout.com**: `type` like `payment_approved`, `data`, numeric `response_code` (`10000`), `action_id`. PXP has none of these.
- **Stripe**: `"object": "event"`, ID prefixes (`evt_`, `pi_`). **PayPal**: `event_type` like `PAYMENT.CAPTURE.COMPLETED`, `resource`. Note PXP PayPal events carry PayPal IDs in `providerTransactionId` but use PXP's envelope.
- **Braintree**: `bt_signature`/`bt_payload`. **Mollie**: `resource`, `id` `tr_...`. **Square**: `merchant_id`, `type`, `event_id`, `data.object`.
- **payabl.**: URL-encoded `transactionid=...&status=...`; PXP is JSON only.

Versus other high-risk candidates researched in this folder: DECTA uses `"type": "order"` with `number` `DE\d+` and `transaction_details.processing_status`; eZeeWallet uses `ezw_reference_id` and an `{"error":{"code","message"}}` envelope. None use the `CRDnnn` codes or the `eventOwner.merchantGroup` envelope.

False-positive risk: the generic error envelope (`errorCode`/`errorReason`) alone is weak; require a PXP code prefix, `correlationId` and a PXP host or field family.

---

## 12. Limitations, ambiguities and documentation inconsistencies

1. **No consistent event-type field.** Card, PayPal-family, payout and token events usually have no `eventCode`; the event name in the docs table (for example `transaction-captured`) never appears in the body.
2. **Duplicate rule depends on `eventCode`**, which many events lack.
3. **`eventCategory` casing**: lowercase in OpenAPI and most examples; `Transaction`/`Authentication` in the guide table and the manage-webhooks curl body.
4. **Amount field drift**: `amounts.transaction`, `amounts.transactionValue` (card examples), and singular `amount.transaction` (payout).
5. **`fundingData` shape drift**: older card examples put `cardScheme`, `tokenId`, `providerResponse` directly under `fundingData`; newer ones nest them under `fundingData.card`. The schema allows the nested form only.
6. **Provider name casing**: `PXPFinancial` and `pxpfinancial` both appear.
7. **Timestamp formats**: `merchantTransactionDate` appears as `2024-01-27 08:51:02.826445+00:00` (space separator), `2025-03-31T12:25:31` (no offset), and ISO with `Z`. `settlementDate` appears as `2024-01-25`, `2024-01-25T00:00:00Z` and `2025-04-01T00:00:00`.
8. **State enums disagree**: guide lists 5 states, webhook schema 11, transaction schema 14 (`Confirmed`, `Updated`, `Approved` are not explained), FlashFlow returns `PendingOnProvider` which is in no enum. The "With CVC" card example returns `state: Approved` with raw provider code `91` and advice "Try again later", which reads like a decline.
9. **Card refund**: response example shows `state: Authorised` and the text promises a "Transaction (Authorised)" webhook, while the event table lists `transaction-refunded` for cards with no card example.
10. **New `systemTransactionId` per modification**, but card capture and cancel webhook examples reuse the authorisation's ID, and no parent field is documented for cards. Which ID a real capture webhook carries is ambiguous.
11. **APM state codes** `APM001`-`APM013` have no definition table; `APM002` and `APM003` are missing from the enum; numbering gaps (`APM005`, `APM006`, `APM008`-`APM010`) are unexplained.
12. **API `errorCode` list is not published**; only 12 values appear in examples. `SES4006` sits under the `404` response.
13. **Raw `providerResponse.code`** depends on the acquirer (PXP, Elavon, Lloyds Cardnet seen) and is not documented by PXP. Elavon's in-store example uses `"A"` for approval.
14. **Webhook signature** described two ways (headers recipe vs `PXP-UST1` security scheme); the hash for the header signature is not named.
15. **Manage-webhooks curl sends a JSON array** of events, while the schema describes a single object.
16. **3DS webhook field name**: schema property is `state`, examples use `authenticationState`.
17. **"ISO 8535"** is the label PXP gives the card codes; the codes are PXP's own prefixed identifiers.
18. **No chargeback, dispute, settlement or payout-for-card events.**
19. **Token events** cannot be told apart from the body (`Completed` for created, card updated and disabled).
20. **Regional scope**: SPEI MXN, CVU ARS (Argentina only), Bre-B COP, FlashFlow THB only; Aeropay US. Bre-B has no purchase create and no alias update. FlashFlow refunds are not documented.
21. **Release notes are empty**; field changes cannot be tracked by date.
22. Status page incident naming (`BankTransferRedirectDeposit`) suggests products or legacy flows that the public developer portal does not document. No first-party documentation for any older PXP Financial gateway API was found (`docs.pxpfinancial.com`, `developer.pxpfinancial.com` do not resolve).

---

## 13. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | The main decline field `stateData.code` is a closed, published enum (44 `CRD` codes plus `VAN0001`) with fixed messages, and the raw acquirer code plus `merchantAdvice` sit next to it. HTTP statuses, 3DS states, reasons and error codes, and APM error codes are documented. Caveats: pay-by-bank APM codes and API `errorCode` values exist only as examples (decode from the paired message, fall back to `unknown`), and raw acquirer codes are not documented by PXP. |
| **paymentResponses** | **supported** | Stable JSON with `state`, `stateData`, `systemTransactionId`, `merchantTransactionId`, `transactionMethod`, `fundingData.providerResponse`, and many official examples for authorise, refuse, error, capture, void, refund, incremental, lookup and pay-by-bank initiation. Normalize the state enum differences and timestamp formats.                                                                                                                                       |
| **webhookParsing**   | **limited**   | Envelope and every event body are documented with examples, but there is no consistent event-type field or delivery ID, several field shapes drift between examples, casing differs, token events are ambiguous, card refund is unexemplified, and chargeback events do not exist. Parsing works; exact event naming needs inference.                                                                                                                                         |
| **timeline**         | **limited**   | `eventDate`, `state`, `intent` and documented pay-by-bank state machines support a reasonable ordering (`Pending` -> `Authorised`/`Refused`/`Expired` -> `Refunded`; card `Authorised` -> `Captured`/`Cancelled`). But ordering and retry semantics are undocumented, retries happen within seconds, modifications get new IDs without a documented card parent link, and chargebacks and settlement are absent.                                                              |
| **correlation**      | **limited**   | `systemTransactionId` is a strong key within one transaction, and `merchantOrderId`, `originalSystemTransactionId` (Aeropay only), scheme IDs, PAR and `gatewayTokenId` help. Card modifications return new IDs without a documented parent field, and CVU/Bre-B deposits can arrive with `merchantTransactionId: null`, so cross-operation correlation is partly heuristic.                                                                                                  |
