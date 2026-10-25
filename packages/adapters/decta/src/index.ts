/**
 * DECTA adapter (Decta Gate API v0.6).
 *
 * Supported input families:
 * - `decta.order`             Order object from an API response, or the body of an
 *                             order.* / oct.* webhook (event name in X-Webhook-Event)
 * - `decta.host2host`         Host2Host, wallet and manual 3-D Secure step responses
 * - `decta.validation_error`  API validation error object { <field>: [{ message, code }] }
 *
 * Recognized but not supported: `decta.card_webhook` (card.* events, saved card
 * object) and `decta.webhook_v05` (deprecated v0.5 events, body not documented).
 *
 * One order id spans authorization, capture, refund and reversal. The order
 * status is the current state; status_changes is kept as a history attribute
 * because its timestamp key is not documented.
 */

import {
  lookup,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
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
  AFTER_PAYMENT_URL,
  AVS_CODES,
  DOCUMENTED_MESSAGES,
  GROUP_GUIDANCE,
  HTTP_STATUSES,
  LEGACY_WEBHOOK_EVENTS,
  MDSTATUS_MEANINGS,
  MERCHANT_ADVICE_CODES,
  NAME_VALIDATION_VALUES,
  NEXT_ACTION,
  OPENAPI_URL,
  ORDER_STATUSES,
  PAYMENT_FLOW_URL,
  PAYMENT_SYSTEMS,
  RAW_ACQUIRER_CODES,
  RESPONSE_CODES_URL,
  RETRY_TEXT,
  SPECIAL_CODES,
  TDS_NEXT_STEPS,
  TDS_STATUSES,
  VALIDATION_CODES,
  WEBHOOK_EVENTS,
  type CodeEntry,
  type StatusInfo,
  type WebhookEventInfo,
} from "./catalog.js";
import { dectaManifest, DECTA_ADAPTER_VERSION } from "./manifest.js";

export { dectaManifest, DECTA_ADAPTER_VERSION };

const PROVIDER = "decta";

const Code = z.union([z.string().max(32), z.number().int()]);
const NCode = Code.nullable().optional();
const NStr = (max: number) => z.string().max(max).nullable().optional();
const Id = z
  .union([z.string().max(256), z.number().int()])
  .nullable()
  .optional();

const StatusChange = z.looseObject({ new_status: NStr(64) });

const ProcessingStatus = z.looseObject({ code: NCode, description: NStr(2000) });
const TxnError = z.looseObject({ code: NCode, description: NStr(2000) });

const TransactionDetails = z.looseObject({
  processing_status: ProcessingStatus.nullable().optional(),
  errors: z.array(TxnError).max(200).nullable().optional(),
  merchant_advice_code: NCode,
  processing_payment_id: Id,
  three_d_secure_status: z.looseObject({}).nullable().optional(),
  fraud_check_status: z.looseObject({ code: NCode }).nullable().optional(),
});

const Order = z.looseObject({
  type: z.literal("order").optional(),
  id: z.string().max(256),
  number: NStr(256),
  status: z.string().max(64),
  status_changes: z.array(StatusChange).max(1000).nullable().optional(),
  transaction_details: TransactionDetails.nullable().optional(),
  avs_status: z
    .looseObject({ avs_status: NStr(8) })
    .nullable()
    .optional(),
  card_name_validation: z.looseObject({}).nullable().optional(),
  payment_system: NStr(16),
  permitted_actions: z.array(z.string().max(64)).max(50).nullable().optional(),
  is_payable: z.boolean().nullable().optional(),
  from_subscription: z.boolean().nullable().optional(),
});

const TdsDetails = z.looseObject({ mdstatus: NCode, protocol: NStr(32) });

const HostToHost = z.looseObject({
  status: NStr(64),
  next_step: NStr(64),
  processing_status: NCode,
  three_d_secure_details: TdsDetails.nullable().optional(),
  threed_check_url: NStr(4096),
});

const ValidationItem = z.looseObject({ message: z.string().max(2000), code: z.string().max(64) });
const ValidationError = z.record(z.string().max(128), z.array(ValidationItem).min(1).max(100));

type OrderValue = z.infer<typeof Order>;
type HostToHostValue = z.infer<typeof HostToHost>;
type ValidationValue = z.infer<typeof ValidationError>;

export type DectaParsed =
  | { kind: "order"; value: OrderValue }
  | { kind: "host2host"; value: HostToHostValue }
  | { kind: "validation_error"; value: ValidationValue };

const FORMATS = {
  "decta.order": ["order", Order],
  "decta.host2host": ["host2host", HostToHost],
  "decta.validation_error": ["validation_error", ValidationError],
} as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Raw acquirer codes are numeric strings ("000", "116"); -1 is the special gateway code. */
function codeOf(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return /^-?\d{1,4}$/.test(t) ? t : undefined;
}

