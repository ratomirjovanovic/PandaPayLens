# Verotel (adapter id `verotel`): high-risk provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Verotel's first-party documentation, its official website and its official client libraries as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**. Suggested categories and retry classes are suggestions, not Verotel statements.

- Verification date: **2026-10-25**
- Gate outcome: **`documentation_verified`** (see section B)
- Method: public pages were downloaded and read in full. The FlexPay v4 documentation is a static Slate site; the Control Center API documentation is an apidoc.js site whose endpoint data lives inside its JavaScript bundle, which was extracted and read for every version (1.1.0 to 2.0.0). Official PDFs were converted to text. The two official client libraries were cloned and their source and tests were read. No login, signup or access request was made. No provider endpoint was called.

---

## A. Sources

All URLs below were read on 2026-10-25.

| URL                                                                              | Server date / version                                     | What it covers                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://www.verotel.com/en/integration.html                                      | site footer "(c) 2023"                                    | Entry page: VerotelRUM, FlexPay, Control Center API, OpenAffiliate; links to all PDFs and to the API docs                                                                          |
| https://www.verotel.com/ (redirects to /en/index.html?lang=en)                   | n/a                                                       | Positioning ("High-Risk Webmasters", "Adult? No problem!")                                                                                                                         |
| https://www.verotel.com/en/paymentprocessing.html                                | n/a                                                       | Company history, licences, payment options, currencies, security policy                                                                                                            |
| https://www.verotel.com/en/pricechart.html                                       | n/a                                                       | Account types, Payment Facilitator statement, payment methods, Direct Debit countries, chargeback ratio rules                                                                      |
| https://www.verotel.com/en/productchoice.html                                    | n/a                                                       | BASIC vs PREMIUM (FlexPay, webcam billing)                                                                                                                                         |
| https://www.verotel.com/en/merchantagreement.html                                | sample agreement                                          | Legal entity (Yoursafe B.V.), acquirer registration by power of attorney, high-risk country blocking, Dutch law, holdback                                                          |
| https://www.verotel.com/en/contactus.html                                        | n/a                                                       | Legal entity and trade name, support channels                                                                                                                                      |
| https://www.verotel.com/verotel_flexpay_apidescription_v0300_rev100.pdf          | FlexPay v3, rev 1.00                                      | Legacy FlexPay purchase and subscription API, postbacks (initial, rebill, cancel, uncancel, extend, expiry), status page with full text examples, SHA-1 signature                  |
| https://www.verotel.com/veroteldoc_FlexPayAPIv3.4SubscriptionUpgrade.pdf         | v1.1, 16/11/2016                                          | `upgradesubscription` request, `upgrade` postback                                                                                                                                  |
| https://www.verotel.com/veroteldoc_FlexPayAPIv3.xPurchaseOneClick.pdf            | v1.2.1, 20/10/2016                                        | One Click purchase, `oneClickToken` lifecycle                                                                                                                                      |
| https://www.verotel.com/verotel_rumdescription_v0800_rev097.pdf                  | RUM description v0800 rev097                              | Remote User Manager postbacks (`trn=add/rebill/cancel/modify/delete`), expected responses, retry rule                                                                              |
| https://controlcenter.verotel.com/flexpay-doc/ and `homepage.html`               | Last-Modified 2026-02-09                                  | FlexPay doc index; changelog "Version 4.0 (Feb 2024)"                                                                                                                              |
| https://controlcenter.verotel.com/flexpay-doc/purchase.html                      | Last-Modified 2026-02-09, "version 4"                     | **Current** FlexPay purchase: request, success redirect, success/credit/chargeback postbacks, status page, One Click, signature (SHA-256), brand base URLs                         |
| https://controlcenter.verotel.com/flexpay-doc/subscription.html                  | Last-Modified 2026-02-09, "version 4"                     | **Current** FlexPay subscription: request, postbacks (initial, rebill, extend, downgrade, cancel, uncancel, expiry, credit, chargeback, upgrade), status page, cancel URL, upgrade |
| https://controlcenter.verotel.com/flexpay-doc/yoursafe_direct.html               | Last-Modified 2026-02-09                                  | YoursafeDirect brand purchase (iDEAL, CPSP fields), full list of signed parameters                                                                                                 |
| https://controlcenter.verotel.com/api-doc/index.html (+ `assets/main.bundle.js`) | Last-Modified 2026-10-22; API 2.0.0 (also 1.1.0 to 1.6.0) | **Control Center API**: auth, content negotiation, HTTP status rules, rate limit, every endpoint with field tables, success and error examples                                     |
| https://github.com/verotel/flexpay-php-client (commit 476011c, 2024-08-27)       | protocol version 4                                        | Official PHP client (linked from the FlexPay docs): signature algorithm, brand table, merchant ID prefixes, postback example                                                       |
| https://github.com/verotel/flexpay4j (commit c6fff49, 2026-07-30)                | 2.3.0 (Jul 2026)                                          | Official Java/Kotlin client (linked from the FlexPay docs): signed-parameter list, SHA-256 with SHA-1 fallback, brands incl. Yoursafe Pay                                          |
| https://api.github.com/orgs/verotel                                              | n/a                                                       | GitHub org "Verotel", blog field `http://www.verotel.com/` (the FlexPay docs link to both repos, which confirms they are official)                                                 |

Downloaded but not reviewed (out of scope): `verotel_openaffiliatedescription_v0200_rev100.pdf` (affiliate program). Not downloaded: the VerotelRUM ASP/Perl library zips.

---

## B. Qualification gate

