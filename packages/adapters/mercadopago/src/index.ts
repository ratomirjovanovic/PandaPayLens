/**
 * Mercado Pago adapter.
 *
 * Supported input families:
 * - `mercadopago.payment`         Payment object from /v1/payments (status, status_detail)
 * - `mercadopago.refund`          Refund object from /v1/payments/{id}/refunds
 * - `mercadopago.error_response`  `{ status, error, message, cause: [] }`, decoded by HTTP status
 * - `mercadopago.webhook`         Webhooks for the payment topic and topic_chargebacks_wh
 * - `mercadopago.ipn`             IPN query parameters `topic=payment&id=...`
 *
 * Recognized but not supported: `mercadopago.webhook.other` (other topics)
 * and `mercadopago.ipn.other` (IPN topics other than payment).
 */

import {
  decimalToMinor,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
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
  COLLECTION_RESULTS_URL,
  GET_PAYMENT_URL,
  HTTP_ERRORS,
  IPN_TOPICS,
  IPN_URL,
  NOTIFICATIONS_INFO_URL,
  PAYMENT_ACTIONS,
  PAYMENT_STATUSES,
  QUERY_RESULTS_URL,
  REFUND_STATUSES,
  REJECTION_DETAILS,
  SDK_ERRORS_URL,
  SERVER_ERROR,
  STATUS_DETAILS,
  WEBHOOK_TOPICS,
  lookup,
  type HttpErrorEntry,
} from "./catalog.js";
import { mercadopagoManifest, MERCADOPAGO_ADAPTER_VERSION } from "./manifest.js";

export { mercadopagoManifest, MERCADOPAGO_ADAPTER_VERSION };

const PROVIDER = "mercadopago";

const str = (max: number) => z.string().max(max);
/** Ids are numbers in the reference and strings in notifications. */
const Id = z.union([z.number(), str(64)]);
/** Decimal amounts are numbers in the schema and strings in one documented example. */
const Amount = z.union([z.number(), str(64)]);

const PaymentObject = z.looseObject({
  id: Id,
  status: str(64).optional(),
  status_detail: str(128).optional(),
  date_created: str(64).nullish(),
  date_approved: str(64).nullish(),
  date_last_updated: str(64).nullish(),
  date_of_expiration: str(64).nullish(),
  money_release_date: str(64).nullish(),
  operation_type: str(64).nullish(),
  payment_method_id: str(64).nullish(),
  payment_type_id: str(64).nullish(),
  payment_method: z
    .looseObject({
      id: str(64).nullish(),
      type: str(64).nullish(),
      data: z.looseObject({ threeds: str(64).nullish() }).nullish(),
    })
    .nullish(),
  currency_id: str(16).nullish(),
  transaction_amount: Amount.nullish(),
  transaction_amount_refunded: Amount.nullish(),
  captured: z.boolean().nullish(),
  binary_mode: z.boolean().nullish(),
  installments: z.number().int().nullish(),
  live_mode: z.boolean().nullish(),
  external_reference: str(256).nullish(),
  processing_mode: str(64).nullish(),
  refunds: z.array(z.unknown()).nullish(),
});

const RefundObject = z.looseObject({
  id: Id,
  payment_id: Id,
  amount: Amount.nullish(),
  status: str(64).nullish(),
  date_created: str(64).nullish(),
  refund_mode: str(64).nullish(),
  adjustment_amount: Amount.nullish(),
  reason: z.unknown().optional(),
  source: z.unknown().optional(),
});

const ErrorResponse = z.looseObject({
  status: z.number().int(),
  error: str(256),
  message: z.string(),
  cause: z.array(z.unknown()),
});

const Webhook = z.looseObject({
  id: Id.optional(),
  live_mode: z.boolean().optional(),
  type: str(128),
  date_created: str(64).optional(),
  user_id: Id.optional(),
  api_version: str(32).optional(),
  action: str(128).optional(),
  actions: z.array(str(128)).optional(),
  data: z.looseObject({
    id: Id.optional(),
    payment_id: Id.optional(),
    date_updated: str(64).optional(),
  }),
});

const Ipn = z.looseObject({ topic: str(64), id: str(64) });

type Payment = z.infer<typeof PaymentObject>;
type Refund = z.infer<typeof RefundObject>;

