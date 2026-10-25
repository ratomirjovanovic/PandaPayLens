import { readdirSync, readFileSync, statSync } from "node:fs";
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
import {
  APM_SYSTEM_CODES,
  CARD_SYSTEM_CODES,
  CHARGEBACK_EVENTS,
  CODE_FAMILIES,
  ECOMMPAY_ADAPTER_VERSION,
  GENERAL_CODES,
  HTTP_STATUSES,
  MERCHANT_CODES,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  PAYMENT_STATUSES,
  RISK_CODES,
  ecommpayAdapter,
  ecommpayManifest,
  findCode,
} from "@pandapaylens/ecommpay";
import defaultExport from "@pandapaylens/ecommpay";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [ecommpayAdapter],
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

const operation = (fields: Record<string, unknown> = {}) => ({
  id: 9100000000999,
  type: "sale",
  status: "success",
  date: "2026-10-20T10:00:05+0000",
  request_id: "PPLsynth-req-0999",
  sum_initial: { amount: 1000, currency: "EUR" },
  code: "0",
  message: "Success",
  ...fields,
});
const callback = (
  op: Record<string, unknown> = {},
  pay: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) => ({
  project_id: 9100001,
  payment: {
    id: "PPLsynth-order-0999",
    type: "purchase",
    status: "success",
    date: "2026-10-20T10:00:05+0000",
    sum: { amount: 1000, currency: "EUR" },
    ...pay,
  },
  operation: operation(op),
  signature: "UFBMc3ludGhUZXN0U2lnbmF0dXJl",
  ...extra,
});
const statusResponse = (
  pay: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) => ({
  project_id: 9100001,
  payment: {
    id: "PPLsynth-order-0998",
    type: "purchase",
    status: "success",
    date: "2026-10-20T10:00:05+0000",
    sum: { amount: 1000, currency: "EUR" },
    ...pay,
  },
  operations: [],
  ...extra,
});
const declined = (code: unknown, fields: Record<string, unknown> = {}) =>
  callback({ status: "decline", code, message: "m", ...fields }, { status: "decline" });
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;
const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json; charset=UTF-8", "", json(body)].join(
    "\n",
  );

