import { describe, expect, it } from "vitest";
import { decodeStripeError, stripeAdapter } from "@pandapaylens/stripe";
import { analyze, analyzeFixture } from "../../../rules/tests/helpers.js";

describe("stripe detection", () => {
  it.each([
    [{ error: { type: "card_error", code: "card_declined" } }, "stripe.api_error", 0.95, true],
    [{ error: { type: "something_else" } }, "stripe.api_error", 0.3, true],
    [{ id: "evt_1", object: "event", type: "x", data: { object: {} } }, "stripe.event.snapshot", 0.98, true],
    [{ id: "1", object: "event", type: "x", data: { object: {} } }, "stripe.event.snapshot", 0.8, true],
    [{ id: "pi_1", object: "payment_intent", status: "succeeded" }, "stripe.payment_intent", 0.98, true],
    [{ object: "v2.core.event", type: "x" }, "stripe.event.thin", 0.9, false],
    [{ object: "event", related_object: {} }, "stripe.event.thin", 0.9, false],
  ])("detects %j", (input, format, confidence, supported) => {
    const d = stripeAdapter.detect(input);
    expect(d).toMatchObject({ format, confidence, supported });
  });

  it("does not match on the provider name alone", () => {
    expect(stripeAdapter.detect({ message: "stripe error", provider: "stripe" }).confidence).toBe(0);
    expect(stripeAdapter.detect("stripe").confidence).toBe(0);
    expect(stripeAdapter.detect(null).confidence).toBe(0);
  });
});

describe("stripe parsing", () => {
  it("returns schema issues instead of throwing", () => {
    const r = stripeAdapter.parse({ object: "event", id: 5, type: "x", data: { object: {} } }, "stripe.event.snapshot");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues[0]).toMatch(/^id:/);
    expect(stripeAdapter.parse({}, "stripe.unknown").ok).toBe(false);
  });

  it("tolerates unknown fields", () => {
    expect(stripeAdapter.parse({ error: { type: "card_error", brand_new_field: [1] } }, "stripe.api_error").ok).toBe(true);
  });
});

describe("stripe error decoding", () => {
  it("keeps code, decline_code and advice_code distinct", () => {
    const d = decodeStripeError({ type: "card_error", code: "card_declined", decline_code: "insufficient_funds", advice_code: "do_not_try_again" });
    expect(d.code).toBe("card_declined");
    expect(d.subCodes).toEqual({ type: "card_error", decline_code: "insufficient_funds", advice_code: "do_not_try_again" });
    expect(d.category).toBe("insufficient_funds");
    // advice_code takes precedence for retry guidance
    expect(d.retry).toBe("do_not_retry");
    expect(d.confidence).toBe("strong");
  });

  it("falls back to the error type with lower confidence", () => {
    const d = decodeStripeError({ type: "invalid_request_error", code: "some_new_code" });
    expect(d.category).toBe("invalid_request");
    expect(d.confidence).toBe("possible");
    expect(d.missingInformation.join(" ")).toMatch(/some_new_code/);
  });

  it("reports unknown errors honestly", () => {
    const d = decodeStripeError({});
    expect(d).toMatchObject({ code: "unknown", category: "unknown", retry: "unknown", confidence: "insufficient" });
  });

  it("notes a missing decline_code on card errors", () => {
    expect(decodeStripeError({ type: "card_error", code: "card_declined" }).missingInformation.join(" ")).toMatch(/decline_code/);
  });

  it("never presents api_error retries as certain", () => {
    const d = decodeStripeError({ type: "api_error" });
    expect(d.retry).toBe("retry_conditionally");
    expect(d.retryExplanation).toMatch(/Verify/);
  });

  it("decodes the insufficient-funds fixture", () => {
    const r = analyzeFixture("stripe/insufficient-funds.json");
    expect(r.suggestedView).toBe("decoder");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      provider: "stripe",
      code: "card_declined",
      category: "insufficient_funds",
      retry: "customer_action_required",
      paymentReference: "pi_3PPLsynthNSF00001",
      providerMessage: "Your card has insufficient funds.",
    });
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain("https://docs.stripe.com/declines/codes");
  });

  it("decodes last_payment_error from payment_failed events and failed charges", () => {
    const r = analyze(
      JSON.stringify([
        { id: "evt_a", object: "event", created: 1, type: "payment_intent.payment_failed", data: { object: { id: "pi_a", object: "payment_intent", status: "requires_payment_method", last_payment_error: { type: "card_error", code: "card_declined", decline_code: "stolen_card", charge: "ch_a" } } } },
        { id: "evt_b", object: "event", created: 2, type: "charge.failed", data: { object: { id: "ch_b", object: "charge", status: "failed", payment_intent: "pi_a", failure_code: "card_declined", failure_message: "Declined", outcome: { reason: "lost_card", advice_code: "do_not_try_again" } } } },
      ]),
    );
    expect(r.errors.map((e) => [e.subCodes.decline_code, e.attemptReference, e.retry])).toEqual([
      ["stolen_card", "ch_a", "do_not_retry"],
      ["lost_card", "ch_b", "do_not_retry"],
    ]);
    expect(r.findings.map((f) => f.ruleId)).toContain("POSSIBLE_RETRY_RISK");
  });
});

