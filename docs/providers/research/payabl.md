# payabl. (adapter id `payabl`): provider research

Status: research notes for building a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from payabl.'s first-party documentation as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Method: every page was fetched as raw Markdown (`https://docs.payabl.com/<path>.md`, the format the site itself serves through its `llms.txt` agent index) and read in full. The `updatedAt` value is the page's own front-matter timestamp.
- Brand note: many examples on the site still carry legacy names (`Powercash21`, `Powerpay21`, `inatec`, `sandbox.powercash21.com`, `sandbox.powerpay21.com`, `api.powercash.de`). The examples show these are the same gateway under earlier branding. Real pasted payloads may contain them.

---

## 1. Sources

All URLs below were read on 2026-10-25.

| URL                                                                     | updatedAt  | What it covers                                                                                             |
| ----------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| https://docs.payabl.com/llms.txt                                        | n/a        | Index of every docs page (used to discover pages)                                                          |
| https://docs.payabl.com/docs/response-codes-detailed                    | 2026-10-14 | **Main payabl. gateway response code table** (`status`/`errormessage`), plus the `-5004.xx` risk sub-codes |
| https://docs.payabl.com/docs/cft-response-code                          | 2026-09-25 | Codes for Credit Fund Transfer (payouts): payabl. codes, issuer codes, Mastercard OCT codes                |
| https://docs.payabl.com/docs/error-codes-for-credit-cards-2             | 2026-08-25 | Issuer/scheme decline codes as returned in `errorcode`                                                     |
| https://docs.payabl.com/docs/mastercard-merchant-advice-codes           | 2025-11-11 | Mastercard MAC suffix format (`errorcode=59.03`) and MAC values                                            |
| https://docs.payabl.com/docs/error-codes-mastercard                     | 2026-06-02 | Raw Mastercard network response codes (not in llms.txt index; linked from Web SDK Error Handling)          |
| https://docs.payabl.com/docs/error-codes-visa                           | 2026-06-02 | Raw Visa network response codes (not in llms.txt index; linked from Web SDK Error Handling)                |
| https://docs.payabl.com/docs/error-codes-apm                            | 2026-08-21 | Alternative payment method codes (EPS, Sofort, Trustly)                                                    |
| https://docs.payabl.com/docs/3ds-transaction-status-reason-codes        | 2025-11-11 | Values of the `3dtransactionStatusReason` callback field                                                   |
| https://docs.payabl.com/docs/error-handling                             | 2025-11-11 | Web SDK codes `PC2160xx`/`PC215000`                                                                        |
| https://docs.payabl.com/docs/error-handling-troubleshooting-guidelines  | 2026-07-08 | Mobile SDK error handling (result outcomes)                                                                |
| https://docs.payabl.com/docs/declines-and-failed-payments               | 2025-11-11 | Decline classes: issuer, blocked (risk), gateway, payment method                                           |
| https://docs.payabl.com/docs/soft-declines                              | 2026-08-18 | Soft decline codes `65` / `1A` and how a 3DS step-up response looks                                        |
| https://docs.payabl.com/docs/getting-started                            | 2026-06-10 | Server-to-server API overview: authorization vs pre-authorization, after-payment operations                |
| https://docs.payabl.com/docs/signature-calculation                      | 2025-11-11 | Request `signature` (SHA-1) and notification `security` (SHA-256, "simplified")                            |
| https://docs.payabl.com/docs/signature-calculation2                     | 2026-08-21 | Same topic, newer page; notification signature section                                                     |
| https://docs.payabl.com/docs/authorization                              | 2025-11-18 | Authorization flow: request, 3DS pending response, notification, final response, success indicators        |
| https://docs.payabl.com/docs/pre-authorization                          | 2026-08-21 | Pre-authorization flow; notification with `type=order`                                                     |
| https://docs.payabl.com/docs/capture                                    | 2025-11-11 | Capture request/response                                                                                   |
| https://docs.payabl.com/docs/reversalcancellation                       | 2025-11-11 | Reversal request and response fields                                                                       |
| https://docs.payabl.com/docs/refund                                     | 2026-04-28 | Refund request/response; opt-in refund callback (`type=refund`)                                            |
| https://docs.payabl.com/docs/credit-fund-transfer-credit-cards          | 2026-09-23 | CFT/payout request and response fields                                                                     |
| https://docs.payabl.com/docs/aft-payments                               | 2026-09-03 | AFT flow; final notification example                                                                       |
| https://docs.payabl.com/docs/credentials-on-file                        | 2026-10-15 | CoF/recurring (`token_id`, `cof=cit/mit`), examples                                                        |
| https://docs.payabl.com/docs/partial-approval                           | 2026-02-13 | Partial authorization; final notification example                                                          |
| https://docs.payabl.com/docs/payabl-3dsecure-services                   | 2026-10-22 | `param_3d`, `url_3ds`, notification fields, `3dstatus` values, `type=order` vs `type=capture` meaning      |
| https://docs.payabl.com/docs/3dsecure-transactions-1                    | (read)     | 3DS/SCA overview (MIT, MOTO); no payload fields beyond the above                                           |
| https://docs.payabl.com/docs/parameters-in-responsescallbacks           | 2026-10-16 | Optional extra fields in responses/callbacks (bin, ccn_four, 3DS, MPI, scheme IDs) plus a full example     |
| https://docs.payabl.com/docs/resend-notification                        | 2026-09-11 | `send_notification` endpoint; XML response                                                                 |
| https://docs.payabl.com/docs/retry-notificationcallback                 | 2025-11-11 | Auto-retry of callbacks: ack is HTTP 200 + `OK`, retried every 2 h for 3 days                              |
| https://docs.payabl.com/docs/server-ip-addresses                        | 2026-10-07 | Source IPs of notifications                                                                                |
| https://docs.payabl.com/docs/diagnose-interface-1                       | 2026-08-06 | `tx_diagnose` XML responses; transaction step types (`invoice`, `booked`, ...)                             |
| https://docs.payabl.com/docs/transactions-log-call-via-api              | 2026-08-05 | Backoffice portal JSON API (login token, transaction log, chargeback/fraud types)                          |
| https://docs.payabl.com/docs/filter-parameters-for-transaction-log-call | 2026-06-22 | Transaction log filters (`transaction_status`, `transaction_type` values)                                  |
| https://docs.payabl.com/docs/hosted-payment-solution                    | 2025-11-11 | HPP overview                                                                                               |
| https://docs.payabl.com/docs/initiate-a-transaction-1                   | 2026-09-09 | HPP `init` request/response, return-page response, callback, field reference                               |
| https://docs.payabl.com/docs/sepa-direct-debit                          | 2026-01-19 | SEPA DD flow; `payment_state` notifications incl. failed `-5016`                                           |
| https://docs.payabl.com/docs/instant-bank-transfer                      | (read)     | Open banking flow; `payment_state` values; notification field reference                                    |
| https://docs.payabl.com/docs/payment-methods                            | 2026-08-20 | `payment_method` IDs                                                                                       |
| https://docs.payabl.com/docs/help                                       | 2026-08-21 | FAQ: encoding ISO-8859-1, 2000 = pending, callbacks, chargebacks                                           |
| https://docs.payabl.com/docs/get-session-id                             | 2026-07-17 | Web SDK session creation; response string                                                                  |
| https://docs.payabl.com/docs/integration-steps                          | 2026-07-17 | Web SDK flow; JS callback must not be used to update the merchant system                                   |
| https://docs.payabl.com/docs/parameters                                 | (read)     | Web SDK request/response parameters; JS callback JSON (`APPROVED`/`DECLINED`/`ERROR`/`CANCELLED`)          |
| https://docs.payabl.com/docs/faq-for-web-sdk-integration                | (read)     | Web SDK FAQ (callback vs notification_url)                                                                 |
| https://docs.payabl.com/docs/setup-your-server                          | 2026-07-08 | Mobile SDK `/mobile/init` JSON request/response                                                            |
| https://docs.payabl.com/docs/testing-credentials                        | (read)     | Sandbox merchant IDs; which test accounts send callbacks                                                   |
| https://docs.payabl.com/reference/payment-authorize                     | 2025-11-11 | OpenAPI for `payment_authorize` (form-encoded request, `text/plain` response)                              |
| https://docs.payabl.com/reference/payment-pre-authorize                 | 2025-11-11 | OpenAPI for `payment_preauthorize`                                                                         |
| https://docs.payabl.com/reference/payment-capture                       | 2025-11-11 | OpenAPI for `payment_capture`                                                                              |
| https://docs.payabl.com/reference/payment-refund                        | 2025-11-11 | OpenAPI for `payment_refund`                                                                               |
| https://docs.payabl.com/reference/payment-reversalcancellation          | 2025-11-11 | OpenAPI for `payment_reversal`                                                                             |
| https://docs.payabl.com/reference/credit-fund-transfer                  | (read)     | OpenAPI for `payment_cft`                                                                                  |
| https://docs.payabl.com/reference/pre-authorization-1                   | (read)     | OpenAPI for APM pre-authorization (`redirect_url`, `redirect_secret`, `ppro_id`, ...)                      |
| https://docs.payabl.com/reference/initiate-a-transaction                | (read)     | OpenAPI for HPP `init`                                                                                     |
| https://docs.payabl.com/reference/web-sdk-sessionid                     | (read)     | OpenAPI for Web SDK session (response examples are empty)                                                  |

Also tried: `https://docs.payabl.com/docs/transactions-log-download-via-api` (linked from the FAQ) returns "Page not found".

---

## 2. API families and versions in scope

payabl. does not version its API publicly. The OpenAPI blocks say `"version": "1.0"` and nothing else. The documented families are:

