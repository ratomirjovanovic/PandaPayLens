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
} from "@pandapaylens/core";
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules } from "@pandapaylens/rules";
import {
  API_ERRORS,
  BANK_API_ERRORS,
  canonicalReasonCode,
  decodeApiError,
  decodeBankApiError,
  decodeBankPayoutError,
  decodeFailedReason,
  decodeMqiHttpError,
  FAILED_REASON_CODES,
  MQI_HTTP_ERRORS,
  PAYMENT_STATUSES,
  REFUND_EXECUTION_STATUSES,
  SKRILL_ADAPTER_VERSION,
  skrillAdapter,
  skrillManifest,
  TRANSACTION_STATUSES,
  UBP_EXECUTION_ERRORS,
  UBP_PREPARATION_ERRORS,
} from "@pandapaylens/skrill";
import defaultExport from "@pandapaylens/skrill";

const options: AnalyzeOptions = {
  adapters: [skrillAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const fixturePath = (p: string) =>
  fileURLToPath(new URL(`../../../../fixtures/${p}`, import.meta.url));
const fixture = (p: string) => readFileSync(fixturePath(p), "utf8");

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (p: string) => analyze(fixture(`skrill/${p}`));

function analyzeMany(...texts: string[]): AnalysisResult {
  const r = analyzeSources(
    texts.map((text, i) => ({ name: `input-${i}`, text })),
    options,
  );
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const many = (...files: string[]) => analyzeMany(...files.map((f) => fixture(`skrill/${f}`)));

const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const MD5 = "5F3A9C1E7B2D4F6081A3C5E7092B4D6F";

const post = (fields: Record<string, string | undefined> = {}) => {
  const all: Record<string, string | undefined> = {
    pay_to_email: "merchant.PPLsynth@example.com",
    pay_from_email: "payer.PPLsynth@example.com",
    merchant_id: "PPLsynth290001",
    customer_id: "PPLsynth-customer-9001",
    transaction_id: "PPLsynth-order-9001",
    mb_transaction_id: "PPLsynth300009001",
    mb_amount: "12.5",
    mb_currency: "EUR",
    status: "-2",
    md5sig: MD5,
    amount: "12.50",
    currency: "EUR",
    ...fields,
  };
  return form(
    Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined)) as Record<
      string,
      string
    >,
  );
};

function detectText(text: string) {
  const parsed = parseInput(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return skrillAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
}

describe("skrill exports and catalogs", () => {
  it("exports the adapter, manifest, version and catalogs", () => {
    expect(defaultExport).toBe(skrillAdapter);
    expect(skrillAdapter.id).toBe("skrill");
    expect(skrillAdapter.manifest).toBe(skrillManifest);
    expect(SKRILL_ADAPTER_VERSION).toBe("0.1.0");
    expect(Object.keys(PAYMENT_STATUSES).sort()).toEqual(["-1", "-2", "-3", "0", "2"]);
    expect(Object.keys(FAILED_REASON_CODES)).toHaveLength(51);
    expect(Object.keys(API_ERRORS)).toHaveLength(58);
    expect(Object.keys(MQI_HTTP_ERRORS)).toHaveLength(5);
    expect(Object.keys(BANK_API_ERRORS)).toHaveLength(2);
    expect(Object.keys(UBP_PREPARATION_ERRORS)).toHaveLength(9);
    expect(Object.keys(UBP_EXECUTION_ERRORS)).toHaveLength(17);
  });

  it("marks the table-specific reason codes", () => {
    expect(FAILED_REASON_CODES["103"]!.only).toBe("wallet_checkout");
    expect(FAILED_REASON_CODES["35"]!.only).toBe("quick_checkout");
    expect(FAILED_REASON_CODES["05"]!.only).toBeUndefined();
  });
});

describe("skrill detection", () => {
  it.each([
    ["status-url-processed.txt", "skrill.status_url", true],
    ["status-url-chargeback.txt", "skrill.status_url", true],
    ["payout-status-report.txt", "skrill.status_url", true],
    ["bank-payout-returned.txt", "skrill.status_url", true],
    ["refund-status-processed.txt", "skrill.refund_status", true],
    ["recurring-status-processed.txt", "skrill.recurring_status", true],
    ["bank-payout-error-insufficient-balance.json", "skrill.ubp.error", true],
    ["bank-payout-error-unsupported-bank.json", "skrill.ubp.error", true],
    ["return-url.txt", "skrill.return_url", false],
    ["balance-webhook.txt", "skrill.balance.webhook", false],
  ])("detects %s", (file, format, supported) => {
    const d = detectText(fixture(`skrill/${file}`));
    expect(d.format).toBe(format);
    expect(d.supported).toBe(supported);
    expect(d.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("does not claim generic shapes", () => {
    const d = (o: unknown, meta?: Parameters<typeof skrillAdapter.detect>[1]) =>
      skrillAdapter.detect(o, meta).confidence;
    const formMeta = { format: "form" as const };
    expect(d({ status: "2" }, formMeta)).toBe(0);
    expect(d({ status: "2", transaction_id: "1" }, formMeta)).toBe(0);
    expect(d({ mb_transaction_id: "1" }, formMeta)).toBe(0);
    expect(d({ mb_transaction_id: "1", status: "2" }, formMeta)).toBe(0);
    expect(d({ rec_payment_id: "1", status: "2" }, formMeta)).toBe(0);
    expect(d({ transaction_id: "1", msid: "not-hex" }, formMeta)).toBe(0);
    expect(d({ error: "x" })).toBe(0);
    expect(d({ error: { code: "x", details: [] } })).toBe(0);
    expect(d({ code: "BAD_REQUEST", message: "x", description: "y" })).toBeLessThan(0.5);
    expect(d({ code: "MISSING_PARAMETER", message: "x", description: "y" })).toBeLessThan(0.5);
    expect(d({ status: "PROCESSED", id: "1" })).toBe(0);
    expect(d({ name: "skrill", provider: "Skrill", message: "skrill error" }, formMeta)).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
    expect(d("mb_transaction_id=1&status=2")).toBe(0);
  });

  it("recognizes nothing from Paysafe Checkout JSON", () => {
    const d = (o: unknown) => skrillAdapter.detect(o, { format: "json" }).confidence;
    expect(
      d({
        id: "PPLsynth-pay-1",
        merchantRefNum: "PPLsynth-ref-1",
        amount: 1000,
        currencyCode: "EUR",
        paymentType: "SKRILL",
        status: "COMPLETED",
      }),
    ).toBe(0);
    // Paysafe errors share the nested error.code + details shape.
    expect(d({ error: { code: "5068", message: "Field error(s)", details: ["x"] } })).toBe(0);
    expect(d({ error: { code: "5003", message: "x", details: [] } })).toBe(0);
    // A numeric bank payout code in the shared nested shape stays below the threshold.
    expect(d({ error: { code: "7005", message: "x", details: [] } })).toBeLessThan(0.5);
    const r = analyze(
      JSON.stringify({
        paymentType: "SKRILL",
        amount: 1000,
        currencyCode: "EUR",
        status: "FAILED",
      }),
    );
    expect(r.records[0]).toMatchObject({ status: "unsupported", provider: null });
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    let checked = 0;
    for (const dir of ["stripe", "adyen"]) {
      for (const file of readdirSync(fixturePath(dir))) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          const meta = parsed.value.meta[i];
          expect(skrillAdapter.detect(record, meta).confidence, `${dir}/${file}[${i}]`).toBe(0);
          const payload = (record as { payload?: unknown } | null)?.payload;
          if (payload !== undefined) expect(skrillAdapter.detect(payload, meta).confidence).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("does not claim records of other providers", () => {
    for (const dir of [
      "payabl",
      "verotel",
      "mollie",
      "checkout",
      "paypal",
      "braintree",
      "square",
    ]) {
      let files: string[] = [];
      try {
        files = readdirSync(fixturePath(dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const parsed = parseInput(fixture(`${dir}/${file}`));
        if (!parsed.ok) continue;
        parsed.value.records.forEach((record, i) => {
          expect(
            skrillAdapter.detect(record, parsed.value.meta[i]).confidence,
            `${dir}/${file}[${i}]`,
          ).toBe(0);
        });
      }
    }
  });
});

describe("skrill status_url payments", () => {
  it("normalizes a processed wallet payment", () => {
    const r = analyzeFixture("status-url-processed.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "skrill.status_url" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "status_url.processed",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "status=2",
      paymentReference: "PPLsynth300000101",
      merchantReference: "PPLsynth-order-1001",
      amountMinor: "2550",
      currency: "EUR",
      deliveryKey: "status_url:PPLsynth300000101:2",
    });
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.attributes).toMatchObject({
      operation: "payment",
      operationBasis: "customer_id",
      paymentType: "WLT",
      merchantId: "PPLsynth290001",
      walletAmountMinor: "2550",
      walletCurrency: "EUR",
      md5sig: "present_32_hex",
      sha2sig: "present_64_hex",
      signatureVerified: false,
    });
    expect(String(e.attributes.statusMeaning)).toMatch(/Skrill account/);
    // Wallet semantics: not an authorization or capture.
    expect(r.events.some((x) => x.stage === "authorization" || x.stage === "capture")).toBe(false);
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("analyzes a plain form body, a URL query string and a JSON dump the same way", () => {
    const body = post({ status: "2" });
    const plain = analyze(body);
    const url = analyze(`https://merchant.example.com/skrill/status?${body}`);
    const json = analyze(JSON.stringify(Object.fromEntries(new URLSearchParams(body))));
    for (const r of [plain, url, json]) {
      expect(r.records[0]!.status).toBe("analyzed");
      expect(r.events[0]).toMatchObject({ eventType: "status_url.processed", amountMinor: "1250" });
    }
    expect(JSON.stringify(url.events)).not.toContain("merchant.example.com");
  });

  it("decodes a decline with failed_reason_code", () => {
    const r = analyzeFixture("status-url-failed-insufficient-funds.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "status_url.failed",
      stage: "payment",
      outcome: "failure",
      providerStatus: "status=-2; failed_reason_code=05",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      failedReasonCode: "05",
      reasonCodeInPayload: true,
    });
    expect(r.errors[0]).toMatchObject({
      code: "05",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      paymentReference: "PPLsynth300000103",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      family: "failed_reason",
      field: "failed_reason_code",
      table: "both",
    });
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("treats padded and unpadded reason codes alike", () => {
    expect(canonicalReasonCode("5")).toBe("05");
    expect(canonicalReasonCode("05")).toBe("05");
    expect(canonicalReasonCode("102")).toBe("102");
    const r = analyze(post({ failed_reason_code: "5" }));
    expect(r.errors[0]).toMatchObject({ code: "05", category: "insufficient_funds" });
    expect(r.errors[0]!.subCodes.rawCode).toBe("5");
  });

  it("decodes a failure without a reason code honestly", () => {
    const r = analyzeFixture("status-url-failed-no-reason.txt");
    expect(r.events[0]).toMatchObject({ outcome: "failure", providerStatus: "status=-2" });
    expect(r.events[0]!.attributes.reasonCodeInPayload).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "-2",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/Merchant Services has enabled/);
    expect(r.errors[0]!.explanation).toMatch(/does not say which/);
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("shows both meanings of code 19 and of code 06", () => {
    const r = analyze(post({ failed_reason_code: "19" }));
    expect(r.errors[0]).toMatchObject({
      code: "19",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(r.errors[0]!.explanation).toMatch(/Quick Checkout table: Credentials invalid/);
    expect(r.errors[0]!.explanation).toMatch(/Wallet Checkout table: Retry transaction/);
    const six = decodeFailedReason("6");
    expect(six.code).toBe("06");
    expect(six.entry.explanation).toMatch(/Declined by the merchant or processor/);
    expect(six.entry.explanation).toMatch(/Transaction failed/);
    expect(decodeFailedReason("103").entry.explanation).toMatch(
      /only in the Wallet Checkout table/,
    );
  });

  it("decodes authentication and validation reasons", () => {
    const auth = analyze(post({ failed_reason_code: "70" }));
    expect(auth.errors[0]).toMatchObject({
      category: "authentication_failed",
      retry: "customer_action_required",
    });
    const format = analyze(post({ failed_reason_code: "30" }));
    expect(format.errors[0]).toMatchObject({ category: "invalid_request", retry: "do_not_retry" });
  });

  it("keeps a communication error as a known failure without a blind retry", () => {
    const r = analyze(post({ failed_reason_code: "98" }));
    expect(r.errors[0]).toMatchObject({
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/check the current status first/);
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("reports an unrecognized reason code with insufficient confidence", () => {
    const r = analyze(post({ failed_reason_code: "77" }));
    expect(r.errors[0]).toMatchObject({
      code: "77",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(
      /not in the documented Skrill tables/,
    );
    const t = decodeFailedReason("54");
    expect(t).toMatchObject({ family: "status_text", confidence: "possible" });
  });

  it("shows a pending payment as unresolved and a cancellation as a failed payment", () => {
    const pending = analyzeFixture("status-url-pending.txt");
    expect(pending.events[0]).toMatchObject({
      eventType: "status_url.pending",
      stage: "payment",
      outcome: "pending",
    });
    expect(ruleIds(pending)).toEqual(["UNRESOLVED_OUTCOME"]);
    const cancelled = analyzeFixture("status-url-cancelled.txt");
    expect(cancelled.events[0]).toMatchObject({
      eventType: "status_url.cancelled",
      stage: "cancellation",
      outcome: "failure",
    });
    expect(cancelled.errors).toEqual([]);
  });

  it("keeps undocumented statuses unknown", () => {
    const r = analyze(post({ status: "5" }));
    expect(r.events[0]).toMatchObject({
      eventType: "status_url.unknown",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("skrill chargebacks, refunds and payouts", () => {
  it("shows a chargeback as a dispute without a parent link", () => {
    const r = analyzeFixture("status-url-chargeback.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "status_url.chargeback",
      stage: "dispute",
      outcome: "unknown",
      paymentReference: "PPLsynth300000106",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      operation: "chargeback",
      parentReferenceInPayload: false,
    });
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("does not merge a chargeback or refund with the payment by merchant reference", () => {
    const r = many(
      "status-url-processed.txt",
      "status-url-chargeback.txt",
      "refund-status-processed.txt",
    );
    // The chargeback reuses transaction_id PPLsynth-order-1001 but has a new mb_transaction_id.
    expect(r.events[0]!.merchantReference).toBe(r.events[1]!.merchantReference);
    expect(r.groups).toHaveLength(3);
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("normalizes a refund status report", () => {
    const r = analyzeFixture("refund-status-processed.txt");
    expect(r.records[0]!.format).toBe("skrill.refund_status");
    expect(r.events[0]).toMatchObject({
      eventType: "refund_status.processed",
      stage: "refund",
      outcome: "success",
      paymentReference: "PPLsynth300000107",
      merchantReference: "PPLsynth-refund-2001",
      amountMinor: "1000",
      currency: "EUR",
      deliveryKey: "refund_status:PPLsynth300000107:2",
    });
    expect(r.events[0]!.attributes.parentReferenceInPayload).toBe(false);
    const failed = analyze(
      form({
        transaction_id: "PPLsynth-refund-2002",
        mb_transaction_id: "PPLsynth300000111",
        status: "-2",
        mb_amount: "10",
        mb_currency: "EUR",
        md5sig: MD5,
      }),
    );
    expect(failed.events[0]).toMatchObject({ stage: "refund", outcome: "failure" });
    expect(failed.findings.find((f) => f.ruleId === "PAYMENT_FAILURE")!.title).toBe(
      "Refund failed",
    );
  });

  it("marks a payout-shaped post as payment_or_payout and keeps the wallet amount honest", () => {
    const r = analyzeFixture("payout-status-report.txt");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "status_url.processed",
      stage: "payment",
      outcome: "success",
      amountMinor: "8000",
      currency: "EUR",
    });
    expect(e.attributes).toMatchObject({
      operation: "payment_or_payout",
      operationBasis: "none",
      walletAmountExceedsMinorUnits: true,
    });
    expect(e.attributes.walletAmountMinor).toBeUndefined();
    const failed = analyze(post({ customer_id: undefined, failed_reason_code: "51" }));
    expect(failed.errors[0]!.missingInformation.join(" ")).toMatch(/payout status posts/);
  });

  it("shows a returned bank payout as a failed payout", () => {
    const r = analyzeFixture("bank-payout-returned.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "status_url.returned",
      stage: "payout",
      outcome: "failure",
    });
    expect(r.events[0]!.attributes).toMatchObject({ operation: "bank_payout", paymentType: "BWI" });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    const scheduled = analyze(post({ status: "1", customer_id: undefined }));
    expect(scheduled.events[0]).toMatchObject({ stage: "payout", outcome: "pending" });
  });
});

describe("skrill recurring billing", () => {
  it("groups the setup payment and recurring posts by rec_payment_id", () => {
    const r = many(
      "status-url-recurring-setup.txt",
      "recurring-status-processed.txt",
      "recurring-status-failed.txt",
    );
    expect(r.events).toHaveLength(3);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining(["mb:PPLsynth300000110", "rec:PPLsynth-rec-4001"]),
    );
    expect(r.events[1]).toMatchObject({
      eventType: "recurring_status.processed",
      stage: "payment",
      outcome: "success",
      isRecurring: true,
      subscriptionReference: "PPLsynth-rec-4001",
    });
    expect(r.events[1]!.deliveryKey).toBeUndefined();
    expect(r.events[2]).toMatchObject({ outcome: "failure", isRecurring: true });
    const finding = r.findings.find((f) => f.ruleId === "RECURRING_PAYMENT_FAILED");
    expect(finding?.title).toBe("Rebill declined after earlier successful payments");
    expect(r.errors).toEqual([]);
  });
});

describe("skrill bank payout errors", () => {
  it("decodes an execution error", () => {
    const r = analyzeFixture("bank-payout-error-insufficient-balance.json");
    expect(r.events[0]).toMatchObject({
      eventType: "bank_payout.error",
      stage: "error",
      outcome: "failure",
      providerStatus: "code=7005",
    });
    expect(r.errors[0]).toMatchObject({
      code: "7005",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      providerMessage: "Insufficient balance",
    });
  });

  it("decodes a nested preparation error", () => {
    const r = analyzeFixture("bank-payout-error-unsupported-bank.json");
    expect(r.errors[0]).toMatchObject({
      code: "UNSUPPORTED_BANK",
      category: "payment_method_unavailable",
      retry: "do_not_retry",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({ field: "error.code", family: "ubp_preparation" });
  });

  it("decodes signature and validation failures", () => {
    const sig = analyze(JSON.stringify({ code: 7002, message: "x", description: "y" }));
    expect(sig.errors[0]).toMatchObject({ code: "7002", category: "authentication_failed" });
    const missing = analyze(
      JSON.stringify({ code: "MISSING_PARAMETER", message: "x", description: "y" }),
      { provider: "skrill" },
    );
    expect(missing.errors[0]).toMatchObject({ category: "invalid_request", retry: "do_not_retry" });
  });

  it("reports an undocumented code honestly when the provider is selected", () => {
    const r = analyze(JSON.stringify({ code: "7016", message: "x", description: "y" }), {
      provider: "skrill",
    });
    expect(r.errors[0]).toMatchObject({
      code: "7016",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/7016 is not documented/);
  });
});

describe("skrill catalog-only decoders", () => {
  it("decodes API error strings, including wildcard families", () => {
    expect(decodeApiError("BALANCE_NOT_ENOUGH").entry.category).toBe("insufficient_funds");
    expect(decodeApiError("LOGIN_INVALID").entry.category).toBe("authentication_failed");
    expect(decodeApiError("INVALID_EMAIL")).toMatchObject({
      code: "INVALID_EMAIL",
      subCodes: { family: "api" },
    });
    const wild = decodeApiError("MISSING_FRN_TRN_ID");
    expect(wild.subCodes).toMatchObject({ pattern: "MISSING_*", parameter: "frn_trn_id" });
    expect(decodeApiError("NOT_SUPPORTED_CURRENCY_XYZ").subCodes.pattern).toBe(
      "NOT_SUPPORTED_CURRENCY_*",
    );
    expect(decodeApiError("CC_REFUND_ FAILED")).toMatchObject({
      code: "CC_REFUND_FAILED",
      confidence: "possible",
    });
    expect(decodeApiError("SESSION_EXPIRED").entry.retry).toBe("safe_to_retry_technical_request");
    expect(decodeApiError("PPLSYNTH_NEW")).toMatchObject({
      family: null,
      confidence: "insufficient",
    });
    expect(decodeApiError("toString").family).toBeNull();
  });

  it("decodes MQI HTTP, Bank API and bank payout codes", () => {
    expect(decodeMqiHttpError(401).entry.category).toBe("authentication_failed");
    expect(decodeMqiHttpError("403").entry.category).toBe("invalid_request");
    expect(decodeBankApiError(5068).entry.category).toBe("invalid_request");
    expect(decodeBankPayoutError("7003").entry.retry).toBe("safe_to_retry_technical_request");
    expect(decodeBankPayoutError("ALREADY_PAID").entry.category).toBe("duplicate_request");
  });
});

describe("skrill unsupported records and parse issues", () => {
  it("recognizes the return_url redirect but does not analyze it", () => {
    const r = analyzeFixture("return-url.txt");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "skrill.return_url" });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/status_url post/);
    expect(r.events).toEqual([]);
  });

  it("recognizes the balance webhook as out of scope", () => {
    const r = analyzeFixture("balance-webhook.txt");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "skrill.balance.webhook" });
    expect(r.events).toEqual([]);
  });

  it("reports missing required fields instead of throwing", () => {
    const r = analyze(post({ mb_amount: undefined }));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "skrill.status_url" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^mb_amount:/);
    expect(r.events).toEqual([]);
  });

  it("reports repeated keys as parse issues", () => {
    const r = analyze(`${post()}&status=2`);
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status/);
  });

  it("fails cleanly on malformed input", () => {
    expect(analyzeText("mb_transaction_id=1&status", options).ok).toBe(false);
    expect(analyzeText('{"code": "7005",', options).ok).toBe(false);
    expect(skrillAdapter.parse("x", "skrill.status_url").ok).toBe(false);
    expect(skrillAdapter.parse({}, "skrill.nope").ok).toBe(false);
    expect(skrillAdapter.parse({ status: "2" }, "skrill.refund_status").ok).toBe(false);
    expect(skrillAdapter.parse({ code: true }, "skrill.ubp.error").ok).toBe(false);
  });
});

describe("skrill duplicates and correlation", () => {
  it("flags a repeated status_url post", () => {
    const text = fixture("skrill/status-url-processed.txt");
    const r = analyzeMany(text, text);
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toBeDefined();
    expect(dup!.explanation).toMatch(/documents that it can deliver/);
    expect(r.groups).toHaveLength(1);
  });

  it("groups pending and processed posts of one transaction without flagging duplicates", () => {
    const r = many("status-url-pending.txt", "status-url-processed-after-pending.txt");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.eventType)).toEqual([
      "status_url.pending",
      "status_url.processed",
    ]);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
    expect(r.arrivalOrderInferred).toBe(true);
  });

  it("keeps unrelated transactions apart", () => {
    const r = many(
      "status-url-processed.txt",
      "status-url-failed-insufficient-funds.txt",
      "status-url-cancelled.txt",
      "payout-status-report.txt",
    );
    expect(r.groups).toHaveLength(4);
  });

  it("does not let a Skrill id and a mandate id with the same value collide", () => {
    const r = analyzeRecords(
      [
        Object.fromEntries(
          new URLSearchParams(post({ mb_transaction_id: "PPLsynth77", status: "2" })),
        ),
        {
          merchant_id: "PPLsynth290001",
          status: "2",
          rec_payment_id: "PPLsynth77",
          rec_payment_type: "recurring",
          md5sig: MD5,
        },
      ],
      options,
      [{ format: "form" }, { format: "form" }],
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.groups).toHaveLength(2);
  });
});

describe("skrill redaction", () => {
  const planted = [
    MD5,
    "9c1e5f3a7b2d4f6081a3c5e7092b4d6f1a2b3c4d5e6f708192a3b4c5d6e7f809",
    "0D2C4E6A8B1F3D5C7E9A1B3D5F7092C4",
    "merchant.PPLsynth@example.com",
    "payer.PPLsynth@example.com",
    "planted.payer@example.com",
    "PPLsynth-customer-7781",
    "PPLsynth-customer-9001",
    "PPLsynth-instrument-0001",
    "PPLsynth Planted Field",
    "PPLsynthSecretWord",
    "203.0.113.9",
    "4111111111111111",
  ];

  it("keeps signatures, emails, customer ids and echoed fields out of events and reports", () => {
    const r = analyzeMany(
      fixture("skrill/status-url-processed.txt"),
      fixture("skrill/status-url-failed-insufficient-funds.txt"),
      fixture("skrill/refund-status-processed.txt"),
      fixture("skrill/recurring-status-processed.txt"),
      fixture("skrill/return-url.txt"),
      fixture("skrill/balance-webhook.txt"),
      post({
        pay_from_email: "planted.payer@example.com",
        instrument_id: "PPLsynth-instrument-0001",
        merchant_fields: "order_note",
        order_note: "PPLsynth Planted Field",
        secret: "PPLsynthSecretWord",
        IP_country: "DE",
        ip: "203.0.113.9",
        card_number: "4111111111111111",
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
    expect(r.sensitiveData.detected).toBe(true);
  });
});

describe("skrill manifest", () => {
  it("is honest about capabilities and the high-risk metadata", () => {
    expect(skrillManifest).toMatchObject({
      id: "skrill",
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
    });
    expect(skrillManifest.categories).toEqual(["wallet", "alternative_payment_method"]);
    expect(skrillManifest.sectors).toHaveLength(3);
    for (const s of skrillManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(www\.paysafe\.com|docs\.paysafe\.com)\//);
    expect(skrillManifest.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "limited",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "limited",
      diagnosticRules: "limited",
    });
    expect(skrillManifest.delivery).toMatchObject({
      ordering: "not_documented",
      duplicatesDocumented: true,
    });
    expect(skrillManifest.fixtureProvenance).toMatch(/field tables/);
  });

  it("contains no en or em dash in code, catalogs or fixtures", () => {
    const texts = [
      JSON.stringify(skrillManifest),
      JSON.stringify(FAILED_REASON_CODES),
      JSON.stringify(API_ERRORS),
      ...readdirSync(fixturePath("skrill")).map((f) => fixture(`skrill/${f}`)),
      ...["index.ts", "catalog.ts", "manifest.ts"].map((f) =>
        readFileSync(fileURLToPath(new URL(`../src/${f}`, import.meta.url)), "utf8"),
      ),
      readFileSync(fileURLToPath(import.meta.url), "utf8"),
    ];
    for (const text of texts)
      for (const dash of [0x2013, 0x2014]) expect(text).not.toContain(String.fromCharCode(dash));
  });
});

const xml = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><response>${inner}</response>`;
const xmlError = (msg: string) => xml(`<error><error_msg>${msg}</error_msg></error>`);
const xmlTransaction = (status: string, extra = "") =>
  xml(
    `<transaction><amount>5.50</amount><currency>EUR</currency><id>PPLsynth497040</id><status>${status}</status>${extra}</transaction>`,
  );

const XML_FIXTURES = [
  "api-refund-processed.xml",
  "api-refund-pending-http.txt",
  "api-error-balance-not-enough.xml",
  "api-error-undocumented.xml",
  "api-transfer-processed.xml",
  "api-send-money-scheduled.xml",
  "api-payout-pending.xml",
  "api-prepare-sid.xml",
];

describe("skrill XML API detection", () => {
  it("documents the execution status values", () => {
    expect(Object.keys(REFUND_EXECUTION_STATUSES).sort()).toEqual(["-2", "0", "2"]);
    expect(Object.keys(TRANSACTION_STATUSES).sort()).toEqual(["-2", "0", "1", "2"]);
  });

  it.each([
    ["api-refund-processed.xml", "skrill.api.refund", true, 0.7],
    ["api-refund-pending-http.txt", "skrill.api.refund", true, 0.7],
    ["api-error-balance-not-enough.xml", "skrill.api.error", true, 0.7],
    ["api-error-undocumented.xml", "skrill.api.error", true, 0.5],
    ["api-transfer-processed.xml", "skrill.api.transaction", true, 0.7],
    ["api-send-money-scheduled.xml", "skrill.api.transaction", true, 0.6],
    ["api-payout-pending.xml", "skrill.api.transaction", true, 0.6],
    ["api-prepare-sid.xml", "skrill.api.prepare", false, 0.6],
  ])("detects %s", (file, format, supported, min) => {
    const d = detectText(fixture(`skrill/${file}`));
    expect(d).toMatchObject({ format, supported });
    expect(d.confidence).toBeGreaterThanOrEqual(min);
  });

  it("detects by root element and documented children only", () => {
    const c = (text: string) => detectText(text).confidence;
    expect(c("<payment_response><status>2</status></payment_response>")).toBe(0);
    expect(
      c(
        '<response xmlns="urn:pplsynth"><error><error_msg>CANNOT_LOGIN</error_msg></error></response>',
      ),
    ).toBe(0);
    expect(c(xml("<status>2</status><id>PPLsynth1</id>"))).toBe(0);
    expect(c(xml("<error>CANNOT_LOGIN</error>"))).toBe(0);
    expect(c(xml("<transaction><status>2</status></transaction>"))).toBe(0);
    expect(c(xml("<sid>not-a-session-id</sid>"))).toBe(0);
    expect(c(xml("<sid>7e3b9a0c5d1f4e2a8b6c0d9e1f2a3b4c</sid><status>2</status>"))).toBe(0);
    expect(c("<response/>")).toBe(0);
    // The same tree as JSON is not an XML response.
    expect(
      skrillAdapter.detect(
        { response: { error: { error_msg: "CANNOT_LOGIN" } } },
        { format: "json" },
      ).confidence,
    ).toBe(0);
    // A free-text error_msg stays below the threshold.
    expect(c(xmlError("Something went wrong"))).toBeLessThan(0.5);
  });

  it("recognizes a prepare response with Verification of Payee but does not analyze it", () => {
    const d = detectText(
      xml(
        "<sid>7e3b9a0c5d1f4e2a8b6c0d9e1f2a3b4c</sid><verificationOfPayee><result>NO_MATCH</result></verificationOfPayee>",
      ),
    );
    expect(d).toMatchObject({ format: "skrill.api.prepare", supported: false });
    const r = analyzeFixture("api-prepare-sid.xml");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "skrill.api.prepare" });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/prepare request/);
    expect(r.events).toEqual([]);
    expect(toJsonReport(r)).not.toContain("7e3b9a0c5d1f4e2a8b6c0d9e1f2a3b4c");
  });
});

describe("skrill XML refund responses", () => {
  it("normalizes a processed refund execution as a refund", () => {
    const r = analyzeFixture("api-refund-processed.xml");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "skrill.api.refund" });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "refund_response.processed",
      eventTypeKnown: true,
      stage: "refund",
      outcome: "success",
      providerStatus: "status=2",
      paymentReference: "PPLsynth300000201",
      merchantReference: "PPLsynth-refund-3001",
      amountMinor: "1000",
      currency: "EUR",
      attributes: {
        operation: "refund",
        statusMeaning: "Refund processed",
        mbTransactionId: "PPLsynth300000201",
        parentReferenceInPayload: false,
      },
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("reads a raw HTTP response with an XML body and keeps a pending refund open", () => {
    const parsed = parseInput(fixture("skrill/api-refund-pending-http.txt"));
    expect(parsed.ok && parsed.value.meta[0]).toMatchObject({
      format: "http",
      xml: { root: "response" },
      http: { kind: "response", status: 200 },
    });
    const r = analyzeFixture("api-refund-pending-http.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "skrill.api.refund" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "refund_response.pending",
      stage: "refund",
      outcome: "pending",
      attributes: { httpStatus: 200, operation: "refund" },
    });
    // The empty <transaction_id/> element is not a reference.
    expect(e.merchantReference).toBeUndefined();
  });

  it("joins the pending refund response with the later refund status report", () => {
    const r = many("api-refund-pending-http.txt", "refund-status-processed.txt");
    expect(r.events.map((e) => e.eventType)).toEqual([
      "refund_response.pending",
      "refund_status.processed",
    ]);
    expect(r.events.every((e) => e.stage === "refund")).toBe(true);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
  });

  it("keeps a failed and an undocumented refund status apart from success", () => {
    const refund = (status: string) =>
      analyze(
        xml(
          `<mb_amount>3</mb_amount><mb_currency>EUR</mb_currency><mb_transaction_id>PPLsynth300000301</mb_transaction_id><status>${status}</status><transaction_id/>`,
        ),
      );
    expect(refund("-2").events[0]).toMatchObject({
      eventType: "refund_response.failed",
      stage: "refund",
      outcome: "failure",
    });
    expect(refund("9").events[0]).toMatchObject({
      eventType: "refund_response.unknown",
      eventTypeKnown: false,
      stage: "refund",
      outcome: "unknown",
    });
  });
});

describe("skrill XML transfer responses", () => {
  it("does not decide between payout and 1-Tap payment for status 2", () => {
    const r = analyzeFixture("api-transfer-processed.xml");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "skrill.api.transaction" });
    expect(r.events[0]).toMatchObject({
      eventType: "api_transaction.processed",
      stage: "other",
      outcome: "success",
      providerStatus: "status=2; status_msg=processed",
      paymentReference: "PPLsynth497029",
      amountMinor: "120",
      currency: "EUR",
      attributes: {
        operation: "not_determinable",
        possibleOperations: ["send_money", "quick_checkout_payout", "one_tap_payment"],
        mbTransactionId: "PPLsynth497029",
        statusMsg: "processed",
      },
    });
    expect(r.errors).toEqual([]);
  });

  it("shows status 1 as a scheduled send money payout and status 0 as a pending payout", () => {
    expect(analyzeFixture("api-send-money-scheduled.xml").events[0]).toMatchObject({
      eventType: "api_transaction.scheduled",
      stage: "payout",
      outcome: "pending",
      amountMinor: "2500",
      attributes: { operation: "send_money" },
    });
    expect(analyzeFixture("api-payout-pending.xml").events[0]).toMatchObject({
      eventType: "api_transaction.pending",
      stage: "payout",
      outcome: "pending",
      attributes: { operation: "quick_checkout_payout" },
    });
  });

  it("keeps a failed transfer open between payout and 1-Tap payment", () => {
    expect(analyze(xmlTransaction("-2")).events[0]).toMatchObject({
      eventType: "api_transaction.failed",
      stage: "other",
      outcome: "failure",
      attributes: { possibleOperations: ["quick_checkout_payout", "one_tap_payment"] },
    });
  });

  it("marks an undocumented status as unknown", () => {
    const r = analyze(xmlTransaction("5", "<status_msg>odd</status_msg>"));
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({
      eventType: "api_transaction.unknown",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.events[0]!.attributes.possibleOperations).toBeUndefined();
  });

  it("joins a pending payout response with its payout status report by the Skrill id", () => {
    const report = post({
      mb_transaction_id: "PPLsynth497033",
      transaction_id: "PPLsynth-payout-0033",
      customer_id: undefined,
      status: "2",
      amount: "80",
      mb_amount: "80",
    });
    const r = analyzeMany(fixture("skrill/api-payout-pending.xml"), report);
    expect(r.events).toHaveLength(2);
    expect(r.groups).toHaveLength(1);
  });
});

describe("skrill XML error responses", () => {
  it("decodes a documented error string", () => {
    const r = analyzeFixture("api-error-balance-not-enough.xml");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "skrill.api.error" });
    expect(r.events[0]).toMatchObject({
      eventType: "api.error",
      stage: "error",
      outcome: "failure",
      providerStatus: "error_msg=BALANCE_NOT_ENOUGH",
      attributes: { code: "BALANCE_NOT_ENOUGH", codeFamily: "api", operation: "unknown" },
    });
    expect(r.errors).toHaveLength(1);
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "BALANCE_NOT_ENOUGH",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      subCodes: { family: "api", field: "error_msg" },
      outcomeKnown: true,
    });
    expect(e.documentation[0]!.url).toMatch(/error-messages$/);
    expect(e.missingInformation.join(" ")).toMatch(/does not say which request/);
  });

  it("decodes wildcard families and the documented spelling variant", () => {
    const wild = analyze(xmlError("MISSING_FRN_TRN_ID"));
    expect(wild.errors[0]).toMatchObject({
      code: "MISSING_FRN_TRN_ID",
      category: "invalid_request",
      subCodes: { pattern: "MISSING_*", parameter: "frn_trn_id" },
    });
    expect(wild.events[0]!.attributes).toMatchObject({
      codePattern: "MISSING_*",
      parameter: "frn_trn_id",
    });
    expect(analyze(xmlError("CC_REFUND_ FAILED")).errors[0]).toMatchObject({
      code: "CC_REFUND_FAILED",
      confidence: "possible",
    });
    expect(analyze(xmlError("SESSION_EXPIRED")).errors[0]!.retry).toBe(
      "safe_to_retry_technical_request",
    );
  });

  it("keeps an undocumented error string unknown", () => {
    const r = analyzeFixture("api-error-undocumented.xml");
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]!.attributes.codeFamily).toBeUndefined();
    expect(r.errors[0]).toMatchObject({
      code: "PPLSYNTH_UNDOCUMENTED_ERROR",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it("reads an XML error inside a raw HTTP response", () => {
    const r = analyze(
      `HTTP/1.1 200 OK\nContent-Type: text/xml;charset=UTF-8\n\n${xmlError("CANNOT_LOGIN")}`,
    );
    expect(r.errors[0]).toMatchObject({
      code: "CANNOT_LOGIN",
      category: "authentication_failed",
      subCodes: { httpStatus: "200" },
    });
  });

  it("never shows a free-text error_msg", () => {
    const text = xmlError("Contact planted.person@example.com about PPLsynth-order-5150");
    expect(analyze(text).records[0]!.status).toBe("unsupported");
    const r = analyze(text, { provider: "skrill" });
    expect(r.errors[0]).toMatchObject({ code: "unrecognized", confidence: "insufficient" });
    const report = toJsonReport(r);
    for (const out of [JSON.stringify(r.events), JSON.stringify(r.errors), report]) {
      expect(out).not.toContain("planted.person@example.com");
      expect(out).not.toContain("PPLsynth-order-5150");
    }
  });
});

describe("skrill MQI plain-text errors", () => {
  it("stays below the threshold unless Skrill is selected", () => {
    const d = detectText(fixture("skrill/mqi-error-transaction-not-found.txt"));
    expect(d).toMatchObject({ format: "skrill.mqi.http_error", supported: true });
    expect(d.confidence).toBeGreaterThan(0);
    expect(d.confidence).toBeLessThan(0.5);
    const auto = analyzeFixture("mqi-error-transaction-not-found.txt");
    expect(auto.records[0]!.status).toBe("unsupported");
    expect(auto.events).toEqual([]);
  });

  it("decodes the HTTP status when Skrill is selected", () => {
    const r = analyze(fixture("skrill/mqi-error-transaction-not-found.txt"), {
      provider: "skrill",
    });
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "skrill.mqi.http_error" });
    expect(r.events[0]).toMatchObject({
      eventType: "mqi.http_error",
      stage: "error",
      outcome: "failure",
      attributes: { httpStatus: 403, transactionNotFound: true },
    });
    expect(r.errors[0]).toMatchObject({
      code: "403",
      category: "invalid_request",
      confidence: "possible",
      providerMessage: "Transaction not found",
      subCodes: { family: "mqi_http", reason: "transaction_not_found" },
    });
    const report = toJsonReport(r);
    for (const out of [JSON.stringify(r.events), JSON.stringify(r.errors), report])
      expect(out).not.toContain("PPLsynth-order-4040");
  });

  it("claims only documented MQI statuses with a body", () => {
    const c = (text: string) => detectText(text).confidence;
    expect(c("HTTP/1.1 401 Unauthorized\nContent-Type: text/html\n\nCannot login")).toBe(0.3);
    expect(c("HTTP/1.1 500 Internal Server Error\nContent-Type: text/html\n\nOops")).toBe(0);
    expect(c("HTTP/1.1 403 Forbidden\n\n")).toBe(0);
  });
});

describe("skrill XML redaction and cross-provider detection", () => {
  it("keeps session ids, echoed merchant fields and MQI ids out of events and reports", () => {
    const planted = [
      "7e3b9a0c5d1f4e2a8b6c0d9e1f2a3b4c",
      "PPLsynth Planted Note",
      "PPLsynth-order-4040",
      "planted.payee@example.com",
    ];
    const r = analyzeMany(
      ...XML_FIXTURES.map((f) => fixture(`skrill/${f}`)),
      fixture("skrill/mqi-error-transaction-not-found.txt"),
      xml(
        "<mb_amount>1</mb_amount><mb_currency>EUR</mb_currency><mb_transaction_id>PPLsynth300000401</mb_transaction_id><payee_email>planted.payee@example.com</payee_email><status>2</status><transaction_id/>",
      ),
    );
    expect(r.events.length).toBeGreaterThanOrEqual(8);
    const events = JSON.stringify(r.events);
    const errors = JSON.stringify(r.errors);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(errors, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
  });

  it("is not claimed by any other registered adapter", () => {
    const others = ADAPTERS.filter((a) => a.id !== "skrill");
    expect(others.length).toBeGreaterThan(10);
    const texts: [string, string][] = [
      ...XML_FIXTURES.map((f): [string, string] => [f, fixture(`skrill/${f}`)]),
      [
        "mqi-error-transaction-not-found.txt",
        fixture("skrill/mqi-error-transaction-not-found.txt"),
      ],
      ["transfer -2", xmlTransaction("-2")],
      ["wildcard error", xmlError("MISSING_FRN_TRN_ID")],
    ];
    for (const [name, text] of texts) {
      const parsed = parseInput(text);
      if (!parsed.ok) throw new Error(parsed.error.message);
      parsed.value.records.forEach((record, i) => {
        for (const a of others) {
          const d = a.detect(record, parsed.value.meta[i]);
          expect(d.confidence, `${a.id} on ${name}`).toBeLessThan(0.5);
        }
      });
      const r = analyzeText(text, { ...options, adapters: ADAPTERS });
      expect(r.ok).toBe(true);
      if (r.ok)
        for (const rec of r.result.records) expect([null, "skrill"]).toContain(rec.provider);
    }
  });
});
