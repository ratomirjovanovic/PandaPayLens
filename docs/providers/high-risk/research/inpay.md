# Inpay (adapter id `inpay`): high-risk candidate research

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified** (payouts and pay-ins JSON APIs; see section 10 for the limits)
- Method: the developer portal `https://app.inpay.com/docs/` is a client-rendered single-page app (every route returns the same ~1 KB HTML shell). The page text was read from the public static files that the site itself loads for any anonymous visitor: the navigation bundle (`/docs/assets/index-C6mJ9q7j.js`), the Markdown pages (`/docs/<path>.md`), the OpenAPI files (`/docs/swagger/shared/<name>.json`), data files (`/docs/data/<name>.json`) and XML snippets (`/docs/code-snippets/<name>.xml`). Business pages on inpay.com were read with a web fetch. Nothing was executed, no login was used, no access was requested. `docs.inpay.com` does not resolve (DNS failure on 2026-10-25).
- Template note: the public docs are a template. Text shows placeholders such as `{{tenantCompany}}`, `{{tenantSupportEmail}}`, `{{tenantPaymentUrl}}`, `{{tenantSandboxAppUrl}}`. Data files and OpenAPI descriptions say "Inpay" directly. Real payloads would carry Inpay values; the placeholder strings themselves are docs artifacts.

---

## 0. Summary

| Item                 | Finding                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome              | `documentation_verified` for Payouts API v1 (JSON), Collections API v1 (pay-ins, JSON) and their webhooks. ISO 20022 XML payout channel documented at status-report level only.                                                                                                                                |
| Classification       | `alternative_payment_method` (open banking and bank transfer pay-ins, bank payouts). `wallet`: limited, only the "Wallet transfer" pay-in method (EntirePay trading name). Not documented: `card_processing`, `acquiring`, `gateway`, `payment_facilitator`, `orchestration`, `merchant_account_intermediary`. |
| Documented sectors   | Financial Services, iGaming, NGOs (developer docs); also "corporates" (homepage).                                                                                                                                                                                                                              |
| Documentation access | Generic docs **public** (no login). Account-specific product lists, per-product payout schemas and "customised" docs need a customer login. Sandbox UI, credentials and webhook registration need onboarding.                                                                                                  |
| Documented codes     | Payout reason table: 89 rows (61 distinct `category`+`code` pairs, 58 distinct `code` strings). Collection reason table: 18 rows. Plus 7 payout states, 12 order statuses, 3 + 13 + 9 payment-attempt statuses, 4 ISO `GrpSts` values, 7 JWT error codes, 5 numeric API error codes, 7 HTTP statuses.          |
| Biggest limitation   | Webhooks and responses are **PKCS#7 signed and encrypted** for PKCS#7-model merchants, so the raw body is opaque; only decrypted JSON (or JWT-model plain JSON) is inspectable. Webhooks carry **no event name and no event id**; pay-in `status_reasons` are free text without codes.                         |
| White-label note     | Inpay exposes its own JSON formats and ISO 20022 messages. Instant Bank Transfer pay-ins pass through a status code "reported by the open-banking provider" (`debtor_bank_status_code`, e.g. `ACSC`); that provider is not named. No first-party source says Inpay resells another gateway.                    |

---

## Qualification gate

| #   | Item                                               | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active                   | yes    | https://inpay.com/ (2026 copyright, Copenhagen and London offices, careers page; "over 1 million transactions a month" claim).                                                                                                                                                                                                                                                                                        |
| 2   | Payment service operational                        | yes    | https://inpay.com/ describes live Money Out ("Instant, 24/7 global payments", SEPA Instant, SEPA, SWIFT) and Money In (open banking pay-ins). Docs describe separate test and production environments (`docs-overview/getting-started/environments-and-going-live.md`).                                                                                                                                               |
| 3   | Developer docs publicly accessible                 | yes    | https://app.inpay.com/docs/ static content loads without login. `docs-overview/about.md`: existing customers "will be given a customised version" of the docs, and the Products pages list "products that are currently active under your contract" (login-only). The per-product Create Payment Request schema is fetched for the logged-in organisation; anonymous visitors get built-in default product schemas.   |
| 4   | API families/versions identified                   | yes    | OpenAPI files: "Payouts API" v1, "Collections API" v1, "Reconciliation API" v1, "FX API" v1, "Account Funding API" v1, "Authentication API" v1, "Customer Api Sandbox API" v1. ISO 20022: accepts pain.001.001.10 and pacs.008.001.12, replies pain.002.001.11 / pacs.002.001.12 (`api/iso-introduction.md`, code snippets).                                                                                          |
| 5   | Responses/notifications examinable offline         | yes    | Payout status and webhook examples for all 7 states (`/docs/swagger/shared/payouts.json`, `webhooks` chunk); 11 order webhook examples (`/docs/data/collection-webhooks.json`); error examples per endpoint; ISO XML examples. Caveat: PKCS#7 bodies must be decrypted by the merchant first.                                                                                                                         |
| 6   | Sectors documented by provider                     | yes    | `docs-overview/business-value.md`: services aimed at "selected sectors, including Financial Services, iGaming and NGOs". https://inpay.com/ lists financial services, iGaming, corporates and NGOs. https://inpay.com/igaming: "a quarter of iGaming's Power50 choose Inpay".                                                                                                                                         |
| 7   | Regional/regulatory limitations identified         | yes    | https://inpay.com/compliance: "authorized payments institution in the EU, licensed and regulated by the Danish FSA" (DFSA No. 22008), SWIFT member, sanctions screening (OFAC, UN, EU, HMT). Payout availability is per contracted "product" (currency + country + local instrument) (`api/products.md`); pay-in availability per "Payment Method + Debtor Country + Debtor Currency" (`api/collection-products.md`). |
| 8   | Adapter gives diagnostic value                     | yes    | 89-row payout reason table with machine codes, explicit state machines for payouts, orders and payment attempts, JWT error codes, structured validation errors.                                                                                                                                                                                                                                                       |
| 9   | Own technical formats (not a resold gateway)       | yes    | Own JSON resources (`inpay_unique_reference`, `end_to_end_id`, `state`, `reasons`) and own ISO 20022 endpoint. Open-banking provider unnamed; wallet method branded EntirePay ("EntirePay trading name", `api/collections/terminology.md`).                                                                                                                                                                           |
| 10  | No live credentials needed for documented examples | yes    | All examples are in public static files.                                                                                                                                                                                                                                                                                                                                                                              |

