# Nuvei (adapter id `nuvei`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Nuvei's first-party documentation, Nuvei's own website and Nuvei's official SDK repositories as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: pages on `docs.nuvei.com` were discovered through the site's own sitemap (`https://docs.nuvei.com/wp-sitemap.xml`, linked from `robots.txt`), downloaded as server-rendered HTML and read as text. Code tables were extracted mechanically from the HTML and every code in this file was checked against that extraction, so code values are exact; meanings are paraphrased. The "Last modified" value is the page's own footer.
- Brand note: many documented endpoints, SDK class names and package names still carry the legacy name SafeCharge (`secure.safecharge.com`, `ppp-test.safecharge.com`, `SafeCharge()` Web SDK object, Java package `com.safecharge`, npm package `safecharge`, Java SDK copyright "SafeCharge International Group Limited"). The documentation uses these names for the current Nuvei platform, so real payloads and logs may contain either brand.

---

## Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                                   |
| Classification                     | `card_processing`, `acquiring`, `gateway`, `alternative_payment_method`; `orchestration` only as a marketing claim (smart routing and cascading). `payment_facilitator`, `wallet` and `merchant_account_intermediary` are not claimed by the pages read                                                                                                                                              |
| Documented sectors                 | iGaming / online gaming, video and social gaming, crypto platforms and exchanges, digital content and subscriptions, travel and mobility, financial services (nuvei.com use-case pages); the docs also name "Gaming and Forex merchants" and "Gaming and Gambling merchants" for payouts                                                                                                             |
| Documentation access               | **Public** (no login) for the guides, the REST API 1.0 reference, the DMN pages and the code tables. The Control Panel (reports, settings) needs a merchant login and was not used                                                                                                                                                                                                                   |
| API family to implement first      | **REST API 1.0** synchronous JSON responses (`status`, `errCode`, `reason`, `transactionStatus`, `gwErrorCode`, `gwErrorReason`, `gwExtendedErrorCode`, `paymentMethodErrorCode`, `paymentMethodErrorReason`) together with **payment DMNs** (query string or form body: `ppp_status`, `Status`, `ErrCode`, `ExErrCode`, `Reason`, `ReasonCode`, `advanceResponseChecksum`)                          |
| Documented codes (distinct values) | 771 across nine tables: `errCode` 175 + marketplace `errCode` 12 + gateway response rows 9 + `gwExtendedErrorCode` filter codes 234 distinct (238 rows) + `gwErrorReason` strings 180 (170 listed + 10 only in the description appendix) + `threeDReasonId` 34 + `merchantAdviceCode` 16 + withdrawal error codes 82 + withdrawal general processing codes 29. Plus value sets for CVV2, AVS and ECI |
| Biggest limitations                | Numeric code spaces overlap (`errCode` 1001 means "invalid checksum" while `gwExtendedErrorCode` 1001 means "invalid expiration date"), so the field name decides the meaning. Payment DMNs have no event or delivery ID. Field-name casing differs between tables and examples. Several examples are truncated or are not valid JSON                                                                |
| White-label                        | No. Nuvei documents its own gateway formats. It also routes many APMs (for example Skrill as `apmgw_MoneyBookers`; the APM DMN examples use `apmgw_expresscheckout` with PayPal-only fields such as `externalEmail`), but those results reach the merchant in Nuvei's own response and DMN format                                                                                                    |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://docs.nuvei.com/documentation`.

| URL                                                                                                                                                                                                                                                                           | Last modified              | What it covers                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.nuvei.com/robots.txt, https://docs.nuvei.com/sitemap.xml and its sub-sitemaps (`wp-sitemap-posts-page-1.xml`, `wp-sitemap-posts-manual_kb-1.xml`, `wp-sitemap-posts-manual_documentation-1.xml`, `wp-sitemap-posts-rc_blocks-1.xml`, taxonomy and user sitemaps) | n/a                        | Page discovery only                                                                                                                                                                                                                                                                                                                                            |
| D/integration/response-handling/                                                                                                                                                                                                                                              | September 2026             | **Main code tables**: status/error indicators by stage, `errCode`/`reason` table, marketplace codes, gateway response codes, gateway filter error codes, gateway decline reasons and their descriptions, Payment Page status handling                                                                                                                          |
| D/additional-links/api-reference/                                                                                                                                                                                                                                             | (none shown)               | **REST API 1.0 reference** on one page: endpoints, inputs, outputs and example responses for `/getSessionToken`, `/initPayment`, `/payment`, `/settleTransaction`, `/refundTransaction`, `/voidTransaction`, `/payout`, `/getTransactionDetails`, `/getPaymentStatus`, `/getPayoutStatus`, MPI methods, class objects; also Web SDK and Simply Connect methods |
| D/accept-payment/server-to-server/rest-1-0/                                                                                                                                                                                                                                   | July 2026                  | REST 1.0 flow: session token, `/initPayment`, non-3DS and 3DS payment, `REDIRECT` handling, soft decline, liability shift; request checksum recipe                                                                                                                                                                                                             |
| D/integration/webhooks/                                                                                                                                                                                                                                                       | August 2026                | DMN delivery: HTTPS GET (query string) or POST (body), size, source IP ranges, 200 OK acknowledgement, 24-hour retry                                                                                                                                                                                                                                           |
| D/integration/webhooks/payment-dmns/                                                                                                                                                                                                                                          | August 2026                | **Payment and pre-deposit DMN** parameters, `advanceResponseChecksum` recipe, APM `Status` values, two example DMNs                                                                                                                                                                                                                                            |
| D/integration/webhooks/withdrawal-dmns/                                                                                                                                                                                                                                       | August 2026                | **Withdrawal DMN** scenarios and statuses, merchant response (`action=`), `checksum` recipe, parameter table                                                                                                                                                                                                                                                   |
| D/integration/webhooks/control-panel/                                                                                                                                                                                                                                         | August 2026                | **Control Panel event DMNs** (JSON): general parameters, chargeback/dispute, pre-chargeback alert, manual correction, fraud reported, RDR, instant settlement and PayFac events; header `checksum` recipe                                                                                                                                                      |
| D/features/financial-operations/auth-and-settle/                                                                                                                                                                                                                              | April 2025                 | Auth, PreAuth, settle and multi-settle; example `/settleTransaction` responses                                                                                                                                                                                                                                                                                 |
| D/features/financial-operations/void/                                                                                                                                                                                                                                         | July 2026                  | Void rules and example response                                                                                                                                                                                                                                                                                                                                |
| D/features/financial-operations/refund/                                                                                                                                                                                                                                       | August 2025                | Referenced and unreferenced refunds, APM asynchronous refunds (`status=PENDING`), example responses and DMN excerpts                                                                                                                                                                                                                                           |
| D/features/financial-operations/payout/                                                                                                                                                                                                                                       | July 2026                  | `/payout` flows with and without a stored payment option (UPO), example responses                                                                                                                                                                                                                                                                              |
| D/features/3d-secure/3ds-implementations/3ds-responses/                                                                                                                                                                                                                       | February 2025              | `threeD` class stages and the `threeDReasonId` / `threeDReason` table                                                                                                                                                                                                                                                                                          |
| D/accept-payment/payment-page/output-parameters/                                                                                                                                                                                                                              | July 2026                  | Parameters Nuvei appends to the Success/Pending/Error redirect URL (Payment Page / Cashier)                                                                                                                                                                                                                                                                    |
| D/accept-payment/payment-page/cashier/withdrawal-guide/                                                                                                                                                                                                                       | February 2025              | Withdrawal request and order statuses, request checksum recipes, **withdrawal error codes** and **general processing error codes**                                                                                                                                                                                                                             |
| D/features/subscription-rebilling/                                                                                                                                                                                                                                            | February 2025              | Rebilling service, subscription DMN (`dmnType`), its `responsechecksum`, retry schedule for failed recurring payments                                                                                                                                                                                                                                          |
| D/additional-links/faqs/                                                                                                                                                                                                                                                      | February 2025              | DMN retry interval (every 15 minutes for 24 hours, 96 times), DMN synchronous vs asynchronous, refund/payout limit error, `REDIRECT` meaning                                                                                                                                                                                                                   |
| D/global-guides/skrill/                                                                                                                                                                                                                                                       | March 2026                 | Skrill offered as an APM through Nuvei (`apmgw_MoneyBookers`)                                                                                                                                                                                                                                                                                                  |
| D/apms-overview/introduction-to-apms/                                                                                                                                                                                                                                         | (none shown)               | APM types and workflows (redirect, direct, recurring, refunds)                                                                                                                                                                                                                                                                                                 |
| D/integration/testing/testing-apms/                                                                                                                                                                                                                                           | September 2026             | Sandbox APM list (deposit / withdrawal support per APM)                                                                                                                                                                                                                                                                                                        |
| D/online-payments-docs/introduction/                                                                                                                                                                                                                                          | (none shown)               | Integration methods: Payment Page, Simply Connect, Web SDK, server-to-server                                                                                                                                                                                                                                                                                   |
| D/accept-payment/server-to-server/server-sdks/                                                                                                                                                                                                                                | December 2024              | Official server SDKs and their GitHub / package links                                                                                                                                                                                                                                                                                                          |
| D/additional-links/rest-2-0/integration/response-handling/                                                                                                                                                                                                                    | June 2026                  | REST 2.0 (beta) statuses and code tables, read only to separate it from REST 1.0                                                                                                                                                                                                                                                                               |
| D/additional-links/rest-2-0/integration/webhooks/                                                                                                                                                                                                                             | August 2026                | REST 2.0 (beta) JSON webhooks, read only to separate them from DMNs                                                                                                                                                                                                                                                                                            |
| https://docs.nuvei.com/releasenotes/added-error-codes/                                                                                                                                                                                                                        | effective 17-Dec-2020      | Release 61 note adding `errCode` 9064-9073                                                                                                                                                                                                                                                                                                                     |
| https://www.nuvei.com/ and https://www.nuvei.com/sitemap.xml                                                                                                                                                                                                                  | sitemap lastmod 2026-10-23 | Company site (activity check), list of use-case pages                                                                                                                                                                                                                                                                                                          |
| https://www.nuvei.com/use-cases/online-gaming, .../video-gaming, .../crypto-platforms-exchanges, .../digital-content-subscriptions, .../travel-mobility, .../financial-services                                                                                               | n/a                        | Sectors in Nuvei's own words                                                                                                                                                                                                                                                                                                                                   |
| https://www.nuvei.com/legal/licences-and-certifications                                                                                                                                                                                                                       | n/a                        | Legal entities, licences and regulators                                                                                                                                                                                                                                                                                                                        |
| https://github.com/Nuvei/nuvei-server-java (repository metadata, file tree, `src/main/java/com/safecharge/util/Constants.java`, `src/main/java/com/safecharge/response/SafechargeResponse.java`)                                                                              | last push 2025-04-14       | Official Java SDK: base response fields, `errCode` constant names, transaction type enum                                                                                                                                                                                                                                                                       |
| https://github.com/SafeChargeInternational/safecharge-php (redirects to https://github.com/Nuvei/nuvei-server-php)                                                                                                                                                            | last push 2025-09-17       | Official PHP SDK; repository metadata only                                                                                                                                                                                                                                                                                                                     |
| https://github.com/SafeChargeInternational/safecharge.net                                                                                                                                                                                                                     | last push 2021-11-08       | Official .NET SDK; repository metadata only                                                                                                                                                                                                                                                                                                                    |

Also tried: `https://docs.nuvei.com/llms.txt` returns 404. The docs home page `https://docs.nuvei.com/` returned a Cloudflare challenge (HTTP 403) to scripted access, while the individual documentation pages loaded normally; no access control was bypassed.

Not read: the separate advanced API reference (`https://docs.nuvei.com/api/advanced/indexAdvanced.html`, withdrawal, rebilling and pre-chargeback methods), the KYC DMN page, the PayFac pages, and the Payment Page input-parameter page. Facts that would come only from those pages are marked **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | nuvei.com home page ("The infrastructure for every payment, everywhere"); its sitemap shows `lastmod` 2026-10-23. Licences page lists current regulated entities (see item 7)                                                                                                                                                                                                                                                                            |
| 2   | Payment service operational      | yes    | Docs pages modified up to September 2026 describe live and test endpoints (`https://secure.safecharge.com/ppp/api/v1/<method>.do`, `https://ppp-test.nuvei.com/ppp/api/v1/<method>.do`) and current sandbox APM credentials (testing-apms, September 2026)                                                                                                                                                                                               |
| 3   | Docs publicly accessible         | yes    | Guides, REST 1.0 reference, DMN pages and code tables load without login. The Control Panel (reports, integration settings, DMN URL settings) needs a merchant login; it was not used                                                                                                                                                                                                                                                                    |
| 4   | API families/versions identified | yes    | REST API 1.0 (responses carry `"version": "1.0"`; reference says "The current version is 1"), payment / pre-deposit / withdrawal / Control Panel event / subscription DMNs, Payment Page redirect parameters (`requestVersion` "3.0.0" per the DMN table), Withdrawal API, REST 2.0 (beta)                                                                                                                                                               |
| 5   | Offline-examinable formats       | yes    | JSON example responses for every REST 1.0 method read; query-string DMN examples; JSON event DMN examples; field tables with types and allowed values                                                                                                                                                                                                                                                                                                    |
| 6   | Sectors documented               | yes    | nuvei.com use-case pages: "Partner with the industry leader in iGaming payments", social gaming, crypto platforms and exchanges, digital content subscriptions, travel and mobility, financial services. Payout page: "Gaming and Forex merchants often use payouts"                                                                                                                                                                                     |
| 7   | Regional/regulatory limits       | yes    | Licences page: UK FCA e-money (Nuvei Financial Services Limited), DNB-licensed PSP (Nuvei Global Services B.V.), Central Bank of Cyprus EMI (Nuvei Limited), Bank of Lithuania EMI (Nuvei UAB), Japan and Singapore entities, US MSB with money transmitter licences in 39 jurisdictions. Docs: multi-settle only for US merchants with a TSYS acquirer; OCT limits (codes 1295, 1296); EU/EEA-only card registration (9158); Colombian COP rule (10049) |
| 8   | Diagnostic value                 | yes    | 771 documented code values with three separate error layers (request, gateway, APM), explicit status fields, DMN retry rules and a chargeback event feed                                                                                                                                                                                                                                                                                                 |
| 9   | Own technical formats            | yes    | Nuvei-specific JSON (`internalRequestId`, `gwErrorCode`, `gwExtendedErrorCode`), DMN fields (`ppp_status`, `PPP_TransactionID`, `advanceResponseChecksum`). Not a resale of a gateway PandaPayLens supports                                                                                                                                                                                                                                              |
| 10  | No credentials needed to analyse | yes    | All examples and tables are public. Checksums need the merchant secret key, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                                                                        |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`            | `/payment` with `paymentOption.card`, auth / settle / void / refund flows (auth-and-settle, void, refund pages)                                                                                                            |
| `acquiring`                  | Licences page: "Principal membership from Mastercard and Visa for currency processing and settlement in the Europe area"; acquirer names in examples such as `Nuvei Acquirer` and `Nuvei Acquirer - Visa` (event DMN page) |
| `gateway`                    | API reference introduction: the API lets merchants "process consumer payments through Nuvei's digital payment gateway"; REST 1.0 page names "Multiple PSP processing merchants" as a server-to-server use case             |
| `alternative_payment_method` | Introduction to APMs: "easy access to hundreds of APM providers" (bank transfers, card APMs, cash, e-wallets, mobile payments, vouchers, carrier billing), invoked through `paymentOption.alternativePaymentMethod`        |
| `orchestration` (claim only) | Financial services use-case page: "smart transaction routing engine" and "Cascade transactions to backup providers". No API field for routing decisions was found in the pages read                                        |
| Not claimed                  | `payment_facilitator` (Nuvei documents PayFac sub-merchant events for its customers, not itself as a PayFac), `wallet`, `merchant_account_intermediary`                                                                    |

Sectors, in Nuvei's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                          | Source and wording                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iGaming / online gaming         | https://www.nuvei.com/use-cases/online-gaming: "Partner with the industry leader in iGaming payments"; "enabling iGaming operators ... in regulated markets"                                                  |
| Gaming and gambling (payouts)   | D/features/financial-operations/payout/: "Gaming and Forex merchants often use payouts"; "Gaming and Gambling merchants who wish to process a card payout transaction must provide `cardData.cardHolderName`" |
| Forex                           | Same payout sentence ("Gaming and Forex merchants")                                                                                                                                                           |
| Video and social gaming         | https://www.nuvei.com/use-cases/video-gaming: "Accelerate growth and revenue of social gaming"                                                                                                                |
| Crypto                          | https://www.nuvei.com/use-cases/crypto-platforms-exchanges: "Powering the cryptocurrency revolution"; "Trusted by some of the most popular crypto exchanges and wallets"                                      |
| Digital content / subscriptions | https://www.nuvei.com/use-cases/digital-content-subscriptions: "Power seamless transactions and subscriptions"                                                                                                |
| Travel                          | https://www.nuvei.com/use-cases/travel-mobility                                                                                                                                                               |
| Financial services              | https://www.nuvei.com/use-cases/financial-services: "pay-in and payout experiences"                                                                                                                           |

Adult, nutraceuticals and CBD: **NOT DOCUMENTED** in the pages read.

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                                     | Endpoint(s) / delivery                                                                                                                                                                                                                                                                                                                                                   | Format                                                                                                                                                                   | Relevance                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **REST API 1.0**                           | `POST https://ppp-test.nuvei.com/ppp/api/v1/<method>.do` (test), `https://secure.safecharge.com/ppp/api/v1/<method>.do` (live). Methods read: `getSessionToken`, `openOrder`, `initPayment`, `payment`, `settleTransaction`, `refundTransaction`, `voidTransaction`, `payout`, `getTransactionDetails`, `getPaymentStatus`, `getPayoutStatus`, `authorize3d`, `verify3d` | JSON request (with SHA-256 `checksum`) and JSON response                                                                                                                 | **Primary.** Three error layers in one object                                                               |
| **Payment and pre-deposit DMNs**           | HTTPS GET with a query string, or HTTPS POST with name-value pairs in the body, to `urlDetails.notificationUrl` or the Control Panel DMN URL                                                                                                                                                                                                                             | URL-encoded name-value pairs                                                                                                                                             | **Primary.** Final status for card, APM and refund flows                                                    |
| Payment Page (Cashier) redirect parameters | Parameters appended to the merchant Success / Pending / Error URL (`https://ppp-test.safecharge.com/ppp/purchase.do` starts the flow)                                                                                                                                                                                                                                    | Query string                                                                                                                                                             | Secondary. Same vocabulary as DMNs, but browser-side and therefore not trustworthy                          |
| Withdrawal DMNs                            | GET or POST to a withdrawal DMN URL configured by Nuvei (FAQ: cannot be sent dynamically)                                                                                                                                                                                                                                                                                | Name-value pairs; the merchant answers with `action` set to Approve, Decline or Postpone                                                                                 | Secondary. Payout (withdrawal) lifecycle with request and order states                                      |
| Control Panel event DMNs                   | Sent to an event URL                                                                                                                                                                                                                                                                                                                                                     | JSON body; `checksum` in an HTTP header                                                                                                                                  | Secondary. **Only documented chargeback / dispute / fraud-report feed**                                     |
| Subscription DMNs                          | Payment DMN URL; `dmnType=subscription` or `subscriptionPayment`                                                                                                                                                                                                                                                                                                         | Name-value pairs (example printed as a PHP array)                                                                                                                        | Secondary                                                                                                   |
| Withdrawal API                             | `https://secure.safecharge.com/ppp/withdrawal/withdraw.do` (live), `https://ppp-test.safecharge.com/ppp/withdrawal/withdraw.do` (test) plus server methods (`approveRequest`, `declineRequest`, ...)                                                                                                                                                                     | Query string / JSON                                                                                                                                                      | Only its error codes are used here                                                                          |
| Web SDK, Simply Connect                    | Browser JavaScript                                                                                                                                                                                                                                                                                                                                                       | JS objects (`result`, `errCode`, `errorDescription`)                                                                                                                     | Out of scope at first; the docs say these client results are not verified and must be confirmed server-side |
| REST API 2.0 (beta)                        | `/payments`, `/payouts`, `/payments/{payment-id}/refunds` and similar                                                                                                                                                                                                                                                                                                    | JSON with lowercase statuses (`approved`, `authorizedOnly`, `redirect` ...) and dotted decline codes such as `1000.1016`; JSON webhooks keyed by `merchantTransactionId` | Out of scope: a different, beta format. Should be a separate parser if added                                |

