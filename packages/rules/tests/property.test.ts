import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  analyzeRecords,
  analyzeText,
  parseInput,
  sortEvents,
  toJsonReport,
  toMarkdownReport,
} from "@pandapaylens/core";
import { analyze, options } from "./helpers.js";

describe("robustness (property-based)", () => {
  it("arbitrary text never throws from analyzeText", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => {
        const r = analyzeText(s, options);
        expect(typeof r.ok).toBe("boolean");
        if (!r.ok) expect(r.error.code).not.toBe("INTERNAL_ERROR");
      }),
      { numRuns: 300 },
    );
  });

  it("arbitrary JSON values never cause an internal error", () => {
    fc.assert(
      fc.property(fc.array(fc.jsonValue({ maxDepth: 5 }), { maxLength: 8 }), (records) => {
        const r = analyzeRecords(records, options);
        expect(r.ok).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  // Structure-aware fuzzing: valid outer shapes with arbitrary inner values.
  const anyValue = fc.oneof(
    fc.string({ maxLength: 20 }),
    fc.integer(),
    fc.double(),
    fc.boolean(),
    fc.constant(null),
    fc.jsonValue({ maxDepth: 2 }),
  );
  const stripeLike = fc.record(
    {
      id: anyValue,
      object: fc.constantFrom("event", "payment_intent", "v2.core.event"),
      type: anyValue,
      created: anyValue,
      status: anyValue,
      data: fc.record({
        object: fc.dictionary(
          fc.constantFrom(
            "id",
            "object",
            "status",
            "amount",
            "payment_intent",
            "last_payment_error",
            "charge",
            "failure_code",
            "outcome",
            "latest_charge",
          ),
          anyValue,
        ),
      }),
    },
    { requiredKeys: ["object"] },
  );
  const stripeError = fc.record({
    error: fc.dictionary(
      fc.constantFrom(
        "type",
        "code",
        "decline_code",
        "advice_code",
        "message",
        "payment_intent",
        "charge",
      ),
      anyValue,
    ),
  });
  const adyenLike = fc.record({
    live: anyValue,
    notificationItems: fc.array(
      fc.record({
        NotificationRequestItem: fc.dictionary(
          fc.constantFrom(
            "eventCode",
            "success",
            "pspReference",
            "originalReference",
            "eventDate",
            "amount",
            "reason",
            "merchantReference",
            "operations",
          ),
          anyValue,
        ),
      }),
      { maxLength: 4 },
    ),
  });
  const adyenResponse = fc.dictionary(
    fc.constantFrom(
      "resultCode",
      "pspReference",
      "merchantReference",
      "refusalReason",
      "refusalReasonCode",
      "amount",
      "status",
      "errorCode",
      "errorType",
      "message",
    ),
    anyValue,
  );

  it("provider-shaped junk never causes an internal error and exports cleanly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(stripeLike, stripeError, adyenLike, adyenResponse), {
          minLength: 1,
          maxLength: 6,
        }),
        (records) => {
          const r = analyzeRecords(records, options);
          expect(r.ok).toBe(true);
          if (r.ok) {
            expect(() => toJsonReport(r.result)).not.toThrow();
            expect(() => toMarkdownReport(r.result)).not.toThrow();
          }
        },
      ),
      { numRuns: 400 },
    );
  });

  it("event sorting is stable for equal timestamps", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 30 }), (times) => {
        const events = times.map((t, i) => ({
          id: `ev-${i}`,
          provider: "x",
          sourceFormat: "x",
          eventType: "x",
          eventTypeKnown: true,
          stage: "payment" as const,
          outcome: "unknown" as const,
          attributes: {},
          sourceIndex: i,
          source: { recordIndex: i, path: "" },
          eventTimestamp: new Date(t * 1000).toISOString(),
        }));
        const sorted = sortEvents(events);
        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1]!;
          const b = sorted[i]!;
          if (a.eventTimestamp === b.eventTimestamp)
            expect(a.sourceIndex).toBeLessThan(b.sourceIndex);
        }
      }),
    );
  });

  it("order-independent findings do not change when records are reordered", () => {
    const records = [
      {
        id: "evt_a",
        object: "event",
        created: 10,
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_1", object: "payment_intent", status: "succeeded" } },
      },
      {
        id: "evt_a",
        object: "event",
        created: 10,
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_1", object: "payment_intent", status: "succeeded" } },
      },
      {
        id: "evt_b",
        object: "event",
        created: 5,
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_2",
            object: "payment_intent",
            status: "requires_payment_method",
            last_payment_error: {
              type: "card_error",
              code: "card_declined",
              decline_code: "generic_decline",
            },
          },
        },
      },
      {
        id: "evt_c",
        object: "event",
        created: 7,
        type: "invoice.paid",
        data: { object: { id: "in_1", object: "invoice" } },
      },
    ];
    // OUT_OF_ORDER_ARRIVAL depends on order by definition.
    const orderIndependent = (rs: unknown[]) =>
      analyze(JSON.stringify(rs))
        .findings.filter((f) => f.ruleId !== "OUT_OF_ORDER_ARRIVAL")
        .map((f) => `${f.ruleId}|${f.title}|${f.severity}`)
        .sort();
    const baseline = orderIndependent(records);
    fc.assert(
      fc.property(
        fc.shuffledSubarray(records, { minLength: records.length, maxLength: records.length }),
        (shuffled) => {
          expect(orderIndependent(shuffled)).toEqual(baseline);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("default exports never contain Luhn-valid card numbers, emails or secrets planted anywhere", () => {
    const secrets = [
      "4242424242424242",
      "5555555555554444",
      "secret.person@example.org",
      "sk_live_51PPLsyntheticKeyValue",
      "whsec_PPLsyntheticWebhook",
    ];
    const keys = [
      "message",
      "description",
      "reason",
      "failure_message",
      "refusalReason",
      "status",
      "id",
      "eventCode",
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...secrets),
        fc.constantFrom(...keys),
        fc.constantFrom("stripe-err", "stripe-evt", "adyen-wh", "adyen-resp"),
        (secret, key, shape) => {
          const records: Record<string, unknown>[] = [
            shape === "stripe-err"
              ? { error: { type: "card_error", code: "card_declined", [key]: secret } }
              : shape === "stripe-evt"
                ? {
                    id: "evt_1",
                    object: "event",
                    created: 1,
                    type: "charge.failed",
                    data: {
                      object: {
                        id: "ch_1",
                        object: "charge",
                        status: "failed",
                        failure_code: "card_declined",
                        [key]: secret,
                      },
                    },
                  }
                : shape === "adyen-wh"
                  ? {
                      notificationItems: [
                        {
                          NotificationRequestItem: {
                            eventCode: "AUTHORISATION",
                            success: "false",
                            pspReference: "P1",
                            [key]: secret,
                          },
                        },
                      ],
                    }
                  : { resultCode: "Refused", pspReference: "P1", [key]: secret },
          ];
          const r = analyzeRecords(records, options);
          if (!r.ok) return;
          const out = toJsonReport(r.result) + toMarkdownReport(r.result);
          expect(out).not.toContain(secret);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("parser limits under load", () => {
  it("handles 5000 records within limits", () => {
    const text = JSON.stringify(
      Array.from({ length: 5000 }, (_, i) => ({
        id: `evt_${i}`,
        object: "event",
        created: i,
        type: "payment_intent.created",
        data: {
          object: {
            id: `pi_${i % 50}`,
            object: "payment_intent",
            status: "requires_payment_method",
          },
        },
      })),
    );
    const started = performance.now();
    const r = analyzeText(text, options);
    const ms = performance.now() - started;
    expect(r.ok).toBe(true);
    // Generous bound for CI machines; the product target is 1000 events < 2s.
    expect(ms).toBeLessThan(10_000);
  });

  it("rejects 5001 records", () => {
    const r = parseInput(JSON.stringify(Array.from({ length: 5001 }, () => 1)));
    expect(!r.ok && r.error.code).toBe("TOO_MANY_RECORDS");
  });
});

describe("prototype-named codes", () => {
  it("are treated as unknown codes, not as catalog entries", () => {
    for (const code of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const r = analyzeRecords(
        [
          { error: { type: "card_error", code, decline_code: code, advice_code: code } },
          { pspReference: "P", resultCode: code, refusalReasonCode: code, refusalReason: code },
          { status: 500, errorCode: code, errorType: code, message: "x" },
          {
            notificationItems: [
              {
                NotificationRequestItem: { eventCode: code, success: "false", pspReference: "P2" },
              },
            ],
          },
        ],
        options,
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        for (const e of r.result.errors) {
          expect(typeof e.explanation).toBe("string");
          expect(typeof e.category).toBe("string");
        }
        expect(() => toJsonReport(r.result)).not.toThrow();
      }
    }
  });
});
