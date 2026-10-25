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
  AVS_CODES,
  DECTA_ADAPTER_VERSION,
  DOCUMENTED_MESSAGES,
  LEGACY_WEBHOOK_EVENTS,
  MERCHANT_ADVICE_CODES,
  ORDER_STATUSES,
  ORDER_STATUS_ENUM,
  RAW_ACQUIRER_CODES,
  SPECIAL_CODES,
  TDS_STATUSES,
  WEBHOOK_EVENTS,
  dectaAdapter,
  dectaManifest,
  findCode,
} from "@pandapaylens/decta";
import defaultExport from "@pandapaylens/decta";
import { dectaManifest as manifestOnly } from "@pandapaylens/decta/manifest";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [dectaAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(path));
const json = (v: unknown) => JSON.stringify(v);
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const order = (fields: Record<string, unknown> = {}, td: Record<string, unknown> = {}) => ({
  type: "order",
  id: "PPLsynth-order-0999",
  number: "DE1999",
  status: "paid",
  status_changes: [
    { new_status: "created", currency: "EUR", operation_amount: "10.00" },
    { new_status: "paid", currency: "EUR", operation_amount: "10.00" },
  ],
  transaction_details: {
    processing_status: { code: "000", description: "Approved" },
    processing_payment_id: "PPLsynth-proc-0999",
    ...td,
  },
  ...fields,
});
const failed = (code: unknown, td: Record<string, unknown> = {}) =>
  order(
    { status: "failed" },
    { processing_status: { code, description: "Synthetic description" }, ...td },
  );
const webhook = (event: string, body: unknown, version = "v0.6") =>
  [
    "POST /PPLsynth/webhooks HTTP/1.1",
    "Content-Type: application/json",
    `X-Webhook-Event: ${event}`,
    `X-Webhook-Version: ${version}`,
    "",
    json(body),
  ].join("\n");
const httpResponse = (status: number, body: unknown) =>
  [`HTTP/1.1 ${status} X`, "Content-Type: application/json", "", json(body)].join("\n");
const hookMeta = (event: string, version = "v0.6"): RecordMeta => ({
  format: "http",
  http: {
    kind: "request",
    method: "POST",
    headers: { "x-webhook-event": event, "x-webhook-version": version },
  },
});
const firstError = (text: string) => analyze(text).errors[0]!;
const firstEvent = (text: string) => analyze(text).events[0]!;

