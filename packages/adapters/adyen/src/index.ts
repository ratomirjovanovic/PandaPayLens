/**
 * Adyen adapter.
 *
 * Supported input families:
 * - `adyen.webhook.standard`  Standard payment webhook (`notificationItems[].NotificationRequestItem`)
 * - `adyen.payment_response`  /payments-style response with `resultCode` and `pspReference`
 * - `adyen.api_error`         API error response (`status`, `errorCode`, `errorType`, `message`)
 *
 * Recognized but not supported: other webhook families (e.g. Balance Platform
 * `{ type, data, environment }`), which have different identifiers and semantics.
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
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type Outcome,
  type ProviderAdapter,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  API_ERROR_TYPES,
  ERROR_CODES_URL,
  EVENT_CODES,
  HTTP_STATUS,
  REFUSAL_REASONS,
  REFUSAL_REASONS_URL,
  REFUSAL_REASON_BY_LABEL,
  RESULT_CODES,
  RESULT_CODES_URL,
  WEBHOOK_TYPES_URL,
  type CatalogEntry,
} from "./catalog.js";

export const ADYEN_ADAPTER_VERSION = "0.1.0";

const Amount = z.looseObject({ value: z.number().int().optional(), currency: z.string().optional() });

const NotificationRequestItem = z.looseObject({
  eventCode: z.string().max(64),
  success: z.enum(["true", "false"]),
  pspReference: z.string().max(64),
  originalReference: z.string().max(64).optional(),
  merchantReference: z.string().max(256).optional(),
  merchantAccountCode: z.string().max(256).optional(),
  eventDate: z.string().max(64).optional(),
  amount: Amount.optional(),
  reason: z.string().optional(),
  paymentMethod: z.string().max(64).optional(),
  operations: z.array(z.string().max(32)).optional(),
});

const StandardWebhook = z.looseObject({
  live: z.enum(["true", "false"]).optional(),
  notificationItems: z.array(z.looseObject({ NotificationRequestItem })).min(1),
});

const PaymentResponse = z.looseObject({
  pspReference: z.string().max(64).optional(),
  resultCode: z.string().max(64),
  merchantReference: z.string().max(256).optional(),
  refusalReason: z.string().optional(),
  refusalReasonCode: z.union([z.string().max(8), z.number().int()]).optional(),
  amount: Amount.optional(),
});

const ApiError = z.looseObject({
  status: z.number().int(),
  errorCode: z.string().max(32),
  message: z.string().optional(),
  errorType: z.string().max(64).optional(),
  pspReference: z.string().max(64).optional(),
});

type Item = z.infer<typeof NotificationRequestItem>;

export type AdyenParsed =
  | { kind: "webhook"; value: z.infer<typeof StandardWebhook> }
  | { kind: "payment_response"; value: z.infer<typeof PaymentResponse> }
  | { kind: "api_error"; value: z.infer<typeof ApiError> };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function detect(input: unknown): DetectionResult {
  const base = { provider: "adyen" };
  const none: DetectionResult = { ...base, format: null, confidence: 0, supported: false, reasons: [] };
  if (!isObj(input)) return none;

  if (Array.isArray(input.notificationItems)) {
    const first = input.notificationItems[0];
    const item = isObj(first) && isObj(first.NotificationRequestItem) ? first.NotificationRequestItem : null;
    if (item && typeof item.eventCode === "string" && typeof item.pspReference === "string") {
      return {
        ...base,
        format: "adyen.webhook.standard",
        confidence: 0.98,
        supported: true,
        reasons: ["has notificationItems[].NotificationRequestItem", "items carry eventCode and pspReference"],
      };
    }
    return { ...base, format: "adyen.webhook.standard", confidence: 0.6, supported: true, reasons: ["has notificationItems, but items are not standard NotificationRequestItems"] };
  }

  if (typeof input.resultCode === "string" && (typeof input.pspReference === "string" || typeof input.merchantReference === "string")) {
    const known = input.resultCode in RESULT_CODES;
    return {
      ...base,
      format: "adyen.payment_response",
      confidence: known ? 0.9 : 0.55,
      supported: true,
      reasons: [known ? `resultCode "${input.resultCode}" is a documented Adyen result code` : "has resultCode and a reference"],
    };
  }

  if (typeof input.status === "number" && typeof input.errorCode === "string" && (typeof input.errorType === "string" || typeof input.message === "string")) {
    return { ...base, format: "adyen.api_error", confidence: 0.85, supported: true, reasons: ["has numeric status, errorCode and errorType/message"] };
  }

  if (typeof input.type === "string" && isObj(input.data) && (input.environment === "test" || input.environment === "live")) {
    return {
      ...base,
      format: "adyen.webhook.other",
      confidence: 0.7,
      supported: false,
      reasons: ["has type, data and environment like Adyen Balance Platform / Management webhooks"],
      unsupportedReason: `Adyen webhook family "${String(input.type).slice(0, 64)}" is recognized but not supported. PandaPayLens supports Standard payment webhooks only.`,
    };
  }

  return none;
}

function parse(input: unknown, format: string): { ok: true; value: AdyenParsed } | { ok: false; issues: string[] } {
  const table = {
    "adyen.webhook.standard": ["webhook", StandardWebhook],
    "adyen.payment_response": ["payment_response", PaymentResponse],
    "adyen.api_error": ["api_error", ApiError],
  } as const;
  const entry = table[format as keyof typeof table];
  if (!entry) return { ok: false, issues: [`Unsupported Adyen format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) return { ok: false, issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  return { ok: true, value: { kind: entry[0], value: r.data } as AdyenParsed };
}

function itemOutcome(item: Item): Outcome {
  const info = EVENT_CODES[item.eventCode];
  if (!info) return "unknown";
  const ok = item.success === "true";
  switch (item.eventCode) {
    // For these codes success=true means the failure/reversal happened.
    case "CAPTURE_FAILED":
    case "REFUND_FAILED":
    case "OFFER_CLOSED":
    case "EXPIRE":
      return ok ? "failure" : "unknown";
    case "PENDING":
      return "pending";
    default:
      return info.stage === "dispute" ? "unknown" : ok ? "success" : "failure";
  }
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as NormalizedEventDraft;
}

function normalize(parsed: AdyenParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

  if (parsed.kind === "webhook") {
    return parsed.value.notificationItems.map(({ NotificationRequestItem: item }, i) => {
      const info = EVENT_CODES[item.eventCode];
      const psp = safeId(item.pspReference);
      const original = safeId(item.originalReference);
      return clean({
        sourceFormat: ctx.format,
        eventType: safeText(item.eventCode, 64) ?? "unknown",
        eventTypeKnown: Boolean(info),
        stage: info?.stage ?? "other",
        providerStatus: `success=${item.success}`,
        eventReference: psp,
        // Modifications carry the payment's pspReference in originalReference.
        paymentReference: original ?? psp,
        relatedReference: original ? psp : undefined,
        merchantReference: safeId(item.merchantReference, 256),
        // Adyen identifies a repeated delivery by eventCode + pspReference.
        deliveryKey: psp ? `${item.eventCode}:${psp}` : undefined,
        eventTimestamp: toIsoTimestamp(item.eventDate),
        amountMinor: minorUnits(item.amount?.value),
        currency: upperCurrency(item.amount?.currency),
        outcome: itemOutcome(item),
        attributes: {
          success: item.success,
          live: parsed.value.live ?? null,
          paymentMethod: safeText(item.paymentMethod, 64) ?? null,
          operations: (item.operations ?? []).map((o) => safeText(o, 32) ?? ""),
          isModification: info?.modification ?? null,
          // `reason` on successful authorisations contains auth code, card
          // summary and expiry, so it is only kept for failures.
          ...(item.success === "false" && item.reason ? { reason: safeText(item.reason, 200) ?? "" } : {}),
        },
        source: { recordIndex: ctx.recordIndex, path: `notificationItems[${i}].NotificationRequestItem` },
        ...observed,
      });
    });
  }

  if (parsed.kind === "payment_response") {
    const r = parsed.value;
    const info = RESULT_CODES[r.resultCode];
    const psp = safeId(r.pspReference);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `payment_response.${r.resultCode}`,
        eventTypeKnown: Boolean(info),
        stage: "authorization",
        providerStatus: r.resultCode,
        eventReference: psp,
        paymentReference: psp,
        merchantReference: safeId(r.merchantReference, 256),
        amountMinor: minorUnits(r.amount?.value),
        currency: upperCurrency(r.amount?.currency),
        outcome: info?.outcome ?? "unknown",
        attributes: {
          resultCode: r.resultCode,
          ...(r.refusalReason ? { refusalReason: safeText(r.refusalReason, 200) ?? "" } : {}),
          ...(r.refusalReasonCode !== undefined ? { refusalReasonCode: String(r.refusalReasonCode) } : {}),
        },
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observed,
      }),
    ];
  }

  const e = parsed.value;
  const psp = safeId(e.pspReference);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: `api_error.${e.errorCode}`,
      eventTypeKnown: true,
      stage: "error",
      providerStatus: `HTTP ${e.status}`,
      eventReference: psp,
      outcome: "unknown",
      attributes: { status: e.status, errorCode: e.errorCode, errorType: e.errorType ?? null },
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...observed,
    }),
  ];
}

function refusalEntry(code: string | undefined, label: string | undefined) {
  const byCode = code ? REFUSAL_REASONS[code] : undefined;
  if (byCode) return { key: code!, entry: byCode };
  const fromLabel = label ? REFUSAL_REASON_BY_LABEL[label.trim().toLowerCase()] : undefined;
  if (fromLabel) return { key: fromLabel, entry: REFUSAL_REASONS[fromLabel]! };
  return null;
}

function decodeRefusal(
  resultCode: string,
  reasonCode: string | undefined,
  reasonText: string | undefined,
  base: Pick<DecodedErrorDraft, "sourceFormat" | "source"> & { paymentReference?: string; attemptReference?: string },
): DecodedErrorDraft {
  const found = refusalEntry(reasonCode, reasonText);
  const missing: string[] = [];
  let entry: CatalogEntry;
  let confidence: Confidence;
  if (found) {
    entry = found.entry;
    confidence = "strong";
  } else if (resultCode === "Error") {
    entry = API_ERROR_TYPES.internal!;
    confidence = "possible";
  } else {
    entry = {
      category: "card_declined",
      explanation: "The payment was refused, but the refusal reason is not in the PandaPayLens catalog.",
      nextAction: "Check the refusal reason in the Adyen Customer Area.",
      retry: "unknown",
      retryExplanation: "Without a known refusal reason, retry safety cannot be assessed.",
    };
    confidence = "insufficient";
  }
  if (!reasonCode && !reasonText) missing.push("No refusal reason was supplied.");
  else if (!found) missing.push(`Refusal reason "${safeText(reasonText ?? reasonCode, 80)}" is not in the PandaPayLens catalog yet.`);
  if (!base.paymentReference) missing.push("No pspReference; the payment cannot be looked up from this record.");

  const subCodes: Record<string, string> = { resultCode };
  if (found) subCodes.refusalReasonCode = found.key;
  else if (reasonCode) subCodes.refusalReasonCode = reasonCode;
  const providerMessage = safeText(reasonText, 200);
  return {
    ...base,
    code: found ? found.entry.label : resultCode,
    subCodes,
    category: entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: entry.explanation,
    nextAction: entry.nextAction,
    retry: entry.retry,
    retryExplanation: entry.retryExplanation,
    confidence,
    documentation: [
      { title: "Adyen refusal reasons", url: REFUSAL_REASONS_URL },
      { title: "Adyen result codes", url: RESULT_CODES_URL },
    ],
    missingInformation: missing,
  };
}

function decodeErrors(parsed: AdyenParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "webhook") {
    const out: DecodedErrorDraft[] = [];
    parsed.value.notificationItems.forEach(({ NotificationRequestItem: item }, i) => {
      if (item.eventCode !== "AUTHORISATION" || item.success !== "false") return;
      const psp = safeId(item.pspReference);
      out.push(
        decodeRefusal("Refused", undefined, item.reason, {
          sourceFormat: ctx.format,
          source: { recordIndex: ctx.recordIndex, path: `notificationItems[${i}].NotificationRequestItem` },
          ...(psp ? { paymentReference: psp, attemptReference: psp } : {}),
        }),
      );
    });
    return out;
  }

  if (parsed.kind === "payment_response") {
    const r = parsed.value;
    if (!["Refused", "Error", "Cancelled"].includes(r.resultCode)) return [];
    const psp = safeId(r.pspReference);
    return [
      decodeRefusal(r.resultCode, r.refusalReasonCode !== undefined ? String(r.refusalReasonCode) : undefined, r.refusalReason, {
        sourceFormat: ctx.format,
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...(psp ? { paymentReference: psp, attemptReference: psp } : {}),
      }),
    ];
  }

  const e = parsed.value;
  const byType = e.errorType ? API_ERROR_TYPES[e.errorType] : undefined;
  const byStatus = HTTP_STATUS[e.status];
  const entry = byType ?? byStatus;
  const message = safeText(e.message, 300);
  const psp = safeId(e.pspReference);
  return [
    {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: "" },
      code: e.errorCode,
      subCodes: { status: String(e.status), ...(e.errorType ? { errorType: e.errorType } : {}) },
      category: entry?.category ?? "unknown",
      ...(message ? { providerMessage: message } : {}),
      explanation: entry?.explanation ?? "PandaPayLens does not recognize this Adyen error.",
      nextAction: entry?.nextAction ?? "Check the Adyen error code reference and the message field.",
      retry: entry?.retry ?? "unknown",
      retryExplanation: entry?.retryExplanation ?? "Retry safety cannot be assessed for this error.",
      // Categorized by errorType/HTTP status only; individual error codes
      // are not mapped yet.
      confidence: entry ? "possible" : "insufficient",
      documentation: [{ title: "Adyen API error codes", url: ERROR_CODES_URL }],
      missingInformation: entry ? [] : ["Neither errorType nor HTTP status maps to a known category."],
      ...(psp ? { paymentReference: psp } : {}),
    },
  ];
}

export const adyenAdapter: ProviderAdapter<AdyenParsed> = {
  id: "adyen",
  displayName: "Adyen",
  version: ADYEN_ADAPTER_VERSION,
  supportedFormats: [
    { id: "adyen.webhook.standard", description: "Standard payment webhook (notificationItems / NotificationRequestItem)" },
    { id: "adyen.payment_response", description: "Payment API response with resultCode and pspReference" },
    { id: "adyen.api_error", description: "API error response (status, errorCode, errorType, message)" },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Only PSP references link events. merchantReference is merchant-chosen
    // and may be reused across separate payment attempts, so it is not a
    // correlation key; rules use it separately for retry analysis.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export { WEBHOOK_TYPES_URL };
export * from "./catalog.js";
export default adyenAdapter;
