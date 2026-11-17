/**
 * Klarna adapter.
 *
 * Supported input families:
 * - `klarna.error_response`         `{ error_code, error_messages[], correlation_id }` from Klarna
 *                                   Payments v1 and Order Management v1
 * - `klarna.payments_order`         Klarna Payments create order response
 *                                   (`order_id`, `fraud_status`, `authorized_payment_method`)
 * - `klarna.order`                  Order Management order with its captures and refunds
 * - `klarna.capture`                Order Management Capture object
 * - `klarna.refund`                 Order Management Refund object
 * - `klarna.hpp_status_callback`    Hosted Payment Page status callback (`event_id`, `session`)
 * - `klarna.authorization_callback` Klarna Payments authorization callback
 *
 * Pending order notifications are not recognized: their format is no longer
 * documented (see docs/providers/research/klarna.md, section 6.3).
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
} from "@pandapaylens/core";
import { z } from "zod";
import {
  AUTHORIZED_PAYMENT_METHOD_TYPES,
  ERROR_CODES,
  ERROR_OBJECT_URL,
  FRAUD_STATUSES,
  HPP_STATUSES,
  ORDER_STATUSES,
  errorEntry,
  lookup,
} from "./catalog.js";
import { klarnaManifest, KLARNA_ADAPTER_VERSION } from "./manifest.js";

export { klarnaManifest, KLARNA_ADAPTER_VERSION };

const str = (max: number) => z.string().max(max);
const int = z.number().int();

const ErrorResponse = z.looseObject({
  error_code: str(128),
  error_messages: z.array(z.string()).optional(),
  error_message: z.string().optional(),
  correlation_id: str(255).optional(),
});

const PaymentMethod = z.union([
  str(64),
  z.looseObject({
    type: str(64).optional(),
    number_of_days: int.optional(),
    number_of_installments: int.optional(),
  }),
]);

const PaymentsOrder = z.looseObject({
  order_id: str(255),
  fraud_status: str(32).optional(),
  redirect_url: z.string().optional(),
  authorized_payment_method: PaymentMethod.optional(),
});

const Capture = z.looseObject({
  capture_id: str(255).optional(),
  captured_amount: int.optional(),
  captured_at: str(64).optional(),
  refunded_amount: int.optional(),
});

const Refund = z.looseObject({
  refund_id: str(255).optional(),
  refunded_amount: int.optional(),
  refunded_at: str(64).optional(),
  credit_invoice: z.boolean().optional(),
});

const Order = z.looseObject({
  order_id: str(255),
  status: str(32).optional(),
  fraud_status: str(32).optional(),
  order_amount: int.optional(),
  original_order_amount: int.optional(),
  captured_amount: int.optional(),
  refunded_amount: int.optional(),
  remaining_authorized_amount: int.optional(),
  purchase_currency: str(16).optional(),
  purchase_country: str(8).optional(),
  created_at: str(64).optional(),
  expires_at: str(64).optional(),
  initial_payment_method: z
    .looseObject({
      type: str(64).optional(),
      number_of_installments: int.optional(),
    })
    .optional(),
  captures: z.array(Capture).optional(),
  refunds: z.array(Refund).optional(),
});

const CaptureWithId = Capture.extend({ capture_id: str(255), captured_amount: int });
const RefundWithId = Refund.extend({ refund_id: str(255), refunded_amount: int });

const HppCallback = z.looseObject({
  event_id: str(255),
  session: z.looseObject({
    status: str(32),
    updated_at: str(64).optional(),
    expires_at: str(64).optional(),
    order_id: str(255).optional(),
  }),
});

const AuthorizationCallback = z.looseObject({
  authorization_token: z.string(),
  session_id: z.string(),
});

type OrderValue = z.infer<typeof Order>;
type CaptureValue = z.infer<typeof Capture>;
type RefundValue = z.infer<typeof Refund>;

export type KlarnaParsed =
  | { kind: "error_response"; value: z.infer<typeof ErrorResponse> }
  | { kind: "payments_order"; value: z.infer<typeof PaymentsOrder> }
  | { kind: "order"; value: OrderValue }
  | { kind: "capture"; value: CaptureValue }
  | { kind: "refund"; value: RefundValue }
  | { kind: "hpp_status_callback"; value: z.infer<typeof HppCallback> }
  | { kind: "authorization_callback" };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const UPPER_SNAKE = /^[A-Z][A-Z0-9_]*$/;
const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function detect(input: unknown): DetectionResult {
  const none: DetectionResult = {
    provider: "klarna",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  const hit = (format: string, confidence: number, reasons: string[]): DetectionResult => ({
    ...none,
    format,
    confidence,
    supported: true,
    reasons,
  });

  if (isStr(input.error_code) && UPPER_SNAKE.test(input.error_code)) {
    const messages =
      Array.isArray(input.error_messages) && input.error_messages.every((m) => isStr(m));
    const single = isStr(input.error_message);
    const corr = isStr(input.correlation_id);
    if (messages && corr)
      return hit("klarna.error_response", 0.9, [
        "has an ALL_CAPS error_code, an error_messages string array and a correlation_id",
      ]);
    if (single && corr)
      return hit("klarna.error_response", 0.75, [
        "has an ALL_CAPS error_code, an error_message and a correlation_id",
      ]);
    if (messages)
      return hit("klarna.error_response", 0.6, [
        "has an ALL_CAPS error_code and an error_messages string array",
      ]);
    return none;
  }

  if (isStr(input.order_id)) {
    const fraud = isStr(input.fraud_status) && FRAUD_STATUSES.includes(input.fraud_status);
    const omStatus = isStr(input.status) && lookup(ORDER_STATUSES, input.status) !== undefined;
    const omAmounts = ["order_amount", "captured_amount", "remaining_authorized_amount"].filter(
      (k) => isInt(input[k]),
    );
    if (fraud && omStatus)
      return hit("klarna.order", 0.95, [
        "has order_id, a documented Order Management status and a documented fraud_status",
      ]);
    if (fraud && omAmounts.length > 0)
      return hit("klarna.order", 0.9, [
        "has order_id, a documented fraud_status and Order Management amount fields",
      ]);
    if (omStatus && omAmounts.length >= 2 && isStr(input.purchase_currency))
      return hit("klarna.order", 0.8, [
        "has order_id, a documented Order Management status, purchase_currency and amount fields",
      ]);
    if (fraud && isStr(input.status))
      return hit("klarna.order", 0.7, [
        "has order_id, a documented fraud_status and an order status not in the documented list",
      ]);
    if (fraud && input.fraud_status !== "REJECTED" && !("status" in input)) {
      const pm = input.authorized_payment_method;
      const pmType = isObj(pm) ? pm.type : pm;
      const knownPm = isStr(pmType) && AUTHORIZED_PAYMENT_METHOD_TYPES.includes(pmType);
      if (knownPm || isStr(input.redirect_url))
        return hit("klarna.payments_order", 0.9, [
          "has order_id and a documented fraud_status",
          knownPm ? "has a documented authorized_payment_method type" : "has redirect_url",
        ]);
      return hit("klarna.payments_order", 0.7, ["has order_id and a documented fraud_status"]);
    }
    return none;
  }

  if (isStr(input.capture_id) && isInt(input.captured_amount)) {
    const at = isStr(input.captured_at);
    return hit("klarna.capture", at ? 0.9 : 0.8, [
      "has capture_id and an integer captured_amount",
      ...(at ? ["has captured_at"] : []),
    ]);
  }
  if (isStr(input.refund_id) && isInt(input.refunded_amount)) {
    const at = isStr(input.refunded_at);
    return hit("klarna.refund", at ? 0.9 : 0.8, [
      "has refund_id and an integer refunded_amount",
      ...(at ? ["has refunded_at"] : []),
    ]);
  }

  if (isStr(input.event_id) && isObj(input.session) && isStr(input.session.status)) {
    const s = input.session;
    const known = lookup(HPP_STATUSES, s.status as string) !== undefined;
    const hasSessionId = isStr(s.session_id);
    if (known && hasSessionId)
      return hit("klarna.hpp_status_callback", 0.95, [
        "has event_id and a session with session_id and a documented Hosted Payment Page status",
      ]);
    if (known)
      return hit("klarna.hpp_status_callback", 0.8, [
        "has event_id and a session with a documented Hosted Payment Page status",
      ]);
    if (hasSessionId && isStr(s.updated_at) && isStr(s.expires_at))
      return hit("klarna.hpp_status_callback", 0.6, [
        "has event_id and a session with session_id, status, updated_at and expires_at",
      ]);
    return none;
  }

  const keys = Object.keys(input);
  if (keys.length === 2 && isStr(input.authorization_token) && isStr(input.session_id))
    return hit("klarna.authorization_callback", 0.6, [
      "has exactly authorization_token and session_id",
    ]);

  return none;
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
}

type ParseResult = { ok: true; value: KlarnaParsed } | { ok: false; issues: string[] };

function parse(input: unknown, format: string): ParseResult {
  switch (format) {
    case "klarna.error_response": {
      const r = ErrorResponse.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      if (!r.data.error_messages && r.data.error_message === undefined)
        return { ok: false, issues: ["error_messages: missing (and no error_message)"] };
      return { ok: true, value: { kind: "error_response", value: r.data } };
    }
    case "klarna.payments_order": {
      const r = PaymentsOrder.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payments_order", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "klarna.order": {
      const r = Order.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "order", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "klarna.capture": {
      const r = CaptureWithId.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "capture", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "klarna.refund": {
      const r = RefundWithId.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "refund", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "klarna.hpp_status_callback": {
      const r = HppCallback.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "hpp_status_callback", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "klarna.authorization_callback": {
      // Both values are sensitive; only their presence is checked.
      const r = AuthorizationCallback.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "authorization_callback" } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    default:
      return { ok: false, issues: [`Unsupported Klarna format "${format}".`] };
  }
}

type Attributes = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attributes {
  const out: Attributes = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

const iso = (v: unknown) => toIsoTimestamp(v);

function httpAttrs(meta: RecordMeta | undefined): Attributes {
  const status = meta?.http?.status;
  return status === undefined ? {} : { httpStatus: status };
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Base = Pick<NormalizedEventDraft, "sourceFormat" | "source"> & {
  observedTimestamp?: string;
};

function base(ctx: NormalizeContext, path: string): Base {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

/** Error codes whose documented meaning is that the operation itself was refused or declined. */
const REFUSED_CODES = new Set([
  "REJECTED",
  "PAYMENT_METHOD_FAILED",
  "TOKEN_SUSPENDED",
  "UNAVAILABLE_PAYMENT_METHOD",
  "CAPTURE_NOT_ALLOWED",
  "CANCEL_NOT_ALLOWED",
  "REFUND_NOT_ALLOWED",
  "NOT_ALLOWED",
]);

