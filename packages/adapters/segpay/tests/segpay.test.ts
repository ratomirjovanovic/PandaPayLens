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
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  CONVERSION_ERRORS,
  decodeAuthcode,
  decodeSegpayCode,
  FRAUD_CODES,
  GATEWAY_APPROVALS,
  GATEWAY_EVENT_CODES,
  GATEWAY_RESPONSE_CODES,
  MPI_ERRORS,
  SUB_EVENT_TYPES,
  TRANSACTION_MATRIX,
  segpayAdapter,
  segpayManifest,
} from "@pandapaylens/segpay";

const options: AnalyzeOptions = {
  adapters: [segpayAdapter],
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

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId);

const transaction = (fields: Record<string, string> = {}) =>
  form({
    trantype: "Sale",
    action: "Auth",
    stage: "Initial",
    approved: "Yes",
    price: "9.95",
    currencycode: "USD",
    eticketid: "200001:30001",
    standin: "0",
    xsellnum: "0",
    cardtype: "Visa",
    transtime: "10/06/2026 8:00:00 AM (GMT STANDARD TIME)",
    tranid: "PPLsynth100000100",
    purchaseid: "PPLsynth900000100",
    urlid: "1000001",
    ...fields,
  });

const gateway = (fields: Record<string, string> = {}) =>
  form({
    EventCode: "!",
    SubEventTypeID: "100",
    OriginalEventCode: "S",
    OriginalTransactionID: "0",
    RefundTransactionID: "0",
    TransactionID: "PPLsynth5000000100",
    SubscriberID: "PPLsynth445000100",
    ProductCode: "20001-70001-100",
    SiteID: "70001",
    Amount: "5.00",
    CurrencyCode: "USD",
    Timestamp: "2026-10-15 09:00:00",
    ...fields,
  });

const member = (fields: Record<string, string> = {}) =>
  form({
    action: "Cancel",
    purchaseid: "PPLsynth900000100",
    urlid: "1000001",
    username: "planted_user",
    ...fields,
  });

function detectText(text: string) {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error("parse failed");
  return segpayAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
}