export type MercadoPagoParsed =
  | { kind: "payment"; value: Payment }
  | { kind: "refund"; value: Refund }
  | { kind: "error_response"; value: z.infer<typeof ErrorResponse> }
  | { kind: "webhook"; value: z.infer<typeof Webhook> }
  | { kind: "ipn"; value: z.infer<typeof Ipn> };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v !== "";
const isAmount = (v: unknown) =>
  isNum(v) || (typeof v === "string" && /^\d{1,30}(\.\d{1,10})?$/.test(v));
const isIdLike = (v: unknown) =>
  isNum(v) || (typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v));

/** Numeric ids above 2^53 have lost precision in JSON and are dropped. */
function idString(v: unknown): string | undefined {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? String(v) : undefined;
  return safeId(v, 64);
}

const IPN_KEYS = new Set(["topic", "id", "cliente", "source_news"]);

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe objects carry `object`, Adyen notifications `notificationItems`.
  if ("object" in input || "notificationItems" in input) return none;

  // Webhooks notification envelope.
  if (
    isObj(input.data) &&
    isStr(input.type) &&
    (isStr(input.action) || Array.isArray(input.actions)) &&
    typeof input.live_mode === "boolean" &&
    "user_id" in input
  ) {
    const reasons = ["has type, action, live_mode, user_id and a data object"];
    if (isStr(input.api_version)) reasons.push("has api_version");
    const base = isStr(input.api_version) ? 0.85 : 0.7;
    if (input.type === "payment" && isIdLike(input.data.id)) {
      const known = isStr(input.action) && PAYMENT_ACTIONS.has(input.action);
      return {
        ...none,
        format: "mercadopago.webhook",
        confidence: known ? base + 0.1 : base,
        supported: true,
        reasons: [...reasons, known ? "documented payment action" : "payment topic"],
      };
    }
    if (input.type === "topic_chargebacks_wh" && isIdLike(input.data.payment_id)) {
      return {
        ...none,
        format: "mercadopago.webhook",
        confidence: base,
        supported: true,
        reasons: [...reasons, "chargebacks topic with data.payment_id"],
      };
    }
    if (WEBHOOK_TOPICS.has(input.type)) {
      return {
        ...none,
        format: "mercadopago.webhook.other",
        confidence: base,
        supported: false,
        reasons: [...reasons, "documented notification topic"],
        unsupportedReason: `Mercado Pago notifications for the "${safeText(input.type, 64) ?? "unknown"}" topic are recognized but not analyzed. PandaPayLens analyzes the payment and topic_chargebacks_wh topics (${NOTIFICATIONS_INFO_URL}).`,
      };
    }
    return none;
  }

  // IPN: only the documented query parameters.
  const keys = Object.keys(input);
  if (
    (meta?.format === "form" || meta?.format === "http") &&
    isStr(input.topic) &&
    isStr(input.id) &&
    keys.every((k) => IPN_KEYS.has(k)) &&
    IPN_TOPICS.has(input.topic) &&
    /^\d{1,30}$/.test(input.id)
  ) {
    if (input.topic === "payment")
      return {
        ...none,
        format: "mercadopago.ipn",
        confidence: 0.6,
        supported: true,
        reasons: ["form record with only topic=payment and a numeric id (IPN)"],
      };
    return {
      ...none,
      format: "mercadopago.ipn.other",
      confidence: 0.6,
      supported: false,
      reasons: ["form record with only a documented IPN topic and a numeric id"],
      unsupportedReason: `IPN notifications for the "${input.topic}" topic are recognized but not analyzed (${IPN_URL}).`,
    };
  }

  // Error body: all four fields declared by the official SDK must be present.
  if (
    isNum(input.status) &&
    isStr(input.error) &&
    typeof input.message === "string" &&
    Array.isArray(input.cause) &&
    keys.every((k) => ["status", "error", "message", "cause"].includes(k))
  ) {
    return {
      ...none,
      format: "mercadopago.error_response",
      confidence: 0.6,
      supported: true,
      reasons: ["has only status (number), error, message and a cause array"],
    };
  }

  // Payment object.
  if (isStr(input.status_detail) && isAmount(input.transaction_amount) && isIdLike(input.id)) {
    const signals = ["currency_id", "payment_type_id", "date_last_updated", "collector_id"].filter(
      (k) => k in input,
    );
    if (signals.length === 0) return none;
    const known =
      typeof input.status === "string" && lookup(PAYMENT_STATUSES, input.status) !== undefined;
    return {
      ...none,
      format: "mercadopago.payment",
      confidence: known && signals.length >= 2 ? 0.95 : 0.8,
      supported: true,
      reasons: [
        "has status_detail and a transaction_amount",
        `has ${signals.join(", ")}`,
        ...(known ? ["status is a documented payment status"] : []),
      ],
    };
  }

  // Refund object.
  if (
    isIdLike(input.id) &&
    isIdLike(input.payment_id) &&
    isAmount(input.amount) &&
    !("transaction_amount" in input) &&
    (isStr(input.refund_mode) || (isNum(input.adjustment_amount) && Array.isArray(input.source)))
  ) {
    return {
      ...none,
      format: "mercadopago.refund",
      confidence: isStr(input.refund_mode) && "unique_sequence_number" in input ? 0.9 : 0.75,
      supported: true,
      reasons: [
        "has id, payment_id and amount",
        isStr(input.refund_mode) ? "has refund_mode" : "has adjustment_amount and a source array",
      ],
    };
  }

  return none;
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
}

