import { describe, expect, it } from "vitest";
import {
  analyzeSources,
  analyzeText,
  parseInput,
  toJsonReport,
  type AnalysisResult,
  type AnalyzeOptions,
  type RecordMeta,
} from "@pandapaylens/core";
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules } from "@pandapaylens/rules";
import {
  CNP_CATEGORIES,
  CNP_FORMATS,
  CNP_HEADER_RESPONSES,
  CNP_NAMESPACE,
  CNP_RESPONSE_CODES,
  CNP_TRANSACTION_RESPONSES,
  DOCTYPE_HINT,
  REFUSAL_CODES,
  WPG_ERROR_CODES,
  WPG_FORMATS,
  WPG_LAST_EVENTS,
  WPG_OK_REPLIES,
  WPG_STANDARD_RETURN_CODES,
  providerText,
  worldpayAdapter,
  worldpayManifest,
  wpgMinorUnits,
} from "@pandapaylens/worldpay";
import { FIXED_NOW, fixture as readFixture } from "../../../rules/tests/helpers.js";

const options: AnalyzeOptions = {
  adapters: [worldpayAdapter],
  rules: defaultRules,
  catalogVersion: "test",
  now: FIXED_NOW,
};

const fixture = (file: string) => readFixture(`worldpay/${file}`);

function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

function parsed(text: string): { record: unknown; meta: RecordMeta } {
  const p = parseInput(text);
  if (!p.ok) throw new Error(p.error.message);
  return { record: p.value.records[0], meta: p.value.meta[0]! };
}

const json = (v: unknown) => JSON.stringify(v);

const XML_FIXTURES = [
  "wpg-error-reply.xml",
  "wpg-refused-iso8583.xml",
  "wpg-notify-authorised.xml",
  "wpg-notify-captured.xml",
  "wpg-reply-http.txt",
  "cnpapi-sale-approved.xml",
  "cnpapi-authorization-declined.xml",
];

const ORDER = "PPLsynth-wpg-order-0900";

const wpg = (inner: string, version = "1.4") =>
  `<?xml version="1.0" encoding="UTF-8"?><paymentService version="${version}" merchantCode="PPLSYNTHMERCHANT">${inner}</paymentService>`;

const amount = (value = "1000", currencyCode = "EUR", exponent = "2", extra = "") =>
  `<amount value="${value}" currencyCode="${currencyCode}" exponent="${exponent}"${extra}/>`;

const payment = (lastEvent: string, more = "", amt = amount()) =>
  `<payment><paymentMethod>VISA-SSL</paymentMethod>${amt}<lastEvent>${lastEvent}</lastEvent>${more}</payment>`;

const iso = (code: string, description: string) =>
  `<ISO8583ReturnCode code="${code}" description="${description}"/>`;

const reply = (lastEvent: string, more = "", orderCode = ORDER) =>
  wpg(
    `<reply><orderStatus orderCode="${orderCode}">${payment(lastEvent, more)}</orderStatus></reply>`,
  );

const journal = (type: string, ...amounts: string[]) =>
  `<journal journalType="${type}"><bookingDate><date dayOfMonth="5" month="9" year="2026"/></bookingDate>${amounts
    .map((a) => `<accountTx accountType="IN_PROCESS_CAPTURED" batchId="7">${a}</accountTx>`)
    .join("")}</journal>`;

const notify = (lastEvent: string, journalXml = "", orderCode = ORDER, amt = amount()) =>
  wpg(
    `<notify><orderStatusEvent orderCode="${orderCode}">${payment(lastEvent, "", amt)}${journalXml}</orderStatusEvent></notify>`,
  );

const errorReply = (code: string, text = "Synthetic error text", orderCode?: string) =>
  wpg(
    orderCode
      ? `<reply><orderStatus orderCode="${orderCode}"><error code="${code}"><![CDATA[${text}]]></error></orderStatus></reply>`
      : `<reply><error code="${code}"><![CDATA[${text}]]></error></reply>`,
  );

const cnp = (inner: string, response = "0", message = "Valid Format") =>
  `<cnpOnlineResponse version="12.49" xmlns="${CNP_NAMESPACE}" response="${response}" message="${message}">${inner}</cnpOnlineResponse>`;

const cnpTx = (
  name: string,
  code: string,
  { message = "Synthetic message", txn = "820000000000000901", orderId = "", time = "" } = {},
) =>
  cnp(
    `<${name} id="PPLsynth-tx" reportGroup="PPLsynthGroup"><cnpTxnId>${txn}</cnpTxnId>${orderId ? `<orderId>${orderId}</orderId>` : ""}<response>${code}</response>${time ? `<responseTime>${time}</responseTime>` : ""}<message>${message}</message></${name}>`,
  );

