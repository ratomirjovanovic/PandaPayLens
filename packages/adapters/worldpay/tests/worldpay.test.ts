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
  ADVICE_CODES,
  AMEX_RAW_CODES,
  CARD_PAYMENTS_LAST_EVENTS,
  ERROR_NAMES,
  OUTCOMES,
  QUERY_EVENT_NAMES,
  RAW_SCHEME_CODES,
  REFUSAL_CODES,
  TEST_ONLY_REFUSAL_CODES,
  WEBHOOK_EVENT_TYPES,
  WORLDPAY_ADAPTER_VERSION,
  rawReading,
  worldpayAdapter,
  worldpayManifest,
} from "@pandapaylens/worldpay";
import defaultExport from "@pandapaylens/worldpay";
import { worldpayManifest as manifestOnly } from "@pandapaylens/worldpay/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [worldpayAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`worldpay/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;

const PAY = "payPPLsynthTestPayment01";
const CMD = "cmdPPLsynthTestCommand01";

const refused = (fields: Record<string, unknown> = {}) => ({
  outcome: "refused",
  paymentId: PAY,
  commandId: CMD,
  transactionReference: "PPLsynth-txn-test",
  refusalDescription: "Synthetic description",
  ...fields,
});

const webhook = (details: Record<string, unknown>, top: Record<string, unknown> = {}) => ({
  eventId: "PPLsynth-evt-test",
  eventTimestamp: "2026-10-24T10:00:00.000",
  eventDetails: {
    classification: "payment",
    transactionReference: "PPLsynth-txn-test",
    type: "authorized",
    amount: { value: 1000, currencyCode: "EUR" },
    _links: { payment: { href: "" } },
    ...details,
  },
  ...top,
});

const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");

