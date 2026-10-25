/**
 * MiFinity adapter (eWallet deposits and payouts).
 *
 * Supported input families:
 * - `mifinity.error`            Shared error envelope `{ errors: [{ type, errorCode, message }] }`
 * - `mifinity.deposit_callback` eWallet deposit callback (returnUrl / errorUrl)
 * - `mifinity.deposit_status`   Payment Status API response (`status`, `detailedStatus`)
 * - `mifinity.payout_status`    Payout callback or Transaction Status lookup (`transactionStatus`)
 * - `mifinity.payout_response`  Synchronous payout response (PAB, PAC, PMC, A2A, PAYC)
 *
 * Recognized but not supported: `mifinity.iframe_init` (a session token, not a
 * payment result).
 *
 * Item formats arrive bare or inside the `{ payload: [ ... ] }` envelope.
 *
 * A wallet deposit is a transfer from the customer's eWallet to the merchant,
 * shown as a `payment`; it is never a card authorization. Every payout,
 * including a wallet-to-wallet transfer, is a `payout`.
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
  A2A_URL,
  CARD_PAYOUT_API_URL,
  DEPOSIT_API_URL,
  DEPOSIT_CALLBACK_URL,
  DEPOSIT_STATUSES,
  DETAILED_STATUSES,
  ERROR_CODES,
  ERROR_CODES_URL,
  ERROR_TYPES,
  HTTP_RULES,
  HTTP_STATUS_URL,
  NEXT_ACTION,
  PAB_ERROR_CODES_URL,
  PAB_FLOW_URL,
  PAYC_API_URL,
  PAYC_STATUSES,
  PAYMENT_STATUS_URL,
  PAYOUT_CALLBACKS_URL,
  PAYOUT_PRODUCTS,
  RETRY_TEXT,
  REVERSED_STATUS,
  TRANSACTION_FAILED_HINTS,
  TRANSACTION_LIFECYCLE_URL,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_OLD_URL,
  TRANSACTION_STATUS_URL,
  WITHDRAWAL_CALLBACKS_URL,
  type ErrorMapping,
  type ErrorType,
} from "./catalog.js";

import { mifinityManifest, MIFINITY_ADAPTER_VERSION } from "./manifest.js";

export { mifinityManifest, MIFINITY_ADAPTER_VERSION };

const PROVIDER = "mifinity";

const NStr = (max: number) => z.string().max(max).nullable().optional();
const StatusNum = z
  .union([z.number().int(), z.string().max(16)])
  .nullable()
  .optional();

const Money = z.looseObject({
  amount: z
    .union([z.number(), z.string().max(40)])
    .nullable()
    .optional(),
  currency: NStr(8),
  presentationAmount: NStr(64),
  displayable: NStr(64),
});

const ErrorItem = z.looseObject({
  type: z.string().max(64),
  errorCode: z.string().max(64),
  message: NStr(2000),
  formObjectName: NStr(2000),
  field: NStr(2000),
  // The Error Codes page writes the key with a capital F.
  Field: NStr(2000),
});

const ErrorEnvelope = z.looseObject({ errors: z.array(ErrorItem).min(1).max(100) });

// Money objects drift between endpoints, so they are read defensively
// (see moneyOf) instead of failing the whole record.
const PayoutStatus = z
  .looseObject({
    transactionStatus: StatusNum,
    transactionStatusDescription: NStr(128),
    traceId: NStr(256),
    transactionReference: NStr(256),
    eventTypeDescription: NStr(128),
    paymentCategoryType: NStr(64),
    createdOn: NStr(64),
    postedOn: NStr(64),
    transactionLastUpdated: NStr(64),
    errorMessage: NStr(2000),
  })
  .superRefine((v, ctx) => {
    const hasStatus = v.transactionStatus !== undefined && v.transactionStatus !== null;
    if (!hasStatus && !v.transactionStatusDescription)
      ctx.addIssue({
        code: "custom",
        path: ["transactionStatus"],
        message: "transactionStatus or transactionStatusDescription is required",
      });
  });

const DepositCallback = z.looseObject({
  traceId: z.string().max(256),
  transactionReference: NStr(256),
  paymentType: NStr(64),
  paymentMethod: NStr(128),
  errorMessage: NStr(2000),
  detailedStatus: NStr(64),
});

const PaymentResponse = z.looseObject({
  traceId: NStr(256),
  transactionReference: NStr(256),
  paymentType: NStr(64),
  paymentMethod: NStr(128),
});

const DepositStatus = z.looseObject({
  status: z.string().max(64),
  detailedStatus: NStr(64),
  errorMessage: NStr(2000),
  paymentResponse: PaymentResponse.nullable().optional(),
});

const PayoutResponse = z
  .looseObject({
    traceId: NStr(256),
    transactionReference: NStr(256),
    datePosted: NStr(64),
    status: NStr(32),
    sameOwner: z.boolean().nullable().optional(),
    quoteReference: NStr(256),
    statusCode: StatusNum,
    statusMessage: NStr(128),
  })
  .superRefine((v, ctx) => {
    if (!v.traceId && !v.transactionReference && !v.quoteReference)
      ctx.addIssue({
        code: "custom",
        path: ["transactionReference"],
        message: "transactionReference, traceId or quoteReference is required",
      });
  });

type ErrorItemT = z.infer<typeof ErrorItem>;
type PayoutStatusT = z.infer<typeof PayoutStatus>;
type DepositCallbackT = z.infer<typeof DepositCallback>;
type DepositStatusT = z.infer<typeof DepositStatus>;
type PayoutResponseT = z.infer<typeof PayoutResponse>;

export type MifinityParsed =
  | { kind: "error"; value: z.infer<typeof ErrorEnvelope> }
  | { kind: "payout_status"; items: PayoutStatusT[]; envelope: boolean }
  | { kind: "deposit_callback"; items: DepositCallbackT[]; envelope: boolean }
  | { kind: "deposit_status"; items: DepositStatusT[]; envelope: boolean }
  | { kind: "payout_response"; items: PayoutResponseT[]; envelope: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Presentation strings put the currency code directly before the amount ("EUR10.00").
const PRESENTATION = /^[A-Z]{3}-?\d[\d,]*(?:\.\d+)?$/;
const EMBEDDED_CODE = /\bType:\s*([A-Za-z0-9_]{1,64})\b/;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.[\]]{0,63}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

/** Numeric status from a number or a digit string. */
function statusKey(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1000) return String(v);
  if (typeof v === "string" && /^\d{1,3}$/.test(v.trim())) return String(Number(v.trim()));
  return undefined;
}

