# Paymentwall (adapter id `paymentwall`): high-risk candidate research

- Verification date: **2026-10-25**
- Gate outcome: **`documentation_verified`** (see section 2)
- Method: public docs pages on docs.paymentwall.com, paymentwall.com and docs.terminal3.com were downloaded as HTML, converted to text and read; raw source files of the official `paymentwall-php` and `paymentwall-node` SDKs were read from raw.githubusercontent.com. No login, signup or access request. No provider endpoint was called. Code meanings below are short paraphrases; categories and retry classes are suggestions, not Paymentwall statements.

---

## 0. Summary

| Item                 | Finding                                                                                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome              | `documentation_verified`                                                                                                                                                                                                                                                          |
| Classification       | `gateway`, `card_processing`, `alternative_payment_method`; `payment_facilitator` likely but only indirectly evidenced (section 3)                                                                                                                                                |
| Documented sectors   | Video games (via Terminal3), e-commerce (physical goods), travel, SaaS, enterprise; docs centre on digital goods, virtual currency and subscriptions                                                                                                                              |
| Documentation access | Public (docs.paymentwall.com, API reference at /apis). Merchant Area features (pingback URL, custom pingback parameters, Test Pingback Tool, project keys) need a login and were not accessed                                                                                     |
| Documented codes     | Brick one-time token errors: 7. Brick failed payment errors: 54. Mobiamo response codes: 10. MINT ePIN generation errors: 16. MINT redemption errors: 19. Pingback types: 11. Negative pingback reasons: 12. Widget errors: 9 messages without codes                              |
| Biggest limitation   | Code spaces collide: Brick and MINT redemption reuse `1001`, `1003`, `3001`-`3006`, `3008`, `3009` with different meanings, and `200` is both a token error and a pingback type. Pingbacks carry no timestamp or event id by default and their field set is merchant-configurable |
| White-label note     | Paymentwall exposes its own formats. Terminal3 is Paymentwall's own spin-out ("Powered by Paymentwall"); docs.terminal3.com mirrors the same Brick error table and pingback types. Not a resale of a gateway PandaPayLens supports                                                |

---

## 1. Sources

All read on 2026-10-25.

