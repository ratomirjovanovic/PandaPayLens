/**
 * Authorize.net adapter.
 *
 * Supported input families:
 * - `authorize_net.transaction_response`  Authorize.net API (JSON) createTransactionResponse:
 *                                         `transactionResponse` (responseCode 1-4, reason codes in
 *                                         `errors[]` / `messages[]`, AVS/CVV/CAVV) and the API-level
 *                                         `messages` (resultCode Ok/Error, I/E codes). Accepted
 *                                         unwrapped (as documented) or wrapped in
 *                                         `createTransactionResponse`.
 * - `authorize_net.api_messages`          Any API response that carries only the API-level
 *                                         `messages` object
 * - `authorize_net.webhook`               Webhook notification (`notificationId`, `eventType`
 *                                         `net.authorize.*`, `eventDate`, `webhookId`, `payload`)
 *
 * Recognized but not analyzed: getTransactionDetails responses, Webhooks REST
 * API notification history records and partner boarding webhooks.
 *
 * The API reports two result layers whose numbers overlap: responseCode 1-4
 * and the reason codes, where 1-4 also exist with other meanings. They are
 * decoded separately and never looked up in each other's table.
 */

import {
  lookup,
  safeId,
  safeText,
  toIsoTimestamp,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type ErrorCategory,
  type LifecycleStage,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type Outcome,
  type ProviderAdapter,
  type RecordMeta,
  type RetryGuidance,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ACCOUNT_TYPES,
  API_MESSAGE_CODES,
  API_REFERENCE_URL,
  AVS_CODES,
  AVS_NO_MATCH,
  BOARDING_EVENT_PREFIX,
  CAVV_CODES,
  CVV_CODES,
  ENTITY_NAMES,
  FAILED_VOID_REASON_CODES,
  FRAUD_ACTIONS,
  NEXT_ACTION,
  REASON_CODES,
  RESPONSE_CODES,
  RESPONSE_CODES_URL,
  RESULT_CODES,
  RETRY_EXPLANATION,
  TRANSACTION_REPORTING_URL,
  TRANSACTION_STATUSES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOKS_URL,
  type CodeEntry,
  type EventInfo,
} from "./catalog.js";
import { authorizeNetManifest, AUTHORIZE_NET_ADAPTER_VERSION } from "./manifest.js";

export { authorizeNetManifest, AUTHORIZE_NET_ADAPTER_VERSION };

const PROVIDER = "authorize_net";

export const AUTHORIZE_NET_FORMATS = {
  transaction: "authorize_net.transaction_response",
  api: "authorize_net.api_messages",
  webhook: "authorize_net.webhook",
  details: "authorize_net.transaction_details",
  history: "authorize_net.notification_history",
  boarding: "authorize_net.webhook.partner_boarding",
} as const;

// ---------------------------------------------------------------------------
// Schemas

const nopt = (max: number) => z.string().max(max).nullish();
// API responses use strings; webhook payloads use numbers for some values.
const Scalar = z.union([z.string().max(256), z.number()]);

const ApiMessage = z.looseObject({
  code: z.string().min(1).max(16),
  text: nopt(2000),
});

const ApiMessages = z.looseObject({
  resultCode: z.string().min(1).max(16),
  message: z.array(ApiMessage).max(100).nullish(),
});

const TxMessage = z.looseObject({ code: Scalar, description: nopt(2000) });
const TxError = z.looseObject({ errorCode: Scalar, errorText: nopt(2000) });

const TransactionResponse = z.looseObject({
  responseCode: Scalar,
  avsResultCode: nopt(8),
  cvvResultCode: nopt(8),
  cavvResultCode: nopt(8),
  transId: Scalar.nullish(),
  refTransID: Scalar.nullish(),
  accountType: nopt(64),
  entryMode: nopt(64),
  splitTenderId: Scalar.nullish(),
  networkTransId: nopt(255),
  messages: z.array(TxMessage).max(100).nullish(),
  errors: z.array(TxError).max(100).nullish(),
  prePaidCard: z
    .looseObject({ requestedAmount: Scalar.nullish(), approvedAmount: Scalar.nullish() })
    .nullish(),
  splitTenderPayments: z.array(z.unknown()).max(1000).nullish(),
  merchantAdvice: z.looseObject({ code: Scalar.nullish() }).nullish(),
});

const TransactionEnvelope = z.looseObject({
  transactionResponse: TransactionResponse,
  messages: ApiMessages.nullish(),
});

const ApiEnvelope = z.looseObject({ messages: ApiMessages });

const FraudItem = z.looseObject({ fraudFilter: nopt(256), fraudAction: nopt(64) });

const WebhookPayload = z.looseObject({
  entityName: nopt(64),
  id: Scalar.nullish(),
  responseCode: Scalar.nullish(),
  avsResponse: nopt(8),
  authAmount: Scalar.nullish(),
  merchantReferenceId: Scalar.nullish(),
  fraudList: z.array(FraudItem).max(100).nullish(),
});

const Webhook = z.looseObject({
  notificationId: z.string().min(1).max(128),
  eventType: z.string().min(1).max(256),
  eventDate: nopt(64),
  webhookId: nopt(128),
  payload: WebhookPayload,
});

type TxEnvelope = z.infer<typeof TransactionEnvelope>;
type ApiMessagesT = z.infer<typeof ApiMessages>;
type ApiMessageT = z.infer<typeof ApiMessage>;
type WebhookT = z.infer<typeof Webhook>;

export type AuthorizeNetParsed =
  | {
      kind: "transaction";
      value: TxEnvelope;
      /** The raw response object, for presence checks of fields that are never copied. */
      raw: Record<string, unknown>;
      wrapped: boolean;
    }
  | { kind: "api"; value: ApiMessagesT; raw: Record<string, unknown>; wrapped: boolean }
  | { kind: "webhook"; value: WebhookT; info: EventInfo | undefined };

