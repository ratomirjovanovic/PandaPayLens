import { maskIdentifier, redactDeep, redactText } from "./redact.js";
import type { AnalysisResult, DecodedError, DiagnosticFinding, NormalizedEvent } from "./types.js";

export const REPORT_DISCLAIMER =
  "This analysis describes only the records supplied to PandaPayLens. It does not confirm settlement, " +
  "fund movement, or the state of the payment at the provider. Verify against the provider's dashboard or API.";

export type ReportOptions = {
  /**
   * When false (default) payment, event and merchant identifiers are masked.
   * Blocked sensitive fields are never exported regardless of this flag:
   * only normalized, allowlisted fields reach a report.
   */
  includeIdentifiers?: boolean;
};

export type DiagnosticReport = {
  tool: "PandaPayLens";
  reportFormatVersion: 1;
  analyzedAt: string;
  coreVersion: string;
  catalogVersion: string;
  providerOverride: string | null;
  redaction: { identifiersMasked: boolean; sensitiveFieldsExcluded: true; sensitiveDataDetected: boolean };
  disclaimer: string;
  records: AnalysisResult["records"];
  events: NormalizedEvent[];
  groups: AnalysisResult["groups"];
  errors: DecodedError[];
  findings: DiagnosticFinding[];
  warnings: AnalysisResult["warnings"];
  limitations: string[];
};

const ID_FIELDS = ["eventReference", "paymentReference", "relatedReference", "merchantReference", "deliveryKey"] as const;

function maskEvent(e: NormalizedEvent): NormalizedEvent {
  const out: NormalizedEvent = { ...e, attributes: { ...e.attributes } };
  for (const f of ID_FIELDS) {
    const v = out[f];
    if (v) out[f] = f === "deliveryKey" ? maskDeliveryKey(v) : maskIdentifier(v);
  }
  return out;
}

function maskDeliveryKey(key: string): string {
  return key
    .split(":")
    .map((part) => (/[_\d]/.test(part) && part.length > 6 ? maskIdentifier(part) : part))
    .join(":");
}

function scrubAttributes(e: NormalizedEvent): NormalizedEvent {
  const attributes: NormalizedEvent["attributes"] = {};
  for (const [k, v] of Object.entries(e.attributes)) {
    attributes[k] = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? scrub(x) : x)) : typeof v === "string" ? scrub(v) : v;
  }
  return { ...e, attributes };
}

function scrub(text: string): string {
  return redactText(text).text;
}

export function buildReport(result: AnalysisResult, options: ReportOptions = {}): DiagnosticReport {
  // Final defense-in-depth pass: whatever an adapter let through, no string
  // in a report may contain a secret, email, IBAN or card number pattern.
  return redactDeep(assembleReport(result, options)) as DiagnosticReport;
}

function assembleReport(result: AnalysisResult, options: ReportOptions): DiagnosticReport {
  const mask = !options.includeIdentifiers;
  const refMask = (s: string) => (mask ? maskIdentifier(s) : s);
  const limitations = [
    "Only events present in the supplied data are shown; missing lifecycle events are not inferred.",
  ];
  if (result.arrivalOrderInferred) {
    limitations.push("No receipt timestamps were supplied; arrival order is assumed from the order of records in the input.");
  }
  return {
    tool: "PandaPayLens",
    reportFormatVersion: 1,
    analyzedAt: result.meta.analyzedAt,
    coreVersion: result.meta.coreVersion,
    catalogVersion: result.meta.catalogVersion,
    providerOverride: result.meta.providerOverride,
    redaction: { identifiersMasked: mask, sensitiveFieldsExcluded: true, sensitiveDataDetected: result.sensitiveData.detected },
    disclaimer: REPORT_DISCLAIMER,
    records: result.records,
    events: result.events.map((e) => scrubAttributes(mask ? maskEvent(e) : e)),
    groups: result.groups.map((g) => ({ ...g, references: g.references.map(refMask) })),
    errors: result.errors.map((e) => ({
      ...e,
      ...(e.providerMessage ? { providerMessage: scrub(e.providerMessage) } : {}),
      ...(e.paymentReference ? { paymentReference: refMask(e.paymentReference) } : {}),
    })),
    findings: result.findings.map((f) => ({ ...f, explanation: mask ? maskInlineIds(f.explanation) : f.explanation })),
    warnings: result.warnings,
    limitations,
  };
}

/** Masks identifiers that rules quoted inside finding text. */
function maskInlineIds(text: string): string {
  return text.replace(/\b(?:pi|ch|evt|re|py|in|cus|pm|src)_[A-Za-z0-9]{6,}\b/g, (m) => maskIdentifier(m)).replace(
    /\b[A-Z0-9]{16}\b/g,
    (m) => (/\d/.test(m) ? maskIdentifier(m) : m),
  );
}