/** Codes of undocumented vocabularies: identifier-like only, never free text. */
function looseCode(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return /^[0-9A-Za-z._-]{1,32}$/.test(t) ? t : undefined;
}

export function findCode(code: string | undefined): CodeEntry | undefined {
  if (code === undefined) return undefined;
  return lookup(RAW_ACQUIRER_CODES, code) ?? lookup(SPECIAL_CODES, code);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keys that only DECTA Gate orders carry. */
const ORDER_KEYS = [
  "api_do_url",
  "full_page_checkout",
  "direct_post",
  "is_payable",
  "permitted_actions",
  "skip_capture",
  "from_subscription",
] as const;

const CARD_KEYS = [
  "transaction_type",
  "client",
  "merchant",
  "masked_pan",
  "exp_month",
  "exp_year",
  "is_default",
  "cardholder_name",
  "product_type",
  "issuer_country",
  "region_card_issuer",
  "card_type",
] as const;

function header(meta: RecordMeta | undefined, name: string, max = 64): string | undefined {
  const v = meta?.http?.headers[name];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t !== "" && t.length <= max ? t : undefined;
}

const webhookEventOf = (meta?: RecordMeta) => header(meta, "x-webhook-event");
const webhookVersionOf = (meta?: RecordMeta) => header(meta, "x-webhook-version", 16);

const round = (n: number) => Math.round(Math.min(0.95, n) * 100) / 100;

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: PROVIDER };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe payloads carry `object`; DECTA payloads never do.
  if ("object" in input) return none;
  // DECTA requests, responses and webhooks are JSON only.
  if (meta?.format === "form" || meta?.http?.contentType === "application/x-www-form-urlencoded")
    return none;

  const event = webhookEventOf(meta);
  const version = webhookVersionOf(meta);
  const eventInfo = event ? lookup(WEBHOOK_EVENTS, event) : undefined;

  const typeOrder = input.type === "order";
  const changes =
    Array.isArray(input.status_changes) &&
    input.status_changes.some((c) => isObj(c) && typeof c.new_status === "string");
  const orderShaped = typeOrder || changes;

  // Deprecated v0.5 webhooks: the body is not documented.
  if (
    version === "v0.5" ||
    (event !== undefined && LEGACY_WEBHOOK_EVENTS.has(event) && orderShaped)
  ) {
    return {
      ...base,
      format: "decta.webhook_v05",
      confidence: version === "v0.5" && event && LEGACY_WEBHOOK_EVENTS.has(event) ? 0.9 : 0.7,
      supported: false,
      reasons: [
        version === "v0.5"
          ? "X-Webhook-Version is v0.5"
          : "X-Webhook-Event is a deprecated v0.5 event and the body is an order",
      ],
      unsupportedReason:
        "DECTA v0.5 webhooks are deprecated and their body is not documented, so they are recognized but not analyzed.",
    };
  }

  // card.* webhooks carry a saved card object.
  const cardKeys = CARD_KEYS.filter((k) => k in input).length;
  if (
    eventInfo?.object === "card" ||
    ("region_card_issuer" in input && "masked_pan" in input && cardKeys >= 6)
  ) {
    return {
      ...base,
      format: "decta.card_webhook",
      confidence: eventInfo?.object === "card" ? (version === "v0.6" ? 0.9 : 0.8) : 0.7,
      supported: false,
      reasons: [
        eventInfo?.object === "card"
          ? "X-Webhook-Event is a documented card.* event"
          : "has the documented saved card fields (region_card_issuer, masked_pan and others)",
      ],
      unsupportedReason:
        "DECTA card.* webhooks describe a saved card, not a payment, and are recognized but not analyzed.",
    };
  }

  // Orders: an API response or the body of an order.* / oct.* webhook.
  // card.* events returned above, so a known event here is an order.* or oct.* event.
  const headerAnchor = eventInfo !== undefined;
  if (orderShaped || headerAnchor) {
    const reasons: string[] = [];
    let score = 0;
    if (typeOrder) {
      score += 0.35;
      reasons.push('type is "order"');
    }
    if (changes) {
      score += typeOrder ? 0.2 : 0.35;
      reasons.push("has status_changes[] with new_status");
    }
    if (headerAnchor) {
      score += orderShaped ? 0.2 : 0.5;
      reasons.push("X-Webhook-Event is a documented order.* or oct.* event");
    } else if (event && /^(order|oct)\./.test(event)) {
      score += 0.05;
      reasons.push("X-Webhook-Event names an order or oct object");
    }
    if (version === "v0.6") {
      score += 0.05;
      reasons.push("X-Webhook-Version is v0.6");
    }
    if (typeof input.id === "string") {
      score += UUID.test(input.id) ? 0.15 : 0.1;
      reasons.push(UUID.test(input.id) ? "has a UUID id" : "has an id");
    }
    if (typeof input.status === "string" && lookup(ORDER_STATUSES, input.status)) {
      score += 0.1;
      reasons.push("status is a documented order status");
    }
    if (typeof input.number === "string" && /^DE\d+$/.test(input.number)) {
      score += 0.05;
      reasons.push("number has the autogenerated DE pattern");
    }
    const td = isObj(input.transaction_details) ? input.transaction_details : undefined;
    const ps = td && isObj(td.processing_status) ? td.processing_status : undefined;
    if (ps && typeof ps.code === "string" && /^\d{3}$/.test(ps.code)) {
      score += 0.1;
      reasons.push("transaction_details.processing_status.code is a 3-digit code");
    }
    const distinct = ORDER_KEYS.filter((k) => k in input);
    if (
      distinct.length > 0 ||
      (typeof input.payment_system === "string" && PAYMENT_SYSTEMS.has(input.payment_system))
    ) {
      score += 0.1;
      reasons.push("has DECTA order fields (for example permitted_actions or payment_system)");
    }
    return {
      ...base,
      format: "decta.order",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  // Manual 3-D Secure step responses.
  if (typeof input.status === "string" && lookup(TDS_STATUSES, input.status)) {
    const stepFields =
      "next_step" in input || "next_step_url" in input || isObj(input.three_d_secure_details);
    if (!stepFields) {
      return {
        ...base,
        format: "decta.host2host",
        confidence: 0.4,
        supported: true,
        reasons: ["status is a documented 3-D Secure step status, without step fields"],
      };
    }
    const reasons = ["status is a documented 3-D Secure step status with next_step fields"];
    let score = 0.6;
    const tds = isObj(input.three_d_secure_details) ? input.three_d_secure_details : undefined;
    if (tds && "mdstatus" in tds) {
      score += 0.15;
      reasons.push("has three_d_secure_details.mdstatus");
    }
    if ("processing_status" in input) {
      score += 0.1;
      reasons.push("has processing_status");
    }
    if ("redirectToACSForm" in input) {
      score += 0.05;
      reasons.push("has redirectToACSForm");
    }
    return {
      ...base,
      format: "decta.host2host",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  // Short Host2Host and wallet responses. These are small generic shapes, so
  // they are never claimed above 0.5.
  const keys = Object.keys(input);
  if (keys.length === 1 && keys[0] === "processing_status") {
    const code = typeof input.processing_status === "string" ? input.processing_status : undefined;
    if (code && /^\d{3}$/.test(code) && findCode(code)) {
      return {
        ...base,
        format: "decta.host2host",
        confidence: 0.5,
        supported: true,
        reasons: ["body is only processing_status with a documented raw acquirer code"],
      };
    }
    return none;
  }
  if (keys.length === 1 && keys[0] === "threed_check_url") {
    if (typeof input.threed_check_url !== "string") return none;
    return {
      ...base,
      format: "decta.host2host",
      confidence: 0.5,
      supported: true,
      reasons: ["body is only threed_check_url"],
    };
  }

  // API validation errors: field names mapped to arrays of { message, code }.
  if (keys.length > 0 && keys.length <= 100) {
    const shaped = keys.every((k) => {
      const v = input[k];
      return (
        /^[A-Za-z0-9_.[\]-]{1,128}$/.test(k) &&
        Array.isArray(v) &&
        v.length > 0 &&
        v.every((i) => isObj(i) && typeof i.message === "string" && typeof i.code === "string")
      );
    });
    if (shaped) {
      const reasons = ["field names map to arrays of { message, code }"];
      let score = 0.4;
      if ("__all__" in input) {
        score += 0.2;
        reasons.push("has the __all__ key for errors not tied to a field");
      }
      if (meta?.http?.status === 400) {
        score += 0.1;
        reasons.push("arrived as an HTTP 400 response");
      }
      return {
        ...base,
        format: "decta.validation_error",
        confidence: round(score),
        supported: true,
        reasons,
      };
    }
  }
  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: DectaParsed } | { ok: false; issues: string[] } {
  if (!Object.prototype.hasOwnProperty.call(FORMATS, format))
    return { ok: false, issues: [`Unsupported DECTA format "${format}".`] };
  const entry = FORMATS[format as keyof typeof FORMATS];
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as DectaParsed };
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.length > 0)
      out[k] = v.map((x) =>
        typeof x === "string" ? (safeText(x, 64) ?? "") : x,
      ) as SafePrimitive[];
  }
  return out;
}

