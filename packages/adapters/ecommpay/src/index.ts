/**
 * Ecommpay adapter (Gate API, OpenAPI 3.38.1).
 *
 * Supported input families:
 * - `ecommpay.callback`             Gate payment callback: project_id, payment, a single
 *                                   operation and signature. There is no event type field.
 * - `ecommpay.payment_status`       /v2/payment/status response: payment, operations[]
 *                                   (or one operation with last_failed_request) and errors[]
 * - `ecommpay.request_error`        request-level error { status: "error", code, message }
 * - `ecommpay.request_accepted`     asynchronous acceptance { status: "success", request_id,
 *                                   project_id, payment_id }
 * - `ecommpay.chargeback_callback`  chargeback summary and detailed callbacks (unsigned)
 *
 * Recognized but not supported: `ecommpay.token_callback` (tokenize, token_revoke).
 *
 * A payment holds one or more operations. The operation carries the step
 * (type, status, code); payment.status is the aggregate and is kept as an
 * attribute so that a refund is never read as a new payment.
 */

import {
  lookup,
  minorUnits,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type ErrorCategory,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type ProviderAdapter,
  type RecordMeta,
  type RetryGuidance,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  CHARGEBACK_EVENTS,
  CODE_FAMILIES,
  CODE_FAMILY_LABELS,
  CODES_URL,
  GATE_URL,
  HTTP_STATUSES,
  NEXT_ACTION,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  PAYMENT_RESULT_FAQ_URL,
  PAYMENT_STATUSES,
  PRESCRIPTIVE_FIELDS,
  RETRY_TEXT,
  STATUS_REQUEST_URL,
  TOKEN_ACTIONS,
  type CodeEntry,
  type CodeFamily,
} from "./catalog.js";
import { ecommpayManifest, ECOMMPAY_ADAPTER_VERSION } from "./manifest.js";

export { ecommpayManifest, ECOMMPAY_ADAPTER_VERSION };

const PROVIDER = "ecommpay";

const Code = z.union([z.string().max(32), z.number().int()]);
const Num = z.union([z.number(), z.string().max(40)]);
const Id = z.union([z.number().int(), z.string().max(256)]);
const NStr = (max: number) => z.string().max(max).nullable().optional();
const NId = Id.nullable().optional();

const Sum = z.looseObject({ amount: Num.nullable().optional(), currency: NStr(8) });

const ProviderInfo = z.looseObject({
  id: NId,
  payment_id: NId,
  date: NStr(64),
  endpoint_id: NId,
  result_code: Code.nullable().optional(),
  result_message: NStr(2000),
});

const Operation = z.looseObject({
  id: NId,
  type: z.string().max(64),
  status: z.string().max(64),
  date: NStr(64),
  created_date: NStr(64),
  request_id: NStr(256),
  sum_initial: Sum.nullable().optional(),
  sum_converted: Sum.nullable().optional(),
  code: Code.nullable().optional(),
  message: NStr(2000),
  eci: Code.nullable().optional(),
  provider: ProviderInfo.nullable().optional(),
  recurring_retry: z.looseObject({ trigger_operation_id: NId }).nullable().optional(),
});

const Payment = z.looseObject({
  id: z.string().max(256),
  type: z.string().max(64),
  status: z.string().max(64),
  date: NStr(64),
  method: NStr(64),
  sum: Sum.nullable().optional(),
  region: NStr(64),
  is_new_attempts_available: z.boolean().nullable().optional(),
  cascading_with_redirect: z.boolean().nullable().optional(),
  merchant_refund_id: NStr(256),
});

const ErrorItem = z.looseObject({
  code: Code.nullable().optional(),
  message: NStr(2000),
  field: NStr(256),
  description: NStr(2000),
  constraint: NStr(256),
});

const Recurring = z.looseObject({ id: NId, status: NStr(32), register_payment_id: NStr(256) });

const common = {
  signature: NStr(2048),
  errors: z.array(ErrorItem).max(200).nullable().optional(),
  recurring: Recurring.nullable().optional(),
};

const Callback = z.looseObject({
  project_id: z.number().int(),
  payment: Payment,
  operation: Operation,
  ...common,
});