function isMoney(v: unknown): boolean {
  if (!isObj(v)) return false;
  const p = v.presentationAmount ?? v.displayable;
  return typeof p === "string" && PRESENTATION.test(p.trim()) && "amount" in v;
}

const normProduct = (v: unknown) =>
  typeof v === "string" ? v.toLowerCase().replace(/[^a-z]/g, "") : undefined;

type ItemFormat =
  | "mifinity.payout_status"
  | "mifinity.deposit_status"
  | "mifinity.deposit_callback"
  | "mifinity.payout_response"
  | "mifinity.iframe_init";

function detectItem(
  item: Record<string, unknown>,
): { format: ItemFormat; score: number; reasons: string[] } | undefined {
  const traceId = str(item.traceId);
  const txRef = typeof item.transactionReference === "string" ? item.transactionReference : "";
  const uuidRef = UUID.test(txRef);

  // init-iframe response: a session token, not a payment result.
  const entry = item.iframeEntrypoint;
  if (typeof entry === "string" && entry.includes("/iframe2#initToken="))
    return {
      format: "mifinity.iframe_init",
      score: 0.85,
      reasons: ["iframeEntrypoint has the hosted /iframe2#initToken= form"],
    };
  if (typeof item.initializationToken === "string" && (traceId || "validationKey" in item))
    return {
      format: "mifinity.iframe_init",
      score: 0.7,
      reasons: ["has initializationToken with traceId or validationKey"],
    };

  // Payout callback or Transaction Status lookup.
  const ts = statusKey(item.transactionStatus);
  const desc = str(item.transactionStatusDescription);
  const descLower = desc?.toLowerCase();
  const knownDesc =
    descLower !== undefined &&
    (descLower === REVERSED_STATUS.label.toLowerCase() ||
      Object.values(TRANSACTION_STATUSES).some(
        (s) => s.label.toLowerCase() === descLower || s.conflict?.label.toLowerCase() === descLower,
      ));
  if (
    (ts !== undefined && desc !== undefined) ||
    (knownDesc && (traceId || txRef)) ||
    (ts !== undefined && traceId && txRef)
  ) {
    const reasons: string[] = [];
    let score = 0.3;
    if (ts !== undefined) {
      score += 0.15;
      reasons.push("has a numeric transactionStatus");
    }
    if (desc !== undefined) {
      score += knownDesc ? 0.2 : 0.05;
      reasons.push(
        knownDesc
          ? "transactionStatusDescription is a documented status label"
          : "has transactionStatusDescription",
      );
    }
    if (traceId) score += 0.1;
    if (uuidRef) {
      score += 0.1;
      reasons.push("transactionReference is a UUID");
    }
    if (isMoney(item.money)) {
      score += 0.1;
      reasons.push("money has a presentationAmount string");
    }
    if (
      (normProduct(item.eventTypeDescription) &&
        lookup(PAYOUT_PRODUCTS, normProduct(item.eventTypeDescription))) ||
      typeof item.paymentCategoryType === "string"
    ) {
      score += 0.1;
      reasons.push("has eventTypeDescription or paymentCategoryType");
    }
    if (typeof item.createdOn === "string" || typeof item.transactionLastUpdated === "string")
      score += 0.05;
    return { format: "mifinity.payout_status", score, reasons };
  }

  // Payment Status API: a generic `status` needs distinctive company.
  const status = typeof item.status === "string" ? item.status : undefined;
  if (status && lookup(DEPOSIT_STATUSES, status)) {
    const detailed = str(item.detailedStatus);
    const pr = isObj(item.paymentResponse) ? item.paymentResponse : undefined;
    const embedded = typeof item.errorMessage === "string" && EMBEDDED_CODE.test(item.errorMessage);
    if ((detailed && lookup(DETAILED_STATUSES, detailed)) || pr || embedded) {
      const reasons = [`status "${status}" is a documented deposit status`];
      let score = 0.7;
      if (detailed && lookup(DETAILED_STATUSES, detailed)) {
        score += 0.1;
        reasons.push("detailedStatus is a documented value");
      }
      if (pr && (str(pr.traceId) || UUID.test(String(pr.transactionReference ?? "")))) {
        score += 0.1;
        reasons.push("paymentResponse carries traceId or transactionReference");
      } else if (pr) reasons.push("has paymentResponse");
      if (embedded) reasons.push("errorMessage embeds a MiFinity error type");
      return { format: "mifinity.deposit_status", score, reasons };
    }
  }

  // Deposit callback: validationKey is the distinctive field.
  if ("validationKey" in item) {
    const detailed = str(item.detailedStatus);
    const knownDetailed = Boolean(detailed && lookup(DETAILED_STATUSES, detailed));
    if (traceId || knownDetailed) {
      const reasons = ["has validationKey"];
      let score = traceId ? 0.6 : 0.55;
      if (traceId) reasons.push("has traceId");
      if (isMoney(item.money) || isMoney(item.sourceMoney)) {
        score += 0.1;
        reasons.push("has a money object with a presentationAmount string");
      }
      if (typeof item.paymentType === "string") {
        score += 0.1;
        reasons.push("has paymentType");
      }
      if (knownDetailed) {
        score += 0.1;
        reasons.push("detailedStatus is a documented value");
      }
      if (uuidRef) score += 0.05;
      return { format: "mifinity.deposit_callback", score, reasons };
    }
  }

  // Synchronous payout responses.
  if (
    item.status === "OK" &&
    (traceId || txRef) &&
    (typeof item.sameOwner === "boolean" || isMoney(item.sourceMoney))
  )
    return {
      format: "mifinity.payout_response",
      score: typeof item.sameOwner === "boolean" ? 0.85 : 0.75,
      reasons: [
        "Account to Account response with status OK",
        "has traceId or transactionReference",
      ],
    };
  if (
    typeof item.quoteReference === "string" &&
    (item.statusCode !== undefined || typeof item.statusMessage === "string")
  )
    return {
      format: "mifinity.payout_response",
      score: traceId ? 0.8 : 0.7,
      reasons: ["PayAnyCoin response with quoteReference and statusCode / statusMessage"],
    };
  if (isMoney(item.sourceMoney) && isMoney(item.destinationMoney) && (traceId || txRef)) {
    let score = 0.75;
    if (typeof item.datePosted === "string") score += 0.1;
    if (uuidRef) score += 0.05;
    return {
      format: "mifinity.payout_response",
      score,
      reasons: [
        "sourceMoney and destinationMoney carry displayable / presentationAmount strings",
        "has traceId or transactionReference",
      ],
    };
  }
  return undefined;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: PROVIDER };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe payloads carry `object`; MiFinity payloads never do.
  if ("object" in input) return none;

  if (Array.isArray(input.errors)) {
    const first = input.errors.find(isObj);
    if (!first) return none;
    const code = typeof first.errorCode === "string" ? first.errorCode : undefined;
    const typeOk = typeof first.type === "string" && Boolean(lookup(ERROR_TYPES, first.type));
    const known = Boolean(code && lookup(ERROR_CODES, code));
    let confidence = 0;
    const reasons = ["has the errors[] envelope"];
    if (code && typeOk) {
      confidence = known ? 0.95 : 0.85;
      reasons.push("errors[] items carry errorCode and a documented type");
    } else if (code && known) {
      confidence = 0.6;
      reasons.push("errorCode is a documented MiFinity code");
    } else if (typeOk) {
      // Claimed so that parse can report the missing errorCode.
      confidence = 0.6;
      reasons.push("errors[] items carry a documented type");
    }
    if (confidence === 0) return none;
    if (known) reasons.push(`errorCode "${code}" is a documented MiFinity code`);
    if ((meta?.http?.status ?? 0) >= 400 && confidence < 0.95) confidence += 0.03;
    return {
      ...base,
      format: "mifinity.error",
      confidence: round(confidence),
      supported: true,
      reasons,
    };
  }

  let item: Record<string, unknown> = input;
  let envelope = false;
  if (Array.isArray(input.payload)) {
    const first = input.payload[0];
    if (!isObj(first)) return none;
    item = first;
    envelope = true;
  }
  const r = detectItem(item);
  if (!r) return none;
  const reasons = envelope ? ["has the payload[] envelope", ...r.reasons] : r.reasons;
  const supported = r.format !== "mifinity.iframe_init";
  return {
    ...base,
    format: r.format,
    confidence: round(r.score + (envelope ? 0.05 : 0)),
    supported,
    reasons,
    ...(supported
      ? {}
      : {
          unsupportedReason:
            "This is a MiFinity init-iframe response. It carries a session token for the deposit page, not a payment result, and is recognized but not analyzed.",
        }),
  };
}

