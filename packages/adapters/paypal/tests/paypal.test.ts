import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeText, toJsonReport, type AnalysisResult } from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { stripeAdapter } from "@pandapaylens/stripe";
import { adyenAdapter } from "@pandapaylens/adyen";
import {
  ISSUES,
  PROCESSOR_RESPONSE_CODES,
  paypalAdapter,
  paypalManifest,
  PAYPAL_ADAPTER_VERSION,
} from "@pandapaylens/paypal";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const fixture = (path: string) => readFileSync(`${FIXTURES}${path}`, "utf8");

function analyze(text: string, adapters = [paypalAdapter]): AnalysisResult {
  const r = analyzeText(text, {
    adapters,
    rules: defaultRules,
    catalogVersion: "test",
    now: () => new Date("2026-10-25T12:00:00.000Z"),
  });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`paypal/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const capture = (fields: Record<string, unknown> = {}) => ({
  id: "PPLSYNTHCAPTX0001",
  status: "COMPLETED",
  amount: { currency_code: "USD", value: "10.00" },
  final_capture: true,
  supplementary_data: { related_ids: { order_id: "PPLSYNTHORDERX001" } },
  ...fields,
});
const webhook = (eventType: string, resource: Record<string, unknown>, id = "WH-PPLSYNTH-X1") => ({
  id,
  create_time: "2026-10-25T10:00:00Z",
  resource_type: "capture",
  event_type: eventType,
  resource,
});
const apiError = (fields: Record<string, unknown>) => ({
  name: "UNPROCESSABLE_ENTITY",
  message: "The requested action could not be performed.",
  debug_id: "PPLsynthdbgX",
  ...fields,
});

describe("paypal manifest", () => {
  it("is honest about limited capabilities", () => {
    expect(paypalAdapter.id).toBe("paypal");
    expect(PAYPAL_ADAPTER_VERSION).toBe("0.1.0");
    expect(paypalManifest).toMatchObject({
      id: "paypal",
      wave: 1,
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
      capabilities: {
        errorDecoding: "supported",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
      },
      delivery: { ordering: "not_documented", duplicatesDocumented: false },
    });
  });

  it("contains no dash characters other than the hyphen", () => {
    const text = json(paypalManifest) + json(ISSUES) + json(PROCESSOR_RESPONSE_CODES);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});

describe("paypal detection", () => {
  it.each([
    [apiError({}), "paypal.api_error", 0.95, true],
    [{ name: "NEW_ERROR_NAME", debug_id: "x" }, "paypal.api_error", 0.85, true],
    [{ name: "INVALID_REQUEST", details: [{ issue: "X" }] }, "paypal.api_error", 0.85, true],
    [{ name: "INVALID_REQUEST", message: "bad" }, "paypal.api_error", 0.4, true],
    [
      { name: "INVALID_REQUEST", links: [{ rel: "information_link", href: "https://x" }] },
      "paypal.api_error",
      0.7,
      true,
    ],
    [
      { id: "O1", status: "COMPLETED", intent: "CAPTURE", purchase_units: [] },
      "paypal.order",
      0.95,
      true,
    ],
    [
      { id: "O1", status: "CREATED", links: [{ rel: "approve", href: "https://x/?token=O1" }] },
      "paypal.order",
      0.75,
      true,
    ],
    [capture(), "paypal.payment_resource", 0.9, true],
    [
      {
        id: "R1",
        status: "COMPLETED",
        links: [{ rel: "self", href: "https://api-m.paypal.com/v2/payments/refunds/R1" }],
      },
      "paypal.payment_resource",
      0.8,
      true,
    ],
    [webhook("PAYMENT.CAPTURE.COMPLETED", capture()), "paypal.webhook", 0.98, true],
    [{ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }, "paypal.webhook", 0.75, true],
    [webhook("BILLING.SUBSCRIPTION.CREATED", {}), "paypal.webhook.subscription", 0.98, false],
    [{ error: "invalid_client", error_description: "x" }, "paypal.oauth_error", 0.3, false],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(paypalAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("does not match on the provider name or generic shapes", () => {
    expect(paypalAdapter.detect({ provider: "paypal", message: "PayPal error" }).confidence).toBe(
      0,
    );
    expect(paypalAdapter.detect({ error: { message: "x" } }).confidence).toBe(0);
    expect(paypalAdapter.detect({ status: "COMPLETED" }).confidence).toBe(0);
    expect(paypalAdapter.detect({ name: "Error", message: "x" }).confidence).toBe(0);
    expect(paypalAdapter.detect({ type: "payment_intent.succeeded", data: {} }).confidence).toBe(0);
    expect(paypalAdapter.detect([]).confidence).toBe(0);
    expect(paypalAdapter.detect(null).confidence).toBe(0);
    for (const generic of [
      { error: "server_error", message: "x" },
      { status: "COMPLETED", id: "x", amount: 100 },
      { name: "VALIDATION_ERROR", message: "x" },
    ]) {
      expect(paypalAdapter.detect(generic).confidence).toBeLessThanOrEqual(0.5);
    }
  });

  it("returns confidence 0 for every Stripe, Adyen and mixed fixture", () => {
    for (const dir of ["stripe", "adyen", "mixed"]) {
      for (const file of readdirSync(`${FIXTURES}${dir}`)) {
        const r = analyze(fixture(`${dir}/${file}`));
        for (const rec of r.records) {
          expect({ file, confidence: rec.confidence, provider: rec.provider }).toEqual({
            file,
            confidence: 0,
            provider: null,
          });
        }
      }
    }
  });

  it("is not claimed by the Stripe or Adyen adapters", () => {
    for (const file of readdirSync(`${FIXTURES}paypal`)) {
      const r = analyze(fixture(`paypal/${file}`), [stripeAdapter, adyenAdapter, paypalAdapter]);
      expect(r.warnings.filter((w) => w.code === "AMBIGUOUS_PROVIDER")).toEqual([]);
      for (const rec of r.records) {
        if (rec.provider)
          expect({ file, provider: rec.provider }).toEqual({ file, provider: "paypal" });
      }
    }
  });
});

describe("paypal parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const r = analyzeFixture("webhook-missing-resource.json");
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "paypal.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^resource:/);
    expect(paypalAdapter.parse({ status: "COMPLETED" }, "paypal.payment_resource").ok).toBe(false);
    expect(paypalAdapter.parse({ id: "O" }, "paypal.order").ok).toBe(false);
    expect(paypalAdapter.parse({ message: "x" }, "paypal.api_error").ok).toBe(false);
    expect(paypalAdapter.parse({}, "paypal.nope").ok).toBe(false);
    expect(paypalAdapter.parse({}, "paypal.webhook.verify_request").ok).toBe(false);
  });

  it("reports nested resource problems with their path", () => {
    const r = paypalAdapter.parse(
      webhook("PAYMENT.CAPTURE.COMPLETED", { id: "C", status: 5 }),
      "paypal.webhook",
    );
    expect(!r.ok && r.issues[0]).toMatch(/^resource\.status:/);
  });

  it("tolerates unknown fields and an unknown event's resource shape", () => {
    expect(paypalAdapter.parse(apiError({ brand_new: [1] }), "paypal.api_error").ok).toBe(true);
    const r = analyze(
      json(webhook("CUSTOMER.SOMETHING.NEW", { amount: 5, status: { nested: true } })),
    );
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      outcome: "unknown",
      stage: "other",
    });
  });

  it("rejects malformed JSON before detection", () => {
    const r = analyzeText('{"name": "INTERNAL_SERVER_ERROR", "debug_id": ', {
      adapters: [paypalAdapter],
      rules: defaultRules,
      catalogVersion: "test",
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
  });
});

describe("paypal error decoding", () => {
  it("decodes a declined instrument from details[].issue", () => {
    const r = analyzeFixture("error-instrument-declined.json");
    expect(r.suggestedView).toBe("decoder");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      provider: "paypal",
      code: "INSTRUMENT_DECLINED",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      subCodes: {
        errorName: "UNPROCESSABLE_ENTITY",
        issue: "INSTRUMENT_DECLINED",
        debug_id: "PPLsynthdbg0001",
      },
    });
    expect(r.errors[0]!.providerMessage).toMatch(/declined by the processor or bank/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://developer.paypal.com/api/rest/reference/orders/v2/errors/",
    );
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
  });

  it("decodes a validation error and never copies details[].value", () => {
    const r = analyzeFixture("error-validation.json");
    expect(r.errors[0]).toMatchObject({
      code: "INVALID_PARAMETER_VALUE",
      category: "invalid_request",
      retry: "do_not_retry",
      subCodes: { field: "/purchase_units/0/amount/value", location: "body" },
    });
    expect(json(r.errors) + json(r.events)).not.toContain("echoed-caller-value");
    expect(toJsonReport(r)).not.toContain("echoed-caller-value");
    expect(r.findings).toEqual([]);
  });

  it("treats AUTHENTICATION_FAILURE as an API credential problem", () => {
    const r = analyzeFixture("error-authentication-failure.json");
    expect(r.errors[0]).toMatchObject({
      code: "INVALID_ACCOUNT_STATUS",
      category: "configuration",
      retry: "do_not_retry",
    });
    const nameOnly = analyze(json({ name: "AUTHENTICATION_FAILURE", debug_id: "x" }));
    expect(nameOnly.errors[0]).toMatchObject({
      code: "AUTHENTICATION_FAILURE",
      category: "configuration",
      confidence: "possible",
    });
  });

  it("reads the HTTP status of a pasted 500 response and never calls the retry safe", () => {
    const r = analyzeFixture("error-internal-server.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "paypal.api_error" });
    expect(r.errors[0]).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
      subCodes: { httpStatus: "500" },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/same PayPal-Request-Id/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://developer.paypal.com/api/rest/reference/idempotency/",
    );
    expect(r.events[0]).toMatchObject({
      providerStatus: "HTTP 500 INTERNAL_SERVER_ERROR",
      outcome: "unknown",
    });
  });

  it("notes an HTTP status that does not match the error name", () => {
    const r = analyze(
      `HTTP/1.1 400 Bad Request\nContent-Type: application/json\n\n${json(apiError({}))}`,
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/400 does not match .*422/);
  });

  it("falls back to the HTTP status for an undocumented name", () => {
    const r = analyze(
      `HTTP/1.1 429 Too Many Requests\n\n${json({ name: "SOME_NEW_NAME", debug_id: "d" })}`,
    );
    expect(r.errors[0]).toMatchObject({
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
      confidence: "possible",
    });
  });

  it("links PAYER_ACTION_REQUIRED to the order through the payer-action token", () => {
    const r = analyzeFixture("error-payer-action-required.json");
    expect(r.errors[0]).toMatchObject({
      code: "PAYER_ACTION_REQUIRED",
      category: "authentication_required",
      retry: "customer_action_required",
      paymentReference: "PPLSYNTHORDER0005",
    });
    expect(json(r.events)).not.toContain("checkoutnow");
  });

  it("accepts the documented UNPROCCESSABLE_ENTITY spelling", () => {
    const r = analyzeFixture("error-refund-amount-exceeded.json");
    expect(r.records[0]!.confidence).toBe(0.95);
    expect(r.errors[0]).toMatchObject({
      code: "REFUND_AMOUNT_EXCEEDED",
      category: "invalid_amount",
      subCodes: { errorName: "UNPROCCESSABLE_ENTITY", normalizedName: "UNPROCESSABLE_ENTITY" },
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://developer.paypal.com/api/payments/v2",
    );
  });

  it("reports unrecognized issues honestly", () => {
    const r = analyze(json(apiError({ details: [{ issue: "BRAND_NEW_ISSUE" }] })));
    expect(r.errors[0]).toMatchObject({
      code: "BRAND_NEW_ISSUE",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);

    const bare = analyze(json(apiError({})));
    expect(bare.errors[0]).toMatchObject({
      code: "UNPROCESSABLE_ENTITY",
      confidence: "insufficient",
    });
    expect(bare.errors[0]!.missingInformation.join(" ")).toMatch(/No details\[\]\.issue/);

    const unknownName = analyze(json({ name: "TOTALLY_NEW", debug_id: "d" }));
    expect(unknownName.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
  });

  it("decodes the first of several issues and says so", () => {
    const r = analyze(
      json(
        apiError({
          name: "INVALID_REQUEST",
          details: [{ issue: "MISSING_REQUIRED_PARAMETER" }, { issue: "INVALID_STRING_LENGTH" }],
        }),
      ),
    );
    expect(r.errors[0]).toMatchObject({
      code: "MISSING_REQUIRED_PARAMETER",
      subCodes: { additionalIssues: "INVALID_STRING_LENGTH" },
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/2 details entries/);
  });

  it.each([
    ["PREVIOUS_REQUEST_IN_PROGRESS", "duplicate_request", "retry_conditionally"],
    ["ORDER_ALREADY_CAPTURED", "duplicate_request", "do_not_retry"],
    ["TRANSACTION_REFUSED", "fraud_or_risk", "manual_review"],
    ["CONTINGENCY_NOT_SUCCESSFUL", "authentication_failed", "customer_action_required"],
    ["REFUND_FAILED_INSUFFICIENT_FUNDS", "insufficient_funds", "manual_review"],
    ["RATE_LIMIT_REACHED", "rate_limiting", "safe_to_retry_technical_request"],
  ])("maps issue %s to %s / %s", (issue, category, retry) => {
    const r = analyze(json(apiError({ details: [{ issue }] })));
    expect(r.errors[0]).toMatchObject({ category, retry, confidence: "strong" });
  });

  it("only uses retry_conditionally with a verify-first explanation", () => {
    for (const entry of Object.values(ISSUES)) {
      if (entry.retry === "retry_conditionally")
        expect(entry.retryExplanation).toMatch(/check|verify|first|once/i);
    }
  });

  it("recognizes but does not analyze OAuth token errors", () => {
    const r = analyzeFixture("oauth-invalid-client.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "paypal.oauth_error" });
    expect(r.errors).toEqual([]);
  });
});

describe("paypal payment responses", () => {
  it("builds order and capture events from a captured order", () => {
    const r = analyzeFixture("order-captured.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.providerStatus, e.outcome])).toEqual([
      ["order.snapshot", "payment", "COMPLETED", "unknown"],
      ["capture.snapshot", "capture", "COMPLETED", "success"],
    ]);
    expect(r.events[1]).toMatchObject({
      paymentReference: "PPLSYNTHORDER0001",
      relatedReference: "PPLSYNTHCAPT00001",
      amountMinor: "4999",
      currency: "EUR",
      eventTimestamp: "2026-10-25T09:00:05.000Z",
    });
    expect(r.events[1]!.attributes).toMatchObject({ linkedVia: "up_link", finalCapture: true });
    expect(r.events[0]!.attributes).toMatchObject({
      intent: "CAPTURE",
      captureCount: 1,
      paymentSourceTypes: ["paypal"],
    });
    expect(r.groups).toHaveLength(1);
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("does not treat a COMPLETED order as paid when its capture was declined", () => {
    const r = analyzeFixture("order-completed-capture-declined.json");
    expect(r.events.map((e) => [e.eventType, e.providerStatus, e.outcome])).toEqual([
      ["order.snapshot", "COMPLETED", "unknown"],
      ["capture.snapshot", "DECLINED", "failure"],
    ]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "5400",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      paymentReference: "PPLSYNTHORDER0002",
      attemptReference: "PPLSYNTHCAPT00002",
      subCodes: {
        status: "DECLINED",
        response_code: "5400",
        response_code_token: "EXPIRED_CARD",
        avs_code: "G",
        cvv_code: "P",
      },
      source: { path: "purchase_units[0].payments.captures[0]" },
    });
    expect(r.groups[0]!.latestOutcome).toBe("failure");
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
    expect(r.findings[0]!.title).toBe("Capture failed");
  });

  it("does not treat order approval as capture", () => {
    const r = analyze(
      json({
        id: "PPLSYNTHORDERA001",
        intent: "CAPTURE",
        status: "APPROVED",
        purchase_units: [{ amount: { currency_code: "EUR", value: "5.00" } }],
      }),
    );
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "pending", amountMinor: "500" });
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it.each([
    ["CREATED", "payment", "pending"],
    ["SAVED", "payment", "pending"],
    ["PAYER_ACTION_REQUIRED", "authentication", "pending"],
    ["VOIDED", "void", "success"],
    ["MYSTERY", "other", "unknown"],
  ])("maps order status %s to %s / %s", (status, stage, outcome) => {
    const r = analyze(
      json({ id: "PPLSYNTHORDERS001", intent: "CAPTURE", status, purchase_units: [] }),
    );
    expect(r.events[0]).toMatchObject({ stage, outcome });
  });

  it.each([
    ["PENDING", "capture", "pending"],
    ["FAILED", "capture", "failure"],
    ["REFUNDED", "capture", "success"],
    ["PARTIALLY_REFUNDED", "capture", "success"],
    ["WEIRD", "capture", "unknown"],
  ])("maps capture status %s to %s / %s", (status, stage, outcome) => {
    expect(analyze(json(capture({ status }))).events[0]).toMatchObject({ stage, outcome });
  });

  it("links a capture made from an authorization through the rel=up link", () => {
    const r = analyzeFixture("authorization-and-capture.json");
    expect(
      r.events.map((e) => [
        e.eventType,
        e.stage,
        e.outcome,
        e.paymentReference,
        e.relatedReference,
      ]),
    ).toEqual([
      ["order.snapshot", "payment", "unknown", "PPLSYNTHORDER0009", undefined],
      [
        "authorization.snapshot",
        "authorization",
        "success",
        "PPLSYNTHORDER0009",
        "PPLSYNTHAUTH00009",
      ],
      ["capture.snapshot", "capture", "success", "PPLSYNTHAUTH00009", "PPLSYNTHCAPT00009"],
    ]);
    expect(r.events[2]!.attributes.parentAuthorizationId).toBe("PPLSYNTHAUTH00009");
    // JPY has no minor unit.
    expect(r.events[2]!.amountMinor).toBe("5000");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual([
      "PPLSYNTHAUTH00009",
      "PPLSYNTHCAPT00009",
      "PPLSYNTHORDER0009",
    ]);
  });

  it.each([
    [{ status: "DENIED", seller_protection: {} }, "authorization"],
    [{ status: "CANCELLED", processor_response: {} }, "refund"],
    [{ status: "REFUNDED", seller_protection: {} }, "capture"],
    [{ status: "COMPLETED", seller_protection: {} }, null],
  ])("infers the resource kind of %j from a status unique to one kind", (fields, kind) => {
    const r = analyze(
      json({ id: "PPLSYNTHRESK0001", amount: { currency_code: "EUR", value: "1.00" }, ...fields }),
    );
    expect(r.events[0]!.attributes.resourceKind).toBe(kind);
    expect(r.events[0]!.eventTypeKnown).toBe(kind !== null);
  });

  it("decodes a denied authorization and a refund without a reason honestly", () => {
    const auth = analyze(
      json({
        id: "PPLSYNTHAUTHD0001",
        status: "DENIED",
        expiration_time: "2026-11-01T00:00:00Z",
        amount: { currency_code: "USD", value: "1.00" },
        seller_protection: { status: "ELIGIBLE" },
        status_details: { reason: "DECLINED_BY_RISK_FRAUD_FILTERS" },
      }),
    );
    expect(auth.events[0]).toMatchObject({
      eventType: "authorization.snapshot",
      outcome: "failure",
    });
    expect(auth.errors[0]).toMatchObject({
      code: "DECLINED_BY_RISK_FRAUD_FILTERS",
      category: "fraud_or_risk",
    });

    const declined = analyze(json(capture({ status: "DECLINED" })));
    expect(declined.errors[0]).toMatchObject({
      code: "DECLINED",
      category: "unknown",
      confidence: "insufficient",
    });
  });

  it("decodes processor response codes with token-only or unknown meanings conservatively", () => {
    const tokenOnly = analyze(
      json(capture({ status: "DECLINED", processor_response: { response_code: "PPCT" } })),
    );
    expect(tokenOnly.errors[0]).toMatchObject({
      code: "PPCT",
      category: "unknown",
      retry: "unknown",
      confidence: "possible",
      subCodes: { response_code_token: "CARD_TYPE_UNSUPPORTED" },
    });
    const unknown = analyze(
      json(capture({ status: "DECLINED", processor_response: { response_code: "ZZ99" } })),
    );
    expect(unknown.errors[0]).toMatchObject({ code: "ZZ99", confidence: "insufficient" });
    const advice = analyze(
      json(
        capture({
          status: "DECLINED",
          processor_response: { response_code: "5120", payment_advice_code: "02" },
        }),
      ),
    );
    expect(advice.errors[0]).toMatchObject({
      category: "insufficient_funds",
      subCodes: { payment_advice_code: "02" },
    });
    expect(advice.errors[0]!.missingInformation.join(" ")).toMatch(/depends on the card network/);
  });
});

describe("paypal webhooks", () => {
  it("parses a PAYMENT.CAPTURE.COMPLETED event", () => {
    const r = analyzeFixture("webhook-capture-completed.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      eventTypeKnown: true,
      stage: "capture",
      outcome: "success",
      providerStatus: "COMPLETED",
      eventReference: "WH-PPLSYNTH0000001-EVT0000000000001",
      deliveryKey: "WH-PPLSYNTH0000001-EVT0000000000001",
      paymentReference: "PPLSYNTHORDER0001",
      relatedReference: "PPLSYNTHCAPT00001",
      eventTimestamp: "2026-10-25T09:00:07.120Z",
      amountMinor: "4999",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      linkedVia: "related_ids",
      resourceType: "capture",
      sellerProtection: "ELIGIBLE",
    });
    expect(r.findings).toEqual([]);
  });

  it("correlates the webhook with the order snapshot of the same payment", () => {
    const r = analyze(
      `[${fixture("paypal/order-captured.json")},${fixture("paypal/webhook-capture-completed.json")}]`,
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events).toHaveLength(3);
  });

  it("flags duplicate deliveries by event id", () => {
    const r = analyzeFixture("webhook-duplicate.json");
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      "WH-PPLSYNTH0000002-EVT0000000000002",
      "WH-PPLSYNTH0000002-EVT0000000000002",
    ]);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
    expect(r.findings[0]!.explanation).toMatch(/same webhook event id/);
  });

  it("orders a lifecycle by event time and groups approval, capture and refund", () => {
    const r = analyzeFixture("webhook-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["CHECKOUT.ORDER.APPROVED", "payment", "pending"],
      ["PAYMENT.CAPTURE.COMPLETED", "capture", "success"],
      ["PAYMENT.CAPTURE.REFUNDED", "refund", "success"],
    ]);
    const refund = r.events[2]!;
    expect(refund).toMatchObject({
      paymentReference: "PPLSYNTHCAPT00004",
      relatedReference: "PPLSYNTHREFND0004",
      amountMinor: "1000",
    });
    expect(refund.attributes).toMatchObject({
      resourceKind: "refund",
      parentCaptureId: "PPLSYNTHCAPT00004",
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(ruleIds(r)).toEqual(["OUT_OF_ORDER_ARRIVAL"]);
    expect(r.findings[0]!.explanation).toMatch(/does not document a delivery order guarantee/);
    expect(json(r.events)).not.toContain("private note");
  });

  it("treats PAYMENT.CAPTURE.DECLINED and DENIED both as capture failures", () => {
    const r = analyzeFixture("webhook-capture-declined-denied.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.paymentReference])).toEqual([
      ["PAYMENT.CAPTURE.DECLINED", "capture", "failure", "PPLSYNTHORDER0051"],
      ["PAYMENT.CAPTURE.DENIED", "capture", "failure", "PPLSYNTHORDER0052"],
    ]);
    expect(r.errors.map((e) => [e.code, e.category, e.attemptReference])).toEqual([
      ["5120", "insufficient_funds", "PPLSYNTHCAPT00051"],
      ["DECLINED", "unknown", "PPLSYNTHCAPT00052"],
    ]);
    expect(r.errors[0]!.source.path).toBe("resource");
    expect(r.groups).toHaveLength(2);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE", "PAYMENT_FAILURE"]);
  });

  it.each([
    ["PAYMENT.AUTHORIZATION.CREATED", { status: "CREATED" }, "authorization", "success"],
    ["PAYMENT.AUTHORIZATION.CREATED", { status: "PENDING" }, "authorization", "pending"],
    ["PAYMENT.AUTHORIZATION.CREATED", {}, "authorization", "success"],
    ["PAYMENT.AUTHORIZATION.VOIDED", { status: "VOIDED" }, "void", "success"],
    ["PAYMENT.CAPTURE.PENDING", { status: "PENDING" }, "capture", "pending"],
    ["PAYMENT.CAPTURE.REVERSED", { status: "REVERSED" }, "reversal", "unknown"],
    [
      "PAYMENT.CAPTURE.REFUNDED",
      { status: "PARTIALLY_REFUNDED", final_capture: true },
      "refund",
      "success",
    ],
    ["PAYMENT.CAPTURE.REFUNDED", { status: "COMPLETED", final_capture: true }, "refund", "unknown"],
    ["PAYMENT.CAPTURE.REFUNDED", { status: "COMPLETED" }, "refund", "unknown"],
    ["PAYMENT.CAPTURE.REFUNDED", {}, "refund", "success"],
    ["PAYMENT.REFUND.PENDING", { status: "PENDING" }, "refund", "pending"],
    ["PAYMENT.REFUND.FAILED", { status: "FAILED" }, "refund", "failure"],
    ["CHECKOUT.ORDER.COMPLETED", { id: "O1", status: "COMPLETED" }, "payment", "unknown"],
    ["CHECKOUT.ORDER.PROCESSED", { id: "O1" }, "other", "unknown"],
  ])("maps %s %j to %s / %s", (eventType, resource, stage, outcome) => {
    const r = analyze(json(webhook(eventType, { id: "PPLSYNTHRESX0001", ...resource })));
    expect(r.events[0]).toMatchObject({ stage, outcome });
  });

  it("links CHECKOUT.PAYMENT-APPROVAL.REVERSED through resource.order_id", () => {
    const r = analyze(
      json({
        id: "WH-PPLSYNTH-REV1",
        create_time: "2026-10-25T10:00:00Z",
        event_type: "CHECKOUT.PAYMENT-APPROVAL.REVERSED",
        summary: "Approval reversed",
        resource: {
          order_id: "PPLSYNTHORDERR001",
          purchase_units: [
            { reference_id: "x", custom_id: "PPLsynth-custom", invoice_id: "PPLsynth-inv" },
          ],
          payment_source: { ideal: { name: "Synthetic Payer", country_code: "NL" } },
        },
      }),
    );
    expect(r.events[0]).toMatchObject({
      stage: "cancellation",
      outcome: "success",
      paymentReference: "PPLSYNTHORDERR001",
    });
    expect(json(r.events)).not.toMatch(/Synthetic Payer|PPLsynth-custom|PPLsynth-inv/);
  });

  it("does not use resource.id of unknown events as a payment reference", () => {
    const r = analyze(
      json(webhook("PAYMENT.SALE.COMPLETED", { id: "PPLSYNTHSALE00001", state: "completed" })),
    );
    expect(r.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(ruleIds(r)).toEqual(["MISSING_REFERENCE", "UNKNOWN_EVENT_TYPE"]);
  });

  it("recognizes subscription webhooks without decoding them", () => {
    const r = analyzeFixture("webhook-subscription.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "paypal.webhook.subscription",
    });
    expect(r.warnings[0]!.message).toMatch(/Subscriptions webhooks .* not analyzed/);
    expect(r.events).toEqual([]);
  });

  it("analyzes the event inside a verify-webhook-signature body and drops the signature data", () => {
    const r = analyzeFixture("webhook-verify-request.json");
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "paypal.webhook.verify_request",
    });
    expect(r.events[0]).toMatchObject({
      eventType: "PAYMENT.CAPTURE.PENDING",
      outcome: "pending",
      paymentReference: "PPLSYNTHORDER0008",
      source: { path: "webhook_event" },
    });
    expect(r.events[0]!.attributes).toMatchObject({
      statusReason: "PENDING_REVIEW",
      fromVerifyRequest: true,
    });
    const out =
      json(r.events) +
      json(r.errors) +
      toJsonReport(r) +
      toJsonReport(r, { includeIdentifiers: true });
    for (const secret of ["SIGNATUREdoNotDisplay", "WEBHOOKIDprivate", "CERT-PPLSYNTH", "certs/"])
      expect(out).not.toContain(secret);
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
  });
});

describe("paypal correlation", () => {
  it("keeps unrelated orders apart even when they share an invoice_id", () => {
    const r = analyzeFixture("unrelated-orders.json");
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.latestOutcome)).toEqual(["failure", "success"]);
    expect(r.groups.flatMap((g) => g.references)).not.toContain("PPLsynth-shared-invoice");
    expect(json(r.events)).not.toContain("PPLsynth-shared-invoice");
  });

  it("returns only PayPal-generated ids as correlation keys", () => {
    const r = analyzeFixture("webhook-lifecycle.json");
    const keys = r.events.flatMap((e) => paypalAdapter.correlationKeys(e));
    expect(new Set(keys)).toEqual(
      new Set(["PPLSYNTHORDER0004", "PPLSYNTHCAPT00004", "PPLSYNTHREFND0004"]),
    );
  });
});

describe("paypal sensitive data", () => {
  it("keeps payer, card, shipping and merchant data out of events and reports", () => {
    const planted = [
      "synthetic.buyer@example.com",
      "Synthetic Buyer",
      "1 Synthetic Street",
      "10115",
      "PPLSYNTHPAYER0001",
      "synthetic.merchant@example.com",
      "PPLSYNTHMERCH0001",
      "PPLsynth-invoice-private",
      "PPLsynth-custom-private",
      "Synthetic Cardholder",
      "2030-01",
    ];
    for (const file of [
      "order-captured.json",
      "webhook-capture-completed.json",
      "order-completed-capture-declined.json",
    ]) {
      const r = analyzeFixture(file);
      const out =
        json(r.events) +
        json(r.errors) +
        toJsonReport(r) +
        toJsonReport(r, { includeIdentifiers: true });
      for (const p of planted)
        expect({ file, leaked: out.includes(p) ? p : null }).toEqual({ file, leaked: null });
    }
  });

  it("never copies card numbers echoed in error details", () => {
    const r = analyze(
      json(
        apiError({
          name: "INVALID_REQUEST",
          details: [
            {
              issue: "INVALID_PARAMETER_VALUE",
              field: "/payment_source/card/number",
              value: "4111111111111111",
            },
          ],
        }),
      ),
    );
    expect(json(r.events) + json(r.errors) + toJsonReport(r)).not.toContain("4111111111111111");
    expect(r.errors[0]!.subCodes.field).toBe("/payment_source/card/number");
  });
});
