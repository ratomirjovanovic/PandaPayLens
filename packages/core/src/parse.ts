/**
 * Strict, bounded parsing for untrusted input.
 *
 * Format detection runs before provider detection. Supported input formats:
 * JSON, JSON arrays, JSON Lines, URL-encoded form data (e.g. IPN callbacks)
 * and raw HTTP request/response messages whose body is JSON or form data.
 *
 * Input is treated as data only: no revivers that construct objects, no eval,
 * no URL fetching. Limits are checked with a linear pre-scan before
 * `JSON.parse`, so pathological nesting fails with a typed error instead of a
 * stack overflow.
 */

export type InputLimits = {
  /** Maximum size of one input text, in bytes (UTF-8). */
  maxBytes: number;
  /** Maximum object/array nesting depth. */
  maxDepth: number;
  /** Maximum number of top-level records (array elements or JSONL lines). */
  maxRecords: number;
  /** Maximum length of any single string value or key. */
  maxStringLength: number;
};

export const DEFAULT_LIMITS: Readonly<InputLimits> = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxDepth: 64,
  maxRecords: 5000,
  maxStringLength: 100_000,
});

/** Default limit for all files imported into one analysis session. */
export const DEFAULT_SESSION_MAX_BYTES = 20 * 1024 * 1024;

export type ParseErrorCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LARGE"
  | "INVALID_JSON"
  | "NESTING_TOO_DEEP"
  | "STRING_TOO_LONG"
  | "TOO_MANY_RECORDS"
  | "INVALID_FORM"
  | "INVALID_HTTP";

export type ParseError = {
  code: ParseErrorCode;
  message: string;
  line?: number;
  column?: number;
};

export type InputFormat = "json" | "jsonl" | "form" | "http";

/** How a record arrived. HTTP metadata is untrusted and already redacted. */
export type RecordMeta = {
  format: InputFormat;
  http?: {
    kind: "request" | "response";
    method?: string;
    /** Path without query string. */
    path?: string;
    status?: number;
    contentType?: string;
    /** Lowercased names; sensitive values replaced with "[redacted]". */
    headers: Record<string, string>;
  };
};

export type ParsedInput = {
  format: InputFormat;
  /** Top-level records. A JSON array is split into its elements. */
  records: unknown[];
  /** Parallel to `records`. */
  meta: RecordMeta[];
  removedKeys: { recordIndex: number; path: string }[];
};

type Parsed = { ok: true; value: ParsedInput } | { ok: false; error: ParseError };