describe("ecommpay detection", () => {
  const { signature: _s, ...unsigned } = callback();
  it.each([
    [callback(), "ecommpay.callback", 0.95, true],
    [unsigned, "ecommpay.callback", 0.85, true],
    [statusResponse({}, { operations: [operation()] }), "ecommpay.payment_status", 0.85, true],
    [statusResponse(), "ecommpay.payment_status", 0.65, true],
    [{ ...callback(), last_failed_request: {} }, "ecommpay.payment_status", 0.95, true],
    [
      { payment: { id: "PPLsynth-x", status: "something" }, operation: { type: "x" } },
      "ecommpay.callback",
      0.35,
      true,
    ],
    [
      {
        event: "new_chargebacks_summary",
        event_date: "2026-10-20T12:00:00+0000",
        project_id: 1,
        chargeback_count: 1,
      },
      "ecommpay.chargeback_callback",
      0.95,
      true,
    ],
    [{ event: "chargeback_won" }, "ecommpay.chargeback_callback", 0.6, true],
    [
      { general: { project_id: 1 }, request: { action: "tokenize" }, token_status: "active" },
      "ecommpay.token_callback",
      0.9,
      false,
    ],
    [
      { status: "success", request_id: "r", project_id: 1, payment_id: "p" },
      "ecommpay.request_accepted",
      0.85,
      true,
    ],
    [
      { status: "success", request_id: "r", payment_id: "p" },
      "ecommpay.request_accepted",
      0.4,
      true,
    ],
    [{ status: "error", code: "2003", message: "x" }, "ecommpay.request_error", 0.5, true],
    [{ status: "error", code: 1405, message: "x" }, "ecommpay.request_error", 0.5, true],
    [{ status: "error", code: "10105", message: "x" }, "ecommpay.request_error", 0.3, true],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(ecommpayAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("reads a single-operation record as a status response when it is an HTTP response", () => {
    const meta = {
      format: "http" as const,
      http: { kind: "response" as const, status: 200, headers: {} },
    };
    expect(ecommpayAdapter.detect(callback(), meta).format).toBe("ecommpay.payment_status");
  });

  it("raises an unknown request error code only with a documented HTTP status", () => {
    const meta = (status: number) => ({
      format: "http" as const,
      http: { kind: "response" as const, status, headers: {} },
    });
    const body = { status: "error", code: "7777", message: "x" };
    expect(ecommpayAdapter.detect(body, meta(500)).confidence).toBe(0.5);
    expect(ecommpayAdapter.detect(body, meta(418)).confidence).toBe(0.3);
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "ecommpay", message: "Ecommpay error" },
      "ecommpay",
      null,
      [],
      { error: { code: "2003" } },
      { status: "success" },
      { status: "error" },
      { status: "error", code: "abc", message: "x" },
      { status: "error", code: "2003", message: "x", detail: "extra" },
      { payment: { id: "p", status: "success" } },
      { payment: { id: 1, status: "success" }, operation: {} },
      { event: "charge.dispute.created", event_date: "x" },
      { object: "event", payment: { id: "p", status: "success" }, operation: {} },
      { general: { project_id: 1 }, request: { action: "sale" } },
    ]) {
      expect(ecommpayAdapter.detect(input).confidence).toBe(0);
    }
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "ecommpay" &&
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
          ecommpayAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("ecommpay parsing", () => {
  it("reports missing required callback fields as parse issues without throwing", () => {
    const { project_id: _p, ...noProject } = callback();
    const r = analyze(json(noProject));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "ecommpay.callback" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^project_id:/);
    expect(r.events).toEqual([]);

    const noType = callback();
    delete (noType.operation as Record<string, unknown>).type;
    const r2 = analyze(json(noType));
    expect(r2.records[0]!.status).toBe("invalid");
    expect(r2.records[0]!.reasons.join(" ")).toMatch(/operation\.type/);
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(ecommpayAdapter.parse(callback({ status: 7 }), "ecommpay.callback").ok).toBe(false);
    expect(ecommpayAdapter.parse({}, "ecommpay.unknown").ok).toBe(false);
    expect(ecommpayAdapter.parse({}, "toString").ok).toBe(false);
    expect(ecommpayAdapter.parse({}, "ecommpay.token_callback").ok).toBe(false);
  });

  it("tolerates unknown fields, null values and numeric codes", () => {
    const p = ecommpayAdapter.parse(
      callback({ code: 0, provider: null, brand_new: [1] }, { region: null }),
      "ecommpay.callback",
    );
    expect(p.ok).toBe(true);
    expect(firstEvent(callback({ code: 0 })).attributes.operationCode).toBe("0");
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"project_id": 1, "payment": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });

  it("recognizes but does not analyze token callbacks", () => {
    const r = analyzeFixture("ecommpay/token-callback.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "ecommpay.token_callback",
    });
    expect(r.warnings[0]!.message).toMatch(/token callbacks/);
    expect(r.events).toEqual([]);
    expect(toJsonReport(r)).not.toContain("PLANTEDTOKENVALUE0001");
  });
});

describe("ecommpay callbacks and status responses", () => {
  it("normalizes a successful sale callback", () => {
    const r = analyzeFixture("ecommpay/sale-success-callback.json");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "ecommpay.callback" });
    expect(r.events[0]).toMatchObject({
      eventType: "sale.success",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "success",
      paymentReference: "PPLsynth-order-0001",
      relatedReference: "9100000000001",
      amountMinor: "12550",
      currency: "EUR",
      eventTimestamp: "2026-10-20T10:00:05.000Z",
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      eventTypeInferred: true,
      operationType: "sale",
      operationStatus: "success",
      operationCode: "0",
      operationCodeFamily: "general",
      paymentStatus: "success",
      paymentType: "purchase",
      paymentMethod: "card",
      eci: "05",
      requestId: "PPLsynth-req-0001",
      operationCreatedAt: "2026-10-20T10:00:00.000Z",
      convertedAmountMinor: "12550",
      providerPaymentId: "PPLsynth-prov-0001",
      providerResultCode: "00",
      providerResultMessage: "Approved",
      isNewAttemptsAvailable: false,
      signaturePresent: true,
      timestampSource: "operation.date",
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("decodes a card system decline", () => {
    const r = analyzeFixture("ecommpay/sale-declined-callback.json");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "10105",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Insufficient funds on customer account",
      paymentReference: "PPLsynth-order-0002",
      attemptReference: "9100000000002",
      subCodes: {
        code_family: "card_system",
        operation_type: "sale",
        operation_status: "decline",
        payment_status: "decline",
        provider_result_code: "51",
      },
      source: { path: "operation" },
    });
    expect(r.errors[0]!.explanation).toMatch(/external card payment system code 10105/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/without interpretation/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("builds one timeline for a two-step payment and its status response", () => {
    const r = analyzeFixture("ecommpay/two-step-flow.json");
    expect(r.groups).toHaveLength(1);
    expect(
      r.events.map((e) => [e.sourceFormat, e.eventType, e.stage, e.outcome, e.amountMinor]),
    ).toEqual([
      ["ecommpay.callback", "auth.success", "authorization", "success", "9900"],
      ["ecommpay.payment_status", "auth.success", "authorization", "success", "9900"],
      ["ecommpay.callback", "capture.success", "capture", "success", "9900"],
      ["ecommpay.payment_status", "capture.success", "capture", "success", "9900"],
      ["ecommpay.payment_status", "refund.success", "refund", "success", "2000"],
    ]);
    expect(r.events[0]!.attributes.paymentStatus).toBe("awaiting capture");
    expect(r.events[4]!.attributes).toMatchObject({
      paymentStatus: "partially refunded",
      paymentAmountMinor: "7900",
    });
    // Status responses are not callbacks, so nothing is inferred there.
    expect(r.events[1]!.attributes.eventTypeInferred).toBeUndefined();
    expect(r.events[1]!.source.path).toBe("operations[0]");
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("keeps unrelated payments apart", () => {
    const r = analyzeFixture("ecommpay/unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.latestOutcome)).toEqual(["failure", "success"]);
    expect(r.errors[0]).toMatchObject({ code: "10201", category: "card_declined" });
  });

  it("does not invent a delivery key for repeated callbacks", () => {
    const r = analyzeFixture("ecommpay/duplicate-callback.json");
    expect(r.events).toHaveLength(2);
    expect(r.events.map((e) => e.deliveryKey)).toEqual([undefined, undefined]);
    expect(r.events.map((e) => e.observedTimestamp)).toEqual([
      "2026-10-20T14:00:06.000Z",
      "2026-10-20T14:00:21.000Z",
    ]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(ecommpayManifest.delivery.duplicateKey).toMatch(/none documented/);
    expect(ecommpayManifest.delivery.dedupeAdvice).toMatch(/newer data/);
  });

  it("never presents a timeout as safe to retry", () => {
    const r = analyzeFixture("ecommpay/timeout-decline.json");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "10602",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.explanation).toMatch(/downgrades/);
    expect(e.retryExplanation).toMatch(/status request/);
    expect(e.retryExplanation).toMatch(/3041/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it.each([
    ["3021", "card_declined", "customer_action_required", "strong"],
    ["402", "fraud_or_risk", "do_not_retry", "strong"],
    ["1408", "fraud_or_risk", "do_not_retry", "strong"],
    ["1409", "rate_limiting", "retry_conditionally", "strong"],
    ["10403", "authentication_required", "customer_action_required", "strong"],
    ["10722", "authentication_required", "manual_review", "strong"],
    ["10000", "card_declined", "retry_conditionally", "strong"],
    ["20103", "authentication_failed", "customer_action_required", "strong"],
    ["20000", "unknown", "retry_conditionally", "possible"],
    ["30302", "network_or_timeout", "do_not_retry", "strong"],
    ["3320", "rate_limiting", "retry_conditionally", "strong"],
    ["3041", "duplicate_request", "do_not_retry", "strong"],
    ["3201", "configuration", "manual_review", "possible"],
    ["602", "network_or_timeout", "retry_conditionally", "strong"],
    ["314", "provider_unavailable", "safe_to_retry_technical_request", "strong"],
  ])("decodes operation code %s as %s / %s", (code, category, retry, confidence) => {
    expect(firstError(declined(code))).toMatchObject({ code, category, retry, confidence });
  });

  it("adds Ecommpay's risk control action and keeps families apart", () => {
    const e = firstError(declined("1450"));
    expect(e.subCodes.code_family).toBe("risk");
    expect(e.explanation).toMatch(/no action is required/);
    // Checkout.com uses 10000 for approvals; for Ecommpay it is a card system decline.
    expect(findCode("10000")).toMatchObject({ family: "card_system", entry: { kind: "decline" } });
    const keys = CODE_FAMILIES.flatMap(([, t]) => Object.keys(t));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not decode success and pending codes", () => {
    expect(analyze(json(callback())).errors).toEqual([]);
    for (const code of ["9999", "19999", "29999", "20802", "20899"]) {
      const r = analyze(json(callback({ status: "processing", code }, { status: "processing" })));
      expect(r.errors).toEqual([]);
      expect(r.events[0]!.outcome).toBe("pending");
    }
  });

  it("reports unrecognized codes and code-less declines honestly", () => {
    const unknown = firstError(declined("77777"));
    expect(unknown).toMatchObject({
      code: "77777",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/77777/);
    expect(unknown.subCodes.code_family).toBeUndefined();
    const bare = firstError(declined(undefined));
    expect(bare).toMatchObject({ code: "decline", confidence: "insufficient" });
    expect(bare.missingInformation.join(" ")).toMatch(/configurable per project/);
    // An unknown code on a successful operation is not an error.
    expect(analyze(json(callback({ code: "77777" }))).errors).toEqual([]);
  });

  it.each([
    ["sale", "success", "payment", "success"],
    ["auth", "success", "authorization", "success"],
    ["capture", "decline", "capture", "failure"],
    ["cancel", "success", "cancellation", "success"],
    ["incremental", "success", "authorization", "success"],
    ["refund", "processing", "refund", "pending"],
    ["reversal", "success", "reversal", "success"],
    ["payment confirmation", "awaiting merchant auth", "other", "pending"],
    ["recurring", "success", "payment", "success"],
    ["recurring_update", "success", "subscription", "success"],
    ["recurring_cancel", "success", "cancellation", "success"],
    ["payout", "awaiting payout completion", "payout", "pending"],
    ["payout reversal", "success", "reversal", "success"],
    ["account verification", "decline", "other", "failure"],
    ["invoice", "invoice sent", "other", "pending"],
    ["invoice", "expired", "other", "failure"],
    ["contract registration", "awaiting clarification", "other", "pending"],
    ["sale", "awaiting redirect result", "payment", "pending"],
  ])("maps operation %s with status %s to %s / %s", (type, status, stage, outcome) => {
    const e = firstEvent(callback({ type, status, code: undefined }));
    expect(e).toMatchObject({ stage, outcome, eventTypeKnown: true, providerStatus: status });
    expect(e.eventType).toBe(`${type}.${status}`);
  });

  it("keeps undocumented operation types and statuses unknown", () => {
    const e = firstEvent(callback({ type: "mystery" }));
    expect(e).toMatchObject({ stage: "other", outcome: "success", eventTypeKnown: false });
    expect(e.attributes.operationTypeKnown).toBe(false);
    const s = firstEvent(callback({ status: "error" }));
    expect(s).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    // account_verification is the payment.type spelling, not an operation type.
    expect(firstEvent(callback({ type: "account_verification" })).eventTypeKnown).toBe(false);
    const r = analyze(json(callback({ status: "Success" })));
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("uses the aggregate payment status when a status response has no operations", () => {
    for (const [status, stage, outcome] of [
      ["refunded", "refund", "success"],
      ["awaiting capture", "authorization", "success"],
      ["awaiting customer", "payment", "pending"],
      ["scheduled recurring processing", "subscription", "pending"],
      ["canceled", "cancellation", "success"],
      ["error", "payment", "failure"],
    ] as const) {
      const e = firstEvent(statusResponse({ status }));
      expect(e).toMatchObject({ eventType: `payment.${status}`, stage, outcome });
      expect(e.attributes.noOperations).toBe(true);
    }
    expect(firstEvent(statusResponse({ status: "mystery" }))).toMatchObject({
      outcome: "unknown",
      eventTypeKnown: false,
    });
    const err = firstError(statusResponse({ status: "decline" }));
    expect(err).toMatchObject({ code: "decline", confidence: "insufficient" });
    expect(err.missingInformation[0]).toMatch(/no operations and no errors/);
  });

  it("decodes failed operations and errors[] in a status response", () => {
    const r = analyzeFixture("ecommpay/status-response-errors.json");
    expect(r.records[0]!.format).toBe("ecommpay.payment_status");
    expect(r.errors.map((e) => [e.code, e.category, e.retry, e.source.path])).toEqual([
      ["1405", "fraud_or_risk", "do_not_retry", "operations[0]"],
      ["3020", "invalid_request", "do_not_retry", "errors[0]"],
    ]);
    expect(r.errors[1]).toMatchObject({
      providerMessage: "Card expiry date is required",
      subCodes: { code_family: "general", field: "card.year" },
      paymentReference: "PPLsynth-order-0111",
    });
    expect(r.errors[1]!.explanation).toMatch(/Expiry required/);
  });

  it("keeps a payout apart from payments and decodes the payout decline", () => {
    const r = analyzeFixture("ecommpay/payout-declined.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payout.awaiting payout completion", "payout", "pending"],
      ["payout.decline", "payout", "failure"],
    ]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "3104",
      category: "invalid_amount",
      retry: "do_not_retry",
    });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("marks COF debits as recurring and reports the failed rebill", () => {
    const r = analyzeFixture("ecommpay/recurring-declined.json");
    expect(
      r.events.map((e) => [e.stage, e.outcome, e.isRecurring, e.subscriptionReference]),
    ).toEqual([
      ["payment", "success", true, "9300000001"],
      ["payment", "failure", true, "9300000001"],
    ]);
    expect(r.events[1]!.attributes).toMatchObject({
      recurringStatus: "active",
      recurringRegisterPaymentId: "PPLsynth-cof-register-0090",
    });
    // Each debit is its own payment; the series id is not used as a link.
    expect(r.groups).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({
      code: "10112",
      category: "insufficient_funds",
      retry: "retry_conditionally",
    });
    expect(ruleIds(r)).toContain("RECURRING_PAYMENT_FAILED");
  });

  it("shows a 3-D Secure wait as pending without copying the ACS data", () => {
    const r = analyzeFixture("ecommpay/three-ds-pending.json");
    expect(r.events[0]).toMatchObject({ outcome: "pending", stage: "payment" });
    expect(r.events[0]!.attributes.pendingAction).toEqual(["acs"]);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
    const dump = JSON.stringify(r.events) + toJsonReport(r);
    expect(dump).not.toMatch(/PLANTEDPAREQ0001|PLANTEDMD0001|PLANTEDACSURL/);
  });

  it("links an accepted request to its later callback", () => {
    const accepted = JSON.parse(fixture("ecommpay/request-accepted.json")) as Record<
      string,
      unknown
    >;
    const later = callback({}, { id: "PPLsynth-order-0041" });
    const r = analyze(json([accepted, later]));
    expect(r.events.find((e) => e.sourceFormat === "ecommpay.request_accepted")).toMatchObject({
      stage: "other",
      outcome: "pending",
      paymentReference: "PPLsynth-order-0041",
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
  });

  it("drops payment ids that contain personal data", () => {
    const e = firstEvent(callback({}, { id: "someone@example.com" }));
    expect(e.paymentReference).toBeUndefined();
  });
});

describe("ecommpay request errors", () => {
  it("decodes a validation error with its HTTP status", () => {
    const r = analyzeFixture("ecommpay/request-error-validation.txt");
    expect(r.suggestedView).toBe("decoder");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 400",
    });
    expect(r.errors[0]).toMatchObject({
      code: "2004",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Required field is missing",
      subCodes: { code_family: "general", http_status: "400" },
    });
    expect(r.errors[0]!.explanation).toMatch(/not a payment status/);
  });

  it.each([
    ["3261", "configuration", "do_not_retry"],
    ["3123", "configuration", "do_not_retry"],
  ])("decodes authentication failure %s", (code, category, retry) => {
    const r = analyze(httpResponse(403, { status: "error", code, message: "Invalid signature" }));
    expect(r.errors[0]).toMatchObject({ code, category, retry });
  });

  it("treats an internal error as an unknown outcome", () => {
    const r = analyze(httpResponse(500, { status: "error", code: "501", message: "Internal" }));
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(r.errors[0]).toMatchObject({ category: "provider_unavailable", retry: "manual_review" });
  });

  it.each([
    [500, "provider_unavailable", "retry_conditionally", "possible"],
    [422, "invalid_request", "do_not_retry", "possible"],
  ])("falls back to HTTP %i for unknown codes", (status, category, retry, confidence) => {
    const r = analyze(httpResponse(status, { status: "error", code: "7777", message: "x" }));
    expect(r.errors[0]).toMatchObject({ category, retry, confidence });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/7777/);
  });

  it("does not analyze an unknown code without structure", () => {
    const r = analyze(json({ status: "error", code: "7777", message: "x" }));
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.errors).toEqual([]);
  });
});

describe("ecommpay chargebacks", () => {
  it("links detailed chargebacks to the disputed operation", () => {
    const r = analyzeFixture("ecommpay/chargeback-flow.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus])).toEqual([
      ["sale.success", "payment", "success", "success"],
      ["new_chargeback_details", "dispute", "pending", "NEW"],
      ["chargeback_won", "dispute", "success", "WON"],
    ]);
    expect(r.events[1]).toMatchObject({
      paymentReference: "9100000000101",
      relatedReference: "PPLsynth-cb-0001",
      eventTimestamp: "2026-10-01T12:00:00.000Z",
    });
    expect(r.events[1]!.attributes).toMatchObject({
      callbackSigned: false,
      callbackResent: false,
      paymentReferenceField: "chargebacks[].operation_id",
      caseId: "PPLsynth-case-0001",
      cardType: "visa",
      reasonCode: "10.4",
      reasonCodeInterpreted: false,
    });
    expect(r.errors).toEqual([]);
    const finding = r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED")!;
    expect(finding.title).toBe("Chargeback after a successful payment");
    expect(JSON.stringify(r.events) + toJsonReport(r)).not.toMatch(/PLANTEDARN|9400001/);
  });

  it("shows a summary without a payment link", () => {
    const r = analyzeFixture("ecommpay/chargeback-summary.json");
    expect(r.events[0]).toMatchObject({
      eventType: "new_chargebacks_summary",
      stage: "dispute",
      outcome: "unknown",
    });
    expect(r.events[0]!.attributes.chargebackCount).toBe(3);
    expect(ruleIds(r)).toContain("MISSING_REFERENCE");
  });

  it("documents every chargeback event", () => {
    expect(Object.keys(CHARGEBACK_EVENTS)).toHaveLength(9);
    expect(
      firstEvent({ event: "chargeback_lost", chargebacks: [{ operation_id: 1 }] }).outcome,
    ).toBe("failure");
  });
});

describe("ecommpay sensitive data", () => {
  const PLANTED = [
    "411111PLANTED1111",
    "PLANTEDACCOUNTTOKEN01",
    "PLANTEDACCOUNTID01",
    "Planted Holder Name",
    "planted.person@example.com",
    "+440000PLANTED",
    "PlantedFirst",
    "PlantedLast",
    "198.51.100.88",
    "88 Planted Synthetic Street",
    "PL88NT",
    "PLANTEDAVSPOST",
    "PLANTEDAVSSTREET",
    "PLANTEDAUTHCODE",
    "PLANTEDREDIRECTURL",
    "PLANTEDSESSIONTOKEN",
    "PLANTEDQRDATA",
    "PLANTEDCREQ",
    "planted.dashboard.user@example.com",
    "PLANTEDSCHEMEID01",
    "PLANTEDLINKID01",
    "PLANTEDSIG",
    "UExBTlRFRFNJR05BVFVSRVZBTFVFMDAwMQ",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("ecommpay/callback-request.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "ecommpay.callback" });
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.events[0]!.attributes).toMatchObject({ signaturePresent: true });
    expect(r.events[0]!.attributes.pendingAction).toEqual([
      "threeds2",
      "redirect_data",
      "display_data",
    ]);
    expect(r.errors[0]).toMatchObject({ code: "3021", category: "card_declined" });
  });
});

describe("ecommpay manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(ecommpayAdapter);
    expect(ecommpayAdapter.manifest).toBe(ecommpayManifest);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(ecommpayManifest).toMatchObject({
      id: "ecommpay",
      version: ECOMMPAY_ADAPTER_VERSION,
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      capabilities: {
        errorDecoding: "supported",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "supported",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect([...ecommpayManifest.categories].sort()).toEqual([
      "acquiring",
      "card_processing",
      "gateway",
      "orchestration",
    ]);
    expect(ecommpayManifest.sectors).toHaveLength(3);
    for (const s of ecommpayManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/developers\.ecommpay\.com\/en\//);
    expect(ecommpayManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(
      /gambl|gaming|adult/,
    );
    const limits = ecommpayManifest.limitations.join(" ");
    expect(limits).toMatch(/unsigned/);
    expect(limits).toMatch(/never resent/);
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/no delivery key is set/);
    expect(limits).toMatch(/added, removed or renamed/);
    expect(limits).toMatch(/not a statement that gambling merchants are accepted/);
  });

  it("contains every documented code and status", () => {
    expect(Object.keys(GENERAL_CODES)).toHaveLength(237);
    expect(Object.keys(RISK_CODES)).toHaveLength(40);
    expect(Object.keys(CARD_SYSTEM_CODES)).toHaveLength(58);
    expect(Object.keys(APM_SYSTEM_CODES)).toHaveLength(48);
    expect(Object.keys(MERCHANT_CODES)).toHaveLength(6);
    expect(CODE_FAMILIES.reduce((n, [, t]) => n + Object.keys(t).length, 0)).toBe(389);
    expect(Object.keys(PAYMENT_STATUSES)).toHaveLength(23);
    expect(Object.keys(OPERATION_STATUSES)).toHaveLength(13);
    expect(Object.keys(OPERATION_TYPES)).toHaveLength(16);
    expect(Object.keys(HTTP_STATUSES)).toHaveLength(4);
    for (const code of ["3305", "3340", "3412", "3419", "3626", "3635", "1499", "101021"])
      expect(findCode(code)).toBeDefined();
    expect(findCode("3341")!.entry.category).toBe("payment_method_unavailable");
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      ecommpayManifest,
      GENERAL_CODES,
      RISK_CODES,
      CARD_SYSTEM_CODES,
      APM_SYSTEM_CODES,
      MERCHANT_CODES,
      PAYMENT_STATUSES,
      OPERATION_STATUSES,
      OPERATION_TYPES,
      CHARGEBACK_EVENTS,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
