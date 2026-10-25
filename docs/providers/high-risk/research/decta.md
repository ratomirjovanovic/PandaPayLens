# DECTA (adapter id `decta`): high-risk provider research

Status: qualification gate and condensed technical specification for a parse-only PandaPayLens adapter. Everything below comes from DECTA's first-party sources as published on the verification date. Where DECTA is silent, the text says **NOT DOCUMENTED**. Nothing here is a guarantee about live behavior.

- Verification date: **2026-10-25**
- Method: pages fetched anonymously over HTTPS and read in full. No login, sign-up or access request was made. Note: `docs.decta.com` paths return HTTP 403 without a trailing slash and HTTP 200 with it (for example `/Useful-Information/response-codes/`).

---

## Gate summary

| Item                 | Answer                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate outcome         | **documentation_verified**                                                                                                                                                  |
| Classification       | `gateway`, `acquiring`, `card_processing`, `orchestration` (see below)                                                                                                      |
| Documentation access | Public: docs portal and full OpenAPI 3.0.3 YAML. Login needed only for API keys, webhook setup UI and plugin downloads                                                      |
| Documented codes     | 83 raw acquirer response codes, plus 5 Mastercard Merchant Advice Codes, 18 AVS values and 1 special gateway code (`-1`)                                                    |
| Biggest limitation   | No complete example of an order response or order webhook body, and v0.6 webhooks carry no signature; the event name travels in an HTTP header that developers rarely paste |

---

## 1. Qualification gate

