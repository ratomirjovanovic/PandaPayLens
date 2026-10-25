import { readdirSync, readFileSync } from "node:fs";
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
  APPROVAL_STATUSES,
  DEPOSIT_STATUSES,
  FINRAX_ADAPTER_VERSION,
  FINRAX_FORMATS,
  HTTP_ERRORS,
  PAYMENT_STATUSES,
  REFUND_REASONS,
  REFUND_STATUSES,
  REFUND_TYPES,
  WITHDRAWAL_STATUSES,
  finraxAdapter,
  finraxManifest,
} from "@pandapaylens/finrax";
import defaultExport from "@pandapaylens/finrax";
import { finraxManifest as manifestEntry } from "@pandapaylens/finrax/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [finraxAdapter],
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
const http = (status: string, body: unknown) =>
  [`HTTP/1.1 ${status}`, "Content-Type: application/json", "", json(body)].join("\n");

const payment = (fields: Record<string, unknown> = {}) => ({
  paymentId: "PPLsynth-pay-0900",
  clientPaymentId: "PPLSYNTH-ORDER-0900",
  status: "NEW",
  type: "ONE_TIME",
  rateType: "FIXED",
  displayCurrency: "EUR",
  expectedDisplayAmount: "45.00",
  actualDisplayAmount: "0",
  depositCurrency: "LTC",
  expectedDepositAmount: "0.62500000",
  overpaymentPolicy: "PROCESS",
  paymentRequestedAt: 1792700000,
  deposits: [],
  ...fields,
});
const depositCallback = (fields: Record<string, unknown> = {}) => ({
  paymentId: "PPLsynth-pay-0901",
  depositId: "PPLsynth-dep-0901",
  clientPaymentId: "PPLSYNTH-ORDER-0901",
  status: "CONFIRMED",
  rateType: "FIXED",
  depositCurrency: "LTC",
  displayCurrency: "EUR",
  expectedDisplayAmount: 15,
  actualDisplayAmount: 15,
  expectedDepositAmount: "0.20000000",
  actualDepositAmount: "0.20000000",
  paymentReceivedAt: 1792750600,
  settlementServiceFee: 0.15,
  ...fields,
});
const withdrawal = (fields: Record<string, unknown> = {}) => ({
  withdrawId: "PPLsynth-wd-0900",
  clientWithdrawId: "PPLSYNTH-PAYOUT-0900",
  status: "PENDING",
  displayCurrency: "EUR",
  estimatedDisplayAmount: "200.00",
  withdrawCurrency: "USDT",
  estimatedWithdrawAmount: "215.400000",
  uniformCurrency: "EUR",
  uniformAmount: "200.00",
  createdAt: 1792760000,
  ...fields,
});
const broadcast = (fields: Record<string, unknown> = {}) => ({
  withdrawalId: "PPLsynth-wd-0900",
  clientWithdrawalId: "PPLSYNTH-PAYOUT-0900",
  status: "COMPLETED",
  displayCurrency: "EUR",
  withdrawCurrency: "USDT",
  expectedDisplayAmount: "200.00",
  actualDisplayAmount: "200.00",
  actualWithdrawAmount: "215.400000",
  ...fields,
});
const errorBody = (fields: Record<string, unknown> = {}) => ({
  timestamp: 1792780000,
  httpStatus: 400,
  httpError: "Bad Request",
  message: "Request failed validation",
  path: "/api/v1/payments",
  ...fields,
});

