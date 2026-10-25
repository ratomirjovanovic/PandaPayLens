import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeSources,
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
  type NormalizedEvent,
  type RecordMeta,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  ATTEMPT_STATUSES,
  ERROR_TITLES,
  EXAMPLE_ONLY_REASONS,
  HTTP_STATUSES,
  INPAY_ADAPTER_VERSION,
  JWT_ERRORS,
  NUMERIC_ERRORS,
  ORDER_REASONS,
  ORDER_REASON_HINTS,
  ORDER_STATUSES,
  PAYMENT_TYPES,
  PAYOUT_REASONS,
  PAYOUT_STATES,
  REFUND_STATUSES,
  inpayAdapter,
  inpayManifest,
} from "@pandapaylens/inpay";
import defaultExport from "@pandapaylens/inpay";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [inpayAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(path));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const http = (status: string, body: unknown) =>
  [`HTTP/1.1 ${status}`, "Content-Type: application/json", "", json(body)].join("\n");
const webhook = (body: unknown, headers: string[] = []) =>
  [
    "POST /webhooks/inpay HTTP/1.1",
    "Content-Type: application/json",
    ...headers,
    "",
    json(body),
  ].join("\n");
const inpayOnly = { provider: "inpay" };
const byType = (r: AnalysisResult, prefix: string) =>
  r.events.filter((e) => e.eventType.startsWith(prefix));

const payout = (fields: Record<string, unknown> = {}) => ({
  debtor_account: { id: "PPLSYNTH-VACCOUNT-0900", scheme_name: "VirtualAccount" },
  end_to_end_id: "PPLsynth-e2e-0900",
  inpay_unique_reference: "PPLsynthPO0900",
  amount: "100.00",
  currency: "EUR",
  timestamp: "2026-10-20 10:00:00",
  state: "processing",
  ...fields,
});
const order = (fields: Record<string, unknown> = {}) => ({
  business_unit: "default",
  amount: "10.00",
  amount_cents: 1000,
  currency: "EUR",
  language: "en",
  uuid: "0b1c2d3e-4f50-4a61-8b72-c3d4e5f60900",
  back_to_merchant_url: "https://merchant.example.test/back",
  reference: "PPLsynth-order-0900",
  status: "processing",
  status_reasons: [],
  refund: null,
  payments: [],
  primary_payment: null,
  ...fields,
});
const attemptOf = (type: string, status: string) => ({
  uuid: "1a2b3c4d-5e6f-4a70-8b81-92a3b4c50900",
  type,
  status,
  inpay_unique_reference: "PPLSYNTH900",
});
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const lastEvent = (v: unknown) => analyze(json(v)).events.at(-1)!;