**Recommendation: implement first** the REST 1.0 JSON responses and the payment DMNs. These are what a developer is most likely to paste, they share the gateway code layer (`gwErrorCode` / `ErrCode`, `gwExtendedErrorCode` / `ExErrCode`, `gwErrorReason` / `Reason`), and the Response Handling page documents both. Add the Control Panel chargeback event DMN next (the only documented chargeback source), then withdrawal DMNs, subscription DMNs and Payment Page redirect parameters.

### 3. Response and error formats

#### 3.1 Content type and encoding

- **REST 1.0**: all methods use POST (API reference introduction) with JSON bodies. Responses are JSON objects. The HTTP status code used for errors is **NOT DOCUMENTED** for REST 1.0; errors are reported inside the JSON through `status=ERROR` and `errCode`. (REST 2.0 documents HTTP 400/401/403/404/422/500, but that is a different API.)
- **Payment DMNs**: "HTTPS GET - The URL includes parameter name-value pairs as a query string. The body of the request is empty" or "HTTPS POST - The name-value pairs of the parameters are in the body of the request" (webhooks page). Which one a merchant receives is an account setting. The exact `Content-Type` of the POST is **NOT DOCUMENTED**. DMNs can exceed 2000 characters. Spaces appear as `+` (payment DMN checksum section).
- **Character encoding**: checksums use "encoding passed from the merchant site", default UTF-8. The DMN charset header is **NOT DOCUMENTED**.
- **Control Panel event DMNs**: JSON payload; the checksum is "in the header". The header name is **NOT DOCUMENTED**.
- **Merchant replies**: pre-deposit DMN reply `action=APPROVE|DECLINE` (+ `message`); withdrawal DMN reply `action`, `message`, `errorCode`, `merchantUniqueId`.

#### 3.2 Status and error fields by stage (REST 1.0)

The Response Handling page splits errors into three stages. A parser should keep them apart:

| Stage | Source of the error             | REST 1.0 fields                                                            | Web SDK / Simply Connect fields | Notes                                                                                     |
| ----- | ------------------------------- | -------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| 1     | The request itself              | `status` (`SUCCESS` / `ERROR`), `errCode` (integer), `reason` (string)     | `errCode`, `errorDescription`   | `errCode` values: section 4.1. `errCode=0` and empty `reason` on success                  |
| 2     | Payment gateway and banks       | `transactionStatus`, `gwErrorCode`, `gwErrorReason`, `gwExtendedErrorCode` | `result`                        | `gwErrorCode` / `gwExtendedErrorCode` pairs: section 4.3; filter codes: 4.4; reasons: 4.5 |
| 3     | The APM (APM transactions only) | `paymentMethodErrorCode`, `paymentMethodErrorReason`                       | (none listed)                   | The APM codes themselves are **NOT DOCUMENTED** (they come from each APM)                 |

`transactionStatus` values on `/payment`: `APPROVED`, `DECLINED`, `ERROR`, `REDIRECT` (3DS challenge at `paymentOption.card.threeD.acsUrl`, or APM redirect at `paymentOption.redirectUrl`). The gateway response table also maps `0`/`0` to `PENDING`. Settle, refund, void and payout list `APPROVED`, `DECLINED`, `ERROR`. `/refundTransaction` can also return `status=PENDING` with no `transactionStatus` for asynchronous APM refunds (refund page).

Other response fields worth decoding: `authCode`, `transactionType`, `transactionId`, `externalTransactionId`, `internalRequestId`, `clientUniqueId`, `clientRequestId`, `orderId`, `userPaymentOptionId`, `merchantAdviceCode` (Mastercard MAC, section 4.7), `paymentOption.card.cvv2Reply` and `avsCode` (section 4.8), `paymentOption.card.threeD.*` (`result`, `eci`, `threeDReasonId`, `threeDReason`, `challengePreferenceReason`, `flow`), `fraudDetails.finalDecision` (`Accept` / `Reject` ...), `partialApproval`, `isAFT`, `transactionLinkId`, `paymentAccountReference`, `IsInstantRefundSuccessful`.

#### 3.3 Field names across formats

The same concept has a different name in each format. This mapping is from the field tables; the link between DMN `ErrCode`/`ExErrCode` and REST `gwErrorCode`/`gwExtendedErrorCode` is an inference from the Response Handling sentence that a decline has "`errCode` is -1, and `exErrCode` is 0", which matches the `gwErrorCode`/`gwExtendedErrorCode` row for `DECLINED`.

| Concept                        | REST 1.0 response                                    | Payment DMN                                                                                                          | Payment Page redirect                         | Withdrawal DMN                      | Control Panel event DMN                            |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| Request / cashier status       | `status`                                             | `ppp_status` (`OK`, `FAIL`, `PENDING`)                                                                               | `ppp_status`                                  | `wdRequestState`, `wdRequestStatus` | n/a                                                |
| Gateway transaction status     | `transactionStatus`                                  | `Status`                                                                                                             | `status`                                      | `wdOrderStatus`                     | `TransactionResult`, `Result`, `Chargeback.Status` |
| Request-side error             | `errCode`, `reason`                                  | **NOT DOCUMENTED** as separate fields                                                                                | `error`, `message`                            | n/a                                 | n/a                                                |
| Gateway code                   | `gwErrorCode`                                        | `ErrCode`                                                                                                            | `errCode`                                     | `gwErrCode`                         | n/a                                                |
| Gateway extended code          | `gwExtendedErrorCode`                                | `ExErrCode`                                                                                                          | `exErrCode`                                   | `gwExtendedErrorCode`               | n/a                                                |
| Gateway reason                 | `gwErrorReason`                                      | `Reason`, `ReasonCode`                                                                                               | `reason`, `reasonCode`                        | `gwReason`, `gwReasonCode`          | n/a                                                |
| APM error                      | `paymentMethodErrorCode`, `paymentMethodErrorReason` | `errApmCode`, `errApmDescription` (from the APM); `errScCode`, `errScDescription` (from Nuvei, for APM transactions) | n/a                                           | `apmErrorCode`, `apmErrorDetails`   | n/a                                                |
| Gateway transaction ID         | `transactionId`                                      | `TransactionID`                                                                                                      | `transactionId`                               | `gwTrxId`                           | `TransactionDetails.TransactionId`                 |
| Merchant transaction reference | `clientUniqueId`                                     | `clientUniqueId` and `merchant_unique_id`                                                                            | `clientUniqueId`, `merchant_unique_id`        | `merchantUniqueId`                  | `TransactionDetails.ClientUniqueId`                |
| Signature                      | (request `checksum` only)                            | `advanceResponseChecksum` (+ deprecated `responseChecksum`)                                                          | `advanceResponseChecksum`, `responsechecksum` | `checksum`                          | `checksum` header                                  |

#### 3.4 Examples

Example A: successful `/payment` response. **Transcribed from https://docs.nuvei.com/documentation/additional-links/api-reference/** (`/payment`, "Example Response"):

```json
{
  "orderId": "271308078",
  "userTokenId": "230811147",
  "isAFT": "True",
  "isAFTOverridden": "True",
  "paymentOption": {
    "userPaymentOptionId": "53959588",
    "card": {
      "ccCardNumber": "4****2535",
      "bin": "400002",
      "last4Digits": "2535",
      "ccExpMonth": "12",
      "ccExpYear": "26",
      "acquirerId": "19",
      "cvv2Reply": "",
      "avsCode": "",
      "cardType": "Credit",
      "cardBrand": "VISA",
      "threeD": {}
    }
  },
  "transactionStatus": "APPROVED",
  "gwErrorCode": 0,
  "gwExtendedErrorCode": 0,
  "transactionType": "Sale",
  "transactionId": "1110000000010304183",
  "externalTransactionId": "",
  "authCode": "111361",
  "customData": "",
  "fraudDetails": {
    "finalDecision": "Accept"
  },
  "sessionToken": "cedbd6c0-52cf-4716-83b1-309e8e8dd2d3",
  "clientUniqueId": "12345",
  "internalRequestId": 222320318,
  "status": "SUCCESS",
  "errCode": 0,
  "reason": "",
  "merchantId": "427583496191624621",
  "merchantSiteId": "142033",
  "version": "1.0",
  "clientRequestId": "1C6CT7V1L",
  "merchantAdviceCode": "02"
}
```

Example B: `/settleTransaction` response. **Transcribed from https://docs.nuvei.com/documentation/additional-links/api-reference/** (`/settleTransaction`, "Example Response"):

```json
{
  "merchantId": "427583496191624621",
  "merchantSiteId": "142033",
  "internalRequestId": 45,
  "transactionId": "8498764859",
  "externalTransactionId": "",
  "status": "SUCCESS",
  "isAFT": "True",
  "transactionStatus": "APPROVED",
  "errCode": 0,
  "reason": "",
  "paymentMethodErrorCode": 0,
  "paymentMethodErrorReason": "",
  "gwErrorCode": 0,
  "gwErrorReason": "",
  "gwExtendedErrorCode": 0,
  "customData": "",
  "version": "1"
}
```

No complete declined or `status=ERROR` REST 1.0 response example was found in the pages read. Decline handling is documented only through the field descriptions and code tables.

Example C: payment DMN delivered as HTTPS GET. **Transcribed from https://docs.nuvei.com/documentation/integration/webhooks/** ("Example DMN Integration"):

```
https://myserver.com/dmn/receiveNotification?ppp_status=OK&ppp_TransactionID=547&TransactionId=45402&userid=111&merchant_unique_id=234234unique_id&customData=342dssdee&productId=12345product_id&first_name=John&last_name=Smith&email=john.smith%40email.com&totalAmount=47.25&currency=USD&Status=APPROVED
```

Example D: excerpt of the APM payment DMN with `Status=PENDING` from https://docs.nuvei.com/documentation/integration/webhooks/payment-dmns/. The documented example is about 2,300 characters long and is printed between `...'` and `',` (log-dump artifacts). The excerpt below keeps the status, code, identifier and checksum fields in their documented order and drops the rest (`[...]` marks gaps). The documented example contains an e-mail address and a payer name in `externalEmail`, `externalAccountDescription` and `apmPayerInfo`; those fields are not reproduced here.

```
ppp_status=PENDING&PPP_TransactionId=257354778&userid=&merchant_unique_id=5CXS9TWCNFJP&[...]&currency=EUR&clientUniqueId=5CXS9TWCNFJP&Status=PENDING&[...]&ExErrCode=0&ErrCode=0&AuthCode=&AvsCode=&Cvv2Reply=&[...]&merchant_site_id=197846&merchant_status=&action=&requestVersion=&message=PENDING&[...]&payment_method=apmgw_expresscheckout&Id=&merchant_id=4960497427404081578&responseTimeStamp=2020-03-21.15:42:48&[...]&transactionType=Sale&[...]&user_token_id=testPaypal&userPaymentOptionId=47865938&TransactionId=1110000000004579353&[...]&externalTransactionId=40T14511AV6745111&APMReferenceID=B586E22F7608F7416E201A9EBC58AF69&orderTransactionId=1044765948&totalAmount=20.00&dynamicDescriptor=%3F&Reason=&ReasonCode=0&[...]&errApmCode=0&errApmDescription=&errScCode=0&errScDescription=&[...]&upoRegistrationDate=20200321&type=DEPOSIT&clientRequestId=20200321174049&relatedTransactionId=&[...]&responsechecksum=0606f157a5075d1d4dc11db7279deb9afd2b933575845bd71e5db99747db30d3&advanceResponseChecksum=1b85115ce2647e02461a4ad93d5a04873cb049470ec1e82b6d66d205ef9e4cfe&transactionLinkId=6T927v5RSWmrtxW_1K18yQ
```

The matching `Status=APPROVED` example on the same page has the same transaction IDs with `ppp_status=OK`, `Status=APPROVED`, `message=APPROVED`, a timestamp one second later and different checksums. That is the documented "additional DMN" for an asynchronous APM.

Example E: chargeback event DMN (JSON). **Transcribed from https://docs.nuvei.com/documentation/integration/webhooks/control-panel/** ("Example DMN JSON Payload" in "Authenticating the DMN"):

```json
{
  "ClientId": 151999723,
  "ClientName": "Test Client",
  "EventType": "Chargeback",
  "EventDateUTC": "2022-05-18T08:21:23.3749665Z",
  "EventCorrelationId": "0bd473cb-093b-4540-971b-6f0773be755b",
  "Chargeback": {
    "Date": "09/04/2018 10:37:17",
    "StatusCategory": "Regular",
    "Type": "Chargeback",
    "Status": null,
    "Amount": 10.25,
    "Currency": "eur",
    "ChargebackReason": "10.4 - Other Fraud-Card Absent Environment",
    "ReasonMessage": "Other Fraud-Card Absent Environment",
    "DisputeDueDate": null
  },
  "TransactionDetails": {
    "TransactionId": 382511946222,
    "TransactionDate": "09/01/2018 10:37:17",
    "ClientUniqueId": null,
    "AcquirerName": "Demo Bank",
    "MaskedCardNumber": "1***********1234",
    "ARN": "05295314304000000000456"
  }
}
```

### 4. Codes

Code strings are exactly as documented. "Meaning" is a short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not Nuvei statements; where Nuvei gives advice (for example "may succeed when trying again later"), it is reflected. Nuvei describes the decline reason list as "some possible" values, so an adapter must handle unknown codes and strings.

**Code spaces overlap.** `errCode` 1000-1140 and `gwExtendedErrorCode` 1001-1300 share numbers with different meanings; withdrawal error codes 10014-10075 share numbers with `gwExtendedErrorCode` 10025-10075. The field name (and the API: payment vs withdrawal) must select the table. Never decode a bare number.

#### 4.1 `errCode` / `reason`: request-side errors (Response Handling, "API Response Codes"): 175 codes

Returned with `status=ERROR` (stage 1). `errCode=0` means no request error. Codes marked `*` are "Relevant for Apple Pay and Google Pay". Several reasons contain `{0}` or `%d` placeholders that Nuvei fills at runtime.

