/**
 * GoCardless adapter.
 *
 * Supported input families:
 * - `gocardless.api_error`  Pro API error response: `{ "error": { "type", "code", "errors": [...] } }`
 * - `gocardless.events`     Webhook body or GET /events response: `{ "events": [ ... ] }`
 * - `gocardless.event`      One event object, or GET /events/{id}: `{ "events": { ... } }`
 * - `gocardless.payment`    Payment response: `{ "payments": { ... } }`
 * - `gocardless.refund`     Refund response: `{ "refunds": { ... } }`
 *
 * Recognized but not supported: mandate, payout and subscription resource
 * responses (`gocardless.other_resources`).
 */

import {
  lookup,
  minorUnits,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type DecodedErrorDraft,
  type DetectionResult,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type ProviderAdapter,
  type RecordMeta,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  CAUSES,
  ERROR_REASONS,
  ERROR_TYPES,
  ERRORS_URL,
  EVENT_ACTIONS,
  FIELD_VALIDATION,
  NOT_RETRIED_REASONS,
  ORIGINS,
  PAYMENT_EVENTS_URL,
  PAYMENT_STATUSES,
  REFUND_EVENTS_URL,
  REFUND_STATUSES,
  MANDATE_EVENTS_URL,
  RESOURCE_LINK,
  RESOURCE_TYPES,
  type CatalogEntry,
} from "./catalog.js";
import { gocardlessManifest, GOCARDLESS_ADAPTER_VERSION } from "./manifest.js";

export { gocardlessManifest, GOCARDLESS_ADAPTER_VERSION };

const PROVIDER = "gocardless";

const ErrorItem = z.looseObject({
  reason: z.string().max(128).optional(),
  field: z.string().max(256).optional(),
  message: z.string().optional(),
  request_pointer: z.string().max(256).optional(),
});

const ApiError = z.looseObject({
  error: z.looseObject({
    type: z.string().max(64),
    code: z.number().int().optional(),
    message: z.string().optional(),
    documentation_url: z.string().optional(),
    request_id: z.string().max(128).optional(),
    errors: z.array(ErrorItem).max(500).optional(),
  }),
});

const Event = z.looseObject({
  id: z.string().max(64),
  created_at: z.string().max(64),
  resource_type: z.string().max(64),
  action: z.string().max(128),
  details: z
    .looseObject({
      origin: z.string().max(32).optional(),
      cause: z.string().max(128).optional(),
      scheme: z.string().max(64).nullable().optional(),
      reason_code: z.string().max(64).optional(),
      will_attempt_retry: z.boolean().optional(),
      not_retried_reason: z.string().max(64).optional(),
    })
    .optional(),
  links: z.record(z.string(), z.unknown()).optional(),
});

const EventList = z.looseObject({
  events: z.array(Event).min(1),
  meta: z.looseObject({ webhook_id: z.string().max(64).optional() }).optional(),
});

const SingleEvent = z.looseObject({ events: Event });

const Payment = z.looseObject({
  payments: z.looseObject({
    id: z.string().max(64),
    status: z.string().max(64),
    created_at: z.string().max(64).optional(),
    amount: z.number().int().optional(),
    amount_refunded: z.number().int().optional(),
    currency: z.string().optional(),
    charge_date: z.string().max(32).nullable().optional(),
    scheme: z.string().max(64).nullable().optional(),
    retry_if_possible: z.boolean().optional(),
    links: z.record(z.string(), z.unknown()).optional(),
  }),
});

const Refund = z.looseObject({
  refunds: z.looseObject({
    id: z.string().max(64),
    status: z.string().max(64),
    created_at: z.string().max(64).optional(),
    amount: z.number().int().optional(),
    currency: z.string().optional(),
    links: z.record(z.string(), z.unknown()).optional(),
  }),
});

type EventValue = z.infer<typeof Event>;

export type GoCardlessParsed =
  | { kind: "api_error"; value: z.infer<typeof ApiError> }
  | {
      kind: "events";
      events: EventValue[];
      /** JSON path of each event, parallel to `events`. */
      paths: string[];
      webhookId?: string;
    }
  | { kind: "payment"; value: z.infer<typeof Payment> }
  | { kind: "refund"; value: z.infer<typeof Refund> };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

