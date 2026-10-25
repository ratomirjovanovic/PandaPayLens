/**
 * Verotel adapter.
 *
 * Supported input families:
 * - `verotel.flexpay.postback`  FlexPay postback key=value data (purchase success and the
 *                               10 documented `event` values), shared by all FlexPay brands
 * - `verotel.rum.postback`      VerotelRUM postback (`trn`, `trn_id`, `usercode`)
 * - `verotel.api.error`         Control Center API error envelope
 * - `verotel.api.transaction`   Control Center API transaction object
 * - `verotel.api.sale`          Control Center API sale object
 * - `verotel.api.action`        Control Center API action responses (HTTP 200 bodies)
 *
 * Recognized but not supported: `verotel.flexpay.request`, request URLs the
 * merchant builds (startorder, cancel-subscription, status request).
 *
 * Detection relies on field structure only. The FlexPay brands share one
 * protocol on different hosts, so hosts and brand names are never matched.
 */

import {
  decimalToMinor,
  lookup,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type LifecycleStage,
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
  API_DOC_URL,
  API_ERRORS,
  API_PAYMENT_METHODS,
  API_STATUS_FALLBACK,
  CANCELLED_BY,
  DECLINE_REASONS,
  FLEXPAY_PAYMENT_METHODS,
  FLEXPAY_REQUEST_PATHS,
  FLEXPAY_VERSIONS,
  IN_BODY_MESSAGES,
  INSTRUMENT_TYPES,
  POSTBACK_KINDS,
  POSTBACK_TYPES,
  REVERSAL_EXTENTS,
  REVERSAL_TYPES,
  RUM_COMMANDS,
  SALE_TYPES,
  SUBSCRIPTION_PHASES,
  SUBSCRIPTION_TYPES,
  TRANSACTION_SUBTYPES,
  TRANSACTION_TYPES,
  UNCANCELLED_BY,
  type CatalogEntry,
  type PostbackKind,
} from "./catalog.js";
import { verotelManifest, VEROTEL_ADAPTER_VERSION } from "./manifest.js";

export { verotelManifest, VEROTEL_ADAPTER_VERSION };

export const VEROTEL_FORMATS = {
  postback: "verotel.flexpay.postback",
  rumPostback: "verotel.rum.postback",
  apiError: "verotel.api.error",
  apiTransaction: "verotel.api.transaction",
  apiSale: "verotel.api.sale",
  apiAction: "verotel.api.action",
  flexpayRequest: "verotel.flexpay.request",
} as const;

// ---------------------------------------------------------------------------
// Helpers

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Obj, k: string) => Object.hasOwn(o, k);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const oneOf = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);

/** Form data arrives as strings, or string arrays for repeated keys. */
function isFlatStrings(o: Obj): boolean {
  return Object.values(o).every(
    (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
  );
}

/** Form families may arrive as form data, an HTTP body or a JSON dump of the fields. */
function jsonTransport(meta: RecordMeta | undefined): boolean {
  return meta?.format !== "form";
}

const SIGNATURE_HEX = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

/**
 * A pasted full URL (`https://host/path?saleID=1&...`) arrives as form data
 * whose first key still holds the URL prefix. Split that prefix off so the
 * first parameter is usable. Only the path is kept, internally, to recognize
 * documented request paths; the host is discarded.
 */
function unwrapUrl(input: Obj): { fields: Obj; path?: string } {
  const urlKeys = Object.keys(input).filter((k) => k.includes("?"));
  if (urlKeys.length !== 1) return { fields: input };
  const key = urlKeys[0]!;
  const i = key.lastIndexOf("?");
  const name = key.slice(i + 1);
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) || has(input, name)) return { fields: input };
  const prefix = key.slice(0, i);
  const path = prefix.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").toLowerCase();
  const fields: Obj = {};
  for (const [k, v] of Object.entries(input)) fields[k === key ? name : k] = v;
  return { fields, ...(path ? { path } : {}) };
}

function isDocumentedPath(path: string | undefined): boolean {
  if (!path) return false;
  return FLEXPAY_REQUEST_PATHS.some((p) => path === p || path.endsWith(p));
}

/** Booleans are documented as strings in some tables and as booleans in examples. */
function boolish(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "1") return true;
    if (t === "false" || t === "no" || t === "0") return false;
  }
  return undefined;
}

/** Ids are numbers in the API tables and sometimes strings in the examples. */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  return safeId(v, 64);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : undefined);
const period = (v: unknown) =>
  typeof v === "string" && /^P[0-9A-Z]{1,12}$/.test(v) ? v : undefined;
const documented = (list: readonly string[], v: unknown) =>
  typeof v === "string" && list.includes(v) ? v : undefined;

