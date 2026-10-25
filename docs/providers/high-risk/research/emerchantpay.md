# emerchantpay (adapter id `emerchantpay`): high-risk candidate research

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: the public Genesis API reference (one large Slate page, documentation version 61.1) was downloaded and converted to text, then read section by section; official SDK source files were read as raw files; emerchantpay.com marketing pages are rendered client-side, so their text was read through the site's own page-content endpoint. Nothing was called on the gateway; no login was used.

---

## 0. Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Classification                     | `acquiring`, `gateway`, `card_processing`, `alternative_payment_method` (see section 3)                                                                                                                                                                                                                                                                                                                                                                     |
| Documented sectors                 | gaming / iGaming, digital goods and services (incl. subscription-based businesses), financial services, travel, eCommerce, retail                                                                                                                                                                                                                                                                                                                           |
| Documentation access               | **Public**. Full API reference, docs portal and SDKs are public. Only credentials (API login, password, terminal token) and the merchant/gateway console need an account.                                                                                                                                                                                                                                                                                   |
| Documented codes (distinct values) | Gateway error codes: **93** (+6 extra in the PHP SDK). Scheme response codes: **83** distinct (Visa table 71, Mastercard/Maestro table 48; +16 extra in the SDK). Recurring advice: **18**. 3DS authentication status reason: **27** values plus a reserved range. AVS: 10 single-character + 2 source prefixes and 17 result letters. CVV result: 5. Cryptogram result: 6. Transaction states: 15. WPF states: 19.                                         |
| Biggest limitation                 | Notifications have no delivery/event ID and no timestamp, the retry schedule is undocumented ("sent periodically"), and the WPF/APM signature examples are visibly truncated in the docs.                                                                                                                                                                                                                                                                   |
| White-label note                   | emerchantpay runs its own platform, **Genesis**. emerchantpay does not resell another gateway. However, the official Genesis PHP SDK (linked from emerchantpay's API docs) defines a second endpoint constant described as "E-ComProcessing's Genesis instance" (`e-comprocessing.net`) next to "emerchantpay's Genesis instance" (`emerchantpay.net`). Payloads from that other instance would be structurally identical; only hostnames distinguish them. |

---

## 1. Sources

All read on 2026-10-25.

| URL                                                                                                                  | What it covers                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://emerchantpay.github.io/gateway-api-docs/                                                                     | Genesis API reference v61.1 (2026/10/14): auth, URLs, all transaction types, response fields, transaction states, scheme response codes, recurring advice, reconcile, chargebacks, RDR, retrieval requests, async notifications, WPF API/states/notifications, 3DS, error code tables, AVS/CVV/cryptogram codes, changelog |
| https://docs.emerchantpay.com/                                                                                       | Docs portal index (integration guides, links to API reference and repositories)                                                                                                                                                                                                                                            |
| https://docs.emerchantpay.com/payments/payment-integrations/server-to-server/integrate-s2s/                          | S2S guide: XML request/response, HTTP Basic auth, credentials come from Gateway Console                                                                                                                                                                                                                                    |
| https://docs.emerchantpay.com/payments/online-card-payments/refund/                                                  | Refund flow, `reference_id`, example XML                                                                                                                                                                                                                                                                                   |
| https://docs.emerchantpay.com/payments/online-card-payments/void/                                                    | Void flow (same-day), example XML                                                                                                                                                                                                                                                                                          |
| https://www.emerchantpay.com/                                                                                        | Homepage (only the title is server-rendered)                                                                                                                                                                                                                                                                               |
| https://www.emerchantpay.com/amp/                                                                                    | Server-rendered footer: UK/EU/US regulatory statements, copyright 2007 - 2026, nav links to docs, API reference, SDKs                                                                                                                                                                                                      |
| https://www.emerchantpay.com/wp-json/api/navigation/?names=header,mobile,company,products,additional                 | Site navigation (page discovery)                                                                                                                                                                                                                                                                                           |
| https://www.emerchantpay.com/gaming/                                                                                 | Gaming / iGaming sector page (read via `https://www.emerchantpay.com/wp-json/api/page/?url=/gaming/&lang=en`, same method for the rows below)                                                                                                                                                                              |
| https://www.emerchantpay.com/digital-goods/                                                                          | Digital goods and services sector page                                                                                                                                                                                                                                                                                     |
| https://www.emerchantpay.com/financial-services/                                                                     | Financial services sector page                                                                                                                                                                                                                                                                                             |
| https://www.emerchantpay.com/travel/                                                                                 | Travel sector page                                                                                                                                                                                                                                                                                                         |
| https://www.emerchantpay.com/e-commerce/                                                                             | eCommerce sector page                                                                                                                                                                                                                                                                                                      |
| https://www.emerchantpay.com/retail/                                                                                 | Retail sector page                                                                                                                                                                                                                                                                                                         |
| https://www.emerchantpay.com/about-us/                                                                               | Company history: FCA permission, principal member of Visa/Mastercard, own gateway and acquiring division, EMI                                                                                                                                                                                                              |
| https://www.emerchantpay.com/acquiring/                                                                              | In-house and global acquiring                                                                                                                                                                                                                                                                                              |
| https://www.emerchantpay.com/certifications/                                                                         | FCA EMI authorisation (Reg. No. 900778), PCI DSS Level 1                                                                                                                                                                                                                                                                   |
| https://www.emerchantpay.com/legal/                                                                                  | Legal index (no technical content)                                                                                                                                                                                                                                                                                         |
| https://api.github.com/orgs/GenesisGateway/repos                                                                     | Official SDK repos (php, ruby, java, dotnet, js, iOS, Android); activity dates                                                                                                                                                                                                                                             |
| https://api.github.com/orgs/eMerchantPay/repos                                                                       | emerchantpay org: `gateway-api-docs` (source of the API reference), `gateway-india-api-docs`, `ewallet-api-docs` (eZeeWallet), shopping cart plugins                                                                                                                                                                       |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/README.md                                        | SDK setup, endpoint selection                                                                                                                                                                                                                                                                                              |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/composer.json                                    | Package metadata (v2.2.2)                                                                                                                                                                                                                                                                                                  |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Constants/Errors.php             | Error code constants and issuer response code descriptions                                                                                                                                                                                                                                                                 |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Constants/Transaction/States.php | State constants                                                                                                                                                                                                                                                                                                            |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Constants/Endpoints.php          | Endpoint domains (emerchantpay, E-ComProcessing)                                                                                                                                                                                                                                                                           |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Notification.php                 | Notification parsing, signature check, echo response                                                                                                                                                                                                                                                                       |
| https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Response.php                     | XML vs JSON response parsing, success logic                                                                                                                                                                                                                                                                                |

---

## 2. Qualification gate

| #   | Item                                   | Answer | Evidence                                                                                                                                                                                         |
| --- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Company/product active                 | yes    | Footer "Copyright (c) emerchantpay Ltd 2007 - 2026" (https://www.emerchantpay.com/amp/); API changelog entries up to 61.1 dated 2026/10/14 (API docs)                                            |
| 2   | Payment service operational            | yes    | Product pages for acquiring and online payments; docs repo `gateway-api-docs` updated 2026-10-20 (GitHub API); status page offered (API docs, Status Page). Live operation not tested by design. |
| 3   | Docs publicly accessible               | yes    | Full API reference and docs portal are public. Credentials and terminal tokens are found in the admin panel (`https://merchant.emerchantpay.net/`), which needs an account.                      |
| 4   | API families/versions identified       | yes    | Processing API (`/process/TERMINAL_TOKEN/`), Reconcile, WPF API (`wpf.emerchantpay.net/wpf`), Smart Routing, notifications; documentation version 61.1                                           |
| 5   | Offline-inspectable formats            | yes    | XML response examples and form-encoded notification examples per transaction type (API docs, Sale, Notifications, WPF Notification)                                                              |
| 6   | Sectors documented by provider         | yes    | Industry pages: gaming, digital goods, financial services, travel, eCommerce, retail (section 3)                                                                                                 |
| 7   | Regional/regulatory limits identified  | yes    | UK FCA EMI, EU via UAB Phoenix Payments (Bank of Lithuania), US as ISO of Elavon and Westamerica Bank (https://www.emerchantpay.com/amp/)                                                        |
| 8   | Real diagnostic value                  | yes    | 93 gateway error codes in 10 documented range groups, scheme response codes, recurring advice, 15 states, documented notification fields                                                         |
| 9   | Own technical format (not white-label) | yes    | Genesis is described as emerchantpay's gateway; About us: "Launched our payment gateway". SDK shows Genesis also has an E-ComProcessing instance (see section 0).                                |
| 10  | No live credentials needed             | yes    | All formats and examples are in public docs and SDK source                                                                                                                                       |

Outcome rule: items 1-5, 8, 9, 10 are yes, so the outcome is **documentation_verified**.

---

## 3. Classification and documented sectors

Classification (with evidence):

- `acquiring`: "in-house and global merchant acquiring services" (https://www.emerchantpay.com/acquiring/); About us timeline: "Launched our acquiring division", "Became a principal member of Visa Europe and Mastercard Worldwide".
- `gateway`: "in-house, PCI level 1 certified payment gateway" (https://www.emerchantpay.com/financial-services/); Genesis API docs.
- `card_processing`: card transaction types (authorize, sale, 3D variants, capture, refund, void) and card brands list (API docs, Supported Card Brands).
- `alternative_payment_method`: "50+ payment options" (About us); many APM transaction types in the API docs (e.g. Sofort, iDeal, Pix, BLIK).
- Not claimed: `wallet` for this adapter. emerchantpay also has a wallet product (About us: "Digital wallet solution launched"; GitHub repo `ewallet-api-docs` titled "eZeeWallet Slate Public API docs"). That is a separate API and is out of scope here.

Sectors (provider's own statements only):

| Sector                                         | Source                                           | Short quote                                            |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Gaming / iGaming                               | https://www.emerchantpay.com/gaming/             | "Payment solutions made for iGaming"                   |
| Digital goods and services, subscription-based | https://www.emerchantpay.com/digital-goods/      | "digital content and subscription-based businesses"    |
| Financial services                             | https://www.emerchantpay.com/financial-services/ | "Payment solutions for financial services"             |
| Travel                                         | https://www.emerchantpay.com/travel/             | "Tailored travel payment solutions"                    |
| eCommerce                                      | https://www.emerchantpay.com/e-commerce/         | "Optimising digital payments for eCommerce businesses" |
| Retail                                         | https://www.emerchantpay.com/retail/             | online and in-store payment journeys                   |

Technical sector signals in the API (not sector-acceptance statements): request/response flags `gaming` ("usually use MCC 7995"), `crypto` and `digital_asset_type`; MCC list for Credit includes 7995 Betting/Casino Gambling and 5816 Digital Goods - Games (API docs, Sale and Credit sections).

Caveat: eligibility depends on jurisdiction, licensing and underwriting. A sector page does not mean a given merchant will be approved, and approval for one sector does not imply another.

Regional/regulatory limits:

- UK: emerchantpay Ltd is an authorised EMI supervised by the FCA, register no. 900778 (https://www.emerchantpay.com/amp/, https://www.emerchantpay.com/certifications/).
- EU: emerchantpay "collaborates with UAB Phoenix Payments", an EMI supervised by the Bank of Lithuania, licence LB000477 (https://www.emerchantpay.com/amp/).
- US: emerchantpay Corp. is a registered partner/ISO of Elavon, Inc. and Westamerica Bank (https://www.emerchantpay.com/amp/).
- Card brands are acquirer-specific (API docs, Supported Card Brands). AVS codes are only valid for US and UK issued cards (API docs, AVS Status Codes). Visa `purpose_of_payment` is required for cards issued in some countries (WPF create params).
- India has a separate docs repo (`gateway-india-api-docs`); not examined, out of scope.

---

## 4. API families and versions

| Family                                                          | Endpoint (production; staging adds `staging.`)                 | Format                                               | In scope                      |
| --------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| Processing API                                                  | `POST https://gate.emerchantpay.net/process/TERMINAL_TOKEN/`   | XML request (`Content-type: text/xml`), XML response | **Yes, first**                |
| Async/processing notifications                                  | POST to merchant `notification_url`                            | form-encoded key/value                               | **Yes, first**                |
| WPF API (hosted payment form)                                   | `https://wpf.emerchantpay.net/wpf`, reconcile `/wpf/reconcile` | XML (`<wpf_payment>`)                                | **Yes, second**               |
| WPF notifications                                               | POST to `notification_url`                                     | `application/x-www-form-urlencoded`                  | **Yes, second**               |
| Reconcile (single, by date, by order id)                        | `https://gate.emerchantpay.net/reconcile/TERMINAL_TOKEN/`      | XML `<payment_response>`                             | Yes (timeline)                |
| Chargeback / retrieval / RDR / SAFE-TC40 APIs and notifications | `/chargebacks`, `/rapid_dispute_resolutions`, ...              | XML; notifications form-encoded                      | Notifications yes; APIs later |
| APM external event notifications                                | POST to `notification_url`                                     | form-encoded                                         | Later                         |
| Smart Routing API                                               | `https://prod.api.emerchantpay.net/transactions`               | same XML payload as Processing                       | Same parser                   |
| Consumer, Tokenization, Managed Recurring, Transaction API      | `https://gate.emerchantpay.net/v1/...`                         | JSON / XML                                           | Out of scope initially        |
| KYC, Payee, Billing Statements/Transactions (GraphQL), FX       | various                                                        | JSON / GraphQL                                       | Out of scope                  |

Versioning: the docs carry one "API version 61.1 / Documentation version 61.1"; endpoints themselves are not versioned (except `/v1/` utility APIs). Implement first: Processing API XML responses + processing notifications, then WPF create/reconcile XML and WPF notifications, then chargeback/retrieval notifications.

---

## 5. Formats

- Processing request: HTTPS POST with XML in UTF-8; root `<payment_transaction>`. HTTP Basic auth with API login/password; terminal token in URL path.
- Processing response: XML, root `<payment_response>`. Main fields: `status` (state), `code` (gateway error code, integer), `technical_message` (internal), `message` (customer-displayable), `response_code` (acquirer code, string(2)), `scheme_response_code` (card scheme code), `unique_id` (gateway ID), `transaction_id` (merchant ID), `transaction_type`, `mode` (`test`/`live`), `timestamp` (ISO 8601), `amount` (integer, minor units), `currency`, `sent_to_acquirer` (`"true"`/`"false"`), `redirect_url` (async), plus optional AVS/CVV/scheme fields.
- The docs also show PHP (`stdClass Object`), Java (`<payment_response content=[...]>`) and JavaScript object renderings of the same response. These are SDK outputs, not wire formats; the wire format is XML.
- WPF create/reconcile: XML root `<wpf_payment>`; reconcile can nest several `<payment_transaction>` elements.
- Notifications: form-encoded key/value. WPF and APM external event sections state `application/x-www-form-urlencoded`; the processing notification section shows examples starting with `?` and does not state a content type.
- Error responses for other APIs (e.g. blacklist) use `<code>` and `<message>` under their own root.
- JSON: Consumer/Tokenization/Managed Recurring/KYC/Payee APIs. GraphQL: Billing APIs. The PHP SDK picks a JSON parser only if the response content type is JSON, else XML.

Example A, Processing API error response (transcribed from https://emerchantpay.github.io/gateway-api-docs/, Sale section):

```xml
<payment_response>
  <transaction_type>sale</transaction_type>
  <status>error</status>
  <mode>live</mode>
  <transaction_id>119643250547501c79d8295</transaction_id>
  <unique_id>44177a21403427eb96664a6d7e5d5d48</unique_id>
  <response_code>57</response_code>
  <code>340</code>
  <technical_message>billing_address[zip_code] is invalid!</technical_message>
  <message>billing_address[zip_code] is invalid!</message>
  <timestamp>2026-10-19T11:55:33Z</timestamp>
  <descriptor>Descriptor one</descriptor>
  <amount>100</amount>
  <currency>USD</currency>
  <sent_to_acquirer>false</sent_to_acquirer>
</payment_response>
```

Example B, processing notification for a declined transaction (transcribed from the same page, Notifications section; line breaks as in the docs):

```
?transaction_id=1765549130319476110
&terminal_token=059c1fd53d119f420d55d5d864b4b72182593251
&unique_id=bff8dc467cacc2a452eb969ad8c743d5
&transaction_type=authorize3d
&status=declined
&amount=297
&signature=3bdab6fa96320b591f3c08ccef0675d5d18ee481
&consumer_id=164269647
&token=76d3666b-4717-4562-a15e-595a22af915b
&eci=05
&error_code=520
&error_message=Credit+card+has+expired.
&technical_message=Credit+card+has+expired.
```

---

## 6. Codes

Category and retry columns are **suggestions** for PandaPayLens, not emerchantpay statements. Paraphrases are short; see the source for the original text. Unknown codes must fall back to `unknown`.

### 6a. Status values

Transaction states (API docs, Transaction States), 15: `approved`, `declined`, `pending_async`, `pending_hold`, `pending`, `error`, `refunded`, `chargebacked`, `voided`, `chargeback_reversed`, `represented`, `representment_reversed`, `second_chargebacked`, `pending_review`, `partially_reversed`.

WPF states (API docs, WPF States), 19: `new`, `user`, `timeout`, `in_progress`, `unsuccessful` (documented as not used), `pending`, `pending_hold`, `approved`, `declined`, `error`, `refunded`, `voided`, `chargebacked`, `chargeback_reversal`, `represented`, `representment_reversed`, `second_chargebacked`, `pending_review`, `submitted`.

SDK-only state constants (States.php): `pre_arbitrated`, `invalidated`, `active`, `enabled`, `disabled`, `success`, `cancelled`, `accepted`, `changed`, `deleted`, `received` (several belong to non-payment APIs).

`funds_status` (APM): values are NOT DOCUMENTED as a list; examples show `sent`, `WAITING`, `SUCCEEDED`.

### 6b. Gateway error codes (`code` in responses, `error_code` in notifications)

Source: API docs, Errors. 93 codes in 10 groups: 100-199 system, 200-299 communication, 300-399 input data, 400-499 workflow, 500-599 processing (issuer decline), 600-699 risk, 700-799 tokenization (incl. client-side encryption 750-751), 800-899 KYC, 900-999 issuer/remote. The docs say codes 230-250 must be reconciled because the issuer may have processed the transaction, and that message text may vary per acquirer while the error classes stay the same.

| Code                                                   | Meaning (paraphrase)                                                                                                                   | Category                                                  | Retry class                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| `100`                                                  | general system error                                                                                                                   | provider_unavailable                                      | retry_conditionally                            |
| `101`                                                  | maintenance                                                                                                                            | provider_unavailable                                      | safe_to_retry_technical_request                |
| `110`                                                  | API login failed                                                                                                                       | configuration                                             | do_not_retry                                   |
| `120`                                                  | terminal misconfigured                                                                                                                 | configuration                                             | do_not_retry                                   |
| `200`                                                  | issuer communication failed                                                                                                            | network_or_timeout                                        | manual_review                                  |
| `210`                                                  | issuer connection not established                                                                                                      | network_or_timeout                                        | retry_conditionally                            |
| `220`                                                  | issuer account data invalid                                                                                                            | configuration                                             | manual_review                                  |
| `230`, `240`, `250`                                    | issuer timeout / invalid response / unparsable response; reconcile first                                                               | network_or_timeout (230), provider_unavailable (240, 250) | manual_review                                  |
| `300`, `310`, `320`, `330`, `340`, `350`, `360`        | invalid data / bad transaction type / missing argument / bad format / implausible value / invalid XML / wrong content type             | invalid_request                                           | do_not_retry                                   |
| `400`, `410`, `420`, `430`                             | workflow not allowed / reference not found / wrong workflow / reference already invalidated                                            | invalid_request                                           | do_not_retry                                   |
| `440`                                                  | mismatch with reference (e.g. amount too high)                                                                                         | invalid_amount                                            | do_not_retry                                   |
| `450`                                                  | doublet: same card data and amount within 5 minutes                                                                                    | duplicate_request                                         | do_not_retry                                   |
| `460`, `470`, `471`, `480`, `490`                      | transaction / chargeback / RDR / retrieval request / fraud report not found                                                            | invalid_request                                           | do_not_retry                                   |
| `500`, `501`                                           | declined by issuer / rejected by bank                                                                                                  | card_declined                                             | customer_action_required                       |
| `510`, `520`                                           | invalid card number / expired or invalid expiry                                                                                        | card_declined                                             | customer_action_required                       |
| `511`                                                  | OCT not enabled at issuer                                                                                                              | payment_method_unavailable                                | do_not_retry                                   |
| `530`                                                  | transaction pending                                                                                                                    | unknown                                                   | manual_review                                  |
| `540`                                                  | credit limit exceeded                                                                                                                  | insufficient_funds                                        | customer_action_required                       |
| `550`                                                  | voucher could not be issued                                                                                                            | unknown                                                   | manual_review                                  |
| `551`                                                  | SCA required                                                                                                                           | authentication_required                                   | customer_action_required                       |
| `600`                                                  | declined by risk management                                                                                                            | fraud_or_risk                                             | do_not_retry                                   |
| `601`                                                  | interchange reject                                                                                                                     | unknown                                                   | manual_review                                  |
| `609`, `610`, `611`, `612`, `613`, `614`, `615`        | BIN/billing country mismatch; card, BIN, country, IP or other value blacklisted; card not whitelisted                                  | fraud_or_risk                                             | do_not_retry                                   |
| `620`, `623`, `625`, `626`                             | card limit / unknown-card velocity / user limit exceeded / recent issuer declines (try later)                                          | fraud_or_risk                                             | retry_conditionally                            |
| `621`, `622`                                           | terminal limit / MID limit exceeded                                                                                                    | configuration                                             | manual_review                                  |
| `624`, `628`                                           | ticket size exceeded / recurring amount or count exceeded                                                                              | fraud_or_risk                                             | do_not_retry                                   |
| `627`                                                  | cross-selling filter: already approved on another MID                                                                                  | duplicate_request                                         | do_not_retry                                   |
| `629`, `691`, `692`, `693`, `694`, `696`               | risk filter decline / MaxMind high risk / ThreatMetrix / IP not whitelisted / domain blacklisted / IBAN blacklisted                    | fraud_or_risk                                             | do_not_retry                                   |
| `630`                                                  | on hold for manual review                                                                                                              | fraud_or_risk                                             | manual_review                                  |
| `690`                                                  | AVS failed                                                                                                                             | fraud_or_risk                                             | customer_action_required                       |
| `695`                                                  | fraud error, contact risk team                                                                                                         | fraud_or_risk                                             | manual_review                                  |
| `700`                                                  | general tokenization error                                                                                                             | unknown                                                   | manual_review                                  |
| `701`, `732`                                           | consumer already exists / token already scheme-tokenized                                                                               | duplicate_request                                         | do_not_retry                                   |
| `702`, `703`, `720`, `730`, `750`                      | consumer not found / consumer disabled / bad token type / invalid token / client-side encryption error                                 | invalid_request                                           | do_not_retry                                   |
| `710`, `731`, `740`, `741`, `742`, `743`, `744`, `751` | tokenization not enabled / bad scheme-tokenization config / detokenize, tokenize, update, validate, delete forbidden / CSE not enabled | configuration                                             | do_not_retry                                   |
| `800`                                                  | general KYC error                                                                                                                      | unknown                                                   | manual_review                                  |
| `801`, `802`                                           | unsupported document MIME type / invalid attributes                                                                                    | invalid_request                                           | do_not_retry                                   |
| `803`, `806`                                           | KYC not configured / merchant state disallows KYC                                                                                      | configuration                                             | do_not_retry                                   |
| `804`                                                  | KYC provider error                                                                                                                     | provider_unavailable                                      | retry_conditionally                            |
| `805`                                                  | KYC notification already received                                                                                                      | duplicate_request                                         | do_not_retry                                   |
| `900`, `910`                                           | error at issuer / issuer system error                                                                                                  | provider_unavailable                                      | manual_review (900), retry_conditionally (910) |
| `920`                                                  | issuer configuration error                                                                                                             | configuration                                             | manual_review                                  |
| `930`                                                  | passed data caused issuer error                                                                                                        | invalid_request                                           | do_not_retry                                   |
| `940`                                                  | remote workflow error                                                                                                                  | unknown                                                   | manual_review                                  |
| `950`                                                  | issuer timed out with clearing network                                                                                                 | network_or_timeout                                        | manual_review                                  |

Extra codes only in the PHP SDK Errors.php (not in the API docs): `000` success, `001` undefined error (unknown/unknown), `331` Mastercard format error (invalid_request/do_not_retry), `602` frontend reject (unknown/manual_review), `697` terminal card brand limitation (fraud_or_risk/retry_conditionally), `960` issuer could not reach clearing network (network_or_timeout/manual_review). The SDK lacks docs codes 471, 501, 551, 731, 732, 741-744, 750, 751.

### 6c. Scheme response codes (`scheme_response_code`; `response_code` often carries the same value)

Source: API docs, Scheme Response Codes (Visa table 71 codes, Mastercard and Maestro table 48 codes, 83 distinct). Brand column: V = Visa table, M = Mastercard table. Where the two tables differ, both meanings are given.

| Code(s)                      | Brand                 | Meaning (paraphrase)                                                                                                                    | Category                | Retry class                     |
| ---------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| `00`, `11`                   | V,M / V               | approved / approved (V.I.P.)                                                                                                            | n/a (success)           | n/a                             |
| `10`                         | V,M                   | partial approval                                                                                                                        | n/a (partial success)   | n/a                             |
| `85`                         | V,M                   | not declined (verification only)                                                                                                        | n/a (success)           | n/a                             |
| `01`, `02`                   | V,M / V               | refer to issuer                                                                                                                         | card_declined           | customer_action_required        |
| `03`                         | V,M                   | invalid merchant                                                                                                                        | configuration           | do_not_retry                    |
| `04`, `07`                   | V,M / V               | pick up / capture card                                                                                                                  | fraud_or_risk           | do_not_retry                    |
| `05`                         | V,M                   | do not honour                                                                                                                           | card_declined           | customer_action_required        |
| `06`                         | V                     | error                                                                                                                                   | unknown                 | retry_conditionally             |
| `08`                         | M                     | honour with ID                                                                                                                          | unknown                 | manual_review                   |
| `12`                         | V,M                   | invalid transaction                                                                                                                     | invalid_request         | do_not_retry                    |
| `13`                         | V,M                   | invalid amount                                                                                                                          | invalid_amount          | do_not_retry                    |
| `14`, `15`                   | V,M                   | invalid card number / no such issuer                                                                                                    | card_declined           | customer_action_required        |
| `19`                         | V                     | re-enter transaction                                                                                                                    | network_or_timeout      | retry_conditionally             |
| `21`, `25`, `28`             | V                     | no action taken / record not found / file temporarily unavailable                                                                       | unknown                 | retry_conditionally             |
| `30`                         | M                     | format error                                                                                                                            | invalid_request         | do_not_retry                    |
| `39`, `52`, `53`             | V                     | no credit / checking / savings account                                                                                                  | card_declined           | customer_action_required        |
| `41`, `43`                   | V,M                   | lost / stolen card                                                                                                                      | fraud_or_risk           | do_not_retry                    |
| `46`                         | V,M                   | closed account                                                                                                                          | card_declined           | do_not_retry                    |
| `51`                         | V,M                   | insufficient funds                                                                                                                      | insufficient_funds      | customer_action_required        |
| `54`                         | V,M                   | expired card                                                                                                                            | card_declined           | customer_action_required        |
| `55`                         | V,M                   | incorrect or missing PIN                                                                                                                | authentication_failed   | customer_action_required        |
| `57`                         | V,M                   | not permitted to cardholder                                                                                                             | card_declined           | do_not_retry                    |
| `58`                         | V,M                   | not allowed at terminal/acquirer                                                                                                        | configuration           | do_not_retry                    |
| `59`, `63`, `64`, `83`, `93` | V / V,M / V / M / V   | suspected fraud / security violation / AML requirement / fraud-security / violation of law                                              | fraud_or_risk           | do_not_retry                    |
| `61`                         | V,M                   | exceeds amount limit                                                                                                                    | insufficient_funds      | customer_action_required        |
| `62`                         | V,M                   | restricted card                                                                                                                         | card_declined           | do_not_retry                    |
| `65`                         | V,M                   | V: frequency limit; M: count limit or 3DS soft decline (resubmit with 3DS)                                                              | authentication_required | customer_action_required        |
| `70`                         | V,M                   | V: PIN data required; M: contact issuer                                                                                                 | card_declined           | customer_action_required        |
| `71`, `81`, `82`, `P5`, `P6` | M / V,M / V,M / V / V | PIN not changed / V: PIN crypto error, M: domestic debit not allowed / V: negative CVV checks, M: policy / PIN unblock or change denied | card_declined           | do_not_retry                    |
| `72`                         | M                     | account not yet activated                                                                                                               | card_declined           | customer_action_required        |
| `74`, `86`, `88`             | V / V,M / M           | PIN encryption error / PIN cannot be verified / cryptographic failure                                                                   | authentication_failed   | retry_conditionally             |
| `75`                         | V,M                   | PIN tries exceeded                                                                                                                      | authentication_failed   | do_not_retry                    |
| `76`                         | V,M                   | V: unsolicited reversal; M: invalid "to" account                                                                                        | unknown                 | manual_review                   |
| `77`, `78`                   | M / V,M               | invalid "from" account / V: card blocked on first use, M: invalid account                                                               | card_declined           | customer_action_required        |
| `79`                         | V,M                   | V: already reversed; M: life cycle                                                                                                      | card_declined           | retry_conditionally             |
| `80`                         | V,M                   | V: no financial impact; M: system not available                                                                                         | provider_unavailable    | retry_conditionally             |
| `84`, `87`                   | M                     | invalid authorization life cycle / purchase only, no cashback                                                                           | invalid_request         | do_not_retry                    |
| `89`                         | V,M                   | V: ineligible for GIV; M: unacceptable PIN, retry                                                                                       | authentication_failed   | customer_action_required        |
| `90`                         | M                     | cutoff in progress                                                                                                                      | provider_unavailable    | safe_to_retry_technical_request |
| `91`, `92`, `96`, `1Z`       | V,M / V,M / V,M / M   | issuer inoperative / cannot route / system malfunction / issuer system inoperative                                                      | provider_unavailable    | retry_conditionally             |
| `94`                         | M                     | duplicate transaction                                                                                                                   | duplicate_request       | do_not_retry                    |
| `1A`                         | V                     | soft decline, extra customer authentication needed                                                                                      | authentication_required | customer_action_required        |
| `5C`, `N3`, `N4`, `N5`, `R2` | V                     | blocked by issuer / cash service n/a / cash over limit / not eligible for resubmission / not eligible for Visa PIN                      | card_declined           | do_not_retry                    |
| `6P`, `9G`, `N7`             | V                     | verification data failed / blocked by cardholder / CVV2 failure                                                                         | card_declined           | customer_action_required        |
| `B1`, `B2`, `N8`             | V                     | surcharge not permitted / not supported / amount over preauthorized amount                                                              | invalid_amount          | do_not_retry                    |
| `N0`                         | V                     | force STIP                                                                                                                              | unknown                 | unknown                         |
| `Q1`                         | V                     | card authentication failed                                                                                                              | authentication_failed   | customer_action_required        |
| `R0`, `R1`, `R3`             | V                     | stop payment / revocation of one or all authorizations                                                                                  | card_declined           | do_not_retry                    |
| `Z3`                         | V                     | offline-declined, could not go online                                                                                                   | card_declined           | retry_conditionally             |

Extra issuer codes only in the PHP SDK `getIssuerResponseCode` (16, not in the docs tables): `09` no original, `17` invalid capture date, `20` no "from" account, `22` no checking account, `23` no saving account, `24` no credit account, `34` implausible card data, `42` special pickup, `44` pickup card, `45` transaction back off, `66` exceeds acquirer limit, `67` retain card, `68` response too late, `97` no funds transfer, `98` duplicate reversal, `99` duplicate transaction. Suggested handling: card_declined/do_not_retry, except `68` network_or_timeout/manual_review and `98`, `99` duplicate_request/do_not_retry.

### 6d. Recurring advice codes (`recurring_advice_code`, `recurring_advice_text`), 18

Source: API docs, Recurring Advice.

| Code(s)                                        | Meaning (paraphrase)                                                                         | Category                   | Retry class              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `01`                                           | new account information available                                                            | card_declined              | customer_action_required |
| `02`                                           | try again later                                                                              | card_declined              | retry_conditionally      |
| `03`, `21`                                     | do not try again / recurring payment cancellation service                                    | card_declined              | do_not_retry             |
| `04`, `22`                                     | token requirements not met / merchant does not qualify for product code                      | configuration              | do_not_retry             |
| `24`, `25`, `26`, `27`, `28`, `29`, `30`, `31` | retry after 1 hour, 24 hours, 2, 4, 6, 8, 10 days / retry later (max 15 attempts in 30 days) | card_declined              | retry_conditionally      |
| `40`, `41`, `43`                               | non-reloadable prepaid / single-use VCN / multi-use VCN                                      | payment_method_unavailable | do_not_retry             |
| `42`                                           | sanctions score above threshold                                                              | fraud_or_risk              | do_not_retry             |

### 6e. 3DS authentication status reason codes (`threeds_authentication_status_reason_code`)

Source: API docs, 3DS Status Reason Code (EMVCo values): `01`-`26`, a reserved range `27`-`79`, and `87`.

| Code(s)                                  | Meaning (paraphrase)                                                                  | Category                | Retry class              |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | ------------------------ |
| `01`, `09`, `26`                         | authentication failed / security failure / attempted but not completed by cardholder  | authentication_failed   | customer_action_required |
| `02`, `03`, `20`, `21`, `23`, `24`, `25` | unknown/unsupported device / non-payment or 3RI not supported / decoupled auth issues | authentication_failed   | retry_conditionally      |
| `04`, `19`                               | authentication frequency or max challenges exceeded                                   | authentication_failed   | do_not_retry             |
| `05`, `06`, `08`, `13`                   | expired card / invalid card number / no card record / not enrolled                    | card_declined           | customer_action_required |
| `07`, `12`                               | invalid transaction / not permitted to cardholder                                     | card_declined           | do_not_retry             |
| `10`, `11`                               | stolen card / suspected fraud                                                         | fraud_or_risk           | do_not_retry             |
| `14`, `22`                               | ACS timeout / ACS technical issue                                                     | provider_unavailable    | retry_conditionally      |
| `15`, `16`, `17`, `18`                   | low / medium / high / very high confidence                                            | unknown (informational) | unknown                  |
| `27`-`79`                                | reserved by EMVCo                                                                     | unknown                 | unknown                  |
| `87`                                     | excluded from attempts processing (Visa)                                              | unknown                 | unknown                  |

### 6f. Verification result codes (informational)

- AVS (`avs_response_code`, API docs, AVS Status Codes): single-character `A`-`J` (10 values, from full match to no match and "not sent"); two-character codes are a source prefix (`2` intermediate processor, `5` issuer processor) plus a result letter (`A`, `B`, `C`, `D`, `F`, `G`, `I`, `M`, `N`, `P`, `R`, `S`, `U`, `W`, `X`, `Y`, `Z`). Suggest: mismatch values feed `fraud_or_risk` context only; `R`/`U` mean system unavailable.
- CVV (`cvv_result_code`): `M` match, `N` no match, `S` should be on card, `P` not processed, `U` issuer not participating.
- Cryptogram (`cryptogram_result`, Diners/Discover only): `01`-`06` (pass, fail, unable to validate, CAVV failed, issuer not participating, CAVV unable to authenticate).

Out of scope (exist in the same docs, not listed here): KYC declined reasons (about 179 values), SAFE/TC40 fraud type codes, Payee account verification codes (23) and Payee reason codes (26), Billing API GraphQL error codes (5 per API), SCA exemption values.

---

## 7. Lifecycle

- **Card payment**: `authorize`/`authorize3d` then `capture`, or `sale`/`sale3d`. Synchronous result `approved`/`declined`/`error`; 3DS and redirect APMs return `pending_async` with `redirect_url`, then a notification with the final state. `pending` means outcome unknown (reconcile later); `pending_hold` means user finished but provider update pending; `pending_review` means manual risk review.
- **Void**: allowed on authorize, capture, sale, refund (and 3D variants), same day only; target becomes `voided` (docs portal, Void).
- **Refund**: only after capture; full or partial; target becomes `refunded`. Preauthorizations can become `partially_reversed`.
- **Chargeback**: not merchant-initiated. States `chargebacked` -> `chargeback_reversed` or `represented` -> `representment_reversed` / `second_chargebacked`. Retrieval requests and RDR exist as separate records; notification `event` values: `chargeback`, `chargeback_reversal`, `representment`, `representment_reversal`, `second_chargeback`, `retrieval_request`, `rapid_dispute_resolution`, `rapid_dispute_resolution_reversal`.
- **Recurring**: `init_recurring_sale`(`3d`) then `recurring_sale` referencing it; "Recurring V2" uses card-on-file style initial/subsequent transactions. Managed Recurring (gateway-scheduled) has item fields (`interval`, `period`, `max_count`, `current_count`, `next_date`) and a cancel call returning HTTP 204. Subscription states are NOT DOCUMENTED.
- **Payout**: `credit` (with reference) and `payout` (without reference) transaction types; payout-specific states NOT DOCUMENTED beyond the general state list.
- **APM external events**: may change the original transaction status (e.g. to `voided`, `refunded`, `chargebacked`) and send an `apm_external_event` notification.
- **WPF**: container state machine (`new` -> `user` -> `in_progress`/`submitted` -> final), separate from the payment transaction state inside it.
- Wallet semantics: not applicable to this gateway API (wallet product is separate).

---

## 8. Notifications

| Aspect                | Processing notification                                                                                                                                                                                                                                                                                                                               | WPF notification                                                                                                                                                                                                                                              | APM external event                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When                  | always for async; optionally after every sync transaction (merchant config); also chargeback/retrieval events if enabled                                                                                                                                                                                                                              | when WPF payment reaches final state; also on chargeback                                                                                                                                                                                                      | each APM external event                                                                                                                                                       |
| Format                | form-encoded; content type not stated                                                                                                                                                                                                                                                                                                                 | `application/x-www-form-urlencoded`                                                                                                                                                                                                                           | `application/x-www-form-urlencoded`                                                                                                                                           |
| Key fields            | `transaction_id`, `unique_id`, `transaction_type`, `terminal_token`, `status`, `amount`, `signature`, optional `error_code`, `error_message`, `technical_message`, `event`, `chargeback_unique_id`, `reference_transaction_unique_id`, `rc_code`, `rc_description`, `scheme_response_code`, `recurring_advice_code`, 3DS fields, card/customer fields | `wpf_unique_id`, `wpf_transaction_id`, `wpf_status`, `notification_type=wpf`, `payment_transaction_unique_id`, `payment_transaction_transaction_type`, `payment_transaction_terminal_token`, `payment_transaction_amount`, `signature`, optional error fields | `notification_type=apm_external_event`, `payment_transaction_unique_id`, `category`, `priority` (`info`/`normal`/`urgent`), `code`, `info`, `message`, `payload`, `signature` |
| Signature (sensitive) | hex hash of `unique_id` + API password; SHA-1 default, SHA-256 or SHA-512 on request                                                                                                                                                                                                                                                                  | SHA-512 hex of `wpf_unique_id` + API password                                                                                                                                                                                                                 | SHA-512 hex of `payment_transaction_unique_id` + API password                                                                                                                 |
| Acknowledgement       | XML `<notification_echo><unique_id>...</unique_id></notification_echo>`                                                                                                                                                                                                                                                                               | same with `<wpf_unique_id>`                                                                                                                                                                                                                                   | same with `<unique_id>`                                                                                                                                                       |

- Retry: if the echo XML is not returned, the notification is "sent periodically" until it is. Interval, maximum attempts and duration are NOT DOCUMENTED.
- Ordering: not guaranteed; the WPF section says the notification may arrive before the customer redirect. Merchants are told to verify the signature or reconcile (and are urged to always reconcile).
- Duplicates: no delivery or event ID. Best key: `unique_id` (or `wpf_unique_id`) + `status` (+ `event` and `chargeback_unique_id` for disputes). No timestamp field in notifications.
- The processing notification `status` is documented as `approved`, `declined` or `error`; chargeback/retrieval examples carry `chargebacked`.
- The SDK picks the hash by signature length (40 = SHA-1, 64 = SHA-256, 128 = SHA-512) and classifies notifications as API (`unique_id`), WPF (`wpf_unique_id`) or KYC (`reference_id`). PandaPayLens should not verify signatures (needs the API password).

---

## 9. Identifiers

| Identifier                                                                                 | Where                                                 | Notes                                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `unique_id`                                                                                | responses, processing notifications                   | gateway transaction ID, 32 lowercase hex; used as `reference_id` for capture/void/refund |
| `transaction_id`                                                                           | requests, responses, notifications                    | merchant-generated, string(255)                                                          |
| `reference_id`                                                                             | requests (capture, refund, void, recurring_sale, ...) | parent's `unique_id`, string(32)                                                         |
| `reference_transaction_unique_id`                                                          | processing notifications                              | parent transaction, when present                                                         |
| `wpf_unique_id`, `wpf_transaction_id`                                                      | WPF responses/notifications                           | WPF container IDs; payment inside is `payment_transaction_unique_id`                     |
| `chargeback_unique_id`                                                                     | dispute notifications                                 | the chargeback record that triggered the notification                                    |
| `order_id`                                                                                 | requests/responses (added in 60.6)                    | groups transactions of one business order; merchant flag needed                          |
| `consumer_id`, `token`                                                                     | responses/notifications                               | consumer reference and plain-text card token                                             |
| `arn`, `retrieval_reference_number`, `authorization_code`                                  | reconcile/responses                                   | acquirer/scheme references                                                               |
| `scheme_transaction_identifier`, `scheme_transaction_link_id`, `payment_account_reference` | responses/notifications                               | scheme IDs                                                                               |
| `provider_unique_id`                                                                       | some APMs                                             | provider-side ID                                                                         |
| `terminal_token`                                                                           | URL path, notifications                               | 40 hex; identifies the terminal                                                          |
| managed recurring `unique_id`                                                              | Managed Recurring JSON                                | subscription-like item ID                                                                |

---

## 10. Sensitive fields

- Credentials: API login/password (HTTP Basic, sometimes embedded in URLs as `username:password@`), `terminal_token`, notification `signature`.
- Card data in requests: `card_number`, `cvv`, `expiration_month`, `expiration_year`, `card_holder`; reconcile returns masked `card_number` (e.g. `420000...0000`).
- `token` (plain-text token value), `consumer_id`, `payment_account_reference`.
- Personal data: `customer_email`, `customer_phone`, names, billing/shipping address, `remote_ip`, `document_id`, `account_owner`.
- Bank data: `bank_account_number` (IBAN), `bank_identifier_code`, `account_holder`.
- APM `payload` (raw provider response) may contain anything.

---

## 11. Structural detection hints

Strong Genesis signals:

1. XML root `<payment_response>` with children `transaction_type`, `status`, `mode` (`test`/`live`), `unique_id` (32 hex), `transaction_id`, `sent_to_acquirer`, often `descriptor`, `technical_message` + `message`, integer `code`.
2. XML roots `<wpf_payment>`, `<notification_echo>`, `<reconcile>`, `<payment_transaction>`, `<blacklist_response>`.
3. Form-encoded notification with `unique_id` + `terminal_token` (40 hex) + `transaction_type` + `status` + `signature` (40/64/128 hex), optionally `error_code` + `technical_message`.
4. WPF notification keys with `payment_transaction_` and `wpf_` prefixes and `notification_type=wpf`; APM events with `notification_type=apm_external_event`.
5. Three-digit gateway codes in the documented ranges (`340`, `520`, `600`-`696`) next to two-character `response_code`/`scheme_response_code`.
6. Hosts: `gate.emerchantpay.net`, `wpf.emerchantpay.net`, `api.emerchantpay.net`, `staging.` variants, `/process/`, `/reconcile/`, `/redirect/to_acquirer/`.

Differences from supported providers: Stripe, Adyen, Checkout.com, PayPal, Braintree, Mollie and Square payloads are JSON-centred; none of them uses the Genesis XML roots or the `unique_id` + `terminal_token` notification pair. payabl. uses URL-encoded `transactionid`/`transid`, `errormessage`/`errmsg`, negative codes and a diagnose XML with root `<response>`, not `<payment_response>`.

Differences from other candidates: several candidates (e.g. NMI, Paymentwall, Skrill) also use form-encoded or query-string payloads, so encoding alone is not a signal; require the Genesis key set above. Their exact formats are covered in their own research files, not verified here.

False-positive risk: other Genesis instances. The official SDK names an E-ComProcessing instance (`e-comprocessing.net`) on the same platform; its payloads would match every structural rule except hostnames. Without a host, a parser can only say "Genesis platform", not "emerchantpay".

---

## 12. Limitations, ambiguities, inconsistencies

1. **Truncated signature examples**: the WPF and APM signature tables show 26 to 29 hex characters, and the WPF notification example signature has 56. Offline check: SHA-512 of the documented WPF example (`wpf_unique_id` + example password) begins with the same 56 characters, so the examples are truncated SHA-512 values. The processing notification SHA-1 and SHA-256 examples match exactly. The APM event example signature (66 hex) fits no listed algorithm.
2. **State name drift**: `chargeback_reversed` (transaction states) vs `chargeback_reversal` (WPF states) vs "chargeback reversed" (WPF notification text). The SDK has both, plus `pre_arbitrated`, which the docs do not list; `partially_reversed` is in the docs but not in the SDK.
3. **Docs vs SDK code tables differ** (section 6b, 6c): the SDK adds 6 gateway codes and 16 issuer codes and lacks 11 docs codes.
4. **Odd examples**: the retrieval request notification example has `status=chargebacked`; a declined reconcile example pairs `code` 340 (input data error) with `response_code`/`scheme_response_code` `N7`; a reconcile example contains a stray `<payment_response>code</payment_response>` element; docs portal refund/void examples use `reference_id` `43672`, while the API docs define it as the 32-char `unique_id`.
5. **Processing notification content type** is not stated; examples start with `?` like a query string, while WPF/APM sections say `application/x-www-form-urlencoded`.
6. **Retry schedule, ordering, and delivery IDs** for notifications are NOT DOCUMENTED.
7. **`response_code` semantics** are vague ("result with the acquirer"; contact support). In examples it often equals `scheme_response_code`, but it is a separate field.
8. **Message text varies per acquirer**; only the code classes are stable.
9. **`funds_status` values** are not enumerated and examples differ in case.
10. **Removed feature still referenced**: version 60.8 removed the Account Verification type, but the WPF section still describes `account_verification`.
11. Some SDK-language tabs in the docs say "This request is not implemented yet"; the XML/shell examples are the reliable ones.
12. The 3DS reason code `16` row contains merged text from another field description (docs rendering defect).
13. Many response and notification fields are optional or depend on acquirer and merchant config (AVS, CVV, card fields, scheme fields), so field presence is unreliable.
14. The India gateway docs, eZeeWallet API, KYC, Payee and Billing APIs were not examined.

---

## 13. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                                                                                   |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **supported** | 93 gateway codes in documented range groups with clear meanings and reconcile advice, plus 83 scheme codes, 18 recurring advice codes and 3DS reason codes. Unknown codes can fall back to the range group.                                                                     |
| paymentResponses | **supported** | Stable XML `<payment_response>` and `<wpf_payment>` formats with field tables and many verbatim examples (approved, declined, error, pending_async).                                                                                                                            |
| webhookParsing   | **supported** | Processing, WPF, chargeback, retrieval and APM event notifications have documented field tables and examples with distinctive keys. Caveats: no delivery ID, undocumented retry/ordering, optional fields; signature verification stays out of scope.                           |
| timeline         | **limited**   | Rich state model (15 states incl. dispute chain) and `timestamp` in responses, but notifications carry no timestamp, ordering is not guaranteed, and dispute events are opt-in.                                                                                                 |
| correlation      | **limited**   | `unique_id`, `reference_id`, `reference_transaction_unique_id`, `wpf_unique_id` / `payment_transaction_unique_id` and `chargeback_unique_id` link records, but follow-up responses (refund, void) do not echo the parent ID, so links depend on which payloads the user pastes. |
