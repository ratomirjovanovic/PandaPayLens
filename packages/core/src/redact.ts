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
  // payabl. form fields (signature, card, bank and session data)
  "security",
  "cardholder",
  "ccnfour",
  "ccn",
  "cvccode",
  "accountholder",
  "banknumber",
  "mpiavv",
  "ephemeralkey",
  "sessionid",
  "starturl",
  "redirectsecret",
  "url3ds",
  // PayPal webhook verification and account identifiers
  "transmissionsig",
  "certurl",
  "webhookid",
  "payerid",
  "lastdigits",
  "expiry",
  "accountid",
  "merchantid",
  // merchant identifiers (Adyen and others)
  "merchantaccountcode",
  "merchantaccount",
  // subscription billing (Verotel and similar)
  "passcode",
  "usercode",
  "oneclicktoken",
  "truncatedpan",
  "maskedidentifier",
  "signaturekey",
  "buyername",
  "buyeremail",
  "buyerip",
  // Authorize.net card, track, credential and verification fields
  "cardcode",
  "expirationdate",
  "track1",
  "track2",
  "tlvdata",
  "datavalue",
  "cardholderauthenticationvalue",
  "transactionkey",
  "nameonaccount",
  "customerip",
  "payeremail",
  "secureacceptanceurl",
  "transhash",
  "transhashsha2",
  // Nuvei checksums, session tokens, card, 3-D Secure and payer fields
  "advanceresponsechecksum",
  "responsechecksum",
  "checksum",
  "sessiontoken",
  "usertokenid",
  "cccardnumber",
  "last4digits",
  "maskedcardnumber",
  "cavv",
  "acsurl",
  "creq",
  "arn",
  "authcode",
  "clientname",
  "externalemail",
  "apmpayerinfo",
  // card data (wave 3 and wave 4 providers)
  "cardnum",
  "cardno",
  "cardexpiry",
  "cardcvv",
  "cardduedate",
  "cardname",
  "nameoncard",
  "ccnum",
  "ccvv",
  "ccexpmon",
  "ccexpyr",
  "ccname",
  "first6digits",
  "first6",
  "maskedpan",
  "binnumber",
  "cardlastfourdigits",
  "creditcardlastfourdigits",
  "creditcardexpdate",
  "dpanlastfourdigits",
  "dpanexpdate",
  "expirationmonth",
  "expirationyear",
  "cvvtoken",
  "encryptedcvv",
  "encryptedpin",
  "pin",
  "otp",
  "cardholderinfo",
  "cardhash",
  // tokens, keys and secrets (wave 3 and wave 4 providers)
  "paymenthandletoken",
  "paymenttoken",
  "networktoken",
  "networktokenpan",
  "networktokencryptogram",
  "cryptogram",
  "threedscryptogram",
  "creditcardtoken",
  "cardtoken",
  "storecardtoken",
  "customertoken",
  "fingerprinttoken",
  "encodedpaymenttoken",
  "surchargetoken",
  "pftoken",
  "accesscode",
  "emailtoken",
  "integrationkey",
  "publicintegrationkey",
  "accesskey",
  "clientsecretkey",
  "xapikey",
  "xclientid",
  "xtranskey",
  "xlogin",
  "licensekey",
  "authkey",
  "salt",
  "hash",
  "verifhash",
  "flutterwavesignature",
  "razorpaysignature",
  "blssignature",
  "payloadsignature",
  "usercredentials",
  "encrypteddata",
  "decrypteddata",
  "applepay",
  "googlepay",
  // 3-D Secure and scheme references (wave 3 and wave 4 providers)
  "xid",
  "dstransactionid",
  "acstransactionid",
  "directoryservertransactionid",
  "threedsecurereferenceid",
  "acstemplate",
  "authorizationcode",
  "acquirerreferencenumber",
  "networkreferenceid",
  "paymentaccountreference",
  // bank and wallet (wave 3 and wave 4 providers)
  "bankaccount",
  "bankbranch",
  "ispb",
  "clabe",
  "clabeaccount",
  "pixkey",
  "instantpayment",
  "vpa",
  "upivpa",
  "payervpa",
  "abaroutingnumber",
  "aba",
  "swiftcode",
  "bicswift",
  "transitnumber",
  "bsbnumber",
  "sepaiban",
  "ecppublicaccount",
  "ecppublicrouting",
  "debitaccountnumber",
  "senderbankaccountnumber",
  "originatoraccountnumber",
  "bankaccountholdername",
  "bankaccountholderdocument",
  "accountholdername",
  "accountname",
  // identity (wave 3 and wave 4 providers)
  "document",
  "document2",
  "documentid",
  "documentnumber",
  "beneficiarydocument",
  "identification",
  "identificationvalue",
  "identitydocuments",
  "nationalidentification",
  "personalid",
  "personalidnumber",
  "personalidentificationnumber",
  "brazilianid",
  "vatid",
  "bvn",
  "birthdate",
  "birthinfo",
  "nationality",
  "fundssource",
  "sourceofincome",
  "faceimage",
  "securityquestionanswer",
  // names and contact (wave 3 and wave 4 providers)
  "fullname",
  "customername",
  "payername",
  "ownername",
  "owneremail",
  "beneficiaryname",
  "beneficiarylastname",
  "originatorname",
  "sendername",
  "remitterinformation",
  "payfromemail",
  "paytoemail",
  "contact",
  "mobile",
  "msisdn",
  "homephone",
  "workphone",
  "mobilephone",
  "faxnumber",
  "internationalformatphone",
  "sourcephonenumber",
  "destinationphonenumber",
  "username",
  "address1",
  "address2",
  "streetnumber",
  "streetcomplement",
  "zipcode",
  "billingdetails",
  "shippingdetails",
  "customerdetails",
  // devices and network (wave 3 and wave 4 providers)
  "consumerip",
  "clientip",
  "remoteaddress",
  "shopperipaddress",
  "s2sclientip",
  "s2sdeviceinfo",
  "customerdeviceinfo",
  "devicedata",
  "devicefingerprint",
  "deviceid",
  "advertisingid",
  "androidid",
  "vendorid",
  "threatmetrixsessionid",
  "fraudsessionid",
  // links that carry access keys (wave 3 and wave 4 providers)
  "redirecturl",
  "authurl",
  "authorizationurl",
  "completepaymenturl",
  "errorpaymenturl",
  "invoiceurl",
  "invoiceinfourl",
  "shopperorderurl",
  "shopperadminurl",
  "paymenturl",
  "boletourl",
  "voucherurl",
  "qrcodevalue",
  "boletobarcode",
  "boletobarcoderaw",
  "oxxobarcode",
  // merchant-defined fields that can hold personal data (wave 3 and wave 4 providers)
  "udf1",
  "udf2",
  "udf3",
  "udf4",
  "udf5",
  "udf6",
  "udf7",
  "udf8",
  "udf9",
  "udf10",
]);

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "stripe-secret-key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g },
  { name: "stripe-webhook-secret", re: /\bwhsec_[A-Za-z0-9]{8,}\b/g },
  { name: "client-secret", re: /\b(?:pi|seti)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+\b/g },
  { name: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: "adyen-api-key", re: /\bAQE[A-Za-z0-9+/=_-]{30,}/g },
  // Bounded parts (RFC 5321 limits) keep the cost linear on long input.
  { name: "email", re: /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}/g },
  { name: "iban", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
  { name: "flutterwave-key", re: /\bFLW(?:SECK|PUBK)(?:_TEST)?-[A-Za-z0-9-]{8,}/g },
  { name: "flutterwave-card-token", re: /\bflw-t1nf-[A-Za-z0-9-]{8,}/g },
  // UPI ids look like name@handle without a dotted domain.
  { name: "upi-id", re: /\b[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}\b(?!\.)/g },
];

