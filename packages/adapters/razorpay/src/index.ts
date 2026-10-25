/**
 * Razorpay adapter.
 *
 * Supported input families:
 * - `razorpay.api_error`   Payments API v1 error envelope `{ "error": { "code", "source", "step", "reason", ... } }`,
 *                          also as wrapped by the official Node.js SDK (`{ "statusCode", "error" }`)
 * - `razorpay.payment`     payment entity (`entity: "payment"`) with the flat `error_*` fields
 * - `razorpay.order`, `razorpay.refund`, `razorpay.dispute`, `razorpay.settlement`
 *                          entity snapshots
 * - `razorpay.payout`      RazorpayX payout entity (`entity: "payout"`, `status_details`)
 * - `razorpay.collection`  `{ "entity": "collection", "items": [...] }` of the entities above
 * - `razorpay.webhook`     webhook envelope (`entity: "event"`, `event`, `contains`, `payload`)
 *
 * Recognized but not analyzed: Standard Checkout handler or callback fields
 * (`razorpay.checkout_callback`) and server-to-server creation responses
 * (`razorpay.s2s_create`). Both must be confirmed by fetching the payment.
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
  COMMON_DESCRIPTIONS,
  COMMON_ERRORS_URL,
  DISPUTE_PHASES,
  DISPUTE_STATUSES,
  ERROR_CODES,
  ERROR_PARAMETERS_URL,
  ERRORS_URL,
  ID_PREFIXES,
  LATE_AUTHORISATION_URL,
  ORDER_STATUSES,
  PAYMENT_ENTITY_URL,
  PAYMENT_ERRORS_URL,
  PAYMENT_REASONS,
  PAYMENT_STATUSES,
  PAYOUT_REASONS,
  PAYOUT_STATES_URL,
  PAYOUT_STATUSES,
  PAYOUT_STATUS_DETAILS_URL,
  REASON_PAGES,
  REFUND_STATUSES,
  SETTLEMENT_STATUSES,
  SOURCES,
  STEPS,
  STEP_STAGES,
  UNDOCUMENTED_REASON_ALIASES,
  WEBHOOK_EVENTS,
  X_API_ERRORS_URL,
  X_API_REASONS,
  X_ERRORS_URL,
  X_RETRY_RULE,
  lowersConfidence,
  type EventMapping,
  type StatusInfo,
} from "./catalog.js";
import { razorpayManifest, RAZORPAY_ADAPTER_VERSION } from "./manifest.js";

export { razorpayManifest, RAZORPAY_ADAPTER_VERSION };

const PROVIDER = "razorpay";

const str = z.string().max(256).nullable().optional();
const token = z.string().max(128).nullable().optional();
const int = z.number().int().nullable().optional();
const id = z.string().min(1).max(128);

const ErrorBody = z.looseObject({
  code: z.string().max(64),
  description: z.string().nullable().optional(),
  field: str,
  source: token,
  step: token,
  reason: token,
  metadata: z
    .union([z.looseObject({ payment_id: token, order_id: token }), z.array(z.unknown()).max(0)])
    .nullable()
    .optional(),
});

const ApiError = z.looseObject({ error: ErrorBody, statusCode: z.number().int().optional() });

const Payment = z.looseObject({
  id,
  entity: z.literal("payment"),
  status: z.string().max(64),
  amount: int,
  currency: token,
  order_id: token,
  method: token,
  captured: z.boolean().nullable().optional(),
  international: z.boolean().nullable().optional(),
  amount_refunded: int,
  refund_status: token,
  error_code: token,
  error_description: z.string().nullable().optional(),
  error_source: token,
  error_step: token,
  error_reason: token,
  created_at: z.number().nullable().optional(),
});

const Order = z.looseObject({
  id,
  entity: z.literal("order"),
  status: z.string().max(64),
  amount: int,
  amount_paid: int,
  amount_due: int,
  currency: token,
  attempts: int,
  created_at: z.number().nullable().optional(),
});

const Refund = z.looseObject({
  id,
  entity: z.literal("refund"),
  payment_id: id,
  status: z.string().max(64),
  amount: int,
  currency: token,
  speed_requested: token,
  speed_processed: token,
  created_at: z.number().nullable().optional(),
});

const Dispute = z.looseObject({
  id,
  entity: z.literal("dispute"),
  payment_id: id,
  status: z.string().max(64),
  phase: token,
  reason_code: token,
  amount: int,
  amount_deducted: int,
  currency: token,
  respond_by: z.number().nullable().optional(),
  created_at: z.number().nullable().optional(),
});

const Settlement = z.looseObject({
  id,
  entity: z.literal("settlement"),
  status: z.string().max(64),
  amount: int,
  fees: int,
  tax: int,
  created_at: z.number().nullable().optional(),
});

const Payout = z.looseObject({
  id,
  entity: z.literal("payout"),
  status: z.string().max(64),
  amount: int,
  currency: token,
  mode: token,
  purpose: token,
  fees: int,
  tax: int,
  status_details: z
    .looseObject({ description: z.string().nullable().optional(), source: token, reason: token })
    .nullable()
    .optional(),
  failure_reason: z.string().nullable().optional(),
  created_at: z.number().nullable().optional(),
});

const Collection = z.looseObject({
  entity: z.literal("collection"),
  count: z.number().int().optional(),
  items: z.array(z.looseObject({ entity: z.string().max(64) })).min(1),
});

const Webhook = z.looseObject({
  entity: z.literal("event"),
  event: z.string().min(1).max(128),
  contains: z.array(z.string().max(64)).max(32),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.number().nullable().optional(),
});

const ENTITY_SCHEMAS = {
  payment: Payment,
  order: Order,
  refund: Refund,
  dispute: Dispute,
  settlement: Settlement,
  payout: Payout,
} as const;

type EntityType = keyof typeof ENTITY_SCHEMAS;

type PaymentT = z.infer<typeof Payment>;
type OrderT = z.infer<typeof Order>;
type PayoutT = z.infer<typeof Payout>;

export type EntitySnapshot =
  | { type: "payment"; value: PaymentT }
  | { type: "order"; value: OrderT }
  | { type: "refund"; value: z.infer<typeof Refund> }
  | { type: "dispute"; value: z.infer<typeof Dispute> }
  | { type: "settlement"; value: z.infer<typeof Settlement> }
  | { type: "payout"; value: PayoutT };

export type RazorpayParsed =
  | { kind: "api_error"; value: z.infer<typeof ApiError> }
  | { kind: "entity"; entity: EntitySnapshot }
  | { kind: "collection"; items: EntitySnapshot[] }
  | {
      kind: "webhook";
      value: z.infer<typeof Webhook>;
      /** The entity the event is about (undefined for downtime and unknown events). */
      primary?: EntitySnapshot;
      payment?: PaymentT;
      order?: OrderT;
    };