export function toJsonReport(result: AnalysisResult, options?: ReportOptions): string {
  return `${JSON.stringify(buildReport(result, options), null, 2)}\n`;
}

/** Escape text for Markdown so imported values cannot inject links, HTML or tables. */
export function mdEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}[\]()#+\-.!|~]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, " ");
}

/** Only well-formed https links to documentation are emitted as autolinks. */
const SAFE_URL = /^https:\/\/[\w.-]+(\/[\w./#%-]*)?$/;

export function toMarkdownReport(result: AnalysisResult, options?: ReportOptions): string {
  const r = buildReport(result, options);
  const lines: string[] = [];
  const esc = mdEscape;
  lines.push("# PandaPayLens diagnostic report", "");
  lines.push(`- **Analyzed at:** ${esc(r.analyzedAt)}`);
  lines.push(`- **PandaPayLens core:** ${esc(r.coreVersion)}`);
  lines.push(`- **Rule catalog:** ${esc(r.catalogVersion)}`);
  const formats = [...new Set(r.records.filter((x) => x.status === "analyzed").map((x) => `${x.provider} / ${x.format}`))];
  lines.push(`- **Recognized formats:** ${formats.length ? formats.map(esc).join(", ") : "none"}`);
  lines.push(`- **Identifiers:** ${r.redaction.identifiersMasked ? "masked" : "included"}; sensitive fields excluded`);
  if (r.redaction.sensitiveDataDetected) lines.push("- **Sensitive data:** possible sensitive fields were detected in the input and excluded");
  lines.push("", `> ${esc(r.disclaimer)}`, "");

  if (r.errors.length) {
    lines.push("## Decoded errors", "");
    for (const e of r.errors) {
      lines.push(`### ${esc(e.provider)}: ${esc(e.code)}`, "");
      const subs = Object.entries(e.subCodes);
      if (subs.length) lines.push(`- **Codes:** ${subs.map(([k, v]) => `${esc(k)}=${esc(v)}`).join(", ")}`);
      lines.push(`- **Category:** ${esc(e.category)}`);
      lines.push(`- **Explanation:** ${esc(e.explanation)}`);
      lines.push(`- **Next action:** ${esc(e.nextAction)}`);
      lines.push(`- **Retry guidance:** \`${e.retry}\` — ${esc(e.retryExplanation)}`);
      lines.push(`- **Confidence:** ${esc(e.confidence)}`);
      if (e.providerMessage) lines.push(`- **Provider message:** ${esc(e.providerMessage)}`);
      for (const m of e.missingInformation) lines.push(`- **Missing:** ${esc(m)}`);
      for (const d of e.documentation) if (SAFE_URL.test(d.url)) lines.push(`- **Docs:** ${esc(d.title)} — <${d.url}>`);
      lines.push("");
    }
  }

  lines.push("## Findings", "");
  if (r.findings.length === 0) lines.push("No findings.", "");
  for (const f of r.findings) {
    lines.push(`### [${f.severity.toUpperCase()}] ${esc(f.title)}`, "");
    lines.push(`- **Rule:** \`${f.ruleId}\` v${esc(f.ruleVersion)}`);
    lines.push(`- **Confidence:** ${esc(f.confidence)}`);
    lines.push(`- **Explanation:** ${esc(f.explanation)}`);
    if (f.evidenceEventIds.length) lines.push(`- **Evidence:** ${f.evidenceEventIds.map(esc).join(", ")}`);
    if (f.recommendedAction) lines.push(`- **Recommended:** ${esc(f.recommendedAction)}`);
    for (const l of f.limitations) lines.push(`- **Limitation:** ${esc(l)}`);
    lines.push("");
  }

  lines.push("## Observed events", "");
  if (r.events.length === 0) {
    lines.push("No events were supplied. The transaction history is not available.", "");
  } else {
    lines.push("| # | Event time | Provider | Event | Status | Outcome | Payment ref | Amount |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const e of r.events) {
      const amount = e.amountMinor ? `${e.amountMinor} ${e.currency ?? ""} (minor)` : "";
      lines.push(
        `| ${esc(e.id)} | ${esc(e.eventTimestamp ?? "unknown")} | ${esc(e.provider)} | ${esc(e.eventType)} | ${esc(e.providerStatus ?? "")} | ${esc(e.outcome)} | ${esc(e.paymentReference ?? "missing")} | ${esc(amount)} |`,
      );
    }
    lines.push("");
  }

  if (r.warnings.length) {
    lines.push("## Warnings", "");
    for (const w of r.warnings) lines.push(`- \`${w.code}\`: ${esc(w.message)}`);
    lines.push("");
  }
  lines.push("## Limitations", "");
  for (const l of r.limitations) lines.push(`- ${esc(l)}`);
  lines.push("");
  return lines.join("\n");
}
