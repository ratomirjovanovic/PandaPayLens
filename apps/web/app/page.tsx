import Link from "next/link";
import { PandaMark } from "@/components/PandaMark";
import { REPO_URL, SITE_TAGLINE } from "@/lib/site";

const FEATURES = [
  {
    title: "Payment error decoder",
    body: "Stripe codes, decline codes and advice codes, and Adyen refusal reasons and result codes, explained with a next step, retry guidance and a confidence level.",
  },
  {
    title: "Event timeline",
    body: "Rebuild the sequence of webhooks and API objects for each transaction, linked only by explicit identifiers. Missing events are never invented.",
  },
  {
    title: "Deterministic findings",
    body: "Duplicate deliveries, out-of-order arrival, conflicting copies, terminal-state violations and possible duplicate charges, each with evidence and limitations.",
  },
  {
    title: "Local-first privacy",
    body: "Analysis runs in your browser. Payloads are not uploaded, stored, logged or sent to analytics. Card data and secrets are hidden by default.",
  },
  {
    title: "Exports",
    body: "Download a JSON or Markdown diagnostic report, or a PNG of the timeline. Identifiers are masked unless you opt in.",
  },
  {
    title: "CLI and library",
    body: "The same engine runs in Node.js: pipe files through the CLI in CI, or use the TypeScript packages in your own tools.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-fg-muted">
            Open source · Apache-2.0 · Stripe and Adyen
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{SITE_TAGLINE}</h1>
          <p className="mt-5 max-w-xl text-lg text-fg-muted">
            PandaPayLens turns raw payment errors and webhook logs into a readable explanation and a
            transaction timeline, without sending your data anywhere.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:opacity-90"
            >
              Open the analyzer
            </Link>
            <Link
              href="/examples"
              className="rounded-lg border border-border bg-card px-5 py-2.5 font-medium hover:bg-bg-subtle"
            >
              Try an example
            </Link>
            <a
              href={REPO_URL}
              rel="noopener noreferrer"
              className="rounded-lg px-5 py-2.5 font-medium text-fg-muted hover:text-fg"
            >
              View source →
            </a>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="relative rounded-3xl border border-border bg-card p-8 shadow-sm">
            <PandaMark size={180} title="PandaPayLens panda with a magnifying lens" />
            <div className="mt-6 space-y-2 font-mono text-xs">
              <p>
                <span className="text-fg-muted">decline_code</span> insufficient_funds
              </p>
              <p className="text-warn">→ customer action required</p>
              <p>
                <span className="text-fg-muted">DUPLICATE_DELIVERY</span>{" "}
                <span className="text-fg-muted">info</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features" className="py-8">
        <h2 id="features" className="text-2xl font-semibold">
          What it does
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cli" className="grid gap-6 py-12 md:grid-cols-2">
        <div>
          <h2 id="cli" className="text-2xl font-semibold">
            Same engine on the command line
          </h2>
          <p className="mt-3 text-fg-muted">
            No login, no network access, no telemetry. Exit codes let you fail a CI check on
            findings above a severity you choose; a declined payment alone never fails the run.
          </p>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-border bg-code p-4 font-mono text-sm leading-relaxed">
          <code>{`$ pandapaylens analyze webhooks.jsonl
$ pandapaylens decode error.json -f markdown
$ cat events.json | pandapaylens timeline -
$ pandapaylens analyze log.json --fail-on medium`}</code>
        </pre>
      </section>

      <section aria-labelledby="not" className="py-8">
        <h2 id="not" className="text-2xl font-semibold">
          What it is not
        </h2>
        <p className="mt-3 max-w-3xl text-fg-muted">
          PandaPayLens does not process payments, connect to your provider account, receive live
          webhooks or confirm that money settled. It explains the records you give it, and says
          clearly when those records are not enough to draw a conclusion.
        </p>
      </section>
    </div>
  );
}
