import { describe, expect, it } from "vitest";
import { locateSyntaxError, parseInput, positionToLineColumn, relaxJson } from "@pandapaylens/core";

describe("parseInput", () => {
  it("parses a single object as one record", () => {
    const r = parseInput('{"a":1}');
    expect(r.ok && r.value).toEqual({
      format: "json",
      records: [{ a: 1 }],
      meta: [{ format: "json" }],
      removedKeys: [],
      jsonRepairs: [],
    });
  });

  it("splits a top-level array into records", () => {
    const r = parseInput('[1, {"b":2}]');
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

describe("format detection", () => {
  it("parses URL-encoded form data into one record", () => {
    const r = parseInput("transactionid=123&status=0&errormessage=Approved+ok&x=1&x=2\n");
    expect(r.ok && r.value.format).toBe("form");
    expect(r.ok && r.value.records[0]).toEqual({
      transactionid: "123",
      status: "0",
      errormessage: "Approved ok",
      x: ["1", "2"],
    });
    expect(r.ok && r.value.meta[0]).toEqual({ format: "form" });
  });

  it("does not treat JSON as form data", () => {
    const r = parseInput('{"a=b":1}');
    expect(r.ok && r.value.format).toBe("json");
  });

  it("drops dangerous form keys", () => {
    const r = parseInput("__proto__=x&a=1");
    expect(r.ok && r.value.records[0]).toEqual({ a: "1" });
  });

  it("parses a raw HTTP request with a form body and redacts sensitive headers", () => {
    const text = [
      "POST /webhooks/psp?token=abc HTTP/1.1",
      "Host: example.com",
      "Content-Type: application/x-www-form-urlencoded",
      "X-Signature: deadbeef",
      "Authorization: Bearer abc",
      "",
      "id=tr_123",
    ].join("\r\n");
    const r = parseInput(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.format).toBe("http");
      expect(r.value.records[0]).toEqual({ id: "tr_123" });
      expect(r.value.meta[0]!.http).toEqual({
        kind: "request",
        method: "POST",
        path: "/webhooks/psp",
        contentType: "application/x-www-form-urlencoded",
        query: { token: "[redacted]" },
        headers: {
          host: "example.com",
          "content-type": "application/x-www-form-urlencoded",
          "x-signature": "[redacted]",
          authorization: "[redacted]",
        },
      });
    }
  });

  it("parses a raw HTTP response with a JSON body and keeps the status", () => {
    const r = parseInput(
      [
        "HTTP/1.1 402 Payment Required",
        "Content-Type: application/json",
        "",
        '{"error":{"type":"card_error"}}',
      ].join("\n"),
    );
    expect(r.ok && r.value.meta[0]!.http).toMatchObject({ kind: "response", status: 402 });
    expect(r.ok && r.value.records[0]).toEqual({ error: { type: "card_error" } });
  });

  it("rejects HTTP messages without a body or with malformed headers", () => {
    expect(parseInput("GET / HTTP/1.1\nHost: x\n\n")).toMatchObject({
      ok: false,
      error: { code: "INVALID_HTTP" },
    });
    expect(parseInput("POST / HTTP/1.1\nnot a header\n\n{}")).toMatchObject({
      ok: false,
      error: { code: "INVALID_HTTP" },
    });
  });

  it("still reports JSON errors for broken JSON", () => {
    expect(parseInput("{ broken")).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
  });
});

describe("multi-line form input", () => {
  it("parses one form record per line", () => {
    const r = parseInput("transactionid=1&type=order\ntransactionid=1&type=capture\n");
    expect(r.ok && r.value.format).toBe("form");
    expect(r.ok && r.value.records).toEqual([
      { transactionid: "1", type: "order" },
      { transactionid: "1", type: "capture" },
    ]);
  });
});

describe("HTTP status-only responses", () => {
  it("keeps the reason phrase and accepts error responses without a body", () => {
    const r = parseInput("HTTP/1.1 699 Declined: card 4242424242424242 bad\nContent-Length: 0\n\n");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.records).toEqual([{}]);
      expect(r.value.meta[0]!.http).toMatchObject({ kind: "response", status: 699 });
      expect(r.value.meta[0]!.http!.reason).toBe("Declined: card [redacted] bad");
    }
  });

  it("still rejects bodiless successful responses and requests", () => {
    expect(parseInput("HTTP/1.1 200 OK\n\n")).toMatchObject({
      ok: false,
      error: { code: "INVALID_HTTP" },
    });
  });
});

describe("query-string callbacks", () => {
  it("parses the query string of a GET request without a body", () => {
    const r = parseInput("GET /postback?saleID=1&event=rebill HTTP/1.1\nHost: x\n\n");
    expect(r.ok && r.value.records).toEqual([{ saleID: "1", event: "rebill" }]);
    expect(r.ok && r.value.meta[0]!.http).toMatchObject({ method: "GET", path: "/postback" });
  });

  it("parses a pasted callback URL as form data", () => {
    const r = parseInput("https://example.com/cb?shopID=7&saleID=9\n");
    expect(r.ok && r.value.format).toBe("form");
    expect(r.ok && r.value.records).toEqual([{ shopID: "7", saleID: "9" }]);
  });
});

describe("request query metadata and spaced form values", () => {
  it("keeps request query parameters as redacted metadata", () => {
    const r = parseInput(
      "POST /hook?clientAccnum=1&eventType=NewSaleSuccess&token=abc HTTP/1.1\nContent-Type: application/x-www-form-urlencoded\n\nsubscriptionId=9",
    );
    expect(r.ok && r.value.meta[0]!.http!.query).toEqual({
      clientAccnum: "1",
      eventType: "NewSaleSuccess",
      token: "[redacted]",
    });
    expect(r.ok && r.value.records[0]).toEqual({ subscriptionId: "9" });
  });

  it("accepts unencoded spaces in form values", () => {
    const r = parseInput("subscriptionId=9&timestamp=2013-01-25 03:22:44");
    expect(r.ok && r.value.records[0]).toEqual({
      subscriptionId: "9",
      timestamp: "2013-01-25 03:22:44",
    });
  });
});

describe("documentation-style inputs", () => {
  it("joins form continuation lines that start with &", () => {
    const r = parseInput("unique_id=PPLsynth1\n&status=approved\n&amount=100");
    expect(r.ok && r.value.records).toEqual([
      { unique_id: "PPLsynth1", status: "approved", amount: "100" },
    ]);
  });

  it("parses form bodies labelled text/plain", () => {
    const r = parseInput(
      "HTTP/1.1 200 OK\nContent-Type: text/plain\n\nresponse=1&responsetext=SUCCESS&response_code=100",
    );
    expect(r.ok && r.value.records[0]).toEqual({
      response: "1",
      responsetext: "SUCCESS",
      response_code: "100",
    });
  });

  it("parses XML documents and XML HTTP bodies into records", () => {
    expect(
      parseInput("<payment_response><status>approved</status></payment_response>"),
    ).toMatchObject({
      ok: true,
      value: { format: "xml", records: [{ payment_response: { status: "approved" } }] },
    });
    expect(parseInput("HTTP/1.1 200 OK\nContent-Type: text/xml\n\n<a/>")).toMatchObject({
      ok: true,
      value: { format: "http", records: [{ a: "" }] },
    });
  });
});

describe("documentation-style JSON", () => {
  it("removes trailing commas and reports the repair", () => {
    const r = parseInput(
      '{\n  "error": {\n    "code": 407,\n    "message": "Currency mismatch",\n  }\n}',
    );
    expect(r.ok && r.value.records).toEqual([
      { error: { code: 407, message: "Currency mismatch" } },
    ]);
    expect(r.ok && r.value.jsonRepairs).toEqual(["trailing_commas"]);
  });

  it("removes line and block comments, also next to a trailing comma", () => {
    const r = parseInput('{\n  "a": 1, // first\n  /* note */ "b": [1, 2,], // last\n}');
    expect(r.ok && r.value.records).toEqual([{ a: 1, b: [1, 2] }]);
    expect(r.ok && r.value.jsonRepairs).toEqual(["trailing_commas", "comments"]);
  });

  it("never changes commas or comment markers inside strings", () => {
    const r = parseInput('{"url": "https://x.test/a,]", "c": "/* keep */", "d": "a\\",}",}');
    expect(r.ok && r.value.records).toEqual([
      { url: "https://x.test/a,]", c: "/* keep */", d: 'a",}' },
    ]);
  });

  it("repairs each line of JSON Lines", () => {
    const r = parseInput('{"a": 1,}\n{"b": 2}');
    expect(r.ok && r.value.format).toBe("jsonl");
    expect(r.ok && r.value.records).toEqual([{ a: 1 }, { b: 2 }]);
    expect(r.ok && r.value.jsonRepairs).toEqual(["trailing_commas"]);
  });

  it("reports the original error when the input is still invalid", () => {
    const r = parseInput('{"a": 1,, }');
    expect(r).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
    expect(parseInput("{'a': 1}")).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
    expect(parseInput('{"a": 1 /* open')).toMatchObject({
      ok: false,
      error: { code: "INVALID_JSON" },
    });
  });

  it("still removes prototype-pollution keys after a repair", () => {
    const r = parseInput('{"__proto__": {"x": 1}, "a": 1,}');
    expect(r.ok && r.value.records).toEqual([{ a: 1 }]);
    expect(r.ok && r.value.removedKeys.map((k) => k.path)).toEqual(["__proto__"]);
  });

  it("leaves strict JSON untouched", async () => {
    const fc = (await import("fast-check")).default;
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4 }), (v) => {
        const text = JSON.stringify(v, null, 2);
        expect(relaxJson(text)).toEqual({ text, repairs: [] });
        const r = parseInput(text);
        if (r.ok) expect(r.value.jsonRepairs).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });
});

