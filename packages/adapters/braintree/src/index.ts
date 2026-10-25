/**
 * Braintree adapter.
 *
 * Supported input families:
 * - `braintree.graphql.response`      GraphQL response body (`data`, `errors[].extensions`, `extensions.requestId`)
 * - `braintree.transaction`           Transaction snapshot (SDK snake_case or camelCase, SDK result
 *                                     object with a transaction, or a GraphQL Transaction/Refund object)
 * - `braintree.sdk.validation_errors` SDK result object with validation errors (`attribute`, `code`, `message`)
 * - `braintree.webhook.notification`  Notification already parsed by an SDK (`kind`, `timestamp`, subject)
 *
 * Recognized but not supported: `braintree.webhook.signed`, the raw form-encoded
 * delivery (`bt_signature`, `bt_payload`). It can only be verified with the
 * merchant's private key, so it is never decoded.
 *
 * GraphQL always answers with HTTP 200. Processor declines and gateway
 * rejections are not GraphQL errors: they arrive in `data` as a transaction with
 * status PROCESSOR_DECLINED or GATEWAY_REJECTED.
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
  APPROVAL_RESPONSES,
  AUTHORIZATION_RESPONSES_URL,
  GATEWAY_REJECTIONS_URL,
  GATEWAY_REJECTION_REASONS,
  GENERIC_VALIDATION_ERROR,
  GRAPHQL_API_CALLS_URL,
  GRAPHQL_ERROR_CLASSES,
  PAYMENT_STATUS_ENUM,
  PROCESSOR_DECLINED_RANGE,
  PROCESSOR_RESPONSES,
  RESULT_OBJECTS_URL,
  SETTLEMENT_RESPONSES,
  SETTLEMENT_RESPONSES_URL,
  STATUSES_URL,
  TRANSACTION_STATUSES,
  VALIDATION_ERRORS,
  VALIDATION_ERRORS_URL,
  WEBHOOK_KINDS,
  DISPUTE_STATUSES,
  type CatalogEntry,
  type ProcessorResponse,
  type StatusInfo,
  type WebhookKind,
} from "./catalog.js";

import { braintreeManifest, BRAINTREE_ADAPTER_VERSION } from "./manifest.js";

export { braintreeManifest, BRAINTREE_ADAPTER_VERSION };

const PROVIDER = "braintree";

export const BRAINTREE_FORMATS = {
  graphql: "braintree.graphql.response",
  transaction: "braintree.transaction",
  validation: "braintree.sdk.validation_errors",
  notification: "braintree.webhook.notification",
  signed: "braintree.webhook.signed",
} as const;

const F = BRAINTREE_FORMATS;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const Code = z.union([z.string().max(16), z.number().int()]);
const Flag = z.union([z.boolean(), z.enum(["true", "false"])]);

const HistoryEntry = z.looseObject({
  status: z.string().max(64),
  timestamp: z.string().max(64).nullable().optional(),
  // The GraphQL guide shows "true"/"false" strings; the schema says Boolean.
  terminal: Flag.nullable().optional(),
});

const Transaction = z.looseObject({
  id: z.string().max(128).nullable().optional(),
  status: z.string().max(64),
  type: z.string().max(32).nullable().optional(),
  status_history: z.array(HistoryEntry).nullable().optional(),
  statusHistory: z.array(HistoryEntry).nullable().optional(),
  processor_response_code: Code.nullable().optional(),
  processorResponseCode: Code.nullable().optional(),
  refund_ids: z.array(z.string().max(128)).nullable().optional(),
  refundIds: z.array(z.string().max(128)).nullable().optional(),
});

/** Webhook subjects from `sample_notification` are sparse, so status is optional here. */
const SubjectTransaction = z.looseObject({
  id: z.string().max(128).nullable().optional(),
  status: z.string().max(64).nullable().optional(),
});

const SdkResult = z.looseObject({ success: z.boolean().optional(), transaction: Transaction });

const PathItem = z.union([z.string().max(256), z.number().int()]);

const GraphqlError = z.looseObject({
  message: z.string().optional(),
  path: z.array(PathItem).optional(),
  extensions: z
    .looseObject({
      errorClass: z.string().max(64).optional(),
      errorType: z.string().max(64).optional(),
      legacyCode: Code.optional(),
      // Only seen in an unverified documentation example.
      code: z.string().max(64).optional(),
      inputPath: z.array(PathItem).optional(),
    })
    .optional(),
});

const GraphqlResponse = z
  .looseObject({
    data: z.record(z.string(), z.unknown()).nullable().optional(),
    errors: z.array(GraphqlError).optional(),
    extensions: z.looseObject({ requestId: z.string().max(128).optional() }).optional(),
  })
  .refine((v) => v.data !== undefined || v.errors !== undefined, {
    message: "A GraphQL response needs data or errors.",
  });

const Notification = z.looseObject({
  kind: z
    .string()
    .max(128)
    .regex(/^[a-z0-9_]+$/),
  timestamp: z
    .string()
    .max(64)
    .refine((v) => toIsoTimestamp(v) !== undefined, { message: "timestamp is not a valid date" }),
  subject: z.looseObject({}).nullable().optional(),
});

const ValidationResult = z.looseObject({
  success: z.literal(false).optional(),
  errors: z.union([z.looseObject({}), z.array(z.unknown())]),
});

type Obj = Record<string, unknown>;
type GraphqlResponseT = z.infer<typeof GraphqlResponse>;
type GraphqlErrorT = z.infer<typeof GraphqlError>;

type FoundPayment = { obj: Obj; path: string; refund: boolean; parentIds: string[] };
type ValidationTriple = { attribute: string; code: string; message?: string; path: string };

export type BraintreeParsed =
  | { kind: "graphql"; value: GraphqlResponseT; payments: FoundPayment[] }
  | { kind: "transaction"; value: Obj; path: string }
  | { kind: "validation"; triples: ValidationTriple[] }
  | { kind: "notification"; value: Obj; info?: WebhookKind; entity?: Obj; entityPath: string };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** First present value among snake_case / camelCase spellings. */
function pick(o: Obj | undefined, ...keys: string[]): unknown {
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/** Own-property lookup, so input such as "constructor" never resolves to Object.prototype members. */
function own<T>(table: Record<string, T>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

function obj(v: unknown): Obj | undefined {
  return isObj(v) ? v : undefined;
}

/** Numeric code as a string (`"2001"`, `2001`). */
function codeStr(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1e7) return String(v);
  if (typeof v === "string" && /^\d{1,7}$/.test(v)) return v;
  return undefined;
}

function word(v: unknown, max = 64): string | undefined {
  return typeof v === "string" && /^[A-Za-z0-9_ .-]{1,64}$/.test(v) && v.length <= max
    ? v
    : undefined;
}

function flag(v: unknown): boolean | undefined {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
}

function isProcessorCode(v: unknown): boolean {
  const c = codeStr(v);
  return c !== undefined && c.length === 4;
}

function money(
  amount: unknown,
  fallbackCurrency: string | undefined,
): { amountMinor?: string; currency?: string } {
  if (isObj(amount)) {
    const currency =
      upperCurrency(pick(amount, "currencyCode", "currencyIsoCode", "currency_iso_code")) ??
      fallbackCurrency;
    return { amountMinor: decimalToMinor(amount.value, currency), currency };
  }
  return { amountMinor: decimalToMinor(amount, fallbackCurrency), currency: fallbackCurrency };
}

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeText(x, 128) ?? "");
  }
  return out;
}