| Family                                     | Endpoint(s) (sandbox shown)                                                                                                                                                                                                                 | Request format                                    | Response format                                                                                                          | Relevance to PandaPayLens                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Gateway API (server-to-server)**         | `POST https://sandbox.payabl.com/pay/backoffice/payment_authorize`, `.../payment_preauthorize`, `.../payment_capture`, `.../payment_reversal`, `.../payment_refund`, `.../payment_cft` (OpenAPI server: `https://pay4.sandbox.payabl.com/`) | `application/x-www-form-urlencoded` + `signature` | URL-encoded `key=value&...` string (`text/plain` in OpenAPI)                                                             | **Primary**. Synchronous responses carry `status`/`errormessage`                           |
| **Asynchronous notifications (callbacks)** | POST to merchant `notification_url` (per request or account default)                                                                                                                                                                        | URL-encoded `key=value&...` (see §6)              | Merchant must answer HTTP 200 + `OK` when auto-retry is enabled                                                          | **Primary**. Shared by Gateway API, HPP, Web SDK, Mobile SDK and APMs                      |
| Hosted Payment Page (HPP)                  | `POST https://sandbox.payabl.com/pay/payment/init`, customer goes to `start_url` (`.../hpp/en/start?session_id=...`)                                                                                                                        | form-encoded                                      | URL-encoded (`errorcode`, `errormessage`, `sessionid`, `transactionid`, `start_url`, `user_id`)                          | Secondary. Init response plus return-page/callback strings in the same notification format |
| Web SDK                                    | `POST https://sandbox.payabl.com/pay/payment/get_payment_widget_session` (prod `https://pay4.payabl.com/...`)                                                                                                                               | form-encoded                                      | URL-encoded (`errorcode`, `orderid`, `session_id`, `signature`, `transactionid`); browser JS callback gets a JSON object | Secondary. JS callback JSON is distinctive (§6.4)                                          |
| Mobile SDK (iOS/Android)                   | `POST https://pay4.sandbox.payabl.com/pay/mobile/init`                                                                                                                                                                                      | **JSON**                                          | **JSON** (`status`, `session_id`, `ephemeral_key`, `transaction_id` / `error_code`, `error_message`)                     | Secondary                                                                                  |
| APM gateway (Account Name Verification)    | `https://service-sandbox.apmgw-dev.payabl.tech/apm_gw/payment_preauthorize`, prod `https://api.apmgw-prod.payabl.tech/v1/payment_preauthorize`                                                                                              | form-encoded                                      | not examined beyond the IBT page                                                                                         | Out of scope initially                                                                     |
| Diagnose / status query                    | `POST .../pay/backoffice/tx_diagnose`                                                                                                                                                                                                       | form-encoded                                      | **XML** (ISO-8859-1)                                                                                                     | Useful for timeline (shows lifecycle steps)                                                |
| Resend notification                        | `POST .../pay/backoffice/send_notification`                                                                                                                                                                                                 | form-encoded                                      | **XML**                                                                                                                  | Low                                                                                        |
| Backoffice portal API (transaction log)    | `https://portal.sandbox.payabl.com/api/accounts/auth/login`, `.../api/backoffice/transactionLog_download`                                                                                                                                   | JSON                                              | text/file export (format chosen by user)                                                                                 | Out of scope (contains a bearer-like token and full exports)                               |
| POS / SoftPOS (Switchio, Nexgo)            | n/a                                                                                                                                                                                                                                         | n/a                                               | n/a                                                                                                                      | Out of scope                                                                               |

**Recommendation: target first** the Gateway API synchronous responses and the merchant notifications/callbacks. Both are URL-encoded `key=value` strings with the same core vocabulary (`transactionid`, `status`/`errorcode`, `errormessage`, `type`, `orderid`, `security`). They are also the payloads a developer is most likely to paste, and the same notification format is produced whichever front end (S2S, HPP, Web SDK, Mobile SDK) started the payment. After that, add the HPP init response, the Web SDK JS-callback JSON, and the `tx_diagnose` XML (good timeline data).

---

## 3. Response / error format

### 3.1 Content type and encoding

- **Gateway API synchronous responses** come back as a URL-encoded `key=value&key=value` string. The OpenAPI response media type for `payment_authorize` is `text/plain`. Some other reference pages (capture, refund, reversal, CFT, HPP init) label the 200 example as `application/json`, but the example _value_ is still a URL-encoded string wrapped in `{...}`. Treat this as a docs artifact: the payload itself is not JSON.
- **Notifications** are URL-encoded `key=value` strings. The refund page calls it a "POST callback". The notification HTTP `Content-Type` header is **NOT DOCUMENTED** (presumably `application/x-www-form-urlencoded`, unconfirmed).
- **Character encoding**: the FAQ says requests must be ISO-8859-1 (Latin-1) and that UTF-8 multibyte is not supported. Diagnose XML declares `encoding="ISO-8859-1"`. Response/notification charset is **NOT DOCUMENTED**.
- **XML**: `tx_diagnose` and `send_notification` responses.
- **JSON**: Mobile SDK `/mobile/init` request/response; the Web SDK browser JS callback object; Backoffice portal API bodies.
- **HTTP status codes**: the OpenAPI blocks show only a `200` (body above) and a `400` whose example is `{}`. Which errors use which HTTP status is **NOT DOCUMENTED**. Gateway errors come back inside the 200 body as a non-zero `status`.

### 3.2 Field names and types

Synchronous Gateway API response (authorize, pre-authorize, capture, reversal, refund, CFT):

| Field                                                                                      | Type (as documented / observed)                                                                                                           | Meaning                                                                           |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `transactionid`                                                                            | numeric string (capture ref: "max. 10 digits", int64; refund ref: "max. 50 digits")                                                       | payabl. transaction ID                                                            |
| `transid`                                                                                  | numeric string                                                                                                                            | Same as `transactionid` (documented alias)                                        |
| `status`                                                                                   | string. Usually an integer (`0`, `2000`, `-6000`), but issuer codes can be `"05"`, `"59.03"`, `"6P"`, `"N7"` and risk codes `"-5004.03a"` | `0` = no error, `2000` = pending, anything else = error code (CFT page)           |
| `errormessage`                                                                             | string, may be empty                                                                                                                      | Error text; empty on success; `pending` when status=2000                          |
| `errmsg`                                                                                   | string                                                                                                                                    | Same as `errormessage` (documented alias)                                         |
| `amount`                                                                                   | decimal string (`1.23`)                                                                                                                   | Transaction amount                                                                |
| `price`                                                                                    | decimal string                                                                                                                            | Same as `amount` (documented alias)                                               |
| `currency`                                                                                 | ISO 4217 alpha-3                                                                                                                          |                                                                                   |
| `orderid`                                                                                  | string, max 40                                                                                                                            | Merchant reference (optional, may be empty)                                       |
| `user_id`                                                                                  | numeric string                                                                                                                            | "Payment system user identifier"                                                  |
| `payment_method`                                                                           | integer ID (see `/docs/payment-methods`)                                                                                                  | e.g. `1` cards, `123` instant bank transfer, `139` SEPA DD                        |
| `url_3ds`                                                                                  | URL-encoded URL                                                                                                                           | Present with `status=2000` when a 3DS redirect is needed                          |
| `redirect_url`                                                                             | URL-encoded URL                                                                                                                           | APM/open-banking redirect, used instead of `url_3ds`                              |
| `bin`, `ccn_four`, `card_type`, `cardholder`, `expiry_month`, `expiry_year`, `bin_country` | strings                                                                                                                                   | Optional, enabled per merchant (see §6.2)                                         |
| `redirect_secret`, `fail_reason`, `ppro_id`, `payment_guarantee`                           | strings                                                                                                                                   | Appear in the APM pre-authorization reference example; meaning **NOT DOCUMENTED** |

HPP `init` response: `errorcode`, `errorcodes` (appears in the example, meaning **NOT DOCUMENTED**), `errormessage`, `sessionid`, `transactionid`, `user_id`, `start_url`.

Web SDK session response: `errorcode`, `errormessage`, `session_id` (40 chars), `transactionid` (may be absent), `signature` (40 chars), `orderid`.

Mobile SDK `/mobile/init` (JSON): success `{status: 0 (integer), session_id: string, ephemeral_key: string, transaction_id: integer}`; error `{status: -1, error_code: integer, error_message: string}`.

Note on naming: the synchronous Gateway response uses **`status`**, while notifications, HPP and Web SDK use **`errorcode`**. Both carry the same code space. Payloads never use a `payment_state` field except in APM/bank-transfer notifications (§5). Diagnose XML uses `<error_code>` and `<status>`; the Mobile SDK uses `error_code`/`error_message`.

**Mastercard Merchant Advice Code suffix**: when the issuer supplies a MAC, the docs say it is appended to the error code and message after a dot, e.g. `errorcode=59.03` / `errormessage=Authentication decline. Suspected fraud, do not retry`. A parser should split `NN.MM` into a base code and a MAC. Do **not** apply that split to payabl. risk codes like `-5004.03a`, which use the same dotted shape with a different meaning.

### 3.3 Examples

Example A: successful authorization, synchronous response. **Transcribed from docs URL https://docs.payabl.com/reference/payment-authorize** (OpenAPI 200 example, `text/plain`):

```
transactionid=104822737&transid=104822737&status=0&errormessage=&errmsg=&amount=1.23&price=1.23&currency=EUR&orderid=api-test-123&bin=424242&payment_method=1&ccn_four=4242&card_type=VISA&cardholder=Muster%20Mann&user_id=584371
```

Example B: pending response asking for a 3DS redirect. **Transcribed from docs URL https://docs.payabl.com/docs/authorization** (verbatim, including a docs rendering defect: `¤cy=` is a corrupted `&currency=`, where the HTML entity `&curren` was rendered as `¤`; the same defect appears on the pre-authorization, 3DS-services and soft-declines pages):

```
transactionid=213592105&transid=213592105&status=2000&errormessage=pending&errmsg=pending&amount=1.23
&price=1.23¤cy=USD&orderid=Powercash21-Test&payment_method=1&ccn_four=4242&card_type=VISA&expiry_month=12&
expiry_year=2030&url_3ds=http%3A%2F%2F172.25.50.31%3A9100%2Ftest%2Fv1%2Ffb1657ac65343bdaa831dfd633ff8f20%2Fredirect&user_id=46929
```

Example C: HPP init response. **Transcribed from docs URL https://docs.payabl.com/docs/initiate-a-transaction-1**:

```
errorcode=0&errorcodes=&errormessage=&sessionid=4da5686ae4fad9704ef80e39e1f65ccac1751aa5&transactionid=105936790&user_id=1056479&start_url=https%3A%2F%2Fsandbox.payabl.com%2Fhpp%2Fen%2Fstart%3Fsession_id%3D4da5686ae4fad9704ef80e39e1f65ccac1751aa5
```

Parser hint from the defect above: if a developer pastes straight from the docs, `¤cy=` (and `×tamp=`, the same corruption of `&timestamp=` in the Parameters-in-Responses example) can appear. A tolerant parser can repair those two tokens and mark the result with a warning.

---

## 4. Error / response codes

Code strings below are exactly as documented. "Meaning" is my own short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not payabl. statements; where payabl. gives advice, it is reflected and noted.

Field location: payabl. gateway codes arrive in `status` (synchronous) or `errorcode` (notifications/HPP). Issuer codes (§4.4) and MAC suffixes arrive in the same field. `0` = success, `2000` = pending.

Payabl. warns that each list holds only the most common codes and that other messages can be returned. An adapter must handle unknown codes.

### 4.1 payabl. gateway codes (source: /docs/response-codes-detailed): 92 codes