describe("worldpay detection", () => {
  it.each([
    [webhook({ paymentId: PAY, commandId: CMD }), "worldpay.event", 0.9],
    [webhook({ classification: "payout", type: "disbursed" }), "worldpay.event", 0.9],
    [refused({ refusalCode: "5" }), "worldpay.payment_response", 0.9],
    [{ outcome: "authorized", paymentId: PAY, commandId: CMD }, "worldpay.payment_response", 0.7],
    [
      { outcome: "refused", refusalCode: "5", refusalDescription: "x" },
      "worldpay.payment_response",
      0.5,
    ],
    [{ errorName: "accessDenied", message: "x" }, "worldpay.error", 0.8],
    [{ errorName: "somethingNew", message: "x" }, "worldpay.error", 0.55],
    [
      {
        paymentId: PAY,
        lastEvent: "authorizationSucceeded",
        events: [
          {
            eventName: "authorizationSucceeded",
            timestamp: "2026-10-24T10:00:00Z",
            commandId: CMD,
          },
        ],
      },
      "worldpay.payment_query",
      0.98,
    ],
    [{ lastEvent: "authorizationSucceeded", paymentId: PAY }, "worldpay.payment_query", 0.55],
    [
      { lastEvent: "Sent for Settlement", _links: { "cardPayments:settle": { href: "x" } } },
      "worldpay.card_payments_events_query",
      0.75,
    ],
  ])("detects %j", (input, format, confidence) => {
    expect(worldpayAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("recognizes the tokenCreated envelope", () => {
    const r = worldpayAdapter.detect(JSON.parse(fixture("worldpay/token-created.json")));
    expect(r).toMatchObject({ format: "worldpay.event", supported: true });
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("uses the Event-Signature header only as supporting evidence", () => {
    const meta: RecordMeta = {
      format: "http",
      http: { kind: "request", method: "POST", headers: { "event-signature": "[redacted]" } },
    };
    const r = worldpayAdapter.detect(webhook({}), meta);
    expect(r.reasons).toContain("has an Event-Signature header");
    expect(worldpayAdapter.detect({ eventDetails: {} }, meta).confidence).toBeLessThan(0.5);
  });

  it.each([
    { errorName: "x" },
    { error: { message: "x" } },
    { status: "refused" },
    { outcome: "authorized" },
    { outcome: "authorized", paymentId: PAY },
    { outcome: { type: "authorized" } },
    { lastEvent: "Authorized" },
    { lastEvent: "authorizationSucceeded" },
    { eventId: "x", eventTimestamp: "y", eventDetails: {} },
    { events: [{ eventName: "something" }] },
    { paymentId: PAY, transactionReference: "PPLsynth-x" },
    { refusalCode: "5", refusalDescription: "x" },
  ])("does not claim the generic shape %j above 0.5", (input) => {
    expect(worldpayAdapter.detect(input).confidence).toBeLessThanOrEqual(0.5);
  });

  it("ignores Stripe objects and form data", () => {
    expect(worldpayAdapter.detect({ object: "event", ...webhook({}) }).confidence).toBe(0);
    expect(worldpayAdapter.detect({ outcome: "refused" }, { format: "form" }).confidence).toBe(0);
    expect(worldpayAdapter.detect([webhook({})]).confidence).toBe(0);
    expect(worldpayAdapter.detect("refused").confidence).toBe(0);
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "worldpay" &&
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
          worldpayAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("analyzes every Worldpay fixture", () => {
    const dir = `${root}worldpay`;
    for (const file of readdirSync(dir)) {
      const text = readFileSync(`${dir}/${file}`, "utf8");
      const r = analyze(text);
      for (const rec of r.records)
        expect(rec.status, `${file} record ${rec.recordIndex}`).toBe("analyzed");
      expect(text, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});

describe("worldpay parsing", () => {
  it("reports missing required webhook fields as parse issues without throwing", () => {
    const noType = webhook({});
    delete (noType.eventDetails as Record<string, unknown>).type;
    const r = analyze(json(noType));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "worldpay.event" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/eventDetails\.type/);
    expect(r.events).toEqual([]);

    const { eventId: _id, ...noId } = webhook({});
    const r2 = analyze(json(noId));
    expect(r2.records[0]!.status).toBe("invalid");
    expect(r2.records[0]!.reasons.join(" ")).toMatch(/eventId/);
  });

  it("reports malformed fields as parse issues", () => {
    const r = analyze(json(refused({ refusalCode: "5", riskFactors: "notChecked" })));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "worldpay.payment_response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/riskFactors/);
    const q = analyze(
      json({
        lastEvent: "authorizationRefused",
        events: [{ eventName: "authorizationRefused", timestamp: 5 }],
      }),
    );
    expect(q.records[0]).toMatchObject({ status: "invalid", format: "worldpay.payment_query" });
  });

  it("returns issues for an unknown format instead of throwing", () => {
    expect(worldpayAdapter.parse({}, "worldpay.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported Worldpay format "worldpay.unknown".'],
    });
  });

  it("does not analyze XML (WPG, cnpAPI) or malformed JSON", () => {
    const xml = analyzeText(
      '<?xml version="1.0"?><paymentService version="1.4" merchantCode="PPLSYNTH"><reply/></paymentService>',
      options,
    );
    expect(xml.ok).toBe(false);
    if (!xml.ok) expect(xml.error.code).toBe("UNSUPPORTED_FORMAT");
    const bad = analyzeText('{"eventId": "PPLsynth-evt", "eventDetails": {', options);
    expect(bad.ok).toBe(false);
  });

  it("accepts JSON with trailing commas, with a warning", () => {
    const r = analyze(`{"errorName": "accessDenied", "message": "Access denied",}`);
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
  });
});

describe("worldpay payment responses", () => {
  it("normalizes an authorized Payments API response", () => {
    const r = analyzeFixture("authorized-payments-api.json");
    expect(r.errors).toEqual([]);
    expect(r.events[0]).toMatchObject({
      sourceFormat: "worldpay.payment_response",
      eventType: "payment_response.authorized",
      eventTypeKnown: true,
      stage: "authorization",
      outcome: "success",
      paymentReference: "payPPLsynthAuthorized04",
      relatedReference: "cmdPPLsynthAuthorized04",
      merchantReference: "PPLsynth-txn-0004",
      attributes: {
        apiFamily: "payments",
        fraudOutcome: "lowRisk",
        threeDSOutcome: "authenticated",
        threeDSIssuerResponse: "frictionless",
        cardBrand: "mastercard",
        issuerAuthorizationCodePresent: true,
        availableActions: ["settlePayment", "cancelPayment"],
      },
    });
    const dump = json(r.events);
    expect(dump).not.toMatch(/PPL004|PPLSYNTHSCHEMEREF04|PPLsynthLinkData0004/);
  });

  it("decodes a refusal with Mastercard advice as Worldpay's retry guidance", () => {
    const r = analyzeFixture("refused-payments-api.json");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "51",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "payPPLsynthRefused00002",
      attemptReference: "cmdPPLsynthRefused00002",
      subCodes: { code_table: "worldpay", advice_code: "24" },
      providerMessage: "Limit exceeded",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Retry after 1 hour/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("uses gatewayRefusalCode as the Worldpay code when raw codes are enabled (v7)", () => {
    const r = analyzeFixture("refused-card-payments-v7-raw-code.json");
    expect(r.events[0]!.attributes).toMatchObject({
      apiFamily: "card_payments_v7",
      refusalCode: "05",
      gatewayRefusalCode: "5",
      links: ["cardPayments:events"],
    });
    expect(r.errors[0]).toMatchObject({
      code: "5",
      category: "card_declined",
      confidence: "strong",
      subCodes: { code_table: "worldpay", gateway_refusal_code: "5", raw_code: "05" },
    });
    expect(r.errors[0]!.explanation).toMatch(/raw scheme code is 05 \(Visa: Do not honor/);
  });

  it("reads Card Payments v6 names as aliases", () => {
    const e = firstError({
      outcome: "refused",
      paymentId: PAY,
      commandId: CMD,
      code: "5",
      description: "REFUSED",
      rawCode: "05",
      refusalAdvice: { code: "03" },
    });
    expect(e).toMatchObject({
      code: "5",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { raw_code: "05", advice_code: "03" },
      providerMessage: "REFUSED",
    });
    expect(e.documentation.map((d) => d.title)).toContain("Card Payments v7 migration guide");
  });

  it.each([
    ["5", "worldpay", "card_declined", "strong"],
    ["51", "worldpay", "insufficient_funds", "strong"],
    ["55", "worldpay", "card_declined", "possible"],
    ["63", "worldpay", "unknown", "possible"],
    ["106", "worldpay", "card_declined", "possible"],
    ["05", "raw_scheme", "card_declined", "strong"],
    ["N7", "raw_scheme", "card_declined", "strong"],
    ["N3", "raw_scheme", "payment_method_unavailable", "possible"],
    ["100", "raw_scheme", "card_declined", "possible"],
    ["17", "worldpay_test", "unknown", "possible"],
  ])("decodes a lone refusalCode %s honestly", (code, table, category, confidence) => {
    const e = firstError(refused({ refusalCode: code }));
    expect(e).toMatchObject({ code, category, confidence, subCodes: { code_table: table } });
  });

  it("shows both readings when the Worldpay and raw tables disagree", () => {
    const e = firstError(refused({ refusalCode: "55" }));
    expect(e.explanation).toMatch(/would instead mean: Visa: PIN incorrect or missing/);
    expect(e.missingInformation.join(" ")).toMatch(/merchant's configuration/);
    expect(e.documentation.map((d) => d.title)).toContain("Worldpay raw scheme response codes");
  });

  it("keeps an undocumented refusal code honest", () => {
    const e = firstError(refused({ refusalCode: "8888" }));
    expect(e).toMatchObject({
      code: "8888",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      subCodes: { code_table: "unknown" },
    });
    expect(e.missingInformation.join(" ")).toMatch(/not documented/);
    const none = firstError(refused());
    expect(none).toMatchObject({ code: "refused", confidence: "insufficient" });
  });

  it("flags an undocumented advice code", () => {
    const e = firstError(refused({ refusalCode: "5", advice: { code: 99 } }));
    expect(e.subCodes.advice_code).toBe("99");
    expect(e.missingInformation.join(" ")).toMatch(/advice code "99" is not documented/);
  });

  it("notes the 3DS retry for a rejected exemption with code 65", () => {
    const e = firstError(
      refused({ refusalCode: "65", exemption: { result: "rejected", reason: "issuerRejected" } }),
    );
    expect(e).toMatchObject({
      category: "authentication_required",
      subCodes: { exemption_reason: "issuerRejected" },
    });
    expect(e.retryExplanation).toMatch(/retried with 3DS/);
  });

  it("decodes fraudHighRisk and 3DS failures", () => {
    const r = analyzeFixture("fraud-high-risk.json");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "fraudHighRisk",
      category: "fraud_or_risk",
      retry: "manual_review",
      subCodes: { fraud_score: "98.5", fraud_reasons: "PPLsynthReasonVelocity" },
    });
    const e = firstError({ outcome: "3dsAuthenticationFailed", paymentId: PAY, commandId: CMD });
    expect(e).toMatchObject({
      category: "authentication_failed",
      retry: "customer_action_required",
    });
  });

  it.each([
    ["3dsDeviceDataRequired", "authentication", "pending"],
    ["3dsChallenged", "authentication", "pending"],
    ["3dsUnavailable", "authentication", "unknown"],
    ["sentForSettlement", "capture", "pending"],
    ["Sent for Settlement", "capture", "pending"],
    ["sentForCancellation", "void", "pending"],
    ["sentForPartialRefund", "refund", "pending"],
    ["sentForReversal", "reversal", "pending"],
    ["pending", "payment", "pending"],
  ])("maps outcome %s without inventing a final state", (outcome, stage, result) => {
    const r = analyze(json({ outcome, paymentId: PAY, commandId: CMD }));
    expect(r.events[0]).toMatchObject({ stage, outcome: result, eventTypeKnown: true });
    expect(r.errors).toEqual([]);
  });

  it("reads the API family and partial authorization from documented markers", () => {
    const v7 = firstEvent({ outcome: "Sent for Settlement", paymentId: PAY, commandId: CMD });
    expect(v7.attributes.apiFamily).toBe("card_payments_v7");
    const partial = firstEvent({
      outcome: "authorized",
      paymentId: PAY,
      commandId: CMD,
      amounts: { requested: 1000, totalAuthorized: 600, currency: "eur" },
    });
    expect(partial.attributes).toMatchObject({
      amountsRequested: "1000",
      amountsTotalAuthorized: "600",
      amountsCurrency: "EUR",
      partialAuthorization: true,
    });
    expect(partial.amountMinor).toBeUndefined();
  });

  it("reports an undocumented outcome as unknown", () => {
    const r = analyze(
      json({
        outcome: "somethingNew",
        paymentId: PAY,
        commandId: CMD,
        _actions: { settlePayment: {} },
      }),
    );
    expect(r.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("worldpay errors", () => {
  it("decodes every validation error with its JSON path", () => {
    const r = analyzeFixture("validation-error.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "worldpay.error" });
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 400",
    });
    expect(r.errors.map((e) => e.code)).toEqual([
      "fieldMustBeNumber",
      "fieldIsMissing",
      "panFailedLuhnCheck",
    ]);
    expect(r.errors[0]).toMatchObject({
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      source: { path: "validationErrors[0]" },
      subCodes: {
        error_name: "bodyDoesNotMatchSchema",
        json_path: "$.instruction.value.amount",
        http_status: "400",
      },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/can be retried safely/);
    expect(r.errors[2]!.retry).toBe("customer_action_required");
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("access-denied.txt");
    expect(r.errors[0]).toMatchObject({
      code: "accessDenied",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { http_status: "401" },
    });
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("treats a server error as an unknown outcome", () => {
    const r = analyzeFixture("internal-error.txt");
    expect(r.events[0]).toMatchObject({ outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "internalErrorOccurred",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/most commonly timeouts/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("never presents serviceUnavailable as a safe retry", () => {
    const e = analyze(httpResponse(503, { errorName: "serviceUnavailable", message: "x" }))
      .errors[0]!;
    expect(e.retry).toBe("retry_conditionally");
  });

  it("names the missing header", () => {
    const e = analyze(
      httpResponse(400, {
        errorName: "headerIsMissing",
        message: "x",
        headerName: "WP-Api-Version",
      }),
    ).errors[0]!;
    expect(e.subCodes.header_name).toBe("WP-Api-Version");
    expect(e.explanation).toMatch(/Header: WP-Api-Version/);
  });

  it("falls back to the HTTP status for an unknown errorName", () => {
    const e = analyze(httpResponse(404, { errorName: "somethingNew", message: "x" })).errors[0]!;
    expect(e).toMatchObject({
      code: "somethingNew",
      category: "invalid_request",
      confidence: "possible",
    });
    const bare = firstError({ errorName: "somethingNew", message: "x" });
    expect(bare).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(bare.missingInformation.join(" ")).toMatch(/HTTP status was not supplied/);
  });
});

describe("worldpay webhooks", () => {
  it("groups a card lifecycle and keeps Worldpay's own event names", () => {
    const r = analyzeFixture("card-lifecycle-webhooks.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["sentForAuthorization", "authorization", "pending"],
      ["authorized", "authorization", "success"],
      ["sentForSettlement", "capture", "pending"],
      ["settled", "settlement", "success"],
    ]);
    const auth = r.events[1]!;
    expect(auth).toMatchObject({
      eventReference: "PPLsynth-evt-0001-b",
      deliveryKey: "PPLsynth-evt-0001-b",
      paymentReference: "payPPLsynthLifecycle0001",
      merchantReference: "PPLsynth-txn-0001",
      amountMinor: "2599",
      currency: "EUR",
      attributes: {
        classification: "payment",
        eventTimestampAsSent: "2026-10-20T09:15:03.480",
        riskFactors: ["cvc:notChecked", "avs:postcode:notMatched"],
        cardBrand: "visa",
        orderReference: "PPLsynth-order-0001",
      },
    });
    // The webhook timestamp has no time zone, so it is not used as event time.
    expect(auth.eventTimestamp).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("decodes the refusal carried by refundFailed", () => {
    const r = analyzeFixture("refund-failed.json");
    expect(r.events.map((e) => [e.stage, e.outcome])).toEqual([
      ["refund", "pending"],
      ["refund", "failure"],
    ]);
    expect(r.errors[0]).toMatchObject({
      code: "5",
      category: "card_declined",
      source: { path: "eventDetails.refund.refusal" },
      providerMessage: "Do not honor",
    });
    expect(r.errors[0]!.documentation.map((d) => d.title)).toContain("Worldpay online refunds");
    expect(r.findings.find((f) => f.ruleId === "PAYMENT_FAILURE")?.title).toBe("Refund failed");
  });

  it("says that the refused webhook carries no reason", () => {
    const r = analyze(json(webhook({ type: "refused", paymentId: PAY, commandId: CMD })));
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "refused",
      confidence: "insufficient",
      outcomeKnown: true,
      paymentReference: PAY,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no refusal code field/);
  });

  it("keeps payout events apart from payment events", () => {
    const r = analyzeFixture("payout-webhooks.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["requested", "payout", "pending"],
      ["pending", "payout", "pending"],
      ["refused", "payout", "failure"],
    ]);
    expect(r.events[2]!.attributes.octReference).toBe("PPLsynthOCT0011");
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("reports repeated deliveries of one eventId", () => {
    const r = analyzeFixture("duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.observedTimestamp).toBe("2026-10-24T12:00:01.000Z");
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup?.explanation).toMatch(/same eventId/);
  });

  it("keeps unrelated payments apart", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    const cancelled = r.events.find((e) => e.eventType === "cancelled")!;
    const group = r.groups.find((g) => g.eventIds.includes(cancelled.id))!;
    expect(group.eventIds).toHaveLength(2);
    expect(cancelled).toMatchObject({ stage: "void", outcome: "success" });
  });

  it("links a v7 response, webhooks and a query into one group", () => {
    const records = [
      { outcome: "authorized", paymentId: PAY, commandId: CMD, _links: { curies: [] } },
      webhook({ type: "sentForAuthorization" }),
      webhook({ paymentId: PAY, commandId: CMD }, { eventId: "PPLsynth-evt-test-2" }),
      {
        paymentId: PAY,
        lastEvent: "authorizationSucceeded",
        events: [
          {
            eventName: "authorizationRequested",
            timestamp: "2026-10-24T10:00:00Z",
            commandId: CMD,
          },
          {
            eventName: "authorizationSucceeded",
            timestamp: "2026-10-24T10:00:01Z",
            commandId: CMD,
          },
        ],
      },
    ];
    const r = analyze(json(records));
    expect(r.events).toHaveLength(5);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining([`payment:${PAY}`, `command:${CMD}`, "txref:PPLsynth-txn-test"]),
    );
  });

  it("keeps tokenCreated card and address data out of events", () => {
    const r = analyzeFixture("token-created.json");
    expect(r.events[0]).toMatchObject({
      eventType: "tokenCreated",
      eventTypeKnown: true,
      stage: "other",
      deliveryKey: "PPLsynth-notification-0014",
      eventTimestamp: "2026-10-24T16:00:00.000Z",
      attributes: { notificationEventType: "tokenCreated" },
    });
    const dump = json(r.events);
    expect(dump).not.toMatch(/Planted|PPLSYNTHTOKEN|457173|9071|4571\*|PL4 7NT|Plantedton/);
  });

  it("does not guess minor units for currencies whose exponent is not 2", () => {
    const e = firstEvent(webhook({ amount: { value: 1500, currencyCode: "JPY" } }));
    expect(e.amountMinor).toBeUndefined();
    expect(e.currency).toBe("JPY");
    expect(e.attributes.amountValue).toBe("1500");
  });

  it("uses a zoned eventTimestamp as event time", () => {
    const e = firstEvent(webhook({}, { eventTimestamp: "2026-10-24T10:00:00.000Z" }));
    expect(e.eventTimestamp).toBe("2026-10-24T10:00:00.000Z");
    expect(e.attributes.eventTimestampAsSent).toBeUndefined();
  });

  it("maps the chargeback event to a dispute", () => {
    const r = analyze(
      json([
        webhook({ paymentId: PAY, commandId: CMD }),
        webhook(
          { classification: "chargeback", type: "informationRequested" },
          { eventId: "PPLsynth-evt-cb" },
        ),
      ]),
    );
    expect(r.events[1]).toMatchObject({ stage: "dispute", outcome: "pending" });
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("reports an unknown event type without semantics", () => {
    const r = analyze(json(webhook({ type: "somethingNew" })));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("reports the signature header only as present", () => {
    const r = analyzeFixture("webhook-request.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "worldpay.event" });
    expect(r.events[0]!.attributes).toMatchObject({
      signatureHeaderPresent: true,
      appliedNetworkToken: true,
      issuerAuthorizationCodePresent: true,
    });
  });
});

describe("worldpay payment queries", () => {
  it("splits the event history and decodes the refusal code", () => {
    const r = analyzeFixture("payment-query-refused.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.eventTimestamp])).toEqual([
      ["authorizationRequested", "authorization", "pending", "2026-10-22T16:19:24.365Z"],
      ["authorizationRefused", "authorization", "failure", "2026-10-22T16:19:24.801Z"],
    ]);
    expect(r.events[1]!.source.path).toBe("events[1]");
    expect(r.errors[0]).toMatchObject({
      code: "5",
      confidence: "strong",
      providerMessage: "Do not honour",
      attemptReference: "cmdPPLsynthQueryRefus005",
      source: { path: "events[1]" },
    });
  });

  it("treats a timed-out authorization as an unknown outcome", () => {
    const r = analyzeFixture("payment-query-timeout.json");
    expect(r.events[1]).toMatchObject({ eventType: "authorizationTimedOut", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "authorizationTimedOut",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(ruleIds(r)).toEqual(
      expect.arrayContaining(["POSSIBLE_RETRY_RISK", "UNRESOLVED_OUTCOME"]),
    );
  });

  it("decodes failed events by their error name", () => {
    const r = analyze(
      json({
        paymentId: PAY,
        lastEvent: "authorizationFailed",
        events: [
          {
            eventName: "authorizationFailed",
            timestamp: "2026-10-24T10:00:00Z",
            commandId: CMD,
            error: {
              name: "underlyingPaymentInstrumentHasExpired",
              message: "Token is unrecognized",
            },
          },
        ],
      }),
    );
    expect(r.errors[0]).toMatchObject({
      code: "underlyingPaymentInstrumentHasExpired",
      category: "card_declined",
      outcomeKnown: true,
    });
    expect(r.events[0]!.attributes.errorName).toBe("underlyingPaymentInstrumentHasExpired");
  });

  it("shows a full lifecycle with a pending refund", () => {
    const r = analyzeFixture("payment-query-lifecycle.json");
    expect(r.events).toHaveLength(6);
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.stage)).toEqual([
      "authorization",
      "authorization",
      "capture",
      "capture",
      "refund",
      "refund",
    ]);
    expect(ruleIds(r)).toContain("REFUND_PENDING");
    expect(r.errors).toEqual([]);
  });

  it("falls back to lastEvent when there is no history", () => {
    const e = firstEvent({ paymentId: PAY, lastEvent: "settlementRequestSubmitted" });
    expect(e).toMatchObject({
      eventType: "settlementRequestSubmitted",
      stage: "capture",
      outcome: "pending",
    });
  });

  it("reads the deprecated Card Payments events query", () => {
    const e = firstEvent({
      lastEvent: "Send for Cancellation",
      _links: { "cardPayments:events": { href: "x" } },
    });
    expect(e).toMatchObject({
      sourceFormat: "worldpay.card_payments_events_query",
      stage: "void",
      outcome: "pending",
      eventTypeKnown: true,
    });
  });
});

describe("worldpay sensitive data", () => {
  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("webhook-request.txt");
    const events = json(r.events);
    const report = toJsonReport(r);
    for (const value of [
      "Planted Synthetic Bank",
      "PPLSYNTHPAR0001",
      "PPLSYNTHENTITY01",
      "PPL771",
      "PPLSYNTHSCHEMEREF01",
      "PPLSYNTHSIGNATURE0001",
      "PPLSYNTHBASICAUTH0001",
      "457173",
    ]) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(events).not.toMatch(/"9071"|2031/);
    expect(r.sensitiveData.detected).toBe(true);
  });

  it("keeps tokenCreated personal data out of the JSON report", () => {
    const report = toJsonReport(analyzeFixture("token-created.json"));
    for (const value of [
      "Planted Synthetic Holder",
      "77 Planted Synthetic Road",
      "PPLSYNTHTOKENHREF0001",
      "PPLSYNTHTOKENID0001",
      "4571********9071",
    ])
      expect(report).not.toContain(value);
  });

  it("drops merchant references that contain personal data", () => {
    const r = analyze(json(webhook({ transactionReference: "someone@example.com" })));
    expect(r.events[0]!.merchantReference).toBeUndefined();
    expect(json(r.events)).not.toContain("someone@example.com");
  });
});

describe("worldpay manifest and catalog", () => {
  it("declares honest capabilities", () => {
    expect(worldpayManifest).toMatchObject({
      id: "worldpay",
      version: WORLDPAY_ADAPTER_VERSION,
      wave: 2,
      researchStatus: "tested",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      sectors: [],
      documentationAccess: "public",
      capabilities: {
        errorDecoding: "supported",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: {
        duplicateKey: "eventId",
        duplicatesDocumented: false,
        ordering: "not_documented",
      },
    });
    const text = worldpayManifest.limitations.join(" ");
    expect(text).toMatch(/gatewayRefusalCode/);
    expect(text).toMatch(/XML input is not supported/);
    expect(text).toMatch(/No merchant sectors are listed/);
    expect(manifestOnly).toBe(worldpayManifest);
    expect(defaultExport).toBe(worldpayAdapter);
  });

  it("contains every documented code, name and event", () => {
    expect(Object.keys(REFUSAL_CODES)).toHaveLength(212);
    expect(Object.keys(TEST_ONLY_REFUSAL_CODES)).toHaveLength(3);
    expect(Object.keys(ADVICE_CODES)).toHaveLength(13);
    const raw = Object.values(RAW_SCHEME_CODES);
    expect(raw.filter((e) => e.visa)).toHaveLength(69);
    expect(raw.filter((e) => e.mastercard)).toHaveLength(46);
    expect(raw.filter((e) => e.discover)).toHaveLength(63);
    expect(Object.keys(AMEX_RAW_CODES)).toHaveLength(28);
    expect(Object.keys(ERROR_NAMES)).toHaveLength(49);
    const sources = Object.values(ERROR_NAMES).map((e) => e.source);
    expect(sources.filter((s) => s === "error_responses")).toHaveLength(13);
    expect(sources.filter((s) => s === "validation")).toHaveLength(20);
    expect(Object.values(WEBHOOK_EVENT_TYPES).flatMap((t) => Object.keys(t))).toHaveLength(26);
    expect(Object.keys(QUERY_EVENT_NAMES)).toHaveLength(31);
    expect(Object.keys(OUTCOMES)).toHaveLength(15);
    expect(Object.keys(CARD_PAYMENTS_LAST_EVENTS)).toHaveLength(12);
    // Footnote markers glued to codes 13 and 65 are not codes.
    expect(REFUSAL_CODES["131"]).toBeUndefined();
    expect(REFUSAL_CODES["652"]).toBeUndefined();
  });

  it("combines the scheme readings of a raw code", () => {
    expect(rawReading("51")).toMatchObject({
      category: "insufficient_funds",
      schemeDependent: true,
      readings: [
        "Visa: Not sufficient funds (category 2)",
        "Mastercard: Insufficient funds / over limit",
        "Discover: Decline",
      ],
    });
    expect(rawReading("01")!.schemeDependent).toBe(true);
    expect(rawReading("05")!.schemeDependent).toBe(false);
    expect(rawReading("constructor")).toBeUndefined();
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      worldpayManifest,
      REFUSAL_CODES,
      RAW_SCHEME_CODES,
      AMEX_RAW_CODES,
      ERROR_NAMES,
      WEBHOOK_EVENT_TYPES,
      OUTCOMES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