/** Structural score of one event object, 0 when it is not event-shaped. */
function eventScore(o: unknown): { score: number; reasons: string[] } {
  if (!isObj(o) || typeof o.resource_type !== "string" || typeof o.action !== "string")
    return { score: 0, reasons: [] };
  if (!isObj(o.details) && !isObj(o.links)) return { score: 0, reasons: [] };
  const reasons = ["has resource_type and action with a details or links object"];
  let score = 0.3;
  if (RESOURCE_TYPES.has(o.resource_type)) {
    score += 0.45;
    reasons.push(`resource_type "${o.resource_type}" is a documented GoCardless resource type`);
  }
  if (typeof o.id === "string" && /^EV[0-9A-Z]+$/.test(o.id)) {
    score += 0.2;
    reasons.push("id has the EV prefix");
  }
  if (isObj(o.details) && typeof o.details.origin === "string" && ORIGINS.has(o.details.origin)) {
    score += 0.05;
    reasons.push("details.origin is a documented origin");
  }
  return { score, reasons };
}

const RESOURCE_SNAPSHOTS: Record<string, { prefix: RegExp; format: string | null }> = {
  payments: { prefix: /^PM[0-9A-Z]+$/, format: "gocardless.payment" },
  refunds: { prefix: /^RF[0-9A-Z]+$/, format: "gocardless.refund" },
  mandates: { prefix: /^MD[0-9A-Z]+$/, format: null },
  payouts: { prefix: /^PO[0-9A-Z]+$/, format: null },
  subscriptions: { prefix: /^SB[0-9A-Z]+$/, format: null },
};

function detect(input: unknown, _meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  if (isObj(input.error)) {
    const e = input.error;
    if (typeof e.type !== "string" || !lookup(ERROR_TYPES, e.type)) return none;
    const reasons = [`error.type is the GoCardless error type "${e.type}"`];
    let score = 0.3;
    if (typeof e.code === "number" && Number.isInteger(e.code) && e.code >= 400 && e.code < 600) {
      score += 0.2;
      reasons.push("error.code is an HTTP status number");
      if (typeof e.request_id === "string") {
        score += 0.25;
        reasons.push("has error.request_id");
      }
      if (Array.isArray(e.errors)) {
        score += 0.2;
        reasons.push("has an error.errors array");
      }
    }
    return {
      provider: PROVIDER,
      format: "gocardless.api_error",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  if (Array.isArray(input.events)) {
    if (!input.events.length) return none;
    const first = eventScore(input.events[0]);
    if (first.score === 0 || !input.events.every((e) => eventScore(e).score > 0)) return none;
    return {
      provider: PROVIDER,
      format: "gocardless.events",
      confidence: round(first.score + 0.02),
      supported: true,
      reasons: ["has an events array of event objects", ...first.reasons],
    };
  }

  if (isObj(input.events)) {
    const s = eventScore(input.events);
    if (s.score === 0) return none;
    return {
      provider: PROVIDER,
      format: "gocardless.event",
      confidence: round(s.score),
      supported: true,
      reasons: ["has an events object (single event response)", ...s.reasons],
    };
  }

  const bare = eventScore(input);
  if (bare.score > 0) {
    return {
      provider: PROVIDER,
      format: "gocardless.event",
      confidence: round(bare.score),
      supported: true,
      reasons: bare.reasons,
    };
  }

  for (const [key, snap] of Object.entries(RESOURCE_SNAPSHOTS)) {
    const r = input[key];
    if (!isObj(r) || typeof r.id !== "string" || typeof r.status !== "string") continue;
    const prefixed = snap.prefix.test(r.id);
    if (!prefixed && !isObj(r.links)) continue;
    const reasons = [`has a ${key} object with id and status`];
    let score = 0.45;
    if (prefixed) {
      score += 0.4;
      reasons.push("id has the documented GoCardless prefix");
    }
    if (isObj(r.links)) {
      score += 0.1;
      reasons.push("has a links object");
    }
    if (!snap.format) {
      return {
        provider: PROVIDER,
        format: "gocardless.other_resources",
        confidence: round(score),
        supported: false,
        reasons,
        unsupportedReason: `PandaPayLens does not analyze GoCardless ${key} responses yet. Paste the ${key} events (from webhooks or GET /events) instead.`,
      };
    }
    const statuses = key === "payments" ? PAYMENT_STATUSES : REFUND_STATUSES;
    if (lookup(statuses, r.status)) {
      score += 0.05;
      reasons.push(`status "${r.status}" is documented for ${key}`);
    }
    return {
      provider: PROVIDER,
      format: snap.format,
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  return none;
}

function issues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: GoCardlessParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case "gocardless.api_error": {
      const r = ApiError.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "api_error", value: r.data } }
        : { ok: false, issues: issues(r.error) };
    }
    case "gocardless.events": {
      const r = EventList.safeParse(input);
      if (!r.success) return { ok: false, issues: issues(r.error) };
      const webhookId = safeId(r.data.meta?.webhook_id);
      return {
        ok: true,
        value: {
          kind: "events",
          events: r.data.events,
          paths: r.data.events.map((_, i) => `events[${i}]`),
          ...(webhookId ? { webhookId } : {}),
        },
      };
    }
    case "gocardless.event": {
      if (isObj(input) && isObj(input.events)) {
        const r = SingleEvent.safeParse(input);
        return r.success
          ? { ok: true, value: { kind: "events", events: [r.data.events], paths: ["events"] } }
          : { ok: false, issues: issues(r.error) };
      }
      const r = Event.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "events", events: [r.data], paths: [""] } }
        : { ok: false, issues: issues(r.error) };
    }
    case "gocardless.payment": {
      const r = Payment.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payment", value: r.data } }
        : { ok: false, issues: issues(r.error) };
    }
    case "gocardless.refund": {
      const r = Refund.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "refund", value: r.data } }
        : { ok: false, issues: issues(r.error) };
    }
    default:
      return { ok: false, issues: [`Unsupported GoCardless format "${format}".`] };
  }
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/**
 * Identifiers, already checked by safeId. They are not run through safeText:
 * its free-text patterns can mistake an identifier for a bank account number.
 */