function signatureClass(sig: unknown): string {
  if (typeof sig !== "string" || sig === "") return "absent";
  if (/^[0-9a-f]{64}$/i.test(sig)) return "present_sha256_length";
  if (/^[0-9a-f]{40}$/i.test(sig)) return "present_sha1_length";
  return "present_other";
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(values: Record<string, SafePrimitive | SafePrimitive[] | undefined>): Attrs {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Attrs;
}

function money(amount: unknown, currency: unknown) {
  const cur = upperCurrency(currency);
  const amountMinor = decimalToMinor(amount, cur);
  return { amountMinor, currency: amountMinor !== undefined ? cur : undefined };
}

function retryAfter(meta: RecordMeta | undefined): number | undefined {
  const v = meta?.http?.headers["retry-after"];
  return v !== undefined && /^\d{1,6}$/.test(v) ? Number(v) : undefined;
}

// ---------------------------------------------------------------------------
// Detection

const ACTION_KEYS = new Set([
  "is_success",
  "sale_id",
  "refund_transaction_id",
  "new_expiration_date",
  "error",
  "warning",
]);

function bodyStatus(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\d{3}$/.test(v)) return Number(v);
  return undefined;
}

function findApiError(status: number, title: string) {
  return API_ERRORS.find((e) => e.status === status && e.match.test(title.trim()));
}

function detectJson(input: Obj, meta: RecordMeta | undefined): DetectionResult | null {
  const base = { provider: "verotel", supported: true };

  // Control Center API error envelope.
  const err = input.error;
  if (
    isObj(err) &&
    typeof err.title === "string" &&
    bodyStatus(err.status) !== undefined &&
    typeof err.documentation === "string"
  ) {
    const status = bodyStatus(err.status)!;
    let c = 0.55;
    const reasons = ["error object with documentation, status and title"];
    if (
      findApiError(status, err.title) ||
      API_ERRORS.some((e) => e.match.test(err.title as string))
    ) {
      c += 0.2;
      reasons.push("title is a documented Control Center API error title");
    }
    if (/^https:\/\/[^/\s]+\/api-doc\//.test(err.documentation)) {
      c += 0.1;
      reasons.push("documentation points to an /api-doc/ page");
    }
    if (meta?.http?.status !== undefined && meta.http.status === status) c += 0.1;
    return { ...base, format: VEROTEL_FORMATS.apiError, confidence: round(c), reasons };
  }

  // Transaction object.
  if (
    oneOf(Object.keys(TRANSACTION_TYPES), input.transaction_type) &&
    has(input, "transaction_subtype")
  ) {
    let c = 0.5;
    const reasons = ["transaction_type DEBIT/CREDIT/CHARGEBACK with transaction_subtype"];
    if (oneOf(TRANSACTION_SUBTYPES, input.transaction_subtype)) {
      c += 0.15;
      reasons.push("transaction_subtype is a documented value");
    }
    if (oneOf(REVERSAL_EXTENTS, input.reversal_extent)) {
      c += 0.15;
      reasons.push("has reversal_extent");
    }
    if (has(input, "original_debit_transaction_id")) c += 0.1;
    if (isObj(input.sale) && has(input.sale, "id")) c += 0.05;
    if (isObj(input.payment_instrument)) c += 0.05;
    return { ...base, format: VEROTEL_FORMATS.apiTransaction, confidence: round(c), reasons };
  }

  // Sale object.
  if (oneOf(SALE_TYPES, input.sale_type) && has(input, "id") && has(input, "website_id")) {
    let c = 0.6;
    const reasons = ["sale_type PURCHASE/SUBSCRIPTION with id and website_id"];
    const sub = input.subscription;
    if (isObj(sub) && (has(sub, "is_recurring") || has(sub, "next_charge_on"))) {
      c += 0.2;
      reasons.push("subscription object with is_recurring / next_charge_on");
    }
    if (has(input, "is_approved")) c += 0.1;
    return { ...base, format: VEROTEL_FORMATS.apiSale, confidence: round(c), reasons };
  }

  // Action responses: only the documented keys, with is_success.
  if (
    typeof input.is_success === "boolean" &&
    Object.keys(input).every((k) => ACTION_KEYS.has(k)) &&
    (has(input, "sale_id") || has(input, "refund_transaction_id"))
  ) {
    let c: number;
    const reasons: string[] = [];
    if (has(input, "refund_transaction_id")) {
      c = 0.65;
      reasons.push("is_success with refund_transaction_id, like a refund action response");
      if (isObj(input.warning) && typeof input.warning.message === "string") c += 0.1;
    } else if (has(input, "new_expiration_date")) {
      c = 0.7;
      reasons.push(
        "is_success with sale_id and new_expiration_date, like an extend action response",
      );
    } else {
      c = 0.55;
      reasons.push("is_success with sale_id, like a downgrade or terminate action response");
      if (isObj(input.error) && typeof input.error.message === "string") c += 0.1;
    }
    return { ...base, format: VEROTEL_FORMATS.apiAction, confidence: round(c), reasons };
  }
  return null;
}