| Code      | Meaning (paraphrase)                                                                                                | Category                                          | Retry class                     |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| `0`       | Approved / completed                                                                                                | n/a (success, not an error)                       | n/a                             |
| `2000`    | Pending: received and sent to processing (also 3DS redirect pending)                                                | n/a (pending state, not an error)                 | n/a                             |
| `-999`    | Unknown error; check credentials, live-vs-sandbox environment, signature                                            | configuration                                     | do_not_retry                    |
| `-6000`   | Wrong or missing fields; e.g. currency not enabled or bad signature                                                 | invalid_request                                   | do_not_retry                    |
| `-1`      | Unknown config setting                                                                                              | configuration                                     | do_not_retry                    |
| `-104`    | Illegal command: action not enabled for this account/login                                                          | configuration                                     | do_not_retry                    |
| `-119`    | No permission: action not enabled for this account/login                                                            | configuration                                     | do_not_retry                    |
| `-1311`   | Account name wrong/missing                                                                                          | invalid_request                                   | customer_action_required        |
| `-1313`   | Bank number wrong/missing                                                                                           | invalid_request                                   | customer_action_required        |
| `-1314`   | Bank country wrong/missing                                                                                          | invalid_request                                   | customer_action_required        |
| `-1315`   | Response failed: timeout or the user aborted                                                                        | network_or_timeout                                | retry_conditionally             |
| `-1316`   | Merchant payment method wrong/missing                                                                               | invalid_request                                   | do_not_retry                    |
| `-1318`   | IBAN wrong/missing                                                                                                  | invalid_request                                   | customer_action_required        |
| `-1319`   | BIC wrong/missing                                                                                                   | invalid_request                                   | customer_action_required        |
| `-2400`   | Too many retries; card credentials blocked for ~1 minute                                                            | rate_limiting                                     | retry_conditionally             |
| `-2402`   | Card briefly blocked (~1 min) after a successful payment (anti-bot); cardholder may retry later                     | rate_limiting                                     | retry_conditionally             |
| `-2404`   | Card briefly blocked (~1 min) after a failed payment (anti-bot); cardholder may retry later                         | rate_limiting                                     | retry_conditionally             |
| `-2405`   | Card blocked because of a prior fraud report                                                                        | fraud_or_risk                                     | do_not_retry                    |
| `-2406`   | Card blocked because of a prior chargeback                                                                          | fraud_or_risk                                     | do_not_retry                    |
| `-2407`   | Blocked: an active transaction exists; too many attempts within 1 min, duplicates blocked; can retry later          | duplicate_request                                 | retry_conditionally             |
| `-2454`   | Reattempt with the same card not permitted; payabl. advises asking for another card/method                          | card_declined                                     | customer_action_required        |
| `-2455`   | Scheme reattempt limit for this card+merchant exceeded; use another card/method                                     | card_declined                                     | customer_action_required        |
| `-5000`   | Internal error                                                                                                      | provider_unavailable                              | retry_conditionally             |
| `-5002`   | Payment failed (no further detail)                                                                                  | unknown                                           | manual_review                   |
| `-5003`   | Payment aborted by the customer or by timeout                                                                       | unknown (customer abandonment; no exact category) | customer_action_required        |
| `-5004`   | Cancelled by risk-management checks (see sub-codes §4.2)                                                            | fraud_or_risk                                     | manual_review                   |
| `-5008`   | CFT aborted (note: the CFT page lists `-5007` for the same message; see §10)                                        | unknown                                           | manual_review                   |
| `-5010`   | 3DS downgraded or not verified                                                                                      | authentication_failed                             | retry_conditionally             |
| `-5011`   | 3DS downgraded / invalid attempt; issuer did not return all values. payabl. suggests one retry, then another method | authentication_failed                             | retry_conditionally             |
| `-5012`   | Incorrect ECI data; same advice as `-5011`                                                                          | authentication_failed                             | retry_conditionally             |
| `-6001`   | No valid fields found; check merchant ID and field values                                                           | invalid_request                                   | do_not_retry                    |
| `-6005`   | Pre-authorization disabled for the account                                                                          | configuration                                     | do_not_retry                    |
| `-6102`   | Wrong price                                                                                                         | invalid_amount                                    | do_not_retry                    |
| `-6103`   | Wrong currency                                                                                                      | invalid_request                                   | do_not_retry                    |
| `-6105`   | Wrong last name                                                                                                     | invalid_request                                   | do_not_retry                    |
| `-6106`   | Wrong street                                                                                                        | invalid_request                                   | do_not_retry                    |
| `-6107`   | Wrong zip                                                                                                           | invalid_request                                   | do_not_retry                    |
| `-6108`   | Wrong city                                                                                                          | invalid_request                                   | do_not_retry                    |
| `-6109`   | Wrong language                                                                                                      | invalid_request                                   | do_not_retry                    |
| `-6110`   | Wrong salutation                                                                                                    | invalid_request                                   | do_not_retry                    |
| `-6111`   | Wrong title                                                                                                         | invalid_request                                   | do_not_retry                    |
| `-6112`   | Wrong gender                                                                                                        | invalid_request                                   | do_not_retry                    |
| `-6113`   | Wrong first name                                                                                                    | invalid_request                                   | do_not_retry                    |
| `-6114`   | Wrong company                                                                                                       | invalid_request                                   | do_not_retry                    |
| `-6115`   | Wrong birthday                                                                                                      | invalid_request                                   | do_not_retry                    |
| `-6116`   | Wrong house                                                                                                         | invalid_request                                   | do_not_retry                    |
| `-6117`   | Wrong postbox                                                                                                       | invalid_request                                   | do_not_retry                    |
| `-6118`   | Wrong state                                                                                                         | invalid_request                                   | do_not_retry                    |
| `-6119`   | Wrong email                                                                                                         | invalid_request                                   | do_not_retry                    |
| `-6120`   | Wrong phone                                                                                                         | invalid_request                                   | do_not_retry                    |
| `-6121`   | Wrong fax                                                                                                           | invalid_request                                   | do_not_retry                    |
| `-6122`   | Wrong mobile                                                                                                        | invalid_request                                   | do_not_retry                    |
| `-6123`   | Wrong customer-id                                                                                                   | invalid_request                                   | do_not_retry                    |
| `-6124`   | Wrong custom1 (FAQ: test accounts need `custom1=123456`)                                                            | invalid_request                                   | do_not_retry                    |
| `-6125`   | Wrong custom2                                                                                                       | invalid_request                                   | do_not_retry                    |
| `-6126`   | Wrong custom3                                                                                                       | invalid_request                                   | do_not_retry                    |
| `-6127`   | Wrong customer IP                                                                                                   | invalid_request                                   | do_not_retry                    |
| `-6132`   | Wrong order ID                                                                                                      | invalid_request                                   | do_not_retry                    |
| `-6136`   | Routing error                                                                                                       | configuration                                     | manual_review                   |
| `-6140`   | Wrong language                                                                                                      | invalid_request                                   | do_not_retry                    |
| `-6141`   | Wrong currency                                                                                                      | invalid_request                                   | do_not_retry                    |
| `-6142`   | Wrong country                                                                                                       | invalid_request                                   | do_not_retry                    |
| `-6150`   | Currency not supported                                                                                              | configuration                                     | do_not_retry                    |
| `-6157`   | Wrong payment method                                                                                                | invalid_request                                   | do_not_retry                    |
| `-6158`   | Wrong merchant payment system                                                                                       | configuration                                     | do_not_retry                    |
| `-6159`   | Wrong payment system                                                                                                | configuration                                     | do_not_retry                    |
| `-6163`   | Wrong user-id                                                                                                       | invalid_request                                   | do_not_retry                    |
| `-6169`   | Wrong day                                                                                                           | invalid_request                                   | do_not_retry                    |
| `-6170`   | Wrong month                                                                                                         | invalid_request                                   | do_not_retry                    |
| `-6171`   | Wrong year                                                                                                          | invalid_request                                   | do_not_retry                    |
| `-6174`   | Wrong country code                                                                                                  | invalid_request                                   | do_not_retry                    |
| `-6209`   | Merchant account (MID) close to negative balance (CFT page: capture more or top up)                                 | configuration                                     | manual_review                   |
| `-6211`   | No bank confirmation; pending and not credited after 10 days                                                        | unknown                                           | manual_review                   |
| `-6212`   | MID balance service internal error; temporary, retry later                                                          | provider_unavailable                              | safe_to_retry_technical_request |
| `-6310`   | Card number must be valid                                                                                           | invalid_request                                   | customer_action_required        |
| `-6311`   | Expiry date invalid / does not match the card                                                                       | invalid_request                                   | customer_action_required        |
| `-6312`   | Luhn check failed                                                                                                   | invalid_request                                   | customer_action_required        |
| `-6313`   | Expiry month invalid                                                                                                | invalid_request                                   | customer_action_required        |
| `-6314`   | Expiry year invalid                                                                                                 | invalid_request                                   | customer_action_required        |
| `-6315`   | CVC missing/invalid                                                                                                 | invalid_request                                   | customer_action_required        |
| `-6316`   | Cardholder name empty or has invalid characters                                                                     | invalid_request                                   | customer_action_required        |
| `-6317`   | Card type missing/invalid (wrong customer details / card type / bank info)                                          | invalid_request                                   | customer_action_required        |
| `-6318`   | BIN is hostile: card's BIN country blocked                                                                          | fraud_or_risk                                     | customer_action_required        |
| `-6319`   | Wrong recurring ID (bad initial transaction ID for a CoF transaction)                                               | invalid_request                                   | do_not_retry                    |
| `-6327`   | Card type does not support recurring                                                                                | payment_method_unavailable                        | do_not_retry                    |
| `-10001`  | 3DS verification failed or incomplete                                                                               | authentication_failed                             | customer_action_required        |
| `-10002`  | ECI wrong or missing                                                                                                | authentication_failed                             | retry_conditionally             |
| `-10005`  | Communication problem                                                                                               | network_or_timeout                                | retry_conditionally             |
| `-13000`  | Timeout while sending the request                                                                                   | network_or_timeout                                | retry_conditionally             |
| `-13001`  | Communication problem while sending the request                                                                     | network_or_timeout                                | retry_conditionally             |
| `-13002`  | Communication problem                                                                                               | network_or_timeout                                | retry_conditionally             |
| `-111005` | 3DS not enrolled for this BIN                                                                                       | authentication_failed                             | customer_action_required        |

"retry_conditionally" for timeouts and communication errors means: confirm the final state first (notification or diagnose) before resubmitting, because the original may have gone through.

Observed in an example but **not in any code table**: `-5016` with `errormessage=Bank+rejected+payment` (SEPA DD failed-capture notification, /docs/sepa-direct-debit). Suggested category: card_declined (bank rejection of debit) / do_not_retry, with low confidence.

### 4.2 Risk-management sub-codes of `-5004` (same page, second table): 12 codes

All of these are fraud_or_risk / manual_review. The docs say to contact the account manager or support for details.

| Code        | Meaning (paraphrase)                            |
| ----------- | ----------------------------------------------- |
| `-5004.01`  | OFAC (sanctions) block                          |
| `-5004.02`  | Velocity block                                  |
| `-5004.03a` | BIN block                                       |
| `-5004.03b` | Email block                                     |
| `-5004.03c` | IBAN block                                      |
| `-5004.03d` | Card number block                               |
| `-5004.03e` | URL block                                       |
| `-5004.03f` | Country block                                   |
| `-5004.04a` | Card type block                                 |
| `-5004.04b` | Card scheme block                               |
| `-5004.05`  | 3DS-related risk block                          |
| `-5004.06`  | Model (scoring) block                           |
| (`-5004`)   | No specific cluster: one-off or technical rules |

### 4.3 CFT (payout) codes (source: /docs/cft-response-code)

The CFT page repeats `0, 2000, -999, -6000, -104, -119, -5000, -5004, -6209, -6211, -6212, -6311, -13000, -13001` with the same meanings as §4.1. Codes that appear only here:

| Code     | Meaning (paraphrase)                                                                      | Category                   | Retry                    |
| -------- | ----------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `-5007`  | CFT aborted                                                                               | unknown                    | manual_review            |
| `-41017` | Merchant account has incorrect fields                                                     | configuration              | do_not_retry             |
| `-41018` | Mastercard service error: invalid request field                                           | invalid_request            | do_not_retry             |
| `062000` | (Mastercard OCT) value has an invalid character; strip special symbols from customer data | invalid_request            | do_not_retry             |
| `072000` | (Mastercard OCT) invalid length                                                           | invalid_request            | do_not_retry             |
| `110503` | (Mastercard OCT) account not eligible to receive OCT; use another card                    | payment_method_unavailable | customer_action_required |
| `110516` | (Mastercard OCT) country not supported for merchant                                       | configuration              | do_not_retry             |
| `130001` | (Mastercard OCT) card declined                                                            | card_declined              | customer_action_required |
| `130002` | (Mastercard OCT) fraud detected                                                           | fraud_or_risk              | do_not_retry             |
| `130003` | (Mastercard OCT) card expired                                                             | card_declined              | customer_action_required |
| `130004` | (Mastercard OCT) per-transaction max amount reached                                       | invalid_amount             | do_not_retry             |

The CFT "Issuer codes" table (`04, 05, 08, 12, 14, 31, 46, 57, 59, 61, 62, 65, 77, 93`) is a subset of §4.4. On the CFT page, `65` reads "Exceeds frequency limit / Additional SCA required".

### 4.4 Issuer / scheme decline codes (source: /docs/error-codes-for-credit-cards-2): 87 codes

payabl.'s general advice for this table: the gateway does not control these declines, so the customer should contact the bank or use another card or method.

| Code    | Meaning (paraphrase)                                                                          | Category                   | Retry                    |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `02`    | Refer to card issuer                                                                          | card_declined              | customer_action_required |
| `03`    | Invalid merchant (card/product restricted for this MCC)                                       | card_declined              | do_not_retry             |
| `04`    | Do not honour (unspecified)                                                                   | card_declined              | customer_action_required |
| `05`    | Do not honour (unspecified)                                                                   | card_declined              | customer_action_required |
| `06`    | Invalid transaction for terminal; issuer will never approve                                   | card_declined              | do_not_retry             |
| `6P`    | Verification data failed (no correct 3DS data)                                                | authentication_failed      | customer_action_required |
| `07`    | Honour with ID: actually a success that some banks send instead of 00                         | n/a (success)              | n/a                      |
| `08`    | Time-out                                                                                      | network_or_timeout         | retry_conditionally      |
| `09`    | No original                                                                                   | invalid_request            | do_not_retry             |
| `10`    | Unable to reverse                                                                             | unknown                    | manual_review            |
| `11`    | Suspected fraud (issuer)                                                                      | fraud_or_risk              | do_not_retry             |
| `12`    | Invalid transaction (card/issuer/acquirer)                                                    | card_declined              | do_not_retry             |
| `13`    | Invalid amount (bad characters)                                                               | invalid_amount             | do_not_retry             |
| `14`    | Invalid card number                                                                           | card_declined              | customer_action_required |
| `17`    | Invalid capture date                                                                          | invalid_request            | do_not_retry             |
| `19`    | System error; re-enter (issuer temporarily unable, format/AVS issue, or Visa fraud threshold) | provider_unavailable       | retry_conditionally      |
| `20`    | No "from" account                                                                             | card_declined              | customer_action_required |
| `21`    | No "to" account                                                                               | card_declined              | customer_action_required |
| `22`    | No checking account                                                                           | card_declined              | customer_action_required |
| `23`    | No saving account                                                                             | card_declined              | customer_action_required |
| `24`    | No credit account; try another card                                                           | card_declined              | customer_action_required |
| `25`    | Lifecycle decline                                                                             | card_declined              | customer_action_required |
| `25.01` | Lifecycle decline: updated info in ABU; check before retry                                    | card_declined              | customer_action_required |
| `25.02` | Lifecycle decline: retry later                                                                | card_declined              | retry_conditionally      |
| `25.03` | Lifecycle decline: suspected fraud, do not retry                                              | fraud_or_risk              | do_not_retry             |
| `26`    | Policy decline                                                                                | card_declined              | customer_action_required |
| `26.01` | Policy decline: updated info in ABU; check card data                                          | card_declined              | customer_action_required |
| `26.02` | Policy decline: retry later                                                                   | card_declined              | retry_conditionally      |
| `26.03` | Policy decline: no updated credentials, do not retry                                          | card_declined              | do_not_retry             |
| `30`    | Format error                                                                                  | invalid_request            | do_not_retry             |
| `31`    | Blocked, first used (Brazil domestic; account temporarily blocked)                            | card_declined              | customer_action_required |
| `34`    | Implausible card data                                                                         | card_declined              | customer_action_required |
| `39`    | Transaction type not allowed by issuer                                                        | card_declined              | do_not_retry             |
| `41`    | Lost card, pick up                                                                            | fraud_or_risk              | do_not_retry             |
| `42`    | Special pickup (lost/stolen)                                                                  | fraud_or_risk              | do_not_retry             |
| `43`    | Hot (stolen) card, pick up                                                                    | fraud_or_risk              | do_not_retry             |
| `44`    | Pick up card (reported stolen)                                                                | fraud_or_risk              | do_not_retry             |
| `45`    | Fallback not allowed (UnionPay)                                                               | payment_method_unavailable | do_not_retry             |
| `46`    | Closed account; issuer will never approve                                                     | card_declined              | do_not_retry             |
| `51`    | Insufficient funds                                                                            | insufficient_funds         | customer_action_required |
| `54`    | Expired card                                                                                  | card_declined              | customer_action_required |
| `55`    | Incorrect PIN                                                                                 | authentication_failed      | customer_action_required |
| `57`    | Not permitted on card; do not retry                                                           | card_declined              | do_not_retry             |
| `58`    | Not permitted on terminal                                                                     | card_declined              | do_not_retry             |
| `59`    | Suspected fraud (issuer/Visa RTD/VRM rules)                                                   | fraud_or_risk              | do_not_retry             |
| `59.01` | Authentication decline; authenticating may help                                               | authentication_required    | customer_action_required |
| `59.02` | Authentication decline; retry later                                                           | authentication_required    | retry_conditionally      |
| `59.03` | Authentication decline; suspected fraud, do not retry                                         | fraud_or_risk              | do_not_retry             |
| `61`    | Exceeds amount limit (also settlement cap / CFT velocity)                                     | card_declined              | customer_action_required |
| `62`    | Restricted card (restricted/embargoed country, incl. OFAC)                                    | card_declined              | do_not_retry             |
| `63`    | MAC key error                                                                                 | configuration              | manual_review            |
| `65`    | Additional SCA required / frequency limit (soft decline)                                      | authentication_required    | customer_action_required |
| `66`    | Exceeds acquirer limit                                                                        | configuration              | manual_review            |
| `67`    | Retain card (suspected counterfeit)                                                           | fraud_or_risk              | do_not_retry             |
| `68`    | Response received too late                                                                    | network_or_timeout         | retry_conditionally      |
| `69`    | Reversal reason indicator: auth response not returned in time                                 | network_or_timeout         | retry_conditionally      |
| `70`    | PIN data required                                                                             | authentication_required    | customer_action_required |
| `75`    | PIN retries exceeded                                                                          | authentication_failed      | do_not_retry             |
| `76`    | Invalid account (no longer exists)                                                            | card_declined              | do_not_retry             |
| `77`    | Issuer does not take part in the service (e.g. CFT); use another method                       | payment_method_unavailable | customer_action_required |
| `78`    | Function not available                                                                        | payment_method_unavailable | do_not_retry             |
| `79`    | Key validation error                                                                          | configuration              | manual_review            |
| `80`    | Approval for purchase amount only                                                             | unknown                    | manual_review            |
| `81`    | Unable to verify PIN                                                                          | authentication_failed      | customer_action_required |
| `82`    | Invalid CVV                                                                                   | card_declined              | customer_action_required |
| `83`    | Fraud/security flag                                                                           | fraud_or_risk              | do_not_retry             |
| `84`    | Invalid transaction life cycle                                                                | invalid_request            | do_not_retry             |
| `85`    | No keys to use                                                                                | configuration              | manual_review            |
| `86`    | KME sync error                                                                                | configuration              | manual_review            |
| `87`    | PIN key error                                                                                 | configuration              | manual_review            |
| `88`    | MAC sync error                                                                                | configuration              | manual_review            |
| `89`    | Security violation; issuer does not permit this on the card                                   | card_declined              | do_not_retry             |
| `91`    | Issuer not available                                                                          | provider_unavailable       | retry_conditionally      |
| `92`    | Invalid issuer / cannot route (often a test card in live)                                     | card_declined              | do_not_retry             |
| `93`    | Cannot complete: regulatory restriction (may be cardholder opt-out)                           | card_declined              | customer_action_required |
| `94`    | Invalid originator                                                                            | invalid_request            | do_not_retry             |
| `95`    | Contact acquirer                                                                              | configuration              | manual_review            |
| `96`    | Issuer system malfunction                                                                     | provider_unavailable       | retry_conditionally      |
| `97`    | No funds transfer                                                                             | card_declined              | do_not_retry             |
| `98`    | Duplicate reversal                                                                            | duplicate_request          | do_not_retry             |
| `99`    | Duplicate transaction                                                                         | duplicate_request          | do_not_retry             |
| `N3`    | Cash service not available                                                                    | payment_method_unavailable | do_not_retry             |
| `N4`    | Cashback exceeds issuer limit                                                                 | invalid_amount             | do_not_retry             |
| `N7`    | CVV2 failure                                                                                  | card_declined              | customer_action_required |
| `R0`    | Stop payment order (cardholder stopped a recurring payment)                                   | card_declined              | do_not_retry             |
| `R1`    | Revocation of authorization order (stop recurring for this order)                             | card_declined              | do_not_retry             |
| `R3`    | Revocation of all authorizations (stop all recurring)                                         | card_declined              | do_not_retry             |

Soft declines (/docs/soft-declines): codes **`65`** and **`1A`** mean the issuer wants SCA. payabl. usually handles this by returning `status=2000` with `url_3ds`. The interface then shows two authorizations: a declined one with 65/1A and a later successful one.

### 4.5 Raw Visa / Mastercard network codes (sources: /docs/error-codes-visa, /docs/error-codes-mastercard)

These pages use **un-padded** codes (`1`, `5`) where §4.4 uses padded ones (`02`, `05`). Several meanings **conflict** with §4.4 and with each other. Neither page is in the `llms.txt` index; both are linked from the Web SDK Error Handling page. My reading is that they are legacy, scheme-specific reference tables. When a code exists in §4.4, prefer that meaning. Use this table only when the scheme is known (e.g. from `card_type`) or the code is absent from §4.4.

