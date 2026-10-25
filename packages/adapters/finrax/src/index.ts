/**
 * Finrax adapter (crypto payments and crypto withdrawals).
 *
 * Supported input families:
 * - `finrax.payment`                       payment object with deposits[] and nested refunds
 * - `finrax.payment.create_response`       create or submit response (paymentInfo + paymentUrl)
 * - `finrax.callback.deposit_received`     deposit received callback
 * - `finrax.withdrawal`                    withdrawal created response (201)
 * - `finrax.withdrawal.pending_approval`   withdrawal pending approval response (202)
 * - `finrax.callback.withdrawal`           withdrawal broadcast callback
 * - `finrax.callback.withdrawal_approval`  withdrawal approval callback
 * - `finrax.error`                         error body
 *
 * Recognized but not supported: `finrax.payment.request` (a create payment
 * request sent to Finrax, which carries no result).
 *
 * Callbacks have no event type field; the callback type follows from the
 * payload shape. Detection relies on field structure only.
 */

import {
  decimalToMinor,
  lookup,
  safeId,
  safeText,
  upperCurrency,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type ProviderAdapter,
  type RecordMeta,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  APPROVAL_STATUSES,
  DEPOSIT_CALLBACK_URL,
  DEPOSIT_STATUSES,
  DOCUMENTED_COINS,
  ERRORS_URL,
  FETCH_PAYMENT_URL,
  HTTP_ERRORS,
  NEXT_ACTION_UNKNOWN,
  PAYMENT_STATUSES,
  REFUND_REASONS,
  REFUND_STATUSES,
  REFUND_TYPES,
  WITHDRAWAL_STATUSES,
  type ErrorAdvice,
  type StatusInfo,
} from "./catalog.js";
import { finraxManifest, FINRAX_ADAPTER_VERSION } from "./manifest.js";

export { finraxManifest, FINRAX_ADAPTER_VERSION };

export const FINRAX_FORMATS = {
  payment: "finrax.payment",
  createResponse: "finrax.payment.create_response",
  depositCallback: "finrax.callback.deposit_received",
  withdrawal: "finrax.withdrawal",
  pendingApproval: "finrax.withdrawal.pending_approval",
  withdrawalCallback: "finrax.callback.withdrawal",
  approvalCallback: "finrax.callback.withdrawal_approval",
  error: "finrax.error",
  paymentRequest: "finrax.payment.request",
} as const;

// ---------------------------------------------------------------------------
// Helpers

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Obj, k: string) => Object.hasOwn(o, k) && o[k] !== undefined;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(values: Record<string, SafePrimitive | SafePrimitive[] | undefined>): Attrs {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Attrs;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

/** Enum-like provider values (statuses, rate types, networks). */
function enumText(v: unknown, max = 40): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length <= max && /^[A-Za-z0-9_]+$/.test(t) ? t : undefined;
}

/** Coin or currency code as sent (BTC, USDT, EUR). */
function coin(v: unknown): string | undefined {
  return typeof v === "string" && /^[A-Za-z0-9]{2,12}$/.test(v.trim())
    ? v.trim().toUpperCase()
    : undefined;
}

const DECIMAL = /^(-?)(\d{1,30})(?:\.(\d{1,30}))?$/;

/** Decimal amount as text. API responses send strings, the deposit callback numbers. */
function decimalText(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return DECIMAL.test(t) ? t : undefined;
}

/** Compares two decimal strings exactly, without floating point. */
function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const pa = DECIMAL.exec(a)!;
  const pb = DECIMAL.exec(b)!;
  const scale = Math.max(pa[3]?.length ?? 0, pb[3]?.length ?? 0);
  const toInt = (m: RegExpExecArray) => BigInt(`${m[1]}${m[2]}${(m[3] ?? "").padEnd(scale, "0")}`);
  const x = toInt(pa);
  const y = toInt(pb);
  return x < y ? -1 : x > y ? 1 : 0;
}

const COINS = new Set<string>(DOCUMENTED_COINS);

/**
 * Display amounts in minor units. Only three-letter codes that are not a
 * documented coin are converted; crypto amounts stay decimal text.
 */
function displayMoney(amount: unknown, currency: unknown) {
  const cur = upperCurrency(currency);
  if (!cur || COINS.has(cur)) return {};
  const amountMinor = decimalToMinor(decimalText(amount), cur);
  return amountMinor === undefined ? {} : { amountMinor, currency: cur };
}

/** Finrax payload timestamps are Unix seconds. */
function unixSeconds(v: unknown): string | undefined {
  let n: number | undefined;
  if (typeof v === "number" && Number.isSafeInteger(v)) n = v;
  else if (typeof v === "string" && /^\d{1,12}$/.test(v.trim())) n = Number(v.trim());
  if (n === undefined || n <= 0 || n >= 1e11) return undefined;
  return new Date(n * 1000).toISOString();
}

