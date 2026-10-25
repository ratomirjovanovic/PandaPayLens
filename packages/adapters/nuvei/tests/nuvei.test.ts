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
import { skrillAdapter } from "@pandapaylens/skrill";
import {
  API_STATUSES,
  AVS_CODES,
  CVV2_REPLIES,
  DECLINE_REASONS,
  DMN_STATUSES,
  DUPLICATED_FILTER_CODES,
  EVENT_TYPES,
  FILTER_ERROR_CODES,
  GATEWAY_RESPONSE_ROWS,
  MARKETPLACE_ERROR_CODES,
  MERCHANT_ADVICE_CODES,
  NUVEI_ADAPTER_VERSION,
  PPP_STATUSES,
  REQUEST_ERROR_CODES,
  SDK_ERROR_CODE_NAMES,
  THREE_DS_REASONS,
  THREE_DS_RESULTS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  WD_ORDER_STATUSES,
  WD_REQUEST_STATUSES,
  findDeclineReason,
  nuveiAdapter,
  nuveiManifest,
} from "@pandapaylens/nuvei";
import defaultExport from "@pandapaylens/nuvei";
import { nuveiManifest as manifestOnly } from "@pandapaylens/nuvei/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [nuveiAdapter],
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

const CHECKSUM = "ab".repeat(32);

const rest = (fields: Record<string, unknown> = {}) => ({
  orderId: "PPLsynth-order-9001",
  transactionStatus: "APPROVED",
  gwErrorCode: 0,
  gwExtendedErrorCode: 0,
  gwErrorReason: "",
  transactionType: "Sale",
  transactionId: "PPLsynth-trx-9001",
  clientUniqueId: "PPLsynth-merchant-9001",
  internalRequestId: 9001,
  status: "SUCCESS",
  errCode: 0,
  reason: "",
  merchantId: "PPLsynth-merchant",
  merchantSiteId: "PPLsynth-site",
  version: "1.0",
  ...fields,
});

const restError = (errCode: number, reason: string, fields: Record<string, unknown> = {}) => ({
  internalRequestId: 9002,
  status: "ERROR",
  errCode,
  reason,
  merchantId: "PPLsynth-merchant",
  merchantSiteId: "PPLsynth-site",
  version: "1.0",
  ...fields,
});