| Code                                                   | Mastercard page                               | Visa page                                                   | Category                   | Retry                    |
| ------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------- | -------------------------- | ------------------------ |
| `1`                                                    | Refer to issuer                               | Card auth failed / refer to issuer                          | card_declined              | customer_action_required |
| `2`                                                    | Refer to issuer, special conditions           | same                                                        | card_declined              | customer_action_required |
| `3`                                                    | Invalid merchant                              | same                                                        | card_declined              | do_not_retry             |
| `4`                                                    | Do not honor, fraud                           | Pick up card (no fraud)                                     | card_declined              | do_not_retry             |
| `5`                                                    | Do not honor                                  | same                                                        | card_declined              | customer_action_required |
| `6`                                                    | Invalid card number                           | Invalid card                                                | card_declined              | customer_action_required |
| `7`                                                    | Pick-up, special conditions                   | Pick-up, special condition (fraud account)                  | fraud_or_risk              | do_not_retry             |
| `8`                                                    | Timeout                                       | No card record (**conflict**)                               | unknown                    | manual_review            |
| `9`                                                    | (none)                                        | Security failure                                            | fraud_or_risk              | do_not_retry             |
| `10`                                                   | (none)                                        | Partial approval                                            | unknown                    | manual_review            |
| `11`                                                   | (none)                                        | Suspected fraud                                             | fraud_or_risk              | do_not_retry             |
| `12`                                                   | Invalid transaction                           | same                                                        | card_declined              | do_not_retry             |
| `13`                                                   | Invalid amount                                | Invalid amount / currency conversion overflow               | invalid_amount             | do_not_retry             |
| `14`                                                   | Invalid card number                           | Invalid account number                                      | card_declined              | customer_action_required |
| `15`                                                   | No such issuer                                | same                                                        | card_declined              | customer_action_required |
| `19`                                                   | Exceeds ACS max challenges                    | Re-enter transaction (**conflict**)                         | unknown                    | retry_conditionally      |
| `20`                                                   | Invalid response                              | (none)                                                      | provider_unavailable       | retry_conditionally      |
| `21`                                                   | No To Account                                 | No action taken                                             | card_declined              | manual_review            |
| `22`                                                   | Suspected malfunction                         | ACS technical issue                                         | provider_unavailable       | retry_conditionally      |
| `24`                                                   | (none)                                        | No credit account                                           | card_declined              | customer_action_required |
| `25`                                                   | Unable to locate record                       | same                                                        | card_declined              | do_not_retry             |
| `28`                                                   | (none)                                        | File temporarily unavailable                                | provider_unavailable       | retry_conditionally      |
| `31`                                                   | Bank not supported by switch                  | Blocked, first used (Brazil) (**conflict**)                 | card_declined              | customer_action_required |
| `34`                                                   | Suspected fraud, pick-up                      | (none)                                                      | fraud_or_risk              | do_not_retry             |
| `36`                                                   | Restricted card, pick-up                      | (none)                                                      | card_declined              | do_not_retry             |
| `38`                                                   | PIN tries exceeded, pick-up                   | (none)                                                      | authentication_failed      | do_not_retry             |
| `39`                                                   | No credit account                             | same                                                        | card_declined              | customer_action_required |
| `40`                                                   | Function not supported                        | (none)                                                      | payment_method_unavailable | do_not_retry             |
| `41`                                                   | Lost card, pick-up                            | same (fraud account)                                        | fraud_or_risk              | do_not_retry             |
| `42`                                                   | No universal account                          | Special pickup (**conflict**)                               | card_declined              | do_not_retry             |
| `43`                                                   | Stolen card, pick-up                          | same                                                        | fraud_or_risk              | do_not_retry             |
| `44`                                                   | (none)                                        | Pickup card                                                 | fraud_or_risk              | do_not_retry             |
| `46`                                                   | (none)                                        | Closed account                                              | card_declined              | do_not_retry             |
| `51`                                                   | Insufficient funds                            | same                                                        | insufficient_funds         | customer_action_required |
| `52`                                                   | No checking account                           | same                                                        | card_declined              | customer_action_required |
| `53`                                                   | No savings account                            | same                                                        | card_declined              | customer_action_required |
| `54`                                                   | Expired card                                  | Expired / missing expiry                                    | card_declined              | customer_action_required |
| `55`                                                   | Incorrect PIN                                 | Incorrect/missing PIN                                       | authentication_failed      | customer_action_required |
| `56`                                                   | No card record                                | (none)                                                      | card_declined              | do_not_retry             |
| `57`                                                   | Not permitted to cardholder                   | same                                                        | card_declined              | do_not_retry             |
| `58`                                                   | Not permitted to terminal (may be chargeback) | Not allowed at terminal                                     | card_declined              | do_not_retry             |
| `59`                                                   | Suspected fraud                               | same                                                        | fraud_or_risk              | do_not_retry             |
| `61`                                                   | Exceeds withdrawal amount limit               | Exceeds approval amount limit                               | card_declined              | customer_action_required |
| `62`                                                   | Restricted card                               | Restricted card (region/country)                            | card_declined              | do_not_retry             |
| `63`                                                   | (none)                                        | Security violation                                          | fraud_or_risk              | do_not_retry             |
| `64`                                                   | (none)                                        | Fails AML requirement                                       | fraud_or_risk              | manual_review            |
| `65`                                                   | Exceeds withdrawal frequency limit            | same                                                        | authentication_required    | customer_action_required |
| `67`                                                   | Hard capture, pick-up                         | (none)                                                      | fraud_or_risk              | do_not_retry             |
| `70`                                                   | (none)                                        | PIN data required                                           | authentication_required    | customer_action_required |
| `74`                                                   | (none)                                        | PIN encryption value mismatch                               | configuration              | manual_review            |
| `75`                                                   | PIN tries exceeded                            | same                                                        | authentication_failed      | do_not_retry             |
| `76`                                                   | Invalid account                               | Unsolicited reversal (**conflict**)                         | unknown                    | manual_review            |
| `77`                                                   | (none)                                        | Issuer not in service                                       | payment_method_unavailable | customer_action_required |
| `78`                                                   | Customer not eligible for POS (Star)          | Blocked, first used (**conflict**)                          | card_declined              | customer_action_required |
| `79`                                                   | (none)                                        | Already reversed by switch                                  | duplicate_request          | do_not_retry             |
| `80`                                                   | (none)                                        | No financial impact                                         | unknown                    | unknown                  |
| `81`                                                   | (none)                                        | PIN cryptographic error                                     | configuration              | manual_review            |
| `82`                                                   | (none)                                        | Invalid CVV                                                 | card_declined              | customer_action_required |
| `85`                                                   | (none)                                        | No reason to decline (verification-only request)            | n/a (approval-like)        | n/a                      |
| `86`                                                   | (none)                                        | Cannot verify PIN                                           | authentication_failed      | customer_action_required |
| `87`                                                   | PIN key error                                 | (none)                                                      | configuration              | manual_review            |
| `88`                                                   | Information not on file                       | (none)                                                      | card_declined              | do_not_retry             |
| `89`                                                   | CVV verification failed                       | Ineligible for financial position info (GIV) (**conflict**) | card_declined              | customer_action_required |
| `90`                                                   | Cutoff in progress                            | (none)                                                      | provider_unavailable       | retry_conditionally      |
| `91`                                                   | Issuer/switch inoperative                     | Issuer not available                                        | provider_unavailable       | retry_conditionally      |
| `92`                                                   | Unknown institution for routing               | Invalid issuer                                              | card_declined              | do_not_retry             |
| `93`                                                   | (none)                                        | Violation of law                                            | card_declined              | do_not_retry             |
| `96`                                                   | System malfunction                            | Issuer system malfunction                                   | provider_unavailable       | retry_conditionally      |
| `98`                                                   | Duplicate reversal                            | (none)                                                      | duplicate_request          | do_not_retry             |
| `99`                                                   | Duplicate transaction                         | same                                                        | duplicate_request          | do_not_retry             |
| `1A`                                                   | (none)                                        | Additional customer authentication required                 | authentication_required    | customer_action_required |
| `B1`                                                   | (none)                                        | Surcharge not permitted (US)                                | invalid_amount             | do_not_retry             |
| `B2`                                                   | (none)                                        | Surcharge not supported by debit network                    | invalid_amount             | do_not_retry             |
| `N0`                                                   | (none)                                        | Force STIP                                                  | unknown                    | unknown                  |
| `N3`                                                   | (none)                                        | Cash service not available                                  | payment_method_unavailable | do_not_retry             |
| `N4`                                                   | (none)                                        | Cash request over limit                                     | invalid_amount             | do_not_retry             |
| `N5`                                                   | (none)                                        | Ineligible for resubmission                                 | card_declined              | do_not_retry             |
| `N7`                                                   | (none)                                        | CVV2 failure                                                | card_declined              | customer_action_required |
| `N8`                                                   | (none)                                        | Amount exceeds pre-authorized amount                        | invalid_amount             | do_not_retry             |
| `P5`                                                   | (none)                                        | PIN unblock denied                                          | authentication_failed      | do_not_retry             |
| `P6`                                                   | (none)                                        | PIN change denied (unsafe PIN)                              | authentication_failed      | do_not_retry             |
| `Q1`                                                   | (none)                                        | Card authentication failed                                  | authentication_failed      | customer_action_required |
| `R0`                                                   | (none)                                        | Stop payment order                                          | card_declined              | do_not_retry             |
| `R1`                                                   | (none)                                        | Revocation of authorisation order                           | card_declined              | do_not_retry             |
| `R2`                                                   | (none)                                        | Not eligible for Visa PIN                                   | payment_method_unavailable | do_not_retry             |
| `R3`                                                   | (none)                                        | Revocation of all authorizations                            | card_declined              | do_not_retry             |
| `Z3`                                                   | (none)                                        | Unable to go online; offline-declined                       | card_declined              | retry_conditionally      |
| `S9`                                                   | Expiration date mismatch                      | (none)                                                      | card_declined              | customer_action_required |
| `SA`                                                   | Inactive card                                 | (none)                                                      | card_declined              | customer_action_required |
| `SE`                                                   | Ineligible account                            | (none)                                                      | card_declined              | do_not_retry             |
| `T3`                                                   | Lost card (no pickup)                         | (none)                                                      | fraud_or_risk              | do_not_retry             |
| `T4`                                                   | Closed account                                | (none)                                                      | card_declined              | do_not_retry             |
| `T5`                                                   | Dormant account                               | (none)                                                      | card_declined              | customer_action_required |
| `1101`, `1102`, `1276`                                 | DS returned an error for ARes                 | (none)                                                      | authentication_failed      | retry_conditionally      |
| `1201`, `1203`, `1301`, `1303`, `1305`, `1403`, `1404` | ACS returned an error for AReq                | Visa lists `1203`, `1301`, `1305` with the same meaning     | authentication_failed      | retry_conditionally      |
| `1151`                                                 | Error sending to DS                           | (none)                                                      | network_or_timeout         | retry_conditionally      |
| `2700`                                                 | ID validation cannot be provided              | (none)                                                      | authentication_failed      | unknown                  |
| `4837`                                                 | No cardholder authorization (dispute reason)  | (none)                                                      | fraud_or_risk              | manual_review            |
| `4853`                                                 | Cardholder dispute                            | (none)                                                      | unknown                    | manual_review            |