describe("worldpay XML detection", () => {
  it.each([
    ["wpg-error-reply.xml", WPG_FORMATS.reply],
    ["wpg-refused-iso8583.xml", WPG_FORMATS.reply],
    ["wpg-notify-authorised.xml", WPG_FORMATS.notification],
    ["wpg-notify-captured.xml", WPG_FORMATS.notification],
    ["wpg-reply-http.txt", WPG_FORMATS.reply],
    ["cnpapi-sale-approved.xml", CNP_FORMATS.onlineResponse],
    ["cnpapi-authorization-declined.xml", CNP_FORMATS.onlineResponse],
  ])("detects %s structurally with high confidence", (file, format) => {
    const p = parsed(fixture(file));
    const d = worldpayAdapter.detect(p.record, p.meta);
    expect(d).toMatchObject({ format, supported: true });
    expect(d.confidence).toBeGreaterThanOrEqual(0.9);
    // Reasons name structure only, never values from the document.
    expect(d.reasons.join(" ")).not.toMatch(/PPLsynth|PPLSYNTH/);
  });

  it("lowers confidence without the documented version attribute", () => {
    const p = parsed(`<paymentService><reply><error code="5">x</error></reply></paymentService>`);
    const d = worldpayAdapter.detect(p.record, p.meta);
    expect(d.format).toBe(WPG_FORMATS.reply);
    expect(d.confidence).toBe(0.8);
  });

  it("is the only registered adapter that claims the XML records", () => {
    const others = ADAPTERS.filter((a) => a.id !== "worldpay");
    expect(others.length).toBeGreaterThan(10);
    for (const file of XML_FIXTURES) {
      const p = parsed(fixture(file));
      for (const a of others)
        expect(a.detect(p.record, p.meta).confidence, `${a.id} on ${file}`).toBeLessThan(0.5);
      const r = analyze(fixture(file), { adapters: ADAPTERS, rules: [] });
      expect(r.records[0], file).toMatchObject({ provider: "worldpay", status: "analyzed" });
      for (const alt of r.records[0]!.alternatives) expect(alt.confidence).toBeLessThan(0.5);
    }
  });

  it.each([
    [
      "a WPG order submission",
      wpg(
        `<submit><order orderCode="${ORDER}"><description>x</description>${amount()}</order></submit>`,
      ),
      WPG_FORMATS.other,
      /WPG request/,
    ],
    [
      "a WPG modification",
      wpg(`<modify><orderModification orderCode="${ORDER}"><cancel/></orderModification></modify>`),
      WPG_FORMATS.other,
      /WPG request/,
    ],
    [
      "a WPG inquiry",
      wpg(`<inquiry><orderInquiry orderCode="${ORDER}"/></inquiry>`),
      WPG_FORMATS.other,
      /WPG request/,
    ],
    ["a WPG report", wpg(`<notify><report/></notify>`), WPG_FORMATS.other, /report/],
    [
      "a WPG batch status reply",
      wpg(
        `<reply><batchStatus transactions="1" merchantBatchCode="PPLsynth" status="PROCESSED"/></reply>`,
      ),
      WPG_FORMATS.other,
      /batch status/,
    ],
    [
      "a WPG orderStatus without payment or error",
      wpg(
        `<reply><orderStatus orderCode="${ORDER}"><reference id="PPLsynth">x</reference></orderStatus></reply>`,
      ),
      WPG_FORMATS.other,
      /neither a payment nor an error/,
    ],
    [
      "a cnpAPI batch response",
      `<cnpResponse version="12.49" xmlns="${CNP_NAMESPACE}" response="0" message="Valid Format"><batchResponse id="PPLsynth"/></cnpResponse>`,
      CNP_FORMATS.other,
      /batch/,
    ],
    [
      "a cnpAPI request",
      `<cnpOnlineRequest version="12.49" xmlns="${CNP_NAMESPACE}" merchantId="PPLsynth"><authentication><user>x</user></authentication></cnpOnlineRequest>`,
      CNP_FORMATS.other,
      /request/,
    ],
    [
      "a cnpAPI eCheck response",
      cnp(
        `<echeckSalesResponse id="PPLsynth" reportGroup="g"><cnpTxnId>1</cnpTxnId><response>000</response></echeckSalesResponse>`,
      ),
      CNP_FORMATS.other,
      /authorizationResponse/,
    ],
  ])("recognizes %s as unsupported", (_name, text, format, reason) => {
    const r = analyze(text);
    expect(r.records[0]).toMatchObject({ status: "unsupported", provider: "worldpay", format });
    expect(r.warnings.find((w) => w.code === "UNSUPPORTED_RECORD")!.message).toMatch(reason);
    expect(r.events).toEqual([]);
  });

  it("ignores other roots, namespaces and the cnpAPI root without its namespace", () => {
    for (const text of [
      `<paymentService xmlns="urn:other" version="1.4"><reply><error code="5">x</error></reply></paymentService>`,
      `<paymentService version="1.4"><unknownChild/></paymentService>`,
      `<cnpOnlineResponse response="0" message="Valid Format"><saleResponse><response>000</response></saleResponse></cnpOnlineResponse>`,
      `<payment_response><status>approved</status></payment_response>`,
    ]) {
      const p = parsed(text);
      expect(worldpayAdapter.detect(p.record, p.meta).confidence, text).toBe(0);
    }
    // The same shape as JSON is not WPG.
    expect(
      worldpayAdapter.detect({ paymentService: { reply: { error: { "@code": "5" } } } }).confidence,
    ).toBe(0);
  });

  it("explains that WPG documents must be pasted without their DOCTYPE line", () => {
    const withDoctype = `<?xml version="1.0"?>\n<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN" "http://dtd.worldpay.com/paymentService_v1.dtd">\n${errorReply("5")}`;
    const r = analyzeText(withDoctype, options);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_XML");
    expect(DOCTYPE_HINT).toMatch(/DOCTYPE/);
    const formats = worldpayAdapter.supportedFormats.filter((f) => f.id.startsWith("worldpay.wpg"));
    expect(formats).toHaveLength(2);
    for (const f of formats) expect(f.description).toContain(DOCTYPE_HINT);
    expect(worldpayManifest.limitations.join(" ")).toMatch(/without that line/);
  });

  it("returns parse issues instead of throwing for mismatched or malformed records", () => {
    expect(worldpayAdapter.parse({ other: {} }, WPG_FORMATS.reply).ok).toBe(false);
    expect(worldpayAdapter.parse({ paymentService: {} }, WPG_FORMATS.notification).ok).toBe(false);
    expect(worldpayAdapter.parse({ other: {} }, CNP_FORMATS.onlineResponse).ok).toBe(false);
    const bad = analyze(reply("AUTHORISED", "", ORDER).replace('exponent="2"', 'exponent="5"'));
    expect(bad.records[0]).toMatchObject({ status: "invalid", format: WPG_FORMATS.reply });
    expect(bad.records[0]!.reasons.join(" ")).toMatch(/exponent of 0, 2 or 3/);
  });
});

