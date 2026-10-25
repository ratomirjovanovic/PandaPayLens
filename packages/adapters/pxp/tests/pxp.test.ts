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
  API_ERROR_CODES,
  APM_ERROR_CODES,
  APM_STATE_CODES,
  CARD_CODES,
  HTTP_STATUSES,
  PXP_ADAPTER_VERSION,
  WEBHOOK_EVENT_CODES,
  pxpAdapter,
  pxpManifest,
} from "@pandapaylens/pxp";
import defaultExport from "@pandapaylens/pxp";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [pxpAdapter],
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

const SYS = "PPLsynth-test-0001-txn";
const UUID_SYS = "0e1d2c3b-4a59-4687-9a1b-2c3d4e5f6a7b";
const OWNER = { merchantGroup: "PPLSYNTH-GROUP", merchant: "PPLSYNTH-M", site: "PPLSYNTH-S" };

const response = (fields: Record<string, unknown> = {}) => ({
  state: "Authorised",
  stateData: { code: "CRD000", message: "Approved" },
  merchantTransactionId: "PPLSYNTH-MTX-T001",
  merchantTransactionDate: "2026-10-20T10:00:00Z",
  systemTransactionId: SYS,
  transactionMethod: { intent: "Authorisation", fundingType: "Card", entryType: "Ecom" },
  amounts: { transaction: 10, currencyCode: "EUR" },
  ...fields,
});
const webhook = (data: Record<string, unknown> = {}, envelope: Record<string, unknown> = {}) => ({
  eventCategory: "transaction",
  eventDate: "2026-10-20T10:00:05.000Z",
  eventData: {
    state: "Authorised",
    systemTransactionId: SYS,
    merchantTransactionId: "PPLSYNTH-MTX-T001",
    transactionMethod: { intent: "Purchase", fundingType: "PayByBank", entryType: "Ecom" },
    amounts: { transaction: 10, currencyCode: "EUR" },
    ...data,
  },
  eventOwner: OWNER,
  ...envelope,
});
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;

