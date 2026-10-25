"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CapabilityStatus, ProviderCapabilities } from "@pandapaylens/core";

export type DirectoryEntry = {
  id: string;
  displayName: string;
  wave: number;
  note?: string;
  /** null when the adapter is not implemented yet. */
  status: "supported" | "limited" | "experimental" | null;
  version?: string;
  capabilities?: ProviderCapabilities;
  apiFamilies?: string[];
  docsUrl?: string;
  sampleCount: number;
  limitations: string[];
};

const FEATURES: { key: keyof ProviderCapabilities; label: string }[] = [
  { key: "errorDecoding", label: "Error decoder" },
  { key: "paymentResponses", label: "API responses" },
  { key: "webhookParsing", label: "Webhooks" },
  { key: "timeline", label: "Timeline" },
  { key: "correlation", label: "Correlation" },
];

export const STATUS_CLASS: Record<CapabilityStatus | "planned", string> = {
  supported: "border-ok/40 bg-ok/10 text-ok",
  limited: "border-warn/40 bg-warn/10 text-warn",
  experimental: "border-info/40 bg-info/10 text-info",
  unsupported: "border-border bg-bg-subtle text-fg-muted",
  deprecated: "border-border bg-bg-subtle text-fg-muted line-through",
  planned: "border-border bg-bg-subtle text-fg-muted",
};

export function StatusBadge({ status }: { status: CapabilityStatus | "planned" }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}

export function ProviderDirectory({ entries }: { entries: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const [feature, setFeature] = useState<keyof ProviderCapabilities | "">("");
  const [status, setStatus] = useState<"" | "supported" | "limited" | "experimental" | "planned">(
    "",
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q && !e.displayName.toLowerCase().includes(q) && !e.id.includes(q)) return false;
      if (status && (e.status ?? "planned") !== status) return false;
      if (feature) {
        const c = e.capabilities?.[feature];
        if (!c || c === "unsupported" || c === "deprecated") return false;
      }
      return true;
    });
  }, [entries, query, feature, status]);

  const field = "rounded-md border border-border bg-bg px-2 py-1.5 text-sm";
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Provider
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Feature
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value as typeof feature)}
            className={field}
          >
            <option value="">Any</option>
            {FEATURES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={field}
          >
            <option value="">Any</option>
            <option value="supported">Supported</option>
            <option value="limited">Limited</option>
            <option value="experimental">Experimental</option>
            <option value="planned">Planned</option>
          </select>
        </label>
        <p className="ml-auto text-xs text-fg-muted" aria-live="polite">
          {shown.length} of {entries.length} providers
        </p>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{e.displayName}</h2>
              <StatusBadge status={e.status ?? "planned"} />
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">
              {e.status ? `Adapter ${e.version}` : "Not implemented yet"} · wave {e.wave}
            </p>
            {e.capabilities ? (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                {FEATURES.map((f) => (
                  <div key={f.key} className="contents">
                    <dt className="text-fg-muted">{f.label}</dt>
                    <dd>
                      <StatusBadge status={e.capabilities![f.key]} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-fg-muted">
                Planned. PandaPayLens does not analyze {e.displayName} payloads yet.
                {e.note ? ` ${e.note}` : ""}
              </p>
            )}
            {e.status && (
              <p className="mt-3 text-xs text-fg-muted">
                {e.sampleCount > 0 ? `${e.sampleCount} example(s)` : "No examples yet"}
                {e.limitations.length > 0
                  ? ` · ${e.limitations.length} documented limitation(s)`
                  : ""}
              </p>
            )}
            <div className="mt-auto flex gap-3 pt-3 text-sm">
              {e.status && (
                <Link
                  href={`/providers/${e.id}`}
                  className="text-accent underline underline-offset-2"
                >
                  Details
                </Link>
              )}
              {e.docsUrl && (
                <a
                  href={e.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg-muted hover:text-fg"
                >
                  Provider docs ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
