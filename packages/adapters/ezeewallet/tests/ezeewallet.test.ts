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
import {
  ERROR_CODES,
  EZEEWALLET_ADAPTER_VERSION,
  LOOKUP_TYPES,
  STATUSES,
  ezeewalletAdapter,
  ezeewalletManifest,
} from "@pandapaylens/ezeewallet";
import defaultExport from "@pandapaylens/ezeewallet";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [ezeewalletAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`ezeewallet/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");

const SIG = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

const transferNew = (fields: Record<string, unknown> = {}) => ({
  transfer: {
    merchant_transaction_id: "PPLSYNTH-MTX-T001",
    ezw_reference_id: "PPLsynthEZWT001",
    amount: 1000,
    currency: "EUR",
    source_wallet_id: "someone@example.com",
    return_success_url: "https://merchant.pplsynth.example/s",
    return_failure_url: "https://merchant.pplsynth.example/f",
    status: "approved",
    ...fields,
  },
});
const transferLegacy = (fields: Record<string, unknown> = {}) => ({
  transfer: {
    transaction_id: "PPLSYNTH-TX-T001",
    usage: "Synthetic",
    amount: 1000,
    currency: "EUR",
    source_wallet_id: "someone@example.com",
    return_success_url: "https://merchant.pplsynth.example/s",
    return_failure_url: "https://merchant.pplsynth.example/f",
    status: "approved",
    ...fields,
  },
});
const notification = (fields: Record<string, unknown> = {}) => ({
  transaction_id: "PPLSYNTH-TX-T001",
  unique_id: "PPLsynthUIDT001",
  status: "approved",
  signature: SIG,
  ...fields,
});
const payoutNotification = (fields: Record<string, unknown> = {}) => ({
  ezw_reference_id: "PPLsynthEZWP001",
  merchant_reference: "PPLSYNTH-PO-T001",
  unique_id: "PPLsynthUIDP001",
  status: "approved",
  signature: SIG,
  ...fields,
});

const FORM_META: RecordMeta = { format: "form" };

describe("ezeewallet detection", () => {
  it.each([
    [transferNew(), "ezeewallet.transfer", 0.98],
    [transferLegacy(), "ezeewallet.transfer", 0.8],
    [
      {
        transfer: {
          merchant_transaction_id: "PPLSYNTH-MTX-T002",
          source_wallet_id: "x@example.com",
          status: "pending",
        },
      },
      "ezeewallet.transfer",
      0.65,
    ],
    [
      {
        merchant_transaction_id: "PPLSYNTH-MTX-T003",
        ezw_reference_id: "PPLsynthEZWT003",
        consumer_email: "x@example.com",
        amount: 100,
        currency: "EUR",
        status: "approved",
      },
      "ezeewallet.transfer",
      0.98,
    ],
    [
      {
        refund: {
          merchant_transaction_id: "R1",
          ezw_reference_id: "E1",
          amount: 1,
          currency: "USD",
          status: "approved",
        },
      },
      "ezeewallet.refund",
      0.95,
    ],
    [{ refund: { status: "approved" } }, "ezeewallet.refund", 0.35],
    [
      { ezw_reference_id: "E1", status: "approved", type: "transfer" },
      "ezeewallet.transaction",
      0.9,
    ],
    [{ ezw_reference_id: "E1", status: "approved", type: "other" }, "ezeewallet.transaction", 0.75],
    [
      { ezw_reference_id: "E1", status: "pending", merchant_reference: "M1" },
      "ezeewallet.single_payout",
      0.85,
    ],
    [
      { unique_id: "U1", status: "succeeded", merchant_reference: "M1" },
      "ezeewallet.single_payout",
      0.55,
    ],
    [
      { unique_id: "U1", status: "mystery", merchant_reference: "M1" },
      "ezeewallet.single_payout",
      0.4,
    ],
    [
      {
        unique_ids: [
          { email: "x@example.com", amount: 1, currency: "EUR", merchant_reference: "M" },
        ],
        status: "pending",
      },
      "ezeewallet.batch_payout",
      0.75,
    ],
    [
      { unique_id: [{ email: "x@example.com", amount: 1, currency: "EUR" }], status: "queued" },
      "ezeewallet.batch_payout",
      0.65,
    ],
    [{ unique_id: "U1", status: "pending" }, "ezeewallet.batch_payout", 0.3],
    [{ error: { code: 407, message: "Currency mismatch" } }, "ezeewallet.error", 0.65],
    [
      { error: { code: "408", message: "Transaction ID already processed" } },
      "ezeewallet.error",
      0.65,
    ],
    [{ error: { code: 404, message: "Not found" } }, "ezeewallet.error", 0.4],
    [notification(), "ezeewallet.notification", 0.65],
    [notification({ status: "declined", decline_reason: "x" }), "ezeewallet.notification", 0.7],
    [payoutNotification(), "ezeewallet.notification", 0.9],
    [notification({ signature: "not-hex" }), "ezeewallet.notification", 0.5],
  ])("detects %j", (input, format, confidence) => {
    expect(ezeewalletAdapter.detect(input)).toMatchObject({ format, confidence, supported: true });
  });

  it("recognizes account responses without analyzing them", () => {
    expect(
      ezeewalletAdapter.detect({
        account_number: "A",
        verification_status: "verified",
        account_status: "active",
      }),
    ).toMatchObject({ format: "ezeewallet.account", confidence: 0.6, supported: false });
  });

  it("raises an error envelope that arrived with the documented HTTP status", () => {
    const http = (status: number): RecordMeta => ({
      format: "http",
      http: { kind: "response", status, headers: {} },
    });
    const env = { error: { code: 407, message: "Currency mismatch" } };
    expect(ezeewalletAdapter.detect(env, http(400)).confidence).toBe(0.75);
    expect(ezeewalletAdapter.detect(env, http(422)).confidence).toBe(0.65);
    // Without message wording the envelope stays generic, even with HTTP 400.
    expect(
      ezeewalletAdapter.detect({ error: { code: 404, message: "x" } }, http(400)).confidence,
    ).toBe(0.45);
    expect(
      ezeewalletAdapter.detect({ error: { code: 411, message: "source wallet" } }, http(400))
        .confidence,
    ).toBe(0.55);
  });

  it("lowers form-encoded notifications and never claims form-encoded responses", () => {
    expect(ezeewalletAdapter.detect(notification(), FORM_META).confidence).toBe(0.5);
    expect(ezeewalletAdapter.detect(transferNew(), FORM_META).confidence).toBe(0);
    expect(
      ezeewalletAdapter.detect(
        { ezw_reference_id: "E1", status: "approved", type: "transfer" },
        FORM_META,
      ).confidence,
    ).toBe(0);
  });

  it("never claims emerchantpay Genesis payloads that carry eZeeWallet as a payment method", () => {
    const genesis =
      "transaction_id=PPLSYNTH-G-1&unique_id=PPLsynthG0001&transaction_type=ezeewallet&terminal_token=PPLSYNTHTERM&status=approved&amount=500&signature=" +
      SIG;
    const parsed = parseInput(genesis);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(ezeewalletAdapter.detect(parsed.value.records[0], parsed.value.meta[0]).confidence).toBe(
      0,
    );
    expect(
      ezeewalletAdapter.detect(notification({ transaction_type: "ezeewallet" })).confidence,
    ).toBe(0);
    expect(ezeewalletAdapter.detect({ ...transferNew(), terminal_token: "T" }).confidence).toBe(0);
    const r = analyze(genesis);
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.events).toEqual([]);
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "eZeeWallet", message: "ezeewallet error" },
      "ezeewallet",
      null,
      [],
      { status: "approved" },
      { error: "Currency mismatch" },
      { error: { code: "card_declined", message: "wallet" } },
      { error: { code: 407, message: "Currency mismatch", type: "x" } },
      { transfer: { id: "tr_1", amount: 100, status: "paid" } },
      { transfer: { status: "approved" } },
      { unique_id: "U1", status: "approved", signature: SIG, amount: 1 },
      { transaction_id: "T1", unique_id: "U1", status: "approved" },
      { ezw_reference_id: "E1", status: "approved" },
      { ezw_reference_id: "E1", status: "approved", foo: 1 },
      { object: "transfer", ezw_reference_id: "E1", status: "approved", type: "transfer" },
      { unique_ids: [{ id: 1 }], status: "pending" },
    ]) {
      expect(ezeewalletAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("keeps generic and weak shapes at or below the analysis threshold", () => {
    expect(
      ezeewalletAdapter.detect({ unique_id: "U1", status: "pending" }).confidence,
    ).toBeLessThan(0.5);
    expect(ezeewalletAdapter.detect({ error: { code: 407 } }).confidence).toBe(0.4);
    expect(
      ezeewalletAdapter.detect({ error: { code: 401, message: "Invalid" } }).confidence,
    ).toBeLessThanOrEqual(0.5);
    expect(
      ezeewalletAdapter.detect({ unique_id: "U1", status: "failed", merchant_reference: "M" })
        .confidence,
    ).toBeLessThanOrEqual(0.55);
  });

  // Every other provider's fixtures, including stripe and adyen, must not be claimed.
  const fixturesRoot = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  const otherDirs = readdirSync(fixturesRoot).filter(
    (d) => d !== "ezeewallet" && statSync(`${fixturesRoot}${d}`).isDirectory(),
  );

  it("checks the stripe and adyen fixtures", () => {
    expect(otherDirs).toEqual(expect.arrayContaining(["stripe", "adyen"]));
  });

  it.each(otherDirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const root = `${fixturesRoot}${dir}/`;
    for (const file of readdirSync(root)) {
      if (!statSync(`${root}${file}`).isFile()) continue;
      const parsed = parseInput(readFileSync(`${root}${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          ezeewalletAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
      });
    }
  });
});

