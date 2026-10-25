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
  type RecordMeta,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { ADAPTERS } from "@pandapaylens/providers";
import { ccbillAdapter } from "@pandapaylens/ccbill";
import { segpayAdapter } from "@pandapaylens/segpay";
import {
  APM_DESCRIPTION_CODES,
  CARD_DESCRIPTION_CODES,
  CARD_RESPONSE_DESCRIPTIONS,
  CHARGEBACK_REASONS,
  CONFLICTING_CODES,
  DISPUTE_STATUSES,
  EBANX_ADAPTER_VERSION,
  ECI_VALUES,
  ISO8583_CODES,
  MAC_CODES,
  MED_CLAIM_REASONS,
  NOTIFICATION_TYPES,
  PAYIN_ERROR_CODES,
  PAYMENT_STATUSES,
  PAYOUT_BALANCE_CODES,
  PAYOUT_ERROR_CODES,
  PAYOUT_NOTIFICATION_OPERATIONS,
  PAYOUT_RESPONSE_TYPES,
  PAYOUT_STATUSES,
  REFUND_DECLINE_CODES,
  REFUND_STATUSES,
  THREE_DS_STATUSES,
  TRANSACTION_STATUS_CODES,
  decodeStatusCode,
  ebanxAdapter,
  ebanxManifest,
} from "@pandapaylens/ebanx";
import defaultExport from "@pandapaylens/ebanx";
import { ebanxManifest as manifestOnly } from "@pandapaylens/ebanx/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [ebanxAdapter],
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

function sources(names: string[]): AnalysisResult {
  const r = analyzeSources(
    names.map((name) => ({ name, text: fixture(`ebanx/${name}`) })),
    options,
  );
  if (!r.ok) throw new Error("analysis failed");
  return r.result;
}

const HASH = "PPLsynth00000000000000000000000000000000000000aa";

const payment = (fields: Record<string, unknown> = {}, top: Record<string, unknown> = {}) => ({
  payment: {
    hash: HASH,
    merchant_payment_code: "PPLsynth-order-1",
    status: "CO",
    status_date: "2026-10-20 10:00:00",
    amount_br: "10.00",
    amount_ext: "10.00",
    amount_iof: "0.00",
    currency_ext: "BRL",
    payment_type_code: "creditcard",
    ...fields,
  },
  status: "SUCCESS",
  ...top,
});

const declined = (ts: Record<string, unknown>, fields: Record<string, unknown> = {}) =>
  payment({
    status: "CA",
    transaction_status: { acquirer: "EBANX", code: "NOK", ...ts },
    ...fields,
  });

const error = (code: string, msg?: string, extra: Record<string, unknown> = {}) => ({
  status: "ERROR",
  status_code: code,
  ...(msg !== undefined ? { status_message: msg } : {}),
  ...extra,
});

const notification = (type: string, hashes: string, op = "payment_status_change") =>
  `operation=${op}&notification_type=${type}&hash_codes=${hashes}`;

const firstError = (input: unknown) => analyze(json(input)).errors[0]!;
const firstEvent = (input: unknown) => analyze(json(input)).events[0]!;

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));