const FORMATS: Record<string, EntityType | "api_error" | "collection" | "webhook"> = {
  "razorpay.api_error": "api_error",
  "razorpay.payment": "payment",
  "razorpay.order": "order",
  "razorpay.refund": "refund",
  "razorpay.dispute": "dispute",
  "razorpay.settlement": "settlement",
  "razorpay.payout": "payout",
  "razorpay.collection": "collection",
  "razorpay.webhook": "webhook",
};

const ERROR_FIELDS = [
  "error_code",
  "error_description",
  "error_source",
  "error_step",
  "error_reason",
];
const DOTTED_EVENT = /^[a-z][a-z_]*(?:\.[a-z][a-z_]*)+$/;
const ERROR_TYPE_SHAPE = /^[A-Z][A-Z_]{1,62}_ERROR$/;
/** Placeholders Razorpay puts in source, step and reason on generic errors. */
const PLACEHOLDERS = new Set(["", "NA"]);
/**
 * Reasons that describe a payment that is not final yet. An API error with
 * one of them does not mean the attempt failed.
 */
const PENDING_REASONS = new Set([
  "payment_pending",
  "deemed_transaction",
  "collect_request_pending",
  "payment_pending_approval",
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

function prefixed(value: unknown, prefix: string): boolean {
  return typeof value === "string" && value.startsWith(prefix) && value.length > prefix.length;
}

function entityType(value: unknown): EntityType | undefined {
  return typeof value === "string" && has(ENTITY_SCHEMAS, value)
    ? (value as EntityType)
    : undefined;
}

/** Value of a documented field, with Razorpay's NA placeholder treated as absent. */
function present(value: unknown): string | undefined {
  return typeof value === "string" && !PLACEHOLDERS.has(value.trim()) ? value : undefined;
}

function headers(meta: RecordMeta | undefined): Record<string, string> | undefined {
  return meta?.format === "http" && meta.http?.kind === "request" ? meta.http.headers : undefined;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function none(): DetectionResult {
  return { provider: PROVIDER, format: null, confidence: 0, supported: false, reasons: [] };
}

function detectEntity(input: Record<string, unknown>, type: EntityType): DetectionResult {
  const reasons = [`entity is "${type}"`];
  const idPrefixed = prefixed(input.id, ID_PREFIXES[type]);
  let score = idPrefixed ? 0.75 : 0.4;
  if (idPrefixed) reasons.push(`id has the documented ${ID_PREFIXES[type]} prefix`);
  switch (type) {
    case "payment": {
      const quintet = ERROR_FIELDS.filter((k) => has(input, k)).length;
      if (quintet >= 3) {
        score += 0.15;
        reasons.push("has the error_code, error_source, error_step and error_reason fields");
      }
      if (typeof input.captured === "boolean") score += 0.03;
      if (has(input, "amount_refunded") || has(input, "refund_status")) score += 0.03;
      if (isObj(input.acquirer_data)) score += 0.02;
      break;
    }
    case "order":
      if (has(input, "amount_due") && has(input, "amount_paid")) {
        score += 0.1;
        reasons.push("has amount_paid and amount_due");
      }
      if (typeof input.attempts === "number") score += 0.05;
      break;
    case "refund":
    case "dispute":
      if (prefixed(input.payment_id, ID_PREFIXES.payment)) {
        score += 0.1;
        reasons.push("payment_id has the pay_ prefix");
      }
      if (type === "refund" && (has(input, "speed_requested") || has(input, "speed_processed")))
        score += 0.05;
      if (type === "dispute" && typeof input.phase === "string" && DISPUTE_PHASES.has(input.phase))
        score += 0.05;
      break;
    case "settlement":
      if (has(input, "utr")) score += 0.05;
      if (has(input, "fees") && has(input, "tax")) score += 0.05;
      break;
    case "payout":
      if (prefixed(input.fund_account_id, ID_PREFIXES.fundAccount)) {
        score += 0.1;
        reasons.push("fund_account_id has the fa_ prefix");
      }
      if (isObj(input.status_details)) score += 0.05;
      break;
  }
  if (typeof input.created_at === "number") score += 0.02;
  return {
    provider: PROVIDER,
    format: `razorpay.${type}`,
    confidence: round(score),
    supported: true,
    reasons,
  };
}

function detectWebhook(input: Record<string, unknown>, meta?: RecordMeta): DetectionResult {
  const hasEvent = typeof input.event === "string";
  const hasContains = Array.isArray(input.contains);
  if (!isObj(input.payload) || (!hasEvent && !hasContains)) return none();
  const reasons = ['entity is "event"', "has a payload object"];
  let score = hasEvent && hasContains ? 0.8 : 0.5;
  if (hasEvent) reasons.push("has event");
  if (hasContains) reasons.push("has a contains array");
  if (hasEvent && DOTTED_EVENT.test(input.event as string)) score += 0.05;
  if (prefixed(input.account_id, ID_PREFIXES.account)) {
    score += 0.08;
    reasons.push("account_id has the acc_ prefix");
  }
  const payload = input.payload as Record<string, unknown>;
  if (Object.values(payload).some((v) => isObj(v) && isObj(v.entity))) {
    score += 0.05;
    reasons.push("payload entries wrap an entity");
  }
  const h = headers(meta);
  if (h && (has(h, "x-razorpay-signature") || has(h, "x-razorpay-event-id"))) {
    score += 0.02;
    reasons.push("has an x-razorpay-signature or x-razorpay-event-id header");
  }
  return {
    provider: PROVIDER,
    format: "razorpay.webhook",
    confidence: round(score),
    supported: true,
    reasons,
  };
}

function detectError(input: Record<string, unknown>, meta?: RecordMeta): DetectionResult {
  const e = input.error as Record<string, unknown>;
  // Stripe errors carry `type`, Checkout.com errors `error_type`.
  if (has(e, "type") || has(input, "error_type")) return none();
  const code = typeof e.code === "string" ? e.code : undefined;
  if (!code) return none();
  const known = Boolean(lookup(ERROR_CODES, code));
  if (!known && !ERROR_TYPE_SHAPE.test(code)) return none();
  const fields = ["source", "step", "reason", "metadata"].filter((k) => has(e, k)).length;
  const description = typeof e.description === "string";
  const httpError = (meta?.http?.status ?? 0) >= 400;
  let score = 0;
  if (known && fields >= 2) score = 0.9;
  else if (known && fields === 1) score = 0.6;
  else if (known && description) score = httpError ? 0.55 : 0.45;
  else if (fields >= 3) score = 0.6;
  else if (fields >= 1 && description) score = 0.35;
  if (score === 0) return none();
  const reasons = [
    known
      ? `error.code is the documented Razorpay error type "${code}"`
      : "error.code is an upper-case *_ERROR type",
  ];
  if (fields) reasons.push(`error has ${fields} of source, step, reason and metadata`);
  if (["source", "step", "reason"].some((k) => e[k] === "NA")) {
    score += 0.03;
    reasons.push('uses the "NA" placeholder');
  }
  if (typeof input.statusCode === "number") {
    score += 0.02;
    reasons.push("has the SDK statusCode wrapper");
  }
  return {
    provider: PROVIDER,
    format: "razorpay.api_error",
    confidence: round(score),
    supported: true,
    reasons,
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  if (!isObj(input)) return none();

  // Checkout handler / callback: client-side data that must be verified and
  // confirmed server-side. It may arrive form-encoded.
  if (
    typeof input.razorpay_payment_id === "string" &&
    (has(input, "razorpay_signature") || has(input, "razorpay_order_id"))
  ) {
    return {
      provider: PROVIDER,
      format: "razorpay.checkout_callback",
      confidence: 0.85,
      supported: false,
      reasons: ["has razorpay_payment_id with razorpay_order_id or razorpay_signature"],
      unsupportedReason:
        "Razorpay Checkout handler and callback fields are recognized but not analyzed. Razorpay requires the signature to be verified on the server, and the fields carry no status. Fetch the payment (GET /v1/payments/:id) and paste the payment entity instead.",
    };
  }
  if (meta?.format === "form") return none();
  // Stripe objects carry `object`, Mollie objects `resource`.
  if (has(input, "object") || has(input, "resource")) return none();

  if (
    typeof input.razorpay_payment_id === "string" &&
    Array.isArray(input.next) &&
    input.next.some((n) => isObj(n) && typeof n.action === "string")
  ) {
    return {
      provider: PROVIDER,
      format: "razorpay.s2s_create",
      confidence: 0.85,
      supported: false,
      reasons: ["has razorpay_payment_id and a next[] list of actions"],
      unsupportedReason:
        "Razorpay server-to-server creation responses only list the next action (redirect, poll or intent) and carry no status. Fetch the payment (GET /v1/payments/:id) and paste the payment entity instead.",
    };
  }

  if (isObj(input.error)) return detectError(input, meta);

  if (input.entity === "event") return detectWebhook(input, meta);

  if (input.entity === "collection") {
    const items = Array.isArray(input.items) ? input.items : [];
    if (!items.length || !items.every((i) => isObj(i) && entityType(i.entity))) return none();
    const first = items[0] as Record<string, unknown>;
    const type = entityType(first.entity)!;
    const idPrefixed = prefixed(first.id, ID_PREFIXES[type]);
    return {
      provider: PROVIDER,
      format: "razorpay.collection",
      confidence: idPrefixed ? 0.92 : 0.6,
      supported: true,
      reasons: [
        'entity is "collection"',
        "every item is a documented entity",
        ...(idPrefixed ? [`first item id has the ${ID_PREFIXES[type]} prefix`] : []),
      ],
    };
  }

  const type = entityType(input.entity);
  return type ? detectEntity(input, type) : none();
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type Issues = { ok: false; issues: string[] };

function issuesOf(error: z.ZodError, prefix: string): Issues {
  return {
    ok: false,
    issues: error.issues.map((i) => {
      const path = [prefix, ...i.path.map(String)].filter(Boolean).join(".");
      return `${path || "(root)"}: ${i.message}`;
    }),
  };
}

function parseEntity(
  type: EntityType,
  value: unknown,
  prefix: string,
): { ok: true; snapshot: EntitySnapshot } | Issues {
  const r = ENTITY_SCHEMAS[type].safeParse(value);
  if (!r.success) return issuesOf(r.error, prefix);
  return { ok: true, snapshot: { type, value: r.data } as EntitySnapshot };
}

function payloadEntity(payload: Record<string, unknown>, name: string): unknown {
  const wrapper = payload[name];
  return isObj(wrapper) ? wrapper.entity : undefined;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: RazorpayParsed } | { ok: false; issues: string[] } {
  const kind = lookup(FORMATS, format);
  if (!kind) return { ok: false, issues: [`Unsupported Razorpay format "${format}".`] };

  if (kind === "api_error") {
    const r = ApiError.safeParse(input);
    return r.success ? { ok: true, value: { kind, value: r.data } } : issuesOf(r.error, "");
  }

  if (kind === "collection") {
    const r = Collection.safeParse(input);
    if (!r.success) return issuesOf(r.error, "");
    const items: EntitySnapshot[] = [];
    const issues: string[] = [];
    r.data.items.forEach((item, i) => {
      const type = entityType(item.entity);
      if (!type) {
        issues.push(`items.${i}.entity: "${safeId(item.entity, 32) ?? "?"}" is not supported`);
        return;
      }
      const p = parseEntity(type, item, `items.${i}`);
      if (p.ok) items.push(p.snapshot);
      else issues.push(...p.issues);
    });
    return issues.length ? { ok: false, issues } : { ok: true, value: { kind, items } };
  }

  if (kind === "webhook") {
    const r = Webhook.safeParse(input);
    if (!r.success) return issuesOf(r.error, "");
    const value = r.data;
    const mapping = lookup(WEBHOOK_EVENTS, value.event);
    const out: Extract<RazorpayParsed, { kind: "webhook" }> = { kind, value };
    const issues: string[] = [];
    // Validate every documented entity the payload carries, so a malformed
    // snapshot is reported instead of being read partly.
    for (const type of Object.keys(ENTITY_SCHEMAS) as EntityType[]) {
      const raw = payloadEntity(value.payload, type);
      if (raw === undefined) continue;
      const p = parseEntity(type, raw, `payload.${type}.entity`);
      if (!p.ok) {
        issues.push(...p.issues);
        continue;
      }
      if (p.snapshot.type === "payment") out.payment = p.snapshot.value;
      if (p.snapshot.type === "order") out.order = p.snapshot.value;
      if (mapping && mapping.entity === type) out.primary = p.snapshot;
    }
    if (mapping && mapping.entity !== "downtime" && !out.primary && !issues.length)
      issues.push(`payload.${mapping.entity}.entity: required for ${value.event}`);
    if (value.event === "order.paid" && !out.payment && !issues.length)
      issues.push("payload.payment.entity: required for order.paid");
    return issues.length ? { ok: false, issues } : { ok: true, value: out };
  }

  const p = parseEntity(kind, input, "");
  return p.ok ? { ok: true, value: { kind: "entity", entity: p.snapshot } } : p;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const t = safeText(v, 120);
      if (t) out[k] = t;
    } else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeId(x, 64) ?? "");
  }
  return out;
}

const tok = (v: unknown, max = 64) => safeId(present(v), max);
const amountAttr = (v: unknown) => minorUnits(v);

type Described = {
  status?: string;
  info?: StatusInfo;
  paymentReference?: string;
  relatedReference?: string;
  amountMinor?: string;
  currency?: string;
  createdAt?: string;
  attributes: Attrs;
};

function describePayment(p: PaymentT): Described {
  const card = isObj(p.card) ? p.card : undefined;
  const upi = isObj(p.upi) ? p.upi : undefined;
  const acquirer = isObj(p.acquirer_data) ? p.acquirer_data : undefined;
  const status = p.status;
  const failed = status === "failed";
  const base = lookup(PAYMENT_STATUSES, status);
  const stepStage = failed ? lookup(STEP_STAGES, present(p.error_step)) : undefined;
  return {
    status,
    info: base && stepStage ? { ...base, stage: stepStage } : base,
    paymentReference: safeId(p.id),
    relatedReference: tok(p.order_id),
    amountMinor: minorUnits(p.amount),
    currency: upperCurrency(p.currency),
    createdAt: toIsoTimestamp(p.created_at),
    attributes: attrs([
      ["entity", "payment"],
      ["method", tok(p.method, 32)],
      ["captured", p.captured],
      ["international", p.international],
      ["refundStatus", tok(p.refund_status, 32)],
      ["amountRefunded", amountAttr(p.amount_refunded)],
      ["fee", amountAttr(p.fee)],
      ["tax", amountAttr(p.tax)],
      ["cardNetwork", card ? safeText(card.network, 32) : undefined],
      ["cardType", card ? tok(card.type, 32) : undefined],
      ["cardInternational", card?.international],
      ["bank", tok(p.bank, 16)],
      ["wallet", tok(p.wallet, 32)],
      ["upiFlow", upi ? tok(upi.flow, 32) : undefined],
      ["upiPayerAccountType", upi ? tok(upi.payer_account_type, 32) : undefined],
      [
        "acquirerReferencePresent",
        acquirer
          ? Object.values(acquirer).some((v) => typeof v === "string" && v !== "")
          : undefined,
      ],
      ["errorCode", tok(p.error_code)],
      ["errorSource", tok(p.error_source)],
      ["errorStep", tok(p.error_step)],
      ["errorReason", tok(p.error_reason, 128)],
    ]),
  };
}

function describe(s: EntitySnapshot): Described {
  switch (s.type) {
    case "payment":
      return describePayment(s.value);
    case "order": {
      const o = s.value;
      return {
        status: o.status,
        info: lookup(ORDER_STATUSES, o.status),
        relatedReference: safeId(o.id),
        amountMinor: minorUnits(o.amount),
        currency: upperCurrency(o.currency),
        createdAt: toIsoTimestamp(o.created_at),
        attributes: attrs([
          ["entity", "order"],
          ["amountPaid", amountAttr(o.amount_paid)],
          ["amountDue", amountAttr(o.amount_due)],
          ["attempts", o.attempts],
        ]),
      };
    }
    case "refund": {
      const r = s.value;
      const acquirer = isObj(r.acquirer_data) ? r.acquirer_data : undefined;
      return {
        status: r.status,
        info: lookup(REFUND_STATUSES, r.status),
        paymentReference: safeId(r.payment_id),
        relatedReference: safeId(r.id),
        amountMinor: minorUnits(r.amount),
        currency: upperCurrency(r.currency),
        createdAt: toIsoTimestamp(r.created_at),
        attributes: attrs([
          ["entity", "refund"],
          ["refundId", safeId(r.id)],
          ["speedRequested", tok(r.speed_requested, 32)],
          ["speedProcessed", tok(r.speed_processed, 32)],
          [
            "acquirerReferencePresent",
            acquirer
              ? Object.values(acquirer).some((v) => typeof v === "string" && v !== "")
              : undefined,
          ],
        ]),
      };
    }
    case "dispute": {
      const d = s.value;
      return {
        status: d.status,
        info: lookup(DISPUTE_STATUSES, d.status),
        paymentReference: safeId(d.payment_id),
        relatedReference: safeId(d.id),
        amountMinor: minorUnits(d.amount),
        currency: upperCurrency(d.currency),
        createdAt: toIsoTimestamp(d.created_at),
        attributes: attrs([
          ["entity", "dispute"],
          ["disputeId", safeId(d.id)],
          ["phase", tok(d.phase, 32)],
          ["reasonCode", tok(d.reason_code, 96)],
          ["amountDeducted", amountAttr(d.amount_deducted)],
          ["respondBy", toIsoTimestamp(d.respond_by)],
        ]),
      };
    }
    case "settlement": {
      const st = s.value;
      return {
        status: st.status,
        info: lookup(SETTLEMENT_STATUSES, st.status),
        relatedReference: safeId(st.id),
        amountMinor: minorUnits(st.amount),
        // Settlements are documented as INR only and the entity has no currency.
        createdAt: toIsoTimestamp(st.created_at),
        attributes: attrs([
          ["entity", "settlement"],
          ["fees", amountAttr(st.fees)],
          ["tax", amountAttr(st.tax)],
          ["utrPresent", typeof st.utr === "string" && st.utr !== "" ? true : undefined],
        ]),
      };
    }
    case "payout": {
      const p = s.value;
      const details = p.status_details ?? undefined;
      return {
        status: p.status,
        info: lookup(PAYOUT_STATUSES, p.status),
        paymentReference: safeId(p.id),
        amountMinor: minorUnits(p.amount),
        currency: upperCurrency(p.currency),
        createdAt: toIsoTimestamp(p.created_at),
        attributes: attrs([
          ["entity", "payout"],
          ["mode", tok(p.mode, 16)],
          ["purpose", tok(p.purpose, 32)],
          ["fees", amountAttr(p.fees)],
          ["tax", amountAttr(p.tax)],
          ["statusDetailsReason", details ? tok(details.reason, 96) : undefined],
          ["statusDetailsSource", details ? tok(details.source, 32) : undefined],
          ["utrPresent", typeof p.utr === "string" && p.utr !== "" ? true : undefined],
        ]),
      };
    }
  }
}

/** Stage when the status is not documented. */
const DEFAULT_STAGE: Record<EntityType, LifecycleStage> = {
  payment: "payment",
  order: "payment",
  refund: "refund",
  dispute: "dispute",
  settlement: "settlement",
  payout: "payout",
};

/** Drop undefined optional fields so output is stable and compact. */
function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function snapshotEvent(
  s: EntitySnapshot,
  ctx: NormalizeContext,
  path: string,
): NormalizedEventDraft {
  const d = describe(s);
  return clean({
    sourceFormat: ctx.format,
    eventType: `${s.type}.snapshot`,
    eventTypeKnown: true,
    stage: d.info?.stage ?? DEFAULT_STAGE[s.type],
    providerStatus: safeText(d.status, 64),
    paymentReference: d.paymentReference,
    relatedReference: d.relatedReference,
    amountMinor: d.amountMinor,
    currency: d.currency,
    outcome: d.info?.outcome ?? "unknown",
    // created_at is when the entity was created, not when this status was
    // reached, so it is not used as the event time.
    attributes: { ...d.attributes, ...(d.createdAt ? { createdAt: d.createdAt } : {}) },
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function signatureAttrs(meta: RecordMeta | undefined): Attrs {
  const h = headers(meta);
  if (!h) return {};
  return {
    signatureHeader: has(h, "x-razorpay-signature") ? "present_not_verified" : "absent",
  };
}

function webhookEvent(
  parsed: Extract<RazorpayParsed, { kind: "webhook" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const w = parsed.value;
  const mapping: EventMapping | undefined = lookup(WEBHOOK_EVENTS, w.event);
  const eventId = safeId(headers(ctx.meta)?.["x-razorpay-event-id"], 128);
  let d: Described = { attributes: {} };
  let stage: LifecycleStage =
    mapping?.stage === "from_step" ? "payment" : (mapping?.stage ?? "other");
  let outcome: Outcome = "unknown";

  if (w.event === "order.paid" && parsed.payment && parsed.order) {
    // The payment carries the references and amount; the order adds its state.
    const pay = describePayment(parsed.payment);
    const order = describe({ type: "order", value: parsed.order });
    d = {
      ...pay,
      status: parsed.order.status,
      attributes: {
        ...pay.attributes,
        paymentStatus: safeText(parsed.payment.status, 64) ?? null,
        orderAmountPaid: order.attributes.amountPaid ?? null,
        orderAmountDue: order.attributes.amountDue ?? null,
      },
    };
  } else if (parsed.primary) {
    d = describe(parsed.primary);
    if (parsed.primary.type !== "payment" && parsed.payment) {
      d.attributes.paymentStatus = safeText(parsed.payment.status, 64) ?? null;
      d.relatedReference ??= tok(parsed.payment.order_id);
    }
  } else if (!mapping && parsed.payment) {
    // Unknown families (invoices, payment links, ...) can still name the payment.
    d = { paymentReference: safeId(parsed.payment.id), attributes: {} };
  }

  if (mapping) {
    if (mapping.stage === "from_step") {
      const p = parsed.primary?.type === "payment" ? parsed.primary.value : undefined;
      stage = lookup(STEP_STAGES, present(p?.error_step)) ?? "payment";
    }
    outcome = mapping.outcome === "from_status" ? (d.info?.outcome ?? "unknown") : mapping.outcome;
  }

  // Entity created_at is not the event time; the envelope's created_at is.
  const { createdAt: _entityCreatedAt, ...rest } = d;
  return clean({
    sourceFormat: ctx.format,
    eventType: safeText(w.event, 128) ?? "unknown",
    eventTypeKnown: Boolean(mapping),
    stage,
    providerStatus: safeText(rest.status, 64),
    eventReference: eventId,
    deliveryKey: eventId,
    paymentReference: rest.paymentReference,
    relatedReference: rest.relatedReference,
    eventTimestamp: toIsoTimestamp(w.created_at),
    amountMinor: rest.amountMinor,
    currency: rest.currency,
    outcome,
    attributes: {
      ...rest.attributes,
      ...attrs([["contains", w.contains]]),
      ...signatureAttrs(ctx.meta),
    },
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function apiErrorEvent(
  parsed: Extract<RazorpayParsed, { kind: "api_error" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const e = parsed.value.error;
  const meta = isObj(e.metadata) ? e.metadata : {};
  const reason = tok(e.reason, 128);
  const paymentReference = tok(meta.payment_id);
  const httpStatus = parsed.value.statusCode ?? ctx.meta?.http?.status;
  return clean({
    sourceFormat: ctx.format,
    eventType: `api_error.${reason ?? safeId(e.code, 64) ?? "unknown"}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: safeId(e.code, 64),
    paymentReference,
    relatedReference: tok(meta.order_id),
    // An error that names a payment reports that attempt's result.
    outcome: paymentReference
      ? reason && PENDING_REASONS.has(reason)
        ? "pending"
        : "failure"
      : "unknown",
    attributes: attrs([
      ["errorCode", safeId(e.code, 64)],
      ["errorSource", tok(e.source)],
      ["errorStep", tok(e.step)],
      ["errorReason", reason],
      ["field", tok(e.field, 64)],
      ["httpStatus", httpStatus],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "error" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: RazorpayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "api_error":
      return [apiErrorEvent(parsed, ctx)];
    case "entity":
      return [snapshotEvent(parsed.entity, ctx, "")];
    case "collection":
      return parsed.items.map((s, i) => snapshotEvent(s, ctx, `items[${i}]`));
    case "webhook":
      return [webhookEvent(parsed, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

type Decoded = Omit<DecodedErrorDraft, "sourceFormat" | "source">;

export type RazorpayErrorInput = {
  code?: string;
  description?: string;
  field?: string;
  source?: string;
  step?: string;
  reason?: string;
  httpStatus?: number;
  /** API error body, which can come from the Payments API or the RazorpayX API. */
  apiError: boolean;
  /** The record names a payment or an order, so the payment table applies. */
  paymentContext: boolean;
};

const NEXT_ACTION: Record<RetryGuidance, string> = {
  do_not_retry:
    "Fix the request or the account setting described above before sending a new request.",
  customer_action_required:
    "Ask the customer to act on the cause (for example re-enter the detail, use another payment method or app, or contact their bank), then let them start a new payment attempt.",
  retry_conditionally:
    "Fetch the payment by its id first. Start a new attempt only once the original one is confirmed as failed.",
  safe_to_retry_technical_request: "Wait and send the same request again with exponential backoff.",
  manual_review:
    "Review the case in the Razorpay Dashboard or with Razorpay support before acting.",
  unknown: "Check the description and Razorpay's error documentation for this error.",
};

const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry:
    "Razorpay rejected the request because of data or settings the merchant controls; sending it again unchanged gives the same result.",
  customer_action_required:
    "The failure depends on the customer, their bank or their app. A new attempt makes sense only after the customer has acted.",
  retry_conditionally:
    "The cause may be temporary, but the original attempt's outcome must be confirmed first: Razorpay can still authorise a failed payment late, polling the bank for up to 3 days.",
  safe_to_retry_technical_request:
    "Razorpay throttled the request before processing it. Razorpay says to retry after some time, with exponential backoff.",
  manual_review: "Razorpay's documentation does not support an automatic retry for this case.",
  unknown: "No retry guidance is available for this error.",
};

function pageDocs(pages: readonly (keyof typeof REASON_PAGES)[]): DocumentationLink[] {
  const seen = new Set<string>();
  const out: DocumentationLink[] = [];
  for (const p of pages) {
    const page = REASON_PAGES[p];
    if (seen.has(page.url)) continue;
    seen.add(page.url);
    out.push({ title: page.title, url: page.url });
  }
  return out;
}

function contextSentences(
  source: string | undefined,
  step: string | undefined,
  missing: string[],
): string {
  let text = "";
  if (source) {
    const s = lookup(SOURCES, source);
    if (s) text += ` Razorpay names ${s} as the point of failure (source "${source}").`;
    else {
      text += ` The source is "${safeId(source, 64) ?? "?"}".`;
      missing.push(
        `Source "${safeId(source, 64) ?? "?"}" is not among Razorpay's documented source values.`,
      );
    }
  }
  if (step) {
    const s = lookup(STEPS, step);
    if (s) text += ` It failed at step "${step}" (documented for ${s}).`;
    else {
      text += ` The step is "${safeId(step, 64) ?? "?"}".`;
      missing.push(
        `Step "${safeId(step, 64) ?? "?"}" is not among Razorpay's documented step values.`,
      );
    }
  }
  return text;
}

/** Shared by API error bodies and the flat error_* fields of a payment. */
export function decodeRazorpayError(input: RazorpayErrorInput): Decoded {
  const reason = present(input.reason);
  const source = present(input.source);
  const step = present(input.step);
  const code = present(input.code);
  const subCodes: Record<string, string> = {};
  if (code) subCodes.error_code = safeId(code, 64) ?? "";
  if (source) subCodes.source = safeId(source, 64) ?? "";
  if (step) subCodes.step = safeId(step, 64) ?? "";
  const field = present(input.field);
  if (field) subCodes.field = safeId(field, 64) ?? "";

  const missing: string[] = [];
  let documentation: DocumentationLink[] = [];
  let meaning: string;
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let retryExplanation: string | undefined;
  let note = "";

  if (reason) {
    const alias = lookup(UNDOCUMENTED_REASON_ALIASES, reason);
    const pay = lookup(PAYMENT_REASONS, alias ?? reason);
    const x = input.apiError ? lookup(X_API_REASONS, reason) : undefined;
    // An HTTP 401 without a payment is the RazorpayX OAuth reading of
    // authentication_failed; otherwise the payment table wins when both match.
    const useX = Boolean(x && (!pay || (!input.paymentContext && input.httpStatus === 401)));
    if (x && useX) {
      subCodes.table = "razorpayx_api";
      meaning = x.meaning;
      category = x.category;
      retry = x.retry;
      confidence = pay ? "possible" : "strong";
      documentation = [
        { title: "RazorpayX API error codes", url: X_API_ERRORS_URL },
        { title: "RazorpayX errors", url: X_ERRORS_URL },
      ];
      if (x.http && x.http >= 500) retryExplanation = X_RETRY_RULE;
      if (pay) note = ` In a payment, the same reason means: ${pay.meaning}`;
      if (!x.http)
        missing.push(
          `Razorpay does not document the HTTP status or error code that RazorpayX returns with "${reason}".`,
        );
    } else if (pay) {
      subCodes.table = "payment";
      meaning = pay.meaning;
      category = pay.category;
      retry = pay.retry;
      confidence = alias || lowersConfidence(reason) ? "possible" : "strong";
      documentation = pageDocs(pay.pages);
      if (alias) {
        note = ` "${reason}" appears in Razorpay's own sample error but in none of its reason tables; it is read like "${alias}".`;
        missing.push(`Reason "${reason}" is not in Razorpay's reason tables.`);
      }
      if (pay.conflict) note += ` Razorpay's pages disagree: ${pay.conflict}`;
      if (x && !input.paymentContext && (x.category !== pay.category || x.retry !== pay.retry)) {
        confidence = "possible";
        note += ` If this response came from the RazorpayX API (payouts, contacts, fund accounts), it means instead: ${x.meaning}`;
      }
    } else {
      subCodes.table = "unknown";
      const byCode = lookup(ERROR_CODES, code);
      meaning = `Razorpay reported the reason "${safeId(reason, 128) ?? "?"}", which is not in its documented reason tables.`;
      category = byCode && code !== "BAD_REQUEST_ERROR" ? byCode.category : "unknown";
      retry = "unknown";
      confidence = "insufficient";
      documentation = [{ title: "Razorpay payment errors", url: PAYMENT_ERRORS_URL }];
      missing.push(
        `Reason "${safeId(reason, 128) ?? "?"}" is not documented. Razorpay lists only its top error reasons, so check the description and the Razorpay Dashboard.`,
      );
    }
  } else {
    const desc = input.description?.trim().replace(/\.$/, "").toLowerCase();
    const common =
      lookup(COMMON_DESCRIPTIONS, desc) ??
      (input.httpStatus === 429 ? lookup(COMMON_DESCRIPTIONS, "too many requests") : undefined) ??
      (input.httpStatus === 401
        ? lookup(COMMON_DESCRIPTIONS, "the api key provided is invalid")
        : undefined);
    const byCode = lookup(ERROR_CODES, code);
    if (common) {
      subCodes.table = "common";
      meaning = common.meaning;
      category = common.category;
      retry = common.retry;
      confidence = "possible";
      documentation = [{ title: "Razorpay common errors", url: COMMON_ERRORS_URL }];
      missing.push(
        "No reason was supplied; the reading comes from the HTTP status or the documented description text.",
      );
    } else if (byCode && code !== "BAD_REQUEST_ERROR") {
      subCodes.table = "error_code";
      meaning = byCode.meaning;
      category = byCode.category;
      retry = byCode.retry;
      confidence = "strong";
      documentation = [{ title: "Razorpay errors", url: byCode.url }];
    } else if (byCode && field) {
      subCodes.table = "error_code";
      meaning = `Razorpay rejected the request because of the parameter "${subCodes.field}".`;
      category = "invalid_request";
      retry = "do_not_retry";
      confidence = "possible";
      documentation = [{ title: "Razorpay common errors", url: COMMON_ERRORS_URL }];
    } else if (byCode) {
      subCodes.table = "error_code";
      meaning = byCode.meaning;
      category = "unknown";
      retry = "unknown";
      confidence = "possible";
      documentation = [{ title: "Razorpay errors", url: ERRORS_URL }];
      missing.push("No reason was supplied, so the specific cause is unknown.");
    } else {
      subCodes.table = "unknown";
      meaning = code
        ? `Razorpay reported the error code "${safeId(code, 64) ?? "?"}", which is not documented.`
        : "Razorpay reported a failure without an error code or reason.";
      category = "unknown";
      retry = "unknown";
      confidence = "insufficient";
      documentation = [{ title: "Razorpay errors", url: ERRORS_URL }];
      missing.push("No documented error code or reason was supplied.");
    }
  }

  const context = contextSentences(source, step, missing);
  if (source || step)
    documentation.push({ title: "Error source and step values", url: ERROR_PARAMETERS_URL });
  if (retry === "retry_conditionally" && subCodes.table !== "razorpayx_api")
    documentation.push({ title: "Late authorisation", url: LATE_AUTHORISATION_URL });

  const message = safeText(input.description);
  return {
    code: safeId(reason ?? code, 128) ?? "unknown",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation: `${meaning}${context}${note}`,
    nextAction:
      source === "business" && retry !== "retry_conditionally"
        ? `The source is the merchant's own integration or configuration. ${NEXT_ACTION[retry]}`
        : NEXT_ACTION[retry],
    retry,
    retryExplanation: retryExplanation ?? RETRY_TEXT[retry],
    confidence,
    documentation,
    missingInformation: missing,
  };
}

function decodePayment(p: PaymentT, ctx: NormalizeContext, path: string): DecodedErrorDraft | null {
  const hasFields = [p.error_code, p.error_reason, p.error_description].some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
  if (!hasFields && p.status !== "failed") return null;
  const decoded = hasFields
    ? decodeRazorpayError({
        code: p.error_code ?? undefined,
        description: p.error_description ?? undefined,
        source: p.error_source ?? undefined,
        step: p.error_step ?? undefined,
        reason: p.error_reason ?? undefined,
        apiError: false,
        paymentContext: true,
      })
    : {
        code: "failed",
        subCodes: { table: "unknown" },
        category: "unknown" as const,
        explanation:
          "Razorpay reported the payment as failed, but the record carries no error code or reason.",
        nextAction: NEXT_ACTION.unknown,
        retry: "unknown" as const,
        retryExplanation: RETRY_TEXT.unknown,
        confidence: "insufficient" as const,
        documentation: [{ title: "Razorpay payment entity", url: PAYMENT_ENTITY_URL }],
        missingInformation: [
          "The failed payment has no error_code or error_reason (some documented card webhook samples look like this). Fetch the payment to read the reason.",
        ],
      };
  if (p.status !== "failed" && p.status !== "created")
    decoded.missingInformation.push(
      `The payment's status is "${safeText(p.status, 32) ?? "?"}", not failed; the error fields may describe an earlier failure.`,
    );
  const ref = safeId(p.id);
  return {
    ...decoded,
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
  };
}

function decodePayout(p: PayoutT, ctx: NormalizeContext, path: string): DecodedErrorDraft | null {
  const details = p.status_details ?? undefined;
  const reason = present(details?.reason ?? undefined);
  const entry = lookup(PAYOUT_REASONS, reason);
  const failedStatus = p.status === "reversed" || p.status === "failed";
  if (!failedStatus && entry?.group !== "failure") return null;
  const source = present(details?.source ?? undefined);
  const missing: string[] = [];
  let category: ErrorCategory = "unknown";
  let retry: RetryGuidance = "unknown";
  let confidence: Confidence = "insufficient";
  let explanation: string;
  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = entry.group === "failure" && failedStatus ? "strong" : "possible";
    explanation = `${entry.meaning} Razorpay documents this payout reason for the ${entry.group === "failure" ? "reversed and failed" : entry.group} status.`;
    if (entry.group !== "failure")
      missing.push(
        `The payout status is "${safeText(p.status, 32) ?? "?"}", but Razorpay documents "${reason}" for the ${entry.group} status.`,
      );
    else if (!failedStatus)
      missing.push(
        `Razorpay documents "${reason}" for reversed and failed payouts, but this payout's status is "${safeText(p.status, 32) ?? "?"}".`,
      );
  } else if (reason) {
    explanation = `The payout status_details reason "${safeId(reason, 96) ?? "?"}" is not in Razorpay's documented payout reasons.`;
    missing.push(`Payout reason "${safeId(reason, 96) ?? "?"}" is not documented.`);
  } else {
    explanation = `Razorpay reported the payout as ${safeText(p.status, 32) ?? "?"} without a status_details reason.`;
    missing.push("No status_details.reason was supplied.");
  }
  if (source) explanation += ` The source is "${safeId(source, 32) ?? "?"}".`;
  const message = safeText(details?.description ?? p.failure_reason ?? undefined);
  const ref = safeId(p.id);
  return {
    code: safeId(reason, 96) ?? safeId(p.status, 32) ?? "unknown",
    subCodes: {
      table: "payout_status",
      status: safeId(p.status, 32) ?? "",
      ...(source ? { source: safeId(source, 32) ?? "" } : {}),
    },
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction:
      retry === "retry_conditionally"
        ? "Confirm that the payout is reversed or failed, then create a new payout once the cause is resolved (Razorpay suggests waiting 30 minutes for bank-side issues)."
        : retry === "do_not_retry"
          ? "Correct the beneficiary or fund account details before creating a new payout."
          : NEXT_ACTION[retry],
    retry,
    retryExplanation:
      retry === "retry_conditionally"
        ? "Razorpay suggests retrying for this reason. Create a new payout only after this one is confirmed reversed or failed, so the beneficiary is not paid twice."
        : RETRY_TEXT[retry],
    confidence,
    // A reversed or failed payout is a final answer from the bank side.
    ...(failedStatus ? { outcomeKnown: true } : {}),
    documentation: [
      { title: "RazorpayX payout status details", url: PAYOUT_STATUS_DETAILS_URL },
      { title: "RazorpayX payout states", url: PAYOUT_STATES_URL },
    ],
    missingInformation: missing,
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
  };
}

function decodeSnapshot(
  s: EntitySnapshot,
  ctx: NormalizeContext,
  path: string,
): DecodedErrorDraft | null {
  if (s.type === "payment") return decodePayment(s.value, ctx, path);
  if (s.type === "payout") return decodePayout(s.value, ctx, path);
  return null;
}

function decodeErrors(parsed: RazorpayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "api_error": {
      const e = parsed.value.error;
      const meta = isObj(e.metadata) ? e.metadata : {};
      const ref = tok(meta.payment_id);
      const httpStatus = parsed.value.statusCode ?? ctx.meta?.http?.status;
      const decoded = decodeRazorpayError({
        code: e.code,
        description: e.description ?? undefined,
        field: e.field ?? undefined,
        source: e.source ?? undefined,
        step: e.step ?? undefined,
        reason: e.reason ?? undefined,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        apiError: true,
        paymentContext: Boolean(ref || tok(meta.order_id)),
      });
      if (httpStatus !== undefined) decoded.subCodes.http_status = String(httpStatus);
      return [
        {
          ...decoded,
          // Too many requests is rejected before processing, so the outcome is known.
          ...(decoded.category === "rate_limiting" ? { outcomeKnown: true } : {}),
          sourceFormat: ctx.format,
          source: { recordIndex: ctx.recordIndex, path: "error" },
          ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
        },
      ];
    }
    case "entity": {
      const d = decodeSnapshot(parsed.entity, ctx, "");
      return d ? [d] : [];
    }
    case "collection":
      return parsed.items
        .map((s, i) => decodeSnapshot(s, ctx, `items[${i}]`))
        .filter((d): d is DecodedErrorDraft => d !== null);
    case "webhook": {
      // Only the entity the event is about: the payment embedded in a refund
      // or dispute event is context, not a new failure.
      const p = parsed.primary;
      if (!p) return [];
      const d = decodeSnapshot(p, ctx, `payload.${p.type}.entity`);
      return d ? [d] : [];
    }
  }
}

export const razorpayAdapter: ProviderAdapter<RazorpayParsed> = {
  id: PROVIDER,
  displayName: "Razorpay",
  version: RAZORPAY_ADAPTER_VERSION,
  manifest: razorpayManifest,
  supportedFormats: [
    {
      id: "razorpay.api_error",
      description:
        "Payments API v1 error response ({ error: { code, description, field, source, step, reason, metadata } }), also wrapped as { statusCode, error } by the Node.js SDK",
    },
    {
      id: "razorpay.payment",
      description:
        "Payment entity with status and the error_code, error_source, error_step and error_reason fields",
    },
    { id: "razorpay.order", description: "Order entity (created, attempted, paid)" },
    { id: "razorpay.refund", description: "Refund entity (pending, processed, failed)" },
    { id: "razorpay.dispute", description: "Dispute entity (phase, status, reason_code)" },
    { id: "razorpay.settlement", description: "Settlement entity (created, processed, failed)" },
    {
      id: "razorpay.payout",
      description: "RazorpayX payout entity with status and status_details",
    },
    {
      id: "razorpay.collection",
      description: "Collection ({ entity: collection, items }) of the entities above",
    },
    {
      id: "razorpay.webhook",
      description:
        "Webhook envelope (entity: event, event, contains, payload, created_at) for payment, order, refund, dispute, settlement and payout events",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // pay_, order_, rfnd_, disp_, setl_ and pout_ ids are explicit links
    // between entities. Merchant references (receipt, reference_id) are not used.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export { WEBHOOK_EVENTS as RAZORPAY_WEBHOOK_EVENTS };
export * from "./catalog.js";
export default razorpayAdapter;