/** Request path with identifier segments replaced, so no id or business id is kept. */
function pathTemplate(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.startsWith("/") || v.length > 512) return undefined;
  const path = v.split(/[?#]/)[0]!;
  return path
    .split("/")
    .map((s) => (s === "" || /^v\d{1,2}$/.test(s) || /^[a-z][a-z-]{0,39}$/.test(s) ? s : "{id}"))
    .join("/");
}

type AmountCheck =
  "actual_below_expected" | "actual_equals_expected" | "actual_above_expected" | "not_comparable";

/**
 * Compares the received amount with the expected one: display amounts first,
 * then deposit-currency amounts. An underpaid deposit has no Finrax status.
 */
function amountCheck(o: Obj): { check: AmountCheck; basis?: "display" | "deposit" } {
  const pairs: ["display" | "deposit", unknown, unknown][] = [
    ["display", o.expectedDisplayAmount, o.actualDisplayAmount],
    ["deposit", o.expectedDepositAmount, o.actualDepositAmount],
  ];
  for (const [basis, e, a] of pairs) {
    const expected = decimalText(e);
    const actual = decimalText(a);
    if (expected === undefined || actual === undefined) continue;
    if (compareDecimal(expected, "0") <= 0) continue;
    const c = compareDecimal(actual, expected);
    return {
      basis,
      check:
        c < 0
          ? "actual_below_expected"
          : c === 0
            ? "actual_equals_expected"
            : "actual_above_expected",
    };
  }
  return { check: "not_comparable" };
}

function resolveOutcome(info: StatusInfo | undefined, check: AmountCheck) {
  if (!info) return "unknown" as const;
  if (
    info.requiresAmountCheck &&
    check !== "actual_equals_expected" &&
    check !== "actual_above_expected"
  )
    return "unknown" as const;
  return info.outcome;
}

/** Signature headers are never verified; only presence is reported. */
function signatureAttrs(meta: RecordMeta | undefined): Attrs {
  const http = meta?.http;
  if (!http || http.kind !== "request") return { signatureVerified: false };
  return {
    signatureHeader: has(http.headers, "signature") ? "present" : "absent",
    timestampHeader: has(http.headers, "timestamp") ? "present" : "absent",
    signatureVerified: false,
  };
}

const statusName = (info: StatusInfo | undefined, raw: string) => (info ? raw.trim() : "unknown");
const safeStatus = (raw: string) => safeText(raw.trim(), 64) ?? "";

// ---------------------------------------------------------------------------
// Detection

const KNOWN_PAYMENT_STATUSES = new Set(Object.keys(PAYMENT_STATUSES));
const RATE_TYPES = new Set(["FIXED", "FLOATING"]);
const PAYMENT_TYPES = new Set(["ONE_TIME", "REUSABLE"]);

const PAYMENT_MARKERS = [
  "clientPaymentId",
  "displayCurrency",
  "expectedDisplayAmount",
  "actualDisplayAmount",
  "depositCurrency",
  "expectedNetwork",
  "expectedDepositAmount",
  "walletAddress",
  "destinationTag",
  "expirationMinutes",
  "paymentRequestedAt",
  "paymentInitiatedAt",
  "deposits",
];

/** Field families only Finrax payment objects carry. */
const PAYMENT_UNIQUE = [
  "overpaymentPolicy",
  "refundFollowUpDepositsForOneTimePayments",
  "expectedUniformAmount",
  "actualUniformAmount",
];

const DEPOSIT_CALLBACK_MARKERS = [
  "clientPaymentId",
  "depositCurrency",
  "displayCurrency",
  "expectedDepositAmount",
  "actualDepositAmount",
  "expectedDisplayAmount",
  "actualDisplayAmount",
  "depositAddress",
  "paymentReceivedAt",
  "paymentRequestedAt",
  "expirationTime",
  "onChainFee",
  "settlementAmount",
  "settlementCurrency",
];

const DEPOSIT_CALLBACK_UNIQUE = [
  "displayRateDepegLossAmount",
  "settlementRateDepegLossAmount",
  "settlementDistributedUserServiceFee",
  "displayDistributedUserServiceFee",
  "displayServiceFee",
  "settlementServiceFee",
];

const WITHDRAWAL_MARKERS = [
  "clientWithdrawId",
  "recipientAddress",
  "displayCurrency",
  "estimatedDisplayAmount",
  "withdrawCurrency",
  "estimatedWithdrawAmount",
  "settlementCurrency",
  "settlementDeductedAmount",
  "settlementServiceFee",
  "uniformCurrency",
  "uniformAmount",
  "createdAt",
];

/** Fields only the withdrawal broadcast callback lists (besides the shared ids). */
const BROADCAST_MARKERS = [
  "displayCurrency",
  "withdrawCurrency",
  "settlementCurrency",
  "expectedDisplayAmount",
  "actualDisplayAmount",
  "estimatedWithdrawAmount",
  "actualWithdrawAmount",
  "deductedSettlementAmount",
  "deducedSettlementAmount",
  "withdrawFee",
  "displayFee",
  "toTxAddress",
  "txAddressOwner",
  "displayRateDepegLossAmount",
  "settlementRateDepegLossAmount",
];

const BROADCAST_STATUSES = new Set(["COMPLETED", "FAILED", "BLOCKED"]);

type Detected = Omit<DetectionResult, "provider">;

function detectPaymentObject(o: Obj): Detected | null {
  if (!has(o, "paymentId") || has(o, "depositId")) return null;
  const markers = PAYMENT_MARKERS.filter((k) => has(o, k));
  const unique = PAYMENT_UNIQUE.filter((k) => has(o, k));
  const rate = RATE_TYPES.has(str(o.rateType) ?? "");
  const type = PAYMENT_TYPES.has(str(o.type) ?? "");
  if (markers.length + unique.length + (rate ? 1 : 0) < 2) return null;
  let c = 0.35 + Math.min(markers.length * 0.06, 0.3);
  const reasons = [`paymentId with ${[...markers, ...unique].join(", ")}`];
  if (unique.length) {
    c += 0.2;
    reasons.push("has Finrax-specific payment fields");
  }
  if (rate) {
    c += 0.05;
    reasons.push(`rateType "${str(o.rateType)}"`);
  }
  if (type) c += 0.03;
  if (str(o.processorType) === "BLOCKCHAIN") c += 0.05;
  if (KNOWN_PAYMENT_STATUSES.has(str(o.status) ?? "")) c += 0.05;
  return {
    format: FINRAX_FORMATS.payment,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectDepositCallback(o: Obj): Detected | null {
  if (!has(o, "paymentId") || !has(o, "depositId")) return null;
  const markers = DEPOSIT_CALLBACK_MARKERS.filter((k) => has(o, k));
  const unique = DEPOSIT_CALLBACK_UNIQUE.filter((k) => has(o, k));
  if (markers.length + unique.length < 2) return null;
  let c = 0.4 + Math.min(markers.length * 0.05, 0.3);
  const reasons = ["paymentId and depositId like a deposit received callback"];
  if (unique.length) {
    c += 0.15;
    reasons.push(`has ${unique.join(", ")}`);
  }
  if (RATE_TYPES.has(str(o.rateType) ?? "")) c += 0.05;
  if (lookup(DEPOSIT_STATUSES, str(o.status))) c += 0.05;
  return {
    format: FINRAX_FORMATS.depositCallback,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectWithdrawal(o: Obj): Detected | null {
  if (!has(o, "withdrawId")) return null;
  const markers = WITHDRAWAL_MARKERS.filter((k) => has(o, k));
  if (markers.length < 2) return null;
  let c = 0.4 + Math.min(markers.length * 0.06, 0.4);
  if (lookup(WITHDRAWAL_STATUSES, str(o.status))) c += 0.05;
  if (str(o.uniformCurrency) === "EUR") c += 0.05;
  return {
    format: FINRAX_FORMATS.withdrawal,
    confidence: round(c),
    supported: true,
    reasons: [`withdrawId with ${markers.join(", ")}`],
  };
}

function detectWithdrawalCallbacks(o: Obj, meta?: RecordMeta): Detected | null {
  if (!has(o, "withdrawalId") || has(o, "withdrawId")) return null;
  const status = str(o.status);
  const keys = Object.keys(o);

  // 202 response: { withdrawalId, clientLabel }.
  if (has(o, "clientLabel") && !has(o, "status")) {
    if (keys.some((k) => k !== "withdrawalId" && k !== "clientLabel")) return null;
    const is202 = meta?.http?.kind === "response" && meta.http.status === 202;
    return {
      format: FINRAX_FORMATS.pendingApproval,
      confidence: is202 ? 0.7 : 0.55,
      supported: true,
      reasons: [
        "only withdrawalId and clientLabel, like the withdrawal pending approval response",
        ...(is202 ? ["HTTP status 202"] : []),
      ],
    };
  }

  const broadcast = BROADCAST_MARKERS.filter((k) => has(o, k));
  if (broadcast.length > 0) {
    if (!has(o, "clientWithdrawalId") && broadcast.length < 2) return null;
    let c = 0.45 + Math.min(broadcast.length * 0.06, 0.3);
    if (has(o, "clientWithdrawalId")) c += 0.1;
    if (BROADCAST_STATUSES.has(status ?? "")) c += 0.05;
    if (isObj(o.txAddressOwner)) c += 0.05;
    return {
      format: FINRAX_FORMATS.withdrawalCallback,
      confidence: round(c),
      supported: true,
      reasons: [`withdrawalId with ${broadcast.join(", ")} like the withdrawal callback`],
    };
  }

  // Approval callback: only withdrawalId, clientWithdrawalId and status.
  if (!has(o, "clientWithdrawalId")) return null;
  if (keys.some((k) => !["withdrawalId", "clientWithdrawalId", "status"].includes(k))) {
    return null;
  }
  if (lookup(APPROVAL_STATUSES, status)) {
    return {
      format: FINRAX_FORMATS.approvalCallback,
      confidence: 0.6,
      supported: true,
      reasons: [`withdrawalId, clientWithdrawalId and approval status "${status}"`],
    };
  }
  if (BROADCAST_STATUSES.has(status ?? "")) {
    return {
      format: FINRAX_FORMATS.withdrawalCallback,
      confidence: 0.55,
      supported: true,
      reasons: [
        `withdrawalId, clientWithdrawalId and withdrawal status "${status}" without amounts`,
      ],
    };
  }
  return {
    format: FINRAX_FORMATS.approvalCallback,
    confidence: 0.45,
    supported: true,
    reasons: ["withdrawalId and clientWithdrawalId with an undocumented or missing status"],
    unsupportedReason:
      "The status is not a documented approval or withdrawal status, so this cannot be attributed to a Finrax callback reliably. Select the provider manually if it is one.",
  };
}

function detectError(o: Obj): Detected | null {
  const code = o.httpStatus;
  const codeOk =
    (typeof code === "number" && Number.isInteger(code)) ||
    (typeof code === "string" && /^\d{3}$/.test(code));
  if (!codeOk || typeof o.httpError !== "string") return null;
  let c = 0.4;
  const reasons = ["httpStatus and httpError like the Finrax error body"];
  if (typeof o.message === "string") c += 0.1;
  if (typeof o.path === "string") c += 0.1;
  if (typeof o.timestamp === "number") c += 0.1;
  if (/^\/api\/v\d+\//.test(str(o.path) ?? "")) {
    c += 0.1;
    reasons.push("path starts with /api/v1/");
  }
  if (Object.keys(o).length > 5) c -= 0.1;
  return { format: FINRAX_FORMATS.error, confidence: round(c), supported: true, reasons };
}

const REQUEST_MARKERS = [
  "displayCurrency",
  "expectedDisplayAmount",
  "depositCurrency",
  "expectedNetwork",
  "overpaymentPolicy",
  "expirationMinutes",
  "refundFollowUpDepositsForOneTimePayments",
];

function detectPaymentRequest(o: Obj, meta?: RecordMeta): Detected | null {
  if (!has(o, "clientPaymentId") || has(o, "paymentId") || has(o, "depositId")) return null;
  const markers = REQUEST_MARKERS.filter((k) => has(o, k));
  const http = meta?.http;
  const toPayments =
    http?.kind === "request" && http.method === "POST" && /\/v1\/payments$/.test(http.path ?? "");
  if (!toPayments && markers.length < 2) return null;
  return {
    format: FINRAX_FORMATS.paymentRequest,
    confidence: toPayments ? 0.6 : 0.55,
    supported: false,
    reasons: [
      toPayments
        ? "POST to /v1/payments with clientPaymentId"
        : `clientPaymentId with ${markers.join(", ")} and no paymentId`,
    ],
    unsupportedReason:
      "This looks like a create payment request sent to Finrax. It carries no result. Paste the response (paymentInfo), the payment object or the deposit callback instead.",
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: "finrax",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input) || meta?.format === "form") return none;
  if (meta?.http?.contentType && /form-urlencoded/i.test(meta.http.contentType)) return none;

  if (isObj(input.paymentInfo)) {
    const inner = detectPaymentObject(input.paymentInfo);
    if (inner) {
      const url = typeof input.paymentUrl === "string";
      return {
        provider: "finrax",
        format: FINRAX_FORMATS.createResponse,
        confidence: round(inner.confidence + (url ? 0.05 : 0)),
        supported: true,
        reasons: [
          "paymentInfo holds a Finrax payment object",
          ...(url ? ["has paymentUrl"] : []),
          ...inner.reasons,
        ],
      };
    }
  }
  const found =
    detectDepositCallback(input) ??
    detectPaymentObject(input) ??
    detectWithdrawal(input) ??
    detectWithdrawalCallbacks(input, meta) ??
    detectError(input) ??
    detectPaymentRequest(input, meta);
  return found ? { provider: "finrax", ...found } : none;
}

// ---------------------------------------------------------------------------
// Parsing

const optStr = (max: number) => z.string().max(max).nullish();
const id = (max = 128) => z.string().min(1).max(max);

const Refund = z.looseObject({
  type: optStr(32),
  status: optStr(64),
  reason: optStr(64),
});

const Deposit = z.looseObject({
  id: optStr(128),
  status: optStr(64),
  refund: Refund.nullish(),
});

const Payment = z.looseObject({
  paymentId: id(),
  status: z.string().min(1).max(64),
  clientPaymentId: optStr(256),
  type: optStr(32),
  rateType: optStr(32),
  displayCurrency: optStr(16),
  depositCurrency: optStr(16),
  deposits: z.array(Deposit).max(1000).nullish(),
});

const CreateResponse = z.looseObject({
  paymentInfo: Payment,
  paymentUrl: optStr(4096),
});

const DepositCallback = z.looseObject({
  paymentId: id(),
  depositId: id(),
  status: z.string().min(1).max(64),
  clientPaymentId: optStr(256),
  depositCurrency: optStr(16),
  displayCurrency: optStr(16),
});

const Withdrawal = z.looseObject({
  withdrawId: id(),
  status: z.string().min(1).max(64),
  clientWithdrawId: optStr(256),
  displayCurrency: optStr(16),
  withdrawCurrency: optStr(16),
});

const PendingApproval = z.looseObject({
  withdrawalId: id(),
  clientLabel: optStr(256),
});

const WithdrawalCallback = z.looseObject({
  withdrawalId: id(),
  status: z.string().min(1).max(64),
  clientWithdrawalId: optStr(256),
  displayCurrency: optStr(16),
  withdrawCurrency: optStr(16),
});

const ApprovalCallback = z.looseObject({
  withdrawalId: id(),
  status: z.string().min(1).max(64),
  clientWithdrawalId: optStr(256),
});

const ErrorBody = z.looseObject({
  httpStatus: z.union([z.number().int(), z.string().regex(/^\d{3}$/)]),
  httpError: optStr(256),
  message: optStr(5000),
  path: optStr(2048),
});

export type FinraxPayment = z.infer<typeof Payment>;

export type FinraxParsed =
  | { kind: "payment"; value: FinraxPayment; paymentUrl: boolean }
  | { kind: "deposit_callback"; value: z.infer<typeof DepositCallback> }
  | { kind: "withdrawal"; value: z.infer<typeof Withdrawal> }
  | { kind: "pending_approval"; value: z.infer<typeof PendingApproval> }
  | { kind: "withdrawal_callback"; value: z.infer<typeof WithdrawalCallback> }
  | { kind: "approval_callback"; value: z.infer<typeof ApprovalCallback> }
  | { kind: "error"; value: z.infer<typeof ErrorBody> };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: FinraxParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected a JSON object"] };
  const run = <S extends z.ZodType, K extends FinraxParsed["kind"]>(schema: S, kind: K) => {
    const r = schema.safeParse(input);
    return r.success
      ? ({ ok: true, value: { kind, value: r.data } } as { ok: true; value: FinraxParsed })
      : { ok: false as const, issues: issuesOf(r.error) };
  };
  switch (format) {
    case FINRAX_FORMATS.payment: {
      const r = Payment.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      return { ok: true, value: { kind: "payment", value: r.data, paymentUrl: false } };
    }
    case FINRAX_FORMATS.createResponse: {
      const r = CreateResponse.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      return {
        ok: true,
        value: {
          kind: "payment",
          value: r.data.paymentInfo,
          paymentUrl: typeof r.data.paymentUrl === "string" && r.data.paymentUrl !== "",
        },
      };
    }
    case FINRAX_FORMATS.depositCallback:
      return run(DepositCallback, "deposit_callback");
    case FINRAX_FORMATS.withdrawal:
      return run(Withdrawal, "withdrawal");
    case FINRAX_FORMATS.pendingApproval:
      return run(PendingApproval, "pending_approval");
    case FINRAX_FORMATS.withdrawalCallback:
      return run(WithdrawalCallback, "withdrawal_callback");
    case FINRAX_FORMATS.approvalCallback:
      return run(ApprovalCallback, "approval_callback");
    case FINRAX_FORMATS.error:
      return run(ErrorBody, "error");
  }
  return { ok: false, issues: [`Unsupported Finrax format "${safeText(format, 64) ?? ""}".`] };
}

// ---------------------------------------------------------------------------
// Normalization

function base(ctx: NormalizeContext, path = "") {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

const present = (o: Obj, k: string) =>
  has(o, k) && o[k] !== null && o[k] !== "" ? true : undefined;

function paymentEvents(
  p: FinraxPayment,
  paymentUrl: boolean,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const raw = p as Obj;
  const info = lookup(PAYMENT_STATUSES, p.status.trim());
  const paymentId = safeId(p.paymentId, 128);
  const { check, basis } = amountCheck(raw);
  const deposits = p.deposits ?? [];
  const status = p.status.trim();

  const events: NormalizedEventDraft[] = [
    clean({
      ...base(ctx),
      eventType: `payment.${statusName(info, status)}`,
      eventTypeKnown: Boolean(info),
      stage: info?.stage ?? "payment",
      providerStatus: `status=${safeStatus(p.status)}`,
      paymentReference: paymentId,
      merchantReference: merchantRef(p.clientPaymentId),
      // A snapshot carries no time of its last status change; only creation
      // (NEW) is dated, by paymentRequestedAt.
      eventTimestamp: status === "NEW" ? unixSeconds(raw.paymentRequestedAt) : undefined,
      ...displayMoney(raw.expectedDisplayAmount, p.displayCurrency),
      outcome: resolveOutcome(info, check),
      attributes: attrs({
        operation: "payment",
        paymentId,
        status: safeStatus(p.status),
        statusMeaning: info?.meaning,
        statusBasis: info?.basis,
        paymentType: enumText(p.type),
        rateType: enumText(p.rateType),
        displayCurrency: coin(p.displayCurrency),
        expectedDisplayAmount: decimalText(raw.expectedDisplayAmount),
        actualDisplayAmount: decimalText(raw.actualDisplayAmount),
        depositCurrency: coin(p.depositCurrency),
        expectedNetwork: enumText(raw.expectedNetwork),
        expectedDepositAmount: decimalText(raw.expectedDepositAmount),
        actualDepositAmount: decimalText(raw.actualDepositAmount),
        expectedUniformAmount: decimalText(raw.expectedUniformAmount),
        actualUniformAmount: decimalText(raw.actualUniformAmount),
        overpaymentPolicy: enumText(raw.overpaymentPolicy),
        refundFollowUpDeposits:
          typeof raw.refundFollowUpDepositsForOneTimePayments === "boolean"
            ? raw.refundFollowUpDepositsForOneTimePayments
            : undefined,
        processorType: enumText(raw.processorType),
        expirationMinutes:
          typeof raw.expirationMinutes === "number" && Number.isSafeInteger(raw.expirationMinutes)
            ? raw.expirationMinutes
            : undefined,
        paymentRequestedAt: unixSeconds(raw.paymentRequestedAt),
        paymentInitiatedAt: unixSeconds(raw.paymentInitiatedAt),
        archived: typeof raw.archived === "boolean" ? raw.archived : undefined,
        depositCount: Array.isArray(p.deposits) ? deposits.length : undefined,
        amountCheck: info?.requiresAmountCheck || check !== "not_comparable" ? check : undefined,
        amountCheckBasis: basis,
        underpaid: check === "actual_below_expected" ? true : undefined,
        paymentUrlPresent: paymentUrl ? true : undefined,
        settlementShown: false,
      }),
    }),
  ];

  deposits.forEach((d, i) => {
    const dRaw = d as Obj;
    const dStatus = (d.status ?? "").trim();
    const dInfo = dStatus ? lookup(DEPOSIT_STATUSES, dStatus) : undefined;
    const depositId = safeId(d.id, 128);
    const path = `deposits[${i}]`;
    events.push(
      clean({
        ...base(ctx, path),
        eventType: `deposit.${statusName(dInfo, dStatus)}`,
        eventTypeKnown: Boolean(dInfo),
        stage: dInfo?.stage ?? "payment",
        providerStatus: `status=${safeStatus(dStatus)}`,
        paymentReference: paymentId,
        relatedReference: depositId,
        eventTimestamp: unixSeconds(dRaw.depositReceivedAt),
        // The payment's own amounts decide whether a confirmed deposit completes it.
        outcome: resolveOutcome(dInfo, check),
        attributes: attrs({
          operation: "deposit",
          paymentId,
          depositId,
          status: safeStatus(dStatus),
          statusMeaning: dInfo?.meaning,
          statusBasis: dInfo?.basis,
          depositCurrency: coin(dRaw.depositCurrency),
          network: enumText(dRaw.network),
          depositAmount: decimalText(dRaw.depositAmount),
          onChainFee: decimalText(dRaw.onChainFee),
          paymentAmountCheck: dInfo?.requiresAmountCheck ? check : undefined,
          transactionIdPresent: present(dRaw, "transactionId"),
          riskAssessmentPresent:
            present(dRaw, "riskScore") || present(dRaw, "addressRiskAssessment"),
          settlementShown: false,
        }),
      }),
    );

    const refund = d.refund;
    if (!refund) return;
    const rRaw = refund as Obj;
    const rStatus = (refund.status ?? "").trim();
    const rInfo = rStatus ? lookup(REFUND_STATUSES, rStatus) : undefined;
    const reason = enumText(refund.reason, 64);
    const reasonInfo = reason ? lookup(REFUND_REASONS, reason) : undefined;
    const type = enumText(refund.type, 32);
    events.push(
      clean({
        ...base(ctx, `${path}.refund`),
        eventType: `refund.${statusName(rInfo, rStatus)}`,
        eventTypeKnown: Boolean(rInfo),
        stage: "refund",
        providerStatus: `status=${safeStatus(rStatus)}${reason ? `; reason=${reason}` : ""}`,
        paymentReference: paymentId,
        relatedReference: depositId,
        eventTimestamp:
          (rStatus === "CONFIRMED" ? unixSeconds(rRaw.confirmedAt) : undefined) ??
          unixSeconds(rRaw.initiatedAt) ??
          unixSeconds(rRaw.createdAt),
        outcome: rInfo?.outcome ?? "unknown",
        attributes: attrs({
          operation: "refund",
          paymentId,
          depositId,
          status: safeStatus(rStatus),
          statusMeaning: rInfo?.meaning,
          statusBasis: rInfo?.basis,
          refundType: type,
          refundTypeMeaning: type ? lookup(REFUND_TYPES, type) : undefined,
          refundReason: reason,
          refundReasonMeaning: reasonInfo?.meaning,
          refundReasonBasis: reasonInfo?.basis,
          // The refund amount carries no documented currency.
          refundAmount: decimalText(rRaw.amount),
          depositCurrency: coin(dRaw.depositCurrency),
          destinationAddressPresent: present(rRaw, "destinationAddress") ?? false,
          transactionIdPresent: present(rRaw, "transactionId"),
        }),
      }),
    );
  });
  return events;
}

function depositCallbackEvent(
  c: z.infer<typeof DepositCallback>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const raw = c as Obj;
  const status = c.status.trim();
  const info = lookup(DEPOSIT_STATUSES, status);
  const paymentId = safeId(c.paymentId, 128);
  const depositId = safeId(c.depositId, 128);
  const { check, basis } = amountCheck(raw);
  return clean({
    ...base(ctx),
    eventType: `deposit_received.${statusName(info, status)}`,
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? "payment",
    providerStatus: `status=${safeStatus(c.status)}`,
    paymentReference: paymentId,
    relatedReference: depositId,
    merchantReference: merchantRef(c.clientPaymentId),
    // No event or delivery id: the deposit id identifies the delivery.
    deliveryKey: depositId ? `deposit:${depositId}:${status}` : undefined,
    eventTimestamp: unixSeconds(raw.paymentReceivedAt),
    ...displayMoney(raw.actualDisplayAmount, c.displayCurrency),
    outcome: resolveOutcome(info, check),
    attributes: attrs({
      operation: "deposit",
      paymentId,
      depositId,
      status: safeStatus(c.status),
      statusMeaning: info?.meaning,
      statusBasis: info?.basis,
      rateType: enumText(raw.rateType),
      depositCurrency: coin(c.depositCurrency),
      network: enumText(raw.network),
      expectedDepositAmount: decimalText(raw.expectedDepositAmount),
      actualDepositAmount: decimalText(raw.actualDepositAmount),
      displayCurrency: coin(c.displayCurrency),
      expectedDisplayAmount: decimalText(raw.expectedDisplayAmount),
      actualDisplayAmount: decimalText(raw.actualDisplayAmount),
      displayServiceFee: decimalText(raw.displayServiceFee),
      onChainFee: decimalText(raw.onChainFee),
      settlementCurrency: coin(raw.settlementCurrency),
      settlementAmount: decimalText(raw.settlementAmount),
      settlementServiceFee: decimalText(raw.settlementServiceFee),
      paymentRequestedAt: unixSeconds(raw.paymentRequestedAt),
      expirationTime: unixSeconds(raw.expirationTime),
      amountCheck: check,
      amountCheckBasis: basis,
      underpaid: check === "actual_below_expected" ? true : undefined,
      transactionIdPresent: present(raw, "transactionId"),
      settlementShown: false,
      ...signatureAttrs(ctx.meta),
    }),
  });
}

function withdrawalEvent(
  w: z.infer<typeof Withdrawal>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const raw = w as Obj;
  const status = w.status.trim();
  const info = lookup(WITHDRAWAL_STATUSES, status);
  const withdrawalId = safeId(w.withdrawId, 128);
  return clean({
    ...base(ctx),
    eventType: `withdrawal.${statusName(info, status)}`,
    eventTypeKnown: Boolean(info),
    stage: "payout",
    providerStatus: `status=${safeStatus(w.status)}`,
    paymentReference: withdrawalId,
    merchantReference: merchantRef(w.clientWithdrawId),
    eventTimestamp: unixSeconds(raw.createdAt),
    ...displayMoney(raw.estimatedDisplayAmount, w.displayCurrency),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      operation: "withdrawal",
      withdrawalId,
      status: safeStatus(w.status),
      statusMeaning: info?.meaning,
      statusBasis: info?.basis,
      network: enumText(raw.network),
      displayCurrency: coin(w.displayCurrency),
      estimatedDisplayAmount: decimalText(raw.estimatedDisplayAmount),
      withdrawCurrency: coin(w.withdrawCurrency),
      estimatedWithdrawAmount: decimalText(raw.estimatedWithdrawAmount),
      settlementCurrency: coin(raw.settlementCurrency),
      settlementDeductedAmount: decimalText(raw.settlementDeductedAmount),
      settlementServiceFee: decimalText(raw.settlementServiceFee),
      uniformCurrency: coin(raw.uniformCurrency),
      uniformAmount: decimalText(raw.uniformAmount),
      amountsAreEstimates: true,
    }),
  });
}

function pendingApprovalEvent(
  w: z.infer<typeof PendingApproval>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const withdrawalId = safeId(w.withdrawalId, 128);
  const http = ctx.meta?.http?.kind === "response" ? ctx.meta.http.status : undefined;
  return clean({
    ...base(ctx),
    eventType: "withdrawal.pending_approval",
    eventTypeKnown: true,
    stage: "payout",
    providerStatus: http ? `HTTP ${http}; pending approval` : "pending approval",
    paymentReference: withdrawalId,
    merchantReference: merchantRef(w.clientLabel),
    outcome: "pending",
    attributes: attrs({
      operation: "withdrawal",
      withdrawalId,
      statusMeaning:
        "Withdrawal waits for a dashboard approver; withdrawalId becomes the withdrawal's id",
      httpStatus: http,
    }),
  });
}

function withdrawalCallbackEvent(
  w: z.infer<typeof WithdrawalCallback>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const raw = w as Obj;
  const status = w.status.trim();
  const info = lookup(WITHDRAWAL_STATUSES, status);
  const withdrawalId = safeId(w.withdrawalId, 128);
  const deducted = has(raw, "deductedSettlementAmount")
    ? "deductedSettlementAmount"
    : has(raw, "deducedSettlementAmount")
      ? "deducedSettlementAmount"
      : undefined;
  const amount = has(raw, "actualDisplayAmount")
    ? raw.actualDisplayAmount
    : raw.expectedDisplayAmount;
  return clean({
    ...base(ctx),
    eventType: `withdrawal_callback.${statusName(info, status)}`,
    eventTypeKnown: Boolean(info),
    stage: "payout",
    providerStatus: `status=${safeStatus(w.status)}`,
    paymentReference: withdrawalId,
    merchantReference: merchantRef(w.clientWithdrawalId),
    deliveryKey: withdrawalId ? `withdrawal:${withdrawalId}:${status}` : undefined,
    ...displayMoney(amount, w.displayCurrency),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      operation: "withdrawal",
      withdrawalId,
      status: safeStatus(w.status),
      statusMeaning: info?.meaning,
      statusBasis: info?.basis,
      displayCurrency: coin(w.displayCurrency),
      expectedDisplayAmount: decimalText(raw.expectedDisplayAmount),
      actualDisplayAmount: decimalText(raw.actualDisplayAmount),
      withdrawCurrency: coin(w.withdrawCurrency),
      estimatedWithdrawAmount: decimalText(raw.estimatedWithdrawAmount),
      actualWithdrawAmount: decimalText(raw.actualWithdrawAmount),
      settlementCurrency: coin(raw.settlementCurrency),
      deductedSettlementAmount: deducted ? decimalText(raw[deducted]) : undefined,
      deductedSettlementAmountField: deducted,
      withdrawFee: decimalText(raw.withdrawFee),
      displayFee: decimalText(raw.displayFee),
      transactionIdPresent: present(raw, "transactionId"),
      addressOwnerScreeningPresent: isObj(raw.txAddressOwner) ? true : undefined,
      ...signatureAttrs(ctx.meta),
    }),
  });
}

