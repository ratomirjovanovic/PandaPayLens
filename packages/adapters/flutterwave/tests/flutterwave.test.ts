import { readdirSync, readFileSync, statSync } from "node:fs";
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
  FLUTTERWAVE_ADAPTER_VERSION,
  V3_ERROR_MESSAGES,
  V3_PROCESSOR_FAILURES,
  V3_TRANSFER_FAILURES,
  V3_VELOCITY_TRIGGERS,
  V4_COLLECTION_ERRORS,
  V4_PAYOUT_ERRORS,
  V4_PROCESSOR_RESPONSES,
  V4_PROVIDER_RESPONSE_TYPES,
  flutterwaveAdapter,
  flutterwaveManifest,
} from "@pandapaylens/flutterwave";
import defaultExport from "@pandapaylens/flutterwave";
import { flutterwaveManifest as manifestOnly } from "@pandapaylens/flutterwave/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [flutterwaveAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeJson = (v: unknown) => analyze(JSON.stringify(v));
const analyzeFixture = (path: string) => analyze(fixture(`flutterwave/${path}`));
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
const detect = (v: unknown, meta?: Parameters<typeof flutterwaveAdapter.detect>[1]) =>
  flutterwaveAdapter.detect(v, meta);

const tx = (over: Record<string, unknown> = {}) => ({
  id: 900109001,
  tx_ref: "PPLsynth-order-9001",
  flw_ref: "PPLsynth/FLW900109001",
  amount: 100,
  currency: "NGN",
  charged_amount: 100,
  app_fee: 1.4,
  merchant_fee: 0,
  processor_response: "Approved by Financial Institution",
  auth_model: "PIN",
  status: "successful",
  payment_type: "card",
  created_at: "2026-10-20T10:00:00.000Z",
  account_id: 900001,
  ...over,
});
const webhook = (data: Record<string, unknown>, event = "charge.completed") => ({
  event,
  data,
  "event.type": "CARD_TRANSACTION",
});
const envelope = (
  data: unknown,
  status = "success",
  message = "Transaction fetched successfully",
) => ({
  status,
  message,
  data,
});

const DASHES = new RegExp("[\u2013\u2014]");

const fixtureDir = fileURLToPath(new URL("../../../../fixtures/flutterwave/", import.meta.url));
const ownFixtures = readdirSync(fixtureDir).sort();

