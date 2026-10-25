import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeText, toJsonReport, type AnalysisResult } from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  FAILURE_REASONS,
  HTTP_STATUS,
  mollieAdapter,
  mollieManifest,
  MOLLIE_ADAPTER_VERSION,
} from "@pandapaylens/mollie";

const FIXTURES = new URL("../../../../fixtures/", import.meta.url);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, FIXTURES)), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, {
    adapters: [mollieAdapter],
    rules: defaultRules,
    catalogVersion: "test",
    now: () => new Date("2026-10-25T12:00:00.000Z"),
  });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`mollie/${path}`));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const payment = (fields: Record<string, unknown> = {}) => ({
  resource: "payment",
  id: "tr_PPLsynthTest001",
  status: "paid",
  amount: { currency: "EUR", value: "10.00" },
  ...fields,
});
const event = (
  type: string,
  entity: Record<string, unknown>,
  fields: Record<string, unknown> = {},
) => ({
  resource: "event",
  id: "event_PPLsynthTest01",
  type,
  entityId: entity.id,
  createdAt: "2026-10-21T08:00:01.0Z",
  _embedded: { entity },
  ...fields,
});
const apiError = (status: number, fields: Record<string, unknown> = {}) => ({
  status,
  title: "Some Title",
  detail: "Some detail",
  _links: { documentation: { href: "https://docs.mollie.com/errors", type: "text/html" } },
  ...fields,
});

