import { describe, expect, it } from "vitest";
import { buildReport, toJsonReport, toMarkdownReport, REPORT_DISCLAIMER } from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";
import { analyze, analyzeFixture, fixture, ruleIds } from "./helpers.js";

describe("rule catalog", () => {
  it("has unique ids and semantic versions", () => {
    const ids = defaultRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of defaultRules) expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("covers the initial finding set", () => {
    expect(defaultRules.map((r) => r.id).sort()).toEqual([
      "AMOUNT_MISMATCH",
      "CAPTURE_FAILED_AFTER_AUTHORIZATION",
      "CHARGEBACK_REPORTED",
      "CONFLICTING_OBSERVATIONS",
      "DUPLICATE_DELIVERY",
      "MISSING_REFERENCE",
      "OUT_OF_ORDER_ARRIVAL",
      "PAYMENT_FAILURE",
      "PAYOUT_STATUS",
      "POSSIBLE_RETRY_RISK",
      "POTENTIAL_STATE_INCONSISTENCY",
      "RECURRING_PAYMENT_FAILED",
      "REFUND_PENDING",
      "UNKNOWN_EVENT_TYPE",
      "UNRESOLVED_OUTCOME",
    ]);
  });
});

describe("reference scenarios", () => {
  it("successful Stripe payment: no findings", () => {
    expect(ruleIds(analyzeFixture("stripe/successful-payment.json"))).toEqual([]);
  });

  it("Stripe authentication required: unresolved, decoded", () => {
    const r = analyzeFixture("stripe/authentication-required.json");
    expect(ruleIds(r)).toEqual(["UNRESOLVED_OUTCOME"]);
    expect(r.errors[0]).toMatchObject({
      category: "authentication_required",
      retry: "customer_action_required",
    });
  });

  it("Stripe duplicate delivery is informational, not a bug", () => {
    const r = analyzeFixture("stripe/duplicate-webhook.json");
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0]!;
    expect(f).toMatchObject({
      ruleId: "DUPLICATE_DELIVERY",
      severity: "info",
      confidence: "confirmed",
    });
    expect(f.explanation).toMatch(/not necessarily an application bug/);
    expect(f.limitations.join(" ")).toMatch(/cannot show whether your application processed/);
  });

  it("Stripe out-of-order arrival with receipt timestamps is confirmed", () => {
    const r = analyzeFixture("stripe/out-of-order.json");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      ruleId: "OUT_OF_ORDER_ARRIVAL",
      severity: "info",
      confidence: "confirmed",
    });
    // Timeline is chronological by event time regardless of arrival.
    expect(r.events.map((e) => e.eventType)).toEqual([
      "payment_intent.created",
      "charge.succeeded",
      "payment_intent.succeeded",
    ]);
  });

  it("out-of-order from file order alone is only 'possible'", () => {
    const r = analyzeFixture("stripe/events.jsonl");
    expect(r.arrivalOrderInferred).toBe(true);
    expect(r.findings[0]).toMatchObject({ ruleId: "OUT_OF_ORDER_ARRIVAL", confidence: "possible" });
    expect(r.findings[0]!.limitations[0]).toMatch(/assumed from the order of records/);
  });

  it("Stripe terminal-state violation", () => {
    const r = analyzeFixture("stripe/state-inconsistency.json");
    expect(r.findings[0]).toMatchObject({
      ruleId: "POTENTIAL_STATE_INCONSISTENCY",
      severity: "medium",
      confidence: "strong",
    });
  });

  it("Stripe api_error: verify before retry", () => {
    const r = analyzeFixture("stripe/api-error-unknown-outcome.json");
    expect(r.suggestedView).toBe("decoder");
    expect(ruleIds(r)).toEqual(["POSSIBLE_RETRY_RISK"]);
    expect(r.findings[0]!.recommendedAction).toMatch(/Verify the original operation/);
  });

  it("Adyen duplicate + conflicting capture", () => {
    const r = analyzeFixture("adyen/duplicate-and-conflict.json");
    expect(ruleIds(r)).toEqual([
      "CAPTURE_FAILED_AFTER_AUTHORIZATION",
      "CONFLICTING_OBSERVATIONS",
      "DUPLICATE_DELIVERY",
      "PAYMENT_FAILURE",
    ]);
    const conflict = r.findings.find((f) => f.ruleId === "CONFLICTING_OBSERVATIONS")!;
    expect(conflict.evidenceEventIds).toHaveLength(2);
  });

  it("Adyen retry risk: two authorisations for one order and an uncertain error", () => {
    const r = analyzeFixture("adyen/retry-risk.json");
    const risks = r.findings.filter((f) => f.ruleId === "POSSIBLE_RETRY_RISK");
    expect(risks.map((f) => f.title)).toEqual([
      "Several successful authorizations for one order reference",
      "Outcome of the original request is unknown",
    ]);
    expect(risks.every((f) => f.severity !== "critical" && f.severity !== "high")).toBe(true);
  });

  it("mixed data keeps unrelated transactions apart", () => {
    const r = analyzeFixture("mixed/unrelated-transactions.json");
    expect(r.groups).toHaveLength(4);
    expect(new Set(r.groups.map((g) => g.provider))).toEqual(new Set(["stripe", "adyen"]));
    expect(ruleIds(r)).toEqual(["MISSING_REFERENCE", "PAYMENT_FAILURE", "UNKNOWN_EVENT_TYPE"]);
  });

  it("unknown provider error fails safely with an explanation", () => {
    const r = analyzeFixture("malformed/unknown-provider-error.json");
    expect(r.events).toEqual([]);
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.warnings.map((w) => w.code)).toEqual(["UNSUPPORTED_RECORD", "NO_ANALYZABLE_RECORDS"]);
  });

  it("a single failure event does not invent other lifecycle events", () => {
    const r = analyze(
      JSON.stringify({
        id: "evt_x",
        object: "event",
        created: 1,
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_x",
            object: "payment_intent",
            status: "requires_payment_method",
            last_payment_error: {
              type: "card_error",
              code: "card_declined",
              decline_code: "generic_decline",
            },
          },
        },
      }),
    );
    expect(r.events).toHaveLength(1);
    expect(ruleIds(r)).toEqual(["PAYMENT_FAILURE"]);
  });

  it("Adyen modification without originalReference", () => {
    const r = analyze(
      JSON.stringify({
        notificationItems: [
          {
            NotificationRequestItem: { eventCode: "CAPTURE", success: "true", pspReference: "CAP" },
          },
        ],
      }),
    );
    expect(r.findings.find((f) => f.ruleId === "MISSING_REFERENCE")).toMatchObject({
      severity: "medium",
      title: "Modification without a link to its payment",
    });
  });

  it("Adyen capture after refused authorisation, and cancel + capture", () => {
    const items = [
      {
        eventCode: "AUTHORISATION",
        success: "false",
        pspReference: "P",
        eventDate: "2026-01-01T00:00:00Z",
        reason: "Refused",
      },
      {
        eventCode: "CAPTURE",
        success: "true",
        pspReference: "C",
        originalReference: "P",
        eventDate: "2026-01-01T00:01:00Z",
      },
      {
        eventCode: "CANCELLATION",
        success: "true",
        pspReference: "X",
        originalReference: "P",
        eventDate: "2026-01-01T00:02:00Z",
      },
    ];
    const r = analyze(
      JSON.stringify({ notificationItems: items.map((i) => ({ NotificationRequestItem: i })) }),
    );
    expect(
      r.findings.filter((f) => f.ruleId === "POTENTIAL_STATE_INCONSISTENCY").map((f) => f.title),
    ).toEqual([
      "Capture succeeded for a refused authorization",
      "Both cancellation and capture succeeded",
    ]);
  });

  it("never emits critical or high severity from the default catalog fixtures", () => {
    for (const f of [
      "stripe/successful-payment.json",
      "stripe/duplicate-webhook.json",
      "adyen/duplicate-and-conflict.json",
      "adyen/retry-risk.json",
      "mixed/unrelated-transactions.json",
    ]) {
      for (const finding of analyzeFixture(f).findings)
        expect(["critical", "high"]).not.toContain(finding.severity);
    }
  });

  it("every finding carries evidence, rule version and limitations", () => {
    for (const f of analyzeFixture("adyen/duplicate-and-conflict.json").findings) {
      expect(f.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(f.evidenceEventIds.length + (f.evidenceErrorIds?.length ?? 0)).toBeGreaterThan(0);
      expect(Array.isArray(f.limitations)).toBe(true);
    }
  });
});

