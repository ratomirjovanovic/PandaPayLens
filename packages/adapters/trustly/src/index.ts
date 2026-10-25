/**
 * Trustly adapter (pay by bank).
 *
 * Supported input families, kept apart because they are separate API
 * platforms with their own status tables and identifiers:
 *
 * EU JSON-RPC 1.1 API
 * - `trustly.eu.notification`   Notification call from Trustly (`method`, `params.data.notificationid`)
 * - `trustly.eu.result`         Method result (`result.method`, `result.data`)
 * - `trustly.eu.error`          Error envelope (`error.name` JSONRPCError, `error.code`)
 *
 * North America (AMER) REST API v1
 * - `trustly.amer.event`        Event notification (`eventId`, `eventType`, `objectId`), form-encoded or JSON
 * - `trustly.amer.transaction`  Transaction object (`transactionId`, `transactionType`, `status`)
 * - `trustly.amer.error`        REST error body (`errors[]` with `code`, `domain`, `occurredAt`)
 *
 * Recognized but not analyzed: `trustly.eu.request` (merchant request with
 * API credentials) and `trustly.eu.notification_response` (the merchant's own
 * reply to a notification).
 *
 * A pending bank payment is never shown as credited; credit and debit keep
 * their documented meaning (change of the end user's balance).
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
  AMER_AC_CODES,
  AMER_EFT_RETURN_CODES,
  AMER_EVENT_TYPES,
  AMER_IDEMPOTENCY_URL,
  AMER_INTERNAL_ERRORS,
  AMER_OPENAPI_URL,
  AMER_PAYMENT_TYPES,
  AMER_REASON_CODES,
  AMER_SE_CODES,
  AMER_STATUS_CODES_URL,
  AMER_SW_CODES,
  AMER_TRANSACTION_STATUSES,
  AMER_TRANSACTION_TYPES,
  AMER_UC_CODES,
  AMER_UK_DD_CODES,
  EU_CANCEL_ORDER_STATUSES,
  EU_CANCEL_URL,
  EU_ERROR_CODES,
  EU_ERROR_HANDLING_URL,
  EU_ERROR_NAMES,
  EU_KYC_ABORT_MESSAGES,
  EU_METHODS,
  EU_NOTIFICATIONS,
  EU_NOTIFICATION_REPLIES,
  EU_OTHER_ERROR_NAMES,
  EU_PAYOUT_ERROR_CODES,
  EU_PAYOUT_FAILED_URL,
  EU_TRANSFER_STATES,
  NEXT_ACTION,
  RETRY_TEXT,
  extendedReason,
  type AmerCodeEntry,
  type ErrorMapping,
} from "./catalog.js";
import { trustlyManifest, TRUSTLY_ADAPTER_VERSION } from "./manifest.js";

export { trustlyManifest, TRUSTLY_ADAPTER_VERSION };

const PROVIDER = "trustly";

type Format =
  | "trustly.eu.notification"
  | "trustly.eu.result"
  | "trustly.eu.error"
  | "trustly.eu.request"
  | "trustly.eu.notification_response"
  | "trustly.amer.event"
  | "trustly.amer.transaction"
  | "trustly.amer.error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Documented EU timestamp shape: 2010-01-20 14:42:04.675645+01
const EU_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?([+-]\d{2})(?::?(\d{2}))?$/;
const EU_ERROR_NAME = /^ERROR_[A-Z0-9_]{2,80}$/;
const AMER_STATUS_CODE = /^(?:SW\d{3}|UC\d{2}|AC\d{3}|SE\d{2})$/;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.[\]-]{0,63}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const present = (v: unknown) => v !== undefined && v !== null && v !== "";

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

/** Small integer from a number or a digit string ("Returned numbers can be a string or a number"). */
function numKey(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && Math.abs(v) < 1e7) return String(v);
  if (typeof v === "string" && /^-?\d{1,7}$/.test(v.trim())) return String(Number(v.trim()));
  return undefined;
}

/** Identifier from a string or an integer (EU orderid can be numeric). */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  return typeof v === "string" ? safeId(v.trim(), 128) : undefined;
}

/** Merchant-supplied references: drop values that look like personal data. */
function traceOf(v: unknown): string | undefined {
  const id = idOf(v);
  return id && safeText(id, 128) === id ? id : undefined;
}

/** Enum-like provider values only. */
const enumOf = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z][A-Za-z0-9_ .-]{0,63}$/.test(v) ? v : undefined;

/** "1"/1/true and "0"/0/false. */
function flag(v: unknown): boolean | undefined {
  if (v === true || v === 1 || v === "1") return true;
  if (v === false || v === 0 || v === "0") return false;
  return undefined;
}

function euTimestamp(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 64) return undefined;
  const m = EU_TIMESTAMP.exec(v.trim());
  if (m) {
    const ms = (m[3] ?? "").slice(0, 3).padEnd(3, "0");
    return toIsoTimestamp(`${m[1]}T${m[2]}.${ms}${m[4]}:${m[5] ?? "00"}`);
  }
  return toIsoTimestamp(v);
}

/** AMER `createdAt` is Unix milliseconds; form bodies carry it as a digit string. */
function msTimestamp(v: unknown): string | undefined {
  if (typeof v === "number") return toIsoTimestamp(v);
  if (typeof v === "string" && /^\d{9,15}$/.test(v.trim())) return toIsoTimestamp(Number(v.trim()));
  return typeof v === "string" ? toIsoTimestamp(v) : undefined;
}

function amountOf(value: unknown, currency: string | undefined): { minor?: string; raw?: boolean } {
  if (!present(value)) return {};
  const minor = decimalToMinor(value, currency);
  return minor !== undefined ? { minor } : { raw: true };
}

/** Status or return code token (SW021, UC08, AC100, SE01, 901, ARUDD_0, R01). */
function statusToken(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return /^[A-Za-z0-9_]{1,16}$/.test(t) ? t : undefined;
}

