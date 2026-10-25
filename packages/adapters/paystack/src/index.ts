/**
 * Paystack adapter.
 *
 * Supported input families:
 * - `paystack.api_response`  Response envelope (`status` boolean, `message`, `data`) whose
 *                            data is a transaction (initialize, verify, fetch,
 *                            charge_authorization, Charge API), refund, dispute or transfer
 * - `paystack.api_error`     Error envelope (`status: false`, `message`, `type`, `code`,
 *                            `meta.nextStep`)
 * - `paystack.webhook`       Webhook body (`event`, `data`) for charge, dispute, refund,
 *                            transfer and inbound bank transfer events; other documented
 *                            events are shown without semantics
 *
 * Recognized but not supported: `paystack.list_response` (paginated lists).
 *
 * Paystack declines are free text without codes. Only exact documented
 * messages are decoded; anything else stays unknown with the text shown.
 * Webhook bodies carry no event id or timestamp, so no delivery key is set.
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
  CHARGE_STATES,
  DISPUTE_RESOLUTIONS,
  DISPUTE_STATUSES,
  ERROR_CODES,
  ERROR_TYPES,
  INBOUND_TRANSFER_MESSAGE_TYPES,
  OTHER_WEBHOOK_EVENTS,
  REFUND_STATUSES,
  SAMPLE_ERROR_URL,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES,
  WEBHOOK_EVENTS,
  lookupApiMessage,
  lookupDeclineMessage,
  outcomeTextOf,
  type CatalogEntry,
  type StatusEntry,
  type WebhookEventEntry,
} from "./catalog.js";
import { paystackManifest, PAYSTACK_ADAPTER_VERSION } from "./manifest.js";

export { paystackManifest, PAYSTACK_ADAPTER_VERSION };

const F_RESPONSE = "paystack.api_response";
const F_ERROR = "paystack.api_error";
const F_WEBHOOK = "paystack.webhook";
const F_LIST = "paystack.list_response";

const DOCUMENTED_EVENTS = new Set([...Object.keys(WEBHOOK_EVENTS), ...OTHER_WEBHOOK_EVENTS]);
const DOTTED_EVENT = /^[a-z_]+(?:\.[a-z_-]+)+$/;
const SIGNATURE_HEADER = "x-paystack-signature";

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const prefixed = (v: unknown, prefix: string) => typeof v === "string" && v.startsWith(prefix);

// Schemas. Field types follow the documented examples, which disagree in
// places (section 10 of the research), so several fields accept two types.

const Id = z.union([z.number().int(), z.string().max(128)]);
const Amount = z.union([z.number(), z.string().max(40)]);
const Text = z.string().max(5000).nullable().optional();
const Time = z.string().max(64).nullable().optional();
const Short = z.string().max(128).nullable().optional();

const Transaction = z.looseObject({
  id: Id.optional(),
  status: z.string().max(64),
  reference: z.string().max(256),
  amount: Amount.nullable().optional(),
  requested_amount: Amount.nullable().optional(),
  currency: Short,
  domain: Short,
  channel: Short,
  gateway_response: z.unknown().optional(),
  message: Text,
  paid_at: Time,
  paidAt: Time,
  created_at: Time,
  createdAt: Time,
  transaction_date: Time,
  fees: z.number().nullable().optional(),
  log: z
    .looseObject({
      attempts: z.number().optional(),
      errors: z.number().optional(),
      time_spent: z.number().optional(),
      success: z.boolean().optional(),
      history: z
        .array(
          z.looseObject({
            type: z.string().max(64).optional(),
            message: z.string().max(2000).optional(),
          }),
        )
        .optional(),
    })
    .nullable()
    .optional(),
  authorization: z
    .looseObject({
      channel: Short,
      brand: Short,
      card_type: Short,
      reusable: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const Initialize = z.looseObject({
  authorization_url: z.string().max(2048),
  access_code: z.string().max(256),
  reference: z.string().max(256),
});

const Refund = z.looseObject({
  status: z.string().max(64),
  id: Id.optional(),
  transaction: z
    .union([Id, z.looseObject({ id: Id.optional(), reference: z.string().max(256).optional() })])
    .nullable()
    .optional(),
  transaction_reference: z.string().max(256).nullable().optional(),
  refund_reference: z.string().max(256).nullable().optional(),
  amount: Amount.nullable().optional(),
  deducted_amount: Amount.nullable().optional(),
  fully_deducted: z.union([z.boolean(), z.number()]).nullable().optional(),
  currency: Short,
  domain: Short,
  processor: Short,
  channel: Short,
  expected_at: Time,
  refunded_at: Time,
});

const Dispute = z.looseObject({
  id: Id.optional(),
  status: Short,
  resolution: Short,
  category: Short,
  domain: Short,
  refund_amount: Amount.nullable().optional(),
  dueAt: Time,
  resolvedAt: Time,
  transaction: z.looseObject({
    id: Id.optional(),
    reference: z.string().max(256).optional(),
    status: z.string().max(64).optional(),
  }),
});

const Transfer = z.looseObject({
  status: z.string().max(64),
  transfer_code: z.string().max(128),
  reference: z.string().max(256).nullable().optional(),
  id: Id.optional(),
  amount: Amount.nullable().optional(),
  currency: Short,
  domain: Short,
  source: Short,
  failures: z.unknown().optional(),
  transferred_at: Time,
  updated_at: Time,
  updatedAt: Time,
  session: z.looseObject({ provider: Short }).nullable().optional(),
});

const Inbound = z.looseObject({
  message_type: z.string().max(64).nullable().optional(),
  message: Text,
});

const Envelope = z.looseObject({
  status: z.union([z.boolean(), z.literal("true"), z.literal("false")]),
  message: z.string().max(5000),
  data: z.unknown().optional(),
  type: z.string().max(128).nullable().optional(),
  code: z.string().max(128).nullable().optional(),
  meta: z.unknown().optional(),
  metadata: z.unknown().optional(),
});

const Webhook = z.looseObject({
  event: z.string().max(128),
  data: z.union([z.looseObject({}), z.array(z.unknown())]),
});

type Txn = z.infer<typeof Transaction>;
type Init = z.infer<typeof Initialize>;
type RefundObj = z.infer<typeof Refund>;
type DisputeObj = z.infer<typeof Dispute>;
type TransferObj = z.infer<typeof Transfer>;
type InboundObj = z.infer<typeof Inbound>;
type Env = z.infer<typeof Envelope>;

type DataKind = "transaction" | "initialize" | "refund" | "dispute" | "transfer";

type DataValue =
  | { kind: "transaction"; value: Txn }
  | { kind: "initialize"; value: Init }
  | { kind: "refund"; value: RefundObj }
  | { kind: "dispute"; value: DisputeObj }
  | { kind: "transfer"; value: TransferObj }
  | { kind: "inbound_transfer"; value: InboundObj };

export type PaystackParsed =
  | { kind: "response"; envelope: Env; data: DataValue }
  | { kind: "error"; envelope: Env }
  | {
      kind: "webhook";
      event: string;
      entry: WebhookEventEntry | undefined;
      data: DataValue | null;
      domain: string | undefined;
    };

const SCHEMAS = {
  transaction: Transaction,
  initialize: Initialize,
  refund: Refund,
  dispute: Dispute,
  transfer: Transfer,
  inbound_transfer: Inbound,
} as const;

/** Which documented object a `data` value is, from its field names. */
function classify(d: Record<string, unknown>): DataKind | null {
  if (has(d, "transaction_reference") && has(d, "refund_reference")) return "refund";
  if (
    has(d, "transaction") &&
    (has(d, "deducted_amount") ||
      has(d, "fully_deducted") ||
      has(d, "expected_at") ||
      has(d, "refunded_at"))
  )
    return "refund";
  if (
    isObj(d.transaction) &&
    (has(d, "refund_amount") || has(d, "dueAt") || has(d, "resolvedAt") || has(d, "resolution"))
  )
    return "dispute";
  if (
    typeof d.transfer_code === "string" &&
    (has(d, "titan_code") || has(d, "transferred_at") || has(d, "recipient") || has(d, "source"))
  )
    return "transfer";
  if ((typeof d.status === "string" && has(d, "reference")) || has(d, "gateway_response"))
    return "transaction";
  if (
    typeof d.authorization_url === "string" &&
    typeof d.access_code === "string" &&
    typeof d.reference === "string"
  )
    return "initialize";
  return null;
}

