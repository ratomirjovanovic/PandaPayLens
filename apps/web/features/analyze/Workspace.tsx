"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_LIMITS,
  DEFAULT_SESSION_MAX_BYTES,
  formatBytes,
  type SourceText,
} from "@pandapaylens/core";
import type { AnalyzeResponse } from "@/lib/analyzer";
import { MANIFESTS, ROADMAP } from "@pandapaylens/providers/manifests";
import { loadSample, SAMPLES } from "@/lib/samples";
import { DetectionSummary } from "./DetectionSummary";
import { analyzeInBrowser } from "./run";
import { DecoderView } from "./DecoderView";
import { TimelineView } from "./TimelineView";
import { FindingsPanel } from "./FindingsPanel";
import { InspectorView } from "./InspectorView";
import { ExportBar } from "./ExportBar";

type View = "decoder" | "timeline" | "inspector";
type ImportedFile = { name: string; text: string; size: number };

const PASTE_SOURCE = "Pasted JSON";

/** Provider list grouped by overall support level, alphabetical within each. */
const byName = (a: { displayName: string }, b: { displayName: string }) =>
  a.displayName.localeCompare(b.displayName);
const PROVIDER_GROUPS = [
  {
    label: "Full support",
    manifests: MANIFESTS.filter((m) => m.status === "supported").sort(byName),
  },
  {
    label: "Limited support",
    manifests: MANIFESTS.filter((m) => m.status !== "supported").sort(byName),
  },
].filter((g) => g.manifests.length > 0);

/**
 * Example groups. "High-risk payments" is a context for recurring billing,
 * deposits, payouts and disputes; it is chosen by provider roadmap focus,
 * never inferred from a transaction.
 */
const HIGH_RISK = new Set(ROADMAP.filter((r) => r.focus.includes("high_risk")).map((r) => r.id));
const EXAMPLE_GROUPS = [
  { label: "General", samples: SAMPLES.filter((s) => !s.provider || !HIGH_RISK.has(s.provider)) },
  {
    label: "High-risk payments",
    samples: SAMPLES.filter((s) => s.provider && HIGH_RISK.has(s.provider)),
  },
];

