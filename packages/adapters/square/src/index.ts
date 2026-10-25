/**
 * Square adapter.
 *
 * Supported input families:
 * - `square.error_response`  `{ "errors": [{ category, code, detail?, field? }] }`, optionally with
 *                            the `payment` or `refund` (status FAILED) that Square may include
 * - `square.payment`         Payment object, bare or as `{ "payment": {...} }`
 * - `square.refund`          PaymentRefund object, bare or as `{ "refund": {...} }`
 * - `square.webhook`         payment.* / refund.* events (`merchant_id`, `type`, `event_id`, `data.object`)
 *
 * Recognized but not supported: `square.webhook.other` (event envelopes for
 * other objects, such as disputes or payouts).
 */

import {
  minorUnits,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
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
  type SourceLocation,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  CARD_DETAILS_STATUSES,
  ERROR_CATEGORIES,
  ERROR_CATEGORY_URL,
  ERROR_CODE_URL,
  ERROR_CODES,
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  WEBHOOK_EVENT_TYPES,
  lookup,
} from "./catalog.js";

import { squareManifest, SQUARE_ADAPTER_VERSION } from "./manifest.js";

export { squareManifest, SQUARE_ADAPTER_VERSION };

const str = (max: number) => z.string().max(max);

const Money = z.looseObject({
  amount: z.number().int().optional(),
  currency: str(16).optional(),
});

const ErrorItem = z.looseObject({
  category: str(64),
  code: str(128),
  detail: z.string().optional(),
  field: str(256).optional(),
});

/** `card_details.errors` inside a Payment; tolerated even when incomplete. */
const NestedError = z.looseObject({
  category: str(64).optional(),
  code: str(128).optional(),
  detail: z.string().optional(),
  field: str(256).optional(),
});

const CardDetails = z.looseObject({
  status: str(64).optional(),
  entry_method: str(64).optional(),
  cvv_status: str(64).optional(),
  avs_status: str(64).optional(),
  card: z
    .looseObject({
      card_brand: str(64).optional(),
      card_type: str(64).optional(),
      prepaid_type: str(64).optional(),
    })
    .optional(),
  card_payment_timeline: z
    .looseObject({
      authorized_at: str(64).optional(),
      captured_at: str(64).optional(),
      voided_at: str(64).optional(),
    })
    .optional(),
  errors: z.array(NestedError).optional(),
});

const PaymentObject = z.looseObject({
  id: str(255).optional(),
  status: str(64).optional(),
  created_at: str(64).optional(),
  updated_at: str(64).optional(),
  amount_money: Money.optional(),
  total_money: Money.optional(),
  approved_money: Money.optional(),
  refunded_money: Money.optional(),
  source_type: str(64).optional(),
  card_details: CardDetails.optional(),
  order_id: str(255).optional(),
  reference_id: str(255).optional(),
  refund_ids: z.array(str(255)).optional(),
  delay_action: str(32).optional(),
  delay_duration: str(64).optional(),
  delayed_until: str(64).optional(),
  risk_evaluation: z.looseObject({ risk_level: str(32).optional() }).optional(),
  application_details: z.looseObject({ square_product: str(64).optional() }).optional(),
  is_offline_payment: z.boolean().optional(),
});

const RefundObject = z.looseObject({
  id: str(255).optional(),
  status: str(64).optional(),
  created_at: str(64).optional(),
  updated_at: str(64).optional(),
  amount_money: Money.optional(),
  payment_id: str(255).optional(),
  order_id: str(255).optional(),
  version: z.number().int().optional(),
});

const PaymentWithId = PaymentObject.extend({ id: str(255) });
const RefundWithId = RefundObject.extend({ id: str(255) });

const ErrorResponse = z.looseObject({
  errors: z.array(ErrorItem).min(1),
  payment: PaymentObject.optional(),
  refund: RefundObject.optional(),
});

const Webhook = z.looseObject({
  merchant_id: str(255).optional(),
  type: str(128),
  event_id: str(255),
  created_at: str(64).optional(),
  data: z.looseObject({
    type: str(64),
    id: str(255),
    object: z.looseObject({
      payment: PaymentObject.optional(),
      refund: RefundObject.optional(),
    }),
  }),
});

type Payment = z.infer<typeof PaymentObject>;
type Refund = z.infer<typeof RefundObject>;
type SquareErrorFields = z.infer<typeof NestedError>;