| #   | Item                                                                    | Answer                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active                                        | **yes**                | Control Center API docs served with Last-Modified 2026-10-22; FlexPay docs Last-Modified 2026-02-09 with a "Version 4.0 (Feb 2024)" changelog; flexpay4j README changelog "Version 2.3.0 (Jul 2026) - Added support for Yoursafe Pay brand", last commit 2026-07-30. Website live with "Apply today!" flows. (Website footer still says "(c) 2023", so the marketing site is less maintained than the docs.)                                                                                                                                                                                                                                                                    |
| 2   | Payment service operational                                             | **yes** (indirect)     | Same evidence as item 1: current, versioned documentation and an official client released in Jul 2026. No live endpoint was called, by design.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Developer docs publicly or legitimately accessible                      | **yes**                | Public without login: FlexPay v4 docs (`controlcenter.verotel.com/flexpay-doc/`), Control Center API docs (`controlcenter.verotel.com/api-doc/`), legacy PDFs on verotel.com, both client repos. Behind the merchant login (not accessed): the Control Center itself (postback URL setup, signature key, API users, "postbacks version 2" setting). The integration page also says that "the latest documentation can be found in the Verotel Control Center under Setup Websites"; the public v4 site appears to be that documentation, but this cannot be confirmed without a login. The content policy is "sent on request" (merchant agreement) and was not found publicly. |
| 4   | API families and versions identified                                    | **yes**                | FlexPay protocol `version=4` (legacy 3, 3.2 One Click, 3.3, 3.4 upgrade); FlexPay postbacks (doc mentions "postbacks version 2"); FlexPay status page; Control Center API `Accept: application/json; version=2.0.0` (older 1.1.0 to 1.6.0 still documented); VerotelRUM postbacks (doc v0800 rev097). See section 2.                                                                                                                                                                                                                                                                                                                                                            |
| 5   | Responses/notifications can be examined offline                         | **yes**, with a caveat | Every postback has a documented field table and fixed `event` values; Control Center API has JSON success and error examples; status page has full text examples (v3 PDF); RUM has literal example URLs. Caveat: **no literal FlexPay postback query string is published**; the format is defined only by field tables plus the statement "Postback data are sent as GET request".                                                                                                                                                                                                                                                                                              |
| 6   | Merchant sectors documented by the provider                             | **yes**                | See section D. Verotel names adult, online entertainment, cam/webcam, pay-per-view, pay-per-download, token systems, shopping carts (incl. tangible goods) and membership/subscription sites.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7   | Regional/regulatory limitations identified                              | **yes** (partial)      | Dutch licensing and law, high-risk country blocking at Verotel's discretion, Direct Debit Europe country and currency limits, sale and payout currency lists. See section E.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 8   | Adapter gives actual diagnostic value                                   | **yes**                | Rich subscription lifecycle (11 postback kinds with `event`, `cancelledBy`, `subscriptionPhase`, `parentID`, `precededBySaleID`), Control Center API error envelope with HTTP status and title, transaction types/subtypes, reversal state. Error decoding is thin: there is no public decline code table (one decline category example only).                                                                                                                                                                                                                                                                                                                                  |
| 9   | Own technical format, not a reseller of a supported gateway             | **yes**                | Verotel publishes its own protocol (FlexPay), its own postback vocabulary and its own JSON API. The merchant agreement states it engages "acquiring banks, internet payment service providers and others" to process transactions, but none of those formats are exposed to merchants. Several brands (CardBilling, GayCharge, YoursafeDirect, BitsafePay, Bill, PaintFest, Yoursafe Pay) share the **same** FlexPay protocol on different hosts; they are Verotel's own brands per its official clients, not third-party gateways.                                                                                                                                             |
| 10  | No live credentials or merchant relationship needed to analyze examples | **yes**                | All documentation and examples above are public. Signature verification needs the merchant's secret key, which PandaPayLens must not ask for.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Items 1-5, 8, 9 and 10 are yes: **`documentation_verified`**.

---

## C. Classification

| Class                           | Chosen           | Evidence                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_facilitator`           | **yes**          | paymentprocessing.html: "2012 - Verotel became Payment Facilitator with MasterCard and VISA". pricechart.html: "registered member service provider and Payment Facilitator for Visa, MasterCard, JCB, Discover and Diners Club".                                                                     |
| `merchant_account_intermediary` | **yes**          | merchantagreement.html: the merchant gives Verotel "full power of attorney and authority, to register Merchant with acquiring banks and other processors used and contracted by Company"; "Company is engaging third parties to process transactions, including but not limited to acquiring banks". |
| `card_processing`               | **yes**          | Home page: "Process credit cards for your entertainment website"; pricechart.html lists Visa, MasterCard, JCB, Discover, Diners Club.                                                                                                                                                                |
| `gateway`                       | **limited**      | Verotel provides a hosted order page (FlexPay `startorder` redirect) and a management API; there is **no** documented server-to-server card authorization API. Treat as a hosted-payment-page gateway only.                                                                                          |
| `acquiring`                     | no               | Verotel describes acquiring banks as third parties it contracts; it does not claim to be an acquirer.                                                                                                                                                                                                |
| `alternative_payment_method`    | no (offers APMs) | Verotel offers Direct Debit Europe, US Check and (YoursafeDirect brand) iDEAL through its own order page, but is not itself an APM scheme.                                                                                                                                                           |
| `wallet`                        | no               | "All Verotel accounts come with a Yoursafe Business Account" (pricechart.html) is a merchant payout account; no wallet payloads appear in FlexPay or the Control Center API.                                                                                                                         |
| `orchestration`                 | no               | Nothing documented.                                                                                                                                                                                                                                                                                  |

Legal entity: "Verotel is registered as a trade name of Yoursafe B.V. with the Chamber of Commerce in the Netherlands under number 34180575 and is wholly owned by Verotel International B.V." (contactus.html).

---

## D. Sectors (only as Verotel documents them)

Eligibility always depends on jurisdiction, licensing, card scheme rules and Verotel's underwriting; listing a sector here does not mean any given merchant will be approved, and approval for one sector does not imply another.

| Sector (as stated)                      | Source and wording                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| adult                                   | Home page: "Adult? No problem!" and "& Pay your adult talent and affiliates"                                                                                                                |
| high-risk merchants generally           | Home page: "Processing Payments for High-Risk Webmasters"; pricechart.html comparison row "High risk accepted: Yes"                                                                         |
| online entertainment / digital content  | pricechart.html: "Solutions for Webmasters selling Online Entertainment"; "the risks involved in supplying digital content and other online services"                                       |
| cam sites / webcam billing              | integration.html: FlexPay is "the perfect solution for cam sites and other token-based systems"; productchoice.html: "Webcam billing" (PREMIUM only)                                        |
| pay per view, pay per download          | integration.html and FlexPay v3 PDF list "pay per view sites", "pay per download sites"; FlexPay v4 purchase page: "PPV/VOD/CAM or token based systems"                                     |
| token / credit purchase systems         | integration.html: "token / credit purchase systems"                                                                                                                                         |
| shopping carts, incl. tangible products | FlexPay v3 PDF: "shopping cart systems (also for tangible products)"                                                                                                                        |
| subscription / membership websites      | FlexPay docs homepage: "Membership and subscription management. Ideal for membership websites"; pricechart.html: "If you are selling subscriptions online ... the Basic Account is for you" |

Not documented by Verotel and therefore **not** claimed: iGaming, travel, nutraceuticals, crypto merchants, dating. (Bitcoin appears only as a legacy buyer payment method in the v3 PDF, not as a merchant sector.)

---

## E. Regional and regulatory limitations

- Licensing as stated by Verotel (paymentprocessing.html): "2011 - Verotel was licensed as a Payment Institution by the Dutch Central Bank"; "2019 - Verotel was licensed as Electronic Money Institution". Merchant funds are held via "Stichting Geldbeheer Verotel", a third-party escrow (merchant agreement). The licence was not cross-checked in a regulator register (out of scope: first-party sources only).
- Governing law: "the laws of the Netherlands and the venue ... shall be the Netherlands"; merchants must supply documents for Dutch "Wwft and/or Wft" compliance (merchant agreement).
- "Company shall have the right, in its sole discretion, to block certain high risk countries from transaction processing" (merchant agreement). Which countries is **NOT DOCUMENTED**.
- Accepted merchants: "Worldwide" for both account types (pricechart.html).
- Sale currencies: `USD EUR GBP AUD CAD CHF DKK NOK SEK` (FlexPay v4); payouts in USD, EUR or GBP (paymentprocessing.html).
- Direct Debit Europe (`DDEU`): EUR only; FlexPay v4 says available "only in DE, AT, CH, BE, IT, NL, ES and FR"; pricechart.html adds Slovakia (inconsistency, see section 10). `DDEU` and `YOURSAFE_DIRECT` support only `one-time` subscriptions.
- FlexPay requires a PREMIUM account per productchoice.html ("Verotel FlexPay: No" for BASIC), but pricechart.html shows "Verotel FlexPay API: Yes" for both (inconsistency).
- Merchants can restrict sales to "one of the predefined territories" in Order Page options (FlexPay v3 PDF).
- One Click requires approval by Verotel (disabled by default).

---

## 1. Sources and verification date

See section A. Verification date 2026-10-25.

---

## 2. API families and versions in scope

| Family                                  | Transport / endpoint                                                                                                                             | Format                                                               | Relevance                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **FlexPay postbacks** (current v4 docs) | Verotel calls the merchant's "Flexpay postback URL" with `GET`                                                                                   | URL query string (`key=value&...`)                                   | **Primary.** All lifecycle events                                                                      |
| FlexPay success redirect ("OK data")    | Buyer browser redirected to the website's default FlexPay success URL with appended GET params (not appended when a custom `successURL` is used) | URL query string                                                     | Secondary; same vocabulary as the initial postback                                                     |
| FlexPay `startorder` request            | `GET https://secure.verotel.com/startorder?...` (other brand hosts below); `version=4`                                                           | URL query string + `signature`                                       | Secondary: developers paste these to debug signature and parameter problems                            |
| FlexPay cancel-subscription URL         | `GET {brand}/cancel-subscription?version&shopID&saleID&signature`                                                                                | URL query string                                                     | Low                                                                                                    |
| FlexPay status page                     | `GET {brand}/status/order?version&shopID&saleID                                                                                                  | referenceID&signature`(official clients use`/salestatus`)            | Plain text, one `name: value` per line; the docs say YAML and show parsing with Symfony YAML           | **Primary** for timeline/state snapshots |
| **Control Center API**                  | `https://controlcenter.verotel.com/api` + paths below; `Authorization: Basic ...`; `Accept: application/json; version=2.0.0`                     | JSON                                                                 | **Primary** for error decoding and transaction-level history                                           |
| VerotelRUM postbacks                    | Verotel calls a merchant script, e.g. `rumadd.pl?trn=add&...`                                                                                    | URL query string; merchant answers `APPROVED` / `DECLINED` / `ERROR` | Secondary (membership sites, non-FlexPay). "Verotel FlexPay does not return any VerotelRUM Postbacks." |
| Legacy FlexPay v3 (PDF)                 | Same endpoints, `version=3` / `3.2` / `3.4`                                                                                                      | Same, SHA-1 signatures                                               | Recognize for older integrations                                                                       |

