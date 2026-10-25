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

## Workflow

Every change goes through a pull request, including the maintainer's own.

1. **Start from an issue.** Search existing issues first. If none fits, open one with the problem, a proposed solution and acceptance criteria. Small typo fixes can skip this step.
2. **Create one branch per issue** from an up-to-date `main`, named `<type>/<issue>-<short-description>`.
3. **Commit in small, meaningful steps.** The first line says what the commit does in the imperative mood ("Add Trustly payout statuses"), at most about 72 characters. Add a body when the reason is not obvious.
4. **Run the checks locally** (see below) before you open the pull request.
5. **Open a pull request** that links the issue with `Closes #<number>` and fills in the template.
6. **Review and merge.** CI must pass. The maintainer reviews and squash-merges it. The issue closes and the branch is deleted automatically.

### Branch names

| Prefix      | Use for                                       | Example                        |
| ----------- | --------------------------------------------- | ------------------------------ |
| `feat/`     | new analyzer, CLI or site features            | `feat/4-cli-output-file`       |
| `provider/` | new or improved provider adapters             | `provider/12-trustly`          |
| `fix/`      | bug fixes                                     | `fix/15-skrill-padded-codes`   |
| `docs/`     | documentation only                            | `docs/8-contribution-workflow` |
| `chore/`    | tooling, templates, dependencies, CI          | `chore/7-issue-forms`          |
| `security/` | hardening (vulnerabilities go to SECURITY.md) | `security/20-csp-report-only`  |

### Checks before a pull request

```bash
pnpm typecheck
pnpm format:check
pnpm test
pnpm build:pages && pnpm --filter @pandapaylens/pages run test:e2e   # UI changes
```

CI runs the same checks plus the full app build, end-to-end and privacy tests, and CodeQL.

## Pull requests

- Keep PRs focused: one issue, one concern.
- Describe what changed and how you verified it, and add screenshots for UI changes.
- Use the PR template checklist.

## Releases

PandaPayLens follows [Semantic Versioning](https://semver.org/). Each release is tagged, listed in [CHANGELOG.md](CHANGELOG.md) and published as a GitHub Release. Planned work is in [ROADMAP.md](ROADMAP.md).

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please don't open public issues for vulnerabilities.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