| URL                                                                                                         | What it covers                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| https://docs.paymentwall.com/                                                                               | Docs landing, API family list                                                                                                  |
| https://docs.paymentwall.com/reference/pingback-home                                                        | Pingback fields, types, reason codes, IP range, `OK` ack, retry every 30 min                                                   |
| https://docs.paymentwall.com/reference/signature-calculation                                                | Signature v2 (MD5) and v3 (SHA-256); v1 deprecated                                                                             |
| https://docs.paymentwall.com/reference/pingback/custom-parameter                                            | Custom pingback parameters (`UNIQUE_REF`, `RECURRING_BILLING_INITIAL_REF`, `CHARGEBACK_*` ...)                                 |
| https://docs.paymentwall.com/reference/errors                                                               | Widget error messages (no codes)                                                                                               |
| https://docs.paymentwall.com/reference/client-side-callback                                                 | `postMessage` JSON events (`paymentSuccess` ...)                                                                               |
| https://docs.paymentwall.com/sandbox/pingback-tool                                                          | Pingback type table incl. type `1`                                                                                             |
| https://docs.paymentwall.com/integration/direct/brick-home                                                  | Brick Direct overview                                                                                                          |
| https://docs.paymentwall.com/integration/direct/brick/charge                                                | Charge, authorize/capture/void, permanent token                                                                                |
| https://docs.paymentwall.com/integration/direct/brick/3dsecure                                              | 3DS response shapes (`secure.redirect`, `secure.formHTML`)                                                                     |
| https://docs.paymentwall.com/integration/direct/brick/subscription                                          | Brick subscription, retries, type 13/14 pingbacks                                                                              |
| https://docs.paymentwall.com/integration/direct/brick/pingback                                              | Brick pingback handling, sample pingback URL                                                                                   |
| https://docs.paymentwall.com/integration/direct/brick/error-codes                                           | Brick error JSON and code tables                                                                                               |
| https://docs.paymentwall.com/integration/direct/brick/sandbox                                               | Test cards and CVV-triggered outcomes                                                                                          |
| https://docs.paymentwall.com/integration/checkout-home                                                      | Checkout API flow                                                                                                              |
| https://docs.paymentwall.com/integration/checkout/onetime                                                   | Checkout one-time, pingback sample                                                                                             |
| https://docs.paymentwall.com/integration/checkout/subscription                                              | Checkout subscription pingback sample (`slength=3&speriod=day`)                                                                |
| https://docs.paymentwall.com/integration/widget-home                                                        | Widget API flow                                                                                                                |
| https://docs.paymentwall.com/integration/widget/digital-goods                                               | Digital Goods widget, pingback sample                                                                                          |
| https://docs.paymentwall.com/payment-method/credit-card                                                     | Card method facts (chargebacks, refunds, 180 days, acquiring banks)                                                            |
| https://docs.paymentwall.com/guides/industry-requirements                                                   | E-commerce auth/capture split, 7-day hold                                                                                      |
| https://docs.paymentwall.com/guides/review/business                                                         | Business review, restricted models                                                                                             |
| https://docs.paymentwall.com/apis                                                                           | API reference: Brick charge/subscription objects, Mobiamo, MINT, Cancellation, Delivery Confirmation, Payment Status, Tokidoki |
| https://www.paymentwall.com/                                                                                | Company site, industry list                                                                                                    |
| https://www.paymentwall.com/en/about                                                                        | Company profile, offices                                                                                                       |
| https://www.paymentwall.com/industries/video-games                                                          | Terminal3 "Powered by Paymentwall"                                                                                             |
| https://www.paymentwall.com/industries/e-commerce                                                           | E-commerce sector page                                                                                                         |
| https://www.paymentwall.com/industries/saas                                                                 | SaaS sector page                                                                                                               |
| https://www.paymentwall.com/en/industries/travel                                                            | Travel sector page                                                                                                             |
| https://www.paymentwall.com/industries/enterprise                                                           | Enterprise sector page                                                                                                         |
| https://www.paymentwall.com/en/terms                                                                        | Terms of Service (Paymentwall Inc., Acquirer, Brick Services)                                                                  |
| https://www.paymentwall.com/en/faq/restricted-business-models                                               | Prohibited business list                                                                                                       |
| https://www.paymentwall.com/faq/sanctioned-countries-and-entities                                           | Sanctioned countries and regions                                                                                               |
| https://docs.terminal3.com/                                                                                 | Terminal3 docs landing (same API families)                                                                                     |
| https://docs.terminal3.com/reference/pingback-home                                                          | Same pingback types; older IP list                                                                                             |
| https://docs.terminal3.com/integration/direct/brick/error-codes                                             | Same Brick code list as Paymentwall                                                                                            |
| https://api.github.com/repos/paymentwall/paymentwall-php                                                    | Repo metadata (not archived, pushed 2026-03-06)                                                                                |
| https://api.github.com/repos/paymentwall/paymentwall-node                                                   | Repo metadata (not archived, pushed 2026-04-25)                                                                                |
| https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Pingback.php           | Pingback type constants, signature field sets, IP whitelist                                                                    |
| https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Signature/Pingback.php | Pingback signature algorithm                                                                                                   |
| https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/ApiObject.php          | SDK wrapping of error/3DS responses                                                                                            |
| https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Charge.php             | `risk == 'pending'` means under review                                                                                         |
| https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Response/Error.php     | SDK error envelope                                                                                                             |
| https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/OneTimeToken.php       | Live tokenization host `pwgateway.com`                                                                                         |
| https://raw.githubusercontent.com/paymentwall/paymentwall-node/master/lib/Pingback.js                       | Node pingback types (0, 1, 2 only), Brick signature field set                                                                  |

---

## 2. Qualification gate

| #   | Item                         | Answer | Evidence                                                                                                                                                                                                             |
| --- | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company active               | yes    | paymentwall.com/en/about: global payments platform, offices listed; SDK repos pushed 2026 and not archived                                                                                                           |
| 2   | Service operational          | yes    | Docs list live endpoints `https://api.paymentwall.com/api/brick/charge` etc. (/apis); site offers sign-up and consultation. Not verified by calling (out of scope)                                                   |
| 3   | Docs accessible              | yes    | docs.paymentwall.com and /apis are public. Merchant Area (keys, pingback settings, Test Pingback Tool) needs login                                                                                                   |
| 4   | API families identified      | yes    | Checkout API, Widget API (Digital Goods, Virtual Currency, Tokidoki), Brick Direct, Mobiamo, MINT, Pingback, Delivery Confirmation, Payment Status, Cancellation. No API version numbers; signature versions 2 and 3 |
| 5   | Offline examination possible | yes    | Pingback query-string samples, Brick error JSON sample, charge/subscription/one-time-token object samples, 3DS response samples                                                                                      |
| 6   | Sectors documented           | yes    | Industry pages: video games, e-commerce, travel, SaaS, enterprise (section 3)                                                                                                                                        |
| 7   | Regional limits identified   | yes    | Sanctioned countries/regions page; restricted business list                                                                                                                                                          |
| 8   | Diagnostic value             | yes    | 61 Brick codes, 11 pingback types, 12 negative reasons, plus Mobiamo/MINT tables                                                                                                                                     |
| 9   | Own technical format         | yes    | Own pingback, signature and Brick JSON formats. Terminal3 is a Paymentwall spin-out with the same formats                                                                                                            |
| 10  | No credentials needed        | yes    | All examples are in public docs and SDK source                                                                                                                                                                       |

Outcome: items 1-5, 8, 9, 10 are yes, so **`documentation_verified`**.

---