type ParseResult = { ok: true; value: MercadoPagoParsed } | { ok: false; issues: string[] };

function parse(input: unknown, format: string): ParseResult {
  switch (format) {
    case "mercadopago.payment": {
      const r = PaymentObject.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payment", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "mercadopago.refund": {
      const r = RefundObject.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "refund", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "mercadopago.error_response": {
      const r = ErrorResponse.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "error_response", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "mercadopago.webhook": {
      const r = Webhook.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const ref = r.data.type === "payment" ? r.data.data.id : r.data.data.payment_id;
      if (idString(ref) === undefined)
        return {
          ok: false,
          issues: [
            r.data.type === "payment"
              ? "data.id: missing or not a usable payment id"
              : "data.payment_id: missing or not a usable payment id",
          ],
        };
      return { ok: true, value: { kind: "webhook", value: r.data } };
    }
    case "mercadopago.ipn": {
      const r = Ipn.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "ipn", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
  }
  return { ok: false, issues: [`Unsupported Mercado Pago format "${format}".`] };
}

type Attributes = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attributes {
  const out: Attributes = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

const iso = (v: unknown) => toIsoTimestamp(v);
const amountString = (v: unknown) => (typeof v === "number" ? String(v) : v);

/** Delivery context from a pasted HTTP message. x-signature and x-request-id are never read. */
function httpAttrs(meta: RecordMeta | undefined): Attributes {
  const http = meta?.http;
  if (!http) return {};
  return attrs([
    ["httpStatus", http.status],
    ["queryType", http.query?.type],
  ]);
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function paymentState(p: Payment): { stage: NormalizedEventDraft["stage"]; outcome: Outcome } {
  const info = lookup(PAYMENT_STATUSES, p.status);
  if (!info) return { stage: "payment", outcome: "unknown" };
  const detail = p.status
    ? lookup(STATUS_DETAILS[p.status] ?? {}, p.status_detail ?? undefined)
    : undefined;
  return { stage: detail?.stage ?? info.stage, outcome: detail?.outcome ?? info.outcome };
}

function normalizePayment(p: Payment, ctx: NormalizeContext): NormalizedEventDraft {
  const currency = upperCurrency(p.currency_id);
  const { stage, outcome } = paymentState(p);
  return clean({
    sourceFormat: ctx.format,
    eventType: "payment.snapshot",
    eventTypeKnown: true,
    stage,
    providerStatus: safeId(p.status, 64),
    paymentReference: idString(p.id),
    merchantReference: safeId(p.external_reference ?? undefined, 256),
    // date_last_updated is when the payment reached the state in this snapshot.
    eventTimestamp: iso(p.date_last_updated) ?? iso(p.date_approved) ?? iso(p.date_created),
    amountMinor: decimalToMinor(amountString(p.transaction_amount), currency),
    currency,
    outcome,
    attributes: {
      // Payer, card, metadata, additional_info, description and URLs are never copied.
      ...attrs([
        ["objectType", "payment"],
        ["statusDetail", safeId(p.status_detail ?? undefined, 128)],
        ["paymentMethodId", safeId(p.payment_method_id ?? undefined, 64)],
        ["paymentTypeId", safeId(p.payment_type_id ?? undefined, 64)],
        ["operationType", safeId(p.operation_type ?? undefined, 64)],
        ["threeDs", safeId(p.payment_method?.data?.threeds ?? undefined, 64)],
        ["captured", p.captured],
        ["binaryMode", p.binary_mode],
        ["installments", p.installments],
        ["liveMode", p.live_mode],
        ["processingMode", safeId(p.processing_mode ?? undefined, 64)],
        [
          "refundedAmountMinor",
          decimalToMinor(amountString(p.transaction_amount_refunded), currency),
        ],
        ["createdAt", iso(p.date_created)],
        ["approvedAt", iso(p.date_approved)],
        ["expiresAt", iso(p.date_of_expiration)],
        ["moneyReleaseDate", iso(p.money_release_date)],
      ]),
      ...httpAttrs(ctx.meta),
    },
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalizeRefund(r: Refund, ctx: NormalizeContext): NormalizedEventDraft {
  const info = lookup(REFUND_STATUSES, r.status ?? undefined);
  return clean({
    sourceFormat: ctx.format,
    eventType: "refund.snapshot",
    eventTypeKnown: true,
    stage: "refund",
    providerStatus: safeId(r.status ?? undefined, 64),
    paymentReference: idString(r.payment_id),
    relatedReference: idString(r.id),
    eventTimestamp: iso(r.date_created),
    // The refund object has no currency; the amount is kept as a decimal attribute.
    outcome: info?.outcome ?? "unknown",
    attributes: {
      ...attrs([
        ["objectType", "refund"],
        ["amount", typeof r.amount === "number" ? String(r.amount) : r.amount],
        ["refundMode", safeId(r.refund_mode ?? undefined, 64)],
        ["adjustmentAmount", amountString(r.adjustment_amount)],
      ]),
      ...httpAttrs(ctx.meta),
    },
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: MercadoPagoParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const at = { recordIndex: ctx.recordIndex, path: "" };

  if (parsed.kind === "payment") return [normalizePayment(parsed.value, ctx)];
  if (parsed.kind === "refund") return [normalizeRefund(parsed.value, ctx)];

  if (parsed.kind === "error_response") {
    const e = parsed.value;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${safeId(e.error, 64) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: String(e.status),
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["errorStatus", e.status],
            ["causeCount", e.cause.length],
          ]),
          ...httpAttrs(ctx.meta),
        },
        source: at,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "ipn") {
    const n = parsed.value;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `ipn.${n.topic}`,
        eventTypeKnown: true,
        stage: "payment",
        paymentReference: safeId(n.id, 64),
        // IPN carries only the id; the payment's state must be fetched.
        outcome: "unknown",
        attributes: { ...attrs([["topic", n.topic]]), ...httpAttrs(ctx.meta) },
        source: at,
        ...observed,
      }),
    ];
  }

  const w = parsed.value;
  const eventReference = idString(w.id);
  if (w.type === "payment") {
    const known = w.action !== undefined && PAYMENT_ACTIONS.has(w.action);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: safeText(w.action, 128) ?? "payment",
        eventTypeKnown: known,
        stage: known ? "payment" : "other",
        eventReference,
        paymentReference: idString(w.data.id),
        // Mercado Pago documents date_created as the notified resource's creation date.
        eventTimestamp: iso(w.date_created),
        // A notification carries no status; the payment must be fetched.
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["topic", w.type],
            ["apiVersion", safeId(w.api_version, 32)],
            ["liveMode", w.live_mode],
          ]),
          ...httpAttrs(ctx.meta),
        },
        source: at,
        ...observed,
      }),
    ];
  }

  // topic_chargebacks_wh
  const actions = (w.actions ?? (w.action ? [w.action] : []))
    .map((a) => safeId(a, 64))
    .filter((a): a is string => Boolean(a));
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: `chargeback.${actions[0] ?? "notification"}`,
      eventTypeKnown: true,
      stage: "dispute",
      eventReference,
      paymentReference: idString(w.data.payment_id),
      relatedReference: idString(w.data.id),
      eventTimestamp: iso(w.date_created),
      outcome: "unknown",
      attributes: {
        ...attrs([
          ["topic", w.type],
          ["apiVersion", safeId(w.api_version, 32)],
          ["liveMode", w.live_mode],
          ["chargebackUpdatedAt", iso(w.data.date_updated)],
        ]),
        ...(actions.length > 0 ? { actions } : {}),
        ...httpAttrs(ctx.meta),
      },
      source: at,
      ...observed,
    }),
  ];
}

