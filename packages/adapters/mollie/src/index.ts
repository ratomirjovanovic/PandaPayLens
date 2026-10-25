/**
 * Mollie adapter.
 *
 * Supported input families:
 * - `mollie.payment`     Payments API v2 payment object (`resource: "payment"`, `tr_` id)
 * - `mollie.refund`      Refund object (`resource: "refund"`, `re_` id)
 * - `mollie.chargeback`  Chargeback object (`resource: "chargeback"`, `chb_` id)
 * - `mollie.capture`     Capture object (`resource: "capture"`, `cpt_` id)
 * - `mollie.error`       API v2 error response (`status`, `title`, `detail`, `field`, `_links.documentation`)
 * - `mollie.event`       Next-gen webhook event with the full payload (`_embedded.entity`), experimental
 *
 * Recognized but not supported:
 * - `mollie.webhook.classic`  form-encoded `id=tr_...` with nothing else. Mollie
 *   deliberately sends no status, so the payment object must be fetched.
 * - `mollie.event.simple`     next-gen event without an embedded entity.
 *
 * Objects are snapshots, not event logs. Lifecycle points are only derived
 * from timestamps that are present on the object and are labeled as such.
 */

import {
  decimalToMinor,
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
  CAPTURE_STATUSES,
  EVENT_TYPES,
  EXTRA_PAYMENT_PARAMETERS_URL,
  FAILURE_REASONS,
  FIELD_CATEGORIES,
  GET_PAYMENT_URL,
  HANDLING_ERRORS_URL,
  HTTP_STATUS,
  IDEMPOTENCY_URL,
  ID_PREFIXES,
  PAYMENT_STATUSES,
  RATE_LIMITING_URL,
  REFUND_STATUSES,
  type StatusEntry,
} from "./catalog.js";

import { mollieManifest, MOLLIE_ADAPTER_VERSION } from "./manifest.js";

export { mollieManifest, MOLLIE_ADAPTER_VERSION };

const Id = z.string().min(1).max(64);
const Timestamp = z.string().max(64).nullable().optional();

/** `amount.value` is a decimal string, e.g. "10.00" (S2, S23). */
const Amount = z.looseObject({ currency: z.string().max(8), value: z.string().max(40) });