| Code    | Meaning (paraphrase)                                                        | Category                   | Retry class                     |
| ------- | --------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `1000`  | Unspecified general error on the request side                               | unknown                    | manual_review                   |
| `1001`  | Request checksum did not validate                                           | configuration              | do_not_retry                    |
| `1004`  | Card data block missing or invalid                                          | invalid_request            | customer_action_required        |
| `1007`  | Name on card is invalid                                                     | invalid_request            | customer_action_required        |
| `1010`  | User token is invalid                                                       | invalid_request            | do_not_retry                    |
| `1011`  | Stored payment option (UPO) data missing or invalid                         | invalid_request            | do_not_retry                    |
| `1013`  | Merchant ID is invalid                                                      | configuration              | do_not_retry                    |
| `1014`  | Country code is invalid (message may carry a prefix placeholder)            | invalid_request            | do_not_retry                    |
| `1019`  | Generic validation failure                                                  | invalid_request            | do_not_retry                    |
| `1021`  | Timestamp is invalid                                                        | invalid_request            | do_not_retry                    |
| `1022`  | Merchant site ID is invalid                                                 | configuration              | do_not_retry                    |
| `1023`  | Stored payment option is not enabled                                        | payment_method_unavailable | customer_action_required        |
| `1024`  | Per-user limit of stored payment options reached                            | invalid_request            | do_not_retry                    |
| `1028`  | Card issuer is invalid                                                      | invalid_request            | customer_action_required        |
| `1029`  | Expiry date is invalid                                                      | invalid_request            | customer_action_required        |
| `1038`  | Communication error                                                         | network_or_timeout         | retry_conditionally             |
| `1040`  | Amount missing or invalid                                                   | invalid_amount             | do_not_retry                    |
| `1041`  | Amount currency missing or invalid                                          | invalid_request            | do_not_retry                    |
| `1055`  | Validation of a single stored payment option failed                         | invalid_request            | do_not_retry                    |
| `1056`  | User management is switched off for the account                             | configuration              | do_not_retry                    |
| `1057`  | Order ID is invalid                                                         | invalid_request            | do_not_retry                    |
| `1058`  | The operation is not allowed on this order                                  | invalid_request            | do_not_retry                    |
| `1059`  | Payment data is ambiguous                                                   | invalid_request            | do_not_retry                    |
| `1060`  | Payment data missing or invalid                                             | invalid_request            | do_not_retry                    |
| `1061`  | Card token is invalid                                                       | invalid_request            | do_not_retry                    |
| `1062`  | CVV is invalid                                                              | invalid_request            | customer_action_required        |
| `1063`  | Total amount differs from the sum of item amounts                           | invalid_amount             | do_not_retry                    |
| `1064`  | Session token invalid; one order per session token                          | invalid_request            | safe_to_retry_technical_request |
| `1065`  | Token is invalid                                                            | invalid_request            | do_not_retry                    |
| `1066`  | Request is invalid                                                          | invalid_request            | do_not_retry                    |
| `1067`  | Transaction type missing or invalid                                         | invalid_request            | do_not_retry                    |
| `1068`  | Payment method not enabled for the merchant                                 | configuration              | do_not_retry                    |
| `1069`  | Session has expired                                                         | invalid_request            | safe_to_retry_technical_request |
| `1070`  | Currency not supported by the merchant payment option settings              | configuration              | do_not_retry                    |
| `1071`  | 3DS payment amount differs from the Auth3D order amount                     | invalid_amount             | do_not_retry                    |
| `1072`  | PA (3DS) response missing or invalid                                        | authentication_failed      | retry_conditionally             |
| `1073`  | 3DS payment currency differs from the Auth3D order currency                 | invalid_request            | do_not_retry                    |
| `1074`  | Stored payment option has expired                                           | payment_method_unavailable | customer_action_required        |
| `1075`  | Language code is invalid                                                    | invalid_request            | do_not_retry                    |
| `1076`  | Payment method not supported                                                | payment_method_unavailable | do_not_retry                    |
| `1077`  | API rebilling disabled for the account                                      | configuration              | do_not_retry                    |
| `1078`  | Configuration for the stored payment option is missing                      | configuration              | do_not_retry                    |
| `1079`  | Rebilling requires a stored payment option                                  | invalid_request            | do_not_retry                    |
| `1080`  | Calling this method is forbidden                                            | configuration              | do_not_retry                    |
| `1081`  | Source IP address is blocked                                                | configuration              | do_not_retry                    |
| `1082`  | relatedTransactionId value is invalid                                       | invalid_request            | do_not_retry                    |
| `1083`  | Date of birth in ekycUserDetails is invalid                                 | invalid_request            | do_not_retry                    |
| `1084`  | Date of birth in UserDetails is invalid                                     | invalid_request            | do_not_retry                    |
| `1085`  | isPartialApproval must be empty, 0 or 1                                     | invalid_request            | do_not_retry                    |
| `1086`  | Sending a cardData block is not permitted                                   | configuration              | do_not_retry                    |
| `1087`  | Request rejected as containing XSS content                                  | invalid_request            | do_not_retry                    |
| `1088`  | clientRequestId missing or invalid where uniqueness checking is on          | invalid_request            | do_not_retry                    |
| `1089`  | Another transaction already used this clientRequestId                       | duplicate_request          | do_not_retry                    |
| `1090`  | Stored payment option status is not ENABLED, SUSPENDED or FROZEN            | payment_method_unavailable | customer_action_required        |
| `1091`  | Transaction belongs to another merchant or merchant site                    | invalid_request            | do_not_retry                    |
| `1092`  | Transaction does not support the requested operation                        | invalid_request            | do_not_retry                    |
| `1093`  | Message text missing                                                        | invalid_request            | do_not_retry                    |
| `1094`  | Message locale invalid                                                      | invalid_request            | do_not_retry                    |
| `1095`  | Results range invalid                                                       | invalid_request            | do_not_retry                    |
| `1096`  | Status unknown                                                              | unknown                    | manual_review                   |
| `1097`  | An account info field has an invalid value (field name in placeholder)      | invalid_request            | do_not_retry                    |
| `1098`  | An account info field is missing (field name in placeholder)                | invalid_request            | do_not_retry                    |
| `1099`  | Payment method is already registered                                        | duplicate_request          | do_not_retry                    |
| `1101`  | State is invalid (message may carry a prefix placeholder)                   | invalid_request            | do_not_retry                    |
| `1102`  | Product descriptor does not exist                                           | configuration              | do_not_retry                    |
| `1103`  | Subscription plan ID is invalid                                             | invalid_request            | do_not_retry                    |
| `1104`  | Temporary card token not allowed for this method                            | invalid_request            | do_not_retry                    |
| `1105`  | UserDetails requires first name, last name, email, address, zip and country | invalid_request            | do_not_retry                    |
| `1107`  | methodCode is invalid                                                       | invalid_request            | do_not_retry                    |
| `1108`  | Casino value is invalid                                                     | invalid_request            | do_not_retry                    |
| `1109`  | Email is invalid                                                            | invalid_request            | customer_action_required        |
| `1110`  | Locale code is invalid                                                      | invalid_request            | do_not_retry                    |
| `1111`  | External error returned by IMS (IMS message in placeholder)                 | provider_unavailable       | manual_review                   |
| `1112`  | Registration failed                                                         | unknown                    | manual_review                   |
| `1113`  | State does not belong to the country (prefix placeholder)                   | invalid_request            | do_not_retry                    |
| `1114`  | Verification status invalid                                                 | invalid_request            | do_not_retry                    |
| `1115`  | Verification method invalid                                                 | invalid_request            | do_not_retry                    |
| `1116`  | IMS could not find payment account details                                  | invalid_request            | manual_review                   |
| `1117`  | dynamic3DMode must be off or on                                             | invalid_request            | do_not_retry                    |
| `1118`  | isDynamic3D must be 0 or 1                                                  | invalid_request            | do_not_retry                    |
| `1120`  | identificationType in ekycUserDetails invalid                               | invalid_request            | do_not_retry                    |
| `1121`  | Merchant is not verified                                                    | configuration              | do_not_retry                    |
| `1122`  | Merchant site is disabled                                                   | configuration              | do_not_retry                    |
| `1123`  | Item count invalid for an open-amount order                                 | invalid_request            | do_not_retry                    |
| `1124`  | Merchant site not configured for Managed3D                                  | configuration              | do_not_retry                    |
| `1125`  | Stored payment method not supported by this method                          | payment_method_unavailable | do_not_retry                    |
| `1126`  | Rebilling requires isDynamic3D=1 and dynamic3DMode OFF                      | invalid_request            | do_not_retry                    |
| `1127`  | External MPI requires isDynamic3D=1 and dynamic3DMode OFF                   | invalid_request            | do_not_retry                    |
| `1128`  | Type value invalid (placeholder)                                            | invalid_request            | do_not_retry                    |
| `1129`  | KYC document upload is disabled                                             | configuration              | do_not_retry                    |
| `1130`  | Country could not be derived from the request                               | invalid_request            | do_not_retry                    |
| `1131`  | originUrl is not valid (placeholder)                                        | invalid_request            | do_not_retry                    |
| `1132`  | Transaction was already settled automatically                               | duplicate_request          | do_not_retry                    |
| `1140`  | No payment was made in this session                                         | invalid_request            | do_not_retry                    |
| `2006`  | Currency conversion not supported                                           | configuration              | do_not_retry                    |
| `9064`  | 3D authentication failed                                                    | authentication_failed      | customer_action_required        |
| `9065`  | Currency not supported by the payment method                                | payment_method_unavailable | do_not_retry                    |
| `9066`  | Exchange rate unavailable                                                   | provider_unavailable       | retry_conditionally             |
| `9067`  | Wrong payment method                                                        | invalid_request            | do_not_retry                    |
| `9068`  | Wrong DCC currency                                                          | invalid_request            | do_not_retry                    |
| `9069`  | Wrong converted amount                                                      | invalid_amount             | do_not_retry                    |
| `9070`  | Wrong original currency                                                     | invalid_request            | do_not_retry                    |
| `9071`  | Wrong original amount                                                       | invalid_amount             | do_not_retry                    |
| `9072`  | Payment still in progress                                                   | unknown                    | retry_conditionally             |
| `9073`  | Country and currency missing or invalid                                     | invalid_request            | do_not_retry                    |
| `9074`  | Card company in externalSchemeDetails invalid or unsupported                | invalid_request            | do_not_retry                    |
| `9075`  | 3DS authentication failed and payment is not allowed                        | authentication_failed      | do_not_retry                    |
| `9076`  | 3DS authentication failed                                                   | authentication_failed      | customer_action_required        |
| `9077`  | Card registration failed                                                    | unknown                    | manual_review                   |
| `9078`  | Account verification not enabled for the merchant site                      | configuration              | do_not_retry                    |
| `9079`  | Account verification not configured for this payment option and country     | configuration              | do_not_retry                    |
| `9080`  | Stored payment option status not ENABLED, SUSPENDED or DISABLED             | payment_method_unavailable | customer_action_required        |
| `9081`  | Currency conversion type invalid                                            | invalid_request            | do_not_retry                    |
| `9082`  | Payment option accepts one passenger record only                            | invalid_request            | do_not_retry                    |
| `9083`  | clientRequestId missing or invalid                                          | invalid_request            | do_not_retry                    |
| `9084`  | clientRequestId does not belong to a payout                                 | invalid_request            | do_not_retry                    |
| `9085`  | Payment option is not a card                                                | invalid_request            | do_not_retry                    |
| `9086`  | Open amount feature not enabled                                             | configuration              | do_not_retry                    |
| `9087`  | Open amount and MCP conversion cannot be combined                           | invalid_request            | do_not_retry                    |
| `9088`  | Order amount outside the allowed range (placeholders)                       | invalid_amount             | do_not_retry                    |
| `9089`  | Open amount not supported for this order                                    | invalid_request            | do_not_retry                    |
| `9090`  | Open amount cannot be combined with amount details or items                 | invalid_request            | do_not_retry                    |
| `9091`  | Balance could not be retrieved                                              | provider_unavailable       | retry_conditionally             |
| `9092`  | User account operation failed                                               | unknown                    | manual_review                   |
| `9093`  | Account not found                                                           | invalid_request            | do_not_retry                    |
| `9094`  | Account already registered                                                  | duplicate_request          | do_not_retry                    |
| `9095`  | Adding the bank account failed                                              | unknown                    | manual_review                   |
| `9096`  | User account cannot be funded now                                           | provider_unavailable       | retry_conditionally             |
| `9097`  | Document type not supported                                                 | invalid_request            | do_not_retry                    |
| `9098`  | enrollmentAction type not supported                                         | invalid_request            | do_not_retry                    |
| `9099`  | Enrollment type not supported                                               | invalid_request            | do_not_retry                    |
| `9100`  | Payout still in progress                                                    | unknown                    | retry_conditionally             |
| `9101`  | Apple Pay transactions require 3D authentication                            | authentication_required    | customer_action_required        |
| `9102`  | totalSettleCount invalid                                                    | invalid_request            | do_not_retry                    |
| `9105`  | paymentFlow not supported                                                   | invalid_request            | do_not_retry                    |
| `9106`  | Payment method not supported in the chosen payment flow                     | payment_method_unavailable | do_not_retry                    |
| `9107`  | redirectFlowUITheme invalid                                                 | invalid_request            | do_not_retry                    |
| `9118`  | A transaction cannot be both MOTO and card present                          | invalid_request            | do_not_retry                    |
| `9123`  | Recipient's stored payment option not enabled                               | payment_method_unavailable | customer_action_required        |
| `9124`  | Problem with the supplied debit card number                                 | invalid_request            | customer_action_required        |
| `9125`  | Stored payment option not found or invalid                                  | invalid_request            | do_not_retry                    |
| `9126`  | Beneficiary type cannot be changed                                          | invalid_request            | do_not_retry                    |
| `9127`  | This stored payment option cannot be edited; add a new one                  | invalid_request            | customer_action_required        |
| `9128`  | 3DS v2 data must be supplied                                                | authentication_required    | do_not_retry                    |
| `9129`  | Transaction aborted for technical reasons                                   | provider_unavailable       | retry_conditionally             |
| `9130`  | Too many declines or errors; a new session is needed                        | rate_limiting              | customer_action_required        |
| `9131*` | Last four digits missing or invalid (Apple Pay / Google Pay)                | invalid_request            | do_not_retry                    |
| `9132`  | MCP rates not configured for the account                                    | configuration              | do_not_retry                    |
| `9133*` | Card brand missing or invalid (Apple Pay / Google Pay)                      | invalid_request            | do_not_retry                    |
| `9134`  | Conversion rates temporarily unavailable                                    | provider_unavailable       | retry_conditionally             |
| `9135`  | Dispute site unavailable                                                    | provider_unavailable       | retry_conditionally             |
| `9136`  | correlationId missing                                                       | invalid_request            | do_not_retry                    |
| `9137`  | alertReceivedDate missing                                                   | invalid_request            | do_not_retry                    |
| `9138`  | decisionDescription missing                                                 | invalid_request            | do_not_retry                    |
| `9139`  | refundIndicator missing                                                     | invalid_request            | do_not_retry                    |
| `9140`  | relatedClientUniqueId invalid or its transaction not found                  | invalid_request            | do_not_retry                    |
| `9141`  | relatedClientUniqueId is not unique                                         | invalid_request            | do_not_retry                    |
| `9142`  | Both relatedClientUniqueId and a payment option were sent                   | invalid_request            | do_not_retry                    |
| `9143`  | relatedTransactionId and relatedClientUniqueId do not match                 | invalid_request            | do_not_retry                    |
| `9144`  | Withdrawal configuration not defined for the merchant site                  | configuration              | do_not_retry                    |
| `9145`  | transactionId and clientUniqueId do not match                               | invalid_request            | do_not_retry                    |
| `9146`  | No transaction details found for the ID                                     | invalid_request            | do_not_retry                    |
| `9147`  | transactionId or clientUniqueId is required                                 | invalid_request            | do_not_retry                    |
| `9148`  | Google Pay terms and conditions not accepted                                | configuration              | do_not_retry                    |
| `9149`  | domainNames missing or invalid                                              | invalid_request            | do_not_retry                    |
| `9150`  | Domain name longer than 255 characters                                      | invalid_request            | do_not_retry                    |
| `9151`  | Disabled domains cannot be changed                                          | invalid_request            | do_not_retry                    |
| `9152`  | Domain not enabled                                                          | configuration              | do_not_retry                    |
| `9155`  | Request not found                                                           | invalid_request            | do_not_retry                    |
| `9156`  | Transaction request failed                                                  | unknown                    | manual_review                   |
| `9158`  | Card registration refused: card issued outside the EU/EEA                   | payment_method_unavailable | customer_action_required        |
| `9193`  | Mandatory attribute missing in Initial3DSData                               | invalid_request            | do_not_retry                    |
| `9194`  | Initial3DSData rebilling condition not met                                  | invalid_request            | do_not_retry                    |
| `9195`  | threeDSReqPriorAuthTimestamp must be YYYYMMDDHHMM                           | invalid_request            | do_not_retry                    |
| `9197`  | rebillExpiry must be YYYYMMDD                                               | invalid_request            | do_not_retry                    |

The official Java SDK (`Constants.java`) also defines constant names for `errCode` values that are not in the documentation table: 1002 (merchant does not exist), 1003 (merchant site does not exist), 1005 (invalid expiry month), 1006 (invalid expiry year), 1008 (expired card), 1009 (UPO suspended), 1012 (invalid client request ID), 1015 (invalid locale), 1016 (invalid phone), 1017 (invalid merchant / merchant site), 1018 (invalid card BIN), 1020 (invalid payment method), 1025 (invalid last 4 digits), 1026 (invalid unique CC), 1027 (invalid issuer name), 1030 (error suspending UPO), 1031 (error enabling UPO), 1032 / 1033 (invalid start / end index), 1034 (invalid configuration), 1035-1037 (pending withdrawal orders or net deposit exist), 1039 (invalid subscription ID), 1042 / 1043 (invalid rebilling payment type / sequence), 1044 (invalid subscription status), 1045 (invalid active transaction ID), 1046 (error creating UPO in risk-only mode). These are names only, without documented messages; treat them as low-confidence hints (29 values, not counted in the totals).

#### 4.2 Marketplace `errCode` values (Response Handling, "API Response Marketplace Codes"): 12 codes

| Code   | Meaning (paraphrase)                                            | Category        | Retry class   |
| ------ | --------------------------------------------------------------- | --------------- | ------------- |
| `9108` | Seller information missing                                      | invalid_request | do_not_retry  |
| `9109` | Seller not active (seller number in placeholder)                | configuration   | do_not_retry  |
| `9110` | Settlement amount above the allowed amount                      | invalid_amount  | do_not_retry  |
| `9111` | Refund amount above the allowed amount                          | invalid_amount  | do_not_retry  |
| `9112` | Retailer amounts do not add up to the transaction total         | invalid_amount  | do_not_retry  |
| `9113` | Valid split-cart information is required                        | invalid_request | do_not_retry  |
| `9114` | Split-cart data sent but seller is not a marketplace            | configuration   | do_not_retry  |
| `9115` | Split-cart parts reuse transaction identifiers; contact support | invalid_request | manual_review |
| `9116` | Seller belongs to a different merchantSiteId                    | configuration   | do_not_retry  |
| `9117` | Split-cart transaction amount is zero; contact support          | invalid_amount  | manual_review |
| `9121` | Marketplace sellerInfo block missing or invalid                 | invalid_request | do_not_retry  |
| `9122` | Marketplace clientInfo block missing or invalid                 | invalid_request | do_not_retry  |

#### 4.3 Gateway response codes (`gwErrorCode` / `gwExtendedErrorCode`): 9 rows

The table maps code pairs to `transactionStatus` (REST) or `result` (Web SDK).

| `gwErrorCode` | `gwExtendedErrorCode` | Documented meaning                                  | Category                        | Retry class         |
| ------------- | --------------------- | --------------------------------------------------- | ------------------------------- | ------------------- |
| `0`           | `0`                   | `APPROVED`                                          | n/a (success)                   | n/a                 |
| `-1`          | `0`                   | `DECLINED`; the reason is in `gwErrorReason` (4.5)  | card_declined (refine with 4.5) | see 4.5             |
| `0`           | `0`                   | `PENDING` (same pair as `APPROVED`; see section 10) | n/a (pending)                   | n/a                 |
| `-1100`       | greater than 0        | `ERROR`, filter error; the extended code is in 4.4  | see 4.4                         | see 4.4             |
| less than 0   | not 0                 | `ERROR`, gateway or bank error                      | unknown                         | manual_review       |
| `-1001`       | `0`                   | Invalid login (FAQ: the account is not active)      | configuration                   | do_not_retry        |
| `-1005`       | `0`                   | IP address out of the allowed range                 | configuration                   | do_not_retry        |
| `-1203`       | `0`                   | Timeout / retry                                     | network_or_timeout              | retry_conditionally |
| `-1`          | `-1`                  | Unexpected system error, retry later                | provider_unavailable            | retry_conditionally |

"retry_conditionally" for timeouts means: confirm the final state first (`/getPaymentStatus`, `/getTransactionDetails` or the DMN) before resubmitting, because the original may have gone through. The refund page adds that a merchant should wait 60 seconds before treating a refund request as timed out.

#### 4.4 Gateway filter error codes (`gwExtendedErrorCode` with `gwErrorCode=-1100`): 238 rows, 234 distinct codes

Four codes (`1158`, `1159`, `1160`, `1167`) are listed twice with unrelated meanings; both rows are kept. Codes `1211`-`1213`, `1215` and `1216` are listed only as "Reserved".

