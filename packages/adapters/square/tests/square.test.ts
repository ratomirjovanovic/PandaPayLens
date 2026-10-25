import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeRecords,
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
  ERROR_CATEGORIES,
  ERROR_CODES,
  decodeSquareError,
  squareAdapter,
  squareManifest,
} from "@pandapaylens/square";

const options: AnalyzeOptions = {
  adapters: [squareAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturesRoot = new URL("../../../../fixtures/", import.meta.url);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, fixturesRoot)), "utf8");

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`square/${path}`));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const webhook = (
  type: string,
  object: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => {
  const objectType = type.split(".")[0]!;
  return {
    merchant_id: "PPLsynthMERCHANT1",
    type,
    event_id: `PPLsynth-evt-${type}-${String(object.status)}`,
    created_at: "2026-10-24T10:00:00.000Z",
    data: { type: objectType, id: String(object.id), object: { [objectType]: object } },
    ...extra,
  };
};
const payment = (fields: Record<string, unknown> = {}) => ({
  id: "PPLsynthPAY1",
  updated_at: "2026-10-24T10:00:00.000Z",
  amount_money: { amount: 100, currency: "USD" },
  status: "COMPLETED",
  source_type: "CARD",
  ...fields,
});
const refund = (fields: Record<string, unknown> = {}) => ({
  id: "PPLsynthPAY1_PPLsynthREF1",
  updated_at: "2026-10-24T11:00:00.000Z",
  amount_money: { amount: 50, currency: "USD" },
  status: "COMPLETED",
  payment_id: "PPLsynthPAY1",
  ...fields,
});
const errors = (...items: Record<string, unknown>[]) => JSON.stringify({ errors: items });

describe("square detection", () => {
  it.each([
    [
      { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "GENERIC_DECLINE" }] },
      "square.error_response",
      0.95,
      true,
    ],
    [
      { errors: [{ category: "NEW_THING_ERROR", code: "SOME_CODE" }] },
      "square.error_response",
      0.8,
      true,
    ],
    [{ errors: [{ category: "API_ERROR" }] }, "square.error_response", 0.6, true],
    [{ payment: payment() }, "square.payment", 0.85, true],
    [{ payment: payment({ version_token: "PPLsynthV" }) }, "square.payment", 0.95, true],
    [payment(), "square.payment", 0.75, true],
    [payment({ card_details: { status: "CAPTURED" } }), "square.payment", 0.85, true],
    [{ refund: refund() }, "square.refund", 0.9, true],
    [refund(), "square.refund", 0.75, true],
    [webhook("payment.updated", payment()), "square.webhook", 0.95, true],
    [
      {
        type: "refund.updated",
        event_id: "x",
        data: { type: "refund", id: "r", object: { refund: refund() } },
      },
      "square.webhook",
      0.7,
      true,
    ],
    [
      {
        merchant_id: "m",
        event_id: "e",
        type: "payout.sent",
        data: { type: "payout", id: "p", object: {} },
      },
      "square.webhook.other",
      0.75,
      false,
    ],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(squareAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("does not match on the provider name or generic shapes", () => {
    for (const input of [
      { provider: "square", message: "Square error" },
      "square",
      null,
      [],
      { error: { type: "card_error", code: "card_declined" } },
      { errors: [{ message: "Something failed" }] },
      { errors: [{ code: "invalid", category: "lower" }] },
      { errors: [5] },
      { status: "COMPLETED" },
      { payment: { status: "COMPLETED" } },
      { amount_money: { amount: 1, currency: "USD" } },
      { type: "payment.updated", data: { object: {} } },
    ]) {
      expect(squareAdapter.detect(input).confidence).toBe(0);
    }
    // UPPER_SNAKE code and category alone are not distinctive enough to claim.
    expect(
      squareAdapter.detect({ errors: [{ code: "SOME_CODE", category: "OTHER" }] }).confidence,
    ).toBeLessThan(0.5);
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
          expect(squareAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          expect(squareAdapter.detect(payload, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("is not reported as ambiguous next to the Stripe and Adyen adapters", () => {
    const r = analyze(fixture("square/webhook-lifecycle.json"), {
      adapters: [stripeAdapter, adyenAdapter, squareAdapter],
    });
    expect(r.records.every((s) => s.provider === "square" && s.alternatives.length === 0)).toBe(
      true,
    );
    expect(r.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
  });
});

describe("square parsing", () => {
  it("reports missing required fields as parse issues instead of throwing", () => {
    const missingCode = analyze(errors({ category: "INVALID_REQUEST_ERROR", detail: "x" }));
    expect(missingCode.records[0]).toMatchObject({
      status: "invalid",
      format: "square.error_response",
    });
    expect(missingCode.records[0]!.reasons.join(" ")).toMatch(/errors\.0\.code/);

    const missingId = analyze(JSON.stringify({ payment: payment({ id: undefined }) }));
    expect(missingId.records[0]).toMatchObject({ status: "invalid", format: "square.payment" });
    expect(missingId.records[0]!.reasons.join(" ")).toMatch(/^payment\.id:/);

    const noEventId = webhook("payment.updated", payment()) as Record<string, unknown>;
    delete noEventId.event_id;
    const r = analyze(JSON.stringify(noEventId));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "square.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/event_id/);
    expect(r.events).toEqual([]);
  });

  it("rejects a webhook whose object does not match data.type", () => {
    const evt = webhook("payment.updated", payment());
    const bad = { ...evt, data: { ...evt.data, type: "refund" } };
    const res = squareAdapter.parse(bad, "square.webhook");
    expect(res.ok).toBe(false);
    expect(!res.ok && res.issues[0]).toMatch(/data\.object\.refund/);
    expect(squareAdapter.parse({}, "square.nope").ok).toBe(false);
  });

  it("tolerates unknown fields", () => {
    expect(
      squareAdapter.parse(
        { errors: [{ category: "API_ERROR", code: "X", brand_new: [1] }], extra: true },
        "square.error_response",
      ).ok,
    ).toBe(true);
  });

  it("handles malformed payloads without throwing", () => {
    expect(analyzeText("{not json", options).ok).toBe(false);
    const r = analyzeRecords(
      [
        { errors: "nope" },
        { payment: { id: 5, amount_money: { amount: "ten" }, status: 3, source_type: "CARD" } },
        { errors: [{ category: "PAYMENT_METHOD_ERROR", code: 42 }] },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.records.map((s) => s.status)).toEqual(["unsupported", "invalid", "invalid"]);
    expect(r.result.events).toEqual([]);
  });
});

describe("square error decoding", () => {
  it("decodes a decline that includes the FAILED payment (synthetic, shape from the documented rule)", () => {
    const r = analyzeFixture("declined-with-failed-payment.json");
    // The same code repeated in card_details.errors is not decoded twice.
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      provider: "square",
      code: "GENERIC_DECLINE",
      subCodes: { category: "PAYMENT_METHOD_ERROR" },
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      paymentReference: "PPLsynthPAYDECL00000000001",
      attemptReference: "PPLsynthPAYDECL00000000001",
      providerMessage: "Authorization error: 'GENERIC_DECLINE'",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://developer.squareup.com/reference/square/payments-api/create-payment",
    );
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus])).toEqual([
      ["payment.snapshot", "payment", "failure", "FAILED"],
      ["api_error.GENERIC_DECLINE", "error", "failure", "PAYMENT_METHOD_ERROR"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("decodes gift card insufficient funds with the remaining balance", () => {
    const r = analyzeFixture("gift-card-insufficient-funds.json");
    expect(r.suggestedView).toBe("decoder");
    expect(r.errors.map((e) => [e.code, e.category, e.retry])).toEqual([
      ["INSUFFICIENT_FUNDS", "insufficient_funds", "customer_action_required"],
      ["GIFT_CARD_AVAILABLE_AMOUNT", "insufficient_funds", "customer_action_required"],
    ]);
    expect(r.errors[1]!.subCodes.availableAmountMinor).toBe("1250");
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/No payment or refund object/);
    expect(r.events[0]!.attributes.errorCodes).toEqual([
      "INSUFFICIENT_FUNDS",
      "GIFT_CARD_AVAILABLE_AMOUNT",
    ]);
    expect(r.findings).toEqual([]);
  });

  it("decodes a validation error with the request field", () => {
    const r = analyzeFixture("validation-error.json");
    expect(r.errors[0]).toMatchObject({
      code: "MISSING_REQUIRED_PARAMETER",
      category: "invalid_request",
      retry: "do_not_retry",
      subCodes: { category: "INVALID_REQUEST_ERROR", field: "amount_money.currency" },
    });
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(r.findings).toEqual([]);
  });

  it("maps API authentication failures to configuration, not cardholder authentication", () => {
    const r = analyzeFixture("authentication-error.json");
    expect(r.errors[0]).toMatchObject({
      code: "UNAUTHORIZED",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("treats a gateway timeout as an unknown outcome to verify before retrying", () => {
    const r = analyzeFixture("gateway-timeout.txt");
    expect(r.errors[0]).toMatchObject({
      code: "GATEWAY_TIMEOUT",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      subCodes: { category: "API_ERROR", httpStatus: "504" },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Verify/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/took effect/);
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "unknown" });
    expect(r.events[0]!.attributes).toMatchObject({ httpStatus: 504, apiVersion: "2026-09-16" });
  });

  it("uses Square's official retry guidance only for RATE_LIMITED and TEMPORARY_ERROR", () => {
    const safe = Object.entries(ERROR_CODES)
      .filter(([, e]) => e.retry === "safe_to_retry_technical_request")
      .map(([code]) => code);
    expect(safe.sort()).toEqual(["RATE_LIMITED", "TEMPORARY_ERROR"]);
    expect(ERROR_CODES.TEMPORARY_ERROR!.retryExplanation).toMatch(/same idempotency key/);
    for (const [, e] of Object.entries(ERROR_CODES)) {
      if (e.category === "network_or_timeout") expect(e.retry).toBe("retry_conditionally");
    }
  });

  it("falls back to the payload category for unknown codes", () => {
    const r = analyze(errors({ category: "PAYMENT_METHOD_ERROR", code: "BRAND_NEW_DECLINE" }));
    expect(r.errors[0]).toMatchObject({
      code: "BRAND_NEW_DECLINE",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "possible",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://developer.squareup.com/reference/square/enums/ErrorCategory",
    );
  });

  it("reports unrecognized codes and categories honestly", () => {
    const r = analyze(errors({ category: "NEW_THING_ERROR", code: "SOMETHING_NEW" }));
    expect(r.errors[0]).toMatchObject({
      code: "SOMETHING_NEW",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /not a documented Square ErrorCategory/,
    );
    // Prototype keys never resolve to catalog entries.
    expect(decodeSquareError({ code: "constructor", category: "toString" })).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
    expect(decodeSquareError({})).toMatchObject({ code: "unknown", confidence: "insufficient" });
  });

  it("decodes refund errors and links them through the refund's payment_id", () => {
    const r = analyze(
      JSON.stringify({
        errors: [{ category: "REFUND_ERROR", code: "REFUND_DECLINED" }],
        refund: refund({ status: "FAILED" }),
      }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "card_declined",
      retry: "manual_review",
      paymentReference: "PPLsynthPAY1",
      attemptReference: "PPLsynthPAY1_PPLsynthREF1",
    });
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["refund.snapshot", "failure"],
      ["api_error.REFUND_DECLINED", "failure"],
    ]);
    expect(r.groups).toHaveLength(1);
  });

  it("decodes card_details.errors carried by a failed payment webhook", () => {
    const r = analyze(
      JSON.stringify(
        webhook(
          "payment.updated",
          payment({
            status: "FAILED",
            card_details: {
              status: "FAILED",
              errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CVV_FAILURE" }],
            },
          }),
        ),
      ),
    );
    expect(r.errors[0]).toMatchObject({
      code: "CVV_FAILURE",
      paymentReference: "PPLsynthPAY1",
      source: { path: "data.object.payment.card_details.errors[0]" },
    });
    expect(r.events[0]!.attributes.cardErrorCodes).toEqual(["CVV_FAILURE"]);
  });

  it("keeps the catalog consistent", () => {
    expect(Object.keys(ERROR_CATEGORIES).sort()).toEqual([
      "API_ERROR",
      "AUTHENTICATION_ERROR",
      "EXTERNAL_VENDOR_ERROR",
      "INVALID_REQUEST_ERROR",
      "MERCHANT_SUBSCRIPTION_ERROR",
      "PAYMENT_METHOD_ERROR",
      "RATE_LIMIT_ERROR",
      "REFUND_ERROR",
    ]);
    for (const [code, e] of Object.entries(ERROR_CODES)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(e.docs).toMatch(/^https:\/\/developer\.squareup\.com\//);
      expect(e.confidence ?? "strong").not.toBe("confirmed");
    }
    const text = JSON.stringify({ ERROR_CODES, ERROR_CATEGORIES, squareManifest });
    for (const dash of [String.fromCharCode(0x2013), String.fromCharCode(0x2014)])
      expect(text).not.toContain(dash);
  });
});

describe("square normalization", () => {
  it("normalizes a completed payment without claiming settlement", () => {
    const r = analyzeFixture("successful-payment.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "payment.snapshot",
      stage: "capture",
      outcome: "success",
      providerStatus: "COMPLETED",
      paymentReference: "PPLsynthPAYOK0000000000001",
      merchantReference: "PPLsynth-ref-001",
      amountMinor: "2599",
      currency: "USD",
      eventTimestamp: "2026-10-20T10:00:01.200Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      cardDetailsStatus: "CAPTURED",
      capturedAt: "2026-10-20T10:00:01.200Z",
      riskLevel: "NORMAL",
      totalMoneyMinor: "2599",
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("builds one correlated timeline from payment and refund webhooks", () => {
    const r = analyzeFixture("webhook-lifecycle.json");
    expect(
      r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus, e.amountMinor]),
    ).toEqual([
      ["payment.created", "authorization", "pending", "APPROVED", "1500"],
      ["payment.updated", "capture", "success", "COMPLETED", "1500"],
      ["refund.created", "refund", "pending", "PENDING", "500"],
      ["refund.updated", "refund", "success", "COMPLETED", "500"],
    ]);
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      "PPLsynth-0000-4000-8000-000000000001",
      "PPLsynth-0000-4000-8000-000000000002",
      "PPLsynth-0000-4000-8000-000000000003",
      "PPLsynth-0000-4000-8000-000000000004",
    ]);
    expect(r.events[2]).toMatchObject({
      paymentReference: "PPLsynthPAYLIFE0000000001",
      relatedReference: "PPLsynthPAYLIFE0000000001_PPLsynthREFUND01",
    });
    expect(r.events[3]!.attributes.version).toBe(10);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual([
      "PPLsynthPAYLIFE0000000001",
      "PPLsynthPAYLIFE0000000001_PPLsynthREFUND01",
    ]);
    expect(r.findings).toEqual([]);
  });

  it.each([
    ["APPROVED", "authorization", "pending"],
    ["PENDING", "payment", "pending"],
    ["COMPLETED", "capture", "success"],
    ["CANCELED", "void", "failure"],
    ["FAILED", "payment", "failure"],
    ["SOMETHING_NEW", "payment", "unknown"],
  ])("maps payment status %s to %s / %s", (status, stage, outcome) => {
    const r = analyze(JSON.stringify(webhook("payment.updated", payment({ status }))));
    expect(r.events[0]).toMatchObject({ stage, outcome, providerStatus: status });
  });

  it.each([
    ["PENDING", "pending"],
    ["COMPLETED", "success"],
    ["REJECTED", "failure"],
    ["FAILED", "failure"],
    ["SOMETHING_NEW", "unknown"],
  ])("maps refund status %s to %s", (status, outcome) => {
    const r = analyze(JSON.stringify(webhook("refund.updated", refund({ status }))));
    expect(r.events[0]).toMatchObject({ stage: "refund", outcome, providerStatus: status });
  });

  it("keeps card_details.status as provider data without interpreting it", () => {
    const r = analyze(
      JSON.stringify({
        payment: payment({ status: "APPROVED", card_details: { status: "VOIDED" } }),
      }),
    );
    expect(r.events[0]).toMatchObject({ providerStatus: "APPROVED", outcome: "pending" });
    expect(r.events[0]!.attributes.cardDetailsStatus).toBe("VOIDED");
  });

  it("correlates on the payment's own id when data.id differs", () => {
    const evt = webhook("payment.created", payment({ status: "APPROVED" }));
    evt.data.id = "PPLsynthOTHERDATAID";
    const r = analyze(JSON.stringify(evt));
    expect(r.events[0]!.paymentReference).toBe("PPLsynthPAY1");
    expect(r.events[0]!.attributes.dataIdMatchesObjectId).toBe(false);

    const noId = webhook("payment.updated", payment({ id: undefined }));
    noId.data.id = "PPLsynthDATAIDONLY";
    expect(analyze(JSON.stringify(noId)).events[0]!.paymentReference).toBe("PPLsynthDATAIDONLY");
  });

  it("uses the envelope time only when the object has no updated_at", () => {
    const r = analyze(
      JSON.stringify(webhook("payment.updated", payment({ updated_at: undefined }))),
    );
    expect(r.events[0]!.eventTimestamp).toBe("2026-10-24T10:00:00.000Z");
  });

  it("marks unknown event types without guessing their outcome", () => {
    const r = analyze(JSON.stringify(webhook("payment.mystery", payment())));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("recognizes repeated deliveries by event_id", () => {
    const r = analyzeFixture("duplicate-webhook.json");
    expect(r.events).toHaveLength(2);
    expect(new Set(r.events.map((e) => e.deliveryKey)).size).toBe(1);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
    expect(r.findings[0]!.explanation).toMatch(/event_id/);
  });

  it("orders events by object time and reports out-of-order arrival", () => {
    const r = analyzeFixture("out-of-order.json");
    expect(r.events.map((e) => e.eventType)).toEqual(["payment.created", "payment.updated"]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toEqual(["OUT_OF_ORDER_ARRIVAL"]);
  });

  it("keeps payments apart that only share order_id and reference_id", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.outcome)).toEqual(["failure", "success"]);
  });

  it("recognizes but does not analyze other webhook families", () => {
    const r = analyzeFixture("other-webhook-family.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "square.webhook.other" });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/recognized but not supported/);
    expect(r.events).toEqual([]);
  });

  it("reads delivery context from a pasted HTTP webhook", () => {
    const r = analyzeFixture("webhook-http.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "refund.updated",
      stage: "refund",
      outcome: "failure",
      paymentReference: "PPLsynthPAYHTTP0000000001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      environment: "Sandbox",
      retryNumber: 2,
      retryReason: "http_timeout",
      initialDeliveryAt: "2026-10-24T16:00:00.500Z",
    });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });
});

describe("square sensitive data", () => {
  const planted = [
    "sq-1-PPLsynth",
    "pplsynth.buyer@example.com",
    "PPLsynth Billing Street",
    "PPLsynth Shipping Avenue",
    "PPLsynth private note",
    "PPLsynth Cardholder Person",
    "PPLsynthCUSTOMER000000001",
    "PPLsynthRECEIPT0001",
    "PPLsynthLOC0001",
    "PPLsynthMERCHANT1",
    "400017",
    "4821",
    "PPLs7Q",
    "PPLsynthSIGNATURE",
    "sq0ids-",
    "PPLsynthVERSIONTOKEN",
  ];

  it.each([
    "successful-payment.json",
    "declined-with-failed-payment.json",
    "webhook-lifecycle.json",
    "webhook-http.txt",
  ])("keeps planted sensitive values out of events and reports (%s)", (file) => {
    const r = analyzeFixture(file);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
  });

  it("flags sensitive fields in the raw input", () => {
    const r = analyzeFixture("successful-payment.json");
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.sensitiveData.fieldPaths).toEqual(
      expect.arrayContaining([
        "[0].payment.card_details.card.fingerprint",
        "[0].payment.card_details.card.bin",
        "[0].payment.billing_address",
        "[0].payment.shipping_address",
      ]),
    );
  });
});

describe("square manifest", () => {
  it("is honest about capabilities", () => {
    expect(squareManifest).toMatchObject({
      id: "square",
      version: "0.1.0",
      wave: 1,
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
      capabilities: {
        errorDecoding: "supported",
        paymentResponses: "supported",
        webhookParsing: "supported",
        timeline: "limited",
        correlation: "limited",
      },
      delivery: {
        duplicateKey: "event_id",
        duplicatesDocumented: true,
        ordering: "not_guaranteed",
      },
    });
    expect(squareAdapter.manifest).toBe(squareManifest);
  });
});