/** Paystack-specific evidence inside a resource object. */
function markers(d: Record<string, unknown>, nested = true): string[] {
  const out: string[] = [];
  if (has(d, "gateway_response")) out.push("has gateway_response");
  if (d.domain === "test" || d.domain === "live") out.push("domain is test or live");
  if (isObj(d.log) && Array.isArray(d.log.history)) out.push("has log.history");
  if (has(d, "paid_at") && has(d, "paidAt")) out.push("has both paid_at and paidAt");
  if (isObj(d.authorization) && prefixed(d.authorization.authorization_code, "AUTH_"))
    out.push("authorization code has the AUTH_ prefix");
  if (isObj(d.customer) && prefixed(d.customer.customer_code, "CUS_"))
    out.push("customer code has the CUS_ prefix");
  if (prefixed(d.transfer_code, "TRF_") && has(d, "titan_code"))
    out.push("transfer_code has the TRF_ prefix and titan_code is present");
  if (isObj(d.recipient) && prefixed(d.recipient.recipient_code, "RCP_"))
    out.push("recipient code has the RCP_ prefix");
  if (has(d, "transaction_reference") && has(d, "refund_reference"))
    out.push("has transaction_reference and refund_reference");
  if (nested && isObj(d.transaction) && markers(d.transaction, false).length > 0)
    out.push("embedded transaction has Paystack fields");
  return out;
}

const NONE: DetectionResult = {
  provider: "paystack",
  format: null,
  confidence: 0,
  supported: false,
  reasons: [],
};