export type SquareParsed =
  | { kind: "error_response"; value: z.infer<typeof ErrorResponse> }
  | { kind: "payment"; value: Payment; wrapped: boolean }
  | { kind: "refund"; value: Refund; wrapped: boolean }
  | { kind: "webhook"; value: z.infer<typeof Webhook> };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const UPPER_SNAKE = /^[A-Z][A-Z0-9_]*$/;
const DOTTED_TYPE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;

/** Fields that only Square Payment objects carry next to `amount_money`. */
function paymentSignals(p: Record<string, unknown>): string[] {
  const out: string[] = [];
  const cd = isObj(p.card_details) ? p.card_details : undefined;
  if (typeof cd?.status === "string" && CARD_DETAILS_STATUSES.includes(cd.status))
    out.push("card_details.status is a documented CardPaymentDetails status");
  if (typeof p.version_token === "string") out.push("has version_token");
  if (typeof p.delay_action === "string") out.push("has delay_action");
  if (isObj(p.approved_money)) out.push("has approved_money");
  return out;
}

function detectPayment(p: Record<string, unknown>, wrapped: boolean): DetectionResult | null {
  if (!isObj(p.amount_money)) return null;
  const hasSource = typeof p.source_type === "string";
  if (!wrapped && !(hasSource && typeof p.status === "string")) return null;
  if (wrapped && !hasSource && typeof p.status !== "string") return null;
  const signals = paymentSignals(p);
  const reasons = [
    wrapped
      ? "has a payment object with an amount_money Money object"
      : "has amount_money (Money object)",
    ...(hasSource ? ["has source_type"] : []),
    ...signals,
  ];
  const base = wrapped ? 0.85 : 0.75;
  return {
    provider: "square",
    format: "square.payment",
    confidence: signals.length > 0 ? base + 0.1 : base,
    supported: true,
    reasons,
  };
}

function detectRefund(r: Record<string, unknown>, wrapped: boolean): DetectionResult | null {
  if (!isObj(r.amount_money) || typeof r.payment_id !== "string") return null;
  if (!wrapped && (typeof r.status !== "string" || "source_type" in r)) return null;
  return {
    provider: "square",
    format: "square.refund",
    confidence: wrapped ? 0.9 : 0.75,
    supported: true,
    reasons: [
      wrapped ? "has a refund object with amount_money" : "has amount_money (Money object)",
      "has payment_id",
    ],
  };
}

