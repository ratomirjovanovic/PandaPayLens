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
  ASTROPAY_ADAPTER_VERSION,
  CASHOUT_V1_ERRORS,
  CASHOUT_V1_STATUSES,
  CHECKOUT_STATUSES,
  CPF_DOCUMENT_STATUSES,
  DIRECT_PAYMENT_STATUSES,
  DIRECT_WITHDRAWAL_STATUSES,
  GATEWAY_ERRORS,
  GATEWAY_INTERNAL_TERMS,
  GATEWAY_REASON_CODES,
  HTTP_STATUSES,
  PLATFORM_ERROR_CODES,
  PLATFORM_EVENTS,
  QR_STATUSES,
  REFUND_ERRORS,
  SHARED_PAYMENT_STATUSES,
  WITHDRAWAL_CANCEL_REASONS,
  WOF_ACCOUNT_LINKING_ERRORS,
  WOF_AUTH_CAPTURE_ERRORS,
  WOF_EXAMPLE_ERRORS,
  WOF_STATUSES,
  astropayAdapter,
  astropayManifest,
  decodeCashoutV1Error,
  matchCashoutError,
} from "@pandapaylens/astropay";
import defaultExport from "@pandapaylens/astropay";
import { FIXED_NOW, fixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [astropayAdapter],
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
const http = (status: string, body: unknown, headers: string[] = []) =>
  [`HTTP/1.1 ${status}`, "Content-Type: application/json", ...headers, "", json(body)].join("\n");
const request = (path: string, body: unknown, headers: string[] = []) =>
  [`POST ${path} HTTP/1.1`, "Content-Type: application/json", ...headers, "", json(body)].join(
    "\n",
  );
const firstError = (text: string) => analyze(text).errors[0]!;
const firstEvent = (v: unknown) => analyze(json(v)).events[0]!;

const payment = (fields: Record<string, unknown> = {}) => ({
  payment_id: "PPLsynthPay0900",
  merchant_payment_id: "PPLSYNTH-ORDER-0900",
  status: "COMPLETED",
  is_refundable: true,
  payment_transactions: [],
  ...fields,
});
const deposit = (fields: Record<string, unknown> = {}) => ({
  deposit_external_id: "PPLsynthDepExt0900",
  merchant_deposit_id: "PPLSYNTH-DEP-0900",
  status: "APPROVED",
  end_status_date: "2026-10-20T01:57:39",
  ...fields,
});
const withdrawal = (fields: Record<string, unknown> = {}) => ({
  merchant_cashout_id: "PPLSYNTH-WD-0900",
  cashout_external_id: "PPLsynthWdExt0900",
  status: "APPROVED",
  end_status_date: "2026-10-20 10:05:00",
  ...fields,
});

describe("astropay detection", () => {
  it.each([
    [deposit(), "astropay.direct_payment", true],
    [
      { merchant_deposit_id: "x", status: "PENDING", payment_detail: {} },
      "astropay.direct_payment",
      true,
    ],
    [withdrawal(), "astropay.direct_withdrawal", true],
    [
      { cashout_id: 1, merchant_cashout_id: "PPLSYNTH-CO", status: "APPROVED" },
      "astropay.cashout_v1",
      true,
    ],
    [{ cashout_user_id: "u", status: "CANCELLED" }, "astropay.cashout_v1", true],
    [
      { deposit_external_id: "d", payment_code_external_id: "c", status: "APPROVED" },
      "astropay.qr.callback",
      true,
    ],
    [
      {
        payment_external_id: "p",
        payment_status: "COMPLETED",
        payment_info: { payment_amount: {} },
      },
      "astropay.checkout.callback",
      true,
    ],
    [
      { payment_external_id: "p", status: "PENDING", redirect_url: "x" },
      "astropay.checkout.create_response",
      true,
    ],
    [payment({ status: "EXPIRED" }), "astropay.checkout.payment", true],
    [payment({ status: "CAPTURED" }), "astropay.wof.payment", true],
    [payment(), "astropay.payment_object", true],
    [
      { error: "commons_invalid_request", description: "x", internal_term: "invalid_request" },
      "astropay.merchant_gateway.error",
      true,
    ],
    [{ error: "TRUSTED_DEVICE_CHALLENGE_ERROR", message: "x" }, "astropay.partner.error", true],
    [{ ...deposit(), deposit_user_id: "u" }, "astropay.wallet_deposit", false],
    [{ error: "cci_hold_timeout", description: "x" }, "astropay.platform.error", false],
  ])("detects %j", (input, format, supported) => {
    const d = astropayAdapter.detect(input);
    expect(d).toMatchObject({ format, supported });
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("scores strong structural matches higher than bare ones", () => {
    expect(astropayAdapter.detect(deposit()).confidence).toBe(0.98);
    expect(astropayAdapter.detect(withdrawal()).confidence).toBe(0.9);
    expect(astropayAdapter.detect({ payment_external_id: "p", status: "PENDING" }).confidence).toBe(
      0.6,
    );
    expect(astropayAdapter.detect({ payment_external_id: "p" }).confidence).toBe(0.45);
  });

  it("keeps generic shapes and the provider name below the analysis threshold", () => {
    for (const input of [
      { provider: "AstroPay", message: "AstroPay error" },
      "astropay",
      null,
      [],
      { status: "APPROVED" },
      { status: "APPROVED", merchant_user_id: "u" },
      { error: { code: "PAYMENT_NOT_FOUND" } },
      { error: "something_else", description: "x" },
      { payment_id: "x", status: "COMPLETED" },
      { cashout_id: 1, status: "APPROVED" },
      { merchant_deposit_id: "x", status: "APPROVED" },
      { description: "Something went wrong" },
      { error: "INVALID_REQUEST", description: "x" },
      { object: "event", deposit_external_id: "x", status: "APPROVED" },
    ]) {
      expect(astropayAdapter.detect(input).confidence).toBe(0);
    }
    for (const input of [
      { error: "bad_request", message: "x" },
      { error: "not_found", message: "x" },
      { error: "USER_NOT_FOUND", description: "x" },
      { error: "internal_error", description: "x" },
      { description: "Invalid signature" },
    ]) {
      expect(astropayAdapter.detect(input).confidence).toBeLessThan(0.5);
    }
  });

  it("raises a Cashouts V1 description only with the documented HTTP status", () => {
    const meta = (status: number) => ({
      format: "http" as const,
      http: { kind: "response" as const, status, headers: {} },
    });
    const body = { description: "Invalid signature" };
    expect(astropayAdapter.detect(body, meta(412))).toMatchObject({
      format: "astropay.cashout_v1.error",
      confidence: 0.55,
    });
    expect(astropayAdapter.detect(body, meta(400)).confidence).toBe(0);
    expect(astropayAdapter.detect({ ...body, extra: 1 }, meta(412)).confidence).toBe(0);
  });

  it("recognizes Platform webhooks by event path and Partner headers only", () => {
    const meta = (path: string, headers: Record<string, string>) => ({
      format: "http" as const,
      http: { kind: "request" as const, path, headers },
    });
    expect(
      astropayAdapter.detect(
        { any: 1 },
        meta("/hooks/TOP_UP", { "partner-signature": "[redacted]" }),
      ),
    ).toMatchObject({ format: "astropay.platform.webhook", supported: false });
    expect(astropayAdapter.detect({ any: 1 }, meta("/hooks/TOP_UP", {})).confidence).toBe(0);
    expect(
      astropayAdapter.detect({ any: 1 }, meta("/hooks/other", { "partner-signature": "x" }))
        .confidence,
    ).toBe(0);
  });

  it("returns confidence 0 for every record of the other providers' fixtures", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "astropay")
      .map((d) => d.name);
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen"]));
    let checked = 0;
    for (const dir of dirs) {
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
            astropayAdapter.detect(payload, parsed.value.meta[i]).confidence,
            `${dir}/${file} record ${i}`,
          ).toBe(0);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe("astropay parsing", () => {
  it("reports missing required fields as parse issues without throwing", () => {
    const r = analyze(
      json({ payment_external_id: "PPLsynthPay0901", payment_info: { payment_amount: {} } }),
    );
    expect(r.records[0]).toMatchObject({ status: "invalid", format: "astropay.checkout.callback" });
    expect(r.records[0]!.reasons.join(" ")).toMatch(/^payment_status:/);
    expect(r.events).toEqual([]);
    const w = analyze(json({ cashout_external_id: "PPLsynthWdExt0901" }));
    expect(w.records[0]).toMatchObject({ status: "invalid", format: "astropay.direct_withdrawal" });
    expect(w.records[0]!.reasons.join(" ")).toMatch(/status:/);
  });

  it("rejects wrongly typed fields and unknown formats", () => {
    expect(astropayAdapter.parse(deposit({ status: 42 }), "astropay.direct_payment").ok).toBe(
      false,
    );
    expect(astropayAdapter.parse({}, "astropay.unknown").ok).toBe(false);
    expect(astropayAdapter.parse({}, "toString").ok).toBe(false);
    expect(astropayAdapter.parse({ status: "APPROVED" }, "astropay.cashout_v1").ok).toBe(false);
    expect(astropayAdapter.parse({ error: "x" }, "astropay.cashout_v1.error").ok).toBe(false);
    expect(
      analyze(json({ error: "commons_invalid_request", internal_term: 7 })).records[0]!.status,
    ).toBe("invalid");
  });

  it("tolerates unknown fields and null values", () => {
    const p = astropayAdapter.parse(
      deposit({ brandNew: [1], merchant_deposit_id: null }),
      "astropay.direct_payment",
    );
    expect(p.ok).toBe(true);
  });

  it("fails cleanly on malformed input", () => {
    const r = analyzeText('{"deposit_external_id": "x", "status": ', options);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(analyzeText(fixture("malformed/invalid-json.txt"), options).ok).toBe(false);
  });

  it("recognizes but does not analyze the classic wallet deposit (private docs)", () => {
    const r = analyzeFixture("astropay/classic-wallet-deposit.json");
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      format: "astropay.wallet_deposit",
    });
    expect(r.warnings[0]!.message).toMatch(/private sections that were not reviewed/);
    expect(r.events).toEqual([]);
    expect(toJsonReport(r)).not.toContain("PPLSYNTH-DUSER-PLANTED");
  });

  it("recognizes but does not analyze Platform API errors and webhooks", () => {
    const e = analyzeFixture("astropay/platform-error.json");
    expect(e.records[0]).toMatchObject({
      status: "unsupported",
      format: "astropay.platform.error",
    });
    expect(e.warnings[0]!.message).toMatch(/outside the first scope/);
    const w = analyze(
      request("/pplsynth/hooks/WALLET_BALANCE_UPDATED", { user_id: "PPLsynthUser" }, [
        "Partner-Signature: PLANTEDPLATFORMSIG",
      ]),
    );
    expect(w.records[0]).toMatchObject({
      status: "unsupported",
      format: "astropay.platform.webhook",
    });
    expect(toJsonReport(w)).not.toContain("PLANTEDPLATFORMSIG");
  });
});

describe("astropay Direct Payment (deposits)", () => {
  it("keeps a deposit as a payment and reports the repeated callback", () => {
    const r = analyzeFixture("astropay/direct-payment-flow.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.deliveryKey])).toEqual([
      ["direct_payment.response.PENDING", "payment", "pending", undefined],
      [
        "direct_payment.callback.APPROVED",
        "payment",
        "success",
        "direct_payment:PPLsynthDepExt0001:APPROVED",
      ],
      [
        "direct_payment.callback.APPROVED",
        "payment",
        "success",
        "direct_payment:PPLsynthDepExt0001:APPROVED",
      ],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      paymentReference: "PPLsynthDepExt0001",
      merchantReference: "PPLSYNTH-DEP-0001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      productFamily: "direct_payment",
      hasPaymentDetail: true,
      messageKindFrom: "no callback-only fields",
    });
    // end_status_date has no zone: shown, not placed on the timeline.
    expect(r.events[1]!.eventTimestamp).toBeUndefined();
    expect(r.events[1]!.attributes).toMatchObject({
      endStatusDate: "2026-10-20T01:57:39",
      endStatusDateWithoutZone: true,
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("DUPLICATE_DELIVERY");
  });

  it("flags a cancelled deposit as possibly not final and links a later approval", () => {
    const r = analyze(
      json([
        deposit({ status: "CANCELLED" }),
        deposit({ end_status_date: "2026-10-20T02:30:00Z" }),
      ]),
    );
    const cancelled = r.events.find((e) => e.providerStatus === "CANCELLED")!;
    const approved = r.events.find((e) => e.providerStatus === "APPROVED")!;
    expect(cancelled).toMatchObject({ outcome: "failure", stage: "payment" });
    expect(cancelled.attributes.statusMayChange).toBe(true);
    expect(approved).toMatchObject({ eventTimestamp: "2026-10-20T02:30:00.000Z" });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.latestOutcome).toBe("success");
  });

  it("keeps unrelated deposits apart even with a shared merchant reference", () => {
    const r = analyzeFixture("astropay/unrelated-deposits.json");
    expect(r.groups).toHaveLength(2);
    expect(r.events.map((e) => e.merchantReference)).toEqual([
      "PPLSYNTH-DEP-SHARED",
      "PPLSYNTH-DEP-SHARED",
    ]);
  });

  it("keeps undocumented statuses unknown", () => {
    const r = analyze(json(deposit({ status: "EXPIRED" })));
    expect(r.events[0]).toMatchObject({
      outcome: "unknown",
      eventTypeKnown: false,
      stage: "payment",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("drops merchant references that contain personal data", () => {
    expect(
      firstEvent(deposit({ merchant_deposit_id: "someone@example.com" })).merchantReference,
    ).toBeUndefined();
  });
});

describe("astropay merchant gateway errors", () => {
  it("decodes the field validation error with its reason", () => {
    const r = analyzeFixture("astropay/direct-payment-validation-error.txt");
    expect(r.suggestedView).toBe("decoder");
    expect(r.events[0]).toMatchObject({
      eventType: "merchant_gateway.error.merchant_gateway_fields_validation_error",
      stage: "error",
      outcome: "unknown",
      providerStatus: "HTTP 412",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      internalTerm: "FIELDS_VALIDATION_ERROR",
      reasonCodes: ["required_fields"],
      fields: ["first_name"],
    });
    expect(r.errors[0]).toMatchObject({
      code: "merchant_gateway_fields_validation_error",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      providerMessage: "User data validation error",
      subCodes: {
        http_status: "412",
        internal_term: "FIELDS_VALIDATION_ERROR",
        reason_codes: "required_fields",
      },
    });
    expect(r.errors[0]!.explanation).toMatch(/Fields named in reasons: first_name/);
  });

  it.each([
    ["SUSPENDED", "fraud_or_risk", "do_not_retry", /do not retry/],
    ["UNDER_AGE", "fraud_or_risk", "do_not_retry", /do not retry/],
    ["DEAD", "fraud_or_risk", "do_not_retry", /do not retry/],
    ["CPF_UNDER_SACTION", "fraud_or_risk", "manual_review", /compliance/],
    ["NOT_FOUND", "invalid_request", "customer_action_required", /user to act/],
    ["INVALID", "invalid_request", "customer_action_required", /user to act/],
  ])("decodes the CPF status %s", (status, category, retry, text) => {
    const e = firstError(
      http("412 Precondition Failed", {
        error: "merchant_gateway_fields_validation_error",
        description: "User data validation error",
        reasons: [
          {
            reason_code: "document_format_invalid",
            description: `CPF status: ${status}`,
            fields: ["document"],
          },
        ],
        internal_term: "FIELDS_VALIDATION_ERROR",
      }),
    );
    expect(e).toMatchObject({
      category,
      retry,
      confidence: "strong",
      subCodes: { document_status: status },
    });
    expect(e.retryExplanation).toMatch(text);
  });

  it("does not invent a CPF status that the reason does not name", () => {
    const e = firstError(
      http("412 Precondition Failed", {
        error: "merchant_gateway_fields_validation_error",
        reasons: [{ reason_code: "document_format_invalid", description: "invalid document" }],
      }),
    );
    expect(e).toMatchObject({ category: "invalid_request", retry: "customer_action_required" });
    expect(e.missingInformation.join(" ")).toMatch(/no documented CPF status/);
  });

  it("never presents a creation timeout as safe to retry", () => {
    const r = analyzeFixture("astropay/gateway-timeout.txt");
    const e = r.errors[0]!;
    expect(e).toMatchObject({
      code: "merchant_gateway_payment_creation_timeout",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      confidence: "strong",
    });
    expect(e.outcomeKnown).toBeUndefined();
    expect(e.retryExplanation).toMatch(/first verify/);
    expect(e.retryExplanation).toMatch(/try again/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it("decodes an authentication failure", () => {
    const e = firstError(
      http("401 Unauthorized", {
        error: "commons_unauthorized",
        description: "Unauthorized",
        internal_term: "unauthorized",
      }),
    );
    expect(e).toMatchObject({
      code: "commons_unauthorized",
      category: "authentication_failed",
      retry: "do_not_retry",
      confidence: "possible",
    });
    expect(e.nextAction).toMatch(/API key/);
  });

  it("uses internal_term to tell the two generic error meanings apart", () => {
    const sig = firstError(
      http("412 Precondition Failed", {
        error: "merchant_gateway_generic_error",
        internal_term: "INVALID_SIGNATURE",
      }),
    );
    expect(sig).toMatchObject({ category: "configuration", retry: "do_not_retry" });
    const conf = firstError(
      http("412 Precondition Failed", {
        error: "merchant_gateway_generic_error",
        internal_term: "INVALID_CONFIGURATION",
      }),
    );
    expect(conf).toMatchObject({
      category: "configuration",
      retry: "manual_review",
      confidence: "strong",
    });
    const odd = firstError(
      http("412 Precondition Failed", {
        error: "merchant_gateway_user_limit_exceeded",
        internal_term: "FIELDS_VALIDATION_ERROR",
      }),
    );
    expect(odd.confidence).toBe("possible");
    expect(odd.missingInformation.join(" ")).toMatch(/disagree/);
  });

  it("lowers confidence when the HTTP status differs from the documented one", () => {
    const e = firstError(
      http("500 Internal Server Error", {
        error: "merchant_gateway_user_limit_exceeded",
        internal_term: "USER_LIMITS_EXCEEDED",
      }),
    );
    expect(e).toMatchObject({ category: "invalid_amount", confidence: "possible" });
    expect(e.missingInformation.join(" ")).toMatch(/documented HTTP status/);
  });

  it("reports unrecognized codes honestly", () => {
    const e = firstError(json({ error: "commons_brand_new", internal_term: "BRAND_NEW" }));
    expect(e).toMatchObject({ category: "unknown", retry: "unknown", confidence: "insufficient" });
    expect(e.missingInformation.join(" ")).toMatch(/commons_brand_new/);
    const fb = firstError(
      http("500 Internal Server Error", { error: "commons_brand_new", internal_term: "X" }),
    );
    expect(fb).toMatchObject({ category: "provider_unavailable", confidence: "possible" });
  });

  it("keeps rejected field values out of the result", () => {
    const r = analyze(
      http("400 Bad Request", {
        error: "commons_invalid_request",
        description: "Invalid request",
        internal_term: "invalid_request",
        detail: {
          "user.email": "planted.reject@example.com is invalid",
          "user.phone": "PLANTEDPHONE77",
        },
      }),
    );
    expect(r.events[0]!.attributes.detailFields).toEqual(["user.email", "user.phone"]);
    expect(r.errors[0]).toMatchObject({ category: "invalid_request", confidence: "strong" });
    const dump = JSON.stringify([r.events, r.errors]);
    expect(dump).not.toMatch(/planted\.reject|PLANTEDPHONE77/);
  });
});

describe("astropay Direct Withdrawal (payouts)", () => {
  it("keeps a withdrawal as a payout and decodes the cancel reason", () => {
    const r = analyzeFixture("astropay/direct-withdrawal-cancelled.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["direct_withdrawal.response.CREATED", "payout", "pending"],
      ["direct_withdrawal.callback.CANCELLED", "payout", "failure"],
    ]);
    expect(r.events[0]!.attributes.statusExampleOnly).toBe(true);
    expect(r.events[1]!.attributes).toMatchObject({
      cancelReason: "CPF_MISMATCH",
      cancelReasonKnown: true,
    });
    expect(r.groups).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "CPF_MISMATCH",
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "PPLsynthWdExt0001",
    });
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it.each([
    ["GENERIC_ERROR", "provider_unavailable", "retry_conditionally"],
    ["TRX_COULD_NOT_BE_PROCESSED", "provider_unavailable", "retry_conditionally"],
    ["NOT_AUTHORIZED", "provider_unavailable", "retry_conditionally"],
    ["INVALID_PIX_KEY", "invalid_request", "customer_action_required"],
    ["ACCOUNT_BLOCKED", "payment_method_unavailable", "customer_action_required"],
    ["INVALID_BANK_ACCOUNT", "invalid_request", "customer_action_required"],
    ["INVALID_ALIAS", "invalid_request", "customer_action_required"],
  ])("decodes cancel reason %s", (description, category, retry) => {
    const r = analyze(json(withdrawal({ status: "CANCELLED", description })));
    expect(r.errors[0]).toMatchObject({ code: description, category, retry, outcomeKnown: true });
    // The cancellation is final, so it is not an unknown outcome.
    expect(ruleIds(r)).not.toContain("POSSIBLE_RETRY_RISK");
    if (retry === "retry_conditionally")
      expect(r.errors[0]!.retryExplanation).toMatch(/new attempt is allowed/);
  });

  it("reports an unknown or missing cancel reason as insufficient", () => {
    const unknown = analyze(
      json(withdrawal({ status: "CANCELLED", description: "SOMETHING_NEW" })),
    );
    expect(unknown.errors[0]).toMatchObject({ code: "SOMETHING_NEW", confidence: "insufficient" });
    const missing = analyze(json(withdrawal({ status: "CANCELLED", description: undefined })));
    expect(missing.errors[0]).toMatchObject({ code: "CANCELLED", category: "unknown" });
    expect(missing.errors[0]!.missingInformation.join(" ")).toMatch(/No description/);
  });

  it("shows an approved description as text only", () => {
    const r = analyze(json(withdrawal({ description: "SPCD_1000-Txn successful" })));
    expect(r.errors).toEqual([]);
    expect(r.events[0]).toMatchObject({ outcome: "success", stage: "payout" });
    expect(r.events[0]!.attributes).toMatchObject({
      statusDescription: "SPCD_1000-Txn successful",
      descriptionCodeSpaceNotDocumented: true,
    });
  });

  it("uses the HTTP direction to tell a response from a callback", () => {
    const r = analyze(request("/pplsynth/withdrawal", withdrawal({ end_status_date: undefined })));
    expect(r.events[0]).toMatchObject({ eventType: "direct_withdrawal.callback.APPROVED" });
    expect(r.events[0]!.attributes.messageKindFrom).toBe("HTTP request");
    expect(r.events[0]!.deliveryKey).toBe("direct_withdrawal:PPLsynthWdExt0900:APPROVED");
  });
});

describe("astropay Cashouts V1 (payouts to a wallet)", () => {
  it("links the response and the callback and keeps them as payouts", () => {
    const r = analyzeFixture("astropay/cashout-v1-flow.json");
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome, e.deliveryKey])).toEqual([
      ["cashout_v1.response.PENDING", "payout", "pending", undefined],
      ["cashout_v1.callback.APPROVED", "payout", "success", "cashout_v1:PPLsynthCO900001:APPROVED"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]!.attributes).toMatchObject({ statusFinal: true });
    expect(ruleIds(r)).not.toContain("PAYOUT_STATUS");
  });

  it("links an integer cashout_id with its string form", () => {
    const r = analyze(
      json([
        { cashout_id: 900002, merchant_cashout_id: "PPLSYNTH-CO-0002", status: "PENDING" },
        {
          cashout_id: "900002",
          merchant_cashout_id: "PPLSYNTH-CO-0002",
          cashout_user_id: "PPLSYNTH-U",
          status: "CANCELLED",
        },
      ]),
    );
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.attributes.cashoutIdType)).toEqual(["number", "string"]);
    expect(r.events[1]).toMatchObject({ outcome: "failure", stage: "payout" });
    expect(r.events[1]!.attributes.statusMeaning).toMatch(/did not register within 24 hours/);
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).toContain("PAYOUT_STATUS");
  });

  it("decodes a Cashouts V1 error from its description with limited confidence", () => {
    const r = analyzeFixture("astropay/cashout-v1-error.txt");
    expect(r.records[0]!.format).toBe("astropay.cashout_v1.error");
    expect(r.events[0]).toMatchObject({ eventType: "cashout_v1.error", stage: "error" });
    expect(r.errors[0]).toMatchObject({
      code: "HTTP 412",
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "possible",
      providerMessage: "Inssuficient Balance",
    });
    expect(r.errors[0]!.nextAction).toMatch(/merchant balance/);
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no machine code/);
  });

  it.each([
    ["Invalid request body", 400, "The request body is invalid"],
    ["Merchant not authorized", 401, "The merchant is not authorized (API key)"],
    ["Cashout not found", 404, "Cashout not found"],
    ["Merchant configuration not found", 404, "The merchant configuration is missing"],
    ["Accounting currency not configured", 412, "The accounting currency is not configured"],
    ["Invalid signature", 412, "The request signature is invalid"],
    ["Cashouts are disabled for this merchant", 412, "Cashouts are disabled for the merchant"],
    ["Cashout already exists", 412, "A cashout with the same merchant id already exists"],
    ["Invalid user_id", 412, "The AstroPay user_id is invalid"],
    ["merchant_user_id is blocked", 412, "The merchant_user_id is blocked"],
    ["Insufficient balance", 412, "The merchant balance is too low"],
    ["Phone number is required", 412, "The phone number is missing"],
    ["Invalid phone number", 412, "The phone number is invalid"],
  ])("matches %s (HTTP %i)", (text, status, meaning) => {
    expect(matchCashoutError(text, status)?.meaning).toBe(meaning);
    expect(matchCashoutError(text, undefined)?.meaning).toBe(meaning);
  });

  it("keeps unmatched Cashouts V1 texts unknown", () => {
    const loc = { sourceFormat: "astropay.cashout_v1.error", source: { recordIndex: 0, path: "" } };
    expect(decodeCashoutV1Error({ description: "Something odd" }, 412, loc)).toMatchObject({
      category: "unknown",
      confidence: "insufficient",
    });
    const noStatus = decodeCashoutV1Error(
      { description: "Cashout already exists" },
      undefined,
      loc,
    );
    expect(noStatus).toMatchObject({ code: "description only", category: "duplicate_request" });
    expect(noStatus.missingInformation.join(" ")).toMatch(/No HTTP status/);
    expect(decodeCashoutV1Error({ message: "Odd" }, 401, loc)).toMatchObject({
      category: "authentication_failed",
      confidence: "possible",
    });
  });
});

describe("astropay Checkout and Wallet on File", () => {
  it("builds a Checkout timeline with refund steps on one payment id", () => {
    const r = analyzeFixture("astropay/checkout-flow.json");
    expect(r.records.map((x) => x.format)).toEqual([
      "astropay.checkout.create_response",
      "astropay.checkout.callback",
      "astropay.payment_object",
    ]);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["checkout.create.PENDING", "payment", "pending"],
      ["checkout.callback.COMPLETED", "payment", "success"],
      ["checkout_or_wof.transaction.AUTHORIZATION", "authorization", "success"],
      ["checkout_or_wof.transaction.CAPTURE", "capture", "success"],
      ["checkout_or_wof.transaction.REFUND", "refund", "success"],
      ["checkout_or_wof.payment.PARTIALLY_REFUNDED", "refund", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[0]!.attributes.hasRedirectUrl).toBe(true);
    expect(r.events[1]).toMatchObject({ amountMinor: "4000", currency: "USD" });
    expect(r.events[4]).toMatchObject({
      relatedReference: "PPLsynthTx0002c",
      providerStatus: "OK",
    });
    expect(r.events[5]!.attributes).toMatchObject({
      productFamily: "checkout_or_wallet_on_file",
      reversibleField: "is_reversable",
      isReversible: false,
      transactionCount: 3,
    });
    // Amounts in the payment object have no documented currency.
    expect(r.events[5]!.amountMinor).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it("decodes a Checkout callback with its signature headers shown as present only", () => {
    const r = analyzeFixture("astropay/checkout-callback.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "checkout.callback.COMPLETED",
      outcome: "success",
      amountMinor: "15050",
      currency: "BRL",
      deliveryKey: "checkout:PPLsynthPay0001:COMPLETED",
      merchantReference: "PPLSYNTH-ORDER-0001",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      signatureHeader: "Partner-Signature (RSA)",
      signatureVerified: false,
    });
    expect(r.events[0]!.attributes).not.toHaveProperty("signatureSchemeUnexpected");
    const hmac = analyze(
      request(
        "/pplsynth/cb",
        { payment_external_id: "PPLsynthPay0003", payment_status: "REJECTED" },
        ["Signature: PLANTEDWRONGSCHEME"],
      ),
    );
    expect(hmac.events[0]).toMatchObject({ outcome: "failure" });
    expect(hmac.events[0]!.attributes.signatureSchemeUnexpected).toBe(true);
  });

  it("reads Checkout-only statuses only for Checkout", () => {
    const e = analyze(json(payment({ status: "EXPIRED" })));
    expect(e.records[0]!.format).toBe("astropay.checkout.payment");
    expect(e.events.at(-1)).toMatchObject({
      eventType: "checkout.payment.EXPIRED",
      outcome: "failure",
    });
    expect(SHARED_PAYMENT_STATUSES).not.toHaveProperty("EXPIRED");
    expect(SHARED_PAYMENT_STATUSES).not.toHaveProperty("AUTHORIZED");
  });

  it("builds a Wallet on File authorization and partial capture", () => {
    const r = analyzeFixture("astropay/wof-auth-capture.json");
    expect(r.records.map((x) => x.format)).toEqual([
      "astropay.wof.payment",
      "astropay.wof.payment",
    ]);
    expect(r.events.map((e) => [e.eventType, e.stage, e.outcome])).toEqual([
      ["wof.transaction.AUTHORIZATION", "authorization", "success"],
      ["wof.payment.AUTHORIZED", "authorization", "success"],
      ["wof.transaction.AUTHORIZATION", "authorization", "success"],
      ["wof.transaction.CAPTURE", "capture", "success"],
      ["wof.payment.PARTIALLY_CAPTURED", "capture", "success"],
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.events[1]!.attributes).toMatchObject({
      productFamily: "wallet_on_file",
      reversibleField: "is_reversible",
      isAuthorizationCompleted: false,
    });
  });

  it.each([
    ["REVERSED", "reversal", "success"],
    ["PARTIALLY_REVERSED", "reversal", "success"],
    ["CAPTURED", "capture", "success"],
    ["REFUNDED", "refund", "success"],
    ["REJECTED", "payment", "failure"],
    ["PENDING", "payment", "pending"],
  ])("maps payment status %s to %s / %s", (status, stage, outcome) => {
    const e = analyze(json(payment({ status }))).events.at(-1)!;
    expect(e).toMatchObject({ stage, outcome, eventTypeKnown: true, providerStatus: status });
  });

  it("keeps unknown payment statuses and transaction values unknown", () => {
    const r = analyze(
      json(
        payment({
          status: "MYSTERY",
          payment_transactions: [
            { payment_transaction_id: "PPLsynthTx0901", type: "CAPTURE", result: "FAILED" },
            { payment_transaction_id: "PPLsynthTx0902", type: "CHARGEBACK", result: "OK" },
            { payment_transaction_id: "PPLsynthTx0903", type: "REFUND", result: "MAYBE" },
          ],
        }),
      ),
    );
    expect(r.events.map((e) => [e.stage, e.outcome, e.eventTypeKnown])).toEqual([
      ["capture", "failure", true],
      ["other", "success", false],
      ["refund", "unknown", false],
      ["payment", "unknown", false],
    ]);
    expect(r.records[0]!.format).toBe("astropay.payment_object");
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });
});

describe("astropay Checkout and Wallet on File errors", () => {
  it("decodes a refund error with its documented HTTP status", () => {
    const r = analyzeFixture("astropay/refund-error.txt");
    expect(r.errors[0]).toMatchObject({
      code: "REFUND_AMOUNT_EXCEEDED",
      category: "invalid_amount",
      retry: "do_not_retry",
      confidence: "strong",
      subCodes: { http_status: "412", operation: "refund (Checkout or Wallet on File)" },
    });
  });

  it("uses the HTTP status to pick the operation of a reused code", () => {
    const refund = firstError(
      http("412 Precondition Failed", { error: "PAYMENT_GENERIC_ERROR", message: "x" }),
    );
    expect(refund).toMatchObject({
      category: "insufficient_funds",
      retry: "manual_review",
      confidence: "strong",
    });
    expect(refund.nextAction).toMatch(/merchant balance/);
    const capture = firstError(
      http("400 Bad Request", { error: "PAYMENT_GENERIC_ERROR", message: "x" }),
    );
    expect(capture).toMatchObject({
      category: "unknown",
      retry: "unknown",
      confidence: "possible",
    });
  });

  it("shows every meaning when the operation is not visible", () => {
    const e = firstError(
      http("412 Precondition Failed", { error: "USER_NOT_FOUND", message: "x" }),
    );
    expect(e).toMatchObject({
      category: "invalid_request",
      retry: "manual_review",
      confidence: "possible",
    });
    expect(e.missingInformation.join(" ")).toMatch(/several operations/);
    expect(e.explanation).toMatch(/refund.*auth-capture/);
  });

  it("treats a wallet processing error as an unknown outcome", () => {
    const r = analyze(
      http("412 Precondition Failed", { error: "PAYMENT_PROCESSING_ERROR", message: "x" }),
    );
    expect(r.errors[0]).toMatchObject({
      category: "provider_unavailable",
      retry: "retry_conditionally",
    });
    expect(r.errors[0]!.retryExplanation).toMatch(/GET \/v1\/payments/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
  });

  it.each([
    [
      "INSUFFICIENT_BALANCE",
      "412 Precondition Failed",
      "insufficient_funds",
      "customer_action_required",
    ],
    ["DUPLICATE_PAYMENT", "412 Precondition Failed", "duplicate_request", "do_not_retry"],
    ["PARTNER_CONFIGURATION_ERROR", "412 Precondition Failed", "configuration", "do_not_retry"],
    [
      "ACCOUNT_TOKEN_NOT_FOUND",
      "400 Bad Request",
      "authentication_failed",
      "customer_action_required",
    ],
    [
      "TRUSTED_DEVICE_CHALLENGE_ERROR",
      "412 Precondition Failed",
      "authentication_failed",
      "customer_action_required",
    ],
    ["BAD_REQUEST", "400 Bad Request", "authentication_required", "customer_action_required"],
    [
      "USER_NOT_HAVE_WALLET",
      "412 Precondition Failed",
      "payment_method_unavailable",
      "customer_action_required",
    ],
  ])("decodes %s", (code, status, category, retry) => {
    expect(firstError(http(status, { error: code, message: "x" }))).toMatchObject({
      code,
      category,
      retry,
    });
  });

  it("keeps example-only codes at possible confidence", () => {
    const e = firstError(json({ error: "TRUSTED_DEVICE_CHALLENGE_ERROR", message: "x" }));
    expect(e.confidence).toBe("possible");
    expect(e.missingInformation.join(" ")).toMatch(/No HTTP status/);
    const mismatch = firstError(
      http("500 Internal Server Error", { error: "PARTNER_SCOPE_ERROR", message: "x" }),
    );
    expect(mismatch.confidence).toBe("possible");
    expect(mismatch.missingInformation.join(" ")).toMatch(/documented HTTP status/);
  });
});

describe("astropay QR Payments", () => {
  it("decodes a QR callback with amounts and the HMAC signature header present", () => {
    const r = analyzeFixture("astropay/qr-callback.txt");
    expect(r.events[0]).toMatchObject({
      eventType: "qr.callback.APPROVED",
      stage: "payment",
      outcome: "success",
      amountMinor: "2500",
      currency: "USD",
      deliveryKey: "qr:PPLsynthQrDep0001:APPROVED",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      paymentCodeExternalId: "PPLsynthQrCode0001",
      merchantAmountMinor: "12500",
      merchantCurrency: "BRL",
      signatureHeader: "Signature (HMAC SHA256)",
      signatureVerified: false,
      endStatusDateWithoutZone: true,
    });
  });
});

describe("astropay sensitive data", () => {
  const PLANTED = [
    "PLANTEDPIXKEY0001",
    "PLANTEDQRIMAGE0001",
    "PPLSYNTH-USER-PLANTED01",
    "PLANTEDSIGNATUREVALUE0001",
    "PLANTEDCERTSERIAL01",
    "PLANTEDNOTIFYURL",
    "7700123",
    "PLANTEDREDIRECTDATA",
    "PLANTEDFALLBACKDATA",
    "PPLSYNTH-APUSER-PLANTED",
    "PLANTEDHMACSIGNATURE0001",
    "planted.person@example.com",
    "Synthetic Person",
    "+5511900PLANTED",
    "PLANTEDCPF0001",
  ];

  it.each([
    "astropay/direct-payment-flow.json",
    "astropay/checkout-callback.txt",
    "astropay/checkout-flow.json",
    "astropay/cashout-v1-flow.json",
    "astropay/qr-callback.txt",
  ])("keeps planted values out of events and the JSON report (%s)", (path) => {
    const r = analyzeFixture(path);
    expect(r.events.length).toBeGreaterThan(0);
    const events = JSON.stringify(r.events);
    const report = toJsonReport(r);
    for (const value of PLANTED) {
      expect(events).not.toContain(value);
      expect(report).not.toContain(value);
    }
  });

  it("flags sensitive fields in the raw input", () => {
    expect(analyzeFixture("astropay/qr-callback.txt").sensitiveData.detected).toBe(true);
  });
});

describe("astropay manifest and catalog", () => {
  it("exports the adapter as default and by name", () => {
    expect(defaultExport).toBe(astropayAdapter);
    expect(astropayAdapter.manifest).toBe(astropayManifest);
  });

  it("declares honest high-risk metadata and capabilities", () => {
    expect(astropayManifest).toMatchObject({
      id: "astropay",
      version: ASTROPAY_ADAPTER_VERSION,
      wave: "HR-2",
      researchStatus: "tested",
      documentationAccess: "partial",
      status: "limited",
      verifiedAt: "2026-10-25",
      samples: expect.arrayContaining([expect.any(String)]),
      capabilities: {
        errorDecoding: "limited",
        paymentResponses: "supported",
        webhookParsing: "limited",
        timeline: "limited",
        correlation: "limited",
        diagnosticRules: "limited",
      },
      delivery: { duplicatesDocumented: true, ordering: "not_documented" },
    });
    expect([...astropayManifest.categories].sort()).toEqual([
      "alternative_payment_method",
      "gateway",
      "wallet",
    ]);
    for (const s of astropayManifest.sectors)
      expect(s.source).toMatch(/^https:\/\/www\.astropay\.com\//);
    const limits = astropayManifest.limitations.join(" ");
    expect(limits).toMatch(/private\/ sections that were not read/);
    expect(limits).toMatch(/wrong cell/);
    expect(limits).toMatch(/Platform API/);
    expect(limits).toMatch(/never verified/);
    expect(limits).toMatch(/no chargeback, dispute or settlement events/);
    // Every supported format is declared as an API family.
    const families = astropayManifest.apiFamilies.map((f) => f.id);
    for (const f of astropayAdapter.supportedFormats) expect(families).toContain(f.id);
  });

  it("contains every documented code and status", () => {
    expect(Object.keys(REFUND_ERRORS)).toHaveLength(6);
    expect(Object.keys(WOF_AUTH_CAPTURE_ERRORS)).toHaveLength(7);
    expect(Object.keys(WOF_EXAMPLE_ERRORS)).toHaveLength(3);
    expect(Object.keys(WOF_ACCOUNT_LINKING_ERRORS)).toHaveLength(10);
    expect(Object.keys(GATEWAY_ERRORS)).toHaveLength(8);
    expect(Object.keys(GATEWAY_INTERNAL_TERMS)).toHaveLength(7);
    expect(Object.keys(GATEWAY_REASON_CODES)).toHaveLength(2);
    expect(Object.keys(CPF_DOCUMENT_STATUSES)).toHaveLength(6);
    expect(Object.keys(WITHDRAWAL_CANCEL_REASONS)).toHaveLength(8);
    expect(CASHOUT_V1_ERRORS).toHaveLength(13);
    expect(Object.keys(HTTP_STATUSES)).toHaveLength(6);
    expect(Object.keys(PLATFORM_ERROR_CODES)).toHaveLength(43);
    expect(PLATFORM_EVENTS.size).toBe(12);
    expect(Object.keys(CHECKOUT_STATUSES)).toHaveLength(6);
    expect(Object.keys(WOF_STATUSES)).toHaveLength(10);
    expect(Object.keys(SHARED_PAYMENT_STATUSES).sort()).toEqual([
      "COMPLETED",
      "PARTIALLY_REFUNDED",
      "PENDING",
      "REFUNDED",
      "REJECTED",
    ]);
    expect(Object.keys(CASHOUT_V1_STATUSES)).toHaveLength(3);
    expect(Object.keys(DIRECT_PAYMENT_STATUSES)).toHaveLength(3);
    expect(Object.keys(DIRECT_WITHDRAWAL_STATUSES)).toHaveLength(4);
    expect(Object.keys(QR_STATUSES)).toHaveLength(3);
  });

  it("uses no en or em dashes in published text", () => {
    const text = JSON.stringify([
      astropayManifest,
      REFUND_ERRORS,
      WOF_AUTH_CAPTURE_ERRORS,
      WOF_EXAMPLE_ERRORS,
      WOF_ACCOUNT_LINKING_ERRORS,
      GATEWAY_ERRORS,
      GATEWAY_INTERNAL_TERMS,
      GATEWAY_REASON_CODES,
      CPF_DOCUMENT_STATUSES,
      WITHDRAWAL_CANCEL_REASONS,
      CASHOUT_V1_ERRORS.map((e) => ({ ...e, pattern: e.pattern.source })),
      CHECKOUT_STATUSES,
      WOF_STATUSES,
      CASHOUT_V1_STATUSES,
      DIRECT_PAYMENT_STATUSES,
      DIRECT_WITHDRAWAL_STATUSES,
    ]);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
  });
});