function uniq(list: (string | undefined)[]): string[] {
  return [...new Set(list.filter((x): x is string => Boolean(x)))];
}

function join(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

/** Drop undefined optional fields so output is stable and compact. */
function clean<T extends object>(d: T): T {
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as T;
}

function zodIssues(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const p = [prefix, i.path.join(".")].filter(Boolean).join(".");
    return `${p || "(root)"}: ${i.message}`;
  });
}

// ---------------------------------------------------------------------------
// Transaction view: one shape for SDK snake_case, SDK camelCase and GraphQL
// ---------------------------------------------------------------------------

type HistoryView = {
  index: number;
  rawStatus: string;
  statusKey: string;
  timestamp?: string;
  amountMinor?: string;
  currency?: string;
  source?: string;
  terminal?: boolean;
  processorCode?: string;
  processorText?: string;
  settlementCode?: string;
  settlementText?: string;
  gatewayReason?: string;
  declineType?: string;
};

type TxnView = {
  id?: string;
  /** Other spellings of the same transaction's id (legacyId / graphql_id). */
  altIds: string[];
  refund: boolean;
  /** Ids of the refunded (original) transaction. */
  parentIds: string[];
  refundIds: string[];
  rawStatus?: string;
  statusKey?: string;
  info?: StatusInfo;
  graphqlStyle: boolean;
  type?: string;
  orderId?: string;
  amountMinor?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  processorCode?: string;
  processorText?: string;
  processorType?: string;
  declineType?: string;
  gatewayReason?: string;
  settlementCode?: string;
  settlementText?: string;
  achReturnCode?: string;
  history: HistoryView[];
  historyKey: string;
};

function idsOf(o: Obj | undefined): string[] {
  if (!o) return [];
  return uniq([safeId(o.id), safeId(o.legacyId), safeId(pick(o, "graphql_id", "graphqlId"))]);
}

function viewHistory(raw: unknown, currency: string | undefined): HistoryView[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryView[] = [];
  raw.slice(0, 200).forEach((e, index) => {
    if (!isObj(e) || typeof e.status !== "string") return;
    const statusKey = e.status.toLowerCase();
    const pr = obj(e.processorResponse);
    const settlement = statusKey === "settlement_declined";
    const prCode = codeStr(
      pick(e, "processor_response_code", "proccessor_response_code", "processorResponseCode") ??
        pr?.legacyCode,
    );
    const prText =
      pick(e, "processor_response_text", "proccessor_response_text", "processorResponseText") ??
      pr?.message;
    out.push(
      clean({
        index,
        rawStatus: e.status,
        statusKey,
        timestamp: toIsoTimestamp(e.timestamp),
        ...money(e.amount, currency),
        source: word(pick(e, "transaction_source", "transactionSource", "source"), 32),
        terminal: flag(e.terminal),
        // A SettlementDeclinedEvent carries the settlement response in processorResponse.
        processorCode: settlement ? undefined : prCode,
        processorText: settlement ? undefined : typeof prText === "string" ? prText : undefined,
        settlementCode: settlement ? prCode : undefined,
        settlementText: settlement && typeof prText === "string" ? prText : undefined,
        gatewayReason: word(pick(e, "gateway_rejection_reason", "gatewayRejectionReason")),
        declineType: word(e.declineType, 16),
      }) as HistoryView,
    );
  });
  return out;
}

type TxnHint = { refund?: boolean; parentIds?: string[] };

function viewTxn(o: Obj, hint: TxnHint = {}): TxnView {
  const rawStatus = typeof o.status === "string" && o.status !== "" ? o.status : undefined;
  const statusKey = rawStatus?.toLowerCase();
  const info = own(TRANSACTION_STATUSES, statusKey);
  const graphqlStyle = Boolean(
    rawStatus && /[A-Z]/.test(rawStatus) && rawStatus === rawStatus.toUpperCase(),
  );
  const currency = upperCurrency(pick(o, "currency_iso_code", "currencyIsoCode"));
  const amount = money(o.amount, currency);
  const historyKey = Array.isArray(o.status_history) ? "status_history" : "statusHistory";
  const history = viewHistory(o[historyKey], amount.currency);

  const refundedTransaction = obj(o.refundedTransaction);
  const parentIds = uniq([
    ...(hint.parentIds ?? []),
    safeId(pick(o, "refunded_transaction_id", "refundedTransactionId")),
    ...idsOf(refundedTransaction),
  ]);
  const type = word(o.type, 16);
  const refund = Boolean(hint.refund) || type === "credit" || parentIds.length > 0;

  const refundIdList = pick(o, "refund_ids", "refundIds");
  const refunds = Array.isArray(o.refunds) ? o.refunds : [];
  const refundIds = uniq([
    ...(Array.isArray(refundIdList) ? refundIdList.map((x) => safeId(x)) : []),
    safeId(o.refund_id),
    ...refunds.flatMap((r) => idsOf(obj(r))),
  ]);

  const auth = obj(o.processorAuthorizationResponse);
  const settle = obj(o.processorSettlementResponse);
  const declined = history.find((h) => h.statusKey === "processor_declined");
  const rejected = history.find((h) => h.statusKey === "gateway_rejected");
  const settleDeclined = history.find((h) => h.statusKey === "settlement_declined");
  const withCode = declined ?? history.find((h) => h.processorCode);

  const text = (v: unknown) => (typeof v === "string" ? v : undefined);

  return clean({
    id: safeId(o.id),
    altIds: uniq([safeId(o.legacyId), safeId(pick(o, "graphql_id", "graphqlId"))]).filter(
      (x) => x !== safeId(o.id),
    ),
    refund,
    parentIds,
    refundIds,
    rawStatus,
    statusKey,
    info,
    graphqlStyle,
    type,
    orderId: safeId(pick(o, "order_id", "orderId"), 256),
    ...amount,
    createdAt: toIsoTimestamp(pick(o, "created_at", "createdAt")),
    updatedAt: toIsoTimestamp(pick(o, "updated_at", "updatedAt")),
    processorCode:
      codeStr(pick(o, "processor_response_code", "processorResponseCode")) ??
      codeStr(auth?.legacyCode) ??
      withCode?.processorCode,
    processorText:
      text(pick(o, "processor_response_text", "processorResponseText")) ??
      text(auth?.message) ??
      withCode?.processorText,
    processorType: word(pick(o, "processor_response_type", "processorResponseType"), 32),
    declineType: declined?.declineType,
    gatewayReason:
      word(pick(o, "gateway_rejection_reason", "gatewayRejectionReason")) ??
      rejected?.gatewayReason,
    settlementCode:
      codeStr(pick(o, "processor_settlement_response_code", "processorSettlementResponseCode")) ??
      codeStr(settle?.legacyCode) ??
      settleDeclined?.settlementCode,
    settlementText:
      text(pick(o, "processor_settlement_response_text", "processorSettlementResponseText")) ??
      text(settle?.message) ??
      settleDeclined?.settlementText,
    achReturnCode: safeId(pick(o, "ach_return_code", "achReturnCode") ?? settle?.achReturnCode, 16),
    history,
    historyKey,
  }) as TxnView;
}

