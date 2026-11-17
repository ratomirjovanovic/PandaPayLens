/**
 * Decoded Braintree webhook notification XML.
 *
 * A Braintree server SDK base64-decodes bt_payload into an XML document with a
 * <notification> root holding <timestamp type="datetime">, <kind> and
 * <subject>, and kebab-case child elements such as <currency-iso-code>. The SDK
 * turns that document into the parsed notification: dashes in element names
 * become underscores, type="array" elements become lists (also when empty or
 * with one item), nil="true" elements become null and type="boolean" elements
 * become booleans. A <subject> that wraps its content in <api-error-response>
 * is unwrapped. These rules come from the official SDK source (Ruby
 * Braintree::Xml::Parser, Node.js WebhookNotification), not from a docs page.
 *
 * The core XML reader turns one document into one record
 * `{ <root>: { child: "text" | {...} | [...] } }` with attributes as "@name";
 * the helpers below rebuild the snake_case shape that the JSON logic reads.
 */

import type { RecordMeta } from "@pandapaylens/core";

export const XML_NOTIFICATION_ROOT = "notification";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);

const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 64;

/** currency-iso-code -> currency_iso_code */
export function snakeName(name: string): string {
  return name.replace(/-/g, "_");
}

function attr(v: Obj, name: string): string | undefined {
  const a = v[`@${name}`];
  return typeof a === "string" ? a : undefined;
}

/** Child element values in document order, ignoring attributes and text. */
function childValues(v: Obj): unknown[] {
  const out: unknown[] = [];
  for (const [k, c] of Object.entries(v)) {
    if (k.startsWith("@") || k === "#text") continue;
    if (Array.isArray(c)) out.push(...c);
    else out.push(c);
  }
  return out;
}

/** One XML element value in the SDK's snake_case shape. */
export function fromXml(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => fromXml(v, depth + 1));
  if (!isObj(value)) return undefined;
  if (attr(value, "nil") === "true") return null;
  const type = attr(value, "type");
  if (type === "array") return childValues(value).map((v) => fromXml(v, depth + 1));
  const children = Object.keys(value).filter((k) => !k.startsWith("@") && k !== "#text");
  if (children.length === 0) {
    const text = typeof value["#text"] === "string" ? value["#text"] : "";
    if (type === "boolean") return text === "true" || text === "1";
    return text;
  }
  const entries: [string, unknown][] = [];
  for (const k of children) {
    const name = snakeName(k);
    if (BLOCKED.has(k) || BLOCKED.has(name)) continue;
    entries.push([name, fromXml(value[k], depth + 1)]);
  }
  return Object.fromEntries(entries);
}

/** True for a record read from a <notification> document without a namespace. */
export function isNotificationXml(input: unknown, meta: RecordMeta | undefined): input is Obj {
  const xml = meta?.xml;
  if (!xml || xml.root !== XML_NOTIFICATION_ROOT || xml.namespace !== undefined) return false;
  if (!isObj(input)) return false;
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === XML_NOTIFICATION_ROOT;
}

/**
 * The <notification> document as the parsed notification object
 * (`{ timestamp, kind, subject }`), or undefined when it is not one.
 * `unwrapped` says that the subject was taken from <api-error-response>.
 */
export function notificationFromXml(
  input: unknown,
  meta: RecordMeta | undefined,
): { value: Obj; unwrapped: boolean } | undefined {
  if (!isNotificationXml(input, meta)) return undefined;
  const n = fromXml(input[XML_NOTIFICATION_ROOT]);
  if (!isObj(n)) return undefined;
  const subject = n.subject;
  if (isObj(subject) && isObj(subject.api_error_response))
    return { value: { ...n, subject: subject.api_error_response }, unwrapped: true };
  return { value: n, unwrapped: false };
}