const PaymentStatus = z.looseObject({
  project_id: z.number().int().nullable().optional(),
  payment: Payment.extend({ type: NStr(64) }),
  operations: z.array(Operation).max(1000).nullable().optional(),
  operation: Operation.nullable().optional(),
  ...common,
});

const RequestError = z.looseObject({
  status: z.literal("error"),
  code: Code,
  message: z.string().max(2000),
});

const RequestAccepted = z.looseObject({
  status: z.literal("success"),
  request_id: z.string().max(256),
  project_id: z.number().int(),
  payment_id: z.string().max(256),
});

const ChargebackItem = z.looseObject({
  chargeback_id: NId,
  case_id: NId,
  operation_id: NId,
  card_type: NStr(64),
  chargeback_status: NStr(64),
  reason_code: Code.nullable().optional(),
});

const Chargeback = z.looseObject({
  event: z.string().max(64),
  event_date: NStr(64),
  chargeback_count: z.number().int().nullable().optional(),
  chargebacks: z.array(ChargebackItem).max(5000).nullable().optional(),
});

type OperationValue = z.infer<typeof Operation>;
type PaymentValue = z.infer<typeof PaymentStatus>["payment"];
type ErrorItemValue = z.infer<typeof ErrorItem>;
type Envelope = {
  payment: PaymentValue;
  recurring?: z.infer<typeof Recurring> | null;
  signature?: string | null;
  errors?: ErrorItemValue[] | null;
};

export type EcommpayParsed =
  | { kind: "callback"; value: z.infer<typeof Callback> }
  | { kind: "payment_status"; value: z.infer<typeof PaymentStatus> }
  | { kind: "request_error"; value: z.infer<typeof RequestError> }
  | { kind: "request_accepted"; value: z.infer<typeof RequestAccepted> }
  | { kind: "chargeback"; value: z.infer<typeof Chargeback> };

const FORMATS = {
  "ecommpay.callback": ["callback", Callback],
  "ecommpay.payment_status": ["payment_status", PaymentStatus],
  "ecommpay.request_error": ["request_error", RequestError],
  "ecommpay.request_accepted": ["request_accepted", RequestAccepted],
  "ecommpay.chargeback_callback": ["chargeback", Chargeback],
} as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Codes are strings in operation.code and integers in the OpenAPI ErrorItem. */
function codeOf(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) && v >= 0 ? String(v) : v;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return /^[0-9A-Za-z_-]{1,32}$/.test(t) ? t : undefined;
}

/** Card network reason codes such as "10.4" contain dots. */
const reasonCodeOf = (v: unknown): string | undefined => {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
  return typeof s === "string" && /^[0-9A-Za-z._-]{1,16}$/.test(s.trim()) ? s.trim() : undefined;
};

const numericCode = (v: unknown) => {
  const c = codeOf(v);
  return c && /^\d{1,6}$/.test(c) ? c : undefined;
};