function fraudOutcome(fraud: string | undefined): Outcome {
  if (fraud === "ACCEPTED") return "success";
  if (fraud === "PENDING") return "pending";
  return "unknown";
}

function paymentMethodType(pm: z.infer<typeof PaymentMethod> | undefined): string | undefined {
  return typeof pm === "string" ? pm : pm?.type;
}

function captureEvent(
  c: CaptureValue,
  ctx: NormalizeContext,
  path: string,
  eventType: string,
  order?: OrderValue,
): NormalizedEventDraft {
  return clean({
    ...base(ctx, path),
    eventType,
    eventTypeKnown: true,
    stage: "capture",
    paymentReference: safeId(order?.order_id, 255),
    relatedReference: safeId(c.capture_id, 255),
    eventTimestamp: iso(c.captured_at),
    amountMinor: minorUnits(c.captured_amount),
    currency: upperCurrency(order?.purchase_currency),
    outcome: "success",
    attributes: attrs([
      ["objectType", "capture"],
      ["refundedAmountMinor", minorUnits(c.refunded_amount)],
    ]),
  });
}

function refundEvent(
  r: RefundValue,
  ctx: NormalizeContext,
  path: string,
  eventType: string,
  order?: OrderValue,
): NormalizedEventDraft {
  return clean({
    ...base(ctx, path),
    eventType,
    eventTypeKnown: true,
    stage: "refund",
    paymentReference: safeId(order?.order_id, 255),
    relatedReference: safeId(r.refund_id, 255),
    eventTimestamp: iso(r.refunded_at),
    amountMinor: minorUnits(r.refunded_amount),
    currency: upperCurrency(order?.purchase_currency),
    // Registered on the order; Klarna documents no refund status or payout time.
    outcome: "success",
    attributes: attrs([
      ["objectType", "refund"],
      ["creditInvoice", r.credit_invoice],
    ]),
  });
}

