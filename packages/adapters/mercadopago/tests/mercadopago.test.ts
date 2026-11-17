import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeText,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
} from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import {
  HTTP_ERRORS,
  PAYMENT_STATUSES,
  REJECTION_DETAILS,
  STATUS_DETAILS,
  mercadopagoAdapter,
  mercadopagoManifest,
} from "@pandapaylens/mercadopago";

const options: AnalyzeOptions = {
  adapters: [mercadopagoAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-11-17T12:00:00.000Z"),
};

const fixturesRoot = new URL("../../../../fixtures/", import.meta.url);
const fixture = (path: string) => readFileSync(fileURLToPath(new URL(path, fixturesRoot)), "utf8");

function analyze(text: string): AnalysisResult {
  const r = analyzeText(text, options);
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (path: string) => analyze(fixture(`mercadopago/${path}`));

const payment = (fields: Record<string, unknown> = {}) => ({
  id: 9000009001,
  status: "approved",
  status_detail: "accredited",
  currency_id: "BRL",
  payment_type_id: "credit_card",
  date_last_updated: "2026-11-10T10:00:05.000-03:00",
  transaction_amount: 10,
  ...fields,
});

describe("mercadopago detection", () => {
  const detect = (input: unknown, format: "json" | "form" = "json") =>
    mercadopagoAdapter.detect(input, { format });

  it("recognizes payments, refunds, webhooks, IPN and error bodies", () => {
    expect(detect(payment())).toMatchObject({ format: "mercadopago.payment", confidence: 0.95 });
    expect(detect(payment({ status: "pplsynth_new" }))).toMatchObject({
      format: "mercadopago.payment",
      confidence: 0.8,
    });
    expect(
      detect({ id: 1, payment_id: 2, amount: 5, refund_mode: "standard", status: "approved" }),
    ).toMatchObject({ format: "mercadopago.refund", supported: true });
    expect(
      detect({
        id: 1,
        live_mode: true,
        type: "payment",
        user_id: 3,
        api_version: "v1",
        action: "payment.updated",
        data: { id: "2" },
      }),
    ).toMatchObject({ format: "mercadopago.webhook", confidence: 0.95 });
    expect(detect({ topic: "payment", id: "123" }, "form")).toMatchObject({
      format: "mercadopago.ipn",
      confidence: 0.6,
    });
    expect(detect({ status: 400, error: "pplsynth_error", message: "x", cause: [] })).toMatchObject(
      {
        format: "mercadopago.error_response",
        confidence: 0.6,
      },
    );
  });

  it("does not claim generic or incomplete shapes", () => {
    expect(detect({ status: "approved" }).confidence).toBe(0);
    expect(detect({ error: "pplsynth_error", message: "x" }).confidence).toBe(0);
    expect(detect({ status: 400, error: "x", message: "y", cause: [], extra: 1 }).confidence).toBe(
      0,
    );
    expect(detect({ status_detail: "accredited", transaction_amount: 1, id: 1 }).confidence).toBe(
      0,
    );
    // IPN only as form data, and only with the documented keys.
    expect(detect({ topic: "payment", id: "123" }).confidence).toBe(0);
    expect(detect({ topic: "payment", id: "123", amount: "1" }, "form").confidence).toBe(0);
    expect(detect({ topic: "pplsynth", id: "123" }, "form").confidence).toBe(0);
    expect(detect({ id: 1, payment_id: 2, amount: 5, status: "approved" }).confidence).toBe(0);
  });

  it("recognizes other notification topics as unsupported", () => {
    const r = analyzeFixture("webhook-other-topic.json");
    expect(r.records[0]).toMatchObject({
      provider: "mercadopago",
      format: "mercadopago.webhook.other",
      status: "unsupported",
    });
    expect(r.events).toHaveLength(0);
    const ipn = analyzeFixture("ipn-merchant-order.txt");
    expect(ipn.records[0]).toMatchObject({
      format: "mercadopago.ipn.other",
      status: "unsupported",
    });
  });

  it("returns confidence 0 for every Stripe and Adyen fixture", () => {
    for (const dir of ["stripe", "adyen"]) {
      const root = new URL(`${dir}/`, fixturesRoot);
      for (const file of readdirSync(fileURLToPath(root))) {
        const r = analyzeText(readFileSync(fileURLToPath(new URL(file, root)), "utf8"), options);
        if (!r.ok) continue;
        for (const rec of r.result.records) expect(rec.provider, `${dir}/${file}`).toBeNull();
      }
    }
  });
});

describe("mercadopago payments", () => {
  it("normalizes an approved payment with minor units and safe attributes only", () => {
    const r = analyzeFixture("payment-approved.json");
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      provider: "mercadopago",
      stage: "payment",
      outcome: "success",
      providerStatus: "approved",
      paymentReference: "9000000101",
      merchantReference: "PPLsynth-order-0101",
      amountMinor: "12550",
      currency: "BRL",
      eventTimestamp: "2026-11-10T13:00:05.000Z",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      statusDetail: "accredited",
      paymentTypeId: "credit_card",
      threeDs: "AUTHENTICATED",
    });
    expect(r.errors).toHaveLength(0);
  });

  it("accepts transaction_amount as a decimal string, as in the documented example", () => {
    const r = analyze(JSON.stringify(payment({ transaction_amount: "24.50" })));
    expect(r.events[0]!.amountMinor).toBe("2450");
  });

  it("decodes a decline from status_detail", () => {
    const r = analyzeFixture("payment-rejected-insufficient-amount.json");
    expect(r.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "cc_rejected_insufficient_amount",
      category: "insufficient_funds",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "9000000201",
    });
  });

  it("treats a fraud rejection as do not retry", () => {
    const r = analyzeFixture("payment-rejected-high-risk.json");
    expect(r.errors[0]).toMatchObject({ category: "fraud_or_risk", retry: "do_not_retry" });
  });

  it("keeps an undocumented status_detail unknown", () => {
    const r = analyzeFixture("payment-rejected-undocumented-detail.json");
    expect(r.errors[0]).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not a documented rejection/);
  });

  it("reads status_detail together with status", () => {
    expect(analyzeFixture("payment-pending-challenge.json").events[0]).toMatchObject({
      stage: "authentication",
      outcome: "pending",
    });
    expect(analyzeFixture("payment-boleto-expired.json").events[0]).toMatchObject({
      stage: "cancellation",
      outcome: "failure",
      providerStatus: "cancelled",
    });
    const cb = (detail: string) =>
      analyze(JSON.stringify(payment({ status: "charged_back", status_detail: detail })))
        .events[0]!;
    expect(cb("in_process")).toMatchObject({ stage: "dispute", outcome: "pending" });
    expect(cb("settled")).toMatchObject({ stage: "dispute", outcome: "unknown" });
    // in_process as a detail of a pending payment is not the chargeback meaning.
    expect(
      analyze(
        JSON.stringify(payment({ status: "in_process", status_detail: "pending_contingency" })),
      ).events[0],
    ).toMatchObject({ stage: "payment", outcome: "pending" });
  });

  it("keeps an unknown status unknown", () => {
    const r = analyze(JSON.stringify(payment({ status: "pplsynth_new" })));
    expect(r.events[0]).toMatchObject({ outcome: "unknown", providerStatus: "pplsynth_new" });
  });

  it("reports parse issues for malformed payloads without throwing", () => {
    const r = analyzeFixture("malformed-payment-bad-installments.json");
    expect(r.events).toHaveLength(0);
    expect(r.records[0]).toMatchObject({ provider: "mercadopago", status: "invalid" });
    expect(JSON.stringify(r.records[0])).toMatch(/installments/);
  });
});