Brand hosts sharing the FlexPay protocol (from the v4 docs "Payment processor" table and the official clients):

| Brand          | Base URL                               | Merchant ID prefix (official clients) | Payment methods (v4 docs)                                  |
| -------------- | -------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Verotel        | `https://secure.verotel.com`           | `9804`                                | `CC`, `DDEU`                                               |
| CardBilling    | `https://secure.billing.creditcard`    | `9762`                                | `CC`                                                       |
| GayCharge      | `https://secure.gaycharge.com`         | `9388`                                | `CC`, `DDEU`                                               |
| YoursafeDirect | `https://secure.yoursafedirect.com`    | `9001`                                | `DDEU`, `YOURSAFE_DIRECT` (and `IDEAL` without order page) |
| BitsafePay     | `https://secure.bitsafepay.com`        | `9653`                                | not in docs table                                          |
| Bill           | `https://secure.bill.creditcard`       | `9511`                                | not in docs table                                          |
| PaintFest      | `https://secure.paintfestpayments.com` | `9444`                                | not in docs table                                          |
| Yoursafe Pay   | `https://secure.yoursafe.com`          | `9147`                                | Java client only (2.3.0)                                   |

Control Center API 2.0.0 endpoints: `GET /dashboard/announcements`, `GET /dashboard/drill-down`, `GET /dashboard/totals`, `GET /sale/:id`, `GET /sale/:id/transactions`, `POST /sale/:id/cancel`, `POST /sale/:id/downgrade`, `POST /sale/:id/extend`, `POST /sale/:id/terminate`, `GET /transaction/:id`, `POST /transaction/:id/refund`, `GET /website/:id/sales`, `GET /website/:id/transactions`, `GET /websites`. (`GET /dashboard/chart` exists up to 1.6.0 only.)

**Recommendation: implement first** (a) FlexPay postback query strings (all 11 kinds), keyed on `event` + `type`, and (b) the Control Center API JSON error envelope plus the `GET /transaction/:id` and `GET /sale/:id(/transactions)` objects. Then add the status page text format, then VerotelRUM query strings.

---

## 3. Response and error formats

### 3.1 Content types

