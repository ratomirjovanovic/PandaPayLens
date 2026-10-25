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
  type RecordMeta,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  ccbillAdapter,
  ccbillManifest,
  CCBILL_ADAPTER_VERSION,
  DECLINE_CODES,
  decodeDeclineCode,
  decodeLegacyResult,
  decodeRestError,
  describeSubscriptionStatus,
  LEGACY_RESULT_CODES,
  REST_ERROR_CODES,
  REST_EXAMPLE_CODES,
  REST_VALIDATION_MESSAGES,
  SUBSCRIPTION_STATUSES,
  THREEDS_ERRORS,
  WEBHOOK_EVENT_TYPES,
} from "@pandapaylens/ccbill";

const options: AnalyzeOptions = {
  adapters: [ccbillAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturePath = (p: string) =>
  fileURLToPath(new URL(`../../../../fixtures/${p}`, import.meta.url));
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");
const cc = (name: string) => fixture(`ccbill/${name}`);

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const json = (o: unknown) => JSON.stringify(o);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const SUB = "PPLsynth0913024401000012340";

const renewalFailure = (fields: Record<string, string> = {}) =>
  form({
    transactionId: "PPLsynth0912191101000000400",
    subscriptionId: SUB,
    clientAccnum: "999999",
    clientSubacc: "9999",
    timestamp: "2026-09-22 04:00:09",
    failureReason: "Synthetic reason",
    failureCode: "24",
    nextRetryDate: "2026-09-25",
    renewalDate: "2026-09-22",
    cardType: "VISA",
    paymentType: "CREDIT",
    ...fields,
  });

const denialPost = (fields: Record<string, string> = {}) =>
  form({
    clientAccnum: "999999",
    clientSubacc: "0000",
    denialId: "PPLsynth1000000000000000099",
    reasonForDeclineCode: "24",
    reasonForDecline: "Denied by bank",
    formName: "211cc",
    typeId: "0000003761",
    initialPrice: "9.95",
    currencyCode: "840",
    ...fields,
  });

const restError = (o: Record<string, unknown>, status?: number) => {
  const body = json({
    id: "PPLsynth-err-0100",
    url: "/transactions/payment-tokens/PPLsynthTOKEN0000000000000000001",
    errors: [],
    timestamp: "2026-10-20T12:00:00.000Z",
    ...o,
  });
  return status === undefined
    ? body
    : `HTTP/1.1 ${status} Status\r\nContent-Type: application/vnd.com.cwie.error.v1+json\r\n\r\n${body}`;
};

// ---------------------------------------------------------------------------

describe("ccbill detection", () => {
  it.each([
    ["background-post-approval.txt", "ccbill.background_post", 0.9, true],
    ["background-post-denial.txt", "ccbill.background_post", 0.9, true],
    ["background-post-webverify-approval.txt", "ccbill.background_post", 0.85, true],
    ["rest-charge-approved.json", "ccbill.rest.charge", 0.75, true],
    ["rest-error-3ds.txt", "ccbill.rest.error", 0.98, true],
    ["rest-error-expired-token.txt", "ccbill.rest.error", 0.98, true],
    ["rest-error-server.txt", "ccbill.rest.error", 0.98, true],
    ["rest-error-validation.json", "ccbill.rest.error", 0.9, true],
    ["rest-payment-token.json", "ccbill.rest.payment_token", 0.8, false],
    ["webhook-cancellation.json", "ccbill.webhook", 0.75, true],
    ["webhook-chargeback.json", "ccbill.webhook", 0.85, true],
    ["webhook-expiration-http.txt", "ccbill.webhook", 0.8, true],
    ["webhook-expiration-with-query.txt", "ccbill.webhook", 0.8, true],
    ["webhook-expiration.json", "ccbill.webhook", 0.75, true],
    ["webhook-newsale-failure.txt", "ccbill.webhook", 0.95, true],
    ["webhook-newsale-success.txt", "ccbill.webhook", 0.95, true],
    ["webhook-refund-or-void.txt", "ccbill.webhook", 0.85, true],
    ["webhook-refund-with-query.txt", "ccbill.webhook", 0.9, true],
    ["webhook-renewal-failure.txt", "ccbill.webhook", 0.95, true],
    ["webhook-renewal-success.json", "ccbill.webhook", 0.95, true],
    ["webhook-upsale-success.json", "ccbill.webhook", 0.95, true],
  ])("detects %s", (name, format, confidence, supported) => {
    const parsed = parseInput(cc(name));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(ccbillAdapter.detect(parsed.value.records[0], parsed.value.meta[0])).toMatchObject({
      format,
      confidence,
      supported,
    });
  });

  it("covers every fixture", () => {
    expect(readdirSync(fixturePath("ccbill"))).toHaveLength(21);
  });

  it("does not claim generic shapes or provider names", () => {
    const d = (o: unknown, meta?: RecordMeta) => ccbillAdapter.detect(o, meta).confidence;
    const formMeta: RecordMeta = { format: "form" };
    expect(d({ status: "0" }, formMeta)).toBe(0);
    expect(d({ error: "x" })).toBe(0);
    expect(d({ error: { message: "CCBill error" } })).toBe(0);
    expect(d({ name: "CCBill", provider: "ccbill", message: "ccbill.com" })).toBe(0);
    expect(d({ approved: true })).toBe(0);
    expect(d({ approved: false, declineCode: 1, declineText: "x" })).toBe(0);
    expect(d({ generalMessage: "x", errorCode: 100102 })).toBe(0);
    expect(d({ generalMessage: "x", errorCode: "abc", id: "1" })).toBe(0);
    expect(d({ subscriptionId: "1", transactionId: "2", timestamp: "2026-01-01 00:00:00" })).toBe(
      0,
    );
    expect(d({ clientAccnum: "999999" }, formMeta)).toBe(0);
    expect(d({ clientAccnum: "999999", clientSubacc: { a: 1 } })).toBe(0);
    // A REST charge shape is never claimed when it arrived as form data.
    expect(
      d(
        { approved: "false", declineCode: "1", denialId: "1", declineText: "x", sessionId: "" },
        formMeta,
      ),
    ).toBe(0);
    expect(d("clientAccnum=1")).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
  });

  it("recognizes CCBill account fields without a supported family as unsupported", () => {
    const r = analyze(form({ clientAccnum: "999999", clientSubacc: "9999", note: "x" }));
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "ccbill.unrecognized" });
    expect(r.records[0]!.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.events).toEqual([]);
  });

  it("recognizes a REST payment token object but does not analyze it", () => {
    const r = analyze(cc("rest-payment-token.json"));
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "ccbill.rest.payment_token",
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/payment token object/);
    expect(r.events).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("PPLsynthTOKEN0123456789abcdef0");
  });

  it("returns confidence 0 for every Stripe and Adyen fixture, and for other providers", () => {
    let checked = 0;
    for (const dir of [
      "stripe",
      "adyen",
      "payabl",
      "checkout",
      "paypal",
      "braintree",
      "mollie",
      "square",
    ]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(ccbillAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(
              ccbillAdapter.detect(payload, meta).confidence,
              `${dir}/${file}[${i}].payload`,
            ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------

describe("ccbill webhook event type", () => {
  it("reads eventType from the query string of a pasted raw HTTP request", () => {
    const r = analyze(cc("webhook-expiration-http.txt"));
    expect(r.records[0]!.reasons).toContain("X-Allowed-Satellites header is present");
    expect(r.events[0]).toMatchObject({
      eventType: "Expiration",
      eventTypeKnown: true,
      stage: "subscription",
      paymentReference: SUB,
      subscriptionReference: SUB,
      eventTimestamp: "2026-10-24T03:22:44.000Z",
      eventTimeZoneAssumed: true,
    });
    expect(r.events[0]!.attributes).toMatchObject({
      timestampTimeZone: "not documented; read as UTC",
    });
  });

  it("treats the documented JSON body the same way", () => {
    const e = analyze(cc("webhook-expiration.json")).events[0]!;
    expect(e).toMatchObject({ eventType: "unidentified_webhook", stage: "other" });
    expect(e.attributes.candidateEventTypes).toEqual(["Expiration"]);
  });

  it("reads eventType when the query string was pasted with the body", () => {
    const r = analyze(cc("webhook-expiration-with-query.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "Expiration",
      eventTypeKnown: true,
      stage: "subscription",
      outcome: "success",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      eventTypeSource: "record_field",
      eventGroupType: "Subscription",
    });
    expect(r.findings).toEqual([]);
  });

  it("reads eventType from a pasted callback URL with only a query string", () => {
    const r = analyze(
      `https://merchant.example/webhooks.php?clientAccnum=999999&clientSubacc=9999&eventType=Cancellation&eventGroupType=Subscription&subscriptionId=${SUB}&timestamp=2026-09-23+11%3A30%3A00`,
    );
    expect(r.events[0]).toMatchObject({ eventType: "Cancellation", stage: "subscription" });
  });

  it("reads eventType from a request path that keeps its query string", () => {
    const meta: RecordMeta = {
      format: "http",
      http: {
        kind: "request",
        method: "POST",
        path: "/webhooks.php?clientAccnum=999999&clientSubacc=9999&eventType=Void&eventGroupType=Subscription",
        headers: {},
      },
    };
    const body = Object.fromEntries(new URLSearchParams(cc("webhook-refund-or-void.txt").trim()));
    const parsed = ccbillAdapter.parse(body, "ccbill.webhook", meta);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [e] = ccbillAdapter.normalize(parsed.value, {
      format: "ccbill.webhook",
      recordIndex: 0,
      meta,
    });
    expect(e).toMatchObject({
      eventType: "Void",
      eventTypeKnown: true,
      stage: "void",
      outcome: "success",
    });
    expect(e!.attributes.eventTypeSource).toBe("request_url");
  });

  it("keeps an explicit but undocumented event type unknown", () => {
    const r = analyze(`eventType=SomethingNew&${renewalFailure()}`);
    expect(r.events[0]).toMatchObject({
      eventType: "SomethingNew",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("matches event type names case-insensitively", () => {
    const r = analyze(`eventType=renewalfailure&${renewalFailure()}`);
    expect(r.events[0]).toMatchObject({ eventType: "RenewalFailure", eventTypeKnown: true });
  });

  it("does not guess between Refund, Void and Chargeback from the body", () => {
    const r = analyze(cc("webhook-refund-or-void.txt"));
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "unidentified_webhook",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      amountMinor: "995",
      currency: "USD",
    });
    expect(e.attributes.candidateEventTypes).toEqual(["Refund", "Void", "Chargeback"]);
    expect(String(e.attributes.eventTypeNote)).toMatch(/Refund and Void have identical fields/);
    expect(r.errors).toEqual([]);
  });

  it("adds Return to the candidates when card fields are absent", () => {
    const r = analyze(
      form({
        transactionId: "PPLsynth0912191101000000500",
        subscriptionId: SUB,
        clientAccnum: "999999",
        clientSubacc: "9999",
        timestamp: "2026-08-01 12:00:00",
        amount: "9.95",
        currencyCode: "840",
        paymentType: "CHECK",
        reason: "Synthetic return",
      }),
    );
    expect(r.events[0]!.attributes.candidateEventTypes).toEqual([
      "Refund",
      "Void",
      "Chargeback",
      "Return",
    ]);
  });

  it("maps an explicit Refund with the repeated account fields of the query string", () => {
    const r = analyze(cc("webhook-refund-with-query.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "Refund",
      stage: "refund",
      outcome: "success",
      amountMinor: "995",
      relatedReference: "PPLsynth0912191101000000159",
    });
    expect(r.events[0]!.attributes.repeatedKeysCollapsed).toBe(true);
  });

  it("maps Return and Void explicitly", () => {
    const base = cc("webhook-refund-or-void.txt").trim();
    expect(analyze(`eventType=Return&${base}`).events[0]).toMatchObject({
      stage: "refund",
      outcome: "success",
    });
    expect(analyze(`eventType=Void&${base}`).events[0]).toMatchObject({
      stage: "void",
      outcome: "success",
    });
  });

  it("keeps shared semantics for upgrade, upsale and cross-sale bodies", () => {
    const r = analyze(cc("webhook-upsale-success.json"));
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "unidentified_webhook",
      eventTypeKnown: false,
      stage: "payment",
      outcome: "success",
      isRecurring: false,
      amountMinor: "495",
    });
    expect(e.attributes).toMatchObject({
      candidateEventTypes: ["UpgradeSuccess", "UpSaleSuccess", "CrossSaleSuccess"],
      originalSubscriptionId: SUB,
      source: "API",
      scaResponseStatus: "Y",
    });
    const failed = analyze(
      form({
        transactionId: "PPLsynth0912191101000099002",
        clientAccnum: "999999",
        clientSubacc: "9999",
        timestamp: "2026-10-02 08:10:00",
        originalSubscriptionId: SUB,
        failureCode: "29",
        failureReason: "Card expired",
      }),
    );
    expect(failed.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      eventTypeKnown: false,
    });
    expect(failed.errors[0]!.code).toBe("29");
    expect(failed.errors[0]!.missingInformation.join(" ")).toMatch(/event type is not available/);
  });

  it.each([
    [{ endDate: "00000000", email: "x@example.invalid" }, "ManualAdd", "subscription"],
    [
      {
        price: "5.95 for 30 days (non-recurring).",
        transactionId: "PPLsynthT1",
        nextRenewalDate: "2026-11-01",
      },
      "UserReactivation",
      "subscription",
    ],
    [{ nextRenewalDate: "2026-11-05 15:18:17" }, "BillingDateChange", "subscription"],
    [
      { firstName: "PPLsynthFirst", paymentType: "CREDIT", cardType: "VISA" },
      "CustomerDataUpdate",
      "subscription",
    ],
  ] as const)("infers %j as %s", (extra, name, stage) => {
    const r = analyze(
      form({
        subscriptionId: SUB,
        clientAccnum: "999999",
        clientSubacc: "9999",
        timestamp: "2026-10-01 00:00:00",
        ...extra,
      }),
    );
    expect(r.events[0]).toMatchObject({
      eventType: name,
      eventTypeKnown: true,
      stage,
      outcome: "success",
    });
    expect(r.events[0]!.attributes.eventTypeSource).toBe("inferred_from_fields");
  });

  it("reports rebill bodies with renewalDate only as ambiguous", () => {
    const r = analyze(
      form({
        subscriptionId: SUB,
        transactionId: "PPLsynthT2",
        clientAccnum: "999999",
        clientSubacc: "9999",
        renewalDate: "2026-10-01",
      }),
    );
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "payment",
      outcome: "unknown",
      isRecurring: true,
    });
  });

  it("reports a field set that matches no event as unidentified", () => {
    const r = analyze(
      form({
        subscriptionId: SUB,
        transactionId: "PPLsynthT3",
        clientAccnum: "999999",
        clientSubacc: "9999",
      }),
    );
    expect(r.events[0]).toMatchObject({ eventType: "unidentified_webhook", stage: "other" });
    expect(r.events[0]!.attributes.candidateEventTypes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("ccbill webhook lifecycle", () => {
  it("normalizes a sale without copying consumer data", () => {
    const r = analyze(cc("webhook-newsale-success.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "NewSaleSuccess",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      isRecurring: false,
      paymentReference: SUB,
      relatedReference: "PPLsynth0912191101000000159",
      subscriptionReference: SUB,
      amountMinor: "995",
      currency: "USD",
      eventTimestamp: "2026-07-24T10:15:00.000Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      threeDSecure: "AUTH_SUCCESS",
      cardType: "VISA",
      cardSubType: "CREDIT",
      subscriptionTypeId: "0000003761",
      billedRecurringAmountMinor: "995",
      accountingAmountMinor: "995",
      accountingCurrency: "USD",
      dynamicPricingDigestPresent: true,
      passThroughFields: 1,
      signatureVerified: false,
    });
    expect(r.errors).toEqual([]);
    expect(r.sensitiveData.detected).toBe(true);
  });

  it("decodes a sale decline with possible confidence", () => {
    const r = analyze(cc("webhook-newsale-failure.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "NewSaleFailure",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth0912191101000000200",
    });
    expect(r.errors[0]).toMatchObject({
      code: "31",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "possible",
      providerMessage: "Insufficient funds",
      outcomeKnown: true,
      attemptReference: "PPLsynth0912191101000000200",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      field: "failureCode",
      decline_code: "31",
      table: "webhook_failure",
      eventType: "NewSaleFailure",
    });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("treats a rebill as a recurring payment", () => {
    const e = analyze(cc("webhook-renewal-success.json")).events[0]!;
    expect(e).toMatchObject({
      eventType: "RenewalSuccess",
      stage: "payment",
      outcome: "success",
      isRecurring: true,
      relatedReference: "PPLsynth0912191101000000301",
      amountMinor: "995",
      currency: "USD",
    });
    expect(e.attributes).toMatchObject({
      renewalDate: "2026-08-23",
      nextRenewalDate: "2026-09-22",
    });
  });

  it("decodes an undocumented rebill failure code honestly and keeps nextRetryDate", () => {
    const r = analyze(cc("webhook-renewal-failure.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "RenewalFailure",
      stage: "payment",
      outcome: "failure",
      isRecurring: true,
      providerStatus: "RenewalFailure; failureCode=BE-140",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      nextRetryDate: "2026-09-25",
      failureReason: "Invalid Input.",
    });
    const err = r.errors[0]!;
    expect(err).toMatchObject({
      code: "BE-140",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "Invalid Input.",
      paymentReference: SUB,
    });
    expect(err.subCodes.nextRetryDate).toBe("2026-09-25");
    expect(err.subCodes.decline_code).toBeUndefined();
    expect(err.retryExplanation).toMatch(/attempt billing again on 2026-09-25/);
    expect(err.nextAction).toMatch(/2026-09-25/);
    expect(err.missingInformation.join(" ")).toMatch(/not in any published CCBill table/);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE", "RECURRING_PAYMENT_FAILED"]);
  });

  it("shows both meanings of decline code 15", () => {
    const r = analyze(renewalFailure({ failureCode: "15", failureReason: "declined by bank" }));
    expect(r.errors[0]).toMatchObject({
      code: "15",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    const text = `${r.errors[0]!.explanation} ${r.errors[0]!.missingInformation.join(" ")}`;
    expect(text).toMatch(/still being processed/);
    expect(text).toMatch(/declined by bank/);
  });

  it("notes when a webhook code is outside Appendix B", () => {
    const r = analyze(renewalFailure({ failureCode: "52" }));
    expect(r.errors[0]).toMatchObject({
      code: "52",
      category: "duplicate_request",
      confidence: "possible",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/codes 1 to 45 only/);
  });

  it("does not decode code 20 (no decline) and handles a missing failureCode", () => {
    expect(analyze(renewalFailure({ failureCode: "20" })).errors).toEqual([]);
    const noCode = analyze(renewalFailure({ failureCode: "" }));
    expect(noCode.errors[0]).toMatchObject({ code: "not_provided", confidence: "insufficient" });
  });

  it("maps cancellation, chargeback and the time zone caveat", () => {
    const cancel = analyze(cc("webhook-cancellation.json")).events[0]!;
    expect(cancel).toMatchObject({
      eventType: "Cancellation",
      stage: "subscription",
      outcome: "success",
    });
    expect(cancel.attributes).toMatchObject({ reason: "Billed cancel.", source: "FORM" });
    const cb = analyze(cc("webhook-chargeback.json"));
    expect(cb.events[0]).toMatchObject({
      eventType: "Chargeback",
      stage: "dispute",
      outcome: "unknown",
      amountMinor: "995",
    });
    expect(ruleIds(cb)).toEqual(["CHARGEBACK_REPORTED"]);
  });

  it("normalizes the U+2010 hyphen used in documentation examples", () => {
    const r = analyze(
      json({
        subscriptionId: SUB,
        clientAccnum: "999999",
        clientSubacc: "9999",
        timestamp: "2026‐10‐01 08:00:00",
        reason: "Webmaster",
      }),
    );
    expect(r.events[0]!.eventTimestamp).toBe("2026-10-01T08:00:00.000Z");
    expect(r.events[0]!.attributes.providerTimestamp).toBe("2026-10-01 08:00:00");
  });

  it("flags an unreadable timestamp and a currency conflict", () => {
    const r = analyze(
      cc("webhook-refund-with-query.txt")
        .trim()
        .replace("timestamp=2026-08-01+12%3A00%3A00", "timestamp=yesterday")
        .replace("currency=USD", "currency=EUR"),
    );
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      timestampUnparsed: true,
      currencyConflict: true,
    });
    expect(r.events[0]!.currency).toBe("EUR");
  });

  it("does not invent a delivery key for repeated webhooks", () => {
    const text = cc("webhook-renewal-failure.txt");
    const r = analyzeMany(text, text);
    expect(r.events).toHaveLength(2);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(r.groups).toHaveLength(1);
    // No delivery id: identical copies are reported only as a possible repeat.
    expect(r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")).toMatchObject({
      confidence: "possible",
    });
  });

  it("reports parse issues for missing or conflicting fields instead of throwing", () => {
    const noAccount = analyze(renewalFailure({ clientAccnum: "" }));
    expect(noAccount.records[0]).toMatchObject({ status: "invalid", format: "ccbill.webhook" });
    expect(noAccount.records[0]!.reasons).toContain("clientAccnum: required");

    const noIds = analyze(renewalFailure({ subscriptionId: "", transactionId: "" }));
    expect(noIds.records[0]!.status).toBe("invalid");
    expect(noIds.records[0]!.reasons.join(" ")).toMatch(
      /subscriptionId or transactionId: required/,
    );

    const conflicting = analyze(`${renewalFailure()}&subscriptionId=PPLsynthOTHER`);
    expect(conflicting.records[0]!.status).toBe("invalid");
    expect(conflicting.records[0]!.reasons.join(" ")).toMatch(/repeated with different values/);

    const nested = ccbillAdapter.parse(
      { clientAccnum: "1", clientSubacc: "1", subscriptionId: { a: 1 } },
      "ccbill.webhook",
    );
    expect(nested.ok).toBe(false);
    const caseClash = ccbillAdapter.parse(
      { clientAccnum: "1", clientSubacc: "1", subscriptionId: "A", SUBSCRIPTIONID: "B" },
      "ccbill.webhook",
    );
    expect(caseClash.ok).toBe(false);
    const tooLong = ccbillAdapter.parse(
      { clientAccnum: "1", clientSubacc: "1", subscriptionId: "A", reason: "x".repeat(2001) },
      "ccbill.webhook",
    );
    expect(tooLong.ok).toBe(false);
  });

  it("fails cleanly on malformed input", () => {
    expect(analyzeText("clientAccnum=999999&clientSubacc", options).ok).toBe(false);
    expect(analyzeText('{"clientAccnum":"999999",', options).ok).toBe(false);
    expect(ccbillAdapter.parse("x", "ccbill.webhook").ok).toBe(false);
    expect(ccbillAdapter.parse({}, "ccbill.nope").ok).toBe(false);
    expect(ccbillAdapter.parse({ approved: "yes" }, "ccbill.rest.charge").ok).toBe(false);
    expect(ccbillAdapter.parse({ generalMessage: "x" }, "ccbill.rest.error").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("ccbill Background Post", () => {
  it("normalizes an approval", () => {
    const r = analyze(cc("background-post-approval.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "background_post.approval",
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth0913024401000055001",
      subscriptionReference: "PPLsynth0913024401000055001",
      deliveryKey: "approval|PPLsynth0913024401000055001",
      amountMinor: "1995",
      currency: "EUR",
      isRecurring: false,
    });
    expect(r.events[0]!.attributes).toMatchObject({
      clientDrivenSettlement: false,
      affiliateSystem: "CCBill",
      responseDigestPresent: true,
      recurringAmountMinor: "1995",
    });
    expect(r.errors).toEqual([]);
  });

  it("shows a merchant-driven settlement approval as an authorization", () => {
    const text = cc("background-post-approval.txt").replace(
      "clientDrivenSettlement=0",
      "clientDrivenSettlement=1",
    );
    expect(analyze(text).events[0]).toMatchObject({ stage: "authorization", outcome: "success" });
  });

  it("decodes a denial with the documented decline table", () => {
    const r = analyze(cc("background-post-denial.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "background_post.denial",
      outcome: "failure",
      paymentReference: "PPLsynth1000000000000000042",
      deliveryKey: "denial|PPLsynth1000000000000000042",
    });
    expect(r.errors[0]).toMatchObject({
      code: "31",
      category: "insufficient_funds",
      confidence: "strong",
      attemptReference: "PPLsynth1000000000000000042",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      field: "reasonForDeclineCode",
      table: "decline",
      decline_code: "31",
    });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("presents a Web Verify override as an approval with a historical soft decline", () => {
    const r = analyze(cc("background-post-webverify-approval.txt"));
    expect(r.events[0]).toMatchObject({ outcome: "success" });
    expect(r.events[0]!.attributes).toMatchObject({
      softDeclineOverridden: true,
      declineCodeBeforeOverride: "45",
    });
    expect(String(r.events[0]!.attributes.declineBeforeOverrideMeaning)).toMatch(/Web Verify/);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("decodes a technical decline without claiming the outcome is unknown", () => {
    const r = analyze(
      denialPost({ reasonForDeclineCode: "22", reasonForDecline: "Error contacting bank" }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("keeps decline code 15 at possible confidence", () => {
    const r = analyze(denialPost({ reasonForDeclineCode: "15" }));
    expect(r.errors[0]).toMatchObject({ code: "15", confidence: "possible" });
  });

  it("reports repeated Background Posts as documented duplicate deliveries", () => {
    const text = cc("background-post-denial.txt");
    const r = analyzeMany(text, text);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).toMatch(
      /documents that it can deliver the same notification more than once/,
    );
  });

  it("requires subscription_id or a denial field", () => {
    const r = analyze(
      form({
        clientAccnum: "999999",
        clientSubacc: "0000",
        typeId: "0000003761",
        initialPrice: "1.00",
      }),
    );
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "ccbill.background_post" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/subscription_id/);
  });

  it("handles a denial without a code", () => {
    const r = analyze(denialPost({ reasonForDeclineCode: "" }));
    expect(r.errors[0]).toMatchObject({ code: "not_provided", confidence: "insufficient" });
  });
});

// ---------------------------------------------------------------------------

describe("ccbill REST responses", () => {
  it("normalizes an approved v2 charge without exposing tokens", () => {
    const r = analyze(cc("rest-charge-approved.json"));
    expect(r.events[0]).toMatchObject({
      eventType: "charge_response",
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth0121000000000000777",
      subscriptionReference: "PPLsynth0121000000000000777",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      approved: true,
      apiVersion: "v2",
      newPaymentTokenIssued: true,
    });
    const out = JSON.stringify(r.events);
    expect(out).not.toContain("PPLsynthTOKEN");
    expect(out).not.toContain("PPLsynthPUID");
  });

  it("decodes a v1 decline and flags ids that lost precision", () => {
    // Shape of the documented "Failed Transaction" example (v1 media type).
    const text = `HTTP/1.1 200 OK\r\nContent-Type: application/vnd.mcn.transaction-service.api.v.1+json\r\n\r\n{"declineCode":27,"declineText":"System Error, Please Try Again","denialId":925013101000000100,"approved":false,"paymentUniqueId":null,"sessionId":null,"newPaymentTokenId":null,"subscriptionId":null}`;
    const r = analyze(text);
    expect(r.records[0]!.confidence).toBe(0.95);
    const e = r.events[0]!;
    expect(e).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(e.paymentReference).toBeUndefined();
    expect(e.attributes).toMatchObject({
      apiVersion: "v1",
      denialIdPrecisionLost: true,
      httpStatus: 200,
      declineCode: "27",
    });
    expect(r.errors[0]).toMatchObject({
      code: "27",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
      providerMessage: "System Error, Please Try Again",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/larger than 2\^53/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /does not state that declineCode uses/,
    );
    expect(ruleIds(r)).toEqual(["MISSING_REFERENCE", "PAYMENT_FAILURE"]);
  });

  it("keeps safe numeric and string ids from v1 and v2", () => {
    const v1 = analyze(
      json({
        declineCode: null,
        declineText: null,
        denialId: null,
        approved: true,
        paymentUniqueId: null,
        sessionId: null,
        newPaymentTokenId: null,
        subscriptionId: 12345,
      }),
    );
    expect(v1.events[0]).toMatchObject({ subscriptionReference: "12345" });
    expect(v1.events[0]!.attributes.apiVersion).toBe("v1");
    const unsafe = analyze(
      json({
        declineCode: 24,
        declineText: "Denied",
        denialId: "PPLsynthD1",
        approved: false,
        paymentUniqueId: null,
        subscriptionId: 925014201000000206,
      }),
    );
    expect(unsafe.events[0]).toMatchObject({ paymentReference: "PPLsynthD1" });
    expect(unsafe.events[0]!.attributes.subscriptionIdPrecisionLost).toBe(true);
    expect(unsafe.errors[0]!.attemptReference).toBe("PPLsynthD1");
    const noCode = analyze(
      json({
        declineCode: null,
        declineText: null,
        denialId: "PPLsynthD2",
        approved: false,
        paymentUniqueId: null,
      }),
    );
    expect(noCode.errors[0]).toMatchObject({ code: "not_provided" });
    const undetermined = analyze(
      json({
        declineCode: 20,
        declineText: null,
        denialId: null,
        approved: false,
        paymentUniqueId: null,
      }),
    );
    expect(undetermined.events[0]!.attributes.apiVersion).toBe("undetermined");
    expect(undetermined.errors).toEqual([]);
  });

  it("decodes an expired token error by HTTP status and hides the token path", () => {
    const r = analyze(cc("rest-error-expired-token.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "rest_error",
      stage: "error",
      outcome: "failure",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      endpoint: "/transactions/payment-tokens/{id}",
      errorId: "PPLsynth-err-757bb1a4",
      httpStatus: 400,
    });
    expect(r.errors[0]).toMatchObject({
      code: "100102",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      http_status: "400",
      table: "rest_error",
      errorId: "PPLsynth-err-757bb1a4",
    });
    expect(JSON.stringify(r)).not.toContain("PPLsynthTOKEN00112233445566778");
  });

  it("decodes a validation error without the HTTP status from generalMessage", () => {
    const r = analyze(cc("rest-error-validation.json"));
    expect(r.errors[0]).toMatchObject({
      code: "200000",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "possible",
    });
    expect(r.errors[0]!.subCodes.fields).toBe("clientSubacc,customerInfo.email");
    expect(r.errors[0]!.explanation).toMatch(/Invalid client subaccount/);
    const withStatus = analyze(
      restError(
        {
          generalMessage: "Validation failed!",
          errorCode: 200000,
          errors: [{ field: "clientAccnum", message: "Invalid client account" }],
        },
        400,
      ),
    );
    expect(withStatus.errors[0]).toMatchObject({ confidence: "strong", retry: "do_not_retry" });
  });

  it("decodes 200000 at HTTP 500 as the 3DS unknown error", () => {
    const r = analyze(
      restError({ generalMessage: "Authorization failed", errorCode: 200000 }, 500),
    );
    expect(r.events[0]!.eventType).toBe("threeds_error");
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      retry: "retry_conditionally",
      confidence: "strong",
    });
  });

  it("decodes authentication failures (3DS and forbidden)", () => {
    const r = analyze(cc("rest-error-3ds.txt"));
    expect(r.events[0]).toMatchObject({ eventType: "threeds_error", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "200500",
      category: "authentication_failed",
      confidence: "strong",
    });
    const forbidden = analyze(restError({ generalMessage: "Forbidden", errorCode: 100020 }, 403));
    expect(forbidden.errors[0]).toMatchObject({
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("does not present a server error as safe to retry", () => {
    const r = analyze(cc("rest-error-server.txt"));
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "100105",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/Verify the transaction's final state first/);
    expect(ruleIds(r)).toEqual(["POSSIBLE_RETRY_RISK"]);
  });

  it("lists both meanings of a reused code when the HTTP status is missing", () => {
    const r = analyze(restError({ generalMessage: "Something", errorCode: 100105 }));
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(r.errors[0]!.explanation).toMatch(/Invalid payout type/);
    expect(r.errors[0]!.explanation).toMatch(/create a payment token/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP status is not in the record/);
  });

  it("uses generalMessage for the generic 100100 example and merges agreeing meanings", () => {
    const d = decodeRestError("100100", undefined, "An error occurred, please try again later.");
    expect(d).toMatchObject({ family: "rest_example", confidence: "possible", status: 500 });
    const nf = decodeRestError("130000");
    expect(nf.entry).toMatchObject({ category: "invalid_request", retry: "do_not_retry" });
    expect(nf.entry.meaning).toMatch(/Not Found.*Method Not Allowed/);
    expect(decodeRestError("100106", 418).entry.category).toBe("unknown");
    expect(decodeRestError("100110", 400)).toMatchObject({ confidence: "possible", status: 500 });
    expect(decodeRestError("100015", 406)).toMatchObject({
      family: "rest_example",
      confidence: "possible",
    });
  });

  it("reports unknown error codes with insufficient confidence", () => {
    const r = analyze(restError({ generalMessage: "Brand new", errorCode: 424242 }, 500));
    expect(r.errors[0]).toMatchObject({
      code: "424242",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const noId = analyze(json({ url: "/x", generalMessage: "Brand new", errorCode: 1 }));
    expect(noId.errors[0]!.missingInformation.join(" ")).toMatch(/error id/);
  });
});

// ---------------------------------------------------------------------------

describe("ccbill catalogs and decoding", () => {
  it("has the documented number of entries", () => {
    expect(Object.keys(DECLINE_CODES)).toHaveLength(64);
    for (let i = 1; i <= 64; i++) expect(DECLINE_CODES[String(i)], String(i)).toBeDefined();
    // 22 keyed rows, of which 400/200000 stands for 26 validation messages: 47 rows.
    expect(Object.keys(REST_ERROR_CODES)).toHaveLength(22);
    expect(REST_VALIDATION_MESSAGES).toHaveLength(26);
    expect(Object.keys(REST_ERROR_CODES).length - 1 + REST_VALIDATION_MESSAGES.length).toBe(47);
    const numeric = new Set(
      Object.values(REST_ERROR_CODES)
        .map((r) => r.code)
        .filter((c) => /^\d+$/.test(c)),
    );
    expect(numeric.size).toBe(16);
    expect(Object.keys(REST_EXAMPLE_CODES)).toHaveLength(5);
    expect(Object.keys(THREEDS_ERRORS)).toHaveLength(14);
    expect(Object.keys(LEGACY_RESULT_CODES)).toHaveLength(18);
    expect(Object.keys(SUBSCRIPTION_STATUSES)).toHaveLength(3);
    expect(Object.keys(WEBHOOK_EVENT_TYPES)).toHaveLength(20);
  });

  it("maps subscription events to the documented stages", () => {
    expect(WEBHOOK_EVENT_TYPES.RenewalSuccess).toMatchObject({
      stage: "payment",
      isRecurring: true,
    });
    expect(WEBHOOK_EVENT_TYPES.RenewalFailure).toMatchObject({
      stage: "payment",
      outcome: "failure",
      isRecurring: true,
    });
    expect(WEBHOOK_EVENT_TYPES.Cancellation.stage).toBe("subscription");
    expect(WEBHOOK_EVENT_TYPES.Expiration.stage).toBe("subscription");
    expect(WEBHOOK_EVENT_TYPES.Chargeback.stage).toBe("dispute");
    expect(WEBHOOK_EVENT_TYPES.Refund.stage).toBe("refund");
    expect(WEBHOOK_EVENT_TYPES.Return.stage).toBe("refund");
    expect(WEBHOOK_EVENT_TYPES.Void.stage).toBe("void");
  });

  it.each([
    ["31", "background_post", "insufficient_funds", "customer_action_required", "strong"],
    ["031", "background_post", "insufficient_funds", "customer_action_required", "strong"],
    ["49", "background_post", "authentication_failed", "customer_action_required", "strong"],
    ["45", "rest", "fraud_or_risk", "customer_action_required", "possible"],
    ["27", "rest", "provider_unavailable", "retry_conditionally", "possible"],
    ["99", "rest", "unknown", "unknown", "insufficient"],
    ["BE-140", "webhook", "unknown", "unknown", "insufficient"],
    ["BE-140", "rest", "unknown", "unknown", "insufficient"],
  ] as const)("decodes decline code %s (%s)", (code, source, category, retry, confidence) => {
    const d = decodeDeclineCode(code, source);
    expect(d.entry.category).toBe(category);
    expect(d.entry.retry).toBe(retry);
    expect(d.confidence).toBe(confidence);
  });

  it("links Web Verify documentation for code 45", () => {
    expect(decodeDeclineCode("45", "background_post").documentation.map((x) => x.url)).toContain(
      "https://ccbill.com/doc/web-verify",
    );
  });

  it("decodes legacy result codes and subscription statuses", () => {
    expect(decodeLegacyResult("-7")).toMatchObject({ family: "legacy", confidence: "strong" });
    expect(decodeLegacyResult("-7").entry).toMatchObject({
      retry: "retry_conditionally",
      outcomeUncertain: true,
    });
    expect(decodeLegacyResult("-1").entry.category).toBe("configuration");
    expect(decodeLegacyResult("-99")).toMatchObject({ family: null, confidence: "insufficient" });
    expect(describeSubscriptionStatus("1")).toMatch(/cancelled/);
    expect(describeSubscriptionStatus("7")).toBeUndefined();
  });

  it("never resolves codes through the object prototype", () => {
    expect(decodeDeclineCode("constructor", "background_post").confidence).toBe("insufficient");
    expect(decodeRestError("toString").family).toBeNull();
    expect(decodeLegacyResult("__proto__").family).toBeNull();
    expect(describeSubscriptionStatus("constructor")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("ccbill correlation and timeline", () => {
  it("groups the lifecycle of one subscription in time order", () => {
    const r = analyzeMany(
      cc("webhook-chargeback.json"),
      cc("webhook-renewal-failure.txt"),
      cc("webhook-newsale-success.txt"),
      cc("webhook-renewal-success.json"),
      cc("webhook-cancellation.json"),
      cc("webhook-expiration-with-query.txt"),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toContain(SUB);
    expect(r.events.map((e) => e.eventType)).toEqual([
      "NewSaleSuccess",
      "RenewalSuccess",
      "RenewalFailure",
      "Cancellation",
      "Chargeback",
      "Expiration",
    ]);
    const rebill = r.findings.find((f) => f.ruleId === "RECURRING_PAYMENT_FAILED");
    expect(rebill?.title).toBe("Rebill declined after earlier successful payments");
    expect(r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED")?.title).toBe(
      "Chargeback after a successful payment",
    );
    expect(ruleIds(r)).toContain("OUT_OF_ORDER_ARRIVAL");
  });

  it("links an upsale to its original subscription", () => {
    const r = analyzeMany(cc("webhook-newsale-success.txt"), cc("webhook-upsale-success.json"));
    expect(r.groups).toHaveLength(1);
    const keys = ccbillAdapter.correlationKeys(r.events[1]!);
    expect(keys).toContain(SUB);
    expect(keys).toContain("PPLsynth0913024401000099001");
  });

  it("keeps unrelated subscriptions and attempts apart", () => {
    const r = analyzeMany(
      cc("webhook-newsale-success.txt"),
      cc("webhook-newsale-failure.txt"),
      cc("background-post-approval.txt"),
      cc("background-post-denial.txt"),
      cc("rest-charge-approved.json"),
      renewalFailure({
        subscriptionId: "PPLsynth0913024401000077777",
        transactionId: "PPLsynth0912191101000077777",
      }),
    );
    expect(r.groups).toHaveLength(6);
  });

  it("does not group REST errors with payments", () => {
    const r = analyzeMany(cc("rest-error-expired-token.txt"), cc("rest-error-server.txt"));
    expect(r.groups).toHaveLength(2);
    expect(r.events.every((e) => ccbillAdapter.correlationKeys(e).length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("ccbill redaction", () => {
  const planted = [
    "PPLsynthFirst",
    "PPLsynthLast",
    "Planted Street",
    "Planted City",
    "planted.buyer@example.invalid",
    "planted.bp@example.invalid",
    "5550100199",
    "203.0.113.77",
    "198.51.100.23",
    "plantedUser",
    "plantedBpUser",
    "PlantedPass!234",
    "PlantedBpPass!",
    "411111",
    "0130",
    "PPLsynthb1946ac92492d2347c6235b4d26",
    "0f1e2d3c4b5a69788796a5b4c3d2e1f0",
    "9a8b7c6d5e4f30211203f4e5d6c7b8a9",
    "PPLsynth-cus-planted",
    "PPLsynthRES0001",
    "referrer.example",
    "PPLsynthPUID",
    "PPLsynthTOKEN",
  ];

  it("keeps consumer, card, credential and digest data out of events, errors and reports", () => {
    const r = analyzeMany(
      cc("webhook-newsale-success.txt"),
      cc("webhook-renewal-success.json"),
      cc("webhook-chargeback.json"),
      cc("background-post-approval.txt"),
      cc("background-post-denial.txt"),
      cc("rest-charge-approved.json"),
      cc("rest-error-expired-token.txt"),
    );
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    expect(events).not.toContain("password");
    expect(r.sensitiveData.detected).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("ccbill manifest", () => {
  it("is honest about limited capabilities", () => {
    expect(ccbillManifest).toMatchObject({
      id: "ccbill",
      version: CCBILL_ADAPTER_VERSION,
      wave: "HR-1",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
    });
    expect(ccbillManifest.categories).toEqual([
      "payment_facilitator",
      "card_processing",
      "gateway",
      "merchant_account_intermediary",
    ]);
    expect(Object.values(ccbillManifest.capabilities).every((c) => c === "limited")).toBe(true);
    expect(ccbillManifest.delivery).toMatchObject({
      ordering: "not_documented",
      duplicatesDocumented: true,
    });
    expect(ccbillAdapter.manifest).toBe(ccbillManifest);
  });

  it("lists exactly the documented sectors with first-party sources and no gambling", () => {
    expect(ccbillManifest.sectors.map((s) => s.sector)).toEqual([
      "adult",
      "dating",
      "live cams",
      "content creator platforms",
      "streaming media",
      "subscription",
      "ecommerce (digital or physical goods)",
      "billing and invoicing (business services)",
      "CBD",
      "high-risk businesses generally",
    ]);
    for (const s of ccbillManifest.sectors) expect(s.source).toMatch(/^https:\/\/ccbill\.com\//);
    expect(JSON.stringify(ccbillManifest.sectors)).not.toMatch(/gaming|gambl|casino|betting/i);
  });

  it("uses no em or en dash characters in sources, fixtures and the manifest", () => {
    const dashes = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    const files = [
      ...["index.ts", "catalog.ts", "manifest.ts"].map((f) =>
        fileURLToPath(new URL(`../src/${f}`, import.meta.url)),
      ),
      fileURLToPath(import.meta.url),
      ...readdirSync(fixturePath("ccbill")).map((f) => fixturePath(`ccbill/${f}`)),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const d of dashes) expect(text.includes(d), file).toBe(false);
    }
    const text = JSON.stringify(ccbillManifest);
    for (const d of dashes) expect(text).not.toContain(d);
  });
});
