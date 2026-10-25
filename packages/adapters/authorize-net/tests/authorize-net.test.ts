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
import { nmiAdapter } from "@pandapaylens/nmi";
import defaultExport, {
  ANET_XML_NAMESPACE,
  API_MESSAGE_CODES,
  AUTHORIZE_NET_ADAPTER_VERSION,
  AUTHORIZE_NET_FORMATS,
  AVS_CODES,
  CAVV_CODES,
  CVV_CODES,
  REASON_CODES,
  RESPONSE_CODES,
  WEBHOOK_EVENT_TYPES,
  authorizeNetAdapter,
  authorizeNetManifest,
  transactionOutcome,
} from "@pandapaylens/authorize-net";
import { authorizeNetManifest as manifestOnly } from "@pandapaylens/authorize-net/manifest";

const options: AnalyzeOptions = {
  adapters: [authorizeNetAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: () => new Date("2026-10-25T12:00:00.000Z"),
};

const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const fixture = (p: string) => readFileSync(`${root}authorize_net/${p}`, "utf8");

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}
const analyzeFixture = (p: string) => analyze(fixture(p));
const json = (v: unknown) => JSON.stringify(v);
// En dash and em dash, written as escapes so the source stays plain ASCII.
const TYPOGRAPHIC_DASH = new RegExp("[\u2013\u2014]");
const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();

const txResponse = (tr: Record<string, unknown>, messages?: unknown, extra = {}) => ({
  transactionResponse: {
    responseCode: "1",
    authCode: "",
    avsResultCode: "P",
    cvvResultCode: "",
    cavvResultCode: "",
    transId: "80000009001",
    refTransID: "",
    accountNumber: "XXXX1111",
    accountType: "Visa",
    ...tr,
  },
  ...(messages === undefined ? {} : { messages }),
  ...extra,
});
const apiOk = { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] };
const apiE27 = {
  resultCode: "Error",
  message: [{ code: "E00027", text: "The transaction was unsuccessful." }],
};
const errors = (...codes: string[]) => codes.map((errorCode) => ({ errorCode }));

const webhook = (eventType: string, payload: Record<string, unknown> = {}, extra = {}) => ({
  notificationId: "PPLsynth-notif-9001",
  eventType,
  eventDate: "2026-10-20T14:48:02.0080095Z",
  webhookId: "PPLsynth-webhook-01",
  payload: { responseCode: 1, entityName: "transaction", id: "80000009101", ...payload },
  ...extra,
});