describe("mercadopago refunds and lifecycle", () => {
  it("normalizes a refund linked to its payment", () => {
    const r = analyzeFixture("refund-approved.json");
    expect(r.events[0]).toMatchObject({
      stage: "refund",
      outcome: "success",
      paymentReference: "9000000601",
      relatedReference: "9200000601",
    });
    expect(r.events[0]!.attributes).toMatchObject({ amount: "10.5", refundMode: "standard" });
  });

  it("groups authorization, capture, notifications and refund of one payment", () => {
    const r = analyzeFixture("payment-lifecycle.json");
    expect(r.events).toHaveLength(7);
    expect(r.groups).toHaveLength(1);
    // Notification date_created is the payment creation date, so they sort first.
    expect(r.events.map((e) => e.stage).sort()).toEqual(
      ["authorization", "payment", "payment", "payment", "payment", "payment", "refund"].sort(),
    );
    expect(r.events.at(-1)).toMatchObject({ providerStatus: "approved", outcome: "success" });
    const notifications = r.events.filter((e) => e.sourceFormat === "mercadopago.webhook");
    expect(notifications.every((e) => e.outcome === "unknown")).toBe(true);
  });

  it("keeps unrelated payments apart even with the same external_reference", () => {
    const r = analyzeFixture("unrelated-payments.json");
    expect(r.groups).toHaveLength(2);
  });
});

