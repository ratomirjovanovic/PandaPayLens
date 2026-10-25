# Skrill (adapter id `skrill`): high-risk candidate research

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: Skrill merchant documentation now lives on the Paysafe developer portal (`docs.paysafe.com/docs/digital-wallets/...`). Paysafe owns Skrill, and skrill.com's own business and integration pages link there, so these pages are treated as first-party. Each page was downloaded as server-rendered HTML and read as text. The legacy skrill.com PDF (Quick Checkout Guide v10.2) was read only to compare versions. Nothing here describes live behavior beyond what the docs say. **NOT DOCUMENTED** marks gaps.

---

## 0. Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes; item 6 only partial)                                                                                                                                                                                                                                                                                       |
| Classification                     | `wallet`, `alternative_payment_method`; hosted checkout (Quick Checkout) that routes to cards, banks and APMs (gateway-like, but not a merchant-facing card gateway API). `acquiring`, `payment_facilitator` and `merchant_account_intermediary` are not claimed by the docs                                                                                  |
| Documented sectors                 | iGaming / gambling (Paysafe iGaming page; "Skrill gambling merchants" on the payouts page); "eCommerce merchants" is used as a merchant type for Quick Checkout. Forex/trading: **not found** in first-party pages read                                                                                                                                       |
| Documentation access               | **Public** (no login). Some payload fields only appear after Merchant Services enables them (`failed_reason_code`, `sha2sig`, `payment_type`, `customer_id`)                                                                                                                                                                                                  |
| Documented codes (distinct values) | status_url `status`: 5; `failed_reason_code`: 50 (Quick Checkout table) + 1 extra in the Wallet Checkout table = 51; API/MQI mnemonic error strings: 58 (3 of them wildcard patterns); MQI HTTP errors: 5; Bank API: 2 numeric + 6 messages; Unlinked Bank Payouts: 9 preparation codes + 17 execution codes; Skrill JS: 38; Verification of Payee results: 4 |
| Biggest limitation                 | No complete raw status_url example for a Quick Checkout payment (only field tables). Key diagnostic fields (`failed_reason_code`, `payment_type`) are opt-in, so many real payloads carry only `status=-2` with no reason. The two failed-reason tables (Quick Checkout vs Wallet Checkout) disagree on some codes                                            |
| White-label                        | No. Skrill exposes its own formats (`mb_*` fields, `md5sig`, XML API responses). Separate case: Skrill offered as a payment method inside **Paysafe Checkout / Paysafe Payments API** uses Paysafe JSON formats (`paymentType: "SKRILL"`). That belongs to a Paysafe adapter, not to `skrill`                                                                 |

---

## 1. Sources

All read on 2026-10-25. `QC` = `https://docs.paysafe.com/docs/digital-wallets/quick-checkout`, `API` = `https://docs.paysafe.com/docs/digital-wallets/api-mqi`, `WC` = `https://docs.paysafe.com/docs/digital-wallets/wallet-checkout`, `UBP` = `https://docs.paysafe.com/docs/digital-wallets/unlinked-merchant-bank-payouts`.

| URL                                                                                                                                      | What it covers                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.paysafe.com/docs/digital-wallets                                                                                            | Index of the Skrill digital-wallet guides                                                                                         |
| QC (index), QC/about                                                                                                                     | Quick Checkout guide navigation; audience, PCI note                                                                               |
| QC/introduction                                                                                                                          | Payment form fields, `prepare_only` SID flow, Bank API, **status_url fields, status values, retry rule, source IPs**, VAT fields  |
| QC/account-and-integration-options                                                                                                       | Secure return URL (`msid`), refunds, chargeback notification (`-3`), descriptor                                                   |
| QC/one-tap                                                                                                                               | 1-Tap setup fields, `ondemand_request.pl` XML API, 1-Tap errors, MQI 1-Tap status                                                 |
| QC/skrill-recurring-billing                                                                                                              | `rec_*` fields, `rec_status_url` post fields                                                                                      |
| QC/md5, QC/sha-256                                                                                                                       | `md5sig` recipe, cancelled 1-Tap recipe, secret word rules; `sha2sig`                                                             |
| QC/example-html-forms, QC/payment-method-codes                                                                                           | Form examples; `payment_type` / payment method codes                                                                              |
| QC/error-codes                                                                                                                           | **Failed reason codes** (Appendix H)                                                                                              |
| QC/countries                                                                                                                             | ISO country list and the list of countries Skrill does not accept                                                                 |
| API (index), API/about, API/introduction, API/security, API/glossary                                                                     | API vs MQI scope, endpoints, content types, password and IP whitelist                                                             |
| API/send-money                                                                                                                           | `pay.pl` prepare/transfer, XML responses, transfer errors                                                                         |
| API/quick-checkout-payouts                                                                                                               | Payouts referencing a deposit, payout status report, worked MD5 example, raw status post example                                  |
| API/refunds                                                                                                                              | `refund.pl` prepare/refund, refund status report, refund MD5                                                                      |
| API/mqi                                                                                                                                  | `query.pl` actions, `status_trn` raw examples, recurring/1-Tap status, balance API, Balance Notification Webhook, MQI HTTP errors |
| API/balance-exchange                                                                                                                     | Treasury FX API (JSON/XML), its errors                                                                                            |
| API/error-messages                                                                                                                       | Appendix B: API error strings by category                                                                                         |
| WC (index), WC/introduction, WC/failed-reason-codes, WC/md5                                                                              | Wallet Checkout status_url (same shape), status table, **second failed-reason table**                                             |
| UBP (index), UBP/about, UBP/preparation-response, UBP/execution-response, UBP/payout-status-notification, UBP/sign-parameter-calculation | Unlinked bank payouts: JSON responses, error codes, status post with extra statuses, HMAC `sign`                                  |
| https://docs.paysafe.com/docs/digital-wallets/skrill-js/overview, .../skrill-js/error-catalog                                            | Skrill JS embedded card SDK and its error codes                                                                                   |
| https://www.skrill.com/en/business/ (redirects to https://www.paysafe.com/en/digital-wallets/)                                           | Skrill and Neteller merchant offering; regulatory footer                                                                          |
| https://www.skrill.com/en/business/integration/ (redirects to https://www.paysafe.com/en/skrill-business/integration/)                   | Official guide links; points to docs.paysafe.com and one legacy PDF                                                               |
| https://www.paysafe.com/en/industries-we-serve/igaming/                                                                                  | iGaming page naming Skrill                                                                                                        |
| https://www.paysafe.com/en/industries-we-serve/financial-services/ , .../ecommerce/                                                      | Read; neither names Skrill specifically (generic "digital wallets")                                                               |
| https://www.skrill.com/en/support/question/11/which-countries-are-serviced-by-skrill/                                                    | Serviced countries, legal entities per region                                                                                     |
| https://www.skrill.com/fileadmin/content/pdf/Skrill_Quick_Checkout_Guide.pdf                                                             | Legacy PDF, **Version 10.2, copyright 2023**; used only for version comparison                                                    |
| https://developer.paysafe.com/en/api-docs/paysafe-checkout/payment-methods/wallets/skrill/                                               | Skrill as a payment method inside Paysafe Checkout (JSON Payments API)                                                            |

