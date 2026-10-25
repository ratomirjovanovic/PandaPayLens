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
  ADVICE_CODES,
  CLIENT_LIBRARY_CODES,
  decodeTrustPaymentsCode,
  DOCUMENTED_CODE_COUNT,
  GATEWAY_CODES,
  INVALID_PROCESS_CODES,
  PORTAL_CODES,
  SETTLE_STATUSES,
  TRUST_PAYMENTS_FORMATS,
  trustPaymentsAdapter,
  trustPaymentsManifest,
} from "@pandapaylens/trust-payments";

const options: AnalyzeOptions = {
  adapters: [trustPaymentsAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturesRoot = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const fixturePath = (p: string) => `${fixturesRoot}${p}`;
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (p: string) => analyze(fixture(`trust_payments/${p}`));

function analyzeMany(...files: string[]): AnalysisResult {
  const r = analyzeSources(
    files.map((f) => ({ name: f, text: fixture(`trust_payments/${f}`) })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const json = { format: "json" } as const satisfies RecordMeta;
const formMeta = { format: "form" } as const satisfies RecordMeta;
const SIG = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";

function envelope(el: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    requestreference: "W23-PPLsynth99",
    version: "1.00",
    response: [
      {
        errorcode: "0",
        errormessage: "Ok",
        requesttypedescription: "AUTH",
        accounttypedescription: "ECOM",
        transactionreference: "PPLsynth-9-99001",
        baseamount: "100",
        currencyiso3a: "GBP",
        settlestatus: "0",
        ...el,
      },
    ],
    secrand: "x1",
    ...extra,
  };
}

const detectText = (text: string) => {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error("parse failed");
  return trustPaymentsAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
};

describe("Trust Payments detection", () => {
  it.each([
    ["auth-success.json", TRUST_PAYMENTS_FORMATS.envelope, true],
    ["validation-error.json", TRUST_PAYMENTS_FORMATS.envelope, true],
    ["jwt-threedquery-auth.json", TRUST_PAYMENTS_FORMATS.jwt, true],
    ["notification-default.txt", TRUST_PAYMENTS_FORMATS.notification, true],
    ["notification-http-recur.txt", TRUST_PAYMENTS_FORMATS.notification, true],
    ["redirect-declined.txt", TRUST_PAYMENTS_FORMATS.redirect, true],
    ["request-envelope.json", TRUST_PAYMENTS_FORMATS.request, false],
  ])("detects %s", (file, format, supported) => {
    const d = detectText(fixture(`trust_payments/${file}`));
    expect(d).toMatchObject({ provider: "trust_payments", format, supported });
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("scores a full envelope highly and a single response object moderately", () => {
    expect(detectText(fixture("trust_payments/auth-success.json")).confidence).toBe(0.98);
    const single = (
      JSON.parse(fixture("trust_payments/bypass-error.json")) as {
        response: unknown[];
      }
    ).response[0];
    const d = trustPaymentsAdapter.detect(single, json);
    expect(d.format).toBe(TRUST_PAYMENTS_FORMATS.object);
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
    expect(d.confidence).toBeLessThan(0.8);
  });

  it("does not claim generic shapes", () => {
    const d = (o: unknown, meta: RecordMeta = json) =>
      trustPaymentsAdapter.detect(o, meta).confidence;
    expect(d({ error: "x" })).toBe(0);
    expect(d({ status: "0" })).toBe(0);
    expect(d({ errorcode: "0" })).toBe(0);
    expect(d({ response: [{ errorcode: "0" }] })).toBe(0);
    expect(d({ response: "x", requestreference: "W1" })).toBe(0);
    expect(d({ response: ["oops"], secrand: "x" })).toBe(0);
    // Two distinctive fields alone stay below the acceptance threshold.
    expect(d({ errorcode: "0", requesttypedescription: "AUTH" })).toBeLessThan(0.5);
    expect(d({ response: [{ errorcode: "0", requesttypedescription: "AUTH" }] })).toBeLessThan(0.5);
    expect(d({ errorcode: "0" }, formMeta)).toBe(0);
    expect(d({ errorcode: "0", settlestatus: "0" }, formMeta)).toBe(0);
    expect(d({ notificationreference: "PPLsynth-1" }, formMeta)).toBeLessThan(0.5);
    expect(d({ object: "event", response: [] })).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
    expect(d("errorcode=0")).toBe(0);
    // JSON families are not claimed when the record arrived as form data, and vice versa.
    expect(d(envelope({}), formMeta)).toBe(0);
    expect(
      d({ notificationreference: "PPLsynth-1", responsesitesecurity: SIG, errorcode: "0" }, json),
    ).toBe(0);
  });

  it("detects by structure, never by the Trust Payments or Secure Trading brand", () => {
    const branded = envelope({
      issuer: "SecureTrading Test Issuer1",
      operatorname: "webservices@example.com",
    });
    const plain = envelope({});
    const d = (o: unknown) => trustPaymentsAdapter.detect(o, json);
    expect(d(branded).confidence).toBe(d(plain).confidence);
    expect(
      d({
        provider: "Trust Payments",
        host: "webservices.securetrading.net",
        issuer: "SecureTrading Test Issuer1",
        library: "securetrading",
      }).confidence,
    ).toBe(0);
    expect(
      trustPaymentsAdapter.detect(
        { gateway: "payments.securetrading.net", brand: "TRU Connect" },
        formMeta,
      ).confidence,
    ).toBe(0);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(trustPaymentsAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(
            0,
          );
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(trustPaymentsAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("stays below the acceptance threshold on other providers' fixtures", () => {
    for (const dir of readdirSync(fixturesRoot)) {
      if (dir === "trust_payments" || !statSync(fixturePath(dir)).isDirectory()) continue;
      for (const file of readdirSync(fixturePath(dir))) {
        if (!/\.(json|jsonl|txt|http)$/.test(file)) continue;
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          expect(
            trustPaymentsAdapter.detect(record, parsed.value.meta[i]).confidence,
            `${dir}/${file}[${i}]`,
          ).toBeLessThan(0.5);
        });
      }
    }
  });
});

describe("Trust Payments Webservices responses", () => {
  it("normalizes a successful AUTH as an authorization, not a settlement", () => {
    const r = analyzeFixture("auth-success.json");
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: TRUST_PAYMENTS_FORMATS.envelope,
    });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      provider: "trust_payments",
      eventType: "AUTH",
      eventTypeKnown: true,
      stage: "authorization",
      outcome: "success",
      providerStatus: "errorcode=0; settlestatus=0 (Pending)",
      paymentReference: "PPLsynth-9-80006",
      merchantReference: "PPLsynth-order-123",
      amountMinor: "1050",
      currency: "GBP",
      isRecurring: false,
      eventTimestamp: "2026-10-20T15:08:47.000Z",
      source: { recordIndex: 0, path: "response[0]" },
    });
    expect(r.events[0]!.attributes).toMatchObject({
      envelope: "raw",
      requestReference: "W23-PPLsynth01",
      requestType: "AUTH",
      accountType: "ECOM",
      settleStatusLabel: "Pending",
      settleDueDate: "2026-10-20",
      liveStatus: "test",
      paymentType: "VISA",
      acquirerResponseCode: "00",
      securityResponseSecurityCode: "2 (matched)",
      securityResponseAddress: "0 (not given)",
      issuerCountry: "US",
      timestampTimeZone: "not_documented_read_as_utc",
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("decodes a 70000 decline with limited confidence and acquirer advice", () => {
    const r = analyzeFixture("auth-declined.json");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.errors).toHaveLength(1);
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "70000",
      category: "card_declined",
      confidence: "possible",
      retry: "do_not_retry",
      providerMessage: "Decline",
      paymentReference: "PPLsynth-9-80010",
      attemptReference: "PPLsynth-9-80010",
      outcomeKnown: true,
      source: { recordIndex: 0, path: "response[0]" },
    });
    expect(e.subCodes).toMatchObject({
      family: "gateway",
      acquirerresponsecode: "05",
      acquireradvicecode: "4",
      requesttypedescription: "AUTH",
      settlestatus: "3",
    });
    expect(e.explanation).toMatch(/Trust Payments does not publish what acquirer codes mean/);
    expect(e.explanation).toMatch(/Acquirer advice code 4: Do not try again/);
    expect(e.missingInformation.join(" ")).toMatch(/no table for acquirerresponsecode/);
    expect(e.documentation.map((d) => d.url)).toContain(
      "https://help.trustpayments.com/hc/en-us/articles/39603445704721-How-do-I-handle-declined-transactions",
    );
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("decodes a validation error from the client library responses array", () => {
    const r = analyzeFixture("validation-error.json");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    expect(r.events[0]!.attributes.envelope).toBe("library");
    expect(r.events[0]!.source.path).toBe("responses[0]");
    expect(r.errors[0]).toMatchObject({
      code: "30000",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(r.errors[0]!.subCodes.errordata).toBe("baseamount");
    expect(r.errors[0]!.explanation).toMatch(/errordata: baseamount/);
    expect(r.errors[0]!.nextAction).toMatch(/errordata/);
  });

  it("accepts errordata as a string in raw responses", () => {
    const r = analyze(JSON.stringify(envelope({ errorcode: "30000", errordata: "currencyiso3a" })));
    expect(r.errors[0]!.subCodes.errordata).toBe("currencyiso3a");
  });

  it("decodes an authentication (credentials) failure as configuration", () => {
    const r = analyze(
      JSON.stringify({
        requestreference: "A9PPLsynth",
        responses: [
          {
            errorcode: "6",
            errormessage: "Invalid credentials provided",
            requesttypedescription: "ERROR",
          },
        ],
      }),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "6",
      category: "configuration",
      retry: "do_not_retry",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes.family).toBe("client_library");
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://github.com/SecureTrading/st-python-api",
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/No transactionreference/);
  });

  it("treats a bank system error as an unknown outcome needing manual review", () => {
    const r = analyzeFixture("bank-error-60010.json");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "60010",
      category: "provider_unavailable",
      retry: "manual_review",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.nextAction).toMatch(/final status of the transaction is unknown/);
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it("shows both documented descriptions of 50000 in a decoded response JWT", () => {
    const r = analyzeFixture("jwt-timeout-50000.json");
    expect(r.records[0]!.format).toBe(TRUST_PAYMENTS_FORMATS.jwt);
    expect(r.events[0]).toMatchObject({
      outcome: "unknown",
      source: { path: "payload.response[0]" },
    });
    expect(r.events[0]!.attributes).toMatchObject({ envelope: "jwt", jwtIssuedAt: 1792911600 });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "50000",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      confidence: "possible",
      providerMessage: "Timeout",
    });
    expect(e.explanation).toMatch(/Socket receive error/);
    expect(e.explanation).toMatch(/"Timeout"/);
    expect(e.missingInformation.join(" ")).toMatch(/two descriptions for 50000/);
    expect(e.retryExplanation).toMatch(/Verify the transaction's final status first/);
    expect(e.retry).not.toBe("safe_to_retry_technical_request");
    expect(ruleIds(r)).toEqual(["POSSIBLE_RETRY_RISK", "UNRESOLVED_OUTCOME"]);
  });

  it("links THREEDQUERY and AUTH from a decoded JWT through parenttransactionreference", () => {
    const r = analyzeFixture("jwt-threedquery-auth.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["THREEDQUERY", "authentication", "success"],
      ["AUTH", "authorization", "success"],
    ]);
    expect(r.events[0]!.attributes).toMatchObject({
      threeDsEnrolled: "Y (enrolled)",
      threeDsStatus: "Y (authenticated)",
      threeDsVersion: "2.2.0",
    });
    expect(r.events[1]!.relatedReference).toBe("PPLsynth-9-4021491");
    expect(r.events[1]!.attributes.customerOutput).toBe("RESULT");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.eventIds).toHaveLength(2);
    expect(r.groups[0]!.latestOutcome).toBe("success");
  });

  it("maps 3-D Secure statuses without guessing", () => {
    const status = (s: string) =>
      analyze(
        JSON.stringify(
          envelope({ requesttypedescription: "THREEDQUERY", status: s, settlestatus: "0" }),
        ),
      ).events[0]!.outcome;
    expect(status("Y")).toBe("success");
    expect(status("C")).toBe("pending");
    expect(status("N")).toBe("failure");
    expect(status("R")).toBe("failure");
    expect(status("U")).toBe("unknown");
    expect(status("Q")).toBe("unknown");
  });

  it("decodes the 3-D Secure bypass (22000) as informational", () => {
    const r = analyzeFixture("bypass-error.json");
    expect(r.events[0]).toMatchObject({ eventType: "ERROR", stage: "error", outcome: "unknown" });
    expect(r.events[0]!.attributes.threeDsBypassed).toBe(true);
    expect(r.errors[0]).toMatchObject({
      code: "22000",
      category: "payment_method_unavailable",
      retry: "do_not_retry",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.nextAction).toMatch(/without liability shift/);
    expect(r.errors[0]!.explanation).toMatch(/may not have been processed/);
  });

  it("follows the settle status lifecycle for AUTH", () => {
    const auth = (settlestatus: string) =>
      analyze(JSON.stringify(envelope({ settlestatus }))).events[0]!;
    expect(auth("1")).toMatchObject({ stage: "authorization", outcome: "success" });
    expect(auth("2")).toMatchObject({ stage: "authorization", outcome: "pending" });
    expect(auth("10")).toMatchObject({ stage: "settlement", outcome: "pending" });
    expect(auth("100")).toMatchObject({ stage: "settlement", outcome: "success" });
    expect(auth("3")).toMatchObject({ stage: "cancellation", outcome: "success" });
    expect(auth("3").attributes.cancelledBeforeSettlement).toBe(true);
    expect(auth("42")).toMatchObject({ stage: "authorization", outcome: "unknown" });
  });

  it("keeps an APM AUTH awaiting the customer pending and drops its secrets", () => {
    const r = analyzeFixture("apm-pending.json");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "pending" });
    expect(r.events[0]!.attributes).toMatchObject({ apmRedirect: true, paymentType: "IDEAL" });
    const out = JSON.stringify(r.events);
    expect(out).not.toContain("PPLsynthAcquirerSecret");
    expect(out).not.toContain("apm.example");
  });

  it("treats a settled REFUND as a refund linked to its AUTH", () => {
    const r = analyzeMany("auth-success.json", "refund.json");
    const refund = r.events.find((e) => e.eventType === "REFUND")!;
    expect(refund).toMatchObject({
      stage: "refund",
      outcome: "success",
      paymentReference: "PPLsynth-9-80007",
      relatedReference: "PPLsynth-9-80006",
      amountMinor: "1050",
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual(["PPLsynth-9-80006", "PPLsynth-9-80007"]);
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("does not treat an unsettled refund as complete", () => {
    const r = analyze(
      JSON.stringify(
        envelope({
          requesttypedescription: "REFUND",
          settlestatus: "0",
          authcode: "REFUND ACCEPTED",
          parenttransactionreference: "PPLsynth-9-99000",
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "refund", outcome: "pending" });
    expect(r.events[0]!.attributes.offlineRefund).toBe(true);
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("treats a CFT REFUND as a payout, separately from refunds", () => {
    const r = analyzeFixture("payout-gaming.json");
    expect(r.events[0]).toMatchObject({
      eventType: "REFUND",
      stage: "payout",
      outcome: "success",
      amountMinor: "25000",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      accountType: "CFT",
      merchantCategoryCode: "7995",
      payoutVertical: "Gaming payouts (gambling winnings)",
    });
    const pending = analyze(
      JSON.stringify(envelope({ requesttypedescription: "REFUND", accounttypedescription: "CFT" })),
    );
    expect(pending.events[0]).toMatchObject({ stage: "payout", outcome: "pending" });
    expect(ruleIds(pending)).toContain("PAYOUT_STATUS");
  });

  it("decodes Mastercard duplicate payout advice on a declined payout", () => {
    const r = analyze(
      JSON.stringify(
        envelope({
          requesttypedescription: "REFUND",
          accounttypedescription: "CFT",
          errorcode: "70000",
          settlestatus: "3",
          acquireradvicecode: "80",
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "payout", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({ retry: "manual_review" });
    expect(r.errors[0]!.explanation).toMatch(
      /Duplicate payout; the approval status of the original payout is unknown/,
    );
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("represents the Subscription Engine schedule as a subscription event", () => {
    const r = analyzeFixture("subscription-engine.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["THREEDQUERY", "authentication", "success"],
      ["AUTH", "authorization", "success"],
      ["SUBSCRIPTION", "subscription", "success"],
    ]);
    const sub = r.events[2]!;
    expect(sub.subscriptionReference).toBe("PPLsynth-9-70003");
    expect(sub.attributes).toMatchObject({
      subscriptionType: "RECURRING",
      subscriptionUnit: "MONTH",
      subscriptionFinalNumber: "0",
      subscriptionState: "2 (pending until the first payment settles)",
    });
    expect(r.groups).toHaveLength(1);
  });

  it("marks RECUR rebills as recurring payments and reports a failed rebill", () => {
    const r = analyzeFixture("recurring-sequence.json");
    expect(r.events.map((e) => [e.stage, e.outcome, e.isRecurring])).toEqual([
      ["authorization", "success", false],
      ["payment", "success", true],
      ["payment", "failure", true],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.eventIds).toHaveLength(3);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE", "RECURRING_PAYMENT_FAILED"]);
    const e = r.errors[0]!;
    expect(e).toMatchObject({ code: "70000", retry: "retry_conditionally" });
    expect(e.retryExplanation).toMatch(/Acquirer advice code 25: Retry after 24 hours/);
    expect(e.retryExplanation).toMatch(
      /not be retried more than once per day for the next 31 days/,
    );
  });

  it("treats a SCHEMEUPDATE 70000 with settle status 3 as a cardholder stop", () => {
    const r = analyzeFixture("schemeupdate-stopped.json");
    expect(r.events[0]).toMatchObject({
      eventType: "SCHEMEUPDATE",
      stage: "cancellation",
      outcome: "success",
    });
    expect(r.events[0]!.attributes.recurringStoppedByCardholder).toBe(true);
    expect(r.errors[0]).toMatchObject({
      code: "70000",
      confidence: "strong",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.explanation).toMatch(/cardholder asked to stop recurring payments/);
    expect(r.errors[0]!.missingInformation.join(" ")).not.toMatch(/acquirerresponsecode/);
  });

  it("normalizes TRANSACTIONQUERY records as separate, linked events", () => {
    const r = analyzeFixture("transactionquery.json");
    expect(r.events).toHaveLength(2);
    const [auth, refund] = r.events;
    expect(auth).toMatchObject({
      eventType: "AUTH",
      stage: "settlement",
      outcome: "success",
      eventTimestamp: "2026-10-11T03:15:00.000Z",
      source: { path: "response[0].records[0]" },
    });
    expect(auth!.attributes).toMatchObject({
      transactionQueryRecord: true,
      queryFound: "2",
      settledAt: "2026-10-11T03:15:00.000Z",
      settleBaseAmount: "4200",
      interface: "PASS-JSON-JSON",
    });
    expect(refund).toMatchObject({ stage: "refund", outcome: "pending" });
    expect(refund!.attributes.offlineRefund).toBe(true);
    expect(r.groups).toHaveLength(1);
  });

  it("emits an error event for a failed TRANSACTIONQUERY", () => {
    const r = analyze(
      JSON.stringify(
        envelope({ requesttypedescription: "TRANSACTIONQUERY", errorcode: "60019", records: [] }),
      ),
    );
    expect(r.events[0]).toMatchObject({
      eventType: "TRANSACTIONQUERY",
      stage: "error",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({ code: "60019", category: "invalid_request" });
  });

  it("groups a soft decline with its 3-D Secure resubmission", () => {
    const r = analyzeFixture("soft-decline-resubmission.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["AUTH", "failure"],
      ["THREEDQUERY", "pending"],
      ["AUTH", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "71000",
      category: "authentication_required",
      retry: "customer_action_required",
    });
    expect(r.errors[0]!.nextAction).toMatch(/scaexemptionindicator=14/);
    expect(r.groups[0]!.latestOutcome).toBe("success");
  });

  it("keeps unrelated transactions apart even with the same orderreference", () => {
    const r = analyzeFixture("unrelated-auths.json");
    expect(r.events).toHaveLength(2);
    expect(r.groups).toHaveLength(2);
    for (const e of r.events)
      expect(trustPaymentsAdapter.correlationKeys(e)).not.toContain("PPLsynth-order-same");
  });

  it("reports an unrecognized code honestly", () => {
    const r = analyze(JSON.stringify(envelope({ errorcode: "12345", errormessage: "Something" })));
    expect(r.events[0]).toMatchObject({ outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "12345",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /not on the Trust Payments error code list/,
    );
  });

  it("keeps unknown request types unknown", () => {
    const r = analyze(JSON.stringify(envelope({ requesttypedescription: "AUTH", errorcode: "0" })));
    expect(r.events[0]!.eventTypeKnown).toBe(true);
    const obj = {
      errorcode: "0",
      requesttypedescription: "AUTH",
      transactionreference: "PPLsynth-9-99100",
      settlestatus: "0",
    };
    const unknownType = analyzeRecords(
      [{ ...envelope({}), response: [{ ...obj, requesttypedescription: "FUTURETYPE" }] }],
      options,
      [json],
    );
    expect(unknownType.ok).toBe(true);
    if (!unknownType.ok) return;
    expect(unknownType.result.events[0]).toMatchObject({
      eventType: "FUTURETYPE",
      eventTypeKnown: false,
      stage: "other",
    });
    expect(unknownType.result.findings.map((f) => f.ruleId)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("does not use local time for timestamps without a documented zone", () => {
    const r = analyze(
      JSON.stringify(envelope({ transactionstartedtimestamp: "2026-02-30 10:00:00" })),
    );
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    const ok = analyze(
      JSON.stringify(envelope({ transactionstartedtimestamp: "2026-03-29 01:30:00" })),
    );
    expect(ok.events[0]!.eventTimestamp).toBe("2026-03-29T01:30:00.000Z");
  });
});

describe("Trust Payments URL notifications and redirects", () => {
  it("infers the event of a notification from documented fields and never marks it verified", () => {
    const r = analyzeFixture("notification-auth-settled.txt");
    expect(r.records[0]!.format).toBe(TRUST_PAYMENTS_FORMATS.notification);
    expect(r.events[0]).toMatchObject({
      eventType: "notification.AUTH",
      eventTypeKnown: true,
      stage: "settlement",
      outcome: "success",
      eventReference: "PPLsynth-A60400",
      deliveryKey: "PPLsynth-A60400",
      paymentReference: "PPLsynth-9-80006",
      amountMinor: "1050",
      currency: "GBP",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      eventInferred: true,
      inferredFrom: ["requesttypedescription", "errorcode", "settlestatus"],
      signature: "present_sha256_length",
      signatureVerified: false,
    });
    expect(r.errors).toEqual([]);
  });

  it("links a notification to the API response of the same transaction", () => {
    const r = analyzeMany("auth-success.json", "notification-auth-settled.txt");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.stage).sort()).toEqual(["authorization", "settlement"]);
  });

  it("keeps a notification without requesttypedescription as an unknown event", () => {
    const r = analyzeFixture("notification-default.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "notification",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      amountMinor: "2499",
      merchantReference: "PPLsynth-order-1",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(r.events[0]!.attributes.inferredFrom).toEqual(["errorcode"]);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("reads an HTTP notification of an engine rebill", () => {
    const r = analyzeFixture("notification-http-recur.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "notification.AUTH",
      stage: "payment",
      outcome: "success",
      isRecurring: true,
      relatedReference: "PPLsynth-9-70002",
    });
  });

  it("reports a repeated delivery of the same notificationreference", () => {
    const r = analyzeFixture("notification-duplicate.txt");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
    const finding = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(finding.explanation).toMatch(/notificationreference/);
    expect(finding.documentationUrl).toBe(trustPaymentsManifest.delivery.docsUrl);
  });

  it("decodes a declined Payment Pages redirect without a delivery key", () => {
    const r = analyzeFixture("redirect-declined.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "redirect",
      outcome: "failure",
      paymentReference: "PPLsynth-9-80300",
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.events[0]!.attributes.browserRedirect).toBe(true);
    expect(r.errors[0]).toMatchObject({ code: "70000", category: "card_declined" });
  });

  it("adds context when a notification error has no request type", () => {
    const text = new URLSearchParams({
      notificationreference: "PPLsynth-A61000",
      errorcode: "60022",
      settlestatus: "3",
      transactionreference: "PPLsynth-9-81000",
      responsesitesecurity: SIG,
    }).toString();
    const r = analyze(text);
    expect(r.errors[0]).toMatchObject({ code: "60022", category: "authentication_failed" });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /does not include requesttypedescription/,
    );
  });

  it("handles repeated form fields", () => {
    const r = analyze(
      `notificationreference=PPLsynth-A62000&errorcode=0&settlestatus=0&requesttypedescription=AUTH&transactionreference=PPLsynth-9-82000&orderreference=PPLsynth-o1&orderreference=PPLsynth-o2&responsesitesecurity=${SIG}`,
    );
    expect(r.events[0]!.merchantReference).toBe("PPLsynth-o1");
    expect(r.events[0]!.attributes.repeatedFields).toEqual(["orderreference"]);
  });
});

describe("Trust Payments invalid and unsupported input", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const missing = {
      requestreference: "W23-PPLsynth98",
      version: "1.00",
      response: [
        {
          requesttypedescription: "AUTH",
          transactionreference: "PPLsynth-9-98001",
          settlestatus: "0",
        },
      ],
      secrand: "x",
    };
    const r = analyzeRecords([missing], options, [json]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Without errorcode the envelope is not recognized at all.
    expect(r.result.records[0]!.status).toBe("unsupported");

    const noCode = {
      ...missing,
      response: [
        { errorcode: "0", requesttypedescription: "AUTH" },
        { requesttypedescription: "AUTH" },
      ],
    };
    const r2 = analyzeRecords([noCode], options, [json]);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.result.records[0]).toMatchObject({ status: "invalid" });
    expect(r2.result.records[0]!.reasons.join(" ")).toMatch(/response\.1\.errorcode/);

    const form = analyze(
      `notificationreference=&errorcode=0&transactionreference=PPLsynth-9-83000&responsesitesecurity=${SIG}`,
    );
    expect(form.records[0]).toMatchObject({ status: "invalid" });
    expect(form.records[0]!.reasons).toEqual(["notificationreference: required"]);
  });

  it("reports malformed payloads as invalid records", () => {
    const r = analyzeRecords(
      [envelope({ settlestatus: 100 }), envelope({ baseamount: 10.5 }), envelope({ errorcode: 0 })],
      options,
      [json, json, json],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // A numeric errorcode does not match the documented string shape, so it is not claimed.
    expect(r.result.records.map((x) => x.status)).toEqual(["invalid", "invalid", "unsupported"]);
    expect(r.result.warnings.map((w) => w.code)).toContain("INVALID_RECORD");

    const parseFailure = analyzeText('{"requestreference":"W1","response":[', options);
    expect(parseFailure.ok).toBe(false);

    expect(trustPaymentsAdapter.parse("x", TRUST_PAYMENTS_FORMATS.envelope)).toMatchObject({
      ok: false,
    });
    expect(trustPaymentsAdapter.parse({}, "trust_payments.unknown")).toMatchObject({ ok: false });
    expect(
      trustPaymentsAdapter.parse({ version: "1.00" }, TRUST_PAYMENTS_FORMATS.envelope),
    ).toEqual({
      ok: false,
      issues: ["response: required (or responses)"],
    });
  });

  it("recognizes but does not analyze request envelopes", () => {
    const r = analyzeFixture("request-envelope.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      provider: "trust_payments",
      format: TRUST_PAYMENTS_FORMATS.request,
    });
    expect(r.events).toEqual([]);
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(
      /paste the response/,
    );
  });

  it("recognizes but does not analyze undocumented API versions", () => {
    const r = analyze(JSON.stringify(envelope({}, { version: "2.00" })));
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: TRUST_PAYMENTS_FORMATS.envelope,
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/version 1.00/);
    const jwt = analyze(
      JSON.stringify({ iat: 1, aud: "jwt.user", payload: envelope({}, { version: "9.99" }) }),
    );
    expect(jwt.records[0]).toMatchObject({
      status: "unsupported",
      format: TRUST_PAYMENTS_FORMATS.jwt,
    });
  });
});

describe("Trust Payments sensitive data", () => {
  const planted = {
    maskedpan: "411111######9999",
    pan: "4111111111111111",
    securitycode: "PPLsynthCVC",
    expirydate: "12/2031",
    sitereference: "test_PPLsynthSITE777",
    merchantnumber: "PPLsynthMERCHNUM",
    merchantname: "PPLsynth Planted Merchant",
    tid: "PPLsynthTID",
    operatorname: "planted.operator@example.com",
    billingfirstname: "PlantedFirst",
    billinglastname: "PlantedLast",
    billingemail: "planted.billing@example.com",
    billingpostcode: "PL4 NTD",
    customerip: "198.51.100.77",
    cavv: "PPLsynthPlantedCavv=",
    threedpayload: "PPLsynthPlantedPayload",
    acsurl: "https://acs.example/PPLsynthPlantedAcs",
    cachetoken: "PPLsynthPlantedCacheToken",
    acquirersecret: "PPLsynthPlantedAcquirerSecret",
    redirecturl: "https://apm.example/PPLsynthPlantedRedirect",
    issuer: "PPLsynth Planted Issuer Bank",
    updatereason: "Planted free text from PlantedFirst",
  };

  it("never copies sensitive response fields into events or reports", () => {
    const records = [
      {
        iat: 1792911800,
        aud: "jwt.user",
        payload: {
          ...envelope({ ...planted, errorcode: "70000", settlestatus: "3" }),
          jwt: "eyJhbGciOiJIUzI1NiJ9.PPLsynthPlantedJwt.PPLsynthPlantedSig",
        },
      },
    ];
    const r = analyzeRecords(records, options, [json]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.events).toHaveLength(1);
    const events = JSON.stringify(r.result.events);
    const errors = JSON.stringify(r.result.errors);
    const report = toJsonReport(r.result);
    for (const value of [...Object.values(planted), "PPLsynthPlantedJwt", "PPLsynthPlantedSig"]) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
  });

  it("never copies the notification hash or merchant identifiers", () => {
    const text = new URLSearchParams({
      notificationreference: "PPLsynth-A63000",
      errorcode: "0",
      settlestatus: "0",
      requesttypedescription: "AUTH",
      transactionreference: "PPLsynth-9-84000",
      sitereference: planted.sitereference,
      billingemail: planted.billingemail,
      customerip: planted.customerip,
      maskedpan: planted.maskedpan,
      responsesitesecurity: SIG,
    }).toString();
    const r = analyze(text);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of [
      SIG,
      planted.sitereference,
      planted.billingemail,
      planted.customerip,
      planted.maskedpan,
    ]) {
      expect(events, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
  });
});

describe("Trust Payments catalog and manifest", () => {
  it("covers every code on the official list exactly once", () => {
    const tables = [CLIENT_LIBRARY_CODES, GATEWAY_CODES, INVALID_PROCESS_CODES, PORTAL_CODES];
    const keys = tables.flatMap((t) => Object.keys(t));
    expect(new Set(keys).size).toBe(keys.length);
    // Plus errorcode 0 (success), which is not an error.
    expect(keys.length + 1).toBe(DOCUMENTED_CODE_COUNT);
    expect(Object.keys(CLIENT_LIBRARY_CODES)).toHaveLength(9);
    expect(Object.keys(PORTAL_CODES)).toHaveLength(59);
    expect(Object.keys(INVALID_PROCESS_CODES)).toHaveLength(21);
    expect(Object.keys(ADVICE_CODES)).toHaveLength(24);
    expect(Object.keys(SETTLE_STATUSES).sort()).toEqual(["0", "1", "10", "100", "2", "3"]);
  });

  it("never presents a retry as safe when the outcome is unknown", () => {
    for (const t of [CLIENT_LIBRARY_CODES, GATEWAY_CODES, INVALID_PROCESS_CODES, PORTAL_CODES]) {
      for (const [code, entry] of Object.entries(t)) {
        if (entry.effect === "uncertain")
          expect(entry.retry, code).not.toBe("safe_to_retry_technical_request");
        expect(["strong", "possible"], code).toContain(entry.confidence);
      }
    }
  });

  it("decodes codes with own-property lookup only", () => {
    expect(decodeTrustPaymentsCode("toString").confidence).toBe("insufficient");
    expect(decodeTrustPaymentsCode(" 60105 ")).toMatchObject({
      family: "invalid_process",
      confidence: "possible",
    });
    expect(decodeTrustPaymentsCode("21002")).toMatchObject({
      family: "portal",
      confidence: "possible",
    });
    expect(decodeTrustPaymentsCode("71000")).toMatchObject({
      family: "gateway",
      confidence: "strong",
    });
  });

  it("has an honest high-risk manifest", () => {
    const m = trustPaymentsManifest;
    expect(m).toMatchObject({
      id: "trust_payments",
      wave: "HR-1",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
    });
    expect(m.categories).toEqual(["gateway", "acquiring", "card_processing"]);
    expect(m.sectors).toHaveLength(11);
    for (const s of m.sectors)
      expect(s.source).toMatch(/^https:\/\/(www|help)\.trustpayments\.com\//);
    expect(m.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "supported",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "supported",
      diagnosticRules: "limited",
    });
    expect(m.delivery).toMatchObject({
      duplicateKey: "notificationreference",
      duplicatesDocumented: true,
      ordering: "not_documented",
    });
    expect(m.limitations.join(" ")).toMatch(/Chargebacks/);
    expect(trustPaymentsAdapter.manifest).toBe(m);
  });

  it("uses no en or em dash characters in sources or fixtures", () => {
    const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const dirs = [
      fileURLToPath(new URL("../src/", import.meta.url)),
      fileURLToPath(new URL("./", import.meta.url)),
      fixturePath("trust_payments/"),
    ];
    for (const dir of dirs) {
      for (const file of readdirSync(dir)) {
        const text = readFileSync(`${dir}${file}`, "utf8");
        expect(DASHES.test(text), file).toBe(false);
      }
    }
  });

  it("uses only PPLsynth identifiers in fixtures", () => {
    for (const file of readdirSync(fixturePath("trust_payments"))) {
      const text = fixture(`trust_payments/${file}`);
      for (const m of text.matchAll(
        /(?:transactionreference|notificationreference)"?[=:]\s*"?([^"&\s]+)/g,
      ))
        expect(m[1], file).toMatch(/PPLsynth/);
    }
  });
});