| Code     | Meaning (paraphrase)                                                                | Category                   | Retry class                     |
| -------- | ----------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `1001`   | Expiry date invalid                                                                 | invalid_request            | customer_action_required        |
| `1002`   | Expiry date too far in the past                                                     | card_declined              | customer_action_required        |
| `1101`   | Card number contains non-digits                                                     | invalid_request            | customer_action_required        |
| `1102`   | Card number has the wrong number of digits                                          | invalid_request            | customer_action_required        |
| `1103`   | Card number fails the Luhn (MOD 10) check                                           | invalid_request            | customer_action_required        |
| `1104`   | CVV2 invalid                                                                        | invalid_request            | customer_action_required        |
| `1105`   | Auth code, transaction ID and card number do not match                              | invalid_request            | do_not_retry                    |
| `1106`   | Credit amount exceeds total charges (FAQ: refund/payout above 7-day deposit limit)  | invalid_amount             | manual_review                   |
| `1107`   | Credits not allowed for this card company                                           | payment_method_unavailable | do_not_retry                    |
| `1108`   | Interval between auth and force not allowed                                         | invalid_request            | do_not_retry                    |
| `1109`   | Processing not allowed for this card company                                        | payment_method_unavailable | do_not_retry                    |
| `1110`   | Card company not recognized                                                         | payment_method_unavailable | customer_action_required        |
| `1111`   | Transaction was charged back                                                        | invalid_request            | do_not_retry                    |
| `1112`   | Sale or settle already credited                                                     | duplicate_request          | do_not_retry                    |
| `1113`   | Terminal not ready for this card company                                            | configuration              | manual_review                   |
| `1114`   | Card number is blacklisted                                                          | fraud_or_risk              | do_not_retry                    |
| `1115`   | BIN not allowed                                                                     | fraud_or_risk              | customer_action_required        |
| `1116`   | Merchant custom fraud screen filter triggered                                       | fraud_or_risk              | manual_review                   |
| `1118`   | CVV2 reply N cannot count as positive                                               | card_declined              | customer_action_required        |
| `1119`   | AVS reply B or N cannot count as positive                                           | card_declined              | customer_action_required        |
| `1120`   | AVS invalid                                                                         | card_declined              | customer_action_required        |
| `1121`   | CVV2 check not allowed on credit, settle or void                                    | invalid_request            | do_not_retry                    |
| `1122`   | AVS check not allowed on credit, settle or void                                     | invalid_request            | do_not_retry                    |
| `1124`   | Total credits exceed a restriction                                                  | invalid_amount             | manual_review                   |
| `1125`   | Format error                                                                        | invalid_request            | do_not_retry                    |
| `1126`   | Credit amount above ceiling                                                         | invalid_amount             | do_not_retry                    |
| `1127`   | Amount above limit                                                                  | invalid_amount             | do_not_retry                    |
| `1128`   | Transaction type code invalid                                                       | invalid_request            | do_not_retry                    |
| `1129`   | General filter error                                                                | unknown                    | manual_review                   |
| `1130`   | Bank-required fields missing or incorrect                                           | invalid_request            | do_not_retry                    |
| `1131`   | Transaction type not allowed for this bank                                          | configuration              | do_not_retry                    |
| `1132`   | Amount above bank limit                                                             | invalid_amount             | do_not_retry                    |
| `1133`   | Gateway-required fields missing                                                     | invalid_request            | do_not_retry                    |
| `1134`   | AVS processor error                                                                 | provider_unavailable       | retry_conditionally             |
| `1135`   | Only one credit per sale allowed                                                    | duplicate_request          | do_not_retry                    |
| `1136`   | Mandatory fields missing (FAQ: risk requires country, email, IP, cardholder name)   | invalid_request            | do_not_retry                    |
| `1137`   | Credit count exceeds a restriction                                                  | rate_limiting              | manual_review                   |
| `1138`   | Credit type invalid                                                                 | invalid_request            | do_not_retry                    |
| `1139`   | Card not supported in the CFT program                                               | payment_method_unavailable | customer_action_required        |
| `1140`   | Card must be processed in the gateway system                                        | configuration              | do_not_retry                    |
| `1141`   | Transaction type not allowed                                                        | configuration              | do_not_retry                    |
| `1142`   | AVS fields missing or incorrect                                                     | invalid_request            | customer_action_required        |
| `1143`   | Country does not match ISO code                                                     | invalid_request            | do_not_retry                    |
| `1144`   | UserID required in a rebill transaction                                             | invalid_request            | do_not_retry                    |
| `1145`   | Rebill profile does not support this transaction type                               | configuration              | do_not_retry                    |
| `1146`   | Void not allowed by restriction                                                     | invalid_request            | do_not_retry                    |
| `1147`   | Account number invalid                                                              | invalid_request            | customer_action_required        |
| `1148`   | Cheque number invalid                                                               | invalid_request            | customer_action_required        |
| `1149`   | Account number and transaction ID do not match                                      | invalid_request            | do_not_retry                    |
| `1150`   | UserID, transaction type and transaction ID do not match                            | invalid_request            | do_not_retry                    |
| `1151`   | Transaction not found in the rebill system                                          | invalid_request            | do_not_retry                    |
| `1152`   | Transaction already cancelled                                                       | duplicate_request          | do_not_retry                    |
| `1153`   | Bank code has the wrong number of digits                                            | invalid_request            | customer_action_required        |
| `1154`   | Bank code contains non-alphanumeric data                                            | invalid_request            | customer_action_required        |
| `1155`   | Related 3D transaction missing or incorrect                                         | invalid_request            | do_not_retry                    |
| `1156`   | Debit card fields missing or incorrect                                              | invalid_request            | customer_action_required        |
| `1157`   | No update parameters supplied                                                       | invalid_request            | do_not_retry                    |
| `1158`   | 3D PaRes value incorrect                                                            | authentication_failed      | retry_conditionally             |
| `1158`   | PayPal account already registered to another user                                   | duplicate_request          | customer_action_required        |
| `1159`   | State does not match ISO code                                                       | invalid_request            | do_not_retry                    |
| `1159`   | User already registered with a different payer email                                | invalid_request            | customer_action_required        |
| `1160`   | Bank code checksum digit invalid                                                    | invalid_request            | customer_action_required        |
| `1160`   | Single account validation failed                                                    | invalid_request            | customer_action_required        |
| `1161`   | Bank accepts only 3-digit CVV2                                                      | invalid_request            | customer_action_required        |
| `1162`   | Age verification failed                                                             | fraud_or_risk              | do_not_retry                    |
| `1163`   | Card, token or account is required                                                  | invalid_request            | do_not_retry                    |
| `1164`   | Token invalid                                                                       | invalid_request            | do_not_retry                    |
| `1165`   | Token mismatch                                                                      | invalid_request            | do_not_retry                    |
| `1166`   | Email address invalid                                                               | invalid_request            | customer_action_required        |
| `1167`   | Transaction already settled                                                         | duplicate_request          | do_not_retry                    |
| `1167`   | External MPI parameters missing                                                     | invalid_request            | do_not_retry                    |
| `1168`   | Transaction already voided                                                          | duplicate_request          | do_not_retry                    |
| `1169`   | sg_ResponseFormat invalid                                                           | invalid_request            | do_not_retry                    |
| `1170`   | Version field missing or incorrect                                                  | invalid_request            | do_not_retry                    |
| `1171`   | Issuing country invalid                                                             | invalid_request            | do_not_retry                    |
| `1172`   | Phone missing or badly formatted                                                    | invalid_request            | customer_action_required        |
| `1173`   | Check number missing or incorrect                                                   | invalid_request            | customer_action_required        |
| `1174`   | Birth date badly formatted                                                          | invalid_request            | customer_action_required        |
| `1175`   | Zip code badly formatted                                                            | invalid_request            | customer_action_required        |
| `1176`   | An auth transaction cannot be voided                                                | invalid_request            | do_not_retry                    |
| `1177`   | A credit transaction cannot be voided                                               | invalid_request            | do_not_retry                    |
| `1178`   | A void cannot be voided                                                             | invalid_request            | do_not_retry                    |
| `1179`   | This void cannot be performed                                                       | invalid_request            | do_not_retry                    |
| `1180`   | Start date invalid                                                                  | invalid_request            | do_not_retry                    |
| `1181`   | Merchant name longer than 25 characters                                             | configuration              | do_not_retry                    |
| `1182`   | Transaction must be sent as 3D Secure                                               | authentication_required    | customer_action_required        |
| `1183`   | Account not enabled for 3D                                                          | configuration              | do_not_retry                    |
| `1184`   | Transaction 3D status incorrect                                                     | authentication_failed      | do_not_retry                    |
| `1185`   | Related transaction must be an approved Auth3D of the same 3DS version and merchant | invalid_request            | do_not_retry                    |
| `1186`   | Related transaction must be 3D authenticated                                        | authentication_required    | do_not_retry                    |
| `1187`   | Country not supported in the CFT program                                            | payment_method_unavailable | do_not_retry                    |
| `1188`   | Token ID invalid                                                                    | invalid_request            | do_not_retry                    |
| `1190`   | Risk processor error                                                                | provider_unavailable       | retry_conditionally             |
| `1191`   | RiskOnly requires version 4.0.0 or later                                            | invalid_request            | do_not_retry                    |
| `1192`   | AGV processor error                                                                 | provider_unavailable       | retry_conditionally             |
| `1193`   | AGVOnly requires version 4.0.1 or later                                             | invalid_request            | do_not_retry                    |
| `1194`   | Age verification mismatch                                                           | fraud_or_risk              | do_not_retry                    |
| `1195`   | Requested acquirer not recognized                                                   | configuration              | do_not_retry                    |
| `1196`   | Sale not yet processed on the acquirer side                                         | unknown                    | retry_conditionally             |
| `1197`   | Input data insufficient                                                             | invalid_request            | do_not_retry                    |
| `1198`   | Card details not allowed for this payment method                                    | invalid_request            | do_not_retry                    |
| `1199`   | Envoy payout requires a type 1 credit transaction                                   | invalid_request            | do_not_retry                    |
| `1200`   | Issuing bank country code invalid                                                   | invalid_request            | do_not_retry                    |
| `1201`   | Amount invalid                                                                      | invalid_amount             | do_not_retry                    |
| `1202`   | Currency invalid                                                                    | invalid_request            | do_not_retry                    |
| `1203`   | IBAN does not match country code                                                    | invalid_request            | customer_action_required        |
| `1204`   | Payment method not supported                                                        | payment_method_unavailable | do_not_retry                    |
| `1205`   | APM risk processor error                                                            | provider_unavailable       | retry_conditionally             |
| `1206`   | Settle amount exceeds total charges                                                 | invalid_amount             | do_not_retry                    |
| `1207`   | This credit cannot be performed                                                     | invalid_request            | do_not_retry                    |
| `1208`   | Converted transaction must use other interfaces                                     | invalid_request            | do_not_retry                    |
| `1209`   | Partial approval not allowed for the client                                         | configuration              | do_not_retry                    |
| `1210`   | NameOnCard missing                                                                  | invalid_request            | customer_action_required        |
| `1211`   | Reserved                                                                            | unknown                    | unknown                         |
| `1212`   | Reserved                                                                            | unknown                    | unknown                         |
| `1213`   | Reserved                                                                            | unknown                    | unknown                         |
| `1214`   | FinalizationURL invalid                                                             | invalid_request            | do_not_retry                    |
| `1215`   | Reserved                                                                            | unknown                    | unknown                         |
| `1216`   | Reserved                                                                            | unknown                    | unknown                         |
| `1220`   | Token expired                                                                       | payment_method_unavailable | customer_action_required        |
| `1230`   | PFSubMerchantId missing or invalid                                                  | invalid_request            | do_not_retry                    |
| `1231`   | MerchantName missing or invalid                                                     | invalid_request            | do_not_retry                    |
| `1232`   | PFSubMerchantCountry missing or invalid                                             | invalid_request            | do_not_retry                    |
| `1233`   | PFSubMerchantCity missing or invalid                                                | invalid_request            | do_not_retry                    |
| `1265`   | Payout declined: over a year since the last sale                                    | payment_method_unavailable | do_not_retry                    |
| `1266`   | Submethod not supported                                                             | payment_method_unavailable | do_not_retry                    |
| `1267`   | Card not supported in the Visa Direct OCT program                                   | payment_method_unavailable | customer_action_required        |
| `1268`   | Token inactive                                                                      | payment_method_unavailable | customer_action_required        |
| `1269`   | Cryptogram could not be obtained                                                    | provider_unavailable       | retry_conditionally             |
| `1270`   | Client not configured for account updater                                           | configuration              | do_not_retry                    |
| `1271`   | Related transaction must be an approved InitAuth3D of the same merchant             | invalid_request            | do_not_retry                    |
| `1272`   | Card number must be the same throughout a 3DS flow                                  | invalid_request            | do_not_retry                    |
| `1273`   | Card number, currency and amount must be the same throughout a 3DS flow             | invalid_request            | do_not_retry                    |
| `1274`   | Auth3D 2.0 requested but card does not support 3DS 2.0                              | authentication_failed      | do_not_retry                    |
| `1275`   | InitAuth3D already used in another 3D flow                                          | duplicate_request          | do_not_retry                    |
| `1276`   | Authentication request timed out; try later                                         | network_or_timeout         | retry_conditionally             |
| `1277`   | Directory server returned an error                                                  | authentication_failed      | retry_conditionally             |
| `1278`   | Authentication expired; new InitAuth3d needed                                       | authentication_failed      | safe_to_retry_technical_request |
| `1279`   | 3D related transaction already used for a sale or auth                              | duplicate_request          | do_not_retry                    |
| `1280`   | sg_threeDSMethodNotificationURL missing                                             | invalid_request            | do_not_retry                    |
| `1281`   | Authentication not completed                                                        | authentication_failed      | customer_action_required        |
| `1282`   | Authentication failed                                                               | authentication_failed      | customer_action_required        |
| `1283`   | sg_ThreeDSPlatformType missing or invalid                                           | invalid_request            | do_not_retry                    |
| `1284`   | External MPI parameters badly formatted                                             | invalid_request            | do_not_retry                    |
| `1285`   | Refund time frame exceeded                                                          | invalid_request            | do_not_retry                    |
| `1288`   | Void not supported for this related transaction type on this processor              | invalid_request            | do_not_retry                    |
| `1289`   | Issuer data unavailable; try later                                                  | provider_unavailable       | retry_conditionally             |
| `1290`   | NextAction is DoChallenge but the challenge result does not allow sale or auth      | authentication_failed      | do_not_retry                    |
| `1292`   | NextAction is Stop; send no further transaction                                     | authentication_failed      | do_not_retry                    |
| `1293`   | Temporary 3DS 2.0 malfunction; retry                                                | provider_unavailable       | safe_to_retry_technical_request |
| `1295`   | Cross-border OCT above 10,000 EUR not allowed in Azerbaijan, Moldova, Ukraine       | invalid_amount             | do_not_retry                    |
| `1296`   | Non-domestic OCT not allowed for this issuer or merchant country                    | payment_method_unavailable | do_not_retry                    |
| `1297`   | Acquirer reference number and auth code duplicated                                  | duplicate_request          | do_not_retry                    |
| `1300`   | Retry limit exceeded; issuer will not approve the same amount                       | card_declined              | do_not_retry                    |
| `1500`   | Client not allowed to use this channel                                              | configuration              | do_not_retry                    |
| `1501`   | Client not allowed to use Suppress Auth                                             | configuration              | do_not_retry                    |
| `1550`   | Auto reversal parameters incomplete                                                 | invalid_request            | do_not_retry                    |
| `1551`   | Client not permitted to use auto reversal                                           | configuration              | do_not_retry                    |
| `1552`   | Input parameter data type incorrect                                                 | invalid_request            | do_not_retry                    |
| `1553`   | Auto reversal currency differs from the settle currency                             | invalid_request            | do_not_retry                    |
| `1554`   | Auto reversal amount does not match settle and auth amounts                         | invalid_amount             | do_not_retry                    |
| `1555`   | Auto reversal not allowed with multiple settles                                     | invalid_request            | do_not_retry                    |
| `1556`   | Settle amount plus auto reversal amount must equal the original auth                | invalid_amount             | do_not_retry                    |
| `1557`   | Original currency differs from auto reversal currency                               | invalid_request            | do_not_retry                    |
| `1558`   | Auto reversal input parameters incorrect                                            | invalid_request            | do_not_retry                    |
| `1559`   | Auth cannot be voided: already settled                                              | invalid_request            | do_not_retry                    |
| `1560`   | Auth type not allowed                                                               | configuration              | do_not_retry                    |
| `2001`   | Requested acquirer bank temporarily unavailable                                     | provider_unavailable       | retry_conditionally             |
| `2002`   | ApmRisk disabled                                                                    | configuration              | do_not_retry                    |
| `2025`   | External MPI not supported for this acquirer                                        | configuration              | do_not_retry                    |
| `2030`   | External token provider invalid                                                     | invalid_request            | do_not_retry                    |
| `3001`   | Sale reversal interval invalid                                                      | invalid_request            | do_not_retry                    |
| `3002`   | Refund reversal interval invalid                                                    | invalid_request            | do_not_retry                    |
| `3003`   | OCT reversal interval invalid                                                       | invalid_request            | do_not_retry                    |
| `3004`   | Transaction already reversed                                                        | duplicate_request          | do_not_retry                    |
| `3005`   | Transaction not approved                                                            | invalid_request            | do_not_retry                    |
| `3006`   | Transaction type does not match reversal type                                       | invalid_request            | do_not_retry                    |
| `3007`   | Transaction not yet transmitted                                                     | invalid_request            | retry_conditionally             |
| `3008`   | Transaction already has a chargeback record                                         | invalid_request            | do_not_retry                    |
| `3500`   | POS parameter invalid                                                               | invalid_request            | do_not_retry                    |
| `3501`   | Mandatory POS parameter missing                                                     | invalid_request            | do_not_retry                    |
| `3502`   | KYC parameters error                                                                | invalid_request            | do_not_retry                    |
| `3503`   | ClientUniqueID required by configuration                                            | invalid_request            | do_not_retry                    |
| `3504`   | Transaction already settled                                                         | duplicate_request          | do_not_retry                    |
| `3505`   | A sale already exists for this Auth3d                                               | duplicate_request          | do_not_retry                    |
| `3506`   | TransactionID wrong or does not exist                                               | invalid_request            | do_not_retry                    |
| `3507`   | Installments not allowed                                                            | configuration              | do_not_retry                    |
| `3508`   | Number of installments must be 0 or more                                            | invalid_request            | do_not_retry                    |
| `3509`   | firstInstallment, periodicalInstallment or numberOfInstallments missing             | invalid_request            | do_not_retry                    |
| `10012`  | Saved payment option no longer valid                                                | payment_method_unavailable | customer_action_required        |
| `10013`  | Payment option cannot be registered at the APM                                      | payment_method_unavailable | customer_action_required        |
| `10014`  | APM authentication error                                                            | authentication_failed      | customer_action_required        |
| `10025`  | MoneySend parameter missing or invalid                                              | invalid_request            | do_not_retry                    |
| `10026`  | Two-phase auth-settle not supported in Visa Direct AFT                              | invalid_request            | do_not_retry                    |
| `10027`  | Non-domestic AFT not allowed for this issuer or merchant country                    | payment_method_unavailable | do_not_retry                    |
| `10028`  | Card-present not supported in Visa Direct AFT                                       | invalid_request            | do_not_retry                    |
| `10029`  | Installments program missing or invalid                                             | invalid_request            | do_not_retry                    |
| `10030`  | Number of installments must be valid and above 0                                    | invalid_request            | do_not_retry                    |
| `10031`  | SenderName required for cross-border                                                | invalid_request            | do_not_retry                    |
| `10034`  | AFT credit adjustment interval invalid                                              | invalid_request            | do_not_retry                    |
| `10035`  | RecipientCardNumber or RecipientToken missing                                       | invalid_request            | do_not_retry                    |
| `10036`  | Transaction batch marked closed within the last 60 days                             | invalid_request            | do_not_retry                    |
| `10037`  | Client not configured for external authorization                                    | configuration              | do_not_retry                    |
| `10038`  | sg_CascadeToCredit invalid                                                          | invalid_request            | do_not_retry                    |
| `10040`  | Amount above the unreferenced refund limit                                          | invalid_amount             | do_not_retry                    |
| `10041`  | sg_TaxAmountBase missing                                                            | invalid_request            | do_not_retry                    |
| `10042`  | sg_personalID missing                                                               | invalid_request            | do_not_retry                    |
| `10043`  | Installments above the maximum of 99                                                | invalid_request            | do_not_retry                    |
| `10044`  | Settle amount above authorization thresholds                                        | invalid_amount             | do_not_retry                    |
| `10046`  | sg_BatchStartGMT is in the past                                                     | invalid_request            | do_not_retry                    |
| `10047`  | Transaction batch marked closed within the last 60 days (repeat of 10036)           | invalid_request            | do_not_retry                    |
| `10048`  | Debit or prepaid cards cannot be used for installments                              | payment_method_unavailable | customer_action_required        |
| `10049`  | Visa Colombian domestic transactions must be in COP                                 | invalid_request            | do_not_retry                    |
| `10050`  | sg_FirstName missing                                                                | invalid_request            | do_not_retry                    |
| `10051`  | sg_LastName missing                                                                 | invalid_request            | do_not_retry                    |
| `10052`  | Address required for cross-border                                                   | invalid_request            | do_not_retry                    |
| `10053`  | City required for cross-border                                                      | invalid_request            | do_not_retry                    |
| `10054`  | AFT auth: South African first name identification missing                           | invalid_request            | do_not_retry                    |
| `10055`  | Void not allowed on fast funds payouts                                              | invalid_request            | do_not_retry                    |
| `10056`  | Address required for cross-border (repeat of 10052)                                 | invalid_request            | do_not_retry                    |
| `10057`  | City required for cross-border (repeat of 10053)                                    | invalid_request            | do_not_retry                    |
| `10058`  | Name required for South African cross-border                                        | invalid_request            | do_not_retry                    |
| `10059`  | AFT auth: Brazilian phone or email identification missing                           | invalid_request            | do_not_retry                    |
| `10060`  | Card brand blocked by merchant restriction configuration                            | configuration              | do_not_retry                    |
| `10061`  | Country required for cross-border                                                   | invalid_request            | do_not_retry                    |
| `10062`  | BAI value invalid                                                                   | invalid_request            | do_not_retry                    |
| `10065`  | Merchant not approved for cross-border AFT                                          | configuration              | do_not_retry                    |
| `10066`  | sg_Address missing                                                                  | invalid_request            | do_not_retry                    |
| `10067`  | sg_City missing                                                                     | invalid_request            | do_not_retry                    |
| `10068`  | sg_state missing                                                                    | invalid_request            | do_not_retry                    |
| `10069`  | sg_zip missing                                                                      | invalid_request            | do_not_retry                    |
| `10070`  | sg_BatchNumber missing                                                              | invalid_request            | do_not_retry                    |
| `10071`  | sg_BatchStartGMT missing                                                            | invalid_request            | do_not_retry                    |
| `10072`  | Colombian domestic transaction not allowed                                          | payment_method_unavailable | do_not_retry                    |
| `10073`  | State does not match ISO code                                                       | invalid_request            | do_not_retry                    |
| `10074`  | AMEX does not support 3D together with an external token provider (Apple Pay)       | payment_method_unavailable | do_not_retry                    |
| `10075`  | Paymentez does not support 3D together with an external token provider              | payment_method_unavailable | do_not_retry                    |
| `101778` | Card reissued after loss or theft                                                   | card_declined              | customer_action_required        |

