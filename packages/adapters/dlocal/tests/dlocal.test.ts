import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeRecords,
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { ADAPTERS } from "@pandapaylens/providers";
import { astropayAdapter } from "@pandapaylens/astropay";
import defaultExport, {
  CALLBACK_STATUSES,
  CHARGEBACK_REASON_CODES,
  CHARGEBACK_STATUSES,
  DLOCAL_ADAPTER_VERSION,
  DLOCAL_FORMATS,
  MERCHANT_ADVICE_CODES,
  PAYINS_ERROR_ROWS,
  PAYMENT_PENDING_CODES,
  PAYMENT_REJECTION_CODES,
  PAYMENT_STATUSES,
  PAYOUT_V3_ERROR_ROWS,
  PAYOUT_V3_REJECTION_CODES,
  PAYOUT_V3_STATUSES,
  REFUND_STATUSES,
  apiErrorRows,
  dlocalAdapter,
  dlocalManifest,
  reasonReadings,
  statusCodeOf,
} from "@pandapaylens/dlocal";
import { dlocalManifest as manifestOnly } from "@pandapaylens/dlocal/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [dlocalAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (name: string) => analyze(fixture(`dlocal/${name}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const http = (status: number, reason: string, body: unknown) =>
  `HTTP/1.1 ${status} ${reason}\nContent-Type: application/json\n\n${json(body)}\n`;

const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

const payment = (fields: Record<string, unknown> = {}) => ({
  id: "D-4-PPLsynth-test-0001",
  amount: 100,
  currency: "BRL",
  payment_method_id: "CARD",
  payment_method_type: "CARD",
  payment_method_flow: "DIRECT",
  country: "BR",
  card: { brand: "VI" },
  created_date: "2026-10-20T10:00:00.000+0000",
  status: "PAID",
  status_detail: "The payment was paid.",
  status_code: "200",
  order_id: "PPLsynth-order-test-0001",
  ...fields,
});

const refund = (fields: Record<string, unknown> = {}) => ({
  id: "REF-4-PPLsynth-test-0001",
  payment_id: "D-4-PPLsynth-test-0001",
  status: "SUCCESS",
  status_code: 200,
  status_detail: "The refund was paid.",
  amount: 10,
  currency: "BRL",
  amount_refunded: 10,
  order_refund_id: "PPLsynth-refund-test-0001",
  created_date: "2026-10-21T10:00:00.000+0000",
  ...fields,
});

const chargeback = (fields: Record<string, unknown> = {}) => ({
  id: "CBK-4-PPLsynth-test-0001",
  payment_id: "D-4-PPLsynth-test-0001",
  created_date: "2026-10-22T10:00:00.000+0000",
  currency: "BRL",
  amount: 100,
  status: "PENDING",
  status_code: 100,
  status_detail: "The chargeback is pending.",
  chargeback_date: "2026-10-22T10:00:00.000+0000",
  chargeback_stage: "OTHER",
  reason_code: "10.4",
  ...fields,
});

const payout = (fields: Record<string, unknown> = {}) => ({
  id: "PO-4-PPLsynth-test-0001",
  external_id: "PPLsynth-payout-test-0001",
  status: "PENDING",
  status_code: "100",
  status_detail: "The payout is pending.",
  on_hold: false,
  flow_type: "B2C",
  currency_to_pay: "BRL",
  last_updated: "2026-10-20T10:00:00.00Z",
  ...fields,
});

function recordsOf(
  path: string,
): { payload: unknown; meta: Parameters<typeof dlocalAdapter.detect>[1] }[] {
  const parsed = parseInput(readFileSync(path, "utf8"));
  if (!parsed.ok) return [];
  return parsed.value.records.map((record, i) => {
    const r = record as Record<string, unknown>;
    const payload =
      r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
        ? r.payload
        : record;
    return { payload, meta: parsed.value.meta[i] };
  });
}

const dlocalFiles = readdirSync(`${root}dlocal`).filter((f) =>
  statSync(`${root}dlocal/${f}`).isFile(),
);

