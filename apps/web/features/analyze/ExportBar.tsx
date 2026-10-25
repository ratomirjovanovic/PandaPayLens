"use client";

import { useState } from "react";
import {
  maskIdentifier,
  toJsonReport,
  toMarkdownReport,
  type AnalysisResult,
} from "@pandapaylens/core";
import { CopyButton } from "./CopyButton";

function download(name: string, blob: Blob) {
  // Generated locally and saved through an object URL; nothing is uploaded.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

export function ExportBar({ result }: { result: AnalysisResult }) {
  const [includeIds, setIncludeIds] = useState(false);
  const opts = { includeIdentifiers: includeIds };
  const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-subtle";
  return (
    <section
      aria-labelledby="export-heading"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
    >
      <h2 id="export-heading" className="mr-2 text-sm font-semibold">
        Export
      </h2>
      <button
        type="button"
        className={btn}
        onClick={() =>
          download(
            `pandapaylens-report-${stamp()}.json`,
            new Blob([toJsonReport(result, opts)], { type: "application/json" }),
          )
        }
      >
        JSON
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          download(
            `pandapaylens-report-${stamp()}.md`,
            new Blob([toMarkdownReport(result, opts)], { type: "text/markdown" }),
          )
        }
      >
        Markdown
      </button>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          const blob = await renderTimelinePng(result, includeIds);
          if (blob) download(`pandapaylens-timeline-${stamp()}.png`, blob);
        }}
      >
        PNG timeline
      </button>
      <CopyButton
        text={toMarkdownReport(result, opts)}
        label="Copy Markdown report to clipboard"
        className="!px-3 !py-1.5 !text-sm"
      />
      <label className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
        <input
          type="checkbox"
          checked={includeIds}
          onChange={(e) => setIncludeIds(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Include full identifiers
      </label>
      <p className="basis-full text-xs text-fg-muted">
        Identifiers are masked unless you opt in. Card data, secrets and contact details are never
        exported. Reports describe the supplied records only and do not confirm settlement.
      </p>
    </section>
  );
}

/** Draws the timeline on a canvas. Only normalized, allowlisted fields are drawn. */
async function renderTimelinePng(
  result: AnalysisResult,
  includeIds: boolean,
): Promise<Blob | null> {
  const dark = document.documentElement.classList.contains("dark");
  const css = getComputedStyle(document.documentElement);
  const color = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
  const c = {
    bg: color("--bg", dark ? "#0f1115" : "#fbfbf9"),
    card: color("--card", "#fff"),
    fg: color("--fg", "#16181d"),
    muted: color("--fg-muted", "#5a5f6b"),
    border: color("--border", "#e2e2dc"),
    accent: color("--accent", "#0f7a4f"),
    outcome: {
      success: color("--ok", "#157f3b"),
      failure: color("--fail", "#b42318"),
      pending: color("--warn", "#9a5b00"),
      unknown: color("--fg-muted", "#5a5f6b"),
    },
  };
  const byId = new Map(result.events.map((e) => [e.id, e]));
  const ref = (s?: string) => (s ? (includeIds ? s : maskIdentifier(s)) : "");
  const W = 1200;
  const rowH = 30;
  const groupHeader = 44;
  const pad = 32;
  const H =
    pad * 2 +
    70 +
    result.groups.reduce((h, g) => h + groupHeader + g.eventIds.length * rowH + 20, 0) +
    40;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = Math.min(H, 16000) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const mono = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const sans = (w: number, s: number) =>
    `${w} ${s}px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`;
  const clip = (t: string, max: number) => {
    if (ctx.measureText(t).width <= max) return t;
    let s = t;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
    return `${s}…`;
  };

  let y = pad;
  ctx.fillStyle = c.fg;
  ctx.font = sans(700, 20);
  ctx.fillText("PandaPayLens · transaction timeline", pad, y + 18);
  ctx.font = sans(400, 12);
  ctx.fillStyle = c.muted;
  ctx.fillText(
    `${result.events.length} events · ${result.groups.length} transactions · ${result.findings.length} findings · analyzed ${result.meta.analyzedAt} · catalog ${result.meta.catalogVersion}${includeIds ? "" : " · identifiers masked"}`,
    pad,
    y + 40,
  );
  y += 70;

  result.groups.forEach((g, gi) => {
    ctx.fillStyle = c.card;
    ctx.strokeStyle = c.border;
    const h = groupHeader + g.eventIds.length * rowH + 8;
    ctx.beginPath();
    ctx.roundRect(pad, y, W - pad * 2, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.fg;
    ctx.font = sans(600, 14);
    ctx.fillText(`Transaction ${gi + 1} · ${g.provider}`, pad + 16, y + 26);
    ctx.font = mono;
    ctx.fillStyle = c.muted;
    ctx.fillText(clip(g.references.map(ref).join("  ·  "), 600), pad + 240, y + 26);
    ctx.fillStyle = c.outcome[g.latestOutcome];
    ctx.fillText(`latest: ${g.latestOutcome}`, W - pad - 140, y + 26);
    let ry = y + groupHeader + 12;
    g.eventIds.forEach((id, i) => {
      const e = byId.get(id)!;
      if (i < g.eventIds.length - 1) {
        ctx.strokeStyle = c.border;
        ctx.beginPath();
        ctx.moveTo(pad + 24, ry);
        ctx.lineTo(pad + 24, ry + rowH);
        ctx.stroke();
      }
      ctx.fillStyle = c.outcome[e.outcome];
      ctx.beginPath();
      ctx.arc(pad + 24, ry, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = mono;
      ctx.fillStyle = c.muted;
      ctx.fillText(
        e.eventTimestamp
          ? e.eventTimestamp.replace("T", " ").replace(".000Z", "Z")
          : "time unknown",
        pad + 44,
        ry + 4,
      );
      ctx.fillStyle = c.fg;
      ctx.fillText(clip(e.eventType, 330), pad + 240, ry + 4);
      ctx.fillStyle = c.outcome[e.outcome];
      ctx.fillText(e.outcome, pad + 590, ry + 4);
      ctx.fillStyle = c.muted;
      ctx.fillText(clip(e.providerStatus ?? "", 200), pad + 680, ry + 4);
      if (e.amountMinor)
        ctx.fillText(clip(`${e.amountMinor} ${e.currency ?? ""}`, 180), pad + 900, ry + 4);
      ry += rowH;
    });
    y += h + 20;
  });
  ctx.font = sans(400, 11);
  ctx.fillStyle = c.muted;
  ctx.fillText(
    "Shows supplied records only. Does not confirm settlement or fund movement.",
    pad,
    y + 10,
  );

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
