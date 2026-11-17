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
  ERROR_CODES,
  HPP_STATUSES,
  ORDER_STATUSES,
  errorEntry,
  klarnaAdapter,
  klarnaManifest,
} from "@pandapaylens/klarna";

const options: AnalyzeOptions = {
  adapters: [klarnaAdapter],
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
const analyzeFixture = (path: string) => analyze(fixture(`klarna/${path}`));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const klarnaError = (code: string, extra: Record<string, unknown> = {}) => ({
  error_code: code,
  error_messages: ["PPLsynth message"],
  correlation_id: "PPLsynth-corr-test",
  ...extra,
});
const httpError = (status: string, body: Record<string, unknown>) =>
  `HTTP/1.1 ${status}\nContent-Type: application/json\n\n${JSON.stringify(body)}`;

describe("klarna detection", () => {
  it.each([
    [klarnaError("CAPTURE_NOT_ALLOWED"), "klarna.error_response", 0.9],
    [
      { error_code: "REJECTED", error_message: "Rejected", correlation_id: "PPLsynth-c" },
      "klarna.error_response",
      0.75,
    ],
    [{ error_code: "REJECTED", error_messages: ["Rejected"] }, "klarna.error_response", 0.6],
    [
      { order_id: "PPLsynth-o", status: "CAPTURED", fraud_status: "ACCEPTED" },
      "klarna.order",
      0.95,
    ],
    [{ order_id: "PPLsynth-o", fraud_status: "ACCEPTED", order_amount: 1 }, "klarna.order", 0.9],
    [
      {
        order_id: "PPLsynth-o",
        status: "AUTHORIZED",
        order_amount: 1,
        captured_amount: 0,
        purchase_currency: "EUR",
      },
      "klarna.order",
      0.8,
    ],
    [
      { order_id: "PPLsynth-o", fraud_status: "ACCEPTED", authorized_payment_method: "invoice" },
      "klarna.payments_order",
      0.9,
    ],
    [
      {
        order_id: "PPLsynth-o",
        fraud_status: "PENDING",
        authorized_payment_method: { type: "card" },
      },
      "klarna.payments_order",
      0.9,
    ],
    [{ order_id: "PPLsynth-o", fraud_status: "ACCEPTED" }, "klarna.payments_order", 0.7],
    [{ capture_id: "PPLsynth-c", captured_amount: 1, captured_at: "x" }, "klarna.capture", 0.9],
    [{ capture_id: "PPLsynth-c", captured_amount: 1 }, "klarna.capture", 0.8],
    [{ refund_id: "PPLsynth-r", refunded_amount: 1, refunded_at: "x" }, "klarna.refund", 0.9],
    [
      { event_id: "PPLsynth-e", session: { session_id: "s", status: "COMPLETED" } },
      "klarna.hpp_status_callback",
      0.95,
    ],
    [{ event_id: "PPLsynth-e", session: { status: "WAITING" } }, "klarna.hpp_status_callback", 0.8],
    [
      {
        event_id: "PPLsynth-e",
        session: { session_id: "s", status: "NEW_STATE", updated_at: "x", expires_at: "y" },
      },
      "klarna.hpp_status_callback",
      0.6,
    ],
    [
      { authorization_token: "PPLsynth-t", session_id: "PPLsynth-s" },
      "klarna.authorization_callback",
      0.6,
    ],
  ])("detects %j", (input, format, confidence) => {
    expect(klarnaAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("does not match on the provider name or generic shapes", () => {
    for (const input of [
      { provider: "klarna" },
      { error: "Klarna error" },
      { error_code: "SOME_CODE" },
      { error_code: "lowercase", error_messages: ["x"], correlation_id: "c" },
      { status: "CAPTURED" },
      { order_id: "x", status: "paid" },
      { order_id: "x", fraud_status: "MAYBE" },
      { order_id: "x", fraud_status: "REJECTED" },
      { capture_id: "x", captured_amount: "12.00" },
      { refund_id: "x", refunded_amount: 1.5 },
      { event_id: "x", session: { status: "OPEN" } },
      { authorization_token: "x", session_id: "y", other: 1 },
      { session_id: "y" },
      [],
      null,
      "text",
    ])
      expect(klarnaAdapter.detect(input).confidence, JSON.stringify(input)).toBe(0);
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
          expect(klarnaAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          expect(klarnaAdapter.detect(payload, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("is not reported as ambiguous next to the Stripe and Adyen adapters", () => {
    const r = analyze(fixture("klarna/order-lifecycle.json"), {
      adapters: [stripeAdapter, adyenAdapter, klarnaAdapter],
    });
    expect(r.records.every((s) => s.provider === "klarna" && s.alternatives.length === 0)).toBe(
      true,
    );
    expect(r.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
  });

  it("recognizes every Klarna fixture", () => {
    const dir = fileURLToPath(new URL("klarna/", fixturesRoot));
    for (const file of readdirSync(dir)) {
      const r = analyzeFixture(file);
      for (const rec of r.records) expect(rec, file).toMatchObject({ provider: "klarna" });
    }
  });
});

describe("klarna parsing", () => {
  it("reports missing required fields as parse issues instead of throwing", () => {
    const noMessages = klarnaAdapter.parse(
      { error_code: "REJECTED", correlation_id: "c" },
      "klarna.error_response",
    );
    expect(noMessages.ok).toBe(false);
    expect(!noMessages.ok && noMessages.issues[0]).toMatch(/error_messages/);

    const r = analyzeRecords(
      [
        { order_id: 42, status: "CAPTURED", fraud_status: "ACCEPTED" },
        { error_code: "REJECTED", error_messages: [1], correlation_id: "PPLsynth-c" },
        { event_id: "PPLsynth-e", session: { session_id: 5, status: "COMPLETED" } },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.records.map((s) => s.status)).toEqual([
      "unsupported",
      "unsupported",
      "analyzed",
    ]);

    const badOrder = analyzeRecords(
      [{ order_id: "PPLsynth-o", status: "CAPTURED", fraud_status: "ACCEPTED", order_amount: "x" }],
      options,
    );
    expect(badOrder.ok && badOrder.result.records[0]).toMatchObject({
      status: "invalid",
      format: "klarna.order",
    });
    expect(badOrder.ok && badOrder.result.records[0]!.reasons.join(" ")).toMatch(/order_amount/);
  });

  it("tolerates unknown fields and rejects unknown formats", () => {
    expect(
      klarnaAdapter.parse({ ...klarnaError("REJECTED"), brand_new: [1] }, "klarna.error_response")
        .ok,
    ).toBe(true);
    expect(klarnaAdapter.parse({}, "klarna.nope").ok).toBe(false);
  });

  it("handles malformed payloads without throwing", () => {
    expect(analyzeText("{not json", options).ok).toBe(false);
    const r = analyzeRecords(
      [
        { error_code: 5 },
        { order_id: "PPLsynth-o", fraud_status: "ACCEPTED", captures: "nope", order_amount: 1 },
        { capture_id: "PPLsynth-c", captured_amount: 1, captured_at: 7 },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.records.map((s) => s.status)).toEqual(["unsupported", "invalid", "invalid"]);
    expect(r.result.events).toEqual([]);
  });
});

describe("klarna error decoding", () => {
  it("decodes an Order Management capture refusal", () => {
    const r = analyzeFixture("error-capture-not-allowed.json");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      provider: "klarna",
      code: "CAPTURE_NOT_ALLOWED",
      category: "invalid_request",
      retry: "manual_review",
      confidence: "strong",
      providerMessage: "Capture not allowed",
      outcomeKnown: true,
      subCodes: { correlationId: "PPLsynth-corr-0000-0000-000000000001" },
    });
    expect(r.errors[0]!.documentation[0]!.url).toMatch(/order-management/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/order id/);
    expect(r.events[0]).toMatchObject({
      eventType: "api_error.CAPTURE_NOT_ALLOWED",
      stage: "error",
      outcome: "failure",
    });
  });

  it("decodes a rejected authorization without inventing a reason", () => {
    const r = analyzeFixture("error-rejected-http.txt");
    expect(r.errors[0]).toMatchObject({
      code: "REJECTED",
      category: "payment_method_unavailable",
      retry: "customer_action_required",
      subCodes: { httpStatus: "403" },
    });
    expect(r.errors[0]!.explanation).toMatch(/does not give a reason/);
    expect(r.events[0]!.attributes).toMatchObject({ httpStatus: 403 });
  });

  it("decodes a validation error (409 BAD_VALUE) by its HTTP status", () => {
    const r = analyzeFixture("error-not-matching-fields-http.txt");
    expect(r.errors[0]).toMatchObject({
      code: "BAD_VALUE",
      category: "invalid_request",
      retry: "do_not_retry",
      providerMessage: "Not matching fields: [billing_address.postal_code]",
    });
    expect(r.errors[0]!.explanation).toMatch(/earlier step/);
    const no = analyze(JSON.stringify(klarnaError("BAD_VALUE")));
    expect(no.errors[0]!.confidence).toBe("possible");
    expect(no.errors[0]!.missingInformation.join(" ")).toMatch(/the status was not supplied/);
  });

  it("maps an authentication failure to configuration", () => {
    const r = analyzeFixture("error-unauthorized-http.txt");
    expect(r.errors[0]).toMatchObject({
      code: "UNAUTHORIZED",
      category: "configuration",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.providerMessage).toBeUndefined();
  });

  it("treats a server error as an unknown outcome to verify before retrying", () => {
    const r = analyzeFixture("error-internal-server-http.txt");
    expect(r.errors[0]).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/Klarna-Idempotency-Key/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/took effect/);
    expect(r.events[0]!.outcome).toBe("unknown");
    for (const code of ["TEMPORARILY_UNAVAILABLE", "SERVICE_UNAVAILABLE", "UNEXPECTED_ERROR"])
      expect(errorEntry(code)?.retry).toBe("retry_conditionally");
  });

  it("uses the HTTP status to choose between documented meanings of NOT_FOUND", () => {
    const r400 = analyze(httpError("400 Bad Request", klarnaError("NOT_FOUND")));
    const r404 = analyze(httpError("404 Not Found", klarnaError("NOT_FOUND")));
    expect(r400.errors[0]!.explanation).toMatch(/HTTP 400/);
    expect(r404.errors[0]!.explanation).toMatch(/Klarna Payments/);
    expect(r404.errors[0]!.confidence).toBe("possible");
    const odd = analyze(httpError("500 Internal Server Error", klarnaError("REFUND_NOT_ALLOWED")));
    expect(odd.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP 403, not 500/);
  });

  it("reports unrecognized codes honestly", () => {
    const r = analyzeFixture("error-undocumented-code.json");
    expect(r.errors[0]).toMatchObject({
      code: "PPLSYNTH_UNDOCUMENTED_CODE",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
    expect(r.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(errorEntry("constructor")).toBeUndefined();
  });

  it("keeps the catalog consistent", () => {
    for (const [code, entry] of Object.entries(ERROR_CODES)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(entry.docs).toMatch(/^https:\/\/docs\.klarna\.com\/acquirer\/klarna\//);
      // A server error is never presented as safe to retry.
      if (entry.category === "provider_unavailable")
        expect(entry.retry).toBe("retry_conditionally");
      expect(entry.retry).not.toBe("safe_to_retry_technical_request");
    }
  });
});

describe("klarna normalization", () => {
  it("normalizes a Klarna Payments order by its fraud status", () => {
    const accepted = analyzeFixture("payments-order-accepted.json");
    expect(accepted.events[0]).toMatchObject({
      eventType: "payments.order_created",
      stage: "authorization",
      outcome: "success",
      providerStatus: "ACCEPTED",
      paymentReference: "PPLsynth-order-0000-0000-000000000001",
      attributes: { authorizedPaymentMethod: "invoice", numberOfDays: 30, hasRedirectUrl: true },
    });
    const pending = analyzeFixture("payments-order-pending.json");
    expect(pending.events[0]).toMatchObject({
      outcome: "pending",
      attributes: { authorizedPaymentMethod: "fixed_amount" },
    });
    expect(analyzeFixture("payments-order-customer-token.json").events[0]!.outcome).toBe("success");
  });

  it("builds one timeline for an order, its captures and refunds", () => {
    const r = analyzeFixture("order-lifecycle.json");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.eventIds).toHaveLength(r.events.length);
    const byType = Object.fromEntries(r.events.map((e) => [e.eventType, e]));
    expect(byType["order.snapshot"]).toMatchObject({
      stage: "capture",
      providerStatus: "PART_CAPTURED",
      amountMinor: "20000",
      currency: "EUR",
      outcome: "success",
      attributes: {
        capturedAmountMinor: "12000",
        refundedAmountMinor: "2000",
        remainingAuthorizedAmountMinor: "8000",
        initialPaymentMethod: "PAY_BY_CARD",
      },
    });
    expect(byType["order.capture"]).toMatchObject({
      stage: "capture",
      relatedReference: "PPLsynth-capture-0000-0000-000000000001",
      amountMinor: "12000",
      currency: "EUR",
      eventTimestamp: "2026-11-11T10:00:00.000Z",
    });
    expect(byType["order.refund"]).toMatchObject({
      stage: "refund",
      amountMinor: "2000",
      eventTimestamp: "2026-11-12T08:30:00.000Z",
    });
    // The bare capture links to the order only through its capture_id.
    expect(byType["capture.snapshot"]).toMatchObject({
      relatedReference: "PPLsynth-capture-0000-0000-000000000001",
    });
    expect(byType["capture.snapshot"]!.paymentReference).toBeUndefined();
    expect(byType["capture.snapshot"]!.currency).toBeUndefined();
  });

  it.each(Object.entries(ORDER_STATUSES))("maps order status %s", (status, info) => {
    const r = analyze(
      JSON.stringify({
        order_id: "PPLsynth-o",
        status,
        fraud_status: "ACCEPTED",
        order_amount: 100,
        purchase_currency: "EUR",
      }),
    );
    expect(r.events[0]).toMatchObject({ stage: info.stage, outcome: info.outcome });
  });

  it("does not treat a fraud-pending authorization as approved", () => {
    const r = analyzeFixture("order-authorized-fraud-pending.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      stage: "authorization",
      outcome: "pending",
      attributes: { fraudStatus: "PENDING", captureCount: 0 },
    });
    const rejected = analyze(
      JSON.stringify({ order_id: "PPLsynth-o", status: "AUTHORIZED", fraud_status: "REJECTED" }),
    );
    expect(rejected.events[0]!.outcome).toBe("unknown");
  });

  it("shows a cancelled order as a cancellation, not a payment", () => {
    const r = analyzeFixture("order-cancelled.json");
    expect(r.events[0]).toMatchObject({ stage: "cancellation", providerStatus: "CANCELLED" });
  });

  it("keeps unknown order statuses unknown", () => {
    const r = analyze(
      JSON.stringify({ order_id: "PPLsynth-o", status: "NEW_STATE", fraud_status: "ACCEPTED" }),
    );
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "klarna.order" });
    expect(r.events[0]).toMatchObject({ stage: "other", outcome: "unknown" });
  });

  it("normalizes bare Capture and Refund objects", () => {
    expect(analyzeFixture("capture-details.json").events[0]).toMatchObject({
      eventType: "capture.snapshot",
      stage: "capture",
      amountMinor: "4999",
      eventTimestamp: "2026-11-16T09:15:00.000Z",
    });
    expect(analyzeFixture("refund-details.json").events[0]).toMatchObject({
      eventType: "refund.snapshot",
      stage: "refund",
      relatedReference: "PPLsynth-refund-0000-0000-000000000002",
      amountMinor: "1000",
    });
  });

  it("normalizes HPP status callbacks and recognizes repeated deliveries by event_id", () => {
    const r = analyzeFixture("hpp-status-callbacks.json");
    expect(r.events.map((e) => [e.providerStatus, e.stage, e.outcome])).toEqual([
      ["IN_PROGRESS", "payment", "pending"],
      ["COMPLETED", "authorization", "success"],
      ["COMPLETED", "authorization", "success"],
    ]);
    expect(r.events[1]).toMatchObject({
      deliveryKey: "PPLsynth-event-0000-0000-000000000002",
      paymentReference: "PPLsynth-order-0000-0000-000000000006",
      attributes: { orderPlaced: true },
    });
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it.each(Object.entries(HPP_STATUSES))("maps HPP status %s", (status, info) => {
    const r = analyze(JSON.stringify({ event_id: "PPLsynth-e", session: { status } }));
    expect(r.events[0]).toMatchObject({ stage: info.stage, outcome: info.outcome });
  });

  it("reads a pasted HTTP callback without verifying or copying the URL secret", () => {
    const r = analyzeFixture("hpp-callback-failed-http.txt");
    expect(r.events[0]).toMatchObject({ providerStatus: "FAILED", outcome: "failure" });
    expect(JSON.stringify(r.events)).not.toContain("PPLsynth-secret-0001");
  });

  it("records an authorization callback without its token or session id", () => {
    const r = analyzeFixture("authorization-callback.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payments.authorization_callback",
      stage: "authorization",
      outcome: "success",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
  });

  it("keeps unrelated orders apart", () => {
    const r = analyzeFixture("unrelated-orders.json");
    expect(r.groups).toHaveLength(2);
  });

  it("never links on correlation_id or merchant references", () => {
    const r = analyzeRecords(
      [
        klarnaError("CAPTURE_NOT_ALLOWED"),
        klarnaError("CAPTURE_NOT_ALLOWED", { error_messages: ["other"] }),
        {
          order_id: "PPLsynth-o1",
          status: "AUTHORIZED",
          fraud_status: "ACCEPTED",
          merchant_reference1: "PPLsynth-same",
        },
        {
          order_id: "PPLsynth-o2",
          status: "AUTHORIZED",
          fraud_status: "ACCEPTED",
          merchant_reference1: "PPLsynth-same",
        },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const g of r.result.groups) expect(g.references.join(" ")).not.toMatch(/corr|same/);
    expect(r.result.groups.filter((g) => g.eventIds.length > 1)).toHaveLength(0);
  });
});

describe("klarna sensitive data", () => {
  const planted = [
    "pplsynth.customer@example.com",
    "PPLsynth Billing Street",
    "PPLsynth Shipping Road",
    "PPLsynth Given",
    "PPLsynth Family",
    "PPLsynthNIN0001",
    "1970-01-01",
    "+440000000000",
    "PPLsynth merchant data note",
    "PPLsynth-merchant-ref-1",
    "PPLsynth product name",
    "PPLsynth capture description",
    "PPLsynth-authorization-token-0001",
    "PPLsynth-kp-session-0001",
    "PPLsynth-hpp-session-0001",
    "PPLsynth-redirect-0001",
    "PPLsynth-secret-0001",
  ];

  it.each([
    "order-sensitive.json",
    "authorization-callback.json",
    "hpp-status-callbacks.json",
    "hpp-callback-failed-http.txt",
    "payments-order-accepted.json",
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
    const r = analyzeFixture("order-sensitive.json");
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.sensitiveData.fieldPaths).toEqual(
      expect.arrayContaining(["[0].billing_address", "[0].shipping_address"]),
    );
  });
});

describe("klarna manifest", () => {
  it("is honest about capabilities", () => {
    expect(klarnaManifest).toMatchObject({
      id: "klarna",
      version: "0.1.0",
      wave: 5,
      researchStatus: "tested",
      status: "limited",
      verifiedAt: "2026-11-17",
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "limited",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect(klarnaManifest.limitations.join(" ")).toMatch(/Pending order notifications/);
    expect(klarnaManifest.limitations.join(" ")).not.toMatch(/verif(y|ies) (the )?signature/);
    expect(klarnaAdapter.manifest).toBe(klarnaManifest);
    for (const f of klarnaAdapter.supportedFormats)
      expect(klarnaManifest.apiFamilies.map((a) => a.id)).toContain(f.id);
  });
});
