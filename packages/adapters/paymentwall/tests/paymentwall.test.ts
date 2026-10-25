import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeRecords,
  analyzeSources,
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  BRICK_PAYMENT_ERRORS,
  BRICK_TOKEN_ERRORS,
  codeCandidates,
  decodePaymentwallCode,
  MINT_GENERATION_ERRORS,
  MINT_REDEMPTION_ERRORS,
  MOBIAMO_CODES,
  NEGATIVE_REASONS,
  PINGBACK_TYPES,
  paymentwallAdapter,
  paymentwallManifest,
  PAYMENTWALL_ADAPTER_VERSION,
} from "@pandapaylens/paymentwall";
import defaultExport from "@pandapaylens/paymentwall";

const options: AnalyzeOptions = {
  adapters: [paymentwallAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturePath = (p: string) =>
  fileURLToPath(new URL(`../../../../fixtures/${p}`, import.meta.url));
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (p: string, extra?: Partial<AnalyzeOptions>) =>
  analyze(fixture(`paymentwall/${p}`), extra);

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const SIG32 = "7c1e4f2a9b3d5e6f80a1b2c3d4e5f607";
const SIG64 = "7c1e4f2a9b3d5e6f80a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b";

const pingback = (fields: Record<string, string> = {}) =>
  form({
    uid: "PPLsynth-user-0100",
    goodsid: "PPLsynth_gold_membership",
    slength: "",
    speriod: "",
    type: "0",
    ref: "bPPLsynth0100",
    sign_version: "2",
    sig: SIG32,
    ...fields,
  });

function detectText(text: string) {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return paymentwallAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
}

describe("paymentwall exports", () => {
  it("exports the adapter, manifest, version and catalogs", () => {
    expect(defaultExport).toBe(paymentwallAdapter);
    expect(paymentwallAdapter.id).toBe("paymentwall");
    expect(paymentwallAdapter.manifest).toBe(paymentwallManifest);
    expect(PAYMENTWALL_ADAPTER_VERSION).toBe("0.1.0");
    expect(Object.keys(PINGBACK_TYPES)).toHaveLength(11);
    expect(Object.keys(NEGATIVE_REASONS)).toHaveLength(12);
    expect(Object.keys(BRICK_TOKEN_ERRORS)).toHaveLength(7);
    expect(Object.keys(BRICK_PAYMENT_ERRORS)).toHaveLength(54);
    expect(Object.keys(MOBIAMO_CODES)).toHaveLength(10);
    expect(Object.keys(MINT_GENERATION_ERRORS)).toHaveLength(16);
    expect(Object.keys(MINT_REDEMPTION_ERRORS)).toHaveLength(19);
  });

  it("documents the Brick and MINT code collisions in the catalog", () => {
    for (const code of [
      "1001",
      "1003",
      "3001",
      "3002",
      "3003",
      "3004",
      "3005",
      "3006",
      "3008",
      "3009",
    ]) {
      const families = codeCandidates(code).map((e) => e.family);
      expect(families, code).toEqual(["brick_payment", "mint_redemption"]);
    }
    expect(codeCandidates("200").map((e) => e.family)).toEqual(["brick_token"]);
  });
});

describe("paymentwall detection", () => {
  it.each([
    ["pingback-goods-delivered.txt", "paymentwall.pingback", true],
    ["pingback-subscription-payment.txt", "paymentwall.pingback", true],
    ["pingback-virtual-currency.txt", "paymentwall.pingback", true],
    ["pingback-http-get.txt", "paymentwall.pingback", true],
    ["brick-error-wrong-amount.json", "paymentwall.brick.error", true],
    ["brick-error-api-key.txt", "paymentwall.brick.error", true],
    ["brick-sdk-error.json", "paymentwall.brick.sdk_error", true],
    ["brick-charge-captured.json", "paymentwall.brick.charge", true],
    ["brick-subscription.json", "paymentwall.brick.subscription", true],
    ["brick-3ds-redirect.json", "paymentwall.brick.3ds", true],
    ["mobiamo-error.json", "paymentwall.mobiamo.error", true],
    ["mobiamo-init.json", "paymentwall.mobiamo.response", true],
    ["client-callback-payment-success.json", "paymentwall.client_callback", false],
  ])("detects %s", (file, format, supported) => {
    const d = detectText(fixture(`paymentwall/${file}`));
    expect(d.format).toBe(format);
    expect(d.supported).toBe(supported);
    expect(d.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("detects pingbacks by structure only, whatever the host", () => {
    const query = pingback();
    for (const host of [
      "https://merchant.example.com/pw/pingback.php",
      "http://another.example.org/cb",
    ]) {
      const d = detectText(`${host}?${query}`);
      expect(d.format).toBe("paymentwall.pingback");
      expect(d.confidence).toBe(detectText(query).confidence);
    }
  });

  it("does not claim generic shapes", () => {
    const d = (o: unknown, meta?: Parameters<typeof paymentwallAdapter.detect>[1]) =>
      paymentwallAdapter.detect(o, meta).confidence;
    const formMeta = { format: "form" as const };
    expect(d({ error: "x" })).toBe(0);
    expect(d({ status: "ok" })).toBe(0);
    expect(d({ type: "0", ref: "1" }, formMeta)).toBe(0);
    expect(d({ type: "x", ref: "y", status: "z" }, formMeta)).toBe(0);
    expect(d({ name: "paymentwall", provider: "Paymentwall", message: "paymentwall error" })).toBe(
      0,
    );
    expect(d({ object: "charge", id: "ch_1", amount: 100, captured: true })).toBe(0);
    expect(d({ object: "subscription", id: "sub_1", status: "active" })).toBe(0);
    expect(d({ success: false, ref: "x" })).toBe(0);
    // Bare error shapes stay below the analysis threshold.
    expect(d({ error: "Something failed", code: 3004 })).toBeLessThan(0.5);
    expect(d({ error: "Something failed", code: 42 })).toBeLessThan(0.5);
    expect(d({ success: false, error: { message: "x", code: 42 } })).toBeLessThan(0.5);
    expect(d({ ref: "x", completed: true })).toBeLessThan(0.5);
    // Pingback minimum without signature or documented type stays low.
    expect(d({ uid: "u", type: "x", ref: "r" }, formMeta)).toBeLessThan(0.5);
    // JSON families are not claimed when the record arrived as form data.
    expect(d({ type: "Error", error: "x", code: "3002" }, formMeta)).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
    expect(d("uid=1&type=0&ref=2")).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(paymentwallAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(
            0,
          );
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(paymentwallAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("does not claim records of other providers", () => {
    const own = new Set(["paymentwall", "stripe", "adyen"]);
    let checked = 0;
    for (const dir of readdirSync(fixturePath(""), { withFileTypes: true })) {
      if (!dir.isDirectory() || own.has(dir.name)) continue;
      for (const file of readdirSync(fixturePath(dir.name))) {
        let parsed;
        try {
          parsed = parseInput(fixture(`${dir.name}/${file}`));
        } catch {
          continue;
        }
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          expect(
            paymentwallAdapter.detect(record, parsed.value.meta[i]).confidence,
            `${dir.name}/${file}[${i}]`,
          ).toBeLessThan(0.5);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe("paymentwall pingbacks", () => {
  it("normalizes a delivered payment from a pasted pingback URL", () => {
    const r = analyzeFixture("pingback-goods-delivered.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "paymentwall.pingback" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "pingback.0",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "type=0",
      paymentReference: "bPPLsynth1001",
      deliveryKey: "bPPLsynth1001_0",
    });
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.eventReference).toBeUndefined();
    expect(e.amountMinor).toBeUndefined();
    expect(e.isRecurring).toBeUndefined();
    expect(e.merchantReference).toBeUndefined();
    expect(e.attributes).toMatchObject({
      productId: "PPLsynth_gold_membership",
      signVersion: "2",
      signature: "present_md5_length",
    });
    expect(e.attributes.subscriptionPayment).toBeUndefined();
    expect(JSON.stringify(r.events)).not.toContain("merchant.example.com");
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("marks a subscription payment without claiming it is a renewal", () => {
    const e = analyzeFixture("pingback-subscription-payment.txt").events[0]!;
    expect(e).toMatchObject({ stage: "payment", outcome: "success" });
    expect(e.isRecurring).toBeUndefined();
    expect(e.subscriptionReference).toBeUndefined();
    expect(e.attributes).toMatchObject({
      subscriptionPayment: true,
      subscriptionLength: "1",
      subscriptionPeriod: "month",
      signature: "present_sha256_length",
      signVersion: "3",
    });
  });

  it("does not read the Virtual Currency amount as an ISO currency", () => {
    const e = analyzeFixture("pingback-virtual-currency.txt").events[0]!;
    expect(e.currency).toBeUndefined();
    expect(e.amountMinor).toBeUndefined();
    expect(e.attributes).toMatchObject({ virtualCurrencyAmount: "500", testMode: true });
  });

  it("maps a chargeback to an open dispute and a reason 9 reversal to a refund", () => {
    const cb = analyzeFixture("pingback-chargeback.txt");
    expect(cb.events[0]).toMatchObject({
      eventType: "pingback.2",
      stage: "dispute",
      outcome: "unknown",
      providerStatus: "type=2; reason=1",
      deliveryKey: "bPPLsynth1001_2",
    });
    expect(cb.events[0]!.attributes).toMatchObject({ reason: "1", reasonMeaning: "Chargeback" });
    expect(ruleIds(cb)).toEqual(["CHARGEBACK_REPORTED"]);
    const refund = analyzeFixture("pingback-refund.txt").events[0]!;
    expect(refund).toMatchObject({ stage: "refund", outcome: "success" });
    expect(refund.attributes.reasonMeaning).toMatch(/Cancelled order/);
  });

  it.each(Object.keys(NEGATIVE_REASONS))("decodes negative reason %s", (reason) => {
    const e = analyze(pingback({ type: "2", reason })).events[0]!;
    expect(e.eventTypeKnown).toBe(true);
    expect(e.attributes.reasonMeaning).toBe(NEGATIVE_REASONS[reason]!.meaning);
    expect(e.stage).toBe(NEGATIVE_REASONS[reason]!.stage);
    // Partial reversals can repeat for one ref, so they have no delivery key.
    if (reason === "10") expect(e.deliveryKey).toBeUndefined();
    else expect(e.deliveryKey).toBe("bPPLsynth0100_2");
  });

  it("keeps an undocumented negative reason visible but undecoded", () => {
    const e = analyze(pingback({ type: "2", reason: "99" })).events[0]!;
    expect(e).toMatchObject({ stage: "reversal", eventTypeKnown: true });
    expect(e.attributes).toMatchObject({ reason: "99", reasonDocumented: false });
    expect(e.attributes.reasonMeaning).toBeUndefined();
  });

  it("follows a risk review from 200 to 201 for one ref", () => {
    const r = analyzeFixture("pingbacks-risk-review-log.txt");
    expect(r.records).toHaveLength(2);
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["pingback.200", "pending"],
      ["pingback.201", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.arrivalOrderInferred).toBe(true);
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
    const pendingOnly = analyze(pingback({ type: "200" }));
    expect(ruleIds(pendingOnly)).toContain("UNRESOLVED_OUTCOME");
  });

  it("maps review declined, auto-void and partial refund", () => {
    expect(analyzeFixture("pingback-risk-declined.txt").events[0]).toMatchObject({
      eventType: "pingback.202",
      stage: "payment",
      outcome: "failure",
    });
    expect(analyzeFixture("pingback-authorization-voided.txt").events[0]).toMatchObject({
      eventType: "pingback.203",
      stage: "void",
      outcome: "success",
    });
    const partial = analyzeFixture("pingback-partial-refund.txt").events[0]!;
    expect(partial).toMatchObject({
      eventType: "pingback.220",
      stage: "refund",
      outcome: "success",
    });
    expect(partial.deliveryKey).toBeUndefined();
  });

  it("maps subscription cancellation, expiry and failed renewal", () => {
    expect(analyzeFixture("pingback-subscription-cancelled.txt").events[0]).toMatchObject({
      eventType: "pingback.12",
      stage: "cancellation",
      outcome: "success",
    });
    expect(analyzeFixture("pingback-subscription-expired.txt").events[0]).toMatchObject({
      eventType: "pingback.13",
      stage: "subscription",
      outcome: "success",
    });
    const failed = analyzeFixture("pingback-subscription-renewal-failed.txt");
    expect(failed.events[0]).toMatchObject({
      eventType: "pingback.14",
      stage: "subscription",
      outcome: "failure",
      isRecurring: true,
    });
    expect(ruleIds(failed)).toContain("RECURRING_PAYMENT_FAILED");
  });

  it("states the type 1 ambiguity", () => {
    const e = analyze(pingback({ type: "1" })).events[0]!;
    expect(e).toMatchObject({ stage: "payment", outcome: "success", eventTypeKnown: true });
    expect(e.attributes.typeNote).toMatch(/GOODWILL/);
  });

  it("covers every documented pingback type", () => {
    for (const type of Object.keys(PINGBACK_TYPES)) {
      const e = analyze(pingback({ type })).events[0]!;
      expect(e.eventType, type).toBe(`pingback.${type}`);
      expect(e.eventTypeKnown, type).toBe(true);
      expect(e.stage, type).not.toBe("other");
    }
  });

  it("keeps undocumented types unknown", () => {
    const r = analyze(pingback({ type: "77" }));
    expect(r.events[0]).toMatchObject({
      eventType: "pingback.77",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("analyzes a GET pingback whose data is in the request line", () => {
    const r = analyzeFixture("pingback-http-get.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "paymentwall.pingback" });
    expect(r.events[0]).toMatchObject({ paymentReference: "bPPLsynth9001", outcome: "success" });
  });
});

describe("paymentwall parse issues", () => {
  it("reports missing or repeated required fields instead of throwing", () => {
    const empty = analyze(pingback({ ref: "" }));
    expect(empty.records[0]).toMatchObject({ status: "invalid", format: "paymentwall.pingback" });
    expect(empty.records[0]!.reasons.join(" ")).toMatch(/^ref:/);
    const repeated = analyze(`${pingback()}&type=2`);
    expect(repeated.records[0]!.status).toBe("invalid");
    expect(repeated.records[0]!.reasons.join(" ")).toMatch(/type/);
    const charge = JSON.parse(fixture("paymentwall/brick-charge-captured.json")) as Record<
      string,
      unknown
    >;
    delete charge.id;
    const r = analyze(JSON.stringify(charge));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "paymentwall.brick.charge" });
    expect(r.events).toEqual([]);
  });

  it("fails cleanly on malformed input", () => {
    expect(analyzeText('{"type": "Error", "code": 3002,', options).ok).toBe(false);
    expect(paymentwallAdapter.parse("x", "paymentwall.pingback").ok).toBe(false);
    expect(paymentwallAdapter.parse({}, "paymentwall.nope").ok).toBe(false);
    expect(paymentwallAdapter.parse({ type: "Error" }, "paymentwall.brick.error").ok).toBe(false);
  });

  it("recognizes a client-side callback but does not analyze it", () => {
    const r = analyzeFixture("client-callback-payment-success.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "paymentwall.client_callback",
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/not an authoritative/);
    expect(r.events).toEqual([]);
  });
});

describe("paymentwall duplicates and correlation", () => {
  it("flags a repeated pingback with the same ref and type", () => {
    const text = fixture("paymentwall/pingback-goods-delivered.txt");
    const r = analyzeMany(text, text);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).toMatch(/documents that it can deliver/);
    expect(dup!.recommendedAction).toMatch(/OK/);
  });

  it("does not treat two partial refunds of one ref as duplicates", () => {
    const text = fixture("paymentwall/pingback-partial-refund.txt");
    const r = analyzeMany(text, text);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(r.groups).toHaveLength(1);
  });

  it("groups a payment and its chargeback by ref", () => {
    const r = analyzeMany(
      fixture("paymentwall/pingback-goods-delivered.txt"),
      fixture("paymentwall/pingback-chargeback.txt"),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(["ref:bPPLsynth1001"]);
    const cb = r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED");
    expect(cb!.title).toBe("Chargeback after a successful payment");
  });

  it("keeps different refs apart even with the same uid and goodsid", () => {
    const r = analyzeMany(
      pingback({ ref: "bPPLsynthA1" }),
      pingback({ ref: "bPPLsynthB2" }),
      fixture("paymentwall/brick-charge-captured.json"),
      fixture("paymentwall/mobiamo-init.json"),
    );
    expect(r.groups).toHaveLength(4);
  });

  it("links a Brick subscription to its charges, and a charge to its refund", () => {
    const r = analyzeMany(
      fixture("paymentwall/brick-subscription.json"),
      fixture("paymentwall/brick-charge-captured.json"),
      fixture("paymentwall/brick-charge-refunded.json"),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining(["sub:PPLsynthVCBZT392SW", "charge:PPLsynth104872652"]),
    );
  });

  it("does not link a pingback ref and a charge id with the same value", () => {
    const r = analyzeMany(
      pingback({ ref: "PPLsynth104872652" }),
      fixture("paymentwall/brick-charge-captured.json"),
    );
    expect(r.groups).toHaveLength(2);
  });
});

describe("paymentwall Brick responses", () => {
  it("normalizes a captured charge", () => {
    const r = analyzeFixture("brick-charge-captured.json");
    expect(r.events[0]).toMatchObject({
      eventType: "brick.charge",
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth104872652",
      amountMinor: "999",
      currency: "USD",
      providerStatus: "captured=true; refunded=false; risk=approved",
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      paidAmountMinor: "999",
      paidCurrency: "USD",
      cardBrand: "Visa",
      risk: "approved",
    });
    expect(r.errors).toEqual([]);
  });

  it("keeps authorization, review and refund apart", () => {
    expect(analyzeFixture("brick-charge-authorized.json").events[0]).toMatchObject({
      stage: "authorization",
      outcome: "success",
      amountMinor: "12000",
      currency: "EUR",
    });
    expect(analyzeFixture("brick-charge-under-review.json").events[0]).toMatchObject({
      stage: "payment",
      outcome: "pending",
    });
    expect(analyzeFixture("brick-charge-refunded.json").events[0]).toMatchObject({
      stage: "refund",
      outcome: "success",
    });
    const odd = JSON.parse(fixture("paymentwall/brick-charge-captured.json")) as Record<
      string,
      unknown
    >;
    odd.risk = "PPLsynth-odd";
    const e = analyze(JSON.stringify(odd)).events[0]!;
    expect(e.attributes).toMatchObject({ riskDocumented: false });
    expect(e.providerStatus).toContain("risk=undocumented");
  });

  it("normalizes a subscription object", () => {
    const e = analyzeFixture("brick-subscription.json").events[0]!;
    expect(e).toMatchObject({
      eventType: "brick.subscription",
      stage: "subscription",
      outcome: "success",
      subscriptionReference: "PPLsynthVCBZT392SW",
    });
    expect(e.attributes).toMatchObject({
      active: true,
      expired: false,
      isTrial: false,
      period: "month",
      periodDuration: 1,
      paymentsLimit: 12,
      chargeIds: ["PPLsynth104872652"],
    });
    expect(e.eventTimestamp).toBeUndefined();
  });

  it("shows a 3-D Secure step as pending authentication without copying the form", () => {
    const r = analyzeFixture("brick-3ds-redirect.json");
    expect(r.events[0]).toMatchObject({
      eventType: "brick.3ds_required",
      stage: "authentication",
      outcome: "pending",
    });
    expect(r.events[0]!.attributes.secureStep).toBe("formHTML");
    expect(JSON.stringify(r.events)).not.toContain("PaReq");
  });
});

describe("paymentwall Brick errors", () => {
  it("decodes a validation error", () => {
    const r = analyzeFixture("brick-error-wrong-amount.json");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      eventType: "brick.error",
    });
    expect(r.errors[0]).toMatchObject({
      code: "3002",
      category: "invalid_amount",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Wrong charge amount",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes.family).toBe("brick_payment");
    // The MINT redemption meaning of 3002 is mentioned, not used.
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /MINT ePIN redemption \(ePIN expired\)/,
    );
    expect(r.errors[0]!.documentation[0]!.url).toMatch(/brick\/error-codes$/);
  });

  it("decodes an authentication failure as configuration", () => {
    const r = analyzeFixture("brick-error-api-key.txt");
    expect(r.errors[0]).toMatchObject({
      code: "4007",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(r.errors[0]!.subCodes.httpStatus).toBe("401");
    expect(r.events[0]!.attributes.httpStatus).toBe(401);
  });

  it("decodes an issuer decline without claiming why", () => {
    const r = analyzeFixture("brick-error-declined.json");
    expect(r.errors[0]).toMatchObject({
      code: "3011",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
    });
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes a token error with code 200 as Brick, not as a pingback type", () => {
    const r = analyze(JSON.stringify({ type: "Error", error: "Empty request", code: 200 }));
    expect(r.errors[0]).toMatchObject({
      code: "200",
      category: "invalid_request",
      confidence: "strong",
    });
    expect(r.errors[0]!.subCodes.family).toBe("brick_token");
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/also a pingback type/);
    const token = analyzeFixture("brick-token-error.json");
    expect(token.errors[0]).toMatchObject({
      code: "224",
      retry: "customer_action_required",
    });
  });

  it("does not present an internal error as a safe retry", () => {
    const r = analyzeFixture("brick-error-internal.txt");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "1000",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/charge twice/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes the PHP SDK envelope with the Brick tables", () => {
    const r = analyzeFixture("brick-sdk-error.json");
    expect(r.errors[0]).toMatchObject({
      code: "3014",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/SDK/);
  });

  it("reports an undocumented Brick code honestly", () => {
    const r = analyze(JSON.stringify({ type: "Error", error: "PPLsynth new failure", code: 3999 }));
    expect(r.events[0]).toMatchObject({ outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "3999",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      outcomeKnown: false,
    });
  });

  it("uses a MINT-only meaning with possible confidence when the shape is Brick's", () => {
    const d = decodePaymentwallCode("2003", "brick");
    expect(d).toMatchObject({ family: "mint_redemption", confidence: "possible" });
    expect(d.missing.join(" ")).toMatch(/not in the Brick tables/);
  });
});

describe("paymentwall Mobiamo", () => {
  it("decodes a Mobiamo error", () => {
    const r = analyzeFixture("mobiamo-error.json");
    expect(r.errors[0]).toMatchObject({
      code: "W15",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "strong",
    });
    expect(r.events[0]).toMatchObject({ eventType: "mobiamo.error", outcome: "unknown" });
  });

  it("decodes code 18 (printed without W) as Mobiamo only with possible confidence", () => {
    const d = decodePaymentwallCode("18");
    expect(d).toMatchObject({ family: "mobiamo", confidence: "possible" });
    expect(d.entry.meaning).toBe("Signature invalid");
    expect(decodePaymentwallCode("18", "mobiamo").confidence).toBe("strong");
  });

  it("normalizes a Mobiamo flow step and a completed payment", () => {
    const r = analyzeFixture("mobiamo-init.json");
    expect(r.events[0]).toMatchObject({
      eventType: "mobiamo.flow.code",
      stage: "payment",
      outcome: "pending",
      paymentReference: "PPLsynthMOB0001",
    });
    expect(JSON.stringify(r.events)).not.toContain("instructions text");
    const done = analyze(JSON.stringify({ ref: "PPLsynthMOB0001", completed: true }), {
      provider: "paymentwall",
    });
    expect(done.events[0]).toMatchObject({ eventType: "mobiamo.completed", outcome: "success" });
    const both = analyzeRecords(
      [
        JSON.parse(fixture("paymentwall/mobiamo-init.json")),
        { ref: "PPLsynthMOB0001", completed: false },
      ],
      { ...options, provider: "paymentwall" },
    );
    expect(both.ok).toBe(true);
    if (both.ok) expect(both.result.groups).toHaveLength(1);
  });
});

describe("paymentwall unidentified error family", () => {
  it("is not analyzed without a manual provider selection", () => {
    const r = analyzeFixture("unidentified-error-3004.json");
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/select Paymentwall manually/);
  });

  it("lists every documented meaning with possible confidence", () => {
    const r = analyzeFixture("unidentified-error-3004.json", { provider: "paymentwall" });
    expect(r.records[0]!.status).toBe("analyzed");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "3004",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(e.explanation).toMatch(/Brick payment: Expiration month invalid/);
    expect(e.explanation).toMatch(/MINT ePIN redemption: Duplicate ePIN/);
    expect(e.subCodes.family).toBeUndefined();
    expect(e.documentation.length).toBe(2);
  });

  it("keeps an agreeing collision's category but still lowers confidence", () => {
    // 3001: Brick permission denied vs MINT not active for the project, both configuration.
    const d3001 = decodePaymentwallCode("3001");
    expect(d3001).toMatchObject({ family: null, confidence: "possible" });
    expect(d3001.entry).toMatchObject({ category: "configuration", retry: "do_not_retry" });
    expect(d3001.entry.explanation).toMatch(/Permission denied.*MINT not active/);
    // 3008: Brick required fields missing vs MINT tracking failure (different categories).
    expect(decodePaymentwallCode("3008").entry.category).toBe("unknown");
    // 1001: Brick configuration vs MINT internal error; outcome not known.
    const d1001 = decodePaymentwallCode("1001");
    expect(d1001.entry.outcomeKnown).toBe(false);
    expect(d1001.entry.retry).toBe("manual_review");
  });

  it("decodes MINT generation codes from the generic shape", () => {
    const r = analyze(JSON.stringify({ code: -32000, message: "PPLsynth auth" }), {
      provider: "paymentwall",
    });
    expect(r.errors[0]).toMatchObject({
      code: "-32000",
      category: "configuration",
      confidence: "possible",
    });
    expect(r.errors[0]!.subCodes.family).toBe("mint_generation");
  });

  it("reports an unknown code with insufficient confidence", () => {
    const r = analyze(JSON.stringify({ code: 987654, error: "PPLsynth x" }), {
      provider: "paymentwall",
    });
    expect(r.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });
});

describe("paymentwall redaction", () => {
  const planted = [
    SIG32,
    SIG64,
    "PPLsynth-user-0001",
    "PPLsynth-user-0002",
    "PPLsynth-user-0100",
    "PPLsynth-user-0009",
    "planted.buyer@example.com",
    "PPLsynth-permanent-card-token-0001",
    "PPLsynth-support-token-0001",
    "PPLsynth Planted Holder",
    "PPLsynthPAREQ0001",
    "PPLsynthMD0001",
    "PPLsynth instructions text",
    "4242",
    "192.0.2.44",
    "PPLsynth-agent",
  ];

  it("keeps signatures, uid, tokens, card and 3-D Secure data out of events and reports", () => {
    const r = analyzeMany(
      fixture("paymentwall/pingback-goods-delivered.txt"),
      fixture("paymentwall/pingback-subscription-payment.txt"),
      fixture("paymentwall/pingback-http-get.txt"),
      fixture("paymentwall/brick-charge-captured.json"),
      fixture("paymentwall/brick-3ds-redirect.json"),
      fixture("paymentwall/mobiamo-init.json"),
      pingback({ uid: "planted.buyer@example.com", USER_IP: "192.0.2.44", sig: SIG64 }),
    );
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
  });
});

describe("paymentwall manifest", () => {
  it("is honest about capabilities and the high-risk metadata", () => {
    expect(paymentwallManifest).toMatchObject({
      id: "paymentwall",
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "partial",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
    });
    expect(paymentwallManifest.categories).toEqual([
      "gateway",
      "card_processing",
      "alternative_payment_method",
    ]);
    expect(paymentwallManifest.sectors).toHaveLength(6);
    for (const s of paymentwallManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(www|docs)\.paymentwall\.com\//);
    expect(paymentwallManifest.capabilities).toMatchObject({
      errorDecoding: "limited",
      paymentResponses: "limited",
      webhookParsing: "supported",
      timeline: "limited",
      correlation: "limited",
    });
    expect(paymentwallManifest.delivery).toMatchObject({
      ordering: "not_documented",
      duplicatesDocumented: true,
    });
    expect(paymentwallManifest.documentation.some((d) => d.url.includes("terminal3"))).toBe(true);
    expect(paymentwallManifest.limitations.join(" ")).toMatch(/Terminal3/);
    const text = JSON.stringify(paymentwallManifest);
    for (const dash of [0x2013, 0x2014]) expect(text).not.toContain(String.fromCharCode(dash));
  });
});
