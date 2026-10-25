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
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules } from "@pandapaylens/rules";
import emerchantpayDefault, {
  CRYPTOGRAM_RESULTS,
  CVV_RESULTS,
  decodeGatewayCode,
  decodeSchemeCode,
  describeAvs,
  describeRecurringAdvice,
  describeThreedsReason,
  DISPUTE_EVENTS,
  EMERCHANTPAY_ADAPTER_VERSION,
  emerchantpayAdapter,
  emerchantpayManifest,
  GATEWAY_CODES,
  RECURRING_ADVICE,
  SCHEME_CODES,
  SDK_GATEWAY_CODES,
  SDK_SCHEME_CODES,
  THREEDS_REASONS,
  TRANSACTION_STATES,
  TRANSACTION_TYPES,
  WPF_STATES,
} from "@pandapaylens/emerchantpay";

const options: AnalyzeOptions = {
  adapters: [emerchantpayAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturePath = (p: string) =>
  fileURLToPath(new URL(`../../../../fixtures/${p}`, import.meta.url));
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");
const emp = (name: string) => fixture(`emerchantpay/${name}`);

function analyze(text: string, opts: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...opts });
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
const json = (o: unknown) => JSON.stringify(o);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const SIG = "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d";

const notification = (fields: Record<string, string> = {}) =>
  form({
    transaction_id: "PPLsynth-order-9001",
    terminal_token: "PPLsynthTERMINALTOKEN0009",
    unique_id: "PPLsynth-uid-9001",
    transaction_type: "sale",
    status: "approved",
    amount: "1000",
    signature: SIG,
    ...fields,
  });

const response = (fields: Record<string, unknown> = {}) =>
  json({
    transaction_type: "sale",
    status: "approved",
    mode: "test",
    transaction_id: "PPLsynth-order-9101",
    unique_id: "PPLsynth-uid-9101",
    timestamp: "2026-10-20T09:00:00Z",
    amount: "1000",
    currency: "EUR",
    sent_to_acquirer: "true",
    ...fields,
  });

// ---------------------------------------------------------------------------

describe("emerchantpay detection", () => {
  it.each([
    ["apm-external-event.txt", "emerchantpay.apm_external_event", false],
    ["notification-authorize3d-declined.txt", "emerchantpay.notification", true],
    ["notification-callback-url.txt", "emerchantpay.notification", true],
    ["notification-chargeback.txt", "emerchantpay.notification", true],
    ["notification-duplicate.txt", "emerchantpay.notification", true],
    ["notification-error-issuer-timeout.txt", "emerchantpay.notification", true],
    ["notification-http.txt", "emerchantpay.notification", true],
    ["notification-init-recurring-approved.txt", "emerchantpay.notification", true],
    ["notification-payout-approved.txt", "emerchantpay.notification", true],
    ["notification-recurring-sale-declined.txt", "emerchantpay.notification", true],
    ["notification-refund-approved.txt", "emerchantpay.notification", true],
    ["notification-retrieval-request.txt", "emerchantpay.notification", true],
    ["notification-sale-approved.txt", "emerchantpay.notification", true],
    ["notification-sale-insufficient-funds.txt", "emerchantpay.notification", true],
    ["response-error-validation.json", "emerchantpay.payment_response.object", true],
    ["response-login-failed.json", "emerchantpay.payment_response.object", true],
    ["response-pending-async.json", "emerchantpay.payment_response.object", true],
    ["response-sale-approved.json", "emerchantpay.payment_response.object", true],
    ["response-wrapped-declined.json", "emerchantpay.payment_response.object", true],
    ["response-xml-authorize-declined.xml", "emerchantpay.payment_response.xml", true],
    ["response-xml-error-validation.xml", "emerchantpay.payment_response.xml", true],
    ["response-xml-http.txt", "emerchantpay.payment_response.xml", true],
    ["response-xml-sale-approved.xml", "emerchantpay.payment_response.xml", true],
    ["response-xml-string.json", "emerchantpay.xml", false],
    ["wpf-notification-approved.txt", "emerchantpay.wpf.notification", true],
  ] as const)("detects %s", (name, format, supported) => {
    const parsed = parseInput(emp(name));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    parsed.value.records.forEach((record, i) => {
      const d = emerchantpayAdapter.detect(record, parsed.value.meta[i]);
      expect(d).toMatchObject({ format, supported });
      expect(d.confidence).toBeGreaterThanOrEqual(0.7);
      expect(d.confidence).toBeLessThanOrEqual(0.98);
    });
  });

  it("covers every fixture", () => {
    expect(readdirSync(fixturePath("emerchantpay"))).toHaveLength(25);
  });

  it("does not claim generic shapes or provider names", () => {
    const d = (o: unknown, meta?: RecordMeta) => emerchantpayAdapter.detect(o, meta).confidence;
    const formMeta: RecordMeta = { format: "form" };
    const jsonMeta: RecordMeta = { format: "json" };
    expect(d({ status: "approved" }, formMeta)).toBe(0);
    expect(d({ status: "approved" }, jsonMeta)).toBe(0);
    expect(d({ error: "x" }, jsonMeta)).toBe(0);
    expect(d({ error: { code: 340, message: "emerchantpay" } }, jsonMeta)).toBe(0);
    expect(d({ provider: "emerchantpay", gateway: "Genesis", host: "gate.emerchantpay.net" })).toBe(
      0,
    );
    expect(d({ unique_id: "x", status: "approved" }, formMeta)).toBe(0);
    expect(d({ code: "340", message: "x", status: "error" }, jsonMeta)).toBe(0);
    expect(d({ notification_type: "wpf" }, formMeta)).toBe(0);
    expect(d("emerchantpay")).toBe(0);
    expect(d("<response><status>ok</status></response>")).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
  });

  it("keeps a bare unique_id, transaction_type and status set below the threshold", () => {
    const fields = { unique_id: "PPLsynth-u1", transaction_type: "sale", status: "approved" };
    const det = emerchantpayAdapter.detect(fields, { format: "form" });
    expect(det.confidence).toBeLessThan(0.5);
    expect(det.unsupportedReason).toMatch(/neither terminal_token nor signature/);
    const r = analyze(form(fields));
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.events).toEqual([]);
    // A manual provider selection still analyzes it.
    const forced = analyze(form(fields), { provider: "emerchantpay" });
    expect(forced.records[0]!.status).toBe("analyzed");
    expect(forced.events[0]).toMatchObject({ stage: "payment", outcome: "success" });
  });

  it("keeps a JSON object without mode or sent_to_acquirer below the threshold", () => {
    const det = emerchantpayAdapter.detect(
      { transaction_type: "sale", status: "approved", unique_id: "PPLsynth-u2" },
      { format: "json" },
    );
    expect(det.confidence).toBeLessThan(0.5);
  });

  it("does not read notifications from JSON or responses from form data", () => {
    const fields = {
      unique_id: "PPLsynth-u3",
      transaction_type: "sale",
      status: "approved",
      terminal_token: "PPLsynthTT",
      signature: SIG,
    };
    expect(emerchantpayAdapter.detect(fields, { format: "json" }).confidence).toBeLessThan(0.5);
    const asForm = emerchantpayAdapter.detect(
      { transaction_type: "sale", status: "approved", unique_id: "u", mode: "test" },
      { format: "form" },
    );
    expect(asForm.format).not.toBe("emerchantpay.payment_response.object");
    expect(asForm.confidence).toBeLessThan(0.5);
  });

  it("detects by structure only, so a host or brand never changes the result", () => {
    const base = Object.fromEntries(
      new URLSearchParams(emp("notification-sale-approved.txt").trim()),
    );
    const a = emerchantpayAdapter.detect(base, { format: "form" });
    const b = emerchantpayAdapter.detect(
      { ...base, transaction_id: "PPLsynth-e-comprocessing-order" },
      { format: "form" },
    );
    expect(b.confidence).toBe(a.confidence);
    expect(JSON.stringify(a.reasons)).not.toMatch(/emerchantpay|ecomprocessing|e-comprocessing/i);
  });

  it("returns confidence 0 for every Stripe and Adyen fixture, and for other providers", () => {
    let checked = 0;
    const dirs = readdirSync(fileURLToPath(new URL("../../../../fixtures/", import.meta.url)), {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory() && e.name !== "emerchantpay")
      .map((e) => e.name);
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen"]));
    for (const dir of dirs) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(emerchantpayAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(
            0,
          );
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined)
            expect(
              emerchantpayAdapter.detect(payload, meta).confidence,
              `${dir}/${file}[${i}].payload`,
            ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay processing notifications", () => {
  it("normalizes an approved sale notification", () => {
    const r = analyze(emp("notification-sale-approved.txt"));
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "emerchantpay.notification" });
    expect(r.events[0]).toMatchObject({
      eventType: "notification.sale",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "status=approved",
      paymentReference: "PPLsynth-uid-sale-1001",
      merchantReference: "PPLsynth-order-1001",
      deliveryKey: "PPLsynth-uid-sale-1001|approved||",
      amountMinor: "2500",
    });
    expect(r.events[0]!.currency).toBeUndefined();
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      transactionType: "sale",
      status: "approved",
      signature: "present_sha1_length",
      signatureVerified: false,
      terminalTokenPresent: true,
      amountCurrency: "not included in processing notifications",
    });
    expect(String(r.events[0]!.attributes.genesisInstance)).toMatch(/not identifiable/);
    expect(r.errors).toEqual([]);
  });

  it("decodes a declined 3DS authorization from the documented ?-prefixed shape", () => {
    const r = analyze(emp("notification-authorize3d-declined.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "notification.authorize3d",
      stage: "authorization",
      outcome: "failure",
      amountMinor: "297",
    });
    expect(r.events[0]!.attributes).toMatchObject({ eci: "05", errorCode: "520" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "520",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      providerMessage: "Credit card has expired.",
      paymentReference: "PPLsynth-uid-auth-1002",
      attemptReference: "PPLsynth-uid-auth-1002",
      outcomeKnown: true,
    });
    expect(e.subCodes).toMatchObject({
      field: "error_code",
      family: "gateway",
      status: "declined",
      transaction_type: "authorize3d",
    });
  });

  it("refines a generic issuer decline with the scheme response code", () => {
    const r = analyze(emp("notification-sale-insufficient-funds.txt"));
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "500",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(e.subCodes).toMatchObject({ scheme_response_code: "51", decline_code: "51" });
    expect(e.explanation).toMatch(
      /Declined by the issuer\. Scheme response code 51: insufficient funds/,
    );
    expect(e.explanation).toMatch(/CVV result: match/);
    expect(e.explanation).toMatch(/AVS result: system unavailable/);
    expect(r.events[0]!.attributes).toMatchObject({
      cvvResultCode: "M",
      cvvResult: "match",
      avsResponseCode: "5U",
      avsSource: "issuer processor",
      avsResult: "system unavailable",
    });
  });

  it("keeps an issuer timeout as an unknown outcome and asks to reconcile first", () => {
    const r = analyze(emp("notification-error-issuer-timeout.txt"));
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "unknown" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "230",
      category: "network_or_timeout",
      retry: "manual_review",
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.retryExplanation).toMatch(/must be reconciled/);
    expect(e.nextAction).toMatch(/Reconcile/);
  });

  it("maps a payout as its own operation", () => {
    const r = analyze(emp("notification-payout-approved.txt"));
    expect(r.events[0]).toMatchObject({
      eventType: "notification.payout",
      stage: "payout",
      outcome: "success",
      amountMinor: "15000",
    });
    expect(r.events[0]!.attributes.signature).toBe("present_sha256_length");
    const failed = analyze(notification({ transaction_type: "credit", status: "declined" }));
    expect(failed.events[0]).toMatchObject({ stage: "payout", outcome: "failure" });
    expect(ruleIds(failed)).toContain("PAYOUT_STATUS");
  });

  it("reads a pasted callback URL and a raw HTTP request", () => {
    const url = analyze(emp("notification-callback-url.txt"));
    expect(url.events[0]).toMatchObject({ stage: "payment", outcome: "success" });
    const http = analyze(emp("notification-http.txt"));
    expect(http.events[0]).toMatchObject({
      eventType: "notification.capture",
      stage: "capture",
      outcome: "success",
      paymentReference: "PPLsynth-uid-capture-1012",
      relatedReference: "PPLsynth-uid-auth-1012",
    });
  });

  it("reads a GET notification that carries only a query string", () => {
    const r = analyze(
      `GET /genesis/notify?${notification({ status: "declined", error_code: "540" })} HTTP/1.1\r\nHost: merchant.example\r\n\r\n`,
    );
    expect(r.events[0]).toMatchObject({ outcome: "failure" });
    expect(r.errors[0]).toMatchObject({ code: "540", category: "insufficient_funds" });
  });

  it("maps documented states that imply their own stage", () => {
    const cases = [
      ["refunded", "refund", "success"],
      ["voided", "void", "success"],
      ["partially_reversed", "reversal", "success"],
      ["pending_async", "payment", "pending"],
      ["pending_review", "payment", "pending"],
      ["pending", "payment", "unknown"],
      ["second_chargebacked", "dispute", "unknown"],
      ["chargeback_reversal", "dispute", "unknown"],
    ] as const;
    for (const [status, stage, outcome] of cases) {
      const e = analyze(notification({ status })).events[0]!;
      expect(e, status).toMatchObject({ stage, outcome });
      expect(e.attributes.statusKnown, status).toBe(true);
    }
  });

  it("keeps an undocumented status unknown", () => {
    const r = analyze(notification({ status: "something_new" }));
    expect(r.events[0]).toMatchObject({ outcome: "unknown", stage: "payment" });
    expect(r.events[0]!.attributes.statusKnown).toBe(false);
  });

  it("keeps APM and wallet transaction types inside Genesis with this adapter, as unknown types", () => {
    const r = analyze(
      notification({ transaction_type: "PPLsynth_wallet_type", status: "approved" }),
    );
    expect(r.records[0]).toMatchObject({ status: "analyzed", provider: "emerchantpay" });
    expect(r.events[0]).toMatchObject({
      eventType: "notification.PPLsynth_wallet_type",
      eventTypeKnown: false,
      stage: "other",
      outcome: "success",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("shows request rejections with stage error", () => {
    const r = analyze(
      notification({ status: "error", error_code: "320", technical_message: "x is missing" }),
    );
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({ category: "invalid_request", retry: "do_not_retry" });
  });

  it("decodes risk declines without guessing a reason", () => {
    const r = analyze(notification({ status: "declined", error_code: "629" }));
    expect(r.errors[0]).toMatchObject({
      code: "629",
      category: "fraud_or_risk",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.explanation).toBe("Declined by a risk filter.");
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay recurring and disputes", () => {
  it("marks a rebill and follows the issuer's recurring advice", () => {
    const r = analyzeMany(
      emp("notification-init-recurring-approved.txt"),
      emp("notification-recurring-sale-declined.txt"),
    );
    const [init, rebill] = r.events;
    expect(init).toMatchObject({
      eventType: "notification.init_recurring_sale",
      stage: "payment",
      outcome: "success",
      isRecurring: false,
    });
    expect(rebill).toMatchObject({
      eventType: "notification.recurring_sale",
      stage: "payment",
      outcome: "failure",
      isRecurring: true,
      relatedReference: "PPLsynth-uid-init-1004",
    });
    expect(r.groups).toHaveLength(1);
    const e = r.errors[0]!;
    expect(e).toMatchObject({ code: "500", category: "card_declined", retry: "do_not_retry" });
    expect(e.subCodes).toMatchObject({ recurring_advice_code: "03", decline_code: "05" });
    expect(e.retryExplanation).toMatch(/Recurring advice 03: do not try again/);
    expect(rebill!.attributes.recurringAdvice).toBe("do not try again");
    expect(ruleIds(r)).toContain("RECURRING_PAYMENT_FAILED");
  });

  it("never turns a do-not-retry advice into a retry, and keeps timed advice conditional", () => {
    const timed = analyze(
      notification({
        transaction_type: "recurring_sale",
        status: "declined",
        error_code: "500",
        recurring_advice_code: "25",
      }),
    ).errors[0]!;
    expect(timed.retry).toBe("retry_conditionally");
    expect(timed.retryExplanation).toMatch(/retry after 24 hours/);
    const stop = analyze(
      notification({
        transaction_type: "recurring_sale",
        status: "declined",
        error_code: "626",
        recurring_advice_code: "21",
      }),
    ).errors[0]!;
    expect(stop.retry).toBe("do_not_retry");
  });

  it("maps a chargeback notification to a dispute in the payment's group", () => {
    const r = analyzeMany(
      emp("notification-sale-approved.txt"),
      emp("notification-chargeback.txt"),
      emp("notification-retrieval-request.txt"),
    );
    const disputes = r.events.filter((e) => e.stage === "dispute");
    expect(disputes).toHaveLength(2);
    expect(disputes[0]).toMatchObject({
      eventType: "notification.chargeback",
      eventTypeKnown: true,
      outcome: "unknown",
      providerStatus: "status=chargebacked; event=chargeback",
      deliveryKey: "PPLsynth-uid-sale-1001|chargebacked|chargeback|PPLsynth-uid-cb-2001",
    });
    expect(disputes[0]!.attributes.chargebackUniqueId).toBe("PPLsynth-uid-cb-2001");
    expect(disputes[1]).toMatchObject({ eventType: "notification.retrieval_request" });
    expect(r.groups).toHaveLength(1);
    expect(r.errors).toEqual([]);
    const cb = r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED");
    expect(cb?.title).toBe("Chargeback after a successful payment");
    expect(r.findings.some((f) => f.ruleId === "DUPLICATE_DELIVERY")).toBe(false);
  });

  it("keeps an undocumented event value unknown", () => {
    const r = analyze(notification({ status: "chargebacked", event: "PPLsynth_event" }));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay delivery and correlation", () => {
  it("reports a repeated delivery", () => {
    const r = analyze(emp("notification-duplicate.txt"));
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    expect(r.groups).toHaveLength(1);
    const f = r.findings.find((x) => x.ruleId === "DUPLICATE_DELIVERY");
    expect(f?.explanation).toMatch(/documents that it can deliver the same notification/);
    expect(f?.recommendedAction).toMatch(/notification_echo/);
  });

  it("groups a sale, its refund and its chargeback, and keeps unrelated transactions apart", () => {
    const r = analyzeMany(
      emp("notification-sale-approved.txt"),
      emp("notification-refund-approved.txt"),
      emp("notification-chargeback.txt"),
      emp("notification-payout-approved.txt"),
      emp("notification-authorize3d-declined.txt"),
    );
    expect(r.groups).toHaveLength(3);
    const sale = r.groups.find((g) => g.references.includes("PPLsynth-uid-sale-1001"))!;
    expect(sale.eventIds).toHaveLength(3);
    expect(sale.references).toContain("PPLsynth-uid-refund-1001");
    const refund = r.events.find((e) => e.eventType === "notification.refund")!;
    expect(refund).toMatchObject({ stage: "refund", outcome: "success", amountMinor: "1000" });
    for (const g of r.groups) expect(g.references.join(" ")).not.toMatch(/PPLsynth-order/);
  });

  it("never correlates on the merchant transaction_id", () => {
    const r = analyzeMany(
      notification({ unique_id: "PPLsynth-uid-a", transaction_id: "PPLsynth-same-order" }),
      notification({ unique_id: "PPLsynth-uid-b", transaction_id: "PPLsynth-same-order" }),
    );
    expect(r.groups).toHaveLength(2);
  });

  it("links a JSON response and the notification of the same transaction", () => {
    const r = analyzeMany(
      response({
        unique_id: "PPLsynth-uid-9201",
        status: "pending_async",
        transaction_type: "sale3d",
      }),
      notification({
        unique_id: "PPLsynth-uid-9201",
        transaction_type: "sale3d",
        status: "approved",
      }),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "success"]);
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay WPF notifications", () => {
  it("normalizes an approved WPF notification", () => {
    const r = analyze(emp("wpf-notification-approved.txt"));
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "emerchantpay.wpf.notification",
    });
    expect(r.events[0]).toMatchObject({
      eventType: "wpf_notification",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "wpf_status=approved",
      paymentReference: "PPLsynth-uid-wpf-pay-3001",
      relatedReference: "PPLsynth-wpf-uid-3001",
      merchantReference: "PPLsynth-wpf-order-3001",
      deliveryKey: "wpf|PPLsynth-wpf-uid-3001|approved",
      amountMinor: "4999",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      transactionType: "sale3d",
      signature: "present_sha512_length",
      terminalTokenPresent: true,
    });
    expect(r.errors).toEqual([]);
  });

  it("maps WPF container states", () => {
    const wpf = (status: string, extra: Record<string, string> = {}) =>
      form({
        wpf_unique_id: "PPLsynth-wpf-uid-3002",
        wpf_status: status,
        notification_type: "wpf",
        payment_transaction_unique_id: "PPLsynth-uid-wpf-pay-3002",
        ...extra,
      });
    expect(analyze(wpf("timeout")).events[0]).toMatchObject({ outcome: "unknown" });
    expect(analyze(wpf("chargeback_reversal")).events[0]).toMatchObject({ stage: "dispute" });
    expect(analyze(wpf("declined")).events[0]).toMatchObject({ outcome: "failure" });
    expect(
      analyze(wpf("approved", { payment_transaction_transaction_type: "authorize3d" })).events[0],
    ).toMatchObject({ stage: "authorization" });
    expect(analyze(wpf("new_state")).events[0]).toMatchObject({ outcome: "unknown" });
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay JSON payment responses", () => {
  it("decodes the documented validation error example", () => {
    const r = analyze(emp("response-error-validation.json"));
    expect(r.events[0]).toMatchObject({
      eventType: "payment_response.sale",
      stage: "error",
      outcome: "failure",
      providerStatus: "status=error; code=340",
      paymentReference: "PPLsynth-uid-sale-5001",
      eventTimestamp: "2026-10-19T11:55:33.000Z",
      amountMinor: "100",
      currency: "USD",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      mode: "live",
      sentToAcquirer: false,
      responseCode: "57",
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "340",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "billing_address[zip_code] is invalid!",
    });
    expect(e.subCodes).toMatchObject({ field: "code", response_code: "57" });
    expect(e.missingInformation.join(" ")).toMatch(/response_code is the acquirer's result/);
  });

  it("normalizes an approved response without errors", () => {
    const r = analyze(emp("response-sale-approved.json"));
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "success",
      amountMinor: "2500",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({ mode: "test", cvvResult: "match" });
    expect(r.errors).toEqual([]);
  });

  it("keeps an asynchronous 3DS response pending without copying the redirect URL", () => {
    const r = analyze(emp("response-pending-async.json"));
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "pending" });
    expect(r.events[0]!.attributes.redirectUrlPresent).toBe(true);
    expect(JSON.stringify(r.events)).not.toContain("PPLsynth-redirect-planted");
  });

  it("reads a payment_response wrapper", () => {
    const r = analyze(emp("response-wrapped-declined.json"));
    expect(r.events[0]).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(r.events[0]!.attributes.wrappedInPaymentResponse).toBe(true);
    expect(r.errors[0]).toMatchObject({ code: "510", category: "card_declined" });
    expect(r.errors[0]!.subCodes.decline_code).toBe("14");
  });

  it("decodes an authentication failure", () => {
    const r = analyze(emp("response-login-failed.json"));
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({ code: "110", category: "configuration", retry: "do_not_retry" });
    expect(e.missingInformation.join(" ")).toMatch(/No unique_id/);
  });

  it("keeps a numeric code and amount exact", () => {
    const r = analyze(response({ status: "declined", code: 520, amount: 1234 }));
    expect(r.events[0]).toMatchObject({ amountMinor: "1234", outcome: "failure" });
    expect(r.errors[0]!.code).toBe("520");
  });

  it("flags an unparsable timestamp instead of guessing", () => {
    const r = analyze(response({ timestamp: "2026-10-20 09:00:00" }));
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.timestampUnparsed).toBe(true);
  });

  it("treats a success code as no error", () => {
    expect(analyze(response({ code: "000" })).errors).toEqual([]);
  });

  it("decodes a scheme code alone when the gateway code is missing", () => {
    const r = analyze(response({ status: "declined", scheme_response_code: "65" }));
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "65",
      category: "authentication_required",
      confidence: "possible",
    });
    expect(e.subCodes.field).toBe("scheme_response_code");
    expect(e.missingInformation.join(" ")).toMatch(/Visa and Mastercard tables give different/);
  });
});

// ---------------------------------------------------------------------------

/** A Genesis XML payment_response with the given children, in order. */
const xmlResponse = (fields: Record<string, string>) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<payment_response>\n${Object.entries(fields)
    .map(([k, v]) => `  <${k}>${v}</${k}>`)
    .join("\n")}\n</payment_response>\n`;

const XML_BASE = {
  transaction_type: "sale",
  status: "approved",
  mode: "test",
  transaction_id: "PPLsynth-order-9201",
  unique_id: "PPLsynth-uid-9201",
  timestamp: "2026-10-20T09:00:00Z",
  amount: "1000",
  currency: "EUR",
  sent_to_acquirer: "true",
};

describe("emerchantpay XML payment responses", () => {
  it("analyzes an approved XML response", () => {
    const r = analyze(emp("response-xml-sale-approved.xml"));
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      provider: "emerchantpay",
      format: "emerchantpay.payment_response.xml",
    });
    expect(r.events[0]).toMatchObject({
      sourceFormat: "emerchantpay.payment_response.xml",
      eventType: "payment_response.sale",
      stage: "payment",
      outcome: "success",
      providerStatus: "status=approved",
      paymentReference: "PPLsynth-uid-sale-6001",
      merchantReference: "PPLsynth-order-6001",
      eventTimestamp: "2026-10-21T08:30:00.000Z",
      amountMinor: "4999",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      mode: "test",
      sentToAcquirer: true,
      schemeResponseCode: "00",
      avsResponseCode: "A",
      cvvResult: "match",
    });
    expect(r.events[0]!.attributes.wrappedInPaymentResponse).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("decodes a declined XML response and refines the generic decline with the scheme code", () => {
    const r = analyze(emp("response-xml-authorize-declined.xml"));
    expect(r.events[0]).toMatchObject({
      stage: "authorization",
      outcome: "failure",
      providerStatus: "status=declined; code=500",
      amountMinor: "12500",
      currency: "GBP",
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "500",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Transaction declined by issuer.",
      paymentReference: "PPLsynth-uid-auth-6002",
    });
    expect(e.subCodes).toMatchObject({
      field: "code",
      family: "gateway",
      status: "declined",
      transaction_type: "authorize",
      scheme_response_code: "51",
      decline_code: "51",
      response_code: "51",
    });
    expect(e.explanation).toMatch(/Scheme response code 51: insufficient funds/);
  });

  it("decodes the documented validation error example from XML", () => {
    const r = analyze(emp("response-xml-error-validation.xml"));
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "status=error; code=340",
      eventTimestamp: "2026-10-19T11:55:33.000Z",
      amountMinor: "100",
      currency: "USD",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      mode: "live",
      sentToAcquirer: false,
      responseCode: "57",
      code: "340",
      codeFamily: "gateway",
    });
    expect(r.errors[0]).toMatchObject({
      code: "340",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "billing_address[zip_code] is invalid!",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({ field: "code", response_code: "57" });
  });

  it("reads the same events from XML text values as from the JSON object", () => {
    const fields = {
      ...XML_BASE,
      status: "declined",
      code: "520",
      scheme_response_code: "54",
      recurring_advice_code: "03",
    };
    const fromXml = analyze(xmlResponse(fields));
    const fromJson = analyze(json(fields));
    const strip = (r: AnalysisResult) =>
      r.events.map((e) => ({
        eventType: e.eventType,
        stage: e.stage,
        outcome: e.outcome,
        providerStatus: e.providerStatus,
        paymentReference: e.paymentReference,
        merchantReference: e.merchantReference,
        eventTimestamp: e.eventTimestamp,
        amountMinor: e.amountMinor,
        currency: e.currency,
        attributes: e.attributes,
      }));
    expect(fromXml.events[0]!.sourceFormat).toBe("emerchantpay.payment_response.xml");
    expect(fromJson.events[0]!.sourceFormat).toBe("emerchantpay.payment_response.object");
    expect(strip(fromXml)).toEqual(strip(fromJson));
    expect(fromXml.errors.map((e) => [e.code, e.category, e.retry])).toEqual(
      fromJson.errors.map((e) => [e.code, e.category, e.retry]),
    );
    expect(fromXml.errors[0]).toMatchObject({ code: "520", retry: "do_not_retry" });
  });

  it("keeps amounts in minor units and rejects a decimal amount", () => {
    expect(analyze(xmlResponse({ ...XML_BASE, amount: "000123" })).events[0]!.amountMinor).toBe(
      "000123",
    );
    const r = analyze(xmlResponse({ ...XML_BASE, amount: "10.50" }));
    expect(r.records[0]).toMatchObject({
      status: "invalid",
      format: "emerchantpay.payment_response.xml",
    });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/minor units/);
  });

  it("treats a success code as no error and keeps an empty element empty", () => {
    const r = analyze(xmlResponse({ ...XML_BASE, code: "000", message: "" }));
    expect(r.errors).toEqual([]);
    expect(r.events[0]!.outcome).toBe("success");
  });

  it("reports a read field with attributes or child elements as a parse issue", () => {
    const xml = emp("response-xml-error-validation.xml");
    for (const [from, to, field] of [
      ["<amount>100</amount>", '<amount currency="USD">100</amount>', /amount/],
      ["<code>340</code>", "<code><value>340</value></code>", /code/],
    ] as const) {
      const r = analyze(xml.replace(from, to));
      expect(r.records[0]).toMatchObject({
        status: "invalid",
        provider: "emerchantpay",
        format: "emerchantpay.payment_response.xml",
      });
      expect(r.records[0]!.reasons.join(" ")).toMatch(field);
    }
  });

  it("reads a raw HTTP response with Content-Type text/xml", () => {
    const r = analyze(emp("response-xml-http.txt"));
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "emerchantpay.payment_response.xml",
    });
    expect(r.events[0]).toMatchObject({
      eventType: "payment_response.sale3d",
      stage: "payment",
      outcome: "pending",
      amountMinor: "2000",
      currency: "EUR",
    });
    expect(r.events[0]!.attributes.redirectUrlPresent).toBe(true);
    expect(JSON.stringify(r.events)).not.toContain("PPLsynth-redirect-planted-xml");

    const declined = analyze(
      `HTTP/1.1 200 OK\r\nContent-Type: text/xml\r\n\r\n${emp("response-xml-authorize-declined.xml")}`,
    );
    expect(declined.records[0]).toMatchObject({
      status: "analyzed",
      format: "emerchantpay.payment_response.xml",
    });
    expect(declined.errors[0]).toMatchObject({ code: "500", category: "insufficient_funds" });
  });

  it("links an XML response and the notification of the same transaction", () => {
    const r = analyzeMany(
      xmlResponse({
        ...XML_BASE,
        transaction_type: "sale3d",
        unique_id: "PPLsynth-uid-9202",
        status: "pending_async",
      }),
      notification({ unique_id: "PPLsynth-uid-9202", transaction_type: "sale3d" }),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "success"]);
  });

  it.each([
    [
      "wpf_payment",
      "<wpf_payment><transaction_id>PPLsynth-wpf-order-1</transaction_id><unique_id>PPLsynth-wpf-uid-1</unique_id><status>new</status></wpf_payment>",
      /does not record its fields/,
    ],
    [
      "notification_echo",
      "<notification_echo><unique_id>PPLsynth-uid-echo-1</unique_id></notification_echo>",
      /nothing to analyze/,
    ],
    [
      "reconcile",
      "<reconcile><unique_id>PPLsynth-uid-rec-1</unique_id></reconcile>",
      /reconcile request, not a response/,
    ],
    [
      "payment_transaction",
      "<payment_transaction><transaction_type>sale</transaction_type><transaction_id>PPLsynth-order-req-1</transaction_id><card_number>4200000000000000</card_number></payment_transaction>",
      /Processing API request/,
    ],
    [
      "blacklist_response",
      "<blacklist_response><code>330</code><message>PPLsynth invalid card</message></blacklist_response>",
      /blacklist API response/,
    ],
  ])("recognizes <%s> XML and reports it as unsupported", (_root, text, reason) => {
    const r = analyze(`<?xml version="1.0" encoding="UTF-8"?>\n${text}`);
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      provider: "emerchantpay",
      format: "emerchantpay.xml",
    });
    expect(r.warnings[0]!.message).toMatch(reason);
    expect(r.events).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("4200000000000000");
  });

  it("does not claim XML without the documented Genesis root and children", () => {
    const meta = (root: string, namespace?: string): RecordMeta => ({
      format: "xml",
      xml: { root, ...(namespace ? { namespace } : {}) },
    });
    const d = (o: unknown, m: RecordMeta) => emerchantpayAdapter.detect(o, m).confidence;
    const body = { transaction_type: "sale", status: "approved", unique_id: "PPLsynth-u" };
    expect(d({ response: body }, meta("response"))).toBe(0);
    expect(d({ payment_response: body }, meta("payment_response", "urn:PPLsynth"))).toBe(0);
    expect(d({ payment_response: { status: "approved" } }, meta("payment_response"))).toBe(0);
    expect(d({ payment_response: "approved" }, meta("payment_response"))).toBe(0);
    expect(d({ reconcile: { start_date: "2026-10-01" } }, meta("reconcile"))).toBe(0);
    expect(d({ blacklist_response: { code: "330" } }, meta("blacklist_response"))).toBe(0);
    expect(d({ notification_echo: { status: "ok" } }, meta("notification_echo"))).toBe(0);
    // An XML document is never read as a JSON object or as form data.
    expect(d(body, meta("payment_response"))).toBe(0);
    expect(d({ payment_response: body }, { format: "form" })).toBe(0);
  });

  it("is claimed by no other registered adapter", () => {
    const others = ADAPTERS.filter((a) => a.id !== "emerchantpay");
    expect(others.length).toBeGreaterThan(10);
    const texts = [
      ...[
        "response-xml-sale-approved.xml",
        "response-xml-authorize-declined.xml",
        "response-xml-error-validation.xml",
        "response-xml-http.txt",
      ].map(emp),
      "<wpf_payment><unique_id>PPLsynth-wpf-uid-2</unique_id></wpf_payment>",
      "<notification_echo><unique_id>PPLsynth-uid-echo-2</unique_id></notification_echo>",
    ];
    for (const text of texts) {
      const parsed = parseInput(text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        for (const a of others)
          expect(a.detect(record, parsed.value.meta[i]).confidence, a.id).toBeLessThan(0.5);
      });
      const alone = analyzeText(text, { ...options, adapters: others });
      expect(alone.ok).toBe(true);
      if (alone.ok) expect(alone.result.events).toEqual([]);
      const all = analyze(text, { adapters: ADAPTERS });
      expect(all.records[0]!.provider).toBe("emerchantpay");
      expect(all.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
    }
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay unsupported and malformed input", () => {
  it("recognizes Genesis XML in a JSON string but does not analyze it", () => {
    const r = analyze(emp("response-xml-string.json"));
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "emerchantpay.xml" });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(
      /XML inside a JSON string, which is not read as XML/,
    );
    expect(r.events).toEqual([]);
  });

  it("reports a payment_response XML without transaction_type as an unsupported record", () => {
    const r = analyze(
      "<payment_response><status>error</status><unique_id>PPLsynth-x</unique_id></payment_response>",
    );
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      provider: "emerchantpay",
      format: "emerchantpay.xml",
    });
    expect(r.warnings[0]!.message).toMatch(/lacks the fields needed to analyze it/);
    expect(r.events).toEqual([]);
  });

  it("recognizes an APM external event notification as unsupported", () => {
    const r = analyze(emp("apm-external-event.txt"));
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "emerchantpay.apm_external_event",
    });
    expect(r.events).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("PPLsynth-planted-payload");
  });

  it("reports missing required fields as parse issues", () => {
    const r = analyze(notification({ status: "" }));
    expect(r.records[0]).toMatchObject({ status: "invalid" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status/);
    const amount = analyze(notification({ amount: "10.50" }));
    expect(amount.records[0]!.status).toBe("invalid");
    expect(amount.records[0]!.reasons.join(" ")).toMatch(/minor units/);
    const res = analyze(
      json({
        transaction_type: "sale",
        status: "",
        unique_id: "u",
        mode: "live",
        sent_to_acquirer: "false",
      }),
    );
    expect(res.records[0]!.status).toBe("invalid");
  });

  it("collapses repeated keys with one value and rejects conflicting ones", () => {
    const same = analyze(`${notification()}&status=approved`);
    expect(same.events[0]!.attributes.repeatedKeysCollapsed).toBe(true);
    const conflict = analyze(`${notification()}&status=declined`);
    expect(conflict.records[0]!.status).toBe("invalid");
  });

  it("never throws on malformed values", () => {
    const meta: RecordMeta = { format: "form" };
    for (const bad of [
      { unique_id: ["a", "b"], transaction_type: "sale", status: "approved", signature: SIG },
      { unique_id: "x".repeat(500), transaction_type: "sale", status: "approved", signature: SIG },
      {
        unique_id: "a",
        transaction_type: "sale",
        status: "approved",
        signature: SIG,
        error_code: "x".repeat(50),
      },
    ]) {
      expect(() => emerchantpayAdapter.detect(bad, meta)).not.toThrow();
      const p = emerchantpayAdapter.parse(bad, "emerchantpay.notification", meta);
      expect(p.ok).toBe(false);
    }
    expect(emerchantpayAdapter.parse("x", "emerchantpay.notification").ok).toBe(false);
    expect(emerchantpayAdapter.parse({}, "emerchantpay.other").ok).toBe(false);
    const r = analyzeRecords([{ transaction_type: 5, status: [], unique_id: {} }, "x", 3], options);
    expect(r.ok).toBe(true);
  });

  it("is honest about unrecognized error codes", () => {
    const unknown = analyze(notification({ status: "declined", error_code: "PPLX" })).errors[0]!;
    expect(unknown).toMatchObject({
      code: "PPLX",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const range = analyze(notification({ status: "declined", error_code: "599" })).errors[0]!;
    expect(range).toMatchObject({ category: "card_declined", confidence: "possible" });
    expect(range.subCodes.family).toBe("gateway_range");
    expect(range.missingInformation.join(" ")).toMatch(/range group/);
    const sdk = analyze(notification({ status: "declined", error_code: "697" })).errors[0]!;
    expect(sdk).toMatchObject({ confidence: "possible" });
    expect(sdk.missingInformation.join(" ")).toMatch(/only in the official Genesis PHP SDK/);
    const scheme = analyze(
      notification({ status: "declined", error_code: "500", scheme_response_code: "ZZ" }),
    ).errors[0]!;
    expect(scheme).toMatchObject({ category: "card_declined", confidence: "strong" });
    expect(scheme.missingInformation.join(" ")).toMatch(/not in the documented Visa or Mastercard/);
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay catalog", () => {
  it("contains the documented code counts", () => {
    expect(Object.keys(GATEWAY_CODES)).toHaveLength(93);
    expect(Object.keys(SDK_GATEWAY_CODES)).toHaveLength(5);
    expect(Object.keys(SCHEME_CODES)).toHaveLength(83);
    expect(Object.keys(SDK_SCHEME_CODES)).toHaveLength(16);
    expect(Object.keys(RECURRING_ADVICE)).toHaveLength(18);
    expect(Object.keys(THREEDS_REASONS)).toHaveLength(27);
    expect(Object.keys(CVV_RESULTS)).toHaveLength(5);
    expect(Object.keys(CRYPTOGRAM_RESULTS)).toHaveLength(6);
    expect(Object.keys(TRANSACTION_STATES)).toHaveLength(15);
    expect(Object.keys(WPF_STATES)).toHaveLength(19);
    expect(Object.keys(DISPUTE_EVENTS)).toHaveLength(8);
    expect(Object.keys(TRANSACTION_TYPES)).toHaveLength(13);
  });

  it("keeps SDK-only codes out of the documented tables", () => {
    for (const k of Object.keys(SDK_GATEWAY_CODES)) expect(GATEWAY_CODES[k]).toBeUndefined();
    for (const k of Object.keys(SDK_SCHEME_CODES)) expect(SCHEME_CODES[k]).toBeUndefined();
  });

  it("decodes helper lookups", () => {
    expect(decodeGatewayCode("450")).toMatchObject({ family: "gateway", confidence: "strong" });
    expect(decodeGatewayCode("450").entry.category).toBe("duplicate_request");
    expect(decodeGatewayCode("toString").family).toBeNull();
    expect(decodeSchemeCode("n7")).toMatchObject({ code: "N7", family: "scheme", success: false });
    expect(decodeSchemeCode("00").success).toBe(true);
    expect(decodeSchemeCode("constructor").family).toBeNull();
    expect(describeRecurringAdvice("3")?.meaning).toBe("do not try again");
    expect(describeThreedsReason("50")).toEqual({ meaning: "reserved by EMVCo", known: true });
    expect(describeThreedsReason("90").known).toBe(false);
    expect(describeAvs("2R")).toEqual({
      known: true,
      source: "intermediate processor",
      meaning: "system unavailable",
    });
    expect(describeAvs("B")).toEqual({ known: true });
    expect(describeAvs("9Q").known).toBe(false);
  });

  it("adds the 3DS reason and verification results to a decline", () => {
    const e = analyze(
      notification({
        transaction_type: "sale3d",
        status: "declined",
        error_code: "551",
        threeds_authentication_status_reason_code: "14",
        cryptogram_result: "02",
      }),
    );
    expect(e.errors[0]!.explanation).toMatch(
      /3DS authentication status reason: transaction timed out at the ACS/,
    );
    expect(e.errors[0]!.category).toBe("authentication_required");
    expect(e.events[0]!.attributes).toMatchObject({
      threedsStatusReasonCode: "14",
      cryptogramResult: "fail",
    });
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay redaction", () => {
  const planted = [
    "PPLsynthTERMINALTOKEN0001",
    "PPLsynthTERMINALTOKEN0002",
    "PPLsynthTERMINALTOKEN0009",
    "PPLsynthCONSUMER77",
    "PPLsynth-token-planted-0001",
    "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
    "00112233445566778899aabbccddeeff",
    "PPLsynth-redirect-planted",
    "4200000000000000",
    "Planted Holder",
    "planted.customer@example.invalid",
    "203.0.113.45",
    "PPLsynthPLANTEDPAR",
    "PPLsynth descriptor",
  ];

  it("keeps card, customer, credential and signature data out of events, errors and reports", () => {
    const r = analyzeMany(
      emp("notification-sale-approved.txt"),
      emp("notification-authorize3d-declined.txt"),
      emp("wpf-notification-approved.txt"),
      emp("response-pending-async.json"),
      emp("response-sale-approved.json"),
      notification({
        status: "declined",
        error_code: "510",
        card_number: "4200000000000000",
        card_holder: "Planted Holder",
        customer_email: "planted.customer@example.invalid",
        remote_ip: "203.0.113.45",
        payment_account_reference: "PPLsynthPLANTEDPAR",
      }),
    );
    expect(r.events.length).toBe(6);
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

  it("keeps values planted in XML responses out of events, errors and reports", () => {
    const xmlPlanted = [
      "PPLsynthCONSUMER61",
      "PPLsynth-token-planted-6001",
      "Planted Xml Holder",
      "420000...0000",
      "planted.xml@example.invalid",
      "203.0.113.61",
      "PPLsynth xml descriptor",
      "PPLsynth-redirect-planted-xml",
      "PPLsynthTERMINALTOKEN0061",
      "4111111111111111",
    ];
    const r = analyzeMany(
      emp("response-xml-sale-approved.xml"),
      emp("response-xml-error-validation.xml"),
      emp("response-xml-http.txt"),
      xmlResponse({
        ...XML_BASE,
        status: "declined",
        code: "510",
        terminal_token: "PPLsynthTERMINALTOKEN0061",
        card_number: "4111111111111111",
        cvv: "123",
      }),
    );
    expect(r.events.length).toBe(4);
    expect(r.errors.length).toBe(2);
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of xmlPlanted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("emerchantpay manifest", () => {
  it("is honest about capabilities", () => {
    expect(emerchantpayManifest).toMatchObject({
      id: "emerchantpay",
      version: EMERCHANTPAY_ADAPTER_VERSION,
      wave: "HR-2",
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
    });
    expect(emerchantpayManifest.categories).toEqual([
      "acquiring",
      "gateway",
      "card_processing",
      "alternative_payment_method",
    ]);
    expect(emerchantpayManifest.delivery).toMatchObject({
      ordering: "not_documented",
      duplicatesDocumented: true,
    });
    expect(emerchantpayManifest.limitations.join(" ")).toMatch(/E-ComProcessing/);
    expect(emerchantpayManifest.limitations.join(" ")).toMatch(/root payment_response/);
    expect(emerchantpayManifest.limitations.join(" ")).not.toMatch(/does not parse XML/);
    expect(
      emerchantpayManifest.apiFamilies.find((f) => f.id === "emerchantpay.payment_response.xml"),
    ).toMatchObject({ status: "supported" });
    expect(emerchantpayManifest.apiFamilies.find((f) => f.id === "emerchantpay.xml")).toMatchObject(
      { status: "unsupported" },
    );
    expect(emerchantpayAdapter.manifest).toBe(emerchantpayManifest);
    expect(emerchantpayDefault).toBe(emerchantpayAdapter);
  });

  it("lists exactly the documented sectors with first-party sources", () => {
    expect(emerchantpayManifest.sectors.map((s) => s.sector)).toEqual([
      "gaming / iGaming",
      "digital goods and services (incl. subscription-based businesses)",
      "financial services",
      "travel",
      "eCommerce",
      "retail",
    ]);
    for (const s of emerchantpayManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/www\.emerchantpay\.com\//);
  });

  it("uses no em or en dash characters in sources, fixtures and the manifest", () => {
    const dashes = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    const files = [
      ...["index.ts", "catalog.ts", "manifest.ts"].map((f) =>
        fileURLToPath(new URL(`../src/${f}`, import.meta.url)),
      ),
      fileURLToPath(import.meta.url),
      ...readdirSync(fixturePath("emerchantpay")).map((f) => fixturePath(`emerchantpay/${f}`)),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const d of dashes) expect(text.includes(d), file).toBe(false);
    }
    const text = JSON.stringify(emerchantpayManifest);
    for (const d of dashes) expect(text).not.toContain(d);
  });

  it("uses only PPLsynth identifiers in fixtures", () => {
    for (const f of readdirSync(fixturePath("emerchantpay"))) {
      const text = emp(f);
      expect(text, f).toMatch(/PPLsynth/);
      for (const m of text.matchAll(/(?:unique_id|transaction_id)(?:=|>|": ")([^&"<\s,\\]+)/g))
        expect(m[1], f).toMatch(/PPLsynth/);
    }
  });
});