describe("reports", () => {
  const result = analyzeFixture("stripe/successful-payment.json");

  it("masks identifiers by default and includes required metadata", () => {
    const report = buildReport(result);
    expect(report).toMatchObject({
      tool: "PandaPayLens",
      catalogVersion: "2026.10.3",
      redaction: {
        identifiersMasked: true,
        sensitiveFieldsExcluded: true,
        sensitiveDataDetected: true,
      },
      disclaimer: REPORT_DISCLAIMER,
    });
    const json = toJsonReport(result);
    expect(json).not.toContain("pi_3PPLsynthOK000001");
    expect(json).toContain("pi_••••0001");
    expect(json).not.toMatch(/client_secret|PPLsyntheticSecret|example\.com/);
  });

  it("can include identifiers but never blocked fields", () => {
    const json = toJsonReport(result, { includeIdentifiers: true });
    expect(json).toContain("pi_3PPLsynthOK000001");
    expect(json).not.toMatch(/PPLsyntheticSecret|synthetic\.customer|4242/);
  });

  it("renders Markdown with escaping and required sections", () => {
    const md = toMarkdownReport(analyzeFixture("malformed/xss.json"));
    expect(md).toContain("# PandaPayLens diagnostic report");
    expect(md).toContain("## Decoded errors");
    expect(md).toContain("## Limitations");
    expect(md).toContain(REPORT_DISCLAIMER.slice(0, 20));
    expect(md).not.toMatch(/<script|<img|<b |\]\(javascript/);
  });

  it("masks identifiers quoted inside finding text", () => {
    const md = toMarkdownReport(analyzeFixture("stripe/duplicate-webhook.json"));
    expect(md).not.toContain("evt_1PPLsynthDUP00001");
  });

  it("states when no events were supplied", () => {
    expect(toMarkdownReport(analyzeFixture("malformed/unknown-provider-error.json"))).toMatch(
      /transaction history is not available/,
    );
  });

  it("is deterministic for the same input and clock", () => {
    const a = toJsonReport(analyze(fixture("adyen/retry-risk.json"))).replace(
      /"durationMs": [\d.]+/,
      "",
    );
    const b = toJsonReport(analyze(fixture("adyen/retry-risk.json"))).replace(
      /"durationMs": [\d.]+/,
      "",
    );
    expect(a).toBe(b);
  });
});

describe("report masking of attempt references", () => {
  it("masks attemptReference by default", () => {
    const r = analyze(
      JSON.stringify({
        error: {
          type: "card_error",
          code: "card_declined",
          decline_code: "generic_decline",
          charge: "ch_PPLsynthATTEMPT01",
          payment_intent: { id: "pi_PPLsynthATTEMPT01" },
        },
      }),
    );
    const json = toJsonReport(r);
    expect(json).not.toContain("ch_PPLsynthATTEMPT01");
    expect(toJsonReport(r, { includeIdentifiers: true })).toContain("ch_PPLsynthATTEMPT01");
  });
});