- **FlexPay postbacks**: "Postback data are sent as GET request." So the payload is the URL query string; there is no body. The merchant must answer "HTTP status code 200 and plain text "OK" response ... within 30 seconds". Character set of postback values is **NOT DOCUMENTED** (signature input must be UTF-8).
- **FlexPay success redirect**: GET params appended to the default success URL only.
- **FlexPay status page**: plain text, lines of `parameterName: parameterValue` (v3 PDF: "The date returned to the status request is in plain-text and contains lines with parameterName, colon, parameterValue"; YoursafeDirect page: "in - YAML format -").
- **Control Center API**: JSON only ("Currently only JSON (application/json) format is supported"); success headers `Content-Type: application/json; charset=utf-8` plus `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; 429 adds `Retry-After`.
- **VerotelRUM**: GET query string to the merchant script; merchant body response is one of `APPROVED`, `DECLINED`, `ERROR`.

### 3.2 Control Center API error envelope

```
{ "error": { "documentation": <string>, "status": <int>, "title": <string> } }
```

HTTP status rules (API overview): 401 authorization errors; 404 objects that do not exist; 406 content negotiation errors including a missing version; 412 "Missing parameters or application errors (e.g. "Sale already cancelled")"; 429 rate limit (500 requests per hour per customer, shared by all API users).

Some operations return HTTP 200 with a failure inside the body:

- `POST /sale/:id/terminate`: `{"sale_id":..., "is_success": false, "error": {"message": "..."}}` (note: `error.message`, not `error.title`).
- `POST /transaction/:id/refund`: `{"refund_transaction_id":..., "is_success": true, "warning": {"message": "..."}}` (refund succeeded, side effect failed).

Example (transcribed from https://controlcenter.verotel.com/api-doc/index.html, `POST /sale/:id/cancel`, version 2.0.0):

```
HTTP 412 Precondition Failed
{
    "error": {
        "documentation": "https://controlcenter.verotel.com/api-doc/index.html",
        "status": 412,
        "title": "Cancel rebilling is disabled during rebill retry period."
    }
}
```

Example (transcribed from the same page, `GET /transaction/:id`, "Successful response", a declined transaction; the `=>` is in the published example and makes it invalid JSON):

```
HTTP 200 OK
{
    "created_at": "2016-08-29T11:09:16Z",
    "decline_reason": {
        "category": "NO_FUNDS",
        "description": "Insufficient funds"
    },
    "id": 80823323,
    "reversal_extent": "NONE",
    "is_testing": false,
    "is_approved": false,
    "original_debit_transaction_id" => null,
    "payment_instrument": {
        "masked_identifier": "XXXXXXXXXXXX2222",
        "type": "CREDIT_CARD"
    },
    "payment_method": "CC",
    "price": {
        "amount": "12.1",
        "currency": "USD"
    },
    "sale": {
        "custom1": "custom-value1",
        "custom2": "custom-value2",
        "custom3": "custom-value3",
        "id": 1760,
        "type": "PURCHASE"
    },
    "transaction_subtype": "PURCHASE",
    "transaction_type": "DEBIT",
    "website_id": 65147
}
```

### 3.3 Control Center API object fields (2.0.0)

`GET /transaction/:id`: `id`, `created_at`, `website_id`, `price.amount` (string), `price.currency`, `is_approved`, `is_testing`, `payment_method`, `transaction_type`, `transaction_subtype`, `payment_instrument.type`, `payment_instrument.masked_identifier`, `decline_reason` (optional; table says `id` + `description`, example shows `category` + `description`), `reversal_extent`, `reversals[]` (`id` per table / `transaction_id` per example, `type`, `price`), `original_debit_transaction_id` (set when this transaction is a refund or chargeback), `sale.{id,type,reference_id,custom1,custom2,custom3}`.

`GET /sale/:id`: `id`, `website_id`, `sale_type` (`PURCHASE|SUBSCRIPTION`), `price`, `trial_price`, `description`, `reference_id`, `created_at`, `buyer_name`, `buyer_email`, `buyer_ip`, `country`, `address.*`, `custom1..3`, `payment_method`, `is_approved`, `is_testing`, `subscription.{is_recurring, period, is_expired, next_charge_on, is_cancelled, expiration_date, cancel_discount.{is_applied, percent, applied_on, price_after_discount}}`. Examples also show `"type": "SALE"` (not in the table) and the older `is_discounted`.

`GET /website/:id/sales` and `/transactions`: list forms of the above, sorted by `created_at` ascending, capped at 5000 records (over the cap returns 412).

Action responses: cancel `{"is_success"}`; downgrade/terminate `{"sale_id","is_success"}`; extend `{"is_success","new_expiration_date","sale_id"}`; refund `{"refund_transaction_id","is_success","warning"?}`.

### 3.4 FlexPay status page

Fields (v4): `response`, `error`, `saleID`, `shopID`, `paymentMethod` (labels such as `Credit Card`, `Direct Debit EU`; v3 also `Bitcoin`), `priceAmount`, `priceCurrency`, `trialAmount`, `trialPeriod`, `discountAmount`, `period`, `description`, `type`, `subscriptionType`, `expired`, `expiresOn`, `referenceID`, `name`, `email`, `country`, `oneClickToken`, `cancelled`, `cancelledOn`, `cancelledBy`, `createdOn`, `saleResult`, `billingAddr_*`. v3 also: `subscriptionPhase`, `nextChargeOn`, `discountPrice`, `btc_transaction_status` (`paid`, `complete`, `invalid`).

Example (transcribed in part from the FlexPay v3 PDF, subscription status response, page 26):

```
response: FOUND
shopID: 64233
paymentMethod: Credit Card
priceAmount: 51.20
priceCurrency: EUR
period: P1M
trialAmount: 2.95
trialPeriod: P3D
type: subscription
subscriptionType: recurring
saleID: 13029033
createdOn: 27-DEC-2014 03:22:12
saleResult: APPROVED
subscriptionPhase: trial
expired: no
expiresOn: 30-DEC-2015
cancelled: yes
cancelledOn: 28-DEC-2014
cancelledBy: user
discountPrice: 3.95
```

(Buyer name, email and address lines of the original example are omitted here.)

### 3.5 VerotelRUM example

Transcribed from the RUM PDF ("Add transaction"):

```
http://www.yourwebsite.com/cgi-bin/rumadd.pl?trn=add&trn_id=39748304&usercode=bob&passcode=testpwd&custom1=cust1&custom2=cust2&custom3=cust3
```

---

## 4. Codes

Verotel publishes **no card decline code table** and no FlexPay error code list. The finite, documented diagnostic vocabularies are listed below. Category and retry class are **suggestions**.

### 4.1 Control Center API HTTP statuses and error titles (2.0.0; match on `status` + `title`)

| HTTP | `title` (literal, as published)                                              | Meaning (paraphrase)                                                                                    | Suggested category | Suggested retry                                       |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| 401  | `Unauthorized`                                                               | Basic auth credentials missing or wrong                                                                 | configuration      | do_not_retry                                          |
| 404  | NOT DOCUMENTED                                                               | Requested sale/transaction/website does not exist                                                       | invalid_request    | do_not_retry                                          |
| 406  | `Version must be specified in Accept header`                                 | `Accept` lacks `version=MAJOR.MINOR.PATCH`                                                              | invalid_request    | do_not_retry                                          |
| 406  | `Cannot process request for accept header: <value>`                          | Unsupported media type or version                                                                       | invalid_request    | do_not_retry                                          |
| 412  | `Invalid parameter "sale_id": Sale is not approved`                          | Cancel attempted on a sale that was never approved                                                      | invalid_request    | do_not_retry                                          |
| 412  | `Cancel rebilling is disabled during rebill retry period.`                   | Sale is in rebill-retry; cancel is blocked for now                                                      | invalid_request    | retry_conditionally (after the retry period)          |
| 412  | `This sale is not a subscription / is not recurring / is already cancelled.` | Cancel not applicable (may mean the goal is already reached)                                            | invalid_request    | do_not_retry                                          |
| 412  | `Paramter xxx is required` (typo as published)                               | Missing query parameter                                                                                 | invalid_request    | do_not_retry                                          |
| 412  | `Invalid parameters: xxx, yyy`                                               | Unknown or malformed query parameters                                                                   | invalid_request    | do_not_retry                                          |
| 412  | `Invalid date range`                                                         | Date filters invalid                                                                                    | invalid_request    | do_not_retry                                          |
| 412  | NOT DOCUMENTED (over 5000 records)                                           | List query exceeds the 5000 cap                                                                         | invalid_request    | retry_conditionally (narrow filters)                  |
| 412  | `Failed to refund the transaction.` (1.x without the final dot)              | Refund refused; example causes given as "Transaction has linker / too large partial refund amount etc." | invalid_request    | manual_review                                         |
| 429  | `Rate limit exceeded`                                                        | Over 500 requests per hour                                                                              | rate_limiting      | safe_to_retry_technical_request (after `Retry-After`) |

### 4.2 Messages inside HTTP 200 bodies

| Where                                          | Message                                                                           | Meaning                                                                         | Suggested category | Suggested retry                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------ | ---------------------------------------- |
| terminate, `is_success:false`, `error.message` | `Action cannot be performed. Please review Verotel Remote user management setup.` | Termination failed because the merchant's RUM/postback setup does not accept it | configuration      | manual_review                            |
| refund, `is_success:true`, `warning.message`   | `Postback terminating website access failed.`                                     | Refund done, but the access-removal postback to the merchant failed             | configuration      | manual_review (do not repeat the refund) |

### 4.3 Decline reason (`decline_reason` on a transaction)

| Value      | Description          | Suggested category | Suggested retry          |
| ---------- | -------------------- | ------------------ | ------------------------ |
| `NO_FUNDS` | "Insufficient funds" | insufficient_funds | customer_action_required |

This is the only documented value (appears in the example only). The full list of decline categories is **NOT DOCUMENTED**; any other value should map to `unknown`.

### 4.4 FlexPay status page `response`

| Value      | Meaning                                                     | Suggested category | Suggested retry |
| ---------- | ----------------------------------------------------------- | ------------------ | --------------- |
| `FOUND`    | Sale found; data follows                                    | n/a (success)      | n/a             |
| `NOTFOUND` | No sale for that `saleID`/`referenceID`                     | invalid_request    | do_not_retry    |
| `ERROR`    | Error, free-text message in `error` (values NOT DOCUMENTED) | unknown            | unknown         |

`saleResult` documented value: `APPROVED` only.

### 4.5 Postback acknowledgement (merchant side)

| Situation                                                      | Documented consequence                                                                                                                       | Suggested category | Suggested retry |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------- |
| FlexPay postback not answered with HTTP 200 + `OK` within 30 s | "For Credit Card payments - If no such response is received, an automatic refund is initiated." (v3: for BTC a notification is sent instead) | configuration      | manual_review   |
| RUM answer `APPROVED`                                          | success                                                                                                                                      | n/a                | n/a             |
| RUM answer `DECLINED`                                          | merchant could not complete; Verotel retries, then refunds                                                                                   | configuration      | manual_review   |
| RUM answer `ERROR`                                             | merchant technical failure; Verotel retries, then refunds                                                                                    | configuration      | manual_review   |

### 4.6 Enumerations useful for decoding

| Field                     | Values                                                                                                                                                  | Source             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `transaction_type`        | `DEBIT`, `CREDIT`, `CHARGEBACK`                                                                                                                         | Control Center API |
| `transaction_subtype`     | `ONETIME`, `WALLET`, `PURCHASE`, `INITREC`, `RECURRED`, `CREDIT`, `CHBACK` (meanings NOT DOCUMENTED; see 5.3)                                           | Control Center API |
| `reversal_extent`         | `NONE`, `PARTIAL`, `FULL`                                                                                                                               | Control Center API |
| `reversals[].type`        | `REFUND`, `CHARGEBACK`                                                                                                                                  | Control Center API |
| `payment_method` (API)    | `CC`, `DDUS`, `DDEU`, `PHEU`, `BTC`, `PHUS`, `PMB`, `AT`, `SMS` (1.1.0 also `SOFORT`); meanings NOT DOCUMENTED except that FlexPay uses `CC` and `DDEU` | Control Center API |
| `payment_instrument.type` | `BANK_ACCOUNT`, `CREDIT_CARD`, `BITCOIN_WALLET`, `PHONE_NUMBER`, `CHECK`                                                                                | Control Center API |
| `sale_type` / `sale.type` | `PURCHASE`, `SUBSCRIPTION`                                                                                                                              | Control Center API |
| website `type`            | `FLEXPAY`, `MEMBERSHIP`                                                                                                                                 | Control Center API |
| FlexPay `paymentMethod`   | `CC`, `DDEU`, `YOURSAFE_DIRECT`, `IDEAL` (v4); `BTC` (v3)                                                                                               | FlexPay docs       |
| `cancelledBy`             | `user`, `support`, `merchant`, `system`                                                                                                                 | FlexPay docs       |
| `uncancelledBy`           | `support`                                                                                                                                               | FlexPay docs       |
| `subscriptionPhase`       | `trial`, `normal`, `discounted`, `terminated`                                                                                                           | FlexPay docs       |
| `subscriptionType`        | `one-time`, `recurring`                                                                                                                                 | FlexPay docs       |
| `upgradeOption`           | `extend` (default), `lost`                                                                                                                              | FlexPay docs       |
| RUM `trn`                 | `add`, `rebill`, `cancel`, `modify`, `delete`                                                                                                           | RUM PDF            |

### 4.7 Count summary

| Group                                           | Count                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| FlexPay postback kinds                          | 11 (10 distinct `event` values + the purchase success postback, which has no `event`) |
| VerotelRUM commands                             | 5                                                                                     |
| Control Center API HTTP statuses with semantics | 5 (401, 404, 406, 412, 429)                                                           |
| Control Center API distinct error titles        | 11 literal titles + 2 documented-but-untitled cases (404, 5000 cap)                   |
| In-body (HTTP 200) failure/warning messages     | 2                                                                                     |
| Decline categories                              | 1 (`NO_FUNDS`)                                                                        |
| Status page `response` values                   | 3                                                                                     |
| RUM merchant responses                          | 3                                                                                     |

---

## 5. Lifecycle

### 5.1 FlexPay purchase (one-off)

1. `startorder` with `type=purchase` (buyer redirected to the order page).
2. Approved: success postback (`type=purchase`, `saleID`, no `event`) and success redirect. **Declines produce no postback** ("The postback is sent only for successfully approved transactions"); the buyer goes to `declineURL` (whether params are appended there is NOT DOCUMENTED).
3. Optional: `event=credit` (refund by merchant, support or system, incl. automated refund) with `transactionID` (credit) and `parentID` (credited transaction).
4. Optional: `event=chargeback` with `transactionID` and `parentID`; "This also blacklists the buyer."

One Click: each approved purchase may return a new `oneClickToken`; tokens are single-use, invalidated on approve or decline, and expire after 30 days.

### 5.2 FlexPay subscription

| Event        | When (paraphrase)                                                                                                                                    | State after                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `initial`    | First approved charge (trial or full price)                                                                                                          | active; `nextChargeOn` (recurring) or `expiresOn` (one-time)                         |
| `rebill`     | Successful automatic rebill (recurring only)                                                                                                         | active; new `nextChargeOn`                                                           |
| `extend`     | Merchant/support added days, **or** first rebill declined with "Rebill-retry" enabled (system extends while retries run)                             | active; shifted date                                                                 |
| `downgrade`  | Merchant/support changed the next rebill price                                                                                                       | active; new `amount`/`currency`                                                      |
| `cancel`     | Buyer, merchant, support or system stopped future rebills                                                                                            | still active until `expiresOn`, no more rebills                                      |
| `uncancel`   | Support reverted a cancel                                                                                                                            | active; rebills resume at `nextChargeOn`                                             |
| `expiry`     | Subscription terminated (end of cancelled or one-time period, declined rebill, termination by support/merchant; v3 also lists refund and chargeback) | ended                                                                                |
| `credit`     | A transaction of the subscription was refunded; "The refund also terminates subscription"                                                            | `subscriptionPhase=terminated`, or `normal` for a partial credit without termination |
| `chargeback` | A transaction was charged back; buyer blacklisted                                                                                                    | `subscriptionPhase=terminated`                                                       |
| `upgrade`    | Buyer switched plan via `upgradesubscription`; new sale created, previous sale terminated **without** an `expiry` postback                           | new sale active; `precededBySaleID` points to old sale                               |

Declined rebills have **no dedicated postback**. They surface as `extend` (rebill-retry case) and later `rebill` or `expiry`, or directly as `expiry`. The expiry postback carries no reason field, so the termination cause cannot be read from the payload alone.

Minimum periods: 7 days for recurring, 2 days for one-time; trial minimum 2 days.

### 5.3 Transaction level (Control Center API)

`transaction_type` separates money direction: `DEBIT` (charge), `CREDIT` (refund), `CHARGEBACK`. A debit's `reversal_extent` and `reversals[]` show later refunds/chargebacks; a reversal points back via `original_debit_transaction_id`. `is_approved=false` plus `decline_reason` marks a declined attempt (the only place declines are visible).

`transaction_subtype` meanings are **NOT DOCUMENTED**. Suggested reading (unverified, based on names and examples only): `PURCHASE` = FlexPay purchase debit (example pairs it with `sale.type=PURCHASE`), `INITREC` = initial charge of a recurring subscription (example pairs it with `SUBSCRIPTION`), `RECURRED` = rebill, `ONETIME` = one-time subscription charge, `CREDIT` = refund, `CHBACK` = chargeback, `WALLET` = unknown. An adapter should show the raw value and label these as suggestions.

### 5.4 Not applicable / not documented

Payouts to merchants (daily, via Yoursafe Business Account) and talent/affiliate payments have no documented payload. Authorization vs capture is not exposed (FlexPay is a single approved-or-not step). Wallet transfers: none.

### 5.5 VerotelRUM

`add` (new one-time or initial recurring transaction; grant access with `usercode`/`passcode`), `rebill`, `cancel` (rebills stopped; the text says an `expire` command follows on the next charge date, but `expire` is not specified), `modify` (change passcode), `delete` (remove access).

---

## 6. Notifications / postbacks

### 6.1 Delivery

- FlexPay: HTTP GET to the website's "Flexpay postback URL" (configured in the Control Center; the URL is not part of the payload). Expected answer: HTTP 200, body `OK`, within 30 s. No answer for a card payment triggers an automatic refund (which in turn should generate a `credit` postback).
- FlexPay retry schedule: **NOT DOCUMENTED**. Ordering guarantees: **NOT DOCUMENTED**. Source IPs: **NOT DOCUMENTED**.
- VerotelRUM: "Whenever Verotel receives a response other than "APPROVED" it will retry the postback call two more times in 20 minutes time period"; then the postback is marked failed and the debit is refunded automatically.

### 6.2 Fields per FlexPay postback (v4 docs)

Common to all: `shopID`, `type` (`purchase` or `subscription`), `referenceID`, `saleID`, `custom1`, `custom2`, `custom3`, `signature`.

| Kind                    | `event`      | Additional fields                                                                                                                                                                                |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purchase success        | (absent)     | `transactionID` (postbacks v2 only), `priceAmount`, `priceCurrency`, `paymentMethod`, `oneClickToken`, `truncatedPAN`, `CCBrand`                                                                 |
| Purchase credit         | `credit`     | `priceAmount`, `priceCurrency`, `transactionID`, `parentID`                                                                                                                                      |
| Purchase chargeback     | `chargeback` | `priceAmount`, `priceCurrency`, `transactionID`, `parentID`                                                                                                                                      |
| Subscription initial    | `initial`    | `subscriptionType`, `transactionID` (v2 only), `priceAmount`, `priceCurrency`, `period`, `trialAmount`, `trialPeriod`, `expiresOn` or `nextChargeOn`, `paymentMethod`, `truncatedPAN`, `CCBrand` |
| rebill                  | `rebill`     | `subscriptionType=recurring`, `transactionID`, `amount`, `currency` (note: not `priceAmount`/`priceCurrency`), `nextChargeOn`, `subscriptionPhase`, `paymentMethod`                              |
| extend                  | `extend`     | `subscriptionType`, `nextChargeOn` or `expiresOn`, `subscriptionPhase`                                                                                                                           |
| downgrade               | `downgrade`  | `subscriptionType`, `amount`, `currency`, `subscriptionPhase=normal`                                                                                                                             |
| cancel                  | `cancel`     | `subscriptionType=recurring`, `expiresOn`, `cancelledBy` (v3 also `subscriptionPhase`)                                                                                                           |
| uncancel                | `uncancel`   | `subscriptionType=recurring`, `nextChargeOn`, `subscriptionPhase`, `uncancelledBy`                                                                                                               |
| expiry                  | `expiry`     | `subscriptionType`                                                                                                                                                                               |
| Subscription credit     | `credit`     | `subscriptionType`, `subscriptionPhase`, `priceAmount`, `priceCurrency`, `transactionID`, `parentID`                                                                                             |
| Subscription chargeback | `chargeback` | `subscriptionType`, `subscriptionPhase=terminated`, `priceAmount`, `priceCurrency`, `transactionID`, `parentID`                                                                                  |
| upgrade                 | `upgrade`    | `subscriptionType`, `transactionID` (v2 only), `precededBySaleID`, `priceAmount`, `priceCurrency`, `period`, `expiresOn` or `nextChargeOn`, `paymentMethod`, `truncatedPAN`, `CCBrand`           |

Date fields in postbacks are `yyyy-mm-dd`. **Postbacks carry no event timestamp** and no event ID.

### 6.3 Signature (sensitive; PandaPayLens must not verify)

- v4: `signature = sha256_hex(signatureKey + ":" + "k1=v1" + ":" + "k2=v2" ...)`, keys sorted alphabetically, only parameters that have a value, values UTF-8. Output is 64 lowercase hex characters. The documented example (`...:type=purchase:version=4`) hashes to the published value `ccaf2357...2f2a`.
- v3 and earlier: same construction with SHA-1 (40 hex). Both official clients still accept a SHA-1 signature when validating ("accept also old sha-1 signature").
- For postbacks the official clients compute the signature over **all received parameters except `signature`**; for requests they use a fixed allow-list (`version`, `shopID`, `priceAmount`, `priceCurrency`, `paymentMethod`, `description`, `referenceID`, `saleID`, `custom1..3`, `subscriptionType`, `period`, `name`, `trialAmount`, `trialPeriod`, `cancelDiscountPercentage`, `type`, `successURL`, `declineURL`, `precedingSaleID`, `upgradeOption`, `mcc`, `subCreditorName`, `subCreditorId`, `subCreditorCountry`). `email` and `oneClickToken` are excluded from request signatures.
- Signature comparison in the clients is case-insensitive (lowercased).
- An adapter should only report the signature's presence and apparent algorithm (40 vs 64 hex) and redact it.

### 6.4 Duplicate identification

**NOT DOCUMENTED.** There is no event ID or delivery ID. Suggested dedupe key (suggestion): `saleID` + `event` (or "purchase-success") + `transactionID` when present, else + the date field (`nextChargeOn`/`expiresOn`) + amount. Two `rebill` postbacks for the same sale are distinct only through `transactionID` and `nextChargeOn`.

---

## 7. Identifiers

| Identifier                                                | Where                                                                                             | Meaning / correlation                                                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saleID`                                                  | All FlexPay postbacks, success redirect, status page, cancel URL                                  | Verotel sale (one purchase or one subscription across all rebills). Equals Control Center API sale `id` and `sale.id`. Status page describes it as "identifier of the transaction" (wording inconsistency). |
| `transactionID`                                           | Postbacks: initial/purchase/upgrade (only with "postbacks version 2"), rebill, credit, chargeback | Single money movement. For `credit`/`chargeback` it is the reversal transaction. Equals Control Center API transaction `id`.                                                                                |
| `parentID`                                                | `credit`, `chargeback` postbacks                                                                  | The original transaction that was reversed. Equals API `original_debit_transaction_id` of the reversal.                                                                                                     |
| `precededBySaleID` / `precedingSaleID`                    | `upgrade` postback / upgrade request                                                              | Links the new sale to the replaced sale.                                                                                                                                                                    |
| `refund_transaction_id`                                   | API refund response                                                                               | Refund transaction created.                                                                                                                                                                                 |
| `reversals[].id` (`transaction_id` in example)            | API transaction                                                                                   | Refund/chargeback transactions of a debit.                                                                                                                                                                  |
| `referenceID` / `reference_id`                            | Request, postbacks, status page, API                                                              | Merchant reference; "must be unique if provided"; copied from the preceding sale on upgrade; status lookup by `referenceID` is allowed.                                                                     |
| `custom1..3`                                              | Request, postbacks, API (`sale.custom*`)                                                          | Pass-through values; often the merchant's user ID.                                                                                                                                                          |
| `shopID` / `website_id`                                   | All                                                                                               | Website (FlexPay "shop") ID.                                                                                                                                                                                |
| Merchant/customer ID (16 digits, e.g. `9804000000000000`) | Client config, API username                                                                       | First 4 digits identify the brand (section 2). Not present in postbacks.                                                                                                                                    |
| `trn_id`                                                  | RUM                                                                                               | Verotel transaction ID.                                                                                                                                                                                     |
| `usercode`                                                | RUM                                                                                               | Member login name.                                                                                                                                                                                          |

