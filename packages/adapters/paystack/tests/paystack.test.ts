import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
  type RecordMeta,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  API_ERROR_MESSAGES,
  BANK_ERRORS,
  CHARGE_STATES,
  CUSTOMER_ERRORS,
  ERROR_CODES,
  ERROR_TYPES,
  FRAUD_ERRORS,
  HELP_CENTER_MESSAGES,
  INBOUND_TRANSFER_MESSAGE_TYPES,
  OTHER_WEBHOOK_EVENTS,
  OUTCOME_TEXTS,
  PAYSTACK_ADAPTER_VERSION,
  SYSTEM_ERRORS,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES,
  WEBHOOK_EVENTS,
  lookupDeclineMessage,
  paystackAdapter,
  paystackManifest,
} from "@pandapaylens/paystack";
import defaultExport from "@pandapaylens/paystack";
import { paystackManifest as manifestOnly } from "@pandapaylens/paystack/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [paystackAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`paystack/${path}`));
const json = (v: unknown) => JSON.stringify(v);
/** Events in input order; events without a timestamp sort last on the timeline. */
const inOrder = (r: AnalysisResult) => [...r.events].sort((a, b) => a.sourceIndex - b.sourceIndex);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;

const REF = "PPLsynth-ref-test";

const txn = (fields: Record<string, unknown> = {}) => ({
  id: 900009001,
  domain: "test",
  status: "success",
  reference: REF,
  amount: 10000,
  message: null,
  gateway_response: "Successful",
  paid_at: "2026-10-24T10:00:00.000Z",
  created_at: "2026-10-24T09:59:00.000Z",
  channel: "card",
  currency: "NGN",
  ...fields,
});

const verify = (fields: Record<string, unknown> = {}, top: Record<string, unknown> = {}) => ({
  status: true,
  message: "Verification successful",
  data: txn(fields),
  ...top,
});

const failed = (gateway: unknown, extra: Record<string, unknown> = {}) =>
  verify({ status: "failed", gateway_response: gateway, paid_at: null, ...extra });

const webhook = (event: string, data: unknown) => ({ event, data });

const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");