describe("worldpay WPG replies and errors", () => {
  it("decodes a reply-level error", () => {
    const r = analyze(fixture("wpg-error-reply.xml"));
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      eventType: "error.5",
      eventTypeKnown: true,
      stage: "error",
      outcome: "failure",
      attributes: { apiFamily: "wpg", errorName: "ERROR_INVALID_REQUEST", dtdVersion: "1.4" },
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "5",
      subCodes: { error_name: "ERROR_INVALID_REQUEST" },
      category: "invalid_request",
      retry: "do_not_retry",
      confidence: "strong",
      outcomeKnown: true,
      providerMessage:
        "XML failed validation: Invalid payment details : Cardholder name might contain a card number.",
    });
    expect(r.errors[0]!.explanation).toMatch(/examine the error message/);
    expect(r.errors[0]!.documentation[0]!.url).toBe(
      "https://docs.worldpay.com/apis/wpg/troubleshoot",
    );
  });

  it.each(Object.keys(WPG_ERROR_CODES))("decodes WPG error code %s", (code) => {
    const entry = WPG_ERROR_CODES[code]!;
    const r = analyze(errorReply(code));
    expect(r.errors[0]).toMatchObject({
      code,
      category: entry.category,
      retry: entry.retry,
      confidence: "strong",
    });
    expect(r.events[0]!.outcome).toBe(entry.rejected ? "failure" : "unknown");
    if (entry.rejected) expect(r.errors[0]!.outcomeKnown).toBe(true);
    else {
      expect(r.errors[0]!.outcomeKnown).toBeUndefined();
      expect(r.errors[0]!.retryExplanation).toMatch(/may or may not have taken effect/);
    }
  });

  it("never treats ERROR_NOT_AVAILABLE as a settled outcome", () => {
    const e = analyze(errorReply("8")).errors[0]!;
    expect(e).toMatchObject({
      category: "provider_unavailable",
      retry: "safe_to_retry_technical_request",
    });
    expect(e.nextAction).toMatch(/current status/);
  });

  it("links an order-level error to its orderCode", () => {
    const r = analyze(errorReply("7", "Invalid payment details : Expiry date = 06/2023", ORDER));
    expect(r.events[0]).toMatchObject({ eventType: "error.7", paymentReference: ORDER });
    expect(r.errors[0]).toMatchObject({
      code: "7",
      category: "invalid_request",
      retry: "customer_action_required",
      paymentReference: ORDER,
      providerMessage: "Invalid payment details : Expiry date = 06/2023",
    });
  });

  it("keeps an undocumented error code unknown", () => {
    const r = analyze(errorReply("15"));
    expect(r.events[0]).toMatchObject({ eventType: "error.15", eventTypeKnown: false });
    expect(r.errors[0]).toMatchObject({
      code: "15",
      category: "unknown",
      confidence: "insufficient",
    });
    expect(r.errors[0]!.missingInformation.join(" ")).toMatch(/not documented/);
  });

  it("decodes a refused authorisation with a standard ISO8583ReturnCode", () => {
    const r = analyze(fixture("wpg-refused-iso8583.xml"));
    expect(r.events[0]).toMatchObject({
      eventType: "REFUSED",
      eventTypeKnown: true,
      stage: "authorization",
      outcome: "failure",
      paymentReference: "PPLsynth-wpg-order-0102",
      amountMinor: "2550",
      currency: "GBP",
      attributes: { iso8583ReturnCode: "5", paymentMethod: "ECMC_CREDIT-SSL", cvcResult: "C" },
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({
      code: "5",
      subCodes: { code_table: "wpg_standard", last_event: "REFUSED" },
      category: "card_declined",
      retry: "customer_action_required",
      confidence: "strong",
      providerMessage: "REFUSED",
      paymentReference: "PPLsynth-wpg-order-0102",
      outcomeKnown: true,
    });
    expect(r.findings.map((f) => f.ruleId)).toContain("PAYMENT_FAILURE");
  });

  it.each([
    ["34", "FRAUD SUSPICION", "fraud_or_risk", "manual_review", "strong"],
    ["973", "Revocation of Authorization Order", "card_declined", "do_not_retry", "strong"],
    ["975", "Revocation of All Authorizations Order", "card_declined", "do_not_retry", "strong"],
    ["6", "REFUSED", "card_declined", "customer_action_required", "possible"],
    ["2", "REFERRED", "card_declined", "customer_action_required", "strong"],
  ])("decodes standard return code %s", (code, description, category, retry, confidence) => {
    const e = analyze(reply("REFUSED", iso(code, description))).errors[0]!;
    expect(e).toMatchObject({ code, category, retry, confidence });
  });

  it("keeps an extended return code undecoded, with Worldpay's description", () => {
    // 41 is in the Access Worldpay refusal table, but the WPG pages do not say
    // that WPG return codes follow it.
    expect(REFUSAL_CODES["41"]).toBeDefined();
    const e = analyze(reply("REFUSED", iso("41", "LOST CARD"))).errors[0]!;
    expect(e).toMatchObject({
      code: "41",
      subCodes: { code_table: "not_decoded" },
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      providerMessage: "LOST CARD",
      outcomeKnown: true,
    });
    expect(e.explanation).toMatch(/not one of the standard WPG response codes/);
    expect(e.explanation).toMatch(
      /does not say that they follow the Access Worldpay refusal codes/,
    );
  });

  it("flags an approval code on a refused payment", () => {
    const e = analyze(reply("REFUSED", iso("0", "AUTHORISED"))).errors[0]!;
    expect(e).toMatchObject({ code: "0", confidence: "possible", category: "unknown" });
    expect(e.explanation).toMatch(/does not match the REFUSED status/);
  });

  it("says when a refusal carries no return code", () => {
    const e = analyze(reply("REFUSED")).errors[0]!;
    expect(e).toMatchObject({ code: "REFUSED", category: "unknown", confidence: "insufficient" });
    expect(e.missingInformation.join(" ")).toMatch(/No ISO8583ReturnCode/);
  });

  it("decodes failed refunds, refused disbursements and the ERROR status", () => {
    const refund = analyze(notify("REFUND_FAILED"));
    expect(refund.events[0]).toMatchObject({ stage: "refund", outcome: "failure" });
    expect(refund.errors[0]!.explanation).toMatch(/The refund was refused \(REFUND_FAILED\)/);
    expect(refund.errors[0]!.missingInformation.join(" ")).toMatch(/refer to the description/);

    const push = analyze(notify("PUSH_REFUSED"));
    expect(push.events[0]).toMatchObject({ stage: "payout", outcome: "failure" });
    expect(push.errors[0]!.explanation).toMatch(/Fast Access disbursement was refused/);

    const error = analyze(reply("ERROR"));
    expect(error.events[0]).toMatchObject({ stage: "payment", outcome: "failure" });
    expect(error.errors[0]).toMatchObject({
      code: "ERROR",
      retry: "retry_conditionally",
      confidence: "possible",
    });
  });

  it("does not decode errors for successful or pending statuses", () => {
    for (const status of ["AUTHORISED", "CAPTURED", "SENT_FOR_REFUND", "CANCELLED", "SETTLED"])
      expect(analyze(notify(status)).errors, status).toEqual([]);
  });

  it("reports an undocumented lastEvent without semantics", () => {
    const r = analyze(notify("SOMETHING_NEW"));
    expect(r.events[0]).toMatchObject({
      eventType: "SOMETHING_NEW",
      eventTypeKnown: false,
      stage: "other",
      outcome: "unknown",
    });
    expect(r.errors).toEqual([]);
  });

  it.each(Object.entries(WPG_LAST_EVENTS))("classifies lastEvent %s", (status, info) => {
    const e = analyze(notify(status, journal("X", amount()))).events[0]!;
    expect(e).toMatchObject({
      eventType: status,
      eventTypeKnown: true,
      stage: info.stage,
      outcome: info.outcome,
    });
  });

  it("classifies the documented stages", () => {
    const stage = (s: string) => WPG_LAST_EVENTS[s]!.stage;
    expect(stage("AUTHORISED")).toBe("authorization");
    expect(stage("CAPTURED")).toBe("capture");
    expect(stage("SETTLED")).toBe("settlement");
    expect(stage("SETTLED_BY_MERCHANT")).toBe("settlement");
    expect(stage("REFUNDED")).toBe("refund");
    expect(stage("REFUNDED_BY_MERCHANT")).toBe("refund");
    expect(stage("CANCELLED")).toBe("cancellation");
    expect(stage("VOIDED")).toBe("void");
    expect(stage("CHARGED_BACK")).toBe("dispute");
    expect(stage("PUSH_APPROVED")).toBe("payout");
  });

  it("reads ok acknowledgements of modifications", () => {
    const r = analyze(
      wpg(
        `<reply><ok><captureReceived orderCode="${ORDER}">${amount("750")}</captureReceived></ok></reply>`,
      ),
    );
    expect(r.records[0]!.format).toBe(WPG_FORMATS.reply);
    expect(r.events[0]).toMatchObject({
      eventType: "captureReceived",
      eventTypeKnown: true,
      stage: "capture",
      outcome: "pending",
      paymentReference: ORDER,
      amountMinor: "750",
      currency: "EUR",
    });
    const cancel = analyze(wpg(`<reply><ok><cancelReceived orderCode="${ORDER}"/></ok></reply>`));
    expect(cancel.events[0]).toMatchObject({ stage: "cancellation", outcome: "pending" });
    expect(Object.keys(WPG_OK_REPLIES)).toEqual([
      "captureReceived",
      "cancelReceived",
      "refundReceived",
      "voidReceived",
    ]);
    const other = analyze(
      wpg(
        `<reply><ok><backofficeCodeReceived orderCode="${ORDER}" backOfficeCode="X"/></ok></reply>`,
      ),
    );
    expect(other.events[0]).toMatchObject({ eventTypeKnown: false, outcome: "unknown" });
  });

  it("splits a reply with several orderStatus elements", () => {
    const r = analyze(
      wpg(
        `<reply><orderStatus orderCode="PPLsynth-a">${payment("AUTHORISED")}</orderStatus><orderStatus orderCode="PPLsynth-b">${payment("REFUSED", iso("5", "REFUSED"))}</orderStatus></reply>`,
      ),
    );
    expect(r.events.map((e) => [e.paymentReference, e.eventType, e.source.path])).toEqual([
      ["PPLsynth-a", "AUTHORISED", "paymentService.reply.orderStatus[0].payment"],
      ["PPLsynth-b", "REFUSED", "paymentService.reply.orderStatus[1].payment"],
    ]);
    expect(r.errors.map((e) => e.paymentReference)).toEqual(["PPLsynth-b"]);
  });
});

