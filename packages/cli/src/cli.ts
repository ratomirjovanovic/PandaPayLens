/**
 * PandaPayLens command-line interface.
 *
 * Runs entirely offline: no login, no network, no telemetry.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  analyzeText,
  CORE_VERSION,
  DEFAULT_LIMITS,
  formatBytes,
  maskIdentifier,
  toJsonReport,
  toMarkdownReport,
  type AnalysisResult,
  type Severity,
} from "@pandapaylens/core";
import { ADAPTERS, ROADMAP } from "@pandapaylens/providers";
import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";

export const CLI_VERSION = "0.5.0";

export const EXIT = { OK: 0, FINDINGS: 1, INVALID_INPUT: 2, UNSUPPORTED: 3, INTERNAL: 4 } as const;

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export type Io = {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  readStdin: () => string;
  readFile: (path: string) => string;
  color: boolean;
};

const HELP = `PandaPayLens ${CLI_VERSION} - decode payment errors and visualize transaction events.

Usage:
  pandapaylens analyze  <file|->   Full analysis (errors, timeline, findings)
  pandapaylens decode   <file|->   Decoded errors only
  pandapaylens timeline <file|->   Event timeline only
  pandapaylens examples [id]       List samples, or print one as JSON
  pandapaylens providers           Providers, capabilities and formats
                                   (--supported: only available ones)
  pandapaylens version             Version information

Options:
  -p, --provider <id>              Skip auto-detection (ids: pandapaylens providers)
  -f, --format <text|json|markdown> Output format (default: text)
      --fail-on <severity>         Exit 1 if a finding is at or above this
                                   severity: critical|high|medium|low|info|none
                                   (default: none)
      --include-identifiers        Do not mask payment/event identifiers
      --no-color                   Disable colored output
  -h, --help                       Show this help

Input may be JSON, a JSON array, JSON Lines, URL-encoded form data, a raw HTTP
request or response, or a callback URL. Use "-" for stdin.
Nothing is sent over the network.

Exit codes: 0 ok, 1 findings at/above --fail-on, 2 invalid input,
            3 unsupported provider/format, 4 internal error.
`;

export function run(argv: string[], io: Io): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        provider: { type: "string", short: "p" },
        format: { type: "string", short: "f", default: "text" },
        "fail-on": { type: "string", default: "none" },
        "include-identifiers": { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
        supported: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (e) {
    io.stderr(`${e instanceof Error ? e.message : String(e)}\n\n${HELP}`);
    return EXIT.INVALID_INPUT;
  }
  const { values, positionals } = parsed;
  const [command, target] = positionals;
  const color = io.color && !values["no-color"];

  if (values.help || !command || command === "help") {
    io.stdout(HELP);
    return command || values.help ? EXIT.OK : EXIT.INVALID_INPUT;
  }

  const format = values.format;
  if (format !== "text" && format !== "json" && format !== "markdown") {
    io.stderr(`Unknown --format "${format}". Use text, json or markdown.\n`);
    return EXIT.INVALID_INPUT;
  }
  const failOn = values["fail-on"];
  if (failOn !== "none" && !SEVERITIES.includes(failOn as Severity)) {
    io.stderr(`Unknown --fail-on "${failOn}". Use ${SEVERITIES.join(", ")} or none.\n`);
    return EXIT.INVALID_INPUT;
  }
  if (values.provider && !ADAPTERS.some((a) => a.id === values.provider)) {
    io.stderr(
      `Unknown provider "${values.provider}". Supported: ${ADAPTERS.map((a) => a.id).join(", ")}.\n`,
    );
    return EXIT.UNSUPPORTED;
  }

  switch (command) {
    case "version":
      io.stdout(
        `pandapaylens ${CLI_VERSION}\ncore ${CORE_VERSION}\nrule catalog ${RULE_CATALOG_VERSION}\n${ADAPTERS.map((a) => `${a.id} adapter ${a.version}`).join("\n")}\n`,
      );
      return EXIT.OK;
    case "providers":
      return providers(io, format, values.supported);
    case "examples":
      return examples(io, target, format);
    case "analyze":
    case "decode":
    case "timeline":
      break;
    default:
      io.stderr(`Unknown command "${command}".\n\n${HELP}`);
      return EXIT.INVALID_INPUT;
  }

  if (!target) {
    io.stderr(`Missing input. Pass a file path or "-" for stdin.\n`);
    return EXIT.INVALID_INPUT;
  }

  let text: string;
  try {
    text = target === "-" ? io.readStdin() : io.readFile(target);
  } catch (e) {
    const code = (e as { code?: string }).code;
    io.stderr(
      code === "ENOENT"
        ? `File not found: ${target}\n`
        : `Could not read ${target === "-" ? "stdin" : target}.\n`,
    );
    return EXIT.INVALID_INPUT;
  }

  const r = analyzeText(text, {
    adapters: ADAPTERS,
    rules: defaultRules,
    catalogVersion: RULE_CATALOG_VERSION,
    provider: values.provider ?? null,
  });
  if (!r.ok) {
    if (r.error.code === "INTERNAL_ERROR") {
      io.stderr(
        `${r.error.message}\nPlease report this at https://github.com/ratomirjovanovic/PandaPayLens/issues (without your payment data).\n`,
      );
      return EXIT.INTERNAL;
    }
    const where =
      "line" in r.error && r.error.line ? ` (line ${r.error.line}, column ${r.error.column})` : "";
    io.stderr(`${r.error.message}${where}\n`);
    if (r.error.code === "INPUT_TOO_LARGE")
      io.stderr(`Limit: ${formatBytes(DEFAULT_LIMITS.maxBytes)} per input.\n`);
    return r.error.code === "UNKNOWN_PROVIDER" ? EXIT.UNSUPPORTED : EXIT.INVALID_INPUT;
  }

  const result = r.result;
  const reportOpts = { includeIdentifiers: values["include-identifiers"] };
  if (format === "json") io.stdout(toJsonReport(result, reportOpts));
  else if (format === "markdown") io.stdout(toMarkdownReport(result, reportOpts));
  else
    io.stdout(
      renderText(result, command, { color, includeIdentifiers: values["include-identifiers"] }),
    );

  if (!result.records.some((rec) => rec.status === "analyzed")) return EXIT.UNSUPPORTED;
  if (failOn !== "none") {
    const threshold = SEVERITIES.indexOf(failOn as Severity);
    if (result.findings.some((f) => SEVERITIES.indexOf(f.severity) <= threshold))
      return EXIT.FINDINGS;
  }
  return EXIT.OK;
}

function providers(io: Io, format: string, onlyAvailable: boolean): number {
  const available = new Map(ADAPTERS.map((a) => [a.id, a]));
  const data = ROADMAP.filter((r) => !onlyAvailable || available.has(r.id)).map((r) => {
    const a = available.get(r.id);
    return a
      ? {
          id: a.id,
          name: a.displayName,
          status: a.manifest.status,
          version: a.version,
          capabilities: a.manifest.capabilities,
          formats: a.manifest.apiFamilies,
          limitations: a.manifest.limitations,
        }
      : {
          id: r.id,
          name: r.displayName,
          status: "planned" as const,
          researchStatus: r.researchStatus,
          wave: r.wave,
        };
  });
  if (format === "json") {
    io.stdout(`${JSON.stringify(data, null, 2)}\n`);
    return EXIT.OK;
  }
  for (const p of data) {
    if (p.status === "planned" || !("capabilities" in p) || !p.capabilities || !p.formats) {
      const research =
        "researchStatus" in p && p.researchStatus
          ? String(p.researchStatus).replace(/_/g, " ")
          : "planned";
      io.stdout(`${p.name} (${p.id}) - not analyzed yet (${research})\n`);
      continue;
    }
    io.stdout(`${p.name} (${p.id}, adapter ${p.version}) - ${p.status}\n`);
    const c = p.capabilities;
    io.stdout(
      `  errors: ${c.errorDecoding}, responses: ${c.paymentResponses}, webhooks: ${c.webhookParsing}, timeline: ${c.timeline}, correlation: ${c.correlation}\n`,
    );
    for (const f of p.formats)
      io.stdout(`  ${f.id.padEnd(30)} ${f.status.padEnd(12)} ${f.description}\n`);
  }
  return EXIT.OK;
}

function samplesDir(): string {
  // dist/cli.js → dist/samples
  return join(dirname(fileURLToPath(import.meta.url)), "samples");
}

function examples(io: Io, id: string | undefined, format: string): number {
  let index: { id: string; title: string; provider: string | null; description: string }[];
  try {
    index = JSON.parse(readFileSync(join(samplesDir(), "index.json"), "utf8"));
  } catch {
    io.stderr("Sample data is not available in this build.\n");
    return EXIT.INTERNAL;
  }
  if (!id) {
    if (format === "json") io.stdout(`${JSON.stringify(index, null, 2)}\n`);
    else {
      for (const s of index) io.stdout(`${s.id.padEnd(32)} ${s.title}\n`);
      io.stdout(
        `\nPrint one with: pandapaylens examples <id>\nAnalyze one with: pandapaylens examples <id> | pandapaylens analyze -\n`,
      );
    }
    return EXIT.OK;
  }
  if (!index.some((s) => s.id === id)) {
    io.stderr(`Unknown example "${id}". Run "pandapaylens examples" for the list.\n`);
    return EXIT.INVALID_INPUT;
  }
  io.stdout(readFileSync(join(samplesDir(), `${id}.txt`), "utf8"));
  return EXIT.OK;
}

// ---------------------------------------------------------------------------
// Text rendering

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

/** Remove terminal control sequences from untrusted text. */
export function stripControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, "");
}