---

## 8. Sensitive fields

| Field                                                                                             | Why                                                                                                     | Handling                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `signature`                                                                                       | Integrity token derived from the merchant secret                                                        | Redact; never attempt verification |
| `signatureKey` (FlexPay "Signature Key")                                                          | Merchant secret; not in payloads but appears in pasted client code (`new Client(shopId, "<key>", ...)`) | Redact if seen; warn               |
| `Authorization: Basic ...`                                                                        | Base64 of Control Center API username:password                                                          | Redact; warn (trivially decodable) |
| `oneClickToken`                                                                                   | Allows charging the buyer's stored card without CVV                                                     | Redact                             |
| `passcode` (RUM)                                                                                  | Member password in clear text                                                                           | Redact                             |
| `usercode` (RUM)                                                                                  | Member login                                                                                            | Mask                               |
| `email`, `buyer_email`, `name`, `buyer_name`, `billingAddr_*`, `address.*`, `buyer_ip`, `country` | Buyer personal data                                                                                     | Mask                               |
| `truncatedPAN`, `payment_instrument.masked_identifier`                                            | Masked card/account number                                                                              | Keep masked form only              |
| `custom1..3`, `referenceID`, `description`                                                        | May contain merchant user IDs or hashes                                                                 | Treat as potentially personal      |