function ids(entries: [string, string | undefined][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) if (v) out[k] = v;
  return out;
}

function link(links: Record<string, unknown> | undefined, key: string): string | undefined {
  return links ? safeId(links[key]) : undefined;
}

function signatureAttrs(meta: RecordMeta | undefined): Attrs {
  if (!meta?.http || meta.http.kind !== "request") return {};
  return { signatureHeaderPresent: "webhook-signature" in meta.http.headers };
}

/** Drop undefined optional fields so output is stable and compact. */
function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function normalizeEvent(
  e: EventValue,
  path: string,
  webhookId: string | undefined,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const type = `${e.resource_type}.${e.action}`;
  const mapping = lookup(EVENT_ACTIONS, type);
  const resourceId = link(e.links, lookup(RESOURCE_LINK, e.resource_type) ?? "");
  const eventId = safeId(e.id);
  const d = e.details;
  return clean({
    sourceFormat: ctx.format,
    eventType: safeText(type, 200) ?? "unknown",
    eventTypeKnown: Boolean(mapping),
    stage: mapping?.stage ?? "other",
    providerStatus: safeText(e.action, 128),
    eventReference: eventId,
    deliveryKey: eventId,
    paymentReference: e.resource_type === "payments" ? resourceId : undefined,
    relatedReference: ["refunds", "mandates", "payouts"].includes(e.resource_type)
      ? resourceId
      : undefined,
    subscriptionReference: e.resource_type === "subscriptions" ? resourceId : undefined,
    eventTimestamp: toIsoTimestamp(e.created_at),
    outcome: mapping?.outcome ?? "unknown",
    attributes: {
      ...attrs([
        ["resourceType", e.resource_type],
        ["action", e.action],
        ["meaning", mapping?.meaning],
        ["origin", d?.origin],
        ["cause", d?.cause],
        ["scheme", d?.scheme ?? undefined],
        ["reasonCode", d?.reason_code],
        ["willAttemptRetry", d?.will_attempt_retry],
        ["notRetriedReason", d?.not_retried_reason],
      ]),
      ...ids([
        ["parentEvent", link(e.links, "parent_event")],
        ["newMandate", e.resource_type === "mandates" ? link(e.links, "new_mandate") : undefined],
        ["webhookId", webhookId],
      ]),
      ...signatureAttrs(ctx.meta),
    },
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: GoCardlessParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

  if (parsed.kind === "events") {
    return parsed.events.map((e, i) =>
      normalizeEvent(e, parsed.paths[i] ?? "", parsed.webhookId, ctx),
    );
  }

  if (parsed.kind === "api_error") {
    const e = parsed.value.error;
    const reason = e.errors?.find((x) => typeof x.reason === "string")?.reason;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${safeText(reason ?? e.type, 128) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: safeText(e.type, 64),
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["errorType", e.type],
            ["httpStatus", e.code],
            ["reason", reason],
          ]),
          ...ids([["requestId", safeId(e.request_id)]]),
        },
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "payment") {
    const p = parsed.value.payments;
    const info = lookup(PAYMENT_STATUSES, p.status);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "payments.snapshot",
        eventTypeKnown: true,
        stage: p.status === "charged_back" ? "dispute" : "payment",
        providerStatus: safeText(p.status, 64),
        paymentReference: safeId(p.id),
        subscriptionReference: link(p.links, "subscription"),
        amountMinor: minorUnits(p.amount),
        currency: upperCurrency(p.currency),
        outcome: info?.outcome ?? "unknown",
        // created_at is when the payment was created, not when this status
        // was reached, so it is not used as the event time.
        attributes: {
          ...attrs([
            ["statusMeaning", info?.meaning],
            ["createdAt", toIsoTimestamp(p.created_at)],
            ["chargeDate", p.charge_date ?? undefined],
            [
              "amountRefunded",
              typeof p.amount_refunded === "number" ? String(p.amount_refunded) : undefined,
            ],
            ["scheme", p.scheme ?? undefined],
            ["retryIfPossible", p.retry_if_possible],
          ]),
          ...ids([
            ["mandate", link(p.links, "mandate")],
            ["payout", link(p.links, "payout")],
          ]),
        },
        source,
        ...observed,
      }),
    ];
  }

  const r = parsed.value.refunds;
  const info = lookup(REFUND_STATUSES, r.status);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: "refunds.snapshot",
      eventTypeKnown: true,
      stage: "refund",
      providerStatus: safeText(r.status, 64),
      paymentReference: link(r.links, "payment"),
      relatedReference: safeId(r.id),
      amountMinor: minorUnits(r.amount),
      currency: upperCurrency(r.currency),
      outcome: info?.outcome ?? "unknown",
      attributes: {
        ...attrs([
          ["statusMeaning", info?.meaning],
          ["createdAt", toIsoTimestamp(r.created_at)],
        ]),
        ...ids([["mandate", link(r.links, "mandate")]]),
      },
      source,
      ...observed,
    }),
  ];
}