function result(format: string, confidence: number, reasons: string[]): DetectionResult {
  return {
    provider: "paystack",
    format,
    confidence: Math.round(Math.min(confidence, 0.98) * 100) / 100,
    supported: format !== F_LIST,
    reasons,
    ...(format === F_LIST
      ? {
          unsupportedReason:
            "Paystack list responses are recognized but not analyzed. Paste a single transaction, refund, dispute or transfer response, or a webhook body, instead.",
        }
      : {}),
  };
}

const markerScore = (n: number) => (n >= 3 ? 0.95 : n === 2 ? 0.9 : n === 1 ? 0.8 : 0.5);

function signaturePresent(meta?: RecordMeta): boolean {
  return Boolean(meta?.http?.headers && has(meta.http.headers, SIGNATURE_HEADER));
}

function detectWebhook(input: Record<string, unknown>, meta?: RecordMeta): DetectionResult {
  if (Object.keys(input).some((k) => k !== "event" && k !== "data")) return NONE;
  const event = input.event;
  const data = input.data;
  if (typeof event !== "string" || !(isObj(data) || Array.isArray(data))) return NONE;
  const found = isObj(data) ? markers(data) : [];
  const sig = signaturePresent(meta);
  const reasons = ["body has only event and data"];
  let confidence: number;
  if (DOCUMENTED_EVENTS.has(event)) {
    reasons.push(`event "${event}" is a documented Paystack webhook event`);
    confidence = 0.5 + 0.15 * Math.min(found.length, 3);
  } else if (DOTTED_EVENT.test(event) && found.length >= 2) {
    reasons.push("event is a dotted lower-case name");
    confidence = 0.55;
  } else if (DOTTED_EVENT.test(event) && sig) {
    reasons.push("event is a dotted lower-case name");
    confidence = 0.35;
  } else return NONE;
  if (sig) {
    reasons.push("has an x-paystack-signature header");
    confidence += 0.1;
  }
  return result(F_WEBHOOK, confidence, [...reasons, ...found]);
}

function nextStepOf(input: Record<string, unknown>): string | undefined {
  if (isObj(input.meta) && typeof input.meta.nextStep === "string") return input.meta.nextStep;
  // The direct debit mandate example uses metadata.nextStep instead.
  if (isObj(input.metadata) && typeof input.metadata.nextStep === "string")
    return input.metadata.nextStep;
  return undefined;
}

function errorTypeOf(input: Record<string, unknown>): string | undefined {
  // OpenAPI puts the enum on `code`, every example on `type`; accept both.
  for (const v of [input.type, input.code])
    if (typeof v === "string" && lookup(ERROR_TYPES, v)) return v;
  return undefined;
}

function detectEnvelope(input: Record<string, unknown>): DetectionResult {
  const status = input.status;
  if (typeof input.message !== "string") return NONE;
  const boolStatus = typeof status === "boolean";
  if (!boolStatus && status !== "true" && status !== "false") return NONE;
  const errType = errorTypeOf(input);
  const nextStep = nextStepOf(input) !== undefined;
  // The string form appears only in the documented error template.
  if (!boolStatus && !errType && !nextStep) return NONE;
  const reasons = [boolStatus ? "status is a boolean" : 'status is the string "true" or "false"'];
  reasons.push("has a message string");
  const data = input.data;

  if (Array.isArray(data)) {
    const meta = input.meta;
    if (
      !boolStatus ||
      !isObj(meta) ||
      !has(meta, "perPage") ||
      !(has(meta, "pageCount") || has(meta, "next") || has(meta, "previous"))
    )
      return NONE;
    const itemMarkers = data.some((x) => isObj(x) && markers(x).length > 0);
    return result(F_LIST, itemMarkers ? 0.75 : 0.5, [
      ...reasons,
      "data is an array with meta.perPage pagination",
      ...(itemMarkers ? ["list items have Paystack fields"] : []),
    ]);
  }

  if (isObj(data) && Object.keys(data).length > 0) {
    const kind = classify(data);
    const found = markers(data);
    let confidence = 0;
    if (kind === "transaction") {
      const st = String(data.status);
      if (lookup(CHARGE_STATES, st)) {
        reasons.push(`data.status "${st}" is a Paystack Charge API state`);
        confidence = found.length ? 0.95 : 0.85;
      } else if (lookup(TRANSACTION_STATUSES, st) || found.length) {
        reasons.push("data is a transaction object (status, reference)");
        confidence = markerScore(found.length);
      }
    } else if (kind === "initialize") {
      reasons.push("data has authorization_url, access_code and reference");
      confidence = 0.8;
    } else if (kind === "refund") {
      reasons.push("data is a refund object");
      confidence = found.length ? 0.85 : 0.75;
    } else if (kind === "dispute") {
      reasons.push("data is a dispute object with an embedded transaction");
      confidence = found.length ? 0.85 : 0.5;
    } else if (kind === "transfer") {
      reasons.push("data is a transfer object (transfer_code)");
      confidence = found.length ? 0.9 : prefixed(data.transfer_code, "TRF_") ? 0.6 : 0.5;
    }
    if (confidence > 0) return result(F_RESPONSE, confidence, [...reasons, ...found]);
  }

  if (status !== false && status !== "false") return NONE;
  if (data !== undefined && data !== null && !(isObj(data) && Object.keys(data).length === 0))
    return NONE;
  let confidence = 0;
  if (errType) {
    reasons.push(`error type "${errType}" is a documented Paystack error type`);
    confidence = 0.85;
  }
  if (nextStep) {
    reasons.push("has meta.nextStep");
    confidence = confidence ? 0.95 : 0.85;
  }
  const code = typeof input.code === "string" ? lookup(ERROR_CODES, input.code) : undefined;
  if (confidence && code) {
    reasons.push("code is a documented Paystack error code");
    confidence += 0.03;
  }
  if (!confidence && lookupApiMessage(input.message)) {
    // A bare { status: false, message } is generic; only a documented
    // message makes it Paystack's, and never above 0.5.
    reasons.push("message is a documented Paystack API error message");
    confidence = 0.5;
  }
  return confidence ? result(F_ERROR, confidence, reasons) : NONE;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  // Paystack sends and documents JSON only.
  if (meta?.format === "form" || !isObj(input)) return NONE;
  if (has(input, "event")) return detectWebhook(input, meta);
  if (has(input, "status") && has(input, "message")) return detectEnvelope(input);
  return NONE;
}

