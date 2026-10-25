import { describe, expect, it } from "vitest";
import { parseInput } from "@pandapaylens/core";

describe("plain key: value text", () => {
  it("reads one name: value pair per line into one record", () => {
    const r = parseInput(
      "response: FOUND\nsaleID: PPLsynth01\ncreatedOn: 27-DEC-2014 03:22:12\nbillingAddr_fullName:\n",
    );
    expect(r.ok && r.value.format).toBe("text");
    expect(r.ok && r.value.records).toEqual([
      {
        response: "FOUND",
        saleID: "PPLsynth01",
        createdOn: "27-DEC-2014 03:22:12",
        billingAddr_fullName: "",
      },
    ]);
  });

  it("keeps repeated names as lists and tolerates blank lines and CRLF", () => {
    const r = parseInput("a: 1\r\n\r\nb: x: y\r\na: 2\r\n");
    expect(r.ok && r.value.records).toEqual([{ a: ["1", "2"], b: "x: y" }]);
  });

  it("does not read sentences, single lines or JSON-like text as key-value", () => {
    for (const text of [
      "Error: transaction not found",
      "Invalid order status\nPlease try again",
      '"response": "FOUND"\n"saleID": "1"',
      "response : FOUND\nsaleID: 1",
      "response:FOUND\nsaleID:1",
    ]) {
      const r = parseInput(text);
      expect(r.ok && r.value.format, text).not.toBe("text");
    }
  });

  it("removes prototype-pollution names", () => {
    const r = parseInput("constructor: x\nprototype: y\nsaleID: PPLsynth01");
    expect(r.ok && r.value.records).toEqual([{ saleID: "PPLsynth01" }]);
  });

  it("reads a text/plain HTTP response body the same way", () => {
    const r = parseInput(
      "HTTP/1.1 200 OK\nContent-Type: text/plain; charset=utf-8\n\nresponse: NOTFOUND\nsaleID: PPLsynth02\n",
    );
    expect(r.ok && r.value.format).toBe("http");
    expect(r.ok && r.value.records).toEqual([{ response: "NOTFOUND", saleID: "PPLsynth02" }]);
    expect(r.ok && r.value.meta[0]!.http?.status).toBe(200);
  });

  it("accepts a single line only in a text/plain success body", () => {
    const ok = parseInput("HTTP/1.1 200 OK\nContent-Type: text/plain\n\nresponse: NOTFOUND\n");
    expect(ok.ok && ok.value.records).toEqual([{ response: "NOTFOUND" }]);
    const error = parseInput(
      "HTTP/1.1 400 Bad Request\nContent-Type: text/plain\n\nError: bad id\n",
    );
    expect(error.ok && error.value.records).toEqual([{}]);
    expect(error.ok && error.value.meta[0]!.http?.bodyText).toBe("Error: bad id");
    const alone = parseInput("response: NOTFOUND");
    expect(alone.ok && alone.value.format).not.toBe("text");
  });

  it("enforces the field limit", () => {
    const text = Array.from({ length: 1001 }, (_, i) => `k${i}: v`).join("\n");
    expect(parseInput(text)).toMatchObject({ ok: false });
  });
});

describe("form data with inherited property names", () => {
  it("does not merge a field with Object.prototype members", () => {
    const r = parseInput("toString=a&valueOf=b&id=PPLsynth");
    expect(r.ok && r.value.records).toEqual([{ toString: "a", valueOf: "b", id: "PPLsynth" }]);
  });
});