/** Keys that could be used for prototype pollution if a consumer merges objects. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function parseInput(text: string, limits: Partial<InputLimits> = {}): Parsed {
  const lim: InputLimits = { ...DEFAULT_LIMITS, ...limits };

  // Cheap upper bound first, exact count only when it could matter.
  if (
    text.length > lim.maxBytes ||
    (text.length * 3 > lim.maxBytes && byteLength(text) > lim.maxBytes)
  ) {
    return fail("INPUT_TOO_LARGE", `Input exceeds the ${formatBytes(lim.maxBytes)} limit.`);
  }

  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (body.trim() === "") {
    return fail("EMPTY_INPUT", "The input is empty.");
  }

  const start = body.trimStart();
  if (/^HTTP\/\d(?:\.\d)? \d{3}/.test(start) || /^[A-Z]{3,7} \S+ HTTP\/\d/.test(start)) {
    return parseHttp(start, lim);
  }
  if (FORM_LIKE.test(start.trimEnd()))
    return parseFormText(start.trimEnd(), lim, { format: "form" });
  // Several form-encoded notifications, one per line (e.g. a callback log).
  const formLines = start
    .trimEnd()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (formLines.length > 1 && formLines.every((l) => FORM_LIKE.test(l.trim()))) {
    if (formLines.length > lim.maxRecords) {
      return fail(
        "TOO_MANY_RECORDS",
        `Input contains ${formLines.length} lines; the limit is ${lim.maxRecords}.`,
      );
    }
    const records: unknown[] = [];
    for (const line of formLines) {
      const one = parseFormText(line.trim(), lim, { format: "form" });
      if (!one.ok) return one;
      records.push(one.value.records[0]);
    }
    return finish("form", records, { format: "form" });
  }
  return parseJsonText(body, lim, { format: "json" });
}

/** key=value pairs joined by &, no whitespace: application/x-www-form-urlencoded. */
const FORM_LIKE = /^[^=&\s{}[\]"]+=[^&\s]*(?:&[^=&\s]+=[^&\s]*)*$/;

function parseJsonText(body: string, lim: InputLimits, meta: RecordMeta): Parsed {
  const whole = parseDocument(body, lim, 0);
  if (whole.ok) {
    const records = Array.isArray(whole.value) ? whole.value : [whole.value];
    if (records.length > lim.maxRecords) {
      return fail(
        "TOO_MANY_RECORDS",
        `Input contains ${records.length} records; the limit is ${lim.maxRecords}.`,
      );
    }
    return finish(meta.format === "http" ? "http" : "json", records, meta);
  }

  // Not a single document: try JSON Lines, but only if there is more than one
  // non-empty line. Otherwise the single-document error is the useful one.
  const lines = body.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  if (nonEmpty.length < 2 || whole.error.code !== "INVALID_JSON") {
    return { ok: false, error: whole.error };
  }
  if (nonEmpty.length > lim.maxRecords) {
    return fail(
      "TOO_MANY_RECORDS",
      `Input contains ${nonEmpty.length} lines; the limit is ${lim.maxRecords}.`,
    );
  }
  const records: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const parsed = parseDocument(line, lim, i);
    if (!parsed.ok) {
      // A JSONL failure is only plausible if the first line parsed; otherwise
      // report the original single-document error.
      if (records.length === 0) return { ok: false, error: whole.error };
      return {
        ok: false,
        error: { ...parsed.error, message: `Line ${i + 1}: ${parsed.error.message}` },
      };
    }
    records.push(parsed.value);
  }
  return meta.format === "http"
    ? finish("http", records, meta)
    : finish("jsonl", records, { format: "jsonl" });
}

function finish(
  format: InputFormat,
  raw: unknown[],
  meta: RecordMeta,
): { ok: true; value: ParsedInput } {
  const removedKeys: ParsedInput["removedKeys"] = [];
  const records = raw.map((r, i) => sanitize(r, i, "", removedKeys));
  return { ok: true, value: { format, records, meta: records.map(() => meta), removedKeys } };
}

const MAX_FORM_FIELDS = 1000;

