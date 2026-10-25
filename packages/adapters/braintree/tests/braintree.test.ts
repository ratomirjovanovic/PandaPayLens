import { readdirSync, readFileSync } from "node:fs";
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
  braintreeAdapter,
  braintreeManifest,
  BRAINTREE_ADAPTER_VERSION,
  GATEWAY_REJECTION_REASONS,
  PROCESSOR_RESPONSES,
  SETTLEMENT_RESPONSES,
  VALIDATION_ERRORS,
} from "@pandapaylens/braintree";
import defaultExport from "@pandapaylens/braintree";

const options: AnalyzeOptions = {
  adapters: [braintreeAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturesDir = new URL("../../../../fixtures/", import.meta.url);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, fixturesDir)), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (name: string) => analyze(fixture(`braintree/${name}`));
const analyzeJson = (value: unknown) => analyze(JSON.stringify(value));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const snake = (fields: Record<string, unknown>) => ({
  id: "PPLsynthTX1",
  type: "sale",
  status: "processor_declined",
  amount: "10.00",
  currency_iso_code: "USD",
  merchant_account_id: "PPLsynthMerchantUSD",
  ...fields,
});

const gqlCharge = (transaction: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  data: { chargePaymentMethod: { transaction } },
  extensions: { requestId: "PPLsynth-request-x" },
  ...extra,
});