| #   | Question                                       | Answer  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company or product currently active            | **yes** | Change History lists release "2.9 (October 2026)" adding Mastercard Transaction Link ID support (https://docs.decta.com/Useful-Information/change-history/). Website footer "© 2026" (https://www.decta.com/company/decta-documentation).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Relevant payment service operational           | **yes** | The live Swagger UI at https://gate.decta.com/api-docs/ serves `api_documentation.yaml` (`title: Decta Gate API`, `version: v0.6`). Security page names live domains `gate.decta.com` and `transactions.decta.com` and static webhook IPs (https://docs.decta.com/Useful-Information/security/).                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | Developer documentation publicly accessible    | **yes** | Public: the whole DECTA Gate documentation portal (https://docs.decta.com/) and the OpenAPI file (https://gate.decta.com/api-docs/api_documentation.yaml). The documentation index page says the DECTA Hub material is "all publicly accessible" (https://www.decta.com/company/decta-documentation). Behind merchant login: API key creation, webhook configuration UI and plugin downloads ("To generate your token, login into your DECTA Payments dashboard", OpenAPI intro; plugin link points to `gate.decta.com/merchants/en/merchant/api`).                                                                                                                                         |
| 4   | API families and versions identified           | **yes** | OpenAPI `openapi: 3.0.3`, `info.version: v0.6`, `servers: url: /api/v0.6`. Webhook schema: "Supports both new (v0.6) and legacy (v0.5) events. v0.5 webhooks are deprecated". `hmac_key` is reserved for "v1.0 Webhooks that is in the development phase". Documentation release numbering is separate (2.9, October 2026).                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | Responses/notifications examinable offline     | **yes** | Full JSON schemas for `Order`, `StatusChange`, `Charge`, `Webhook`; error object format; webhook HTTP example with headers (OpenAPI intro); transcribed 3DS and wallet responses (https://docs.decta.com/Integration/3ds-authentication/, https://docs.decta.com/Payments/payment-methods/). Caveat: no full order or `order.*` webhook body example (see §10).                                                                                                                                                                                                                                                                                                                             |
| 6   | Supported merchant sectors documented          | **yes** | See "Sectors" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | Regional or regulatory limitations identified  | **yes** | EMI licences: FCA 900592 (UK), Central Bank of Cyprus 115.1.3.54, Central Bank of Ireland C491504; SIA DECTA in Latvia (https://www.decta.com/documents/terms-and-conditions). Card markets and currency list, with "Transaction limits differ for each currency and market" (payment-methods page). Recurring fields "mandatory for cards issued in India"; "In case of 3DS terminals, EU cards will always be required to authenticate" (https://docs.decta.com/Payments/recurring-payment-scenarios/). SDWO payouts "available only for the IPSP partners" (payout page). Refunds only for payments "not older than two years"; reversals same day only (simple-payment-scenarios page). |
| 8   | Adapter would give diagnostic value            | **yes** | 83 raw acquirer codes with status classes and guidance (1xx/2xx contact issuer, 9xx contact DECTA support), order status model, 31 webhook event types, MAC, AVS, ECI comparison guidance (https://docs.decta.com/Useful-Information/response-codes/, https://docs.decta.com/Payments/after-the-payment/).                                                                                                                                                                                                                                                                                                                                                                                  |
| 9   | Own technical format, not a resold gateway     | **yes** | DECTA documents and hosts its own "Decta Gate API" under its own domains; no underlying third-party gateway is named anywhere in the docs or OpenAPI file. Caveat: DECTA itself sells a "White Label Payment Gateway" (https://www.decta.com/products/white-label-payment-gateway), and the docs use neutral placeholders (`gate.domain.com`, `transactions.gateway.com`, `payments.<gate_domain.com>`). A second documentation instance exists at https://docs.cy.decta.com/ (page title "DECTA Gate Documentation"). The same format can therefore appear under third-party brands and hosts.                                                                                             |
| 10  | No live credentials needed to analyze examples | **yes** | Schemas, examples and test scenarios are public. Sandbox use requires a dashboard key set, but analysis of documented payloads does not.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Classification

| Class             | Evidence                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`         | "Decta Gate API"; DECTA Gate hosted checkout, Payform JS SDK, Host2Host (`api_do_url`) integration options (https://docs.decta.com/Integration/integration-options/).                                                                                                                                                                        |
| `acquiring`       | "DECTA provides Acquiring services to Merchants and PSPs" and "DECTA is a Mastercard and Visa Principal Member" (https://www.decta.com/products/payment-acquiring).                                                                                                                                                                          |
| `card_processing` | "Certified 3rd party technical payment processor in the EU and APAC"; Acquirer Processing and Issuer Processing products; footer: "certified processor for Mastercard, Visa and UnionPay International" (decta.com pages above). The processor-facing SOAP/ISO8583 docs on https://hub.decta.com/ are out of scope for merchant diagnostics. |
| `orchestration`   | "DECTA Payment Orchestration is the centralized management capability built into your DECTA White Label Payment Gateway" (https://www.decta.com/solutions/payment-orchestration). A white-label gateway feature, not a separate merchant API.                                                                                                |

Not claimed: `wallet` (DECTA accepts Apple Pay/Google Pay and supports SDWO wallet funding/purchase, but does not operate a consumer wallet in these docs), `payment_facilitator` (only a "Partners" model for connected merchants is documented), `merchant_account_intermediary` (no evidence).

### Sectors (as documented by DECTA)

- Payment Acquiring FAQ: "DECTA provides Acquiring services to Merchants and PSPs from a wide range of industries, including Retail, Travel, Mobility, Money Services, eWallets, Licensed Forex, Licensed Gaming, Lending and others - in compliance with appropriate EU / UK licenses and Mastercard / Visa regulations." (https://www.decta.com/products/payment-acquiring)
- White Label Payment Gateway: industries listed as "Fintech, eCommerce, Mobility, Delivery, Travel" (https://www.decta.com/products/white-label-payment-gateway).
- Payout docs: "OG payouts are a solution for online gaming transactions." (https://docs.decta.com/Payments/payout-scenarios/)
- Onboarding asks for a "License copy if it is required for the industry you operate in" (payment-acquiring page).

Not documented by DECTA on the pages read: adult, nutraceuticals, crypto, dating, subscription-as-a-sector. Gaming and forex are stated only as "Licensed". Eligibility depends on jurisdiction, licensing and DECTA underwriting; listing a sector does not imply approval.

---

## 2. Sources (all read 2026-10-25)

| URL                                                                                            | What it covers                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://gate.decta.com/api-docs/ and `/api-docs/swagger-initializer.js`                        | Swagger UI; points to the spec file                                                                                                                            |
| https://gate.decta.com/api-docs/api_documentation.yaml                                         | **OpenAPI 3.0.3, Decta Gate API v0.6**: request/response format, error object, webhook format, `Order`, `StatusChange`, `Charge`, `Webhook` schemas, endpoints |
| https://docs.decta.com/                                                                        | Docs index                                                                                                                                                     |
| https://docs.decta.com/Useful-Information/response-codes/                                      | **Raw Acquirer Response Codes** (83), `-1` note                                                                                                                |
| https://docs.decta.com/Integration/webhooks/                                                   | **Webhook event types** (31), partner webhooks                                                                                                                 |
| https://docs.decta.com/Payments/general-payment-flow/                                          | Flow, response types, **order status table**                                                                                                                   |
| https://docs.decta.com/Payments/after-the-payment/                                             | Merchant Advice Codes, AVS, ECI, name validation                                                                                                               |
| https://docs.decta.com/Integration/3ds-authentication/                                         | 3DS options; manual 3DS JSON responses; timeout message                                                                                                        |
| https://docs.decta.com/Integration/integration-options/                                        | Full Page, Payform JS SDK events, Direct Post, Host2Host                                                                                                       |
| https://docs.decta.com/Integration/testing-and-going-live/                                     | Sandbox scenarios with expected status and processing codes                                                                                                    |
| https://docs.decta.com/Payments/simple-payment-scenarios/                                      | One/two-step, zero amount, refunds, reversal                                                                                                                   |
| https://docs.decta.com/Payments/recurring-payment-scenarios/                                   | Recurring, one-click, `cof_trace_id`, `transaction_link_id`                                                                                                    |
| https://docs.decta.com/Payments/payout-scenarios/                                              | A2A, B2P, P2P, OG, SDWO, AUTH NAME payouts                                                                                                                     |
| https://docs.decta.com/Payments/payment-methods/                                               | Cards, Apple Pay, Google Pay, PayPal, Volt, Zimpler, Klarna, Open Banking, MB Way; markets, currencies                                                         |
| https://docs.decta.com/Payments/additional-capabilities/                                       | Travel data, descriptors, QCash, MOTO, SDWO, AVS requests                                                                                                      |
| https://docs.decta.com/Useful-Information/api-best-practices-and-performance/                  | Polling and 4xx/5xx retry guidance                                                                                                                             |
| https://docs.decta.com/Useful-Information/security/                                            | Domains, static webhook IPs, PCI DSS                                                                                                                           |
| https://docs.decta.com/Useful-Information/change-history/                                      | Release history to 2.9 (October 2026)                                                                                                                          |
| https://docs.decta.com/Useful-Information/developer-tools/                                     | Plugins, key sets, webhook UI                                                                                                                                  |
| https://docs.decta.com/Other-Functionalities/partners/                                         | Partner requests for connected merchants                                                                                                                       |
| https://docs.decta.com/Integration/quickstart-guide/                                           | Onboarding steps                                                                                                                                               |
| https://www.decta.com/company/decta-documentation                                              | Documentation index; licence footer                                                                                                                            |
| https://www.decta.com/products/payment-acquiring                                               | Sectors, Principal Member, licences                                                                                                                            |
| https://www.decta.com/products/white-label-payment-gateway                                     | White-label gateway, industries                                                                                                                                |
| https://www.decta.com/solutions/payment-orchestration                                          | Orchestration feature                                                                                                                                          |
| https://www.decta.com/company/about-us                                                         | EMI licences, scale                                                                                                                                            |
| https://www.decta.com/documents/terms-and-conditions                                           | Legal entities and licence numbers                                                                                                                             |
| https://hub.decta.com/ (redirect target of https://acquiring.decta.com/Introduction/overview/) | Issuing and acquirer-processing docs (SOAP, ISO8583); navigation only, out of scope                                                                            |
| https://docs.cy.decta.com/                                                                     | Second "DECTA Gate Documentation" instance; title only                                                                                                         |

---

## 3. API families in scope

| Family                                                                                                                                                                                                        | Format                                                                                                          | Relevance                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Decta Gate REST API v0.6** (`/api/v0.6/orders/`, `/orders/{id}/capture                                                                                                                                      | refund                                                                                                          | reverse                                                                              | cancel/`, `/orders/init_*`payouts,`/charges/`, `/subscriptions/`, `/clients/`, `/webhooks/`) | JSON, UTF-8, Bearer token | **Primary**: the `Order` object is the core payload |
| **Webhooks v0.6**                                                                                                                                                                                             | JSON body = the event's object (`order.*` sends the full Order); headers `X-Webhook-Event`, `X-Webhook-Version` | **Primary**                                                                          |
| Host2Host `api_do_url` and wallet/APM init links (`api_do_applepay`, `api_do_googlepay`, `api_init_paypal`, `api_init_volt`, `api_init_zimpler`, `api_init_klarna`, `api_init_openbanking`, `api_init_mbway`) | JSON                                                                                                            | Secondary: short responses (`processing_status`, `threed_check_url`, `redirect_url`) |
| Manual 3DS steps (`next_step_url`)                                                                                                                                                                            | JSON                                                                                                            | Secondary: `status` `tds_*`, `mdstatus`                                              |
| Payform JS SDK events                                                                                                                                                                                         | Browser event `PayformSdkEvent:statusUpdate`                                                                    | Low (client-side only)                                                               |
| Webhooks v0.5 (`payment.*`, `invoice.*`, `transfer.withdrawn`)                                                                                                                                                | Deprecated; body "not documented in this reference"                                                             | Out of scope                                                                         |
| DECTA Hub (issuing API, acquirer SOAP, ISO8583)                                                                                                                                                               | Various                                                                                                         | Out of scope (processor/bank integrations)                                           |

Implement first: the `Order` JSON (from GET order or an `order.*` webhook), decoding `transaction_details.processing_status.code` against the raw acquirer table, then the Host2Host/3DS step responses.

---

## 4. Response and error formats

- Content type: `application/json`, UTF-8, for requests, responses and webhooks (OpenAPI intro).
- HTTP status: OpenAPI intro lists `200` success, `400` missing mandatory parameters, `403` wrong token; endpoints also document `201` (order created), `204` (deleted), `404` (not found). DECTA: "Merely receiving a positive HTTP status code of 200/OK for a payment request does not guarantee that the payment has been successful" (response-codes page). Payment operations are asynchronous: "You must wait for the webhook as that is the only wa[y] to receive the correct payment status" (general-payment-flow page).
- **API validation error object** (OpenAPI intro): keys are invalid request field names; values are arrays of `{ "message": string, "code": string }`; the special key `__all__` holds errors not tied to a field. Only the code value `invalid` appears in examples; the full list of error identifiers is **NOT DOCUMENTED**.
- Documented 400 descriptions (plain text in spec, response body shape **NOT DOCUMENTED**): "Invalid order status", "Invalid order status or refund timeout", "Invalid order status or reverse timeout", "Invalid input or order status", "Invalid order", "Account disabled!", "Error during payment processing".
- Order response verbosity: query `response_type=minimum` (default), `standard` or `full` (general-payment-flow page).

Main Order fields for diagnosis (OpenAPI `Order` schema):

| Field                                       | Meaning                                                                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                      | Literal `"order"`                                                                                                                                                                                          |
| `id`                                        | Order UUID                                                                                                                                                                                                 |
| `number`                                    | Order number, shown with `#`, autogenerated as `DE1`, `DE2`, ... if not provided                                                                                                                           |
| `status`                                    | Order status (see §6)                                                                                                                                                                                      |
| `status_changes[]`                          | Log, oldest first: `new_status`, timestamp key (see §10 item 2), `author`, `currency`, `operation_amount`, `charge_uid`                                                                                    |
| `transaction_details.processing_status`     | `{ code: "Numeric status code", description, <timestamp> }`: the raw acquirer code (§5)                                                                                                                    |
| `transaction_details.errors[]`              | `{ code, description, <timestamp> }` payment attempt errors; code vocabulary **NOT DOCUMENTED**                                                                                                            |
| `transaction_details.merchant_advice_code`  | Mastercard MAC (in `Order_create` schema)                                                                                                                                                                  |
| `transaction_details.three_d_secure_status` | `eci`, `xid`, `sca_exemptions`, `mpi_status_code`, `three_d_secure_protocol`, `three_d_source` (`DECTA MPI`/`3rd party MPI`), `three_d_secure`, `three_d_flow` (`Frictionless`/`Challenge`), `description` |
| `transaction_details.auth_eci`              | ECI assigned after authorization; DECTA advises comparing with `eci` to spot downgrades                                                                                                                    |
| `transaction_details.fraud_check_status`    | `{ code, description }`; values **NOT DOCUMENTED**                                                                                                                                                         |
| `transaction_details.*` amounts             | `amount_refunded`, `amount_reversed`, `amount_refund_reversal`, `chargebacks`, `chargebacks_reversed`, `chargebacks_reason_code`                                                                           |
| `transaction_details.cleared` / `settled`   | Clearing and settlement timestamps                                                                                                                                                                         |
| `avs_status`                                | `{ avs_status, description, avs_status_timestamp }`                                                                                                                                                        |
| `card_name_validation`                      | `full_name_validation`, `first_name_validation`, `middle_name_validation`, `last_name_validation`: `full_match`/`partial_match`/`no_match`                                                                 |
| `payment_system`                            | `SMS`, `DMS`, `AUTH`                                                                                                                                                                                       |
| `permitted_actions[]`                       | e.g. `capture`, `void`, `refund`, `reverse`                                                                                                                                                                |

Example A: Host2Host 3DS challenge step, transcribed from https://docs.decta.com/Integration/3ds-authentication/:

```json
{
  "next_step": "tds_validate",
  "next_step_url": "https://transactions.gateway.com/p/uuid/3d/tds_enrollment/",
  "processing_status": null,
  "redirectToACSForm": "HTML content",
  "status": "tds_pending",
  "three_d_secure_details": {
    "mdstatus": "9",
    "protocol": "3DS2.2.0",
    "txid": "111111111",
    "xid": "RGVjdGEgR2F0ZXdheQ=="
  }
}
```

Example B: final step after validation, declined with code 116, same source:

```json
{
  "next_step": null,
  "next_step_url": null,
  "processing_status": "116",
  "status": "tds_completed",
  "three_d_secure_details": {
    "mdstatus": "1",
    "protocol": "3DS2.2.0",
    "txid": "111111111",
    "xid": "RGVjdGEgR2F0ZXdheQ=="
  }
}
```

Wallet/Host2Host short responses (payment-methods page): `{"processing_status": "000"}` or `{"threed_check_url": "https://transactions.decta.com/p/<uuid>/.../3d/"}`.

---

## 5. Codes

Code values below are exact. Paraphrases are original. Category and retry columns are **suggestions** for PandaPayLens, not DECTA statements; DECTA's own guidance is: for 1xx/2xx refusals the cardholder should contact the issuer; for 9xx the merchant should contact DECTA technical support.

Field location: `transaction_details.processing_status.code` (Order) and top-level `processing_status` (Host2Host/3DS/wallet responses). Sandbox scenarios confirm the mapping ("Processing code = 116 (Decline, not sufficient funds)").

### 5.1 Raw Acquirer Response Codes (83; source: /Useful-Information/response-codes/)

DECTA "Status" column groups: Approved (000-007), Decline (100-198), Decline no funds (116), Pick-up (200-210), Accepted (400), Call acquirer (902-923), Not accepted (950-951).

| Code  | Meaning (paraphrase)                                       | Category                                     | Retry                           |
| ----- | ---------------------------------------------------------- | -------------------------------------------- | ------------------------------- |
| `000` | Approved                                                   | n/a (success)                                | n/a                             |
| `001` | Approved with identification                               | n/a (success)                                | n/a                             |
| `002` | Approved for a partial amount                              | n/a (partial success; check amount)          | manual_review                   |
| `003` | Approved (VIP)                                             | n/a (success)                                | n/a                             |
| `004` | Approved, update track 3                                   | n/a (success)                                | n/a                             |
| `005` | Approved, issuer specified account type                    | n/a (success)                                | n/a                             |
| `006` | Partial amount approved, issuer specified account type     | n/a (partial success)                        | manual_review                   |
| `007` | Approved, update ICC                                       | n/a (success)                                | n/a                             |
| `100` | Generic decline                                            | card_declined                                | customer_action_required        |
| `101` | Expired card                                               | card_declined                                | customer_action_required        |
| `102` | Suspected fraud                                            | fraud_or_risk                                | do_not_retry                    |
| `103` | Merchant should contact acquirer                           | configuration                                | manual_review                   |
| `104` | Restricted card                                            | card_declined                                | do_not_retry                    |
| `105` | Merchant should call acquirer security                     | fraud_or_risk                                | manual_review                   |
| `106` | PIN tries exceeded                                         | authentication_failed                        | do_not_retry                    |
| `107` | Refer to issuer                                            | card_declined                                | customer_action_required        |
| `108` | Refer to issuer, special conditions                        | card_declined                                | customer_action_required        |
| `109` | Invalid merchant                                           | configuration                                | do_not_retry                    |
| `110` | Invalid amount                                             | invalid_amount                               | do_not_retry                    |
| `111` | Invalid card number                                        | card_declined                                | customer_action_required        |
| `112` | PIN required                                               | authentication_required                      | customer_action_required        |
| `113` | Fee not acceptable                                         | invalid_amount                               | do_not_retry                    |
| `114` | No account of the requested type                           | card_declined                                | customer_action_required        |
| `115` | Function not supported                                     | payment_method_unavailable                   | do_not_retry                    |
| `116` | Insufficient funds                                         | insufficient_funds                           | customer_action_required        |
| `117` | Wrong PIN                                                  | authentication_failed                        | customer_action_required        |
| `118` | No card record                                             | card_declined                                | do_not_retry                    |
| `119` | Not permitted for this cardholder                          | card_declined                                | do_not_retry                    |
| `120` | Not permitted for this terminal                            | card_declined                                | do_not_retry                    |
| `121` | Over withdrawal amount limit                               | card_declined                                | customer_action_required        |
| `122` | Security violation                                         | fraud_or_risk                                | do_not_retry                    |
| `123` | Over withdrawal frequency limit                            | card_declined                                | customer_action_required        |
| `124` | Violation of law                                           | card_declined                                | do_not_retry                    |
| `125` | Card not yet effective                                     | card_declined                                | customer_action_required        |
| `126` | Invalid PIN block                                          | configuration                                | manual_review                   |
| `127` | PIN length error                                           | authentication_failed                        | customer_action_required        |
| `128` | PIN key synchronization error                              | configuration                                | manual_review                   |
| `129` | Suspected counterfeit                                      | fraud_or_risk                                | do_not_retry                    |
| `160` | Additional customer authentication required (soft decline) | authentication_required                      | customer_action_required        |
| `162` | Lifecycle violation                                        | card_declined                                | customer_action_required        |
| `163` | Policy violation                                           | card_declined                                | customer_action_required        |
| `164` | Fraud/security violation                                   | fraud_or_risk                                | do_not_retry                    |
| `165` | Not supported or blocked by issuer                         | card_declined                                | do_not_retry                    |
| `169` | Blocked by the cardholder                                  | card_declined                                | customer_action_required        |
| `180` | Declined at the cardholder's request                       | card_declined                                | do_not_retry                    |
| `197` | Call AmEx                                                  | card_declined                                | manual_review                   |
| `198` | Call card processing centre                                | unknown                                      | manual_review                   |
| `200` | Pick-up, no reason                                         | card_declined                                | do_not_retry                    |
| `201` | Pick-up, expired                                           | card_declined                                | do_not_retry                    |
| `202` | Pick-up, suspected fraud                                   | fraud_or_risk                                | do_not_retry                    |
| `203` | Pick-up, contact acquirer                                  | card_declined                                | do_not_retry                    |
| `204` | Pick-up, restricted                                        | card_declined                                | do_not_retry                    |
| `205` | Pick-up, call acquirer security                            | fraud_or_risk                                | do_not_retry                    |
| `206` | Pick-up, PIN tries exceeded                                | authentication_failed                        | do_not_retry                    |
| `207` | Pick-up, special conditions                                | fraud_or_risk                                | do_not_retry                    |
| `208` | Pick-up, lost card                                         | fraud_or_risk                                | do_not_retry                    |
| `209` | Pick-up, stolen card                                       | fraud_or_risk                                | do_not_retry                    |
| `210` | Pick-up, suspected counterfeit                             | fraud_or_risk                                | do_not_retry                    |
| `400` | Accepted (reversal)                                        | n/a (success for reversal)                   | n/a                             |
| `902` | Invalid transaction                                        | invalid_request                              | do_not_retry                    |
| `903` | Re-enter transaction                                       | provider_unavailable                         | retry_conditionally             |
| `904` | Format error                                               | invalid_request                              | manual_review                   |
| `905` | Acquirer not supported by switch                           | configuration                                | manual_review                   |
| `906` | Cutover in progress                                        | provider_unavailable                         | retry_conditionally             |
| `907` | Issuer or switch inoperative                               | provider_unavailable                         | retry_conditionally             |
| `908` | No routing destination                                     | configuration                                | manual_review                   |
| `909` | System malfunction                                         | provider_unavailable                         | retry_conditionally             |
| `910` | Issuer signed off                                          | provider_unavailable                         | retry_conditionally             |
| `911` | Issuer timed out                                           | network_or_timeout                           | retry_conditionally             |
| `912` | Issuer unavailable                                         | provider_unavailable                         | retry_conditionally             |
| `913` | Duplicate transmission                                     | duplicate_request                            | do_not_retry                    |
| `914` | Original transaction not traceable                         | invalid_request                              | manual_review                   |
| `915` | Reconciliation cutover/checkpoint error                    | provider_unavailable                         | retry_conditionally             |
| `916` | MAC incorrect                                              | configuration                                | manual_review                   |
| `917` | MAC key sync error                                         | configuration                                | manual_review                   |
| `918` | No communication keys                                      | configuration                                | manual_review                   |
| `919` | Encryption key sync error                                  | configuration                                | manual_review                   |
| `920` | Security hardware/software error, retry allowed            | provider_unavailable                         | retry_conditionally             |
| `921` | Security hardware/software error, no action                | provider_unavailable                         | manual_review                   |
| `922` | Message out of sequence                                    | network_or_timeout                           | retry_conditionally             |
| `923` | Request in progress                                        | n/a (pending)                                | do_not_retry (wait for webhook) |
| `950` | Violation of business arrangement                          | configuration                                | manual_review                   |
| `951` | Limit exceeded (added in docs release 1.64)                | unknown (merchant vs. card limit not stated) | manual_review                   |

"retry_conditionally" for 9xx means: confirm the final order status by webhook or GET order first, because the original may have been processed.

### 5.2 Special gateway code

| Code | Meaning                                                                                  | Category                       | Retry         |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------ | ------------- |
| `-1` | DECTA: several causes, most likely an expired card; contact support if the card is valid | card_declined (low confidence) | manual_review |

The field that carries `-1` is **NOT DOCUMENTED**.

### 5.3 Mastercard Merchant Advice Codes (`merchant_advice_code`, 5; source: /Payments/after-the-payment/)

| Value | Meaning                                                                      | Retry                        |
| ----- | ---------------------------------------------------------------------------- | ---------------------------- |
| `01`  | New account information available                                            | customer_action_required     |
| `02`  | Cannot approve now, try later                                                | retry_conditionally          |
| `03`  | Do not try again (DECTA: account closed or fraudulent)                       | do_not_retry                 |
| `04`  | Token requirements not met for this token type                               | do_not_retry (configuration) |
| `21`  | Payment cancellation via Mastercard PCS (cardholder cancelled the agreement) | do_not_retry                 |

DECTA: "Not all acquirers return this value."

### 5.4 Informational values (not errors)

- AVS `avs_status` (18): `A`, `B`, `C`, `D`, `F`, `G`, `I`, `M`, `N`, `P`, `R`, `S`, `T`, `U`, `W`, `X`, `Y`, `Z`. DECTA "does not make any automatic decisions based on the AVS response codes". Suggested: informational only, `fraud_or_risk` hint at most for `N`.
- Name validation: `full_match`, `partial_match`, `no_match`; order `paid` means the check ran, `failed` means it could not run.
- 3DS step `status`: `tds_initiated`, `tds_pending`, `tds_completed`; `next_step`: `enrollment_request`, `tds_validate`, `null`. `mdstatus` meanings documented only for `51` (3DS method not needed) and `50` (perform 3DS method); `1` and `9` appear in examples without definition (**NOT DOCUMENTED**).
- 3DS timeout message: "Operation timed out" (abandoned 3DS; order fails after 15 minutes). Suggested: authentication_failed / customer_action_required.
- Refund refusal message example: "Refund initiation is declined because of RDR value" (chargeback already received). Suggested: invalid_request / do_not_retry.
- SDK browser event statuses: `on_success`, `on_failure`, `on_error`, `on_timeout`, `on_in_progress` (client side only, not a final status).

---

## 6. Lifecycle

Card/gateway semantics only; DECTA has no wallet-transfer model in these docs.

- **API `Order.status` enum (15)**: `draft`, `issued`, `viewed`, `cancelled`, `overdue`, `expired`, `rejected`, `hold`, `paid`, `withdrawn`, `chargeback`, `refunded`, `received`, `failed`, `in_progress`. `StatusChange.new_status` adds `created`, `reversed`.
- **Docs status table (31 labels)** adds: Refund initiated, Refund failed, Refund reversed, Reversal initiated, Reversal failed, Representation, Retrieval, Pre-arbitration, Arbitration, Pre-compliance, Compliance, Good faith, Fraud advice, Created (payout), Test. Their wire values are **NOT DOCUMENTED** in the schema.
- Key semantics (docs): `failed` is **not final** (more attempts allowed); `cancelled` and `rejected` are final; `hold` auto-cancels after 28 days; `overdue` still payable, `expired` not; `received` means paid outside the gateway.
- Payment: `issued` -> `viewed` -> `in_progress` -> `paid` | `failed` (retry allowed) -> ... ; two-step: `hold` -> capture (`paid`, single capture, remainder released) or cancel/void (`cancelled`).
- Refund: full or partial, async, within two years; reversal: full only, same day.
- Chargeback family: `chargeback`, representation, retrieval, pre-arbitration, arbitration, pre-compliance, compliance, good faith, fraud advice. `Charge` objects (`chargeback_is_reversal`) also represent fees and dispute notices.
- Subscription/rebill: `subscriptions` resource issues orders (`from_subscription: true`); merchant-initiated recurring via `use_scenario` (`automatic`, `recurring`, `one-click`) or merchant-side `scenario`. Subscription-level statuses are outside this condensed scope.
- Payouts (A2A, B2P, P2P, OG, SDWO, AUTH NAME): orders created via `/orders/init_*`; Charge statuses `created`, `viewed`, `expired`, `paid`, `failed`, `in_progress`, `cancelled`. Webhook events `oct.issued`, `oct.success`, `oct.failure`.

---

## 7. Notifications (webhooks)

- Delivery: HTTP POST, `Content-Type: application/json`, UTF-8. Headers `X-Webhook-Event: <event>` and `X-Webhook-Version: v0.6` (OpenAPI example).
- Body: "The part before the dot is the object name and defines the data sent ... order.* webhooks send full data of an Order object." `card.*` sends a saved-card object (`id`, `transaction_type`, `client`, `merchant`, `masked_pan`, `exp_month`, `exp_year`, `is_default`, `cardholder_name`, `product_type`, `issuer_country`, `region_card_issuer`, `card_type`). Partner webhooks include the merchant ID in the body.
- Event types (docs, 31): `order.issued`, `order.payment_success`, `order.payment_failure`, `order.hold`, `order.canceled`, `order.in_progress`, `order.invoice_viewed`, `order.invoice_refunded`, `order.invoice_reversal`, `order.refund_failure`, `order.invoice_refund_reversed`, `order.refund_init_failure`, `order.reversal_init_failure`, `order.reversal_failure`, `order.refund_in _progress`, `order.reversal_in _progress` (both printed with a space, see §10), `order.received`, `order.rejected`, `order.expired`, `order.chargeback`, `order.representation`, `order.retrieval`, `order.pre-arbitration`, `order.good_faith`, `order.fraud_advice`, `oct.issued`, `oct.success`, `oct.failure`, `card.created`, `card.deleted`, `card.updated`. `all_events: true` subscribes to all.
- Legacy v0.5 events (deprecated, body not documented): `transfer.withdrawn`, `payment.created`, `payment.paid`, `payment.failed`, `payment.hold`, `payment.canceled`, `invoice.viewed`, `invoice.canceled`.
- **Signature: NOT DOCUMENTED for v0.6.** `hmac_key` exists in the webhook object but is reserved for "v1.0 Webhooks that is in the development phase and will not be used in v0.6". DECTA's verification advice: accept only the static source IPs `18.157.244.107` and `3.67.43.46`, and double-check the order status via the API.
- Delivery/event ID: **NOT DOCUMENTED** (body `id` is the object's ID, not an event ID).
- Retries: a `retry_enabled` boolean exists on webhook objects; schedule, attempts and acknowledgement rules are **NOT DOCUMENTED**. Ordering: **NOT DOCUMENTED**.
- Duplicate identification (suggestion): order `id` + `X-Webhook-Event` + latest `status_changes` entry.

---

## 8. Identifiers

| Identifier                                | Field                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order (transaction container)             | `id` (UUID); refunds, captures and reversals act on the same order ID                                                                                                       |
| Order number / merchant-visible reference | `number` (`DE*` pattern if not provided; merchant-provided value possible per description, though marked read-only)                                                         |
| Creation originator                       | `referrer` (max 32 chars, "Order creation originator's textual ID")                                                                                                         |
| Processor transaction                     | `transaction_details.processing_payment_id`; `transactions_id` (ID on transactions server); sandbox `processing_id` values like `000000010`                                 |
| Scheme references                         | `rrn` (12 digits), `arn`, `auth_appr_code`                                                                                                                                  |
| Original/parent for recurring             | `transaction_details.trace_id` (original issuer TID); request fields `cof_trace_id`, `transaction_link_id` (Mastercard TLID, 22 chars), `original_client`, `recurring_card` |
| Charge (fee/payout/dispute)               | `Charge.id`, `status_changes[].charge_uid`                                                                                                                                  |
| Merchant/terminal                         | `merchant`, `website`, `brand`, `terminal_processing_id`, `processing_merchant_id`, `account.processing_id`                                                                 |
| Subscription link                         | `from_subscription` (boolean only); subscription ID on the order: **NOT DOCUMENTED**                                                                                        |

## 9. Sensitive fields

Card data (`card_number`, `csc`/`cvv`, `exp_month`, `exp_year`, `cardholder_name`, `card_masked_pan`, `masked_pan`); 3DS material (`cavv`, `eci`, `xid`, `cres`, `pares`, `redirectToACSForm`, `tds_method_content`, `threed_check_url`, `next_step_url`); Apple Pay/Google Pay tokens (`signature`, `signedMessage`, `intermediateSigningKey`, `signatures`); capability URLs (`api_do_url`, `api_do_*`, `api_init_*`, `full_page_checkout`, `iframe_checkout`, `direct_post`, `link`, `download_link`); secrets (`Authorization: Bearer` secret key, `api_secret`, `hmac_key`); personal data (client `email`, `phone`, names, `birth_date`, `personal_code`, addresses, `bank_account`, `bank_code`, all `sender_*` payout fields); IPs (`paid_from_ip`, `created_from_ip`, `ip_address`).

## 10. Structural detection hints

Strong DECTA signals (combine several):

1. JSON with `"type": "order"`, UUID `id`, `number` matching `DE\d+`, and `transaction_details.processing_status.code` as a 3-digit string.
2. Distinctive keys: `status_changes[].new_status`, `api_do_url`, `full_page_checkout`, `direct_post`, `is_payable`, `permitted_actions`, `skip_capture`, `payment_system` (`SMS`/`DMS`/`AUTH`), `auth_eci`, `three_d_source` (`DECTA MPI`).
3. Host2Host/3DS: `status` in `tds_initiated|tds_pending|tds_completed`, `next_step`, `next_step_url`, `three_d_secure_details.mdstatus`, `redirectToACSForm`.
4. Webhook headers `X-Webhook-Event: order.*|oct.*|card.*` and `X-Webhook-Version: v0.6`.
5. Hosts `gate.decta.com`, `transactions.decta.com` (path `/p/<uuid>/.../3d/`), `payments.<domain>/sdk/sdk.min.js`.
6. API errors keyed by field name with `{message, code}` arrays and an `__all__` key.

Differences: Stripe uses `object` and prefixed IDs (`pi_`, `evt_`); Adyen uses `pspReference`/`resultCode`/`notificationItems`; payabl. is URL-encoded `key=value`; Checkout.com uses 5-digit `response_code` (e.g. `10000`) and `_links`; PayPal uses `event_type`/`resource`; Mollie uses `resource: "payment"` and `tr_` IDs; Braintree uses XML/`bt_signature` payloads; Square uses `payment` objects with `status: COMPLETED`. Among the other candidates, Trustly uses JSON-RPC envelopes (`method`, `params`, `signature`); DECTA has no RPC envelope and no body signature. False-positive risk: DECTA's white-label gateway may emit the same structure under non-DECTA hosts, so rely on structure, not only hostnames.

## 11. Limitations and inconsistencies

1. No complete `Order` response or `order.*` webhook body example; field presence must be inferred from the schema and `response_type`.
2. Timestamp sub-keys in `status_changes`, `processing_status`, `errors` and `three_d_secure_status` are literally named `true` in the YAML. This looks like a YAML 1.1 serialization of `on`; the real wire key is unconfirmed (**NOT DOCUMENTED**).
3. The response-codes page says a refused payment includes "a response_code with a value Refused or Cancelled along with a description field", but no `response_code` field exists in the OpenAPI schema.
4. Status lists disagree: API enum (15 + 2), docs table (31 labels), Charge enum (7).
5. Event names `order.refund_in _progress` and `order.reversal_in _progress` contain a space in the docs; the event spelling `order.canceled` differs from status `cancelled`. The OpenAPI event enum lists only 11 v0.6 events.
6. No webhook signature, no event ID, retry schedule and ordering undocumented.
7. `errors[].code` and `fraud_check_status.code` vocabularies are undocumented; the location of `-1` is undocumented.
8. OpenAPI intro example shows `status: 400` headers with a successful tax body; the webhook start-line text lists "POST PUT PATCH DELETE". Docs artifacts, not behavior.
9. APM-specific (Volt, Zimpler, Klarna, Open Banking, MB Way, PayPal) failure reasons are not coded; only order status changes are documented.
10. Hold duration "from 6 up to 28 days" depends on processing; MAC availability depends on acquirer.
11. Different acquiring connections may require extra fields (recurring numbers, India rules); behavior varies per terminal.

## 12. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                                                  |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **supported** | 83 exact raw acquirer codes with DECTA's own status groups and guidance, plus MAC and AVS. Unknown `errors[].code` values fall back to `unknown`.                                                                                              |
| paymentResponses | **limited**   | Order schema and Host2Host/3DS/wallet responses are documented, but payment calls are asynchronous, there is no full order example, and the timestamp key is ambiguous.                                                                        |
| webhookParsing   | **limited**   | Body is the documented Order/card object, but the event type is only in an HTTP header, there is no signature or event ID, and retry/ordering are undocumented.                                                                                |
| timeline         | **limited**   | `status_changes` (oldest first, with amounts and authors) plus `issued`/`viewed`/`captured`/`paid`/`cleared`/`settled` timestamps give a good timeline; held back by the timestamp key ambiguity and the 31-vs-17 status mismatch.             |
| correlation      | **limited**   | One order UUID spans authorization, capture, refund and reversal; `trace_id`/`cof_trace_id`/`transaction_link_id` link recurring payments. Payout/fee `Charge` objects and subscriptions link only weakly (`charge_uid`, `from_subscription`). |
