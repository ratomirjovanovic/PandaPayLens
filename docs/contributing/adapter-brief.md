# Adapter implementation rules

Read this before implementing a provider adapter. The Stripe and Adyen adapters are the reference implementations.

## Read first

- `packages/core/src/types.ts`: `ProviderAdapter`, `ProviderManifest`, `DeliveryProfile`, `NormalizedEventDraft`, `DecodedErrorDraft`, `LifecycleStage`, `ErrorCategory`, `RetryGuidance`, `Confidence`.
- `packages/core/src/adapter-kit.ts`: `safeText`, `safeId`, `minorUnits`, `upperCurrency`, `decimalToMinor`, `currencyExponent`. Use these; do not reimplement them.
- `packages/core/src/parse.ts`: `RecordMeta`. Form-encoded input arrives as a flat object of strings with `meta.format === "form"` (or `"http"` with `meta.http.contentType`). HTTP response status is in `meta.http.status`.
- `packages/adapters/stripe/src/{index,catalog,manifest}.ts` and `packages/adapters/adyen/src/*`: structure, detection scoring, Zod `looseObject` schemas, normalization, `decodeErrors`, `correlationKeys`.
- `packages/adapters/*/tests/*.test.ts` and `packages/rules/tests/helpers.ts`: test style.
- `docs/providers/research/<id>.md`: the verified research for your provider. Every code, status and field you implement must come from this file (which cites official documentation). Do not add anything that is not documented there.

## Package layout

```
packages/adapters/<id>/
  package.json, tsconfig.json   (already created; do not edit)
  src/manifest.ts               ProviderManifest + <ID>_ADAPTER_VERSION ("0.1.0")
  src/catalog.ts                error/status catalogs as data, with doc URLs
  src/index.ts                  adapter (detect, parse, normalize, decodeErrors, correlationKeys)
  tests/<id>.test.ts            vitest
fixtures/<id>/*.json|*.txt      synthetic fixtures
```

Export from `src/index.ts`: the adapter as `<id>Adapter` (camelCase, e.g. `payablAdapter`, `checkoutAdapter`) and as default, the manifest, the version constant, and the catalogs.

## Rules

