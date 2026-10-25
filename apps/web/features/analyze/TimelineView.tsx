"use client";

import { useMemo, useState } from "react";
import {
  maskIdentifier,
  type AnalysisResult,
  type NormalizedEvent,
  type Outcome,
} from "@pandapaylens/core";
import { OUTCOME_CLASS, OUTCOME_DOT } from "./labels";

type Order = "event" | "receipt";

export type TimelineFilters = {
  provider: string;
  eventType: string;
  outcome: string;
  reference: string;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: TimelineFilters = {
  provider: "",
  eventType: "",
  outcome: "",
  reference: "",
  from: "",
  to: "",
};

export function filterEvents(
  events: readonly NormalizedEvent[],
  f: TimelineFilters,
): NormalizedEvent[] {
  const ref = f.reference.trim().toLowerCase();
  // datetime-local values have no zone; the UI labels them UTC.
  const from = f.from ? Date.parse(`${f.from}Z`) : null;
  const to = f.to ? Date.parse(`${f.to}Z`) : null;
  return events.filter((e) => {
    if (f.provider && e.provider !== f.provider) return false;
    if (f.eventType && e.eventType !== f.eventType) return false;
    if (f.outcome && e.outcome !== f.outcome) return false;
    if (
      ref &&
      ![e.paymentReference, e.relatedReference, e.eventReference, e.merchantReference].some((r) =>
        r?.toLowerCase().includes(ref),
      )
    )
      return false;
    if (from !== null || to !== null) {
      // Events without a timestamp cannot match a time range.
      if (!e.eventTimestamp) return false;
      const t = Date.parse(e.eventTimestamp);
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
    }
    return true;
  });
}

function fmtTime(iso: string | undefined) {
  if (!iso) return "time unknown";
  return iso
    .replace("T", " ")
    .replace(/\.000Z$/, "Z")
    .replace(/\.(\d{3})Z$/, ".$1Z");
}

export function TimelineView({
  result,
  showIds,
  highlight,
}: {
  result: AnalysisResult;
  showIds: boolean;
  highlight: string[];
}) {
  const [filters, setFilters] = useState<TimelineFilters>(EMPTY_FILTERS);
  const [order, setOrder] = useState<Order>("event");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const id = (s?: string) => (s ? (showIds ? s : maskIdentifier(s)) : undefined);

  const providers = useMemo(() => [...new Set(result.events.map((e) => e.provider))], [result]);
  const types = useMemo(() => [...new Set(result.events.map((e) => e.eventType))].sort(), [result]);
  const visible = useMemo(
    () => new Set(filterEvents(result.events, filters).map((e) => e.id)),
    [result, filters],
  );
  const byId = useMemo(() => new Map(result.events.map((e) => [e.id, e])), [result]);
  const hasReceipt = result.events.some((e) => e.observedTimestamp);

  if (!result.events.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-fg-muted">
        No events could be built from this input.{" "}
        {result.errors.length
          ? "See the error decoder."
          : "Check the warnings in the findings panel."}
      </div>
    );
  }

  const sortForView = (ids: string[]) => {
    const evs = ids.map((i) => byId.get(i)!).filter((e) => visible.has(e.id));
    if (order === "event") return evs; // already chronological from the engine
    return [...evs].sort((a, b) => {
      const ta = a.observedTimestamp ? Date.parse(a.observedTimestamp) : Number.POSITIVE_INFINITY;
      const tb = b.observedTimestamp ? Date.parse(b.observedTimestamp) : Number.POSITIVE_INFINITY;
      return ta !== tb ? ta - tb : a.sourceIndex - b.sourceIndex;
    });
  };

  const toggle = (eid: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(eid)) next.delete(eid);
      else next.add(eid);
      return next;
    });

  const set =
    (k: keyof TimelineFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((f) => ({ ...f, [k]: e.target.value }));
  const field = "rounded-md border border-border bg-bg px-2 py-1 text-xs";

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <legend className="sr-only">Filter events</legend>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          Provider
          <select value={filters.provider} onChange={set("provider")} className={field}>
            <option value="">All</option>
            {providers.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          Event type
          <select
            value={filters.eventType}
            onChange={set("eventType")}
            className={`${field} max-w-48`}
          >
            <option value="">All</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          Status
          <select value={filters.outcome} onChange={set("outcome")} className={field}>
            <option value="">All</option>
            {(["success", "failure", "pending", "unknown"] as Outcome[]).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          Reference
          <input
            value={filters.reference}
            onChange={set("reference")}
            placeholder="pi_…, pspReference"
            className={`${field} w-36`}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          From (UTC)
          <input
            type="datetime-local"
            value={filters.from}
            onChange={set("from")}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-muted">
          To (UTC)
          <input type="datetime-local" value={filters.to} onChange={set("to")} className={field} />
        </label>
        <div
          className="ml-auto flex items-center gap-1"
          role="radiogroup"
          aria-label="Order events by"
        >
          {(["event", "receipt"] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={order === o}
              onClick={() => setOrder(o)}
              className={`rounded-md px-2 py-1 text-xs ${order === o ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"}`}
            >
              {o === "event" ? "Event time" : "Receipt order"}
            </button>
          ))}
        </div>
        {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-accent underline"
          >
            Reset filters
          </button>
        )}
      </fieldset>

      {order === "receipt" && !hasReceipt && (
        <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          No receipt timestamps were supplied, so receipt order is the order of records in the
          input. Wrap records as{" "}
          <code className="font-mono">{'{"receivedAt": "…", "payload": {…}}'}</code> to record when
          they arrived.
        </p>
      )}

      <p className="text-xs text-fg-muted" aria-live="polite">
        Showing {visible.size} of {result.events.length} events in {result.groups.length}{" "}
        transaction group(s). Only supplied events are shown; missing lifecycle events are never
        inferred.
      </p>

      {result.groups.map((g, gi) => {
        const evs = sortForView(g.eventIds);
        if (!evs.length) return null;
        return (
          <section
            key={g.id}
            aria-label={`Transaction ${gi + 1}`}
            className="rounded-xl border border-border bg-card"
          >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-sm">
              <span className="font-semibold">Transaction {gi + 1}</span>
              <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-xs uppercase tracking-wide text-fg-muted">
                {g.provider}
              </span>
              <span className="min-w-0 truncate font-mono text-xs text-fg-muted">
                {g.references.map((r) => id(r)).join(" · ") || "no reference"}
              </span>
              <span className={`ml-auto text-xs font-medium ${OUTCOME_CLASS[g.latestOutcome]}`}>
                latest: {g.latestOutcome}
              </span>
            </header>
            <ol className="relative px-4 py-3">
              {evs.map((e, i) => {
                const isOpen = open.has(e.id);
                const hl = highlight.includes(e.id);
                return (
                  <li
                    key={e.id}
                    id={`event-${e.id}`}
                    className="relative flex gap-3 pb-3 last:pb-0"
                  >
                    {i < evs.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[7px] top-5 h-full w-px bg-border"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-card ${OUTCOME_DOT[e.outcome]}`}
                    />
                    <div
                      className={`min-w-0 flex-1 rounded-lg ${hl ? "bg-accent-soft ring-2 ring-accent/50" : ""}`}
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`detail-${e.id}`}
                        onClick={() => toggle(e.id)}
                        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-2 py-1 text-left hover:bg-bg-subtle"
                      >
                        <span className="font-mono text-xs text-fg-muted">
                          {order === "receipt" && e.observedTimestamp
                            ? `received ${fmtTime(e.observedTimestamp)}`
                            : fmtTime(e.eventTimestamp)}
                        </span>
                        <span className="break-all font-mono text-sm font-medium">
                          {e.eventType}
                        </span>
                        {!e.eventTypeKnown && (
                          <span className="rounded border border-border px-1 text-[10px] uppercase text-fg-muted">
                            unsupported type
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${OUTCOME_CLASS[e.outcome]}`}>
                          {e.outcome}
                        </span>
                        {e.providerStatus && (
                          <span className="font-mono text-xs text-fg-muted">
                            {e.providerStatus}
                          </span>
                        )}
                        {e.amountMinor && (
                          <span className="ml-auto font-mono text-xs">
                            {e.amountMinor} {e.currency}{" "}
                            <span className="text-fg-muted">minor units</span>
                          </span>
                        )}
                        <span className="sr-only">{isOpen ? "Hide details" : "Show details"}</span>
                      </button>
                      {isOpen && (
                        <dl
                          id={`detail-${e.id}`}
                          className="mx-2 mb-2 mt-1 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 rounded-md bg-bg-subtle p-3 text-xs"
                        >
                          <Row
                            k="Observed fact"
                            v="Reported by the provider in the supplied data"
                          />
                          <Row k="Lifecycle stage" v={e.stage} />
                          <Row k="Event reference" v={id(e.eventReference)} mono />
                          <Row k="Payment reference" v={id(e.paymentReference) ?? "missing"} mono />
                          <Row k="Related reference" v={id(e.relatedReference)} mono />
                          <Row k="Merchant reference" v={id(e.merchantReference)} mono />
                          <Row k="Event time" v={e.eventTimestamp ?? "not provided"} mono />
                          <Row k="Receipt time" v={e.observedTimestamp ?? "not provided"} mono />
                          <Row k="Format" v={e.sourceFormat} mono />
                          <Row
                            k="Source"
                            v={`record ${e.source.recordIndex + 1}${e.source.path ? ` → ${e.source.path}` : ""}`}
                            mono
                          />
                          {Object.entries(e.attributes)
                            .filter(
                              ([, v]) =>
                                v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
                            )
                            .map(([k, v]) => (
                              <Row
                                key={k}
                                k={k}
                                v={Array.isArray(v) ? v.join(", ") : String(v)}
                                mono
                              />
                            ))}
                          <Row k="Engine id" v={e.id} mono />
                        </dl>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {g.eventIds.length === 1 && (
              <p className="border-t border-border px-4 py-2 text-xs text-fg-muted">
                Only one event was supplied for this transaction; the complete history is not
                available.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string | undefined; mono?: boolean }) {
  if (v === undefined) return null;
  return (
    <>
      <dt className="text-fg-muted">{k}</dt>
      <dd className={`min-w-0 break-all ${mono ? "font-mono" : ""}`}>{v}</dd>
    </>
  );
}