function detectForm(input: Obj): DetectionResult | null {
  const base = { provider: "verotel" };
  if (!isFlatStrings(input)) return null;
  const { fields: f, path } = unwrapUrl(input);
  const s = (k: string) => str(f[k]);

  // Request URLs built by the merchant carry `version`; postbacks never do.
  if (has(f, "version") && has(f, "shopID")) {
    let c = 0.45;
    const reasons = ["has version and shopID like a FlexPay request"];
    if (oneOf(FLEXPAY_VERSIONS, s("version"))) {
      c += 0.15;
      reasons.push("version is a documented FlexPay protocol version");
    }
    if (SIGNATURE_HEX.test(s("signature") ?? "")) {
      c += 0.15;
      reasons.push("signature has the length of a SHA-1 or SHA-256 hex signature");
    }
    if (isDocumentedPath(path)) {
      c += 0.2;
      reasons.push("URL path is a documented FlexPay request path");
    }
    if (oneOf(POSTBACK_TYPES, s("type")) || has(f, "saleID") || has(f, "referenceID")) c += 0.05;
    return {
      ...base,
      format: VEROTEL_FORMATS.flexpayRequest,
      confidence: round(c),
      supported: false,
      reasons,
      unsupportedReason:
        "This looks like a FlexPay request URL built by the merchant (startorder, cancel-subscription or status request). It carries no outcome and its signature is not checked. Paste the postback Verotel sent, or the Control Center API transaction, instead.",
    };
  }

  if (has(f, "saleID") && has(f, "shopID")) {
    let c = 0.45;
    const reasons = ["has saleID and shopID"];
    const type = s("type");
    if (oneOf(POSTBACK_TYPES, type)) {
      c += 0.2;
      reasons.push(`type "${type}" is a documented postback type`);
    }
    const event = s("event");
    if (event !== undefined && lookup(POSTBACK_KINDS, `${type}.${event}`)) {
      c += 0.15;
      reasons.push(`event "${event}" is a documented ${type} postback event`);
    }
    if (SIGNATURE_HEX.test(s("signature") ?? "")) {
      c += 0.15;
      reasons.push("signature has the length of a SHA-1 or SHA-256 hex signature");
    }
    const markers = [
      oneOf(SUBSCRIPTION_TYPES, s("subscriptionType")),
      oneOf(SUBSCRIPTION_PHASES, s("subscriptionPhase")),
      oneOf(CANCELLED_BY, s("cancelledBy")),
      has(f, "uncancelledBy"),
      has(f, "precededBySaleID"),
      has(f, "parentID"),
      has(f, "transactionID"),
      DATE.test(s("nextChargeOn") ?? s("expiresOn") ?? ""),
      has(f, "priceAmount"),
    ].filter(Boolean).length;
    c += Math.min(markers * 0.03, 0.1);
    return {
      ...base,
      format: VEROTEL_FORMATS.postback,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  if (has(f, "trn") && has(f, "trn_id") && lookup(RUM_COMMANDS, s("trn"))) {
    let c = 0.4;
    const reasons = [`trn "${s("trn")}" is a documented Remote User Manager command, with trn_id`];
    if (has(f, "usercode")) {
      c += 0.25;
      reasons.push("has usercode");
    }
    if (has(f, "passcode")) c += 0.15;
    if (has(f, "custom1")) c += 0.05;
    return {
      ...base,
      format: VEROTEL_FORMATS.rumPostback,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }
  return null;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: "verotel",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  if (jsonTransport(meta)) {
    const j = detectJson(input, meta);
    if (j) return j;
  }
  return detectForm(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing

const opt = (max: number) => z.string().max(max).optional();
// API tables and examples disagree on optional fields; null is accepted too.
const optN = (max: number) => z.string().max(max).nullish();
const idLike = z.union([z.string().max(64), z.number()]);
const amountLike = z.union([z.string().max(32), z.number()]);
const boolLike = z.union([z.boolean(), z.string().max(8)]);

const Postback = z.looseObject({
  saleID: z.string().min(1).max(64),
  shopID: z.string().min(1).max(64),
  type: z.string().min(1).max(32),
  event: opt(32),
  transactionID: opt(64),
  parentID: opt(64),
  precededBySaleID: opt(64),
  referenceID: opt(256),
  priceAmount: opt(32),
  priceCurrency: opt(8),
  amount: opt(32),
  currency: opt(8),
  trialAmount: opt(32),
  trialPeriod: opt(16),
  period: opt(16),
  subscriptionType: opt(32),
  subscriptionPhase: opt(32),
  cancelledBy: opt(32),
  uncancelledBy: opt(32),
  nextChargeOn: opt(32),
  expiresOn: opt(32),
  paymentMethod: opt(32),
  CCBrand: opt(64),
  signature: opt(256),
});

const RumPostback = z.looseObject({
  trn: z.string().min(1).max(32),
  trn_id: z.string().min(1).max(64),
});

const ApiError = z.looseObject({
  error: z.looseObject({
    documentation: z.string().max(2048),
    status: z.union([z.number().int(), z.string().regex(/^\d{3}$/)]),
    title: z.string().max(2000),
  }),
});

const Price = z.looseObject({ amount: amountLike.nullish(), currency: optN(8) });

const Transaction = z.looseObject({
  id: idLike,
  created_at: optN(64),
  website_id: idLike.nullish(),
  transaction_type: z.string().max(32),
  transaction_subtype: z.string().max(32),
  is_approved: boolLike.nullish(),
  is_testing: boolLike.nullish(),
  payment_method: optN(32),
  price: Price.optional(),
  payment_instrument: z.looseObject({ type: optN(32) }).optional(),
  decline_reason: z
    .looseObject({
      id: idLike.nullish(),
      category: optN(64),
      description: optN(2000),
    })
    .nullable()
    .optional(),
  reversal_extent: optN(16),
  reversals: z
    .array(
      z.looseObject({
        id: idLike.nullish(),
        transaction_id: idLike.nullish(),
        type: optN(32),
      }),
    )
    .max(1000)
    .nullable()
    .optional(),
  original_debit_transaction_id: idLike.nullable().optional(),
  sale: z
    .looseObject({ id: idLike.nullish(), type: optN(32), reference_id: optN(256) })
    .nullable()
    .optional(),
});

const Sale = z.looseObject({
  id: idLike,
  website_id: idLike,
  sale_type: z.string().max(32),
  price: Price.nullable().optional(),
  reference_id: optN(256),
  created_at: optN(64),
  payment_method: optN(32),
  is_approved: boolLike.nullish(),
  is_testing: boolLike.nullish(),
  subscription: z
    .looseObject({
      is_recurring: boolLike.nullish(),
      period: optN(16),
      is_expired: boolLike.nullish(),
      next_charge_on: optN(64),
      is_cancelled: boolLike.nullish(),
      expiration_date: optN(64),
    })
    .nullable()
    .optional(),
});

const Message = z.looseObject({ message: z.string().max(2000) });

const Action = z.looseObject({
  is_success: z.boolean(),
  sale_id: idLike.nullish(),
  refund_transaction_id: idLike.nullish(),
  new_expiration_date: optN(64),
  error: Message.optional(),
  warning: Message.optional(),
});

export type VerotelParsed =
  | { kind: "postback"; value: z.infer<typeof Postback> }
  | { kind: "rum"; value: z.infer<typeof RumPostback> }
  | { kind: "api_error"; value: z.infer<typeof ApiError> }
  | { kind: "transaction"; value: z.infer<typeof Transaction> }
  | { kind: "sale"; value: z.infer<typeof Sale> }
  | { kind: "action"; value: z.infer<typeof Action> };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

const SCHEMAS = {
  [VEROTEL_FORMATS.postback]: ["postback", Postback],
  [VEROTEL_FORMATS.rumPostback]: ["rum", RumPostback],
  [VEROTEL_FORMATS.apiError]: ["api_error", ApiError],
  [VEROTEL_FORMATS.apiTransaction]: ["transaction", Transaction],
  [VEROTEL_FORMATS.apiSale]: ["sale", Sale],
  [VEROTEL_FORMATS.apiAction]: ["action", Action],
} as const;

function parse(
  input: unknown,
  format: string,
): { ok: true; value: VerotelParsed } | { ok: false; issues: string[] } {
  if (!isObj(input))
    return { ok: false, issues: ["(root): expected an object or a set of fields"] };
  const entry = lookup(
    SCHEMAS as unknown as Record<string, readonly [VerotelParsed["kind"], z.ZodType]>,
    format,
  );
  if (!entry) return { ok: false, issues: [`Unsupported Verotel format "${format}".`] };
  const [kind, schema] = entry;
  const value = kind === "postback" || kind === "rum" ? unwrapUrl(input).fields : input;
  const r = schema.safeParse(value);
  if (!r.success) return { ok: false, issues: issuesOf(r.error) };
  return { ok: true, value: { kind, value: r.data } as VerotelParsed };
}

// ---------------------------------------------------------------------------
// Normalization

function base(ctx: NormalizeContext) {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

type Money = { amountMinor?: string | undefined; currency?: string | undefined };

function postbackAmount(
  kind: PostbackKind | undefined,
  p: z.infer<typeof Postback>,
): { m: Money; extra: Record<string, SafePrimitive | undefined> } {
  const price = money(p.priceAmount, p.priceCurrency);
  const alt = money(p.amount, p.currency);
  switch (kind?.amount) {
    case "rebill":
      return { m: alt.amountMinor !== undefined ? alt : price, extra: {} };
    case "initial": {
      if (p.trialAmount !== undefined && p.trialAmount !== "") {
        const trial = money(p.trialAmount, p.priceCurrency);
        return {
          m: trial,
          extra: { amountBasis: "trialAmount", recurringPriceMinor: price.amountMinor },
        };
      }
      return { m: price, extra: {} };
    }
    case "new_price":
      return {
        m: {},
        extra: { newRebillAmountMinor: alt.amountMinor, newRebillCurrency: alt.currency },
      };
    case "none":
      return { m: {}, extra: {} };
    case "price":
      return { m: price.amountMinor !== undefined ? price : alt, extra: {} };
    default:
      return { m: {}, extra: {} };
  }
}

function normalizePostback(
  p: z.infer<typeof Postback>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const type = safeId(p.type, 32);
  const event = p.event !== undefined && p.event !== "" ? safeId(p.event, 32) : undefined;
  const kindKey = event ? `${type ?? "unknown"}.${event}` : (type ?? "unknown");
  const kind = lookup(POSTBACK_KINDS, kindKey);
  const saleId = safeId(p.saleID, 64);
  const transactionId = safeId(p.transactionID, 64);
  const { m, extra } = postbackAmount(kind, p);
  const subscriptionType = documented(SUBSCRIPTION_TYPES, p.subscriptionType);
  const phase = documented(SUBSCRIPTION_PHASES, p.subscriptionPhase);
  const isSubscription = type === "subscription";
  const statusParts = [
    `type=${type ?? "?"}`,
    event ? `event=${event}` : undefined,
    phase ? `subscriptionPhase=${phase}` : undefined,
  ].filter(Boolean);
  const reasonUnknown = kind?.event === "expiry" || kind?.event === "extend";

  return clean({
    ...base(ctx),
    eventType: kindKey,
    eventTypeKnown: Boolean(kind),
    stage: kind?.stage ?? "other",
    providerStatus: statusParts.join("; "),
    paymentReference: saleId,
    relatedReference: transactionId,
    merchantReference: safeId(p.referenceID, 256),
    subscriptionReference: isSubscription ? saleId : undefined,
    isRecurring: kind?.isRecurring,
    // No event id exists. A transactionID identifies one money movement, so
    // kind + sale + transaction identifies one business event. Postbacks
    // without a transactionID have no reliable key.
    deliveryKey:
      kind && saleId && transactionId ? `${kindKey}:${saleId}:${transactionId}` : undefined,
    amountMinor: m.amountMinor,
    currency: m.currency,
    outcome: kind?.outcome ?? "unknown",
    attributes: attrs({
      type,
      event,
      saleId,
      transactionId,
      parentTransactionId: safeId(p.parentID, 64),
      precedingSaleId: safeId(p.precededBySaleID, 64),
      shopId: safeId(p.shopID, 64),
      subscriptionType,
      subscriptionPhase: phase,
      cancelledBy: documented(CANCELLED_BY, p.cancelledBy),
      uncancelledBy: documented(UNCANCELLED_BY, p.uncancelledBy),
      nextChargeOn: date(p.nextChargeOn),
      expiresOn: date(p.expiresOn),
      period: period(p.period),
      trialPeriod: period(p.trialPeriod),
      paymentMethod: documented(FLEXPAY_PAYMENT_METHODS, p.paymentMethod),
      cardBrand: safeText(p.CCBrand, 32),
      oneClickTokenIssued:
        typeof p.oneClickToken === "string" && p.oneClickToken !== "" ? true : undefined,
      signature: signatureClass(p.signature),
      ...(reasonUnknown ? { reasonInPayload: false } : {}),
      ...extra,
    }),
  });
}

function normalizeRum(r: z.infer<typeof RumPostback>, ctx: NormalizeContext): NormalizedEventDraft {
  const trn = safeId(r.trn, 32);
  const cmd = lookup(RUM_COMMANDS, trn);
  const trnId = safeId(r.trn_id, 64);
  return clean({
    ...base(ctx),
    eventType: `rum.${trn ?? "unknown"}`,
    eventTypeKnown: Boolean(cmd),
    stage: cmd?.stage ?? "other",
    providerStatus: `trn=${trn ?? "?"}`,
    paymentReference: trnId,
    isRecurring: cmd?.isRecurring,
    // RUM retries are documented; add and rebill each stand for one transaction.
    deliveryKey: cmd?.transactional && trnId ? `rum.${trn}:${trnId}` : undefined,
    outcome: cmd?.outcome ?? "unknown",
    attributes: attrs({ trn, rumTransactionId: trnId }),
  });
}

function approvedOutcome(v: unknown): Outcome {
  const b = boolish(v);
  return b === undefined ? "unknown" : b ? "success" : "failure";
}

function normalizeTransaction(
  t: z.infer<typeof Transaction>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const typeInfo = lookup(TRANSACTION_TYPES, t.transaction_type);
  const txType = safeId(t.transaction_type, 32) ?? "unknown";
  const subtype = safeId(t.transaction_subtype, 32);
  const saleId = idOf(t.sale?.id);
  const id = idOf(t.id);
  const saleType = documented(SALE_TYPES, t.sale?.type);
  const reversalIds = (t.reversals ?? [])
    .map((r) => idOf(r.id ?? r.transaction_id))
    .filter((x): x is string => Boolean(x));
  const reversalTypes = (t.reversals ?? [])
    .map((r) => documented(REVERSAL_TYPES, r.type))
    .filter((x): x is string => Boolean(x));
  const stage: LifecycleStage = typeInfo?.stage ?? "other";
  const outcome: Outcome =
    !typeInfo || stage === "dispute" ? "unknown" : approvedOutcome(t.is_approved);
  const approved = boolish(t.is_approved);
  return clean({
    ...base(ctx),
    eventType: `transaction.${txType}`,
    eventTypeKnown: Boolean(typeInfo),
    stage,
    providerStatus: [
      `transaction_type=${txType}`,
      subtype ? `transaction_subtype=${subtype}` : undefined,
      approved !== undefined ? `is_approved=${approved}` : undefined,
    ]
      .filter(Boolean)
      .join("; "),
    paymentReference: saleId,
    relatedReference: id,
    merchantReference: safeId(t.sale?.reference_id, 256),
    subscriptionReference: saleType === "SUBSCRIPTION" ? saleId : undefined,
    eventTimestamp: toIsoTimestamp(t.created_at),
    ...money(t.price?.amount, t.price?.currency),
    outcome,
    attributes: attrs({
      transactionType: txType,
      // Shown raw: subtype meanings are not documented.
      transactionSubtype: subtype,
      saleId,
      saleType,
      transactionId: id,
      originalDebitTransactionId: idOf(t.original_debit_transaction_id),
      reversalExtent: documented(REVERSAL_EXTENTS, t.reversal_extent),
      reversalTransactionIds: reversalIds.length ? reversalIds : undefined,
      reversalTypes: reversalTypes.length ? reversalTypes : undefined,
      paymentMethod: documented(API_PAYMENT_METHODS, t.payment_method),
      instrumentType: documented(INSTRUMENT_TYPES, t.payment_instrument?.type),
      shopId: idOf(t.website_id),
      testMode: boolish(t.is_testing),
    }),
  });
}

function normalizeSale(s: z.infer<typeof Sale>, ctx: NormalizeContext): NormalizedEventDraft {
  const saleType = documented(SALE_TYPES, s.sale_type);
  const id = idOf(s.id);
  const sub = s.subscription ?? undefined;
  const approved = boolish(s.is_approved);
  return clean({
    ...base(ctx),
    eventType: `sale.${saleType ?? safeId(s.sale_type, 32) ?? "unknown"}`,
    eventTypeKnown: Boolean(saleType),
    stage: "payment",
    providerStatus: `sale_type=${saleType ?? "?"}${approved !== undefined ? `; is_approved=${approved}` : ""}`,
    paymentReference: id,
    merchantReference: safeId(s.reference_id, 256),
    subscriptionReference: saleType === "SUBSCRIPTION" ? id : undefined,
    eventTimestamp: toIsoTimestamp(s.created_at),
    ...money(s.price?.amount, s.price?.currency),
    outcome: saleType ? approvedOutcome(s.is_approved) : "unknown",
    attributes: attrs({
      saleId: id,
      saleType,
      shopId: idOf(s.website_id),
      paymentMethod: documented(API_PAYMENT_METHODS, s.payment_method),
      testMode: boolish(s.is_testing),
      subscriptionRecurring: boolish(sub?.is_recurring),
      subscriptionCancelled: boolish(sub?.is_cancelled),
      subscriptionExpired: boolish(sub?.is_expired),
      period: period(sub?.period),
      nextChargeOn: safeText(sub?.next_charge_on, 32),
      expirationDate: safeText(sub?.expiration_date, 32),
    }),
  });
}

function actionOperation(a: z.infer<typeof Action>): string {
  if (a.refund_transaction_id != null) return "refund";
  if (a.new_expiration_date != null) return "extend";
  // Only the terminate response documents error.message.
  if (a.error !== undefined) return "terminate";
  return "downgrade_or_terminate";
}

function normalizeAction(a: z.infer<typeof Action>, ctx: NormalizeContext): NormalizedEventDraft {
  const op = actionOperation(a);
  const saleId = idOf(a.sale_id);
  const refundId = idOf(a.refund_transaction_id);
  return clean({
    ...base(ctx),
    eventType: `action.${op}`,
    eventTypeKnown: true,
    stage: op === "refund" ? "refund" : "subscription",
    providerStatus: `is_success=${a.is_success}`,
    paymentReference: saleId,
    relatedReference: refundId,
    subscriptionReference: op === "extend" ? saleId : undefined,
    outcome: a.is_success ? "success" : "failure",
    attributes: attrs({
      operation: op,
      saleId,
      transactionId: refundId,
      newExpirationDate: safeText(a.new_expiration_date, 32),
      warning: a.warning !== undefined ? true : undefined,
    }),
  });
}

function apiErrorEvent(e: z.infer<typeof ApiError>, ctx: NormalizeContext): NormalizedEventDraft {
  const status = bodyStatus(e.error.status)!;
  const known = lookup(API_STATUS_FALLBACK, String(status)) !== undefined;
  const wait = retryAfter(ctx.meta);
  return clean({
    ...base(ctx),
    eventType: `api_error.${status}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: `HTTP ${status}`,
    // A documented 4xx means the request was rejected; anything else leaves
    // the outcome of the original request open.
    outcome: known ? "failure" : "unknown",
    attributes: attrs({
      status,
      title: safeText(e.error.title, 200),
      retryAfterSeconds: wait,
    }),
  });
}

function normalize(parsed: VerotelParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "postback":
      return [normalizePostback(parsed.value, ctx)];
    case "rum":
      return [normalizeRum(parsed.value, ctx)];
    case "transaction":
      return [normalizeTransaction(parsed.value, ctx)];
    case "sale":
      return [normalizeSale(parsed.value, ctx)];
    case "action":
      return [normalizeAction(parsed.value, ctx)];
    case "api_error":
      return [apiErrorEvent(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding

const API_DOCS: DocumentationLink[] = [{ title: "Verotel Control Center API", url: API_DOC_URL }];

const UNKNOWN_API_ENTRY: CatalogEntry = {
  meaning: "Undocumented HTTP status",
  category: "unknown",
  retry: "unknown",
  explanation:
    "This HTTP status is not among the statuses the Control Center API documents (401, 404, 406, 412, 429).",
  nextAction:
    "Before repeating a POST action (cancel, downgrade, extend, terminate, refund), check the sale or transaction with GET /sale/:id or GET /transaction/:id: the original request may have taken effect.",
  retryExplanation:
    "Retry safety cannot be assessed for an undocumented status. Verify the current state first so that an action such as a refund is not performed twice.",
  confidence: "insufficient",
};

export type ApiErrorDecoding = {
  id: string | null;
  entry: CatalogEntry;
  confidence: Confidence;
  missing: string[];
};

/** Decodes a Control Center API error by HTTP status and title. */
export function decodeApiError(status: number, title: string): ApiErrorDecoding {
  const t = title.trim();
  const exact = findApiError(status, t);
  if (exact) return { id: exact.id, entry: exact, confidence: exact.confidence, missing: [] };
  const fallback = lookup(API_STATUS_FALLBACK, String(status));
  const titleOnly = API_ERRORS.find((e) => e.match.test(t));
  if (titleOnly) {
    return {
      id: titleOnly.id,
      entry: titleOnly,
      confidence: "possible",
      missing: [
        `The title is documented for HTTP ${titleOnly.status}, but the response says HTTP ${status}.`,
      ],
    };
  }
  if (fallback) {
    return {
      id: null,
      entry: fallback,
      confidence: fallback.confidence,
      missing: [
        "The title is not one of the published Control Center API titles; the HTTP status meaning is used.",
      ],
    };
  }
  return {
    id: null,
    entry: UNKNOWN_API_ENTRY,
    confidence: "insufficient",
    missing: [`HTTP status ${status} is not in the PandaPayLens catalog for Verotel.`],
  };
}

function draft(
  ctx: NormalizeContext,
  code: string,
  entry: CatalogEntry,
  confidence: Confidence,
  opts: {
    subCodes?: Record<string, string>;
    message?: string;
    missing?: string[];
    docs?: DocumentationLink[];
    paymentReference?: string;
    attemptReference?: string;
    outcomeKnown?: boolean;
    explanation?: string;
    retryExplanation?: string;
  } = {},
): DecodedErrorDraft {
  const providerMessage = safeText(opts.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code,
    subCodes: opts.subCodes ?? {},
    category: entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: opts.explanation ?? entry.explanation,
    nextAction: entry.nextAction,
    retry: entry.retry,
    retryExplanation: opts.retryExplanation ?? entry.retryExplanation,
    confidence,
    documentation: opts.docs ?? API_DOCS,
    missingInformation: opts.missing ?? [],
    ...(opts.paymentReference ? { paymentReference: opts.paymentReference } : {}),
    ...(opts.attemptReference ? { attemptReference: opts.attemptReference } : {}),
    ...(opts.outcomeKnown !== undefined ? { outcomeKnown: opts.outcomeKnown } : {}),
  };
}

function decodeErrors(parsed: VerotelParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "api_error") {
    const e = parsed.value.error;
    const status = bodyStatus(e.status)!;
    const d = decodeApiError(status, e.title);
    const missing = [...d.missing];
    let retryExplanation = d.entry.retryExplanation;
    const httpStatus = ctx.meta?.http?.status;
    if (httpStatus !== undefined && httpStatus !== status)
      missing.push(
        `The HTTP response status (${httpStatus}) differs from the body's status (${status}).`,
      );
    if (status === 429) {
      const wait = retryAfter(ctx.meta);
      if (wait !== undefined)
        retryExplanation = `${retryExplanation} Retry-After: ${wait} seconds.`;
      else
        missing.push(
          "The Retry-After header is not part of the supplied body; check the response headers for how long to wait.",
        );
    }
    const subCodes: Record<string, string> = { httpStatus: String(status) };
    if (d.id) subCodes.title = d.id;
    return [
      draft(ctx, String(status), d.entry, d.confidence, {
        subCodes,
        message: e.title,
        missing,
        retryExplanation,
        // A documented 4xx rejection means the action was not performed.
        outcomeKnown: lookup(API_STATUS_FALLBACK, String(status)) !== undefined,
      }),
    ];
  }

  if (parsed.kind === "transaction") {
    const t = parsed.value;
    const reason = t.decline_reason;
    if (!reason) return [];
    const code = reason.category ?? (reason.id != null ? String(reason.id) : undefined);
    const saleId = idOf(t.sale?.id);
    const txId = idOf(t.id);
    const refs = {
      ...((saleId ?? txId) ? { paymentReference: saleId ?? txId } : {}),
      ...(txId ? { attemptReference: txId } : {}),
    };
    const known = code !== undefined ? lookup(DECLINE_REASONS, code) : undefined;
    const shown = safeText(code, 40) ?? "";
    const missing: string[] = [];
    if (reason.category == null && reason.id != null)
      missing.push(
        "The decline reason has an id but no category. The API table names the field id while the published example uses category; the value is decoded the same way.",
      );
    if (known) {
      return [
        draft(ctx, shown, known, "strong", {
          subCodes: { field: "decline_reason", decline_code: shown },
          ...(reason.description ? { message: reason.description } : {}),
          missing,
          ...refs,
          outcomeKnown: true,
        }),
      ];
    }
    return [
      draft(
        ctx,
        shown || "decline_reason",
        {
          meaning: "Undocumented decline category",
          category: "unknown",
          retry: "unknown",
          explanation:
            "The transaction was declined (decline_reason is present), but its category is not documented. Verotel publishes only NO_FUNDS.",
          nextAction:
            "Read the description and check the transaction in the Verotel Control Center.",
          retryExplanation:
            "Without a documented meaning, PandaPayLens cannot say whether a retry could succeed.",
          confidence: "insufficient",
        },
        "insufficient",
        {
          subCodes: { field: "decline_reason", ...(shown ? { decline_code: shown } : {}) },
          ...(reason.description ? { message: reason.description } : {}),
          missing: [
            ...missing,
            `Decline category "${shown}" is not documented; the full list of Verotel decline categories is not public.`,
          ],
          ...refs,
          outcomeKnown: true,
        },
      ),
    ];
  }

  if (parsed.kind === "action") {
    const a = parsed.value;
    const saleId = idOf(a.sale_id);
    const out: DecodedErrorDraft[] = [];
    for (const [field, msg] of [
      ["error", a.error?.message],
      ["warning", a.warning?.message],
    ] as const) {
      if (msg === undefined) continue;
      const entry = IN_BODY_MESSAGES.find((m) => m.match.test(msg.trim()));
      const op = actionOperation(a);
      if (entry) {
        out.push(
          draft(ctx, entry.id, entry, entry.confidence, {
            subCodes: { field: `${field}.message`, operation: op, isSuccess: String(a.is_success) },
            message: msg,
            ...(saleId ? { paymentReference: saleId } : {}),
            outcomeKnown: true,
          }),
        );
        continue;
      }
      out.push(
        draft(
          ctx,
          `${field}.message`,
          {
            meaning: "Undocumented action message",
            category: "unknown",
            retry: a.is_success ? "do_not_retry" : "unknown",
            explanation: a.is_success
              ? "The action succeeded (is_success=true) with an undocumented warning."
              : "The action failed (is_success=false) with an undocumented message.",
            nextAction: "Read the message and check the sale or transaction with a GET request.",
            retryExplanation: a.is_success
              ? "The action already succeeded; repeating it could, for a refund, refund twice."
              : "Without a documented meaning, PandaPayLens cannot say whether repeating the action is safe. Check the current state first.",
            confidence: "insufficient",
          },
          "insufficient",
          {
            subCodes: { field: `${field}.message`, operation: op, isSuccess: String(a.is_success) },
            message: msg,
            missing: ["This message is not one of the documented in-body action messages."],
            ...(saleId ? { paymentReference: saleId } : {}),
            outcomeKnown: true,
          },
        ),
      );
    }
    return out;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Correlation

const SALE_KEYS = ["saleId", "precedingSaleId"] as const;
const TXN_KEYS = ["transactionId", "parentTransactionId", "originalDebitTransactionId"] as const;

function correlationKeys(event: NormalizedEvent): string[] {
  // Only Verotel sale and transaction ids. referenceID and custom1..3 are
  // merchant-chosen and may repeat, so they never link events. Sale and
  // transaction ids are namespaced because both are plain numbers.
  const a = event.attributes;
  const keys: string[] = [];
  for (const k of SALE_KEYS) if (typeof a[k] === "string") keys.push(`sale:${a[k]}`);
  for (const k of TXN_KEYS) if (typeof a[k] === "string") keys.push(`txn:${a[k]}`);
  const reversals = a.reversalTransactionIds;
  if (Array.isArray(reversals))
    for (const r of reversals) if (typeof r === "string") keys.push(`txn:${r}`);
  if (typeof a.rumTransactionId === "string") keys.push(`rum:${a.rumTransactionId}`);
  return keys;
}

export const verotelAdapter: ProviderAdapter<VerotelParsed> = {
  id: "verotel",
  displayName: "Verotel",
  version: VEROTEL_ADAPTER_VERSION,
  manifest: verotelManifest,
  supportedFormats: [
    {
      id: VEROTEL_FORMATS.postback,
      description: "FlexPay postback key=value data (saleID, shopID, type, event, signature)",
    },
    {
      id: VEROTEL_FORMATS.rumPostback,
      description: "VerotelRUM postback (trn, trn_id, usercode)",
    },
    {
      id: VEROTEL_FORMATS.apiError,
      description: "Control Center API error envelope { error: { documentation, status, title } }",
    },
    { id: VEROTEL_FORMATS.apiTransaction, description: "Control Center API transaction object" },
    { id: VEROTEL_FORMATS.apiSale, description: "Control Center API sale object" },
    { id: VEROTEL_FORMATS.apiAction, description: "Control Center API action response" },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys,
};

export * from "./catalog.js";
export default verotelAdapter;