function detect(input: unknown): DetectionResult {
  const none: DetectionResult = {
    provider: "square",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  if (Array.isArray(input.errors) && input.errors.length > 0) {
    const first = input.errors[0];
    if (!isObj(first)) return none;
    const category = typeof first.category === "string" ? first.category : undefined;
    const codeUpper = typeof first.code === "string" && UPPER_SNAKE.test(first.code);
    const knownCategory = lookup(ERROR_CATEGORIES, category) !== undefined;
    const reasons: string[] = [];
    let confidence = 0;
    if (knownCategory && codeUpper) {
      confidence = 0.95;
      reasons.push("errors[] items carry an UPPER_SNAKE code and a documented ErrorCategory");
    } else if (category && UPPER_SNAKE.test(category) && category.endsWith("_ERROR") && codeUpper) {
      confidence = 0.8;
      reasons.push("errors[] items carry an UPPER_SNAKE code and an *_ERROR category");
    } else if (knownCategory) {
      // Distinctive category but no usable code: let parsing report the issue.
      confidence = 0.6;
      reasons.push("errors[] items carry a documented ErrorCategory but no UPPER_SNAKE code");
    } else if (codeUpper && category && UPPER_SNAKE.test(category)) {
      confidence = 0.4;
      reasons.push("errors[] items carry UPPER_SNAKE code and category values");
    }
    if (confidence === 0) return none;
    return { ...none, format: "square.error_response", confidence, supported: true, reasons };
  }

  if (
    typeof input.type === "string" &&
    DOTTED_TYPE.test(input.type) &&
    isObj(input.data) &&
    typeof input.data.type === "string" &&
    isObj(input.data.object)
  ) {
    const obj = input.data.object;
    const hasEnvelopeIds =
      typeof input.merchant_id === "string" && typeof input.event_id === "string";
    const hasPaymentOrRefund = isObj(obj.payment) || isObj(obj.refund);
    if (hasPaymentOrRefund) {
      return {
        ...none,
        format: "square.webhook",
        confidence: hasEnvelopeIds ? 0.95 : 0.7,
        supported: true,
        reasons: [
          "has a dotted event type and data.{type, object}",
          `data.object carries a ${isObj(obj.payment) ? "payment" : "refund"}`,
          ...(hasEnvelopeIds ? ["has merchant_id and event_id"] : []),
        ],
      };
    }
    if (hasEnvelopeIds && typeof input.data.id === "string") {
      return {
        ...none,
        format: "square.webhook.other",
        confidence: 0.75,
        supported: false,
        reasons: ["has merchant_id, event_id, a dotted event type and data.{type, id, object}"],
        unsupportedReason: `Webhook events for "${safeText(input.data.type, 64) ?? "unknown"}" objects are recognized but not supported. PandaPayLens analyzes payment and refund events only.`,
      };
    }
    return none;
  }

  if (isObj(input.payment)) return detectPayment(input.payment, true) ?? none;
  if (isObj(input.refund)) return detectRefund(input.refund, true) ?? none;
  return detectPayment(input, false) ?? detectRefund(input, false) ?? none;
}

function issuesOf(error: z.ZodError, prefix: string): string[] {
  return error.issues.map((i) => {
    const path = [...(prefix ? [prefix] : []), ...i.path.map(String)].join(".");
    return `${path || "(root)"}: ${i.message}`;
  });
}

type ParseResult = { ok: true; value: SquareParsed } | { ok: false; issues: string[] };

function parse(input: unknown, format: string): ParseResult {
  if (format === "square.error_response") {
    const r = ErrorResponse.safeParse(input);
    return r.success
      ? { ok: true, value: { kind: "error_response", value: r.data } }
      : { ok: false, issues: issuesOf(r.error, "") };
  }
  if (format === "square.payment" || format === "square.refund") {
    const key = format === "square.payment" ? "payment" : "refund";
    const wrapped = isObj(input) && isObj(input[key]);
    const target = wrapped ? (input as Record<string, unknown>)[key] : input;
    if (key === "payment") {
      const r = PaymentWithId.safeParse(target);
      return r.success
        ? { ok: true, value: { kind: "payment", value: r.data, wrapped } }
        : { ok: false, issues: issuesOf(r.error, wrapped ? key : "") };
    }
    const r = RefundWithId.safeParse(target);
    return r.success
      ? { ok: true, value: { kind: "refund", value: r.data, wrapped } }
      : { ok: false, issues: issuesOf(r.error, wrapped ? key : "") };
  }
  if (format === "square.webhook") {
    const r = Webhook.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error, "") };
    const { type, object } = r.data.data;
    if (type !== "payment" && type !== "refund")
      return { ok: false, issues: [`data.type: expected "payment" or "refund"`] };
    if (!object[type])
      return { ok: false, issues: [`data.object.${type}: missing for data.type "${type}"`] };
    return { ok: true, value: { kind: "webhook", value: r.data } };
  }
  return { ok: false, issues: [`Unsupported Square format "${format}".`] };
}

type Attributes = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attributes {
  const out: Attributes = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeText(x, 64) ?? "");
  }
  return out;
}

const iso = (v: unknown) => toIsoTimestamp(v);
const money = (m: { amount?: number | undefined } | undefined) => minorUnits(m?.amount);

/** Delivery context from a pasted HTTP message. The signature header is never read. */
function httpAttrs(meta: RecordMeta | undefined): Attributes {
  const http = meta?.http;
  if (!http) return {};
  const h = http.headers;
  const retry = h["square-retry-number"];
  return attrs([
    ["httpStatus", http.status],
    ["apiVersion", h["square-version"]],
    ["environment", h["square-environment"]],
    ["retryNumber", retry && /^\d{1,4}$/.test(retry) ? Number(retry) : undefined],
    ["retryReason", h["square-retry-reason"]],
    ["initialDeliveryAt", iso(h["square-initial-delivery-timestamp"])],
  ]);
}

type Described = {
  paymentReference?: string | undefined;
  relatedReference?: string | undefined;
  merchantReference?: string | undefined;
  status?: string | undefined;
  stage: NormalizedEventDraft["stage"];
  outcome: Outcome;
  amountMinor?: string | undefined;
  currency?: string | undefined;
  updatedAt?: string | undefined;
  attributes: Attributes;
};