describe("ezeewallet parsing", () => {
  it("reports a notification without unique_id as a parse issue without throwing", () => {
    const { unique_id: _omit, ...noId } = notification();
    const r = analyze(json(noId));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "ezeewallet.notification" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^unique_id:/);
    expect(r.events).toEqual([]);
  });

  it("reports a transfer without status as a parse issue", () => {
    const t = transferNew();
    const { status: _omit, ...rest } = t.transfer;
    const r = analyze(json({ transfer: rest }));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "ezeewallet.transfer" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^transfer\.status:/);
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(ezeewalletAdapter.parse(transferNew({ status: 1 }), "ezeewallet.transfer").ok).toBe(
      false,
    );
    expect(ezeewalletAdapter.parse({}, "ezeewallet.unknown").ok).toBe(false);
    expect(ezeewalletAdapter.parse({}, "toString").ok).toBe(false);
    expect(ezeewalletAdapter.parse({ error: { code: 1.5 } }, "ezeewallet.error").ok).toBe(false);
    expect(ezeewalletAdapter.parse({ status: "failed" }, "ezeewallet.single_payout")).toEqual({
      ok: false,
      issues: ["unique_id or ezw_reference_id: required"],
    });
    for (const format of [
      "ezeewallet.refund",
      "ezeewallet.transaction",
      "ezeewallet.batch_payout",
    ]) {
      expect(ezeewalletAdapter.parse({ status: 7 }, format).ok).toBe(false);
    }
    expect(
      ezeewalletAdapter.parse({ status: 7, ezw_reference_id: "E1" }, "ezeewallet.single_payout").ok,
    ).toBe(false);
    expect(ezeewalletAdapter.parse({ ezw_reference_id: "E1" }, "ezeewallet.transfer").ok).toBe(
      false,
    );
    const r = analyze(json(notification({ status: 5 })));
    expect(r.records[0]!.status).toBe("invalid");
  });

  it("tolerates unknown fields and null values", () => {
    const p = ezeewalletAdapter.parse(
      transferNew({ brandNew: [1], redirect_url: null }),
      "ezeewallet.transfer",
    );
    expect(p.ok).toBe(true);
  });

  it("accepts the trailing commas of the docs examples with a warning", () => {
    const docs = analyzeText(fixture("ezeewallet/docs-trailing-comma-error.txt"), options);
    expect(docs.ok).toBe(true);
    if (docs.ok) {
      expect(docs.result.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
      expect(docs.result.errors.map((e) => e.code)).toContain("407");
    }
  });

  it("fails cleanly on malformed input", () => {
    const cut = analyzeText('{"transfer": {"status": "approved", ', options);
    expect(!cut.ok && cut.error.code).toBe("INVALID_JSON");
  });

  it("recognizes account responses but does not analyze them", () => {
    const r = analyzeFixture("account.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "ezeewallet.account" });
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/recognized but not analyzed/);
    expect(r.events).toEqual([]);
    expect(toJsonReport(r)).not.toContain("PPLSYNTHPLANTEDACCT01");
  });

  it("analyzes the generic legacy batch payout shape only when the provider is selected", () => {
    const body = json({ unique_id: "PPLsynthUIDB001", status: "failed" });
    expect(analyze(body).records[0]!.status).toBe("unsupported");
    const r = analyze(body, { provider: "ezeewallet" });
    expect(r.events[0]).toMatchObject({
      eventType: "batch_payouts.failed",
      stage: "payout",
      outcome: "failure",
      paymentReference: "PPLsynthUIDB001",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/Per-item results/);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });
});