/** Looks a code up in its own family; families never share a value. */
export function findCode(code: string): { family: CodeFamily; entry: CodeEntry } | undefined {
  for (const [family, table] of CODE_FAMILIES) {
    const entry = lookup(table, code);
    if (entry) return { family, entry };
  }
  return undefined;
}

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
  // Stripe payloads carry `object`; Ecommpay payloads never do.
  if ("object" in input) return none;

  // Chargeback callbacks: one of nine documented event names.
  if (typeof input.event === "string" && lookup(CHARGEBACK_EVENTS, input.event)) {
    const reasons = ["event is a documented chargeback callback event"];
    let score = 0.6;
    if (typeof input.event_date === "string") {
      score += 0.15;
      reasons.push("has event_date");
    }
    if ("project_id" in input || "merchant_id" in input) {
      score += 0.1;
      reasons.push("has project_id or merchant_id");
    }
    if (Array.isArray(input.chargebacks) || typeof input.chargeback_count === "number") {
      score += 0.1;
      reasons.push("has chargebacks[] or chargeback_count");
    }
    return {
      ...base,
      format: "ecommpay.chargeback_callback",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  // Token callbacks: general wrapper with a tokenize/token_revoke request or token_status.
  if (isObj(input.general)) {
    const req = isObj(input.request) ? input.request : undefined;
    const action = typeof req?.action === "string" && TOKEN_ACTIONS.has(req.action);
    if (action || typeof input.token_status === "string") {
      return {
        ...base,
        format: "ecommpay.token_callback",
        confidence: "project_id" in input.general ? 0.9 : 0.8,
        supported: false,
        reasons: ["has the general wrapper with a token request or token_status"],
        unsupportedReason:
          "Ecommpay token callbacks (tokenize, token_revoke) carry no payment lifecycle and are recognized but not analyzed.",
      };
    }
  }

  // Payment callbacks and status responses share payment + operation(s).
  if (isObj(input.payment)) {
    const p = input.payment;
    const ops = Array.isArray(input.operations) ? input.operations : undefined;
    const op = isObj(input.operation) ? input.operation : undefined;
    if (typeof p.id === "string" && typeof p.status === "string" && (op || ops)) {
      const reasons = ["has a payment object (id, status) with operation or operations[]"];
      let score = 0.35;
      if (typeof input.project_id === "number" && Number.isInteger(input.project_id)) {
        score += 0.2;
        reasons.push("has an integer project_id");
      }
      if (typeof input.signature === "string") {
        score += 0.1;
        reasons.push("has a top-level signature");
      }
      if (lookup(PAYMENT_STATUSES, p.status)) {
        score += 0.1;
        reasons.push("payment.status is a documented Ecommpay payment status");
      }
      const first = op ?? ops?.find(isObj);
      if (first && typeof first.status === "string" && lookup(OPERATION_STATUSES, first.status)) {
        score += 0.1;
        reasons.push("operation status is a documented Ecommpay operation status");
      }
      if (first && ("sum_initial" in first || "request_id" in first || isObj(first.provider))) {
        score += 0.1;
        reasons.push("operation has sum_initial, request_id or provider");
      }
      const status =
        Boolean(ops) || "last_failed_request" in input || meta?.http?.kind === "response";
      return {
        ...base,
        format: status ? "ecommpay.payment_status" : "ecommpay.callback",
        confidence: round(score),
        supported: true,
        reasons,
      };
    }
  }

  // Asynchronous acceptance.
  if (
    input.status === "success" &&
    typeof input.request_id === "string" &&
    typeof input.payment_id === "string"
  ) {
    const project = typeof input.project_id === "number" && Number.isInteger(input.project_id);
    return {
      ...base,
      format: "ecommpay.request_accepted",
      confidence: project ? 0.85 : 0.4,
      supported: true,
      reasons: [
        "has status success with request_id and payment_id",
        ...(project ? ["has an integer project_id"] : []),
      ],
    };
  }

  // Request-level error. { status, code, message } is a generic shape, so it is
  // never claimed above 0.5 without distinctive fields.
  if (input.status === "error" && typeof input.message === "string") {
    const code = numericCode(input.code);
    if (!code) return none;
    const found = findCode(code);
    const extra = Object.keys(input).filter((k) => !["status", "code", "message"].includes(k));
    if (extra.length > 0) return none;
    const known = found && (found.family === "general" || found.family === "risk");
    const http = meta?.http?.status;
    let confidence = known ? 0.5 : 0.3;
    if (!known && http !== undefined && lookup(HTTP_STATUSES, http)) confidence = 0.5;
    return {
      ...base,
      format: "ecommpay.request_error",
      confidence,
      supported: true,
      reasons: [
        "body is exactly { status: error, code, message }",
        ...(known ? ["code is a documented Ecommpay general or risk code"] : []),
        ...(!known && confidence === 0.5 ? ["arrived with a documented Gate HTTP status"] : []),
      ],
    };
  }
  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: EcommpayParsed } | { ok: false; issues: string[] } {
  if (!Object.prototype.hasOwnProperty.call(FORMATS, format))
    return { ok: false, issues: [`Unsupported Ecommpay format "${format}".`] };
  const entry = FORMATS[format as keyof typeof FORMATS];
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as EcommpayParsed };
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
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

/** Platform ids are integers; strings are accepted when identifier-like. */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  return merchantId(v);
}

