# High-risk provider research method

How a provider candidate for PandaPayLens is researched. The output is one file per provider: `docs/providers/high-risk/research/<id>.md`.

PandaPayLens is a local-first diagnostic tool. It parses payloads a developer pastes; it never calls a provider, never needs credentials and never processes payments. Research decides whether an adapter can give real diagnostic value from documented, offline-inspectable formats.

## Sources

- Use first-party sources only: the provider's own website, developer portal, API reference, official SDK repositories and official PDF guides.
- Do not log in, request access, sign up, or bypass access controls. If documentation is behind a merchant login, record that and stop there for that part.
- Do not use third-party blogs, forums or other providers' behavior as evidence.
- Record every URL you actually read and the date (2026-10-25).

## Qualification gate

Answer each item with **yes / no / unclear** and evidence (URL + short quote or paraphrase):

1. The company or product is currently active.
2. The relevant payment service is operational.
3. Official developer documentation is publicly or legitimately accessible (state which parts are public and which need a merchant login).
4. The specific API family/families and versions are identified.
5. Payment responses or notifications can be examined offline (documented formats and examples exist).
6. Supported merchant sectors are documented by the provider (quote the provider; do not infer).
7. Regional or regulatory limitations are identified.
8. An adapter would give actual diagnostic value (documented error codes, statuses, notifications).
9. The provider exposes its own technical formats and does not merely resell or white-label another gateway that PandaPayLens already supports or could support (name the underlying gateway if it does).
10. No live credentials or merchant relationship are needed to analyze the documented examples.

Gate outcome:

- `documentation_verified`: items 1-5, 8, 9, 10 are yes. Write the full technical specification below.
- `research_only`: documentation is partial, gated, or unclear. Write what is known and what is missing.
- `blocked`: the service is inactive, documentation is inaccessible, or the provider has no independent technical format (compatibility entry only).

## Classification

Choose all that apply, with evidence: `card_processing`, `acquiring`, `gateway`, `payment_facilitator`, `wallet`, `alternative_payment_method`, `orchestration`, `merchant_account_intermediary`. Do not call everything a PSP.

Sectors: list only sectors the provider itself documents (e.g. "adult", "iGaming", "subscription", "travel", "nutraceuticals", "crypto"), each with a source. Approval for one sector does not imply another. Never state that a provider accepts a sector unless the provider says so, and note that eligibility depends on jurisdiction, licensing and underwriting.

## Technical specification (when documentation_verified)

Same structure as the existing research files in `docs/providers/research/` (see `payabl.md` for an example):

1. Sources and verification date.
2. API families/versions in scope; which to implement first.
3. Response and error formats: exact field names, content type (JSON, form-encoded, XML, query string), 1-2 examples transcribed from docs with source URL.
4. Codes: every documented response/decline/error code with a short original paraphrase, suggested category (card_declined, authentication_required, authentication_failed, invalid_request, invalid_amount, insufficient_funds, payment_method_unavailable, fraud_or_risk, rate_limiting, provider_unavailable, network_or_timeout, duplicate_request, configuration, unknown) and retry class (do_not_retry, customer_action_required, retry_conditionally, safe_to_retry_technical_request, manual_review, unknown). Mark suggestions as suggestions.
5. Lifecycle: payment, subscription, rebill, cancellation, refund, chargeback, payout and wallet transfer states as documented. Keep wallet, gateway and card semantics separate.
6. Notifications/postbacks/webhooks: format, event types, fields, signature fields (sensitive), duplicate identification, retry and ordering behavior.
7. Identifiers: transaction, subscription, original/parent transaction, merchant reference.
8. Sensitive fields.
9. Structural detection hints that distinguish this provider from the already supported ones (Stripe, Adyen, payabl., Checkout.com, PayPal, Braintree, Mollie, Square) and from the other candidates.
10. Limitations, ambiguities and documentation inconsistencies.
11. Proposed capability statuses (supported/limited/experimental/unsupported) for errorDecoding, paymentResponses, webhookParsing, timeline, correlation, with justification.

## Writing rules

- Plain, factual English. Never use the em dash or en dash characters; use a plain hyphen.
- Do not copy whole proprietary code tables word for word; paraphrase meanings and link the source.
- Never invent a field, code or example. Write "NOT DOCUMENTED" where the docs are silent.
