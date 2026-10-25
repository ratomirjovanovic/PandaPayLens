import { describe, expect, it } from "vitest";
import { locateSyntaxError, parseInput, positionToLineColumn } from "@pandapaylens/core";

describe("parseInput", () => {
  it("parses a single object as one record", () => {
    const r = parseInput('{"a":1}');
    expect(r.ok && r.value).toEqual({ format: "json", records: [{ a: 1 }], removedKeys: [] });
  });

  it("splits a top-level array into records", () => {
    const r = parseInput("[1, {\"b\":2}]");
    expect(r.ok && r.value.records).toEqual([1, { b: 2 }]);
  });

  it("parses JSON Lines", () => {
    const r = parseInput('{"a":1}\n\n{"a":2}\r\n{"a":3}\n');
    expect(r.ok && r.value.format).toBe("jsonl");
    expect(r.ok && r.value.records).toHaveLength(3);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseInput('﻿{"a":1}').ok).toBe(true);
  });

  it("rejects empty input", () => {
    const r = parseInput("   \n ");
    expect(!r.ok && r.error.code).toBe("EMPTY_INPUT");
  });

  it("reports line and column for syntax errors", () => {
    const r = parseInput('{\n  "a": 1,\n  "b": }');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("INVALID_JSON");
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBeGreaterThan(0);
      expect(r.error.message).toMatch(/^Invalid JSON/);
    }
  });

  it("reports the failing JSONL line", () => {
    const r = parseInput('{"a":1}\n{"a":2}\n{"a":}');
    expect(!r.ok && r.error.message).toMatch(/^Line 3:/);
  });

  it("enforces the size limit", () => {
    const r = parseInput(`"${"x".repeat(200)}"`, { maxBytes: 100 });
    expect(!r.ok && r.error.code).toBe("INPUT_TOO_LARGE");
  });

  it("counts multi-byte characters toward the size limit", () => {
    const r = parseInput(`"${"€".repeat(40)}"`, { maxBytes: 100 }); // 42 chars, 122 bytes
    expect(!r.ok && r.error.code).toBe("INPUT_TOO_LARGE");
  });

  it("enforces nesting depth without overflowing the stack", () => {
    const deep = "[".repeat(100_000) + "]".repeat(100_000);
    const r = parseInput(deep, { maxBytes: 1_000_000 });
    expect(!r.ok && r.error.code).toBe("NESTING_TOO_DEEP");
  });

  it("ignores brackets inside strings when measuring depth", () => {
    expect(parseInput(`{"s":"${"[".repeat(500)}"}`).ok).toBe(true);
  });

  it("enforces string length", () => {
    const r = parseInput(`{"s":"${"a".repeat(50)}"}`, { maxStringLength: 10 });
    expect(!r.ok && r.error.code).toBe("STRING_TOO_LONG");
  });

  it("enforces record count for arrays and JSONL", () => {
    expect(parseInput("[1,2,3]", { maxRecords: 2 }).ok).toBe(false);
    const r = parseInput("1\n2\n3", { maxRecords: 2 });
    expect(!r.ok && r.error.code).toBe("TOO_MANY_RECORDS");
  });

  it("removes prototype-pollution keys and reports them", () => {
    const r = parseInput('{"__proto__":{"x":1},"a":{"constructor":{"prototype":{}}},"ok":true}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const rec = r.value.records[0] as Record<string, unknown>;
      expect(Object.keys(rec)).toEqual(["a", "ok"]);
      expect(rec.a).toEqual({});
      expect(r.value.removedKeys.map((k) => k.path)).toEqual(["__proto__", "a.constructor"]);
      expect(({} as Record<string, unknown>).x).toBeUndefined();
    }
  });
});

describe("positionToLineColumn", () => {
  it("is 1-based", () => {
    expect(positionToLineColumn("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
    expect(positionToLineColumn("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });
});

describe("locateSyntaxError", () => {
  it("agrees with JSON.parse on validity (property)", async () => {
    const fc = (await import("fast-check")).default;
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4 }), (v) => {
        expect(locateSyntaxError(JSON.stringify(v, null, 1))).toBeNull();
      }),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        let valid = true;
        try {
          JSON.parse(s);
        } catch {
          valid = false;
        }
        expect(locateSyntaxError(s) === null).toBe(valid);
      }),
      { numRuns: 1000 },
    );
  });

  it("points at the offending token", () => {
    expect(locateSyntaxError('{"a": }')).toBe(6);
    expect(locateSyntaxError("[1, 2,]")).toBe(6);
    expect(locateSyntaxError('{"a":1')).toBe(6);
    expect(locateSyntaxError("[] x")).toBe(3);
  });
});