function decodeApiError(
  parsed: Extract<GoCardlessParsed, { kind: "api_error" }>,
  ctx: NormalizeContext,
): DecodedErrorDraft {
  const e = parsed.value.error;
  const items = e.errors ?? [];
  const reasons = items.map((x) => x.reason).filter((x): x is string => typeof x === "string");
  const fields = items.map((x) => x.field).filter((x): x is string => typeof x === "string");
  const reason = reasons[0];
  const reasonEntry = lookup(ERROR_REASONS, reason);
  const typeEntry = lookup(ERROR_TYPES, e.type);

  let entry: CatalogEntry | undefined;
  let confidence: DecodedErrorDraft["confidence"];
  const missing: string[] = [];
  if (reasonEntry) {
    entry = reasonEntry;
    confidence = "strong";
  } else if (reason) {
    entry = undefined;
    confidence = "insufficient";
    missing.push(`Reason "${safeText(reason, 64)}" is not in the PandaPayLens catalog yet.`);
  } else if (e.type === "validation_failed" && fields.length) {
    entry = FIELD_VALIDATION;
    confidence = "strong";
  } else if (typeEntry) {
    entry = typeEntry;
    confidence = "possible";
    missing.push("The error has no reason, so only its type is known.");
  } else {
    confidence = "insufficient";
  }

  const subCodes: Record<string, string> = { type: e.type };
  if (typeof e.code === "number") subCodes.httpStatus = String(e.code);
  if (reasons.length > 1) subCodes.otherReasons = reasons.slice(1).join(", ");
  if (fields.length) subCodes.fields = [...new Set(fields)].join(", ");

  const message = safeText(items[0]?.message ?? e.message);
  return {
    sourceFormat: ctx.format,
    code: safeText(reason ?? e.type, 128) ?? "unknown",
    subCodes,
    category: entry?.category ?? "unknown",
    ...(message ? { providerMessage: message } : {}),
    explanation: entry?.explanation ?? "PandaPayLens does not recognize this GoCardless error.",
    nextAction:
      entry?.nextAction ??
      "Check the GoCardless error reference, and contact GoCardless support with the request_id if needed.",
    retry: entry?.retry ?? "unknown",
    retryExplanation: entry?.retryExplanation ?? "No retry guidance is available for this error.",
    confidence,
    documentation: [{ title: "GoCardless responses and errors", url: ERRORS_URL }],
    missingInformation: missing,
    ...(reason === "idempotent_creation_conflict" ? { outcomeKnown: true } : {}),
    source: { recordIndex: ctx.recordIndex, path: "error" },
  };
}

/** Events whose `details.cause` explains a failure. */
function decodesCause(e: EventValue): boolean {
  const type = `${e.resource_type}.${e.action}`;
  if (type === "payments.failed" || type === "mandates.failed" || type === "refunds.failed")
    return true;
  // Cancellations at the merchant's request are not errors; only bank reports are.
  return (
    (type === "payments.cancelled" || type === "mandates.cancelled") && e.details?.origin === "bank"
  );
}

