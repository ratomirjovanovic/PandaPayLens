# Trustly (adapter id `trustly`): high-risk provider research

Status: qualification gate plus condensed technical specification for a parse-only PandaPayLens adapter. Everything below comes from Trustly's first-party documentation and websites as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**. Category and retry columns are **suggestions** for PandaPayLens, not Trustly statements.

- Verification date: **2026-10-25**
- Method: pages were fetched over plain HTTPS without logging in. `docs.trustly.com` returns HTTP 403 to non-browser clients, so pages were requested with an ordinary desktop browser user agent (no login, no cookies, no access request). `eu.developers.trustly.com` now redirects (301) to `docs.trustly.com`, and `developers.trustly.com` redirects to `amer.developers.trustly.com`. The AMER site serves clean Markdown when `.md` is appended to a page URL, as its own documentation index states.
- Gate outcome: **documentation_verified**

---

## 0. Qualification gate

| #   | Item                                           | Answer  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active               | **yes** | https://www.trustly.com/ : "Connecting 9k+ merchants to 650m consumers worldwide"; links to current press releases. Docs pages show recent edits ("Updated 26 days ago" on AccountPayout, "Updated 22 days ago" on AccountAssessment notification).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | Payment service operational                    | **yes** | Homepage markets Payment, Deposit, Payout, Recurring and Data products; docs list live JSON-RPC target `https://api.trustly.com/1` (https://docs.trustly.com/api/api-url) and AMER production base `https://api.trustly.one/api/v1` (https://amer.developers.trustly.com/api-reference/api.md). A status page is linked (https://status.trustly.net/) but rendered no readable content without JavaScript.                                                                                                                                                                                                                                                                                                          |
| 3   | Official developer docs accessible             | **yes** | EU API reference (https://docs.trustly.com/api/...) and AMER docs plus OpenAPI (https://amer.developers.trustly.com/openapi.json) are public. Need a merchant relationship: test account credentials ("You have signed up, and have received access to the Trustly test environment", https://docs.trustly.com/get-started/faq), Back Office (https://backoffice.trustly.com/), live credentials after acceptance testing. Some features (payoutfailed, payoutdowngraded, account, detailed cancel) are opt-in per merchant but their formats are public.                                                                                                                                                           |
| 4   | API families and versions identified           | **yes** | EU: "Trustly's API implements JSON-RPC v1.1 protocol" (https://docs.trustly.com/api/api-protocol), endpoint path `/api/1` (test) and `/1` (live). AMER: REST, OpenAPI `3.1.0`, `info.version` `1.0.0`, base `/api/v1`. See section 2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Responses/notifications examinable offline     | **yes** | Full JSON examples for every EU notification type, method responses and the error envelope; AMER event field tables, an Authorize event example and a form-encoded signed event body example.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | Sectors documented by provider                 | **yes** | See Classification. Trustly publishes vertical pages for gaming/iGaming, e-commerce, financial services, travel, subscription services, utilities and public sector, plus a gaming integration guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7   | Regional/regulatory limitations identified     | **yes** | Footer on https://www.trustly.com/ and https://www.trustly.com/legal-hub : Trustly Group AB is "an authorized Swedish payment institution under the supervision of the Swedish Financial Supervisory Authority (Finansinspektionen)" and "can provide cross-border payment services within the EU/EEA"; Trustly UK Limited is FCA regulated (FRN 1005703). https://www.trustly.com/us : "Trustly, Inc." with "NMLS #2463855". FAQ: "Trustly is currently available in 15 markets". Pay N Play "is available in Sweden, Finland, Estonia and the Netherlands" (https://docs.trustly.com/deposit/integration-gaming). AMER docs cover "US and Canadian bank payments" (https://amer.developers.trustly.com/llms.txt). |
| 8   | Adapter would give diagnostic value            | **yes** | 74 numbered EU JSON-RPC error codes with names; AMER SW/UC/AC/SE status codes, internal error codes, decline extended reasons, EFT and UK direct debit return codes; distinct notification methods with lifecycle meaning (pending, credit, debit, cancel, payoutfailed).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9   | Own technical formats (not a white label)      | **yes** | Trustly defines its own JSON-RPC envelope, signature scheme and notification methods. It is not reselling another gateway. Note: payabl. (already researched for PandaPayLens) offers Trustly as an APM and wraps Trustly errors in its own format; see section 9. Trustly Group also lists Ecospend Limited and SlimPay as group companies (legal hub); their formats are out of scope here.                                                                                                                                                                                                                                                                                                                       |
| 10  | No live credentials needed to analyze examples | **yes** | All examples are in public docs. Signature verification needs keys and is out of scope; Trustly publishes its own TEST and LIVE public keys (https://docs.trustly.com/api/authentication).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Classification

- `alternative_payment_method`: Trustly is pay-by-bank. "Customers simply select their banks, log in with their online bank credentials, and confirm the transaction with their preferred authentication method" (https://docs.trustly.com/get-started/faq). Homepage: "A trusted suite of Pay by Bank products".
- Not `card_processing`, `acquiring`, `gateway` or `wallet`: no card flows are documented; Trustly moves bank-to-bank funds itself.
- Not classified as `merchant_account_intermediary`, but note the funds model: merchants hold a balance at Trustly ("You must have sufficient funds in your merchant account to make the refund", https://docs.trustly.com/api/refund) and settle to their own bank account (FAQ). Partner/PSP use is supported through `PSPMerchant`, `PSPMerchantURL`, `MerchantCategoryCode` attributes ("Deposit for Partner with EMO", https://docs.trustly.com/api/deposit); that does not make Trustly itself a payment facilitator by its own description.

### Sectors (as documented by Trustly)

| Sector                | Source and quote                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iGaming / gaming      | https://www.trustly.com/verticals/gaming : page title "Trustly for iGaming Payments"; "Scale your European player base with quick and reliable onboarding, deposits and payouts." https://docs.trustly.com/deposit/integration-gaming : "Let players deposit and withdraw money by using Trustly in your gaming cashier." https://www.trustly.com/us : "Cashless direct funding for gaming". KYC notification docs reference self-exclusion and "Player is blacklisted from gambling altogether" (https://docs.trustly.com/api/kyc-notification). |
| E-commerce            | https://www.trustly.com/verticals/ecommerce : "Boost E-commerce Sales with Trustly"; https://docs.trustly.com/payments/integration-e-commerce                                                                                                                                                                                                                                                                                                                                                                                                     |
| Financial services    | https://www.trustly.com/verticals/financial-services : "Trustly for Financial Services Payments"; Deposit page mentions "top-ups to an investment account"                                                                                                                                                                                                                                                                                                                                                                                        |
| Travel                | https://www.trustly.com/verticals/travel : "Trustly for Travel Payments"; https://docs.trustly.com/payments/integration-travel                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Subscription services | https://www.trustly.com/verticals/subscription-services : "Trustly for Subscription Payments"                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Utilities             | https://www.trustly.com/verticals/utilities : "Trustly for Utilities Billing & Payments"                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Public sector         | https://www.trustly.com/verticals/public-sector : "Open Banking for the Public Sector"                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Trustly does not document adult, nutraceuticals or crypto as accepted sectors in the pages read. Eligibility in any sector depends on jurisdiction, licensing and Trustly's own onboarding; the KYC docs say "it's up to the merchant's own interpretation of any Gaming Requirements". Approval for one sector does not imply another.

---

## 1. Sources (all read on 2026-10-25)

EU / global API reference (`docs.trustly.com`; pages carry only relative "Updated N ago" stamps):

| URL                                                                                                                                                                                                                                                                                                           | Covers                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| https://docs.trustly.com/sitemap.xml                                                                                                                                                                                                                                                                          | Page index (294 URLs)                                                                             |
| https://docs.trustly.com/api/api-protocol                                                                                                                                                                                                                                                                     | JSON-RPC 1.1 envelope, UUID, idempotent replay                                                    |
| https://docs.trustly.com/api/api-url                                                                                                                                                                                                                                                                          | Test and live JSON-RPC targets                                                                    |
| https://docs.trustly.com/api/authentication                                                                                                                                                                                                                                                                   | RSA signature, serialisation, `alg=` prefixes, Trustly public keys                                |
| https://docs.trustly.com/api/error-handling                                                                                                                                                                                                                                                                   | Error envelope (`JSONRPCError`)                                                                   |
| https://docs.trustly.com/api/security                                                                                                                                                                                                                                                                         | TLS 1.2, no certificate pinning                                                                   |
| https://docs.trustly.com/api/notifications-overview                                                                                                                                                                                                                                                           | Notification delivery, response, retry schedule, custom headers                                   |
| https://docs.trustly.com/api/credit-notification, /debit-notification, /pending-notification, /cancel-notification, /account-notification, /kyc-notification, /payout-confirmation, /payoutfailed-notification, /payout-downgraded-notification, /verifyaccount-notification, /accountassessment-notification | Each notification type                                                                            |
| https://docs.trustly.com/api/deposit, /refund, /accountpayout, /approvewithdrawal, /getwithdrawals, /selectaccount, /registeraccount, /merchantsettlement, /viewautomaticsettlementdetailscsv                                                                                                                 | Methods, responses and error tables                                                               |
| https://docs.trustly.com/api/swish, /swish-payout, /swish-refund, /ideal, /bancontact, /bancontact-wip, /mbway, /mbway-authorised-payments, /bizum, /checkout-core, /checkout-core-recurring, /tdd-charge, /confirmationofpayee, /verificationofpayee                                                         | Further error tables (all 122 `/api/` pages were downloaded and scanned for error tables)         |
| https://docs.trustly.com/api/mdd-notifications-for-directdebit, /mdd-errors-and-details-for-debiting, /-crediting, /-mandates, /-refunds, /mddsubscriptionapi                                                                                                                                                 | Merchant Direct Debit (recurring) notifications and scheme detail strings                         |
| https://docs.trustly.com/api/test-environment, /live-environment, /handling-currencies, /code-library                                                                                                                                                                                                         | Environments, currencies, official SDK repos (github.com/trustly/trustly-client-php, -java, -net) |
| https://docs.trustly.com/get-started/faq, https://docs.trustly.com/deposit/integration-gaming, https://docs.trustly.com/payout/integration-gaming                                                                                                                                                             | FAQ, gaming flows, notification ordering                                                          |

North America (`amer.developers.trustly.com`):

| URL                                                                                                                                            | Covers                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| https://amer.developers.trustly.com/llms.txt, /api-reference/llms.txt, /integrate/core-concepts/llms.txt, /integrate/api-fundamentals/llms.txt | Index                                                                  |
| https://amer.developers.trustly.com/api-reference/api.md                                                                                       | REST base URLs, Basic auth, HTTP codes                                 |
| https://amer.developers.trustly.com/openapi.json                                                                                               | OpenAPI 3.1.0 (Transaction, PaymentProviderTransaction, error schemas) |
| https://amer.developers.trustly.com/integrate/api-fundamentals/status-codes-and-type-definitions.md                                            | All AMER status, error and decline codes                               |
| https://amer.developers.trustly.com/integrate/core-concepts/webhooks-and-events.md                                                             | Event notifications, event types, retry                                |
| https://amer.developers.trustly.com/integrate/api-fundamentals/secure-requests-and-signature-validation/validate-the-notification-signature.md | HMAC-SHA1 notification signature, form-encoded body example            |
| https://amer.developers.trustly.com/integrate/core-concepts/transactions-and-transaction-ids.md                                                | `transactionId` semantics                                              |
| https://amer.developers.trustly.com/integrate/api-fundamentals/idempotency.md                                                                  | `merchantReference` uniqueness, code 210                               |
| https://amer.developers.trustly.com/api-reference/api/event-notifications/failed.md, /completed.md, /update.md                                 | Event payload references                                               |

Corporate: https://www.trustly.com/ , /verticals/gaming, /verticals/ecommerce, /verticals/financial-services, /verticals/travel, /verticals/subscription-services, /verticals/utilities, /verticals/public-sector, /legal-hub, /security, /us . Cross-reference (PandaPayLens repo, not a Trustly source): `docs/providers/research/payabl.md` section 4.8.

---

## 2. API families and versions

| Family                                                                                                                                                        | Endpoint                                                                                  | Request                                                           | Response                                                                                                      | Relevance    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| **EU JSON-RPC API** (Deposit, Refund, AccountPayout, SelectAccount, RegisterAccount, ApproveWithdrawal, GetWithdrawals, Charge, Swish, etc.)                  | Test `https://test.trustly.com/api/1`, live `https://api.trustly.com/1`                   | JSON-RPC 1.1, HTTPS POST, UTF-8, `Content-Type: application/json` | JSON-RPC `result` or `error` envelope                                                                         | **Primary**  |
| **EU notifications** (credit, debit, pending, cancel, account, kyc, payoutconfirmation, payoutfailed, payoutdowngraded, verifyAccount, assessAccount, advice) | HTTPS POST to merchant `NotificationURL`                                                  | JSON-RPC 1.1 call from Trustly                                    | Merchant must answer with a signed JSON-RPC `result`                                                          | **Primary**  |
| EU Merchant Direct Debit (MDD) / Trustly Direct Debit (TDD) recurring                                                                                         | Same JSON-RPC target plus SFTP CSV batch                                                  | JSON-RPC and CSV                                                  | JSON-RPC notifications with `reason`/`details` scheme strings                                                 | Later        |
| Trustly Express / Checkout Core ("Azura")                                                                                                                     | Same JSON-RPC target                                                                      | JSON-RPC                                                          | JSON-RPC (`rejected` field seen in `RemoveAzuraAccount`)                                                      | Later        |
| **AMER REST API v1**                                                                                                                                          | Sandbox `https://sandbox.trustly.one/api/v1`, production `https://api.trustly.one/api/v1` | JSON over HTTPS, HTTP Basic (`accessId:accessKey`)                | JSON; errors as `{"errors":[...]}`                                                                            | Secondary    |
| **AMER event notifications**                                                                                                                                  | POST to `notificationUrl`                                                                 | n/a                                                               | `application/x-www-form-urlencoded` body per signature page (but a JSON example also appears, see section 10) | Secondary    |
| Client SDKs (Web/iOS/Android, Lightbox `addPanelListener` events)                                                                                             | Browser/app                                                                               | n/a                                                               | JS callbacks                                                                                                  | Out of scope |

**Implement first:** EU JSON-RPC responses and errors plus EU notifications. They share one envelope (`method`, `params.signature`, `params.uuid`, `params.data`, `version: "1.1"`), have the richest examples and are what a merchant pastes from logs. Add AMER events and REST errors second; their code tables (SW, UC, AC) are the most diagnostic part of AMER.

---

## 3. Response and error formats

### 3.1 EU JSON-RPC

- Content type: JSON, UTF-8. The protocol page example shows `Content-Type: application/json; charset=UTF-8` on the response.
- "All parameters, both in the request and result, are case-sensitive." Request keys are capitalised (`Signature`, `UUID`, `Data`, `Username`, `MessageID`); result and notification keys are lowercase (`signature`, `uuid`, `data`, `orderid`, `messageid`).
- "Returned numbers can be returned as a string ("123") and as a number (123)."
- Success: `{"result": {"signature", "uuid", "method", "data": {...}}, "version": "1.1"}`. `data.result` is `"1"` on acceptance and `"0"` otherwise for AccountPayout/ApproveWithdrawal ("1 if the payout could be accepted and 0 otherwise").
- Error: `{"version": "1.1", "error": {"name": "JSONRPCError", "code": <int>, "message": "<ERROR_NAME>", "error": {"signature", "uuid", "method", "data": {"code", "message"}}}}`. "The message returned is not in a suitable format to present for customers." For JSON-RPC level errors (for example invalid JSON) "uuid and method will be `"null"`".
- HTTP status for errors: **NOT DOCUMENTED** for the EU API.

Example A, Deposit success (transcribed from https://docs.trustly.com/api/deposit):

```json
{
  "result": {
    "signature": "4F8hjuMqbsH0Ku ... S16VbzRsw==",
    "uuid": "258a2184-2842-b485-25ca-293525152425",
    "method": "Deposit",
    "data": {
      "orderid": "2190971587",
      "url": "https://checkout.trustly.com/checkout?OrderID=1234567890&SessionID=..."
    }
  },
  "version": "1.1"
}
```

Example B, error (transcribed from https://docs.trustly.com/api/error-handling; verbatim, including the missing final closing brace in the docs):

```
{
    "version": "1.1",
    "error": {
        "name": "JSONRPCError",
        "code": 616,
        "message": "ERROR_INVALID_CREDENTIALS",
        "error": {
            "signature": "R9+hjuMqbsH0Ku ... S16VbzRsw==",
            "uuid": "258a2184-2842-b485-25ca-293525152425",
            "method": "Deposit",
            "data": {
                "code" : 616,
                "message" : "ERROR_INVALID_CREDENTIALS"
            }
        }
}
```

### 3.2 AMER REST

- JSON request and response; HTTP Basic auth.
- HTTP codes (status-codes page): 400, 401, 404, 500, 503; API overview adds 200, 403, 429.
- Error body (OpenAPI schema `BaseException` / `...ErrorsItems`): `{"errors": [{"domain": string, "code": integer, "location": string, "message": string, "occurredAt": integer}]}`. Some endpoints use `{"message": string}` instead. No transcribed error example exists in the docs (**NOT DOCUMENTED**).
- Transaction object (OpenAPI `Transaction`): `transactionId` ("15 character max"), `transactionType`, `status`, `statusMessage`, `statusCode`, `paymentProviderTransaction` (`paymentProviderTransactionId`, `status` such as `SW021`/`AC100`, `statusMessage`, `statusDescription`, `thirdPartyDeclineCode`, `clearingHouse`, `instantSettle`, `signature`), `merchantReference`, `originalTransactionId`, `amount`, `currency`, `createdAt`, `processedAt`, `completedAt`, `updatedAt`, `expiredAt`.

---

## 4. Codes

### 4.1 EU JSON-RPC error codes (74 distinct numbers, union of all method pages)

Arrives in `error.code` (number) and `error.message` (name); repeated in `error.error.data.code`/`.message`. Trustly: "New error codes can be added and existing error codes can be removed without notice" (AccountPayout). Pages are the `/api/<page>` slugs where the code is listed. Several names contain Trustly's own typos (`AGRREMENT`); they are exact values.

| Code | Name                                              | Meaning (paraphrase)                                                  | Category                   | Retry                    |
| ---- | ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | ------------------------ |
| 102  | ERROR_RATE_LIMIT                                  | Third-party limit; request denied but can be retried later (CoP/VoP)  | rate_limiting              | retry_conditionally      |
| 602  | ERROR_FUNCTION_ACCESS_DENIED                      | Merchant has no access to this method                                 | configuration              | do_not_retry             |
| 603  | ERROR_INSUFFICIENT_FUNDS                          | Merchant balance at Trustly too low (refund, settlement)              | insufficient_funds         | manual_review            |
| 607  | ERROR_HOST_ACCESS_DENIED                          | Caller IP not whitelisted                                             | configuration              | do_not_retry             |
| 615  | ERROR_INVALID_AMOUNT                              | Amount must be > 0 with 2 decimals (refund: not above original)       | invalid_amount             | do_not_retry             |
| 616  | ERROR_INVALID_CREDENTIALS                         | Wrong API username/password                                           | configuration              | do_not_retry             |
| 619  | ERROR_NETWORK                                     | Temporary connectivity issue with the payment system provider (iDEAL) | network_or_timeout         | retry_conditionally      |
| 620  | ERROR_UNKNOWN                                     | Unspecified; some pages say a retry might succeed                     | unknown                    | retry_conditionally      |
| 621  | ERROR_NO_SUITABLE_BANK_ACCOUNT_FOUND              | No earlier settlement in this currency (MerchantSettlement)           | configuration              | manual_review            |
| 622  | ERROR_INVALID_CURRENCY_CODE                       | Invalid currency code                                                 | invalid_request            | do_not_retry             |
| 623  | ERROR_INVALID_PARAMETERS                          | A value does not match the expected format                            | invalid_request            | do_not_retry             |
| 624  | ERROR_INVALID_BANK_ACCOUNT_NUMBER                 | Bank account, IBAN or AccountID invalid (text varies by page)         | invalid_request            | customer_action_required |
| 625  | ERROR_INVALID_SORT_CODE                           | Invalid sort code (CoP)                                               | invalid_request            | customer_action_required |
| 627  | ERROR_NOT_FOUND                                   | Settlements for the date could not be executed (requirements not met) | configuration              | manual_review            |
| 636  | ERROR_UNABLE_TO_VERIFY_RSA_SIGNATURE              | Request signature failed verification (wrong key or serialisation)    | configuration              | do_not_retry             |
| 637  | ERROR_DUPLICATE_MESSAGE_ID                        | MessageID already used                                                | duplicate_request          | do_not_retry             |
| 638  | ERROR_ENDUSER_IS_BLOCKED                          | End user is on a blocking list                                        | fraud_or_risk              | do_not_retry             |
| 639  | ERROR_NO_PUBLIC_KEY                               | No merchant public key configured at Trustly                          | configuration              | do_not_retry             |
| 642  | ERROR_INVALID_EMAIL                               | Email missing or invalid                                              | invalid_request            | do_not_retry             |
| 645  | ERROR_INVALID_LOCALE                              | Locale value invalid                                                  | invalid_request            | do_not_retry             |
| 655  | ERROR_INVALID_ORDER_ID                            | OrderID in refund does not exist                                      | invalid_request            | do_not_retry             |
| 670  | ERROR_REFUND_EXCEED_DEPOSIT_VOLUME                | Refund larger than remaining deposit amount                           | invalid_amount             | do_not_retry             |
| 671  | ERROR_DEPOSIT_NOT_CAPTURED_OR_SETTLED             | Deposit failed and never settled                                      | invalid_request            | do_not_retry             |
| 672  | ERROR_MULTIPLE_REFUND_ATTEMPT                     | Only one refund allowed (Finnish Bank Buttons deposits)               | invalid_request            | do_not_retry             |
| 676  | ERROR_SETTLEMENTS_NOT_PROCESSED                   | Settlements for that date not processed yet                           | provider_unavailable       | retry_conditionally      |
| 688  | ERROR_DUPLICATE_UUID                              | UUID already used                                                     | duplicate_request          | do_not_retry             |
| 696  | ERROR_ENDUSERID_IS_NULL                           | EndUserID null                                                        | invalid_request            | do_not_retry             |
| 697  | ERROR_MESSAGEID_IS_NULL                           | MessageID null                                                        | invalid_request            | do_not_retry             |
| 698  | ERROR_INVALID_IP                                  | IP attribute invalid (only one allowed)                               | invalid_request            | do_not_retry             |
| 700  | ERROR_MALFORMED_SUCCESSURL                        | SuccessURL malformed                                                  | invalid_request            | do_not_retry             |
| 701  | ERROR_MALFORMED_FAILURL                           | FailURL malformed                                                     | invalid_request            | do_not_retry             |
| 702  | ERROR_MALFORMED_TEMPLATEURL                       | TemplateURL malformed                                                 | invalid_request            | do_not_retry             |
| 703  | ERROR_MALFORMED_URLTARGET                         | URLTarget malformed                                                   | invalid_request            | do_not_retry             |
| 704  | ERROR_MALFORMED_MESSAGEID                         | MessageID malformed                                                   | invalid_request            | do_not_retry             |
| 705  | ERROR_MALFORMED_NOTIFICATIONURL                   | NotificationURL malformed                                             | invalid_request            | do_not_retry             |
| 706  | ERROR_MALFORMED_ENDUSERID                         | EndUserID malformed                                                   | invalid_request            | do_not_retry             |
| 712  | ERROR_DIRECT_DEBIT_NOT_ALLOWED                    | Trustly Direct Debit not enabled for merchant                         | configuration              | do_not_retry             |
| 716  | ERROR_REFUND_PENDING                              | A refund is already queued for this OrderID                           | duplicate_request          | do_not_retry             |
| 717  | ERROR_INVALID_ORDER_ATTRIBUTE                     | One or more attributes have wrong values                              | invalid_request            | do_not_retry             |
| 718  | ERROR_DISABLED_USER                               | Merchant user disabled                                                | configuration              | do_not_retry             |
| 732  | ERROR_PAY_AND_PLAY_NOT_ALLOWED                    | Pay N Play not enabled                                                | configuration              | do_not_retry             |
| 734  | ERROR_NOT_SECURE_NOTIFICATIONURL                  | NotificationURL must be HTTPS                                         | configuration              | do_not_retry             |
| 737  | ERROR_INVALID_COUNTRY                             | Country code invalid                                                  | invalid_request            | do_not_retry             |
| 739  | ERROR_INVALID_MERCHANT_SWISH_NUMBER               | Invalid merchant Swish number                                         | configuration              | do_not_retry             |
| 740  | ERROR_INVALID_SWISH_PAYER                         | Swish payer not enrolled                                              | payment_method_unavailable | customer_action_required |
| 741  | ERROR_INVALID_SWISH_MESSAGE                       | Badly formatted Swish message                                         | invalid_request            | do_not_retry             |
| 742  | ERROR_AGE_LIMITED_SWISH_PAYER                     | Payer below age limit                                                 | payment_method_unavailable | do_not_retry             |
| 743  | ERROR_SSN_UNMATCHED_SWISH_PAYER                   | Payer alias/SSN or org number mismatch                                | invalid_request            | customer_action_required |
| 744  | ERROR_ONGOING_PAYMENT_FOR_SWISH_PAYER             | A payment request already exists for payer                            | duplicate_request          | retry_conditionally      |
| 745  | ERROR_SWISH_COUNTERPART_NOT_ACTIVATED             | Counterpart not activated                                             | payment_method_unavailable | customer_action_required |
| 746  | ERROR_SWISH_PAYER_NOT_ENROLLED                    | Payer not enrolled                                                    | payment_method_unavailable | customer_action_required |
| 747  | ERROR_MERCHANT_SWISH_NUMBER_NOT_ENROLLED          | Merchant Swish number not enrolled                                    | configuration              | do_not_retry             |
| 748  | ERROR_INSUFFICIENT_FUNDS_IN_ACCOUNT               | Insufficient funds for Swish refund                                   | insufficient_funds         | manual_review            |
| 749  | ERROR_SWISH_PAYEE_NOT_ENROLLED                    | Payee not enrolled for payout                                         | payment_method_unavailable | customer_action_required |
| 750  | ERROR_SSN_UNMATCHED_SWISH_PAYEE                   | Payee SSN differs from original payer (number moved)                  | fraud_or_risk              | manual_review            |
| 751  | ERROR_RECIPIENT_EXCEEDED_AMOUNT_LIMIT             | Amount too large or above refundable remainder                        | invalid_amount             | do_not_retry             |
| 755  | ERROR_INVALID_ACCOUNT_ID                          | AccountID invalid (Checkout Core)                                     | invalid_request            | do_not_retry             |
| 759  | ERROR_AZURA_SESSION_EXPIRED                       | AzuraSessionID expired (30 minute lifetime)                           | authentication_required    | customer_action_required |
| 760  | ERROR_AZURA_ACCOUNT_NOT_FOUND                     | AccountID not found                                                   | invalid_request            | do_not_retry             |
| 761  | ERROR_MALFORMED_SHOPPERSTATEMENT                  | ShopperStatement malformed                                            | invalid_request            | do_not_retry             |
| 767  | ERROR_MALFORMED_FIRSTNAME                         | Firstname malformed                                                   | invalid_request            | do_not_retry             |
| 769  | ERROR_MALFORMED_LASTNAME                          | Lastname malformed                                                    | invalid_request            | do_not_retry             |
| 772  | ERROR_MALFORMED_MERCHANT_USERNAME                 | Username malformed                                                    | configuration              | do_not_retry             |
| 783  | ERROR_BANCONTACTWIP_AGREEMENT_FAILED              | Agreement creation failed; try again                                  | payment_method_unavailable | retry_conditionally      |
| 784  | ERROR_BANCONTACTWIP_AGRREMENT_REVOKED_BY_CONSUMER | Consumer revoked agreement                                            | payment_method_unavailable | do_not_retry             |
| 785  | ERROR_BANCONTACTWIP_AGRREMENT_REVOKED_BY_MERCHANT | Merchant revoked agreement                                            | payment_method_unavailable | do_not_retry             |
| 786  | ERROR_BANCONTACTWIP_AGRREMENT_REVOKE_FAILED       | Revocation failed                                                     | provider_unavailable       | retry_conditionally      |
| 787  | ERROR_BANCONTACTWIP_AGREEMENT_ID                  | Agreement ID problem                                                  | invalid_request            | do_not_retry             |
| 788  | ERROR_PAYER_PHONE_NUMBER                          | Phone invalid or not MB Way registered                                | invalid_request            | customer_action_required |
| 790  | ERROR_AGREEMENT_FAILED                            | Agreement creation failed; try again (MB Way)                         | payment_method_unavailable | retry_conditionally      |
| 791  | ERROR_AGRREMENT_REVOKED                           | Agreement revoked                                                     | payment_method_unavailable | do_not_retry             |
| 792  | ERROR_AGRREMENT_REVOKE_FAILED                     | Revocation failed                                                     | provider_unavailable       | retry_conditionally      |
| 793  | ERROR_AGREEMENT_ID                                | Agreement ID problem                                                  | invalid_request            | do_not_retry             |
| 794  | ERROR_MALFORMED_ACCOUNT_HOLDER_NAME               | Account holder name invalid characters or length                      | invalid_request            | customer_action_required |

Other EU values that are not in numbered tables:

- `ERROR_CHARGE_NOT_APPROVED` (cancel `attributes.reason` in MDD/TDD examples) and `ERROR_ACCOUNT_NOT_FOUND` (`data.rejected` in a `RemoveAzuraAccount` result, with `"result": "0"`). Meanings beyond the names are **NOT DOCUMENTED**.
- MDD scheme detail strings in `details`/`detail`/`failureReason`, format `[SCHEME] [CATEGORY]_[CODE](DESCRIPTION)`, for example `BACS ARUDD_1(INSTRUCTION CANCELLED BY PAYER)`, `TK82_1(INSUFFICIENT FUNDS)`, `DEBIT_MD01(DEBTOR'S ACTIVE MANDATE MISSING)`. 116 distinct strings across the four "Errors and details" pages; not transcribed here (condensed scope). SEPA reason codes are referenced to the European Payments Council guidance, not listed.
- `payoutfailed` `errorcode` and `payoutdowngraded` `errorcode`: only example values are documented, `incorrect_account_number` ("Format of the account number specified is not correct") and `sepa_instant_downgrade`. The full value list is **NOT DOCUMENTED**. Suggest payout `invalid_request`/`customer_action_required` for the first; the second is informational (payout still confirmed).

### 4.2 AMER codes (193 values)

Location: `paymentProviderTransaction.status` (SW, UC, AC, SE, return codes), `paymentProviderTransaction.reasonCode` and extended reason codes, REST `errors[].code` (internal codes), event `errorCode`.

SW (validation before ODFI submission), 13 codes (SW010 and SW020 are non-error states):

| Code  | Meaning                                       | Category                   | Retry                                                                            |
| ----- | --------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| SW010 | Established (not an error)                    | n/a                        | n/a                                                                              |
| SW013 | Cancelled by user/browser/device              | unknown (abandonment)      | customer_action_required                                                         |
| SW020 | Authorization received (not an error)         | n/a                        | n/a                                                                              |
| SW021 | Authorization denied, e.g. insufficient funds | insufficient_funds         | customer_action_required                                                         |
| SW051 | Merchant error (integration, invalid request) | invalid_request            | do_not_retry                                                                     |
| SW052 | Financial institution error                   | provider_unavailable       | retry_conditionally                                                              |
| SW053 | Internal network error                        | network_or_timeout         | retry_conditionally                                                              |
| SW054 | Suspicious activity (risk)                    | fraud_or_risk              | retry_conditionally (Trustly: "try again later or use a different bank account") |
| SW055 | Negative data                                 | fraud_or_risk              | manual_review                                                                    |
| SW056 | Unsupported account type                      | payment_method_unavailable | customer_action_required                                                         |
| SW057 | Expired split token                           | authentication_required    | customer_action_required                                                         |
| SW059 | Instant transaction rejected for risk         | fraud_or_risk              | do_not_retry                                                                     |
| SW060 | Bank or network processor down                | provider_unavailable       | retry_conditionally                                                              |

UC (user cancelled), 37 codes `UC01` to `UC37`, all suggested `unknown` (abandonment) / `customer_action_required`. Each names the page where the user left: UC01 bank selection, UC02 login, UC03 invalid login, UC04 challenge question, UC05 invalid challenge answers, UC06 MFA, UC07 invalid MFA, UC08 account selection, UC09 error page, UC10 partial account number, UC11 select account location, UC12 bank not listed, UC13 login with captcha, UC14 captcha validation, UC15 manual account input, UC16 manual account confirmation, UC17 MCD confirmation, UC18 MCD validation, UC19 account profile input, UC20 no dynamic balance, UC21 partial account not supported, UC22 security script, UC23 account not supported, UC24 authorize page with exception, UC25 bad account, UC26 bank reset password, UC27 bank unavailable (suggest provider_unavailable), UC28 external screen, UC29 timeout (suggest network_or_timeout), UC30 invalid routing/account number on manual entry, UC31 SWIFT/address not found, UC32 maintenance page (suggest provider_unavailable), UC33 non-eligible currency, UC34 OAuth "Connect to your bank", UC35 "Waiting for your approval", UC36 VAN info, UC37 widget within Lightbox.

AC (ACH/RTP acknowledged communication), 19 codes: AC100 Pending, AC101 Declined, AC102 Approved, AC103 Error, AC104 Voided, AC105 Processed, AC106 Collected, AC107 Awaiting Capture, AC108 Awaiting Approval, AC109 Suspended, AC110 In Collection, AC111 In Research, AC112 Disputed, AC113 Uncollected Insufficient Funds (insufficient_funds), AC114 Invalid or Closed Account (suggest payment_method_unavailable / customer_action_required), AC115 Other Returns, AC116 None, AC117 Expired, AC118 Settled. Most are lifecycle states, not errors; use them for the timeline.

SE (system), 3 codes: SE01 maintenance mode, SE02 error connecting to API services, SE03 error connecting to financial services gateway. Suggest provider_unavailable / safe_to_retry_technical_request.

Internal REST error codes (`errors[].code`), 12 codes:

| Code | Meaning                                                              | Category                   | Retry                    |
| ---- | -------------------------------------------------------------------- | -------------------------- | ------------------------ |
| 100  | Internal database exception                                          | provider_unavailable       | retry_conditionally      |
| 150  | Remote error, e.g. bank interface down                               | provider_unavailable       | retry_conditionally      |
| 200  | Invalid parameter                                                    | invalid_request            | do_not_retry             |
| 210  | Duplicate request ignored (idempotency on `merchantReference`)       | duplicate_request          | do_not_retry             |
| 300  | Generic security error                                               | configuration              | manual_review            |
| 326  | Expired split token                                                  | authentication_required    | customer_action_required |
| 330  | Invalid account                                                      | payment_method_unavailable | customer_action_required |
| 331  | Not enough balance                                                   | insufficient_funds         | customer_action_required |
| 375  | Access control error (`accessId`, `accessKey` or `requestSignature`) | configuration              | do_not_retry             |
| 380  | Invalid split token                                                  | authentication_required    | customer_action_required |
| 390  | Fraud analysis: suspicious or negative data                          | fraud_or_risk              | manual_review            |
| 397  | `splitToken` not valid                                               | authentication_required    | customer_action_required |

Decline extended reasons, 33 values (field `reasonCode` plus extended reason code):

- SW021: reason 12 / extended `120000` insufficient funds (insufficient_funds, customer_action_required).
- SW054 (fraud_or_risk): reason 1 exceeded thresholds `10000`, `10001` (transaction amount), `11XXX` consumer amount velocity over XXX hours, `12XXX` consumer count velocity, `13XXX` merchant amount velocity, `14XXX` merchant count velocity (XXX is 001 to 999, so these are patterns); reason 2 data mismatch `20000` name, `20001` email, `20002` address; reason 3 suspicious history `30000`, `30101` NSF model score, `30201` NSF rules hard block, `30301` fraud model score, `30401` fraud rules hard block; reason 4 third-party history `40000`. Trustly also lists suggested action for SW054 reason `15` (beneficiary country prohibited) without an extended code.
- SW055 (fraud_or_risk, manual_review): reason 5 `50000` negative database, `50001` consumer blocklisted, `50002` device, `50003` bank account, `50004` IP, `50005` geolocation, `50006` uncollected debt NSF, `50007` uncollected debt admin, `50008` uncollected debt SUF (the three debt values: customer_action_required, customer must pay Trustly); reason 6 `60000` sanctions list; reason 7 `70000` IP sanctions list; reason 8 `80000` blocklisted by third party; reason 16 `160000` reason cannot be communicated (unknown).
- SW056 (payment_method_unavailable, customer_action_required): reason 9 `90000` business account unsupported; reason 10 `100000` non-checking account unsupported.
- SW057 (authentication_required, customer_action_required): reason 11 `110000` expired/revoked split token, `110001` new authentication required after suspicious activity.

Return codes:

- EFT Canada, 23 codes (`900` to `996`): 900 account info wrong, 901 insufficient funds, 902 account not found, 903 payment stopped/recalled, 904 post/stale dated, 905 account closed, 907 no debit allowed, 908 funds not cleared, 909 currency/account mismatch, 910 payor/payee deceased, 911 account frozen, 912 invalid account number, 914 incorrect name, 915 no agreement, 916 not per agreement (personal), 917 agreement revoked (personal), 918 no pre-notification (personal), 919 not per agreement (business), 920 agreement revoked (business), 921 no pre-notification (business), 922 customer-initiated return (credit only), 990 institution in default, 996 chargeback. Suggest insufficient_funds for 901/908, payment_method_unavailable for account problems, manual_review for agreement/chargeback codes.
- UK TDD, 53 codes listed on the AMER page: ARUCS_0/2/3/5/B/C, AWACS_0/3, ARUDD_0/2/3/4/5/6/7/8/9/A/B, ADDACS_0/1/2/3/B/C/D/E/R, AUDDIS_1/2/3/5/6/C/F/G/H/I/K/L/M/N/O/P/Q, DDICA_1 to DDICA_8 (BACS scheme reason codes; e.g. ARUDD_0 "Refer to payer", DDICA_6 "Signature fraudulent"). Suggest manual_review by default; ARUDD_0 insufficient_funds.
- ACH return codes `R01` to `R84`: referenced as a range only, not enumerated (**NOT DOCUMENTED** individually).

Other AMER enumerations: user verification `errorCode` `-1`, `1` to `6` (OpenAPI `UserVerificationErrorCode`: -1 none, 1 internal, 2 below minimum age, 3 attributes below criteria, 4 mandatory attributes missing, 5 deceased, 6 screening match).

Count used in the summary: EU 74 numbered error codes; AMER 13 SW + 37 UC + 19 AC + 3 SE + 12 internal + 33 extended reasons + 23 EFT + 53 UK TDD = 193. Grand total enumerated: **267**, plus 116 MDD scheme detail strings referenced but not transcribed.

---

## 5. Lifecycle (bank payment semantics, no card states)

EU Deposit (pay-in):

1. `Deposit` call -> result `orderid` + checkout `url`.
2. Optional `kyc` notification (if `RequestKYC: "1"`) after bank login and before transfer; merchant replies `CONTINUE`, `FINISH` or `CONTINUE` with `limit`. Abort variants carry `abort: "1"` and `abortmessage` `unverified` or `underage`.
3. Optional `account` notification (opt-in): `accountid`, `verified`, bank attributes.
4. `pending`: user finished the flow, money not yet received.
5. `credit`: balance should be increased; "this is when the item should be shipped".
6. `debit` after credit if funds never settle ("after a standard waiting period of 3 bank days ... as long as 10 bank days"); merchant replies `OK` (stopped/recovered) or `FAILED`. OK followed by late settlement triggers an automatic refund.
7. `cancel`: abandonment (10 to 30 minutes inactivity), close button, crash, or non-settlement without prior credit. Optional detailed fields `lastorderstep` and `orderstatuses` (`TIMEOUT`, `ABORTED`, `CRASHED`, `LIMIT`); Trustly advises not to automate on them.

- Ordering: "Account, Pending, Credit notifications can arrive in any order" (gaming integration guide).

EU payouts (AccountPayout, Withdraw, Refund):

- AccountPayout result `"result": "1"` (accepted) or `"0"`.
- `payoutconfirmation` (opt-in) when the bank confirms funds sent; can take a day or more.
- Failure: `credit` (returns the amount to the end user balance, can arrive days later and even after a `payoutconfirmation`) or `cancel`. Optional `payoutfailed` (production only) with `errorcode`/`errormessage`. Optional `payoutdowngraded` when SEPA Instant fell back to SEPA SCT (payout still reaches CONFIRMED).
- Withdraw flow: `debit` notification when the user completes the withdrawal in the checkout (merchant replies OK/FAILED; FAILED means the withdrawal is not processed); `ApproveWithdrawal` approves it.
- Refund: result `"1"`, queued if the deposit has not settled; failure is signalled by a `credit` notification to the original Deposit `NotificationURL`.
- `GetWithdrawals` `transferstate` (11 values): CONFIRMED; EXECUTING, EXECUTED (processed, not confirmed); PENDING, QUEUED, PREPARING, PREPARED (not processed); BOUNCED, ERROR, FAILED, RETURNED (failure). Trustly: "New states can be added, and existing states can be changed or removed without notice."
- Chargebacks/disputes for EU pay-by-bank: **NOT DOCUMENTED** as a notification type.
- Recurring (MDD/TDD): `pending` -> `credit`, or `cancel` with `attributes.reason` and scheme `details`; BACS `advice` notification for indemnity claims.

AMER:

- Transaction `status` values: 0 New, 1 Pending, 2 Authorized, 3 Processed, 4 Completed, 5 Failed, 6 Expired, 7 Canceled, 8 Denied, 10 Reversed, 11 Partially Refunded, 12 Refunded, 13 Voided, 14 OnHold (9 is absent).
- Event types: Establish, Authorize, DataReady, Update, Process, Complete, Cancel, Cancelled, Expire, Failed, Deny, Dispute, Reconcile, Refund, Reverse, Refresh, CONSENT_REVOKED.
- `transactionType`: 0 External, 1 Authorize, 2 Pay, 3 Capture, 4 Refund, 5 Reverse, 6 Deposit (payout), 7 Reclaim, 8 Representment, 9 Tokenization, 10 Preauthorization, 11 Guarantee. `paymentType`: 2 Deferred, 3 Recurring, 4 Disbursement, 5 Verification, 6 Retrieval (Instant is referenced but its number is **NOT DOCUMENTED** in the table).
- Disputes/chargebacks: `Dispute` and `Reverse` events, status 10 Reversed, AC112 Disputed, EFT 996.

---

## 6. Notifications

EU (https://docs.trustly.com/api/notifications-overview):

- HTTPS POST, UTF-8, JSON-RPC call: `{"method": "<name>", "params": {"signature", "uuid", "data": {...}}, "version": "1.1"}`. Request content type is **NOT DOCUMENTED** explicitly.
- Method names: `credit`, `debit`, `pending`, `cancel`, `account`, `kyc`, `payoutconfirmation`, `payoutfailed`, `payoutdowngraded`, `verifyAccount`, `assessAccount`, `advice` (MDD).
- Common data fields: `notificationid`, `orderid`, `messageid`, `enduserid`, `amount` (decimal string; a number in payoutfailed/payoutdowngraded examples), `currency`, `timestamp` (`YYYY-MM-DD HH:MM:SS.ffffff+01`), `attributes`.
- Acknowledgement: signed `result` with the same `uuid`, `method` and `data.status` (`OK`; `FAILED` for debit; `CONTINUE`/`FINISH` for kyc).
- Duplicates: "All notifications have a unique notificationid"; retries reuse it, and the merchant must return the same status as the first time.
- Retries: 5 s, 15 s, 45 s, 15 min, 45 min, 90 min, then 3 hours for attempts 7 to 87. AccountAssessment instead: retried "a total of 3 times" unless HTTP 200 OK.
- Signature (sensitive): `params.signature`, Base64 RSA over `method + uuid + serialised(data)`, default SHA-1, or prefixed `alg=RS256;`, `alg=RS384;`, `alg=RS512;`. Trustly reciprocates the algorithm. Optional merchant-requested static custom HTTP headers (may carry a shared secret).

Example C, credit notification (transcribed from https://docs.trustly.com/api/credit-notification):

```json
{
  "method": "credit",
  "params": {
    "signature": "D67hjuMqbsH0Ku ... S16VbzRsw==",
    "uuid": "258a2184-2842-b485-25ca-293525152425",
    "data": {
      "amount": "902.50",
      "currency": "EUR",
      "messageid": "98348932",
      "orderid": "87654567",
      "enduserid": "32123",
      "notificationid": "9876543456",
      "timestamp": "2010-01-20 14:42:04.675645+01",
      "attributes": {}
    }
  },
  "version": "1.1"
}
```

AMER (https://amer.developers.trustly.com/integrate/core-concepts/webhooks-and-events.md):

- POST to `notificationUrl`; headers `Authorization` (Basic, Base64 of `accessId:signature`) and `Content-Type: application/x-www-form-urlencoded`.
- Primary fields: `merchantId`, `merchantReference`, `paymentType`, `transactionType`, `eventId`, `eventType`, `objectId`, `objectType`, `message`, `parentObjectId`, `timeZone` (always `Etc/UTC`), `createdAt` (Unix ms), `status`, `statusMessage`. Conditional: `splitToken`, `errorCode`, `suggestedRetryAmount`, `paymentProviderTransaction.status`, `.statusMessage`, `.reasonCode`, `.reasonCodeMessage`. Example also shows `accountVerified`, `fiCode`, `paymentProviderType`, `accessId`.
- Signature: HMAC-SHA1 (or configured alternative) of the UTF-8 decoded body keyed with `accessKey`, compared with the part after `:` in the decoded Authorization header.
- Ack: HTTP 200 within 3 seconds; otherwise retried "every 5 minutes for 12 hours". Duplicate identification: `eventId` (unique event identifier); explicit dedup guidance is **NOT DOCUMENTED**. Ordering: **NOT DOCUMENTED**.

Example D, AMER event body (transcribed from the signature validation page):

```
merchantId=1002463580&merchantReference=cb180040-7210-4ab9-97b7-415824754802&paymentType=2&transactionType=3&eventId=1002593570&eventType=Authorize&objectId=1002593555&objectType=Transaction&message=&timeZone=Etc%2FUTC&createdAt=1556234040954&accessId=M8RaHgEjBE54zuFYMRQq&paymentProviderTransaction.status=AC100&paymentProviderTransaction.statusMessage=AC100&status=2&statusMessage=Authorized
```

---

## 7. Identifiers

| Identifier                                | Family            | Meaning                                                                                                                                                        |
| ----------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orderid` / `OrderID`                     | EU                | Trustly's unique ID for the order ("The unique ID in our system for your messageid"). For Refund the result `orderid` is "The OrderID of the initial deposit". |
| `messageid` / `MessageID`                 | EU                | Merchant's unique transaction reference (merchant reference). Duplicate gives 637.                                                                             |
| `enduserid` / `EndUserID`                 | EU                | Merchant's ID for the end user                                                                                                                                 |
| `notificationid`                          | EU                | Unique per notification, stable across retries                                                                                                                 |
| `uuid` / `UUID`                           | EU                | Per request; identical request plus UUID is replayed, not reprocessed                                                                                          |
| `accountid`                               | EU                | Trustly bank account token (stable for a previously used account)                                                                                              |
| `reference`                               | EU GetWithdrawals | Trustly reference for the withdrawal; a 10-digit Trustly reference also appears on bank statements                                                             |
| `kycentityid`, `assessmentId`             | EU                | KYC entity and assessment IDs                                                                                                                                  |
| `transactionId` / `objectId`              | AMER              | Trustly transaction ID (max 15 chars); fund movements get new IDs linked to the establishing authorization                                                     |
| `parentObjectId`, `originalTransactionId` | AMER              | Parent / original transaction                                                                                                                                  |
| `merchantReference`                       | AMER              | Merchant reference, unique per merchant and environment (idempotency)                                                                                          |
| `eventId`                                 | AMER              | Unique event ID                                                                                                                                                |
| `paymentProviderTransactionId`            | AMER              | Bank-side transaction ID                                                                                                                                       |

Correlation caveat: for a Refund, whether `payoutconfirmation.orderid` carries the refund's own ID or the original deposit OrderID is **NOT DOCUMENTED** (the notification field says "The unique ID in Trustly's system for this payout", the Refund result returns the deposit OrderID).

---

## 8. Sensitive fields

- Credentials in pasted requests: `Username`, `Password` (EU requests carry the API password in `Data`), `accessId`, `accessKey`, `Authorization` header, `requestSignature`.
- Signatures: `Signature`/`signature`, `alg=...` prefixed values, custom notification headers.
- Tokens and session data: `splitToken`, checkout `url` (contains `SessionID`), `AzuraSessionID`, `NotificationURL` (may contain a secret path).
- Personal and KYC data: `personid`, `NationalIdentificationNumber`, `firstname`/`Firstname`, `lastname`, `name`, `dob`/`DateOfBirth`, `PlaceOfBirth`, `street`, `address`, `zipcode`, `city`, `country`, `Nationality`, `Email`, `MobilePhone`, `IP`, `RecipientInformation`, `SenderInformation`.
- Bank data: `accountid`, `descriptor`, `lastdigits`, `bank`, `clearinghouse`, IBAN inside `assessAccount` `value` (masked in example), `fiCode`.

---

## 9. Structural detection hints

Trustly EU native (strong):

1. JSON with top-level `"version": "1.1"` and either `method` + `params` (notification or request) or `result`/`error`.
2. Notification `method` in the lowercase set above and `params.data.notificationid` present; `params.signature` Base64 (optionally `alg=RS256;` prefixed); `params.uuid` in 8-4-4-4-12 hex.
3. Requests use capitalised `params.Signature`, `params.UUID`, `params.Data` with `Username`, `Password`, `MessageID`, `EndUserID`, `NotificationURL`.
4. Errors: `error.name == "JSONRPCError"`, numeric `code` in 6xx/7xx (plus 102), `message` beginning `ERROR_`.
5. Timestamp shape `2010-01-20 14:42:04.675645+01`; hosts `test.trustly.com/api/1`, `api.trustly.com/1`, `checkout.trustly.com`.

Trustly AMER (strong):

1. Form-encoded body with `merchantId`, `eventId`, `eventType`, `objectId`, `objectType=Transaction`, `timeZone=Etc/UTC` (or `Etc%2FUTC`) and dotted keys `paymentProviderTransaction.status`.
2. Status values `SW0xx`, `UCxx`, `AC1xx`, `SE0x`; REST errors `{"errors":[{"domain","code","location","message","occurredAt"}]}`; hosts `sandbox.trustly.one`, `api.trustly.one`.

Distinguishing from payabl.-wrapped Trustly: payabl. notifications/responses are URL-encoded `key=value` strings with `transactionid`, `errorcode`/`status`, `errormessage`, `payment_method` and payabl. hosts. payabl.'s APM table lists Trustly codes `141602`, `141603`, `141615`, `141616`, `141620`, `141624`, `141638` (from PandaPayLens `payabl.md` section 4.8, citing payabl. docs). These look like the prefix `141` plus the Trustly JSON-RPC number (602, 603, 615, 616, 620, 624, 638 have matching meanings); this mapping is an inference, not stated by either provider. A payabl.-wrapped payload must be routed to the payabl. adapter; the Trustly adapter should only claim JSON-RPC envelopes or AMER event bodies.

Versus other supported providers: Stripe (`object`, `evt_` IDs), Adyen (`notificationItems`, `pspReference`), PayPal (`event_type`, `resource`), Mollie/Square/Checkout.com/Braintree (REST JSON or Braintree XML signatures) do not use a JSON-RPC 1.1 envelope or `notificationid`. Overlap with the other high-risk candidates was not assessed from their payloads in this file.

---

## 10. Limitations, ambiguities and documentation inconsistencies

1. `docs.trustly.com` blocks non-browser clients (HTTP 403); content is public in a browser. Pages show only relative update dates and a "© 2024" footer.
2. Error lists are per method and "can be added and ... removed without notice"; descriptions for the same code differ between pages (e.g. 624 means bank account number, IBAN or AccountID depending on page). An adapter needs an `unknown` fallback.
3. EU error example is invalid JSON (missing closing brace); KYC and AccountAssessment examples contain `//` comments and trailing commas. A tolerant parser should repair or warn.
4. `verifyAccount` and `assessAccount` OK-response examples use `"method": "account"`.
5. `assessAccount` success/fail examples use camelCase keys (`orderId`, `messageId`, `notificationID`, `accountId`) while its "failed without result" example and all other notifications use lowercase.
6. Numbers may be strings or numbers (`amount` is `"902.50"` in credit, `40.91` in payoutfailed; `orderid` numeric in verifyAccount).
7. HTTP status for EU errors is NOT DOCUMENTED; JSON-RPC error `uuid`/`method` are documented as `"null"` (quoted).
8. AMER webhook page states `Content-Type: application/x-www-form-urlencoded` but shows the Authorize example as JSON; the signature page uses a form-encoded body. Treat both as possible.
9. AMER event `status` is "Integer" in the webhook table but "string" in the Failed reference; HTTP code lists differ between the API overview (adds 403, 429) and the status-codes page (adds 503).
10. AMER page groups UK Trustly Direct Debit codes under North America docs; ACH R01 to R84 not enumerated; `paymentType` number for Instant not listed.
11. `payoutfailed` errorcode values are not enumerated; `payoutfailed`, `payoutdowngraded`, `payoutconfirmation`, `account`, `verifyAccount`, `assessAccount` and detailed cancel fields are opt-in, and payoutfailed/payoutdowngraded are production only, so their absence in a pasted log means nothing.
12. Notification ordering is not guaranteed (pending/account/credit any order; credit after payoutconfirmation for returned payouts; debit days after credit).
13. MDD scheme detail strings (116) are referenced but not transcribed here; SEPA reason codes are delegated to EPC guidance.
14. Regional: EU products in "15 markets"; Pay N Play only SE, FI, EE, NL; supported holding currencies CZK, DKK, EUR, GBP, HUF, NOK, PLN, RON, SEK (HUF without decimals); AMER is US and Canada.

---

## 11. Proposed capability statuses

| Capability       | Proposed                               | Justification                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **supported**                          | 74 named EU JSON-RPC codes plus AMER SW/UC/AC/SE, internal, extended decline and return codes, all first-party with clear meanings. Per-page variation and "may change without notice" handled with an `unknown` fallback.            |
| paymentResponses | **supported** (EU), **limited** (AMER) | EU result and error envelopes are fully exemplified and stable. AMER has a schema but no transcribed error example and two error shapes.                                                                                              |
| webhookParsing   | **supported** (EU), **limited** (AMER) | EU notifications have a fixed envelope, named methods, `notificationid` and examples for every type; signature verification stays out of scope. AMER has a field table and one form-encoded example, with content-type inconsistency. |
| timeline         | **limited**                            | Clear semantics (pending, credit, debit, cancel, payoutconfirmation, payoutfailed; AMER status 0 to 14 and event types), but ordering is not guaranteed, several notifications are opt-in, and reversals can arrive days later.       |
| correlation      | **supported** (EU), **limited** (AMER) | Every EU notification carries `orderid` and `messageid`; `notificationid` deduplicates. Refund-to-payout ID semantics are ambiguous. AMER relies on `objectId`, `parentObjectId` and `merchantReference` with less example coverage.  |