type ParseResult = { ok: true; value: PaystackParsed } | { ok: false; issues: string[] };

const issuesOf = (error: z.ZodError, prefix: string) =>
  error.issues.map((i) => {
    const path = [prefix, ...i.path.map(String)].filter(Boolean).join(".");
    return `${path || "(root)"}: ${i.message}`;
  });

function parseData(
  kind: DataKind | "inbound_transfer",
  value: unknown,
): { ok: true; value: DataValue } | { ok: false; issues: string[] } {
  const r = SCHEMAS[kind].safeParse(value);
  if (!r.success) return { ok: false, issues: issuesOf(r.error, "data") };
  return { ok: true, value: { kind, value: r.data } as DataValue };
}

function parse(input: unknown, format: string): ParseResult {
  if (format === F_WEBHOOK) {
    const r = Webhook.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error, "") };
    const { event, data } = r.data;
    const entry = lookup(WEBHOOK_EVENTS, event);
    const domain = isObj(data) && typeof data.domain === "string" ? data.domain : undefined;
    if (!entry) return { ok: true, value: { kind: "webhook", event, entry, data: null, domain } };
    if (!isObj(data))
      return { ok: false, issues: [`data: expected an object for the ${event} event`] };
    const d = parseData(entry.kind, data);
    if (!d.ok) return d;
    return { ok: true, value: { kind: "webhook", event, entry, data: d.value, domain } };
  }
  if (format === F_RESPONSE || format === F_ERROR) {
    const r = Envelope.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error, "") };
    if (format === F_ERROR) return { ok: true, value: { kind: "error", envelope: r.data } };
    const data = r.data.data;
    if (!isObj(data)) return { ok: false, issues: ["data: expected an object"] };
    const kind = classify(data);
    if (!kind) return { ok: false, issues: ["data: not a recognized Paystack object"] };
    const d = parseData(kind, data);
    if (!d.ok) return d;
    return { ok: true, value: { kind: "response", envelope: r.data, data: d.value } };
  }
  return { ok: false, issues: [`Unsupported Paystack format "${format}".`] };
}

// Normalization

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const t = safeText(v, 200);
      if (t) out[k] = t;
    } else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Identifiers may be integers (transaction id) or strings. */
function idString(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  return safeId(v);
}

const statusToken = (s: string | null | undefined) =>
  typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : "unknown";

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Base = Pick<NormalizedEventDraft, "sourceFormat" | "source"> & {
  observedTimestamp?: string;
};

function transactionStatus(status: string): StatusEntry | undefined {
  return lookup(TRANSACTION_STATUSES, status) ?? lookup(CHARGE_STATES, status);
}

function describeTransaction(t: Txn) {
  const history = t.log?.history ?? [];
  const last = history.at(-1);
  const gateway = typeof t.gateway_response === "string" ? t.gateway_response : undefined;
  const entry = transactionStatus(t.status);
  return {
    paymentReference: safeId(t.reference, 256),
    transactionId: idString(t.id),
    amountMinor: minorUnits(t.amount),
    currency: upperCurrency(t.currency),
    entry,
    attributes: attrs([
      ["objectType", "transaction"],
      ["statusMeaning", entry?.meaning],
      ["domain", t.domain],
      ["channel", t.channel],
      ["gatewayResponse", gateway],
      ["transactionMessage", t.message],
      ["createdAt", toIsoTimestamp(t.created_at ?? t.createdAt ?? t.transaction_date)],
      ["paidAt", toIsoTimestamp(t.paid_at ?? t.paidAt)],
      ["requestedAmount", minorUnits(t.requested_amount)],
      ["fees", minorUnits(t.fees)],
      ["logAttempts", t.log?.attempts],
      ["logErrors", t.log?.errors],
      ["logTimeSpentSeconds", t.log?.time_spent],
      ["logSuccess", t.log?.success],
      ["logLastStep", last?.message ? safeText(last.message, 120) : undefined],
      ["authorizationChannel", t.authorization?.channel],
      ["cardBrand", t.authorization?.brand],
      ["cardType", t.authorization?.card_type?.trim()],
      ["authorizationReusable", t.authorization?.reusable],
    ]),
  };
}