function clean(dr: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(dr).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** Merchant-assigned identifiers are free text; drop any that look like personal data. */
function merchantId(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

function idOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  return merchantId(v);
}

/**
 * Order timestamps. Their wire format is not documented, so only ISO 8601
 * date-times with an explicit zone are read; anything else is left out
 * rather than guessed.
 */
function isoOf(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 64) return undefined;
  const m =
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/i.exec(
      v.trim(),
    );
  if (!m) return undefined;
  const time = m[2]!.length === 5 ? `${m[2]}:00` : m[2]!;
  const frac = m[3] ? m[3].slice(0, 4) : "";
  const zone = m[4]!.toUpperCase() === "Z" ? "Z" : `${m[4]!.slice(0, 3)}:${m[4]!.slice(-2)}`;
  return toIsoTimestamp(`${m[1]}T${time}${frac}${zone}`);
}

/** Amounts are shown exactly as supplied: their unit is not documented. */
function amountAsSupplied(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && /^-?\d{1,20}(?:\.\d{1,10})?$/.test(v.trim())) return v.trim();
  return undefined;
}

const observedOf = (ctx: NormalizeContext) =>
  ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

const kindOutcome = (entry: CodeEntry | undefined): Outcome =>
  !entry
    ? "unknown"
    : entry.kind === "decline"
      ? "failure"
      : entry.kind === "pending"
        ? "pending"
        : "success";