describe("braintree detection", () => {
  it.each([
    [
      { errors: [{ message: "x", extensions: { legacyCode: "91565", errorClass: "VALIDATION" } }] },
      "braintree.graphql.response",
      0.95,
      true,
    ],
    [
      { data: null, errors: [{ message: "x", extensions: { errorClass: "INTERNAL" } }] },
      "braintree.graphql.response",
      0.9,
      true,
    ],
    [
      gqlCharge({ id: "PPLsynthG", legacyId: "PPLsynthL", status: "AUTHORIZED" }),
      "braintree.graphql.response",
      0.9,
      true,
    ],
    [
      gqlCharge({ id: "PPLsynthG", status: "AUTHORIZED" }),
      "braintree.graphql.response",
      0.85,
      true,
    ],
    [
      { data: { t: { id: "PPLsynthG", status: "AUTHORIZED" } } },
      "braintree.graphql.response",
      0.6,
      true,
    ],
    [snake({ processor_response_code: "2001" }), "braintree.transaction", 0.95, true],
    [
      {
        id: "x",
        status: "processor_declined",
        processorResponseCode: "2001",
        merchantAccountId: "m",
      },
      "braintree.transaction",
      0.95,
      true,
    ],
    [
      { status: "gateway_rejected", gateway_rejection_reason: "cvv" },
      "braintree.transaction",
      0.9,
      true,
    ],
    [
      { status: "settled", status_history: [{ status: "settled", transaction_source: "Api" }] },
      "braintree.transaction",
      0.9,
      true,
    ],
    [
      { id: "PPLsynthG", status: "SETTLED", statusHistory: [{ status: "SETTLED" }] },
      "braintree.transaction",
      0.85,
      true,
    ],
    [
      { id: "x", status: "settled", merchant_account_id: "m", currency_iso_code: "USD" },
      "braintree.transaction",
      0.75,
      true,
    ],
    [
      { kind: "dispute_opened", timestamp: "2026-10-25T00:00:00Z", dispute: { id: "d" } },
      "braintree.webhook.notification",
      0.95,
      true,
    ],
    [
      { kind: "brand_new_kind", timestamp: "2026-10-25T00:00:00Z", subject: {} },
      "braintree.webhook.notification",
      0.6,
      true,
    ],
    [
      {
        success: false,
        errors: [{ attribute: "amount", code: "81502", message: "Amount is required." }],
      },
      "braintree.sdk.validation_errors",
      0.85,
      true,
    ],
    [{ bt_signature: "a", bt_payload: "b" }, "braintree.webhook.signed", 0.9, false],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(braintreeAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("does not claim generic shapes", () => {
    for (const input of [
      null,
      [],
      "braintree",
      { provider: "braintree", message: "Braintree error" },
      { error: { message: "x" } },
      { error: { type: "card_error" } },
      { status: "settled" },
      { status: "SETTLED" },
      { status: "error", message: "Payment could not be processed" },
      { data: {} },
      { data: { node: { status: "SETTLED" } } },
      { errors: [{ message: "x" }] },
      { errors: [{ message: "Unauthorized access", extensions: { code: "UNAUTHORIZED" } }] },
      { kind: "something", timestamp: "2026-10-25T00:00:00Z" },
      { success: false, errors: [{ message: "x" }] },
      { object: "event", type: "charge.succeeded", data: { object: { status: "succeeded" } } },
      { type: "balancePlatform.x", data: { status: "AUTHORIZED", id: "x" }, environment: "test" },
    ]) {
      expect(braintreeAdapter.detect(input).confidence, JSON.stringify(input)).toBe(0);
    }
    // A request id alone is not enough to analyze a GraphQL body.
    const weak = braintreeAdapter.detect({ data: {}, extensions: { requestId: "r" } });
    expect(weak.confidence).toBeLessThan(0.5);
    expect(analyzeJson({ data: {}, extensions: { requestId: "r" } }).records[0]!.status).toBe(
      "unsupported",
    );
  });

  it("ignores Object.prototype names in values", () => {
    expect(
      braintreeAdapter.detect({
        id: "x",
        status: "constructor",
        merchant_account_id: "m",
        currency_iso_code: "USD",
      }).confidence,
    ).toBe(0);
    expect(
      braintreeAdapter.detect({ kind: "constructor", timestamp: "2026-10-25T00:00:00Z" })
        .confidence,
    ).toBe(0);
    expect(
      braintreeAdapter.detect({ errors: [{ extensions: { errorClass: "toString" } }] }).confidence,
    ).toBe(0);
    const r = analyzeJson([
      snake({ status: "gateway_rejected", gateway_rejection_reason: "constructor" }),
      snake({ status: "toString", processor_response_code: "2001" }),
      {
        errors: [
          { message: "x", extensions: { legacyCode: "91565", errorClass: "hasOwnProperty" } },
        ],
      },
    ]);
    expect(r.errors.map((e) => [e.code, e.category, e.confidence])).toEqual([
      ["constructor", "unknown", "insufficient"],
      ["2001", "insufficient_funds", "strong"],
      ["91565", "invalid_request", "strong"],
    ]);
    expect(r.events[1]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fileURLToPath(new URL(`${dir}/`, fixturesDir)))) {
        const text = fixture(`${dir}/${file}`);
        const parsed = parseInput(text);
        expect(parsed.ok, file).toBe(true);
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const payload =
            record && typeof record === "object" && "payload" in record
              ? (record as { payload: unknown }).payload
              : record;
          for (const value of [record, payload]) {
            expect(braintreeAdapter.detect(value, parsed.value.meta[i]).confidence, file).toBe(0);
          }
        });
        const r = analyze(text);
        expect(
          r.records.every((s) => s.confidence === 0 && s.provider === null),
          file,
        ).toBe(true);
        expect(r.events).toEqual([]);
      }
    }
  });
});