## 3. Classification and documented sectors

| Value                           | Evidence                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gateway`                       | Brick "is a pure credit card payment solution provided by Paymentwall", used as the card gateway inside Widget and Checkout (brick-home)                                             |
| `card_processing`               | Brick charge, capture, void, refund endpoints (/apis); "Connect to Local Acquiring" (home page)                                                                                      |
| `alternative_payment_method`    | "more than 150 local payment methods, including e-wallets, bank transfers, prepaid cards, and cash options" (home); Mobiamo carrier billing, MINT prepaid ePINs (/apis)              |
| `payment_facilitator` (unclear) | Terms are between merchant and "Paymentwall Inc."; they refer to "Paymentwall's Acquirer" and blended MSC fees for Brick. Consistent with a facilitator model but not stated as such |
| Not claimed                     | `acquiring` (an external Acquirer is referenced), `wallet` (FasterPay is mentioned as a cooperating brand, not documented here), `orchestration`                                     |

Sectors, only as Paymentwall states them:

| Sector                          | Source                                                                                                       | Short quote                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video games                     | https://www.paymentwall.com/industries/video-games                                                           | "Powered by Paymentwall, Terminal3 is a payment platform tailored exclusively to boost your sales" in games; also "Terminal3 is a local reseller of the game" (Bandai Namco case) |
| E-commerce (physical goods)     | https://www.paymentwall.com/industries/e-commerce, https://docs.paymentwall.com/guides/industry-requirements | "E-Commerce Payment Solutions"; "For E-commerce merchants selling physical products ..."                                                                                          |
| Travel                          | https://www.paymentwall.com/en/industries/travel                                                             | "Travel and Booking Payment Solutions"                                                                                                                                            |
| SaaS / subscriptions            | https://www.paymentwall.com/industries/saas                                                                  | "Flexible subscription and recurring billing plans"                                                                                                                               |
| Enterprise                      | https://www.paymentwall.com/industries/enterprise                                                            | "Enterprise Payment Solutions", white-label commerce tools                                                                                                                        |
| Digital goods, virtual currency | https://docs.paymentwall.com/integration/widget-home                                                         | Widget API types "Digital Goods or Virtual Currency"                                                                                                                              |

Not stated anywhere read: adult, gambling, dating, crypto as accepted sectors. The about page lists awards from dating-industry events; that is not a sector statement and is not treated as one. Eligibility depends on jurisdiction, licensing and underwriting, and approval for one sector does not imply another.

Regional and regulatory limitations:

- Sanctions page: "Paymentwall is a regulated financial institution operating worldwide" (no regulator named); may restrict businesses in 25 listed countries (e.g. Cuba, Iran, North Korea, Russia, Syria) and the regions Crimea, Donetsk, Luhansk, Kherson, Zaporizhzhia (https://www.paymentwall.com/faq/sanctioned-countries-and-entities).
- Restricted business models: illegal goods, IP infringement, prohibited MLM, Forex trading/training and financial intermediaries, server/DDoS testing tools, hardware repairs, no-value-added services; list "is not inclusive" (https://www.paymentwall.com/en/faq/restricted-business-models).
- Cards: "Globally except sanctioned countries and entities"; processing currencies "Depending on acquiring banks" (credit-card page).
- Brick default limits 0.50 USD minimum and 500 USD maximum per codes 3115/3116; the charge reference says minimum USD 0.3 (inconsistency, section 12).

---

## 4. API families and versions in scope

No public API versioning. Base URL `https://api.paymentwall.com`. Signature versions 2 (MD5) and 3 (SHA-256); v1 deprecated.

| Family                      | Endpoint(s)                                                                                                                                                                                                                       | Format                                     | Priority                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| Pingback (all products)     | GET to merchant Pingback URL                                                                                                                                                                                                      | Query string                               | **1st**                            |
| Brick Direct                | `POST /api/brick/charge`, `/charge/$id/capture`, `/void`, `/refund`, `GET /charge/$id`, `POST /api/brick/subscription`, `/subscription/$id/cancel`, `POST /api/brick/tokenize`; one-time token on `pwgateway.com/api/token` (SDK) | Form-encoded request, JSON response        | **1st**                            |
| Payment Status API          | `GET /api/rest/payment`                                                                                                                                                                                                           | JSON array of `payment` objects            | 2nd                                |
| Client-side callback        | `window.postMessage`                                                                                                                                                                                                              | JSON `{event, data}`                       | 2nd                                |
| Mobiamo                     | `/api/mobiamo/token`, `/init-payment`, `/process-payment`, `/get-payment`                                                                                                                                                         | JSON                                       | 3rd                                |
| MINT                        | ePIN generation and redemption                                                                                                                                                                                                    | Envelope NOT DOCUMENTED (code tables only) | 3rd                                |
| Cancellation API            | `POST /developers/api/ticket`                                                                                                                                                                                                     | Form in, `{"result":1}` out                | Low                                |
| Delivery Confirmation       | `POST /api/delivery`                                                                                                                                                                                                              | Form in, `{"success":1}` out               | Low (merchant to Paymentwall)      |
| Widget / Checkout           | Hosted pages built from signed URLs                                                                                                                                                                                               | URL                                        | Out of scope (no response payload) |
| Tokidoki, Reporting, Coupon | `/developers/tokidoki-api/...` etc.                                                                                                                                                                                               | JSON; examples sparse                      | Out of scope                       |