function transactionEvent(
  t: Txn,
  base: Base,
  eventType: string,
  known: boolean,
  mapping: { stage: NormalizedEventDraft["stage"]; outcome: Outcome } | undefined,
  extra: Attrs,
): NormalizedEventDraft {
  const d = describeTransaction(t);
  const m = mapping ?? d.entry;
  // paid_at is the time of the successful payment; other statuses carry no
  // time of their own (created_at is when the transaction was created).
  const paid = m?.outcome === "success" && t.status === "success";
  return clean({
    ...base,
    eventType,
    eventTypeKnown: known && Boolean(m),
    stage: m?.stage ?? "other",
    providerStatus: safeText(t.status, 64),
    paymentReference: d.paymentReference,
    relatedReference: d.transactionId,
    eventTimestamp: paid ? toIsoTimestamp(t.paid_at ?? t.paidAt) : undefined,
    amountMinor: d.amountMinor,
    currency: d.currency,
    outcome: m?.outcome ?? "unknown",
    attributes: { ...d.attributes, ...attrs([["transactionId", d.transactionId]]), ...extra },
  });
}

function refundEvent(
  r: RefundObj,
  base: Base,
  eventType: string,
  mapping: WebhookEventEntry | undefined,
  extra: Attrs,
): NormalizedEventDraft {
  const entry = lookup(REFUND_STATUSES, r.status);
  const m = mapping ?? entry;
  const txn = r.transaction;
  const txnRef = isObj(txn) ? safeId(txn.reference, 256) : undefined;
  const txnId = isObj(txn) ? idString(txn.id) : idString(txn);
  const outcome = (m?.outcome === "from_status" ? entry?.outcome : m?.outcome) ?? "unknown";
  return clean({
    ...base,
    eventType,
    eventTypeKnown: Boolean(m),
    stage: "refund",
    providerStatus: safeText(r.status, 64),
    paymentReference: safeId(r.transaction_reference ?? undefined, 256) ?? txnRef,
    relatedReference: idString(r.id),
    eventTimestamp: r.status === "processed" ? toIsoTimestamp(r.refunded_at) : undefined,
    amountMinor: minorUnits(r.amount),
    currency: upperCurrency(r.currency),
    outcome,
    attributes: {
      ...attrs([
        ["objectType", "refund"],
        ["statusMeaning", entry?.meaning],
        ["refundId", idString(r.id)],
        ["transactionId", txnId],
        ["refundReference", safeId(r.refund_reference ?? undefined, 256)],
        ["processor", r.processor],
        ["channel", r.channel],
        ["domain", r.domain],
        ["deductedAmount", minorUnits(r.deducted_amount)],
        ["fullyDeducted", r.fully_deducted],
        ["expectedAt", toIsoTimestamp(r.expected_at)],
        ["refundedAt", toIsoTimestamp(r.refunded_at)],
      ]),
      ...extra,
    },
  });
}

function disputeEvent(
  d: DisputeObj,
  base: Base,
  eventType: string,
  mapping: WebhookEventEntry | undefined,
  extra: Attrs,
): NormalizedEventDraft {
  const statusKnown = !d.status || DISPUTE_STATUSES.includes(d.status);
  const resolution = typeof d.resolution === "string" ? d.resolution : undefined;
  return clean({
    ...base,
    eventType,
    eventTypeKnown: mapping ? true : statusKnown,
    stage: "dispute",
    providerStatus: safeText(d.status ?? undefined, 64),
    paymentReference: safeId(d.transaction.reference, 256),
    relatedReference: idString(d.id),
    eventTimestamp:
      eventType === "charge.dispute.resolve" ? toIsoTimestamp(d.resolvedAt) : undefined,
    // Dispute outcomes are decided by issuers and card schemes.
    outcome: "unknown",
    attributes: {
      ...attrs([
        ["objectType", "dispute"],
        ["disputeId", idString(d.id)],
        ["transactionId", idString(d.transaction.id)],
        ["transactionStatus", d.transaction.status],
        ["resolution", resolution],
        ["resolutionKnown", resolution ? DISPUTE_RESOLUTIONS.includes(resolution) : undefined],
        ["category", d.category],
        ["domain", d.domain],
        ["refundAmount", minorUnits(d.refund_amount)],
        ["dueAt", toIsoTimestamp(d.dueAt)],
        ["resolvedAt", toIsoTimestamp(d.resolvedAt)],
      ]),
      ...extra,
    },
  });
}