/** Every record of every file in a fixtures folder, unwrapped from receipt envelopes. */
function records(dir: string) {
  const out: { name: string; payload: unknown; meta: RecordMeta | undefined }[] = [];
  for (const file of readdirSync(`${FIXTURES}${dir}`)) {
    const parsed = parseInput(readFileSync(`${FIXTURES}${dir}/${file}`, "utf8"));
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
}

describe("ebanx detection", () => {
  it.each([
    ["query-chargeback.json", "ebanx.payin_response", 0.95],
    ["card-auth-capture-refund.json", "ebanx.payin_response", 0.95],
    ["pix-automatico-timeout.json", "ebanx.payin_response", 0.95],
    ["cancel-response.json", "ebanx.payin_response", 0.95],
    ["unrelated-payments.json", "ebanx.payin_response", 0.85],
    ["error-integration-key-missing.json", "ebanx.payin_error", 0.9],
    ["direct-system-failure-timeout.txt", "ebanx.payin_error", 0.9],
    ["notification-update.txt", "ebanx.payment_notification", 0.95],
    ["notification-refund-http.txt", "ebanx.payment_notification", 0.95],
    ["payout-flow.json", "ebanx.payout_response", 0.95],
    ["payout-error-empty-amount.json", "ebanx.payout_response", 0.9],
    ["payout-notification-paid.txt", "ebanx.payout_notification", 0.95],
  ])("recognizes %s", (file, format, confidence) => {
    const r = analyzeFixture(`ebanx/${file}`);
    for (const rec of r.records)
      expect(rec).toMatchObject({ status: "analyzed", provider: "ebanx", format, confidence });
  });

  it("recognizes enrollment notifications and requests without analyzing them", () => {
    const enrollment = analyzeFixture("ebanx/enrollment-notification.txt");
    expect(enrollment.records[0]).toMatchObject({
      status: "unsupported",
      format: "ebanx.enrollment_notification",
    });
    expect(enrollment.events).toHaveLength(0);
    expect(enrollment.warnings.map((w) => w.message).join(" ")).toMatch(/enrollment notification/);

    const request = {
      integration_key: "PPLsynth-key",
      operation: "request",
      payment: {
        merchant_payment_code: "PPLsynth-order-1",
        currency_code: "BRL",
        amount_total: "10.00",
        payment_type_code: "creditcard",
      },
    };
    const r = analyze(json(request));
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "ebanx.payin_request" });
    expect(r.events).toHaveLength(0);
  });

  it("needs an EBANX-specific field next to a hash and keeps weak notification bodies below the threshold", () => {
    expect(ebanxAdapter.detect({ payment: { hash: "PPLsynth-1", status: "CO" } }).confidence).toBe(
      0,
    );
    expect(
      ebanxAdapter.detect({ payment: { hash: HASH, status: "CO" }, status: "SUCCESS" }).confidence,
    ).toBe(0);
    const min = ebanxAdapter.detect({ payment: { hash: HASH, amount_ext: "1.00" } });
    expect(min.confidence).toBeLessThan(0.5);

    const opOnly = parseInput("operation=payment_status_change");
    if (!opOnly.ok) throw new Error("parse failed");
    expect(ebanxAdapter.detect(opOnly.value.records[0], opOnly.value.meta[0]).confidence).toBe(0.4);
    expect(analyze("operation=payment_status_change").records[0]!.status).toBe("unsupported");
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "ebanx", message: "EBANX error" },
      "ebanx",
      null,
      [],
      { status: "ERROR" },
      { status: "SUCCESS" },
      { status: "ERROR", status_code: "123", status_message: "x" },
      { status: "ERROR", status_code: "E-1", status_message: "x" },
      { status_code: "BP-DR-17", status_message: "x" },
      { error: { code: "BP-DR-17" } },
      { hash: HASH, status: "CO" },
      { payment: { status: "CO" } },
      { payment: "x", status: "SUCCESS" },
      { type: "success", message: "ok" },
      { type: "invalid_request_error", message: "x" },
      { type: "invalid_request_error", code: "invalid_amount", message: "x" },
      { object: "payment_intent", payment: { hash: HASH, merchant_payment_code: "x" } },
      { operation: "refund", notification_type: "wpf" },
      { notification_type: "update" },
      { hash_codes: HASH },
    ]) {
      expect(ebanxAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("ignores JSON-only formats when the input is form data", () => {
    expect(ebanxAdapter.detect(payment(), { format: "form" }).confidence).toBe(0);
  });

  // Adapters still being written can have empty folders.
  const dirs = readdirSync(FIXTURES).filter(
    (d) =>
      d !== "ebanx" &&
      statSync(`${FIXTURES}${d}`).isDirectory() &&
      readdirSync(`${FIXTURES}${d}`).length > 0,
  );

  it("includes the Stripe, Adyen, CCBill and Segpay fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "ccbill", "segpay"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const list = records(dir);
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) expect(ebanxAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
  });

  it("is not claimed by CCBill, Segpay or any other registered adapter", () => {
    const list = records("ebanx");
    expect(list.length).toBeGreaterThan(25);
    for (const r of list) {
      expect(ccbillAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
      expect(segpayAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
      for (const adapter of ADAPTERS.filter((a) => a.id !== "ebanx"))
        expect(adapter.detect(r.payload, r.meta).confidence, `${adapter.id}: ${r.name}`).toBe(0);
    }
  });
});

describe("ebanx parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noStatus = payment();
    delete (noStatus.payment as Record<string, unknown>).status;
    const r = analyze(json(noStatus));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "ebanx.payin_response" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/payment\.status/);

    const noHashes = analyze("operation=payment_status_change&notification_type=update");
    expect(noHashes.records[0]).toMatchObject({
      status: "invalid",
      format: "ebanx.payment_notification",
    });
    expect(noHashes.records[0]!.reasons).toContain("hash_codes: required");

    const noOperation = analyze(`notification_type=update&hash_codes=${HASH}`);
    expect(noOperation.records[0]).toMatchObject({ status: "invalid" });
    expect(noOperation.records[0]!.reasons).toContain("operation: required");

    const payout = analyze(json({ type: "success", payout: { uid: HASH } }));
    expect(payout.records[0]).toMatchObject({ status: "invalid", format: "ebanx.payout_response" });
  });

  it("reports a repeated notification field and unknown formats", () => {
    const r = analyze(`${notification("update", HASH)}&notification_type=refund`);
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/notification_type: appears more than once/);
    expect(ebanxAdapter.parse({}, "ebanx.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported EBANX format "ebanx.unknown".'],
    });
  });

  it("fails cleanly on malformed input", () => {
    const bad = analyzeText('{"payment": {"hash": ', options);
    expect(bad.ok).toBe(false);
    const wrongType = analyze(json(payment({ refunds: "none", status: 5 })));
    expect(wrongType.records[0]!.status).toBe("invalid");
    const xml = analyzeText("<payment><hash>PPLsynth</hash></payment>", options);
    expect(xml.ok).toBe(false);
  });

  it("accepts numeric amounts, nulls, unknown fields and lenient JSON", () => {
    // /ws/request examples use JSON numbers for amounts.
    const hosted = payment(
      {
        status: "OP",
        payment_type_code: "_all",
        amount_ext: 99.85,
        amount_br: 100.23,
        instalments: 1,
        transaction_status: null,
        extra: { nested: [1, 2] },
      },
      { redirect_url: "https://sandbox.ebanxpay.com/checkout?hash=PPLsynth" },
    );
    const e = firstEvent(hosted);
    expect(e).toMatchObject({ amountMinor: "9985", currency: "BRL", outcome: "pending" });
    expect(e.attributes.instalments).toBe(1);

    const lenient = analyze(`${json(payment()).slice(0, -1)},}`);
    expect(lenient.records[0]!.status).toBe("analyzed");
    expect(lenient.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
  });

  it("does not use documentation placeholders as values", () => {
    const r = analyze(
      "operation=payment_status_change&notification_type=update&hash_codes={{unique_payment_hash}}",
    );
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.events[0]!.attributes.docsPlaceholder).toBe(true);

    const e = firstEvent(payment({ status_date: "{{YYYY-MM-DD HH:mm:ss}}" }));
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.attributes.docsPlaceholder).toBe(true);
  });
});

