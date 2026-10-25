<p align="center"><img src="docs/logo.svg" width="96" alt="PandaPayLens logo: a panda with a magnifying lens"></p>

<h1 align="center">PandaPayLens</h1>

<p align="center">Decode payment errors. Visualize transaction events. Understand what went wrong.</p>

PandaPayLens is an open-source, local-first payment debugging tool. Paste a Stripe or Adyen error, webhook or event log and it explains the error, rebuilds the transaction timeline and points out duplicates, out-of-order deliveries, conflicting states and possible retry risks. Your data never leaves your browser.

**Live demo:** coming with the first release.

## Key features

- **Error decoder:** Stripe `code` / `decline_code` / `advice_code` and Adyen refusal reasons and result codes, each with an explanation, the next step, retry guidance, a confidence level and a link to the provider's docs.
- **Event timeline:** events grouped into transactions by explicit identifiers only, ordered by event time or by receipt order. Missing events are never invented.
- **Deterministic findings:** nine explainable rules, each with evidence, confidence and limitations. No AI in the diagnostic path.
- **Privacy by design:** analysis runs in a Web Worker in your browser, a strict CSP blocks requests to other origins, nothing is stored, and sensitive fields are hidden.
- **Exports:** JSON and Markdown reports and a PNG timeline. Identifiers are masked by default.
- **CLI and library:** the same engine runs offline in Node.js.

## Quick start

Requires Node.js 22+ and pnpm 10.

```bash
git clone https://github.com/ratomirjovanovic/PandaPayLens.git
cd PandaPayLens
pnpm install
pnpm dev            # http://localhost:3000
```

No database, account or API key is needed to run the analyzer.

## Supported providers

| Provider | Supported input                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Stripe   | API error responses, PaymentIntent snapshots, API v1 snapshot webhook events (PaymentIntent, Charge, Refund, Dispute) |
| Adyen    | Standard payment webhooks (`notificationItems`), payment responses (`resultCode`), API error responses                |

Stripe thin events and other Adyen webhook families are recognized and explained, but not analyzed yet. Details: [`/docs/providers`](apps/web/app/docs/providers/page.tsx).

## CLI

```bash
pnpm build:packages
node packages/cli/dist/bin.js analyze fixtures/stripe/out-of-order.json
node packages/cli/dist/bin.js decode - < error.json
node packages/cli/dist/bin.js analyze events.jsonl --format markdown
node packages/cli/dist/bin.js analyze log.json --fail-on medium
node packages/cli/dist/bin.js examples
```

Exit codes: `0` ok, `1` findings at or above `--fail-on`, `2` invalid input, `3` unsupported provider or format, `4` internal error. A declined payment does not fail the run unless you ask for it.

## Privacy and security

- Imported payloads are processed only in the browser and are not sent to any server, analytics or logging.
- `connect-src 'self'` in the Content Security Policy blocks requests to other origins.
- Nothing is written to cookies, localStorage, sessionStorage or IndexedDB; reloading clears the workspace.
- Card data, secrets, contact details and bank details are hidden and never exported. Redaction is best effort and does not guarantee anonymization.
- A Playwright privacy test plants unique marker values in the input and checks that none of them appear in any network request or in storage.

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## Architecture

```text
packages/core              parsing, detection, normalization, correlation, rules engine, redaction, reports
packages/adapters/stripe   Stripe schemas, error catalog, normalization
packages/adapters/adyen    Adyen schemas, refusal reasons, normalization
packages/rules             versioned diagnostic rule catalog
packages/cli               offline command-line interface
apps/web                   Next.js analyzer and documentation site
fixtures                   synthetic test data (no real payment data)
```

The core package has no dependency on React, Next.js, a database or the network. The web app and the CLI use it as a library.

## Development

```bash
pnpm test             # unit, property-based and scenario tests
pnpm test:coverage    # with coverage thresholds
pnpm typecheck
pnpm build
pnpm test:e2e         # Playwright (run `pnpm build` first)
```

## Contributing

Contributions are welcome, especially new fixtures, catalog entries and provider adapters. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Behavior changes need synthetic fixtures and tests.

## Roadmap

1. **Foundation and functional MVP:** analyzer, Stripe and Adyen adapters, rules, exports, CLI (in progress)
2. **Administration and hardening:** admin authentication with passkey step-up, rule-draft workflow, audit logs (planned)
3. **Public release:** published packages, live demo, tagged release
4. **Community expansion:** more providers and rules

## Maintainer

[Ratomir Jovanovic](https://github.com/ratomirjovanovic)

## License

[Apache License 2.0](LICENSE). PandaPayLens is not affiliated with Stripe or Adyen.