function transferEvent(
  t: TransferObj,
  base: Base,
  eventType: string,
  mapping: WebhookEventEntry | undefined,
  extra: Attrs,
): NormalizedEventDraft {
  const entry = lookup(TRANSFER_STATUSES, t.status);
  // A documented initiate response says "Transfer has been queued" with
  // status success and no transfer time, so a response alone does not prove
  // the money moved.
  const queuedOnly = !mapping && t.status === "success" && !t.transferred_at;
  const mapped = mapping && mapping.outcome !== "from_status" ? mapping.outcome : entry?.outcome;
  const outcome: Outcome = queuedOnly ? "unknown" : (mapped ?? "unknown");
  const updated = toIsoTimestamp(t.updated_at ?? t.updatedAt);
  const transferred = toIsoTimestamp(t.transferred_at);
  return clean({
    ...base,
    eventType,
    eventTypeKnown: mapping ? true : Boolean(entry?.known),
    stage: mapping?.stage ?? entry?.stage ?? "payout",
    providerStatus: safeText(t.status, 64),
    paymentReference: safeId(t.reference ?? undefined, 256),
    relatedReference: safeId(t.transfer_code),
    eventTimestamp:
      t.status === "success"
        ? (transferred ?? (mapping ? updated : undefined))
        : mapping
          ? updated
          : undefined,
    amountMinor: minorUnits(t.amount),
    currency: upperCurrency(t.currency),
    outcome,
    attributes: {
      ...attrs([
        ["objectType", "transfer"],
        ["statusMeaning", entry?.meaning],
        ["transferId", idString(t.id)],
        ["source", t.source],
        ["domain", t.domain],
        ["sessionProvider", t.session?.provider],
        ["failuresPresent", t.failures === undefined ? undefined : t.failures !== null],
        ["transferredAt", transferred],
        ["queuedWithoutTransferTime", queuedOnly ? true : undefined],
      ]),
      ...extra,
    },
  });
}

function httpAttrs(meta: RecordMeta | undefined): Attrs {
  return attrs([
    ["httpStatus", meta?.http?.status],
    ["signatureHeaderPresent", signaturePresent(meta) ? true : undefined],
  ]);
}

const requestStatus = (s: Env["status"]) => s === true || s === "true";

