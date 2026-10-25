# MiFinity (adapter id `mifinity`): high-risk candidate research

Status: qualification gate plus condensed technical specification for a parse-only PandaPayLens adapter. Everything comes from first-party sources read on the verification date. Where the sources are silent the text says **NOT DOCUMENTED**. Nothing was logged into, signed up for or requested.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: developer pages were downloaded as raw Markdown (`https://mifinity.readme.io/<path>.md`, the format the docs site serves through its own `llms.txt` index); pages linked from the docs sidebar but missing from `llms.txt` were fetched the same way. Marketing pages on mifinity.com were read with a page fetcher (plain downloads got HTTP 403 from the site's bot protection, which was not bypassed). `updatedAt` dates are the pages' own front-matter values.

---

## 0. Summary

| Item                 | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome              | `documentation_verified`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Classification       | `wallet`, `alternative_payment_method` (plus payout products: bank, card OCT and crypto payouts, which have no matching class)                                                                                                                                                                                                                                                                                                                                                                                        |
| Documented sectors   | **None stated** by the provider on any page read. The payout callback examples carry `paymentCategoryType: "GAMING_PAYOUT"`, which is a payload value, not a sector statement                                                                                                                                                                                                                                                                                                                                         |
| Documentation access | **Public**. The full developer hub (guides plus OpenAPI reference) is readable without login. Gated: API keys, secret keys and signature opt-in (merchant back office), callback URL registration (by email to the integration team). A "PAYC Gateway Error Reference" and "PAYC Gateway Runbook" are named in the PAYC MCP guide but are not published on the hub                                                                                                                                                    |
| Documented codes     | 25 distinct `errorCode` values: Error Codes page 21 distinct (FATAL 13 distinct in 21 rows, VALIDATION_FIELD 5, VALIDATION_GLOBAL 4, `OPERATION_NOT_POSSIBLE` in two types); PAB Error Codes page 12 entries (FATAL 7, VALIDATION_FIELD 1, VALIDATION_GLOBAL 4), 3 of them new; 1 value only in an OpenAPI example (`00001`). Also 3 error `type` values, 8 numeric `transactionStatus` values (+ label "Reversed"), 4 deposit `status` values, 3 `detailedStatus` values, and a generic list of 56 HTTP status codes |
| Biggest limitation   | Small, generic code set with placeholder messages (`{0}`), one catch-all `TRANSACTION_FAILED` that passes through processor text, no issuer/decline codes, and no documented signature, event ID, retry or duplicate rules for callbacks. Status code `5` is documented with opposite meanings on two pages                                                                                                                                                                                                           |
| White-label note     | MiFinity exposes its own JSON formats. No first-party source says the API is a white label of another gateway. PayAnyCoin (crypto payouts) is "enabled by BVNK, the stablecoin payments infrastructure provider" (press release 2026-07-30), but the merchant-facing PAYC API and callbacks use MiFinity's own format                                                                                                                                                                                                 |

---

## 1. Sources

All URLs read on 2026-10-25. Docs pages are under `https://mifinity.readme.io/`; the `.md` variant of each page was read.

| URL                                                                                                                                                                                                                                            | What it covers                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| https://www.mifinity.com/ (served as https://mifinity.com/)                                                                                                                                                                                    | Home: products, business menu, FCA/MFSA statements, security notice dated 2026-10-23, footer link "Developers" to the docs hub |
| https://mifinity.com/business/                                                                                                                                                                                                                 | Business landing page: eWallet, iFrame, PayAnyBank/Card/Coin labels; "Trusted by over 1500 live brands"; no sectors named      |
| https://mifinity.com/en/business/igaming                                                                                                                                                                                                       | Same content as the business page (no sector statement)                                                                        |
| https://mifinity.com/business/iframe/                                                                                                                                                                                                          | iFrame product page: "75+ local payment methods"; no sectors named                                                             |
| https://mifinity.com/business/payanybank/ , https://mifinity.com/business/payanycard/                                                                                                                                                          | Payout product pages; no sectors, no underlying processor named                                                                |
| https://mifinity.com/about/                                                                                                                                                                                                                    | Entities, FCA (Register Ref. 900090) and MFSA (C64824) authorisation                                                           |
| https://mifinity.com/legal/non-serviced-countries/                                                                                                                                                                                             | List of 23 non-serviced countries                                                                                              |
| https://mifinity.com/news/                                                                                                                                                                                                                     | News list (items up to 2026-09-18)                                                                                             |
| https://mifinity.com/mifinity-product-updates/mifinity-to-launch-payanycoin-delivering-global-stablecoin-payouts-enabled-by-bvnk-infrastructure/                                                                                               | PAYC "enabled by BVNK" (2026-07-30)                                                                                            |
| https://mifinity.com/mifinity-product-updates/mifinity-completes-remediation-programme-following-fiau-compliance-review/                                                                                                                       | FIAU AML/CFT findings and EUR 160,000 penalty for MiFinity Malta Limited                                                       |
| https://mifinity.com/mifinity-product-updates/mifinity-to-showcase-payanycoin-and-next-generation-global-payment-solutions-at-sbc-summit-lisbon/                                                                                               | 2026-09-17 news; no sectors named                                                                                              |
| https://mifinity.com/mifinity-product-updates/mifinity-launches-new-api-documentation-platform-for-an-enhanced-integration-experience/                                                                                                         | 2023-11-09 launch of mifinity.readme.io with demo sandbox                                                                      |
| Tried, HTTP 404: `https://mifinity.com/?p=41850`, `/?p=42669`, `/en/tag/igaming-ewallet`, `/MiFinity-hits-1,000-brand-milestone-...`, `/meet-mifinity-at-igb-amsterdam-2024-...`                                                               | Stale search-index URLs; nothing read                                                                                          |
| https://apidocs.mifinity.com/                                                                                                                                                                                                                  | Redirects to mifinity.readme.io (legacy docs host)                                                                             |
| https://github.com/MiFinity (GitHub API)                                                                                                                                                                                                       | Account with 0 public repos and no profile data; not usable as a source                                                        |
| llms.txt                                                                                                                                                                                                                                       | Docs index (does not list several sidebar pages)                                                                               |
| docs/error-codes (2025-03-13, not in llms.txt)                                                                                                                                                                                                 | Error envelope; FATAL (PAC/PMC), VALIDATION_FIELD, VALIDATION_GLOBAL code tables                                               |
| docs/pab-error-codes (2026-06-25, not in llms.txt)                                                                                                                                                                                             | PAB error codes by type                                                                                                        |
| docs/http-response-status-codes (2026-02-26)                                                                                                                                                                                                   | Generic HTTP status list                                                                                                       |
| docs/transaction-status (2026-07-01)                                                                                                                                                                                                           | Status lookup by `traceId`/`transactionReference`; status IDs 1-3, 5-8; 404 handling, retry 5xx                                |
| docs/transaction-status-1 (2025-04-17)                                                                                                                                                                                                         | Older status table incl. `4` "Processed by PSP"; ARN and reversal text                                                         |
| docs/transaction-lifecycle (2026-06-25), docs/transaction-lifecycle-payanycoin (2026-07-16)                                                                                                                                                    | In Progress, Submitted, Processed By Acquirer, Reversed                                                                        |
| docs/payment-status-callback (2026-03-10)                                                                                                                                                                                                      | Deposit callback JSON: success, ABANDONED_BY_USER, REFUSED_BY_RISK, FAILED                                                     |
| docs/payment-status-api-1 (2026-03-11), reference/payment-status                                                                                                                                                                               | Deposit status API: SUCCESSFUL/PENDING/NOT_COMPLETED/FAILED; error example                                                     |
| docs/iframe-initialization-1 (2026-08-19), docs/hosted-iframe (2026-10-20), reference/deposit-api (2026-08-11)                                                                                                                                 | init-iframe request/response, `validationKey`, `returnUrl`/`errorUrl`, hosted `iframeEntrypoint`; 400 example `00001`          |
| docs/iframe-javascriptwidget-1, docs/e-mail-validation, docs/split-gateway, docs/split-gateway-list, docs/iframe-deposit-flow                                                                                                                  | Widget callbacks (`complete`/`success`/`fail`), deposit UX (card loads eWallet), payment method names                          |
| docs/notification-management (2025-04-17)                                                                                                                                                                                                      | Which transaction types get callbacks; URL configuration                                                                       |
| docs/notification-callbacks (2026-03-11), docs/notification-callbacks-1 (2025-03-13), docs/notification-callbacks-for-withdrawals (2026-06-25), docs/notification-callbacks-payc (2026-07-16)                                                  | Payout callback JSON (PAB, PAC, A2A, PAYC), triggers, HTTP 200 ack                                                             |
| docs/pab-api, docs/pab-flow, docs/payanybank-pab, docs/bank-detail-fields, docs/business-to-client-b2c, docs/business-to-business-b2b, docs/payanybank-limits, reference/pay-any-bank                                                          | PayAnyBank payouts; duplicate-request retry rule                                                                               |
| docs/payanycardpac-paymycardpmc, docs/the-api, docs/difference-between-pac-pmc, docs/get-transaction-status, reference/pay-any-card, reference/pay-my-card, docs/test-cards, docs/unionpay-international-china-unionpay                        | Card payouts (OCT) via "the MiFinity acquirer"; 403/404 error examples                                                         |
| docs/withdrawals-to-client-account, reference/account-to-account-transfer                                                                                                                                                                      | Wallet-to-wallet payout, synchronous `status: "OK"`                                                                            |
| docs/pay-any-coin-payc, docs/payanycoin-flow, docs/payanycoin-api, docs/payanycoin-api-b2b, docs/transaction-status-payc, docs/crypto-currency-protocol-pairs-catalog, docs/mcp, reference/payanycoin-api, reference/payc-protocol-countrycode | Crypto payouts; `statusCode`/`statusMessage`                                                                                   |
| docs/merchant-signature-verification (2026-03-18)                                                                                                                                                                                              | HMAC-SHA256 signing of merchant requests (`X-MiFinity-Signature`)                                                              |
| docs/security-requirements, docs/environment, docs/authentication-management, docs/create-api-key, docs/disable-api-key, docs/retrieving-the-accountholderid                                                                                   | IP allowlists, hosts, API key handling                                                                                         |
| docs/transaction-limits-for-deposits, docs/transaction-limits-for-withdrawals, docs/e-wallet-supported-currencies, docs/merchant-integration-guide-ai-pab-gateway                                                                              | Limits, currencies, PAB MCP troubleshooting                                                                                    |
| reference/get-transaction-status1, reference/get-transaction-status-traceid, reference/get-transactions-status-history, reference/get-account-listing, reference/get-bank-name, reference/currency-lookup                                      | OpenAPI blocks (mostly placeholder `"string"` examples)                                                                        |

---

## 2. Qualification gate

| #   | Item                                           | Answer                          | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active               | **yes**                         | mifinity.com live; news items dated 2026-07 to 2026-09; home page carries a security notice dated 2026-10-23 ("detected unauthorised activity affecting part of our technology environment", investigation ongoing).                                                                                                                                                |
| 2   | Payment service operational                    | **yes** (not tested by calling) | Docs list Demo `https://demo.mifinity.com` and Production `https://secure.mifinity.com` (docs/environment); hosted iFrame page updated 2026-10-20; B2C country page 2026-10-21.                                                                                                                                                                                     |
| 3   | Developer docs publicly accessible             | **yes**                         | Entire hub public, no login. Gated parts: API keys and secret keys (back office `business.mifinity.com`), callback URLs set up via integration@mifinity.com, signature opt-in "Contact MiFinity support for current availability". "PAYC Gateway Error Reference"/"Runbook" named in docs/mcp but not published.                                                    |
| 4   | API families/versions identified               | **yes**                         | REST JSON under `/api/...`; header `x-api-version: 1`; OpenAPI `"version": "1.0"`. Families: eWallet deposit gateway (`/api/gateway/init-iframe`, `/api/gateway/payment-status/{validationKey}`), payouts (`/api/payments/pab`, `/pac`, `/pmc`, `/acct2acct`, `/crypto-payout/execute`, `/crypto-payout/executeb2b`), transaction status (`/api/transactions/...`). |
| 5   | Responses/notifications examinable offline     | **yes**                         | JSON examples for init-iframe, deposit callbacks (4 variants), payment status (5 variants), payout responses, payout callbacks (Submitted, Processed by acquirer, Rejected), status lookups, error envelopes.                                                                                                                                                       |
| 6   | Merchant sectors documented by provider        | **no**                          | No page read names accepted sectors (business, iFrame, PayAnyBank, PayAnyCard, about, news, SBC news all checked). Only payload value `paymentCategoryType: "GAMING_PAYOUT"` in callback examples. Search-index pages that might have named sectors return 404.                                                                                                     |
| 7   | Regional/regulatory limitations identified     | **yes**                         | FCA EMI (Register Ref. 900090) and MFSA financial institution (C64824); 23 non-serviced countries incl. United States, Russia, Ukraine (legal/non-serviced-countries); PAC/PMC "covers all cards in all countries except" that list; FIAU penalty news.                                                                                                             |
| 8   | Adapter gives diagnostic value                 | **yes** (moderate)              | 25 `errorCode` values with messages and 3 error types; numeric `transactionStatus` lifecycle; deposit `status`/`detailedStatus`; documented duplicate-`traceId` retry rule.                                                                                                                                                                                         |
| 9   | Own technical format                           | **yes**                         | MiFinity-specific JSON envelope `{"payload":[...]}` / `{"errors":[{type,errorCode,message,formObjectName,field}]}`, money objects with `presentationAmount`/`displayable`, `traceId` + `transactionReference`. No first-party statement of white-labelling. BVNK is named only as PAYC infrastructure.                                                              |
| 10  | No live credentials needed to analyze examples | **yes**                         | All examples are on public pages.                                                                                                                                                                                                                                                                                                                                   |

Outcome rule: items 1-5, 8, 9, 10 are yes, so **documentation_verified**. Item 6 is no and does not block the outcome.

---

## 3. Classification and documented sectors

| Class                                           | Evidence                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wallet`                                        | "The MiFinity eWallet empowers you to pay online, receive funds and send money globally" (mifinity.com/business/). MiFinity UK Limited is "authorized by the Financial Conduct Authority under the Electronic Money Regulations 2011" (mifinity.com/about/).                                                                |
| `alternative_payment_method`                    | Merchants embed the eWallet cashier: "Expand your payment options with our 75+ local payment methods" (business/iframe). Card deposits load the customer's eWallet, then "a separate transaction is then performed from the client's eWallet account into the merchant's account within MiFinity" (docs/e-mail-validation). |
| Not `card_processing`/`acquiring` for merchants | Card acceptance happens inside the wallet top-up. PAC/PMC are card **payouts** (OCT) sent "via the MiFinity acquirer" (docs/transaction-status-1). UnionPay: "as a principal member we offer a money remittance service" (docs/unionpay-international-china-unionpay).                                                      |
| Payouts (no matching class)                     | PayAnyBank (bank), PayAnyCard/PayMyCard (card OCT), PayAnyCoin (crypto), Account to Account (wallet).                                                                                                                                                                                                                       |

Sectors: **none documented by the provider**. `GAMING_PAYOUT` appears as a `paymentCategoryType` value in callback examples; that is a field value and must not be read as a statement of accepted sectors. Eligibility depends on jurisdiction, licensing and underwriting, and approval for one sector does not imply another.

Regional and regulatory limits:

- UK: MiFinity UK Limited, FCA EMI, Register Ref. 900090, NI611169 (mifinity.com/about/).
- Malta: Mifinity Malta Limited, MFSA financial institution, C64824 (mifinity.com/about/). FIAU AML/CFT examination (mid-2023) led to a settled penalty of EUR 160,000 (news, 2026-09-03).
- Non-serviced countries (23): Afghanistan, Belarus, Congo (DRC), Cote d'Ivoire, Cuba, Iran, Iraq, Liberia, Libya, Myanmar, Nicaragua, North Korea, Russia, South Sudan, Sudan, Syria, Ukraine, United States, US Minor Outlying Islands, Venezuela, US Virgin Islands, Yemen, Zimbabwe (legal/non-serviced-countries).
- Payout country lists: PAB B2C/B2B pages; UnionPay payouts only from EEA countries to mainland China cards.
- Per-currency deposit and withdrawal limits (docs/transaction-limits-*).

---

## 4. API families and versions

| Family                                                        | Endpoint (demo)                                                                                                                           | Relevance                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| eWallet deposit gateway ("SGPG")                              | `POST /api/gateway/init-iframe/`; `GET /api/gateway/payment-status/{validationKey}`; widget `sgpg.js`; hosted `.../iframe2#initToken=...` | **Primary**: deposit callbacks and payment status |
| Payout callbacks                                              | POST to merchant URL registered with MiFinity                                                                                             | **Primary**: shared by PAB, PAC, PMC, A2A, PAYC   |
| Transaction status                                            | `GET /api/transactions/status/{traceID}`, `GET /api/transactions/{transactionReference}/status`, history by account holder                | **Primary**: same status vocabulary as callbacks  |
| PayAnyBank                                                    | `POST /api/payments/pab`                                                                                                                  | Secondary: synchronous response + errors          |
| PayAnyCard / PayMyCard                                        | `POST /api/payments/pac`, `/pmc`                                                                                                          | Secondary                                         |
| Account to Account                                            | `POST /api/payments/acct2acct/`                                                                                                           | Secondary                                         |
| PayAnyCoin                                                    | `POST /api/payments/crypto-payout/execute`, `/executeb2b`                                                                                 | Secondary                                         |
| Lookups (currencies, bank fields, bank name, account listing) | various `GET`                                                                                                                             | Out of scope                                      |
| MCP gateways (PAB, PAYC)                                      | `mcp(-demo).payanycoin.mifinity.com/v1` etc.                                                                                              | Out of scope                                      |

Versioning: header `x-api-version: 1` (the signature page says `api-version`); OpenAPI blocks say `1.0`. No other versions documented.

Implement first: the shared error envelope, the deposit callback plus Payment Status response, and the payout callback plus Transaction Status response.

---

## 5. Formats

- Content type: `application/json` for requests and responses (header tables). Callbacks are "HTTP JSON notification callbacks"; deposit callbacks are a JSON `POST` to `returnUrl`/`errorUrl`.
- Success envelope: `{"payload": [ {...} ]}` (an array, usually one item). Error envelope: `{"errors": [ {"type", "errorCode", "message", "formObjectName"?, "field"?} ]}`.
- Error `type`: `FATAL`, `VALIDATION_FIELD`, `VALIDATION_GLOBAL`.
- Deposit status fields: `status`, `detailedStatus`, `errorMessage`, plus `paymentResponse` on success.
- Payout status fields: `transactionStatus` (integer), `transactionStatusDescription`, `errorMessage`, `arn`, `transactionLastUpdated`/`createdOn`.
- Synchronous payout responses: `transactionId` (encrypted), `transactionReference`, `traceId`, `datePosted`, `sourceMoney`, `destinationMoney`, `exchangeRate`, `totalFees`; A2A adds `sameOwner`, `status: "OK"`; PAYC uses `quoteReference`, `statusCode`, `statusMessage`.
- Money objects: `{amount, currency, presentationAmount}` (callbacks, PMC) or `{amount, currency, displayable}` (PAB, PAC, A2A) or `{currency, amount, actual}` (PAYC).
- HTTP: Status API treats only 200 (found) and 404 (not found) as valid; 5xx must be retried (docs/transaction-status). OpenAPI shows 400 for errors; 401 for A2A when TOTP is enabled; 403 example for `ACCESS_DENIED`.

Example A, payout callback (Submitted), transcribed from https://mifinity.readme.io/docs/notification-callbacks:

```json
{
  "postedOn": null,
  "money": {
    "amount": 10,
    "currency": "EUR",
    "presentationAmount": "EUR10.00"
  },
  "source": "5001000001212099",
  "destination": "EE bank",
  "description": "test EE success",
  "transactionStatus": 3,
  "transactionStatusDescription": "Submitted",
  "traceId": "ce1035ae-ffc8-4ab4-8493-4ef7ef5b546e",
  "transactionReference": "3f57cb79-0707-4249-924a-15780a3f930e",
  "eventTypeDescription": "Pay Any Bank",
  "createdOn": "2023-10-10T14:33:37.412Z",
  "arn": null,
  "paymentCategoryType": "GAMING_PAYOUT",
  "externalReference": "P2100CVTHJ",
  "sourceEmail": null,
  "merchantCompanyName": "MiFinity",
  "additionalInfo": null,
  "errorMessage": null
}
```

Example B, error envelope, transcribed from https://mifinity.readme.io/docs/payment-status-api-1 ("Error (Invalid Key)"):

```json
{
  "errors": [
    {
      "type": "FATAL",
      "errorCode": "TRANSACTION_FAILED",
      "message": "Transaction Declined: Incorrect validation key. No records were found",
      "field": "Incorrect validation key. No records were found"
    }
  ]
}
```

---

## 6. Codes

Codes are exact; meanings are short paraphrases (see the linked pages for the original text). **Categories and retry classes are suggestions for PandaPayLens, not MiFinity statements**, except where a MiFinity rule is cited.

### 6a. Status values

| Field                                                | Value                                            | Meaning                                                                           | Final?                              |
| ---------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------- |
| `transactionStatus` / `transactionStatusDescription` | `1` Received                                     | Submitted by client to MiFinity                                                   | no                                  |
|                                                      | `2` Internal Error                               | MiFinity failed to initiate                                                       | yes (failure)                       |
|                                                      | `3` Submitted                                    | Accepted and sent for processing; funds debited; merchant should treat as success | no (success-equivalent for payouts) |
|                                                      | `4` Processed by PSP                             | Processed successfully; **only** on docs/transaction-status-1                     | unclear                             |
|                                                      | `5` Processed by acquirer                        | Acquirer confirmed; final success (but see section 12, item 1)                    | yes                                 |
|                                                      | `6` Rejected                                     | Rejected by MiFinity                                                              | yes                                 |
|                                                      | `7` In Progress                                  | Under review (KYC/compliance)                                                     | no                                  |
|                                                      | `8` On Hold KYC                                  | Additional KYC checks                                                             | no                                  |
|                                                      | "Reversed" (label only, no ID)                   | Destination bank/wallet returned funds; credited back to merchant                 | yes                                 |
| Deposit `status`                                     | `SUCCESSFUL`                                     | Completed                                                                         | yes                                 |
|                                                      | `PENDING`                                        | Submitted to processor, undetermined                                              | no                                  |
|                                                      | `NOT_COMPLETED`                                  | Needs further user input                                                          | no                                  |
|                                                      | `FAILED`                                         | Failed                                                                            | yes                                 |
| `detailedStatus` (optional)                          | `ABANDONED_BY_USER`, `REFUSED_BY_RISK`, `FAILED` | Reason detail on unsuccessful deposits                                            | n/a                                 |
| A2A `status`                                         | `OK`                                             | Synchronous transfer succeeded                                                    | yes                                 |
| PAYC `statusCode`/`statusMessage`                    | `7` / `PENDING` (only example)                   | Payout pending; full list NOT DOCUMENTED                                          | no                                  |

### 6b. Error codes

Location: `errors[].errorCode`, with `errors[].type`. Messages often contain placeholders (`{0}`, `{}`).

| Code                             | Type(s) / source                                               | Meaning (paraphrase)                                                                                                       | Category                                         | Retry class                                                                          |
| -------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `BAD_ACCOUNT_NUMBER`             | FATAL (Error Codes, PAB)                                       | Account number invalid                                                                                                     | invalid_request                                  | do_not_retry                                                                         |
| `CARD_EXPIRED`                   | FATAL (PAC/PMC)                                                | Card expiry date invalid                                                                                                   | invalid_request                                  | customer_action_required                                                             |
| `EXPIRY_DATE_FUTURE`             | FATAL (PAC/PMC)                                                | Expiry too far in the future                                                                                               | invalid_request                                  | customer_action_required                                                             |
| `OPERATION_NOT_POSSIBLE`         | FATAL (PAC/PMC); VALIDATION_GLOBAL (both pages)                | FATAL: PAC amount currency must match source account, or generic "not possible due to {0}"; GLOBAL: velocities zero amount | invalid_request (FATAL), invalid_amount (GLOBAL) | do_not_retry                                                                         |
| `TRANSACTION_FAILED`             | FATAL (PAC/PMC; Payment Status)                                | Card details not found; processor error passed through; invalid data for queue processing; invalid `validationKey`         | unknown (refine by message)                      | manual_review                                                                        |
| `ELEMENT_NOT_FOUND`              | FATAL (PAC/PMC; status lookups)                                | Element/ID not found; card holder nationality or card name empty; transaction not found (404)                              | invalid_request                                  | do_not_retry (status lookup: retry_conditionally, reference may not exist yet)       |
| `UNSUPPORTED_CURRENCY`           | FATAL (PAC/PMC)                                                | Currency not supported                                                                                                     | invalid_request                                  | do_not_retry                                                                         |
| `ACCOUNT_DISABLED`               | FATAL (PAC/PMC)                                                | Account disabled                                                                                                           | configuration                                    | manual_review                                                                        |
| `INSUFFICIENT_FUNDS`             | FATAL (Error Codes, PAB)                                       | Not enough eWallet / merchant e-wallet balance                                                                             | insufficient_funds                               | retry_conditionally (after top-up)                                                   |
| `ACCESS_DENIED`                  | FATAL (Error Codes, PAB; 403 example)                          | Access denied / invalid authorization                                                                                      | authentication_failed                            | do_not_retry                                                                         |
| `BLACKLISTED`                    | FATAL (PAC/PMC, PAB)                                           | BIN blacklisted, scheme not permitted, card not processable, or "Blocked"                                                  | fraud_or_risk                                    | do_not_retry                                                                         |
| `INVALID_DATA_FORMAT`            | FATAL (PAC/PMC)                                                | Invalid card number                                                                                                        | invalid_request                                  | customer_action_required                                                             |
| `VALIDATION`                     | FATAL (PAC/PMC); VALIDATION_FIELD (PAB)                        | Generic validation error; see `field`                                                                                      | invalid_request                                  | do_not_retry                                                                         |
| `DUPLICATED_TRANSACTION_ID`      | FATAL (PAB)                                                    | `traceId` already submitted                                                                                                | duplicate_request                                | do_not_retry (docs: means the first request was received; check status by `traceId`) |
| `TRANSACTION_AMOUNT_LIMIT_ERROR` | FATAL (PAB)                                                    | Amount outside permitted limits                                                                                            | invalid_amount                                   | do_not_retry                                                                         |
| `OTHER`                          | FATAL (PAB)                                                    | Other                                                                                                                      | unknown                                          | manual_review                                                                        |
| `01001`                          | VALIDATION_FIELD                                               | Invalid card number                                                                                                        | invalid_request                                  | customer_action_required                                                             |
| `01002`                          | VALIDATION_FIELD                                               | Expiry date not valid                                                                                                      | invalid_request                                  | customer_action_required                                                             |
| `01003`                          | VALIDATION_FIELD                                               | Description length must be 1-25                                                                                            | invalid_request                                  | do_not_retry                                                                         |
| `01004`                          | VALIDATION_FIELD                                               | Invalid currency                                                                                                           | invalid_request                                  | do_not_retry                                                                         |
| `01005`                          | VALIDATION_FIELD                                               | Unsupported currency                                                                                                       | invalid_request                                  | do_not_retry                                                                         |
| `00001`                          | VALIDATION_FIELD (OpenAPI example only, reference/deposit-api) | Field size constraint ("size must be between 0 and 48", field `traceId`)                                                   | invalid_request                                  | do_not_retry                                                                         |
| `DAILY_VELOCITY_EXCEEDED`        | VALIDATION_GLOBAL                                              | Daily velocity exceeded                                                                                                    | fraud_or_risk                                    | retry_conditionally (after period)                                                   |
| `WEEKLY_VELOCITY_EXCEEDED`       | VALIDATION_GLOBAL                                              | Weekly velocity exceeded                                                                                                   | fraud_or_risk                                    | retry_conditionally                                                                  |
| `MONTHLY_VELOCITY_EXCEEDED`      | VALIDATION_GLOBAL                                              | Monthly velocity exceeded                                                                                                  | fraud_or_risk                                    | retry_conditionally                                                                  |

Deposit `detailedStatus` suggestions: `ABANDONED_BY_USER` unknown / customer_action_required; `REFUSED_BY_RISK` fraud_or_risk / do_not_retry; `FAILED` unknown / unknown. The generic deposit failure carries `errorMessage` like `"Type: TRANSACTION_FAILED. Args: [null]"`, so a parser can extract an embedded code from that text.

HTTP status (docs/http-response-status-codes): a generic list of 56 codes (1xx 3, 2xx 8, 3xx 8, 4xx 29, 5xx 8) with standard names only, no MiFinity-specific meaning. MiFinity-specific rules: retry 5xx on status lookups (safe_to_retry_technical_request); on timeout or 5xx for a payout POST, retry only with the **same `traceId`** (retry_conditionally, docs/pab-flow, docs/the-api); 401 on A2A means TOTP is enabled (authentication_required).

---

## 7. Lifecycle

- **eWallet deposit (gateway semantics)**: init-iframe (token valid 30 minutes) -> customer pays in iFrame/hosted page (card or local method loads the customer's wallet, then wallet-to-merchant transfer) -> callback to `returnUrl` (success) or `errorUrl` (failure) -> merchant calls Payment Status: `PENDING`/`NOT_COMPLETED` -> `SUCCESSFUL` or `FAILED`. Browser `success`/`fail`/`complete` callbacks and the hosted `redirectUrl` are not payment results.
- **Payouts (PAB, PAC/PMC, PAYC)**: Received (1) -> In Progress (7) / On Hold KYC (8) -> Submitted (3, funds debited) -> Processed by acquirer (5, next day at reconciliation, ARN for cards) or Rejected (6) / Internal Error (2); later possible Reversed (funds returned by bank/wallet). PAYC response starts as `PENDING`.
- **Card payout (card semantics)**: PAC/PMC via Visa Direct "under a minute", otherwise within 2 business days; ARN is the trace reference.
- **Wallet transfer (A2A)**: synchronous; `200` with `status: "OK"` means success; a callback is also sent "if configured" with `transactionStatus: 3`.
- **Refunds, chargebacks, cancellations, subscriptions**: **NOT DOCUMENTED**.

---

## 8. Notifications

| Aspect           | Deposit callback (SGPG)                                                                                                                                                                                                 | Payout callback (PAB/PAC/PMC/A2A/PAYC)                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destination      | `returnUrl` / `errorUrl` from init-iframe                                                                                                                                                                               | URLs registered with integration@mifinity.com                                                                                                                                                            |
| Format           | JSON POST                                                                                                                                                                                                               | "HTTP JSON notification callback"                                                                                                                                                                        |
| Event types      | Implicit: success body vs failure body (`detailedStatus`)                                                                                                                                                               | Status-driven: SUBMITTED, PROCESSED BY ACQUIRER, REJECTED; `eventTypeDescription` names the product                                                                                                      |
| Key fields       | `traceId`, `validationKey`, `transactionReference`, `money`, `sourceMoney`, `destinationMoney`, `totalFees`, `paymentType`, `paymentMethod`, `responseCode`, customer fields; failure: `errorMessage`, `detailedStatus` | `transactionStatus`, `transactionStatusDescription`, `traceId`, `transactionReference`, `money`, `source`, `destination`, `createdOn`, `arn`, `paymentCategoryType`, `externalReference`, `errorMessage` |
| Signature        | None documented. Authenticity check is matching `traceId` + `validationKey`, then calling Payment Status                                                                                                                | None documented                                                                                                                                                                                          |
| Acknowledgement  | NOT DOCUMENTED                                                                                                                                                                                                          | HTTP 200 with no body                                                                                                                                                                                    |
| Retry / ordering | NOT DOCUMENTED                                                                                                                                                                                                          | NOT DOCUMENTED (two callbacks per success, Submitted then Processed by acquirer)                                                                                                                         |
| Duplicate ID     | NOT DOCUMENTED (no event ID)                                                                                                                                                                                            | NOT DOCUMENTED; `traceId` + `transactionStatus` is a heuristic key                                                                                                                                       |

Both pages say to ignore undocumented fields, which "may change without notice". `responseCode` (Base64-like) has no documented meaning. `X-MiFinity-Signature` (docs/merchant-signature-verification) signs merchant **requests** to MiFinity, not callbacks.

---

## 9. Identifiers

| Identifier                                                                                                      | Origin                         | Notes                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `traceId`                                                                                                       | Merchant                       | Max 48 chars on init-iframe; idempotency key for payout retries; echoed everywhere       |
| `transactionReference`                                                                                          | MiFinity (UUID)                | May be empty if not yet created (status page)                                            |
| `transactionId`                                                                                                 | MiFinity                       | "Encrypted identifier" in synchronous payout responses                                   |
| `validationKey`                                                                                                 | Merchant secret (48-255 chars) | Deposit session key; path parameter of Payment Status                                    |
| `clientReference`                                                                                               | Merchant                       | Customer ID in merchant system                                                           |
| `quoteReference`                                                                                                | MiFinity                       | PAYC only                                                                                |
| `arn`                                                                                                           | Acquirer                       | Card payouts after Processed by acquirer                                                 |
| `externalReference`                                                                                             | NOT DOCUMENTED                 | Appears in callback examples                                                             |
| `initializationToken`, `iframeEntrypoint`                                                                       | MiFinity                       | Session token (30 min)                                                                   |
| Account numbers (`source`, `destination`, `sourceAccount`, `destinationAccountNumber`, `customerAccountNumber`) | MiFinity                       | 16 digits starting `5001...` in examples; masked `accountNumber` like `500100XXXXXX3949` |
| Parent/original transaction                                                                                     | NOT DOCUMENTED                 | Reversal linkage not documented                                                          |

---

## 10. Sensitive fields

- Credentials and secrets: `Key`/`key` header (API key), `X-MiFinity-Signature`, `X-MiFinity-Timestamp`, secret keys, `Authorization: Bearer` (MCP), `validationKey`, `initializationToken`, `iframeEntrypoint` (carries the token), `responseCode` (meaning undocumented, treat as secret), `transactionId` (encrypted value).
- Card data: `cardNumber`, `expiryDate`, `cardName`, masked PAN inside `destination` text (e.g. `492982XXXXXX8286`).
- Personal data: `client.*` (`dob`, names, `phone`, `dialingCode`, `nationality`, `emailAddress`), `address.*`, `customerDob`, `customerFirstName`, `customerLastName`, `senderEmailAddress`, `sourceEmail`, `cardHolder*`, `cryptoPayee.*` (names, `dob`, `legalName`, `registrationNumber`).
- Financial identifiers: account numbers (`source`, `destination`, `customerAccountNumber`, `accountNumber`, `sourceAccount`), `bankPayee.fields` (e.g. `ACCOUNT_NUMBER`, `PERSONAL_ID_NUMBER`, IBAN/BIC), `cryptoAddress`, `arn`.

---

## 11. Structural detection hints

Strong MiFinity signals (combine several):

1. Envelope `{"payload": [ ... ]}` (array) or `{"errors": [ {"type": "FATAL"|"VALIDATION_FIELD"|"VALIDATION_GLOBAL", "errorCode", "message"} ]}`.
2. `transactionStatus` integer 1-8 together with `transactionStatusDescription` ("Submitted", "Processed by acquirer", "Rejected") and `traceId` + `transactionReference` (UUID).
3. Money objects with `presentationAmount` or `displayable` strings like `"EUR150.00"` (currency code directly followed by amount).
4. `eventTypeDescription` ("Pay Any Bank", "Pay Any Card", "Account to Account Transfer", "Pay Any Coin"), `paymentCategoryType`, `postedOn`, `merchantCompanyName`.
5. Deposit payloads: `validationKey` (long, Base64url with `~`), `paymentType: "EWALLET"`, `detailedStatus` (`ABANDONED_BY_USER`, `REFUSED_BY_RISK`), `initializationToken`, `iframeEntrypoint` with `/iframe2#initToken=`.
6. Hosts `demo.mifinity.com`, `secure.mifinity.com`, paths `/api/gateway/...`, `/api/payments/pab|pac|pmc|acct2acct`.

Versus supported providers: Stripe uses one `error` object and `pi_`/`evt_` IDs; Adyen uses `pspReference`/`resultCode`/`notificationItems`; payabl. is URL-encoded `key=value`; Checkout.com uses `pay_`/`act_` IDs and `_links`; PayPal uses `event_type` and `debug_id`; Braintree uses `processor_response_code` or GraphQL `extensions`; Mollie uses `resource` and `tr_` IDs. **Square** is the closest shape: its errors are also an `errors` array with UPPER_SNAKE values, but items carry `category` + `code` + `detail`, not `type` + `errorCode` + `message`; and Square money is `amount_money: {amount, currency}` in minor units.

Versus other candidates (emerchantpay, Ecommpay, Paymentwall, NMI, AstroPay, Skrill): their research files did not exist at verification time, so no first-party comparison was made. Rely on the MiFinity-specific keys above (`errorCode` inside `errors[]`, `transactionStatusDescription`, `presentationAmount`/`displayable`, `validationKey`) rather than generic keys such as `status` or `traceId`.

---

## 12. Limitations, ambiguities, inconsistencies

1. **Status `5` conflict**: docs/notification-callbacks-for-withdrawals says `5` = Failed; every other page says `5` = Processed by acquirer (success). Treat the withdrawals page as an error but flag low confidence when `5` appears without `transactionStatusDescription`.
2. Status `4` "Processed by PSP" appears only on the older docs/transaction-status-1; "Reversed" has no numeric ID.
3. The PAC callback example on docs/notification-callbacks-1 is titled "Successful Response" but shows `6` Rejected with `errorMessage: "No account found"`.
4. Money object key differs by endpoint (`presentationAmount`, `displayable`, `actual`); field table says `totalFee`, examples say `totalFees`; `exchangeRate` typed Integer but decimal in examples and an object `{base, counter, rate}` in PAYC (table says `displayRate`).
5. `customerDob` is an array `[1993,10,31]` in the deposit callback but a string in Payment Status.
6. The "Refused by Risk" deposit callback carries `errorMessage: "Deposit attempt abandoned"`, same text as the abandoned case; Payment Status `FAILED` example also shows `ABANDONED_BY_USER`.
7. Error Codes page is from 2025-03-13, not in `llms.txt`, labels its FATAL table as PAC/PMC only, and uses `Field` (capital) while examples use `field`. The same code (`OPERATION_NOT_POSSIBLE`, `VALIDATION`) appears under different `type` values.
8. `eventTypeDescription` enum text ("PayAnyBank") differs from example values ("Pay Any Bank").
9. PAYC: flow page names `crypto-pay/execute`, API page `crypto-payout/execute`; request table `firstname` vs example `firstName`; `statusCode 7 = PENDING` overlaps numerically with `transactionStatus 7 = In Progress`; full PAYC status list NOT DOCUMENTED; PAYC error reference not published.
10. Signature page uses header `api-version` and example method `PUT`; other pages use `x-api-version` and `POST`.
11. Most OpenAPI error examples are placeholders (`"string"`), so HTTP-status-to-code mapping is only partly documented.
12. No callback signature, event ID, retry schedule, ordering or deposit acknowledgement rule is documented.
13. Refunds, chargebacks and deposit reversals are NOT DOCUMENTED.
14. Security incident notice on the home page (2026-10-23) and FIAU penalty news (2026-09-03) are operational/regulatory context, not technical limits.

---

## 13. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                                                          |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| errorDecoding    | **limited**   | 25 documented codes with clear types, but generic placeholder messages, a catch-all `TRANSACTION_FAILED` with processor pass-through text, no issuer/decline codes, and codes reused across types.                                                     |
| paymentResponses | **supported** | Stable, well-exemplified JSON envelopes (`payload[]`/`errors[]`) for init-iframe, Payment Status, payouts and status lookups, with explicit final/non-final deposit statuses.                                                                          |
| webhookParsing   | **limited**   | Two documented callback shapes with examples, but no signature, event ID, retry or ordering rules; undocumented fields "may change"; status `5` conflict; deposit callbacks lack an explicit status field on success.                                  |
| timeline         | **limited**   | Payout callbacks and status lookups give ordered numeric states with `createdOn`/`transactionLastUpdated`; deposit callbacks have no timestamps; reversals, refunds and chargebacks are not represented.                                               |
| correlation      | **supported** | `traceId` (merchant) and `transactionReference` (MiFinity) appear in requests, responses, callbacks and status lookups; deposits add `validationKey`; card payouts add `arn`. No parent/child linkage is documented, which only matters for reversals. |
