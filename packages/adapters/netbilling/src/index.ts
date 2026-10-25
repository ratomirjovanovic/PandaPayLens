/**
 * NETbilling adapter.
 *
 * Supported input families (URL-encoded `key=value` data that reaches the
 * adapter as a flat object of strings):
 * - `netbilling.direct3.response`     Direct Mode 3.2 synchronous response (`status_code`, `trans_id`, `auth_msg`, ...)
 * - `netbilling.direct3.exception`    Direct Mode 3.2 exception: a 6xx/7xx HTTP status with an empty body
 * - `netbilling.paymentform.response` Payment Form 2.2 return / Postback CGI (`Ecom_Ezic_Response_*`), experimental
 * - `netbilling.memberupdate.member`  Member Update 1.1 GET response (`M_MEMBER_STATUS`), experimental
 *
 * Recognized but not analyzed: hosted form requests, hosted form returns in
 * Authorize.Net or Verisign compatibility mode, Direct Mode 2.1 and Direct
 * Mode Batch job status.
 */

import {
  decimalToMinor,
  lookup,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type LifecycleStage,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type Outcome,
  type ProviderAdapter,
  type RecordMeta,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ACH_GUIDE_URL,
  AUTH_MESSAGE_ALIASES,
  AUTH_MESSAGES,
  AUTH_MESSAGES_URL,
  DIRECT3_STATUS_CODES,
  DIRECT3_URL,
  EXTRA_AUTH_MESSAGES,
  MEMBER_STATUSES,
  NEXT_ACTION,
  PAYMENT_FORM_STATUS_CODES,
  PAYMENT_FORM_URL,
  PREFIXED_REJECTION,
  RETRY_EXPLANATION,
  TEST_MODE_AVS,
  TEST_MODE_CVV2,
  TEST_MODE_URL,
  directExceptionInfo,
  type AuthMessageEntry,
  type AuthMessageGroup,
  type CatalogEntry,
  type StatusInfo,
} from "./catalog.js";
import { netbillingManifest, NETBILLING_ADAPTER_VERSION } from "./manifest.js";

export { netbillingManifest, NETBILLING_ADAPTER_VERSION };

export const NETBILLING_FORMATS = {
  direct3Response: "netbilling.direct3.response",
  direct3Exception: "netbilling.direct3.exception",
  paymentFormResponse: "netbilling.paymentform.response",
  memberUpdate: "netbilling.memberupdate.member",
  paymentFormRequest: "netbilling.paymentform.request",
  paymentFormEmulated: "netbilling.paymentform.emulated",
  direct21Response: "netbilling.direct21.response",
  batchStatus: "netbilling.directbatch.status",
} as const;

const opt = (max: number) => z.string().max(max).optional();

const Direct3Response = z.looseObject({
  status_code: z.string().min(1).max(8),
  trans_id: z.string().min(1).max(64),
  auth_code: opt(32),
  auth_date: opt(32),
  auth_msg: opt(500),
  avs_code: opt(8),
  cvv2_code: opt(8),
  ticket_code: opt(128),
  reason_code2: opt(128),
  member_id: opt(64),
  recurring_id: opt(64),
  settle_amount: opt(32),
  settle_currency: opt(8),
  processor: opt(64),
  card_flags: opt(8),
  "3ds_url": opt(4096),
  "3ds_creq": opt(20000),
});

const PaymentFormResponse = z.looseObject({
  Ecom_Ezic_Response_StatusCode: z.string().min(1).max(8),
  Ecom_Ezic_Response_TransactionID: opt(64),
  Ecom_Ezic_Response_AuthCode: opt(32),
  Ecom_Ezic_Response_AuthMessage: opt(500),
  Ecom_Ezic_Response_Card_AVSCode: opt(8),
  Ecom_Ezic_Response_Card_VerificationCode: opt(8),
  Ecom_Ezic_Response_IssueDate: opt(64),
  Ecom_Ezic_Response_StatusSubCode: opt(8),
  Ecom_Ezic_Payment_AuthorizationType: opt(16),
  Ecom_Ezic_ProofOfPurchase_MD5: opt(256),
  Ecom_Ezic_Membership_UserName: opt(256),
  Ecom_ConsumerOrderID: opt(64),
  Ecom_Cost_Total: opt(32),
});

const MemberUpdate = z.looseObject({
  M_MEMBER_STATUS: z.string().min(1).max(32),
  M_MEMBER_ID: opt(64),
  M_SIGNUP_TRANS_ID: opt(64),
  R_TEMPLATE_TRANS_ID: opt(64),
  R_RECURRING_SCHEDULE: opt(256),
});

export type NetbillingParsed =
  | { kind: "direct3_response"; value: z.infer<typeof Direct3Response> }
  | { kind: "direct3_exception"; status: number }
  | { kind: "payment_form_response"; value: z.infer<typeof PaymentFormResponse> }
  | { kind: "member_update"; value: z.infer<typeof MemberUpdate> };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Form data arrives as strings, or string arrays for repeated keys. */