Gate outcome: **documentation_verified** (items 1-5, 8, 9, 10 are yes).

## Classification

- `alternative_payment_method`: yes. Pay-in methods `instant_bank_transfer` ("Open Banking Payment Initiation Service"), `bank_transfer` (instructions-based), and enums also list `swish_transfer`, `blik_transfer` (collection OpenAPI); payouts by bank rails LOCAL, SEPA, INSTANT SEPA, INTERNATIONAL (`api/payouts-terminology.md`).
- `wallet`: limited. Only "Wallet transfer: a payment method where the end-user consents to create a wallet account" (EntirePay trading name). Keep wallet-transfer statuses separate from bank-transfer statuses.
- Not documented: `card_processing`, `acquiring`, `gateway`, `payment_facilitator`, `orchestration`, `merchant_account_intermediary`. Inpay holds merchant funds in "Virtual Bank Accounts" and debits/credits them (`api/payouts_virtual_bank_account.md`); none of the classification labels fits that exactly, so it is recorded here rather than forced into a label.

## Documented sectors

| Sector             | Source                                                                           |
| ------------------ | -------------------------------------------------------------------------------- |
| Financial Services | `https://app.inpay.com/docs/docs-overview/business-value.md`; https://inpay.com/ |
| iGaming            | same; https://inpay.com/igaming                                                  |
| NGOs               | same; https://inpay.com/                                                         |
| Corporates         | https://inpay.com/                                                               |

Eligibility depends on jurisdiction, licensing and Inpay's onboarding/compliance review. No other sector (adult, crypto, nutraceuticals, travel, subscription) is documented by Inpay; do not infer one.

---

## 1. Sources (all read 2026-10-25)

Business pages: https://inpay.com/, https://inpay.com/compliance, https://inpay.com/igaming, https://www.inpay.com/money-in/

Developer portal (base `https://app.inpay.com/docs/`):

| Path                                                                                                                                                                                                                                                                                                     | Covers                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `guide/overview`                                                                                                                                                                                                                                                                                         | SPA shell only                                                                                         |
| `assets/index-C6mJ9q7j.js`                                                                                                                                                                                                                                                                               | Navigation tree, endpoint list, default payout product schemas and request examples, ISO table columns |
| `assets/reason-codes-payouts-CcF-BJLu.js`                                                                                                                                                                                                                                                                | Payout reason code table (89 rows)                                                                     |
| `assets/webhooks-CFVOYMmz.js`                                                                                                                                                                                                                                                                            | Payout webhook examples (7 states), HTTP ack rules                                                     |
| `api/payouts-introduction.md`, `api/payouts-terminology.md`, `api/products.md`, `api/payouts_virtual_bank_account.md`                                                                                                                                                                                    | Payout states, terms, products                                                                         |
| `api/webhooks-description.md`, `api/webhooks-description-jwt.md`                                                                                                                                                                                                                                         | Payout webhooks, JWT webhook signature                                                                 |
| `api/iso-introduction.md`, `api/iso-2022-status-codes.md`, `api/iso-2022-response-further-checks.md`                                                                                                                                                                                                     | ISO 20022 channel                                                                                      |
| `code-snippets/iso2022-{received,rejected}-response-{pain,pacs}.xml`                                                                                                                                                                                                                                     | ISO status report examples                                                                             |
| `api/collections/order-lifecycle.md`, `order-status-reasons.md`, `terminology.md`, `bank-transfer-payment-status.md`, `instant-bank-transfer-payment-status.md`, `wallet-transfer-status.md`, `ui-integration.md`, `webhooks.md`; `api/collection-products.md`, `api/payins_virtual_bank_account.md`     | Pay-in model and statuses                                                                              |
| `data/collection-webhooks.json`, `data/reason-codes-collection.json`                                                                                                                                                                                                                                     | Order webhook examples, pay-in reason table                                                            |
| `api/api-errors.md`, `api/response-codes.md`                                                                                                                                                                                                                                                             | Error model                                                                                            |
| `api/getting-started/security-model.md`, `introduction-jwt.md`, `introduction-pkcs7.md`, `sign-and-encrypt-jwt.md`, `sign-and-encrypt-jwt-errors.md`, `sign-and-encrypt-pkcs7.md`, `decrypt-and-verify-jwt.md`, `decrypt-and-verify-pkcs7.md`, `http-headers/{bearer-token,x-auth-uuid,x-request-id}.md` | Auth, headers, JWT errors                                                                              |
| `swagger/shared/{payouts,collection,reconciliation,fx,account_funding,authentication,sandbox_customer_api}.json`                                                                                                                                                                                         | OpenAPI 3.0.3 specs                                                                                    |
| `docs-overview/...` (about, business-value, environments-and-going-live, integration/_, sandbox/_)                                                                                                                                                                                                       | Onboarding, character set, webhooks setup, sandbox test cases                                          |

