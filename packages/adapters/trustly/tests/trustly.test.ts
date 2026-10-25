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
  AMER_AC_CODES,
  AMER_EFT_RETURN_CODES,
  AMER_EVENT_TYPES,
  AMER_EXTENDED_REASONS,
  AMER_INTERNAL_ERRORS,
  AMER_PAYMENT_TYPES,
  AMER_REASON_CODES,
  AMER_SE_CODES,
  AMER_SW_CODES,
  AMER_TRANSACTION_STATUSES,
  AMER_TRANSACTION_TYPES,
  AMER_UC_CODES,
  AMER_UK_DD_CODES,
  EU_CANCEL_ORDER_STATUSES,
  EU_ERROR_CODES,
  EU_ERROR_NAMES,
  EU_KYC_ABORT_MESSAGES,
  EU_METHODS,
  EU_NOTIFICATIONS,
  EU_OTHER_ERROR_NAMES,
  EU_PAYOUT_ERROR_CODES,
  EU_TRANSFER_STATES,
  TRUSTLY_ADAPTER_VERSION,
  extendedReason,
  trustlyAdapter,
  trustlyManifest,
} from "@pandapaylens/trustly";
import defaultExport from "@pandapaylens/trustly";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [trustlyAdapter],
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
const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const httpJson = (status: string, body: unknown) =>
  [`HTTP/1.1 ${status}`, "Content-Type: application/json", "", json(body)].join("\n");

const notification = (method: string, data: Record<string, unknown> = {}) => ({
  method,
  params: {
    signature: "c2lnbmF0dXJlUFBMc3ludGg=",
    uuid: "258a2184-2842-b485-25ca-293525152425",
    data: {
      amount: "902.50",
      currency: "EUR",
      messageid: "PPLsynth-msg-t001",
      orderid: "PPLsynthT0001",
      notificationid: `PPLsynthN-${method}`,
      timestamp: "2026-10-20 14:42:04.675645+01",
      attributes: {},
      ...data,
    },
  },
  version: "1.1",
});
const result = (method: string, data: unknown) => ({
  result: {
    signature: "c2lnbmF0dXJlUFBMc3ludGg=",
    uuid: "258a2184-2842-b485-25ca-293525152425",
    method,
    data,
  },
  version: "1.1",
});
const euError = (code: unknown, message: unknown, method: unknown = "Deposit") => ({
  version: "1.1",
  error: {
    name: "JSONRPCError",
    code,
    message,
    error: {
      signature: "c2lnbmF0dXJlUFBMc3ludGg=",
      uuid: "258a2184-2842-b485-25ca-293525152425",
      method,
      data: { code, message },
    },
  },
});
const amerEvent = (fields: Record<string, string> = {}) =>
  form({
    merchantId: "PPLsynth1002463580",
    merchantReference: "PPLsynth-ref-t001",
    paymentType: "2",
    transactionType: "2",
    eventId: "PPLsynthE9001",
    eventType: "Update",
    objectId: "PPLsynthT9001",
    objectType: "Transaction",
    message: "",
    timeZone: "Etc/UTC",
    createdAt: "1792490400000",
    ...fields,
  });