describe("dlocal manifest and exports", () => {
  it("exports the adapter, manifest, version and catalogs", () => {
    expect(defaultExport).toBe(dlocalAdapter);
    expect(manifestOnly).toBe(dlocalManifest);
    expect(dlocalAdapter.id).toBe("dlocal");
    expect(dlocalAdapter.version).toBe(DLOCAL_ADAPTER_VERSION);
    expect(DLOCAL_ADAPTER_VERSION).toBe("0.1.0");
    expect(dlocalAdapter.manifest).toBe(dlocalManifest);
  });

  it("has an honest manifest", () => {
    const m = dlocalManifest;
    expect(m.wave).toBe(3);
    expect(m.researchStatus).toBe("tested");
    expect(m.verifiedAt).toBe("2026-10-25");
    expect(m.samples).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(m.documentationAccess).toBe("public");
    expect(m.categories).toEqual([
      "card_processing",
      "alternative_payment_method",
      "merchant_account_intermediary",
    ]);
    expect(m.sectors.length).toBeGreaterThan(5);
    for (const s of m.sectors) expect(s.source).toMatch(/^https:\/\/(?:www|docs)\.dlocal\.com\//);
    expect(m.regions).toMatch(/MFSA/);
    expect(m.regions).toMatch(/FinCEN/);
    expect(m.regions).toMatch(/FCA/);
    expect(m.fixtureProvenance).toMatch(/Synthetic/);
    expect(m.delivery.ordering).toBe("not_documented");
    expect(m.delivery.duplicatesDocumented).toBe(true);
    const caps = Object.values(m.capabilities);
    expect(caps.every((c) => c === "supported")).toBe(false);
    expect(m.status).toBe("limited");
    expect(m.capabilities.paymentResponses).toBe("supported");
    expect(m.capabilities.errorDecoding).toBe("limited");
    expect(m.capabilities.webhookParsing).toBe("limited");
    expect(m.capabilities.timeline).toBe("limited");
    for (const f of dlocalAdapter.supportedFormats)
      expect(m.apiFamilies.some((a) => a.id === f.id && a.status !== "unsupported")).toBe(true);
    for (const d of m.documentation) expect(d.url).toMatch(/^https:\/\/docs\.dlocal\.com\//);
  });

  it("keeps the documented catalog sizes", () => {
    expect(Object.keys(PAYMENT_STATUSES)).toHaveLength(6);
    expect(Object.keys(PAYMENT_PENDING_CODES)).toHaveLength(3);
    expect(Object.keys(PAYMENT_REJECTION_CODES)).toHaveLength(39);
    const pages = (p: string) => PAYINS_ERROR_ROWS.filter((r) => r.pages?.includes(p as never));
    expect(pages("payments")).toHaveLength(34);
    expect(new Set(pages("payments").map((r) => r.code)).size).toBe(33);
    expect(pages("refunds")).toHaveLength(23);
    expect(pages("cards")).toHaveLength(9);
    expect(new Set(PAYINS_ERROR_ROWS.map((r) => r.code)).size).toBe(38);
    expect(Object.keys(REFUND_STATUSES)).toHaveLength(4);
    expect(Object.keys(CHARGEBACK_STATUSES)).toHaveLength(7);
    expect(CHARGEBACK_REASON_CODES).toHaveLength(107);
    const perNetwork = new Set(CHARGEBACK_REASON_CODES.map((r) => `${r.network}:${r.code}`));
    expect(perNetwork.size).toBe(107);
    expect(CALLBACK_STATUSES.size).toBe(4);
    expect(Object.keys(PAYOUT_V3_STATUSES)).toHaveLength(7);
    expect(PAYOUT_V3_ERROR_ROWS).toHaveLength(17);
    expect(Object.keys(PAYOUT_V3_REJECTION_CODES)).toHaveLength(21);
    expect(Object.keys(MERCHANT_ADVICE_CODES)).toHaveLength(11);
  });

  it("uses only the plain hyphen in sources and fixtures", () => {
    const files = [
      ...readdirSync(srcDir).map((f) => `${srcDir}${f}`),
      ...dlocalFiles.map((f) => `${root}dlocal/${f}`),
      fileURLToPath(import.meta.url),
    ];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(DASHES);
  });

  it("uses synthetic identifiers in every fixture", () => {
    const ID_KEYS = new Set([
      "id",
      "payment_id",
      "order_id",
      "authorization_id",
      "external_id",
      "order_refund_id",
      "account_id",
      "cashout_id",
    ]);
    let checked = 0;
    const walk = (v: unknown, path: string): void => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          if (ID_KEYS.has(k) && typeof x === "string") {
            expect(x, `${path}.${k}`).toMatch(/PPLsynth|PPLSYNTH|PLANTED/);
            checked++;
          }
          walk(x, `${path}.${k}`);
        }
    };
    for (const f of dlocalFiles) {
      const parsed = parseInput(fixture(`dlocal/${f}`));
      if (!parsed.ok) throw new Error(`${f}: ${parsed.error.message}`);
      walk(parsed.value.records, f);
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe("dlocal detection", () => {
  it("recognizes every dLocal fixture", () => {
    for (const f of dlocalFiles) {
      for (const { payload, meta } of recordsOf(`${root}dlocal/${f}`)) {
        const d = dlocalAdapter.detect(payload, meta);
        expect(d.confidence, f).toBeGreaterThanOrEqual(0.5);
        expect(d.format, f).toMatch(/^dlocal\./);
      }
    }
  });

  it("does not claim generic shapes above 0.5", () => {
    const d = (v: unknown, meta?: Parameters<typeof dlocalAdapter.detect>[1]) =>
      dlocalAdapter.detect(v, meta).confidence;
    expect(d({ code: 5005, message: "User unauthorized due to cadastral situation" })).toBe(0.5);
    expect(
      d(
        { code: 5005, message: "x" },
        { format: "http", http: { kind: "response", status: 500, headers: {} } },
      ),
    ).toBe(0.4);
    expect(d({ code: 5999, message: "x" })).toBe(0.25);
    expect(d({ code: 42, message: "x" })).toBe(0);
    expect(d({ code: 5005, message: "x", details: "y" })).toBe(0);
    expect(d({ code: 5005 })).toBe(0);
    expect(d({ error: { code: 5005, message: "x" } })).toBe(0);
    expect(d({ status: "PAID" })).toBe(0);
    expect(
      d({ id: "x", status: "PAID", status_code: "200", status_detail: "The payment was paid." }),
    ).toBe(0);
    expect(d({ payment_id: "x", status: "PENDING", reason: "y" })).toBe(0);
    expect(d({ beneficiary: {}, purpose: "x", status: "PAID" })).toBe(0);
    expect(d({ ...payment(), object: "charge" })).toBe(0);
    expect(d(null)).toBe(0);
    expect(d([])).toBe(0);
    expect(d("status=PAID")).toBe(0);
  });

  it("tells payments, refunds, chargebacks and payouts apart", () => {
    expect(dlocalAdapter.detect(payment()).format).toBe(DLOCAL_FORMATS.payment);
    expect(dlocalAdapter.detect(refund()).format).toBe(DLOCAL_FORMATS.refund);
    expect(dlocalAdapter.detect(chargeback()).format).toBe(DLOCAL_FORMATS.chargeback);
    expect(dlocalAdapter.detect(payout()).format).toBe(DLOCAL_FORMATS.payout);
    // An ARN refund notification carries arn but is a refund, not a chargeback.
    expect(dlocalAdapter.detect(refund({ type: "REFUND", arn: "x" })).format).toBe(
      DLOCAL_FORMATS.refund,
    );
  });

  it.each(
    readdirSync(root).filter(
      (d) =>
        d !== "dlocal" &&
        statSync(`${root}${d}`).isDirectory() &&
        readdirSync(`${root}${d}`).length > 0,
    ),
  )("returns confidence 0 for every record in fixtures/%s", (dir) => {
    for (const file of readdirSync(`${root}${dir}`)) {
      if (!statSync(`${root}${dir}/${file}`).isFile()) continue;
      recordsOf(`${root}${dir}/${file}`).forEach(({ payload, meta }, i) => {
        expect(dlocalAdapter.detect(payload, meta).confidence, `${dir}/${file} record ${i}`).toBe(
          0,
        );
      });
    }
  });

  it("covers the Stripe, Adyen and AstroPay fixtures in that check", () => {
    const dirs = readdirSync(root);
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "astropay"]));
  });

  it("is not claimed by AstroPay or any registered adapter", () => {
    for (const f of dlocalFiles) {
      recordsOf(`${root}dlocal/${f}`).forEach(({ payload, meta }, i) => {
        expect(astropayAdapter.detect(payload, meta).confidence, `astropay on ${f}`).toBe(0);
        for (const a of ADAPTERS.filter((x) => x.id !== "dlocal")) {
          expect(a.detect(payload, meta).confidence, `${a.id} on ${f} record ${i}`).toBeLessThan(
            0.5,
          );
        }
      });
    }
  });
});

describe("dlocal payments", () => {
  it("analyzes a successful card payment", () => {
    const r = analyzeFixture("card-payment-paid.json");
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events).toHaveLength(1);
    const e = r.events[0]!;
    expect(e).toMatchObject({
      provider: "dlocal",
      eventType: "payment.PAID",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "PAID",
      paymentReference: "D-4-PPLsynth-pay-0001",
      merchantReference: "PPLsynth-order-0001",
      amountMinor: "12050",
      currency: "BRL",
      eventTimestamp: "2026-10-20T10:00:02.000Z",
    });
    expect(e.attributes).toMatchObject({
      objectType: "payment",
      statusCode: "200",
      paymentMethodType: "CARD",
      paymentMethodFlow: "DIRECT",
      cardBrand: "VI",
      timestampSource: "approved_date",
    });
    expect(r.errors).toHaveLength(0);
    expect(r.findings).toHaveLength(0);
  });

  it("decodes a decline with the acquirer block", () => {
    const r = analyzeFixture("card-declined-insufficient-funds.json");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "302",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "T-4-PPLsynth-pay-0002",
      attemptReference: "T-4-PPLsynth-pay-0002",
      subCodes: { object: "payment", status: "REJECTED", network_response_code: "51" },
    });
    expect(r.errors[0]!.explanation).toMatch(/does not list the meaning of raw network codes/);
    expect(r.events[0]!.attributes.networkResponseCode).toBe("51");
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("lets a Mastercard merchant advice code decide the retry guidance", () => {
    const r = analyzeFixture("card-declined-merchant-advice.json");
    expect(r.errors[0]).toMatchObject({
      code: "301",
      category: "card_declined",
      retry: "retry_conditionally",
      subCodes: { merchant_advice_code: "24" },
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/takes precedence/);
    const hard = analyze(
      json(
        payment({
          status: "REJECTED",
          status_code: "301",
          acquirer: { network_response_code: "05", merchant_advice_code: "03" },
        }),
      ),
    );
    expect(hard.errors[0]).toMatchObject({ code: "301", retry: "do_not_retry" });
  });

  it("decodes every documented rejection code by the payment table only", () => {
    for (const [code, entry] of Object.entries(PAYMENT_REJECTION_CODES)) {
      const r = analyze(json(payment({ status: "REJECTED", status_code: code })));
      expect(r.errors[0], code).toMatchObject({
        code,
        category: entry.category,
        confidence: "strong",
      });
    }
    // Integer status codes are accepted as well.
    const n = analyze(json(payment({ status: "REJECTED", status_code: 302 })));
    expect(n.errors[0]).toMatchObject({ code: "302", category: "insufficient_funds" });
  });

  it("shows 3D Secure as a pending authentication step before the payment", () => {
    const r = analyzeFixture("3ds-pending-then-paid.json");
    expect(r.events.map((e) => [e.stage, e.outcome])).toEqual([
      ["authentication", "pending"],
      ["payment", "success"],
    ]);
    expect(r.events[0]!.attributes).toMatchObject({
      statusCode: "101",
      threeDSecureRedirect: true,
    });
    expect(json(r)).not.toContain("pay.example.com");
    expect(r.groups).toHaveLength(1);
    expect(r.errors).toHaveLength(0);
  });

  it("links authorization, capture and refund", () => {
    const r = analyzeFixture("auth-capture-refund.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment.AUTHORIZED", "authorization", "success"],
      ["payment.PAID", "capture", "success"],
      ["refund.SUCCESS", "refund", "success"],
    ]);
    expect(r.events[1]).toMatchObject({
      paymentReference: "T-4-PPLsynth-cap-0005",
      relatedReference: "T-4-PPLsynth-auth-0005",
    });
    expect(r.events[1]!.attributes.isCapture).toBe(true);
    expect(r.events[2]).toMatchObject({
      amountMinor: "4000",
      relatedReference: "REF-4-PPLsynth-0005",
    });
    expect(r.events[2]!.attributes.statusCodeType).toBe("number");
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining(["payin:T-4-PPLsynth-auth-0005", "refund:REF-4-PPLsynth-0005"]),
    );
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
  });

  it("reports a failed capture after an authorization", () => {
    const r = analyzeRecords(
      [
        payment({
          id: "T-4-PPLsynth-auth-9",
          status: "AUTHORIZED",
          status_code: "600",
          approved_date: "2026-10-20T10:00:01.000+0000",
        }),
        payment({
          id: "T-4-PPLsynth-cap-9",
          status: "REJECTED",
          status_code: "329",
          authorization_id: "T-4-PPLsynth-auth-9",
          created_date: "2026-10-28T10:00:00.000+0000",
        }),
      ],
      options,
    );
    if (!r.ok) throw new Error(r.error.message);
    expect(r.result.events[1]).toMatchObject({ stage: "capture", outcome: "failure" });
    expect(ruleIds(r.result)).toContain("CAPTURE_FAILED_AFTER_AUTHORIZATION");
    expect(r.result.errors[0]).toMatchObject({ code: "329", category: "invalid_request" });
  });

  it("keeps vouchers and bank transfers pending until the payer pays", () => {
    const transfer = analyzeFixture("bank-transfer-pending.json");
    expect(transfer.events[0]).toMatchObject({ stage: "payment", outcome: "pending" });
    expect(transfer.events[0]!.attributes.pendingReason).toMatch(/Bank transfer/);
    expect(ruleIds(transfer)).toContain("UNRESOLVED_OUTCOME");
    expect(json(transfer.events)).not.toContain("payment_instruction");

    const voucher = analyzeFixture("voucher-pending-then-expired.json");
    expect(voucher.events.map((e) => e.outcome)).toEqual(["pending", "failure"]);
    expect(voucher.events[0]!.attributes.pendingReason).toMatch(/voucher/);
    expect(voucher.errors[0]).toMatchObject({
      code: "340",
      retry: "customer_action_required",
      confidence: "strong",
    });
    expect(voucher.groups).toHaveLength(1);
  });

  it("reads zero-amount verification, cancellation and pending retries", () => {
    const verified = analyze(json(payment({ amount: 0, status: "VERIFIED", status_code: "700" })));
    expect(verified.events[0]).toMatchObject({
      stage: "authorization",
      outcome: "success",
      amountMinor: "0",
    });
    expect(verified.events[0]!.attributes.zeroAmountVerification).toBe(true);

    const cancelled = analyze(json(payment({ status: "CANCELLED", status_code: "400" })));
    expect(cancelled.events[0]).toMatchObject({ stage: "cancellation", outcome: "failure" });

    const retry = analyze(
      json(
        payment({
          payment_method_type: "TICKET",
          payment_method_id: "PQ",
          status: "PENDING",
          status_code: "102",
          retry: { remaining_attempts: 2, last_attemptable_date: "2026-10-30T00:00:00.000+0000" },
        }),
      ),
    );
    expect(retry.events[0]!.attributes).toMatchObject({
      statusCode: "102",
      retryRemainingAttempts: 2,
      retryLastAttemptableDate: "2026-10-30T00:00:00.000Z",
    });
  });

  it("is honest about unknown statuses and codes", () => {
    const unknownCode = analyze(json(payment({ status: "REJECTED", status_code: "399" })));
    expect(unknownCode.errors[0]).toMatchObject({
      code: "399",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknownCode.errors[0]!.missingInformation.join(" ")).toMatch(
      /not in the PandaPayLens catalog/,
    );
    expect(unknownCode.events[0]!.attributes.statusCodeKnown).toBe(false);

    const unknownStatus = analyze(json(payment({ status: "SETTLED", status_code: "900" })));
    expect(unknownStatus.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
    expect(ruleIds(unknownStatus)).toContain("UNKNOWN_EVENT_TYPE");

    const mismatch = analyze(json(payment({ status: "PAID", status_code: "300" })));
    expect(mismatch.events[0]).toMatchObject({ outcome: "success" });
    expect(mismatch.events[0]!.attributes.statusCodeMismatch).toBe(true);
  });

  it("keeps unrelated payments apart", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: "309", paymentReference: "D-4-PPLsynth-pay-0023" });
    // The same merchant order_id does not link two payments.
    const sameOrder = analyzeRecords(
      [payment({ id: "D-4-PPLsynth-a" }), payment({ id: "D-4-PPLsynth-b" })],
      options,
    );
    if (!sameOrder.ok) throw new Error(sameOrder.error.message);
    expect(sameOrder.result.groups).toHaveLength(2);
  });

  it("parses dLocal dates and amounts without floats", () => {
    const r = analyze(
      json(
        payment({
          status: "PENDING",
          status_code: "100",
          created_date: "2018-02-15T15:14:52-00:00",
          amount: 1000,
          currency: "CLP",
        }),
      ),
    );
    expect(r.events[0]).toMatchObject({
      eventTimestamp: "2018-02-15T15:14:52.000Z",
      amountMinor: "1000",
      currency: "CLP",
    });
    const noZone = analyze(
      json(payment({ created_date: "2018-07-012T12:00:00", approved_date: "x" })),
    );
    expect(noZone.events[0]!.eventTimestamp).toBeUndefined();
    const tooPrecise = analyze(json(payment({ amount: 10.555 })));
    expect(tooPrecise.events[0]!.amountMinor).toBeUndefined();
    expect(tooPrecise.events[0]!.attributes.amountNotConvertible).toBe(true);
    expect(statusCodeOf(" 300 ")).toBe("300");
    expect(statusCodeOf(300)).toBe("300");
    expect(statusCodeOf("3a")).toBeUndefined();
  });
});