const CAUSE_DOCS: Record<string, string> = {
  payments: PAYMENT_EVENTS_URL,
  mandates: MANDATE_EVENTS_URL,
  refunds: REFUND_EVENTS_URL,
};

function decodeEventCause(
  e: EventValue,
  path: string,
  ctx: NormalizeContext,
): DecodedErrorDraft | null {
  const d = e.details;
  const causeCode = d?.cause;
  if (!d || typeof causeCode !== "string" || !decodesCause(e)) return null;
  const entry = lookup(CAUSES, causeCode);
  const missing: string[] = [];
  if (!entry)
    missing.push(
      `Cause "${safeText(causeCode, 64)}" is not in the GoCardless cause tables that PandaPayLens has catalogued.`,
    );
  if (d.reason_code)
    missing.push(
      "The bank reason code is scheme and bank specific and is not decoded; GoCardless advises using the cause instead.",
    );

  let retry = entry?.retry ?? "unknown";
  let retryExplanation =
    entry?.retryExplanation ?? "No retry guidance is available for this cause.";
  if (e.resource_type === "payments" && d.will_attempt_retry === true) {
    retry = "do_not_retry";
    retryExplanation =
      "GoCardless will retry this payment automatically (will_attempt_retry is true). Do not retry it manually as well.";
  } else if (e.resource_type === "payments" && d.will_attempt_retry === false) {
    const why = lookup(NOT_RETRIED_REASONS, d.not_retried_reason);
    if (why) retryExplanation = `${why} ${retryExplanation}`;
  }

  const subCodes: Record<string, string> = {};
  for (const [k, v] of [
    ["origin", d.origin],
    ["scheme", d.scheme ?? undefined],
    ["reason_code", d.reason_code],
    ["not_retried_reason", d.not_retried_reason],
  ] as const) {
    const s = safeId(v, 64);
    if (s) subCodes[k] = s;
  }
  if (typeof d.will_attempt_retry === "boolean")
    subCodes.will_attempt_retry = String(d.will_attempt_retry);

  const paymentReference = e.resource_type === "payments" ? link(e.links, "payment") : undefined;
  return {
    sourceFormat: ctx.format,
    code: safeText(causeCode, 128) ?? "unknown",
    subCodes,
    category: entry?.category ?? "unknown",
    explanation: entry?.explanation ?? "PandaPayLens does not recognize this GoCardless cause.",
    nextAction:
      entry?.nextAction ??
      "Check the event in the GoCardless dashboard and the event type reference.",
    retry,
    retryExplanation,
    confidence: entry?.confidence ?? "insufficient",
    documentation: [
      {
        title: `GoCardless ${e.resource_type} event types`,
        url: lookup(CAUSE_DOCS, e.resource_type) ?? PAYMENT_EVENTS_URL,
      },
    ],
    missingInformation: missing,
    outcomeKnown: true,
    ...(paymentReference ? { paymentReference } : {}),
    source: { recordIndex: ctx.recordIndex, path: path ? `${path}.details` : "details" },
  };
}

export const gocardlessAdapter: ProviderAdapter<GoCardlessParsed> = {
  id: PROVIDER,
  displayName: "GoCardless",
  version: GOCARDLESS_ADAPTER_VERSION,
  manifest: gocardlessManifest,
  supportedFormats: [
    {
      id: "gocardless.api_error",
      description: "Pro API error response ({ error: { type, code, request_id, errors[] } })",
    },
    {
      id: "gocardless.events",
      description: "Webhook body or GET /events response ({ events: [...] })",
    },
    {
      id: "gocardless.event",
      description: "One event object, or the GET /events/{id} response ({ events: { ... } })",
    },
    { id: "gocardless.payment", description: "Payment response ({ payments: { ... } })" },
    { id: "gocardless.refund", description: "Refund response ({ refunds: { ... } })" },
  ],
  detect,
  parse,
  normalize,
  decodeErrors(parsed, ctx) {
    if (parsed.kind === "api_error") return [decodeApiError(parsed, ctx)];
    if (parsed.kind !== "events") return [];
    return parsed.events
      .map((e, i) => decodeEventCause(e, parsed.paths[i] ?? "", ctx))
      .filter((x): x is DecodedErrorDraft => x !== null);
  },
  correlationKeys(event: NormalizedEvent): string[] {
    // Payment and refund ids link events of one payment. Mandate, payout and
    // subscription ids only link events of that same resource: they are set
    // as relatedReference or subscriptionReference on their own events, never
    // on payment events.
    const keys = [event.paymentReference, event.relatedReference];
    if (event.stage === "subscription") keys.push(event.subscriptionReference);
    return keys.filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default gocardlessAdapter;