// ---------------------------------------------------------------------------
// Helpers

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function scalarString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() === "" ? undefined : v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function idOf(v: unknown, max = 64): string | undefined {
  return safeId(scalarString(v), max);
}

/** A gateway transaction id. "0" is returned for errors and in test mode, so it is not an id. */
function transId(v: unknown): string | undefined {
  const id = idOf(v);
  return id !== undefined && /^\d{1,30}$/.test(id) && !/^0+$/.test(id) ? id : undefined;
}

const isZeroId = (v: unknown) => {
  const s = scalarString(v);
  return s !== undefined && /^0+$/.test(s);
};

const has = (o: Record<string, unknown>, k: string) => Object.hasOwn(o, k);
const present = (o: Record<string, unknown> | undefined, k: string) =>
  o !== undefined && has(o, k) && scalarString(o[k]) !== undefined;

const shortCode = (v: unknown, max = 4) => {
  const s = scalarString(v);
  return s !== undefined && new RegExp(`^[0-9A-Za-z]{1,${max}}$`).test(s) ? s : undefined;
};

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(scalarString(v), 64);
  return id && safeText(id, 64) === id ? id : undefined;
}

const DECIMAL = /^-?\d{1,15}(?:\.\d{1,4})?$/;
const decimalText = (v: unknown) => {
  const s = scalarString(v);
  return s !== undefined && DECIMAL.test(s) ? s : undefined;
};

const API_CODE = /^[IE]\d{5}$/;
const REASON_CODE = /^\d{1,4}$/;
const UNCERTAIN: ReadonlySet<ErrorCategory> = new Set([
  "provider_unavailable",
  "network_or_timeout",
  "unknown",
]);

const round = (n: number) => Math.round(n * 100) / 100;

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function attrs(
  values: Record<string, SafePrimitive | SafePrimitive[] | undefined>,
): Record<string, SafePrimitive | SafePrimitive[]> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)),
  ) as Record<string, SafePrimitive | SafePrimitive[]>;
}

// ---------------------------------------------------------------------------
// Detection

/** The JSON response has no root key; one wrapped in `createTransactionResponse` is also accepted. */
function unwrap(input: Record<string, unknown>): {
  body: Record<string, unknown>;
  wrapped: boolean;
} {
  const keys = Object.keys(input);
  if (keys.length === 1 && keys[0] === "createTransactionResponse") {
    const inner = input.createTransactionResponse;
    if (isObj(inner)) return { body: inner, wrapped: true };
  }
  return { body: input, wrapped: false };
}

/** messages: { resultCode: Ok|Error, message: [{ code: I/E + 5 digits }] } */
function apiMessagesShape(m: unknown): { codes: string[] } | null {
  if (!isObj(m) || (m.resultCode !== "Ok" && m.resultCode !== "Error")) return null;
  if (!Array.isArray(m.message) || m.message.length === 0) return null;
  const codes: string[] = [];
  for (const item of m.message) {
    if (!isObj(item) || typeof item.code !== "string" || !API_CODE.test(item.code)) return null;
    codes.push(item.code);
  }
  return { codes };
}

/** Field names of transactionResponse; refTransID with a capital ID is specific to responses. */
const TX_FIELDS = [
  "transId",
  "refTransID",
  "authCode",
  "avsResultCode",
  "cvvResultCode",
  "cavvResultCode",
  "accountNumber",
  "accountType",
  "transHashSha2",
  "testRequest",
  "networkTransId",
];

function detectTransaction(
  body: Record<string, unknown>,
  wrapped: boolean,
): DetectionResult | null {
  const tr = body.transactionResponse;
  if (!isObj(tr)) return null;
  const rc = scalarString(tr.responseCode);
  const rcKnown = rc !== undefined && lookup(RESPONSE_CODES, rc) !== undefined;
  const fields = TX_FIELDS.filter((k) => has(tr, k));
  const top = apiMessagesShape(body.messages);
  if (!rcKnown && fields.length < 2 && !top) return null;
  const reasons = ["has a transactionResponse object"];
  let c = 0.5;
  if (rcKnown) {
    c += 0.15;
    reasons.push(`transactionResponse.responseCode is the documented value ${rc}`);
  }
  if (fields.length >= 3) c += 0.1;
  else if (fields.length >= 1) c += 0.05;
  if (fields.length) reasons.push(`transactionResponse has ${fields.join(", ")}`);
  const errorShape =
    Array.isArray(tr.errors) &&
    tr.errors.length > 0 &&
    tr.errors.every((e) => isObj(e) && has(e, "errorCode"));
  const messageShape =
    Array.isArray(tr.messages) &&
    tr.messages.length > 0 &&
    tr.messages.every((m) => isObj(m) && has(m, "code"));
  if (errorShape || messageShape) {
    c += 0.1;
    reasons.push(errorShape ? "has errors[] with errorCode" : "has messages[] with code");
  }
  if (top) {
    c += 0.15;
    reasons.push("has the API-level messages object with resultCode and I/E message codes");
  }
  if (has(tr, "refTransID")) c += 0.05;
  if (wrapped) reasons.push("wrapped in createTransactionResponse");
  return {
    provider: PROVIDER,
    format: AUTHORIZE_NET_FORMATS.transaction,
    confidence: round(Math.min(c, 0.95)),
    supported: true,
    reasons,
  };
}