describe("trustly detection", () => {
  it.each([
    [notification("credit"), "trustly.eu.notification", 0.95, true],
    [
      { method: "pending", params: { data: { orderid: "x" } }, version: "1.1" },
      "trustly.eu.notification",
      0.55,
      true,
    ],
    [
      {
        method: "newtype",
        params: { uuid: "258a2184-2842-b485-25ca-293525152425", data: { notificationid: "n" } },
        version: "1.1",
      },
      "trustly.eu.notification",
      0.6,
      true,
    ],
    [result("Deposit", { orderid: "1", url: "x" }), "trustly.eu.result", 0.9, true],
    [result("SelectAccount", { orderid: "1" }), "trustly.eu.result", 0.8, true],
    [euError(616, "ERROR_INVALID_CREDENTIALS"), "trustly.eu.error", 0.9, true],
    [
      { error: { name: "JSONRPCError", code: 620, message: "ERROR_UNKNOWN" } },
      "trustly.eu.error",
      0.75,
      true,
    ],
    [
      {
        method: "Deposit",
        params: { Signature: "s", UUID: "u", Data: { Username: "u", Password: "p" } },
        version: "1.1",
      },
      "trustly.eu.request",
      0.8,
      false,
    ],
    [result("credit", { status: "OK" }), "trustly.eu.notification_response", 0.8, false],
    [
      {
        transactionId: "t",
        transactionType: 2,
        status: 4,
        paymentProviderTransaction: { status: "AC118" },
      },
      "trustly.amer.transaction",
      0.75,
      true,
    ],
    [
      { errors: [{ domain: "d", code: 200, location: "amount", message: "x", occurredAt: 1 }] },
      "trustly.amer.error",
      0.85,
      true,
    ],
    [{ errors: [{ domain: "d", code: 999, location: "x" }] }, "trustly.amer.error", 0.5, true],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(trustlyAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("detects form-encoded and JSON North America events", () => {
    const parsed = parseInput(fixture("trustly/amer-authorize-event.txt"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(trustlyAdapter.detect(parsed.value.records[0], parsed.value.meta[0])).toMatchObject({
      format: "trustly.amer.event",
      confidence: 0.98,
      supported: true,
    });
    const jsonEvent = {
      eventId: "e",
      eventType: "Authorize",
      objectId: "o",
      objectType: "Transaction",
      timeZone: "Etc/UTC",
      paymentProviderTransaction: { status: "AC100" },
      status: 2,
    };
    expect(trustlyAdapter.detect(jsonEvent).confidence).toBe(0.85);
  });

  it("keeps generic shapes and the provider name at or below 0.5", () => {
    for (const input of [
      { provider: "Trustly", message: "Trustly error" },
      "trustly",
      null,
      [],
      { error: { code: 616, message: "ERROR_INVALID_CREDENTIALS" } },
      { error: "ERROR_INVALID_CREDENTIALS" },
      { status: 4 },
      { status: "OK" },
      { method: "credit", params: { data: {} } },
      { version: "1.1", method: "foo", params: { data: {} } },
      { version: "1.1", method: "foo", params: {} },
      { version: "1.1", result: { method: "foo", data: {} } },
      { result: { method: "Deposit", data: { orderid: "1" } } },
      { version: "1.1", error: { name: "JSONRPCError", code: 1, message: "x" } },
      { version: "1.1", method: "Deposit", params: { Data: {} } },
      { eventId: "1", eventType: "Update", objectId: "2" },
      { eventId: "1", eventType: "payment.created", objectId: "2", objectType: "Payment" },
      { transactionId: "t", transactionType: 1, status: 4 },
      { transactionId: "t", status: 4 },
      { errors: [{ code: 200, message: "x" }] },
      { errors: [{ code: 200, domain: "global" }] },
      { errors: [{ domain: "global", reason: "required", message: "x", location: "q" }] },
      {
        object: "event",
        eventId: "1",
        eventType: "Complete",
        objectId: "2",
        objectType: "Transaction",
        timeZone: "Etc/UTC",
      },
    ]) {
      expect(trustlyAdapter.detect(input).confidence, json(input)).toBeLessThanOrEqual(0.5);
    }
    expect(trustlyAdapter.detect({ provider: "Trustly" }).confidence).toBe(0);
    // A documented event type alone reaches the threshold but does not pass it.
    expect(
      trustlyAdapter.detect({ eventId: "1", eventType: "Update", objectId: "2" }).confidence,
    ).toBe(0.5);
    expect(
      trustlyAdapter.detect({ eventId: "1", eventType: "Other", objectId: "2" }).confidence,
    ).toBe(0.35);
  });

  it("returns confidence 0 for every record of the other providers' fixtures", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "trustly")
      .map((d) => d.name)
      .filter((d) => readdirSync(`${root}${d}`).length > 0);
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "payabl"]));
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
            trustlyAdapter.detect(payload, parsed.value.meta[i]).confidence,
            `${dir}/${file} record ${i}`,
          ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe("trustly parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noIds = analyze(
      json({
        method: "credit",
        params: { uuid: "258a2184-2842-b485-25ca-293525152425", data: { amount: "1.00" } },
        version: "1.1",
      }),
    );
    expect(noIds.records[0]).toMatchObject({
      status: "invalid",
      format: "trustly.eu.notification",
    });
    const reasons = noIds.records[0]!.reasons.join(" ");
    expect(reasons).toMatch(/params\.data\.notificationid: notificationid is required/);
    expect(reasons).toMatch(/params\.data\.orderid: orderid is required/);
    expect(noIds.events).toEqual([]);

    const badObject = analyze(
      json({
        eventId: "e",
        eventType: "Authorize",
        objectId: { x: 1 },
        objectType: "Transaction",
        timeZone: "Etc/UTC",
      }),
    );
    expect(badObject.records[0]).toMatchObject({ status: "invalid", format: "trustly.amer.event" });
    expect(badObject.records[0]!.reasons.join(" ")).toMatch(/^objectId:/);

    const p = trustlyAdapter.parse(
      { version: "1.1", error: { name: "JSONRPCError" } },
      "trustly.eu.error",
    );
    expect(p.ok).toBe(false);
    expect(!p.ok && p.issues.join(" ")).toMatch(/error code or message is required/);
  });

  it("rejects unknown formats and wrongly typed fields", () => {
    expect(trustlyAdapter.parse({}, "trustly.eu.request")).toMatchObject({ ok: false });
    expect(trustlyAdapter.parse({}, "other")).toEqual({
      ok: false,
      issues: ['Unsupported Trustly format "other".'],
    });
    const r = analyze(json({ ...notification("credit"), version: 1.1 }));
    expect(r.records[0]!.status).not.toBe("analyzed");
  });

  it("fails cleanly on malformed input, including the documentation's unclosed error example", () => {
    const unclosed = `{
    "version": "1.1",
    "error": {
        "name": "JSONRPCError",
        "code": 616,
        "message": "ERROR_INVALID_CREDENTIALS",
        "error": {
            "uuid": "258a2184-2842-b485-25ca-293525152425",
            "method": "Deposit",
            "data": { "code" : 616, "message" : "ERROR_INVALID_CREDENTIALS" }
        }
}`;
    const r = analyzeText(unclosed, options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    // Comments and trailing commas (as in the KYC examples) are removed with a warning.
    const commented = analyzeText('{"method": "kyc", // comment\n "version": "1.1",}', options);
    expect(commented.ok && commented.result.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
    const xml = analyzeText("<methodResponse></methodResponse>", options);
    expect(!xml.ok && xml.error.code).toBe("UNSUPPORTED_FORMAT");
  });

  it("tolerates unknown fields, numeric ids and camelCase Account Assessment keys", () => {
    const verify = analyze(
      json(
        notification("verifyAccount", { orderid: 1234567, notificationid: 98765, extra: { x: 1 } }),
      ),
    ).events[0]!;
    expect(verify).toMatchObject({
      paymentReference: "1234567",
      eventReference: "98765",
      outcome: "unknown",
    });
    const assess = analyze(
      json({
        method: "assessAccount",
        params: {
          signature: "c2ln",
          uuid: "258a2184-2842-b485-25ca-293525152425",
          data: {
            orderId: "PPLsynthA01",
            messageId: "PPLsynth-msg-a01",
            notificationID: "PPLsynthNA01",
            value: "SE00PLANTEDIBAN000000001",
          },
        },
        version: "1.1",
      }),
    );
    expect(assess.events[0]).toMatchObject({
      eventType: "assessAccount",
      eventTypeKnown: true,
      paymentReference: "PPLsynthA01",
      merchantReference: "PPLsynth-msg-a01",
      deliveryKey: "notification:PPLsynthNA01",
    });
    expect(json(assess.events)).not.toContain("PLANTEDIBAN");
  });
});

describe("trustly EU deposits", () => {
  it("keeps pending apart from credited and links the deposit by orderid", () => {
    const r = analyzeFixture("trustly/eu-deposit-flow.json");
    expect(r.records.map((x) => x.format)).toEqual([
      "trustly.eu.result",
      "trustly.eu.notification",
      "trustly.eu.notification",
    ]);
    const [pending, credit, deposit] = r.events;
    expect(pending).toMatchObject({
      eventType: "pending",
      stage: "payment",
      outcome: "pending",
      amountMinor: "90250",
      currency: "EUR",
      eventTimestamp: "2026-10-20T13:41:10.120Z",
      attributes: { fundsReceived: false, signatureVerified: false },
    });
    expect(credit).toMatchObject({
      eventType: "credit",
      outcome: "success",
      eventTimestamp: "2026-10-20T13:42:04.675Z",
      eventReference: "PPLsynthN0000002",
      merchantReference: "PPLsynth-msg-1001",
    });
    expect(credit!.attributes.creditContext).toMatch(/payout or refund/);
    expect(deposit).toMatchObject({
      eventType: "Deposit",
      stage: "payment",
      outcome: "pending",
      attributes: { checkoutUrlPresent: true },
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(["eu:PPLsynth1000001"]);
    expect(ruleIds(r)).toEqual([]);
  });

  it("never reports a pending notification alone as a final result", () => {
    const r = analyze(json(notification("pending")));
    expect(r.events[0]).toMatchObject({ outcome: "pending", eventTypeKnown: true });
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
  });

  it("reports credit before pending as out of order (documented as possible)", () => {
    const r = analyze(
      json([
        notification("credit", { timestamp: "2026-10-20 14:42:00.000000+01" }),
        notification("pending", { timestamp: "2026-10-20 14:41:00.000000+01" }),
      ]),
    );
    const f = r.findings.find((x) => x.ruleId === "OUT_OF_ORDER_ARRIVAL");
    expect(f?.explanation).toMatch(/Trustly does not guarantee delivery order/);
  });

  it("shows a debit after credit without claiming its outcome", () => {
    const r = analyzeFixture("trustly/eu-credit-then-debit.json");
    const debit = r.events.find((e) => e.eventType === "debit")!;
    expect(debit).toMatchObject({ stage: "other", outcome: "unknown", eventTypeKnown: true });
    expect(debit.attributes.notificationMeaning).toMatch(/never settled.*merchant's reply/);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("unknown");
    expect(r.errors).toEqual([]);
  });

  it("decodes a cancel notification with its detailed fields", () => {
    const r = analyzeFixture("trustly/eu-deposit-cancelled.json");
    expect(r.events[0]).toMatchObject({
      eventType: "cancel",
      stage: "cancellation",
      outcome: "failure",
      attributes: { orderStatuses: ["TIMEOUT"], lastOrderStep: "SELECT_BANK" },
    });
    expect(r.events[0]!.attributes.cancelDetailNote).toMatch(/not to automate/);
    expect(r.errors).toEqual([]);
  });

  it("decodes a direct debit cancel reason known only by name", () => {
    const r = analyze(
      json(
        notification("cancel", {
          attributes: {
            reason: "ERROR_CHARGE_NOT_APPROVED",
            details: "BACS ARUDD_1(INSTRUCTION CANCELLED BY PAYER)",
          },
        }),
      ),
    );
    expect(r.events[0]!.attributes).toMatchObject({
      cancelReason: "ERROR_CHARGE_NOT_APPROVED",
      schemeDetail: "BACS ARUDD_1(INSTRUCTION CANCELLED BY PAYER)",
    });
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_CHARGE_NOT_APPROVED",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      paymentReference: "PPLsynthT0001",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/only by name/);
  });

  it("reports a repeated notificationid as a duplicate delivery", () => {
    const r = analyzeFixture("trustly/eu-credit-duplicate.json");
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      "notification:PPLsynthN0000301",
      "notification:PPLsynthN0000301",
    ]);
    const f = r.findings.find((x) => x.ruleId === "DUPLICATE_DELIVERY");
    expect(f?.explanation).toMatch(/Trustly documents that it can deliver the same notification/);
    expect(f?.recommendedAction).toMatch(/same signed reply/);
  });

  it("keeps unrelated orders apart even with a shared merchant reference", () => {
    const r = analyzeFixture("trustly/eu-unrelated-deposits.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "PPLsynth-msg-shared",
      "PPLsynth-msg-shared",
    ]);
  });

  it("marks an aborted KYC check as a failure with its documented message", () => {
    const r = analyzeFixture("trustly/eu-kyc-abort.json");
    expect(r.events[0]).toMatchObject({
      eventType: "kyc",
      stage: "other",
      outcome: "failure",
      attributes: {
        kycAborted: true,
        kycAbortMessage: "underage",
        kycAbortMeaning: "The end user is under age",
      },
    });
    const ok = analyze(json(notification("kyc", { abort: "0" }))).events[0]!;
    expect(ok).toMatchObject({ outcome: "pending", attributes: { kycAborted: false } });
    const odd = analyze(json(notification("kyc", { abort: "1", abortmessage: "something" })))
      .events[0]!;
    expect(odd.attributes.kycAbortMessage).toBeUndefined();
  });

  it("shows an account notification without a payment outcome", () => {
    const r = analyzeFixture("trustly/eu-account-notification.json");
    expect(r.events[0]).toMatchObject({
      eventType: "account",
      stage: "other",
      outcome: "unknown",
      attributes: { accountVerified: true, optInNotification: true },
    });
  });

  it("keeps undocumented notification methods unknown", () => {
    const r = analyze(json(notification("refundconfirmation")));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("converts amounts without floats and flags amounts it cannot convert", () => {
    const n = analyze(json(notification("credit", { amount: 40.91 }))).events[0]!;
    expect(n.amountMinor).toBe("4091");
    const huf = analyze(json(notification("credit", { amount: "1000", currency: "HUF" })))
      .events[0]!;
    expect(huf).toMatchObject({ amountMinor: "100000", currency: "HUF" });
    const odd = analyze(json(notification("credit", { amount: "12.345" }))).events[0]!;
    expect(odd.amountMinor).toBeUndefined();
    expect(odd.attributes.amountNotConvertible).toBe(true);
  });
});

describe("trustly EU results", () => {
  it("links a Refund result to the deposit through the deposit OrderID", () => {
    const r = analyze(
      json([
        ...JSON.parse(fixture("trustly/eu-deposit-flow.json")),
        JSON.parse(fixture("trustly/eu-refund-accepted.json")),
      ]),
    );
    expect(r.groups).toHaveLength(1);
    const refund = r.events.find((e) => e.eventType === "Refund")!;
    expect(refund).toMatchObject({
      stage: "refund",
      outcome: "pending",
      providerStatus: "result 1",
    });
    expect(refund.attributes.resultMeaning).toMatch(/not confirmed/);
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("keeps an undocumented Refund result value unknown", () => {
    const e = analyze(json(result("Refund", { orderid: "PPLsynthR1", result: "0" }))).events[0]!;
    expect(e).toMatchObject({
      outcome: "unknown",
      eventTypeKnown: false,
      attributes: { resultUndocumented: true },
    });
  });

  it("reads AccountPayout and ApproveWithdrawal results as payouts", () => {
    const failed = analyze(json(result("AccountPayout", { orderid: "PPLsynthP1", result: 0 })));
    expect(failed.events[0]).toMatchObject({
      stage: "payout",
      outcome: "failure",
      providerStatus: "result 0",
    });
    expect(ruleIds(failed)).toContain("PAYOUT_STATUS");
    const approved = analyze(
      json(result("ApproveWithdrawal", { orderid: "PPLsynthP2", result: "1" })),
    );
    expect(approved.events[0]).toMatchObject({ stage: "payout", outcome: "pending" });
  });

  it("reads GetWithdrawals transfer states and keeps new states unknown", () => {
    const r = analyzeFixture("trustly/eu-get-withdrawals.json");
    expect(r.events[0]).toMatchObject({
      eventType: "GetWithdrawals",
      stage: "payout",
      outcome: "pending",
      providerStatus: "EXECUTED",
      amountMinor: "7500",
      attributes: {
        transferStateMeaning: "Processed, not confirmed",
        withdrawalReference: "PPLsynth01",
      },
    });
    expect(r.events[0]!.source.path).toBe("result.data[0]");
    const many = analyze(
      json(
        result("GetWithdrawals", [
          { orderid: "PPLsynthW1", transferstate: "CONFIRMED" },
          { orderid: "PPLsynthW2", transferstate: "RETURNED" },
          { orderid: "PPLsynthW3", transferstate: "LANDED" },
        ]),
      ),
    );
    expect(many.events.map((e) => e.outcome)).toEqual(["success", "failure", "unknown"]);
    expect(many.events[2]!.attributes.transferStateUndocumented).toBe(true);
  });

  it("shows results of methods without documented semantics as unknown", () => {
    const r = analyze(
      json(
        result("SelectAccount", { orderid: "PPLsynthS1", url: "https://x.example/PLANTEDSESSION" }),
      ),
    );
    expect(r.events[0]).toMatchObject({
      eventType: "SelectAccount",
      eventTypeKnown: false,
      outcome: "unknown",
    });
    expect(json(r.events)).not.toContain("PLANTEDSESSION");
  });

  it("decodes a rejected value in a result", () => {
    const r = analyze(
      json(result("RemoveAzuraAccount", { result: "0", rejected: "ERROR_ACCOUNT_NOT_FOUND" })),
    );
    expect(r.errors[0]).toMatchObject({
      code: "ERROR_ACCOUNT_NOT_FOUND",
      confidence: "possible",
      subCodes: { method: "RemoveAzuraAccount", error_name: "ERROR_ACCOUNT_NOT_FOUND" },
    });
  });

  it("recognizes but does not analyze merchant requests and notification replies", () => {
    const req = analyzeFixture("trustly/eu-deposit-request.json");
    expect(req.records[0]).toMatchObject({ status: "unsupported", format: "trustly.eu.request" });
    expect(req.warnings.map((w) => w.message).join(" ")).toMatch(/carries API credentials/);
    expect(req.events).toEqual([]);
    const report = toJsonReport(req);
    for (const v of [
      "PLANTEDPASSWORD0001",
      "PLANTEDUSERNAME",
      "PLANTEDNOTIFYPATH",
      "planted.person@example.com",
    ])
      expect(report).not.toContain(v);

    const reply = analyze(json(result("debit", { status: "FAILED" })));
    expect(reply.records[0]).toMatchObject({
      status: "unsupported",
      format: "trustly.eu.notification_response",
    });
  });
});

describe("trustly EU errors", () => {
  it("decodes the credentials error", () => {
    const r = analyzeFixture("trustly/eu-error-invalid-credentials.json");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      eventType: "error.616",
    });
    expect(r.errors[0]).toMatchObject({
      code: "616",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: { method: "Deposit", error_name: "ERROR_INVALID_CREDENTIALS" },
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://docs.trustly.com/api/error-handling",
    );
    expect(r.suggestedView).toBe("decoder");
  });

  it("decodes a refund validation error", () => {
    const e = analyzeFixture("trustly/eu-refund-exceeds-deposit.json").errors[0]!;
    expect(e).toMatchObject({ code: "670", category: "invalid_amount", retry: "do_not_retry" });
    expect(e.documentation.map((d) => d.url)).toContain("https://docs.trustly.com/api/refund");
  });

  it("never presents a network or unknown error as safe to retry", () => {
    const net = analyze(json(euError(619, "ERROR_NETWORK", "Deposit")));
    expect(net.errors[0]).toMatchObject({
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(net.events[0]!.outcome).toBe("unknown");
    expect(net.errors[0]!.retryExplanation).toMatch(/does not say whether the request took effect/);
    expect(ruleIds(net)).toContain("POSSIBLE_RETRY_RISK");
    const unknown = analyze(json(euError(620, "ERROR_UNKNOWN"))).errors[0]!;
    expect(unknown).toMatchObject({ category: "unknown", retry: "retry_conditionally" });
    expect(unknown.missingInformation.join(" ")).toMatch(/no cause/);
  });

  it("lowers confidence when the name and code disagree and resolves a name-only error", () => {
    const mismatch = analyze(json(euError(616, "ERROR_INVALID_AMOUNT"))).errors[0]!;
    expect(mismatch).toMatchObject({ code: "616", confidence: "possible" });
    const nameOnly = analyze(
      json({ version: "1.1", error: { name: "JSONRPCError", message: "ERROR_DUPLICATE_UUID" } }),
    ).errors[0]!;
    expect(nameOnly).toMatchObject({
      code: "688",
      category: "duplicate_request",
      confidence: "strong",
    });
  });

  it("reports unrecognized codes honestly", () => {
    const r = analyze(json(euError(799, "ERROR_SOMETHING_NEW")));
    expect(r.errors[0]).toMatchObject({
      code: "799",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/without notice/);
    expect(r.events[0]!.outcome).toBe("unknown");
  });

  it("drops the null method of JSON-RPC level errors and keeps the HTTP status", () => {
    const r = analyze(httpJson("200 OK", euError(623, "ERROR_INVALID_PARAMETERS", "null")));
    expect(r.errors[0]!.subCodes).toEqual({
      http_status: "200",
      error_name: "ERROR_INVALID_PARAMETERS",
    });
  });
});

describe("trustly EU payouts", () => {
  it("decodes a failed payout and shows the returning credit with its context", () => {
    const r = analyzeFixture("trustly/eu-payout-failed.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.find((e) => e.eventType === "payoutfailed")).toMatchObject({
      stage: "payout",
      outcome: "failure",
      amountMinor: "4091",
      attributes: { errorCode: "incorrect_account_number" },
    });
    expect(r.errors[0]).toMatchObject({
      code: "incorrect_account_number",
      category: "invalid_request",
      retry: "customer_action_required",
      paymentReference: "PPLsynth5000001",
      providerMessage: "Format of the account number specified is not correct",
    });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe("Payout failed");
  });

  it("keeps undocumented payoutfailed codes unknown", () => {
    const unknown = analyze(json(notification("payoutfailed", { errorcode: "bank_rejected" })))
      .errors[0]!;
    expect(unknown).toMatchObject({
      code: "bank_rejected",
      category: "unknown",
      confidence: "insufficient",
    });
    const none = analyze(json(notification("payoutfailed"))).errors[0]!;
    expect(none).toMatchObject({
      code: "payoutfailed",
      category: "unknown",
      confidence: "possible",
    });
  });

  it("treats a downgrade as informational and a confirmation as the final payout state", () => {
    const r = analyzeFixture("trustly/eu-payout-confirmed.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payoutdowngraded", "pending"],
      ["payoutconfirmation", "success"],
      ["AccountPayout", "pending"],
    ]);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toEqual([]);
  });
});

describe("trustly North America events", () => {
  it("reads the documented Authorize event", () => {
    const r = analyzeFixture("trustly/amer-authorize-event.txt");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "trustly.amer.event",
      eventType: "Authorize",
      stage: "authorization",
      outcome: "success",
      providerStatus: "2",
      paymentReference: "PPLsynthT1001",
      merchantReference: "PPLsynth-ref-a001",
      eventReference: "PPLsynthE1001",
      deliveryKey: "event:PPLsynthE1001",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
      attributes: {
        statusName: "Authorized",
        transactionTypeName: "Capture",
        paymentTypeName: "Deferred",
        providerTransactionStatus: "AC100",
        providerTransactionStatusMeaning: "Pending",
      },
    });
    expect(r.errors).toEqual([]);
  });

  it("decodes a denial with its reason code from an HTTP request", () => {
    const r = analyzeFixture("trustly/amer-failed-insufficient-funds.txt");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      attributes: { suggestedRetryAmount: "25.00", reasonCode: "12" },
    });
    expect(r.errors[0]).toMatchObject({
      code: "SW021",
      category: "insufficient_funds",
      retry: "customer_action_required",
      outcomeKnown: true,
      subCodes: { reason_code: "12" },
    });
    expect(r.errors[0]!.explanation).toMatch(/Reason 12: Insufficient funds/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("decodes a user cancellation", () => {
    const r = analyzeFixture("trustly/amer-cancelled-by-user.txt");
    expect(r.events[0]).toMatchObject({ stage: "cancellation", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({ code: "UC08", retry: "customer_action_required" });
    expect(r.errors[0]!.explanation).toMatch(/account selection/);
  });

  it("links capture events to their authorization and reports the repeated event", () => {
    const r = analyzeFixture("trustly/amer-capture-flow.txt");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["Authorize", "authorization", "success"],
      ["Process", "capture", "pending"],
      ["Complete", "capture", "success"],
      ["Complete", "capture", "success"],
    ]);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
    expect(r.errors).toEqual([]);
  });

  it("decodes extended reasons, including velocity patterns and debt codes", () => {
    const velocity = analyze(
      json({
        eventId: "PPLsynthE7001",
        eventType: "Deny",
        objectId: "PPLsynthT7001",
        objectType: "Transaction",
        timeZone: "Etc/UTC",
        status: 8,
        paymentProviderTransaction: { status: "SW054", reasonCode: "11024" },
      }),
    );
    expect(velocity.events[0]).toMatchObject({ outcome: "failure", stage: "other" });
    expect(velocity.errors[0]).toMatchObject({
      code: "SW054",
      category: "fraud_or_risk",
      retry: "retry_conditionally",
    });
    expect(velocity.errors[0]!.explanation).toMatch(
      /velocity exceeded over XXX hours \(XXX = 024\)/,
    );
    expect(velocity.errors[0]!.retryExplanation).toMatch(/different bank account/);

    const debt = analyze(
      amerEvent({
        eventType: "Deny",
        status: "8",
        "paymentProviderTransaction.status": "SW055",
        "paymentProviderTransaction.reasonCode": "50006",
      }),
    ).errors[0]!;
    expect(debt).toMatchObject({ code: "SW055", retry: "customer_action_required" });

    const mismatch = analyze(
      amerEvent({
        status: "8",
        "paymentProviderTransaction.status": "SW021",
        "paymentProviderTransaction.reasonCode": "5",
      }),
    ).errors[0]!;
    expect(mismatch.missingInformation.join(" ")).toMatch(/documented for SW055, not SW021/);
  });

  it("keeps undocumented statuses and codes unknown", () => {
    const r = analyze(amerEvent({ status: "9", "paymentProviderTransaction.status": "ZZ999" }));
    expect(r.events[0]).toMatchObject({
      outcome: "unknown",
      attributes: { statusUndocumented: true },
    });
    expect(r.errors[0]).toMatchObject({
      code: "ZZ999",
      category: "unknown",
      confidence: "insufficient",
    });
    const ach = analyze(amerEvent({ status: "10", "paymentProviderTransaction.status": "R01" }))
      .errors[0]!;
    expect(ach).toMatchObject({ code: "R01", retry: "manual_review", confidence: "insufficient" });
    expect(ach.missingInformation.join(" ")).toMatch(/not enumerated/);
    const newType = analyze(amerEvent({ eventType: "Settle" }));
    expect(ruleIds(newType)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("decodes UK Direct Debit codes with honest confidence", () => {
    const known = analyze(
      amerEvent({ status: "5", "paymentProviderTransaction.status": "ARUDD_0" }),
    ).errors[0]!;
    expect(known).toMatchObject({ category: "insufficient_funds", confidence: "strong" });
    const weak = analyze(
      amerEvent({ status: "5", "paymentProviderTransaction.status": "AUDDIS_1" }),
    ).errors[0]!;
    expect(weak).toMatchObject({
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
  });

  it("shows system codes as conditional retries with an open outcome", () => {
    const r = analyze(
      amerEvent({ eventType: "Update", status: "1", "paymentProviderTransaction.status": "SE02" }),
    );
    expect(r.errors[0]).toMatchObject({
      code: "SE02",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("reports a dispute event as a dispute", () => {
    const r = analyze(
      amerEvent({
        eventType: "Dispute",
        status: "10",
        "paymentProviderTransaction.status": "AC112",
      }),
    );
    expect(r.events[0]).toMatchObject({ stage: "dispute" });
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
    expect(r.errors).toEqual([]);
  });

  it("reads a Transaction object with a return code", () => {
    const r = analyzeFixture("trustly/amer-transaction-returned.json");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "trustly.amer.transaction",
      eventType: "transaction.Reversed",
      stage: "reversal",
      outcome: "failure",
      paymentReference: "PPLsynthT5002",
      relatedReference: "PPLsynthT5001",
      amountMinor: "12540",
      currency: "CAD",
      attributes: {
        timestampSource: "updatedAt",
        providerTransactionId: "PPLsynthPPT5002",
        providerTransactionStatus: "901",
        providerTransactionStatusMeaning: "Insufficient funds",
      },
    });
    expect(r.errors[0]).toMatchObject({
      code: "901",
      category: "insufficient_funds",
      paymentReference: "PPLsynthT5002",
    });
  });

  it("never links EU orders with North America transactions", () => {
    const r = analyze(
      json([
        notification("credit", { orderid: "PPLsynthSAME1" }),
        Object.fromEntries(new URLSearchParams(amerEvent({ objectId: "PPLsynthSAME1" }))),
      ]),
    );
    expect(r.records.map((x) => x.format)).toEqual([
      "trustly.eu.notification",
      "trustly.amer.event",
    ]);
    expect(r.events).toHaveLength(2);
    expect(r.groups).toHaveLength(2);
  });
});

describe("trustly North America REST errors", () => {
  it("decodes a documented error code", () => {
    const r = analyzeFixture("trustly/amer-error-invalid-parameter.txt");
    expect(r.errors[0]).toMatchObject({
      code: "200",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { domain: "com.trustly.api", location: "amount", http_status: "400" },
      providerMessage: "Invalid parameter",
    });
  });

  it("treats internal and remote errors as an unknown outcome", () => {
    const r = analyze(
      httpJson("500 Internal Server Error", {
        errors: [
          {
            domain: "d",
            code: 150,
            location: "x",
            message: "Remote error",
            occurredAt: 1792600000000,
          },
        ],
      }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("reports unrecognized codes honestly", () => {
    const server = analyze(
      httpJson("503 Service Unavailable", { errors: [{ code: 555, occurredAt: 1 }] }),
    ).errors[0]!;
    expect(server).toMatchObject({
      category: "provider_unavailable",
      confidence: "possible",
      retry: "retry_conditionally",
    });
    const plain = analyze(json({ errors: [{ code: 555, occurredAt: 1, message: "x" }] }))
      .errors[0]!;
    expect(plain).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
      retry: "unknown",
    });
    expect(plain.missingInformation).toContain("No HTTP status was supplied.");
  });
});

describe("trustly sensitive data", () => {
  const PLANTED = [
    "PLANTEDSIGNATURE",
    "PLANTEDSESSIONID0001",
    "PPLSYNTH-ENDUSER-PLANTED",
    "PPLSYNTH-KYCENTITY-PLANTED",
    "PLANTEDPERSONID",
    "Plantedfirst",
    "Plantedlast",
    "Planted Street",
    "PLANTEDZIP99",
    "Plantedcity",
    "PLANTEDACCOUNTID0001",
    "Plantedbank",
    "PLANTEDDESCRIPTOR",
    "987654",
    "Planted Holder",
    "Planted Road",
    "PLANTEDACCESSID0001",
    "PLANTEDSPLITTOKEN0001",
    "PLANTEDFICODE",
    "UExBTlRFREFVVEhIRUFERVIwMDAx",
    "PLANTEDPPTSIGNATURE0001",
    "PPLsynth1002463580",
  ];

  it.each([
    "trustly/eu-deposit-flow.json",
    "trustly/eu-kyc-abort.json",
    "trustly/eu-account-notification.json",
    "trustly/eu-payout-failed.json",
    "trustly/amer-authorize-event.txt",
    "trustly/amer-failed-insufficient-funds.txt",
    "trustly/amer-transaction-returned.json",
  ])("keeps planted values out of events and the JSON report (%s)", (path) => {
    const r = analyzeFixture(path);
    expect(r.events.length).toBeGreaterThan(0);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
  });

  it("flags sensitive fields in the raw input and drops personal merchant references", () => {
    expect(analyzeFixture("trustly/eu-kyc-abort.json").sensitiveData.detected).toBe(true);
    const e = analyze(json(notification("credit", { messageid: "planted.person@example.com" })))
      .events[0]!;
    expect(e.merchantReference).toBeUndefined();
    expect(json(e)).not.toContain("planted.person@example.com");
  });
});

describe("trustly manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(trustlyAdapter);
    expect(trustlyAdapter.manifest).toBe(trustlyManifest);
    expect(trustlyAdapter.version).toBe(TRUSTLY_ADAPTER_VERSION);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(trustlyManifest).toMatchObject({
      id: "trustly",
      wave: "HR-3",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      categories: ["alternative_payment_method"],
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "limited",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_guaranteed" },
    });
    expect(trustlyManifest.sectors).toHaveLength(7);
    for (const s of trustlyManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/www\.trustly\.com\/verticals\//);
    expect(trustlyManifest.fixtureProvenance).toMatch(/Synthetic/);
    const limits = trustlyManifest.limitations.join(" ");
    expect(limits).toMatch(/never mixed/);
    expect(limits).toMatch(/never shown as a credited payment/);
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/not documented/);
    const families = trustlyManifest.apiFamilies.map((f) => f.id);
    for (const f of trustlyAdapter.supportedFormats) expect(families).toContain(f.id);
    expect(
      trustlyManifest.apiFamilies.filter((f) => f.status === "unsupported").map((f) => f.id),
    ).toEqual(["trustly.eu.request", "trustly.eu.notification_response"]);
  });

  it("contains every documented code and status", () => {
    expect(Object.keys(EU_ERROR_CODES)).toHaveLength(74);
    expect(Object.keys(EU_ERROR_NAMES)).toHaveLength(74);
    expect(Object.keys(EU_OTHER_ERROR_NAMES)).toHaveLength(2);
    expect(Object.keys(EU_NOTIFICATIONS)).toHaveLength(12);
    expect(Object.keys(EU_METHODS)).toHaveLength(5);
    expect(Object.keys(EU_TRANSFER_STATES)).toHaveLength(11);
    expect(EU_CANCEL_ORDER_STATUSES.size).toBe(4);
    expect(Object.keys(EU_KYC_ABORT_MESSAGES)).toHaveLength(2);
    expect(Object.keys(EU_PAYOUT_ERROR_CODES)).toHaveLength(2);
    const amer =
      Object.keys(AMER_SW_CODES).length +
      Object.keys(AMER_UC_CODES).length +
      Object.keys(AMER_AC_CODES).length +
      Object.keys(AMER_SE_CODES).length +
      Object.keys(AMER_INTERNAL_ERRORS).length +
      Object.keys(AMER_EXTENDED_REASONS).length +
      Object.keys(AMER_EFT_RETURN_CODES).length +
      Object.keys(AMER_UK_DD_CODES).length;
    expect(amer).toBe(193);
    expect(Object.keys(AMER_SW_CODES)).toHaveLength(13);
    expect(Object.keys(AMER_UC_CODES)).toHaveLength(37);
    expect(AMER_UC_CODES.UC37!.meaning).toMatch(/widget within Lightbox/);
    expect(Object.keys(AMER_AC_CODES)).toHaveLength(19);
    expect(Object.keys(AMER_UK_DD_CODES)).toHaveLength(53);
    expect(Object.keys(AMER_REASON_CODES)).toHaveLength(14);
    expect(Object.keys(AMER_TRANSACTION_STATUSES)).toHaveLength(14);
    expect(AMER_TRANSACTION_STATUSES["9"]).toBeUndefined();
    expect(Object.keys(AMER_TRANSACTION_TYPES)).toHaveLength(12);
    expect(Object.keys(AMER_PAYMENT_TYPES)).toHaveLength(5);
    expect(Object.keys(AMER_EVENT_TYPES)).toHaveLength(17);
    expect(extendedReason("13999")).toMatchObject({ key: "13XXX", window: "999" });
    expect(extendedReason("11000")).toBeUndefined();
    expect(extendedReason("constructor")).toBeUndefined();
  });

  it("keeps the deposit lifecycle semantics of the documented notifications", () => {
    expect(EU_NOTIFICATIONS.pending).toMatchObject({ stage: "payment", outcome: "pending" });
    expect(EU_NOTIFICATIONS.credit).toMatchObject({ stage: "payment", outcome: "success" });
    expect(EU_NOTIFICATIONS.debit!.outcome).toBe("unknown");
    expect(EU_NOTIFICATIONS.cancel).toMatchObject({ stage: "cancellation", outcome: "failure" });
    expect(EU_NOTIFICATIONS.payoutconfirmation).toMatchObject({
      stage: "payout",
      outcome: "success",
    });
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      trustlyManifest,
      EU_ERROR_CODES,
      EU_OTHER_ERROR_NAMES,
      EU_NOTIFICATIONS,
      EU_METHODS,
      EU_TRANSFER_STATES,
      EU_KYC_ABORT_MESSAGES,
      EU_PAYOUT_ERROR_CODES,
      AMER_SW_CODES,
      AMER_UC_CODES,
      AMER_AC_CODES,
      AMER_SE_CODES,
      AMER_INTERNAL_ERRORS,
      AMER_EXTENDED_REASONS,
      AMER_REASON_CODES,
      AMER_EFT_RETURN_CODES,
      AMER_UK_DD_CODES,
      AMER_TRANSACTION_STATUSES,
      AMER_TRANSACTION_TYPES,
      AMER_EVENT_TYPES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