describe("worldpay WPG amounts", () => {
  it("converts value and exponent to minor units of the currency", () => {
    const m = (value: string, currencyCode: string, exponent: string) =>
      wpgMinorUnits({ value, currencyCode, exponent });
    expect(m("2400", "EUR", "2")).toEqual({ amountMinor: "2400", currency: "EUR" });
    expect(m("24", "EUR", "0")).toEqual({ amountMinor: "2400", currency: "EUR" });
    expect(m("1250", "JPY", "0")).toEqual({ amountMinor: "1250", currency: "JPY" });
    expect(m("125000", "JPY", "2")).toEqual({ amountMinor: "1250", currency: "JPY" });
    expect(m("1500", "BHD", "3")).toEqual({ amountMinor: "1500", currency: "BHD" });
    expect(m("5", "EUR", "2")).toEqual({ amountMinor: "5", currency: "EUR" });
    // Would need rounding: no amount.
    expect(m("125050", "JPY", "2")).toEqual({ currency: "JPY" });
  });

  it("shows the value as sent when it cannot be converted without rounding", () => {
    const e = analyze(notify("AUTHORISED", "", ORDER, amount("125050", "JPY", "2"))).events[0]!;
    expect(e.amountMinor).toBeUndefined();
    expect(e.attributes).toMatchObject({ amountValue: "125050", amountExponent: 2 });
  });

  it("uses the journal amount for captures and refunds, and keeps the order amount", () => {
    const r = analyze(fixture("wpg-notify-captured.xml"));
    expect(r.events[0]).toMatchObject({
      stage: "capture",
      amountMinor: "1500",
      currency: "EUR",
      attributes: { orderAmountMinor: "2400", journalType: "CAPTURED", bookingDate: "2026-10-25" },
    });
    // The journal debits one account and credits another; that is not a negative amount.
    expect(r.events[0]!.attributes.amountDebitCreditIndicator).toBeUndefined();

    const noJournal = analyze(notify("REFUNDED")).events[0]!;
    expect(noJournal.amountMinor).toBeUndefined();
    expect(noJournal.attributes.orderAmountMinor).toBe("1000");

    const differing = analyze(notify("CAPTURED", journal("CAPTURED", amount("100"), amount("200"))))
      .events[0]!;
    expect(differing.amountMinor).toBeUndefined();
  });

  it("shows a debit indicator of the payment amount", () => {
    const e = analyze(
      notify("AUTHORISED", "", ORDER, amount("100", "EUR", "2", ' debitCreditIndicator="debit"')),
    ).events[0]!;
    expect(e.attributes.amountDebitCreditIndicator).toBe("debit");
  });

  it("does not report partial refunds of one order as exceeding the payment", () => {
    const sources = [
      { name: "auth.xml", text: fixture("wpg-notify-authorised.xml") },
      ...["1000", "1400"].map((v, i) => ({
        name: `refund-${i}.xml`,
        text: notify(
          "REFUNDED",
          journal("REFUNDED", amount(v)),
          "PPLsynth-wpg-order-0201",
          amount("2400"),
        ),
      })),
    ];
    const r = analyzeSources(sources, options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.events.map((e) => e.amountMinor)).toEqual(["2400", "1000", "1400"]);
    expect(r.result.findings.map((f) => f.ruleId)).not.toContain("AMOUNT_MISMATCH");
  });
});