describe("finrax detection", () => {
  it.each([
    [payment(), FINRAX_FORMATS.payment, true],
    [{ paymentInfo: payment(), paymentUrl: "x" }, FINRAX_FORMATS.createResponse, true],
    [depositCallback(), FINRAX_FORMATS.depositCallback, true],
    [withdrawal(), FINRAX_FORMATS.withdrawal, true],
    [{ withdrawalId: "w", clientLabel: "c" }, FINRAX_FORMATS.pendingApproval, true],
    [broadcast(), FINRAX_FORMATS.withdrawalCallback, true],
    [
      { withdrawalId: "w", clientWithdrawalId: "c", status: "BLOCKED" },
      FINRAX_FORMATS.withdrawalCallback,
      true,
    ],
    [
      { withdrawalId: "w", clientWithdrawalId: "c", status: "APPROVED" },
      FINRAX_FORMATS.approvalCallback,
      true,
    ],
    [errorBody(), FINRAX_FORMATS.error, true],
    [
      { clientPaymentId: "c", displayCurrency: "EUR", expectedDisplayAmount: "1.00" },
      FINRAX_FORMATS.paymentRequest,
      false,
    ],
  ])("detects %j", (input, format, supported) => {
    const d = finraxAdapter.detect(input);
    expect(d).toMatchObject({ provider: "finrax", format, supported });
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("scores Finrax-specific field families higher than bare ones", () => {
    expect(finraxAdapter.detect(payment()).confidence).toBeGreaterThan(0.85);
    expect(
      finraxAdapter.detect({ paymentId: "p", clientPaymentId: "c", status: "NEW" }).confidence,
    ).toBeLessThan(0.5);
    expect(finraxAdapter.detect(errorBody()).confidence).toBe(0.8);
    expect(finraxAdapter.detect({ httpStatus: 400, httpError: "Bad Request" }).confidence).toBe(
      0.4,
    );
  });

  it("uses the HTTP 202 status for the pending approval response", () => {
    const meta: RecordMeta = {
      format: "http",
      http: { kind: "response", status: 202, headers: {} },
    };
    const body = { withdrawalId: "w", clientLabel: "c" };
    expect(finraxAdapter.detect(body, meta).confidence).toBe(0.7);
    expect(finraxAdapter.detect(body).confidence).toBe(0.55);
    expect(finraxAdapter.detect({ ...body, extra: 1 }).confidence).toBe(0);
  });

  it("keeps generic shapes and the provider name below the analysis threshold", () => {
    for (const input of [
      "finrax",
      null,
      [],
      { provider: "Finrax", message: "Finrax error" },
      { status: "DEPOSITED" },
      { paymentId: "x", status: "NEW" },
      { paymentId: "x", status: "DEPOSITED", amount: "1.00" },
      { withdrawalId: "x", status: "APPROVED" },
      { withdrawalId: "x", clientWithdrawalId: "y", status: "APPROVED", note: "z" },
      { error: "Bad Request", message: "x" },
      { timestamp: 1, status: 400, error: "Bad Request", message: "x", path: "/api/v1/x" },
      { message: "Request failed validation", path: "/api/v1/payments" },
      { depositId: "x", status: "CONFIRMED" },
      { transactionId: "x", status: "COMPLETED" },
      { clientPaymentId: "x", amount: "1.00" },
    ]) {
      expect(finraxAdapter.detect(input).confidence, json(input)).toBe(0);
    }
    for (const input of [
      { httpStatus: 500, httpError: "Internal Server Error" },
      { withdrawalId: "x", clientWithdrawalId: "y", status: "SENT" },
      { withdrawalId: "x", clientWithdrawalId: "y" },
    ]) {
      expect(finraxAdapter.detect(input).confidence, json(input)).toBeLessThan(0.5);
    }
  });

  it("ignores form-encoded input", () => {
    expect(finraxAdapter.detect(payment(), { format: "form" }).confidence).toBe(0);
  });

  it("returns confidence 0 for every record of the other providers' fixtures", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "finrax")
      .map((d) => d.name)
      .filter((d) => readdirSync(`${root}${d}`).length > 0);
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "astropay", "skrill"]));
    let checked = 0;
    for (const dir of dirs) {
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
            finraxAdapter.detect(payload, parsed.value.meta[i]).confidence,
            `${dir}/${file} record ${i}`,
          ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("finrax parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const { status: _s, ...noStatus } = depositCallback();
    const r = analyze(json(noStatus));
    expect(r.records[0]).toMatchObject({
      status: "invalid",
      format: FINRAX_FORMATS.depositCallback,
    });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^status:/);
    expect(r.events).toEqual([]);
    const { status: _w, ...noWdStatus } = withdrawal();
    const w = analyze(json(noWdStatus));
    expect(w.records[0]).toMatchObject({ status: "invalid", format: FINRAX_FORMATS.withdrawal });
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(finraxAdapter.parse(payment({ status: 42 }), FINRAX_FORMATS.payment).ok).toBe(false);
    expect(finraxAdapter.parse(payment({ deposits: "x" }), FINRAX_FORMATS.payment).ok).toBe(false);
    expect(finraxAdapter.parse({}, "finrax.unknown").ok).toBe(false);
    expect(finraxAdapter.parse({}, "toString").ok).toBe(false);
    expect(finraxAdapter.parse("x", FINRAX_FORMATS.payment).ok).toBe(false);
    expect(finraxAdapter.parse(errorBody({ httpStatus: "4xx" }), FINRAX_FORMATS.error).ok).toBe(
      false,
    );
  });

  it("tolerates unknown fields and null values", () => {
    const p = finraxAdapter.parse(
      payment({ brandNew: [1], clientPaymentId: null, deposits: null, destinationTag: null }),
      FINRAX_FORMATS.payment,
    );
    expect(p.ok).toBe(true);
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"paymentId": "x", "status": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });

  it("recognizes but does not analyze a create payment request", () => {
    const r = analyzeFixture("finrax/payment-request.txt");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: FINRAX_FORMATS.paymentRequest,
      confidence: 0.6,
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/carries no result/);
    expect(r.events).toEqual([]);
    const report = toJsonReport(r);
    for (const v of ["PLANTEDAPIKEY0001", "PLANTEDREQUESTSIG0001"]) expect(report).not.toContain(v);
  });
});