function detectApi(body: Record<string, unknown>, wrapped: boolean): DetectionResult | null {
  if (has(body, "transactionResponse")) return null;
  const top = apiMessagesShape(body.messages);
  if (!top) return null;
  const tx = body.transaction;
  if (
    isObj(tx) &&
    typeof tx.transactionStatus === "string" &&
    TRANSACTION_STATUSES.has(tx.transactionStatus)
  ) {
    return {
      provider: PROVIDER,
      format: AUTHORIZE_NET_FORMATS.details,
      confidence: 0.8,
      supported: false,
      reasons: [
        "has the API-level messages object and a transaction with a documented transactionStatus",
      ],
      unsupportedReason:
        "This looks like an Authorize.net getTransactionDetails response. Transaction details are recognized but not analyzed yet; createTransactionResponse and webhooks are.",
    };
  }
  let c = 0.6;
  const reasons = [
    "has the API-level messages object with resultCode Ok/Error and I/E message codes",
  ];
  if (top.codes.every((code) => lookup(API_MESSAGE_CODES, code) !== undefined)) {
    c += 0.15;
    reasons.push("all message codes are in the documented response code list");
  }
  if (wrapped) reasons.push("wrapped in createTransactionResponse");
  return {
    provider: PROVIDER,
    format: AUTHORIZE_NET_FORMATS.api,
    confidence: c,
    supported: true,
    reasons,
  };
}

const EVENT_NAMESPACE = "net.authorize.";

function detectWebhook(input: Record<string, unknown>): DetectionResult | null {
  const type = input.eventType;
  if (typeof type !== "string" || !type.startsWith(EVENT_NAMESPACE)) return null;
  if (
    typeof input.notificationId === "string" &&
    (input.deliveryStatus === "Delivered" || input.deliveryStatus === "Failed")
  ) {
    return {
      provider: PROVIDER,
      format: AUTHORIZE_NET_FORMATS.history,
      confidence: 0.75,
      supported: false,
      reasons: ["has notificationId, a net.authorize.* eventType and deliveryStatus"],
      unsupportedReason:
        "This looks like an Authorize.net notification history record from the Webhooks REST API. History records are recognized but not analyzed yet; paste the notification body itself.",
    };
  }
  if (!isObj(input.payload)) return null;
  const reasons = ["has a net.authorize.* eventType with a payload object"];
  let c = 0.55;
  const known = lookup(WEBHOOK_EVENT_TYPES, type) !== undefined;
  const boarding = type.startsWith(BOARDING_EVENT_PREFIX);
  if (known || boarding) {
    c += 0.25;
    reasons.push(`eventType "${type}" is a documented webhook event type`);
  }
  if (typeof input.notificationId === "string") c += 0.05;
  if (typeof input.webhookId === "string") c += 0.05;
  if (typeof input.eventDate === "string") c += 0.03;
  if (typeof input.payload.entityName === "string" && ENTITY_NAMES.has(input.payload.entityName)) {
    c += 0.05;
    reasons.push(`payload.entityName is ${input.payload.entityName}`);
  }
  const confidence = round(Math.min(c, 0.95));
  if (boarding) {
    return {
      provider: PROVIDER,
      format: AUTHORIZE_NET_FORMATS.boarding,
      confidence,
      supported: false,
      reasons,
      unsupportedReason:
        "This is an Authorize.net partner boarding webhook. Boarding events concern merchant onboarding, not payments, and are not analyzed.",
    };
  }
  return {
    provider: PROVIDER,
    format: AUTHORIZE_NET_FORMATS.webhook,
    confidence,
    supported: true,
    reasons,
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input) || meta?.format === "form") return none;
  const { body, wrapped } = unwrap(input);
  return (
    detectTransaction(body, wrapped) ?? detectApi(body, wrapped) ?? detectWebhook(input) ?? none
  );
}

// ---------------------------------------------------------------------------
// Parsing

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => `${prefix}${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: AuthorizeNetParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected an object"] };
  if (format === AUTHORIZE_NET_FORMATS.transaction || format === AUTHORIZE_NET_FORMATS.api) {
    const { body, wrapped } = unwrap(input);
    const prefix = wrapped ? "createTransactionResponse." : "";
    if (format === AUTHORIZE_NET_FORMATS.transaction) {
      const r = TransactionEnvelope.safeParse(body);
      if (!r.success) return { ok: false, issues: issuesOf(r.error, prefix) };
      return { ok: true, value: { kind: "transaction", value: r.data, raw: body, wrapped } };
    }
    const r = ApiEnvelope.safeParse(body);
    if (!r.success) return { ok: false, issues: issuesOf(r.error, prefix) };
    return { ok: true, value: { kind: "api", value: r.data.messages, raw: body, wrapped } };
  }
  if (format === AUTHORIZE_NET_FORMATS.webhook) {
    const r = Webhook.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return {
      ok: true,
      value: {
        kind: "webhook",
        value: r.data,
        info: lookup(WEBHOOK_EVENT_TYPES, r.data.eventType),
      },
    };
  }
  return { ok: false, issues: [`Unsupported Authorize.net format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Shared reading of the two result layers

type Reason = {
  code: string;
  text?: string | undefined;
  list: "errors" | "messages";
  index: number;
};

function reasonsOf(tr: TxEnvelope["transactionResponse"]): Reason[] {
  const out: Reason[] = [];
  (tr.errors ?? []).forEach((e, index) => {
    const code = scalarString(e.errorCode);
    if (code !== undefined)
      out.push({ code, text: e.errorText ?? undefined, list: "errors", index });
  });
  (tr.messages ?? []).forEach((m, index) => {
    const code = scalarString(m.code);
    if (code !== undefined)
      out.push({ code, text: m.description ?? undefined, list: "messages", index });
  });
  return out;
}

const reasonEntry = (code: string): CodeEntry | undefined =>
  REASON_CODE.test(code) ? lookup(REASON_CODES, code) : undefined;