const dmn = (fields: Record<string, string | undefined> = {}) =>
  new URLSearchParams(
    Object.entries({
      ppp_status: "OK",
      PPP_TransactionID: "PPLsynth-ppp-9001",
      merchant_unique_id: "PPLsynth-merchant-9001",
      totalAmount: "10.00",
      currency: "EUR",
      Status: "APPROVED",
      ExErrCode: "0",
      ErrCode: "0",
      Reason: "",
      ReasonCode: "0",
      payment_method: "cc_card",
      responseTimeStamp: "2026-10-20.10:00:00",
      transactionType: "Sale",
      type: "DEPOSIT",
      TransactionID: "PPLsynth-trx-d9001",
      advanceResponseChecksum: CHECKSUM,
      ...fields,
    }).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();

const withdrawal = (fields: Record<string, string | undefined> = {}) =>
  new URLSearchParams(
    Object.entries({
      wdRequestId: "PPLsynth-wd-9001",
      wdRequestState: "Closed",
      wdRequestStatus: "Approved",
      wdOrderId: "PPLsynth-wdo-9001",
      wdOrderStatus: "Settled",
      gwTrxId: "PPLsynth-trx-w9001",
      gwErrCode: "0",
      gwExtendedErrorCode: "0",
      checksum: CHECKSUM,
      ...fields,
    }).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();

const chargeback = (fields: Record<string, unknown> = {}, cb: Record<string, unknown> = {}) => ({
  EventId: "PPLsynth-event-9001",
  EventType: "Chargeback",
  ProcessingEntityType: "client",
  AttemptNumber: 1,
  EventDateUTC: "2026-10-24T08:21:23.374Z",
  EventCorrelationId: "PPLsynth-correlation-9001",
  Chargeback: {
    ChargebackStatusCategory: "Regular",
    Type: "Chargeback",
    Amount: 10.25,
    Currency: "eur",
    ChargebackReason: "10.4 - Other Fraud-Card Absent Environment",
    ...cb,
  },
  TransactionDetails: { TransactionId: "PPLsynth-trx-d9001" },
  ...fields,
});

const firstError = (text: string) => analyze(text).errors[0]!;
const firstEvent = (text: string) => analyze(text).events[0]!;

describe("nuvei detection", () => {
  it.each([
    ["rest-payment-approved.json", "nuvei.rest_response", 0.95],
    ["rest-settle-approved.json", "nuvei.rest_response", 0.95],
    ["rest-request-error-session-expired.json", "nuvei.rest_response", 0.6],
    ["rest-refund-apm-pending.json", "nuvei.rest_response", 0.6],
    ["dmn-sale-approved.txt", "nuvei.payment_dmn", 0.95],
    ["dmn-sale-declined-get.txt", "nuvei.payment_dmn", 0.95],
    ["dmn-get-url.txt", "nuvei.payment_dmn", 0.7],
    ["withdrawal-dmn-request-pending.txt", "nuvei.withdrawal_dmn", 0.9],
    ["withdrawal-dmn-order-settled.txt", "nuvei.withdrawal_dmn", 0.8],
    ["event-chargeback.json", "nuvei.chargeback_dmn", 0.95],
  ])("recognizes %s", (file, format, confidence) => {
    const r = analyzeFixture(`nuvei/${file}`);
    expect(r.records[0]).toMatchObject({ status: "analyzed", format, confidence });
  });

  it("needs two of the decisive payment DMN markers", () => {
    const one = parseInput("ppp_status=OK&Status=APPROVED&ErrCode=0&ExErrCode=0");
    if (!one.ok) throw new Error("parse failed");
    const d = nuveiAdapter.detect(one.value.records[0], one.value.meta[0]);
    expect(d.format).toBe("nuvei.payment_dmn");
    expect(d.confidence).toBeLessThan(0.5);
    const two = parseInput("ppp_status=OK&PPP_TransactionID=PPLsynth-1&Status=APPROVED");
    if (!two.ok) throw new Error("parse failed");
    expect(nuveiAdapter.detect(two.value.records[0], two.value.meta[0]).confidence).toBe(0.7);
  });

  it("keeps a REST error without internalRequestId below the threshold", () => {
    const input = {
      status: "ERROR",
      errCode: 1069,
      reason: "Session has expired",
      merchantSiteId: "PPLsynth-site",
    };
    expect(nuveiAdapter.detect(input)).toMatchObject({
      format: "nuvei.rest_response",
      confidence: 0.45,
    });
    const auto = analyze(json(input));
    expect(auto.records[0]!.status).toBe("unsupported");
    const chosen = analyze(json(input), { provider: "nuvei" });
    expect(chosen.records[0]!.status).toBe("analyzed");
    expect(chosen.errors[0]).toMatchObject({ code: "1069", category: "invalid_request" });
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "nuvei", message: "Nuvei error" },
      "nuvei",
      null,
      [],
      { status: "ERROR" },
      { status: "ERROR", errCode: 1001, reason: "x" },
      { status: "SUCCESS", errCode: 0 },
      { error: { code: 1001 } },
      { transactionStatus: "APPROVED" },
      { gwErrorCode: -1 },
      { internalRequestId: 1, status: "OK", errCode: 0 },
      {
        status: "approved",
        result: { status: "approved" },
        version: "2.0",
        gwErrorCode: 0,
        gwExtendedErrorCode: 0,
      },
      { object: "charge", gwErrorCode: 0, gwExtendedErrorCode: 0 },
      { EventType: "Chargeback" },
      { Status: "APPROVED", TransactionID: "PPLsynth-1" },
      { status: "2", mb_transaction_id: "PPLsynth-1", merchant_id: "PPLsynth-2" },
      { dmnType: "subscription" },
      { wdOrderStatus: "Settled" },
    ]) {
      expect(nuveiAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("ignores JSON-only formats when the input is form data", () => {
    expect(nuveiAdapter.detect(rest(), { format: "form" }).confidence).toBe(0);
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "nuvei" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );
  const records = (dir: string) => {
    const out: {
      name: string;
      payload: unknown;
      meta: Parameters<typeof nuveiAdapter.detect>[1];
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

  it("includes the Stripe, Adyen and Skrill fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "skrill"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const list = records(dir);
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) expect(nuveiAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
  });

  it("does not let the Skrill adapter claim Nuvei DMNs, including Skrill payments made through Nuvei", () => {
    const list = records("nuvei");
    expect(list.length).toBeGreaterThan(20);
    for (const r of list)
      expect(skrillAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
    const viaNuvei = analyzeFixture("nuvei/dmn-skrill-apm-approved.txt");
    expect(viaNuvei.records[0]!.format).toBe("nuvei.payment_dmn");
    expect(viaNuvei.events[0]!.attributes.paymentMethod).toBe("apmgw_MoneyBookers");
  });
});

describe("nuvei parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noStatus = rest();
    delete (noStatus as Record<string, unknown>).status;
    const r = analyze(json(noStatus));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "nuvei.rest_response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status/);

    const noTrx = analyze(
      "ppp_status=OK&advanceResponseChecksum=" +
        CHECKSUM +
        "&Status=APPROVED&ErrCode=0&ExErrCode=0&TransactionID=",
    );
    expect(noTrx.records[0]).toMatchObject({ status: "invalid", format: "nuvei.payment_dmn" });
    expect(noTrx.records[0]!.reasons.join(" ")).toMatch(
      /TransactionID or PPP_TransactionID: required/,
    );

    const noOrder = analyze("wdRequestId=PPLsynth-wd-1&wdRequestState=Open&checksum=" + CHECKSUM);
    expect(noOrder.records[0]).toMatchObject({ status: "invalid", format: "nuvei.withdrawal_dmn" });

    const noBlock = chargeback();
    delete (noBlock as Record<string, unknown>).Chargeback;
    const cb = analyze(json(noBlock));
    expect(cb.records[0]).toMatchObject({ status: "invalid", format: "nuvei.chargeback_dmn" });
  });

  it("reports a repeated DMN field and unknown formats", () => {
    const r = analyze(dmn() + "&Status=DECLINED");
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/Status: appears more than once/);
    expect(nuveiAdapter.parse({}, "nuvei.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported Nuvei format "nuvei.unknown".'],
    });
  });

  it("tolerates unknown fields, nulls, numeric strings and lenient JSON", () => {
    const r = analyze(
      json(
        rest({
          gwErrorCode: "-1",
          gwExtendedErrorCode: "0",
          transactionStatus: "DECLINED",
          gwErrorReason: "Do not honor",
          extra: { nested: [1, 2] },
          paymentOption: null,
        }),
      ),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.errors[0]!.code).toBe("Do not honor");
    const lenient = analyze(
      `{"internalRequestId": 1, "status": "ERROR", "errCode": 1069, "reason": "Session has expired",}`,
    );
    expect(lenient.records[0]!.status).toBe("analyzed");
    expect(lenient.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
  });

  it("fails cleanly on malformed input and XML", () => {
    const bad = analyzeText('{"internalRequestId": 1, "status": "ERROR", "errCode": ', options);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("INVALID_JSON");
    const xml = analyzeText("<response><status>ERROR</status></response>", options);
    expect(xml.ok).toBe(false);
    if (!xml.ok) expect(xml.error.code).toBe("UNSUPPORTED_FORMAT");
    expect(
      analyze(
        json({
          internalRequestId: 1,
          status: 7,
          errCode: 0,
          transactionStatus: "APPROVED",
          gwErrorCode: 0,
          gwExtendedErrorCode: 0,
        }),
      ).records[0]!.status,
    ).toBe("invalid");
  });

  it.each([
    ["payment-page-redirect.txt", "nuvei.payment_page_redirect", /Payment Page/],
    ["subscription-dmn.txt", "nuvei.subscription_dmn", /subscription DMN/],
    ["event-pre-chargeback-alert.json", "nuvei.event_dmn", /Pre-Chargeback Alert/],
  ])("recognizes but does not analyze %s", (file, format, message) => {
    const r = analyzeFixture(`nuvei/${file}`);
    expect(r.records[0]).toMatchObject({ status: "unsupported", format });
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(message);
    expect(r.events).toEqual([]);
  });

  it("does not analyze REST API 2.0 responses", () => {
    const v2 = {
      version: "2.0",
      internalRequestId: 1,
      status: "ERROR",
      errCode: 1069,
      gwErrorCode: 0,
      gwExtendedErrorCode: 0,
    };
    expect(nuveiAdapter.detect(v2).confidence).toBe(0);
  });
});

describe("nuvei REST API 1.0 responses", () => {
  it("normalizes a successful payment without errors", () => {
    const r = analyzeFixture("nuvei/rest-payment-approved.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      provider: "nuvei",
      sourceFormat: "nuvei.rest_response",
      eventType: "api_response.Sale",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "APPROVED",
      paymentReference: "PPLsynth1110000000010304183",
      merchantReference: "PPLsynth-order-1001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      apiStatus: "SUCCESS",
      transactionStatus: "APPROVED",
      gwErrorCode: "0",
      gwExtendedErrorCode: "0",
      cvv2Reply: "M",
      avsCode: "Y",
      fraudDecision: "Accept",
      isAFT: true,
      orderId: "PPLsynth271308078",
    });
    // A Merchant Advice Code next to an approval is not interpreted.
    expect(r.events[0]!.attributes.merchantAdviceCode).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("does not guess the operation of a response without transactionType", () => {
    const e = analyzeFixture("nuvei/rest-settle-approved.json").events[0]!;
    expect(e).toMatchObject({ stage: "other", outcome: "success", eventType: "api_response" });
    expect(e.attributes.stageInferredFrom).toMatch(/no transactionType/);
    expect(firstEvent(json(rest({ transactionType: "Settle" })))).toMatchObject({
      stage: "capture",
    });
    expect(firstEvent(json(rest({ transactionType: "Auth" })))).toMatchObject({
      stage: "authorization",
    });
    expect(firstEvent(json(rest({ transactionType: "Credit" })))).toMatchObject({
      stage: "refund",
    });
    expect(firstEvent(json(rest({ transactionType: "VoidCredit" })))).toMatchObject({
      stage: "void",
    });
    // /getTransactionDetails prints its vocabulary in lower case and "Approved".
    expect(
      firstEvent(json(rest({ transactionType: "payout", transactionStatus: "Approved" }))),
    ).toMatchObject({ stage: "payout", outcome: "success", eventTypeKnown: true });
  });

  it("reads an /initPayment response as a 3-D Secure step", () => {
    const e = firstEvent(
      json(
        rest({
          transactionType: undefined,
          paymentOption: { card: { threeD: { v2supported: "true" } } },
        }),
      ),
    );
    expect(e).toMatchObject({ stage: "authentication", outcome: "success" });
    expect(e.attributes).toMatchObject({ threeDSv2Supported: true });
  });

  it("decodes a decline by its gateway reason", () => {
    const r = analyzeFixture("nuvei/rest-payment-declined-insufficient-funds.json");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      providerStatus: "DECLINED",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "Insufficient funds",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "PPLsynth1110000000010304190",
      attemptReference: "PPLsynth1110000000010304190",
      subCodes: {
        gwErrorCode: "-1",
        gwExtendedErrorCode: "0",
        gwErrorReason: "Insufficient funds",
        merchantAdviceCode: "24",
        transactionStatus: "DECLINED",
      },
    });
    expect(r.errors[0]!.explanation).toMatch(/Retry after 1 hour/);
    expect(r.events[0]!.attributes.merchantAdviceCode).toBe("24");
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("uses the stricter Merchant Advice Code guidance", () => {
    const r = analyzeFixture("nuvei/rest-payment-declined-http.txt");
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.events[0]!.attributes.httpStatus).toBe(200);
    expect(r.errors[0]).toMatchObject({
      code: "Do not honor",
      category: "card_declined",
      retry: "do_not_retry",
      subCodes: { merchantAdviceCode: "03", http_status: "200" },
    });
    expect(r.errors[0]!.explanation).toMatch(/stricter retry guidance/);
    const unknownAdvice = firstError(
      json(
        rest({
          transactionStatus: "DECLINED",
          gwErrorCode: -1,
          gwErrorReason: "Do not honor",
          merchantAdviceCode: "99",
        }),
      ),
    );
    expect(unknownAdvice.missingInformation.join(" ")).toMatch(
      /not one of the 16 documented values/,
    );
  });

  it("matches decline reasons without regard to case, a trailing period or the dash", () => {
    expect(findDeclineReason("insufficient FUNDS.")?.reason).toBe("Insufficient funds");
    expect(
      findDeclineReason(`Soft Decline ${String.fromCharCode(0x2013)} Authentication is Advised`)
        ?.reason,
    ).toBe("Soft Decline - Authentication is Advised");
    expect(findDeclineReason("External Error in Processing")?.entry.category).toBe(
      "provider_unavailable",
    );
    expect(findDeclineReason("constructor")).toBeUndefined();
    expect(findDeclineReason(undefined)).toBeUndefined();
  });

  it("decodes a request error by errCode", () => {
    const r = analyzeFixture("nuvei/rest-request-error-session-expired.json");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "ERROR",
      eventType: "api_response",
    });
    expect(r.errors[0]).toMatchObject({
      code: "1069",
      category: "invalid_request",
      retry: "safe_to_retry_technical_request",
      confidence: "strong",
      providerMessage: "Session has expired",
      subCodes: { field: "errCode", status: "ERROR" },
    });
  });

  it("decodes an authentication failure of the request (invalid checksum) and of the login", () => {
    const r = analyzeFixture("nuvei/rest-request-error-invalid-checksum.json");
    expect(r.errors[0]).toMatchObject({
      code: "1001",
      category: "configuration",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.explanation).toMatch(/checksum/);
    const login = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1001, gwExtendedErrorCode: 0 })),
    );
    expect(login).toMatchObject({
      code: "-1001",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("decodes the same number differently in different fields", () => {
    const request = firstError(json(restError(1001, "Invalid checksum")));
    const filter = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1100, gwExtendedErrorCode: 1001 })),
    );
    expect(request.code).toBe("1001");
    expect(filter.code).toBe("1001");
    expect(request.category).toBe("configuration");
    expect(filter.category).toBe("invalid_request");
    expect(request.explanation).toMatch(/checksum/);
    expect(filter.explanation).toMatch(/Expiry date invalid/);
    expect(request.subCodes.field).toBe("errCode");
    expect(filter.subCodes.gwExtendedErrorCode).toBe("1001");
    // A filter code without the -1100 gateway code is not looked up in the filter table.
    const generic = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -5, gwExtendedErrorCode: 1114 })),
    );
    expect(generic).toMatchObject({
      code: "-5",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
  });

  it("decodes filter errors, duplicated codes and reserved codes", () => {
    const r = analyzeFixture("nuvei/rest-filter-error-blacklisted.json");
    expect(r.events[0]).toMatchObject({ outcome: "failure", providerStatus: "ERROR" });
    expect(r.errors[0]).toMatchObject({
      code: "1114",
      category: "fraud_or_risk",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    const dup = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1100, gwExtendedErrorCode: 1158 })),
    );
    expect(dup).toMatchObject({
      code: "1158",
      category: "unknown",
      confidence: "possible",
      retry: "customer_action_required",
    });
    expect(dup.explanation).toMatch(/3D PaRes value incorrect/);
    expect(dup.explanation).toMatch(/PayPal account already registered/);
    const sameCategory = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1100, gwExtendedErrorCode: 1160 })),
    );
    expect(sameCategory).toMatchObject({ category: "invalid_request", confidence: "possible" });
    const reserved = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1100, gwExtendedErrorCode: 1211 })),
    );
    expect(reserved).toMatchObject({ code: "1211", confidence: "insufficient", retry: "unknown" });
    const unknown = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1100, gwExtendedErrorCode: 4242 })),
    );
    expect(unknown).toMatchObject({
      code: "4242",
      category: "unknown",
      confidence: "insufficient",
    });
  });

  it("never presents a gateway timeout as safe to retry", () => {
    const r = analyzeFixture("nuvei/rest-gateway-timeout.json");
    expect(r.events[0]).toMatchObject({ outcome: "unknown", providerStatus: "ERROR" });
    expect(r.errors[0]).toMatchObject({
      code: "-1203",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/getPaymentStatus/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    const system = analyze(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: -1, gwExtendedErrorCode: -1 })),
    );
    expect(system.events[0]!.outcome).toBe("unknown");
    expect(system.errors[0]).toMatchObject({
      code: "-1",
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    for (const e of [...r.errors, ...system.errors])
      expect(e.retry).not.toBe("safe_to_retry_technical_request");
  });

  it("decides APPROVED and PENDING by the status field, not by the shared 0/0 codes", () => {
    const approved = analyze(json(rest()));
    const pending = analyze(json(rest({ transactionStatus: "PENDING" })));
    expect(approved.events[0]!.outcome).toBe("success");
    expect(pending.events[0]!.outcome).toBe("pending");
    expect(approved.errors).toEqual([]);
    expect(pending.errors).toEqual([]);
    expect(
      GATEWAY_RESPONSE_ROWS.filter(
        (r) => r.gwErrorCode === "0" && r.gwExtendedErrorCode === "0",
      ).map((r) => r.status),
    ).toEqual(["APPROVED", "PENDING"]);
  });

  it("shows a 3-D Secure challenge as pending without copying its URL", () => {
    const r = analyzeFixture("nuvei/rest-redirect-3ds-challenge.json");
    expect(r.events[0]).toMatchObject({
      stage: "authentication",
      outcome: "pending",
      providerStatus: "REDIRECT",
    });
    expect(r.events[0]!.attributes.pendingAction).toEqual(["threeD.acsUrl (3-D Secure challenge)"]);
    expect(r.errors).toEqual([]);
    const dump = JSON.stringify(r.events) + toJsonReport(r);
    expect(dump).not.toContain("acs.example.com");
    expect(dump).not.toContain("PPLsynthCReqValue");
    const apm = analyze(
      json(
        rest({
          transactionStatus: "REDIRECT",
          paymentOption: { redirectUrl: "https://apm.example.com/PPLsynth" },
        }),
      ),
    );
    expect(apm.events[0]!.attributes.pendingAction).toEqual([
      "paymentOption.redirectUrl (APM redirect)",
    ]);
    expect(JSON.stringify(apm.events)).not.toContain("apm.example.com");
  });

  it("decodes a failed 3-D Secure authentication", () => {
    const r = analyzeFixture("nuvei/rest-3ds-authentication-failed.json");
    expect(r.events[0]!.attributes).toMatchObject({ threeDResult: "N", threeDReasonId: "01" });
    expect(r.errors.map((e) => e.code)).toEqual(["1282", "01"]);
    expect(r.errors[1]).toMatchObject({
      category: "authentication_failed",
      confidence: "strong",
      providerMessage: "Card authentication failed",
    });
    const ambiguous = analyze(
      json(
        rest({
          transactionStatus: "DECLINED",
          gwErrorCode: -1,
          gwErrorReason: "Failed 3DSecure Authentication",
          paymentOption: { card: { threeD: { threeDReasonId: "81" } } },
        }),
      ),
    );
    expect(ambiguous.errors[1]).toMatchObject({
      code: "81",
      category: "unknown",
      confidence: "possible",
    });
    const undocumented = analyze(
      json(
        rest({
          transactionStatus: "DECLINED",
          gwErrorCode: -1,
          gwErrorReason: "Decline",
          paymentOption: { card: { threeD: { threeDReasonId: 55 } } },
        }),
      ),
    );
    expect(undocumented.errors[1]).toMatchObject({ code: "55", confidence: "insufficient" });
  });

  it("explains a soft decline", () => {
    const e = firstError(
      json(
        rest({
          transactionStatus: "DECLINED",
          gwErrorCode: -1,
          gwErrorReason: "Soft Decline - Authentication is Advised",
          paymentOption: { card: { threeD: { flow: "softDecline" } } },
        }),
      ),
    );
    expect(e).toMatchObject({
      category: "authentication_required",
      retry: "customer_action_required",
    });
    expect(e.explanation).toMatch(/soft decline/);
  });

  it("reports APM-side codes without interpreting them", () => {
    const r = analyzeFixture("nuvei/rest-apm-error.json");
    expect(r.errors.map((e) => e.code)).toEqual([
      "Payment not authorized by user",
      "PPLSYNTH-APM-17",
    ]);
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      confidence: "possible",
      retry: "customer_action_required",
    });
    expect(r.errors[1]).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "Synthetic APM decline text",
    });
  });

  it("reports unrecognized codes and code-less failures honestly", () => {
    const unknownErr = firstError(json(restError(7777, "Synthetic")));
    expect(unknownErr).toMatchObject({
      code: "7777",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const sdk = firstError(json(restError(1008, "Expired card")));
    expect(sdk).toMatchObject({ code: "1008", category: "card_declined", confidence: "possible" });
    expect(sdk.missingInformation.join(" ")).toMatch(/Java SDK/);
    const marketplace = firstError(json(restError(9110, "Synthetic")));
    expect(marketplace).toMatchObject({ category: "invalid_amount", confidence: "strong" });
    const reason = firstError(
      json(
        rest({
          transactionStatus: "DECLINED",
          gwErrorCode: -1,
          gwErrorReason: "PPLsynth unlisted reason",
        }),
      ),
    );
    expect(reason).toMatchObject({
      code: "-1",
      category: "card_declined",
      confidence: "possible",
      providerMessage: "PPLsynth unlisted reason",
    });
    const noCodes = analyze(
      json(
        rest({
          transactionStatus: "DECLINED",
          gwErrorCode: undefined,
          gwExtendedErrorCode: undefined,
        }),
      ),
    );
    expect(noCodes.errors[0]).toMatchObject({
      code: "DECLINED",
      category: "card_declined",
      confidence: "possible",
    });
    const weird = analyze(json(rest({ transactionStatus: "PPLSYNTH_STATE" })));
    expect(weird.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(ruleIds(weird)).toContain("UNKNOWN_EVENT_TYPE");
    const weirdType = analyze(json(rest({ transactionType: "PPLsynthType" })));
    expect(weirdType.events[0]).toMatchObject({ stage: "other", eventTypeKnown: false });
    const pair = firstError(
      json(rest({ transactionStatus: "ERROR", gwErrorCode: 5, gwExtendedErrorCode: 0 })),
    );
    expect(pair).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });

  it("shows an asynchronous APM refund as pending", () => {
    const r = analyzeFixture("nuvei/rest-refund-apm-pending.json");
    expect(r.events[0]).toMatchObject({
      stage: "refund",
      outcome: "pending",
      providerStatus: "PENDING",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });
});

describe("nuvei payment DMNs", () => {
  it("normalizes an approved DMN posted as a form", () => {
    const r = analyzeFixture("nuvei/dmn-sale-approved.txt");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "nuvei.payment_dmn",
      eventType: "payment_dmn.Sale",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "APPROVED",
      paymentReference: "PPLsynth1110000000020000001",
      merchantReference: "PPLsynth-order-2001",
      amountMinor: "4725",
      currency: "USD",
      eventTimestamp: "2026-10-20T10:15:00.000Z",
    });
    expect(r.events[0]!.deliveryKey).toContain("PPLsynth1110000000020000001");
    expect(r.events[0]!.attributes).toMatchObject({
      deliveryChannel: "dmn",
      httpMethod: "POST",
      pppStatus: "OK",
      dmnStatus: "APPROVED",
      paymentMethod: "cc_card",
      dmnType: "DEPOSIT",
      checksumLength: 64,
      signatureVerified: false,
      cvv2Reply: "M",
      avsCode: "Y",
    });
    expect(r.errors).toEqual([]);
  });

  it("decodes a declined DMN delivered as a GET query string", () => {
    const r = analyzeFixture("nuvei/dmn-sale-declined-get.txt");
    expect(r.events[0]).toMatchObject({ outcome: "failure", providerStatus: "DECLINED" });
    expect(r.events[0]!.attributes.httpMethod).toBe("GET");
    expect(r.errors[0]).toMatchObject({
      code: "Do not honor",
      category: "card_declined",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: {
        ErrCode: "-1",
        ExErrCode: "0",
        Reason: "Do not honor",
        merchantAdviceCode: "03",
        ppp_status: "FAIL",
      },
      attemptReference: "PPLsynth1110000000020000002",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url).join(" ")).toMatch(/payment-dmns/);
  });

  it("decodes DMN gateway codes with possible confidence", () => {
    const e = firstError(
      dmn({ ppp_status: "FAIL", Status: "ERROR", ErrCode: "-1100", ExErrCode: "1114" }),
    );
    expect(e).toMatchObject({ code: "1114", category: "fraud_or_risk", confidence: "possible" });
    expect(e.missingInformation.join(" ")).toMatch(/inference/);
    const timeout = analyze(
      dmn({ ppp_status: "FAIL", Status: "ERROR", ErrCode: "-1203", ExErrCode: "0" }),
    );
    expect(timeout.events[0]!.outcome).toBe("unknown");
    expect(timeout.errors[0]).toMatchObject({
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
  });

  it("builds one timeline for an APM payment that is pending and then approved", () => {
    const r = analyzeFixture("nuvei/dmn-apm-pending-then-approved.txt");
    expect(r.events.map((e) => [e.outcome, e.providerStatus])).toEqual([
      ["pending", "PENDING"],
      ["success", "APPROVED"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[0]!.deliveryKey).not.toBe(r.events[1]!.deliveryKey);
    expect(r.events[0]!.attributes.paymentMethod).toBe("apmgw_expresscheckout");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("reports a repeated DMN delivery", () => {
    const r = analyzeFixture("nuvei/dmn-duplicate-delivery.txt");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const finding = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(finding.explanation).toMatch(
      /Nuvei documents that it can deliver the same notification more than once/,
    );
    // Without responseTimeStamp no delivery key is invented.
    expect(firstEvent(dmn({ responseTimeStamp: undefined })).deliveryKey).toBeUndefined();
  });

  it("links authorization, settle and refund DMNs by relatedTransactionId", () => {
    const r = analyzeFixture("nuvei/dmn-auth-settle-refund.txt");
    expect(r.events.map((e) => [e.stage, e.outcome, e.amountMinor])).toEqual([
      ["authorization", "success", "10000"],
      ["capture", "success", "10000"],
      ["refund", "success", "4000"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]).toMatchObject({
      paymentReference: "PPLsynth1110000000020000030",
      relatedReference: "PPLsynth1110000000020000031",
    });
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("keeps unrelated transactions apart", () => {
    const text = [
      dmn({ TransactionID: "PPLsynth-trx-a", PPP_TransactionID: "PPLsynth-ppp-a" }),
      dmn({
        TransactionID: "PPLsynth-trx-b",
        PPP_TransactionID: "PPLsynth-ppp-b",
        merchant_unique_id: "PPLsynth-merchant-9001",
      }),
    ].join("\n");
    const r = analyze(text);
    expect(r.events).toHaveLength(2);
    expect(r.groups).toHaveLength(2);
  });

  it("links a REST response and the DMN of the same transaction", () => {
    const r = analyzeSources(
      [
        { name: "response.json", text: json(rest({ transactionId: "PPLsynth-trx-d9001" })) },
        { name: "dmn.txt", text: dmn() },
      ],
      options,
    );
    if (!r.ok) throw new Error("analysis failed");
    expect(r.result.events.map((e) => e.sourceFormat)).toEqual([
      "nuvei.rest_response",
      "nuvei.payment_dmn",
    ]);
    expect(r.result.groups).toHaveLength(1);
    expect(r.result.groups[0]!.references).toContain("trx:PPLsynth-trx-d9001");
  });

  it("reads a DMN pasted as a callback URL", () => {
    const r = analyzeFixture("nuvei/dmn-get-url.txt");
    expect(r.events[0]).toMatchObject({
      outcome: "success",
      paymentReference: "PPLsynth45402",
      amountMinor: "4725",
      eventTypeKnown: true,
      eventType: "payment_dmn",
    });
    expect(r.events[0]!.attributes.transactionTypeSent).toBe(false);
    expect(r.events[0]!.deliveryKey).toBeUndefined();
  });

  it("keeps undocumented status meanings, withdrawals and chargebacks honest", () => {
    const success = analyze(dmn({ Status: "SUCCESS" }));
    expect(success.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(success.events[0]!.attributes.dmnStatusMeaningDocumented).toBe(false);
    expect(ruleIds(success)).toContain("UNKNOWN_EVENT_TYPE");
    expect(firstEvent(dmn({ Status: "UPDATE" })).outcome).toBe("unknown");
    expect(firstEvent(dmn({ type: "WITHDRAWAL", transactionType: "Credit" }))).toMatchObject({
      stage: "payout",
      outcome: "success",
    });
    expect(firstEvent(dmn({ transactionType: "Chargeback" }))).toMatchObject({
      stage: "dispute",
      outcome: "unknown",
    });
    expect(firstEvent(dmn({ transactionType: "Modification" }))).toMatchObject({
      stage: "other",
      eventTypeKnown: false,
    });
    expect(firstEvent(dmn({ type: "KYC" }))).toMatchObject({
      stage: "other",
      outcome: "unknown",
      eventTypeKnown: false,
    });
  });

  it("falls back to ppp_status and marks DMNs without a financial transaction", () => {
    const noStatus = firstEvent(dmn({ Status: undefined, ppp_status: "PENDING" }));
    expect(noStatus).toMatchObject({ outcome: "pending", providerStatus: "PENDING" });
    const noFinancial = analyze(
      dmn({
        ppp_status: "FAIL",
        Status: "DECLINED",
        TransactionID: "",
        ErrCode: "0",
        ExErrCode: "0",
      }),
    );
    expect(noFinancial.events[0]).toMatchObject({
      outcome: "failure",
      paymentReference: "PPLsynth-ppp-9001",
    });
    expect(noFinancial.events[0]!.attributes.financialTransaction).toBe(false);
    expect(noFinancial.errors[0]).toMatchObject({ code: "DECLINED", confidence: "insufficient" });
    const disagree = firstEvent(
      dmn({ ppp_status: "OK", Status: "DECLINED", ErrCode: "-1", Reason: "Decline" }),
    );
    expect(disagree.attributes.statusFieldsDisagree).toBe(true);
  });

  it("reports APM and Nuvei APM error fields without interpreting them", () => {
    const r = analyze(
      dmn({
        ppp_status: "FAIL",
        Status: "DECLINED",
        ErrCode: "-1",
        Reason: "Payment Denied",
        errApmCode: "PPLSYNTH-9",
        errScCode: "PPLSYNTH-10",
        errScDescription: "Synthetic",
      }),
    );
    expect(r.errors.map((e) => [e.code, e.confidence])).toEqual([
      ["Payment Denied", "strong"],
      ["PPLSYNTH-9", "insufficient"],
      ["PPLSYNTH-10", "insufficient"],
    ]);
    const threeDs = analyze(
      dmn({
        ppp_status: "FAIL",
        Status: "DECLINED",
        ErrCode: "-1",
        Reason: "Decline",
        "3DReasonId": "11",
      }),
    );
    expect(threeDs.errors[1]).toMatchObject({ code: "11", category: "fraud_or_risk" });
  });
});

describe("nuvei withdrawal DMNs", () => {
  it("shows a settled withdrawal order as a successful payout", () => {
    const r = analyzeFixture("nuvei/withdrawal-dmn-order-settled.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "withdrawal_dmn",
      stage: "payout",
      outcome: "success",
      providerStatus: "Settled",
      paymentReference: "PPLsynth-wd-3001",
      relatedReference: "PPLsynth-wdo-3001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      wdRequestState: "Closed",
      wdRequestStatus: "Approved",
      outcomeFrom: "wdOrderStatus",
      settlementType: "Withdrawal",
      checksumLength: 64,
      signatureVerified: false,
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("decodes a failed withdrawal order and reports the payout failure", () => {
    const r = analyzeFixture("nuvei/withdrawal-dmn-order-error.txt");
    expect(r.events[0]).toMatchObject({ stage: "payout", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "1267",
      category: "payment_method_unavailable",
      confidence: "possible",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url).join(" ")).toMatch(/withdrawal-dmns/);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("keeps a pending request, a refund settlement and unknown statuses apart", () => {
    const pending = analyzeFixture("nuvei/withdrawal-dmn-request-pending.txt");
    expect(pending.events[0]).toMatchObject({
      stage: "payout",
      outcome: "pending",
      providerStatus: "Pending",
    });
    expect(pending.events[0]!.attributes.notificationType).toBe("WITHDRAW_REQUEST_NOTIFICATION");
    expect(ruleIds(pending)).toContain("PAYOUT_STATUS");
    expect(firstEvent(withdrawal({ wdOrderStatus: "Approved" })).outcome).toBe("pending");
    expect(firstEvent(withdrawal({ settlementType: "Refund" })).stage).toBe("refund");
    const odd = analyze(withdrawal({ wdOrderStatus: "PPLsynthState" }));
    expect(odd.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    const declined = analyze(
      withdrawal({ wdOrderStatus: undefined, wdOrderId: undefined, wdRequestStatus: "Declined" }),
    );
    expect(declined.events[0]!.outcome).toBe("failure");
    expect(declined.errors).toEqual([]);
    const error = analyze(
      withdrawal({ wdOrderStatus: "Error", gwErrCode: "0", gwExtendedErrorCode: "0" }),
    );
    expect(error.errors[0]).toMatchObject({ code: "Error", confidence: "insufficient" });
  });

  it("links a withdrawal DMN to the payment DMN of the same gateway transaction", () => {
    const r = analyze(
      [
        withdrawal({ gwTrxId: "PPLsynth-trx-shared" }),
        dmn({
          type: "WITHDRAWAL",
          transactionType: "Credit",
          TransactionID: "PPLsynth-trx-shared",
        }),
      ].join("\n"),
    );
    expect(r.events.map((e) => e.stage)).toEqual(["payout", "payout"]);
    expect(r.groups).toHaveLength(1);
  });
});

describe("nuvei chargeback event DMNs", () => {
  it("normalizes a chargeback event", () => {
    const r = analyzeFixture("nuvei/event-chargeback.json");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "nuvei.chargeback_dmn",
      eventType: "Chargeback",
      eventTypeKnown: true,
      stage: "dispute",
      outcome: "unknown",
      providerStatus: "Regular",
      eventReference: "PPLsynth-7d3e1c2a-1b4f-4e8a-9c0d-2f6a8b1e3c5d",
      paymentReference: "PPLsynth1110000000020000001",
      merchantReference: "PPLsynth-order-2001",
      amountMinor: "1025",
      currency: "EUR",
      eventTimestamp: "2026-10-24T08:21:23.374Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      disputeType: "Chargeback",
      statusCategory: "Regular",
      chargebackReason: "10.4 - Other Fraud-Card Absent Environment",
      chargebackReasonInterpreted: false,
      reasonCategory: "Fraud",
      attemptNumber: 1,
      signatureVerified: false,
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("reports a chargeback after a successful payment", () => {
    const sale = parseInput(fixture("nuvei/dmn-sale-approved.txt"));
    const cb = parseInput(fixture("nuvei/event-chargeback.json"));
    if (!sale.ok || !cb.ok) throw new Error("parse failed");
    const r = analyzeText(
      json([
        { receivedAt: "2026-10-20T10:15:05Z", payload: sale.value.records[0] },
        { receivedAt: "2026-10-24T08:21:30Z", payload: cb.value.records[0] },
      ]),
      options,
    );
    if (!r.ok) throw new Error("analysis failed");
    // The JSON envelope turns the form DMN into a JSON object with text values.
    expect(r.result.records.map((x) => x.format)).toEqual([
      "nuvei.payment_dmn",
      "nuvei.chargeback_dmn",
    ]);
    expect(r.result.groups).toHaveLength(1);
    const finding = r.result.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED")!;
    expect(finding.title).toBe("Chargeback after a successful payment");
  });

  it("identifies redeliveries by EventId and falls back to EventCorrelationId", () => {
    const r = analyze(json([chargeback(), chargeback({ AttemptNumber: 2 })]));
    expect(r.events[1]!.attributes.redelivery).toBe(true);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
    const noEventId = firstEvent(json(chargeback({ EventId: undefined })));
    expect(noEventId.eventReference).toBe("PPLsynth-correlation-9001");
    expect(noEventId.deliveryKey).toBe("event|PPLsynth-correlation-9001");
  });

  it("does not trust identifiers that lost precision or undocumented values", () => {
    const e = firstEvent(
      json(
        chargeback(
          { TransactionDetails: { TransactionId: 1110000000010304183 } },
          { Type: "PPLsynthType", ChargebackStatusCategory: "PPLsynthCategory" },
        ),
      ),
    );
    expect(e.paymentReference).toBeUndefined();
    expect(e.attributes).toMatchObject({
      transactionIdPrecisionLost: true,
      disputeTypeKnown: false,
      statusCategoryKnown: false,
    });
    expect(
      firstEvent(
        json(chargeback({}, { StatusCategory: "Soft_CB", ChargebackStatusCategory: undefined })),
      ).providerStatus,
    ).toBe("Soft_CB");
  });
});

describe("nuvei sensitive data", () => {
  const PLANTED = [
    "PLANTEDUSERTOKEN",
    "PLANTEDUPO",
    "4****PLANTED",
    "PLANTEDBIN",
    "PLANTEDLAST4",
    "PLANTEDEXPMONTH",
    "PLANTEDEXPYEAR",
    "Planted Holder Name",
    "PLANTEDPAR",
    "PLANTEDACSURL",
    "PLANTEDCREQ",
    "PLANTEDCAVV",
    "PLANTEDDSTRANS",
    "PLANTEDECI",
    "planted.person@example.com",
    "PLANTEDLINKID",
    "PLANTEDAUTHCODE",
    "PLANTEDCUSTOMDATA",
    "PLANTEDSESSIONTOKEN",
    "planted.buyer@example.com",
    "PLANTEDMERCHANTID",
    "PLANTEDMERCHANTSITE",
    "PLANTEDCLIENTREQUEST",
    "PLANTEDUSERID",
    "PLANTEDUSERTOKEN2",
    "PLANTEDCUSTOM2",
    "PLANTEDFIELD1",
    "PlantedFirst",
    "PlantedLast",
    "planted.dmn@example.com",
    "Planted Street",
    "PlantedCity",
    "PLANTEDZIP",
    "PLANTEDPHONE",
    "198.51.100.77",
    "Planted Card Name",
    "PLANTEDPAN",
    "PLANTEDUNIQUECC",
    "planted.payer@example.com",
    "PLANTEDPAYERINFO",
    "PLANTEDACCOUNTDESC",
    "PLANTEDDESCRIPTOR",
    "PLANTEDAUTH2",
    "PLANTEDSITE",
    "PLANTEDMERCHANT2",
    "planted.apm@example.com",
    "c0ffeec0ffeec0ffeec0ffeec0ffeec0",
    "f00dfacef00dfacef00dfacef00dface",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    for (const file of ["sensitive-rest-response.json", "sensitive-dmn.txt"]) {
      const r = analyzeFixture(`nuvei/${file}`);
      expect(r.records[0]!.status).toBe("analyzed");
      expect(r.sensitiveData.detected).toBe(true);
      const events = JSON.stringify(r.events);
      const report = toJsonReport(r);
      for (const value of PLANTED) {
        expect(events, `${file}: ${value}`).not.toContain(value);
        expect(report, `${file}: ${value}`).not.toContain(value);
      }
      expect(r.errors.length).toBeGreaterThan(0);
    }
    const response = analyzeFixture("nuvei/sensitive-rest-response.json");
    // An e-mail address used as clientUniqueId is not copied as a reference.
    expect(response.events[0]!.merchantReference).toBeUndefined();
    expect(response.errors[1]!.providerMessage).toBe("Contact [redacted]");
  });

  it("keeps chargeback card and merchant data out of the output", () => {
    const r = analyzeFixture("nuvei/event-chargeback.json");
    const dump = JSON.stringify(r.events) + toJsonReport(r);
    for (const value of [
      "PPLsynth05295314304000000000456",
      "4***********1111",
      "PPLsynth Test Client",
      "151999723",
      "PPLsynth Demo Bank",
    ]) {
      expect(dump).not.toContain(value);
    }
  });
});

describe("nuvei manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(nuveiAdapter);
    expect(nuveiAdapter.manifest).toBe(nuveiManifest);
    expect(manifestOnly).toBe(nuveiManifest);
    expect(nuveiAdapter.version).toBe(NUVEI_ADAPTER_VERSION);
  });

  it("declares honest metadata and capabilities", () => {
    expect(nuveiManifest).toMatchObject({
      id: "nuvei",
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
    expect([...nuveiManifest.categories].sort()).toEqual([
      "acquiring",
      "alternative_payment_method",
      "card_processing",
      "gateway",
    ]);
    for (const s of nuveiManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(www|docs)\.nuvei\.com\//);
    expect(nuveiManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(
      /adult|nutra|cbd|dating/,
    );
    expect(nuveiManifest.delivery.duplicateKey).toMatch(/EventId/);
    expect(nuveiManifest.delivery.duplicateKey).toMatch(/no delivery id/);
    const limits = nuveiManifest.limitations.join(" ");
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/0\/0/);
    expect(limits).toMatch(/not documented/);
    const families = Object.fromEntries(nuveiManifest.apiFamilies.map((f) => [f.id, f.status]));
    for (const f of nuveiAdapter.supportedFormats) expect(families[f.id]).not.toBe("unsupported");
    expect(families["nuvei.subscription_dmn"]).toBe("unsupported");
  });

  it("contains every documented code, status and event", () => {
    expect(Object.keys(REQUEST_ERROR_CODES)).toHaveLength(175);
    expect(Object.keys(MARKETPLACE_ERROR_CODES)).toHaveLength(12);
    expect(Object.keys(SDK_ERROR_CODE_NAMES)).toHaveLength(29);
    expect(GATEWAY_RESPONSE_ROWS).toHaveLength(9);
    expect(Object.keys(FILTER_ERROR_CODES)).toHaveLength(230);
    expect(Object.keys(DUPLICATED_FILTER_CODES).sort()).toEqual(["1158", "1159", "1160", "1167"]);
    const filterRows =
      Object.keys(FILTER_ERROR_CODES).length +
      Object.values(DUPLICATED_FILTER_CODES).reduce((n, l) => n + l.length, 0);
    expect(filterRows).toBe(238);
    expect(Object.keys(DECLINE_REASONS)).toHaveLength(180);
    expect(Object.keys(THREE_DS_REASONS)).toHaveLength(34);
    expect(Object.keys(MERCHANT_ADVICE_CODES)).toHaveLength(16);
    expect(Object.keys(CVV2_REPLIES)).toHaveLength(5);
    expect(Object.keys(AVS_CODES)).toHaveLength(10);
    expect(Object.keys(THREE_DS_RESULTS)).toHaveLength(7);
    expect(Object.keys(API_STATUSES)).toEqual(["SUCCESS", "ERROR", "PENDING"]);
    expect(Object.keys(TRANSACTION_STATUSES)).toHaveLength(5);
    expect(Object.keys(DMN_STATUSES)).toHaveLength(6);
    expect(Object.keys(PPP_STATUSES)).toEqual(["OK", "FAIL", "PENDING"]);
    expect(Object.keys(TRANSACTION_TYPES)).toHaveLength(15);
    expect(Object.keys(WD_REQUEST_STATUSES)).toHaveLength(8);
    expect(Object.keys(WD_ORDER_STATUSES)).toHaveLength(9);
    expect(EVENT_TYPES.size).toBe(18);
    // Request and filter tables share numbers with different meanings.
    expect(REQUEST_ERROR_CODES["1001"]!.meaning).not.toBe(FILTER_ERROR_CODES["1001"]!.meaning);
    // Marketplace and request codes do not overlap.
    for (const k of Object.keys(MARKETPLACE_ERROR_CODES))
      expect(REQUEST_ERROR_CODES[k]).toBeUndefined();
    expect(REQUEST_ERROR_CODES["9131"]!.note).toMatch(/Apple Pay/);
  });

  it("gives near-duplicate decline reasons the same meaning", () => {
    const byNormalized = new Map<string, string>();
    for (const [k, v] of Object.entries(DECLINE_REASONS)) {
      const n = k.trim().replace(/\.$/, "").toLowerCase();
      const value = `${v.category}/${v.retry}`;
      if (byNormalized.has(n)) expect(byNormalized.get(n), k).toBe(value);
      else byNormalized.set(n, value);
    }
  });

  it("uses no en or em dashes in published text, sources or fixtures", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const text = JSON.stringify([
      nuveiManifest,
      REQUEST_ERROR_CODES,
      MARKETPLACE_ERROR_CODES,
      SDK_ERROR_CODE_NAMES,
      FILTER_ERROR_CODES,
      DUPLICATED_FILTER_CODES,
      DECLINE_REASONS,
      THREE_DS_REASONS,
      MERCHANT_ADVICE_CODES,
    ]);
    expect(text).not.toMatch(dashes);
    const pkg = fileURLToPath(new URL("../", import.meta.url));
    const fixtures = fileURLToPath(new URL("../../../../fixtures/nuvei/", import.meta.url));
    for (const file of ["src/index.ts", "src/catalog.ts", "src/manifest.ts", "tests/nuvei.test.ts"])
      expect(readFileSync(`${pkg}${file}`, "utf8"), file).not.toMatch(dashes);
    for (const file of readdirSync(fixtures)) {
      const content = readFileSync(`${fixtures}${file}`, "utf8");
      expect(content, file).not.toMatch(dashes);
      expect(content, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});