---

## 2. API families in scope

| Family                                                              | Endpoints (relative; production host NOT DOCUMENTED publicly)                                                                                                                                                                                                              | Format                               | Priority  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------- |
| Payouts API v1                                                      | `POST /disbursement/payment_requests`, `GET /disbursement/payment_requests/{unique_reference}`, `GET /disbursement/payment_requests/search?end_to_end_id=`, `POST /disbursement/payment_requests/cancellation_requests`, reports, `GET /disbursement/external_codes/{set}` | JSON                                 | **First** |
| Payout webhooks                                                     | POST to merchant URL on every state change                                                                                                                                                                                                                                 | JSON, or XML for ISO 20022 merchants | **First** |
| Collections API v1 (pay-ins)                                        | `POST /api/collection/orders`, `GET/DELETE /api/collection/orders/{order_uuid}`, `/payments...`, `/refund`, `/overfunding`                                                                                                                                                 | JSON                                 | **First** |
| Collection webhooks                                                 | POST on every Order status change; body = GetOrder structure                                                                                                                                                                                                               | JSON                                 | **First** |
| ISO 20022 payouts                                                   | `POST /disbursement/iso_20022` (pain.001.001.10 or pacs.008.001.12 in; pain.002.001.11 / pacs.002.001.12 status report out)                                                                                                                                                | XML                                  | Second    |
| Reconciliation, FX, Account Funding, Authentication checks, Sandbox | balance, statements, exchange rate, funding instructions, auth tests, sandbox complete/return                                                                                                                                                                              | JSON                                 | Low       |

Security models (chosen at onboarding, `security-model.md`): **PKCS#7** (request and response bodies signed and encrypted, headers `Authorization: Bearer <static token>`, `X-Auth-Uuid`, `X-Request-ID`) or **JWT** (plain JSON/XML bodies; `Authorization: Bearer <RS256 JWT>` with `kid` = X-Auth-Uuid, claims `iat` and `checksum` = SHA-256 hex of raw body).

## 3. Response and error formats

- Content type: `application/json` (OpenAPI); ISO channel XML; report download `text/csv`. Character set UTF-8 for requests, responses and status information (`docs-overview/integration/character-set.md`).
- PKCS#7 model: responses (including GET) and webhooks are signed and encrypted; the decrypted body is the JSON/XML described here. JWT model: responses plain.
- `X-Request-ID` is echoed in responses; a duplicate `X-Request-ID` on a request returns **412 Precondition Failed**.

Payout resource (status response, search item, webhook body; the Create Payment Request page reuses the same 200 response definition):

| Field                                             | Meaning                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `debtor_account.id`, `debtor_account.scheme_name` | Merchant virtual account (11 digits) and `"VirtualAccount"` (the OpenAPI descriptions of these two fields are swapped) |
| `end_to_end_id`                                   | Merchant's unique reference for the payout                                                                             |
| `inpay_unique_reference`                          | Inpay reference for the payment request                                                                                |
| `amount`, `currency`                              | Decimal string, ISO 4217                                                                                               |
| `timestamp`                                       | `"YYYY-MM-DD HH:MM:SS"`, timezone NOT DOCUMENTED                                                                       |
| `state`                                           | `received`, `processing`, `pending`, `action_required`, `rejected`, `completed`, `returned`                            |
| `reasons[]`                                       | Only on some states: `{category, code, details}`; `details` is an object of field -> array of messages                 |