/**
 * Ecommpay dates are `YYYY-MM-DDThh:mm:ss+0000`. Only values with an explicit
 * zone are converted, so the timeline never depends on the local time zone.
 */
function ecTime(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 64) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/i.exec(
    v.trim(),
  );
  if (!m) return undefined;
  const frac = m[3] ? m[3].slice(0, 4) : "";
  const zone = m[4]!.toUpperCase() === "Z" ? "Z" : `${m[4]!.slice(0, 3)}:${m[4]!.slice(-2)}`;
  return toIsoTimestamp(`${m[1]}T${m[2]}${frac}${zone}`);
}

const observedOf = (ctx: NormalizeContext) =>
  ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

function sumOf(s: z.infer<typeof Sum> | null | undefined): { minor?: string; currency?: string } {
  if (!s) return {};
  return { minor: minorUnits(s.amount), currency: upperCurrency(s.currency) };
}

/** Names (never values) of prescriptive callback objects that ask someone to act. */
function pendingActions(raw: unknown): string[] {
  if (!isObj(raw)) return [];
  return PRESCRIPTIVE_FIELDS.filter((f) => raw[f] !== undefined && raw[f] !== null);
}

function envelopeAttrs(env: Envelope): [string, unknown][] {
  const p = env.payment;
  const pay = sumOf(p.sum);
  const statusKnown = lookup(PAYMENT_STATUSES, p.status);
  return [
    ["paymentType", p.type ?? undefined],
    ["paymentStatus", p.status],
    ["paymentStatusKnown", statusKnown ? undefined : false],
    ["paymentMethod", p.method ?? undefined],
    ["paymentRegion", p.region ?? undefined],
    ["paymentAmountMinor", pay.minor],
    ["paymentCurrency", pay.currency],
    ["isNewAttemptsAvailable", p.is_new_attempts_available ?? undefined],
    ["cascadingWithRedirect", p.cascading_with_redirect ?? undefined],
    ["merchantRefundId", merchantId(p.merchant_refund_id)],
    ["recurringId", idOf(env.recurring?.id)],
    ["recurringStatus", env.recurring?.status ?? undefined],
    ["recurringRegisterPaymentId", merchantId(env.recurring?.register_payment_id)],
    // Presence only: the signature is never copied or verified.
    ["signaturePresent", typeof env.signature === "string" ? true : undefined],
  ];
}