const Payment = z.looseObject({
  resource: z.literal("payment"),
  id: Id,
  status: z.string().min(1).max(32),
  mode: z.string().max(16).optional(),
  amount: Amount.optional(),
  method: z.string().max(64).nullable().optional(),
  createdAt: Timestamp,
  authorizedAt: Timestamp,
  paidAt: Timestamp,
  canceledAt: Timestamp,
  expiresAt: Timestamp,
  expiredAt: Timestamp,
  failedAt: Timestamp,
  details: z
    .looseObject({
      failureReason: z.string().max(64).optional(),
      failureMessage: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const Refund = z.looseObject({
  resource: z.literal("refund"),
  id: Id,
  status: z.string().min(1).max(32),
  paymentId: Id.optional(),
  amount: Amount.optional(),
  createdAt: Timestamp,
});

const Chargeback = z.looseObject({
  resource: z.literal("chargeback"),
  id: Id,
  paymentId: Id.optional(),
  amount: Amount.optional(),
  createdAt: Timestamp,
  reversedAt: Timestamp,
});

const Capture = z.looseObject({
  resource: z.literal("capture"),
  id: Id,
  status: z.string().min(1).max(32),
  paymentId: Id.optional(),
  amount: Amount.optional(),
  createdAt: Timestamp,
});

const ApiError = z.looseObject({
  status: z.number().int().min(400).max(599),
  title: z.string().max(256),
  detail: z.string(),
  field: z.string().max(256).optional(),
  _links: z
    .looseObject({
      documentation: z.looseObject({ href: z.string(), type: z.string().optional() }),
    })
    .optional(),
});

const Event = z.looseObject({
  resource: z.literal("event"),
  id: Id,
  type: z.string().min(1).max(128),
  entityId: Id.optional(),
  createdAt: Timestamp,
  _embedded: z.looseObject({ entity: z.looseObject({}) }),
});

type Obj = Record<string, unknown>;

export type MollieParsed =
  | { kind: "error"; value: z.infer<typeof ApiError> }
  | { kind: "payment"; value: z.infer<typeof Payment> }
  | { kind: "refund"; value: z.infer<typeof Refund> }
  | { kind: "chargeback"; value: z.infer<typeof Chargeback> }
  | { kind: "capture"; value: z.infer<typeof Capture> }
  | { kind: "event"; value: z.infer<typeof Event> };

type ObjectKind = "payment" | "refund" | "chargeback" | "capture";

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Prefixes that may appear in a classic webhook body (research section 9). */
const CLASSIC_ID = /^(tr|re|chb|cpt|ord|sub|pl)_[A-Za-z0-9]+$/;

function isFormRecord(meta: RecordMeta | undefined): boolean {
  if (meta?.format === "form") return true;
  if (meta?.format !== "http") return false;
  const ct = meta.http?.contentType;
  return ct === undefined || ct === "application/x-www-form-urlencoded";
}

function classicReason(id: string): string {
  const base =
    "This is a Mollie classic webhook: the body contains only a resource id and nothing else (no status, amount, time or signature). Mollie deliberately does not send the status, so PandaPayLens cannot decode an error, determine the outcome or build a timeline from it.";
  if (id.startsWith(ID_PREFIXES.payment)) {
    return `${base} Fetch the payment snapshot with GET /v2/payments/{id} for this id (optionally with ?embed=refunds,chargebacks,captures) and paste the JSON response instead.`;
  }
  if (id.startsWith(ID_PREFIXES.order)) {
    return `${base} The id is an Orders API order, which PandaPayLens does not analyze (Mollie no longer recommends the Orders API). Paste the GET /v2/payments/{id} response of the order's payments instead.`;
  }
  return `${base} Paste the GET response for this resource instead; for payment updates that is GET /v2/payments/{id}.`;
}

/** `{ currency: "EUR", value: "10.00" }` with a decimal string value. */
function isDecimalAmount(v: unknown): boolean {
  return (
    isObj(v) &&
    typeof v.currency === "string" &&
    /^[A-Z]{3}$/.test(v.currency) &&
    typeof v.value === "string" &&
    /^-?\d+(?:\.\d+)?$/.test(v.value)
  );
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: "mollie" };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  const keys = Object.keys(input);
  if (
    isFormRecord(meta) &&
    keys.length === 1 &&
    typeof input.id === "string" &&
    CLASSIC_ID.test(input.id)
  ) {
    const payment = input.id.startsWith(ID_PREFIXES.payment);
    return {
      ...base,
      format: "mollie.webhook.classic",
      confidence: payment ? 0.8 : 0.6,
      supported: false,
      reasons: [
        "form-encoded body with a single id field",
        payment
          ? "id has the documented tr_ payment prefix"
          : "id has a documented Mollie resource prefix",
      ],
      unsupportedReason: classicReason(input.id),
    };
  }

  const id = typeof input.id === "string" ? input.id : "";

  const object = (
    kind: ObjectKind,
    prefix: string,
    extra: (r: string[]) => void = () => {},
  ): DetectionResult => {
    const prefixed = id.startsWith(prefix) && id.length > prefix.length;
    const reasons = [`resource is "${kind}"`];
    if (prefixed) reasons.push(`id has the documented ${prefix} prefix`);
    if (isDecimalAmount(input.amount))
      reasons.push("amount is { currency, value } with a decimal string value");
    extra(reasons);
    return {
      ...base,
      format: `mollie.${kind}`,
      confidence: prefixed ? 0.97 : id ? 0.65 : 0.55,
      supported: true,
      reasons,
    };
  };

  switch (input.resource) {
    case "payment":
      return object("payment", ID_PREFIXES.payment);
    case "refund":
      return object("refund", ID_PREFIXES.refund, (r) => {
        if (str(input.paymentId)?.startsWith(ID_PREFIXES.payment))
          r.push("paymentId has the tr_ prefix");
      });
    case "chargeback":
      return object("chargeback", ID_PREFIXES.chargeback);
    case "capture":
      return object("capture", ID_PREFIXES.capture);
    case "event": {
      if (typeof input.type !== "string") break;
      const eventId = id.startsWith(ID_PREFIXES.event);
      const full = isObj(input._embedded) && isObj(input._embedded.entity);
      const reasons = ['resource is "event"', "has a type"];
      if (eventId) reasons.push("id has the documented event_ prefix");
      if (typeof input.entityId === "string") reasons.push("has entityId");
      if (full) {
        reasons.push("has _embedded.entity (full payload)");
        return {
          ...base,
          format: "mollie.event",
          confidence: eventId ? 0.97 : 0.6,
          supported: true,
          reasons,
        };
      }
      return {
        ...base,
        format: "mollie.event.simple",
        confidence: eventId ? 0.9 : 0.55,
        supported: false,
        reasons: [...reasons, "no _embedded.entity (simple payload)"],
        unsupportedReason:
          "This Mollie next-gen webhook event uses the simple payload: it carries the event type and entity id but no entity, so there is no status, amount or failure reason to analyze. Paste the full-payload event, or the GET response of the entity (for payments: GET /v2/payments/{id}).",
      };
    }
    default:
      break;
  }

  // API error. Its {status, title, detail} shape resembles RFC 7807, which
  // other providers use too, so only the HAL documentation link makes it
  // distinctive enough.
  if (
    !("resource" in input) &&
    typeof input.status === "number" &&
    Number.isInteger(input.status) &&
    input.status >= 400 &&
    input.status <= 599 &&
    (typeof input.title === "string" || typeof input.detail === "string")
  ) {
    const links = isObj(input._links) ? input._links : undefined;
    const doc = links && isObj(links.documentation) ? links.documentation : undefined;
    if (doc && typeof doc.href === "string") {
      return {
        ...base,
        format: "mollie.error",
        confidence: 0.9,
        supported: true,
        reasons: [
          "integer HTTP status in 400-599 with title/detail",
          "has a HAL _links.documentation link",
        ],
      };
    }
    if (typeof input.title === "string" && typeof input.detail === "string") {
      return {
        ...base,
        format: "mollie.error",
        confidence: 0.4,
        supported: true,
        reasons: ["status, title and detail without _links.documentation (generic problem shape)"],
      };
    }
  }

  return none;
}

const SCHEMAS = {
  "mollie.payment": ["payment", Payment],
  "mollie.refund": ["refund", Refund],
  "mollie.chargeback": ["chargeback", Chargeback],
  "mollie.capture": ["capture", Capture],
  "mollie.error": ["error", ApiError],
  "mollie.event": ["event", Event],
} as const;

function parse(
  input: unknown,
  format: string,
): { ok: true; value: MollieParsed } | { ok: false; issues: string[] } {
  const entry = SCHEMAS[format as keyof typeof SCHEMAS];
  if (!entry) return { ok: false, issues: [`Unsupported Mollie format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as MollieParsed };
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 64) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

function money(a: unknown): { amountMinor?: string; currency?: string; invalid: boolean } {
  if (!isObj(a)) return { invalid: false };
  const currency = upperCurrency(a.currency);
  const amountMinor = decimalToMinor(a.value, currency);
  const out: { amountMinor?: string; currency?: string; invalid: boolean } = {
    invalid: a.value !== undefined && amountMinor === undefined,
  };
  if (amountMinor !== undefined) out.amountMinor = amountMinor;
  if (currency !== undefined) out.currency = currency;
  return out;
}

const minorOf = (a: unknown): string | undefined => money(a).amountMinor;

/** Allowlisted, non-sensitive payment fields (research section 8). */
function paymentAttributes(p: Obj): Attrs {
  const details = isObj(p.details) ? p.details : {};
  const statusReason = isObj(p.statusReason) ? p.statusReason : undefined;
  return attrs([
    ["objectType", "payment"],
    ["mode", p.mode],
    ["method", p.method],
    ["sequenceType", p.sequenceType],
    ["captureMode", p.captureMode],
    ["isCancelable", p.isCancelable],
    ["amountRefundedMinor", minorOf(p.amountRefunded)],
    ["amountRemainingMinor", minorOf(p.amountRemaining)],
    ["amountCapturedMinor", minorOf(p.amountCaptured)],
    ["amountChargedBackMinor", minorOf(p.amountChargedBack)],
    // Deadlines, not events.
    ["expiresAt", toIsoTimestamp(p.expiresAt)],
    ["captureBefore", toIsoTimestamp(p.captureBefore)],
    ["failureReason", safeId(details.failureReason, 64)],
    ["cardLabel", details.cardLabel],
    ["cardCountryCode", details.cardCountryCode],
    ["cardSecurity", details.cardSecurity],
    ["cardAudience", details.cardAudience],
    ["cardFunding", details.cardFunding],
    ["feeRegion", details.feeRegion],
    ["wallet", details.wallet],
    // Point-of-sale only; a different code set that is not decoded yet.
    ["statusReasonCode", statusReason ? safeId(statusReason.code, 64) : undefined],
  ]);
}

function childAttributes(kind: Exclude<ObjectKind, "payment">, o: Obj): Attrs {
  return attrs([
    ["objectType", kind],
    ["mode", o.mode],
    ...(kind === "chargeback"
      ? ([["reversed", o.reversedAt !== undefined ? o.reversedAt !== null : undefined]] as [
          string,
          unknown,
        ][])
      : []),
  ]);
}

type Milestone = {
  field: string;
  name: string;
  stage: LifecycleStage;
  outcome: Outcome;
  /** The status this timestamp belongs to, if it is a status timestamp. */
  status?: string;
};

/** Timestamp fields documented on each object (S2, S12-S14). */
const MILESTONES: Record<ObjectKind, readonly Milestone[]> = {
  payment: [
    { field: "createdAt", name: "created", stage: "payment", outcome: "pending" },
    {
      field: "authorizedAt",
      name: "authorized",
      stage: "authorization",
      outcome: "success",
      status: "authorized",
    },
    { field: "paidAt", name: "paid", stage: "payment", outcome: "success", status: "paid" },
    {
      field: "canceledAt",
      name: "canceled",
      stage: "cancellation",
      outcome: "failure",
      status: "canceled",
    },
    {
      field: "expiredAt",
      name: "expired",
      stage: "cancellation",
      outcome: "failure",
      status: "expired",
    },
    { field: "failedAt", name: "failed", stage: "payment", outcome: "failure", status: "failed" },
  ],
  // A refund or capture request being created is not its completion.
  refund: [{ field: "createdAt", name: "created", stage: "refund", outcome: "pending" }],
  capture: [{ field: "createdAt", name: "created", stage: "capture", outcome: "pending" }],
  chargeback: [
    { field: "createdAt", name: "received", stage: "dispute", outcome: "unknown" },
    { field: "reversedAt", name: "reversed", stage: "dispute", outcome: "unknown" },
  ],
};

const STATUSES: Record<ObjectKind, Record<string, StatusEntry> | null> = {
  payment: PAYMENT_STATUSES,
  refund: REFUND_STATUSES,
  capture: CAPTURE_STATUSES,
  // Chargebacks have no status field; their state comes from timestamps.
  chargeback: null,
};

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Refs = { paymentReference?: string; relatedReference?: string };

function refsOf(kind: ObjectKind, o: Obj, parentPayment?: string): Refs {
  if (kind === "payment") return { paymentReference: safeId(o.id, 64) };
  return {
    paymentReference: safeId(o.paymentId, 64) ?? parentPayment,
    relatedReference: safeId(o.id, 64),
  };
}

/**
 * Events from one object snapshot: a lifecycle point for each documented
 * timestamp that is present, plus one event for the current status. The
 * current-status event takes its own status timestamp when present (e.g.
 * paidAt for "paid") and has no event time otherwise.
 */
function snapshotEvents(
  kind: ObjectKind,
  o: Obj,
  ctx: NormalizeContext,
  path: string,
  parentPayment?: string,
): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const prefix = path ? `${path}.` : "";
  const refs = refsOf(kind, o, parentPayment);
  const m = money(o.amount);
  const amount = { amountMinor: m.amountMinor, currency: m.currency };
  const baseAttrs: Attrs = kind === "payment" ? paymentAttributes(o) : childAttributes(kind, o);
  if (m.invalid) baseAttrs.amountNotConvertible = true;

  const status = str(o.status);
  const statuses = STATUSES[kind];
  const stamped = MILESTONES[kind]
    .map((ms) => ({ ms, ts: toIsoTimestamp(o[ms.field]) }))
    .filter((x): x is { ms: Milestone; ts: string } => x.ts !== undefined);
  const own = status ? stamped.find((x) => x.ms.status === status) : undefined;

  const out: NormalizedEventDraft[] = [];
  for (const { ms, ts } of stamped) {
    if (ms === own?.ms) continue;
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: `${kind}.milestone.${ms.name}`,
        eventTypeKnown: true,
        stage: ms.stage,
        ...refs,
        eventTimestamp: ts,
        // Chargebacks have no current-status event, so the amount goes here.
        ...(statuses ? {} : amount),
        outcome: ms.outcome,
        attributes: {
          ...(statuses ? { objectType: kind } : baseAttrs),
          derivedFrom: "snapshot",
          timestampField: ms.field,
        },
        source: { recordIndex: ctx.recordIndex, path: `${prefix}${ms.field}` },
        ...observed,
      }),
    );
  }

  if (statuses || out.length === 0) {
    const entry = status && statuses ? statuses[status] : undefined;
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: `${kind}.snapshot`,
        eventTypeKnown: true,
        stage:
          entry?.stage ??
          (kind === "chargeback" ? "dispute" : kind === "payment" ? "payment" : kind),
        providerStatus: status ? safeText(status, 32) : undefined,
        ...refs,
        eventTimestamp: own?.ts,
        ...amount,
        outcome: entry?.outcome ?? "unknown",
        attributes: {
          ...baseAttrs,
          derivedFrom: "snapshot",
          ...(own ? { timestampField: own.ms.field } : {}),
          ...(statuses && status
            ? { statusKnown: Boolean(entry), final: entry?.final ?? null }
            : {}),
        },
        source: { recordIndex: ctx.recordIndex, path },
        ...observed,
      }),
    );
  }
  return out;
}

const CHILD_SCHEMAS = {
  refunds: ["refund", Refund],
  chargebacks: ["chargeback", Chargeback],
  captures: ["capture", Capture],
} as const;

/**
 * Children embedded with `?embed=refunds,chargebacks,captures`. The shape of
 * `_embedded` is not documented in the payment response schema, so each item
 * is validated on its own and skipped when it does not match.
 */
function embeddedChildren(p: Obj, ctx: NormalizeContext): NormalizedEventDraft[] {
  const embedded = isObj(p._embedded) ? p._embedded : undefined;
  if (!embedded) return [];
  const parent = safeId(p.id, 64);
  const out: NormalizedEventDraft[] = [];
  for (const [key, [kind, schema]] of Object.entries(CHILD_SCHEMAS)) {
    const list = embedded[key];
    if (!Array.isArray(list)) continue;
    list.forEach((item, i) => {
      const r = schema.safeParse(item);
      if (r.success)
        out.push(...snapshotEvents(kind, r.data, ctx, `_embedded.${key}[${i}]`, parent));
    });
  }
  return out;
}

type EntityKind = ObjectKind | "payment-link" | "other";

function entityKind(entity: Obj, entityId: string | undefined): EntityKind {
  const r = entity.resource;
  if (r === "payment" || r === "refund" || r === "chargeback" || r === "capture") return r;
  const id = str(entity.id) ?? entityId ?? "";
  if (id.startsWith(ID_PREFIXES.payment)) return "payment";
  if (id.startsWith(ID_PREFIXES.refund)) return "refund";
  if (id.startsWith(ID_PREFIXES.chargeback)) return "chargeback";
  if (id.startsWith(ID_PREFIXES.capture)) return "capture";
  if (id.startsWith(ID_PREFIXES.paymentLink)) return "payment-link";
  return "other";
}

function signatureAttrs(meta: RecordMeta | undefined): Attrs {
  if (meta?.format !== "http" || meta.http?.kind !== "request") return {};
  // The header value is already redacted by the parser; it cannot be verified
  // without the merchant's signing secret anyway.
  return { signatureHeaderPresent: "x-mollie-signature" in meta.http.headers };
}

function eventEvents(evt: z.infer<typeof Event>, ctx: NormalizeContext): NormalizedEventDraft[] {
  const entity = evt._embedded.entity as Obj;
  const kind = entityKind(entity, evt.entityId);
  const mapping = EVENT_TYPES[evt.type];
  const entityId = safeId(evt.entityId, 64);

  let refs: Refs;
  let attributes: Attrs;
  if (kind === "payment") {
    refs = { paymentReference: safeId(entity.id, 64) ?? entityId };
    attributes = paymentAttributes(entity);
  } else if (kind === "payment-link" || kind === "other") {
    // A payment link id is not a payment id; the payment it produced is not
    // in the documented payload.
    refs = { relatedReference: safeId(entity.id, 64) ?? entityId };
    attributes = attrs([["objectType", kind === "other" ? (str(entity.resource) ?? null) : kind]]);
  } else {
    refs = refsOf(kind, entity);
    refs.relatedReference ??= entityId;
    attributes = childAttributes(kind, entity);
  }
  const m = money(entity.amount);
  if (m.invalid) attributes.amountNotConvertible = true;
  const status = kind === "chargeback" ? undefined : str(entity.status);
  const eventId = safeId(evt.id, 64);

  return [
    clean({
      sourceFormat: ctx.format,
      eventType: safeText(evt.type, 128) ?? "unknown",
      eventTypeKnown: Boolean(mapping),
      stage: mapping?.stage ?? "other",
      providerStatus: status ? safeText(status, 32) : undefined,
      eventReference: eventId,
      deliveryKey: eventId,
      ...refs,
      eventTimestamp: toIsoTimestamp(evt.createdAt),
      amountMinor: m.amountMinor,
      currency: m.currency,
      outcome: mapping?.outcome ?? "unknown",
      attributes: {
        ...attributes,
        payload: "full",
        ...(mapping ? { betaEventType: mapping.beta } : {}),
        ...signatureAttrs(ctx.meta),
      },
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    }),
  ];
}

function retryAfter(meta: RecordMeta | undefined): number | undefined {
  const v = meta?.http?.headers["retry-after"];
  return v !== undefined && /^\d{1,6}$/.test(v) ? Number(v) : undefined;
}

function normalize(parsed: MollieParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "payment":
      return [
        ...snapshotEvents("payment", parsed.value, ctx, ""),
        ...embeddedChildren(parsed.value, ctx),
      ];
    case "refund":
    case "chargeback":
    case "capture":
      return snapshotEvents(parsed.kind, parsed.value, ctx, "");
    case "event":
      return eventEvents(parsed.value, ctx);
    case "error": {
      const e = parsed.value;
      const wait = retryAfter(ctx.meta);
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: `api_error.${e.status}`,
          eventTypeKnown: true,
          stage: "error",
          providerStatus: `HTTP ${e.status}`,
          outcome: "unknown",
          attributes: {
            status: e.status,
            title: safeText(e.title, 100) ?? null,
            field: safeId(e.field, 128) ?? null,
            ...(wait !== undefined ? { retryAfterSeconds: wait } : {}),
          },
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
        }),
      ];
    }
  }
}

const NO_ERROR_CODE =
  "Mollie error responses carry no machine-readable error code; this classification uses the HTTP status and field only.";

function decodeApiError(e: z.infer<typeof ApiError>, ctx: NormalizeContext): DecodedErrorDraft {
  const entry = HTTP_STATUS[e.status];
  const field = safeId(e.field, 128);
  const missing = [NO_ERROR_CODE];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let retryExplanation: string;
  let confidence: Confidence;
  let explanation: string;
  let nextAction: string;

  if (entry) {
    category = (e.status === 422 && field && FIELD_CATEGORIES[field]) || entry.category;
    retry = entry.retry;
    retryExplanation = entry.retryExplanation;
    // A named field makes a 422 specific.
    confidence = e.status === 422 && field ? "strong" : entry.confidence;
    explanation = entry.explanation;
    nextAction = entry.nextAction;
  } else {
    category = "unknown";
    retry = "unknown";
    retryExplanation = "Retry safety cannot be assessed for an undocumented status.";
    confidence = "insufficient";
    explanation = `HTTP ${e.status} is not in Mollie's documented list of error statuses. Mollie's general rule is that 4xx errors are caused by the request and usually do not go away by themselves, and 5xx errors are on Mollie's side.`;
    nextAction = "Read the detail text and check Mollie's error handling guide.";
    missing.push(`HTTP status ${e.status} is not in the PandaPayLens catalog for Mollie.`);
  }

  if (e.status === 422 && !field)
    missing.push(
      "No field was named, so the cause cannot be narrowed down. A 422 without a field can also mean the account's payment services are suspended; check the Mollie Dashboard.",
    );
  if (e.status === 422 && field && !FIELD_CATEGORIES[field])
    explanation = `${explanation} The field named is "${field}".`;
  if (e.status === 429) {
    const wait = retryAfter(ctx.meta);
    if (wait !== undefined) retryExplanation = `${retryExplanation} Retry-After: ${wait} seconds.`;
    else
      missing.push(
        "The Retry-After header is not part of the supplied body; check the response headers for how long to wait.",
      );
  }
  const httpStatus = ctx.meta?.http?.status;
  if (httpStatus !== undefined && httpStatus !== e.status)
    missing.push(
      `The HTTP response status (${httpStatus}) differs from the body's status (${e.status}); Mollie documents them as always equal.`,
    );

  const docs: DocumentationLink[] = [
    { title: "Mollie: handling errors", url: HANDLING_ERRORS_URL },
  ];
  if ([400, 409, 500, 502, 503, 504].includes(e.status))
    docs.push({ title: "Mollie: API idempotency", url: IDEMPOTENCY_URL });
  if (e.status === 429) docs.push({ title: "Mollie: rate limiting", url: RATE_LIMITING_URL });

  const subCodes: Record<string, string> = { status: String(e.status) };
  if (field) subCodes.field = field;
  const message = safeText(e.detail, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: String(e.status),
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction,
    retry,
    retryExplanation,
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

/** Decodes `details.failureReason`, or a failed payment without one. */
function decodePayment(p: Obj, ctx: NormalizeContext, path: string): DecodedErrorDraft[] {
  const details = isObj(p.details) ? p.details : undefined;
  const reason = safeId(details?.failureReason, 64);
  const status = str(p.status);
  if (!reason && status !== "failed") return [];

  const ref = safeId(p.id, 64);
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  if (status) subCodes.status = safeText(status, 32) ?? "";
  const method = safeId(p.method, 64);
  if (method) subCodes.method = method;

  const entry = reason ? FAILURE_REASONS[reason] : undefined;
  let decoded: Pick<
    DecodedErrorDraft,
    "category" | "explanation" | "nextAction" | "retry" | "retryExplanation" | "confidence"
  >;
  if (entry) {
    decoded = entry;
  } else if (reason) {
    decoded = {
      category: "unknown",
      explanation: "This failureReason value is not in Mollie's documented list.",
      nextAction: "Check the payment in the Mollie Dashboard.",
      retry: "unknown",
      retryExplanation: "Without a known reason, retry safety cannot be assessed.",
      confidence: "insufficient",
    };
    missing.push(`failureReason "${reason}" is not in the PandaPayLens catalog for Mollie.`);
  } else {
    decoded = {
      category: "unknown",
      explanation: "Mollie reports the payment as failed but gives no failure reason.",
      nextAction: "Check the payment in the Mollie Dashboard.",
      retry: "unknown",
      retryExplanation: "Without a reason, retry safety cannot be assessed.",
      confidence: "insufficient",
    };
    missing.push(
      "No details.failureReason was supplied. Mollie documents it for card payments only, and it is optional.",
    );
  }
  if (status === "open")
    missing.push(
      'The payment is still "open": after a failed attempt in hosted checkout without a fixed method, Mollie keeps the payment open and the customer can try again.',
    );
  if (!ref) missing.push("No payment id; the payment cannot be looked up from this record.");

  const message = safeText(details?.failureMessage, 300);
  return [
    {
      sourceFormat: ctx.format,
      source: {
        recordIndex: ctx.recordIndex,
        path: reason ? `${path ? `${path}.` : ""}details` : path,
      },
      code: reason ?? "failed",
      subCodes,
      ...decoded,
      ...(message ? { providerMessage: message } : {}),
      documentation: [
        { title: "Mollie: card failureReason values", url: EXTRA_PAYMENT_PARAMETERS_URL },
        { title: "Mollie: payment object", url: GET_PAYMENT_URL },
      ],
      missingInformation: missing,
      ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
    },
  ];
}

function decodeErrors(parsed: MollieParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "error":
      return [decodeApiError(parsed.value, ctx)];
    case "payment":
      return decodePayment(parsed.value, ctx, "");
    case "event": {
      const entity = parsed.value._embedded.entity as Obj;
      return entityKind(entity, parsed.value.entityId) === "payment"
        ? decodePayment(entity, ctx, "_embedded.entity")
        : [];
    }
    default:
      return [];
  }
}

export const mollieAdapter: ProviderAdapter<MollieParsed> = {
  id: "mollie",
  displayName: "Mollie",
  version: MOLLIE_ADAPTER_VERSION,
  manifest: mollieManifest,
  supportedFormats: [
    {
      id: "mollie.payment",
      description: "Payments API v2 payment object (resource: payment), e.g. GET /v2/payments/{id}",
    },
    { id: "mollie.refund", description: "Refund object (resource: refund)" },
    { id: "mollie.chargeback", description: "Chargeback object (resource: chargeback)" },
    { id: "mollie.capture", description: "Capture object (resource: capture)" },
    {
      id: "mollie.error",
      description: "API v2 error response (status, title, detail, field, _links.documentation)",
    },
    {
      id: "mollie.event",
      description: "Next-gen webhook event with the full payload (_embedded.entity), experimental",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Only Mollie object ids (tr_, re_, chb_, cpt_). orderId, customerId and
    // the merchant's metadata can span several payment attempts.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default mollieAdapter;