describe("worldpay WPG correlation and raw HTTP", () => {
  it("links an authorised and a captured notification by orderCode", () => {
    const r = analyzeSources(
      [
        { name: "authorised.xml", text: fixture("wpg-notify-authorised.xml") },
        { name: "captured.xml", text: fixture("wpg-notify-captured.xml") },
        { name: "other.xml", text: fixture("wpg-refused-iso8583.xml") },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { events, groups } = r.result;
    expect(events.map((e) => e.eventType)).toEqual(["AUTHORISED", "CAPTURED", "REFUSED"]);
    const group = groups.find((g) => g.references.includes("wpg-order:PPLsynth-wpg-order-0201"))!;
    expect(group.eventIds).toEqual([events[0]!.id, events[1]!.id]);
    expect(group.latestOutcome).toBe("success");
    expect(groups.find((g) => g.eventIds.includes(events[2]!.id))!.eventIds).toHaveLength(1);
    // Neither notification has an event time; order follows the input.
    expect(events.every((e) => e.eventTimestamp === undefined)).toBe(true);
  });

  it("never links WPG orders to Access Worldpay records", () => {
    const access = json({
      eventId: "PPLsynth-evt-x",
      eventTimestamp: "2026-10-24T10:00:00.000",
      eventDetails: {
        classification: "payment",
        type: "authorized",
        transactionReference: "PPLsynth-wpg-order-0201",
      },
    });
    const r = analyzeSources(
      [
        { name: "wpg.xml", text: fixture("wpg-notify-authorised.xml") },
        { name: "access.json", text: access },
      ],
      options,
    );
    expect(r.ok && r.result.groups).toHaveLength(2);
  });

  it("analyzes a raw HTTP response with a text/xml body", () => {
    const r = analyze(fixture("wpg-reply-http.txt"));
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: WPG_FORMATS.reply });
    expect(r.events[0]).toMatchObject({
      eventType: "AUTHORISED",
      outcome: "success",
      paymentReference: "PPLsynth-wpg-order-0301",
      amountMinor: "1250",
      currency: "JPY",
      attributes: { httpStatus: 200, authorisationIdPresent: true },
    });
  });

  it("analyzes an order notification pasted as an HTTP request", () => {
    const text = [
      "POST /worldpay/notifications HTTP/1.1",
      "Content-Type: text/xml; charset=UTF-8",
      "",
      fixture("wpg-notify-authorised.xml"),
    ].join("\n");
    const r = analyze(text);
    expect(r.records[0]).toMatchObject({ status: "analyzed", format: WPG_FORMATS.notification });
    expect(r.events[0]).toMatchObject({ eventType: "AUTHORISED", amountMinor: "2400" });
  });
});

