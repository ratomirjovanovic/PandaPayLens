import Link from "next/link";
import type { RecordSummary } from "@pandapaylens/core";
import { MANIFESTS } from "@pandapaylens/providers/manifests";

const confidenceLabel = (c: number) => (c >= 0.9 ? "high" : c >= 0.7 ? "medium" : "low");

/** Which provider and format each group of records was recognized as. */
export function DetectionSummary({
  records,
  onAnalyzeAs,
}: {
  records: RecordSummary[];
  /** Re-runs the analysis with a manually chosen provider. */
  onAnalyzeAs?: (providerId: string) => void;
}) {
  const groups = new Map<
    string,
    {
      provider: string | null;
      format: string | null;
      status: string;
      count: number;
      confidence: number;
    }
  >();
  for (const r of records) {
    const key = `${r.provider}|${r.format}|${r.status}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      g.confidence = Math.min(g.confidence, r.confidence);
    } else {
      groups.set(key, {
        provider: r.provider,
        format: r.format,
        status: r.status,
        count: 1,
        confidence: r.confidence,
      });
    }
  }
  return (
    <ul aria-label="Detected input" className="flex flex-wrap gap-2 text-xs">
      {[...groups.values()].map((g) => {
        const m = g.provider ? MANIFESTS.find((x) => x.id === g.provider) : undefined;
        const family = m?.apiFamilies.find((f) => f.id === g.format);
        const ok = g.status === "analyzed";
        // A provider matched below the automatic threshold: offer to use it.
        const suggest = !ok && g.status === "unsupported" && m && g.confidence > 0 && onAnalyzeAs;
        return (
          <li
            key={`${g.provider}|${g.format}|${g.status}`}
            className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1 ${ok ? "border-border bg-card" : "border-warn/40 bg-warn/10"}`}
          >
            <span className="font-semibold">{m?.displayName ?? g.provider ?? "Unknown"}</span>
            {g.format && <code className="text-fg-muted">{g.format}</code>}
            <span className="text-fg-muted">
              {g.count} record(s) · {ok ? `${confidenceLabel(g.confidence)} confidence` : g.status}
            </span>
            {family && family.status !== "supported" && (
              <span className="text-warn">{family.status} support</span>
            )}
            {suggest && (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-fg-muted">
                  Looks like {m.displayName}, but the record alone does not prove it.
                </span>
                <button
                  type="button"
                  onClick={() => onAnalyzeAs(m.id)}
                  className="rounded-md border border-accent/40 px-2 py-0.5 font-medium text-accent hover:bg-accent/10"
                >
                  Analyze as {m.displayName}
                </button>
              </span>
            )}
            {m && (
              <Link
                href={`/providers/${m.id}`}
                className="text-accent underline underline-offset-2"
              >
                capabilities
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