function references(v: TxnView): { paymentReference?: string; relatedReference?: string } {
  // A refund is its own transaction; it belongs to the payment it refunds.
  if (v.refund && v.parentIds[0])
    return clean({ paymentReference: v.parentIds[0], relatedReference: v.id });
  return clean({ paymentReference: v.id ?? v.altIds[0] });
}

function correlationIds(v: TxnView): string[] {
  return uniq([v.id, ...v.altIds, ...v.parentIds, ...v.refundIds]);
}

function txnAttributes(v: TxnView): Record<string, SafePrimitive | SafePrimitive[]> {
  return {
    ...attrs([
      ["objectType", v.refund ? "refund" : "transaction"],
      ["transactionType", v.type],
      ["currentStatus", v.rawStatus],
      ["processorResponseCode", v.processorCode],
      ["processorResponseText", v.processorText],
      ["processorResponseType", v.processorType],
      ["declineType", v.declineType],
      ["gatewayRejectionReason", v.gatewayReason],
      ["settlementResponseCode", v.settlementCode],
      ["settlementResponseText", v.settlementText],
      ["achReturnCode", v.achReturnCode],
      ["createdAt", v.createdAt],
      ["updatedAt", v.updatedAt],
    ]),
    // Already validated by safeId; not truncated so they keep linking.
    correlationIds: correlationIds(v),
  };
}

function stageOutcome(v: TxnView, statusKey: string | undefined) {
  const info = own(TRANSACTION_STATUSES, statusKey);
  if (!info) return { info, stage: "other" as const, outcome: "unknown" as Outcome };
  return v.refund
    ? { info, stage: info.refundStage, outcome: info.refundOutcome }
    : { info, stage: info.stage, outcome: info.outcome };
}

function statusEventType(v: TxnView, statusKey: string | undefined): string {
  const prefix = v.refund ? "refund" : "transaction";
  return `${prefix}.${statusKey ? (safeText(statusKey, 64) ?? "unknown") : "unknown"}`;
}

/**
 * Events for one transaction. With a fully timestamped status history there is
 * one event per entry; otherwise one snapshot event that lists the statuses.
 * Braintree sends no transaction webhooks for card, PayPal or Venmo payments,
 * so nothing beyond the supplied history is inferred.
 */
function transactionEvents(
  v: TxnView,
  ctx: NormalizeContext,
  path: string,
  extra: Record<string, SafePrimitive | SafePrimitive[]> = {},
): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const common = { ...txnAttributes(v), ...extra };
  const refs = references(v);
  const events: NormalizedEventDraft[] = [];
  const timed = v.history.length > 0 && v.history.every((h) => h.timestamp);

  if (timed) {
    // GraphQL lists statusHistory newest first. Emit oldest first so the input
    // order does not look like out-of-order arrival.
    const chronological = [...v.history].sort(
      (a, b) => Date.parse(a.timestamp!) - Date.parse(b.timestamp!) || a.index - b.index,
    );
    for (const h of chronological) {
      const so = stageOutcome(v, h.statusKey);
      events.push(
        clean({
          sourceFormat: ctx.format,
          eventType: statusEventType(v, h.statusKey),
          eventTypeKnown: Boolean(so.info),
          stage: so.stage,
          providerStatus: safeText(h.rawStatus, 64),
          ...refs,
          merchantReference: v.orderId,
          eventTimestamp: h.timestamp,
          amountMinor: h.amountMinor ?? v.amountMinor,
          currency: h.currency ?? v.currency,
          outcome: so.outcome,
          attributes: {
            ...common,
            ...attrs([
              ["observation", "status_history"],
              ["historyIndex", h.index],
              ["transactionSource", h.source],
              ["terminal", h.terminal],
            ]),
          },
          source: { recordIndex: ctx.recordIndex, path: join(path, `${v.historyKey}[${h.index}]`) },
          ...observed,
        }),
      );
    }
    const latest = chronological.at(-1);
    if (!v.statusKey || latest?.statusKey === v.statusKey) return events;
  }

  const so = stageOutcome(v, v.statusKey);
  const listed = chronologicalStatuses(v);
  events.push(
    clean({
      sourceFormat: ctx.format,
      eventType: statusEventType(v, v.statusKey),
      eventTypeKnown: Boolean(so.info),
      stage: so.stage,
      providerStatus: v.rawStatus ? safeText(v.rawStatus, 64) : undefined,
      ...refs,
      merchantReference: v.orderId,
      amountMinor: v.amountMinor,
      currency: v.currency,
      outcome: so.outcome,
      attributes: {
        ...common,
        ...attrs([
          ["observation", "snapshot"],
          ...(timed || v.history.length === 0
            ? []
            : ([
                ["statusHistory", listed.statuses],
                ["statusHistoryOrder", listed.order],
              ] as [string, unknown][])),
        ]),
      },
      source: { recordIndex: ctx.recordIndex, path },
      ...observed,
    }),
  );
  return events;
}

function chronologicalStatuses(v: TxnView): { statuses: string[]; order: string } {
  const statuses = v.history.map((h) => h.rawStatus);
  // GraphQL documents statusHistory as reverse chronological; the SDK order is not documented.
  if (v.graphqlStyle) return { statuses: statuses.reverse(), order: "chronological" };
  return { statuses, order: "as_supplied" };
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

type ErrorBase = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
  attemptReference?: string;
};

const UNKNOWN_ENTRY: CatalogEntry = {
  category: "unknown",
  explanation: "PandaPayLens does not recognize this Braintree code.",
  nextAction:
    "Check the Braintree documentation for this code and the transaction in the Control Panel.",
  retry: "unknown",
  retryExplanation: "Without a known code, retry safety cannot be assessed.",
};

/** En and em dashes, which some documentation texts use instead of a hyphen. */
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "g");

function normalizedText(t: string): string {
  return t
    .toLowerCase()
    .replace(LONG_DASHES, "-")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .trim();
}

