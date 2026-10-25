import { readdirSync, readFileSync } from "node:fs";
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
  DEPOSIT_STATUSES,
  DETAILED_STATUSES,
  ERROR_CODES,
  ERROR_TYPES,
  MIFINITY_ADAPTER_VERSION,
  PAYOUT_PRODUCTS,
  TRANSACTION_STATUSES,
  mifinityAdapter,
  mifinityManifest,
  type ErrorType,
} from "@pandapaylens/mifinity";
import defaultExport from "@pandapaylens/mifinity";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [mifinityAdapter],
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
const http = (status: number, body: unknown) =>
  `HTTP/1.1 ${status} X\nContent-Type: application/json\n\n${json(body)}\n`;

const UUID_REF = "3f57cb79-0707-4249-924a-15780a3f930e";
const MONEY = { amount: 10, currency: "EUR", presentationAmount: "EUR10.00" };

const payout = (fields: Record<string, unknown> = {}) => ({
  postedOn: null,
  money: MONEY,
  transactionStatus: 3,
  transactionStatusDescription: "Submitted",
  traceId: "PPLsynth-trace-t001",
  transactionReference: "PPLsynth-txref-t001",
  eventTypeDescription: "Pay Any Bank",
  createdOn: "2026-10-20T10:00:00.000Z",
  paymentCategoryType: "GAMING_PAYOUT",
  errorMessage: null,
  ...fields,
});
const deposit = (fields: Record<string, unknown> = {}) => ({
  traceId: "PPLsynth-trace-d001",
  validationKey: "PPLsynth~validation~key~0000000000000000000000000000000000001",
  transactionReference: "PPLsynth-txref-d001",
  money: MONEY,
  paymentType: "EWALLET",
  ...fields,
});
const err = (errorCode: string, type = "FATAL", extra: Record<string, unknown> = {}) => ({
  errors: [{ type, errorCode, message: "x", ...extra }],
});
const firstError = (v: unknown) => analyze(json(v)).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;