#### 4.5 Gateway decline reasons (`gwErrorReason`, also DMN `Reason`): 170 listed strings + 10 from the description appendix

These are text values, not numbers. They apply "when `transactionStatus` or `result` is DECLINED". The list contains near-duplicates that differ only in case or a trailing period (`Insufficient funds` / `Insufficient funds.`); match them case-insensitively and ignore a trailing period, but keep the original string for display. "desc table" in a row means the Gateway Decline Reason Descriptions appendix explains that value; the paraphrase follows that explanation.

| `gwErrorReason` value (as listed)                                                      | Meaning (paraphrase)                                                                                              | Category                   | Retry class                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `Account Closed`                                                                       | Account is closed                                                                                                 | card_declined              | do_not_retry                    |
| `Account Not Yet Activated`                                                            | Account not activated yet (desc table: same)                                                                      | card_declined              | customer_action_required        |
| `Acquirer validation`                                                                  | Acquirer-side validation decline                                                                                  | card_declined              | manual_review                   |
| `Activity limit exceeded`                                                              | Activity limit reached                                                                                            | card_declined              | customer_action_required        |
| `Admin Card Not Found`                                                                 | Admin card not found                                                                                              | card_declined              | do_not_retry                    |
| `Already reversed`                                                                     | Transaction was already reversed                                                                                  | duplicate_request          | do_not_retry                    |
| `Amount mismatch`                                                                      | Amount does not match                                                                                             | invalid_amount             | do_not_retry                    |
| `APM authentication error`                                                             | APM authentication failed                                                                                         | authentication_failed      | customer_action_required        |
| `Authentication Error`                                                                 | Authentication error                                                                                              | authentication_failed      | customer_action_required        |
| `Authorization error`                                                                  | Authorization error                                                                                               | card_declined              | manual_review                   |
| `AVS Failed`                                                                           | Address verification failed                                                                                       | card_declined              | customer_action_required        |
| `Bank is not supported`                                                                | Bank not supported                                                                                                | payment_method_unavailable | customer_action_required        |
| `Black listed by APM`                                                                  | Blacklisted by the APM                                                                                            | fraud_or_risk              | do_not_retry                    |
| `Blocked by cardholder/contact cardholder`                                             | Cardholder blocked the card (desc table: same)                                                                    | card_declined              | customer_action_required        |
| `Blocked, first used-transaction from new cardholder, and card not properly unblocked` | Blocked on first use: new card not properly unblocked                                                             | card_declined              | customer_action_required        |
| `Call issuer`                                                                          | Refer to issuer; voice authorization may be possible (desc table)                                                 | card_declined              | customer_action_required        |
| `Cannot verify PIN`                                                                    | PIN could not be verified (desc table: PIN-related decline)                                                       | authentication_failed      | customer_action_required        |
| `Card declined`                                                                        | Card declined                                                                                                     | card_declined              | customer_action_required        |
| `Card Not Eligible`                                                                    | Card not eligible                                                                                                 | card_declined              | customer_action_required        |
| `Card not found - non-participating BIN/issuer`                                        | Card not found; BIN or issuer not participating                                                                   | card_declined              | customer_action_required        |
| `Card not found - participating BIN/issuer`                                            | Card not found; BIN or issuer participating                                                                       | card_declined              | customer_action_required        |
| `Card Type Verification Error`                                                         | Card type verification error                                                                                      | card_declined              | customer_action_required        |
| `Closed account`                                                                       | Account is closed                                                                                                 | card_declined              | do_not_retry                    |
| `Closed account by issuer. Issuer will not approve same amount in next 30 days`        | Issuer closed the account; same amount will not be approved for 30 days (desc table: do not retry with this card) | card_declined              | do_not_retry                    |
| `Closed account.`                                                                      | Account is closed                                                                                                 | card_declined              | do_not_retry                    |
| `Consumer Cannot Pay`                                                                  | Consumer cannot pay                                                                                               | card_declined              | customer_action_required        |
| `Cryptographic error found in PIN`                                                     | PIN cryptographic error (desc table: PIN-related, possible security block)                                        | authentication_failed      | do_not_retry                    |
| `Cupon Already Used.`                                                                  | Coupon already used                                                                                               | invalid_request            | customer_action_required        |
| `Customer has not given consent for PSD2 payment`                                      | Customer did not consent to the PSD2 payment                                                                      | authentication_required    | customer_action_required        |
| `CVV data is not correct`                                                              | CVV data not correct                                                                                              | card_declined              | customer_action_required        |
| `CVV2 Value supplied is invalid`                                                       | CVV2 value invalid                                                                                                | card_declined              | customer_action_required        |
| `Daily threshold exceeded`                                                             | Daily threshold reached                                                                                           | card_declined              | customer_action_required        |
| `Decline`                                                                              | Declined                                                                                                          | card_declined              | customer_action_required        |
| `Declined`                                                                             | Declined                                                                                                          | card_declined              | customer_action_required        |
| `Default`                                                                              | Default decline                                                                                                   | card_declined              | customer_action_required        |
| `Denied, do not repeat before 72 hours.`                                               | Denied; do not repeat for 72 hours                                                                                | card_declined              | retry_conditionally             |
| `Different funding option required`                                                    | A different funding option is required                                                                            | payment_method_unavailable | customer_action_required        |
| `Do not honor`                                                                         | Do not honor: most common generic issuer decline (desc table)                                                     | card_declined              | customer_action_required        |
| `Duplicate transaction`                                                                | Duplicate transaction (desc table: sent twice)                                                                    | duplicate_request          | do_not_retry                    |
| `Duplicated transaction. Try later`                                                    | Duplicate transaction; try later                                                                                  | duplicate_request          | retry_conditionally             |
| `E002-System error`                                                                    | System error (E002)                                                                                               | provider_unavailable       | retry_conditionally             |
| `E010-Invalid size of first name`                                                      | First name length invalid (E010)                                                                                  | invalid_request            | customer_action_required        |
| `E026-Invalid customer’s bank routing/ABA number`                                      | Bank routing/ABA number invalid (E026)                                                                            | invalid_request            | customer_action_required        |
| `E040-The credit transaction is declined as daily credit limit is exceeded.`           | Credit declined: daily credit limit exceeded (E040)                                                               | invalid_amount             | retry_conditionally             |
| `E201-Fraudulent or suspicious bank account`                                           | Bank account flagged as fraudulent or suspicious (E201)                                                           | fraud_or_risk              | do_not_retry                    |
| `E202-Fraudulent or suspicious identity`                                               | Identity flagged as fraudulent or suspicious (E202)                                                               | fraud_or_risk              | do_not_retry                    |
| `E203-Fraudulent or suspicious transaction pattern`                                    | Transaction pattern flagged as fraudulent or suspicious (E203)                                                    | fraud_or_risk              | do_not_retry                    |
| `End user did not complete`                                                            | End user did not complete the flow                                                                                | unknown                    | customer_action_required        |
| `Error in decryption of PIN block`                                                     | PIN block decryption error (desc table: security violation, card may be restricted)                               | authentication_failed      | do_not_retry                    |
| `Exceeded retry limit, issuer cannot approve at this time`                             | Retry limit exceeded; issuer cannot approve now                                                                   | card_declined              | retry_conditionally             |
| `Exceeded retry limit, issuer will never approve`                                      | Retry limit exceeded; issuer will never approve                                                                   | card_declined              | do_not_retry                    |
| `Exceeds daily limits`                                                                 | Daily limits exceeded                                                                                             | card_declined              | customer_action_required        |
| `Exceeds transaction limits`                                                           | Transaction limits exceeded                                                                                       | card_declined              | customer_action_required        |
| `Exceeds withdrawal frequency`                                                         | Withdrawal frequency exceeded (desc table)                                                                        | card_declined              | customer_action_required        |
| `Exceeds withdrawal limit`                                                             | Withdrawal amount limit exceeded (desc table)                                                                     | card_declined              | customer_action_required        |
| `Expired card`                                                                         | Card expired or expiry mismatch (desc table)                                                                      | card_declined              | customer_action_required        |
| `External Error In Processing`                                                         | External processing error; may succeed later (desc table)                                                         | provider_unavailable       | retry_conditionally             |
| `Failed 3DSecure Authentication`                                                       | 3D Secure authentication failed                                                                                   | authentication_failed      | customer_action_required        |
| `Format error`                                                                         | Format error; for Mastercard/Maestro may mean CVV or 3DS issue (desc table)                                       | invalid_request            | manual_review                   |
| `GENERAL DECLINE`                                                                      | General decline                                                                                                   | card_declined              | customer_action_required        |
| `General Error`                                                                        | General error                                                                                                     | unknown                    | manual_review                   |
| `Generic Decline`                                                                      | Generic decline                                                                                                   | card_declined              | customer_action_required        |
| `Global General Error`                                                                 | Global general error                                                                                              | unknown                    | manual_review                   |
| `IM - Invalid Member Number`                                                           | Invalid member number                                                                                             | card_declined              | do_not_retry                    |
| `Incorrect PIN`                                                                        | Incorrect PIN (desc table)                                                                                        | authentication_failed      | customer_action_required        |
| `Incorrect request parameter`                                                          | Incorrect request parameter                                                                                       | invalid_request            | do_not_retry                    |
| `Insufficient funds`                                                                   | Insufficient funds (desc table)                                                                                   | insufficient_funds         | customer_action_required        |
| `Insufficient funds.`                                                                  | Insufficient funds                                                                                                | insufficient_funds         | customer_action_required        |
| `Invalid Account`                                                                      | Account invalid                                                                                                   | card_declined              | customer_action_required        |
| `Invalid Account Number`                                                               | Account number invalid                                                                                            | invalid_request            | customer_action_required        |
| `Invalid account specified`                                                            | Account invalid or not linked (desc table)                                                                        | card_declined              | customer_action_required        |
| `Invalid amount`                                                                       | Invalid amount; may also reflect currency or funds (desc table)                                                   | invalid_amount             | customer_action_required        |
| `Invalid argument`                                                                     | Invalid argument                                                                                                  | invalid_request            | do_not_retry                    |
| `Invalid argument. Unknown alias`                                                      | Invalid argument: unknown alias                                                                                   | invalid_request            | do_not_retry                    |
| `Invalid Card Number`                                                                  | Card number invalid or does not exist (desc table)                                                                | card_declined              | customer_action_required        |
| `Invalid Credit Type`                                                                  | Credit type invalid                                                                                               | invalid_request            | do_not_retry                    |
| `Invalid Cupon.`                                                                       | Coupon invalid                                                                                                    | invalid_request            | customer_action_required        |
| `Invalid CVV`                                                                          | CVV invalid                                                                                                       | card_declined              | customer_action_required        |
| `Invalid CVV2`                                                                         | CVV2 does not match the card; Visa only (desc table)                                                              | card_declined              | customer_action_required        |
| `Invalid 'From' account specified`                                                     | From account invalid (desc table)                                                                                 | card_declined              | customer_action_required        |
| `Invalid Issue Number`                                                                 | Issue number invalid                                                                                              | invalid_request            | customer_action_required        |
| `Invalid merchant`                                                                     | Invalid merchant: generic decline, usually not a merchant problem (desc table)                                    | card_declined              | customer_action_required        |
| `Invalid Merchant ID`                                                                  | Merchant ID invalid                                                                                               | configuration              | do_not_retry                    |
| `Invalid phone number.`                                                                | Phone number invalid                                                                                              | invalid_request            | customer_action_required        |
| `Invalid request parameter.`                                                           | Request parameter invalid                                                                                         | invalid_request            | do_not_retry                    |
| `Invalid service code, restricted`                                                     | Service code invalid; restricted                                                                                  | card_declined              | do_not_retry                    |
| `Invalid 'To' account specified`                                                       | To account invalid; also known as unsolicited reversal (desc table)                                               | card_declined              | customer_action_required        |
| `Invalid transaction`                                                                  | Invalid transaction: generic issuer decline (desc table)                                                          | card_declined              | customer_action_required        |
| `Invalid transaction; contact card issuer`                                             | Invalid transaction; contact the card issuer (desc table)                                                         | card_declined              | customer_action_required        |
| `Issuer or switch inoperative`                                                         | Issuer or switch inoperative, for example timeout (desc table)                                                    | provider_unavailable       | retry_conditionally             |
| `Life Cycle`                                                                           | Lifecycle decline                                                                                                 | card_declined              | customer_action_required        |
| `Lost card, pick up (fraud account)`                                                   | Lost card, pick up; fraud account                                                                                 | fraud_or_risk              | do_not_retry                    |
| `Lost card, pick-up`                                                                   | Lost card, pick up                                                                                                | fraud_or_risk              | do_not_retry                    |
| `Lost/Stolen`                                                                          | Lost or stolen                                                                                                    | fraud_or_risk              | do_not_retry                    |
| `Missing mandatory field`                                                              | Mandatory field missing                                                                                           | invalid_request            | do_not_retry                    |
| `Negative CAM, dCVV, iCVV, or CVV results`                                             | Negative CAM, dCVV, iCVV or CVV result                                                                            | card_declined              | customer_action_required        |
| `No account`                                                                           | No account                                                                                                        | card_declined              | customer_action_required        |
| `No action taken`                                                                      | No action taken                                                                                                   | card_declined              | manual_review                   |
| `No credit account`                                                                    | No credit account (desc table)                                                                                    | card_declined              | customer_action_required        |
| `No current account`                                                                   | No current account                                                                                                | card_declined              | customer_action_required        |
| `No savings account`                                                                   | No savings account (desc table)                                                                                   | card_declined              | customer_action_required        |
| `No such issuer`                                                                       | No such issuer; BIN not in acquirer list (desc table)                                                             | card_declined              | customer_action_required        |
| `No update, but the account is valid`                                                  | No update; account is valid                                                                                       | unknown                    | unknown                         |
| `Payee First Name / Last Name is missing or invalid`                                   | Payee first or last name missing or invalid                                                                       | invalid_request            | customer_action_required        |
| `Payment Denied`                                                                       | Payment denied                                                                                                    | card_declined              | customer_action_required        |
| `Payment method Technical Error`                                                       | Payment method technical error                                                                                    | provider_unavailable       | retry_conditionally             |
| `Payment not authorized by user`                                                       | Payment not authorized by the user                                                                                | unknown                    | customer_action_required        |
| `Payment not authorized by user.`                                                      | Payment not authorized by the user                                                                                | unknown                    | customer_action_required        |
| `PayPal account was not verified, please contact PayPal support`                       | PayPal account not verified                                                                                       | payment_method_unavailable | customer_action_required        |
| `PayPal Business account is not allowed`                                               | PayPal Business accounts not allowed                                                                              | payment_method_unavailable | customer_action_required        |
| `Pick up card (no fraud)`                                                              | Pick up card, no fraud                                                                                            | card_declined              | do_not_retry                    |
| `Pick up card, special condition (fraud account)`                                      | Pick up card, special condition, fraud account (desc table)                                                       | fraud_or_risk              | do_not_retry                    |
| `Pick-up card`                                                                         | Pick up card                                                                                                      | fraud_or_risk              | do_not_retry                    |
| `PIN Code is required`                                                                 | PIN required                                                                                                      | authentication_required    | customer_action_required        |
| `PIN tried exceeded`                                                                   | PIN tries exceeded                                                                                                | authentication_failed      | do_not_retry                    |
| `PIN tries exceeded`                                                                   | PIN tries exceeded (desc table: card blocked by issuer)                                                           | authentication_failed      | do_not_retry                    |
| `Process canceled`                                                                     | Process cancelled                                                                                                 | unknown                    | customer_action_required        |
| `Process cancelled.`                                                                   | Process cancelled                                                                                                 | unknown                    | customer_action_required        |
| `Process failed`                                                                       | Process failed                                                                                                    | unknown                    | manual_review                   |
| `Receiving Limit exceeded`                                                             | Receiving limit exceeded                                                                                          | card_declined              | customer_action_required        |
| `Re-enter transaction`                                                                 | Re-enter the transaction                                                                                          | provider_unavailable       | retry_conditionally             |
| `Refer to issuer`                                                                      | Refer to issuer                                                                                                   | card_declined              | customer_action_required        |
| `Referral`                                                                             | Referral                                                                                                          | card_declined              | customer_action_required        |
| `Rejected by carrier.`                                                                 | Rejected by carrier                                                                                               | payment_method_unavailable | customer_action_required        |
| `Restricted card`                                                                      | Restricted card (desc table)                                                                                      | card_declined              | do_not_retry                    |
| `Restricted card/bank account`                                                         | Restricted card or bank account                                                                                   | card_declined              | do_not_retry                    |
| `Retry the transaction later`                                                          | Retry later                                                                                                       | provider_unavailable       | retry_conditionally             |
| `Revocation of all authorizations order`                                               | Cardholder revoked all authorizations; stop recurring (desc table)                                                | card_declined              | do_not_retry                    |
| `Revocation of authorization order`                                                    | Cardholder revoked this authorization; stop recurring (desc table)                                                | card_declined              | do_not_retry                    |
| `Routing error`                                                                        | Cannot reach the authorizing destination (desc table)                                                             | provider_unavailable       | manual_review                   |
| `SC_MISSING_MANDATORY_FIELD`                                                           | Mandatory field missing                                                                                           | invalid_request            | do_not_retry                    |
| `Security violation`                                                                   | Security violation                                                                                                | fraud_or_risk              | do_not_retry                    |
| `Security violations`                                                                  | Security violations                                                                                               | fraud_or_risk              | do_not_retry                    |
| `Soft Decline - Authentication is Advised`                                             | Soft decline; retry with 3DS may help (desc table)                                                                | authentication_required    | customer_action_required        |
| `Stolen card, pick up`                                                                 | Stolen card, pick up                                                                                              | fraud_or_risk              | do_not_retry                    |
| `Stolen card, pick up (fraud account)`                                                 | Stolen card, pick up; fraud account                                                                               | fraud_or_risk              | do_not_retry                    |
| `Stolen card, pick-up`                                                                 | Stolen card, pick up                                                                                              | fraud_or_risk              | do_not_retry                    |
| `Suspected fraud`                                                                      | Suspected fraud (desc table)                                                                                      | fraud_or_risk              | do_not_retry                    |
| `Suspected fraud by issuer. Issuer will not approve same amount in the next 30 days.`  | Issuer suspects fraud; same amount not approved for 30 days                                                       | fraud_or_risk              | do_not_retry                    |
| `System Error`                                                                         | System error                                                                                                      | provider_unavailable       | retry_conditionally             |
| `System not available`                                                                 | System not available (desc table)                                                                                 | provider_unavailable       | retry_conditionally             |
| `The Email field is mandatory`                                                         | Email field required                                                                                              | invalid_request            | customer_action_required        |
| `The message returned by the financial network is inconsistent.`                       | Financial network message inconsistent                                                                            | provider_unavailable       | manual_review                   |
| `The security code or expiration date was invalid.`                                    | Security code or expiry date invalid                                                                              | card_declined              | customer_action_required        |
| `Timeout/Retry`                                                                        | Acquirer-issuer timeout (desc table)                                                                              | network_or_timeout         | retry_conditionally             |
| `Transaction cannot be completed`                                                      | Issuer could not complete; cardholder should contact issuer if repeated (desc table)                              | card_declined              | customer_action_required        |
| `Transaction cannot be completed; violation of law`                                    | Cannot complete: violation of law                                                                                 | card_declined              | do_not_retry                    |
| `Transaction declined, please contact support!`                                        | Declined; contact support                                                                                         | unknown                    | manual_review                   |
| `Transaction does not fulfil AML requirement`                                          | Does not meet AML requirement                                                                                     | fraud_or_risk              | manual_review                   |
| `Transaction expired`                                                                  | Transaction expired                                                                                               | unknown                    | customer_action_required        |
| `Transaction is aborted.`                                                              | Transaction aborted                                                                                               | unknown                    | manual_review                   |
| `Transaction Not Found`                                                                | Transaction not found                                                                                             | invalid_request            | do_not_retry                    |
| `Transaction not permitted on terminal`                                                | Not permitted on this terminal; issuer may reject merchant or industry (desc table)                               | card_declined              | do_not_retry                    |
| `Transaction not permitted to cardholder`                                              | Not permitted to cardholder, for example restricted industry or country (desc table)                              | card_declined              | do_not_retry                    |
| `Transaction not permitted to cardholder.`                                             | Not permitted to cardholder                                                                                       | card_declined              | do_not_retry                    |
| `Transaction not permitted-Card`                                                       | Not permitted on card                                                                                             | card_declined              | do_not_retry                    |
| `Transaction not permitted-Terminal`                                                   | Not permitted on terminal                                                                                         | card_declined              | do_not_retry                    |
| `Transaction not supported/blocked by issuer`                                          | Issuer blocked or does not support the transaction (desc table)                                                   | card_declined              | do_not_retry                    |
| `Tsys Filter - An error occured`                                                       | TSYS filter error                                                                                                 | provider_unavailable       | manual_review                   |
| `Unable to locate, no match`                                                           | Unable to locate; no match                                                                                        | invalid_request            | manual_review                   |
| `Unable to refund`                                                                     | Unable to refund                                                                                                  | unknown                    | manual_review                   |
| `UNEXPECTED SYSTEM ERROR - PLEASE RETRY LATER`                                         | Unexpected system error; retry later                                                                              | provider_unavailable       | safe_to_retry_technical_request |
| `Unknown Error`                                                                        | Unknown error                                                                                                     | unknown                    | unknown                         |
| `User aborted the transaction`                                                         | User aborted                                                                                                      | unknown                    | customer_action_required        |
| `User account problem`                                                                 | User account problem                                                                                              | payment_method_unavailable | customer_action_required        |
| `User account problem.`                                                                | User account problem                                                                                              | payment_method_unavailable | customer_action_required        |
| `Verification data failed`                                                             | Verification data failed                                                                                          | authentication_failed      | customer_action_required        |
| `Violation of Gaming Regulation`                                                       | Gaming regulation violation                                                                                       | configuration              | do_not_retry                    |
| `Violation, cannot complete`                                                           | Violation; cannot complete                                                                                        | card_declined              | do_not_retry                    |
| `You must repeat the transaction.`                                                     | Transaction must be repeated                                                                                      | provider_unavailable       | retry_conditionally             |

