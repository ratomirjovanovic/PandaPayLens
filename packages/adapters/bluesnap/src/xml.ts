/**
 * BlueSnap Payment API in XML.
 *
 * The XML Payment API uses the same endpoints and semantics as the JSON one,
 * in the namespace http://ws.plimus.com (BlueSnap's former name, Plimus),
 * with kebab-case element names that correspond to the JSON fields:
 * card-transaction-type to cardTransactionType, processing-info to
 * processingInfo, error-name to errorName, invalid-property to
 * invalidProperty. The error root is <messages> with repeated <message>.
 *
 * The core XML reader turns one document into one record
 * `{ <root>: { child: "text" | {...} | [...] } }` with string values; these
 * helpers rebuild the JSON shape so the JSON logic can read it.
 */

import type { RecordMeta } from "@pandapaylens/core";

export const PLIMUS_NAMESPACE = "http://ws.plimus.com";

/** Roots that are analyzed. */
export const XML_CARD_TRANSACTION_ROOT = "card-transaction";
export const XML_ERROR_ROOT = "messages";

/** Further Payment API roots named in the research; recognized, not analyzed. */
export const XML_OTHER_ROOTS: Readonly<Record<string, string>> = {
  refund: "refund response",
  "alt-transaction": "alt transaction response",
  "vaulted-shopper": "vaulted shopper",
  "recurring-subscription": "recurring subscription",
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);

const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 64;

/** card-transaction-type -> cardTransactionType */
export function camelName(name: string): string {
  return name.replace(/-([A-Za-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** cardTransactionType -> card-transaction-type (for reasons shown to the user). */
export function kebabName(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * The record of one XML element in the JSON shape: kebab-case names become
 * camelCase, attributes and namespace declarations are dropped, and empty
 * elements are left out (an empty element carries no value, and the XML
 * reader cannot tell an empty object from an empty string).
 */
export function fromXml(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === "string") return value === "" ? undefined : value;
  if (Array.isArray(value)) {
    const items = value.map((v) => fromXml(v, depth + 1)).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (!isObj(value)) return undefined;
  const entries: [string, unknown][] = [];
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith("@") || k === "#text" || BLOCKED.has(k)) continue;
    const name = camelName(k);
    if (BLOCKED.has(name)) continue;
    const converted = fromXml(v, depth + 1);
    if (converted !== undefined) entries.push([name, converted]);
  }
  // Text next to attributes only: the text is the value.
  if (entries.length === 0 && typeof value["#text"] === "string") return value["#text"];
  return Object.fromEntries(entries);
}

/** The XML root of a record in BlueSnap's namespace, or undefined. */
export function plimusRoot(input: unknown, meta: RecordMeta | undefined): string | undefined {
  const xml = meta?.xml;
  if (!xml || xml.namespace !== PLIMUS_NAMESPACE || !isObj(input)) return undefined;
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === xml.root ? xml.root : undefined;
}

/** <messages><message>...</message></messages> as `{ message: [...] }`. */
export function xmlErrorView(input: unknown): Obj | undefined {
  if (!isObj(input) || !isObj(input[XML_ERROR_ROOT])) return undefined;
  const raw = (input[XML_ERROR_ROOT] as Obj).message;
  if (raw === undefined) return undefined;
  const list = (Array.isArray(raw) ? raw : [raw]).map((m) => (isObj(m) ? fromXml(m) : m));
  return { message: list };
}

/** <card-transaction> as the JSON card transaction object. */
export function xmlCardTransactionView(input: unknown): Obj | undefined {
  if (!isObj(input) || !isObj(input[XML_CARD_TRANSACTION_ROOT])) return undefined;
  const v = fromXml(input[XML_CARD_TRANSACTION_ROOT]);
  return isObj(v) ? v : undefined;
}

/** Record path of the i-th of n repeated elements (a single element has no index). */
export function xmlItemPath(base: string, i: number, n: number): string {
  return n > 1 ? `${base}[${i}]` : base;
}