Tried and not found (404): `https://www.skrill.com/en/business/gaming/`, `.../business/forex/`, `.../business/developers/`.

---

## 2. Qualification gate

| #   | Item                             | Answer        | Evidence                                                                                                                                                                                              |
| --- | -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes           | paysafe.com/en/digital-wallets (2026 footer) offers Skrill business accounts ("Open a business account now"); footer: Skrill Limited FRN 900001 authorised by the FCA                                 |
| 2   | Payment service operational      | yes           | Same page plus current docs (Docusaurus site, 2026 copyright) describing live endpoints `https://pay.skrill.com`, `https://www.skrill.com/app/*.pl`                                                   |
| 3   | Docs publicly accessible         | yes           | All docs.paysafe.com pages load without login. Merchant portal settings (secret word, API password, IP whitelist) need a login, but the docs do not. Some fields need activation by Merchant Services |
| 4   | API families/versions identified | yes           | QC (hosted form + status_url), API (`pay.pl`, `refund.pl`, `ondemand_request.pl`), MQI (`query.pl`), UBP, Balance Exchange, Skrill JS. Web docs carry **no version numbers**; legacy PDF is v10.2     |
| 5   | Offline-examinable formats       | yes           | Field tables for every notification; raw examples for payout status post, MQI `status_trn`, XML API responses, UBP JSON. Gap: no raw Quick Checkout status_url example                                |
| 6   | Sectors documented               | yes (partial) | Paysafe iGaming page: "Access 15 million active users of Skrill, Neteller and PaysafeCard"; API/quick-checkout-payouts: payouts "enable Skrill gambling merchants" to send winnings                   |
| 7   | Regional/regulatory limits       | yes           | QC/countries non-accepted list; logo rule for non-EU/EEA/US merchants; EEA vs non-EEA fund separation; gaming-related send-money restrictions (see section 3)                                         |
| 8   | Diagnostic value                 | yes           | 5 status values incl. chargeback, 50+ failed reason codes, ~58 API error strings, documented retry/duplicate rules                                                                                    |
| 9   | Own technical formats            | yes           | Skrill-specific `mb_*` fields, `md5sig`, XML `<response>`; not a resale of a supported gateway                                                                                                        |
| 10  | No credentials needed to analyse | yes           | All examples are in public docs. (Docs even publish demo merchant accounts; not needed here)                                                                                                          |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## 3. Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wallet`                     | API/glossary: the Skrill Digital Wallet lets customers link cards and pay from their wallet account; status `2` means funds received "in your Skrill account"                                                       |
| `alternative_payment_method` | QC/payment-method-codes lists Neteller, PaysafeCard, Rapid Transfer, Trustly, iDEAL, Pix, Blik, etc. behind one hosted page                                                                                         |
| gateway-like hosted checkout | QC/introduction: Quick Checkout "sends these details to the relevant bank or alternative payment provider for authorisation". No server-to-server card API for merchants (Skrill JS is a browser SDK)               |
| card acceptance              | Cards (VSA, MSC, ACC) via the hosted page. Who acquires is **NOT DOCUMENTED**. QC/introduction only says the Skrill processing agreement does not give non-EU/EEA/US merchants rights to show Visa/Mastercard marks |

