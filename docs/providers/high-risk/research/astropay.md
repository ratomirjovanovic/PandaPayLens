# AstroPay (adapter id `astropay`): high-risk candidate research

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified** (with scope limits, see section 0 and section 12)
- Method: `developers.astropay.com` is a client-rendered Docusaurus site (every URL returns the same 3.8 KB HTML shell and there is no `llms.txt`). Page URLs were taken from the public `sitemap.xml`. The page text was read from the site's own public content bundles (`/assets/js/<chunk>.js`, located through the public route manifest in `main.js`), turned into plain text locally and read in full. Business pages were read with a web fetch. Nothing was executed, no login was used.

---

## 0. Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` for the merchant APIs on the public developer portal (Checkout, Wallet on File, Wallet Payouts/Cashouts V1, Direct Payment, Direct Withdrawal, QR Payments). Platform (Partners/BaaS) API documented but out of first scope.                                                                                                                                                                                                                                                                                                                                                                            |
| Classification                     | `wallet`, `alternative_payment_method`, `gateway`. `orchestration` only in AstroPay's own marketing sense (unclear). Not documented: `acquiring`, `payment_facilitator`, `merchant_account_intermediary`. `card_processing`: unclear (Checkout can show a card form; the processing role is not documented).                                                                                                                                                                                                                                                                                                                     |
| Documented sectors                 | Gaming (business pages, UK terms), marketplace, payroll (business pages); retail, gaming, digital services, subscription (AstroPay blog, 2025-10-24).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Documentation access               | **Public** for the sitemap-listed sections. Credentials, merchant panel and production URLs need onboarding. Unlisted `/docs/private/...` sections exist in the route manifest (wallet-checkout deposits, regulated-gambling, legacy-br, local-processing, affiliates-api); they are not linked from navigation or the sitemap and were **not read or used**. The `/api` reference page is client-rendered and was not examined.                                                                                                                                                                                                 |
| Documented codes (distinct values) | Merchant APIs: Checkout refund errors 6; Wallet on File auth-capture 7, refund 6 (same 6 as Checkout), account linking 10 keys (15 rows), inline example `error` values 3; Cashouts V1 13 rows (identified by HTTP status + description, 4 HTTP statuses); Direct Payment/Withdrawal (identical pages) 6 `error` values, 5 `internal_term` values, 2 `reason_code` values, 6 document-status descriptions; Direct Withdrawal cancel reasons 8; QR/OneTouch auth errors 3 `error` + 2 `internal_term`. Platform API (out of first scope): general 13, payouts 17, transfers 12, savings/users 5, card `status_reason` examples 2. |
| Biggest limitation                 | AstroPay runs several product families with **different identifiers, status vocabularies and signature schemes** (HMAC `Signature` header vs RSA `Partner-Signature`), and the classic wallet Deposit ("OneTouch" deposit with `merchant_deposit_id`) docs are only in the unlisted private section. Error tables are "most common" lists, not exhaustive.                                                                                                                                                                                                                                                                       |
| White-label note                   | AstroPay exposes its own formats. Direct Payment routes to unnamed local providers ("automatic provider selection and fallback"); no first-party source names an underlying gateway. The Brazil page says AstroPay acts "as a white label gateway" only in the sense that the merchant shows the PIX data in its own UI.                                                                                                                                                                                                                                                                                                         |

---

## 1. Sources

All read on 2026-10-25. Developer pages were read from their content bundles (see method).

