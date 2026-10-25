import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MANIFESTS, ROADMAP } from "@pandapaylens/providers/manifests";
import { DocPage } from "@/components/DocPage";
import { StatusBadge } from "@/features/providers/ProviderDirectory";
import { SAMPLES } from "@/lib/samples";

const CAPABILITY_LABELS = {
  errorDecoding: "Error decoding",
  paymentResponses: "API response parsing",
  webhookParsing: "Webhook / notification parsing",
  timeline: "Timeline",
  correlation: "Event correlation",
  diagnosticRules: "Diagnostic rules",
} as const;

export function generateStaticParams() {
  return ROADMAP.map((r) => ({ id: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const m = MANIFESTS.find((x) => x.id === id);
  const r = ROADMAP.find((x) => x.id === id);
  if (!r) return {};
  if (!m) {
    // Planned providers have no useful content yet; keep them out of search results.
    return { title: `${r.displayName} (planned)`, robots: { index: false, follow: true } };
  }
  return {
    title: `${m.displayName} payment error decoder and webhook analyzer`,
    description: `Decode ${m.displayName} payment errors and analyze ${m.displayName} notifications locally: supported formats, capabilities and documented limitations.`,
    alternates: { canonical: `/providers/${m.id}` },
  };
}

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = ROADMAP.find((x) => x.id === id);
  if (!r) notFound();
  const m = MANIFESTS.find((x) => x.id === id);

  if (!m) {
    return (
      <DocPage title={r.displayName} lead="Planned for a later release.">
        <p>
          PandaPayLens does not analyze {r.displayName} payloads yet. It is part of wave {r.wave} of
          the provider roadmap. {r.note}
        </p>
        <p>
          Until the adapter is implemented and tested, {r.displayName} input is reported as an
          unsupported format rather than guessed. See <Link href="/providers">all providers</Link>.
        </p>
      </DocPage>
    );
  }

  const samples = SAMPLES.filter((s) => m.samples.includes(s.id));
  return (
    <DocPage
      title={`${m.displayName}`}
      lead={`Adapter ${m.version}, documentation reviewed ${m.verifiedAt}. Overall status: ${m.status}.`}
    >
      <h2>Capabilities</h2>
      <table>
        <tbody>
          {(Object.keys(CAPABILITY_LABELS) as (keyof typeof CAPABILITY_LABELS)[]).map((k) => (
            <tr key={k}>
              <td>{CAPABILITY_LABELS[k]}</td>
              <td>
                <StatusBadge status={m.capabilities[k]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Supported input</h2>
      <table>
        <thead>
          <tr>
            <th>Format</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {m.apiFamilies.map((f) => (
            <tr key={f.id}>
              <td>
                <code>{f.id}</code>
              </td>
              <td>{f.description}</td>
              <td>
                <StatusBadge status={f.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Notification delivery</h2>
      <ul>
        <li>
          Repeated deliveries are recognized by <strong>{m.delivery.duplicateKey}</strong>
          {m.delivery.duplicatesDocumented
            ? `; ${m.displayName} documents that notifications can be delivered more than once.`
            : "."}
        </li>
        <li>
          Delivery order:{" "}
          {m.delivery.ordering === "not_guaranteed"
            ? "not guaranteed by the provider."
            : "not documented by the provider."}
        </li>
        <li>{m.delivery.dedupeAdvice}</li>
      </ul>

      {m.limitations.length > 0 && (
        <>
          <h2>Known limitations</h2>
          <ul>
            {m.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}

      {samples.length > 0 && (
        <>
          <h2>Examples</h2>
          <ul>
            {samples.map((s) => (
              <li key={s.id}>
                <Link href={`/analyze?sample=${s.id}`}>{s.title}</Link>: {s.description}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Provider documentation</h2>
      <ul>
        {m.documentation.map((d) => (
          <li key={d.url}>
            <a href={d.url} target="_blank" rel="noopener noreferrer">
              {d.title}
            </a>
          </li>
        ))}
      </ul>
      <p>
        PandaPayLens is not affiliated with {m.displayName}. Pasted notifications are never treated
        as verified: PandaPayLens does not check webhook signatures.
      </p>
    </DocPage>
  );
}