describe("segpay detection", () => {
  it.each([
    ["segpay/processing-signup-approved.txt", "segpay.processing.transaction", 0.98, true],
    ["segpay/processing-rebill-declined.txt", "segpay.processing.transaction", 0.98, true],
    ["segpay/member-cancel.txt", "segpay.processing.member", 0.85, true],
    ["segpay/paypal-dispute.txt", "segpay.processing.paypal_dispute", 0.9, true],
    ["segpay/gateway-notification-sale.txt", "segpay.gateway.notification", 0.98, true],
    ["segpay/custom-postback.txt", "segpay.processing.custom_postback", 0.55, false],
  ])("detects %s", (path, format, confidence, supported) => {
    expect(detectText(fixture(path))).toMatchObject({ format, confidence, supported });
  });

  it("accepts the same fields pasted as a flat JSON object", () => {
    const fields = Object.fromEntries(new URLSearchParams(transaction()));
    const r = analyze(JSON.stringify(fields));
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "segpay.processing.transaction",
    });
  });

  it("does not claim generic shapes", () => {
    const d = (o: unknown) => segpayAdapter.detect(o, { format: "form" }).confidence;
    expect(d({ status: "Initial" })).toBe(0);
    expect(d({ error: "x" })).toBe(0);
    expect(d({ action: "Cancel" })).toBe(0);
    expect(d({ approved: "Yes", price: "1.00", currencycode: "USD", action: "Auth" })).toBe(0);
    expect(d({ trantype: "Sale", approved: "Yes" })).toBe(0);
    expect(d({ name: "segpay", provider: "Segpay", message: "segpay purchaseid" })).toBe(0);
    // Event code and TransactionID alone stay below the threshold.
    expect(d({ EventCode: "S", TransactionID: "1" })).toBeLessThan(0.5);
    // A PayPal dispute without Segpay identifiers is not claimed.
    expect(
      d({ disputeid: "PP-R-1", action: "DisputeCreated", disputestage: "Inquiry" }),
    ).toBeLessThan(0.5);
    // Nested objects are never a Segpay postback.
    expect(d({ purchaseid: "1", trantype: "Sale", stage: "Initial", data: { a: 1 } })).toBe(0);
    expect(d("purchaseid=1")).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
  });

  it("returns confidence 0 for every Stripe, Adyen and payabl fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen", "payabl"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(segpayAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined) expect(segpayAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe("segpay Processing transaction postbacks", () => {
  it("normalizes an approved signup from a full postback URL", () => {
    const r = analyze(fixture("segpay/processing-signup-approved.txt"));
    expect(r.records[0]?.status).toBe("analyzed");
    expect(r.errors).toHaveLength(0);
    expect(r.events[0]).toMatchObject({
      provider: "segpay",
      eventType: "transaction.Sale.Auth.Initial",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      isRecurring: false,
      paymentReference: "PPLsynth100000001",
      subscriptionReference: "PPLsynth900000001",
      amountMinor: "1995",
      currency: "USD",
      eventTimestamp: "2026-10-01T20:35:45.000Z",
      deliveryKey: "trans|PPLsynth100000001|Sale|Auth|Initial|Yes",
      attributes: {
        matrixResult: "Approved signup",
        eticketid: "200001:30001",
        cardtype: "Visa",
        authprice: "19.95",
      },
    });
    expect(r.events[0]?.relatedReference).toBeUndefined();
  });

  it("maps the transaction matrix to stages without merging operations", () => {
    const cases: [Record<string, string>, string, string, boolean | undefined][] = [
      [{ stage: "Rebill" }, "payment", "success", true],
      [{ stage: "Conversion", approved: "No" }, "payment", "failure", true],
      [{ stage: "INSTANTCONVERSION" }, "payment", "success", false],
      [{ stage: "Instant Conversion", approved: "No" }, "payment", "failure", false],
      [{ action: "Void", stage: "Rebill" }, "void", "success", undefined],
      [{ trantype: "Credit" }, "refund", "success", undefined],
      [{ trantype: "Charge" }, "dispute", "unknown", undefined],
      [{ trantype: "CB Reversal" }, "dispute", "unknown", undefined],
      [{ trantype: "RDRreversal" }, "refund", "success", undefined],
      [{ trantype: "Revoke" }, "reversal", "success", undefined],
    ];
    for (const [fields, stage, outcome, recurring] of cases) {
      const e = analyze(transaction(fields)).events[0]!;
      expect(e, JSON.stringify(fields)).toMatchObject({ stage, outcome, eventTypeKnown: true });
      expect(e.isRecurring, JSON.stringify(fields)).toBe(recurring);
    }
  });

  it("keeps undocumented combinations unknown", () => {
    const e = analyze(transaction({ trantype: "Credit", stage: "Rebill", approved: "Maybe" }))
      .events[0]!;
    expect(e).toMatchObject({ eventTypeKnown: false, stage: "refund", outcome: "unknown" });
    expect(e.deliveryKey).toBeUndefined();
    // Without action a sale and a void cannot be told apart.
    const noAction = analyze(transaction({ action: "" })).events[0]!;
    expect(noAction).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
  });

  it("decodes a declined rebill with Segpay's Visa category guidance", () => {
    const r = analyze(fixture("segpay/processing-rebill-declined.txt"));
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure", isRecurring: true });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "51",
      category: "card_declined",
      retry: "retry_conditionally",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "PPLsynth900000001",
      attemptReference: "PPLsynth100000003",
      subCodes: {
        field: "authcode",
        family: "visa_category",
        visaCategory: "2",
        decline_code: "51",
      },
    });
    expect(r.errors[0]?.retryExplanation).toContain("15 reattempts in 30 days");
  });

  it("decodes a fraud code without exposing the blocked email", () => {
    const r = analyze(fixture("segpay/processing-signup-fraud-decline.txt"));
    expect(r.errors[0]).toMatchObject({
      code: "F460",
      category: "fraud_or_risk",
      retry: "manual_review",
      confidence: "strong",
      subCodes: { family: "fraud" },
    });
    const text = JSON.stringify(r);
    expect(text).not.toContain("planted.fraud");
    expect(text).not.toContain("Period1");
  });

  it("decodes Instant Conversion errors and Mastercard buckets", () => {
    const ic = analyze(
      transaction({ stage: "Instantconversion", approved: "No", authcode: "ERR304" }),
    );
    expect(ic.errors[0]).toMatchObject({
      code: "ERR304",
      category: "duplicate_request",
      retry: "do_not_retry",
    });
    const mc = analyze(transaction({ approved: "No", cardtype: "MasterCard", authcode: "63" }));
    expect(mc.errors[0]).toMatchObject({
      code: "63",
      category: "fraud_or_risk",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { mastercardBucket: "83" },
    });
    const otherBrand = analyze(
      transaction({ approved: "No", cardtype: "Discover", authcode: "05" }),
    );
    expect(otherBrand.errors[0]).toMatchObject({
      code: "05",
      confidence: "insufficient",
      category: "unknown",
    });
  });

  it("reports undecodable authcodes honestly and never echoes them", () => {
    const r = analyze(
      transaction({ approved: "No", authcode: "Blocked planted.authcode@example.com by rule 7" }),
    );
    expect(r.errors[0]).toMatchObject({
      code: "Blocked",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(JSON.stringify(r)).not.toContain("planted.authcode");
    const missing = analyze(transaction({ approved: "No" }));
    expect(missing.errors[0]).toMatchObject({ code: "authcode", confidence: "insufficient" });
    expect(missing.errors[0]?.missingInformation.join(" ")).toContain("no authcode");
  });

  it("does not decode approvals or treat crypto cancels as one payment", () => {
    expect(analyze(fixture("segpay/processing-rebill-approved.txt")).errors).toHaveLength(0);
    const cancel = (p: string) =>
      transaction({
        approved: "No",
        tranid: "SPDECLINE",
        authcode: "SPXXXX: Transaction Cancelled by Consumer",
        purchaseid: p,
        cardtype: "crypto",
      });
    const r = analyze(`${cancel("PPLsynth900000201")}\n${cancel("PPLsynth900000202")}`);
    expect(r.events.every((e) => e.paymentReference === undefined && e.outcome === "failure")).toBe(
      true,
    );
    expect(r.events[0]?.attributes.cryptoConsumerCancel).toBe(true);
    expect(r.errors[0]).toMatchObject({ code: "SPDECLINE", subCodes: { family: "crypto" } });
    expect(r.groups).toHaveLength(2);
  });
});

describe("segpay Stand-In and duplicates", () => {
  it("never treats a Stand-In decline as a repeat of the temporary approval", () => {
    const r = analyze(fixture("segpay/processing-stand-in.txt"));
    expect(r.events).toHaveLength(2);
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "failure"]);
    expect(r.events[0]?.attributes.standInTemporaryApproval).toBe(true);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(r.events[0]?.paymentReference).toBe(r.events[1]?.paymentReference);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(ruleIds(r)).not.toContain("CONFLICTING_OBSERVATIONS");
    expect(r.groups).toHaveLength(1);
    expect(r.errors[0]?.missingInformation.join(" ")).toContain("Stand-In");
  });

  it("reports a retried transaction postback as a duplicate delivery", () => {
    const refund = fixture("segpay/processing-refund.txt");
    const r = analyzeMany(refund, refund);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]?.deliveryKey).toBe(r.events[1]?.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup?.evidenceEventIds).toHaveLength(2);
  });

  it("does not key different results of one transaction alike", () => {
    const a = analyze(transaction()).events[0]!;
    const b = analyze(transaction({ action: "Void" })).events[0]!;
    expect(a.deliveryKey).not.toBe(b.deliveryKey);
  });

  it("reports a retried Gateway notification as a duplicate delivery", () => {
    const sale = fixture("segpay/gateway-notification-sale.txt");
    expect(ruleIds(analyzeMany(sale, sale))).toContain("DUPLICATE_DELIVERY");
  });
});

