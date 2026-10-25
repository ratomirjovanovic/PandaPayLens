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
import { ADAPTERS } from "@pandapaylens/providers";
import { stripeAdapter } from "@pandapaylens/stripe";
import {
  AIRWALLEX_ADAPTER_VERSION,
  API_ERROR_CODES,
  AVS_CODES,
  CVC_CODES,
  DISPUTE_REASON_TYPES,
  DISPUTE_STAGES,
  DISPUTE_STATUSES,
  FAILURE_CODES,
  ISSUER_CODES,
  ISSUER_CODE_ROWS,
  MERCHANT_ADVICE_CODES,
  OTHER_PAYMENTS_EVENTS,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_INTENT_STATUSES,
  REFUND_STATUSES,
  WEBHOOK_EVENTS,
  airwallexAdapter,
  airwallexManifest,
  decodeFailure,
  resolveIssuerCode,
} from "@pandapaylens/airwallex";
import defaultExport from "@pandapaylens/airwallex";
import { airwallexManifest as manifestOnly } from "@pandapaylens/airwallex/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [airwallexAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`airwallex/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const ownFiles = () => readdirSync(`${root}airwallex`).sort();

const errorBody = (fields: Record<string, unknown> = {}) => ({
  code: "issuer_declined",
  message: "Synthetic decline message.",
  trace_id: "PPLsynthtrace000000000000009001",
  details: {},
  ...fields,
});
const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");
const intent = (fields: Record<string, unknown> = {}) => ({
  id: "int_PPLsynthTest9001",
  amount: 10,
  currency: "EUR",
  merchant_order_id: "PPLsynth-order-9001",
  status: "REQUIRES_PAYMENT_METHOD",
  captured_amount: 0,
  created_at: "2026-10-20T09:00:00+0000",
  updated_at: "2026-10-20T09:00:00+0000",
  ...fields,
});
const attempt = (fields: Record<string, unknown> = {}) => ({
  id: "att_PPLsynthTest9001",
  payment_intent_id: "int_PPLsynthTest9001",
  status: "AUTHORIZED",
  amount: 10,
  currency: "EUR",
  updated_at: "2026-10-20T09:00:01+0000",
  ...fields,
});
const webhook = (name: string, object: unknown, fields: Record<string, unknown> = {}) => ({
  id: "evt_PPLsynth_test_9001",
  name,
  account_id: "acct_PPLsynthAccount01",
  data: { object },
  created_at: "2026-10-20T09:00:02+0000",
  version: "2026-08-21",
  ...fields,
});
// En dash and em dash, built from code points so this file stays free of them.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;