### 4.6 Mastercard Merchant Advice Codes (suffix after the dot; source: /docs/mastercard-merchant-advice-codes): 17 values

Format: `errorcode=<base>.<MAC>`. payabl. states it does not retry or block on the merchant's behalf.

| MAC  | Meaning (paraphrase)                       | Retry hint               |
| ---- | ------------------------------------------ | ------------------------ |
| `01` | New account information available          | customer_action_required |
| `02` | Cannot approve now, try later              | retry_conditionally      |
| `03` | Do not try again                           | do_not_retry             |
| `04` | Token requirements not met for token type  | do_not_retry             |
| `05` | Negotiated value not approved              | do_not_retry             |
| `21` | Payment cancellation (by cardholder)       | do_not_retry             |
| `22` | Merchant does not qualify for product code | do_not_retry             |
| `24` | Retry after 1 hour                         | retry_conditionally      |
| `25` | Retry after 24 hours                       | retry_conditionally      |
| `26` | Retry after 2 days                         | retry_conditionally      |
| `27` | Retry after 4 days                         | retry_conditionally      |
| `28` | Retry after 6 days                         | retry_conditionally      |
| `29` | Retry after 8 days                         | retry_conditionally      |
| `30` | Retry after 10 days                        | retry_conditionally      |
| `40` | Consumer non-reloadable prepaid card       | do_not_retry             |
| `41` | Consumer single-use virtual card           | do_not_retry             |
| `42` | Sanctions scoring service                  | manual_review            |

The issuer table (§4.4) also lists combined forms `25.01-03`, `26.01-03` and `59.01-03`.

### 4.7 3DS transaction status reason (`3dtransactionStatusReason`; source: /docs/3ds-transaction-status-reason-codes): 16 values

Sent in callbacks only when 3DS failed, and only once enabled by support. Suggested category for all: authentication_failed, except where noted.

| Value | Meaning (paraphrase)                    | Suggested category / retry                       |
| ----- | --------------------------------------- | ------------------------------------------------ |
| `01`  | Card authentication failed              | authentication_failed / customer_action_required |
| `02`  | Unknown device                          | authentication_failed / customer_action_required |
| `03`  | Unsupported device                      | authentication_failed / customer_action_required |
| `04`  | Authentication frequency limit exceeded | authentication_failed / retry_conditionally      |
| `05`  | Expired card                            | card_declined / customer_action_required         |
| `06`  | Invalid card number                     | card_declined / customer_action_required         |
| `07`  | Invalid transaction                     | authentication_failed / do_not_retry             |
| `08`  | No card record                          | card_declined / customer_action_required         |
| `09`  | Security failure                        | fraud_or_risk / do_not_retry                     |
| `10`  | Stolen card                             | fraud_or_risk / do_not_retry                     |
| `11`  | Suspected fraud                         | fraud_or_risk / do_not_retry                     |
| `12`  | Not permitted to cardholder             | card_declined / do_not_retry                     |
| `13`  | Cardholder not enrolled                 | authentication_failed / customer_action_required |
| `14`  | Timed out at ACS                        | network_or_timeout / retry_conditionally         |
| `15`  | Low confidence                          | fraud_or_risk / customer_action_required         |
| `16`  | Medium confidence                       | fraud_or_risk / customer_action_required         |

### 4.8 APM codes (source: /docs/error-codes-apm): 19 distinct codes

Interpret these only together with the `payment_method` context: EPS `005` would otherwise collide with issuer `05`.

| Method  | Code     | Meaning (paraphrase)                                       | Category                   | Retry                    |
| ------- | -------- | ---------------------------------------------------------- | -------------------------- | ------------------------ |
| EPS     | `021`    | Not completed: customer did not finish / closed window     | unknown (abandonment)      | customer_action_required |
| EPS     | `009`    | Internal failure on EPS side                               | provider_unavailable       | retry_conditionally      |
| EPS     | `005`    | Amount must be positive                                    | invalid_amount             | do_not_retry             |
| EPS     | `010`    | IBAN problem: no account found                             | invalid_request            | customer_action_required |
| EPS     | `-1315`  | Timeout / buyer cancelled / connection lost (same as §4.1) | network_or_timeout         | retry_conditionally      |
| Sofort  | `S-8023` | Invalid BIC                                                | invalid_request            | customer_action_required |
| Sofort  | `S-8058` | Payment not possible with this service                     | payment_method_unavailable | customer_action_required |
| Sofort  | `S-8013` | Unsupported currency                                       | configuration              | do_not_retry             |
| Sofort  | `S-8054` | All products deactivated; initiation aborted               | configuration              | manual_review            |
| Sofort  | `S-1001` | Technical error                                            | provider_unavailable       | retry_conditionally      |
| Sofort  | `S-8001` | Unknown project                                            | configuration              | do_not_retry             |
| Sofort  | `S-8015` | Amount out of range                                        | invalid_amount             | do_not_retry             |
| Sofort  | `S-8003` | Request could not be processed                             | unknown                    | manual_review            |
| Trustly | `141602` | Function access denied                                     | configuration              | do_not_retry             |
| Trustly | `141603` | Insufficient funds                                         | insufficient_funds         | customer_action_required |
| Trustly | `141615` | Invalid amount                                             | invalid_amount             | do_not_retry             |
| Trustly | `141616` | Invalid credentials                                        | configuration              | do_not_retry             |
| Trustly | `141620` | Unknown error                                              | unknown                    | unknown                  |
| Trustly | `141624` | Invalid bank account number                                | invalid_request            | customer_action_required |
| Trustly | `141638` | End user is blocked                                        | fraud_or_risk              | do_not_retry             |

### 4.9 Web SDK codes (source: /docs/error-handling): 6 codes

| Code       | Meaning (paraphrase)                                         | Category                       | Retry                                         |
| ---------- | ------------------------------------------------------------ | ------------------------------ | --------------------------------------------- |
| `PC216001` | Transaction already submitted                                | duplicate_request              | do_not_retry                                  |
| `PC216003` | Session expired (sessions last 15 min per Integration Steps) | invalid_request                | safe_to_retry_technical_request (new session) |
| `PC216004` | Session status unknown                                       | unknown                        | manual_review                                 |
| `PC216005` | Missing required fields                                      | invalid_request                | do_not_retry                                  |
| `PC216006` | Window closed                                                | unknown (customer abandonment) | customer_action_required                      |
| `PC215000` | SDK internal error                                           | provider_unavailable           | retry_conditionally                           |

### 4.10 Count summary

| Table                                                                  | Codes                      |
| ---------------------------------------------------------------------- | -------------------------- |
| §4.1 payabl. gateway                                                   | 92                         |
| §4.2 risk sub-codes                                                    | 12                         |
| §4.3 CFT-only (payabl. 3 + Mastercard OCT 8)                           | 11                         |
| §4.4 issuer/scheme (padded)                                            | 87                         |
| §4.5 raw Visa/Mastercard (un-padded; two rows group several 3DS codes) | 99 rows covering 107 codes |
| §4.6 Mastercard MAC values                                             | 17                         |
| §4.7 3DS reason values                                                 | 16                         |
| §4.8 APM                                                               | 19 distinct                |
| §4.9 Web SDK                                                           | 6                          |
| Observed only in example                                               | 1 (`-5016`)                |

---

## 5. Payment status / lifecycle values

payabl. has **no single `payment_state`/`status` enum for card payments**. State has to be derived from these fields together:

### 5.1 Code field (`status` sync / `errorcode` async)

- `0`: success for the operation in question
- `2000`: pending / in progress; final status not yet known (FAQ). Also returned together with `url_3ds` or `redirect_url` when a redirect is needed.
- anything else: error/decline (see §4)

### 5.2 Notification `type` (documented values)

