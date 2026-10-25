import { readdirSync, readFileSync, statSync } from "node:fs";
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
  type RecordMeta,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  ERROR_CODES,
  PAYMENT_REASONS,
  PAYOUT_REASONS,
  RAZORPAY_ADAPTER_VERSION,
  SOURCES,
  STEPS,
  WEBHOOK_EVENTS,
  X_API_REASONS,
  razorpayAdapter,
  razorpayManifest,
} from "@pandapaylens/razorpay";
import defaultExport from "@pandapaylens/razorpay";
import { razorpayManifest as manifestOnly } from "@pandapaylens/razorpay/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [razorpayAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`razorpay/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;

const T = 1792836000;
const PAY = "pay_PPLsynth-Test01";
const ORDER = "order_PPLsynth-Test01";

const apiError = (fields: Record<string, unknown> = {}) => ({
  error: {
    code: "BAD_REQUEST_ERROR",
    description: "Synthetic description",
    field: null,
    source: "customer",
    step: "payment_authentication",
    reason: "incorrect_otp",
    metadata: { payment_id: PAY, order_id: ORDER },
    ...fields,
  },
});

const payment = (fields: Record<string, unknown> = {}) => ({
  id: PAY,
  entity: "payment",
  amount: 10000,
  currency: "INR",
  status: "captured",
  order_id: ORDER,
  method: "card",
  captured: true,
  amount_refunded: 0,
  refund_status: null,
  error_code: null,
  error_description: null,
  error_source: null,
  error_step: null,
  error_reason: null,
  created_at: T,
  ...fields,
});

const failedPayment = (reason: string, fields: Record<string, unknown> = {}) =>
  payment({
    status: "failed",
    captured: false,
    error_code: "BAD_REQUEST_ERROR",
    error_description: "Synthetic description",
    error_source: "customer",
    error_step: "payment_authentication",
    error_reason: reason,
    ...fields,
  });

const webhook = (event: string, payload: Record<string, unknown>, created = T) => ({
  entity: "event",
  account_id: "acc_PPLsynth-Merch01",
  event,
  contains: Object.keys(payload),
  payload: Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, { entity: v }])),
  created_at: created,
});

const payout = (status: string, reason: string | null, fields: Record<string, unknown> = {}) => ({
  id: "pout_PPLsynth-Test01",
  entity: "payout",
  fund_account_id: "fa_PPLsynth-Test01",
  amount: 100000,
  currency: "INR",
  status,
  mode: "IMPS",
  purpose: "payout",
  status_details: reason ? { description: "Synthetic", source: "business", reason } : null,
  created_at: T,
  ...fields,
});

const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");

const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));