describe("inpay detection", () => {
  it.each([
    [payout(), "inpay.payout", 0.93],
    [payout({ reasons: [{ category: "vop_info", code: "match" }] }), "inpay.payout", 0.98],
    [{ inpay_unique_reference: "x", state: "completed" }, "inpay.payout", 0.7],
    [{ inpay_unique_reference: "x", end_to_end_id: "y" }, "inpay.payout", 0.65],
    [{ inpay_unique_reference: "x", state: "brand_new" }, "inpay.payout", 0.55],
    [order(), "inpay.order", 0.98],
    [
      { amount: "1.00", amount_cents: 100, primary_payment: "x", status: "completed" },
      "inpay.order",
      0.72,
    ],
    [
      { uuid: "x", status: "cancelled", status_reasons: [], primary_payment: null },
      "inpay.order",
      0.69,
    ],
    [{ errors: [{ title: "Not authorized", code: "jwt_iat_too_old" }] }, "inpay.error", 0.75],
    [{ errors: [{ title: "Resource not found", code: 2001 }] }, "inpay.error", 0.7],
    [{ error: { code: 1002, title: "Resource not found", details: "x" } }, "inpay.error", 0.8],
    [{ error: { code: 1001, title: "Other" } }, "inpay.error", 0.7],
    [{ error: { details: { inpay_unique_reference: ["must be filled"] } } }, "inpay.error", 0.75],
    [{ errors: [{ title: "Invalid", detail: { end_to_end_id: ["taken"] } }] }, "inpay.error", 0.75],
    [{ message: "Missing X-Auth-Uuid / X-Request-ID" }, "inpay.error", 0.7],
  ])("detects %j", (input, format, confidence) => {
    expect(inpayAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("uses the HTTP status only to raise documented error shapes slightly", () => {
    const meta = (status: number): RecordMeta => ({
      format: "http",
      http: { kind: "response", status, headers: {} },
    });
    const message = { message: "Missing X-Auth-Uuid / X-Request-ID" };
    expect(inpayAdapter.detect(message, meta(412)).confidence).toBe(0.8);
    const generic = { errors: [{ title: "Not authorized" }] };
    expect(inpayAdapter.detect(generic).confidence).toBe(0.35);
    expect(inpayAdapter.detect(generic, meta(401)).confidence).toBe(0.45);
    expect(inpayAdapter.detect(generic, meta(418)).confidence).toBe(0.35);
  });

  it("keeps generic shapes at or below 0.5 and ignores the provider name", () => {
    for (const input of [
      { errors: [{ title: "Not authorized" }] },
      { errors: [{ title: "Validation Error", detail: { country: ["is missing"] } }] },
      { error: { title: "Validation Error", details: "x" } },
      { error: { details: { amount: ["must be filled"] } } },
    ]) {
      expect(inpayAdapter.detect(input).confidence, json(input)).toBeLessThanOrEqual(0.5);
    }
    for (const input of [
      { provider: "Inpay", message: "Inpay error" },
      "inpay",
      null,
      [],
      {},
      { status: "completed" },
      { state: "completed" },
      { amount: "1.00", amount_cents: 100, status: "completed" },
      { status_reasons: [] },
      { primary_payment: "x" },
      { inpay_unique_reference: "x" },
      { errors: [] },
      { errors: ["x"] },
      { errors: [{ title: "x", category: "API_ERROR" }] },
      { errors: [{ detail: "x" }] },
      { error: "x" },
      { error: { message: "x" } },
      { error: { code: 1001, title: "Validation Error" }, status: 400 },
      { message: "Something failed" },
      { message: "Missing X-Auth-Uuid", status: 412 },
      { object: "event", inpay_unique_reference: "x", state: "completed" },
    ]) {
      expect(inpayAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("returns confidence 0 for every record of the other providers' fixtures", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "inpay")
      .map((d) => d.name);
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "trustly", "mifinity"]));
    let checked = 0;
    for (const dir of dirs) {
      const files = readdirSync(`${root}${dir}`);
      if (files.length === 0) continue;
      for (const file of files) {
        const parsed = parseInput(readFileSync(`${root}${dir}/${file}`, "utf8"));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const r = record as Record<string, unknown>;
          const payload =
            r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
              ? r.payload
              : record;
          expect(
            inpayAdapter.detect(payload, parsed.value.meta[i]).confidence,
            `${dir}/${file} record ${i}`,
          ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("inpay parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noState = analyze(json({ inpay_unique_reference: "PPLsynthPO0901", end_to_end_id: "e" }));
    expect(noState.records[0]).toMatchObject({ status: "invalid", format: "inpay.payout" });
    expect(noState.records[0]!.reasons.join(" ")).toMatch(/^state:/);
    expect(noState.events).toEqual([]);

    const noUuid = analyze(json(order({ uuid: undefined })));
    expect(noUuid.records[0]).toMatchObject({ status: "invalid", format: "inpay.order" });
    expect(noUuid.records[0]!.reasons.join(" ")).toMatch(/uuid/);

    const noStatus = inpayAdapter.parse(order({ status: undefined }), "inpay.order");
    expect(!noStatus.ok && noStatus.issues.join(" ")).toMatch(/^status:/);
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(inpayAdapter.parse(payout({ state: 7 }), "inpay.payout").ok).toBe(false);
    expect(inpayAdapter.parse(order({ payments: "x" }), "inpay.order").ok).toBe(false);
    expect(inpayAdapter.parse({ errors: [] }, "inpay.error").ok).toBe(false);
    expect(inpayAdapter.parse({ message: 5 }, "inpay.error").ok).toBe(false);
    expect(inpayAdapter.parse({}, "inpay.unknown").ok).toBe(false);
    expect(inpayAdapter.parse({}, "toString").ok).toBe(false);
  });

  it("tolerates unknown fields and null values", () => {
    const e = firstEvent(payout({ brandNew: [1], reasons: null, end_to_end_id: null }));
    expect(e).toMatchObject({ paymentReference: "PPLsynthPO0900", amountMinor: "10000" });
    expect(e.merchantReference).toBeUndefined();
    const o = lastEvent(order({ brandNew: { a: 1 }, expires_at: null, refund: null }));
    expect(o).toMatchObject({ eventType: "order.processing", amountMinor: "1000" });
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"inpay_unique_reference": "x", "state": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });

  it("reports ISO 20022 XML status reports as unsupported records", () => {
    const r = analyzeText(fixture("inpay/iso20022-rejected-status.xml"), options);
    expect(r).toMatchObject({
      ok: true,
      result: { records: [{ status: "unsupported" }], events: [] },
    });
  });
});

describe("inpay payouts", () => {
  it("links a payout from request to completion and keeps completed apart from final credit", () => {
    const r = analyzeFixture("inpay/payout-flow.json");
    expect(r.records.map((x) => x.format)).toEqual([
      "inpay.payout",
      "inpay.payout",
      "inpay.payout",
    ]);
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payout.received", "pending"],
      ["payout.processing", "pending"],
      ["payout.completed", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual(["PPLsynthPO0001", "e2e:PPLsynth-e2e-0001"]);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    const completed = r.events[2]!;
    expect(completed).toMatchObject({
      stage: "payout",
      providerStatus: "completed",
      paymentReference: "PPLsynthPO0001",
      merchantReference: "PPLsynth-e2e-0001",
      amountMinor: "25000",
      currency: "EUR",
      observedTimestamp: "2026-10-20T10:15:31.000Z",
    });
    expect(completed.eventTimestamp).toBeUndefined();
    expect(completed.deliveryKey).toBeUndefined();
    expect(completed.attributes).toMatchObject({
      stateFinal: false,
      stateNote: "A completed payout can still move to returned.",
      debtorAccountScheme: "VirtualAccount",
      providerTimestamp: "2026-10-20 10:15:30",
      timestampZone: "not documented (not placed on the timeline)",
    });
    expect(String(completed.attributes.stateMeaning)).toMatch(/not confirmed credit/);
    expect(r.events[1]!.attributes.verificationOfPayee).toBe("match");
    expect(r.events[0]!.attributes.stateMeaning).toMatch(/received/);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("decodes a rejected payout webhook with its reason and keeps the signature unverified", () => {
    const r = analyzeFixture("inpay/payout-rejected-webhook.txt");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "payout.rejected",
      stage: "payout",
      outcome: "failure",
      eventReference: "PPLsynth-req-0002",
      deliveryKey: "x-request-id:PPLsynth-req-0002",
      amountMinor: "7550",
    });
    expect(e.attributes).toMatchObject({
      deliveredAs: "webhook (HTTP request)",
      signatureVerified: false,
      authorizationHeaderPresent: true,
      verificationOfPayee: "no_match",
      reasonCodes: ["invalid_data/invalid_data_incorrect_account_number", "vop_info/no_match"],
    });
    // The Verification of Payee result is informational and not decoded.
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "invalid_data_incorrect_account_number",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "PPLsynthPO0002",
      subCodes: {
        state: "rejected",
        category: "invalid_data",
        detail_fields: "creditor_account.iban",
      },
      providerMessage: "[redacted] is not a valid IBAN",
      source: { path: "reasons[0]" },
    });
    expect(r.errors[0]!.explanation).toMatch(/Cancelled row/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://app.inpay.com/docs/assets/reason-codes-payouts-CcF-BJLu.js",
    );
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("recognizes a redelivered webhook by its X-Request-ID", () => {
    const text = fixture("inpay/payout-webhook-completed.txt");
    const r = analyzeSources(
      [
        { name: "first", text },
        { name: "second", text },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.events).toHaveLength(2);
    expect(r.result.groups).toHaveLength(1);
    const finding = r.result.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(finding.explanation).toMatch(/X-Request-ID/);
    expect(finding.explanation).toMatch(/documents that it can deliver the same notification/);
  });

  it("does not use a response X-Request-ID as a delivery key", () => {
    const r = analyze(
      [
        "HTTP/1.1 200 OK",
        "Content-Type: application/json",
        "X-Request-ID: PPLsynth-req-0950",
        "",
        json(payout()),
      ].join("\n"),
    );
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.events[0]!.eventReference).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      deliveredAs: "API response",
      requestIdEchoed: true,
      httpStatus: 200,
    });
    expect(r.events[0]!.attributes.signatureVerified).toBeUndefined();
  });

  it("shows a payout returned after completion as a failed payout", () => {
    const r = analyzeFixture("inpay/payout-returned.json");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("failure");
    expect(r.events.map((e) => e.outcome)).toEqual(["success", "failure"]);
    expect(r.errors[0]).toMatchObject({
      code: "beneficiary_bank_account_closed",
      category: "payment_method_unavailable",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Beneficiary account closed",
    });
    expect(r.errors[0]!.explanation).toMatch(/Returned row/);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("keeps action_required as a hold, not a failure", () => {
    const r = analyzeFixture("inpay/payout-action-required.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payout.action_required", "pending"],
      ["payout.processing", "pending"],
    ]);
    const err = r.errors[0]!;
    expect(err).toMatchObject({
      code: "insufficient_funds",
      category: "insufficient_funds",
      retry: "manual_review",
      confidence: "strong",
    });
    expect(err.outcomeKnown).toBeUndefined();
    expect(err.explanation).toMatch(/on hold, not failed/);
    expect(err.retryExplanation).toMatch(/payout then resumes/);
    const finding = r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!;
    expect(finding.title).toBe("Payout not confirmed");
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("keeps unrelated payouts apart", () => {
    const r = analyzeFixture("inpay/unrelated-payouts.json");
    expect(r.groups).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "not_supported_by_your_contract",
      category: "configuration",
      retry: "do_not_retry",
      paymentReference: "PPLsynthPO0007",
    });
  });

  it("maps every documented state and keeps others unknown", () => {
    const outcomes = [...Object.keys(PAYOUT_STATES), "settled"].map((state) => {
      const e = firstEvent(payout({ state }));
      return [state, e.stage, e.outcome, e.eventTypeKnown];
    });
    expect(outcomes).toEqual([
      ["received", "payout", "pending", true],
      ["processing", "payout", "pending", true],
      ["pending", "payout", "pending", true],
      ["action_required", "payout", "pending", true],
      ["rejected", "payout", "failure", true],
      ["completed", "payout", "success", true],
      ["returned", "payout", "failure", true],
      ["settled", "payout", "unknown", false],
    ]);
    expect(ruleIds(analyze(json(payout({ state: "settled" }))))).toContain("UNKNOWN_EVENT_TYPE");
    expect(firstEvent(payout({ state: "ACTION REQUIRED" }))).toMatchObject({
      eventType: "payout.action_required",
      eventTypeKnown: true,
      providerStatus: "ACTION REQUIRED",
    });
  });

  it("shows a scheduled payout and decodes no informational reason", () => {
    const r = analyze(
      json(
        payout({
          state: "pending",
          reasons: [{ category: "pending", code: "waiting_future_execution" }],
        }),
      ),
    );
    expect(r.events[0]!.attributes.scheduledForFutureExecution).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("matches a reason by code alone with lower confidence", () => {
    const e = firstError(
      payout({ state: "rejected", reasons: [{ code: "missing_capability", details: {} }] }),
    );
    expect(e).toMatchObject({
      code: "missing_capability",
      category: "configuration",
      confidence: "possible",
    });
    expect(e.missingInformation.join(" ")).toMatch(/No reason category/);
    const mismatch = firstError(
      payout({ state: "rejected", reasons: [{ category: "kyc", code: "missing_capability" }] }),
    );
    expect(mismatch.missingInformation.join(" ")).toMatch(/does not match the documented category/);
    // no_match is documented under two categories, so the code alone decides nothing.
    const vop = firstError(payout({ state: "rejected", reasons: [{ code: "no_match" }] }));
    expect(vop).toMatchObject({ category: "unknown", confidence: "insufficient" });
    const rejection = firstError(
      payout({ state: "rejected", reasons: [{ category: "vop_rejection", code: "no_match" }] }),
    );
    expect(rejection).toMatchObject({ category: "invalid_request", confidence: "strong" });
  });

  it("decodes example-only and unknown reason codes honestly", () => {
    const ex = firstError(
      payout({
        state: "returned",
        reasons: [{ category: "returned", code: "beneficiary-account-not-existing" }],
      }),
    );
    expect(ex).toMatchObject({
      code: "beneficiary-account-not-existing",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(ex.explanation).toMatch(/not in the reason code table/);
    const unknown = firstError(
      payout({ state: "rejected", reasons: [{ category: "new", code: "brand_new_code" }] }),
    );
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const none = firstError(payout({ state: "rejected" }));
    expect(none).toMatchObject({
      code: "state rejected",
      confidence: "possible",
      outcomeKnown: true,
    });
    expect(none.missingInformation).toContain(
      "No reasons[] were supplied, so the cause is unknown.",
    );
  });

  it("does not convert the placeholder currency or undocumented amounts", () => {
    const e = firstEvent(payout({ currency: "ISO 4217" }));
    expect(e.amountMinor).toBeUndefined();
    expect(e.currency).toBeUndefined();
    const odd = firstEvent(payout({ amount: "12.345" }));
    expect(odd.amountMinor).toBeUndefined();
    expect(odd.attributes.amountNotConvertible).toBe(true);
  });
});

describe("inpay pay-in orders", () => {
  it("builds an order timeline where an attempt is not the order outcome", () => {
    const r = analyzeFixture("inpay/order-flow.json");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["order.received", "payment", "pending"],
      ["payment_attempt.instant_bank_transfer.bank_authorised", "payment", "pending"],
      ["order.processing", "payment", "pending"],
      ["payment_attempt.instant_bank_transfer.completed", "payment", "success"],
      ["order.completed", "payment", "success"],
    ]);
    // A bank authorisation is never a card authorization.
    expect(r.events.some((e) => e.stage === "authorization" || e.stage === "capture")).toBe(false);
    const done = r.events[4]!;
    expect(done).toMatchObject({
      paymentReference: "0b1c2d3e-4f50-4a61-8b72-c3d4e5f60001",
      relatedReference: "PPLSYNTH1",
      merchantReference: "PPLsynth-order-0001",
      amountMinor: "10055",
      currency: "EUR",
    });
    expect(done.eventTimestamp).toBeUndefined();
    expect(done.attributes).toMatchObject({
      operation: "pay-in order (bank transfer collection, not a card payment)",
      paymentAttempts: 1,
      businessUnit: "default",
      expiresAt: "2026-10-20T12:00:00.000Z",
      amountField: "amount",
    });
    const attempt = r.events[3]!;
    expect(attempt).toMatchObject({
      relatedReference: "PPLSYNTH1",
      source: { path: "payments[0]" },
    });
    expect(attempt.amountMinor).toBeUndefined();
    expect(attempt.attributes).toMatchObject({
      attemptType: "instant_bank_transfer",
      attemptStatusLabel: "COMPLETED",
      primaryPayment: true,
      debtorCountry: "NL",
      debtorBankStatusCode: "ACSC",
      debtorBankStatusSource: "reported by the open-banking provider",
      debtorPaidAmount: "100.55",
      attemptChangesNotified: false,
    });
    expect(attempt.attributes.statusSpellingInferred).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toEqual([]);
  });

  it("decodes a cancelled order webhook from the reason text", () => {
    const r = analyzeFixture("inpay/order-cancelled-webhook.txt");
    const o = r.events.at(-1)!;
    expect(o).toMatchObject({
      eventType: "order.cancelled",
      outcome: "failure",
      deliveryKey: "x-request-id:PPLsynth-req-0101",
    });
    expect(o.attributes).toMatchObject({
      statusReasons: ["Order cancelled by user"],
      signatureVerified: false,
    });
    const attempt = r.events[0]!;
    expect(attempt).toMatchObject({ outcome: "failure", eventTypeKnown: true });
    expect(attempt.deliveryKey).toBeUndefined();
    expect(attempt.attributes.statusSpellingInferred).toBe(true);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "order cancelled",
      subCodes: { status: "cancelled", reason_key: "98" },
      category: "unknown",
      retry: "customer_action_required",
      confidence: "possible",
      providerMessage: "Order cancelled by user",
      outcomeKnown: true,
      paymentReference: "0b1c2d3e-4f50-4a61-8b72-c3d4e5f60002",
    });
    expect(r.errors[0]!.explanation).toMatch(/text match/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("lists the documented candidates when the reason text matches no row", () => {
    const r = analyzeFixture("inpay/order-action-required.json");
    expect(r.groups[0]!.latestOutcome).toBe("pending");
    expect(r.errors[0]).toMatchObject({
      code: "order action_required",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      providerMessage: "TSTM Screening failure",
    });
    expect(r.errors[0]!.subCodes.reason_key).toBeUndefined();
    expect(r.errors[0]!.explanation).toMatch(
      /200 Overfunded.*211 Held for Inpay compliance review/,
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/carry no reason code/);
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("matches the overfunding text and the single refund block reason", () => {
    const over = firstError(
      order({ status: "action_required", status_reasons: ["Too much funds have been received"] }),
    );
    expect(over).toMatchObject({ category: "invalid_amount", subCodes: { reason_key: "200" } });
    const block = firstError(order({ status: "action_required_for_refund" }));
    expect(block).toMatchObject({
      category: "insufficient_funds",
      confidence: "strong",
      subCodes: { reason_key: "191" },
    });
    const none = analyze(json(order({ status: "cancelled" }))).errors[0]!;
    expect(none.missingInformation.join(" ")).toMatch(/No status_reasons/);
  });

  it("keeps refunds as their own stage and counts the refund amount once", () => {
    const r = analyzeFixture("inpay/order-refund.json");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining(["refund:2b3c4d5e-6f70-4a81-9c92-a3b4c5d60004", "payment:PPLSYNTH4"]),
    );
    const refunds = byType(r, "refund.");
    expect(refunds.map((e) => [e.eventType, e.outcome, e.amountMinor])).toEqual([
      ["refund.created", "pending", "6000"],
      ["refund.completed", "success", "6000"],
    ]);
    const orders = byType(r, "order.");
    expect(orders.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["order.processing_refund", "refund", "pending"],
      ["order.refunded", "refund", "success"],
    ]);
    // The order amount is not the refund amount.
    expect(orders[1]!.amountMinor).toBeUndefined();
    expect(orders[1]!.attributes).toMatchObject({ orderAmountMinor: "6000", orderCurrency: "EUR" });
    expect(ruleIds(r)).not.toContain("REFUND_PENDING");

    // Payment, refund and a redelivered refund webhook do not look like an over-refund.
    const completed = order({
      uuid: "0b1c2d3e-4f50-4a61-8b72-c3d4e5f60004",
      amount: "60.00",
      amount_cents: 6000,
      status: "completed",
    });
    const refunded = (JSON.parse(fixture("inpay/order-refund.json")) as unknown[])[1];
    const hook = webhook(refunded, ["X-Request-ID: PPLsynth-req-0960"]);
    const all = analyzeSources(
      [
        { name: "a", text: json(completed) },
        { name: "b", text: hook },
        { name: "c", text: hook },
      ],
      options,
    );
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    const ids = all.result.findings.map((f) => f.ruleId);
    expect(ids).not.toContain("AMOUNT_MISMATCH");
    expect(ids).toContain("DUPLICATE_DELIVERY");
  });

  it("reads attempt statuses in table and JSON spelling and keeps undocumented ones unknown", () => {
    const status = (type: string, s: string) =>
      firstEvent(order({ payments: [attemptOf(type, s)] }));
    expect(status("instant_bank_transfer", "BANK AUTHORISED")).toMatchObject({
      outcome: "pending",
      eventTypeKnown: true,
      eventType: "payment_attempt.instant_bank_transfer.bank_authorised",
    });
    expect(
      status("instant_bank_transfer", "BANK AUTHORISED").attributes.statusSpellingInferred,
    ).toBeUndefined();
    const rejected = status("instant_bank_transfer", "bank_rejected");
    expect(rejected).toMatchObject({ outcome: "failure", eventTypeKnown: true });
    expect(rejected.attributes.statusSpellingInferred).toBe(true);
    expect(
      status("instant_bank_transfer", "REDIRECTED TO PPLSYNTH").attributes.attemptStatusLabel,
    ).toBe("REDIRECTED TO {{tenantCompany}}");
    expect(status("wallet_transfer", "consent_required")).toMatchObject({ outcome: "pending" });
    expect(status("wallet_transfer", "FAILED")).toMatchObject({ outcome: "failure" });
    expect(status("bank_transfer", "INSTRUCTIONS PROVIDED")).toMatchObject({ outcome: "pending" });
    // INSTRUCTIONS PROVIDED is not a status of the other types.
    expect(status("wallet_transfer", "INSTRUCTIONS PROVIDED")).toMatchObject({
      outcome: "unknown",
      eventTypeKnown: false,
    });
    const swish = status("swish_transfer", "completed");
    expect(swish).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(swish.attributes.attemptStatusesDocumented).toBe(false);
  });

  it("maps every documented order status and keeps others unknown", () => {
    const rows = [...Object.keys(ORDER_STATUSES), "settled"].map((status) => {
      const e = lastEvent(order({ status }));
      return [status, e.stage, e.outcome, e.eventTypeKnown];
    });
    expect(rows).toEqual([
      ["received", "payment", "pending", true],
      ["pending", "payment", "pending", true],
      ["cancelled", "payment", "failure", true],
      ["authorised", "payment", "pending", true],
      ["processing", "payment", "pending", true],
      ["action_required", "payment", "pending", true],
      ["completed", "payment", "success", true],
      ["processing_refund", "refund", "pending", true],
      ["action_required_for_refund", "refund", "pending", true],
      ["refunded", "refund", "success", true],
      ["partially_refunded", "refund", "success", true],
      ["returned", "payment", "unknown", true],
      ["settled", "payment", "unknown", false],
    ]);
    expect(lastEvent(order({ status: "ACTION REQUIRED" })).eventType).toBe("order.action_required");
  });

  it("reads amount_cents when the decimal amount is missing and flags a disagreement", () => {
    const cents = lastEvent(order({ amount: null, amount_cents: 1234 }));
    expect(cents).toMatchObject({
      amountMinor: "1234",
      attributes: { amountField: "amount_cents" },
    });
    const both = lastEvent(order({ amount: "10.00", amount_cents: 1001 }));
    expect(both.amountMinor).toBe("1000");
    expect(both.attributes.amountCentsMismatch).toBe(true);
  });

  it("keeps orders, refunds and payouts with different identifiers apart", () => {
    const r = analyze(
      json([
        order({ payments: [attemptOf("bank_transfer", "completed")], status: "completed" }),
        order({
          uuid: "0b1c2d3e-4f50-4a61-8b72-c3d4e5f60999",
          reference: "PPLsynth-order-0900",
          status: "completed",
        }),
        payout({ inpay_unique_reference: "PPLSYNTH900", end_to_end_id: "PPLsynth-order-0900" }),
      ]),
    );
    // Same merchant reference and a payout reference equal to an attempt reference do not merge.
    expect(r.groups).toHaveLength(3);
  });
});

describe("inpay error bodies", () => {
  it("decodes a JWT error from the error body", () => {
    const r = analyzeFixture("inpay/error-jwt-checksum.txt");
    expect(r.events[0]).toMatchObject({ eventType: "error.jwt_checksum_mismatch", stage: "error" });
    expect(r.errors[0]).toMatchObject({
      code: "jwt_checksum_mismatch",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Not authorized",
      outcomeKnown: true,
      subCodes: { http_status: "401" },
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/which response field/);
    const old = analyze(
      http("401 Unauthorized", {
        errors: [{ title: "Not authorized", detail: "jwt_iat_too_old" }],
      }),
    ).errors[0]!;
    expect(old).toMatchObject({
      category: "authentication_failed",
      retry: "safe_to_retry_technical_request",
    });
    expect(old.retryExplanation).toMatch(/freshly signed token/);
  });

  it("decodes a numeric API error", () => {
    const r = analyzeFixture("inpay/error-report-validation.txt");
    expect(r.errors[0]).toMatchObject({
      code: "1001",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { fields: "date_from", title: "Validation Error", http_status: "400" },
      providerMessage: "Validation Error: must be a date",
    });
  });

  it("decodes the payout cancellation validation error", () => {
    const r = analyzeFixture("inpay/error-cancellation-422.txt");
    expect(r.errors[0]).toMatchObject({
      code: "HTTP 422",
      category: "invalid_request",
      confidence: "possible",
      subCodes: { fields: "inpay_unique_reference" },
      providerMessage: "must be filled",
      source: { path: "error" },
    });
  });

  it("tells missing headers from a duplicate X-Request-ID only when the body says so", () => {
    const missing = analyzeFixture("inpay/error-missing-headers.txt").errors[0]!;
    expect(missing).toMatchObject({
      code: "HTTP 412",
      category: "configuration",
      confidence: "strong",
    });
    const unclear = analyze(
      http("412 Precondition Failed", { errors: [{ title: "Precondition Failed" }] }),
      inpayOnly,
    ).errors[0]!;
    expect(unclear).toMatchObject({
      category: "duplicate_request",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(unclear.missingInformation.join(" ")).toMatch(/two documented causes/);
  });

  it("never presents a server error as safe to retry", () => {
    const auto = analyzeFixture("inpay/error-unavailable.txt");
    expect(auto.records[0]).toMatchObject({
      status: "unsupported",
      format: "inpay.error",
      confidence: 0.45,
    });
    const r = analyze(fixture("inpay/error-unavailable.txt"), inpayOnly);
    expect(r.errors[0]).toMatchObject({
      code: "HTTP 503",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
      providerMessage: "Service Unavailable: Please try again later",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/end_to_end_id/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    const known = analyze(
      http("500 Internal Server Error", {
        errors: [{ title: "x", code: "jwt_verification_error" }],
      }),
    );
    expect(known.errors[0]).toMatchObject({ category: "configuration", retry: "do_not_retry" });
  });

  it("explains a 401 without an error code", () => {
    const e = analyze(
      http("401 Unauthorized", { errors: [{ title: "Not authorized" }] }),
      inpayOnly,
    ).errors[0]!;
    expect(e).toMatchObject({ category: "configuration", confidence: "possible" });
    expect(e.explanation).toMatch(/not a parsable JWT/);
  });

  it("reports unrecognized codes honestly", () => {
    const r = analyze(json({ errors: [{ title: "Something new", code: "brand_new" }] }), inpayOnly);
    expect(r.errors[0]).toMatchObject({
      code: "brand_new",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/No HTTP status/);
    const titled = analyze(json({ errors: [{ title: "Resource not found" }] }), inpayOnly)
      .errors[0]!;
    expect(titled).toMatchObject({ category: "invalid_request", confidence: "possible" });
  });
});

describe("inpay correlation", () => {
  const ev = (fields: Partial<NormalizedEvent>): NormalizedEvent => ({
    id: "ev-1",
    provider: "inpay",
    sourceFormat: "inpay.order",
    eventType: "order.completed",
    eventTypeKnown: true,
    stage: "payment",
    outcome: "success",
    attributes: {},
    sourceIndex: 0,
    source: { recordIndex: 0, path: "" },
    ...fields,
  });

  it("uses explicit Inpay identifiers and never the order reference", () => {
    expect(
      inpayAdapter.correlationKeys(
        ev({ paymentReference: "o1", relatedReference: "p1", merchantReference: "m1" }),
      ),
    ).toEqual(["o1", "payment:p1"]);
    expect(
      inpayAdapter.correlationKeys(
        ev({
          eventType: "refund.completed",
          stage: "refund",
          paymentReference: "o1",
          relatedReference: "r1",
        }),
      ),
    ).toEqual(["o1", "refund:r1"]);
    expect(
      inpayAdapter.correlationKeys(
        ev({ stage: "payout", paymentReference: "x1", merchantReference: "e1" }),
      ),
    ).toEqual(["x1", "e2e:e1"]);
    expect(inpayAdapter.correlationKeys(ev({ stage: "error" }))).toEqual([]);
  });
});

describe("inpay sensitive data", () => {
  const PLANTED = [
    "PPLSYNTH-VACCOUNT-PLANTED",
    "PLANTEDJWTPAYLOAD",
    "PLANTEDJWTSIGNATURE",
    "GB33PPLS00000000000002",
    "Planted Synthetic Payer",
    "PPLSYNTH-BANKUUID-PLANTED",
    "NL02PPLS0123456789",
    "PLANTEDREDIRECTTOKEN",
    "Planted Refund Creditor",
    "DE89PPLS00000000000001",
    "welcome_back",
  ];

  it.each([
    "inpay/payout-flow.json",
    "inpay/payout-rejected-webhook.txt",
    "inpay/order-flow.json",
    "inpay/order-cancelled-webhook.txt",
    "inpay/order-action-required.json",
    "inpay/order-refund.json",
  ])("keeps planted values out of events and the JSON report (%s)", (path) => {
    const r = analyzeFixture(path);
    expect(r.events.length).toBeGreaterThan(0);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
  });

  it("drops merchant references that look like personal data", () => {
    expect(
      firstEvent(payout({ end_to_end_id: "someone@example.com" })).merchantReference,
    ).toBeUndefined();
  });

  it("flags sensitive fields in the raw input", () => {
    expect(analyzeFixture("inpay/order-flow.json").sensitiveData.detected).toBe(true);
  });
});

describe("inpay manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(inpayAdapter);
    expect(inpayAdapter.manifest).toBe(inpayManifest);
    expect(inpayAdapter.version).toBe(INPAY_ADAPTER_VERSION);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(inpayManifest).toMatchObject({
      id: "inpay",
      version: "0.1.0",
      wave: "HR-3",
      researchStatus: "tested",
      documentationAccess: "partial",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "limited",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "supported",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect([...inpayManifest.categories].sort()).toEqual(["alternative_payment_method", "wallet"]);
    expect(inpayManifest.sectors.map((s) => s.sector)).toEqual([
      "Financial Services",
      "iGaming",
      "NGOs",
      "Corporates",
    ]);
    for (const s of inpayManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(app\.)?inpay\.com\//);
    const limits = inpayManifest.limitations.join(" ");
    expect(limits).toMatch(/PKCS#7/);
    expect(limits).toMatch(/no event name and no event id/);
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/not confirmed credit/);
    expect(limits).toMatch(/ISO 20022/);
    expect(limits).toMatch(/not documented/);
    const families = inpayManifest.apiFamilies.map((f) => f.id);
    for (const f of inpayAdapter.supportedFormats) expect(families).toContain(f.id);
  });

  it("contains every documented code and status", () => {
    expect(Object.keys(PAYOUT_STATES)).toHaveLength(7);
    expect(Object.keys(PAYOUT_REASONS)).toHaveLength(61);
    expect(new Set(Object.values(PAYOUT_REASONS).map((r) => r.code)).size).toBe(58);
    expect(Object.keys(EXAMPLE_ONLY_REASONS)).toHaveLength(3);
    expect(Object.keys(ORDER_STATUSES)).toHaveLength(12);
    expect(Object.keys(PAYMENT_TYPES)).toHaveLength(5);
    expect(Object.keys(ATTEMPT_STATUSES.bank_transfer!)).toHaveLength(3);
    expect(Object.keys(ATTEMPT_STATUSES.instant_bank_transfer!)).toHaveLength(13);
    expect(Object.keys(ATTEMPT_STATUSES.wallet_transfer!)).toHaveLength(9);
    expect(Object.keys(REFUND_STATUSES)).toHaveLength(3);
    expect(Object.keys(ORDER_REASONS)).toHaveLength(18);
    expect(ORDER_REASON_HINTS).toHaveLength(2);
    expect(Object.keys(HTTP_STATUSES)).toHaveLength(7);
    expect(Object.keys(NUMERIC_ERRORS)).toHaveLength(5);
    expect(Object.keys(JWT_ERRORS)).toHaveLength(7);
    expect(Object.keys(ERROR_TITLES)).toHaveLength(3);
    for (const hint of ORDER_REASON_HINTS) expect(ORDER_REASONS[hint.key]).toBeDefined();
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      inpayManifest,
      inpayAdapter.supportedFormats,
      PAYOUT_STATES,
      PAYOUT_REASONS,
      EXAMPLE_ONLY_REASONS,
      ORDER_STATUSES,
      PAYMENT_TYPES,
      ATTEMPT_STATUSES,
      REFUND_STATUSES,
      ORDER_REASONS,
      HTTP_STATUSES,
      NUMERIC_ERRORS,
      JWT_ERRORS,
      ERROR_TITLES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