const PROCESSOR_BY_TEXT: Record<string, string> = (() => {
  const counts = new Map<string, string[]>();
  for (const r of Object.values(PROCESSOR_RESPONSES)) {
    const k = normalizedText(r.text);
    counts.set(k, [...(counts.get(k) ?? []), r.code]);
  }
  // Ambiguous texts (shared by several codes) are not used for matching.
  return Object.fromEntries(
    [...counts].filter(([, c]) => c.length === 1).map(([k, c]) => [k, c[0]!]),
  );
})();

function lookupProcessor(
  code: string | undefined,
  text: string | undefined,
): { entry?: ProcessorResponse; confidence: Confidence; notes: string[] } {
  if (code) {
    const exact = own(PROCESSOR_RESPONSES, code);
    if (exact) return { entry: exact, confidence: "strong", notes: [] };
    const n = Number(code);
    if (n >= 2109 && n <= 2999)
      return {
        entry: PROCESSOR_DECLINED_RANGE,
        confidence: "possible",
        notes: [
          `Code ${code} is in the 2109-2999 range, which has no individual documented meaning.`,
        ],
      };
    if (own(APPROVAL_RESPONSES, code))
      return {
        confidence: "insufficient",
        notes: [`Code ${code} is an approval code, which contradicts the declined status.`],
      };
    return {
      confidence: "insufficient",
      notes: [`Processor response code ${code} is not documented in the PandaPayLens catalog.`],
    };
  }
  const byText = own(PROCESSOR_BY_TEXT, text ? normalizedText(text) : undefined);
  if (byText)
    return {
      entry: own(PROCESSOR_RESPONSES, byText),
      confidence: "possible",
      notes: [
        "No processor response code was supplied; the code was matched from the response text.",
      ],
    };
  return { confidence: "insufficient", notes: ["No processor response code was supplied."] };
}

function retryFromDeclineType(type: string | undefined): {
  retry: CatalogEntry["retry"];
  retryExplanation: string;
} | null {
  const t = type?.toLowerCase();
  if (t === "hard" || t === "hard_declined")
    return {
      retry: "do_not_retry",
      retryExplanation:
        "Braintree marked this as a hard decline: it is not temporary, so retries on the same payment method will likely fail.",
    };
  if (t === "soft" || t === "soft_declined")
    return {
      retry: "retry_conditionally",
      retryExplanation:
        "Braintree marked this as a soft decline: it is temporary, so a later retry may succeed. Avoid immediate repeated retries.",
    };
  return null;
}

function missingRef(base: ErrorBase, missing: string[]): string[] {
  if (!base.paymentReference)
    missing.push("No transaction id; the transaction cannot be looked up from this record.");
  return missing;
}

function processorError(v: TxnView, base: ErrorBase): DecodedErrorDraft {
  const found = lookupProcessor(v.processorCode, v.processorText);
  const supplied = v.declineType ?? v.processorType;
  const subCodes: Record<string, string> = clean({
    status: v.rawStatus,
    processorResponseType: v.processorType,
    declineType: v.declineType,
    documentedDeclineType: found.entry?.declineType,
  }) as Record<string, string>;
  const message = safeText(v.processorText, 200);
  let entry: CatalogEntry = found.entry ?? {
    ...UNKNOWN_ENTRY,
    category: "card_declined",
    explanation:
      "The processor declined the transaction, but the processor response code is missing or not documented.",
    nextAction:
      "Check the processor response in the Braintree Control Panel and show the customer a generic message.",
  };
  if (!found.entry) {
    const fromType = retryFromDeclineType(supplied);
    if (fromType) entry = { ...entry, ...fromType };
  }
  return {
    ...base,
    code: v.processorCode ?? found.entry?.code ?? v.rawStatus ?? "processor_declined",
    subCodes,
    category: entry.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: entry.explanation,
    nextAction: entry.nextAction,
    retry: entry.retry,
    retryExplanation: entry.retryExplanation,
    confidence: found.confidence,
    documentation: [
      { title: "Braintree processor authorization responses", url: AUTHORIZATION_RESPONSES_URL },
      { title: "Braintree statuses", url: STATUSES_URL },
    ],
    missingInformation: missingRef(base, [...found.notes]),
  };
}

function failedError(v: TxnView, base: ErrorBase): DecodedErrorDraft {
  return {
    ...base,
    code: v.rawStatus ?? "failed",
    subCodes: { status: v.rawStatus ?? "failed" },
    category: "provider_unavailable",
    explanation:
      "Braintree reports status failed: an error occurred while sending the transaction to the processor.",
    nextAction:
      "Check that no other transaction for this order succeeded, then try again. Contact Braintree support if it keeps happening.",
    retry: "retry_conditionally",
    retryExplanation:
      "This transaction did not complete, so a new attempt may succeed. A retry creates a new transaction; confirm first that no other attempt for the same order succeeded.",
    confidence: "possible",
    documentation: [{ title: "Braintree statuses", url: STATUSES_URL }],
    missingInformation: missingRef(base, ["No processor response code explains the failure."]),
  };
}

function gatewayError(v: TxnView, base: ErrorBase): DecodedErrorDraft {
  const reason = v.gatewayReason?.toLowerCase();
  const entry = own(GATEWAY_REJECTION_REASONS, reason);
  const missing: string[] = [];
  if (!reason) missing.push("No gateway rejection reason was supplied.");
  else if (!entry)
    missing.push(`Gateway rejection reason "${safeText(reason, 64)}" is not documented.`);
  else if (!entry.sdkDocumented && !v.graphqlStyle)
    missing.push(`The SDK reference does not list "${reason}"; it is documented for GraphQL only.`);
  const e: CatalogEntry = entry ?? {
    ...UNKNOWN_ENTRY,
    explanation:
      "The merchant's gateway rules rejected the transaction, but the reason is missing or not documented. If the transaction was already authorized, Braintree voids it automatically.",
    nextAction:
      "Check the gateway rejection reason and your risk settings in the Braintree Control Panel.",
  };
  return {
    ...base,
    code: reason ?? v.rawStatus ?? "gateway_rejected",
    subCodes: clean({ status: v.rawStatus, gatewayRejectionReason: v.gatewayReason }) as Record<
      string,
      string
    >,
    category: e.category,
    explanation: e.explanation,
    nextAction: e.nextAction,
    retry: e.retry,
    retryExplanation: e.retryExplanation,
    confidence: entry ? (entry.described ? "strong" : "possible") : "insufficient",
    documentation: [{ title: "Braintree gateway rejections", url: GATEWAY_REJECTIONS_URL }],
    missingInformation: missingRef(base, missing),
  };
}