/** 13-19 digits, optionally separated by spaces or dashes. Checked with Luhn. */
const PAN_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Address groups that providers flatten into prefixed keys (Verotel `billingAddr_fullName`). */
const BLOCKED_PREFIXES = ["billingaddr", "shippingaddr"];

export function isBlockedKey(key: string): boolean {
  const n = normalizeKey(key);
  return BLOCKED_KEYS.has(n) || BLOCKED_PREFIXES.some((p) => n.startsWith(p));
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

const JWT_START = /\beyJ/g;
const JWT_AT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/y;
const TOKEN_RUN = /[A-Za-z0-9_-]*/y;

/**
 * Replace JWTs. A single global regex restarted at every "eyJ" inside a long
 * run of token characters and was quadratic. A candidate that fails here
 * fails for every later "eyJ" in the same run too, since they share its end
 * and everything after it, so the search skips to the end of the run.
 */
function redactJwts(text: string): { text: string; redacted: boolean } {
  let out = "";
  let last = 0;
  JWT_START.lastIndex = 0;
  for (let m = JWT_START.exec(text); m; m = JWT_START.exec(text)) {
    JWT_AT.lastIndex = m.index;
    if (JWT_AT.exec(text)) {
      out += text.slice(last, m.index) + REDACTED;
      last = JWT_START.lastIndex = JWT_AT.lastIndex;
    } else {
      TOKEN_RUN.lastIndex = m.index;
      TOKEN_RUN.exec(text);
      JWT_START.lastIndex = TOKEN_RUN.lastIndex;
    }
  }
  return { text: out + text.slice(last), redacted: last > 0 };
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
  const jwt = redactJwts(out);
  out = jwt.text;
  redacted ||= jwt.redacted;
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
export function redactDeep(
  value: unknown,
  report: RedactionReport = { paths: [] },
  path = "",
): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => redactDeep(v, report, `${path}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "__proto__") continue; // never assign through the prototype setter
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
  if (typeof value === "number" && isCardNumber(value)) {
    report.paths.push(path);
    return REDACTED;
  }
  return value;
}

/**
 * A card number sent as a JSON number. 13-digit values are left alone:
 * millisecond timestamps have 13 digits and would often pass Luhn.
 */
function isCardNumber(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 1e13 && luhnValid(String(n));
}

/** Find sensitive fields without producing a copy. */
export function findSensitivePaths(value: unknown): string[] {
  const report: RedactionReport = { paths: [] };
  redactDeep(value, report);
  return report.paths;
}