function normalize(parsed: KlarnaParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "error_response": {
      const e = parsed.value;
      const code = safeId(e.error_code, 128) ?? "unknown";
      const entry = lookup(ERROR_CODES, e.error_code);
      return [
        clean({
          ...base(ctx, ""),
          eventType: `api_error.${code}`,
          eventTypeKnown: entry !== undefined,
          stage: "error",
          providerStatus: code,
          outcome: REFUSED_CODES.has(e.error_code) ? "failure" : "unknown",
          attributes: {
            ...attrs([
              ["errorCode", code],
              ["correlationId", safeId(e.correlation_id, 255)],
              ["messageCount", e.error_messages?.length ?? (e.error_message ? 1 : 0)],
            ]),
            ...httpAttrs(ctx.meta),
          },
        }),
      ];
    }
    case "payments_order": {
      const o = parsed.value;
      const pm = o.authorized_payment_method;
      return [
        clean({
          ...base(ctx, ""),
          eventType: "payments.order_created",
          eventTypeKnown: true,
          stage: "authorization",
          providerStatus: safeId(o.fraud_status, 32),
          paymentReference: safeId(o.order_id, 255),
          outcome: fraudOutcome(o.fraud_status),
          attributes: {
            ...attrs([
              ["objectType", "payments_order"],
              ["fraudStatus", o.fraud_status],
              ["authorizedPaymentMethod", paymentMethodType(pm)],
              [
                "numberOfInstallments",
                typeof pm === "object" ? pm.number_of_installments : undefined,
              ],
              ["numberOfDays", typeof pm === "object" ? pm.number_of_days : undefined],
              ["hasRedirectUrl", o.redirect_url !== undefined ? true : undefined],
            ]),
            ...httpAttrs(ctx.meta),
          },
        }),
      ];
    }
    case "order": {
      const o = parsed.value;
      const info = lookup(ORDER_STATUSES, o.status);
      let outcome: Outcome = info?.outcome ?? "unknown";
      if (o.status === "AUTHORIZED" && o.fraud_status === "PENDING") outcome = "pending";
      if (o.status === "AUTHORIZED" && o.fraud_status === "REJECTED") outcome = "unknown";
      const events: NormalizedEventDraft[] = [
        clean({
          ...base(ctx, ""),
          eventType: "order.snapshot",
          eventTypeKnown: true,
          stage: info?.stage ?? "other",
          providerStatus: safeId(o.status, 32),
          paymentReference: safeId(o.order_id, 255),
          amountMinor: minorUnits(o.order_amount),
          currency: upperCurrency(o.purchase_currency),
          outcome,
          attributes: {
            ...attrs([
              ["objectType", "order"],
              ["orderStatus", o.status],
              ["fraudStatus", o.fraud_status],
              ["originalOrderAmountMinor", minorUnits(o.original_order_amount)],
              ["capturedAmountMinor", minorUnits(o.captured_amount)],
              ["refundedAmountMinor", minorUnits(o.refunded_amount)],
              ["remainingAuthorizedAmountMinor", minorUnits(o.remaining_authorized_amount)],
              ["purchaseCountry", o.purchase_country],
              ["createdAt", iso(o.created_at)],
              ["expiresAt", iso(o.expires_at)],
              ["initialPaymentMethod", o.initial_payment_method?.type],
              ["numberOfInstallments", o.initial_payment_method?.number_of_installments],
              ["captureCount", o.captures?.length],
              ["refundCount", o.refunds?.length],
            ]),
            ...httpAttrs(ctx.meta),
          },
        }),
      ];
      (o.captures ?? []).forEach((c, i) => {
        if (c.capture_id === undefined && c.captured_amount === undefined) return;
        events.push(captureEvent(c, ctx, `captures[${i}]`, "order.capture", o));
      });
      (o.refunds ?? []).forEach((r, i) => {
        if (r.refund_id === undefined && r.refunded_amount === undefined) return;
        events.push(refundEvent(r, ctx, `refunds[${i}]`, "order.refund", o));
      });
      return events;
    }
    case "capture":
      return [captureEvent(parsed.value, ctx, "", "capture.snapshot")];
    case "refund":
      return [refundEvent(parsed.value, ctx, "", "refund.snapshot")];
    case "hpp_status_callback": {
      const cb = parsed.value;
      const s = cb.session;
      const info = lookup(HPP_STATUSES, s.status);
      const eventId = safeId(cb.event_id, 255);
      return [
        clean({
          ...base(ctx, ""),
          eventType: "hpp.status_callback",
          eventTypeKnown: info !== undefined,
          stage: info?.stage ?? "other",
          providerStatus: safeId(s.status, 32),
          eventReference: eventId,
          // Klarna documents event_id for de-duplicating repeated callbacks.
          deliveryKey: eventId,
          paymentReference: safeId(s.order_id, 255),
          eventTimestamp: iso(s.updated_at),
          outcome: info?.outcome ?? "unknown",
          attributes: {
            ...attrs([
              ["objectType", "hpp_session"],
              ["sessionStatus", s.status],
              ["expiresAt", iso(s.expires_at)],
              ["hasAuthorizationToken", "authorization_token" in s ? true : undefined],
              ["orderPlaced", s.order_id !== undefined ? true : undefined],
            ]),
            ...httpAttrs(ctx.meta),
          },
        }),
      ];
    }
    case "authorization_callback":
      return [
        clean({
          ...base(ctx, ""),
          eventType: "payments.authorization_callback",
          eventTypeKnown: true,
          stage: "authorization",
          outcome: "success",
          attributes: {
            ...attrs([["objectType", "authorization_callback"]]),
            ...httpAttrs(ctx.meta),
          },
        }),
      ];
  }
}

