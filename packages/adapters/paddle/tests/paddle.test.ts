import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeText, toJsonReport, type AnalysisResult } from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  API_ERRORS,
  EVENT_TYPES,
  PAYMENT_ERROR_CODES,
  paddleAdapter,
  paddleManifest,
  PADDLE_ADAPTER_VERSION,
} from "@pandapaylens/paddle";

const FIXTURES = new URL("../../../../fixtures/", import.meta.url);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, FIXTURES)), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, {
    adapters: [paddleAdapter],
    rules: defaultRules,
    catalogVersion: "test",
    now: () => new Date("2026-11-17T12:00:00.000Z"),
  });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`paddle/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const txn = (fields: Record<string, unknown> = {}) => ({
  id: "txn_PPLsynthTest01",
  status: "completed",
  currency_code: "EUR",
  origin: "web",
  collection_mode: "automatic",
  subscription_id: null,
  details: { totals: { grand_total: "1250", currency_code: "EUR" } },
  payments: [],
  ...fields,
});
const attempt = (fields: Record<string, unknown> = {}) => ({
  payment_attempt_id: "PPLsynth-attempt-test-01",
  amount: "1250",
  status: "error",
  error_code: "declined",
  created_at: "2026-11-01T10:00:00Z",
  captured_at: null,
  ...fields,
});
const notification = (
  type: string,
  data: Record<string, unknown>,
  fields: Record<string, unknown> = {},
) => ({
  event_id: "evt_PPLsynthTest01",
  event_type: type,
  occurred_at: "2026-11-01T10:00:01Z",
  notification_id: "ntf_PPLsynthTest01",
  data,
  ...fields,
});
const apiError = (code: string, fields: Record<string, unknown> = {}) => ({
  error: {
    type: "request_error",
    code,
    detail: "Some detail",
    documentation_url: `https://developer.paddle.com/errors/shared/${code}`,
    ...fields,
  },
  meta: { request_id: "PPLsynth-request-test" },
});
const adjustment = (fields: Record<string, unknown> = {}) => ({
  id: "adj_PPLsynthTest01",
  action: "refund",
  type: "full",
  status: "approved",
  transaction_id: "txn_PPLsynthTest01",
  subscription_id: null,
  currency_code: "EUR",
  totals: { total: "1250", currency_code: "EUR" },
  created_at: "2026-11-02T10:00:00Z",
  updated_at: "2026-11-02T11:00:00Z",
  ...fields,
});