type ParseResult = { ok: true; value: MifinityParsed } | { ok: false; issues: string[] };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parseItems<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; items: z.output<S>[]; envelope: boolean } | { ok: false; issues: string[] } {
  if (isObj(input) && "payload" in input) {
    const r = z.looseObject({ payload: z.array(schema).min(1).max(100) }).safeParse(input);
    return r.success
      ? { ok: true, items: r.data.payload as z.output<S>[], envelope: true }
      : { ok: false, issues: issuesOf(r.error) };
  }
  const r = schema.safeParse(input);
  return r.success
    ? { ok: true, items: [r.data as z.output<S>], envelope: false }
    : { ok: false, issues: issuesOf(r.error) };
}

function parse(input: unknown, format: string): ParseResult {
  switch (format) {
    case "mifinity.error": {
      const r = ErrorEnvelope.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "error", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "mifinity.payout_status": {
      const r = parseItems(PayoutStatus, input);
      return r.ok ? { ok: true, value: { kind: "payout_status", ...r } } : r;
    }
    case "mifinity.deposit_callback": {
      const r = parseItems(DepositCallback, input);
      return r.ok ? { ok: true, value: { kind: "deposit_callback", ...r } } : r;
    }
    case "mifinity.deposit_status": {
      const r = parseItems(DepositStatus, input);
      return r.ok ? { ok: true, value: { kind: "deposit_status", ...r } } : r;
    }
    case "mifinity.payout_response": {
      const r = parseItems(PayoutResponse, input);
      return r.ok ? { ok: true, value: { kind: "payout_response", ...r } } : r;
    }
    default:
      return { ok: false, issues: [`Unsupported MiFinity format "${format}".`] };
  }
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v))
      out[k] = v
        .filter((x): x is string => typeof x === "string")
        .map((x) => safeText(x, 200) ?? "");
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** traceId is merchant supplied; drop values that look like personal data. */
function traceOf(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

const refOf = (v: unknown) => safeId(v, 128);

/** Enum-like provider values only (e.g. EWALLET, GAMING_PAYOUT). */
const enumOf = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z][A-Za-z0-9_ -]{0,63}$/.test(v) ? v : undefined;