/** Parses URL-encoded form data into one record of string (or string[]) values. */
function parseFormText(text: string, lim: InputLimits, meta: RecordMeta): Parsed {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(text);
  } catch {
    return fail("INVALID_FORM", "The input looks like form data but could not be decoded.");
  }
  const out: Record<string, string | string[]> = {};
  let n = 0;
  for (const [key, value] of params) {
    if (++n > MAX_FORM_FIELDS)
      return fail("INVALID_FORM", `Form data has more than ${MAX_FORM_FIELDS} fields.`);
    if (key.length > 256 || value.length > lim.maxStringLength) {
      return fail("STRING_TOO_LONG", "A form field exceeds the length limit.");
    }
    if (key === "") continue;
    const prev = out[key];
    out[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  if (Object.keys(out).length === 0)
    return fail("INVALID_FORM", "The form data contains no fields.");
  return finish(meta.format === "http" ? "http" : "form", [out], meta);
}

const SENSITIVE_HEADER =
  /authorization|cookie|signature|token|secret|key|hmac|auth|password|session|sig|cert/i;

/**
 * Raw HTTP request or response, e.g. copied from a webhook log. Headers are
 * kept as untrusted context only; a pasted signature header is never treated
 * as proof that the message came from the provider.
 */
function parseHttp(text: string, lim: InputLimits): Parsed {
  const split = /\r?\n\r?\n/.exec(text);
  const head = split ? text.slice(0, split.index) : text;
  const body = split ? text.slice(split.index + split[0].length) : "";
  const lines = head.split(/\r?\n/);
  const first = lines.shift() ?? "";
  if (lines.length > 200)
    return fail("INVALID_HTTP", "The HTTP message has too many header lines.");
  const http: NonNullable<RecordMeta["http"]> = { kind: "request", headers: {} };
  const res = /^HTTP\/\d(?:\.\d)? (\d{3})/.exec(first);
  if (res) {
    http.kind = "response";
    http.status = Number(res[1]);
  } else {
    const req = /^([A-Z]{3,7}) (\S+) HTTP\/\d/.exec(first);
    if (!req) return fail("INVALID_HTTP", "Unrecognized HTTP start line.");
    http.method = req[1]!;
    http.path = req[2]!.split("?")[0]!.slice(0, 512);
  }
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i <= 0) return fail("INVALID_HTTP", "Malformed HTTP header line.");
    const name = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (name === "__proto__" || name === "constructor" || name === "prototype") continue;
    http.headers[name] = SENSITIVE_HEADER.test(name) ? "[redacted]" : value.slice(0, 256);
  }
  const ct = http.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (ct) http.contentType = ct;
  const meta: RecordMeta = { format: "http", http };
  const trimmed = body.trim();
  if (trimmed === "") return fail("INVALID_HTTP", "The HTTP message has no body to analyze.");
  if (ct === "application/x-www-form-urlencoded" || (!ct && FORM_LIKE.test(trimmed))) {
    return parseFormText(trimmed, lim, meta);
  }
  return parseJsonText(trimmed, lim, meta);
}

function parseDocument(
  text: string,
  lim: InputLimits,
  lineOffset: number,
): { ok: true; value: unknown } | { ok: false; error: ParseError } {
  const scan = scanStructure(text, lim);
  if (scan) {
    const pos = positionToLineColumn(text, scan.offset);
    return {
      ok: false,
      error: {
        code: scan.code,
        message: scan.message,
        line: pos.line + lineOffset,
        column: pos.column,
      },
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const pos = extractPosition(text, message);
    return {
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: humanizeJsonError(message),
        ...(pos ? { line: pos.line + lineOffset, column: pos.column } : {}),
      },
    };
  }
}

/** Linear scan for depth and string length; ignores brackets inside strings. */
function scanStructure(
  text: string,
  lim: InputLimits,
): { code: ParseErrorCode; message: string; offset: number } | null {
  let depth = 0;
  let inString = false;
  let stringStart = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c /* \ */) {
        i++;
      } else if (c === 0x22 /* " */) {
        inString = false;
      }
      if (i - stringStart > lim.maxStringLength) {
        return {
          code: "STRING_TOO_LONG",
          message: `A string exceeds ${lim.maxStringLength} characters.`,
          offset: stringStart,
        };
      }
      continue;
    }
    if (c === 0x22) {
      inString = true;
      stringStart = i;
    } else if (c === 0x7b /* { */ || c === 0x5b /* [ */) {
      depth++;
      if (depth > lim.maxDepth) {
        return {
          code: "NESTING_TOO_DEEP",
          message: `Nesting exceeds the depth limit of ${lim.maxDepth}.`,
          offset: i,
        };
      }
    } else if (c === 0x7d || c === 0x5d) {
      depth--;
    }
  }
  return null;
}

/**
 * Rebuild the value without dangerous keys. JSON.parse already defines
 * `__proto__` as an own property rather than the prototype, but downstream
 * code (or a consumer's spread/merge) should never see it at all.
 */
