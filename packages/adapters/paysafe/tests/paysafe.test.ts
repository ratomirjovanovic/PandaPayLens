import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeSources,
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { nuveiAdapter } from "@pandapaylens/nuvei";
import { skrillAdapter } from "@pandapaylens/skrill";
import {
  ADVICE_CODES,
  AVS_CODES,
  ERROR_CODES,
  ERROR_TABLES,
  EVENT_NAMES,
  INTERCHECKS_CODES,
  ISO_RESPONSE_CODES,
  PAYSAFE_ADAPTER_VERSION,
  PROCESSOR_TABLES,
  RESOURCE_STATUSES,
  handleKey,
  paysafeAdapter,
  paysafeManifest,
  processorEntry,
} from "@pandapaylens/paysafe";
import defaultExport from "@pandapaylens/paysafe";
import { paysafeManifest as manifestOnly } from "@pandapaylens/paysafe/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [paysafeAdapter],
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

const payment = (fields: Record<string, unknown> = {}) => ({
  id: "PPLsynth-pay-0001",
  merchantRefNum: "PPLsynth-order-0001",
  paymentType: "CARD",
  currencyCode: "USD",
  settleWithAuth: true,
  status: "COMPLETED",
  amount: 1000,
  txnTime: "2026-10-20T10:00:00Z",
  ...fields,
});

const webhook = (eventName: string, payload: Record<string, unknown>, fields = {}) => ({
  eventName,
  eventType: eventName,
  attemptNumber: "1",
  resourceId: payload.id,
  eventDate: "2026-10-20T10:00:00Z",
  mode: "live",
  payload,
  ...fields,
});

const httpResponse = (status: string, headers: string[], body: unknown) =>
  [`HTTP/1.1 ${status}`, "Content-Type: application/json", ...headers, "", json(body)].join("\r\n");

const httpRequest = (line: string, body: unknown, headers: string[] = []) =>
  [line, "Content-Type: application/json", ...headers, "", json(body)].join("\r\n");

