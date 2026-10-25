# Contributing to PandaPayLens

Thanks for helping. PandaPayLens values correctness and trust over feature count, so contributions are reviewed with that in mind.

## Setup

```bash
pnpm install
pnpm build:packages
pnpm test
pnpm dev
```

Node.js 22+ and pnpm 10 are required.

## Ground rules

- **Synthetic data only.** Never commit real card numbers, customer details, merchant identifiers or credentials. Fixture identifiers should contain `PPLsynth` / `PPLSYNTH`.
- **Behavior changes need fixtures and tests.** An adapter or rule change without a fixture that shows the behavior will not be merged.
- **Cite provider documentation** for every new error code, event type or state rule.
- **Keep observations and inferences separate.** Rules must state their limitations and must not use `high` or `critical` severity without strong evidence.
- **No network, storage or dynamic code** in `packages/core`, adapters or rules.
- **Payment identifiers stay out of finding text.** Reference evidence by event id so masking works.

## Where things live

| Change                              | Location                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Parsing, limits, redaction, reports | `packages/core/src`                                                            |
| Stripe error codes and events       | `packages/adapters/stripe/src`                                                 |
| Adyen refusal reasons and webhooks  | `packages/adapters/adyen/src`                                                  |
| Diagnostic rules                    | `packages/rules/src`                                                           |
| Fixtures                            | `scripts/generate-fixtures.mjs`, then run `node scripts/generate-fixtures.mjs` |
| Web UI                              | `apps/web`                                                                     |

## Adding a provider

Open a `new-provider` issue first. A new adapter needs:

1. Zod schemas for each supported input family.
2. Structural detection with confidence scores (never just a name match).
3. Normalization that keeps provider-specific meaning and copies only allowlisted fields.
4. An error catalog with documentation links.
5. Explicit correlation and duplicate-delivery keys.
6. Fixtures: valid, missing optional fields, unknown fields, duplicates, out-of-order, unsupported types.
7. Docs and supported-version notes.

## Pull requests

- Keep PRs focused.
- `pnpm test`, `pnpm typecheck` and `pnpm build` must pass.
- Describe what changed and how you verified it.
- Use the PR template checklist.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please don't open public issues for vulnerabilities.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