describe("dlocal notifications", () => {
  it("reads a payment notification sent as an HTTP request", () => {
    const r = analyzeFixture("payment-notification-request.txt");
    expect(r.records[0]!.status).toBe("analyzed");
    const e = r.events[0]!;
    expect(e.attributes).toMatchObject({
      message: "notification",
      signatureHeaderPresent: true,
      signatureVerified: false,
    });
    expect(e.deliveryKey).toBeUndefined();
    expect(json(r)).not.toContain("abababab");
  });

  it("does not invent a delivery key for repeated notifications", () => {
    const r = analyzeFixture("duplicate-notification.json");
    expect(r.events).toHaveLength(2);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(r.events.map((e) => e.observedTimestamp)).toEqual([
      "2026-10-20T14:00:05.000Z",
      "2026-10-20T15:00:05.000Z",
    ]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(ruleIds(r)).not.toContain("CONFLICTING_OBSERVATIONS");
  });

  it("reads a pending refund notification", () => {
    const r = analyzeFixture("refund-pending-notification.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "refund.PENDING",
      stage: "refund",
      outcome: "pending",
      paymentReference: "D-4-PPLsynth-pay-0012",
      relatedReference: "REF-4-PPLsynth-0012",
      merchantReference: "PPLsynth-refund-0012",
      amountMinor: "35000",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      message: "notification",
      amountRefundedMinor: "0",
    });
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("accepts refund status codes as strings or integers", () => {
    const a = analyze(json(refund({ status_code: "200" })));
    const b = analyze(json(refund({ status_code: 200 })));
    expect(a.events[0]!.outcome).toBe("success");
    expect(b.events[0]!.outcome).toBe("success");
    expect(a.events[0]!.attributes.statusCode).toBe(b.events[0]!.attributes.statusCode);
    for (const [status, info] of Object.entries(REFUND_STATUSES)) {
      const r = analyze(json(refund({ status, status_code: Number(info.code) })));
      expect(r.events[0]!.outcome, status).toBe(info.outcome);
    }
    const mismatch = analyze(json(refund({ status: "SUCCESS", status_code: 300 })));
    expect(mismatch.events[0]!.attributes.statusCodeMismatch).toBe(true);
  });

  it("follows a chargeback through its dispute", () => {
    const r = analyzeFixture("chargeback-dispute-won.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payment.PAID", "payment", "success"],
      ["chargeback.PENDING", "dispute", "pending"],
      ["chargeback.DISPUTE_RECEIVED", "dispute", "pending"],
      ["chargeback.REVERSAL", "dispute", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    const cb = r.events[1]!;
    expect(cb.attributes).toMatchObject({
      reasonCode: "10.4",
      reasonCodeKnown: true,
      reasonNetworks: ["Visa"],
      reasonFraudGroup: true,
      chargebackStage: "OTHER",
      processorId: "156",
      statusCodeType: "number",
    });
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
    expect(r.errors).toHaveLength(0);
  });

  it("shows every reading of a reason code shared by several networks", () => {
    expect(
      reasonReadings("41")
        .map((x) => x.network)
        .sort(),
    ).toEqual(["Elo", "Mexico (domestic)"]);
    const r = analyze(json(chargeback({ reason_code: 41 })));
    expect(r.events[0]!.attributes).toMatchObject({ reasonCodeAmbiguous: true, reasonCode: "41" });
    expect(r.events[0]!.attributes.reasonFraudGroup).toBe(false);
    const unknown = analyze(json(chargeback({ reason_code: "99.9" })));
    expect(unknown.events[0]!.attributes.reasonCodeKnown).toBe(false);
  });

  it("maps every chargeback status from its own table", () => {
    for (const [status, info] of Object.entries(CHARGEBACK_STATUSES)) {
      const r = analyze(json(chargeback({ status, status_code: Number(info.code) })));
      expect(r.events[0], status).toMatchObject({ stage: "dispute", outcome: info.outcome });
      expect(r.events[0]!.attributes.statusCodeMismatch).toBeUndefined();
    }
  });
});

describe("dlocal status_code is keyed on the object type", () => {
  it("reads 700 as a verified payment, a won chargeback and a payout compliance hold", () => {
    const r = analyzeFixture("status-code-700-three-objects.json");
    const by = (t: string) => r.events.find((e) => e.attributes.objectType === t)!;
    expect(by("payment")).toMatchObject({ stage: "authorization", outcome: "success" });
    expect(by("payment").attributes.statusMeaning).toMatch(/zero-amount/);
    expect(by("chargeback")).toMatchObject({ stage: "dispute", outcome: "success" });
    expect(by("chargeback").attributes.statusMeaning).toMatch(/for the merchant/);
    expect(by("payout")).toMatchObject({ stage: "payout", outcome: "pending" });
    expect(by("payout").attributes.statusMeaning).toMatch(/compliance/);
    expect(r.groups).toHaveLength(3);
  });

  it("decodes rejection 306 differently for payments and payouts", () => {
    const p = analyze(json(payment({ status: "REJECTED", status_code: "306" })));
    const o = analyze(json(payout({ status: "REJECTED", status_code: "306" })));
    expect(p.errors[0]!.explanation).toMatch(/call the bank/);
    expect(o.errors[0]!.explanation).toMatch(/Beneficiary name/);
  });
});

describe("dlocal payouts", () => {
  it("decodes a rejected payout", () => {
    const r = analyzeFixture("payout-v3-rejected.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["payout.PENDING", "payout", "pending"],
      ["payout.DELIVERED", "payout", "pending"],
      ["payout.REJECTED", "payout", "failure"],
    ]);
    expect(r.events[2]!.attributes).toMatchObject({
      statusCodeMeaning: "Beneficiary name wrong or mismatched",
      statusCodeKnown: true,
      apiFamily: "Payouts v3",
      amountNotRead: true,
    });
    expect(r.errors[0]).toMatchObject({
      code: "306",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: { object: "payout", status: "REJECTED" },
    });
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(r.findings.find((f) => f.ruleId === "PAYOUT_STATUS")!.title).toBe("Payout failed");
  });

  it("shows a paid payout and its late-rejection note", () => {
    const r = analyzeFixture("payout-v3-paid.json");
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "success"]);
    expect(r.events[1]!.attributes.statusNote).toMatch(/317/);
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("handles generic and unknown payout rejections", () => {
    const generic = analyze(json(payout({ status: "REJECTED", status_code: "300" })));
    expect(generic.errors[0]).toMatchObject({
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
    });
    const unknown = analyze(json(payout({ status: "REJECTED", status_code: "399" })));
    expect(unknown.errors[0]).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    const network = analyze(json(payout({ status: "REJECTED", status_code: "332" })));
    expect(network.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(network.errors[0]!.retryExplanation).toMatch(/not paid/);
    expect(ruleIds(network)).not.toContain("POSSIBLE_RETRY_RISK");
    for (const [status, info] of Object.entries(PAYOUT_V3_STATUSES)) {
      const r = analyze(json(payout({ status, status_code: info.code })));
      expect(r.events[0], status).toMatchObject({ stage: "payout", outcome: info.outcome });
    }
    const sandbox = analyze(json(payout({ status: "BAD_REQUEST", status_code: "3000" })));
    expect(sandbox.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
  });
});

describe("dlocal HTTP errors", () => {
  it("decodes a validation error with param", () => {
    const r = analyzeFixture("http-error-missing-parameter.txt");
    expect(r.errors[0]).toMatchObject({
      code: "5001",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Missing parameter country",
      subCodes: { http_status: "400", param: "country", api_family: "Payins" },
    });
    expect(r.events[0]).toMatchObject({ stage: "error", eventType: "api_error.5001" });
    expect(r.suggestedView).toBe("decoder");
  });

  it("decodes an authentication failure by family and HTTP status", () => {
    const r = analyzeFixture("http-error-invalid-credentials.txt");
    expect(r.errors[0]).toMatchObject({
      code: "3001",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { api_family: "Payins" },
    });
    // The same number is "empty parameter" in Payouts v3, documented with HTTP 400.
    const payouts = analyze(
      http(400, "Bad Request", { code: 3001, message: "Empty params country", param: "country" }),
    );
    expect(payouts.errors[0]).toMatchObject({
      code: "3001",
      category: "invalid_request",
      subCodes: { api_family: "Payouts v3" },
    });
    // Without the HTTP status both meanings are shown.
    const bare = analyze(json({ code: 3001, message: "x" }));
    expect(bare.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
    expect(bare.errors[0]!.explanation).toMatch(/Payins.*Payouts v3/);
  });

  it("treats a timeout as an unknown outcome", () => {
    const r = analyzeFixture("http-error-timeout.txt");
    expect(r.errors[0]).toMatchObject({
      code: "5010",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/X-Idempotency-Key/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    // 5010 with HTTP 400 is a payment method problem or a payout state problem.
    const r400 = analyze(http(400, "Bad Request", { code: 5010, message: "x" }));
    expect(r400.errors[0]).toMatchObject({ category: "unknown", retry: "do_not_retry" });
    expect(r400.errors[0]!.explanation).toMatch(
      /Payment method not available.*status does not allow/,
    );
  });

  it("shows every meaning of a code shared by families and pages", () => {
    expect(apiErrorRows("5011").map((r) => r.meaning)).toHaveLength(3);
    const r = analyze(http(400, "Bad Request", { code: 5011, message: "x" }));
    expect(r.errors[0]!.explanation).toMatch(/Enrollment not found/);
    expect(r.errors[0]!.explanation).toMatch(/order_refund_id already used/);
    expect(r.errors[0]!.explanation).toMatch(/external_id already used/);
    expect(r.errors[0]!.confidence).toBe("insufficient");
    // Codes documented once keep their meaning, with dLocal's own advice.
    const busy = analyze(http(400, "Bad Request", { code: 5052, message: "x" }));
    expect(busy.errors[0]).toMatchObject({
      retry: "safe_to_retry_technical_request",
      confidence: "strong",
    });
    expect(busy.errors[0]!.retryExplanation).toMatch(/retry later/);
    const mismatch = analyze(http(404, "Not Found", { code: 5009, message: "Payout not found" }));
    expect(mismatch.errors[0]).toMatchObject({ subCodes: { api_family: "Payouts v3" } });
  });

  it("is honest about an unrecognized error code", () => {
    const r = analyze(http(400, "Bad Request", { code: 5999, message: "x" }), {
      provider: "dlocal",
    });
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.errors[0]).toMatchObject({
      code: "5999",
      category: "invalid_request",
      confidence: "possible",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
    const bare = analyze(json({ code: 5999, message: "x" }), { provider: "dlocal" });
    expect(bare.errors[0]).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    // Without a manual selection the generic shape is not analyzed.
    expect(analyze(json({ code: 5999, message: "x" })).records[0]!.status).toBe("unsupported");
  });
});

describe("dlocal robustness", () => {
  it("reports missing required fields as parse issues", () => {
    const { id: _id, ...noId } = payment();
    const r = analyze(json(noId));
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/id/);
    expect(r.warnings.some((w) => w.code === "INVALID_RECORD")).toBe(true);
    const { status: _s, ...noStatus } = chargeback();
    expect(analyze(json(noStatus)).records[0]!.status).toBe("invalid");
    const { id: _r, ...noRefundId } = refund();
    expect(analyze(json(noRefundId)).records[0]!.status).toBe("invalid");
  });

  it("never throws on malformed input", () => {
    expect(dlocalAdapter.parse({ id: 5 }, DLOCAL_FORMATS.payment)).toMatchObject({ ok: false });
    expect(dlocalAdapter.parse(payment(), "dlocal.unknown")).toMatchObject({ ok: false });
    expect(
      dlocalAdapter.parse(payment({ status_code: { x: 1 } }), DLOCAL_FORMATS.payment),
    ).toMatchObject({
      ok: false,
    });
    const bad = analyzeText('{ "id": ', options);
    expect(bad.ok).toBe(false);
    const weird = analyze(
      json(payment({ status: "rejected <b>", status_code: "-1", amount: "abc" })),
    );
    expect(weird.events[0]).toMatchObject({ eventType: "payment.unknown", outcome: "unknown" });
    expect(weird.events[0]!.amountMinor).toBeUndefined();
  });

  it("recognizes but does not analyze callbacks, Payouts v2 and Platforms notifications", () => {
    const v2 = analyzeFixture("payouts-v2-notification.txt");
    expect(v2.records[0]).toMatchObject({ status: "unsupported", format: DLOCAL_FORMATS.payoutV2 });
    expect(v2.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(
      /no status field/,
    );
    expect(json(v2)).not.toContain("EFEFEFEF");

    const platforms = analyzeFixture("platforms-notification.json");
    expect(platforms.records[0]).toMatchObject({
      status: "unsupported",
      format: DLOCAL_FORMATS.platforms,
    });

    const callback = analyzeText(
      "paymentId=D-4-PPLsynth-cb-1&status=APPROVED&date=2026-10-20T10:00:00Z&signature=PLANTEDSIG",
      options,
    );
    if (!callback.ok) throw new Error(callback.error.message);
    expect(callback.result.records[0]).toMatchObject({
      status: "unsupported",
      format: DLOCAL_FORMATS.callback,
    });
    expect(callback.result.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(
      /not to use its status/,
    );
    expect(json(callback.result)).not.toContain("PLANTEDSIG");
  });
});

describe("dlocal sensitive data", () => {
  const planted = [
    "Planted Payer Name",
    "planted.payer@example.com",
    "PLANTEDCPF0001",
    "PLANTEDDOC2",
    "PLANTEDUSERREF",
    "PLANTEDPHONE",
    "PLANTEDBIRTH",
    "PLANTEDIP",
    "PLANTEDDEVICE",
    "PLANTEDSTREET",
    "Planted Holder Name",
    "4111111111111111",
    "PLANTEDCVV",
    "2031",
    "PLANTEDLAST4",
    "PLANTEDCARDID",
    "PLANTEDTOKEN",
    "PLANTEDNTXREF",
    "PLANTEDNPREF",
    "PLANTEDTLID",
    "PLANTEDCAVV",
    "PLANTEDXID",
    "PLANTEDDSTRANS",
    "PLANTEDREDIRECT",
    "PLANTEDRESULTDOC",
    "PLANTEDACCOUNT",
    "PLANTEDNOTIFYURL",
    "PLANTEDCALLBACKURL",
    "PLANTEDARN",
    "PlantedBeneficiaryFirst",
    "PlantedBeneficiaryLast",
    "planted.beneficiary@example.com",
    "PLANTEDBENPHONE",
    "PLANTEDBENDOC",
    "PLANTEDBENACCOUNT",
    "PLANTEDBANKCODE",
    "PLANTEDBRANCH",
    "PLANTEDPIXKEY",
    "PLANTEDBENSTREET",
    "PlantedRemitterFirst",
    "PLANTEDREMDOC",
    "PLANTEDREMBIRTH",
    "PLANTEDPAYOUTURL",
  ];

  it.each(["sensitive-payment.json", "sensitive-payout-notification.json"])(
    "keeps planted values out of events and reports (%s)",
    (file) => {
      const r = analyzeFixture(file);
      expect(r.records[0]!.status).toBe("analyzed");
      expect(r.sensitiveData.detected).toBe(true);
      const events = json(r.events);
      const errors = json(r.errors);
      const report = toJsonReport(r);
      for (const v of planted) {
        expect(events, v).not.toContain(v);
        expect(errors, v).not.toContain(v);
        expect(report, v).not.toContain(v);
      }
    },
  );

  it("does not copy the payment's arn or the payout's beneficiary", () => {
    const r = analyzeFixture("sensitive-payment.json");
    expect(r.events[0]!.attributes.arnPresent).toBe(true);
    const keys = Object.keys(r.events[0]!.attributes);
    for (const k of ["payer", "card", "document", "notificationUrl", "arn"])
      expect(keys).not.toContain(k);
  });
});
