import type { Metadata } from "next";
import Link from "next/link";
import { MANIFESTS, ROADMAP } from "@pandapaylens/providers/manifests";
import { PandaMark } from "@/components/PandaMark";
import { StatusBadge } from "@/features/providers/ProviderDirectory";
import { REPO_URL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} - Open-Source Payment Error Decoder & Flow Visualizer` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    title: "Payment error decoder",
    body: "Error, decline and refusal codes explained with the next step, retry guidance, a confidence level and a link to the provider's documentation.",
  },
  {
    title: "Transaction timeline",
    body: "Webhooks and API objects grouped into transactions by explicit identifiers. Missing events are never invented.",
  },
  {
    title: "Deterministic findings",
    body: "Duplicate deliveries, out-of-order arrival, conflicting copies, state contradictions and possible duplicate charges, each with evidence and limitations.",
  },
  {
    title: "Local-first privacy",
    body: "Everything runs in your browser. Payloads are not uploaded, stored, logged or sent to analytics. Sensitive fields are hidden.",
  },
  {
    title: "Many input formats",
    body: "JSON, JSON Lines, URL-encoded notifications and raw HTTP requests or responses copied from your logs.",
  },
  {
    title: "CLI and library",
    body: "The same engine runs offline in Node.js: check webhook logs in CI or use the TypeScript packages in your own tools.",
  },
];

const JSON_SAMPLE = `{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "decline_code": "insufficient_funds"
  }
}`;

export default function Home() {
  const live = MANIFESTS.length;
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="grid items-center gap-10 py-14 md:grid-cols-[1.25fr_1fr] md:py-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-fg-muted">
            Open source · Apache-2.0 · {live} providers
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Understand what went wrong with your payments.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-fg-muted">
            Open-source payment error decoder and transaction flow visualizer. Analyze supported PSP
            responses, webhooks and payment events directly in your browser.
          </p>
          <p className="mt-3 text-sm font-medium text-fg-muted">
            No signup. No API keys. No payment processing. Local-first analysis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/analyze?sample=stripe-insufficient-funds"
              className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:opacity-90"
            >
              Try a failed payment
            </Link>
            <Link
              href="/analyze?sample=stripe-duplicate-webhook"
              className="rounded-lg border border-border bg-card px-5 py-2.5 font-medium hover:bg-bg-subtle"
            >
              Explore duplicate webhooks
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/analyze" className="text-accent underline underline-offset-2">
              Open the analyzer
            </Link>
            <Link href="/providers" className="text-fg-muted hover:text-fg">
              Explore providers
            </Link>
            <Link href="/docs" className="text-fg-muted hover:text-fg">
              Read the documentation
            </Link>
            <a href={REPO_URL} rel="noopener noreferrer" className="text-fg-muted hover:text-fg">
              View on GitHub
            </a>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <PandaMark size={56} title="PandaPayLens panda with a magnifying lens" />
              <div>
                <p className="font-semibold">Decoded error</p>
                <p className="text-xs text-fg-muted">Stripe · card_declined</p>
              </div>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">decline_code</dt>
                <dd className="font-mono">insufficient_funds</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Category</dt>
                <dd>Insufficient funds</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Retry</dt>
                <dd className="font-semibold text-warn">Customer action required</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted">
              Ask the customer to use an alternative payment method or try again later.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="grid gap-6 py-10 md:grid-cols-2">
        <div>
          <h2 id="how" className="text-2xl font-semibold">
            Paste it. Read it.
          </h2>
          <p className="mt-3 text-fg-muted">
            Paste an API error, a webhook body or an event log. PandaPayLens detects the provider
            and format, decodes errors, groups related events into transactions and runs
            deterministic checks. It shows what the records say and states clearly what they cannot
            prove, such as settlement or whether your application processed a webhook twice.
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-fg-muted">
            <li>Paste JSON or form data, or drop files.</li>
            <li>Analyze. The provider and format are detected automatically.</li>
            <li>Read the decoded error, the timeline and the findings.</li>
            <li>Export a JSON or Markdown report with identifiers masked.</li>
          </ol>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-border bg-code p-4 font-mono text-sm leading-relaxed">
          <code>{JSON_SAMPLE}</code>
        </pre>
      </section>

      {/* Features */}
      <section aria-labelledby="features" className="py-10">
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

      {/* Providers */}
      <section aria-labelledby="providers" className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="providers" className="text-2xl font-semibold">
            Provider support
          </h2>
          <Link href="/providers" className="text-sm text-accent underline underline-offset-2">
            All {ROADMAP.length} providers on the roadmap
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-fg-muted">
          A provider is listed here only when its adapter is implemented and tested.{" "}
          <em>Limited</em> means it works with documented gaps.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-fg-muted">
              <tr>
                {["Provider", "Overall", "Errors", "Responses", "Webhooks", "Timeline"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MANIFESTS.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/providers/${m.id}`} className="font-medium hover:text-accent">
                      {m.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={m.capabilities.errorDecoding} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={m.capabilities.paymentResponses} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={m.capabilities.webhookParsing} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={m.capabilities.timeline} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Privacy */}
      <section aria-labelledby="privacy" className="grid gap-6 py-10 md:grid-cols-2">
        <div>
          <h2 id="privacy" className="text-2xl font-semibold">
            Your payment data stays on your machine
          </h2>
          <p className="mt-3 text-fg-muted">
            Analysis runs in a Web Worker in your browser. The page&apos;s Content Security Policy
            only allows requests to this site, nothing you paste is stored, and reloading clears it.
            Card data, secrets and contact details are hidden in the inspector and never exported.
          </p>
          <Link
            href="/docs/security"
            className="mt-3 inline-block text-sm text-accent underline underline-offset-2"
          >
            How privacy is enforced and tested
          </Link>
        </div>
        <ul className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm">
          <li>No account and no provider API keys.</li>
          <li>No analytics, session replay or third-party scripts.</li>
          <li>Pasted webhooks are never treated as verified.</li>
          <li>Reports describe the supplied records only; they do not confirm settlement.</li>
        </ul>
      </section>

      {/* Install and CLI */}
      <section aria-labelledby="install" className="grid gap-6 py-10 md:grid-cols-2">
        <div>
          <h2 id="install" className="text-2xl font-semibold">
            Run it yourself
          </h2>
          <p className="mt-3 text-fg-muted">
            Self-host the analyzer without a database, or use the same engine from the command line.
            Exit codes let you fail a CI check on findings above a severity you choose.
          </p>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-border bg-code p-4 font-mono text-sm leading-relaxed">
          <code>{`git clone ${REPO_URL}.git
cd PandaPayLens
pnpm install
pnpm dev:pages

# CLI
pnpm build:packages
node packages/cli/dist/bin.js analyze events.json`}</code>
        </pre>
      </section>

      {/* Contribute */}
      <section aria-labelledby="contribute" className="py-10">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 id="contribute" className="text-2xl font-semibold">
            Help add the next provider
          </h2>
          <p className="mt-3 max-w-3xl text-fg-muted">
            Every adapter is built from official documentation, with synthetic fixtures and tests.
            The contribution guide walks through research, implementation and the definition of
            done. Bug reports, fixtures and documentation fixes are just as welcome.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`${REPO_URL}/blob/main/docs/contributing/add-provider.md`}
              rel="noopener noreferrer"
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg hover:opacity-90"
            >
              Add a provider
            </a>
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-bg-subtle"
            >
              Contributing guide
            </a>
            <a
              href={`${REPO_URL}/issues`}
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 font-medium text-fg-muted hover:text-fg"
            >
              Report a bug
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="not" className="pb-10 pt-4">
        <h2 id="not" className="text-xl font-semibold">
          What it is not
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-fg-muted">
          PandaPayLens does not process payments, connect to provider accounts, receive live
          webhooks, verify webhook signatures or confirm that money settled. It is not affiliated
          with any payment provider.
        </p>
      </section>
    </div>
  );
}