describe("paysafe detection", () => {
  it.each([
    ["payment-card-settled.json", "paysafe.resource", 0.98],
    ["payment-card-declined-advice.txt", "paysafe.resource", 0.8],
    ["apm-skrill-payment.json", "paysafe.resource", 0.98],
    ["refund-request-with-parent.txt", "paysafe.resource", 0.6],
    ["webhook-flat-handle.txt", "paysafe.resource", 0.65],
    ["payment-handle-field-error.txt", "paysafe.error", 0.98],
    ["error-authentication-failed.txt", "paysafe.error", 0.75],
    ["error-internal-timeout.txt", "paysafe.error", 0.85],
    ["error-rate-limit-plain.txt", "paysafe.error", 0.6],
    ["webhook-card-payment-failed.json", "paysafe.webhook", 0.95],
    ["webhook-refund-failed.json", "paysafe.webhook", 0.95],
    ["webhook-trailing-commas.txt", "paysafe.webhook", 0.95],
  ])("recognizes %s", (file, format, confidence) => {
    const r = analyzeFixture(`paysafe/${file}`);
    expect(r.records[0]).toMatchObject({ status: "analyzed", format, confidence });
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "paysafe", message: "Paysafe error" },
      "paysafe",
      null,
      [],
      { status: "COMPLETED" },
      { status: "FAILED", id: "PPLsynth-1" },
      { error: { code: 1001, message: "x" } },
      { error: { code: "card_declined", message: "x" } },
      { error: { type: "card_error", code: "card_declined" } },
      { eventName: "payment_completed", payload: {} },
      { EventType: "Chargeback", AttemptNumber: 1 },
      { status: "2", mb_transaction_id: "PPLsynth-1", merchant_id: "PPLsynth-2" },
      { object: "charge", merchantRefNum: "PPLsynth-1" },
      { eventId: "PPLsynth-1", eventDetails: { type: "authorized" } },
    ]) {
      expect(paysafeAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("keeps generic Paysafe-like shapes at or below 0.5", () => {
    for (const input of [
      { error: { code: "5068", message: "Field error(s)" } },
      { error: { code: "3009" } },
      { eventName: "PAYMENT_COMPLETED", payload: {} },
      { merchantRefNum: "PPLsynth-1" },
      { merchantRefNum: "PPLsynth-1", status: "COMPLETED", txnTime: "2026-10-20T10:00:00Z" },
    ]) {
      expect(paysafeAdapter.detect(input).confidence, json(input)).toBeLessThanOrEqual(0.5);
    }
    const auto = analyze(json({ error: { code: "5068", message: "Field error(s)" } }));
    expect(auto.records[0]!.status).toBe("unsupported");
    const chosen = analyze(json({ error: { code: "5068", message: "Field error(s)" } }), {
      provider: "paysafe",
    });
    expect(chosen.records[0]!.status).toBe("analyzed");
    expect(chosen.errors[0]).toMatchObject({ code: "5068", category: "invalid_request" });
  });

  it("ignores JSON-only formats when the input is form data", () => {
    expect(paysafeAdapter.detect(payment(), { format: "form" }).confidence).toBe(0);
  });

  it("treats a bare /v1/ request path as a hint, not as proof", () => {
    const generic = parseInput(
      httpRequest("POST /v1/payments HTTP/1.1", { orderId: "PPLsynth-1", amount: 10 }),
    );
    if (!generic.ok) throw new Error("parse failed");
    expect(paysafeAdapter.detect(generic.value.records[0], generic.value.meta[0]).confidence).toBe(
      0,
    );
    const hub = parseInput(
      httpRequest("POST /paymenthub/v1/payments HTTP/1.1", { orderId: "PPLsynth-1", amount: 10 }),
    );
    if (!hub.ok) throw new Error("parse failed");
    expect(paysafeAdapter.detect(hub.value.records[0], hub.value.meta[0])).toMatchObject({
      format: "paysafe.resource",
      confidence: 0.3,
    });
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "paysafe" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );
  const records = (dir: string) => {
    const out: {
      name: string;
      payload: unknown;
      meta: Parameters<typeof paysafeAdapter.detect>[1];
    }[] = [];
    for (const file of readdirSync(`${root}${dir}`)) {
      const parsed = parseInput(readFileSync(`${root}${dir}/${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        out.push({ name: `${dir}/${file} record ${i}`, payload, meta: parsed.value.meta[i] });
      });
    }
    return out;
  };

  it("includes the Stripe, Adyen, Skrill and Nuvei fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "skrill", "nuvei"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const list = records(dir);
    expect(list.length).toBeGreaterThan(0);
    for (const r of list)
      expect(paysafeAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
  });

  it("is not claimed by the Skrill or Nuvei adapters, including Skrill nested in a Paysafe payment", () => {
    const list = records("paysafe");
    expect(list.length).toBeGreaterThan(20);
    for (const r of list) {
      expect(skrillAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
      expect(nuveiAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
    }
    const r = analyze(fixture("paysafe/apm-skrill-payment.json"), {
      adapters: [paysafeAdapter, skrillAdapter, nuveiAdapter],
    });
    expect(r.records[0]).toMatchObject({ provider: "paysafe", alternatives: [] });
    expect(r.events[0]!.attributes).toMatchObject({
      paymentType: "SKRILL",
      gatewayProcessor: "SKRILL_QCO",
      gatewayStatus: "2",
    });
  });

  it("recognizes list responses and legacy Cards API requests without analyzing them", () => {
    const list = analyzeFixture("paysafe/list-response.json");
    expect(list.records[0]).toMatchObject({
      status: "unsupported",
      format: "paysafe.list",
      confidence: 0.7,
    });
    const legacy = analyze(
      httpRequest("POST /cardpayments/v1/accounts/PPLsynth-acct-1/auths HTTP/1.1", {
        merchantRefNum: "PPLsynth-order-1",
        amount: 100,
      }),
    );
    expect(legacy.records[0]).toMatchObject({
      status: "unsupported",
      format: "paysafe.legacy_cards",
    });
    expect(legacy.events).toHaveLength(0);
  });
});

describe("paysafe parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noPayload = {
      eventName: "PAYMENT_COMPLETED",
      resourceId: "PPLsynth-1",
      attemptNumber: "1",
    };
    const r = analyze(json(noPayload));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "paysafe.webhook" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/payload/);

    const bare = { settleWithAuth: true, availableToSettle: 0, txnTime: "2026-10-20T10:00:00Z" };
    const b = analyze(json(bare), { provider: "paysafe" });
    expect(b.records[0]).toMatchObject({ status: "invalid", format: "paysafe.resource" });
    expect(b.records[0]!.reasons.join(" ")).toMatch(/id, status, merchantRefNum or error/);
  });

  it("reports malformed field types as parse issues", () => {
    const r = analyze(json(payment({ status: 5 })));
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status/);
    const w = analyze(json(webhook("PAYMENT_COMPLETED", { id: "PPLsynth-1", amount: { v: 1 } })));
    expect(w.records[0]!.status).toBe("invalid");
  });

  it("rejects truncated JSON before detection", () => {
    const r = analyzeText('{"id": "PPLsynth-1", "merchantRefNum": ', options);
    expect(r.ok).toBe(false);
  });

  it("accepts documentation JSON with trailing commas and warns", () => {
    const r = analyzeFixture("paysafe/webhook-trailing-commas.txt");
    expect(r.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "PAYMENT_HANDLE_PAYABLE",
      stage: "authentication",
      outcome: "pending",
      relatedReference: "PPLsynth-handle-9501",
      eventTimestamp: "2026-10-20T17:21:33.000Z",
    });
    expect(json(r.events)).not.toContain("PPLsynthStore");
  });
});

describe("paysafe API responses", () => {
  it("reads a card payment settled with the authorization", () => {
    const r = analyzeFixture("paysafe/payment-card-settled.json");
    expect(r.errors).toHaveLength(0);
    expect(r.events).toHaveLength(2);
    const [pay, settle] = r.events;
    expect(pay).toMatchObject({
      eventType: "payment.COMPLETED",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth-pay-1001",
      merchantReference: "PPLsynth-order-1001",
      amountMinor: "500",
      currency: "USD",
      eventTimestamp: "2026-10-20T10:15:29.000Z",
    });
    expect(pay!.attributes).toMatchObject({
      settleWithAuth: true,
      availableToSettle: "0",
      gatewayCode: "VPS",
      gatewayResponseCode: "00",
      avsResponse: "MATCH",
      cvvVerification: "MATCH",
      cardType: "VI",
    });
    // Capture is not settlement: the settlement entry is still waiting for the batch.
    expect(settle).toMatchObject({
      eventType: "settlement.PENDING",
      stage: "capture",
      outcome: "pending",
      paymentReference: "PPLsynth-pay-1001",
      relatedReference: "PPLsynth-pay-1001",
      amountMinor: "500",
      currency: "USD",
      source: { path: "settlements[0]" },
    });
    expect(settle!.attributes.isModification).toBeUndefined();
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toEqual([]);
  });

  it("shows an authorization without settlement as an authorization", () => {
    const r = analyze(
      json(payment({ settleWithAuth: false, availableToSettle: 1000, status: "COMPLETED" })),
    );
    expect(r.events[0]).toMatchObject({
      eventType: "payment.COMPLETED",
      stage: "authorization",
      outcome: "success",
    });
    expect(r.events[0]!.attributes.availableToSettle).toBe("1000");
  });

  it("decodes a card decline with a merchant advice code and an ISO response code", () => {
    const r = analyzeFixture("paysafe/payment-card-declined-advice.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.error",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth-pay-2001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      httpStatus: 402,
      errorCode: "3009",
      internalCorrelationId: "PPLsynth-corr-2001",
      applicationStatusCode: "3009",
    });
    expect(r.errors).toHaveLength(2);
    const [decline, raw] = r.errors;
    expect(decline).toMatchObject({
      code: "3009",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "PPLsynth-pay-2001",
      attemptReference: "PPLsynth-pay-2001",
      subCodes: {
        advice_code: "ADVICE-03",
        iso_response_code: "05",
        http_status: "402",
        application_status_code: "3009",
        error_table: "payment",
      },
      source: { path: "error" },
    });
    expect(decline!.retryExplanation).toMatch(/ADVICE-03.*10 retries in 30 days/);
    expect(decline!.explanation).toMatch(/ISO response code 05: Do not honour/);
    expect(decline!.providerMessage).toMatch(/declined by the issuing bank/);
    // The raw processor code is read with the TAS/VPS table by inference only.
    expect(raw).toMatchObject({
      code: "05",
      category: "card_declined",
      confidence: "possible",
      subCodes: { processor_table: "TAS/VPS", gateway_code: "VPS" },
      source: { path: "gatewayResponse" },
    });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("lets the merchant advice code set the retry guidance", () => {
    const body = payment({
      status: "FAILED",
      error: {
        code: "3009",
        message: "Declined",
        additionalDetails: [{ type: "ADVICE", code: "ADVICE-01", message: "Do not retry" }],
      },
    });
    const e = analyze(json(body)).errors[0]!;
    expect(e).toMatchObject({ code: "3009", retry: "do_not_retry", category: "card_declined" });
    const unknownAdvice = analyze(
      json(
        payment({
          status: "FAILED",
          error: { code: "3009", additionalDetails: [{ type: "ADVICE", code: "ADVICE-99" }] },
        }),
      ),
    ).errors[0]!;
    expect(unknownAdvice.retry).toBe("customer_action_required");
    expect(unknownAdvice.missingInformation.join(" ")).toMatch(/ADVICE-99/);
  });

  it("decodes a field validation error", () => {
    const r = analyzeFixture("paysafe/payment-handle-field-error.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "error.5068",
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 400",
    });
    expect(r.events[0]!.attributes.fieldErrorFields).toEqual(["billingAddress.street"]);
    expect(r.errors[0]).toMatchObject({
      code: "5068",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { fields: "billingAddress.street", documented_http: "400" },
    });
    expect(r.errors[0]!.explanation).toMatch(
      /Fields: billingAddress.street \(size must be between 0 and 50\)/,
    );
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("paysafe/error-authentication-failed.txt");
    expect(r.errors[0]).toMatchObject({
      code: "5279",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(r.events[0]!.outcome).toBe("failure");
  });

  it("keeps the outcome open for an internal timeout", () => {
    const r = analyzeFixture("paysafe/error-internal-timeout.txt");
    expect(r.events[0]).toMatchObject({ outcome: "unknown", stage: "error" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "1007",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.retryExplanation).toMatch(/look up the resource/i);
    expect(ruleIds(r)).toEqual(["POSSIBLE_RETRY_RISK"]);
  });

  it("decodes an error response that carries only the X-Application-Status-Code header", () => {
    const r = analyzeFixture("paysafe/error-rate-limit-plain.txt");
    expect(r.records[0]!.format).toBe("paysafe.error");
    expect(r.errors[0]).toMatchObject({
      code: "1200",
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
      providerMessage: "Call rate limit exceeded",
      source: { path: "" },
    });
    // A plain-text error without the header is not attributed to Paysafe.
    const plain = analyze(
      "HTTP/1.1 429 Too Many Requests\r\nContent-Type: text/plain\r\n\r\nSlow down",
    );
    expect(plain.records[0]!.status).toBe("unsupported");
  });

  it("notes when the status header and error.code differ", () => {
    const text = httpResponse("400 Bad Request", ["X-Application-Status-Code: 5023"], {
      error: { code: "5068", message: "Field error(s)", details: ["PPLsynth"] },
    });
    const e = analyze(text).errors[0]!;
    expect(e.code).toBe("5068");
    expect(e.missingInformation.join(" ")).toMatch(/X-Application-Status-Code header \(5023\)/);
  });

  it("is honest about unrecognized error codes", () => {
    const text = httpResponse("400 Bad Request", [], {
      error: { code: "9999", message: "Something", details: ["PPLsynth detail"] },
    });
    // Without a documented code the shape alone stays below the threshold.
    expect(analyze(text).records[0]!.status).toBe("unsupported");
    const e = analyze(text, { provider: "paysafe" }).errors[0]!;
    expect(e).toMatchObject({ code: "9999", category: "invalid_request", confidence: "possible" });
    expect(e.missingInformation.join(" ")).toMatch(/not documented/);
    const noStatus = analyze(
      json(payment({ status: "FAILED", error: { code: "9999", message: "x" } })),
    ).errors[0]!;
    expect(noStatus).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const sdk = analyze(
      httpResponse("409 Conflict", [], {
        error: {
          code: "DW-CUSTOMER-CONFLICT",
          message: "Conflict",
          details: ["PPLsynth"],
          additionalDetails: [{ type: "Duplication", code: "22", message: "Duplicate" }],
        },
      }),
      { provider: "paysafe" },
    ).errors[0]!;
    expect(sdk.explanation).toMatch(/Java SDK/);
    expect(sdk.subCodes.additional_detail).toBe("Duplication:22");
  });

  it("decodes Interchecks names with the documented confidence", () => {
    const addCard = analyze(
      httpResponse("400 Bad Request", [], {
        error: { code: "ERR_CARD_INELIGIBLE", message: "Card ineligible", details: ["PPLsynth"] },
      }),
      { provider: "paysafe" },
    ).errors[0]!;
    expect(addCard).toMatchObject({ confidence: "strong", category: "payment_method_unavailable" });
    const other = analyze(
      json(
        payment({
          status: "FAILED",
          error: { code: "ERR_VELOCITY_LIMIT", message: "Velocity controls" },
        }),
      ),
    ).errors[0]!;
    expect(other).toMatchObject({ confidence: "possible", category: "fraud_or_risk" });
  });

  it("shows both meanings of overlapping codes", () => {
    const e = analyze(
      json(payment({ status: "FAILED", error: { code: "3060", message: "SCA required" } })),
    ).errors[0]!;
    expect(e.category).toBe("authentication_required");
    expect(e.explanation).toMatch(/unsolicited reversal/);
  });

  it("reads the AVS letter of error 3007 by inference", () => {
    const e = analyze(
      json(
        payment({
          status: "FAILED",
          error: { code: "3007", message: "AVS failed" },
          gatewayResponse: { code: "VPS", avsCode: "N", responseCode: "05" },
        }),
      ),
    ).errors;
    expect(e[0]!.subCodes.avs_code).toBe("N");
    expect(e[0]!.explanation).toMatch(/avsCode N: No response sent.*inference/);
  });

  it("decodes raw processor codes only through a documented processor table", () => {
    expect(processorEntry("TAS/VPS", "H4")?.meaning).toMatch(/Contact merchant services/);
    expect(processorEntry("TAS/VPS", "P6")?.category).toBe("configuration");
    expect(processorEntry("TAS/VPS", "P7")?.meaning).toMatch(/Terminal boarding/);
    expect(processorEntry("MON", "H4")).toBeUndefined();
    // MON lists 01 as an approval, the other tables as "refer to issuer".
    expect(processorEntry("MON", "01")?.approval).toBe(true);
    expect(processorEntry("OPN/NAG", "01")?.approval).toBe(false);

    const failedNoError = analyze(
      json(payment({ status: "FAILED", gatewayResponse: { code: "MON", responseCode: "51" } })),
    );
    expect(failedNoError.errors[0]).toMatchObject({
      code: "51",
      category: "insufficient_funds",
      confidence: "possible",
      subCodes: { processor_table: "MON" },
    });
    const gps = analyze(
      json(payment({ status: "FAILED", gatewayResponse: { code: "GPS", responseCode: "05" } })),
    );
    expect(gps.errors[0]).toMatchObject({
      code: "05",
      category: "unknown",
      confidence: "insufficient",
    });
    expect(gps.errors[0]!.explanation).toMatch(
      /no processor table is documented for gateway code GPS/,
    );
    // Next to a decoded Paysafe error an undecodable raw code adds nothing.
    const both = analyze(
      json(
        payment({
          status: "FAILED",
          error: { code: "3009" },
          gatewayResponse: { code: "GPS", responseCode: "05" },
        }),
      ),
    );
    expect(both.errors).toHaveLength(1);
    // An approval code on a completed payment is not an error.
    expect(analyze(fixture("paysafe/payment-card-settled.json")).errors).toHaveLength(0);
  });

  it("keeps the resource type unknown when nothing in the body names it", () => {
    const refund = {
      id: "PPLsynth-refund-0001",
      merchantRefNum: "PPLsynth-order-0001-r1",
      amount: 200,
      currencyCode: "USD",
      status: "COMPLETED",
      txnTime: "2026-10-20T11:00:00Z",
    };
    const r = analyze(json(refund));
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({
      eventType: "resource.COMPLETED",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
    // The same body behind a refund request path is a refund.
    const linked = analyze(
      httpRequest("GET /paymenthub/v1/refunds/PPLsynth-refund-0001 HTTP/1.1", refund),
    );
    expect(linked.events[0]).toMatchObject({ eventType: "refund.request", stage: "refund" });
  });

  it("reads a payment handle that needs a redirect", () => {
    const handle = {
      id: "PPLsynth-handle-0001",
      merchantRefNum: "PPLsynth-order-0001",
      paymentHandleToken: "PPLsynthHT0001zz",
      paymentType: "PAYPAL",
      usage: "SINGLE_USE",
      action: "REDIRECT",
      executionMode: "SYNCHRONOUS",
      transactionType: "PAYMENT",
      timeToLiveSeconds: 899,
      status: "INITIATED",
      links: [{ rel: "redirect_payment", href: "https://planted.example.invalid/PLANTEDREDIRECT" }],
    };
    const r = analyze(json(handle));
    expect(r.events[0]).toMatchObject({
      eventType: "payment_handle.INITIATED",
      stage: "authentication",
      outcome: "pending",
      relatedReference: "PPLsynth-handle-0001",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      action: "REDIRECT",
      timeToLiveSeconds: 899,
      paymentHandleKey: handleKey("PPLsynthHT0001zz"),
    });
    const dump = json(r.events) + toJsonReport(r);
    expect(dump).not.toContain("PPLsynthHT0001zz");
    expect(dump).not.toContain("PLANTEDREDIRECT");
  });

  it("explains documented status reasons", () => {
    const r = analyze(
      json(
        webhook("PAYMENT_HANDLE_EXPIRED", {
          id: "PPLsynth-handle-0002",
          merchantRefNum: "PPLsynth-order-0002",
          status: "EXPIRED",
          statusReason: "AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE",
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "authentication", outcome: "failure" });
    expect(r.events[0]!.attributes.statusReasonMeaning).toMatch(/makes the \/payments call itself/);
  });
});

describe("paysafe webhooks", () => {
  it("reads a failed card payment webhook", () => {
    const r = analyzeFixture("paysafe/webhook-card-payment-failed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "PAYMENT_FAILED",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth-pay-7001",
      amountMinor: "6",
      currency: "USD",
      deliveryKey: "PAYMENT_FAILED|PPLsynth-pay-7001|FAILED|2026-10-20T17:32:22Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      attemptNumber: 1,
      webhookType: "PAYMENT",
      envelopeShape: "sdk",
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "3028",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      outcomeKnown: true,
      paymentReference: "PPLsynth-pay-7001",
      source: { path: "payload.error" },
    });
    // A gateway system error is a failure, not an issuer decline.
    expect(e.retryExplanation).toMatch(/reports this attempt as failed/);
    expect(e.retryExplanation).not.toMatch(/declined/);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("reads a failed refund webhook without inventing its parent", () => {
    const r = analyzeFixture("paysafe/webhook-refund-failed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "REFUND_FAILED",
      stage: "refund",
      outcome: "failure",
      paymentReference: "PPLsynth-refund-8001",
    });
    expect(r.events[0]!.relatedReference).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      isModification: true,
      envelopeShape: "full",
      webhookMode: "live",
      linkRels: ["refund"],
    });
    expect(r.errors[0]).toMatchObject({
      code: "ALTERNATE-PAYMENTS-GATEWAY-6",
      category: "invalid_amount",
      retry: "do_not_retry",
    });
    expect(ruleIds(r)).toEqual(["MISSING_REFERENCE", "PAYMENT_FAILURE"]);
    const dump = json(r.events) + toJsonReport(r);
    expect(dump).not.toContain("PPLsynth-acct-1002786770");
    expect(dump).not.toContain("alternatepayments");
  });

  it("links a payment handle to the payment it funded", () => {
    const r = analyzeFixture("paysafe/webhook-eps-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["PAYMENT_HANDLE_PROCESSING", "authentication", "pending"],
      ["PAYMENT_HANDLE_PAYABLE", "authentication", "pending"],
      // COMPLETED only says the handle was used.
      ["PAYMENT_HANDLE_COMPLETED", "authentication", "unknown"],
      ["PAYMENT_COMPLETED", "payment", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining(["ref:PPLsynth-handle-9001", "ref:PPLsynth-pay-9001"]),
    );
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(json(r.events) + toJsonReport(r)).not.toContain("PPLsynthHT9001ab");
    expect(ruleIds(r)).toEqual([]);
  });

  it("reports a repeated delivery", () => {
    const r = analyzeFixture("paysafe/webhook-duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    expect(r.events[1]!.attributes).toMatchObject({ attemptNumber: 2, redelivery: true });
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "success" });
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
  });

  it("reads a flat resource posted as a webhook and never trusts its signature", () => {
    const r = analyzeFixture("paysafe/webhook-flat-handle.txt");
    expect(r.records[0]!.format).toBe("paysafe.resource");
    expect(r.events[0]).toMatchObject({
      eventType: "payment_handle.PAYABLE",
      stage: "authentication",
      outcome: "pending",
      relatedReference: "PPLsynth-handle-9301",
    });
    expect(r.events[0]!.attributes.signatureHeaderPresent).toBe(true);
    const dump = json(r.events) + toJsonReport(r);
    expect(dump).not.toContain("PLANTEDSIGNATUREVALUE");
    expect(dump).not.toContain("PPLsynth-acct-9301");
  });

  it("shows a returned payout after its completion", () => {
    const r = analyzeFixture("paysafe/standalone-credit-returned.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["SA_CREDIT_COMPLETED", "payout", "success"],
      ["SA_CREDIT_RETURN_COMPLETED", "reversal", "failure"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("failure");
  });

  it("maps settlement, void and credit events", () => {
    const cases: [string, string | undefined, string, string][] = [
      ["SETTLEMENT_PENDING", "PENDING", "capture", "pending"],
      ["SETTLEMENT_COMPLETED", "COMPLETED", "capture", "success"],
      ["SETTLEMENT_ERRORED", undefined, "capture", "failure"],
      ["SETTLEMENT_CANCELLED", "CANCELLED", "cancellation", "failure"],
      ["VOIDAUTH_COMPLETED", "COMPLETED", "void", "success"],
      ["REFUND_PENDING", "PENDING", "refund", "pending"],
      ["REFUND_ERRORED", "ERROR", "refund", "failure"],
      ["ORIGINAL_CREDIT_COMPLETED", "COMPLETED", "payout", "success"],
      ["SA_CREDIT_HELD", "HELD", "payout", "pending"],
      ["PAYMENT_HELD", "HELD", "payment", "pending"],
      ["PAYMENT_CANCELLED", "CANCELLED", "cancellation", "failure"],
      ["PAYMENT_HANDLE_ERRORED", "ERROR", "authentication", "failure"],
    ];
    for (const [name, status, stage, outcome] of cases) {
      const payload: Record<string, unknown> = {
        id: "PPLsynth-res-0001",
        merchantRefNum: "PPLsynth-order-0001",
      };
      if (status) payload.status = status;
      const e = analyze(json(webhook(name, payload))).events[0]!;
      expect([e.eventType, e.eventTypeKnown, e.stage, e.outcome], name).toEqual([
        name,
        true,
        stage,
        outcome,
      ]);
    }
  });

  it("reads settlements next to the payload in the SDK envelope", () => {
    const r = analyze(
      json({
        eventName: "PAYMENT_COMPLETED",
        type: "PAYMENT",
        attemptNumber: 1,
        resourceId: "PPLsynth-pay-0003",
        eventDate: "2026-10-20T10:00:00Z",
        payload: payment({ id: "PPLsynth-pay-0003" }),
        settlements: [{ id: "PPLsynth-pay-0003", amount: 1000, status: "PENDING" }],
      }),
    );
    expect(r.events.map((e) => [e.eventType, e.source.path])).toEqual([
      ["PAYMENT_COMPLETED", "payload"],
      ["settlement.PENDING", "settlements[0]"],
    ]);
    expect(r.groups).toHaveLength(1);
  });

  it("reads Payment Scheduler and registration events from their names only", () => {
    const sched = analyze(
      json(webhook("SCHEDULED_PAYMENT_FAILED", { id: "PPLsynth-sched-0001", status: "FAILED" })),
    ).events[0]!;
    expect(sched).toMatchObject({
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
    });
    expect(sched.paymentReference).toBeUndefined();
    expect(sched.attributes.resourceId).toBe("PPLsynth-sched-0001");
    const cancelled = analyze(
      json(webhook("SUBSCRIPTION_CANCELLED", { id: "PPLsynth-sched-0002" })),
    ).events[0]!;
    expect(cancelled).toMatchObject({ stage: "cancellation", outcome: "success" });
    const reg = analyze(json(webhook("REGISTRATION_DECLINED", { id: "PPLsynth-reg-0001" })))
      .events[0]!;
    expect(reg).toMatchObject({ stage: "other", outcome: "failure", eventTypeKnown: true });
  });

  it("uses resourceId when the payload omits its id", () => {
    const r = analyze(
      json({
        eventName: "PAYMENT_FAILED",
        type: "PAYMENT",
        attemptNumber: "1",
        resourceId: "PPLsynth-pay-0008",
        eventDate: "2026-10-20T10:00:00Z",
        payload: {
          status: "FAILED",
          merchantRefNum: "PPLsynth-order-0008",
          error: { code: "3022" },
        },
      }),
    );
    expect(r.events[0]!.paymentReference).toBe("PPLsynth-pay-0008");
    expect(r.errors[0]).toMatchObject({ code: "3022", paymentReference: "PPLsynth-pay-0008" });
  });

  it("marks undocumented event names as unknown", () => {
    const r = analyze(
      json(
        webhook("PAYMENT_DISPUTED", {
          id: "PPLsynth-pay-0004",
          merchantRefNum: "PPLsynth-order-0004",
          status: "COMPLETED",
        }),
      ),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({ eventType: "PAYMENT_DISPUTED", eventTypeKnown: false });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("paysafe correlation", () => {
  it("links a refund to its parent only through the request path", () => {
    const req = analyzeFixture("paysafe/refund-request-with-parent.txt");
    expect(req.events[0]).toMatchObject({
      eventType: "refund.request",
      stage: "refund",
      outcome: "pending",
      paymentReference: "PPLsynth-pay-1001",
      amountMinor: "200",
    });
    expect(req.events[0]!.attributes).toMatchObject({
      parentReferenceSource: "request_path",
      requestMethod: "POST",
      dupCheck: true,
    });
    expect(req.events[0]!.attributes.isModification).toBeUndefined();
    expect(req.errors).toHaveLength(0);

    const both = analyzeSources(
      [
        { name: "payment.json", text: fixture("paysafe/payment-card-settled.json") },
        { name: "refund.txt", text: fixture("paysafe/refund-request-with-parent.txt") },
      ],
      options,
    );
    if (!both.ok) throw new Error("analysis failed");
    expect(both.result.groups).toHaveLength(1);
    expect(both.result.groups[0]!.eventIds).toHaveLength(3);
  });

  it("links settlements and voids named by the request path", () => {
    const settle = analyze(
      httpRequest("POST /paymenthub/v1/payments/PPLsynth-pay-0005/settlements HTTP/1.1", {
        merchantRefNum: "PPLsynth-order-0005",
        amount: 700,
      }),
    ).events[0]!;
    expect(settle).toMatchObject({
      eventType: "settlement.request",
      stage: "capture",
      paymentReference: "PPLsynth-pay-0005",
    });
    const voided = analyze(
      httpRequest("POST /paymenthub/v1/payments/PPLsynth-pay-0005/voidauths HTTP/1.1", {
        merchantRefNum: "PPLsynth-order-0005-v",
        amount: 300,
      }),
    ).events[0]!;
    expect(voided).toMatchObject({ stage: "void", paymentReference: "PPLsynth-pay-0005" });
    const cancel = analyze(
      httpRequest("PUT /paymenthub/v1/settlements/PPLsynth-settle-0005 HTTP/1.1", {
        merchantRefNum: "PPLsynth-order-0005",
        status: "CANCELLED",
      }),
    ).events[0]!;
    expect(cancel).toMatchObject({
      stage: "cancellation",
      outcome: "pending",
      paymentReference: "PPLsynth-settle-0005",
    });
    expect(cancel.attributes.requestedStatus).toBe("CANCELLED");
  });

  it("keeps unrelated payments apart and never links by merchantRefNum", () => {
    const r = analyzeFixture("paysafe/unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    const sameRef = analyze(
      json([
        payment({ id: "PPLsynth-pay-0006", merchantRefNum: "PPLsynth-shared" }),
        payment({ id: "PPLsynth-pay-0007", merchantRefNum: "PPLsynth-shared" }),
      ]),
    );
    expect(sameRef.groups).toHaveLength(2);
    expect(paysafeAdapter.correlationKeys(sameRef.events[0]!)).toEqual(["ref:PPLsynth-pay-0006"]);
  });

  it("derives a stable, one-way handle key", () => {
    expect(handleKey("PPLsynthHT9001ab")).toBe(handleKey("PPLsynthHT9001ab"));
    expect(handleKey("PPLsynthHT9001ab")).not.toBe(handleKey("PPLsynthHT9001ac"));
    expect(handleKey("PPLsynthHT9001ab")).toMatch(/^h-[0-9a-f]{16}$/);
  });
});

describe("paysafe sensitive data", () => {
  const PLANTED = [
    "PLANTEDACCOUNTID",
    "PLANTEDHANDLETOKEN",
    "198.51.100.77",
    "PLANTEDTMXSESSION",
    "PLANTEDPARVALUE",
    "PLANTEDCARDNUMBER",
    "PLANTEDCVV",
    "Planted Holder Name",
    "PLANTEDEXPMONTH",
    "PLANTEDEXPYEAR",
    "PLANTEDBIN",
    "PLANTEDLAST",
    "PLANTEDCARDTOKEN",
    "PlantedFirst",
    "PlantedLast",
    "planted.person@example.com",
    "PLANTEDPHONE",
    "Planted Street 12",
    "PlantedCity",
    "PLANTEDZIP",
    "PLANTEDAUTHID",
    "PLANTEDCAVV",
    "PLANTEDXID",
    "PLANTEDDSTRANS",
    "PLANTEDRETURN",
    "PLANTEDDESCRIPTOR",
    "PLANTEDAUTHCODE",
    "PLANTEDMID",
    "PLANTEDTERMINAL",
    "PLANTEDSID",
    "planted.support@example.com",
    "planted.details@example.com",
    "4111 1111 1111 1111",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("paysafe/sensitive-payment.json");
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.errors.length).toBeGreaterThan(0);
    const events = json(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    expect(r.errors[0]!.providerMessage).toMatch(/\[redacted\]/);
  });

  it("keeps nested Skrill payer data and credentials out of the output", () => {
    for (const file of ["apm-skrill-payment.json", "refund-request-with-parent.txt"]) {
      const r = analyzeFixture(`paysafe/${file}`);
      const dump = json(r.events) + toJsonReport(r);
      for (const value of [
        "PLANTEDSKRILLMERCHANT",
        "planted.merchant@example.com",
        "planted.payer@example.com",
        "PLANTEDBASICAUTH",
        "PPLsynthHT9601ef",
      ])
        expect(dump, `${file}: ${value}`).not.toContain(value);
    }
  });
});

describe("paysafe manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(paysafeAdapter);
    expect(paysafeAdapter.manifest).toBe(paysafeManifest);
    expect(manifestOnly).toBe(paysafeManifest);
    expect(paysafeAdapter.version).toBe(PAYSAFE_ADAPTER_VERSION);
  });

  it("declares honest metadata and capabilities", () => {
    expect(paysafeManifest).toMatchObject({
      id: "paysafe",
      version: "0.1.0",
      wave: 2,
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      capabilities: {
        errorDecoding: "supported",
        paymentResponses: "limited",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect([...paysafeManifest.categories].sort()).toEqual([
      "acquiring",
      "alternative_payment_method",
      "card_processing",
      "gateway",
      "wallet",
    ]);
    expect(paysafeManifest.sectors.length).toBeGreaterThan(0);
    for (const s of paysafeManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/www\.paysafe\.com\/en\//);
    expect(paysafeManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(
      /adult|nutra|cbd|dating/,
    );
    const limits = paysafeManifest.limitations.join(" ");
    expect(limits).toMatch(/no chargeback or dispute/);
    expect(limits).toMatch(/request path/);
    expect(limits).toMatch(/inference/);
    expect(limits).toMatch(/never treated as authentic/);
    const families = Object.fromEntries(paysafeManifest.apiFamilies.map((f) => [f.id, f.status]));
    for (const f of paysafeAdapter.supportedFormats) expect(families[f.id]).not.toBe("unsupported");
    expect(families["paysafe.list"]).toBe("unsupported");
    expect(families["paysafe.legacy_cards"]).toBe("unsupported");
  });

  it("contains every documented code table, status and event", () => {
    const sizes = Object.fromEntries(
      Object.entries(ERROR_TABLES).map(([k, v]) => [k, Object.keys(v).length]),
    );
    expect(sizes).toEqual({
      common: 39,
      payment: 75,
      void: 8,
      settlement: 8,
      refund: 21,
      customer_vault: 18,
      alternate_payments: 20,
      direct_debit: 9,
      payment_handle_3ds: 27,
    });
    // 4002 is in the payment and Direct Debit tables with the same meaning.
    expect(Object.keys(ERROR_CODES)).toHaveLength(224);
    expect(ERROR_CODES["4002"]!.tables).toEqual(["payment", "direct_debit"]);
    expect(Object.keys(ADVICE_CODES)).toHaveLength(15);
    expect(Object.keys(ISO_RESPONSE_CODES)).toHaveLength(40);
    expect(Object.keys(AVS_CODES)).toHaveLength(20);
    expect(Object.keys(INTERCHECKS_CODES)).toHaveLength(49);
    const processor = Object.fromEntries(
      Object.entries(PROCESSOR_TABLES).map(([k, v]) => [k, Object.keys(v).length]),
    );
    expect(processor).toEqual({ "OPN/NAG": 61, MON: 46, "TAS/VPS": 108, FRD: 132, VAN: 113 });
    const vsps = Object.values(PROCESSOR_TABLES).reduce(
      (n, t) => n + Object.values(t).filter((e) => e.vsps).length,
      0,
    );
    expect(vsps).toBe(13);
    expect(Object.keys(EVENT_NAMES)).toHaveLength(57);
    expect(Object.keys(RESOURCE_STATUSES.payment).sort()).toEqual([
      "CANCELLED",
      "COMPLETED",
      "FAILED",
      "HELD",
      "PENDING",
      "PROCESSING",
      "RECEIVED",
    ]);
    // Every webhook event with a status maps to a documented status of its resource.
    for (const [name, info] of Object.entries(EVENT_NAMES))
      if ("status" in info)
        expect(RESOURCE_STATUSES[info.resource][info.status], name).toBeDefined();
  });

  it("uses no en or em dashes in published text, sources or fixtures", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const text = JSON.stringify([
      paysafeManifest,
      ERROR_CODES,
      ADVICE_CODES,
      ISO_RESPONSE_CODES,
      PROCESSOR_TABLES,
      INTERCHECKS_CODES,
      AVS_CODES,
    ]);
    expect(text).not.toMatch(dashes);
    const pkg = fileURLToPath(new URL("../", import.meta.url));
    const fixtures = fileURLToPath(new URL("../../../../fixtures/paysafe/", import.meta.url));
    for (const file of [
      "src/index.ts",
      "src/catalog.ts",
      "src/manifest.ts",
      "tests/paysafe.test.ts",
    ])
      expect(readFileSync(`${pkg}${file}`, "utf8"), file).not.toMatch(dashes);
    for (const file of readdirSync(fixtures)) {
      const content = readFileSync(`${fixtures}${file}`, "utf8");
      expect(content, file).not.toMatch(dashes);
      expect(content, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});
