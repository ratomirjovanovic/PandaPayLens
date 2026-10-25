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
import {
  APPROVED_CODES,
  ERROR_CODES,
  RESPONSE_CODES,
  checkoutAdapter,
  checkoutManifest,
  CHECKOUT_ADAPTER_VERSION,
} from "@pandapaylens/checkout";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [checkoutAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(path));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const PAY = "pay_PPLsynthTEST00000000000001";
const ACT = "act_PPLsynthTEST00000000000001";

const payment = (fields: Record<string, unknown>) => ({
  id: PAY,
  action_id: ACT,
  amount: 1000,
  currency: "EUR",
  processed_on: "2026-10-20T10:00:00Z",
  ...fields,
});
const declined = (code: unknown, extra: Record<string, unknown> = {}) =>
  payment({ approved: false, status: "Declined", response_code: code, ...extra });
const webhook = (type: string, data: Record<string, unknown> = {}, id = "evt_PPLsynthTEST01") => ({
  id,
  type,
  version: "1.0.29",
  created_on: "2026-10-20T10:00:01.0000000Z",
  data: { id: PAY, action_id: ACT, amount: 1000, currency: "EUR", ...data },
});
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;

describe("checkout detection", () => {
  it.each([
    [
      { request_id: "R", error_type: "request_invalid", error_codes: ["x"] },
      "checkout.api_error",
      0.92,
      true,
    ],
    [{ error_type: "request_invalid", error_codes: ["x"] }, "checkout.api_error", 0.75, true],
    [{ request_id: "R", error_type: "request_malformed" }, "checkout.api_error", 0.75, true],
    [{ request_id: "R", error_type: "something_new" }, "checkout.api_error", 0.45, true],
    [payment({ status: "Authorized", approved: true }), "checkout.payment_response", 0.9, true],
    [{ id: PAY, status: "Authorized" }, "checkout.payment_response", 0.65, true],
    [{ id: PAY }, "checkout.payment_response", 0.3, true],
    [{ id: "pay_PPLsynth000001" }, "checkout.payment_response", 0.15, true],
    [
      { response_code: "20051", response_summary: "Insufficient funds" },
      "checkout.payment_response",
      0.6,
      true,
    ],
    [
      {
        action_id: ACT,
        _links: { payment: { href: `https://x.example/payments/${PAY}` } },
      },
      "checkout.action_accepted",
      0.85,
      true,
    ],
    [{ action_id: ACT, reference: "R" }, "checkout.action_accepted", 0.6, true],
    [webhook("payment_captured"), "checkout.webhook", 0.98, true],
    [
      { id: "evt_x", type: "payment_captured", version: "1.0.9", created_on: "t", data: {} },
      "checkout.webhook",
      0.65,
      true,
    ],
    [{ id: "evt_x", type: "payment_captured", data: { id: PAY } }, "checkout.webhook", 0.8, true],
    [
      {
        id: "set_PPLsynthSETU00000000000001",
        event_type: "payment_method_ready",
        event_subject_id: "set_PPLsynthSETU00000000000001",
      },
      "checkout.webhook.payment_setup",
      0.85,
      false,
    ],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(checkoutAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("raises an otherwise weak error body when it arrived as an HTTP error", () => {
    const meta = {
      format: "http" as const,
      http: { kind: "response" as const, status: 502, headers: {} },
    };
    expect(checkoutAdapter.detect({ request_id: "R", error_type: "x" }, meta).confidence).toBe(0.6);
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "checkout", message: "Checkout.com error" },
      "checkout.com",
      null,
      [],
      { error: { type: "card_error" } },
      { status: "Authorized" },
      { error: "request_invalid" },
      { id: "evt_1", type: "payment_captured", data: {} },
      { id: "evt_1", type: "payment_captured", data: { id: "PPLSYNTH1" } },
    ]) {
      expect(checkoutAdapter.detect(input).confidence).toBe(0);
    }
  });

  it("never claims Stripe-shaped events, even with Checkout.com-like ids", () => {
    expect(
      checkoutAdapter.detect({
        id: "evt_1",
        object: "event",
        type: "x",
        data: { object: { id: PAY } },
      }).confidence,
    ).toBe(0);
    expect(
      checkoutAdapter.detect({ id: "evt_1", type: "x", data: { object: {}, id: PAY } }).confidence,
    ).toBe(0);
  });

  it.each(["stripe", "adyen", "malformed", "mixed"])(
    "returns confidence 0 for every record in fixtures/%s",
    (dir) => {
      const root = fileURLToPath(new URL(`../../../../fixtures/${dir}/`, import.meta.url));
      let checked = 0;
      for (const file of readdirSync(root)) {
        const parsed = parseInput(readFileSync(`${root}${file}`, "utf8"));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const r = record as Record<string, unknown>;
          const payload =
            r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
              ? r.payload
              : record;
          expect(
            checkoutAdapter.detect(payload, parsed.value.meta[i]).confidence,
            `${dir}/${file} record ${i}`,
          ).toBe(0);
          checked++;
        });
      }
      expect(checked).toBeGreaterThan(0);
    },
  );
});

