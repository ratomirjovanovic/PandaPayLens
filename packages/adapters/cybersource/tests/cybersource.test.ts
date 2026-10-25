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
  APPLICATION_NAMES,
  AVS_CODES,
  CITED_NUMERIC_CODES,
  CVN_CODES,
  CYBERSOURCE_ADAPTER_VERSION,
  MERCHANT_ADVICE_CODES,
  NUMERIC_REASON_CODES,
  OTHER_SERVICE_REASONS,
  PAYMENT_INSIGHTS,
  PAYMENT_REASONS,
  PAY_BY_BANK_STATUSES,
  REASONS,
  R_CODES,
  STATUSES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_PRODUCTS,
  cybersourceAdapter,
  cybersourceManifest,
} from "@pandapaylens/cybersource";
import defaultExport from "@pandapaylens/cybersource";
import { cybersourceManifest as manifestOnly } from "@pandapaylens/cybersource/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [cybersourceAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`cybersource/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const ID = "PPLsynth00000000009001";
const links = (id = ID) => ({
  self: { method: "GET", href: `/pts/v2/payments/${id}` },
  capture: { method: "POST", href: `/pts/v2/payments/${id}/captures` },
  authReversal: { method: "POST", href: `/pts/v2/payments/${id}/reversals` },
});
const response = (fields: Record<string, unknown> = {}) => ({
  _links: links(),
  clientReferenceInformation: { code: "PPLsynth-order-9001" },
  id: ID,
  orderInformation: { amountDetails: { authorizedAmount: "10.00", currency: "EUR" } },
  status: "AUTHORIZED",
  submitTimeUtc: "2026-10-20T09:00:00Z",
  ...fields,
});
const declined = (reason: string | undefined, extra: Record<string, unknown> = {}) =>
  response({
    _links: undefined,
    status: "DECLINED",
    errorInformation: reason ? { reason, message: "Synthetic decline message" } : undefined,
    ...extra,
  });
const envelope = (eventType: string, fields: Record<string, unknown> = {}) => ({
  eventType,
  webhookId: "PPLsynth-webhook-9001",
  productId: "payments",
  organizationId: "PPLsynth_org_9001",
  eventDate: "2026-10-20T10:00:01",
  transactionTraceId: "PPLsynth-trace-9001",
  retryNumber: 0,
  payload:
    "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0.PPLsynthK.PPLsynthI.PPLsynthC.PPLsynthT",
  requestType: "NEW",
  ...fields,
});
const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;

