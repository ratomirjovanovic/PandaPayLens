import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeSources,
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  decodePayablCode,
  GATEWAY_CODES,
  ISSUER_CODES,
  payablAdapter,
  payablManifest,
} from "@pandapaylens/payabl";

const options: AnalyzeOptions = {
  adapters: [payablAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturePath = (p: string) =>
  fileURLToPath(new URL(`../../../../fixtures/${p}`, import.meta.url));
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (p: string) => analyze(fixture(p));

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const SIG64 = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";

const notification = (fields: Record<string, string> = {}) =>
  form({
    transactionid: "PPLsynth500000001",
    type: "capture",
    errorcode: "0",
    errormessage: "",
    orderid: "PPLsynth-order-0100",
    timestamp: "1761379200",
    security: SIG64,
    ...fields,
  });

const gateway = (fields: Record<string, string> = {}) =>
  form({
    transactionid: "PPLsynth600000001",
    transid: "PPLsynth600000001",
    status: "0",
    errormessage: "",
    errmsg: "",
    amount: "12.00",
    price: "12.00",
    currency: "EUR",
    ...fields,
  });

const formMeta = { format: "form" as const };

describe("payabl detection", () => {
  it.each([
    [gateway(), "payabl.gateway.response", 0.98, true],
    [
      form({ transactionid: "X", status: "0", errormessage: "" }),
      "payabl.gateway.response",
      0.5,
      true,
    ],
    [
      form({ transactionid: "X", status: "brand-new", errormessage: "" }),
      "payabl.gateway.response",
      0.4,
      true,
    ],
    [notification(), "payabl.notification", 0.98, true],
    [notification({ type: "reversal" }), "payabl.notification", 0.8, true],
    [fixture("payabl/hpp-init.txt"), "payabl.session.init", 0.95, true],
  ])("detects %s", (text, format, confidence, supported) => {
    const parsed = parseInput(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(payablAdapter.detect(parsed.value.records[0], parsed.value.meta[0])).toMatchObject({
      format,
      confidence,
      supported,
    });
  });

  it("does not claim generic form posts or JSON shapes", () => {
    const d = (o: unknown, meta?: Parameters<typeof payablAdapter.detect>[1]) =>
      payablAdapter.detect(o, meta).confidence;
    expect(d({ status: "0" }, formMeta)).toBe(0);
    expect(d({ error: "x" }, formMeta)).toBe(0);
    expect(d({ type: "capture", errorcode: "0" }, formMeta)).toBe(0);
    expect(d({ name: "payabl", provider: "payabl.", message: "payabl error" }, formMeta)).toBe(0);
    // Notification-like fields without security or timestamp stay below the threshold.
    expect(d({ transactionid: "1", type: "capture", errorcode: "0" }, formMeta)).toBe(0.4);
    // Form families are not claimed when the record arrived as JSON.
    expect(
      d({ transactionid: "1", transid: "1", status: "0", errmsg: "" }, { format: "json" }),
    ).toBe(0);
    expect(d({ transactionid: "1", status: { a: 1 }, errmsg: "" }, formMeta)).toBe(0);
    expect(d("transactionid=1")).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(payablAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined) expect(payablAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("payabl synchronous responses", () => {
  it("normalizes a successful response without guessing the operation", () => {
    const r = analyzeFixture("payabl/gateway-authorize-success.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "payabl.gateway.response" });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "gateway_response",
      stage: "payment",
      outcome: "success",
      providerStatus: "status=0",
      paymentReference: "PPLsynth104822737",
      merchantReference: "PPLsynth-order-0001",
      amountMinor: "123",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      status: "0",
      paymentMethod: "1",
      cardType: "VISA",
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("treats status 2000 with url_3ds as pending authentication", () => {
    const r = analyzeFixture("payabl/gateway-3ds-pending.txt");
    expect(r.events[0]).toMatchObject({ stage: "authentication", outcome: "pending" });
    expect(r.events[0]!.attributes.threeDsRedirect).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.findings.map((f) => f.ruleId)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it("decodes an issuer decline", () => {
    const r = analyzeFixture("payabl/gateway-decline-insufficient-funds.txt");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "51",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      providerMessage: "Insufficient funds",
      paymentReference: "PPLsynth104830001",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({ field: "status", family: "issuer" });
    expect(r.findings.map((f) => f.ruleId)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("decodes a validation error as a rejected request", () => {
    const r = analyzeFixture("payabl/gateway-validation-error.txt");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "-6000",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("decodes the credentials / signature error as configuration", () => {
    const r = analyzeFixture("payabl/gateway-credentials-error.txt");
    expect(r.errors[0]).toMatchObject({
      code: "-999",
      category: "configuration",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.explanation).toMatch(/credentials/);
  });

  it("does not present a timeout as safe to retry", () => {
    const r = analyzeFixture("payabl/gateway-timeout.txt");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "-13000",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Confirm the final status/);
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual([
      "POSSIBLE_RETRY_RISK",
      "UNRESOLVED_OUTCOME",
    ]);
  });

  it("treats an issuer unavailable answer as a known decline, not an unknown outcome", () => {
    const r = analyze(gateway({ status: "91", errormessage: "Issuer not available", errmsg: "" }));
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.subCodes.decline_code).toBe("91");
    expect(r.findings.map((f) => f.ruleId)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("reports unknown codes honestly", () => {
    const r = analyze(
      gateway({ status: "-424242", errormessage: "Something new", errmsg: "Something new" }),
    );
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.errors[0]).toMatchObject({
      code: "-424242",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the payabl\. code tables/);
  });

  it("repairs the documented rendering defect in copied examples", () => {
    const r = analyze(
      "transactionid=PPLsynth1&transid=PPLsynth1&status=2000&errormessage=pending&errmsg=pending&amount=1.23&price=1.23¤cy=USD&orderid=PPLsynth-o&payment_method=1",
    );
    expect(r.events[0]).toMatchObject({ amountMinor: "123", currency: "USD", outcome: "pending" });
    expect(r.events[0]!.attributes.docsDefectRepaired).toBe(true);
  });

  it("reports parse issues for missing required fields instead of throwing", () => {
    const r = analyze(form({ transid: "", status: "0", errormessage: "", errmsg: "" }));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "payabl.gateway.response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/transactionid/);
    expect(r.events).toEqual([]);
  });

  it("reports repeated keys as parse issues", () => {
    const r = analyze(`${gateway()}&status=-6000`);
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^status:/);
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText("transactionid=1&status", options);
    expect(r.ok).toBe(false);
    expect(payablAdapter.parse("x", "payabl.gateway.response").ok).toBe(false);
    expect(payablAdapter.parse({}, "payabl.nope").ok).toBe(false);
  });
});

describe("payabl notifications", () => {
  it("maps the documented notification types", () => {
    const order = analyzeFixture("payabl/notification-order-authorized.txt").events[0]!;
    expect(order).toMatchObject({
      eventType: "notification.order",
      eventTypeKnown: true,
      stage: "authorization",
      outcome: "success",
      eventTimestamp: "2025-10-25T08:00:00.000Z",
      amountMinor: "100010",
    });
    const capture = analyzeFixture("payabl/notification-capture-success.txt").events[0]!;
    expect(capture).toMatchObject({ stage: "capture", outcome: "success", amountMinor: "5000" });
    expect(capture.attributes).toMatchObject({
      threeDsStatus: "VERIFIED",
      threeDsAuthenticationStatus: "Y",
      threeDsAuthenticationFlow: "challenge_flow",
      signature: "present_sha256_length",
    });
    const refund = analyzeFixture("payabl/notification-refund.txt").events[0]!;
    expect(refund).toMatchObject({ stage: "refund", outcome: "success" });
    expect(refund.attributes.signature).toBe("present_sha1_length");
  });

  it("uses payment_state for APM captures", () => {
    const pending = analyzeFixture("payabl/notification-ibt-not-credited-yet.txt");
    expect(pending.events[0]).toMatchObject({
      stage: "capture",
      outcome: "pending",
      providerStatus: "errorcode=0; payment_state=not_credited_yet",
    });
    const failed = analyzeFixture("payabl/notification-sepa-not-credited.txt");
    expect(failed.events[0]).toMatchObject({ stage: "capture", outcome: "failure" });
    expect(failed.errors[0]).toMatchObject({ code: "-5016", confidence: "possible" });
    expect(failed.findings.map((f) => f.ruleId)).toContain("PAYMENT_FAILURE");
    const credited = analyze(notification({ payment_state: "credited" }));
    expect(credited.events[0]!.outcome).toBe("success");
  });

  it("decodes a 3DS failure with its status reason", () => {
    const r = analyzeFixture("payabl/notification-3ds-decline.txt");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "-10001",
      category: "authentication_failed",
      retry: "customer_action_required",
      confidence: "strong",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      field: "errorcode",
      type: "order",
      "3dtransactionStatusReason": "01",
    });
    expect(r.errors[0]!.explanation).toMatch(/card authentication failed/);
  });

  it("keeps an empty errorcode and undocumented types unknown", () => {
    const empty = analyze(notification({ type: "refund", errorcode: "" }));
    expect(empty.events[0]!.outcome).toBe("unknown");
    expect(empty.errors).toEqual([]);
    const other = analyze(notification({ type: "reversal" }));
    expect(other.events[0]).toMatchObject({
      eventType: "notification.reversal",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(other.findings.map((f) => f.ruleId)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("reports duplicate deliveries using the documented field combination", () => {
    const text = fixture("payabl/notification-capture-success.txt");
    const r = analyzeMany(text, text);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe("PPLsynth300000001|capture|0||50.00");
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).toMatch(
      /documents that it can deliver the same notification more than once/,
    );
  });

  it("does not treat different operations on one transaction as duplicates", () => {
    const r = analyzeMany(
      notification({ type: "order" }),
      notification({ type: "capture" }),
      notification({ type: "capture", payment_state: "credited" }),
    );
    expect(new Set(r.events.map((e) => e.deliveryKey)).size).toBe(3);
    expect(r.findings.map((f) => f.ruleId)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("does not use an implausible timestamp as event time", () => {
    const r = analyze(notification({ timestamp: "106536295" }));
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.timestampUnparsed).toBe(true);
  });

  it("reports a notification without transactionid as invalid", () => {
    const r = analyze(form({ type: "capture", errorcode: "0", errormessage: "", security: SIG64 }));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "payabl.notification" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^transactionid:/);
  });
});

describe("payabl correlation and timeline", () => {
  it("groups order, capture and refund of one transactionid in time order", () => {
    const r = analyzeMany(
      fixture("payabl/notification-refund.txt"),
      fixture("payabl/notification-order-authorized.txt"),
      fixture("payabl/notification-capture-success.txt"),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(["PPLsynth300000001"]);
    expect(r.events.map((e) => [e.stage, e.outcome])).toEqual([
      ["authorization", "success"],
      ["capture", "success"],
      ["refund", "success"],
    ]);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(r.findings.map((f) => f.ruleId)).toContain("OUT_OF_ORDER_ARRIVAL");
  });

  it("keeps unrelated transactions and payouts apart", () => {
    const r = analyzeMany(
      fixture("payabl/notification-order-authorized.txt"),
      fixture("payabl/notification-3ds-decline.txt"),
      fixture("payabl/gateway-cft-payout.txt"),
      // Same orderid as the authorization, different transactionid.
      notification({ transactionid: "PPLsynth300000099", orderid: "PPLsynth-order-0010" }),
    );
    expect(r.groups).toHaveLength(4);
  });

  it("links a synchronous response and its notification", () => {
    const r = analyzeMany(
      gateway({ transactionid: "PPLsynth700000001", transid: "PPLsynth700000001", status: "2000" }),
      notification({ transactionid: "PPLsynth700000001", type: "capture" }),
    );
    expect(r.groups).toHaveLength(1);
    expect(payablAdapter.correlationKeys(r.events[0]!)).toEqual(["PPLsynth700000001"]);
  });
});

describe("payabl session responses", () => {
  it("treats a created HPP session as pending, not paid", () => {
    const r = analyzeFixture("payabl/hpp-init.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "hpp.init",
      stage: "payment",
      outcome: "pending",
      paymentReference: "PPLsynth105936790",
    });
    expect(JSON.stringify(r.events)).not.toContain("PPLsynthSESSION");
  });

  it("decodes a Web SDK session error", () => {
    const r = analyze(
      form({
        errorcode: "PC216005",
        errormessage: "Missing required fields",
        session_id: "",
        signature: "0123456789abcdef0123456789abcdef01234567",
        orderid: "PPLsynth-order-0200",
      }),
    );
    expect(r.records[0]!.format).toBe("payabl.session.init");
    expect(r.events[0]).toMatchObject({
      eventType: "websdk.session",
      stage: "error",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({ code: "PC216005", category: "invalid_request" });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/No transactionid/);
  });

  it("recognizes the Web SDK browser callback but does not analyze it", () => {
    const r = analyzeFixture("payabl/websdk-callback.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "payabl.websdk.callback" });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/notification_url/);
    expect(r.events).toEqual([]);
  });
});

describe("payabl code decoding", () => {
  it.each([
    ["-5004.03a", "risk", "fraud_or_risk", "manual_review", "strong"],
    ["-5004.09z", "risk", "fraud_or_risk", "manual_review", "possible"],
    ["59.03", "issuer", "fraud_or_risk", "do_not_retry", "strong"],
    ["6P", "issuer", "authentication_failed", "customer_action_required", "strong"],
    ["05", "issuer", "card_declined", "customer_action_required", "strong"],
    ["5", "scheme", "card_declined", "customer_action_required", "strong"],
    ["1A", "scheme", "authentication_required", "customer_action_required", "strong"],
    ["062000", "oct", "invalid_request", "do_not_retry", "strong"],
    ["S-8023", "apm_sofort", "invalid_request", "customer_action_required", "strong"],
    ["141603", "apm_trustly", "insufficient_funds", "customer_action_required", "strong"],
    ["005", "apm_eps", "invalid_amount", "do_not_retry", "possible"],
    ["PC216003", "websdk", "invalid_request", "safe_to_retry_technical_request", "strong"],
    ["-5007", "cft", "unknown", "manual_review", "strong"],
  ])("decodes %s", (code, family, category, retry, confidence) => {
    const d = decodePayablCode(code);
    expect(d.family).toBe(family);
    expect(d.entry.category).toBe(category);
    expect(d.entry.retry).toBe(retry);
    expect(d.confidence).toBe(confidence);
  });

  it("splits a Mastercard merchant advice suffix from the base code", () => {
    const d = decodePayablCode("51.24");
    expect(d.subCodes).toMatchObject({
      family: "issuer",
      baseCode: "51",
      merchantAdviceCode: "24",
    });
    expect(d.entry.category).toBe("insufficient_funds");
    expect(d.entry.retry).toBe("retry_conditionally");
    expect(d.confidence).toBe("strong");
    expect(decodePayablCode("51.77").confidence).toBe("possible");
  });

  it("reduces confidence where documented tables disagree", () => {
    for (const code of ["08", "19", "31", "85", "10"]) {
      const d = decodePayablCode(code);
      expect(d.family, code).toBe("issuer");
      expect(d.confidence, code).toBe("possible");
      expect(d.missing.join(" "), code).toMatch(/raw Visa\/Mastercard tables/);
    }
    const eight = decodePayablCode("8");
    expect(eight).toMatchObject({ family: "scheme", confidence: "possible" });
    expect(eight.entry.outcomeUncertain).toBe(true);
  });

  it("picks the scheme wording from card_type", () => {
    expect(decodePayablCode("4", { cardType: "VISA" }).entry.explanation).toBe(
      "Visa: Pick up card (no fraud).",
    );
    const mcOnly = decodePayablCode("28", { cardType: "MASTERCARD" });
    expect(mcOnly.confidence).toBe("possible");
    expect(mcOnly.missing.join(" ")).toMatch(/documented only for Visa/);
  });

  it("never resolves codes through the object prototype", () => {
    expect(decodePayablCode("toString").family).toBeNull();
    expect(decodePayablCode("constructor").confidence).toBe("insufficient");
  });

  it("has the documented number of gateway and issuer codes", () => {
    expect(Object.keys(GATEWAY_CODES)).toHaveLength(90);
    expect(Object.keys(ISSUER_CODES)).toHaveLength(87);
  });
});

describe("payabl redaction", () => {
  const planted = [
    "401288",
    "7319",
    "Planted Holder",
    "Planted Account Holder",
    "BEXXXXXXXXXX9770",
    "PPLsynthSESSIONPATH",
    "PPLsynth584371",
    "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809",
    "4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c",
    SIG64,
  ];

  it("keeps card, bank, session and signature data out of events and reports", () => {
    const r = analyzeMany(
      fixture("payabl/gateway-authorize-success.txt"),
      fixture("payabl/gateway-3ds-pending.txt"),
      fixture("payabl/notification-capture-success.txt"),
      fixture("payabl/notification-sepa-not-credited.txt"),
      notification({
        ccn_four: "7319",
        bin: "401288",
        cardholder: "PPLsynth Planted Holder",
        mpi_avv: "PPLsynthSESSIONPATH",
      }),
    );
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    expect(events).not.toContain("security");
  });
});

describe("payabl manifest", () => {
  it("is honest about limited capabilities", () => {
    expect(payablManifest).toMatchObject({
      id: "payabl",
      wave: 1,
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
    });
    expect(payablManifest.capabilities).toMatchObject({
      errorDecoding: "supported",
      paymentResponses: "supported",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "limited",
    });
    expect(payablManifest.delivery.ordering).toBe("not_documented");
    const text = JSON.stringify(payablManifest);
    for (const dash of [0x2013, 0x2014]) expect(text).not.toContain(String.fromCharCode(dash));
  });
});
