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
import { ADAPTERS } from "@pandapaylens/providers";
import { ccbillAdapter } from "@pandapaylens/ccbill";
import { segpayAdapter } from "@pandapaylens/segpay";
import { netbillingAdapter } from "@pandapaylens/netbilling";
import { skrillAdapter } from "@pandapaylens/skrill";
import {
  ALT_ID_ERROR_CODES,
  AUTH_MAPPING_CODES,
  COMMAND_MESSAGES,
  FIELD7_STAGES,
  ISSUER_RESPONSE_CODES,
  OTHER_ERROR_CODES,
  PAYMENT_ERROR_CODES,
  PAYMENT_STATES,
  PAYMENT_STATUSES,
  PAYU_INDIA_ADAPTER_VERSION,
  REFUND_CODE_STATES,
  REFUND_INITIATION_CODES,
  REFUND_STATUS_CODES,
  SUBSCRIPTION_ERROR_CODES,
  UNDESCRIBED_FIELD7_VALUES,
  decodePaymentCode,
  payuIndiaAdapter,
  payuIndiaManifest,
} from "@pandapaylens/payu-india";
import defaultExport from "@pandapaylens/payu-india";
import { payuIndiaManifest as manifestOnly } from "@pandapaylens/payu-india/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [payuIndiaAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`payu_india/${path}`));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const HASH = "ab".repeat(64);