function moneyOf(v: unknown): { minor?: string; currency?: string; raw?: boolean } | undefined {
  const r = Money.safeParse(v);
  if (!r.success) return undefined;
  const currency = upperCurrency(r.data.currency);
  if (r.data.amount === undefined || r.data.amount === null) return currency ? { currency } : {};
  const minor = decimalToMinor(r.data.amount, currency);
  return minor !== undefined ? { minor, currency } : { currency, raw: true };
}

function amountFrom(
  item: Record<string, unknown>,
  fields: readonly string[],
): { minor?: string; currency?: string; field?: string; raw?: boolean } {
  for (const field of fields) {
    const m = moneyOf(item[field]);
    if (m && (m.minor !== undefined || m.raw)) return { ...m, field };
  }
  return {};
}

function observedOf(ctx: NormalizeContext) {
  return ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
}

const pathOf = (envelope: boolean, i: number) => (envelope ? `payload[${i}]` : "");

function embeddedCode(message: unknown): string | undefined {
  if (typeof message !== "string") return undefined;
  return EMBEDDED_CODE.exec(message)?.[1];
}

type StatusInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  known: boolean;
  label?: string;
  attributes: [string, unknown][];
};

/** Payout status from the numeric code and the description. */
function payoutStatusInfo(ts: string | undefined, desc: string | undefined): StatusInfo {
  const descLower = desc?.toLowerCase();
  if (descLower === REVERSED_STATUS.label.toLowerCase())
    return {
      stage: REVERSED_STATUS.stage,
      outcome: REVERSED_STATUS.outcome,
      known: true,
      label: REVERSED_STATUS.label,
      attributes: [
        ["statusMeaning", REVERSED_STATUS.meaning],
        ["reversedHasNoDocumentedId", true],
      ],
    };
  const entry = ts !== undefined ? lookup(TRANSACTION_STATUSES, ts) : undefined;
  if (!entry)
    return {
      stage: "payout",
      outcome: "unknown",
      known: false,
      attributes: [["statusUndocumented", true]],
    };
  const a: [string, unknown][] = [
    ["statusFinal", entry.final === "unclear" ? "unclear" : entry.final],
  ];
  if (entry.note) a.push(["statusNote", entry.note]);
  if (ts === "3") a.push(["successEquivalent", true]);
  if (ts === "4") a.push(["documentedOnOlderPageOnly", true]);
  if (entry.conflict) {
    const c = entry.conflict;
    a.push(["statusMeanings", [`${entry.label}: ${entry.meaning}`, `${c.label}: ${c.meaning}`]]);
    a.push(["statusConflict", true]);
    if (descLower === entry.label.toLowerCase()) {
      a.push(["statusResolvedBy", "transactionStatusDescription"]);
      return {
        stage: "payout",
        outcome: entry.outcome,
        known: true,
        label: entry.label,
        attributes: a,
      };
    }
    if (descLower === c.label.toLowerCase()) {
      a.push(["statusResolvedBy", "transactionStatusDescription"]);
      return { stage: "payout", outcome: c.outcome, known: true, label: c.label, attributes: a };
    }
    a.push([
      "statusResolvedBy",
      desc ? "not resolved: unrecognized description" : "not resolved: no description",
    ]);
    return { stage: "payout", outcome: "unknown", known: true, attributes: a };
  }
  a.push(["statusMeaning", entry.meaning]);
  if (descLower !== undefined && descLower !== entry.label.toLowerCase())
    a.push(["descriptionMismatch", true]);
  return {
    stage: "payout",
    outcome: entry.outcome,
    known: true,
    label: entry.label,
    attributes: a,
  };
}

function productOf(v: unknown) {
  const key = normProduct(v);
  return key ? lookup(PAYOUT_PRODUCTS, key) : undefined;
}

function payoutStatusEvent(
  item: PayoutStatusT,
  ctx: NormalizeContext,
  path: string,
  envelope: boolean,
): NormalizedEventDraft {
  const raw = item as Record<string, unknown>;
  const ts = statusKey(item.transactionStatus);
  const desc = str(item.transactionStatusDescription);
  const info = payoutStatusInfo(ts, desc);
  const product = productOf(item.eventTypeDescription);
  const amount = amountFrom(raw, ["money"]);
  const updated = toIsoTimestamp(item.transactionLastUpdated);
  const created = toIsoTimestamp(item.createdOn);
  const name =
    safeText(desc, 64) ?? info.label ?? (ts !== undefined ? `transactionStatus ${ts}` : "unknown");
  const errorMessage = str(item.errorMessage);

  return clean({
    sourceFormat: ctx.format,
    eventType: `payout.${name}`,
    eventTypeKnown: info.known,
    stage: info.stage,
    providerStatus: ts ?? (desc ? safeText(desc, 64) : undefined),
    paymentReference: refOf(item.transactionReference),
    merchantReference: traceOf(item.traceId),
    eventTimestamp: updated ?? created,
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: info.outcome,
    attributes: attrs([
      ["operation", "payout"],
      ["transactionStatus", ts],
      ["transactionStatusDescription", desc],
      ...info.attributes,
      ["eventTypeDescription", enumOf(item.eventTypeDescription)],
      ["payoutProduct", product?.product],
      ["payoutRail", product?.rail],
      [
        "walletTransfer",
        product?.rail === "wallet" ? "wallet-to-wallet transfer, not a card operation" : undefined,
      ],
      ["paymentCategoryType", enumOf(item.paymentCategoryType)],
      ["errorMessage", errorMessage],
      ["embeddedErrorCode", embeddedCode(errorMessage)],
      ["arnPresent", typeof raw.arn === "string" && raw.arn !== "" ? true : undefined],
      ["createdOn", created],
      ["postedOn", toIsoTimestamp(item.postedOn)],
      [
        "timestampSource",
        updated
          ? "transactionLastUpdated"
          : created
            ? "createdOn (creation time of the payout, not of this status)"
            : undefined,
      ],
      ["amountField", amount.field],
      ["amountNotConvertible", amount.raw],
      ["signatureVerified", envelope ? undefined : false],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path },
    ...observedOf(ctx),
  });
}

function depositCallbackEvent(
  item: DepositCallbackT,
  ctx: NormalizeContext,
  path: string,
): NormalizedEventDraft {
  const raw = item as Record<string, unknown>;
  const detailed = str(item.detailedStatus);
  const errorMessage = str(item.errorMessage);
  const failureBody = Boolean(detailed || errorMessage);
  const knownDetailed = detailed ? Boolean(lookup(DETAILED_STATUSES, detailed)) : true;
  const outcome: Outcome = !failureBody ? "success" : knownDetailed ? "failure" : "unknown";
  const amount = amountFrom(raw, ["money", "sourceMoney"]);
  const eventType = failureBody
    ? `deposit_callback.${safeText(detailed, 64) ?? "failed"}`
    : "deposit_callback.success";

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: knownDetailed,
    stage: "payment",
    providerStatus: detailed ? safeText(detailed, 64) : undefined,
    paymentReference: refOf(item.transactionReference),
    merchantReference: traceOf(item.traceId),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome,
    attributes: attrs([
      ["operation", "eWallet deposit (wallet transfer to the merchant, not a card authorization)"],
      [
        "outcomeInferredFrom",
        failureBody
          ? "failure body (errorMessage or detailedStatus)"
          : "success body (no errorMessage or detailedStatus; deposit callbacks carry no status field)",
      ],
      ["detailedStatus", detailed],
      [
        "detailedStatusMeaning",
        detailed ? lookup(DETAILED_STATUSES, detailed)?.meaning : undefined,
      ],
      ["errorMessage", errorMessage],
      ["embeddedErrorCode", embeddedCode(errorMessage)],
      ["paymentType", enumOf(item.paymentType)],
      ["paymentMethod", enumOf(item.paymentMethod)],
      ["amountField", amount.field],
      ["amountNotConvertible", amount.raw],
      ["signatureVerified", false],
      ["confirmWith", "Payment Status API"],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path },
    ...observedOf(ctx),
  });
}