The description appendix also explains values that are not in the list above. Some differ from listed values only in case or punctuation (`External Error in Processing`, `Invalid card number`, `Insufficient Funds`, curly quotes in `Invalid "To" account specified`, a different dash in "Soft Decline - Authentication is Advised", `Revocation of Authorization Order`, two "will not approve ... 30 days" sentences with different word order). These ten are new:

| Value (as written in the description table)       | Meaning (paraphrase)                                  | Category                   | Retry class              |
| ------------------------------------------------- | ----------------------------------------------------- | -------------------------- | ------------------------ |
| `Pick up card`                                    | Issuer asks to retain the card; may be lost or stolen | fraud_or_risk              | do_not_retry             |
| `Unable to locate record in file`                 | Technical failure; may succeed later                  | provider_unavailable       | retry_conditionally      |
| `File temporarily not available`                  | Technical failure; may succeed later                  | provider_unavailable       | retry_conditionally      |
| `Lost card`                                       | Card listed as lost by the issuer                     | fraud_or_risk              | do_not_retry             |
| `Stolen card`                                     | Card listed as stolen by the issuer                   | fraud_or_risk              | do_not_retry             |
| `No checking account`                             | Problem with the account behind the card              | card_declined              | customer_action_required |
| `PIN not changed`                                 | Declined because of the PIN                           | authentication_failed      | customer_action_required |
| `PIN unacceptable. Retry.`                        | PIN not acceptable                                    | authentication_failed      | customer_action_required |
| `3DS authentication failed, payment not allowed.` | Do not request again, not even without 3DS            | authentication_failed      | do_not_retry             |
| `Deactivated Tokens`                              | Cardholder deactivated the token; stop retries        | payment_method_unavailable | do_not_retry             |

#### 4.6 Failed 3DS authorization reason (`threeDReasonId` / `threeDReason`, also DMN `3DReasonId` / `threeDReason`): 34 values

Source: D/features/3d-secure/3ds-implementations/3ds-responses/. Returned by the issuer when 3DS authentication failed.

| `threeDReasonId` | Meaning (paraphrase)                                                                  | Category              | Retry class              |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------- | ------------------------ |
| `01`             | Card authentication failed                                                            | authentication_failed | customer_action_required |
| `02`             | Unknown device                                                                        | authentication_failed | customer_action_required |
| `03`             | Unsupported device                                                                    | authentication_failed | customer_action_required |
| `04`             | Authentication frequency limit exceeded                                               | authentication_failed | retry_conditionally      |
| `05`             | Expired card                                                                          | card_declined         | customer_action_required |
| `06`             | Invalid card number                                                                   | card_declined         | customer_action_required |
| `07`             | Invalid transaction                                                                   | authentication_failed | do_not_retry             |
| `08`             | No card record                                                                        | card_declined         | customer_action_required |
| `09`             | Security failure                                                                      | fraud_or_risk         | do_not_retry             |
| `10`             | Stolen card                                                                           | fraud_or_risk         | do_not_retry             |
| `11`             | Suspected fraud                                                                       | fraud_or_risk         | do_not_retry             |
| `12`             | Not permitted to cardholder                                                           | card_declined         | do_not_retry             |
| `13`             | Cardholder not enrolled in the service                                                | authentication_failed | customer_action_required |
| `14`             | Timed out at the ACS                                                                  | network_or_timeout    | retry_conditionally      |
| `15`             | Low confidence                                                                        | fraud_or_risk         | customer_action_required |
| `16`             | Medium confidence                                                                     | fraud_or_risk         | customer_action_required |
| `17`             | High confidence                                                                       | fraud_or_risk         | customer_action_required |
| `18`             | Very high confidence                                                                  | fraud_or_risk         | customer_action_required |
| `19`             | ACS maximum challenges reached                                                        | authentication_failed | retry_conditionally      |
| `20`             | Non-payment transactions not supported                                                | invalid_request       | do_not_retry             |
| `21`             | 3RI transaction not supported (code no longer allowed since 1 September 2019)         | invalid_request       | do_not_retry             |
| `22`             | ACS technical issue                                                                   | provider_unavailable  | retry_conditionally      |
| `23`             | ACS requires decoupled authentication the requestor did not ask for                   | authentication_failed | do_not_retry             |
| `24`             | Decoupled authentication maximum expiry time exceeded                                 | authentication_failed | retry_conditionally      |
| `25`             | Too little time for decoupled authentication                                          | authentication_failed | retry_conditionally      |
| `26`             | Authentication attempted but not performed by the cardholder                          | authentication_failed | customer_action_required |
| `81`             | Mastercard: exemption request accepted; Visa: ACS timed out (same code, two meanings) | unknown               | unknown                  |
| `82`             | Visa: invalid response from ACS                                                       | provider_unavailable  | retry_conditionally      |
| `83`             | Visa: system error response from ACS                                                  | provider_unavailable  | retry_conditionally      |
| `84`             | Visa: internal error while generating CAVV                                            | provider_unavailable  | retry_conditionally      |
| `85`             | Visa: VMID not eligible for the requested program                                     | configuration         | do_not_retry             |
| `86`             | Visa: protocol version not supported by ACS                                           | authentication_failed | do_not_retry             |
| `87`             | Visa: excluded from attempts processing (includes non-reloadable prepaid)             | authentication_failed | do_not_retry             |
| `88`             | Visa: requested program not supported by ACS                                          | authentication_failed | do_not_retry             |

Related 3DS value set (`threeD.result` / `challengeStatus`, from the `/getTransactionDetails` output table): `Y` authenticated, `N` not authenticated / denied, `U` could not be performed, `A` attempt with proof, `C` challenge required, `D` decoupled challenge confirmed, `R` rejected by issuer. The REST 1.0 page adds `threeD.flow: "softDecline"` on a soft-declined `/payment`, after which a new `/initPayment` with `relatedTransactionId` is expected. The `challengePreferenceReason` table is on a linked page that was not read: **NOT DOCUMENTED** here.

#### 4.7 Mastercard Merchant Advice Code (`merchantAdviceCode`): 16 values

Source: payment DMN parameter table (the REST output tables link to the same list).

| Value | Meaning (paraphrase)                                          | Retry hint               |
| ----- | ------------------------------------------------------------- | ------------------------ |
| `01`  | New account information available                             | customer_action_required |
| `02`  | Cannot approve now; try again later                           | retry_conditionally      |
| `03`  | Do not try again                                              | do_not_retry             |
| `04`  | Token requirements not met for this token type                | do_not_retry             |
| `21`  | Payment cancelled; do not try again                           | do_not_retry             |
| `24`  | Retry after 1 hour                                            | retry_conditionally      |
| `25`  | Retry after 24 hours                                          | retry_conditionally      |
| `26`  | Retry after 2 days                                            | retry_conditionally      |
| `27`  | Retry after 4 days                                            | retry_conditionally      |
| `28`  | Retry after 6 days                                            | retry_conditionally      |
| `29`  | Retry after 8 days                                            | retry_conditionally      |
| `30`  | Retry after 10 days                                           | retry_conditionally      |
| `40`  | Consumer non-reloadable prepaid card                          | do_not_retry             |
| `41`  | Consumer single-use virtual card number                       | do_not_retry             |
| `42`  | Above the issuer's risk threshold; retry with another account | customer_action_required |
| `43`  | Consumer multi-use virtual card number                        | unknown                  |

Note: the API reference examples for successful `/payment`, `/refundTransaction` and `/payout` responses carry `"merchantAdviceCode": "02"`, so a MAC must only be interpreted together with a decline.

#### 4.8 CVV2, AVS and ECI value sets

- `cvv2Reply` / `Cvv2Reply` (5 values): `M` match, `N` no match, `P` not processed (Visa removes CVV for EU card-on-file and e-commerce network-token transactions), `U` issuer not certified or no keys, `S` CVV2 processor unavailable.
- `avsCode` / `AvsCode` (10 values): `A` street matches, ZIP does not; `W` 9-digit ZIP matches, street does not; `Y` 5-digit ZIP and street match; `X` 9-digit ZIP and street match; `Z` 5-digit ZIP matches, street does not; `U` issuer unavailable; `S` not supported; `R` retry; `B` not authorized (declined); `N` neither matches.
- `eci`: Visa `5` authenticated, `6` issuer or cardholder not participating, `7` not performed; Mastercard `1` not participating, `2` authenticated, `6` not performed, `7` authenticated for the initial MIT. The REST 1.0 page says a declined or errored 3DS payment has a negative `eci` and no `cavv`.

#### 4.9 Withdrawal error codes (Withdrawal Guide, "Withdrawal Error Codes"): 82 codes

Returned by the Withdrawal API (not by REST 1.0 `/payout`). The documented reason is an upper-case token prefixed with `ERROR` (one, `10082`, is `ERR_CODE_BANK_ACCOUNT_NEEDED`).

| Code    | Meaning (paraphrase)                                               | Category                   | Retry class              |
| ------- | ------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `9000`  | Request checksum invalid                                           | configuration              | do_not_retry             |
| `10004` | Merchant site not found                                            | configuration              | do_not_retry             |
| `10005` | Withdrawal request belongs to another merchant                     | invalid_request            | do_not_retry             |
| `10009` | Amount invalid                                                     | invalid_amount             | do_not_retry             |
| `10011` | Order amount not positive                                          | invalid_amount             | do_not_retry             |
| `10014` | Country code invalid                                               | invalid_request            | do_not_retry             |
| `10019` | User email invalid                                                 | invalid_request            | customer_action_required |
| `10020` | Merchant ID incorrect                                              | configuration              | do_not_retry             |
| `10021` | Merchant site ID incorrect                                         | configuration              | do_not_retry             |
| `10022` | App ID invalid                                                     | configuration              | do_not_retry             |
| `10023` | Withdrawal request ID invalid                                      | invalid_request            | do_not_retry             |
| `10024` | Merchant withdrawal request ID invalid                             | invalid_request            | do_not_retry             |
| `10025` | userTokenId invalid                                                | invalid_request            | do_not_retry             |
| `10026` | User token not found                                               | invalid_request            | do_not_retry             |
| `10027` | Order does not belong to the request's site                        | invalid_request            | do_not_retry             |
| `10028` | User does not own the withdrawal request                           | invalid_request            | do_not_retry             |
| `10029` | Country not found                                                  | invalid_request            | do_not_retry             |
| `10030` | Currency mismatch between deposit and refund, or order and request | invalid_request            | do_not_retry             |
| `10031` | Sum is not partial                                                 | invalid_amount             | do_not_retry             |
| `10032` | Merchant site differs from the one in the request                  | invalid_request            | do_not_retry             |
| `10035` | Date invalid                                                       | invalid_request            | do_not_retry             |
| `10036` | First-result index invalid                                         | invalid_request            | do_not_retry             |
| `10037` | Max-results value invalid                                          | invalid_request            | do_not_retry             |
| `10038` | User payment option ID invalid                                     | invalid_request            | do_not_retry             |
| `10039` | Order ID invalid                                                   | invalid_request            | do_not_retry             |
| `10040` | User details invalid                                               | invalid_request            | customer_action_required |
| `10041` | Gateway related transaction ID invalid                             | invalid_request            | do_not_retry             |
| `10042` | Currency invalid                                                   | invalid_request            | do_not_retry             |
| `10043` | Payment name invalid                                               | invalid_request            | do_not_retry             |
| `10044` | Settlement type invalid                                            | invalid_request            | do_not_retry             |
| `10045` | Withdrawals disabled for the merchant site                         | configuration              | do_not_retry             |
| `10046` | Site does not belong to the merchant                               | configuration              | do_not_retry             |
| `10047` | Requested amount too big                                           | invalid_amount             | do_not_retry             |
| `10048` | Timestamp invalid                                                  | invalid_request            | do_not_retry             |
| `10049` | No merchant gateway ID                                             | configuration              | do_not_retry             |
| `10050` | APM property missing (described as invalid merchant or site ID)    | configuration              | do_not_retry             |
| `10051` | Date range invalid                                                 | invalid_request            | do_not_retry             |
| `10052` | Zip invalid                                                        | invalid_request            | customer_action_required |
| `10053` | Payment option disabled                                            | payment_method_unavailable | customer_action_required |
| `10054` | User not valid for this payment option                             | invalid_request            | do_not_retry             |
| `10055` | Payment method configuration invalid                               | configuration              | do_not_retry             |
| `10056` | First name too long                                                | invalid_request            | customer_action_required |
| `10057` | Last name too long                                                 | invalid_request            | customer_action_required |
| `10058` | Address too long                                                   | invalid_request            | customer_action_required |
| `10059` | Phone too long                                                     | invalid_request            | customer_action_required |
| `10060` | Zip too long                                                       | invalid_request            | customer_action_required |
| `10061` | City too long                                                      | invalid_request            | customer_action_required |
| `10062` | Email too long                                                     | invalid_request            | customer_action_required |
| `10063` | User ID too long                                                   | invalid_request            | do_not_retry             |
| `10064` | User balance value too long                                        | invalid_request            | do_not_retry             |
| `10065` | Refunds disabled                                                   | configuration              | do_not_retry             |
| `10066` | Only one refund allowed for this transaction                       | duplicate_request          | do_not_retry             |
| `10067` | Phone contains invalid symbols                                     | invalid_request            | customer_action_required |
| `10068` | State invalid                                                      | invalid_request            | do_not_retry             |
| `10069` | Status invalid                                                     | invalid_request            | do_not_retry             |
| `10070` | Merchant withdrawal request ID too long                            | invalid_request            | do_not_retry             |
| `10071` | Request comment too long                                           | invalid_request            | do_not_retry             |
| `10072` | Operator name too long                                             | invalid_request            | do_not_retry             |
| `10073` | Partial approval not allowed                                       | configuration              | do_not_retry             |
| `10074` | Refund not supported                                               | payment_method_unavailable | do_not_retry             |
| `10075` | Withdrawal not supported for this payment method                   | payment_method_unavailable | customer_action_required |
| `10076` | Payment option ID invalid                                          | invalid_request            | do_not_retry             |
| `10077` | Sort field invalid                                                 | invalid_request            | do_not_retry             |
| `10078` | Sort order invalid                                                 | invalid_request            | do_not_retry             |
| `10079` | Custom field too long                                              | invalid_request            | do_not_retry             |
| `10080` | Movement type invalid                                              | invalid_request            | do_not_retry             |
| `10081` | Order count invalid                                                | invalid_request            | do_not_retry             |
| `10082` | Bank account required                                              | invalid_request            | customer_action_required |
| `10083` | Payment method count invalid                                       | invalid_request            | do_not_retry             |
| `10084` | Net deposit amount invalid                                         | invalid_amount             | do_not_retry             |
| `10085` | Withdrawal order status invalid                                    | invalid_request            | do_not_retry             |
| `10086` | Order amount differs from request amount                           | invalid_amount             | do_not_retry             |
| `10087` | Batch ID invalid                                                   | invalid_request            | do_not_retry             |
| `10088` | Batch package ID invalid                                           | invalid_request            | do_not_retry             |
| `10089` | Withdrawal request already being processed                         | duplicate_request          | do_not_retry             |
| `10090` | Payment option was deleted                                         | payment_method_unavailable | customer_action_required |
| `10091` | Deposit was made with a different payment option                   | invalid_request            | do_not_retry             |
| `10092` | URL invalid                                                        | invalid_request            | do_not_retry             |
| `10093` | Payment option expired                                             | payment_method_unavailable | customer_action_required |
| `10094` | Merchant status invalid                                            | configuration              | do_not_retry             |
| `10095` | Merchant site status invalid                                       | configuration              | do_not_retry             |
| `10096` | Payment option status incorrect                                    | payment_method_unavailable | customer_action_required |