---

## 9. Structural detection hints

Verotel-specific markers (high confidence when several co-occur):

- Query string with `saleID=` + `shopID=` + `signature=` (40 or 64 hex), plus `type=purchase|subscription`. None of the supported providers (Stripe, Adyen, payabl., Checkout.com, PayPal, Braintree, Mollie, Square) use this camelCase `saleID`/`shopID` pair.
- `event=` with one of `initial|rebill|extend|downgrade|cancel|uncancel|expiry|credit|chargeback|upgrade`, often with `subscriptionType=one-time|recurring`, `subscriptionPhase=`, `cancelledBy=`, `uncancelledBy=`, `precededBySaleID=`, `parentID=`, `nextChargeOn=`/`expiresOn=` (yyyy-mm-dd), `custom1..3`.
- Hosts: `secure.verotel.com`, `secure.billing.creditcard`, `secure.gaycharge.com`, `secure.yoursafedirect.com`, `secure.bitsafepay.com`, `secure.bill.creditcard`, `secure.paintfestpayments.com`, `secure.yoursafe.com`, with paths `/startorder`, `/status/order`, `/salestatus`, `/cancel-subscription`.
- Control Center API JSON: error envelope whose `error.documentation` equals `https://controlcenter.verotel.com/api-doc/index.html` (decisive); objects with `transaction_subtype` in `INITREC|RECURRED|CHBACK|ONETIME|WALLET`, `reversal_extent`, `original_debit_transaction_id`, `payment_instrument.masked_identifier`, `sale_type`.
- Status page text: lines `response: FOUND|NOTFOUND|ERROR`, `saleResult: APPROVED`, `billingAddr_fullName:`.
- RUM: `trn=add|rebill|cancel|modify|delete` with `trn_id=` and `usercode=`.
- Note: payabl. callbacks are also URL-encoded but use lowercase `transactionid`, `errormessage`, `security`; Verotel uses `transactionID`, `saleID`, `signature` and never `status`/`errorcode`.