function depositStatusEvent(
  item: DepositStatusT,
  ctx: NormalizeContext,
  path: string,
): NormalizedEventDraft {
  const entry = lookup(DEPOSIT_STATUSES, item.status);
  const pr = item.paymentResponse ?? undefined;
  const detailed = str(item.detailedStatus);
  const errorMessage = str(item.errorMessage);
  const amount = pr ? amountFrom(pr as Record<string, unknown>, ["money", "sourceMoney"]) : {};

  return clean({
    sourceFormat: ctx.format,
    eventType: `payment_status.${safeText(item.status, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(entry),
    stage: "payment",
    providerStatus: safeText(item.status, 64),
    paymentReference: refOf(pr?.transactionReference),
    merchantReference: traceOf(pr?.traceId),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["operation", "eWallet deposit (wallet transfer to the merchant, not a card authorization)"],
      ["status", item.status],
      ["statusMeaning", entry?.meaning],
      ["statusFinal", entry?.final],
      ["detailedStatus", detailed],
      [
        "detailedStatusMeaning",
        detailed ? lookup(DETAILED_STATUSES, detailed)?.meaning : undefined,
      ],
      ["errorMessage", errorMessage],
      ["embeddedErrorCode", embeddedCode(errorMessage)],
      ["paymentType", enumOf(pr?.paymentType)],
      ["paymentMethod", enumOf(pr?.paymentMethod)],
      ["referencesFrom", pr ? "paymentResponse" : undefined],
      ["amountField", amount.field ? `paymentResponse.${amount.field}` : undefined],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path },
    ...observedOf(ctx),
  });
}

function payoutResponseEvent(
  item: PayoutResponseT,
  ctx: NormalizeContext,
  path: string,
): NormalizedEventDraft {
  const raw = item as Record<string, unknown>;
  const amount = amountFrom(raw, ["money", "sourceMoney"]);
  const destination = moneyOf(raw.destinationMoney);
  let eventType: string;
  let outcome: Outcome;
  let known: boolean;
  let providerStatus: string | undefined;
  let product: string | undefined;
  const extra: [string, unknown][] = [];

  if (item.quoteReference || item.statusMessage) {
    const message = str(item.statusMessage);
    const payc = message ? lookup(PAYC_STATUSES, message.toUpperCase()) : undefined;
    const code = statusKey(item.statusCode);
    product = "PayAnyCoin (PAYC)";
    providerStatus = safeText(message, 64) ?? code;
    eventType = `payc_response.${safeText(message, 64) ?? code ?? "unknown"}`;
    outcome = payc?.outcome ?? "unknown";
    known = Boolean(payc);
    extra.push(["statusCode", code], ["statusMessage", message], ["statusMeaning", payc?.meaning]);
    extra.push(["statusListDocumented", false]);
  } else if (item.status) {
    product = "Account to Account (A2A)";
    providerStatus = safeText(item.status, 32);
    eventType = `payout_response.${providerStatus ?? "unknown"}`;
    outcome = item.status === "OK" ? "success" : "unknown";
    known = item.status === "OK";
    extra.push(["walletTransfer", "wallet-to-wallet transfer, not a card operation"]);
    if (typeof item.sameOwner === "boolean") extra.push(["sameOwner", item.sameOwner]);
  } else {
    // PAB, PAC and PMC responses carry no status: the request was accepted
    // and the result follows in callbacks or a Transaction Status lookup.
    eventType = "payout_response.accepted";
    outcome = "pending";
    known = true;
    extra.push(
      ["requestAccepted", true],
      ["finalStatusFrom", "payout callbacks or Transaction Status"],
    );
  }

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: known,
    stage: "payout",
    providerStatus,
    paymentReference: refOf(item.transactionReference),
    relatedReference: refOf(item.quoteReference),
    merchantReference: traceOf(item.traceId),
    eventTimestamp: toIsoTimestamp(item.datePosted),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome,
    attributes: attrs([
      ["operation", "payout"],
      ["payoutProduct", product],
      ...extra,
      ["amountField", amount.field],
      ["amountNotConvertible", amount.raw],
      ["destinationAmountMinor", destination?.minor],
      ["destinationCurrency", destination?.currency],
      ["timestampSource", toIsoTimestamp(item.datePosted) ? "datePosted" : undefined],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path },
    ...observedOf(ctx),
  });
}

function errorEnvelopeEvent(
  e: z.infer<typeof ErrorEnvelope>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const httpStatus = ctx.meta?.http?.status;
  const codes = e.errors.slice(0, 20).map((x) => safeId(x.errorCode, 64) ?? "unknown");
  return clean({
    sourceFormat: ctx.format,
    eventType: `error.${codes[0] ?? "unknown"}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: httpStatus ? `HTTP ${httpStatus}` : codes[0],
    outcome: "unknown",
    attributes: attrs([
      ["errorCodes", codes],
      ["errorTypes", e.errors.slice(0, 20).map((x) => safeId(x.type, 64) ?? "unknown")],
      ["errorCount", e.errors.length],
      ["httpStatus", httpStatus],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function normalize(parsed: MifinityParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "error":
      return [errorEnvelopeEvent(parsed.value, ctx)];
    case "payout_status":
      return parsed.items.map((it, i) =>
        payoutStatusEvent(it, ctx, pathOf(parsed.envelope, i), parsed.envelope),
      );
    case "deposit_callback":
      return parsed.items.map((it, i) => depositCallbackEvent(it, ctx, pathOf(parsed.envelope, i)));
    case "deposit_status":
      return parsed.items.map((it, i) => depositStatusEvent(it, ctx, pathOf(parsed.envelope, i)));
    case "payout_response":
      return parsed.items.map((it, i) => payoutResponseEvent(it, ctx, pathOf(parsed.envelope, i)));
  }
}

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
};

const withRefs = (loc: Location) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference
    ? { paymentReference: loc.paymentReference, attemptReference: loc.paymentReference }
    : {}),
});

