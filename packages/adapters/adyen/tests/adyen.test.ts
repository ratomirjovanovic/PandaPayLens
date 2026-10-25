import { describe, expect, it } from "vitest";
import { adyenAdapter } from "@pandapaylens/adyen";
import { analyze, analyzeFixture } from "../../../rules/tests/helpers.js";

const item = (fields: Record<string, unknown>) => ({
  NotificationRequestItem: {
    pspReference: "PSP1",
    success: "true",
    eventCode: "AUTHORISATION",
    ...fields,
  },
});
const webhook = (...items: Record<string, unknown>[]) =>
  JSON.stringify({ live: "false", notificationItems: items.map(item) });

describe("adyen detection", () => {
  it.each([
    [{ notificationItems: [item({})] }, "adyen.webhook.standard", 0.98, true],
    [{ notificationItems: [{}] }, "adyen.webhook.standard", 0.6, true],
    [{ resultCode: "Authorised", pspReference: "X" }, "adyen.payment_response", 0.9, true],
    [{ resultCode: "SomethingNew", merchantReference: "X" }, "adyen.payment_response", 0.55, true],
    [{ status: 422, errorCode: "130", errorType: "validation" }, "adyen.api_error", 0.85, true],
    [
      { type: "balancePlatform.x", data: {}, environment: "test" },
      "adyen.webhook.other",
      0.7,
      false,
    ],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(adyenAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("does not match on the provider name alone", () => {
    expect(adyenAdapter.detect({ provider: "adyen", message: "Adyen error" }).confidence).toBe(0);
    expect(adyenAdapter.detect([]).confidence).toBe(0);
  });

  it("does not claim Stripe errors", () => {
    expect(adyenAdapter.detect({ error: { type: "card_error" } }).confidence).toBe(0);
  });
});

describe("adyen parsing", () => {
  it("rejects malformed notification items", () => {
    const r = adyenAdapter.parse(
      {
        notificationItems: [
          {
            NotificationRequestItem: {
              eventCode: "AUTHORISATION",
              success: "yes",
              pspReference: "X",
            },
          },
        ],
      },
      "adyen.webhook.standard",
    );
    expect(r.ok).toBe(false);
    expect(adyenAdapter.parse({}, "adyen.nope").ok).toBe(false);
  });
});

describe("adyen normalization", () => {
  it("links modifications to the payment via originalReference", () => {
    const r = analyzeFixture("adyen/authorisation-and-capture.json");
    expect(
      r.events.map((e) => [
        e.eventType,
        e.paymentReference,
        e.relatedReference ?? null,
        e.stage,
        e.outcome,
      ]),
    ).toEqual([
      ["AUTHORISATION", "PPLSYNTH0000AUT3", null, "authorization", "success"],
      ["CAPTURE", "PPLSYNTH0000AUT3", "PPLSYNTH0000CAP3", "capture", "success"],
      ["REFUND", "PPLSYNTH0000AUT3", "PPLSYNTH0000REF3", "refund", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[2]!.amountMinor).toBe("2500");
    expect(r.findings).toEqual([]);
  });

  it("uses eventCode + pspReference as the delivery key", () => {
    const r = analyze(
      webhook({ eventCode: "CAPTURE", pspReference: "CAP1", originalReference: "AUTH1" }),
    );
    expect(r.events[0]!.deliveryKey).toBe("CAPTURE:CAP1");
  });

  it("drops the reason field of successful authorisations (card summary, expiry)", () => {
    const r = analyzeFixture("adyen/successful-authorisation.json");
    const dump = JSON.stringify(r);
    expect(dump).not.toContain("011873");
    expect(dump).not.toContain("03/2030");
    expect(r.events[0]!.attributes.reason).toBeUndefined();
    expect(r.sensitiveData.fieldPaths).toEqual(
      expect.arrayContaining([
        "[0].notificationItems[0].NotificationRequestItem.additionalData.hmacSignature",
      ]),
    );
  });

  it("does not export merchant account codes", () => {
    expect(
      JSON.stringify(analyzeFixture("adyen/successful-authorisation.json").events),
    ).not.toContain("PandaPayLensSyntheticECOM");
  });

  it.each([
    ["CAPTURE_FAILED", "true", "failure"],
    ["REFUND_FAILED", "true", "failure"],
    ["OFFER_CLOSED", "true", "failure"],
    ["EXPIRE", "false", "unknown"],
    ["PENDING", "true", "pending"],
    ["CHARGEBACK", "true", "unknown"],
    ["CANCELLATION", "false", "failure"],
    ["SOMETHING_NEW", "true", "unknown"],
  ])("maps %s success=%s to %s", (eventCode, success, outcome) => {
    expect(analyze(webhook({ eventCode, success })).events[0]!.outcome).toBe(outcome);
  });

  it("parses every item of a batch with its own source path", () => {
    const r = analyze(webhook({ pspReference: "A" }, { pspReference: "B" }));
    expect(r.events.map((e) => e.source.path)).toEqual([
      "notificationItems[0].NotificationRequestItem",
      "notificationItems[1].NotificationRequestItem",
    ]);
    expect(r.groups).toHaveLength(2);
  });

  it("does not merge payments that only share a merchantReference", () => {
    const r = analyze(
      webhook(
        { pspReference: "A", merchantReference: "ORDER" },
        { pspReference: "B", merchantReference: "ORDER" },
      ),
    );
    expect(r.groups).toHaveLength(2);
  });

  it("recognizes but does not analyze other webhook families", () => {
    const r = analyzeFixture("adyen/balance-platform-webhook.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "adyen.webhook.other" });
  });
});

describe("adyen error decoding", () => {
  it("decodes refusals from payment responses and webhooks", () => {
    const r = analyzeFixture("adyen/declined-authorisation.json");
    expect(
      r.errors.map((e) => [e.code, e.category, e.retry, e.subCodes.refusalReasonCode]),
    ).toEqual([
      ["Not enough balance", "insufficient_funds", "customer_action_required", "12"],
      ["Not enough balance", "insufficient_funds", "customer_action_required", "12"],
    ]);
    // Both records describe one attempt, so no retry-risk finding.
    expect(r.findings.map((f) => f.ruleId)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("handles unknown refusal reasons without guessing", () => {
    const r = analyze(
      JSON.stringify({
        pspReference: "X",
        resultCode: "Refused",
        refusalReason: "Brand new reason",
        refusalReasonCode: "999",
      }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "card_declined",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
  });

  it("treats resultCode Error as an uncertain outcome", () => {
    const r = analyze(JSON.stringify({ pspReference: "X", resultCode: "Error" }));
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.missingInformation).toContain("No refusal reason was supplied.");
  });

  it("does not decode non-failure result codes", () => {
    expect(
      analyze(JSON.stringify({ pspReference: "X", resultCode: "RedirectShopper" })).errors,
    ).toEqual([]);
  });

  it("decodes API errors by errorType, then HTTP status", () => {
    expect(analyzeFixture("adyen/api-error.json").errors[0]).toMatchObject({
      code: "130",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(
      analyze(JSON.stringify({ status: 429, errorCode: "x", message: "slow down" })).errors[0],
    ).toMatchObject({ category: "rate_limiting" });
    expect(
      analyze(JSON.stringify({ status: 418, errorCode: "x", message: "?" })).errors[0],
    ).toMatchObject({ category: "unknown", confidence: "insufficient" });
  });

  it("does not report an unresolved outcome for a validation error alone", () => {
    expect(analyzeFixture("adyen/api-error.json").findings).toEqual([]);
  });
});