| URL                                                                                                                                          | What it covers                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| https://developers.astropay.com/sitemap.xml                                                                                                  | Public page list                                                                                     |
| https://developers.astropay.com/assets/js/main.dddab58c.js                                                                                   | Route manifest and navbar (used to locate content bundles; shows unlisted `/docs/private/` routes)   |
| https://developers.astropay.com/docs/accept-astropay/overview                                                                                | Accept AstroPay product list                                                                         |
| https://developers.astropay.com/docs/accept-astropay/checkout/overview                                                                       | Checkout modes (Embedded, Offsite), flow                                                             |
| https://developers.astropay.com/docs/accept-astropay/checkout/getting-started                                                                | Environments, Basic/Bearer auth, token endpoint, callback URL rules                                  |
| https://developers.astropay.com/docs/accept-astropay/checkout/payment-lifecycle/overview                                                     | Shared lifecycle, `payment_external_id`                                                              |
| https://developers.astropay.com/docs/accept-astropay/checkout/payment-lifecycle/creating-payments                                            | `POST /v1/payments` request/response                                                                 |
| https://developers.astropay.com/docs/accept-astropay/checkout/payment-lifecycle/callback-and-status                                          | Checkout statuses, callback payload, RSA signature reference                                         |
| https://developers.astropay.com/docs/accept-astropay/checkout/payment-lifecycle/checking-payment-status                                      | `GET /v1/payments/{paymentId}?method=CHECKOUT`                                                       |
| https://developers.astropay.com/docs/accept-astropay/checkout/payment-lifecycle/refunding-payments                                           | Refund request/response, refund error table                                                          |
| https://developers.astropay.com/docs/accept-astropay/wallet-on-file/getting-started                                                          | Account linking + funds pulling concept                                                              |
| https://developers.astropay.com/docs/accept-astropay/wallet-on-file/funds-pulling                                                            | Authorize, capture, reversal, auth-capture; WoF status table                                         |
| https://developers.astropay.com/docs/accept-astropay/wallet-on-file/check-transaction-status                                                 | WoF status query examples                                                                            |
| https://developers.astropay.com/docs/accept-astropay/wallet-on-file/refund-transactions                                                      | WoF refunds                                                                                          |
| https://developers.astropay.com/docs/accept-astropay/wallet-on-file/errors                                                                   | WoF error tables (auth-capture, refund, account linking)                                             |
| https://developers.astropay.com/docs/accept-astropay/wallet-on-file/webhooks                                                                 | WoF webhook overview (no payload)                                                                    |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/cashouts-v1/getting-started                                              | Cashout V1 endpoint, statuses, 24 h expiry                                                           |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/cashouts-v1/request-parameters                                           | Cashout request/response                                                                             |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/cashouts-v1/callbacks                                                    | Cashout callback, HMAC `Signature` header                                                            |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/cashouts-v1/check-cashout-status                                         | Cashout status endpoints                                                                             |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/cashouts-v1/error-codes                                                  | Cashout error table                                                                                  |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/cashouts-v1/onboarding-cashout                                           | User onboarding + cashout via merchant-api                                                           |
| https://developers.astropay.com/docs/accept-astropay/wallet-payouts/closed-loop-transactions                                                 | `user_id` / `deposit_user_id` closed loop                                                            |
| https://developers.astropay.com/docs/accept-astropay/qr-payments/introduction                                                                | QR API, environments                                                                                 |
| https://developers.astropay.com/docs/accept-astropay/qr-payments/security-authentication                                                     | API key headers, HMAC request signature, auth errors, callback source IPs                            |
| https://developers.astropay.com/docs/accept-astropay/qr-payments/callbacks                                                                   | QR deposit callback                                                                                  |
| https://developers.astropay.com/docs/accept-astropay/qr-payments/payment-code-api/create-payment-code                                        | Payment code create                                                                                  |
| https://developers.astropay.com/docs/accept-astropay/qr-payments/payment-code-api/get-payment-code-status                                    | Payment code status                                                                                  |
| https://developers.astropay.com/docs/payment-processing/overview                                                                             | Direct Payment / Direct Cashouts overview                                                            |
| https://developers.astropay.com/docs/payment-processing/direct-payment/getting-started                                                       | `POST /merchant/v1/payment/init`, "new version" note                                                 |
| https://developers.astropay.com/docs/payment-processing/direct-payment/request-parameters                                                    | Direct Payment request fields                                                                        |
| https://developers.astropay.com/docs/payment-processing/direct-payment/callbacks                                                             | Direct Payment callback, 4 retries                                                                   |
| https://developers.astropay.com/docs/payment-processing/direct-payment/error-codes                                                           | Direct Payment errors                                                                                |
| https://developers.astropay.com/docs/payment-processing/direct-payment/supported-countries/brazil                                            | PIX request/response example, CANCELLED not final, limits                                            |
| https://developers.astropay.com/docs/payment-processing/direct-withdrawal/getting-started                                                    | `POST /merchant/v2/cashout/init`, auth headers, statuses                                             |
| https://developers.astropay.com/docs/payment-processing/direct-withdrawal/request-parameters                                                 | Withdrawal request/response                                                                          |
| https://developers.astropay.com/docs/payment-processing/direct-withdrawal/callbacks                                                          | Withdrawal callback and cancel descriptions                                                          |
| https://developers.astropay.com/docs/payment-processing/direct-withdrawal/status                                                             | Withdrawal status endpoints                                                                          |
| https://developers.astropay.com/docs/payment-processing/direct-withdrawal/cancel-reasons                                                     | Cancel reasons by country                                                                            |
| https://developers.astropay.com/docs/payment-processing/direct-withdrawal/error-codes                                                        | Withdrawal errors (same as Direct Payment page)                                                      |
| https://developers.astropay.com/docs/platform/introduction                                                                                   | Platform (Partners API) scope: build-your-own wallet                                                 |
| https://developers.astropay.com/docs/platform/callbacks/                                                                                     | Platform notifications (deposit, withdrawal, transfers, card, payout, payment link), 2xx within 10 s |
| https://developers.astropay.com/docs/platform/callbacks/signature                                                                            | RSA signature headers and certificate endpoint                                                       |
| https://developers.astropay.com/docs/platform/callbacks/webhooks                                                                             | Event-per-path webhooks (`POST {base}/{eventName}`)                                                  |
| https://developers.astropay.com/docs/platform/errors-codes                                                                                   | Platform error table                                                                                 |
| https://developers.astropay.com/docs/platform/payments                                                                                       | Get Payment Status field reference                                                                   |
| https://developers.astropay.com/docs/platform/payout                                                                                         | Payout error tables (read error and status sections)                                                 |
| https://developers.astropay.com/docs/platform/transfer                                                                                       | Two-phase transfer statuses and errors (read error and status sections)                              |
| https://developers.astropay.com/docs/platform/savings-account                                                                                | Savings error codes (error sections only)                                                            |
| https://developers.astropay.com/docs/platform/users-management                                                                               | User error codes (error sections only)                                                               |
| https://www.astropay.com/business                                                                                                            | Products, sectors (use-case links), licensed entities, countries                                     |
| https://www.astropay.com/business/accept-astropay                                                                                            | Accept AstroPay products, sectors, reach                                                             |
| https://www.astropay.com/use-cases/gaming                                                                                                    | Gaming use case                                                                                      |
| https://www.astropay.com/blog/astropay-wallet-now-available-on-adobe-commerce-empowering-merchants-to-reach-millions-across-emerging-markets | Sector sentence (2025-10-24)                                                                         |
| https://www.astropay.com/united-kingdom/t-c-agreement-for-legal-entities                                                                     | UK merchant terms: "Gaming Operator", prohibited uses                                                |
| https://status.astropay.com/                                                                                                                 | Service status                                                                                       |

---

## 2. Qualification gate

| #   | Item                                      | Answer               | Evidence                                                                                                                                                                                          |
| --- | ----------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active                    | yes                  | status.astropay.com: "All Systems Operational"; business page claims "500+ businesses".                                                                                                           |
| 2   | Payment service operational               | yes                  | status.astropay.com lists Payments, API, Payments API, Platform API as Operational.                                                                                                               |
| 3   | Developer docs accessible                 | yes                  | developers.astropay.com sections listed in sitemap are public. Credentials come from the merchant backoffice. Unlisted `/docs/private/` sections not used (see section 0).                        |
| 4   | API families/versions identified          | yes                  | Path-versioned: `/v1/payments`, `/v1/wof/payments/*`, `/merchant/v1/cashout`, `/merchant/v1/payment/init`, `/merchant/v2/cashout/init`, `/merchant/v1/payment-code`, `/public/v1/...`. Section 4. |
| 5   | Offline-examinable formats                | yes                  | JSON request, response, error and callback examples on each family page.                                                                                                                          |
| 6   | Sectors documented by provider            | yes (business level) | Business pages link Gaming, Marketplace, Manage payroll; blog names retail, gaming, digital services, subscription. Developer docs name no sectors.                                               |
| 7   | Regional/regulatory limits                | yes (partial)        | Licensed entities (FCA EMI, Danish FSA, Isle of Man FSA, Brazilian Central Bank); country-specific limits (Brazil PIX limits, CPF rules).                                                         |
| 8   | Diagnostic value                          | yes                  | Error tables per family, status enums, callback payloads with final statuses, cancel reasons.                                                                                                     |
| 9   | Own formats, not white-label              | yes                  | Own field vocabulary (`deposit_external_id`, `merchant_cashout_id`, `internal_term`); no underlying gateway named by a first-party source.                                                        |
| 10  | No credentials needed to analyze examples | yes                  | All examples are on public pages.                                                                                                                                                                 |