describe("cybersource detection", () => {
  it.each([
    [response(), "cybersource.payment_response", 0.98, true],
    [declined("INSUFFICIENT_FUND"), "cybersource.payment_response", 0.98, true],
    [
      { id: ID, status: "DECLINED", clientReferenceInformation: { code: "x" } },
      "cybersource.payment_response",
      0.5,
      true,
    ],
    [
      {
        submitTimeUtc: "2026-10-20T13:00:00Z",
        status: "INVALID_REQUEST",
        reason: "MISSING_FIELD",
        message: "x",
      },
      "cybersource.error_response",
      0.8,
      true,
    ],
    [
      { status: "SERVER_ERROR", reason: "SERVER_TIMEOUT", message: "x" },
      "cybersource.error_response",
      0.45,
      true,
    ],
    [envelope("payments.capture.status.accepted"), "cybersource.webhook", 0.98, true],
    [
      JSON.parse(fixture("cybersource/pay-by-bank-notification.json")),
      "cybersource.webhook",
      0.98,
      true,
    ],
    [
      JSON.parse(fixture("cybersource/transaction-details-declined.json")),
      "cybersource.transaction_details",
      0.98,
      true,
    ],
    [
      JSON.parse(fixture("cybersource/pay-by-bank-decrypted.json")),
      "cybersource.pay_by_bank_payload",
      0.98,
      true,
    ],
    [
      JSON.parse(fixture("cybersource/encrypted-response.json")),
      "cybersource.encrypted_message",
      0.85,
      false,
    ],
    [{ encryptedRequest: "not-a-jwe" }, "cybersource.encrypted_message", 0.6, false],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(cybersourceAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("raises a flat error body that arrived with the matching HTTP status", () => {
    const meta = (status: number): RecordMeta => ({
      format: "http",
      http: { kind: "response", status, headers: {} },
    });
    const body = { status: "SERVER_ERROR", reason: "SERVER_TIMEOUT", message: "x" };
    expect(cybersourceAdapter.detect(body, meta(502)).confidence).toBe(0.55);
    expect(cybersourceAdapter.detect(body, meta(400)).confidence).toBe(0.45);
  });

  it("uses the v-c- notification headers", () => {
    const body = { eventType: "x.y.z", productId: "somethingNew" };
    expect(cybersourceAdapter.detect(body).confidence).toBe(0.45);
    const meta: RecordMeta = {
      format: "http",
      http: { kind: "request", headers: { "v-c-event-type": "x.y.z" } },
    };
    expect(cybersourceAdapter.detect(body, meta)).toMatchObject({
      format: "cybersource.webhook",
      confidence: 0.6,
    });
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "cybersource", message: "Cybersource error" },
      "cybersource",
      null,
      [],
      {},
      { status: "DECLINED" },
      { status: "AUTHORIZED", id: ID },
      { status: "INVALID_REQUEST", reason: "not upper case" },
      { status: "ERROR", reason: "MISSING_FIELD" },
      { error: "INVALID_REQUEST" },
      { eventType: "payments.capture.status.accepted" },
      { eventType: "payments.capture.status.accepted", webhookId: "w", eventDate: "d" },
      {
        eventType: "net.example.payment.created",
        webhookId: "w",
        notificationId: "n",
        payload: {},
      },
      { encryptedResponse: "x", other: 1 },
      { applicationInformation: { applications: [{ name: "auth" }] } },
      { "paymentProviderTransaction.status": "AC100", status: "2", id: "x" },
    ]) {
      expect(cybersourceAdapter.detect(input).confidence).toBe(0);
    }
    for (const input of [
      { status: "DECLINED", clientReferenceInformation: {} },
      { status: "INVALID_REQUEST", reason: "MISSING_FIELD", message: "m" },
      { eventType: "x.y.z", productId: "p" },
    ]) {
      expect(cybersourceAdapter.detect(input).confidence).toBeLessThanOrEqual(0.5);
    }
  });

  it("never claims Stripe-shaped objects or form-encoded input", () => {
    expect(cybersourceAdapter.detect({ ...response(), object: "payment_intent" }).confidence).toBe(
      0,
    );
    expect(cybersourceAdapter.detect(response(), { format: "form" }).confidence).toBe(0);
  });

  it("returns confidence 0 for every record of the other providers' fixtures", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "cybersource")
      .map((d) => d.name)
      .filter((d) => readdirSync(`${root}${d}`).length > 0);
    expect(dirs).toEqual(
      expect.arrayContaining(["stripe", "adyen", "checkout", "decta", "trustly"]),
    );
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
            cybersourceAdapter.detect(payload, parsed.value.meta[i]).confidence,
            `${dir}/${file} record ${i}`,
          ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("analyzes every own fixture without unsupported records, except the encrypted wrapper", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/cybersource/", import.meta.url));
    for (const file of readdirSync(root)) {
      const r = analyze(readFileSync(`${root}${file}`, "utf8"));
      const expected = file === "encrypted-response.json" ? "unsupported" : "analyzed";
      for (const rec of r.records) expect(rec.status, file).toBe(expected);
      expect(readFileSync(`${root}${file}`, "utf8")).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});

describe("cybersource parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noId = analyze(json({ status: "AUTHORIZED", submitTimeUtc: "2026-10-20T09:00:00Z" }));
    expect(noId.records[0]).toMatchObject({
      status: "invalid",
      format: "cybersource.payment_response",
    });
    expect(noId.records[0]!.reasons.join(" ")).toMatch(/^id:/);

    const noAppInfo = analyze(
      json({
        id: ID,
        rootId: ID,
        applicationInformation: "missing",
        _links: { self: { href: `/tss/v2/transactions/${ID}` } },
      }),
    );
    expect(noAppInfo.records[0]!.status).toBe("unsupported");

    const badTd = analyze(
      json({
        rootId: ID,
        applicationInformation: { applications: [{ name: "ics_auth", reasonCode: { x: 1 } }] },
      }),
    );
    expect(badTd.records[0]).toMatchObject({
      status: "invalid",
      format: "cybersource.transaction_details",
    });
    expect(badTd.warnings.some((w) => w.code === "INVALID_RECORD")).toBe(true);
  });

  it("rejects unknown formats and tolerates null values and unknown fields", () => {
    expect(cybersourceAdapter.parse({}, "cybersource.unknown")).toMatchObject({ ok: false });
    const r = analyze(
      json(
        response({
          processorInformation: null,
          errorInformation: null,
          newField: { nested: true },
        }),
      ),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({ outcome: "success", stage: "authorization" });
  });

  it("fails cleanly on malformed input and reports XML as an unsupported record", () => {
    expect(analyzeText("{not json", options)).toMatchObject({ ok: false });
    expect(analyzeText('<?xml version="1.0"?><requestMessage/>', options)).toMatchObject({
      ok: true,
      result: { records: [{ status: "unsupported" }], events: [] },
    });
    const truncated = analyzeText('{"status":"AUTHORIZED","id":"PPLsynth1"', options);
    expect(truncated.ok).toBe(false);
  });

  it("accepts lenient JSON with a warning", () => {
    const text = `{
      // pasted from a log
      "id": "${ID}",
      "status": "AUTHORIZED",
      "submitTimeUtc": "2026-10-20T09:00:00Z",
      "_links": { "self": { "href": "/pts/v2/payments/${ID}" }, },
    }`;
    const r = analyze(text);
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.warnings.some((w) => w.code === "LENIENT_JSON")).toBe(true);
  });

  it("recognizes but does not analyze a body wrapped in message-level encryption", () => {
    const r = analyzeFixture("encrypted-response.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "cybersource.encrypted_message",
    });
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(
      /message-level encryption/,
    );
    expect(r.events).toHaveLength(0);
  });
});