const apiEntry = (code: string): CodeEntry | undefined =>
  API_CODE.test(code) ? lookup(API_MESSAGE_CODES, code) : undefined;
const shownCode = (code: string) => safeText(code, 16) ?? "?";

/** responseCode is read first; responseCode 3 depends on what the reason codes describe. */
export function transactionOutcome(
  responseCode: string | undefined,
  reasonCodes: string[],
): Outcome {
  if (responseCode === "1") return "success";
  if (responseCode === "2") return "failure";
  if (responseCode === "4") return "pending";
  if (responseCode !== "3") return "unknown";
  const entries = reasonCodes.map(reasonEntry);
  if (entries.length === 0 || entries.some((e) => e === undefined)) return "unknown";
  return entries.some((e) => e!.kind !== "error" || UNCERTAIN.has(e!.category))
    ? "unknown"
    : "failure";
}

function avsCvvAttrs(avs: string | undefined, cvv: string | undefined, cavv?: string) {
  return {
    avsResultCode: avs,
    avsMeaning: avs !== undefined ? lookup(AVS_CODES, avs) : undefined,
    cvvResultCode: cvv,
    cvvMeaning: cvv !== undefined ? lookup(CVV_CODES, cvv) : undefined,
    cavvResultCode: cavv,
    cavvMeaning: cavv !== undefined ? lookup(CAVV_CODES, cavv) : undefined,
  };
}

/** Notes that AVS/card code mismatches may matter, without claiming they caused the decline. */
function avsCvvNotes(avs: string | undefined, cvv: string | undefined): string[] {
  const out: string[] = [];
  if (cvv === "N")
    out.push(
      "The card code result is N (did not match). It may have contributed to the decline; the response does not say so.",
    );
  if (avs !== undefined && AVS_NO_MATCH.has(avs))
    out.push(
      `The AVS result is ${avs} (${lookup(AVS_CODES, avs)}). It may have contributed to the decline; the response does not say so.`,
    );
  return out;
}

function signatureHeader(meta: RecordMeta | undefined): string | undefined {
  if (meta?.format !== "http") return undefined;
  return meta.http?.headers["x-anet-signature"] !== undefined ? "present_not_verified" : "absent";
}

// ---------------------------------------------------------------------------
// Normalization

function references(tr: TxEnvelope["transactionResponse"]): {
  paymentReference?: string | undefined;
  relatedReference?: string | undefined;
  attempt?: string | undefined;
} {
  const tid = transId(tr.transId);
  const ref = transId(tr.refTransID);
  if (ref)
    return { paymentReference: ref, relatedReference: tid !== ref ? tid : undefined, attempt: tid };
  return { paymentReference: tid, attempt: tid };
}

