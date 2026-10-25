import { describe, expect, it } from "vitest";
import { parseInput, parseXml } from "@pandapaylens/core";

const limits = { maxDepth: 64, maxElements: 50_000, maxStringLength: 100_000 };

describe("parseInput with XML", () => {
  it("turns one document into one record with attributes, repeats and text", () => {
    const r = parseInput(
      '<?xml version="1.0"?><payment_response status="declined"><code>05</code><code>51</code><note>a &amp; b</note></payment_response>',
    );
    expect(r.ok && r.value.format).toBe("xml");
    expect(r.ok && r.value.records).toEqual([
      { payment_response: { "@status": "declined", code: ["05", "51"], note: "a & b" } },
    ]);
    expect(r.ok && r.value.meta[0]!.xml).toEqual({ root: "payment_response" });
  });

  it("strips namespace prefixes and keeps the root namespace", () => {
    const r = parseInput(
      '<ns2:refund-response xmlns:ns2="http://ws.plimus.com"><ns2:status>FAILED</ns2:status></ns2:refund-response>',
    );
    expect(r.ok && r.value.records).toEqual([{ "refund-response": { status: "FAILED" } }]);
    expect(r.ok && r.value.meta[0]!.xml).toEqual({
      root: "refund-response",
      namespace: "http://ws.plimus.com",
    });
  });

  it("reads CDATA, skips comments and processing instructions", () => {
    const r = parseInput("<r><!-- note --><m><![CDATA[1 < 2 & <b>]]></m><?pi x?></r>");
    expect(r.ok && r.value.records).toEqual([{ r: { m: "1 < 2 & <b>" } }]);
  });

  it("parses an XML body of a raw HTTP response", () => {
    const r = parseInput(
      "HTTP/1.1 200 OK\nContent-Type: text/xml\n\n<response><status>-2</status></response>",
    );
    expect(r.ok && r.value.format).toBe("http");
    expect(r.ok && r.value.records).toEqual([{ response: { status: "-2" } }]);
    expect(r.ok && r.value.meta[0]!.http?.status).toBe(200);
    expect(r.ok && r.value.meta[0]!.xml?.root).toBe("response");
  });

  it("removes prototype-pollution names", () => {
    const r = parseInput(
      "<r><__proto__><x>1</x></__proto__><constructor>2</constructor><a>3</a></r>",
    );
    expect(r.ok && r.value.records).toEqual([{ r: { a: "3" } }]);
    expect(r.ok && r.value.removedKeys.length).toBe(2);
  });
});

describe("XML safety", () => {
  const reject = (xml: string) => {
    const r = parseInput(xml);
    expect(r.ok).toBe(false);
    return r.ok ? "" : `${r.error.code}: ${r.error.message}`;
  };

  it("rejects DOCTYPE and entity declarations (XXE, entity expansion)", () => {
    expect(
      reject(
        '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>',
      ),
    ).toMatch(/INVALID_XML: DOCTYPE/);
    expect(
      reject('<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><lolz>&lol2;</lolz>'),
    ).toMatch(/INVALID_XML/);
  });

  it("rejects unknown entities and keeps predefined and numeric ones", () => {
    expect(reject("<r>&nbsp;</r>")).toMatch(/Unknown entity/);
    const r = parseInput("<r>&lt;&#65;&#x42;&apos;&quot;&gt;</r>");
    expect(r.ok && r.value.records).toEqual([{ r: "<AB'\">" }]);
  });

  it("reports malformed documents with a position", () => {
    const r = parseInput("<r>\n  <a>1</b>\n</r>");
    expect(r).toMatchObject({ ok: false, error: { code: "INVALID_XML", line: 2 } });
    expect(reject("<r><a>1</a>")).toMatch(/not closed/);
    expect(reject("<a/><b/>")).toMatch(/Only one root/);
    expect(reject("<r a=1 />")).toMatch(/quoted/);
  });

  it("enforces depth and element limits", () => {
    expect(reject(`${"<a>".repeat(70)}${"</a>".repeat(70)}`)).toMatch(/nested deeper/);
    const many = parseXml(`<r>${"<i/>".repeat(60)}</r>`, { ...limits, maxElements: 50 });
    expect(many.ok).toBe(false);
  });

  it("stays fast on large and pathological input", () => {
    const started = Date.now();
    parseInput(`<r>${"<i>x</i>".repeat(40_000)}</r>`);
    parseInput(`<r a="${"&amp;".repeat(20_000)}"/>`);
    parseInput(`<r>${"<".repeat(50_000)}`);
    parseInput(`<r>${"&".repeat(50_000)}</r>`);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