function decodeRejection(p: Payment, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (p.status !== "rejected") return [];
  const ref = idString(p.id);
  const detail = p.status_detail ?? undefined;
  const entry = lookup(REJECTION_DETAILS, detail);
  const code = safeId(detail, 128) ?? "unknown";
  const docs: DocumentationLink[] = [
    { title: "Mercado Pago: get payment status", url: QUERY_RESULTS_URL },
    { title: "Mercado Pago: payment creation results", url: COLLECTION_RESULTS_URL },
  ];
  const missing: string[] = [];
  if (!entry)
    missing.push(
      detail
        ? `status_detail "${safeText(detail, 64)}" is not a documented rejection reason.`
        : "No status_detail was supplied.",
    );
  if (entry?.category === "card_declined" || entry?.category === "insufficient_funds")
    missing.push("Mercado Pago does not include the issuer's own response code in the payment.");
  return [
    {
      sourceFormat: ctx.format,
      code,
      subCodes: { status: "rejected" },
      category: entry?.category ?? "unknown",
      explanation: entry?.explanation ?? "PandaPayLens does not recognize this rejection reason.",
      nextAction: entry?.nextAction ?? "Check the payment's status_detail in Mercado Pago.",
      retry: entry?.retry ?? "unknown",
      retryExplanation:
        entry?.retryExplanation ?? "Retry safety cannot be assessed for this rejection.",
      confidence: entry?.confidence ?? "insufficient",
      documentation: docs,
      missingInformation: missing,
      // The payment status is rejected, so the outcome of this attempt is known.
      outcomeKnown: true,
      source: { recordIndex: ctx.recordIndex, path: "status_detail" },
      ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
    },
  ];
}