#### 4.10 Withdrawal general processing error codes: 29 codes

| Code    | Meaning (paraphrase)                                                           | Category             | Retry class         |
| ------- | ------------------------------------------------------------------------------ | -------------------- | ------------------- |
| `20000` | Cannot approve: request is not PENDING                                         | invalid_request      | do_not_retry        |
| `20001` | Request is not APPROVED or SETTLED                                             | invalid_request      | do_not_retry        |
| `20002` | Request must be IN_PROGRESS (or ERROR) for this operation, for example sealing | invalid_request      | do_not_retry        |
| `20003` | Request already approved                                                       | duplicate_request    | do_not_retry        |
| `20008` | General error approving the request                                            | unknown              | manual_review       |
| `20009` | General error cancelling; request holds orders that cannot be deleted          | unknown              | manual_review       |
| `20011` | General error declining; request holds orders that cannot be deleted           | unknown              | manual_review       |
| `20013` | Order already deleted                                                          | duplicate_request    | do_not_retry        |
| `20014` | Order not PENDING                                                              | invalid_request      | do_not_retry        |
| `20015` | Order not APPROVED (needed for settle, payout and similar)                     | invalid_request      | do_not_retry        |
| `20016` | Seal failed: request has no orders                                             | invalid_request      | do_not_retry        |
| `20018` | Withdrawal request not found for the ID                                        | invalid_request      | do_not_retry        |
| `20019` | merchantId does not exist                                                      | configuration        | do_not_retry        |
| `20020` | General error deleting an order                                                | unknown              | manual_review       |
| `20021` | General error getting payment methods                                          | provider_unavailable | retry_conditionally |
| `20022` | Refund candidates could not be retrieved                                       | unknown              | manual_review       |
| `20023` | General error submitting or getting requests                                   | unknown              | manual_review       |
| `20024` | General error placing an order                                                 | unknown              | manual_review       |
| `20025` | Seal error, for example full amount approved with partial approval disallowed  | unknown              | manual_review       |
| `20026` | General error settling an order                                                | unknown              | manual_review       |
| `20027` | Submit request error                                                           | unknown              | manual_review       |
| `20028` | Getting refund candidates disabled for the site                                | configuration        | do_not_retry        |
| `20029` | Refund transaction with the given ID not found                                 | invalid_request      | do_not_retry        |
| `20030` | General error getting net deposits                                             | unknown              | manual_review       |
| `20031` | General error updating net deposit value                                       | unknown              | manual_review       |
| `20032` | General error updating order status externally                                 | unknown              | manual_review       |
| `20033` | Withdrawal amount below the configured fee                                     | invalid_amount       | do_not_retry        |
| `20034` | General error for batch methods                                                | unknown              | manual_review       |
| `20035` | Order details empty in updateOrderDetails                                      | invalid_request      | do_not_retry        |

#### 4.11 Count summary

| Table                                          | Values                              |
| ---------------------------------------------- | ----------------------------------- |
| 4.1 `errCode` (request side)                   | 175                                 |
| 4.2 marketplace `errCode`                      | 12                                  |
| 4.3 gateway response code rows                 | 9                                   |
| 4.4 `gwExtendedErrorCode` filter codes         | 234 distinct (238 rows)             |
| 4.5 `gwErrorReason` strings                    | 180 (170 listed + 10 appendix-only) |
| 4.6 `threeDReasonId`                           | 34                                  |
| 4.7 `merchantAdviceCode`                       | 16                                  |
| 4.9 withdrawal error codes                     | 82                                  |
| 4.10 withdrawal general processing codes       | 29                                  |
| **Total**                                      | **771**                             |
| Not counted: SDK-only `errCode` names (4.1)    | 29                                  |
| Not counted: CVV2 / AVS / ECI value sets (4.8) | 5 / 10 / 7                          |

### 5. Lifecycle

Card, APM, payout (withdrawal), subscription and dispute flows are documented separately and should stay separate in the adapter.

#### 5.1 Card payments (REST 1.0)

- **Session**: `/getSessionToken` (REST) or `/openOrder` (Web SDK) returns `sessionToken`. `/getPaymentStatus` works only within the same session.
- **3DS initialisation**: `/initPayment` returns `transactionStatus=APPROVED` and `paymentOption.card.threeD.v2supported` `true` / `false`. Its `transactionId` is passed as `relatedTransactionId` in the next `/payment`.
- **Payment**: `/payment` with `transactionType` `Sale` (one step), `Auth` (hold, later settled) or `PreAuth` (larger or longer hold; expires after 7 to 31 days depending on issuer and industry). Response `transactionStatus`:
  - `REDIRECT`: 3DS challenge needed (response `transactionType` `Auth3D` in the example) or APM redirect.
  - `APPROVED`: frictionless or exempted payment done.
  - `DECLINED`: issuer declined; if `threeD.flow` is `softDecline`, a new `/initPayment` with `relatedTransactionId` may follow.
  - `ERROR`: error, including failed 3DS.
- **After the challenge**: a second `/payment` with `relatedTransactionId` = the first `/payment` `transactionId` (liability shift).
- **Settle**: `/settleTransaction` with `relatedTransactionId` = the `Auth` `transactionId`. Full or partial; several partial settles may add up to the authorised amount; multi-settle with `totalSettleCount` only for US `merchantId` with a TSYS acquirer (not Amex). Auto-settle can be configured (`autoSettleMode` in DMNs: `TIME`, `RISK`, `RISK-TIME`).
- **Void**: `/voidTransaction` with `relatedTransactionId` (+ `authCode`). Possible only in a short window before transmission ("in the best-case scenario ... up to 24 hours"). Voiding an OCT (payout credit) is not allowed (Mastercard MoneySend). The void example response has `transactionType` `VoidCredit`.
- **Refund**: `/refundTransaction` with `relatedTransactionId` of a settled transaction; the sum of partial refunds cannot exceed the sale. Response `transactionType` is `Credit`. Unreferenced refunds (full card, UPO or network token, no `relatedTransactionId`) need account configuration. FAQ: refunds and payouts are limited to 100 percent of deposits of the past 7 days by default (error "Credit amount exceeds total charges", filter `1106`).
- **Chargeback**: not a REST response. Documented sources: Control Panel event DMN (`EventType` `Chargeback`, section 6.5) and, on request, payment DMN `transactionType=Chargeback`. Filter codes `1111` ("This Transaction was charged back") and `3008` refer to it.

Documented `transactionType` vocabularies (they differ, see section 10): REST responses `Sale`, `Auth`, `Auth3D`, `Settle`, `Credit`, `VoidCredit`; `/getTransactionDetails` `auth`, `sale`, `payout`, `refund`, `settle`, `void`, `auth3D`, `sale3D`; payment DMN `Sale`, `Auth`, `Credit`, `Void`, `Chargeback`, `Modification`; FAQ `initAuth3D`, `Auth3D` (non-financial 3DS steps); Java SDK enum `Sale`, `Auth`, `Auth3D`, `Credit`, `Void`, `Sale3D`, `Settle`, `Refund`, `RiskOnly`, `PreAuth`.

Partial approval: `partialApproval` (`requestedAmount`, `processedAmount` ...) in REST; in DMNs `isPartialApproval`, `requestedAmount`, `partialApprovalStatus` (`PENDING`, `APPROVED`, `CANCELLED`, `AUTO_VOID`).

#### 5.2 APM payments

- `ppp_status` `PENDING` with `Status` `PENDING` while the APM works; later an "additional DMN containing the same transaction data as the previous DMN and the final `Status`" (`APPROVED` or `DECLINED`). Delays range from seconds to days.
- `UPDATE`: status update, only for certain North American bank-transfer APMs. `representmentInformation` (next collection date) also exists only for some North American APMs.
- If the customer abandons the APM step, the transaction stays `PENDING` and no further DMN is sent.
- APM refunds: synchronous ones return `transactionStatus`; asynchronous ones return `status=PENDING` and the result arrives by DMN.
- APM recurring payments use `subMethod`; details are on pages not read (**NOT DOCUMENTED** here).

#### 5.3 Payouts and withdrawals

Two documented mechanisms:

1. **REST `/payout`** (no link to a previous transaction; needs account configuration): `transactionStatus` `APPROVED`, `DECLINED`, `ERROR`; `/getPayoutStatus` by `clientRequestId`. Card payouts are OCTs (Visa Direct / MoneySend codes `1267`, `1295`, `1296`, `10025`). APM payouts need a UPO (`/addUPOAPM` or `/accountCapture`).
2. **Withdrawal API / Cashier withdrawal** with request and order objects:
   - `wdRequestState`: `Open`, `In Progress`, `Closed`.
   - `wdRequestStatus`: `Pending`, `Approved`, `Declined`, `Canceled`, `Partially Approved` (scenario table: `Partial`), `Error`, `In Progress`.
   - `wdOrderStatus`: `Pending`, `Approved`, `Settling`, `SettlingPending`, `Settled`, `Deleted`, `Error`; the scenario table also shows `Settling externally` and `Settled externally`.
   - `settlementType`: `Withdrawal` or `Refund`.
   - Modes: Single Message Mode (SMS) and Double Message Mode (DMS). The merchant answers the first DMN with `Approve`, `Decline` or `Postpone`.

#### 5.4 Subscriptions (Nuvei Rebilling Service)

- DMN `dmnType` `subscription` or `subscriptionPayment` after a successful initial or recurring payment; the example shows `subscriptionState` `ACTIVE`.
- Failed recurring payment: a "Retry Subscription Payment" DMN, then retries 72 hours apart (three retries, 216 hours after the first decline); after the last failure the subscription becomes `Inactive` and a "Retry Subscription Cancelled" DMN is sent. The field values that identify these two DMN kinds are **NOT DOCUMENTED** on the page read.
- `/cancelSubscription` exists; its response is **NOT DOCUMENTED** here.

#### 5.5 Disputes

Control Panel event DMN `Chargeback`: `Chargeback.Type` `Chargeback` or `Retrieval`; `ChargebackStatusCategory` `Regular`, `cancelled`, `Duplicate`, `RDR-Refund`, `Soft_CB`; `Chargeback.Status` free text (example "First Chargeback is closed in card holder favour"); `DisputeUnifiedStatusCode` (example `FC-CLSD-CHF`; the full list is **NOT DOCUMENTED** on the page read); `ChargebackReason` scheme reason code with text (example `10.4 - Other Fraud-Card Absent Environment`); `ChargebackReasonCategory` (example `Fraud`). Related events: `Pre-Chargeback Alert` (Ethoca; `Decision`, `Refunded`, `RefundTransactionId`), `Ethoca External Alert`, `RDR External Alert` (`RDREvent.Status` `Accepted` / `Declined`), `Fraud reported Transaction` (`Report.FraudType`, `IsChargeback`).

#### 5.6 Authorized, captured and settled