function settlementError(v: TxnView, base: ErrorBase): DecodedErrorDraft {
  const code = v.settlementCode;
  const found = own(SETTLEMENT_RESPONSES, code);
  const entry = found?.group === "Decline" ? found : undefined;
  const missing: string[] = [];
  if (!code) missing.push("No settlement response code was supplied.");
  else if (!found)
    missing.push(`Settlement response code ${code} is not documented in the PandaPayLens catalog.`);
  else if (!entry)
    missing.push(`Code ${code} ("${found.text}") contradicts the settlement_declined status.`);
  if (v.achReturnCode)
    missing.push(`ACH return code ${v.achReturnCode} is present but not decoded by PandaPayLens.`);
  const e: CatalogEntry = entry ?? {
    ...UNKNOWN_ENTRY,
    explanation:
      "The processor declined the transaction at settlement, but the settlement response code is missing or not documented.",
    nextAction: "Check the settlement response in the Braintree Control Panel.",
  };
  const message = safeText(v.settlementText, 200);
  return {
    ...base,
    code: code ?? v.rawStatus ?? "settlement_declined",
    subCodes: clean({ status: v.rawStatus, achReturnCode: v.achReturnCode }) as Record<
      string,
      string
    >,
    category: e.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: e.explanation,
    nextAction: e.nextAction,
    retry: e.retry,
    retryExplanation: e.retryExplanation,
    confidence: entry ? "strong" : "insufficient",
    documentation: [{ title: "Braintree settlement responses", url: SETTLEMENT_RESPONSES_URL }],
    missingInformation: missingRef(base, missing),
  };
}

function isDeclineRange(code: string | undefined): boolean {
  const n = Number(code);
  return code !== undefined && n >= 2000 && n <= 3000;
}

function transactionErrors(v: TxnView, ctx: NormalizeContext, path: string): DecodedErrorDraft[] {
  const refs = references(v);
  const base: ErrorBase = clean({
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    paymentReference: refs.paymentReference,
    attemptReference: v.id,
  });
  switch (v.statusKey) {
    case "processor_declined":
      return [processorError(v, base)];
    case "failed":
      return [isDeclineRange(v.processorCode) ? processorError(v, base) : failedError(v, base)];
    case "gateway_rejected":
      return [gatewayError(v, base)];
    case "settlement_declined":
      return [settlementError(v, base)];
    default:
      // An undocumented status with a decline code is still worth decoding.
      return !v.info && isDeclineRange(v.processorCode) ? [processorError(v, base)] : [];
  }
}

const FAILURE_CLASSES = new Set([
  "VALIDATION",
  "AUTHENTICATION",
  "AUTHORIZATION",
  "NOT_FOUND",
  "UNSUPPORTED_CLIENT",
  "NOT_IMPLEMENTED",
]);

function graphqlErrorDraft(e: GraphqlErrorT, i: number, ctx: NormalizeContext): DecodedErrorDraft {
  const ext = e.extensions ?? {};
  const legacy = codeStr(ext.legacyCode);
  const cls = ext.errorClass;
  const clsEntry = own(GRAPHQL_ERROR_CLASSES, cls);
  const validation = own(VALIDATION_ERRORS, legacy);
  const missing: string[] = [];
  let entry: CatalogEntry;
  let confidence: Confidence;
  if (validation) {
    entry = validation;
    confidence = "strong";
  } else if (clsEntry) {
    entry = clsEntry;
    confidence = "possible";
    if (legacy)
      missing.push(
        `legacyCode ${legacy} is not in the PandaPayLens catalog yet; it was decoded by errorClass.`,
      );
  } else {
    entry = {
      ...UNKNOWN_ENTRY,
      explanation: "PandaPayLens does not recognize this Braintree GraphQL error.",
      nextAction:
        "Check the error and the Braintree GraphQL error documentation. Quote the requestId when contacting Braintree support.",
    };
    confidence = "insufficient";
    missing.push(
      legacy
        ? `legacyCode ${legacy} is not in the PandaPayLens catalog and no known errorClass was supplied.`
        : "No legacyCode or known errorClass was supplied.",
    );
  }
  const subCodes: Record<string, string> = {};
  if (cls) subCodes.errorClass = safeText(cls, 64) ?? "";
  if (legacy) subCodes.legacyCode = legacy;
  if (ext.errorType) subCodes.errorType = safeText(ext.errorType, 64) ?? "";
  if (ext.code) subCodes.code = safeText(ext.code, 64) ?? "";
  if (ext.inputPath) subCodes.inputPath = safeText(ext.inputPath.join("."), 200) ?? "";
  if (e.path) subCodes.path = safeText(e.path.join("."), 200) ?? "";
  const message = safeText(e.message, 300);
  const docs: DocumentationLink[] = [
    { title: "Braintree GraphQL errors", url: GRAPHQL_API_CALLS_URL },
  ];
  if (legacy) docs.push({ title: "Braintree validation errors", url: VALIDATION_ERRORS_URL });
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: `errors[${i}]` },
    code: legacy ?? (cls ? safeText(cls, 64)! : undefined) ?? safeId(ext.code, 64) ?? "unknown",
    subCodes,
    category: entry.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: entry.explanation,
    nextAction: entry.nextAction,
    retry: entry.retry,
    retryExplanation: entry.retryExplanation,
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

function validationErrorDraft(t: ValidationTriple, ctx: NormalizeContext): DecodedErrorDraft {
  const known = own(VALIDATION_ERRORS, t.code);
  const entry = known ?? GENERIC_VALIDATION_ERROR;
  const message = safeText(t.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: t.path },
    code: t.code,
    subCodes: { attribute: safeText(t.attribute, 64) ?? "" },
    category: entry.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: entry.explanation,
    nextAction: entry.nextAction,
    retry: entry.retry,
    retryExplanation: entry.retryExplanation,
    confidence: known ? "strong" : "possible",
    documentation: [
      { title: "Braintree validation errors", url: VALIDATION_ERRORS_URL },
      { title: "Braintree result objects", url: RESULT_OBJECTS_URL },
    ],
    missingInformation: known
      ? []
      : [`Validation code ${t.code} is not in the PandaPayLens catalog yet.`],
  };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const SDK_SNAKE_CONTEXT = [
  "merchant_account_id",
  "currency_iso_code",
  "status_history",
  "processor_response_type",
  "processor_response_text",
];
const SDK_CAMEL_CONTEXT = [
  "merchantAccountId",
  "currencyIsoCode",
  "statusHistory",
  "processorResponseType",
  "processorResponseText",
];
const SDK_SPECIFIC = [
  "gateway_rejection_reason",
  "gatewayRejectionReason",
  "processor_settlement_response_code",
  "processorSettlementResponseCode",
  "refunded_transaction_id",
  "refundedTransactionId",
];

function isGraphqlPayment(o: Obj): boolean {
  return (
    typeof o.status === "string" &&
    PAYMENT_STATUS_ENUM.has(o.status) &&
    (typeof o.id === "string" || typeof o.legacyId === "string" || Array.isArray(o.statusHistory))
  );
}

function isStrongGraphqlPayment(o: Obj): boolean {
  return (
    isGraphqlPayment(o) &&
    (Array.isArray(o.statusHistory) ||
      typeof o.legacyId === "string" ||
      isObj(o.processorAuthorizationResponse) ||
      isObj(o.processorSettlementResponse) ||
      isObj(o.refundedTransaction))
  );
}