describe("exports and manifest", () => {
  it("exports the adapter, manifest and version", () => {
    expect(defaultExport).toBe(flutterwaveAdapter);
    expect(manifestOnly).toBe(flutterwaveManifest);
    expect(flutterwaveAdapter.id).toBe("flutterwave");
    expect(flutterwaveAdapter.version).toBe(FLUTTERWAVE_ADAPTER_VERSION);
    expect(FLUTTERWAVE_ADAPTER_VERSION).toBe("0.1.0");
  });

  it("describes the wave 3 research honestly", () => {
    const m = flutterwaveManifest;
    expect(m.wave).toBe(3);
    expect(m.researchStatus).toBe("tested");
    expect(m.verifiedAt).toBe("2026-10-25");
    expect(m.samples).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(m.documentationAccess).toBe("public");
    expect(m.categories).toEqual([
      "gateway",
      "card_processing",
      "alternative_payment_method",
      "wallet",
    ]);
    expect(m.sectors.length).toBe(6);
    for (const s of m.sectors) expect(s.source).toMatch(/^https:\/\/developer\.flutterwave\.com\//);
    expect(m.fixtureProvenance).toMatch(/PPLsynth/);
    expect(m.delivery.ordering).toBe("not_documented");
    expect(m.delivery.duplicatesDocumented).toBe(true);
  });

  it("never claims more than the research supports", () => {
    const c = flutterwaveManifest.capabilities;
    expect(c.errorDecoding).toBe("limited");
    expect(Object.values(c)).not.toContain("experimental");
    // Overall status is supported only if every capability is.
    expect(flutterwaveManifest.status).toBe("limited");
    const formats = flutterwaveAdapter.supportedFormats.map((f) => f.id);
    for (const f of formats) expect(flutterwaveManifest.apiFamilies.map((a) => a.id)).toContain(f);
  });

  it("uses no em or en dashes in source, tests or fixtures", () => {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const files = [
      ...readdirSync(`${root}src`).map((f) => `${root}src/${f}`),
      fileURLToPath(import.meta.url),
      ...ownFixtures.map((f) => `${fixtureDir}${f}`),
    ];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(DASHES);
  });

  it("uses only synthetic identifiers in fixtures", () => {
    for (const f of ownFixtures) {
      const text = readFileSync(`${fixtureDir}${f}`, "utf8");
      if (/"(?:id|tx_ref|flw_ref|reference|webhook_id|error_id)"/.test(text))
        expect(text, f).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});

describe("catalogs", () => {
  it("transcribes the v4 code tables completely", () => {
    expect(V4_COLLECTION_ERRORS.length).toBe(77);
    expect(new Set(V4_COLLECTION_ERRORS.map((e) => e.code)).size).toBe(67);
    expect(V4_PAYOUT_ERRORS.length).toBe(70);
    expect(new Set(V4_PAYOUT_ERRORS.map((e) => e.code)).size).toBe(68);
    expect(V4_PROCESSOR_RESPONSES.length).toBe(45);
    expect(new Set(V4_PROCESSOR_RESPONSES.map((e) => e.type)).size).toBe(45);
    const all = new Set([...V4_COLLECTION_ERRORS, ...V4_PAYOUT_ERRORS].map((e) => e.code));
    for (const e of V4_PROCESSOR_RESPONSES) all.add(`p${e.code}`);
    // 180 values in three tables; 10500 is in both error tables, so 179 distinct.
    expect(all.size).toBe(179);
    expect(V4_PROVIDER_RESPONSE_TYPES.length).toBe(15);
  });

  it("lists every documented v3 message", () => {
    expect(V3_ERROR_MESSAGES.length).toBe(27);
    expect(V3_PROCESSOR_FAILURES.length).toBe(3);
    expect(V3_TRANSFER_FAILURES.length).toBe(6);
    expect(V3_VELOCITY_TRIGGERS.length).toBe(8);
    for (const e of [...V3_ERROR_MESSAGES, ...V3_PROCESSOR_FAILURES, ...V3_TRANSFER_FAILURES])
      expect(e.docs).toMatch(/^https:\/\/developer\.flutterwave\.com\//);
  });
});

describe("own fixtures", () => {
  it.each(ownFixtures)("%s is claimed by Flutterwave and never invalid", (file) => {
    const r = analyzeFixture(file);
    expect(r.records.length).toBeGreaterThan(0);
    for (const rec of r.records) {
      expect(rec.provider).toBe("flutterwave");
      expect(rec.status).not.toBe("invalid");
    }
    expect(r.warnings.filter((w) => w.code === "INVALID_RECORD")).toEqual([]);
  });
});

describe("v3 payments", () => {
  it("reads a successful verify response", () => {
    const r = analyzeFixture("v3-verify-successful.json");
    expect(r.records[0]!.format).toBe("flutterwave.v3.response");
    expect(r.records[0]!.confidence).toBeGreaterThan(0.9);
    const [e] = r.events;
    expect(e).toMatchObject({
      eventType: "transaction.snapshot",
      stage: "payment",
      outcome: "success",
      providerStatus: "successful",
      paymentReference: "900100101",
      relatedReference: "PPLsynth/FLW900100101",
      merchantReference: "PPLsynth-order-0101",
      amountMinor: "250000",
      currency: "NGN",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
    });
    expect(e!.attributes).toMatchObject({
      appFeeMinor: "3500",
      amountSettledMinor: "246500",
      authModel: "PIN",
      paymentType: "card",
      processorResponse: "Approved by Financial Institution",
      envelopeStatus: "success",
    });
    expect(r.errors).toEqual([]);
  });

  it("decodes a documented failure text from processor_response", () => {
    const r = analyzeFixture("v3-charge-completed-failed.json");
    const [e] = r.events;
    expect(e).toMatchObject({
      eventType: "charge.completed",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
      deliveryKey: "charge.completed:900100202:failed",
    });
    expect(e!.attributes.eventCategory).toBe("CARD_TRANSACTION");
    const [err] = r.errors;
    expect(err).toMatchObject({
      code: "invalid token supplied",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "900100202",
      attemptReference: "900100202",
    });
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("shows an unknown failure text honestly", () => {
    const r = analyzeJson(
      webhook(tx({ status: "failed", processor_response: "PPLsynth new reason 77" })),
    );
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.events[0]!.attributes.processorResponseDocumented).toBe(false);
    expect(r.events[0]!.attributes.processorResponse).toBeUndefined();
    const [err] = r.errors;
    expect(err).toMatchObject({
      code: "failed",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "PPLsynth new reason 77",
      outcomeKnown: true,
    });
    expect(err!.missingInformation.join(" ")).toMatch(/not among the messages/);
  });

  it("decodes card velocity trigger names with possible confidence", () => {
    const r = analyzeJson(webhook(tx({ status: "failed", processor_response: "Suspected fraud" })));
    expect(r.errors[0]).toMatchObject({
      code: "Suspected fraud",
      category: "fraud_or_risk",
      retry: "do_not_retry",
      confidence: "possible",
    });
  });

  it("keeps mobile money pending until the webhook, even with a success-like text", () => {
    const r = analyzeFixture("v3-mpesa-pending-then-successful.json");
    expect(r.events.map((e) => [e.stage, e.outcome])).toEqual([
      ["payment", "pending"],
      ["payment", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("reports a pending mobile money charge as unresolved", () => {
    const r = analyzeJson(
      envelope(
        tx({
          status: "pending",
          processor_response: "Transaction in progress",
          payment_type: "mpesa",
        }),
        "success",
        "Charge initiated",
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "pending" });
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("treats an OTP prompt as authentication and hides the masked phone number", () => {
    const r = analyzeJson(
      envelope(
        tx({ status: "pending", processor_response: "Kindly enter the OTP sent to *******0199" }),
        "success",
        "Charge initiated",
      ),
    );
    expect(r.events[0]).toMatchObject({ stage: "authentication", outcome: "pending" });
    expect(r.events[0]!.attributes.processorResponse).toBe(
      "Kindly enter the OTP sent to [redacted]",
    );
    expect(JSON.stringify(r)).not.toContain("0199");
  });

  it("reads an authorization prompt without data", () => {
    const r = analyzeJson({
      status: "success",
      message: "Charge authorization data required",
      meta: { authorization: { mode: "pin", fields: ["pin"] } },
    });
    expect(r.events[0]).toMatchObject({
      eventType: "authorization.pin",
      stage: "authentication",
      outcome: "pending",
    });
  });

  it("keeps a bank transfer charge pending and never copies the account details", () => {
    const r = analyzeFixture("v3-bank-transfer-initiated.json");
    expect(r.events[0]).toMatchObject({
      eventType: "authorization.banktransfer",
      stage: "payment",
      outcome: "pending",
    });
    expect(JSON.stringify(r.events)).not.toContain("0000001515");
  });

  it("shows a void as a void, not as a payment success", () => {
    const r = analyzeFixture("v3-preauth-then-void.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["preauth-card", "authorization", "success"],
      ["transaction.snapshot", "void", "success"],
    ]);
    expect(r.events[1]!.attributes.operation).toBe("void");
    expect(r.events.some((e) => e.stage === "payment" && e.outcome === "success")).toBe(false);
    expect(r.groups).toHaveLength(1);
  });

  it("reads a preauth capture as a capture", () => {
    const r = analyzeJson(webhook(tx({ charge_type: "preauth", status: "successful" })));
    expect(r.events[0]).toMatchObject({ stage: "capture", outcome: "success" });
  });

  it("shows unknown statuses as unknown", () => {
    const r = analyzeJson(envelope(tx({ status: "PPLsynth-weird" })));
    expect(r.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
  });
});

describe("v3 errors", () => {
  it("decodes an authorization error with the HTTP status", () => {
    const r = analyzeFixture("v3-authorization-required.txt");
    expect(r.records[0]!.confidence).toBe(0.5);
    expect(r.events[0]).toMatchObject({
      stage: "error",
      providerStatus: "HTTP 401",
      outcome: "unknown",
    });
    expect(r.errors[0]).toMatchObject({
      code: "Authorization required",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { field: "message", http_status: "401" },
    });
  });

  it("treats a 503 timeout as an unknown outcome to verify first", () => {
    const r = analyzeFixture("v3-timeout-503.txt");
    expect(r.errors[0]).toMatchObject({
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.outcomeKnown).toBeUndefined();
    expect(r.errors[0]!.retryExplanation).toMatch(/query the status first/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes the v3 server error shape", () => {
    const r = analyzeFixture("v3-server-error.json");
    expect(r.records[0]!.format).toBe("flutterwave.v3.server_error");
    expect(r.errors[0]).toMatchObject({
      code: "Application error. Please contact support",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      subCodes: { code: "app_error" },
    });
  });

  it("decodes a card velocity message by its documented prefix", () => {
    const r = analyzeFixture("v3-velocity-card-expired.json");
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.errors[0]).toMatchObject({
      code: "Card expired. You've exceeded the failed attempt limit on this card.",
      category: "card_declined",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/against automatic retries/);
  });

  it("uses the HTTP status for an undocumented message, with possible confidence", () => {
    const r = analyze(
      `HTTP/1.1 500 Internal Server Error\ncontent-type: application/json\n\n${JSON.stringify(
        envelope(
          tx({ status: "failed", processor_response: "invalid token supplied" }),
          "error",
          "PPLsynth",
        ),
      )}`,
    );
    // The transaction failure is more specific than the envelope.
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.code).toBe("invalid token supplied");
    const bare = analyzeJson({
      status: "error",
      message: "Merchant is not enabled for Capitec Collections",
      data: null,
    });
    expect(bare.errors[0]).toMatchObject({ category: "configuration", confidence: "strong" });
  });

  it("does not analyze a generic error envelope automatically", () => {
    const generic = { status: "error", message: "something PPLsynth went wrong", data: null };
    expect(detect(generic).confidence).toBe(0);
    const template = { status: "error", message: "amount is required", data: null };
    expect(detect(template).confidence).toBe(0.45);
    // With the provider selected manually it is decoded from the template.
    const r = analyze(JSON.stringify(template), { provider: "flutterwave" });
    expect(r.errors[0]).toMatchObject({ code: "<field> is required", category: "invalid_request" });
  });
});

describe("v3 transfers", () => {
  it("reports a failed payout with the documented reason", () => {
    const r = analyzeFixture("v3-transfer-failed-webhook.json");
    expect(r.events[0]).toMatchObject({
      eventType: "transfer.completed",
      stage: "payout",
      outcome: "failure",
      amountMinor: "500000000",
      deliveryKey: "transfer.completed:600200401:FAILED",
    });
    expect(r.errors[0]).toMatchObject({
      code: "DISBURSE FAILED: You can only spend",
      category: "invalid_amount",
      retry: "do_not_retry",
    });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("decodes a 400 transfer creation failure from complete_message", () => {
    const r = analyzeFixture("v3-transfer-creation-failed.txt");
    expect(r.events[0]).toMatchObject({ stage: "payout", outcome: "failure" });
    expect(r.events[0]!.attributes).toMatchObject({ httpStatus: 400, envelopeStatus: "error" });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "beneficiary_name is required",
      subCodes: { field: "complete_message", envelope_message: "Transfer creation failed" },
    });
  });

  it("links a retry to the original transfer and flags repeated failing attempts", () => {
    const r = analyzeFixture("v3-transfer-retry-failed.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]!.attributes.isRetry).toBe(true);
    const risk = r.findings.find((f) => f.ruleId === "POSSIBLE_RETRY_RISK");
    expect(risk?.title).toMatch(/attempts after a do-not-retry error/);
    expect(risk?.recommendedAction).toMatch(/payout/);
  });

  it("does not show wallet funding as a payout", () => {
    const r = analyzeFixture("v3-wallet-funding.json");
    expect(r.events[0]).toMatchObject({ stage: "other", outcome: "success", amountMinor: "1070" });
    expect(r.events[0]!.attributes.direction).toBe("inflow");
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("decodes an undocumented DISBURSE FAILED reason with possible confidence", () => {
    const r = analyzeJson({
      event: "transfer.completed",
      "event.type": "Transfer",
      data: {
        id: 600209001,
        status: "FAILED",
        reference: "PPLsynth-payout-9001",
        complete_message: "DISBURSE FAILED: PPLsynth unlisted reason",
        requires_approval: 0,
        is_approved: 1,
        currency: "NGN",
        amount: 10,
      },
    });
    expect(r.errors[0]).toMatchObject({
      code: "DISBURSE FAILED:",
      confidence: "possible",
      retry: "manual_review",
    });
  });

  it("keeps a transfer and a transaction with the same number apart", () => {
    const r = analyze(
      JSON.stringify([
        webhook(tx({ id: 4242 })),
        {
          event: "transfer.completed",
          "event.type": "Transfer",
          data: {
            id: 4242,
            status: "SUCCESSFUL",
            reference: "PPLsynth-payout-4242",
            complete_message: "Successful",
            requires_approval: 0,
            is_approved: 1,
          },
        },
      ]),
    );
    expect(r.groups).toHaveLength(2);
  });
});

describe("v3 refunds and chargebacks", () => {
  it("keeps refund status completed pending and links the refund webhook", () => {
    const r = analyzeFixture("v3-refund-initiated-then-completed.json");
    expect(r.events.map((e) => [e.stage, e.providerStatus, e.outcome])).toEqual([
      ["payment", "successful", "success"],
      ["refund", "completed", "pending"],
      ["refund", "completed-mpgs", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("REFUND_PENDING");
  });

  it("reports a refund that was only initiated", () => {
    const r = analyzeJson(
      envelope(
        {
          id: 309001,
          tx_id: 900109001,
          flw_ref: "URF_PPLsynth_9001",
          amount_refunded: 50,
          status: "completed",
          destination: "payment_source",
          created_at: "2026-10-23T09:00:00.000Z",
        },
        "success",
        "Transaction refund initiated",
      ),
    );
    expect(r.events[0]).toMatchObject({
      stage: "refund",
      outcome: "pending",
      paymentReference: "900109001",
    });
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("reads the refund webhook meta string and survives invalid JSON in it", () => {
    const base = {
      id: 309002,
      AmountRefunded: 50,
      status: "completed",
      FlwRef: "PPLsynth/FLW1",
      TransactionId: 900109002,
      AccountId: 900001,
      createdAt: "2026-10-23T09:00:00.000Z",
    };
    const ok = analyzeJson({
      ...base,
      meta: '{"disburse_status":"failed","isPartialRefund":true}',
    });
    expect(ok.events[0]!.outcome).toBe("pending");
    expect(ok.events[0]!.attributes).toMatchObject({
      disburseStatus: "failed",
      isPartialRefund: true,
    });
    expect(ok.events[0]!.deliveryKey).toBeUndefined();
    const bad = analyzeJson({ ...base, meta: '{"source":"x" "y"}' });
    expect(bad.events[0]!.attributes.metaReadable).toBe(false);
  });

  it("links a chargeback webhook to its payment through flw_ref", () => {
    const r = analyzeFixture("v3-chargeback-after-payment.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]).toMatchObject({
      stage: "dispute",
      outcome: "unknown",
      providerStatus: "initiated",
    });
    expect(r.events[1]!.attributes).toMatchObject({
      chargebackStage: "new",
      chargebackType: "local",
    });
    const cb = r.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED");
    expect(cb?.title).toBe("Chargeback after a successful payment");
  });

  it("reads a list of chargebacks", () => {
    const cb = (id: number, status: string) => ({
      id,
      amount: 10,
      flw_ref: `PPLsynth/FLW${id}`,
      status,
      stage: "new",
      comment: "PPLsynth",
      meta: {
        uploaded_proof: null,
        history: [
          { action: "initiated", stage: "new", date: "2026-10-20", description: "PPLsynth" },
        ],
      },
      due_date: "2026-10-27T10:00:00.000Z",
      settlement_id: "N/A",
      created_at: "2026-10-24T10:00:00.000Z",
      transaction_id: id + 1,
      tx_ref: `PPLsynth-order-${id}`,
    });
    const r = analyzeJson(
      envelope([cb(81, "won"), cb(82, "lost")], "success", "Chargebacks fetched"),
    );
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.attributes.historyActions).toEqual(["initiated"]);
    expect(r.groups).toHaveLength(2);
  });
});

describe("v3 webhooks", () => {
  it("recognizes a repeated delivery by event, id and status", () => {
    const r = analyzeFixture("v3-duplicate-webhook.json");
    expect(r.events[0]!.deliveryKey).toBe(r.events[1]!.deliveryKey);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it("never copies the verif-hash secret from a pasted HTTP request", () => {
    const r = analyzeFixture("v3-webhook-http.txt");
    expect(r.events[0]).toMatchObject({ eventType: "charge.completed", outcome: "success" });
    expect(JSON.stringify(r.events)).not.toContain("PPLsynthSECRETHASHvalue0000");
    expect(JSON.stringify(r.errors)).not.toContain("PPLsynthSECRETHASHvalue0000");
    expect(toJsonReport(r)).not.toContain("PPLsynthSECRETHASHvalue0000");
  });

  it("recognizes non-payment webhooks without analyzing them", () => {
    const r = analyzeFixture("v3-bvn-webhook.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "flutterwave.v3.other_webhook",
    });
    expect(r.events).toEqual([]);
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")?.message).toMatch(
      /not analyzed/,
    );
  });

  it("reports missing required fields as parse issues without throwing", () => {
    const noStatus = analyzeJson({
      event: "charge.completed",
      "event.type": "CARD_TRANSACTION",
      data: { id: 1, tx_ref: "PPLsynth-x", flw_ref: "PPLsynth-y" },
    });
    expect(noStatus.records[0]!.status).toBe("invalid");
    expect(noStatus.records[0]!.reasons.join(" ")).toMatch(/data\.status/);
    const noData = analyzeJson({ event: "charge.completed", "event.type": "CARD_TRANSACTION" });
    expect(noData.records[0]!.status).toBe("invalid");
  });

  it("keeps unrelated transactions apart", () => {
    const r = analyze(
      JSON.stringify([
        webhook(tx({ id: 1001, tx_ref: "PPLsynth-a", flw_ref: "PPLsynth/FLWa" })),
        webhook(
          tx({
            id: 1002,
            tx_ref: "PPLsynth-b",
            flw_ref: "PPLsynth/FLWb",
            status: "failed",
            processor_response: "Transaction cancelled by user",
          }),
        ),
      ]),
    );
    expect(r.groups).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      retry: "customer_action_required",
      confidence: "strong",
    });
  });

  it("marks undocumented events as unknown", () => {
    const r = analyzeJson({
      event: "charge.PPLsynth",
      "event.type": "CARD_TRANSACTION",
      data: tx(),
    });
    expect(r.events[0]!.eventTypeKnown).toBe(false);
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("recognizes redirect parameters and transaction event lists as not analyzed", () => {
    const redirect = analyze("status=successful&tx_ref=PPLsynth-order-1&transaction_id=900109009");
    expect(redirect.records[0]).toMatchObject({
      status: "unsupported",
      format: "flutterwave.v3.redirect",
    });
    const events = analyzeJson(
      envelope(
        [
          {
            note: "card charge request successful: request for OTP",
            actor: "PPLsynth",
            object: "transaction",
            action: "charge",
            context: "web",
            created_at: "2026-10-20T10:00:00.000Z",
          },
        ],
        "success",
        "Transaction events fetched",
      ),
    );
    expect(events.records[0]).toMatchObject({
      status: "unsupported",
      format: "flutterwave.v3.transaction_events",
    });
    const card = analyzeJson({
      TransactionId: 1,
      Status: "Successful",
      Type: "debit",
      MaskedPan: "400000******0002",
      Otp: "123456",
    });
    expect(card.records[0]).toMatchObject({
      status: "unsupported",
      format: "flutterwave.v3.other_webhook",
    });
    expect(JSON.stringify(card)).not.toContain("123456");
  });
});

describe("v4", () => {
  it("decodes a v4 validation error by code and type", () => {
    const r = analyzeFixture("v4-validation-error.json");
    expect(r.records[0]!.confidence).toBeGreaterThan(0.9);
    expect(r.events[0]!.attributes.validationFields).toEqual(["payment_method_id", "currency"]);
    expect(r.errors[0]).toMatchObject({
      code: "10400",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { error_type: "REQUEST_NOT_VALID" },
    });
  });

  it("never decodes a reused v4 number without its type", () => {
    const wrong = analyzeJson({
      status: "failed",
      error: { type: "PPLSYNTH_TYPE", code: "301404" },
    });
    expect(wrong.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
    expect(wrong.errors[0]!.missingInformation.join(" ")).toMatch(/several documented meanings/);
    const transferNotFound = analyzeJson({
      status: "failed",
      error: { type: "TRANSFER_NOT_FOUND", code: "301404" },
    });
    expect(transferNotFound.errors[0]!.explanation).toMatch(/Transfer id does not exist/);
    const alias = analyzeJson({
      status: "failed",
      error: { type: "UNAUTHORIZATION", code: "10401" },
    });
    expect(alias.errors[0]).toMatchObject({ category: "configuration", confidence: "strong" });
    const unknown = analyzeJson({
      status: "failed",
      error: { type: "PPLSYNTH_NEW", code: "9999999" },
    });
    expect(unknown.records[0]!.confidence).toBe(0.6);
    expect(unknown.errors[0]).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it("reads a v4 charge.completed webhook", () => {
    const r = analyzeFixture("v4-charge-completed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "charge.completed",
      stage: "payment",
      outcome: "success",
      paymentReference: "chg_PPLsynth1900",
      eventReference: "wbk_PPLsynth1900000000",
      deliveryKey: "wbk_PPLsynth1900000000",
      amountMinor: "200000",
      eventTimestamp: new Date(1792490000000).toISOString(),
    });
    expect(r.events[0]!.attributes).toMatchObject({
      processorResponseType: "approved",
      paymentMethodType: "card",
    });
  });

  it("reads the webhook id from id when webhook_id is absent", () => {
    const r = analyzeJson({
      id: "wbk_PPLsynth0000000001",
      timestamp: 1792490000000,
      type: "charge.completed",
      data: { id: "chg_PPLsynth0001", status: "pending", amount: 10, currency: "NGN" },
    });
    expect(r.events[0]!.deliveryKey).toBe("wbk_PPLsynth0000000001");
    expect(r.events[0]!.attributes.webhookIdField).toBe("id");
  });

  it("treats requires_requery as an unknown outcome to retrieve, not to resend", () => {
    const r = analyzeFixture("v4-charge-requires-requery.json");
    expect(r.events[0]).toMatchObject({ outcome: "pending", stage: "payment" });
    expect(r.errors[0]).toMatchObject({
      code: "requires_requery",
      category: "network_or_timeout",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.nextAction).toMatch(/Do not send a new charge/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes a v4 card decline by processor_response type", () => {
    const r = analyzeFixture("v4-charge-failed.json");
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.errors[0]).toMatchObject({
      code: "insufficient_funds",
      category: "insufficient_funds",
      confidence: "strong",
      subCodes: { processor_response_code: "51" },
      outcomeKnown: true,
    });
  });

  it("does not trust a v4 processor code without its type", () => {
    const r = analyzeJson(
      envelope({ id: "chg_PPLsynth0002", status: "failed", processor_response: { code: "05" } }),
    );
    expect(r.errors[0]).toMatchObject({ code: "do_not_honor", confidence: "possible" });
    const odd = analyzeJson(
      envelope({
        id: "chg_PPLsynth0003",
        status: "failed",
        processor_response: { type: "PPLsynth_type", code: "05" },
      }),
    );
    expect(odd.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });

  it("decodes a failed v4 payout", () => {
    const r = analyzeFixture("v4-transfer-disburse-failed.json");
    expect(r.events[0]).toMatchObject({
      stage: "payout",
      outcome: "failure",
      amountMinor: "5000000",
    });
    expect(r.errors[0]).toMatchObject({
      code: "0307",
      category: "insufficient_funds",
      confidence: "strong",
    });
    expect(JSON.stringify(r.events)).not.toContain("PPLsynth-session-2200");
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("shows a reversed payout as a reversal", () => {
    const r = analyzeJson({
      webhook_id: "wbk_PPLsynth0000000003",
      timestamp: 1792600000000,
      type: "transfer.reversal",
      data: {
        id: "trf_PPLsynth0003",
        status: "SUCCESSFUL",
        reversal: {
          initial_status: "SUCCESSFUL",
          reconciliation_status: "REVERSED",
          reconciliation_type: "C",
        },
      },
    });
    expect(r.events[0]).toMatchObject({ stage: "reversal", outcome: "success" });
  });

  it("links a v4 refund to its charge", () => {
    const r = analyze(
      JSON.stringify([
        envelope({
          id: "chg_PPLsynth0004",
          status: "succeeded",
          amount: 100,
          currency: "NGN",
          reference: "PPLsynth-4",
          created_datetime: "2026-10-01T10:00:00.000Z",
        }),
        {
          webhook_id: "wbk_PPLsynth0000000004",
          timestamp: 1792700000000,
          type: "refund.completed",
          data: {
            id: "rfd_PPLsynth0004",
            charge_id: "chg_PPLsynth0004",
            amount_refunded: 100,
            status: "succeeded",
            reason: "requested_by_customer",
          },
        },
      ]),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.stage)).toEqual(["payment", "refund"]);
  });

  it("does not decide on the cus_ prefix shared with Stripe", () => {
    expect(detect({ id: "cus_PPLsynth0005", status: "succeeded", data: {} }).confidence).toBe(0);
    expect(
      detect({
        status: "success",
        data: { id: "cus_PPLsynth0005", customer_id: "cus_PPLsynth0005" },
      }).confidence,
    ).toBe(0);
    expect(detect({ id: "cus_PPLsynth0005", object: "customer" }).confidence).toBe(0);
  });
});

describe("sensitive data", () => {
  const planted = {
    email: "pplsynth.planted@example.com",
    name: "PPLsynth Planted Name",
    phone: "08099990000",
    token: "flw-t1nf-PPLsynthPLANTED00000000000-k33",
    first6: "512345",
    last4: "9876",
    ip: "198.51.100.77",
    fingerprint: "PPLsynth-planted-fingerprint",
    account: "0123498765",
    narration: "PPLsynth Planted Narration",
    authUrl: "https://pplsynth.example/3ds?token=PPLsynthPLANTEDURL",
    accountId: 987654321,
  };
  const records = [
    webhook(
      tx({
        id: 900109999,
        device_fingerprint: planted.fingerprint,
        ip: planted.ip,
        narration: planted.narration,
        auth_url: planted.authUrl,
        account_id: planted.accountId,
        card: {
          first_6digits: planted.first6,
          last_4digits: planted.last4,
          token: planted.token,
          expiry: "09/31",
        },
        customer: { id: 1, name: planted.name, email: planted.email, phone_number: planted.phone },
        meta: { authorization: { mode: "redirect", redirect: planted.authUrl } },
      }),
    ),
    {
      event: "transfer.completed",
      "event.type": "Transfer",
      data: {
        id: 600209999,
        account_number: planted.account,
        bank_code: "044",
        fullname: planted.name,
        narration: planted.narration,
        status: "SUCCESSFUL",
        reference: "PPLsynth-payout-9999",
        complete_message: "Successful",
        requires_approval: 0,
        is_approved: 1,
        meta: { email: planted.email, mobile_number: planted.phone },
      },
    },
    {
      webhook_id: "wbk_PPLsynth0000009999",
      timestamp: 1792700000000,
      type: "charge.completed",
      data: {
        id: "chg_PPLsynth9999",
        status: "succeeded",
        amount: 10,
        currency: "NGN",
        customer: { email: planted.email, name: planted.name },
        payment_method: { type: "card", card: { first6: planted.first6, last4: planted.last4 } },
        next_action: { type: "redirect_url", redirect_url: { url: planted.authUrl } },
      },
    },
  ];

  it("keeps planted values out of events, errors and the JSON report", () => {
    const r = analyze(JSON.stringify(records));
    expect(r.events).toHaveLength(3);
    const out = [JSON.stringify(r.events), JSON.stringify(r.errors), toJsonReport(r)];
    for (const text of out)
      for (const v of Object.values(planted)) expect(text).not.toContain(String(v));
    expect(r.sensitiveData.detected).toBe(true);
  });
});

describe("detection", () => {
  it("does not claim generic shapes above 0.5", () => {
    const shapes: unknown[] = [
      { status: "success", message: "ok", data: { id: 1, status: "successful", amount: 10 } },
      { status: "error", message: "Request failed", data: null },
      { error: { type: "X", code: "1", message: "y" } },
      { status: "failed", message: "PPLsynth" },
      { event: "charge.completed", data: { id: 1, status: "successful", reference: "PPLsynth" } },
      { event: "transfer.success", data: { id: 1, status: "success", reference: "PPLsynth" } },
      { type: "charge.completed", data: { id: 1, status: "succeeded" } },
      { id: 1, status: "successful", amount: 100, currency: "NGN" },
      {
        status: true,
        message: "Verification successful",
        data: { id: 1, status: "success", reference: "PPLsynth", gateway_response: "Successful" },
      },
    ];
    for (const s of shapes)
      expect(detect(s).confidence, JSON.stringify(s)).toBeLessThanOrEqual(0.5);
    expect(
      detect({ status: "error", message: "Authorization required", data: null }).confidence,
    ).toBe(0.5);
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "flutterwave" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );
  const recordsOf = (dir: string) => {
    const out: {
      name: string;
      payload: unknown;
      meta: Parameters<typeof flutterwaveAdapter.detect>[1];
    }[] = [];
    for (const file of readdirSync(`${root}${dir}`)) {
      if (!statSync(`${root}${dir}/${file}`).isFile()) continue;
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

  it("includes the Stripe and Adyen fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "checkout"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const list = recordsOf(dir);
    for (const r of list) expect(detect(r.payload, r.meta).confidence, r.name).toBe(0);
  });

  it("never throws on hostile input", () => {
    for (const v of [
      null,
      1,
      "x",
      [],
      { __proto__: { event: "charge.completed" } },
      { event: 1, data: [] },
      { status: "success", data: [null, 1] },
    ])
      expect(() => detect(v)).not.toThrow();
    const r = analyzeText("{ not json", options);
    expect(r.ok).toBe(false);
  });
});