function operationEvent(
  env: Envelope,
  op: OperationValue,
  raw: unknown,
  ctx: NormalizeContext,
  path: string,
  callback: boolean,
): NormalizedEventDraft {
  const typeInfo = lookup(OPERATION_TYPES, op.type);
  const statusInfo = lookup(OPERATION_STATUSES, op.status);
  const amount = sumOf(op.sum_initial);
  const converted = sumOf(op.sum_converted);
  const code = codeOf(op.code);
  const found = code ? findCode(code) : undefined;
  const opDate = ecTime(op.date);
  const payDate = ecTime(env.payment.date);
  const pr = op.provider;
  const actions = pendingActions(raw);

  return clean({
    sourceFormat: ctx.format,
    eventType: `${safeText(op.type, 64) ?? "operation"}.${safeText(op.status, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(typeInfo && statusInfo),
    stage: typeInfo?.stage ?? "other",
    providerStatus: safeText(op.status, 64),
    paymentReference: merchantId(env.payment.id),
    relatedReference: idOf(op.id),
    subscriptionReference: idOf(env.recurring?.id),
    isRecurring: typeInfo?.recurring ? true : undefined,
    eventTimestamp: opDate ?? payDate,
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: statusInfo?.outcome ?? "unknown",
    attributes: {
      ...attrs([
        ["eventTypeInferred", callback ? true : undefined],
        [
          "eventTypeInferredFrom",
          callback
            ? "operation.type and operation.status (Ecommpay callbacks carry no event type)"
            : undefined,
        ],
        ["operationType", op.type],
        ["operationStatus", op.status],
        ["operationTypeKnown", typeInfo ? undefined : false],
        ["operationCode", code],
        ["operationCodeFamily", found?.family],
        ["operationMessage", op.message ?? undefined],
        ["eci", codeOf(op.eci)],
        ["requestId", safeId(op.request_id)],
        ["operationCreatedAt", ecTime(op.created_date)],
        ["nonPaymentOperation", typeInfo?.nonPayment],
        ["convertedAmountMinor", converted.minor],
        ["convertedCurrency", converted.currency],
        ["providerId", idOf(pr?.id)],
        ["providerPaymentId", idOf(pr?.payment_id)],
        ["providerEndpointId", idOf(pr?.endpoint_id)],
        ["providerDate", ecTime(pr?.date)],
        ["providerResultCode", codeOf(pr?.result_code)],
        ["providerResultMessage", pr?.result_message ?? undefined],
        ["recurringRetryTriggerOperationId", idOf(op.recurring_retry?.trigger_operation_id)],
        ...envelopeAttrs(env),
        ["timestampSource", opDate ? "operation.date" : payDate ? "payment.date" : undefined],
        ["httpStatus", ctx.meta?.http?.status],
      ]),
      ...(actions.length ? { pendingAction: actions } : {}),
    },
    source: { recordIndex: ctx.recordIndex, path },
    ...observedOf(ctx),
  });
}

/** A status response without operations: only the aggregate payment status is known. */
function paymentEvent(env: Envelope, ctx: NormalizeContext): NormalizedEventDraft {
  const info = lookup(PAYMENT_STATUSES, env.payment.status);
  const amount = sumOf(env.payment.sum);
  return clean({
    sourceFormat: ctx.format,
    eventType: `payment.${safeText(env.payment.status, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? "other",
    providerStatus: safeText(env.payment.status, 64),
    paymentReference: merchantId(env.payment.id),
    subscriptionReference: idOf(env.recurring?.id),
    eventTimestamp: ecTime(env.payment.date),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs([
      ...envelopeAttrs(env),
      ["noOperations", true],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "payment" },
    ...observedOf(ctx),
  });
}

function chargebackEvents(
  v: z.infer<typeof Chargeback>,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const info = lookup(CHARGEBACK_EVENTS, v.event);
  const eventTimestamp = ecTime(v.event_date);
  const dateOnly =
    typeof v.event_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.event_date)
      ? v.event_date
      : undefined;
  const shared: [string, unknown][] = [
    ["event", v.event],
    ["eventDescription", info?.description],
    ["callbackSigned", false],
    ["callbackResent", false],
    ["eventDate", dateOnly],
  ];
  const base = {
    sourceFormat: ctx.format,
    eventType: safeText(v.event, 64) ?? "unknown",
    eventTypeKnown: Boolean(info),
    stage: "dispute" as const,
    eventTimestamp,
    ...observedOf(ctx),
  };
  const items = v.chargebacks ?? [];
  if (info?.kind === "summary" || items.length === 0) {
    return [
      clean({
        ...base,
        outcome: info?.kind === "details" ? info.outcome : "unknown",
        attributes: attrs([...shared, ["chargebackCount", v.chargeback_count ?? undefined]]),
        source: { recordIndex: ctx.recordIndex, path: "" },
      }),
    ];
  }
  return items.map((cb, i) =>
    clean({
      ...base,
      outcome: info?.outcome ?? "unknown",
      providerStatus: safeText(cb.chargeback_status ?? undefined, 64),
      // The disputed operation is the only documented link to the payment.
      paymentReference: idOf(cb.operation_id),
      relatedReference: idOf(cb.chargeback_id),
      attributes: attrs([
        ...shared,
        ["paymentReferenceField", idOf(cb.operation_id) ? "chargebacks[].operation_id" : undefined],
        ["chargebackId", idOf(cb.chargeback_id)],
        ["caseId", idOf(cb.case_id)],
        ["cardType", cb.card_type ?? undefined],
        ["chargebackStatus", cb.chargeback_status ?? undefined],
        ["reasonCode", reasonCodeOf(cb.reason_code)],
        ["reasonCodeInterpreted", reasonCodeOf(cb.reason_code) ? false : undefined],
      ]),
      source: { recordIndex: ctx.recordIndex, path: `chargebacks[${i}]` },
    }),
  );
}

function normalize(parsed: EcommpayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "callback": {
      const v = parsed.value;
      return [operationEvent(v, v.operation, v, ctx, "operation", true)];
    }
    case "payment_status": {
      const v = parsed.value;
      if (v.operations?.length)
        return v.operations.map((op, i) =>
          operationEvent(v, op, v, ctx, `operations[${i}]`, false),
        );
      if (v.operation) return [operationEvent(v, v.operation, v, ctx, "operation", false)];
      return [paymentEvent(v, ctx)];
    }
    case "request_accepted": {
      const v = parsed.value;
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: "request.accepted",
          eventTypeKnown: true,
          stage: "other",
          providerStatus: "success",
          paymentReference: merchantId(v.payment_id),
          outcome: "pending",
          attributes: attrs([
            ["requestStatus", "success"],
            ["requestId", safeId(v.request_id)],
            [
              "note",
              "The request was accepted for asynchronous processing; the result arrives in a callback.",
            ],
            ["httpStatus", ctx.meta?.http?.status],
          ]),
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...observedOf(ctx),
        }),
      ];
    }
    case "request_error": {
      const v = parsed.value;
      const code = codeOf(v.code);
      const found = code ? findCode(code) : undefined;
      const http = ctx.meta?.http?.status;
      const uncertain =
        !found ||
        found.entry.category === "unknown" ||
        found.entry.category === "provider_unavailable" ||
        found.entry.category === "network_or_timeout";
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: `request_error.${code ?? "unknown"}`,
          eventTypeKnown: true,
          stage: "error",
          providerStatus: http ? `HTTP ${http}` : "error",
          outcome: uncertain ? "unknown" : "failure",
          attributes: attrs([
            ["requestStatus", "error"],
            ["code", code],
            ["codeFamily", found?.family],
            ["message", v.message],
            ["httpStatus", http],
          ]),
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...observedOf(ctx),
        }),
      ];
    }
    case "chargeback":
      return chargebackEvents(parsed.value, ctx);
  }
}

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

