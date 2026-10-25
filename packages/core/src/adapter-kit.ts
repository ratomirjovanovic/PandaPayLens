/** Small helpers shared by provider adapters. */

import { redactText } from "./redact.js";

/** Provider-supplied free text: length-limited and scrubbed of secrets/PII patterns. */
export function safeText(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const t = value.length > max ? `${value.slice(0, max - 1)}…` : value;
  return redactText(t).text;
}

/** Short identifier-like strings only; anything else is dropped. */
export function safeId(value: unknown, max = 128): string | undefined {
  if (typeof value !== "string" || value === "" || value.length > max) return undefined;
  return /^[\x21-\x7e]+$/.test(value) ? value : undefined;
}

/**
 * Integer minor-unit amount as a string. JSON numbers beyond 2^53 have
 * already lost precision when parsed, so they are passed through as-is and
 * flagged by the engine (the string will not match /^-?\d+$/ only if it
 * contains an exponent or fraction).
 */
export function minorUnits(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isSafeInteger(value) ? String(value) : value.toString();
  }
  if (typeof value === "string" && /^-?\d{1,30}$/.test(value)) return value;
  return undefined;
}

export function upperCurrency(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z]{3}$/.test(value) ? value.toUpperCase() : undefined;
}