describe("ezeewallet transfers", () => {
  it("keeps a pending asynchronous legacy transfer pending until its notification", () => {
    const r = analyzeFixture("legacy-transfer-async-flow.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.eventTypeKnown])).toEqual([
      ["transfers.pending_async", "payment", "pending", true],
      ["transfer_notification.approved", "payment", "success", true],
    ]);
    // Linked only through the merchant's transaction_id (the legacy response has no eZeeWallet id).
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual([
      "transaction_id:PPLSYNTH-TX-0001",
      "unique_id:PPLsynthUID0001",
    ]);
    expect(r.events[0]).toMatchObject({
      amountMinor: "2500",
      currency: "EUR",
      merchantReference: "PPLSYNTH-TX-0001",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      paymentFamily: "wallet",
      operation: "transfer",
      transferVariant: "legacy",
      statusVocabulary: "transfers",
      statusDocumentedIn: "data type",
      topUpRedirect: true,
      merchantReferenceField: "transaction_id",
    });
    expect(r.events[1]).toMatchObject({
      paymentReference: "PPLsynthUID0001",
      deliveryKey: "PPLsynthUID0001:approved",
    });
    // No timestamps exist in eZeeWallet payloads, and none is invented.
    expect(r.events.every((e) => e.eventTimestamp === undefined)).toBe(true);
    expect(r.arrivalOrderInferred).toBe(true);
    expect(r.events.some((e) => e.stage === "authorization")).toBe(false);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("links a refund to its transfer through ezw_reference_id", () => {
    const r = analyzeFixture("transfer-new-refund-lookup.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.paymentReference])).toEqual([
      ["transfers_new.approved", "payment", "success", "PPLsynthEZW0101"],
      ["refunds.approved", "refund", "success", "PPLsynthEZW0101"],
      ["transaction.approved", "payment", "success", "PPLsynthEZW0101"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]).toMatchObject({
      amountMinor: "4000",
      currency: "USD",
      merchantReference: "PPLSYNTH-RFD-0101",
    });
    expect(r.events[1]!.attributes.parentReference).toBe(
      "ezw_reference_id of the original transfer",
    );
    expect(r.events[2]!.attributes).toMatchObject({
      lookupType: "transfer",
      lookupTypeKnown: true,
    });
    expect(r.findings).toEqual([]);
  });

  it("keeps a pending transfer without eZeeWallet id unresolved", () => {
    const r = analyzeFixture("transfer-new-pending.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transfers_new.pending",
      stage: "payment",
      outcome: "pending",
      merchantReference: "PPLSYNTH-MTX-0201",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      statusDocumentedIn: "data type and example",
      topUpRedirect: true,
    });
    expect(r.events[0]!.attributes).not.toHaveProperty("transactionIdLink");
    expect(ruleIds(r)).toEqual(expect.arrayContaining(["MISSING_REFERENCE", "UNRESOLVED_OUTCOME"]));
  });

  it("decodes a declined transfer response by its status only", () => {
    const r = analyze(json(transferNew({ status: "declined" })));
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "declined",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      outcomeKnown: true,
      paymentReference: "PPLsynthEZWT001",
      subCodes: { endpoint: "transfers_new" },
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no reason code/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it.each([
    [
      transferLegacy({ status: "pending_async" }),
      "transfers.pending_async",
      "pending",
      true,
      "data type",
    ],
    [transferLegacy({ status: "pending" }), "transfers.pending", "pending", true, "example"],
    [transferLegacy({ status: "declined" }), "transfers.declined", "failure", true, "narrative"],
    [
      transferNew({ status: "pending_async" }),
      "transfers_new.pending_async",
      "unknown",
      false,
      undefined,
    ],
    [transferNew({ status: "succeeded" }), "transfers_new.succeeded", "unknown", false, undefined],
    [transferNew({ status: "Approved" }), "transfers_new.Approved", "unknown", false, undefined],
    [
      { transfer: { source_wallet_id: "x@example.com", status: "approved" } },
      "transfer.approved",
      "success",
      true,
      "data type and example",
    ],
    [
      { transfer: { source_wallet_id: "x@example.com", status: "pending_async" } },
      "transfer.pending_async",
      "unknown",
      false,
      undefined,
    ],
    [
      { unique_id: "U", status: "approved", merchant_reference: "M" },
      "single_payouts.approved",
      "unknown",
      false,
      undefined,
    ],
    [
      { ezw_reference_id: "E", status: "succeeded", merchant_reference: "M" },
      "single_payouts_new.succeeded",
      "unknown",
      false,
      undefined,
    ],
    [
      { ezw_reference_id: "E", status: "declined", merchant_reference: "M" },
      "single_payouts_new.declined",
      "failure",
      true,
      "narrative",
    ],
    [
      { refund: { ezw_reference_id: "E", status: "pending" } },
      "refunds.pending",
      "unknown",
      false,
      undefined,
    ],
    [
      notification({ status: "timeout" }),
      "transfer_notification.timeout",
      "unknown",
      false,
      undefined,
    ],
    [
      notification({ status: "pending" }),
      "transfer_notification.pending",
      "unknown",
      false,
      undefined,
    ],
    [
      payoutNotification({ status: "pending" }),
      "payout_notification.pending",
      "pending",
      true,
      "narrative",
    ],
  ])(
    "keeps the status vocabulary per endpoint (%j)",
    (input, eventType, outcome, known, documentedIn) => {
      // Forced provider: some of these shapes are weak on their own.
      const e = analyze(json(input), { provider: "ezeewallet" }).events[0]!;
      expect(e).toMatchObject({ eventType, outcome, eventTypeKnown: known });
      expect(e.attributes.statusDocumentedIn).toBe(documentedIn);
    },
  );

  it("reports an undocumented status honestly and without a decoded error", () => {
    const r = analyze(json(notification({ status: "timeout" })));
    expect(r.events[0]).toMatchObject({
      outcome: "unknown",
      eventTypeKnown: false,
      providerStatus: "timeout",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("maps the lookup type to a stage and leaves unknown types without lifecycle semantics", () => {
    expect(firstEvent({ ezw_reference_id: "E", status: "pending", type: "payout" })).toMatchObject({
      stage: "payout",
      outcome: "pending",
    });
    const other = firstEvent({ ezw_reference_id: "E", status: "approved", type: "chargeback" });
    expect(other).toMatchObject({ stage: "other", outcome: "success" });
    expect(other.attributes.lookupTypeKnown).toBe(false);
  });

  it("keeps transactions that only share a merchant transaction id apart", () => {
    const r = analyzeFixture("unrelated-transfers.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "PPLSYNTH-ORDER-SHARED",
      "PPLSYNTH-ORDER-SHARED",
    ]);
    expect(r.groups.map((g) => g.latestOutcome)).toEqual(["failure", "success"]);
  });

  it("never converts decimal or float amounts", () => {
    for (const amount of ["10.50", 10.5]) {
      const e = firstEvent(transferNew({ amount }));
      expect(e.amountMinor).toBeUndefined();
      expect(e.currency).toBe("EUR");
      expect(e.attributes.amountNotConvertible).toBe(true);
    }
    expect(firstEvent(transferNew({ amount: "1250" })).amountMinor).toBe("1250");
  });

  it("drops merchant references that contain personal data", () => {
    const e = firstEvent(
      transferLegacy({ transaction_id: "someone@example.com", status: "pending" }),
    );
    expect(e.merchantReference).toBeUndefined();
    expect(
      ezeewalletAdapter.correlationKeys({
        ...e,
        id: "ev-1",
        provider: "ezeewallet",
        sourceIndex: 0,
      }),
    ).toEqual([]);
  });

  it("recognizes unwrapped transfer list items", () => {
    const e = firstEvent({
      merchant_transaction_id: "PPLSYNTH-MTX-L001",
      ezw_reference_id: "PPLsynthEZWL001",
      consumer_email: "x@example.com",
      amount: 300,
      currency: "gbp",
      status: "approved",
    });
    expect(e).toMatchObject({
      eventType: "transfers_new.approved",
      amountMinor: "300",
      currency: "GBP",
      source: { path: "" },
    });
    expect(e.attributes.transferWrapper).toBe(false);
  });
});

describe("ezeewallet notifications", () => {
  it("shows decline_reason as provider text only and never classifies it", () => {
    const r = analyzeFixture("transfer-notification-declined.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transfer_notification.declined",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynthUID0301",
      merchantReference: "PPLSYNTH-TX-0301",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      declineReasonText: "Consumer rejected the synthetic transfer",
      declineReasonClassified: false,
      signaturePresent: true,
      signatureShape: "40 hex characters",
      signatureVerified: false,
      notificationVariant: "transfer",
    });
    expect(r.errors[0]).toMatchObject({
      code: "declined",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "Consumer rejected the synthetic transfer",
      outcomeKnown: true,
      attemptReference: "PPLsynthUID0301",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/does not document/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("reports repeated deliveries by unique_id and status", () => {
    const r = analyzeFixture("notification-duplicate.json");
    expect(r.events.map((e) => e.deliveryKey)).toEqual([
      "PPLsynthUID0401:approved",
      "PPLsynthUID0401:approved",
    ]);
    expect(r.groups).toHaveLength(1);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(dup.explanation).toMatch(/unique_id and status/);
    expect(dup.explanation).not.toMatch(/documents that it can deliver/);
  });

  it("does not treat a later status of the same payout as a duplicate", () => {
    const r = analyze(json([payoutNotification({ status: "pending" }), payoutNotification()]));
    expect(new Set(r.events.map((e) => e.deliveryKey)).size).toBe(2);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(ruleIds(r)).not.toContain("CONFLICTING_OBSERVATIONS");
  });

  it("keeps a payout as a payout and links its notification", () => {
    const r = analyzeFixture("payout-new-flow.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["single_payouts_new.pending", "payout", "pending"],
      ["payout_notification.approved", "payout", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]).toMatchObject({
      paymentReference: "PPLsynthEZW0501",
      relatedReference: "PPLsynthUID0501",
      merchantReference: "PPLSYNTH-PO-0501",
    });
    expect(r.events[1]!.attributes).toMatchObject({
      notificationVariant: "payout",
      merchantReferenceField: "merchant_reference",
    });
    expect(r.events[1]!.attributes).not.toHaveProperty("transactionIdLink");
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("does not link payouts that only share a merchant reference", () => {
    const r = analyze(
      json([
        {
          ezw_reference_id: "PPLsynthEZWA",
          status: "approved",
          merchant_reference: "PPLSYNTH-SAME",
        },
        {
          ezw_reference_id: "PPLsynthEZWB",
          status: "approved",
          merchant_reference: "PPLSYNTH-SAME",
        },
      ]),
    );
    expect(r.groups).toHaveLength(2);
  });

  it("decodes a failed legacy single payout", () => {
    const r = analyzeFixture("single-payout-legacy-failed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "single_payouts.failed",
      stage: "payout",
      outcome: "failure",
      paymentReference: "PPLsynthUID0601",
    });
    expect(r.errors[0]).toMatchObject({
      code: "failed",
      confidence: "insufficient",
      outcomeKnown: true,
    });
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe("Payout failed");
  });

  it("shows a pending batch payout without inventing per-item results", () => {
    const r = analyzeFixture("batch-payout-new.json");
    expect(r.events[0]).toMatchObject({
      eventType: "batch_payouts_new.pending",
      stage: "payout",
      outcome: "pending",
      currency: "EUR",
    });
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      itemCount: 2,
      itemsField: "unique_ids",
      perItemResultsDocumented: false,
    });
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe(
      "Payout not confirmed",
    );
  });

  it("does not guess the variant of a notification with only unique_id", () => {
    const e = firstEvent({ unique_id: "PPLsynthUIDX", status: "approved", signature: SIG });
    expect(e).toMatchObject({
      eventType: "notification.approved",
      stage: "other",
      outcome: "success",
    });
    expect(e.attributes.notificationVariant).toBe("not determined");
  });

  it("analyzes a form-encoded notification at reduced confidence", () => {
    const r = analyze(
      `transaction_id=PPLSYNTH-TX-F1&unique_id=PPLsynthUIDF1&status=approved&signature=${SIG}`,
    );
    expect(r.records[0]).toMatchObject({ status: "analyzed", confidence: 0.5 });
    expect(r.events[0]!.eventType).toBe("transfer_notification.approved");
  });

  it("uses receipt times only when supplied in the envelope", () => {
    const r = analyze(json([{ receivedAt: "2026-10-20T10:00:00Z", payload: notification() }]));
    expect(r.events[0]).toMatchObject({ observedTimestamp: "2026-10-20T10:00:00.000Z" });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
  });
});

describe("ezeewallet errors", () => {
  it("decodes a validation error with its HTTP status", () => {
    const r = analyzeFixture("error-currency-mismatch.txt");
    expect(r.records[0]).toMatchObject({ format: "ezeewallet.error", confidence: 0.75 });
    expect(r.suggestedView).toBe("decoder");
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 400",
    });
    expect(r.events[0]!.attributes).toMatchObject({ errorCode: "407", errorCodeType: "integer" });
    expect(r.errors[0]).toMatchObject({
      code: "407",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Currency mismatch",
      subCodes: { http_status: "400" },
    });
    expect(r.errors[0]!.explanation).toMatch(/not an HTTP status/);
  });

  it("decodes a source wallet credential failure", () => {
    const r = analyzeFixture("error-source-wallet-credentials.json");
    expect(r.errors[0]).toMatchObject({
      code: "402",
      category: "authentication_failed",
      retry: "customer_action_required",
      confidence: "strong",
    });
  });

  it("treats an internal error as an unknown outcome and never as safe to retry", () => {
    const r = analyzeFixture("error-internal.txt");
    expect(r.events[0]).toMatchObject({ outcome: "unknown", providerStatus: "HTTP 500" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "500",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "strong",
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.retryExplanation).toMatch(/GET \/transaction/);
    expect(e.retryExplanation).toMatch(/408/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  // Independent copy of the research table (code, category, retry).
  it.each([
    ["401", "invalid_request", "do_not_retry"],
    ["402", "authentication_failed", "customer_action_required"],
    ["403", "payment_method_unavailable", "manual_review"],
    ["404", "configuration", "manual_review"],
    ["405", "invalid_request", "customer_action_required"],
    ["406", "payment_method_unavailable", "manual_review"],
    ["407", "invalid_request", "do_not_retry"],
    ["408", "duplicate_request", "do_not_retry"],
    ["409", "invalid_amount", "customer_action_required"],
    ["410", "configuration", "do_not_retry"],
    ["412", "configuration", "manual_review"],
    ["413", "invalid_amount", "do_not_retry"],
    ["414", "insufficient_funds", "retry_conditionally"],
    ["415", "invalid_amount", "manual_review"],
    ["416", "invalid_request", "do_not_retry"],
    ["417", "invalid_request", "do_not_retry"],
    ["418", "invalid_request", "do_not_retry"],
    ["419", "invalid_request", "do_not_retry"],
    ["420", "duplicate_request", "do_not_retry"],
    ["421", "invalid_request", "do_not_retry"],
    ["422", "payment_method_unavailable", "do_not_retry"],
    ["423", "invalid_request", "customer_action_required"],
    ["424", "invalid_request", "do_not_retry"],
    ["425", "invalid_request", "do_not_retry"],
    ["426", "invalid_request", "do_not_retry"],
    ["427", "invalid_amount", "do_not_retry"],
    ["500", "provider_unavailable", "retry_conditionally"],
  ])("decodes code %s as %s / %s", (code, category, retry) => {
    const status = code === "500" ? 500 : 400;
    const r = analyze(
      httpResponse(status, { error: { code: Number(code), message: "wallet error" } }),
    );
    expect(r.errors[0]).toMatchObject({ code, category, retry, confidence: "strong" });
    expect(r.errors[0]!.missingInformation.join(" ")).not.toMatch(/differs/);
  });

  it("reads the error code as a string too and explains the two meanings of 401", () => {
    const e = firstError({
      error: { code: "401", message: "The password parameter has been deprecated" },
    });
    expect(e).toMatchObject({ code: "401", category: "invalid_request" });
    expect(e.explanation).toMatch(/deprecated password parameter/);
    expect(
      firstEvent({ error: { code: "407", message: "Currency mismatch" } }).attributes.errorCodeType,
    ).toBe("string");
  });

  it("explains insufficient merchant funds for payouts without blaming the consumer", () => {
    const e = firstError({
      error: { code: 414, message: "Source wallet balance too low for payout" },
    });
    expect(e.nextAction).toMatch(/merchant wallet/);
    expect(e.retryExplanation).toMatch(/not the consumer's/);
  });

  it("notes an HTTP status that differs from the documented one", () => {
    const r = analyze(httpResponse(422, { error: { code: 407, message: "Currency mismatch" } }));
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP status 422 differs/);
  });

  it("reports unrecognized codes honestly", () => {
    const r411 = analyze(
      httpResponse(400, { error: { code: 411, message: "Source wallet problem" } }),
    );
    expect(r411.errors[0]).toMatchObject({
      code: "411",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r411.errors[0]!.missingInformation.join(" ")).toMatch(/411 does not exist/);
    expect(r411.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });

    const r599 = analyze(httpResponse(500, { error: { code: 599, message: "wallet internal" } }));
    expect(r599.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
    });

    const bare = analyze(json({ error: { code: 499, message: "wallet" } }), {
      provider: "ezeewallet",
    });
    expect(bare.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
    expect(bare.errors[0]!.missingInformation.join(" ")).toMatch(/No HTTP status/);
  });
});

describe("ezeewallet sensitive data", () => {
  const PLANTED = [
    "UExBTlRFREJBU0lDQ1JFRDAx",
    "feedface00112233445566778899aabbccddeeff",
    "planted.secret.person@example.com",
    "4111111111111111",
    "198.51.100.77",
  ];

  it("keeps the signature, credentials and personal data of a notification out of events and the report", () => {
    const r = analyzeFixture("notification-request.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "ezeewallet.notification" });
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(JSON.stringify(r.errors)).not.toContain("planted.secret.person@example.com");
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.events[0]!.attributes).toMatchObject({
      signatureShape: "40 hex characters",
      signatureVerified: false,
    });
    expect(r.events[0]!.attributes.declineReasonText).toMatch(/\[redacted\]/);
  });

  it("keeps consumer names, wallet emails and top-up tokens out of events and the report", () => {
    for (const file of [
      "legacy-transfer-async-flow.json",
      "transfer-new-refund-lookup.json",
      "transfer-new-pending.json",
      "batch-payout-new.json",
    ]) {
      const r = analyzeFixture(file);
      const dump = JSON.stringify(r.events) + toJsonReport(r);
      expect(dump).not.toMatch(
        /Planted Firstname|Planted Lastname|planted\.consumer|planted\.payee|PLANTEDTOPUPTOKEN|PLANTEDNOTIFYPATH|merchant\.pplsynth\.example|0a1b2c3d4e5f60718293/,
      );
    }
  });
});

describe("ezeewallet manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(ezeewalletAdapter);
    expect(ezeewalletAdapter.manifest).toBe(ezeewalletManifest);
    expect(ezeewalletAdapter.id).toBe("ezeewallet");
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(ezeewalletManifest).toMatchObject({
      id: "ezeewallet",
      version: EZEEWALLET_ADAPTER_VERSION,
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      sectors: [],
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "limited",
        webhookParsing: "limited",
        timeline: "experimental",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: {
        duplicatesDocumented: false,
        ordering: "not_documented",
        duplicateKey: "unique_id and status",
      },
    });
    expect([...ezeewalletManifest.categories].sort()).toEqual([
      "alternative_payment_method",
      "wallet",
    ]);
    expect(ezeewalletManifest.regions).toMatch(/Prime Pay Solutions Limited/);
    expect(ezeewalletManifest.regions).toMatch(/emerchantpay ltd\./);
    expect(ezeewalletManifest.regions).toMatch(/Isle of Man Financial Services Authority/);
    expect(ezeewalletManifest.regions).toMatch(/Financial Conduct Authority/);
    expect(ezeewalletManifest.fixtureProvenance).toMatch(/synthetic/i);
    expect(ezeewalletManifest.fixtureProvenance).toMatch(/field tables/);
    const limits = ezeewalletManifest.limitations.join(" ");
    expect(limits).toMatch(/No merchant sectors are documented/);
    expect(limits).toMatch(/regulated entity is unresolved/);
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/never as a card authorization/);
    expect(limits).toMatch(/never merged into one state machine/);
    expect(limits).toMatch(/No event time is invented/);
    expect(limits).toMatch(/Genesis/);
  });

  it("contains exactly the 27 documented error codes", () => {
    const expected = [
      ...Array.from({ length: 10 }, (_, i) => String(401 + i)),
      ...Array.from({ length: 16 }, (_, i) => String(412 + i)),
      "500",
    ];
    expect(Object.keys(ERROR_CODES).sort()).toEqual(expected);
    expect(Object.keys(ERROR_CODES)).toHaveLength(27);
    expect(ERROR_CODES).not.toHaveProperty("411");
    expect(
      Object.entries(ERROR_CODES).every(([c, e]) => e.httpStatus === (c === "500" ? 500 : 400)),
    ).toBe(true);
  });

  it("keeps status vocabularies per endpoint", () => {
    expect(Object.keys(STATUSES.single_payouts).sort()).toEqual(["failed", "succeeded"]);
    expect(Object.keys(STATUSES.transfers).sort()).toEqual([
      "approved",
      "declined",
      "pending",
      "pending_async",
    ]);
    expect(Object.keys(STATUSES.transfers_new).sort()).toEqual(["approved", "declined", "pending"]);
    expect(Object.keys(STATUSES.transfer_notification).sort()).toEqual(["approved", "declined"]);
    expect(Object.keys(LOOKUP_TYPES).sort()).toEqual(["payout", "transfer"]);
    for (const table of Object.values(STATUSES)) expect(table).not.toHaveProperty("timeout");
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      ezeewalletManifest,
      ERROR_CODES,
      STATUSES,
      ezeewalletAdapter.supportedFormats,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