function normalize(parsed: PaystackParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const http = httpAttrs(ctx.meta);

  if (parsed.kind === "error") {
    const env = parsed.envelope;
    const errType = errorTypeOf(env);
    const code = codeOf(env);
    return [
      clean({
        sourceFormat: ctx.format,
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observed,
        eventType: `api_error.${statusToken(code ?? errType ?? "request_failed")}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: ctx.meta?.http?.status
          ? `HTTP ${ctx.meta.http.status}`
          : (errType ?? undefined),
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["objectType", "error"],
            ["requestStatus", requestStatus(env.status)],
            ["errorType", errType],
            ["code", code],
            ["nextStepPresent", nextStepOf(env) !== undefined ? true : undefined],
          ]),
          ...http,
        },
      }),
    ];
  }

  if (parsed.kind === "response") {
    const env = parsed.envelope;
    const base: Base = {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: "data" },
      ...observed,
    };
    const extra = {
      ...attrs([
        ["requestStatus", requestStatus(env.status)],
        ["responseMessage", env.message],
      ]),
      ...http,
    };
    const d = parsed.data;
    switch (d.kind) {
      case "transaction": {
        const st = d.value.status;
        const charge = lookup(CHARGE_STATES, st);
        const type = `${charge ? "charge_response" : "transaction_response"}.${statusToken(st)}`;
        return [transactionEvent(d.value, base, type, true, undefined, extra)];
      }
      case "initialize":
        return [
          clean({
            ...base,
            eventType: "transaction.initialize",
            eventTypeKnown: true,
            stage: "payment",
            paymentReference: safeId(d.value.reference, 256),
            outcome: "pending",
            attributes: {
              ...attrs([
                ["objectType", "transaction"],
                ["checkoutCreated", true],
              ]),
              ...extra,
            },
          }),
        ];
      case "refund":
        return [
          refundEvent(
            d.value,
            base,
            `refund_response.${statusToken(d.value.status)}`,
            undefined,
            extra,
          ),
        ];
      case "dispute":
        return [
          disputeEvent(
            d.value,
            base,
            `dispute_response.${statusToken(d.value.status)}`,
            undefined,
            extra,
          ),
        ];
      case "transfer":
        return [
          transferEvent(
            d.value,
            base,
            `transfer_response.${statusToken(d.value.status)}`,
            undefined,
            extra,
          ),
        ];
      default:
        return [];
    }
  }

  const base: Base = {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "data" },
    ...observed,
  };
  const event = safeText(parsed.event, 128) ?? "unknown";
  const extra = http;
  const m = parsed.entry;
  const d = parsed.data;
  if (!m || !d) {
    return [
      clean({
        ...base,
        eventType: event,
        eventTypeKnown: false,
        stage: "other",
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["objectType", "other"],
            ["documentedEvent", DOCUMENTED_EVENTS.has(parsed.event)],
            ["domain", parsed.domain],
          ]),
          ...extra,
        },
      }),
    ];
  }
  switch (d.kind) {
    case "transaction":
      return [
        transactionEvent(
          d.value,
          base,
          event,
          true,
          { stage: m.stage, outcome: m.outcome as Outcome },
          extra,
        ),
      ];
    case "refund":
      return [refundEvent(d.value, base, event, m, extra)];
    case "dispute":
      return [disputeEvent(d.value, base, event, m, extra)];
    case "transfer":
      return [transferEvent(d.value, base, event, m, extra)];
    case "inbound_transfer": {
      const mt = d.value.message_type;
      return [
        clean({
          ...base,
          eventType: event,
          eventTypeKnown: true,
          stage: m.stage,
          outcome: m.outcome as Outcome,
          attributes: {
            ...attrs([
              ["objectType", "inbound_transfer"],
              ["messageType", typeof mt === "string" && /^[A-Z_]{1,64}$/.test(mt) ? mt : undefined],
            ]),
            ...extra,
          },
        }),
      ];
    }
    default:
      return [];
  }
}

// Error decoding

function codeOf(env: Env): string | undefined {
  const errType = errorTypeOf(env);
  for (const v of [env.code, env.type]) {
    if (typeof v === "string" && v !== errType && /^[A-Za-z0-9_.-]{1,64}$/.test(v)) return v;
  }
  return undefined;
}

const UNCERTAIN = new Set(["provider_unavailable", "network_or_timeout", "unknown"]);

function decodeApiError(env: Env, ctx: NormalizeContext): DecodedErrorDraft {
  const errType = errorTypeOf(env);
  const code = codeOf(env);
  const msgEntry = lookupApiMessage(env.message);
  const codeEntry = lookup(ERROR_CODES, code);
  const typeEntry = lookup(ERROR_TYPES, errType);
  const entry: CatalogEntry | undefined = msgEntry ?? codeEntry ?? typeEntry;
  let confidence: Confidence;
  if (msgEntry || codeEntry) confidence = (msgEntry ?? codeEntry)!.confidence;
  else if (typeEntry)
    confidence = typeEntry.confidence === "strong" ? "possible" : typeEntry.confidence;
  else confidence = "insufficient";

  const subCodes: Record<string, string> = {};
  if (errType) subCodes.type = errType;
  if (code) subCodes.code = code;
  const httpStatus = ctx.meta?.http?.status;
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);

  const missing: string[] = [];
  if (code && !codeEntry)
    missing.push(
      `Error code "${code}" is not in the PandaPayLens catalog of documented Paystack codes.`,
    );
  if (!msgEntry && !codeEntry)
    missing.push("The message is not one of the documented Paystack API error messages.");
  if (errType === "processor_error")
    missing.push("Paystack does not document what processor_error means.");

  const nextStep = safeText(nextStepOf(env), 300);
  const baseAction =
    entry?.nextAction ?? "Check the request and the Paystack Dashboard for details.";
  const docs = [
    ...(entry ? [{ title: entry.docsTitle, url: entry.docsUrl }] : []),
    { title: "Paystack API error format", url: SAMPLE_ERROR_URL },
  ];
  const message = safeText(env.message);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code:
      code ??
      errType ??
      (msgEntry ? (msgEntry.prefix ?? msgEntry.message).replace(/:$/, "") : "request_failed"),
    subCodes,
    category: entry?.category ?? "unknown",
    ...(message ? { providerMessage: message } : {}),
    explanation: entry?.explanation ?? "PandaPayLens does not recognize this Paystack error.",
    nextAction: nextStep ? `${baseAction} Paystack's suggested next step: ${nextStep}` : baseAction,
    retry: entry?.retry ?? "unknown",
    retryExplanation: entry?.retryExplanation ?? "No retry guidance is available for this error.",
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

const NO_CODE =
  "Paystack declines carry no numeric decline or issuer response code; only the message text is available.";

function decodeTransactionFailure(
  t: Txn,
  ctx: NormalizeContext,
  failed: boolean,
): DecodedErrorDraft | null {
  const candidates: ["gateway_response" | "message", string][] = [];
  if (typeof t.gateway_response === "string" && t.gateway_response.trim())
    candidates.push(["gateway_response", t.gateway_response]);
  if (typeof t.message === "string" && t.message.trim()) candidates.push(["message", t.message]);

  let field: "gateway_response" | "message" | undefined;
  let text: string | undefined;
  let match: ReturnType<typeof lookupDeclineMessage>;
  for (const [f, s] of candidates) {
    const found = lookupDeclineMessage(s);
    if (found) {
      field = f;
      text = s;
      match = found;
      break;
    }
  }
  if (!match) {
    // A transaction that never completed is only explained by a documented message.
    if (!failed) return null;
    const first = candidates.find(([, s]) => !outcomeTextOf(s));
    if (first) [field, text] = first;
  }

  const ref = safeId(t.reference, 256);
  const attempt = idString(t.id) ?? ref;
  const subCodes: Record<string, string> = { transaction_status: statusToken(t.status) };
  if (field) subCodes.text_field = field;
  const missing = [NO_CODE];
  const providerMessage = safeText(text);
  const entry = match?.entry;
  if (match?.table === "help_center")
    missing.push(
      `Paystack's Help Center does not say which API field carries this message; it was found in ${field}.`,
    );
  if (!match && text)
    missing.push(
      "This text is not one of the documented Paystack messages, so its cause is unknown.",
    );
  if (!text) missing.push("The record has no gateway_response or message text.");
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: field ? `data.${field}` : "data" },
    code: match ? match.text : statusToken(t.status),
    subCodes,
    category: entry?.category ?? "unknown",
    ...(providerMessage ? { providerMessage } : {}),
    explanation:
      entry?.explanation ??
      (text
        ? "Paystack reported a failed transaction with a message PandaPayLens does not recognize."
        : "Paystack reported a failed transaction without a reason."),
    nextAction:
      entry?.nextAction ??
      "Verify the transaction (GET /transaction/verify/{reference}) and check it in the Paystack Dashboard.",
    retry: entry?.retry ?? "unknown",
    retryExplanation:
      entry?.retryExplanation ??
      "The cause is unknown; verify the transaction before any new attempt.",
    confidence: entry?.confidence ?? "insufficient",
    documentation: entry ? [{ title: entry.docsTitle, url: entry.docsUrl }] : [],
    missingInformation: missing,
    ...(ref ? { paymentReference: ref } : {}),
    ...(attempt ? { attemptReference: attempt } : {}),
    ...(entry && !UNCERTAIN.has(entry.category) ? { outcomeKnown: true } : {}),
  };
}

function decodeInbound(v: InboundObj, ctx: NormalizeContext): DecodedErrorDraft {
  const mt = typeof v.message_type === "string" ? v.message_type : undefined;
  const entry = lookup(INBOUND_TRANSFER_MESSAGE_TYPES, mt);
  const message = safeText(v.message ?? undefined);
  const subCodes: Record<string, string> = {};
  if (mt && /^[A-Za-z0-9_]{1,64}$/.test(mt)) subCodes.message_type = mt;
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "data.message_type" },
    code: subCodes.message_type ?? "rejected",
    subCodes,
    category: entry?.category ?? "unknown",
    ...(message ? { providerMessage: message } : {}),
    explanation:
      entry?.explanation ??
      "Paystack rejected an inbound bank transfer for a reason PandaPayLens does not recognize.",
    nextAction: entry?.nextAction ?? "Check the transfer in the Paystack Dashboard.",
    retry: entry?.retry ?? "unknown",
    retryExplanation: entry?.retryExplanation ?? "No retry guidance is available.",
    confidence: entry?.confidence ?? "insufficient",
    documentation: entry ? [{ title: entry.docsTitle, url: entry.docsUrl }] : [],
    missingInformation: entry
      ? ["The other fields of bank.transfer.rejected are not documented, so no reference is read."]
      : [`message_type "${subCodes.message_type ?? ""}" is not documented by Paystack.`],
  };
}

function decodeErrors(parsed: PaystackParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "error") return [decodeApiError(parsed.envelope, ctx)];
  const d = parsed.data;
  if (!d) return [];
  if (d.kind === "transaction") {
    const failed =
      parsed.kind === "webhook" ? parsed.entry?.outcome === "failure" : d.value.status === "failed";
    if (!failed && d.value.status !== "abandoned") return [];
    const e = decodeTransactionFailure(d.value, ctx, failed);
    return e ? [e] : [];
  }
  if (d.kind === "inbound_transfer") return [decodeInbound(d.value, ctx)];
  return [];
}