describe("mifinity detection", () => {
  it.each([
    [payout(), "mifinity.payout_status", 0.98, true],
    [
      { transactionStatus: 3, transactionStatusDescription: "Submitted" },
      "mifinity.payout_status",
      0.65,
      true,
    ],
    [
      { transactionStatusDescription: "Reversed", traceId: "t" },
      "mifinity.payout_status",
      0.6,
      true,
    ],
    [
      { transactionStatus: 3, traceId: "t", transactionReference: UUID_REF },
      "mifinity.payout_status",
      0.65,
      true,
    ],
    [
      { payload: [{ transactionStatus: 5, traceId: "t", transactionReference: "r" }] },
      "mifinity.payout_status",
      0.6,
      true,
    ],
    [deposit(), "mifinity.deposit_callback", 0.8, true],
    [
      { validationKey: "k", detailedStatus: "REFUSED_BY_RISK" },
      "mifinity.deposit_callback",
      0.65,
      true,
    ],
    [
      { status: "FAILED", detailedStatus: "ABANDONED_BY_USER" },
      "mifinity.deposit_status",
      0.8,
      true,
    ],
    [
      { payload: [{ status: "SUCCESSFUL", paymentResponse: { traceId: "t" } }] },
      "mifinity.deposit_status",
      0.85,
      true,
    ],
    [
      { status: "FAILED", errorMessage: "Type: TRANSACTION_FAILED. Args: [null]" },
      "mifinity.deposit_status",
      0.7,
      true,
    ],
    [{ status: "OK", sameOwner: true, traceId: "t" }, "mifinity.payout_response", 0.85, true],
    [
      { quoteReference: "q", statusCode: 7, statusMessage: "PENDING", traceId: "t" },
      "mifinity.payout_response",
      0.8,
      true,
    ],
    [
      {
        traceId: "t",
        sourceMoney: { amount: 1, currency: "EUR", displayable: "EUR1.00" },
        destinationMoney: { amount: 1, currency: "EUR", displayable: "EUR1.00" },
        datePosted: "2026-10-20T10:00:00Z",
      },
      "mifinity.payout_response",
      0.85,
      true,
    ],
    [err("ACCESS_DENIED"), "mifinity.error", 0.95, true],
    [err("SOMETHING_NEW", "VALIDATION_GLOBAL"), "mifinity.error", 0.85, true],
    [{ errors: [{ errorCode: "BLACKLISTED", message: "x" }] }, "mifinity.error", 0.6, true],
    [{ errors: [{ type: "FATAL", message: "x" }] }, "mifinity.error", 0.6, true],
    [
      { iframeEntrypoint: "https://demo.mifinity.com/iframe2#initToken=x" },
      "mifinity.iframe_init",
      0.85,
      false,
    ],
    [{ initializationToken: "x", traceId: "t" }, "mifinity.iframe_init", 0.7, false],
  ])("detects %j", (input, format, confidence, supported) => {
    expect(mifinityAdapter.detect(input)).toMatchObject({ format, confidence, supported });
  });

  it("raises an error envelope slightly when it arrived as an HTTP error", () => {
    const meta = {
      format: "http" as const,
      http: { kind: "response" as const, status: 503, headers: {} },
    };
    expect(mifinityAdapter.detect(err("X1"), meta).confidence).toBe(0.88);
  });

  it("does not match on the provider name or on generic shapes", () => {
    for (const input of [
      { provider: "MiFinity", message: "MiFinity error" },
      "mifinity",
      null,
      [],
      { error: { code: "ACCESS_DENIED" } },
      { status: "FAILED" },
      { status: "SUCCESSFUL", errorMessage: "failed" },
      { status: "OK" },
      { transactionStatus: 3 },
      { transactionStatus: 3, traceId: "t" },
      { traceId: "t", transactionReference: "r" },
      { errors: [{ errorCode: "X", message: "y" }] },
      { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED", detail: "x" }] },
      { errors: [] },
      { payload: [] },
      { payload: [{}] },
      { payload: ["x"] },
      { validationKey: "k" },
      { quoteReference: "q" },
      { object: "event", errors: [{ type: "FATAL", errorCode: "OTHER" }] },
    ]) {
      expect(mifinityAdapter.detect(input).confidence, json(input)).toBe(0);
    }
  });

  it("keeps a weak status shape at or below 0.5", () => {
    expect(
      mifinityAdapter.detect({ transactionStatus: 3, transactionStatusDescription: "foo" })
        .confidence,
    ).toBe(0.5);
  });

  it.each([
    "stripe",
    "adyen",
    "checkout",
    "paypal",
    "braintree",
    "mollie",
    "square",
    "payabl",
    "pxp",
    "ccbill",
    "segpay",
    "netbilling",
    "verotel",
    "trust_payments",
    "malformed",
    "mixed",
  ])("returns confidence 0 for every record in fixtures/%s", (dir) => {
    const root = fileURLToPath(new URL(`../../../../fixtures/${dir}/`, import.meta.url));
    let checked = 0;
    for (const file of readdirSync(root)) {
      const parsed = parseInput(readFileSync(`${root}${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          mifinityAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("mifinity parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const noCode = analyze(json({ errors: [{ type: "FATAL", message: "x" }] }));
    expect(noCode.records[0]).toMatchObject({ status: "invalid", format: "mifinity.error" });
    expect(noCode.records[0]!.reasons.join(" ")).toMatch(/errors\.0\.errorCode/);
    expect(noCode.events).toEqual([]);

    const noTrace = analyze(json({ validationKey: "k", detailedStatus: "REFUSED_BY_RISK" }));
    expect(noTrace.records[0]).toMatchObject({
      status: "invalid",
      format: "mifinity.deposit_callback",
    });
    expect(noTrace.records[0]!.reasons.join(" ")).toMatch(/^traceId:/);

    const p = mifinityAdapter.parse({ traceId: "t", money: MONEY }, "mifinity.payout_status");
    expect(p.ok).toBe(false);
    expect(!p.ok && p.issues.join(" ")).toMatch(
      /transactionStatus or transactionStatusDescription/,
    );

    const r = mifinityAdapter.parse({ status: "OK" }, "mifinity.payout_response");
    expect(!r.ok && r.issues.join(" ")).toMatch(/transactionReference, traceId or quoteReference/);
  });

  it("rejects wrongly typed fields, empty envelopes and unknown formats", () => {
    expect(mifinityAdapter.parse(err("OTHER", 7 as unknown as string), "mifinity.error").ok).toBe(
      false,
    );
    expect(mifinityAdapter.parse({ payload: [] }, "mifinity.payout_status").ok).toBe(false);
    expect(mifinityAdapter.parse({}, "mifinity.unknown").ok).toBe(false);
    expect(mifinityAdapter.parse({}, "toString").ok).toBe(false);
    expect(mifinityAdapter.parse({}, "mifinity.iframe_init").ok).toBe(false);
  });

  it("tolerates unknown fields, null values, digit-string statuses and money drift", () => {
    const e = firstEvent(
      payout({
        transactionStatus: "5",
        brandNew: [1],
        arn: null,
        money: { amount: "10.5", currency: "eur", presentationAmount: "EUR10.50", actual: 1 },
      }),
    );
    expect(e).toMatchObject({ providerStatus: "5", amountMinor: "1050", currency: "EUR" });
    const odd = firstEvent(payout({ money: "EUR10.00" }));
    expect(odd.amountMinor).toBeUndefined();
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"errors": [{"type": "FATAL", "errorCode": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });

  it("recognizes the init-iframe response but does not analyze it", () => {
    const r = analyzeFixture("mifinity/iframe-init.json");
    expect(r.records[0]).toMatchObject({ status: "unsupported", format: "mifinity.iframe_init" });
    expect(r.warnings[0]!.message).toMatch(/session token/);
    expect(r.events).toEqual([]);
    expect(toJsonReport(r)).not.toContain("PLANTEDINITTOKEN0001");
  });
});

describe("mifinity payouts", () => {
  it("shows Submitted as a pending payout that MiFinity treats as success-equivalent", () => {
    const r = analyzeFixture("mifinity/payout-callback-submitted.json");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "mifinity.payout_status" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "payout.Submitted",
      eventTypeKnown: true,
      stage: "payout",
      providerStatus: "3",
      outcome: "pending",
      paymentReference: "PPLsynth-txref-pab-0001",
      merchantReference: "PPLsynth-trace-pab-0001",
      amountMinor: "1000",
      currency: "EUR",
      eventTimestamp: "2026-10-20T10:00:00.000Z",
    });
    expect(e.deliveryKey).toBeUndefined();
    expect(e.attributes).toMatchObject({
      successEquivalent: true,
      statusFinal: false,
      payoutProduct: "PayAnyBank (PAB)",
      payoutRail: "bank",
      paymentCategoryType: "GAMING_PAYOUT",
      signatureVerified: false,
      timestampSource: "createdOn (creation time of the payout, not of this status)",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("groups a payout response, two callbacks and a status lookup into one payout", () => {
    const r = analyzeFixture("mifinity/payout-flow.json");
    expect(r.records.map((x) => x.format)).toEqual([
      "mifinity.payout_response",
      "mifinity.payout_status",
      "mifinity.payout_status",
      "mifinity.payout_status",
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.references).toEqual(
      expect.arrayContaining(["PPLsynth-txref-pab-0002", "traceId:PPLsynth-trace-pab-0002"]),
    );
    expect(r.groups[0]!.latestOutcome).toBe("success");
    const response = r.events.find((e) => e.sourceFormat === "mifinity.payout_response")!;
    expect(response).toMatchObject({
      eventType: "payout_response.accepted",
      stage: "payout",
      outcome: "pending",
      amountMinor: "2550",
      eventTimestamp: "2026-10-20T11:00:00.000Z",
    });
    expect(response.attributes).toMatchObject({
      requestAccepted: true,
      destinationAmountMinor: "2550",
    });
    const lookup = r.events.find((e) => e.attributes.timestampSource === "transactionLastUpdated")!;
    expect(lookup).toMatchObject({ outcome: "success", eventType: "payout.Processed by acquirer" });
    expect(lookup.attributes).toMatchObject({
      statusConflict: true,
      statusResolvedBy: "transactionStatusDescription",
    });
    expect(lookup.attributes.signatureVerified).toBeUndefined();
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
    expect(ruleIds(r)).not.toContain("DUPLICATE_DELIVERY");
    expect(json(r.events)).not.toContain("PLANTEDENCRYPTEDTXID0001");
  });

  it("shows both meanings of status 5 and keeps the outcome unknown without a description", () => {
    const r = analyzeFixture("mifinity/payout-status-5-ambiguous.json");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "payout.transactionStatus 5",
      eventTypeKnown: true,
      stage: "payout",
      outcome: "unknown",
      source: { path: "payload[0]" },
    });
    expect(e.attributes.statusMeanings).toEqual([
      "Processed by acquirer: The acquirer confirmed the payout; final success",
      "Failed: The withdrawal callbacks page documents status 5 as Failed",
    ]);
    expect(e.attributes.statusResolvedBy).toBe("not resolved: no description");
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("decodes status 5 described as Failed with the conflict noted", () => {
    const r = analyze(
      json(payout({ transactionStatus: 5, transactionStatusDescription: "Failed" })),
    );
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.errors[0]).toMatchObject({
      code: "transactionStatus 5",
      category: "unknown",
      confidence: "possible",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/two documented meanings/);
    expect(r.errors[0]!.documentation.map((d) => d.url)).toContain(
      "https://mifinity.readme.io/docs/notification-callbacks-for-withdrawals",
    );
  });

  it("decodes a rejected card payout without inventing a reason", () => {
    const r = analyzeFixture("mifinity/payout-rejected.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payout.Rejected",
      stage: "payout",
      outcome: "failure",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      payoutRail: "card",
      errorMessage: "No account found",
    });
    expect(r.errors[0]).toMatchObject({
      code: "transactionStatus 6",
      category: "unknown",
      retry: "manual_review",
      providerMessage: "No account found",
      confidence: "possible",
      outcomeKnown: true,
      paymentReference: "PPLsynth-txref-pac-0003",
    });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
    expect(json(r.events)).not.toMatch(/492982XXXXXX8286|5001000000000303/);
  });

  it("decodes an error code embedded in a payout errorMessage and keeps unrelated payouts apart", () => {
    const r = analyzeFixture("mifinity/unrelated-payouts.json");
    expect(r.groups).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "BAD_ACCOUNT_NUMBER",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { transaction_status: "6", transaction_status_description: "Rejected" },
      outcomeKnown: true,
    });
  });

  it("decodes Internal Error as final without a blind retry", () => {
    const e = firstError(
      payout({ transactionStatus: 2, transactionStatusDescription: "Internal Error" }),
    );
    expect(e).toMatchObject({
      code: "transactionStatus 2",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      outcomeKnown: true,
    });
    expect(e.retryExplanation).toMatch(/same traceId/);
  });

  it("maps every numeric payout status and keeps undocumented ones unknown", () => {
    const outcomes = ["1", "2", "3", "4", "6", "7", "8", "9"].map((s) => {
      const e = firstEvent(
        payout({ transactionStatus: Number(s), transactionStatusDescription: undefined }),
      );
      return [s, e.outcome, e.eventTypeKnown];
    });
    expect(outcomes).toEqual([
      ["1", "pending", true],
      ["2", "failure", true],
      ["3", "pending", true],
      ["4", "success", true],
      ["6", "failure", true],
      ["7", "pending", true],
      ["8", "pending", true],
      ["9", "unknown", false],
    ]);
    const four = firstEvent(
      payout({ transactionStatus: 4, transactionStatusDescription: undefined }),
    );
    expect(four.attributes).toMatchObject({
      documentedOnOlderPageOnly: true,
      statusFinal: "unclear",
    });
    const mismatch = firstEvent(
      payout({ transactionStatus: 3, transactionStatusDescription: "Rejected" }),
    );
    expect(mismatch).toMatchObject({ outcome: "pending" });
    expect(mismatch.attributes.descriptionMismatch).toBe(true);
  });

  it("shows Reversed as a reversal linked by traceId", () => {
    const r = analyze(
      json([
        payout({ transactionStatus: 5, transactionStatusDescription: "Processed by acquirer" }),
        payout({
          transactionStatus: null,
          transactionStatusDescription: "Reversed",
          transactionReference: null,
          createdOn: "2026-10-22T10:00:00.000Z",
        }),
      ]),
    );
    const reversal = r.events.find((e) => e.stage === "reversal")!;
    expect(reversal).toMatchObject({
      eventType: "payout.Reversed",
      outcome: "success",
      eventTypeKnown: true,
    });
    expect(reversal.attributes.reversedHasNoDocumentedId).toBe(true);
    expect(r.groups).toHaveLength(1);
  });

  it("keeps an Account to Account transfer as a wallet payout, never an authorization", () => {
    const r = analyzeFixture("mifinity/a2a-response.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payout_response.OK",
      stage: "payout",
      outcome: "success",
      amountMinor: "1500",
      paymentReference: "PPLsynth-txref-a2a-0001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      payoutProduct: "Account to Account (A2A)",
      sameOwner: false,
      walletTransfer: "wallet-to-wallet transfer, not a card operation",
    });
    expect(json(r.events)).not.toMatch(
      /PLANTEDENCRYPTEDTXID0003|5001000000000404|5001000000000505/,
    );
  });

  it("keeps a PayAnyCoin response pending and never reads statusCode 7 as In Progress", () => {
    const r = analyzeFixture("mifinity/payc-response.json");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "payc_response.PENDING",
      stage: "payout",
      outcome: "pending",
      relatedReference: "PPLsynth-quote-0001",
      amountMinor: "10000",
    });
    expect(e.attributes).toMatchObject({ statusCode: "7", statusListDocumented: false });
    expect(e.attributes.statusMeaning).toMatch(/pending/);
    expect(json(r.events)).not.toContain("PLANTEDCRYPTOADDRESS0001");
    const other = firstEvent({
      quoteReference: "PPLsynth-q2",
      statusCode: 3,
      statusMessage: "SETTLED",
    });
    expect(other).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
  });

  it("does not recognize repeated callbacks as duplicates because no event id is documented", () => {
    const r = analyze(json([payout(), payout()]));
    expect(r.events.every((e) => e.deliveryKey === undefined)).toBe(true);
    expect(r.groups).toHaveLength(1);
    // No delivery id: identical copies are reported only as a possible repeat.
    expect(r.findings.find((f) => f.ruleId === "DUPLICATE_DELIVERY")).toMatchObject({
      confidence: "possible",
    });
  });
});

describe("mifinity deposits", () => {
  it("shows a successful deposit callback as a wallet payment, not an authorization", () => {
    const r = analyzeFixture("mifinity/deposit-callback-success.json");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "mifinity.deposit_callback" });
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "deposit_callback.success",
      stage: "payment",
      outcome: "success",
      amountMinor: "5000",
      currency: "EUR",
      paymentReference: "PPLsynth-txref-dep-0001",
    });
    expect(e.eventTimestamp).toBeUndefined();
    expect(e.attributes).toMatchObject({
      signatureVerified: false,
      paymentType: "EWALLET",
      confirmWith: "Payment Status API",
    });
    expect(String(e.attributes.operation)).toMatch(/not a card authorization/);
    expect(String(e.attributes.outcomeInferredFrom)).toMatch(/success body/);
    expect(r.errors).toEqual([]);
  });

  it("decodes a risk refusal from detailedStatus and notes the misleading message", () => {
    const r = analyzeFixture("mifinity/deposit-callback-refused-by-risk.json");
    expect(r.events[0]).toMatchObject({
      eventType: "deposit_callback.REFUSED_BY_RISK",
      stage: "payment",
      outcome: "failure",
      providerStatus: "REFUSED_BY_RISK",
    });
    expect(r.errors[0]).toMatchObject({
      code: "REFUSED_BY_RISK",
      category: "fraud_or_risk",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/same text/);
  });

  it("decodes an abandoned deposit as customer action with possible confidence", () => {
    const e = firstError(
      deposit({ detailedStatus: "ABANDONED_BY_USER", errorMessage: "Deposit attempt abandoned" }),
    );
    expect(e).toMatchObject({
      code: "ABANDONED_BY_USER",
      category: "unknown",
      retry: "customer_action_required",
      confidence: "possible",
    });
  });

  it("decodes TRANSACTION_FAILED embedded in a failed Payment Status honestly", () => {
    const r = analyzeFixture("mifinity/deposit-status-failed.json");
    expect(r.events[0]).toMatchObject({
      eventType: "payment_status.FAILED",
      stage: "payment",
      outcome: "failure",
    });
    expect(r.events[0]!.attributes.embeddedErrorCode).toBe("TRANSACTION_FAILED");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "TRANSACTION_FAILED",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      subCodes: { detailed_status: "FAILED" },
      outcomeKnown: true,
    });
    expect(e.explanation).toMatch(/Catch-all/);
    expect(e.missingInformation.join(" ")).toMatch(/does not show which/);
  });

  it("links a Payment Status result to its deposit callback by transactionReference only", () => {
    const r = analyze(
      json([
        deposit(),
        {
          payload: [
            {
              status: "SUCCESSFUL",
              paymentResponse: {
                traceId: "PPLsynth-trace-d001",
                transactionReference: "PPLsynth-txref-d001",
                money: MONEY,
              },
            },
          ],
        },
      ]),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]).toMatchObject({
      eventType: "payment_status.SUCCESSFUL",
      outcome: "success",
      amountMinor: "1000",
    });
    expect(r.events[1]!.attributes.referencesFrom).toBe("paymentResponse");
  });

  it("does not link deposits that only share a merchant traceId", () => {
    const r = analyze(
      json([
        deposit(),
        deposit({ transactionReference: "PPLsynth-txref-d002" }),
        deposit({ transactionReference: null }),
      ]),
    );
    expect(r.groups).toHaveLength(3);
    expect(ruleIds(r)).toContain("MISSING_REFERENCE");
  });

  it("keeps PENDING and NOT_COMPLETED unresolved and unknown statuses unknown", () => {
    const pending = analyze(
      json({ status: "PENDING", paymentResponse: { traceId: "PPLsynth-t" } }),
    );
    expect(pending.events[0]!.outcome).toBe("pending");
    expect(ruleIds(pending)).toContain("UNRESOLVED_OUTCOME");
    const nc = firstEvent({ status: "NOT_COMPLETED", detailedStatus: "ABANDONED_BY_USER" });
    expect(nc.outcome).toBe("pending");
    const odd = firstEvent(deposit({ detailedStatus: "SOMETHING_NEW" }));
    expect(odd).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    const e = firstError(deposit({ detailedStatus: "SOMETHING_NEW" }));
    expect(e).toMatchObject({ category: "unknown", retry: "unknown", confidence: "insufficient" });
    const bare = firstError({ status: "FAILED", paymentResponse: {} });
    expect(bare).toMatchObject({ code: "FAILED", confidence: "insufficient" });
  });
});

describe("mifinity errors", () => {
  it("decodes the invalid validation key example as a catch-all with a hint", () => {
    const r = analyzeFixture("mifinity/error-invalid-key.json");
    expect(r.events[0]).toMatchObject({ eventType: "error.TRANSACTION_FAILED", stage: "error" });
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "TRANSACTION_FAILED",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      subCodes: { type: "FATAL" },
    });
    expect(e.explanation).toMatch(/an invalid validationKey, one of the documented causes/);
    // The field entry holds message text here, not a field name.
    expect(e.subCodes.field).toBeUndefined();
  });

  it("decodes a validation error with its HTTP status and field name", () => {
    const r = analyzeFixture("mifinity/error-validation.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "mifinity.error" });
    expect(r.errors[0]).toMatchObject({
      code: "00001",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "possible",
      subCodes: {
        type: "VALIDATION_FIELD",
        http_status: "400",
        field: "traceId",
        form_object: "initIframeRequest",
      },
    });
    expect(r.events[0]!.providerStatus).toBe("HTTP 400");
  });

  it("decodes an authentication failure", () => {
    const r = analyzeFixture("mifinity/error-access-denied.txt");
    expect(r.errors[0]).toMatchObject({
      code: "ACCESS_DENIED",
      category: "authentication_failed",
      retry: "do_not_retry",
      confidence: "strong",
    });
  });

  it("never presents a server error as safe to retry", () => {
    const r = analyzeFixture("mifinity/error-server.txt");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "OTHER",
      category: "provider_unavailable",
      retry: "retry_conditionally",
      subCodes: { http_status: "503" },
    });
    expect(e.retryExplanation).toMatch(/same traceId/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    const unknown = analyze(http(502, err("NEW_CODE"))).errors[0]!;
    expect(unknown).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
    });
  });

  it("treats a not-found status lookup as a reference that may not exist yet", () => {
    const e = analyzeFixture("mifinity/status-lookup-not-found.txt").errors[0]!;
    expect(e).toMatchObject({ code: "ELEMENT_NOT_FOUND", retry: "retry_conditionally" });
    expect(e.retryExplanation).toMatch(/may not exist yet|does not exist yet/);
    expect(firstError(err("ELEMENT_NOT_FOUND")).retry).toBe("do_not_retry");
  });

  it("decodes OPERATION_NOT_POSSIBLE by type", () => {
    expect(firstError(err("OPERATION_NOT_POSSIBLE", "FATAL")).category).toBe("invalid_request");
    expect(firstError(err("OPERATION_NOT_POSSIBLE", "VALIDATION_GLOBAL")).category).toBe(
      "invalid_amount",
    );
  });

  it("follows MiFinity's duplicate traceId rule", () => {
    const e = firstError(err("DUPLICATED_TRANSACTION_ID"));
    expect(e).toMatchObject({ category: "duplicate_request", retry: "do_not_retry" });
    expect(e.retryExplanation).toMatch(/first request with this traceId was received/);
  });

  it("decodes every documented code with its documented type", () => {
    for (const [code, entry] of Object.entries(ERROR_CODES)) {
      for (const type of entry.types) {
        const e = firstError(err(code, type));
        expect(e.code, code).toBe(code);
        expect(["strong", "possible"]).toContain(e.confidence);
        expect(e.missingInformation.join(" "), code).not.toMatch(/not in the PandaPayLens catalog/);
      }
    }
  });

  it("reports unrecognized codes, unexpected types and placeholders honestly", () => {
    const unknown = firstError(err("BRAND_NEW_CODE"));
    expect(unknown).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });
    expect(unknown.missingInformation.join(" ")).toMatch(/not in the PandaPayLens catalog/);
    const wrongType = firstError(err("BLACKLISTED", "VALIDATION_FIELD"));
    expect(wrongType.missingInformation.join(" ")).toMatch(/documented with type FATAL/);
    const placeholder = firstError(
      err("OPERATION_NOT_POSSIBLE", "FATAL", { message: "Operation not possible due to {0}" }),
    );
    expect(placeholder.missingInformation.join(" ")).toMatch(/placeholder/);
    const tfa = analyze(http(401, err("NEW_CODE"))).errors[0]!;
    expect(tfa).toMatchObject({ category: "authentication_required", confidence: "possible" });
    expect(tfa.explanation).toMatch(/TOTP/);
  });

  it("decodes every error in one envelope", () => {
    const r = analyze(
      json({
        errors: [
          { type: "VALIDATION_FIELD", errorCode: "01001", message: "Invalid card number" },
          { type: "VALIDATION_GLOBAL", errorCode: "DAILY_VELOCITY_EXCEEDED", message: "x" },
        ],
      }),
    );
    expect(r.errors.map((e) => [e.code, e.category, e.retry])).toEqual([
      ["01001", "invalid_request", "customer_action_required"],
      ["DAILY_VELOCITY_EXCEEDED", "fraud_or_risk", "retry_conditionally"],
    ]);
    expect(r.errors[1]!.retryExplanation).toMatch(/daily velocity period/);
    expect(r.events[0]!.attributes.errorCodes).toEqual(["01001", "DAILY_VELOCITY_EXCEEDED"]);
  });
});

describe("mifinity sensitive data", () => {
  const PLANTED = [
    "PLANTEDSIGNATUREVALUE0001",
    "1792500000PLANTED",
    "PLANTEDAPIKEY0001",
    "PLANTEDVALIDATIONKEY",
    "PLANTEDRESPONSECODE0001",
    "Plantedfirst",
    "Plantedlast",
    "1990-01-01",
    "planted.sender@example.com",
    "5001000000007777",
    "Plantedclientfirst",
    "Plantedclientlast",
    "+44 7700 900123",
    "planted.client@example.com",
    "1991-02-03",
    "77 Planted Synthetic Road",
    "PL4NT",
    "4111111111111111",
    "12/31",
    "Planted Card Holder",
    "PLANTEDFREETEXT",
  ];

  it("keeps planted sensitive values out of events and the JSON report", () => {
    const r = analyzeFixture("mifinity/callback-request.txt");
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: "mifinity.deposit_callback" });
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
    expect(r.sensitiveData.detected).toBe(true);
    expect(r.events[0]).toMatchObject({ amountMinor: "1234", outcome: "success" });
    expect(r.events[0]!.attributes.signatureVerified).toBe(false);
  });

  it("keeps account numbers, descriptions and undocumented fields out of payout events", () => {
    const dump = JSON.stringify([
      analyzeFixture("mifinity/payout-callback-submitted.json").events,
      analyzeFixture("mifinity/deposit-callback-success.json").events,
    ]);
    expect(dump).not.toMatch(
      /5001000000000101|PPLsynth payout|PPLSYNTHEXT01|PPLsynth Merchant|UExBTlRFRFJFU1BPTlNFQ09ERQ|5001000000009999|PLANTEDVALIDATIONKEY|"Planted"|"Synthetic"/,
    );
    const withArn = firstEvent(payout({ arn: "PLANTEDARN0000000000001" }));
    expect(json(withArn)).not.toContain("PLANTEDARN0000000000001");
    expect(withArn.attributes.arnPresent).toBe(true);
  });
});

describe("mifinity manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(mifinityAdapter);
    expect(mifinityAdapter.manifest).toBe(mifinityManifest);
    expect(mifinityAdapter.id).toBe("mifinity");
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(mifinityManifest).toMatchObject({
      id: "mifinity",
      version: MIFINITY_ADAPTER_VERSION,
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "public",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "limited",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: false, ordering: "not_documented" },
    });
    expect([...mifinityManifest.categories].sort()).toEqual([
      "alternative_payment_method",
      "wallet",
    ]);
    expect(mifinityManifest.sectors).toEqual([]);
    const limits = mifinityManifest.limitations.join(" ");
    expect(limits).toMatch(/no sector is documented/);
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/No deliveryKey is set/);
    expect(limits).toMatch(/Both meanings are shown/);
    expect(limits).toMatch(/PayAnyCoin \(crypto payout\) error reference is not published/);
    expect(limits).toMatch(/TRANSACTION_FAILED is a catch-all/);
  });

  it("contains every documented code and status", () => {
    expect(Object.keys(ERROR_CODES)).toHaveLength(25);
    expect(Object.keys(TRANSACTION_STATUSES)).toHaveLength(8);
    expect(Object.keys(DEPOSIT_STATUSES)).toHaveLength(4);
    expect(Object.keys(DETAILED_STATUSES)).toHaveLength(3);
    expect(Object.keys(ERROR_TYPES)).toHaveLength(3);
    expect(Object.keys(PAYOUT_PRODUCTS)).toHaveLength(4);
    const byType = (t: ErrorType) =>
      Object.values(ERROR_CODES).filter((e) => e.types.includes(t)).length;
    expect(byType("VALIDATION_FIELD")).toBe(7);
    expect(byType("VALIDATION_GLOBAL")).toBe(4);
    expect(TRANSACTION_STATUSES["5"]!.conflict?.label).toBe("Failed");
    for (const entry of Object.values(ERROR_CODES))
      for (const url of entry.docs) expect(url).toMatch(/^https:\/\/mifinity\.readme\.io\//);
  });

  it("uses no en or em dashes in published text or source", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(
      JSON.stringify([mifinityManifest, ERROR_CODES, TRANSACTION_STATUSES, DETAILED_STATUSES]),
    ).not.toMatch(dashes);
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    for (const file of readdirSync(src))
      expect(readFileSync(`${src}${file}`, "utf8"), file).not.toMatch(dashes);
  });
});