describe("stripe normalization", () => {
  it("builds a correlated timeline from snapshot events", () => {
    const r = analyzeFixture("stripe/successful-payment.json");
    expect(r.events.map((e) => [e.eventType, e.outcome])).toEqual([
      ["payment_intent.created", "pending"],
      ["charge.succeeded", "success"],
      ["payment_intent.succeeded", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references.sort()).toEqual(["ch_3PPLsynthOK000001", "pi_3PPLsynthOK000001"]);
    expect(r.events[0]).toMatchObject({ amountMinor: "4999", currency: "EUR", eventTimestamp: "2025-10-25T08:00:00.000Z", deliveryKey: "evt_1PPLsynthOK000001" });
    expect(r.findings).toEqual([]);
  });

  it("keeps sensitive embedded fields out of normalized events", () => {
    const r = analyzeFixture("stripe/successful-payment.json");
    const dump = JSON.stringify(r.events);
    expect(dump).not.toMatch(/secret|synthetic\.customer@example\.com|Synthetic Customer|4242/);
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.sensitiveData.fieldPaths).toEqual(expect.arrayContaining(["[1].data.object.billing_details.email", "[2].data.object.client_secret"]));
  });

  it("does not use PaymentIntent.created as the time of a snapshot", () => {
    const r = analyze(JSON.stringify({ id: "pi_x", object: "payment_intent", status: "processing", created: 1761379200 }));
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.events[0]!.attributes.createdAt).toBe("2025-10-25T08:00:00.000Z");
    expect(r.events[0]!.outcome).toBe("pending");
  });

  it.each([
    ["succeeded", false, "success"],
    ["canceled", false, "failure"],
    ["requires_payment_method", false, "pending"],
    ["requires_payment_method", true, "failure"],
    ["requires_capture", false, "pending"],
    ["mystery", false, "unknown"],
  ])("maps PaymentIntent status %s (error=%s) to %s", (status, hasError, outcome) => {
    const pi = { id: "pi_x", object: "payment_intent", status, ...(hasError ? { last_payment_error: { type: "card_error" } } : {}) };
    expect(analyze(JSON.stringify(pi)).events[0]!.outcome).toBe(outcome);
  });

  it("derives refund outcomes from refund status", () => {
    const refund = (status: string) => ({ id: `evt_${status}`, object: "event", created: 1, type: "refund.updated", data: { object: { id: "re_1", object: "refund", status, charge: "ch_1", payment_intent: "pi_1" } } });
    const r = analyze(JSON.stringify(["succeeded", "pending", "failed", "weird"].map(refund)));
    expect(r.events.map((e) => e.outcome)).toEqual(["success", "pending", "failure", "unknown"]);
    expect(r.events[0]!.stage).toBe("refund");
  });

  it("marks unknown event types without guessing their outcome", () => {
    const r = analyzeFixture("mixed/unrelated-transactions.json");
    const invoice = r.events.find((e) => e.eventType === "invoice.paid")!;
    expect(invoice).toMatchObject({ eventTypeKnown: false, outcome: "unknown", stage: "other" });
  });

  it("recognizes but does not analyze thin events", () => {
    const r = analyzeFixture("stripe/thin-event.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "stripe.event.thin" });
    expect(r.warnings[0]!.message).toMatch(/thin events/);
  });
});