function describePayment(p: Payment, fallbackId?: string): Described {
  const info = lookup(PAYMENT_STATUSES, p.status);
  const cd = p.card_details;
  const timeline = cd?.card_payment_timeline;
  // Only allowlisted fields: card fingerprint, BIN, last 4, expiry, buyer
  // email, addresses, note, customer and team member ids are never copied.
  const attributes = attrs([
    ["objectType", "payment"],
    ["sourceType", p.source_type],
    ["cardDetailsStatus", cd?.status],
    ["entryMethod", cd?.entry_method],
    ["cvvStatus", cd?.cvv_status],
    ["avsStatus", cd?.avs_status],
    ["cardBrand", cd?.card?.card_brand],
    ["cardType", cd?.card?.card_type],
    ["prepaidType", cd?.card?.prepaid_type],
    ["authorizedAt", iso(timeline?.authorized_at)],
    ["capturedAt", iso(timeline?.captured_at)],
    ["voidedAt", iso(timeline?.voided_at)],
    ["createdAt", iso(p.created_at)],
    ["delayAction", p.delay_action],
    ["delayDuration", p.delay_duration],
    ["delayedUntil", iso(p.delayed_until)],
    ["riskLevel", p.risk_evaluation?.risk_level],
    ["totalMoneyMinor", money(p.total_money)],
    ["approvedMoneyMinor", money(p.approved_money)],
    ["refundedMoneyMinor", money(p.refunded_money)],
    ["refundCount", p.refund_ids?.length],
    ["squareProduct", p.application_details?.square_product],
    ["orderId", safeId(p.order_id)],
    ["isOfflinePayment", p.is_offline_payment],
    [
      "cardErrorCodes",
      cd?.errors?.map((e) => safeId(e.code)).filter((c): c is string => Boolean(c)),
    ],
  ]);
  return {
    paymentReference: safeId(p.id) ?? safeId(fallbackId),
    merchantReference: safeId(p.reference_id, 256),
    status: p.status,
    stage: info?.stage ?? "payment",
    outcome: info?.outcome ?? "unknown",
    amountMinor: money(p.amount_money),
    currency: upperCurrency(p.amount_money?.currency),
    updatedAt: iso(p.updated_at),
    attributes,
  };
}