Outcome: items 1-5, 8, 9, 10 are yes, so **documentation_verified**.

---

## 3. Classification and documented sectors

| Classification               | Evidence                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wallet`                     | Cashout V1 getting-started: "AstroPay being a e-wallet"; Wallet on File links the user's AstroPay wallet.                                                 |
| `alternative_payment_method` | Checkout `requested_payment_method` values `ASTROPAY` (wallet) and `QA` (QR); Direct Payment Brazil method PIX (code `IX`).                               |
| `gateway`                    | Direct Payment overview: payments "through AstroPay's gateway, with automatic provider selection and fallback mechanisms".                                |
| `orchestration` (unclear)    | Checkout overview: AstroPay "manages payment orchestration, compliance, and settlement". This is internal routing, not a merchant-facing multi-PSP layer. |
| `card_processing` (unclear)  | Checkout `CARD` value shows a "Credit/debit card form only"; who acquires is NOT DOCUMENTED.                                                              |

Sectors (provider statements only):

| Sector                                         | Source                                                                               | Short quote                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Gaming                                         | https://www.astropay.com/use-cases/gaming                                            | "Instant deposit and withdrawal"; players "bet in their own currency"                            |
| Gaming                                         | https://www.astropay.com/united-kingdom/t-c-agreement-for-legal-entities             | "Gaming Operator": "an online gaming activities provider, or other services, authorised by us"   |
| Marketplace, payroll                           | https://www.astropay.com/business, https://www.astropay.com/business/accept-astropay | Use-case links "Gaming", "Marketplace", "Manage payroll"                                         |
| Retail, gaming, digital services, subscription | Adobe Commerce blog (2025-10-24)                                                     | "well-suited for businesses in retail, gaming, digital services, and subscription-based sectors" |

Eligibility depends on jurisdiction, licensing and underwriting; approval for one sector does not imply another. The UK terms forbid using the payment services for illegal products and for loans. The developer docs contain no sector rules. "Gaming" is AstroPay's word; it is not documented as including or excluding any specific gambling vertical.

Regional and regulatory: licensed entities Larstal Limited (FCA EMI), Larstal Denmark ApS (Danish FSA EMI), AstroPay Global (IOM) Limited (IOM FSA money transmission), AP Digital (IOM) Limited (IOM convertible virtual currency registration), Astro Instituicao de Pagamento Ltda (Brazilian Central Bank) (business page footer). Checkout targets "Latin America and emerging markets". Direct Payment public country pages: Argentina, Brazil, Mexico; Direct Withdrawal: Argentina, Brazil, Chile, Colombia, Ecuador, India, Mexico, Peru. Brazil: CPF must match the payer (third-party payments blocked), PIX payment valid 30 minutes, per-payment max BRL 50,000, daily/monthly per-user limits (USD 15,000 / 30,000 basis). Cashouts are not reversible.

---

## 4. API families and versions in scope

| Family                              | Host (sandbox / prod)                                                                              | Endpoints                                                                                                                           | Auth                                                                                                            | First scope?       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| Checkout (Embedded/Offsite)         | `partners-api-sandbox.astropay.com` / `partners-api.astropay.com`                                  | `POST /v1/payments`, `GET /v1/payments/{id}?method=CHECKOUT`, `POST /v1/payments/refund`                                            | Basic or Bearer (`POST /v1/partners/oauth/token`)                                                               | **Yes**            |
| Wallet on File                      | NOT DOCUMENTED on these pages (relative paths only)                                                | `POST /v1/wof/payments/authorize`, `/capture`, `/reversal`, `/auth-capture`, `/refund`; `GET /v1/wof/payments/{payment_id}`         | Partner auth (not detailed on WoF pages)                                                                        | **Yes**            |
| Cashouts V1 (OneTouch API)          | `onetouch-api-sandbox.astropay.com` / `onetouch-api.astropay.com`                                  | `POST /merchant/v1/cashout`, `GET merchant/v1/cashout/{id}/status`, `GET merchant/v2/cashout/external/{merchant_cashout_id}/status` | API key + HMAC `Signature` (error table mentions both)                                                          | **Yes**            |
| Direct Payment                      | NOT DOCUMENTED on the payment pages (the withdrawal page uses `onetouch-api-sandbox.astropay.com`) | `POST /merchant/v1/payment/init`                                                                                                    | NOT DOCUMENTED on the payment pages; the withdrawal page requires `Merchant-Gateway-Api-Key` + HMAC `Signature` | **Yes**            |
| Direct Withdrawal                   | `onetouch-api-sandbox.astropay.com`                                                                | `POST /merchant/v2/cashout/init`, `GET /merchant/v2/cashout/{id}/status`, `.../external/{merchantCashoutId}/status`                 | same                                                                                                            | **Yes**            |
| QR Payments                         | `merchant-api-stg.astropay.com` / `merchant-api.astropay.com`; payment-code on onetouch-api        | `/merchant/v1/payment-code`, `/public/v1/paymentCode/byApi/transaction`, POS API                                                    | `Merchants-Backend-Api-Key` (+ `Signature` for POST)                                                            | Later              |
| Onboarding + cashout (merchant-api) | `merchant-api(-stg).astropay.com`                                                                  | `POST /public/v1/user/onboarding`, `POST /public/v1/merchant/cashout`                                                               | `Merchants-Backend-Api-Key`                                                                                     | Later              |
| Platform (Partners API, BaaS)       | NOT DOCUMENTED here                                                                                | users, accounts, transfers, payouts, cards                                                                                          | Partner/User auth; RSA-signed webhooks                                                                          | Out of first scope |

Versioning is only in the path (`v1`, `v2`). The Direct Payment page warns that an older Direct API exists and is incompatible ("AstroPay Direct has changed!"); its format is not on public pages. Implement first: Checkout + WoF payment object (shared shape), Cashout V1 and Direct Payment/Withdrawal callbacks, and the `error`/`description`/`internal_term` error envelope.

---

## 5. Formats

- Content type: JSON for requests, responses and callbacks in all merchant families. Token endpoint request is `application/x-www-form-urlencoded`. The QR introduction says requests are form-encoded, yet every QR example is JSON (inconsistency).
- Callback `Content-Type` header: NOT DOCUMENTED (bodies are JSON).
- HTTP status carries the error class (400, 401, 404, 408, 412, 500); 412 is the usual business error.

Main fields:

| Family                              | Response/callback status field                                           | Identifier fields                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checkout create                     | `status`                                                                 | `payment_external_id`, `redirect_url`, `fallback_url`                                                                                                                                                                          |
| Checkout callback                   | `payment_status`                                                         | `payment_external_id`, `merchant_payment_id`, `merchant_id`, `payment_info.payment_amount.{currency,value}`, `merchant_notification_url`                                                                                       |
| Checkout/WoF payment object         | `status`, `payment_transactions[].type`, `payment_transactions[].result` | `payment_id`, `merchant_payment_id`, `payment_transaction_id`; amounts `amount`, `captured_amount`, `reversed_amount`, `refunded_amount`; flags `is_authorization_completed`, `is_reversible`/`is_reversable`, `is_refundable` |
| Cashout V1 response                 | `status`                                                                 | `cashout_id` (integer), `merchant_cashout_id`, `user_id`                                                                                                                                                                       |
| Cashout V1 callback                 | `status`                                                                 | `merchant_cashout_id`, `cashout_user_id`, `cashout_id`, `end_status_date`                                                                                                                                                      |
| Direct Payment response             | `status`                                                                 | `merchant_deposit_id`, `deposit_external_id`, `payment_detail.{qr,qr_image}`                                                                                                                                                   |
| Direct Payment callback             | `status`                                                                 | `deposit_external_id`, `merchant_deposit_id`, `merchant_user_id`, `end_status_date`                                                                                                                                            |
| Direct Withdrawal response/callback | `status`, `description` (cancel reason)                                  | `merchant_cashout_id`, `cashout_external_id`, `end_status_date`                                                                                                                                                                |
| QR callback                         | `status`                                                                 | `deposit_external_id`, `payment_code_external_id`, `amount`, `currency`, `merchant_amount`, `merchant_currency`, `user_data{...}`                                                                                              |
| Errors (OneTouch/merchant-api)      | `error`                                                                  | plus `description`, `internal_term`, optional `message`, `detail{field: msg}`, `reasons[]{reason_code, description, fields[]}`                                                                                                 |
| Errors (WoF examples)               | `error` (lowercase)                                                      | plus `message`                                                                                                                                                                                                                 |

Example A, Direct Payment callback, transcribed from https://developers.astropay.com/docs/payment-processing/direct-payment/callbacks:

```json
{
  "deposit_external_id": "P3t1kLkmndd8jjPIkkqCXLwz445tujyGxxU1Lopj",
  "merchant_deposit_id": "TD-001",
  "merchant_user_id": "TU-001",
  "status": "APPROVED",
  "end_status_date": "2023-01-10T01:57:39"
}
```

Example B, Direct Payment field validation error (412), transcribed from https://developers.astropay.com/docs/payment-processing/direct-payment/error-codes:

```json
{
  "error": "merchant_gateway_fields_validation_error",
  "description": "User data validation error",
  "reasons": [
    {
      "reason_code": "required_fields",
      "description": "The fields are required.",
      "fields": ["first_name"]
    }
  ],
  "internal_term": "FIELDS_VALIDATION_ERROR"
}
```

---

## 6. Codes

Categories and retry classes below are **suggestions** for PandaPayLens, not AstroPay statements. Where AstroPay gives an action, it is reflected. All lists are described by AstroPay as the most common ones; unknown values must fall back to `unknown`.

### 6a. Status values

| Family                  | Field                       | Values (as documented)                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout payment        | `status` / `payment_status` | `PENDING`; final: `COMPLETED`, `EXPIRED` (failed, expired or cancelled), `REJECTED`. After refund: `PARTIALLY_REFUNDED`, `REFUNDED`.                                                                                                                                                                                                                                                         |
| Wallet on File payment  | `status`                    | `PENDING`, `REJECTED`, `COMPLETED`, `AUTHORIZED`, `CAPTURED`, `PARTIALLY_CAPTURED`, `REVERSED`, `PARTIALLY_REVERSED`, `REFUNDED`, `PARTIALLY_REFUNDED`                                                                                                                                                                                                                                       |
| Payment transaction     | `type` / `result`           | type `AUTHORIZATION`, `CAPTURE`, `REVERSAL`, `REFUND`; result `OK`, `FAILED` (refund page), `APPROVED` (status examples)                                                                                                                                                                                                                                                                     |
| Cashout V1              | `status`                    | `PENDING` (no matching AstroPay user yet, max 24 h), `APPROVED` (final, credited), `CANCELLED` (final, user did not register)                                                                                                                                                                                                                                                                |
| User onboarding         | `status`                    | `PENDING`, `COMPLETED`                                                                                                                                                                                                                                                                                                                                                                       |
| Direct Payment          | `status`                    | `PENDING` (create), `APPROVED` (callback), `CANCELLED` (Brazil: not final, can become `APPROVED` after 30 min). Full enum NOT DOCUMENTED.                                                                                                                                                                                                                                                    |
| Direct Withdrawal       | `status`                    | `CREATED` (create example only), `PENDING`, `APPROVED` (final), `CANCELLED` (final, with `description`)                                                                                                                                                                                                                                                                                      |
| QR payment code         | `status` / `qr_status`      | `PENDING`, `APPROVED`, `CANCELLED`; `qr_status` `ACTIVE`, `INACTIVE`, `DEACTIVATED`                                                                                                                                                                                                                                                                                                          |
| Platform (out of scope) | various                     | deposit/withdrawal/card movement `CREATED`, `PENDING`, `REJECTED`, `APPROVED`; payout `CREATED`, `PENDING`, `FOR_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`; payout refund same minus `FOR_REVIEW`; outgoing scheme transfer `PENDING`, `COMPLETED`, `FAILED`; two-phase transfer `HOLD`, `RELEASED`, `COMPLETED`, `CANCELLED`, `FAILED`; payment link `APPROVED`, `REJECTED`, `CANCELLED` |

### 6b. Error and response codes

**Checkout refund and Wallet on File refund** (`error`, HTTP 412; identical tables):

| Code                           | Meaning (paraphrase)                | Category             | Retry               |
| ------------------------------ | ----------------------------------- | -------------------- | ------------------- |
| `PAYMENT_NOT_FOUND`            | No such payment                     | invalid_request      | do_not_retry        |
| `INVALID_AUTHORIZATION_STATUS` | Authorization not closed for refund | invalid_request      | retry_conditionally |
| `REFUND_AMOUNT_EXCEEDED`       | Refund above captured amount        | invalid_amount       | do_not_retry        |
| `USER_NOT_FOUND`               | Wallet user missing                 | invalid_request      | manual_review       |
| `PAYMENT_GENERIC_ERROR`        | Could not debit merchant balance    | insufficient_funds   | manual_review       |
| `PAYMENT_PROCESSING_ERROR`     | Wallet refund processing failed     | provider_unavailable | retry_conditionally |

**Wallet on File auth-capture** (`error`):

| Code                          | HTTP | Meaning                           | Category              | Retry                    |
| ----------------------------- | ---- | --------------------------------- | --------------------- | ------------------------ |
| `PARTNER_CONFIGURATION_ERROR` | 412  | Payments disabled for merchant    | configuration         | do_not_retry             |
| `DUPLICATE_PAYMENT`           | 412  | Payment already exists            | duplicate_request     | do_not_retry             |
| `USER_NOT_FOUND`              | 412  | User missing                      | invalid_request       | do_not_retry             |
| `PAYMENT_PROCESSING_ERROR`    | 412  | Wallet payment processing failed  | provider_unavailable  | retry_conditionally      |
| `PAYMENT_GENERIC_ERROR`       | 400  | Generic payment error             | unknown               | unknown                  |
| `INSUFFICIENT_BALANCE`        | 412  | Wallet balance too low            | insufficient_funds    | customer_action_required |
| `ACCOUNT_TOKEN_NOT_FOUND`     | 400  | Account token unknown for partner | authentication_failed | customer_action_required |

Inline WoF example values (lowercase, with `message`): `bad_request` (invalid_request, do_not_retry), `not_found` (invalid_request, do_not_retry), `insufficient_balance` (insufficient_funds, customer_action_required).

**Wallet on File account linking** (10 keys; some keys repeat with different messages):

| Code                             | HTTP | Meaning(s)                                                       | Category                              | Retry                    |
| -------------------------------- | ---- | ---------------------------------------------------------------- | ------------------------------------- | ------------------------ |
| `ACCOUNT_TOKEN_NOT_FOUND`        | 400  | Token unknown                                                    | authentication_failed                 | customer_action_required |
| `PARTNER_LINK_ACCOUNT_ERROR`     | 400  | No active link; partner not allowed to link; user not authorized | configuration / authentication_failed | manual_review            |
| `BAD_REQUEST`                    | 400  | User not linked with partner                                     | authentication_required               | customer_action_required |
| `PARTNER_SCOPE_ERROR`            | 400  | Scope not allowed for partner                                    | configuration                         | do_not_retry             |
| `REDIRECT_URL_ERROR`             | 400  | Bad URL format                                                   | invalid_request                       | do_not_retry             |
| `USER_NOT_HAVE_WALLET`           | 412  | No active wallet                                                 | payment_method_unavailable            | customer_action_required |
| `TRUSTED_DEVICE_CHALLENGE_ERROR` | 412  | Not the trusted device                                           | authentication_failed                 | customer_action_required |
| `AUTHORIZATION_NOT_FOUND`        | 400  | Authorization request unknown                                    | invalid_request                       | do_not_retry             |
| `CONFIRM_INVALID_USER`           | 400  | Session user differs from request                                | authentication_failed                 | customer_action_required |
| `INVALID_AUTHORIZATION_CODE`     | 400  | Code invalid, expired, wrong partner, or no user                 | authentication_failed                 | customer_action_required |

**Cashouts V1** (no machine code; identified by HTTP status + description text):

| HTTP | Description (paraphrase)                  | Category              | Retry                    |
| ---- | ----------------------------------------- | --------------------- | ------------------------ |
| 400  | Invalid request body                      | invalid_request       | do_not_retry             |
| 401  | Merchant not authorized (bad API key)     | authentication_failed | do_not_retry             |
| 404  | Cashout not found                         | invalid_request       | do_not_retry             |
| 404  | Merchant configuration missing            | configuration         | manual_review            |
| 412  | Accounting currency not configured        | configuration         | manual_review            |
| 412  | Invalid signature                         | configuration         | do_not_retry             |
| 412  | Cashouts disabled for merchant            | configuration         | manual_review            |
| 412  | Cashout already exists (same merchant id) | duplicate_request     | do_not_retry             |
| 412  | Invalid AstroPay `user_id`                | invalid_request       | do_not_retry             |
| 412  | `merchant_user_id` blocked                | fraud_or_risk         | manual_review            |
| 412  | Merchant balance too low                  | insufficient_funds    | retry_conditionally      |
| 412  | Missing phone number                      | invalid_request       | do_not_retry             |
| 412  | Invalid phone number                      | invalid_request       | customer_action_required |

**Direct Payment and Direct Withdrawal** (identical pages):

| Value                                       | Field                | HTTP | Meaning                                                                      | Category             | Retry                                                 |
| ------------------------------------------- | -------------------- | ---- | ---------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `commons_invalid_request`                   | `error`              | 400  | Field values invalid; see `detail`                                           | invalid_request      | do_not_retry                                          |
| `merchant_gateway_payment_creation_timeout` | `error`              | 408  | Creation took too long                                                       | network_or_timeout   | safe_to_retry_technical_request (AstroPay: try again) |
| `merchant_gateway_generic_error`            | `error`              | 412  | Payment mode disabled for merchant (also used for invalid signature, see QR) | configuration        | manual_review                                         |
| `commons_internal_error`                    | `error`              | 500  | Internal error                                                               | provider_unavailable | retry_conditionally                                   |
| `merchant_gateway_fields_validation_error`  | `error`              | 412  | User data validation failed; see `reasons`                                   | invalid_request      | customer_action_required                              |
| `merchant_gateway_user_limit_exceeded`      | `error`              | 412  | User transaction limits reached                                              | invalid_amount       | do_not_retry                                          |
| `invalid_request`                           | `internal_term`      | 400  | Pairs with `commons_invalid_request`                                         | invalid_request      | do_not_retry                                          |
| `PAYMENT_CREATION_TIMEOUT`                  | `internal_term`      | 408  | Pairs with timeout                                                           | network_or_timeout   | safe_to_retry_technical_request                       |
| `INVALID_CONFIGURATION`                     | `internal_term`      | 412  | Pairs with generic error                                                     | configuration        | manual_review                                         |
| `FIELDS_VALIDATION_ERROR`                   | `internal_term`      | 412  | Pairs with validation error                                                  | invalid_request      | customer_action_required                              |
| `USER_LIMITS_EXCEEDED`                      | `internal_term`      | 412  | Pairs with limit error                                                       | invalid_amount       | do_not_retry                                          |
| `document_format_invalid`                   | `reason_code`        | 412  | CPF problem; status in `description`                                         | invalid_request      | see next rows                                         |
| `required_fields`                           | `reason_code`        | 412  | Missing fields listed in `fields`                                            | invalid_request      | do_not_retry                                          |
| `NOT_FOUND` / `INVALID`                     | reason `description` | 412  | CPF unknown to Receita Federal                                               | invalid_request      | customer_action_required                              |
| `SUSPENDED`                                 | reason `description` | 412  | CPF suspended (AstroPay: no retry)                                           | fraud_or_risk        | do_not_retry                                          |
| `UNDER_AGE`                                 | reason `description` | 412  | Payer under legal age (no retry)                                             | fraud_or_risk        | do_not_retry                                          |
| `DEAD`                                      | reason `description` | 412  | CPF holder legally deceased (no retry)                                       | fraud_or_risk        | do_not_retry                                          |
| `CPF_UNDER_SACTION` (sic)                   | reason `description` | 412  | CPF sanctioned; escalate to compliance                                       | fraud_or_risk        | manual_review                                         |

`detail` keys documented for 400: `user.phone`, `user.email`, `user.first_name`, `user.last_name`, `user.country` (length or format problems).

**Direct Withdrawal cancel reasons** (`description` on `CANCELLED`):

| Value                                                           | Meaning                                  | Category                   | Retry                    |
| --------------------------------------------------------------- | ---------------------------------------- | -------------------------- | ------------------------ |
| `GENERIC_ERROR`, `TRX_COULD_NOT_BE_PROCESSED`, `NOT_AUTHORIZED` | Unexpected error (AstroPay: allow retry) | provider_unavailable       | retry_conditionally      |
| `CPF_MISMATCH`                                                  | PIX key owner CPF differs                | invalid_request            | customer_action_required |
| `INVALID_PIX_KEY`                                               | PIX key invalid or missing               | invalid_request            | customer_action_required |
| `ACCOUNT_BLOCKED`                                               | Beneficiary account blocked              | payment_method_unavailable | customer_action_required |
| `INVALID_BANK_ACCOUNT`                                          | Bank details invalid or cannot receive   | invalid_request            | customer_action_required |
| `INVALID_ALIAS`                                                 | Account/receiver mismatch (Argentina)    | invalid_request            | customer_action_required |

The approved callback example carries a free-text `description` (`SPCD_1000-Txn successful`); its code space is NOT DOCUMENTED.

**QR / merchant-api authentication errors**: `commons_unauthorized` with `internal_term` `unauthorized` (bad `Merchants-Backend-Api-Key`; authentication_failed, do_not_retry); `merchant_gateway_generic_error` with `internal_term` `INVALID_SIGNATURE` (request HMAC wrong; configuration, do_not_retry); generic `internal_error` example (provider_unavailable, retry_conditionally).

**Platform API (out of first scope; values listed for completeness)**:

- General (https://developers.astropay.com/docs/platform/errors-codes, `error` + `description`): `INVALID_USER_DATA`, `USER_NOT_FOUND`, `INVALID_CURRENCY`, `USER_ACCOUNT_NOT_FOUND`, `INVALID_TRANSFER_TYPE`, `INVALID_REQUEST`, `INVALID_WITHDRAWAL_TYPE`, `CARD_NOT_FOUND`, `PARTNER_NOT_FOUND`, `USER_CLAIMED`, `USER_ALREADY_EXISTS`, `USER_CLAIMED_ACCOUNT` (all 400), `QUOTE_TOKEN_EXPIRED` (412). Suggested: mostly invalid_request/do_not_retry; `QUOTE_TOKEN_EXPIRED` safe_to_retry_technical_request with a new quote.
- Payouts: `user_validation_failed`, `invalid_account_status`, `transaction_max_limit_exceeded`, `user_not_found`, `insufficient_balance`, `partner_configuration_error`, `already_created`, `bad_request`, `payout_creation_error`, `cashout_not_found`, `partner_balance_error`, `unauthorized`, `business_account_not_found`, `business_account_access_denied`, `payout_target_currency_wallet_not_available`; refunds add `payout_not_found`, `payout_refund_not_found`.
- Two-phase transfers: `bad_request`, `unauthorized`, `internal_error`, `transfer_already_exists`, `cci_hold_timeout`, `cci_origin_account_not_found`, `insufficient_balance`, `cci_restriction_applied`, `transfer_failed`, `request_timeout`, `partner_configuration_error`, `balance_error`.
- Savings/users: `ACCOUNT_NOT_FOUND`, `INVALID_ACCOUNT_STATUS`, `DISABLE_USER_ERROR`, `security_error`, `user_secret_already_exists`.
- Card movement `status_reason` examples: `TRANSACTION_REJECTED_INSUFFICIENT_BALANCE`, `TRANSACTION_REJECTED_BY_FRAUD`.

---

## 7. Lifecycle

- **Checkout payment (merchant acceptance, wallet/card/QR chosen by user)**: create -> `PENDING` -> `COMPLETED` | `EXPIRED` | `REJECTED` (only finals trigger callbacks). Refund requires the authorization to be closed; full or partial; payment becomes `PARTIALLY_REFUNDED`/`REFUNDED` and a `payment_transactions[]` entry of type `REFUND` is added. Checkout callbacks for refunds: "if configured" (payload NOT DOCUMENTED).
- **Wallet on File (pull from linked wallet, card-like semantics)**: authorize -> `AUTHORIZED` -> capture (`PARTIALLY_CAPTURED`/`CAPTURED`) or reversal (`PARTIALLY_REVERSED`/`REVERSED`); or auth-capture in one call -> `CAPTURED`. Refund after the authorization is closed -> `PARTIALLY_REFUNDED`/`REFUNDED`. `COMPLETED`, `PENDING`, `REJECTED` also exist; exact transitions to them NOT DOCUMENTED.
- **Direct Payment (local method such as PIX via AstroPay gateway)**: init -> `PENDING` (QR/PIX data returned) -> `APPROVED` or `CANCELLED`. In Brazil `CANCELLED` is not final and may turn `APPROVED`. Refunds and chargebacks: NOT DOCUMENTED.
- **Cashout V1 (merchant to AstroPay wallet)**: `APPROVED` immediately if user found, else `PENDING` up to 24 h then `CANCELLED`. Not reversible.
- **Direct Withdrawal (merchant to bank account)**: `CREATED`/`PENDING` -> `APPROVED` (final, not reversible) or `CANCELLED` (final, reason in `description`). Cannot be cancelled once requested.
- **Wallet balance/transfers (Platform, user-level)**: separate vocabulary (transfers `HOLD` -> `RELEASED`/`COMPLETED`/`CANCELLED`/`FAILED`; payouts with `FOR_REVIEW`). Not merchant deposit/cashout semantics and must not be mixed with them.
- Chargebacks/disputes: NOT DOCUMENTED in any public family.

---

## 8. Notifications

| Family                          | Delivery                                                                                     | Signature (sensitive)                                                                                                                                                                                                       | Ack                  | Retry                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| Checkout                        | HTTPS POST JSON to callback URL set at onboarding; finals only                               | RSA: headers `Partner-Signature` (Base64), `Partner-Request-ID` (UUID), `Partner-Request-Time` (ISO 8601), `Partner-Certificate-Serial-Number`; signed string `requestId:timestamp:body`; certs from `GET /v1/certificates` | `200 OK`             | "retries failed callbacks automatically until acknowledged"; schedule NOT DOCUMENTED |
| Wallet on File                  | POST on create and on status change                                                          | "will include a signature" (format NOT DOCUMENTED)                                                                                                                                                                          | `200 OK`             | NOT DOCUMENTED; payload NOT DOCUMENTED                                               |
| Cashout V1 / onboarding cashout | POST JSON to `callback_url` from request, on `PENDING` -> `APPROVED`/`CANCELLED`             | Header `Signature`: payload HMAC SHA256 with merchant secret key                                                                                                                                                            | NOT DOCUMENTED       | NOT DOCUMENTED                                                                       |
| Direct Payment                  | POST JSON to `callback_url` on completion or cancellation                                    | NOT DOCUMENTED on the callback page                                                                                                                                                                                         | Only `200 OK` counts | 4 more attempts                                                                      |
| Direct Withdrawal               | POST JSON to `callback_url`                                                                  | NOT DOCUMENTED on the callback page                                                                                                                                                                                         | NOT DOCUMENTED       | NOT DOCUMENTED                                                                       |
| QR Payments                     | POST JSON to callback URL set in the merchant panel                                          | Header `Signature`: HMAC SHA256 with merchant secret                                                                                                                                                                        | NOT DOCUMENTED       | NOT DOCUMENTED; source IPs published                                                 |
| Platform                        | POST JSON; webhooks at `{baseWebhookUrl}/{eventName}` (event name in the path, not the body) | RSA (as Checkout); `Test-Notification: true` header for tests                                                                                                                                                               | 2xx within 10 s      | resent later; schedule NOT DOCUMENTED                                                |

Event types: only Platform has named events (`USER_CREATION`, `ONBOARDING_FINISHED`, `ONBOARDING_STEP_FINISHED`, `USER_COUNTRY_OF_RESIDENCE_SET`, `IDENTITY_VALIDATION_REJECTED`, `WALLET_BALANCE_UPDATED`, `TOP_UP`, `WITHDRAWAL`, `PROMO_REWARD_UPDATED`, `TRANSFER_COMPLETED`, `USER_RESTRICTION`, `DEBIT_CARD_TRANSACTION`). Merchant callbacks have no event type field; the family is inferred from identifier names. Ordering: NOT DOCUMENTED. Duplicate identification: no event/delivery ID in merchant callbacks; use family id + `status` (+ `end_status_date`). For RSA-signed families, `Partner-Request-ID` is per request; whether it is stable across retries is NOT DOCUMENTED. `end_status_date` is described as "when the status changed" (Cashout) but as "time the callback was sent" (QR).

---

## 9. Identifiers

| Role                 | Checkout / WoF                                                                            | Direct Payment / QR                                       | Cashout V1                                                     | Direct Withdrawal                      |
| -------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| AstroPay transaction | `payment_external_id` = `payment_id` = path `paymentId`; sub-ops `payment_transaction_id` | `deposit_external_id`; QR also `payment_code_external_id` | `cashout_id` (integer; string in callback example)             | `cashout_external_id`                  |
| Merchant reference   | `merchant_payment_id`, `order.id`                                                         | `merchant_deposit_id`                                     | `merchant_cashout_id`                                          | `merchant_cashout_id`                  |
| User                 | `user.merchant_user_id`; WoF `account_token`                                              | `user.merchant_user_id`                                   | `user.merchant_user_id`, `user_id`, callback `cashout_user_id` | NOT DOCUMENTED beyond beneficiary data |
| Parent/original      | Refund/capture/reversal keep the same `payment_id` and add `payment_transactions[]`       | NOT DOCUMENTED                                            | NOT DOCUMENTED                                                 | NOT DOCUMENTED                         |
| Merchant             | `merchant_id` (callback, number)                                                          | NOT DOCUMENTED                                            | NOT DOCUMENTED                                                 | NOT DOCUMENTED                         |

`deposit_user_id` (AstroPay user id in deposit callbacks) is mentioned on the closed-loop page; the deposit callback that carries it is in the unlisted section. Platform uses `partner_*_id` vs AstroPay `*_id` pairs.

---

## 10. Sensitive fields

- Secrets/credentials: `Signature` header, `Partner-Signature`, `Merchant-Gateway-Api-Key`, `Merchants-Backend-Api-Key`, `Authorization` (Basic/Bearer), `access_token`, `refresh_token`, WoF `account_token`, account-linking authorization codes, Platform `user_secret`.
- Personal data: `user.email`, `user.phone`/`phone_number`, `first_name`, `last_name`, `document` (CPF, DNI, CUIL), `document_type`, `birth_date`, `address`, `user_data{...}` in QR callbacks, beneficiary bank data (`account`, `bank_branch`, `vpa`, PIX key), `last_four_digits` (Platform cards).
- Payment artifacts: `payment_detail.qr` (PIX copy-paste key), `qr_image`, `redirect_url`/`fallback_url` (contain a Base64 `data` parameter with `app_id`).
- Redact all of the above before display; signature values should be shown only as present/absent.

---

## 11. Structural detection hints

Strong AstroPay signals (combine several):

1. `deposit_external_id` with `merchant_deposit_id` or `payment_code_external_id`; `cashout_external_id` or `cashout_id` with `merchant_cashout_id`; `cashout_user_id`; `end_status_date`.
2. `payment_external_id` with `payment_info.payment_amount.{currency,value}`, `payment_status`, `merchant_notification_url`.
3. Payment object with `captured_amount`, `reversed_amount`, `refunded_amount`, `is_authorization_completed`, `is_reversable` or `is_reversible`, `payment_transactions[]{payment_transaction_id,type,result}`.
4. Error envelope with `internal_term`; `error` values prefixed `commons_` or `merchant_gateway_`; `reasons[]{reason_code, fields}`.
5. Hosts `onetouch-api(-sandbox).astropay.com`, `partners-api(-sandbox).astropay.com`, `merchant-api(-stg).astropay.com`, `checkout-sandbox.astropay.com`; headers `Partner-Signature`, `Partner-Certificate-Serial-Number`, `Merchant-Gateway-Api-Key`, `Merchants-Backend-Api-Key`.

Versus supported providers: Stripe (`object`, `pi_`/`evt_` ids), Adyen (`pspReference`, `resultCode`, `notificationItems`), payabl. (URL-encoded `transactionid`/`transid`), Checkout.com (`pay_` ids, `_links`, `type` like `payment_captured`), PayPal (`event_type`, `resource`), Braintree (`bt_signature`/`bt_payload`), Mollie (`tr_` ids), Square (`merchant_id`, `type`, `data.object`, money in minor units). None uses `deposit_external_id`, `merchant_cashout_id` or `internal_term`.

Versus candidates: MiFinity uses `transactionStatus` integers, `traceId`, `{"payload":[...]}`; NMI uses `response=`/`responsetext=` query strings or `event_type`/`event_body`. emerchantpay, Ecommpay, Paymentwall and Skrill were not compared from their own sources here; the AstroPay field names above were not observed elsewhere in this research. Weak signals on their own: `status` in `APPROVED`/`PENDING`/`CANCELLED` and `merchant_user_id` are generic.

---

## 12. Limitations, ambiguities, inconsistencies

1. **Unlisted docs not used**: `/docs/private/` routes (wallet-checkout deposits with likely `merchant_deposit_id` deposit and callback docs, regulated-gambling, legacy-br, local-processing, affiliates-api) are absent from the sitemap and navigation; treated as non-public. The classic wallet Deposit API (OneTouch deposit) is therefore NOT verified; only the Direct Payment and QR deposit formats are.
2. **Client-rendered site**: pages were read from content bundles; tables were reconstructed from text. The `/api` reference was not examined.
3. **Two signature schemes**: HMAC SHA256 `Signature` (OneTouch/merchant-api) vs RSA `Partner-Signature` (Checkout, Platform). Direct Payment/Withdrawal callback signing is not stated on their callback pages.
4. **Spelling drift**: `is_reversable` (refund, WoF) vs `is_reversible` (status pages); `CPF_UNDER_SACTION`; "Inssuficient Balance".
5. **Error key casing**: WoF table uses `INSUFFICIENT_BALANCE`, WoF examples use `insufficient_balance` with `message` instead of `description`.
6. **Copy-paste errors**: Cashout error table mentions deposits and `merchant_deposit_id`; Direct Payment and Withdrawal error pages are identical (user-object details for a payout).
7. **Status gaps**: Direct Payment full enum not documented; Direct Withdrawal response shows `CREATED`, not in its status list; QR create example returns `"status":"ACTIVE"` although the field is typed `PENDING/APPROVED/CANCELLED`.
8. **`result` values**: `OK`/`FAILED` on the refund page vs `APPROVED` on status pages.
9. **Type drift**: `cashout_id` integer in tables, string in callback example; `end_status_date` documented as `YYYY-MM-DD HH:MM:SS`, examples use `T` and fractional seconds.
10. **Hosts**: Checkout auth page uses `partners-api` but the create example shows `Host: api.astropay.com`; WoF base URL not stated.
11. **QR content type**: intro says form-encoded, examples are JSON.
12. Error lists are explicitly "most common"; Cashout V1 errors have no machine code.
13. Chargebacks, disputes, settlement events: NOT DOCUMENTED.

---

## 13. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **supported** | Clear `error`/`internal_term`/`reason_code` tables with HTTP status and some AstroPay retry advice across all merchant families; Cashout V1 needs text matching on `description`; unknown fallback required.                                                                                                               |
| paymentResponses | **supported** | JSON create/status/refund responses with stable payment object and documented examples for Checkout, WoF, Cashout V1, Direct Payment/Withdrawal, QR.                                                                                                                                                                       |
| webhookParsing   | **limited**   | Merchant callback bodies documented, but no event type or delivery id, WoF payload and some signature schemes undocumented, retry/ack rules differ per family, and the wallet deposit callback is only in unlisted docs.                                                                                                   |
| timeline         | **limited**   | Status vocabularies and `end_status_date` allow before/after ordering, and `payment_transactions[]` gives auth/capture/reversal/refund steps; but no per-step timestamps in the payment object, `CANCELLED` can later become `APPROVED` (Brazil), and ordering is not documented.                                          |
| correlation      | **limited**   | Each family pairs an AstroPay id with a merchant id (`payment_external_id`/`merchant_payment_id`, `deposit_external_id`/`merchant_deposit_id`, `cashout_id` or `cashout_external_id`/`merchant_cashout_id`); refunds stay on the same `payment_id`. No cross-family parent ids, and the same `payment_id` has three names. |