describe("segpay member management and disputes", () => {
  it("maps member management postbacks to the subscription stage", () => {
    const r = analyze(fixture("segpay/member-cancel.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "member.Cancel",
      eventTypeKnown: true,
      stage: "subscription",
      outcome: "success",
      subscriptionReference: "PPLsynth900000001",
      attributes: { postback: "Cancellation", cancelreasoncode: "PPLsynthC1" },
    });
    const outcomes = ["Probe", "Enable", "Disable", "Reactivation"].map(
      (action) => analyze(member({ action })).events[0]!,
    );
    expect(outcomes.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["member.Probe", "subscription", "pending"],
      ["member.Enable", "subscription", "success"],
      ["member.Disable", "subscription", "success"],
      ["member.Reactivation", "subscription", "success"],
    ]);
    expect(outcomes.every((e) => e.deliveryKey === undefined)).toBe(true);
  });

  it("normalizes a PayPal dispute postback", () => {
    const r = analyze(fixture("segpay/paypal-dispute.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "paypal_dispute.DisputeNeedsResponse",
      eventTypeKnown: true,
      stage: "dispute",
      outcome: "unknown",
      paymentReference: "PPLsynth100000030",
      subscriptionReference: "PPLsynth900000030",
      eventTimestamp: "2026-12-11T14:56:14.000Z",
      attributes: {
        disputeid: "PP-R-PPLSYNTH-0001",
        disputeStage: "Inquiry",
        disputeChannel: "Internal",
        currentStatus: "WaitingForSellerResponse",
        disputeReason: "MerchandiseOrServiceNotAsDescribed",
        transamount: "1.07",
      },
    });
    expect(r.events[0]?.deliveryKey).toBeUndefined();
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });
});