1. **No invented data.** Codes, statuses, field names and event types must be in the research file. If something is "NOT DOCUMENTED", the adapter must not rely on it, and the manifest `limitations` must say so.
2. **Honest manifest.** Capability values are `supported | limited | experimental | unsupported`. Use the research file's proposal as an upper bound. If a capability is not covered by tests, it is at most `experimental`. Overall `status`: `supported` only if every capability is `supported`; otherwise `limited` (or `experimental` if any core path is untested). `verifiedAt: "2026-10-25"`. `wave: 1`. Fill `delivery` from documented webhook behavior (`ordering: "not_documented"` when the docs are silent). `samples: []` (samples are wired up later).
3. **Category and retry.** Map documented codes to `ErrorCategory` and `RetryGuidance`. Where the research marks a mapping as a suggestion, use `confidence: "strong"` at most for documented code meanings, `possible` for fallbacks, and `insufficient` for unknown codes. Never present a retry as safe when the original outcome is unknown: use `retry_conditionally` with an explanation to verify first.
4. **Semantics.** Preserve the provider's own status and operation. Use `stage` (`payment | authorization | authentication | capture | cancellation | void | refund | reversal | dispute | settlement | error | other`) and `outcome` (`success | failure | pending | unknown`). Authorization is not capture, capture is not settlement, a refund request is not a completed refund. Unknown statuses stay `unknown`.
5. **Detection.** Structural only, with confidence scores like the reference adapters. Never match on a provider name in a string. It must return confidence 0 for every Stripe and Adyen fixture in `fixtures/stripe` and `fixtures/adyen` (add a test for this), and must not claim generic shapes (for example a bare `{ "error": ... }` or `{ "status": ... }`) above 0.5 unless distinctive fields are present.
6. **Safe fields only.** Copy only allowlisted, non-sensitive fields into `attributes`. Never copy card numbers, CVC, expiry, names, emails, addresses, IPs, tokens, signatures, secrets, or raw free text from unknown fields. Run provider messages through `safeText`. Signature fields/headers are sensitive.
7. **Correlation.** `correlationKeys` returns only explicit identifiers that link events of the same payment (payment id, parent/original transaction id). Never merchant order references that can be reused across attempts. `deliveryKey` identifies a repeated delivery of the same notification, based on what the provider documents (event id, or a documented field combination). If no reliable key exists, leave it undefined and say so in limitations.
8. **Amounts.** Integer minor units as strings. Use `minorUnits` for integer amounts and `decimalToMinor` for decimal strings. Never use floats.
9. **No network, no storage, no eval.** Adapters only parse what they are given.
10. **Fixtures.** Synthetic only. Identifiers must contain `PPLsynth` or `PPLSYNTH` (e.g. `pay_PPLsynth...`). No real cardholder, merchant or customer data. Shapes follow the documentation; do not label them as official provider examples.
11. **Tests** (in `tests/<id>.test.ts`, run with `npx vitest run packages/adapters/<id>` from the repo root). Cover, where the provider documents the behavior: successful response, decline, validation error, authentication failure, timeout/unknown outcome, supported notification, duplicate delivery, missing required fields (parse issues, no throw), unsupported format/version (recognized but not analyzed, where applicable), malformed payload, unrecognized error code (honest `unknown`/`insufficient`), multiple related events in one group, unrelated transactions kept apart, sensitive-data redaction (planted values absent from `JSON.stringify(result.events)` and from `toJsonReport(result)`), detection does not fire on Stripe/Adyen fixtures. Use `analyzeText` / `analyzeRecords` from `@pandapaylens/core` with `adapters: [yourAdapter]`, `rules: defaultRules` from `@pandapaylens/rules`, `catalogVersion: "test"`. For form-encoded fixtures, pass the raw text to `analyzeText`.
12. **Style.** Match the reference adapters: strict TypeScript, no `any` except where the reference adapters use it, comments explain non-obvious decisions only. Never use the em dash or en dash characters anywhere (code, comments, strings, docs); use a plain hyphen.

## High-risk adapters

For providers from the high-risk roadmap (waves `HR-1`, `HR-2`, `HR-3`), the research file is in `docs/providers/high-risk/research/<id>.md` and these additional rules apply:

- Manifest: `wave: "HR-1"`, `"HR-2"` or `"HR-3"` as listed in the roadmap, `researchStatus: "tested"`, `categories` and `sectors` exactly as established in the research file (each sector with a first-party source URL), `documentationAccess` (`public`, `partial` or `merchant_login`), `fixtureProvenance` stating that fixtures are synthetic and, where the provider publishes no literal examples, that they were built from documented field tables. `regions` and `dependencies` where documented.
- Keep wallet, bank-transfer, card and subscription lifecycles separate. A wallet transfer approval is not a card authorization; a rebill is its own operation; a payout is its own operation.
- Subscription events (signup, rebill, cancellation, expiry, chargeback, refund) map to stages honestly: rebill success is a `payment`, cancellation is `cancellation`, chargeback is `dispute`, refund/credit is `refund`. Keep the provider's own event name in `eventType` and the subscription id in `relatedReference` or `paymentReference` as the research supports.
- Never claim why an acquirer declined or restricted a merchant unless the payload says so. Never suggest retries against documented provider or issuer guidance.
- Never treat a pasted postback or webhook as verified. Signature fields are sensitive and are never copied.

## Scope of an adapter pull request

Keep the adapter itself to `packages/adapters/<id>/` and `fixtures/<id>/`. Registering it (`packages/providers`), adding examples and updating docs are separate, small steps described in [add-provider.md](add-provider.md). If the adapter needs a change in `packages/core`, open an issue or a separate pull request for it first.

## Verify before finishing

From the repo root:

```
npx tsc -p packages/adapters/<id>/tsconfig.json --noEmit
npx vitest run packages/adapters/<id>
```

Both must pass. In the pull request, list the catalog entries, the capability statuses you chose and why, and any open questions about the documentation.