describe("paddle manifest", () => {
  it("is honest and versioned", () => {
    expect(paddleAdapter.version).toBe(PADDLE_ADAPTER_VERSION);
    expect(paddleManifest.status).toBe("limited");
    expect(paddleManifest.wave).toBe(5);
    expect(paddleManifest.researchStatus).toBe("tested");
    expect(Object.values(paddleManifest.capabilities)).not.toContain("supported");
    expect(paddleManifest.delivery).toMatchObject({
      duplicateKey: "event_id",
      duplicatesDocumented: true,
      ordering: "not_guaranteed",
    });
    expect(paddleManifest.limitations.join(" ")).toMatch(/cannot be verified offline/);
    for (const d of paddleManifest.documentation)
      expect(d.url).toMatch(/^https:\/\/developer\.paddle\.com\//);
  });

  it("catalogs codes from the documented groups only", () => {
    expect(Object.keys(API_ERRORS)).toHaveLength(87);
    for (const [code, e] of Object.entries(API_ERRORS)) {
      expect(code).toMatch(/^[a-z0-9_]+$/);
      expect(["shared", "adjustments", "transactions", "subscriptions"]).toContain(e.group);
      if (e.group !== "shared") expect(code.startsWith(e.group.slice(0, -1))).toBe(true);
    }
    expect(Object.keys(PAYMENT_ERROR_CODES)).toHaveLength(21);
    expect(Object.keys(EVENT_TYPES)).toHaveLength(21);
  });

  it("uses no em or en dashes in catalog and manifest text", () => {
    const text = json({ API_ERRORS, PAYMENT_ERROR_CODES, paddleManifest });
    const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});

describe("paddle detection", () => {
  it.each([
    [notification("transaction.paid", txn()), "paddle.notification", 0.97, true],
    [
      notification("transaction.paid", txn(), { notification_id: undefined }),
      "paddle.notification",
      0.85,
      true,
    ],
    [
      notification("transaction.paid", txn(), { event_id: "PPLsynth1" }),
      "paddle.notification",
      0.8,
      true,
    ],
    [notification("adjustment.created", adjustment()), "paddle.notification", 0.97, true],
    [
      notification("customer.created", { id: "ctm_PPLsynth1" }),
      "paddle.notification.other",
      0.97,
      false,
    ],
    [apiError("not_found"), "paddle.error", 0.95, true],
    [{ error: apiError("not_found").error }, "paddle.error", 0.8, true],
    [
      { error: { type: "api_error", code: "internal_error", detail: "x" } },
      "paddle.error",
      0.4,
      true,
    ],
    [{ data: txn(), meta: { request_id: "PPLsynth-r" } }, "paddle.entity", 0.95, true],
    [{ data: txn() }, "paddle.entity", 0.6, true],
    [{ data: [txn()], meta: { pagination: { per_page: 1 } } }, "paddle.list", 0.8, false],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(paddleAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("does not claim generic shapes or match on the provider name", () => {
    const zero = [
      { provider: "paddle", message: "Paddle error" },
      { error: { message: "x" } },
      { error: { type: "request_error", code: "x" } },
      { error: { type: "card_error", code: "x", detail: "y" } },
      { status: "completed", id: "txn_PPLsynth1" },
      { data: { id: "txn_PPLsynth1" } },
      { data: { id: "PPLsynth1", status: "completed" }, meta: { request_id: "r" } },
      { id: "evt_1", object: "event", type: "payment_intent.succeeded", data: { object: {} } },
      { id: "WH-PPLsynth", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} },
      { event_id: "evt_PPLsynth", event_type: "Not An Event", occurred_at: "x", data: {} },
      { data: [], meta: {} },
      null,
      "paddle",
    ];
    for (const input of zero) expect(paddleAdapter.detect(input).confidence).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture record", () => {
    for (const provider of ["stripe", "adyen"]) {
      const dir = new URL(`${provider}/`, FIXTURES);
      for (const file of readdirSync(dir)) {
        if (!/\.json$/.test(file)) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
        } catch {
          continue;
        }
        const records = Array.isArray(parsed) ? parsed : [parsed];
        for (const r of records)
          expect(paddleAdapter.detect(r).confidence, `${provider}/${file}`).toBe(0);
      }
    }
  });
});

describe("paddle notifications", () => {
  it("decodes a failed payment from the newest attempt, not the transaction status", () => {
    const r = analyzeFixture("webhook-payment-failed.json");
    expect(r.events).toHaveLength(1);
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "transaction.payment_failed",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
      providerStatus: "ready",
      paymentReference: "txn_PPLsynth0101",
      eventReference: "evt_PPLsynth0101paymentfailed",
      deliveryKey: "evt_PPLsynth0101paymentfailed",
      eventTimestamp: "2026-11-02T09:01:01.120Z",
      amountMinor: "5500",
      currency: "USD",
    });
    expect(e.attributes).toMatchObject({
      transactionStatus: "ready",
      latestAttemptStatus: "error",
      latestAttemptErrorCode: "not_enough_balance",
      notificationId: "ntf_PPLsynth0101paymentfailed",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "not_enough_balance",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "txn_PPLsynth0101",
      attemptReference: "PPLsynth-attempt-0101",
    });
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("follows a checkout from draft to completed and links the subscription by transaction_id", () => {
    const r = analyzeFixture("checkout-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["transaction.created", "payment", "pending"],
      ["transaction.ready", "payment", "pending"],
      ["transaction.paid", "payment", "success"],
      ["subscription.created", "subscription", "success"],
      ["transaction.completed", "payment", "success"],
    ]);
    const sub = r.events[3]!;
    expect(sub).toMatchObject({
      paymentReference: "txn_PPLsynth0201",
      relatedReference: "sub_PPLsynth0201",
      subscriptionReference: "sub_PPLsynth0201",
    });
    expect(r.events[4]!.subscriptionReference).toBe("sub_PPLsynth0201");
    expect(r.events[4]!.isRecurring).toBe(false);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(r.errors).toHaveLength(0);
  });

  it("keeps a refund pending until Paddle approves it", () => {
    const r = analyzeFixture("refund-lifecycle.json");
    const adj = r.events.filter((e) => e.attributes.objectType === "adjustment");
    expect(adj.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus])).toEqual([
      ["adjustment.created", "refund", "pending", "pending_approval"],
      ["adjustment.updated", "refund", "success", "approved"],
    ]);
    expect(adj[0]).toMatchObject({
      paymentReference: "txn_PPLsynth0301",
      relatedReference: "adj_PPLsynth0301",
      amountMinor: "1000",
      currency: "USD",
    });
    expect(r.groups).toHaveLength(1);
  });

  it("shows a chargeback adjustment as a dispute with unknown outcome", () => {
    const r = analyzeFixture("chargeback-adjustment.json");
    expect(r.events[0]).toMatchObject({ stage: "dispute", outcome: "unknown" });
    expect(r.events[0]!.attributes.adjustmentAction).toBe("chargeback");
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("does not treat a credit as a refund", () => {
    const r = analyze(json(notification("adjustment.created", adjustment({ action: "credit" }))));
    expect(r.events[0]).toMatchObject({ stage: "other", outcome: "success" });
  });

  it("reports a rejected refund as a failed refund and an unknown action honestly", () => {
    const rejected = analyze(
      json(notification("adjustment.updated", adjustment({ status: "rejected" }))),
    );
    expect(rejected.events[0]).toMatchObject({ stage: "refund", outcome: "failure" });
    const unknown = analyze(
      json(notification("adjustment.created", adjustment({ action: "PPLsynth_new_action" }))),
    );
    expect(unknown.events[0]).toMatchObject({ stage: "other", outcome: "unknown" });
    expect(unknown.events[0]!.attributes.actionKnown).toBe(false);
  });

  it("decodes a renewal decline once and shows past due as overdue, not as a second failure", () => {
    const r = analyzeFixture("renewal-past-due.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["transaction.payment_failed", "failure"],
      ["transaction.past_due", "pending"],
      ["subscription.past_due", "pending"],
    ]);
    expect(r.events[0]!.isRecurring).toBe(true);
    expect(r.errors.map((e) => e.code)).toEqual(["declined"]);
    expect(r.findings.filter((f) => f.ruleId === "RECURRING_PAYMENT_FAILED")).toHaveLength(1);
    // A subscription id spans many payments; renewals are not grouped by it.
    expect(r.groups).toHaveLength(2);
  });

  it("recognizes a duplicate delivery by event_id across destinations", () => {
    const r = analyzeFixture("duplicate-webhook.json");
    expect(r.events).toHaveLength(2);
    expect(new Set(r.events.map((e) => e.deliveryKey)).size).toBe(1);
    expect(new Set(r.events.map((e) => e.attributes.notificationId)).size).toBe(2);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it("reports the signature header's presence only", () => {
    const text = fixture("paddle/webhook-http-signed.txt");
    const r = analyze(text);
    expect(r.events[0]!.attributes.signatureHeaderPresent).toBe(true);
    expect(r.events[0]).toMatchObject({ eventType: "transaction.paid", outcome: "success" });
    expect(json(r.events)).not.toContain("PPLSYNTH0000000000");
    expect(toJsonReport(r)).not.toContain("PPLSYNTH0000000000");
  });

  it("keeps an unknown transaction event type with the status's meaning", () => {
    const r = analyze(json(notification("transaction.pplsynth_new", txn({ status: "billed" }))));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "payment",
      outcome: "pending",
    });
  });

  it("reports a payment_failed event without an error code with insufficient confidence", () => {
    const r = analyze(json(notification("transaction.payment_failed", txn({ status: "ready" }))));
    expect(r.errors[0]).toMatchObject({
      code: "payment_failed",
      category: "unknown",
      confidence: "insufficient",
    });
  });

  it("keeps an undocumented attempt error code unknown", () => {
    const r = analyze(
      json(
        notification(
          "transaction.payment_failed",
          txn({ status: "ready", payments: [attempt({ error_code: "pplsynth_new_code" })] }),
        ),
      ),
    );
    expect(r.errors[0]).toMatchObject({
      code: "pplsynth_new_code",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it("does not decode the payment history of non-failure events", () => {
    const r = analyze(
      json(
        notification(
          "transaction.completed",
          txn({
            payments: [attempt({ status: "captured", error_code: null }), attempt()],
          }),
        ),
      ),
    );
    expect(r.errors).toHaveLength(0);
  });

  it("does not analyze events outside the payment flow", () => {
    const r = analyzeFixture("customer-event.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "paddle.notification.other",
    });
    expect(r.events).toHaveLength(0);
    expect(json(r)).not.toContain("pplsynth-customer@example.invalid");
  });
});

describe("paddle entity responses", () => {
  it("emits the transaction snapshot and one event per payment attempt", () => {
    const r = analyzeFixture("transaction-entity-retried.json");
    const kinds = r.events.map((e) => [e.eventType, e.providerStatus, e.stage, e.outcome]);
    expect(kinds).toEqual([
      ["transaction.snapshot", "completed", "payment", "success"],
      ["payment_attempt.snapshot", "error", "payment", "failure"],
      ["payment_attempt.snapshot", "captured", "capture", "success"],
    ]);
    expect(r.events[2]).toMatchObject({
      relatedReference: "PPLsynth-attempt-0702",
      eventTimestamp: "2026-11-05T09:02:03.000Z",
    });
    expect(r.events[2]!.attributes).toMatchObject({
      timestampField: "captured_at",
      methodType: "card",
    });
    expect(r.errors.map((e) => [e.code, e.attemptReference])).toEqual([
      ["expired_card", "PPLsynth-attempt-0701"],
    ]);
    expect(r.groups).toHaveLength(1);
  });

  it("reads a subscription snapshot with its cancellation time", () => {
    const r = analyzeFixture("subscription-entity.json");
    expect(r.events[0]).toMatchObject({
      eventType: "subscription.snapshot",
      stage: "cancellation",
      outcome: "success",
      eventTimestamp: "2026-11-20T00:00:00.000Z",
      subscriptionReference: "sub_PPLsynth0801",
    });
    expect(json(r.events)).not.toContain("example.invalid");
  });

  it("reads an adjustment snapshot", () => {
    const r = analyze(json({ data: adjustment(), meta: { request_id: "PPLsynth-r" } }));
    expect(r.events[0]).toMatchObject({
      eventType: "adjustment.snapshot",
      stage: "refund",
      outcome: "success",
      eventTimestamp: "2026-11-02T11:00:00.000Z",
      paymentReference: "txn_PPLsynthTest01",
    });
  });

  it("recognizes list responses without analyzing them", () => {
    const r = analyzeFixture("list-transactions.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "paddle.list" });
  });

  it("keeps an unknown transaction status unknown", () => {
    const r = analyze(
      json({ data: txn({ status: "pplsynth_status" }), meta: { request_id: "r" } }),
    );
    expect(r.events[0]).toMatchObject({ outcome: "unknown" });
    expect(r.events[0]!.attributes.statusKnown).toBe(false);
  });

  it("reports missing required fields as parse issues without throwing", () => {
    const r = analyze(
      json({ data: { id: "txn_PPLsynth1", status: 5 }, meta: { request_id: "r" } }),
    );
    expect(r.events).toHaveLength(0);
    const adj = analyze(
      json(notification("adjustment.created", { id: "adj_PPLsynth1", status: "approved" })),
    );
    expect(adj.records[0]!.status).toBe("invalid");
  });

  it("does not throw on malformed input", () => {
    const r = analyzeText('{"event_id": "evt_PPLsynth", "data": ', {
      adapters: [paddleAdapter],
      rules: defaultRules,
      catalogVersion: "test",
    });
    expect(r.ok).toBe(false);
    for (const format of ["paddle.notification", "paddle.entity", "paddle.error", "x"])
      for (const input of [null, 42, "x", [], { data: [] }, { error: null }])
        expect(paddleAdapter.parse(input, format).ok).toBe(false);
  });
});

describe("paddle API errors", () => {
  it("decodes a validation error with its field names", () => {
    const r = analyzeFixture("api-error-invalid-field.json");
    expect(r.errors[0]).toMatchObject({
      code: "invalid_field",
      category: "invalid_request",
      retry: "do_not_retry",
      subCodes: { type: "request_error", fields: "items,currency_code" },
      providerMessage: "Request does not pass validation.",
    });
    expect(r.errors[0]!.documentation[0]!.url).toBe(
      "https://developer.paddle.com/errors/shared/invalid_field",
    );
  });

  it("treats authentication failures as configuration problems", () => {
    const r = analyze(json(apiError("invalid_token")));
    expect(r.errors[0]).toMatchObject({ category: "configuration", retry: "do_not_retry" });
  });

  it("only marks a retry as safe where Paddle says the request was not processed", () => {
    const internal = analyzeFixture("api-error-internal.txt");
    expect(internal.errors[0]).toMatchObject({
      code: "internal_error",
      retry: "safe_to_retry_technical_request",
      outcomeKnown: true,
    });
    expect(ruleIds(internal)).not.toContain("POSSIBLE_RETRY_RISK");

    const provider = analyzeFixture("api-error-provider-unavailable.json");
    expect(provider.errors[0]).toMatchObject({
      code: "subscription_payment_provider_unavailable",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(provider.errors[0]!.outcomeKnown).toBeUndefined();
    expect(ruleIds(provider)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("reads Retry-After for rate limiting", () => {
    const r = analyzeFixture("api-error-rate-limited.txt");
    expect(r.errors[0]).toMatchObject({ code: "too_many_requests", category: "rate_limiting" });
    expect(r.errors[0]!.retryExplanation).toContain("Retry-After: 30 seconds");
    expect(r.events[0]!.attributes.retryAfterSeconds).toBe(30);
  });

  it("decodes a subscription charge decline and a pending refund conflict", () => {
    expect(analyzeFixture("api-error-subscription-declined.json").errors[0]).toMatchObject({
      category: "card_declined",
      retry: "customer_action_required",
    });
    expect(analyzeFixture("api-error-refund-pending.json").errors[0]).toMatchObject({
      category: "duplicate_request",
      retry: "retry_conditionally",
    });
  });

  it("keeps uncatalogued codes unknown and links only Paddle's own reference page", () => {
    const r = analyzeFixture("api-error-uncatalogued-code.json");
    expect(r.errors[0]).toMatchObject({
      code: "customer_already_exists",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://developer.paddle.com/errors/customers/customer_already_exists",
    );
    const foreign = analyze(
      json(apiError("pplsynth_code", { documentation_url: "https://example.invalid/x" })),
    );
    expect(foreign.errors[0]!.documentation.map((d) => d.url)).not.toContain(
      "https://example.invalid/x",
    );
  });

  it("notes an HTTP status that differs from the documented one", () => {
    const text = `HTTP/1.1 400 Bad Request\nContent-Type: application/json\n\n${json(apiError("not_found"))}\n`;
    const r = analyze(text);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/differs from the status/);
  });
});

describe("paddle correlation and redaction", () => {
  it("keeps unrelated transactions apart", () => {
    const r = analyze(
      json([
        notification("transaction.paid", txn({ id: "txn_PPLsynthA" }), {
          event_id: "evt_PPLsynthA",
        }),
        notification("transaction.paid", txn({ id: "txn_PPLsynthB" }), {
          event_id: "evt_PPLsynthB",
        }),
      ]),
    );
    expect(r.groups).toHaveLength(2);
  });

  it("does not link payments through customer or address ids", () => {
    const shared = { customer_id: "ctm_PPLsynthShared", address_id: "add_PPLsynthShared" };
    const r = analyze(
      json([
        notification("transaction.paid", txn({ id: "txn_PPLsynthC", ...shared }), {
          event_id: "evt_PPLsynthC",
        }),
        notification("transaction.paid", txn({ id: "txn_PPLsynthD", ...shared }), {
          event_id: "evt_PPLsynthD",
        }),
      ]),
    );
    expect(r.groups).toHaveLength(2);
    expect(json(r.events)).not.toContain("ctm_PPLsynthShared");
  });

  it("never copies card, personal or free-text fields", () => {
    const planted = {
      custom_data: { note: "PPLsynth-planted-custom" },
      billing_details: { purchase_order_number: "PPLsynth-planted-po" },
      checkout: { url: "https://example.invalid/PPLsynth-planted-checkout" },
      payments: [
        attempt({
          method_details: {
            type: "card",
            card: {
              type: "visa",
              last4: "4321",
              expiry_month: 9,
              expiry_year: 2032,
              cardholder_name: "PPLsynth Planted Holder",
            },
            paypal: {
              email: "pplsynth-planted@example.invalid",
              reference: "PPLsynth-planted-ref",
            },
          },
        }),
      ],
    };
    const r = analyze(
      json([
        notification("transaction.payment_failed", txn({ status: "ready", ...planted })),
        { data: txn(planted), meta: { request_id: "PPLsynth-r" } },
        notification("adjustment.created", adjustment({ reason: "PPLsynth-planted-reason" }), {
          event_id: "evt_PPLsynthAdj",
        }),
      ]),
    );
    const out = json(r.events) + json(r.errors) + toJsonReport(r);
    for (const secret of [
      "PPLsynth-planted-custom",
      "PPLsynth-planted-po",
      "PPLsynth-planted-checkout",
      "4321",
      "PPLsynth Planted Holder",
      "pplsynth-planted@example.invalid",
      "PPLsynth-planted-ref",
      "PPLsynth-planted-reason",
    ])
      expect(out, secret).not.toContain(secret);
  });
});