describe("finrax payments and deposits", () => {
  it("builds one timeline from the create response, the callback and the payment object", () => {
    const r = analyzeFixture("finrax/deposit-flow.json");
    expect(r.records.map((x) => x.format)).toEqual([
      FINRAX_FORMATS.createResponse,
      FINRAX_FORMATS.depositCallback,
      FINRAX_FORMATS.depositCallback,
      FINRAX_FORMATS.payment,
    ]);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment.NEW", "payment", "pending"],
      ["deposit_received.CONFIRMED", "payment", "success"],
      ["deposit_received.CONFIRMED", "payment", "success"],
      ["payment.DEPOSITED", "payment", "success"],
      ["deposit.CONFIRMED", "payment", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual([
      "deposit:PPLsynth-dep-0001",
      "payment:PPLsynth-pay-0001",
    ]);
    const [created, callback] = r.events;
    expect(created).toMatchObject({
      paymentReference: "PPLsynth-pay-0001",
      merchantReference: "PPLSYNTH-ORDER-0001",
      eventTimestamp: "2026-10-22T20:13:20.000Z",
      amountMinor: "4500",
      currency: "EUR",
    });
    expect(created!.attributes).toMatchObject({
      paymentUrlPresent: true,
      depositCurrency: "LTC",
      expectedDepositAmount: "0.62500000",
      overpaymentPolicy: "PROCESS",
      settlementShown: false,
    });
    expect(callback).toMatchObject({
      relatedReference: "PPLsynth-dep-0001",
      deliveryKey: "deposit:PPLsynth-dep-0001:CONFIRMED",
      eventTimestamp: "2026-10-22T20:23:20.000Z",
      amountMinor: "4500",
      currency: "EUR",
    });
    expect(callback!.attributes).toMatchObject({
      amountCheck: "actual_equals_expected",
      amountCheckBasis: "display",
      settlementAmount: "44.55",
      settlementCurrency: "EUR",
      transactionIdPresent: true,
      signatureVerified: false,
    });
    // The snapshot has no status time, so it keeps its place after the callbacks.
    expect(
      r.events.find((e) => e.eventType === "payment.DEPOSITED")!.eventTimestamp,
    ).toBeUndefined();
    expect(r.events.some((e) => e.stage === "settlement")).toBe(false);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
    expect(r.findings[0]!.recommendedAction).toMatch(/once per depositId/);
  });

  it("does not treat an underpaid DEPOSITED payment as a success", () => {
    const r = analyzeFixture("finrax/underpaid-payment.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payment.DEPOSITED", "unknown"],
      ["deposit.CONFIRMED", "unknown"],
    ]);
    const p = r.events.find((e) => e.eventType === "payment.DEPOSITED")!;
    expect(p.attributes).toMatchObject({
      amountCheck: "actual_below_expected",
      underpaid: true,
      expectedDisplayAmount: "45.00",
      actualDisplayAmount: "22.50",
    });
    const d = r.events.find((e) => e.eventType === "deposit.CONFIRMED")!;
    expect(d.attributes).toMatchObject({
      paymentAmountCheck: "actual_below_expected",
      depositCurrency: "USDT",
      depositAmount: "24.300000",
    });
    expect(d.amountMinor).toBeUndefined();
    expect(r.groups[0]!.latestOutcome).toBe("unknown");
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
    expect(r.errors).toEqual([]);
  });

  it("does not treat an underpaid deposit callback as a success", () => {
    const e = analyze(json(depositCallback({ actualDisplayAmount: 7.5 }))).events[0]!;
    expect(e).toMatchObject({ outcome: "unknown", amountMinor: "750", currency: "EUR" });
    expect(e.attributes).toMatchObject({ amountCheck: "actual_below_expected", underpaid: true });
    const noAmounts = analyze(
      json(
        depositCallback({
          expectedDisplayAmount: undefined,
          actualDisplayAmount: undefined,
          expectedDepositAmount: undefined,
          actualDepositAmount: undefined,
          depositAddress: "PLANTEDWALLETADDRESS0901",
          onChainFee: "0.00001",
        }),
      ),
    ).events[0]!;
    expect(noAmounts.outcome).toBe("unknown");
    expect(noAmounts.attributes.amountCheck).toBe("not_comparable");
  });

  it("shows an overpayment refund on the deposit without converting crypto amounts", () => {
    const r = analyzeFixture("finrax/overpaid-refund.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.eventTimestamp])).toEqual([
      ["payment.OVERPAID", "payment", "success", undefined],
      ["deposit.CONFIRMED", "payment", "success", "2026-10-23T01:51:40.000Z"],
      ["refund.CONFIRMED", "refund", "success", "2026-10-23T02:11:40.000Z"],
    ]);
    const refund = r.events.find((e) => e.eventType === "refund.CONFIRMED")!;
    expect(refund).toMatchObject({
      paymentReference: "PPLsynth-pay-0003",
      relatedReference: "PPLsynth-dep-0003",
      providerStatus: "status=CONFIRMED; reason=OVERPAYMENT",
    });
    expect(refund.amountMinor).toBeUndefined();
    expect(refund.attributes).toMatchObject({
      refundType: "PARTIAL",
      refundReason: "OVERPAYMENT",
      refundReasonBasis: "sandbox",
      refundAmount: "0.20833333",
      depositCurrency: "LTC",
      destinationAddressPresent: true,
    });
    expect(r.groups).toHaveLength(1);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toEqual([]);
  });

  it("decodes a blocked deposit with an illicit-deposit refund awaiting an address", () => {
    const r = analyzeFixture("finrax/blocked-deposit.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payment.BLOCKED", "failure"],
      ["deposit.BLOCKED", "failure"],
      ["refund.AWAITING_ADDRESS_INPUT", "pending"],
    ]);
    expect(
      r.errors.map((e) => [e.code, e.subCodes.object, e.category, e.retry, e.confidence]),
    ).toEqual([
      ["BLOCKED", "payment", "fraud_or_risk", "manual_review", "strong"],
      ["BLOCKED", "deposit", "fraud_or_risk", "manual_review", "strong"],
      ["ILLICIT_DEPOSIT", "refund", "fraud_or_risk", "manual_review", "possible"],
    ]);
    expect(r.errors[2]!.missingInformation.join(" ")).toMatch(/inferred from the name/);
    expect(r.errors[1]).toMatchObject({
      paymentReference: "PPLsynth-pay-0004",
      attemptReference: "PPLsynth-dep-0004",
      source: { path: "deposits[0]" },
    });
    const refund = r.events.find((e) => e.eventType === "refund.AWAITING_ADDRESS_INPUT")!;
    const deposit = r.events.find((e) => e.eventType === "deposit.BLOCKED")!;
    expect(refund.attributes.destinationAddressPresent).toBe(false);
    expect(deposit.attributes.riskAssessmentPresent).toBe(true);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE", "REFUND_PENDING"]);
    expect(JSON.stringify(r.events)).not.toContain("Darknet");
  });

  it("decodes an expired payment as needing customer action", () => {
    const r = analyzeFixture("finrax/expired-payment.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.EXPIRED",
      outcome: "failure",
      amountMinor: "2500",
      currency: "USD",
    });
    expect(r.errors[0]).toMatchObject({
      code: "EXPIRED",
      category: "unknown",
      retry: "customer_action_required",
      confidence: "possible",
    });
  });

  it("keeps payments with a shared client reference apart", () => {
    const r = analyzeFixture("finrax/unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.latestOutcome).sort()).toEqual(["failure", "success"]);
    for (const g of r.groups)
      expect(g.references.every((ref) => !ref.includes("ORDER"))).toBe(true);
  });

  it("keeps undocumented and undefined statuses honest", () => {
    const unknown = analyze(json(payment({ status: "SETTLED" })));
    expect(unknown.events[0]).toMatchObject({
      eventType: "payment.unknown",
      eventTypeKnown: false,
      outcome: "unknown",
      providerStatus: "status=SETTLED",
    });
    expect(ruleIds(unknown)).toContain("UNKNOWN_EVENT_TYPE");
    const failed = analyze(json(payment({ status: "FAILED" })));
    expect(failed.errors[0]).toMatchObject({
      code: "FAILED",
      category: "unknown",
      retry: "manual_review",
      confidence: "insufficient",
    });
    expect(failed.errors[0]!.missingInformation.join(" ")).toMatch(/does not document/);
    const awaiting = analyze(json(payment({ status: "AWAITING" }))).events[0]!;
    expect(awaiting.outcome).toBe("pending");
    expect(awaiting.eventTimestamp).toBeUndefined();
    expect(awaiting.attributes.statusBasis).toBe("not_documented");
  });

  it("does not convert amounts whose display currency is a coin", () => {
    const e = analyze(json(payment({ displayCurrency: "BTC", expectedDisplayAmount: "0.001" })))
      .events[0]!;
    expect(e.amountMinor).toBeUndefined();
    expect(e.currency).toBeUndefined();
    expect(e.attributes.expectedDisplayAmount).toBe("0.001");
  });

  it("reads the deposit callback with its signature header shown as present only", () => {
    const r = analyzeFixture("finrax/deposit-callback.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "deposit_received.CONFIRMED",
      outcome: "success",
      amountMinor: "1500",
      currency: "EUR",
      paymentReference: "PPLsynth-pay-0006",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      signatureHeader: "present",
      timestampHeader: "present",
      signatureVerified: false,
      displayServiceFee: "0.15",
    });
    expect(toJsonReport(r)).not.toContain("PLANTEDRSASIGNATURE0001");
  });

  it("drops merchant references that contain personal data", () => {
    const e = analyze(json(payment({ clientPaymentId: "someone@example.com" }))).events[0]!;
    expect(e.merchantReference).toBeUndefined();
  });
});