describe("airwallex exports and manifest", () => {
  it("exports the adapter, the manifest and the version", () => {
    expect(defaultExport).toBe(airwallexAdapter);
    expect(manifestOnly).toBe(airwallexManifest);
    expect(airwallexAdapter.id).toBe("airwallex");
    expect(AIRWALLEX_ADAPTER_VERSION).toBe("0.1.0");
    expect(airwallexManifest.version).toBe(AIRWALLEX_ADAPTER_VERSION);
  });

  it("describes the documented scope honestly", () => {
    const m = airwallexManifest;
    expect(m).toMatchObject({
      wave: 2,
      researchStatus: "tested",
      samples: expect.arrayContaining([expect.any(String)]),
      verifiedAt: "2026-10-25",
      documentationAccess: "public",
      status: "limited",
    });
    expect(m.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "limited",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "supported",
      diagnosticRules: "limited",
    });
    expect(m.delivery).toMatchObject({
      duplicateKey: "event id",
      duplicatesDocumented: true,
      ordering: "not_guaranteed",
    });
    expect(m.categories).toEqual([
      "acquiring",
      "card_processing",
      "gateway",
      "alternative_payment_method",
    ]);
    expect(m.sectors.length).toBeGreaterThan(0);
    for (const s of m.sectors) expect(s.source).toMatch(/^https:\/\/www\.airwallex\.com\//);
    for (const d of m.documentation)
      expect(d.url).toMatch(/^https:\/\/www\.airwallex\.com\/docs\//);
    expect(m.fixtureProvenance).toMatch(/Synthetic/);
    expect(m.regions).toMatch(/FCA/);
  });

  it("keeps supported formats and api families consistent", () => {
    const families = new Map(airwallexManifest.apiFamilies.map((f) => [f.id, f.status]));
    for (const f of airwallexAdapter.supportedFormats) {
      expect(families.has(f.id)).toBe(true);
      expect(families.get(f.id)).not.toBe("unsupported");
    }
    expect(families.get("airwallex.payout_webhook")).toBe("unsupported");
    expect(families.get("airwallex.transfer")).toBe("unsupported");
  });

  it("uses only the plain hyphen in sources, fixtures and catalog text", () => {
    const dir = fileURLToPath(new URL("../src/", import.meta.url));
    const texts = [
      ...readdirSync(dir).map((f) => readFileSync(`${dir}${f}`, "utf8")),
      ...ownFiles().map((f) => fixture(`airwallex/${f}`)),
      readFileSync(fileURLToPath(import.meta.url), "utf8"),
    ];
    for (const t of texts) expect(t).not.toMatch(DASHES);
  });
});

describe("airwallex catalog", () => {
  it("has the documented number of entries", () => {
    expect(Object.keys(API_ERROR_CODES)).toHaveLength(31);
    expect(Object.keys(FAILURE_CODES)).toHaveLength(6);
    expect(ISSUER_CODE_ROWS).toHaveLength(176);
    expect(Object.keys(ISSUER_CODES)).toHaveLength(162);
    expect(Object.values(ISSUER_CODES).filter((r) => r.length > 1)).toHaveLength(14);
    expect(Object.keys(MERCHANT_ADVICE_CODES)).toHaveLength(5);
    expect(Object.keys(AVS_CODES)).toHaveLength(18);
    expect(Object.keys(CVC_CODES)).toHaveLength(6);
    expect(Object.keys(PAYMENT_INTENT_STATUSES)).toHaveLength(7);
    expect(Object.keys(PAYMENT_ATTEMPT_STATUSES)).toHaveLength(10);
    expect(Object.keys(REFUND_STATUSES)).toHaveLength(4);
    expect(Object.keys(DISPUTE_STAGES)).toHaveLength(5);
    expect(Object.keys(DISPUTE_STATUSES)).toHaveLength(9);
    expect(DISPUTE_REASON_TYPES).toHaveLength(17);
    expect(Object.keys(WEBHOOK_EVENTS)).toHaveLength(37);
    expect(OTHER_PAYMENTS_EVENTS).toHaveLength(23);
  });

  it("lists the brand-dependent issuer codes from the documentation", () => {
    const multi = Object.entries(ISSUER_CODES)
      .filter(([, r]) => r.length > 1)
      .map(([c]) => c)
      .sort();
    expect(multi).toEqual(
      [
        "100",
        "109",
        "110",
        "111",
        "115",
        "119",
        "122",
        "200",
        "34",
        "46",
        "65",
        "6P",
        "82",
        "91",
      ].sort(),
    );
  });

  it("has complete entries", () => {
    for (const e of [...Object.values(API_ERROR_CODES), ...Object.values(FAILURE_CODES)]) {
      expect(e.explanation.length).toBeGreaterThan(10);
      expect(e.nextAction.length).toBeGreaterThan(5);
      expect(e.retryExplanation.length).toBeGreaterThan(5);
    }
    for (const r of ISSUER_CODE_ROWS) {
      expect(r.brands.length).toBeGreaterThan(0);
      if (r.kind === "approval") expect(r.category).toBe("unknown");
      else expect(r.retry).not.toBe("unknown");
    }
  });

  it("resolves issuer codes by brand", () => {
    expect(resolveIssuerCode("65", "visa")).toMatchObject({
      kind: "match",
      reading: { category: "card_declined" },
    });
    expect(resolveIssuerCode("65", "mastercard")).toMatchObject({
      kind: "match",
      reading: { category: "authentication_required" },
    });
    expect(resolveIssuerCode("65", undefined)).toMatchObject({
      kind: "ambiguous",
      brandMismatch: false,
    });
    expect(resolveIssuerCode("05", undefined)).toMatchObject({ kind: "match" });
    expect(resolveIssuerCode("52", undefined)).toMatchObject({ kind: "ambiguous" });
    expect(resolveIssuerCode("800.100.174", undefined)).toMatchObject({
      kind: "match",
      reading: { category: "insufficient_funds" },
    });
    expect(resolveIssuerCode("70", "visa")).toMatchObject({
      kind: "ambiguous",
      brandMismatch: true,
    });
    expect(resolveIssuerCode("ZZ", "visa")).toEqual({ kind: "unlisted" });
    expect(resolveIssuerCode("constructor", undefined)).toEqual({ kind: "unlisted" });
  });
});

describe("airwallex detection", () => {
  const meta = (status: number): RecordMeta => ({
    format: "http",
    http: { kind: "response", status, headers: {} },
  });

  it.each([
    [errorBody(), "airwallex.error", 0.95],
    [{ code: "issuer_declined", provider_original_response_code: "05" }, "airwallex.error", 0.85],
    [errorBody({ code: "something_new_PPLsynth".toLowerCase() }), "airwallex.error", 0.7],
    [intent(), "airwallex.payment_intent", 0.95],
    [intent({ status: "NEW_STATUS" }), "airwallex.payment_intent", 0.75],
    [attempt(), "airwallex.payment_attempt", 0.95],
    [
      { id: "rfd_PPLsynth9001", status: "RECEIVED", payment_intent_id: "int_PPLsynth9001" },
      "airwallex.refund",
      0.95,
    ],
    [
      { id: "dst_PPLsynth9001", stage: "RFI", status: "REQUIRES_RESPONSE" },
      "airwallex.payment_dispute",
      0.95,
    ],
    [webhook("payment_attempt.authorized", attempt()), "airwallex.webhook", 0.95],
    [
      { name: "payment_attempt.authorized", data: { object: { status: "AUTHORIZED" } } },
      "airwallex.webhook",
      0.75,
    ],
    [webhook("payment_consent.verified", { status: "VERIFIED" }), "airwallex.webhook", 0.9],
    [webhook("payment_intent.brand_new", intent()), "airwallex.webhook", 0.8],
  ])("recognizes %j as %s", (input, format, confidence) => {
    const d = airwallexAdapter.detect(input);
    expect(d.format).toBe(format);
    expect(d.confidence).toBe(confidence);
    expect(d.supported).toBe(true);
  });

  it("recognizes payouts without analyzing them", () => {
    const payout = airwallexAdapter.detect(
      JSON.parse(fixture("airwallex/payout-transfer-webhook.json")),
    );
    expect(payout).toMatchObject({ format: "airwallex.payout_webhook", supported: false });
    expect(payout.confidence).toBeGreaterThanOrEqual(0.5);
    const transfer = airwallexAdapter.detect({
      id: "PPLsynth-transfer-0001",
      short_reference_id: "PPLSYNTH-0001",
      transfer_method: "SWIFT",
      transfer_currency: "USD",
      status: "PAID",
    });
    expect(transfer).toMatchObject({ format: "airwallex.transfer", supported: false });
  });

  it.each([
    null,
    "issuer_declined",
    [],
    42,
    {},
    { error: { type: "card_error", code: "card_declined" } },
    { code: "validation_error", message: "x" },
    { code: "validation_error" },
    { status: "SUCCEEDED" },
    { status: "error", code: "issuer_declined", message: "x", trace_id: "PPLsynth" },
    { id: "pi_PPLsynth", object: "payment_intent", status: "succeeded" },
    { id: "int_PPLsynth", object: "payment_intent", status: "SUCCEEDED" },
    { id: "int_PPLsynth", status: "succeeded" },
    { id: "pay_PPLsynth", status: "Authorized" },
    { id: "evt_PPLsynth", object: "event", type: "payment_intent.succeeded", data: { object: {} } },
    { name: "payment_intent.created", type: "x", data: { object: {} } },
    { name: "something.created", data: { object: {} }, version: "2026-08-21" },
    { name: "Payment_Intent.Created", data: { object: {} } },
    { name: "payment_intent.created", data: "x" },
  ])("returns confidence 0 for %j", (input) => {
    expect(airwallexAdapter.detect(input).confidence).toBe(0);
  });

  it("does not claim generic shapes above 0.5", () => {
    for (const input of [
      { code: "validation_error", message: "x", details: {} },
      { code: "internal_error", message: "x", details: {}, source: "amount" },
      { name: "refund.something_new", data: { object: {} } },
      { name: "customer.created", data: { object: {} } },
      { name: "payout.transfer.paid", data: {} },
    ]) {
      expect(airwallexAdapter.detect(input).confidence).toBeLessThanOrEqual(0.5);
    }
  });

  it("ignores form-encoded input", () => {
    expect(airwallexAdapter.detect(errorBody(), { format: "form" }).confidence).toBe(0);
  });

  it("mentions the HTTP status as a reason", () => {
    expect(airwallexAdapter.detect(errorBody(), meta(400)).reasons).toContain("HTTP status 400");
  });

  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "airwallex" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );

  it("checks the Stripe, Adyen and Checkout.com fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "checkout"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    let parsedFiles = 0;
    let checked = 0;
    for (const file of readdirSync(`${root}${dir}`)) {
      if (!statSync(`${root}${dir}/${file}`).isFile()) continue;
      const parsed = parseInput(readFileSync(`${root}${dir}/${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsedFiles++;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          airwallexAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    if (parsedFiles > 0) expect(checked).toBeGreaterThan(0);
  });

  it("is not claimed by Stripe or any registered adapter", () => {
    for (const file of ownFiles()) {
      const parsed = parseInput(fixture(`airwallex/${file}`));
      if (!parsed.ok) throw new Error(`${file}: ${parsed.error.message}`);
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload = typeof r.receivedAt === "string" && "payload" in r ? r.payload : record;
        const m = parsed.value.meta[i];
        expect(stripeAdapter.detect(payload, m).confidence, `stripe on ${file}`).toBe(0);
        for (const a of ADAPTERS) {
          if (a.id === "airwallex") continue;
          expect(a.detect(payload, m).confidence, `${a.id} on ${file} record ${i}`).toBeLessThan(
            0.5,
          );
        }
      });
    }
  });

  it("analyzes every own fixture, and only payouts are unsupported", () => {
    for (const file of ownFiles()) {
      const r = analyzeFixture(file);
      const expected = file === "payout-transfer-webhook.json" ? "unsupported" : "analyzed";
      for (const rec of r.records) expect(rec.status, file).toBe(expected);
    }
  });
});

describe("airwallex error body", () => {
  it("decodes an issuer decline with the card brand", () => {
    const r = analyzeFixture("issuer-declined.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "airwallex.error" });
    expect(r.suggestedView).toBe("decoder");
    expect(r.events[0]).toMatchObject({
      eventType: "api_error.issuer_declined",
      stage: "error",
      outcome: "failure",
      attributes: {
        code: "issuer_declined",
        httpStatus: 400,
        issuerResponseCode: "51",
        cardBrand: "mastercard",
        cardType: "DEBIT",
        isCommercial: false,
      },
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "issuer_declined",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: {
        provider_original_response_code: "51",
        card_brand: "mastercard",
        http_status: "400",
      },
    });
    expect(e.explanation).toMatch(/Issuer response code 51 \(Mastercard\): Insufficient funds/);
    expect(e.providerMessage).toMatch(/declined/);
    expect(e.documentation.map((d) => d.url)).toEqual(
      expect.arrayContaining([
        "https://www.airwallex.com/docs/payments/troubleshooting/error-response-codes",
        "https://www.airwallex.com/docs/payments/troubleshooting/response-codes/issuer-response-codes",
      ]),
    );
    expect(e.missingInformation.join(" ")).toMatch(/no PaymentIntent id/);
  });

  it("shows every brand meaning at lower confidence when the brand is missing", () => {
    const e = analyzeFixture("issuer-code-without-brand.json").errors[0]!;
    expect(e.confidence).toBe("possible");
    expect(e.category).toBe("card_declined");
    expect(e.explanation).toMatch(/Visa: Exceeds the withdrawal count/);
    expect(e.explanation).toMatch(/Mastercard: Soft decline/);
    expect(e.missingInformation.join(" ")).toMatch(/card brand is not in this record/);
  });

  it("uses a shared meaning when the code means the same for every brand", () => {
    const e = firstError(errorBody({ provider_original_response_code: "05" }));
    expect(e).toMatchObject({ category: "card_declined", confidence: "strong" });
    const jcb = firstError(errorBody({ provider_original_response_code: "800.100.159" }));
    expect(jcb).toMatchObject({
      category: "fraud_or_risk",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("keeps Amex and Discover three-digit codes apart", () => {
    const none = firstError(errorBody({ provider_original_response_code: "100" }));
    expect(none.confidence).toBe("possible");
    expect(none.explanation).toMatch(/American Express: Deny/);
    expect(none.explanation).toMatch(/Discover, Diners Club: Do not honor/);
    const amex = firstError(
      errorBody({
        provider_original_response_code: "109",
        details: { card_brand: "american_express" },
      }),
    );
    expect(amex).toMatchObject({
      category: "configuration",
      retry: "manual_review",
      confidence: "strong",
    });
    const discover = firstError(
      errorBody({ provider_original_response_code: "109", details: { card_brand: "discover" } }),
    );
    expect(discover).toMatchObject({ category: "card_declined", confidence: "strong" });
  });

  it("says when the code is not documented for the brand", () => {
    const e = firstError(
      errorBody({ provider_original_response_code: "70", details: { card_brand: "visa" } }),
    );
    expect(e.confidence).toBe("possible");
    expect(e.explanation).toMatch(/not documented for Visa/);
    expect(e.explanation).toMatch(/Mastercard: Contact the card issuer/);
  });

  it("reports unknown brands and unlisted issuer codes", () => {
    const e = firstError(
      errorBody({
        provider_original_response_code: "ZZ",
        details: { card_brand: "PPLsynthbrand" },
      }),
    );
    expect(e.confidence).toBe("strong");
    expect(e.category).toBe("card_declined");
    expect(e.missingInformation.join(" ")).toMatch(/not one of the brands/);
    expect(e.missingInformation.join(" ")).toMatch(
      /"ZZ" is not in Airwallex's issuer response code table/,
    );
  });

  it("decodes a validation error", () => {
    const r = analyzeFixture("validation-error.txt");
    expect(r.events[0]).toMatchObject({
      outcome: "unknown",
      attributes: { source: "merchant_order_id" },
    });
    expect(r.errors[0]).toMatchObject({
      code: "validation_error",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { source: "merchant_order_id", http_status: "400" },
    });
  });

  it("treats a rate limit as a safe technical retry", () => {
    const r = analyzeFixture("rate-limited.txt");
    expect(r.errors[0]).toMatchObject({
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
    });
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("flags an internal error as an unknown outcome", () => {
    const r = analyzeFixture("internal-error.txt");
    const e = r.errors[0]!;
    expect(e).toMatchObject({ category: "provider_unavailable", retry: "retry_conditionally" });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.retryExplanation).toMatch(/same request_id/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("unauthorized.txt");
    expect(r.errors[0]).toMatchObject({
      code: "unauthorized",
      category: "configuration",
      retry: "do_not_retry",
      subCodes: { http_status: "401" },
    });
  });

  it("is honest about unrecognized and undocumented codes", () => {
    const unknown = firstError(errorBody({ code: "brand_new_code" }));
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
    const undocumented = firstError(errorBody({ code: "operation_above_limit" }));
    expect(undocumented).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });

  it("maps the documented spelling variant authentication_decline", () => {
    const e = firstError(errorBody({ code: "authentication_decline" }));
    expect(e).toMatchObject({
      code: "authentication_declined",
      category: "authentication_failed",
      subCodes: { code_as_sent: "authentication_decline" },
    });
  });

  it("notes an HTTP status that differs from the documentation", () => {
    const r = analyze(httpResponse(400, errorBody({ code: "too_many_requests" })));
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP 429/);
  });

  it("does not decode payment method provider codes", () => {
    const e = decodeFailure({
      code: "provider_declined",
      issuerCode: "PPL01",
      paymentMethodType: "alipaycn",
    });
    expect(e.category).toBe("card_declined");
    expect(e.missingInformation.join(" ")).toMatch(/does not publish these provider codes/);
    expect(e.explanation).not.toMatch(/Issuer response code/);
  });

  it("keeps the base reason for approval issuer codes", () => {
    const e = decodeFailure({ failureCode: "capture_failed", issuerCode: "00", brand: "visa" });
    expect(e.category).toBe("unknown");
    expect(e.retry).toBe("manual_review");
    expect(e.explanation).toMatch(/approval code/);
  });
});

describe("airwallex payment intents and attempts", () => {
  it("normalizes a succeeded PaymentIntent without errors", () => {
    const r = analyzeFixture("payment-intent-succeeded.json");
    expect(r.errors).toEqual([]);
    expect(r.events[0]).toMatchObject({
      eventType: "payment_intent.snapshot",
      stage: "payment",
      outcome: "success",
      providerStatus: "SUCCEEDED",
      paymentReference: "int_PPLsynthPaid0001",
      relatedReference: "att_PPLsynthPaid0001",
      merchantReference: "PPLsynth-order-0001",
      amountMinor: "4912",
      currency: "USD",
      eventTimestamp: "2026-10-20T09:00:05.000Z",
      attributes: {
        latestAttemptStatus: "CAPTURE_REQUESTED",
        latestAttemptCardBrand: "visa",
        latestAttemptSettleVia: "airwallex",
        latestAttemptIssuerResponseCode: "00",
        latestAttemptAvsResult: "pass",
        capturedAmountMinor: "4912",
        hasRequestId: true,
      },
    });
  });

  it("decodes the failed latest attempt of a PaymentIntent", () => {
    const r = analyzeFixture("payment-intent-declined.json");
    expect(r.events[0]).toMatchObject({ outcome: "failure", stage: "payment" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "issuer_declined",
      category: "card_declined",
      confidence: "strong",
      paymentReference: "int_PPLsynthDeclined0002",
      attemptReference: "att_PPLsynthDeclined0002",
      subCodes: { failure_code: "authorization_failed", provider_original_response_code: "05" },
      source: { path: "latest_payment_attempt.failure_details" },
    });
    expect(e.explanation).toMatch(/Do not honor/);
    expect(e.explanation).toMatch(/AVS result U/);
    expect(e.explanation).toMatch(/CVC result: Match/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("applies the Mastercard Merchant Advice Code to the retry guidance", () => {
    const r = analyzeFixture("payment-attempt-mac.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payment_attempt.snapshot",
      stage: "authorization",
      outcome: "failure",
      paymentReference: "int_PPLsynthMac0003",
      relatedReference: "att_PPLsynthMac0003",
      amountMinor: "12000",
    });
    expect(r.errors[0]).toMatchObject({
      category: "insufficient_funds",
      retry: "retry_conditionally",
      outcomeKnown: true,
      subCodes: { merchant_advice_code: "02" },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/72 hours/);
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("notes a Merchant Advice Code outside its documented combinations", () => {
    const e = decodeFailure({
      code: "issuer_declined",
      issuerCode: "05",
      brand: "mastercard",
      merchantAdviceCode: "02",
    });
    expect(e.missingInformation.join(" ")).toMatch(/only with issuer codes 51, 79, 82, 83/);
    const unknown = decodeFailure({ code: "issuer_declined", merchantAdviceCode: "99" });
    expect(unknown.missingInformation.join(" ")).toMatch(/"99" is not in Airwallex's table/);
  });

  it("shows a pending 3D Secure step", () => {
    const r = analyzeFixture("requires-customer-action.json");
    expect(r.events[0]).toMatchObject({
      stage: "authentication",
      outcome: "pending",
      amountMinor: "7550",
      currency: "HKD",
      attributes: {
        nextActionType: "redirect_iframe",
        latestAttemptStatus: "AUTHENTICATION_REDIRECTED",
      },
    });
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("maps a manual-capture intent to a successful authorization", () => {
    const r = analyze(json(intent({ status: "REQUIRES_CAPTURE" })));
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "success" });
  });

  it("keeps unknown statuses unknown", () => {
    const r = analyze(json(intent({ status: "NEW_STATUS" })));
    expect(r.events[0]).toMatchObject({
      stage: "other",
      outcome: "unknown",
      providerStatus: "NEW_STATUS",
      attributes: { statusKnown: false },
    });
  });

  it("uses the failure code to place a failed attempt", () => {
    const r = analyze(
      json(
        attempt({
          status: "FAILED",
          failure_code: "authentication_failed",
          failure_details: { code: "authentication_declined" },
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "authentication", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "authentication_declined",
      category: "authentication_failed",
      subCodes: { failure_code: "authentication_failed" },
    });
  });

  it("decodes a failure_code without failure_details at possible confidence", () => {
    const e = firstError(attempt({ status: "FAILED", failure_code: "system_unavailable" }));
    expect(e).toMatchObject({
      code: "system_unavailable",
      category: "provider_unavailable",
      confidence: "possible",
      retry: "retry_conditionally",
    });
  });

  it("converts amounts with the currency exponent", () => {
    expect(analyze(json(attempt({ amount: 5000, currency: "JPY" }))).events[0]!.amountMinor).toBe(
      "5000",
    );
    expect(analyze(json(attempt({ amount: 1.234, currency: "KWD" }))).events[0]!.amountMinor).toBe(
      "1234",
    );
    const tooPrecise = analyze(json(attempt({ amount: 10.5, currency: "JPY" }))).events[0]!;
    expect(tooPrecise.amountMinor).toBeUndefined();
    expect(tooPrecise.attributes.amountAsSupplied).toBe("10.5");
  });
});

describe("airwallex refunds and disputes", () => {
  it("reports a received refund as pending", () => {
    const r = analyzeFixture("refund-received.json");
    expect(r.events[0]).toMatchObject({
      eventType: "refund.snapshot",
      stage: "refund",
      outcome: "pending",
      paymentReference: "int_PPLsynthRefund0005",
      relatedReference: "att_PPLsynthRefund0005",
      amountMinor: "1000",
      attributes: { refundId: "rfd_PPLsynthRefund0005" },
    });
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("decodes a failed refund", () => {
    const r = analyzeFixture("refund-failed-webhook.json");
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "failure"]);
    expect(r.errors[0]).toMatchObject({
      code: "provider_declined",
      paymentReference: "int_PPLsynthRefund0050",
      attemptReference: "rfd_PPLsynthRefund0050",
      source: { path: "data.object.failure_details" },
    });
    const failure = r.findings.find((f) => f.ruleId === "PAYMENT_FAILURE");
    expect(failure?.title).toBe("Refund failed");
  });

  it("reports a chargeback after a captured payment", () => {
    const r = analyzeFixture("dispute-webhooks.json");
    expect(r.groups).toHaveLength(1);
    const dispute = r.events.find((e) => e.eventType === "payment_dispute.requires_response")!;
    expect(dispute).toMatchObject({
      stage: "dispute",
      outcome: "pending",
      providerStatus: "REQUIRES_RESPONSE",
      paymentReference: "int_PPLsynthDispute0060",
      relatedReference: "att_PPLsynthDispute0060",
      deliveryKey: "PPLsynth0dispute0000000000000062",
      attributes: {
        disputeId: "dst_PPLsynthDispute0060",
        disputeStage: "CHARGEBACK",
        disputeMode: "ALLOCATION",
        reasonType: "FRAUDULENT",
        reasonCode: "10.4",
        cardBrand: "visa",
        dueAt: "2026-10-30T20:00:00.000Z",
      },
    });
    const finding = r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED");
    expect(finding?.title).toBe("Chargeback after a successful payment");
  });

  it("reads the older dispute webhook shape", () => {
    const r = analyzeFixture("dispute-legacy-webhook.json");
    expect(r.events[0]).toMatchObject({
      stage: "dispute",
      outcome: "pending",
      providerStatus: "EVIDENCE_REQUIRED",
      amountMinor: "4200",
      currency: "SGD",
      eventTimestamp: "2026-10-15T08:17:27.659Z",
      attributes: {
        legacyDisputeShape: true,
        disputeId: "dst_PPLsynthLegacy0070",
        disputeStage: "DISPUTE",
        reasonType: "PRODUCT_NOT_RECEIVED",
        reasonCode: "4855",
        cardBrand: "mastercard",
        statusKnown: false,
        apiVersion: "2023-10-01",
      },
    });
    expect(ruleIds(r)).toContain("MISSING_REFERENCE");
  });

  it("maps final dispute statuses", () => {
    const won = analyze(json({ id: "dst_PPLsynth9001", stage: "CHARGEBACK", status: "WON" }));
    expect(won.events[0]).toMatchObject({ stage: "dispute", outcome: "success" });
    const lost = analyze(
      json(webhook("payment_dispute.lost", { id: "dst_PPLsynth9001", status: "LOST" })),
    );
    expect(lost.events[0]).toMatchObject({ stage: "dispute", outcome: "failure" });
  });
});

describe("airwallex webhooks", () => {
  it("builds one timeline for a card payment, capture, settlement and refund", () => {
    const r = analyzeFixture("card-lifecycle-webhooks.json");
    expect(r.records.every((x) => x.status === "analyzed")).toBe(true);
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.eventType)).toEqual([
      "payment_intent.created",
      "payment_attempt.authorized",
      "payment_intent.requires_capture",
      "payment_attempt.capture_requested",
      "payment_intent.succeeded",
      "payment_attempt.settled",
      "payment_attempt.paid",
      "refund.received",
      "refund.accepted",
    ]);
    expect(r.events.map((e) => `${e.stage}:${e.outcome}`)).toEqual([
      "payment:pending",
      "authorization:success",
      "authorization:success",
      "capture:success",
      "payment:success",
      "settlement:success",
      "settlement:success",
      "refund:pending",
      "refund:success",
    ]);
    expect(r.events.every((e) => e.eventTypeKnown && e.deliveryKey)).toBe(true);
    expect(r.events[0]).toMatchObject({
      eventReference: "evt_PPLsynth_lifecycle_0001",
      amountMinor: "25000",
      currency: "AUD",
      attributes: { apiVersion: "2026-08-21", eventFamily: "payment_intent" },
    });
    expect(r.events.at(-1)!.amountMinor).toBe("5000");
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("recognizes a duplicate delivery by event id", () => {
    const r = analyzeFixture("duplicate-webhook.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.observedTimestamp).toBe("2026-10-21T12:00:03.000Z");
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it("detects out-of-order arrival", () => {
    const r = analyzeFixture("out-of-order-webhooks.json");
    expect(r.events.map((e) => e.eventType)).toEqual([
      "payment_attempt.authorized",
      "payment_attempt.capture_requested",
      "payment_intent.succeeded",
    ]);
    expect(ruleIds(r)).toContain("OUT_OF_ORDER_ARRIVAL");
  });

  it("reports a capture failure after authorization", () => {
    const r = analyzeFixture("capture-failed-webhooks.json");
    expect(r.events[1]).toMatchObject({
      stage: "capture",
      outcome: "failure",
      providerStatus: "FAILED",
    });
    expect(r.errors[0]).toMatchObject({
      code: "capture_failed",
      confidence: "possible",
      retry: "manual_review",
      attemptReference: "att_PPLsynthCapture0040",
    });
    expect(ruleIds(r)).toContain("CAPTURE_FAILED_AFTER_AUTHORIZATION");
  });

  it("warns about repeated attempts after risk declines", () => {
    const r = analyzeFixture("repeated-risk-declines.json");
    expect(r.errors).toHaveLength(2);
    for (const e of r.errors)
      expect(e).toMatchObject({
        code: "risk_declined",
        category: "fraud_or_risk",
        retry: "do_not_retry",
      });
    const finding = r.findings.find((f) => f.ruleId === "POSSIBLE_RETRY_RISK");
    expect(finding?.title).toBe("2 attempts after a do-not-retry decline");
  });

  it("reads delivery headers without copying the signature", () => {
    const r = analyzeFixture("webhook-request.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment_attempt.authorized",
      amountMinor: "5000",
      currency: "JPY",
      attributes: { signatureHeaderPresent: true, deliveryTimestamp: "2026-10-24T08:00:00.000Z" },
    });
    expect(json(r.events)).not.toContain("PPLSYNTHSIGNATURE");
  });

  it("notes the test-event secret header without copying it", () => {
    const text = [
      "POST /PPLsynth/hooks HTTP/1.1",
      "Content-Type: application/json",
      "client-secret-key: PPLsynthTestEventSecret",
      "",
      json(webhook("payment_attempt.received", attempt({ status: "RECEIVED" }))),
    ].join("\n");
    const r = analyze(text);
    expect(r.events[0]!.attributes.testEventHeaderPresent).toBe(true);
    expect(json(r.events)).not.toContain("PPLsynthTestEventSecret");
    expect(toJsonReport(r)).not.toContain("PPLsynthTestEventSecret");
  });

  it("shows other documented payments events without semantics", () => {
    const r = analyzeFixture("consent-webhook.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payment_consent.verified",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      attributes: { documentedEvent: true, eventFamily: "payment_consent" },
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("keeps references for unknown event names of analyzed objects", () => {
    const r = analyze(json(webhook("payment_attempt.brand_new", attempt())));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
      paymentReference: "int_PPLsynthTest9001",
    });
  });

  it("falls back to the object's updated_at when created_at is missing", () => {
    const evt = webhook("payment_attempt.authorized", attempt());
    delete (evt as Record<string, unknown>).created_at;
    const r = analyze(json(evt));
    expect(r.events[0]).toMatchObject({
      eventTimestamp: "2026-10-20T09:00:01.000Z",
      attributes: { eventTimeSource: "data.object.updated_at" },
    });
  });

  it("accepts the camelCase envelope variant", () => {
    const r = analyze(
      json({
        id: "evt_PPLsynth_camel_9001",
        name: "refund.settled",
        accountId: "acct_PPLsynthAccount01",
        data: { object: { id: "rfd_PPLsynth9001", status: "SETTLED", amount: 5, currency: "USD" } },
        createdAt: "2026-10-20T09:00:00+0000",
      }),
    );
    expect(r.events[0]).toMatchObject({
      stage: "refund",
      outcome: "success",
      eventTimestamp: "2026-10-20T09:00:00.000Z",
    });
    expect(json(r.events)).not.toContain("acct_PPLsynthAccount01");
  });

  it("decodes the failed attempt embedded in an intent webhook", () => {
    const r = analyze(
      json(
        webhook(
          "payment_intent.payment_failed",
          intent({
            latest_payment_attempt: attempt({
              status: "FAILED",
              failure_code: "authorization_failed",
              provider_original_response_code: "1A",
              payment_method: { type: "card", card: { brand: "visa" } },
            }),
          }),
        ),
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "authorization_failed",
      category: "authentication_required",
      confidence: "strong",
      source: { path: "data.object.latest_payment_attempt" },
    });
  });

  it("recognizes payout webhooks but does not analyze them", () => {
    const r = analyzeFixture("payout-transfer-webhook.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "airwallex.payout_webhook",
    });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/payout webhooks are recognized/);
    expect(r.events).toEqual([]);
  });
});

describe("airwallex parse issues and malformed input", () => {
  it("reports a webhook without data.object as invalid", () => {
    const r = analyze(json({ ...webhook("payment_attempt.authorized", {}), data: {} }));
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/data\.object/);
  });

  it("reports wrong field types without throwing", () => {
    const refund = analyze(json({ id: "rfd_PPLsynth9001", status: "RECEIVED", amount: "ten" }));
    expect(refund.records[0]!.status).toBe("invalid");
    expect(refund.records[0]!.reasons.join(" ")).toMatch(/^amount:/);
    const evt = analyze(json(webhook("refund.received", { id: "rfd_PPLsynth9001", status: 3 })));
    expect(evt.records[0]!.status).toBe("invalid");
    expect(evt.records[0]!.reasons.join(" ")).toMatch(/data\.object\.status/);
    const dispute = analyze(json(webhook("payment_dispute.won", { status: "WON" })));
    expect(dispute.records[0]!.status).toBe("invalid");
  });

  it("rejects unknown formats in parse", () => {
    expect(airwallexAdapter.parse({}, "airwallex.nope")).toEqual({
      ok: false,
      issues: ['Unsupported Airwallex format "airwallex.nope".'],
    });
  });

  it("does not throw on malformed text", () => {
    const r = analyzeText('{"code": "issuer_declined", "trace_id": ', options);
    expect(r.ok).toBe(false);
    for (const input of [
      { id: "int_PPLsynth", status: "SUCCEEDED", latest_payment_attempt: "x" },
      { id: "att_PPLsynth", status: "FAILED", failure_details: [] },
      { code: "issuer_declined", trace_id: "PPLsynth", details: "x" },
    ]) {
      expect(() => analyze(json(input))).not.toThrow();
    }
  });
});

describe("airwallex correlation", () => {
  it("keeps unrelated payments apart even with the same merchant_order_id", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.outcome).sort()).toEqual(["success", "success"]);
    expect(r.events.find((e) => e.providerStatus === "CANCELLED")?.stage).toBe("cancellation");
  });

  it("links a snapshot, an attempt webhook and a refund through explicit ids", () => {
    const text = [
      json(intent({ status: "SUCCEEDED", latest_payment_attempt: { id: "att_PPLsynthTest9001" } })),
      json(webhook("payment_attempt.capture_requested", attempt({ status: "CAPTURE_REQUESTED" }))),
      json({
        id: "rfd_PPLsynth9001",
        status: "ACCEPTED",
        payment_attempt_id: "att_PPLsynthTest9001",
      }),
    ].join("\n");
    const r = analyze(text);
    expect(r.events).toHaveLength(3);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual([
      "att_PPLsynthTest9001",
      "int_PPLsynthTest9001",
    ]);
  });

  it("returns only explicit payment and attempt ids as correlation keys", () => {
    const r = analyzeFixture("payment-intent-succeeded.json");
    expect(airwallexAdapter.correlationKeys(r.events[0]!)).toEqual([
      "int_PPLsynthPaid0001",
      "att_PPLsynthPaid0001",
    ]);
  });
});

describe("airwallex sensitive data", () => {
  const planted: [string, string[]][] = [
    [
      "payment-intent-succeeded.json",
      [
        "eyJhbGciOiJIUzI1NiJ9",
        "PPLsynthClientSecretSignature0001",
        "411111",
        "2031",
        "PPLsynth Cardholder",
        "PPLsynthFingerprint0001",
        "PPLsynth.shopper@example.com",
        "+10000000001",
        "PPLsynthCAVV",
        "PPLsynthXID0001",
        "PPLS01",
        "PPLsynthARN",
        "PPLSYNTH STORE",
        "cus_PPLsynth0001",
        "PPLsynth-request-0001",
      ],
    ],
    ["payment-intent-declined.json", ["400000", "PPLsynth Shopper"]],
    ["requires-customer-action.json", ["PPLsynthRedirectKey0004", "domain_secure"]],
    ["issuer-declined.txt", ["PPLSYNTH ISSUING BANK"]],
    [
      "dispute-webhooks.json",
      ["PPLsynth issuer comment", "PPLsynthARN00000000000060", "acct_PPLsynthAccount01"],
    ],
    ["dispute-legacy-webhook.json", ["PPLsynth-merchant-account", "PPLsynth system"]],
    ["webhook-request.txt", ["PPLSYNTHSIGNATURE"]],
    [
      "card-lifecycle-webhooks.json",
      ["41111111", "PPLsynth Holder", "PPLS10", "acct_PPLsynthAccount01"],
    ],
    ["consent-webhook.json", ["cus_PPLsynth0110", "acct_PPLsynthAccount01"]],
  ];

  it.each(planted)(
    "keeps planted values of %s out of events, errors and the JSON report",
    (file, values) => {
      const r = analyzeFixture(file);
      const events = json(r.events);
      const errors = json(r.errors);
      const report = toJsonReport(r);
      const withIds = toJsonReport(r, { includeIdentifiers: true });
      for (const v of values) {
        expect(events, v).not.toContain(v);
        expect(errors, v).not.toContain(v);
        expect(report, v).not.toContain(v);
        expect(withIds, v).not.toContain(v);
      }
    },
  );

  it("flags sensitive input fields", () => {
    expect(analyzeFixture("payment-intent-succeeded.json").sensitiveData.detected).toBe(true);
  });

  it("scrubs secrets from provider messages", () => {
    const e = firstError(
      errorBody({ message: "Card 4111 1111 1111 1111 for PPLsynth@example.com was declined" }),
    );
    expect(e.providerMessage).not.toMatch(/4111 1111|example\.com/);
  });
});