describe("decta detection", () => {
  it.each([
    [order(), "decta.order", 0.9, true],
    [{ type: "order", id: "PPLsynth-x", status: "paid" }, "decta.order", 0.55, true],
    [
      { type: "order", id: "123e4567-e89b-42d3-a456-426614174000", status: "hold" },
      "decta.order",
      0.6,
      true,
    ],
    [
      { id: "PPLsynth-x", status: "paid", status_changes: [{ new_status: "paid" }] },
      "decta.order",
      0.55,
      true,
    ],
    [
      {
        status: "tds_pending",
        next_step: "tds_validate",
        three_d_secure_details: { mdstatus: "9" },
      },
      "decta.host2host",
      0.75,
      true,
    ],
    [{ status: "tds_pending" }, "decta.host2host", 0.4, true],
    [{ processing_status: "000" }, "decta.host2host", 0.5, true],
    [{ threed_check_url: "https://x.example/p/1/3d/" }, "decta.host2host", 0.5, true],
    [
      { __all__: [{ message: "m", code: "invalid" }], amount: [{ message: "m", code: "invalid" }] },
      "decta.validation_error",
      0.6,
      true,
    ],
    [{ amount: [{ message: "m", code: "invalid" }] }, "decta.validation_error", 0.4, true],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(dectaAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("uses the webhook headers", () => {
    expect(dectaAdapter.detect(order(), hookMeta("order.payment_success"))).toMatchObject({
      format: "decta.order",
      confidence: 0.95,
    });
    // A documented order.* header anchors a body that lacks the order markers.
    expect(
      dectaAdapter.detect({ id: "PPLsynth-x", status: "paid" }, hookMeta("order.payment_success")),
    ).toMatchObject({ format: "decta.order", confidence: 0.75, supported: true });
    expect(dectaAdapter.detect({ id: "x" }, hookMeta("card.created"))).toMatchObject({
      format: "decta.card_webhook",
      confidence: 0.9,
      supported: false,
    });
    expect(dectaAdapter.detect(order(), hookMeta("payment.paid", "v0.5"))).toMatchObject({
      format: "decta.webhook_v05",
      confidence: 0.9,
      supported: false,
    });
    // Undocumented event names on unrelated bodies are not claimed.
    expect(
      dectaAdapter.detect({ id: "x", status: "paid" }, hookMeta("order.created")).confidence,
    ).toBe(0);
  });

  it("ignores form-encoded input", () => {
    expect(dectaAdapter.detect(order(), { format: "form" }).confidence).toBe(0);
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "decta", message: "DECTA error" },
      "decta",
      null,
      [],
      { error: { code: "116" } },
      { status: "paid" },
      { status: "error", code: "116", message: "x" },
      { id: "x", status: "paid" },
      { processing_status: "999" },
      { processing_status: "116", amount: 1 },
      { processing_status: 116 },
      { threed_check_url: 1 },
      { amount: [{ message: "m" }] },
      { amount: [] },
      { object: "event", type: "order", id: "x", status: "paid" },
      { type: "invoice", id: "x", status: "paid" },
    ]) {
      expect(dectaAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
  // Directories of adapters that are still being written can be empty.
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "decta" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );

  it("includes the Stripe and Adyen fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen"]));
  });
  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    let checked = 0;
    for (const file of readdirSync(`${root}${dir}`)) {
      const parsed = parseInput(readFileSync(`${root}${dir}/${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          dectaAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("decta parsing", () => {
  it("reports missing required order fields as parse issues without throwing", () => {
    const { id: _id, ...noId } = order();
    const r = analyze(json(noId));
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "decta.order" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^id:/);
    expect(r.events).toEqual([]);

    const r2 = analyze(webhook("order.payment_success", { id: "PPLsynth-order-0998" }));
    expect(r2.records[0]!.status).toBe("invalid");
    expect(r2.records[0]!.reasons.join(" ")).toMatch(/status/);
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(dectaAdapter.parse(order({ status: 7 }), "decta.order").ok).toBe(false);
    expect(dectaAdapter.parse(order({ status_changes: "paid" }), "decta.order").ok).toBe(false);
    expect(dectaAdapter.parse({}, "decta.unknown").ok).toBe(false);
    expect(dectaAdapter.parse({}, "toString").ok).toBe(false);
    expect(dectaAdapter.parse({}, "decta.card_webhook").ok).toBe(false);
  });

  it("tolerates unknown fields, null values and numeric codes", () => {
    const p = dectaAdapter.parse(
      order({ avs_status: null, brand_new: [1] }, { processing_status: { code: 116 } }),
      "decta.order",
    );
    expect(p.ok).toBe(true);
    expect(firstError(json(failed(116))).code).toBe("116");
  });

  it("fails cleanly on malformed input and XML", () => {
    const r = analyzeText('{"type": "order", "id": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
    const xml = analyzeText("<order><status>paid</status></order>", options);
    expect(!xml.ok && xml.error.code).toBe("UNSUPPORTED_FORMAT");
  });

  it("recognizes but does not analyze card webhooks", () => {
    const r = analyzeFixture("decta/card-webhook.txt");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "decta.card_webhook" });
    expect(r.warnings[0]!.message).toMatch(/saved card/);
    expect(r.events).toEqual([]);
    const report = toJsonReport(r);
    expect(report).not.toContain("411111PLANTED1111");
    expect(report).not.toContain("Planted Card Holder");
  });

  it("recognizes but does not analyze deprecated v0.5 webhooks", () => {
    const r = analyzeFixture("decta/legacy-v05-webhook.txt");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "decta.webhook_v05" });
    expect(r.warnings[0]!.message).toMatch(/deprecated/);
    expect(r.events).toEqual([]);
  });
});

describe("decta orders", () => {
  it("normalizes a paid order from an API response", () => {
    const r = analyzeFixture("decta/order-paid-response.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "decta.order" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "order_status.paid",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "paid",
      paymentReference: "PPLsynth-order-0001",
      relatedReference: "PPLsynth-proc-0001",
      merchantReference: "DE1001",
    });
    // Amount units are not documented, so nothing is converted.
    expect(e.amountMinor).toBeUndefined();
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.deliveryKey).toBeUndefined();
    expect(e.attributes).toMatchObject({
      deliveryChannel: "api_response",
      eventTypeSource: "order status",
      statusHistory: ["created", "issued", "viewed", "in_progress", "paid"],
      statusHistoryOrder: "oldest_first",
      latestOperationAmount: "25.00",
      latestOperationCurrency: "EUR",
      processingStatusCode: "000",
      processingStatusGroup: "Approved",
      paymentSystem: "SMS",
      permittedActions: ["refund", "reverse"],
      isPayable: false,
      avsStatus: "Y",
      fullNameValidation: "full_match",
      threeDSFlow: "Frictionless",
      threeDSSource: "DECTA MPI",
      eciChangedAfterAuthorization: false,
      fraudCheckCode: "PPLsynth-fc-0",
      fraudCheckCodeInterpreted: false,
      amountRefunded: "0.00",
      issuedAt: "2026-10-20T10:00:00.000Z",
      paidAt: "2026-10-20T10:01:05.000Z",
      clearedAt: "2026-10-21T02:00:00.000Z",
      httpStatus: 200,
    });
    expect(JSON.stringify(e.attributes)).not.toContain('"05"');
    expect(r.errors).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it("decodes a declined payment webhook", () => {
    const r = analyzeFixture("decta/order-declined-webhook.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "order.payment_failure",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "failure",
      providerStatus: "failed",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      deliveryChannel: "webhook",
      webhookEvent: "order.payment_failure",
      webhookVersion: "v0.6",
      webhookSigned: false,
      eventTypeSource: "X-Webhook-Event header",
      orderStatusFinal: false,
    });
    expect(r.errors[0]).toMatchObject({
      code: "116",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage: "Not sufficient funds",
      paymentReference: "PPLsynth-order-0002",
      attemptReference: "PPLsynth-proc-0002",
      subCodes: {
        order_status: "failed",
        webhook_event: "order.payment_failure",
        status_group: "Decline no funds",
      },
      source: { path: "transaction_details.processing_status" },
    });
    expect(r.errors[0]!.explanation).toMatch(/contact the card issuer/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("builds one timeline for a two-step payment, capture and refund", () => {
    const r = analyzeFixture("decta/two-step-flow.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["order_status.hold", "authorization", "success"],
      ["order_status.paid", "capture", "success"],
      ["order_status.refunded", "refund", "success"],
    ]);
    expect(r.events[1]!.attributes.capturedFromHold).toBe(true);
    expect(r.events[2]!.attributes.amountRefunded).toBe("20.00");
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("AMOUNT_MISMATCH");
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("does not invent a delivery key for repeated webhooks", () => {
    const r = analyzeFixture("decta/duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events.map((e) => e.deliveryKey)).toEqual([undefined, undefined]);
    expect(r.events.map((e) => e.observedTimestamp)).toEqual([
      "2026-10-20T11:00:02.000Z",
      "2026-10-20T11:00:32.000Z",
    ]);
    expect(r.groups).toHaveLength(1);
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(dectaManifest.delivery.duplicateKey).toMatch(/none documented/);
  });

  it("keeps unrelated orders apart", () => {
    const r = analyzeFixture("decta/unrelated-orders.json");
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => g.latestOutcome)).toEqual(["failure", "success"]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: "104", category: "card_declined" });
  });

  it("links an order webhook and a later API response by the order id", () => {
    const hook = webhook("order.hold", order({ status: "hold" }));
    const r1 = analyze(hook);
    const r2 = analyze(json([order({ status: "hold" }), order({ id: "pplsynth-ORDER-0999" })]));
    expect(r1.events[0]).toMatchObject({ stage: "authorization", outcome: "success" });
    expect(r2.groups).toHaveLength(1);
  });

  it("never presents an issuer timeout as safe to retry", () => {
    const r = analyzeFixture("decta/issuer-timeout.json");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "911",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      subCodes: { status_group: "Call acquirer" },
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.explanation).toMatch(/DECTA technical support/);
    expect(e.retryExplanation).toMatch(/confirm the final order status/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it.each([
    ["100", "card_declined", "customer_action_required", "strong"],
    ["102", "fraud_or_risk", "do_not_retry", "strong"],
    ["106", "authentication_failed", "do_not_retry", "strong"],
    ["109", "configuration", "do_not_retry", "strong"],
    ["110", "invalid_amount", "do_not_retry", "strong"],
    ["115", "payment_method_unavailable", "do_not_retry", "strong"],
    ["117", "authentication_failed", "customer_action_required", "strong"],
    ["160", "authentication_required", "customer_action_required", "strong"],
    ["198", "unknown", "manual_review", "possible"],
    ["209", "fraud_or_risk", "do_not_retry", "strong"],
    ["903", "provider_unavailable", "retry_conditionally", "strong"],
    ["913", "duplicate_request", "do_not_retry", "strong"],
    ["916", "configuration", "manual_review", "strong"],
    ["951", "unknown", "manual_review", "possible"],
    ["-1", "card_declined", "manual_review", "possible"],
  ])("decodes raw acquirer code %s as %s / %s", (code, category, retry, confidence) => {
    expect(firstError(json(failed(code)))).toMatchObject({ code, category, retry, confidence });
  });

  it("explains ambiguous codes", () => {
    expect(firstError(json(failed("951"))).explanation).toMatch(/merchant's or the card's limit/);
    const special = firstError(json(failed("-1")));
    expect(special.explanation).toMatch(/several causes/);
    expect(special.missingInformation.join(" ")).toMatch(/-1/);
  });

  it("does not decode approval, reversal and in-progress codes", () => {
    for (const code of ["000", "001", "002", "006", "007", "400"]) {
      expect(analyze(json(order({}, { processing_status: { code } }))).errors).toEqual([]);
    }
    const partial = firstEvent(json(order({}, { processing_status: { code: "002" } })));
    expect(partial.attributes.partialApproval).toBe(true);
    const r = analyze(
      json(order({ status: "in_progress" }, { processing_status: { code: "923" } })),
    );
    expect(r.errors).toEqual([]);
    expect(r.events[0]!.outcome).toBe("pending");
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("uses the stricter Merchant Advice Code guidance", () => {
    const r = analyzeFixture("decta/recurring-declined.json");
    expect(r.events[0]).toMatchObject({ isRecurring: true, stage: "payment", outcome: "failure" });
    expect(r.events[0]!.attributes).toMatchObject({
      fromSubscription: true,
      merchantAdviceCode: "02",
      traceId: "PPLsynth-trace-0001",
    });
    // 116 asks the customer to act; advice 02 (try later) does not relax that.
    expect(r.errors[0]).toMatchObject({
      code: "116",
      retry: "customer_action_required",
      subCodes: { merchant_advice_code: "02" },
    });
    expect(r.errors[0]!.explanation).toMatch(/Merchant Advice Code 02/);
    expect(ruleIds(r)).toContain("RECURRING_PAYMENT_FAILED");

    const stop = firstError(json(failed("100", { merchant_advice_code: "03" })));
    expect(stop.retry).toBe("do_not_retry");
    expect(stop.explanation).toMatch(/stricter retry guidance/);
    const odd = firstError(json(failed("100", { merchant_advice_code: "77" })));
    expect(odd.retry).toBe("customer_action_required");
    expect(odd.missingInformation.join(" ")).toMatch(/"77"/);
  });

  it("reports unrecognized codes and code-less failures honestly", () => {
    const unknown = firstError(json(failed("555")));
    expect(unknown).toMatchObject({
      code: "555",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/555/);
    const bare = firstError(
      json(order({ status: "failed" }, { processing_status: null, processing_payment_id: null })),
    );
    expect(bare).toMatchObject({ code: "failed", confidence: "insufficient" });
    expect(bare.missingInformation.join(" ")).toMatch(/response_type=minimum/);
    // An unknown code on a paid order is not an error.
    expect(analyze(json(order({}, { processing_status: { code: "555" } }))).errors).toEqual([]);
  });

  it("decodes attempt errors and documented error texts conservatively", () => {
    const r = analyze(
      json(
        order(
          { status: "failed" },
          {
            processing_status: null,
            errors: [
              { code: "PPLsynth-e1", description: "Operation timed out" },
              { code: "PPLsynth-e2", description: "Something else" },
            ],
          },
        ),
      ),
    );
    expect(r.errors.map((e) => [e.code, e.category, e.retry, e.confidence])).toEqual([
      ["PPLsynth-e1", "authentication_failed", "customer_action_required", "possible"],
      ["PPLsynth-e2", "unknown", "unknown", "insufficient"],
    ]);
    expect(r.errors[0]!.explanation).toMatch(/3-D Secure was abandoned/);
    expect(r.errors[1]!.missingInformation[0]).toMatch(/code vocabulary/);
  });

  it.each([
    ["order.issued", "issued", "payment", "pending"],
    ["order.payment_success", "paid", "payment", "success"],
    ["order.hold", "hold", "authorization", "success"],
    ["order.canceled", "cancelled", "cancellation", "success"],
    ["order.invoice_viewed", "viewed", "payment", "pending"],
    ["order.invoice_refunded", "refunded", "refund", "success"],
    ["order.invoice_reversal", "reversed", "reversal", "success"],
    ["order.refund_failure", "paid", "refund", "failure"],
    ["order.refund_init_failure", "paid", "refund", "failure"],
    ["order.reversal_failure", "paid", "reversal", "failure"],
    ["order.refund_in _progress", "paid", "refund", "pending"],
    ["order.reversal_in _progress", "paid", "reversal", "pending"],
    ["order.invoice_refund_reversed", "paid", "reversal", "unknown"],
    ["order.received", "received", "payment", "success"],
    ["order.rejected", "rejected", "payment", "failure"],
    ["order.expired", "expired", "payment", "failure"],
    ["order.representation", "chargeback", "dispute", "unknown"],
    ["order.retrieval", "paid", "dispute", "unknown"],
    ["order.pre-arbitration", "chargeback", "dispute", "unknown"],
    ["order.good_faith", "chargeback", "dispute", "unknown"],
    ["order.fraud_advice", "paid", "dispute", "unknown"],
    ["oct.issued", "issued", "payout", "pending"],
    ["oct.success", "paid", "payout", "success"],
  ])("maps webhook %s (status %s) to %s / %s", (event, status, stage, outcome) => {
    const e = firstEvent(webhook(event, order({ status })));
    expect(e).toMatchObject({ eventType: event, eventTypeKnown: true, stage, outcome });
  });

  it.each([
    ["draft", "other", "pending"],
    ["issued", "payment", "pending"],
    ["overdue", "payment", "pending"],
    ["hold", "authorization", "success"],
    ["received", "payment", "success"],
    ["rejected", "payment", "failure"],
    ["expired", "payment", "failure"],
    ["cancelled", "cancellation", "success"],
    ["refunded", "refund", "success"],
    ["chargeback", "dispute", "unknown"],
    ["reversed", "reversal", "success"],
  ])("maps order status %s to %s / %s", (status, stage, outcome) => {
    const e = firstEvent(json(order({ status, status_changes: [] })));
    expect(e).toMatchObject({ eventType: `order_status.${status}`, stage, outcome });
  });

  it("keeps undocumented statuses and event spellings unknown", () => {
    const withdrawn = analyze(json(order({ status: "withdrawn" })));
    expect(withdrawn.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(withdrawn.events[0]!.attributes.orderStatusMeaningDocumented).toBe(false);
    expect(ruleIds(withdrawn)).toContain("UNKNOWN_EVENT_TYPE");
    const label = firstEvent(json(order({ status: "refund_initiated" })));
    expect(label).toMatchObject({ outcome: "unknown", eventTypeKnown: false, stage: "other" });
    expect(label.attributes.orderStatusKnown).toBe(false);
    // Only the documented spelling (with a space) is known; the order status still decides the outcome.
    const spelled = firstEvent(webhook("order.refund_in_progress", order({ status: "paid" })));
    expect(spelled).toMatchObject({
      eventType: "order.refund_in_progress",
      eventTypeKnown: false,
      outcome: "success",
    });
    expect(spelled.attributes.webhookEventKnown).toBe(false);
    // A paid order without a hold in its history is a payment, not a capture.
    expect(firstEvent(json(order())).stage).toBe("payment");
  });

  it("reports a chargeback after a successful payment", () => {
    const r = analyzeFixture("decta/chargeback-webhook.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "order.chargeback",
      stage: "dispute",
      outcome: "unknown",
      providerStatus: "chargeback",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      chargebacks: "60.00",
      chargebacksReasonCode: "4837",
      chargebacksReasonCodeInterpreted: false,
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("CHARGEBACK_REPORTED");
    expect(JSON.stringify(r.events) + toJsonReport(r)).not.toMatch(/PLANTEDARN|PLANTEDRRN/);

    const paidFirst = analyze(
      json([
        order({ id: "PPLsynth-order-0005" }),
        JSON.parse(fixture("decta/chargeback-webhook.txt").split("\n\n")[1]!),
      ]),
    );
    const finding = paidFirst.findings.find((f) => f.ruleId === "CHARGEBACK_REPORTED")!;
    expect(finding.title).toBe("Chargeback after a successful payment");
  });

  it("keeps a payout apart from payments", () => {
    const r = analyzeFixture("decta/payout-oct-failure.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "oct.failure",
      stage: "payout",
      outcome: "failure",
    });
    expect(r.errors[0]).toMatchObject({ code: "119", category: "card_declined" });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(ruleIds(r)).not.toContain("PAYMENT_FAILURE");
  });
});

describe("decta Host2Host and 3-D Secure responses", () => {
  it("shows a 3-D Secure challenge as pending without copying step data", () => {
    const r = analyzeFixture("decta/three-ds-challenge.json");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "decta.host2host" });
    expect(r.events[0]).toMatchObject({
      eventType: "tds_pending",
      eventTypeKnown: true,
      stage: "authentication",
      outcome: "pending",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      tdsStatus: "tds_pending",
      nextStep: "tds_validate",
      mdstatus: "9",
      mdstatusMeaning: "not documented",
      threeDSProtocol: "3DS2.2.0",
      pendingAction: ["next_step_url", "redirectToACSForm"],
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
    expect(ruleIds(r)).toContain("MISSING_REFERENCE");
    const dump = JSON.stringify(r.events) + toJsonReport(r);
    expect(dump).not.toMatch(/PLANTEDSTEPURL|PLANTEDACSFORM|UExBTlRFRFhJRDAwMDE/);
  });

  it("decodes the final 3-D Secure step decline", () => {
    const r = analyzeFixture("decta/three-ds-declined.json");
    expect(r.events[0]).toMatchObject({
      eventType: "tds_completed",
      stage: "payment",
      outcome: "failure",
      providerStatus: "116",
    });
    expect(r.events[0]!.attributes.nextStep).toBe("none");
    expect(r.errors[0]).toMatchObject({
      code: "116",
      category: "insufficient_funds",
      subCodes: { tds_status: "tds_completed", status_group: "Decline no funds" },
      source: { path: "processing_status" },
    });
    expect(r.errors[0]!.paymentReference).toBeUndefined();
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no order id/);
  });

  it("reads short wallet and Host2Host responses", () => {
    const ok = analyzeFixture("decta/wallet-approved.json");
    expect(ok.events[0]).toMatchObject({
      eventType: "processing_status",
      stage: "payment",
      outcome: "success",
      providerStatus: "000",
    });
    expect(ok.errors).toEqual([]);
    const check = analyze(json({ threed_check_url: "https://x.example/p/PLANTEDCHECKURL/3d/" }));
    expect(check.events[0]).toMatchObject({ stage: "authentication", outcome: "pending" });
    expect(check.events[0]!.attributes.pendingAction).toEqual(["threed_check_url"]);
    expect(toJsonReport(check)).not.toContain("PLANTEDCHECKURL");
    expect(firstEvent(json({ processing_status: "923" })).outcome).toBe("pending");
  });

  it("reports an undocumented code in a step response", () => {
    const e = firstError(
      json({ status: "tds_completed", next_step: null, processing_status: "777" }),
    );
    expect(e).toMatchObject({ code: "777", confidence: "insufficient", category: "unknown" });
    const md = firstEvent(
      json({
        status: "tds_initiated",
        next_step: "enrollment_request",
        three_d_secure_details: { mdstatus: "51" },
      }),
    );
    expect(md.attributes).toMatchObject({
      mdstatusMeaning: "3DS method not needed",
      nextStep: "enrollment_request",
    });
  });
});

describe("decta validation errors", () => {
  it("decodes a validation error with its HTTP status", () => {
    const r = analyzeFixture("decta/validation-error.txt");
    expect(r.records[0]).toMatchObject({ format: "decta.validation_error", confidence: 0.7 });
    expect(r.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      providerStatus: "HTTP 400",
    });
    expect(r.events[0]!.attributes.fields).toEqual(["client", "products", "__all__"]);
    expect(r.errors.map((e) => [e.code, e.subCodes.field, e.category, e.confidence])).toEqual([
      ["invalid", "client", "invalid_request", "strong"],
      ["invalid", "products", "invalid_request", "strong"],
      ["invalid", "__all__", "invalid_request", "possible"],
    ]);
    expect(r.errors[0]).toMatchObject({
      retry: "do_not_retry",
      providerMessage: "This field is required.",
      subCodes: { http_status: "400" },
    });
    expect(r.errors[0]!.explanation).toMatch(/not a payment status/);
    expect(r.errors[2]!.explanation).toMatch(/request data or the order's status/);
  });

  it("decodes documented 400 descriptions and undocumented codes conservatively", () => {
    const disabled = firstError(
      httpResponse(400, { __all__: [{ message: "Account disabled!", code: "invalid" }] }),
    );
    expect(disabled).toMatchObject({
      category: "configuration",
      retry: "manual_review",
      confidence: "possible",
    });
    const processing = firstError(
      httpResponse(400, { __all__: [{ message: "Error during payment processing", code: "x" }] }),
    );
    expect(processing).toMatchObject({ category: "unknown", retry: "manual_review" });
    expect(processing.outcomeKnown).toBeUndefined();
    const other = firstError(
      httpResponse(400, { amount: [{ message: "Too big", code: "max_value" }] }),
    );
    expect(other).toMatchObject({
      code: "max_value",
      category: "invalid_request",
      confidence: "possible",
    });
    expect(other.missingInformation.join(" ")).toMatch(/not documented/);
  });

  it("does not analyze a field error object without DECTA markers", () => {
    const r = analyze(json({ amount: [{ message: "m", code: "invalid" }] }));
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.errors).toEqual([]);
  });
});

describe("decta sensitive data", () => {
  const PLANTED = [
    "PLANTEDBEARERSECRET",
    "Planted Referrer Text",
    "PLANTEDAPIDOURL",
    "PLANTEDCHECKOUTURL",
    "PLANTEDDIRECTPOST",
    "198.51.100.77",
    "planted.person@example.com",
    "+371PLANTED00",
    "PlantedFirst",
    "PlantedLast",
    "PLANTEDPERSONAL01",
    "planted.author@example.com",
    "Planted Author Name",
    "522222PLANTED2222",
    "Planted Holder Name",
    "PLANTEDAUTHCODE",
    "PLANTEDRRN02",
    "PLANTEDARN00000000000002",
    "PLANTEDECI1",
    "PLANTEDECI2",
    "PLANTEDXID",
    "PLANTEDCAVV",
    "Planted 3DS description",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("decta/sensitive-webhook.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "decta.order" });
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.events[0]!.attributes).toMatchObject({
      webhookSigned: false,
      eciChangedAfterAuthorization: true,
    });
    expect(r.errors[0]).toMatchObject({
      code: "100",
      retry: "do_not_retry",
      subCodes: { merchant_advice_code: "03" },
    });
  });
});

describe("decta manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(dectaAdapter);
    expect(dectaAdapter.manifest).toBe(dectaManifest);
    expect(manifestOnly).toBe(dectaManifest);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(dectaManifest).toMatchObject({
      id: "decta",
      version: DECTA_ADAPTER_VERSION,
      wave: "HR-3",
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
      delivery: { duplicatesDocumented: false, ordering: "not_documented" },
    });
    expect([...dectaManifest.categories].sort()).toEqual([
      "acquiring",
      "card_processing",
      "gateway",
      "orchestration",
    ]);
    for (const s of dectaManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/(www|docs)\.decta\.com\//);
    expect(dectaManifest.sectors.map((s) => s.sector.toLowerCase()).join(" ")).not.toMatch(
      /adult|crypto|dating|nutra/,
    );
    const limits = dectaManifest.limitations.join(" ");
    expect(limits).toMatch(/no signature/);
    expect(limits).toMatch(/never treated as authentic/);
    expect(limits).toMatch(/No delivery key is set/);
    expect(limits).toMatch(/not converted to minor units/);
    expect(limits).toMatch(/not documented/);
  });

  it("contains every documented code, status and event", () => {
    expect(Object.keys(RAW_ACQUIRER_CODES)).toHaveLength(83);
    expect(Object.keys(SPECIAL_CODES)).toEqual(["-1"]);
    expect(Object.keys(MERCHANT_ADVICE_CODES)).toHaveLength(5);
    expect(AVS_CODES.size).toBe(18);
    expect(Object.keys(ORDER_STATUSES)).toHaveLength(17);
    expect(ORDER_STATUS_ENUM.size).toBe(15);
    expect(Object.keys(WEBHOOK_EVENTS)).toHaveLength(31);
    expect(LEGACY_WEBHOOK_EVENTS.size).toBe(8);
    expect(Object.keys(TDS_STATUSES)).toHaveLength(3);
    expect(Object.keys(DOCUMENTED_MESSAGES)).toHaveLength(9);
    expect(findCode("116")).toMatchObject({ group: "Decline no funds" });
    expect(findCode("constructor")).toBeUndefined();
    const groups = new Set(Object.values(RAW_ACQUIRER_CODES).map((e) => e.group));
    expect([...groups].sort()).toEqual([
      "Accepted",
      "Approved",
      "Call acquirer",
      "Decline",
      "Decline no funds",
      "Not accepted",
      "Pick-up",
    ]);
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      dectaManifest,
      RAW_ACQUIRER_CODES,
      SPECIAL_CODES,
      MERCHANT_ADVICE_CODES,
      ORDER_STATUSES,
      WEBHOOK_EVENTS,
      DOCUMENTED_MESSAGES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});

describe("decta plain-text error responses", () => {
  const text = fixture("decta/refund-text-error.txt");

  it("decodes a documented text when DECTA is selected", () => {
    const r = analyzeText(text, { ...options, provider: "decta" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.records[0]).toMatchObject({ provider: "decta", format: "decta.text_error" });
    expect(r.result.errors).toHaveLength(1);
    expect(r.result.errors[0]).toMatchObject({
      code: "HTTP 400",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "possible",
      providerMessage: "Invalid order status or refund timeout",
    });
    expect(r.result.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
  });

  it("stays below automatic detection and names DECTA as the likely provider", () => {
    const r = analyzeText(text, options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.records[0]).toMatchObject({ status: "unsupported", provider: "decta" });
    expect(r.result.errors).toHaveLength(0);
  });

  it("does not claim other text bodies", () => {
    const other =
      "HTTP/1.1 400 Bad Request\nContent-Type: text/plain\n\nSomething else went wrong\n";
    const r = analyzeText(other, { ...options, provider: "decta" });
    expect(r.ok && r.result.records[0]!.status).toBe("unsupported");
  });
});
