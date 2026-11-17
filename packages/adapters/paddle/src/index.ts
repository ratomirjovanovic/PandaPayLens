/**
 * Paddle Billing adapter.
 *
 * Supported input families:
 * - `paddle.notification`  webhook notification or event (`event_id`, `event_type`,
 *   `occurred_at`, `notification_id`, `data`) for transactions, adjustments and
 *   subscriptions
 * - `paddle.entity`        API entity response `{ data, meta }` for one transaction
 *   (`txn_`), adjustment (`adj_`) or subscription (`sub_`)
 * - `paddle.error`         API error response (`error.type`, `code`, `detail`,
 *   `documentation_url`, `meta.request_id`)
 *
 * Recognized but not analyzed:
 * - `paddle.list`                list responses (`data` array with `meta.pagination`)
 * - `paddle.notification.other`  events outside the payment flow (customers,
 *   addresses, products and others), which carry personal or catalog data only
 *
 * Paddle Classic payloads are a different product and are not detected.
 */

import {
  minorUnits,
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
  type LifecycleStage,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ADJUSTMENT_ACTIONS,
  ADJUSTMENT_STATUSES,
  API_ERRORS,
  ERRORS_URL,
  ERROR_REFERENCE_URL,
  ERROR_TYPES,
  EVENT_TYPES,
  GET_TRANSACTION_URL,
  ID_PREFIXES,
  OTHER_EVENT_TYPES,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_ERROR_CODES,
  PAYMENT_FAILED_URL,
  SUBSCRIPTION_STATUSES,
  TRANSACTION_STATUSES,
  errorDocUrl,
  type CatalogEntry,
  type EventEntity,
} from "./catalog.js";
import { paddleManifest, PADDLE_ADAPTER_VERSION } from "./manifest.js";

export { paddleManifest, PADDLE_ADAPTER_VERSION };

const Id = z.string().min(1).max(64);
const Text = z.string().max(64).nullable().optional();

const Transaction = z.looseObject({
  id: Id,
  status: z.string().min(1).max(32),
  currency_code: Text,
  subscription_id: Text,
  origin: Text,
  collection_mode: Text,
  payments: z.array(z.unknown()).optional(),
});

const Adjustment = z.looseObject({
  id: Id,
  action: z.string().min(1).max(64),
  status: z.string().min(1).max(32),
  transaction_id: Id,
  subscription_id: Text,
  currency_code: Text,
});

const Subscription = z.looseObject({
  id: Id,
  status: z.string().min(1).max(32),
  currency_code: Text,
  collection_mode: Text,
});

const Attempt = z.looseObject({
  payment_attempt_id: z.string().max(64).optional(),
  status: z.string().min(1).max(64),
  error_code: z.string().max(64).nullable().optional(),
  amount: z.string().max(40).optional(),
  created_at: Text,
  captured_at: Text,
});

const Notification = z.looseObject({
  event_id: Id,
  event_type: z.string().min(1).max(128),
  occurred_at: z.string().min(1).max(64),
  notification_id: z.string().max(64).optional(),
  data: z.looseObject({}),
});

const EntityResponse = z.looseObject({
  data: z.looseObject({ id: Id }),
  meta: z.looseObject({ request_id: z.string().max(128).optional() }).optional(),
});

const ApiError = z.looseObject({
  error: z.looseObject({
    type: z.string().min(1).max(32),
    code: z.string().min(1).max(128),
    detail: z.string().optional(),
    documentation_url: z.string().max(512).optional(),
    errors: z
      .array(z.looseObject({ field: z.string().optional(), message: z.string().optional() }))
      .optional(),
  }),
  meta: z.looseObject({ request_id: z.string().max(128).optional() }).optional(),
});

type Obj = Record<string, unknown>;
type Tx = z.infer<typeof Transaction>;
type Adj = z.infer<typeof Adjustment>;
type Sub = z.infer<typeof Subscription>;

type Entity =
  | { type: "transaction"; value: Tx }
  | { type: "adjustment"; value: Adj }
  | { type: "subscription"; value: Sub };

export type PaddleParsed =
  | { kind: "error"; value: z.infer<typeof ApiError> }
  | { kind: "entity"; entity: Entity; requestId?: string }
  | { kind: "notification"; value: z.infer<typeof Notification>; entity: Entity };

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const EVENT_TYPE_SHAPE = /^[a-z_]+\.[a-z_]+$/;