type OrderState = {
  event?: string;
  eventInfo?: WebhookEventInfo;
  statusInfo?: StatusInfo;
  history: string[];
  stage: LifecycleStage;
  outcome: Outcome;
  eventType: string;
  eventTypeKnown: boolean;
  capturedFromHold: boolean;
};

/** Stage and outcome of an order record, from the webhook event if present, else the status. */
function orderState(v: OrderValue, meta: RecordMeta | undefined): OrderState {
  const event = webhookEventOf(meta);
  const info = event ? lookup(WEBHOOK_EVENTS, event) : undefined;
  const eventInfo = info && info.object !== "card" ? info : undefined;
  const statusInfo = lookup(ORDER_STATUSES, v.status);
  const history = (v.status_changes ?? [])
    .map((c) => (typeof c.new_status === "string" ? c.new_status : undefined))
    .filter((s): s is string => s !== undefined);
  let stage: LifecycleStage = eventInfo?.stage ?? statusInfo?.stage ?? "other";
  const outcome: Outcome = eventInfo
    ? eventInfo.outcome
    : statusInfo && !statusInfo.meaningUndocumented
      ? statusInfo.outcome
      : "unknown";
  // Two-step flow: hold, then capture to paid. Only a held order is shown as captured.
  const capturedFromHold =
    stage === "payment" && outcome === "success" && v.status === "paid" && history.includes("hold");
  if (capturedFromHold) stage = "capture";
  return {
    event,
    eventInfo,
    statusInfo,
    history,
    stage,
    outcome,
    eventType: event
      ? (safeText(event, 64) ?? "unknown")
      : `order_status.${safeText(v.status, 64) ?? "unknown"}`,
    eventTypeKnown: event
      ? Boolean(eventInfo)
      : Boolean(statusInfo && !statusInfo.meaningUndocumented),
    capturedFromHold,
  };
}

function strOf(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v !== "" && v.length <= max ? v : undefined;
}

