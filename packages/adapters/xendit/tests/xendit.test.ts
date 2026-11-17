import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { stripeAdapter } from "@pandapaylens/stripe";
import { adyenAdapter } from "@pandapaylens/adyen";
import {
  API_ERROR_CODES,
  DISBURSEMENT_FAILURE_CODES,
  PAYMENT_FAILURE_CODES,
  PAYOUT_FAILURE_CODES,
  WEBHOOK_EVENTS,
  xenditAdapter,
  xenditManifest,
} from "@pandapaylens/xendit";

const options: AnalyzeOptions = {
  adapters: [xenditAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-11-17T12:00:00.000Z"),
};

const fixturesRoot = new URL("../../../../fixtures/", import.meta.url);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, fixturesRoot)), "utf8");

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`xendit/${path}`));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const BIZ = "PPLsynthBUSINESS0001";
const payment = (fields: Record<string, unknown> = {}) => ({
  payment_id: "py-PPLsynth-T001",
  payment_request_id: "pr-PPLsynth-T001",
  reference_id: "PPLsynth-order-T001",
  type: "PAY",
  country: "ID",
  currency: "IDR",
  request_amount: 10000,
  capture_method: "AUTOMATIC",
  channel_code: "CARDS",
  status: "SUCCEEDED",
  created: "2026-11-10T00:00:00Z",
  updated: "2026-11-10T00:01:00Z",
  ...fields,
});
const webhook = (
  event: string,
  data: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  event,
  business_id: BIZ,
  created: "2026-11-10T00:01:05Z",
  ...extra,
  data,
});
const detect = (input: unknown) => xenditAdapter.detect(input);