/** Structural signals of a transaction object. */
function transactionSignals(o: Obj): { confidence: number; reasons: string[] } | null {
  const status = typeof o.status === "string" ? o.status : undefined;
  const lower = own(TRANSACTION_STATUSES, status) !== undefined;
  const has = (keys: string[]) => keys.some((k) => k in o);
  if (
    (isProcessorCode(o.processor_response_code) && has(SDK_SNAKE_CONTEXT)) ||
    (isProcessorCode(o.processorResponseCode) && has(SDK_CAMEL_CONTEXT))
  )
    return {
      confidence: 0.95,
      reasons: ["has a 4-digit processor response code with Braintree transaction fields"],
    };
  if (lower && SDK_SPECIFIC.some((k) => typeof o[k] === "string"))
    return {
      confidence: 0.9,
      reasons: [
        `status "${status}" is a Braintree transaction status`,
        "has Braintree-specific transaction fields",
      ],
    };
  const history = pick(o, "status_history", "statusHistory");
  if (
    lower &&
    Array.isArray(history) &&
    history.some((h) => isObj(h) && ("transaction_source" in h || "transactionSource" in h))
  )
    return {
      confidence: 0.9,
      reasons: [
        `status "${status}" is a Braintree transaction status`,
        "status history entries carry transaction_source",
      ],
    };
  if (isStrongGraphqlPayment(o))
    return {
      confidence: 0.85,
      reasons: [
        `status "${status}" is a Braintree PaymentStatus value`,
        "has statusHistory, legacyId or processor responses",
      ],
    };
  if (
    lower &&
    typeof o.id === "string" &&
    has(["merchant_account_id", "merchantAccountId"]) &&
    has(["currency_iso_code", "currencyIsoCode"])
  )
    return {
      confidence: 0.75,
      reasons: [
        `status "${status}" is a Braintree transaction status`,
        "has merchant account id and currency_iso_code",
      ],
    };
  return null;
}

function findPayments(
  value: unknown,
  path: string,
  depth: number,
  out: FoundPayment[],
  key?: string,
): void {
  if (depth > 12 || out.length >= 200) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => findPayments(v, `${path}[${i}]`, depth + 1, out, key));
    return;
  }
  if (!isObj(value)) return;
  if (isGraphqlPayment(value)) {
    out.push({
      obj: value,
      path,
      refund: key === "refund" || isObj(value.refundedTransaction),
      parentIds: [],
    });
    // Refunds listed on a transaction are separate transactions.
    if (Array.isArray(value.refunds)) {
      const parentIds = idsOf(value);
      value.refunds.forEach((r, i) => {
        if (isObj(r) && isGraphqlPayment(r))
          out.push({ obj: r, path: `${path}.refunds[${i}]`, refund: true, parentIds });
      });
    }
    return;
  }
  for (const [k, v] of Object.entries(value)) findPayments(v, join(path, k), depth + 1, out, k);
}

const GRAPHQL_KEYS = new Set(["data", "errors", "extensions"]);

function detectGraphql(o: Obj): DetectionResult | null {
  if (!Object.keys(o).every((k) => GRAPHQL_KEYS.has(k))) return null;
  if (!("data" in o) && !("errors" in o)) return null;
  const reasons: string[] = [];
  let confidence = 0;
  const errors = Array.isArray(o.errors) ? o.errors : [];
  const exts = errors.map((e) => (isObj(e) ? obj(e.extensions) : undefined));
  if (exts.some((x) => x && typeof codeStr(x.legacyCode) === "string")) {
    confidence = 0.95;
    reasons.push("errors[].extensions carry a numeric legacyCode");
  } else if (
    exts.some(
      (x) =>
        x &&
        typeof x.errorClass === "string" &&
        own(GRAPHQL_ERROR_CLASSES, x.errorClass) !== undefined,
    )
  ) {
    confidence = 0.9;
    reasons.push("errors[].extensions.errorClass is a Braintree error class");
  }
  const payments: FoundPayment[] = [];
  if (isObj(o.data)) findPayments(o.data, "data", 0, payments);
  const requestId = typeof obj(o.extensions)?.requestId === "string";
  if (payments.some((p) => isStrongGraphqlPayment(p.obj))) {
    confidence = Math.max(confidence, 0.9);
    reasons.push(
      "data contains a transaction with a PaymentStatus value and statusHistory, legacyId or processor responses",
    );
  } else if (payments.length > 0) {
    confidence = Math.max(confidence, requestId ? 0.85 : 0.6);
    reasons.push("data contains an object with a PaymentStatus value");
  }
  if (requestId) reasons.push("has extensions.requestId");
  if (confidence === 0 && requestId) confidence = 0.4;
  if (confidence === 0) return null;
  return {
    provider: PROVIDER,
    format: F.graphql,
    confidence,
    supported: true,
    reasons,
  };
}

function collectTriples(
  value: unknown,
  path: string,
  depth: number,
  out: ValidationTriple[],
): void {
  if (depth > 10 || out.length >= 100) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectTriples(v, `${path}[${i}]`, depth + 1, out));
    return;
  }
  if (!isObj(value)) return;
  const code = codeStr(value.code);
  if (typeof value.attribute === "string" && code && typeof value.message === "string") {
    out.push({ attribute: value.attribute, code, message: value.message, path });
    return;
  }
  for (const [k, v] of Object.entries(value)) collectTriples(v, join(path, k), depth + 1, out);
}