describe("paystack detection", () => {
  it.each([
    [verify(), "paystack.api_response", 0.9],
    [
      { status: true, message: "Charge attempted", data: { reference: REF, status: "send_otp" } },
      "paystack.api_response",
      0.85,
    ],
    [
      {
        status: true,
        message: "Authorization URL created",
        data: { authorization_url: "x", access_code: "PPLsynth", reference: REF },
      },
      "paystack.api_response",
      0.8,
    ],
    [
      {
        status: false,
        message: "Email Address is required",
        meta: { nextStep: "Provide all required params " },
        type: "validation_error",
        code: "missing_params",
      },
      "paystack.api_error",
      0.98,
    ],
    [
      { status: false, message: "x", type: "api_error", code: "unknown" },
      "paystack.api_error",
      0.88,
    ],
    [{ status: false, message: "Invalid key" }, "paystack.api_error", 0.5],
    [webhook("charge.success", txn()), "paystack.webhook", 0.8],
    [webhook("charge.success", txn({ log: { history: [] } })), "paystack.webhook", 0.95],
    [webhook("refund.processed", { status: "processed" }), "paystack.webhook", 0.5],
    [
      webhook("transfer.failed", {
        transfer_code: "TRF_PPLsynth",
        titan_code: null,
        status: "failed",
      }),
      "paystack.webhook",
      0.65,
    ],
  ])("detects %j", (input, format, confidence) => {
    expect(paystackAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("recognizes list responses without analyzing them", () => {
    const r = paystackAdapter.detect(JSON.parse(fixture("paystack/transaction-list.json")));
    expect(r).toMatchObject({ format: "paystack.list_response", supported: false });
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.unsupportedReason).toMatch(/not analyzed/);
  });

  it("uses the x-paystack-signature header only as supporting evidence", () => {
    const meta: RecordMeta = {
      format: "http",
      http: { kind: "request", method: "POST", headers: { "x-paystack-signature": "[redacted]" } },
    };
    const r = paystackAdapter.detect(webhook("charge.success", txn()), meta);
    expect(r.reasons).toContain("has an x-paystack-signature header");
    expect(r.confidence).toBeGreaterThan(
      paystackAdapter.detect(webhook("charge.success", txn())).confidence,
    );
    expect(paystackAdapter.detect(webhook("something.new", {}), meta).confidence).toBeLessThan(0.5);
    expect(paystackAdapter.detect({ event: "paymentSuccess", data: {} }, meta).confidence).toBe(0);
  });

  it.each([
    { status: false, message: "Something unrelated" },
    { status: true, message: "ok" },
    { status: true, message: "ok", data: {} },
    { status: true, message: "ok", data: { status: "success", reference: "x" } },
    { status: true, message: "ok", data: { id: 1, name: "x" } },
    { status: "success", message: "ok", data: txn() },
    { status: "error", message: "Invalid key", data: null },
    { status: "false", message: "x" },
    { status: true, message: "ok", data: [{ id: 1 }], meta: { total: 1 } },
    { event: "charge.success", data: {} },
    { event: "charge.completed", data: { id: 1, status: "successful", tx_ref: "x" } },
    { event: "paymentSuccess", data: { id: "x", payment_system: "cc" } },
    { event: "charge.success", data: txn(), id: "evt_x" },
    { error: { type: "api_error", message: "x" } },
    { status: "failed", reference: "x", gateway_response: "Declined" },
  ])("does not claim the generic shape %j above 0.5", (input) => {
    expect(paystackAdapter.detect(input).confidence).toBeLessThanOrEqual(0.5);
  });

  it("ignores form data, arrays and primitives", () => {
    expect(paystackAdapter.detect(verify(), { format: "form" }).confidence).toBe(0);
    expect(paystackAdapter.detect([verify()]).confidence).toBe(0);
    expect(paystackAdapter.detect("charge.success").confidence).toBe(0);
    expect(paystackAdapter.detect(null).confidence).toBe(0);
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "paystack" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );

  it("includes the Stripe and Adyen fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen"]));
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
          paystackAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("analyzes every Paystack fixture except the list response", () => {
    const dir = `${root}paystack`;
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const file of files) {
      const text = readFileSync(`${dir}/${file}`, "utf8");
      const r = analyze(text);
      for (const rec of r.records) {
        expect(rec.provider, `${file} record ${rec.recordIndex}`).toBe("paystack");
        expect(rec.status, `${file} record ${rec.recordIndex}`).toBe(
          file === "transaction-list.json" ? "unsupported" : "analyzed",
        );
      }
      // Every identifier in a fixture is synthetic.
      if (/"(reference|transfer_code|customer_code|authorization_code)"/.test(text))
        expect(text, file).toMatch(/PPLsynth|PPLSYNTH/);
      expect(text, file).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("paystack parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const { reference: _r, ...noRef } = txn();
    const r = analyze(json(webhook("charge.success", noRef)));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "paystack.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/data\.reference/);
    expect(r.events).toEqual([]);

    const r2 = analyze(json(webhook("transfer.success", { status: "success", domain: "test" })));
    expect(r2.records[0]!.status).toBe("invalid");
    expect(r2.records[0]!.reasons.join(" ")).toMatch(/data\.transfer_code/);

    const r3 = analyze(
      json(
        verify(
          { status: undefined, log: { history: [] } },
          { data: { gateway_response: "x", domain: "test", log: { history: [] } } },
        ),
      ),
    );
    expect(r3.records[0]).toMatchObject({ status: "invalid", format: "paystack.api_response" });
    expect(r3.records[0]!.reasons.join(" ")).toMatch(/data\.status/);
  });

  it("reports malformed fields as parse issues", () => {
    const r = analyze(json(verify({ reference: 12345, log: { history: [] } })));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "paystack.api_response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/data\.reference/);
    const w = analyze(
      json(webhook("charge.dispute.create", { id: 1, refund_amount: 5, transaction: "x" })),
    );
    expect(w.records[0]).toMatchObject({ status: "invalid", format: "paystack.webhook" });
    const e = analyze(json(webhook("refund.processed", ["x"])));
    expect(e.records[0]!.reasons.join(" ")).toMatch(/expected an object/);
  });

  it("returns issues for an unknown format instead of throwing", () => {
    expect(paystackAdapter.parse({}, "paystack.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported Paystack format "paystack.unknown".'],
    });
    expect(
      paystackAdapter.parse({ status: true, message: "x", data: [] }, "paystack.api_response"),
    ).toMatchObject({ ok: false });
  });

  it("does not analyze malformed JSON", () => {
    const bad = analyzeText('{"event": "charge.success", "data": {', options);
    expect(bad.ok).toBe(false);
  });

  it("reports a recognized list response as unsupported", () => {
    const r = analyzeFixture("transaction-list.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "paystack.list_response" });
    expect(r.warnings.map((w) => w.code)).toContain("UNSUPPORTED_RECORD");
    expect(r.events).toEqual([]);
  });

  it("accepts the string status of the documented error template", () => {
    const r = analyze(
      json({ status: "false", message: "x", type: "validation_error", code: "missing_params" }),
    );
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "paystack.api_error" });
    expect(r.events[0]!.attributes.requestStatus).toBe(false);
  });
});

describe("paystack transaction responses", () => {
  it("normalizes a successful verify response", () => {
    const r = analyzeFixture("verify-success.json");
    expect(r.errors).toEqual([]);
    expect(r.events[0]).toMatchObject({
      sourceFormat: "paystack.api_response",
      eventType: "transaction_response.success",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "success",
      paymentReference: "PPLsynth-ref-0101",
      relatedReference: "900000101",
      eventTimestamp: "2026-10-20T09:15:02.000Z",
      amountMinor: "40333",
      currency: "NGN",
      attributes: {
        objectType: "transaction",
        transactionId: "900000101",
        domain: "test",
        channel: "card",
        gatewayResponse: "Successful",
        requestedAmount: "30050",
        fees: "10283",
        logAttempts: 1,
        logLastStep: "Successfully paid with card",
        cardBrand: "visa",
        cardType: "visa",
        authorizationReusable: true,
        requestStatus: true,
        responseMessage: "Verification successful",
      },
    });
    expect(ruleIds(r)).toEqual([]);
  });

  it("links initialize, Charge API states, the webhook and verify into one payment", () => {
    const r = analyzeFixture("card-payment-lifecycle.json");
    expect(inOrder(r).map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["transaction.initialize", "payment", "pending"],
      ["charge_response.send_pin", "authentication", "pending"],
      ["charge_response.send_otp", "authentication", "pending"],
      ["charge.success", "payment", "success"],
      ["transaction_response.success", "payment", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
    expect(ruleIds(r)).not.toContain("MISSING_REFERENCE");
  });

  it.each(Object.entries(CHARGE_STATES))("maps the Charge API state %s", (state, entry) => {
    const e = firstEvent({
      status: true,
      message: "Charge attempted",
      data: { reference: REF, status: state },
    });
    expect(e).toMatchObject({
      eventType: `charge_response.${state}`,
      eventTypeKnown: true,
      stage: entry.stage,
      outcome: "pending",
      providerStatus: state,
    });
  });

  it.each([
    ["success", "payment", "success"],
    ["failed", "payment", "failure"],
    ["abandoned", "cancellation", "failure"],
    ["reversed", "reversal", "success"],
    ["processing", "payment", "pending"],
    ["pending", "payment", "pending"],
  ])("maps the transaction status %s", (status, stage, outcome) => {
    const e = firstEvent(verify({ status, gateway_response: null }));
    expect(e).toMatchObject({ stage, outcome, providerStatus: status, eventTypeKnown: true });
    if (status !== "success") expect(e.eventTimestamp).toBeUndefined();
  });

  it("keeps an undocumented transaction status unknown", () => {
    const e = firstEvent(verify({ status: "ongoing", log: { history: [] } }));
    expect(e).toMatchObject({
      eventType: "transaction_response.ongoing",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    const r = analyze(json(verify({ status: "ongoing", log: { history: [] } })));
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("decodes a documented bank decline in gateway_response", () => {
    const r = analyzeFixture("verify-failed-do-not-honour.json");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      providerStatus: "failed",
    });
    expect(r.errors[0]).toMatchObject({
      code: "Do Not Honour",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "PPLsynth-ref-0401",
      attemptReference: "900000401",
      providerMessage: "Do Not Honour",
      subCodes: { transaction_status: "failed", text_field: "gateway_response" },
      source: { recordIndex: 0, path: "data.gateway_response" },
    });
    expect(r.errors[0]!.documentation[0]!.url).toBe(
      "https://support.paystack.com/en/articles/2123650",
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/does not say which API field/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no numeric decline/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes a Charge API failure from data.message", () => {
    const r = analyzeFixture("charge-failed-otp-enrollment.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transaction_response.failed",
      outcome: "failure",
      paymentReference: "PPLsynth-ref-0501",
      attributes: { transactionMessage: "Error occured while enrolling you for OTP!" },
    });
    expect(r.errors[0]).toMatchObject({
      code: "Error occured while enrolling you for OTP!",
      category: "authentication_failed",
      retry: "retry_conditionally",
      confidence: "strong",
      attemptReference: "PPLsynth-ref-0501",
      subCodes: { text_field: "message" },
    });
  });

  it("reads the payment outcome from data, not from the envelope status", () => {
    const r = analyze(
      json({
        status: false,
        message: "Charge attempted",
        data: { reference: REF, status: "failed", message: "Insufficient funds", domain: "test" },
      }),
    );
    expect(r.records[0]!.format).toBe("paystack.api_response");
    expect(r.events[0]).toMatchObject({ outcome: "failure", attributes: { requestStatus: false } });
    expect(r.errors[0]).toMatchObject({
      code: "Insufficient funds",
      category: "insufficient_funds",
    });
    expect(r.errors[0]!.documentation[0]!.url).toMatch(/doc-code-snippets/);
  });

  it("explains an abandoned payment without reporting a payment failure", () => {
    const r = analyzeFixture("verify-abandoned-otp.json");
    expect(r.events[0]).toMatchObject({
      stage: "cancellation",
      outcome: "failure",
      providerStatus: "abandoned",
      attributes: { logLastStep: "Authentication Required: otp" },
    });
    expect(r.errors[0]).toMatchObject({
      code: "Kindly enter OTP",
      category: "authentication_required",
      retry: "customer_action_required",
    });
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
    // An abandoned payment without a documented message is not decoded.
    expect(
      analyze(json(verify({ status: "abandoned", gateway_response: "Something" }))).errors,
    ).toEqual([]);
  });

  it("treats a timed-out transaction as an unknown outcome", () => {
    const r = analyzeFixture("verify-failed-timed-out.json");
    expect(r.errors[0]).toMatchObject({
      code: "Timed out",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/GET \/transaction\/verify/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("keeps unrecognized decline text unknown and shows it", () => {
    const r = analyzeFixture("unrecognized-decline-text.json");
    expect(r.errors[0]).toMatchObject({
      code: "failed",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "PPLsynth issuer text not in any documented list",
      documentation: [],
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not one of the documented/);
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
  });

  it("decodes a failed transaction without any text honestly", () => {
    const e = firstError(failed(null));
    expect(e).toMatchObject({ code: "failed", category: "unknown", confidence: "insufficient" });
    expect(e.missingInformation.join(" ")).toMatch(/no gateway_response or message/);
  });

  it("does not decode success markers as declines", () => {
    const e = firstError(failed("Approved", { message: "Daily transaction limit exceeded" }));
    expect(e).toMatchObject({
      code: "Daily transaction limit exceeded",
      subCodes: { text_field: "message" },
    });
    expect(firstError(failed(null, { message: "madePayment" })).providerMessage).toBeUndefined();
  });

  it("matches exact documented messages only, ignoring case, apostrophes and spacing", () => {
    expect(firstError(failed("do not honour")).code).toBe("Do Not Honour");
    expect(firstError(failed("  User’s mobile number is invalid ")).code).toBe(
      "User's mobile number is invalid",
    );
    expect(firstError(failed("Do Not Honour.")).category).toBe("unknown");
    expect(
      firstError(failed("Please confirm that this is a valid PPLsynth Bank account")),
    ).toMatchObject({
      code: "Please confirm that this is a valid [bank name] account",
      category: "invalid_request",
    });
    expect(lookupDeclineMessage("Please confirm that this is a valid account")).toBeUndefined();
  });

  it("decodes every documented Help Center message to its row", () => {
    for (const row of HELP_CENTER_MESSAGES) {
      for (const m of row.messages) {
        if (row.templates?.includes(m)) continue;
        const match = lookupDeclineMessage(m);
        expect(match, m).toBeDefined();
        // "Insufficient funds" is also documented in a charge example.
        if (m !== "Insufficient funds") expect(match!.entry, m).toBe(row);
      }
    }
  });

  it("uses possible confidence for messages with several documented causes", () => {
    const e = firstError(failed("Unable to perform transaction, try again"));
    expect(e).toMatchObject({
      category: "unknown",
      confidence: "possible",
      retry: "retry_conditionally",
    });
  });

  it("applies Paystack's own retry advice", () => {
    expect(firstError(failed("PIN tries exceeded")).retryExplanation).toMatch(/24 hours/);
    expect(firstError(failed("Denied by Fraud System")).retryExplanation).toMatch(/24 hours/);
    expect(firstError(failed("Duplicate Transaction ID")).nextAction).toMatch(
      /Verify the first attempt/,
    );
  });
});

describe("paystack API errors", () => {
  it("decodes a validation error with Paystack's next step", () => {
    const r = analyzeFixture("api-error-missing-params.json");
    expect(r.events[0]).toMatchObject({
      eventType: "api_error.missing_params",
      stage: "error",
      outcome: "unknown",
      providerStatus: "validation_error",
      attributes: { errorType: "validation_error", code: "missing_params", nextStepPresent: true },
    });
    expect(r.errors[0]).toMatchObject({
      code: "missing_params",
      subCodes: { type: "validation_error", code: "missing_params" },
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Email Address is required",
    });
    expect(r.errors[0]!.nextAction).toMatch(
      /Paystack's suggested next step: Provide all required params/,
    );
    expect(r.suggestedView).toBe("decoder");
  });

  it("decodes an authentication failure from the message alone", () => {
    const r = analyzeFixture("api-error-invalid-key.txt");
    expect(r.events[0]).toMatchObject({
      providerStatus: "HTTP 401",
      attributes: { httpStatus: 401 },
    });
    expect(r.errors[0]).toMatchObject({
      code: "Invalid key",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { http_status: "401" },
    });
  });

  it("decodes a duplicate reference", () => {
    const r = analyzeFixture("api-error-duplicate-reference.json");
    expect(r.errors[0]).toMatchObject({
      code: "duplicate_reference",
      category: "duplicate_request",
      retry: "do_not_retry",
    });
  });

  it("accepts the enum on code, as the OpenAPI Error schema has it", () => {
    const e = firstError({
      status: false,
      message: "x",
      code: "validation_error",
      type: "duplicate_reference",
    });
    expect(e).toMatchObject({
      code: "duplicate_reference",
      subCodes: { type: "validation_error", code: "duplicate_reference" },
      category: "duplicate_request",
    });
  });

  it("falls back to the error type with possible confidence", () => {
    const e = firstError({
      status: false,
      message: "x",
      type: "validation_error",
      code: "PPLsynth_new_code",
    });
    expect(e).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(e.missingInformation.join(" ")).toMatch(
      /PPLsynth_new_code" is not in the PandaPayLens catalog/,
    );
    const p = firstError({ status: false, message: "x", type: "processor_error" });
    expect(p).toMatchObject({ category: "unknown", retry: "unknown", confidence: "insufficient" });
    expect(p.missingInformation.join(" ")).toMatch(/processor_error/);
  });

  it("flags a server error whose outcome is unknown", () => {
    const r = analyze(
      httpResponse(500, {
        status: false,
        message: "An error occurred",
        meta: { nextStep: "Try again later" },
        type: "api_error",
        code: "unknown",
      }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
      subCodes: { http_status: "500", type: "api_error", code: "unknown" },
    });
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("matches documented message templates by their fixed prefix", () => {
    const e = firstError({
      status: false,
      message: "Duplicate reference(s) found: PPLsynth-a, PPLsynth-b",
      type: "api_error",
      code: "unknown",
    });
    expect(e).toMatchObject({
      category: "duplicate_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("reads metadata.nextStep as an alias", () => {
    const e = firstError({
      status: false,
      message: "x",
      metadata: { nextStep: "Check the mandate" },
    });
    expect(e.nextAction).toMatch(/Check the mandate/);
    expect(e).toMatchObject({
      code: "request_failed",
      confidence: "insufficient",
      category: "unknown",
    });
  });

  it("covers every documented API error message", () => {
    for (const m of API_ERROR_MESSAGES) {
      const e = firstError({ status: false, message: m.message, type: "api_error" });
      expect(e.category, m.message).toBe(m.category);
    }
  });
});

describe("paystack webhooks", () => {
  it("normalizes a signed charge.success delivery without a delivery key", () => {
    const r = analyzeFixture("charge-success-webhook.txt");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "paystack.webhook",
      eventType: "charge.success",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth-ref-0201",
      relatedReference: "900000201",
      eventTimestamp: "2026-10-21T21:10:19.000Z",
      attributes: {
        gatewayResponse: "Approved by Financial Institution",
        signatureHeaderPresent: true,
        logSuccess: false,
        logLastStep: "Authentication Required: pin",
        cardType: "mastercard DEBIT",
      },
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.events[0]!.eventReference).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("cannot identify a repeated delivery, but keeps both copies in one payment", () => {
    const r = analyzeFixture("duplicate-webhook.json");
    expect(r.events).toHaveLength(2);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(r.events.map((e) => e.observedTimestamp)).toEqual([
      "2026-10-24T19:00:02.000Z",
      "2026-10-24T19:03:15.000Z",
    ]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(paystackManifest.delivery).toMatchObject({
      duplicatesDocumented: true,
      ordering: "not_documented",
    });
  });

  it("decodes charge.failed from the transaction object", () => {
    const r = analyzeFixture("charge-failed-webhook.json");
    expect(r.events[0]).toMatchObject({
      eventType: "charge.failed",
      stage: "payment",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({
      code: "Declined",
      category: "card_declined",
      retry: "retry_conditionally",
      attemptReference: "900002101",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/avoid repeated automatic retries/);
  });

  it("follows a refund through its documented states", () => {
    const r = analyzeFixture("refund-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["charge.success", "payment", "success"],
      ["refund.pending", "refund", "pending"],
      ["refund.processing", "refund", "pending"],
      ["refund.processed", "refund", "success"],
    ]);
    expect(inOrder(r)[3]).toMatchObject({
      paymentReference: "PPLsynth-ref-1101",
      amountMinor: "5000",
      currency: "NGN",
      providerStatus: "processed",
      attributes: {
        objectType: "refund",
        processor: "mpgs_zen",
        refundReference: "PPLsynth1101RRN",
      },
    });
    expect(inOrder(r)[3]!.eventTimestamp).toBeUndefined();
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("REFUND_PENDING");
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("reports a refund that needs attention as not confirmed", () => {
    const r = analyzeFixture("refund-needs-attention.json");
    expect(inOrder(r)[1]).toMatchObject({
      eventType: "refund.needs-attention",
      outcome: "pending",
      attributes: { statusMeaning: expect.stringMatching(/retry_with_customer_details/) },
    });
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("links a refund response to its payment through the transaction id", () => {
    const r = analyze(
      json([
        verify({ id: 900009101, reference: "PPLsynth-ref-9101" }),
        {
          status: true,
          message: "Refund has been queued for processing",
          data: {
            transaction: 900009101,
            id: 900009102,
            amount: 10000,
            currency: "NGN",
            deducted_amount: 0,
            fully_deducted: false,
            status: "pending",
            expected_at: "2026-10-30T00:00:00.000Z",
            domain: "test",
          },
        },
      ]),
    );
    expect(r.events[1]).toMatchObject({
      eventType: "refund_response.pending",
      stage: "refund",
      outcome: "pending",
      relatedReference: "900009102",
      attributes: {
        refundId: "900009102",
        transactionId: "900009101",
        expectedAt: "2026-10-30T00:00:00.000Z",
      },
    });
    expect(r.groups).toHaveLength(1);
  });

  it("reports a chargeback after a successful payment", () => {
    const r = analyzeFixture("dispute-chargeback.json");
    expect(inOrder(r)[1]).toMatchObject({
      eventType: "charge.dispute.create",
      stage: "dispute",
      outcome: "unknown",
      providerStatus: "awaiting-merchant-feedback",
      paymentReference: "PPLsynth-ref-1201",
      relatedReference: "900002201",
      attributes: {
        category: "chargeback",
        transactionStatus: "success",
        refundAmount: "1200000",
        dueAt: "2026-10-26T12:00:00.000Z",
      },
    });
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("uses resolvedAt as the time of a dispute resolution", () => {
    const e = firstEvent(
      webhook("charge.dispute.resolve", {
        id: 900009201,
        status: "resolved",
        resolution: "auto-accepted",
        category: "general",
        resolvedAt: "2026-10-24T08:00:00.000Z",
        transaction: { id: 900009202, reference: REF, status: "reversed", domain: "test" },
      }),
    );
    expect(e).toMatchObject({
      stage: "dispute",
      eventTimestamp: "2026-10-24T08:00:00.000Z",
      attributes: {
        resolution: "auto-accepted",
        resolutionKnown: true,
        transactionStatus: "reversed",
      },
    });
  });

  it("keeps a failed transfer apart from payments and reports it", () => {
    const r = analyzeFixture("transfer-failed.json");
    expect(inOrder(r).map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["transfer_response.success", "payout", "unknown"],
      ["transfer.failed", "payout", "failure"],
    ]);
    expect(inOrder(r)[0]!.attributes).toMatchObject({ queuedWithoutTransferTime: true });
    expect(inOrder(r)[1]).toMatchObject({
      paymentReference: "PPLsynth-trf-1301",
      relatedReference: "TRF_PPLsynth1301",
      eventTimestamp: "2026-10-24T09:11:06.000Z",
      attributes: {
        objectType: "transfer",
        source: "balance",
        sessionProvider: "nip",
        failuresPresent: false,
      },
    });
    expect(r.errors).toEqual([]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe("Payout failed");
  });

  it("shows a transfer waiting for its OTP and its later success", () => {
    const r = analyzeFixture("transfer-otp-then-success.json");
    expect(inOrder(r).map((e) => [e.eventType, e.outcome])).toEqual([
      ["transfer_response.otp", "pending"],
      ["transfer.success", "success"],
    ]);
    expect(inOrder(r)[1]!.eventTimestamp).toBe("2026-10-24T10:03:12.000Z");
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("maps transfer statuses, keeping undocumented ones unknown", () => {
    for (const [status, entry] of Object.entries(TRANSFER_STATUSES)) {
      const e = firstEvent({
        status: true,
        message: "Transfer retrieved",
        data: {
          transfer_code: "TRF_PPLsynth",
          titan_code: null,
          status,
          transferred_at: "2026-10-24T10:00:00.000Z",
          reference: "PPLsynth-trf",
        },
      });
      expect(e.stage, status).toBe(entry.stage);
      expect(e.outcome, status).toBe(entry.outcome);
      expect(e.eventTypeKnown, status).toBe(entry.known);
    }
    expect(
      firstEvent(
        webhook("transfer.reversed", {
          transfer_code: "TRF_PPLsynth",
          titan_code: null,
          status: "reversed",
        }),
      ),
    ).toMatchObject({ stage: "reversal", outcome: "success" });
  });

  it("follows a mobile money payment completed offline", () => {
    const r = analyzeFixture("mobile-money-pay-offline.json");
    expect(inOrder(r).map((e) => [e.eventType, e.outcome])).toEqual([
      ["charge_response.pay_offline", "pending"],
      ["transaction_response.pending", "pending"],
      ["charge.success", "success"],
    ]);
    expect(inOrder(r)[2]!.attributes).toMatchObject({
      channel: "mobile_money",
      transactionMessage: "madePayment",
    });
    expect(r.groups).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it("decodes a rejected inbound bank transfer", () => {
    const r = analyzeFixture("pay-with-transfer-rejected.json");
    expect(inOrder(r)[1]).toMatchObject({
      eventType: "bank.transfer.rejected",
      eventTypeKnown: true,
      outcome: "failure",
      attributes: { messageType: "INCORRECT_AMOUNT" },
    });
    expect(r.errors[0]).toMatchObject({
      code: "INCORRECT_AMOUNT",
      category: "invalid_amount",
      retry: "customer_action_required",
      confidence: "strong",
      providerMessage: "incorrect amount sent",
    });
    const unknown = firstError(
      webhook("bank.transfer.rejected", { message_type: "PPLSYNTH_OTHER" }),
    );
    expect(unknown).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });

  it("shows documented events outside the analyzed scope without semantics", () => {
    const r = analyzeFixture("subscription-create.json");
    expect(r.events[0]).toMatchObject({
      eventType: "subscription.create",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      attributes: { documentedEvent: true, domain: "test" },
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
    const expiring = analyze(json(webhook("subscription.expiring_cards", [{ PPLsynth: true }])));
    expect(expiring.records[0]!.status).toBe("analyzed");
  });

  it("accepts an undocumented dotted event only with Paystack fields", () => {
    const d = paystackAdapter.detect(webhook("charge.something", txn({ log: { history: [] } })));
    expect(d).toMatchObject({ format: "paystack.webhook", confidence: 0.55 });
    expect(firstEvent(webhook("charge.something", txn({ log: { history: [] } })))).toMatchObject({
      eventTypeKnown: false,
      attributes: { documentedEvent: false },
    });
  });
});

describe("paystack correlation", () => {
  it("keeps unrelated transactions apart", () => {
    const r = analyze(
      json([
        verify({ id: 900009301, reference: "PPLsynth-ref-9301" }),
        failed("Declined", { id: 900009302, reference: "PPLsynth-ref-9302" }),
      ]),
    );
    expect(r.groups).toHaveLength(2);
  });

  it("never joins a transfer and a payment that share a reference string", () => {
    const r = analyze(
      json([
        verify({ id: 900009401, reference: "PPLsynth-shared" }),
        webhook("transfer.success", {
          transfer_code: "TRF_PPLsynth9401",
          titan_code: null,
          status: "success",
          reference: "PPLsynth-shared",
          id: 900009401,
        }),
      ]),
    );
    expect(r.groups).toHaveLength(2);
    expect(paystackAdapter.correlationKeys(r.events[1]!)).toEqual(
      expect.arrayContaining(["transfer:PPLsynth-shared", "transfer_code:TRF_PPLsynth9401"]),
    );
  });

  it("links a dispute through its embedded transaction id", () => {
    const r = analyze(
      json([
        verify({ id: 900009501, reference: "PPLsynth-ref-9501" }),
        webhook("charge.dispute.remind", {
          id: 900009502,
          status: "awaiting-merchant-feedback",
          refund_amount: 10000,
          transaction: { id: 900009501, domain: "test", status: "success" },
        }),
      ]),
    );
    expect(r.groups).toHaveLength(1);
  });
});

describe("paystack redaction", () => {
  const PLANTED = [
    "AUTH_PPLsynth",
    "SIG_PPLsynth",
    "408408",
    "4081",
    "539999",
    "8877",
    "PPLsynth Cardholder Name",
    "PPLsynth Webhook Cardholder",
    "PPLsynthFirst",
    "PPLsynthLast",
    "pplsynth.",
    "+2348000000101",
    "198.51.100.23",
    "192.0.2.44",
    "PPLsynth planted",
    "PPLsynthAccess0301",
    "checkout.example",
    "0800***0301",
    "PPLsynth mobile",
    "0000001301",
    "0000001401",
    "0000001801",
    "PPLsynth Account Holder",
    "PPLsynth Checkout Account",
    "PPLsynth Recipient Name",
    "PPLsynth Merchant Ltd",
    "PPLsynthSession",
    "RCP_PPLsynth",
    "CUS_PPLsynth",
    "PPLsynthEmailToken",
    "0f3ac1PPLSYNTH",
  ];
  const FILES = [
    "verify-success.json",
    "charge-success-webhook.txt",
    "card-payment-lifecycle.json",
    "dispute-chargeback.json",
    "transfer-failed.json",
    "transfer-otp-then-success.json",
    "mobile-money-pay-offline.json",
    "pay-with-transfer-rejected.json",
    "refund-lifecycle.json",
    "subscription-create.json",
  ];

  it.each(FILES)(
    "keeps planted sensitive values out of events and the JSON report (%s)",
    (file) => {
      const r = analyzeFixture(file);
      const events = json(r.events);
      const errors = json(r.errors);
      const report = toJsonReport(r);
      const unmasked = toJsonReport(r, { includeIdentifiers: true });
      for (const v of PLANTED) {
        expect(events, `${file}: ${v}`).not.toContain(v);
        expect(errors, `${file}: ${v}`).not.toContain(v);
        expect(report, `${file}: ${v}`).not.toContain(v);
        expect(unmasked, `${file}: ${v}`).not.toContain(v);
      }
    },
  );

  it("masks identifiers in the default report", () => {
    const report = toJsonReport(analyzeFixture("verify-success.json"));
    expect(report).not.toContain("PPLsynth-ref-0101");
    expect(report).not.toContain("900000101");
  });

  it("detects the sensitive fields of the raw input", () => {
    const r = analyzeFixture("verify-success.json");
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("SENSITIVE_DATA_DETECTED");
  });
});

describe("paystack manifest and catalog", () => {
  it("exports the adapter, manifest and version", () => {
    expect(defaultExport).toBe(paystackAdapter);
    expect(manifestOnly).toBe(paystackManifest);
    expect(paystackAdapter.manifest).toBe(paystackManifest);
    expect(paystackAdapter.version).toBe(PAYSTACK_ADAPTER_VERSION);
    expect(PAYSTACK_ADAPTER_VERSION).toBe("0.1.0");
  });

  it("declares honest capabilities", () => {
    expect(paystackManifest).toMatchObject({
      id: "paystack",
      wave: 3,
      researchStatus: "tested",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      documentationAccess: "public",
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
    });
    expect(paystackManifest.categories).toEqual([
      "card_processing",
      "alternative_payment_method",
      "gateway",
    ]);
    for (const s of paystackManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/support\.paystack\.com\//);
    expect(paystackManifest.limitations.join(" ")).toMatch(/challenge page/);
    expect(paystackManifest.limitations.join(" ")).toMatch(
      /Ineligible businesses article excludes/,
    );
    expect(paystackManifest.fixtureProvenance).toMatch(/Synthetic/);
  });

  it("has the documented catalog sizes", () => {
    expect(Object.keys(ERROR_TYPES)).toHaveLength(3);
    expect(Object.keys(ERROR_CODES)).toHaveLength(8);
    expect(API_ERROR_MESSAGES).toHaveLength(37);
    expect(OUTCOME_TEXTS).toHaveLength(11);
    expect(BANK_ERRORS).toHaveLength(52);
    expect(CUSTOMER_ERRORS).toHaveLength(33);
    expect(FRAUD_ERRORS).toHaveLength(6);
    expect(SYSTEM_ERRORS).toHaveLength(20);
    expect(HELP_CENTER_MESSAGES).toHaveLength(111);
    expect(HELP_CENTER_MESSAGES.flatMap((r) => r.messages)).toHaveLength(118);
    expect(Object.keys(INBOUND_TRANSFER_MESSAGE_TYPES)).toHaveLength(1);
    expect(Object.keys(TRANSACTION_STATUSES)).toHaveLength(6);
    expect(Object.keys(CHARGE_STATES)).toHaveLength(8);
    expect(Object.keys(WEBHOOK_EVENTS).length + OTHER_WEBHOOK_EVENTS.length).toBe(35);
  });

  it("uses no em or en dash in source files", () => {
    const dir = fileURLToPath(new URL("../src/", import.meta.url));
    for (const f of readdirSync(dir)) {
      expect(readFileSync(`${dir}${f}`, "utf8"), f).not.toMatch(/[\u2013\u2014]/);
    }
    expect(json(paystackManifest)).not.toMatch(/[\u2013\u2014]/);
  });
});