describe("segpay Gateway Event Notifications", () => {
  it("normalizes a documented sale notification", () => {
    const r = analyze(fixture("segpay/gateway-notification-sale.txt"));
    expect(r.events[0]).toMatchObject({
      sourceFormat: "segpay.gateway.notification",
      eventType: "gateway.Single Sale or Settlement",
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth5000000001",
      subscriptionReference: "PPLsynth445000001",
      eventTimestamp: "2026-10-12T14:52:43.000Z",
      deliveryKey: "gw|PPLsynth5000000001|S",
      attributes: {
        eventCode: "S",
        subEventTypeId: "100",
        productClass: "SNGL",
        cardType: "M",
        originalEventCode: "?",
        amount: "1.00",
      },
    });
    expect(r.events[0]?.amountMinor).toBeUndefined();
    expect(r.events[0]?.relatedReference).toBeUndefined();
    expect(r.errors).toHaveLength(0);
  });

  it("decodes a declined rebill from ResponseCode", () => {
    const r = analyze(fixture("segpay/gateway-rebill-declined.txt"));
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      isRecurring: true,
      amountMinor: "2995",
      currency: "USD",
    });
    expect(r.errors[0]).toMatchObject({
      code: "320",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      outcomeKnown: true,
      subCodes: { field: "ResponseCode", family: "gateway_response" },
    });
    expect(ruleIds(r)).toContain("RECURRING_PAYMENT_FAILED");
  });

  it("does not present a timeout as a known outcome or a safe retry", () => {
    const r = analyze(fixture("segpay/gateway-timeout.txt"));
    expect(r.events[0]?.outcome).toBe("unknown");
    expect(r.errors[0]).toMatchObject({
      code: "804",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      providerMessage: "Transaction timeout",
    });
    expect(r.errors[0]?.outcomeKnown).toBeUndefined();
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes validation, authentication and 3DS errors", () => {
    const decode = (code: string) => analyze(gateway({ ResponseCode: code })).errors[0]!;
    expect(decode("368")).toMatchObject({ category: "invalid_request", retry: "do_not_retry" });
    expect(decode("217")).toMatchObject({ category: "authentication_failed" });
    const sca = decode("3009");
    expect(sca).toMatchObject({
      category: "authentication_required",
      retry: "customer_action_required",
    });
    expect(sca.retryExplanation).toContain("forceAuthentication()");
    expect(decode("2001")).toMatchObject({ category: "unknown", retry: "manual_review" });
  });

  it("reports unknown response codes with insufficient confidence", () => {
    const r = analyze(gateway({ ResponseCode: "9999" }));
    expect(r.errors[0]).toMatchObject({
      code: "9999",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const noCode = analyze(gateway());
    expect(noCode.errors[0]).toMatchObject({ code: "EventCode=!", confidence: "insufficient" });
  });

  it("maps event codes to lifecycle stages", () => {
    const cases: [string, string, string][] = [
      ["A", "authorization", "success"],
      ["C", "refund", "success"],
      ["H", "refund", "pending"],
      ["F", "refund", "failure"],
      ["V", "void", "success"],
      ["X", "dispute", "unknown"],
      ["1", "dispute", "unknown"],
      ["Z", "other", "unknown"],
      ["M", "subscription", "success"],
      ["E", "subscription", "success"],
      ["@", "authorization", "pending"],
      ["?", "other", "unknown"],
    ];
    for (const [code, stage, outcome] of cases) {
      const e = analyze(gateway({ EventCode: code })).events[0]!;
      expect(e, code).toMatchObject({ stage, outcome, eventTypeKnown: true });
    }
    // An approval code on a rebill is a success; a sale with a decline code contradicts itself.
    expect(analyze(gateway({ EventCode: "R", ResponseCode: "100" })).events[0]?.outcome).toBe(
      "success",
    );
    const conflict = analyze(gateway({ EventCode: "S", ResponseCode: "304" })).events[0]!;
    expect(conflict).toMatchObject({
      outcome: "unknown",
      attributes: { responseCodeConflict: true },
    });
  });

  it("treats the signed pay page session-expired notice as an abandoned payment", () => {
    const r = analyze(
      form({
        TransactionID: "jwt-PPLsynth-jti-1",
        ResponseCode: "804",
        ResponseCodeDescription: "Transaction timeout",
      }),
    );
    expect(r.events[0]).toMatchObject({ eventType: "gateway.session_expired", outcome: "failure" });
    expect(r.events[0]?.paymentReference).toBeUndefined();
    expect(r.errors[0]).toMatchObject({ code: "804", confidence: "possible", outcomeKnown: true });
  });
});

