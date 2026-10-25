# NETbilling (adapter id `netbilling`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from NETbilling's first-party website and documentation as published on the verification date. Where the documentation is silent the text says **NOT DOCUMENTED**. Category and retry-class columns are **suggestions** made for PandaPayLens, not NETbilling statements.

- Verification date: **2026-10-25**
- Method: every page below was fetched over HTTPS and read in full as text. The member control script `nbmember.cgi` was downloaded and read as plain text only (never executed). No login, sign-up, test transaction or call to any NETbilling endpoint (including `getid3.2`) was made.
- Outcome: **`documentation_verified`** (see section 0). The format is old but public, self-contained and well specified for synchronous responses. Notification coverage is weak.

---

## 0. Qualification gate

| #   | Item                                       | Answer                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active           | yes                                                   | https://www.netbilling.com/ footer: "(c)1998-2026 NETbilling, Inc."; https://www.netbilling.com/news/ lists posts dated Jul 24, 2025 ("NETbilling's Simplified Guide To PCI DSS 4") and Jul 06, 2025. Sales and sign-up pages (https://www.netbilling.com/start/) are live.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2   | Payment service operational                | yes (not tested)                                      | https://www.netbilling.com/transaction-processing/payment-gateway/ markets the gateway with "24/7/365 Dedicated support" and "99.999% Uptime"; the docs index links a live "Gateway Login" (https://secure.netbilling.com/). The Direct Mode 3.2 spec includes a 3-D Secure 2 section, which shows the API has been maintained after 3DS1. Operational status was not tested (no calls).                                                                                                                                                                                                                                                                                                                                  |
| 3   | Developer documentation accessible         | yes (mostly public; some reference tables gated)      | Public without login: Direct Mode 3.2, Direct Mode Batch 3.2, Direct Mode 2.1, Java client javadoc, Payment Form 2.2, Member Update 1.1, Data Retrieval Interface 1.5, Test Mode Responses, Transaction Authorization Message Definitions, NBCheck guide, Assent Key guide (all linked from https://www.netbilling.com/docs/). Behind the merchant login: the AVS and CVV2 code popups ("See the AVS popup window in the online administration system for a list of codes", Direct Mode 3.2 section 3.1), verbose `reason_code2` texts ("Consult the transaction details screen for a declined transaction in the online administration system"), Button Editor, Form Editor, Postback/Control CGI configuration screens. |
| 4   | API families and versions identified       | yes                                                   | Direct Mode 3.2 (`/gw/sas/direct3.2`, "Use version 3.2 for new development" on the docs index), Direct Mode Batch 3.2 (`/gw/sas/directbatch3.2/...`), Direct Mode 2.1 (legacy, `/gw/native/direct2.1`), Payment Form 2.2 (`/gw/native/interactive2.2`, `/gw/native/join2.2b`), Member Update Protocol 1.1 (`/gw/native/mupdate1.1`), Data Retrieval Interface 1.5 (`/gw/reports/transaction1.5`, `/gw/reports/member1.5`). See section 2.                                                                                                                                                                                                                                                                                 |
| 5   | Responses/notifications examinable offline | yes for responses and reports; weak for notifications | Direct Mode 3.2 section 1.5 and 5.4 give full URL-encoded response examples; section 4 gives exception examples; Batch and Data Retrieval docs give CSV examples. The hosted Payment Form return/postback fields are listed (Appendix B) but no example postback body is published.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | Sectors documented by provider             | yes                                                   | See "Sectors" below (quotes from four NETbilling pages).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | Regional/regulatory limitations            | partial                                               | https://www.netbilling.com/about/: "We proudly serve clients across the US, Canada, and the EU". NBCheck (ACH) is tied to NACHA rules and the US ACH network (NBCheck guide). `settle_currency` is "typically "USD"" (Direct Mode 3.2 Table 3.1.1). Mastercard cross-selling restriction (Direct Mode 3.2 section 5.2). A full list of supported countries, currencies or prohibited business types is **NOT DOCUMENTED** publicly.                                                                                                                                                                                                                                                                                       |
| 8   | Adapter gives real diagnostic value        | yes                                                   | Defined `status_code` values (6), a public list of 77 authorization messages (gateway fraud filters, traffic quotas and issuer responses), HTTP exception code ranges, deterministic test-mode rules, membership and recurring-billing status vocabularies, chargeback dispute types.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | Own technical format (not a reseller)      | yes                                                   | NETbilling publishes its own protocol (Direct Mode, `Ecom_Ezic_*` form fields, own CSV reports, own 12-digit IDs). It routes to back-end processors (examples named in the docs: "VITAL, FDR, NOVA", routing prefixes "PTECH", "INT/CX", "FDR-NASH#2"), but those are not exposed as payload formats. Note the reverse case: NETbilling also **emulates** other formats (Authorize.Net 3.0 compatible payment form "Mode A", Verisign compatible "Mode V", and a "Verisign 3 compatibility" port 1403). Payloads produced in those modes look like the emulated provider, not like native NETbilling.                                                                                                                     |
| 10  | No live credentials needed for examples    | yes                                                   | All examples are on public pages. Some examples use test card numbers and fake account IDs (e.g. `account_id=110006559149`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Gate outcome: `documentation_verified`** (items 1-5, 8, 9, 10 are yes). Caveats that do not block the gate but limit capability statuses: notifications are thinly documented (item 5), AVS/CVV2 meanings and `reason_code2` texts are login-gated (item 3), and the decline vocabulary lives in `auth_msg`, which NETbilling says is "not intended to be machine readable".

### Classification

| Class                           | Applies                                                                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`                       | yes (primary)                                                                                   | https://www.netbilling.com/transaction-processing/: "The most flexible and powerful PCI certified payment gateway software ... This a la carte option is designed for those who already have a merchant account." The technical docs describe a gateway that routes to configured processors (Direct Mode 3.2 `processor` parameter).                                                                                      |
| `merchant_account_intermediary` | yes                                                                                             | https://www.netbilling.com/transaction-processing/merchant-accounts/: "we help you secure your own merchant account", "an account you hold directly with a bank", "We work with dozens of acquiring banks worldwide".                                                                                                                                                                                                      |
| `payment_facilitator`           | partial, ACH only (tentative)                                                                   | NBCheck guide (https://secure.netbilling.com/public/docs/merchant/public/achdoc/achguide.html): underwriting "allows us to underwrite as guarantor the ACH transactions processed through our system"; ACH funds flow through a NETbilling "Holding Reserve" and are disbursed to the merchant after a 7-day hold. This is aggregation-like behavior for ACH only. NETbilling does not use the term "payment facilitator". |
| `card_processing`               | not claimed                                                                                     | NETbilling says it provides "transaction processing", but the docs show card authorization going to third-party processors. Treat card processing as performed by the configured processor/acquirer, not by NETbilling.                                                                                                                                                                                                    |
| `acquiring`                     | no                                                                                              | Acquiring is done by the merchant's bank ("an account you hold directly with a bank").                                                                                                                                                                                                                                                                                                                                     |
| `wallet`, `orchestration`       | no                                                                                              | Nothing documented. Multi-processor "load sharing" and "cascading" (`disable_cascading`) exist as gateway routing features, but NETbilling does not describe itself as an orchestration layer.                                                                                                                                                                                                                             |
| `alternative_payment_method`    | no (ACH is NETbilling's only non-card method; "stored value" `pay_type=S` appears in one table) | Direct Mode 3.2 `pay_type` definition lists only `C` and `K`; the parameter group table also shows `pay_type=S (stored value)`.                                                                                                                                                                                                                                                                                            |

### Sectors (only as NETbilling documents them)

| Sector wording (NETbilling's own)                                                                                                                                                                           | Source                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| "Recurring Memberships, Tangible Products, Service Industries, Healthcare, Travel, Gaming, CBD, Adult, Dating, Plus Most Other High And Low Risk Businesses"                                                | https://www.netbilling.com/transaction-processing/online-processing/ |
| "Retail, Restaurants, Recurring Memberships, Tangible Products, Service Industries, Healthcare, Travel, Gaming, CBD, Adult, Dating, Plus Many Other Mainstream and High Risk Businesses"                    | https://www.netbilling.com/transaction-processing/                   |
| "if you're in a high-risk industry (adult, gaming, travel, CBD, and more)"                                                                                                                                  | https://www.netbilling.com/transaction-processing/merchant-accounts/ |
| "e-commerce, retail, restaurants, healthcare, legal, accounting, and call centers ... high-risk sectors such as adult, firearms, tobacco, CBD, and gaming. If your business is legal, NETbilling can help." | https://www.netbilling.com/about/                                    |
| "NETbilling works with any business type and genre including high-risk, e-commerce, mobile, and card-present businesses."                                                                                   | footer of https://www.netbilling.com/docs/                           |

Notes:

- "Gaming" is not defined. Do not equate it with iGaming/gambling; NETbilling does not say "gambling" or "casino" anywhere read.
- "Subscription" appears as "Recurring Memberships" and through the membership/rebilling feature set; this is a product feature as well as a listed business type.
- The API has hotel-industry parameters (`hotel_*`, `mcc_override`). That is an API feature, not a sector statement.
- Eligibility always depends on jurisdiction, licensing, card-scheme rules and NETbilling/acquirer underwriting. Being listed on a marketing page does not mean a given merchant will be approved.

---

## 1. Sources

All URLs were read on 2026-10-25. None of the pages carries a last-updated date; the "Age hint" column records dates visible inside the page.

| URL                                                                                                                                                                                                                                                                                               | Age hint                                | What it covers                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| https://www.netbilling.com/docs/                                                                                                                                                                                                                                                                  | footer 2026                             | Documentation index (start page)                                                                                                               |
| https://www.netbilling.com/transactional-information-lists/                                                                                                                                                                                                                                       | footer 2026                             | **Transaction Authorization Message Definitions**: transaction status messages, origins, all authorization messages                            |
| https://secure.netbilling.com/public/docs/merchant/popup/popup-testmode.html                                                                                                                                                                                                                      | none                                    | **Test Mode Responses**: amount-driven approve/decline, AVS and CVV2 results                                                                   |
| https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode3protocol.html                                                                                                                                                                                                     | examples 2004, 2010; 3DS2 section       | **Direct Mode 3.2**: request params, response params, exceptions, ID generation, repeat billing, recurring, 3DS2                               |
| https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode3batchprotocol.html                                                                                                                                                                                                | examples 2004, 2010                     | Direct Mode Batch 3.2: CSV upload/status/download                                                                                              |
| https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode21.html                                                                                                                                                                                                            | legacy                                  | Direct Mode 2.1 (`RET_*` fields, `poll1.0`)                                                                                                    |
| https://secure.netbilling.com/public/docs/merchant/public/netbilling-direct-javadoc/ (plus `overview-summary.html`, `allclasses-frame.html`, `constant-values.html`, `com/netbilling/direct/V3Client.Response.html`, `com/netbilling/net/ServerException.html`)                                   | "Copyright(c) 1999-2019", version 3.1.1 | Official Java client: response parameter constants                                                                                             |
| https://secure.netbilling.com/public/docs/merchant/public/directmode/software-netbilling/                                                                                                                                                                                                         | n/a                                     | Directory listing of `direct-java-3.1.1.jar` (jar not downloaded)                                                                              |
| https://secure.netbilling.com/public/docs/merchant/public/nativespecs/ezicPaymentForm22.html                                                                                                                                                                                                      | none                                    | **Payment Form 2.2** (hosted form): status codes, return/postback fields, crypto-hash, Authorize.Net and Verisign emulation, self-cancellation |
| https://secure.netbilling.com/public/docs/merchant/public/nativespecs/ezicHiddenForm.html                                                                                                                                                                                                         | none                                    | Hidden form tutorial (read including the HTML form source)                                                                                     |
| https://secure.netbilling.com/public/docs/merchant/public/nativespecs/template_editor.html                                                                                                                                                                                                        | none                                    | Hosted form HTML template editor (no payload content)                                                                                          |
| https://secure.netbilling.com/public/docs/merchant/public/membershipsetup/membership-setup.html                                                                                                                                                                                                   | none                                    | Membership site setup, Control CGI, grace period, rebilling options                                                                            |
| https://secure.netbilling.com/public/docs/merchant/public/membershipmanage/access-keyword.html                                                                                                                                                                                                    | none                                    | Access Keyword for membership control posts                                                                                                    |
| https://secure.netbilling.com/public/nbmember.cgi and https://secure.netbilling.com/public/nbmember.cfg                                                                                                                                                                                           | script `$VERSION = '2.3'`               | Official member control script (read as text): parameters of Control CGI posts                                                                 |
| https://secure.netbilling.com/public/docs/merchant/public/directmode/mupdate1.1.html                                                                                                                                                                                                              | none                                    | **Member Update Protocol 1.1**: member and recurring fields and statuses                                                                       |
| https://secure.netbilling.com/public/docs/merchant/public/directmode/repinterface1.5.html                                                                                                                                                                                                         | examples 2004-2013                      | **Data Retrieval Interface 1.5**: transaction and member CSV reports, dispute rows, recurring statuses                                         |
| https://secure.netbilling.com/public/docs/merchant/public/achdoc/achguide.html                                                                                                                                                                                                                    | none                                    | NBCheck (ACH) guide: ACH statuses, returns, holding/risk reserve                                                                               |
| https://secure.netbilling.com/public/docs/agent/public/directmode/assent_key.html                                                                                                                                                                                                                 | none                                    | NBCheck assent key (customer authorization checkbox)                                                                                           |
| https://www.netbilling.com/old/pdfs/NETbilling_ACH_2-25-08.pdf                                                                                                                                                                                                                                    | 2008                                    | NBCheck best practices (NACHA 1% rule)                                                                                                         |
| https://www.netbilling.com/old/pdfs/nbcheckupgradefaq.pdf                                                                                                                                                                                                                                         | 2008 era                                | NBCheck NACHA enforcement FAQ                                                                                                                  |
| https://secure.netbilling.com/public/docs/merchant/public/mobilepaymentform/Netbilling_Mobile_Payment_Form.pdf                                                                                                                                                                                    | none                                    | Mobile payment form customization (no payload content)                                                                                         |
| https://www.netbilling.com/ , /transaction-processing/ , /transaction-processing/online-processing/ , /transaction-processing/merchant-accounts/ , /transaction-processing/payment-gateway/ , /transaction-processing/phone-swipe/ , /transaction-processing/retail-processing/                   | footer 2026                             | Business model, sectors, products                                                                                                              |
| https://www.netbilling.com/about/ , /about/why-netbilling/ , /news/ , /start/ , /tos/                                                                                                                                                                                                             | news Jul 2025                           | Activity, regions, sectors                                                                                                                     |
| https://www.netbilling.com/resources/processing-overview/ , /resources/processing-overview/direct-mode-processing/ , /resources/processing-overview/hosted-payment-form/ , /resources/processing-overview/chargeback/ , /resources/admin-area-overview/ , /resources/shopping-cart-compatibility/ | none                                    | Direct Mode port 1402 requirement, postback overview, chargeback import behavior, fraud tool names                                             |

Not read (no payload content expected, or out of scope): the Payment Form HTML Editor PDF, the Email Editor and Site Tags PDF, the Email Manager tutorial, `direct-java-3.1.1.jar`.

---

## 2. API families and versions in scope

| Family                                 | Endpoint(s)                                                                                                                                                                            | Request format                                                 | Response format                                                                                                                                | Relevance                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Direct Mode 3.2** (server-to-server) | `secure.netbilling.com` port 1402 (HTTPS; 1401 HTTP "for testing ONLY"): `/gw/sas/direct3.2` (transactions), `/gw/sas/settle3.2` (batch settlement), `/gw/sas/getid3.2` (ID generator) | `application/x-www-form-urlencoded`                            | `application/x-www-form-urlencoded` on HTTP 200; exceptions as non-200 HTTP status with `text/plain`, empty body; settlement as CSV            | **Primary.** The payload a developer is most likely to paste.                                                |
| **Payment Form 2.2** (hosted / hidden) | `https://secure.netbilling.com/gw/native/interactive2.2` (sales, auths), `https://secure.netbilling.com/gw/native/join2.2b` (memberships)                                              | browser form POST, `Ecom_*` field names                        | Return URL redirect (POST or GET) and optional Postback CGI with `Ecom_Ezic_Response_*` fields; field names and encoding configurable per form | **Primary for notifications** (only documented server-to-merchant transaction post).                         |
| Data Retrieval Interface 1.5           | `https://secure.netbilling.com/gw/reports/transaction1.5`, `.../member1.5`                                                                                                             | form-encoded                                                   | CSV with header line (`text/x-comma-separated-values`; errors `text/plain`)                                                                    | **Secondary, high timeline value** (status messages, dates, `master_id`, disputes, member/recurring status). |
| Direct Mode Batch 3.2                  | `/gw/sas/directbatch3.2/{validate,upload,start,stop,status,download}` on ports 1401/1402                                                                                               | CSV (`text/comma-separated-values`)                            | CSV results; job status as form-encoded; counts in HTTP headers                                                                                | Secondary                                                                                                    |
| Member Update Protocol 1.1             | `https://secure.netbilling.com/gw/native/mupdate1.1`                                                                                                                                   | form-encoded                                                   | HTTP 200 plain text, or form-encoded fields for `GET`; HTTP 400 plain text on error                                                            | Secondary (subscription state)                                                                               |
| Direct Mode 2.1 (legacy)               | `https://secure.netbilling.com/gw/native/direct2.1`, `.../getid1.0`, `.../poll1.0`                                                                                                     | form-encoded, `GEN_*`/`CARD_*`/`CUST_*` names                  | "cgi-encoded" `RET_*` fields; HTTP 400 + text body on error                                                                                    | Low (legacy, but origin `ND2.TRANS` still appears in reports)                                                |
| Control CGI (membership sync)          | merchant-hosted URL called by NETbilling                                                                                                                                               | form POST (`cmd`, `u`, `p`/`w`/`m`/`n`, `keyword`, `site_tag`) | n/a                                                                                                                                            | Out of scope (password sync, not payment events)                                                             |
| Authorize.Net / Verisign emulation     | `.../interactive2.2?x_Login`, port 1403                                                                                                                                                | emulated formats                                               | emulated formats                                                                                                                               | Out of scope; see section 9                                                                                  |

NETbilling versions endpoints in the path (`direct3.2`, `interactive2.2`, `mupdate1.1`, `transaction1.5`). Direct Mode 3.2 says: "Existing software developed for older versions will continue to work without modification."

**Recommendation: implement first** the Direct Mode 3.2 synchronous response (form-encoded body, plus the HTTP status-line exceptions). Second, the hosted Payment Form return/postback fields with default `Ecom_Ezic_Response_*` names. Third, the Data Retrieval Interface transaction CSV, which is the best documented source of lifecycle state (status messages, refunds, chargebacks, rebills via `master_id`).

---

## 3. Response and error formats

### 3.1 Content type and encoding

- **Direct Mode 3.2 transactions** (auth, sale, refund, credit, capture): "All standard transactions ... return URL encoded ("application/x-www-form-urlencoded" content-type) response data." Clients "MUST NOT depend on the order of the response fields" and "MUST ignore unknown fields (additional response parameters may be added without prior notice)". The example status line is `HTTP/1.0 200 OK Approved`.
- **Direct Mode 3.2 exceptions**: reported as HTTP status codes other than 200, with `Content-Type: text/plain` and `Content-Length: 0`. The error text is only in the HTTP reason phrase (e.g. `HTTP/1.0 604 Missing Parameter (account_id)`). A pasted exception may therefore be just a status line.
- **Batch settlement** (`settle3.2`): CSV ("text/comma-separated-values"), first line is the header.
- **Direct Mode Batch**: CSV in and out; job status (`start`, `status`) as form-encoded; record counts and batch ID in HTTP headers (`Rejected-Records`, `Accepted-Records`, `Batch-Id`).
- **Data Retrieval Interface**: CSV, all values double-quoted, embedded double quotes are removed (not escaped), header line required to map columns ("column ordering may change"). The text says `text/x-comma-separated-values`, but the transaction example shows `Content-Type: text/plain`.
- **Payment Form return / postback**: form POST or GET (Return Method setting); the redirect after a hidden form is always GET. Field names can be renamed in the Form Editor and the "encoding of these fields" can be switched to Authorize.Net or Verisign style. HTTP content type of the postback is **NOT DOCUMENTED**.
- **Member Update 1.1**: HTTP 200 + plain text message, or form-encoded parameters for `C_COMMAND=GET`; HTTP 400 + plain text on error.
- **Character set**: **NOT DOCUMENTED** for any interface. Direct Mode 3.2 describes `%XX` escaping of "the encoded ASCII character".
- **JSON / XML**: none. The only JSON in the docs is inside the base64 3-D Secure `creq`/`cres` blobs, which are EMVCo messages, not NETbilling formats.

### 3.2 Direct Mode 3.2 response fields (Table 3.1.1)

| Field             | Type / shape (as documented)                           | Meaning                                                                                                                                         |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `status_code`     | single character                                       | Outcome (section 4.1). Unknown values other than `0` and `F` count as success.                                                                  |
| `trans_id`        | 12-digit numeric string                                | NETbilling transaction ID; echoes the request `trans_id` if one was sent, except for duplicates where the original ID is returned.              |
| `auth_code`       | "A 6 digit (alphanumeric) authorization code"          | Bank authorization code. Test mode examples show `999999`.                                                                                      |
| `auth_date`       | `YYYY-MM-DD HH:MM:SS`, GMT/UTC                         | When the system authorized the transaction.                                                                                                     |
| `auth_msg`        | free text                                              | "APPROVED 123456", "DECLINED 05" etc. "processor specific, may change, and are not intended to be machine readable". Vocabulary in section 4.3. |
| `avs_code`        | single character                                       | AVS result. Code list only in the login-gated admin popup.                                                                                      |
| `cvv2_code`       | single character                                       | CVV2 result. Code list only in the login-gated admin popup.                                                                                     |
| `ticket_code`     | string                                                 | "Typically not used. Processor specific additional transaction reference code."                                                                 |
| `reason_code2`    | string                                                 | "Typically not used. Processor specific additional DECLINE-reason code." Meanings only in the admin transaction details screen.                 |
| `member_id`       | 12-digit ID                                            | Returned when a new member was created.                                                                                                         |
| `recurring_id`    | ID                                                     | Returned when a recurring billing record was created.                                                                                           |
| `settle_amount`   | decimal                                                | Amount actually billed; differs from request amount for Dynamic Currency Conversion or partial approval (MC gift cards).                        |
| `settle_currency` | currency code, "typically "USD""                       | Settlement currency.                                                                                                                            |
| `processor`       | routing prefix, e.g. `PTECH`, `INT/CX#5`, `FDR-NASH#2` | Processor used. Can be sent back on later requests.                                                                                             |
| `card_flags`      | `P` or absent                                          | Prepaid card flag.                                                                                                                              |
| `3ds_url`         | URL                                                    | Only with `enable_3ds_mpi`: ACS URL for the 3DS2 challenge.                                                                                     |
| `3ds_creq`        | base64 string                                          | Only with `enable_3ds_mpi`: challenge request to POST to the ACS.                                                                               |

The official Java client (`V3Client.Response`, javadoc 3.1.1) defines constants for `auth_code`, `auth_date`, `auth_msg`, `avs_code`, `cvv2_code`, `member_id`, `reason_code2`, `recurring_id`, `status_code`, `ticket_code`, `trans_id` and an `isSuccess()` method; it says future parameter names can be read as plain strings. `settle_amount`, `settle_currency`, `processor`, `card_flags`, `3ds_url`, `3ds_creq` are in the 3.2 spec only.

There is **no currency or amount echo** other than `settle_amount`/`settle_currency`, **no merchant order reference echo** (Direct Mode has no order-ID request field; `description`, `user_data`, `misc_info` are stored but not returned), and **no `orig_id` echo** on refunds, captures or undo.

### 3.3 Hosted Payment Form 2.2 response fields (Appendix B, default names)

| Field                                      | Meaning                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ecom_Ezic_Response_StatusCode`            | Single-character outcome (section 4.2).                                                                                                                             |
| `Ecom_Ezic_Response_AuthCode`              | Six-character processor authorization code.                                                                                                                         |
| `Ecom_Ezic_Response_AuthMessage`           | Plain text status/failure message, "Usually something like, "Successful," or "Failed, BAD AVS.""                                                                    |
| `Ecom_Ezic_Response_TransactionID`         | NETbilling 12-digit transaction ID.                                                                                                                                 |
| `Ecom_Ezic_Response_Card_AVSCode`          | AVS result.                                                                                                                                                         |
| `Ecom_Ezic_Response_Card_VerificationCode` | CVV2 result.                                                                                                                                                        |
| `Ecom_Ezic_Response_IssueDate`             | Date the transaction was issued.                                                                                                                                    |
| `Ecom_Ezic_Response_StatusSubCode`         | "Unused. Currently returns same value as Ecom_Ezic_TransactionStatus".                                                                                              |
| `Ecom_Ezic_ProofOfPurchase_MD5`            | Return crypto-hash (section 6.3). Sensitive.                                                                                                                        |
| all request fields                         | "All fields you pass into our payment page are passed back", including `Ecom_ConsumerOrderID`, `Ecom_Cost_Total`, `Ecom_Ezic_AccountAndSitetag`, `Ecom_UserData_*`. |

Authorize.Net-style names in Mode A: `x_response_code`, `x_response_reason_text`, `x_auth_code`, `x_avs_code`, `x_trans_id`, `x_Invoice_Num`, `x_Amount`. Verisign-style names in Mode V: `RESULT`, `RESPMSG`, `AUTHCODE`, `AVSDATA`, `PNREF`. These "have special encoding" when toggled; the exact encoded values are **NOT DOCUMENTED**.

### 3.4 Examples (transcribed)

Example A: Direct Mode 3.2 auth-only in test mode. **Source: https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode3protocol.html section 1.5** (response transcribed verbatim):

```
HTTP/1.0 200 OK Approved
Connection: close
Content-Type: application/x-www-form-urlencoded
Content-Length: 160

auth_msg=TEST+APPROVED&ticket_code=XXXXXXXXXXXXXXX&avs_code=X&auth_date=2004-06-09+22%3A55%3A08&status_code=T&trans_id=109704163690&auth_code=999999&cvv2_code=M
```

Example B: Direct Mode 3.2 response when the built-in 3DS2 MPI needs a challenge (no authorization has happened yet; the transaction is stored like a `tran_type=Q` record). **Source: same page, section 5.4** (verbatim; the `3ds_creq` value is a base64 EMVCo CReq):

```
status_code=T&settle_amount=1.61&processor=FDR-NASH#2&settle_currency=USD&trans_id=210742956290&auth_msg=OFFLINE+RECORD&3ds_url=https%3A%2F%2Fwww%2Ethreedsecurempi%2Ecom%2FEMVTDS%2FAUT%3FAction%3DProcessCReq&3ds_creq=eyJtZXNzYWdlVmVyc2lvbiIgOiAiMi4xLjAiLCJtZXNzYWdlVHlwZSIgOiAiQ1JlcSIsInRocmVlRFNTZXJ2ZXJUcmFuc0lEIiA6ICI2N2VhNTY5My1mZDljLTQyNmQtYmNkYi01ZTM3ODdkMGMwZjciLCJhY3NUcmFuc0lEIiA6ICJmYjM5NjE4ZC03MTFhLTRmN2MtOWEyZi04NTRhZGQ1OWVkOTIiLCJjaGFsbGVuZ2VXaW5kb3dTaXplIiA6ICIwNCJ9
```

Note: `processor=FDR-NASH#2` contains an unescaped `#` in the example. A parser must not treat `#` as a fragment delimiter.

Example C: exceptions. **Source: same page, sections 4.1 and 4.2** (verbatim):

```
HTTP/1.0 604 Missing Parameter (account_id)
Connection: close
Content-Type: text/plain
Content-Length: 0
```

```
HTTP/1.0 699 20112: Invalid card expiration date 0x09
Connection: close
Content-Type: text/plain
Content-Length: 0
```

Other documented shapes (described, not transcribed in full):

- Batch settlement CSV header `"STATUS","PAY_TYPE","ID","REPORT_DATE","CLOSE_BALANCE","CLOSE_MSG"` with an example close message `TEST BATCH`.
- Direct Mode Batch job status: `approvals=3&total_records=3&status=FINISHED&records_done=3&exceptions=0&declines=0`; batch result CSV appends `"TRANS_ID","STATUS","AVS_RESULT","CVV2_RESULT","AUTH_CODE","AUTH_MSG","LOCAL_AUTH_DATE"` to every uploaded column (including the full `CARD_NUMBER`).
- Data Retrieval transaction CSV header in the example: `"TRANS_ID","TRANS_STATUS_MSG","TRANS_STATUS_CODE","SITE_TAG","ORIGIN","ISSUE_DATE","MEMBER_ID","AMOUNT","AUTH_MSG","CARD_TYPE","CARD_NUMBER","CARD_EXPIRE","DESCRIPTION","BILL_NAME1","BILL_NAME2","CUSTOMER_IP","CUSTOMER_HOST","CUSTOMER_EMAIL","MISC_INFO","USER_DATA"`; rows show e.g. `SALE/OPEN`, `1`, `ND3.TRANS`, `TEST APPROVED`, masked card `xxxxxxxxxxxx1111`.
- Data Retrieval member CSV header: `"SITE_TAG","MEMBER_ID","MEMBER_STATUS","PREVIOUS_MEMBER_STATUS","STATUS_CHANGE_DATE","MEMBER_USER_NAME","SIGNUP_DATE","EXPIRE_DATE","EMAIL_ADDRESS","RECURRING_STATUS","RECURRING_NEXT_DATE","RECURRING_PERIOD","RECURRING_PERIODS_LEFT","RECURRING_AMOUNT","NEXT_RECURRING_AMOUNT"`; rows show `BROKEN: TOO MANY FAILURES` with `RECURRING_NEXT_DATE` `4000-01-01 00:00:00` (a sentinel far-future date).
- Data Retrieval exception: `HTTP/1.1 456 No valid authorization for requested site_tag(s)`; `HTTP/1.1 503 Service Unavailable` with `Retry-After: 60`.

---

## 4. Codes

Category and retry columns are **suggestions**. Meanings are short paraphrases; see the source URL for NETbilling's wording.

### 4.1 Direct Mode 3.2 `status_code` (source: directmode3protocol.html Table 3.1.1): 6 values

| Code      | Paraphrase                                                                                                                            | Suggested category                                              | Suggested retry                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `1`       | Monetary transaction succeeded                                                                                                        | (success)                                                       | n/a                            |
| `I`       | Pending, e.g. an unfunded check                                                                                                       | (pending)                                                       | n/a                            |
| `T`       | Auth-only succeeded. Also returned with `auth_msg=OFFLINE RECORD` + `3ds_url` when a 3DS2 challenge is pending (no authorization yet) | (success) / authentication_required when `3ds_url` present      | n/a / customer_action_required |
| `0`       | Failed; read `auth_msg` and `reason_code2`                                                                                            | from `auth_msg` (4.3)                                           | from `auth_msg`                |
| `F`       | Settlement failure or returned NBCheck; not used at authorization time                                                                | provider_unavailable (settlement) or card_declined (ACH return) | manual_review                  |
| `D`       | Duplicate; the original transaction's `trans_id` is returned                                                                          | duplicate_request                                               | do_not_retry                   |
| any other | Docs: treat as success for forward compatibility                                                                                      | unknown                                                         | unknown                        |

### 4.2 Status code vocabularies in other interfaces

| Code | Payment Form 2.2 (`Ecom_Ezic_Response_StatusCode`)              | Direct Mode 2.1 (`RET_STATUS`)                     | Data Retrieval (`trans_status_code`)   |
| ---- | --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `1`  | approved, money moved                                           | successful                                         | successful                             |
| `I`  | incomplete/pending (ACH, or card approved but batch not closed) | incomplete but successful (check)                  | pending (unfunded NBCheck)             |
| `T`  | ticket: AUTH or AVS-only good                                   | successful auth-only                               | successful auth-only                   |
| `0`  | failure                                                         | failed                                             | failed                                 |
| `F`  | failure                                                         | failed                                             | settlement failure or returned NBCheck |
| `R`  | refunded (rare in this context)                                 | returned/voided ("will not occur in this context") | refunded                               |
| `D`  | duplicate, already approved (Appendix B only)                   | NOT DOCUMENTED                                     | NOT DOCUMENTED                         |
| `Z`  | NOT DOCUMENTED                                                  | NOT DOCUMENTED                                     | transaction has been undone            |

Distinct status characters across interfaces: 8 (`1`, `I`, `T`, `0`, `F`, `D`, `R`, `Z`). `F` means "failure" on the hosted form and in 2.1 but "settlement failure or return" in 3.2 and reports; context must decide.

Batch settlement `STATUS` (settle3.2): `1` settled, `0` failed to settle, `O` (letter) nothing open to settle; other values count as success. Direct Mode Batch job `status`: `STARTING`, `FINISHED` are the only documented values.

### 4.3 Authorization messages (`auth_msg`, `Ecom_Ezic_Response_AuthMessage`, report `AUTH_MSG`)

Source: https://www.netbilling.com/transactional-information-lists/ ("All NETbilling generated "Auth Messages" and all known bank responses are included", but the page also says information "may change from time to time and may not be immediately updated here"). 77 entries in five groups. Match on the **whole message text**, not on the trailing number: several numbers are reused with different labels (see section 10).

Generic decline (1):

| Message    | Paraphrase                                  | Category      | Retry                    |
| ---------- | ------------------------------------------- | ------------- | ------------------------ |
| `DECLINED` | Issuer decline with no detail (most common) | card_declined | customer_action_required |

AVS/CVV2 gateway filters (2): the gateway aborted the transaction because the result was not in the merchant's accepted list.

| Message         | Paraphrase                                   | Category      | Retry                    |
| --------------- | -------------------------------------------- | ------------- | ------------------------ |
| `BAD ADDRESS`   | AVS result not acceptable to merchant rules  | fraud_or_risk | customer_action_required |
| `CVV2 MISMATCH` | CVV2 result not acceptable to merchant rules | fraud_or_risk | customer_action_required |

Fraud Defense (8): rejected before any authorization attempt.

| Message      | Paraphrase                                                         | Category        | Retry                    |
| ------------ | ------------------------------------------------------------------ | --------------- | ------------------------ |
| `A/DECLINED` | Exceeded traffic limits                                            | fraud_or_risk   | manual_review            |
| `B/DECLINED` | Matched blacklist or high-risk country list                        | fraud_or_risk   | do_not_retry             |
| `C/DECLINED` | Country of origin on high-risk list                                | fraud_or_risk   | do_not_retry             |
| `E/DECLINED` | Email address not valid                                            | invalid_request | customer_action_required |
| `I/DECLINED` | Country mismatch between IP, card and address                      | fraud_or_risk   | manual_review            |
| `J/DECLINED` | Profane or suspicious content (check disabled in Virtual Terminal) | fraud_or_risk   | manual_review            |
| `L/DECLINED` | Failed US location verification                                    | fraud_or_risk   | manual_review            |
| `R/DECLINED` | High-risk country or anonymous domain                              | fraud_or_risk   | do_not_retry             |

Traffic limits (5): rejected before authorization; on the hosted form the customer goes to the Give Up URL.

| Message            | Paraphrase                                          | Category       | Retry         |
| ------------------ | --------------------------------------------------- | -------------- | ------------- |
| `A/QUOTA EXCEEDED` | Per-card dollar volume limit exceeded               | fraud_or_risk  | manual_review |
| `C/QUOTA EXCEEDED` | Count of credits/refunds in period exceeded         | configuration  | manual_review |
| `M/QUOTA EXCEEDED` | Per-transaction amount limit exceeded               | invalid_amount | do_not_retry  |
| `R/QUOTA EXCEEDED` | Dollar volume of credits/refunds in period exceeded | configuration  | manual_review |
| `S/QUOTA EXCEEDED` | Count of sales in period exceeded                   | configuration  | manual_review |

The NBCheck guide adds the wildcard forms `?/DECLINED` and `?/QUOTA EXCEEDED` for checks, which shows the letter prefix is a single variable character.

Issuing bank responses (61), as listed by NETbilling:

| Message                  | Paraphrase                                              | Category                   | Retry                    |
| ------------------------ | ------------------------------------------------------- | -------------------------- | ------------------------ |
| `ACCT FROZEN`            | Account frozen                                          | card_declined              | customer_action_required |
| `APPROVED`               | Authorized                                              | (success)                  | n/a                      |
| `CALL 01`                | Refer to issuer                                         | card_declined              | customer_action_required |
| `CALL 02`                | Refer to issuer, special condition                      | card_declined              | customer_action_required |
| `NO REPLY 28`            | File temporarily unavailable                            | provider_unavailable       | retry_conditionally      |
| `NO REPLY 91`            | Issuer switch unavailable                               | provider_unavailable       | retry_conditionally      |
| `HOLD-CALL 04`           | Pick up card                                            | fraud_or_risk              | do_not_retry             |
| `HOLD-CALL 07`           | Pick up card, special condition                         | fraud_or_risk              | do_not_retry             |
| `HOLD-CALL 41`           | Pick up card, lost                                      | fraud_or_risk              | do_not_retry             |
| `HOLD-CALL 43`           | Pick up card, stolen                                    | fraud_or_risk              | do_not_retry             |
| `ACCT LENGTH ERR`        | Verification error EA                                   | invalid_request            | customer_action_required |
| `ALREADY REVERSED 79`    | Already reversed at switch                              | duplicate_request          | do_not_retry             |
| `AMOUNT ERROR 13`        | Invalid amount                                          | invalid_amount             | do_not_retry             |
| `CANT VERIFY PIN 83`     | PIN cannot be verified                                  | authentication_failed      | customer_action_required |
| `CANT VERIFY PIN 86`     | PIN cannot be verified                                  | authentication_failed      | customer_action_required |
| `CARD NO. ERROR 14`      | Invalid card number                                     | invalid_request            | customer_action_required |
| `CASHBACK NOT APP 82`    | Cashback limit exceeded                                 | invalid_amount             | do_not_retry             |
| `CASHBACK NOT AVL N3`    | Cashback not available                                  | payment_method_unavailable | do_not_retry             |
| `CHECK DIGIT ERR`        | Verification error EB                                   | invalid_request            | customer_action_required |
| `CID FORMAT ERROR`       | Verification error EC                                   | invalid_request            | customer_action_required |
| `CVV2 MISMATCH N7`       | Issuer says CVV2 does not match                         | card_declined              | customer_action_required |
| `DATE ERROR 80`          | Invalid date                                            | invalid_request            | customer_action_required |
| `DECLINE 02`             | Needs force with voice authorization                    | card_declined              | manual_review            |
| `DECLINE 05`             | Do not honor                                            | card_declined              | customer_action_required |
| `DECLINE 51`             | Insufficient funds                                      | insufficient_funds         | retry_conditionally      |
| `DECLINE N4`             | Over issuer withdrawal limit                            | insufficient_funds         | retry_conditionally      |
| `DECLINE 61`             | Over withdrawal limit                                   | insufficient_funds         | retry_conditionally      |
| `DECLINE 62`             | Invalid/restricted service code                         | payment_method_unavailable | do_not_retry             |
| `DECLINE 65`             | Activity limit exceeded                                 | card_declined              | retry_conditionally      |
| `DECLINE 93`             | Violation, cannot complete                              | card_declined              | do_not_retry             |
| `DECLINE AVS 06`         | Declined for AVS                                        | card_declined              | customer_action_required |
| `ENCRYPTION ERROR 81`    | Cryptographic error                                     | configuration              | manual_review            |
| `ERROR CODE 98`          | Unknown error                                           | unknown                    | unknown                  |
| `EXPIRED CARD 54`        | Expired card                                            | card_declined              | customer_action_required |
| `FAILURE CV`             | Card type not accepted                                  | payment_method_unavailable | customer_action_required |
| `Failure HV`             | Account set up incorrectly at creation                  | configuration              | manual_review            |
| `GENERAL ERROR 98`       | Probably an empty value, seen when CVV2 is blank        | invalid_request            | customer_action_required |
| `INV MERCH NUM 19`       | Invalid merchant ID                                     | configuration              | manual_review            |
| `Invalid Account Number` | Bad account number length or format                     | invalid_request            | customer_action_required |
| `INVALID BANK ACT`       | Invalid bank account                                    | invalid_request            | customer_action_required |
| `INVALID ROUTING 92`     | Destination not found                                   | invalid_request            | customer_action_required |
| `INVALID TRANS 12`       | Invalid transaction (maybe bad account number)          | invalid_request            | do_not_retry             |
| `NO ACCOUNT 78`          | No account                                              | card_declined              | customer_action_required |
| `No Acct/Cannot Locate`  | No account exists                                       | invalid_request            | customer_action_required |
| `NO ACTION TAKEN 21`     | Could not back out transaction                          | unknown                    | manual_review            |
| `NO ACTION TAKEN 76`     | Could not locate, no match                              | unknown                    | manual_review            |
| `NO ACTION TAKEN 77`     | Inconsistent data, reversal or repeat                   | duplicate_request          | manual_review            |
| `NO CHECK ACCOUNT 52`    | No checking account                                     | card_declined              | customer_action_required |
| `NO CREDIT ACCT 39`      | No credit account                                       | card_declined              | customer_action_required |
| `NO SAVE ACCOUNT 53`     | No savings account                                      | card_declined              | customer_action_required |
| `NO SUCH ISSUER 15`      | No such issuer                                          | invalid_request            | customer_action_required |
| `OFFLINE RETURN`         | Refund of a check or credit transaction (informational) | (lifecycle: refund)        | n/a                      |
| `PIN EXCEEDED 75`        | PIN tries exceeded                                      | authentication_failed      | do_not_retry             |
| `RE ENTER 19`            | Re-enter transaction                                    | network_or_timeout         | retry_conditionally      |
| `SEC VIOLATION 63`       | Security violation                                      | fraud_or_risk              | do_not_retry             |
| `SERV NOT ALLOWED 57`    | Not permitted for this card                             | payment_method_unavailable | do_not_retry             |
| `SERV NOT ALLOWED 58`    | Not permitted for this terminal                         | configuration              | manual_review            |
| `SYSTEM ERROR 96`        | System malfunction                                      | provider_unavailable       | retry_conditionally      |
| `TERM ID ERROR 03`       | Invalid merchant ID                                     | configuration              | manual_review            |
| `WRONG PIN 55`           | Incorrect PIN                                           | authentication_failed      | customer_action_required |
| `XXXXXXXXXXXXXXXX XX`    | Undefined response (placeholder pattern)                | unknown                    | unknown                  |

Other `auth_msg` texts seen in documentation examples (not in the definitions page): `TEST APPROVED` (test mode, Direct Mode and report examples), `OFFLINE RECORD` (3DS2 challenge pending, section 3.4 B), "APPROVED 123456" and "DECLINED 05" (format examples in Table 3.1.1), "Successful," and "Failed, BAD AVS." (hosted form wording). The membership setup page names a hosted form error "CRYPTOGRAPHIC DIGEST ERROR" (spelled "CRYTPGRAPHIC" on the page), meaning the crypto-hash did not match: category configuration, retry do_not_retry. The NBCheck guide lists `ACH/FAIL` as a message (the definitions page uses `ACH/FAILED`).

### 4.4 HTTP exceptions

Direct Mode 3.2 (section 4.2):

| Code / range | Paraphrase                                                                   | Category        | Retry                    |
| ------------ | ---------------------------------------------------------------------------- | --------------- | ------------------------ |
| 600-698      | Most likely invalid input; reason phrase is human-readable                   | invalid_request | do_not_retry             |
| 700-798      | Most likely a processing error; reason phrase is human-readable              | unknown         | retry_conditionally      |
| 699, 799     | General codes; reason phrase starts with a 5-digit machine-readable sub-code | (by sub-code)   | (by sub-code)            |
| 604          | Example: `Missing Parameter (account_id)`                                    | invalid_request | do_not_retry             |
| 699 `20112`  | Example: invalid card expiration date                                        | invalid_request | customer_action_required |

The full list of 6xx/7xx codes and 5-digit sub-codes is **NOT DOCUMENTED**. NETbilling explicitly recommends not coding per-exception handling. A declined transaction is never an exception; it is a 200 response with `status_code=0`.

Data Retrieval Interface 1.5: `503 Service Unavailable` + `Retry-After` (provider_unavailable or rate_limiting, safe_to_retry_technical_request after the delay), `456 No valid authorization for requested site_tag(s)` (configuration, do_not_retry). Excessive usage "triggers automatic IP lock-out for up to 24 hours" (rate_limiting; the HTTP code is NOT DOCUMENTED).

Member Update 1.1 and Direct Mode 2.1: HTTP `400` with a plain-text reason in the body (individual texts NOT DOCUMENTED). Batch validation returns CSV rows `"LINE","ERROR","DATA"`, e.g. `Invalid AMOUNT`.

### 4.5 Test mode responses (source: popup-testmode.html)

Test mode applies when the account is in Global Test Mode (all new accounts start there) or when the stored test card/check number is used. Fraud controls (AVS/CVV2, Fraud Defense) still run in test mode. After the fraud screens, the outcome depends on the amount:

| Amount digit (whole dollars) | Drives       | Values                                                                           |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------- |
| tens                         | auth message | `0`-`8` -> APPROVED, `9` -> DECLINED                                             |
| hundreds                     | AVS result   | `0` X, `1` Y, `2` W, `3` Z, `4` A, `5` N, `6` G, `7` U, `8` R, `9` "?" (invalid) |
| thousands                    | CVV2 result  | `0` M, `1` N, `2` P, `3` S, `4` U, `5`-`8` M, `9` "?" (invalid)                  |

So $1-$89 approve, $90-$99 decline, $190-$199 decline with AVS `Y`, and so on. For amounts "over 10000 ... Last 4 digits determine response". The table on the page starts the thousands bands at `1001`, `2001`, ... rather than `1000`, `2000` (edge values like exactly $1000.00 are unclear). Documentation examples show test approvals as `auth_msg=TEST APPROVED`, `status_code=T` or `1`, `auth_code=999999`, `avs_code=X`, `cvv2_code=M`. The meanings of the AVS and CVV2 letters are **NOT DOCUMENTED** publicly (admin popup only). Test NBCheck accounts use a stored test account number such as `123456789:12345678900`.

Diagnostic use: a PandaPayLens adapter can flag a pasted response as "test mode" when `auth_msg` starts with `TEST` and can explain that, in test mode, a decline is driven by the amount's tens digit.

### 4.6 Count summary

| Group                                                    | Count                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Direct Mode 3.2 `status_code` values                     | 6                                                                               |
| Distinct status characters across all interfaces         | 8                                                                               |
| Batch settlement `STATUS` values                         | 3                                                                               |
| Authorization messages on the definitions page           | 77 (1 generic, 2 AVS/CVV2 filter, 8 Fraud Defense, 5 quota, 61 bank)            |
| Extra `auth_msg` texts seen only in examples/other pages | 4 (`TEST APPROVED`, `OFFLINE RECORD`, `CRYPTOGRAPHIC DIGEST ERROR`, `ACH/FAIL`) |
| HTTP exception ranges / specific codes                   | 3 ranges + 604, 699/20112, 456, 503, 400                                        |
| Transaction status messages (`trans_status_msg`)         | 23                                                                              |
| Transaction origins                                      | 11                                                                              |
| Member statuses                                          | 6                                                                               |
| Recurring billing statuses                               | 14                                                                              |
| Dispute types                                            | 3                                                                               |
| Test-mode AVS / CVV2 result values                       | 10 / 6                                                                          |

---

## 5. Lifecycle

### 5.1 Transaction types (Direct Mode 3.2 `tran_type`)

`A` authorize only; `S` sale; `Q` quasi/quiet (store card data, nothing sent to processor); `R` refund of a previous sale, partial allowed, "auth-reversal is performed when possible"; `C` credit without a previous sale; `U` undo ("support varies by processor"); `D` capture a previous auth or `Q` record; `J` authorize a previous `Q` record without capturing; `B` batch settlement (via `settle3.2`, "usually automatic"). Direct Mode 2.1 used words: `AVS`, `AUTH`, `CAPTURE`, `SALE`, `CREDIT`, `REFUND`, `NONE` (member signup only), `ABORT` (abort pending capture). The hosted form only does `SALE` and `PREAUTH`; voids, refunds and credits are done in the Virtual Terminal.

### 5.2 Transaction status messages (`trans_status_msg`, definitions page): 23

Card: `AUTH/OK`, `AUTH/FAILED`, `SALE/OPEN` (approved, not settled, voidable), `SALE/OK` (settled, funds moved), `SALE/FAILED`, `SALE/CB` (was `SALE/OK`, then charged back and imported), `SALE/NOP` and `SALE/ERROR` (manual, very rare), `S/REFUNDED` (the original sale after a refund; the refund is a separate transaction), `REFUND/OPEN` (card refund not settled, not voidable), `REFUND/OK`, `REFUND/FAILED`, `CREDIT/OPEN`, `CREDIT/OK`.

ACH (NBCheck): `ACH/ISSUED` (before the daily cut-off, can be cancelled), `ACH/PENDING` (sent to the ACH network), `ACH/OK`, `ACH/FAILED` (failed fraud screening or invalid, never submitted), `ACH/RETURN` (returned by the bank), `ACH/REFUNDED`, `ACH.CB/ISSUED` (check chargeback), `REFUND/ISSUED`, `REFUND/PENDING`.

Suggested card timeline: `AUTH/OK` -> capture (`D`; report `capture_date`) -> `SALE/OPEN` -> `SALE/OK` -> optional `S/REFUNDED` (+ separate `REFUND/OPEN` -> `REFUND/OK`) or `SALE/CB`. Undo -> `trans_status_code=Z`. NETbilling notes a sale that fails AVS rules is automatically voided (two transactions); accounts can be configured to run sales as auth + automatic capture.

Suggested ACH timeline: `ACH/ISSUED` -> `ACH/PENDING` -> `ACH/OK` | `ACH/RETURN` (report `return_code` with a NACHA code such as `R01`) | `ACH.CB/ISSUED`. Settlement typically 7 calendar days, NACHA dispute window 60 days (NBCheck guide).

### 5.3 Transaction origins (`origin`): 11

`AUTO-REFUND`, `V-TERM`, `N2.SIGNUP`, `N2.PURCHASE`, `ND2.TRANS`, `ND3.TRANS`, `ND3.SIGNUP`, `RAD.TEST` (system test, test account only), `BA.TRANS` (batch upload), `RETRY` (rare manual internal retry), `RECURRING` (automatic rebill). The Data Retrieval spec lists only 8 of these.

### 5.4 Subscription / membership / rebill

- Creation: a Direct Mode `A` or `S` with `site_tag`, `member_username`, `member_duration` (+ `recurring_amount`, `recurring_period`, optional `recurring_count`, `recurring_prorate`). Response adds `member_id` and `recurring_id`. Origin becomes `ND3.SIGNUP` / `N2.SIGNUP`. A free trial is documented as an auth (e.g. $1.00) with a membership duration, later rebills are sales.
- Rebills are created by NETbilling with origin `RECURRING`; report `master_id` holds the original transaction's `trans_id`. Rebill card data comes from the "template" transaction (`R_TEMPLATE_TRANS_ID`).
- Failed rebill: "By default, if a rebilled member fails to be rebilled, their membership is suspended", with an optional grace period "from 12 hours to 4 weeks" (membership setup page).
- Member statuses (Data Retrieval and Member Update): `PENDING` (created, not activated / no payment yet), `ACTIVE`, `ACTIVE/R` (self-cancelled; becomes `RESIGNED` at next rebill date), `RESIGNED`, `DISABLED` (manually disabled), `EXPIRED` (finished all rebillings). Report also has `previous_member_status` and `status_change_date`.
- Recurring statuses (Data Retrieval; "Status messages are subject to change"): `NO REBILLING`; `BROKEN: INVALID TEMPLATE ID`, `BROKEN: TOO MANY FAILURES`; `RUNNING: INVALID TEMPLATE ID`, `RUNNING: RETRYING FAILED ATTEMPT`, `RUNNING: RETRYING AFTER DECLINE`, `RUNNING: RETRYING AFTER EXCEPTION`, `RUNNING: STOP AT NEXT DUE DATE`, `RUNNING: OK`; `STOPPED: NO MORE PAY PERIODS`, `STOPPED: NO CREDIT CARD`, `STOPPED: INVALID TEMPLATE ID`, `STOPPED: ERROR: JOB MISSING`, `STOPPED: OK`. Suggested reading: prefix (`RUNNING`/`BROKEN`/`STOPPED`/`NO REBILLING`) is the state, the suffix is the reason. Retry cadence for `RETRYING ...` is **NOT DOCUMENTED**.
- Cancellation: customer self-cancellation URL (sets `ACTIVE/R`, "rebillings will stop"); Member Update `STOP_RECURRING` / `START_RECURRING` / `CHANGE_STATUS` (`ACTIVE`, `DISABLED`, `ACTIVE/R` settable).
- Repeat billing without a membership: `card_number=CS:<trans_id>` (same account) or `CS:<trans_id>:<last4>` (cross-sell to an affiliate account; "MasterCard no longer permits cross-selling").

### 5.5 Refunds, chargebacks, payouts

- Refund: `tran_type=R` with `orig_id`; creates a new transaction; original shows `S/REFUNDED`. System refunds have origin `AUTO-REFUND`.
- Chargebacks: report rows with `dispute_type` `A` (arbitration, funds taken: the typical chargeback), `R` (retrieval request, funds may be held), `W` (merchant won, funds released); several rows per transaction in order as a dispute progresses; `dispute_post_date` (bank, may be back-dated), `dispute_report_date` (system), `dispute_msg` (acquirer-specific reason). Chargeback import from banks "are often incomplete or missing" and merchants must mark chargebacks manually (chargeback page). NBCheck disputes use `disputes_after` with `original_id`/`original_date`.
- Payouts/merchant funding: card settlement via batch (`settle_id` groups transactions per batch); ACH funds disbursed after a 7-day hold minus Risk Reserve. No payout API or payout states are documented. **Wallet transfers: not applicable.**

---

## 6. Notifications / postbacks

### 6.1 What exists

| Mechanism               | Trigger                                   | Payload                                                                                                                                                               | Documentation depth       |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Return URL redirect     | Hosted form transaction finished          | All request fields + `Ecom_Ezic_Response_*` fields, browser POST or GET                                                                                               | Field list only           |
| **Postback CGI URL**    | "After processing each transaction"       | "transaction data" (same set as the return, by the docs' description)                                                                                                 | One paragraph; no example |
| Give Up URL             | Too many failed attempts or traffic limit | NOT DOCUMENTED                                                                                                                                                        | Mention only              |
| Control CGI             | Member add/remove, refresh, nightly sync  | `cmd` (`test`, `append_user(s)`, `delete_user(s)`, `update_all_users`, `list_all_users`), `u`, one of `p`/`w`/`m`/`n` password forms, `keyword`, `site_tag`, `prefix` | Script source only        |
| Email receipts          | Transactions, signups, self-cancellation  | Templates                                                                                                                                                             | Out of scope              |
| "Dispute notifications" | Marketing bullet on the gateway page      | NOT DOCUMENTED                                                                                                                                                        | None                      |

Direct Mode itself has **no asynchronous notification**: results come back "on the same socket". Status after a lost response is recovered with a pre-assigned `trans_id` (from `getid3.2`) and the reporting interface (2.1 had `poll1.0`).

### 6.2 Event types

There are **no event-type fields**. A postback is one transaction result. The kind of event must be inferred from `Ecom_Ezic_Response_StatusCode`, `Ecom_Ezic_Payment_AuthorizationType` (`SALE`/`PREAUTH`) and membership fields. Whether rebills, refunds, chargebacks, cancellations or expirations produce postbacks is **NOT DOCUMENTED** (the Control CGI gets member list changes, not payment results). Suggested synthetic event types for PandaPayLens: `payment.approved` (`1`), `payment.pending` (`I`), `authorization.approved` (`T`), `payment.failed` (`0`/`F`), `payment.duplicate` (`D`), `payment.refunded` (`R`), plus `membership.signup` when `Ecom_Ezic_Membership_UserName` is present. These are PandaPayLens names, not NETbilling events.

### 6.3 Signature fields (sensitive; verification out of scope)

- Request integrity: `Ecom_Ezic_Security_HashValue_MD5` = MD5 of (Crypto-hash Key + values of the fields named in `Ecom_Ezic_Security_HashFields`, in that order). At least two fields are required. Direct Mode 2.1 used `GEN_HASHFIELDS` / `GEN_HASHVALUE_MD5`.
- Return integrity: `Ecom_Ezic_ProofOfPurchase_MD5` = MD5 of (key + `Ecom_Ezic_Response_TransactionID` + `Ecom_Ezic_Response_StatusCode` + the hashed field values). The docs describe it for the return to the merchant CGI; whether it is also present on the Postback CGI call is NOT DOCUMENTED.
- Control CGI posts are authenticated by the shared Access Keyword (`keyword`). Member Update uses `C_CONTROL_KEYWORD`; Data Retrieval uses `authorization` keywords plus IP allow-listing; Direct Mode uses IP allow-listing or `dynip_sec_code`.
- PandaPayLens should mask all of these and never attempt verification (it would need the secret key).

### 6.4 Duplicates, retries, ordering

- Duplicate detection: `trans_id` is unique per transaction; Direct Mode returns `status_code=D` with the original `trans_id` for duplicates. The rules that decide what counts as a duplicate are NOT DOCUMENTED (the gateway page mentions "rules to avoid duplicated decline orders").
- Postback retry policy, expected acknowledgement, timeout, ordering and source IPs: **NOT DOCUMENTED**.
- Reports: Data Retrieval ranges are half-open ("on or after the start-time, until immediately before the end-time") so that boundary records appear exactly once; dispute rows for one transaction are delivered in order.

---

## 7. Identifiers

| Identifier                                                                         | Where                                                                                                                                                  | Notes                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trans_id`                                                                         | DM 3.2 request/response, reports, batch `TRANS_ID`                                                                                                     | 12 digits ("Max Field Size" 12). Can be pre-assigned from `getid3.2` ("You should never send a "home made" trans_id"). Every refund, capture, rebill gets its own ID. |
| `Ecom_Ezic_Response_TransactionID` / `RET_TRANS_ID` / `x_trans_id` / `PNREF`       | hosted form, DM 2.1, emulation modes                                                                                                                   | Same NETbilling ID under other names.                                                                                                                                 |
| `orig_id`                                                                          | DM 3.2 request only (`R`, `D`, `U`, `J`, 3DS completion)                                                                                               | Parent transaction. Not echoed in the response.                                                                                                                       |
| `master_id`                                                                        | Data Retrieval report                                                                                                                                  | "For refunds or recurring billing, this is the trans_id of the original transaction." Best parent link for timelines.                                                 |
| `original_id`, `original_date`                                                     | Data Retrieval (NBCheck disputes only)                                                                                                                 | Original of an ACH chargeback.                                                                                                                                        |
| `GEN_MASTER_ID`                                                                    | DM 2.1 request                                                                                                                                         | Parent for 2.1 refunds.                                                                                                                                               |
| `member_id` / `M_MEMBER_ID`                                                        | DM 3.2 response, reports, Member Update                                                                                                                | 12 digits; links member to transactions.                                                                                                                              |
| `recurring_id`                                                                     | DM 3.2 response                                                                                                                                        | Recurring record. Not present in reports or Member Update (which key on member).                                                                                      |
| `M_SIGNUP_TRANS_ID`, `R_TEMPLATE_TRANS_ID`                                         | Member Update `GET`                                                                                                                                    | Signup transaction, and the template transaction rebills copy card data from (may differ).                                                                            |
| `CS:<trans_id>[:<last4>]`                                                          | DM 3.2 `card_number` value                                                                                                                             | Stored-card reference for repeat/cross-sell billing. Treat as sensitive.                                                                                              |
| `ticket_code`, `processor_rec_id`                                                  | DM 3.2 response / reports                                                                                                                              | Processor references; `processor_rec_id` may change after settlement.                                                                                                 |
| `settle_id` / batch `ID`                                                           | reports / settle3.2                                                                                                                                    | Settlement batch.                                                                                                                                                     |
| `Batch-Id`                                                                         | Direct Mode Batch HTTP header                                                                                                                          | Upload batch (not settlement).                                                                                                                                        |
| `account_id` / `Ecom_Ezic_AccountAndSitetag` (`<account>:<SITETAG>`) / `C_ACCOUNT` | everywhere                                                                                                                                             | 12-digit merchant/agent account; site tag up to 12 chars.                                                                                                             |
| Merchant reference                                                                 | `Ecom_ConsumerOrderID` (hosted, max 20) or `x_Invoice_Num`; `description`, `user_data`, `misc_info`, `Ecom_UserData_*`, `affiliate_tag`, `purch_order` | Direct Mode has no dedicated order-ID field and returns none of these.                                                                                                |
| 3DS: `threeDSSessionData`                                                          | merchant-to-ACS POST                                                                                                                                   | NETbilling suggests base64url-encoding the `trans_id` into it (example `MjEwNzQyOTU2Mjkw` = `210742956290`).                                                          |

---

## 8. Sensitive fields

Mask or drop on paste:

- Card data: `card_number` (and `CS:` references), `card_expire`, `card_cvv2`, `card_track1`, `card_track2`, `card_pin`, `card_start_date`, `card_issue_number`, `force_code`; hosted `Ecom_Payment_Card_Number`, `Ecom_Payment_Card_Verification`, `Ecom_Payment_Card_ExpDate_*`; 2.1 `CARD_NUMBER`, `CARD_CVV2`, `CARD_EXPIRE`, `CARD_FORCE_CODE`; emulation `x_Card_Num`, `x_Exp_Date*`, `CARDNUM`, `EXPDATE*`. **Batch result CSVs echo the full uploaded `CARD_NUMBER`.**
- Bank/ACH data: `account_number` (`<aba>:<account>`), `Ecom_Payment_Bank_PayerRoutingNumber`, `Ecom_Payment_Bank_PayerAccountNumber`, `ACH_ROUTING`, `ACH_ACCOUNT`, `x_Bank_ABA_Code`, `x_Bank_Acct_Num`; report `card_number` holds the partial routing:account for NBCheck.
- Government IDs: `bill_tax_id_no` (SSN/TIN), `bill_photo_id_no`, `bill_photo_id_state`, `bill_birth_date`, `Ecom_Payment_Bank_PayerSSN`, `Ecom_Payment_Bank_PayerPhotoID*`, `ACH_ID_SSN`, `ACH_ID_DL`, `ACH_ID_TAXID`, `DLNUM`.
- Secrets and auth: `dynip_sec_code`, Crypto-hash Key, `Ecom_Ezic_Security_HashValue_MD5`, `Ecom_Ezic_ProofOfPurchase_MD5`, `GEN_HASHVALUE_MD5`, Access Keyword (`keyword`, `C_CONTROL_KEYWORD`), Data Retrieval `authorization`, `assent_key`.
- Member credentials: `member_password`, `Ecom_Ezic_Membership_PassWord`, `.Verify_Password`, `MEM_PASS`, `M_MEMBER_PASSWORD`, Control CGI `p`/`w`/`m`/`n`.
- 3-D Secure: `3ds_cavv`, `3ds_xid`, `3ds_creq`, `3ds_cres`, `creq`, `cres`, `threeDSSessionData`.
- Personal data: names, street, city, zip, phone, email (`bill_*`, `ship_*`, `cust_*`, `Ecom_BillTo_*`, `Ecom_ShipTo_*`, `CUST_*`, `x_*` address fields), `cust_ip`, `cust_host`, `cust_browser`, `member_username`/`M_MEMBER_LOGIN`; free-text `description`, `misc_info` (for NBCheck it contains the customer's agreement text and date), `user_data`, `member_memo`.
- Safe to show: `status_code`, `auth_msg`, `auth_code`, `avs_code`, `cvv2_code`, `trans_id`, `member_id`, `recurring_id`, `settle_amount`, `settle_currency`, `processor`, `card_flags`, status/origin values, masked `xxxxxxxxxxxx1111`.

---

## 9. Structural detection hints

Strong NETbilling markers:

- Direct Mode 3.2 response: form-encoded with `status_code` (single char) together with `trans_id` and at least one of `auth_msg`, `auth_date`, `avs_code`, `cvv2_code`, `ticket_code`, `reason_code2`, `settle_amount`, `settle_currency`, `processor`, `3ds_url`, `3ds_creq`. `auth_date` format `YYYY-MM-DD HH:MM:SS` (often `+`-encoded space). `trans_id` is 12 digits.
- `auth_msg` vocabulary: `TEST APPROVED`, `OFFLINE RECORD`, `X/DECLINED`, `X/QUOTA EXCEEDED`, `HOLD-CALL NN`, `NO REPLY NN`, `SERV NOT ALLOWED NN`.
- Exception status line: `HTTP/1.x 6NN ...` or `7NN ...`, especially `699 NNNNN: ...` (5-digit sub-code). Non-standard 6xx/7xx HTTP codes are rare elsewhere.
- Hosted form: any `Ecom_Ezic_` prefix (`Ecom_Ezic_Response_StatusCode`, `Ecom_Ezic_Response_TransactionID`, `Ecom_Ezic_AccountAndSitetag`, `Ecom_Ezic_ProofOfPurchase_MD5`). Plain `Ecom_*` names come from the ECML standard and are not unique; the `Ezic` segment is.
- Hosts and paths: `secure.netbilling.com`, ports `1401`/`1402`/`1403`, `/gw/sas/direct3.2`, `/gw/sas/getid3.2`, `/gw/native/interactive2.2`, `/gw/native/join2.2b`, `/gw/native/mupdate1.1`, `/gw/reports/transaction1.5`.
- Reports: CSV header containing `TRANS_STATUS_MSG`, `TRANS_STATUS_CODE`, `ORIGIN` with values like `SALE/OPEN`, `ND3.TRANS`, `N2.SIGNUP`, `RECURRING`; member CSV with `RECURRING_STATUS` values like `RUNNING: OK`.
- Direct Mode 2.1: `RET_STATUS`, `RET_TRANS_ID`, `RET_AUTH_MSG`, `RET_AVS_CODE`, `RET_CVV2_CODE`, `RET_CARD_ISSUER`.
- Member Update: `M_MEMBER_STATUS`, `R_RECURRING_SCHEDULE`, `R_TEMPLATE_TRANS_ID`, `M_SIGNUP_TRANS_ID`.

Distinguishing from supported providers: Stripe, Adyen, Checkout.com, PayPal, Braintree, Mollie and Square payloads are JSON (or Adyen notification JSON/form with `pspReference`, `eventCode`); NETbilling never uses JSON. payabl. is also form-encoded, but uses `transactionid`, `status`/`errorcode`, `errormessage`, `orderid`, `security`; it has none of `status_code`, `trans_id`, `auth_msg`.

Against other high-risk candidates: no shared field set is known from NETbilling's documentation. Final collision checks belong in each candidate's own research file. The main risks are:

- **Emulation modes**: a NETbilling hosted form in Authorize.Net mode returns `x_response_code`, `x_trans_id`, `x_response_reason_text`, `x_auth_code`, `x_avs_code`; in Verisign mode `RESULT`, `PNREF`, `RESPMSG`, `AUTHCODE`, `AVSDATA`. These must not be attributed to NETbilling without a host or `Ecom_Ezic_*` marker, and NETbilling's re-encoding of the status values in those modes is NOT DOCUMENTED.
- Generic names `trans_id`, `auth_code`, `avs_code`, `status_code` alone are weak. Require `status_code` + `trans_id` + one NETbilling-specific key (`auth_msg`, `auth_date`, `ticket_code`, `reason_code2`, `settle_amount`) before claiming high confidence.

---

## 10. Limitations, ambiguities and documentation inconsistencies

1. **Decline detail lives in free text.** `auth_msg` is "processor specific, may change, and are not intended to be machine readable". Decoding must be text matching with an `unknown` fallback. `reason_code2` meanings are login-gated.
2. **Reused numbers with different labels** in the bank list: `19` (`INV MERCH NUM 19` vs `RE ENTER 19`), `98` (`ERROR CODE 98` vs `GENERAL ERROR 98`), `02` (`CALL 02` vs `DECLINE 02`), `CVV2 MISMATCH` (gateway filter) vs `CVV2 MISMATCH N7` (issuer). Also two unrelated "Invalid Merchant ID" entries (`INV MERCH NUM 19`, `TERM ID ERROR 03`). Match whole messages.
3. **AVS and CVV2 code meanings are not public** (admin popup only). The test mode page lists the letters without meanings.
4. **Exception sub-codes not published**: only ranges, `604` and `699 20112` are documented.
5. **Status code drift between interfaces**: `F` = failure (hosted form, 2.1) vs settlement failure/return (3.2, reports); `R` and `Z` exist only in some interfaces; `D` is missing from 2.1 and reports. The hosted form response table says "I = Ticket", contradicting its own earlier text ("T" - Ticket) and every other interface; treat it as a typo.
6. **`status_code=T` is overloaded**: the 3DS2 challenge example returns `T` with `auth_msg=OFFLINE RECORD` although nothing was authorized. "Any unexpected status code other than "0" and "F" should be interpreted as a successful transaction" also makes unknown future codes look successful.
7. **Test-mode wording**: the test mode page says the message is `APPROVED`/`DECLINED`, while every Direct Mode and report example shows `TEST APPROVED`. The thousands bands start at `1001`, `2001` ..., leaving whole-thousand amounts unclear; "over 10000 ... Last 4 digits" is not explained further.
8. **Status message spelling**: `ACH/FAILED` (definitions page) vs `ACH/FAIL` (NBCheck guide).
9. **Origins list**: Data Retrieval lists 8 origins; the definitions page lists 11 (`AUTO-REFUND`, `RAD.TEST`, `RETRY` missing in the spec).
10. **Member statuses**: `RESIGNED` appears in Data Retrieval and in the `ACTIVE/R` description but not in the Member Update status list. Rebill retry timing behind `RETRYING ...` statuses is not documented.
11. **Content-type mismatches**: Data Retrieval says `text/x-comma-separated-values` but its transaction example shows `text/plain`; batch settle and batch files use `text/comma-separated-values`.
12. **Example defects**: Data Retrieval member request example uses `transactions_after=2006-12-30&transactions_before=2006-03-01` (end before start); `processor=FDR-NASH#2` with an unescaped `#`; DM 3.2 example request includes `card_cvv2=111` while declaring `Content-Length: 104` for a longer body.
13. **Control CGI parameter name**: the setup page's help text lists `challenge = <authentication token>`, but the official script reads the keyword from `keyword`. The access-keyword page refers to `ezmember.cfg` while the download is `nbmember.cfg`.
14. **Field size vs prose**: `assent_key` is "14-digit" in the Assent Key guide but has a max size of 16 in Direct Mode 3.2.
15. **Java client versions**: docs index says "Direct Mode 3.1 Java Client", the spec calls it the client "for Direct Mode 3.2", the jar is 3.1.1 (javadoc copyright 1999-2019).
16. **Postback under-documented**: no example body, content type, acknowledgement, retry, ordering, source IP or signature statement for the Postback CGI. Field names and encodings are configurable per payment form, so real postbacks may not use default `Ecom_Ezic_*` names at all.
17. **Chargeback data is best-effort**: NETbilling states chargeback imports are often incomplete and merchants must mark chargebacks manually.
18. **Age**: much of the documentation dates from 2004-2013 (examples, 2.1 references to FDR-OMAHA, VITAL, NOVA). Only the 3DS2 section and marketing pages are clearly recent. Behavior of current processors may differ from examples.
19. **Regional/regulatory**: served regions are "the US, Canada, and the EU" (About page); NBCheck is US ACH under NACHA rules (assent key + customer IP mandatory, 1% "not-authorized" return threshold, 60-day dispute window, `nbcheck.com` descriptor); settlement currency is typically USD with DCC as an exception; FDR-OMAHA accounts must be single-threaded (2.1 doc). A list of supported countries, currencies and prohibited business types is not published.

---

## 11. Proposed capability statuses

| Capability           | Proposed         | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **limited**      | The `status_code` set (6) and exception ranges are clear, and the public definitions page gives 77 authorization messages with meanings, including NETbilling's own Fraud Defense and quota rejections. But these messages are explicitly not machine-readable and may change, several numbers are reused with different labels, `reason_code2`, AVS and CVV2 meanings are login-gated, and 6xx/7xx sub-codes are unpublished. Text matching with an `unknown` fallback gives useful but not authoritative decoding. |
| **paymentResponses** | **supported**    | Direct Mode 3.2 responses have a fully specified field table, a fixed content type, two verbatim examples (normal and 3DS2 challenge) and documented exceptions. The hosted form return fields and Direct Mode 2.1 `RET_*` fields are also listed. Parsing is straightforward form decoding.                                                                                                                                                                                                                         |
| **webhookParsing**   | **experimental** | The only server-to-merchant transaction post is the hosted form Postback CGI, described in one paragraph with no example, no event types, no delivery/retry/ack rules and per-form configurable field names and encodings. Parsing default `Ecom_Ezic_Response_*` names is possible but cannot be validated against a published sample. Control CGI posts are password sync, not payment events.                                                                                                                     |
| **timeline**         | **limited**      | Good raw material exists: `auth_date`, status message vocabulary (`AUTH/OK` -> `SALE/OPEN` -> `SALE/OK` -> `S/REFUNDED`/`SALE/CB`; ACH `ISSUED` -> `PENDING` -> `OK`/`RETURN`), report `issue_date`/`capture_date`, ordered dispute rows with dates, member `status_change_date` and recurring statuses. But most of it comes from CSV reports rather than events, single responses carry one state only, and rebill retry timing is undocumented.                                                                   |
| **correlation**      | **limited**      | `trans_id` is a stable 12-digit key and reports give `master_id` (refunds, rebills), `member_id`, `original_id` (ACH disputes), `settle_id`. Synchronous responses do not echo `orig_id` or any merchant order reference, `recurring_id` does not appear in reports, and the hosted form merchant reference (`Ecom_ConsumerOrderID`) is optional. Linking a refund or capture response to its parent needs the pasted request or a report row.                                                                       |
