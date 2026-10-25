# Adding a payment provider

This guide covers everything needed to add a new PSP adapter to PandaPayLens. Read [adapter-brief.md](adapter-brief.md) for the detailed implementation rules; this page is the end-to-end checklist.

## 0. Open an issue

Use the "New provider adapter" issue template. Name the API families you want to support and link the official documentation.

## 1. Research the official documentation

Create `docs/providers/research/<id>.md` with:

- every documentation URL you read and the date,
- API families and versions in scope,
- exact error and response formats (field names, content type: JSON, form-encoded, XML),
- documented error and decline codes with a short paraphrase in your own words,
- payment lifecycle statuses and what they mean (authorized vs captured vs settled),
- webhook/notification format, event types, duplicate and ordering behavior, signature fields,
- identifiers and how refunds/captures link to the payment,
- sensitive fields that appear in payloads,
- structural detection hints and known limitations.

Use first-party documentation only. If something is not documented, write "NOT DOCUMENTED". Do not copy whole proprietary code tables verbatim; paraphrase and link.

## 2. Create the package

```
packages/adapters/<id>/
  package.json        name @pandapaylens/<id>, depends on @pandapaylens/core and zod
  tsconfig.json       extends ../../../tsconfig.base.json
  src/manifest.ts     ProviderManifest
  src/catalog.ts      codes and statuses as data, with documentation links
  src/index.ts        the adapter
  tests/<id>.test.ts
fixtures/<id>/        synthetic payloads
```

Use `packages/adapters/stripe` and `packages/adapters/adyen` as references. Shared helpers live in `@pandapaylens/core` (`safeText`, `safeId`, `minorUnits`, `decimalToMinor`, `toIsoTimestamp`); do not duplicate them.

## 3. Implement

- **Detection:** structural, with a confidence score. Never match on a provider name. Must not fire on other providers' fixtures.
- **Parsing:** Zod schemas, tolerant of unknown fields. Never throw; return issues instead.
- **Normalization:** preserve the provider's status and operation type. Never invent events or states. Copy only allowlisted, non-sensitive fields.
- **Error decoding:** documented codes only. Unknown codes stay `unknown` with confidence `insufficient`. Never present a retry as safe when the original outcome is unknown.
- **Correlation:** only explicit identifiers that link events of the same payment.
- **Manifest:** honest capability statuses (`supported`, `limited`, `experimental`, `unsupported`), documented limitations, and the provider's delivery behavior.

## 4. Fixtures and tests

Synthetic data only (`PPLsynth`/`PPLSYNTH` identifiers). Cover success, decline, validation error, authentication failure, unknown outcome, notifications, duplicates, missing fields, unsupported formats, malformed input, unknown codes, related and unrelated events, and redaction. Run:

```
npx tsc -p packages/adapters/<id>/tsconfig.json --noEmit
npx vitest run packages/adapters/<id>
```

## 5. Register

- Add the adapter to `packages/providers/src/index.ts` and its manifest to `packages/providers/src/manifests.ts`.
- Add the dependency to `packages/providers/package.json` and the test aliases to `vitest.config.ts`.
- Add examples to `fixtures/samples.json` and the loader map in `apps/web/lib/samples.ts`, and list their ids in the manifest `samples`.
- The registry tests and the cross-provider detection test must pass: `pnpm test`.

## 6. Document

Update the provider table in `README.md` and `CHANGELOG.md`. The public page `/providers/<id>` is generated from the manifest.

## Definition of done

A provider counts as implemented only when the documentation has been reviewed, its formats are recognized and parsed, documented errors are classified, events are normalized with references extracted, unknown events are handled safely, sensitive fields are protected, fixtures and tests pass, CLI behavior is verified and the manifest is accurate. A provider may ship with limited capabilities when the limits are listed.