const SHARED_CODES = new Set(["NOT_FOUND", "BAD_VALUE", "BAD_REQUEST", "INTERNAL_SERVER_ERROR"]);

function decodeErrors(parsed: KlarnaParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind !== "error_response") return [];
  const e = parsed.value;
  const status = ctx.meta?.http?.status;
  const entry = errorEntry(e.error_code, status);
  const known = lookup(ERROR_CODES, e.error_code);
  const code = safeId(e.error_code, 128) ?? "unknown";
  const subCodes: Record<string, string> = {};
  if (status !== undefined) subCodes.httpStatus = String(status);
  const corr = safeId(e.correlation_id, 255);
  if (corr) subCodes.correlationId = corr;

  const missing: string[] = [
    "Klarna error bodies do not include the order id, so the error cannot be linked to an order from this record.",
  ];
  let confidence: Confidence = "insufficient";
  if (entry) {
    confidence = entry.confidence ?? "strong";
    if (known?.byStatus && status === undefined) {
      confidence = "possible";
      missing.push(
        `Klarna documents ${code} with different meanings per HTTP status; the status was not supplied.`,
      );
    } else if (SHARED_CODES.has(code) && entry.api === "both" && confidence === "strong") {
      confidence = "possible";
    }
    if (status !== undefined && entry.http && !entry.http.includes(status))
      missing.push(`Klarna documents ${code} with HTTP ${entry.http.join("/")}, not ${status}.`);
  } else {
    missing.push(
      `Error code "${safeText(e.error_code, 64)}" is not in the PandaPayLens catalog yet.`,
    );
  }
  if (entry?.category === "provider_unavailable" || entry?.category === "rate_limiting")
    missing.push("The error does not show whether the original request took effect.");
  if (SHARED_CODES.has(code))
    missing.push("The body does not say whether Klarna Payments or Order Management answered.");

  const docs: DocumentationLink[] = [];
  if (entry) docs.push({ title: `Klarna error code: ${code}`, url: entry.docs });
  docs.push({ title: "Klarna error object", url: ERROR_OBJECT_URL });

  const message = safeText(e.error_messages?.[0] ?? e.error_message, 300);
  return [
    {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: "" },
      code,
      subCodes,
      category: entry?.category ?? "unknown",
      ...(message ? { providerMessage: message } : {}),
      explanation: entry?.explanation ?? "PandaPayLens does not recognize this Klarna error code.",
      nextAction:
        entry?.nextAction ??
        "Check Klarna's error code pages and look up the correlation_id in the Merchant portal logs.",
      retry: entry?.retry ?? "unknown",
      retryExplanation:
        entry?.retryExplanation ?? "Retry safety cannot be assessed for this error.",
      confidence,
      documentation: docs,
      missingInformation: missing,
      ...(entry?.outcomeKnown ? { outcomeKnown: true } : {}),
    },
  ];
}

export const klarnaAdapter: ProviderAdapter<KlarnaParsed> = {
  id: "klarna",
  displayName: "Klarna",
  version: KLARNA_ADAPTER_VERSION,
  manifest: klarnaManifest,
  supportedFormats: [
    {
      id: "klarna.error_response",
      description: "Error body ({ error_code, error_messages, correlation_id })",
    },
    {
      id: "klarna.payments_order",
      description: "Klarna Payments create order response",
    },
    { id: "klarna.order", description: "Order Management order with captures and refunds" },
    { id: "klarna.capture", description: "Order Management Capture object" },
    { id: "klarna.refund", description: "Order Management Refund object" },
    {
      id: "klarna.hpp_status_callback",
      description: "Hosted Payment Page status callback ({ event_id, session })",
    },
    {
      id: "klarna.authorization_callback",
      description: "Klarna Payments authorization callback",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // order_id links the order, its captures and refunds and the HPP callback
    // that placed it; capture_id and refund_id link a bare object to its entry
    // in the order. correlation_id, klarna_reference and merchant references
    // never link.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default klarnaAdapter;