const DOC_TITLES: Record<string, string> = {
  [ERROR_CODES_URL]: "MiFinity error codes",
  [PAB_ERROR_CODES_URL]: "MiFinity PAB error codes",
  [PAYMENT_STATUS_URL]: "MiFinity Payment Status API",
  [DEPOSIT_API_URL]: "MiFinity deposit API (OpenAPI example)",
  [DEPOSIT_CALLBACK_URL]: "MiFinity deposit callbacks",
  [TRANSACTION_STATUS_URL]: "MiFinity transaction status",
  [TRANSACTION_STATUS_OLD_URL]: "MiFinity transaction status (older table)",
  [TRANSACTION_LIFECYCLE_URL]: "MiFinity transaction lifecycle",
  [PAYOUT_CALLBACKS_URL]: "MiFinity payout callbacks",
  [WITHDRAWAL_CALLBACKS_URL]: "MiFinity withdrawal callbacks",
  [PAB_FLOW_URL]: "MiFinity PayAnyBank flow (traceId retries)",
  [CARD_PAYOUT_API_URL]: "MiFinity card payout API",
  [A2A_URL]: "MiFinity Account to Account transfer",
  [PAYC_API_URL]: "MiFinity PayAnyCoin API",
  [HTTP_STATUS_URL]: "MiFinity HTTP response status codes",
};

const docLink = (url: string): DocumentationLink => ({
  title: lookup(DOC_TITLES, url) ?? "MiFinity documentation",
  url,
});

function addDoc(docs: DocumentationLink[], url: string) {
  if (!docs.some((d) => d.url === url)) docs.push(docLink(url));
}

function retryText(retry: RetryGuidance, note?: string): string {
  return note ? `${note} ${RETRY_TEXT[retry]}` : RETRY_TEXT[retry];
}

function httpRule(status: number | undefined) {
  if (status === undefined) return undefined;
  if (status >= 500 && status <= 599) return HTTP_RULES["5xx"];
  return lookup(HTTP_RULES, status);
}