describe("worldpay cnpAPI", () => {
  it("analyzes an approved sale", () => {
    const r = analyze(fixture("cnpapi-sale-approved.xml"));
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      sourceFormat: CNP_FORMATS.onlineResponse,
      eventType: "saleResponse",
      eventTypeKnown: true,
      stage: "payment",
      outcome: "success",
      providerStatus: "000",
      paymentReference: "820000000000000101",
      merchantReference: "PPLsynth-cnp-order-0101",
      eventTimestamp: "2026-10-24T14:20:30.000Z",
      attributes: {
        apiFamily: "cnpapi",
        responseCode: "000",
        responseType: "Approved",
        postDate: "2026-10-24",
        authCodePresent: true,
      },
    });
    expect(r.errors).toEqual([]);
  });

  it("decodes a declined authorization and keeps a zone-less responseTime as sent", () => {
    const r = analyze(fixture("cnpapi-authorization-declined.xml"));
    expect(r.events[0]).toMatchObject({
      eventType: "authorizationResponse",
      stage: "authorization",
      outcome: "failure",
      attributes: { responseType: "Soft Decline", responseTimeAsSent: "2026-10-24T14:25:10" },
    });
    expect(r.events[0]!.eventTimestamp).toBeUndefined();
    expect(r.errors[0]).toMatchObject({
      code: "110",
      subCodes: { response_type: "Soft Decline", transaction: "authorizationResponse" },
      category: "insufficient_funds",
      retry: "retry_conditionally",
      confidence: "strong",
      providerMessage: "Insufficient Funds",
      paymentReference: "820000000000000202",
      outcomeKnown: true,
    });
    expect(r.errors[0]!.documentation[0]!.url).toBe(
      "https://docs.worldpay.com/apis/cnpapi/responsecodes/paymenttransaction",
    );
  });

  it.each([
    ["301", "Invalid Account Number", "unknown", "do_not_retry", "strong"],
    ["121", "Call AMEX", "unknown", "customer_action_required", "strong"],
    ["349", "Do Not Honor", "card_declined", "retry_conditionally", "strong"],
    ["145", "Lifecycle", "unknown", "unknown", "possible"],
    [
      "114",
      "Insufficient Funds, Retry after 2 days",
      "insufficient_funds",
      "retry_conditionally",
      "strong",
    ],
  ])("decodes response %s (%s)", (code, message, category, retry, confidence) => {
    const e = analyze(cnpTx("authorizationResponse", code, { message })).errors[0]!;
    expect(e).toMatchObject({ code, category, retry, confidence });
    expect(e.explanation).toContain(message);
  });

  it("keeps an undocumented response code undecoded and masks its message", () => {
    expect(CNP_RESPONSE_CODES["777"]).toBeUndefined();
    const r = analyze(
      cnpTx("saleResponse", "777", {
        message: "Declined for someone@example.com from 203.0.113.9 card 4444********1111",
      }),
    );
    expect(r.events[0]).toMatchObject({ outcome: "unknown" });
    expect(r.errors[0]).toMatchObject({
      code: "777",
      category: "unknown",
      confidence: "insufficient",
    });
    const message = r.errors[0]!.providerMessage!;
    expect(message).toContain("Declined for");
    for (const value of ["someone@example.com", "203.0.113.9", "4444********1111"])
      expect(message).not.toContain(value);
  });

  it("treats approvals, partial approvals and info codes without errors", () => {
    expect(analyze(cnpTx("authorizationResponse", "010")).events[0]!.outcome).toBe("success");
    const info = analyze(cnpTx("authorizationResponse", "014"));
    expect(info.events[0]!.outcome).toBe("unknown");
    expect(info.errors).toEqual([]);
  });

  it.each(Object.entries(CNP_TRANSACTION_RESPONSES))("maps %s to its stage", (name, info) => {
    const e = analyze(cnpTx(name, "000")).events[0]!;
    expect(e).toMatchObject({ eventType: name, stage: info.stage, outcome: "success" });
  });

  it.each([
    ["1", "invalid_request", "do_not_retry"],
    ["3", "configuration", "do_not_retry"],
    ["4", "rate_limiting", "safe_to_retry_technical_request"],
  ])("decodes a rejected request with response attribute %s", (code, category, retry) => {
    const r = analyze(cnp("", code, "Error validating xml data against the schema on line 8"));
    expect(r.records[0]!.status).toBe("analyzed");
    expect(r.events[0]).toMatchObject({ stage: "error", outcome: "failure" });
    expect(r.errors[0]).toMatchObject({
      code,
      category,
      retry,
      confidence: "strong",
      providerMessage: "Error validating xml data against the schema on line 8",
    });
  });

  it("links responses of one order by orderId and keeps other orders apart", () => {
    const r = analyzeSources(
      [
        {
          name: "a.xml",
          text: cnpTx("authorizationResponse", "110", { orderId: "PPLsynth-o1", txn: "1001" }),
        },
        {
          name: "b.xml",
          text: cnpTx("authorizationResponse", "000", { orderId: "PPLsynth-o1", txn: "1002" }),
        },
        {
          name: "c.xml",
          text: cnpTx("authorizationResponse", "000", { orderId: "PPLsynth-o2", txn: "1003" }),
        },
      ],
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.groups).toHaveLength(2);
    const g = r.result.groups.find((x) => x.references.includes("cnp-order:PPLsynth-o1"))!;
    expect(g.eventIds).toHaveLength(2);
    expect(g.references).toEqual(expect.arrayContaining(["cnp-txn:1001", "cnp-txn:1002"]));
  });
});