/** A payment response or payment webhook as form data. */
const form = (fields: Record<string, string | undefined> = {}) =>
  new URLSearchParams(
    Object.entries({
      mihpayid: "PPLsynth80000000001",
      mode: "CC",
      status: "failure",
      unmappedstatus: "failed",
      key: "PPLsynthKey01",
      txnid: "PPLsynth-order-8001",
      amount: "100.00",
      net_amount_debit: "0",
      addedon: "2026-10-24 10:00:00",
      payment_source: "payu",
      PG_TYPE: "CC-PG",
      bankcode: "CC",
      error: "E312",
      error_Message: "Bank declined the card",
      hash: HASH,
      ...fields,
    }).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();

const verify = (
  entries: Record<string, Record<string, unknown>>,
  top: Record<string, unknown> = {},
) =>
  json({
    status: 1,
    msg: `${Object.keys(entries).length} out of ${Object.keys(entries).length} Transactions Fetched Successfully`,
    transaction_details: entries,
    ...top,
  });

const firstError = (text: string) => analyze(text).errors[0]!;
const firstEvent = (text: string) => analyze(text).events[0]!;

const ANALYZED_FIXTURES: [string, string, number][] = [
  ["payment-card-captured.txt", "payu_india.payment_response", 0.98],
  ["webhook-card-failed-declined.txt", "payu_india.payment_response", 0.98],
  ["payment-upi-pending.txt", "payu_india.payment_response", 0.98],
  ["webhook-upi-captured.txt", "payu_india.payment_response", 0.98],
  ["payment-netbanking-cancelled.txt", "payu_india.payment_response", 0.98],
  ["payment-card-dropped-timeout.txt", "payu_india.payment_response", 0.98],
  ["payment-card-3ds-failed.txt", "payu_india.payment_response", 0.98],
  ["payment-card-preauthorized.txt", "payu_india.payment_response", 0.98],
  ["http-webhook-netbanking-captured.txt", "payu_india.payment_response", 0.98],
  ["verify-payment-captured.json", "payu_india.verify_payment", 0.98],
  ["verify-payment-not-found.json", "payu_india.verify_payment", 0.95],
  ["verify-payment-undocumented-code.json", "payu_india.verify_payment", 0.98],
  ["command-refund-queued.json", "payu_india.command_response", 0.85],
  ["command-refund-token-empty.json", "payu_india.command_response", 0.65],
];

const RECOGNIZED_FIXTURES: [string, string, RegExp][] = [
  ["refund-webhook-failure.json", "payu_india.refund_webhook", /refund webhook/],
  ["dispute-webhook.json", "payu_india.dispute_webhook", /dispute/],
  ["s2s-card-enrolled.json", "payu_india.s2s_response", /S2S interim/],
];

describe("payu_india detection", () => {
  it.each(ANALYZED_FIXTURES)("recognizes %s", (file, format, confidence) => {
    const r = analyzeFixture(file);
    expect(r.records[0]).toMatchObject({ status: "analyzed", format, confidence });
  });

  it.each(RECOGNIZED_FIXTURES)("recognizes but does not analyze %s", (file, format, message) => {
    const r = analyzeFixture(file);
    expect(r.records[0]).toMatchObject({ status: "unsupported", format });
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(message);
    expect(r.events).toEqual([]);
  });

  it("recognizes the transaction listing without analyzing it", () => {
    const r = analyze(
      json({
        Transaction_details: [
          { id: "PPLsynth1", txnid: "PPLsynth-order-1", ibibo_code: "CC", status: "captured" },
        ],
      }),
    );
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "payu_india.transaction_details",
    });
  });

  it("keeps mihpayid alone below the threshold", () => {
    const d = payuIndiaAdapter.detect({ mihpayid: "PPLsynth1", amount: "1.00" });
    expect(d.confidence).toBeLessThan(0.5);
    const r = analyze("mihpayid=PPLsynth1&amount=1.00");
    expect(r.records[0]!.status).toBe("unsupported");
    const chosen = analyze("mihpayid=PPLsynth1&amount=1.00", { provider: "payu_india" });
    expect(chosen.records[0]!.status).toBe("invalid");
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "payu", message: "PayU India error" },
      "payu",
      null,
      [],
      { status: "success" },
      { status: "failure", txnid: "PPLsynth-1", error: "E325" },
      { status: 1, msg: "ok" },
      { status: 0, msg: "Parameter missing" },
      { error: { code: "E325" } },
      { error: "E000", error_Message: "No Error" },
      { status: "success", hash: HASH, key: "PPLsynthKey", txnid: "PPLsynth-1", amount: "1.00" },
      { unmappedstatus: "captured" },
      { transaction_details: {} },
      { status: 1, msg: "x", transaction_details: {} },
      { metaData: { txnStatus: "Enrolled" } },
      { type: "payments", event: "dispute" },
      { Transaction_details: [] },
    ]) {
      expect(payuIndiaAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("does not claim generic command or verify shapes above 0.5", () => {
    expect(
      payuIndiaAdapter.detect({ status: 1, msg: "x", transaction_details: { a: {} } }).confidence,
    ).toBe(0);
    const verifyLike = payuIndiaAdapter.detect({
      status: 1,
      msg: "1 out of 1 Transactions Fetched Successfully",
      transaction_details: { a: { status: "success" } },
    });
    expect(verifyLike.confidence).toBe(0.75);
  });

  it("ignores JSON-only formats when the input is form data", () => {
    const d = payuIndiaAdapter.detect(
      { status: "1", msg: "Refund Request Queued", mihpayid: "PPLsynth1" },
      { format: "form" },
    );
    expect(d.format).toBe("payu_india.payment_response");
    expect(d.confidence).toBeLessThan(0.5);
    expect(
      payuIndiaAdapter.detect({ status: "1", msg: "Refund Request Queued", mihpayid: "PPLsynth1" })
        .format,
    ).toBe("payu_india.command_response");
  });

  it("accepts the parsed JSON form of a payment response", () => {
    const r = analyze(
      json(Object.fromEntries(new URLSearchParams(form({ net_amount_debit: undefined })))),
    );
    expect(r.records[0]).toMatchObject({
      status: "analyzed",
      format: "payu_india.payment_response",
    });
    const numeric = analyze(
      json({ ...Object.fromEntries(new URLSearchParams(form())), net_amount_debit: 0 }),
    );
    expect(numeric.events[0]!.attributes.netAmountDebit).toBe("0");
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "payu_india" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );
  const records = (dir: string) => {
    const out: {
      name: string;
      payload: unknown;
      meta: Parameters<typeof payuIndiaAdapter.detect>[1];
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

  it("includes the Stripe, Adyen and form-posting adapters' fixtures", () => {
    expect(dirs).toEqual(
      expect.arrayContaining(["stripe", "adyen", "ccbill", "segpay", "netbilling", "skrill"]),
    );
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const list = records(dir);
    expect(list.length).toBeGreaterThan(0);
    for (const r of list)
      expect(payuIndiaAdapter.detect(r.payload, r.meta).confidence, r.name).toBe(0);
  });

  it("is not claimed by the form-posting adapters or any registered adapter", () => {
    const list = records("payu_india");
    expect(list.length).toBe(17);
    for (const adapter of [ccbillAdapter, segpayAdapter, netbillingAdapter, skrillAdapter])
      for (const r of list)
        expect(adapter.detect(r.payload, r.meta).confidence, `${adapter.id} ${r.name}`).toBe(0);
    for (const adapter of ADAPTERS.filter((x) => x.id !== "payu_india"))
      for (const r of list)
        expect(adapter.detect(r.payload, r.meta).confidence, `${adapter.id} ${r.name}`).toBe(0);
  });
});

describe("payu_india parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noTxnid = analyze(form({ txnid: undefined }));
    expect(noTxnid.records[0]).toMatchObject({
      status: "invalid",
      format: "payu_india.payment_response",
    });
    expect(noTxnid.records[0]!.reasons.join(" ")).toMatch(/txnid/);

    const noStatus = analyze(verify({ "PPLsynth-order-1": { mihpayid: "PPLsynth1" } }));
    expect(noStatus.records[0]).toMatchObject({
      status: "invalid",
      format: "payu_india.verify_payment",
    });
    expect(noStatus.records[0]!.reasons.join(" ")).toMatch(
      /transaction_details\.PPLsynth-order-1\.status/,
    );

    const notObject = analyze(
      verify({ "PPLsynth-order-1": "x" as unknown as Record<string, unknown> }),
    );
    expect(notObject.records[0]!.status).toBe("invalid");

    const badStatus = analyze(
      json({
        status: 7,
        msg: "Refund Request Queued",
        mihpayid: "PPLsynth1",
        request_id: "PPLsynth-r",
      }),
    );
    expect(badStatus.records[0]!.status).toBe("unsupported");
  });

  it("reports a repeated field and unknown formats", () => {
    const r = analyze(form() + "&status=success");
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/status: appears more than once/);
    expect(payuIndiaAdapter.parse({}, "payu_india.unknown")).toEqual({
      ok: false,
      issues: ['Unsupported PayU India format "payu_india.unknown".'],
    });
    expect(payuIndiaAdapter.parse("x", "payu_india.payment_response").ok).toBe(false);
  });

  it("reports numbers that cannot be read exactly", () => {
    const r = analyze(
      `{"mihpayid": 403993715531077182, "txnid": "PPLsynth-order-1", "status": "success", "unmappedstatus": "captured"}`,
    );
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/mihpayid: number too large/);
  });

  it("fails cleanly on malformed input and XML", () => {
    const bad = analyzeText('{"status": 1, "msg": "1 out of 1 Transactions Fetched', options);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("INVALID_JSON");
    const xml = analyzeText("<response><status>failure</status></response>", options);
    expect(xml.ok).toBe(false);
    if (!xml.ok) expect(xml.error.code).toBe("UNSUPPORTED_FORMAT");
  });

  it("tolerates unknown fields, nulls and lenient JSON", () => {
    const r = analyze(
      `{"status": 1, "msg": "1 out of 1 Transactions Fetched Successfully", "transaction_details": {"PPLsynth-order-1": {"mihpayid": "PPLsynth1", "status": "success", "unmappedstatus": "captured", "error_code": null, "extra": {"nested": [1]},},},}`,
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
  });
});

