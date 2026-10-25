# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-10-25

Wave 3 general providers.

### Providers

- New adapters with limited support, built from official documentation and tested with synthetic fixtures:
  - Paysafe: Payments API v1 resources, errors and webhooks, with merchant advice and ISO response codes.
  - Airwallex: PaymentIntents, attempts, refunds, disputes and payments webhooks; issuer codes are decoded with the card brand.
  - Rapyd: Merchant API responses and webhooks for payments, refunds, disputes and payouts.
  - dLocal: Payins payments, refunds, chargebacks and errors, and Payouts v3, with status codes decoded per object type.
  - EBANX: Pay-in Direct API responses and errors, notifications and payouts.
- Research for BlueSnap, PayU India, Razorpay, Paystack and Flutterwave; all five passed the documentation gate.
- 35 of 42 roadmap providers can now be analyzed.

### Security

- Redaction now covers Nuvei checksums, session tokens, card, 3-D Secure and payer fields (`advanceResponseChecksum`, `responsechecksum`, `checksum`, `sessionToken`, `userTokenId`, `ccCardNumber`, `last4Digits`, `MaskedCardNumber`, `cavv`, `acsUrl`, `cReq`, `ARN`, `AuthCode`, `ClientName`, `externalEmail`, `apmPayerInfo`).

## [0.6.0] - 2026-10-25

Wave 2 general providers.

### Providers

- New adapters with limited support, built from official documentation and tested with synthetic fixtures:
  - Worldpay (Access Worldpay JSON): Events webhooks, Payments API and Card Payments v7 responses, `errorName` errors and Payment Queries. Refusal codes are decoded with the Worldpay or raw scheme reading the payload supports.
  - Cybersource: REST Payments API responses and errors, the webhook envelope, Transaction Details and Pay by Bank payloads.
  - Authorize.net: JSON transaction responses with the API and transaction result layers decoded separately, and webhooks.
  - Nuvei: REST API 1.0 responses, payment and withdrawal DMNs and chargeback events, with codes decoded by field.
- 30 of 42 roadmap providers can now be analyzed.

### Fixed

- `MISSING_REFERENCE` no longer reports events that share a correlation group with other events, for example events linked by a transaction or root id instead of a payment id (rule catalog 2026.10.4).

### Security

- Redaction now covers Authorize.net card, track, credential and verification fields (`cardCode`, `expirationDate`, `track1`, `track2`, `tlvData`, `dataValue`, `cardholderAuthenticationValue`, `transactionKey`, `nameOnAccount`, `customerIP`, `PayerEmail`, `SecureAcceptanceUrl`, `transHash`, `transHashSha2`).

## [0.5.0] - 2026-10-25

### Providers

- Research for Worldpay (Access Worldpay JSON), Cybersource (REST Payments API), Authorize.net (JSON API and webhooks) and Nuvei (REST API 1.0 and DMNs). All four passed the documentation gate and are now listed as documentation verified.

### Analyzer

- HTTP error responses with a plain-text body keep the text (scrubbed, at most 500 characters) for adapters instead of failing as invalid JSON. HTML error pages keep their status code.
- DECTA decodes its documented plain-text error texts when DECTA is selected as the provider.

### Fixed

- `POSSIBLE_RETRY_RISK` no longer gives card-only advice for payouts and non-card payments. Card network penalties are mentioned only for card declines, and payouts get recipient-focused advice (rule catalog 2026.10.3).

## [0.4.0] - 2026-10-25

High-risk wave HR-3.

### Providers

- New adapters with limited support, built from official documentation and tested with synthetic fixtures:
  - Finrax: crypto payments, deposits, refunds and withdrawals. Underpaid payments stay an unknown outcome; approved withdrawals stay pending until completed.
  - Inpay: bank transfer payouts and pay-by-bank orders, with the documented payout reason codes.
  - DECTA: card orders, Host2Host and 3-D Secure responses and webhooks, with the raw acquirer code table and Mastercard advice codes.
  - Trustly: EU JSON-RPC notifications and errors and the North America event and transaction APIs, kept as separate platforms.
