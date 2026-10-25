import { describe, expect, it } from "vitest";
import {
  findSensitivePaths,
  isBlockedKey,
  luhnValid,
  maskIdentifier,
  redactDeep,
  redactText,
  REDACTED,
  safeId,
  safeText,
  minorUnits,
  upperCurrency,
  decimalToMinor,
} from "@pandapaylens/core";

describe("luhnValid", () => {
  it("accepts valid test PANs and rejects others", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("4242424242424241")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
    expect(luhnValid("42424242424a4242")).toBe(false);
  });
});

describe("redactText", () => {
  it.each([
    ["card 4242 4242 4242 4242 used", "card [redacted] used"],
    ["key sk_live_51Habcdefghijklmnop", "key [redacted]"],
    ["secret whsec_abcdefghijkl", "secret [redacted]"],
    ["pi_123_secret_abc", "[redacted]"],
    ["Authorization: Bearer eyJhbGciOi.payload.sig", "Authorization: [redacted]"],
    ["mail jane.doe@example.com now", "mail [redacted] now"],
    ["iban DE89 3704 0044 0532 0130 00", "iban [redacted]"],
  ])("redacts %s", (input, expected) => {
    const r = redactText(input);
    expect(r.text).toBe(expected);
    expect(r.redacted).toBe(true);
  });

  it("keeps non-Luhn digit runs such as timestamps and amounts", () => {
    expect(redactText("created 1761379200 amount 1234567890123").redacted).toBe(false);
  });
});

describe("redactDeep", () => {
  it("hides blocked keys at any depth, including whole subtrees", () => {
    const report = { paths: [] as string[] };
    const out = redactDeep(
      {
        a: { card: { number: "4242424242424242", cvc: "123", brand: "visa" } },
        billing_address: { line1: "Main st" },
        list: [{ email: "x@y.zz" }],
      },
      report,
    );
    expect(out).toEqual({
      a: { card: { number: REDACTED, cvc: REDACTED, brand: "visa" } },
      billing_address: REDACTED,
      list: [{ email: REDACTED }],
    });
    expect(report.paths).toEqual([
      "a.card.number",
      "a.card.cvc",
      "billing_address",
      "list[0].email",
    ]);
  });

  it("does not flag empty or null blocked values", () => {
    expect(findSensitivePaths({ email: null, name: "" })).toEqual([]);
  });

  it("matches key names regardless of case and separators", () => {
    expect(isBlockedKey("Client_Secret")).toBe(true);
    expect(isBlockedKey("shopper-email")).toBe(true);
    expect(isBlockedKey("status")).toBe(false);
  });
});

describe("maskIdentifier", () => {
  it("keeps the prefix and last four characters", () => {
    expect(maskIdentifier("pi_3PPLsynthOK000001")).toBe("pi_••••0001");
    expect(maskIdentifier("PPLSYNTH0000AUT1")).toBe("••••AUT1");
    expect(maskIdentifier("evt_test_65PPLsynthTHIN0001")).toBe("evt_test_••••0001");
    expect(maskIdentifier("ab")).toBe("••••");
  });
});

describe("adapter kit", () => {
  it("safeText truncates and scrubs", () => {
    expect(safeText("x".repeat(20), 10)).toBe(`${"x".repeat(9)}…`);
    expect(safeText("card 4242424242424242")).toBe("card [redacted]");
    expect(safeText(5)).toBeUndefined();
  });
  it("safeId rejects whitespace, control characters and long values", () => {
    expect(safeId("pi_123")).toBe("pi_123");
    expect(safeId("pi 123")).toBeUndefined();
    expect(safeId("a".repeat(200))).toBeUndefined();
  });
  it("minorUnits never produces floats from integers", () => {
    expect(minorUnits(4999)).toBe("4999");
    expect(minorUnits("123456789012345678901")).toBe("123456789012345678901");
    expect(minorUnits("12.5")).toBeUndefined();
    expect(minorUnits(12.5)).toBe("12.5");
  });
  it("upperCurrency validates ISO-like codes", () => {
    expect(upperCurrency("eur")).toBe("EUR");
    expect(upperCurrency("euro")).toBeUndefined();
  });
});

describe("decimalToMinor", () => {
  it.each([
    ["10.00", "EUR", "1000"],
    ["10.5", "USD", "1050"],
    ["0.01", "GBP", "1"],
    ["1000", "JPY", "1000"],
    ["1.234", "KWD", "1234"],
    ["0", "EUR", "0"],
    ["-5.25", "EUR", "-525"],
    ["10.50", "JPY", undefined],
    ["10.123", "EUR", undefined],
    ["abc", "EUR", undefined],
    ["10.00", undefined, undefined],
  ])("%s %s -> %s", (v, c, expected) => {
    expect(decimalToMinor(v, c)).toBe(expected);
  });
});

describe("Authorize.net sensitive fields", () => {
  const keys = [
    "cardCode",
    "expirationDate",
    "track1",
    "track2",
    "tlvData",
    "dataValue",
    "cardholderAuthenticationValue",
    "transactionKey",
    "nameOnAccount",
    "customerIP",
    "PayerEmail",
    "SecureAcceptanceUrl",
    "transHash",
    "transHashSha2",
  ];

  it("blocks every documented sensitive key", () => {
    for (const k of keys) expect(isBlockedKey(k), k).toBe(true);
  });

  it("redacts planted values wherever they appear", () => {
    const planted = Object.fromEntries(keys.map((k, i) => [k, `PPLsecret${i}`]));
    const out = JSON.stringify(redactDeep({ transactionRequest: { payment: planted } }));
    for (let i = 0; i < keys.length; i++) expect(out).not.toContain(`PPLsecret${i}`);
    expect(findSensitivePaths({ payment: planted }).length).toBe(keys.length);
  });
});
