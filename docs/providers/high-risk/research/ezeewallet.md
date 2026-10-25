# eZeeWallet (adapter id `ezeewallet`): provider research

Status: qualification gate plus condensed technical specification for a parse-only PandaPayLens adapter. Everything comes from first-party sources read on the verification date. Where the sources are silent the text says **NOT DOCUMENTED**. Nothing was logged into, signed up for or requested.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Classification: `wallet`, `alternative_payment_method`
- Operator: emerchantpay group (see item 7 and item 9 for the entity and format questions)

---

## 1. Sources

All URLs below were read on 2026-10-25.

| URL                                                                                                                                                                        | What it covers                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://emerchantpay.github.io/ewallet-api-docs/                                                                                                                           | **eZeeWallet API reference** (Slate single page, "API version 2.0.2 / Documentation version 2.0.2"): authentication, endpoints, data types, Notification, NotificationEcho, error code table                                                                                                                                             |
| https://github.com/eMerchantPay/ewallet-api-docs (GitHub API: repo metadata and `gh-pages` commits)                                                                        | Repo described as "eZeeWallet Slate Public API docs", owned by the eMerchantPay organization; last `gh-pages` deploy commit "2.0.2" dated 2026-05-21                                                                                                                                                                                     |
| https://ezeewallet.com/ , https://ezeewallet.com/en , https://ezeewallet.com/en/business , https://ezeewallet.com/en/privacy_policy                                        | Live public site (HTTP 200). Pages are rendered client-side; text was read from the site's own bundled scripts and translation strings (`https://ezeewallet.com/packs/js/public-f573ac40c8ba093ab26e.js`, `https://ezeewallet.com/packs/js/558-c8b724e97c910b0b68ea.js`), which hold the About Us, Business, T&C and Privacy Policy text |
| https://emerchantpay.github.io/gateway-api-docs/ (section "eZeeWallet")                                                                                                    | emerchantpay Genesis gateway API reference: `ezeewallet` transaction type, XML request/response examples                                                                                                                                                                                                                                 |
| https://github.com/GenesisGateway/genesis_php (`src/Genesis/Api/Constants/Transaction/Types.php`, `src/Genesis/Api/Request/Financial/Wallets/EzeeWallet.php`, `README.md`) | Official Genesis PHP SDK: `EZEEWALLET = 'ezeewallet'` listed as a "Wallet-based payment"; README links to the emerchantpay gateway docs                                                                                                                                                                                                  |

Not readable without logging in: the merchant back office ("Merchant API Details" tab, where API username and password are configured). Not needed for this research.

---

## 2. Qualification gate

