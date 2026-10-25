/**
 * NMI adapter.
 *
 * Supported input families:
 * - `nmi.classic.response`  Classic Payment API (transact.php, Direct Post) response: a
 *                           URL-encoded query string (`response`, `responsetext`, `authcode`,
 *                           `transactionid`, `avsresponse`, `cvvresponse`, `orderid`, `type`,
 *                           `response_code`) that reaches the adapter as a flat object of strings
 * - `nmi.webhook`           Merchant webhook JSON (`event_id`, `event_type`, `event_body`)
 *
 * Recognized but not analyzed: REST API v5 transactions and errors, and
 * Merchant Sign-Up (partner) webhooks.
 *
 * NMI is white-labelled by many resellers and Classic responses carry no
 * provider marker, so detection names the format ("NMI format"), never a
 * reseller, and stays below certainty.
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
  AVS_CODES,
  AVS_NO_MATCH,
  CHECK_STATUS_URL,
  CONDITIONS,
  CVV_CODES,
  NEXT_ACTION,
  RESPONSE_CODES,
  RESPONSE_CODES_URL,
  RESPONSE_VALUES,
  REST_ERROR_TYPES,
  RETRY_EXPLANATION,
  SETTLEMENT_EVENTS_URL,
  TRANSACTION_EVENTS_URL,
  TRANSACTION_TYPES,
  TRANSACTIONS_URL,
  WEBHOOK_EVENT_TYPES,
  type CatalogEntry,
  type CodeClass,
  type EventFamily,
  type EventTypeInfo,
  type ResponseCodeInfo,
} from "./catalog.js";
import { nmiManifest, NMI_ADAPTER_VERSION } from "./manifest.js";

export { nmiManifest, NMI_ADAPTER_VERSION };

const PROVIDER = "nmi";

export const NMI_FORMATS = {
  classic: "nmi.classic.response",
  webhook: "nmi.webhook",
  restTransaction: "nmi.rest.transaction",
  restError: "nmi.rest.error",
  partnerWebhook: "nmi.webhook.partner",
} as const;

// ---------------------------------------------------------------------------
// Schemas

const opt = (max: number) => z.string().max(max).optional();
const nopt = (max: number) => z.string().max(max).nullish();
// Webhook samples render some values as numbers and others as strings.
const Scalar = z.union([z.string().max(256), z.number()]);

const ClassicResponse = z.looseObject({
  response: z.string().min(1).max(8),
  responsetext: opt(1000),
  authcode: opt(64),
  transactionid: opt(64),
  avsresponse: opt(8),
  cvvresponse: opt(8),
  orderid: opt(256),
  type: opt(64),
  response_code: opt(8),
  merchant_advice_code: opt(16),
  kount_score: opt(16),
  amount_authorized: opt(32),
  partial_payment_id: opt(64),
  partial_payment_balance: opt(32),
  subscription_id: opt(64),
  invoice_id: opt(64),
  customer_vault_id: opt(256),
});

const Action = z.looseObject({
  amount: Scalar.nullish(),
  action_type: nopt(64),
  date: Scalar.nullish(),
  success: z.union([z.string().max(8), z.number(), z.boolean()]).nullish(),
  source: nopt(64),
  api_method: nopt(64),
  response_text: nopt(1000),
  response_code: Scalar.nullish(),
  processor_response_code: Scalar.nullish(),
  processor_response_text: nopt(1000),
});

const Features = z.looseObject({
  is_test_mode: z.union([z.boolean(), z.string().max(8), z.number()]).nullish(),
});

const Merchant = z.looseObject({ id: Scalar.nullish() });

const TransactionBody = z.looseObject({
  transaction_id: z.union([z.string().min(1).max(64), z.number().int()]),
  transaction_type: nopt(16),
  condition: nopt(32),
  processor_id: nopt(128),
  order_id: nopt(256),
  requested_amount: Scalar.nullish(),
  currency: nopt(8),
  authorization_code: nopt(64),
  features: Features.nullish(),
  merchant: Merchant.nullish(),
  card: z
    .looseObject({
      avs_response: nopt(8),
      csc_response: nopt(8),
      entry_mode: nopt(64),
      cc_type: nopt(32),
    })
    .nullish(),
  action: Action.nullish(),
});

const SettlementBody = z.looseObject({
  batch_id: Scalar.nullish(),
  processor_batch_id: Scalar.nullish(),
  transaction_ids: z.array(Scalar).max(100_000).nullish(),
  features: Features.nullish(),
  merchant: Merchant.nullish(),
});

const ChargebackBody = z.looseObject({
  chargebacks: z
    .array(
      z.looseObject({
        id: Scalar.nullish(),
        date: Scalar.nullish(),
        amount: Scalar.nullish(),
        reason: nopt(1000),
      }),
    )
    .max(100_000)
    .nullish(),
  features: Features.nullish(),
  merchant: Merchant.nullish(),
});

const RecurringBody = z.looseObject({
  subscription_id: Scalar.nullish(),
  features: Features.nullish(),
  merchant: Merchant.nullish(),
});

const GenericBody = z.looseObject({
  features: Features.nullish(),
  merchant: Merchant.nullish(),
});

const Webhook = z.looseObject({
  event_id: z.string().min(1).max(128),
  event_type: z.string().min(1).max(128),
  event_body: z.looseObject({}),
});

type Classic = z.infer<typeof ClassicResponse>;
type TxBody = z.infer<typeof TransactionBody>;

type WebhookBody =
  | { family: "transaction" | "check"; value: TxBody }
  | { family: "settlement"; value: z.infer<typeof SettlementBody> }
  | { family: "chargeback"; value: z.infer<typeof ChargebackBody> }
  | { family: "recurring"; value: z.infer<typeof RecurringBody> }
  | { family: "acu" | "other"; value: z.infer<typeof GenericBody> };

export type NmiParsed =
  | { kind: "classic"; value: Classic }
  | {
      kind: "webhook";
      eventId: string;
      eventType: string;
      info: EventTypeInfo | undefined;
      body: WebhookBody;
    };

// ---------------------------------------------------------------------------
// Helpers

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

/**
 * A form value; a key repeated with identical values counts once. NMI's own
 * partial-payment example repeats response_code.
 */