describe("ebanx payment responses", () => {
  it("normalizes a query response with a chargeback node", () => {
    const r = analyzeFixture("ebanx/query-chargeback.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus])).toEqual([
      ["payment", "payment", "success", "CO"],
      ["chargeback", "dispute", "unknown", "Not disputed"],
    ]);
    expect(r.events[0]).toMatchObject({
      paymentReference: "PPLsynth5a15e30b970d9f9f4bc33466e42e92515c7a7ed7",
      merchantReference: "PPLsynth-1120a8eb178",
      amountMinor: "10000",
      currency: "BRL",
      eventTimestamp: "2017-11-22T20:50:18.000Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      paymentStatus: "CO",
      preApproved: true,
      captureAvailable: false,
      transactionStatusCode: "OK",
      timestampZone: expect.stringMatching(/UTC/),
    });
    expect(r.events[1]!.attributes).toMatchObject({
      reasonCode: "0200/15",
      reasonGroup: "Commercial Disagreement",
      disputable: true,
      disputeStatus: "Not disputed",
      disputeFinal: true,
      settled: false,
    });
    expect(r.errors).toHaveLength(0);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
    expect(r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED")!.title).toBe(
      "Chargeback after a successful payment",
    );
  });

  it("builds one timeline for authorization, capture and a refund", () => {
    const r = analyzeFixture("ebanx/card-auth-capture-refund.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.providerStatus])).toEqual([
      ["payment", "authorization", "success", "PE"],
      ["payment", "payment", "success", "CO"],
      ["payment", "payment", "success", "CO"],
      ["payment", "payment", "success", "CO"],
      ["refund", "refund", "pending", "RE"],
      ["refund", "refund", "success", "CO"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual([
      "hash:PPLsynth8c1f0e2d3b4a59687766554433221100aabbccdd",
    ]);
    const refund = r.events.at(-1)!;
    expect(refund).toMatchObject({
      amountMinor: "4000",
      relatedReference: "PPLsynth-refund-3001",
      eventTimestamp: "2026-10-22T10:00:00.000Z",
    });
    expect(refund.attributes.timestampField).toBe("confirm_date");
    expect(r.events[3]!.attributes.settlementDate).toBe("2026-11-19T00:00:00.000Z");
    expect(r.errors).toHaveLength(0);
    for (const id of ["AMOUNT_MISMATCH", "REFUND_PENDING", "UNRESOLVED_OUTCOME", "PAYMENT_FAILURE"])
      expect(ruleIds(r)).not.toContain(id);
  });

  it("decodes a card decline with ISO 8583 and MAC codes", () => {
    const r = analyzeFixture("ebanx/card-declined-insufficient-funds.json");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      providerStatus: "CA",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Insufficient funds",
      attemptReference: "PPLsynth2b7e151628aed2a6abf7158809cf4f3c762e7160",
      subCodes: {
        description_code: "INSUFFICIENT_FUNDS",
        iso_code: "51",
        mac_code: "24",
        "transaction_status.code": "NOK",
        "payment.status": "CA",
      },
    });
    expect(r.errors[0]!.explanation).toMatch(/ISO 8583 code 51/);
    expect(r.errors[0]!.explanation).toMatch(/Retry after 1 hour/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
  });

  it("uses the stricter guidance of a Mastercard advice code and NO_RETRY", () => {
    const mac = firstError(declined({ description_code: "NO_ACCEPTED_RETRYABLE", mac_code: "03" }));
    expect(mac).toMatchObject({ code: "NO_ACCEPTED_RETRYABLE", retry: "do_not_retry" });
    expect(mac.explanation).toMatch(/stricter retry guidance/);
    const informational = firstError(
      declined({ description_code: "ISSUER_DECLINE", mac_code: "40" }),
    );
    expect(informational.retry).toBe("customer_action_required");
    const noRetry = firstError(declined({ code: "NO_RETRY", description_code: "ISSUER_DECLINE" }));
    expect(noRetry.retry).toBe("do_not_retry");
    expect(noRetry.explanation).toMatch(/NO_RETRY/);
  });

  it("decodes an APM decline from the APM table", () => {
    const r = analyzeFixture("ebanx/pix-automatico-timeout.json");
    expect(r.events[0]!.attributes).toMatchObject({
      descriptionCodeTable: "apm",
      acquirer: "EBANX IP",
      country: "BR",
    });
    expect(r.errors[0]).toMatchObject({
      code: "TIMEOUT",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.documentation.map((d) => d.url).join(" ")).toMatch(/apm-error-codes/);
  });

  it("never presents a retry as safe while the attempt can still succeed", () => {
    const final = firstError(declined({ description_code: "TIMEOUT" }));
    expect(final).toMatchObject({ retry: "safe_to_retry_technical_request", outcomeKnown: true });
    expect(final.retryExplanation).toMatch(/\/ws\/query/);
    const open = analyze(
      json(
        payment({ status: "PE", transaction_status: { code: "NOK", description_code: "TIMEOUT" } }),
      ),
    );
    expect(open.errors[0]).toMatchObject({ retry: "retry_conditionally" });
    expect(open.errors[0]!.outcomeKnown).toBeUndefined();
    expect(open.errors[0]!.explanation).toMatch(/may still succeed/);
    expect(ruleIds(open)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("chooses the card or APM table and admits when it cannot", () => {
    const card = firstError(declined({ description_code: "INVALID_DUE_DATE" }));
    expect(card).toMatchObject({ retry: "customer_action_required", confidence: "strong" });
    const apm = firstError(
      declined({ description_code: "INVALID_DUE_DATE" }, { payment_type_code: "boleto" }),
    );
    expect(apm).toMatchObject({ retry: "do_not_retry", confidence: "strong" });
    const unclear = analyze(
      json(declined({ description_code: "INVALID_DUE_DATE" }, { payment_type_code: "PPLsynth" })),
    );
    expect(unclear.errors[0]).toMatchObject({ confidence: "possible", retry: "do_not_retry" });
    expect(unclear.events[0]!.attributes.descriptionCodeTable).toBe("both");
    const crossed = firstError(declined({ description_code: "MANDATE_REVOKED" }));
    expect(crossed.confidence).toBe("possible");
    expect(crossed.missingInformation.join(" ")).toMatch(/documented for APMs/);
  });

  it("falls back to the card description text and to the ISO code", () => {
    const text = firstError(declined({ description: "Security code mismatch" }));
    expect(text).toMatchObject({
      code: "Security code mismatch",
      category: "card_declined",
      confidence: "strong",
    });
    const iso = firstError(declined({ iso_code: "05" }));
    expect(iso).toMatchObject({ code: "05", category: "card_declined", confidence: "possible" });
    expect(iso.missingInformation.join(" ")).toMatch(/interpret ISO 8583 codes differently/);
  });

  it("reports unknown codes and reasonless declines honestly", () => {
    const r = analyze(json(declined({ description_code: "PPLSYNTH_UNKNOWN_CODE" })));
    expect(r.errors[0]).toMatchObject({
      code: "PPLSYNTH_UNKNOWN_CODE",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.events[0]!.attributes.descriptionCodeKnown).toBe(false);
    const bare = firstError(declined({}));
    expect(bare).toMatchObject({ code: "NOK", category: "unknown", confidence: "insufficient" });
    const refund = firstError(declined({ description_code: "REFUND_DECLINED_DUE_RISK_RULES" }));
    expect(refund).toMatchObject({ category: "fraud_or_risk", confidence: "possible" });
    const status = firstEvent(payment({ status: "XX" }));
    expect(status).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(status.attributes.paymentStatusKnown).toBe(false);
  });

  it("shows cancellations as cancellations, not as declines", () => {
    const r = analyzeFixture("ebanx/cancel-response.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.cancel",
      stage: "cancellation",
      outcome: "success",
      currency: "MXN",
      amountMinor: "35000",
    });
    expect(r.errors).toHaveLength(0);
    const byPayer = analyze(
      json(
        declined(
          { description_code: "CANCELED_BY_PAYER" },
          { payment_type_code: "pix-automatico" },
        ),
      ),
    );
    expect(byPayer.events[0]).toMatchObject({ stage: "cancellation", outcome: "success" });
    expect(byPayer.events[0]!.attributes.cancelledBy).toBe("CANCELED_BY_PAYER");
    expect(byPayer.errors).toHaveLength(0);
    expect(ruleIds(byPayer)).not.toContain("PAYMENT_FAILURE");
  });

  it("separates authentication, pending vouchers and refund cancellations", () => {
    const challenge = firstEvent(
      payment({
        status: "OP",
        threedsecure: { status: "PENDING_AUTHENTICATION" },
        transaction_status: { code: "PENDING_AUTHENTICATION" },
      }),
    );
    expect(challenge).toMatchObject({ stage: "authentication", outcome: "pending" });

    const boleto = analyzeFixture("ebanx/boleto-direct-pending.json");
    expect(boleto.events[0]).toMatchObject({ stage: "payment", outcome: "pending" });
    expect(ruleIds(boleto)).toContain("UNRESOLVED_OUTCOME");

    const cancelled = analyze(
      json(
        payment({
          refunds: [
            {
              id: "PPLsynth-rf-1",
              status: "CA",
              request_date: "2026-10-21 09:00:00",
              cancel_date: "2026-10-21 10:00:00",
              amount_ext: "5.00",
            },
            { id: "PPLsynth-rf-2", status: "ZZ", amount_ext: "1.00" },
            "not a refund",
          ],
        }),
      ),
    );
    const refunds = cancelled.events.filter((e) => e.eventType === "refund");
    expect(refunds.map((e) => [e.providerStatus, e.outcome, e.eventTypeKnown])).toEqual([
      ["CA", "failure", true],
      ["ZZ", "unknown", false],
    ]);
    expect(refunds[0]!.attributes.timestampField).toBe("cancel_date");
  });

  it("flags a pending 3DS challenge on a confirmed payment and decodes a failed one", () => {
    const conflict = analyzeFixture("ebanx/three-ds-pending-on-confirmed.json");
    expect(conflict.events[0]).toMatchObject({ outcome: "success", providerStatus: "CO" });
    expect(conflict.events[0]!.attributes).toMatchObject({
      threeDsStatus: "PENDING_AUTHENTICATION",
      threeDsStatusConflict: true,
    });

    const failed = analyzeFixture("ebanx/card-3ds-failed.json");
    expect(failed.errors).toHaveLength(1);
    expect(failed.errors[0]).toMatchObject({
      code: "UNABLE_TO_AUTHENTICATE",
      category: "authentication_failed",
      retry: "retry_conditionally",
    });
    expect(failed.events[0]!.attributes).toMatchObject({ eci: "07", threeDsLiability: "MERCHANT" });
  });

  it("shows a completed Pix MED claim as a reversal", () => {
    const r = analyzeFixture("ebanx/pix-med-claim-query.json");
    expect(r.events[1]).toMatchObject({
      eventType: "claim.med",
      stage: "reversal",
      outcome: "success",
      relatedReference: "PPLsynth-med-0001",
    });
    expect(r.events[1]!.attributes.claimReason).toBe("fraud");
    expect(r.groups).toHaveLength(1);
  });

  it("keeps unrelated payments apart even with a shared order number", () => {
    const r = analyzeFixture("ebanx/unrelated-payments.json");
    expect(r.events).toHaveLength(2);
    expect(r.groups).toHaveLength(2);
  });
});

describe("ebanx error envelopes", () => {
  it("decodes an authentication failure", () => {
    const r = analyzeFixture("ebanx/error-integration-key-missing.json");
    expect(r.events[0]).toMatchObject({
      eventType: "api_error",
      stage: "error",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({
      code: "BP-SA-1",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Parameter integration_key not found",
    });
    expect(r.errors[0]!.documentation[0]!.url).toMatch(/api-error-codes/);
    expect(ruleIds(r)).not.toContain("MISSING_REFERENCE");
  });

  it("decodes a validation error", () => {
    const r = analyzeFixture("ebanx/direct-error-missing-amount.json");
    expect(r.errors[0]).toMatchObject({
      code: "BP-DR-5",
      category: "invalid_request",
      retry: "do_not_retry",
      outcomeKnown: true,
    });
    expect(firstError(error("BP-DR-17", "Email is invalid")).retry).toBe(
      "customer_action_required",
    );
  });

  it("treats a processing timeout as an unknown outcome", () => {
    const r = analyzeFixture("ebanx/direct-system-failure-timeout.txt");
    expect(r.events[0]).toMatchObject({ outcome: "unknown", stage: "error" });
    expect(r.events[0]!.attributes.httpStatus).toBe(200);
    expect(r.errors[0]).toMatchObject({
      code: "BP-DR-119",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      subCodes: { http_status: "200" },
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    expect(firstError(error("DA-3", "Too many requests"))).toMatchObject({
      category: "rate_limiting",
      retry: "retry_conditionally",
    });
  });

  it("gives codes with conflicting meanings lower confidence", () => {
    const nupay = analyzeFixture("ebanx/nupay-conflicting-code.json");
    expect(nupay.errors[0]).toMatchObject({
      code: "BP-DR-20",
      category: "insufficient_funds",
      confidence: "possible",
    });
    expect(nupay.errors[0]!.missingInformation.join(" ")).toMatch(/disagrees with the meaning/);
    expect(nupay.events[0]!.attributes.meaningConflict).toBe(true);

    const unclear = firstError(error("BP-R-5", "PPLsynth"));
    expect(unclear).toMatchObject({ confidence: "possible", category: "unknown" });
    expect(unclear.explanation).toMatch(/payment page/);
    expect(unclear.explanation).toMatch(/already retried today/);
    expect(unclear.retry).toBe("customer_action_required");

    const page = firstError(error("BP-R-5", "Parameter customer.email not informed"));
    expect(page).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(page.missingInformation.join(" ")).not.toMatch(/disagrees/);

    expect(decodeStatusCode("BP-DR-62").confidence).toBe("possible");
    expect(decodeStatusCode("BP-DR-17", "Email is invalid").category).toBe("invalid_request");
    expect(decodeStatusCode("BP-SA-2").confidence).toBe("strong");
  });

  it("matches look-alike code families exactly and reports unknown codes", () => {
    expect(decodeStatusCode("BP-US-1").explanation).toMatch(/sandbox/);
    expect(decodeStatusCode("BP-US-01").explanation).toMatch(/subscription update failed/);
    const r = analyze(json(error("BP-DR-9999", "PPLsynth")));
    expect(r.errors[0]).toMatchObject({
      code: "BP-DR-9999",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.explanation).toMatch(/payment creation \(BP-DR\)/);
    expect(r.events[0]!.attributes.statusCodeKnown).toBe(false);
  });

  it("reads the message field variant and the documented HTTP status of evidence codes", () => {
    const sub = analyze(json({ status: "ERROR", status_code: "BP-US-06", message: "Not found" }));
    expect(sub.errors[0]).toMatchObject({ code: "BP-US-06", providerMessage: "Not found" });
    expect(sub.events[0]!.attributes.messageField).toBe("message");
    const evidence = analyze(
      `HTTP/1.1 400 Bad Request\nContent-Type: application/json\n\n${json(error("BP-CH-06", "Already submitted"))}`,
    );
    expect(evidence.errors[0]).toMatchObject({ code: "BP-CH-06", category: "duplicate_request" });
    expect(evidence.errors[0]!.missingInformation.join(" ")).toMatch(/HTTP 422/);
  });
});

describe("ebanx notifications", () => {
  it("shows a notification as a signal to query, not as an outcome", () => {
    const r = analyzeFixture("ebanx/notification-update.txt");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "notification.update",
      eventTypeKnown: true,
      stage: "other",
      outcome: "unknown",
      paymentReference: "PPLsynth5a15e30b970d9f9f4bc33466e42e92515c7a7ed7",
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.providerStatus).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      carriesStatus: false,
      signatureVerified: false,
      nextStep: expect.stringMatching(/\/ws\/query/),
    });
    expect(r.errors).toHaveLength(0);
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("links the notification with the query response of the same payment", () => {
    const r = sources(["notification-update.txt", "query-chargeback.json"]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("builds one timeline for a boleto that is pending, notified twice and paid", () => {
    const r = sources([
      "boleto-direct-pending.json",
      "notification-update-duplicate.txt",
      "boleto-query-paid.json",
    ]);
    expect(r.events.map((e) => [e.eventType, e.outcome, e.providerStatus ?? null])).toEqual([
      ["payment", "pending", "PE"],
      ["payment", "success", "CO"],
      ["notification.update", "unknown", null],
      ["notification.update", "unknown", null],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[2]!.deliveryKey).toBe(r.events[3]!.deliveryKey);
    const dup = r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")!;
    expect(dup.explanation).toMatch(/EBANX documents that it can deliver the same notification/);
    expect(dup.recommendedAction).toMatch(/\/ws\/query/);
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("keeps refund and chargeback notifications without a delivery key", () => {
    const r = analyzeFixture("ebanx/notification-refund-http.txt");
    expect(r.events[0]).toMatchObject({ eventType: "notification.refund", stage: "refund" });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.events[0]!.attributes).toMatchObject({
      httpMethod: "POST",
      signaturePresent: true,
      signatureVerified: false,
    });
    const twice = analyze([notification("refund", HASH), notification("refund", HASH)].join("\n"));
    expect(twice.events).toHaveLength(2);
    expect(ruleIds(twice)).not.toContain("DUPLICATE_DELIVERY");

    const chargeback = analyze(notification("chargeback", HASH));
    expect(chargeback.events[0]).toMatchObject({ stage: "dispute", outcome: "unknown" });
    expect(ruleIds(chargeback)).toContain("CHARGEBACK_REPORTED");
    expect(analyze(notification("chargeback_credit", HASH)).events[0]!.stage).toBe("reversal");
  });

  it("splits a notification with several hashes into one event per payment", () => {
    const other = "PPLsynth00000000000000000000000000000000000000bb";
    const r = analyze(notification("update", `${HASH},${other}`));
    expect(r.events.map((e) => e.paymentReference)).toEqual([HASH, other]);
    expect(r.events[0]!.attributes.hashCount).toBe(2);
    expect(r.groups).toHaveLength(2);
  });

  it("marks undocumented notification types", () => {
    const r = analyze(notification("PPLsynth_type", HASH));
    expect(r.events[0]).toMatchObject({ eventTypeKnown: false, stage: "other" });
    expect(r.events[0]!.attributes.notificationTypeKnown).toBe(false);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("ebanx payouts", () => {
  it("shows an open and then paid payout in one group", () => {
    const r = analyzeFixture("ebanx/payout-flow.json");
    expect(r.events.map((e) => [e.stage, e.outcome, e.providerStatus, e.amountMinor])).toEqual([
      ["payout", "pending", "OP", "10000"],
      ["payout", "success", "PA", "10000"],
    ]);
    expect(r.events[0]).toMatchObject({
      currency: "USD",
      merchantReference: "PPLsynth-po-5001",
      paymentReference: "PPLsynthf0e1d2c3b4a5968778695a4b3c2d1e0f1",
    });
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("links a payout notification to the payout and reads its status from operation", () => {
    const n = analyzeFixture("ebanx/payout-notification-paid.txt");
    expect(n.events[0]).toMatchObject({
      stage: "payout",
      outcome: "success",
      providerStatus: "PA",
      deliveryKey: "payout_status_paid:PPLsynthf0e1d2c3b4a5968778695a4b3c2d1e0f1",
    });
    const r = sources(["payout-flow.json", "payout-notification-paid.txt"]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references[0]).toMatch(/^payout:/);
  });

  it("reports cancelled and reverted payouts and statuses known only from notifications", () => {
    const uid = "PPLsynth0000000000000000000000000000000cc";
    const cancelled = analyze(notification("update", uid, "payout_status_canceled"));
    expect(cancelled.events[0]).toMatchObject({ outcome: "failure", providerStatus: "CA" });
    expect(ruleIds(cancelled)).toContain("PAYOUT_STATUS");
    const reverted = analyze(json({ type: "success", payout: { uid, status: "RE" } }));
    expect(reverted.events[0]).toMatchObject({ outcome: "failure", providerStatus: "RE" });
    expect(reverted.events[0]!.attributes.statusDocumentedOnlyForNotifications).toBe(true);
    const committed = analyze(notification("update", uid, "payout_status_committed"));
    expect(committed.events[0]).toMatchObject({ outcome: "pending", providerStatus: "CM" });
  });

  it("reads payout search responses", () => {
    const r = analyze(
      json({
        type: "success",
        records: 2,
        total_pages: 1,
        payouts: [
          { uid: "PPLsynth-po-uid-1", external_reference: "PPLsynth-po-1", status: "PA" },
          { uid: "PPLsynth-po-uid-2", external_reference: "PPLsynth-po-2", status: "CA" },
        ],
      }),
    );
    expect(r.events.map((e) => e.providerStatus)).toEqual(["PA", "CA"]);
    expect(r.groups).toHaveLength(2);
  });

  it("decodes payout error codes", () => {
    const r = analyzeFixture("ebanx/payout-error-empty-amount.json");
    expect(r.events[0]).toMatchObject({ eventType: "payout_api_error", stage: "error" });
    expect(r.errors[0]).toMatchObject({
      code: "HP-CM-09",
      category: "invalid_amount",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "Empty amount",
      subCodes: { type: "invalid_request_error" },
    });
    const unknown = firstError({
      type: "invalid_request_error",
      status_code: "HP-CM-99",
      code: "HP-CM-98",
      message: "PPLsynth",
    });
    expect(unknown).toMatchObject({ category: "invalid_request", confidence: "possible" });
    expect(unknown.missingInformation.join(" ")).toMatch(/status_code and code differ/);
    expect(
      firstError({ type: "api_error", status_code: "BP-HI-0006", code: "BP-HI-0006" }),
    ).toMatchObject({
      category: "insufficient_funds",
      retry: "manual_review",
    });
    expect(firstError({ type: "request_error", code: "HP-BA-01" }).code).toBe("HP-BA-01");
  });
});

describe("ebanx sensitive data", () => {
  const PLANTED = [
    "PLANTEDREDIRECTHASH",
    "planted.mpc@example.com",
    "PLANTEDMASKEDPAN",
    "PLANTEDTOKENVALUE",
    "PLANTEDCCTOKEN",
    "PLANTEDBARCODE",
    "PLANTEDQRCODE",
    "PLANTEDNOTIFYPATH",
    "PLANTEDDESCRIPTOR",
    "PLANTEDSUBACCOUNT",
    "PLANTEDIMAGE",
    "PLANTEDVPA",
    "PLANTEDCUSTOMERDOC",
    "planted.customer@example.com",
    "Planted Customer Name",
    "PLANTEDBIRTHDATE",
    "PLANTEDPHONE",
    "Planted Street 1",
    "PLANTEDZIP",
    "planted.holder@example.com",
    "PLANTEDAUTHCODE",
    "PLANTEDTHREEDSURL",
    "PLANTEDECI",
    "PLANTEDTHREEDSREF",
    "PLANTEDREFUNDNOTE",
    "PLANTEDFILLURL",
    "PLANTEDBANKACCOUNT",
    "111.444.777-35",
    "planted.error@example.com",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    for (const file of ["sensitive-direct-response.json", "sensitive-error-message.json"]) {
      const r = analyzeFixture(`ebanx/${file}`);
      expect(r.records[0]!.status).toBe("analyzed");
      expect(r.sensitiveData.detected).toBe(true);
      expect(r.errors.length).toBeGreaterThan(0);
      const events = JSON.stringify(r.events);
      const errors = JSON.stringify(r.errors);
      const report = toJsonReport(r);
      for (const value of PLANTED) {
        expect(events, `${file}: ${value}`).not.toContain(value);
        expect(errors, `${file}: ${value}`).not.toContain(value);
        expect(report, `${file}: ${value}`).not.toContain(value);
      }
    }
    const response = analyzeFixture("ebanx/sensitive-direct-response.json");
    // An e-mail address used as merchant_payment_code is not copied as a reference.
    expect(response.events[0]!.merchantReference).toBeUndefined();
    expect(response.errors[0]!.providerMessage).toBe("Card holder [redacted] is not accepted");
    const message = analyzeFixture("ebanx/sensitive-error-message.json");
    expect(message.errors[0]!.providerMessage).toBe(
      "Parameter document [redacted] is invalid for [redacted]",
    );
  });

  it("keeps payee data and notification signatures out of the output", () => {
    for (const file of ["payout-flow.json", "notification-refund-http.txt"]) {
      const r = analyzeFixture(`ebanx/${file}`);
      const dump = JSON.stringify(r.events) + toJsonReport(r);
      for (const value of [
        "PPLsynth Payee",
        "payee.pplsynth@example.com",
        "PPLSYNTHDOC0001",
        "PPLSYNTHACCT01",
        "PPLsynth Bank",
        "PPLsynthU2lnbmF0dXJlUGxhbnRlZEZvclRlc3Rz",
        "PPLSYNTH00000000000000000000000000000000",
      ])
        expect(dump, `${file}: ${value}`).not.toContain(value);
    }
  });

  it("does not take tax ids as references", () => {
    const e = firstEvent(payment({ merchant_payment_code: "123.456.789-09" }));
    expect(e.merchantReference).toBeUndefined();
  });
});

describe("ebanx manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(ebanxAdapter);
    expect(ebanxAdapter.manifest).toBe(ebanxManifest);
    expect(manifestOnly).toBe(ebanxManifest);
    expect(ebanxAdapter.version).toBe(EBANX_ADAPTER_VERSION);
  });

  it("declares honest metadata and capabilities", () => {
    expect(ebanxManifest).toMatchObject({
      id: "ebanx",
      displayName: "EBANX",
      version: "0.1.0",
      wave: 3,
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
        correlation: "supported",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect([...ebanxManifest.categories].sort()).toEqual([
      "acquiring",
      "alternative_payment_method",
      "card_processing",
      "gateway",
    ]);
    for (const s of ebanxManifest.sectors) expect(s.source).toMatch(/^https:\/\/www\.ebanx\.com\//);
    expect(ebanxManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(
      /gambl|adult|crypto|forex/,
    );
    expect(ebanxManifest.fixtureProvenance).toMatch(/Synthetic/);
    expect(ebanxManifest.dependencies!.join(" ")).toMatch(/Braintree/);
    const limits = ebanxManifest.limitations.join(" ");
    expect(limits).toMatch(/never as a success or failure/);
    expect(limits).toMatch(/not documented/);
    expect(limits).toMatch(/partner/);
    const families = Object.fromEntries(ebanxManifest.apiFamilies.map((f) => [f.id, f.status]));
    for (const f of ebanxAdapter.supportedFormats) expect(families[f.id]).not.toBe("unsupported");
    expect(families["ebanx.enrollment_notification"]).toBe("unsupported");
    expect(families["ebanx.payin_request"]).toBe("unsupported");
  });

  it("contains every documented code, status and value set", () => {
    expect(Object.keys(PAYIN_ERROR_CODES)).toHaveLength(484);
    expect(Object.keys(PAYIN_ERROR_CODES).filter((k) => k.startsWith("BP-DR-"))).toHaveLength(197);
    expect(Object.keys(CARD_DESCRIPTION_CODES)).toHaveLength(81);
    expect(Object.keys(REFUND_DECLINE_CODES)).toHaveLength(34);
    expect(Object.keys(APM_DESCRIPTION_CODES)).toHaveLength(66);
    expect(Object.keys(CARD_RESPONSE_DESCRIPTIONS)).toHaveLength(23);
    expect(Object.keys(TRANSACTION_STATUS_CODES)).toHaveLength(6);
    expect(Object.keys(ISO8583_CODES)).toHaveLength(64);
    expect(Object.keys(MAC_CODES)).toHaveLength(14);
    expect(Object.keys(ECI_VALUES)).toHaveLength(7);
    expect(Object.keys(CHARGEBACK_REASONS)).toHaveLength(69);
    expect(Object.keys(PAYOUT_ERROR_CODES)).toHaveLength(154);
    expect(Object.keys(PAYOUT_BALANCE_CODES)).toHaveLength(2);
    expect(Object.keys(PAYMENT_STATUSES)).toEqual(["OP", "PE", "CO", "CA"]);
    expect(Object.keys(REFUND_STATUSES)).toEqual(["RE", "PE", "CO", "CA"]);
    expect(Object.keys(DISPUTE_STATUSES)).toHaveLength(6);
    expect(Object.keys(THREE_DS_STATUSES)).toHaveLength(5);
    expect(Object.keys(PAYOUT_STATUSES)).toHaveLength(8);
    expect(Object.keys(PAYOUT_NOTIFICATION_OPERATIONS)).toHaveLength(8);
    expect(Object.keys(PAYOUT_RESPONSE_TYPES)).toHaveLength(5);
    expect(Object.keys(NOTIFICATION_TYPES)).toEqual([
      "update",
      "chargeback",
      "refund",
      "chargeback_credit",
    ]);
    expect(MED_CLAIM_REASONS.size).toBe(6);
    for (const status of Object.values(PAYOUT_NOTIFICATION_OPERATIONS))
      expect(PAYOUT_STATUSES[status]).toBeDefined();
    for (const code of Object.keys(CONFLICTING_CODES))
      expect(PAYIN_ERROR_CODES[code]).toBeDefined();
    expect(PAYIN_ERROR_CODES["BP-US-1"]!.meaning).not.toBe(PAYIN_ERROR_CODES["BP-US-01"]!.meaning);
    expect(PAYIN_ERROR_CODES["BP-CH-1"]!.meaning).not.toBe(PAYIN_ERROR_CODES["BP-CH-01"]!.meaning);
  });

  it("uses no en or em dashes in published text, sources or fixtures", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const text = JSON.stringify([
      ebanxManifest,
      PAYIN_ERROR_CODES,
      CARD_DESCRIPTION_CODES,
      APM_DESCRIPTION_CODES,
      CHARGEBACK_REASONS,
      PAYOUT_ERROR_CODES,
      ISO8583_CODES,
    ]);
    expect(text).not.toMatch(dashes);
    const pkg = fileURLToPath(new URL("../", import.meta.url));
    for (const file of ["src/index.ts", "src/catalog.ts", "src/manifest.ts", "tests/ebanx.test.ts"])
      expect(readFileSync(`${pkg}${file}`, "utf8"), file).not.toMatch(dashes);
    for (const file of readdirSync(`${FIXTURES}ebanx`)) {
      const content = readFileSync(`${FIXTURES}ebanx/${file}`, "utf8");
      expect(content, file).not.toMatch(dashes);
      // Error envelopes carry no identifiers; everything else uses the marker.
      if (/hash|uid|merchant_/.test(content)) expect(content, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});