function orderAttrs(v: OrderValue, s: OrderState, ctx: NormalizeContext): Attrs {
  const td = v.transaction_details ?? undefined;
  const raw = v as Record<string, unknown>;
  const tdRaw = (td ?? {}) as Record<string, unknown>;
  const code = codeOf(td?.processing_status?.code);
  const entry = findCode(code);
  const mac = looseCode(td?.merchant_advice_code);
  const avs = strOf(v.avs_status?.avs_status, 8);
  const names = (v.card_name_validation ?? {}) as Record<string, unknown>;
  const nameAttr = (k: string) => {
    const x = names[k];
    return typeof x === "string" && NAME_VALIDATION_VALUES.has(x) ? x : undefined;
  };
  const tds = (td?.three_d_secure_status ?? {}) as Record<string, unknown>;
  const flow = strOf(tds.three_d_flow, 32);
  const source = strOf(tds.three_d_source, 32);
  // ECI values are 3-D Secure material and are not copied; only whether they differ.
  const eci = looseCode(tds.eci);
  const authEci = looseCode(tdRaw.auth_eci);
  const last = (v.status_changes ?? []).at(-1) as Record<string, unknown> | undefined;
  const channel = s.event
    ? "webhook"
    : ctx.meta?.http?.kind === "response"
      ? "api_response"
      : undefined;
  const actions = (v.permitted_actions ?? []).filter((a) => /^[a-z_]{1,32}$/.test(a));
  const version = webhookVersionOf(ctx.meta);
  return attrs([
    ["orderStatus", v.status],
    ["orderStatusKnown", s.statusInfo ? undefined : false],
    ["orderStatusMeaningDocumented", s.statusInfo?.meaningUndocumented ? false : undefined],
    ["orderStatusFinal", s.statusInfo?.final],
    ["deliveryChannel", channel],
    ["webhookEvent", s.event],
    ["webhookEventKnown", s.event && !s.eventInfo ? false : undefined],
    ["webhookVersion", version ? safeId(version, 16) : undefined],
    // v0.6 webhooks are unsigned; a pasted delivery is never treated as authentic.
    ["webhookSigned", s.event ? false : undefined],
    ["eventTypeSource", s.event ? "X-Webhook-Event header" : "order status"],
    ["capturedFromHold", s.capturedFromHold || undefined],
    ["statusHistory", s.history.slice(0, 50)],
    ["statusHistoryOrder", s.history.length ? "oldest_first" : undefined],
    ["latestOperationAmount", amountAsSupplied(last?.operation_amount)],
    ["latestOperationCurrency", upperCurrency(last?.currency)],
    ["processingStatusCode", code ?? looseCode(td?.processing_status?.code)],
    [
      "processingStatusKnown",
      code && entry ? undefined : td?.processing_status?.code != null ? false : undefined,
    ],
    ["processingStatusGroup", entry?.group],
    ["processingStatusDescription", td?.processing_status?.description ?? undefined],
    ["partialApproval", entry?.kind === "partial" ? true : undefined],
    ["merchantAdviceCode", mac],
    ["attemptErrorCount", td?.errors?.length || undefined],
    [
      "paymentSystem",
      v.payment_system && PAYMENT_SYSTEMS.has(v.payment_system) ? v.payment_system : undefined,
    ],
    ["permittedActions", actions],
    ["isPayable", v.is_payable ?? undefined],
    ["fromSubscription", v.from_subscription ?? undefined],
    ["avsStatus", avs && AVS_CODES.has(avs) ? avs : undefined],
    ["avsStatusKnown", avs && !AVS_CODES.has(avs) ? false : undefined],
    ["fullNameValidation", nameAttr("full_name_validation")],
    ["firstNameValidation", nameAttr("first_name_validation")],
    ["middleNameValidation", nameAttr("middle_name_validation")],
    ["lastNameValidation", nameAttr("last_name_validation")],
    ["threeDSFlow", flow === "Frictionless" || flow === "Challenge" ? flow : undefined],
    ["threeDSSource", source === "DECTA MPI" || source === "3rd party MPI" ? source : undefined],
    ["threeDSProtocol", safeId(tds.three_d_secure_protocol, 32)],
    ["eciChangedAfterAuthorization", eci && authEci ? eci !== authEci : undefined],
    ["fraudCheckCode", looseCode(td?.fraud_check_status?.code)],
    ["fraudCheckCodeInterpreted", looseCode(td?.fraud_check_status?.code) ? false : undefined],
    ["amountRefunded", amountAsSupplied(tdRaw.amount_refunded)],
    ["amountReversed", amountAsSupplied(tdRaw.amount_reversed)],
    ["amountRefundReversal", amountAsSupplied(tdRaw.amount_refund_reversal)],
    ["chargebacks", amountAsSupplied(tdRaw.chargebacks)],
    ["chargebacksReversed", amountAsSupplied(tdRaw.chargebacks_reversed)],
    ["chargebacksReasonCode", looseCode(tdRaw.chargebacks_reason_code)],
    [
      "chargebacksReasonCodeInterpreted",
      looseCode(tdRaw.chargebacks_reason_code) ? false : undefined,
    ],
    ["traceId", safeId(tdRaw.trace_id, 64)],
    ["transactionsId", idOf(raw.transactions_id)],
    ["issuedAt", isoOf(raw.issued)],
    ["viewedAt", isoOf(raw.viewed)],
    ["capturedAt", isoOf(raw.captured)],
    ["paidAt", isoOf(raw.paid)],
    ["clearedAt", isoOf(tdRaw.cleared)],
    ["settledAt", isoOf(tdRaw.settled)],
    ["httpStatus", ctx.meta?.http?.status],
  ]);
}