function describeRefund(r: Refund, fallbackId?: string): Described {
  const info = lookup(REFUND_STATUSES, r.status);
  return {
    paymentReference: safeId(r.payment_id),
    relatedReference: safeId(r.id) ?? safeId(fallbackId),
    status: r.status,
    stage: "refund",
    outcome: info?.outcome ?? "unknown",
    amountMinor: money(r.amount_money),
    currency: upperCurrency(r.amount_money?.currency),
    updatedAt: iso(r.updated_at),
    attributes: attrs([
      ["objectType", "refund"],
      ["createdAt", iso(r.created_at)],
      ["version", r.version],
      ["orderId", safeId(r.order_id)],
    ]),
  };
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function snapshotEvent(
  d: Described,
  eventType: string,
  ctx: NormalizeContext,
  path: string,
): NormalizedEventDraft {
  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: true,
    stage: d.stage,
    providerStatus: d.status,
    paymentReference: d.paymentReference,
    relatedReference: d.relatedReference,
    merchantReference: d.merchantReference,
    // updated_at is when the object reached the state shown in this snapshot.
    eventTimestamp: d.updatedAt,
    amountMinor: d.amountMinor,
    currency: d.currency,
    outcome: d.outcome,
    attributes: { ...d.attributes, ...httpAttrs(ctx.meta) },
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

/** Categories whose errors mean the payment or refund itself was declined. */
const DECLINE_CATEGORIES = new Set(["PAYMENT_METHOD_ERROR", "REFUND_ERROR"]);

function normalize(parsed: SquareParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

  if (parsed.kind === "error_response") {
    const r = parsed.value;
    const first = r.errors[0]!;
    const pay = r.payment ? describePayment(r.payment) : undefined;
    const ref = r.refund ? describeRefund(r.refund) : undefined;
    const events: NormalizedEventDraft[] = [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${safeId(first.code) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: safeId(first.category, 64),
        paymentReference: pay?.paymentReference ?? ref?.paymentReference,
        relatedReference: ref?.relatedReference,
        outcome: DECLINE_CATEGORIES.has(first.category) ? "failure" : "unknown",
        attributes: {
          ...attrs([
            ["errorCodes", r.errors.map((e) => e.code)],
            ["errorCategories", [...new Set(r.errors.map((e) => e.category))]],
            ["fields", r.errors.map((e) => e.field).filter((f): f is string => Boolean(f))],
          ]),
          ...httpAttrs(ctx.meta),
        },
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observed,
      }),
    ];
    if (pay) events.push(snapshotEvent(pay, "payment.snapshot", ctx, "payment"));
    if (ref) events.push(snapshotEvent(ref, "refund.snapshot", ctx, "refund"));
    return events;
  }

  if (parsed.kind === "payment") {
    const d = describePayment(parsed.value);
    return [snapshotEvent(d, "payment.snapshot", ctx, parsed.wrapped ? "payment" : "")];
  }

  if (parsed.kind === "refund") {
    const d = describeRefund(parsed.value);
    return [snapshotEvent(d, "refund.snapshot", ctx, parsed.wrapped ? "refund" : "")];
  }

  const evt = parsed.value;
  const objectType = evt.data.type as "payment" | "refund";
  const info = lookup(WEBHOOK_EVENT_TYPES, evt.type);
  const known = info?.objectType === objectType;
  const payment = evt.data.object.payment;
  const refund = evt.data.object.refund;
  // Correlate on the embedded object's own id; data.id is only a fallback
  // because Square's documented payment.created example has a different data.id.
  const d =
    objectType === "payment" && payment
      ? describePayment(payment, evt.data.id)
      : describeRefund(refund!, evt.data.id);
  const objectId = objectType === "payment" ? payment?.id : refund?.id;
  const eventId = safeId(evt.event_id, 255);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: safeText(evt.type, 128) ?? "unknown",
      eventTypeKnown: known,
      stage: known ? d.stage : "other",
      providerStatus: d.status,
      eventReference: eventId,
      // Square documents event_id as the idempotency value of an event.
      deliveryKey: eventId,
      paymentReference: d.paymentReference,
      relatedReference: d.relatedReference,
      merchantReference: d.merchantReference,
      eventTimestamp: d.updatedAt ?? iso(evt.created_at),
      amountMinor: d.amountMinor,
      currency: d.currency,
      outcome: known ? d.outcome : "unknown",
      attributes: {
        ...d.attributes,
        ...attrs([
          ["eventCreatedAt", iso(evt.created_at)],
          ["dataIdMatchesObjectId", objectId ? objectId === evt.data.id : undefined],
        ]),
        ...httpAttrs(ctx.meta),
      },
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...observed,
    }),
  ];
}

