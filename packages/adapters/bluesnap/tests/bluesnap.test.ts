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
import {
  ACH_RETURN_CODES,
  ALT_TRANSACTION_ERRORS,
  AVS_CODES,
  BATCH_ERRORS,
  BLUESNAP_ADAPTER_VERSION,
  BLUESNAP_FORMATS,
  CARD_TRANSACTION_ERRORS,
  CARD_TRANSACTION_TYPES,
  CVV_CODES,
  ERROR_TABLES,
  ERRORS_BY_NAME,
  FRAUD_ERRORS,
  FRAUD_EVENT_CODES,
  HOSTED_PAYMENT_FIELDS_ERRORS,
  IDEMPOTENCY_ERRORS,
  KOUNT_RESPONSE_KEYS,
  MARKETPLACE_ERRORS,
  REFUND_ERRORS,
  SUBSCRIPTION_ERRORS,
  SURCHARGE_ERRORS,
  THREE_DS_ERRORS,
  THREE_DS_RESULTS,
  THROTTLING_MESSAGES,
  VAULTED_SHOPPER_ERRORS,
  WALLET_ERRORS,
  WEBHOOK_TYPES,
  bluesnapAdapter,
  bluesnapManifest,
  webhookName,
} from "@pandapaylens/bluesnap";
import defaultExport from "@pandapaylens/bluesnap";
import { bluesnapManifest as manifestOnly } from "@pandapaylens/bluesnap/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [bluesnapAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`bluesnap/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const errorBody = (...message: Record<string, unknown>[]) => ({ message });
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const httpJson = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");
const httpText = (status: number, text: string) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: text/plain", "", text].join("\n");

const ANCHORS = "bluesnapNode=99&plimusNode=99&contractId=PPLsynthC1";
const form = (fields: string) => `${fields}&${ANCHORS}`;

const DASHES = new RegExp(String.fromCharCode(0x2013) + "|" + String.fromCharCode(0x2014));
const ROOT = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const OWN = `${ROOT}bluesnap`;

// ---------------------------------------------------------------------------