| `type`    | Meaning as documented                                                                                                                                                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order`   | Authorization step. In the pre-authorization flow, `type=order` + `errorcode=0` means the funds are **reserved (authorized, not captured)**. The 3DS-services page adds: "successful 3D and authorization is failed → `type=order`", so `type=order` + non-zero `errorcode` is a failed authorization. The HPP decline example is `type=order&errorcode=-10001`. |
| `capture` | Funds charged. For **Authorization** (auth+capture in one call) the success indicators are `errorcode=0` **and** `type=capture` (/docs/authorization). Also used for APM/bank-transfer captures together with `payment_state`.                                                                                                                                   |
| `refund`  | Refund callback (opt-in; sent to the original deposit's notification URL)                                                                                                                                                                                                                                                                                        |

AFT page: callbacks use `type` "order" and "capture" as for cards. Notification `type` values for reversal, CFT and chargeback are **NOT DOCUMENTED**. Chargebacks are delivered by email, the dashboard and the diagnose interface (FAQ), not as a documented notification.

### 5.3 `payment_state` (APM / bank transfer notifications only)

Documented on Instant Bank Transfer and SEPA Direct Debit:

| Value              | Meaning                                                               |
| ------------------ | --------------------------------------------------------------------- |
| `not_credited_yet` | Capture accepted, funds not yet received                              |
| `credited`         | Capture successful, funds received                                    |
| `not_credited`     | Capture failed (e.g. SEPA `errorcode=-5016`, "Bank rejected payment") |

Each state change triggers a separate notification.

### 5.4 Diagnose interface step types (`tx_diagnose` XML `<type>`)

Documented mapping: `invoice` → authorized; `booked` → captured; `aft` → AFT step only (no auth/capture); `refund`; `chargeback`; `retrieval_request`; `partial booking` → partial capture; `reversal`.
Request filter types: `capture`, `chb`, `refund`, `aft`, `retrieval_request`, `cft`, `rdr_transfer`, `mc_alert_transfer`, `pending`, `failed`, `tx`, `orderid`, `externalid`.

### 5.5 Transaction log (Backoffice API) values

- `transaction_status`: `Successful`, `Failed`, `In progress`
- `transaction_type`: `Order`, `Capture`, `Refund`, `CFT`, `2nd Chargeback`, `Chargeback`, `RDR Transfer`; for chargeback download also `Pre-Arbitration`, `Arbitration`, `Representment`, `Returned CFT`, `Returned Refund`.

### 5.6 3DS status fields (optional callback fields)

- `3dstatus`: the Parameters page lists `Verified/Attempted/Non3d/Incomplete/Not verified`; the 3DS-services page lists `NOT_IN_RANGE`, `NOT_ENROLLED`, `ABORTED`, `VERIFIED`, `ATTEMPTED`, `FAILED`, `ERROR`. Examples use `VERIFIED`.
- `3dauthentication_status`: `Y` success, `N` failed, `A` attempted, `R` rejected by bank, `U` unknown reason.
- `3dauthentication_flow`: `frictionless_flow`, `challenge_flow`.

### 5.7 SDK client-side outcomes (not server state)

- Web SDK JS callback `status`: `APPROVED`, `DECLINED` (both include metadata), `ERROR`, `CANCELLED` (metadata may be missing). The docs say merchants **must not** update their systems from this callback.
- Mobile SDK result: Completed / Canceled / Failed (`PBLPaymentResult.*`).

### 5.8 Authorized vs captured vs settled

- **Authorized**: pre-authorization success (`type=order`, `errorcode=0`; diagnose `invoice`). Expires after roughly 9-30 days depending on issuer, after which capture/reversal fail. Auto-capture can be configured by payabl.
- **Captured**: `type=capture`, `errorcode=0` (diagnose `booked`; `partial booking` = partial capture). With **partial authorization** enabled, the captured `amount` in the capture notification can be lower than requested (example: requested 1000.10, captured 50.00). The adapter must report the notification `amount`.
- **Credited** (APM): `payment_state=credited` means funds received.
- **Settled/paid out to merchant**: **NOT DOCUMENTED** as a payload state.
- **Reversed**: reversal response `status=0`; diagnose `reversal`. A reversal notification `type` is NOT DOCUMENTED.
- **Refunded**: refund response `status=0` or `2000` (the reference example is pending); callback `type=refund`. Partial refunds are allowed while the total stays within the captured amount.

---

## 6. Notifications / callbacks / webhooks

### 6.1 Delivery

- **Transport**: HTTP POST from payabl. to the `notification_url` given in the request or configured on the account. The docs say callbacks are sent "immediately after receiving a status from payment system".
- **Body format**: URL-encoded `key=value&...` (every example). The exact `Content-Type` header is **NOT DOCUMENTED**. Field order is not fixed: examples show different orders.
- **Source IPs** (/docs/server-ip-addresses): sandbox `143.42.17.197, 172.104.255.126, 18.199.199.5, 18.193.0.28, 63.177.190.149`; production `194.150.189.194, 79.133.54.151, 52.59.57.170, 63.180.125.206, 63.180.23.128`.
- **Acknowledgement**: with Auto-Retry enabled, the merchant must reply HTTP 200 with body `OK`. Anything else counts as failure.
- **Retries**: Auto-Retry is opt-in (contact support). It resends **every 2 hours until acknowledged, stopping after 3 days**. Without it, merchants can call `send_notification` (Resend Notification) for the last status, or use `tx_diagnose`.
- **Ordering guarantees**: **NOT DOCUMENTED**. Because of retries and multiple `payment_state` notifications, consumers should not assume arrival order.
- **Opt-in caveats**: refund callbacks are off by default. In sandbox, `gateway_test` / `gateway_test_3d` do not send callbacks for non-3D transactions, while `gateway_test_cb` does and also includes custom fields. Which fields appear can be changed per merchant by support (FAQ, Parameters page).

### 6.2 Fields

Core fields (HPP/IBT field references, 3DS-services page):

| Field                 | Meaning                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `transactionid`       | payabl. transaction ID                                                                                                         |
| `type`                | `order` / `capture` / `refund` (see §5.2)                                                                                      |
| `errorcode`           | `0` success, `2000` pending, else error code                                                                                   |
| `errormessage`        | Decline reason text; empty on success                                                                                          |
| `orderid`             | Merchant reference                                                                                                             |
| `security`            | Notification signature (sensitive, see §6.3)                                                                                   |
| `timestamp`           | Notification timestamp (Unix seconds in most examples). Added by the "simplified signature" scheme; absent from older examples |
| `amount`, `currency`  | Present in many examples (optional/configurable)                                                                               |
| `payment_method`      | Payment method ID                                                                                                              |
| `payment_state`       | APM only (§5.3)                                                                                                                |
| `related_token_ids`   | Appears (empty) in HPP/AFT/partial-approval examples; meaning **NOT DOCUMENTED**                                               |
| `first_time_customer` | Appears in the Parameters example (`0`); meaning **NOT DOCUMENTED**                                                            |
| `avs_result`          | Appears in the AFT example (`none`); values **NOT DOCUMENTED** on the pages read                                               |

Optional fields enabled per merchant (/docs/parameters-in-responsescallbacks): `bin`, `bin_country`, `payment_method`, `ccn_four`, `ccn_four_real` (Apple Pay real card last 4), `card_type` (short `VISA` or full `VISA Classic Deffered Debit`), `currency`, `amount`, `expiry_year`, `expiry_month`, `cardholder` (described as "Cardholder bank name", yet the examples hold a person's name like `Muster+Mann`); 3DS: `3dstatus`, `3dauthentication_status`, `3dauthentication_flow`, `3dProtocolVersion`, `3dtransactionStatusReasonMessage`, `3dtransactionStatusReason`, `3dcardholderInformation`, `eci`; MPI: `mpi_avv`, `mpi_ds_transaction_id`; CoF scheme IDs: `banknet_date`, `banknet_ref_number`, `visa_transaction_id`; scheme: `transaction_identifier`. APM: `account_number` (IBAN, masked in examples), `account_holder`, `bank_number` (BIC), `bank_name`.

### 6.3 Signature / verification (treat as sensitive; do not attempt verification)

- **Current ("simplified") notification signature**: `security = sha256(transactionid + type + errorcode + timestamp + secret)` with fixed order and plain concatenation, giving 64 hex chars. Documented example: `sha256(118656640capture01610018172goodsecret)` → `1f67d79aa5e2a4070b2091837fefae84cd15f08370de0cee4bf9ea75951e047b`.
- **Legacy form**: older examples (authorization, pre-authorization, refund, CoF) show a **40-hex** `security` and say it is "calculated in the same way as the signature parameter", i.e. SHA-1 over sorted values + secret. A parser may meet either length.
- **Request `signature`**: lowercase SHA-1 (40 hex) over all request values sorted by parameter name, with the secret appended. It appears in pasted _requests_ and in the Web SDK session _response_.
- PandaPayLens should **redact** `security` and `signature` and never ask for the merchant secret. It may report "signature present (sha256-length / sha1-length)" as metadata.

### 6.4 Web SDK JS callback (browser-side; JSON)

Transcribed from docs URL https://docs.payabl.com/docs/parameters:

```json
{
  "status": "APPROVED",
  "metadata": {
    "errorcode": "0",
    "type": "capture",
    "errormessage": "",
    "orderid": "payabl-Test",
    "transactionid": "213548331"
  }
}
```

(The metadata key table on the same page misspells `orderid` as `ordered`.) This object is delivered to the merchant's JavaScript `callback`, not to `notification_url`. Note: the section heading on that page says "Response Callback Notifications … using a Notification URL", which contradicts Integration Steps; see §10.

### 6.5 More notification examples (faithful transcriptions)

HPP success callback, transcribed from docs URL https://docs.payabl.com/docs/initiate-a-transaction-1:

```
3dstatus=VERIFIED&timestamp=1722343778&orderid=ORDER-00005&errorcode=0&type=capture&related_token_ids=&
errormessage=&3dauthentication_flow=challenge_flow&3dProtocolVersion=2.2.0&transactionid=105937169&
3dauthentication_status=Y&security=4f77617275d09fe3f13a74d52f6900b1bd124eb52fb0b9fa99c78a0969179057
```

HPP decline (return-page response), same URL:

```
errorcode=-10001&related_token_ids=&3dProtocolVersion=2.2.0&type=order&transactionid=105937142&
errormessage=3DSecure+verification+failed+or+incomplete&3dauthentication_flow=challenge_flow&
3dauthentication_status=N&orderid=ORDER-00005&timestamp=1722343677&
security=f9b33e2270eefc742e709e578da41e41a86a5dd6df3feac7349943b2bf245fc4
```

Instant Bank Transfer accepted capture, transcribed from docs URL https://docs.payabl.com/docs/instant-bank-transfer:

```
payment_method=123&bank_number=&orderid=Payabl-Test&payment_state=not_credited_yet&type=capture&errorcode=0&timestamp=1660057537&
errormessage=&security=081969470be36b8248858d40616fdf8c906c7f1ae248871ab74a365ea34e81ff&transactionid=104576829
```

SEPA DD failed capture, transcribed from docs URL https://docs.payabl.com/docs/sepa-direct-debit:

```
transactionid=106216676&security=eb5329a5045eb93c56858ebe1d46f79df7b72dd513d5f666522d17b30b6e7402&payment_method=139&errormessage=Bank+rejected+payment&account_number=BEXXXXXXXXXX9770&account_holder=TEST+DDD+Creditor&payment_state=not_credited&orderid=Payabl-Test&errorcode=-5016&timestamp=1746705313&type=capture
```

Refund callback, transcribed from docs URL https://docs.payabl.com/docs/refund (note: `errorcode=` is empty in the example, and the `security` is 40 hex):

```
errormessage=&errorcode=&amount=0.01&type=refund&security=4168d875bca4f10af86c5a23589031c4004a6c1f&orderid=Payabl-Test&transactionid=393467255&currency=EUR
```

Diagnose XML (by transaction ID), transcribed from docs URL https://docs.payabl.com/docs/diagnose-interface-1:

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<response>
<process>
<error_message></error_message>
<process_time>24.05.2012 14:11:37</process_time>
<status>0</status>
</process>
<transaction>
<transaction_id>6907711</transaction_id>
<transaction_status>
<step1>
<amount>1.23</amount>
<creation_date>24.05.2012 14:07:43</creation_date>
<currency>EUR</currency>
<custom1> </custom1>
<error_code>0</error_code>
<order_id>1234-123456789-4321</order_id>
<type>invoice</type>
</step1>
<step2>
<amount>1.23</amount>
<creation_date>24.05.2012 14:11:07</creation_date>
<currency>EUR</currency>
<custom1> </custom1>
<error_code>0</error_code>
<order_id>1234-123456789-4321</order_id>
<type>booked</type>
</step2>
</transaction_status>
</transaction>
</response>
```

Dates in the XML use `DD.MM.YYYY HH:MM:SS`. The timezone is **NOT DOCUMENTED**.

### 6.6 Duplicate detection

There is **no event ID or delivery ID**. Duplicates are expected from Auto-Retry, Resend Notification, and repeated `payment_state` updates. Suggested dedupe key: `transactionid` + `type` + `errorcode` + `payment_state` (+ `amount`). Whether `timestamp` stays the same across retries of one notification is **NOT DOCUMENTED**, so it should not be the sole key.

---

## 7. Identifiers