function sanitize(
  value: unknown,
  recordIndex: number,
  path: string,
  removed: ParsedInput["removedKeys"],
): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => sanitize(v, recordIndex, `${path}[${i}]`, removed));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const childPath = path === "" ? key : `${path}.${key}`;
      if (DANGEROUS_KEYS.has(key)) {
        removed.push({ recordIndex, path: childPath });
        continue;
      }
      out[key] = sanitize((value as Record<string, unknown>)[key], recordIndex, childPath, removed);
    }
    return out;
  }
  return value;
}

function extractPosition(text: string, message: string): { line: number; column: number } | null {
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  const p = /position (\d+)/i.exec(message);
  if (p) return positionToLineColumn(text, Number(p[1]));
  // Some engines omit the position; find it ourselves.
  const offset = locateSyntaxError(text);
  return offset === null ? null : positionToLineColumn(text, offset);
}

/**
 * Offset of the first JSON syntax error, or null if none is found. A small
 * iterative state machine (no recursion), used only to report a location.
 */
export function locateSyntaxError(text: string): number | null {
  const stack: ("{" | "[")[] = [];
  // What may come next: a value, an object key (or "}"), ":" , "," or a closer.
  let expect:
    "value" | "value_or_close" | "key" | "key_or_close" | "colon" | "comma_or_close" | "end" =
    "value";
  let i = 0;
  const ws = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";
  while (i < text.length) {
    const c = text[i]!;
    if (ws(c)) {
      i++;
      continue;
    }
    if (expect === "end") return i;
    if (expect === "colon") {
      if (c !== ":") return i;
      expect = "value";
      i++;
      continue;
    }
    if (expect === "comma_or_close") {
      const top = stack.at(-1);
      if (c === ",") {
        expect = top === "{" ? "key" : "value";
        i++;
        continue;
      }
      if ((c === "}" && top === "{") || (c === "]" && top === "[")) {
        stack.pop();
        expect = stack.length ? "comma_or_close" : "end";
        i++;
        continue;
      }
      return i;
    }
    if (expect === "key" || expect === "key_or_close") {
      if (c === "}" && expect === "key_or_close") {
        stack.pop();
        expect = stack.length ? "comma_or_close" : "end";
        i++;
        continue;
      }
      if (c !== '"') return i;
      const end = scanString(text, i);
      if (end < 0) return text.length;
      i = end;
      expect = "colon";
      continue;
    }
    // expect value (or "]" right after "[")
    if (c === "]" && expect === "value_or_close") {
      stack.pop();
      expect = stack.length ? "comma_or_close" : "end";
      i++;
      continue;
    }
    if (c === "{" || c === "[") {
      stack.push(c);
      expect = c === "{" ? "key_or_close" : "value_or_close";
      i++;
      continue;
    }
    let end = -1;
    if (c === '"') end = scanString(text, i);
    else {
      const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(
        text.slice(i, i + 400),
      );
      if (m) end = i + m[0].length;
    }
    if (end < 0) return c === '"' ? text.length : i;
    i = end;
    expect = stack.length ? "comma_or_close" : "end";
  }
  return expect === "end" ? null : text.length;
}

/** Returns the offset just past a JSON string starting at `start`, or -1. */
function scanString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x5c) i++;
    else if (c === 0x22) return i + 1;
    else if (c < 0x20) return -1;
  }
  return -1;
}

export function positionToLineColumn(
  text: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 0x0a) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: end - lastNewline };
}

function humanizeJsonError(message: string): string {
  // Engine messages can quote large chunks of input; keep only the gist.
  const cleaned = message
    .replace(/\s*\(line \d+ column \d+\)/i, "")
    .replace(/ in JSON at position \d+/i, "")
    // V8 can quote the input itself; never echo payload content in errors.
    .replace(/,\s*"[\s\S]*" is not valid JSON$/, "");
  const short = cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned;
  return `Invalid JSON: ${short}`;
}

function fail(code: ParseErrorCode, message: string): { ok: false; error: ParseError } {
  return { ok: false, error: { code, message } };
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n % (1024 * 1024) === 0 ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