describe("bluesnap catalog", () => {
  it("has the documented row counts per table", () => {
    expect(CARD_TRANSACTION_ERRORS.rows).toHaveLength(74);
    expect(ALT_TRANSACTION_ERRORS.rows).toHaveLength(27);
    expect(REFUND_ERRORS.rows).toHaveLength(16);
    expect(FRAUD_ERRORS.rows).toHaveLength(2);
    expect(IDEMPOTENCY_ERRORS.rows).toHaveLength(5);
    expect(SUBSCRIPTION_ERRORS.rows).toHaveLength(40);
    expect(SURCHARGE_ERRORS.rows).toHaveLength(8);
    expect(BATCH_ERRORS.rows).toHaveLength(11);
    expect(MARKETPLACE_ERRORS.rows).toHaveLength(16);
    expect(VAULTED_SHOPPER_ERRORS.rows).toHaveLength(4);
    expect(WALLET_ERRORS.rows).toHaveLength(14);
    expect(HOSTED_PAYMENT_FIELDS_ERRORS.rows).toHaveLength(4);
    expect(THREE_DS_ERRORS.rows).toHaveLength(4);
  });

  it("totals 225 error rows, 227 with Kount keys and 248 with ACH return codes", () => {
    const rows = ERROR_TABLES.reduce((n, t) => n + t.rows.length, 0);
    expect(rows).toBe(225);
    expect(Object.keys(KOUNT_RESPONSE_KEYS)).toHaveLength(2);
    expect(Object.keys(ACH_RETURN_CODES)).toHaveLength(21);
    expect(rows + 2 + 21).toBe(248);
  });

  it("lists 37 card error names under 14002 and the JSON-only rows", () => {
    const shared = CARD_TRANSACTION_ERRORS.rows.filter((r) => r.code === "14002");
    expect(new Set(shared.map((r) => r.name)).size).toBe(37);
    expect(CARD_TRANSACTION_ERRORS.rows.filter((r) => r.code === "10001")).toHaveLength(5);
    expect(CARD_TRANSACTION_ERRORS.rows.filter((r) => r.jsonOnly).map((r) => r.name)).toEqual([
      "BLS_NO_SUCH_SHOPPER_PAYMENT_METHOD",
      "NEW_ACCOUNT_INFORMATION_AVAILABLE",
      "PROCESSING_TRANSACTION_NOT_AUTHORIZED",
      "PAYMENT_METHOD_LIMIT_REACHED",
    ]);
  });

  it("has the documented value sets", () => {
    expect(Object.keys(WEBHOOK_TYPES)).toHaveLength(34);
    expect(Object.keys(CARD_TRANSACTION_TYPES)).toHaveLength(5);
    expect(FRAUD_EVENT_CODES).toHaveLength(18);
    expect(Object.keys(CVV_CODES)).toHaveLength(6);
    expect(Object.keys(AVS_CODES)).toHaveLength(3);
    expect(THREE_DS_RESULTS.size).toBe(5);
    expect(Object.keys(THROTTLING_MESSAGES)).toHaveLength(5);
  });

  it("gives every row a valid code and documentation URL", () => {
    for (const t of ERROR_TABLES) {
      expect(t.url).toMatch(/^https:\/\/developers\.bluesnap\.com\//);
      for (const r of t.rows) {
        expect(r.name === null || /^[A-Z][A-Z0-9_]+$/.test(r.name)).toBe(true);
        expect(r.code === null || /^\d{1,5}(?:\/\d+)?$/.test(r.code)).toBe(true);
      }
    }
    expect(ERRORS_BY_NAME.get("NO_AVAILABLE_PROCESSORS")).toHaveLength(3);
  });

  it("maps webhook display names to their codes", () => {
    expect(webhookName("Charge")).toBe("CHARGE");
    expect(webhookName("Fraud Decline")).toBe("FRAUD_DECLINE");
    expect(webhookName("CHARGEBACK_STATUS_CHANGED")).toBe("CHARGEBACK_STATUS_CHANGED");
  });

  it("uses no em or en dash in sources or fixtures", () => {
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    const files = [
      ...readdirSync(src).map((f) => `${src}${f}`),
      ...readdirSync(OWN).map((f) => `${OWN}/${f}`),
      fileURLToPath(import.meta.url),
    ];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(DASHES);
  });
});

describe("bluesnap manifest and exports", () => {
  it("is honest about its status", () => {
    expect(bluesnapManifest).toMatchObject({
      id: "bluesnap",
      wave: 3,
      researchStatus: "tested",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      documentationAccess: "public",
      version: BLUESNAP_ADAPTER_VERSION,
    });
    expect(bluesnapManifest.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "limited",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "limited",
      diagnosticRules: "limited",
    });
    expect(bluesnapManifest.delivery).toMatchObject({
      duplicatesDocumented: true,
      ordering: "not_documented",
    });
    for (const s of bluesnapManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/www\.bluesnap\.com\//);
    expect(bluesnapManifest.dependencies?.some((d) => d.includes("Payroc"))).toBe(true);
  });

  it("exports the adapter, default and manifest entry", () => {
    expect(defaultExport).toBe(bluesnapAdapter);
    expect(manifestOnly).toBe(bluesnapManifest);
    expect(bluesnapAdapter.manifest).toBe(bluesnapManifest);
    expect(bluesnapAdapter.supportedFormats.map((f) => f.id)).toEqual([
      BLUESNAP_FORMATS.cardTransaction,
      BLUESNAP_FORMATS.refund,
      BLUESNAP_FORMATS.error,
      BLUESNAP_FORMATS.webhook,
      BLUESNAP_FORMATS.throttling,
    ]);
  });
});

// ---------------------------------------------------------------------------

describe("bluesnap detection", () => {
  it.each([
    [
      {
        cardTransactionType: "AUTH_CAPTURE",
        transactionId: "PPLsynth1",
        processingInfo: { processingStatus: "SUCCESS" },
      },
      BLUESNAP_FORMATS.cardTransaction,
      0.75,
    ],
    [{ refundTransactionId: "PPLsynthR1", refundStatus: "SUCCESS" }, BLUESNAP_FORMATS.refund, 0.65],
    [
      errorBody({ errorName: "DO_NOT_HONOR", code: 14002, description: "x" }),
      BLUESNAP_FORMATS.error,
      0.9,
    ],
    [errorBody({ errorName: "SOMETHING_NEW", code: 1 }), BLUESNAP_FORMATS.error, 0.6],
  ])("detects %j", (input, format, confidence) => {
    expect(bluesnapAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("detects form webhooks by documented anchors", () => {
    const parsed = parseInput(fixture("bluesnap/webhook-charge.txt"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(bluesnapAdapter.detect(parsed.value.records[0], parsed.value.meta[0])).toMatchObject({
      format: BLUESNAP_FORMATS.webhook,
      confidence: 0.95,
      supported: true,
    });
    const minimal = {
      transactionType: "CHARGE",
      referenceNumber: "PPLsynth1",
      contractId: "PPLsynthC1",
    };
    expect(bluesnapAdapter.detect(minimal, { format: "form" }).confidence).toBe(0.6);
  });

  it("recognizes alt transactions without analyzing them", () => {
    const r = bluesnapAdapter.detect(JSON.parse(fixture("bluesnap/alt-transaction-ecp.json")));
    expect(r).toMatchObject({ format: BLUESNAP_FORMATS.altTransaction, supported: false });
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.unsupportedReason).toMatch(/not analyzed/);
  });

  it("uses the security headers only as supporting evidence", () => {
    const meta: RecordMeta = {
      format: "http",
      http: { kind: "request", method: "POST", headers: { "bls-signature": "[redacted]" } },
    };
    const r = bluesnapAdapter.detect(
      { transactionType: "CHARGE", referenceNumber: "PPLsynth1", bluesnapNode: "99" },
      meta,
    );
    expect(r.reasons).toContain("has a Bls-Signature or Bls-Ipn-Timestamp header");
    expect(bluesnapAdapter.detect({ transactionType: "CHARGE" }, meta).confidence).toBe(0);
  });

  it.each([
    { message: "x" },
    { message: [{ errorName: "DO_NOT_HONOR" }] },
    { message: [{ errorName: "do_not_honor", code: 14002 }] },
    { message: [{ code: 14002, description: "x" }] },
    { errorName: "DO_NOT_HONOR", message: "x" },
    { error: { message: "x" } },
    { status: "SUCCESS" },
    { cardTransactionType: "AUTH_CAPTURE" },
    { cardTransactionType: "AUTH_CAPTURE", amount: 10, currency: "USD" },
    { refundTransactionId: "PPLsynthR1" },
    { refundTransactionId: "PPLsynthR1", amount: 1, currency: "USD" },
    { transactionId: "PPLsynth1", processingInfo: { processingStatus: "SUCCESS" } },
    { transactionType: "CHARGE" },
    { transactionType: "CHARGE", referenceNumber: "PPLsynth1" },
    { transactionType: "Sale", referenceNumber: "PPLsynth1", bluesnapNode: "99" },
    { transactionType: "AUTH", status: "APPROVED" },
    { processingInfo: { processingStatus: "PENDING" }, payerInfo: {} },
  ])("does not claim the generic shape %j above 0.5", (input) => {
    expect(bluesnapAdapter.detect(input).confidence).toBeLessThanOrEqual(0.5);
  });

  it("ignores Stripe objects, arrays, scalars and form records with JSON shapes", () => {
    const card = { cardTransactionType: "AUTH_CAPTURE", transactionId: "PPLsynth1" };
    expect(bluesnapAdapter.detect({ object: "charge", ...card }).confidence).toBe(0);
    expect(bluesnapAdapter.detect([card]).confidence).toBe(0);
    expect(bluesnapAdapter.detect("CHARGE").confidence).toBe(0);
    expect(bluesnapAdapter.detect(null).confidence).toBe(0);
    expect(
      bluesnapAdapter.detect({ ...card, processingInfo: "x" }, { format: "form" }).confidence,
    ).toBe(0);
  });

  it("claims an empty error record only with a documented throttling message", () => {
    const meta = (status: number, bodyText?: string): RecordMeta => ({
      format: "http",
      http: { kind: "response", status, headers: {}, ...(bodyText ? { bodyText } : {}) },
    });
    expect(
      bluesnapAdapter.detect({}, meta(429, "Client request rate is too high")).confidence,
    ).toBe(0.6);
    expect(
      bluesnapAdapter.detect({}, meta(503, "Service is temporarily unavailable.")).confidence,
    ).toBe(0.6);
    expect(bluesnapAdapter.detect({}, meta(429, "Too many requests")).confidence).toBe(0);
    expect(
      bluesnapAdapter.detect({}, meta(400, "Client request rate is too high")).confidence,
    ).toBe(0);
    expect(bluesnapAdapter.detect({}, meta(429)).confidence).toBe(0);
    expect(bluesnapAdapter.detect({}).confidence).toBe(0);
  });

  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(ROOT).filter(
    (d) =>
      d !== "bluesnap" &&
      statSync(`${ROOT}${d}`).isDirectory() &&
      readdirSync(`${ROOT}${d}`).length > 0,
  );

  it("includes the Stripe and Adyen fixtures", () => {
    expect(dirs).toEqual(
      expect.arrayContaining(["stripe", "adyen", "ccbill", "segpay", "netbilling", "nuvei"]),
    );
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    let checked = 0;
    for (const file of readdirSync(`${ROOT}${dir}`)) {
      const parsed = parseInput(readFileSync(`${ROOT}${dir}/${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          bluesnapAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("is the only registered adapter that claims the BlueSnap fixtures", () => {
    for (const file of readdirSync(OWN)) {
      const r = analyzeText(readFileSync(`${OWN}/${file}`, "utf8"), {
        ...options,
        adapters: ADAPTERS,
        rules: [],
      });
      expect(r.ok, file).toBe(true);
      if (!r.ok) continue;
      for (const rec of r.result.records) {
        expect(rec.provider, file).toBe("bluesnap");
        expect(rec.alternatives, file).toEqual([]);
      }
    }
  });

  it("analyzes every BlueSnap fixture", () => {
    const expected: Record<string, string> = {
      "missing-fields.json": "invalid",
      "alt-transaction-ecp.json": "unsupported",
    };
    // These bodies carry no identifiers at all.
    const noIds = new Set([
      "decline-do-not-honor.txt",
      "validation-errors.txt",
      "soft-decline-3ds-required.json",
      "processing-timeout.txt",
      "idempotency-in-progress.txt",
      "rate-limit-429.txt",
    ]);
    for (const file of readdirSync(OWN)) {
      const text = readFileSync(`${OWN}/${file}`, "utf8");
      const r = analyze(text);
      for (const rec of r.records)
        expect(rec.status, `${file} record ${rec.recordIndex}`).toBe(expected[file] ?? "analyzed");
      if (!noIds.has(file)) expect(text, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});

// ---------------------------------------------------------------------------

describe("bluesnap card transactions and refunds", () => {
  it("normalizes a successful Auth Capture", () => {
    const r = analyzeFixture("auth-capture-success.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      sourceFormat: BLUESNAP_FORMATS.cardTransaction,
      eventType: "card_transaction.AUTH_CAPTURE",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "success",
      paymentReference: "PPLsynth1000000001",
      merchantReference: "PPLsynth-order-0001",
      amountMinor: "1100",
      currency: "USD",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      cvvResponseCode: "MA",
      avsResponseCodeZip: "U",
      transactionRegion: "US",
      cardBrand: "VISA",
      issuingCountryCode: "US",
      authorizationCodePresent: true,
      approvalDateAsSent: "10/24/2026",
      approvalTimePacific: "13:08:47",
      usdAmountMinor: "1100",
    });
    // Approval time is Pacific time without a zone, so it is not event time.
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("links Auth Only, Capture and the refunds list of a retrieved transaction", () => {
    const r = analyzeFixture("auth-only-capture-refund.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.amountMinor])).toEqual([
      ["card_transaction.AUTH_ONLY", "authorization", "success", "2550"],
      ["card_transaction.CAPTURE", "capture", "success", "2550"],
      ["card_transaction.REFUND", "refund", "success", undefined],
      ["card_transaction.refund", "refund", "unknown", "1000"],
    ]);
    expect(r.events[3]).toMatchObject({ relatedReference: "PPLsynthR000000002", currency: "EUR" });
    expect(r.events[3]!.source.path).toBe("refunds.refund[0]");
    expect(r.events[2]!.attributes).toMatchObject({ refundsBalanceMinor: "1550", refundCount: 1 });
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("shows an Auth Reversal as a void of the same authorization", () => {
    const r = analyzeFixture("auth-only-reversal.json");
    expect(r.events.map((e) => [e.stage, e.outcome])).toEqual([
      ["authorization", "success"],
      ["void", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
  });

  it("keeps a transaction under merchant review pending", () => {
    const r = analyzeFixture("pending-merchant-review.json");
    expect(r.events[0]).toMatchObject({
      outcome: "pending",
      providerStatus: "PENDING_MERCHANT_REVIEW",
      amountMinor: "9999",
    });
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("reads the original transaction of a transaction retrieved by refund ID", () => {
    const e = analyze(
      json({
        cardTransactionType: "REFUND",
        transactionId: "PPLsynthR9",
        originalTransactionId: "PPLsynth9",
        processingInfo: { processingStatus: "SUCCESS" },
      }),
    ).events[0]!;
    expect(e).toMatchObject({
      paymentReference: "PPLsynth9",
      relatedReference: "PPLsynthR9",
      stage: "refund",
    });
    expect(
      bluesnapAdapter.correlationKeys({ ...e, id: "ev-1", provider: "bluesnap", sourceIndex: 0 }),
    ).toEqual(["txn:PPLsynth9", "reversal:PPLsynthR9"]);
  });

  it("emits chargebacks of a retrieved transaction as disputes with an unknown outcome", () => {
    const r = analyze(
      json({
        cardTransactionType: "AUTH_CAPTURE",
        transactionId: "PPLsynth10",
        amount: "20.00",
        currency: "JPY",
        processingInfo: { processingStatus: "SUCCESS" },
        chargebacks: {
          chargeback: {
            chargebackTransactionId: "PPLsynthCB10",
            amount: 20,
            currency: "JPY",
            date: "2026-10-20",
          },
        },
      }),
    );
    expect(r.events[1]).toMatchObject({
      stage: "dispute",
      outcome: "unknown",
      amountMinor: "20",
      relatedReference: "PPLsynthCB10",
    });
    // JPY has no minor unit, so "20.00" is read as 20.
    expect(r.events[0]!.amountMinor).toBe("20");
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
  });

  it("keeps an unknown cardTransactionType and processingStatus honest", () => {
    const e = analyze(
      json({
        cardTransactionType: "SOMETHING_NEW",
        transactionId: "PPLsynth11",
        processingInfo: { processingStatus: "WEIRD" },
      }),
    ).events[0]!;
    expect(e).toMatchObject({ eventTypeKnown: false, outcome: "unknown", providerStatus: "WEIRD" });
  });

  it("reads a pending refund response", () => {
    const r = analyzeFixture("refund-pending.json");
    expect(r.events[0]).toMatchObject({
      sourceFormat: BLUESNAP_FORMATS.refund,
      stage: "refund",
      outcome: "pending",
      relatedReference: "PPLsynthR000000005",
      amountMinor: "500",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("links a refund response to its REFUND webhook through the refund ID", () => {
    const r = analyze(
      json([
        { refundTransactionId: "PPLsynthR12", refundStatus: "SUCCESS", amount: 5, currency: "USD" },
        {
          transactionType: "REFUND",
          referenceNumber: "PPLsynth12",
          reversalRefNum: "PPLsynthR12",
          bluesnapNode: "1",
          contractId: "PPLsynthC1",
        },
      ]),
    );
    expect(r.records.map((x) => x.format)).toEqual([
      BLUESNAP_FORMATS.refund,
      BLUESNAP_FORMATS.webhook,
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.eventIds).toHaveLength(2);
  });

  it("keeps unrelated transactions apart even with a shared merchant reference", () => {
    const r = analyzeFixture("unrelated-transactions.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.every((e) => e.merchantReference === "PPLsynth-order-shared")).toBe(true);
  });

  it("reports missing or mistyped required fields as parse issues", () => {
    const r = analyzeFixture("missing-fields.json");
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/processingInfo\.processingStatus/);
    expect(r.events).toEqual([]);
    const bad = analyze(
      json({ refundTransactionId: "PPLsynthR13", refundStatus: 5, cancelSubscriptions: true }),
    );
    expect(bad.records[0]!.status).toBe("invalid");
  });
});

// ---------------------------------------------------------------------------

describe("bluesnap error bodies", () => {
  it("decodes the documented DO_NOT_HONOR decline and keeps the processor text as provider text", () => {
    const r = analyzeFixture("decline-do-not-honor.txt");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 400",
      eventType: "error.DO_NOT_HONOR",
    });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "DO_NOT_HONOR",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: { bluesnap_code: "14002", http_status: "400", error_table: "card" },
    });
    expect(e.providerMessage).toContain("530 - This transaction has been declined");
    expect(Object.values(e.subCodes)).not.toContain("530");
    expect(e.retryExplanation).toContain("retry after 24 hours");
    expect(e.missingInformation.join(" ")).toMatch(/processor/);
    expect(e.documentation.map((d) => d.url)).toContain(
      "https://support.bluesnap.com/docs/understanding-your-declined-authorizations",
    );
  });

  it("lets errorName, not the shared code, decide the meaning", () => {
    const decode = (errorName: string) => firstError(errorBody({ errorName, code: 14002 }));
    expect(decode("INSUFFICIENT_FUNDS").category).toBe("insufficient_funds");
    expect(decode("CARD_LOST_OR_STOLEN")).toMatchObject({
      category: "fraud_or_risk",
      retry: "do_not_retry",
    });
    expect(decode("THREE_D_SECURITY_AUTHENTICATION_REQUIRED").category).toBe(
      "authentication_required",
    );
    expect(decode("PROCESSING_DUPLICATE").category).toBe("duplicate_request");
    expect(decode("INVALID_CC_NUMBER")).toMatchObject({
      category: "card_declined",
      subCodes: { error_table: "hosted_payment_fields" },
    });
  });

  it("decodes a soft decline that calls for 3-D Secure", () => {
    const e = analyzeFixture("soft-decline-3ds-required.json").errors[0]!;
    expect(e).toMatchObject({
      category: "authentication_required",
      retry: "customer_action_required",
      confidence: "strong",
    });
  });

  it("lowers confidence when the code does not match the documented name", () => {
    const e = firstError(errorBody({ errorName: "DO_NOT_HONOR", code: 10001 }));
    expect(e).toMatchObject({ category: "card_declined", confidence: "possible" });
    expect(e.missingInformation.join(" ")).toMatch(/not documented with code 10001/);
  });

  it("uses the card reading with possible confidence when tables disagree", () => {
    const e = firstError(errorBody({ errorName: "NO_AVAILABLE_PROCESSORS", code: 14016 }));
    expect(e).toMatchObject({
      category: "configuration",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(e.explanation).toMatch(/surcharge/);
    const same = firstError(errorBody({ errorName: "MISSING_CARD_TYPE", code: 90 }));
    expect(same.confidence).toBe("strong");
    const agree = firstError(errorBody({ errorName: "VALIDATION_GENERAL_FAILURE", code: 10001 }));
    expect(agree.confidence).toBe("strong");
  });

  it("decodes rows without a code and codes without a name", () => {
    expect(
      firstError(errorBody({ errorName: "MISSING_ARGUMENTS", description: "x" })),
    ).toMatchObject({
      category: "invalid_request",
      confidence: "strong",
    });
    const byCode = firstError(errorBody({ errorName: "REFUND_TOO_SMALL", code: 14005 }));
    expect(byCode).toMatchObject({
      category: "invalid_amount",
      confidence: "possible",
      code: "REFUND_TOO_SMALL",
    });
    expect(byCode.explanation).toMatch(/REFUND_MIN_AMOUNT_FAILURE/);
  });

  it("keeps an unrecognized errorName on a shared code honest", () => {
    const r = analyzeFixture("unknown-error-name.json");
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.explanation).toMatch(/shared by \d+ documented error names/);
    expect(r.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("falls back to the HTTP status for an unknown name and code", () => {
    const at = (status: number) =>
      analyze(httpJson(status, errorBody({ errorName: "PPLSYNTH_NEW", code: 99999 }))).errors[0]!;
    expect(at(403)).toMatchObject({
      category: "configuration",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(at(422)).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(at(400)).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
      outcomeKnown: true,
    });
    expect(at(500)).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(at(500).outcomeKnown).toBeUndefined();
  });

  it("decodes each message of a validation error and never reads the rejected value", () => {
    const r = analyzeFixture("validation-errors.txt");
    expect(r.errors.map((e) => [e.code, e.source.path])).toEqual([
      ["VALIDATION_GENERAL_FAILURE", "message[0]"],
      ["INVALID_MERCHANT_TRANSACTION_ID", "message[1]"],
    ]);
    expect(r.errors[0]!.subCodes.invalid_property).toBe("cardHolderInfo.zip");
    expect(r.events[0]!.attributes.invalidProperties).toEqual(["cardHolderInfo.zip"]);
    expect(json(r)).not.toContain("PLANTEDZIP99");
    expect(toJsonReport(r)).not.toContain("PLANTEDZIP99");
  });

  it("reads fraud events case-insensitively", () => {
    const r = analyzeFixture("fraud-detected.json");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "FRAUD_DETECTED",
      category: "fraud_or_risk",
      retry: "manual_review",
      subCodes: {
        fraud_event_codes: "blacklistShippingCountryDecline,AVS_ZIP_MISMATCH",
        fraud_decisions: "D,R",
      },
    });
    expect(e.explanation).toMatch(
      /blacklistShippingCountryDecline \(declined\), AVS_ZIP_MISMATCH \(held for review\)/,
    );
    expect(r.events[0]!.attributes.fraudReferenceId).toBe("PPLsynthFRAUD0001");
    const unlisted = firstError(
      errorBody({
        errorName: "FRAUD_DETECTED",
        code: 15011,
        fraudEvents: {
          fraudEvent: { fraudEventCode: "billShipAddressNotMatchDecline", fraudEventDecision: "R" },
        },
      }),
    );
    expect(unlisted.missingInformation.join(" ")).toMatch(/billShipAddressNotMatchDecline/);
    expect(unlisted.explanation).toMatch(/hold the order for review/);
  });

  it("treats a processing timeout as an unknown outcome", () => {
    const r = analyzeFixture("processing-timeout.txt");
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(r.errors[0]).toMatchObject({
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/may or may not have taken effect/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("does not count a definitive issuer answer as an unknown outcome", () => {
    const r = analyze(
      json(errorBody({ errorName: "THE_ISSUER_IS_UNAVAILABLE_OR_OFFLINE", code: 14002 })),
    );
    expect(r.errors[0]).toMatchObject({ category: "provider_unavailable", outcomeKnown: true });
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("reads an idempotency conflict", () => {
    const r = analyzeFixture("idempotency-in-progress.txt");
    expect(r.errors[0]).toMatchObject({
      category: "duplicate_request",
      retry: "retry_conditionally",
      subCodes: { http_status: "409" },
    });
    expect(r.events[0]!.outcome).toBe("unknown");
  });

  it("decodes documented throttling messages", () => {
    const r = analyzeFixture("rate-limit-429.txt");
    expect(r.records[0]!.format).toBe(BLUESNAP_FORMATS.throttling);
    expect(r.errors[0]).toMatchObject({
      code: "HTTP 429",
      category: "rate_limiting",
      retry: "retry_conditionally",
    });
    const busy = analyze(httpText(503, "Service is temporarily unavailable"));
    expect(busy.errors[0]).toMatchObject({ category: "provider_unavailable" });
    expect(ruleIds(busy)).toContain("POSSIBLE_RETRY_RISK");
    const other = analyzeText(httpText(429, "slow down"), options);
    expect(other.ok && other.result.records[0]!.status).toBe("unsupported");
  });
});

// ---------------------------------------------------------------------------

describe("bluesnap webhooks", () => {
  it("normalizes a CHARGE webhook", () => {
    const r = analyzeFixture("webhook-charge.txt");
    expect(r.events[0]).toMatchObject({
      sourceFormat: BLUESNAP_FORMATS.webhook,
      eventType: "CHARGE",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      paymentReference: "PPLsynth1000000014",
      merchantReference: "PPLsynth-order-0014",
      amountMinor: "3000",
      currency: "USD",
      deliveryKey: "CHARGE|PPLsynth1000000014|||10/24/2026 07:34 AM",
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      transactionDateAsSent: "10/24/2026 07:34 AM",
      dataCenter: "sandbox",
      testMode: "N",
      paymentMethod: "CC",
      cardBrand: "VISA",
      authKeyStatus: "empty",
      cvvResponse: "Not processed",
    });
  });

  it("accepts display names in transactionType", () => {
    const e = analyze(form("transactionType=Charge&referenceNumber=PPLsynth30")).events[0]!;
    expect(e).toMatchObject({ eventType: "Charge", eventTypeKnown: true, stage: "payment" });
    expect(e.attributes.webhookName).toBe("CHARGE");
  });

  it("groups a charge, refund and chargeback lifecycle by referenceNumber", () => {
    const r = analyzeFixture("webhook-lifecycle.txt");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus])).toEqual([
      ["CHARGE", "payment", "success", "CHARGE"],
      ["REFUND", "refund", "success", "REFUND"],
      ["CHARGEBACK", "dispute", "unknown", "New"],
      ["CHARGEBACK_STATUS_CHANGED", "dispute", "unknown", "Completed_Won"],
    ]);
    expect(r.events[0]!.amountMinor).toBe("125000");
    expect(r.events[1]!.relatedReference).toBe("PPLsynthR000000015");
    expect(r.events[1]!.amountMinor).toBeUndefined();
    expect(r.events[1]!.attributes).toMatchObject({
      reversalAmount: "250.00",
      relatedReferenceKind: "refund",
    });
    expect(r.events[3]!.attributes).toMatchObject({
      chargebackCycle: "first chargeback",
      chargebackStatus: "Completed_Won",
    });
    expect(r.events[2]!.attributes.chargebackDateDue).toBe("2026-10-30");
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toEqual(["CHARGEBACK_REPORTED"]);
  });

  it("reports duplicate deliveries", () => {
    const r = analyzeFixture("webhook-duplicate-delivery.txt");
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    expect(ruleIds(r)).toEqual(["DUPLICATE_DELIVERY"]);
    expect(r.findings[0]!.explanation).toMatch(/BlueSnap documents/);
  });

  it("sets no delivery key without a referenceNumber and transactionDate", () => {
    const e = analyze(form("transactionType=CHARGE&referenceNumber=PPLsynth31")).events[0]!;
    expect(e.deliveryKey).toBeUndefined();
  });

  it("links a subscription's charges, failure and cancellation", () => {
    const r = analyzeFixture("webhook-subscription.txt");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.isRecurring])).toEqual([
      ["CHARGE", "payment", "success", undefined],
      ["RECURRING", "payment", "success", true],
      ["SUBSCRIPTION_CHARGE_FAILURE", "payment", "failure", true],
      ["CANCELLATION", "cancellation", "success", undefined],
    ]);
    expect(r.events[1]!.attributes.originalTransactionId).toBe("PPLsynth1000000017");
    expect(r.events.every((e) => e.subscriptionReference === "PPLsynthSUB0017")).toBe(true);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toContain("RECURRING_PAYMENT_FAILED");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      confidence: "possible",
      subCodes: { error_processing_code: "14002", source_field: "failureReason" },
    });
    expect(e.retryExplanation).toMatch(
      /numberOfAttemptsDone is 1, lastAttempt is N, daysTillCancelDate is 7/,
    );
    expect(e.missingInformation.join(" ")).toMatch(/retry schedule/);
  });

  it("decodes a DECLINE reason and a FRAUD_DECLINE", () => {
    const r = analyzeFixture("webhook-decline.txt");
    expect(r.errors.map((e) => [e.code, e.category, e.confidence])).toEqual([
      ["DO_NOT_HONOR", "card_declined", "possible"],
      ["FRAUD_DECLINE", "fraud_or_risk", "strong"],
    ]);
    expect(r.errors[0]).toMatchObject({
      paymentReference: "PPLsynth1000000019",
      attemptReference: "PPLsynth1000000019",
    });
    expect(r.events[1]!.attributes.threeDSecureStatus).toBe("AUTHENTICATION_SUCCEEDED");
  });

  it("leaves a free-text decline reason undecoded", () => {
    const e = analyze(
      form("transactionType=DECLINE&referenceNumber=PPLsynth32&declineReason=Something+else"),
    ).errors[0]!;
    expect(e).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "Something else",
    });
    const none = analyze(form("transactionType=DECLINE&referenceNumber=PPLsynth33")).errors[0]!;
    expect(none.code).toBe("no_reason");
  });

  it("decodes ACH return codes from reason fields", () => {
    const r = analyzeFixture("webhook-ach-return.txt");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["CHARGE_PENDING", "pending"],
      ["DECLINE", "failure"],
      ["CANCELLATION", "success"],
    ]);
    expect(r.errors.map((e) => [e.code, e.category, e.retry, e.confidence])).toEqual([
      ["R01", "insufficient_funds", "retry_conditionally", "strong"],
      ["R02", "payment_method_unavailable", "do_not_retry", "possible"],
    ]);
    expect(r.errors[1]!.explanation).toMatch(/deactivates the ACH account/);
    expect(r.groups).toHaveLength(2);
  });

  it("shows a failed capture after an authorization", () => {
    const r = analyze(
      [
        form(
          "transactionType=AUTH_ONLY_SINGLE_CHARGE&referenceNumber=PPLsynth34&transactionDate=10%2F20%2F2026+10%3A00+AM",
        ),
        form(
          "transactionType=CHARGE&referenceNumber=PPLsynth34&captureStatus=FAIL&captureReferenceNumber=PPLsynthCAP34&transactionDate=10%2F21%2F2026+10%3A00+AM",
        ),
      ].join("\n"),
    );
    expect(r.events[1]).toMatchObject({
      stage: "capture",
      outcome: "failure",
      providerStatus: "captureStatus=FAIL",
      relatedReference: "PPLsynthCAP34",
    });
    expect(r.errors[0]).toMatchObject({ code: "captureStatus=FAIL", confidence: "insufficient" });
    expect(ruleIds(r)).toContain("CAPTURE_FAILED_AFTER_AUTHORIZATION");
  });

  it("keeps PENDING_REFUND pending and reads payouts", () => {
    const pending = analyze(
      form("transactionType=PENDING_REFUND&referenceNumber=PPLsynth35&reversalRefNum=PPLsynthR35"),
    );
    expect(pending.events[0]).toMatchObject({ stage: "refund", outcome: "pending" });
    expect(ruleIds(pending)).toContain("REFUND_PENDING");
    const payout = analyze(form("transactionType=FAILED_PAYOUT_TRANSFER&paymentId=PPLsynthPAY36"));
    expect(payout.events[0]).toMatchObject({
      stage: "payout",
      outcome: "failure",
      paymentReference: "PPLsynthPAY36",
    });
    expect(ruleIds(payout)).toContain("PAYOUT_STATUS");
  });

  it("reports RDR and unlisted names as unknown event types", () => {
    const rdr = analyze(form("transactionType=RDR&referenceNumber=PPLsynth37")).events[0]!;
    expect(rdr).toMatchObject({ eventTypeKnown: false, stage: "other", outcome: "unknown" });
    expect(rdr.attributes.webhookUndescribed).toBe(true);
    const unknown = analyze(
      form("transactionType=PPLSYNTH_NEW_EVENT&referenceNumber=PPLsynth38&invoiceAmountUSD=1.00"),
    );
    expect(unknown.records[0]!.status).toBe("analyzed");
    expect(unknown.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(ruleIds(unknown)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("reports a repeated transactionType as a parse issue without throwing", () => {
    const r = analyze(
      form("transactionType=CHARGE&transactionType=REFUND&referenceNumber=PPLsynth39"),
    );
    expect(r.records[0]!.status).toBe("invalid");
  });

  it("does not throw on malformed input and reports XML as an unsupported record", () => {
    expect(analyzeText("{not json", options).ok).toBe(false);
    const xml = analyzeText(
      '<messages xmlns="http://ws.plimus.com"><message/></messages>',
      options,
    );
    expect(xml).toMatchObject({
      ok: true,
      result: { records: [{ status: "unsupported" }], events: [] },
    });
    expect(() => bluesnapAdapter.parse({}, "bluesnap.unknown")).not.toThrow();
    expect(bluesnapAdapter.parse({}, "bluesnap.unknown").ok).toBe(false);
    const r = analyze(
      json(
        errorBody({
          errorName: "DO_NOT_HONOR",
          code: 14002,
          invalidProperty: "x",
          fraudEvents: [1],
        }),
      ),
    );
    expect(r.errors[0]!.code).toBe("DO_NOT_HONOR");
  });
});

// ---------------------------------------------------------------------------

describe("bluesnap sensitive data", () => {
  const planted = [
    "Planted",
    "Synthetic Holder",
    "planted.synthetic",
    "77 Planted",
    "Plantedton",
    "PL4 7NT",
    "PL47NT",
    "15550100777",
    "203.0.113.77",
    "PPLSYNTHUSER01",
    "PPLSYNTHACCOUNT01",
    "PPLSYNTHOWNER01",
    "9071",
    "457173",
    "12/2030",
    "PPL771",
    "PPLSYNTHREF01",
    "PPLSYNTHACD0001",
    "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "PPLSYNTHSIGNATURE0001",
    "PPLSYNTHNETWORK0001",
    "PPLSYNTH3DSREF01",
    "PPLSYNTHSESSION01",
    "PPLSYNTHSHOPPER01",
    "Planted Synthetic Bank",
  ];

  it.each(["webhook-http-request.txt", "sensitive-card-transaction.json"])(
    "keeps planted values out of events and the JSON report (%s)",
    (file) => {
      const r = analyzeFixture(file);
      expect(r.records[0]!.status).toBe("analyzed");
      const events = json(r.events);
      const report = toJsonReport(r);
      for (const v of planted) {
        expect(events, v).not.toContain(v);
        expect(report, v).not.toContain(v);
      }
      expect(r.sensitiveData.detected).toBe(true);
    },
  );

  it("reports only the presence of authKey and the signature header", () => {
    const e = analyzeFixture("webhook-http-request.txt").events[0]!;
    expect(e.attributes).toMatchObject({
      authKeyStatus: "present_md5_hex",
      signatureHeaderPresent: true,
      httpMethod: "POST",
    });
    expect(Object.keys(e.attributes)).not.toContain("Color");
  });

  it("keeps fraud expressions and Kount IDs out of the output", () => {
    const r = analyzeFixture("fraud-detected.json");
    for (const v of ["PPLSYNTHEXPR01", "PPLSYNTHEXPR02", "PPLSYNTHKOUNT01", "Planted expression"]) {
      expect(json(r.events)).not.toContain(v);
      expect(json(r.errors)).not.toContain(v);
      expect(toJsonReport(r)).not.toContain(v);
    }
  });

  it("keeps chargeback case numbers out of the output", () => {
    const r = analyzeFixture("webhook-lifecycle.txt");
    expect(json(r.events)).not.toContain("PPLSYNTHCB911CASE01");
    expect(toJsonReport(r)).not.toContain("PPLSYNTHCB911CASE01");
  });

  it("drops merchant references that contain personal data", () => {
    const e = analyze(
      form(
        "transactionType=CHARGE&referenceNumber=PPLsynth40&merchantTransactionId=someone%40example.com",
      ),
    ).events[0]!;
    expect(e.merchantReference).toBeUndefined();
  });
});
