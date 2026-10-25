import {
  byteLength,
  DEFAULT_LIMITS,
  DEFAULT_SESSION_MAX_BYTES,
  formatBytes,
  parseInput,
  type InputFormat,
  type RecordMeta,
  type InputLimits,
  type JsonRepair,
  type ParseError,
} from "./parse.js";
import { findSensitivePaths } from "./redact.js";
import type {
  AnalysisContext,
  AnalysisResult,
  AnalysisWarning,
  DecodedError,
  DetectionResult,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedEvent,
  ProviderAdapter,
  RecordSummary,
  TransactionGroup,
} from "./types.js";
import { CORE_VERSION } from "./version.js";

export type AnalyzeOptions = {
  adapters: readonly ProviderAdapter<any>[];
  rules: readonly DiagnosticRule[];
  catalogVersion: string;
  /** Force a provider instead of auto-detection. */
  provider?: string | null;
  limits?: Partial<InputLimits>;
  /** Injected for reproducible output in tests. */
  now?: () => Date;
};

export type AnalyzeFailure = {
  ok: false;
  error: ParseError | { code: "INTERNAL_ERROR" | "UNKNOWN_PROVIDER"; message: string };
};

/** Minimum confidence for an adapter's detection to be accepted. */
const DETECTION_THRESHOLD = 0.5;
/** Two matches closer than this are reported as ambiguous. */
const AMBIGUITY_MARGIN = 0.15;

/**
 * Optional receipt-time envelope: `{ "receivedAt": "<ISO>", "payload": {…} }`.
 * Lets users record when their system observed a delivery, which providers
 * don't include in the payload itself.
 */
function unwrapEnvelope(record: unknown): { payload: unknown; observedTimestamp?: string } {
  if (isRecord(record) && "payload" in record && typeof record.receivedAt === "string") {
    const keys = Object.keys(record);
    if (keys.every((k) => k === "payload" || k === "receivedAt")) {
      const ts = toIsoTimestamp(record.receivedAt);
      return ts ? { payload: record.payload, observedTimestamp: ts } : { payload: record.payload };
    }
  }
  return { payload: record };
}

/** Parse text and analyze it. Never throws for malformed input. */
export function analyzeText(
  text: string,
  options: AnalyzeOptions,
): { ok: true; result: AnalysisResult } | AnalyzeFailure {
  const parsed = parseInput(text, options.limits);
  if (!parsed.ok) return parsed;
  const result = analyzeRecords(parsed.value.records, options, parsed.value.meta);
  if (result.ok) {
    for (const r of parsed.value.removedKeys) {
      result.result.warnings.unshift({
        code: "DANGEROUS_KEY_REMOVED",
        message: `Removed key "${r.path}" because it could be used for prototype pollution.`,
        recordIndex: r.recordIndex,
      });
    }
    const lenient = lenientWarning(parsed.value.jsonRepairs);
    if (lenient) result.result.warnings.unshift(lenient);
  }
  return result;
}

export type SourceText = { name: string; text: string };

export type SourceSummary = {
  name: string;
  recordStart: number;
  recordCount: number;
  format: InputFormat;
};

/**
 * Analyze several inputs (pasted text and imported files) as one session.
 * Each source is parsed separately so errors point at the right file; the
 * records are then analyzed together so cross-file events correlate.
 */