const RISK_ACTION =
  " Ecommpay's action for risk control codes: no action is required; support can be asked.";

type Decoded = {
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  docs: DocumentationLink[];
  missing: string[];
};

function decodeCode(code: string | undefined): Decoded | undefined {
  const found = code ? findCode(code) : undefined;
  if (!found || !code) return undefined;
  const { family, entry } = found;
  let explanation = `Ecommpay ${CODE_FAMILY_LABELS[family]} code ${code}: ${entry.meaning}.`;
  if (family === "risk") explanation += RISK_ACTION;
  if (entry.note) explanation += ` ${entry.note}`;
  return {
    category: entry.category,
    retry: entry.retry,
    confidence: entry.category === "unknown" || entry.ambiguous ? "possible" : "strong",
    explanation,
    docs: [{ title: "Ecommpay payment information codes", url: CODES_URL }],
    missing: [],
  };
}

function unknownCode(code: string | undefined, what: string): Decoded {
  return {
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: code
      ? `${what} carries code "${code}", which is not a documented Ecommpay code.`
      : `${what} carries no code, so the reason is unknown.`,
    docs: [
      { title: "Ecommpay payment information codes", url: CODES_URL },
      { title: "Where Ecommpay reports codes", url: PAYMENT_RESULT_FAQ_URL },
    ],
    missing: [
      code
        ? `Code "${code}" is not in the PandaPayLens catalog; Ecommpay does not say its code list is exhaustive.`
        : "No operation.code was supplied (callback fields are configurable per project).",
    ],
  };
}

