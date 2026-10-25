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
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules } from "@pandapaylens/rules";
import {
  API_ERRORS,
  decodeApiError,
  IN_BODY_MESSAGES,
  POSTBACK_EVENTS,
  POSTBACK_KINDS,
  RUM_COMMANDS,
  verotelAdapter,
  verotelManifest,
  VEROTEL_ADAPTER_VERSION,
} from "@pandapaylens/verotel";
import defaultExport from "@pandapaylens/verotel";

const options: AnalyzeOptions = {
  adapters: [verotelAdapter],
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
const analyzeFixture = (p: string) => analyze(fixture(`verotel/${p}`));

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
const SIG64 = "7c1e4f2a9b3d5e6f80a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b";

const postback = (fields: Record<string, string> = {}) =>
  form({
    shopID: "PPLsynth64233",
    type: "subscription",
    event: "rebill",
    saleID: "PPLsynth13029901",
    subscriptionType: "recurring",
    transactionID: "PPLsynth80829001",
    amount: "10.00",
    currency: "EUR",
    nextChargeOn: "2026-11-01",
    subscriptionPhase: "normal",
    signature: SIG64,
    ...fields,
  });

function detectText(text: string) {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return verotelAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
}

describe("verotel exports", () => {
  it("exports the adapter, manifest, version and catalogs", () => {
    expect(defaultExport).toBe(verotelAdapter);
    expect(verotelAdapter.id).toBe("verotel");
    expect(VEROTEL_ADAPTER_VERSION).toBe("0.1.0");
    expect(POSTBACK_EVENTS).toHaveLength(10);
    // 11 postback kinds; credit and chargeback exist for both purchase and subscription.
    expect(Object.keys(POSTBACK_KINDS)).toHaveLength(13);
    expect(Object.keys(RUM_COMMANDS)).toHaveLength(5);
    expect(API_ERRORS).toHaveLength(11);
    expect(IN_BODY_MESSAGES).toHaveLength(2);
  });
});

describe("verotel detection", () => {
  it.each([
    ["postback-purchase-success.txt", "verotel.flexpay.postback", true],
    ["postback-subscription-rebill.txt", "verotel.flexpay.postback", true],
    ["rum-add.txt", "verotel.rum.postback", true],
    ["api-error-cancel-rebill-retry.txt", "verotel.api.error", true],
    ["api-transaction-declined.json", "verotel.api.transaction", true],
    ["api-sale-subscription.json", "verotel.api.sale", true],
    ["api-action-refund-warning.json", "verotel.api.action", true],
    ["flexpay-startorder-request.txt", "verotel.flexpay.request", false],
  ])("detects %s", (file, format, supported) => {
    const d = detectText(fixture(`verotel/${file}`));
    expect(d.format).toBe(format);
    expect(d.supported).toBe(supported);
    expect(d.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("detects postbacks of every brand host by structure only", () => {
    const query = postback();
    for (const host of [
      "https://merchant.example.com/flexpay/postback.php",
      "https://another.example.org/cb",
    ]) {
      const d = detectText(`${host}?${query}`);
      expect(d.format).toBe("verotel.flexpay.postback");
      expect(d.confidence).toBe(detectText(query).confidence);
    }
    const startorder = fixture("verotel/flexpay-startorder-request.txt").trim().split("?")[1]!;
    for (const host of ["https://secure.billing.creditcard", "https://secure.yoursafe.com"]) {
      const d = detectText(`${host}/startorder?${startorder}`);
      expect(d.format).toBe("verotel.flexpay.request");
      // Core strips the URL (host and path) before detection, so every host scores the same.
      expect(d.confidence).toBe(detectText(startorder).confidence);
    }
  });

  it("does not claim generic shapes", () => {
    const d = (o: unknown, meta?: Parameters<typeof verotelAdapter.detect>[1]) =>
      verotelAdapter.detect(o, meta).confidence;
    const formMeta = { format: "form" as const };
    expect(d({ error: "x" })).toBe(0);
    expect(d({ error: { status: 412, title: "x" } })).toBe(0);
    expect(d({ status: "ok" })).toBe(0);
    expect(d({ is_success: true })).toBe(0);
    expect(d({ is_success: true, sale_id: 1, extra: "x" })).toBe(0);
    expect(d({ type: "subscription", event: "rebill" }, formMeta)).toBe(0);
    expect(d({ saleID: "1" }, formMeta)).toBe(0);
    expect(d({ trn: "add" }, formMeta)).toBe(0);
    expect(d({ name: "verotel", provider: "Verotel", message: "verotel error" }, formMeta)).toBe(0);
    // The camelCase pair alone stays below the analysis threshold.
    expect(d({ saleID: "1", shopID: "2" }, formMeta)).toBeLessThan(0.5);
    // JSON families are not claimed when the record arrived as form data.
    expect(d({ is_success: "true", sale_id: "1" }, formMeta)).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
    expect(d("saleID=1&shopID=2")).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(verotelAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(verotelAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("does not claim records of other supported providers", () => {
    for (const dir of ["payabl", "mollie", "checkout", "paypal", "braintree", "square"]) {
      let files: string[] = [];
      try {
        files = readdirSync(fixturePath(dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          expect(
            verotelAdapter.detect(record, parsed.value.meta[i]).confidence,
            `${dir}/${file}[${i}]`,
          ).toBeLessThan(0.5);
        });
      }
    }
  });
});

describe("verotel FlexPay purchase postbacks", () => {
  it("normalizes an approved purchase", () => {
    const r = analyzeFixture("postback-purchase-success.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "verotel.flexpay.postback" });
    expect(r.events).toHaveLength(1);
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "purchase",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      isRecurring: false,
      paymentReference: "PPLsynth13029101",
      relatedReference: "PPLsynth80820001",
      merchantReference: "PPLsynth-ref-0001",
      amountMinor: "1995",
      currency: "EUR",
      deliveryKey: "purchase:PPLsynth13029101:PPLsynth80820001",
    });
    expect(e.subscriptionReference).toBeUndefined();
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.attributes).toMatchObject({
      paymentMethod: "CC",
      signature: "present_sha256_length",
      oneClickTokenIssued: true,
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("maps purchase credit to refund and chargeback to an open dispute", () => {
    const credit = analyzeFixture("postback-purchase-credit.txt").events[0]!;
    expect(credit).toMatchObject({
      eventType: "purchase.credit",
      stage: "refund",
      outcome: "success",
      relatedReference: "PPLsynth80820050",
      amountMinor: "1995",
    });
    expect(credit.attributes.parentTransactionId).toBe("PPLsynth80820001");
    const cb = analyzeFixture("postback-purchase-chargeback.txt");
    expect(cb.events[0]).toMatchObject({
      eventType: "purchase.chargeback",
      stage: "dispute",
      outcome: "unknown",
      amountMinor: "995",
      currency: "USD",
    });
    expect(cb.findings.map((f) => f.ruleId)).not.toContain("UNRESOLVED_OUTCOME");
  });
});

describe("verotel FlexPay subscription postbacks", () => {
  it("normalizes the initial charge with a trial", () => {
    const e = analyzeFixture("postback-subscription-initial.txt").events[0]!;
    expect(e).toMatchObject({
      eventType: "subscription.initial",
      stage: "payment",
      outcome: "success",
      isRecurring: false,
      subscriptionReference: "PPLsynth13029201",
      amountMinor: "295",
      currency: "EUR",
    });
    expect(e.attributes).toMatchObject({
      amountBasis: "trialAmount",
      recurringPriceMinor: "2995",
      period: "P1M",
      trialPeriod: "P3D",
      nextChargeOn: "2026-10-04",
      subscriptionType: "recurring",
    });
  });

  it("treats a rebill as a recurring payment using amount/currency", () => {
    const e = analyzeFixture("postback-subscription-rebill.txt").events[0]!;
    expect(e).toMatchObject({
      eventType: "subscription.rebill",
      stage: "payment",
      outcome: "success",
      isRecurring: true,
      amountMinor: "2995",
      currency: "EUR",
      subscriptionReference: "PPLsynth13029201",
    });
    expect(e.attributes.subscriptionPhase).toBe("normal");
  });

  it.each([
    ["postback-subscription-extend.txt", "subscription.extend"],
    ["postback-subscription-cancel.txt", "subscription.cancel"],
    ["postback-subscription-uncancel.txt", "subscription.uncancel"],
    ["postback-subscription-expiry.txt", "subscription.expiry"],
    ["postback-subscription-upgrade.txt", "subscription.upgrade"],
  ])("maps %s to the subscription stage", (file, eventType) => {
    const r = analyzeFixture(file);
    expect(r.events[0]).toMatchObject({
      eventType,
      eventTypeKnown: true,
      stage: "subscription",
      outcome: "success",
    });
    expect(r.errors).toEqual([]);
  });

  it("keeps cancel and uncancel actors, and states that expiry has no reason", () => {
    expect(analyzeFixture("postback-subscription-cancel.txt").events[0]!.attributes).toMatchObject({
      cancelledBy: "user",
      expiresOn: "2026-12-04",
    });
    expect(
      analyzeFixture("postback-subscription-uncancel.txt").events[0]!.attributes,
    ).toMatchObject({ uncancelledBy: "support" });
    const expiry = analyzeFixture("postback-subscription-expiry.txt").events[0]!;
    expect(expiry.attributes.reasonInPayload).toBe(false);
    expect(expiry.amountMinor).toBeUndefined();
    expect(expiry.deliveryKey).toBeUndefined();
    expect(
      analyzeFixture("postback-subscription-extend.txt").events[0]!.attributes.reasonInPayload,
    ).toBe(false);
  });

  it("does not show a downgrade's new price as a charge", () => {
    const e = analyzeFixture("postback-subscription-downgrade.txt").events[0]!;
    expect(e.amountMinor).toBeUndefined();
    expect(e.attributes).toMatchObject({ newRebillAmountMinor: "1995", newRebillCurrency: "EUR" });
  });

  it("maps subscription credit to refund and chargeback to dispute", () => {
    expect(analyzeFixture("postback-subscription-credit.txt").events[0]).toMatchObject({
      stage: "refund",
      outcome: "success",
      amountMinor: "2995",
    });
    const cb = analyzeFixture("postback-subscription-chargeback.txt").events[0]!;
    expect(cb).toMatchObject({ stage: "dispute", outcome: "unknown", currency: "USD" });
    expect(cb.attributes.subscriptionPhase).toBe("terminated");
  });

  it("covers every documented postback kind", () => {
    const seen = new Set<string>();
    for (const file of readdirSync(fixturePath("verotel")).filter((f) =>
      f.startsWith("postback"),
    )) {
      for (const e of analyzeFixture(file).events) {
        expect(e.eventTypeKnown, file).toBe(true);
        seen.add(e.eventType);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(POSTBACK_KINDS).sort());
  });

  it("keeps undocumented events unknown", () => {
    const r = analyze(postback({ event: "pause" }));
    expect(r.events[0]).toMatchObject({
      eventType: "subscription.pause",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
    // A subscription-only event on a purchase is not documented either.
    expect(analyze(postback({ type: "purchase" })).events[0]!.eventTypeKnown).toBe(false);
  });

  it("drops undocumented enum values instead of copying them", () => {
    const e = analyze(postback({ subscriptionPhase: "PPLsynth-odd", nextChargeOn: "soon" }))
      .events[0]!;
    expect(e.attributes.subscriptionPhase).toBeUndefined();
    expect(e.attributes.nextChargeOn).toBeUndefined();
  });

  it("analyzes a form-encoded HTTP body and a full URL", () => {
    const http = `POST /flexpay/postback HTTP/1.1\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${postback()}`;
    const r = analyze(http);
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({ eventType: "subscription.rebill", isRecurring: true });
    const url = analyze(`https://merchant.example.com/postback.php?${postback()}`);
    expect(url.events[0]!.paymentReference).toBe("PPLsynth13029901");
    expect(JSON.stringify(url.events)).not.toContain("merchant.example.com");
  });

  it("analyzes a GET postback whose data is in the request line query string", () => {
    const r = analyzeText(
      `GET /postback?${postback()} HTTP/1.1
Host: merchant.example.com

`,
      options,
    );
    expect(r).toMatchObject({ ok: true });
    if (r.ok)
      expect(r.result.records[0]).toMatchObject({
        status: "analyzed",
        format: "verotel.flexpay.postback",
      });
  });
});

describe("verotel parse issues", () => {
  it("reports missing required fields instead of throwing", () => {
    const r = analyze(
      form({ saleID: "PPLsynth1", shopID: "PPLsynth2", event: "rebill", signature: SIG64 }),
    );
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "verotel.flexpay.postback" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^type:/);
    expect(r.events).toEqual([]);
  });

  it("reports repeated keys and empty ids as parse issues", () => {
    const repeated = analyze(`${postback()}&saleID=PPLsynth2`);
    expect(repeated.records[0]!.status).toBe("invalid");
    expect(repeated.records[0]!.reasons.join(" ")).toMatch(/saleID/);
    const empty = analyze(postback({ saleID: "" }));
    expect(empty.records[0]!.status).toBe("invalid");
  });

  it("fails cleanly on malformed input", () => {
    expect(analyzeText("saleID=1&shopID", options).ok).toBe(false);
    expect(analyzeText('{"error": {"status": 412,', options).ok).toBe(false);
    expect(verotelAdapter.parse("x", "verotel.flexpay.postback").ok).toBe(false);
    expect(verotelAdapter.parse({}, "verotel.nope").ok).toBe(false);
    expect(verotelAdapter.parse({ id: 1 }, "verotel.api.transaction").ok).toBe(false);
  });

  it("recognizes a FlexPay request URL but does not analyze it", () => {
    const r = analyzeFixture("flexpay-startorder-request.txt");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "verotel.flexpay.request",
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/postback/);
    expect(r.events).toEqual([]);
  });
});

describe("verotel duplicates and correlation", () => {
  it("flags a repeated rebill postback with the same transactionID", () => {
    const text = fixture("verotel/postback-subscription-rebill.txt");
    const r = analyzeMany(text, text);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe("subscription.rebill:PPLsynth13029201:PPLsynth80821002");
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).not.toMatch(/documents that it can deliver/);
  });

  it("does not treat two different rebills as duplicates", () => {
    const r = analyzeMany(
      postback(),
      postback({ transactionID: "PPLsynth80829002", nextChargeOn: "2026-12-01" }),
    );
    expect(new Set(r.events.map((e) => e.deliveryKey)).size).toBe(2);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(r.groups).toHaveLength(1);
  });

  it("groups a subscription lifecycle log by saleID in supplied order", () => {
    const r = analyzeFixture("postbacks-subscription-log.txt");
    expect(r.records).toHaveLength(4);
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.eventType)).toEqual([
      "subscription.initial",
      "subscription.rebill",
      "subscription.extend",
      "subscription.expiry",
    ]);
    expect(r.events.every((e) => e.attributes.signature === "present_sha1_length")).toBe(true);
    expect(r.arrivalOrderInferred).toBe(true);
  });

  it("links postbacks, API transactions, the credit and the upgraded sale", () => {
    const r = analyzeMany(
      fixture("verotel/postback-subscription-initial.txt"),
      fixture("verotel/postback-subscription-rebill.txt"),
      fixture("verotel/api-transaction-debit-refunded.json"),
      fixture("verotel/postback-subscription-credit.txt"),
      fixture("verotel/api-transaction-credit.json"),
      fixture("verotel/postback-subscription-upgrade.txt"),
      fixture("verotel/api-sale-subscription.json"),
    );
    expect(r.events).toHaveLength(7);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining([
        "sale:PPLsynth13029201",
        "sale:PPLsynth13029401",
        "txn:PPLsynth80821002",
        "txn:PPLsynth80821090",
      ]),
    );
    // The API sale record carries a time; postbacks carry none.
    expect(r.events.find((e) => e.eventType === "sale.SUBSCRIPTION")!.eventTimestamp).toBe(
      "2026-09-01T07:59:00.000Z",
    );
  });

  it("links a refund action response to the reversal it created", () => {
    const r = analyzeMany(
      fixture("verotel/api-action-refund-warning.json"),
      fixture("verotel/postback-subscription-credit.txt"),
    );
    expect(r.groups).toHaveLength(1);
  });

  it("keeps unrelated sales apart even with the same referenceID and custom1", () => {
    const r = analyzeMany(
      postback({
        saleID: "PPLsynthA1",
        transactionID: "PPLsynthT1",
        referenceID: "PPLsynth-same",
        custom1: "u1",
      }),
      postback({
        saleID: "PPLsynthB2",
        transactionID: "PPLsynthT2",
        referenceID: "PPLsynth-same",
        custom1: "u1",
      }),
      fixture("verotel/api-transaction-declined.json"),
      fixture("verotel/rum-add.txt"),
    );
    expect(r.groups).toHaveLength(4);
  });

  it("does not let a sale id and a transaction id with the same value collide", () => {
    const r = analyzeMany(
      postback({ saleID: "PPLsynth77", transactionID: "PPLsynth88" }),
      postback({ saleID: "PPLsynth88", transactionID: "PPLsynth99" }),
    );
    expect(r.groups).toHaveLength(2);
  });
});

describe("verotel Control Center API errors", () => {
  it("decodes the rebill retry period error", () => {
    const r = analyzeFixture("api-error-cancel-rebill-retry.txt");
    expect(r.records[0]!.format).toBe("verotel.api.error");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 412",
    });
    expect(r.errors[0]).toMatchObject({
      code: "412",
      category: "invalid_request",
      retry: "retry_conditionally",
      confidence: "strong",
      providerMessage: "Cancel rebilling is disabled during rebill retry period.",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      httpStatus: "412",
      title: "rebill_retry_period",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Check the sale state first/);
  });

  it("decodes an authentication failure as configuration", () => {
    const r = analyzeFixture("api-error-unauthorized.txt");
    expect(r.errors[0]).toMatchObject({
      code: "401",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("decodes a validation error with the published typo", () => {
    const r = analyzeFixture("api-error-missing-parameter.json");
    expect(r.errors[0]).toMatchObject({
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(r.errors[0]!.subCodes.title).toBe("parameter_required");
    expect(decodeApiError(412, "Parameter amount is required").id).toBe("parameter_required");
    expect(decodeApiError(412, "Failed to refund the transaction").id).toBe("refund_failed");
    expect(decodeApiError(412, "Failed to refund the transaction.").entry.retry).toBe(
      "manual_review",
    );
    expect(decodeApiError(406, "Cannot process request for accept header: text/xml").id).toBe(
      "accept_unsupported",
    );
  });

  it("uses Retry-After for the rate limit", () => {
    const r = analyzeFixture("api-error-rate-limit.txt");
    expect(r.errors[0]).toMatchObject({
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Retry-After: 1200 seconds/);
    expect(r.events[0]!.attributes.retryAfterSeconds).toBe(1200);
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("falls back to the HTTP status for untitled cases", () => {
    const notFound = decodeApiError(404, "Not Found");
    expect(notFound).toMatchObject({ id: null, confidence: "strong" });
    expect(notFound.entry.category).toBe("invalid_request");
    const other412 = decodeApiError(412, "Too many records");
    expect(other412.confidence).toBe("possible");
    expect(other412.entry.explanation).toMatch(/5000/);
    const mismatch = decodeApiError(406, "Rate limit exceeded");
    expect(mismatch).toMatchObject({ id: "rate_limited", confidence: "possible" });
  });

  it("keeps an undocumented status honest and does not suggest a blind retry", () => {
    const r = analyze(
      `HTTP/1.1 503 Service Unavailable\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({
        error: {
          documentation: "https://controlcenter.verotel.com/api-doc/index.html",
          status: 503,
          title: "PPLsynth new failure",
        },
      })}`,
    );
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "503",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      outcomeKnown: false,
    });
    expect(r.errors[0]!.nextAction).toMatch(/GET \/sale\/:id/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
  });

  it("notes a mismatch between HTTP status and body status", () => {
    const r = analyze(
      `HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({
        error: {
          documentation: "https://controlcenter.verotel.com/api-doc/index.html",
          status: 412,
          title: "Invalid date range",
        },
      })}`,
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/differs/);
  });
});

describe("verotel Control Center API objects", () => {
  it("decodes a declined transaction with NO_FUNDS", () => {
    const r = analyzeFixture("api-transaction-declined.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.DEBIT",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth1760",
      relatedReference: "PPLsynth80823323",
      amountMinor: "1210",
      currency: "USD",
      eventTimestamp: "2026-09-29T11:09:16.000Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      transactionSubtype: "PURCHASE",
      instrumentType: "CREDIT_CARD",
      reversalExtent: "NONE",
      testMode: false,
    });
    expect(r.errors[0]).toMatchObject({
      code: "NO_FUNDS",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      providerMessage: "Insufficient funds",
      paymentReference: "PPLsynth1760",
      outcomeKnown: true,
    });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("reports an undocumented decline category with insufficient confidence", () => {
    const tx = JSON.parse(fixture("verotel/api-transaction-declined.json")) as Record<
      string,
      unknown
    >;
    tx.decline_reason = { id: "PPLSYNTH_NEW", description: "Something else" };
    const r = analyze(JSON.stringify(tx));
    expect(r.errors[0]).toMatchObject({
      code: "PPLSYNTH_NEW",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not documented/);
  });

  it("shows reversals of a debit and the credit transaction", () => {
    const debit = analyzeFixture("api-transaction-debit-refunded.json").events[0]!;
    expect(debit).toMatchObject({
      stage: "payment",
      outcome: "success",
      subscriptionReference: "PPLsynth13029201",
    });
    expect(debit.isRecurring).toBeUndefined();
    expect(debit.attributes).toMatchObject({
      reversalExtent: "FULL",
      reversalTransactionIds: ["PPLsynth80821090"],
      reversalTypes: ["REFUND"],
      transactionSubtype: "RECURRED",
      shopId: "65147",
    });
    const credit = analyzeFixture("api-transaction-credit.json").events[0]!;
    expect(credit).toMatchObject({
      eventType: "transaction.CREDIT",
      stage: "refund",
      outcome: "success",
    });
    expect(credit.attributes.originalDebitTransactionId).toBe("PPLsynth80821002");
  });

  it("treats a chargeback transaction as a dispute with unknown outcome", () => {
    const r = analyze(
      JSON.stringify({
        id: "PPLsynth5001",
        transaction_type: "CHARGEBACK",
        transaction_subtype: "CHBACK",
        is_approved: true,
        original_debit_transaction_id: "PPLsynth5000",
        price: { amount: 10, currency: "EUR" },
      }),
    );
    expect(r.events[0]).toMatchObject({
      stage: "dispute",
      outcome: "unknown",
      amountMinor: "1000",
    });
  });

  it("reads a sale snapshot leniently", () => {
    const e = analyzeFixture("api-sale-subscription.json").events[0]!;
    expect(e).toMatchObject({
      eventType: "sale.SUBSCRIPTION",
      stage: "payment",
      outcome: "success",
      subscriptionReference: "PPLsynth13029201",
      amountMinor: "2995",
    });
    expect(e.attributes).toMatchObject({
      subscriptionRecurring: true,
      subscriptionExpired: false,
      subscriptionCancelled: false,
      nextChargeOn: "2026-11-04",
      shopId: "60678",
    });
  });

  it("decodes in-body action messages", () => {
    const terminate = analyzeFixture("api-action-terminate-failed.json");
    expect(terminate.events[0]).toMatchObject({
      eventType: "action.terminate",
      stage: "subscription",
      outcome: "failure",
    });
    expect(terminate.errors[0]).toMatchObject({
      code: "terminate_rum_setup",
      category: "configuration",
      retry: "manual_review",
    });
    const refund = analyzeFixture("api-action-refund-warning.json");
    expect(refund.events[0]).toMatchObject({
      eventType: "action.refund",
      stage: "refund",
      outcome: "success",
      relatedReference: "PPLsynth80821090",
    });
    expect(refund.errors[0]).toMatchObject({
      code: "refund_access_postback_failed",
      retry: "manual_review",
    });
    expect(refund.errors[0]!.retryExplanation).toMatch(/Do not repeat the refund/);
    const extend = analyzeFixture("api-action-extend.json");
    expect(extend.events[0]).toMatchObject({ eventType: "action.extend", outcome: "success" });
    expect(extend.errors).toEqual([]);
  });

  it("reports an undocumented action message honestly", () => {
    const r = analyze(
      JSON.stringify({
        sale_id: "PPLsynth1",
        is_success: false,
        error: { message: "PPLsynth odd" },
      }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
      retry: "unknown",
    });
  });

  it("analyzes list responses element by element", () => {
    const list = [
      JSON.parse(fixture("verotel/api-transaction-debit-refunded.json")),
      JSON.parse(fixture("verotel/api-transaction-credit.json")),
    ];
    const r = analyzeRecords(list, options);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.events).toHaveLength(2);
      expect(r.result.groups).toHaveLength(1);
    }
  });
});

describe("verotel Remote User Manager postbacks", () => {
  it("normalizes add and cancel and keeps member credentials out", () => {
    const add = analyzeFixture("rum-add.txt");
    expect(add.records[0]!.format).toBe("verotel.rum.postback");
    expect(add.events[0]).toMatchObject({
      eventType: "rum.add",
      stage: "payment",
      outcome: "success",
      isRecurring: false,
      paymentReference: "PPLsynth39748304",
      deliveryKey: "rum.add:PPLsynth39748304",
    });
    const cancel = analyzeFixture("rum-cancel.txt");
    expect(cancel.events[0]).toMatchObject({ eventType: "rum.cancel", stage: "subscription" });
    expect(cancel.events[0]!.deliveryKey).toBeUndefined();
    const both = analyzeMany(fixture("verotel/rum-add.txt"), fixture("verotel/rum-cancel.txt"));
    expect(both.groups).toHaveLength(1);
  });
});

describe("verotel FlexPay status page", () => {
  const STATUS_FIXTURES = [
    "status-found-subscription.txt",
    "status-found-cancelled.txt",
    "status-found-purchase.txt",
    "status-notfound.txt",
    "status-error-http.txt",
  ];

  it.each([
    ["status-found-subscription.txt", 0.9, 0.98],
    ["status-found-cancelled.txt", 0.9, 0.98],
    ["status-found-purchase.txt", 0.9, 0.98],
    ["status-notfound.txt", 0.5, 0.7],
    ["status-error-http.txt", 0.5, 0.6],
  ])("detects %s by structure", (file, min, max) => {
    const d = detectText(fixture(`verotel/${file}`));
    expect(d).toMatchObject({ format: "verotel.flexpay.status", supported: true });
    expect(d.confidence).toBeGreaterThanOrEqual(min);
    expect(d.confidence).toBeLessThanOrEqual(max);
  });

  it("keeps a bare ERROR page modest and weak shapes below the threshold", () => {
    expect(detectText("response: ERROR\nerror: something went wrong").confidence).toBe(0.5);
    expect(detectText("response: FOUND\nsaleID: PPLsynth1").confidence).toBeLessThan(0.6);
    expect(detectText("response: ERROR\nmessage: x").confidence).toBeLessThan(0.5);
    expect(detectText("response: NOTFOUND\nfoo: x\nbar: y").confidence).toBeLessThan(0.5);
    expect(detectText("response: FOUND\nresult: x\nfoo: y\nbar: z").confidence).toBeLessThan(0.5);
    // An undocumented answer is not analyzed, and never read as a postback.
    const odd = detectText(
      "response: PENDING\nsaleID: PPLsynth1\nshopID: PPLsynth2\ntype: purchase\nsaleResult: APPROVED",
    );
    expect(odd.format).toBe("verotel.flexpay.status");
    expect(odd.confidence).toBeLessThan(0.5);
  });

  it("claims only text records, never JSON or form records", () => {
    const fields = {
      response: "FOUND",
      saleID: "PPLsynth1",
      shopID: "PPLsynth2",
      saleResult: "APPROVED",
      type: "purchase",
    };
    const d = (meta?: Parameters<typeof verotelAdapter.detect>[1]) =>
      verotelAdapter.detect(fields, meta);
    expect(d({ format: "text" }).format).toBe("verotel.flexpay.status");
    expect(d({ format: "http", http: { kind: "response", status: 200, headers: {} } }).format).toBe(
      "verotel.flexpay.status",
    );
    for (const meta of [
      undefined,
      { format: "json" as const },
      { format: "jsonl" as const },
      { format: "form" as const },
      {
        format: "http" as const,
        http: {
          kind: "response" as const,
          status: 200,
          contentType: "application/json",
          headers: {},
        },
      },
    ])
      expect(d(meta).format, JSON.stringify(meta)).not.toBe("verotel.flexpay.status");
    expect(detectText(JSON.stringify(fields)).format).not.toBe("verotel.flexpay.status");
    expect(detectText(form(fields)).format).not.toBe("verotel.flexpay.status");
  });

  it("reads the v3 subscription page as one snapshot of the sale", () => {
    const r = analyzeFixture("status-found-subscription.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "verotel.flexpay.status" });
    expect(r.events).toHaveLength(1);
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "status.FOUND",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "response=FOUND; saleResult=APPROVED",
      paymentReference: "PPLsynth13029033",
      merchantReference: "PPLsynth-order-0033",
      subscriptionReference: "PPLsynth13029033",
    });
    expect(e.attributes).toEqual({
      observation: "snapshot",
      response: "FOUND",
      saleResult: "APPROVED",
      saleId: "PPLsynth13029033",
      shopId: "PPLsynth64233",
      type: "subscription",
      subscriptionType: "recurring",
      subscriptionPhase: "trial",
      period: "P1M",
      trialPeriod: "P3D",
      expired: false,
      expiresOn: "30-DEC-2015",
      cancelled: true,
      cancelledOn: "28-DEC-2014",
      cancelledBy: "user",
      saleCreatedOn: "27-DEC-2014 03:22:12",
      paymentMethod: "Credit Card",
      oneClickTokenIssued: true,
      priceAmountMinor: "5120",
      priceCurrency: "EUR",
      trialAmountMinor: "295",
      discountAmountMinor: "395",
    });
    // The recurring price is not a charge, and no snapshot time is invented.
    expect(e.amountMinor).toBeUndefined();
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.deliveryKey).toBeUndefined();
    expect(e.isRecurring).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("keeps v4 ISO dates as attributes and subscription facts out of stages", () => {
    const r = analyzeFixture("status-found-cancelled.txt");
    const e = r.events[0]!;
    expect(e).toMatchObject({ stage: "payment", outcome: "success" });
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.attributes).toMatchObject({
      expired: true,
      cancelled: true,
      cancelledBy: "merchant",
      saleCreatedOn: "2026-08-02T10:15:00+00:00",
      expiresOn: "2026-10-01T10:15:00+00:00",
      cancelledOn: "2026-09-20T08:00:00+00:00",
      paymentMethod: "Direct Debit EU",
      period: "P30D",
    });
    expect(r.warnings.map((w) => w.code)).not.toContain("TIMESTAMP_IGNORED");
  });

  it("shows a purchase price as the amount", () => {
    const r = analyzeFixture("status-found-purchase.txt");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "status.FOUND",
      outcome: "success",
      amountMinor: "999",
      currency: "USD",
      paymentReference: "PPLsynth13029088",
    });
    expect(e.subscriptionReference).toBeUndefined();
    expect(e.attributes.priceAmountMinor).toBeUndefined();
    expect(e.attributes.type).toBe("purchase");
  });

  it("leaves the outcome unknown without saleResult APPROVED", () => {
    const base = "response: FOUND\nsaleID: PPLsynth5\nshopID: PPLsynth6\ntype: purchase\n";
    const missing = analyze(base).events[0]!;
    expect(missing.outcome).toBe("unknown");
    expect(missing.attributes.saleResult).toBeUndefined();
    const other = analyze(`${base}saleResult: DECLINED`).events[0]!;
    expect(other).toMatchObject({
      outcome: "unknown",
      providerStatus: "response=FOUND; saleResult=DECLINED",
    });
    expect(other.attributes).toMatchObject({ saleResult: "DECLINED", saleResultDocumented: false });
    const junk = analyze(`${base}saleResult: approved by <b>x</b>`).events[0]!;
    expect(junk.outcome).toBe("unknown");
    expect(junk.attributes.saleResult).toBeUndefined();
    const lower = analyze(`${base}saleResult: approved`).events[0]!;
    expect(lower.outcome).toBe("unknown");
  });

  it("drops undocumented enum values and malformed dates", () => {
    const e = analyze(
      [
        "response: FOUND",
        "saleID: PPLsynth7",
        "type: lifetime",
        "subscriptionPhase: frozen",
        "cancelledBy: someone",
        "expiresOn: next tuesday",
        "createdOn: 2026-13",
        "paymentMethod: <script>",
        "priceAmount: 1.234",
        "priceCurrency: EUR",
      ].join("\n"),
    ).events[0]!;
    for (const k of [
      "type",
      "subscriptionPhase",
      "cancelledBy",
      "expiresOn",
      "saleCreatedOn",
      "paymentMethod",
      "priceAmountMinor",
    ])
      expect(e.attributes[k], k).toBeUndefined();
    expect(e.amountMinor).toBeUndefined();
    const label = analyze("response: FOUND\nsaleID: PPLsynth8\npaymentMethod: iDEAL Wallet")
      .events[0]!;
    expect(label.attributes).toMatchObject({
      paymentMethod: "iDEAL Wallet",
      paymentMethodDocumented: false,
    });
  });

  it("reads a one-line text/plain NOTFOUND page, below the threshold unless Verotel is selected", () => {
    const text = fixture("verotel/status-notfound-http-one-line.txt");
    const auto = analyze(text);
    expect(auto.records[0]).toMatchObject({ status: "unsupported", provider: "verotel" });
    expect(auto.records[0]!.confidence).toBeLessThan(0.5);
    const r = analyzeText(text, { ...options, provider: "verotel" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.events[0]).toMatchObject({ eventType: "status.NOTFOUND", stage: "error" });
    expect(r.result.errors[0]).toMatchObject({ code: "NOTFOUND", category: "invalid_request" });
  });

  it("decodes NOTFOUND as an invalid request that should not be retried", () => {
    const r = analyzeFixture("status-notfound.txt");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "status.NOTFOUND",
      stage: "error",
      outcome: "unknown",
      paymentReference: "PPLsynth13029999",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "NOTFOUND",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      paymentReference: "PPLsynth13029999",
      outcomeKnown: true,
      subCodes: { field: "response", response: "NOTFOUND" },
      missingInformation: [],
    });
    expect(r.errors[0]!.documentation[0]!.url).toMatch(/^https:\/\/controlcenter\.verotel\.com\//);
    expect(r.errors[0]!.providerMessage).toBeUndefined();
    expect(ruleIds(r)).not.toContain("MISSING_REFERENCE");
  });

  it("decodes ERROR from a raw HTTP response with the error text scrubbed", () => {
    const r = analyzeFixture("status-error-http.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "verotel.flexpay.status" });
    expect(r.events[0]).toMatchObject({
      eventType: "status.ERROR",
      stage: "error",
      outcome: "unknown",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      response: "ERROR",
      errorTextPresent: true,
      httpStatus: 200,
    });
    expect(JSON.stringify(r.events)).not.toContain("Invalid signature");
    expect(r.errors[0]).toMatchObject({
      code: "ERROR",
      category: "unknown",
      retry: "unknown",
      confidence: "possible",
      providerMessage: "Invalid signature",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/does not document/);
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("masks and cuts provider error text", () => {
    const text = `Lookup failed for planted.buyer@example.com card 4111 1111 1111 1111 ${"x".repeat(400)}`;
    const r = analyze(`response: ERROR\nerror: ${text}\nsaleID: PPLsynth9`);
    const msg = r.errors[0]!.providerMessage!;
    expect(msg.length).toBeLessThanOrEqual(200);
    expect(msg).not.toContain("planted.buyer@example.com");
    expect(msg).not.toContain("4111 1111 1111 1111");
    expect(r.errors[0]!.paymentReference).toBe("PPLsynth9");
    const http = analyze(
      "HTTP/1.1 503 Service Unavailable\nContent-Type: text/plain\n\nresponse: ERROR\nerror: busy",
    );
    expect(http.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP 503/);
  });

  it("reports repeated lines as a parse issue", () => {
    const r = analyze(
      "response: FOUND\nsaleID: PPLsynth1\nsaleID: PPLsynth2\nsaleResult: APPROVED",
    );
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/saleID/);
    expect(verotelAdapter.parse({ saleID: "1" }, "verotel.flexpay.status").ok).toBe(false);
  });

  it("links the snapshot to postbacks and API objects of the same sale without false findings", () => {
    const sale = "PPLsynth13029201";
    const status = [
      "response: FOUND",
      "shopID: PPLsynth64233",
      `saleID: ${sale}`,
      "priceAmount: 10.00",
      "priceCurrency: EUR",
      "type: subscription",
      "subscriptionType: recurring",
      "createdOn: 2026-10-01T08:00:00+00:00",
      "saleResult: APPROVED",
      "cancelled: yes",
      "cancelledBy: user",
    ].join("\n");
    const r = analyzeMany(
      postback({ event: "initial", saleID: sale, priceAmount: "10.00", priceCurrency: "EUR" }),
      postback({ saleID: sale, transactionID: "PPLsynth80829002" }),
      fixture("verotel/postback-subscription-cancel.txt"),
      status,
      status,
      postback({
        event: "credit",
        saleID: sale,
        transactionID: "PPLsynth80829003",
        parentID: "PPLsynth80829002",
        priceAmount: "10.00",
        priceCurrency: "EUR",
      }),
    );
    expect(r.records.every((x) => x.status === "analyzed")).toBe(true);
    const snapshots = r.events.filter((e) => e.eventType === "status.FOUND");
    expect(snapshots).toHaveLength(2);
    const group = r.groups.find((g) => g.eventIds.includes(snapshots[0]!.id))!;
    expect(group.eventIds).toHaveLength(r.events.length);
    const ids = ruleIds(r);
    for (const rule of [
      "CONFLICTING_OBSERVATIONS",
      "OUT_OF_ORDER_ARRIVAL",
      "AMOUNT_MISMATCH",
      "RECURRING_PAYMENT_FAILED",
      "UNRESOLVED_OUTCOME",
      "MISSING_REFERENCE",
    ])
      expect(ids, rule).not.toContain(rule);
    // Two identical lookups are one observation at most, never a confirmed delivery.
    for (const f of r.findings.filter((x) => x.ruleId === "DUPLICATE_DELIVERY"))
      expect(f.confidence).not.toBe("confirmed");
  });

  it("is attributed only to Verotel by the full provider registry", () => {
    const registry = { ...options, adapters: ADAPTERS };
    for (const file of STATUS_FIXTURES) {
      const parsed = parseInput(fixture(`verotel/${file}`));
      if (!parsed.ok) throw new Error(parsed.error.message);
      const record = parsed.value.records[0];
      const meta = parsed.value.meta[0];
      for (const adapter of ADAPTERS) {
        if (adapter.id === "verotel") continue;
        expect(adapter.detect(record, meta).confidence, `${adapter.id} on ${file}`).toBeLessThan(
          0.5,
        );
      }
      const r = analyzeText(fixture(`verotel/${file}`), registry);
      expect(r.ok && r.result.records[0]!.provider, file).toBe("verotel");
    }
  });

  it("does not change how existing Verotel inputs are detected", () => {
    for (const file of readdirSync(fixturePath("verotel"))) {
      if (file.startsWith("status-")) continue;
      const parsed = parseInput(fixture(`verotel/${file}`));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        expect(verotelAdapter.detect(record, parsed.value.meta[i]).format, file).not.toBe(
          "verotel.flexpay.status",
        );
      });
    }
  });
});

describe("verotel redaction", () => {
  const planted = [
    SIG64,
    "3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5",
    "PPLsynthONECLICKTOKEN0001",
    "XXXXXXXXXXXX2222",
    "PPLsynthSecretPass",
    "PPLsynthmember",
    "PPLsynth-user-0001",
    "PPLsynth-custom-value1",
    "PPLsynth Planted Buyer",
    "planted.buyer@example.com",
    "192.0.2.44",
    "PPLsynth membership",
    "4111111111111111",
    "PPLsynthONECLICKTOKEN0002",
    "PPLsynth Planted Street 7",
    "PPLsynth Planted City",
    "PPLsynthZIP1011",
  ];

  it("keeps signatures, tokens, buyer data and member credentials out of events and reports", () => {
    const r = analyzeMany(
      fixture("verotel/postback-purchase-success.txt"),
      fixture("verotel/postbacks-subscription-log.txt"),
      fixture("verotel/rum-add.txt"),
      fixture("verotel/api-transaction-declined.json"),
      fixture("verotel/api-sale-subscription.json"),
      fixture("verotel/status-found-subscription.txt"),
      fixture("verotel/status-found-cancelled.txt"),
      fixture("verotel/status-found-purchase.txt"),
      postback({
        email: "planted.buyer@example.com",
        name: "PPLsynth Planted Buyer",
        truncatedPAN: "4111111111111111",
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
    expect(r.sensitiveData.detected).toBe(true);
  });
});

describe("verotel manifest", () => {
  it("is honest about capabilities and the high-risk metadata", () => {
    expect(verotelManifest).toMatchObject({
      id: "verotel",
      wave: "HR-1",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
    });
    expect(verotelManifest.categories).toEqual([
      "payment_facilitator",
      "merchant_account_intermediary",
      "card_processing",
      "gateway",
    ]);
    expect(verotelManifest.sectors).toHaveLength(8);
    for (const s of verotelManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(www|controlcenter)\.verotel\.com\//);
    expect(verotelManifest.capabilities).toMatchObject({
      errorDecoding: "limited",
      paymentResponses: "limited",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "supported",
    });
    expect(verotelManifest.delivery).toMatchObject({
      ordering: "not_documented",
      duplicatesDocumented: false,
    });
    const text = JSON.stringify(verotelManifest);
    for (const dash of [0x2013, 0x2014]) expect(text).not.toContain(String.fromCharCode(dash));
  });
});