function entityOfId(id: unknown): EventEntity | undefined {
  if (typeof id !== "string") return undefined;
  if (id.startsWith(ID_PREFIXES.transaction)) return "transaction";
  if (id.startsWith(ID_PREFIXES.adjustment)) return "adjustment";
  if (id.startsWith(ID_PREFIXES.subscription)) return "subscription";
  return undefined;
}

function entityOfEventType(t: string): EventEntity | undefined {
  const known = EVENT_TYPES[t];
  if (known) return known.entity;
  const prefix = t.split(".")[0];
  return prefix === "transaction" || prefix === "adjustment" || prefix === "subscription"
    ? prefix
    : undefined;
}

function detect(input: unknown): DetectionResult {
  const base = { provider: "paddle" };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  // Webhook notification or event entity.
  if (
    typeof input.event_id === "string" &&
    typeof input.event_type === "string" &&
    EVENT_TYPE_SHAPE.test(input.event_type) &&
    typeof input.occurred_at === "string" &&
    isObj(input.data)
  ) {
    const evt = input.event_id.startsWith(ID_PREFIXES.event);
    const ntf =
      typeof input.notification_id === "string" &&
      input.notification_id.startsWith(ID_PREFIXES.notification);
    const reasons = ["has event_id, event_type (entity.action), occurred_at and a data object"];
    if (evt) reasons.push("event_id has the documented evt_ prefix");
    if (ntf) reasons.push("notification_id has the documented ntf_ prefix");
    const confidence = evt ? (ntf ? 0.97 : 0.85) : ntf ? 0.8 : 0.6;
    const entity = entityOfEventType(input.event_type);
    if (!entity) {
      return {
        ...base,
        format: "paddle.notification.other",
        confidence,
        supported: false,
        reasons,
        unsupportedReason: OTHER_EVENT_TYPES.includes(input.event_type)
          ? `The Paddle event type "${input.event_type}" is outside the payment flow (it describes a customer, address, business, catalog or account entity). PandaPayLens analyzes transaction, adjustment and subscription events.`
          : `The Paddle event type "${input.event_type}" is not in the documented list that PandaPayLens analyzes (transaction, adjustment and subscription events).`,
      };
    }
    return { ...base, format: "paddle.notification", confidence, supported: true, reasons };
  }

  // API error response. A bare { error: { type, code } } is not claimed:
  // detail plus a documentation_url or meta.request_id is required.
  if (isObj(input.error)) {
    const e = input.error;
    if (
      typeof e.type === "string" &&
      e.type in ERROR_TYPES &&
      typeof e.code === "string" &&
      typeof e.detail === "string"
    ) {
      const meta = isObj(input.meta) ? input.meta : undefined;
      const docUrl = typeof e.documentation_url === "string";
      const requestId = typeof meta?.request_id === "string";
      const reasons = [`error.type is "${e.type}" with error.code and error.detail`];
      if (docUrl) reasons.push("has error.documentation_url");
      if (requestId) reasons.push("has meta.request_id");
      const confidence = docUrl && requestId ? 0.95 : docUrl || requestId ? 0.8 : 0.4;
      return { ...base, format: "paddle.error", confidence, supported: true, reasons };
    }
    return none;
  }

  // Entity response or list response.
  const meta = isObj(input.meta) ? input.meta : undefined;
  if (Array.isArray(input.data)) {
    const first: unknown = input.data[0];
    if (meta && isObj(meta.pagination) && isObj(first) && entityOfId(first.id)) {
      return {
        ...base,
        format: "paddle.list",
        confidence: 0.8,
        supported: false,
        reasons: [
          "data is an array of entities with documented id prefixes",
          "has meta.pagination",
        ],
        unsupportedReason:
          "This is a Paddle list response. PandaPayLens analyzes one entity at a time: paste the get response for a single transaction, adjustment or subscription (GET /transactions/{id}), or the webhook notifications.",
      };
    }
    return none;
  }
  if (isObj(input.data) && !("event_type" in input)) {
    const d = input.data;
    const entity = entityOfId(d.id);
    if (!entity || typeof d.status !== "string") return none;
    const requestId = typeof meta?.request_id === "string";
    const reasons = [`data.id has the documented ${ID_PREFIXES[entity]} prefix and data.status`];
    if (requestId) reasons.push("has meta.request_id");
    if (entity === "adjustment" && typeof d.transaction_id === "string")
      reasons.push("adjustment has a transaction_id");
    return {
      ...base,
      format: "paddle.entity",
      confidence: requestId ? 0.95 : 0.6,
      supported: true,
      reasons,
    };
  }
  return none;
}

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => `${prefix}${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parseEntity(
  kind: EventEntity,
  data: unknown,
  prefix: string,
): { ok: true; value: Entity } | { ok: false; issues: string[] } {
  const schema =
    kind === "transaction" ? Transaction : kind === "adjustment" ? Adjustment : Subscription;
  const r = schema.safeParse(data);
  if (!r.success) return { ok: false, issues: issuesOf(r.error, prefix) };
  return { ok: true, value: { type: kind, value: r.data } as Entity };
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PaddleParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case "paddle.error": {
      const r = ApiError.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "error", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "paddle.entity": {
      const r = EntityResponse.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const kind = entityOfId(r.data.data.id);
      if (!kind)
        return { ok: false, issues: ["data.id: not a transaction, adjustment or subscription id"] };
      const e = parseEntity(kind, r.data.data, "data.");
      if (!e.ok) return e;
      const requestId = safeId(r.data.meta?.request_id, 128);
      return {
        ok: true,
        value: { kind: "entity", entity: e.value, ...(requestId ? { requestId } : {}) },
      };
    }
    case "paddle.notification": {
      const r = Notification.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const kind = entityOfEventType(r.data.event_type);
      if (!kind)
        return {
          ok: false,
          issues: ["event_type: not a transaction, adjustment or subscription event"],
        };
      const e = parseEntity(kind, r.data.data, "data.");
      if (!e.ok) return e;
      return { ok: true, value: { kind: "notification", value: r.data, entity: e.value } };
    }
    default:
      return { ok: false, issues: [`Unsupported Paddle format "${format}".`] };
  }
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

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** Payment attempts that match the documented shape, newest first as Paddle sorts them. */
function attemptsOf(tx: Obj): { attempt: z.infer<typeof Attempt>; index: number }[] {
  const list = Array.isArray(tx.payments) ? tx.payments : [];
  const out: { attempt: z.infer<typeof Attempt>; index: number }[] = [];
  list.forEach((item, index) => {
    const r = Attempt.safeParse(item);
    if (r.success) out.push({ attempt: r.data, index });
  });
  return out;
}

function txTotals(tx: Obj): { amountMinor?: string; currency?: string } {
  const details = isObj(tx.details) ? tx.details : undefined;
  const totals = details && isObj(details.totals) ? details.totals : undefined;
  return {
    amountMinor: minorUnits(totals?.grand_total),
    currency: upperCurrency(totals?.currency_code) ?? upperCurrency(tx.currency_code),
  };
}

/** Only the documented origin values decide whether a charge is a renewal. */
const ORIGINS = new Set([
  "api",
  "web",
  "subscription_charge",
  "subscription_payment_method_change",
  "subscription_recurring",
  "subscription_update",
]);

function recurring(origin: unknown): boolean | undefined {
  return typeof origin === "string" && ORIGINS.has(origin)
    ? origin === "subscription_recurring"
    : undefined;
}

function signatureAttrs(meta: RecordMeta | undefined): Attrs {
  if (meta?.format !== "http" || meta.http?.kind !== "request") return {};
  // The parser has already replaced the header value; it cannot be verified
  // without the endpoint secret anyway.
  return { signatureHeaderPresent: "paddle-signature" in meta.http.headers };
}

function transactionAttrs(tx: Tx): Attrs {
  const attempts = attemptsOf(tx);
  const latest = attempts[0]?.attempt;
  return attrs([
    ["objectType", "transaction"],
    ["transactionStatus", tx.status],
    ["statusKnown", Boolean(TRANSACTION_STATUSES[tx.status])],
    ["origin", tx.origin ?? undefined],
    ["collectionMode", tx.collection_mode ?? undefined],
    ["paymentAttempts", Array.isArray(tx.payments) ? tx.payments.length : undefined],
    ["latestAttemptStatus", latest?.status],
    ["latestAttemptErrorCode", latest?.error_code ? safeId(latest.error_code, 64) : undefined],
    ["latestPaymentAttemptId", safeId(latest?.payment_attempt_id, 64)],
  ]);
}

type Semantics = { stage: LifecycleStage; outcome: Outcome; known: boolean };

function transactionSemantics(tx: Tx): Semantics {
  const s = TRANSACTION_STATUSES[tx.status];
  return s
    ? { stage: s.stage, outcome: s.outcome, known: true }
    : { stage: "payment", outcome: "unknown", known: false };
}

function adjustmentSemantics(adj: Adj): Semantics {
  const action = ADJUSTMENT_ACTIONS[adj.action];
  if (!action) return { stage: "other", outcome: "unknown", known: false };
  if (!action.statusDriven) return { stage: action.stage, outcome: "unknown", known: true };
  const status = ADJUSTMENT_STATUSES[adj.status];
  return { stage: action.stage, outcome: status?.outcome ?? "unknown", known: Boolean(status) };
}

function subscriptionSemantics(sub: Sub): Semantics {
  const s = SUBSCRIPTION_STATUSES[sub.status];
  return s
    ? { stage: s.stage, outcome: s.outcome, known: true }
    : { stage: "subscription", outcome: "unknown", known: false };
}

function adjustmentAttrs(adj: Adj): Attrs {
  return attrs([
    ["objectType", "adjustment"],
    ["adjustmentAction", adj.action],
    ["adjustmentType", str(adj.type)],
    ["adjustmentStatus", adj.status],
    ["actionKnown", Boolean(ADJUSTMENT_ACTIONS[adj.action])],
  ]);
}

function adjustmentAmount(adj: Adj): { amountMinor?: string; currency?: string } {
  const totals = isObj(adj.totals) ? adj.totals : undefined;
  return {
    amountMinor: minorUnits(totals?.total),
    currency: upperCurrency(totals?.currency_code) ?? upperCurrency(adj.currency_code),
  };
}

function subscriptionAttrs(sub: Sub): Attrs {
  const scheduled = isObj(sub.scheduled_change) ? sub.scheduled_change : undefined;
  return attrs([
    ["objectType", "subscription"],
    ["subscriptionStatus", sub.status],
    ["statusKnown", Boolean(SUBSCRIPTION_STATUSES[sub.status])],
    ["collectionMode", sub.collection_mode ?? undefined],
    ["scheduledChangeAction", scheduled ? str(scheduled.action) : undefined],
    ["scheduledChangeEffectiveAt", scheduled ? toIsoTimestamp(scheduled.effective_at) : undefined],
    ["nextBilledAt", toIsoTimestamp(sub.next_billed_at)],
  ]);
}

/** References of an entity. Subscription ids are not payment ids. */
function refsOf(entity: Entity): {
  paymentReference?: string;
  relatedReference?: string;
  subscriptionReference?: string;
  isRecurring?: boolean;
} {
  switch (entity.type) {
    case "transaction":
      return {
        paymentReference: safeId(entity.value.id, 64),
        subscriptionReference: safeId(entity.value.subscription_id, 64),
        isRecurring: recurring(entity.value.origin),
      };
    case "adjustment":
      return {
        paymentReference: safeId(entity.value.transaction_id, 64),
        relatedReference: safeId(entity.value.id, 64),
        subscriptionReference: safeId(entity.value.subscription_id, 64),
      };
    case "subscription":
      return {
        // Only subscription.created carries transaction_id: the transaction
        // that caused the subscription.
        paymentReference: safeId(entity.value.transaction_id, 64),
        relatedReference: safeId(entity.value.id, 64),
        subscriptionReference: safeId(entity.value.id, 64),
      };
  }
}

function entityParts(entity: Entity): {
  sem: Semantics;
  attributes: Attrs;
  amount: { amountMinor?: string; currency?: string };
} {
  switch (entity.type) {
    case "transaction":
      return {
        sem: transactionSemantics(entity.value),
        attributes: transactionAttrs(entity.value),
        amount: txTotals(entity.value),
      };
    case "adjustment":
      return {
        sem: adjustmentSemantics(entity.value),
        attributes: adjustmentAttrs(entity.value),
        amount: adjustmentAmount(entity.value),
      };
    case "subscription":
      return {
        sem: subscriptionSemantics(entity.value),
        attributes: subscriptionAttrs(entity.value),
        amount: {},
      };
  }
}

function notificationEvents(
  n: z.infer<typeof Notification>,
  entity: Entity,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const mapping = EVENT_TYPES[n.event_type];
  const { sem, attributes, amount } = entityParts(entity);
  // Fixed semantics of the event type win over the snapshot's status:
  // transaction.payment_failed can carry a transaction that is still ready.
  const stage = mapping?.stage ?? sem.stage;
  const outcome = mapping?.outcome ?? sem.outcome;
  const eventId = safeId(n.event_id, 64);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: safeText(n.event_type, 128) ?? "unknown",
      eventTypeKnown: Boolean(mapping),
      stage,
      providerStatus: safeText(entity.value.status, 32),
      eventReference: eventId,
      deliveryKey: eventId,
      ...refsOf(entity),
      eventTimestamp: toIsoTimestamp(n.occurred_at),
      ...amount,
      outcome,
      attributes: {
        ...attributes,
        ...attrs([["notificationId", safeId(n.notification_id, 64)]]),
        ...signatureAttrs(ctx.meta),
      },
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    }),
  ];
}

/** Status timestamp of a snapshot, only where the status has its own field. */
function snapshotTimestamp(entity: Entity): { ts?: string; field?: string } {
  const v = entity.value as Obj;
  const pick = (field: string) => {
    const ts = toIsoTimestamp(v[field]);
    return ts ? { ts, field } : {};
  };
  switch (entity.type) {
    case "transaction":
      return entity.value.status === "billed" ? pick("billed_at") : {};
    case "adjustment":
      // The documented updates of an adjustment are its approval or rejection.
      return entity.value.status === "pending_approval" ? pick("created_at") : pick("updated_at");
    case "subscription":
      if (entity.value.status === "canceled") return pick("canceled_at");
      if (entity.value.status === "paused") return pick("paused_at");
      return {};
  }
}

function attemptEvents(tx: Tx, ctx: NormalizeContext): NormalizedEventDraft[] {
  const currency = txTotals(tx).currency;
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  return attemptsOf(tx).map(({ attempt, index }) => {
    const s = PAYMENT_ATTEMPT_STATUSES[attempt.status];
    const captured = toIsoTimestamp(attempt.captured_at);
    const created = toIsoTimestamp(attempt.created_at);
    const raw: unknown = Array.isArray(tx.payments) ? tx.payments[index] : undefined;
    const method = isObj(raw) && isObj(raw.method_details) ? raw.method_details : undefined;
    return clean({
      sourceFormat: ctx.format,
      eventType: "payment_attempt.snapshot",
      eventTypeKnown: true,
      stage: s?.stage ?? "payment",
      providerStatus: safeText(attempt.status, 32),
      paymentReference: safeId(tx.id, 64),
      relatedReference: safeId(attempt.payment_attempt_id, 64),
      subscriptionReference: safeId(tx.subscription_id, 64),
      isRecurring: recurring(tx.origin),
      eventTimestamp: captured ?? created,
      amountMinor: minorUnits(attempt.amount),
      currency,
      outcome: s?.outcome ?? "unknown",
      attributes: attrs([
        ["objectType", "payment_attempt"],
        ["attemptStatus", attempt.status],
        ["statusKnown", Boolean(s)],
        ["final", s ? s.final : null],
        ["errorCode", attempt.error_code ? safeId(attempt.error_code, 64) : undefined],
        ["methodType", method ? safeId(method.type, 32) : undefined],
        ["derivedFrom", "snapshot"],
        ["timestampField", captured ? "captured_at" : created ? "created_at" : undefined],
      ]),
      source: { recordIndex: ctx.recordIndex, path: `data.payments[${index}]` },
      ...observed,
    });
  });
}

function entityEvents(
  entity: Entity,
  requestId: string | undefined,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const { sem, attributes, amount } = entityParts(entity);
  const { ts, field } = snapshotTimestamp(entity);
  const out: NormalizedEventDraft[] = [
    clean({
      sourceFormat: ctx.format,
      eventType: `${entity.type}.snapshot`,
      eventTypeKnown: true,
      stage: sem.stage,
      providerStatus: safeText(entity.value.status, 32),
      ...refsOf(entity),
      eventTimestamp: ts,
      ...amount,
      outcome: sem.outcome,
      attributes: {
        ...attributes,
        derivedFrom: "snapshot",
        ...(field ? { timestampField: field } : {}),
        ...(requestId ? { requestId } : {}),
      },
      source: { recordIndex: ctx.recordIndex, path: "data" },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    }),
  ];
  if (entity.type === "transaction") out.push(...attemptEvents(entity.value, ctx));
  return out;
}

function retryAfter(meta: RecordMeta | undefined): number | undefined {
  const v = meta?.http?.headers["retry-after"];
  return v !== undefined && /^\d{1,6}$/.test(v) ? Number(v) : undefined;
}

function normalize(parsed: PaddleParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "notification":
      return notificationEvents(parsed.value, parsed.entity, ctx);
    case "entity":
      return entityEvents(parsed.entity, parsed.requestId, ctx);
    case "error": {
      const e = parsed.value.error;
      const code = safeId(e.code, 128) ?? "unknown";
      const status = ctx.meta?.http?.status ?? API_ERRORS[code]?.httpStatus;
      const wait = retryAfter(ctx.meta);
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: `api_error.${code}`,
          eventTypeKnown: Boolean(API_ERRORS[code]),
          stage: "error",
          providerStatus: status !== undefined ? `HTTP ${status}` : undefined,
          outcome: "unknown",
          attributes: attrs([
            ["errorType", e.type],
            ["errorCode", code],
            ["requestId", safeId(parsed.value.meta?.request_id, 128)],
            ["retryAfterSeconds", wait],
          ]),
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
        }),
      ];
    }
  }
}

const DOC_URL = /^https:\/\/developer\.paddle\.com\/errors\/[a-z_]+\/[a-z0-9_]+$/;

function decodeApiError(p: z.infer<typeof ApiError>, ctx: NormalizeContext): DecodedErrorDraft {
  const e = p.error;
  const code = safeId(e.code, 128) ?? "unknown";
  const entry = API_ERRORS[code];
  const missing: string[] = [];
  const subCodes: Record<string, string> = { type: safeId(e.type, 32) ?? "" };
  const httpStatus = ctx.meta?.http?.status;
  if (httpStatus !== undefined) subCodes.httpStatus = String(httpStatus);

  const fields = (e.errors ?? [])
    .map((x) => safeId(x.field, 128))
    .filter((x): x is string => Boolean(x))
    .slice(0, 10);
  if (fields.length) subCodes.fields = fields.join(",");

  const docs: DocumentationLink[] = [];
  let decoded: CatalogEntry;
  if (entry) {
    decoded = entry;
    docs.push({ title: `Paddle error: ${code}`, url: errorDocUrl(entry.group, code) });
    if (httpStatus !== undefined && httpStatus !== entry.httpStatus)
      missing.push(
        `The HTTP response status (${httpStatus}) differs from the status Paddle documents for this code (${entry.httpStatus}).`,
      );
  } else {
    const typeNote = ERROR_TYPES[e.type];
    decoded = {
      category: "unknown",
      explanation: `This error code is not in the PandaPayLens catalog for Paddle.${typeNote ? ` Paddle's error type "${e.type}" means: ${typeNote}` : ""}`,
      nextAction: "Read the detail text and the linked error reference page.",
      retry: "unknown",
      retryExplanation: "Retry safety cannot be assessed for an uncatalogued code.",
      confidence: "insufficient",
    };
    missing.push(`error.code "${code}" is not in the PandaPayLens catalog for Paddle.`);
    const url = str(e.documentation_url);
    if (url && DOC_URL.test(url)) docs.push({ title: `Paddle error: ${code}`, url });
  }
  docs.push({ title: "Paddle: errors", url: ERRORS_URL });
  if (!entry) docs.push({ title: "Paddle: error reference", url: ERROR_REFERENCE_URL });

  if (code === "too_many_requests") {
    const wait = retryAfter(ctx.meta);
    if (wait !== undefined)
      decoded = {
        ...decoded,
        retryExplanation: `${decoded.retryExplanation} Retry-After: ${wait} seconds.`,
      };
    else
      missing.push(
        "The Retry-After header is not part of the supplied body; check the response headers for how long to wait.",
      );
  }
  if (code === "invalid_field" && !fields.length)
    missing.push("No error.errors list was supplied, so the failing fields are not named.");

  const message = safeText(e.detail, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "error" },
    code,
    subCodes,
    ...decoded,
    ...(message ? { providerMessage: message } : {}),
    documentation: docs,
    missingInformation: missing,
    // Paddle states that requests failing with these codes were not processed.
    ...(entry?.retry === "safe_to_retry_technical_request" ? { outcomeKnown: true } : {}),
  };
}

function decodeAttempt(
  tx: Tx,
  attempt: z.infer<typeof Attempt>,
  index: number,
  ctx: NormalizeContext,
): DecodedErrorDraft {
  const code = safeId(attempt.error_code, 64) ?? "unknown";
  const entry = PAYMENT_ERROR_CODES[code];
  const missing: string[] = [];
  const decoded: CatalogEntry = entry ?? {
    category: "unknown",
    explanation: "This payment attempt error code is not in Paddle's documented list.",
    nextAction: "Check the transaction in the Paddle dashboard.",
    retry: "unknown",
    retryExplanation: "Without a known reason, retry safety cannot be assessed.",
    confidence: "insufficient",
  };
  if (!entry) missing.push(`error_code "${code}" is not in the PandaPayLens catalog for Paddle.`);
  const ref = safeId(tx.id, 64);
  const attemptId = safeId(attempt.payment_attempt_id, 64);
  if (!attemptId) missing.push("The payment attempt has no payment_attempt_id.");
  const subCodes: Record<string, string> = { attemptStatus: safeText(attempt.status, 32) ?? "" };
  if (tx.origin) subCodes.origin = safeText(tx.origin, 64) ?? "";
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: `data.payments[${index}]` },
    code,
    subCodes,
    ...decoded,
    documentation: [
      { title: "Paddle: payment attempt error codes", url: PAYMENT_FAILED_URL },
      { title: "Paddle: get a transaction", url: GET_TRANSACTION_URL },
    ],
    missingInformation: missing,
    // The attempt itself reports a definitive failure.
    outcomeKnown: attempt.status === "error",
    ...(ref ? { paymentReference: ref } : {}),
    ...(attemptId ? { attemptReference: attemptId } : {}),
  };
}

function hasFailure(a: z.infer<typeof Attempt>): boolean {
  return Boolean(a.error_code) || a.status === "error";
}

function decodeErrors(parsed: PaddleParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "error") return [decodeApiError(parsed.value, ctx)];
  if (parsed.entity.type !== "transaction") return [];
  const tx = parsed.entity.value;
  const attempts = attemptsOf(tx);

  if (parsed.kind === "entity")
    return attempts
      .filter((x) => hasFailure(x.attempt))
      .map((x) => decodeAttempt(tx, x.attempt, x.index, ctx));

  // Notifications repeat the whole payment history. Only
  // transaction.payment_failed is about a failed attempt, the newest one;
  // other events (past_due, updated, completed) would repeat it.
  if (parsed.value.event_type !== "transaction.payment_failed") return [];
  const newest = attempts[0];
  if (newest && hasFailure(newest.attempt))
    return [decodeAttempt(tx, newest.attempt, newest.index, ctx)];
  const ref = safeId(tx.id, 64);
  return [
    {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: "data" },
      code: "payment_failed",
      subCodes: {},
      category: "unknown",
      explanation:
        "Paddle reports a failed payment, but the newest payment attempt carries no error_code.",
      nextAction: "Fetch the transaction and check its payments array.",
      retry: "unknown",
      retryExplanation: "Without a reason, retry safety cannot be assessed.",
      confidence: "insufficient",
      documentation: [{ title: "Paddle: transaction.payment_failed", url: PAYMENT_FAILED_URL }],
      missingInformation: ["No payment attempt with an error_code was supplied in data.payments."],
      ...(ref ? { paymentReference: ref } : {}),
    },
  ];
}

export const paddleAdapter: ProviderAdapter<PaddleParsed> = {
  id: "paddle",
  displayName: "Paddle",
  version: PADDLE_ADAPTER_VERSION,
  manifest: paddleManifest,
  supportedFormats: [
    {
      id: "paddle.notification",
      description:
        "Webhook notification or event (event_id, event_type, occurred_at, notification_id, data) for transactions, adjustments and subscriptions",
    },
    {
      id: "paddle.entity",
      description:
        "API entity response ({ data, meta }) for a transaction, adjustment or subscription",
    },
    {
      id: "paddle.error",
      description:
        "API error response (error.type, code, detail, documentation_url, meta.request_id)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Transaction ids, adjustment ids, payment attempt ids and, for
    // subscription events, the subscription id. Customer, address, invoice
    // and discount ids and custom_data span payments and are never used.
    return [
      ...new Set(
        [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x)),
      ),
    ];
  },
};

export * from "./catalog.js";
export default paddleAdapter;