Versus other high-risk candidates (CCBill, Segpay, Epoch and others in the roadmap): their formats must be taken from their own research files; this document makes no claims about them. Rely on the Verotel-unique markers above (brand hosts, `saleID`+`shopID`, the `event` vocabulary, the Control Center documentation URL) rather than on generic fields such as `custom1` or `subscriptionType`.

---

## 10. Limitations, ambiguities and documentation inconsistencies

1. **No literal FlexPay postback example** exists in the docs; only field tables. Test fixtures will have to be built from the tables and clearly labelled as synthetic.
2. **No decline code table**: declines never produce a postback, and the API shows only one decline category (`NO_FUNDS`). Error decoding is limited to the Control Center API envelope.
3. **No timestamps or event IDs in postbacks**, and retry/ordering behavior is not documented. Timelines from postbacks alone rely on paste order and the `nextChargeOn`/`expiresOn` dates.
4. **"Postbacks version 2"** is referenced (it adds `transactionID` to initial/purchase/upgrade postbacks) but how it is enabled is not public (presumably a Control Center setting).
5. Purchase success postback has **no `event` field**; detection must rely on `type=purchase` + absence of `event`.
6. Rebill and downgrade use `amount`/`currency`; other postbacks use `priceAmount`/`priceCurrency`.
7. Chargeback postback describes `transactionID` as "transaction id of credit transaction" and `parentID` as the "transaction which was credited" (copy of the credit table).
8. Expiry reasons: v3 lists refund and chargeback as causes; v4 does not (v4 adds separate `credit`/`chargeback` postbacks). Whether an `expiry` also follows a `credit`/`chargeback` is **NOT DOCUMENTED**.
9. Credit postback: "The refund also terminates subscription", yet `subscriptionPhase=normal` is allowed "for partial credit without terminate initiated".
10. `subscriptionPhase=discounted`: v3 says "not yet supported", v4 lists it.
11. Cancel postback: v3 includes `subscriptionPhase`, v4 does not.
12. Status page path: docs `/status/order`; both official clients use `/salestatus`. Status date formats: v3 `dd-mmm-yyyy hh:mm:ss`, v4 "ISO8601".
13. Control Center API docs: `decline_reason` table says `id`, example uses `category`; `reversals.id` vs example `transaction_id`; `percent` vs `percentage`; `trial_price` placement differs; `custom1..3` typed Number but strings in examples; `subscription.is_*` typed String but booleans in examples; `website_id` number vs `"60678"` string; examples contain `=>` (not valid JSON). Parsers must be lenient.
14. Error title typo `Paramter`; refund title with and without a final period across versions.
15. Direct Debit Europe countries: FlexPay lists 8 (no Slovakia), pricechart lists 9 (incl. Slovakia).
16. FlexPay availability for BASIC accounts: productchoice says no, pricechart says yes.
17. RUM PDF mentions an `expire` command but does not specify it; RUM `amount` appears in tables without a clear mandatory flag (PDF layout is garbled).
18. Meanings of `transaction_subtype` values and of API `payment_method` codes other than `CC`/`DDEU`/`BTC` are not documented.
19. The FlexPay "latest documentation" statement on integration.html points to the Control Center (login). The public v4 site may lag or differ from what logged-in merchants see; this cannot be checked without access.
20. Signature verification would need the merchant's secret; PandaPayLens can only check presence and format.

