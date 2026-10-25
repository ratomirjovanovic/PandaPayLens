# NMI (adapter id `nmi`): high-risk candidate research

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: developer docs read as raw Markdown from `https://docs.nmi.com/<path>.md` (the site's own `llms.txt` index) and the legacy Integration Portal HTML downloaded and converted to text; `www.nmi.com` marketing pages answer scripted downloads with HTTP 403 (bot challenge), so they were read through a summarizing page fetcher and their quotes are short. When the docs are silent the text says **NOT DOCUMENTED**.

---

## 0. Summary

| Item                 | Finding                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome              | `documentation_verified` (gate items 1-5, 8, 9, 10 = yes)                                                                                                                                                                                                                                                                                                                                                        |
| Classification       | `gateway` (strong evidence); `merchant_account_intermediary` (weak, via the "NMI Payments" product); not `acquiring`                                                                                                                                                                                                                                                                                             |
| Documented sectors   | Only general verticals: medical/dental, subscription/membership, parking, vending/kiosks, nonprofits, transit, travel and entertainment, food service, hospitality, education. **No high-risk sector is named by NMI anywhere read.**                                                                                                                                                                            |
| Documentation access | **Public.** docs.nmi.com and the legacy Integration Portal (`secure.nmi.com/.../integration_portal.php`) load without login. Only sandbox key retrieval needs a login (`guide.nmi.com`), which offline analysis does not need.                                                                                                                                                                                   |
| Documented codes     | `response`: 3 values. `response_code`: 35 distinct (34 in the Result Code Table + `301` on the rate-limit page). AVS: 29 rows, 28 distinct values (`B` listed twice with two meanings). CVV: 5. REST v5 `error_code`: 3 seen (`E_VALIDATION`, `E_INTERNAL`, `E_INVALID_SUBMISSION`), error `type`: 3. Query/webhook `condition`: 8. Webhook event types: 36.                                                     |
| Biggest limitation   | Not a high-risk specialist: NMI documents no high-risk sectors and says it works only through partners (ISOs, ISVs). Technically, a classic `transact.php` response carries no merchant/provider marker, so the same query string comes from every white-label brand. Also, `response_code` is a gateway mapping; raw processor codes appear only in Query API/webhook `processor_response_code`, with no table. |
| White-label note     | NMI is the underlying gateway; its formats are its own. NMI says partners can "white label everything" and customize "Logos, colors, and URLs", so the same `transact.php`/`query.php`/webhook formats are emitted under reseller brands and hostnames. Conversely, NMI runs Authorize.Net (AIM/SIM/XML) and SparrowOne emulators, so some NMI traffic uses those foreign formats.                               |

---

## 1. Sources

All read on 2026-10-25. `updatedAt` is the page's own front-matter timestamp where present.

| URL                                                                                                                    | What it covers                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.nmi.com/llms.txt                                                                                          | Index of all docs pages (discovery)                                                                                                                                                                                                                  |
| https://secure.nmi.com/merchants/resources/integration/integration_portal.php                                          | Legacy Integration Portal (public): Payment API variables, Transaction Response Variables, Result Code, AVS, CVV tables, rate limits, Query API variables and XML sample, Three-Step Redirect XML, Payer Authentication test results, webhooks setup |
| https://docs.nmi.com/reference/transactions-processing.md (2026-09-02)                                                 | Classic Payment API OpenAPI (`POST /transact.php`), `Response` schema, request/response examples, Result Code Table                                                                                                                                  |
| https://docs.nmi.com/reference/response-codes.md (2026-08-10)                                                          | `response`, `response_code`, AVS and CVV tables                                                                                                                                                                                                      |
| https://docs.nmi.com/reference/rate-limiting.md                                                                        | `response_code=301` rate-limit response and HTTP 429                                                                                                                                                                                                 |
| https://docs.nmi.com/reference/query.md (2026-09-02)                                                                   | Query API (`query.php`) OpenAPI, `condition` values                                                                                                                                                                                                  |
| https://docs.nmi.com/reference/overview.md (2026-08-11)                                                                | Webhooks: envelope, `Webhook-Signature` verification, source IPs                                                                                                                                                                                     |
| https://docs.nmi.com/reference/retry-logic.md                                                                          | Webhook retry policy                                                                                                                                                                                                                                 |
| https://docs.nmi.com/reference/transaction-events.md                                                                   | Transaction event types and samples, `entry_mode` table                                                                                                                                                                                              |
| https://docs.nmi.com/reference/check-status.md                                                                         | ACH check status events                                                                                                                                                                                                                              |
| https://docs.nmi.com/reference/recurring-events.md                                                                     | Plan/subscription events                                                                                                                                                                                                                             |
| https://docs.nmi.com/reference/settlement-events.md                                                                    | Batch settlement events                                                                                                                                                                                                                              |
| https://docs.nmi.com/reference/chargeback-events.md (2026-10-15)                                                       | Chargeback batch event                                                                                                                                                                                                                               |
| https://docs.nmi.com/reference/acu-events.md                                                                           | Automatic Card Updater events                                                                                                                                                                                                                        |
| https://docs.nmi.com/reference/create-sale-v5.md (2026-08-17)                                                          | REST v5 OpenAPI: `TransactionResponse`, `ErrorResponse` schemas                                                                                                                                                                                      |
| https://docs.nmi.com/reference/get-payment-v5.md                                                                       | REST v5 GET payment, HTTP statuses                                                                                                                                                                                                                   |
| https://docs.nmi.com/docs/payment-migration-playbook.md                                                                | Classic vs REST v5 differences                                                                                                                                                                                                                       |
| https://docs.nmi.com/docs/payment-code-examples.md (2026-07-22)                                                        | Side-by-side Classic and REST examples, validation error example                                                                                                                                                                                     |
| https://docs.nmi.com/docs/full-transaction-lifecycle-example.md                                                        | REST examples (vault, CIT/MIT `initial_transaction_id`)                                                                                                                                                                                              |
| https://docs.nmi.com/reference/getting-started.md                                                                      | API families overview, white-label statement                                                                                                                                                                                                         |
| https://docs.nmi.com/reference/gateway-emulator.md                                                                     | Authorize.Net and Sparrow emulators                                                                                                                                                                                                                  |
| https://docs.nmi.com/docs/collectjs.md                                                                                 | Collect.js tokens (single use, 24 h)                                                                                                                                                                                                                 |
| https://docs.nmi.com/reference/webhook-events-2.md, https://docs.nmi.com/reference/sendmerchantchargebackaddedevent.md | Merchant Sign-Up (partner) webhooks, `Signature` header                                                                                                                                                                                              |
| https://docs.nmi.com/docs/validation-errors.md, https://docs.nmi.com/docs/requests-responses.md                        | CardEase XML (in-person EMV sandbox); out of scope                                                                                                                                                                                                   |
| https://www.nmi.com/sitemap_index.xml, /page-sitemap.xml, /legal-sitemap.xml                                           | Discovery of company pages                                                                                                                                                                                                                           |
| https://www.nmi.com/resources/payments-101/why-nmi/customizable-white-label-payment-gateway/                           | White-label gateway statements                                                                                                                                                                                                                       |
| https://www.nmi.com/who-we-serve/independent-sales-iso/                                                                | ISO white-label, no direct merchant recruiting, 150+ processors                                                                                                                                                                                      |
| https://www.nmi.com/who-we-serve/other-industries/                                                                     | Industry verticals named by NMI                                                                                                                                                                                                                      |
| https://www.nmi.com/products/nmi-payments/                                                                             | NMI Payments (merchant onboarding; Anovia Payments ISO registrations)                                                                                                                                                                                |
| https://www.nmi.com/about-us/who-we-are/                                                                               | Company description, partner model                                                                                                                                                                                                                   |
| https://www.nmi.com/nmi-payments-merchant-processing-and-gateway-agreement/                                            | Page loads, but agreement text is a download; not read                                                                                                                                                                                               |

---

## 2. Qualification gate

| #   | Item                                                        | Answer             | Evidence                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active                                      | yes                | who-we-are: serves "over 6,000 technology partners and more than a million merchants"; docs pages updated up to 2026-10-15 (chargeback-events).                                                                                                   |
| 2   | Payment service operational                                 | yes                | Current API reference with sandbox server `https://sandbox.nmi.com/api` and production POST URL `https://secure.nmi.com/api/transact.php` (transactions-processing, portal). Playbook says the Classic API "will continue to be fully supported". |
| 3   | Docs publicly accessible                                    | yes                | docs.nmi.com and the legacy portal load without login. Gated: sandbox keys ("Log in to guide.nmi.com to retrieve Sandbox Keys", gateway-emulator). Not needed for offline analysis.                                                               |
| 4   | API families/versions identified                            | yes                | Classic Payment API `transact.php`, Query API `query.php` (XML), Three-Step Redirect `api/v2/three-step` (XML), REST `/api/v5/payments/...` (JSON), Webhooks (JSON).                                                                              |
| 5   | Offline-examinable formats/examples                         | yes                | Query-string response examples (transactions-processing, rate-limiting, payment-code-examples), XML Query sample (portal), JSON webhook samples for every event family.                                                                           |
| 6   | Sectors documented by provider                              | yes (general only) | other-industries lists general verticals (see section 3). No high-risk sector named.                                                                                                                                                              |
| 7   | Regional/regulatory limits identified                       | unclear            | Only "Certifications" tabs for US, UK, EU, ROI and "Trading in the UK as Network Merchants Ltd." No country restriction list. Many features are processor-dependent.                                                                              |
| 8   | Diagnostic value                                            | yes                | `response` + 35 `response_code` values, AVS/CVV tables, Query `condition`/`action_type`, 36 webhook event types.                                                                                                                                  |
| 9   | Own technical format (not a white-label of another gateway) | yes                | NMI is the gateway behind white-label brands (it says partners "white label everything"); formats are NMI's own. It also emulates Authorize.Net/Sparrow formats (gateway-emulator).                                                               |
| 10  | No credentials needed for examples                          | yes                | All examples are in public docs; analysis needs no account.                                                                                                                                                                                       |

**Outcome: `documentation_verified`.**

---

## 3. Classification and documented sectors

| Value                                                                          | Applies        | Evidence                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`                                                                      | yes            | White-label page title "Customizable White-Label Payment Gateway"; portal describes the "Payment Gateway" receiving POSTs and settling batches.                                                                                                         |
| `merchant_account_intermediary`                                                | weak / unclear | nmi-payments: platform to "acquire and onboard new merchants"; lists "Anovia Payments, LLC is a registered ISO/MSP of Merrick Bank" and of Wells Fargo Bank and Elavon DAC. The relationship between NMI and Anovia is not explained on the pages read. |
| `acquiring`                                                                    | no             | No bank/acquirer status claimed; who-we-are: "we work exclusively through partners".                                                                                                                                                                    |
| `card_processing`                                                              | unclear        | who-we-are mentions a "payment processing platform", but transactions route to 150+ third-party processors (`processor_id`).                                                                                                                            |
| `payment_facilitator`, `wallet`, `alternative_payment_method`, `orchestration` | no evidence    | PayFacs appear only as a customer audience. Apple Pay/Google Pay are passed through, not NMI wallets.                                                                                                                                                   |

Documented sectors (provider's own words, https://www.nmi.com/who-we-serve/other-industries/): medical practices ("medical practices need to stay on top of billing"), membership/subscription ("membership-based businesses like gyms and subscription services"), parking operators, vending/kiosks, nonprofits ("donation processing"), transit ("transit industry"), travel and entertainment, food service, hospitality, educational institutions.

NMI documents **no** high-risk sector (adult, iGaming, nutraceuticals, CBD, crypto, etc.) on any page read. Do not describe NMI as accepting high-risk merchants. Eligibility depends on jurisdiction, licensing and underwriting by the partner ISO/acquirer and the connected processor; approval for one sector does not imply another.

Regional/regulatory: certifications listed for "US", "UK", "EU", "ROI"; UK trading name Network Merchants Ltd. (footer on nmi.com pages). Apple Pay depends on supported processors (Collect.js); chargeback events are delivered only "If your processor supports chargeback reporting" (overview). ACH tokenization covers US and CAN accounts (Collect.js).

---

## 4. API families and versions

| Family                                          | Endpoint                                                                                                           | Request                                                                                                   | Response                                                                                | Priority                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| Classic Payment API (Direct Post)               | `POST https://secure.nmi.com/api/transact.php` (sandbox `https://sandbox.nmi.com/api/transact.php`)                | form-encoded, `security_key` in body, `type=sale/auth/capture/void/refund/credit/validate/offline/update` | query string `key=value&...`                                                            | **1st**                         |
| Webhooks (merchant)                             | POST to merchant HTTPS URL                                                                                         | n/a                                                                                                       | JSON `{event_id, event_type, event_body}`                                               | **1st**                         |
| Query API                                       | `POST https://secure.nmi.com/api/query.php`                                                                        | form-encoded                                                                                              | XML `<nm_response>`                                                                     | 2nd (timeline)                  |
| REST API v5                                     | `/api/v5/payments/sale`, `/api/v5/payments/{transaction_id}/capture`, `GET /api/v5/payments/{transaction_id}` etc. | JSON, raw key in `Authorization`                                                                          | JSON `object: "transaction"`; errors JSON + HTTP status                                 | 2nd (new integrations)          |
| Three-Step Redirect                             | `https://secure.nmi.com/api/v2/three-step`                                                                         | XML                                                                                                       | XML with hyphenated elements (`result`, `result-text`, `result-code`, `transaction-id`) | 3rd                             |
| Recurring / Customer Vault / Invoicing          | same `transact.php`                                                                                                | form-encoded                                                                                              | same query string (`subscription_id`, `customer_vault_id`, `invoice_id`)                | with 1st                        |
| Collect.js / Payment Component / Gateway.js 3DS | browser JS                                                                                                         | n/a                                                                                                       | JS callbacks (token; 3DS events)                                                        | out of scope initially          |
| Merchant Sign-Up (partner) webhooks             | partner URL                                                                                                        | n/a                                                                                                       | JSON, `Signature` header                                                                | out of scope                    |
| Emulators (Authorize.Net AIM/SIM/XML, Sparrow)  | `transact.dll`, `ausi.php`, `transrequest.php`, `spar.php`                                                         | foreign formats                                                                                           | foreign formats                                                                         | out of scope (detection caveat) |
| CardEase XML (in-person EMV)                    | n/a                                                                                                                | XML                                                                                                       | XML                                                                                     | out of scope                    |

No API version numbers beyond OpenAPI `info.version: 1.0.0` and path prefixes `v2`/`v5`. Implement first: Classic query-string responses plus merchant webhooks.

---

## 5. Formats

- Classic Payment API: responses "returned in the body of the HTTP response in a query string name/value format delimited by ampersands" (portal, transactions-processing). payment-code-examples shows `Content-Type: text/plain`; the OpenAPI labels the 200 response `application/x-www-form-urlencoded` and renders examples as JSON objects (docs artifact).
- Standard fields: `response`, `responsetext`, `authcode`, `transactionid`, `avsresponse`, `cvvresponse`, `orderid`, `type`, `response_code`. Conditional: `customer_vault_id`, `kount_score`, `merchant_advice_code` (only if configured), `emv_auth_response_data`, `amount_authorized`, `partial_payment_id`, `partial_payment_balance`, `subscription_id`, `invoice_id`, `payment_terms`, `platform_id`.
- `type` enum in responses: `sale`, `auth`, `validate`, `credit`, `offline`, `capture`, `void`, `refund`, `complete_partial_payment`, `add_invoice`, `update_invoice`, `send_invoice`, `close_invoice`, `add_plan`, `edit_plan`, `add_subscription`, empty.
- `responsetext` can carry a `REFID:<n>` suffix (e.g. "Invalid amount REFID:98765432").
- REST v5: JSON. Success fields `object`, `id`, `type`, `amount`, `currency`, `auth_code`, `avs_response`, `cvv_response`, `customer_vault_id`, `status`, `response`, `response_text`, `response_code`, `processor_id`, `created_date`, `updated_date`, `payment_details`, `billing_address`, `actions[]`. Errors: `type`, `error_code`, `message`, `ref_id`, `details[{fieldName, message}]` with HTTP 400/401/404/409/429.
- Query API: XML `<nm_response><transaction>...<action>...</action></transaction></nm_response>`; times in UTC, dates `YYYYMMDDhhmmss`. Query error format: **NOT DOCUMENTED**.
- Webhooks: JSON (see section 8).

Example A, decline, transcribed from the OpenAPI example in https://docs.nmi.com/reference/transactions-processing.md (shown there as a JSON object; serialized here in the documented query-string form):

```
response=2&responsetext=DECLINE&authcode=&transactionid=8558718571&avsresponse=&cvvresponse=&orderid=&type=sale&response_code=200
```

Example B, rate limit, verbatim from https://docs.nmi.com/reference/rate-limiting.md:

```
response=3&responsetext=Rate limit exceeded&authcode=&transactionid=&avsresponse=&cvvresponse=&orderid=&type=&response_code=301
```

Example C, REST validation error (HTTP 400), from https://docs.nmi.com/docs/payment-code-examples.md:

```json
{
  "type": "validationError",
  "error_code": "E_INVALID_SUBMISSION",
  "message": "The provided data is invalid.",
  "ref_id": null,
  "details": [{ "fieldName": "amount", "message": "This field is required." }]
}
```

---

## 6. Codes

Categories and retry classes below are **suggestions** for PandaPayLens, not NMI statements. Meanings are short paraphrases; see https://docs.nmi.com/reference/response-codes.md for the source wording.

### 6a. Status values

| Field                                  | Value                                                         | Meaning                                                     | Suggested category / retry           |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| `response` / `result` (three-step)     | `1`                                                           | approved                                                    | success                              |
|                                        | `2`                                                           | declined                                                    | use `response_code`                  |
|                                        | `3`                                                           | data error or system error                                  | use `response_code` / `responsetext` |
| `condition` (Query, webhooks)          | `pending`                                                     | auth awaiting capture                                       | state                                |
|                                        | `pendingsettlement`                                           | awaiting settlement                                         | state                                |
|                                        | `in_progress`                                                 | Three-Step not yet finished; becomes `abandoned` after 24 h | state                                |
|                                        | `abandoned`                                                   | Three-Step timed out                                        | state                                |
|                                        | `failed`                                                      | transaction failed                                          | state                                |
|                                        | `canceled`                                                    | voided                                                      | state                                |
|                                        | `complete`                                                    | settled                                                     | state                                |
|                                        | `unknown`                                                     | unknown processing error                                    | unknown / manual_review              |
| webhook `action.success`               | `1` / `0`                                                     | action succeeded / not                                      | state                                |
| REST `status`                          | `pendingsettlement`, `approved` seen in examples              | no enum in schema                                           | **NOT DOCUMENTED** as a list         |
| REST device `payment-request` `status` | `pending`, `inFlight`, `interactionComplete` seen in examples | in-person only                                              | out of scope                         |

### 6b. `response_code` (Result Code Table, plus 301)

| Code                       | Meaning (paraphrase)                                | Category                   | Retry class                                               |
| -------------------------- | --------------------------------------------------- | -------------------------- | --------------------------------------------------------- |
| `100`                      | approved                                            | n/a (success)              | n/a                                                       |
| `200`                      | processor declined, generic                         | card_declined              | customer_action_required                                  |
| `201`                      | do not honor                                        | card_declined              | customer_action_required                                  |
| `202`                      | not enough funds                                    | insufficient_funds         | customer_action_required                                  |
| `203`                      | over limit                                          | insufficient_funds         | customer_action_required                                  |
| `204`                      | transaction type not permitted                      | payment_method_unavailable | do_not_retry                                              |
| `220`                      | wrong payment details                               | invalid_request            | customer_action_required                                  |
| `221`                      | issuer does not exist                               | invalid_request            | customer_action_required                                  |
| `222`                      | issuer has no such card number                      | card_declined              | customer_action_required                                  |
| `223`                      | card expired                                        | card_declined              | customer_action_required                                  |
| `224`                      | bad expiry date                                     | invalid_request            | customer_action_required                                  |
| `225`                      | bad security code                                   | card_declined              | customer_action_required                                  |
| `226`                      | bad PIN                                             | authentication_failed      | customer_action_required                                  |
| `240`                      | cardholder should call issuer                       | card_declined              | customer_action_required                                  |
| `250`, `251`, `252`, `253` | pick up / lost / stolen / fraudulent card           | fraud_or_risk              | do_not_retry                                              |
| `260`                      | decline with further instructions in `responsetext` | card_declined              | manual_review                                             |
| `261`                      | stop all recurring payments                         | card_declined              | do_not_retry                                              |
| `262`                      | stop this recurring program                         | card_declined              | do_not_retry                                              |
| `263`                      | updated cardholder data available                   | card_declined              | customer_action_required                                  |
| `264`                      | retry after a few days                              | card_declined              | retry_conditionally                                       |
| `300`                      | rejected by gateway (reason in `responsetext`)      | invalid_request            | do_not_retry                                              |
| `301`                      | Payment API rate limit (rate-limiting page only)    | rate_limiting              | retry_conditionally (NMI: wait, do not retry immediately) |
| `400`                      | processor returned an error                         | provider_unavailable       | retry_conditionally                                       |
| `410`                      | merchant configuration invalid                      | configuration              | do_not_retry                                              |
| `411`                      | merchant account inactive                           | configuration              | do_not_retry                                              |
| `420`                      | communication error                                 | network_or_timeout         | retry_conditionally (check Query API first)               |
| `421`                      | communication error with issuer                     | network_or_timeout         | retry_conditionally                                       |
| `430`                      | duplicate at processor                              | duplicate_request          | do_not_retry                                              |
| `440`                      | processor format error                              | invalid_request            | manual_review                                             |
| `441`                      | transaction data invalid                            | invalid_request            | do_not_retry                                              |
| `460`                      | processor feature unavailable                       | configuration              | do_not_retry                                              |
| `461`                      | card brand not supported                            | payment_method_unavailable | customer_action_required                                  |

Other codes: HTTP `429` (system-wide rate limit) -> rate_limiting / retry_conditionally. Raw `processor_response_code` / `processor_response_text` (Query, webhooks) have **no documented table**. `merchant_advice_code` values: **NOT DOCUMENTED** (Mastercard MAC passed through).

### 6c. REST v5 error identifiers

| Field        | Value                                                       | Category                                               | Retry class                                       |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| `error_code` | `E_VALIDATION` (schema example)                             | invalid_request                                        | do_not_retry                                      |
| `error_code` | `E_INVALID_SUBMISSION` (code-examples page)                 | invalid_request                                        | do_not_retry                                      |
| `error_code` | `E_INTERNAL` (schema example)                               | provider_unavailable                                   | retry_conditionally                               |
| `type`       | `validationError` / `authenticationError` / `internalError` | invalid_request / configuration / provider_unavailable | do_not_retry / do_not_retry / retry_conditionally |

A full `error_code` list is **NOT DOCUMENTED**.

### 6d. AVS and CVV (`avsresponse`, `avs_response`, `avs-result`; `cvvresponse`, `csc_response`, `cvv-result`)

| AVS code(s)   | Meaning (paraphrase)                            |
| ------------- | ----------------------------------------------- |
| `X`           | address and 9-digit ZIP match                   |
| `Y`, `D`, `M` | address and 5-digit ZIP match                   |
| `2`, `6`      | address, 5-digit ZIP and name match             |
| `A`, `B`      | address only matches (`B` is also listed below) |
| `3`, `7`      | address and name match only                     |
| `W`           | 9-digit ZIP only matches                        |
| `Z`, `P`, `L` | 5-digit ZIP only matches                        |
| `1`, `5`      | 5-digit ZIP and name match only                 |
| `N`, `C`      | neither address nor ZIP matches                 |
| `4`, `8`      | no address, ZIP or name match                   |
| `U`           | address info unavailable                        |
| `G`, `I`      | non-US issuer not participating                 |
| `R`           | issuer system unavailable                       |
| `E`           | not a mail/phone order                          |
| `S`           | service not supported                           |
| `0`, `O`, `B` | AVS not available                               |

| CVV code | Meaning (paraphrase)            |
| -------- | ------------------------------- |
| `M`      | match                           |
| `N`      | no match                        |
| `P`      | not processed                   |
| `S`      | merchant says code not on card  |
| `U`      | issuer not certified or no keys |

AVS/CVV results are informational; treat `N` CVV and AVS mismatches as fraud_or_risk hints only when the transaction was declined.

### 6e. Payer Authentication (Gateway.js 3DS, client side; portal)

Failure `code`: `TRANSACTION_STATUS_N` (not authenticated; authentication_failed / customer_action_required), `TRANSACTION_STATUS_U` (authentication could not be performed; authentication_failed / retry_conditionally). Error `type`: `gatewayError`, `integrationError`. `cardholder_auth` values: `verified`, `attempted`. Out of scope initially.

---

## 7. Lifecycle

- **sale**: authorized and flagged for settlement at once. **auth**: authorized, not flagged; needs **capture** (amount up to the original). **void**: cancels an unsettled sale/capture or an uncaptured auth. **refund**: reverses a settled or pending-settlement transaction. **credit**: standalone credit, usually disabled. **validate**: account verification. **update**: adds order data (tracking etc.). **offline**: listed in `type` enum; semantics not described beyond that. (portal, Transaction Types)
- Query `action_type` values per action: `sale`, `refund`, `credit`, `auth`, `capture`, `void`, `return` (ACH returns and card chargebacks); the XML sample also shows `level3` and `settle`; check events show `check_return`, `check_late_return`.
- Query `source`: `api`, `batch_upload`, `mobile`, `quickclick`, `quickbooks`, `recurring`, `swipe`, `virtual_terminal`, `internal` (settlement).
- Typical condition path (from docs samples): auth `pending` -> capture `pendingsettlement` -> settle `complete`; void -> `canceled`; decline -> `failed`; ACH return -> `failed`.
- **Recurring**: plans and subscriptions via `transact.php` (`recurring=add_subscription` etc.) or REST v5; events `recurring.plan.add/update/delete`, `recurring.subscription.add/update/delete`. Recurring charges appear as normal transactions with `source=recurring` (Query). A recurring charge webhook carrying `subscription_id`: **NOT DOCUMENTED** (transaction event samples have no subscription field).
- **Chargebacks**: `chargeback.batch.complete` (batch summary with `chargebacks[]`: `id`, `date`, `amount`, `reason` like "101: Introductory chargeback"), only if the processor reports chargebacks. Query `action_type=return` also covers card chargebacks.
- **Settlement**: `settlement.batch.complete` / `settlement.batch.failure` with `batch_id`, `transaction_ids[]`, totals by card type.
- **ACH**: `transaction.check.status.settle/return/latereturn`.
- **Account updater**: `acu.summary.automaticallyupdated/contactcustomer/closedaccount`.
- Payouts and wallet transfers: none documented (not applicable).

---

## 8. Notifications (merchant webhooks)

| Aspect                              | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport                           | HTTPS POST to merchant URL; URL must be https with valid TLS (overview)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Body                                | JSON envelope `event_id`, `event_type`, `event_body`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Content-Type header                 | **NOT DOCUMENTED** (samples are JSON; PHP sample uses `json_decode`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Event types (36)                    | `transaction.{sale,auth,capture,void,refund,credit,validate}.{success,failure,unknown}` (21); `transaction.check.status.{settle,return,latereturn}`; `recurring.plan.{add,update,delete}`; `recurring.subscription.{add,update,delete}`; `settlement.batch.{complete,failure}`; `chargeback.batch.complete`; `acu.summary.{automaticallyupdated,contactcustomer,closedaccount}`                                                                                                                                                                              |
| Transaction `event_body` fields     | `merchant{id,name}`, `features{is_test_mode}`, `transaction_id`, `transaction_type` (`cc`/`ck`/cash), `condition`, `processor_id`, `order_id`, `ponumber`, `requested_amount`, `currency`, `authorization_code`, `billing_address{}`, `shipping_address{}`, `card{cc_number masked, cc_exp, avs_response, csc_response, cavv, eci, entry_mode, cc_type...}` or `check{}`, `merchant_defined_fields{}`, `action{amount, action_type, date, success, source, api_method, response_text, response_code, processor_response_code, processor_response_text, ...}` |
| Signature (sensitive)               | Header `Webhook-Signature: t=<nonce>,s=<signature>`; signature = hex HMAC-SHA256 of `<nonce>.<raw body>` with the merchant's webhook signing key (PHP sample in overview). Verification needs the key; PandaPayLens should only detect and redact.                                                                                                                                                                                                                                                                                                           |
| Acknowledgement                     | HTTP 200                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Retry                               | up to 20 re-attempts over about 3 days (15 s, 3 x 60 s, 5 min, 15 min, 30 min, 10 x hourly, 2 x 12 h, final after 24 h); schedule may change or be reduced under backlog (retry-logic)                                                                                                                                                                                                                                                                                                                                                                       |
| Ordering                            | **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Duplicates                          | `event_id` is "A unique identifier for this event"; whether retries reuse it is **NOT DOCUMENTED** (presumably yes)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Source IPs                          | 104.192.32.81-87 and 104.192.36.81-87                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Partner (Merchant Sign-Up) webhooks | Different product: header `Signature`, `hash_hmac('sha256', EVENT JSON, SUBSCRIPTION SECRET)`, event types `application.*`, `merchant.*` (e.g. `merchant.chargeback.added`). Out of scope.                                                                                                                                                                                                                                                                                                                                                                   |

---

## 9. Identifiers

| Identifier                                                        | Where                                            | Notes                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transactionid` / `transaction_id` / `transaction-id` / REST `id` | Classic / Query and webhooks / Three-Step / REST | Numeric string. Docs examples: capture and void keep the auth's id (request and response both `8564830211`); refund returns a new id (`8564972358`). Webhook samples: auth, capture and void share `8584341675`; refund sample has a different id. |
| Parent/original reference                                         | none in responses or webhooks                    | **NOT DOCUMENTED**. Follow-up requests send the original `transactionid`; REST CIT/MIT uses `initial_transaction_id` in requests.                                                                                                                  |
| REST `actions[].id`                                               | REST                                             | id per action within a transaction                                                                                                                                                                                                                 |
| `orderid` / `order_id`                                            | all                                              | Merchant reference, optional, may be empty                                                                                                                                                                                                         |
| `subscription_id`                                                 | Classic, Query, recurring events                 |                                                                                                                                                                                                                                                    |
| `customer_vault_id`, `billing_id`                                 | Classic, REST, Query                             | Vault customer and billing record                                                                                                                                                                                                                  |
| `partial_payment_id`, `invoice_id`, `platform_id`                 | Classic                                          |                                                                                                                                                                                                                                                    |
| `batch_id`, `processor_batch_id`                                  | Query actions, settlement events                 |                                                                                                                                                                                                                                                    |
| `event_id`                                                        | webhooks                                         | UUID                                                                                                                                                                                                                                               |
| `authcode` / `authorization_code` / `auth_code`                   | all                                              | Issuer auth code                                                                                                                                                                                                                                   |
| `merchant.id`, `processor_id`                                     | webhooks, Query                                  | Gateway merchant id and processor                                                                                                                                                                                                                  |
| `REFID:<n>` / REST `ref_id`                                       | error text                                       | Gateway reference for errors                                                                                                                                                                                                                       |

---

## 10. Sensitive fields

- Credentials: `security_key` (Classic request body; docs publish a shared demo key, still redact), REST `Authorization` header (raw private key), Three-Step `api-key`, webhook signing key, `Webhook-Signature` header value, partner `Signature` header.
- Card/bank data in requests: `ccnumber`, `ccexp`, `cvv`, `checkaba`, `checkaccount`, track/EMV data, `payment_token`, Three-Step `token-id`.
- In responses/webhooks/Query: `cc_number` (masked), `cc_hash`, `cc_bin`, `check_account`, `check_aba`, `check_hash`, `network_token`, `token_or_card_number`, `cavv`, `xid`, `directory_server_id`, `emv_auth_response_data`, `signature_image` (base64).
- Personal data: names, addresses, `email`, `phone`, `ip_address`, `social_security_number`, `drivers_license_number`, `drivers_license_dob`, `drivers_license_state`, `customertaxid`, chargeback `customer_name`.

---

## 11. Structural detection hints

Strong NMI signals:

1. Query string with the classic key set, usually in this order: `response=` (1/2/3), `responsetext=`, `authcode=`, `transactionid=`, `avsresponse=`, `cvvresponse=`, `orderid=`, `type=`, `response_code=` (3-digit). Keys are lowercase without separators (`responsetext`, `avsresponse`).
2. `responsetext` containing `REFID:`.
3. Webhook JSON with exactly `event_id` (UUID), `event_type` (lowercase dotted, e.g. `transaction.sale.success`, `settlement.batch.complete`) and `event_body` containing `condition`, `action{action_type, success, response_code, source, api_method}`, `features.is_test_mode`.
4. Query XML root `<nm_response>` with `<transaction>` and repeated `<action>`.
5. Three-Step XML with hyphenated elements `result-text`, `result-code`, `transaction-id`, `form-url`, `token-id`.
6. REST JSON `object: "transaction"` with `response`, `response_text`, `response_code` (3-digit), `processor_id`, `actions[]`; errors with `error_code` `E_*` and `details[].fieldName`.
7. Hosts: `secure.nmi.com`, `sandbox.nmi.com`, `secure.networkmerchants.com`, `test.transactiongateway.com` (seen in NMI docs links), paths `/api/transact.php`, `/api/query.php`, `/api/v2/three-step`, `/api/v5/payments`.

Versus supported providers: Stripe (`evt_`/`pi_` ids, `type` + `data.object`), Adyen (`pspReference`, `notificationItems`), Checkout.com (`type` like `payment_captured`, `data`), PayPal (`event_type` uppercase like `PAYMENT.CAPTURE.COMPLETED`, `resource`), Braintree (form-encoded `bt_signature`/`bt_payload`), Mollie (body `id=tr_...` only), Square (`event_id` plus `type`, `merchant_id`, `data`; no `event_type`/`event_body`), payabl. (query string with `transactionid` and `transid`, `status`, `errmsg`; no `response_code`). The NMI query string never has `transid`, `status` or `errormessage`.

Versus other candidates (emerchantpay, Ecommpay, Paymentwall, MiFinity, AstroPay, Skrill): their formats are not researched in this file. Use the NMI-only markers above (`response_code` 3-digit table with `response` 1/2/3, `nm_response`, `event_body`, `Webhook-Signature: t=...,s=...`) and check them against those research files when written.

False-positive / attribution risk: NMI says partners can "white label everything" with custom "Logos, colors, and URLs", so many reseller gateway brands emit byte-identical NMI formats from their own hostnames. A detection should say "NMI-format gateway" and not name the reseller. Conversely, NMI's Authorize.Net and Sparrow emulators produce foreign formats that should not be attributed to NMI.

---

## 12. Limitations, ambiguities, inconsistencies

1. No high-risk sectors documented; NMI sells only through partners, so sector eligibility is decided by ISOs/acquirers.
2. AVS table lists `B` twice: "address match only" and "AVS not available".
3. OpenAPI example "Failed to Create Plan" has `response=3` with `response_code=100`; `response_code` cannot be trusted alone, read `response` first.
4. Classic response content type: `text/plain` in code examples, `application/x-www-form-urlencoded` in OpenAPI, examples rendered as JSON objects.
5. Partial-payment-in-full example repeats `response_code` (duplicate JSON key).
6. Webhook samples reuse the same `event_id` across different events (auth success and auth failure; capture success and refund success), so samples are not reliable for duplicate testing.
7. `301` is missing from the Result Code Table; only on the rate-limit page.
8. REST `error_code` examples differ (`E_VALIDATION` vs `E_INVALID_SUBMISSION`); no full list. REST `status` has no enum (`pendingsettlement` and `approved` both appear).
9. Raw `processor_response_code` has no table and depends on the connected processor (150+).
10. Refund id semantics: new id in Classic examples; whether webhooks or Query link a refund to its original transaction is **NOT DOCUMENTED**.
11. Webhook content type, ordering and `event_id` stability across retries are **NOT DOCUMENTED**.
12. Company pages were read through a summarizer after HTTP 403 on direct download; their quotes are short and less exact than the docs quotes.
13. The merchant processing agreement text (possible prohibited-business list) is a download and was not read.

---

## 13. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                  |
| ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **supported** | Public 35-value `response_code` table with clear meanings, `response` 1/2/3, AVS/CVV tables, rate-limit code; `processor_response_code` and REST `error_code` lists are incomplete, so fall back to `unknown`. |
| paymentResponses | **supported** | Stable, well-exemplified Classic query-string format; REST v5 JSON and Three-Step XML documented as secondary.                                                                                                 |
| webhookParsing   | **supported** | Documented JSON envelope, 36 event types with samples, `event_id`, signature header format; ordering and content type undocumented (note as caveats).                                                          |
| timeline         | **limited**   | `condition` and `action[]` (with `date`) give a clear path in Query XML; webhooks carry one action each, ordering not guaranteed, chargebacks only as batch summaries and only for some processors.            |
| correlation      | **limited**   | Capture/void reuse the auth `transactionid`, but refunds get a new id with no parent field; `order_id` is optional; recurring charges have no documented `subscription_id` in transaction events.              |