export const paystackAdapter: ProviderAdapter<PaystackParsed> = {
  id: "paystack",
  displayName: "Paystack",
  version: PAYSTACK_ADAPTER_VERSION,
  manifest: paystackManifest,
  supportedFormats: [
    {
      id: F_RESPONSE,
      description:
        "Response envelope (status, message, data) with a transaction (initialize, verify, fetch, charge_authorization, Charge API states), refund, dispute or transfer",
    },
    {
      id: F_ERROR,
      description: "Error response (status false, message, type, code, meta.nextStep)",
    },
    {
      id: F_WEBHOOK,
      description:
        "Webhook body (event, data) for charge, dispute, refund, transfer and bank.transfer.rejected events",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Keys are namespaced so that a transfer reference can never join a
    // transaction with the same reference string.
    const keys: string[] = [];
    const a = event.attributes;
    if (a.objectType === "transfer") {
      if (event.paymentReference) keys.push(`transfer:${event.paymentReference}`);
      if (event.relatedReference) keys.push(`transfer_code:${event.relatedReference}`);
      if (typeof a.transferId === "string") keys.push(`transfer_id:${a.transferId}`);
      return keys;
    }
    // The transaction reference is unique per integration (a reused one is
    // rejected with duplicate_reference), and the transaction id links fetch,
    // refunds and disputes.
    if (event.paymentReference) keys.push(`transaction:${event.paymentReference}`);
    if (typeof a.transactionId === "string") keys.push(`transaction_id:${a.transactionId}`);
    return keys;
  },
};

export * from "./catalog.js";
export default paystackAdapter;