describe("payu_india payment response and webhook", () => {
  it("normalizes a successful card payment without errors", () => {
    const r = analyzeFixture("payment-card-captured.txt");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      provider: "payu_india",
      sourceFormat: "payu_india.payment_response",
      eventType: "payment.captured",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "status=success; unmappedstatus=captured",
      paymentReference: "PPLsynth403993715531077182",
      merchantReference: "PPLsynth-order-1001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      status: "success",
      unmappedStatus: "captured",
      errorCode: "E000",
      field7: "AUTHPOSITIVE",
      mode: "CC",
      modeMeaning: "Credit card",
      pgType: "CC-PG",
      paymentSource: "payu",
      cardCategory: "domestic",
      amount: "1000.00",
      amountField: "amount",
      netAmountDebit: "1000",
      addedOn: "2026-10-20 15:11:37",
      addedOnTimeZone: "not_documented",
      bankReferencePresent: true,
      hash: "present_128_hex",
      signatureVerified: false,
    });
    // No currency field and no documented time zone.
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.deliveryKey).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("decodes a declined card payment webhook", () => {
    const r = analyzeFixture("webhook-card-failed-declined.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.failed",
      stage: "payment",
      outcome: "failure",
      paymentReference: "PPLsynth27553387529",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "E325",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Bank denied transaction on the card.",
      paymentReference: "PPLsynth27553387529",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({
      field: "error",
      status: "failure",
      unmappedstatus: "failed",
      field7: "AUTHNEGATIVE",
      table: "payment",
    });
    expect(r.errors[0]!.subCodes.field8).toMatch(/violation of law/);
    expect(r.errors[0]!.subCodes.field9).toMatch(/not enabled for online transactions/);
    expect(r.errors[0]!.explanation).toMatch(/Field7 AUTHNEGATIVE/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("payment-card-3ds-failed.txt");
    expect(r.errors[0]).toMatchObject({
      code: "E1000",
      category: "authentication_failed",
      retry: "customer_action_required",
      confidence: "strong",
    });
    expect(r.errors[0]!.subCodes.field7).toBe("3DS_CHALLENGE_NEGATIVE");
  });

  it("decodes a validation error and an EX code", () => {
    expect(firstError(form({ error: "E330" }))).toMatchObject({
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
    });
    expect(firstError(form({ error: "EX108" }))).toMatchObject({
      code: "EX108",
      category: "duplicate_request",
      subCodes: expect.objectContaining({ table: "other" }),
    });
    expect(firstError(form({ error: "EA081" })).subCodes.table).toBe("alt_id");
    expect(firstError(form({ error: "E756" })).subCodes.table).toBe("subscription");
  });

  it("treats a dropped payment as an unknown outcome and warns about blind retries", () => {
    const r = analyzeFixture("payment-card-dropped-timeout.txt");
    expect(r.events[0]).toMatchObject({ eventType: "payment.dropped", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code: "E1636",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("keeps a pending UPI payment pending", () => {
    const r = analyzeFixture("payment-upi-pending.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.pending",
      stage: "payment",
      outcome: "pending",
      eventTypeKnown: true,
    });
    expect(r.events[0]!.attributes.field7).toBe("REDIRECT");
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });

  it("decodes a code on a pending payment without calling the outcome known", () => {
    const e = firstError(form({ status: "pending", unmappedstatus: "pending", error: "E227" }));
    expect(e).toMatchObject({ code: "E227", outcomeKnown: false });
    expect(e.missingInformation.join(" ")).toMatch(/pending/);
  });

  it("links a pending UPI payment, its later webhook and Verify Payment into one group", () => {
    const text = [
      fixture("payu_india/payment-upi-pending.txt").trim(),
      fixture("payu_india/webhook-upi-captured.txt").trim(),
    ].join("\n");
    const r = analyze(text);
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "success"]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toContain("mihpayid:PPLsynth70000000001");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");

    const v = analyzeFixture("verify-payment-captured.json");
    expect(v.events[0]).toMatchObject({
      eventType: "verify_payment.captured",
      outcome: "success",
      paymentReference: "PPLsynth70000000001",
      source: { recordIndex: 0, path: "transaction_details.PPLsynth-order-1003" },
    });
  });

  it("keeps unrelated transactions apart", () => {
    const text = [
      fixture("payu_india/payment-card-captured.txt").trim(),
      fixture("payu_india/payment-netbanking-cancelled.txt").trim(),
    ].join("\n");
    const r = analyze(text);
    expect(r.events).toHaveLength(2);
    expect(r.groups).toHaveLength(2);
  });

  it("shows a cancelled net banking payment as a failed attempt", () => {
    const r = analyzeFixture("payment-netbanking-cancelled.txt");
    expect(r.events[0]).toMatchObject({ eventType: "payment.userCancelled", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({ code: "E1605", retry: "customer_action_required" });
    // Lower-case spelling from the parameter tables.
    expect(firstEvent(form({ unmappedstatus: "usercancelled" })).eventType).toBe(
      "payment.userCancelled",
    );
  });

  it("shows a pre-authorized payment as an authorization, not a capture", () => {
    const r = analyzeFixture("payment-card-preauthorized.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.auth",
      stage: "authorization",
      outcome: "success",
    });
    expect(r.errors).toEqual([]);
  });

  it("reads a raw HTTP webhook post", () => {
    const r = analyzeFixture("http-webhook-netbanking-captured.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.captured",
      outcome: "success",
      paymentReference: "PPLsynth70000000006",
    });
    expect(r.events[0]!.attributes.mode).toBe("NB");
  });

  it("does not invent a delivery key for repeated webhook deliveries", () => {
    const one = fixture("payu_india/webhook-upi-captured.txt").trim();
    const r = analyze(`${one}\n${one}`);
    expect(r.events).toHaveLength(2);
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(r.groups).toHaveLength(1);
    expect(payuIndiaManifest.delivery.duplicateKey).toMatch(/no documented key/);
  });

  it("reports an undocumented code honestly", () => {
    const e = firstError(form({ error: "E4936" }));
    expect(e).toMatchObject({ code: "E4936", category: "unknown", confidence: "insufficient" });
    expect(e.missingInformation.join(" ")).toMatch(/Verify Payment example/);
    expect(firstError(form({ error: "E9999" }))).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
  });

  it("lowers confidence for codes with conflicting or mapping-only rows", () => {
    expect(firstError(form({ error: "E307" }))).toMatchObject({
      confidence: "possible",
      category: "card_declined",
    });
    expect(firstError(form({ error: "EX306" })).confidence).toBe("possible");
    expect(firstError(form({ error: "E204" }))).toMatchObject({
      confidence: "possible",
      category: "authentication_failed",
      subCodes: expect.objectContaining({ table: "authn_authz_mapping" }),
    });
    expect(firstError(form({ error: "E1205" }))).toMatchObject({
      confidence: "insufficient",
      category: "unknown",
    });
  });

  it("uses Field7 when a failure carries no error code", () => {
    const e = firstError(form({ error: "E000", field7: "AUCNEGATIVE" }));
    expect(e).toMatchObject({
      code: "AUCNEGATIVE",
      category: "authentication_failed",
      confidence: "possible",
      subCodes: expect.objectContaining({ field: "field7" }),
    });
    expect(e.explanation).toMatch(/E000/);
    const none = firstError(form({ error: undefined }));
    expect(none).toMatchObject({ code: "failed", category: "unknown", confidence: "insufficient" });
    const undescribed = analyze(form({ error: undefined, field7: "EVNEGATIVE" }));
    expect(undescribed.events[0]!.attributes.field7).toBe("EVNEGATIVE");
    expect(undescribed.errors[0]!.missingInformation.join(" ")).toMatch(/not described/);
  });

  it("flags status and unmappedstatus that contradict the state table", () => {
    const r = analyze(form({ status: "success", unmappedstatus: "failed", error: "E000" }));
    expect(r.events[0]).toMatchObject({ outcome: "unknown" });
    expect(r.events[0]!.attributes.statusConsistent).toBe(false);
    const unknown = analyze(form({ status: "weird", unmappedstatus: "captured" }));
    expect(unknown.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(ruleIds(unknown)).toContain("UNKNOWN_EVENT_TYPE");
    const failedSpelling = analyze(form({ status: "failed" }));
    expect(failedSpelling.events[0]!.outcome).toBe("failure");
  });
});

describe("payu_india Verify Payment", () => {
  it("shows a transaction PayU did not find", () => {
    const r = analyzeFixture("verify-payment-not-found.json");
    expect(r.events[0]).toMatchObject({
      eventType: "verify_payment.not_found",
      outcome: "unknown",
      merchantReference: "PPLsynth-order-9999",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("decodes error_code of a failed entry", () => {
    const r = analyzeFixture("verify-payment-undocumented-code.json");
    expect(r.events[0]).toMatchObject({
      eventType: "verify_payment.failed",
      outcome: "failure",
      paymentReference: "PPLsynth70000000007",
    });
    expect(r.errors[0]).toMatchObject({
      code: "E4936",
      confidence: "insufficient",
      subCodes: expect.objectContaining({ field: "error_code" }),
      source: { recordIndex: 0, path: "transaction_details.PPLsynth-order-1009" },
    });
  });

  it("emits one event per transaction_details entry", () => {
    const r = analyze(
      verify({
        "PPLsynth-order-1": {
          mihpayid: "PPLsynth1",
          status: "success",
          unmappedstatus: "captured",
          error_code: "E000",
        },
        "PPLsynth-order-2": {
          mihpayid: "PPLsynth2",
          status: "failure",
          unmappedstatus: "bounced",
          error_code: "E801",
        },
      }),
    );
    expect(r.events.map((e) => e.eventType).sort()).toEqual([
      "verify_payment.bounced",
      "verify_payment.captured",
    ]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: "E801", category: "payment_method_unavailable" });
    expect(r.groups).toHaveLength(2);
  });
});

describe("payu_india command API responses", () => {
  it("normalizes a queued refund request", () => {
    const r = analyzeFixture("command-refund-queued.json");
    expect(r.events[0]).toMatchObject({
      eventType: "command.refund_request",
      eventTypeKnown: true,
      stage: "refund",
      outcome: "pending",
      paymentReference: "PPLsynth403993715531077182",
      relatedReference: "PPLsynth-req-3001",
      providerStatus: "status=1; error_code=102",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      operation: "refund",
      msg: "Refund Request Queued",
      errorCode: "102",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("groups a payment and its refund request by mihpayid", () => {
    const payment = analyzeFixture("payment-card-captured.txt").events[0]!;
    const refund = analyzeFixture("command-refund-queued.json").events[0]!;
    expect(payuIndiaAdapter.correlationKeys(payment)).toEqual(
      payuIndiaAdapter.correlationKeys(refund),
    );
  });

  it("decodes refund initiation codes only for refund requests", () => {
    const dup = analyze(
      json({ status: 0, msg: "Refund Request Queued", mihpayid: "PPLsynth1", error_code: 106 }),
    );
    expect(dup.events[0]).toMatchObject({ stage: "refund", outcome: "failure" });
    expect(dup.errors[0]).toMatchObject({
      code: "106",
      category: "duplicate_request",
      confidence: "strong",
      subCodes: expect.objectContaining({ table: "refund_initiation" }),
    });
    const done = analyze(
      json({ status: 1, msg: "Refund Request Queued", mihpayid: "PPLsynth1", error_code: "100" }),
    );
    expect(done.events[0]!.outcome).toBe("success");
    expect(done.errors).toEqual([]);

    const capture = analyze(
      json({ status: 0, msg: "Capture Request Queued", mihpayid: "PPLsynth1", error_code: 109 }),
    );
    expect(capture.events[0]).toMatchObject({ stage: "capture", outcome: "failure" });
    expect(capture.errors[0]).toMatchObject({ code: "109", confidence: "insufficient" });
    const queuedCapture = analyze(
      json({
        status: 1,
        msg: "Capture Request Queued",
        mihpayid: "PPLsynth1",
        request_id: "PPLsynth-r",
      }),
    );
    expect(queuedCapture.events[0]).toMatchObject({ stage: "capture", outcome: "pending" });
  });

  it("decodes a rejected request that only has a message", () => {
    const r = analyzeFixture("command-refund-token-empty.json");
    expect(r.events[0]).toMatchObject({
      eventType: "command.rejected",
      stage: "error",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({
      code: "status=0",
      category: "invalid_request",
      confidence: "possible",
      providerMessage: "token is empty",
    });
    const other = analyze(json({ status: 0, msg: "PPLsynth something else", mihpayid: "" }));
    expect(other.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
    expect(other.events[0]!.attributes.msgDocumented).toBe(false);
  });
});

describe("payu_india sensitive data", () => {
  it("never copies card, UPI, contact, PAN, key or hash values", () => {
    const planted = [
      "4111110000001111",
      "planted.payer@okplanted",
      "planted.buyer@example.com",
      "9876501234",
      "ABCPL1234Z",
      "PLANTEDKEY99",
      "PLANTEDSALTHASH".padEnd(128, "f"),
      "Planted Holder",
      "PlantedCardToken",
      "PLANTEDACC000111222",
    ];
    const text = form({
      status: "failure",
      error: "E325",
      key: "PLANTEDKEY99",
      hash: "PLANTEDSALTHASH".padEnd(128, "f"),
      cardnum: "4111110000001111",
      card_no: "4111110000001111",
      name_on_card: "Planted Holder",
      card_token: "PlantedCardToken",
      firstname: "Planted Holder",
      email: "planted.buyer@example.com",
      phone: "9876501234",
      udf1: "ABCPL1234Z",
      field1: "planted.payer@okplanted",
      field3: "PLANTEDACC000111222",
      field6: "9876501234",
      field8: "51 | Insufficient funds for planted.payer@okplanted 9876501234",
      field9: "Declined for account PLANTEDACC000111222",
      error_Message: "Bank denied 4111110000001111 for planted.buyer@example.com",
    });
    const r = analyze(text);
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.errors[0]!.subCodes.field8).toMatch(/Insufficient funds/);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of planted) {
      expect(events, value).not.toContain(value);
      expect(report, value).not.toContain(value);
    }
    const v = analyze(
      verify({
        "PPLsynth-order-1": {
          mihpayid: "PPLsynth1",
          status: "failure",
          unmappedstatus: "failed",
          error_code: "E706",
          card_no: "4111110000001111",
          firstname: "Planted Holder",
          udf1: "ABCPL1234Z",
          field2: "PLANTEDACC000111222",
          card_token: "PlantedCardToken",
        },
      }),
    );
    const vReport = toJsonReport(v);
    for (const value of planted) expect(vReport, value).not.toContain(value);
  });
});

describe("payu_india catalog and manifest", () => {
  it("has the documented number of codes", () => {
    expect(Object.keys(PAYMENT_ERROR_CODES)).toHaveLength(658);
    expect(Object.keys(OTHER_ERROR_CODES)).toHaveLength(201);
    expect(Object.keys(AUTH_MAPPING_CODES)).toHaveLength(22);
    expect(Object.keys(SUBSCRIPTION_ERROR_CODES)).toHaveLength(1);
    expect(Object.keys(ALT_ID_ERROR_CODES)).toHaveLength(23);
    expect(Object.keys(ISSUER_RESPONSE_CODES)).toHaveLength(67);
    expect(ISSUER_RESPONSE_CODES["91"]!.map((m) => m.payuCode)).toEqual(["E9254", "E4158"]);
    expect(Object.keys(FIELD7_STAGES)).toHaveLength(30);
    expect(UNDESCRIBED_FIELD7_VALUES).toHaveLength(7);
    expect(Object.keys(REFUND_INITIATION_CODES)).toHaveLength(81);
    expect(Object.keys(REFUND_STATUS_CODES)).toHaveLength(31);
    expect(Object.keys(PAYMENT_STATES)).toHaveLength(10);
    expect(Object.keys(PAYMENT_STATUSES)).toEqual(["success", "failure", "failed", "pending"]);
    expect(Object.keys(COMMAND_MESSAGES)).toHaveLength(7);
    // Distinct gateway codes across the tables (EA09 is in two of them).
    const all = new Set([
      ...Object.keys(PAYMENT_ERROR_CODES),
      ...Object.keys(OTHER_ERROR_CODES),
      ...Object.keys(AUTH_MAPPING_CODES),
      ...Object.keys(SUBSCRIPTION_ERROR_CODES),
      ...Object.keys(ALT_ID_ERROR_CODES),
    ]);
    expect(all.size).toBe(904);
    for (const code of Object.keys(REFUND_CODE_STATES))
      expect(REFUND_INITIATION_CODES[code], code).toBeDefined();
    expect(PAYMENT_ERROR_CODES.E4936).toBeUndefined();
    expect(decodePaymentCode("E000").entry!.informational).toBe(true);
    expect(decodePaymentCode("constructor").family).toBeNull();
  });

  it("exports the adapter, manifest and version", () => {
    expect(defaultExport).toBe(payuIndiaAdapter);
    expect(manifestOnly).toBe(payuIndiaManifest);
    expect(payuIndiaAdapter.manifest).toBe(payuIndiaManifest);
    expect(PAYU_INDIA_ADAPTER_VERSION).toBe("0.1.0");
    expect(payuIndiaManifest).toMatchObject({
      id: "payu_india",
      wave: 3,
      researchStatus: "tested",
      status: "limited",
      verifiedAt: "2026-10-25",
      documentationAccess: "public",
      samples: expect.arrayContaining([expect.any(String)]),
    });
    expect(payuIndiaManifest.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "limited",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "limited",
      diagnosticRules: "limited",
    });
    for (const s of payuIndiaManifest.sectors) expect(s.source).toMatch(/^https:\/\/payu\.in\//);
    expect(payuIndiaManifest.regions).toMatch(/RBI/);
    expect(payuIndiaManifest.regions).toMatch(/banned list/);
    expect(payuIndiaManifest.fixtureProvenance).toMatch(/GitHub assets repository/);
    const supported = new Set(payuIndiaAdapter.supportedFormats.map((f) => f.id));
    for (const family of payuIndiaManifest.apiFamilies)
      expect(supported.has(family.id), family.id).toBe(family.status !== "unsupported");
  });

  it("uses no en or em dashes in published text, sources or fixtures", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(JSON.stringify(payuIndiaManifest)).not.toMatch(dashes);
    const pkg = fileURLToPath(new URL("../", import.meta.url));
    const fixtures = fileURLToPath(new URL("../../../../fixtures/payu_india/", import.meta.url));
    for (const file of [
      "src/index.ts",
      "src/catalog.ts",
      "src/manifest.ts",
      "tests/payu-india.test.ts",
    ])
      expect(readFileSync(`${pkg}${file}`, "utf8"), file).not.toMatch(dashes);
    for (const file of readdirSync(fixtures)) {
      const content = readFileSync(`${fixtures}${file}`, "utf8");
      expect(content, file).not.toMatch(dashes);
      expect(content, file).toMatch(/PPLsynth|PPLSYNTH/);
    }
  });
});

describe("payu_india free-text scrubbing", () => {
  it("removes UPI ids and stays fast on long text without whitespace", () => {
    const started = Date.now();
    const r = analyze(
      form({ error_Message: `Declined for pplsynth.payer@okpplbank ${"!".repeat(3000)}` }),
    );
    expect(Date.now() - started).toBeLessThan(2000);
    expect(json(r)).not.toContain("pplsynth.payer@okpplbank");
  });
});
