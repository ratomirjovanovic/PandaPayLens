import type { Metadata } from "next";
import { ProviderDirectory } from "@/features/providers/ProviderDirectory";
import { directoryEntries } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Payment providers",
  description:
    "Which payment providers PandaPayLens can analyze, and how well: error decoding, API responses, webhooks, timelines and correlation for each provider, with documented limitations.",
  alternates: { canonical: "/providers" },
};

export default function ProvidersPage() {
  const entries = directoryEntries();
  const live = entries.filter((e) => e.status).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Payment providers</h1>
      <p className="mt-3 max-w-3xl text-fg-muted">
        {live} of {entries.length} providers on the roadmap can be analyzed today. Each adapter is
        built from the provider&apos;s official documentation and tested against synthetic fixtures.
        A capability is marked <em>supported</em> only when it is implemented and tested;{" "}
        <em>limited</em> means it works with documented gaps. Research candidates and other
        providers without an adapter are not analyzed yet.
      </p>
      <p className="mt-3 max-w-3xl text-sm text-fg-muted">
        High-risk candidates are research items until their documentation passes the qualification
        gate and an adapter is tested. PandaPayLens is a diagnostic tool, not a merchant account,
        referral, underwriting or approval service. Listing a provider implies no partnership or
        endorsement, and merchant eligibility always depends on the provider&apos;s own policies.
      </p>
      <div className="mt-8">
        <ProviderDirectory entries={entries} />
      </div>
    </div>
  );
}
