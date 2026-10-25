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

/**
 * ISO 4217 minor-unit exponents that differ from 2. Currencies not listed
 * use 2. Source: ISO 4217 maintenance agency list.
 */
const CURRENCY_EXPONENTS: Record<string, number> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
};

export function currencyExponent(currency: string): number {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
}

/**
 * Converts a decimal amount string such as "10.50" to an integer minor-unit
 * string using the currency's exponent, without floating-point arithmetic.
 * Returns undefined when the value has more decimals than the currency allows
 * (instead of silently rounding).
 */
export function decimalToMinor(value: unknown, currency: string | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string" || !currency) return undefined;
  const m = /^(-?)(\d{1,30})(?:\.(\d{1,10}))?$/.exec(value.trim());
  if (!m) return undefined;
  const exp = currencyExponent(currency);
  const frac = (m[3] ?? "").replace(/0+$/, "");
  if (frac.length > exp) return undefined;
  const digits = (m[2]! + frac.padEnd(exp, "0")).replace(/^0+(?=\d)/, "");
  return digits === "0" ? "0" : `${m[1]}${digits}`;
}