describe("checkout parsing", () => {
  it("reports missing required webhook fields as parse issues", () => {
    const { type: _omit, ...noType } = webhook("payment_captured");
    const r = analyze(json(noType));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "checkout.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^type:/);
    expect(r.events).toEqual([]);
  });

  it("rejects wrongly typed fields without throwing", () => {
    expect(checkoutAdapter.parse({ id: PAY, status: 42 }, "checkout.payment_response").ok).toBe(
      false,
    );
    const r = analyze(json({ request_id: "R", error_type: "request_invalid", error_codes: "x" }));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "checkout.api_error" });
    expect(checkoutAdapter.parse({}, "checkout.unknown").ok).toBe(false);
  });

  it("tolerates unknown fields and numeric response codes", () => {
    const p = checkoutAdapter.parse(
      payment({ status: "Declined", response_code: 20051, brand_new: [1] }),
      "checkout.payment_response",
    );
    expect(p.ok).toBe(true);
    expect(firstError(declined(20051)).code).toBe("20051");
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"id": "pay_x", "status": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });
});

describe("checkout payment responses and webhooks", () => {
  it("builds one timeline from a response and its webhooks", () => {
    const r = analyzeFixture("checkout/successful-payment.json");
    expect(
      r.events.map((e) => [e.sourceFormat, e.eventType, e.stage, e.outcome, e.relatedReference]),
    ).toEqual([
      [
        "checkout.payment_response",
        "payment.Authorized",
        "authorization",
        "success",
        "act_PPLsynthOKAY00000000000001",
      ],
      [
        "checkout.webhook",
        "payment_approved",
        "authorization",
        "success",
        "act_PPLsynthOKAY00000000000001",
      ],
      [
        "checkout.webhook",
        "payment_captured",
        "capture",
        "success",
        "act_PPLsynthOKAY00000000000002",
      ],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual([
      "act_PPLsynthOKAY00000000000001",
      "act_PPLsynthOKAY00000000000002",
      "pay_PPLsynthOKAY00000000000001",
    ]);
    expect(r.events[0]).toMatchObject({
      providerStatus: "Authorized",
      paymentReference: "pay_PPLsynthOKAY00000000000001",
      merchantReference: "ORD-PPLSYNTH-0001",
      amountMinor: "6540",
      currency: "USD",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
    });
    expect(r.events[1]!.attributes).toMatchObject({
      envelope: "created_on",
      version: "1.0.29",
      notificationCreatedAt: "2026-10-20T10:00:01.123Z",
    });
    expect(r.events[2]!.attributes).toMatchObject({
      envelope: "timestamp_source",
      eventSource: "gateway",
      totalCaptured: "6540",
      availableToRefund: "6540",
    });
    expect(r.events[2]!.deliveryKey).toBe("evt_PPLsynthOKAY00000000000002");
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("orders unordered deliveries by processing time and keeps captures apart from refunds", () => {
    const r = analyzeFixture("checkout/capture-and-refund.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.amountMinor])).toEqual([
      ["payment_approved", "authorization", "success", "2500"],
      ["payment_captured", "capture", "success", "2500"],
      ["payment_refunded", "refund", "success", "1000"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.eventIds).toHaveLength(3);
    expect(r.events[2]!.attributes.totalRefunded).toBe("1000");
  });

  it("links a refund accepted response to the payment and treats it as pending", () => {
    const r = analyzeFixture("checkout/refund-accepted.txt");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "checkout.action_accepted",
      stage: "other",
      outcome: "pending",
      providerStatus: "HTTP 202",
      paymentReference: "pay_PPLsynthFLOW00000000000001",
      relatedReference: "act_PPLsynthFLOW00000000000003",
    });
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);

    // The 202 and the later webhook share the act_ id and the pay_ id.
    const http = parseInput(fixture("checkout/refund-accepted.txt"));
    const hooks = parseInput(fixture("checkout/capture-and-refund.json"));
    if (!http.ok || !hooks.ok) throw new Error("fixture did not parse");
    const joined = analyzeRecords([...http.value.records, ...hooks.value.records], options, [
      ...http.value.meta,
      ...hooks.value.meta,
    ]);
    expect(joined.ok && joined.result.groups).toHaveLength(1);
  });

  it("treats HTTP 200 on an action as already processed", () => {
    const r = analyze(
      [
        "HTTP/1.1 200 OK",
        "Content-Type: application/json",
        "",
        json({
          action_id: ACT,
          _links: { payment: { href: `https://x.example/payments/${PAY}` } },
        }),
      ].join("\n"),
    );
    expect(r.events[0]).toMatchObject({
      outcome: "success",
      attributes: { alreadyProcessed: true },
    });
  });

  it("reports duplicate deliveries by event id", () => {
    const r = analyzeFixture("checkout/duplicate-webhook.json");
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      "evt_PPLsynthDUPL00000000000001",
      "evt_PPLsynthDUPL00000000000001",
    ]);
    expect(r.events[0]!.observedTimestamp).toBe("2026-10-20T12:00:03.000Z");
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
    expect(r.findings[0]!.explanation).toMatch(/same event id \(evt_\)/);
  });

  it("does not merge payments that only share a merchant reference", () => {
    const r = analyzeFixture("checkout/unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "ORD-PPLSYNTH-SHARED",
      "ORD-PPLSYNTH-SHARED",
    ]);
    expect(r.groups.map((g) => g.latestOutcome)).toEqual(["failure", "success"]);
  });

  it("reports a 202 Pending response as an unresolved outcome", () => {
    const r = analyzeFixture("checkout/pending-payment.json");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "pending",
      providerStatus: "Pending",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it.each([
    ["Authorized", "authorization", "success"],
    ["Card Verified", "authorization", "success"],
    ["Declined", "authorization", "failure"],
    ["Pending", "payment", "pending"],
    ["Retry Scheduled", "payment", "pending"],
    ["Captured", "capture", "success"],
    ["Partially Captured", "capture", "success"],
    ["Refunded", "refund", "success"],
    ["Partially Refunded", "refund", "success"],
    ["Voided", "void", "success"],
    ["Canceled", "cancellation", "failure"],
    ["Expired", "cancellation", "failure"],
    ["Paid", "payment", "success"],
    ["Returned", "reversal", "failure"],
  ])("maps payment status %s to %s / %s", (status, stage, outcome) => {
    const e = analyze(json(payment({ status }))).events[0]!;
    expect(e).toMatchObject({ stage, outcome, eventTypeKnown: true, providerStatus: status });
  });

  it("keeps unknown and wrongly cased statuses unknown", () => {
    for (const status of ["Mystery", "captured"]) {
      const e = analyze(json(payment({ status }))).events[0]!;
      expect(e).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    }
  });

  it.each([
    ["payment_approved", "authorization", "success"],
    ["payment_declined", "authorization", "failure"],
    ["payment_authorization_incremented", "authorization", "success"],
    ["card_verification_declined", "authorization", "failure"],
    ["payment_pending", "payment", "pending"],
    ["payment_captured", "capture", "success"],
    ["payment_capture_pending", "capture", "pending"],
    ["payment_capture_declined", "capture", "failure"],
    ["payment_refund_pending", "refund", "pending"],
    ["payment_refunded", "refund", "success"],
    ["payment_refund_declined", "refund", "failure"],
    ["payment_voided", "void", "success"],
    ["payment_void_declined", "void", "failure"],
    ["payment_canceled", "cancellation", "failure"],
    ["payment_expired", "cancellation", "failure"],
    ["payment_returned", "reversal", "failure"],
    ["payment_retry_scheduled", "payment", "pending"],
  ])("maps webhook %s to %s / %s", (type, stage, outcome) => {
    const e = analyze(json(webhook(type))).events[0]!;
    expect(e).toMatchObject({ stage, outcome, eventTypeKnown: true });
  });

  it("shows other event families without lifecycle semantics", () => {
    const r = analyze(
      json([
        webhook("dispute_received", {}, "evt_PPLsynthTEST02"),
        webhook("batch_successful", {}, "evt_PPLsynthTEST03"),
      ]),
    );
    expect(r.events.map((e) => [e.stage, e.outcome, e.eventTypeKnown])).toEqual([
      ["dispute", "unknown", false],
      ["other", "unknown", false],
    ]);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("uses data.payment_id for payment_optimized", () => {
    const evt = webhook("payment_optimized");
    const { id: _id, ...data } = evt.data;
    const r = analyze(json({ ...evt, data: { ...data, payment_id: PAY } }));
    expect(r.events[0]!.paymentReference).toBe(PAY);
  });

  it("ignores data ids that are not payment ids", () => {
    const r = analyze(
      json(webhook("dispute_received", { id: "dsp_PPLsynth0001", action_id: undefined })),
    );
    expect(r.events[0]!.paymentReference).toBeUndefined();
  });

  it("recognizes but does not analyze Payment Setup events", () => {
    const r = analyzeFixture("checkout/payment-setup-event.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "checkout.webhook.payment_setup",
    });
    expect(r.warnings[0]!.message).toMatch(/Payment Setup/);
    expect(r.events).toEqual([]);
  });
});

describe("checkout error decoding", () => {
  it("decodes a declined 201 response and its webhook as one attempt", () => {
    const r = analyzeFixture("checkout/declined-payment.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payment.Declined", "failure"],
      ["payment_declined", "failure"],
    ]);
    expect(
      r.errors.map((e) => [e.code, e.category, e.retry, e.confidence, e.attemptReference]),
    ).toEqual([
      [
        "20051",
        "insufficient_funds",
        "customer_action_required",
        "strong",
        "act_PPLsynthDECL00000000000001",
      ],
      [
        "20051",
        "insufficient_funds",
        "customer_action_required",
        "strong",
        "act_PPLsynthDECL00000000000001",
      ],
    ]);
    expect(r.errors[0]!.subCodes).toEqual({
      decline_class: "soft_decline",
      partner_response_code: "51",
      scheme: "visa",
    });
    expect(r.errors[0]!.providerMessage).toBe("Insufficient funds");
    expect(r.errors[0]!.retryExplanation).toMatch(/soft decline/);
    expect(r.errors[0]!.retryExplanation).toMatch(/Smart Dunning/);
    expect(r.events[1]!.attributes).toMatchObject({ retryAttemptsMade: 1, retryMaxAttempts: 10 });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("decodes validation errors one code at a time", () => {
    const r = analyzeFixture("checkout/validation-error.json");
    expect(r.suggestedView).toBe("decoder");
    expect(r.errors.map((e) => [e.code, e.category, e.retry, e.confidence, e.source.path])).toEqual(
      [
        ["payment_source_required", "invalid_request", "do_not_retry", "strong", "error_codes[0]"],
        [
          "usd_currency_not_configured",
          "configuration",
          "do_not_retry",
          "strong",
          "error_codes[1]",
        ],
        [
          "destination_account_holder_first_name_too_long",
          "invalid_request",
          "do_not_retry",
          "possible",
          "error_codes[2]",
        ],
      ],
    );
    expect(r.errors[0]!.subCodes).toEqual({ error_type: "request_invalid" });
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "unknown" });
    expect(r.findings).toEqual([]);
  });

  it("decodes the documented refund authorization decline", () => {
    expect(
      firstError({
        request_id: "PPLSYNTHREQ3",
        error_type: "processing_error",
        error_codes: ["refund_authorization_declined"],
      }),
    ).toMatchObject({ category: "card_declined", retry: "manual_review", confidence: "strong" });
  });

  it("decodes a 429 duplicate request with its HTTP status", () => {
    const r = analyze(
      [
        "HTTP/1.1 429 Too Many Requests",
        "Content-Type: application/json",
        "",
        json({
          request_id: "PPLSYNTHREQ4",
          error_type: "request_invalid",
          error_codes: ["duplicate_request"],
        }),
      ].join("\n"),
    );
    expect(r.errors[0]).toMatchObject({
      code: "duplicate_request",
      category: "duplicate_request",
      retry: "do_not_retry",
      subCodes: { error_type: "request_invalid", http_status: "429" },
    });
  });

  it.each([
    [401, "configuration", "do_not_retry", "possible"],
    [502, "provider_unavailable", "retry_conditionally", "possible"],
    [504, "network_or_timeout", "retry_conditionally", "possible"],
    [418, "unknown", "unknown", "insufficient"],
  ])("falls back to HTTP %i when error_type is unknown", (status, category, retry, confidence) => {
    const r = analyze(
      [
        `HTTP/1.1 ${status} X`,
        "Content-Type: application/json",
        "",
        json({ request_id: "R", error_type: "x_new" }),
      ].join("\n"),
    );
    expect(r.errors[0]).toMatchObject({ category, retry, confidence });
    if (retry === "retry_conditionally") expect(r.errors[0]!.retryExplanation).toMatch(/Verify/);
  });

  it("reports unknown error codes honestly", () => {
    const known = firstError({
      request_id: "R",
      error_type: "request_invalid",
      error_codes: ["brand_new_thing"],
    });
    expect(known).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(known.missingInformation.join(" ")).toMatch(/brand_new_thing/);
    const unknown = firstError({ error_type: "x_new", error_codes: ["mystery"] });
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it.each([
    ["20151", "authentication_failed", "customer_action_required"],
    ["20154", "authentication_required", "customer_action_required"],
    ["43401", "authentication_required", "customer_action_required"],
    ["41201", "fraud_or_risk", "do_not_retry"],
    ["43101", "fraud_or_risk", "manual_review"],
    ["30004", "card_declined", "do_not_retry"],
    ["30043", "fraud_or_risk", "do_not_retry"],
    ["2005C", "card_declined", "customer_action_required"],
    ["50003", "insufficient_funds", "manual_review"],
  ])("decodes response code %s as %s / %s", (code, category, retry) => {
    expect(firstError(declined(code))).toMatchObject({
      code,
      category,
      retry,
      confidence: "strong",
    });
  });

  it("points 3DS declines at the SCA retry guide", () => {
    expect(firstError(declined("20154")).documentation.map((d) => d.url)).toContain(
      "https://www.checkout.com/docs/payments/authenticate-payments/manage-sca-retries",
    );
  });

  it("never presents a timeout as safe to retry", () => {
    const e = firstError(declined("20068"));
    expect(e).toMatchObject({ category: "network_or_timeout", retry: "retry_conditionally" });
    expect(e.retryExplanation).toMatch(/Verify the current payment status/);
    expect(e.retryExplanation).toMatch(/automatic downtime retries/);
  });

  it("uses the documented range for codes missing from the catalog", () => {
    const soft = firstError(declined("20777"));
    expect(soft).toMatchObject({
      category: "card_declined",
      retry: "retry_conditionally",
      confidence: "possible",
    });
    expect(soft.missingInformation.join(" ")).toMatch(/20777/);
    expect(firstError(declined("30999"))).toMatchObject({
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(firstError(declined("44999"))).toMatchObject({
      category: "fraud_or_risk",
      confidence: "possible",
    });
    expect(firstError(declined("15000"))).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it("lets recommendation and merchant advice codes override retry guidance", () => {
    expect(
      firstError(declined("20005", { processing: { recommendation_code: "03" } })),
    ).toMatchObject({
      retry: "do_not_retry",
      subCodes: { recommendation_code: "03" },
    });
    expect(
      firstError(declined("30021", { processing: { partner_merchant_advice_code: "24" } })).retry,
    ).toBe("retry_conditionally");
    const uninterpreted = firstError(
      declined("20005", { processing: { partner_merchant_advice_code: "40" } }),
    );
    expect(uninterpreted.retry).toBe("customer_action_required");
    expect(uninterpreted.missingInformation.join(" ")).toMatch(/not interpreted/);
  });

  it("does not decode approvals", () => {
    expect(
      analyze(json(payment({ status: "Authorized", approved: true, response_code: "10100" })))
        .errors,
    ).toEqual([]);
    expect(analyze(json(webhook("payment_captured", { response_code: "10000" }))).errors).toEqual(
      [],
    );
  });

  it("decodes declined webhooks that carry no response_code as insufficient", () => {
    const e = firstError(webhook("payment_capture_declined"));
    expect(e).toMatchObject({
      code: "Declined",
      confidence: "insufficient",
      source: { path: "data" },
    });
    expect(e.missingInformation.join(" ")).toMatch(/No response_code/);
  });
});

describe("checkout sensitive data", () => {
  const PLANTED = [
    "planted.secret.person@example.com",
    "Planted Synthetic Name",
    "77 Planted Synthetic Road",
    "PL4NT",
    "555 777 7777",
    "7777",
    "411111",
    "PLANTEDSYNTHFINGERPRINT000001",
    "PlantedMetadataValue",
    "PLANTEDSYNTHCRYPTOGRAM0001",
    "PLANTEDSYNTHXID0001",
    "PLANTEDACQ0001",
    "PLANTEDRRN01",
    "PLANTEDSCHEMEID01",
    "198.51.100.77",
    "PPL555",
    "PPLSYNTH-WEBHOOK-AUTH-KEY-0001",
    "PPLSYNTHSIGNATURE",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("checkout/webhook-request.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "checkout.webhook" });
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.errors[0]).toMatchObject({ code: "20005", retry: "customer_action_required" });
  });

  it("keeps customer and card fields of payment responses out of events", () => {
    const dump = JSON.stringify(analyzeFixture("checkout/successful-payment.json").events);
    expect(dump).not.toMatch(
      /synthetic\.customer@example\.com|Synthetic Customer|4242|PPLSYNTHFINGERPRINT|Synthetic Street|192\.0\.2\.10|PPLSYNTHCOUPON|PPL770|PPLSYNTHACQ/,
    );
  });

  it("drops merchant references that contain personal data", () => {
    const r = analyze(json(payment({ status: "Authorized", reference: "someone@example.com" })));
    expect(r.events[0]!.merchantReference).toBeUndefined();
    expect(JSON.stringify(r.events)).not.toContain("someone@example.com");
  });
});

describe("checkout manifest and catalog", () => {
  it("declares honest capabilities", () => {
    expect(checkoutManifest).toMatchObject({
      id: "checkout",
      version: CHECKOUT_ADAPTER_VERSION,
      wave: 1,
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
      capabilities: {
        errorDecoding: "supported",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "supported",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_guaranteed" },
    });
    expect(checkoutManifest.limitations.join(" ")).toMatch(
      /does not document whether a retried or resent webhook keeps the same evt_ id/,
    );
  });

  it("contains every documented response code and error code", () => {
    expect(Object.keys(APPROVED_CODES).length + Object.keys(RESPONSE_CODES).length).toBe(258);
    expect(Object.keys(ERROR_CODES)).toHaveLength(153);
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([checkoutManifest, RESPONSE_CODES, ERROR_CODES, APPROVED_CODES]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