describe("finrax withdrawals", () => {
  it("links the created withdrawal and its broadcast callback as one payout", () => {
    const r = analyzeFixture("finrax/withdrawal-flow.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["withdrawal.PENDING", "payout", "pending"],
      ["withdrawal_callback.COMPLETED", "payout", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(["withdrawal:PPLsynth-wd-0001"]);
    expect(r.events[0]).toMatchObject({
      merchantReference: "PPLSYNTH-PAYOUT-0001",
      eventTimestamp: "2026-10-23T12:53:20.000Z",
      amountMinor: "20000",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      withdrawCurrency: "USDT",
      estimatedWithdrawAmount: "215.400000",
      uniformCurrency: "EUR",
      amountsAreEstimates: true,
    });
    expect(r.events[1]).toMatchObject({
      deliveryKey: "withdrawal:PPLsynth-wd-0001:COMPLETED",
      amountMinor: "20000",
    });
    expect(r.events[1]!.attributes).toMatchObject({
      deductedSettlementAmount: "202.00",
      deductedSettlementAmountField: "deductedSettlementAmount",
      addressOwnerScreeningPresent: true,
      transactionIdPresent: true,
    });
    expect(ruleIds(r)).toEqual([]);
  });

  it("follows a withdrawal through approval to broadcast", () => {
    const r = analyzeFixture("finrax/withdrawal-approval-flow.json");
    expect(r.records.map((x) => x.format)).toEqual([
      FINRAX_FORMATS.pendingApproval,
      FINRAX_FORMATS.approvalCallback,
      FINRAX_FORMATS.withdrawalCallback,
    ]);
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["withdrawal.pending_approval", "pending"],
      ["withdrawal_approval.APPROVED", "pending"],
      ["withdrawal_callback.COMPLETED", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[0]!.merchantReference).toBe("PPLSYNTH-PAYOUT-0002");
    expect(r.events[2]!.attributes).toMatchObject({
      deductedSettlementAmount: "505.00",
      deductedSettlementAmountField: "deducedSettlementAmount",
    });
  });

  it("does not present an approval as a completed payout", () => {
    const r = analyze(
      json({ withdrawalId: "PPLsynth-wd-0910", clientWithdrawalId: "c", status: "APPROVED" }),
    );
    expect(r.events[0]).toMatchObject({ stage: "payout", outcome: "pending" });
    expect(ruleIds(r)).toEqual(["PAYOUT_STATUS", "UNRESOLVED_OUTCOME"]);
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe(
      "Payout not confirmed",
    );
    const skipped = analyze(
      json({ withdrawalId: "PPLsynth-wd-0911", clientWithdrawalId: "c", status: "SKIPPED" }),
    ).events[0]!;
    expect(skipped).toMatchObject({ eventTypeKnown: true, outcome: "unknown" });
  });

  it("decodes a blocked withdrawal without copying the screening result", () => {
    const r = analyzeFixture("finrax/withdrawal-blocked.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "withdrawal_callback.BLOCKED",
      outcome: "failure",
      deliveryKey: "withdrawal:PPLsynth-wd-0003:BLOCKED",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      addressOwnerScreeningPresent: true,
      signatureHeader: "present",
      signatureVerified: false,
    });
    expect(r.events[0]!.attributes.transactionIdPresent).toBeUndefined();
    expect(r.errors[0]).toMatchObject({
      code: "BLOCKED",
      category: "fraud_or_risk",
      retry: "manual_review",
      paymentReference: "PPLsynth-wd-0003",
    });
    expect(ruleIds(r)).toEqual(["PAYOUT_STATUS"]);
    expect(r.findings[0]!.title).toBe("Payout failed");
    expect(toJsonReport(r)).not.toContain("Darknet");
  });

  it("decodes a rejected approval", () => {
    const r = analyzeFixture("finrax/approval-rejected.json");
    expect(r.events[0]).toMatchObject({ outcome: "failure", stage: "payout" });
    expect(r.errors[0]).toMatchObject({
      code: "REJECTED",
      retry: "manual_review",
      confidence: "strong",
      outcomeKnown: true,
    });
  });

  it("reports a repeated broadcast callback and keeps other withdrawals apart", () => {
    const r = analyze(
      json([
        broadcast(),
        broadcast(),
        broadcast({ withdrawalId: "PPLsynth-wd-0920", clientWithdrawalId: "PPLSYNTH-PAYOUT-0900" }),
      ]),
    );
    expect(r.groups).toHaveLength(2);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
  });

  it("links withdrawId and withdrawalId as one withdrawal", () => {
    const r = analyze(json([withdrawal(), broadcast({ status: "FAILED" })]));
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "failure"]);
    expect(r.errors[0]).toMatchObject({ code: "FAILED", confidence: "insufficient" });
  });
});