describe("braintree GraphQL responses", () => {
  it("decodes a validation error (legacyCode)", () => {
    const r = analyzeFixture("graphql-validation-error.json");
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "braintree.graphql.response",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "91565",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Unknown or expired single-use payment method.",
      subCodes: {
        errorClass: "VALIDATION",
        legacyCode: "91565",
        inputPath: "input.paymentMethodId",
        path: "chargePaymentMethod",
      },
    });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "graphql_error.VALIDATION",
      stage: "error",
      outcome: "failure",
      attributes: { requestId: "PPLsynth-request-0001", field: "chargePaymentMethod" },
    });
    expect(r.findings).toEqual([]);
  });

  it("reads a processor decline from data, not from errors", () => {
    const r = analyzeFixture("graphql-processor-declined.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.processor_declined",
      stage: "authorization",
      outcome: "failure",
      providerStatus: "PROCESSOR_DECLINED",
      paymentReference: "PPLsynthGQLtxnDEC0001",
      merchantReference: "PPL-ORDER-BT-0001",
      eventTimestamp: "2026-10-25T09:00:01.000Z",
      amountMinor: "200000",
      currency: "USD",
    });
    expect(r.events[0]!.attributes.correlationIds).toEqual([
      "PPLsynthGQLtxnDEC0001",
      "PPLsynthDEC1",
    ]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "2001",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      paymentReference: "PPLsynthGQLtxnDEC0001",
      attemptReference: "PPLsynthGQLtxnDEC0001",
      subCodes: {
        status: "PROCESSOR_DECLINED",
        declineType: "SOFT",
        documentedDeclineType: "Soft",
      },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/soft decline/);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
    expect(r.findings[0]!.evidenceErrorIds).toEqual([r.errors[0]!.id]);
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("graphql-authentication-error.json");
    expect(r.errors[0]).toMatchObject({
      code: "AUTHENTICATION",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
  });

  it("treats internal errors as an unknown outcome and never as a safe retry", () => {
    const r = analyzeFixture("graphql-internal-error.json");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "INTERNAL",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/unknown/);
    expect(r.errors[0]!.retryExplanation).toMatch(/[Vv]erify/);

    const s = analyzeJson({
      data: { chargePaymentMethod: null },
      errors: [{ message: "x", extensions: { errorClass: "SERVICE_AVAILABILITY" } }],
    });
    expect(s.errors[0]!.retry).toBe("retry_conditionally");
    expect(s.errors[0]!.retryExplanation).toMatch(/mutation the outcome is unknown/);
  });

  it("is honest about unknown codes", () => {
    const r = analyzeJson({ errors: [{ message: "x", extensions: { legacyCode: "99999" } }] });
    expect(r.errors[0]).toMatchObject({
      code: "99999",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.events[0]!.outcome).toBe("unknown");
    const v = analyzeJson({
      errors: [{ message: "x", extensions: { legacyCode: "99999", errorClass: "VALIDATION" } }],
    });
    expect(v.errors[0]).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(v.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
  });

  it("shows a statusHistory without timestamps as one snapshot event", () => {
    const r = analyzeFixture("graphql-reversal-no-timestamps.json");
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.voided",
      stage: "void",
      providerStatus: "VOIDED",
      paymentReference: "PPLsynthGQLtxnREV0001",
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      observation: "snapshot",
      statusHistory: ["AUTHORIZED", "SUBMITTED_FOR_SETTLEMENT", "VOIDED"],
      statusHistoryOrder: "chronological",
    });
  });

  it("builds one event per timestamped statusHistory entry, oldest first", () => {
    const r = analyzeJson(
      gqlCharge({
        id: "PPLsynthGQLtxnCAP1",
        legacyId: "PPLsynthCAP1",
        status: "SUBMITTED_FOR_SETTLEMENT",
        amount: { value: "12.50", currencyCode: "EUR" },
        statusHistory: [
          {
            status: "SUBMITTED_FOR_SETTLEMENT",
            timestamp: "2026-10-25T09:00:05Z",
            terminal: false,
          },
          {
            status: "AUTHORIZED",
            timestamp: "2026-10-25T09:00:00Z",
            terminal: false,
            source: "API",
          },
        ],
      }),
    );
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.source.path])).toEqual([
      [
        "transaction.authorized",
        "authorization",
        "success",
        "data.chargePaymentMethod.transaction.statusHistory[1]",
      ],
      [
        "transaction.submitted_for_settlement",
        "capture",
        "pending",
        "data.chargePaymentMethod.transaction.statusHistory[0]",
      ],
    ]);
    expect(r.events[0]!.attributes).toMatchObject({ transactionSource: "API", terminal: false });
    expect(r.events[0]!.amountMinor).toBe("1250");
    expect(ruleIds(r)).not.toContain("OUT_OF_ORDER_ARRIVAL");
    expect(r.groups).toHaveLength(1);
  });

  it("decodes gateway rejections from statusHistory without linking duplicateOf", () => {
    const r = analyzeJson(
      gqlCharge({
        id: "PPLsynthGQLtxnDUP2",
        status: "GATEWAY_REJECTED",
        statusHistory: [
          {
            status: "GATEWAY_REJECTED",
            timestamp: "2026-10-25T09:00:00Z",
            gatewayRejectionReason: "DUPLICATE",
            duplicateOf: { id: "PPLsynthGQLtxnDUP1" },
          },
        ],
      }),
    );
    expect(r.errors[0]).toMatchObject({
      code: "duplicate",
      category: "duplicate_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(r.groups[0]!.references).toEqual(["PPLsynthGQLtxnDUP2"]);
  });

  it("decodes GraphQL-only gateway reasons with lower confidence", () => {
    const r = analyzeJson(
      gqlCharge({
        id: "PPLsynthGQLtxnRTY1",
        status: "GATEWAY_REJECTED",
        statusHistory: [
          {
            status: "GATEWAY_REJECTED",
            timestamp: "2026-10-25T09:00:00Z",
            gatewayRejectionReason: "EXCESSIVE_RETRY",
          },
        ],
      }),
    );
    expect(r.errors[0]).toMatchObject({
      code: "excessive_retry",
      category: "rate_limiting",
      retry: "do_not_retry",
      confidence: "possible",
    });
  });

  it("handles partial success and nested refunds", () => {
    const r = analyzeJson({
      data: {
        transaction: {
          id: "PPLsynthGQLtxnP1",
          legacyId: "PPLsynthP1",
          status: "SETTLED",
          statusHistory: [{ status: "SETTLED", timestamp: "2026-10-24T02:00:00Z" }],
          refunds: [
            {
              id: "PPLsynthGQLrefP1",
              status: "SUBMITTED_FOR_SETTLEMENT",
              statusHistory: [
                { status: "SUBMITTED_FOR_SETTLEMENT", timestamp: "2026-10-25T08:00:00Z" },
              ],
            },
          ],
        },
        other: null,
      },
      errors: [{ message: "x", path: ["other"], extensions: { errorClass: "NOT_FOUND" } }],
      extensions: { requestId: "PPLsynth-request-p" },
    });
    expect(
      r.events.map((e) => [e.eventType, e.stage, e.outcome, e.paymentReference ?? null]),
    ).toEqual([
      ["transaction.settled", "settlement", "success", "PPLsynthGQLtxnP1"],
      ["refund.submitted_for_settlement", "refund", "pending", "PPLsynthGQLtxnP1"],
      ["graphql_error.NOT_FOUND", "error", "failure", null],
    ]);
    expect(r.events[1]!.relatedReference).toBe("PPLsynthGQLrefP1");
    const payment = r.groups.find((g) => g.references.includes("PPLsynthGQLtxnP1"))!;
    expect(payment.eventIds).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({ code: "NOT_FOUND", category: "invalid_request" });
  });

  it("reports malformed transactions as parse issues", () => {
    const r = analyzeJson({
      data: {
        t: { id: "PPLsynthG", legacyId: "PPLsynthL", status: "SETTLED", statusHistory: "nope" },
      },
    });
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/data\.t\.statusHistory/);
  });
});