describe("cybersource payment responses", () => {
  it("normalizes a successful authorization", () => {
    const r = analyzeFixture("authorization-approved.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      provider: "cybersource",
      sourceFormat: "cybersource.payment_response",
      eventType: "authorization.AUTHORIZED",
      eventTypeKnown: true,
      stage: "authorization",
      providerStatus: "AUTHORIZED",
      paymentReference: "PPLsynth00000000000101",
      merchantReference: "PPLsynth-order-0101",
      eventTimestamp: "2026-10-20T09:00:00.000Z",
      amountMinor: "10000",
      currency: "USD",
      outcome: "success",
      attributes: {
        operation: "authorization",
        operationInferredFrom: "_links",
        processorResponseCode: "00",
        avsCode: "Y",
      },
    });
    expect(r.errors).toHaveLength(0);
    expect(r.findings.filter((f) => f.severity !== "info")).toHaveLength(0);
  });

  it("decodes a decline from errorInformation.reason with Cybersource's retry insight", () => {
    const r = analyzeFixture("declined-insufficient-funds.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.DECLINED",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth00000000000201",
      attributes: {
        httpStatus: 201,
        reason: "INSUFFICIENT_FUND",
        processorResponseCode: "51",
        paymentInsightsCategoryCode: "02",
      },
    });
    expect(r.errors[0]).toMatchObject({
      code: "INSUFFICIENT_FUND",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Decline - Insufficient funds in the account.",
      paymentReference: "PPLsynth00000000000201",
      attemptReference: "PPLsynth00000000000201",
      subCodes: {
        status: "DECLINED",
        http_status: "201",
        processor_response_code: "51",
        payment_insights_category_code: "02",
      },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/15 retries over 30 days/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("keeps the conflicting PROCESSOR_ERROR meaning at possible confidence", () => {
    const r = analyzeFixture("declined-processor-error.json");
    expect(r.errors[0]).toMatchObject({
      code: "PROCESSOR_ERROR",
      category: "card_declined",
      confidence: "possible",
      retry: "do_not_retry",
      providerMessage: "Invalid account",
    });
    expect(r.errors[0]!.explanation).toMatch(/inconsistent/);
    expect(r.errors[0]!.retryExplanation).toMatch(/never approve/);
  });

  it("applies payment insights and merchant advice to declines only", () => {
    const success = analyze(
      json(response({ paymentInsightsInformation: { responseInsights: { categoryCode: "01" } } })),
    );
    expect(success.errors).toHaveLength(0);

    const mc = firstError(
      declined("PROCESSOR_DECLINED", {
        processorInformation: { merchantAdvice: { code: "24", codeRaw: "M024" } },
      }),
    );
    expect(mc).toMatchObject({
      retry: "customer_action_required",
      subCodes: { merchant_advice_code: "24" },
    });
    expect(mc.retryExplanation).toMatch(/Mastercard merchant advice code 24: Retry after 1 hour/);

    const visa = firstError(
      declined("ISSUER_UNAVAILABLE", { processorInformation: { merchantAdvice: { code: "1" } } }),
    );
    expect(visa).toMatchObject({ retry: "do_not_retry", outcomeKnown: true });
    expect(visa.retryExplanation).toMatch(/Visa merchant advice code 1.*stricter/);

    const unknownAdvice = firstError(
      declined("GENERAL_DECLINE", { processorInformation: { merchantAdvice: { code: "77" } } }),
    );
    expect(unknownAdvice.missingInformation.join(" ")).toMatch(/"77" is not documented/);
  });

  it("shows a partial authorization with the requested amount", () => {
    const r = analyzeFixture("partial-authorization.json");
    expect(r.events[0]).toMatchObject({
      eventType: "authorization.PARTIAL_AUTHORIZED",
      outcome: "success",
      amountMinor: "7000",
      currency: "EUR",
      attributes: { requestedAmountMinor: "10000" },
    });
    expect(r.errors).toHaveLength(0);
  });

  it("decodes reviews and authentication requests without calling them declines", () => {
    const review = analyzeFixture("authorization-review.json");
    expect(review.events[0]).toMatchObject({
      stage: "payment",
      outcome: "pending",
      providerStatus: "AUTHORIZED_PENDING_REVIEW",
    });
    expect(review.errors[0]).toMatchObject({
      code: "AVS_FAILED",
      category: "fraud_or_risk",
      retry: "manual_review",
    });
    expect(review.errors[0]!.retryExplanation).toMatch(/Capture is possible after a fraud review/);

    const auth = analyzeFixture("pending-authentication.json");
    expect(auth.events[0]).toMatchObject({ stage: "authentication", outcome: "pending" });
    expect(auth.errors[0]).toMatchObject({
      code: "CONSUMER_AUTHENTICATION_REQUIRED",
      category: "authentication_required",
      retry: "customer_action_required",
    });
    expect(ruleIds(auth)).toContain("UNRESOLVED_OUTCOME");
  });

  it("classifies sales, voids, captures, refunds and reversals by their links and amounts", () => {
    const sale = analyzeFixture("sale-and-void.json");
    expect(sale.events.map((e) => [e.eventType, e.stage, e.outcome, e.amountMinor])).toEqual([
      ["sale.AUTHORIZED", "payment", "success", "1200"],
      ["void.VOIDED", "void", "success", "1200"],
    ]);
    // A void response does not echo the sale id, so the two stay apart.
    expect(sale.groups).toHaveLength(2);
    expect(sale.events[1]).toMatchObject({ relatedReference: "PPLsynth00000000000802" });
    expect(sale.events[1]!.paymentReference).toBeUndefined();

    const pending = analyze(
      json({ id: ID, status: "PENDING", submitTimeUtc: "2026-10-20T09:00:00Z" }),
    );
    expect(pending.events[0]).toMatchObject({
      eventType: "follow_on.PENDING",
      stage: "other",
      outcome: "pending",
      attributes: { operationInferredFrom: "status" },
    });

    const refund = analyze(
      json({
        _links: { self: { href: `/pts/v2/refunds/${ID}` } },
        id: ID,
        status: "DECLINED",
        errorInformation: { reason: "CAPTURE_ALREADY_VOIDED" },
        submitTimeUtc: "2026-10-20T09:00:00Z",
      }),
    );
    expect(refund.events[0]).toMatchObject({
      eventType: "refund.DECLINED",
      stage: "refund",
      outcome: "failure",
    });
    expect(ruleIds(refund)).toContain("PAYMENT_FAILURE");
  });

  it("treats a SERVER_ERROR inside a 201 as an unknown outcome", () => {
    const r = analyze(
      json(
        declined(undefined, {
          status: "SERVER_ERROR",
          errorInformation: { reason: "PROCESSOR_TIMEOUT" },
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({ outcome: "unknown", stage: "payment" });
    expect(r.errors[0]).toMatchObject({
      code: "PROCESSOR_TIMEOUT",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("reports unrecognized reasons and reason-less declines honestly", () => {
    const unknown = firstError(declined("SOMETHING_NEW"));
    expect(unknown).toMatchObject({
      code: "SOMETHING_NEW",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/new reasons can be added/);

    const none = firstError(declined(undefined));
    expect(none).toMatchObject({
      code: "DECLINED",
      category: "unknown",
      confidence: "insufficient",
    });

    const enumOnly = firstError(declined("DAGGDENIED"));
    expect(enumOnly).toMatchObject({ category: "unknown", confidence: "insufficient" });
    expect(enumOnly.explanation).toMatch(/only as an enum name/);

    const nameOnly = firstError(declined("BLOCKED_BY_CARDHOLDER"));
    expect(nameOnly).toMatchObject({ confidence: "possible", retry: "do_not_retry" });

    const unknownStatus = analyze(json(response({ status: "BRAND_NEW_STATUS" })));
    expect(unknownStatus.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(ruleIds(unknownStatus)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("cybersource error responses", () => {
  it("decodes a 400 validation error with its field list", () => {
    const r = analyzeFixture("validation-error.txt");
    expect(r.records[0]).toMatchObject({ format: "cybersource.error_response" });
    expect(r.events[0]).toMatchObject({
      eventType: "error.MISSING_FIELD",
      stage: "error",
      outcome: "failure",
      attributes: {
        httpStatus: 400,
        errorFields: [
          "orderInformation.amountDetails.totalAmount (MISSING_FIELD)",
          "paymentInformation.card.expirationYear (MISSING_FIELD)",
        ],
      },
    });
    expect(r.errors[0]).toMatchObject({
      code: "MISSING_FIELD",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: { status: "INVALID_REQUEST", http_status: "400" },
    });
    expect(r.errors[0]!.explanation).toMatch(/paymentInformation\.card\.expirationYear/);
    expect(r.suggestedView).toBe("decoder");
  });

  it("never presents a server timeout as safe to retry", () => {
    const r = analyzeFixture("server-timeout.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "error.SERVER_TIMEOUT",
      outcome: "unknown",
      relatedReference: "PPLsynth00000000000901",
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "SERVER_TIMEOUT",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: false,
      paymentReference: "PPLsynth00000000000901",
    });
    expect(e.retryExplanation).toMatch(/automatic reversal/);
    expect(e.retryExplanation).toMatch(/confirm the final state/);
    expect(e.documentation.map((d) => d.title).join(" ")).toMatch(/timeout scenarios/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes duplicate, configuration and unknown 400/502 reasons", () => {
    const dup = firstError({
      status: "INVALID_REQUEST",
      reason: "DUPLICATE_REQUEST",
      submitTimeUtc: "2026-10-20T09:00:00Z",
    });
    expect(dup).toMatchObject({ category: "duplicate_request", retry: "do_not_retry" });
    expect(dup.retryExplanation).toMatch(/Check the status of the original request/);

    const cfg = firstError({
      status: "SERVER_ERROR",
      reason: "INVALID_OR_MISSING_CONFIG",
      submitTimeUtc: "2026-10-20T09:00:00Z",
    });
    expect(cfg).toMatchObject({
      category: "configuration",
      retry: "do_not_retry",
      outcomeKnown: false,
    });

    const unknown = firstError({
      status: "SERVER_ERROR",
      reason: "NEW_SERVER_REASON",
      submitTimeUtc: "2026-10-20T09:00:00Z",
    });
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "retry_conditionally",
      confidence: "insufficient",
      outcomeKnown: false,
    });
  });
});

describe("cybersource timelines and correlation", () => {
  it("builds one group for an authorization, capture and refund linked by Transaction Details", () => {
    const r = analyzeFixture("capture-and-refund-flow.json");
    expect(r.records.every((x) => x.status === "analyzed")).toBe(true);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["authorization.AUTHORIZED", "authorization", "success"],
      ["capture.PENDING", "capture", "pending"],
      ["transaction_details.ics_bill", "other", "success"],
      ["refund_or_credit.PENDING", "refund", "pending"],
      ["transaction_details.ics_credit", "refund", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining([
        "PPLsynth00000000000601",
        "PPLsynth00000000000602",
        "PPLsynth00000000000603",
      ]),
    );
    expect(r.events[3]).toMatchObject({ amountMinor: "4000", currency: "EUR" });
    expect(r.events[2]).toMatchObject({
      paymentReference: "PPLsynth00000000000601",
      relatedReference: "PPLsynth00000000000602",
      attributes: { applications: ["ics_bill"], rCode: "1", reasonCode: "100" },
    });
    expect(r.errors).toHaveLength(0);
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("links a reversal through Transaction Details", () => {
    const r = analyzeFixture("authorization-reversed.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.stage)).toEqual(["authorization", "reversal", "reversal"]);
    expect(r.events[1]).toMatchObject({ amountMinor: "5550", currency: "USD", outcome: "success" });
  });

  it("keeps unrelated transactions apart even with the same merchant reference", () => {
    const r = analyzeFixture("unrelated-authorizations.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "PPLsynth-order-shared",
      "PPLsynth-order-shared",
    ]);
  });

  it("groups an incremental authorization with the original by the same request id", () => {
    const r = analyze(
      json([
        response(),
        response({
          submitTimeUtc: "2026-10-20T12:00:00Z",
          orderInformation: { amountDetails: { authorizedAmount: "5.00", currency: "EUR" } },
        }),
      ]),
    );
    expect(r.groups).toHaveLength(1);
  });

  it("links a 502 timeout and its later Transaction Details lookup by request id", () => {
    const r = analyze(
      json([
        {
          id: ID,
          submitTimeUtc: "2026-10-20T09:00:00Z",
          status: "SERVER_ERROR",
          reason: "SERVER_TIMEOUT",
          message: "x",
        },
        {
          id: ID,
          submitTimeUTC: "2026-10-20T09:00:00Z",
          applicationInformation: {
            rCode: 1,
            reasonCode: 100,
            applications: [{ name: "ics_auth", reasonCode: 100, rCode: 1 }],
          },
        },
      ]),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.outcome).sort()).toEqual(["success", "unknown"]);
  });

  it("uses relatedTransactions links as keys", () => {
    const r = analyze(
      json([
        response(),
        {
          id: "PPLsynth00000000009002",
          submitTimeUTC: "2026-10-20T10:00:00Z",
          applicationInformation: { applications: [{ name: "ics_bill" }] },
          _links: { relatedTransactions: [{ href: `/tss/v2/transactions/${ID}`, method: "GET" }] },
        },
      ]),
    );
    expect(r.groups).toHaveLength(1);
  });
});

describe("cybersource Transaction Details", () => {
  it("decodes a numeric reason code", () => {
    const r = analyzeFixture("transaction-details-declined.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transaction_details.ics_auth",
      stage: "authorization",
      outcome: "failure",
      paymentReference: "PPLsynth00000000001601",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "204",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: { application: "ics_auth" },
    });
  });

  it("keeps timeouts and uncited codes honest", () => {
    const td = (code: string, rCode?: number) =>
      firstError({
        id: ID,
        applicationInformation: {
          ...(rCode !== undefined ? { rCode } : {}),
          applications: [{ name: "ics_auth", reasonCode: code }],
        },
      });
    expect(td("151")).toMatchObject({ retry: "retry_conditionally", outcomeKnown: false });
    expect(td("267")).toMatchObject({ confidence: "possible", outcomeKnown: false });
    expect(td("999")).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
      outcomeKnown: false,
    });
    expect(td("154")).toMatchObject({ retry: "safe_to_retry_technical_request" });
    const timeout = analyze(
      json({
        id: ID,
        applicationInformation: { reasonCode: "151", applications: [{ name: "ics_auth" }] },
      }),
    );
    expect(timeout.events[0]!.outcome).toBe("unknown");
    expect(timeout.errors[0]!.code).toBe("151");
  });

  it("shows undescribed services without a lifecycle stage", () => {
    const r = analyze(
      json({
        id: ID,
        applicationInformation: {
          rCode: "-1",
          applications: [{ name: "ics_decision" }, { name: "ics_ap_new" }],
        },
      }),
    );
    expect(r.events[0]).toMatchObject({ stage: "other", outcome: "unknown", eventTypeKnown: true });
    const unknown = analyze(
      json({ id: ID, applicationInformation: { applications: [{ name: "ics_ap_new" }] } }),
    );
    expect(unknown.events[0]).toMatchObject({ eventTypeKnown: false, stage: "other" });
  });
});

describe("cybersource webhooks", () => {
  it("places an encrypted payment notification on the timeline by its event type", () => {
    const r = analyzeFixture("webhook-capture-accepted.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "cybersource.webhook" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "payments.capture.status.accepted",
      eventTypeKnown: true,
      stage: "capture",
      outcome: "pending",
      eventReference: "PPLsynth-trace-1101",
      attributes: {
        productId: "payments",
        eventDate: "2026-10-20T10:05:01",
        requestType: "NEW",
        retryNumber: 0,
        payloadFormat: "jwe",
        payloadEncrypted: true,
        payloadEncryptionRequired: true,
        documentedStatuses: ["PENDING"],
        signatureHeaderPresent: true,
      },
    });
    // eventDate has no time zone, so it is not used as an event time.
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.paymentReference).toBeUndefined();
    expect(e.deliveryKey).toMatch(/^payments\.capture\.status\.accepted:[0-9a-f]{16}$/);
    expect(ruleIds(r)).toContain("MISSING_REFERENCE");
  });

  it("reports a retried delivery as a duplicate even though the trace id changed", () => {
    const r = analyzeFixture("webhook-duplicate-delivery.json");
    expect(r.events).toHaveLength(3);
    const [a, b, c] = [...r.events].sort((x, y) => x.sourceIndex - y.sourceIndex);
    expect(a!.eventReference).not.toBe(b!.eventReference);
    expect(a!.deliveryKey).toBe(b!.deliveryKey);
    // Same type and second but a different ciphertext is a different event.
    expect(c!.deliveryKey).not.toBe(a!.deliveryKey);
    const dup = r.findings.filter((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toHaveLength(1);
    expect(dup[0]!.evidenceEventIds).toHaveLength(2);
    expect(dup[0]!.explanation).toMatch(/documents that it can deliver the same notification/);
    expect(r.events.every((e) => e.observedTimestamp)).toBe(true);
  });

  it("decodes a rejected authorization notification without guessing the reason", () => {
    const r = analyzeFixture("webhook-authorization-rejected.json");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "payments.authorization.status.rejected",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.explanation).toMatch(/SERVER_TIMEOUT/);
    expect(r.errors[0]!.explanation).toMatch(/encrypted payload/);
  });

  it("reads a documented plain envelope without copying token data", () => {
    const r = analyzeFixture("webhook-token-provisioned.json");
    expect(r.events[0]).toMatchObject({
      eventType: "tms.networktoken.provisioned",
      stage: "other",
      outcome: "success",
      attributes: { payloadFormat: "object", payloadDataType: "tokenizedCardEnrollments" },
    });
    const text = JSON.stringify(r.events);
    expect(text).not.toContain("PPLsynthTOKENENROLLMENT0001");
    expect(text).not.toContain("PPLsynthPI0001");
    expect(text).not.toContain("PPLsynth_org");
    expect(text).not.toContain("PPLsynth-webhook");
  });

  it("maps documented event types and keeps unknown ones unknown", () => {
    const ev = (type: string, fields: Record<string, unknown> = {}) =>
      analyze(json(envelope(type, fields))).events[0]!;
    expect(ev("payments.refund.status.updated")).toMatchObject({
      stage: "refund",
      outcome: "success",
    });
    expect(ev("payments.credit.status.updated")).toMatchObject({
      stage: "refund",
      outcome: "unknown",
    });
    expect(ev("payments.void.status.rejected")).toMatchObject({
      stage: "void",
      outcome: "failure",
    });
    expect(ev("rbs.subscriptions.charge.failed", { productId: "recurringBilling" })).toMatchObject({
      stage: "payment",
      outcome: "failure",
      isRecurring: true,
    });
    expect(
      ev("risk.profile.decision.review", { productId: "fraudManagementEssentials" }),
    ).toMatchObject({
      stage: "other",
      outcome: "pending",
    });
    const unknown = analyze(json(envelope("payments.something.new")));
    expect(unknown.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(ruleIds(unknown)).toContain("UNKNOWN_EVENT_TYPE");
    expect(
      analyze(
        json(envelope("rbs.subscriptions.charge.failed", { productId: "recurringBilling" })),
      ).findings.map((f) => f.ruleId),
    ).toContain("RECURRING_PAYMENT_FAILED");
  });

  it("does not set a delivery key without a payload", () => {
    const r = analyze(json(envelope("payments.capture.status.accepted", { payload: undefined })));
    expect(r.events[0]!.deliveryKey).toBeUndefined();
  });
});

describe("cybersource Pay by Bank", () => {
  it("reads the encrypted notification envelope", () => {
    const r = analyzeFixture("pay-by-bank-notification.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payments.payments.updated",
      stage: "payment",
      outcome: "unknown",
      attributes: {
        productId: "alternativePaymentMethods",
        payloadFormat: "cbc_prefixed",
        payloadEncrypted: true,
        notificationTypeId: "5",
        notificationReason: "payment",
      },
    });
    // The trace id equals the payment id in the documented example; it is not
    // used as a payment reference.
    expect(r.events[0]!.paymentReference).toBeUndefined();
  });

  it("reads a decrypted payload alone and inside the envelope", () => {
    const alone = analyzeFixture("pay-by-bank-decrypted.json");
    expect(alone.events[0]).toMatchObject({
      eventType: "pay_by_bank.SETTLED",
      stage: "settlement",
      outcome: "success",
      providerStatus: "settled",
      paymentReference: "PPLsynth00000000001501",
      merchantReference: "PPLsynth-order-1501",
      amountMinor: "199999",
      currency: "GBP",
      eventTimestamp: "2026-10-21T17:38:48.000Z",
    });
    const inside = analyze(
      json({
        ...JSON.parse(fixture("cybersource/pay-by-bank-notification.json")),
        payload: {
          ...JSON.parse(fixture("cybersource/pay-by-bank-decrypted.json")),
          status: "failed",
        },
      }),
    );
    expect(inside.events[0]).toMatchObject({
      eventType: "payments.payments.updated",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth00000000001501",
    });
    expect(inside.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
    const both = analyze(
      json([
        JSON.parse(fixture("cybersource/pay-by-bank-decrypted.json")),
        {
          ...JSON.parse(fixture("cybersource/pay-by-bank-notification.json")),
          payload: JSON.parse(fixture("cybersource/pay-by-bank-decrypted.json")),
        },
      ]),
    );
    expect(both.groups).toHaveLength(1);
  });
});

describe("cybersource sensitive data", () => {
  const PLANTED = [
    "PLANTEDMERCHANTHEADER01",
    "PLANTEDMERCHANTID01",
    "PlantedFirst",
    "PlantedLast",
    "77 Planted Synthetic Road",
    "Plantedville",
    "PL4NT",
    "planted.person@example.com",
    "5557777777",
    "4111111111111111",
    "737",
    "2031",
    "PLANTEDCRYPTOGRAM0001",
    "PLANTEDBANKACCOUNT01",
    "PLANTEDROUTING01",
    "PLANTEDCUSTOMERID01",
    "PLANTEDHASHEDPASSWORD01",
    "198.51.100.77",
    "planted-host.example",
    "PLANTEDCAVV0001",
    "PLANTEDXID0001",
    "PLANTEDCAPNDATA01",
    "PLANTEDAUTHCODE",
    "PLANTEDMERCHANTNO01",
    "PLANTEDNETWORKTXN01",
    "PLANTEDPAR0000000001",
    "PLANTEDRRN01",
    "PLANTEDSTAN01",
    "planted.details@example.com",
    "PLANTEDAVSRAW",
    "PLANTEDRECONCILIATION01",
    "PPLsynth-txn-1701",
  ];

  it("keeps planted values out of events and the JSON report", () => {
    const r = analyzeFixture("sensitive-response.txt");
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "cybersource.payment_response",
    });
    expect(r.sensitiveData.detected).toBe(true);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(r.events[0]!.attributes.processorResponseDetails).toBe("contact [redacted]");
  });

  it("never copies webhook signatures, subscription or organization ids", () => {
    const planted = [
      "PLANTEDSIGVALUE0001",
      "PLANTEDKEYID0001",
      "PLANTEDWEBHOOKID0001",
      "PLANTEDORGID0001",
      "PLANTEDCIPHER0001",
    ];
    const text = [
      "POST /PPLsynth/notifications HTTP/1.1",
      "Content-Type: application/json",
      "v-c-signature: t=1792490400;keyId=PLANTEDKEYID0001;sig=PLANTEDSIGVALUE0001",
      "v-c-webhook-id: PLANTEDWEBHOOKID0001",
      "v-c-organization-id: PLANTEDORGID0001",
      "",
      json(
        envelope("payments.refund.status.accepted", {
          webhookId: "PLANTEDWEBHOOKID0001",
          organizationId: "PLANTEDORGID0001",
          payload: "{CBC}PLANTEDCIPHER0001",
        }),
      ),
    ].join("\n");
    const r = analyze(text);
    expect(r.records[0]!.status).toBe("analyzed");
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });
});

describe("cybersource manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(cybersourceAdapter);
    expect(cybersourceAdapter.manifest).toBe(cybersourceManifest);
    expect(manifestOnly).toBe(cybersourceManifest);
    expect(cybersourceAdapter.version).toBe(CYBERSOURCE_ADAPTER_VERSION);
  });

  it("declares honest metadata and capabilities", () => {
    expect(cybersourceManifest).toMatchObject({
      id: "cybersource",
      version: "0.1.0",
      wave: 2,
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
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
    expect([...cybersourceManifest.categories].sort()).toEqual(["gateway", "orchestration"]);
    for (const s of cybersourceManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(developer|www)\.cybersource\.com\//);
    expect(cybersourceManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(
      /adult|crypto|dating|nutra|gaming|gambling/,
    );
    expect(cybersourceManifest.delivery.duplicateKey).toMatch(
      /transactionTraceId is new on every retry/,
    );
    const limits = cybersourceManifest.limitations.join(" ");
    expect(limits).toMatch(/decrypted payload of card payment events is not documented/);
    expect(limits).toMatch(/PROCESSOR_ERROR/);
    expect(limits).toMatch(/never treated as authentic/);
    expect(limits).toMatch(/not documented/);
    const families = Object.fromEntries(
      cybersourceManifest.apiFamilies.map((f) => [f.id, f.status]),
    );
    expect(families).toMatchObject({
      "cybersource.payment_response": "supported",
      "cybersource.error_response": "supported",
      "cybersource.webhook": "limited",
      "cybersource.transaction_details": "experimental",
      "cybersource.encrypted_message": "unsupported",
    });
    for (const f of cybersourceAdapter.supportedFormats) expect(families[f.id]).toBeDefined();
  });

  it("contains every documented code, status and event", () => {
    expect(Object.keys(STATUSES)).toHaveLength(20);
    expect(Object.keys(PAYMENT_REASONS)).toHaveLength(63);
    expect(Object.keys(OTHER_SERVICE_REASONS)).toHaveLength(14);
    expect(Object.keys(REASONS)).toHaveLength(77);
    expect(Object.keys(NUMERIC_REASON_CODES)).toHaveLength(89);
    expect(Object.keys(CITED_NUMERIC_CODES)).toEqual(["267"]);
    expect(Object.keys(AVS_CODES)).toHaveLength(29);
    expect(Object.keys(CVN_CODES)).toHaveLength(11);
    expect(Object.keys(MERCHANT_ADVICE_CODES)).toHaveLength(22);
    expect(Object.keys(PAYMENT_INSIGHTS)).toHaveLength(7);
    expect(Object.keys(WEBHOOK_EVENT_TYPES)).toHaveLength(42);
    expect(WEBHOOK_PRODUCTS.size).toBe(10);
    expect(Object.keys(R_CODES)).toHaveLength(3);
    expect(Object.keys(PAY_BY_BANK_STATUSES)).toHaveLength(7);
    expect(Object.keys(APPLICATION_NAMES)).toHaveLength(6);
    for (const e of Object.values(WEBHOOK_EVENT_TYPES))
      for (const p of e.products) expect(WEBHOOK_PRODUCTS.has(p)).toBe(true);
    expect(REASONS.constructor).toBeDefined();
    expect(firstError(declined("constructor")).confidence).toBe("insufficient");
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      cybersourceManifest,
      STATUSES,
      REASONS,
      NUMERIC_REASON_CODES,
      AVS_CODES,
      CVN_CODES,
      MERCHANT_ADVICE_CODES,
      WEBHOOK_EVENT_TYPES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
