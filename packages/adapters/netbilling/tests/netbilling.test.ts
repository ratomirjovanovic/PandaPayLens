import { readdirSync, readFileSync } from "node:fs";
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
  AUTH_MESSAGES,
  DIRECT3_STATUS_CODES,
  EXTRA_AUTH_MESSAGES,
  MEMBER_STATUSES,
  PAYMENT_FORM_STATUS_CODES,
  decodeAuthMessage,
  netbillingAdapter,
  netbillingManifest,
  testModeExpectation,
} from "@pandapaylens/netbilling";

const options: AnalyzeOptions = {
  adapters: [netbillingAdapter],
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
const analyzeFixture = (p: string) => analyze(fixture(`netbilling/${p}`));

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

const direct = (fields: Record<string, string> = {}) =>
  form({
    status_code: "1",
    trans_id: "PPLsynth0900",
    auth_date: "2026-10-22 08:00:00",
    auth_msg: "APPROVED",
    ...fields,
  });

const postback = (fields: Record<string, string> = {}) =>
  form({
    Ecom_Ezic_Response_StatusCode: "1",
    Ecom_Ezic_Response_TransactionID: "PPLsynth0950",
    Ecom_Ezic_Response_AuthMessage: "APPROVED",
    Ecom_Ezic_Payment_AuthorizationType: "SALE",
    ...fields,
  });

const httpMeta = (status: number): RecordMeta => ({
  format: "http",
  http: { kind: "response", status, contentType: "text/plain", headers: {} },
});

function analyzeException(status: number): AnalysisResult {
  const r = analyzeRecords([{}], options, [httpMeta(status)]);
  if (!r.ok) throw new Error(r.error.message);
  return r.result;
}

const formMeta = { format: "form" as const };
const detectText = (text: string) => {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return netbillingAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
};

describe("netbilling detection", () => {
  it.each([
    ["direct3-auth-only-test-mode.txt", "netbilling.direct3.response", 0.98, true],
    ["direct3-sale-approved.txt", "netbilling.direct3.response", 0.98, true],
    ["direct3-duplicate.txt", "netbilling.direct3.response", 0.8, true],
    ["direct3-3ds-challenge-pending.txt", "netbilling.direct3.response", 0.9, true],
    ["paymentform-postback-approved.txt", "netbilling.paymentform.response", 0.95, true],
    ["memberupdate-get-active-resigning.txt", "netbilling.memberupdate.member", 0.9, true],
    ["direct21-legacy-response.txt", "netbilling.direct21.response", 0.8, false],
  ])("detects %s", (file, format, confidence, supported) => {
    expect(detectText(fixture(`netbilling/${file}`))).toMatchObject({
      format,
      confidence,
      supported,
    });
  });

  it("does not claim generic shapes or compatibility-mode payloads without a NETbilling marker", () => {
    const d = (o: unknown, meta?: RecordMeta) => netbillingAdapter.detect(o, meta).confidence;
    expect(d({ status: "1" }, formMeta)).toBe(0);
    expect(d({ error: "x" }, formMeta)).toBe(0);
    expect(d({ status_code: "1" }, formMeta)).toBe(0);
    expect(d({ status_code: "1", auth_code: "1", avs_code: "Y" }, formMeta)).toBe(0);
    // status_code + trans_id alone is too generic to claim.
    expect(d({ status_code: "1", trans_id: "1" }, formMeta)).toBe(0.3);
    expect(d({ name: "netbilling", provider: "NETbilling", message: "netbilling" }, formMeta)).toBe(
      0,
    );
    // Form families are not claimed when the record arrived as JSON.
    expect(d({ status_code: "1", trans_id: "1", auth_msg: "APPROVED" }, { format: "json" })).toBe(
      0,
    );
    expect(d({ status_code: { a: 1 }, trans_id: "1", auth_msg: "x" }, formMeta)).toBe(0);
    expect(d("status_code=1")).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
    // Authorize.Net / Verisign compatibility payloads are not NETbilling by themselves.
    expect(detectText(fixture("netbilling/authorizenet-compat-no-marker.txt")).confidence).toBe(0);
    expect(
      d({ RESULT: "0", PNREF: "PPLsynth1", RESPMSG: "Approved", AUTHCODE: "1" }, formMeta),
    ).toBe(0);
    // An empty record is only an exception with a 6xx/7xx HTTP status.
    expect(d({}, httpMeta(200))).toBe(0);
    expect(d({}, httpMeta(500))).toBe(0);
    expect(d({}, formMeta)).toBe(0);
  });

  it("recognizes but does not analyze compatibility mode with an Ecom_Ezic marker, requests and batch status", () => {
    const emulated = netbillingAdapter.detect(
      { x_response_code: "1", x_trans_id: "PPLsynth1", Ecom_Ezic_AccountAndSitetag: "PPLsynth:S" },
      formMeta,
    );
    expect(emulated).toMatchObject({ format: "netbilling.paymentform.emulated", supported: false });
    const request = netbillingAdapter.detect(
      { Ecom_Ezic_AccountAndSitetag: "PPLsynth:S", Ecom_Cost_Total: "1.00" },
      formMeta,
    );
    expect(request).toMatchObject({ format: "netbilling.paymentform.request", supported: false });
    const batch = detectText(
      "approvals=3&total_records=3&status=FINISHED&records_done=3&exceptions=0&declines=0",
    );
    expect(batch).toMatchObject({ format: "netbilling.directbatch.status", supported: false });
    const r = analyzeFixture("direct21-legacy-response.txt");
    expect(r.records[0]).toMatchObject({ status: "unsupported" });
    expect(r.events).toEqual([]);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(netbillingAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(netbillingAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("netbilling Direct Mode 3.2 responses", () => {
  it("normalizes an approved sale without guessing the operation", () => {
    const r = analyzeFixture("direct3-sale-approved.txt");
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "netbilling.direct3.response",
    });
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.approved",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "status_code=1",
      paymentReference: "PPLsynth0002",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
      amountMinor: "2495",
      currency: "USD",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      authMsg: "APPROVED",
      avsCode: "Y",
      cvv2Code: "M",
      processor: "PTECH",
    });
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("reads a raw HTTP response and flags test mode as documented", () => {
    const r = analyzeFixture("direct3-auth-only-test-mode.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.auth_only_approved",
      stage: "authorization",
      outcome: "success",
      eventTimestamp: "2026-10-20T09:15:00.000Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      testMode: true,
      httpStatus: 200,
      authCode: "999999",
      avsCode: "X",
    });
    // No amount in the response, so no amount-based expectation is shown.
    expect(r.events[0]!.attributes.testModeExpectedResult).toBeUndefined();
  });

  it("sets the subscription reference for a membership signup", () => {
    const r = analyzeFixture("direct3-signup-approved.txt");
    expect(r.events[0]).toMatchObject({
      subscriptionReference: "PPLsynthM0001",
      isRecurring: false,
      outcome: "success",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      memberId: "PPLsynthM0001",
      recurringId: "PPLsynthR0001",
      membershipSignup: true,
      processor: "INT/CX#5",
    });
  });

  it("decodes an issuer decline by its whole message with possible confidence", () => {
    const r = analyzeFixture("direct3-decline-insufficient-funds.txt");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "DECLINE 51",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "possible",
      providerMessage: "DECLINE 51",
      paymentReference: "PPLsynth0004",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      field: "auth_msg",
      status_code: "0",
      group: "bank",
      decline_code: "DECLINE 51",
      reason_code2: "PPL51",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /not intended to be machine readable/,
    );
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/reason_code2/);
    expect(r.findings.map((f) => f.ruleId)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("decodes a Fraud Defense rejection as a gateway decision, not an issuer answer", () => {
    const r = analyzeFixture("direct3-fraud-defense-blacklist.txt");
    expect(r.errors[0]).toMatchObject({
      code: "B/DECLINED",
      category: "fraud_or_risk",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(r.errors[0]!.subCodes.group).toBe("fraud_defense");
    expect(r.errors[0]!.subCodes.decline_code).toBeUndefined();
  });

  it("treats an issuer system error as a known failure, not an unknown outcome", () => {
    const r = analyzeFixture("direct3-issuer-system-error.txt");
    expect(r.events[0]!.outcome).toBe("failure");
    // The documented example has an unescaped # in processor.
    expect(r.events[0]!.attributes.processor).toBe("FDR-NASH#2");
    expect(r.errors[0]).toMatchObject({
      code: "SYSTEM ERROR 96",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/Confirm the state of the original transaction/);
    expect(r.findings.map((f) => f.ruleId)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("treats OFFLINE RECORD with a 3ds_url as a pending challenge, not an authorization", () => {
    const r = analyzeFixture("direct3-3ds-challenge-pending.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.3ds_challenge_pending",
      stage: "authentication",
      outcome: "pending",
      providerStatus: "status_code=T",
      amountMinor: "161",
      currency: "USD",
    });
    expect(r.events[0]!.attributes).toMatchObject({ threeDsChallenge: true, offlineRecord: true });
    expect(r.errors).toEqual([]);
    expect(r.findings.map((f) => f.ruleId)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it("does not claim an authorization for OFFLINE RECORD without a challenge URL", () => {
    const r = analyze(direct({ status_code: "T", auth_msg: "OFFLINE RECORD" }));
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.offline_record",
      stage: "authorization",
      outcome: "unknown",
    });
  });

  it("reports a duplicate with the original trans_id and an unknown outcome", () => {
    const r = analyzeFixture("direct3-duplicate.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.duplicate",
      outcome: "unknown",
      paymentReference: "PPLsynth0003",
    });
    expect(r.errors[0]).toMatchObject({
      code: "D",
      category: "duplicate_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("reports undocumented status codes as unknown instead of success", () => {
    const r = analyze(direct({ status_code: "X" }));
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.unknown_status",
      eventTypeKnown: false,
      outcome: "unknown",
    });
    expect(r.errors[0]).toMatchObject({
      code: "X",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /interpreted as a successful transaction/,
    );
    expect(r.findings.map((f) => f.ruleId)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("does not pick one meaning for status_code F", () => {
    const r = analyze(direct({ status_code: "F", auth_msg: "" }));
    expect(r.events[0]).toMatchObject({ stage: "settlement", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({ code: "F", category: "unknown", retry: "manual_review" });
    expect(r.errors[0]!.explanation).toMatch(/settlement failure or a returned NBCheck/);
  });

  it("reports unrecognized and informational messages honestly", () => {
    const unknown = analyze(direct({ status_code: "0", auth_msg: "DECLINED 05" }));
    expect(unknown.errors[0]).toMatchObject({
      code: "DECLINED 05",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const informational = analyze(direct({ status_code: "0", auth_msg: "APPROVED" }));
    expect(informational.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
    expect(informational.errors[0]!.explanation).toMatch(/informational/);
    const none = analyze(direct({ status_code: "0", auth_msg: "" }));
    expect(none.errors[0]).toMatchObject({ code: "0", confidence: "insufficient" });
  });

  it("explains a test-mode decline with the documented amount rules", () => {
    const r = analyze(
      direct({
        status_code: "0",
        auth_msg: "TEST DECLINED",
        settle_amount: "95.00",
        settle_currency: "USD",
      }),
    );
    expect(r.events[0]!.attributes).toMatchObject({
      testMode: true,
      testModeExpectedResult: "DECLINED",
      testModeExpectedAvs: "X",
      testModeExpectedCvv2: "M",
    });
    expect(r.errors[0]).toMatchObject({ category: "card_declined", confidence: "possible" });
    expect(r.errors[0]!.explanation).toMatch(/tens digit/);
    expect(r.errors[0]!.explanation).toMatch(/expected DECLINED, AVS X, CVV2 M/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/starts with TEST/);
  });

  it("keeps an unparseable auth_date out of the event time", () => {
    const r = analyze(direct({ auth_date: "20/10/2026" }));
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.authDateUnparsed).toBe(true);
  });

  it("does not convert settle_amount without settle_currency", () => {
    const r = analyze(direct({ settle_amount: "10.00" }));
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.attributes.settleAmount).toBe("10.00");
  });

  it("reports parse issues for missing required fields instead of throwing", () => {
    const r = analyze(
      form({ status_code: "1", auth_msg: "APPROVED", auth_date: "2026-10-20 10:00:00" }),
    );
    expect(r.records[0]).toMatchObject({
      status: "invalid",
      format: "netbilling.direct3.response",
    });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^trans_id:/);
    expect(r.events).toEqual([]);
  });

  it("reports repeated keys as parse issues", () => {
    const r = analyze(`${direct()}&status_code=0`);
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^status_code:/);
  });

  it("fails cleanly on malformed input", () => {
    expect(analyzeText("status_code=1&trans_id", options).ok).toBe(false);
    expect(netbillingAdapter.parse("x", "netbilling.direct3.response").ok).toBe(false);
    expect(netbillingAdapter.parse({}, "netbilling.nope").ok).toBe(false);
    expect(netbillingAdapter.parse({}, "netbilling.direct3.exception", { format: "form" }).ok).toBe(
      false,
    );
  });
});

describe("netbilling Direct Mode 3.2 exceptions", () => {
  it("analyzes a pasted exception with an empty body from the HTTP status", () => {
    const r = analyzeText(fixture("netbilling/direct3-exception-604.txt"), options);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.records[0]).toMatchObject({
        status: "analyzed",
        format: "netbilling.direct3.exception",
      });
      expect(r.result.errors[0]).toMatchObject({ code: "604" });
    }
  });

  it("decodes 604 from the HTTP status when the record reaches the adapter", () => {
    const r = analyzeException(604);
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "netbilling.direct3.exception",
    });
    expect(r.events[0]).toMatchObject({
      eventType: "direct3.exception",
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 604",
    });
    expect(r.errors[0]).toMatchObject({
      code: "604",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/reason phrase/);
  });

  it("decodes the documented ranges with reduced confidence", () => {
    expect(analyzeException(612).errors[0]).toMatchObject({
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(analyzeException(699).errors[0]).toMatchObject({
      category: "unknown",
      retry: "manual_review",
    });
    const processing = analyzeException(750);
    expect(processing.events[0]!.outcome).toBe("unknown");
    expect(processing.errors[0]).toMatchObject({
      category: "unknown",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(processing.errors[0]!.retryExplanation).toMatch(/never resend blindly/);
    expect(analyzeException(799).errors[0]!.retry).toBe("retry_conditionally");
  });
});

describe("netbilling hosted payment form returns and postbacks (experimental)", () => {
  it("normalizes an approved postback with default field names", () => {
    const r = analyzeFixture("paymentform-postback-approved.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.approved",
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth0101",
      merchantReference: "PPLsynth-order-1",
      deliveryKey: "PPLsynth0101|1",
    });
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      authorizationType: "SALE",
      proofOfPurchaseHash: "present_not_verified",
      issueDate: "2026-10-21",
    });
    expect(r.errors).toEqual([]);
  });

  it("decodes a declined postback", () => {
    const r = analyzeFixture("paymentform-postback-declined.txt");
    expect(r.events[0]).toMatchObject({ eventType: "payment.failed", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "EXPIRED CARD 54",
      category: "card_declined",
      confidence: "possible",
    });
    expect(r.errors[0]!.subCodes.field).toBe("Ecom_Ezic_Response_AuthMessage");
  });

  it("marks a membership signup without copying credentials", () => {
    const r = analyzeFixture("paymentform-membership-signup.txt");
    expect(r.events[0]).toMatchObject({ eventType: "membership.signup", isRecurring: false });
    expect(r.events[0]!.attributes.membershipSignup).toBe(true);
    const out = JSON.stringify(r.events);
    expect(out).not.toContain("PPLsynthPlantedUser");
    expect(out).not.toContain("PPLsynthPlantedPass");
  });

  it("maps the other documented status codes and keeps unknown ones unknown", () => {
    const refund = analyze(postback({ Ecom_Ezic_Response_StatusCode: "R" }));
    expect(refund.events[0]).toMatchObject({ stage: "refund", outcome: "success" });
    const auth = analyze(postback({ Ecom_Ezic_Response_StatusCode: "T" }));
    expect(auth.events[0]).toMatchObject({ stage: "authorization", outcome: "success" });
    const pending = analyze(postback({ Ecom_Ezic_Response_StatusCode: "I" }));
    expect(pending.events[0]!.outcome).toBe("pending");
    const failure = analyze(
      postback({
        Ecom_Ezic_Response_StatusCode: "F",
        Ecom_Ezic_Response_AuthMessage: "BAD ADDRESS",
      }),
    );
    expect(failure.events[0]!.outcome).toBe("failure");
    expect(failure.errors[0]).toMatchObject({ category: "fraud_or_risk", code: "BAD ADDRESS" });
    const dup = analyze(postback({ Ecom_Ezic_Response_StatusCode: "D" }));
    expect(dup.events[0]).toMatchObject({ eventType: "payment.duplicate", outcome: "success" });
    expect(dup.errors[0]).toMatchObject({ code: "D", category: "duplicate_request" });
    const odd = analyze(postback({ Ecom_Ezic_Response_StatusCode: "Z" }));
    expect(odd.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(odd.errors[0]).toMatchObject({ confidence: "insufficient" });
  });

  it("reports a repeated postback as a duplicate delivery without claiming it is documented", () => {
    const text = fixture("netbilling/paymentform-postback-approved.txt");
    const r = analyzeMany(text, text);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).toMatch(/not necessarily an application bug/);
    expect(dup!.explanation).not.toMatch(/documents that it can deliver/);
  });

  it("reports a postback without a status code as invalid", () => {
    const r = analyze(postback({ Ecom_Ezic_Response_StatusCode: "" }));
    expect(r.records[0]).toMatchObject({
      status: "invalid",
      format: "netbilling.paymentform.response",
    });
  });
});

describe("netbilling Member Update (experimental)", () => {
  it("shows the member status with stage subscription", () => {
    const r = analyzeFixture("memberupdate-get-active-resigning.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "member_update.member",
      stage: "subscription",
      providerStatus: "M_MEMBER_STATUS=ACTIVE/R",
      outcome: "pending",
      subscriptionReference: "PPLsynthM0001",
      paymentReference: "PPLsynth0003",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      memberStatusKnown: true,
      templateTransId: "PPLsynth0003",
    });
    expect(JSON.stringify(r.events)).not.toContain("PPLsynthPlantedLogin");
    expect(r.errors).toEqual([]);
  });

  it.each([
    ["EXPIRED", "success"],
    ["PENDING", "pending"],
    ["SOMETHING NEW", "unknown"],
  ])("maps member status %s", (status, outcome) => {
    const r = analyze(form({ M_MEMBER_ID: "PPLsynthM0002", M_MEMBER_STATUS: status }));
    expect(r.events[0]).toMatchObject({ stage: "subscription", outcome });
  });
});

describe("netbilling correlation and timeline", () => {
  it("groups a signup, its duplicate response and the member record by trans_id", () => {
    const r = analyzeMany(
      fixture("netbilling/memberupdate-get-active-resigning.txt"),
      fixture("netbilling/direct3-duplicate.txt"),
      fixture("netbilling/direct3-signup-approved.txt"),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(["PPLsynth0003"]);
    expect(r.events.map((e) => e.eventType).slice(0, 2)).toEqual([
      "direct3.approved",
      "direct3.duplicate",
    ]);
    expect(r.findings.map((f) => f.ruleId)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("keeps different payments of one membership and unrelated transactions apart", () => {
    const r = analyzeMany(
      fixture("netbilling/direct3-signup-approved.txt"),
      direct({ trans_id: "PPLsynth0901", member_id: "PPLsynthM0001" }),
      fixture("netbilling/direct3-sale-approved.txt"),
      fixture("netbilling/direct3-decline-insufficient-funds.txt"),
      // A postback with an order reference does not join anything by that reference.
      postback({ Ecom_ConsumerOrderID: "PPLsynth-order-1" }),
      fixture("netbilling/paymentform-postback-approved.txt"),
    );
    expect(r.groups).toHaveLength(6);
    const members = r.events.filter((e) => e.subscriptionReference === "PPLsynthM0001");
    expect(members).toHaveLength(2);
    expect(netbillingAdapter.correlationKeys(members[0]!)).toEqual([members[0]!.paymentReference]);
  });
});

describe("netbilling authorization message catalog", () => {
  it("has the documented number of entries", () => {
    expect(Object.keys(AUTH_MESSAGES)).toHaveLength(77);
    const groups = Object.values(AUTH_MESSAGES).reduce<Record<string, number>>((m, e) => {
      m[e.group] = (m[e.group] ?? 0) + 1;
      return m;
    }, {});
    expect(groups).toEqual({
      generic: 1,
      avs_cvv2_filter: 2,
      fraud_defense: 8,
      traffic_limit: 5,
      bank: 61,
    });
    expect(Object.keys(EXTRA_AUTH_MESSAGES)).toHaveLength(4);
    expect(Object.keys(DIRECT3_STATUS_CODES).sort()).toEqual(["0", "1", "D", "F", "I", "T"]);
    expect(Object.keys(PAYMENT_FORM_STATUS_CODES)).toHaveLength(7);
    expect(Object.keys(MEMBER_STATUSES)).toHaveLength(6);
  });

  it("matches whole messages because numbers are reused with different meanings", () => {
    const cat = (m: string) => decodeAuthMessage(m).entry?.category;
    expect(cat("INV MERCH NUM 19")).toBe("configuration");
    expect(cat("RE ENTER 19")).toBe("network_or_timeout");
    expect(cat("ERROR CODE 98")).toBe("unknown");
    expect(cat("GENERAL ERROR 98")).toBe("invalid_request");
    expect(decodeAuthMessage("CALL 02").entry?.retry).toBe("customer_action_required");
    expect(decodeAuthMessage("DECLINE 02").entry?.retry).toBe("manual_review");
    expect(decodeAuthMessage("CVV2 MISMATCH").entry).toMatchObject({ group: "avs_cvv2_filter" });
    expect(decodeAuthMessage("CVV2 MISMATCH N7").entry).toMatchObject({ group: "bank" });
    // A known number in an unknown text is not decoded.
    expect(decodeAuthMessage("DECLINE 19").entry).toBeUndefined();
    expect(decodeAuthMessage("DECLINE 19").confidence).toBe("insufficient");
  });

  it("handles letter case, documented spellings and undocumented prefix letters", () => {
    const lower = decodeAuthMessage("decline  51");
    expect(lower).toMatchObject({ matched: "DECLINE 51", confidence: "possible" });
    expect(lower.missing.join(" ")).toMatch(/ignoring letter case/);
    expect(decodeAuthMessage("CRYTPGRAPHIC DIGEST ERROR").entry).toMatchObject({
      category: "configuration",
      retry: "do_not_retry",
    });
    const prefixed = decodeAuthMessage("Z/QUOTA EXCEEDED");
    expect(prefixed.entry).toMatchObject({ category: "unknown", retry: "manual_review" });
    expect(prefixed.missing.join(" ")).toMatch(/letter prefix/);
    expect(decodeAuthMessage("toString").entry).toBeUndefined();
    expect(decodeAuthMessage("constructor").confidence).toBe("insufficient");
  });

  it("derives the documented test-mode expectations from the amount", () => {
    expect(testModeExpectation("12.00")).toEqual({ authResult: "APPROVED", avs: "X", cvv2: "M" });
    expect(testModeExpectation("195.00")).toEqual({ authResult: "DECLINED", avs: "Y", cvv2: "M" });
    expect(testModeExpectation("2350")).toEqual({ authResult: "APPROVED", avs: "Z", cvv2: "P" });
    expect(testModeExpectation("9999.00")).toEqual({ authResult: "DECLINED", avs: "?", cvv2: "?" });
    const thousand = testModeExpectation("1000.00");
    expect(thousand?.cvv2).toBeUndefined();
    expect(thousand?.note).toMatch(/whole-thousand/);
    expect(testModeExpectation("12000.00")).toEqual({
      note: expect.stringMatching(/last 4 digits/),
    });
    expect(testModeExpectation("abc")).toBeUndefined();
  });
});

describe("netbilling redaction", () => {
  const planted = [
    "4000000000000002",
    "PPLsynthPlantedCvv",
    "PPLsynthPlantedName",
    "planted@PPLsynth.example",
    "198.51.100.77",
    "PPLsynthPlantedSecret",
    "PPLsynthPlantedUser",
    "PPLsynthPlantedPass",
    "PPLsynthPlantedLogin",
    "PPLsynthPlantedMisc",
    "acs.PPLsynth.example",
    "0123456789abcdef0123456789abcdef",
    "eyJtZXNzYWdlVmVyc2lvbiI6",
  ];

  it("keeps card, personal, credential, signature and 3DS data out of events and reports", () => {
    const r = analyzeMany(
      fixture("netbilling/direct3-3ds-challenge-pending.txt"),
      fixture("netbilling/paymentform-postback-approved.txt"),
      fixture("netbilling/paymentform-membership-signup.txt"),
      fixture("netbilling/memberupdate-get-active-resigning.txt"),
      direct({
        status_code: "0",
        auth_msg: "DECLINED",
        card_number: "4000000000000002",
        card_cvv2: "PPLsynthPlantedCvv",
        bill_name1: "PPLsynthPlantedName",
        cust_email: "planted@PPLsynth.example",
        cust_ip: "198.51.100.77",
        dynip_sec_code: "PPLsynthPlantedSecret",
        misc_info: "PPLsynthPlantedMisc",
      }),
      postback({
        Ecom_Payment_Card_Number: "4000000000000002",
        Ecom_BillTo_Postal_Name_First: "PPLsynthPlantedName",
        Ecom_BillTo_Online_Email: "planted@PPLsynth.example",
        Ecom_Ezic_Security_HashValue_MD5: "0123456789abcdef0123456789abcdef",
      }),
    );
    expect(r.events).toHaveLength(6);
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
  });
});

describe("netbilling manifest", () => {
  it("is honest about its capabilities and research", () => {
    expect(netbillingManifest).toMatchObject({
      id: "netbilling",
      wave: "HR-1",
      researchStatus: "tested",
      documentationAccess: "partial",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
      categories: ["gateway", "merchant_account_intermediary"],
    });
    expect(netbillingManifest.capabilities).toEqual({
      errorDecoding: "limited",
      paymentResponses: "supported",
      webhookParsing: "experimental",
      timeline: "limited",
      correlation: "limited",
      diagnosticRules: "limited",
    });
    expect(netbillingManifest.delivery).toMatchObject({
      duplicatesDocumented: false,
      ordering: "not_documented",
    });
    const gaming = netbillingManifest.sectors.find((s) => s.sector.startsWith("Gaming"));
    expect(gaming?.sector).toMatch(/not stated to mean gambling or iGaming/);
    for (const s of netbillingManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/www\.netbilling\.com\//);
    expect(netbillingManifest.fixtureProvenance).toMatch(/[Ss]ynthetic/);
  });

  it("contains no en or em dash in sources, fixtures or the manifest", () => {
    const files = [
      ...["catalog.ts", "index.ts", "manifest.ts"].map((f) =>
        fileURLToPath(new URL(`../src/${f}`, import.meta.url)),
      ),
      fileURLToPath(import.meta.url),
      ...readdirSync(fixturePath("netbilling")).map((f) => fixturePath(`netbilling/${f}`)),
    ];
    const dashes = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const dash of dashes) expect(text.includes(dash), file).toBe(false);
    }
    for (const dash of dashes) expect(JSON.stringify(netbillingManifest)).not.toContain(dash);
  });
});