describe("braintree transaction snapshots", () => {
  it("expands a settled sale's status_history into a timeline", () => {
    const r = analyzeFixture("sdk-sale-settled.json");
    expect(r.records[0]!.format).toBe("braintree.transaction");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["transaction.authorized", "authorization", "success"],
      ["transaction.submitted_for_settlement", "capture", "pending"],
      ["transaction.settling", "settlement", "pending"],
      ["transaction.settled", "settlement", "success"],
    ]);
    for (const e of r.events) {
      expect(e).toMatchObject({
        paymentReference: "PPLsynthSALE1",
        merchantReference: "PPL-ORDER-BT-0002",
        amountMinor: "4999",
        currency: "EUR",
      });
    }
    expect(r.events[0]!.attributes).toMatchObject({
      transactionSource: "Api",
      processorResponseCode: "1000",
      processorResponseType: "approved",
      correlationIds: ["PPLsynthSALE1", "PPLsynthGQLtxnSALE1"],
    });
    expect(r.errors).toEqual([]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(r.findings).toEqual([]);
  });

  it("does not invent events for a snapshot without history", () => {
    const r = analyzeJson(snake({ status: "authorized", processor_response_code: "1000" }));
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.authorized",
      outcome: "success",
      attributes: { observation: "snapshot" },
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("adds a snapshot event when the current status is newer than the history", () => {
    const r = analyzeJson(
      snake({
        status: "voided",
        processor_response_code: "1000",
        status_history: [
          { status: "authorized", timestamp: "2026-10-25T08:00:00Z", transaction_source: "Api" },
        ],
      }),
    );
    expect(r.events.map((e) => e.eventType)).toEqual([
      "transaction.authorized",
      "transaction.voided",
    ]);
  });

  it("decodes a camelCase gateway rejection inside an SDK result object", () => {
    const r = analyzeFixture("sdk-gateway-rejected-camel.json");
    expect(r.records[0]!.reasons).toContain("transaction is wrapped in a result object");
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.gateway_rejected",
      stage: "authorization",
      outcome: "failure",
      paymentReference: "PPLsynthGWR1",
      amountMinor: "1500",
    });
    expect(r.events[0]!.source.path).toBe("transaction.statusHistory[0]");
    expect(r.errors[0]).toMatchObject({
      code: "cvv",
      category: "fraud_or_risk",
      retry: "customer_action_required",
      confidence: "strong",
    });
    expect(r.errors[0]!.explanation).toMatch(/voids it automatically/);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it.each([
    ["2004", "card_declined", "customer_action_required", /hard decline/],
    ["2047", "fraud_or_risk", "do_not_retry", /Mastercard prohibits retries/],
    ["2099", "authentication_required", "customer_action_required", /soft decline/],
    ["2102", "authentication_failed", "customer_action_required", /soft decline/],
    ["2024", "configuration", "manual_review", /hard decline/],
    ["3000", "provider_unavailable", "retry_conditionally", /new transaction/],
  ])("decodes processor response %s", (code, category, retry, explanation) => {
    const r = analyzeJson(snake({ processor_response_code: code }));
    expect(r.errors[0]).toMatchObject({ code, category, retry, confidence: "strong" });
    expect(r.errors[0]!.retryExplanation).toMatch(explanation);
  });

  it("uses the documented generic row for 2109-2999", () => {
    const r = analyzeJson(snake({ processor_response_code: "2500" }));
    expect(r.errors[0]).toMatchObject({
      code: "2500",
      category: "card_declined",
      retry: "retry_conditionally",
      confidence: "possible",
    });
  });

  it("does not guess for undocumented processor codes", () => {
    const r = analyzeJson(snake({ processor_response_code: "1999" }));
    expect(r.errors[0]).toMatchObject({
      code: "1999",
      category: "card_declined",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not documented/);
    // The supplied hard/soft type is used for retry guidance, confidence stays low.
    const typed = analyzeJson(
      snake({ processor_response_code: "1999", processor_response_type: "hard_declined" }),
    );
    expect(typed.errors[0]).toMatchObject({ retry: "do_not_retry", confidence: "insufficient" });
    const approval = analyzeJson(snake({ processor_response_code: "1000" }));
    expect(approval.errors[0]!.missingInformation.join(" ")).toMatch(/approval code/);
  });

  it("matches the response text only when no code is supplied", () => {
    const r = analyzeJson(
      snake({
        processor_response_text: "Insufficient Funds",
        processor_response_type: "soft_declined",
      }),
    );
    expect(r.errors[0]).toMatchObject({
      code: "2001",
      category: "insufficient_funds",
      confidence: "possible",
    });
  });

  it("matches texts that use an en dash instead of a hyphen", () => {
    const text = `Processor Declined ${String.fromCharCode(0x2013)} Possible Lost Card`;
    const r = analyzeJson(snake({ processor_response_text: text }));
    expect(r.errors[0]).toMatchObject({
      code: "2012",
      category: "fraud_or_risk",
      confidence: "possible",
    });
  });

  it("keeps undocumented statuses unknown", () => {
    const r = analyzeJson(snake({ status: "brand_new_status", processor_response_code: "1000" }));
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.brand_new_status",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
    expect(r.errors).toEqual([]);
  });

  it("decodes failed and settlement_declined statuses", () => {
    const failed = analyzeJson(
      snake({
        status: "failed",
        processor_response_code: undefined,
        processor_response_text: undefined,
      }),
    );
    expect(failed.records[0]!.status).toBe("analyzed");
    expect(failed.errors[0]).toMatchObject({
      code: "failed",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
    });
    const settlement = analyzeJson(
      snake({ status: "settlement_declined", processor_settlement_response_code: "4004" }),
    );
    expect(settlement.events[0]).toMatchObject({ stage: "settlement", outcome: "failure" });
    expect(settlement.errors[0]).toMatchObject({
      code: "4004",
      category: "duplicate_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    const unknownSettlement = analyzeJson(
      snake({ status: "settlement_declined", processor_settlement_response_code: "4010" }),
    );
    expect(unknownSettlement.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
  });

  it("reports missing required fields as parse issues without throwing", () => {
    const r = analyzeJson({ processor_response_code: "2001", merchant_account_id: "PPLsynthM" });
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "braintree.transaction" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status/);
    expect(r.warnings.map((w) => w.code)).toContain("INVALID_RECORD");
    expect(braintreeAdapter.parse({}, "braintree.nope").ok).toBe(false);
  });

  it("rejects malformed JSON before any adapter runs", () => {
    const r = analyzeText('{"status": "settled", ', options);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_JSON");
  });
});

describe("braintree validation errors", () => {
  it("decodes SDK validation errors", () => {
    const r = analyzeFixture("sdk-validation-errors.json");
    expect(r.records[0]!.format).toBe("braintree.sdk.validation_errors");
    expect(
      r.errors.map((e) => [e.code, e.category, e.retry, e.confidence, e.subCodes.attribute]),
    ).toEqual([
      ["81502", "invalid_amount", "do_not_retry", "strong", "amount"],
      ["81531", "invalid_amount", "do_not_retry", "strong", "amount"],
    ]);
    expect(r.errors[0]!.source.path).toBe("errors.transaction.errors[0]");
    expect(r.events[0]).toMatchObject({
      eventType: "validation_errors",
      stage: "error",
      outcome: "failure",
      attributes: { errorCount: 2, codes: ["81502", "81531"], attributes: ["amount"] },
    });
    expect(r.findings).toEqual([]);
  });

  it("falls back to a generic validation entry for codes not in the catalog", () => {
    const r = analyzeJson({
      success: false,
      errors: [{ attribute: "base", code: "99999", message: "Something new." }],
    });
    expect(r.errors[0]).toMatchObject({
      code: "99999",
      category: "invalid_request",
      confidence: "possible",
    });
  });
});

describe("braintree webhook notifications", () => {
  it("parses an ACH transaction_settled notification", () => {
    const r = analyzeFixture("webhook-transaction-settled.json");
    expect(r.records[0]!.format).toBe("braintree.webhook.notification");
    expect(r.events[0]).toMatchObject({
      eventType: "transaction_settled",
      eventTypeKnown: true,
      stage: "settlement",
      outcome: "success",
      providerStatus: "settled",
      paymentReference: "PPLsynthACH1",
      eventTimestamp: "2026-10-25T06:00:00.000Z",
      amountMinor: "10000",
      currency: "USD",
      attributes: { notificationKind: "transaction_settled", subjectType: "transaction" },
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    const dump = JSON.stringify(r);
    expect(dump).not.toContain("PPLsynthRouting0");
    expect(dump).not.toContain("PPLsynth Account Holder");
  });

  it("does not claim to identify repeated deliveries (no documented notification id)", () => {
    const r = analyzeFixture("webhook-duplicate-settlement-declined.json");
    expect(r.events).toHaveLength(2);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(r.errors.map((e) => [e.code, e.category, e.retry, e.confidence])).toEqual([
      ["4001", "card_declined", "manual_review", "strong"],
      ["4001", "card_declined", "manual_review", "strong"],
    ]);
    expect(r.errors[0]!.source.path).toBe("transaction");
  });

  it("orders ACH notifications by timestamp and flags out-of-order arrival", () => {
    const r = analyzeFixture("webhook-ach-out-of-order.json");
    expect(r.events.map((e) => e.eventType)).toEqual([
      "transaction_settled",
      "transaction_settlement_declined",
    ]);
    expect(r.groups).toHaveLength(1);
    const f = r.findings.find((x) => x.ruleId === "OUT_OF_ORDER_ARRIVAL")!;
    expect(f.confidence).toBe("confirmed");
    expect(f.explanation).toMatch(/Braintree does not guarantee delivery order/);
  });

  it("parses dispute, review, disbursement and subscription notifications", () => {
    const r = analyzeJson([
      {
        kind: "dispute_won",
        timestamp: "2026-10-25T08:00:00Z",
        dispute: {
          id: "PPLsynthDSP9",
          status: "WON",
          kind: "chargeback",
          transaction: { id: "PPLsynthT9" },
        },
      },
      {
        kind: "transaction_reviewed",
        timestamp: "2026-10-25T08:30:00Z",
        transaction_review: {
          transaction_id: "PPLsynthT9",
          decision: "Reject",
          reviewer_email: "pplsynth.reviewer@example.com",
          reviewer_note: "PPLsynth private note",
        },
      },
      {
        kind: "disbursement",
        timestamp: "2026-10-25T09:00:00Z",
        disbursement: {
          id: "PPLsynthDISB1",
          transaction_ids: ["PPLsynthT9", "PPLsynthT8"],
          success: true,
          retry: false,
        },
      },
      {
        kind: "subscription_charged_unsuccessfully",
        timestamp: "2026-10-25T10:00:00Z",
        subscription: { id: "PPLsynthSUB1", status: "Past Due" },
      },
    ]);
    expect(
      r.events.map((e) => [e.eventType, e.stage, e.outcome, e.paymentReference ?? null]),
    ).toEqual([
      ["dispute_won", "dispute", "unknown", "PPLsynthT9"],
      ["transaction_reviewed", "other", "unknown", "PPLsynthT9"],
      ["disbursement", "other", "success", null],
      ["subscription_charged_unsuccessfully", "payment", "failure", null],
    ]);
    expect(r.events[0]!.attributes).toMatchObject({
      disputeStatus: "won",
      disputeId: "PPLsynthDSP9",
    });
    expect(r.events[2]!.attributes).toMatchObject({
      transactionCount: 2,
      disbursementSuccess: true,
    });
    // A disbursement covers many transactions, so it stays in its own group.
    expect(r.groups).toHaveLength(3);
    const dump = JSON.stringify(r.events);
    expect(dump).not.toContain("pplsynth.reviewer@example.com");
    expect(dump).not.toContain("PPLsynth private note");
  });

  it("shows undocumented kinds without semantics", () => {
    const r = analyzeJson({
      kind: "brand_new_kind",
      timestamp: "2026-10-25T08:00:00Z",
      subject: { transaction: { id: "PPLsynthT7", status: "settled" } },
    });
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      paymentReference: "PPLsynthT7",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("reports notifications with missing fields as invalid", () => {
    const noTimestamp = analyzeJson({ kind: "dispute_opened", dispute: { id: "PPLsynthD" } });
    expect(noTimestamp.records[0]).toMatchObject({ status: "invalid" });
    expect(noTimestamp.records[0]!.reasons.join(" ")).toMatch(/timestamp/);
    const noSubject = analyzeJson({
      kind: "transaction_settled",
      timestamp: "2026-10-25T08:00:00Z",
    });
    expect(noSubject.records[0]).toMatchObject({ status: "invalid" });
    const badDate = analyzeJson({
      kind: "transaction_settled",
      timestamp: "not a date",
      transaction: { id: "x" },
    });
    expect(badDate.records[0]).toMatchObject({ status: "invalid" });
  });

  it.each(["webhook-signed.txt", "webhook-signed-http.txt"])(
    "recognizes but never decodes the raw signed delivery (%s)",
    (name) => {
      const text = fixture(`braintree/${name}`);
      const r = analyze(text);
      expect(r.records[0]).toMatchObject({
        status: "unsupported",
        provider: "braintree",
        format: "braintree.webhook.signed",
        confidence: 0.98,
      });
      expect(r.records[0]!.reasons).toContain("arrived as form-encoded data");
      expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(
        /private API key/,
      );
      expect(r.events).toEqual([]);
      for (const out of [JSON.stringify(r), toJsonReport(r)]) {
        expect(out).not.toContain("a1b2c3d4e5f60718293a4b5c6d7e8f9012345678");
        expect(out).not.toContain("PPLsynthpublickey");
        expect(out).not.toContain("UFBMc3ludGhQYXlsb2FkT25seQ");
      }
    },
  );
});

describe("braintree correlation", () => {
  it("links a sale, its refund, a dispute and a GraphQL snapshot by explicit ids", () => {
    const r = analyzeFixture("sale-refund-dispute.json");
    expect(r.records.every((s) => s.status === "analyzed")).toBe(true);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.eventIds).toHaveLength(r.events.length);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["transaction.authorized", "authorization", "success"],
      ["transaction.submitted_for_settlement", "capture", "pending"],
      ["transaction.settled", "settlement", "success"],
      ["refund.submitted_for_settlement", "refund", "pending"],
      ["refund.settled", "refund", "success"],
      ["dispute_opened", "dispute", "unknown"],
      ["transaction.settled", "settlement", "success"],
    ]);
    const refund = r.events[4]!;
    expect(refund).toMatchObject({
      paymentReference: "PPLsynthSALE2",
      relatedReference: "PPLsynthREF2",
      amountMinor: "1000",
    });
    expect(r.events[6]!.paymentReference).toBe("PPLsynthGQLtxnSALE2");
    expect(braintreeAdapter.correlationKeys(r.events[5]!)).toEqual([
      "PPLsynthSALE2",
      "dispute:PPLsynthDSP2",
    ]);
    expect(ruleIds(r)).toEqual([]);
  });

  it("keeps transactions that only share an order id apart", () => {
    const r = analyzeFixture("unrelated-transactions.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "PPL-ORDER-BT-0005",
      "PPL-ORDER-BT-0005",
    ]);
    expect(r.errors[0]).toMatchObject({ code: "2046", category: "card_declined" });
  });

  it("does not link legacy and GraphQL ids unless one record carries both", () => {
    const sdk = {
      id: "PPLsynthLEG1",
      status: "settled",
      merchant_account_id: "m",
      currency_iso_code: "USD",
    };
    const gql = { data: { node: { id: "PPLsynthGQL1", status: "SETTLED", statusHistory: [] } } };
    expect(analyzeJson([sdk, gql]).groups).toHaveLength(2);
    const bridged = { ...sdk, graphql_id: "PPLsynthGQL1" };
    expect(analyzeJson([bridged, gql]).groups).toHaveLength(1);
  });
});

describe("braintree sensitive data", () => {
  it("copies only allowlisted fields", () => {
    const r = analyzeFixture("sensitive-snapshot.json");
    expect(r.errors[0]).toMatchObject({
      code: "2014",
      category: "fraud_or_risk",
      retry: "do_not_retry",
    });
    const planted = [
      "411111",
      "4111111111111111",
      "PPLsynth Cardholder Name",
      "PPLsynthVaultToken",
      "pplsynth.customer@example.com",
      "+15550100999",
      "PPLsynthFirstName",
      "PPLsynth Street 1",
      "PPL99999",
      "PPLsynthRiskId",
      "PPLsynthRiskReason",
      "PPLsynthCavvValue",
      "PPLsynthAuthCode",
      "PPLsynthNetworkTxnId",
      "PPLsynthNonceValue",
      "PPLsynthBankFreeText",
      "PPLsynthApiUser",
      "2031",
    ];
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
  });
});

describe("braintree manifest and catalog", () => {
  it("declares honest capabilities", () => {
    expect(braintreeAdapter.id).toBe("braintree");
    expect(defaultExport).toBe(braintreeAdapter);
    expect(braintreeManifest).toMatchObject({
      id: "braintree",
      version: BRAINTREE_ADAPTER_VERSION,
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
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_guaranteed" },
    });
    expect(BRAINTREE_ADAPTER_VERSION).toBe("0.1.0");
    const families = braintreeManifest.apiFamilies.map((f) => f.id);
    for (const f of braintreeAdapter.supportedFormats) expect(families).toContain(f.id);
  });

  it("contains the documented code tables", () => {
    expect(Object.keys(PROCESSOR_RESPONSES)).toHaveLength(110);
    const types = Object.values(PROCESSOR_RESPONSES).map((p) => p.declineType);
    expect(types.filter((t) => t === "Hard")).toHaveLength(83);
    expect(Object.keys(SETTLEMENT_RESPONSES)).toHaveLength(16);
    expect(Object.keys(GATEWAY_REJECTION_REASONS)).toHaveLength(14);
    expect(Object.keys(VALIDATION_ERRORS)).toHaveLength(12);
  });

  it("uses no en or em dash characters in source files", () => {
    const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const dir = new URL("../src/", import.meta.url);
    for (const file of readdirSync(fileURLToPath(dir))) {
      const text = readFileSync(fileURLToPath(new URL(file, dir)), "utf8");
      expect(LONG_DASHES.test(text), file).toBe(false);
    }
  });
});
