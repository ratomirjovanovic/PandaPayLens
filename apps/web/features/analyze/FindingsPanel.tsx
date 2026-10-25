"use client";

import { useMemo, useState } from "react";
import type { AnalysisResult, Severity } from "@pandapaylens/core";
import { CONFIDENCE_LABEL, SEVERITY_CLASS, SEVERITY_LABEL } from "./labels";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export function FindingsPanel({
  result,
  onShowEvidence,
}: {
  result: AnalysisResult | null;
  onShowEvidence: (eventIds: string[]) => void;
}) {
  const [severity, setSeverity] = useState<Severity | "">("");
  const [rule, setRule] = useState("");
  const findings = useMemo(
    () =>
      (result?.findings ?? []).filter(
        (f) => (!severity || f.severity === severity) && (!rule || f.ruleId === rule),
      ),
    [result, severity, rule],
  );
  const rules = useMemo(
    () => [...new Set((result?.findings ?? []).map((f) => f.ruleId))],
    [result],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 id="findings-heading" className="text-base font-semibold">
          Findings
        </h2>
        {!result ? (
          <p className="mt-2 text-sm text-fg-muted">
            Deterministic checks for duplicates, ordering, missing references, state inconsistencies
            and retry risks will appear here.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
                Severity
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity | "")}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
                >
                  <option value="">All</option>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
                Rule
                <select
                  value={rule}
                  onChange={(e) => setRule(e.target.value)}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
                >
                  <option value="">All</option>
                  {rules.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-fg-muted" aria-live="polite">
              {findings.length} of {result.findings.length} finding(s)
            </p>
          </>
        )}
      </div>

      {findings.map((f, i) => (
        <article
          key={`${f.ruleId}-${i}`}
          className="rounded-xl border border-border bg-card p-4 text-sm"
        >
          <header className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase ${SEVERITY_CLASS[f.severity]}`}
            >
              {SEVERITY_LABEL[f.severity]}
            </span>
            <h3 className="font-semibold">{f.title}</h3>
          </header>
          <p className="mt-2 leading-relaxed">{f.explanation}</p>
          {f.recommendedAction && (
            <p className="mt-2">
              <span className="font-medium">Next step: </span>
              {f.recommendedAction}
            </p>
          )}
          {f.limitations.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-fg-muted">
              {f.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <footer className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span className="font-mono">
              {f.ruleId} v{f.ruleVersion}
            </span>
            <span>· {CONFIDENCE_LABEL[f.confidence]}</span>
            {f.evidenceEventIds.length > 0 && (
              <button
                type="button"
                onClick={() => onShowEvidence(f.evidenceEventIds)}
                className="ml-auto rounded border border-border px-2 py-0.5 text-accent hover:bg-accent-soft"
              >
                Show {f.evidenceEventIds.length} event(s)
              </button>
            )}
            {f.documentationUrl &&
              /^https:\/\/docs\.(stripe|adyen)\.com\//.test(f.documentationUrl) && (
                <a
                  href={f.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  Docs ↗
                </a>
              )}
          </footer>
        </article>
      ))}

      {result && result.warnings.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 p-4 text-sm">
          <h3 className="font-semibold text-warn">Input warnings</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono text-warn">{w.code}</span>
                {w.recordIndex !== undefined && (
                  <span className="text-fg-muted"> · record {w.recordIndex + 1}</span>
                )}
                <span className="block text-fg">{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