export function analyzeSources(
  sources: readonly SourceText[],
  options: AnalyzeOptions & { sessionMaxBytes?: number },
):
  | { ok: true; result: AnalysisResult; sources: SourceSummary[]; records: unknown[] }
  | {
      ok: false;
      error: (
        | ParseError
        | { code: "INTERNAL_ERROR" | "UNKNOWN_PROVIDER" | "SESSION_TOO_LARGE"; message: string }
      ) & { source?: string };
    } {
  const sessionMax = options.sessionMaxBytes ?? DEFAULT_SESSION_MAX_BYTES;
  let total = 0;
  for (const s of sources) total += s.text.length > sessionMax ? s.text.length : byteLength(s.text);
  if (total > sessionMax) {
    return {
      ok: false,
      error: {
        code: "SESSION_TOO_LARGE",
        message: `The imported data exceeds the ${formatBytes(sessionMax)} session limit.`,
      },
    };
  }
  const records: unknown[] = [];
  const metas: RecordMeta[] = [];
  const summaries: SourceSummary[] = [];
  const removed: { recordIndex: number; path: string }[] = [];
  const lenientSources: AnalysisWarning[] = [];
  for (const s of sources) {
    const parsed = parseInput(s.text, options.limits);
    if (!parsed.ok) return { ok: false, error: { ...parsed.error, source: s.name } };
    summaries.push({
      name: s.name,
      recordStart: records.length,
      recordCount: parsed.value.records.length,
      format: parsed.value.format,
    });
    for (const r of parsed.value.removedKeys)
      removed.push({ ...r, recordIndex: r.recordIndex + records.length });
    const lenient = lenientWarning(parsed.value.jsonRepairs, s.name);
    if (lenient) lenientSources.push(lenient);
    records.push(...parsed.value.records);
    metas.push(...parsed.value.meta);
  }
  const maxRecords = options.limits?.maxRecords ?? DEFAULT_LIMITS.maxRecords;
  if (records.length > maxRecords) {
    return {
      ok: false,
      error: {
        code: "TOO_MANY_RECORDS",
        message: `The session contains ${records.length} records; the limit is ${maxRecords}.`,
      },
    };
  }
  const r = analyzeRecords(records, options, metas);
  if (!r.ok) return r;
  for (const k of removed.reverse()) {
    r.result.warnings.unshift({
      code: "DANGEROUS_KEY_REMOVED",
      message: `Removed key "${k.path}" because it could be used for prototype pollution.`,
      recordIndex: k.recordIndex,
    });
  }
  r.result.warnings.unshift(...lenientSources);
  return { ok: true, result: r.result, sources: summaries, records };
}

