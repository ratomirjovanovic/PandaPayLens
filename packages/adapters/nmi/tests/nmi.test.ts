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
  type RecordMeta,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { ADAPTERS } from "@pandapaylens/providers";
import nmiDefault, {
  AVS_CODES,
  CONDITIONS,
  CVV_CODES,
  NMI_ADAPTER_VERSION,
  NMI_FORMATS,
  RESPONSE_CODES,
  RESPONSE_VALUES,
  TRANSACTION_TYPES,
  WEBHOOK_EVENT_TYPES,
  classicOutcome,
  nmiAdapter,
  nmiManifest,
} from "@pandapaylens/nmi";

const options: AnalyzeOptions = {
  adapters: [nmiAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturePath = (p: string) =>
  fileURLToPath(new URL(`../../../../fixtures/${p}`, import.meta.url));
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (p: string) => analyze(fixture(`nmi/${p}`));

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

const classic = (fields: Record<string, string> = {}) =>
  form({
    response: "1",
    responsetext: "Approved",
    authcode: "PPL100",
    transactionid: "PPLsynth0000000900",
    avsresponse: "",
    cvvresponse: "",
    orderid: "",
    type: "sale",
    response_code: "100",
    ...fields,
  });

const webhook = (eventType: string, body: Record<string, unknown>, eventId = "PPLsynth-evt-0900") =>
  JSON.stringify({ event_id: eventId, event_type: eventType, event_body: body });

const txBody = (extra: Record<string, unknown> = {}, action: Record<string, unknown> = {}) => ({
  transaction_id: "PPLsynth0000000901",
  transaction_type: "cc",
  condition: "pendingsettlement",
  currency: "USD",
  action: {
    amount: "10.00",
    action_type: "sale",
    date: "20261020100000",
    success: "1",
    source: "api",
    response_code: "100",
    ...action,
  },
  ...extra,
});

const formMeta: RecordMeta = { format: "form" };
const jsonMeta: RecordMeta = { format: "json" };
const detectText = (text: string) => {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return nmiAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
};

describe("nmi detection", () => {
  it.each([
    ["classic-sale-approved.txt", NMI_FORMATS.classic, 0.85],
    ["classic-decline-generic.txt", NMI_FORMATS.classic, 0.85],
    ["classic-rate-limit.txt", NMI_FORMATS.classic, 0.85],
    ["classic-validation-error.txt", NMI_FORMATS.classic, 0.9],
    ["classic-capture-approved-http.txt", NMI_FORMATS.classic, 0.85],
    ["webhook-sale-success.json", NMI_FORMATS.webhook, 0.95],
    ["webhook-settlement-batch.json", NMI_FORMATS.webhook, 0.8],
    ["webhook-capture-failure-http.txt", NMI_FORMATS.webhook, 0.95],
  ])("detects %s", (file, format, confidence) => {
    const d = detectText(fixture(`nmi/${file}`));
    expect(d).toMatchObject({ provider: "nmi", format, confidence, supported: true });
  });

  it("names the format, not a reseller, and never claims certainty for Classic responses", () => {
    const d = detectText(fixture("nmi/classic-validation-error.txt"));
    expect(d.confidence).toBeLessThanOrEqual(0.9);
    expect(d.reasons.join(" ")).toMatch(/white-label resellers emit the same format/);
  });

  it("does not claim generic or partial shapes", () => {
    const d = (o: unknown, meta?: RecordMeta) => nmiAdapter.detect(o, meta).confidence;
    expect(d({ response: "1" }, formMeta)).toBe(0);
    expect(d({ status: "1" }, formMeta)).toBe(0);
    expect(d({ error: "x" }, jsonMeta)).toBe(0);
    expect(d({ status: "ok" }, jsonMeta)).toBe(0);
    expect(d({ response: "1", responsetext: "Approved" }, formMeta)).toBe(0);
    expect(d({ transactionid: "PPLsynth1", orderid: "PPLsynth-o", type: "sale" }, formMeta)).toBe(
      0,
    );
    // response + response_code alone are too generic to claim.
    expect(d({ response: "1", response_code: "100" }, formMeta)).toBe(0.3);
    // Provider names in values are never a signal.
    expect(d({ provider: "NMI", gateway: "nmi", message: "secure.nmi.com" }, formMeta)).toBe(0);
    // payabl. style records (transid, status, errormessage) are excluded.
    expect(
      d(
        {
          response: "1",
          responsetext: "x",
          avsresponse: "Y",
          response_code: "100",
          transid: "PPLsynth1",
        },
        formMeta,
      ),
    ).toBe(0);
    // A Classic key set copied as JSON is not the documented wire format.
    expect(
      d(
        { response: "2", responsetext: "DECLINE", avsresponse: "", response_code: "200" },
        jsonMeta,
      ),
    ).toBe(0);
    // Webhook-like envelopes need a dotted lowercase event_type and an object body.
    expect(d({ event_id: "x", event_type: "PAYMENT.CAPTURE.COMPLETED", event_body: {} })).toBe(0);
    expect(d({ event_id: "x", event_type: "transaction.sale.success", event_body: "x" })).toBe(0);
    expect(d({ event_id: "x", event_type: "transaction.sale.success", data: {} })).toBe(0);
    expect(d("response=1")).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
  });

  it("recognizes REST v5 and partner webhooks without analyzing them", () => {
    const rest = analyzeFixture("rest-validation-error.json");
    expect(rest.records[0]).toMatchObject({
      status: "unsupported",
      provider: "nmi",
      format: NMI_FORMATS.restError,
    });
    expect(rest.events).toEqual([]);
    const tx = nmiAdapter.detect(
      {
        object: "transaction",
        id: "PPLsynth1",
        response: "approved",
        response_text: "SUCCESS",
        response_code: "100",
        processor_id: "PPLsynthproc",
      },
      jsonMeta,
    );
    expect(tx).toMatchObject({ format: NMI_FORMATS.restTransaction, supported: false });
    const partner = nmiAdapter.detect(
      { event_id: "PPLsynth-p1", event_type: "merchant.chargeback.added", event_body: {} },
      jsonMeta,
    );
    expect(partner).toMatchObject({ format: NMI_FORMATS.partnerWebhook, supported: false });
    expect(partner.confidence).toBeLessThanOrEqual(0.6);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(nmiAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined) expect(nmiAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("returns confidence 0 for every other provider's fixture, form-encoded ones included", () => {
    const dirs = readdirSync(fixturePath("")).filter(
      (d) => d !== "nmi" && statSync(fixturePath(d)).isDirectory(),
    );
    // NETbilling, payabl. and Trust Payments send form-encoded data too.
    expect(dirs).toEqual(expect.arrayContaining(["netbilling", "payabl", "trust_payments"]));
    let forms = 0;
    for (const dir of dirs) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          if (meta?.format === "form" || meta?.format === "http") forms++;
          expect(nmiAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(nmiAdapter.detect(payload, meta).confidence, `${dir}/${file}`).toBe(0);
        });
      }
    }
    expect(forms).toBeGreaterThan(30);
  });

  it("is not out-scored or made ambiguous by the registered adapters on NMI fixtures", () => {
    for (const file of readdirSync(fixturePath("nmi"))) {
      const r = analyzeText(fixture(`nmi/${file}`), {
        ...options,
        adapters: ADAPTERS,
        rules: [],
      });
      expect(r.ok, file).toBe(true);
      if (!r.ok) continue;
      for (const rec of r.result.records) {
        expect(rec.provider, file).toBe("nmi");
        expect(rec.alternatives, file).toEqual([]);
      }
      expect(r.result.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
    }
  });
});

describe("nmi Classic Payment API responses", () => {
  it("normalizes an approved sale", () => {
    const r = analyzeFixture("classic-sale-approved.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: NMI_FORMATS.classic });
    expect(r.events[0]).toMatchObject({
      eventType: "transact.sale",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "response=1 response_code=100",
      paymentReference: "PPLsynth0000000001",
      merchantReference: "PPLsynth-order-0001",
    });
    // Classic responses carry no amount.
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      response: "1",
      responseCode: "100",
      authCode: "PPL123",
      avsResponse: "Y",
      avsMeaning: "Address and 5-digit ZIP match",
      cvvResponse: "M",
      cvvMeaning: "Match",
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("decodes the documented generic decline", () => {
    const r = analyzeFixture("classic-decline-generic.txt");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "200",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      providerMessage: "DECLINE",
      paymentReference: "PPLsynth0000000002",
      attemptReference: "PPLsynth0000000002",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.documentation[0]!.url).toBe(
      "https://docs.nmi.com/reference/response-codes",
    );
    expect(r.findings.map((f) => f.ruleId)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("mentions AVS and CVV mismatches on a decline only as possible factors", () => {
    const r = analyzeFixture("classic-decline-insufficient-funds.txt");
    expect(r.errors[0]).toMatchObject({
      code: "202",
      category: "insufficient_funds",
      retry: "customer_action_required",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({ avsresponse: "N", cvvresponse: "N" });
    const notes = r.errors[0]!.missingInformation.join(" ");
    expect(notes).toMatch(/CVV result is N .* may have contributed .* does not say so/);
    expect(notes).toMatch(/AVS result is N/);
    // The category is still the code's meaning, not fraud.
    expect(r.errors[0]!.category).not.toBe("fraud_or_risk");
  });

  it("decodes a gateway validation rejection with its REFID", () => {
    const r = analyzeFixture("classic-validation-error.txt");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    expect(r.events[0]!.attributes.refId).toBe("PPLsynth98765432");
    expect(r.errors[0]).toMatchObject({
      code: "300",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes.refid).toBe("PPLsynth98765432");
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/No transaction ID/);
  });

  it("decodes the rate-limit response without suggesting an immediate retry", () => {
    const r = analyzeFixture("classic-rate-limit.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "transact.response",
      eventTypeKnown: true,
      stage: "error",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({
      code: "301",
      category: "rate_limiting",
      retry: "retry_conditionally",
      providerMessage: "Rate limit exceeded",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/do not retry immediately/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://docs.nmi.com/reference/rate-limiting",
    );
  });

  it("decodes authentication and configuration failures", () => {
    const pin = analyze(classic({ response: "2", response_code: "226", responsetext: "Bad PIN" }));
    expect(pin.errors[0]).toMatchObject({
      code: "226",
      category: "authentication_failed",
      retry: "customer_action_required",
    });
    const config = analyze(
      classic({ response: "3", response_code: "410", transactionid: "", responsetext: "x" }),
    );
    expect(config.errors[0]).toMatchObject({
      code: "410",
      category: "configuration",
      retry: "do_not_retry",
      outcomeKnown: true,
    });
    const stolen = analyze(classic({ response: "2", response_code: "252" }));
    expect(stolen.errors[0]).toMatchObject({ category: "fraud_or_risk", retry: "do_not_retry" });
    const recurringStop = analyze(classic({ response: "2", response_code: "261" }));
    expect(recurringStop.errors[0]!.retryExplanation).toMatch(/stop scheduled charges/);
  });

  it("keeps the outcome unknown after a communication error and asks to verify first", () => {
    const r = analyzeFixture("classic-communication-error.txt");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "420",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Query API first/);
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual([
      "POSSIBLE_RETRY_RISK",
      "UNRESOLVED_OUTCOME",
    ]);
    const processor = analyze(classic({ response: "3", response_code: "400" }));
    expect(processor.events[0]!.outcome).toBe("unknown");
    expect(processor.errors[0]).toMatchObject({
      category: "provider_unavailable",
      outcomeKnown: false,
    });
  });

  it("handles the documented response=3 with response_code=100 inconsistency honestly", () => {
    const r = analyzeFixture("classic-plan-response3-code100.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "transact.add_plan",
      stage: "error",
      // response is read first; 100 does not make it a success.
      outcome: "unknown",
    });
    expect(r.events[0]!.attributes.responseCodeMismatch).toBe(true);
    expect(r.errors[0]).toMatchObject({
      code: "response=3",
      category: "unknown",
      retry: "retry_conditionally",
      confidence: "insufficient",
      outcomeKnown: false,
    });
    expect(r.errors[0]!.explanation).toMatch(/Failed to Create Plan/);
    expect(r.errors[0]!.explanation).toMatch(/does not treat the request as successful/);
    expect(classicOutcome("3", "100")).toBe("unknown");

    const declined = analyze(classic({ response: "2", response_code: "100" }));
    expect(declined.events[0]!.outcome).toBe("failure");
    expect(declined.errors[0]).toMatchObject({
      code: "response=2",
      category: "card_declined",
      confidence: "insufficient",
    });
    // response=1 stays approved; the conflict is shown, not turned into an error.
    const approved = analyze(classic({ response: "1", response_code: "200" }));
    expect(approved.events[0]!.outcome).toBe("success");
    expect(approved.events[0]!.attributes.responseCodeMismatch).toBe(true);
    expect(approved.errors).toEqual([]);
  });

  it("lowers confidence when response and response_code classes differ", () => {
    const r = analyze(classic({ response: "2", response_code: "300" }));
    expect(r.errors[0]).toMatchObject({ code: "300", confidence: "possible" });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/read response first/);
    const declineWithError = analyze(classic({ response: "3", response_code: "201" }));
    expect(declineWithError.events[0]!.outcome).toBe("failure");
    expect(declineWithError.errors[0]).toMatchObject({ code: "201", confidence: "possible" });
  });

  it("reports unrecognized codes and response values as unknown", () => {
    const code = analyze(classic({ response: "2", response_code: "299" }));
    expect(code.events[0]!.attributes.responseCodeKnown).toBe(false);
    expect(code.errors[0]).toMatchObject({
      code: "299",
      category: "card_declined",
      retry: "manual_review",
      confidence: "insufficient",
    });
    expect(code.errors[0]!.missingInformation.join(" ")).toMatch(/not in NMI's Result Code Table/);
    const error = analyze(classic({ response: "3", response_code: "499" }));
    expect(error.events[0]!.outcome).toBe("unknown");
    expect(error.errors[0]).toMatchObject({
      category: "unknown",
      retry: "retry_conditionally",
      confidence: "insufficient",
      outcomeKnown: false,
    });
    const value = analyze(
      form({
        response: "7",
        responsetext: "x",
        avsresponse: "",
        cvvresponse: "",
        response_code: "100",
      }),
    );
    expect(value.records[0]!.status).toBe("analyzed");
    expect(value.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(value.errors[0]).toMatchObject({
      code: "response=7",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const noCode = analyze(
      form({
        response: "2",
        responsetext: "x",
        avsresponse: "",
        cvvresponse: "",
        transactionid: "PPLsynth5",
      }),
    );
    expect(noCode.errors[0]).toMatchObject({ code: "response=2", confidence: "possible" });
    expect(analyze(classic({ type: "PPLsynth_new_type" })).events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
    });
  });

  it("shows merchant advice codes and processor details without interpreting them", () => {
    const r = analyze(
      classic({
        response: "2",
        response_code: "201",
        merchant_advice_code: "24",
        responsetext: "Do Not Honor",
      }),
    );
    expect(r.errors[0]!.subCodes.merchant_advice_code).toBe("24");
    expect(r.errors[0]!.retry).toBe("customer_action_required");
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/shown but not interpreted/);
  });

  it("reads the subscription id and flags a vault id only by presence", () => {
    const r = analyze(
      classic({
        type: "add_subscription",
        subscription_id: "PPLsynth-sub-9",
        customer_vault_id: "PPLsynthPlantedVaultId",
      }),
    );
    expect(r.events[0]).toMatchObject({
      stage: "subscription",
      subscriptionReference: "PPLsynth-sub-9",
    });
    expect(r.events[0]!.attributes.customerVaultIdPresent).toBe(true);
    expect(JSON.stringify(r.events)).not.toContain("PPLsynthPlantedVaultId");
  });

  it("accepts a repeated response_code with identical values and rejects conflicting copies", () => {
    const same = analyze(`${classic({ response: "2", response_code: "202" })}&response_code=202`);
    expect(same.records[0]!.status).toBe("analyzed");
    expect(same.errors[0]!.code).toBe("202");
    const conflict = analyze(
      `${classic({ response: "2", response_code: "202" })}&response_code=200`,
    );
    expect(conflict.records[0]!.status).toBe("invalid");
  });

  it("reports parse issues for missing required fields instead of throwing", () => {
    const r = analyze(
      form({
        responsetext: "DECLINE",
        avsresponse: "",
        cvvresponse: "",
        transactionid: "PPLsynth7",
        response_code: "200",
      }),
    );
    expect(r.records[0]).toMatchObject({ status: "invalid", format: NMI_FORMATS.classic });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^response:/);
    expect(r.events).toEqual([]);
  });

  it("fails cleanly on malformed input", () => {
    expect(analyzeText("response=1&responsetext", options).ok).toBe(false);
    expect(analyzeText('{"event_id": "x", "event_type": ', options).ok).toBe(false);
    expect(nmiAdapter.parse("x", NMI_FORMATS.classic).ok).toBe(false);
    expect(nmiAdapter.parse({}, "nmi.nope").ok).toBe(false);
    expect(nmiAdapter.parse({ response: ["1", "2"] }, NMI_FORMATS.classic).ok).toBe(false);
  });
});

describe("nmi webhooks", () => {
  it("normalizes a transaction webhook from the documented envelope", () => {
    const r = analyzeFixture("webhook-sale-success.json");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: NMI_FORMATS.webhook });
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.sale.success",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "condition=pendingsettlement",
      eventReference: "PPLsynth-evt-0001",
      deliveryKey: "PPLsynth-evt-0001|transaction.sale.success",
      paymentReference: "PPLsynth0000000020",
      merchantReference: "PPLsynth-order-0020",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
      amountMinor: "2495",
      currency: "USD",
    });
    expect(r.events[0]!.isRecurring).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      condition: "pendingsettlement",
      conditionKnown: true,
      transactionType: "cc",
      actionType: "sale",
      actionSuccess: true,
      responseCode: "100",
      processorResponseCode: "00",
      testMode: true,
      merchantId: "PPLsynth-merchant-1",
    });
    expect(r.errors).toEqual([]);
  });

  it("decodes a failed recurring charge as its own operation", () => {
    const r = analyzeFixture("webhook-sale-failure-recurring.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transaction.sale.failure",
      stage: "payment",
      outcome: "failure",
      isRecurring: true,
    });
    expect(r.errors[0]).toMatchObject({
      code: "202",
      category: "insufficient_funds",
      confidence: "strong",
      paymentReference: "PPLsynth0000000021",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.source.path).toBe("event_body.action");
    expect(r.errors[0]!.subCodes.processor_response_code).toBe("51");
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/publishes no table/);
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual([
      "PAYMENT_FAILURE",
      "RECURRING_PAYMENT_FAILED",
    ]);
  });

  it("keeps an unknown result unknown without suggesting a retry", () => {
    const r = analyzeFixture("webhook-sale-unknown.json");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      retry: "manual_review",
      outcomeKnown: false,
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/never resend blindly/);
    expect(r.findings.map((f) => f.ruleId)).toEqual(["UNRESOLVED_OUTCOME"]);
    const withCode = analyze(
      webhook("transaction.sale.unknown", txBody({}, { success: "0", response_code: "420" })),
    );
    expect(withCode.errors[0]).toMatchObject({
      code: "420",
      category: "network_or_timeout",
      outcomeKnown: false,
    });
    expect(withCode.findings.map((f) => f.ruleId)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("reads a raw HTTP webhook without trusting or copying its signature", () => {
    const text = fixture("nmi/webhook-capture-failure-http.txt");
    const r = analyze(text);
    expect(r.events[0]).toMatchObject({ stage: "capture", outcome: "failure" });
    expect(r.events[0]!.attributes.webhookSignature).toBe("present_not_verified");
    expect(r.errors[0]).toMatchObject({ code: "441", category: "invalid_request" });
    expect(r.findings.map((f) => f.ruleId)).toEqual(["PAYMENT_FAILURE"]);
    const out = JSON.stringify(r.events) + toJsonReport(r);
    expect(out).not.toContain("PPLsynthNonce01");
    expect(out).not.toContain("0123456789abcdef0123456789abcdef");
  });

  it("maps check, recurring, settlement, chargeback and account updater events to separate stages", () => {
    const check = analyzeFixture("webhook-check-return.json");
    expect(check.events[0]).toMatchObject({
      eventType: "transaction.check.status.return",
      stage: "reversal",
      outcome: "failure",
      paymentReference: "PPLsynth0000000060",
    });
    expect(check.errors[0]).toMatchObject({ category: "unknown", retry: "manual_review" });
    expect(check.errors[0]!.explanation).toMatch(/ACH \(check\) payment was returned/);

    const recurring = analyzeFixture("webhook-recurring-subscription.json");
    expect(recurring.events.map((e) => [e.eventType, e.stage, e.subscriptionReference])).toEqual([
      ["recurring.subscription.add", "subscription", "PPLsynth-sub-1"],
      ["recurring.subscription.delete", "cancellation", "PPLsynth-sub-1"],
    ]);
    expect(recurring.events.every((e) => e.paymentReference === undefined)).toBe(true);

    const chargeback = analyzeFixture("webhook-chargeback-batch.json");
    expect(chargeback.events[0]).toMatchObject({
      stage: "dispute",
      outcome: "unknown",
      eventTimestamp: "2026-10-24T00:00:00.000Z",
      deliveryKey: "PPLsynth-evt-0030|chargeback.batch.complete|PPLsynth-cb-1",
    });
    // A chargeback id is not documented as a transaction id, so it links nothing.
    expect(chargeback.events[0]!.paymentReference).toBeUndefined();
    expect(chargeback.events[0]!.amountMinor).toBeUndefined();
    expect(chargeback.events[0]!.attributes).toMatchObject({
      chargebackId: "PPLsynth-cb-1",
      chargebackReason: "101: Introductory chargeback",
      chargebackAmount: "24.95",
    });
    expect(chargeback.findings.map((f) => f.ruleId)).toContain("CHARGEBACK_REPORTED");

    const acu = analyze(webhook("acu.summary.contactcustomer", { merchant: { id: "PPLsynth-m" } }));
    expect(acu.events[0]).toMatchObject({ stage: "other", eventTypeKnown: true });
    expect(acu.events[0]!.attributes.informational).toBe(true);

    const failedBatch = analyze(
      webhook("settlement.batch.failure", { batch_id: "PPLsynth-b9", transaction_ids: [] }),
    );
    expect(failedBatch.events[0]).toMatchObject({ stage: "settlement", outcome: "failure" });
    expect(failedBatch.errors[0]).toMatchObject({ category: "unknown", retry: "manual_review" });
    expect(failedBatch.errors[0]!.subCodes.batch_id).toBe("PPLsynth-b9");
  });

  it("keeps undocumented event types and contradictory events honest", () => {
    const odd = analyze(webhook("transaction.sale.pplsynthnew", txBody()));
    expect(odd.records[0]!.status).toBe("analyzed");
    expect(odd.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      paymentReference: "PPLsynth0000000901",
    });
    expect(odd.findings.map((f) => f.ruleId)).toContain("UNKNOWN_EVENT_TYPE");
    const other = analyze(webhook("pplsynth.thing.happened", { a: 1 }));
    expect(other.events[0]).toMatchObject({ eventTypeKnown: false, stage: "other" });
    const contradiction = analyze(
      webhook("transaction.sale.success", txBody({}, { success: "0" })),
    );
    expect(contradiction.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
    const failedWith100 = analyze(webhook("transaction.sale.failure", txBody()));
    expect(failedWith100.events[0]!.outcome).toBe("failure");
    expect(failedWith100.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
    expect(failedWith100.errors[0]!.explanation).toMatch(/cannot be trusted alone/);
    const undocumentedCode = analyze(
      webhook("transaction.auth.failure", txBody({}, { success: "0", response_code: "999" })),
    );
    expect(undocumentedCode.errors[0]).toMatchObject({ code: "999", confidence: "insufficient" });
  });

  it("does not use an undocumented action.date format as event time", () => {
    const r = analyze(
      webhook("transaction.sale.success", txBody({}, { date: "2026-10-20 10:00" })),
    );
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.actionDate).toBe("2026-10-20 10:00");
  });

  it("does not convert amounts without a currency", () => {
    const r = analyze(webhook("transaction.sale.success", txBody({ currency: undefined })));
    expect(r.events[0]!.amountMinor).toBeUndefined();
  });

  it("reports a repeated delivery by event_id and event_type", () => {
    const r = analyzeFixture("webhook-duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).toMatch(/event_id together with event_type/);
    expect(dup!.explanation).not.toMatch(/documents that it can deliver/);
  });

  it("does not call different events that reuse one event_id duplicates", () => {
    // NMI's own samples reuse one event_id for an auth success and an auth failure.
    const r = analyzeMany(
      webhook("transaction.auth.success", txBody(), "PPLsynth-evt-shared"),
      webhook(
        "transaction.auth.failure",
        txBody({ transaction_id: "PPLsynth0000000902" }, { success: "0", response_code: "200" }),
        "PPLsynth-evt-shared",
      ),
    );
    const ids = r.findings.map((f) => f.ruleId);
    expect(ids).not.toContain("DUPLICATE_DELIVERY");
    expect(ids).not.toContain("CONFLICTING_OBSERVATIONS");
  });

  it("reports parse issues for a transaction event without transaction_id", () => {
    const body: Record<string, unknown> = txBody();
    delete body.transaction_id;
    const r = analyze(webhook("transaction.sale.success", body));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: NMI_FORMATS.webhook });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^event_body\.transaction_id:/);
    const badEnvelope = nmiAdapter.parse(
      { event_id: "", event_type: "transaction.sale.success", event_body: {} },
      NMI_FORMATS.webhook,
    );
    expect(badEnvelope.ok).toBe(false);
    const badSettlement = analyze(
      webhook("settlement.batch.complete", { transaction_ids: "PPLsynth1" }),
    );
    expect(badSettlement.records[0]!.status).toBe("invalid");
  });
});

describe("nmi correlation and timeline", () => {
  it("groups an authorization, its capture, void and settlement by transaction id", () => {
    const r = analyzeMany(
      fixture("nmi/webhook-auth-capture-refund.json"),
      fixture("nmi/webhook-settlement-batch.json"),
      fixture("nmi/classic-auth-approved.txt"),
      fixture("nmi/classic-capture-approved-http.txt"),
    );
    const group = r.groups.find((g) => g.references.includes("PPLsynth0000000030"));
    expect(group).toBeDefined();
    const events = r.events.filter((e) => group!.eventIds.includes(e.id));
    expect(events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        "transaction.auth.success",
        "transaction.capture.success",
        "settlement.batch.complete",
      ]),
    );
    // Capture is not settlement: the capture keeps its own stage.
    expect(events.find((e) => e.eventType === "transaction.capture.success")!.stage).toBe(
      "capture",
    );
    const classicGroup = r.groups.find((g) => g.references.includes("PPLsynth0000000010"));
    expect(classicGroup!.eventIds).toHaveLength(2);
    // The refund has a new id and no parent field, so it stays apart.
    const refund = r.events.find((e) => e.eventType === "transaction.refund.success")!;
    expect(group!.eventIds).not.toContain(refund.id);
    expect(r.findings.map((f) => f.ruleId)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("expands a settlement batch into one event per transaction", () => {
    const r = analyzeFixture("webhook-settlement-batch.json");
    expect(r.events.map((e) => [e.paymentReference, e.stage, e.outcome])).toEqual([
      ["PPLsynth0000000020", "settlement", "success"],
      ["PPLsynth0000000030", "settlement", "success"],
    ]);
    expect(new Set(r.events.map((e) => e.deliveryKey)).size).toBe(2);
    expect(r.events[1]!.source.path).toBe("event_body.transaction_ids[1]");
    expect(r.events[0]!.attributes).toMatchObject({
      batchId: "PPLsynth-batch-1",
      batchTransactionCount: 2,
    });
    expect(r.findings.map((f) => f.ruleId)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("keeps unrelated transactions apart and never joins by order id", () => {
    const r = analyzeMany(
      fixture("nmi/classic-sale-approved.txt"),
      classic({ transactionid: "PPLsynth0000000950", orderid: "PPLsynth-order-0001" }),
      fixture("nmi/classic-decline-generic.txt"),
      fixture("nmi/webhook-sale-success.json"),
    );
    expect(r.groups).toHaveLength(4);
    const e = r.events.find((x) => x.paymentReference === "PPLsynth0000000950")!;
    expect(nmiAdapter.correlationKeys(e)).toEqual(["PPLsynth0000000950"]);
  });
});

describe("nmi catalogs", () => {
  it("has the documented number of entries", () => {
    expect(Object.keys(RESPONSE_VALUES)).toEqual(["1", "2", "3"]);
    expect(Object.keys(RESPONSE_CODES)).toHaveLength(35);
    expect(Object.values(RESPONSE_CODES).filter((c) => !c.error)).toHaveLength(1);
    expect(RESPONSE_CODES["301"]!.source).toBe("https://docs.nmi.com/reference/rate-limiting");
    expect(Object.keys(AVS_CODES)).toHaveLength(28);
    expect(AVS_CODES.B).toMatch(/Ambiguous/);
    expect(Object.keys(CVV_CODES).sort()).toEqual(["M", "N", "P", "S", "U"]);
    expect(Object.keys(CONDITIONS)).toHaveLength(8);
    expect(Object.keys(TRANSACTION_TYPES)).toHaveLength(16);
    expect(Object.keys(WEBHOOK_EVENT_TYPES)).toHaveLength(36);
  });

  it("maps response codes to the research's suggested categories", () => {
    const cat = (c: string) => RESPONSE_CODES[c]!.error;
    expect(cat("264")).toMatchObject({ category: "card_declined", retry: "retry_conditionally" });
    expect(cat("420")).toMatchObject({ category: "network_or_timeout", outcome: "unknown" });
    expect(cat("430")).toMatchObject({ category: "duplicate_request", retry: "do_not_retry" });
    expect(cat("461")).toMatchObject({ category: "payment_method_unavailable" });
    for (const info of Object.values(RESPONSE_CODES)) {
      if (!info.error) continue;
      // Never a blind retry.
      expect(info.error.retry).not.toBe("safe_to_retry_technical_request");
    }
  });

  it("uses own-property lookups for untrusted codes", () => {
    expect(
      analyze(classic({ response: "2", response_code: "100", type: "constructor" })).events[0],
    ).toMatchObject({ eventTypeKnown: false });
    expect(classicOutcome("toString", undefined)).toBe("unknown");
  });
});

describe("nmi redaction", () => {
  const planted = [
    "4000000000000002",
    "411111******1111",
    "PPLsynthPlantedCvv",
    "PPLsynthPlantedFirst",
    "PPLsynthPlantedLast",
    "PPLsynth Planted Street",
    "planted@pplsynth.example",
    "5550001111",
    "PPLsynthPlantedShipName",
    "PPLsynthPlantedCavvValue",
    "PPLsynthPlantedMerchantField",
    "PPLsynth Planted Merchant Name",
    "PPLsynthPlantedCustomerName",
    "PPLsynthPlantedAccount",
    "PPLsynthPlantedAba",
    "PPLsynthPlantedHash",
    "PPLsynthPlantedSecurityKey",
    "PPLsynthPlantedVaultId",
    "PPLsynthPlantedEmv",
    "198.51.100.77",
    "PPLsynthNonce01",
  ];

  it("keeps card, bank, personal, credential and signature data out of events and reports", () => {
    const r = analyzeMany(
      fixture("nmi/webhook-sale-success.json"),
      fixture("nmi/webhook-capture-failure-http.txt"),
      fixture("nmi/webhook-chargeback-batch.json"),
      fixture("nmi/webhook-check-return.json"),
      classic({
        response: "2",
        response_code: "225",
        ccnumber: "4000000000000002",
        cvv: "PPLsynthPlantedCvv",
        security_key: "PPLsynthPlantedSecurityKey",
        customer_vault_id: "PPLsynthPlantedVaultId",
        emv_auth_response_data: "PPLsynthPlantedEmv",
        ip_address: "198.51.100.77",
        email: "planted@pplsynth.example",
        first_name: "PPLsynthPlantedFirst",
      }),
    );
    expect(r.events.length).toBeGreaterThanOrEqual(5);
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
  });
});

describe("nmi manifest", () => {
  it("is honest about its capabilities and research", () => {
    expect(nmiDefault).toBe(nmiAdapter);
    expect(nmiAdapter.version).toBe(NMI_ADAPTER_VERSION);
    expect(nmiManifest).toMatchObject({
      id: "nmi",
      displayName: "NMI",
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      categories: ["gateway"],
    });
    expect(nmiManifest.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "supported",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "limited",
      diagnosticRules: "limited",
    });
    expect(nmiManifest.delivery).toMatchObject({
      duplicatesDocumented: false,
      ordering: "not_documented",
    });
    expect(nmiManifest.sectors).toHaveLength(10);
    for (const s of nmiManifest.sectors)
      expect(s.source).toBe("https://www.nmi.com/who-we-serve/other-industries/");
    // NMI documents no high-risk sector.
    const sectors = nmiManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ");
    for (const word of ["adult", "gaming", "gambling", "cbd", "crypto", "nutraceutical", "dating"])
      expect(sectors).not.toContain(word);
    expect(nmiManifest.fixtureProvenance).toMatch(/[Ss]ynthetic/);
    expect(nmiManifest.limitations.join(" ")).toMatch(/white/i);
    expect(nmiManifest.limitations.join(" ")).toMatch(/Failed to Create Plan/);
    const families = Object.fromEntries(nmiManifest.apiFamilies.map((f) => [f.id, f.status]));
    expect(families).toMatchObject({
      "nmi.classic.response": "supported",
      "nmi.webhook": "limited",
      "nmi.rest.error": "unsupported",
    });
  });

  it("contains no en or em dash in sources, tests or fixtures", () => {
    const files = [
      ...["catalog.ts", "index.ts", "manifest.ts"].map((f) =>
        fileURLToPath(new URL(`../src/${f}`, import.meta.url)),
      ),
      fileURLToPath(import.meta.url),
      ...readdirSync(fixturePath("nmi")).map((f) => fixturePath(`nmi/${f}`)),
    ];
    const dashes = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const dash of dashes) expect(text.includes(dash), file).toBe(false);
    }
  });

  it("uses PPLsynth identifiers in fixtures", () => {
    for (const file of readdirSync(fixturePath("nmi"))) {
      const text = fixture(`nmi/${file}`);
      // The rate-limit and REST error documentation shapes carry no identifiers.
      if (file === "classic-rate-limit.txt" || file === "rest-validation-error.json") continue;
      expect(text, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});