| #   | Item                                               | Answer                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active                   | **yes**                         | ezeewallet.com, /en and /en/business return HTTP 200 on 2026-10-25 with live sign-up and merchant registration flows. The API docs changelog has entries up to 2026-05-20 (v2.0.2, "Incorrectly specifies query parameters as body parameters") and the `gh-pages` branch was deployed 2026-05-21.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | Relevant payment service operational               | **yes** (not tested by calling) | API reference lists Production `https://ezeewallet.com/api` and Staging `https://stg.ezeewallet.com/api`; 2026 changelog entries add notification IPs (2026-01-19) and a merchant balances endpoint (2026-03-23). The Genesis docs still document the `ezeewallet` transaction type with current-dated examples.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | Developer docs publicly accessible                 | **yes**                         | The full API reference is public on GitHub Pages with no login. Only the merchant credentials (configured in the back office "Merchant API Details" tab) are behind a merchant login.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | API family and version identified                  | **yes**                         | "eZeeWallet API supports creating and listing transfer transactions via HTTPS using JSON." Version 2.0.2. Endpoints: `POST /transfers`, `POST /transfers_new`, `GET /transfers`, `POST /refunds`, `GET /transaction`, `POST /single_payouts`, `POST /single_payouts_new`, `POST /batch_payouts`, `POST /batch_payouts_new`, `GET /account`, `GET /balance`. A second, separate route exists through the Genesis gateway (`transaction_type` `ezeewallet`), see item 9.                                                                                                                                                                                                                                                                                                                                         |
| 5   | Responses/notifications examinable offline         | **yes**                         | JSON examples for approved, pending-async and error transfer responses, refund, payouts, transaction lookup, Notification (transfer and payout variants) and NotificationEcho. Signature example is reproducible offline (see section 6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6   | Merchant sectors documented by provider            | **no**                          | No page lists accepted merchant sectors. The only sector-related first-party text is consumer-side UI: wallet balances are split into "Gambling balance" and "Non gambling balance", and "Selecting Non-gambling will prohibit these funds from being used on gambling, casino and betting sites. Our Regulators require us to know this information." (site translation strings). Error `410` mentions "wallets with different industry types" without listing them. This does not state which merchant sectors are accepted.                                                                                                                                                                                                                                                                                 |
| 7   | Regional/regulatory limitations identified         | **unclear**                     | Two conflicting first-party statements. About Us: "eZeeWallet is a registered trade mark, and is a business name of Prime Pay Solutions Limited, a company incorporated in the Isle of Man ... licensed and regulated by the Isle of Man Financial Services Authority to carry on Class 8 (2)(a) and (4) - Money Transmission Services." Consumer T&C 17.1-17.2: "eZeeWallet is the DBA (doing business as) name of emerchantpay ltd. ... England and Wales" and "emerchantpay ltd. Is duly authorised and regulated by the Financial Conduct Authority under the Electronic Money Regulations 2011 (Reg. No. 900778)". The T&C refer to a list of "Non-Supported Countries" on the website, which could not be located in the public pages. API error `422` confirms per-consumer-country restrictions exist. |
| 8   | Adapter would give diagnostic value                | **yes** (moderate)              | 27 documented API error codes with messages, transfer/payout/refund status values, pending-async top-up flow, notification format with decline reason and signature. Decline reason values are NOT DOCUMENTED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | Own technical format (not a resold gateway)        | **yes**                         | The direct eZeeWallet API is its own JSON format (HTTP Basic auth, `ezeewallet.com/api`, fields `ezw_reference_id`, `merchant_transaction_id`, `source_wallet_id`, error envelope `{"error":{"code","message"}}`, codes 401-427 and 500). It is **not** the Genesis format. Separately, emerchantpay's **Genesis** gateway offers eZeeWallet as an APM (`<transaction_type>ezeewallet</transaction_type>`, XML `payment_response`), and the Genesis docs say "eZeeWallet and Genesis merchant accounts should be synced since authentication to eZeeWallet is done with Genesis merchant credentials". Payloads from that route are Genesis payloads and belong to a Genesis/emerchantpay adapter, not this one.                                                                                               |
| 10  | No live credentials needed for documented examples | **yes**                         | All examples are in the public reference.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Outcome: items 1-5, 8, 9 and 10 are yes, so the outcome is **documentation_verified**. Item 6 (no) and item 7 (unclear) do not block the gate but must be shown as open questions.

### Classification

- `wallet`: "We're an e-money digital wallet provider, offering secure, customer-focused payment services." (About Us). The API moves funds wallet to wallet: transfer "consumer to merchant wallet", refund and payouts "merchant wallet to consumer wallet".
- `alternative_payment_method`: offered as an APM inside emerchantpay Genesis ("Wallet-based payment" in the Genesis PHP SDK; "eZeeWallet is a comprehensive digital wallet" in the Genesis API docs).
- Not `card_processing`, `acquiring` or `gateway`: no card authorization appears in the eZeeWallet API. Consumers fund wallets through other methods (Genesis docs: "P24, Trustly, Invoice (Sofort), iDeal, eps, NeoSurf and bank transfer"); those funding steps are outside this API.

### Sectors

None documented as accepted merchant sectors. The gambling/non-gambling balance split (consumer UI text, quoted above) shows that the provider distinguishes gambling use, but it is not a statement of merchant eligibility. Any eligibility depends on jurisdiction, licensing and underwriting, and is NOT DOCUMENTED publicly.

---

## 3. API families and versions in scope

| Family                                | Endpoint (production)                                            | Format                                                   | Relevance                              |
| ------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| Transfers (consumer to merchant)      | `POST /transfers` (legacy), `POST /transfers_new`                | JSON request/response                                    | **Primary**                            |
| Notifications to merchant             | POST to `notification_url`                                       | JSON body shown in examples; Content-Type NOT DOCUMENTED | **Primary**                            |
| Transaction lookup                    | `GET /transaction?ezw_reference_id=`                             | JSON                                                     | Primary (status check)                 |
| Transfer list                         | `GET /transfers?ezw_reference_id=` or `?start_date=&end_date=`   | JSON, paginated                                          | Secondary                              |
| Refunds                               | `POST /refunds`                                                  | JSON                                                     | Secondary                              |
| Single payouts                        | `POST /single_payouts` (legacy), `POST /single_payouts_new`      | JSON                                                     | Secondary                              |
| Batch payouts                         | `POST /batch_payouts` (legacy), `POST /batch_payouts_new`        | JSON                                                     | Secondary                              |
| Accounts, Balances                    | `GET /account?email=`, `GET /balance`                            | JSON                                                     | Low (account data, merchant balance)   |
| Genesis `ezeewallet` transaction type | `https://staging.gate.emerchantpay.net/process/<TERMINAL-TOKEN>` | XML                                                      | **Out of scope** here (Genesis format) |

Implement first: transfer responses (both legacy and `_new` shapes), the error envelope with the 27 codes, and the two notification shapes. Then refunds and payouts.

---

## 4. Response and error formats

- Requests must send `Content-Type: application/json`; responses are JSON with `Content-Type: application/json`.
- Auth: HTTP Basic with API username/password.
- Amounts: integer, minor currency units ("two implied decimal places", required for all transaction types since v1.9.5). Exception: `available_balance` in `GET /balance` is a decimal string ("Amount in major currency units").
- Dates: RFC3339 strings. No response or notification example contains a timestamp field.
- Errors: HTTP 400 for all documented business errors, HTTP 500 for code `500`. Body `{"error":{"code":<code>,"message":"<text>"}}`. The Error data type says `code` is a string, but every example shows an integer.

Main response fields:

| Shape                                    | Fields                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transfer (legacy, wrapped in `transfer`) | `transaction_id`, `usage`, `amount`, `currency`, `source_wallet_id`, `return_success_url`, `return_failure_url`, `status`, `redirect_url` (pending only)                                                                                                               |
| TransferNew (wrapped in `transfer`)      | `merchant_transaction_id`, `first_name`, `last_name`, `ezw_reference_id`, `amount`, `currency`, `source_wallet_id`, `return_success_url`, `return_failure_url`, `status`, `redirect_url` (pending only). List items use `consumer_email` instead of `source_wallet_id` |
| Refund (wrapped in `refund`)             | `merchant_transaction_id`, `ezw_reference_id` (of the original transfer), `amount`, `currency`, `notification_url`, `status`                                                                                                                                           |
| Transaction lookup                       | `ezw_reference_id`, `status`, `type` (`transfer` or `payout`)                                                                                                                                                                                                          |
| SinglePayout (legacy)                    | `unique_id`, `status`, `merchant_reference`                                                                                                                                                                                                                            |
| SinglePayoutNew                          | `ezw_reference_id`, `status`, `merchant_reference`                                                                                                                                                                                                                     |
| BatchPayout (legacy)                     | `unique_id`, `status`                                                                                                                                                                                                                                                  |
| BatchPayoutNew                           | `unique_ids` (array of `email`, `amount`, `currency`, `merchant_reference`; the data type table calls it `unique_id`), `status`                                                                                                                                        |
| Account                                  | `account_number`, `verification_status`, `account_status`                                                                                                                                                                                                              |
| List pagination                          | `total_count`, `pages_count`, `page`, `per_page` (nested under `pagination` in the overview, top-level in the ListTransfers example)                                                                                                                                   |

Example A, pending async transfer, transcribed from https://emerchantpay.github.io/ewallet-api-docs/ (CreateTransfer New Endpoint):

```json
{
  "transfer": {
    "merchant_transaction_id": "MerchantTx123",
    "first_name": "consumer's first name",
    "last_name": "consumer's last name",
    "amount": 10000,
    "currency": "USD",
    "source_wallet_id": "consumer@example.com",
    "return_success_url": "http://example.com/success",
    "return_failure_url": "http://example.com/failure",
    "status": "pending",
    "redirect_url": "https://ezeewallet.com/en/consumers/top_up/random_unique_id"
  }
}
```

Example B, error, same source (note the trailing comma: the docs example is not strictly valid JSON, so a parser should tolerate it and warn):

```
{
  "error": {
    "code": 407,
    "message": "Currency mismatch",
  }
}
```

---

## 5. Codes

Field: `error.code`. Exact codes from the "Errors" table; meanings are short paraphrases. Category and retry columns are **suggestions** for PandaPayLens, not eZeeWallet statements. The codes look like HTTP status numbers (401, 404, 408, 500) but are application codes; the HTTP status is 400 for all of them except 500. Code `411` does not exist in the table.

| Code  | Meaning (paraphrase)                                                                  | Category (suggested)       | Retry class (suggested)  |
| ----- | ------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `401` | Parameters missing or invalid; also used for "password parameter has been deprecated" | invalid_request            | do_not_retry             |
| `402` | Source wallet credentials invalid                                                     | authentication_failed      | customer_action_required |
| `403` | Transaction not allowed for the source (consumer) wallet                              | payment_method_unavailable | manual_review            |
| `404` | Merchant wallet disabled                                                              | configuration              | manual_review            |
| `405` | Target wallet account not found                                                       | invalid_request            | customer_action_required |
| `406` | Transaction not allowed for the target wallet                                         | payment_method_unavailable | manual_review            |
| `407` | Currency mismatch                                                                     | invalid_request            | do_not_retry             |
| `408` | Transaction ID already processed                                                      | duplicate_request          | do_not_retry             |
| `409` | Needed top-up exceeds the maximum deposit amount                                      | invalid_amount             | customer_action_required |
| `410` | Wallets belong to different industry types                                            | configuration              | do_not_retry             |
| `412` | Payouts suspended for this account                                                    | configuration              | manual_review            |
| `413` | A batch payout amount has an invalid format                                           | invalid_amount             | do_not_retry             |
| `414` | Source wallet balance too low for the payout (merchant side)                          | insufficient_funds         | retry_conditionally      |
| `415` | Payout threshold limit exceeded                                                       | invalid_amount             | manual_review            |
| `416` | Record not found                                                                      | invalid_request            | do_not_retry             |
| `417` | Cannot approve a timed-out credit payout request                                      | invalid_request            | do_not_retry             |
| `418` | Cannot approve a failed credit payout request                                         | invalid_request            | do_not_retry             |
| `419` | Cannot approve a declined credit payout request                                       | invalid_request            | do_not_retry             |
| `420` | Credit payout request already approved                                                | duplicate_request          | do_not_retry             |
| `421` | Credit payout request already declined                                                | invalid_request            | do_not_retry             |
| `422` | Merchant may not process for this consumer's country                                  | payment_method_unavailable | do_not_retry             |
| `423` | Source wallet account not found                                                       | invalid_request            | customer_action_required |
| `424` | A batch payout currency does not match the source wallets                             | invalid_request            | do_not_retry             |
| `425` | Payout currency does not match the source wallets                                     | invalid_request            | do_not_retry             |
| `426` | Target wallet currency differs from payout currency                                   | invalid_request            | do_not_retry             |
| `427` | Payout amount has an invalid format                                                   | invalid_amount             | do_not_retry             |
| `500` | Transfer failed because of an internal error (HTTP 500)                               | provider_unavailable       | retry_conditionally      |

Total: **27** codes. "retry_conditionally" for `500`: check `GET /transaction` first, because resending the same `transaction_id` returns `408`.

Notification `decline_reason`: free string "returned when the transfer status is declined". Values are **NOT DOCUMENTED**.

---

## 6. Lifecycle (wallet semantics, not card authorization)

There is no authorize/capture split. A transfer moves e-money from the consumer wallet to the merchant wallet in one step; "pending" means the consumer has not finished (for example must top up), not that funds are reserved.

| Object                                         | Documented status values                                                                                               | Notes and inconsistencies                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transfer, synchronous                          | `approved`, `pending` (examples); data type says `approved` or `pending_async`; narrative adds "Declined"              | Pending async: "consumer does not have balance for the transaction and needs to top up"; response carries `redirect_url` to a top-up page; final result arrives by Notification |
| Transfer, notification                         | Data type: `approved`, `declined`. Narrative: Approved, Declined, Timeout ("user took too long to approve or decline") | Exact string for timeout is NOT DOCUMENTED                                                                                                                                      |
| TransferNew / list / lookup                    | `approved`, `pending`, `declined`                                                                                      | Lookup `type`: `transfer` or `payout`                                                                                                                                           |
| Refund                                         | `approved`, `declined`                                                                                                 | No refund notification example; `notification_url` optional                                                                                                                     |
| SinglePayout (legacy)                          | `succeeded`, `failed`                                                                                                  |                                                                                                                                                                                 |
| SinglePayoutNew                                | Data type: `approved`, `pending`; narrative adds Declined                                                              | Pending: consumer has no account for that email and must onboard. Notification sent for all statuses                                                                            |
| BatchPayout / BatchPayoutNew                   | `pending`, `failed`                                                                                                    | Per-item results NOT DOCUMENTED                                                                                                                                                 |
| Credit payout request (from codes 417-421)     | timed out, failed, declined, approved                                                                                  | Exact status strings NOT DOCUMENTED                                                                                                                                             |
| Account                                        | `verification_status` `verified`, `account_status` `active` (examples only)                                            | Other values NOT DOCUMENTED                                                                                                                                                     |
| Subscription, rebill, cancellation, chargeback | NOT DOCUMENTED                                                                                                         | No such objects in the API                                                                                                                                                      |

---

## 7. Notifications

- Delivery: POST to the request's `notification_url`. Body shown as JSON in examples; HTTP Content-Type NOT DOCUMENTED.
- Source IPs: production `52.211.164.97`, `54.73.191.168`; staging `18.203.177.168`, `63.32.240.8`.
- Fields (Notification data type): `transaction_id` (merchant's id), `unique_id` (eZeeWallet id), `status`, `signature`, `decline_reason` (only when declined). Payout example instead carries `ezw_reference_id`, `merchant_reference`, `unique_id`, `status`, `signature`.
- Acknowledgement: merchant must answer with NotificationEcho `{"unique_id": "<value>"}` (required for pending-async transfers).
- Signature (**sensitive**): `signature` = SHA1 hex of `<transaction_id><merchant api_username>`. The documented example (`123456789abcdefg` + `0987654321xyz` -> `9ec1df9a7013f6a5b952b9d3f12d620475d37c86`) is internally consistent. The signature does not cover `status`, amount or decline reason, and it depends on the API username. PandaPayLens should not verify it; it can only flag a 40-hex `signature`. For payout notifications, which id goes into the hash is NOT DOCUMENTED (the example reuses the same hash value).
- Retries, ordering, duplicate delivery, event ids: NOT DOCUMENTED. Duplicate identification can only use `unique_id`/`transaction_id` + `status`.

Transcribed from https://emerchantpay.github.io/ewallet-api-docs/ (Notification):

```json
{
  "ezw_reference_id": "SampleTx123",
  "merchant_reference": "abc123",
  "unique_id": "123456789abcdefg",
  "status": "approved",
  "signature": "9ec1df9a7013f6a5b952b9d3f12d620475d37c86"
}
```

---

## 8. Identifiers

| Identifier                | Owner                                                                  | Where                                                                                               |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `transaction_id`          | merchant                                                               | Legacy transfer request/response, transfer notification                                             |
| `merchant_transaction_id` | merchant                                                               | `_new` transfer, list, refund                                                                       |
| `merchant_reference`      | merchant                                                               | Payouts, payout notification                                                                        |
| `ezw_reference_id`        | eZeeWallet ("Unique transaction id in eZeeWallet transaction history") | `_new` transfer, list, lookup, refund, payout notification                                          |
| `unique_id`               | eZeeWallet ("Unique id defined by eZeeWallet for later use")           | Legacy payouts, notifications, NotificationEcho (where it is wrongly described as merchant-defined) |
| Parent link               | Refund `ezw_reference_id` = the original transfer's id                 | Only explicit parent reference in the API                                                           |

Whether `unique_id` and `ezw_reference_id` hold the same value for the same transaction is NOT DOCUMENTED.

## 9. Sensitive fields

`signature`; HTTP Basic credentials (API username/password, `Authorization` header); `source_wallet_id`, `consumer_email`, `email` (consumer email is the wallet id); `first_name`, `last_name`; `account_number`; `redirect_url` (contains a unique top-up token); `notification_url`, `return_success_url`, `return_failure_url`, `merchant_website`; `available_balance`; Genesis route: `source_wallet_pwd`.

## 10. Structural detection hints

- JSON key `ezw_reference_id` is unique to eZeeWallet among the supported providers and the other candidates; very strong.
- `transfer` wrapper with `source_wallet_id` (an email) plus `merchant_transaction_id` or `transaction_id`; `redirect_url` on `ezeewallet.com/.../consumers/top_up/`.
- Error envelope `{"error":{"code":<int 401-427 or 500>,"message":...}}`. On its own this is weak (generic shape); combine with message text such as "Currency mismatch", "Transaction ID already processed", "source wallet".
- Notification: small flat JSON `transaction_id` or `unique_id` + `status` + 40-hex `signature`, optional `decline_reason`. Weak alone.
- Hosts: `ezeewallet.com/api`, `stg.ezeewallet.com/api`.
- Differs from Stripe (`object`, `id` prefixes, string error `type`), Adyen (`pspReference`, `resultCode`), PayPal (`event_type`, `links`), Square (`errors` array), Checkout.com, Braintree, Mollie, payabl. (URL-encoded `transid`/`errmsg`).
- Genesis-route payloads are XML `<payment_response>` with `<transaction_type>ezeewallet</transaction_type>`; route them to a Genesis/emerchantpay adapter if one exists, otherwise label them "eZeeWallet via emerchantpay Genesis" without decoding with this adapter.

## 11. Limitations and inconsistencies

1. Status vocabularies differ per endpoint and between data types, examples and narrative (`pending` vs `pending_async`; `succeeded`/`failed` vs `approved`/`declined`; Timeout described but not given as a string).
2. `decline_reason` values, notification Content-Type, retry schedule, ordering and duplicate behavior are NOT DOCUMENTED.
3. No timestamps in any response or notification example.
4. Error `code` typed as string but shown as integer; docs JSON contains trailing commas; code `401` carries two messages.
5. NotificationEcho describes `unique_id` as merchant-defined, while Notification describes it as eZeeWallet-defined.
6. BatchPayoutNew response key is `unique_ids` in the example and `unique_id` in the data type.
7. Version numbering in the changelog jumps (1.4.0 to 1.9.0.3); the "new error details" entry (2.0.1) does not say which codes changed.
8. Regulated entity conflict (Prime Pay Solutions Limited, Isle of Man FSA vs emerchantpay ltd., FCA EMI 900778). Non-Supported Countries list not found in public pages.
9. Two integration routes (direct API vs Genesis APM) produce different formats for the same product.
10. No chargeback, subscription or rebill objects.

## 12. Proposed capability statuses

| Capability       | Proposed         | Justification                                                                                                                                                                     |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **limited**      | 27 clear, exact codes for synchronous errors. Async declines arrive as free-text `decline_reason` with no documented values, and codes collide visually with HTTP status numbers. |
| paymentResponses | **supported**    | Small, stable JSON shapes with examples for approved, pending-async and error responses across transfers, refunds, payouts and lookup.                                            |
| webhookParsing   | **limited**      | Two documented notification shapes and a reproducible signature formula, but minimal fields, inconsistent status set, and no documented content type, retries or event ids.       |
| timeline         | **experimental** | Ordering possible only from status progression (pending -> approved/declined/timeout); no timestamps in payloads.                                                                 |
| correlation      | **limited**      | Merchant ids plus `ezw_reference_id`/`unique_id`; refunds reference the original transfer explicitly. Relation between `unique_id` and `ezw_reference_id` is NOT DOCUMENTED.      |
