# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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