- **Authorized**: `transactionType=Auth` with `transactionStatus=APPROVED`.
- **Captured / settled (Nuvei term "Settle")**: `/settleTransaction` APPROVED, or `Sale` APPROVED (one step). Settlement to the merchant's bank account is **NOT DOCUMENTED** as a payload state; the Instant Settlement event DMN reports an "instant settlement transaction" with `Result` `approved` / `declined` / `error`.
- **Voided**: void APPROVED; `/getTransactionDetails` has `isVoided`.
- **Refunded**: refund (`Credit`) APPROVED; `/getTransactionDetails` has `credited`.
- **Manually corrected**: event DMN `Manual Correction` with `Details.FromResult` / `ToResult` (example "Sale: Declined -> Approved" in the docs' own notation). A timeline must allow a status to change after the fact.

### 6. Notifications (DMNs)

#### 6.1 Delivery, acknowledgement and retries

- **Transport**: HTTPS GET (query string, empty body) or HTTPS POST (name-value pairs in the body); switching needs the Integration Team. Nuvei recommends POST because DMNs can exceed 2000 characters.
- **Acknowledgement**: HTTP `200 OK`. Then the notification is recorded as Processed/Sent.
- **Retries**: on failure the notification is "In Retry" and is resent for 24 hours (webhooks page); the FAQ specifies every 15 minutes for 24 hours, 96 times in total, then Failed.
- **Synchronous vs asynchronous** (FAQ): deposit DMNs are asynchronous; pre-deposit DMNs and the initial withdrawal DMN are synchronous because Nuvei waits for the merchant's decision. Pre-deposit DMNs are not re-sent; no answer means the deposit is declined.
- **Ordering**: **NOT DOCUMENTED**. APM flows produce a `PENDING` DMN and a later final DMN; retries can deliver an older DMN after a newer one.
- **Source IPs** (same list on all DMN pages): `31.207.2.1-31.207.3.254`, `52.16.211.57`, `52.17.110.204`, `87.120.10.1-87.120.10.254`, `87.120.11.1-87.120.11.254`, `91.220.189.1-91.220.189.254`, `149.170.56.1-149.170.57.254`, `194.247.167.1-194.247.167.254`, `195.28.166.1-195.28.167.254`.
- **Configurable content**: customer details can be removed at onboarding; `transactionType` is "available only upon request"; `finalFraudDecision` and related fields need configuration.

#### 6.2 DMN kinds and event types

| Kind                    | How it is recognized                                                                                                                                                              | Event / type values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment DMN             | name-value pairs with `ppp_status`, `PPP_TransactionID`, `Status`, `advanceResponseChecksum`                                                                                      | `type`: `DEPOSIT`, `WITHDRAWAL`, `KYC`, `DOCUP` (KYC and DOCUP only for KYC merchants); `transactionType`: `Sale`, `Auth`, `Credit`, `Void`, `Chargeback`, `Modification`; `Status`: `APPROVED`, `SUCCESS`, `DECLINED`, `ERROR`, `PENDING`, `UPDATE`                                                                                                                                                                                                                                                                                            |
| Pre-deposit DMN         | Same set without `ppp_status` and without financial and 3DS fields; sent to a separate URL; PayPal is the supported method                                                        | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Withdrawal DMN          | `wdRequestId`, `notificationType`, `wdRequestState`, `wdRequestStatus`, `checksum`                                                                                                | `notificationType`: only `WITHDRAW_REQUEST_NOTIFICATION` appears (checksum example); the value for order notifications is **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                                                                                                                                    |
| Subscription DMN        | `dmnType`, `subscriptionId`, `subscriptionState`, `planId`, `responsechecksum`                                                                                                    | `dmnType`: `subscription`, `subscriptionPayment`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Control Panel event DMN | JSON with `EventId`, `EventDate`, `EventType`, `ProcessingEntityType`, `ProcessingEntityId`, `AttemptNumber`, plus `ClientId`, `ClientName`, `EventDateUTC`, `EventCorrelationId` | `EventType`: `Pre-Chargeback Alert`, `Chargeback`, `PayFac Submerchant Creation`, `Manual Correction`, `Control Panel Generated Transaction`, `Manual Inserted`, `Fraud reported Transaction`, `Ethoca External Alert`, `RDR External Alert`, `Dispute API Callback`, `Dispute API Image Callback`, `Instant Settlement`, `Terminal Created or Updated`, `PayFac Sub-merchant Created or Updated`, `Error on Creating Terminal`, `Error on Creating PayFac Sub-Merchant`, `Error on Updating Terminal`, `Error on Updating PayFac Sub-Merchant` |
| KYC DMN                 | page not read                                                                                                                                                                     | **NOT DOCUMENTED** here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### 6.3 Payment DMN fields (selection)

The payment DMN table has over 100 parameters; "All parameters are case-sensitive". Fields an adapter needs first:

| Field                                                                                                     | Meaning                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ppp_status`                                                                                              | `OK` approved, `PENDING` (APM only), `FAIL` declined or error                                                |
| `Status`                                                                                                  | Gateway status (values above). If no financial transaction happened: `ppp_status=FAIL` and `Status=DECLINED` |
| `PPP_TransactionID`                                                                                       | 64-bit ID of the payment page transaction                                                                    |
| `TransactionID`                                                                                           | 64-bit gateway transaction ID; empty when no financial transaction happened                                  |
| `ErrCode`, `ExErrCode`                                                                                    | Generic and specific error codes; `0` on success                                                             |
| `Reason`, `ReasonCode`                                                                                    | Gateway reason text and code on failure; `N/A` "if it is not a regular transaction"                          |
| `errApmCode`, `errApmDescription`, `errScCode`, `errScDescription`                                        | APM error from the APM and from Nuvei                                                                        |
| `message`                                                                                                 | Nuvei message (examples: `PENDING`, `APPROVED`)                                                              |
| `totalAmount`, `currency`, `convertedAmount`, `convertedCurrency`                                         | Amounts (original before conversion)                                                                         |
| `transactionType`, `type`, `payment_method`                                                               | Operation, notification kind, method (`cc_card`, `ppp_ApplePay`, `ppp_GooglePay`, `apmgw_*`)                 |
| `clientUniqueId`, `merchant_unique_id`, `clientRequestId`, `relatedTransactionId`                         | Correlation (section 7)                                                                                      |
| `responseTimeStamp`                                                                                       | Gateway response time `YYYY-MM-DD.HH:MM:SS`; the checksum section says it is GMT                             |
| `AuthCode`, `AvsCode`, `Cvv2Reply`, `eci`, `3Dreason`, `3DReasonId`, `threeDReason`, `merchantAdviceCode` | Decline detail                                                                                               |
| `finalFraudDecision`, `systemDecision`, `rules`                                                           | Risk outcome (`Accept` / `Reject`; `None`, `Accept`, `Reject`, `Review`, `Error`)                            |
| `advanceResponseChecksum`, `responseChecksum`                                                             | Signature (6.4)                                                                                              |

Payment Page redirect parameters (output-parameters page) repeat most of these names in lower or mixed case (`status`, `errCode`, `exErrCode`, `reason`, `reasonCode`, `transactionId`, `ppp_TransactionId`, `responsechecksum`, `advanceResponseChecksum`, `instantDmnStatus`, `error`). They reach the browser and must not be trusted as the final state.

#### 6.4 Signature fields (sensitive; PandaPayLens does not verify them)

- **Payment and pre-deposit DMN** `advanceResponseChecksum`: hash of `merchantSecretKey` + `totalAmount` + `currency` + `responseTimeStamp` + `PPP_TransactionID` + `Status` + `productId` (secret first, `+` replaced by spaces), SHA-256 (64 hex) or MD5 (32 hex) depending on the site configuration. `responseChecksum` is deprecated.
- **Subscription DMN** `responsechecksum`: all values in the order sent, secret appended at the end, SHA-256 or MD5.
- **Withdrawal DMN** `checksum`: all `name=value` pairs in the order sent, secret at the end, SHA-256.
- **Control Panel event DMN** `checksum` header: secret first, then the JSON payload, SHA-256 (the text says "values", the worked example concatenates the whole JSON text; see section 10).
- **REST requests** `checksum`: SHA-256 over fixed field lists ending in `timeStamp` and `merchantSecretKey` (for example settle, refund and void: `merchantId`, `merchantSiteId`, `clientRequestId`, `clientUniqueId`, `amount`, `currency`, `relatedTransactionId`, `authCode`, `comment`, `urlDetails`, `timeStamp`, `merchantSecretKey`).
- PandaPayLens should redact these values, may report "checksum present (64 hex / 32 hex)", and must never ask for the merchant secret key.

#### 6.5 Event DMN fields (chargeback-related)

`Chargeback.Date`, `Type`, `Status`, `ChargebackStatusCategory`, `Amount`, `Currency`, `ReportedAmount`, `ReportedCurrency`, `ISOCurrency`, `ChargebackReason`, `ReasonMessage`, `DisputeDueDate`, `ChargebackReasonCategory`, `DisputeId`, `DisputeEventId`, `DisputeUnifiedStatusCode`; `TransactionDetails.TransactionId` (original Nuvei transaction), `TransactionDate`, `ClientUniqueId`, `AcquirerName`, `MaskedCardNumber`, `Arn`.

#### 6.6 Duplicate identification

- **Payment DMNs** have **no event or delivery ID**. Duplicates are expected from the 96 retries and from APM status updates. Suggested dedupe key: `TransactionID` (or `PPP_TransactionID` when `TransactionID` is empty) + `Status` + `ppp_status` + `transactionType` + `responseTimeStamp`. Whether `responseTimeStamp` stays the same across retries is **NOT DOCUMENTED**.
- **Event DMNs** have `EventId` (GUID), `EventCorrelationId` ("Notification unique ID") and `AttemptNumber` ("Is 1 the first time"). `AttemptNumber > 1` marks a redelivery; `EventId` / `EventCorrelationId` should be the dedupe key.
- **Withdrawal DMNs**: no delivery ID; `wdRequestId` / `wdOrderId` + status fields.
- **REST requests**: `clientRequestId` is used for idempotency "based on the merchant configuration"; a reused value gives `errCode` 1089.

### 7. Identifiers

| Field                                                                                                                                       | Scope                                                                             | Notes                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transactionId` (REST), `TransactionID` (DMN), `TransactionId` (event DMN)                                                                  | Gateway transaction                                                               | Each operation gets its **own** ID: settle, refund and void outputs describe `transactionId` as the ID "of the settle / refund / void transaction for future actions". Examples are numeric strings of 10 to 19 digits (`1110000000010304183`)         |
| `relatedTransactionId`                                                                                                                      | Parent link                                                                       | Sent in settle, refund, void, `/payment` after `/initPayment` or a challenge. Returned by `/getTransactionDetails` ("The ID of the original transaction") and in DMNs "if it was required for processing". **Not** in settle / refund / void responses |
| `TransactionDetails.RelatedTransactionId`                                                                                                   | Parent link in event DMNs                                                         | Control Panel generated / manually inserted transactions                                                                                                                                                                                               |
| `clientUniqueId`                                                                                                                            | Merchant's transaction ID (String length 45 to 255 depending on the method table) | Required for settle. "It appears in a DMN as the `merchant_unique_id` parameter"; the DMN example carries both with the same value. `/getTransactionDetails` returns only the most recent transaction when several share it                            |
| `clientRequestId`                                                                                                                           | Merchant's request ID                                                             | Idempotency when configured; `/getPayoutStatus` looks up by it                                                                                                                                                                                         |
| `orderId`                                                                                                                                   | Nuvei order                                                                       | Returned by `/payment` and `/openOrder`                                                                                                                                                                                                                |
| `PPP_TransactionID` / `ppp_TransactionId`                                                                                                   | Payment page transaction                                                          | 64-bit                                                                                                                                                                                                                                                 |
| `internalRequestId`                                                                                                                         | Nuvei request                                                                     | For reconciliation; one per API call                                                                                                                                                                                                                   |
| `sessionToken`                                                                                                                              | Session                                                                           | Links `/getSessionToken`, `/payment`, `/getPaymentStatus`                                                                                                                                                                                              |
| `authCode` / `AuthCode`                                                                                                                     | Issuer authorization code                                                         | Sent with settle and void                                                                                                                                                                                                                              |
| `externalTransactionId`, `APMReferenceID`, `additionalTransactionBankId`, `orderTransactionId`, `ExternalaccountId`                         | APM / external                                                                    | `orderTransactionId` is generated by PlayTech's cashier                                                                                                                                                                                                |
| `transactionLinkId`                                                                                                                         | Scheme link                                                                       | "Generated by Mastercard", links related transaction events                                                                                                                                                                                            |
| `userTokenId` / `user_token_id`, `userPaymentOptionId` (UPO), `uniqueCC`                                                                    | Customer and stored payment method                                                | Link deposits, payouts and refunds of the same customer                                                                                                                                                                                                |
| `wdRequestId`, `wdOrderId`, `merchantWDRequestId`, `merchantWDOrderId`, `gwTrxId`, `gwRelatedTransactionId`, `apmTrxId`, `merchantUniqueId` | Withdrawal                                                                        | `gwRelatedTransactionId` is "the Gateway transaction ID of the transaction to be refunded"                                                                                                                                                             |
| `subscriptionId`, `planId`, `templateId`                                                                                                    | Rebilling                                                                         |                                                                                                                                                                                                                                                        |
| `EventId`, `EventCorrelationId`, `DisputeId`, `DisputeEventId`, `Arn` / `ARN`, `EthocaId`, `RDREvent.CaseId`                                | Events and disputes                                                               |                                                                                                                                                                                                                                                        |
| `merchantId` / `merchant_id`, `merchantSiteId` / `merchant_site_id`, `ClientId`                                                             | Merchant account                                                                  | Mask in output                                                                                                                                                                                                                                         |

### 8. Sensitive fields

Redact or mask by default (request fields included because request / response pairs get pasted):

- **Card data**: `cardNumber` (full PAN in requests, masked in DMNs), `CVV`, `expirationMonth` / `expirationYear`, `expMonth` / `expYear`, `ccExpMonth` / `ccExpYear`, `cardHolderName`, `nameOnCard`, `bin` together with `last4Digits` / `ccCardNumber`, `MaskedCardNumber`, `MaskedCreditCard`, `CreditCardBin`, `uniqueCC`, `PAR` / `paymentAccountReference`, `networkTokenNumber`, `networkTokenCryptogram`, `Token`, `tokenId`.
- **3DS**: `cavv`, `cReq`, `acsUrl` (embeds a base64 session), `acsTransId`, `dsTransID`, `serverTransId`.
- **Signatures and secrets**: `checksum`, `advanceResponseChecksum`, `responseChecksum` / `responsechecksum`, the event DMN `checksum` header, `merchantSecretKey` (never), `sessionToken`.
- **Personal data**: `first_name`, `last_name`, `firstName`, `lastName`, `email`, `externalEmail`, `address1`, `address2`, `address`, `city`, `state`, `zip`, `country`, `phone1`-`phone3`, all `shipping*` fields, `client_ip` / `ipAddress`, `dateOfBirth` / `birthdate`, `identification`, `personal_id` (CPF in the PIX example), `pix_key`, `apmPayerInfo`, `externalAccountDescription`, `ExternalaccountId`, `recipientFirstName`, `recipientLastName`, `ID` ("Hebrew ID"), `user_token_id` / `userTokenId`, `userid`, `customFieldX`, `customData`.
- **Bank data**: IBAN, routing and account numbers in `apmData` / withdrawal payloads.
- **Dispute data**: `ARN` / `Arn`, `EthocaId`, `TransactionDetails.Email`, `AuthCode`.
- **Merchant identifiers**: `merchantId`, `merchant_id`, `merchantSiteId`, `merchant_site_id`, `merchantGwId`, `ClientId`, `ClientName`, `notificationUrl`.

### 9. Structural detection hints

Strong Nuvei signals (combine several):

1. **REST 1.0 JSON**: `internalRequestId` (integer) + `status` in {`SUCCESS`, `ERROR`} + `errCode` (integer) + `reason` + `merchantId` + `merchantSiteId` + `version` (`"1.0"` or `"1"`). Payment-type responses add `transactionStatus` in {`APPROVED`, `DECLINED`, `ERROR`, `REDIRECT`} + `gwErrorCode` + `gwExtendedErrorCode` (often + `gwErrorReason`, `paymentMethodErrorCode`, `paymentMethodErrorReason`). The pair `gwErrorCode` + `gwExtendedErrorCode` is the most distinctive marker.
2. **Masked card shape** `ccCardNumber` like `4****2535` (first digit, four asterisks, last four) with separate `bin` and `last4Digits`.
3. **Payment DMN**: name-value pairs with `ppp_status` in {`OK`, `FAIL`, `PENDING`} + `PPP_TransactionID` (any casing) + `Status` + `ErrCode` + `ExErrCode` + `advanceResponseChecksum` (64 or 32 hex), usually `responseTimeStamp` in `YYYY-MM-DD.HH:MM:SS`, `merchant_site_id`, `merchant_unique_id`, `customField1`-`customField15`, `item_name_1`. Any two of `ppp_status`, `PPP_TransactionID`, `advanceResponseChecksum` are decisive.
4. **Payment method values**: `cc_card`, `ppp_ApplePay`, `ppp_GooglePay`, `apmgw_*` (for example `apmgw_expresscheckout`, `apmgw_MoneyBookers`, `apmgw_PIX`).
5. **Withdrawal DMN**: `wdRequestId`, `wdRequestState`, `wdRequestStatus`, `wdOrderStatus`, `notificationType=WITHDRAW_REQUEST_NOTIFICATION`, `userPMId`, `pmDisplayName`.
6. **Event DMN JSON**: `EventType` (values in 6.2) with `EventCorrelationId`, `ClientId`, `ProcessingEntityType` in {`client`, `multiClient`}, `AttemptNumber`, and PascalCase blocks `Chargeback`, `Alert`, `TransactionDetails`, `RDREvent`, `Correction`.
7. **Hosts and paths**: `ppp-test.nuvei.com`, `secure.safecharge.com`, `ppp-test.safecharge.com`, `3dsn.sandbox.nuvei.com`; paths `/ppp/api/v1/<method>.do`, `/ppp/purchase.do`, `/ppp/withdrawal/withdraw.do`.
8. **Code shapes**: `errCode` 1000-1140, 2006, 9064-9197; `gwErrorCode` `-1`, `-1100`, `-1001`, `-1005`, `-1203`; four- and five-digit `gwExtendedErrorCode`, plus `101778`.

How this differs from supported providers:

- **Stripe**: JSON with `object` and prefixed IDs (`pi_`, `ch_`, `evt_`), dotted event `type`. Nuvei IDs are bare numerals and there is no `object` key.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in Nuvei payloads.
- **payabl.**: URL-encoded `transactionid` / `transid`, `errormessage` / `errmsg`, `security`. Nuvei DMNs are also URL-encoded but use `TransactionID`, `ppp_status`, `ErrCode`, `advanceResponseChecksum`; Nuvei REST is JSON.
- **Checkout.com, PayPal, Braintree, Mollie, Square**: their JSON envelopes and webhook keys (described in their own research files) do not include `gwErrorCode`, `internalRequestId` or `ppp_status`.
- **NMI**: query string with lowercase `response`, `responsetext`, `transactionid`, `response_code` (nmi research file). Nuvei never uses `responsetext` and spells `TransactionID` / `transactionId`.
- **Skrill**: a Skrill payment made through Nuvei arrives as a Nuvei DMN with `payment_method=apmgw_MoneyBookers`; it belongs to the Nuvei adapter. A direct Skrill `status_url` post uses Skrill's own fields (`mb_transaction_id`, `md5sig`, per the skrill research file). Both formats can contain `merchant_id`, so `merchant_id` alone must not decide.
- **MiFinity**: `transactionStatus` is numeric there; in Nuvei it is an upper-case word.
- **PXP**: uses `transactionStatus` for a 3DS letter inside authentication data and `transactionStatusReason`; Nuvei's `transactionStatus` is a payment state next to `gwErrorCode`.
- **Paymentwall**: Brick errors use `code` in a 1000-5000 range with `type: "Error"`; Nuvei uses `errCode` with `status: "ERROR"`.
- **Nuvei REST 2.0 (beta)**: lowercase `result.status`, `merchantTransactionId`, `processingEntityId`, `authorizingEntityId`, `version: "2.0"`, dotted codes like `1000.1016`. Detect it separately; it is not REST 1.0.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Overlapping numeric code spaces**: `errCode` 1001 (invalid checksum) vs filter 1001 (invalid expiration date) and many similar pairs; withdrawal codes 10014-10075 vs filter codes 10025-10075. Decoding must be keyed by field and API.
2. **Duplicate codes with different meanings** in the filter table: `1158` (3D PaRes / PayPal already registered), `1159` (state ISO / different payer email), `1160` (bank code checksum / single account validation), `1167` (already settled / missing external MPI parameters). Near-identical rows: `10036` = `10047`, `10052` = `10056`, `10053` = `10057`, and `10073` repeats the first meaning of `1159`.
3. **`APPROVED` and `PENDING` share `gwErrorCode=0` / `gwExtendedErrorCode=0`**, so the status field, not the codes, decides.
4. **Generic vs specific error code naming conflicts**: REST tables say `gwExtendedErrorCode` is "the code of the generic error"; `/getPaymentStatus` says `gwErrorCode` is "the code of the specific error"; DMN `ExErrCode` is "the specific error" and `ErrCode` "the generic error". The decline-reason sentence uses `errCode` / `exErrCode` where it means the gateway pair, and the gateway table heading mixes `gwErrCode` / `gwExtendedErrCode` with `gwErrorCode` / `gwExtendedErrorCode`.
5. **Field casing**: `PPP_TransactionID` (table), `PPP_TransactionId` (example), `ppp_TransactionID` (checksum section and GET example), `ppp_TransactionId` (Payment Page outputs); `responseChecksum` vs `responsechecksum`; `externalAccountId` vs `ExternalaccountId` vs `ExternalaccountID`; `TransactionID` vs `TransactionId`; `Arn` vs `ARN`. The DMN page also says "All parameters are case-sensitive". A parser should match these names case-insensitively and keep the original.
6. **Response shape differs between pages**: the API reference nests card fields under `paymentOption.card` (`cvv2Reply`, `avsCode`); the settle, void and refund feature pages show flat responses (`bin`, `ccCardNumber`, `CVV2Reply`, `AVSCode` at top level, plus `issuerDeclineCode`, `issuerDeclineReason`, `v2supported`, `threeDresult`, `dsTransID`). Refund and void examples use `errReason` where the output tables say `reason`. The payout example has `cardData.visaDirect`, not in the output table.
7. **Invalid example JSON**: the REST 1.0 `REDIRECT` example lacks a comma after `transactionLinkId`; the `/getPaymentStatus` example lacks a closing brace; event DMN examples have missing commas, curly quotes, duplicated keys (`Refunded`, `Decision`, `AlertAge`), misspelled keys (`TelatedTransactionId`, `TransctionDetails`, `TansactionDate`, `RefundTransactonID`) and a key with no colon (`"TransactionDate "2025-12-14T21:48:21.437Z"`). A tolerant parser should not depend on those spellings.
8. **Truncated DMN examples**: the payment DMN examples are wrapped in `...'` and `',`; the refund DMN examples stop in the middle of a field name; the "Full Card Details" refund DMN example is empty.
9. **Checksum examples**: the payment DMN example lists `responseTimeStamp: 2020-03-14.16:22:34` but the concatenated string uses `2020-11-13.13:22:34`. The event DMN text says to concatenate "parameter values" but the example concatenates the raw JSON text. These do not matter for PandaPayLens (no verification) but show that examples are not machine-checked.
10. **Different `transactionType` vocabularies and casing** (section 5.1); `transactionStatus` is `Approved` in the `/getTransactionDetails` example and upper case everywhere else.
11. **`Status=SUCCESS`** is listed for DMNs without a meaning. `ppp_status` is described as "Pending" in text but `PENDING` in examples.
12. **`REST 1.0` page** says declined or errored 3DS payments return "`errCode` and `errorDescription`"; `errorDescription` is the Web SDK field name, REST uses `reason`.
13. **Event DMN type mismatches**: `DisputeId` is documented as Number but the example is a base64 string; `MaskedCreditCard` is described both as first digit + last four and first six + last four; the chargeback category key is `StatusCategory` in one example and `ChargebackStatusCategory` in the other. `DisputeUnifiedStatusCode` values are not listed.
14. **`upoRegistrationDate`** is documented as `YYYMMDDHHmmss` while examples have 8 digits (`20200321`).
15. **Payment Page output** describes `merchant_site_id` as the transaction ID in the merchant's database, contradicting the DMN table (merchant customization ID).
16. **Withdrawal DMN** example exists only as a checksum string (with an artifact `nameOnCard=John Mike=Doe`); no raw DMN example. The order `notificationType` value is not shown.
17. **Configurable content**: customer details, `transactionType`, fraud fields and the GET/POST choice depend on account settings, so field presence is unreliable.
18. **Non-exhaustive lists**: decline reasons are "some possible" values; APM-side codes (`paymentMethodErrorCode`, `errApmCode`) are not listed at all; the Java SDK names 29 extra `errCode` values.
19. **Regional / product**: multi-settle is US-TSYS-only; OCT limits for Azerbaijan, Moldova and Ukraine (`1295`); Colombian domestic Visa in COP only (`10049`); card registration limited to EU/EEA cards in one flow (`9158`); IPv6 addresses are rejected (FAQ). REST 2.0 is beta and uses a different format.
20. **Not read**: the advanced API reference (withdrawal methods, rebilling, pre-chargeback), KYC DMNs, PayFac pages, `challengePreferenceReason` table. Anything from those is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | 771 first-party code values with clear stage separation (request `errCode`, gateway `gwErrorCode` / `gwExtendedErrorCode` / `gwErrorReason`, 3DS reason, MAC, withdrawal codes) and some retry advice from Nuvei. Overlapping numeric spaces are handled by keying on the field name; unknown values fall back to `unknown`. APM-side codes are not documented and stay unknown.                            |
| **paymentResponses** | **supported** | Every REST 1.0 method read has an output table and a JSON example with a stable core (`status`, `errCode`, `reason`, `transactionStatus`, `gwErrorCode`, `gwExtendedErrorCode`, `transactionId`). The flat vs nested card fields and `errReason` vs `reason` differences are easy to tolerate. No declined-response example exists, so tests must be built from the field tables.                           |
| **webhookParsing**   | **limited**   | Payment DMNs have a full parameter table, a checksum recipe and examples, and event DMNs have JSON examples. But: GET or POST delivery, inconsistent field casing, no event ID on payment DMNs, truncated or invalid examples, configurable field sets, and withdrawal / subscription DMN examples that are only checksum strings or PHP arrays.                                                            |
| **timeline**         | **limited**   | `transactionType` steps (`InitAuth3D`/`Auth3D`, `Auth`, `Settle`, `Credit`, `Void`), APM `PENDING` then final `Status`, `responseTimeStamp` (GMT) in DMNs and event timestamps support a timeline. REST responses carry no timestamp, ordering of DMNs is not documented, chargebacks arrive only through a separate event feed, and manual corrections can rewrite a past status.                          |
| **correlation**      | **limited**   | `relatedTransactionId` is an explicit parent link in requests, DMNs and `/getTransactionDetails`, and `clientUniqueId` / `merchant_unique_id` tie merchant references together. However settle, refund and void responses do not echo `relatedTransactionId`, each operation has its own `transactionId`, DMNs include the parent only "if it was required", and `clientUniqueId` is not guaranteed unique. |