function single(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0 && v.every((x) => x === v[0]) && typeof v[0] === "string")
    return v[0];
  return undefined;
}

function scalarString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() === "" ? undefined : v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function idOf(v: unknown, max = 64): string | undefined {
  return safeId(scalarString(v), max);
}

/** A documented-shape 3-digit response_code, from a string or a number. */
function code3(v: unknown): string | undefined {
  const s = scalarString(v);
  return s !== undefined && /^\d{3}$/.test(s) ? s : undefined;
}

function nonEmpty(v: string | null | undefined): string | undefined {
  return v !== undefined && v !== null && v.trim() !== "" ? v.trim() : undefined;
}

const shortCode = (v: string | null | undefined, max = 4) => {
  const s = nonEmpty(v);
  return s !== undefined && new RegExp(`^[0-9A-Za-z]{1,${max}}$`).test(s) ? s : undefined;
};

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(scalarString(v), 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

const DECIMAL = /^-?\d{1,15}(?:\.\d{1,4})?$/;
const decimalText = (v: unknown) => {
  const s = scalarString(v);
  return s !== undefined && DECIMAL.test(s) ? s : undefined;
};

const REFID = /REFID:([0-9A-Za-z]{1,32})/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOTTED_TYPE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/;

/** YYYYMMDDhhmmss, documented as UTC for the Query API. */
function nmiDate(v: unknown): string | undefined {
  const s = scalarString(v);
  const m = s ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s) : null;
  return m ? toIsoTimestamp(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : undefined;
}

function successFlag(v: unknown): boolean | undefined {
  if (v === true || v === 1 || v === "1") return true;
  if (v === false || v === 0 || v === "0") return false;
  return undefined;
}

function testModeFlag(v: unknown): boolean | undefined {
  if (v === true || v === 1 || v === "1" || v === "true") return true;
  if (v === false || v === 0 || v === "0" || v === "false") return false;
  return undefined;
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Detection

const CLASSIC_FIELDS = [
  "response",
  "responsetext",
  "authcode",
  "transactionid",
  "avsresponse",
  "cvvresponse",
  "orderid",
  "type",
  "response_code",
];
/** Lowercase, separator-free names the research lists as NMI signals. */
const CLASSIC_DISTINCTIVE = ["responsetext", "avsresponse", "cvvresponse"];
/** The research notes that an NMI query string never has these (payabl. does). */
const FOREIGN_FIELDS = ["transid", "status", "errormessage"];
/** Classic responses carry no provider marker; never claim certainty. */
const CLASSIC_MAX = 0.9;

const WHITE_LABEL_REASON =
  "NMI-format gateway response; white-label resellers emit the same format under their own brands";

function detectClassic(input: Record<string, unknown>): DetectionResult | null {
  const has = (k: string) => Object.hasOwn(input, k);
  if (FOREIGN_FIELDS.some(has)) return null;
  const distinct = CLASSIC_DISTINCTIVE.filter(has);
  const standard = CLASSIC_FIELDS.filter(has).length;
  const response = single(input.response)?.trim();
  const code = single(input.response_code)?.trim();
  const responseKnown = response !== undefined && lookup(RESPONSE_VALUES, response) !== undefined;
  const codeOk = code !== undefined && /^\d{3}$/.test(code);
  const base = { provider: PROVIDER, format: NMI_FORMATS.classic, supported: true };

  if (responseKnown && codeOk && distinct.length >= 1) {
    let c = 0.6;
    const reasons = [
      `has response=${response} and a 3-digit response_code with ${distinct.join(", ")}`,
      WHITE_LABEL_REASON,
    ];
    if (lookup(RESPONSE_CODES, code) !== undefined) {
      c += 0.1;
      reasons.push("response_code is in the documented Result Code Table");
    }
    if (standard === CLASSIC_FIELDS.length) {
      c += 0.1;
      reasons.push("has all nine standard Classic response fields");
    } else if (standard >= 6) {
      c += 0.05;
    }
    const type = single(input.type);
    if (type !== undefined && (type === "" || lookup(TRANSACTION_TYPES, type) !== undefined)) {
      c += 0.05;
    }
    if (REFID.test(single(input.responsetext) ?? "")) {
      c += 0.05;
      reasons.push("responsetext carries a REFID reference");
    }
    return { ...base, confidence: round(Math.min(c, CLASSIC_MAX)), reasons };
  }
  if (codeOk && distinct.length >= 2) {
    return {
      ...base,
      confidence: 0.55,
      reasons: [
        `has a 3-digit response_code with ${distinct.join(", ")} but no documented response value`,
        WHITE_LABEL_REASON,
      ],
    };
  }
  if (responseKnown && distinct.length >= 2) {
    return {
      ...base,
      confidence: 0.55,
      reasons: [
        `has response=${response} with ${distinct.join(", ")} but no 3-digit response_code`,
        WHITE_LABEL_REASON,
      ],
    };
  }
  if (responseKnown && codeOk) {
    return {
      ...base,
      confidence: 0.3,
      reasons: ["has response and response_code only"],
      unsupportedReason:
        "response and response_code alone are too generic to attribute the record to the NMI format. Select the provider manually if it is an NMI (or NMI-based reseller) Payment API response.",
    };
  }
  return null;
}

function detectWebhook(input: Record<string, unknown>): DetectionResult | null {
  const type = input.event_type;
  if (typeof type !== "string" || typeof input.event_id !== "string") return null;
  if (!isObj(input.event_body) || !DOTTED_TYPE.test(type)) return null;
  const body = input.event_body;
  const reasons = ["has the event_id / event_type / event_body webhook envelope"];
  let c = 0.55;
  const known = lookup(WEBHOOK_EVENT_TYPES, type) !== undefined;
  if (known) {
    c += 0.2;
    reasons.push(`event_type "${type}" is a documented NMI webhook event type`);
  }
  if (UUID.test(input.event_id)) c += 0.05;
  if (Object.keys(input).length === 3) c += 0.05;
  const action = isObj(body.action) ? body.action : undefined;
  if (action && ("action_type" in action || "success" in action)) {
    c += 0.1;
    reasons.push("event_body.action has action_type or success");
  }
  if (typeof body.condition === "string") c += 0.05;
  if (isObj(body.features) && "is_test_mode" in body.features) c += 0.05;
  const confidence = round(Math.min(c, 0.95));
  if (!known && (type.startsWith("application.") || type.startsWith("merchant."))) {
    return {
      provider: PROVIDER,
      format: NMI_FORMATS.partnerWebhook,
      confidence: Math.min(confidence, 0.6),
      supported: false,
      reasons,
      unsupportedReason:
        "This looks like an NMI Merchant Sign-Up (partner) webhook. Partner webhooks are a different product and are not analyzed.",
    };
  }
  return { provider: PROVIDER, format: NMI_FORMATS.webhook, confidence, supported: true, reasons };
}

function detectRest(input: Record<string, unknown>): DetectionResult | null {
  if (
    input.object === "transaction" &&
    code3(input.response_code) !== undefined &&
    typeof input.response_text === "string" &&
    (typeof input.processor_id === "string" || Array.isArray(input.actions))
  ) {
    return {
      provider: PROVIDER,
      format: NMI_FORMATS.restTransaction,
      confidence: 0.6,
      supported: false,
      reasons: [
        'has object "transaction" with response_text, a 3-digit response_code and processor_id or actions',
      ],
      unsupportedReason:
        "This looks like an NMI REST API v5 transaction. REST v5 responses are recognized but not analyzed yet; the Classic Payment API response and merchant webhooks are.",
    };
  }
  if (
    typeof input.error_code === "string" &&
    /^E_[A-Z_]{2,40}$/.test(input.error_code) &&
    typeof input.type === "string" &&
    REST_ERROR_TYPES.has(input.type) &&
    typeof input.message === "string"
  ) {
    return {
      provider: PROVIDER,
      format: NMI_FORMATS.restError,
      confidence: 0.6,
      supported: false,
      reasons: ["has an E_* error_code with a documented REST v5 error type and message"],
      unsupportedReason:
        "This looks like an NMI REST API v5 error. NMI does not publish a full error_code list, so REST v5 errors are recognized but not analyzed.",
    };
  }
  return null;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  if (formTransport(meta) && isFlatStrings(input)) return detectClassic(input) ?? none;
  if (meta?.format === "form") return none;
  return detectWebhook(input) ?? detectRest(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => `${prefix}${i.path.join(".") || "(root)"}: ${i.message}`);
}

function webhookFamily(type: string, info: EventTypeInfo | undefined): EventFamily | "other" {
  if (info) return info.family;
  return type.startsWith("transaction.") ? "transaction" : "other";
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: NmiParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected an object"] };
  if (format === NMI_FORMATS.classic) {
    const collapsed =
      Array.isArray(input.response_code) && single(input.response_code) !== undefined
        ? { ...input, response_code: single(input.response_code) }
        : input;
    const r = ClassicResponse.safeParse(collapsed);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "classic", value: r.data } };
  }
  if (format === NMI_FORMATS.webhook) {
    const env = Webhook.safeParse(input);
    if (!env.success) return { ok: false, issues: issuesOf(env.error) };
    const { event_id: eventId, event_type: eventType, event_body: rawBody } = env.data;
    const info = lookup(WEBHOOK_EVENT_TYPES, eventType);
    const family = webhookFamily(eventType, info);
    const fail = (e: z.ZodError) => ({ ok: false as const, issues: issuesOf(e, "event_body.") });
    const ok = (body: WebhookBody) => ({
      ok: true as const,
      value: { kind: "webhook" as const, eventId, eventType, info, body },
    });
    if (family === "transaction" || family === "check") {
      const b = TransactionBody.safeParse(rawBody);
      if (b.success) return ok({ family, value: b.data });
      // An undocumented transaction.* type is not held to the transaction body.
      if (info) return fail(b.error);
    } else if (family === "settlement") {
      const b = SettlementBody.safeParse(rawBody);
      return b.success ? ok({ family, value: b.data }) : fail(b.error);
    } else if (family === "chargeback") {
      const b = ChargebackBody.safeParse(rawBody);
      return b.success ? ok({ family, value: b.data }) : fail(b.error);
    } else if (family === "recurring") {
      const b = RecurringBody.safeParse(rawBody);
      return b.success ? ok({ family, value: b.data }) : fail(b.error);
    }
    const b = GenericBody.safeParse(rawBody);
    if (!b.success) return fail(b.error);
    return ok({ family: family === "acu" ? "acu" : "other", value: b.data });
  }
  return { ok: false, issues: [`Unsupported NMI format "${format}".`] };
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

function avsAttrs(avs: string | undefined, cvv: string | undefined) {
  return {
    avsResponse: avs,
    avsMeaning: avs !== undefined ? lookup(AVS_CODES, avs) : undefined,
    cvvResponse: cvv,
    cvvMeaning: cvv !== undefined ? lookup(CVV_CODES, cvv) : undefined,
  };
}

const EXPECTED_CLASS: Readonly<Record<string, CodeClass>> = {
  "1": "approved",
  "2": "decline",
  "3": "error",
};

/** True when response and response_code are both documented but point to different classes. */
function classMismatch(response: string, codeInfo: ResponseCodeInfo | undefined): boolean {
  const expected = lookup(EXPECTED_CLASS, response);
  return expected !== undefined && codeInfo !== undefined && codeInfo.codeClass !== expected;
}

/** `response` is read first, as NMI's own documentation advises. */
export function classicOutcome(response: string, code: string | undefined): Outcome {
  const info = lookup(RESPONSE_CODES, code);
  if (response === "1") return "success";
  if (response === "2") return "failure";
  if (response === "3") {
    if (info?.codeClass === "decline") return "failure";
    // response=3 with 100 or an undocumented code: a system error may have left
    // the outcome open.
    return info?.error?.outcome ?? "unknown";
  }
  return "unknown";
}

function normalizeClassic(r: Classic, ctx: NormalizeContext): NormalizedEventDraft {
  const response = r.response.trim();
  const respInfo = lookup(RESPONSE_VALUES, response);
  const code = code3(r.response_code);
  const codeInfo = lookup(RESPONSE_CODES, code);
  const type = r.type?.trim() ?? "";
  const typeInfo = type !== "" ? lookup(TRANSACTION_TYPES, type) : undefined;
  const tid = safeId(nonEmpty(r.transactionid));
  const text = nonEmpty(r.responsetext);
  const avs = shortCode(r.avsresponse, 2);
  const cvv = shortCode(r.cvvresponse, 2);

  let stage: LifecycleStage = typeInfo?.stage ?? (type === "" ? "payment" : "other");
  // A rejected request without a transaction id never became a transaction.
  if (response === "3" && tid === undefined) stage = "error";

  return clean({
    sourceFormat: ctx.format,
    eventType: `transact.${type === "" ? "response" : (safeText(type, 32) ?? "unknown")}`,
    eventTypeKnown: respInfo !== undefined && (type === "" || typeInfo !== undefined),
    stage,
    providerStatus: `response=${safeText(response, 8) ?? ""}${code ? ` response_code=${code}` : ""}`,
    paymentReference: tid,
    merchantReference: merchantRef(nonEmpty(r.orderid)),
    subscriptionReference: safeId(nonEmpty(r.subscription_id)),
    outcome: classicOutcome(response, code),
    attributes: attrs({
      response: safeText(response, 8),
      responseCode: code,
      responseCodeKnown: code !== undefined ? codeInfo !== undefined : undefined,
      responseCodeMeaning: codeInfo?.meaning,
      responseCodeMismatch: classMismatch(response, codeInfo) ? true : undefined,
      responseText: safeText(text, 100),
      refId: text ? REFID.exec(text)?.[1] : undefined,
      type: type !== "" ? safeText(type, 32) : undefined,
      authCode: safeId(nonEmpty(r.authcode), 16),
      ...avsAttrs(avs, cvv),
      merchantAdviceCode: shortCode(r.merchant_advice_code, 4),
      kountScore:
        nonEmpty(r.kount_score) && /^\d{1,4}$/.test(r.kount_score!.trim())
          ? r.kount_score!.trim()
          : undefined,
      amountAuthorized: decimalText(r.amount_authorized),
      partialPaymentId: safeId(nonEmpty(r.partial_payment_id)),
      partialPaymentBalance: decimalText(r.partial_payment_balance),
      invoiceId: safeId(nonEmpty(r.invoice_id)),
      // Stored-credential reference: presence only.
      customerVaultIdPresent: nonEmpty(r.customer_vault_id) !== undefined ? true : undefined,
      httpStatus: ctx.meta?.http?.status,
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function signatureHeader(meta: RecordMeta | undefined): string | undefined {
  if (meta?.format !== "http") return undefined;
  return meta.http?.headers["webhook-signature"] !== undefined ? "present_not_verified" : "absent";
}

function commonWebhookAttrs(
  body: { features?: z.infer<typeof Features> | null; merchant?: z.infer<typeof Merchant> | null },
  ctx: NormalizeContext,
): Record<string, SafePrimitive | undefined> {
  return {
    testMode: testModeFlag(body.features?.is_test_mode),
    merchantId: idOf(body.merchant?.id),
    webhookSignature: signatureHeader(ctx.meta),
  };
}

/** Upper bound on events expanded from one batch notification. */
const MAX_BATCH_EVENTS = 500;

function normalizeWebhook(
  p: Extract<NmiParsed, { kind: "webhook" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const eventId = safeId(p.eventId);
  const eventType = safeText(p.eventType, 128) ?? "unknown";
  // NMI's samples reuse one event_id for different events, so the type is part of the key.
  const baseKey = eventId ? `${eventId}|${eventType}` : undefined;
  const known = p.info !== undefined;
  const stage: LifecycleStage = p.info?.stage ?? "other";
  const outcome: Outcome = p.info?.outcome ?? "unknown";
  const event = (
    extra: Partial<NormalizedEventDraft> & { attributes: NormalizedEventDraft["attributes"] },
  ): NormalizedEventDraft =>
    clean({
      sourceFormat: ctx.format,
      eventType,
      eventTypeKnown: known,
      stage,
      eventReference: eventId,
      deliveryKey: baseKey,
      outcome,
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...observed,
      ...extra,
    });

  const b = p.body;
  if (b.family === "transaction" || b.family === "check") {
    const t = b.value;
    const a = t.action ?? undefined;
    const currency = upperCurrency(nonEmpty(t.currency));
    const amountMinor =
      decimalToMinor(scalarString(a?.amount), currency) ??
      decimalToMinor(scalarString(t.requested_amount), currency);
    const condition = nonEmpty(t.condition);
    const code = code3(a?.response_code);
    const avs = shortCode(t.card?.avs_response, 2);
    const cvv = shortCode(t.card?.csc_response, 2);
    const source = nonEmpty(a?.source);
    return [
      event({
        providerStatus: condition ? `condition=${safeText(condition, 32)}` : undefined,
        paymentReference: idOf(t.transaction_id),
        merchantReference: merchantRef(nonEmpty(t.order_id)),
        // Recurring charges are reported with source=recurring.
        isRecurring: source === "recurring" ? true : undefined,
        eventTimestamp: nmiDate(a?.date),
        amountMinor,
        currency: amountMinor !== undefined ? currency : undefined,
        attributes: attrs({
          condition: safeText(condition, 32),
          conditionKnown:
            condition !== undefined ? lookup(CONDITIONS, condition) !== undefined : undefined,
          transactionType: safeText(nonEmpty(t.transaction_type), 16),
          processorId: idOf(t.processor_id),
          actionType: safeText(nonEmpty(a?.action_type), 32),
          actionSuccess: successFlag(a?.success),
          actionSource: safeText(source, 32),
          apiMethod: safeText(nonEmpty(a?.api_method), 32),
          actionDate:
            a?.date !== undefined && nmiDate(a.date) === undefined
              ? safeText(scalarString(a.date), 32)
              : undefined,
          responseCode: code,
          responseCodeMeaning: lookup(RESPONSE_CODES, code)?.meaning,
          responseText: safeText(nonEmpty(a?.response_text), 100),
          processorResponseCode: safeText(scalarString(a?.processor_response_code), 16),
          processorResponseText: safeText(nonEmpty(a?.processor_response_text), 100),
          authCode: safeId(nonEmpty(t.authorization_code), 16),
          ...avsAttrs(avs, cvv),
          entryMode: safeText(nonEmpty(t.card?.entry_mode), 32),
          cardType: safeText(nonEmpty(t.card?.cc_type), 32),
          requestedAmount: decimalText(t.requested_amount),
          ...commonWebhookAttrs(t, ctx),
        }),
      }),
    ];
  }

  if (b.family === "settlement") {
    const s = b.value;
    const ids = [
      ...new Set((s.transaction_ids ?? []).map((v) => idOf(v)).filter(Boolean)),
    ] as string[];
    const shared = {
      batchId: idOf(s.batch_id),
      processorBatchId: idOf(s.processor_batch_id),
      batchTransactionCount: ids.length,
      ...commonWebhookAttrs(s, ctx),
    };
    if (ids.length === 0) return [event({ attributes: attrs(shared) })];
    return ids.slice(0, MAX_BATCH_EVENTS).map((tid, i) =>
      event({
        paymentReference: tid,
        deliveryKey: baseKey ? `${baseKey}|${tid}` : undefined,
        source: { recordIndex: ctx.recordIndex, path: `event_body.transaction_ids[${i}]` },
        attributes: attrs({
          ...shared,
          batchTruncated: ids.length > MAX_BATCH_EVENTS ? true : undefined,
        }),
      }),
    );
  }

  if (b.family === "chargeback") {
    const c = b.value;
    const list = c.chargebacks ?? [];
    const common = commonWebhookAttrs(c, ctx);
    if (list.length === 0) return [event({ attributes: attrs({ chargebackCount: 0, ...common }) })];
    return list.slice(0, MAX_BATCH_EVENTS).map((cb, i) => {
      const id = idOf(cb.id);
      return event({
        // Whether a chargeback id is a transaction id is not documented: not a payment key.
        deliveryKey: baseKey ? `${baseKey}|${id ?? `#${i}`}` : undefined,
        eventTimestamp: nmiDate(cb.date),
        source: { recordIndex: ctx.recordIndex, path: `event_body.chargebacks[${i}]` },
        attributes: attrs({
          chargebackId: id,
          chargebackReason: safeText(nonEmpty(cb.reason), 100),
          chargebackAmount: decimalText(cb.amount),
          chargebackDate:
            nmiDate(cb.date) === undefined ? safeText(scalarString(cb.date), 32) : undefined,
          chargebackCount: list.length,
          batchTruncated: list.length > MAX_BATCH_EVENTS ? true : undefined,
          ...common,
        }),
      });
    });
  }

  if (b.family === "recurring") {
    const r = b.value;
    return [
      event({
        subscriptionReference: idOf(r.subscription_id),
        attributes: attrs(commonWebhookAttrs(r, ctx)),
      }),
    ];
  }

  return [
    event({
      attributes: attrs({
        ...commonWebhookAttrs(b.value, ctx),
        informational: b.family === "acu" ? true : undefined,
      }),
    }),
  ];
}

function normalize(parsed: NmiParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "classic") return [normalizeClassic(parsed.value, ctx)];
  return normalizeWebhook(parsed, ctx);
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
  path?: string;
};

function draft(ctx: NormalizeContext, o: DraftOpts): DecodedErrorDraft {
  const providerMessage = safeText(o.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: o.path ?? "" },
    code: o.code,
    subCodes: o.subCodes,
    category: o.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: o.entry.explanation,
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

function custom(
  meaning: string,
  category: CatalogEntry["category"],
  retry: CatalogEntry["retry"],
  explanation: string,
  retryExplanation?: string,
): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation,
    nextAction: NEXT_ACTION[category],
    retryExplanation: retryExplanation ?? RETRY_EXPLANATION[retry],
  };
}

const VERIFY_BEFORE_RETRY =
  "The record does not show whether the operation took effect. Look up the transaction with the Query API (condition and actions) first; never resend blindly.";

/** Notes that AVS/CVV mismatches may matter, without claiming they caused the decline. */
function avsCvvNotes(avs: string | undefined, cvv: string | undefined): string[] {
  const out: string[] = [];
  if (cvv === "N")
    out.push(
      "The CVV result is N (no match). It may have contributed to the decline; the response does not say so.",
    );
  if (avs !== undefined && AVS_NO_MATCH.has(avs))
    out.push(
      `The AVS result is ${avs} (no address or ZIP match). It may have contributed to the decline; the response does not say so.`,
    );
  return out;
}

function decodeClassic(r: Classic, ctx: NormalizeContext): DecodedErrorDraft[] {
  const response = r.response.trim();
  if (response === "1") return [];
  const shownResponse = safeText(response, 8) ?? "";
  const code = code3(r.response_code);
  const rawCode = nonEmpty(r.response_code);
  const codeInfo = lookup(RESPONSE_CODES, code);
  const tid = safeId(nonEmpty(r.transactionid));
  const text = nonEmpty(r.responsetext);
  const avs = shortCode(r.avsresponse, 2);
  const cvv = shortCode(r.cvvresponse, 2);
  const docs: DocumentationLink[] = [
    { title: "NMI response codes", url: RESPONSE_CODES_URL },
    { title: "NMI Payment API", url: TRANSACTIONS_URL },
  ];
  if (codeInfo && codeInfo.source !== RESPONSE_CODES_URL)
    docs.push({ title: "NMI rate limiting", url: codeInfo.source });
  const subCodes: Record<string, string> = { response: shownResponse };
  if (code) subCodes.response_code = code;
  const refId = text ? REFID.exec(text)?.[1] : undefined;
  if (refId) subCodes.refid = refId;
  const mac = shortCode(r.merchant_advice_code, 4);
  const missing: string[] = [];
  if (mac) {
    subCodes.merchant_advice_code = mac;
    missing.push(
      `merchant_advice_code ${mac} is passed through from the card network; NMI does not document its values, so it is shown but not interpreted.`,
    );
  }
  if (avs) subCodes.avsresponse = avs;
  if (cvv) subCodes.cvvresponse = cvv;
  const base = { subCodes, documentation: docs, message: text, transactionId: tid };

  if (lookup(RESPONSE_VALUES, response) === undefined) {
    return [
      draft(ctx, {
        ...base,
        code: `response=${shownResponse}`,
        entry: custom(
          "Undocumented response value",
          "unknown",
          "unknown",
          `response "${shownResponse}" is not one of the documented values 1 (approved), 2 (declined) and 3 (error).${
            codeInfo ? ` response_code ${code} is documented as: ${codeInfo.meaning}.` : ""
          }`,
        ),
        confidence: "insufficient",
        missing: [...missing, "The response value is not documented, so the outcome is unknown."],
        outcomeKnown: false,
      }),
    ];
  }

  const declined = response === "2";
  if (codeInfo?.error) {
    const mismatch = classMismatch(response, codeInfo);
    if (mismatch)
      missing.push(
        `response=${response} (${declined ? "declined" : "error"}) and response_code ${code} (${codeInfo.codeClass === "decline" ? "a processor decline" : "a gateway or processor error"}) point to different classes. NMI says to read response first; the code meaning is shown with reduced confidence.`,
      );
    if (declined || codeInfo.codeClass === "decline") missing.push(...avsCvvNotes(avs, cvv));
    if (code === "260" && !text)
      missing.push("response_code 260 says the instructions are in responsetext, which is empty.");
    return [
      draft(ctx, {
        ...base,
        code: code!,
        entry: codeInfo.error,
        confidence: mismatch ? "possible" : "strong",
        missing,
        outcomeKnown: declined || codeInfo.error.outcome === "failure",
      }),
    ];
  }

  if (codeInfo?.codeClass === "approved") {
    // Documented inconsistency: NMI's "Failed to Create Plan" example pairs
    // response=3 with response_code=100.
    const entry = declined
      ? custom(
          "Decline with an approval code",
          "card_declined",
          "manual_review",
          "response=2 reports a decline, but response_code 100 means approved. NMI documents that response is read first, so the transaction is treated as declined; the code does not explain why.",
        )
      : custom(
          "Error with an approval code",
          "unknown",
          "retry_conditionally",
          'response=3 reports an error in the transaction data or a system error, but response_code 100 means approved. NMI\'s own documentation contains this pairing (the "Failed to Create Plan" example), so response_code cannot be trusted alone; PandaPayLens follows response and does not treat the request as successful. responsetext carries the reason, if any.',
          VERIFY_BEFORE_RETRY,
        );
    return [
      draft(ctx, {
        ...base,
        code: `response=${response}`,
        entry,
        confidence: "insufficient",
        missing: [
          ...missing,
          "response and response_code contradict each other; check the transaction with the Query API or in the gateway control panel.",
        ],
        outcomeKnown: declined,
      }),
    ];
  }

  const codeMissing = rawCode === undefined;
  const codeNote = codeMissing
    ? "The record has no response_code, so the specific reason is unknown."
    : `response_code "${safeText(rawCode, 8)}" is not in NMI's Result Code Table.`;
  if (declined) {
    return [
      draft(ctx, {
        ...base,
        code: codeMissing ? "response=2" : (safeText(rawCode, 8) ?? "response=2"),
        entry: custom(
          "Declined",
          "card_declined",
          "manual_review",
          "response=2 reports that the transaction was declined. The response_code does not say why.",
        ),
        confidence: codeMissing ? "possible" : "insufficient",
        missing: [...missing, codeNote, ...avsCvvNotes(avs, cvv)],
        outcomeKnown: true,
      }),
    ];
  }
  return [
    draft(ctx, {
      ...base,
      code: codeMissing ? "response=3" : (safeText(rawCode, 8) ?? "response=3"),
      entry: custom(
        "Data or system error",
        "unknown",
        "retry_conditionally",
        "response=3 reports an error in the transaction data or a system error. Without a documented response_code PandaPayLens cannot tell which, or whether anything was processed.",
        VERIFY_BEFORE_RETRY,
      ),
      confidence: "insufficient",
      missing: [...missing, codeNote],
      outcomeKnown: false,
    }),
  ];
}

const UNKNOWN_RESULT = custom(
  "Unknown processing result",
  "unknown",
  "manual_review",
  "NMI reported the result of this action as unknown (an unknown processing error). The record does not show whether the operation took effect.",
  VERIFY_BEFORE_RETRY,
);

function decodeWebhook(
  p: Extract<NmiParsed, { kind: "webhook" }>,
  ctx: NormalizeContext,
): DecodedErrorDraft[] {
  const b = p.body;
  const eventType = safeText(p.eventType, 128) ?? "unknown";
  if (b.family === "settlement") {
    if (p.eventType !== "settlement.batch.failure") return [];
    return [
      draft(ctx, {
        code: eventType,
        entry: custom(
          "Settlement batch failed",
          "unknown",
          "manual_review",
          "NMI reports that a settlement batch failed. The event does not say why.",
        ),
        confidence: "possible",
        subCodes: {
          event_type: eventType,
          ...(idOf(b.value.batch_id) ? { batch_id: idOf(b.value.batch_id)! } : {}),
        },
        missing: ["The reason for the batch failure is not in the event."],
        documentation: [{ title: "NMI settlement events", url: SETTLEMENT_EVENTS_URL }],
        transactionId: undefined,
        outcomeKnown: true,
        path: "event_body",
      }),
    ];
  }
  if (b.family !== "transaction" && b.family !== "check") return [];

  const t = b.value;
  const a = t.action ?? undefined;
  const flag = successFlag(a?.success);
  const failed = p.info?.outcome === "failure" || (p.info === undefined && flag === false);
  const unknown = p.info?.outcome === "unknown";
  // A success event whose action says success=0 contradicts itself.
  const contradiction = p.info?.outcome === "success" && flag === false;
  if (!failed && !unknown && !contradiction) return [];

  const tid = idOf(t.transaction_id);
  const code = code3(a?.response_code);
  const rawCode = scalarString(a?.response_code);
  const codeInfo = lookup(RESPONSE_CODES, code);
  const avs = shortCode(t.card?.avs_response, 2);
  const cvv = shortCode(t.card?.csc_response, 2);
  const docs: DocumentationLink[] = [
    {
      title: b.family === "check" ? "NMI check status events" : "NMI transaction events",
      url: b.family === "check" ? CHECK_STATUS_URL : TRANSACTION_EVENTS_URL,
    },
    { title: "NMI response codes", url: RESPONSE_CODES_URL },
  ];
  const subCodes: Record<string, string> = { event_type: eventType };
  if (code) subCodes.response_code = code;
  const procCode = safeText(scalarString(a?.processor_response_code), 16);
  const missing: string[] = [];
  if (procCode) {
    subCodes.processor_response_code = procCode;
    missing.push(
      `processor_response_code ${procCode} is the connected processor's own code; NMI publishes no table for it.`,
    );
  }
  const condition = nonEmpty(t.condition);
  if (condition) subCodes.condition = safeText(condition, 32) ?? "";
  const base = {
    subCodes,
    documentation: docs,
    message: nonEmpty(a?.response_text),
    transactionId: tid,
    path: "event_body.action",
  };

  if (contradiction) {
    return [
      draft(ctx, {
        ...base,
        code: eventType,
        entry: custom(
          "Event type and action result disagree",
          "unknown",
          "manual_review",
          "The event type reports success, but action.success is 0. Check the transaction's condition before acting.",
        ),
        confidence: "insufficient",
        missing,
        outcomeKnown: false,
      }),
    ];
  }

  if (codeInfo?.error) {
    if (failed && codeInfo.codeClass === "decline") missing.push(...avsCvvNotes(avs, cvv));
    return [
      draft(ctx, {
        ...base,
        code: code!,
        entry: codeInfo.error,
        // The webhook action's response_code is decoded with the Payment API table.
        confidence: "strong",
        missing,
        outcomeKnown: failed ? true : codeInfo.error.outcome === "failure",
      }),
    ];
  }

  if (unknown) {
    return [
      draft(ctx, {
        ...base,
        code: code ?? eventType,
        entry: UNKNOWN_RESULT,
        confidence: "possible",
        missing: [
          ...missing,
          "NMI's condition unknown means an unknown processing error; the final state is only visible with the Query API or in the gateway control panel.",
        ],
        outcomeKnown: false,
      }),
    ];
  }

  if (b.family === "check") {
    return [
      draft(ctx, {
        ...base,
        code: code ?? eventType,
        entry: custom(
          "ACH payment returned",
          "unknown",
          "manual_review",
          `NMI reports that the ACH (check) payment was returned${p.eventType.endsWith("latereturn") ? " late" : ""}. ACH return reasons are not documented in the research, so the reason is not decoded.`,
        ),
        confidence: "possible",
        missing: [...missing, "The ACH return reason is not decoded."],
        outcomeKnown: true,
      }),
    ];
  }

  const approvedCode = codeInfo?.codeClass === "approved";
  return [
    draft(ctx, {
      ...base,
      code: code ?? (rawCode ? (safeText(rawCode, 8) ?? eventType) : eventType),
      entry: custom(
        "Action failed",
        "unknown",
        "unknown",
        approvedCode
          ? "The event reports a failure, but action.response_code 100 means approved. NMI documents that response codes cannot be trusted alone; the failure reported by the event is kept."
          : "The event reports a failure, but no documented response_code explains it.",
      ),
      confidence: "insufficient",
      missing: [
        ...missing,
        rawCode === undefined
          ? "The action has no response_code."
          : approvedCode
            ? "The event type and action.response_code contradict each other."
            : `response_code "${safeText(rawCode, 8)}" is not in NMI's Result Code Table.`,
      ],
      outcomeKnown: true,
    }),
  ];
}

function decodeErrors(parsed: NmiParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "classic") return decodeClassic(parsed.value, ctx);
  return decodeWebhook(parsed, ctx);
}

export const nmiAdapter: ProviderAdapter<NmiParsed> = {
  id: PROVIDER,
  displayName: "NMI",
  version: NMI_ADAPTER_VERSION,
  manifest: nmiManifest,
  supportedFormats: [
    {
      id: NMI_FORMATS.classic,
      description:
        "Classic Payment API (transact.php) query-string response (response, responsetext, transactionid, response_code)",
    },
    {
      id: NMI_FORMATS.webhook,
      description: "Merchant webhook JSON (event_id, event_type, event_body)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // transactionid / transaction_id is the only explicit link: captures and
    // voids keep the authorization's id. Refunds get a new id with no parent
    // field. order_id can be reused across attempts and subscription ids link
    // separate payments, so neither is a payment key.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default nmiAdapter;
