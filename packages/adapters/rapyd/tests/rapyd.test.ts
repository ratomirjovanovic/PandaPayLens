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
import {
  CATALOG_COUNTS,
  DISPUTE_STATUSES,
  ERROR_CODES,
  EVENT_TYPES,
  MERCHANT_ADVICE_CODES,
  NETWORK_CODES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  RAPYD_ADAPTER_VERSION,
  REFUND_STATUSES,
  SECTIONS,
  WALLET_EVENT_TYPES,
  codeKey,
  rapydAdapter,
  rapydManifest,
  splitCode,
} from "@pandapaylens/rapyd";
import defaultExport from "@pandapaylens/rapyd";
import { rapydManifest as manifestOnly } from "@pandapaylens/rapyd/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [rapydAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (name: string) => analyze(fixture(`rapyd/${name}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const OP = "PPLsynth-0000-4000-a000-000000009001";
const T = 1792000000;

const ok = (operation_id = OP) => ({
  error_code: "",
  status: "SUCCESS",
  message: "",
  response_code: "",
  operation_id,
});
const fail = (code: string, fields: Record<string, unknown> = {}) => ({
  status: {
    error_code: code,
    status: "ERROR",
    message: "Synthetic message. Corrective action: none.",
    response_code: code,
    operation_id: OP,
  },
  ...fields,
});

const payment = (fields: Record<string, unknown> = {}) => ({
  id: "payment_PPLsynth00000000000000009001",
  amount: 12.5,
  currency_code: "USD",
  status: "CLO",
  paid: true,
  captured: true,
  created_at: T,
  paid_at: T + 2,
  next_action: "not_applicable",
  payment_method_type: "us_visa_card",
  payment_method_type_category: "card",
  error_code: "",
  failure_code: "",
  failure_message: "",
  merchant_reference_id: "PPLsynth-order-9001",
  ...fields,
});

const payout = (fields: Record<string, unknown> = {}) => ({
  id: "payout_PPLsynth00000000000000009001",
  payout_method_type: "us_general_bank",
  payout_amount: 100,
  payout_currency: "USD",
  status: "Created",
  created_at: T,
  error: null,
  gc_error_code: "",
  ...fields,
});

const refund = (fields: Record<string, unknown> = {}) => ({
  id: "refund_PPLsynth00000000000000009001",
  payment: "payment_PPLsynth00000000000000009001",
  amount: 5,
  currency: "USD",
  status: "Completed",
  failure_reason: "",
  created_at: T + 50,
  updated_at: T + 50,
  ...fields,
});

const webhook = (type: string, data: unknown, fields: Record<string, unknown> = {}) => ({
  id: "wh_PPLsynth00000000000000009001",
  type,
  data,
  trigger_operation_id: OP,
  status: "NEW",
  created_at: T + 10,
  extended_timestamp: (T + 10) * 1000,
  ...fields,
});

const firstError = (input: unknown, extra?: Partial<AnalyzeOptions>) =>
  analyze(json(input), extra).errors[0]!;
const firstEvent = (input: unknown) => analyze(json(input)).events[0]!;