describe("finrax errors", () => {
  it("decodes a validation error from the HTTP status", () => {
    const r = analyzeFixture("finrax/error-validation.txt");
    expect(r.errors[0]).toMatchObject({
      code: "400",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Request failed validation",
      subCodes: { field: "httpStatus", httpError: "Bad Request", pathTemplate: "/api/v1/payments" },
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no provider error code/);
    expect(r.events[0]).toMatchObject({
      eventType: "error.http_400",
      stage: "error",
      outcome: "failure",
      eventTimestamp: "2026-10-23T18:26:40.000Z",
    });
    expect(r.suggestedView).toBe("decoder");
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("finrax/error-unauthorized.json");
    expect(r.errors[0]).toMatchObject({
      code: "401",
      category: "configuration",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://docs.finrax.com/authorization/signature",
    );
  });

  it("never presents an internal error as safe to retry", () => {
    const r = analyzeFixture("finrax/error-internal.txt");
    expect(r.errors[0]).toMatchObject({
      code: "500",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/Verify first/);
    expect(ruleIds(r)).toEqual(["POSSIBLE_RETRY_RISK"]);
    const down = analyze(http("503 Service Unavailable", errorBody({ httpStatus: 503 })));
    expect(down.errors[0]).toMatchObject({ code: "503", retry: "retry_conditionally" });
  });

  it("reports unrecognized HTTP statuses honestly", () => {
    const r = analyze(json(errorBody({ httpStatus: 429, httpError: "Too Many Requests" })));
    expect(r.errors[0]).toMatchObject({
      code: "429",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.events[0]!.attributes.codeDocumented).toBe(false);
  });

  it("notes a response status that differs from the body", () => {
    const r = analyze(http("502 Bad Gateway", errorBody({ httpStatus: 500 })));
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/\(502\) differs/);
    expect(r.events[0]!.attributes.responseStatusDiffers).toBe(true);
  });

  it("keeps identifiers and personal data out of the error path and message", () => {
    const r = analyze(
      json(
        errorBody({
          httpStatus: 404,
          httpError: "Not Found",
          message: "No payment for planted.person@example.com",
          path: "/api/v1/payments/PPLsynth-pay-PLANTED99?x=1",
        }),
      ),
    );
    expect(r.errors[0]!.subCodes.pathTemplate).toBe("/api/v1/payments/{id}");
    expect(toJsonReport(r)).not.toContain("planted.person@example.com");
    expect(toJsonReport(r)).not.toContain("PPLsynth-pay-PLANTED99");
  });
});

describe("finrax sensitive data", () => {
  const PLANTED = [
    "PLANTEDSESSIONTOKEN0001",
    "PLANTEDWALLETADDRESS",
    "PLANTEDFROMADDRESS",
    "PLANTEDTXHASH",
    "PLANTEDOWNERNAME",
    "PLANTEDREFUNDADDRESS0003",
    "PLANTEDREFUNDTXHASH0003",
    "PLANTEDRECIPIENTADDRESS",
    "PLANTEDRECIPIENTTAG0001",
    "PLANTEDWDTXHASH",
    "PLANTEDRSASIGNATURE",
    "PPLsynth-biz-PLANTED01",
    "planted.user@example.com",
    "Darknet",
  ];

  it.each([
    "finrax/deposit-flow.json",
    "finrax/overpaid-refund.json",
    "finrax/blocked-deposit.json",
    "finrax/deposit-callback.txt",
    "finrax/withdrawal-flow.json",
    "finrax/withdrawal-approval-flow.json",
    "finrax/withdrawal-blocked.txt",
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

  it("flags sensitive fields in the raw input", () => {
    expect(analyzeFixture("finrax/deposit-flow.json").sensitiveData.detected).toBe(true);
  });
});

describe("finrax manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(finraxAdapter);
    expect(finraxAdapter.manifest).toBe(finraxManifest);
    expect(manifestEntry).toEqual(finraxManifest);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(finraxManifest).toMatchObject({
      id: "finrax",
      version: FINRAX_ADAPTER_VERSION,
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
    expect([...finraxManifest.categories].sort()).toEqual([
      "alternative_payment_method",
      "gateway",
    ]);
    expect(finraxManifest.sectors.map((s) => s.sector)).toEqual([
      "iGaming",
      "Casinos",
      "Brokers / traders",
    ]);
    for (const s of finraxManifest.sectors) expect(s.source).toMatch(/^https:\/\/finrax\.com\//);
    expect(finraxManifest.regions).toMatch(/not offering crypto-asset service provider/);
    const limits = finraxManifest.limitations.join(" ");
    expect(limits).toMatch(/no provider error or decline codes/);
    expect(limits).toMatch(/underpaid/);
    expect(limits).toMatch(/not that they were settled/);
    expect(limits).toMatch(/never verifies the signature/);
    expect(limits).toMatch(/no event or delivery id/);
    const families = finraxManifest.apiFamilies.map((f) => f.id);
    for (const f of finraxAdapter.supportedFormats) expect(families).toContain(f.id);
  });

  it("contains every documented code and status", () => {
    expect(Object.keys(PAYMENT_STATUSES)).toHaveLength(9);
    expect(Object.keys(DEPOSIT_STATUSES)).toHaveLength(6);
    expect(Object.keys(REFUND_STATUSES)).toHaveLength(5);
    expect(Object.keys(REFUND_REASONS)).toHaveLength(5);
    expect(Object.keys(REFUND_TYPES)).toHaveLength(2);
    expect(Object.keys(WITHDRAWAL_STATUSES)).toHaveLength(4);
    expect(Object.keys(APPROVAL_STATUSES)).toHaveLength(4);
    expect(Object.keys(HTTP_ERRORS).sort()).toEqual([
      "400",
      "401",
      "403",
      "404",
      "405",
      "409",
      "415",
      "500",
      "503",
    ]);
  });

  it("never marks a pending or approval status as a success", () => {
    for (const table of [PAYMENT_STATUSES, DEPOSIT_STATUSES, WITHDRAWAL_STATUSES]) {
      for (const [k, v] of Object.entries(table))
        if (["NEW", "PENDING", "AWAITING", "UNCONFIRMED"].includes(k))
          expect(v.outcome).toBe("pending");
    }
    expect(APPROVAL_STATUSES.APPROVED!.outcome).toBe("pending");
    expect(PAYMENT_STATUSES.DEPOSITED!.requiresAmountCheck).toBe(true);
    expect(DEPOSIT_STATUSES.CONFIRMED!.requiresAmountCheck).toBe(true);
  });

  it("uses no en or em dashes in sources, fixtures or published text", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(
      JSON.stringify([
        finraxManifest,
        PAYMENT_STATUSES,
        DEPOSIT_STATUSES,
        REFUND_STATUSES,
        REFUND_REASONS,
        WITHDRAWAL_STATUSES,
        APPROVAL_STATUSES,
        HTTP_ERRORS,
      ]),
    ).not.toMatch(dashes);
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    for (const f of readdirSync(src))
      expect(readFileSync(`${src}${f}`, "utf8"), f).not.toMatch(dashes);
    const fx = fileURLToPath(new URL("../../../../fixtures/finrax/", import.meta.url));
    for (const f of readdirSync(fx))
      expect(readFileSync(`${fx}${f}`, "utf8"), f).not.toMatch(dashes);
  });
});