export function Workspace() {
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [provider, setProvider] = useState<string>("auto");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [view, setView] = useState<View>("timeline");
  const [showIds, setShowIds] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorId = useId();
  const resultsRef = useRef<HTMLHeadingElement>(null);

  const totalBytes = useMemo(
    () => files.reduce((n, f) => n + f.size, 0) + new Blob([text]).size,
    [files, text],
  );

  const analyze = useCallback(
    async (overrideText?: string, providerOverride?: string) => {
      const pasted = overrideText ?? text;
      const sources: SourceText[] = [
        ...(pasted.trim() ? [{ name: PASTE_SOURCE, text: pasted }] : []),
        ...files.map((f) => ({ name: f.name, text: f.text })),
      ];
      if (!sources.length) {
        setNotice("Paste JSON, import a file, or choose an example first.");
        return;
      }
      setNotice(null);
      setBusy(true);
      const chosen = providerOverride ?? provider;
      setHighlight([]);
      const res = await analyzeInBrowser({
        sources,
        provider: chosen === "auto" ? null : chosen,
      });
      setBusy(false);
      setResponse(res);
      if (res.ok) {
        setView(res.result.suggestedView);
        // Move focus to the results so keyboard and screen-reader users land there.
        requestAnimationFrame(() => resultsRef.current?.focus());
      }
    },
    [text, files, provider],
  );

  const loadExample = useCallback(
    async (id: string) => {
      const sample = await loadSample(id);
      if (sample === null) return;
      setFiles([]);
      setText(sample);
      await analyze(sample);
    },
    [analyze],
  );

  // ?sample=<id> preloads an example (links from /examples).
  const requested = params.get("sample");
  const loadedRequest = useRef<string | null>(null);
  useEffect(() => {
    if (
      requested &&
      loadedRequest.current !== requested &&
      SAMPLES.some((s) => s.id === requested)
    ) {
      loadedRequest.current = requested;
      void loadExample(requested);
    }
  }, [requested, loadExample]);

  async function importFiles(list: FileList | File[]) {
    const accepted: ImportedFile[] = [];
    const problems: string[] = [];
    let budget = DEFAULT_SESSION_MAX_BYTES - totalBytes;
    for (const f of Array.from(list)) {
      if (!/\.(json|jsonl|ndjson|txt)$/i.test(f.name)) {
        problems.push(`${f.name}: only .json and .jsonl files are supported`);
        continue;
      }
      if (f.size > DEFAULT_LIMITS.maxBytes) {
        problems.push(
          `${f.name}: larger than the ${formatBytes(DEFAULT_LIMITS.maxBytes)} per-file limit`,
        );
        continue;
      }
      if (f.size > budget) {
        problems.push(
          `${f.name}: would exceed the ${formatBytes(DEFAULT_SESSION_MAX_BYTES)} session limit`,
        );
        continue;
      }
      budget -= f.size;
      // Read locally; the file never leaves the browser.
      accepted.push({ name: f.name, text: await f.text(), size: f.size });
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    setNotice(
      problems.length
        ? problems.join(". ")
        : accepted.length
          ? `Imported ${accepted.length} file(s). Press Analyze.`
          : null,
    );
  }

  function clearAll() {
    setText("");
    setFiles([]);
    setResponse(null);
    setHighlight([]);
    setNotice(null);
    loadedRequest.current = null;
  }

  function prettyPrint() {
    try {
      setText(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
      setNotice(null);
    } catch {
      setNotice(
        "Pretty-print needs a single valid JSON document. Press Analyze to see where the error is.",
      );
    }
  }

  const ok = response?.ok ? response : null;
  const result = ok?.result;
  const counts = result
    ? {
        errors: result.errors.length,
        events: result.events.length,
        findings: result.findings.length,
      }
    : null;

  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-6 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)_minmax(300px,360px)]">
      {/* Input */}
      <section
        aria-labelledby="input-heading"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
      >
        <h1 id="input-heading" className="text-base font-semibold">
          Input
        </h1>
        <p className="text-xs text-fg-muted">
          Processed in your browser. Nothing is uploaded or stored; reloading the page clears it.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            >
              <option value="auto">Auto-detect</option>
              {PROVIDER_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.manifests.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Example
            <select
              value=""
              onChange={(e) => e.target.value && void loadExample(e.target.value)}
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            >
              <option value="">Load an example…</option>
              {EXAMPLE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void importFiles(e.dataTransfer.files);
          }}
          className={`relative rounded-lg border ${dragging ? "border-accent ring-2 ring-accent/30" : "border-border"}`}
        >
          <label htmlFor={editorId} className="sr-only">
            Payment JSON
          </label>
          <textarea
            id={editorId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void analyze();
              }
            }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            placeholder={
              "Paste a Stripe or Adyen error, event, webhook, or an array of them.\n\nDrop .json / .jsonl files here.\n\nCtrl/⌘ + Enter to analyze."
            }
            className="block h-72 w-full resize-y rounded-lg bg-code p-3 font-mono text-xs leading-relaxed outline-none lg:h-[38vh]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Analyzing…" : "Analyze"}
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-subtle"
          >
            Import files
          </button>
          <button
            type="button"
            onClick={prettyPrint}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-subtle"
          >
            Format
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-subtle"
          >
            Clear
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.jsonl,.ndjson,application/json"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void importFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs" aria-label="Imported files">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md bg-bg-subtle px-2 py-1"
              >
                <span className="truncate font-mono">{f.name}</span>
                <span className="shrink-0 text-fg-muted">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 rounded px-1 text-fg-muted hover:text-fail"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-fg-muted">
          Session: {formatBytes(totalBytes)} of {formatBytes(DEFAULT_SESSION_MAX_BYTES)} ·{" "}
          {formatBytes(DEFAULT_LIMITS.maxBytes)} per file
        </p>

        <div aria-live="polite" className="text-sm">
          {notice && (
            <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-warn">
              {notice}
            </p>
          )}
          {response && !response.ok && (
            <div
              role="alert"
              className="rounded-md border border-fail/30 bg-fail/10 px-3 py-2 text-fail"
            >
              <p className="font-semibold">
                {response.code === "INVALID_JSON"
                  ? "The input is not valid JSON"
                  : "Analysis could not run"}
              </p>
              <p>
                {response.message}
                {response.line ? ` (line ${response.line}, column ${response.column})` : ""}
                {response.source && response.source !== PASTE_SOURCE
                  ? ` in ${response.source}`
                  : ""}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="results-heading"
            ref={resultsRef}
            tabIndex={-1}
            className="mr-auto text-base font-semibold outline-none"
          >
            Results
            {counts && (
              <span className="ml-2 text-sm font-normal text-fg-muted">
                {counts.errors} error(s) · {counts.events} event(s) · {counts.findings} finding(s)
              </span>
            )}
          </h2>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={showIds}
              onChange={(e) => setShowIds(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Show full identifiers
          </label>
        </div>

        {result && (
          <DetectionSummary
            records={result.records}
            onAnalyzeAs={(id) => {
              setProvider(id);
              void analyze(undefined, id);
            }}
          />
        )}

        <div
          role="tablist"
          aria-label="Result views"
          className="flex gap-1 rounded-lg border border-border bg-card p-1"
        >
          {(["decoder", "timeline", "inspector"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              id={`tab-${v}`}
              aria-selected={view === v}
              aria-controls={`panel-${v}`}
              tabIndex={view === v ? 0 : -1}
              onClick={() => setView(v)}
              onKeyDown={(e) => {
                const order = ["decoder", "timeline", "inspector"] as const;
                const i = order.indexOf(v);
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const next =
                    order[(i + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length]!;
                  setView(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"}`}
            >
              {v === "decoder" ? "Error decoder" : v === "timeline" ? "Timeline" : "Data inspector"}
            </button>
          ))}
        </div>

        <div
          id={`panel-${view}`}
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          className="min-w-0"
        >
          {!result ? (
            <EmptyState busy={busy} />
          ) : view === "decoder" ? (
            <DecoderView result={result} showIds={showIds} />
          ) : view === "timeline" ? (
            <TimelineView result={result} showIds={showIds} highlight={highlight} />
          ) : (
            <InspectorView
              records={ok!.inspector}
              sources={ok!.sources}
              summaries={result.records}
            />
          )}
        </div>

        {result && <ExportBar result={result} />}
      </section>

      {/* Findings */}
      <aside
        aria-labelledby="findings-heading"
        className="flex min-w-0 flex-col gap-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
      >
        <FindingsPanel
          result={result ?? null}
          onShowEvidence={(ids) => {
            setHighlight(ids);
            setView("timeline");
            requestAnimationFrame(() =>
              document
                .getElementById(`event-${ids[0]}`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" }),
            );
          }}
        />
      </aside>
    </div>
  );
}

function EmptyState({ busy }: { busy: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      {busy ? (
        <p role="status" className="text-sm text-fg-muted">
          Analyzing locally…
        </p>
      ) : (
        <>
          <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
            <circle
              cx="28"
              cy="28"
              r="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-border"
            />
            <path
              d="M41 41 L56 56"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className="text-accent"
            />
          </svg>
          <p className="font-medium">Nothing analyzed yet</p>
          <p className="max-w-md text-sm text-fg-muted">
            Paste a payment error or a set of webhook events, import files, or load an example.
            Results show up here; findings appear on the right.
          </p>
        </>
      )}
    </div>
  );
}