function decodeHttpError(
  e: z.infer<typeof ErrorResponse>,
  ctx: NormalizeContext,
): DecodedErrorDraft[] {
  const status = ctx.meta?.http?.status ?? e.status;
  const entry: HttpErrorEntry | undefined = Object.hasOwn(HTTP_ERRORS, status)
    ? HTTP_ERRORS[status]
    : status >= 500 && status <= 599
      ? SERVER_ERROR
      : undefined;
  const missing = [
    "Mercado Pago does not document which field of an error body carries the numeric error codes of the API reference, so cause entries are not interpreted.",
  ];
  if (!entry) missing.push(`HTTP status ${status} has no documented error class.`);
  if (entry && (status >= 500 || status === 424 || status === 402))
    missing.push("The error does not show whether the original request took effect.");
  const message = safeText(e.message, 300);
  return [
    {
      sourceFormat: ctx.format,
      code: safeId(e.error, 64) ?? `http_${status}`,
      subCodes: { httpStatus: String(status), causeCount: String(e.cause.length) },
      category: entry?.category ?? "unknown",
      ...(message ? { providerMessage: message } : {}),
      explanation: entry?.explanation ?? "PandaPayLens does not recognize this Mercado Pago error.",
      nextAction: entry?.nextAction ?? "Read the message and check the API reference error list.",
      retry: entry?.retry ?? "unknown",
      retryExplanation:
        entry?.retryExplanation ?? "Retry safety cannot be assessed for this error.",
      confidence: entry ? "possible" : "insufficient",
      documentation: [
        { title: "Mercado Pago SDK: error handling", url: SDK_ERRORS_URL },
        { title: "Mercado Pago: get payment (error list)", url: GET_PAYMENT_URL },
      ],
      missingInformation: missing,
      source: { recordIndex: ctx.recordIndex, path: "" },
    },
  ];
}

function decodeErrors(parsed: MercadoPagoParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "payment") return decodeRejection(parsed.value, ctx);
  if (parsed.kind === "error_response") return decodeHttpError(parsed.value, ctx);
  return [];
}

export const mercadopagoAdapter: ProviderAdapter<MercadoPagoParsed> = {
  id: PROVIDER,
  displayName: "Mercado Pago",
  version: MERCADOPAGO_ADAPTER_VERSION,
  manifest: mercadopagoManifest,
  supportedFormats: [
    {
      id: "mercadopago.payment",
      description: "Payment object from /v1/payments with status and status_detail",
    },
    { id: "mercadopago.refund", description: "Refund object from /v1/payments/{id}/refunds" },
    {
      id: "mercadopago.error_response",
      description: "Error body { status, error, message, cause }, decoded by HTTP status",
    },
    {
      id: "mercadopago.webhook",
      description: "Webhooks for the payment topic and the topic_chargebacks_wh topic",
    },
    { id: "mercadopago.ipn", description: "IPN query parameters topic=payment and id" },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Payment id and refund or chargeback id only. external_reference is
    // merchant supplied and can be reused across attempts.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default mercadopagoAdapter;