describe("pxp detection", () => {
  it.each([
    [webhook(), "pxp.webhook", 0.95, true],
    [webhook({}, { eventOwner: undefined }), "pxp.webhook", 0.8, true],
    [
      { eventCategory: "Transaction", eventDate: "x", eventData: { eventCode: "TXN_RFU" } },
      "pxp.webhook",
      0.8,
      true,
    ],
    [
      { eventCategory: "test-connection", eventDate: "x", eventData: { eventCode: "TS_TC" } },
      "pxp.webhook.non_payment",
      0.8,
      false,
    ],
    [
      {
        eventCategory: "token",
        eventDate: "x",
        eventData: { state: "Completed" },
        eventOwner: OWNER,
      },
      "pxp.webhook.non_payment",
      0.8,
      false,
    ],
    [webhook({ eventCode: "TXNPP_UIC", state: undefined }), "pxp.webhook.non_payment", 0.95, false],
    [response({ systemTransactionId: UUID_SYS }), "pxp.transaction_response", 0.98, true],
    [response(), "pxp.transaction_response", 0.85, true],
    [{ systemTransactionId: UUID_SYS }, "pxp.transaction_response", 0.4, true],
    [
      { state: "Refused", stateData: { code: "CRD100", message: "Do not honour" } },
      "pxp.transaction_response",
      0.7,
      true,
    ],
    [
      { correlationId: "c", errorCode: "CAR0003", errorReason: "Invalid", details: [] },
      "pxp.api_error",
      0.9,
      true,
    ],
    [{ correlationId: "c", errorCode: "CAR9999", errorReason: "x" }, "pxp.api_error", 0.75, true],
    [{ correlationId: "c", errorCode: "WHATEVER", errorReason: "x" }, "pxp.api_error", 0.45, true],
    [{ errorCode: "GEN0008", errorReason: "x" }, "pxp.api_error", 0.4, true],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(pxpAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("raises a weak error envelope when it arrived as an HTTP error", () => {
    const meta = {
      format: "http" as const,
      http: { kind: "response" as const, status: 500, headers: {} },
    };
    expect(
      pxpAdapter.detect({ correlationId: "c", errorCode: "X1", errorReason: "x" }, meta).confidence,
    ).toBe(0.55);
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "PXPFinancial", message: "PXP error" },
      "pxp",
      null,
      [],
      { error: { code: "CRD100" } },
      { status: "Authorised" },
      { state: "Authorised" },
      { state: "Refused", stateData: { code: "05", message: "x" } },
      { errorCode: "130", errorReason: "x" },
      { errorCode: "CAR0003" },
      { systemTransactionId: "short" },
      { object: "event", eventCategory: "transaction", eventDate: "x", eventData: {} },
    ]) {
      expect(pxpAdapter.detect(input).confidence).toBe(0);
    }
  });

  it("keeps a bare envelope below the analysis threshold", () => {
    expect(
      pxpAdapter.detect({ eventCategory: "news", eventDate: "x", eventData: {} }).confidence,
    ).toBe(0.45);
    expect(pxpAdapter.detect({ eventCategory: "news", eventData: {} }).confidence).toBe(0.35);
  });

  it.each([
    "stripe",
    "adyen",
    "checkout",
    "paypal",
    "braintree",
    "mollie",
    "square",
    "payabl",
    "malformed",
    "mixed",
  ])("returns confidence 0 for every record in fixtures/%s", (dir) => {
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
          pxpAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("pxp parsing", () => {
  it("reports missing required webhook fields as parse issues without throwing", () => {
    const { eventDate: _omit, ...noDate } = webhook();
    const r = analyze(json(noDate));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "pxp.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^eventDate:/);
    expect(r.events).toEqual([]);
  });

  it("reports a response without state as a parse issue", () => {
    const { state: _omit, ...noState } = response({ systemTransactionId: UUID_SYS });
    const r = analyze(json(noState));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "pxp.transaction_response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^state:/);
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(pxpAdapter.parse(response({ state: 42 }), "pxp.transaction_response").ok).toBe(false);
    expect(pxpAdapter.parse({}, "pxp.unknown").ok).toBe(false);
    expect(pxpAdapter.parse({}, "toString").ok).toBe(false);
    const r = analyze(json({ correlationId: "c", errorCode: "CAR0003", errorReason: 7 }));
    expect(r.records[0]!.status).toBe("invalid");
  });

  it("tolerates unknown fields, null values and numeric codes", () => {
    const p = pxpAdapter.parse(
      response({
        brandNew: [1],
        providerTransactionId: null,
        fundingData: { card: { providerResponse: { code: 51, merchantAdvice: { code: 2 } } } },
      }),
      "pxp.transaction_response",
    );
    expect(p.ok).toBe(true);
    const e = firstEvent(
      response({
        fundingData: { card: { providerResponse: { code: 51, merchantAdvice: { code: 2 } } } },
      }),
    );
    expect(e.attributes).toMatchObject({ providerCode: "51", merchantAdviceCode: "02" });
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"eventCategory": "transaction", "eventData": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });

  it("recognizes but does not analyze test-connection and other non-payment webhooks", () => {
    const r = analyzeFixture("pxp/test-connection.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "pxp.webhook.non_payment",
    });
    expect(r.warnings[0]!.message).toMatch(/test-connection/);
    expect(r.events).toEqual([]);
    const report = analyze(
      json({
        eventCategory: "reporting",
        eventDate: "2026-10-20T10:00:00Z",
        eventData: { url: "https://reports.pplsynth.example/PLANTEDREPORTURL" },
        eventOwner: OWNER,
      }),
    );
    expect(report.records[0]!.status).toBe("unsupported");
    expect(toJsonReport(report)).not.toContain("PLANTEDREPORTURL");
  });
});

describe("pxp card responses and webhooks", () => {
  it("builds a card timeline and never merges a modification with a new id", () => {
    const r = analyzeFixture("pxp/card-authorisation-flow.json");
    expect(
      r.events.map((e) => [e.sourceFormat, e.eventType, e.stage, e.outcome, e.paymentReference]),
    ).toEqual([
      [
        "pxp.transaction_response",
        "Authorisation.Authorised",
        "authorization",
        "success",
        "PPLsynth-card-0001-auth",
      ],
      [
        "pxp.webhook",
        "transaction-authorised",
        "authorization",
        "success",
        "PPLsynth-card-0001-auth",
      ],
      [
        "pxp.transaction_response",
        "transaction.Captured",
        "capture",
        "success",
        "PPLsynth-card-0002-capt",
      ],
      ["pxp.webhook", "transaction-captured", "capture", "success", "PPLsynth-card-0001-auth"],
    ]);
    // The capture response has its own systemTransactionId and no parent field.
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.references.sort())).toEqual(
      expect.arrayContaining([["PPLsynth-card-0001-auth"], ["PPLsynth-card-0002-capt"]]),
    );
    expect(r.events[0]).toMatchObject({
      providerStatus: "Authorised",
      merchantReference: "PPLSYNTH-MTX-0001",
      amountMinor: "6540",
      currency: "GBP",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      stateDataCode: "CRD000",
      intent: "Authorisation",
      fundingType: "Card",
      paymentFamily: "card",
      cardScheme: "Visa",
      fundingDataShape: "nested",
      cardVerificationCodeResult: "CardSecurityCodeMatched",
      provider: "PXPFinancial",
      providerCode: "00",
      authorisedAmountMinor: "6540",
      settlementDate: "2026-10-21",
      merchantOrderId: "PPLSYNTH-ORDER-0001",
      timestampSource: "merchantTransactionDate (merchant supplied)",
    });
    expect(r.events[1]!.attributes).toMatchObject({
      eventTypeInferred: true,
      eventCategory: "transaction",
      timestampSource: "eventDate",
    });
    // No eventCode: no documented duplicate key.
    expect(r.events[1]!.deliveryKey).toBeUndefined();
    expect(r.events[2]).toMatchObject({ eventTimestamp: "2026-10-20T11:00:00.000Z" });
    expect(r.events[2]!.attributes).toMatchObject({ operationNotStated: true });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("decodes a refused card response with the raw acquirer fields", () => {
    const r = analyzeFixture("pxp/card-refused-response.json");
    expect(r.events[0]).toMatchObject({
      eventType: "Authorisation.Refused",
      stage: "authorization",
      outcome: "failure",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      fundingDataShape: "flat",
      providerCode: "05",
      merchantAdviceCode: "01",
      merchantAdviceMessage: "New account information available",
    });
    expect(r.errors[0]).toMatchObject({
      code: "CRD100",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Do not honour",
      paymentReference: "PPLsynth-card-0101-auth",
      attemptReference: "PPLsynth-card-0101-auth",
      subCodes: {
        state: "Refused",
        intent: "Authorisation",
        provider: "PXPFinancial",
        provider_code: "05",
        merchant_advice_code: "01",
      },
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not interpreted/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("decodes the refused card webhook (TXN_RFU) with a duplicate key", () => {
    const r = analyzeFixture("pxp/card-refused-webhook.json");
    expect(r.events[0]).toMatchObject({
      eventType: "TXN_RFU",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
      deliveryKey: "TXN_RFU:PPLsynth-card-0201-auth",
      eventTimestamp: "2026-10-20T11:14:43.276Z",
      amountMinor: "4000",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      provider: "lloydscardnet",
      providerCode: "30",
      entryType: "Instore",
      authorisedAmountMinor: "0",
    });
    expect(r.events[0]!.attributes).not.toHaveProperty("cardVerificationCodeResult");
    expect(r.errors[0]).toMatchObject({
      code: "CRD182",
      category: "invalid_request",
      retry: "do_not_retry",
      source: { path: "eventData" },
    });
  });

  it("never presents a downstream timeout as safe to retry", () => {
    const r = analyzeFixture("pxp/card-error-timeout.json");
    expect(r.events[0]).toMatchObject({
      eventType: "Purchase.Error",
      stage: "payment",
      outcome: "failure",
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "CRD183",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.retryExplanation).toMatch(/first verify the current state/);
    expect(e.retryExplanation).toMatch(/same merchantTransactionId/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it.each([
    ["CRD116", "insufficient_funds", "customer_action_required"],
    ["CRD102", "fraud_or_risk", "do_not_retry"],
    ["CRD109", "configuration", "do_not_retry"],
    ["CRD180", "authentication_required", "customer_action_required"],
    ["CRD123", "card_declined", "retry_conditionally"],
    ["APM4100", "provider_unavailable", "retry_conditionally"],
    ["APM4101", "duplicate_request", "do_not_retry"],
  ])("decodes %s as %s / %s", (code, category, retry) => {
    expect(
      firstError(response({ state: "Refused", stateData: { code, message: "m" } })),
    ).toMatchObject({ code, category, retry, confidence: "strong" });
  });

  it("decodes codes that also arrive with state Error", () => {
    const e = firstError(response({ state: "Error", stateData: { code: "CRD102", message: "m" } }));
    expect(e).toMatchObject({ code: "CRD102", subCodes: { state: "Error" } });
    expect(e.outcomeKnown).toBeUndefined();
  });

  it("treats VAN0001 as a documented code with an unknown category", () => {
    expect(
      firstError(response({ state: "Error", stateData: { code: "VAN0001", message: "m" } })),
    ).toMatchObject({ category: "unknown", retry: "manual_review", confidence: "possible" });
  });

  it("does not decode approvals and flags partial approvals", () => {
    expect(analyze(json(response())).errors).toEqual([]);
    const r = analyze(json(response({ stateData: { code: "CRD002", message: "Partial" } })));
    expect(r.errors).toEqual([]);
    expect(r.events[0]!.attributes.partialApproval).toBe(true);
  });

  it("reports unrecognized codes and code-less refusals honestly", () => {
    const unknown = firstError(
      response({ state: "Refused", stateData: { code: "CRD999", message: "x" } }),
    );
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/CRD999/);
    const bare = firstError(response({ state: "Refused", stateData: {} }));
    expect(bare).toMatchObject({ code: "Refused", confidence: "insufficient" });
    expect(bare.missingInformation.join(" ")).toMatch(/No stateData.code/);
  });

  it.each([
    ["Authorisation", "Authorised", "authorization", "success"],
    ["EstimatedAuthorisation", "Authorised", "authorization", "success"],
    ["Purchase", "Authorised", "payment", "success"],
    ["Purchase", "Captured", "capture", "success"],
    ["Void", "Cancelled", "void", "success"],
    ["Authorisation", "Cancelled", "cancellation", "success"],
    ["Refund", "Authorised", "refund", "success"],
    ["Refund", "Refused", "refund", "failure"],
    ["Capture", "Error", "capture", "failure"],
    ["Payout", "Pending", "payout", "pending"],
    ["Payout", "Authorised", "payout", "success"],
    ["Purchase", "PendingOnProvider", "payment", "pending"],
    ["Purchase", "Aborted", "payment", "failure"],
    ["Purchase", "Expired", "payment", "failure"],
    ["Purchase", "Refunded", "refund", "success"],
    ["Create", "Executed", "payment", "pending"],
  ])("maps intent %s with state %s to %s / %s", (intent, state, stage, outcome) => {
    const e = firstEvent(
      response({ state, stateData: {}, transactionMethod: { intent, fundingType: "Card" } }),
    );
    expect(e).toMatchObject({ stage, outcome, eventTypeKnown: true, providerStatus: state });
    expect(e.eventType).toBe(`${intent}.${state}`);
  });

  it("keeps undocumented and wrongly cased states unknown", () => {
    for (const state of ["Approved", "Confirmed", "Updated", "authorised", "Mystery"]) {
      const e = firstEvent(response({ state, stateData: {} }));
      expect(e).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    }
    const r = analyze(json(response({ state: "Approved", stateData: {} })));
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("shows an unrecognized intent without lifecycle semantics", () => {
    expect(firstEvent(response({ transactionMethod: { intent: "SomethingNew" } }))).toMatchObject({
      stage: "other",
      outcome: "success",
    });
  });

  it("does not merge transactions that only share a merchant order id", () => {
    const r = analyzeFixture("pxp/unrelated-transactions.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.attributes.merchantOrderId)).toEqual([
      "PPLSYNTH-ORDER-SHARED",
      "PPLSYNTH-ORDER-SHARED",
    ]);
    expect(r.groups.map((g) => g.latestOutcome)).toEqual(["failure", "success"]);
  });

  it("drops merchant references that contain personal data", () => {
    const e = firstEvent(response({ merchantTransactionId: "someone@example.com" }));
    expect(e.merchantReference).toBeUndefined();
  });
});

describe("pxp API errors", () => {
  it("decodes a validation error with its HTTP status", () => {
    const r = analyzeFixture("pxp/api-error-validation.txt");
    expect(r.suggestedView).toBe("decoder");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "unknown",
      providerStatus: "HTTP 400",
    });
    expect(r.errors[0]).toMatchObject({
      code: "CAR0003",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "possible",
      providerMessage: "Invalid Card Details Provided",
      subCodes: { http_status: "400", correlation_id: "PPLsynth-corr-0001" },
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/does not publish a list/);
  });

  it("decodes an authentication failure as configuration", () => {
    const r = analyze(
      [
        "HTTP/1.1 401 Unauthorized",
        "Content-Type: application/json",
        "",
        json({
          correlationId: "PPLsynth-corr-0002",
          details: [],
          errorCode: "CAR0004",
          errorReason: "Auth",
        }),
      ].join("\n"),
    );
    expect(r.errors[0]).toMatchObject({
      code: "CAR0004",
      category: "configuration",
      retry: "do_not_retry",
    });
  });

  it("treats an internal error as an unknown outcome", () => {
    const e = firstError({ correlationId: "c-1", errorCode: "GEN0008", errorReason: "Internal" });
    expect(e).toMatchObject({ category: "provider_unavailable", retry: "retry_conditionally" });
    expect(e.retryExplanation).toMatch(/verify/);
    expect(
      analyze(json({ correlationId: "c-1", errorCode: "GEN0008", errorReason: "x" })).findings.map(
        (f) => f.ruleId,
      ),
    ).toContain("POSSIBLE_RETRY_RISK");
  });

  it.each([
    [413, "invalid_request", "do_not_retry", "possible"],
    [500, "provider_unavailable", "retry_conditionally", "possible"],
    [418, "unknown", "unknown", "insufficient"],
  ])(
    "falls back to HTTP %i for unknown errorCode values",
    (status, category, retry, confidence) => {
      const r = analyze(
        [
          `HTTP/1.1 ${status} X`,
          "Content-Type: application/json",
          "",
          json({
            correlationId: "c",
            errorCode: "CAR0999",
            errorReason: "x",
            details: ["'amounts' - required"],
          }),
        ].join("\n"),
      );
      expect(r.errors[0]).toMatchObject({ category, retry, confidence });
      expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/CAR0999/);
      expect(r.events[0]!.attributes.details).toEqual(["'amounts' - required"]);
    },
  );

  it("reports an unknown code without HTTP status as insufficient", () => {
    const e = firstError({ correlationId: "c", errorCode: "CAR0999", errorReason: "x" });
    expect(e).toMatchObject({ category: "unknown", retry: "unknown", confidence: "insufficient" });
  });
});

describe("pxp pay by bank, PayPal and Aeropay", () => {
  it("keeps a SPEI deposit as a payment and reports duplicate deliveries", () => {
    const r = analyzeFixture("pxp/spei-deposit.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.deliveryKey])).toEqual([
      ["Purchase.Pending", "payment", "pending", undefined],
      [
        "spei-transaction-order-executed",
        "payment",
        "success",
        "spei-transaction-order-executed:PPLsynth-spei-0401-depo",
      ],
      [
        "spei-transaction-order-executed",
        "payment",
        "success",
        "spei-transaction-order-executed:PPLsynth-spei-0401-depo",
      ],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]).toMatchObject({ amountMinor: "150050", currency: "MXN" });
    expect(r.events[1]!.attributes).toMatchObject({
      paymentFamily: "pay_by_bank",
      localMethod: "spei",
      stateDataCode: "APM001",
      stateDataCodeExampleDerived: true,
      providerResponseCode: "EXECUTED",
      providerTransactionStatus: "EXECUTED",
      providerTransactionId: "PPLSYNTH-SPEI-REF-0401",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
    expect(r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!.explanation).toMatch(
      /eventCode and systemTransactionId/,
    );
  });

  it("keeps a SPEI payout as a payout and decodes the rejection", () => {
    const r = analyzeFixture("pxp/spei-payout-rejected.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["Payout.Pending", "payout", "pending"],
      ["spei-transaction-order-rejected", "payout", "failure"],
    ]);
    expect(r.errors[0]).toMatchObject({
      code: "APM013",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      subCodes: { provider_response_code: "REJECTED", intent: "Payout" },
    });
    expect(r.errors[0]!.explanation).toMatch(/no definition table/);
  });

  it.each([
    ["breb-transaction-order-cross-entry", "Refused", "APM004", "failure"],
    ["cvu-transaction-order-expired", "Expired", "APM011", "failure"],
    ["flashflow-transaction-refused", "Refused", "APM004", "failure"],
    ["cvu-transaction-order-refunded", "Refunded", "APM007", "success"],
  ])("maps %s", (eventCode, state, code, outcome) => {
    const r = analyze(json(webhook({ eventCode, state, stateData: { code, message: "m" } })));
    expect(r.events[0]).toMatchObject({ eventType: eventCode, eventTypeKnown: true, outcome });
    if (outcome === "failure") expect(r.errors[0]!.code).toBe(code);
    else expect(r.errors).toEqual([]);
  });

  it("uses the event code when the state is missing", () => {
    const e = firstEvent(
      webhook({ eventCode: "breb-transaction-order-refunded", state: undefined }),
    );
    expect(e).toMatchObject({ stage: "refund", outcome: "success" });
  });

  it("does not guess the operation of a deposit without intent", () => {
    const e = firstEvent(
      webhook({
        eventCode: "breb-transaction-order-executed",
        merchantTransactionId: null,
        transactionMethod: undefined,
      }),
    );
    expect(e).toMatchObject({ stage: "payment", outcome: "success" });
    expect(e.merchantReference).toBeUndefined();
    expect(e.attributes.operationNotStated).toBe(true);
  });

  it("reports a FlashFlow PendingOnProvider deposit as unresolved", () => {
    const r = analyzeFixture("pxp/flashflow-pending.json");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "pending",
      providerStatus: "PendingOnProvider",
    });
    // The merchant date has no time zone, so it is not placed on the timeline.
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.merchantTransactionDateWithoutZone).toBe(true);
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("links an Aeropay capture to its authorisation through originalSystemTransactionId", () => {
    const r = analyzeFixture("pxp/aeropay-capture.json");
    expect(
      r.events.map((e) => [
        e.eventType,
        e.stage,
        e.outcome,
        e.paymentReference,
        e.relatedReference,
      ]),
    ).toEqual([
      ["TXNAP_AUTH", "authorization", "success", "PPLsynth-aero-0701-auth", undefined],
      ["TXNAP_CPT", "capture", "success", "PPLsynth-aero-0701-auth", "PPLsynth-aero-0702-capt"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[0]!.attributes).toMatchObject({
      localMethod: "aeropay",
      achStatus: "Approved",
      isRtp: false,
      providerTransactionStatus: "pending",
    });
  });

  it("infers PayPal events from state and keeps the payout apart", () => {
    const r = analyzeFixture("pxp/paypal-flow.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["transaction-created", "payment", "pending"],
      ["transaction-executed", "payment", "pending"],
      ["transaction-authorised", "authorization", "success"],
      ["transaction-captured", "capture", "success"],
      ["payout-authorised", "payout", "success"],
    ]);
    expect(r.groups).toHaveLength(2);
    expect(r.events.every((e) => e.attributes.eventTypeInferred === true)).toBe(true);
    expect(r.events[0]!.attributes.paymentFamily).toBe("paypal");
    expect(r.events[4]).toMatchObject({ amountMinor: "5000", currency: "EUR" });
    expect(r.events[4]!.attributes).toMatchObject({
      amountField: "amount.transaction",
      transactionMethodShape: "string",
      intent: "Payout",
    });
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("does not invent an event name for a card refusal without eventCode", () => {
    const e = firstEvent(
      webhook({
        state: "Refused",
        stateData: { code: "CRD116", message: "m" },
        transactionMethod: { intent: "Purchase", fundingType: "Card" },
      }),
    );
    expect(e).toMatchObject({
      eventType: "transaction.Refused",
      eventTypeKnown: true,
      outcome: "failure",
    });
    expect(e.attributes.eventTypeInferred).toBe(false);
  });

  it("does not infer transaction-created for a pending card event", () => {
    const e = firstEvent(
      webhook({ state: "Pending", transactionMethod: { intent: "Purchase", fundingType: "Card" } }),
    );
    expect(e.eventType).toBe("transaction.Pending");
  });

  it("marks unknown event codes as unknown", () => {
    const r = analyze(json(webhook({ eventCode: "spei-transaction-order-mystery" })));
    expect(r.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "success" });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("shows undocumented categories without lifecycle semantics", () => {
    const e = firstEvent(webhook({}, { eventCategory: "chargeback" }));
    expect(e).toMatchObject({ stage: "other", outcome: "unknown", eventTypeKnown: false });
  });
});

describe("pxp 3DS", () => {
  it("decodes a failed challenge", () => {
    const r = analyzeFixture("pxp/challenge-failed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "challenge-completed",
      stage: "authentication",
      outcome: "failure",
      relatedReference: "PPLsynth-3ds-0901-auth",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      authenticationStateField: "authenticationState",
      transactionStatus: "N",
      transactionStatusReason: "01",
    });
    expect(r.errors[0]).toMatchObject({
      code: "AuthenticationFailed",
      category: "authentication_failed",
      retry: "customer_action_required",
      subCodes: { trans_status: "N", trans_status_reason: "01" },
    });
    expect(r.errors[0]!.explanation).toMatch(/Card authentication failed/);
  });

  it.each([
    ["AuthenticationRejected", "do_not_retry"],
    ["AuthenticationError", "retry_conditionally"],
  ])("decodes %s", (state, retry) => {
    const e = firstError({
      eventCategory: "Authentication",
      eventDate: "2026-10-20T10:00:00Z",
      eventData: { state, transactionStatusReason: 30 },
      eventOwner: OWNER,
    });
    expect(e).toMatchObject({ retry, subCodes: { trans_status_reason: "30" } });
    expect(e.missingInformation.join(" ")).toMatch(/"30"/);
  });

  it("does not decode a successful authentication", () => {
    const r = analyze(
      json({
        eventCategory: "authentication",
        eventDate: "2026-10-20T10:00:00Z",
        eventData: { authenticationState: "AuthenticationSuccessful", transactionStatus: "Y" },
        eventOwner: OWNER,
      }),
    );
    expect(r.events[0]).toMatchObject({ outcome: "success" });
    expect(r.errors).toEqual([]);
  });
});

describe("pxp sensitive data", () => {
  const PLANTED = [
    "PLANTEDREQUESTID0001",
    "1792500000PLANTED",
    "PPLSYNTHSIG",
    "PLANTEDSHOPPERREF01",
    "77 Planted Synthetic Road",
    "PL4NT",
    "planted.secret.person@example.com",
    "Planted Synthetic Name",
    "198.51.100.77",
    "4000005555551111",
    "Planted Holder Name",
    "PLANTEDGATEWAYTOKEN0001",
    "4837261100009999",
    "PLANTEDMID0001",
    "PLANTEDTID01",
    "PLANTEDRRN01",
    "PLANTEDSCHEMEID01",
    "PLANTEDPAR0001",
    "PLANTEDEMVDATA01",
    "PLANTEDPARTNER",
    "PLANTEDGROUP",
    "PLANTEDMERCHANT",
    "PLANTEDSITE",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("pxp/webhook-request.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "pxp.webhook" });
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
    // Capitalized eventCategory and amounts.transactionValue are documented drift.
    expect(r.events[0]).toMatchObject({
      eventType: "TXN_RFU",
      amountMinor: "9990",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      eventCategory: "Transaction",
      amountField: "amounts.transactionValue",
      fundingDataShape: "flat",
    });
    expect(r.errors[0]).toMatchObject({ code: "CRD116", category: "insufficient_funds" });
  });

  it("keeps session URLs out of events", () => {
    const dump = JSON.stringify([
      analyzeFixture("pxp/spei-deposit.json").events,
      analyzeFixture("pxp/flashflow-pending.json").events,
    ]);
    expect(dump).not.toMatch(/PLANTEDSESSIONURL|PLANTEDIFRAMEURL|PPL001|PPLSYNTH-GROUP/);
  });
});

describe("pxp manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(pxpAdapter);
    expect(pxpAdapter.manifest).toBe(pxpManifest);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(pxpManifest).toMatchObject({
      id: "pxp",
      version: PXP_ADAPTER_VERSION,
      wave: "HR-1",
      researchStatus: "tested",
      documentationAccess: "public",
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
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect([...pxpManifest.categories].sort()).toEqual([
      "acquiring",
      "alternative_payment_method",
      "card_processing",
      "gateway",
      "orchestration",
    ]);
    expect(pxpManifest.sectors).toHaveLength(12);
    for (const s of pxpManifest.sectors) expect(s.source).toMatch(/^https:\/\/www\.pxp\.io\//);
    expect(pxpManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(/adult/);
    const limits = pxpManifest.limitations.join(" ");
    expect(limits).toMatch(/no chargeback, dispute or settlement events/);
    expect(limits).toMatch(/Adult content is not a documented PXP sector/);
    expect(limits).toMatch(/never merged with the original by guesswork/);
    expect(limits).toMatch(/never verified/);
  });

  it("contains every documented code", () => {
    const crd = Object.keys(CARD_CODES).filter((c) => c.startsWith("CRD"));
    expect(crd).toHaveLength(44);
    expect(CARD_CODES).toHaveProperty("VAN0001");
    expect(Object.keys(APM_STATE_CODES)).toHaveLength(8);
    expect(Object.keys(APM_ERROR_CODES)).toHaveLength(7);
    expect(Object.keys(API_ERROR_CODES)).toHaveLength(12);
    expect(Object.keys(HTTP_STATUSES)).toHaveLength(8);
    expect(Object.keys(WEBHOOK_EVENT_CODES)).toHaveLength(28);
    expect(Object.values(APM_STATE_CODES).every((e) => e.exampleDerived)).toBe(true);
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      pxpManifest,
      CARD_CODES,
      APM_STATE_CODES,
      APM_ERROR_CODES,
      API_ERROR_CODES,
      HTTP_STATUSES,
      WEBHOOK_EVENT_CODES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