| Field                                                                                                        | Scope                                                                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transactionid` (sync + async), `transid` (sync alias), `transaction_id` (XML, Mobile SDK JSON)              | payabl. transaction                                                                                            | Generated for an authorize/pre-authorize. **Capture, reversal and refund requests reference the original `transactionid`**, and their responses echo that same ID (capture example `6905370` in → `6905370` out; refund example `106280495` in and out). The diagnose `externalid` example shows several `refund` steps under one `transaction_id`, and the `tx` example shows `invoice` (step1) and `booked` (step2) under one ID. So **one `transactionid` spans the lifecycle** and `type`/step distinguishes the operations. Caveat: the refund _callback_ example uses a different ID than the refund _request_ example. They come from separate examples, so whether a refund ever gets its own ID is **ambiguous** |
| CFT response `transactionid`                                                                                 | New ID for the payout                                                                                          | The CFT request passes the original deposit's `transactionid` (`104837274`) and the response returns a new one (`104837530`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `orderid` (`order_id` in XML/Mobile)                                                                         | Merchant order reference, max 40, optional, may be empty                                                       | Not guaranteed unique                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `external_id` (request) / `externalid` (diagnose)                                                            | Merchant's unique ID, up to 255                                                                                | The diagnose example returns several transactions for one external ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `sessionid` (HPP) / `session_id` (Web SDK, Mobile)                                                           | Checkout session                                                                                               | Web SDK sessions last 15 min. Treat as sensitive-ish (it forms the HPP `start_url`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `user_id`                                                                                                    | "Payment system user identifier"                                                                               | Exact semantics **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `token_id`                                                                                                   | CoF: `INIT` on the first payment, then the **initial transaction's `transactionid`** on later CIT/MIT payments | Parent link for recurring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `recurring_id`                                                                                               | Card recurring (`INIT` first) / SEPA DD (initial `transactionid` for subsequent)                               | Parent link for recurring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `merchantid` (`merchant_id` Mobile)                                                                          | Merchant account                                                                                               | Identifies the merchant; mask in output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `customerid`, `custom1`-`custom3`                                                                            | Merchant-defined                                                                                               | May contain PII                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `transaction_identifier`, `visa_transaction_id`, `banknet_ref_number`, `banknet_date`, `transaction_link_id` | Scheme-level IDs (optional fields)                                                                             | Link economically related transactions at scheme level                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mpi_ds_transaction_id`                                                                                      | 3DS Directory Server transaction UUID                                                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ppro_id`                                                                                                    | Appears in the APM pre-authorization example                                                                   | Meaning **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `related_token_ids`                                                                                          | Appears empty in notifications                                                                                 | Meaning **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Parent/original links for refunds/captures: **no separate `parent_transaction_id` field** is documented. The parent link comes from reusing `transactionid`; the payload's `type` tells you which operation it was.

---

## 8. Sensitive fields

Redact or mask by default. These can appear in pasted payloads; request fields are included because developers often paste request/response pairs.

- **Card data**: `ccn` (full PAN, requests), `cvc_code`, `exp_month`/`exp_year`, `expiry_month`/`expiry_year`, `cardholder_name`, `cardholder`, `bin` + `ccn_four` together (and `ccn_four_real`), `ccn_masked` (log export).
- **3DS/MPI**: `mpi_avv` (CAVV/AAV, a cryptographic authentication value; treat as secret), `url_3ds` (contains a one-time session path).
- **Bank data**: `iban`, `account_number` (masked in examples but may be full), `account_holder`, `bank_number` (BIC), `bank_name`.
- **Personal data**: `email`, `firstname`, `lastname`, `billing_*`/`shipping_*` names and addresses, `street`, `house`, `zip`, `city`, `state`, `postbox`, `country`, `phone`, `mobile`, `fax`, `birthday`, `nationality`, `gender`, `salutation`, `title`, `company`, `customerip`/`customer_ip`, `customerid`, `custom1-3`.
- **Secrets / auth material**: `signature`, `security`, the merchant secret (sandbox secret `b185` appears in docs), `redirect_secret`, `ephemeral_key` (Mobile SDK), `session_id`/`sessionid`, `start_url` (contains the session), `redirect_url`, Backoffice `token`, `username`/`password` (portal login), `Authorization: Backoffice <token>` header.
- **Merchant identifiers**: `merchantid`/`merchant_id`, `app_bundle_id` (Android: signing-cert fingerprint), `shop_url`, `notification_url`, `url_return`/`url_success`/`url_failed`.

---

## 9. Structural detection hints

Strong payabl. signals (combine several; any one alone is weak):

1. **Synchronous Gateway response**: a URL-encoded string containing `transactionid=` **and** `transid=` with the same value, plus `status=` and `errmsg=` (and usually `price=` equal to `amount=`). The paired aliases `transactionid/transid`, `errormessage/errmsg`, `amount/price` are highly distinctive.
2. **Notification**: URL-encoded with `transactionid`, `type` ∈ {`order`,`capture`,`refund`}, `errorcode`, `errormessage` and `security` (40 or 64 lowercase hex), often `timestamp` (10-digit). Optional `3dauthentication_flow=frictionless_flow|challenge_flow`, `3dProtocolVersion`, `related_token_ids=`, `payment_state=not_credited_yet|credited|not_credited`.
3. **Code shape**: negative integers in the gateway families `-6xxx`, `-5xxx`, `-13xxx`, `-111005`, `-2400…-2455`, and especially `-5004.0x[a-f]`.
4. **HPP init**: `errorcode`, `errorcodes`, `sessionid`, `start_url` pointing at `…payabl.com/hpp/…/start?session_id=`.
5. **URLs/hosts**: `sandbox.payabl.com`, `pay4.sandbox.payabl.com`, `pay4.payabl.com`, `/pay/backoffice/…`, `/3dss/test/v1|v2/…/redirect` in `url_3ds`, `apmgw-prod.payabl.tech`; legacy `powercash21`, `powerpay21`, `inatec`.
6. **Diagnose / resend XML**: root `<response>` with `<process><error_message/><process_time>DD.MM.YYYY HH:MM:SS</process_time><status>`, then `<transaction><transaction_id>` with `<transaction_status><stepN><type>invoice|booked|refund…`; resend uses `<notification_status><transaction_id_1>…<notification_sent>SUCCESSFULL`.
7. **Web SDK JS callback JSON**: `{status: "APPROVED"|"DECLINED"|"ERROR"|"CANCELLED", metadata: {errorcode, type, errormessage, orderid, transactionid}}` with values as strings.
8. **Mobile init JSON**: keys exactly `session_id`, `status` (0/-1), `ephemeral_key`, `transaction_id` (or `error_code`, `error_message`).

How this differs from other providers:

- **Stripe**: JSON with `object`, `id` prefixes (`pi_`, `ch_`, `evt_`), `type` like `payment_intent.succeeded`. payabl. is URL-encoded with `type=capture`.
- **Adyen**: JSON with `pspReference`, `resultCode`, `notificationItems`/`NotificationRequestItem`, `eventCode`. payabl. has none of these.
- **PayPal**: JSON with `event_type` (`PAYMENT.CAPTURE.COMPLETED`), `resource`, `links`.
- Risk of false positives: other gateways built on the same legacy platform (payabl. examples still show Powercash21/inatec heritage) may emit the same field names. That is **NOT DOCUMENTED** either way, so confidence should rise when payabl.-specific hosts or the `-5004.0x` shape are present.

---

## 10. Limitations, ambiguities, regional/product differences

1. **Lists are not exhaustive**: both response-code pages say only the most common codes are listed.
2. **Code-space overlaps**: issuer codes (`05`, `59.03`, `6P`), raw scheme codes (`5`, `1A`), APM codes (`005`, `S-8023`, `141603`), Mastercard OCT codes (`062000`) and payabl. codes (`-6000`, `-5004.03a`) all share `status`/`errorcode`. Padding is inconsistent (`05` vs `5`). Normalize, but use `payment_method` and the operation (CFT vs deposit) as context.
3. **Conflicting meanings** between the issuer table and the Visa/Mastercard pages (e.g. `8`, `19`, `31`, `42`, `76`, `78`, `89`). The Visa/MC pages are not in the docs index.
4. **`-5008` vs `-5007`**: both are labeled "CFT aborted", on the main page and the CFT page respectively.
5. **Two notification signature schemes**: SHA-256 "simplified" (64 hex, includes `timestamp`) and legacy SHA-1-style (40 hex). Which one a merchant gets is account-dependent and **NOT DOCUMENTED**.
6. **Configurable payloads**: support can add or remove notification fields per merchant, so field presence is unreliable (only `transactionid`, `type`, `errorcode`, `errormessage`, `orderid`, `security` appear consistently).
7. **Notification content type, charset, ordering and per-retry timestamp behavior** are **NOT DOCUMENTED**.
8. **Reversal, CFT and chargeback notification `type` values** are **NOT DOCUMENTED**. Chargebacks surface through email, the dashboard and diagnose XML.
9. **Refund ID semantics** are ambiguous (§7).
10. **Content-type labeling in OpenAPI** is inconsistent (`text/plain` vs `application/json` for the same URL-encoded body).
11. **Docs rendering defects**: `¤cy=` and `×tamp=` in examples; the partial-approval example has `timestamp=106536295` (not a plausible Unix time). The refund callback example has an empty `errorcode=`.
12. **Web SDK docs contradiction**: Parameters page puts the JSON `{status, metadata}` under "Response Callback Notifications … Notification URL", while Integration Steps and the Web SDK FAQ say it goes to the JS callback and that `notification_url` gets the normal server notification.
13. **Regional/product**: 3DS behavior depends on processing country and account settings. EEA/UK non-3DS transactions can get soft decline `65` and then `url_3ds`. SEPA DD is EUR-only with no refunds. Instant Bank Transfer is EUR/GBP with no refunds or chargebacks. CFT with raw card data is restricted to non-gambling merchants. Bitcoin is mentioned in the FAQ (no refunds/chargebacks) without any API details. POS/SoftPOS products are separate and out of scope.
14. Some legacy example hosts (`sandbox.powercash21.com`, `pay4.sandbox.payabl.com` vs `sandbox.payabl.com`) are inconsistent; production URLs are mostly sent privately at onboarding (FAQ).

---

## 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | First-party tables cover 92 gateway codes, 12 risk sub-codes, 87 issuer codes, MAC suffixes, 3DS reasons, APM and Web SDK codes, all with clear meanings and some retry advice from payabl. Caveats (non-exhaustive lists, overlapping code spaces, Visa/MC conflicts) can be handled with context rules and an `unknown` fallback.                                                                                                            |
| **paymentResponses** | **supported** | Synchronous Gateway responses have a stable, well-exemplified URL-encoded format (`transactionid/transid`, `status`, `errormessage/errmsg`, `amount/price`, `currency`, `orderid`, `url_3ds`/`redirect_url`). HPP init, Web SDK session and Mobile init responses are also documented. XML diagnose responses could be added later.                                                                                                            |
| **webhookParsing**   | **limited**   | Notification bodies are documented with many examples and a core field set. However: no event/delivery ID; only three documented `type` values; reversal/CFT/chargeback notifications undocumented; per-merchant configurable field sets; two signature schemes (verification is out of scope anyway); content type and ordering undocumented; refund callbacks opt-in.                                                                        |
| **timeline**         | **limited**   | A timeline can be built from `type` (order → capture → refund), `payment_state` (not_credited_yet → credited/not_credited), `errorcode` (2000 → 0/error) and optional `timestamp`. Diagnose XML gives ordered steps with `creation_date`. But timestamps are optional and of uncertain retry semantics, settlement and chargeback events are not in notifications, and ordering is not guaranteed.                                             |
| **correlation**      | **limited**   | `transactionid` appears to span auth/capture/refund/reversal (same ID reused in follow-up requests/responses and diagnose steps), and `token_id`/`recurring_id` link recurring payments to the initial one. But there is no explicit parent field, CFT creates a new ID, refund-ID semantics are ambiguous, and `orderid` is optional/non-unique. Correlation on `transactionid` + `orderid` is reasonable but should be flagged as heuristic. |