function orderEvent(v: OrderValue, ctx: NormalizeContext): NormalizedEventDraft {
  const s = orderState(v, ctx.meta);
  return clean({
    sourceFormat: ctx.format,
    eventType: s.eventType,
    eventTypeKnown: s.eventTypeKnown,
    stage: s.stage,
    providerStatus: safeText(v.status, 64),
    paymentReference: merchantId(v.id),
    relatedReference: idOf(v.transaction_details?.processing_payment_id),
    merchantReference: merchantId(v.number),
    isRecurring: v.from_subscription === true ? true : undefined,
    outcome: s.outcome,
    attributes: orderAttrs(v, s, ctx),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

/** Names (never values) of step fields that ask the customer to act. */
const H2H_ACTIONS = ["next_step_url", "redirectToACSForm", "threed_check_url"] as const;

function hostToHostEvent(v: HostToHostValue, ctx: NormalizeContext): NormalizedEventDraft {
  const raw = v as Record<string, unknown>;
  const code = codeOf(v.processing_status);
  const entry = findCode(code);
  const tdsStatus = typeof v.status === "string" ? v.status : undefined;
  const tdsKnown = tdsStatus ? Boolean(lookup(TDS_STATUSES, tdsStatus)) : false;
  const actions = H2H_ACTIONS.filter((k) => typeof raw[k] === "string" && raw[k] !== "");
  let eventType: string;
  let known: boolean;
  let stage: LifecycleStage;
  let outcome: Outcome;
  if (v.processing_status !== undefined && v.processing_status !== null) {
    eventType = tdsStatus ? (safeText(tdsStatus, 64) ?? "unknown") : "processing_status";
    known = tdsStatus ? tdsKnown : true;
    stage = "payment";
    outcome = kindOutcome(entry);
  } else if (tdsStatus) {
    eventType = safeText(tdsStatus, 64) ?? "unknown";
    known = tdsKnown;
    stage = "authentication";
    outcome = tdsStatus === "tds_completed" ? "unknown" : tdsKnown ? "pending" : "unknown";
  } else {
    eventType = "threed_check_url";
    known = true;
    stage = "authentication";
    outcome = "pending";
  }
  const md = looseCode(v.three_d_secure_details?.mdstatus);
  const next = v.next_step;
  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: known,
    stage,
    providerStatus: code ?? (tdsStatus ? safeText(tdsStatus, 64) : undefined),
    outcome,
    attributes: {
      ...attrs([
        ["tdsStatus", tdsStatus],
        ["tdsStatusKnown", tdsStatus && !tdsKnown ? false : undefined],
        [
          "nextStep",
          next === null && "next_step" in raw
            ? "none"
            : typeof next === "string" && TDS_NEXT_STEPS.has(next)
              ? next
              : undefined,
        ],
        ["mdstatus", md],
        ["mdstatusMeaning", md ? (lookup(MDSTATUS_MEANINGS, md) ?? "not documented") : undefined],
        ["threeDSProtocol", safeId(v.three_d_secure_details?.protocol, 32)],
        ["processingStatusCode", code ?? looseCode(v.processing_status)],
        ["processingStatusKnown", v.processing_status != null && !entry ? false : undefined],
        ["processingStatusGroup", entry?.group],
        ["partialApproval", entry?.kind === "partial" ? true : undefined],
        ["httpStatus", ctx.meta?.http?.status],
      ]),
      ...(actions.length ? { pendingAction: [...actions] } : {}),
    },
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function validationEvent(v: ValidationValue, ctx: NormalizeContext): NormalizedEventDraft {
  const fields = Object.keys(v)
    .slice(0, 50)
    .map((k) => safeText(k, 64) ?? "");
  const http = ctx.meta?.http?.status;
  return clean({
    sourceFormat: ctx.format,
    eventType: "validation_error",
    eventTypeKnown: true,
    stage: "error",
    providerStatus: http ? `HTTP ${http}` : "validation_error",
    outcome: "failure",
    attributes: attrs([
      ["fields", fields],
      ["errorCount", Object.values(v).reduce((n, list) => n + list.length, 0)],
      ["httpStatus", http],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function normalize(parsed: DectaParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "order":
      return [orderEvent(parsed.value, ctx)];
    case "host2host":
      return [hostToHostEvent(parsed.value, ctx)];
    case "validation_error":
      return [validationEvent(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
  attemptReference?: string;
};

const withRefs = (loc: Location) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
  ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
});

type Decoded = {
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  docs: DocumentationLink[];
  missing: string[];
  outcomeKnown: boolean;
};

const CODES_DOC: DocumentationLink = {
  title: "DECTA raw acquirer response codes",
  url: RESPONSE_CODES_URL,
};

/** Higher is stricter. */
const RETRY_RANK: Record<RetryGuidance, number> = {
  unknown: 0,
  safe_to_retry_technical_request: 1,
  retry_conditionally: 2,
  customer_action_required: 3,
  manual_review: 4,
  do_not_retry: 5,
};

function decodeRawCode(code: string, entry: CodeEntry, mac: string | undefined): Decoded {
  let explanation = `DECTA raw acquirer code ${code} (${entry.group}): ${entry.meaning}.`;
  if (entry.note) explanation += ` ${entry.note}`;
  const guidance = GROUP_GUIDANCE[entry.group];
  if (guidance) explanation += ` ${guidance}`;
  const docs = [CODES_DOC];
  const missing: string[] = [];
  let retry = entry.retry;
  if (mac) {
    const advice = lookup(MERCHANT_ADVICE_CODES, mac);
    docs.push({ title: "DECTA Merchant Advice Codes", url: AFTER_PAYMENT_URL });
    if (advice) {
      explanation += ` Mastercard Merchant Advice Code ${mac}: ${advice.meaning}.`;
      if (RETRY_RANK[advice.retry] > RETRY_RANK[retry]) {
        retry = advice.retry;
        explanation += " The advice code's stricter retry guidance is used.";
      }
    } else {
      missing.push(`Merchant Advice Code "${mac}" is not one of the five documented values.`);
    }
  }
  return {
    category: entry.category,
    retry,
    confidence: entry.ambiguous || entry.category === "unknown" ? "possible" : "strong",
    explanation,
    docs,
    missing,
    outcomeKnown:
      entry.category !== "provider_unavailable" && entry.category !== "network_or_timeout",
  };
}

function unknownCode(code: string | undefined, what: string, missing: string): Decoded {
  return {
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: code
      ? `${what} carries code "${code}", which is not a documented DECTA code.`
      : `${what} carries no code, so the reason is unknown.`,
    docs: [CODES_DOC, { title: "DECTA order statuses", url: PAYMENT_FLOW_URL }],
    missing: [missing],
    outcomeKnown: false,
  };
}

/** Exact match of a documented DECTA error text. */
function documentedMessage(text: string | undefined | null): Decoded | undefined {
  if (typeof text !== "string") return undefined;
  const entry = lookup(DOCUMENTED_MESSAGES, text.trim().toLowerCase());
  if (!entry) return undefined;
  return {
    category: entry.category,
    retry: entry.retry,
    confidence: "possible",
    explanation: `DECTA documents this error text: ${entry.meaning}.`,
    docs: [{ title: "DECTA documentation of this error text", url: entry.url }],
    missing: [
      "DECTA documents the text but not the field or code that carries it, so the match is shown with possible confidence.",
    ],
    outcomeKnown: entry.outcomeKnown,
  };
}

function draft(
  loc: Location,
  code: string,
  dec: Decoded,
  subCodes: Record<string, string>,
  message: string | undefined,
): DecodedErrorDraft {
  return {
    ...withRefs(loc),
    code,
    subCodes,
    category: dec.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: dec.explanation,
    nextAction: NEXT_ACTION[dec.category],
    retry: dec.retry,
    retryExplanation: RETRY_TEXT[dec.retry],
    confidence: dec.confidence,
    documentation: dec.docs,
    missingInformation: dec.missing,
    ...(dec.outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

function orderErrors(v: OrderValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const s = orderState(v, ctx.meta);
  const td = v.transaction_details ?? undefined;
  const pay = merchantId(v.id);
  const attempt = idOf(td?.processing_payment_id);
  const loc = (path: string): Location => ({
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(pay ? { paymentReference: pay } : {}),
    ...(attempt ? { attemptReference: attempt } : {}),
  });
  const shared: Record<string, string> = { order_status: safeText(v.status, 64) ?? "" };
  if (s.event) shared.webhook_event = safeText(s.event, 64) ?? "";
  const http = ctx.meta?.http?.status;
  if (http !== undefined) shared.http_status = String(http);
  const out: DecodedErrorDraft[] = [];

  const rawCode = td?.processing_status?.code;
  const code = codeOf(rawCode) ?? looseCode(rawCode);
  const entry = findCode(code);
  const mac = looseCode(td?.merchant_advice_code);
  const message = safeText(td?.processing_status?.description ?? undefined, 200);
  const path = "transaction_details.processing_status";
  if (code && entry) {
    if (entry.kind === "decline") {
      const dec = decodeRawCode(code, entry, mac);
      if (code === "-1")
        dec.missing.push("DECTA does not document which field carries the special code -1.");
      if (!pay) dec.missing.push("No usable order id; the order's later state cannot be checked.");
      const subCodes = { ...shared, status_group: entry.group };
      if (mac) Object.assign(subCodes, { merchant_advice_code: mac });
      out.push(draft(loc(path), code, dec, subCodes, message));
    }
  } else if (code && s.outcome === "failure") {
    const dec = unknownCode(
      code,
      "transaction_details.processing_status",
      `Code "${code}" is not in DECTA's raw acquirer response code table.`,
    );
    out.push(draft(loc(path), code, dec, { ...shared }, message));
  }

  const items = (td?.errors ?? []).slice(0, 50);
  items.forEach((item, i) => {
    const itemCode = looseCode(item.code);
    const dec =
      documentedMessage(item.description) ??
      unknownCode(
        itemCode,
        "The transaction_details.errors[] item",
        "DECTA does not document the code vocabulary of transaction_details.errors[].",
      );
    const subCodes: Record<string, string> = { ...shared };
    if (itemCode) subCodes.error_code = itemCode;
    out.push(
      draft(
        loc(`transaction_details.errors[${i}]`),
        itemCode ?? "unknown",
        dec,
        subCodes,
        safeText(item.description ?? undefined, 200),
      ),
    );
  });

  // A failed operation with no code at all is still reported, honestly, as unknown.
  if (out.length === 0 && !code && s.outcome === "failure") {
    const what = s.event
      ? `The ${safeText(s.event, 64)} webhook`
      : `The order with status ${safeText(v.status, 64)}`;
    const dec = unknownCode(
      undefined,
      what,
      "The order carries no transaction_details.processing_status code and no errors[]; with response_type=minimum these fields may be left out.",
    );
    out.push(
      draft(
        loc(""),
        s.event ? s.eventType : (safeText(v.status, 64) ?? "unknown"),
        dec,
        { ...shared },
        undefined,
      ),
    );
  }
  return out;
}

function hostToHostErrors(v: HostToHostValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (v.processing_status === undefined || v.processing_status === null) return [];
  const code = codeOf(v.processing_status) ?? looseCode(v.processing_status);
  const entry = findCode(code);
  const loc: Location = {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "processing_status" },
  };
  const subCodes: Record<string, string> = {};
  if (typeof v.status === "string") subCodes.tds_status = safeText(v.status, 64) ?? "";
  const http = ctx.meta?.http?.status;
  if (http !== undefined) subCodes.http_status = String(http);
  const noOrder =
    "Host2Host and 3-D Secure step responses carry no order id; check the order with GET order to confirm the final status.";
  if (code && entry) {
    if (entry.kind !== "decline") return [];
    const dec = decodeRawCode(code, entry, undefined);
    dec.missing.push(noOrder);
    return [draft(loc, code, dec, { ...subCodes, status_group: entry.group }, undefined)];
  }
  const dec = unknownCode(
    code,
    "The processing_status",
    `Code "${code ?? ""}" is not in DECTA's raw acquirer response code table.`,
  );
  dec.missing.push(noOrder);
  return [draft(loc, code ?? "unknown", dec, subCodes, undefined)];
}

function validationErrors(v: ValidationValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const out: DecodedErrorDraft[] = [];
  const http = ctx.meta?.http?.status;
  const httpMeaning = http !== undefined ? lookup(HTTP_STATUSES, http) : undefined;
  for (const field of Object.keys(v).slice(0, 50)) {
    const list = v[field] ?? [];
    list.slice(0, 20).forEach((item, i) => {
      const code = looseCode(item.code);
      const general = field === "__all__";
      const documented = general ? documentedMessage(item.message) : undefined;
      const known = code ? lookup(VALIDATION_CODES, code) : undefined;
      const fieldName = safeText(field, 64) ?? "";
      const dec: Decoded = documented ?? {
        category: "invalid_request",
        retry: "do_not_retry",
        confidence: known ? "strong" : "possible",
        explanation: general
          ? `DECTA rejected the request with an error not tied to a field (__all__)${code ? `, code "${code}"` : ""}.`
          : `DECTA rejected the request field "${fieldName}"${known ? `: ${known.toLowerCase()}` : code ? ` with code "${code}"` : ""}.`,
        docs: [{ title: "Decta Gate API (OpenAPI): error format", url: OPENAPI_URL }],
        missing: known
          ? []
          : [
              `Code "${code ?? ""}" is not in DECTA's examples; the full list of validation error codes is not documented.`,
            ],
        outcomeKnown: false,
      };
      if (httpMeaning) dec.explanation += ` HTTP ${http}: ${httpMeaning}.`;
      dec.explanation += " The request was not accepted; this is not a payment status.";
      const subCodes: Record<string, string> = { field: fieldName };
      if (http !== undefined) subCodes.http_status = String(http);
      out.push(
        draft(
          {
            sourceFormat: ctx.format,
            source: { recordIndex: ctx.recordIndex, path: `${field}[${i}]` },
          },
          code ?? "unknown",
          dec,
          subCodes,
          safeText(item.message, 200),
        ),
      );
    });
  }
  return out;
}

function decodeErrors(parsed: DectaParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "order":
      return orderErrors(parsed.value, ctx);
    case "host2host":
      return hostToHostErrors(parsed.value, ctx);
    case "validation_error":
      return validationErrors(parsed.value, ctx);
  }
}

export const dectaAdapter: ProviderAdapter<DectaParsed> = {
  id: PROVIDER,
  displayName: "DECTA",
  version: DECTA_ADAPTER_VERSION,
  manifest: dectaManifest,
  supportedFormats: [
    {
      id: "decta.order",
      description:
        "Decta Gate API v0.6 Order object (API response or order.* / oct.* webhook body)",
    },
    {
      id: "decta.host2host",
      description:
        "Host2Host, wallet and manual 3-D Secure step responses (processing_status, threed_check_url, status tds_*)",
    },
    {
      id: "decta.validation_error",
      description: "API validation error object ({ <field>: [{ message, code }] })",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // The order id spans authorization, capture, refund and reversal of one order.
    if (event.sourceFormat === "decta.order" && event.paymentReference)
      return [`order:${event.paymentReference.toLowerCase()}`];
    return [];
  },
};

export * from "./catalog.js";
export default dectaAdapter;