/** Decodes one documented or unknown errorCode. */
function decodeCode(
  code: string,
  type: string | undefined,
  message: string | undefined,
  httpStatus: number | undefined,
  loc: Location,
  subCodes: Record<string, string>,
): DecodedErrorDraft {
  const entry = lookup(ERROR_CODES, code);
  const docs: DocumentationLink[] = [];
  const missing: string[] = [];
  let mapping: ErrorMapping;
  let confidence: Confidence;
  let explanation: string;
  let retryNote: string | undefined;
  const typeKnown = type !== undefined && Boolean(lookup(ERROR_TYPES, type));

  if (entry) {
    const byType = typeKnown ? entry.byType?.[type as ErrorType] : undefined;
    mapping = byType ?? entry;
    retryNote = entry.retryNote;
    if (entry.lookup && httpStatus === 404) {
      mapping = entry.lookup;
      retryNote = entry.lookup.retryNote;
      addDoc(docs, TRANSACTION_STATUS_URL);
    }
    confidence = entry.confidence;
    explanation = `MiFinity error ${code}${type ? ` (${type})` : ""}: ${mapping.meaning}.`;
    if (entry.note) explanation += ` ${entry.note}`;
    for (const d of entry.docs) addDoc(docs, d);
    if (typeKnown && !entry.types.includes(type as ErrorType))
      missing.push(
        `${code} is documented with type ${entry.types.join(" or ")}, not ${type}; the documented meaning is used.`,
      );
    if (code === "TRANSACTION_FAILED") {
      const hint = message
        ? TRANSACTION_FAILED_HINTS.find((h) => h.pattern.test(message))
        : undefined;
      if (hint)
        explanation += ` The message points to ${hint.cause}, one of the documented causes; this is a hint from the message text, not a separate code.`;
      else
        missing.push(
          "The message does not show which of the documented TRANSACTION_FAILED causes applies; processor text may be passed through.",
        );
    }
  } else {
    const rule = httpRule(httpStatus);
    if (rule && httpStatus !== undefined) {
      mapping = rule;
      confidence = "possible";
      explanation = `HTTP ${httpStatus}: ${rule.meaning}. The errorCode "${safeText(code, 64)}" is not a documented MiFinity code.`;
      addDoc(docs, rule.docs);
    } else {
      mapping = { meaning: "", category: "unknown", retry: "unknown" };
      confidence = "insufficient";
      explanation = `PandaPayLens does not recognize the MiFinity error code "${safeText(code, 64)}".`;
      if (httpStatus === undefined)
        missing.push("No HTTP status was supplied, so no fallback category is available.");
      addDoc(docs, ERROR_CODES_URL);
    }
    missing.push(`Error code "${safeText(code, 64)}" is not in the PandaPayLens catalog.`);
    if (typeKnown)
      explanation += ` Its type ${type} means ${lookup(ERROR_TYPES, type as ErrorType)}.`;
  }

  let category: ErrorCategory = mapping.category;
  let retry: RetryGuidance = mapping.retry;
  // A 5xx leaves the outcome of the original request open: never safe to
  // repeat blindly, and an unspecific code becomes a provider problem.
  if (httpStatus !== undefined && httpStatus >= 500) {
    if (category === "unknown") category = "provider_unavailable";
    if (
      retry === "safe_to_retry_technical_request" ||
      retry === "unknown" ||
      retry === "manual_review"
    )
      retry = "retry_conditionally";
    retryNote =
      "HTTP 5xx: the outcome of the request is unknown. MiFinity says to retry a payout request only with the same traceId, and to retry status lookups on 5xx.";
    addDoc(docs, PAB_FLOW_URL);
    addDoc(docs, TRANSACTION_STATUS_URL);
  }
  if (retry === "retry_conditionally") addDoc(docs, TRANSACTION_STATUS_URL);
  if (message && /\{\d*\}/.test(message))
    missing.push(
      "The message contains an unfilled placeholder ({0} or {}), so its detail is missing.",
    );

  if (type !== undefined) subCodes.type = safeText(type, 64) ?? "";
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  const providerMessage = safeText(message, 200);

  return {
    ...withRefs(loc),
    code,
    subCodes,
    category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryText(retry, retryNote),
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

function decodeErrorItem(
  item: ErrorItemT,
  httpStatus: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const code = item.errorCode.trim() || "unknown";
  const subCodes: Record<string, string> = {};
  // field sometimes holds message text instead of a field name; only names are kept.
  const field = item.field ?? item.Field ?? undefined;
  if (typeof field === "string" && IDENTIFIER.test(field)) subCodes.field = field;
  if (typeof item.formObjectName === "string" && IDENTIFIER.test(item.formObjectName))
    subCodes.form_object = item.formObjectName;
  return decodeCode(
    safeId(code, 64) ?? "unknown",
    item.type,
    item.message ?? undefined,
    httpStatus,
    loc,
    subCodes,
  );
}

/** Failed deposit: detailedStatus first, then a code embedded in errorMessage. */
function decodeDepositFailure(
  detailed: string | undefined,
  errorMessage: string | undefined,
  loc: Location,
  docUrl: string,
): DecodedErrorDraft {
  const entry = detailed ? lookup(DETAILED_STATUSES, detailed) : undefined;
  const embedded = embeddedCode(errorMessage);
  const providerMessage = safeText(errorMessage, 200);
  const subCodes: Record<string, string> = {};
  if (detailed) subCodes.detailed_status = safeText(detailed, 64) ?? "";

  if (embedded && (!entry || detailed === "FAILED")) {
    const decoded = decodeCode(embedded, undefined, errorMessage, undefined, loc, subCodes);
    decoded.explanation += " The code was taken from the deposit errorMessage text.";
    decoded.outcomeKnown = true;
    if (!decoded.documentation.some((d) => d.url === docUrl))
      decoded.documentation.push(docLink(docUrl));
    return decoded;
  }

  const missing: string[] = [];
  if (embedded) subCodes.embedded_error_code = embedded;
  let mapping: ErrorMapping;
  let confidence: Confidence;
  let explanation: string;
  if (entry && detailed) {
    mapping = entry;
    confidence = entry.category === "unknown" ? "possible" : "strong";
    explanation = `MiFinity deposit detailedStatus ${detailed}: ${entry.meaning}.`;
    if (detailed === "REFUSED_BY_RISK" && errorMessage && /abandon/i.test(errorMessage))
      missing.push(
        "The errorMessage says the deposit was abandoned; MiFinity's Refused by Risk example carries the same text, so detailedStatus is used.",
      );
    if (detailed === "FAILED")
      missing.push("detailedStatus FAILED gives no reason for the failure.");
  } else {
    mapping = { meaning: "", category: "unknown", retry: "unknown" };
    confidence = "insufficient";
    explanation = detailed
      ? `The deposit failed with detailedStatus "${safeText(detailed, 64)}", which is not a documented MiFinity value.`
      : "The deposit failed, but no detailedStatus or error code was supplied.";
    missing.push(
      detailed
        ? `detailedStatus "${safeText(detailed, 64)}" is not in the PandaPayLens catalog.`
        : "No detailedStatus was supplied, so the reason is unknown.",
    );
  }
  if (!loc.paymentReference)
    missing.push("No transactionReference; check the deposit with the Payment Status API.");

  return {
    ...withRefs(loc),
    code: detailed ? (safeText(detailed, 64) ?? "unknown") : "FAILED",
    subCodes,
    category: mapping.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction: NEXT_ACTION[mapping.category],
    retry: mapping.retry,
    retryExplanation: RETRY_TEXT[mapping.retry],
    confidence,
    documentation: [docLink(docUrl)],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

/** Failed payout status (2, 6, or 5 described as Failed). */
function decodePayoutFailure(item: PayoutStatusT, loc: Location): DecodedErrorDraft | undefined {
  const ts = statusKey(item.transactionStatus);
  const desc = str(item.transactionStatusDescription);
  const info = payoutStatusInfo(ts, desc);
  if (info.outcome !== "failure") return undefined;
  const errorMessage = str(item.errorMessage);
  const subCodes: Record<string, string> = {};
  if (ts !== undefined) subCodes.transaction_status = ts;
  if (desc) subCodes.transaction_status_description = safeText(desc, 64) ?? "";

  const embedded = embeddedCode(errorMessage);
  if (embedded) {
    const decoded = decodeCode(embedded, undefined, errorMessage, undefined, loc, subCodes);
    decoded.explanation += ` The payout ended in transactionStatus ${ts ?? "unknown"} (${info.label ?? desc ?? "unknown"}); the code was taken from errorMessage.`;
    decoded.outcomeKnown = true;
    return decoded;
  }

  const missing: string[] = [];
  let category: ErrorCategory = "unknown";
  let retry: RetryGuidance = "manual_review";
  let explanation: string;
  const docs = [docLink(TRANSACTION_STATUS_URL)];
  if (ts === "2") {
    category = "provider_unavailable";
    retry = "retry_conditionally";
    explanation =
      "MiFinity payout status 2 (Internal Error): MiFinity failed to initiate the payout. The status is final.";
  } else if (ts === "5") {
    explanation =
      "MiFinity payout status 5 described as Failed. Status 5 contradicts itself in MiFinity's documentation: the withdrawal callbacks page documents it as Failed, every other page as Processed by acquirer (final success).";
    missing.push(
      "Status 5 has two documented meanings; confirm the payout with a Transaction Status lookup.",
    );
    docs.push(docLink(WITHDRAWAL_CALLBACKS_URL));
  } else {
    explanation = `MiFinity payout status ${ts ?? "unknown"} (${info.label ?? desc ?? "unknown"}): rejected by MiFinity. The status is final.`;
  }
  if (errorMessage) explanation += " MiFinity's errorMessage is shown as the reason.";
  else missing.push("No errorMessage was supplied, so the reason is unknown.");
  if (!loc.paymentReference)
    missing.push("No transactionReference; look the payout up by traceId.");

  const providerMessage = safeText(errorMessage, 200);
  return {
    ...withRefs(loc),
    code: `transactionStatus ${ts ?? desc ?? "unknown"}`,
    subCodes,
    category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: RETRY_TEXT[retry],
    confidence: "possible",
    documentation: docs,
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeErrors(parsed: MifinityParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const loc = (path: string, ref?: unknown): Location => {
    const r = refOf(ref);
    return {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path },
      ...(r ? { paymentReference: r } : {}),
    };
  };
  switch (parsed.kind) {
    case "error":
      return parsed.value.errors.map((item, i) =>
        decodeErrorItem(item, ctx.meta?.http?.status, loc(`errors[${i}]`)),
      );
    case "payout_status":
      return parsed.items.flatMap((it, i) => {
        const err = decodePayoutFailure(
          it,
          loc(pathOf(parsed.envelope, i), it.transactionReference),
        );
        return err ? [err] : [];
      });
    case "deposit_callback":
      return parsed.items.flatMap((it, i) => {
        const detailed = str(it.detailedStatus);
        const message = str(it.errorMessage);
        if (!detailed && !message) return [];
        return [
          decodeDepositFailure(
            detailed,
            message,
            loc(pathOf(parsed.envelope, i), it.transactionReference),
            DEPOSIT_CALLBACK_URL,
          ),
        ];
      });
    case "deposit_status":
      return parsed.items.flatMap((it, i) =>
        it.status === "FAILED"
          ? [
              decodeDepositFailure(
                str(it.detailedStatus),
                str(it.errorMessage),
                loc(pathOf(parsed.envelope, i), it.paymentResponse?.transactionReference),
                PAYMENT_STATUS_URL,
              ),
            ]
          : [],
      );
    case "payout_response":
      return [];
  }
}

export const mifinityAdapter: ProviderAdapter<MifinityParsed> = {
  id: PROVIDER,
  displayName: "MiFinity",
  version: MIFINITY_ADAPTER_VERSION,
  manifest: mifinityManifest,
  supportedFormats: [
    {
      id: "mifinity.error",
      description: "Error envelope ({ errors: [{ type, errorCode, message, field }] })",
    },
    {
      id: "mifinity.deposit_callback",
      description: "eWallet deposit callback (traceId, validationKey, transactionReference, money)",
    },
    {
      id: "mifinity.deposit_status",
      description: "Payment Status API response (status, detailedStatus, paymentResponse)",
    },
    {
      id: "mifinity.payout_status",
      description: "Payout callback or Transaction Status lookup (transactionStatus 1 to 8)",
    },
    {
      id: "mifinity.payout_response",
      description: "Synchronous payout response (PAB, PAC, PMC, Account to Account, PayAnyCoin)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // transactionReference (MiFinity) always; traceId only for payouts, where
    // MiFinity rejects a reused traceId (DUPLICATED_TRANSACTION_ID) and looks
    // payouts up by it. Deposit traceIds have no documented uniqueness rule.
    const keys: string[] = [];
    if (event.paymentReference) keys.push(event.paymentReference);
    if (event.relatedReference) keys.push(`quote:${event.relatedReference}`);
    if (event.merchantReference && (event.stage === "payout" || event.stage === "reversal"))
      keys.push(`traceId:${event.merchantReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export default mifinityAdapter;