describe("worldpay XML sensitive data", () => {
  const PLANTED = [
    "Planted Synthetic Holder",
    "planted.holder@example.invalid",
    "5555********4444",
    "4444********1111",
    "77 Planted Synthetic Road",
    "PL7 7SY",
    "Plantedtown",
    "PPLSYNTHMERCHANT",
    "PPL201",
    "203.0.113.77",
  ];

  it("keeps planted card, shopper, address, IP and merchant data out of events, errors and the report", () => {
    const security = errorReply(
      "4",
      "Security violation: request from 203.0.113.77 for planted.holder@example.invalid with 4444********1111",
    );
    for (const text of [
      fixture("wpg-refused-iso8583.xml"),
      fixture("wpg-notify-authorised.xml"),
      fixture("wpg-reply-http.txt"),
      security,
    ]) {
      const r = analyze(text);
      const out = [json(r.events), json(r.errors), json(r.records), toJsonReport(r)].join("\n");
      for (const value of PLANTED) expect(out, value).not.toContain(value);
    }
    expect(analyze(fixture("wpg-refused-iso8583.xml")).sensitiveData.detected).toBe(true);
    const e = analyze(security).errors[0]!;
    expect(e).toMatchObject({ code: "4", category: "configuration" });
    expect(e.providerMessage).toMatch(/^Security violation: request from \[redacted\]/);
  });

  it("scrubs provider text", () => {
    expect(providerText("from 10.1.2.3 and fe80:0:0:0:1:2:3:4 card 411111******1111")).toBe(
      "from [redacted] and [redacted] card [redacted]",
    );
    expect(providerText("  LOST\n CARD ")).toBe("LOST CARD");
    expect(providerText(undefined)).toBeUndefined();
  });
});