Implement first: pingback query-string parsing and Brick error/charge JSON.

---

## 5. Formats

- Pingback: HTTP request to the merchant URL with parameters in the query string. The method is not stated in words; every example is a URL with a query string and the SDK samples read `$_GET` / `Request.QueryString`. Merchant answers HTTP 200 with body `OK`.
- Brick requests: form-encoded (`-d` fields), private key in header `X-ApiKey`. Responses: JSON.
- Brick error: HTTP 4xx with JSON `type`, `error`, `code` (e.g. 4007 with 401).
- Brick charge object fields: `id`, `object` (`charge`), `amount`, `amount_paid`, `currency`, `currency_paid`, `captured`, `refunded`, `risk`, `secure`, `created`, `support_link`, `card{type,last4,exp_month,exp_year,name,country,token}`.
- Brick 3DS step: `{"success":0,"secure":{"redirect":...}}` or `{"success":0,"secure":{"formHTML":...}}`.
- Subscription object: `id`, `object` (`subscription`), `active`, `started`, `expired`, `is_trial`, `period`, `period_duration`, `payments_limit`, `date_started`, `date_next`, `charges`, optional `trial{...}`.
- Mobiamo responses: JSON with `success`, `ref`, `flow`, `instructions`, `price`, `error`, `code`.
- SDK wrapper (not raw API): PHP `getPublicData()` returns `{"success":0,"error":{"message":...,"code":...}}`. Developers may paste this shape.

