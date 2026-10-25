/**
 * Defense-in-depth redaction.
 *
 * This is best effort. Key-name and pattern matching cannot guarantee that a
 * document is anonymized, and nothing in PandaPayLens claims otherwise. The
 * primary control is that normalization copies only allowlisted fields.
 */

export const REDACTED = "[redacted]";

/** Key names (normalized: lowercase, no separators) that always hide their value. */
const BLOCKED_KEYS = new Set([
  "number",
  "cardnumber",
  "pan",
  "cvc",
  "cvv",
  "cvv2",
  "cvc2",
  "securitycode",
  "cardsecuritycode",
  "encryptedcardnumber",
  "encryptedsecuritycode",
  "encryptedexpirymonth",
  "encryptedexpiryyear",
  "password",
  "secret",
  "clientsecret",
  "apikey",
  "secretkey",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "signature",
  "hmacsignature",
  "hmackey",
  "webhooksecret",
  "signingsecret",
  "iban",
  "accountnumber",
  "bankaccountnumber",
  "routingnumber",
  "sortcode",
  "bic",
  "email",
  "emailaddress",
  "shopperemail",
  "receiptemail",
  "phone",
  "telephonenumber",
  "phonenumber",
  "name",
  "holdername",
  "cardholdername",
  "shoppername",
  "firstname",
  "lastname",
  "address",
  "billingaddress",
  "deliveryaddress",
  "shippingaddress",
  "line1",
  "line2",
  "street",
  "housenumberorname",
  "postalcode",
  "zip",
  "ip",
  "shopperip",
  "ipaddress",
  "fingerprint",
  "dateofbirth",
  "socialsecuritynumber",
  "taxid",
  "expmonth",
  "expyear",
  "expirymonth",
  "expiryyear",
  "last4",
  "bin",
  "cardbin",
  "cardsummary",
  "issuerbin",
]);

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "stripe-secret-key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g },
  { name: "stripe-webhook-secret", re: /\bwhsec_[A-Za-z0-9]{8,}\b/g },
  { name: "client-secret", re: /\b(?:pi|seti)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+\b/g },
  { name: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: "adyen-api-key", re: /\bAQE[A-Za-z0-9+/=_-]{30,}/g },
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { name: "iban", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
];

/** 13–19 digits, optionally separated by spaces or dashes. Checked with Luhn. */
const PAN_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isBlockedKey(key: string): boolean {
  return BLOCKED_KEYS.has(normalizeKey(key));
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

/** Replace secrets, emails, IBANs and Luhn-valid card numbers inside free text. */
export function redactText(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  let out = text;
  for (const { re } of PATTERNS) {
    out = out.replace(re, () => {
      redacted = true;
      return REDACTED;
    });
  }
  out = out.replace(PAN_CANDIDATE, (m) => {
    const digits = m.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      redacted = true;
      return REDACTED;
    }
    return m;
  });
  return { text: out, redacted };
}

/**
 * Mask an identifier for default display/export: keep the type prefix and the
 * last four characters, e.g. `pi_3Nxyz…AbCd` → `pi_••••AbCd`.
 */
export function maskIdentifier(id: string): string {
  const m = /^([A-Za-z]{1,8}_(?:test_|live_)?)?(.*)$/.exec(id);
  const prefix = m?.[1] ?? "";
  const rest = m?.[2] ?? id;
  if (rest.length <= 4) return `${prefix}••••`;
  return `${prefix}••••${rest.slice(-4)}`;
}

export type RedactionReport = { paths: string[] };

/**
 * Deep copy with blocked keys hidden and sensitive patterns removed from
 * strings. Used for the raw-data inspector and for anything exported.
 */
export function redactDeep(value: unknown, report: RedactionReport = { paths: [] }, path = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => redactDeep(v, report, `${path}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path === "" ? key : `${path}.${key}`;
      if (isBlockedKey(key) && child !== null && child !== undefined && child !== "") {
        // Hide the whole subtree: `billing_address: {...}` is as sensitive as a string.
        out[key] = REDACTED;
        report.paths.push(childPath);
        continue;
      }
      out[key] = redactDeep(child, report, childPath);
    }
    return out;
  }
  if (typeof value === "string") {
    const r = redactText(value);
    if (r.redacted) report.paths.push(path);
    return r.text;
  }
  return value;
}

/** Find sensitive fields without producing a copy. */
export function findSensitivePaths(value: unknown): string[] {
  const report: RedactionReport = { paths: [] };
  redactDeep(value, report);
  return report.paths;
}