describe("authorize.net catalog", () => {
  it("keeps the documented code counts", () => {
    const api = Object.keys(API_MESSAGE_CODES);
    expect(api.filter((c) => c.startsWith("I"))).toHaveLength(12);
    expect(api.filter((c) => c.startsWith("E"))).toHaveLength(161);
    // 306 reference codes plus 2201 from the second response code file.
    expect(Object.keys(REASON_CODES)).toHaveLength(307);
    expect(Object.keys(RESPONSE_CODES)).toEqual(["1", "2", "3", "4"]);
    expect(Object.keys(AVS_CODES)).toHaveLength(13);
    expect(Object.keys(CVV_CODES)).toHaveLength(5);
    // 13 CAVV values including blank, which is not a key.
    expect(Object.keys(CAVV_CODES)).toHaveLength(12);
    expect(Object.keys(WEBHOOK_EVENT_TYPES)).toHaveLength(23);
  });

  it("keeps the responseCode and reason code tables separate", () => {
    expect(RESPONSE_CODES["2"]!.meaning).toBe("Declined");
    expect(REASON_CODES["2"]!.meaning).toMatch(/Declined \(general/);
    expect(RESPONSE_CODES["4"]!.meaning).toBe("Held for review");
    expect(REASON_CODES["4"]!.meaning).toMatch(/pick up the card/);
    expect(REASON_CODES["1"]!.kind).toBe("success");
  });

  it("marks documented conflicts", () => {
    expect(REASON_CODES["38"]!.caveat).toMatch(/two response code files disagree/);
    expect(REASON_CODES["105"]!.caveat).toMatch(/under review/);
    expect(REASON_CODES["2201"]!.caveat).toMatch(/second response code file/);
    expect(REASON_CODES["39"]!.caveat).toBeUndefined();
  });

  it("uses only valid category and retry values", () => {
    const categories = new Set([
      "card_declined",
      "authentication_required",
      "authentication_failed",
      "invalid_request",
      "invalid_amount",
      "insufficient_funds",
      "payment_method_unavailable",
      "fraud_or_risk",
      "rate_limiting",
      "provider_unavailable",
      "network_or_timeout",
      "duplicate_request",
      "configuration",
      "unknown",
    ]);
    const retries = new Set([
      "do_not_retry",
      "customer_action_required",
      "retry_conditionally",
      "safe_to_retry_technical_request",
      "manual_review",
      "unknown",
    ]);
    for (const e of [...Object.values(API_MESSAGE_CODES), ...Object.values(REASON_CODES)]) {
      expect(categories.has(e.category), e.meaning).toBe(true);
      expect(retries.has(e.retry), e.meaning).toBe(true);
      expect(e.meaning.length).toBeGreaterThan(3);
      expect(e.meaning).not.toMatch(TYPOGRAPHIC_DASH);
      // A non-error code never carries an error category.
      if (e.kind !== "error") expect(e.category).toBe("unknown");
    }
    // Every I code is informational; only I00001 means success.
    for (const [code, e] of Object.entries(API_MESSAGE_CODES))
      if (code.startsWith("I")) expect(e.kind).toBe(code === "I00001" ? "success" : "info");
  });

  it("decodes 1-4 by layer", () => {
    expect(transactionOutcome("1", ["1"])).toBe("success");
    expect(transactionOutcome("2", ["2"])).toBe("failure");
    expect(transactionOutcome("3", ["16"])).toBe("failure");
    expect(transactionOutcome("3", ["19"])).toBe("unknown");
    expect(transactionOutcome("3", ["9999"])).toBe("unknown");
    expect(transactionOutcome("3", [])).toBe("unknown");
    expect(transactionOutcome("4", ["253"])).toBe("pending");
    expect(transactionOutcome("7", [])).toBe("unknown");
  });
});

describe("authorize.net manifest", () => {
  it("is exported consistently", () => {
    expect(defaultExport).toBe(authorizeNetAdapter);
    expect(manifestOnly).toBe(authorizeNetManifest);
    expect(authorizeNetAdapter.manifest).toBe(authorizeNetManifest);
    expect(authorizeNetManifest.version).toBe(AUTHORIZE_NET_ADAPTER_VERSION);
    expect(authorizeNetManifest.id).toBe("authorize_net");
  });

  it("is honest about capabilities", () => {
    const m = authorizeNetManifest;
    expect(m.wave).toBe(2);
    expect(m.researchStatus).toBe("tested");
    expect(m.verifiedAt).toBe("2026-10-25");
    expect(m.samples).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(m.documentationAccess).toBe("public");
    expect(m.categories).toEqual(["gateway", "merchant_account_intermediary"]);
    expect(m.status).toBe("limited");
    expect(m.capabilities).toEqual({
      errorDecoding: "supported",
      paymentResponses: "limited",
      webhookParsing: "limited",
      timeline: "limited",
      correlation: "limited",
      diagnosticRules: "limited",
    });
    expect(m.delivery.duplicateKey).toBe("notificationId");
    expect(m.delivery.ordering).toBe("not_documented");
    expect(m.limitations.join(" ")).toMatch(/no reason code, no parent transaction id/);
    for (const s of m.sectors) expect(s.source).toMatch(/^https:\/\/www\.authorize\.net\//);
  });

  it("uses only plain hyphens", () => {
    expect(JSON.stringify(authorizeNetManifest)).not.toMatch(TYPOGRAPHIC_DASH);
  });
});

describe("authorize.net detection", () => {
  it.each([
    ["auth-capture-approved.json", AUTHORIZE_NET_FORMATS.transaction, 0.95],
    ["declined-general.json", AUTHORIZE_NET_FORMATS.transaction, 0.95],
    ["held-for-review.json", AUTHORIZE_NET_FORMATS.transaction, 0.9],
    ["api-authentication-error.json", AUTHORIZE_NET_FORMATS.api, 0.75],
    ["webhook-authcapture-created.json", AUTHORIZE_NET_FORMATS.webhook, 0.95],
    ["webhook-subscription-suspended.json", AUTHORIZE_NET_FORMATS.webhook, 0.95],
  ])("recognizes %s", (file, format, confidence) => {
    const d = authorizeNetAdapter.detect(JSON.parse(fixture(file)));
    expect(d.format).toBe(format);
    expect(d.confidence).toBe(confidence);
    expect(d.supported).toBe(true);
  });

  it("accepts a response wrapped in createTransactionResponse", () => {
    const d = authorizeNetAdapter.detect({
      createTransactionResponse: JSON.parse(fixture("auth-capture-approved.json")),
    });
    expect(d.format).toBe(AUTHORIZE_NET_FORMATS.transaction);
    expect(d.reasons).toContain("wrapped in createTransactionResponse");
  });

  it.each([
    [{ status: "ok" }],
    [{ error: { code: "E00007" } }],
    [{ messages: { resultCode: "Ok", message: [{ code: "100", text: "x" }] } }],
    [{ messages: { resultCode: "Success", message: [{ code: "I00001" }] } }],
    [{ transactionResponse: {} }],
    [{ transactionResponse: { transId: "1" } }],
    [{ responseCode: "1", transId: "1" }],
    [{ eventType: "payment.succeeded", payload: { id: "x" }, notificationId: "n" }],
    [{ eventType: "net.authorize.payment.authcapture.created", payload: "x" }],
    [{ notificationId: "n", timestamp: 1, data: { accountId: "x" } }],
    [{ response: "1", responsetext: "SUCCESS", response_code: "100" }],
    ["string"],
    [null],
  ])("does not claim %j", (input) => {
    expect(authorizeNetAdapter.detect(input).confidence).toBe(0);
  });

  it("keeps a bare transactionResponse with a responseCode at a moderate confidence", () => {
    const d = authorizeNetAdapter.detect({ transactionResponse: { responseCode: "1" } });
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
    expect(d.confidence).toBeLessThan(0.7);
  });

  it("never fires on form data", () => {
    const parsed = parseInput("x_response_code=1&x_trans_id=PPLsynth1&x_auth_code=PPL111");
    if (!parsed.ok) throw new Error("parse failed");
    expect(
      authorizeNetAdapter.detect(parsed.value.records[0], parsed.value.meta[0]).confidence,
    ).toBe(0);
  });

  it("recognizes but does not analyze transaction details", () => {
    const r = analyzeFixture("unsupported-transaction-details.json");
    expect(r.records[0]!.status).toBe("unsupported");
    expect(r.records[0]!.format).toBe(AUTHORIZE_NET_FORMATS.details);
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/getTransactionDetails/);
    expect(r.events).toHaveLength(0);
  });

  it("recognizes but does not analyze notification history and boarding events", () => {
    const history = authorizeNetAdapter.detect({
      notificationId: "PPLsynth-notif-9002",
      deliveryStatus: "Failed",
      eventType: "net.authorize.payment.authcapture.created",
      eventDate: "2026-10-20T14:48:02.0080095",
      retryLog: { logs: [] },
      payload: { responseCode: 0, entityName: "transaction", id: "80000009201" },
    });
    expect(history.format).toBe(AUTHORIZE_NET_FORMATS.history);
    expect(history.supported).toBe(false);
    const boarding = authorizeNetAdapter.detect(
      webhook("net.authorize.partner.boarding.gateway.created", {
        entityName: "boardingApplication",
      }),
    );
    expect(boarding.format).toBe(AUTHORIZE_NET_FORMATS.boarding);
    expect(boarding.supported).toBe(false);
    const r = analyze(json(webhook("net.authorize.partner.boarding.gateway.created")));
    expect(r.records[0]!.status).toBe("unsupported");
  });
});

describe("authorize.net does not claim other providers' fixtures", () => {
  const dirs = readdirSync(root).filter(
    (d) =>
      d !== "authorize_net" &&
      statSync(`${root}${d}`).isDirectory() &&
      readdirSync(`${root}${d}`).length > 0,
  );

  it("includes the Stripe, Adyen and NMI fixtures", () => {
    expect(dirs).toEqual(expect.arrayContaining(["stripe", "adyen", "nmi"]));
  });

  it.each(dirs)("returns confidence 0 for every record in fixtures/%s", (dir) => {
    let parsedFiles = 0;
    let checked = 0;
    for (const file of readdirSync(`${root}${dir}`)) {
      if (!statSync(`${root}${dir}/${file}`).isFile()) continue;
      const parsed = parseInput(readFileSync(`${root}${dir}/${file}`, "utf8"));
      if (!parsed.ok) continue;
      parsedFiles++;
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload =
          r && typeof r === "object" && "payload" in r && typeof r.receivedAt === "string"
            ? r.payload
            : record;
        expect(
          authorizeNetAdapter.detect(payload, parsed.value.meta[i]).confidence,
          `${dir}/${file} record ${i}`,
        ).toBe(0);
        checked++;
      });
    }
    // Folders with only XML files have nothing for a JSON adapter to check.
    if (parsedFiles > 0) expect(checked).toBeGreaterThan(0);
  });

  it("is not claimed by NMI or any registered adapter", () => {
    for (const file of readdirSync(`${root}authorize_net`)) {
      const parsed = parseInput(fixture(file));
      if (!parsed.ok) throw new Error(`${file}: ${parsed.error.message}`);
      parsed.value.records.forEach((record, i) => {
        const r = record as Record<string, unknown>;
        const payload = typeof r.receivedAt === "string" && "payload" in r ? r.payload : record;
        const meta = parsed.value.meta[i];
        expect(nmiAdapter.detect(payload, meta).confidence, `nmi on ${file}`).toBe(0);
        for (const a of ADAPTERS) {
          if (a.id === "authorize_net") continue;
          expect(a.detect(payload, meta).confidence, `${a.id} on ${file} record ${i}`).toBeLessThan(
            0.5,
          );
        }
      });
    }
  });

  it("wins against NMI when both adapters run", () => {
    const r = analyze(fixture("declined-general.json"), {
      adapters: [nmiAdapter, authorizeNetAdapter],
    });
    expect(r.records[0]!.provider).toBe("authorize_net");
    expect(r.records[0]!.alternatives).toEqual([]);
  });
});