describe("mollie detection", () => {
  it.each([
    [payment(), "mollie.payment", 0.97, true],
    [payment({ id: "PPLsynth1" }), "mollie.payment", 0.65, true],
    [
      { resource: "refund", id: "re_PPLsynth1", paymentId: "tr_PPLsynth1", status: "pending" },
      "mollie.refund",
      0.97,
      true,
    ],
    [
      { resource: "chargeback", id: "chb_PPLsynth1", reversedAt: null },
      "mollie.chargeback",
      0.97,
      true,
    ],
    [{ resource: "capture", id: "cpt_PPLsynth1", status: "pending" }, "mollie.capture", 0.97, true],
    [event("payment.paid", payment()), "mollie.event", 0.97, true],
    [
      { resource: "event", id: "event_PPLsynth1", type: "payment.paid" },
      "mollie.event.simple",
      0.9,
      false,
    ],
    [apiError(422), "mollie.error", 0.9, true],
    [{ status: 422, title: "x", detail: "y" }, "mollie.error", 0.4, true],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(mollieAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("recognizes classic webhooks only as form-encoded single-id bodies", () => {
    expect(mollieAdapter.detect({ id: "tr_PPLsynth1" }, { format: "form" })).toMatchObject({
      format: "mollie.webhook.classic",
      confidence: 0.8,
      supported: false,
    });
    expect(mollieAdapter.detect({ id: "ord_PPLsynth1" }, { format: "form" })).toMatchObject({
      format: "mollie.webhook.classic",
      confidence: 0.6,
    });
    expect(
      mollieAdapter.detect(
        { id: "tr_PPLsynth1" },
        { format: "http", http: { kind: "request", headers: {}, contentType: "application/json" } },
      ).confidence,
    ).toBe(0);
    expect(mollieAdapter.detect({ id: "tr_PPLsynth1" }, { format: "json" }).confidence).toBe(0);
    expect(
      mollieAdapter.detect({ id: "tr_PPLsynth1", amount: "1" }, { format: "form" }).confidence,
    ).toBe(0);
    expect(mollieAdapter.detect({ id: "xx_PPLsynth1" }, { format: "form" }).confidence).toBe(0);
  });

  it("does not claim generic shapes or match on the provider name", () => {
    expect(mollieAdapter.detect({ provider: "mollie", message: "Mollie error" }).confidence).toBe(
      0,
    );
    expect(mollieAdapter.detect({ error: { message: "x" } }).confidence).toBe(0);
    expect(mollieAdapter.detect({ status: 422 }).confidence).toBe(0);
    expect(mollieAdapter.detect({ status: "paid", id: "tr_PPLsynth1" }).confidence).toBe(0);
    expect(mollieAdapter.detect({ status: 200, title: "OK", detail: "fine" }).confidence).toBe(0);
    expect(mollieAdapter.detect(null).confidence).toBe(0);
    expect(mollieAdapter.detect("mollie").confidence).toBe(0);
    expect(mollieAdapter.detect([payment()]).confidence).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let records = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(new URL(`${dir}/`, FIXTURES))) {
        const r = analyze(fixture(`${dir}/${file}`));
        for (const rec of r.records) {
          records++;
          expect(rec.confidence, `${dir}/${file} record ${rec.recordIndex}`).toBe(0);
          expect(rec.provider).toBeNull();
        }
      }
    }
    expect(records).toBeGreaterThan(10);
  });
});

describe("mollie parsing", () => {
  it("reports missing required fields as issues without throwing", () => {
    const noStatus = analyze(JSON.stringify({ resource: "payment", id: "tr_PPLsynth1" }));
    expect(noStatus.records[0]).toMatchObject({ status: "invalid", format: "mollie.payment" });
    expect(noStatus.records[0]!.reasons.join(" ")).toMatch(/^status:/);
    expect(noStatus.warnings.map((w) => w.code)).toContain("INVALID_RECORD");

    const noDetail = analyze(
      JSON.stringify({
        status: 422,
        title: "Unprocessable Entity",
        _links: { documentation: { href: "x" } },
      }),
    );
    expect(noDetail.records[0]).toMatchObject({ status: "invalid", format: "mollie.error" });
    expect(noDetail.records[0]!.reasons.join(" ")).toMatch(/detail/);

    const badAmount = mollieAdapter.parse(
      payment({ amount: { currency: "EUR", value: 10 } }),
      "mollie.payment",
    );
    expect(badAmount.ok).toBe(false);
  });

  it("rejects unknown formats and tolerates unknown fields", () => {
    expect(mollieAdapter.parse({}, "mollie.nope").ok).toBe(false);
    expect(mollieAdapter.parse(payment({ brandNewField: [1, 2] }), "mollie.payment").ok).toBe(true);
  });

  it("handles malformed input without throwing", () => {
    const r = analyzeText("{ not json", {
      adapters: [mollieAdapter],
      rules: defaultRules,
      catalogVersion: "test",
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    const weird = analyze(JSON.stringify([payment({ createdAt: 12, details: "x" })]));
    expect(weird.records[0]!.status).toBe("invalid");
  });
});

describe("mollie payment snapshots", () => {
  it("analyzes a successful payment with lifecycle points from present timestamps only", () => {
    const r = analyzeFixture("paid-payment.json");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "mollie.payment" });
    expect(
      r.events.map((e) => [
        e.eventType,
        e.stage,
        e.outcome,
        e.eventTimestamp ?? null,
        e.providerStatus ?? null,
      ]),
    ).toEqual([
      ["payment.milestone.created", "payment", "pending", "2026-10-20T09:13:37.000Z", null],
      ["payment.snapshot", "payment", "success", "2026-10-20T09:15:02.000Z", "paid"],
    ]);
    const snap = r.events[1]!;
    expect(snap).toMatchObject({
      paymentReference: "tr_PPLsynthPaid0001",
      amountMinor: "1000",
      currency: "EUR",
    });
    expect(snap.attributes).toMatchObject({
      derivedFrom: "snapshot",
      timestampField: "paidAt",
      method: "creditcard",
      cardLabel: "Mastercard",
      amountRefundedMinor: "0",
      statusKnown: true,
      final: true,
    });
    expect(r.events[0]!.attributes).toMatchObject({
      derivedFrom: "snapshot",
      timestampField: "createdAt",
    });
    expect(r.errors).toEqual([]);
    expect(r.groups).toHaveLength(1);
    expect(r.findings).toEqual([]);
  });

  it.each([
    ["open", "payment", "pending"],
    ["pending", "payment", "pending"],
    ["authorized", "authorization", "success"],
    ["paid", "payment", "success"],
    ["canceled", "cancellation", "failure"],
    ["expired", "cancellation", "failure"],
    ["failed", "payment", "failure"],
    ["brand_new", "payment", "unknown"],
  ])("maps status %s to %s/%s", (status, stage, outcome) => {
    const r = analyze(JSON.stringify(payment({ status })));
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "payment.snapshot",
      stage,
      outcome,
      providerStatus: status,
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.statusKnown).toBe(status !== "brand_new");
  });

  it("treats expiresAt as a deadline, never as an expiry event", () => {
    const r = analyze(
      JSON.stringify(
        payment({
          status: "open",
          createdAt: "2026-10-24T11:00:00+00:00",
          expiresAt: "2026-10-24T11:15:00+00:00",
        }),
      ),
    );
    expect(r.events.map((e) => e.eventType)).toEqual([
      "payment.milestone.created",
      "payment.snapshot",
    ]);
    expect(r.events[1]!.attributes.expiresAt).toBe("2026-10-24T11:15:00.000Z");
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it("converts decimal string amounts without floats", () => {
    const amt = (value: string, currency = "EUR") =>
      analyze(JSON.stringify(payment({ amount: { currency, value } }))).events[0]!;
    expect(amt("24.95").amountMinor).toBe("2495");
    expect(amt("0.10").amountMinor).toBe("10");
    expect(amt("1000", "JPY").amountMinor).toBe("1000");
    expect(amt("1000.00", "JPY").amountMinor).toBe("1000");
    const tooPrecise = amt("10.001");
    expect(tooPrecise.amountMinor).toBeUndefined();
    expect(tooPrecise.attributes.amountNotConvertible).toBe(true);
  });

  it("reads embedded refunds defensively and links them to the payment", () => {
    const r = analyzeFixture("payment-with-embedded-refunds.json");
    expect(
      r.events.map((e) => [
        e.eventType,
        e.paymentReference,
        e.relatedReference ?? null,
        e.amountMinor ?? null,
      ]),
    ).toEqual([
      ["payment.milestone.created", "tr_PPLsynthEmbed001", null, null],
      ["payment.snapshot", "tr_PPLsynthEmbed001", null, "1000"],
      ["refund.milestone.created", "tr_PPLsynthEmbed001", "re_PPLsynthEmbed001", null],
      ["refund.snapshot", "tr_PPLsynthEmbed001", "re_PPLsynthEmbed001", "300"],
    ]);
    expect(r.events[3]!.source.path).toBe("_embedded.refunds[0]");
    expect(r.groups).toHaveLength(1);
  });
});

describe("mollie error decoding", () => {
  it("decodes a card decline from details.failureReason", () => {
    const r = analyzeFixture("failed-payment-insufficient-funds.json");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      provider: "mollie",
      code: "insufficient_funds",
      subCodes: { status: "failed", method: "creditcard" },
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "possible",
      paymentReference: "tr_PPLsynthNSF00001",
      attemptReference: "tr_PPLsynthNSF00001",
      providerMessage: "The payment was declined due to insufficient funds.",
    });
    expect(r.errors[0]!.explanation).toMatch(/derived from the code name/);
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payment.milestone.created", "pending"],
      ["payment.snapshot", "failure"],
    ]);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
    expect(r.findings[0]!.evidenceErrorIds).toEqual([r.errors[0]!.id]);
  });

  it("does not assume a failureReason on failed payments", () => {
    const r = analyzeFixture("failed-payment-no-reason.json");
    expect(r.errors[0]).toMatchObject({
      code: "failed",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/No details\.failureReason/);
  });

  it("covers every documented failureReason and keeps unknown values honest", () => {
    expect(Object.keys(FAILURE_REASONS)).toHaveLength(15);
    for (const [code, entry] of Object.entries(FAILURE_REASONS)) {
      const r = analyze(
        JSON.stringify(payment({ status: "failed", details: { failureReason: code } })),
      );
      expect(r.errors[0]).toMatchObject({ code, category: entry.category, retry: entry.retry });
    }
    const unknown = analyze(
      JSON.stringify(payment({ status: "failed", details: { failureReason: "brand_new_reason" } })),
    ).errors[0]!;
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
  });

  it("notes that an open payment with a failureReason can still be completed", () => {
    const r = analyze(
      JSON.stringify(payment({ status: "open", details: { failureReason: "card_declined" } })),
    );
    expect(r.errors[0]!.code).toBe("card_declined");
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/still "open"/);
    expect(r.events[0]!.outcome).toBe("pending");
  });

  it("decodes a validation error by HTTP status and field", () => {
    const r = analyzeFixture("api-error-validation.json");
    expect(r.errors[0]).toMatchObject({
      code: "422",
      subCodes: { status: "422", field: "amount" },
      category: "invalid_amount",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "The amount is higher than the maximum",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no machine-readable error code/);
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "unknown",
      providerStatus: "HTTP 422",
    });
    expect(r.suggestedView).toBe("decoder");
    expect(r.findings).toEqual([]);

    const noField = analyze(JSON.stringify(apiError(422))).errors[0]!;
    expect(noField).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(noField.missingInformation.join(" ")).toMatch(/suspended/);
  });

  it("decodes an authentication failure", () => {
    expect(analyzeFixture("api-error-unauthorized.json").errors[0]).toMatchObject({
      code: "401",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("never presents a timeout retry as safe", () => {
    const r = analyzeFixture("api-error-timeout.txt");
    expect(r.errors[0]).toMatchObject({
      code: "504",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/unknown.*Verify/);
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(HTTP_STATUS[500]!.retry).toBe("retry_conditionally");
  });

  it("uses the Retry-After header of a 429 response when present", () => {
    const r = analyzeFixture("api-error-rate-limit.txt");
    expect(r.errors[0]).toMatchObject({
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Retry-After: 30 seconds/);
    expect(r.events[0]!.attributes.retryAfterSeconds).toBe(30);
    const bodyOnly = analyze(JSON.stringify(apiError(429))).errors[0]!;
    expect(bodyOnly.missingInformation.join(" ")).toMatch(/Retry-After header/);
  });

  it("covers the documented statuses and reports undocumented ones honestly", () => {
    expect(Object.keys(HTTP_STATUS).map(Number)).toEqual([
      400, 401, 403, 404, 405, 409, 410, 415, 422, 429, 500, 502, 503, 504,
    ]);
    const r = analyze(JSON.stringify(apiError(418)));
    expect(r.errors[0]).toMatchObject({
      code: "418",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
  });

  it("flags a body status that differs from the HTTP status", () => {
    const r = analyze(
      `HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(apiError(404))}`,
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/differs/);
  });
});

describe("mollie webhooks", () => {
  it.each(["classic-webhook.txt", "classic-webhook-http.txt"])(
    "recognizes %s but does not invent a status",
    (file) => {
      const r = analyzeFixture(file);
      expect(r.records[0]).toMatchObject({
        status: "unsupported",
        provider: "mollie",
        format: "mollie.webhook.classic",
      });
      expect(r.events).toEqual([]);
      expect(r.errors).toEqual([]);
      const warning = r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!;
      expect(warning.message).toMatch(/GET \/v2\/payments\/\{id\}/);
      expect(warning.message).toMatch(/does not send the status/);
      expect(warning.message).not.toContain("PPLsynthHook0001");
    },
  );

  it("parses a next-gen full-payload event and detects duplicate deliveries", () => {
    const r = analyzeFixture("next-gen-duplicate-event.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]).toMatchObject({
      eventType: "payment.paid",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "paid",
      eventReference: "event_PPLsynthEvt0001",
      deliveryKey: "event_PPLsynthEvt0001",
      paymentReference: "tr_PPLsynthEvt0001",
      eventTimestamp: "2026-10-21T08:00:01.000Z",
      observedTimestamp: "2026-10-21T08:00:03.000Z",
      amountMinor: "1550",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      payload: "full",
      betaEventType: false,
      method: "ideal",
    });
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
  });

  it("parses a raw next-gen request and only reports the signature header's presence", () => {
    const r = analyzeFixture("next-gen-refund-event-http.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "refund.refunded",
      stage: "refund",
      outcome: "success",
      providerStatus: "refunded",
      paymentReference: "tr_PPLsynthPaid0001",
      relatedReference: "re_PPLsynthRef00001",
      amountMinor: "500",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      signatureHeaderPresent: true,
      betaEventType: true,
    });
    expect(toJsonReport(r)).not.toContain("PPLsynthSignatureValue0001");
  });

  it("recognizes simple-payload events but does not analyze them", () => {
    const r = analyzeFixture("next-gen-simple-event.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "mollie.event.simple" });
    expect(r.events).toEqual([]);
    expect(r.warnings[0]!.message).toMatch(/simple payload/);
  });

  it("decodes the failure reason embedded in a payment.failed event", () => {
    const r = analyze(
      JSON.stringify(
        event(
          "payment.failed",
          payment({ status: "failed", details: { failureReason: "possible_fraud" } }),
        ),
      ),
    );
    expect(r.events[0]).toMatchObject({ outcome: "failure", stage: "payment" });
    expect(r.errors[0]).toMatchObject({
      code: "possible_fraud",
      category: "fraud_or_risk",
      retry: "do_not_retry",
      paymentReference: "tr_PPLsynthTest001",
    });
    expect(r.errors[0]!.source.path).toBe("_embedded.entity.details");
  });

  it("keeps unknown event types without semantics", () => {
    const r = analyze(
      JSON.stringify(
        event("balance-transaction.created", {
          id: "baltr_PPLsynth1",
          resource: "balance-transaction",
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("does not treat a payment link id as a payment id", () => {
    const r = analyze(
      JSON.stringify(
        event("payment-link.paid", {
          id: "pl_PPLsynthLink01",
          amount: { currency: "EUR", value: "24.95" },
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({
      relatedReference: "pl_PPLsynthLink01",
      outcome: "success",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(ruleIds(r)).toContain("MISSING_REFERENCE");
  });
});

describe("mollie correlation and timeline", () => {
  it("groups a payment with its capture, refund and chargeback", () => {
    const r = analyzeFixture("authorized-captured-refunded.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment.milestone.created", "payment", "pending"],
      ["payment.milestone.authorized", "authorization", "success"],
      ["capture.milestone.created", "capture", "pending"],
      ["capture.snapshot", "capture", "success"],
      ["payment.snapshot", "payment", "success"],
      ["refund.milestone.created", "refund", "pending"],
      ["refund.snapshot", "refund", "pending"],
      ["chargeback.milestone.received", "dispute", "unknown"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining([
        "tr_PPLsynthAuth0001",
        "cpt_PPLsynthCap0001",
        "re_PPLsynthRef00002",
        "chb_PPLsynthChb0001",
      ]),
    );
    const chb = r.events.find((e) => e.eventType === "chargeback.milestone.received")!;
    expect(chb).toMatchObject({ amountMinor: "7500", relatedReference: "chb_PPLsynthChb0001" });
    expect(chb.attributes.reversed).toBe(false);
    expect(r.events.some((e) => e.eventType.includes("expired"))).toBe(false);
    // Known limitation: the generic arrival-order rule treats snapshot-derived
    // points as deliveries. The capture was created before paidAt but is listed
    // after the payment, so the rule reports it, with "possible" confidence only.
    expect(r.findings.map((f) => [f.ruleId, f.confidence])).toEqual([
      ["CHARGEBACK_REPORTED", "confirmed"],
      ["REFUND_PENDING", "possible"],
      ["OUT_OF_ORDER_ARRIVAL", "possible"],
    ]);
  });

  it("adds a reversal point only when reversedAt is present", () => {
    const r = analyze(
      JSON.stringify({
        resource: "chargeback",
        id: "chb_PPLsynth2",
        paymentId: "tr_PPLsynth2",
        createdAt: "2026-10-01T00:00:00+00:00",
        reversedAt: "2026-10-05T00:00:00+00:00",
      }),
    );
    expect(r.events.map((e) => e.eventType)).toEqual([
      "chargeback.milestone.received",
      "chargeback.milestone.reversed",
    ]);
    expect(
      r.events.every((e) => e.outcome === "unknown" && e.paymentReference === "tr_PPLsynth2"),
    ).toBe(true);
  });

  it("keeps unrelated payments apart even when they share an orderId", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.latestOutcome).sort()).toEqual(["pending", "success"]);
    expect(JSON.stringify(r.groups)).not.toContain("ord_");
  });

  it("returns only Mollie object ids as correlation keys", () => {
    const r = analyzeFixture("authorized-captured-refunded.json");
    for (const e of r.events) {
      for (const k of mollieAdapter.correlationKeys(e)) expect(k).toMatch(/^(tr|re|chb|cpt)_/);
    }
  });
});

describe("mollie sensitive data", () => {
  const planted = [
    "PPLsynthHolder",
    "6787",
    "tkn_PPLsynthToken01",
    "PPLsynthFingerprint01",
    "jan.pplsynth@example.org",
    "PPLsynthFamily",
    "PPLsynthstraat",
    "PPLsynth-ORDER-77",
    "PPLsynth-ORDER-80",
    "cst_PPLsynthCust01",
    "org_PPLsynth01",
    "webshop.example.org",
    "PPLsynth Consumer",
    "NL00PPLS0000000001",
    "PPLSNL2A",
    "PPLsynthSignatureValue0001",
  ];

  it.each(["paid-payment.json", "next-gen-duplicate-event.json", "next-gen-refund-event-http.txt"])(
    "keeps planted values out of events and reports (%s)",
    (file) => {
      const r = analyzeFixture(file);
      expect(r.events.length).toBeGreaterThan(0);
      const events = JSON.stringify(r.events);
      const report = toJsonReport(r);
      for (const value of planted) {
        expect(events).not.toContain(value);
        expect(report).not.toContain(value);
      }
    },
  );

  it("flags sensitive input fields", () => {
    const r = analyzeFixture("paid-payment.json");
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.sensitiveData.fieldPaths).toEqual(
      expect.arrayContaining(["[0].details.cardNumber", "[0].billingAddress"]),
    );
  });
});

describe("mollie manifest", () => {
  it("is honest about capabilities", () => {
    expect(mollieManifest).toMatchObject({
      id: "mollie",
      version: MOLLIE_ADAPTER_VERSION,
      wave: 1,
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "supported",
      },
      delivery: { ordering: "not_documented" },
    });
    expect(MOLLIE_ADAPTER_VERSION).toBe("0.1.0");
    expect(mollieAdapter.supportedFormats.map((f) => f.id)).not.toContain("mollie.webhook.classic");
  });
});
