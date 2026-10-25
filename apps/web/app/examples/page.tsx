import type { Metadata } from "next";
import Link from "next/link";
import { SAMPLES } from "@/lib/samples";

export const metadata: Metadata = {
  title: "Example payment scenarios",
  description:
    "Synthetic Stripe and Adyen examples: declines, 3D Secure, duplicate webhooks, out-of-order events, captures and refunds, and possible duplicate charges.",
  alternates: { canonical: "/examples" },
};

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Examples</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">
        Every example uses synthetic identifiers and values. None contain real cardholder, merchant
        or customer data. Open one in the analyzer to see the decoder, timeline and findings.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {SAMPLES.map((s) => (
          <li key={s.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                {s.provider ?? "mixed / unknown"}
              </span>
            </div>
            <h2 className="mt-2 font-semibold">{s.title}</h2>
            <p className="mt-1 flex-1 text-sm text-fg-muted">{s.description}</p>
            <Link
              href={`/analyze?sample=${s.id}`}
              className="mt-4 self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
            >
              Open in analyzer →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