describe("authorize.net createTransactionResponse", () => {
  it("analyzes an approved authCapture", () => {
    const r = analyzeFixture("auth-capture-approved.json");
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.errors).toEqual([]);
    expect(r.events).toHaveLength(1);
    const e = r.events[0]!;
    expect(e).toMatchObject({
      provider: "authorize_net",
      eventType: "createTransactionResponse",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      paymentReference: "80000000101",
      merchantReference: "PPLsynth-ref-0101",
      providerStatus: "responseCode=1 resultCode=Ok",
    });
    expect(e.relatedReference).toBeUndefined();
    expect(e.attributes).toMatchObject({
      responseCode: "1",
      responseCodeMeaning: "Approved",
      resultCode: "Ok",
      apiMessageCodes: ["I00001"],
      reasonCodes: ["1"],
      reasonCodeMeaning: "Approved",
      authCodePresent: true,
      avsResultCode: "Y",
      avsMeaning: "Street and postal code matched",
      cvvResultCode: "M",
      accountType: "Visa",
      networkTransIdPresent: true,
      responseHashPresent: true,
    });
    expect(e.attributes.cavvResultCode).toBeUndefined();
    expect(ruleIds(r)).toEqual([]);
  });

  it("decodes a decline from the transaction layer, not the API layer", () => {
    const r = analyzeFixture("declined-general.json");
    const e = r.events[0]!;
    expect(e.outcome).toBe("failure");
    expect(e.stage).toBe("payment");
    expect(r.errors).toHaveLength(1);
    const err = r.errors[0]!;
    expect(err).toMatchObject({
      code: "2",
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "80000000201",
      attemptReference: "80000000201",
      providerMessage: "This transaction has been declined.",
      subCodes: {
        responseCode: "2",
        reasonCode: "2",
        resultCode: "Error",
        avsResultCode: "N",
        cvvResultCode: "N",
      },
    });
    expect(err.explanation).toMatch(/Returned with responseCode 2 \(declined\)/);
    expect(err.missingInformation.join(" ")).toMatch(/card code result is N/);
    expect(err.missingInformation.join(" ")).toMatch(/AVS result is N/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("decodes a validation error that references the original transaction", () => {
    const r = analyzeFixture("echeck-credit-not-found.json");
    const e = r.events[0]!;
    expect(e.stage).toBe("error");
    expect(e.outcome).toBe("failure");
    expect(e.paymentReference).toBe("80000000301");
    expect(e.attributes.transIdZero).toBe(true);
    expect(e.attributes.accountType).toBe("eCheck");
    const err = r.errors[0]!;
    expect(err).toMatchObject({
      code: "16",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      paymentReference: "80000000301",
    });
    expect(err.attemptReference).toBeUndefined();
    expect(err.missingInformation.join(" ")).toMatch(/transId is 0/);
    expect(r.errors.map((x) => x.code)).not.toContain("E00027");
  });

  it("treats a processor timeout as an unknown outcome and warns about retries", () => {
    const r = analyzeFixture("processor-no-reply.json");
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(r.events[0]!.stage).toBe("payment");
    const err = r.errors[0]!;
    expect(err).toMatchObject({
      code: "19",
      category: "network_or_timeout",
      retry: "retry_conditionally",
      outcomeKnown: false,
    });
    expect(err.retryExplanation).toMatch(/getTransactionDetails/);
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("shows a held transaction as pending", () => {
    const r = analyzeFixture("held-for-review.json");
    const e = r.events[0]!;
    expect(e.outcome).toBe("pending");
    expect(e.attributes.responseCodeMeaning).toBe("Held for review");
    const err = r.errors[0]!;
    expect(err).toMatchObject({ code: "253", category: "fraud_or_risk", retry: "manual_review" });
    expect(ruleIds(r)).toContain("UNRESOLVED_OUTCOME");
  });

  it("decodes conflicting codes with reduced confidence", () => {
    const r = analyze(json(txResponse({ responseCode: "3", errors: errors("38") }, apiE27)));
    expect(r.errors[0]).toMatchObject({
      code: "38",
      category: "configuration",
      confidence: "possible",
    });
    expect(r.errors[0]!.explanation).toMatch(/Documentation conflict/);
    const ech = analyze(json(txResponse({ responseCode: "4", errors: errors("105") })));
    expect(ech.errors[0]!.confidence).toBe("possible");
  });

  it("notes a failed automatic void", () => {
    const r = analyze(json(txResponse({ responseCode: "2", errors: errors("127") }, apiE27)));
    expect(r.errors[0]!.explanation).toMatch(/hold may remain on the card/);
    expect(r.errors[0]!.category).toBe("fraud_or_risk");
  });

  it("decodes authentication failures in both layers", () => {
    const api = analyzeFixture("api-authentication-error.json");
    expect(api.records[0]!.format).toBe(AUTHORIZE_NET_FORMATS.api);
    expect(api.events[0]).toMatchObject({
      stage: "error",
      outcome: "failure",
      eventType: "apiResponse",
    });
    expect(api.errors[0]).toMatchObject({
      code: "E00007",
      category: "configuration",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
    });
    expect(api.errors[0]!.explanation).toMatch(/sandbox vs production/);
    const cavv = analyze(json(txResponse({ responseCode: "3", errors: errors("117") }, apiE27)));
    expect(cavv.errors[0]).toMatchObject({ code: "117", category: "authentication_failed" });
  });

  it("decodes E00027 alone with only the information it carries", () => {
    const r = analyzeFixture("api-split-tender-invalid.json");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "E00027",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      providerMessage: "The specified SplitTenderID is invalid.",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/text varies/);
  });

  it("decodes API-level server errors as uncertain", () => {
    const r = analyze(json({ messages: { resultCode: "Error", message: [{ code: "E00001" }] } }));
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(r.errors[0]).toMatchObject({ code: "E00001", category: "provider_unavailable" });
    expect(ruleIds(r)).toContain("POSSIBLE_RETRY_RISK");
    const busy = analyze(
      json({ messages: { resultCode: "Error", message: [{ code: "E00053" }] } }),
    );
    expect(busy.errors[0]!.retry).toBe("safe_to_retry_technical_request");
  });

  it("treats empty query results as no error", () => {
    const r = analyze(json({ messages: { resultCode: "Error", message: [{ code: "E00087" }] } }));
    expect(r.errors).toEqual([]);
    expect(r.events[0]!.attributes.emptyResult).toBe(true);
    const ok = analyze(json({ refId: "PPLsynth-ref-9001", messages: apiOk }));
    expect(ok.events[0]).toMatchObject({ stage: "other", outcome: "success" });
    expect(ok.errors).toEqual([]);
  });

  it("is honest about unrecognized codes", () => {
    const unknownReason = analyze(json(txResponse({ responseCode: "2", errors: errors("9999") })));
    expect(unknownReason.errors[0]).toMatchObject({
      code: "9999",
      category: "card_declined",
      retry: "manual_review",
      confidence: "insufficient",
    });
    expect(unknownReason.events[0]!.attributes.reasonCodeKnown).toBe(false);

    const unknownRc = analyze(json(txResponse({ responseCode: "7" })));
    expect(unknownRc.events[0]).toMatchObject({ outcome: "unknown", eventTypeKnown: false });
    expect(unknownRc.errors[0]).toMatchObject({
      code: "responseCode=7",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
    });

    const unknownApi = analyze(
      json({ messages: { resultCode: "Error", message: [{ code: "E00999" }] } }),
    );
    expect(unknownApi.errors[0]).toMatchObject({ code: "E00999", confidence: "insufficient" });
    expect(unknownApi.events[0]!.outcome).toBe("unknown");

    const noReason = analyze(json(txResponse({ responseCode: "3" })));
    expect(noReason.errors[0]).toMatchObject({
      code: "responseCode=3",
      category: "unknown",
      retry: "retry_conditionally",
      confidence: "possible",
      outcomeKnown: false,
    });
  });

  it("decodes a reason code that is not an error with possible confidence", () => {
    const r = analyze(json(txResponse({ responseCode: "3", errors: errors("1") })));
    expect(r.errors[0]).toMatchObject({ code: "1", category: "unknown", confidence: "possible" });
    expect(r.errors[0]!.explanation).toMatch(/not an error/);
  });

  it("decodes a partial prepaid approval", () => {
    const r = analyze(
      json(
        txResponse(
          {
            responseCode: "1",
            messages: [{ code: "295" }],
            splitTenderId: "80000009009",
            prePaidCard: {
              requestedAmount: "100.00",
              approvedAmount: "60.00",
              balanceOnCard: "0.00",
            },
          },
          apiOk,
        ),
      ),
    );
    expect(r.errors[0]).toMatchObject({ code: "295", category: "insufficient_funds" });
    expect(r.events[0]!.attributes).toMatchObject({
      prepaidRequestedAmount: "100.00",
      prepaidApprovedAmount: "60.00",
      splitTenderId: "80000009009",
    });
    expect(json(r.events)).not.toContain("balanceOnCard");
  });

  it("parses a wrapped response", () => {
    const r = analyze(
      json({ createTransactionResponse: JSON.parse(fixture("declined-general.json")) }),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]!.attributes.wrapped).toBe(true);
    expect(r.errors[0]!.source.path).toBe(
      "createTransactionResponse.transactionResponse.errors[0]",
    );
  });

  it("reports missing required fields without throwing", () => {
    const r = analyze(
      json({
        transactionResponse: { transId: "80000009010", avsResultCode: "Y" },
        messages: apiOk,
      }),
    );
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/transactionResponse\.responseCode/);
    expect(r.events).toHaveLength(0);
  });

  it("reports a malformed payload without throwing", () => {
    const bad = analyze(
      json({ transactionResponse: { responseCode: "2", errors: "declined" }, messages: apiE27 }),
    );
    expect(bad.records[0]!.status).toBe("invalid");
    const notJson = analyzeText('{"transactionResponse": {"responseCode": "1"', options);
    expect(notJson.ok).toBe(false);
  });

  it("accepts documentation-style JSON with trailing commas and comments", () => {
    const r = analyze(`{
      // copied from a log
      "transactionResponse": { "responseCode": "2", "transId": "80000009011", "errors": [{ "errorCode": "2" },], },
      "messages": { "resultCode": "Error", "message": [{ "code": "E00027" }] },
    }`);
    expect(r.warnings.map((w) => w.code)).toContain("LENIENT_JSON");
    expect(r.errors[0]!.code).toBe("2");
  });

  it("leaves an empty XML response unclaimed", () => {
    const r = analyzeText(
      '<createTransactionResponse xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd"></createTransactionResponse>',
      options,
    );
    expect(r).toMatchObject({
      ok: true,
      result: { records: [{ status: "unsupported", provider: null }], events: [] },
    });
  });
});

describe("authorize.net XML", () => {
  const xmlDoc = (root: string, inner: string, ns: string | null = ANET_XML_NAMESPACE) =>
    `<?xml version="1.0" encoding="utf-8"?><${root} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${ns === null ? "" : ` xmlns="${ns}"`}>${inner}</${root}>`;
  const XML_E27 =
    "<messages><resultCode>Error</resultCode><message><code>E00027</code></message></messages>";
  const detectText = (text: string) => {
    const parsed = parseInput(text);
    if (!parsed.ok) throw new Error(parsed.error.message);
    return authorizeNetAdapter.detect(parsed.value.records[0], parsed.value.meta[0]);
  };
  // Engine-assigned ids and the record path differ by flavor; everything else must match.
  const comparable = (items: readonly object[]) =>
    items.map((x) => {
      const rest: Record<string, unknown> = { ...x };
      for (const k of ["id", "eventId", "source", "contentFingerprint"]) delete rest[k];
      return rest;
    });

  it.each([
    ["xml-auth-capture-approved.xml", AUTHORIZE_NET_FORMATS.transaction, 0.95],
    ["xml-declined-general.xml", AUTHORIZE_NET_FORMATS.transaction, 0.95],
    ["xml-error-response.xml", AUTHORIZE_NET_FORMATS.api, 0.85],
    ["xml-avs-decline-http.txt", AUTHORIZE_NET_FORMATS.transaction, 0.95],
  ])("recognizes %s by root element, namespace and fields", (file, format, confidence) => {
    const d = detectText(fixture(file));
    expect(d.format).toBe(format);
    expect(d.confidence).toBe(confidence);
    expect(d.supported).toBe(true);
    expect(d.reasons[0]).toMatch(/in the AnetApi\/xml\/v1\/schema\/AnetApiSchema\.xsd namespace/);
  });

  it.each([
    ["auth-capture-approved.json", "xml-auth-capture-approved.xml"],
    ["declined-general.json", "xml-declined-general.xml"],
  ])("decodes %s and %s the same way", (jsonFile, xmlFile) => {
    const a = analyzeFixture(jsonFile);
    const b = analyzeFixture(xmlFile);
    expect(b.records[0]!.status).toBe("analyzed");
    expect(b.records[0]!.format).toBe(a.records[0]!.format);
    expect(comparable(b.events)).toEqual(comparable(a.events));
    expect(comparable(b.errors)).toEqual(comparable(a.errors));
    expect(ruleIds(b)).toEqual(ruleIds(a));
    expect(b.events[0]!.source.path).toBe("createTransactionResponse");
  });

  it("points decoded XML errors at the XML elements", () => {
    const r = analyzeFixture("xml-declined-general.xml");
    expect(r.errors.map((e) => e.source.path)).toEqual([
      "createTransactionResponse.transactionResponse.errors.error[0]",
    ]);
    expect(r.events[0]!.attributes.wrapped).toBeUndefined();
  });

  it("analyzes an XML ErrorResponse from the API-level messages", () => {
    const r = analyzeFixture("xml-error-response.xml");
    expect(r.records[0]!.format).toBe(AUTHORIZE_NET_FORMATS.api);
    expect(r.events[0]).toMatchObject({
      eventType: "apiResponse",
      stage: "error",
      outcome: "failure",
      providerStatus: "resultCode=Error",
      source: { path: "ErrorResponse" },
    });
    expect(r.events[0]!.attributes.apiMessageCodes).toEqual(["E00003"]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "E00003",
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      source: { path: "ErrorResponse.messages.message[0]" },
    });
    expect(r.errors[0]!.explanation).toMatch(/XML parse error/);
  });

  it("decodes a raw HTTP response with Content-Type application/xml", () => {
    const parsed = parseInput(fixture("xml-avs-decline-http.txt"));
    if (!parsed.ok) throw new Error(parsed.error.message);
    expect(parsed.value.meta[0]).toMatchObject({
      format: "http",
      http: { status: 200, contentType: "application/xml" },
      xml: { root: "createTransactionResponse", namespace: ANET_XML_NAMESPACE },
    });
    const r = analyzeFixture("xml-avs-decline-http.txt");
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({
      stage: "payment",
      outcome: "failure",
      paymentReference: "80000001401",
      merchantReference: "PPLsynth-ref-1401",
      providerStatus: "responseCode=2 resultCode=Error",
    });
    expect(r.events[0]!.attributes).toMatchObject({
      httpStatus: 200,
      reasonCodes: ["27"],
      avsResultCode: "A",
      cvvResultCode: "M",
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "27",
      category: "fraud_or_risk",
      confidence: "strong",
      outcomeKnown: true,
      subCodes: { responseCode: "2", reasonCode: "27", resultCode: "Error", avsResultCode: "A" },
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/AVS result is A/);
    expect(ruleIds(r)).toContain("PAYMENT_FAILURE");
  });

  it("reads one item or several from wrapped lists", () => {
    const tx = (inner: string) =>
      xmlDoc(
        "createTransactionResponse",
        `${XML_E27}<transactionResponse><responseCode>3</responseCode><transId>0</transId>${inner}</transactionResponse>`,
      );
    const two = analyze(
      tx(
        "<errors><error><errorCode>16</errorCode></error><error><errorCode>9999</errorCode><errorText>x</errorText></error></errors>",
      ),
    );
    expect(two.errors.map((e) => e.code)).toEqual(["16", "9999"]);
    expect(two.errors[1]!.source.path).toBe(
      "createTransactionResponse.transactionResponse.errors.error[1]",
    );
    expect(two.events[0]!.attributes.reasonCodes).toEqual(["16", "9999"]);
    expect(two.events[0]!.stage).toBe("error");

    const empty = analyze(tx("<errors /><messages />"));
    expect(empty.records[0]!.status).toBe("analyzed");
    expect(empty.errors.map((e) => e.code)).toEqual(["responseCode=3"]);
  });

  it("accepts <message> directly under <transactionResponse>, as in one documented example", () => {
    const r = analyze(
      xmlDoc(
        "createTransactionResponse",
        "<messages><resultCode>Ok</resultCode><message><code>I00001</code></message></messages>" +
          "<transactionResponse><responseCode>1</responseCode><transId>80000009301</transId>" +
          "<message><code>1</code><description>This transaction has been approved.</description></message>" +
          "</transactionResponse>",
      ),
    );
    expect(r.events[0]).toMatchObject({ outcome: "success", paymentReference: "80000009301" });
    expect(r.events[0]!.attributes.reasonCodes).toEqual(["1"]);
    expect(r.errors).toEqual([]);
  });

  it("reads elements that carry attributes as their text", () => {
    const r = analyze(
      xmlDoc(
        "createTransactionResponse",
        `${XML_E27}<transactionResponse><responseCode>2</responseCode>` +
          '<avsResultCode xsi:nil="true" /><cvvResultCode note="x">N</cvvResultCode>' +
          "<transId>80000009302</transId><errors><error><errorCode>2</errorCode></error></errors>" +
          "</transactionResponse>",
      ),
    );
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]!.attributes.avsResultCode).toBeUndefined();
    expect(r.events[0]!.attributes.cvvResultCode).toBe("N");
    expect(r.errors[0]!.code).toBe("2");
  });

  it("recognizes but does not analyze an XML getTransactionDetailsResponse", () => {
    const r = analyze(
      xmlDoc(
        "getTransactionDetailsResponse",
        "<messages><resultCode>Ok</resultCode><message><code>I00001</code></message></messages>" +
          "<transaction><transId>80000009303</transId><transactionStatus>settledSuccessfully</transactionStatus></transaction>",
      ),
    );
    expect(r.records[0]).toMatchObject({
      status: "unsupported",
      provider: "authorize_net",
      format: AUTHORIZE_NET_FORMATS.details,
    });
  });

  it("reports a malformed XML response as invalid without throwing", () => {
    const r = analyze(
      xmlDoc(
        "createTransactionResponse",
        `${XML_E27}<transactionResponse><responseCode>2</responseCode><transId>80000009304</transId><errors>declined</errors></transactionResponse>`,
      ),
    );
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(
      /createTransactionResponse\.transactionResponse\.errors/,
    );
  });

  it.each([
    ["no namespace", xmlDoc("ErrorResponse", XML_E27, null)],
    ["another namespace", xmlDoc("ErrorResponse", XML_E27, "urn:PPLsynth:other")],
    [
      "a request root",
      xmlDoc(
        "createTransactionRequest",
        "<merchantAuthentication><name>PPLsynth</name></merchantAuthentication>",
      ),
    ],
    ["a root that is not a response", xmlDoc("messages", "<resultCode>Error</resultCode>")],
    [
      "a response without documented fields",
      xmlDoc("createTransactionResponse", "<status>ok</status>"),
    ],
    [
      "API-level messages with codes that are not I/E codes",
      xmlDoc(
        "ErrorResponse",
        "<messages><resultCode>Error</resultCode><message><code>100</code></message></messages>",
      ),
    ],
  ])("does not claim XML with %s", (_, text) => {
    expect(detectText(text).confidence).toBe(0);
  });

  it("is not claimed by NMI or any other registered adapter", () => {
    const files = readdirSync(`${root}authorize_net`).filter((f) => f.startsWith("xml-"));
    expect(files).toHaveLength(4);
    for (const file of files) {
      const parsed = parseInput(fixture(file));
      if (!parsed.ok) throw new Error(`${file}: ${parsed.error.message}`);
      const [record, meta] = [parsed.value.records[0], parsed.value.meta[0]];
      expect(meta?.xml?.namespace).toBe(ANET_XML_NAMESPACE);
      expect(nmiAdapter.detect(record, meta).confidence, `nmi on ${file}`).toBe(0);
      for (const a of ADAPTERS) {
        if (a.id === "authorize_net") continue;
        expect(a.detect(record, meta).confidence, `${a.id} on ${file}`).toBe(0);
      }
      const all = analyze(fixture(file), { adapters: ADAPTERS });
      expect(all.records[0]).toMatchObject({ provider: "authorize_net", alternatives: [] });
    }
  });
});