- All high-risk candidates with public documentation are now implemented. Pavilion Payments and Epoch remain blocked.
- 26 of 42 roadmap providers can now be analyzed.

### Analyzer

- JSON with trailing commas or comments, as in several providers' documentation examples, is accepted. Only those two things are removed, and a `LENIENT_JSON` warning says so; any other syntax error is still reported with its position.

## [0.3.0] - 2026-10-25

High-risk wave HR-2.

### Providers

- New adapters with limited support, built from official documentation and tested with synthetic fixtures: emerchantpay, Ecommpay, Paymentwall, NMI, MiFinity, AstroPay, Skrill, eZeeWallet.
- 22 of 42 roadmap providers can now be analyzed.

### Analyzer

- Form examples split over continuation lines that start with `&` are joined into one record.
- Form-encoded bodies labelled `text/plain` or `text/html` are parsed as forms.
- XML input returns a clear `UNSUPPORTED_FORMAT` error instead of a JSON parse error.
- `OUT_OF_ORDER_ARRIVAL` treats a record with several events (for example a status response listing past operations) as one snapshot (rule catalog 2026.10.2).

### Security

- The development dependency chain of `drizzle-kit` now uses a patched esbuild.

## [0.2.0] - 2026-10-25

High-risk wave HR-1.

### Providers

- New adapters with limited support, built from official documentation and tested with synthetic fixtures: CCBill, Segpay, Verotel, NETbilling, PXP Financial, Trust Payments.
- Research and qualification gate for all 20 high-risk candidates: 18 documentation verified, Pavilion Payments and Epoch blocked (no public developer documentation).
- Registry records business category, research status, documented sectors with sources, documentation access and fixture provenance.

### Analyzer

- Lifecycle rules: recurring payment failed, capture failed after authorization, chargeback reported, payout status, amount mismatch, refund pending (rule catalog 2026.10.1).
- Payout and subscription operations, subscription references and recurring flags.
- Input: GET callbacks with data in the query string, pasted callback URLs, request query parameters kept as redacted metadata, form values with spaces, error responses without a body, HTTP reason phrases.
- Date-times without a time zone are no longer read in the local time zone.

### Site

- New logo; the wordmark highlights PayLens as the product name.
- Provider directory with high-risk, gaming, subscription, wallet, pay-by-bank and gateway filters and research status badges.

## [0.1.0] - 2026-10-25

First public release.

### Analyzer

- Analysis engine with bounded parsing of JSON, JSON arrays, JSON Lines, URL-encoded form data and raw HTTP requests/responses.
- Structural provider detection with confidence scores, event normalization, correlation by explicit identifiers and deterministic diagnostic rules (rule catalog 2026.10.0).
- Error decoder with category, next step, retry guidance, confidence and documentation links.
- Timeline with event-time and receipt-order views and filters; missing events are never inferred.
- JSON, Markdown and PNG exports with identifiers masked by default.
- Redaction of sensitive fields and strict input limits; analysis runs in a Web Worker in the browser.

### Providers

- Supported: Stripe, Adyen.
- Limited (documented gaps listed on each provider page): payabl., Checkout.com, PayPal, Braintree, Mollie, Square.
- Public provider directory with per-capability status for all 22 roadmap providers; planned providers are not analyzed.

### Apps and tooling

- GitHub Pages demo at https://ratomirjovanovic.github.io/PandaPayLens/ built from the same pages and engine, with export verification and smoke/privacy tests before and after deployment.
- Full Next.js application for Vercel with an optional admin control plane: magic link sign-in, required passkey MFA, server-side RBAC, invitations, append-only audit log and rule drafts. Disabled unless configured.
- Offline CLI (`analyze`, `decode`, `timeline`, `providers`, `examples`) with a configurable failure threshold.

### Known limitations

- Webhook signatures are never verified; pasted webhooks are treated as unverified.
- Reports describe the supplied records only and do not confirm settlement.
- npm packages are not published yet.
