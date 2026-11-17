import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeText, toJsonReport, type AnalysisResult } from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  CAUSES,
  ERROR_REASONS,
  EVENT_ACTIONS,
  gocardlessAdapter,
  gocardlessManifest,
  GOCARDLESS_ADAPTER_VERSION,
} from "@pandapaylens/gocardless";

const FIXTURES = new URL("../../../../fixtures/", import.meta.url);
// En and em dash, built from char codes so the source itself stays free of them.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, FIXTURES)), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, {
    adapters: [gocardlessAdapter],
    rules: defaultRules,
    catalogVersion: "test",
    now: () => new Date("2026-11-17T12:00:00.000Z"),
  });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`gocardless/${path}`));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const event = (fields: Record<string, unknown> = {}) => ({
  id: "EVPPLSYNTH990001",
  created_at: "2026-11-16T08:00:00.000Z",
  resource_type: "payments",
  action: "confirmed",
  links: { payment: "PMPPLSYNTH990001" },
  details: { origin: "gocardless", cause: "payment_confirmed" },
  ...fields,
});
const apiError = (fields: Record<string, unknown> = {}) => ({
  error: {
    type: "invalid_state",
    code: 422,
    message: "Some message",
    request_id: "PPLsynth-req-9901",
    errors: [{ reason: "retry_failed", message: "Some message" }],
    ...fields,
  },
});

