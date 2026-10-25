"use client";

import { useState } from "react";
import type { RecordSummary, SourceSummary } from "@pandapaylens/core";

/**
 * Shows the imported records after redaction. Values are rendered as text
 * by React; nothing from the payload is ever interpreted as HTML.
 */
export function InspectorView({
  records,
  sources,
  summaries,
}: {
  records: unknown[];
  sources: SourceSummary[];
  summaries: RecordSummary[];
}) {
  const [index, setIndex] = useState(0);
  const record = records[index];
  const summary = summaries[index];
  const source = sources.find(
    (s) => index >= s.recordStart && index < s.recordStart + s.recordCount,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          Record
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
          >
            {records.map((_, i) => (
              <option key={i} value={i}>
                {i + 1} · {summaries[i]?.format ?? "unrecognized"}
              </option>
            ))}
          </select>
        </label>
        {summary && (
          <p className="text-xs text-fg-muted">
            {source?.name} · status <span className="font-medium text-fg">{summary.status}</span>
            {summary.provider && ` · ${summary.provider}`} · detection confidence{" "}
            {Math.round(summary.confidence * 100)}%
          </p>
        )}
      </div>
      {summary && summary.reasons.length > 0 && (
        <ul className="list-disc rounded-xl border border-border bg-card py-2 pl-8 pr-3 text-xs text-fg-muted">
          {summary.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-fg-muted">
        Sensitive fields (card data, secrets, contact details, addresses, bank details) are hidden.
        Automatic detection is best effort and not a guarantee of anonymization.
      </p>
      <pre className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-code p-4 font-mono text-xs leading-relaxed">
        {JSON.stringify(record, null, 2)}
      </pre>
    </div>
  );
}