function normalizeTransaction(
  p: Extract<AuthorizeNetParsed, { kind: "transaction" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const tr = p.value.transactionResponse;
  const rawTr = isObj(p.raw.transactionResponse) ? p.raw.transactionResponse : undefined;
  const rc = scalarString(tr.responseCode);
  const rcInfo = rc !== undefined ? lookup(RESPONSE_CODES, rc) : undefined;
  const reasons = reasonsOf(tr);
  const top = p.value.messages ?? undefined;
  const resultCode = top ? safeText(top.resultCode, 16) : undefined;
  const refs = references(tr);
  const tid = transId(tr.transId);

  let stage: LifecycleStage = transId(tr.refTransID) ? "other" : "payment";
  // A request rejected with an error and no transaction id never became a transaction.
  if (rc === "3" && tid === undefined) stage = "error";

  const avs = shortCode(tr.avsResultCode, 1);
  const cvv = shortCode(tr.cvvResultCode, 1);
  const cavv = shortCode(tr.cavvResultCode, 1);
  const accountType = scalarString(tr.accountType);
  const firstReason = reasons[0];
  const firstEntry = firstReason ? reasonEntry(firstReason.code) : undefined;

  return clean({
    sourceFormat: ctx.format,
    eventType: "createTransactionResponse",
    eventTypeKnown: rcInfo !== undefined,
    stage,
    providerStatus: `responseCode=${rc !== undefined ? shownCode(rc) : "?"}${resultCode ? ` resultCode=${resultCode}` : ""}`,
    paymentReference: refs.paymentReference,
    relatedReference: refs.relatedReference,
    merchantReference: merchantRef(p.raw.refId),
    outcome: transactionOutcome(
      rc,
      reasons.map((r) => r.code),
    ),
    attributes: attrs({
      responseCode: rc !== undefined ? shownCode(rc) : undefined,
      responseCodeMeaning: rcInfo?.meaning,
      responseCodeKnown: rc !== undefined ? rcInfo !== undefined : undefined,
      resultCode,
      apiMessageCodes: (top?.message ?? []).map((m) => shownCode(m.code)),
      reasonCodes: reasons.map((r) => shownCode(r.code)),
      reasonCodeMeaning: firstEntry?.meaning,
      reasonCodeKnown: firstReason ? firstEntry !== undefined : undefined,
      followUpOfEarlierTransaction: transId(tr.refTransID) ? true : undefined,
      transIdZero: isZeroId(tr.transId) ? true : undefined,
      authCodePresent: present(rawTr, "authCode") ? true : undefined,
      ...avsCvvAttrs(avs, cvv, cavv),
      accountType: accountType && ACCOUNT_TYPES.has(accountType) ? accountType : undefined,
      entryMode: safeText(scalarString(tr.entryMode), 32),
      splitTenderId: idOf(tr.splitTenderId),
      splitTenderPaymentCount: tr.splitTenderPayments?.length || undefined,
      prepaidRequestedAmount: decimalText(tr.prePaidCard?.requestedAmount),
      prepaidApprovedAmount: decimalText(tr.prePaidCard?.approvedAmount),
      networkTransIdPresent: present(rawTr, "networkTransId") ? true : undefined,
      merchantAdviceCode: shortCode(tr.merchantAdvice?.code, 4),
      responseHashPresent:
        present(rawTr, "transHashSha2") || present(rawTr, "transHash") ? true : undefined,
      wrapped: p.wrapped ? true : undefined,
      httpStatus: ctx.meta?.http?.status,
    }),
    source: { recordIndex: ctx.recordIndex, path: p.wrapped ? "createTransactionResponse" : "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function apiOutcome(m: ApiMessagesT): { stage: LifecycleStage; outcome: Outcome; empty: boolean } {
  const entries = (m.message ?? []).map((x) => apiEntry(x.code));
  if (m.resultCode === "Ok") return { stage: "other", outcome: "success", empty: false };
  if (m.resultCode !== "Error") return { stage: "other", outcome: "unknown", empty: false };
  if (entries.length > 0 && entries.every((e) => e?.kind === "empty"))
    return { stage: "other", outcome: "success", empty: true };
  const uncertain = entries.some(
    (e) => e === undefined || (e.kind === "error" && UNCERTAIN.has(e.category)),
  );
  return { stage: "error", outcome: uncertain ? "unknown" : "failure", empty: false };
}

function normalizeApi(
  p: Extract<AuthorizeNetParsed, { kind: "api" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const m = p.value;
  const resultCode = safeText(m.resultCode, 16);
  const { stage, outcome, empty } = apiOutcome(m);
  const codes = (m.message ?? []).map((x) => x.code);
  const first = codes[0] !== undefined ? apiEntry(codes[0]) : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: "apiResponse",
    eventTypeKnown: lookup(RESULT_CODES, m.resultCode) !== undefined,
    stage,
    providerStatus: `resultCode=${resultCode ?? "?"}`,
    merchantReference: merchantRef(p.raw.refId),
    outcome,
    attributes: attrs({
      resultCode,
      apiMessageCodes: codes.map(shownCode),
      apiMessageMeaning: first?.meaning,
      apiMessageCodeKnown: codes.length ? first !== undefined : undefined,
      emptyResult: empty ? true : undefined,
      wrapped: p.wrapped ? true : undefined,
      httpStatus: ctx.meta?.http?.status,
    }),
    source: { recordIndex: ctx.recordIndex, path: p.wrapped ? "createTransactionResponse" : "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

/** Payment webhooks: the payload's responseCode gives the outcome. */
function webhookPaymentOutcome(type: string, rc: string | undefined): Outcome {
  const outcome = rc !== undefined ? (lookup(RESPONSE_CODES, rc)?.outcome ?? "unknown") : "unknown";
  // An approved refund transaction settles in a later batch.
  if (outcome === "success" && type === "net.authorize.payment.refund.created") return "pending";
  return outcome;
}

function normalizeWebhook(
  p: Extract<AuthorizeNetParsed, { kind: "webhook" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const w = p.value;
  const pl = w.payload;
  const rawPayload = pl as Record<string, unknown>;
  const info = p.info;
  const eventType = safeText(w.eventType, 128) ?? "unknown";
  const notificationId = safeId(w.notificationId);
  const entity = scalarString(pl.entityName);
  const id = idOf(pl.id);
  const rc = scalarString(pl.responseCode);
  const family = info?.family;
  const isTransaction =
    entity === "transaction" ||
    ((family === "payment" || family === "fraud") && entity === undefined);
  const isSubscription =
    entity === "subscription" || (family === "subscription" && entity === undefined);
  const outcome: Outcome =
    info?.outcome ?? (family === "payment" ? webhookPaymentOutcome(w.eventType, rc) : "unknown");
  const avs = shortCode(pl.avsResponse, 1);
  const fraud = pl.fraudList ?? [];

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: info !== undefined,
    stage: info?.stage ?? "other",
    providerStatus: rc !== undefined ? `responseCode=${shownCode(rc)}` : undefined,
    eventReference: notificationId,
    deliveryKey: notificationId,
    eventTimestamp: toIsoTimestamp(w.eventDate ?? undefined),
    paymentReference: isTransaction ? (transId(id) ?? (isZeroId(id) ? undefined : id)) : undefined,
    subscriptionReference: isSubscription ? id : undefined,
    merchantReference: merchantRef(pl.merchantReferenceId),
    outcome,
    attributes: attrs({
      entityName: entity !== undefined && ENTITY_NAMES.has(entity) ? entity : safeText(entity, 32),
      responseCode: rc !== undefined ? shownCode(rc) : undefined,
      responseCodeMeaning: rc !== undefined ? lookup(RESPONSE_CODES, rc)?.meaning : undefined,
      responseCodeKnown: rc !== undefined ? lookup(RESPONSE_CODES, rc) !== undefined : undefined,
      authCodePresent: present(rawPayload, "authCode") ? true : undefined,
      ...avsCvvAttrs(avs, undefined),
      authAmount: decimalText(pl.authAmount),
      fraudFilters: fraud
        .map((f) => scalarString(f.fraudFilter))
        .filter((f): f is string => f !== undefined && /^[A-Za-z0-9 _-]{1,64}$/.test(f)),
      fraudActions: fraud
        .map((f) => scalarString(f.fraudAction))
        .filter((a): a is string => a !== undefined && lookup(FRAUD_ACTIONS, a) !== undefined),
      eventDate:
        w.eventDate && toIsoTimestamp(w.eventDate) === undefined
          ? safeText(w.eventDate, 40)
          : undefined,
      webhookSignature: signatureHeader(ctx.meta),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: AuthorizeNetParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "transaction") return [normalizeTransaction(parsed, ctx)];
  if (parsed.kind === "api") return [normalizeApi(parsed, ctx)];
  return [normalizeWebhook(parsed, ctx)];
}

// ---------------------------------------------------------------------------
// Error decoding

type Guidance = {
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  retryExplanation?: string;
};

type DraftOpts = {
  code: string;
  guidance: Guidance;
  confidence: Confidence;
  subCodes: Record<string, string>;
  missing: string[];
  documentation: DocumentationLink[];
  message?: string | null | undefined;
  paymentReference?: string | undefined;
  attempt?: string | undefined;
  outcomeKnown: boolean;
  path: string;
};

function draft(ctx: NormalizeContext, o: DraftOpts): DecodedErrorDraft {
  const providerMessage = safeText(o.message ?? undefined, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: o.path },
    code: o.code,
    subCodes: o.subCodes,
    category: o.guidance.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: o.guidance.explanation,
    nextAction: NEXT_ACTION[o.guidance.category],
    retry: o.guidance.retry,
    retryExplanation: o.guidance.retryExplanation ?? RETRY_EXPLANATION[o.guidance.retry],
    confidence: o.confidence,
    documentation: o.documentation,
    missingInformation: o.missing,
    ...(o.paymentReference ? { paymentReference: o.paymentReference } : {}),
    ...(o.attempt ? { attemptReference: o.attempt } : {}),
    outcomeKnown: o.outcomeKnown,
  };
}

const VERIFY_FIRST =
  "The response does not show whether the transaction was processed. Look it up with getTransactionDetails or in the Merchant Interface first; never resend blindly.";

const CODE_DOCS: DocumentationLink[] = [
  { title: "Authorize.net response code reference", url: RESPONSE_CODES_URL },
  { title: "Authorize.net API reference", url: API_REFERENCE_URL },
];

function entryGuidance(entry: CodeEntry, lead: string): Guidance {
  const parts = [lead];
  if (entry.caveat) parts.push(`Documentation conflict: ${entry.caveat}`);
  return {
    category: entry.category,
    retry: entry.retry,
    explanation: parts.join(" "),
    ...(entry.retry === "retry_conditionally" && UNCERTAIN.has(entry.category)
      ? { retryExplanation: `${RETRY_EXPLANATION.retry_conditionally} ${VERIFY_FIRST}` }
      : {}),
  };
}

/** Guidance for an undocumented reason code, from what responseCode alone says. */
function unknownReasonGuidance(code: string, rc: string | undefined): Guidance {
  const lead = `Reason code ${shownCode(code)} is not in Authorize.net's response code reference.`;
  if (rc === "2")
    return {
      category: "card_declined",
      retry: "manual_review",
      explanation: `${lead} responseCode 2 says the transaction was declined; the reason is unknown.`,
    };
  if (rc === "4")
    return {
      category: "fraud_or_risk",
      retry: "manual_review",
      explanation: `${lead} responseCode 4 says the transaction is held for review.`,
    };
  if (rc === "3")
    return {
      category: "unknown",
      retry: "retry_conditionally",
      explanation: `${lead} responseCode 3 reports an error; without a documented reason PandaPayLens cannot tell whether anything was processed.`,
      retryExplanation: VERIFY_FIRST,
    };
  return { category: "unknown", retry: "unknown", explanation: lead };
}

function decodeTransaction(
  p: Extract<AuthorizeNetParsed, { kind: "transaction" }>,
  ctx: NormalizeContext,
): DecodedErrorDraft[] {
  const tr = p.value.transactionResponse;
  const rc = scalarString(tr.responseCode);
  const rcShown = rc !== undefined ? shownCode(rc) : "?";
  const rcInfo = rc !== undefined ? lookup(RESPONSE_CODES, rc) : undefined;
  const reasons = reasonsOf(tr);
  const refs = references(tr);
  const avs = shortCode(tr.avsResultCode, 1);
  const cvv = shortCode(tr.cvvResultCode, 1);
  const top = p.value.messages ?? undefined;
  const base = p.wrapped ? "createTransactionResponse." : "";
  const out: DecodedErrorDraft[] = [];

  const commonMissing: string[] = [];
  if (!transId(tr.transId))
    commonMissing.push(
      isZeroId(tr.transId)
        ? "transId is 0, which Authorize.net returns for errors and in test mode; there is no transaction to look up."
        : "No transaction id; the transaction cannot be looked up from this record.",
    );
  const subCodes = (extra: Record<string, string>): Record<string, string> => {
    const s: Record<string, string> = { responseCode: rcShown };
    if (top) s.resultCode = safeText(top.resultCode, 16) ?? "?";
    if (avs) s.avsResultCode = avs;
    if (cvv) s.cvvResultCode = cvv;
    return { ...s, ...extra };
  };
  const refFields = { paymentReference: refs.paymentReference, attempt: refs.attempt };

  // Transaction layer: reason codes are read together with responseCode.
  const decodeReason = (r: Reason) => {
    const entry = reasonEntry(r.code);
    const shown = shownCode(r.code);
    const missing = [...commonMissing];
    const path = `${base}transactionResponse.${r.list}[${r.index}]`;
    const sc = subCodes({ reasonCode: shown });
    if (!entry) {
      out.push(
        draft(ctx, {
          ...refFields,
          code: shown,
          guidance: unknownReasonGuidance(r.code, rc),
          confidence: "insufficient",
          subCodes: sc,
          missing: [
            ...missing,
            `Reason code ${shown} is not documented, so the specific reason is unknown.`,
          ],
          documentation: CODE_DOCS,
          message: r.text,
          outcomeKnown: rc === "2",
          path,
        }),
      );
      return;
    }
    const pairing = `Returned with responseCode ${rcShown}${rcInfo ? ` (${rcInfo.meaning.toLowerCase()})` : ""}.`;
    if (entry.kind !== "error") {
      out.push(
        draft(ctx, {
          ...refFields,
          code: shown,
          guidance: {
            category: "unknown",
            retry: entry.retry === "unknown" ? "manual_review" : entry.retry,
            explanation: `Reason code ${shown} is documented as "${entry.meaning}", which is not an error. ${pairing}`,
          },
          confidence: "possible",
          subCodes: sc,
          missing: [
            ...missing,
            "The reason code does not explain why the transaction was not approved.",
          ],
          documentation: CODE_DOCS,
          message: r.text,
          outcomeKnown: rc === "2",
          path,
        }),
      );
      return;
    }
    let lead = `Reason code ${shown}: ${entry.meaning}. ${pairing}`;
    if (FAILED_VOID_REASON_CODES.has(r.code))
      lead +=
        " The automatic void after the rejection also failed, so an authorization hold may remain on the card.";
    if (rc === "2" || entry.category === "card_declined") missing.push(...avsCvvNotes(avs, cvv));
    out.push(
      draft(ctx, {
        ...refFields,
        code: shown,
        guidance: entryGuidance(entry, lead),
        confidence: entry.caveat ? "possible" : "strong",
        subCodes: sc,
        missing,
        documentation: CODE_DOCS,
        message: r.text,
        outcomeKnown: rc === "1" || rc === "2" || (rc === "3" && !UNCERTAIN.has(entry.category)),
        path,
      }),
    );
  };

  for (const r of reasons) {
    const entry = reasonEntry(r.code);
    // On approval, messages[] carries the approval reason; only errors matter.
    if (rc === "1" && r.list === "messages" && (entry === undefined || entry.kind !== "error"))
      continue;
    if (rc !== "1" && r.list === "messages" && entry?.kind === "success") continue;
    decodeReason(r);
  }

  const decodedReason = out.length > 0;
  if (!decodedReason && rc !== "1") {
    const path = `${base}transactionResponse.responseCode`;
    if (rcInfo?.fallback) {
      out.push(
        draft(ctx, {
          ...refFields,
          code: `responseCode=${rcShown}`,
          guidance: {
            category: rcInfo.fallback.category,
            retry: rcInfo.fallback.retry,
            explanation: `responseCode ${rcShown} means ${rcInfo.meaning.toLowerCase()}. The response carries no reason code, so the specific reason is unknown.`,
            ...(rc === "3" ? { retryExplanation: VERIFY_FIRST } : {}),
          },
          confidence: "possible",
          subCodes: subCodes({}),
          missing: [
            ...commonMissing,
            "No reason code in transactionResponse.errors or messages.",
            ...(rc === "2" ? avsCvvNotes(avs, cvv) : []),
          ],
          documentation: CODE_DOCS,
          outcomeKnown: rc === "2",
          path,
        }),
      );
    } else {
      out.push(
        draft(ctx, {
          ...refFields,
          code: `responseCode=${rcShown}`,
          guidance: {
            category: "unknown",
            retry: "unknown",
            explanation: `responseCode "${rcShown}" is not one of the documented values 1 (approved), 2 (declined), 3 (error) and 4 (held for review).`,
          },
          confidence: "insufficient",
          subCodes: subCodes({}),
          missing: [
            ...commonMissing,
            "The responseCode is not documented, so the outcome is unknown.",
          ],
          documentation: CODE_DOCS,
          outcomeKnown: false,
          path,
        }),
      );
    }
  }

  // API layer: E00027 only points at the transaction layer, which is decoded above.
  const hasTransactionLayer = reasons.length > 0 || rcInfo !== undefined;
  (top?.message ?? []).forEach((m, i) => {
    if (m.code === "E00027" && hasTransactionLayer) return;
    const d = decodeApiMessage(m, `${base}messages.message[${i}]`, ctx, {
      responseCode: rcShown,
      ...refFields,
    });
    if (d) out.push(d);
  });
  return out;
}

function decodeApiMessage(
  m: ApiMessageT,
  path: string,
  ctx: NormalizeContext,
  extra: {
    responseCode?: string;
    paymentReference?: string | undefined;
    attempt?: string | undefined;
  } = {},
): DecodedErrorDraft | null {
  const code = m.code;
  const shown = shownCode(code);
  const entry = apiEntry(code);
  const subCodes: Record<string, string> = { messageCode: shown };
  if (extra.responseCode) subCodes.responseCode = extra.responseCode;
  const refs = { paymentReference: extra.paymentReference, attempt: extra.attempt };
  if (!entry) {
    // Unknown I codes are informational by their prefix.
    if (code.startsWith("I")) return null;
    return draft(ctx, {
      ...refs,
      code: shown,
      guidance: {
        category: "unknown",
        retry: "unknown",
        explanation: `API message code ${shown} is not in Authorize.net's response code reference.`,
      },
      confidence: "insufficient",
      subCodes,
      missing: ["The message code is not documented, so its meaning is unknown."],
      documentation: CODE_DOCS,
      message: m.text,
      outcomeKnown: false,
      path,
    });
  }
  if (entry.kind === "see_reason") {
    return draft(ctx, {
      ...refs,
      code: shown,
      guidance: {
        category: "unknown",
        retry: "manual_review",
        explanation: `${shown}: ${entry.meaning}. The transaction-level details are not in this record, so the reason is unknown; the message text, if any, may say more.`,
      },
      confidence: "possible",
      subCodes,
      missing: [
        "No transactionResponse with a reason code.",
        ...(entry.caveat ? [`Documentation conflict: ${entry.caveat}`] : []),
      ],
      documentation: CODE_DOCS,
      message: m.text,
      outcomeKnown: false,
      path,
    });
  }
  if (entry.kind !== "error") return null;
  return draft(ctx, {
    ...refs,
    code: shown,
    guidance: entryGuidance(entry, `API message ${shown}: ${entry.meaning}.`),
    confidence: entry.caveat ? "possible" : "strong",
    subCodes,
    missing: [],
    documentation: CODE_DOCS,
    message: m.text,
    outcomeKnown: !UNCERTAIN.has(entry.category),
    path,
  });
}

function decodeApi(
  p: Extract<AuthorizeNetParsed, { kind: "api" }>,
  ctx: NormalizeContext,
): DecodedErrorDraft[] {
  const base = p.wrapped ? "createTransactionResponse." : "";
  const out: DecodedErrorDraft[] = [];
  (p.value.message ?? []).forEach((m, i) => {
    const d = decodeApiMessage(m, `${base}messages.message[${i}]`, ctx);
    if (d) out.push(d);
  });
  if (out.length === 0 && p.value.resultCode === "Error" && !apiOutcome(p.value).empty) {
    out.push(
      draft(ctx, {
        code: "resultCode=Error",
        guidance: {
          category: "unknown",
          retry: "unknown",
          explanation: "messages.resultCode is Error, but no documented error code explains it.",
        },
        confidence: "insufficient",
        subCodes: { resultCode: "Error" },
        missing: ["No documented E code in messages.message."],
        documentation: CODE_DOCS,
        outcomeKnown: false,
        path: `${base}messages`,
      }),
    );
  }
  return out;
}

const NO_REASON_IN_WEBHOOK =
  "Webhook payloads carry no reason code. Call getTransactionDetails for the reason and the current status.";

function decodeWebhook(
  p: Extract<AuthorizeNetParsed, { kind: "webhook" }>,
  ctx: NormalizeContext,
): DecodedErrorDraft[] {
  const w = p.value;
  const family = p.info?.family;
  if (family !== "payment" && family !== "fraud") return [];
  const eventType = safeText(w.eventType, 128) ?? "unknown";
  const rc = scalarString(w.payload.responseCode);
  const rcShown = rc !== undefined ? shownCode(rc) : undefined;
  const id = transId(w.payload.id);
  const avs = shortCode(w.payload.avsResponse, 1);
  const docs: DocumentationLink[] = [
    { title: "Authorize.net webhooks", url: WEBHOOKS_URL },
    { title: "Authorize.net transaction reporting", url: TRANSACTION_REPORTING_URL },
  ];
  const subCodes: Record<string, string> = { eventType };
  if (rcShown) subCodes.responseCode = rcShown;
  if (avs) subCodes.avsResponse = avs;
  const common = {
    subCodes,
    documentation: docs,
    paymentReference: id,
    attempt: id,
    path: "payload",
  };

  if (w.eventType === "net.authorize.payment.fraud.declined") {
    return [
      draft(ctx, {
        ...common,
        code: eventType,
        guidance: {
          category: "fraud_or_risk",
          retry: "do_not_retry",
          explanation:
            "A transaction held by a fraud filter was declined after review. The event does not say which filter or who declined it.",
        },
        confidence: "possible",
        missing: [NO_REASON_IN_WEBHOOK],
        outcomeKnown: true,
      }),
    ];
  }
  if (family !== "payment" || rc === undefined || rc === "1") return [];
  const info = lookup(RESPONSE_CODES, rc);
  if (info?.fallback) {
    return [
      draft(ctx, {
        ...common,
        code: `responseCode=${rcShown}`,
        guidance: {
          category: info.fallback.category,
          retry: info.fallback.retry,
          explanation: `The ${eventType} event reports responseCode ${rcShown} (${info.meaning.toLowerCase()}). The specific reason is not in the webhook.`,
          ...(rc === "3" ? { retryExplanation: VERIFY_FIRST } : {}),
        },
        confidence: "possible",
        missing: [NO_REASON_IN_WEBHOOK, ...(rc === "2" ? avsCvvNotes(avs, undefined) : [])],
        outcomeKnown: rc === "2",
      }),
    ];
  }
  return [
    draft(ctx, {
      ...common,
      code: `responseCode=${rcShown}`,
      guidance: {
        category: "unknown",
        retry: "unknown",
        explanation: `The ${eventType} event reports responseCode ${rcShown}, which is not one of the documented values 1-4.`,
      },
      confidence: "insufficient",
      missing: [
        "The responseCode is not documented, so the outcome is unknown.",
        NO_REASON_IN_WEBHOOK,
      ],
      outcomeKnown: false,
    }),
  ];
}

function decodeErrors(parsed: AuthorizeNetParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "transaction") return decodeTransaction(parsed, ctx);
  if (parsed.kind === "api") return decodeApi(parsed, ctx);
  return decodeWebhook(parsed, ctx);
}

export const authorizeNetAdapter: ProviderAdapter<AuthorizeNetParsed> = {
  id: PROVIDER,
  displayName: "Authorize.net",
  version: AUTHORIZE_NET_ADAPTER_VERSION,
  manifest: authorizeNetManifest,
  supportedFormats: [
    {
      id: AUTHORIZE_NET_FORMATS.transaction,
      description:
        "Authorize.net API (JSON) createTransactionResponse (transactionResponse with responseCode and reason codes, plus messages)",
    },
    {
      id: AUTHORIZE_NET_FORMATS.api,
      description: "Authorize.net API (JSON) response with only messages (resultCode, I/E codes)",
    },
    {
      id: AUTHORIZE_NET_FORMATS.webhook,
      description: "Webhook notification (notificationId, eventType net.authorize.*, payload)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // transId and refTransID are the only explicit links: captures and voids
    // keep the original id, refunds get a new id with refTransID pointing to
    // the original. refId / merchantReferenceId are optional merchant values
    // and subscription ids link separate payments, so neither is a key.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default authorizeNetAdapter;