describe("segpay correlation and timeline", () => {
  it("groups one subscription's signup, rebills, refund, chargeback and cancellation", () => {
    const r = analyzeMany(
      fixture("segpay/processing-chargeback.txt"),
      fixture("segpay/processing-signup-approved.txt"),
      fixture("segpay/processing-rebill-approved.txt"),
      fixture("segpay/processing-rebill-declined.txt"),
      fixture("segpay/processing-refund.txt"),
      fixture("segpay/member-cancel.txt"),
      fixture("segpay/processing-signup-fraud-decline.txt"),
      fixture("segpay/gateway-notification-sale.txt"),
    );
    expect(r.events).toHaveLength(8);
    const group = r.groups.find((g) => g.references.includes("purchase:PPLsynth900000001"))!;
    expect(group.eventIds).toHaveLength(6);
    expect(group.references).toEqual(
      expect.arrayContaining(["tran:PPLsynth100000001", "tran:PPLsynth100000002"]),
    );
    // Unrelated purchases and the other product stay apart.
    expect(r.groups).toHaveLength(3);
    // Timestamped events come in time order regardless of input order.
    const timed = r.events.filter((e) => e.eventTimestamp).map((e) => e.eventTimestamp!);
    expect([...timed].sort()).toEqual(timed);
    expect(ruleIds(r)).toEqual(
      expect.arrayContaining(["RECURRING_PAYMENT_FAILED", "CHARGEBACK_REPORTED"]),
    );
  });

  it("links Gateway credits to the original transaction and subscriber", () => {
    const sale = gateway({
      EventCode: "I",
      SubEventTypeID: "200",
      TransactionID: "PPLsynth5000000200",
      SubscriberID: "PPLsynth445000200",
    });
    const credit = gateway({
      EventCode: "C",
      SubEventTypeID: "210",
      TransactionID: "PPLsynth5000000201",
      OriginalTransactionID: "PPLsynth5000000200",
      SubscriberID: "PPLsynth445000299",
    });
    const other = gateway({
      EventCode: "S",
      TransactionID: "PPLsynth5000000300",
      SubscriberID: "PPLsynth445000300",
    });
    const r = analyze(`${sale}\n${credit}\n${other}`);
    expect(r.groups).toHaveLength(2);
    expect(r.events.find((e) => e.attributes.eventCode === "C")?.relatedReference).toBe(
      "PPLsynth5000000200",
    );
  });

  it("does not mix Processing and Gateway identifiers", () => {
    const p = transaction({ tranid: "PPLsynthSAME1", purchaseid: "PPLsynthP1" });
    const g = gateway({ TransactionID: "PPLsynthSAME1", SubscriberID: "PPLsynthS1" });
    expect(analyzeMany(p, g).groups).toHaveLength(2);
  });
});

describe("segpay invalid and unsupported input", () => {
  it("reports missing required fields as parse issues", () => {
    const r = analyze(
      form({ trantype: "Sale", stage: "Initial", eticketid: "200001:30001", approved: "Yes" }),
    );
    expect(r.records[0]).toMatchObject({
      status: "invalid",
      format: "segpay.processing.transaction",
    });
    expect(r.records[0]?.reasons.join(" ")).toContain("purchaseid");
    expect(r.warnings.some((w) => w.code === "INVALID_RECORD")).toBe(true);
  });

  it("reports repeated keys as parse issues", () => {
    const r = analyze(`${transaction()}&approved=No`);
    expect(r.records[0]?.status).toBe("invalid");
    expect(r.records[0]?.reasons.join(" ")).toContain("approved: repeated key");
  });

  it("recognizes a custom postback but does not analyze it", () => {
    const r = analyze(fixture("segpay/custom-postback.txt"));
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "segpay.processing.custom_postback",
    });
    expect(r.events).toHaveLength(0);
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")?.message).toContain("renamed");
  });

  it("fails cleanly on malformed input and XML", () => {
    expect(analyzeText("{not json", options).ok).toBe(false);
    expect(
      analyzeText('<data><authresponse EventCode="S" ResponseCode="100"/></data>', options).ok,
    ).toBe(false);
    const r = analyze(
      JSON.stringify({ purchaseid: "PPLsynth1", trantype: "Sale", stage: { x: 1 } }),
    );
    expect(r.records[0]?.status).toBe("unsupported");
  });
});