function draft(
  loc: Location,
  code: string,
  d: Decoded,
  subCodes: Record<string, string>,
  message: string | undefined,
  outcomeKnown: boolean,
): DecodedErrorDraft {
  return {
    ...withRefs(loc),
    code,
    subCodes,
    category: d.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: d.explanation,
    nextAction: NEXT_ACTION[d.category],
    retry: d.retry,
    retryExplanation: RETRY_TEXT[d.retry],
    confidence: d.confidence,
    documentation: d.docs,
    missingInformation: d.missing,
    ...(outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

/** Decodes operation.code with the operation's own status. */
export function decodeOperation(
  op: OperationValue,
  payment: PaymentValue,
  loc: Location,
): DecodedErrorDraft | undefined {
  const code = codeOf(op.code);
  const found = code ? findCode(code) : undefined;
  const statusInfo = lookup(OPERATION_STATUSES, op.status);
  if (found && found.entry.kind !== "decline") return undefined;
  if (!found) {
    // Without a documented decline code only a decline, or an unknown code on
    // an operation that did not succeed, is an error.
    if (!code && op.status !== "decline") return undefined;
    if (code && (statusInfo?.outcome === "success" || statusInfo?.outcome === "pending"))
      return undefined;
  }
  const d = decodeCode(code) ?? unknownCode(code, `The ${safeText(op.type, 64)} operation`);
  const subCodes: Record<string, string> = {};
  if (found) subCodes.code_family = found.family;
  subCodes.operation_type = safeText(op.type, 64) ?? "";
  subCodes.operation_status = safeText(op.status, 64) ?? "";
  subCodes.payment_status = safeText(payment.status, 64) ?? "";
  const providerCode = codeOf(op.provider?.result_code);
  if (providerCode) {
    subCodes.provider_result_code = providerCode;
    d.missing.push(
      "operation.provider.result_code is specific to the downstream provider and is shown without interpretation.",
    );
  }
  if (!loc.paymentReference)
    d.missing.push(
      "No usable payment.id; the later state of this payment cannot be checked from this record.",
    );
  // A decline is a definitive platform answer, except where the category
  // says the external side did not answer.
  const outcomeKnown =
    op.status === "decline" &&
    d.category !== "network_or_timeout" &&
    d.category !== "provider_unavailable";
  return draft(
    loc,
    code ?? safeText(op.status, 64) ?? "unknown",
    d,
    subCodes,
    safeText(op.message ?? undefined, 200),
    outcomeKnown,
  );
}

/** Decodes one platform rejection from an errors[] array. */
function decodeErrorItem(item: ErrorItemValue, loc: Location): DecodedErrorDraft {
  const code = codeOf(item.code);
  const d = decodeCode(code) ?? unknownCode(code, "The errors[] item");
  const description = safeText(item.description ?? undefined, 200);
  if (description) d.explanation += ` Ecommpay description: "${description}".`;
  const subCodes: Record<string, string> = {};
  const found = code ? findCode(code) : undefined;
  if (found) subCodes.code_family = found.family;
  const field = safeText(item.field ?? undefined, 64);
  if (field) subCodes.field = field;
  const constraint = safeText(item.constraint ?? undefined, 64);
  if (constraint) subCodes.constraint = constraint;
  d.docs.push({ title: "Ecommpay payment status request", url: STATUS_REQUEST_URL });
  return draft(
    loc,
    code ?? "unknown",
    d,
    subCodes,
    safeText(item.message ?? undefined, 200),
    false,
  );
}

/** Decodes a request-level error, falling back to the documented HTTP status. */
export function decodeRequestError(
  v: z.infer<typeof RequestError>,
  httpStatus: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const code = codeOf(v.code);
  let d = decodeCode(code);
  const http = httpStatus !== undefined ? lookup(HTTP_STATUSES, httpStatus) : undefined;
  if (!d && http) {
    d = {
      category: http.category,
      retry: http.retry,
      confidence: "possible",
      explanation: `HTTP ${httpStatus}: ${http.meaning}. The code "${safeText(code ?? "", 32)}" is not a documented Ecommpay code.`,
      docs: [{ title: "Ecommpay Gate interaction (HTTP statuses)", url: GATE_URL }],
      missing: [`Code "${safeText(code ?? "", 32)}" is not in the PandaPayLens catalog.`],
    };
  }
  if (!d) {
    d = unknownCode(code, "The request error");
    if (httpStatus === undefined)
      d.missing.push("No HTTP status was supplied, so no fallback category is available.");
  }
  d.explanation +=
    " The request status error means the request was not accepted; it is not a payment status.";
  const subCodes: Record<string, string> = {};
  const found = code ? findCode(code) : undefined;
  if (found) subCodes.code_family = found.family;
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  return draft(loc, code ?? "unknown", d, subCodes, safeText(v.message, 200), false);
}

function envelopeErrors(env: Envelope, loc: Location): DecodedErrorDraft[] {
  return (env.errors ?? [])
    .slice(0, 50)
    .map((item, i) =>
      decodeErrorItem(item, { ...loc, source: { ...loc.source, path: `errors[${i}]` } }),
    );
}

function decodeErrors(parsed: EcommpayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  if (parsed.kind === "request_error")
    return [
      decodeRequestError(parsed.value, ctx.meta?.http?.status, {
        sourceFormat: ctx.format,
        source,
      }),
    ];
  if (parsed.kind !== "callback" && parsed.kind !== "payment_status") return [];

  const v = parsed.value;
  const pay = merchantId(v.payment.id);
  const loc: Location = {
    sourceFormat: ctx.format,
    source,
    ...(pay ? { paymentReference: pay } : {}),
  };
  const out: DecodedErrorDraft[] = [];
  const ops: [OperationValue, string][] =
    parsed.kind === "callback"
      ? [[parsed.value.operation, "operation"]]
      : parsed.value.operations?.length
        ? parsed.value.operations.map(
            (op, i) => [op, `operations[${i}]`] as [OperationValue, string],
          )
        : parsed.value.operation
          ? [[parsed.value.operation, "operation"]]
          : [];
  for (const [op, path] of ops) {
    const attempt = idOf(op.id);
    const err = decodeOperation(op, v.payment, {
      ...loc,
      source: { ...source, path },
      ...(attempt ? { attemptReference: attempt } : {}),
    });
    if (err) out.push(err);
  }
  out.push(...envelopeErrors(v, loc));
  // A status response without operations: a failed payment with no code is
  // still reported, honestly, as unknown.
  if (ops.length === 0 && out.length === 0) {
    const info = lookup(PAYMENT_STATUSES, v.payment.status);
    if (info?.outcome === "failure") {
      const d = unknownCode(undefined, `The payment with status ${safeText(v.payment.status, 64)}`);
      d.missing[0] =
        "The status response carries no operations and no errors[], so the reason is unknown.";
      out.push(
        draft(
          { ...loc, source: { ...source, path: "payment" } },
          safeText(v.payment.status, 64) ?? "unknown",
          d,
          { payment_status: safeText(v.payment.status, 64) ?? "" },
          undefined,
          false,
        ),
      );
    }
  }
  return out;
}

export const ecommpayAdapter: ProviderAdapter<EcommpayParsed> = {
  id: PROVIDER,
  displayName: "Ecommpay",
  version: ECOMMPAY_ADAPTER_VERSION,
  manifest: ecommpayManifest,
  supportedFormats: [
    {
      id: "ecommpay.callback",
      description: "Gate payment callback (project_id, payment, operation, signature)",
    },
    {
      id: "ecommpay.payment_status",
      description: "Gate payment status response (payment, operations[], errors[])",
    },
    {
      id: "ecommpay.request_error",
      description: "Gate request-level error ({ status: error, code, message })",
    },
    {
      id: "ecommpay.request_accepted",
      description:
        "Gate asynchronous acceptance ({ status: success, request_id, project_id, payment_id })",
    },
    {
      id: "ecommpay.chargeback_callback",
      description: "Chargeback summary and detailed callbacks (unsigned)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    const keys: string[] = [];
    if (event.sourceFormat === "ecommpay.chargeback_callback") {
      // operation_id links a chargeback to the disputed operation; chargeback_id
      // links the later stages of the same chargeback.
      if (event.paymentReference) keys.push(`operation:${event.paymentReference}`);
      if (event.relatedReference) keys.push(`chargeback:${event.relatedReference}`);
      return keys;
    }
    // payment.id is shared by every operation of a payment and is case-insensitive.
    if (event.paymentReference) keys.push(`payment:${event.paymentReference.toLowerCase()}`);
    if (event.relatedReference) keys.push(`operation:${event.relatedReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export default ecommpayAdapter;
