# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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