describe("segpay code decoding", () => {
  it("has the documented number of codes", () => {
    const gateway = Object.keys(GATEWAY_RESPONSE_CODES);
    const approvals = Object.keys(GATEWAY_APPROVALS);
    expect(gateway.filter((c) => approvals.includes(c))).toEqual([]);
    expect(gateway.length + approvals.length).toBe(294);
    expect(Object.keys(GATEWAY_EVENT_CODES)).toHaveLength(21);
    expect(Object.keys(SUB_EVENT_TYPES)).toHaveLength(34);
    expect(Object.keys(FRAUD_CODES)).toHaveLength(32);
    expect(Object.keys(CONVERSION_ERRORS)).toHaveLength(10);
    expect(Object.keys(TRANSACTION_MATRIX)).toHaveLength(14);
    expect(Object.keys(MPI_ERRORS)).toHaveLength(10);
  });

  it("decodes across tables and never through the object prototype", () => {
    expect(decodeSegpayCode("ChallengeIncomplete")).toMatchObject({ family: "mpi" });
    expect(decodeSegpayCode("v3005")).toMatchObject({ family: "fraud", code: "V3005" });
    expect(decodeSegpayCode("R1", "Visa")).toMatchObject({
      family: "visa_category",
      entry: { retry: "do_not_retry" },
    });
    expect(decodeSegpayCode("14", "MasterCard")).toMatchObject({
      family: "mastercard_bucket",
      subCodes: { mastercardBucket: "79" },
    });
    for (const key of ["constructor", "toString", "__proto__"]) {
      expect(decodeSegpayCode(key).family).toBeNull();
      expect(decodeAuthcode(key).family).toBeNull();
    }
    expect(decodeAuthcode("00-Approved CVV:M", "Visa").family).toBeNull();
  });
});

describe("segpay redaction", () => {
  const planted = [
    "411111",
    "4242",
    "PPLsynth-acct-0001",
    "PPLsynth-guid-0001",
    "planted.holder@example.com",
    "planted.buyer@example.com",
    "planted.gateway@example.com",
    "203.0.113.77",
    "198.51.100.23",
    "Planted Holder",
    "Planted Buyer",
    "planted_user",
    "planted_site_user",
    "PlantedSitePass",
    "Planted refund comment",
    "Planted cancel comment",
    "Planted Admin",
    "Planted Consumer",
    "1 Planted Street",
    "PPLsynth-user1",
    "PPLsynthPlantedPassword",
  ];

  it("keeps card, customer and secret data out of events and reports", () => {
    const r = analyzeMany(
      fixture("segpay/processing-signup-approved.txt"),
      fixture("segpay/processing-refund.txt"),
      fixture("segpay/member-cancel.txt"),
      fixture("segpay/paypal-dispute.txt"),
      fixture("segpay/gateway-notification-sale.txt"),
      transaction({
        extrapassword: "PPLsynthPlantedPassword",
        approved: "No",
        authcode: "F451:Card:4242",
      }),
    );
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

describe("segpay manifest", () => {
  it("is honest about limited capabilities", () => {
    expect(segpayManifest).toMatchObject({
      id: "segpay",
      wave: "HR-1",
      researchStatus: "tested",
      documentationAccess: "partial",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.any(Array),
    });
    expect(segpayManifest.capabilities).toEqual({
      errorDecoding: "limited",
      paymentResponses: "unsupported",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "supported",
      diagnosticRules: "limited",
    });
    expect(segpayManifest.sectors).toHaveLength(8);
    for (const s of segpayManifest.sectors) expect(s.source).toMatch(/^https:\/\/segpay\.com\//);
    expect(segpayManifest.sectors.map((s) => s.sector).join(" ")).not.toMatch(/\bgambling\b(?!\))/);
    expect(segpayManifest.delivery.ordering).toBe("not_documented");
    const text = JSON.stringify(segpayManifest);
    for (const dash of [0x2013, 0x2014]) expect(text).not.toContain(String.fromCharCode(dash));
  });
});