describe("xendit detection", () => {
  it.each([
    [{ error_code: "REFUND_IN_PROGRESS", message: "wait" }, "xendit.api_error", 0.85],
    [{ error_code: "API_VALIDATION_ERROR", message: "x", errors: [] }, "xendit.api_error", 0.6],
    [webhook("payment.capture", payment()), "xendit.webhook", 0.95],
    [payment(), "xendit.payment", 0.85],
    [
      {
        payment_request_id: "pr-PPLsynth-1",
        status: "REQUIRES_ACTION",
        request_amount: 1,
        channel_code: "DANA",
      },
      "xendit.payment_request",
      0.85,
    ],
    [
      { refund_id: "rfd-PPLsynth-1", payment_id: "py-PPLsynth-1", status: "PENDING" },
      "xendit.refund",
      0.85,
    ],
    [
      { payout_id: "po-PPLsynth-1", status: "ACCEPTED", source_amount: 1, source_currency: "PHP" },
      "xendit.payout",
      0.85,
    ],
  ])("detects %j as %s", (input, format, confidence) => {
    const d = detect(input);
    expect(d.format).toBe(format);
    expect(d.confidence).toBeCloseTo(confidence);
    expect(d.supported).toBe(true);
  });

  it("does not claim generic shapes", () => {
    expect(detect({ error: "x" }).confidence).toBe(0);
    expect(detect({ status: "SUCCEEDED" }).confidence).toBe(0);
    expect(detect({ error_code: "SOMETHING", message: "x" }).confidence).toBeLessThan(0.5);
    // Extra envelope fields belong to other providers' error formats.
    expect(
      detect({ type: "validationError", error_code: "API_VALIDATION_ERROR", message: "x" })
        .confidence,
    ).toBe(0);
    expect(detect({ error_code: "lower_case", message: "x" }).confidence).toBe(0);
    expect(detect({ payment_id: "py-1", status: "SUCCEEDED" }).confidence).toBe(0);
    expect(detect({ id: "1", external_id: "2", status: "PAID" }).confidence).toBe(0);
    expect(detect({ event: "payment.capture", data: payment() }).confidence).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen", "mixed"]) {
      for (const file of readdirSync(fileURLToPath(new URL(`${dir}/`, fixturesRoot)))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          const payload =
            record && typeof record === "object" && "payload" in record
              ? (record as { payload: unknown }).payload
              : record;
          expect(xenditAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          expect(xenditAdapter.detect(payload, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("is not reported as ambiguous next to the Stripe and Adyen adapters", () => {
    const r = analyze(fixture("xendit/card-payment-lifecycle.json"), {
      adapters: [stripeAdapter, adyenAdapter, xenditAdapter],
    });
    expect(r.records.every((s) => s.provider === "xendit" && s.alternatives.length === 0)).toBe(
      true,
    );
    expect(r.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
  });

  it("recognizes other events in the v3 envelope without analyzing them", () => {
    const r = analyzeFixture("unsupported-payment-token-event.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      provider: "xendit",
      format: "xendit.webhook.other",
    });
    expect(r.events).toHaveLength(0);
    expect(r.warnings.map((w) => w.code)).toContain("UNSUPPORTED_RECORD");
  });
});

describe("xendit parsing", () => {
  it("reports missing required fields as parse issues instead of throwing", () => {
    const p = xenditAdapter.parse({ status: "SUCCEEDED" }, "xendit.payment");
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.issues.join(" ")).toMatch(/payment_id/);
    const w = xenditAdapter.parse(
      { event: "payment.capture", business_id: BIZ, created: "x", data: { status: "SUCCEEDED" } },
      "xendit.webhook",
    );
    expect(w.ok).toBe(false);
    const inv = xenditAdapter.parse({ id: "PPLsynthINV1" }, "xendit.invoice");
    expect(inv.ok).toBe(false);
  });

  it("handles malformed payloads without throwing", () => {
    for (const input of [null, 42, "text", [], { data: null }, { error_code: 5 }]) {
      expect(() => xenditAdapter.detect(input)).not.toThrow();
      for (const f of xenditAdapter.supportedFormats)
        expect(() => xenditAdapter.parse(input, f.id)).not.toThrow();
    }
    const r = analyzeText("{ not json", options);
    expect(r.ok).toBe(false);
  });

  it("tolerates unknown fields", () => {
    const p = xenditAdapter.parse(payment({ unknown_field: { nested: true } }), "xendit.payment");
    expect(p.ok).toBe(true);
  });

  it("rejects unknown formats", () => {
    expect(xenditAdapter.parse({}, "xendit.nope").ok).toBe(false);
  });
});

describe("xendit error decoding", () => {
  it("decodes a validation error", () => {
    const r = analyzeFixture("api-error-validation.json");
    expect(r.errors[0]).toMatchObject({
      code: "API_VALIDATION_ERROR",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(r.events[0]).toMatchObject({ stage: "error", attributes: { errorDetailCount: 1 } });
  });

  it("maps an invalid API key to configuration and keeps the HTTP status", () => {
    const r = analyzeFixture("api-error-invalid-api-key.txt");
    expect(r.errors[0]).toMatchObject({
      code: "INVALID_API_KEY",
      category: "configuration",
      subCodes: { httpStatus: "401" },
    });
    expect(r.errors[0]!.missingInformation).toHaveLength(0);
  });

  it("treats a server error as indeterminate, never as safe to retry", () => {
    const r = analyzeFixture("api-error-server-error.json");
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/indeterminate/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes an unavailable channel from a pasted HTTP response", () => {
    const r = analyzeFixture("api-error-channel-unavailable.txt");
    expect(r.records[0]!.confidence).toBeGreaterThan(0.85);
    expect(r.errors[0]).toMatchObject({
      code: "CHANNEL_UNAVAILABLE",
      category: "provider_unavailable",
      subCodes: { httpStatus: "503" },
    });
  });

  it("notes an HTTP status that differs from the documented one", () => {
    const text = `HTTP/1.1 500 Internal Server Error\nContent-Type: application/json\n\n${JSON.stringify({ error_code: "REFUND_IN_PROGRESS", message: "x" })}\n`;
    const r = analyze(text);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP 400, not 500/);
  });

  it("reports an unrecognized error code honestly", () => {
    const r = analyze(
      JSON.stringify({ error_code: "PPLSYNTH_UNDOCUMENTED_ERROR", message: "synthetic" }),
      { provider: "xendit" },
    );
    expect(r.errors[0]).toMatchObject({
      code: "PPLSYNTH_UNDOCUMENTED_ERROR",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.events[0]!.eventTypeKnown).toBe(false);
  });

  it("decodes a payment failure code with the network response code", () => {
    const r = analyzeFixture("payment-failure-declined-by-issuer.json");
    expect(r.errors[0]).toMatchObject({
      code: "DECLINED_BY_ISSUER",
      category: "card_declined",
      confidence: "possible",
      outcomeKnown: true,
      subCodes: { networkResponseCode: "05" },
    });
    expect(r.events[0]).toMatchObject({
      eventType: "payment.failure",
      stage: "payment",
      outcome: "failure",
      amountMinor: "150050",
      currency: "PHP",
    });
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("keeps payment failure codes without a documented meaning at insufficient confidence", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.errors[0]).toMatchObject({
      code: "USER_DID_NOT_AUTHORIZE",
      category: "unknown",
      confidence: "insufficient",
    });
  });

  it("matches the documented failure code that carries a trailing space", () => {
    const r = analyze(
      JSON.stringify(
        webhook(
          "payment.failure",
          payment({ status: "FAILED", failure_code: "CAPTURE_AMOUNT_EXCEEDED " }),
        ),
      ),
    );
    expect(r.errors[0]).toMatchObject({
      code: "CAPTURE_AMOUNT_EXCEEDED",
      category: "invalid_amount",
    });
  });

  it("decodes a refund failure as channel specific", () => {
    const r = analyzeFixture("refund-failed-webhook.json");
    expect(r.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
    expect(r.errors[0]!.explanation).toMatch(/channel specific/);
    expect(r.events[0]).toMatchObject({ stage: "refund", outcome: "failure" });
  });

  it("decodes payout and disbursement failures with Xendit's retry advice", () => {
    const p = analyzeFixture("payout-failed-webhook.json");
    expect(p.errors[0]).toMatchObject({
      code: "INVALID_DESTINATION",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    const d = analyzeFixture("disbursement-failed-callback.json");
    expect(d.errors[0]).toMatchObject({ code: "INVALID_DESTINATION", retry: "manual_review" });
    expect(d.events[0]).toMatchObject({ stage: "payout", outcome: "failure" });
  });

  it("keeps the catalog consistent", () => {
    for (const table of [
      API_ERROR_CODES,
      PAYMENT_FAILURE_CODES,
      PAYOUT_FAILURE_CODES,
      DISBURSEMENT_FAILURE_CODES,
    ])
      for (const [k, e] of Object.entries(table)) {
        expect(k).toMatch(/^[A-Z][A-Z0-9_]*$/);
        expect(e.docs).toMatch(/^https:\/\/(docs|archive\.developers)\.xendit\.co\//);
        expect(e.explanation.length).toBeGreaterThan(10);
        if (e.category === "provider_unavailable" || e.category === "network_or_timeout")
          expect(e.retry).not.toBe("safe_to_retry_technical_request");
      }
    // Every documented payment failure code without a meaning stays unknown.
    for (const e of Object.values(PAYMENT_FAILURE_CODES)) {
      expect(["possible", "insufficient"]).toContain(e.confidence);
      if (e.confidence === "insufficient") expect(e.category).toBe("unknown");
    }
  });
});

describe("xendit normalization", () => {
  it("builds one timeline from request, authorization, capture and refund", () => {
    const r = analyzeFixture("card-payment-lifecycle.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment_request.snapshot", "payment", "pending"],
      ["payment.authorization", "authorization", "success"],
      ["payment.snapshot", "capture", "success"],
      ["payment.capture", "capture", "success"],
      ["refund.snapshot", "refund", "pending"],
      ["refund.succeeded", "refund", "success"],
    ]);
    const capture = r.events.find((e) => e.eventType === "payment.capture")!;
    expect(capture).toMatchObject({
      amountMinor: "25000000",
      currency: "IDR",
      providerStatus: "SUCCEEDED",
      attributes: { captureCount: 1, captureMethod: "MANUAL", networkResponseCode: "00" },
    });
    const refund = r.events.find((e) => e.eventType === "refund.succeeded")!;
    expect(refund).toMatchObject({
      amountMinor: "5000000",
      attributes: { refundReason: "REQUESTED_BY_CUSTOMER" },
    });
    expect(r.errors).toHaveLength(0);
  });

  it("does not claim settlement for a captured payment", () => {
    const r = analyzeFixture("ewallet-payment-success.json");
    expect(r.events.map((e) => e.stage)).not.toContain("settlement");
    expect(r.groups).toHaveLength(1);
  });

  it("keeps payments of a reusable payment code apart", () => {
    const r = analyzeFixture("reusable-payment-code.json");
    expect(r.groups).toHaveLength(3);
    const payments = r.events.filter((e) => e.eventType === "payment.capture");
    expect(payments.every((e) => e.relatedReference === undefined)).toBe(true);
  });

  it("keeps payments apart that only share reference_id", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
  });

  it("reads payout lifecycle and reversal without converting amounts", () => {
    const r = analyzeFixture("payout-lifecycle.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payout.snapshot", "payout", "pending"],
      ["v3_payout.succeeded", "payout", "success"],
      ["v3_payout.reversed", "reversal", "failure"],
    ]);
    expect(r.events.every((e) => e.amountMinor === undefined)).toBe(true);
    expect(r.events[0]!.attributes).toMatchObject({
      sourceAmountAsSent: 50000,
      sourceCurrency: "PHP",
    });
  });

  it("shows undocumented payout statuses and events as unknown", () => {
    const data = {
      payout_id: "po-PPLsynth-U1",
      status: "LOCKED",
      source_amount: 1,
      source_currency: "PHP",
    };
    const r = analyze(JSON.stringify([data, webhook("v3_payout.rejected", data)]));
    expect(r.events.map((e) => [e.eventTypeKnown, e.outcome])).toEqual([
      [false, "unknown"],
      [false, "unknown"],
    ]);
  });

  it("reads legacy invoice callbacks and the webhook-id delivery key", () => {
    const paid = analyzeFixture("invoice-paid-callback.txt");
    expect(paid.events[0]).toMatchObject({
      eventType: "invoice.snapshot",
      stage: "payment",
      outcome: "success",
      amountMinor: "15000000",
      deliveryKey: "PPLsynth-webhook-8001",
      eventTimestamp: "2026-11-16T04:10:00.000Z",
    });
    const expired = analyzeFixture("invoice-expired-callback.json");
    expect(expired.events[0]).toMatchObject({ stage: "cancellation", outcome: "failure" });
  });

  it("reads a completed legacy disbursement without inventing a currency", () => {
    const r = analyzeFixture("disbursement-completed-callback.json");
    expect(r.events[0]).toMatchObject({
      stage: "payout",
      outcome: "success",
      attributes: { amountAsSent: "150000", bankCode: "BCA", isInstant: true },
    });
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.currency).toBeUndefined();
  });

  it("recognizes a repeated delivery of the same webhook", () => {
    const r = analyzeFixture("duplicate-webhook.json");
    expect(r.events).toHaveLength(2);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it("marks unknown events in a documented object without guessing", () => {
    const r = analyze(JSON.stringify(webhook("payment.succeeded", payment())));
    // payment.succeeded is named only in a migration guide, not in the schema.
    expect(r.records[0]!.format).toBe("xendit.webhook.other");
  });

  it("uses the envelope time only when the object has no updated time", () => {
    const r = analyze(JSON.stringify(webhook("payment.capture", payment({ updated: undefined }))));
    expect(r.events[0]!.eventTimestamp).toBe("2026-11-10T00:01:05.000Z");
  });
});

describe("xendit sensitive data", () => {
  it.each([
    [
      "card-payment-lifecycle.json",
      [
        "400000XXXXXX1091",
        "PPLsynthFirst",
        "pplsynth@example.com",
        "PPLsynthCAVV",
        "PPLsynth-rrn-1001",
        "redirect.example",
        "cust-PPLsynth-0001",
        "PPLsynth-ds-1001",
      ],
    ],
    ["ewallet-payment-success.json", ["PPLsynth Payer", "08PPLSYNTH0001", "PPLsynth-receipt-3001"]],
    ["reusable-payment-code.json", ["PPLSYNTH77001", "PPLsynth Customer"]],
    [
      "payout-lifecycle.json",
      [
        "PPLsynth Holder",
        "PPLSYNTH000777",
        "PPLsynthGiven",
        "PPLsynth Street 1",
        "+630000PPLSYNTH",
        "PPLsynth Sender Corp",
      ],
    ],
    [
      "invoice-paid-callback.txt",
      [
        "pplsynth.payer@example.com",
        "PPLSYNTH8800001",
        "PPLsynthCALLBACKTOKEN",
        "PPLsynth Merchant",
        "PPLsynthUSER",
      ],
    ],
    ["disbursement-failed-callback.json", ["PPLSYNTH HOLDER", "PPLSYNTH0099"]],
  ])("does not copy planted sensitive values from %s", (file, planted) => {
    const r = analyzeFixture(file);
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events).not.toContain(value);
      expect(errors).not.toContain(value);
      expect(report).not.toContain(value);
    }
  });
});

describe("xendit manifest", () => {
  it("is honest about capabilities", () => {
    expect(xenditManifest.status).toBe("limited");
    expect(Object.values(xenditManifest.capabilities)).not.toContain("supported");
    expect(xenditManifest.wave).toBe(5);
    expect(xenditManifest.limitations.join(" ")).toMatch(/x-callback-token/);
    expect(xenditManifest.delivery.ordering).toBe("not_guaranteed");
    for (const f of xenditAdapter.supportedFormats)
      expect(xenditManifest.apiFamilies.map((a) => a.id)).toContain(f.id);
  });

  it("only lists webhook events with a documented object", () => {
    for (const e of Object.values(WEBHOOK_EVENTS))
      expect(["payment", "payment_request", "refund", "payout"]).toContain(e.object);
  });
});