describe("gocardless detection", () => {
  it.each([
    [{ events: [event()] }, "gocardless.events", 0.98, true],
    [{ events: event() }, "gocardless.event", 0.98, true],
    [event(), "gocardless.event", 0.98, true],
    [event({ id: "PPLsynth1" }), "gocardless.event", 0.8, true],
    [event({ resource_type: "PPLsynth_things", id: "x" }), "gocardless.event", 0.35, true],
    [apiError(), "gocardless.api_error", 0.95, true],
    [{ error: { type: "invalid_state", code: 422 } }, "gocardless.api_error", 0.5, true],
    [{ error: { type: "invalid_state" } }, "gocardless.api_error", 0.3, true],
    [
      { payments: { id: "PMPPLSYNTH990001", status: "confirmed", links: {} } },
      "gocardless.payment",
      0.98,
      true,
    ],
    [
      { refunds: { id: "RFPPLSYNTH990001", status: "paid", links: {} } },
      "gocardless.refund",
      0.98,
      true,
    ],
    [
      { mandates: { id: "MDPPLSYNTH990001", status: "active", links: {} } },
      "gocardless.other_resources",
      0.95,
      false,
    ],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(gocardlessAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("keeps resource objects without the documented id prefix below the acceptance threshold", () => {
    for (const key of ["payments", "refunds", "mandates"])
      expect(
        gocardlessAdapter.detect({ [key]: { id: "PPLsynth1", status: "paid", links: {} } })
          .confidence,
      ).toBeLessThan(0.5);
  });

  it("does not claim generic shapes or match on the provider name", () => {
    const zero = [
      { provider: "gocardless", message: "GoCardless error" },
      { error: { message: "x" } },
      { error: { type: "card_error", code: "card_declined" } },
      { error: { code: 422, message: "x" } },
      { status: "confirmed" },
      { events: [] },
      { events: [{ id: "EVPPLSYNTH1" }] },
      { events: [event(), { type: "other" }] },
      { resource_type: "payments", action: "confirmed" },
      { payments: { id: "PPLsynth1", status: "paid" } },
      { payments: [{ id: "PMPPLSYNTH1", status: "paid" }] },
      null,
      "gocardless",
    ];
    for (const input of zero) expect(gocardlessAdapter.detect(input).confidence).toBe(0);
  });

  it("never fires on Stripe or Adyen fixtures", () => {
    for (const dir of ["stripe", "adyen"]) {
      const folder = new URL(`${dir}/`, FIXTURES);
      for (const file of readdirSync(folder)) {
        if (!/\.(json|jsonl)$/.test(file)) continue;
        let data: unknown;
        try {
          data = JSON.parse(readFileSync(fileURLToPath(new URL(file, folder)), "utf8"));
        } catch {
          continue;
        }
        const records = Array.isArray(data) ? data : [data];
        for (const rec of records)
          expect(gocardlessAdapter.detect(rec).confidence, `${dir}/${file}`).toBe(0);
      }
    }
  });
});

describe("gocardless manifest", () => {
  it("is honest and consistent", () => {
    expect(gocardlessManifest.id).toBe("gocardless");
    expect(gocardlessManifest.version).toBe(GOCARDLESS_ADAPTER_VERSION);
    expect(gocardlessManifest.wave).toBe(5);
    expect(gocardlessManifest.researchStatus).toBe("tested");
    expect(gocardlessManifest.status).toBe("limited");
    expect(gocardlessManifest.delivery).toMatchObject({
      duplicatesDocumented: true,
      ordering: "not_guaranteed",
    });
    for (const d of gocardlessManifest.documentation)
      expect(d.url).toMatch(/^https:\/\/docs\.gocardless\.com\/docs\//);
    const text = JSON.stringify(gocardlessManifest);
    expect(text).not.toMatch(DASHES);
    expect(text).toMatch(/cannot be verified/);
  });

  it("catalogs contain no en or em dashes", () => {
    expect(JSON.stringify([CAUSES, ERROR_REASONS, EVENT_ACTIONS])).not.toMatch(DASHES);
  });
});

describe("gocardless payments", () => {
  it("builds a payment timeline: confirmed is collected, paid_out is settlement", () => {
    const r = analyzeFixture("webhook-payment-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payments.created", "payment", "pending"],
      ["payments.submitted", "payment", "pending"],
      ["payments.confirmed", "payment", "success"],
      ["payments.paid_out", "settlement", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(["PMPPLSYNTH010001"]);
    expect(r.events.every((e) => e.deliveryKey === e.eventReference)).toBe(true);
    expect(r.events[0]!.source.path).toBe("events[0]");
    expect(r.events[0]!.eventTimestamp).toBe("2026-11-02T09:00:01.000Z");
    expect(r.errors).toHaveLength(0);
    expect(ruleIds(r)).toEqual([]);
  });

  it("decodes a failed payment from details.cause", () => {
    const r = analyzeFixture("webhook-payment-failed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payments.failed",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PMPPLSYNTH020001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      cause: "insufficient_funds",
      reasonCode: "AM04",
      scheme: "sepa_core",
      willAttemptRetry: false,
      webhookId: "WBPPLSYNTH020001",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "insufficient_funds",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      paymentReference: "PMPPLSYNTH020001",
      outcomeKnown: true,
      subCodes: {
        origin: "bank",
        scheme: "sepa_core",
        reason_code: "AM04",
        will_attempt_retry: "false",
        not_retried_reason: "failure_filter_applied",
      },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/very likely to fail/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("advises against a manual retry when GoCardless will retry", () => {
    const r = analyzeFixture("webhook-payment-failed-auto-retry.json");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "refer_to_payer",
      category: "unknown",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/automatically/);
    expect(r.events.map((e) => e.eventType)).toEqual([
      "payments.failed",
      "payments.resubmission_requested",
    ]);
  });

  it("reports a chargeback after a paid out payment as a dispute, not an error", () => {
    const r = analyzeFixture("webhook-chargeback.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payments.confirmed", "payment", "success"],
      ["payments.paid_out", "settlement", "success"],
      ["payments.charged_back", "dispute", "unknown"],
      ["payments.chargeback_settled", "settlement", "unknown"],
    ]);
    expect(r.errors).toHaveLength(0);
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("reads a payment response as a snapshot without using created_at as event time", () => {
    const r = analyzeFixture("payment-paid-out.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "payments.snapshot",
      stage: "payment",
      providerStatus: "paid_out",
      outcome: "success",
      paymentReference: "PMPPLSYNTH080001",
      subscriptionReference: "SBPPLSYNTH080001",
      amountMinor: "2500",
      currency: "EUR",
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.createdAt).toBe("2026-11-01T10:00:00.000Z");
    // Mandate and payout ids are shown, never used to link payments.
    expect(gocardlessAdapter.correlationKeys(r.events[0]!)).toEqual(["PMPPLSYNTH080001"]);
  });

  it.each([
    ["pending_submission", "payment", "pending"],
    ["confirmed", "payment", "success"],
    ["failed", "payment", "failure"],
    ["cancelled", "payment", "failure"],
    ["charged_back", "dispute", "unknown"],
    ["PPLsynth_new_status", "payment", "unknown"],
  ])("maps payment status %s", (status, stage, outcome) => {
    const r = analyze(JSON.stringify({ payments: { id: "PMPPLSYNTH990002", status, links: {} } }));
    expect(r.events[0]).toMatchObject({ stage, outcome });
  });
});

describe("gocardless mandates, subscriptions and payouts", () => {
  it("keeps payments of one cancelled mandate apart and decodes bank cancellations", () => {
    const r = analyzeFixture("webhook-mandate-cancelled-cascade.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["mandates.cancelled", "other", "failure"],
      ["payments.cancelled", "cancellation", "failure"],
      ["payments.cancelled", "cancellation", "failure"],
      ["subscriptions.cancelled", "subscription", "success"],
    ]);
    // Mandate, two payments and the subscription stay in separate groups.
    expect(r.groups).toHaveLength(4);
    expect(r.events[1]!.attributes.parentEvent).toBe("EVPPLSYNTH040001");
    expect(r.events[3]!.subscriptionReference).toBe("SBPPLSYNTH040001");
    expect(r.errors.map((e) => [e.code, e.category, e.retry])).toEqual([
      ["bank_account_closed", "payment_method_unavailable", "customer_action_required"],
      ["bank_account_closed", "payment_method_unavailable", "customer_action_required"],
      ["bank_account_closed", "payment_method_unavailable", "customer_action_required"],
    ]);
    // The mandate's error is not attached to any payment.
    expect(r.errors[0]!.paymentReference).toBeUndefined();
    expect(r.errors[1]!.paymentReference).toBe("PMPPLSYNTH040001");
  });

  it("does not decode a cancellation made through the API as an error", () => {
    const r = analyze(
      JSON.stringify({
        events: [
          event({
            action: "cancelled",
            details: { origin: "api", cause: "payment_cancelled" },
          }),
        ],
      }),
    );
    expect(r.events[0]).toMatchObject({ stage: "cancellation", outcome: "failure" });
    expect(r.errors).toHaveLength(0);
  });

  it("reads the single event response envelope", () => {
    const r = analyzeFixture("single-event-response.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "mandates.failed",
      relatedReference: "MDPPLSYNTH160001",
      outcome: "failure",
    });
    expect(r.events[0]!.source.path).toBe("events");
    expect(r.errors[0]).toMatchObject({ code: "invalid_bank_details", confidence: "strong" });
  });

  it("maps a payout to settlement and reports the signature header only by presence", () => {
    const text = fixture("gocardless/webhook-http-request.txt");
    const r = analyze(text);
    expect(r.events[0]).toMatchObject({
      eventType: "payouts.paid",
      stage: "settlement",
      outcome: "success",
      relatedReference: "POPPLSYNTH170001",
    });
    expect(r.events[0]!.attributes.signatureHeaderPresent).toBe(true);
    const signature = /Webhook-Signature: (\S+)/.exec(text)![1]!;
    expect(JSON.stringify(r.events)).not.toContain(signature);
    expect(toJsonReport(r)).not.toContain(signature);
  });
});

describe("gocardless refunds", () => {
  it.each([
    ["created", "pending"],
    ["pending_submission", "pending"],
    ["submitted", "pending"],
    ["paid", "success"],
    ["cancelled", "failure"],
    ["bounced", "failure"],
    ["funds_returned", "failure"],
    ["PPLsynth_new_status", "unknown"],
  ])("maps refund status %s", (status, outcome) => {
    const r = analyze(
      JSON.stringify({
        refunds: { id: "RFPPLSYNTH990002", status, links: { payment: "PMPPLSYNTH990002" } },
      }),
    );
    expect(r.events[0]).toMatchObject({
      stage: "refund",
      outcome,
      paymentReference: "PMPPLSYNTH990002",
      relatedReference: "RFPPLSYNTH990002",
    });
  });

  it("links refund events to the payment through the refund resource", () => {
    const r = analyzeFixture("refund-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["refunds.snapshot", "refund", "success"],
      ["refunds.created", "refund", "pending"],
      ["refunds.paid", "refund", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual(["PMPPLSYNTH060001", "RFPPLSYNTH060001"]);
    expect(r.events[0]).toMatchObject({ amountMinor: "1500", currency: "GBP" });
    expect(ruleIds(r)).not.toContain("REFUND_PENDING");
  });

  it("keeps refund settlement apart from refund failure", () => {
    const r = analyzeFixture("refund-failed.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["refunds.refund_settled", "settlement", "unknown"],
      ["refunds.failed", "refund", "failure"],
    ]);
    expect(r.errors[0]).toMatchObject({ code: "refund_failed", retry: "manual_review" });
    expect(r.errors[0]!.paymentReference).toBeUndefined();
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("shows a created refund as pending", () => {
    const r = analyze(
      JSON.stringify(
        event({
          resource_type: "refunds",
          action: "created",
          links: { refund: "RFPPLSYNTH990001" },
          details: { origin: "api", cause: "refund_created" },
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "refund", outcome: "pending" });
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });
});

describe("gocardless API errors", () => {
  it("decodes a validation error with field errors", () => {
    const r = analyzeFixture("api-error-validation-failed.json");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "validation_failed",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "strong",
      subCodes: { type: "validation_failed", httpStatus: "422", fields: "amount, currency" },
      providerMessage: "must be greater than 0",
    });
    expect(r.events[0]).toMatchObject({ stage: "error", eventType: "api_error.validation_failed" });
  });

  it("decodes an invalid_state reason from a raw HTTP response", () => {
    const r = analyzeFixture("api-error-mandate-inactive.txt");
    expect(r.errors[0]).toMatchObject({
      code: "mandate_is_inactive",
      category: "payment_method_unavailable",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("api-error-unauthorized.json");
    expect(r.errors[0]).toMatchObject({
      code: "unauthorized",
      category: "configuration",
      retry: "do_not_retry",
      subCodes: { httpStatus: "401" },
    });
  });

  it("treats an internal error as an unknown outcome and warns about blind retries", () => {
    const r = analyzeFixture("api-error-internal.json");
    expect(r.errors[0]).toMatchObject({
      code: "internal_server_error",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Idempotency-Key/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("marks an idempotency conflict as a known outcome", () => {
    const r = analyzeFixture("api-error-idempotent-conflict.json");
    expect(r.errors[0]).toMatchObject({
      code: "idempotent_creation_conflict",
      category: "duplicate_request",
      retry: "do_not_retry",
      outcomeKnown: true,
    });
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("marks rate limiting as safe to retry", () => {
    const r = analyze(
      JSON.stringify(
        apiError({
          type: "invalid_api_usage",
          code: 429,
          errors: [{ reason: "rate_limit_exceeded", message: "Rate limit exceeded" }],
        }),
      ),
    );
    expect(r.errors[0]).toMatchObject({
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
    });
  });

  it("keeps an unrecognized reason honest", () => {
    const r = analyze(
      JSON.stringify(apiError({ errors: [{ reason: "pplsynth_new_reason", message: "x" }] })),
    );
    expect(r.errors[0]).toMatchObject({
      code: "pplsynth_new_reason",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
  });

  it("falls back to the error type when no reason is given", () => {
    const r = analyze(JSON.stringify(apiError({ errors: [] })));
    expect(r.errors[0]).toMatchObject({
      code: "invalid_state",
      retry: "do_not_retry",
      confidence: "possible",
    });
  });
});

describe("gocardless unknowns and robustness", () => {
  it("keeps an unrecognized cause unknown", () => {
    const r = analyzeFixture("unrecognized-cause.json");
    expect(r.errors[0]).toMatchObject({
      code: "bank_account_disabled",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it("shows events of other resource types and unknown actions as unknown", () => {
    const r = analyzeFixture("webhook-unknown-event-types.json");
    expect(r.events.map((e) => [e.eventType, e.eventTypeKnown, e.outcome])).toEqual([
      ["billing_requests.fulfilled", false, "unknown"],
      ["payments.pplsynth_future_action", false, "unknown"],
    ]);
    expect(r.events[1]!.paymentReference).toBe("PMPPLSYNTH150001");
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("recognizes duplicate deliveries of the same event", () => {
    const r = analyzeFixture("webhook-duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    // The delivery ids differ; they identify the attempt, not the event.
    expect(r.events[0]!.attributes.webhookId).not.toBe(r.events[1]!.attributes.webhookId);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it("keeps unrelated payments apart", () => {
    const r = analyze(
      JSON.stringify({
        events: [
          event(),
          event({ id: "EVPPLSYNTH990002", links: { payment: "PMPPLSYNTH990009" } }),
        ],
      }),
    );
    expect(r.groups).toHaveLength(2);
  });

  it("reports missing required fields as parse issues without throwing", () => {
    const r = analyzeFixture("invalid-event-missing-id.json");
    expect(r.records[0]).toMatchObject({ provider: "gocardless", status: "invalid" });
    expect(r.events).toHaveLength(0);
    expect(r.warnings.map((w) => w.code)).toContain("INVALID_RECORD");
  });

  it("recognizes mandate responses but does not analyze them", () => {
    const r = analyzeFixture("mandate-response-unsupported.json");
    expect(r.records[0]).toMatchObject({
      provider: "gocardless",
      format: "gocardless.other_resources",
      status: "unsupported",
    });
    expect(r.events).toHaveLength(0);
  });

  it("survives malformed input", () => {
    const r = analyzeText('{"events": [ {"id": ', {
      adapters: [gocardlessAdapter],
      rules: defaultRules,
      catalogVersion: "test",
    });
    expect(r.ok).toBe(false);
    for (const input of [
      { events: [event({ created_at: 5 })] },
      { events: event({ resource_type: 7 }) },
      { error: { type: "invalid_state", code: "422", errors: "x" } },
      { payments: { id: "PMPPLSYNTH1", status: 3, links: {} } },
    ]) {
      expect(() => analyze(JSON.stringify(input))).not.toThrow();
    }
  });

  it("keeps references of ids that resemble bank account numbers", () => {
    // Prefix, two digits, then letters and digits: the free-text IBAN pattern
    // matches this shape. GoCardless documents only the prefix of its ids.
    const r = analyze(
      JSON.stringify({
        events: [
          event({ id: "EV08PPLSYNTH0001", links: { payment: "PM08PPLSYNTH0001" } }),
          event({
            id: "EV08PPLSYNTH0002",
            action: "paid_out",
            links: { payment: "PM08PPLSYNTH0001", parent_event: "EV08PPLSYNTH0001" },
          }),
        ],
      }),
    );
    expect(r.events.map((e) => [e.paymentReference, e.deliveryKey])).toEqual([
      ["PM08PPLSYNTH0001", "EV08PPLSYNTH0001"],
      ["PM08PPLSYNTH0001", "EV08PPLSYNTH0002"],
    ]);
    expect(r.events[1]!.attributes.parentEvent).toBe("EV08PPLSYNTH0001");
    expect(r.groups).toHaveLength(1);
    // The raw input is flagged by the generic sensitive-data scan.
    expect(r.warnings.map((w) => w.code)).toContain("SENSITIVE_DATA_DETECTED");
  });

  it("lists only machine-readable field names from validation errors", () => {
    const r = analyze(
      JSON.stringify(
        apiError({
          type: "validation_failed",
          errors: [
            { field: "amount", message: "x" },
            { field: "pplsynth.planted@example.com", message: "x" },
          ],
        }),
      ),
    );
    expect(r.errors[0]!.subCodes.fields).toBe("amount");
    expect(toJsonReport(r)).not.toContain("pplsynth.planted@example.com");
  });

  it("never copies metadata, descriptions or messages from unknown fields", () => {
    const planted = {
      events: [
        event({
          metadata: { note: "PPLsynth-planted-metadata" },
          resource_metadata: { customer_email: "pplsynth.planted@example.com" },
          details: {
            origin: "bank",
            cause: "insufficient_funds",
            description: "PPLsynth-planted-description",
          },
          source: { type: "user", name: "PPLsynth Planted Name" },
          customer_notifications: [{ id: "PPLsynth-planted-notification", type: "x" }],
          action: "failed",
        }),
      ],
    };
    const r = analyze(JSON.stringify(planted));
    const out = JSON.stringify(r.events) + JSON.stringify(r.errors) + toJsonReport(r);
    for (const secret of [
      "PPLsynth-planted-metadata",
      "pplsynth.planted@example.com",
      "PPLsynth-planted-description",
      "PPLsynth Planted Name",
      "PPLsynth-planted-notification",
    ])
      expect(out).not.toContain(secret);
  });

  it("every fixture is analyzed without throwing", () => {
    const folder = new URL("gocardless/", FIXTURES);
    for (const file of readdirSync(folder)) {
      expect(() => analyzeFixture(file), file).not.toThrow();
      if (!/invalid|unsupported/.test(file))
        expect(analyzeFixture(file).events.length, file).toBeGreaterThan(0);
    }
  });
});
