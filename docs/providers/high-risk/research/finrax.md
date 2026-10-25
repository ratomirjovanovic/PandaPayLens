# Finrax (adapter id `finrax`): high-risk provider research

Status: qualification gate plus a condensed technical specification for a parse-only PandaPayLens adapter. Everything comes from Finrax first-party sources as published on the verification date. Where the documentation is silent, the text says **NOT DOCUMENTED**. Nothing here is a guarantee about live behavior.

- Verification date: **2026-10-25**
- Gate outcome: **`documentation_verified`** (with a weak error-code surface; see section 4 and section 11)
- Method note: `docs.finrax.com` is a client-rendered Docusaurus v3.10.1 site. A plain HTTP fetch of any docs route returns the Introduction shell only. The page content was read from the site's own published JavaScript bundles (`/assets/js/*.js`, discovered through `/sitemap.xml` and the runtime chunk map). These are the files the browser renders, so the text is first-party and identical to what a visitor sees. No login, sign-up or access request was made. The dashboard (`https://dashboard.finrax.com`) was not opened beyond confirming it answers HTTP 200.

---

## Qualification gate

| #   | Item                                       | Answer             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product currently active           | **yes**            | https://finrax.com: "Finrax Ltd.", offices in Sofia and Vilnius, payments and payouts products. HTTP `Last-Modified` of the site is 2026-10-05 and of the docs bundle 2026-10-22 (read 2026-10-25). Sitemap lists 2025 event pages (SBC Summit Lisbon 2025, SiGMA Europe 2025, Forex Expo Dubai 2025). The visible footer still reads "(c) 2025 Finrax Ltd."                                                                                                                                                                                                                                            |
| 2   | Payment service operational                | **yes**            | Docs describe live endpoints and a production environment (https://docs.finrax.com/environments/production-environment); dashboard answers. Operational status of individual coins/networks is NOT DOCUMENTED.                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | Developer docs publicly accessible         | **yes (partly)**   | Public without login: introduction, authorization, signature, environments, errors, 17 API reference pages (OpenAPI-generated), 3 callback pages, callback RSA public keys (sandbox and production, embedded in site config). **Not public**: the API base URL ("Use the sandbox API base URL provided for your integration environment"; production page: "Use the production API base URL shown in the endpoint reference for your branded documentation site", but no URL is shown). Sandbox access requires an organisation that "support will set up for you". API keys require a dashboard login. |
| 4   | API family/versions identified             | **yes**            | One REST JSON API, all paths under `/v1/...` (e.g. `POST /v1/payments`, `POST /v1/withdrawals`). No other version is published; the docs site version label is "current".                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Responses/notifications examinable offline | **yes**            | Full JSON schemas and examples for payment, deposit, refund and withdrawal objects; three callback payload examples; error body example (https://docs.finrax.com/errors).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | Sectors documented by provider             | **yes (limited)**  | iGaming: page titled "Seamless Crypto Payments for iGaming Operators" with section "Tailored for iGaming Use Cases" and "built for high-volume gaming" (https://finrax.com/seamless-crypto-payments-for-igaming-operators). Same page: compliance "built for high-risk verticals" (verticals not named). Event page: helps "brokers, traders, and platforms", "From startups to established casinos" (https://finrax.com/finrax-x-forex-expo-dubai-2025).                                                                                                                                               |
| 7   | Regional/regulatory limitations identified | **yes (partly)**   | Site footer: "Finrax is currently not offering any crypto-asset service provider (CASP) services to customers in the EU" (pending MiCA licensing). iGaming page mentions "jurisdictional controls" without detail. Merchant-side licences, restricted countries and prohibited business lists are NOT DOCUMENTED publicly. The linked Terms PDF is an end-user document (metadata title "2023-01-24 Finrax Terms and Conditions v.1.1 (end-users)") and was not machine-readable here.                                                                                                                  |
| 8   | Adapter gives diagnostic value             | **yes (moderate)** | Documented enums for payment status (9), deposit status (6), refund status (5) and refund reason (5), withdrawal status (4), approval status (4); AML address-owner object on withdrawals; signed callbacks. Weakness: errors are only HTTP status codes plus a free-text `message` (no provider error codes).                                                                                                                                                                                                                                                                                          |
| 9   | Own technical format (not a reseller)      | **yes**            | Finrax publishes its own API (`/v1/payments`, `FRX-API` auth scheme, own callback signature). No underlying gateway is named. Note: the docs are a multi-brand template (`brandLabel:"Finrax"` in site config, assets under `brands.finrax.com/finrax-lt/finrax-lt/`, body text falls back to "the API" where a brand name would go). This suggests Finrax itself serves the same API under other brand labels, not that Finrax resells another gateway.                                                                                                                                                |
| 10  | No credentials needed to analyze examples  | **yes**            | All examples and schemas are public. Credentials are only needed to call the API, which PandaPayLens never does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Classification

- `alternative_payment_method`: crypto deposits (BTC, ETH, USDT, USDC, LTC, XRP and others) accepted from end users; "Finrax enables merchants to accept cryptocurrency payments and initiate withdrawals to customers" (https://docs.finrax.com/).
- `gateway`: the homepage presents the payments product as a crypto payment gateway with hosted checkout or direct API (https://finrax.com). In Finrax's case "gateway" means a hosted crypto checkout plus settlement, not a card gateway.
- Not `card_processing`, not `acquiring`, not `wallet` (no end-user wallet product is documented; merchant balances only), not `orchestration`.
- Payouts: crypto withdrawals to arbitrary addresses (`POST /v1/withdrawals`); the homepage also mentions bank settlements in EUR, USD and GBP (merchant settlement, no API documented).

## Sectors (provider-stated only)

| Sector                          | Source                                                            | Note                                                    |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| iGaming                         | https://finrax.com/seamless-crypto-payments-for-igaming-operators | Dedicated landing page                                  |
| Casinos                         | https://finrax.com/finrax-x-forex-expo-dubai-2025                 | "From startups to established casinos"                  |
| Brokers / traders               | https://finrax.com/finrax-x-forex-expo-dubai-2025                 | "help brokers, traders, and platforms operate globally" |
| "High-risk verticals" (unnamed) | iGaming page                                                      | Not a sector list                                       |

Forex appears only as an event name ("Forex Expo Dubai 2025") and is not stated as an accepted sector. Adult, nutraceuticals, travel and other sectors are not mentioned. Approval for one sector does not imply another; eligibility depends on jurisdiction, licensing and Finrax underwriting, none of which is documented publicly.

---

## 1. Sources (all read 2026-10-25)

| URL                                                                                                                                                                                                                                                                                                                     | What it covers                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| https://finrax.com/                                                                                                                                                                                                                                                                                                     | Company, products, EU CASP footer statement                  |
| https://www.finrax.com/sitemap.xml                                                                                                                                                                                                                                                                                      | Site page list (activity evidence)                           |
| https://finrax.com/seamless-crypto-payments-for-igaming-operators                                                                                                                                                                                                                                                       | iGaming sector statement                                     |
| https://finrax.com/finrax-x-forex-expo-dubai-2025                                                                                                                                                                                                                                                                       | Brokers, traders, casinos statement                          |
| https://finrax.com/blog                                                                                                                                                                                                                                                                                                 | Blog index (no dates shown)                                  |
| https://docs.finrax.com/ and https://docs.finrax.com/sitemap.xml                                                                                                                                                                                                                                                        | Docs index, page list                                        |
| https://docs.finrax.com/authorization                                                                                                                                                                                                                                                                                   | `Authorization: FRX-API ...` header                          |
| https://docs.finrax.com/authorization/management                                                                                                                                                                                                                                                                        | API keys, IP whitelist (403 if not listed)                   |
| https://docs.finrax.com/authorization/signature                                                                                                                                                                                                                                                                         | HMAC-SHA256 request signature elements                       |
| https://docs.finrax.com/environments, /environments/production-environment, /environments/sandbox-environment                                                                                                                                                                                                           | Environments; sandbox test prefixes and resulting statuses   |
| https://docs.finrax.com/errors                                                                                                                                                                                                                                                                                          | Error body format and HTTP status table                      |
| https://docs.finrax.com/api/request-crypto-payment                                                                                                                                                                                                                                                                      | `POST /v1/payments`                                          |
| https://docs.finrax.com/api/submit-crypto-payment                                                                                                                                                                                                                                                                       | `PATCH /v1/payments/{paymentId}`                             |
| https://docs.finrax.com/api/fetch-payment                                                                                                                                                                                                                                                                               | `GET /v1/payments/{paymentId}` (example with deposits)       |
| https://docs.finrax.com/api/fetch-payments                                                                                                                                                                                                                                                                              | `GET /v1/businesses/{businessId}/payments`                   |
| https://docs.finrax.com/api/request-crypto-withdrawal                                                                                                                                                                                                                                                                   | `POST /v1/withdrawals` (201 and 202 responses)               |
| https://docs.finrax.com/api/fetch-withdrawals                                                                                                                                                                                                                                                                           | `GET /v1/withdrawals`                                        |
| https://docs.finrax.com/api/fetch-crypto-withdrawal-approval                                                                                                                                                                                                                                                            | `GET /v1/payment/crypto-withdrawal-approvals/{withdrawalId}` |
| https://docs.finrax.com/api/fetch-crypto-withdrawal-routes, /api/fetch-deposit-metadata, /api/fetch-withdrawal-metadata, /api/fetch-currencies, /api/fetch-business-balance, /api/fetch-market-rates, /api/fetch-fiat-rates, /api/fetch-deposit-rates, /api/validate-address, /api/validate-address-and-destination-tag | Reference/metadata endpoints (low diagnostic value)          |
| https://docs.finrax.com/references/callbacks                                                                                                                                                                                                                                                                            | Callback types and RSA-SHA512 signature                      |
| https://docs.finrax.com/references/callbacks/deposit-received                                                                                                                                                                                                                                                           | Deposit received callback                                    |
| https://docs.finrax.com/references/callbacks/withdrawal-completed                                                                                                                                                                                                                                                       | Withdrawal broadcast callback (COMPLETED / FAILED / BLOCKED) |
| https://docs.finrax.com/references/callbacks/withdrawal-completed-1                                                                                                                                                                                                                                                     | Withdrawal approved/rejected callback                        |

Not used as evidence: third-party integration pages (e.g. other platforms' Finrax connectors) and directory listings.

## 2. API families and versions

| Family                                     | Endpoints                                                                                                                                                                                                    | Format                                         | Relevance           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------- |
| Payments (deposits)                        | `POST /v1/payments`, `PATCH /v1/payments/{paymentId}`, `GET /v1/payments/{paymentId}`, `GET /v1/businesses/{businessId}/payments`                                                                            | JSON request and response                      | **Primary**         |
| Withdrawals (payouts)                      | `POST /v1/withdrawals` (201 created, 202 pending approval), `GET /v1/withdrawals`, `GET /v1/payment/crypto-withdrawal-approvals/{withdrawalId}`                                                              | JSON                                           | **Primary**         |
| Callbacks                                  | POST to merchant `depositReceivedCallbackUrl`, `withdrawalCallbackUrl`, `withdrawalApprovalCallbackUrl`                                                                                                      | JSON body, `Signature` and `Timestamp` headers | **Primary**         |
| Error body                                 | any endpoint                                                                                                                                                                                                 | JSON                                           | **Primary** (small) |
| Metadata/rates/balances/address validation | `/v1/currencies`, `/v1/exchange/rates/*`, `/v1/balances/{businessId}`, `/v1/currency/.../valid`, `/v1/payment/deposits/crypto/metadata`, `/v1/withdrawals/metadata`, `/v1/payment/withdrawals/crypto/routes` | JSON                                           | Low                 |

Base URL: NOT DOCUMENTED publicly. Implement first: payment object (`GET /v1/payments/{id}` shape, which is also the `paymentInfo` in create/submit responses), the three callbacks, and the error body.

## 3. Response and error formats

- Content type: `application/json` for requests and responses (OpenAPI `content: application/json`; HTTP 415 "The request payload is not in the supported JSON format"). Callback `Content-Type` header: NOT DOCUMENTED (examples are JSON).
- Field naming: camelCase. Amounts are decimal **strings** in API responses (`"expectedDisplayAmount": "45.00"`) but **numbers** in the deposit callback (`"actualDisplayAmount": 15`). Timestamps are UNIX **seconds** in payloads; the Authorization header timestamp is Unix **milliseconds**.
- Create payment response wraps the payment in `paymentInfo` and adds `paymentUrl` (`CreatedPaymentResponse`). Fetch returns the bare payment (`DetailedPaymentResponse`).
- Main payment fields: `paymentId` (UUID), `clientPaymentId`, `businessId`, `status`, `type` (`ONE_TIME`/`REUSABLE`), `rateType` (`FIXED`/`FLOATING`), `url`, `walletAddress`, `destinationTag`, `displayCurrency`, `expectedDisplayAmount`, `actualDisplayAmount`, `depositCurrency`, `expectedNetwork`, `expectedDepositAmount`, `actualDepositAmount` (deprecated), `expectedUniformAmount`, `actualUniformAmount`, `overpaymentPolicy` (`PROCESS`/`EXCESS_REFUND`), `refundFollowUpDepositsForOneTimePayments`, `processorType` (deprecated, `BLOCKCHAIN`), `expirationMinutes`, `initiatedBy`, `paymentInitiatedAt`, `paymentRequestedAt`, `archived`, `deposits[]`.
- `deposits[]`: `id`, `transactionId` (chain hash), `status`, `fromAddress`, `toAddress`, `riskScore`, `addressRiskAssessment{addressOwner{name,category}, sourceRiskEntities[], destinationRiskEntities[]}`, `depositCurrency`, `network`, `depositAmount`, `onChainFee`, display/settlement/uniform amount and fee fields, `depositReceivedAt`, `refund{type,status,reason,destinationAddress,amount,transactionId,confirmedAt,initiatedBy,initiatedAt,createdAt,...}`.
- Withdrawal 201 (`WithdrawalInitiatedResponse`): `withdrawId`, `clientWithdrawId`, `recipientAddress`, `recipientTag`, `network`, `initiatedBy`, `status`, `displayCurrency`, `estimatedDisplayAmount`, `withdrawCurrency`, `estimatedWithdrawAmount`, `settlementCurrency`, `settlementDeductedAmount`, `settlementServiceFee`, `uniformCurrency` (always EUR), `uniformAmount`, `createdAt`, plus fee and depeg-loss fields. Withdrawal 202 (`IntegratorCryptoWithdrawalPendingApprovalResponse`): `withdrawalId`, `clientLabel`.
- Error body (https://docs.finrax.com/errors), transcribed:

```json
{
  "timestamp": 1584539613,
  "httpStatus": 400,
  "httpError": "Bad Request",
  "message": "Request failed validation",
  "path": "/api/v1/path/to/resource"
}
```

- Approval fetch example (https://docs.finrax.com/api/fetch-crypto-withdrawal-approval): `{"status": "APPROVED"}`.

## 4. Codes

Finrax documents **no provider-specific error or decline codes**. The only code table is HTTP status (9 codes). Category and retry columns are suggestions.

| HTTP  | Finrax meaning (paraphrase)                                                                           | Category             | Retry                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `400` | Invalid body or parameters                                                                            | invalid_request      | do_not_retry                                                                |
| `401` | Invalid authorization token or API credentials (includes bad signature or timestamp)                  | configuration        | do_not_retry                                                                |
| `403` | Insufficient permissions; also returned when the source IP is not whitelisted for the key             | configuration        | do_not_retry                                                                |
| `404` | Resource does not exist                                                                               | invalid_request      | do_not_retry                                                                |
| `405` | HTTP method not supported by endpoint                                                                 | invalid_request      | do_not_retry                                                                |
| `409` | Resource already exists (which field triggers it, e.g. a reused `clientPaymentId`, is NOT DOCUMENTED) | duplicate_request    | do_not_retry                                                                |
| `415` | Payload is not supported JSON                                                                         | invalid_request      | do_not_retry                                                                |
| `500` | Internal error handling the request                                                                   | provider_unavailable | retry_conditionally (fetch by client ID first; a POST may have succeeded)   |
| `503` | System down                                                                                           | provider_unavailable | safe_to_retry_technical_request for GET; retry_conditionally for POST/PATCH |

Lifecycle values with diagnostic meaning (enum values are exact; Finrax gives **no per-value definitions**, so meanings come from the sandbox table on /environments/sandbox-environment where noted, otherwise they are marked as inferred from the name):

| Field               | Value                                                                                   | Meaning                                                                          | Category (suggested)          | Retry (suggested)                  |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------- |
| payment `status`    | `NEW`                                                                                   | Created (seen in create example)                                                 | n/a                           | n/a                                |
|                     | `PENDING`, `AWAITING`                                                                   | Not final; difference NOT DOCUMENTED                                             | n/a                           | n/a                                |
|                     | `DEPOSITED`                                                                             | Deposit received; sandbox shows it for exact **and underpaid** deposits          | n/a (check amounts)           | n/a                                |
|                     | `OVERPAID`                                                                              | Deposit above expected, or a follow-up deposit; excess may be refunded (sandbox) | n/a                           | manual_review                      |
|                     | `EXPIRED`                                                                               | Inferred: payment window passed (`expirationMinutes`, default 30, 0 = 7 days)    | unknown                       | customer_action_required           |
|                     | `BLOCKED`                                                                               | Deposit blocked, full refund (sandbox)                                           | fraud_or_risk                 | manual_review                      |
|                     | `UNPROCESSABLE`                                                                         | Deposit below minimum deposit amount (sandbox)                                   | invalid_amount                | customer_action_required           |
|                     | `FAILED`                                                                                | NOT DOCUMENTED                                                                   | unknown                       | manual_review                      |
| deposit `status`    | `UNCONFIRMED`, `CONFIRMED`                                                              | Inferred: on-chain confirmation state; callback is sent for `CONFIRMED` only     | n/a                           | n/a                                |
|                     | `COMPLIANCE_REVIEW`                                                                     | Inferred: held for AML review                                                    | fraud_or_risk                 | manual_review                      |
|                     | `BLOCKED`, `UNPROCESSABLE`, `FAILED`                                                    | As for payment status                                                            | as above                      | as above                           |
| refund `reason`     | `OVERPAYMENT`, `FOLLOW_UP_DEPOSIT`                                                      | Excess or extra deposit returned (sandbox)                                       | n/a                           | n/a                                |
|                     | `CURRENCY_MISMATCH`                                                                     | Inferred: wrong coin/network sent                                                | invalid_request               | customer_action_required           |
|                     | `RESTRICTED_CURRENCY`                                                                   | Inferred: coin not accepted                                                      | payment_method_unavailable    | customer_action_required           |
|                     | `ILLICIT_DEPOSIT`                                                                       | Inferred: AML hit on source                                                      | fraud_or_risk                 | manual_review                      |
| refund `status`     | `PENDING`, `AWAITING_ADDRESS_INPUT`, `COMPLIANCE_REVIEW`, `CONFIRMED`, `NON_REFUNDABLE` | `destinationAddress` is empty while awaiting address input or non-refundable     | n/a                           | manual_review for `NON_REFUNDABLE` |
| withdrawal `status` | `PENDING`, `COMPLETED`                                                                  | In progress / broadcast                                                          | n/a                           | n/a                                |
|                     | `FAILED`                                                                                | NOT DOCUMENTED (the failure example shows `txAddressOwner.category` "Darknet")   | unknown                       | manual_review                      |
|                     | `BLOCKED`                                                                               | Inferred: blocked by screening                                                   | fraud_or_risk                 | manual_review                      |
| approval `status`   | `PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`                                            | Dashboard approver decision; `SKIPPED` NOT DOCUMENTED                            | n/a; `REJECTED` manual_review | n/a                                |

Counts: 9 HTTP error codes; 33 documented lifecycle enum values (9 payment, 6 deposit, 5 refund status, 5 refund reason, 4 withdrawal, 4 approval). Refund `type` (`PARTIAL`/`FULL`) also documented.

## 5. Lifecycle (crypto semantics; not card)

- Payment: create (`NEW`) -> optional `PATCH` to choose coin/network -> customer sends funds on-chain -> deposit `UNCONFIRMED` -> `CONFIRMED` (callback at one blockchain confirmation) -> payment `DEPOSITED` / `OVERPAID`; or `EXPIRED`, `BLOCKED`, `UNPROCESSABLE`, `FAILED`. One payment can hold several deposits (`deposits[]`), and `REUSABLE` payments never expire and are always `FLOATING`.
- Underpayment has no status of its own: sandbox `underpaid` yields `DEPOSITED` with half the amount. Compare `actualDisplayAmount` with `expectedDisplayAmount`.
- Refunds are per deposit (`deposits[].refund`), triggered by overpayment, follow-up deposits, wrong currency, restricted currency or illicit source.
- Withdrawals: `POST` -> 201 `PENDING` or 202 pending approval (`withdrawalId` later becomes the withdrawal ID) -> approval callback -> broadcast callback `COMPLETED`, `FAILED` or `BLOCKED`.
- Chargebacks, subscriptions, rebills, cancellations: not applicable / NOT DOCUMENTED.

## 6. Callbacks

- Delivery: POST to one of three merchant URLs set in the dashboard. No event-type field; the type is implied by the URL and by payload shape.
- Retry: every 2 minutes for up to 24 hours until delivered. What counts as delivered (HTTP status code, body) is NOT DOCUMENTED. Ordering guarantees: NOT DOCUMENTED.
- Deposit received (status always `CONFIRMED`): `actualDepositAmount`, `actualDisplayAmount`, `clientPaymentId`, `depositAddress`, `depositCurrency`, `depositId`, `displayCurrency`, `displayServiceFee`, `expectedDepositAmount`, `expectedDisplayAmount`, `network`, `expirationTime`, `onChainFee`, `paymentId`, `paymentReceivedAt`, `paymentRequestedAt`, `rateType`, `settlementAmount`, `settlementCurrency`, `settlementServiceFee`, `status`, `fromAddress`, `transactionId`, `displayRateDepegLossAmount`, `settlementRateDepegLossAmount`, `settlementDistributedUserServiceFee`, `displayDistributedUserServiceFee`. Abridged example from https://docs.finrax.com/references/callbacks/deposit-received:

```json
{
  "clientPaymentId": "payment-example-3",
  "depositCurrency": "LTC",
  "depositId": "5979560a-27f1-3558-95af-02d7f64a3f25",
  "paymentId": "9c1bfc14-e658-446d-bba7-f7ea8eb21756",
  "rateType": "FIXED",
  "status": "CONFIRMED",
  "transactionId": "49fd4601aeac8694f014b9d27714ccf639db427ea6ad3c0b831eb498497c80e0"
}
```

- Withdrawal broadcast (`status` one of `COMPLETED`, `FAILED`, `BLOCKED`): `status`, `clientWithdrawalId`, `businessId`, `withdrawalId`, `displayCurrency`, `withdrawCurrency`, `settlementCurrency`, `expectedDisplayAmount`, `actualDisplayAmount`, `estimatedWithdrawAmount`, `actualWithdrawAmount`, `deductedSettlementAmount` (schema spells it `deducedSettlementAmount`), `withdrawFee`, `displayFee`, depeg-loss fields, `toTxAddress`, `transactionId`, `txAddressOwner{name, category}`.
- Withdrawal approval: `withdrawalId`, `clientWithdrawalId`, `status` (`APPROVED`, `PENDING`, `REJECTED`, `SKIPPED`).
- Signature (sensitive): headers carrying "Signature and Timestamp components" (exact header names beyond these words: NOT DOCUMENTED). Algorithm: RSA with SHA-512 over the string `<raw JSON body>.<timestamp>`, Base64-encoded; verified with a per-environment RSA public key published in the docs site config. Timestamp unit for callbacks: NOT DOCUMENTED. PandaPayLens should show these as present/absent, never verify.
- Duplicates: no delivery or event ID. Use `depositId` for deposits and `withdrawalId` + `status` for withdrawals.

## 7. Identifiers

| Identifier                                                | Where                             | Notes                                                |
| --------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `paymentId` (UUID)                                        | payment, deposit callback         | Finrax payment ID                                    |
| `clientPaymentId`                                         | payment, deposit callback         | Merchant reference (required on create)              |
| `depositId` / `deposits[].id` (UUID)                      | callback / payment                | One per on-chain deposit; same value under two names |
| `transactionId`                                           | deposits, refunds, withdrawals    | Blockchain transaction hash, not a Finrax ID         |
| `withdrawId` / `withdrawalId` (UUID)                      | API responses / callbacks and 202 | Same concept, two spellings                          |
| `clientWithdrawId` / `clientWithdrawalId` / `clientLabel` | 201 / callbacks / 202             | Merchant withdrawal reference, three spellings       |
| `businessId` (UUID)                                       | payment, withdrawal               | Merchant business                                    |

Parent links: deposit -> payment via `paymentId`; refund nested in its deposit; approval `withdrawalId` equals the later withdrawal ID (documented on the 202 schema).

## 8. Sensitive fields

`Authorization` header (`api-key`, `signature`), API secret, callback `Signature` header; `url` / `paymentUrl` (contain a `sessionToken` JWT that carries business, organisation and payment IDs); `initiatedBy` (dashboard user email); blockchain addresses (`walletAddress`, `depositAddress`, `fromAddress`, `toAddress`, `recipientAddress`, `toTxAddress`, refund `destinationAddress`) and `destinationTag`/`recipientTag`, which identify end users at exchanges; `transactionId` hashes (link to public chain data); `redirectUrl` (may carry merchant user IDs); `businessId`; AML results (`riskScore`, `addressRiskAssessment`, `txAddressOwner`).

## 9. Structural detection hints

- JSON with `paymentId` + `clientPaymentId` + `depositCurrency` + `displayCurrency` + `rateType` (`FIXED`/`FLOATING`) + `expectedDepositAmount`.
- Field families unique to Finrax: `*RateDepegLossAmount`, `*DistributedUserServiceFee`, `uniformCurrency`/`uniform*` (always EUR), `userServiceFeeDistributionPercentage`, `overpaymentPolicy`, `refundFollowUpDepositsForOneTimePayments`, `processorType: "BLOCKCHAIN"`.
- Withdrawal shapes: `withdrawId` + `clientWithdrawId` (API) or `withdrawalId` + `clientWithdrawalId` + `toTxAddress` + `txAddressOwner{name,category}` (callback).
- Error body with exactly `timestamp`, `httpStatus`, `httpError`, `message`, `path` (path starting `/api/v1/`).
- Header `Authorization: FRX-API api-key=...,signature=...,timestamp=...`.
- Versus supported providers: Stripe uses `object` and prefixed IDs; Adyen `pspReference`/`resultCode`; PayPal `event_type`/`resource`; Mollie `resource`/`_links`; none carry chain hashes, wallet addresses or `depositCurrency`. Versus other candidates: Trustly is JSON-RPC (`method`, `params`, `signature`, `uuid`); eZeeWallet, Inpay and DECTA have no crypto address or network fields.
- Caveat: because the docs are a multi-brand template, payloads from Finrax-powered brands may look identical; branding cannot be detected from payload fields.

## 10. Limitations and inconsistencies

1. No provider error codes; error diagnosis relies on HTTP status and free-text `message`.
2. No definitions for status values; several meanings above are inferred from names and marked as such.
3. Base URL not public; sandbox requires support to create an organisation.
4. Sandbox withdrawal statuses (`SENT`, `ABORTED`, `REJECTED`) do not match the API enum (`PENDING`, `COMPLETED`, `FAILED`, `BLOCKED`).
5. Withdrawal naming differs between API responses (`withdrawId`, `clientWithdrawId`), 202 response (`withdrawalId`, `clientLabel`) and callbacks (`withdrawalId`, `clientWithdrawalId`).
6. Callback schema says `deducedSettlementAmount`; the example uses `deductedSettlementAmount`.
7. Amount types differ: strings in API responses, numbers in the deposit callback.
8. The fetch-payment example JSON is invalid (missing comma before `depositReceivedAt`).
9. Withdrawal callback page says 9 payout cryptocurrencies; the `withdrawCurrency` enum lists 12.
10. Callback acknowledgment criteria, content type, header names, timestamp unit and ordering are NOT DOCUMENTED.
11. Request signature: element order, separator and output encoding (hex or Base64) are NOT DOCUMENTED.
12. Merchant sector eligibility, restricted jurisdictions and licensing details are not public; the EU CASP statement is the only regulatory limitation stated.

## 11. Proposed capability statuses

| Capability       | Proposed      | Justification                                                                                                                                                                                                                                     |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| errorDecoding    | **limited**   | Only 9 HTTP codes and a fixed error-body shape; diagnosis of payment problems must come from status/reason enums instead.                                                                                                                         |
| paymentResponses | **supported** | Complete OpenAPI schemas with enums and examples for payments, deposits, refunds and withdrawals.                                                                                                                                                 |
| webhookParsing   | **limited**   | Three callback shapes are documented with examples, but no event-type or event-ID field, undocumented header names, ack rules and content type, and naming inconsistencies.                                                                       |
| timeline         | **limited**   | Timestamps exist (`paymentInitiatedAt`, `paymentRequestedAt`, `depositReceivedAt`, refund `createdAt`/`initiatedAt`/`confirmedAt`, withdrawal `createdAt`), but callbacks fire only at final points and intermediate transitions are not evented. |
| correlation      | **supported** | Explicit IDs with documented links: `paymentId`/`clientPaymentId`, `depositId`, refund nested in deposit, approval ID equals withdrawal ID; alias handling needed for the withdrawal ID spellings.                                                |