/** Analyze already-parsed records (array elements or JSONL lines). */
export function analyzeRecords(
  records: readonly unknown[],
  options: AnalyzeOptions,
  meta: readonly RecordMeta[] = [],
): { ok: true; result: AnalysisResult } | AnalyzeFailure {
  if (options.provider && !options.adapters.some((a) => a.id === options.provider)) {
    return {
      ok: false,
      error: { code: "UNKNOWN_PROVIDER", message: `Unknown provider "${options.provider}".` },
    };
  }
  try {
    return { ok: true, result: runAnalysis(records, options, meta) };
  } catch (e) {
    // Adapters and rules are expected never to throw; if one does, it is an
    // internal defect and must be distinguishable from bad input.
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: `Internal analysis error: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }
}

function runAnalysis(
  records: readonly unknown[],
  options: AnalyzeOptions,
  metaList: readonly RecordMeta[],
): AnalysisResult {
  const started = performance.now();
  const now = options.now ?? (() => new Date());
  const override = options.provider ?? null;

  const warnings: AnalysisWarning[] = [];
  const summaries: RecordSummary[] = [];
  const events: NormalizedEvent[] = [];
  const errors: DecodedError[] = [];
  const sensitivePaths: string[] = [];

  records.forEach((record, recordIndex) => {
    const meta: RecordMeta = metaList[recordIndex] ?? { format: "json" };
    // The receivedAt envelope only exists for JSON input.
    const { payload, observedTimestamp } =
      meta.format === "form" || meta.format === "xml"
        ? { payload: record, observedTimestamp: undefined }
        : unwrapEnvelope(record);

    for (const p of findSensitivePaths(payload))
      sensitivePaths.push(`[${recordIndex}]${p ? `.${p}` : ""}`);

    const candidates = options.adapters
      .filter((a) => !override || a.id === override)
      .map((a) => ({ adapter: a, detection: safeDetect(a, payload, meta) }))
      .filter((c) => c.detection.confidence > 0)
      .sort((a, b) => b.detection.confidence - a.detection.confidence);

    const best = candidates[0];
    const alternatives = candidates.slice(1).map((c) => ({
      provider: c.adapter.id,
      format: c.detection.format,
      confidence: c.detection.confidence,
    }));

    const threshold = override ? 0 : DETECTION_THRESHOLD;
    if (!best || best.detection.confidence < threshold || !best.detection.format) {
      summaries.push({
        recordIndex,
        status: "unsupported",
        provider: best?.adapter.id ?? null,
        format: best?.detection.format ?? null,
        confidence: best?.detection.confidence ?? 0,
        reasons: best?.detection.reasons ?? ["No supported provider format matched this record."],
        alternatives,
      });
      warnings.push({
        code: "UNSUPPORTED_RECORD",
        message:
          best?.detection.unsupportedReason ??
          "This record does not match any supported provider format.",
        recordIndex,
      });
      return;
    }

    const second = candidates[1];
    if (
      !override &&
      second &&
      second.detection.confidence >= DETECTION_THRESHOLD &&
      best.detection.confidence - second.detection.confidence < AMBIGUITY_MARGIN
    ) {
      warnings.push({
        code: "AMBIGUOUS_PROVIDER",
        message: `Record matched both ${best.adapter.displayName} and ${second.adapter.displayName}. Using ${best.adapter.displayName}; select a provider manually if this is wrong.`,
        recordIndex,
      });
    }

    if (!best.detection.supported) {
      summaries.push({
        recordIndex,
        status: "unsupported",
        provider: best.adapter.id,
        format: best.detection.format,
        confidence: best.detection.confidence,
        reasons: best.detection.reasons,
        alternatives,
      });
      warnings.push({
        code: "UNSUPPORTED_RECORD",
        message:
          best.detection.unsupportedReason ??
          `${best.adapter.displayName} format "${best.detection.format}" is recognized but not supported yet.`,
        recordIndex,
      });
      return;
    }

    const adapter = best.adapter;
    const format = best.detection.format;
    const parsed = adapter.parse(payload, format, meta);
    if (!parsed.ok) {
      summaries.push({
        recordIndex,
        status: "invalid",
        provider: adapter.id,
        format,
        confidence: best.detection.confidence,
        reasons: parsed.issues,
        alternatives,
      });
      warnings.push({
        code: "INVALID_RECORD",
        message: `Record looks like ${adapter.displayName} "${format}" but failed validation: ${parsed.issues.slice(0, 3).join("; ")}`,
        recordIndex,
      });
      return;
    }

    const ctx = observedTimestamp
      ? { format, recordIndex, observedTimestamp, meta }
      : { format, recordIndex, meta };
    const recordText = stableStringify(payload);
    for (const draft of adapter.normalize(parsed.value, ctx)) {
      events.push({
        ...draft,
        id: "",
        provider: adapter.id,
        sourceIndex: events.length,
        ...(draft.contentMayRepeat
          ? {}
          : {
              contentFingerprint: fingerprint(
                `${adapter.id}|${format}|${draft.source.path}|${recordText}`,
              ),
            }),
      });
    }
    for (const decoded of adapter.decodeErrors(parsed.value, ctx)) {
      errors.push({ ...decoded, id: `err-${errors.length + 1}`, provider: adapter.id });
    }

    summaries.push({
      recordIndex,
      status: "analyzed",
      provider: adapter.id,
      format,
      confidence: best.detection.confidence,
      reasons: best.detection.reasons,
      alternatives,
    });
  });

  // Event ids follow source order so that they are stable for a given input.
  events.forEach((e, i) => (e.id = `ev-${i + 1}`));

  // Times must carry a zone; anything else would be read in the local zone of
  // the machine and could order events differently on different computers.
  let ignoredTimes = 0;
  for (const e of events) {
    if (e.eventTimestamp !== undefined && !isZonedIso(e.eventTimestamp)) {
      delete e.eventTimestamp;
      delete e.eventTimeZoneAssumed;
      ignoredTimes++;
    }
    if (e.observedTimestamp !== undefined && !isZonedIso(e.observedTimestamp)) {
      delete e.observedTimestamp;
      ignoredTimes++;
    }
    if (!e.eventTimestamp) delete e.eventTimeZoneAssumed;
  }
  if (ignoredTimes > 0) {
    warnings.push({
      code: "TIMESTAMP_IGNORED",
      message: `${ignoredTimes} time value(s) without a time zone or in an unknown format were not used for ordering.`,
    });
  }
  const assumedZone = [
    ...new Set(events.filter((e) => e.eventTimeZoneAssumed).map((e) => e.provider)),
  ];
  const timedProviders = new Set(events.filter((e) => e.eventTimestamp).map((e) => e.provider));
  if (assumedZone.length > 0 && timedProviders.size > 1) {
    const names = assumedZone.map(
      (id) => options.adapters.find((a) => a.id === id)?.displayName ?? id,
    );
    warnings.push({
      code: "TIME_ZONE_ASSUMED",
      message: `${names.join(", ")} ${names.length === 1 ? "documents" : "document"} no time zone for event times; they were read as UTC. Ordering against other providers' events may be off by hours.`,
    });
  }

  for (const e of events) {
    if (e.amountMinor !== undefined && !/^-?\d+$/.test(e.amountMinor)) {
      warnings.push({
        code: "UNSAFE_INTEGER",
        message: `Amount on ${e.id} is not an exact integer and is shown as supplied.`,
        recordIndex: e.source.recordIndex,
      });
    }
  }

  const sorted = sortEvents(events);
  const groups = correlate(sorted, options.adapters);
  const arrivalOrderInferred = !events.some((e) => e.observedTimestamp);
  const manifests = Object.fromEntries(options.adapters.map((a) => [a.id, a.manifest]));
  const context: AnalysisContext = {
    manifests,
    events: sorted,
    errors,
    groups,
    arrivalOrderInferred,
  };

  const findings: DiagnosticFinding[] = [];
  const providersPresent = new Set([
    ...events.map((e) => e.provider),
    ...errors.map((e) => e.provider),
  ]);
  for (const rule of options.rules) {
    if (!rule.providers.includes("*") && !rule.providers.some((p) => providersPresent.has(p)))
      continue;
    try {
      for (const f of rule.evaluate(context))
        findings.push({ ...f, ruleId: rule.id, ruleVersion: rule.version });
    } catch (e) {
      warnings.push({
        code: "RULE_FAILED",
        message: `Rule ${rule.id} failed and was skipped: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (summaries.length > 0 && !summaries.some((s) => s.status === "analyzed")) {
    warnings.push({
      code: "NO_ANALYZABLE_RECORDS",
      message: "None of the supplied records could be analyzed.",
    });
  }
  if (sensitivePaths.length > 0) {
    warnings.push({
      code: "SENSITIVE_DATA_DETECTED",
      message: `Possible sensitive data found in ${sensitivePaths.length} field(s). It is hidden in the inspector and excluded from exports. Automatic detection is not exhaustive.`,
    });
  }

  return {
    meta: {
      analyzedAt: now().toISOString(),
      coreVersion: CORE_VERSION,
      catalogVersion: options.catalogVersion,
      rules: options.rules.map((r) => ({ id: r.id, version: r.version })),
      adapters: options.adapters.map((a) => ({ id: a.id, version: a.version })),
      providerOverride: override,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
    },
    records: summaries,
    events: sorted,
    groups,
    errors,
    findings,
    warnings,
    sensitiveData: { detected: sensitivePaths.length > 0, fieldPaths: sensitivePaths },
    suggestedView: errors.length > 0 && events.length <= 1 ? "decoder" : "timeline",
    arrivalOrderInferred,
  };
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;

function safeDetect(
  adapter: ProviderAdapter<any>,
  payload: unknown,
  meta: RecordMeta,
): DetectionResult {
  try {
    return adapter.detect(payload, meta);
  } catch {
    return { provider: adapter.id, format: null, confidence: 0, supported: false, reasons: [] };
  }
}

/**
 * Stable chronological order: event time, then observation time, then source
 * order. Events without an event timestamp keep their source position
 * relative to each other and sort after timestamped events.
 */
export function sortEvents(events: readonly NormalizedEvent[]): NormalizedEvent[] {
  const timeOf = (e: NormalizedEvent) => (e.eventTimestamp ? Date.parse(e.eventTimestamp) : NaN);
  const inInput = [...events].sort((a, b) => a.sourceIndex - b.sourceIndex);
  const timed = inInput.filter((e) => !Number.isNaN(timeOf(e)));
  timed.sort((a, b) => {
    const ta = timeOf(a);
    const tb = timeOf(b);
    if (ta !== tb) return ta < tb ? -1 : 1;
    const oa = a.observedTimestamp ? Date.parse(a.observedTimestamp) : Number.POSITIVE_INFINITY;
    const ob = b.observedTimestamp ? Date.parse(b.observedTimestamp) : Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa < ob ? -1 : 1;
    return a.sourceIndex - b.sourceIndex;
  });
  // An event without its own time stays right after the timed event that
  // precedes it in the input; untimed events before any timed one lead.
  const leading: NormalizedEvent[] = [];
  const after = new Map<NormalizedEvent, NormalizedEvent[]>();
  let anchor: NormalizedEvent | undefined;
  for (const e of inInput) {
    if (!Number.isNaN(timeOf(e))) anchor = e;
    else if (anchor) after.set(anchor, [...(after.get(anchor) ?? []), e]);
    else leading.push(e);
  }
  return [...leading, ...timed.flatMap((e) => [e, ...(after.get(e) ?? [])])];
}

/**
 * Union-find over provider-specific correlation keys. Events only join a group
 * when they share an explicit identifier; unrelated transactions stay apart.
 */
export function correlate(
  events: readonly NormalizedEvent[],
  adapters: readonly ProviderAdapter<any>[],
): TransactionGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const byId = new Map(adapters.map((a) => [a.id, a]));
  const keysOf = new Map<string, string[]>();

  for (const e of events) {
    const node = `event:${e.id}`;
    parent.set(node, node);
    const keys = (byId.get(e.provider)?.correlationKeys(e) ?? []).map((k) => `${e.provider}:${k}`);
    keysOf.set(e.id, keys);
    for (const k of keys) {
      if (!parent.has(k)) parent.set(k, k);
      union(node, k);
    }
  }

  const groups = new Map<string, NormalizedEvent[]>();
  for (const e of events) {
    const root = find(`event:${e.id}`);
    const list = groups.get(root);
    if (list) list.push(e);
    else groups.set(root, [e]);
  }

  let n = 0;
  return [...groups.values()].map((list) => {
    const refs = new Set<string>();
    for (const e of list)
      for (const k of keysOf.get(e.id) ?? []) refs.add(k.slice(e.provider.length + 1));
    const timed = list.filter((e) => e.eventTimestamp);
    const latest = (timed.length > 0 ? timed : list).at(-1)!;
    return {
      id: `grp-${++n}`,
      provider: list[0]!.provider,
      references: [...refs],
      eventIds: list.map((e) => e.id),
      latestOutcome: latest.outcome,
    };
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const ZONED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/** An ISO 8601 date-time with `Z` or an offset that Date.parse accepts. */
function isZonedIso(value: string): boolean {
  return value.length <= 40 && ZONED_ISO.test(value) && Number.isFinite(Date.parse(value));
}

/** Accepts ISO strings and Unix seconds; returns ISO 8601 UTC or undefined. */
export function toIsoTimestamp(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Unix seconds (Stripe). Millisecond values would be > year 33658 here.
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof value === "string" && value.length <= 64) {
    // A date-time without a zone would be read in the local time zone and give
    // different results on different machines; treat it as unknown instead.
    if (/\d[T ]\d{2}:\d{2}/.test(value) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim()))
      return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function lenientWarning(repairs: readonly JsonRepair[], source?: string): AnalysisWarning | null {
  if (repairs.length === 0) return null;
  const what = repairs
    .map((r) => (r === "trailing_commas" ? "trailing commas" : "comments"))
    .join(" and ");
  return {
    code: "LENIENT_JSON",
    message: `${source ? `${source}: ` : ""}The input is not strict JSON. Removed ${what} before parsing.`,
  };
}

/** JSON with object keys sorted at every level, so equal content gives equal text. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** Two 32-bit FNV-1a hashes with different offsets, as 16 hex characters. */
function fingerprint(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