describe("razorpay detection", () => {
  it.each([
    [apiError(), "razorpay.api_error", 0.9],
    [{ statusCode: 400, ...apiError() }, "razorpay.api_error", 0.92],
    [payment(), "razorpay.payment", 0.98],
    [failedPayment("card_declined", { id: "PPLsynth-noprefix" }), "razorpay.payment", 0.63],
    [
      { id: "order_PPLsynth-1", entity: "order", status: "paid", amount_paid: 1, amount_due: 0 },
      "razorpay.order",
      0.85,
    ],
    [
      { id: "rfnd_PPLsynth-1", entity: "refund", payment_id: PAY, status: "processed" },
      "razorpay.refund",
      0.85,
    ],
    [
      { id: "disp_PPLsynth-1", entity: "dispute", payment_id: PAY, status: "open", phase: "fraud" },
      "razorpay.dispute",
      0.9,
    ],
    [
      { id: "setl_PPLsynth-1", entity: "settlement", status: "processed" },
      "razorpay.settlement",
      0.75,
    ],
    [payout("processed", null), "razorpay.payout", 0.87],
    [{ entity: "collection", count: 1, items: [payment()] }, "razorpay.collection", 0.92],
    [webhook("payment.captured", { payment: payment() }), "razorpay.webhook", 0.98],
    [{ entity: "event", event: "payment.captured", payload: {} }, "razorpay.webhook", 0.55],
  ])("detects %j", (input, format, confidence) => {
    expect(razorpayAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("uses the webhook headers only as supporting evidence", () => {
    const meta: RecordMeta = {
      format: "http",
      http: {
        kind: "request",
        method: "POST",
        headers: { "x-razorpay-signature": "[redacted]", "x-razorpay-event-id": "PPLsynthEvt" },
      },
    };
    const r = razorpayAdapter.detect(
      { entity: "event", event: "payment.captured", contains: ["payment"], payload: {} },
      meta,
    );
    expect(r.reasons).toContain("has an x-razorpay-signature or x-razorpay-event-id header");
    expect(razorpayAdapter.detect({ payload: {} }, meta).confidence).toBe(0);
  });

  it.each([
    { error: { code: "BAD_REQUEST_ERROR" } },
    { error: { code: "BAD_REQUEST_ERROR", description: "x" } },
    { error: { code: "SOMETHING_ERROR", description: "x", reason: "y" } },
    { error: { message: "x" } },
    { error: "BAD_REQUEST_ERROR" },
    { status: "failed" },
    { status: "failed", error_reason: "card_declined" },
    { entity: "payment", status: "failed" },
    { entity: "payment", id: "x", status: "captured", amount: 100 },
    { entity: "order", status: "paid" },
    { entity: "event", payload: {} },
    { entity: "event", event: "payment.failed" },
    { event: "payment.failed", contains: ["payment"], payload: {} },
    { entity: "collection", items: [] },
    { entity: "collection", items: [{ entity: "invoice" }] },
    { id: "pay_PPLsynthTestPayment" },
    { id: PAY, status: "captured", amount: 100 },
    { reason: "card_declined", source: "customer", step: "payment_authorization" },
  ])("does not claim the generic shape %j above 0.5", (input) => {
    expect(razorpayAdapter.detect(input).confidence).toBeLessThanOrEqual(0.5);
  });

  it("ignores Stripe, Mollie, Checkout.com and form data", () => {
    expect(
      razorpayAdapter.detect({ object: "event", ...webhook("payment.failed", {}) }).confidence,
    ).toBe(0);
    expect(
      razorpayAdapter.detect({ error: { type: "card_error", code: "BAD_REQUEST_ERROR" } })
        .confidence,
    ).toBe(0);
    expect(
      razorpayAdapter.detect({
        resource: "event",
        type: "payment.failed",
        entityId: "tr_PPLsynth",
        _embedded: { entity: {} },
      }).confidence,
    ).toBe(0);
    expect(
      razorpayAdapter.detect({ id: "pay_PPLsynthAbcdefghijklmnopqrstu", status: "Authorized" })
        .confidence,
    ).toBe(0);
    expect(
      razorpayAdapter.detect({ request_id: "x", error_type: "request_invalid", error: {} })
        .confidence,
    ).toBe(0);
    expect(razorpayAdapter.detect(payment(), { format: "form" }).confidence).toBe(0);
    expect(razorpayAdapter.detect([payment()]).confidence).toBe(0);
    expect(razorpayAdapter.detect("payment.failed").confidence).toBe(0);
    expect(razorpayAdapter.detect(null).confidence).toBe(0);
  });

  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "razorpay" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );

  it("includes the Stripe, Adyen, Checkout.com and Mollie fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "checkout", "mollie"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    let checked = 0;
    for (const file of readdirSync(`${root}${dir}`)) {
      const parsed = parseInput(readFileSync(`${root}${dir}/${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          razorpayAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("analyzes every Razorpay fixture", () => {
    const dir = `${root}razorpay`;
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const file of files) {
      const text = readFileSync(`${dir}/${file}`, "utf8");
      const r = analyze(text);
      for (const rec of r.records)
        expect(rec.status, `${file} record ${rec.recordIndex}`).toBe("analyzed");
      if (/\b(?:pay|order|rfnd|disp|setl|pout|acc)_/.test(text))
        expect(text, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });

  it("recognizes Checkout handler fields without analyzing them", () => {
    const r = analyze(
      json({
        razorpay_payment_id: PAY,
        razorpay_order_id: ORDER,
        razorpay_signature: "pplsynthsignaturevalue0000000000000000000000000000000000000000",
      }),
    );
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "razorpay.checkout_callback",
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/verified on the server/);
    expect(r.events).toEqual([]);
    expect(toJsonReport(r)).not.toMatch(/pplsynthsignaturevalue/);

    const form = analyze(
      `razorpay_payment_id=${PAY}&razorpay_order_id=${ORDER}&razorpay_signature=pplsynthsig`,
    );
    expect(form.records[0]).toMatchObject({ status: "unsupported" });
  });

  it("recognizes server-to-server creation responses without analyzing them", () => {
    const r = analyze(
      json({
        razorpay_payment_id: PAY,
        next: [
          { action: "intent", url: "upi://pay?pa=pplsynth@upi" },
          { action: "poll", url: "https://example.invalid/v1/payments/x" },
        ],
      }),
    );
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "razorpay.s2s_create" });
    expect(r.events).toEqual([]);
  });
});

describe("razorpay parsing", () => {
  it("reports missing required webhook fields as parse issues without throwing", () => {
    const { event: _e, ...noEvent } = webhook("payment.captured", { payment: payment() });
    const r = analyze(json(noEvent));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "razorpay.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/event/);
    expect(r.events).toEqual([]);

    const { status: _s, ...noStatus } = payment();
    const r2 = analyze(json(webhook("payment.captured", { payment: noStatus })));
    expect(r2.records[0]!.status).toBe("invalid");
    expect(r2.records[0]!.reasons.join(" ")).toMatch(/payload\.payment\.entity\.status/);

    const r3 = analyze(json(webhook("refund.processed", { payment: payment() })));
    expect(r3.records[0]!.status).toBe("invalid");
    expect(r3.records[0]!.reasons.join(" ")).toMatch(/payload\.refund\.entity: required/);

    const r4 = analyze(
      json(webhook("order.paid", { order: { id: ORDER, entity: "order", status: "paid" } })),
    );
    expect(r4.records[0]!.reasons.join(" ")).toMatch(/payload\.payment\.entity: required/);
  });

  it("reports malformed fields as parse issues", () => {
    const r = analyze(json(payment({ amount: "100.00" })));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "razorpay.payment" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/amount/);
    const c = analyze(
      json({ entity: "collection", items: [payment(), payment({ captured: "yes" })] }),
    );
    expect(c.records[0]).toMatchObject({ status: "invalid", format: "razorpay.collection" });
    expect(c.records[0]!.reasons.join(" ")).toMatch(/items\.1\.captured/);
    const e = analyze(json(apiError({ metadata: "PPLsynth" })));
    expect(e.records[0]).toMatchObject({ status: "invalid", format: "razorpay.api_error" });
  });

  it("returns issues for an unknown format instead of throwing", () => {
    expect(razorpayAdapter.parse({}, "razorpay.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported Razorpay format "razorpay.unknown".'],
    });
  });

  it("does not analyze malformed JSON", () => {
    const bad = analyzeText('{"entity": "event", "event": "payment.failed", "payload": {', options);
    expect(bad.ok).toBe(false);
  });

  it("accepts the documentation's trailing commas and comments, with a warning", () => {
    const r = analyze(`{
      "error": {
        "code": "BAD_REQUEST_ERROR", // inline comment as in some examples
        "description": "Synthetic",
        "source": "customer",
        "step": "payment_authentication",
        "reason": "incorrect_otp",
        "metadata": {},
      },
    }`);
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
  });
});

describe("razorpay payment responses", () => {
  it("normalizes a captured card payment without copying sensitive fields", () => {
    const r = analyzeFixture("payment-captured-card.json");
    expect(r.errors).toEqual([]);
    expect(r.events[0]).toMatchObject({
      sourceFormat: "razorpay.payment",
      eventType: "payment.snapshot",
      eventTypeKnown: true,
      stage: "capture",
      outcome: "success",
      providerStatus: "captured",
      paymentReference: "pay_PPLsynth-Card01",
      relatedReference: "order_PPLsynth-Card01",
      amountMinor: "125000",
      currency: "INR",
      attributes: {
        entity: "payment",
        method: "card",
        captured: true,
        cardNetwork: "Visa",
        cardType: "credit",
        fee: "2950",
        tax: "450",
        acquirerReferencePresent: true,
        createdAt: "2026-10-24T10:00:00.000Z",
      },
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
  });

  it.each([
    ["created", "payment", "pending"],
    ["authorized", "authorization", "success"],
    ["captured", "capture", "success"],
    ["refunded", "refund", "success"],
    ["failed", "payment", "failure"],
    ["something_new", "payment", "unknown"],
  ])("maps payment status %s without inventing a final state", (status, stage, outcome) => {
    expect(firstEvent(payment({ status }))).toMatchObject({
      stage,
      outcome,
      providerStatus: status,
    });
  });

  it("decodes a failed payment's flat error fields", () => {
    const r = analyzeFixture("payment-failed-incorrect-otp.json");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.events[0]!.attributes).toMatchObject({
      errorSource: "customer",
      errorStep: "payment_authentication",
      errorReason: "incorrect_otp",
    });
    expect(r.errors[0]).toMatchObject({
      code: "incorrect_otp",
      category: "authentication_failed",
      retry: "customer_action_required",
      confidence: "strong",
      paymentReference: "pay_PPLsynth-Otp01",
      attemptReference: "pay_PPLsynth-Otp01",
      subCodes: {
        error_code: "BAD_REQUEST_ERROR",
        source: "customer",
        step: "payment_authentication",
        table: "payment",
      },
    });
    expect(r.errors[0]!.explanation).toMatch(/Wrong OTP\. Razorpay names the customer/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("places failures at the authorization and capture steps", () => {
    expect(
      firstEvent(failedPayment("card_declined", { error_step: "payment_authorization" })).stage,
    ).toBe("authorization");
    const r = analyze(
      json([
        webhook(
          "payment.authorized",
          { payment: payment({ status: "authorized", captured: false }) },
          T,
        ),
        webhook(
          "payment.failed",
          {
            payment: failedPayment("capture_failed", {
              error_source: "business",
              error_step: "payment_capture",
            }),
          },
          T + 60,
        ),
      ]),
    );
    expect(r.events.map((e) => e.stage)).toEqual(["authorization", "capture"]);
    expect(ruleIds(r)).toContain("CAPTURE_FAILED_AFTER_AUTHORIZATION");
    expect(r.errors[0]).toMatchObject({ code: "capture_failed", confidence: "possible" });
    expect(r.errors[0]!.explanation).toMatch(/pages disagree/);
  });

  it("is honest about a failed payment without a reason", () => {
    const e = firstError(payment({ status: "failed", captured: true, error_code: "" }));
    expect(e).toMatchObject({
      code: "failed",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(e.missingInformation.join(" ")).toMatch(/no error_code or error_reason/);
  });

  it("flags error fields left on a payment that is not failed", () => {
    const e = firstError(
      payment({
        status: "captured",
        error_code: "BAD_REQUEST_ERROR",
        error_reason: "payment_failed",
      }),
    );
    expect(e.missingInformation.join(" ")).toMatch(/status is "captured", not failed/);
  });

  it("normalizes order, refund, dispute and settlement snapshots", () => {
    expect(
      firstEvent({
        id: ORDER,
        entity: "order",
        status: "attempted",
        amount: 5000,
        amount_paid: 0,
        amount_due: 5000,
        currency: "INR",
        attempts: 2,
        receipt: "PPLsynth-Receipt-Secret",
      }),
    ).toMatchObject({
      eventType: "order.snapshot",
      stage: "payment",
      outcome: "pending",
      relatedReference: ORDER,
      attributes: { attempts: 2, amountDue: "5000" },
    });
    expect(
      firstEvent({
        id: "rfnd_PPLsynth-1",
        entity: "refund",
        payment_id: PAY,
        status: "pending",
        amount: 100,
        currency: "INR",
      }),
    ).toMatchObject({
      stage: "refund",
      outcome: "pending",
      paymentReference: PAY,
      relatedReference: "rfnd_PPLsynth-1",
    });
    expect(
      firstEvent({
        id: "disp_PPLsynth-1",
        entity: "dispute",
        payment_id: PAY,
        status: "under_review",
        phase: "pre_arbitration",
        reason_code: "chargeback",
      }),
    ).toMatchObject({
      stage: "dispute",
      outcome: "pending",
      attributes: { phase: "pre_arbitration", reasonCode: "chargeback" },
    });
    const s = firstEvent({
      id: "setl_PPLsynth-1",
      entity: "settlement",
      status: "failed",
      amount: 1,
    });
    expect(s).toMatchObject({ stage: "settlement", outcome: "failure" });
    expect(s.paymentReference).toBeUndefined();
  });

  it("keeps two attempts on one order in one group", () => {
    const r = analyzeFixture("order-payments-collection.json");
    expect(r.events.map((e) => [e.paymentReference, e.outcome, e.source.path])).toEqual([
      ["pay_PPLsynth-Coll02", "success", "items[0]"],
      ["pay_PPLsynth-Coll01", "failure", "items[1]"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "payment_cancelled",
      confidence: "strong",
      source: { path: "items[1]" },
    });
    expect(r.errors[0]!.explanation).toMatch(/bank downtime/);
  });
});

describe("razorpay error decoding", () => {
  it("decodes an issuer decline from the API error envelope", () => {
    const r = analyzeFixture("api-error-card-declined.json");
    expect(r.events[0]).toMatchObject({
      eventType: "api_error.card_declined",
      stage: "error",
      outcome: "failure",
      paymentReference: "pay_PPLsynth-Decl01",
      relatedReference: "order_PPLsynth-Decl01",
    });
    expect(r.errors[0]).toMatchObject({
      code: "card_declined",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      paymentReference: "pay_PPLsynth-Decl01",
      attemptReference: "pay_PPLsynth-Decl01",
      providerMessage: "Payment declined by the issuing bank (synthetic text).",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toEqual(
      expect.arrayContaining([
        "https://razorpay.com/docs/errors/payments/list/",
        "https://razorpay.com/docs/errors/payments/cards/",
        "https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/",
      ]),
    );
  });

  it("decodes a validation error with its field", () => {
    const r = analyzeFixture("api-error-validation.json");
    expect(r.events[0]).toMatchObject({ outcome: "unknown", attributes: { field: "amount" } });
    expect(r.errors[0]).toMatchObject({
      code: "input_validation_failed",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { field: "amount", source: "business" },
    });
    expect(r.errors[0]!.nextAction).toMatch(/merchant's own integration/);
  });

  it("treats a server error as an unknown outcome", () => {
    const r = analyzeFixture("api-error-server-error-http.txt");
    expect(r.errors[0]).toMatchObject({
      code: "SERVER_ERROR",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      subCodes: { http_status: "500", table: "error_code" },
    });
    // NA placeholders are not shown as source or step.
    expect(r.errors[0]!.subCodes.source).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/late/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes an invalid API key from the HTTP status and description", () => {
    const r = analyzeFixture("api-error-invalid-key-http.txt");
    expect(r.errors[0]).toMatchObject({
      code: "BAD_REQUEST_ERROR",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "possible",
      subCodes: { table: "common", http_status: "401" },
    });
  });

  it("decodes throttling as a rejected request", () => {
    const e = analyze(
      httpResponse(429, {
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Too many requests",
          source: "NA",
          step: "NA",
          reason: "NA",
          metadata: {},
        },
      }),
    ).errors[0]!;
    expect(e).toMatchObject({
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
      outcomeKnown: true,
    });
  });

  it("reads the undocumented sample reason invalid_otp like incorrect_otp", () => {
    const r = analyzeFixture("api-error-sdk-invalid-otp.json");
    expect(r.errors[0]).toMatchObject({
      code: "invalid_otp",
      category: "authentication_failed",
      confidence: "possible",
      subCodes: { http_status: "400" },
    });
    expect(r.errors[0]!.explanation).toMatch(/none of its reason tables/);
  });

  it("keeps an undocumented reason honest", () => {
    const e = firstError(apiError({ reason: "pplsynth_new_reason" }));
    expect(e).toMatchObject({
      code: "pplsynth_new_reason",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      subCodes: { table: "unknown" },
    });
    expect(e.missingInformation.join(" ")).toMatch(/top error reasons/);
    const none = firstError({
      error: { code: "PPLSYNTH_ERROR", source: "x", step: "y", reason: null },
    });
    expect(none).toMatchObject({ code: "PPLSYNTH_ERROR", confidence: "insufficient" });
  });

  it("flags undocumented source and step values", () => {
    const e = firstError(apiError({ source: "pplsynth_party", step: "pplsynth_step" }));
    expect(e.missingInformation.join(" ")).toMatch(/Source "pplsynth_party" is not among/);
    expect(e.missingInformation.join(" ")).toMatch(/Step "pplsynth_step" is not among/);
  });

  it("decodes BAD_REQUEST_ERROR without a reason honestly", () => {
    const e = firstError({
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Synthetic",
        source: null,
        step: null,
        reason: null,
      },
    });
    expect(e).toMatchObject({ category: "unknown", retry: "unknown", confidence: "possible" });
    expect(e.missingInformation.join(" ")).toMatch(/No reason was supplied/);
  });

  it.each(Object.keys(PAYMENT_REASONS))("decodes the documented payment reason %s", (reason) => {
    const e = firstError(apiError({ reason }));
    const entry = PAYMENT_REASONS[reason]!;
    expect(e.code).toBe(reason);
    expect(e.category).toBe(entry.category);
    expect(e.retry).toBe(entry.retry);
    expect(["strong", "possible"]).toContain(e.confidence);
    expect(e.documentation.length).toBeGreaterThan(0);
  });

  describe("decodes the same reason by entity", () => {
    it("reads insufficient_funds as the customer's balance on a payment", () => {
      const e = firstError(failedPayment("insufficient_funds"));
      expect(e).toMatchObject({
        category: "insufficient_funds",
        retry: "customer_action_required",
        subCodes: { table: "payment" },
        confidence: "strong",
      });
      expect(e.explanation).toMatch(/customer's account/);
    });

    it("reads insufficient_funds as the merchant's balance on a payout", () => {
      const e = firstError(payout("reversed", "insufficient_funds"));
      expect(e).toMatchObject({
        code: "insufficient_funds",
        retry: "manual_review",
        subCodes: { table: "payout_status", status: "reversed", source: "business" },
        confidence: "strong",
      });
      expect(e.explanation).toMatch(/merchant's RazorpayX account/);
    });

    it("shows both readings when an API error has no payment context", () => {
      const e = firstError(apiError({ reason: "insufficient_funds", metadata: {} }));
      expect(e).toMatchObject({ subCodes: { table: "payment" }, confidence: "possible" });
      expect(e.explanation).toMatch(/RazorpayX API .* means instead/);
    });

    it("reads authentication_failed on HTTP 401 as a RazorpayX OAuth error", () => {
      const body = apiError({
        reason: "authentication_failed",
        source: "business",
        step: null,
        metadata: {},
      });
      const e = analyze(httpResponse(401, body)).errors[0]!;
      expect(e).toMatchObject({
        category: "configuration",
        subCodes: { table: "razorpayx_api" },
        confidence: "possible",
      });
      expect(e.explanation).toMatch(/In a payment, the same reason means/);
      const p = firstError(apiError({ reason: "authentication_failed" }));
      expect(p).toMatchObject({
        category: "authentication_failed",
        subCodes: { table: "payment" },
      });
    });

    it("decodes RazorpayX-only API reasons", () => {
      expect(
        firstError(apiError({ reason: "payout_approval_not_allowed", metadata: {} })),
      ).toMatchObject({
        category: "invalid_request",
        retry: "do_not_retry",
        confidence: "strong",
        subCodes: { table: "razorpayx_api" },
      });
      const gw = analyze(
        httpResponse(502, {
          error: {
            code: "GATEWAY_ERROR",
            description: "x",
            source: "internal",
            step: null,
            reason: "gateway_error",
            metadata: {},
          },
        }),
      ).errors[0]!;
      expect(gw).toMatchObject({ category: "provider_unavailable", retry: "retry_conditionally" });
      expect(gw.retryExplanation).toMatch(/X-Payout-Idempotency/);
    });
  });
});

describe("razorpay webhooks", () => {
  it("builds one timeline for a card payment, its order and a partial refund", () => {
    const r = analyzeFixture("webhook-card-lifecycle.json");
    expect(
      r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus, e.amountMinor]),
    ).toEqual([
      ["payment.authorized", "authorization", "success", "authorized", "125000"],
      ["payment.captured", "capture", "success", "captured", "125000"],
      ["order.paid", "payment", "success", "paid", "125000"],
      ["refund.created", "refund", "pending", "pending", "25000"],
      ["refund.processed", "refund", "success", "processed", "25000"],
    ]);
    expect(r.events[0]!.eventTimestamp).toBe("2026-10-24T10:00:02.000Z");
    expect(r.events[2]!.attributes).toMatchObject({
      paymentStatus: "captured",
      orderAmountDue: "0",
    });
    expect(r.groups).toHaveLength(1);
    expect(r.errors).toEqual([]);
    // No body-only delivery key: the event id travels in a header.
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(ruleIds(r)).not.toContain("REFUND_PENDING");
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("allows failed, then authorized and captured for one payment (late authorisation)", () => {
    const r = analyzeFixture("webhook-late-authorisation.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payment.failed", "failure"],
      ["payment.authorized", "success"],
      ["payment.captured", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "payment_timed_out",
      category: "network_or_timeout",
      source: { path: "payload.payment.entity" },
    });
  });

  it("uses the x-razorpay-event-id header as the delivery key of a raw request", () => {
    const r = analyzeFixture("webhook-payment-failed-http.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.failed",
      stage: "authorization",
      outcome: "failure",
      eventReference: "PPLsynthEvt0001",
      deliveryKey: "PPLsynthEvt0001",
      attributes: { signatureHeader: "present_not_verified", bank: "HDFC" },
    });
    expect(r.errors[0]).toMatchObject({ code: "payment_failed", subCodes: { source: "bank" } });
    expect(json(r)).not.toMatch(/pplsynth0000000/);
  });

  it("reports a repeated delivery with the same event id", () => {
    const text = fixture("razorpay/webhook-payment-failed-http.txt");
    const r = analyzeSources(
      [
        { name: "first", text },
        { name: "second", text },
      ],
      options,
    );
    if (!r.ok) throw new Error(r.error.message);
    expect(r.result.events).toHaveLength(2);
    expect(ruleIds(r.result)).toContain("DUPLICATE_DELIVERY");
    const finding = r.result.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(finding.explanation).toMatch(/Razorpay documents that it can deliver/);
  });

  it("does not invent a delivery key for a pasted body", () => {
    const body = webhook("payment.captured", { payment: payment() });
    const r = analyze(json([body, body]));
    expect(r.events).toHaveLength(2);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    // No delivery id: identical copies are reported only as a possible repeat.
    expect(r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")).toMatchObject({
      confidence: "possible",
    });
  });

  it("reads delivery metadata only from a request", () => {
    const body = webhook("payment.captured", { payment: payment() });
    const meta: RecordMeta = {
      format: "http",
      http: { kind: "response", status: 200, headers: { "x-razorpay-event-id": "PPLsynthEvt9" } },
    };
    const r = analyzeRecords([body], options, [meta]);
    if (!r.ok) throw new Error("analysis failed");
    expect(r.result.events[0]!.deliveryKey).toBeUndefined();
    expect(r.result.events[0]!.attributes.signatureHeader).toBeUndefined();
  });

  it("reports disputes with their phase and outcome", () => {
    const r = analyzeFixture("webhook-dispute-lost.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment.dispute.created", "dispute", "pending"],
      ["payment.dispute.lost", "dispute", "failure"],
    ]);
    expect(r.events[1]).toMatchObject({
      paymentReference: "pay_PPLsynth-Disp01",
      relatedReference: "disp_PPLsynth-Disp01",
      attributes: { phase: "chargeback", amountDeducted: "125000", paymentStatus: "captured" },
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("reports a failed refund", () => {
    const r = analyzeFixture("webhook-refund-failed.json");
    expect(r.events[0]).toMatchObject({
      stage: "refund",
      outcome: "failure",
      providerStatus: "failed",
    });
    expect(r.findings.find((f) => f.ruleId === "PAYMENT_FAILURE")!.title).toBe("Refund failed");
  });

  it("keeps the refund snapshot status for refund.created", () => {
    const refund = {
      id: "rfnd_PPLsynth-2",
      entity: "refund",
      payment_id: PAY,
      status: "processed",
      amount: 1,
    };
    expect(firstEvent(webhook("refund.created", { refund, payment: payment() }))).toMatchObject({
      outcome: "success",
      providerStatus: "processed",
    });
  });

  it("shows a settlement without linking it to payments", () => {
    const r = analyzeFixture("settlement-processed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "settlement.processed",
      stage: "settlement",
      outcome: "success",
      relatedReference: "setl_PPLsynth-Setl01",
      amountMinor: "9870000",
      attributes: { utrPresent: true },
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
  });

  it("analyzes RazorpayX payout webhooks with the payout reason table", () => {
    const r = analyzeFixture("payout-reversed.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payout.initiated", "payout", "pending"],
      ["payout.reversed", "payout", "failure"],
    ]);
    expect(r.events[0]!.attributes).toMatchObject({
      statusDetailsReason: "payout_bank_processing",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "beneficiary_bank_offline",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Beneficiary bank is offline (synthetic text).",
    });
    expect(r.errors[0]!.explanation).toMatch(/retry after 30 minutes/);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("maps payout.updated from the payout status and keeps non-error reasons as attributes", () => {
    const e = firstEvent(webhook("payout.updated", { payout: payout("queued", "low_balance") }));
    expect(e).toMatchObject({
      stage: "payout",
      outcome: "pending",
      attributes: { statusDetailsReason: "low_balance" },
    });
    expect(analyze(json(payout("queued", "low_balance"))).errors).toEqual([]);
    const odd = firstError(payout("failed", "low_balance"));
    expect(odd).toMatchObject({ confidence: "possible" });
    expect(odd.missingInformation.join(" ")).toMatch(
      /documents "low_balance" for the queued status/,
    );
    expect(firstError(payout("reversed", "pplsynth_reason"))).toMatchObject({
      confidence: "insufficient",
      category: "unknown",
    });
  });

  it("shows unknown event families honestly", () => {
    const r = analyze(
      json(webhook("invoice.paid", { payment: payment(), invoice: { id: "inv_PPLsynth" } })),
    );
    expect(r.events[0]).toMatchObject({
      eventType: "invoice.paid",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      paymentReference: PAY,
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("recognizes downtime events without linking them to a payment", () => {
    const e = firstEvent({
      entity: "event",
      event: "payment.downtime.started",
      contains: ["payment.downtime"],
      payload: {
        "payment.downtime": { entity: { id: "down_PPLsynth", entity: "payment.downtime" } },
      },
      created_at: T,
    });
    expect(e).toMatchObject({ eventTypeKnown: true, stage: "other", outcome: "unknown" });
    expect(e.paymentReference).toBeUndefined();
  });

  it("covers every documented webhook event", () => {
    expect(Object.keys(WEBHOOK_EVENTS)).toHaveLength(28);
  });
});

describe("razorpay correlation", () => {
  it("keeps unrelated transactions apart", () => {
    const r = analyze(
      `${fixture("razorpay/webhook-card-lifecycle.json").trim().slice(0, -1)},${fixture(
        "razorpay/webhook-late-authorisation.json",
      )
        .trim()
        .slice(1)}`,
    );
    expect(r.events).toHaveLength(8);
    expect(r.groups).toHaveLength(2);
  });

  it("links an API error, the payment and its refund by payment id", () => {
    const refund = {
      id: "rfnd_PPLsynth-3",
      entity: "refund",
      payment_id: PAY,
      status: "processed",
    };
    const r = analyze(json([apiError({ metadata: { payment_id: PAY } }), payment(), refund]));
    expect(r.groups).toHaveLength(1);
    expect(razorpayAdapter.correlationKeys(r.events[1]!)).toEqual([PAY, ORDER]);
  });
});

describe("razorpay redaction", () => {
  const planted = [
    "pplsynth.buyer@example.com",
    "+919000000001",
    "PPLsynth Cardholder",
    "9473",
    "512345",
    "PPLAUTH1",
    "PPLSYNTHRRN",
    "PPLSYNTHARN",
    "PPLsynth Notes Name",
    "PPLsynth free text description",
    "cust_PPLsynth",
    "token_PPLsynth",
    "card_PPLsynth",
    "pplsynth.payer@okpplsynth",
    "acc_PPLsynth",
    "PPLsynth-Receipt",
    "PPLsynth-Refund-Receipt",
    "PPLsynth refund note",
    "PPLsynth evidence summary",
    "doc_PPLsynth",
    "PPLSYNTH000111222",
    "PPLS0000001",
    "PPLsynth Beneficiary",
    "PPLsynth Bank",
    "PPLsynth Narration",
    "PPLsynth-Ref-Secret",
    "PPLSYNTHDEBIT",
    "PPLSYNTHUTR",
    "fa_PPLsynth",
    "PPLsynth payout note",
    "pplsynth0000000",
  ];

  it.each(readdirSync(`${root}razorpay`))("keeps planted values out of %s", (file) => {
    const r = analyzeFixture(file);
    const events = json(r.events);
    const errors = json(r.errors);
    const report = toJsonReport(r);
    const reportWithIds = toJsonReport(r, { includeIdentifiers: true });
    for (const value of planted) {
      expect(events, `${file} events: ${value}`).not.toContain(value);
      expect(errors, `${file} errors: ${value}`).not.toContain(value);
      expect(report, `${file} report: ${value}`).not.toContain(value);
      expect(reportWithIds, `${file} report with ids: ${value}`).not.toContain(value);
    }
  });

  it("masks identifiers in the default report", () => {
    const report = toJsonReport(analyzeFixture("webhook-card-lifecycle.json"));
    expect(report).not.toContain("pay_PPLsynth-Life01");
    expect(report).not.toContain("rfnd_PPLsynth-Life01");
  });
});

describe("razorpay catalog and manifest", () => {
  it("has the documented number of codes", () => {
    expect(Object.keys(ERROR_CODES)).toHaveLength(3);
    expect(Object.keys(PAYMENT_REASONS)).toHaveLength(111);
    expect(Object.keys(X_API_REASONS)).toHaveLength(7);
    expect(Object.keys(PAYOUT_REASONS)).toHaveLength(35);
    expect(Object.values(PAYOUT_REASONS).filter((r) => r.group === "failure")).toHaveLength(23);
    expect(Object.keys(SOURCES)).toHaveLength(12);
    expect(Object.keys(STEPS)).toHaveLength(21);
  });

  it("uses only Razorpay documentation URLs and plain hyphens", () => {
    const all = json({ PAYMENT_REASONS, X_API_REASONS, PAYOUT_REASONS, razorpayManifest });
    expect(all).not.toMatch(/[\u2013\u2014]/);
    for (const d of razorpayManifest.documentation)
      expect(d.url).toMatch(/^https:\/\/razorpay\.com\/docs\//);
    for (const s of razorpayManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/razorpay\.com\//);
  });

  it("describes the adapter honestly", () => {
    expect(razorpayManifest).toMatchObject({
      id: "razorpay",
      version: RAZORPAY_ADAPTER_VERSION,
      wave: 3,
      researchStatus: "tested",
      documentationAccess: "public",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      status: "limited",
      delivery: { duplicatesDocumented: true, ordering: "not_guaranteed" },
    });
    expect(razorpayManifest.categories).not.toContain("acquiring");
    const caps = Object.values(razorpayManifest.capabilities);
    expect(caps).toContain("limited");
    expect(razorpayManifest.fixtureProvenance).toMatch(/synthetic/i);
  });

  it("exports the adapter, the manifest and the version", () => {
    expect(defaultExport).toBe(razorpayAdapter);
    expect(manifestOnly).toBe(razorpayManifest);
    expect(razorpayAdapter.manifest).toBe(razorpayManifest);
    expect(razorpayAdapter.version).toBe("0.1.0");
  });
});
