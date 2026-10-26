# pandapaylens

Offline payment error decoder and transaction timeline. Paste or pipe an API response, a webhook, a log line or an export from Stripe, Adyen, PayPal, Worldpay, Checkout.com and other supported providers. PandaPayLens explains the error, orders the events, links them into transactions and points out problems such as repeated deliveries, out-of-order webhooks and unresolved outcomes.

Nothing is sent over the network. There is no login, telemetry or API key.

- Website and browser version: https://ratomirjovanovic.github.io/PandaPayLens/
- 60 second demo video: https://ratomirjovanovic.github.io/PandaPayLens/media/pandapaylens-demo.mp4
- Supported providers and their limits: https://ratomirjovanovic.github.io/PandaPayLens/providers/
- Source, issues and changelog: https://github.com/ratomirjovanovic/PandaPayLens

Requires Node.js 22 or later.

## Command line

```bash
npx pandapaylens analyze events.json
npx pandapaylens decode - < error.json
npx pandapaylens timeline webhooks.jsonl --format markdown
npx pandapaylens analyze log.json --fail-on medium    # exit 1 on medium or worse
npx pandapaylens examples                             # bundled synthetic samples
npx pandapaylens providers --supported
```

Input may be JSON, a JSON array, JSON Lines, URL-encoded form data, XML, `name: value` text, a raw HTTP request or response, or a callback URL. Use `-` for stdin. Payment and event identifiers are masked unless you pass `--include-identifiers`; card data and secrets are never printed.

Exit codes: `0` ok, `1` findings at or above `--fail-on`, `2` invalid input, `3` unsupported provider or format, `4` internal error.

## Library

```ts
import { analyze, toMarkdownReport } from "pandapaylens";

const r = analyze(text); // or analyze(text, { provider: "adyen" })
if (r.ok) {
  for (const e of r.result.errors) console.log(e.code, e.explanation, e.retry);
  console.log(toMarkdownReport(r.result));
} else {
  console.error(r.error.message);
}
```

`analyze` uses every adapter and the default rules. The engine (`analyzeText`), the adapter registry (`ADAPTERS`, `MANIFESTS`), the rules (`defaultRules`) and the report helpers are exported as well, with TypeScript types.

## Limits

Results are diagnostics, not proof: pasted webhooks are never treated as verified, and no report confirms that money moved. Provider coverage differs; each provider page lists what is and is not supported.

## License

Apache-2.0