describe("rapyd detection", () => {
  it.each([
    ["rest-payment-closed.json", "rapyd.api_response", 0.9],
    ["rest-card-declined-insufficient-funds.json", "rapyd.api_response", 0.8],
    ["rest-create-payment-error-3ds-required.json", "rapyd.api_response", 0.9],
    ["http-401-unauthenticated.txt", "rapyd.api_response", 0.8],
    ["rest-refund-completed.json", "rapyd.api_response", 0.9],
    ["rest-payout-created.json", "rapyd.api_response", 0.9],
    ["webhook-refund-updated-api-record.json", "rapyd.api_response", 0.9],
    ["webhook-payment-completed.json", "rapyd.webhook", 0.95],
    ["webhook-payment-failed.json", "rapyd.webhook", 0.95],
    ["webhook-payout-failed.json", "rapyd.webhook", 0.95],
    ["webhook-refund-delivery-record.json", "rapyd.webhook", 0.9],
    ["webhook-wrapper-dispute-created.json", "rapyd.webhook", 0.98],
    ["webhook-lenient-json.txt", "rapyd.webhook", 0.95],
  ])("recognizes %s", (file, format, confidence) => {
    const r = analyzeFixture(file);
    expect(r.records[0]).toMatchObject({ status: "analyzed", format, confidence });
  });

  it("recognizes wallet transfers without analyzing them", () => {
    for (const [file, format] of [
      ["rest-wallet-transfer-pending.json", "rapyd.wallet_transfer"],
      ["webhook-wallet-transfer-created.json", "rapyd.wallet_webhook"],
    ]) {
      const r = analyzeFixture(file!);
      expect(r.records[0]).toMatchObject({ status: "unsupported", provider: "rapyd", format });
      expect(r.events).toHaveLength(0);
      expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(/wallet/i);
    }
    for (const type of WALLET_EVENT_TYPES) {
      const d = rapydAdapter.detect(webhook(type, { id: "PPLsynth-transfer-1", status: "PEN" }));
      expect(d, type).toMatchObject({ format: "rapyd.wallet_webhook", supported: false });
    }
  });

  it("keeps a wallet transfer error response analyzable", () => {
    const r = analyze(
      json(
        fail("ERROR_WALLET_INSUFFICIENT_FUNDS", {
          data: { source_ewallet_id: "ewallet_PPLsynth1", status: "PEN" },
        }),
      ),
    );
    expect(r.records[0]!.format).toBe("rapyd.api_response");
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_WALLET_INSUFFICIENT_FUNDS",
      category: "insufficient_funds",
      retry: "retry_conditionally",
    });
  });

  it("needs operation_id before claiming a status object", () => {
    const input = {
      status: { error_code: "ERROR_GET_PAYMENT", status: "ERROR", message: "", response_code: "" },
    };
    const d = rapydAdapter.detect(input);
    expect(d.confidence).toBeGreaterThan(0);
    expect(d.confidence).toBeLessThan(0.5);
    expect(analyze(json(input)).records[0]!.status).toBe("unsupported");
    const chosen = analyze(json(input), { provider: "rapyd" });
    expect(chosen.errors[0]).toMatchObject({ code: "ERROR_GET_PAYMENT", confidence: "strong" });
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "rapyd", message: "Rapyd error" },
      "rapyd",
      null,
      [],
      { status: "ERROR" },
      { status: "SUCCESS", error_code: "ERROR_GET_PAYMENT" },
      { error: { code: "ERROR_GET_PAYMENT" } },
      { status: { status: "ERROR" } },
      { status: { code: 400, message: "Bad request" } },
      { id: "payment_PPLsynth00000000000000000001", status: "CLO" },
      { id: "evt_PPLsynth1", type: "PAYMENT_COMPLETED", data: {} },
      { id: "wh_PPLsynth1", type: "PAYMENT_COMPLETED", data: "x" },
      {
        object: "event",
        id: "wh_PPLsynth00000000000000000001",
        type: "PAYMENT_COMPLETED",
        data: {},
      },
      {
        object: "payment_intent",
        status: { error_code: "", status: "SUCCESS", response_code: "", operation_id: OP },
      },
      { type: "PAYMENT_COMPLETED", data: { id: "payment_PPLsynth00000000000000000001" } },
    ]) {
      expect(rapydAdapter.detect(input).confidence, json(input)).toBe(0);
    }
    // A wh_ id with a known type but nothing else stays below the threshold.
    const thin = { id: "wh_PPLsynth1", type: "PAYMENT_COMPLETED", data: {} };
    expect(rapydAdapter.detect(thin).confidence).toBeLessThan(0.5);
  });

  it("ignores form-encoded input", () => {
    const parsed = parseInput("status=ERROR&error_code=ERROR_GET_PAYMENT&operation_id=PPLsynth1");
    if (!parsed.ok) throw new Error("parse failed");
    expect(rapydAdapter.detect(parsed.value.records[0], parsed.value.meta[0]).confidence).toBe(0);
    expect(rapydAdapter.detect({ status: ok() }, { format: "form" }).confidence).toBe(0);
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "rapyd" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );
  const records = (dir: string) => {
    const out: {
      name: string;
      payload: unknown;
      meta: Parameters<typeof rapydAdapter.detect>[1];
    }[] = [];
    for (const file of readdirSync(`${root}${dir}`)) {
      if (!statSync(`${root}${dir}/${file}`).isFile()) continue;
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

  it("includes the Stripe and Adyen fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "checkout", "nuvei"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const list = records(dir);
    for (const r of list) expect(rapydAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
  });
});

describe("rapyd parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noStatus = { status: { ...ok(), status: undefined }, data: payment() };
    const r = analyze(json(noStatus));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "rapyd.api_response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status\.status/);

    const noType = webhook("PAYMENT_COMPLETED", payment());
    delete (noType as Record<string, unknown>).type;
    const w = analyze(json(noType));
    expect(w.records[0]).toMatchObject({ status: "invalid", format: "rapyd.webhook" });
    expect(w.records[0]!.reasons.join(" ")).toMatch(/type/);

    const wrapped = analyze(json({ method: "POST", headers: {}, body: { ...noType, type: 42 } }));
    expect(wrapped.records[0]!.reasons.join(" ")).toMatch(/^body\.type/);
  });

  it("rejects unknown formats", () => {
    expect(rapydAdapter.parse({}, "rapyd.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported Rapyd format "rapyd.unknown".'],
    });
  });

  it("fails cleanly on malformed JSON and accepts trailing commas with a warning", () => {
    // One of Rapyd's payout samples merges two lines; such input is not repaired.
    const broken = analyzeText(
      '{"id": "wh_PPLsynth00000000000000000001", "data": {"merchant_reference_id": "PPLsynth-1uetr": null}}',
      options,
    );
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error.code).toBe("INVALID_JSON");

    const lenient = analyzeFixture("webhook-lenient-json.txt");
    expect(lenient.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
    expect(lenient.events[0]).toMatchObject({
      eventType: "PAYOUT_COMPLETED",
      stage: "payout",
      outcome: "success",
      amountMinor: "25000",
      currency: "GBP",
    });
  });

  it("tolerates nulls, numeric codes and unknown fields", () => {
    const r = analyze(
      json({
        status: { ...fail("x").status, error_code: null, response_code: null, message: null },
        data: payment({
          status: "ERR",
          error_code: 51,
          failure_code: 51,
          merchant_advice_code: 1,
          extra: { nested: [1, 2] },
          amount: "12.50",
        }),
      }),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({ amountMinor: "1250", outcome: "failure" });
    // A bare number in error_code is not a string code; failure_code 51 is read
    // only next to ERROR_PROCESSING_CARD.
    expect(r.errors[0]).toMatchObject({ code: "51", confidence: "insufficient" });
    expect(r.errors[0]!.subCodes).toMatchObject({ merchant_advice_code: "01" });
  });

  it("splits appended network codes and field names", () => {
    expect(splitCode("ERROR_PROCESSING_CARD - [51]")).toEqual({
      base: "ERROR_PROCESSING_CARD",
      suffix: "51",
    });
    expect(splitCode("ERROR_CHECKOUT_AFT_MISSING_FIELDS_[first_name]")).toEqual({
      base: "ERROR_CHECKOUT_AFT_MISSING_FIELDS",
      suffix: "first_name",
    });
    expect(splitCode("ERROR_PAYOUT_SENDER_FIELDS_LENGTH_ABOVE_MAX [NAME, CITY]")).toEqual({
      base: "ERROR_PAYOUT_SENDER_FIELDS_LENGTH_ABOVE_MAX",
      suffix: "NAME, CITY",
    });
    expect(splitCode("ERROR_PROCESSING_CARD - <code>")).toEqual({ base: "ERROR_PROCESSING_CARD" });
    expect(splitCode("  INVALID_FIELDS ")).toEqual({ base: "INVALID_FIELDS" });
    expect(codeKey("ERROR_CREATE_PAYMENT_BANK _TRANSFER_MANDATE_INCOMPLETE")).toBe(
      "ERROR_CREATE_PAYMENT_BANK_TRANSFER_MANDATE_INCOMPLETE",
    );
    // Bounded work on long or odd input.
    expect(splitCode(`${"A".repeat(5000)} - [${"9".repeat(500)}`).base.length).toBe(256);
  });
});