/** paymentProviderTransaction fields: dotted keys in form bodies, an object in JSON. */
function pptField(raw: Record<string, unknown>, key: string): unknown {
  const dotted = raw[`paymentProviderTransaction.${key}`];
  if (dotted !== undefined) return dotted;
  const obj = raw.paymentProviderTransaction;
  return isObj(obj) ? obj[key] : undefined;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

type Detected = { format: Format; score: number; reasons: string[] };

const NOT_ANALYZED: Partial<Record<Format, string>> = {
  "trustly.eu.request":
    "This is a merchant request to the Trustly EU API. It carries API credentials and is recognized but not analyzed; paste Trustly's result or notification instead.",
  "trustly.eu.notification_response":
    "This is the merchant's reply to a Trustly notification, not a Trustly result. It is recognized but not analyzed.",
};

function detectEu(input: Record<string, unknown>): Detected | undefined {
  // JSON-RPC 1.1 messages from and to Trustly always carry version "1.1".
  const v11 = input.version === "1.1";

  if (typeof input.method === "string" && isObj(input.params)) {
    if (!v11) return undefined;
    const p = input.params;
    if (isObj(p.Data) || typeof p.Signature === "string" || typeof p.UUID === "string") {
      const d = isObj(p.Data) ? p.Data : {};
      const fields = ["Username", "Password", "MessageID", "EndUserID", "NotificationURL"].filter(
        (k) => k in d,
      );
      const sigUuid = typeof p.Signature === "string" && typeof p.UUID === "string";
      if (fields.length === 0 && !sigUuid) return undefined;
      let score = 0.5 + 0.1 * Math.min(fields.length, 3);
      if (sigUuid) score += 0.1;
      return {
        format: "trustly.eu.request",
        score,
        reasons: [
          "JSON-RPC 1.1 call with capitalised params (Signature, UUID, Data)",
          ...(fields.length ? [`Data carries ${fields.join(", ")}`] : []),
        ],
      };
    }
    if (!isObj(p.data)) return undefined;
    const d = p.data;
    const known = Boolean(lookup(EU_NOTIFICATIONS, input.method));
    const hasNid = present(d.notificationid) || present(d.notificationID);
    if (!known && !hasNid) return undefined;
    const reasons = ['JSON-RPC 1.1 call with params.data and version "1.1"'];
    let score = known ? 0.5 : 0.3;
    if (known) reasons.push(`method "${input.method}" is a documented notification`);
    if (hasNid) {
      score += 0.2;
      reasons.push("params.data carries notificationid");
    }
    if (typeof p.uuid === "string" && UUID.test(p.uuid)) {
      score += 0.1;
      reasons.push("params.uuid is a UUID");
    }
    if (typeof p.signature === "string") score += 0.05;
    if (present(d.orderid) || present(d.orderId)) score += 0.05;
    if (typeof d.timestamp === "string" && EU_TIMESTAMP.test(d.timestamp)) score += 0.05;
    return { format: "trustly.eu.notification", score, reasons };
  }

  if (isObj(input.result)) {
    if (!v11) return undefined;
    const r = input.result;
    if (typeof r.method !== "string" || !(isObj(r.data) || Array.isArray(r.data))) return undefined;
    const sig = typeof r.signature === "string";
    const uuid = typeof r.uuid === "string" && UUID.test(r.uuid);
    if (
      lookup(EU_NOTIFICATIONS, r.method) &&
      isObj(r.data) &&
      typeof r.data.status === "string" &&
      EU_NOTIFICATION_REPLIES.has(r.data.status)
    ) {
      return {
        format: "trustly.eu.notification_response",
        score: 0.4 + (sig ? 0.2 : 0) + (uuid ? 0.2 : 0),
        reasons: ["JSON-RPC 1.1 result naming a notification method with data.status"],
      };
    }
    const reasons = ["JSON-RPC 1.1 result with result.method and result.data"];
    let score = 0.4;
    if (sig) score += 0.15;
    if (uuid) {
      score += 0.15;
      reasons.push("result.uuid is a UUID");
    }
    if (lookup(EU_METHODS, r.method)) {
      score += 0.15;
      reasons.push(`method "${r.method}" is a documented Trustly method`);
    } else if (/^[A-Z][A-Za-z]{2,40}$/.test(r.method)) score += 0.05;
    if (isObj(r.data) && present(r.data.orderid)) score += 0.05;
    return { format: "trustly.eu.result", score, reasons };
  }

  if (isObj(input.error)) {
    const e = input.error;
    const inner = isObj(e.error) ? e.error : undefined;
    const innerData = inner && isObj(inner.data) ? inner.data : undefined;
    const named = e.name === "JSONRPCError";
    const message = typeof e.message === "string" ? e.message : innerData?.message;
    const errName = typeof message === "string" && EU_ERROR_NAME.test(message);
    if (!named && !(errName && innerData)) return undefined;
    const code = numKey(e.code ?? innerData?.code);
    const reasons: string[] = [];
    let score = named ? 0.4 : 0.3;
    if (named) reasons.push('error.name is "JSONRPCError"');
    if (errName) {
      score += 0.15;
      reasons.push("error message is an ERROR_ name");
    }
    if (code && lookup(EU_ERROR_CODES, code)) {
      score += 0.2;
      reasons.push(`error code ${code} is a documented Trustly code`);
    } else if (code && /^\d{3}$/.test(code)) score += 0.05;
    if (innerData) score += 0.1;
    if (v11) score += 0.05;
    return { format: "trustly.eu.error", score, reasons };
  }
  return undefined;
}

function detectAmer(input: Record<string, unknown>, meta?: RecordMeta): Detected | undefined {
  // Event notification.
  if (present(input.eventId) && typeof input.eventType === "string" && present(input.objectId)) {
    const reasons = ["has eventId, eventType and objectId"];
    let score = 0.35;
    if (lookup(AMER_EVENT_TYPES, input.eventType)) {
      score += 0.15;
      reasons.push(`eventType "${input.eventType}" is a documented event type`);
    }
    if (input.objectType === "Transaction") {
      score += 0.1;
      reasons.push('objectType is "Transaction"');
    }
    if (input.timeZone === "Etc/UTC") {
      score += 0.1;
      reasons.push('timeZone is "Etc/UTC"');
    }
    const pptStatus = pptField(input, "status");
    if (typeof pptStatus === "string" && AMER_STATUS_CODE.test(pptStatus)) {
      score += 0.15;
      reasons.push("paymentProviderTransaction.status is a documented status code");
    }
    if (present(input.merchantId)) score += 0.05;
    if (numKey(input.transactionType) !== undefined || numKey(input.paymentType) !== undefined)
      score += 0.05;
    if (meta?.format === "form" || meta?.http?.contentType === "application/x-www-form-urlencoded")
      score += 0.03;
    return { format: "trustly.amer.event", score, reasons };
  }

  // REST Transaction object.
  if (present(input.transactionId) && numKey(input.transactionType) !== undefined) {
    const ppt = isObj(input.paymentProviderTransaction)
      ? input.paymentProviderTransaction
      : undefined;
    const statusKey = numKey(input.status);
    if (statusKey === undefined && !ppt) return undefined;
    const reasons = ["has transactionId and a numeric transactionType"];
    let score = 0.4;
    if (statusKey !== undefined && lookup(AMER_TRANSACTION_STATUSES, statusKey)) {
      score += 0.1;
      reasons.push("status is a documented transaction status");
    }
    if (ppt) {
      score += 0.1;
      if (
        present(ppt.paymentProviderTransactionId) ||
        (typeof ppt.status === "string" && AMER_STATUS_CODE.test(ppt.status))
      ) {
        score += 0.15;
        reasons.push("paymentProviderTransaction carries a documented status code or id");
      }
    }
    const label = typeof input.statusMessage === "string" ? input.statusMessage : undefined;
    if (
      label &&
      Object.values(AMER_TRANSACTION_STATUSES).some(
        (s) => s.name.toLowerCase() === label.toLowerCase(),
      )
    )
      score += 0.1;
    if (present(input.merchantReference)) score += 0.05;
    return { format: "trustly.amer.transaction", score, reasons };
  }

  // REST error body.
  if (Array.isArray(input.errors)) {
    const first = input.errors.find(isObj);
    if (!first) return undefined;
    const code = numKey(first.code);
    if (code === undefined) return undefined;
    const occurred = numKey(first.occurredAt) !== undefined || typeof first.occurredAt === "number";
    const domain = typeof first.domain === "string";
    const location = typeof first.location === "string";
    let score: number;
    const reasons = ["has errors[] with a numeric code"];
    if (occurred) {
      score = 0.6;
      reasons.push("errors[] items carry occurredAt");
      if (domain) score += 0.1;
      if (location) score += 0.05;
    } else if (domain && location) {
      score = 0.5;
      reasons.push("errors[] items carry domain and location");
    } else return undefined;
    if (lookup(AMER_INTERNAL_ERRORS, code)) {
      score += 0.1;
      reasons.push(`code ${code} is a documented Trustly internal error code`);
    }
    if ((meta?.http?.status ?? 0) >= 400) score += 0.03;
    return { format: "trustly.amer.error", score, reasons };
  }
  return undefined;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe objects carry `object`; Adyen notifications carry notificationItems.
  if ("object" in input || "notificationItems" in input) return none;
  const r = detectEu(input) ?? detectAmer(input, meta);
  if (!r || r.score <= 0) return none;
  const unsupportedReason = NOT_ANALYZED[r.format];
  return {
    provider: PROVIDER,
    format: r.format,
    confidence: round(r.score),
    supported: !unsupportedReason,
    reasons: r.reasons,
    ...(unsupportedReason ? { unsupportedReason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const Id = z.union([z.string().max(256), z.number()]);
const OptId = Id.nullable().optional();
const NStr = (max: number) => z.string().max(max).nullable().optional();
const NumOrStr = z
  .union([z.number(), z.string().max(64)])
  .nullable()
  .optional();

const EuNotificationData = z
  .looseObject({
    notificationid: OptId,
    notificationID: OptId,
    orderid: OptId,
    orderId: OptId,
    messageid: OptId,
    messageId: OptId,
    amount: NumOrStr,
    currency: NStr(16),
    timestamp: NStr(64),
  })
  .superRefine((d, ctx) => {
    if (!present(d.notificationid) && !present(d.notificationID))
      ctx.addIssue({
        code: "custom",
        path: ["notificationid"],
        message: "notificationid is required",
      });
    if (!present(d.orderid) && !present(d.orderId))
      ctx.addIssue({ code: "custom", path: ["orderid"], message: "orderid is required" });
  });

const EuNotification = z.looseObject({
  method: z.string().min(1).max(64),
  params: z.looseObject({
    signature: NStr(20000),
    uuid: NStr(128),
    data: EuNotificationData,
  }),
  version: z.literal("1.1"),
});

const EuResult = z.looseObject({
  result: z.looseObject({
    signature: NStr(20000),
    uuid: NStr(128),
    method: z.string().min(1).max(64),
    data: z.union([z.looseObject({}), z.array(z.unknown()).max(500)]),
  }),
  version: z.literal("1.1"),
});

const EuErrorBody = z
  .looseObject({
    name: NStr(64),
    code: NumOrStr,
    message: NStr(500),
    error: z
      .looseObject({
        uuid: NStr(128),
        method: NStr(64),
        data: z
          .looseObject({ code: NumOrStr, message: NStr(500) })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .superRefine((e, ctx) => {
    if (!present(e.code) && !present(e.message) && !present(e.error?.data?.code))
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: "error code or message is required",
      });
  });

const EuError = z.looseObject({ error: EuErrorBody });

const AmerEvent = z.looseObject({
  eventId: Id,
  eventType: z.string().min(1).max(64),
  objectId: Id,
  objectType: NStr(64),
  parentObjectId: OptId,
  merchantReference: OptId,
  transactionType: NumOrStr,
  paymentType: NumOrStr,
  status: NumOrStr,
  statusMessage: NStr(128),
  createdAt: NumOrStr,
  errorCode: NumOrStr,
  message: NStr(2000),
});

const AmerTransaction = z.looseObject({
  transactionId: Id,
  transactionType: NumOrStr,
  status: NumOrStr,
  statusMessage: NStr(128),
  paymentProviderTransaction: z
    .looseObject({
      status: NStr(32),
      statusMessage: NStr(256),
      statusDescription: NStr(500),
      thirdPartyDeclineCode: NumOrStr,
    })
    .nullable()
    .optional(),
  merchantReference: OptId,
  originalTransactionId: OptId,
  amount: NumOrStr,
  currency: NStr(16),
});

const AmerErrorItem = z.looseObject({
  domain: NStr(128),
  code: z.union([z.number().int(), z.string().max(16)]),
  location: NStr(256),
  message: NStr(2000),
  occurredAt: NumOrStr,
});

const AmerErrors = z.looseObject({ errors: z.array(AmerErrorItem).min(1).max(100) });

type EuNotificationT = z.infer<typeof EuNotification>;
type EuResultT = z.infer<typeof EuResult>;
type EuErrorT = z.infer<typeof EuError>;
type AmerEventT = z.infer<typeof AmerEvent>;
type AmerTransactionT = z.infer<typeof AmerTransaction>;
type AmerErrorsT = z.infer<typeof AmerErrors>;

export type TrustlyParsed =
  | { kind: "eu_notification"; value: EuNotificationT }
  | { kind: "eu_result"; value: EuResultT }
  | { kind: "eu_error"; value: EuErrorT }
  | { kind: "amer_event"; value: AmerEventT }
  | { kind: "amer_transaction"; value: AmerTransactionT }
  | { kind: "amer_error"; value: AmerErrorsT };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function run<S extends z.ZodType, K extends TrustlyParsed["kind"]>(
  schema: S,
  kind: K,
  input: unknown,
): { ok: true; value: TrustlyParsed } | { ok: false; issues: string[] } {
  const r = schema.safeParse(input);
  return r.success
    ? { ok: true, value: { kind, value: r.data } as TrustlyParsed }
    : { ok: false, issues: issuesOf(r.error) };
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: TrustlyParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case "trustly.eu.notification":
      return run(EuNotification, "eu_notification", input);
    case "trustly.eu.result":
      return run(EuResult, "eu_result", input);
    case "trustly.eu.error":
      return run(EuError, "eu_error", input);
    case "trustly.amer.event":
      return run(AmerEvent, "amer_event", input);
    case "trustly.amer.transaction":
      return run(AmerTransaction, "amer_transaction", input);
    case "trustly.amer.error":
      return run(AmerErrors, "amer_error", input);
    default:
      return { ok: false, issues: [`Unsupported Trustly format "${format}".`] };
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 300) ?? "";
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

function observedOf(ctx: NormalizeContext) {
  return ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
}

function euNotificationEvent(n: EuNotificationT, ctx: NormalizeContext): NormalizedEventDraft {
  const data = n.params.data as Record<string, unknown>;
  const extra = isObj(data.attributes) ? data.attributes : {};
  // Optional fields sit in data or in data.attributes depending on the type.
  const pick = (k: string) => (present(data[k]) ? data[k] : extra[k]);
  const method = n.method;
  const info = lookup(EU_NOTIFICATIONS, method);
  const nid = idOf(data.notificationid ?? data.notificationID);
  const currency = upperCurrency(data.currency);
  const amount = amountOf(data.amount, currency);
  const timestamp = euTimestamp(data.timestamp);
  let outcome: Outcome = info?.outcome ?? "unknown";
  const a: [string, unknown][] = [
    ["api", "EU JSON-RPC"],
    ["method", enumOf(method)],
    ["notificationMeaning", info?.meaning],
    ["optInNotification", info?.optIn],
  ];

  if (method === "kyc") {
    const abort = flag(pick("abort"));
    if (abort === true) {
      outcome = "failure";
      const msg = pick("abortmessage");
      const known = typeof msg === "string" ? lookup(EU_KYC_ABORT_MESSAGES, msg) : undefined;
      a.push(["kycAborted", true], ["kycAbortMessage", known ? msg : undefined]);
      a.push(["kycAbortMeaning", known]);
    } else if (abort === false) a.push(["kycAborted", false]);
  }
  if (method === "account" || method === "verifyAccount") {
    a.push(["accountVerified", flag(pick("verified"))]);
  }
  if (method === "cancel") {
    const statuses = pick("orderstatuses");
    if (Array.isArray(statuses))
      a.push([
        "orderStatuses",
        statuses.filter(
          (s): s is string => typeof s === "string" && EU_CANCEL_ORDER_STATUSES.has(s),
        ),
      ]);
    a.push(["lastOrderStep", enumOf(pick("lastorderstep"))]);
    if (Array.isArray(statuses) || present(pick("lastorderstep")))
      a.push([
        "cancelDetailNote",
        "Trustly advises not to automate on the detailed cancel fields.",
      ]);
    const reason = pick("reason");
    a.push([
      "cancelReason",
      typeof reason === "string" && EU_ERROR_NAME.test(reason) ? reason : undefined,
    ]);
    a.push(["schemeDetail", schemeDetail(data, extra)]);
  }
  if (method === "payoutfailed" || method === "payoutdowngraded") {
    const code = enumOf(pick("errorcode"));
    a.push(
      ["errorCode", code],
      ["errorCodeMeaning", code ? lookup(EU_PAYOUT_ERROR_CODES, code)?.meaning : undefined],
    );
    a.push([
      "errorMessage",
      typeof pick("errormessage") === "string" ? pick("errormessage") : undefined,
    ]);
  }
  if (method === "credit")
    a.push([
      "creditContext",
      "Shown as a received deposit; if this order is a payout or refund, the credit means it failed and the amount returned.",
    ]);
  if (method === "pending") a.push(["fundsReceived", false]);

  a.push(
    ["amountNotConvertible", amount.raw],
    ["timestampSource", timestamp ? "data.timestamp" : undefined],
    ["signaturePresent", present(n.params.signature)],
    ["signatureVerified", false],
    ["httpStatus", ctx.meta?.http?.status],
  );

  return clean({
    sourceFormat: ctx.format,
    eventType: enumOf(method) ?? "unknown",
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? "other",
    providerStatus: enumOf(method),
    eventReference: nid,
    paymentReference: idOf(data.orderid ?? data.orderId),
    merchantReference: traceOf(data.messageid ?? data.messageId),
    deliveryKey: nid ? `notification:${nid}` : undefined,
    eventTimestamp: timestamp,
    amountMinor: amount.minor,
    currency,
    outcome,
    attributes: attrs(a),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function schemeDetail(
  data: Record<string, unknown>,
  extra: Record<string, unknown>,
): string | undefined {
  for (const k of ["details", "detail", "failureReason"]) {
    const v = present(data[k]) ? data[k] : extra[k];
    if (typeof v === "string") return safeText(v, 200);
  }
  return undefined;
}

function euResultEvents(r: EuResultT, ctx: NormalizeContext): NormalizedEventDraft[] {
  const res = r.result;
  const method = res.method;
  const info = lookup(EU_METHODS, method);
  const base: [string, unknown][] = [
    ["api", "EU JSON-RPC"],
    ["method", enumOf(method)],
    ["methodMeaning", info?.meaning],
  ];
  const tail: [string, unknown][] = [
    ["signaturePresent", present(res.signature)],
    ["signatureVerified", false],
    ["httpStatus", ctx.meta?.http?.status],
  ];

  const entries: { item: Record<string, unknown>; path: string }[] = Array.isArray(res.data)
    ? res.data.flatMap((x, i) => (isObj(x) ? [{ item: x, path: `result.data[${i}]` }] : []))
    : [{ item: res.data as Record<string, unknown>, path: "result.data" }];

  const withState = entries.filter((e) => typeof e.item.transferstate === "string");
  if (withState.length > 0 || method === "GetWithdrawals") {
    return withState.map(({ item, path }) => {
      const state = item.transferstate as string;
      const s = lookup(EU_TRANSFER_STATES, state);
      const currency = upperCurrency(item.currency);
      const amount = amountOf(item.amount, currency);
      return clean({
        sourceFormat: ctx.format,
        eventType: "GetWithdrawals",
        eventTypeKnown: Boolean(s),
        stage: "payout",
        providerStatus: enumOf(state),
        paymentReference: idOf(item.orderid),
        merchantReference: traceOf(item.messageid),
        amountMinor: amount.minor,
        currency,
        outcome: s?.outcome ?? "unknown",
        attributes: attrs([
          ...base,
          ["transferState", enumOf(state)],
          ["transferStateMeaning", s?.meaning],
          ["transferStateUndocumented", s ? undefined : true],
          ["withdrawalReference", idOf(item.reference)],
          ["amountNotConvertible", amount.raw],
          ...tail,
        ]),
        source: { recordIndex: ctx.recordIndex, path },
        ...observedOf(ctx),
      });
    });
  }

  const data = isObj(res.data) ? res.data : {};
  const resultFlag = numKey(data.result);
  let outcome: Outcome = "unknown";
  let known = false;
  let resultMeaning: string | undefined;
  if (info?.results) {
    const rr = resultFlag !== undefined ? lookup(info.results, resultFlag) : undefined;
    if (rr) {
      outcome = rr.outcome;
      resultMeaning = rr.meaning;
      known = true;
    }
  } else if (info) {
    outcome = info.outcome ?? "unknown";
    known = true;
  }
  const rejected = typeof data.rejected === "string" ? enumOf(data.rejected) : undefined;
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: enumOf(method) ?? "unknown",
      eventTypeKnown: known,
      stage: info?.stage ?? "other",
      providerStatus: resultFlag !== undefined ? `result ${resultFlag}` : undefined,
      paymentReference: idOf(data.orderid),
      outcome,
      attributes: attrs([
        ...base,
        ["result", resultFlag],
        ["resultMeaning", resultMeaning],
        [
          "resultUndocumented",
          info?.results && !resultMeaning && resultFlag !== undefined ? true : undefined,
        ],
        ["checkoutUrlPresent", typeof data.url === "string" ? true : undefined],
        ["rejected", rejected],
        ...tail,
      ]),
      source: { recordIndex: ctx.recordIndex, path: "result" },
      ...observedOf(ctx),
    }),
  ];
}

function euErrorParts(e: EuErrorT) {
  const body = e.error;
  const innerData = body.error?.data ?? undefined;
  const code = numKey(body.code) ?? numKey(innerData?.code);
  const name = typeof body.message === "string" ? body.message : (innerData?.message ?? undefined);
  const m = body.error?.method;
  // JSON-RPC level errors carry uuid and method as the string "null".
  const method = typeof m === "string" && m !== "null" ? enumOf(m) : undefined;
  return { code, name: typeof name === "string" ? name : undefined, method };
}

function euErrorEvent(e: EuErrorT, ctx: NormalizeContext): NormalizedEventDraft {
  const { code, name, method } = euErrorParts(e);
  const entry = code ? lookup(EU_ERROR_CODES, code) : undefined;
  const nameOk = name && EU_ERROR_NAME.test(name) ? name : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: `error.${code ?? nameOk ?? "unknown"}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: nameOk ?? code,
    outcome: entry?.outcomeKnown ? "failure" : "unknown",
    attributes: attrs([
      ["api", "EU JSON-RPC"],
      ["errorCode", code],
      ["errorName", nameOk],
      ["method", method],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "error" },
    ...observedOf(ctx),
  });
}

type AmerStatus = {
  stage: LifecycleStage;
  outcome: Outcome;
  attributes: [string, unknown][];
  statusKey?: string;
};

/** Stage and outcome from the AMER transaction status, event type and transaction type. */
function amerStatus(raw: Record<string, unknown>, eventType: string | undefined): AmerStatus {
  const ev = eventType ? lookup(AMER_EVENT_TYPES, eventType) : undefined;
  const statusKey = numKey(raw.status);
  const st = statusKey !== undefined ? lookup(AMER_TRANSACTION_STATUSES, statusKey) : undefined;
  const ttKey = numKey(raw.transactionType);
  const tt = ttKey !== undefined ? lookup(AMER_TRANSACTION_TYPES, ttKey) : undefined;
  const ptKey = numKey(raw.paymentType);
  const stage: LifecycleStage =
    ev?.stage === "dispute" ? "dispute" : (st?.stage ?? ev?.stage ?? tt?.stage ?? "other");
  const outcome: Outcome = st
    ? st.outcome
    : statusKey !== undefined || present(raw.status)
      ? "unknown"
      : (ev?.outcome ?? "unknown");
  const pptCode = statusToken(pptField(raw, "status"));
  const ac = pptCode ? lookup(AMER_AC_CODES, pptCode) : undefined;
  return {
    stage,
    outcome,
    statusKey,
    attributes: [
      ["api", "North America REST"],
      ["eventTypeMeaning", ev?.meaning],
      ["status", statusKey],
      ["statusName", st?.name],
      ["statusUndocumented", present(raw.status) && !st ? true : undefined],
      ["statusMessage", enumOf(raw.statusMessage)],
      ["transactionType", ttKey],
      ["transactionTypeName", tt?.name],
      ["paymentType", ptKey],
      ["paymentTypeName", ptKey !== undefined ? lookup(AMER_PAYMENT_TYPES, ptKey) : undefined],
      ["providerTransactionStatus", pptCode],
      ["providerTransactionStatusMeaning", ac?.meaning ?? amerCode(pptCode)?.meaning],
      ["providerTransactionStatusMessage", enumOf(pptField(raw, "statusMessage"))],
      ["reasonCode", numKey(pptField(raw, "reasonCode"))],
      ["reasonCodeMessage", safeText(pptField(raw, "reasonCodeMessage"), 200)],
    ],
  };
}

function amerEventEvent(e: AmerEventT, ctx: NormalizeContext): NormalizedEventDraft {
  const raw = e as Record<string, unknown>;
  const s = amerStatus(raw, e.eventType);
  const eventId = idOf(e.eventId);
  const objectIsTransaction = !present(e.objectType) || e.objectType === "Transaction";
  const objectId = idOf(e.objectId);
  const retryAmount =
    typeof raw.suggestedRetryAmount === "string" &&
    /^\d{1,12}(?:\.\d{1,4})?$/.test(raw.suggestedRetryAmount)
      ? raw.suggestedRetryAmount
      : typeof raw.suggestedRetryAmount === "number"
        ? raw.suggestedRetryAmount
        : undefined;
  const created = msTimestamp(e.createdAt);
  return clean({
    sourceFormat: ctx.format,
    eventType: enumOf(e.eventType) ?? "unknown",
    eventTypeKnown: Boolean(lookup(AMER_EVENT_TYPES, e.eventType)),
    stage: s.stage,
    providerStatus: s.statusKey,
    eventReference: eventId,
    paymentReference: objectIsTransaction ? objectId : undefined,
    relatedReference: idOf(e.parentObjectId),
    merchantReference: traceOf(e.merchantReference),
    deliveryKey: eventId ? `event:${eventId}` : undefined,
    eventTimestamp: created,
    outcome: s.outcome,
    attributes: attrs([
      ...s.attributes,
      ["objectType", enumOf(e.objectType)],
      ["objectId", objectIsTransaction ? undefined : objectId],
      ["errorCode", enumOf(typeof e.errorCode === "number" ? String(e.errorCode) : e.errorCode)],
      ["suggestedRetryAmount", retryAmount],
      ["paymentProviderType", enumOf(raw.paymentProviderType)],
      ["message", safeText(e.message, 200)],
      ["timestampSource", created ? "createdAt" : undefined],
      ["signatureVerified", false],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function amerTransactionEvent(t: AmerTransactionT, ctx: NormalizeContext): NormalizedEventDraft {
  const raw = t as Record<string, unknown>;
  const s = amerStatus(raw, undefined);
  const currency = upperCurrency(t.currency);
  const amount = amountOf(t.amount, currency);
  const times: [string, unknown][] = [
    ["updatedAt", raw.updatedAt],
    ["completedAt", raw.completedAt],
    ["processedAt", raw.processedAt],
    ["createdAt", raw.createdAt],
  ];
  let timestamp: string | undefined;
  let timestampSource: string | undefined;
  for (const [k, v] of times) {
    const iso = msTimestamp(v);
    if (iso) {
      timestamp = iso;
      timestampSource = k;
      break;
    }
  }
  const ppt = t.paymentProviderTransaction ?? undefined;
  const decline = ppt
    ? (numKey(ppt.thirdPartyDeclineCode) ?? enumOf(ppt.thirdPartyDeclineCode))
    : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: `transaction.${s.statusKey !== undefined ? (lookup(AMER_TRANSACTION_STATUSES, s.statusKey)?.name ?? s.statusKey) : "unknown"}`,
    eventTypeKnown:
      s.statusKey !== undefined && Boolean(lookup(AMER_TRANSACTION_STATUSES, s.statusKey)),
    stage: s.stage,
    providerStatus: s.statusKey,
    paymentReference: idOf(t.transactionId),
    relatedReference: idOf(t.originalTransactionId),
    merchantReference: traceOf(t.merchantReference),
    eventTimestamp: timestamp,
    amountMinor: amount.minor,
    currency,
    outcome: s.outcome,
    attributes: attrs([
      ...s.attributes,
      [
        "providerTransactionId",
        ppt ? idOf((ppt as Record<string, unknown>).paymentProviderTransactionId) : undefined,
      ],
      ["thirdPartyDeclineCode", decline],
      ["providerTransactionDescription", safeText(ppt?.statusDescription, 200)],
      ["amountNotConvertible", amount.raw],
      ["timestampSource", timestampSource],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function amerErrorEvent(e: AmerErrorsT, ctx: NormalizeContext): NormalizedEventDraft {
  const codes = e.errors.slice(0, 20).map((x) => numKey(x.code) ?? "unknown");
  const known = codes.some((c) => lookup(AMER_INTERNAL_ERRORS, c)?.outcomeKnown);
  return clean({
    sourceFormat: ctx.format,
    eventType: `error.${codes[0] ?? "unknown"}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: codes[0],
    outcome: known ? "failure" : "unknown",
    attributes: attrs([
      ["api", "North America REST"],
      ["errorCodes", codes],
      ["errorCount", e.errors.length],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function normalize(parsed: TrustlyParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "eu_notification":
      return [euNotificationEvent(parsed.value, ctx)];
    case "eu_result":
      return euResultEvents(parsed.value, ctx);
    case "eu_error":
      return [euErrorEvent(parsed.value, ctx)];
    case "amer_event":
      return [amerEventEvent(parsed.value, ctx)];
    case "amer_transaction":
      return [amerTransactionEvent(parsed.value, ctx)];
    case "amer_error":
      return [amerErrorEvent(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & { paymentReference?: string };

const withRefs = (loc: Location) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference
    ? { paymentReference: loc.paymentReference, attemptReference: loc.paymentReference }
    : {}),
});

function docLinks(urls: readonly string[]): DocumentationLink[] {
  return [...new Set(urls)].map((url) => ({ title: docTitle(url), url }));
}

function docTitle(url: string): string {
  const page = url.replace(/\.md$/, "").split("/").pop() ?? "";
  if (url.startsWith("https://amer.developers.trustly.com/"))
    return `Trustly North America: ${page.replace(/-/g, " ")}`;
  return `Trustly API: ${page.replace(/-/g, " ")}`;
}

type DecodeInput = {
  code: string;
  mapping: ErrorMapping;
  confidence: Confidence;
  explanation: string;
  docs: readonly string[];
  missing: string[];
  subCodes: Record<string, string>;
  providerMessage?: string;
  outcomeKnown?: boolean;
  retryNote?: string;
};

function decoded(loc: Location, d: DecodeInput): DecodedErrorDraft {
  const retry = d.mapping.retry;
  return {
    ...withRefs(loc),
    code: d.code,
    subCodes: d.subCodes,
    category: d.mapping.category,
    ...(d.providerMessage ? { providerMessage: d.providerMessage } : {}),
    explanation: d.explanation,
    nextAction: NEXT_ACTION[d.mapping.category],
    retry,
    retryExplanation: d.retryNote ? `${d.retryNote} ${RETRY_TEXT[retry]}` : RETRY_TEXT[retry],
    confidence: d.confidence,
    documentation: docLinks(d.docs),
    missingInformation: d.missing,
    ...(d.outcomeKnown !== undefined ? { outcomeKnown: d.outcomeKnown } : {}),
  };
}

const UNKNOWN_MAPPING: ErrorMapping = { meaning: "", category: "unknown", retry: "unknown" };

/** EU error by numeric code and/or ERROR_ name. */
function decodeEuCode(
  codeIn: string | undefined,
  nameIn: string | undefined,
  loc: Location,
  subCodes: Record<string, string>,
  context: string,
): DecodedErrorDraft {
  const name = nameIn && EU_ERROR_NAME.test(nameIn) ? nameIn : undefined;
  let code = codeIn;
  let entry = code ? lookup(EU_ERROR_CODES, code) : undefined;
  const missing: string[] = [];
  let confidence: Confidence = "strong";
  if (!entry && name) {
    const byName = lookup(EU_ERROR_NAMES, name);
    if (byName) {
      if (code)
        missing.push(
          `Code ${safeText(code, 16)} is not documented; the documented code for ${name} is ${byName}.`,
        );
      code = byName;
      entry = lookup(EU_ERROR_CODES, byName);
      if (codeIn) confidence = "possible";
    }
  }
  if (name) subCodes.error_name = name;

  if (entry && code) {
    if (name && name !== entry.name) {
      confidence = "possible";
      missing.push(
        `The name ${name} does not match the documented name ${entry.name} for code ${code}; the code is used.`,
      );
    }
    if (code === "624")
      missing.push(
        "Trustly describes 624 differently per method (bank account number, IBAN or AccountID).",
      );
    if (code === "620")
      missing.push("ERROR_UNKNOWN gives no cause; the outcome of the request is not known.");
    return decoded(loc, {
      code,
      mapping: entry,
      confidence,
      explanation: `Trustly EU error ${code} (${entry.name})${context}: ${entry.meaning}.`,
      docs: [...entry.docs, EU_ERROR_HANDLING_URL],
      missing,
      subCodes,
      outcomeKnown: entry.outcomeKnown,
      retryNote:
        code === "619" || code === "620"
          ? "Trustly does not say whether the request took effect."
          : undefined,
    });
  }

  const other = name ? lookup(EU_OTHER_ERROR_NAMES, name) : undefined;
  if (other && name) {
    missing.push(`Trustly documents ${name} only by name; its meaning is not documented.`);
    return decoded(loc, {
      code: name,
      mapping: { meaning: "", category: "unknown", retry: "manual_review" },
      confidence: "possible",
      explanation: `Trustly EU value ${name}${context}. It appears in ${other.where}; Trustly documents no further meaning.`,
      docs: [...other.docs, EU_ERROR_HANDLING_URL],
      missing,
      subCodes,
      outcomeKnown: true,
    });
  }

  const shown = code ? safeText(code, 16) : name;
  missing.push(
    `Error ${shown ?? "without a code"} is not in the PandaPayLens catalog; Trustly can add codes without notice.`,
  );
  return decoded(loc, {
    code: code ?? name ?? "unknown",
    mapping: UNKNOWN_MAPPING,
    confidence: "insufficient",
    explanation: `PandaPayLens does not recognize the Trustly EU error ${shown ?? "(no code)"}${context}.`,
    docs: [EU_ERROR_HANDLING_URL],
    missing,
    subCodes,
  });
}

function decodePayoutFailed(n: EuNotificationT, loc: Location): DecodedErrorDraft {
  const data = n.params.data as Record<string, unknown>;
  const extra = isObj(data.attributes) ? data.attributes : {};
  const rawCode = present(data.errorcode) ? data.errorcode : extra.errorcode;
  const rawMsg = present(data.errormessage) ? data.errormessage : extra.errormessage;
  const code = enumOf(rawCode);
  const entry = code ? lookup(EU_PAYOUT_ERROR_CODES, code) : undefined;
  const providerMessage = safeText(rawMsg, 200);
  const missing: string[] = [];
  if (entry && !entry.informational) {
    missing.push("Trustly documents only example errorcode values for payoutfailed.");
    return decoded(loc, {
      code: code!,
      mapping: entry,
      confidence: "strong",
      explanation: `Trustly payoutfailed errorcode ${code}: ${entry.meaning}. The payout failed.`,
      docs: [EU_PAYOUT_FAILED_URL],
      missing,
      subCodes: {},
      outcomeKnown: true,
      ...(providerMessage ? { providerMessage } : {}),
    });
  }
  missing.push(
    code
      ? `errorcode ${code} is not documented; Trustly lists only example values.`
      : "The payoutfailed notification carries no errorcode, so the reason is unknown.",
  );
  return decoded(loc, {
    code: code ?? "payoutfailed",
    mapping: { meaning: "", category: "unknown", retry: "manual_review" },
    confidence: code ? "insufficient" : "possible",
    explanation: `The Trustly payout failed${code ? ` with errorcode ${code}` : ""}.${providerMessage ? " Trustly's errormessage is shown as the reason." : ""}`,
    docs: [EU_PAYOUT_FAILED_URL],
    missing,
    subCodes: {},
    outcomeKnown: true,
    ...(providerMessage ? { providerMessage } : {}),
  });
}

/** AMER status, return and reason code tables, by code shape. */
function amerCode(code: string | undefined): AmerCodeEntry | undefined {
  if (!code) return undefined;
  return (
    lookup(AMER_SW_CODES, code) ??
    lookup(AMER_UC_CODES, code) ??
    lookup(AMER_AC_CODES, code) ??
    lookup(AMER_SE_CODES, code) ??
    lookup(AMER_EFT_RETURN_CODES, code) ??
    lookup(AMER_UK_DD_CODES, code)
  );
}

const AMER_FAMILY_LABEL: Record<AmerCodeEntry["family"], string> = {
  SW: "validation status",
  UC: "user cancellation status",
  AC: "ACH/RTP status",
  SE: "system status",
  EFT: "EFT Canada return code",
  UK_DD: "UK Direct Debit (BACS) code",
};

function decodeAmerStatusCode(
  code: string,
  raw: Record<string, unknown>,
  loc: Location,
  finalFailure: boolean,
  field: string,
): DecodedErrorDraft | undefined {
  const entry = amerCode(code);
  if (entry?.notAnError) return undefined;
  const subCodes: Record<string, string> = { field };
  const missing: string[] = [];
  const providerMessage =
    safeText(pptField(raw, "statusMessage"), 200) ??
    safeText(pptField(raw, "statusDescription"), 200);

  if (!entry) {
    const ach = /^R\d{2}$/.test(code);
    missing.push(
      ach
        ? "ACH return codes R01 to R84 are referenced by Trustly but not enumerated."
        : `Code ${safeText(code, 16)} is not in the PandaPayLens catalog.`,
    );
    return decoded(loc, {
      code: safeText(code, 32) ?? "unknown",
      mapping: ach ? { meaning: "", category: "unknown", retry: "manual_review" } : UNKNOWN_MAPPING,
      confidence: "insufficient",
      explanation: ach
        ? `Trustly North America ACH return code ${code}; Trustly does not list its meaning.`
        : `PandaPayLens does not recognize the Trustly North America code ${safeText(code, 32)}.`,
      docs: [AMER_STATUS_CODES_URL],
      missing,
      subCodes,
      ...(finalFailure ? { outcomeKnown: true } : {}),
      ...(providerMessage ? { providerMessage } : {}),
    });
  }

  let mapping: ErrorMapping = entry;
  let explanation = `Trustly North America ${AMER_FAMILY_LABEL[entry.family]} ${code}: ${entry.meaning}.`;
  let retryNote: string | undefined;
  if (entry.family === "SW") {
    const reasonRaw = numKey(pptField(raw, "reasonCode"));
    if (reasonRaw !== undefined) {
      subCodes.reason_code = reasonRaw;
      const reason = lookup(AMER_REASON_CODES, reasonRaw);
      const ext = reason ? undefined : extendedReason(reasonRaw);
      if (reason) {
        explanation += ` Reason ${reasonRaw}: ${reason.meaning}.`;
        if (reason.status !== code)
          missing.push(`Reason ${reasonRaw} is documented for ${reason.status}, not ${code}.`);
      } else if (ext) {
        explanation += ` Extended reason ${reasonRaw}: ${ext.meaning}${ext.window ? ` (XXX = ${ext.window})` : ""}.`;
        if (ext.status !== code)
          missing.push(
            `Extended reason ${reasonRaw} is documented for ${ext.status}, not ${code}.`,
          );
        else if (ext.retry || ext.category)
          mapping = {
            meaning: ext.meaning,
            category: ext.category ?? entry.category,
            retry: ext.retry ?? entry.retry,
          };
      } else missing.push(`Reason code ${reasonRaw} is not documented.`);
    }
    if (code === "SW054")
      retryNote = "Trustly suggests trying again later or with a different bank account.";
  }
  if (entry.family === "SE")
    retryNote = "The outcome of the original request may be unknown; check the transaction first.";
  if (entry.family === "UK_DD" && entry.weak)
    missing.push("Trustly lists this BACS code without a transcribed meaning.");
  if (entry.family === "EFT" && code === "996")
    explanation += " This is a chargeback on the debit.";

  return decoded(loc, {
    code,
    mapping,
    confidence: entry.weak ? "possible" : "strong",
    explanation,
    docs: [AMER_STATUS_CODES_URL],
    missing,
    subCodes,
    ...(finalFailure || entry.family !== "SE" ? { outcomeKnown: true } : {}),
    ...(retryNote ? { retryNote } : {}),
    ...(providerMessage ? { providerMessage } : {}),
  });
}

function decodeAmerRecord(
  raw: Record<string, unknown>,
  loc: Location,
  errorCode: unknown,
): DecodedErrorDraft[] {
  const statusKey = numKey(raw.status);
  const finalFailure =
    statusKey !== undefined && lookup(AMER_TRANSACTION_STATUSES, statusKey)?.outcome === "failure";
  const out: DecodedErrorDraft[] = [];
  const ppt = pptField(raw, "status");
  const pptCode = statusToken(ppt);
  if (pptCode) {
    const d = decodeAmerStatusCode(
      pptCode,
      raw,
      loc,
      finalFailure,
      "paymentProviderTransaction.status",
    );
    if (d) out.push(d);
  }
  const ec = statusToken(typeof errorCode === "number" ? String(errorCode) : errorCode);
  if (ec && ec !== pptCode) {
    const d = decodeAmerStatusCode(ec, raw, loc, finalFailure, "errorCode");
    if (d) out.push(d);
  }
  return out;
}

function decodeAmerErrors(e: AmerErrorsT, ctx: NormalizeContext): DecodedErrorDraft[] {
  const http = ctx.meta?.http?.status;
  return e.errors.map((item, i) => {
    const loc: Location = {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: `errors[${i}]` },
    };
    const code = numKey(item.code) ?? safeText(String(item.code), 16) ?? "unknown";
    const entry = lookup(AMER_INTERNAL_ERRORS, code);
    const subCodes: Record<string, string> = {};
    const domain = enumOf(item.domain);
    if (domain) subCodes.domain = domain;
    if (typeof item.location === "string" && IDENTIFIER.test(item.location))
      subCodes.location = item.location;
    if (http !== undefined) subCodes.http_status = String(http);
    const providerMessage = safeText(item.message, 200);
    const docs = [
      AMER_STATUS_CODES_URL,
      AMER_OPENAPI_URL,
      ...(code === "210" ? [AMER_IDEMPOTENCY_URL] : []),
    ];
    if (entry)
      return decoded(loc, {
        code,
        mapping: entry,
        confidence: "strong",
        explanation: `Trustly North America error ${code}: ${entry.meaning}.`,
        docs,
        missing: [],
        subCodes,
        outcomeKnown: entry.outcomeKnown,
        ...(entry.outcomeKnown
          ? {}
          : { retryNote: "The request may or may not have taken effect." }),
        ...(providerMessage ? { providerMessage } : {}),
      });
    const server = http !== undefined && http >= 500;
    return decoded(loc, {
      code,
      mapping: server
        ? { meaning: "", category: "provider_unavailable", retry: "retry_conditionally" }
        : UNKNOWN_MAPPING,
      confidence: server ? "possible" : "insufficient",
      explanation: `PandaPayLens does not recognize the Trustly North America error code ${code}.${server ? ` The HTTP ${http} response suggests a server-side problem.` : ""}`,
      docs,
      missing: [
        `Error code ${code} is not in the PandaPayLens catalog.`,
        ...(http === undefined ? ["No HTTP status was supplied."] : []),
      ],
      subCodes,
      ...(providerMessage ? { providerMessage } : {}),
    });
  });
}

function decodeErrors(parsed: TrustlyParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const loc = (path: string, ref?: string): Location => ({
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ref ? { paymentReference: ref } : {}),
  });
  switch (parsed.kind) {
    case "eu_error": {
      const { code, name, method } = euErrorParts(parsed.value);
      const subCodes: Record<string, string> = {};
      if (method) subCodes.method = method;
      const http = ctx.meta?.http?.status;
      if (http !== undefined) subCodes.http_status = String(http);
      return [decodeEuCode(code, name, loc("error"), subCodes, method ? ` on ${method}` : "")];
    }
    case "eu_notification": {
      const n = parsed.value;
      const data = n.params.data as Record<string, unknown>;
      const ref = idOf(data.orderid ?? data.orderId);
      if (n.method === "payoutfailed") return [decodePayoutFailed(n, loc("params.data", ref))];
      if (n.method === "cancel") {
        const extra = isObj(data.attributes) ? data.attributes : {};
        const reason = present(data.reason) ? data.reason : extra.reason;
        if (typeof reason === "string" && EU_ERROR_NAME.test(reason)) {
          const d = decodeEuCode(
            undefined,
            reason,
            loc("params.data", ref),
            {},
            " in a cancel notification",
          );
          d.outcomeKnown = true;
          if (!d.documentation.some((x) => x.url === EU_CANCEL_URL))
            d.documentation.push({ title: docTitle(EU_CANCEL_URL), url: EU_CANCEL_URL });
          return [d];
        }
      }
      return [];
    }
    case "eu_result": {
      const data = parsed.value.result.data;
      if (isObj(data) && typeof data.rejected === "string" && EU_ERROR_NAME.test(data.rejected)) {
        const method = enumOf(parsed.value.result.method);
        return [
          decodeEuCode(
            undefined,
            data.rejected,
            loc("result.data", idOf(data.orderid)),
            method ? { method } : {},
            method ? ` on ${method}` : "",
          ),
        ];
      }
      return [];
    }
    case "amer_event": {
      const e = parsed.value;
      const objectIsTransaction = !present(e.objectType) || e.objectType === "Transaction";
      return decodeAmerRecord(
        e as Record<string, unknown>,
        loc("", objectIsTransaction ? idOf(e.objectId) : undefined),
        e.errorCode,
      );
    }
    case "amer_transaction": {
      const t = parsed.value;
      const out = decodeAmerRecord(
        t as Record<string, unknown>,
        loc("paymentProviderTransaction", idOf(t.transactionId)),
        undefined,
      );
      const decline = t.paymentProviderTransaction?.thirdPartyDeclineCode;
      const dc = numKey(decline) ?? enumOf(decline);
      if (dc) for (const d of out) d.subCodes.third_party_decline_code = dc;
      return out;
    }
    case "amer_error":
      return decodeAmerErrors(parsed.value, ctx);
  }
}

export const trustlyAdapter: ProviderAdapter<TrustlyParsed> = {
  id: PROVIDER,
  displayName: "Trustly",
  version: TRUSTLY_ADAPTER_VERSION,
  manifest: trustlyManifest,
  supportedFormats: [
    {
      id: "trustly.eu.notification",
      description:
        "EU JSON-RPC notification (credit, debit, pending, cancel, account, kyc, payoutconfirmation, payoutfailed, payoutdowngraded, verifyAccount, assessAccount, advice)",
    },
    {
      id: "trustly.eu.result",
      description:
        "EU JSON-RPC method result (Deposit, Refund, AccountPayout, ApproveWithdrawal, GetWithdrawals)",
    },
    { id: "trustly.eu.error", description: "EU JSON-RPC error envelope (JSONRPCError)" },
    {
      id: "trustly.amer.event",
      description:
        "North America event notification (eventId, eventType, objectId), form-encoded or JSON",
    },
    {
      id: "trustly.amer.transaction",
      description:
        "North America REST Transaction object (transactionId, status, paymentProviderTransaction)",
    },
    { id: "trustly.amer.error", description: "North America REST error body (errors[] with code)" },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // EU orderids and North America transaction ids are separate id spaces.
    // Merchant references (messageid, merchantReference) are never used.
    const family = event.sourceFormat.startsWith("trustly.amer.") ? "amer" : "eu";
    const keys: string[] = [];
    if (event.paymentReference) keys.push(`${family}:${event.paymentReference}`);
    if (event.relatedReference) keys.push(`${family}:${event.relatedReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export default trustlyAdapter;