function isFlatStrings(o: Record<string, unknown>): boolean {
  return Object.values(o).every(
    (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
  );
}

function formTransport(meta: RecordMeta | undefined): boolean {
  if (!meta) return true;
  if (meta.format === "form") return true;
  if (meta.format === "http") return !(meta.http?.contentType ?? "").includes("json");
  return false;
}

function exceptionStatus(meta: RecordMeta | undefined): number | undefined {
  const s =
    meta?.format === "http" && meta.http?.kind === "response" ? meta.http.status : undefined;
  return s !== undefined && s >= 600 && s <= 799 ? s : undefined;
}

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

/** Fields the research names as NETbilling-specific next to status_code and trans_id. */
const DIRECT3_STRONG = ["auth_msg", "auth_date", "ticket_code", "reason_code2", "settle_amount"];
const DIRECT3_OTHER = [
  "settle_currency",
  "processor",
  "3ds_url",
  "3ds_creq",
  "avs_code",
  "cvv2_code",
  "auth_code",
  "member_id",
  "recurring_id",
  "card_flags",
];
const AUTH_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
const MEMBER_UPDATE_IDS = [
  "M_MEMBER_ID",
  "M_SIGNUP_TRANS_ID",
  "R_TEMPLATE_TRANS_ID",
  "R_RECURRING_SCHEDULE",
];
const AUTHNET_FIELDS = ["x_response_code", "x_trans_id", "x_response_reason_text", "x_auth_code"];
const VERISIGN_FIELDS = ["RESULT", "PNREF", "RESPMSG", "AUTHCODE", "AVSDATA"];
const BATCH_FIELDS = ["total_records", "records_done", "approvals", "declines", "exceptions"];

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: "netbilling" };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  const status = exceptionStatus(meta);
  if (status !== undefined && Object.keys(input).length === 0) {
    // Non-standard 6xx/7xx statuses are how Direct Mode 3.2 reports exceptions.
    return {
      ...base,
      format: NETBILLING_FORMATS.direct3Exception,
      confidence: 0.6,
      supported: true,
      reasons: [`HTTP response status ${status} with an empty body, like a Direct Mode exception`],
    };
  }

  if (!formTransport(meta) || !isFlatStrings(input)) return none;
  const keys = Object.keys(input);
  const has = (k: string) => Object.hasOwn(input, k);
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : undefined);

  if (has("status_code")) {
    const strong = DIRECT3_STRONG.filter(has);
    const other = DIRECT3_OTHER.filter(has);
    if (has("trans_id") && strong.length >= 1) {
      let c = 0.6;
      const reasons = [`has status_code and trans_id with ${strong.join(", ")}`];
      if (/^[0-9A-Z]$/.test(s("status_code") ?? "")) {
        c += 0.1;
        reasons.push("status_code is a single character");
      }
      if (strong.length >= 2) c += 0.1;
      if (AUTH_DATE.test(s("auth_date") ?? "")) {
        c += 0.1;
        reasons.push("auth_date has the documented YYYY-MM-DD HH:MM:SS format");
      }
      if (other.length >= 1) c += 0.05;
      if (/^\d{12}$/.test(s("trans_id") ?? "")) c += 0.05;
      const msg = s("auth_msg");
      if (msg !== undefined && decodeAuthMessage(msg).entry !== undefined) {
        c += 0.05;
        reasons.push("auth_msg is a documented NETbilling message");
      }
      return {
        ...base,
        format: NETBILLING_FORMATS.direct3Response,
        confidence: round(c),
        supported: true,
        reasons,
      };
    }
    if (has("trans_id")) {
      return {
        ...base,
        format: NETBILLING_FORMATS.direct3Response,
        confidence: 0.3,
        supported: true,
        reasons: ["has status_code and trans_id only"],
        unsupportedReason:
          "status_code and trans_id alone are too generic to attribute the record to NETbilling. Select the provider manually if it is a NETbilling Direct Mode response.",
      };
    }
    if (strong.length >= 2) {
      return {
        ...base,
        format: NETBILLING_FORMATS.direct3Response,
        confidence: 0.55,
        supported: true,
        reasons: [`has status_code with ${strong.join(", ")} but no trans_id`],
      };
    }
  }

  const ezic = keys.filter((k) => k.startsWith("Ecom_Ezic_"));
  if (has("Ecom_Ezic_Response_StatusCode")) {
    let c = 0.75;
    const reasons = ["has Ecom_Ezic_Response_StatusCode"];
    if (has("Ecom_Ezic_Response_TransactionID")) {
      c += 0.1;
      reasons.push("has Ecom_Ezic_Response_TransactionID");
    }
    if (has("Ecom_Ezic_Response_AuthMessage")) c += 0.05;
    if (ezic.length >= 4) c += 0.05;
    return {
      ...base,
      format: NETBILLING_FORMATS.paymentFormResponse,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }
  if (ezic.length > 0) {
    const authnet = AUTHNET_FIELDS.filter(has).length >= 2;
    const verisign = VERISIGN_FIELDS.filter(has).length >= 2;
    if (authnet || verisign) {
      return {
        ...base,
        format: NETBILLING_FORMATS.paymentFormEmulated,
        confidence: 0.7,
        supported: false,
        reasons: [
          `has ${authnet ? "Authorize.Net-style x_*" : "Verisign-style"} response fields together with Ecom_Ezic_* fields`,
        ],
        unsupportedReason:
          "This looks like a NETbilling hosted form return in Authorize.Net or Verisign compatibility mode. NETbilling does not document how it encodes the values in these modes, so it is not analyzed.",
      };
    }
    return {
      ...base,
      format: NETBILLING_FORMATS.paymentFormRequest,
      confidence: 0.6,
      supported: false,
      reasons: ["has Ecom_Ezic_* fields but no Ecom_Ezic_Response_StatusCode"],
      unsupportedReason:
        "This looks like NETbilling hosted payment form request data, or a return whose field names were renamed in the Form Editor. Only returns and postbacks with the default Ecom_Ezic_Response_* names are analyzed.",
    };
  }

  if (has("M_MEMBER_STATUS")) {
    const ids = MEMBER_UPDATE_IDS.filter(has);
    if (ids.length >= 1) {
      let c = 0.7;
      const reasons = [`has M_MEMBER_STATUS with ${ids.join(", ")}`];
      if (lookup(MEMBER_STATUSES, s("M_MEMBER_STATUS")) !== undefined) {
        c += 0.1;
        reasons.push("M_MEMBER_STATUS is a documented member status");
      }
      c += Math.min(ids.length - 1, 2) * 0.05;
      return {
        ...base,
        format: NETBILLING_FORMATS.memberUpdate,
        confidence: round(c),
        supported: true,
        reasons,
      };
    }
    return {
      ...base,
      format: NETBILLING_FORMATS.memberUpdate,
      confidence: 0.4,
      supported: true,
      reasons: ["has M_MEMBER_STATUS only"],
      unsupportedReason:
        "M_MEMBER_STATUS without member identifiers is not enough to attribute the record to NETbilling.",
    };
  }

  if (has("RET_STATUS") && has("RET_TRANS_ID")) {
    return {
      ...base,
      format: NETBILLING_FORMATS.direct21Response,
      confidence: 0.8,
      supported: false,
      reasons: ["has RET_STATUS and RET_TRANS_ID like a Direct Mode 2.1 response"],
      unsupportedReason:
        "This looks like a legacy NETbilling Direct Mode 2.1 response. It is recognized but not analyzed; Direct Mode 3.2 is the documented version for new development.",
    };
  }

  if (BATCH_FIELDS.every(has) && (s("status") === "STARTING" || s("status") === "FINISHED")) {
    return {
      ...base,
      format: NETBILLING_FORMATS.batchStatus,
      confidence: 0.7,
      supported: false,
      reasons: ["has the documented Direct Mode Batch job status fields"],
      unsupportedReason:
        "This looks like a NETbilling Direct Mode Batch job status. It reports record counts, not individual transactions, and is not analyzed.",
    };
  }

  return none;
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
  meta?: RecordMeta,
): { ok: true; value: NetbillingParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected a set of form fields"] };
  if (format === NETBILLING_FORMATS.direct3Response) {
    const r = Direct3Response.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "direct3_response", value: r.data } };
  }
  if (format === NETBILLING_FORMATS.direct3Exception) {
    const status = exceptionStatus(meta);
    if (status === undefined)
      return { ok: false, issues: ["(root): expected an HTTP response with a 6xx or 7xx status"] };
    return { ok: true, value: { kind: "direct3_exception", status } };
  }
  if (format === NETBILLING_FORMATS.paymentFormResponse) {
    const r = PaymentFormResponse.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "payment_form_response", value: r.data } };
  }
  if (format === NETBILLING_FORMATS.memberUpdate) {
    const r = MemberUpdate.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "member_update", value: r.data } };
  }
  return { ok: false, issues: [`Unsupported NETbilling format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Authorization message decoding

export type AuthMessageDecoding = {
  /** Normalized message text (whitespace collapsed). */
  message: string;
  /** Catalog entry; undefined when the message is not documented. */
  entry: (CatalogEntry & { group?: AuthMessageGroup; informational?: boolean }) | undefined;
  /** Catalog key the message matched, if any. */
  matched?: string;
  confidence: Confidence;
  missing: string[];
  testMode: boolean;
  documentation: DocumentationLink[];
};

const UPPER_INDEX: ReadonlyMap<string, string> = new Map(
  [...Object.keys(AUTH_MESSAGES), ...Object.keys(EXTRA_AUTH_MESSAGES)].map((k) => [
    k.toUpperCase(),
    k,
  ]),
);

function catalogEntry(key: string): AuthMessageEntry | undefined {
  return lookup(AUTH_MESSAGES, key) ?? lookup(EXTRA_AUTH_MESSAGES, key);
}

const NOT_MACHINE_READABLE =
  "NETbilling documents auth_msg as processor specific and not intended to be machine readable; the text may change.";

/**
 * Decodes an `auth_msg` (or hosted form AuthMessage) by matching the whole
 * text. Trailing numbers are not decoded on their own because the documented
 * list reuses them with different meanings (19, 98, 02).
 */
export function decodeAuthMessage(raw: string): AuthMessageDecoding {
  const message = raw.trim().replace(/\s+/g, " ");
  const shown = safeText(message, 60) ?? "";
  const missing: string[] = [];
  const docs: DocumentationLink[] = [
    { title: "NETbilling Transaction Authorization Message Definitions", url: AUTH_MESSAGES_URL },
  ];
  const found = (key: string, extra: string[] = [], testMode = false): AuthMessageDecoding => {
    const e = catalogEntry(key)!;
    if (e.source !== AUTH_MESSAGES_URL)
      docs.push({ title: "NETbilling documentation", url: e.source });
    return {
      message,
      entry: e,
      matched: key,
      confidence: "possible",
      missing: [...extra, NOT_MACHINE_READABLE],
      testMode,
      documentation: docs,
    };
  };

  const alias = lookup(AUTH_MESSAGE_ALIASES, message);
  if (alias)
    return found(alias, [`"${shown}" is a spelling of ${alias} used on a NETbilling page.`]);
  if (catalogEntry(message)) return found(message, [], message.startsWith("TEST "));
  const ci = UPPER_INDEX.get(message.toUpperCase());
  if (ci) return found(ci, [`Matched the documented message "${ci}" ignoring letter case.`]);

  if (/^TEST /i.test(message)) {
    const rest = decodeAuthMessage(message.slice(5));
    docs.push({ title: "NETbilling Test Mode Responses", url: TEST_MODE_URL });
    return {
      ...rest,
      message,
      testMode: true,
      missing: [
        `The message starts with TEST (test mode); the rest of the text was matched${rest.matched ? ` as "${rest.matched}"` : ""}.`,
        ...rest.missing,
      ],
      documentation: [
        ...rest.documentation,
        { title: "NETbilling Test Mode Responses", url: TEST_MODE_URL },
      ],
    };
  }

  if (/^[A-Z?]\/(?:DECLINED|QUOTA EXCEEDED)$/i.test(message)) {
    docs.push({ title: "NETbilling NBCheck guide", url: ACH_GUIDE_URL });
    return {
      message,
      entry: PREFIXED_REJECTION,
      confidence: "possible",
      missing: [
        `The letter prefix of "${shown}" is not in the documented Fraud Defense or traffic limit lists, so the specific rule is unknown.`,
        NOT_MACHINE_READABLE,
      ],
      testMode: false,
      documentation: docs,
    };
  }

  missing.push(
    `"${shown}" is not in the NETbilling authorization message list known to PandaPayLens. NETbilling notes the list may not be immediately updated.`,
    NOT_MACHINE_READABLE,
  );
  return {
    message,
    entry: undefined,
    confidence: "insufficient",
    missing,
    testMode: false,
    documentation: docs,
  };
}

// ---------------------------------------------------------------------------
// Test mode

export type TestModeExpectation = {
  authResult?: "APPROVED" | "DECLINED";
  avs?: string;
  cvv2?: string;
  note?: string;
};

/**
 * Documented test-mode outcome for an amount: the tens digit of the whole
 * dollars drives approve/decline, the hundreds digit the AVS letter, the
 * thousands digit the CVV2 letter.
 */
export function testModeExpectation(amount: string | undefined): TestModeExpectation | undefined {
  const m = amount ? /^(\d{1,9})(?:\.\d{1,4})?$/.exec(amount.trim()) : null;
  if (!m) return undefined;
  const dollars = Number(m[1]);
  if (dollars >= 10000) {
    return {
      note: "For amounts over 10000 NETbilling says the last 4 digits determine the response, without further detail.",
    };
  }
  const digit = (place: number) => Math.floor(dollars / place) % 10;
  const out: TestModeExpectation = {
    authResult: digit(10) === 9 ? "DECLINED" : "APPROVED",
    avs: TEST_MODE_AVS[digit(100)]!,
  };
  // The documented thousands bands start at 1001, 2001, ...; whole thousands are unclear.
  if (dollars >= 1000 && dollars % 1000 === 0) {
    out.note =
      "The documented CVV2 bands start at 1001, 2001, ..., so the CVV2 result for a whole-thousand amount is unclear.";
  } else {
    out.cvv2 = TEST_MODE_CVV2[digit(1000)]!;
  }
  return out;
}

function testModeText(e: TestModeExpectation | undefined): string {
  const general =
    "In NETbilling test mode the result depends on the amount after the fraud screens (AVS/CVV2 filters and Fraud Defense still run): the tens digit of the whole-dollar amount decides approval (9 declines), the hundreds digit the AVS letter and the thousands digit the CVV2 letter.";
  if (!e) return general;
  const parts = [
    e.authResult ? `expected ${e.authResult}` : undefined,
    e.avs ? `AVS ${e.avs}` : undefined,
    e.cvv2 ? `CVV2 ${e.cvv2}` : undefined,
  ].filter(Boolean);
  return `${general}${parts.length ? ` For this amount the documented rules give: ${parts.join(", ")}.` : ""}${e.note ? ` ${e.note}` : ""}`;
}

// ---------------------------------------------------------------------------
// Normalization

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function attrs(values: Record<string, SafePrimitive | undefined>): Record<string, SafePrimitive> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Record<
    string,
    SafePrimitive
  >;
}

function authDate(value: string | undefined): string | undefined {
  const m = value ? AUTH_DATE.exec(value.trim()) : null;
  // Documented as GMT/UTC.
  return m ? toIsoTimestamp(`${m[1]}T${m[2]}Z`) : undefined;
}

function nonEmpty(v: string | undefined): string | undefined {
  return v !== undefined && v.trim() !== "" ? v : undefined;
}

const code = (v: string | undefined, max = 8) => safeText(v?.trim(), max);

function testModeAttributes(
  test: boolean,
  amount: string | undefined,
): Record<string, SafePrimitive | undefined> {
  if (!test) return {};
  const e = testModeExpectation(amount);
  return {
    testMode: true,
    testModeExpectedResult: e?.authResult,
    testModeExpectedAvs: e?.avs,
    testModeExpectedCvv2: e?.cvv2,
  };
}

function normalizeDirect3(
  r: z.infer<typeof Direct3Response>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const sc = r.status_code.trim();
  const info: StatusInfo | undefined = lookup(DIRECT3_STATUS_CODES, sc);
  const msg = nonEmpty(r.auth_msg);
  const decodedMsg = msg !== undefined ? decodeAuthMessage(msg) : undefined;
  const offlineRecord = decodedMsg?.matched === "OFFLINE RECORD";
  const challenge = sc === "T" && nonEmpty(r["3ds_url"]) !== undefined;

  let eventType = info?.eventType ?? "direct3.unknown_status";
  let stage: LifecycleStage = info?.stage ?? "payment";
  let outcome: Outcome = info?.outcome ?? "unknown";
  if (challenge) {
    // Documented: OFFLINE RECORD + 3ds_url means a 3DS2 challenge is pending
    // and nothing has been authorized yet.
    eventType = "direct3.3ds_challenge_pending";
    stage = "authentication";
    outcome = "pending";
  } else if (sc === "T" && offlineRecord) {
    eventType = "direct3.offline_record";
    outcome = "unknown";
  }

  const currency = upperCurrency(r.settle_currency);
  const tid = safeId(r.trans_id);
  const memberId = safeId(r.member_id, 64);
  const recurringId = safeId(r.recurring_id, 64);
  const ts = authDate(r.auth_date);
  const signup = Boolean(memberId || recurringId);
  const amountMinor = decimalToMinor(r.settle_amount, currency);

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: info !== undefined,
    stage,
    providerStatus: `status_code=${code(sc) ?? ""}`,
    paymentReference: tid,
    subscriptionReference: memberId ?? recurringId,
    // A Direct Mode response with member_id/recurring_id is the signup itself;
    // rebills are created by NETbilling and never come back on this socket.
    isRecurring: signup ? false : undefined,
    eventTimestamp: ts,
    amountMinor,
    currency: amountMinor !== undefined ? currency : undefined,
    outcome,
    attributes: attrs({
      statusCode: code(sc) ?? "",
      authMsg: safeText(msg, 100),
      authMsgGroup:
        decodedMsg?.entry && "group" in decodedMsg.entry ? decodedMsg.entry.group : undefined,
      authCode: safeId(r.auth_code, 16),
      avsCode: code(r.avs_code, 4),
      cvv2Code: code(r.cvv2_code, 4),
      reasonCode2: safeText(nonEmpty(r.reason_code2), 64),
      processor: safeText(nonEmpty(r.processor), 64),
      settleAmount:
        amountMinor === undefined && /^\d{1,12}(?:\.\d{1,4})?$/.test(r.settle_amount ?? "")
          ? r.settle_amount
          : undefined,
      prepaidCard: r.card_flags === "P" ? true : undefined,
      memberId,
      recurringId,
      membershipSignup: signup ? true : undefined,
      // Only presence: the URL and the CReq carry 3DS session data.
      threeDsChallenge: nonEmpty(r["3ds_url"]) !== undefined ? true : undefined,
      offlineRecord: offlineRecord ? true : undefined,
      authDateUnparsed: r.auth_date && !ts ? true : undefined,
      httpStatus: ctx.meta?.http?.status,
      ...testModeAttributes(Boolean(decodedMsg?.testMode), r.settle_amount),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function signatureClass(v: string | undefined): string {
  return v === undefined || v === "" ? "absent" : "present_not_verified";
}

function normalizePaymentForm(
  r: z.infer<typeof PaymentFormResponse>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const sc = r.Ecom_Ezic_Response_StatusCode.trim();
  const info = lookup(PAYMENT_FORM_STATUS_CODES, sc);
  const tid = safeId(r.Ecom_Ezic_Response_TransactionID);
  const msg = nonEmpty(r.Ecom_Ezic_Response_AuthMessage);
  const decodedMsg = msg !== undefined ? decodeAuthMessage(msg) : undefined;
  const signup = nonEmpty(r.Ecom_Ezic_Membership_UserName) !== undefined;
  const authType = r.Ecom_Ezic_Payment_AuthorizationType?.trim();
  const eventType = info
    ? signup
      ? "membership.signup"
      : info.eventType
    : "payment.unknown_status";

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: info !== undefined,
    stage: info?.stage ?? "payment",
    providerStatus: `Ecom_Ezic_Response_StatusCode=${code(sc) ?? ""}`,
    paymentReference: tid,
    merchantReference: safeId(nonEmpty(r.Ecom_ConsumerOrderID), 64),
    isRecurring: signup ? false : undefined,
    // NETbilling documents no event id; trans_id is unique per transaction and
    // the postback is sent once per processed transaction.
    deliveryKey: tid ? `${tid}|${code(sc) ?? ""}` : undefined,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      statusCode: code(sc) ?? "",
      authMsg: safeText(msg, 100),
      authCode: safeId(r.Ecom_Ezic_Response_AuthCode, 16),
      avsCode: code(r.Ecom_Ezic_Response_Card_AVSCode, 4),
      cvv2Code: code(r.Ecom_Ezic_Response_Card_VerificationCode, 4),
      authorizationType:
        authType === "SALE" || authType === "PREAUTH" ? authType : safeText(nonEmpty(authType), 16),
      issueDate: safeText(nonEmpty(r.Ecom_Ezic_Response_IssueDate), 32),
      membershipSignup: signup ? true : undefined,
      proofOfPurchaseHash: signatureClass(r.Ecom_Ezic_ProofOfPurchase_MD5),
      ...testModeAttributes(Boolean(decodedMsg?.testMode), r.Ecom_Cost_Total),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: NetbillingParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  if (parsed.kind === "direct3_response") return [normalizeDirect3(parsed.value, ctx)];
  if (parsed.kind === "payment_form_response") return [normalizePaymentForm(parsed.value, ctx)];
  if (parsed.kind === "direct3_exception") {
    const info = directExceptionInfo(parsed.status);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "direct3.exception",
        eventTypeKnown: true,
        stage: "error",
        providerStatus: `HTTP ${parsed.status}`,
        outcome: info?.outcome ?? "unknown",
        attributes: attrs({ httpStatus: parsed.status, exceptionRange: info?.range }),
        source,
        ...observed,
      }),
    ];
  }
  const m = parsed.value;
  const status = m.M_MEMBER_STATUS.trim();
  const info = lookup(MEMBER_STATUSES, status);
  const shown = safeText(status, 32) ?? "";
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: "member_update.member",
      eventTypeKnown: true,
      stage: "subscription",
      providerStatus: `M_MEMBER_STATUS=${shown}`,
      // The signup transaction is an explicit identifier of the membership's first payment.
      paymentReference: safeId(nonEmpty(m.M_SIGNUP_TRANS_ID), 64),
      subscriptionReference: safeId(nonEmpty(m.M_MEMBER_ID), 64),
      outcome: info?.outcome ?? "unknown",
      attributes: attrs({
        memberStatus: shown,
        memberStatusKnown: info !== undefined,
        templateTransId: safeId(nonEmpty(m.R_TEMPLATE_TRANS_ID), 64),
        recurringSchedulePresent: nonEmpty(m.R_RECURRING_SCHEDULE) !== undefined,
      }),
      source,
      ...observed,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Error decoding

type DraftOpts = {
  code: string;
  entry: CatalogEntry;
  confidence: Confidence;
  subCodes: Record<string, string>;
  missing: string[];
  documentation: DocumentationLink[];
  message?: string | undefined;
  transactionId?: string | undefined;
  outcomeKnown: boolean;
  extraExplanation?: string | undefined;
};

function draft(ctx: NormalizeContext, o: DraftOpts): DecodedErrorDraft {
  const providerMessage = safeText(o.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: o.code,
    subCodes: o.subCodes,
    category: o.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: o.extraExplanation
      ? `${o.entry.explanation} ${o.extraExplanation}`
      : o.entry.explanation,
    nextAction: o.entry.nextAction,
    retry: o.entry.retry,
    retryExplanation: o.entry.retryExplanation,
    confidence: o.confidence,
    documentation: o.documentation,
    missingInformation: o.transactionId
      ? o.missing
      : [...o.missing, "No transaction ID; the transaction cannot be looked up from this record."],
    ...(o.transactionId
      ? { paymentReference: o.transactionId, attemptReference: o.transactionId }
      : {}),
    outcomeKnown: o.outcomeKnown,
  };
}

const UNKNOWN_ENTRY: CatalogEntry = {
  meaning: "Unknown",
  category: "unknown",
  retry: "unknown",
  explanation: "PandaPayLens cannot decode this value.",
  nextAction: NEXT_ACTION.unknown,
  retryExplanation: RETRY_EXPLANATION.unknown,
};

/** A failed transaction (status 0, or F on the hosted form), decoded from its message. */
function failureFromMessage(
  ctx: NormalizeContext,
  field: string,
  statusCode: string,
  message: string | undefined,
  base: {
    transactionId: string | undefined;
    subCodes: Record<string, string>;
    missing: string[];
    documentation: DocumentationLink[];
    testAmount: string | undefined;
  },
): DecodedErrorDraft {
  const subCodes: Record<string, string> = { field, status_code: statusCode, ...base.subCodes };
  if (message === undefined) {
    return draft(ctx, {
      code: statusCode,
      entry: {
        ...UNKNOWN_ENTRY,
        explanation: "The transaction failed, but the record carries no authorization message.",
      },
      confidence: "insufficient",
      subCodes,
      missing: [
        `${field} is absent, so the reason for the failure is not visible.`,
        ...base.missing,
      ],
      documentation: base.documentation,
      transactionId: base.transactionId,
      outcomeKnown: true,
    });
  }
  const d = decodeAuthMessage(message);
  let entry: CatalogEntry = d.entry ?? {
    ...UNKNOWN_ENTRY,
    explanation: "The transaction failed with an authorization message PandaPayLens does not know.",
  };
  let confidence = d.confidence;
  const missing = [...d.missing, ...base.missing];
  if (d.entry && "informational" in d.entry && d.entry.informational) {
    entry = {
      ...UNKNOWN_ENTRY,
      explanation: `The transaction failed, but its authorization message is informational (${d.entry.meaning}) and does not explain the failure.`,
    };
    confidence = "insufficient";
  }
  if (d.entry && "group" in d.entry && d.entry.group) subCodes.group = d.entry.group;
  if (d.matched && d.entry && "group" in d.entry && d.entry.group === "bank") {
    // Shared name the rules use for an issuer answer.
    subCodes.decline_code = d.matched;
  }
  return draft(ctx, {
    code: safeText(d.message, 64) ?? statusCode,
    entry,
    confidence,
    subCodes,
    missing,
    documentation: [...base.documentation, ...d.documentation],
    message,
    transactionId: base.transactionId,
    // status_code 0 is a final answer: a decline is never an exception.
    outcomeKnown: true,
    extraExplanation: d.testMode ? testModeText(testModeExpectation(base.testAmount)) : undefined,
  });
}

const DUPLICATE_ENTRY = (approved: boolean): CatalogEntry => ({
  meaning: "Duplicate transaction",
  category: "duplicate_request",
  retry: "do_not_retry",
  explanation: approved
    ? "NETbilling detected a duplicate of a transaction that was already approved; the record carries the original transaction ID."
    : "NETbilling detected a duplicate transaction and returned the original transaction's trans_id. This response does not say whether the original was approved.",
  nextAction: NEXT_ACTION.duplicate_request,
  retryExplanation:
    "Resubmitting would be detected as a duplicate again. Check the original transaction instead.",
});

const SETTLEMENT_FAILURE_ENTRY: CatalogEntry = {
  meaning: "Settlement failure or returned NBCheck",
  category: "unknown",
  retry: "manual_review",
  explanation:
    "status_code F means either a settlement failure or a returned NBCheck (ACH) payment; NETbilling does not use it at authorization time. The response does not say which of the two applies.",
  nextAction:
    "Check the transaction in the NETbilling administration system or the reporting interface (trans_status_msg, return_code) to see whether settlement failed or the check was returned.",
  retryExplanation: RETRY_EXPLANATION.manual_review,
};

function unknownStatusDraft(
  ctx: NormalizeContext,
  field: string,
  sc: string,
  tid: string | undefined,
  documentation: DocumentationLink[],
  note: string,
): DecodedErrorDraft {
  const shown = code(sc) ?? "";
  return draft(ctx, {
    code: shown,
    entry: {
      ...UNKNOWN_ENTRY,
      explanation: `${field} "${shown}" is not a documented value.`,
    },
    confidence: "insufficient",
    subCodes: { field },
    missing: [note],
    documentation,
    transactionId: tid,
    outcomeKnown: false,
  });
}

function decodeErrors(parsed: NetbillingParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "direct3_response") {
    const r = parsed.value;
    const sc = r.status_code.trim();
    const tid = safeId(r.trans_id);
    const docs: DocumentationLink[] = [{ title: "NETbilling Direct Mode 3.2", url: DIRECT3_URL }];
    const reason = nonEmpty(r.reason_code2);
    const subCodes: Record<string, string> = {};
    const missing: string[] = [];
    if (reason) {
      subCodes.reason_code2 = safeText(reason, 64) ?? "";
      missing.push(
        "reason_code2 is a processor-specific decline code whose meaning is only shown in the NETbilling administration system.",
      );
    }
    if (sc === "0") {
      return [
        failureFromMessage(ctx, "auth_msg", "0", nonEmpty(r.auth_msg), {
          transactionId: tid,
          subCodes,
          missing,
          documentation: docs,
          testAmount: r.settle_amount,
        }),
      ];
    }
    if (sc === "F") {
      return [
        draft(ctx, {
          code: "F",
          entry: SETTLEMENT_FAILURE_ENTRY,
          confidence: "possible",
          subCodes: { field: "status_code", ...subCodes },
          missing,
          documentation: [...docs, { title: "NETbilling NBCheck guide", url: ACH_GUIDE_URL }],
          message: nonEmpty(r.auth_msg),
          transactionId: tid,
          outcomeKnown: true,
        }),
      ];
    }
    if (sc === "D") {
      return [
        draft(ctx, {
          code: "D",
          entry: DUPLICATE_ENTRY(false),
          confidence: "strong",
          subCodes: { field: "status_code" },
          missing: [
            "Whether the original transaction was approved is not stated in this response.",
          ],
          documentation: docs,
          message: nonEmpty(r.auth_msg),
          transactionId: tid,
          outcomeKnown: false,
        }),
      ];
    }
    if (lookup(DIRECT3_STATUS_CODES, sc) === undefined) {
      return [
        unknownStatusDraft(
          ctx,
          "status_code",
          sc,
          tid,
          docs,
          "NETbilling documents that any unexpected status code other than 0 and F should be interpreted as a successful transaction, for forward compatibility. PandaPayLens does not assume success for an undocumented value; check the transaction in the NETbilling administration system.",
        ),
      ];
    }
    return [];
  }

  if (parsed.kind === "payment_form_response") {
    const r = parsed.value;
    const sc = r.Ecom_Ezic_Response_StatusCode.trim();
    const tid = safeId(r.Ecom_Ezic_Response_TransactionID);
    const docs: DocumentationLink[] = [
      { title: "NETbilling Payment Form 2.2 (Appendix B)", url: PAYMENT_FORM_URL },
    ];
    const missing = [
      "Postback and return field names are configurable per payment form; this record uses the default names.",
    ];
    if (sc === "0" || sc === "F") {
      return [
        failureFromMessage(
          ctx,
          "Ecom_Ezic_Response_AuthMessage",
          sc,
          nonEmpty(r.Ecom_Ezic_Response_AuthMessage),
          {
            transactionId: tid,
            subCodes: {},
            missing,
            documentation: docs,
            testAmount: r.Ecom_Cost_Total,
          },
        ),
      ];
    }
    if (sc === "D") {
      return [
        draft(ctx, {
          code: "D",
          entry: DUPLICATE_ENTRY(true),
          confidence: "strong",
          subCodes: { field: "Ecom_Ezic_Response_StatusCode" },
          missing,
          documentation: docs,
          message: nonEmpty(r.Ecom_Ezic_Response_AuthMessage),
          transactionId: tid,
          outcomeKnown: true,
        }),
      ];
    }
    if (lookup(PAYMENT_FORM_STATUS_CODES, sc) === undefined) {
      return [
        unknownStatusDraft(
          ctx,
          "Ecom_Ezic_Response_StatusCode",
          sc,
          tid,
          docs,
          "The status code is not in the documented Payment Form 2.2 list.",
        ),
      ];
    }
    return [];
  }

  if (parsed.kind === "direct3_exception") {
    const info = directExceptionInfo(parsed.status);
    const docs: DocumentationLink[] = [
      { title: "NETbilling Direct Mode 3.2 exceptions", url: DIRECT3_URL },
    ];
    const missing = [
      "The HTTP reason phrase, which carries NETbilling's human-readable error text (and for 699/799 a 5-digit sub-code), is not available to the analysis.",
      "NETbilling does not publish the full list of exception codes and recommends against handling individual exceptions in code.",
    ];
    const entry: CatalogEntry = info ?? UNKNOWN_ENTRY;
    const retryExplanation =
      entry.retry === "retry_conditionally"
        ? "A processing exception does not say whether the transaction took effect. Before any new attempt, check the transaction (use a pre-assigned trans_id from getid3.2 and the reporting interface); never resend blindly."
        : entry.retryExplanation;
    return [
      draft(ctx, {
        code: String(parsed.status),
        entry: { ...entry, retryExplanation },
        confidence: parsed.status === 604 ? "strong" : "possible",
        subCodes: { httpStatus: String(parsed.status), ...(info ? { range: info.range } : {}) },
        missing,
        documentation: docs,
        transactionId: undefined,
        outcomeKnown: info?.outcome === "failure",
      }),
    ];
  }

  return [];
}

export const netbillingAdapter: ProviderAdapter<NetbillingParsed> = {
  id: "netbilling",
  displayName: "NETbilling",
  version: NETBILLING_ADAPTER_VERSION,
  manifest: netbillingManifest,
  supportedFormats: [
    {
      id: NETBILLING_FORMATS.direct3Response,
      description: "Direct Mode 3.2 response (URL-encoded status_code, trans_id, auth_msg)",
    },
    {
      id: NETBILLING_FORMATS.direct3Exception,
      description: "Direct Mode 3.2 exception (6xx/7xx HTTP status, empty body)",
    },
    {
      id: NETBILLING_FORMATS.paymentFormResponse,
      description:
        "Payment Form 2.2 return / postback with default Ecom_Ezic_Response_* names (experimental)",
    },
    {
      id: NETBILLING_FORMATS.memberUpdate,
      description: "Member Update 1.1 GET response (experimental)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // trans_id is the only explicit link: a duplicate (D) returns the original
    // trans_id, and Member Update names the signup transaction. member_id links
    // a membership's separate payments, so it is a subscription reference, not
    // a payment key. Merchant order references are never used.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default netbillingAdapter;