describe("worldpay XML catalog", () => {
  it("contains the documented WPG and cnpAPI tables", () => {
    expect(Object.keys(WPG_ERROR_CODES)).toEqual(
      Array.from({ length: 14 }, (_, i) => String(i + 1)),
    );
    expect(WPG_ERROR_CODES["1"]!.name).toBe("ERROR_INTERNAL");
    expect(WPG_ERROR_CODES["14"]!.name).toBe("ERROR_TOKEN_MANAGEMENT_SERVICE");
    expect(Object.keys(WPG_LAST_EVENTS)).toHaveLength(26);
    expect(Object.keys(WPG_STANDARD_RETURN_CODES).sort()).toEqual(
      ["0", "2", "5", "6", "34", "973", "975"].sort(),
    );
    expect(Object.keys(CNP_RESPONSE_CODES)).toHaveLength(379);
    expect(CNP_RESPONSE_CODES["000"]).toEqual(["Approved", "Approved"]);
    expect(CNP_RESPONSE_CODES["110"]).toEqual(["Insufficient Funds", "Soft Decline"]);
    expect(CNP_RESPONSE_CODES["301"]).toEqual(["Invalid Account Number", "Hard Decline"]);
    expect(CNP_RESPONSE_CODES["999"]).toEqual(["Exceeds RTP transaction limit.", "Hard Decline"]);
    for (const code of Object.keys(CNP_CATEGORIES))
      expect(CNP_RESPONSE_CODES[code], code).toBeDefined();
    expect(Object.keys(CNP_HEADER_RESPONSES)).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(Object.keys(CNP_RESPONSE_CODES).every((c) => /^\d{3}$/.test(c))).toBe(true);
  });

  it("declares the XML API families", () => {
    const families = Object.fromEntries(worldpayManifest.apiFamilies.map((f) => [f.id, f.status]));
    expect(families).toMatchObject({
      "worldpay.wpg.reply": "limited",
      "worldpay.wpg.notification": "limited",
      "worldpay.wpg": "unsupported",
      "worldpay.cnpapi.online_response": "limited",
      "worldpay.cnpapi": "unsupported",
    });
    const topics = worldpayManifest.documentation.map((d) => d.topic);
    expect(topics).toEqual(
      expect.arrayContaining(["wpg-errors", "wpg-response-codes", "cnpapi-response-codes"]),
    );
  });

  it("uses no en or em dashes in the XML tables", () => {
    const text = JSON.stringify([
      WPG_ERROR_CODES,
      WPG_LAST_EVENTS,
      WPG_STANDARD_RETURN_CODES,
      CNP_RESPONSE_CODES,
      CNP_HEADER_RESPONSES,
      worldpayAdapter.supportedFormats,
    ]);
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
  });
});