Example A, pingback (https://docs.paymentwall.com/integration/direct/brick/pingback):

```
http://www.yourserver.com/pingback_path?uid=pwuser&goodsid=gold_membership&slength=&speriod=&type=0&ref=b1493096790&sign_version=2&sig=d94b23ba8585f29978706dd1b153ead9
```

Example B, Brick failed payment (https://docs.paymentwall.com/integration/direct/brick/error-codes):

```json
{ "code": 3002, "error": "Wrong charge amount", "type": "Error" }
```

---

## 6. Codes

Categories and retry classes are suggestions for PandaPayLens, not Paymentwall statements. Meanings are short paraphrases; see the source URL for wording.

### 6a. Status values and pingback types

Pingback `type` (pingback-home, sandbox/pingback-tool, PHP SDK constants):

| type  | Meaning                                                                                                                       | Lifecycle mapping      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `0`   | Payment completed, deliver goods                                                                                              | succeeded              |
| `1`   | Payment confirmation for Virtual Currency API (tool page); SDK constant name `PINGBACK_TYPE_GOODWILL`, treated as deliverable | succeeded (credit)     |
| `2`   | Negative: chargeback, refund or fraud; take goods back; carries `reason`                                                      | reversed               |
| `12`  | Subscription cancelled by user (opt-in type)                                                                                  | subscription cancelled |
| `13`  | Subscription expired (opt-in)                                                                                                 | subscription expired   |
| `14`  | Renewal failed, subscription stopped (opt-in)                                                                                 | subscription failed    |
| `200` | Brick: under risk review, do not deliver                                                                                      | pending review         |
| `201` | Brick: review passed, deliver                                                                                                 | succeeded              |
| `202` | Brick: review declined, user refunded                                                                                         | declined               |
| `203` | Brick: authorization voided, no capture in time                                                                               | voided                 |
| `220` | Partial refund successful                                                                                                     | partially refunded     |

Negative pingback `reason` (type=2): `1` chargeback; `2` card fraud (ban user); `3` other fraud (ban user); `4` bad data entry; `5` fake/proxy user; `6` rejected by advertiser; `7` duplicate conversions; `8` goodwill credit taken back; `9` cancelled order e.g. refund; `10` partially reversed; `11` PayPal e-check fail; `12` non-collection. Custom params `CHARGEBACK_TYPE` (`refund` / `chargeback`) and `CHARGEBACK_REASON_VERBAL` can add text.

Charge `risk`: `approved` documented; `pending` only in PHP SDK (`isUnderReview`). Other values NOT DOCUMENTED. Mobiamo `flow`: `code`, `msisdn`, `redirect`. Delivery statuses (merchant-sent): `order_placed`, `order_preparing`, `package_prepared`, `order_shipped` (was `delivering`), `out_for_delivery` (was `started`), `delivered`, `consumed`, `waiting_user_action`, `delayed`, `failed_will_retry`, `order_cancelled`, `retry_started`, `refund_requested`, `refund_request_declined`, `refund_request_accepted`, `refund_issued`, `cancelled_subscription`, `substitution_requested`, `substitution_accepted`, `substitution_declined`. Cancellation ticket `type`: `1` refund, `2` recurring cancellation, `3` other, `5` partial refund.

### 6b. Brick one-time token errors (7)

| Code         | Meaning                    | Category             | Retry                           |
| ------------ | -------------------------- | -------------------- | ------------------------------- |
| `200`        | Empty request              | invalid_request      | do_not_retry                    |
| `223`        | Expiry empty/invalid       | invalid_request      | customer_action_required        |
| `224`        | Card number empty/invalid  | invalid_request      | customer_action_required        |
| `225`        | CVV empty/invalid          | invalid_request      | customer_action_required        |
| `231`, `700` | Internal error             | provider_unavailable | safe_to_retry_technical_request |
| `2111`       | Public key missing/invalid | configuration        | do_not_retry                    |

### 6c. Brick failed payment errors (54)

| Code(s)                                                        | Meaning                                                                                            | Category                   | Retry                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `1000`                                                         | Internal error                                                                                     | provider_unavailable       | safe_to_retry_technical_request |
| `1001`                                                         | Project not loaded, check credentials                                                              | configuration              | do_not_retry                    |
| `1003`                                                         | Payment method not active                                                                          | configuration              | do_not_retry                    |
| `3000`                                                         | Charge not found                                                                                   | invalid_request            | do_not_retry                    |
| `3001`                                                         | Permission denied                                                                                  | configuration              | do_not_retry                    |
| `3002`                                                         | Wrong charge amount                                                                                | invalid_amount             | do_not_retry                    |
| `3003`                                                         | Card number missing/invalid                                                                        | invalid_request            | customer_action_required        |
| `3004`, `3005`, `3006`                                         | Expiry month / year / date invalid                                                                 | invalid_request            | customer_action_required        |
| `3008`                                                         | Required fields missing                                                                            | invalid_request            | do_not_retry                    |
| `3009`                                                         | Billing address invalid                                                                            | invalid_request            | customer_action_required        |
| `3010`                                                         | Contact issuer to approve                                                                          | card_declined              | customer_action_required        |
| `3011`                                                         | Contact issuer about balance                                                                       | insufficient_funds         | customer_action_required        |
| `3012`                                                         | Declined                                                                                           | card_declined              | retry_conditionally             |
| `3013`                                                         | Declined, card issue                                                                               | card_declined              | customer_action_required        |
| `3014`                                                         | Wrong CVV                                                                                          | card_declined              | customer_action_required        |
| `3101`                                                         | Verify card number                                                                                 | invalid_request            | customer_action_required        |
| `3102`                                                         | Expired card                                                                                       | card_declined              | customer_action_required        |
| `3103`                                                         | Card brand not supported                                                                           | payment_method_unavailable | customer_action_required        |
| `3104`                                                         | Card country not supported                                                                         | payment_method_unavailable | customer_action_required        |
| `3111`, `3112`, `3114`                                         | Token not found / one-time token invalid / token deleted                                           | invalid_request            | do_not_retry                    |
| `3113`                                                         | Test credentials invalid                                                                           | configuration              | do_not_retry                    |
| `3115`, `3116`                                                 | Amount below minimum / above maximum                                                               | invalid_amount             | do_not_retry                    |
| `3200`                                                         | Retry or use another card                                                                          | card_declined              | retry_conditionally             |
| `3201`                                                         | Already fully refunded                                                                             | invalid_request            | do_not_retry                    |
| `3202`                                                         | Cannot cancel                                                                                      | invalid_request            | do_not_retry                    |
| `3203`                                                         | Not found or already captured                                                                      | invalid_request            | do_not_retry                    |
| `3204`                                                         | Cannot refund                                                                                      | invalid_request            | manual_review                   |
| `3205`                                                         | Duplicate charge                                                                                   | duplicate_request          | do_not_retry                    |
| `3206`                                                         | Authorization expired                                                                              | invalid_request            | do_not_retry                    |
| `3301`-`3306` (`3301`, `3302`, `3303`, `3304`, `3305`, `3306`) | Check first name / last name / address / city / state / ZIP                                        | invalid_request            | customer_action_required        |
| `3401`, `3402`, `3403`, `3404`, `3405`, `3406`, `3407`, `3408` | Subscription period, not found, duration, trial params/period/duration/amount, retry count invalid | invalid_request            | do_not_retry                    |
| `4004`, `4005`                                                 | Undefined method / empty request                                                                   | invalid_request            | do_not_retry                    |
| `4006`, `4007`                                                 | API key missing / invalid                                                                          | configuration              | do_not_retry                    |
| `4008`                                                         | Decryption failed                                                                                  | configuration              | do_not_retry                    |
| `5000`                                                         | Customer not allowed to pay                                                                        | fraud_or_risk              | do_not_retry                    |

Sandbox CVVs (not codes): `111` CVV error, `222` balance, `333` issuer approval, `555` review then accept, `556` review then decline.

### 6d. Mobiamo response codes (10)

| Code        | Meaning                                      | Category              | Retry                           |
| ----------- | -------------------------------------------- | --------------------- | ------------------------------- |
| `W1`        | Session expired                              | authentication_failed | safe_to_retry_technical_request |
| `W3`, `W4`  | Wrong secret key / project key               | configuration         | do_not_retry                    |
| `W5`, `W13` | Key or uid missing / bad params              | invalid_request       | do_not_retry                    |
| `W14`       | Price not found                              | invalid_amount        | do_not_retry                    |
| `W15`       | Service unavailable                          | provider_unavailable  | retry_conditionally             |
| `W16`       | Payment system blocked for user              | fraud_or_risk         | do_not_retry                    |
| `18`        | Signature invalid (no `W` prefix as printed) | configuration         | do_not_retry                    |
| `W19`       | API not activated                            | configuration         | do_not_retry                    |

### 6e. MINT ePIN generation errors (16)

| Code                         | Meaning                                                       | Category             | Retry               |
| ---------------------------- | ------------------------------------------------------------- | -------------------- | ------------------- |
| `1`                          | Service access error                                          | configuration        | do_not_retry        |
| `2`, `8`                     | Generation error / service not loaded                         | provider_unavailable | retry_conditionally |
| `3`, `10`                    | Not enough balance / balance limit exceeded                   | insufficient_funds   | manual_review       |
| `4`, `5`                     | Check amount / below minimum                                  | invalid_amount       | do_not_retry        |
| `6`, `7`, `9`                | Wrong ePIN data / wrong currency / currency not allowed       | invalid_request      | do_not_retry        |
| `-32000`                     | Authentication error                                          | configuration        | do_not_retry        |
| `-32001`, `-32005`, `-32007` | Partner type missing / API type not allowed / bad API version | configuration        | do_not_retry        |
| `-32004`                     | Method unsuccessful                                           | unknown              | unknown             |
| `-32006`                     | Invalid params                                                | invalid_request      | do_not_retry        |

### 6f. MINT redemption errors (19)

| Code                           | Meaning                                                   | Category                   | Retry                           |
| ------------------------------ | --------------------------------------------------------- | -------------------------- | ------------------------------- |
| `1001`                         | General internal error                                    | provider_unavailable       | safe_to_retry_technical_request |
| `1002`, `3001`                 | Application not loaded / MINT not active for project      | configuration              | do_not_retry                    |
| `1003`                         | User banned                                               | fraud_or_risk              | do_not_retry                    |
| `2001`, `2002`, `2005`, `2006` | Empty ePIN / empty key / ePIN not array / empty user id   | invalid_request            | do_not_retry                    |
| `2003`, `2004`                 | Wrong amount / wrong currency                             | invalid_amount             | do_not_retry                    |
| `3002`, `3003`, `3005`, `3006` | ePIN expired / not activated / not for this app / invalid | payment_method_unavailable | customer_action_required        |
| `3004`                         | Duplicate ePIN                                            | duplicate_request          | do_not_retry                    |
| `3007`                         | Only one ePIN allowed                                     | invalid_request            | customer_action_required        |
| `3008`                         | Tracking failure                                          | unknown                    | manual_review                   |
| `3009`                         | Insufficient ePIN funds                                   | insufficient_funds         | customer_action_required        |
| `4001`                         | Max attempts exceeded                                     | rate_limiting              | do_not_retry                    |

### 6g. Widget errors

Nine message strings without codes (price limits, domain not approved, wrong key pair, key/uid missing, wrong widget type x2, widget missing, `ps` required, payment system blocked). Text matching only; low value.

---

## 7. Lifecycle

- **Card (Brick) payment**: charge -> captured (`captured=true`), or `risk=pending` -> pingback `200` -> `201` (deliver) or `202` (declined, money back). With `options[capture]=0`: authorized, hold 7 days, then capture, void, or auto-void (pingback `203`). 3DS adds a `secure` step and a second charge with `charge_id` + `secure_token`.
- **E-commerce physical goods**: authorization only; capture happens when Delivery Confirmation reports shipping; auto-void after 7 days (industry-requirements).
- **Refund**: Brick `/refund` (charge `refunded=true`); Cancellation API ticket types 1/5; pingback `2` (reason `9`) for full, `220` for partial. Card refund window 180 days.
- **Chargeback**: pingback `type=2`, `reason=1`; fraud reasons `2`/`3`.
- **Subscription**: each billing sends a new pingback (`type=0`, `slength`/`speriod`); failed renewal gets 2 reattempts (3 total), then stop and type `14`; expiry type `13`; user cancel type `12` (12-14 need activation). Tokidoki cancel immediately (`cancel_type=0`) or at period end (`1`).
- **Mobiamo**: init -> process (one or more `flow` steps) -> `completed` true/false.
- **Payout, wallet transfer**: NOT DOCUMENTED.

---

## 8. Notifications

| Aspect                | Finding                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport             | HTTP request to Pingback URL, query string. Content type not applicable (no body); method not stated in words                                                                                                                                                                                                                                     |
| Core fields           | `uid`, `type`, `ref`, `sign_version`, `sig`, `is_test` (test only); Digital Goods adds `goodsid`, `slength`, `speriod`; Virtual Currency adds `currency` (virtual amount); negative adds `reason`                                                                                                                                                 |
| Custom fields         | Configured in Merchant Area: `OWN` merchant params plus provider values (`REFERENCE_ID`, `UNIQUE_REF`, `UNIQUE_REF_INITIAL`, `PAYMENT_DATETIME`, `CURRENCY_CODE`, `REVENUE*`, `SUBSCRIPTION_ID`, `RECURRING_*`, `USER_IP`, `COUNTRY_CODE` ...) under merchant-chosen names                                                                        |
| Signature (sensitive) | `sig`. v2: MD5 of all params except `sig`, sorted by name, concatenated `name=value` with no separator, then project secret key appended; lowercase hex. v3: same with SHA-256. v1 (deprecated): fixed fields only (SDK: `uid, goodsid, slength, speriod, type, ref`, VC: `uid, currency, type, ref`). Node SDK drops `goodsid` from v1 for Brick |
| Acknowledgement       | HTTP 200 with body `OK`                                                                                                                                                                                                                                                                                                                           |
| Retry                 | Resent within 30 minutes, then every 30 minutes; maximum NOT DOCUMENTED                                                                                                                                                                                                                                                                           |
| Ordering              | NOT DOCUMENTED                                                                                                                                                                                                                                                                                                                                    |
| Duplicates            | Store `ref`; for type 0 refuse a repeated `ref`. SDK unique id is `ref` + `_` + `type` (same as `UNIQUE_REF`, e.g. `b1493096790_0`)                                                                                                                                                                                                               |
| Source IPs            | `216.127.71.0/24`; SDK and Terminal3 docs also list 174.36.92.186, .187, .192, 174.36.96.66, 174.37.14.28 (legacy)                                                                                                                                                                                                                                |
| Other channels        | Client-side `postMessage` events: `paymentSuccess`, `widgetLoaded`, `widgetSizeChanged`, `paymentProcessingStart`, `paymentProcessingEnd`                                                                                                                                                                                                         |

---

## 9. Identifiers

| Identifier                  | Field                                                                                                                                                   | Notes                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Paymentwall transaction ref | `ref` (pingback), `id` (Payment Status, `paymentSuccess`), `payment_id` (Delivery API)                                                                  | Examples `b1493096790`, `b123456`, `t1234`, `w123456789`; prefix meaning NOT DOCUMENTED |
| Brick charge id             | `id` (charge object), `brick_charge_id`, `charge_id`                                                                                                    | Numeric string `104872652`; relation to pingback `ref` NOT DOCUMENTED                   |
| Original / parent           | `recurring_id` (ref of initial charge), `RECURRING_BILLING_INITIAL_REF`, `UNIQUE_REF_INITIAL` (chargeback -> original)                                  | Custom params are opt-in                                                                |
| Subscription                | `id` (subscription object, e.g. `VCBZT392SW`), `SUBSCRIPTION_ID`, `charges` list; Tokidoki `subscription_id` (numeric)                                  |                                                                                         |
| Merchant reference          | `uid` (user, defaults to email for Brick), `goodsid` / `plan` / `ag_external_id` (product), `merchant_reference_id` (Delivery API), `OWN` custom params | No dedicated order-id field in pingbacks                                                |
| Mobiamo                     | `ref`                                                                                                                                                   |                                                                                         |
| Tokens                      | `ot_...` one-time token, `card[token]` permanent token                                                                                                  | Sensitive                                                                               |

---

## 10. Sensitive fields

`sig`, `sign`, project secret key, `X-ApiKey` header, Mobiamo JWT `token` / `Token` header, one-time `token` (`ot_...`), permanent `card[token]`, `brick_secure_token` / `secure_token`, `fingerprint` / `brick_fingerprint`, `formHTML` (contains `PaReq`, `MD`), `support_link`, `email`, `uid` (may be email), `USER_IP`, `browser_ip`, `msisdn`, `card[name]`, `card[bin]`, `card[last4]`, `card[exp_month]`, `card[exp_year]`, `customer[firstname]`, `customer[lastname]`, `shipping_address[*]`, `received_by`. Project key (`key`, `public_key`, test keys shown as `t_...` in a docs sample) is not secret but should still be masked.

---

## 11. Structural detection hints

Strong Paymentwall signals:

1. Query string with `uid`, `type`, `ref`, `sig` and usually `sign_version` (2/3), `goodsid`, `slength`, `speriod` (empty allowed). `sig` is 32 hex (v2) or 64 hex (v3).
2. `ref` like `b` + digits, and `type` in {0,1,2,12,13,14,200-203,220}; `reason` 1-12 with `type=2`.
3. Brick error JSON with exactly `type: "Error"`, `error` (string), `code` (number in 1000-5000 range).
4. Charge JSON with `object: "charge"` plus `amount_paid`, `currency_paid`, `risk`, `support_link`, `card.token`; `amount` is a decimal string.
5. `secure.redirect` / `secure.formHTML` with `success: 0`; hosts `api.paymentwall.com`, `pwgateway.com`, `/api/brick/`.
6. Mobiamo codes `W1`...`W19`; `paymentSuccess` postMessage with `payment_system`.

Differences from supported providers:

- **Stripe**: also uses `object: "charge"`, `id`, `captured`, `refunded`. Stripe ids are prefixed (`ch_`, `pi_`) and amounts are integer minor units; Paymentwall ids are numeric strings, amounts decimal strings, and it has `risk`, `amount_paid`, `currency_paid`, `support_link`. Stripe errors nest under `error.type`/`error.code` strings, not top-level `type: "Error"`.
- **payabl.**: also URL-encoded with `type`, but uses `transactionid`, `errorcode`, `errormessage`, `security`, `orderid`; no `uid`/`ref`/`sig`.
- **Adyen, Checkout.com, PayPal, Braintree, Mollie, Square**: JSON bodies with their own keys (`pspReference`/`eventCode`, `event_type`, `resource`, etc.); none use a `uid`+`ref`+`sig` query string.
- **Other candidates** (emerchantpay, Ecommpay, NMI, MiFinity, AstroPay, Skrill): their formats were not verified in this research; the combination `uid` + `goodsid` + `slength` + `speriod` + `ref` + `sig` should be checked against their research files, but no overlap is expected. Generic keys such as `type`, `ref`, `status`, `code` alone must not trigger Paymentwall.
- **Terminal3**: same formats (same Brick code list and pingback types on docs.terminal3.com). A pasted payload cannot be told apart; treat as Paymentwall family.

---

## 12. Limitations, ambiguities, inconsistencies

1. Overlapping code values: Brick `1001`, `1003`, `3001`-`3006`, `3008`, `3009` mean different things in MINT redemption; `200` is a token error and a pingback type (and the HTTP success code). Decode only with context (response shape, endpoint, field name).
2. Pingback type `1`: test tool says Virtual Currency payment; SDK names it GOODWILL; main pingback page omits it.
3. Type `220` (partial refund) is on the docs page but not in SDK constants; Node SDK only knows 0, 1, 2.
4. Charge sample includes `object` and `card.last4`, which are not in the attribute table; `risk` values beyond `approved` are only implied by SDK (`pending`).
5. Minimum amount: charge reference says USD 0.3; error 3115 says default minimum 0.50 USD.
6. The same `sig` value `d94b23ba...` appears in pingback samples with different parameters, so samples are placeholders and cannot be used as signature test vectors.
7. Docs 3DS samples (`success`, `secure`) resemble the SDK `getPublicData()` envelope; whether the raw API returns `success` is unclear.
8. Relation between Brick charge `id` (numeric) and pingback `ref` (`b...`) is NOT DOCUMENTED; ref prefixes `b`, `t`, `w` are unexplained.
9. Pingbacks carry no timestamp or event id unless custom params are configured; retry maximum and ordering NOT DOCUMENTED.
10. Pingback field names can be renamed by the merchant (custom params), so field presence varies.
11. MINT and Mobiamo error envelopes are only partly shown (Mobiamo: `error`, `code`; MINT: NOT DOCUMENTED).
12. Widget errors have no codes.
13. Merchant Area content (Test Pingback Tool output, project settings) was not examined (login required).
14. Payouts are NOT DOCUMENTED.

---

## 13. Proposed capability statuses

| Capability       | Status    | Justification                                                                                                                                                                    |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | supported | 61 Brick codes with clear meanings in one JSON shape, plus Mobiamo and MINT tables; collisions handled by shape/context with `unknown` fallback                                  |
| paymentResponses | limited   | Brick error, charge, subscription and 3DS shapes are exemplified, but there is no single status field, `risk` values are under-documented and MINT/Mobiamo envelopes are partial |
| webhookParsing   | supported | Pingback query string is simple and well documented (fields, 11 types, 12 reasons, ack, retry); caveat: merchant-renamed custom fields                                           |
| timeline         | limited   | Types give clear states (200 -> 201/202, 0 -> 2/220, 12/13/14), but no default timestamps, ordering not documented, retries repeat the same event                                |
| correlation      | limited   | `ref` links pingbacks and APIs; `UNIQUE_REF_INITIAL`, `RECURRING_BILLING_INITIAL_REF`, `recurring_id` exist but are opt-in; charge `id` vs `ref` relation unknown                |