function renderText(
  r: AnalysisResult,
  command: string,
  opts: { color: boolean; includeIdentifiers: boolean },
): string {
  const c = (code: keyof typeof ANSI, s: string) =>
    opts.color ? `${ANSI[code]}${s}${ANSI.reset}` : s;
  const t = (s: string | undefined) => stripControl(s ?? "");
  const id = (s: string | undefined) =>
    s ? t(opts.includeIdentifiers ? s : maskIdentifier(s)) : "-";
  const out: string[] = [];
  const sevColor: Record<Severity, keyof typeof ANSI> = {
    critical: "red",
    high: "red",
    medium: "yellow",
    low: "cyan",
    info: "dim",
  };
  const outcomeColor = {
    success: "green",
    failure: "red",
    pending: "yellow",
    unknown: "dim",
  } as const;

  const recognized = r.records.filter((x) => x.status === "analyzed");
  out.push(c("bold", "PandaPayLens analysis"));
  out.push(
    c(
      "dim",
      `${r.records.length} record(s), ${recognized.length} analyzed · ${
        [
          ...new Set(
            recognized.map(
              (x) =>
                `${x.format} (adapter ${r.meta.adapters.find((a) => a.id === x.provider)?.version ?? "?"})`,
            ),
          ),
        ].join(", ") || "no supported format"
      }`,
    ),
  );
  out.push("");

  if (command !== "timeline") {
    if (r.errors.length) {
      out.push(c("bold", "Decoded errors"));
      for (const e of r.errors) {
        out.push(
          `  ${c("magenta", `${e.provider}`)} ${c("bold", t(e.code))}${Object.entries(e.subCodes)
            .filter(([k]) => k !== "type")
            .map(([k, v]) => c("dim", ` ${k}=${t(v)}`))
            .join("")}`,
        );
        out.push(`    Category:   ${e.category}`);
        out.push(`    Meaning:    ${t(e.explanation)}`);
        out.push(`    Next:       ${t(e.nextAction)}`);
        out.push(`    Retry:      ${c("bold", e.retry)} - ${t(e.retryExplanation)}`);
        out.push(`    Confidence: ${e.confidence}`);
        if (e.providerMessage) out.push(`    Message:    ${t(e.providerMessage)}`);
        for (const m of e.missingInformation) out.push(c("yellow", `    Missing:    ${t(m)}`));
        for (const d of e.documentation) out.push(c("dim", `    Docs:       ${t(d.url)}`));
        out.push("");
      }
    } else if (command === "decode") {
      out.push("No provider errors found in the input.", "");
    }
  }

  if (command !== "decode") {
    out.push(c("bold", "Timeline"));
    if (!r.events.length)
      out.push("  No events. The transaction history is not available from this input.");
    for (const g of r.groups) {
      out.push(
        c(
          "dim",
          `  ── ${g.provider} · ${g.references.map(id).join(", ") || "no reference"} · latest: ${g.latestOutcome}`,
        ),
      );
      for (const evId of g.eventIds) {
        const e = r.events.find((x) => x.id === evId)!;
        const when = e.eventTimestamp
          ? e.eventTimestamp.replace(".000Z", "Z")
          : "time unknown       ";
        const amount = e.amountMinor ? ` ${t(e.amountMinor)} ${t(e.currency)} (minor units)` : "";
        out.push(
          `  ${c("dim", when)}  ${c(outcomeColor[e.outcome], e.outcome.padEnd(7))} ${t(e.eventType)}${e.providerStatus ? c("dim", ` [${t(e.providerStatus)}]`) : ""}${amount}  ${c("dim", e.id)}`,
        );
      }
    }
    if (r.events.length === 1)
      out.push(
        c(
          "dim",
          "  Only one event was supplied; the complete transaction history is not available.",
        ),
      );
    out.push("");
  }

  if (command === "analyze") {
    out.push(c("bold", `Findings (${r.findings.length})`));
    if (!r.findings.length) out.push("  None.");
    for (const f of r.findings) {
      out.push(
        `  ${c(sevColor[f.severity], `[${f.severity.toUpperCase()}]`)} ${t(f.title)} ${c("dim", `(${f.ruleId}, ${f.confidence})`)}`,
      );
      out.push(`    ${t(f.explanation)}`);
      if (f.recommendedAction) out.push(`    → ${t(f.recommendedAction)}`);
      for (const l of f.limitations) out.push(c("dim", `    Limitation: ${t(l)}`));
      const evidence = [...f.evidenceEventIds, ...(f.evidenceErrorIds ?? [])];
      if (evidence.length) out.push(c("dim", `    Evidence: ${evidence.join(", ")}`));
    }
    out.push("");
  }

  for (const w of r.warnings) out.push(c("yellow", `! ${w.code}: ${t(w.message)}`));
  out.push(
    c(
      "dim",
      "This analysis covers only the supplied records. It does not confirm settlement or fund movement.",
    ),
  );
  return `${out.join("\n")}\n`;
}