const SUBJECT_KEYS = [
  "transaction",
  "dispute",
  "disbursement",
  "subscription",
  "transaction_review",
  "transactionReview",
  "subject",
];

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  // Raw webhook delivery. The signature value is never echoed.
  if ("bt_signature" in input || "bt_payload" in input) {
    const both = "bt_signature" in input && "bt_payload" in input;
    const form =
      meta?.format === "form" ||
      (meta?.format === "http" && meta.http?.contentType === "application/x-www-form-urlencoded");
    return {
      provider: PROVIDER,
      format: F.signed,
      confidence: both ? (form ? 0.98 : 0.9) : 0.8,
      supported: false,
      reasons: [
        both ? "has bt_signature and bt_payload fields" : "has a bt_signature or bt_payload field",
        ...(form ? ["arrived as form-encoded data"] : []),
      ],
      unsupportedReason:
        "This is a raw Braintree webhook delivery (bt_signature and bt_payload). It can only be verified and decoded with the merchant's private API key, so PandaPayLens does not decode it. Parse it with a Braintree server SDK and paste the parsed notification (kind, timestamp and subject) instead.",
    };
  }

  if (typeof input.kind === "string" && /^[a-z0-9_]{1,128}$/.test(input.kind)) {
    const known = own(WEBHOOK_KINDS, input.kind) !== undefined;
    const hasTs = typeof input.timestamp === "string";
    const hasSubject = SUBJECT_KEYS.some((k) => isObj(input[k]));
    if (known && (hasTs || hasSubject))
      return {
        provider: PROVIDER,
        format: F.notification,
        confidence: hasTs && hasSubject ? 0.95 : 0.85,
        supported: true,
        reasons: [
          `kind "${input.kind}" is a documented Braintree notification kind`,
          ...(hasTs ? ["has timestamp"] : []),
          ...(hasSubject ? ["has a subject object"] : []),
        ],
      };
    if (!known && hasTs && hasSubject)
      return {
        provider: PROVIDER,
        format: F.notification,
        confidence: 0.6,
        supported: true,
        reasons: ["has kind, timestamp and a subject object like a Braintree notification"],
      };
  }

  const graphql = detectGraphql(input);
  if (graphql) return graphql;

  if (
    input.success === false &&
    (isObj(input.errors) || Array.isArray(input.errors)) &&
    !isObj(input.transaction)
  ) {
    const triples: ValidationTriple[] = [];
    collectTriples(input.errors, "errors", 0, triples);
    if (triples.length > 0) {
      const fiveDigit = triples.some((t) => /^\d{5}$/.test(t.code));
      return {
        provider: PROVIDER,
        format: F.validation,
        confidence: fiveDigit ? 0.85 : 0.7,
        supported: true,
        reasons: [
          "success is false",
          "errors contain attribute, code and message entries",
          ...(fiveDigit ? ["codes are 5-digit Braintree validation codes"] : []),
        ],
      };
    }
  }

  const wrapped = isObj(input.transaction) ? input.transaction : undefined;
  const signals = transactionSignals(wrapped ?? input);
  if (signals)
    return {
      provider: PROVIDER,
      format: F.transaction,
      confidence: signals.confidence,
      supported: true,
      reasons: [
        ...(wrapped ? ["transaction is wrapped in a result object"] : []),
        ...signals.reasons,
      ],
    };

  return none;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type ParseResult = { ok: true; value: BraintreeParsed } | { ok: false; issues: string[] };

function parseGraphql(input: unknown): ParseResult {
  const r = GraphqlResponse.safeParse(input);
  if (!r.success) return { ok: false, issues: zodIssues(r.error) };
  const found: FoundPayment[] = [];
  if (r.data.data) findPayments(r.data.data, "data", 0, found);
  const issues: string[] = [];
  for (const p of found) {
    const t = Transaction.safeParse(p.obj);
    if (!t.success) issues.push(...zodIssues(t.error, p.path));
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { kind: "graphql", value: r.data, payments: found } };
}

function parseTransaction(input: unknown): ParseResult {
  if (isObj(input) && isObj(input.transaction)) {
    const r = SdkResult.safeParse(input);
    if (!r.success) return { ok: false, issues: zodIssues(r.error) };
    return {
      ok: true,
      value: { kind: "transaction", value: r.data.transaction, path: "transaction" },
    };
  }
  const r = Transaction.safeParse(input);
  if (!r.success) return { ok: false, issues: zodIssues(r.error) };
  return { ok: true, value: { kind: "transaction", value: r.data, path: "" } };
}

function parseValidation(input: unknown): ParseResult {
  const r = ValidationResult.safeParse(input);
  if (!r.success) return { ok: false, issues: zodIssues(r.error) };
  const triples: ValidationTriple[] = [];
  collectTriples(r.data.errors, "errors", 0, triples);
  if (triples.length === 0)
    return {
      ok: false,
      issues: ["errors: no entries with attribute, code and message were found"],
    };
  return { ok: true, value: { kind: "validation", triples } };
}

function subjectEntity(n: Obj, info: WebhookKind | undefined): { entity?: Obj; path: string } {
  const root = obj(n.subject) ?? n;
  const prefix = isObj(n.subject) ? "subject" : "";
  const keys =
    info?.subject === "transaction_review"
      ? ["transaction_review", "transactionReview"]
      : info
        ? [info.subject]
        : ["transaction", "dispute"];
  for (const k of keys) {
    const e = obj(root[k]);
    if (e) return { entity: e, path: join(prefix, k) };
  }
  return { path: prefix };
}

function parseNotification(input: unknown): ParseResult {
  const r = Notification.safeParse(input);
  if (!r.success) return { ok: false, issues: zodIssues(r.error) };
  const info = own(WEBHOOK_KINDS, r.data.kind);
  const { entity, path } = subjectEntity(r.data, info);
  const needsEntity =
    info && ["transaction", "dispute", "disbursement", "transaction_review"].includes(info.subject);
  if (needsEntity && !entity)
    return {
      ok: false,
      issues: [`${info.subject}: the ${r.data.kind} notification has no ${info.subject} subject`],
    };
  if (entity && info?.subject === "transaction") {
    const t = SubjectTransaction.safeParse(entity);
    if (!t.success) return { ok: false, issues: zodIssues(t.error, path) };
  }
  return {
    ok: true,
    value: clean({ kind: "notification" as const, value: r.data, info, entity, entityPath: path }),
  };
}