Sectors (provider's own words only):

| Sector                         | Source                                                  | Short quote                                                                                       |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| iGaming                        | https://www.paysafe.com/en/industries-we-serve/igaming/ | "Products like Skrill, Neteller, PaysafeCard and PaysafeCash."                                    |
| Gambling (payouts of winnings) | API/quick-checkout-payouts                              | "enable Skrill gambling merchants to transfer funds (such as winnings)"                           |
| eCommerce (merchant type)      | API/about; PDF v10.2 cover                              | Quick Checkout guide "Applicable to Ecommerce merchants"; "For use by Skrill eCommerce merchants" |

Gaming also shows up indirectly in error codes: `DISALLOWED_RECIPIENT` (example: gaming merchants to US customers), `GAMING_RESTRICTED_MONEY_API`, UBP `7017`/`7018`. Forex, adult, crypto merchant sectors: **NOT DOCUMENTED** in the pages read. Caveat: eligibility depends on jurisdiction, licensing and underwriting. Approval for one sector does not imply another.

Regional / regulatory limits:

- QC/countries: Skrill does not accept customers from Afghanistan, Cuba, Eritrea, Iran, Iraq, Japan, Kyrgyzstan, Libya, North Korea, Sudan, South Sudan and Syria.
- Skrill support page 11: service follows the registration form's country list, with no new registrations from India. Entities: Paysafe Payment Solutions Limited (EEA, Central Bank of Ireland), Skrill USA, Inc. (US), Skrill Limited (other countries, FCA).
- API/introduction: merchant balances must be split into EEA and non-EEA groups. `account_id` may be required, which leads to `MISSING_REGION_IDENTIFIER` / `DISALLOWED_CROSS_REGION_PAYMENT`.
- Per-method country lists (e.g. Neteller excludes the USA and others) are in QC/payment-method-codes.
- QC/introduction: if the merchant is registered with SAFETYPAY BRASIL, `tax_id` (customer CPF) is required.

---

## 4. API families in scope

| Family                                                          | Endpoint                                                                                                    | Request             | Response                                                                                                                         | Priority                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Quick Checkout / Wallet Checkout status report                  | POST to merchant `status_url` / `status_url2`                                                               | n/a                 | form fields (see section 8)                                                                                                      | **1st**                                                  |
| Refund API + refund status report                               | `https://www.skrill.com/app/refund.pl` (`action=prepare` then `action=refund`); POST to `refund_status_url` | form-encoded or GET | `text/xml`; notification form fields                                                                                             | **1st**                                                  |
| Send money / QCO payouts / 1-Tap (Automated Payments Interface) | `https://www.skrill.com/app/pay.pl`, `https://www.skrill.com/app/ondemand_request.pl`                       | form-encoded or GET | `text/xml`                                                                                                                       | **2nd**                                                  |
| MQI                                                             | `https://www.skrill.com/app/query.pl`                                                                       | form-encoded or GET | `text/html` (query-string body for `status_trn`; plain text for `status_rec`/`status_od`); CSV for `history`; JSON for `balance` | 2nd (`status_trn` uses the same field set as status_url) |
| Recurring / 1-Tap notifications                                 | `rec_status_url`, `ondemand_status_url`                                                                     | n/a                 | form fields (partly undocumented)                                                                                                | 3rd                                                      |
| Unlinked Merchant Bank Payouts                                  | prepare/execute endpoints (JSON) + status_url POST                                                          | see UBP             | `application/json`; status post as form fields                                                                                   | 3rd                                                      |
| Bank API                                                        | `https://pay.skrill.com/banks`                                                                              | GET query           | JSON array                                                                                                                       | low                                                      |
| Balance Exchange, balance API, Balance Notification Webhook     | `https://www.skrill.com/app/exchange`, `query.pl?action=balance`, merchant URL                              | form                | JSON (or XML)                                                                                                                    | out of scope (treasury)                                  |
| Skrill JS                                                       | browser SDK                                                                                                 | n/a                 | error codes in JS                                                                                                                | low                                                      |
| Skrill via Paysafe Checkout                                     | Paysafe Payments API                                                                                        | JSON                | JSON                                                                                                                             | out of scope (Paysafe adapter)                           |

Implement first: the status_url form post (payments, chargebacks, payouts), plus the XML `<response>` bodies of `refund.pl` and `pay.pl` with their `error_msg` strings.

---

## 5. Formats

- Content types: API responses `text/xml`; MQI responses `text/html`, except history (`application/vnd.ms-excel;charset=UTF-8`) (API/security). Requests are `application/x-www-form-urlencoded` or GET query strings. Plain HTTP is refused.
- status_url: "standard HTTP POST" (QC/introduction). The exact `Content-Type` header is **NOT DOCUMENTED**. The raw example on API/quick-checkout-payouts is URL-encoded `key=value&...`. Text fields are UTF-8.
- Main fields: `status`, `failed_reason_code`, `mb_transaction_id`, `transaction_id`, `mb_amount`, `mb_currency`, `amount`, `currency`, `merchant_id`, `pay_to_email`, `pay_from_email`, `md5sig`, `sha2sig`. XML: `<response><sid>`, `<response><error><error_msg>`, `<response><transaction><amount|currency|id|status|status_msg>`; refund execution returns flat `<mb_amount>`, `<mb_currency>`, `<mb_transaction_id>`, `<status>`, `<transaction_id>`.
- Amount format: no trailing zeros needed (`39.68`, `39.6`, `39`). `mb_amount` can carry up to 6 decimals in examples (`74.218786`).

Example A: payout status report post, transcribed from API/quick-checkout-payouts (the docs split the key `mb_amount` with a stray space; repaired here and flagged in section 12):

```
merchant_id=290186320&transaction_id=200366670&mb_transaction_id=200366670&mb_amount=74.218786&mb_currency=GBP&status=2&md5sig=3ED76725C3E3CE6CE25F16F01BDFDF1D&amount=80.0&pay_from_email=payer%40gmail.com&pay_to_email=merchant%40info.com&currency=EUR
```

Example B: refund execution response, from API/refunds:

```xml
<response>
  <mb_amount>2</mb_amount>
  <mb_currency>EUR</mb_currency>
  <mb_transaction_id>381526883</mb_transaction_id>
  <Field1>Value1</Field1>
  <Field2>Value2</Field2>
  <status>2</status>
  <transaction_id/>
</response>
```

The MQI `status_trn` response for a checkout transaction (API/mqi) uses the same query-string shape as a status_url post and includes `md5sig` and `confirmed_by_provider=True`.

---

## 6. Codes

Categories and retry classes below are **suggestions** for PandaPayLens, not Skrill statements. Meanings are short paraphrases. See the linked pages for the original text.

### 6a. Status values

| Context                                           | Field                   | Values (documented)                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QC/WC status_url (payments)                       | `status`                | `2` processed (funds in merchant wallet); `0` pending (offline bank transfer; do not fulfil); `-1` cancelled (by payer, or auto after 14 days pending); `-2` failed (provider or Skrill fraud decline); `-3` chargeback (also debits merchant, emails merchant) |
| Recurring post (`rec_status_url`)                 | `status`                | `2` processed, `-2` failed                                                                                                                                                                                                                                      |
| Refund execution XML                              | `status`                | `2` processed, `0` pending, `-2` failed                                                                                                                                                                                                                         |
| Refund status report                              | `status`                | `2` processed, `-2` failed                                                                                                                                                                                                                                      |
| Send money transfer XML                           | `status` / `status_msg` | `1` scheduled (beneficiary not registered; returned after 14 days if unclaimed), `2` processed                                                                                                                                                                  |
| QCO payout transfer XML                           | `status`                | `2` processed, `0` pending, `-2` failed                                                                                                                                                                                                                         |
| QCO payout status report                          | `status`                | `2` processed, `-2` failed                                                                                                                                                                                                                                      |
| 1-Tap execution XML                               | `status`                | `2` processed, `-2` failed                                                                                                                                                                                                                                      |
| MQI `status_rec`                                  | `Status:` text          | `0` active, `-1` cancelled, `-2` failed, `1` finished                                                                                                                                                                                                           |
| MQI `status_od`                                   | `Status:` text          | `0` active, `-1` cancelled, `-2` failed initial payment                                                                                                                                                                                                         |
| UBP execution JSON                                | `status`                | `PENDING`, `SCHEDULED`, `PROCESSED`, `FAILED`                                                                                                                                                                                                                   |
| UBP status post                                   | `status`                | `-2` failed, `2` processed, `0` pending, `1` scheduled, `-1` cancelled, `-4` returned by recipient's bank                                                                                                                                                       |
| Verification of Payee (QCO payouts XML, UBP JSON) | `result`                | `MATCH`, `NO_MATCH`, `CLOSE_MATCH`, `NOT_AVAILABLE`                                                                                                                                                                                                             |
| Balance Exchange                                  | `status` / `statusMsg`  | only `2` / `processed` shown                                                                                                                                                                                                                                    |

### 6b. `failed_reason_code` (QC/error-codes; WC/failed-reason-codes): 50 + 1 values

Sent only with `status=-2` and only if Merchant Services enabled it. The codes map processor and internal failures, so card, wallet, voucher and bank reasons share one list. QC shows two-digit padded values (`01`...`09`). WC shows unpadded values (`1`...`9`). Normalize both.

| Code | Meaning (paraphrase)                                                       | Category                        | Retry                    |
| ---- | -------------------------------------------------------------------------- | ------------------------------- | ------------------------ |
| 01   | issuer referral                                                            | card_declined                   | customer_action_required |
| 02   | merchant invalid or inactive                                               | configuration                   | manual_review            |
| 03   | pick up card                                                               | fraud_or_risk                   | do_not_retry             |
| 04   | issuer declined                                                            | card_declined                   | customer_action_required |
| 05   | not enough funds                                                           | insufficient_funds              | customer_action_required |
| 06   | merchant/processor decline (WC: transaction failed)                        | card_declined                   | retry_conditionally      |
| 07   | wrong PIN                                                                  | authentication_failed           | customer_action_required |
| 08   | PIN attempts exceeded, card blocked                                        | authentication_failed           | do_not_retry             |
| 09   | invalid transaction                                                        | invalid_request                 | do_not_retry             |
| 10   | frequency limit hit                                                        | rate_limiting                   | retry_conditionally      |
| 11   | amount invalid, too high/low, or over limit                                | invalid_amount                  | customer_action_required |
| 12   | invalid card or bank account                                               | invalid_request                 | customer_action_required |
| 13   | invalid issuer                                                             | card_declined                   | customer_action_required |
| 15   | duplicate reference                                                        | duplicate_request               | do_not_retry             |
| 19   | QC: credentials invalid/expired, not authorized; **WC: retry transaction** | unknown (conflict)              | manual_review            |
| 20   | Neteller member in blocked region                                          | payment_method_unavailable      | do_not_retry             |
| 22   | unsupported Accept/content type                                            | invalid_request                 | do_not_retry             |
| 24   | card expired                                                               | card_declined                   | customer_action_required |
| 27   | function not supported / not available                                     | configuration                   | do_not_retry             |
| 28   | lost or stolen card                                                        | fraud_or_risk                   | do_not_retry             |
| 30   | format failure                                                             | invalid_request                 | do_not_retry             |
| 31   | provider limit exceeded                                                    | payment_method_unavailable      | customer_action_required |
| 32   | CVV/CVC check failed                                                       | card_declined                   | customer_action_required |
| 34   | illegal transaction                                                        | fraud_or_risk                   | do_not_retry             |
| 35   | not entitled, account closed, unauthorized (QC only)                       | configuration                   | manual_review            |
| 37   | card restricted by issuer                                                  | card_declined                   | customer_action_required |
| 38   | security violation                                                         | fraud_or_risk                   | do_not_retry             |
| 42   | card blocked by issuer                                                     | card_declined                   | do_not_retry             |
| 44   | issuer or network unavailable                                              | provider_unavailable            | retry_conditionally      |
| 45   | card type not processed                                                    | payment_method_unavailable      | customer_action_required |
| 51   | system error                                                               | provider_unavailable            | retry_conditionally      |
| 58   | acquirer does not permit                                                   | payment_method_unavailable      | do_not_retry             |
| 63   | not permitted for cardholder                                               | card_declined                   | customer_action_required |
| 64   | invalid data or entity not found (long list; QC only)                      | invalid_request                 | do_not_retry             |
| 67   | BitPay session expired                                                     | network_or_timeout              | customer_action_required |
| 68   | referenced transaction not settled (QC only)                               | invalid_request                 | retry_conditionally      |
| 69   | referenced transaction not fully authenticated (QC only)                   | authentication_required         | do_not_retry             |
| 70   | customer failed 3DS                                                        | authentication_failed           | customer_action_required |
| 80   | fraud rules decline                                                        | fraud_or_risk                   | do_not_retry             |
| 81   | matching criteria not met                                                  | fraud_or_risk                   | manual_review            |
| 98   | provider communication error                                               | network_or_timeout              | retry_conditionally      |
| 99   | other                                                                      | unknown                         | unknown                  |
| 102  | 6-digit code invalid                                                       | authentication_failed           | customer_action_required |
| 103  | 6-digit code expired (**WC only**)                                         | authentication_failed           | customer_action_required |
| 104  | PaysafeCard name match failed (QC only)                                    | fraud_or_risk                   | manual_review            |
| 105  | token invalid (QC only)                                                    | invalid_request                 | customer_action_required |
| 110  | user cancelled                                                             | unknown (customer cancellation) | customer_action_required |
| 115  | abandoned                                                                  | unknown (customer abandonment)  | customer_action_required |
| 120  | funds not settled (QC only)                                                | insufficient_funds              | retry_conditionally      |
| 130  | bank does not permit (QC only)                                             | payment_method_unavailable      | customer_action_required |
| 135  | transaction expired (QC only)                                              | network_or_timeout              | customer_action_required |

QC text also says code `54` = "internal security restrictions" in the `-2` status description, but 54 is **not** in either table (section 12).

### 6c. API / MQI error strings (`<error_msg>` or `error`): 58 distinct

Sources: API/error-messages, API/send-money, API/refunds, API/quick-checkout-payouts, QC/one-tap, API/balance-exchange.

| Code                                                                                              | Meaning                                                               | Category                   | Retry                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| INVALID_OR_MISSING_ACTION                                                                         | bad or missing `action`                                               | invalid_request            | do_not_retry                                  |
| INVALID_*                                                                                         | invalid parameter (suffix = name)                                     | invalid_request            | do_not_retry                                  |
| MISSING_*                                                                                         | missing parameter (suffix = name)                                     | invalid_request            | do_not_retry                                  |
| NOT_SUPPORTED_CURRENCY_*                                                                          | currency not supported                                                | invalid_request            | do_not_retry                                  |
| LOGIN_INVALID                                                                                     | email or password absent                                              | authentication_failed      | do_not_retry                                  |
| CANNOT_LOGIN                                                                                      | wrong email or API/MQI password                                       | authentication_failed      | do_not_retry                                  |
| PAYMENT_DENIED                                                                                    | API not enabled or IP not whitelisted                                 | configuration              | do_not_retry                                  |
| NO_LOGIN_EXPLANATION                                                                              | merchant email does not exist                                         | configuration              | do_not_retry                                  |
| PAYOUTS_NOT_ENABLED                                                                               | QCO payouts not enabled                                               | configuration              | do_not_retry                                  |
| REFUND_DENIED                                                                                     | refunds not activated                                                 | configuration              | do_not_retry                                  |
| LOCK_LEVEL_9                                                                                      | merchant account locked after failed logins (example only)            | authentication_failed      | manual_review                                 |
| LL_NO_PAYMENT                                                                                     | account locked for security                                           | fraud_or_risk              | manual_review                                 |
| CHECK_FOR_VERIFIED_EMAIL                                                                          | merchant email not verified                                           | configuration              | manual_review                                 |
| INVALID_EMAIL                                                                                     | bad email parameter                                                   | invalid_request            | do_not_retry                                  |
| INVALID_PASSWORD                                                                                  | password too long (Balance Exchange)                                  | invalid_request            | do_not_retry                                  |
| INVALID_AMOUNT                                                                                    | bad amount format                                                     | invalid_amount             | do_not_retry                                  |
| INVALID_BNF_EMAIL                                                                                 | bad beneficiary email                                                 | invalid_request            | do_not_retry                                  |
| INVALID_CURRENCY                                                                                  | bad currency                                                          | invalid_request            | do_not_retry                                  |
| INVALID_FRN_TRN_ID / INVALID_NOTE / INVALID_SUBJECT                                               | field too long (3 codes)                                              | invalid_request            | do_not_retry                                  |
| MISSING_AMOUNT                                                                                    | amount missing (example)                                              | invalid_request            | do_not_retry                                  |
| MISSING_REGION_IDENTIFIER                                                                         | `account_id` needed for EEA/non-EEA split                             | invalid_request            | do_not_retry                                  |
| ALREADY_EXECUTED                                                                                  | duplicate `frn_trn_id`                                                | duplicate_request          | do_not_retry                                  |
| EXECUTION_PENDING                                                                                 | same session still executing                                          | duplicate_request          | retry_conditionally (wait)                    |
| SESSION_EXPIRED                                                                                   | SID older than 15 minutes                                             | network_or_timeout         | safe_to_retry_technical_request (new prepare) |
| BALANCE_NOT_ENOUGH                                                                                | balance too low (merchant for send/refund/payout; customer for 1-Tap) | insufficient_funds         | retry_conditionally                           |
| RESERVE_EXCEEDED                                                                                  | refund blocked by reserve                                             | insufficient_funds         | manual_review                                 |
| CC_REFUND_FAILED                                                                                  | card refund failed                                                    | payment_method_unavailable | manual_review                                 |
| GENERIC_ERROR                                                                                     | other error, or already refunded                                      | unknown                    | manual_review                                 |
| REQUEST_FAILED                                                                                    | 1-Tap generic failure                                                 | unknown                    | manual_review                                 |
| COUNTRY_BLOCKED_FOR_PAYMENTS                                                                      | customer country blocked for outgoing payments                        | fraud_or_risk              | do_not_retry                                  |
| DISALLOWED_CROSS_REGION_PAYMENT                                                                   | `account_id` region mismatch                                          | configuration              | do_not_retry                                  |
| DISALLOWED_RECIPIENT                                                                              | recipient not allowed (e.g. gaming to US)                             | fraud_or_risk              | do_not_retry                                  |
| GAMING_RESTRICTED_MONEY_API                                                                       | recipient type restricted for regulatory reasons                      | fraud_or_risk              | do_not_retry                                  |
| MERCHANT_CLASS_RESTRICTED_TO_SEND_MONEY_TO_INC_RECIPIENT                                          | cannot send to INC recipient                                          | configuration              | do_not_retry                                  |
| CUSTOMER_TYPES_MISMATCH_N_T                                                                       | test vs normal account mix                                            | configuration              | do_not_retry                                  |
| CANNOT_SEND_MONEY_YOURSELF                                                                        | send to own account                                                   | invalid_request            | do_not_retry                                  |
| SINGLE_TRN_LIMIT_VIOLATED                                                                         | over per-transaction max (EUR 10,000)                                 | invalid_amount             | do_not_retry                                  |
| TRANSACTION_LIMIT_VIOLATION                                                                       | payout limit hit                                                      | invalid_amount             | manual_review                                 |
| CUMULATIVE_LIMIT_VIOLATION                                                                        | period payout limit hit                                               | rate_limiting              | retry_conditionally                           |
| ORIGINAL_PAYMENT_NOT_PROCESSED                                                                    | referenced deposit not processed                                      | invalid_request            | retry_conditionally                           |
| ORIGINAL_PAYMENT_UNSUPPORTED_FOR_PAYOUT                                                           | deposit method cannot receive payouts                                 | payment_method_unavailable | do_not_retry                                  |
| CARD_FAILED                                                                                       | customer's card failed (1-Tap)                                        | card_declined              | customer_action_required                      |
| CUSTOMER_IS_LOCKED                                                                                | customer locked for outgoing payments                                 | fraud_or_risk              | do_not_retry                                  |
| MAX_AMOUNT_REACHED                                                                                | over 1-Tap mandate max                                                | invalid_amount             | customer_action_required                      |
| MAX_REQ_REACHED                                                                                   | too many failed 1-Tap attempts (2 per 24 h)                           | rate_limiting              | retry_conditionally                           |
| ONDEMAND_CANCELLED                                                                                | customer cancelled 1-Tap mandate                                      | payment_method_unavailable | customer_action_required                      |
| ONDEMAND_INVALID                                                                                  | 1-Tap mandate does not exist                                          | invalid_request            | do_not_retry                                  |
| RECIPIENT_LIMIT_EXCEEDED                                                                          | customer account limits too low                                       | insufficient_funds         | customer_action_required                      |
| TOKEN_INVAILD                                                                                     | PaysafeCard token invalidated (spelling as documented)                | invalid_request            | customer_action_required                      |
| MISSING_FROM_ACCOUNT_ID / INVALID_FROM_ACCOUNT_ID / MISSING_TO_ACCOUNT_ID / INVALID_TO_ACCOUNT_ID | Balance Exchange account ids (4 codes)                                | invalid_request            | do_not_retry                                  |
| FROM_ACCOUNT_ID_MUST_BE_DIFFERENT_THAN_TO_ACCOUNT_ID                                              | same source and target                                                | invalid_request            | do_not_retry                                  |
| ACCOUNT_ID_DOES_NOT_BELONG_TO_CUSTOMER                                                            | account not owned                                                     | configuration              | do_not_retry                                  |
| CURRENCY_MUST_BE_THE_SAME_AS_ACCOUNT_CURRENCY                                                     | currency mismatch                                                     | invalid_request            | do_not_retry                                  |

(Rows with "/" hold several codes. Total distinct strings = 58.)

### 6d. Other code sets

| Set                           | Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Notes / suggested handling                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MQI HTTP errors (API/mqi)     | `401` cannot log in, `402` reserved, `403` forbidden (also `403 Transaction not found: <id>`), `404` not found, `405` method not allowed                                                                                                                                                                                                                                                                                                                                                                            | 401 authentication_failed; 403 not found = invalid_request; all do_not_retry                                                                                |
| Bank API (QC/introduction)    | `5068` field errors (also invalid countryId, invalid merchant); `5003` invalid amount (also unknown currency, method not available)                                                                                                                                                                                                                                                                                                                                                                                 | Payouts page lists the same messages as HTTP `400` instead. invalid_request, do_not_retry                                                                   |
| UBP preparation (JSON `code`) | `MISSING_PARAMETER`, `INVALID_PARAMETER`, `NOT_MATCHING_PAYMENT_INSTRUMENT_COUNTRY`, `SWIFT_NOT_MATCH_WITH_IBAN`, `UNSUPPORTED_BANK`, `ALREADY_PAID`, `COUNTRY_NOT_SUPPORTED_FOR_PAYOUTS`, `BAD_REQUEST` (IP not allowed; initial payout not confirmed), `GENERAL_ERROR` (several token/merchant mismatches)                                                                                                                                                                                                        | Mostly invalid_request / configuration; `ALREADY_PAID` duplicate_request                                                                                    |
| UBP execution (JSON `code`)   | `7001` bad request, `7002` bad signature, `7003` session expired, `7004` bad session data, `7005` insufficient balance, `7006` account restricted, `7007` minimum limit not met, `7008` per-transaction limit, `7009` daily limit, `7010` weekly limit, `7011` monthly limit, `7012` bank country blocked, `7013` country not enabled for merchant, `7014` account not found, `7015` recipient country blocked, `7017` recipient country blocked for gaming, `7018` recipient instrument country blocked for gaming | 7002 authentication_failed; 7005 insufficient_funds; 7007-7011 invalid_amount/rate_limiting; 7012-7018 fraud_or_risk or configuration. No `7016` documented |
| Skrill JS (browser)           | General `5001`, `5900`, `5910`, `9004`; init `5901`, `5904`, `5905`, `5906`, `5907`, `9200`, `5917`; card data `5911`-`5916`; risk `5201`-`5206`; processing `5909`, `5301`-`5314`                                                                                                                                                                                                                                                                                                                                  | 38 values. Client-side only, so low priority; categories follow the page's own grouping (configuration / invalid_request / fraud_or_risk / card_declined)   |

---

## 7. Lifecycle

Wallet semantics (funds move into or out of the merchant's Skrill wallet balance):

- Payment: optional `0` pending (offline bank transfer only), then `2` processed, `-1` cancelled (pending for 14 days, or cancelled by the payer), or `-2` failed. `-2` is said to come from card/provider declines or Skrill fraud rules. WC says it never occurs if cards are not accepted. Later `-3` chargeback arrives as a new post on the same status_url, and Skrill books a separate debit transaction.
- Refund: two-step API. Execution returns `2`/`0`/`-2`. If pending, a refund status report later sends `2` or `-2` to `refund_status_url`. The refund gets its own `mb_transaction_id`.
- Send money (wallet to wallet): `1` scheduled (recipient not registered; funds return after 14 days) or `2` processed. No notification documented.
- QCO payout (to the original deposit instrument): `0` pending, then a status report with `2`/`-2`.
- Recurring billing (cards, Skrill balance, PaysafeCard): each payment is posted to `rec_status_url` with `2`/`-2`. Mandate state via MQI `status_rec` (`0`/`-1`/`-2`/`1`).
- 1-Tap: the initial payment creates `rec_payment_id`. Later debits go through `ondemand_request.pl` (`2`/`-2`) and are also posted to `status_url`. Mandate state via `status_od` (`0`/`-1`/`-2`). Cancellation is posted to `ondemand_status_url`.
- Unlinked bank payout: `PENDING`/`SCHEDULED`/`PROCESSED`/`FAILED` in JSON, and `0`/`1`/`2`/`-1`/`-2`/`-4` in the status post.

Card/gateway semantics: there is no auth/capture/void model. The glossary mentions cancel before capture and preauthorisation, but no API exposes it (**NOT DOCUMENTED** for merchants). Card issuer outcomes reach the merchant only as `failed_reason_code`.

---

## 8. Notifications

| Item                    | status_url (payment)                                                                                                                                                                                                                 | Other posts                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport               | HTTP POST (or `mailto:`), up to 400 chars, restricted port list, plus optional `status_url2`                                                                                                                                         | `refund_status_url`, payout `status_url`, `rec_status_url(2)`, `ondemand_status_url(2)`, UBP `status_url`                                                                                                                                                                                                       |
| Content type            | **NOT DOCUMENTED** (example body is URL-encoded)                                                                                                                                                                                     | same                                                                                                                                                                                                                                                                                                            |
| Always present          | `pay_to_email`, `pay_from_email`, `merchant_id`, `mb_transaction_id`, `mb_amount`, `mb_currency`, `status`, `md5sig`, `amount`, `currency`; `transaction_id` (falls back to `mb_transaction_id` if not sent)                         | Refund: `transaction_id`, `mb_transaction_id`, `status`, `mb_amount`, `mb_currency`, `md5sig`, opt. `sha2sig`. Recurring: `merchant_id`, `transaction_id`, `status`, `rec_payment_id`, `rec_payment_type`, `md5sig`, opt. `sha2sig`, `merchant_fields`                                                          |
| Optional / activated    | `customer_id`, `failed_reason_code`, `sha2sig`, `payment_type` (`WLT`/`MDB` or detailed codes), echoed `merchant_fields`, `instrument_id`, `confirmed_by_provider`, VAT fields `payment_instrument_country`, `country`, `IP_country` | UBP adds `payment_type` (e.g. `BWI`, `ONB`, `SPX`) and `failed_reason_code`                                                                                                                                                                                                                                     |
| Signature (sensitive)   | `md5sig` = uppercase MD5 of `merchant_id` + `transaction_id` + uppercase MD5(secret word) + `mb_amount` + `mb_currency` + `status`. `sha2sig` = same string hashed with SHA-256 (opt-in)                                             | Refund: same, but with `mb_transaction_id` instead of `transaction_id`. Cancelled 1-Tap: merchant_id + transaction_id + MD5(secret) + status + rec_payment_id. UBP request `sign` = HMAC-SHA256 over merchant_id + transaction_id + uppercase MD5(secret) + amount + currency, keyed with lowercase MD5(secret) |
| Acknowledgement / retry | Retries until HTTP 200, or until more than 10 posts                                                                                                                                                                                  | Same rule stated for payout and UBP posts. Refund and recurring retry: **NOT DOCUMENTED**                                                                                                                                                                                                                       |
| Ordering / timing       | **NOT DOCUMENTED**. No timestamp field                                                                                                                                                                                               |                                                                                                                                                                                                                                                                                                                 |
| Duplicates              | Docs warn about repeat posts for the same `transaction_id` / `mb_transaction_id`. No event ID. Repost on demand via MQI `action=repost`                                                                                              |                                                                                                                                                                                                                                                                                                                 |
| Source IPs              | 4 legacy /24 ranges (being deprecated) + 6 individual addresses (QC/introduction)                                                                                                                                                    | UBP lists only the 6 new addresses                                                                                                                                                                                                                                                                              |
| Return URL              | `return_url` gets `transaction_id` and `msid` (MD5 of merchant_id + transaction_id + MD5(secret)) when secure return is enabled. This proves the customer completed the flow, not that the payment was processed                     |                                                                                                                                                                                                                                                                                                                 |
| Balance webhook         | JSON `{notificationId, timestamp, data{accountId, availableBalance, currency}}`, header `X-Paysafe-Signature` (SHA256withRSA, Base64)                                                                                                | Treasury; out of scope                                                                                                                                                                                                                                                                                          |

Both worked examples check out offline: the refund MD5 example gives `CF9DCA614656D19772ECAB978A56866D`, and the UBP HMAC example gives the documented `sign`. PandaPayLens should not verify signatures (that needs the secret word). It may only report that a signature field is present and has the right shape (32 or 64 hex characters).

---

## 9. Identifiers

| Identifier                                      | Meaning                                                                                                                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transaction_id`                                | Merchant reference (max 100, should be unique). Falls back to `mb_transaction_id` in posts. In refund requests it identifies the original payment, but in the refund response/report it is the "refund transaction ID". Ambiguous |
| `mb_transaction_id`                             | Skrill ID. Refunds and chargebacks get a **new** one. No parent-ID field links them to the payment (chargeback: same status_url post with `-3`; which IDs it carries is **NOT DOCUMENTED**)                                       |
| `mb_trn_id` / `trn_id`                          | MQI names for the Skrill / merchant IDs                                                                                                                                                                                           |
| `frn_trn_id`                                    | Merchant reference for send money, payouts, 1-Tap debits. Becomes `transaction_id` in the payout status report                                                                                                                    |
| `<id>` (XML), `id` / `transactionId` (UBP JSON) | Skrill transaction ID in transfer responses                                                                                                                                                                                       |
| `rec_payment_id`                                | Recurring / 1-Tap mandate ID. Links subsequent debits to the setup payment                                                                                                                                                        |
| `customer_id`                                   | Skrill account ID (wallet) or a Skrill-generated payer ID                                                                                                                                                                         |
| `merchant_id`, `pay_to_email`                   | Merchant account. `account_id` = currency sub-account (EEA/ROW)                                                                                                                                                                   |
| `sid`                                           | 32-hex session ID (15 min) for QC redirect and API prepare/execute                                                                                                                                                                |
| `instrument_id`, UBP `token`                    | Reusable instrument references                                                                                                                                                                                                    |

Correlation: payment to refund through the request (`transaction_id`/`mb_transaction_id` of the original). Payment to payout through the payout request. Nothing in notifications links children to parents.

---

## 10. Sensitive fields

- Secrets: the secret word and its MD5 (`327638C2...`-style values), API/MQI `password` (lowercase MD5, often in GET query strings in examples), `md5sig`, `sha2sig`, `msid`, UBP `sign`, `X-Paysafe-Signature`.
- Personal data: `pay_from_email`, `pay_to_email`, `firstname`, `lastname`, `date_of_birth`, `place_of_birth`, address fields, `phone_number`, `tax_id` (CPF), `document_number`, `iban`, `account_num`, `bank_code`, `bank_account_number`, `customer_id`, `merchant_client_id`, `IP_country`.
- Redact before display or sharing. Skrill JS card fields never reach the merchant server.

---

## 11. Structural detection hints

Strong Skrill signals (combine several):

1. Form-encoded body with `mb_transaction_id`, `mb_amount`, `mb_currency` **and** `md5sig` (32 uppercase hex). None of the supported providers' documented formats use the `mb_` prefix.
2. `pay_to_email` + `pay_from_email` + `merchant_id` + signed `status` in {`2`,`0`,`-1`,`-2`,`-3`}. Optional `failed_reason_code`, `payment_type=WLT|MDB`, `rec_payment_id`, `confirmed_by_provider=True|False`.
3. XML `<response>` with exactly `<sid>` (32 hex), `<error><error_msg>UPPER_SNAKE</error_msg>`, or `<transaction><amount><currency><id><status><status_msg>`.
4. Hosts: `pay.skrill.com`, `www.skrill.com/app/pay.pl|refund.pl|query.pl|ondemand_request.pl|exchange`.
5. MQI plain text `Status: 0 Next payment date: dd-mm-yyyy` or `200\t\tOK`.

Versus supported providers: Stripe, Adyen, Checkout.com, PayPal, Mollie and Square use JSON bodies with their own ID shapes, and Braintree has its own SDK/webhook formats (see the existing research files). Skrill uses form-encoded posts and XML. payabl. is also URL-encoded, but it uses `transactionid`/`errorcode`/`security` and negative gateway codes like `-6000`, not `mb_*`/`md5sig`. Versus other candidates (emerchantpay, Ecommpay, Paymentwall, NMI, MiFinity, AstroPay): their formats were not verified in this research, so rely on the Skrill-only keys above. Risks: Neteller (a sibling Paysafe wallet) and Skrill-via-Paysafe Checkout (JSON `paymentType: "SKRILL"`) may appear in the same merchant logs. The second is a Paysafe payload, not a `skrill` one. Whether Neteller's merchant API reuses `mb_*` fields is **NOT DOCUMENTED** here.

---

## 12. Limitations, ambiguities, inconsistencies

1. No full raw Quick Checkout status_url example. Field order and content type are unknown.
2. Opt-in fields (`failed_reason_code`, `payment_type`, `customer_id`, `sha2sig`) are often missing. A `-2` with no reason code can only be decoded as "failed".
3. Two failed-reason tables: QC (50 codes, zero-padded) and WC (40 codes, unpadded). Code `19` means different things (credentials invalid vs "retry transaction"). `06` differs (merchant/processor declined vs transaction failed). Code `103` exists only in WC. The legacy PDF v10.2 lists 42 codes.
4. Code `54` is cited in the QC `-2` description but missing from both tables.
5. The status_url field table lists `-2/2/0/-1` only, while the detailed table adds `-3`.
6. Signature input differs: payments use `transaction_id`, refunds use `mb_transaction_id`, and the payout page names `transaction_id` but uses the refund example values. The example `md5sig` values in the field tables reuse the secret-word hash.
7. Secret word rules conflict: QC/md5 says lowercase, at most 10 characters, no special characters. API/security says at least 8 characters with upper, lower and digit.
8. Docs defects: payout example key split as `mb_amoun t`; MQI example 1 has `mb_currency=EU` and `test%4test.bg`; refund error example `CC_REFUND_ FAILED`; 1-Tap `TOKEN_INVAILD`; balance table says `account_id` but the example uses `accountId`; UBP error table says flat `code`/`message`/`description`, but the example nests `error.code` + `details`.
9. In UBP posts, `pay_from_email` is the merchant and `pay_to_email` the payee (reversed vs payments). The QCO payout report describes `pay_from_email` as the customer receiving funds.
10. `rec_status_url` is described both as a cancellation URL and as receiving every recurring payment. `rec_payment_type` reads "Type of payment: QCO" with example `recurring`. `ondemand_status_url` field names are **NOT DOCUMENTED** (only the MD5 recipe).
11. Bank API errors appear as `5068`/`5003` on one page and HTTP `400` on another.
12. Web docs have no version or date stamps, so change tracking must rely on content.

---

## 13. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                           |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **supported** | Public tables: 50+ failed reason codes, ~58 API error strings, MQI/UBP/Skrill JS codes. Caveats: table conflicts (`19`, `06`), opt-in reason field, `unknown` fallback needed                                           |
| paymentResponses | **limited**   | Payments go through a hosted page with no synchronous response besides the SID. Refund/transfer/payout/1-Tap XML responses are well documented and decodable                                                            |
| webhookParsing   | **supported** | status_url fields, status values, signature recipe, retry and duplicate rules are documented across payment, refund, payout and UBP posts. Gaps: content type, recurring/1-Tap field sets                               |
| timeline         | **limited**   | Clear state sets (pending to processed/cancelled/failed, then chargeback; refund pending to processed). But there are no timestamps or event IDs, and ordering is undocumented                                          |
| correlation      | **limited**   | `transaction_id`/`mb_transaction_id`/`rec_payment_id` link records inside one flow. Refunds, chargebacks and payouts get new IDs with no parent field in notifications, and `transaction_id` meaning shifts for refunds |