Example (transcribed from https://app.inpay.com/docs/swagger/shared/payouts.json, `rejected` example):

```json
{
  "debtor_account": { "id": "45701229351", "scheme_name": "VirtualAccount" },
  "end_to_end_id": "45701229351",
  "inpay_unique_reference": "d1a2b3c4d5",
  "amount": "100.00",
  "currency": "EUR",
  "timestamp": "2025-01-09 10:24:15",
  "state": "rejected",
  "reasons": [
    {
      "category": "contract_issue",
      "code": "missing_capability",
      "details": { "general": ["Can't find capabilities"] }
    }
  ]
}
```

Order resource (Collections): `business_unit`, `amount`, `amount_cents`, `currency`, `language`, `expires_at` (ISO 8601 UTC), `uuid`, `status`, `redirect_url`, `back_to_merchant_url`, `reference`, `primary_payment` (an `inpay_unique_reference`), `status_reasons` (array of strings), `refund` (`uuid`, `amount`, `currency_iso`, `status`, `creditor_full_name`, `creditor_account_number`), `payments[]` (`uuid`, `status`, `type`, `inpay_unique_reference`, `redirect_url`, `debtor_country_iso`, `debtor_bank_uuid`, `debtor_account_number`, `debtor_bank_status_code`, `debtor_full_name`, `debtor_paid_amount`, `topup_payment_method`, `available_topup_payment_methods`).

Example (transcribed from https://app.inpay.com/docs/data/collection-webhooks.json, `action_required`, `redirect_url` shortened in the source):

```json
{
  "business_unit": "default",
  "amount": "100.55",
  "amount_cents": 10055,
  "currency": "EUR",
  "language": "en",
  "uuid": "6845ec7e-b0c4-4c61-bfeb-ab5889ebb5aa",
  "redirect_url": "{{tenantPaymentUrl}}/?token=eyJhbGciOiJSUzI1NiJ9.eyJvcm",
  "back_to_merchant_url": "https://www.example.com/welcome_back",
  "reference": "j84c8h0a7W",
  "status": "action_required",
  "status_reasons": ["TSTM Screening failure"],
  "refund": null,
  "payments": [
    {
      "uuid": "69db025d-bfdf-49b7-b856-1a105e4310a1",
      "status": "completed",
      "type": "instant_bank_transfer",
      "inpay_unique_reference": "3ABCXYZ",
      "redirect_url": "...",
      "debtor_full_name": "John Doe",
      "debtor_bank_uuid": "ngp-rabo",
      "debtor_account_number": "NL72INGB9558721522",
      "debtor_bank_status_code": "ACSC",
      "debtor_paid_amount": "100.55"
    }
  ],
  "primary_payment": "3ABCXYZ"
}
```

Error bodies (three shapes, all documented):

1. Collections/FX/Sandbox: `{"errors":[{"title": "...", "detail": string | {field: [messages]}}]}` (some examples use `details` and add numeric `code`).
2. Payout reports: `{"error":{"code":1001|1002,"title":"Validation Error"|"Resource not found","details": string | object}}`.
3. Payout cancellation 422: `{"error":{"details":{"inpay_unique_reference":["must be filled"]}}}`; 401: `{"errors":[{"title":"Not authorized"}]}`; 412: `{"message":"Missing X-Auth-Uuid / X-Request-ID"}`.

## 4. Codes

Category and retry columns are **suggestions** for PandaPayLens, not Inpay statements.

### 4.1 HTTP statuses (`api/response-codes.md` plus OpenAPI)

| Code | Meaning                                                                            | Category             | Retry                           |
| ---- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------- |
| 400  | Invalid parameters                                                                 | invalid_request      | do_not_retry                    |
| 401  | Credentials not accepted (no error code = Authorization header not a parsable JWT) | configuration        | do_not_retry                    |
| 404  | Resource not found (OpenAPI)                                                       | invalid_request      | do_not_retry                    |
| 412  | Duplicate `X-Request-ID` or missing headers                                        | duplicate_request    | do_not_retry                    |
| 422  | Business-logic error                                                               | invalid_request      | do_not_retry                    |
| 500  | Execution stopped unexpectedly                                                     | provider_unavailable | retry_conditionally             |
| 503  | Infrastructure unavailable                                                         | provider_unavailable | safe_to_retry_technical_request |

### 4.2 Numeric API error codes (OpenAPI enums/examples)

| Code    | Meaning                                                          | Category        | Retry        |
| ------- | ---------------------------------------------------------------- | --------------- | ------------ |
| `1001`  | Validation Error (payout reports)                                | invalid_request | do_not_retry |
| `1002`  | Resource not found (payout reports)                              | invalid_request | do_not_retry |
| `2001`  | Resource not found, e.g. unknown country (wallet top-up methods) | invalid_request | do_not_retry |
| `2002`  | Validation Error, e.g. country missing                           | invalid_request | do_not_retry |
| `15002` | Validation Error on FX parameter length                          | invalid_request | do_not_retry |

### 4.3 JWT authentication errors (`sign-and-encrypt-jwt-errors.md`; response field name NOT DOCUMENTED)

| Code                      | Meaning                                             | Category              | Retry                                              |
| ------------------------- | --------------------------------------------------- | --------------------- | -------------------------------------------------- |
| `jwt_verification_error`  | Signature does not verify against stored public key | configuration         | do_not_retry                                       |
| `jwt_claim_iat_missing`   | No `iat` claim                                      | configuration         | do_not_retry                                       |
| `jwt_iat_not_a_timestamp` | `iat` not numeric                                   | configuration         | do_not_retry                                       |
| `jwt_iat_too_old`         | `iat` older than 5 minutes                          | authentication_failed | safe_to_retry_technical_request (with fresh token) |
| `jwt_iat_in_the_future`   | Client clock ahead of server                        | configuration         | retry_conditionally (after clock sync)             |
| `jwt_checksum_missing`    | Body present but no `checksum`                      | configuration         | do_not_retry                                       |
| `jwt_checksum_mismatch`   | `checksum` differs from SHA-256 of body             | configuration         | do_not_retry                                       |

### 4.4 Payout reason codes (`reasons[].category` / `reasons[].code`)

Source: `assets/reason-codes-payouts-CcF-BJLu.js`. The table holds `kind`, `category`, `code`, `description`, `key`; the portal shows only category, code and description. Webhooks carry only `category` and `code`; the numeric `key` and `kind` are docs-only. Many pairs appear twice: a "Cancelled" row (kind `refund_cancelled`, payout ends `rejected`) and a "Returned" row (kind `refund_returned`, payout ends `returned`); the payout `state` disambiguates. Keys listed as cancelled/returned.

| Category                 | Code                                                              | Keys               | Meaning (paraphrase)                                | Category (suggested)         | Retry                                        |
| ------------------------ | ----------------------------------------------------------------- | ------------------ | --------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| contract_issue           | `not_supported_by_your_contract`                                  | 1                  | Product not in contract                             | configuration                | do_not_retry                                 |
| contract_issue           | `service_unavailable`                                             | 2                  | Service unavailable                                 | provider_unavailable         | retry_conditionally                          |
| contract_issue           | `missing_capability`                                              | 67                 | Account lacks capability                            | configuration                | do_not_retry                                 |
| internal_policy          | `rejected_due_to_internal_policy`                                 | 3                  | Inpay internal policy                               | fraud_or_risk                | manual_review                                |
| invalid_data             | `invalid_data_incorrect_account_number`                           | 4 / 25             | Account number/IBAN wrong or missing                | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_swift_bic`                                | 5 / 38             | SWIFT/BIC wrong or missing                          | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_branch_code`                              | 6 / 26             | Bank/branch code wrong                              | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_country_mismatch`                                   | 7                  | Country mismatch                                    | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_currency_mismatch`                                  | 40                 | Currency mismatch                                   | invalid_request              | do_not_retry                                 |
| invalid_data             | `invalid_data_incorrect_beneficiary_bank_details`                 | 9 / 41             | Beneficiary bank details wrong                      | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_beneficiary_details`                      | 10 / 27            | Beneficiary details wrong or missing                | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_mismatch_account_and_bic`                           | 11 / 42            | Account and BIC do not match                        | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_mismatch_country_and_bic`                           | 12 / 43            | Country and BIC do not match                        | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_beneficiary_name`                         | 51 / 235           | Beneficiary name wrong or missing                   | invalid_request              | customer_action_required                     |
| invalid_data             | `not_suitable_for_faster_payment_service`                         | 54                 | Not eligible for UK Faster Payments                 | payment_method_unavailable   | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_or_missing_sender_details`                | 55 / 61            | Sender details wrong or missing                     | invalid_request              | do_not_retry                                 |
| invalid_data             | `the_account_is_not_suitable_for_EFT_transaction`                 | 58                 | Account cannot take EFT                             | payment_method_unavailable   | customer_action_required                     |
| invalid_data             | `the_BIC_is_not_SEPA_reachable`                                   | 60 / 59            | BIC not reachable via SEPA                          | payment_method_unavailable   | customer_action_required                     |
| invalid_data             | `invalid_data_kanji_character_is_not_supported`                   | 96                 | Kanji characters not accepted                       | invalid_request              | do_not_retry                                 |
| invalid_data             | `invalid_data_incorrect_beneficiary_address`                      | 130 / 180          | Beneficiary address/city/postcode wrong             | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_beneficiary_date_of_birth`                | 131                | Beneficiary birth date wrong or missing             | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_or_missing_bank_name`                     | 140 / 162          | Bank name wrong or missing                          | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_or_missing_BSB_number`                    | 143 / 165          | Australian BSB wrong or missing                     | invalid_request              | customer_action_required                     |
| invalid_data             | `invalid_data_incorrect_or_missing_sender_address`                | 146 / 168          | Sender state/city/postcode wrong                    | invalid_request              | do_not_retry                                 |
| invalid_data             | `invalid_data_v2_tstm`                                            | 185                | Incorrect or missing data (rejected)                | invalid_request              | do_not_retry                                 |
| invalid_data             | `invalid_data_incorrect_or_missing_account_type`                  | 205 / 277          | Account type wrong or missing                       | invalid_request              | customer_action_required                     |
| kyc                      | `kyc_documentation_not_provided_within_reasonable_time`           | 15 / 63            | KYC documents not supplied in time                  | fraud_or_risk                | manual_review                                |
| kyc                      | `unable_to_approve_kyc_documentation`                             | 16                 | KYC documents not approved                          | fraud_or_risk                | manual_review                                |
| kyc                      | `compliance_check`                                                | 36                 | Rejected by Inpay compliance                        | fraud_or_risk                | do_not_retry                                 |
| suspicious               | `suspicious_name_mismatch`                                        | 18 / 45            | Name mismatch                                       | fraud_or_risk                | manual_review                                |
| suspicious               | `beneficiary_bank_account_closed`                                 | 19 / 30            | Beneficiary account closed/blocked                  | payment_method_unavailable   | customer_action_required                     |
| suspicious               | `rejected_by_bank_beneficiary_flagged`                            | 20 / 46            | Bank rejected, beneficiary flagged                  | fraud_or_risk                | do_not_retry                                 |
| suspicious               | `suspicious_account_not_recognized`                               | 29                 | Account not recognised                              | invalid_request              | customer_action_required                     |
| suspicious               | `beneficiary_bank_account_name_mismatch`                          | 49 / 31            | Account and name do not match                       | invalid_request              | customer_action_required                     |
| suspicious               | `beneficiary_bank_account_blocked`                                | 56                 | Beneficiary account blocked                         | payment_method_unavailable   | customer_action_required                     |
| test                     | `test_payment`                                                    | 21 / 48            | Test payment                                        | configuration                | do_not_retry                                 |
| technical_issue          | `technical_issue_unknown`                                         | 22 / 47            | Technical issue                                     | provider_unavailable         | manual_review                                |
| beneficiary_request      | `beneficiary_request_returned_payment_as_per_beneficiary_request` | 23                 | Returned at beneficiary's request                   | unknown (intentional return) | manual_review                                |
| merchant_request         | `requested_by_customer`                                           | 28                 | Returned at customer request                        | unknown (intentional)        | do_not_retry                                 |
| merchant_request         | `requested_by_merchant`                                           | 35 / 44            | Cancelled/returned at merchant request              | unknown (intentional)        | do_not_retry                                 |
| beneficiary_bank_request | `beneficiary_bank_is_unable_to_apply_funds`                       | 50 / 32            | Beneficiary bank cannot apply funds                 | payment_method_unavailable   | manual_review                                |
| beneficiary_bank_request | `reason_not_specified_by_beneficiary_bank`                        | 53 / 52            | Bank gave no reason                                 | unknown                      | manual_review                                |
| processing_bank_request  | `processing_bank_is_unable_to_apply_funds`                        | 62 / 238           | Processing bank cannot apply funds                  | provider_unavailable         | manual_review                                |
| processing_bank_request  | `rejected_due_to_processing_bank_policy`                          | 149 / 174          | Processing bank policy                              | fraud_or_risk                | manual_review                                |
| processing_bank_request  | `rejected_by_processing_bank_missing_routing_capability`          | 151 / 177          | Processing bank cannot route                        | payment_method_unavailable   | do_not_retry                                 |
| processing_bank_request  | `rejected_by_processing_bank_is_unable_to_apply_funds`            | 181                | Processing bank cannot apply funds (returned)       | provider_unavailable         | manual_review                                |
| schema_validation_error  | `invalid_creditor_account`                                        | 73                 | Creditor account invalid                            | invalid_request              | do_not_retry                                 |
| schema_validation_error  | `invalid_creditor`                                                | 76                 | Creditor invalid                                    | invalid_request              | do_not_retry                                 |
| schema_validation_error  | `invalid_ultimate_debtor`                                         | 79                 | Ultimate debtor invalid                             | invalid_request              | do_not_retry                                 |
| schema_validation_error  | `invalid_general_data`                                            | 82                 | General request data invalid                        | invalid_request              | do_not_retry                                 |
| schema_validation_error  | `invalid_debtor`                                                  | 85                 | Debtor invalid                                      | invalid_request              | do_not_retry                                 |
| pending                  | `waiting_future_execution`                                        | 91                 | Waiting for requested execution date (not an error) | n/a                          | n/a                                          |
| action_required          | `insufficient_funds`                                              | 220                | Merchant virtual account lacks funds                | insufficient_funds           | manual_review (fund account; payout resumes) |
| action_required          | `awaiting_kyc_documents`                                          | 221                | Extra KYC information needed                        | fraud_or_risk                | manual_review                                |
| vop_info                 | `match`, `close_match`, `no_match`, `not_applicable`              | 289, 286, 283, 292 | Verification of Payee result (informational)        | n/a                          | n/a                                          |
| vop_rejection            | `no_match`                                                        | 295                | Cancelled: VoP no match                             | invalid_request              | customer_action_required                     |
| vop_rejection            | `close_match`                                                     | 298                | Cancelled: VoP close match                          | invalid_request              | customer_action_required                     |
| vop_rejection            | `not_applicable`                                                  | 304                | Cancelled: VoP not applicable                       | unknown                      | manual_review                                |

Codes seen elsewhere but **not in the table**: `beneficiary-account-not-existing` (category `returned`, payout webhook example; hyphenated, unlike every table code), and `validation_schema_failed`, `awaiting_extended_kyc` (report filter example). The collection reason table adds `validation_schema_failed_generic_key` as a key.

### 4.5 Pay-in (collection) reason table (`data/reason-codes-collection.json`, 18 rows: `kind`, `group`, `external_message`, `key`)

Webhooks only carry the human message in `status_reasons[]`; there is no code field. Map by message text.

| Key                                    | Kind / group                                | Meaning (paraphrase)                                   | Category                       | Retry                    |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------ | ------------------------ |
| 98                                     | collection / order_cancelled                | User cancelled or abandoned                            | unknown (customer abandonment) | customer_action_required |
| 101                                    | collection / order_cancelled                | Cancelled by the merchant                              | unknown (intentional)          | do_not_retry             |
| 102                                    | collection / order_cancelled                | Cancelled by Inpay operator                            | unknown                        | manual_review            |
| 103                                    | collection / order_cancelled                | Order expired                                          | unknown                        | customer_action_required |
| 232                                    | collection / order_cancelled                | Payment failed                                         | unknown                        | customer_action_required |
| 211                                    | collection / action_required                | Held for Inpay compliance review                       | fraud_or_risk                  | manual_review            |
| 200                                    | collection / action_required                | Overfunded: merchant must keep or refund difference    | invalid_amount                 | manual_review            |
| 191                                    | collection / action_required_for_refund     | Refund blocked, virtual account lacks funds            | insufficient_funds             | manual_review            |
| 229                                    | collection / kyc                            | Rejected by Inpay compliance                           | fraud_or_risk                  | do_not_retry             |
| 194                                    | collection / refund_requested               | Refund requested by merchant                           | n/a                            | n/a                      |
| 170                                    | collection / refund_requested               | Refund by Inpay admin for merchant/operational reasons | n/a                            | manual_review            |
| 36                                     | refund_cancelled / kyc                      | Refund rejected by compliance                          | fraud_or_risk                  | manual_review            |
| 188                                    | refund_cancelled / kyc                      | Transfer entity not approved                           | fraud_or_risk                  | manual_review            |
| 32                                     | refund_cancelled / beneficiary_bank_request | Beneficiary bank cannot apply funds                    | payment_method_unavailable     | manual_review            |
| 130                                    | refund_cancelled / invalid_data             | Beneficiary address wrong or missing                   | invalid_request                | customer_action_required |
| 35                                     | refund_cancelled / merchant_request         | Refund cancelled by merchant                           | n/a                            | n/a                      |
| 21                                     | refund_cancelled / test                     | Test payment                                           | configuration                  | do_not_retry             |
| `validation_schema_failed_generic_key` | refund_cancelled / invalid_data             | Validation schema failed                               | invalid_request                | do_not_retry             |

`order-status-reasons.md` lists further message strings per status ("Order processing halted, payment will be refunded to the debtor", "Too much funds have been received", "Refund requested by customer"), and webhook examples use "Order cancelled by user", "TSTM Screening failure", "Not enough funds", none of which match the table text exactly.

### 4.6 ISO 20022 group status (`api/iso-2022-status-codes.md`)

`RCVD` received, further checks follow; `PDNG` pending; `ACCP` technical and customer-profile checks passed; `RJCT` rejected (example reason `<Cd>NARR</Cd>` with `<AddtlInf>SyntaxError</AddtlInf>`). These are standard ISO codes used by Inpay; only these four are documented.

## 5. Lifecycle

- **Payout (payment_request)** `state`: `received` -> `processing` -> `completed`; `pending` (future `requested_execution_date`) -> `processing`; `action_required` (insufficient funds, KYC) -> back to processing or `rejected`; `rejected` (validation, compliance, or merchant cancellation; cancellation is only possible in `pending` or `processing`); `returned` (after `processing`/`completed`). `completed` means accepted by the banking layer/processing partner, **not** confirmed credit to the beneficiary.
- **Order (pay-in)** `status`: `received`, `pending`, `cancelled`, `authorised` (optional), `processing`, `action_required`, `completed`, `processing_refund`, `action_required_for_refund`, `refunded`, `partially_refunded`, `returned`. Docs tables write these as `ACTION REQUIRED`; JSON examples use lower snake case (`action_required_for_refund`).
- **Payment attempt** (no webhooks of its own; visible inside `payments[]`): Bank Transfer `CREATED`, `INSTRUCTIONS PROVIDED`, `COMPLETED`; Instant Bank Transfer `CREATED`, `EXTRA BANK INFO REQUIRED`, `BANK INFO COLLECTED`, `CONSENT GIVEN`, `EXTERNAL REQUEST CREATED`, `EXTERNAL TRANSFER REQUIRED`, `REDIRECT TO BANK`, `REDIRECTED TO {{tenantCompany}}`, `BANK PROCESSING`, `USER CANCELLED`, `BANK AUTHORISED`, `BANK REJECTED`, `COMPLETED`; Wallet Transfer `CREATED`, `CONSENT REQUIRED`, `KYC REQUIRED`, `PROCESSING`, `USER_AUTHORISED`, `COMPLETED`, `REJECTED`, `USER CANCELLED`, `FAILED`. JSON examples show `created`, `bank_authorised`, `completed`, `consent_required`; the snake-case form of the other values is NOT DOCUMENTED.
- **Refund** (nested `refund.status`): examples show `created`, `processing`, `completed`; full list NOT DOCUMENTED.
- Chargebacks: none (bank transfer rails). Subscriptions/rebills: NOT DOCUMENTED (not offered). Card semantics: none.

## 6. Notifications (webhooks)

- Delivery: HTTPS POST (TLS 1.2+) to URLs registered through Inpay support/onboarding, optionally one per business unit. Payout webhook on every payment request state change; collection webhook on every Order status change. Payment-attempt changes do not trigger webhooks.
- Body: same structure as the GET resource (payout status / GetOrder). JSON, or XML for ISO 20022 merchants. No event name and no event id ("the current state of the resource indicates what has happened").
- Headers: `X-Request-ID` (same value on redelivery of the same state; duplicates should be answered 200), JWT model `Authorization: Bearer <JWT>` and `Accept: application/json` or `application/xml`.
- Signature (sensitive): PKCS#7 model, body encrypted with merchant certificate and signed with Inpay certificate. JWT model, RS256 JWT signed with Inpay's private key; verify `checksum` claim = SHA-256 of raw body and `iat` within 5 minutes. Whether the JWT model also applies to collection webhooks is NOT DOCUMENTED (the collections page only describes PKCS#7).
- Ack/retry: 2XX success; 3XX and 4XX stop further attempts; 5XX triggers retry. Retry schedule, count and ordering are NOT DOCUMENTED.

## 7. Identifiers

| Resource        | Inpay id                                                                                                      | Merchant reference                          | Links                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Payout          | `inpay_unique_reference` (e.g. `d1a2b3c4d5`)                                                                  | `end_to_end_id` (unique in merchant system) | `debtor_account.id` (virtual account)                      |
| ISO 20022 batch | `GrpHdr/MsgId`                                                                                                | `OrgnlMsgId`                                | per-transaction ids NOT DOCUMENTED in the examples         |
| Order           | `uuid`                                                                                                        | `reference` (unique per business unit)      | `primary_payment` -> a `payments[].inpay_unique_reference` |
| Payment attempt | `payments[].uuid`, `payments[].inpay_unique_reference` (e.g. `3ABCXYZ`, also used as bank transfer reference) | n/a                                         | parent Order `uuid`                                        |
| Refund          | `refund.uuid`                                                                                                 | n/a                                         | nested in Order                                            |
| Request         | `X-Request-ID` header                                                                                         | merchant-generated                          | echoed in response and used for webhook dedup              |

## 8. Sensitive fields

`Authorization` (static bearer token or JWT), `X-Auth-Uuid`, any PKCS#7 blob, certificates and private keys; `redirect_url` (contains a token); `debtor_account_number`, `creditor_account_number`, `creditor_account.*`, `debtor_full_name`, `creditor_full_name`, `creditor.*` and `ultimate_debtor.*` (name, address, `birthdate`, `id_number`, `id_type`, `email`, `mobile_number`); `debtor_account.id` (virtual account number); `debtor_bank_uuid`.

## 9. Structural detection hints

- Payout JSON: `inpay_unique_reference` together with `end_to_end_id`, `debtor_account.scheme_name == "VirtualAccount"`, `state` in the 7-value set, `reasons[]` with `category`/`code`/`details`, `timestamp` as `YYYY-MM-DD HH:MM:SS`.
- Order JSON: `amount` string plus `amount_cents` integer, `back_to_merchant_url`, `primary_payment`, `status_reasons` array of strings, `payments[].type` in `instant_bank_transfer`/`bank_transfer`/`wallet_transfer`, `debtor_bank_status_code`.
- Error JSON: `{"errors":[{"title","detail"}]}` or `{"error":{"code":1001,...}}`; JWT codes with `jwt_` prefix.
- ISO XML: `pain.002.001.11` / `pacs.002.001.12` with `<InitgPty><Nm>Inpay</Nm>` (template shows `{{tenantCompany}}`).
- Differs from supported providers: no Stripe `object`/`id` prefixes, no Adyen `pspReference`/`resultCode`, no PayPal `event_type`, no Mollie `resource`/`_links`, no Checkout.com `action_id`, no card fields. Differs from candidates: Trustly uses JSON-RPC envelopes (`method`, `params`, `signature`, `uuid`); none of the other candidates documents `inpay_unique_reference`.

## 10. Limitations and inconsistencies

1. PKCS#7 merchants receive encrypted bodies; PandaPayLens can only parse what the developer has already decrypted.
2. Webhooks have no event name/id; the timeline has to be inferred from state changes. Retry schedule and ordering NOT DOCUMENTED; collection webhooks carry no timestamp.
3. Pay-in reasons are free text, and example strings do not match the reason table.
4. Status spelling differs between docs tables (`ACTION REQUIRED`, `BANK AUTHORISED`) and JSON (`action_required`, `bank_authorised`).
5. OpenAPI swaps the descriptions of `debtor_account.id` and `scheme_name`; `currency` example is the literal `"ISO 4217"`.
6. Three different error body shapes; the JWT error code's response field is NOT DOCUMENTED.
7. Codes outside the reason table appear in examples (`beneficiary-account-not-existing`, `validation_schema_failed`, `awaiting_extended_kyc`).
8. The ISO pain.002 example uses `CreDtTm` `28/06/2021 15:24`, which is not an ISO date-time; the pacs.002 example uses ISO 8601.
9. Per-product payout request schemas and production hosts are account-specific; public docs show only default products.
10. Payout `completed` is not final credit to the beneficiary; `returned` can follow.
11. The reason table's `kind` values say `refund_cancelled`/`refund_returned` even for payouts; treat `kind` as docs metadata.

## 11. Proposed capability statuses

| Capability       | Proposed  | Justification                                                                                                                                                                                       |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | supported | 89-row payout reason table with stable machine codes, JWT error codes, numeric API codes and HTTP rules. Pay-in reasons need text matching, so they are weaker.                                     |
| paymentResponses | supported | Payout and Order JSON documented with examples for every state; ISO status reports documented. Only decrypted/JWT-model payloads are readable.                                                      |
| webhookParsing   | limited   | Bodies equal the documented resources, but there is no event type or id, PKCS#7 bodies are opaque, retry/order rules are not documented, and JWT coverage for collections is unclear.               |
| timeline         | limited   | Clear state machines, but payout timestamps lack a timezone, order webhooks have no timestamp, and payment-attempt transitions are not notified.                                                    |
| correlation      | supported | `end_to_end_id` + `inpay_unique_reference` for payouts; Order `uuid` + `reference`, `primary_payment` and `payments[].inpay_unique_reference` for pay-ins; nested refund; `X-Request-ID` for dedup. |
