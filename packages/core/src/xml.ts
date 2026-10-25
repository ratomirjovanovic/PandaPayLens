/**
 * A small, defensive XML reader for pasted provider responses.
 *
 * - No DTD support: a DOCTYPE or any markup declaration is rejected, so
 *   external entities and entity expansion cannot happen.
 * - Only the five predefined entities and numeric character references are
 *   decoded; any other entity is an error.
 * - One linear pass over the text, an explicit element stack and limits on
 *   depth, element count and text length.
 */

export type XmlLimits = { maxDepth: number; maxElements: number; maxStringLength: number };

export type XmlDocument = {
  /** The document as plain data (see `toRecord`). */
  record: Record<string, unknown>;
  /** Local name of the root element. */
  root: string;
  /** Namespace URI of the root element, when declared. */
  namespace?: string;
};

export type XmlResult =
  { ok: true; value: XmlDocument } | { ok: false; message: string; offset: number };

type XmlElement = {
  name: string;
  attributes: [string, string][];
  children: XmlElement[];
  text: string[];
};

const PREDEFINED: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

const isNameChar = (c: string) => !/[\s/>=<'"]/.test(c);
const isSpace = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

export function parseXml(text: string, limits: XmlLimits): XmlResult {
  let i = 0;
  const n = text.length;
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let elements = 0;
  const fail = (message: string, offset = i): XmlResult => ({ ok: false, message, offset });

  // Decodes the predefined and numeric references in a text or attribute value.
  const decode = (raw: string, at: number): string | XmlResult => {
    if (!raw.includes("&")) return raw;
    let out = "";
    let k = 0;
    while (k < raw.length) {
      const amp = raw.indexOf("&", k);
      if (amp === -1) {
        out += raw.slice(k);
        break;
      }
      out += raw.slice(k, amp);
      const semi = raw.indexOf(";", amp + 1);
      if (semi === -1 || semi - amp > 12)
        return fail("Unterminated character reference.", at + amp);
      const ref = raw.slice(amp + 1, semi);
      if (ref.startsWith("#x") || ref.startsWith("#X")) {
        const cp = /^[0-9a-fA-F]{1,6}$/.test(ref.slice(2)) ? parseInt(ref.slice(2), 16) : NaN;
        if (!Number.isFinite(cp) || cp > 0x10ffff)
          return fail(`Invalid character reference "&${ref};".`, at + amp);
        out += String.fromCodePoint(cp);
      } else if (ref.startsWith("#")) {
        const cp = /^\d{1,7}$/.test(ref.slice(1)) ? parseInt(ref.slice(1), 10) : NaN;
        if (!Number.isFinite(cp) || cp > 0x10ffff)
          return fail(`Invalid character reference "&${ref};".`, at + amp);
        out += String.fromCodePoint(cp);
      } else if (Object.prototype.hasOwnProperty.call(PREDEFINED, ref)) {
        out += PREDEFINED[ref];
      } else {
        return fail(`Unknown entity "&${ref};". Entity declarations are not supported.`, at + amp);
      }
      k = semi + 1;
    }
    return out;
  };

  const skip = (open: string, close: string, what: string): XmlResult | null => {
    const end = text.indexOf(close, i + open.length);
    if (end === -1) return fail(`Unterminated ${what}.`);
    i = end + close.length;
    return null;
  };

  while (i < n) {
    const lt = text.indexOf("<", i);
    const chunkEnd = lt === -1 ? n : lt;
    if (chunkEnd > i) {
      const raw = text.slice(i, chunkEnd);
      if (stack.length === 0) {
        if (raw.trim() !== "" && !(i === 0 && raw === "﻿"))
          return fail("Text is not allowed outside the root element.");
      } else {
        if (raw.length > limits.maxStringLength)
          return fail("A text value exceeds the length limit.");
        const decoded = decode(raw, i);
        if (typeof decoded !== "string") return decoded;
        stack[stack.length - 1]!.text.push(decoded);
      }
    }
    if (lt === -1) break;
    i = lt;

    if (text.startsWith("<?", i)) {
      const r = skip("<?", "?>", "processing instruction");
      if (r) return r;
      continue;
    }
    if (text.startsWith("<!--", i)) {
      const r = skip("<!--", "-->", "comment");
      if (r) return r;
      continue;
    }
    if (text.startsWith("<![CDATA[", i)) {
      if (stack.length === 0) return fail("CDATA is not allowed outside the root element.");
      const end = text.indexOf("]]>", i + 9);
      if (end === -1) return fail("Unterminated CDATA section.");
      const raw = text.slice(i + 9, end);
      if (raw.length > limits.maxStringLength)
        return fail("A text value exceeds the length limit.");
      stack[stack.length - 1]!.text.push(raw);
      i = end + 3;
      continue;
    }
    if (text.startsWith("<!", i)) {
      return fail("DOCTYPE and other markup declarations are not accepted.");
    }
    if (text.startsWith("</", i)) {
      const end = text.indexOf(">", i + 2);
      if (end === -1) return fail("Unterminated end tag.");
      const name = text.slice(i + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== name)
        return fail(
          `End tag </${name}> does not match ${open ? `<${open.name}>` : "any open element"}.`,
        );
      i = end + 1;
      continue;
    }

    // Start tag.
    let j = i + 1;
    while (j < n && isNameChar(text[j]!)) j++;
    const name = text.slice(i + 1, j);
    if (!name) return fail("Element name expected.");
    if (root && stack.length === 0) return fail("Only one root element is allowed.");
    if (stack.length >= limits.maxDepth)
      return fail(`Elements are nested deeper than ${limits.maxDepth} levels.`);
    if (++elements > limits.maxElements) return fail(`More than ${limits.maxElements} elements.`);
    const el: XmlElement = { name, attributes: [], children: [], text: [] };
    let selfClosing = false;
    for (;;) {
      while (j < n && isSpace(text[j]!)) j++;
      if (j >= n) return fail("Unterminated start tag.", j);
      if (text[j] === ">") {
        j++;
        break;
      }
      if (text.startsWith("/>", j)) {
        selfClosing = true;
        j += 2;
        break;
      }
      const a0 = j;
      while (j < n && isNameChar(text[j]!)) j++;
      const attr = text.slice(a0, j);
      if (!attr) return fail("Attribute name expected.", j);
      while (j < n && isSpace(text[j]!)) j++;
      if (text[j] !== "=") return fail(`Attribute "${attr}" has no value.`, j);
      j++;
      while (j < n && isSpace(text[j]!)) j++;
      const q = text[j];
      if (q !== '"' && q !== "'") return fail(`Attribute "${attr}" value must be quoted.`, j);
      const close = text.indexOf(q, j + 1);
      if (close === -1) return fail(`Unterminated value of attribute "${attr}".`, j);
      const raw = text.slice(j + 1, close);
      if (raw.includes("<")) return fail(`Attribute "${attr}" contains "<".`, j);
      if (raw.length > limits.maxStringLength)
        return fail("An attribute value exceeds the length limit.", j);
      const value = decode(raw, j + 1);
      if (typeof value !== "string") return value;
      el.attributes.push([attr, value]);
      j = close + 1;
    }
    i = j;
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(el);
    else root = el;
    if (!selfClosing) stack.push(el);
  }

  if (stack.length) return fail(`Element <${stack[stack.length - 1]!.name}> is not closed.`, n);
  if (!root) return fail("No root element found.", 0);

  const local = (q: string) => q.slice(q.indexOf(":") + 1);
  const prefix = root.name.includes(":") ? root.name.slice(0, root.name.indexOf(":")) : "";
  const nsAttr = root.attributes.find(([k]) => k === (prefix ? `xmlns:${prefix}` : "xmlns"));
  return {
    ok: true,
    value: {
      record: Object.fromEntries([[local(root.name), toValue(root)]]),
      root: local(root.name),
      ...(nsAttr ? { namespace: nsAttr[1] } : {}),
    },
  };

  /**
   * An element becomes a string when it has only text, otherwise an object:
   * attributes as "@name", children by local name (arrays when repeated) and
   * any non-whitespace text as "#text". Namespace declarations are dropped.
   */
  function toValue(el: XmlElement): unknown {
    const text = el.text.join("").trim();
    const attrs = el.attributes.filter(([k]) => k !== "xmlns" && !k.startsWith("xmlns:"));
    if (!attrs.length && !el.children.length) return text;
    const entries: [string, unknown][] = attrs.map(([k, v]) => [`@${local(k)}`, v]);
    const grouped = new Map<string, unknown[]>();
    for (const c of el.children) {
      const key = local(c.name);
      const list = grouped.get(key);
      if (list) list.push(toValue(c));
      else grouped.set(key, [toValue(c)]);
    }
    for (const [k, list] of grouped) entries.push([k, list.length === 1 ? list[0] : list]);
    if (text) entries.push(["#text", text]);
    // Object.fromEntries defines own properties, so a "__proto__" name cannot
    // change the prototype; the caller's sanitizer removes such keys.
    return Object.fromEntries(entries);
  }
}