---

## 11. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| errorDecoding    | **limited**   | Finite, documented Control Center API error envelope (5 HTTP statuses, 11 titles, 2 in-body messages) and postback acknowledgement consequences. No card/issuer decline table; one decline category only.                                                                                                                      |
| paymentResponses | **limited**   | Control Center API sale/transaction/action JSON is fully tabulated with examples; status page text is documented. FlexPay itself has no synchronous payment response (redirect only), and the API examples contain inconsistencies.                                                                                            |
| webhookParsing   | **supported** | All 11 FlexPay postback kinds have fixed `event`/`type` values and complete field tables in current (v4) docs; RUM's 5 commands are documented with example URLs. Caveat: fixtures must be synthetic (no published raw example).                                                                                               |
| timeline         | **limited**   | Clear lifecycle semantics (initial, rebill, extend, cancel, uncancel, expiry, credit, chargeback, upgrade), but postbacks have no timestamps or event IDs and declined rebills are only implied. Control Center API transactions add `created_at` and reversal links, improving timelines when pasted together.                |
| correlation      | **supported** | `saleID` is stable across all postbacks, status page and API; `transactionID`/`parentID`/`original_debit_transaction_id`/`reversals` link reversals to debits; `precededBySaleID` links upgrades; `referenceID` and `custom1..3` link to merchant records. Caveat: `transactionID` on initial postbacks requires postbacks v2. |