function approvalCallbackEvent(
  a: z.infer<typeof ApprovalCallback>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const status = a.status.trim();
  const info = lookup(APPROVAL_STATUSES, status);
  const withdrawalId = safeId(a.withdrawalId, 128);
  return clean({
    ...base(ctx),
    eventType: `withdrawal_approval.${statusName(info, status)}`,
    eventTypeKnown: Boolean(info),
    stage: "payout",
    providerStatus: `status=${safeStatus(a.status)}`,
    paymentReference: withdrawalId,
    merchantReference: merchantRef(a.clientWithdrawalId),
    deliveryKey: withdrawalId ? `withdrawal_approval:${withdrawalId}:${status}` : undefined,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      operation: "withdrawal_approval",
      withdrawalId,
      status: safeStatus(a.status),
      statusMeaning: info?.meaning,
      statusBasis: info?.basis,
      ...signatureAttrs(ctx.meta),
    }),
  });
}

function httpCode(v: number | string): string {
  return String(v).trim();
}

function errorEvent(e: z.infer<typeof ErrorBody>, ctx: NormalizeContext): NormalizedEventDraft {
  const raw = e as Obj;
  const code = httpCode(e.httpStatus);
  const httpError = safeText(e.httpError ?? undefined, 64);
  const metaStatus = ctx.meta?.http?.kind === "response" ? ctx.meta.http.status : undefined;
  return clean({
    ...base(ctx),
    eventType: `error.http_${code}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: `httpStatus=${code}${httpError ? `; httpError=${httpError}` : ""}`,
    eventTimestamp: unixSeconds(raw.timestamp),
    outcome: "failure",
    attributes: attrs({
      httpStatus: Number(code),
      httpError,
      codeDocumented: Boolean(lookup(HTTP_ERRORS, code)),
      pathTemplate: pathTemplate(e.path),
      responseStatusDiffers:
        metaStatus !== undefined && String(metaStatus) !== code ? true : undefined,
    }),
  });
}

function normalize(parsed: FinraxParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "payment":
      return paymentEvents(parsed.value, parsed.paymentUrl, ctx);
    case "deposit_callback":
      return [depositCallbackEvent(parsed.value, ctx)];
    case "withdrawal":
      return [withdrawalEvent(parsed.value, ctx)];
    case "pending_approval":
      return [pendingApprovalEvent(parsed.value, ctx)];
    case "withdrawal_callback":
      return [withdrawalCallbackEvent(parsed.value, ctx)];
    case "approval_callback":
      return [approvalCallbackEvent(parsed.value, ctx)];
    case "error":
      return [errorEvent(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding

const docs = (url: string, title: string): DocumentationLink[] => [{ title, url }];

function adviceDraft(
  advice: ErrorAdvice,
  ctx: NormalizeContext,
  o: {
    code: string;
    field: string;
    object: string;
    path?: string;
    documentation: string;
    basis?: string;
    paymentReference?: string;
    attemptReference?: string;
  },
): DecodedErrorDraft {
  const missing: string[] = [];
  if (o.basis === "inferred")
    missing.push(`Finrax does not define ${o.code}; its meaning is inferred from the name.`);
  if (o.basis === "not_documented") missing.push(`Finrax does not document what ${o.code} means.`);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: o.path ?? "" },
    code: o.code,
    subCodes: { field: o.field, object: o.object },
    category: advice.category,
    explanation: advice.explanation,
    nextAction: advice.nextAction,
    retry: advice.retry,
    retryExplanation: advice.retryExplanation,
    confidence: advice.confidence,
    documentation: docs(o.documentation, "Finrax documentation"),
    missingInformation: missing,
    ...(o.paymentReference ? { paymentReference: o.paymentReference } : {}),
    ...(o.attemptReference ? { attemptReference: o.attemptReference } : {}),
    // A reported status is a definitive answer about this object.
    outcomeKnown: true,
  };
}

function statusError(
  table: Record<string, StatusInfo>,
  raw: string | null | undefined,
  ctx: NormalizeContext,
  o: { field: string; object: string; path?: string; ref?: string; attempt?: string },
): DecodedErrorDraft[] {
  const status = (raw ?? "").trim();
  const info = status ? lookup(table, status) : undefined;
  if (!info?.error) return [];
  return [
    adviceDraft(info.error, ctx, {
      code: status,
      field: o.field,
      object: o.object,
      documentation: info.documentation,
      basis: info.basis,
      ...(o.path !== undefined ? { path: o.path } : {}),
      ...(o.ref ? { paymentReference: o.ref } : {}),
      ...(o.attempt ? { attemptReference: o.attempt } : {}),
    }),
  ];
}

function paymentErrors(p: FinraxPayment, ctx: NormalizeContext): DecodedErrorDraft[] {
  const ref = safeId(p.paymentId, 128);
  const out = statusError(PAYMENT_STATUSES, p.status, ctx, {
    field: "status",
    object: "payment",
    ...(ref ? { ref, attempt: ref } : {}),
  });
  (p.deposits ?? []).forEach((d, i) => {
    const depositId = safeId(d.id, 128);
    const path = `deposits[${i}]`;
    const attempt = depositId ?? ref;
    out.push(
      ...statusError(DEPOSIT_STATUSES, d.status, ctx, {
        field: `${path}.status`,
        object: "deposit",
        path,
        ...(ref ? { ref } : {}),
        ...(attempt ? { attempt } : {}),
      }),
    );
    const refund = d.refund;
    if (!refund) return;
    out.push(
      ...statusError(REFUND_STATUSES, refund.status, ctx, {
        field: `${path}.refund.status`,
        object: "refund",
        path: `${path}.refund`,
        ...(ref ? { ref } : {}),
        ...(attempt ? { attempt } : {}),
      }),
    );
    const reason = (refund.reason ?? "").trim();
    const reasonInfo = reason ? lookup(REFUND_REASONS, reason) : undefined;
    if (reasonInfo?.error) {
      out.push(
        adviceDraft(reasonInfo.error, ctx, {
          code: reason,
          field: `${path}.refund.reason`,
          object: "refund",
          path: `${path}.refund`,
          documentation: FETCH_PAYMENT_URL,
          basis: reasonInfo.basis,
          ...(ref ? { paymentReference: ref } : {}),
          ...(attempt ? { attemptReference: attempt } : {}),
        }),
      );
    }
  });
  return out;
}

function httpError(e: z.infer<typeof ErrorBody>, ctx: NormalizeContext): DecodedErrorDraft {
  const code = httpCode(e.httpStatus);
  const entry = lookup(HTTP_ERRORS, code);
  const providerMessage = safeText(e.message ?? undefined, 300);
  const httpErrorText = safeText(e.httpError ?? undefined, 64);
  const template = pathTemplate(e.path);
  const metaStatus = ctx.meta?.http?.kind === "response" ? ctx.meta.http.status : undefined;
  const missing = [
    "Finrax returns no provider error code; the HTTP status and the message are the only diagnosis.",
  ];
  if (metaStatus !== undefined && String(metaStatus) !== code)
    missing.push(
      `The HTTP response status (${metaStatus}) differs from httpStatus in the body (${code}).`,
    );
  const subCodes: Record<string, string> = { field: "httpStatus" };
  if (httpErrorText) subCodes.httpError = httpErrorText;
  if (template) subCodes.pathTemplate = template;
  if (!entry) {
    missing.push(`HTTP status ${code} is not in the Finrax error table.`);
    return {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: "" },
      code,
      subCodes,
      category: "unknown",
      ...(providerMessage ? { providerMessage } : {}),
      explanation: `Finrax answered with HTTP ${code}, which its error table does not list.`,
      nextAction: NEXT_ACTION_UNKNOWN,
      retry: "unknown",
      retryExplanation:
        "Whether the request took effect is not known. Check its result before sending it again.",
      confidence: "insufficient",
      documentation: docs(ERRORS_URL, "Finrax errors"),
      missingInformation: missing,
    };
  }
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code,
    subCodes,
    category: entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: entry.explanation,
    nextAction: entry.nextAction,
    retry: entry.retry,
    retryExplanation: entry.retryExplanation,
    confidence: "strong",
    documentation: [
      { title: "Finrax errors", url: ERRORS_URL },
      ...(entry.documentation !== ERRORS_URL
        ? [{ title: "Finrax documentation", url: entry.documentation }]
        : []),
    ],
    missingInformation: missing,
    // A 4xx is a definitive rejection; for 5xx the request's effect is unknown.
    ...(entry.outcomeUnknown ? {} : { outcomeKnown: true }),
  };
}

function decodeErrors(parsed: FinraxParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "payment":
      return paymentErrors(parsed.value, ctx);
    case "deposit_callback": {
      const ref = safeId(parsed.value.paymentId, 128);
      const attempt = safeId(parsed.value.depositId, 128);
      return statusError(DEPOSIT_STATUSES, parsed.value.status, ctx, {
        field: "status",
        object: "deposit",
        ...(ref ? { ref } : {}),
        ...(attempt ? { attempt } : {}),
      });
    }
    case "withdrawal": {
      const ref = safeId(parsed.value.withdrawId, 128);
      return statusError(WITHDRAWAL_STATUSES, parsed.value.status, ctx, {
        field: "status",
        object: "withdrawal",
        ...(ref ? { ref, attempt: ref } : {}),
      });
    }
    case "withdrawal_callback": {
      const ref = safeId(parsed.value.withdrawalId, 128);
      return statusError(WITHDRAWAL_STATUSES, parsed.value.status, ctx, {
        field: "status",
        object: "withdrawal",
        ...(ref ? { ref, attempt: ref } : {}),
      });
    }
    case "approval_callback": {
      const ref = safeId(parsed.value.withdrawalId, 128);
      return statusError(APPROVAL_STATUSES, parsed.value.status, ctx, {
        field: "status",
        object: "withdrawal_approval",
        ...(ref ? { ref, attempt: ref } : {}),
      });
    }
    case "pending_approval":
      return [];
    case "error":
      return [httpError(parsed.value, ctx)];
  }
}

export const finraxAdapter: ProviderAdapter<FinraxParsed> = {
  id: "finrax",
  displayName: "Finrax",
  version: FINRAX_ADAPTER_VERSION,
  manifest: finraxManifest,
  supportedFormats: [
    {
      id: FINRAX_FORMATS.payment,
      description: "Payment object with deposits[] and nested refunds (GET /v1/payments/{id})",
    },
    {
      id: FINRAX_FORMATS.createResponse,
      description: "Create or submit payment response (paymentInfo and paymentUrl)",
    },
    {
      id: FINRAX_FORMATS.depositCallback,
      description: "Deposit received callback (paymentId, depositId, status, amounts)",
    },
    {
      id: FINRAX_FORMATS.withdrawal,
      description: "Withdrawal created response (withdrawId, clientWithdrawId, status)",
    },
    {
      id: FINRAX_FORMATS.pendingApproval,
      description: "Withdrawal pending approval response (withdrawalId, clientLabel)",
    },
    {
      id: FINRAX_FORMATS.withdrawalCallback,
      description: "Withdrawal broadcast callback (COMPLETED, FAILED or BLOCKED)",
    },
    {
      id: FINRAX_FORMATS.approvalCallback,
      description: "Withdrawal approval callback (APPROVED, PENDING, REJECTED or SKIPPED)",
    },
    {
      id: FINRAX_FORMATS.error,
      description: "Error body (timestamp, httpStatus, httpError, message, path)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // paymentId links a payment, its deposits and their refunds; depositId
    // links a deposit callback to the same deposit inside a payment object.
    // The 202 withdrawalId is documented to become the withdrawal id, and
    // withdrawId and withdrawalId are the same id spelled two ways. Client
    // references are never used, and chain hashes are not copied at all.
    const keys: string[] = [];
    const a = event.attributes;
    if (typeof a.paymentId === "string" && a.paymentId) keys.push(`payment:${a.paymentId}`);
    if (typeof a.depositId === "string" && a.depositId) keys.push(`deposit:${a.depositId}`);
    if (typeof a.withdrawalId === "string" && a.withdrawalId)
      keys.push(`withdrawal:${a.withdrawalId}`);
    return keys;
  },
};

export * from "./catalog.js";
export default finraxAdapter;