describe("rapyd REST responses", () => {
  it("analyzes a closed card payment", () => {
    const r = analyzeFixture("rest-payment-closed.json");
    expect(r.errors).toHaveLength(0);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "payment.CLO",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "CLO",
      paymentReference: "payment_PPLsynth00000000000000000101",
      merchantReference: "PPLsynth-order-101",
      amountMinor: "4011",
      currency: "EUR",
      eventTimestamp: new Date((T + 5) * 1000).toISOString(),
      attributes: {
        objectType: "payment",
        paymentMethodType: "gb_visa_card",
        captured: true,
        envelopeStatus: "SUCCESS",
        operationId: "PPLsynth-0000-4000-a000-000000000101",
      },
    });
    expect(r.findings).toHaveLength(0);
  });

  it("separates authorization, 3DS and asynchronous payments", () => {
    const auth = firstEvent({
      status: ok(),
      data: payment({
        status: "ACT",
        next_action: "pending_capture",
        paid: false,
        captured: false,
      }),
    });
    expect(auth).toMatchObject({ stage: "authorization", outcome: "success" });

    const threeDs = analyze(
      json({ status: ok(), data: payment({ status: "ACT", next_action: "3d_verification" }) }),
    );
    expect(threeDs.events[0]).toMatchObject({ stage: "authentication", outcome: "pending" });
    expect(ruleIds(threeDs)).toContain("UNRESOLVED_OUTCOME");

    const cash = firstEvent({
      status: ok(),
      data: payment({ status: "ACT", next_action: "pending_confirmation" }),
    });
    expect(cash).toMatchObject({ stage: "payment", outcome: "pending" });

    for (const [status, stage, outcome] of [
      ["CAN", "cancellation", "success"],
      ["EXP", "payment", "failure"],
      ["REV", "reversal", "success"],
    ]) {
      expect(firstEvent({ status: ok(), data: payment({ status }) })).toMatchObject({
        stage,
        outcome,
      });
    }
    const odd = firstEvent({ status: ok(), data: payment({ status: "PPLsynthUNKNOWN" }) });
    expect(odd).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
  });

  it("decodes a card network decline", () => {
    const r = analyzeFixture("rest-card-declined-insufficient-funds.json");
    expect(r.events[0]).toMatchObject({
      eventType: "api_error",
      stage: "error",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_PROCESSING_CARD",
      subCodes: { field: "status.error_code", network_code: "51" },
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      attemptReference: "PPLsynth-0000-4000-a000-000000000102",
    });
    expect(r.errors[0]!.providerMessage).toMatch(/^\[Insufficient Funds\]/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://docs.rapyd.net/en/card-network-errors.html",
    );
  });

  it("decodes a Create Payment error with the failed payment in data", () => {
    const r = analyzeFixture("rest-create-payment-error-3ds-required.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "payment.ERR",
      stage: "payment",
      outcome: "failure",
      amountMinor: "0",
      currency: "ISK",
      attributes: { failureCode: "65", merchantAdviceCode: "02", threeDsResult: "N" },
    });
    expect(r.errors).toHaveLength(1);
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "ERROR_PROCESSING_CARD",
      subCodes: { network_code: "65", merchant_advice_code: "02" },
      category: "authentication_required",
      // Advice code 02 (try again later) does not loosen the issuer's request for 3DS.
      retry: "customer_action_required",
      paymentReference: "payment_PPLsynth00000000000000000103",
      outcomeKnown: true,
    });
    expect(e.retryExplanation).toMatch(/Merchant advice code 02: Try again later/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("matches a Create Payment error with its PAYMENT_FAILED webhook", () => {
    const r = analyzeSources(
      [
        {
          name: "response.json",
          text: fixture("rapyd/rest-create-payment-error-3ds-required.json"),
        },
        { name: "webhook.json", text: fixture("rapyd/webhook-payment-failed.json") },
      ],
      options,
    );
    if (!r.ok) throw new Error("analysis failed");
    expect(r.result.groups).toHaveLength(1);
    expect(r.result.errors).toHaveLength(2);
    expect(new Set(r.result.errors.map((e) => e.attemptReference)).size).toBe(1);
    expect(ruleIds(r.result)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes validation errors with the appended field name", () => {
    const r = analyzeFixture("rest-validation-missing-field.json");
    expect(r.errors[0]).toMatchObject({
      code: "MISSING_PAYMENT_METHOD_REQUIRED_FIELD",
      subCodes: { detail: "EXPIRATION_MONTH" },
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    const checkout = firstError(fail("ERROR_CHECKOUT_AFT_MISSING_FIELDS_[first_name]"));
    expect(checkout).toMatchObject({
      code: "ERROR_CHECKOUT_AFT_MISSING_FIELDS",
      subCodes: { detail: "first_name" },
      confidence: "strong",
    });
  });

  it("decodes an authentication failure from a raw HTTP response", () => {
    const r = analyzeFixture("http-401-unauthenticated.txt");
    expect(r.events[0]!.attributes.httpStatus).toBe(401);
    expect(r.errors[0]).toMatchObject({
      code: "UNAUTHENTICATED_API_CALL",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(r.errors[0]!.documentation[0]!.url).toMatch(
      /troubleshooting-authentication-and-authorization-errors/,
    );
  });

  it("shows both codes at lower confidence when error_code and response_code differ", () => {
    const r = analyzeFixture("rest-error-code-mismatch.json");
    expect(r.errors.map((e) => [e.code, e.subCodes.field, e.confidence])).toEqual([
      ["IMMUTABLE_FIELD", "status.error_code", "possible"],
      ["ERROR_INVALID_PARAMETER_VALUE", "status.response_code", "possible"],
    ]);
    for (const e of r.errors)
      expect(e.missingInformation.join(" ")).toMatch(/error_code and response_code differ/);
    expect(r.events[0]!.attributes).toMatchObject({
      errorCode: "IMMUTABLE_FIELD",
      responseCode: "ERROR_INVALID_PARAMETER_VALUE",
    });
    // The same code with different spacing is not a mismatch.
    const same = analyze(
      json({
        status: {
          ...fail("x").status,
          error_code: "ERROR_PROCESSING_CARD - [05]",
          response_code: "ERROR_PROCESSING_CARD -  [05]",
        },
      }),
    );
    expect(same.errors).toHaveLength(1);
    expect(same.errors[0]!.confidence).toBe("strong");
  });

  it("is honest about unrecognized codes", () => {
    const r = analyzeFixture("rest-unknown-error-code.json");
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_PPLSYNTH_NOT_IN_CATALOG",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in Rapyd's documented/);

    const limited = analyze(
      `HTTP/1.1 429 Too Many Requests\nContent-Type: application/json\n\n${json(fail("PPLSYNTH_UNLISTED"))}`,
    );
    expect(limited.errors[0]).toMatchObject({
      category: "rate_limiting",
      retry: "retry_conditionally",
      confidence: "possible",
    });

    const empty = firstError({ status: { ...fail("").status, response_code: "" } });
    expect(empty).toMatchObject({ code: "ERROR", category: "unknown", confidence: "insufficient" });
  });

  it("flags an unknown outcome when the gateway did not respond", () => {
    const r = analyzeFixture("rest-gateway-not-responding.json");
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_CREATE_PAYMENT_GATEWAY_NOT_RESPONDING",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.explanation).toMatch(/sandbox/);
    expect(r.errors[0]!.retryExplanation).toMatch(/First check the current state/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("shows every meaning of a code that Rapyd documents twice", () => {
    const e = firstError(fail("ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION"));
    expect(e).toMatchObject({
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(e.explanation).toMatch(/2 different meanings/);
    // Same category and retry in several tables: one confident answer.
    const shared = firstError(fail("ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS"));
    expect(shared).toMatchObject({ category: "invalid_request", confidence: "strong" });
    expect(shared.documentation.length).toBeGreaterThan(1);
  });

  it("decodes card network codes that have several rows with care", () => {
    const n76 = firstError(fail("ERROR_PROCESSING_CARD - [76]"));
    expect(n76).toMatchObject({ confidence: "possible", retry: "manual_review" });
    expect(n76.explanation).toMatch(/Unsolicited reversal/);
    const n81 = firstError(fail("ERROR_PROCESSING_CARD - [81]"));
    expect(n81.explanation).toMatch(/Mastercard row/);
    expect(n81.confidence).toBe("possible");
    const success = firstError(fail("ERROR_PROCESSING_CARD - [00]"));
    expect(success).toMatchObject({ category: "unknown", confidence: "possible" });
    expect(success.explanation).toMatch(/success or partial approval/);
    const eligibility = firstError(fail("ERROR_PROCESSING_CARD - [OH]"));
    expect(eligibility.explanation).toMatch(/eligibility table for payouts/);
    const grouped = firstError(fail("ERROR_PROCESSING_CARD - [W2]"));
    expect(grouped).toMatchObject({ category: "network_or_timeout", confidence: "strong" });
    const unknownNet = firstError(fail("ERROR_PROCESSING_CARD - [ZZ]"));
    expect(unknownNet).toMatchObject({ retry: "unknown", confidence: "possible" });
    expect(unknownNet.missingInformation.join(" ")).toMatch(/not in Rapyd's card network tables/);
    const noNet = firstError(fail("ERROR_PROCESSING_CARD"));
    expect(noNet.missingInformation.join(" ")).toMatch(/No card network code/);
  });

  it("lets merchant advice codes only tighten retry guidance", () => {
    const declined = (advice: string) =>
      firstError({
        status: ok(),
        data: payment({
          status: "ERR",
          error_code: "ERROR_PROCESSING_CARD - [05]",
          failure_code: "05",
          merchant_advice_code: advice,
        }),
      });
    expect(declined("01")).toMatchObject({ retry: "do_not_retry" });
    expect(declined("09").retry).toBe("customer_action_required");
    expect(declined("09").retryExplanation).toMatch(/only after 24 hours/);
    expect(declined("15").retryExplanation).toMatch(/informational/);
    expect(declined("PPLsynth").missingInformation.join(" ")).toMatch(/not documented/);
    const timeout = declined("01");
    expect(timeout.documentation.map((d) => d.url)).toContain(
      "https://docs.rapyd.net/en/merchant-advice-codes.html",
    );
  });

  it("reads failure_code alone as a network code only with possible confidence", () => {
    const e = firstError({
      status: ok(),
      data: payment({ status: "ERR", error_code: "", failure_code: "05" }),
    });
    expect(e).toMatchObject({ code: "05", category: "card_declined", confidence: "possible" });
    const bare = firstError({ status: ok(), data: payment({ status: "ERR", error_code: "" }) });
    expect(bare).toMatchObject({ code: "ERR", confidence: "insufficient", outcomeKnown: true });
  });

  it("accepts bank transfer codes printed with a space and without it", () => {
    for (const code of [
      "ERROR_CREATE_PAYMENT_BANK _TRANSFER_MANDATE_INCOMPLETE",
      "ERROR_CREATE_PAYMENT_BANK_TRANSFER_MANDATE_INCOMPLETE",
    ]) {
      const e = firstError(
        webhook("PAYMENT_REVERSED", payment({ status: "REV", failure_code: code })),
      );
      expect(e, code).toMatchObject({
        code: "ERROR_CREATE_PAYMENT_BANK_TRANSFER_MANDATE_INCOMPLETE",
        confidence: "strong",
      });
    }
  });

  it("analyzes refunds and refund failures", () => {
    const r = analyzeFixture("rest-refund-completed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "refund.Completed",
      stage: "refund",
      outcome: "success",
      paymentReference: "payment_PPLsynth00000000000000000101",
      relatedReference: "refund_PPLsynth00000000000000000109",
      amountMinor: "4011",
    });
    expect(r.errors).toHaveLength(0);

    const pending = analyze(json({ status: ok(), data: refund({ status: "Pending" }) }));
    expect(pending.events[0]).toMatchObject({ outcome: "pending" });
    expect(ruleIds(pending)).toContain("REFUND_PENDING");

    const notClosed = analyze(json({ status: ok(), data: refund({ status: "Error" }) }));
    expect(notClosed.errors[0]).toMatchObject({
      code: "Error",
      category: "invalid_request",
      retry: "retry_conditionally",
      confidence: "possible",
    });
    expect(ruleIds(notClosed)).toContain("PAYMENT_FAILURE");

    const rejected = analyze(
      json({ status: ok(), data: refund({ status: "Rejected", failure_code: "PPLsynth1" }) }),
    );
    expect(rejected.errors[0]).toMatchObject({ code: "Rejected", confidence: "insufficient" });
    expect(rejected.errors[0]!.missingInformation.join(" ")).toMatch(/failure_code/);

    const canceled = firstEvent({ status: ok(), data: refund({ status: "Canceled" }) });
    expect(canceled).toMatchObject({ stage: "cancellation", outcome: "success" });
  });

  it("analyzes payouts and keeps reserved gc_error_code values at possible confidence", () => {
    const created = analyzeFixture("rest-payout-created.json");
    expect(created.events[0]).toMatchObject({
      eventType: "payout.Created",
      stage: "payout",
      outcome: "pending",
      paymentReference: "payout_PPLsynth00000000000000000110",
      amountMinor: "25000",
      currency: "GBP",
    });
    expect(ruleIds(created)).toContain("PAYOUT_STATUS");

    const documented = analyze(
      json({
        status: ok(),
        data: payout({ status: "Error", error: "ERROR_PAYOUT_BENEFICIARY_BANK_REJECT" }),
      }),
    );
    expect(documented.errors[0]).toMatchObject({
      code: "ERROR_PAYOUT_BENEFICIARY_BANK_REJECT",
      subCodes: { field: "error" },
      category: "payment_method_unavailable",
      confidence: "strong",
      outcomeKnown: true,
    });

    const reserved = analyze(
      json({
        status: ok(),
        data: payout({ status: "Error", gc_error_code: "ERROR_PAYOUT_BENEFICIARY_BANK_REJECT" }),
      }),
    );
    expect(reserved.errors[0]).toMatchObject({
      subCodes: { field: "gc_error_code" },
      confidence: "possible",
    });
    expect(reserved.errors[0]!.missingInformation.join(" ")).toMatch(/reserved/);

    // A payout on hold with a reserved value is not a failure.
    const hold = analyze(
      json(webhook("PAYOUT_CREATED", payout({ status: "Hold", gc_error_code: "NOT_IMPLEMENTED" }))),
    );
    expect(hold.events[0]).toMatchObject({
      outcome: "pending",
      attributes: { gcErrorCode: "NOT_IMPLEMENTED" },
    });
    expect(hold.errors).toHaveLength(0);

    const card = firstError(
      webhook("PAYOUT_FAILED", payout({ status: "Error", error: "ERROR_PROCESSING_CARD - [OF]" })),
    );
    expect(card).toMatchObject({
      subCodes: { network_code: "OF" },
      category: "payment_method_unavailable",
    });

    const silent = firstError(webhook("PAYOUT_FAILED", payout({ status: "Declined" })));
    expect(silent).toMatchObject({ code: "Declined", confidence: "insufficient" });
  });

  it("emits one event per object in a list response", () => {
    const r = analyze(
      json({
        status: ok(),
        data: [
          payment(),
          payment({
            id: "payment_PPLsynth00000000000000009002",
            status: "ERR",
            error_code: "ERROR_PROCESSING_CARD - [54]",
          }),
          { id: "cus_PPLsynth1" },
        ],
      }),
    );
    // Events are sorted by time: the failed payment has no capture time.
    expect(r.events.map((e) => [e.eventType, e.source.path])).toEqual([
      ["payment.ERR", "data[1]"],
      ["payment.CLO", "data[0]"],
    ]);
    expect(r.groups).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({
      subCodes: { network_code: "54" },
      source: { path: "data[1]" },
    });
  });

  it("keeps responses for other objects as unknown", () => {
    const other = analyze(
      json({ status: ok(), data: { id: "cus_PPLsynth1", name: "PPLsynth Person" } }),
    );
    expect(other.events[0]).toMatchObject({ eventType: "api_response", eventTypeKnown: false });
    expect(ruleIds(other)).toContain("UNKNOWN_EVENT_TYPE");
    expect(json(other.events)).not.toContain("PPLsynth Person");
    const empty = analyze(json({ status: ok() }));
    expect(empty.events[0]).toMatchObject({
      eventTypeKnown: true,
      outcome: "success",
      stage: "other",
    });
  });
});

describe("rapyd webhooks", () => {
  it("analyzes payment webhooks", () => {
    const completed = analyzeFixture("webhook-payment-completed.json");
    expect(completed.events[0]).toMatchObject({
      eventType: "PAYMENT_COMPLETED",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "CLO",
      eventReference: "wh_PPLsynth00000000000000000002",
      deliveryKey: "wh_PPLsynth00000000000000000002",
      eventTimestamp: new Date((T + 20) * 1000 + 123).toISOString(),
      attributes: {
        webhookShape: "body",
        webhookStatus: "NEW",
        paymentMethodTypeCategory: "bank_redirect",
        triggerOperationId: "PPLsynth-0000-4000-a000-000000000301",
      },
    });

    const failed = analyzeFixture("webhook-payment-failed.json");
    expect(failed.errors[0]).toMatchObject({
      code: "ERROR_PROCESSING_CARD",
      subCodes: { field: "error_code", network_code: "65" },
      attemptReference: "PPLsynth-0000-4000-a000-000000000103",
    });
    expect(failed.errors[0]!.providerMessage).toBe(
      "Authentication Required or Activity Limit Exceeded",
    );
  });

  it("takes the outcome of PAYMENT_SUCCEEDED from the payment status", () => {
    const threeDs = firstEvent(
      webhook("PAYMENT_SUCCEEDED", payment({ status: "ACT", next_action: "3d_verification" })),
    );
    expect(threeDs).toMatchObject({ stage: "authentication", outcome: "pending" });
    const closed = firstEvent(webhook("PAYMENT_SUCCEEDED", payment()));
    expect(closed).toMatchObject({ stage: "payment", outcome: "success" });
    const noStatus = firstEvent(webhook("PAYMENT_SUCCEEDED", payment({ status: undefined })));
    expect(noStatus).toMatchObject({ eventTypeKnown: true, outcome: "unknown" });
    const captured = firstEvent(webhook("PAYMENT_CAPTURED", payment()));
    expect(captured).toMatchObject({ stage: "capture", outcome: "success" });
    const canceled = firstEvent(webhook("PAYMENT_CANCELED", payment({ status: "CAN" })));
    expect(canceled).toMatchObject({ stage: "cancellation", outcome: "success" });
  });

  it("decodes the reason of a bank transfer reversal", () => {
    const r = analyzeFixture("webhook-payment-reversed-bank.json");
    expect(r.events[0]).toMatchObject({ stage: "reversal", outcome: "success" });
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_CREATE_PAYMENT_CONTACT_BANK",
      subCodes: { field: "failure_code" },
      category: "payment_method_unavailable",
      confidence: "strong",
      outcomeKnown: true,
    });
  });

  it("recognizes a repeated delivery by the webhook id", () => {
    const r = analyzeFixture("webhook-duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    expect(r.events.map((e) => e.attributes.webhookStatus)).toEqual(["NEW", "RET"]);
    const finding = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(finding.explanation).toMatch(
      /Rapyd documents that it can deliver the same notification more than once/,
    );
    expect(r.groups).toHaveLength(1);
  });

  it("gives each item of a webhook with a data list its own delivery key", () => {
    const r = analyze(
      json(
        webhook("PAYOUT_UPDATED", [
          payout(),
          payout({ id: "payout_PPLsynth00000000000000009002" }),
        ]),
      ),
    );
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      "wh_PPLsynth00000000000000009001#0",
      "wh_PPLsynth00000000000000009001#1",
    ]);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("accepts the delivery record and Retrieve Webhook shapes", () => {
    const record = analyzeFixture("webhook-refund-delivery-record.json");
    expect(record.events[0]).toMatchObject({
      eventType: "REFUND_COMPLETED",
      stage: "refund",
      outcome: "success",
      eventReference: "wh_PPLsynth00000000000000000005",
      paymentReference: "payment_PPLsynth00000000000000000304",
      relatedReference: "refund_PPLsynth00000000000000000110",
      // created_at 0 in a delivery record means "not set"; the refund time is used.
      eventTimestamp: new Date((T + 100) * 1000).toISOString(),
      attributes: { webhookShape: "delivery_record", deliveryAttempts: 0 },
    });

    const api = analyzeFixture("webhook-refund-updated-api-record.json");
    expect(api.events[0]).toMatchObject({
      eventType: "PAYMENT_REFUND_UPDATED",
      stage: "refund",
      outcome: "failure",
      deliveryKey: "wh_PPLsynth00000000000000000006",
      attributes: {
        webhookShape: "api_record",
        webhookStatus: "CLO",
        deliveryAttempts: 1,
        envelopeStatus: "SUCCESS",
        failureReason: "lost_or_stolen_card",
      },
    });
    expect(api.errors[0]).toMatchObject({
      code: "lost_or_stolen_card",
      category: "payment_method_unavailable",
      confidence: "possible",
      attemptReference: "PPLsynth-0000-4000-a000-000000000307",
    });
  });

  it("reads the HTTP client wrapper without copying the signature", () => {
    const r = analyzeFixture("webhook-wrapper-dispute-created.json");
    expect(r.events[0]).toMatchObject({
      eventType: "PAYMENT_DISPUTE_CREATED",
      stage: "dispute",
      outcome: "pending",
      paymentReference: "payment_PPLsynth00000000000000000201",
      relatedReference: "dispute_PPLsynth00000000000000000001",
      source: { path: "body.data" },
      attributes: { webhookShape: "wrapper", signaturePresent: true, disputeCategory: "Fraud" },
    });
    const dump = json(r.events) + json(r.errors) + toJsonReport(r);
    expect(dump).not.toContain("UFBMc3ludGhTaWduYXR1cmVOb3RSZWFsMDAw");
    expect(dump).not.toContain("PPLsynthSaltValue000001");
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");

    const raw = analyze(
      `POST /PPLsynth/webhooks HTTP/1.1\nContent-Type: application/json\nsignature: PPLsynthRawSignature0001\nsalt: PPLsynthRawSalt\n\n${json(webhook("PAYMENT_COMPLETED", payment()))}`,
    );
    expect(raw.events[0]!.attributes.signaturePresent).toBe(true);
    expect(json(raw.events) + toJsonReport(raw)).not.toContain("PPLsynthRawSignature0001");
  });

  it("maps dispute statuses from the merchant's side", () => {
    const dispute = (status: string) =>
      firstEvent(
        webhook("PAYMENT_DISPUTE_UPDATED", {
          token: "dispute_PPLsynth00000000000000009001",
          original_transaction_id: "payment_PPLsynth00000000000000009001",
          status,
        }),
      );
    expect(dispute("WIN").outcome).toBe("success");
    expect(dispute("LOS").outcome).toBe("failure");
    expect(dispute("REV").outcome).toBe("success");
    expect(dispute("ARB").outcome).toBe("pending");
    expect(dispute("PPLsynth").outcome).toBe("unknown");
  });

  it("decodes payout failures from the reserved field", () => {
    const r = analyzeFixture("webhook-payout-failed.json");
    expect(r.events[0]).toMatchObject({
      stage: "payout",
      outcome: "failure",
      providerStatus: "Declined",
    });
    expect(r.errors[0]).toMatchObject({
      code: "MISSING_PAYOUT_METHOD_REQUIRED_FIELD",
      subCodes: { field: "gc_error_code", detail: "PHONE_NUMBER" },
      category: "invalid_request",
      confidence: "possible",
    });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("keeps unknown webhook types honest", () => {
    const r = analyze(
      json(
        webhook("CUSTOMER_PAYMENT_METHOD_CREATED", {
          id: "other_PPLsynth1",
          name: "PPLsynth Holder",
        }),
      ),
    );
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "rapyd.webhook" });
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(json(r.events)).not.toContain("PPLsynth Holder");
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("rapyd lifecycle and correlation", () => {
  it("links a payment with its capture, refund and dispute", () => {
    const r = analyzeFixture("payment-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment.ACT", "authorization", "success"],
      ["PAYMENT_CAPTURED", "capture", "success"],
      ["REFUND_COMPLETED", "refund", "success"],
      ["PAYMENT_DISPUTE_CREATED", "dispute", "pending"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining([
        "payment_PPLsynth00000000000000000201",
        "refund_PPLsynth00000000000000000201",
        "dispute_PPLsynth00000000000000000002",
      ]),
    );
    const ids = ruleIds(r);
    expect(ids).toContain("CHARGEBACK_REPORTED");
    expect(ids).not.toContain("AMOUNT_MISMATCH");
    expect(ids).not.toContain("MISSING_REFERENCE");
    expect(r.arrivalOrderInferred).toBe(false);
  });

  it("follows a payout to its return", () => {
    const r = analyzeFixture("payout-lifecycle.json");
    expect(r.events.map((e) => [e.eventType, e.providerStatus, e.outcome])).toEqual([
      ["PAYOUT_CREATED", "Created", "pending"],
      ["PAYOUT_COMPLETED", "Completed", "success"],
      ["PAYOUT_RETURNED", "Returned", "failure"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe("Payout failed");
    expect(r.errors[0]).toMatchObject({ code: "Returned", subCodes: { field: "status" } });
  });

  it("keeps unrelated payments apart even with the same merchant reference", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "PPLsynth-order-shared",
      "PPLsynth-order-shared",
    ]);
    expect(r.errors[0]).toMatchObject({
      subCodes: { network_code: "05" },
      category: "card_declined",
    });
  });

  it("returns only explicit identifiers as correlation keys", () => {
    const r = analyzeFixture("payment-lifecycle.json");
    for (const e of r.events) {
      const keys = rapydAdapter.correlationKeys(e);
      expect(keys.every((k) => /^(payment|refund|dispute|payout)_/.test(k))).toBe(true);
      expect(keys).not.toContain(e.merchantReference);
    }
  });
});

describe("rapyd sensitive data", () => {
  const planted = [
    "4111111111111111",
    "PPLsynth Planted Holder",
    "ocfp_PPLsynthPLANTEDfingerprint01",
    "PPLsynthPLANTEDnetref01",
    "PPLsynthPLANTEDnetref02",
    "V001PPLsynthPLANTEDpar01",
    "411111",
    "cus_PPLsynthPLANTEDcustomer01",
    "ewallet_PPLsynthPLANTEDwallet01",
    "mid_PPLsynthPLANTEDmid01",
    "receipt.PPLsynth@example.com",
    "planted.PPLsynth@example.com",
    "planted.failure.PPLsynth@example.com",
    "PPLsynthPLANTEDredirect01",
    "PPLsynthPLANTEDcomplete01",
    "PPLsynth Planted Name",
    "PPLsynth Planted Street 1",
    "PPLsynthPlantedCity",
    "PPLsynthPLANTEDcardholder01",
    "GB33BUKB20201555555555",
  ];

  it("keeps planted sensitive values out of events, errors and the JSON report", () => {
    const r = analyzeFixture("sensitive-payment-webhook.json");
    expect(r.events).toHaveLength(1);
    expect(r.sensitiveData.detected).toBe(true);
    const dump = json(r.events) + json(r.errors) + toJsonReport(r);
    for (const value of planted) expect(dump, value).not.toContain(value);
    // An e-mail address is not accepted as a merchant reference.
    expect(r.events[0]!.merchantReference).toBeUndefined();
    expect(r.events[0]!.attributes.failureMessage).toBe("contact [redacted]");
  });

  it("does not copy payout parties or wallet ids", () => {
    const r = analyzeFixture("rest-payout-created.json");
    const dump = json(r.events) + toJsonReport(r);
    expect(dump).not.toContain("beneficiary_PPLsynth");
    expect(dump).not.toContain("sender_PPLsynth");
    expect(dump).not.toContain("ewallet_PPLsynth");
  });
});

describe("rapyd manifest and catalog", () => {
  it("exports the adapter, manifest and version", () => {
    expect(defaultExport).toBe(rapydAdapter);
    expect(manifestOnly).toBe(rapydManifest);
    expect(rapydAdapter.manifest).toBe(rapydManifest);
    expect(RAPYD_ADAPTER_VERSION).toBe("0.1.0");
    expect(rapydAdapter.supportedFormats.map((f) => f.id)).toEqual([
      "rapyd.api_response",
      "rapyd.webhook",
    ]);
  });

  it("describes the adapter honestly", () => {
    const m = rapydManifest;
    expect(m).toMatchObject({
      id: "rapyd",
      wave: 2,
      researchStatus: "tested",
      documentationAccess: "public",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      status: "limited",
    });
    expect(m.categories).toEqual([
      "card_processing",
      "acquiring",
      "alternative_payment_method",
      "wallet",
    ]);
    for (const s of m.sectors) expect(s.source).toMatch(/^https:\/\/www\.rapyd\.net\//);
    expect(m.fixtureProvenance).toMatch(/[Ss]ynthetic/);
    expect(m.delivery).toMatchObject({ duplicatesDocumented: true, ordering: "not_guaranteed" });
    const caps = Object.values(m.capabilities);
    expect(caps.every((c) => c === "supported")).toBe(false);
    expect(m.capabilities.errorDecoding).toBe("supported");
    expect(m.capabilities.webhookParsing).toBe("limited");
    for (const d of m.documentation) expect(d.url).toMatch(/^https:\/\/docs\.rapyd\.net\/en\//);
  });

  it("has the documented number of codes", () => {
    expect(CATALOG_COUNTS).toEqual({
      errorRows: 382,
      errorCodes: 373,
      networkRows: 105,
      networkCodes: 105,
      adviceCodes: 18,
    });
    expect(ERROR_CODES.ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION).toHaveLength(2);
    expect(NETWORK_CODES["76"]).toHaveLength(2);
    expect(NETWORK_CODES.W9![0]!.printed).toBe("W1, W2, W9");
    expect(NETWORK_CODES.XD![0]!.scheme).toBe("Visa");
    expect(MERCHANT_ADVICE_CODES["01"]!.retry).toBe("do_not_retry");
  });

  it("contains exactly the codes of the research tables", () => {
    const research = readFileSync(
      fileURLToPath(new URL("../../../../docs/providers/research/rapyd.md", import.meta.url)),
      "utf8",
    );
    const section = research.slice(
      research.indexOf("### 4. Codes"),
      research.indexOf("### 5. Lifecycle"),
    );
    const errorCodes = new Set<string>();
    const networkCodes = new Set<string>();
    const adviceCodes = new Set<string>();
    let current = "";
    for (const line of section.split(/\r?\n/)) {
      const h = /^#### (4\.\d+) /.exec(line);
      if (h) current = h[1]!;
      const cell = /^\| `([^`]+)`/.exec(line);
      if (!cell) continue;
      if (current === "4.6") {
        const m = /^(.*?)\s*\((?:Visa|Mastercard)\)$/.exec(cell[1]!);
        for (const c of (m ? m[1]! : cell[1]!).split(/\s*,\s*/)) networkCodes.add(c);
      } else if (current === "4.7") adviceCodes.add(cell[1]!);
      else errorCodes.add(codeKey(cell[1]!));
    }
    expect(new Set(Object.keys(ERROR_CODES))).toEqual(errorCodes);
    expect(new Set(Object.keys(NETWORK_CODES))).toEqual(networkCodes);
    expect(new Set(Object.keys(MERCHANT_ADVICE_CODES))).toEqual(adviceCodes);
  });

  it("uses valid categories, retry values and documentation links", () => {
    const categories = new Set([
      "card_declined",
      "authentication_required",
      "authentication_failed",
      "invalid_request",
      "invalid_amount",
      "insufficient_funds",
      "payment_method_unavailable",
      "fraud_or_risk",
      "rate_limiting",
      "provider_unavailable",
      "network_or_timeout",
      "duplicate_request",
      "configuration",
      "unknown",
    ]);
    const retries = new Set([
      "do_not_retry",
      "customer_action_required",
      "retry_conditionally",
      "manual_review",
      "unknown",
    ]);
    const rows = [
      ...Object.values(ERROR_CODES).flat(),
      ...Object.values(NETWORK_CODES).flat(),
      ...Object.values(MERCHANT_ADVICE_CODES),
    ];
    for (const e of rows) {
      expect(categories.has(e.category), e.meaning).toBe(true);
      expect(retries.has(e.retry), e.meaning).toBe(true);
      expect(e.meaning).not.toMatch(/section \d|`/);
    }
    for (const s of Object.values(SECTIONS)) expect(s.url).toMatch(/^https:\/\//);
    for (const t of Object.keys(EVENT_TYPES)) expect(t).toMatch(/^(PAYMENT|REFUND|PAYOUT)_/);
    expect(Object.keys(PAYMENT_STATUSES)).toEqual(["ACT", "CAN", "CLO", "ERR", "EXP", "REV"]);
    expect(Object.keys(REFUND_STATUSES)).toEqual([
      "Pending",
      "Completed",
      "Rejected",
      "Error",
      "Canceled",
    ]);
    expect(Object.keys(DISPUTE_STATUSES)).toEqual([
      "ACT",
      "RVW",
      "PRA",
      "ARB",
      "LOS",
      "WIN",
      "REV",
    ]);
    expect(Object.keys(PAYOUT_STATUSES)).toHaveLength(10);
  });

  it("uses no en or em dashes and only synthetic fixtures", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(json([rapydManifest, ERROR_CODES, NETWORK_CODES, MERCHANT_ADVICE_CODES])).not.toMatch(
      dashes,
    );
    const pkg = fileURLToPath(new URL("../", import.meta.url));
    const fixtures = fileURLToPath(new URL("../../../../fixtures/rapyd/", import.meta.url));
    for (const file of ["src/index.ts", "src/catalog.ts", "src/manifest.ts", "tests/rapyd.test.ts"])
      expect(readFileSync(`${pkg}${file}`, "utf8"), file).not.toMatch(dashes);
    const files = readdirSync(fixtures);
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const content = readFileSync(`${fixtures}${file}`, "utf8");
      expect(content, file).not.toMatch(dashes);
      expect(content, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });

  it("analyzes every fixture without internal errors", () => {
    const fixtures = fileURLToPath(new URL("../../../../fixtures/rapyd/", import.meta.url));
    for (const file of readdirSync(fixtures)) {
      const r = analyzeText(readFileSync(`${fixtures}${file}`, "utf8"), options);
      expect(r.ok, file).toBe(true);
      if (r.ok)
        expect(
          r.result.records.every((x) => x.provider === "rapyd"),
          file,
        ).toBe(true);
    }
  });
});