describe("plain-text and HTML error bodies", () => {
  it("keeps a plain-text error body as scrubbed metadata on a status-only record", () => {
    const r = parseInput(
      "HTTP/1.1 400 Bad Request\nContent-Type: text/plain\n\nInvalid order   status\nor refund timeout",
    );
    expect(r.ok && r.value.records).toEqual([{}]);
    expect(r.ok && r.value.meta[0]!.http).toMatchObject({
      status: 400,
      bodyText: "Invalid order status or refund timeout",
    });
  });

  it("scrubs card numbers and caps the length", () => {
    const r = parseInput(`HTTP/1.1 422 Unprocessable\n\nCard 4242424242424242 ${"x".repeat(900)}`);
    const text = r.ok ? r.value.meta[0]!.http!.bodyText! : "";
    expect(text).not.toContain("4242424242424242");
    expect(text.length).toBeLessThanOrEqual(500);
  });

  it("ignores an HTML error page but keeps the status", () => {
    const r = parseInput(
      "HTTP/1.1 502 Bad Gateway\nContent-Type: text/html\n\n<html><body><h1>502</h1></body></html>",
    );
    expect(r.ok && r.value.records).toEqual([{}]);
    expect(r.ok && r.value.meta[0]!.http).toMatchObject({ status: 502 });
    expect(r.ok && r.value.meta[0]!.http!.bodyText).toBeUndefined();
  });

  it("does not change successful responses or JSON-looking error bodies", () => {
    expect(parseInput("HTTP/1.1 200 OK\nContent-Type: text/plain\n\nall good")).toMatchObject({
      ok: false,
    });
    expect(parseInput('HTTP/1.1 400 Bad Request\n\n{"broken": ')).toMatchObject({
      ok: false,
      error: { code: "INVALID_JSON" },
    });
  });
});

describe("sensitive request headers", () => {
  it("hides verif-hash, x-login and x-client-id values", () => {
    const r = parseInput(
      'POST /webhook HTTP/1.1\nverif-hash: PPLsynthSecretHash\nx-login: PPLsynthLogin\nx-client-id: PPLsynthClient\nContent-Type: application/json\n\n{"event":"charge.completed"}',
    );
    const headers = r.ok ? r.value.meta[0]!.http!.headers : {};
    expect(headers["verif-hash"]).toBe("[redacted]");
    expect(headers["x-login"]).toBe("[redacted]");
    expect(headers["x-client-id"]).toBe("[redacted]");
    expect(headers["content-type"]).toBe("application/json");
  });
});