/** Decodes one Square Error object. Shared by error responses and card_details.errors. */
export function decodeSquareError(
  e: SquareErrorFields,
  httpStatus?: number,
): Omit<DecodedErrorDraft, "sourceFormat" | "source" | "paymentReference"> {
  const code = safeId(e.code, 128) ?? "unknown";
  const codeEntry = lookup(ERROR_CODES, e.code);
  const categoryEntry = lookup(ERROR_CATEGORIES, e.category);
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  const category = safeId(e.category, 64);
  if (category) subCodes.category = category;
  const field = safeText(e.field, 128);
  if (field) subCodes.field = field;
  if (httpStatus !== undefined) subCodes.httpStatus = String(httpStatus);
  // For this code Square documents `detail` as the remaining balance in minor units.
  if (e.code === "GIFT_CARD_AVAILABLE_AMOUNT" && e.detail && /^\d{1,30}$/.test(e.detail))
    subCodes.availableAmountMinor = e.detail;

  const docs: DocumentationLink[] = [];
  let confidence: Confidence;
  const entry = codeEntry ?? categoryEntry;
  if (codeEntry) {
    confidence = codeEntry.confidence ?? "strong";
    docs.push({ title: `Square error code: ${code}`, url: codeEntry.docs });
  } else if (categoryEntry) {
    confidence = "possible";
    docs.push({ title: `Square error category: ${category}`, url: ERROR_CATEGORY_URL });
  } else {
    confidence = "insufficient";
  }
  if (!docs.some((d) => d.url === ERROR_CODE_URL))
    docs.push({ title: "Square ErrorCode reference", url: ERROR_CODE_URL });

  if (!codeEntry) {
    missing.push(
      e.code
        ? `Error code "${safeText(e.code, 64)}" is not in the PandaPayLens catalog yet.`
        : "No error code was supplied.",
    );
    if (!e.category) missing.push("No error category was supplied.");
    else if (!categoryEntry)
      missing.push(
        `Error category "${safeText(e.category, 64)}" is not a documented Square ErrorCategory.`,
      );
  }
  const resolved = entry?.category ?? "unknown";
  if (resolved === "card_declined" || resolved === "insufficient_funds")
    missing.push(
      "Square does not expose the issuer's raw decline code; only Square's error code is available.",
    );
  if (resolved === "provider_unavailable" || resolved === "network_or_timeout")
    missing.push("The error does not show whether the original request took effect.");

  const message = safeText(e.detail, 300);
  return {
    code,
    subCodes,
    category: resolved,
    ...(message ? { providerMessage: message } : {}),
    explanation: entry?.explanation ?? "PandaPayLens does not recognize this Square error.",
    nextAction:
      entry?.nextAction ?? "Check the Square ErrorCode reference and the error's detail field.",
    retry: entry?.retry ?? "unknown",
    retryExplanation: entry?.retryExplanation ?? "Retry safety cannot be assessed for this error.",
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

function cardErrors(
  p: Payment | undefined,
  pathPrefix: string,
  ctx: NormalizeContext,
  skipCodes: ReadonlySet<string>,
): DecodedErrorDraft[] {
  const list = p?.card_details?.errors ?? [];
  const ref = safeId(p?.id);
  const out: DecodedErrorDraft[] = [];
  list.forEach((e, i) => {
    if (!e.code && !e.category) return;
    // A response can repeat the top-level errors inside the payment.
    if (e.code && skipCodes.has(e.code)) return;
    out.push({
      ...decodeSquareError(e),
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: `${pathPrefix}card_details.errors[${i}]` },
      ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
    });
  });
  return out;
}

function decodeErrors(parsed: SquareParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const at = (path: string): SourceLocation => ({ recordIndex: ctx.recordIndex, path });

  if (parsed.kind === "error_response") {
    const r = parsed.value;
    const paymentRef = safeId(r.payment?.id) ?? safeId(r.refund?.payment_id);
    const attempt = safeId(r.payment?.id) ?? safeId(r.refund?.id);
    const status = ctx.meta?.http?.status;
    const out: DecodedErrorDraft[] = r.errors.map((e, i) => {
      const decoded = decodeSquareError(e, status);
      if (!paymentRef && DECLINE_CATEGORIES.has(e.category))
        decoded.missingInformation.push(
          "No payment or refund object was included, so its state cannot be checked from this record.",
        );
      return {
        ...decoded,
        sourceFormat: ctx.format,
        source: at(`errors[${i}]`),
        ...(paymentRef ? { paymentReference: paymentRef } : {}),
        ...(attempt ? { attemptReference: attempt } : {}),
      };
    });
    out.push(...cardErrors(r.payment, "payment.", ctx, new Set(r.errors.map((e) => e.code))));
    return out;
  }
  if (parsed.kind === "payment")
    return cardErrors(parsed.value, parsed.wrapped ? "payment." : "", ctx, new Set());
  if (parsed.kind === "webhook")
    return cardErrors(parsed.value.data.object.payment, "data.object.payment.", ctx, new Set());
  return [];
}

export const squareAdapter: ProviderAdapter<SquareParsed> = {
  id: "square",
  displayName: "Square",
  version: SQUARE_ADAPTER_VERSION,
  manifest: squareManifest,
  supportedFormats: [
    {
      id: "square.error_response",
      description:
        "Error response ({ errors: [{ category, code, detail, field }] }), optionally with the FAILED payment or refund",
    },
    { id: "square.payment", description: "Payment object, bare or as { payment: {...} }" },
    { id: "square.refund", description: "PaymentRefund object, bare or as { refund: {...} }" },
    {
      id: "square.webhook",
      description: "payment.created, payment.updated, refund.created and refund.updated events",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Payment id (refund.payment_id on refunds) and the refund id. order_id
    // and reference_id can span several payment attempts, so they never link.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default squareAdapter;