describe("authorize.net webhooks", () => {
  it("analyzes a payment notification", () => {
    const r = analyzeFixture("webhook-authcapture-created.json");
    const e = r.events[0]!;
    expect(e).toMatchObject({
      eventType: "net.authorize.payment.authcapture.created",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      eventReference: "PPLsynth-notif-0801",
      deliveryKey: "PPLsynth-notif-0801",
      eventTimestamp: "2026-10-20T14:48:02.008Z",
      paymentReference: "80000000801",
      merchantReference: "PPLsynth-ref-0801",
      providerStatus: "responseCode=1",
    });
    expect(e.amountMinor).toBeUndefined();
    expect(e.attributes).toMatchObject({
      entityName: "transaction",
      responseCode: "1",
      authCodePresent: true,
      avsResultCode: "Y",
      authAmount: "45",
    });
    expect(r.errors).toEqual([]);
  });

  it("links authorization, capture and refund through the refund's API response", () => {
    const r = analyzeFixture("auth-capture-refund-flow.json");
    expect(r.events).toHaveLength(4);
    expect(r.groups).toHaveLength(1);
    const byType = Object.fromEntries(r.events.map((e) => [e.eventType, e]));
    expect(byType["net.authorize.payment.authorization.created"]).toMatchObject({
      stage: "authorization",
      outcome: "success",
    });
    expect(byType["net.authorize.payment.priorAuthCapture.created"]).toMatchObject({
      stage: "capture",
      outcome: "success",
    });
    expect(byType["net.authorize.payment.refund.created"]).toMatchObject({
      stage: "refund",
      outcome: "pending",
      paymentReference: "80000000951",
    });
    expect(byType.createTransactionResponse).toMatchObject({
      stage: "other",
      paymentReference: "80000000901",
      relatedReference: "80000000951",
    });
    expect(ruleIds(r)).toContain("REFUND_PENDING");
  });

  it("keeps unrelated transactions apart", () => {
    const r = analyze(
      json([
        webhook("net.authorize.payment.authcapture.created", { id: "80000009102" }),
        {
          ...webhook("net.authorize.payment.authcapture.created", { id: "80000009103" }),
          notificationId: "PPLsynth-notif-9003",
        },
        // Same merchant reference, different transaction: not linked.
        {
          ...webhook("net.authorize.payment.refund.created", {
            id: "80000009104",
            merchantReferenceId: "PPLsynth-ref-x",
          }),
          notificationId: "PPLsynth-notif-9004",
        },
        txResponse({ transId: "80000009105" }, apiOk, { refId: "PPLsynth-ref-x" }),
      ]),
    );
    expect(r.groups).toHaveLength(4);
  });

  it("reports duplicate deliveries by notificationId", () => {
    const r = analyzeFixture("webhook-duplicate-delivery.json");
    expect(r.events).toHaveLength(2);
    expect(r.events[0]!.stage).toBe("void");
    expect(r.events[0]!.observedTimestamp).toBe("2026-10-21T08:15:03.000Z");
    const f = r.findings.find((x) => x.ruleId === "DUPLICATE_DELIVERY")!;
    expect(f.explanation).toMatch(/same notificationId/);
    expect(f.recommendedAction).toMatch(/notificationId/);
  });

  it("follows a fraud hold to its approval", () => {
    const r = analyzeFixture("webhook-fraud-held-approved.json");
    expect(r.groups).toHaveLength(1);
    expect(r.events.map((e) => e.outcome)).toEqual(["pending", "success"]);
    expect(r.events[0]!.attributes).toMatchObject({
      fraudFilters: ["AmountFilter"],
      fraudActions: ["authAndHold"],
      responseCodeMeaning: "Held for review",
    });
    expect(r.errors).toEqual([]);
    expect(ruleIds(r)).not.toContain("UNRESOLVED_OUTCOME");
  });

  it("decodes a fraud decline without inventing a reason", () => {
    const r = analyze(json(webhook("net.authorize.payment.fraud.declined", { responseCode: 4 })));
    expect(r.events[0]!.outcome).toBe("failure");
    expect(r.errors[0]).toMatchObject({
      code: "net.authorize.payment.fraud.declined",
      category: "fraud_or_risk",
      confidence: "possible",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no reason code/);
  });

  it("decodes a declined payment webhook from a raw HTTP request without verifying the signature", () => {
    const r = analyzeFixture("webhook-decline-http.txt");
    const e = r.events[0]!;
    expect(e).toMatchObject({ stage: "authorization", outcome: "failure" });
    expect(e.attributes.webhookSignature).toBe("present_not_verified");
    expect(r.errors[0]).toMatchObject({
      code: "responseCode=2",
      category: "card_declined",
      confidence: "possible",
      paymentReference: "80000001301",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/no reason code/);
    expect(json(r) + toJsonReport(r)).not.toContain("PPLSYNTHSIGNATURE");
  });

  it("shows undocumented webhook responseCode values as unknown", () => {
    const r = analyze(json(webhook("net.authorize.payment.capture.created", { responseCode: 0 })));
    expect(r.events[0]!.outcome).toBe("unknown");
    expect(r.events[0]!.attributes.responseCodeKnown).toBe(false);
    expect(r.errors[0]).toMatchObject({ code: "responseCode=0", confidence: "insufficient" });
  });

  it("analyzes subscription and profile events without payment references", () => {
    const r = analyzeFixture("webhook-subscription-suspended.json");
    expect(r.events[0]).toMatchObject({
      stage: "subscription",
      outcome: "failure",
      subscriptionReference: "PPLsynth-sub-1201",
    });
    expect(r.events[0]!.paymentReference).toBeUndefined();
    const cancel = analyze(
      json(
        webhook("net.authorize.customer.subscription.cancelled", {
          entityName: "subscription",
          id: "PPLsynth-sub-1202",
        }),
      ),
    );
    expect(cancel.events[0]).toMatchObject({ stage: "cancellation", outcome: "success" });
    const profile = analyze(
      json(
        webhook("net.authorize.customer.paymentProfile.created", {
          entityName: "customerPaymentProfile",
          id: "PPLsynth-pp-1",
        }),
      ),
    );
    expect(profile.events[0]).toMatchObject({
      stage: "other",
      outcome: "success",
      eventTypeKnown: true,
    });
    expect(json(profile.events)).not.toContain("PPLsynth-pp-1");
  });

  it("shows unknown net.authorize event types as unknown", () => {
    const r = analyze(json(webhook("net.authorize.payment.newthing.created")));
    expect(r.events[0]).toMatchObject({
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(ruleIds(r)).toContain("UNKNOWN_EVENT_TYPE");
  });

  it("reports a webhook without notificationId as invalid", () => {
    const w = webhook("net.authorize.payment.authcapture.created") as Record<string, unknown>;
    delete w.notificationId;
    const r = analyze(json(w));
    expect(r.records[0]!.status).toBe("invalid");
    expect(r.records[0]!.reasons.join(" ")).toMatch(/notificationId/);
  });

  it("does not convert amounts without a currency", () => {
    const r = analyze(
      json(webhook("net.authorize.payment.authcapture.created", { authAmount: 0.1 })),
    );
    expect(r.events[0]!.amountMinor).toBeUndefined();
    expect(r.events[0]!.currency).toBeUndefined();
    expect(r.events[0]!.attributes.authAmount).toBe("0.1");
  });
});

describe("authorize.net redaction", () => {
  const PLANTED = [
    "4111PLANTED11111",
    "PLANTEDEXPIRY",
    "PLANTEDCARDCODE",
    "PLANTEDTRANSKEY",
    "PLANTEDLOGINID",
    "PLANTEDACCESSTOKEN",
    "PLANTEDROUTING",
    "PLANTEDBANKACCT",
    "PLANTEDNAMEONACCT",
    "planted.payer@example.com",
    "PLANTEDPAYERID",
    "PLANTEDTRACK1",
    "PLANTEDTLV",
    "PLANTEDOPAQUE",
    "PLANTEDCAVV",
    "PLANTEDUSERFIELD",
    "PLANTEDAUTHCODE",
    "PLANTEDHASH",
    "PLANTEDSHA2",
    "PLANTEDSECUREURL",
    "PLANTEDFIRSTNAME",
    "PLANTEDSTREET",
    "203.0.113.77",
    "PLANTEDNETWORKID",
    "XXXX9876",
    "PLANTEDBALANCE",
    "PLANTEDRAWCODE",
  ];

  it("keeps planted sensitive values out of events and reports", () => {
    const record = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: "PLANTEDLOGINID",
          transactionKey: "PLANTEDTRANSKEY",
          accessToken: "PLANTEDACCESSTOKEN",
        },
      },
      ...txResponse(
        {
          responseCode: "2",
          authCode: "PLANTEDAUTHCODE",
          accountNumber: "XXXX9876",
          transHash: "PLANTEDHASH",
          transHashSha2: "PLANTEDSHA2",
          rawResponseCode: "PLANTEDRAWCODE",
          networkTransId: "PLANTEDNETWORKID",
          errors: [
            { errorCode: "2", errorText: "Card 4111111111111111 for planted.payer@example.com" },
          ],
          secureAcceptance: {
            SecureAcceptanceUrl: "https://x.example/PLANTEDSECUREURL",
            PayerID: "PLANTEDPAYERID",
            PayerEmail: "planted.payer@example.com",
          },
          emvResponse: { tlvData: "PLANTEDTLV" },
          userFields: [{ name: "note", value: "PLANTEDUSERFIELD" }],
          prePaidCard: { balanceOnCard: "PLANTEDBALANCE" },
          payment: {
            creditCard: {
              cardNumber: "4111PLANTED11111",
              expirationDate: "PLANTEDEXPIRY",
              cardCode: "PLANTEDCARDCODE",
            },
            bankAccount: {
              routingNumber: "PLANTEDROUTING",
              accountNumber: "PLANTEDBANKACCT",
              nameOnAccount: "PLANTEDNAMEONACCT",
            },
            trackData: { track1: "PLANTEDTRACK1" },
            opaqueData: { dataValue: "PLANTEDOPAQUE" },
          },
          cardholderAuthentication: { cardholderAuthenticationValue: "PLANTEDCAVV" },
          billTo: { firstName: "PLANTEDFIRSTNAME", address: "PLANTEDSTREET" },
          customerIP: "203.0.113.77",
        },
        apiE27,
      ),
    };
    const r = analyze(json(record));
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.errors[0]!.providerMessage).toBe("Card [redacted] for [redacted]");
    const dump = json(r.events) + json(r.errors) + toJsonReport(r);
    for (const p of PLANTED) expect(dump, p).not.toContain(p);
    expect(r.sensitiveData.detected).toBe(true);
  });

  it("keeps webhook-only sensitive values out", () => {
    const r = analyze(
      json(
        webhook("net.authorize.payment.authcapture.created", {
          authCode: "PLANTEDAUTHCODE",
          merchantReferenceId: "planted.payer@example.com",
          customerIP: "203.0.113.77",
        }),
      ),
    );
    const dump = json(r.events) + json(r.errors) + toJsonReport(r);
    for (const p of PLANTED) expect(dump, p).not.toContain(p);
    expect(r.events[0]!.merchantReference).toBeUndefined();
  });

  it("keeps planted sensitive values out of an XML response", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<createTransactionResponse xmlns="${ANET_XML_NAMESPACE}">
  <refId>planted.payer@example.com</refId>
  <messages><resultCode>Error</resultCode><message><code>E00027</code></message></messages>
  <transactionResponse>
    <responseCode>2</responseCode>
    <authCode>PLANTEDAUTHCODE</authCode>
    <avsResultCode>N</avsResultCode>
    <transId>80000009401</transId>
    <transHash>PLANTEDHASH</transHash>
    <rawResponseCode>PLANTEDRAWCODE</rawResponseCode>
    <accountNumber>XXXX9876</accountNumber>
    <accountType>Visa</accountType>
    <errors>
      <error>
        <errorCode>2</errorCode>
        <errorText>Card 4111111111111111 for planted.payer@example.com</errorText>
      </error>
    </errors>
    <userFields>
      <userField><name>note</name><value>PLANTEDUSERFIELD</value></userField>
      <userField><name>ip</name><value>203.0.113.77</value></userField>
    </userFields>
    <secureAcceptance>
      <SecureAcceptanceUrl>https://x.example/PLANTEDSECUREURL</SecureAcceptanceUrl>
      <PayerID>PLANTEDPAYERID</PayerID>
      <PayerEmail>planted.payer@example.com</PayerEmail>
    </secureAcceptance>
    <emvResponse><tlvData>PLANTEDTLV</tlvData></emvResponse>
    <prePaidCard><balanceOnCard>PLANTEDBALANCE</balanceOnCard></prePaidCard>
    <transHashSha2>PLANTEDSHA2</transHashSha2>
    <networkTransId>PLANTEDNETWORKID</networkTransId>
    <payment>
      <creditCard>
        <cardNumber>4111PLANTED11111</cardNumber>
        <expirationDate>PLANTEDEXPIRY</expirationDate>
        <cardCode>PLANTEDCARDCODE</cardCode>
      </creditCard>
      <bankAccount>
        <routingNumber>PLANTEDROUTING</routingNumber>
        <accountNumber>PLANTEDBANKACCT</accountNumber>
        <nameOnAccount>PLANTEDNAMEONACCT</nameOnAccount>
      </bankAccount>
      <trackData><track1>PLANTEDTRACK1</track1></trackData>
      <opaqueData><dataValue>PLANTEDOPAQUE</dataValue></opaqueData>
    </payment>
    <cardholderAuthentication>
      <cardholderAuthenticationValue>PLANTEDCAVV</cardholderAuthenticationValue>
    </cardholderAuthentication>
    <billTo><firstName>PLANTEDFIRSTNAME</firstName><address>PLANTEDSTREET</address></billTo>
    <merchantAuthentication>
      <name>PLANTEDLOGINID</name>
      <transactionKey>PLANTEDTRANSKEY</transactionKey>
      <accessToken>PLANTEDACCESSTOKEN</accessToken>
    </merchantAuthentication>
  </transactionResponse>
</createTransactionResponse>`;
    const r = analyze(xml);
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.errors[0]!.providerMessage).toBe("Card [redacted] for [redacted]");
    const dump = json(r.events) + json(r.errors) + toJsonReport(r);
    for (const p of PLANTED) expect(dump, p).not.toContain(p);
    expect(r.events[0]!.merchantReference).toBeUndefined();
    expect(r.sensitiveData.detected).toBe(true);
  });
});