function parse(input: unknown, format: string): ParseResult {
  switch (format) {
    case F.graphql:
      return parseGraphql(input);
    case F.transaction:
      return parseTransaction(input);
    case F.validation:
      return parseValidation(input);
    case F.notification:
      return parseNotification(input);
    default:
      return { ok: false, issues: [`Unsupported Braintree format "${format}".`] };
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function paymentView(p: FoundPayment): TxnView {
  return viewTxn(p.obj, { refund: p.refund, parentIds: p.parentIds });
}

function graphqlErrorEvent(
  e: GraphqlErrorT,
  i: number,
  ctx: NormalizeContext,
  requestId: string | undefined,
): NormalizedEventDraft {
  const ext = e.extensions ?? {};
  const legacy = codeStr(ext.legacyCode);
  const cls = own(GRAPHQL_ERROR_CLASSES, ext.errorClass) ? ext.errorClass : undefined;
  // Validation-type errors mean the operation was rejected; for the others
  // (INTERNAL, SERVICE_AVAILABILITY, ...) Braintree does not say whether it took effect.
  const failed = cls ? FAILURE_CLASSES.has(cls) : Boolean(own(VALIDATION_ERRORS, legacy));
  return clean({
    sourceFormat: ctx.format,
    eventType: `graphql_error.${cls ?? legacy ?? "unknown"}`,
    eventTypeKnown: true,
    stage: "error" as const,
    providerStatus: cls,
    outcome: (failed ? "failure" : "unknown") as Outcome,
    attributes: attrs([
      ["errorClass", ext.errorClass],
      ["legacyCode", legacy],
      ["errorType", ext.errorType],
      ["field", e.path ? e.path.join(".") : undefined],
      ["inputPath", ext.inputPath ? ext.inputPath.join(".") : undefined],
      ["requestId", requestId],
    ]),
    source: { recordIndex: ctx.recordIndex, path: `errors[${i}]` },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function notificationEvent(
  parsed: Extract<BraintreeParsed, { kind: "notification" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const n = parsed.value;
  const kindName = String(n.kind);
  const info = parsed.info;
  const entity = parsed.entity;
  const subjectType = info?.subject ?? (entity ? parsed.entityPath.split(".").at(-1) : undefined);
  let stage = info?.stage ?? "other";
  let outcome: Outcome = info?.outcome ?? "unknown";
  let refs: { paymentReference?: string; relatedReference?: string } = {};
  let providerStatus: string | undefined;
  let amount: { amountMinor?: string; currency?: string } = {};
  let merchantReference: string | undefined;
  let attributes: Record<string, SafePrimitive | SafePrimitive[]> = {};

  if (entity && subjectType === "transaction") {
    const v = viewTxn(entity);
    refs = references(v);
    providerStatus = v.rawStatus;
    amount = { amountMinor: v.amountMinor, currency: v.currency };
    merchantReference = v.orderId;
    if (v.refund && stage === "settlement") stage = "refund";
    attributes = txnAttributes(v);
  } else if (entity && subjectType === "dispute") {
    const status = typeof entity.status === "string" ? entity.status : undefined;
    providerStatus = status;
    refs = clean({ paymentReference: safeId(obj(entity.transaction)?.id) });
    attributes = attrs([
      ["disputeId", safeId(entity.id)],
      [
        "disputeStatus",
        status && DISPUTE_STATUSES.has(status.toLowerCase()) ? status.toLowerCase() : undefined,
      ],
      ["disputeKind", word(entity.kind, 32)],
      ["disputeReason", word(entity.reason, 64)],
    ]);
  } else if (entity && subjectType === "transaction_review") {
    refs = clean({ paymentReference: safeId(pick(entity, "transaction_id", "transactionId")) });
    attributes = attrs([["reviewDecision", word(entity.decision, 32)]]);
  } else if (entity && subjectType === "disbursement") {
    const success = flag(pick(entity, "success", "success?"));
    if (success !== undefined) outcome = success ? "success" : "failure";
    const ids = pick(entity, "transaction_ids", "transactionIds");
    attributes = attrs([
      ["disbursementId", safeId(entity.id)],
      ["disbursementSuccess", success],
      ["disbursementRetry", flag(entity.retry)],
      // Disbursements cover many transactions, so their ids do not correlate.
      ["transactionCount", Array.isArray(ids) ? ids.length : undefined],
    ]);
  } else if (entity && subjectType === "subscription") {
    attributes = attrs([
      ["subscriptionId", safeId(entity.id)],
      ["subscriptionStatus", word(entity.status, 32)],
    ]);
  }

  return clean({
    sourceFormat: ctx.format,
    eventType: safeText(kindName, 128) ?? "unknown",
    eventTypeKnown: Boolean(info),
    stage,
    providerStatus: providerStatus ? safeText(providerStatus, 64) : undefined,
    ...refs,
    merchantReference,
    // Braintree documents no notification id, so no deliveryKey is set.
    eventTimestamp: toIsoTimestamp(n.timestamp),
    ...amount,
    outcome,
    attributes: {
      ...attributes,
      ...attrs([
        ["notificationKind", kindName],
        ["subjectType", subjectType],
      ]),
    },
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: BraintreeParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "graphql": {
      const requestId = safeId(parsed.value.extensions?.requestId);
      const extra: Record<string, SafePrimitive> = requestId ? { requestId } : {};
      return [
        ...parsed.payments.flatMap((p) => transactionEvents(paymentView(p), ctx, p.path, extra)),
        ...(parsed.value.errors ?? []).map((e, i) => graphqlErrorEvent(e, i, ctx, requestId)),
      ];
    }
    case "transaction":
      return transactionEvents(viewTxn(parsed.value), ctx, parsed.path);
    case "validation": {
      const t = parsed.triples;
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: "validation_errors",
          eventTypeKnown: true,
          stage: "error" as const,
          // Validation errors mean no transaction was created.
          outcome: "failure" as Outcome,
          attributes: attrs([
            ["errorCount", t.length],
            ["codes", uniq(t.map((x) => x.code))],
            ["attributes", uniq(t.map((x) => word(x.attribute)))],
          ]),
          source: { recordIndex: ctx.recordIndex, path: "errors" },
          ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
        }),
      ];
    }
    case "notification":
      return [notificationEvent(parsed, ctx)];
  }
}

function decodeErrors(parsed: BraintreeParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "graphql":
      return [
        ...parsed.payments.flatMap((p) => transactionErrors(paymentView(p), ctx, p.path)),
        ...(parsed.value.errors ?? []).map((e, i) => graphqlErrorDraft(e, i, ctx)),
      ];
    case "transaction":
      return transactionErrors(viewTxn(parsed.value), ctx, parsed.path);
    case "validation":
      return parsed.triples.map((t) => validationErrorDraft(t, ctx));
    case "notification": {
      if (parsed.value.kind !== "transaction_settlement_declined" || !parsed.entity) return [];
      const v = viewTxn(parsed.entity);
      const refs = references(v);
      return [
        settlementError(
          v,
          clean({
            sourceFormat: ctx.format,
            source: { recordIndex: ctx.recordIndex, path: parsed.entityPath },
            paymentReference: refs.paymentReference,
            attemptReference: v.id,
          }),
        ),
      ];
    }
  }
}

export const braintreeAdapter: ProviderAdapter<BraintreeParsed> = {
  id: PROVIDER,
  displayName: "Braintree",
  version: BRAINTREE_ADAPTER_VERSION,
  manifest: braintreeManifest,
  supportedFormats: [
    {
      id: F.graphql,
      description:
        "GraphQL API response (data with transactions and statusHistory, errors[].extensions with errorClass and legacyCode)",
    },
    {
      id: F.transaction,
      description:
        "Transaction snapshot: SDK object (snake_case or camelCase), SDK result with a transaction, or GraphQL Transaction/Refund",
    },
    {
      id: F.validation,
      description: "SDK result with validation errors (attribute, code, message)",
    },
    {
      id: F.notification,
      description: "Webhook notification parsed by a Braintree SDK (kind, timestamp, subject)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Only explicit transaction ids link events: the transaction's own ids
    // (legacy and GraphQL forms when both are present), the refunded
    // transaction and refund ids. Order ids can be reused across attempts.
    const keys = new Set<string>();
    if (event.paymentReference) keys.add(event.paymentReference);
    if (event.relatedReference) keys.add(event.relatedReference);
    const ids = event.attributes.correlationIds;
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === "string" && id) keys.add(id);
    // Dispute ids live in their own namespace; legacy ids can collide across object types.
    const dispute = event.attributes.disputeId;
    if (typeof dispute === "string" && dispute) keys.add(`dispute:${dispute}`);
    return [...keys];
  },
};

export * from "./catalog.js";
export default braintreeAdapter;