describe("mercadopago notifications", () => {
  it("normalizes a payment webhook without a status", () => {
    const r = analyzeFixture("webhook-payment-created.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payment.created",
      eventTypeKnown: true,
      outcome: "unknown",
      paymentReference: "9000000701",
      eventReference: "9100000701",
    });
    expect(r.events[0]!.deliveryKey).toBeUndefined();
  });

  it("recognizes a repeated delivery by identical content", () => {
    const r = analyzeFixture("webhook-duplicate.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.contentFingerprint).toBe(r.events[1]!.contentFingerprint);
  });

  it("reads a pasted HTTP webhook and never copies the signature headers", () => {
    const text = fixture("mercadopago/webhook-http.txt");
    const r = analyze(text);
    expect(r.events[0]).toMatchObject({
      eventType: "payment.updated",
      paymentReference: "9000000901",
    });
    const out = JSON.stringify(r.events) + JSON.stringify(toJsonReport(r));
    expect(out).not.toContain("PPLsynthSIGNATURE");
    expect(out).not.toContain("PPLsynth-0000-4000-8000-000000000901");
  });

  it("reads a chargeback notification as a dispute for its payment", () => {
    const r = analyzeFixture("webhook-chargeback.json");
    expect(r.events[0]).toMatchObject({
      stage: "dispute",
      eventType: "chargeback.changed_case_status",
      outcome: "unknown",
      paymentReference: "9000000101",
      relatedReference: "9300000101",
    });
  });

  it("drops chargeback ids that lost precision in JSON", () => {
    const r = analyze(
      '{"actions":["changed_case_status"],"api_version":"v1","data":{"id":217000061307271000,"payment_id":9000000102},"date_created":"2026-11-14T12:00:01-03:00","id":9100001002,"live_mode":false,"type":"topic_chargebacks_wh","user_id":9000000001}',
    );
    expect(r.events[0]!.paymentReference).toBe("9000000102");
    expect(r.events[0]!.relatedReference).toBeUndefined();
  });

  it("normalizes a payment IPN", () => {
    const r = analyzeFixture("ipn-payment.txt");
    expect(r.events[0]).toMatchObject({
      sourceFormat: "mercadopago.ipn",
      eventType: "ipn.payment",
      outcome: "unknown",
      paymentReference: "9000001101",
    });
  });

  it("reports a parse issue for a webhook without a payment id", () => {
    const r = analyze(
      JSON.stringify({
        id: 1,
        live_mode: true,
        type: "payment",
        user_id: 3,
        api_version: "v1",
        action: "payment.updated",
        data: { id: "2" },
      }).replace('"id":"2"', '"id":""'),
    );
    expect(r.events).toHaveLength(0);
  });
});

describe("mercadopago error responses", () => {
  it("decodes a validation error by HTTP status", () => {
    const r = analyzeFixture("error-bad-request.json");
    expect(r.errors[0]).toMatchObject({
      code: "pplsynth_error_400",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "possible",
      providerMessage: "PPLsynth invalid parameter",
    });
    expect(r.errors[0]!.subCodes).toMatchObject({ httpStatus: "400", causeCount: "1" });
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("error-unauthorized-http.txt");
    expect(r.errors[0]).toMatchObject({ category: "configuration", retry: "do_not_retry" });
  });

  it("never presents a server error as safe to retry", () => {
    const r = analyzeFixture("error-server-http.txt");
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/took effect/);
  });

  it("keeps an undocumented HTTP status unknown", () => {
    const r = analyze(JSON.stringify({ status: 418, error: "x", message: "y", cause: [] }));
    expect(r.errors[0]).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });
});

describe("mercadopago redaction", () => {
  it("never copies payer, card or free-text fields", () => {
    const planted = payment({
      payer: {
        email: "pplsynth.secret@example.com",
        identification: { type: "CPF", number: "PPLSYNTH-DOC-77" },
      },
      card: { first_six_digits: "PPLSYNTH-BIN", cardholder: { name: "PPLsynth Holder" } },
      description: "PPLsynth private description",
      additional_info: { ip_address: "PPLsynth-IP" },
      metadata: { note: "PPLsynth metadata" },
      notification_url: "https://pplsynth.example.com/private",
    });
    const r = analyze(JSON.stringify(planted));
    const out = JSON.stringify(r.events) + JSON.stringify(toJsonReport(r));
    for (const s of [
      "pplsynth.secret@example.com",
      "PPLSYNTH-DOC-77",
      "PPLSYNTH-BIN",
      "PPLsynth Holder",
      "PPLsynth private description",
      "PPLsynth-IP",
      "PPLsynth metadata",
      "pplsynth.example.com/private",
    ])
      expect(out).not.toContain(s);
  });

  it("never copies the refund requester name", () => {
    const r = analyzeFixture("refund-approved.json");
    expect(JSON.stringify(r.events) + JSON.stringify(toJsonReport(r))).not.toContain(
      "PPLsynth Seller",
    );
  });
});

describe("mercadopago catalog and manifest", () => {
  it("covers every documented payment status and keeps the manifest honest", () => {
    expect(Object.keys(PAYMENT_STATUSES).sort()).toEqual(
      [
        "approved",
        "authorized",
        "cancelled",
        "charged_back",
        "in_mediation",
        "in_process",
        "pending",
        "refunded",
        "rejected",
      ].sort(),
    );
    for (const s of Object.keys(STATUS_DETAILS)) expect(PAYMENT_STATUSES[s]).toBeDefined();
    expect(Object.keys(REJECTION_DETAILS).length).toBeGreaterThan(25);
    expect(HTTP_ERRORS[400]).toBeDefined();
    expect(mercadopagoManifest.status).toBe("limited");
    expect(Object.values(mercadopagoManifest.capabilities)).not.toContain("supported");
    expect(mercadopagoManifest.verifiedAt).toBe("2026-11-17");
  });

  it("uses only the plain hyphen in catalog and manifest text", () => {
    const text = JSON.stringify([mercadopagoManifest, REJECTION_DETAILS, STATUS_DETAILS]);
    expect(text).not.toMatch(new RegExp("[\u2013\u2014]"));
  });
});
