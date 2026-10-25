/**
 * PayPal adapter.
 *
 * Supported input families:
 * - `paypal.api_error`              REST error response `{ name, message, debug_id, details[] }`
 * - `paypal.order`                  Orders v2 order resource (create/get/capture/authorize responses)
 * - `paypal.payment_resource`       Payments v2 capture, authorization or refund resource
 * - `paypal.webhook`                Webhook event envelope (`event_type`, `resource`)
 * - `paypal.webhook.verify_request` verify-webhook-signature body; only `webhook_event` is used
 *
 * Recognized but not supported: subscription webhooks (`BILLING.SUBSCRIPTION.*`)
 * and OAuth token errors (`{ error, error_description }`).
 *
 * The order status never decides the payment outcome: a COMPLETED order can
 * contain a DECLINED capture, and APPROVED only means the buyer consented.
 * Outcomes come from captures, authorizations and refunds.
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
  AUTHORIZATION_STATUSES,
  AUTHORIZATION_STATUS_URL,
  CAPTURE_STATUSES,
  CAPTURE_STATUS_URL,
  CARD_DECLINE_URL,
  ERRORS_OVERVIEW_URL,
  ERROR_NAMES,
  ERROR_NAME_ALIASES,
  IDEMPOTENCY_URL,
  ISSUES,
  OAUTH_ERROR_NAMES,
  ORDERS_ERRORS_URL,
  ORDER_STATUSES,
  PAYMENTS_API_URL,
  PAYMENT_FAILURES_URL,
  PROCESSOR_RESPONSE_CODES,
  PROCESSOR_RESPONSE_URL,
  REFUND_STATUSES,
  RESPONSES_URL,
  RISK_FILTER_DECLINE,
  STATUS_REASONS,
  UNSUPPORTED_EVENT_FAMILIES,
  WEBHOOK_EVENTS,
  type CatalogEntry,
  type ResourceKind,
  type StatusInfo,
  type WebhookEventInfo,
} from "./catalog.js";

import { paypalManifest, PAYPAL_ADAPTER_VERSION } from "./manifest.js";

export { paypalManifest, PAYPAL_ADAPTER_VERSION };

const Money = z.looseObject({
  currency_code: z.string().max(8).optional(),
  value: z.string().max(40).optional(),
});

const Link = z.looseObject({
  href: z.string().max(4096).optional(),
  rel: z.string().max(64).optional(),
  method: z.string().max(16).optional(),
});

// `value` is deliberately not declared: it can echo caller data (card
// numbers, postal codes) and is never read.
const ErrorDetail = z.looseObject({
  issue: z.string().max(128).optional(),
  field: z.string().max(512).optional(),
  location: z.string().max(32).optional(),
  description: z.string().optional(),
});

const ApiError = z.looseObject({
  name: z.string().max(128),
  message: z.string().optional(),
  debug_id: z.string().max(128).optional(),
  details: z.array(ErrorDetail).optional(),
  links: z.array(Link).optional(),
});

const RelatedIds = z.looseObject({
  order_id: z.string().max(64).optional(),
  authorization_id: z.string().max(64).optional(),
  capture_id: z.string().max(64).optional(),
});

const Resource = z.looseObject({
  id: z.string().max(128).optional(),
  status: z.string().max(64).optional(),
  amount: Money.optional(),
  final_capture: z.boolean().optional(),
  status_details: z.looseObject({ reason: z.string().max(128).optional() }).optional(),
  processor_response: z
    .looseObject({
      avs_code: z.string().max(16).optional(),
      cvv_code: z.string().max(16).optional(),
      response_code: z.string().max(16).optional(),
      payment_advice_code: z.string().max(16).optional(),
    })
    .optional(),
  supplementary_data: z.looseObject({ related_ids: RelatedIds.optional() }).optional(),
  seller_protection: z.looseObject({ status: z.string().max(64).optional() }).optional(),
  links: z.array(Link).optional(),
  create_time: z.string().max(64).optional(),
  update_time: z.string().max(64).optional(),
  expiration_time: z.string().max(64).optional(),
});

const StandaloneResource = Resource.extend({
  id: z.string().max(128),
  status: z.string().max(64),
});

const PurchaseUnit = z.looseObject({
  amount: Money.optional(),
  payments: z
    .looseObject({
      captures: z.array(Resource).optional(),
      authorizations: z.array(Resource).optional(),
      refunds: z.array(Resource).optional(),
    })
    .optional(),
});

const Order = z.looseObject({
  id: z.string().max(128).optional(),
  // Only in CHECKOUT.PAYMENT-APPROVAL.REVERSED resources.
  order_id: z.string().max(128).optional(),
  status: z.string().max(64).optional(),
  intent: z.string().max(32).optional(),
  purchase_units: z.array(PurchaseUnit).optional(),
  links: z.array(Link).optional(),
  create_time: z.string().max(64).optional(),
  update_time: z.string().max(64).optional(),
});

const StandaloneOrder = Order.extend({
  id: z.string().max(128),
  status: z.string().max(64),
});

// resource_type, resource_version and links are optional: an official
// sample (CHECKOUT.PAYMENT-APPROVAL.REVERSED) omits them.
const Webhook = z.looseObject({
  id: z.string().max(256).optional(),
  event_type: z.string().max(128),
  create_time: z.string().max(64).optional(),
  resource_type: z.string().max(64).optional(),
  resource_version: z.string().max(16).optional(),
  event_version: z.string().max(16).optional(),
  resource: z.looseObject({}),
});

type ApiErrorT = z.infer<typeof ApiError>;
type ResourceT = z.infer<typeof Resource>;
type OrderT = z.infer<typeof Order>;
type WebhookT = z.infer<typeof Webhook>;

type WebhookResource =
  | { type: "order"; value: OrderT }
  | { type: "payment"; kind: ResourceKind | null; value: ResourceT }
  | { type: "other"; value: ResourceT };

export type PaypalParsed =
  | { kind: "api_error"; value: ApiErrorT }
  | { kind: "order"; value: OrderT }
  | { kind: "payment_resource"; resourceKind: ResourceKind | null; value: ResourceT }
  | {
      kind: "webhook";
      value: WebhookT;
      resource: WebhookResource;
      /** Path of the event inside the record ("" or "webhook_event"). */
      path: string;
    };

const KIND_PLURAL: Record<ResourceKind, "captures" | "authorizations" | "refunds"> = {
  capture: "captures",
  authorization: "authorizations",
  refund: "refunds",
};

const STATUS_TABLES: Record<ResourceKind, Record<string, StatusInfo>> = {
  capture: CAPTURE_STATUSES,
  authorization: AUTHORIZATION_STATUSES,
  refund: REFUND_STATUSES,
};

const EVENT_TYPE_RE = /^[A-Z][A-Z0-9_-]*(\.[A-Z0-9_-]+)+$/;
const ERROR_NAME_RE = /^[A-Z][A-Z0-9_]{2,127}$/;
/** related_ids.order_id is documented as ^[A-Z0-9]+$, max 20; other PayPal ids look alike. */
const PAYPAL_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function paypalId(v: unknown): string | undefined {
  const id = safeId(v, 64);
  return id && PAYPAL_ID_RE.test(id) ? id : undefined;
}

type LinkTarget = { kind: "order" | ResourceKind; id: string };

/** Reads the resource a REST link points at, e.g. `/v2/checkout/orders/{id}`. Never rendered. */
function linkTarget(href: unknown): LinkTarget | undefined {
  if (typeof href !== "string" || href.length > 4096) return undefined;
  const m =
    /\/v2\/(?:checkout\/orders|payments\/(captures|authorizations|refunds))\/([A-Za-z0-9-]{1,64})(?=[/?#]|$)/.exec(
      href,
    );
  if (!m) return undefined;
  const kind =
    m[1] === "captures"
      ? "capture"
      : m[1] === "authorizations"
        ? "authorization"
        : m[1] === "refunds"
          ? "refund"
          : "order";
  return { kind, id: m[2]! };
}

function findLink(links: unknown, rel: string): Record<string, unknown> | undefined {
  if (!Array.isArray(links)) return undefined;
  return links.find((l): l is Record<string, unknown> => isObj(l) && l.rel === rel);
}

function hasLinkRel(links: unknown, rels: readonly string[]): boolean {
  return Array.isArray(links) && links.some((l) => isObj(l) && rels.includes(String(l.rel)));
}

/** The order id carried as `token=` in approve and payer-action URLs. */
function orderIdFromActionLink(links: unknown): string | undefined {
  for (const rel of ["payer-action", "approve"]) {
    const href = findLink(links, rel)?.href;
    if (typeof href !== "string" || href.length > 4096) continue;
    const m = /[?&]token=([A-Z0-9]{1,20})(?:&|#|$)/.exec(href);
    if (m) return m[1];
  }
  return undefined;
}

const uniqueStatus = (
  status: unknown,
  table: Record<string, StatusInfo>,
  others: Record<string, StatusInfo>[],
) => typeof status === "string" && status in table && others.every((t) => !(status in t));

/** Capture, authorization or refund, from the self link, distinctive fields, or a status unique to one kind. */
function inferKind(o: Record<string, unknown>): ResourceKind | null {
  const self = linkTarget(findLink(o.links, "self")?.href);
  if (self && self.kind !== "order") return self.kind;
  if (typeof o.final_capture === "boolean" || isObj(o.seller_receivable_breakdown))
    return "capture";
  if (typeof o.expiration_time === "string") return "authorization";
  // A refund's parent is a capture (rel=up or related_ids.capture_id).
  if (linkTarget(findLink(o.links, "up")?.href)?.kind === "capture") return "refund";
  const related = isObj(o.supplementary_data) ? o.supplementary_data.related_ids : undefined;
  if (isObj(related) && typeof related.capture_id === "string") return "refund";
  if (uniqueStatus(o.status, CAPTURE_STATUSES, [AUTHORIZATION_STATUSES, REFUND_STATUSES]))
    return "capture";
  if (uniqueStatus(o.status, AUTHORIZATION_STATUSES, [CAPTURE_STATUSES, REFUND_STATUSES]))
    return "authorization";
  if (uniqueStatus(o.status, REFUND_STATUSES, [CAPTURE_STATUSES, AUTHORIZATION_STATUSES]))
    return "refund";
  return null;
}

const none = (): DetectionResult => ({
  provider: "paypal",
  format: null,
  confidence: 0,
  supported: false,
  reasons: [],
});

const round = (n: number) => Math.round(n * 100) / 100;

function detectWebhook(o: Record<string, unknown>): DetectionResult | null {
  const eventType = o.event_type;
  if (typeof eventType !== "string" || !EVENT_TYPE_RE.test(eventType)) return null;
  const reasons = ["event_type is an uppercase dotted event name"];
  let c = 0.4;
  if (isObj(o.resource)) {
    c = 0.75;
    reasons.push("has a resource object");
  }
  if (typeof o.id === "string" && o.id.startsWith("WH-")) {
    c += 0.15;
    reasons.push("id has the WH- prefix");
  }
  if (typeof o.create_time === "string" || typeof o.summary === "string") c += 0.05;
  if (
    typeof o.resource_type === "string" ||
    typeof o.resource_version === "string" ||
    typeof o.event_version === "string"
  ) {
    c += 0.03;
    reasons.push("has resource_type / resource_version / event_version");
  }
  const family = UNSUPPORTED_EVENT_FAMILIES.find((f) => eventType.startsWith(f.prefix));
  if (family) {
    return {
      provider: "paypal",
      format: "paypal.webhook.subscription",
      confidence: round(c),
      supported: false,
      reasons,
      unsupportedReason: `PayPal ${family.family} webhooks (${safeText(eventType, 64)}) are recognized but not analyzed. PandaPayLens analyzes Orders v2 and Payments v2 events only.`,
    };
  }
  return {
    provider: "paypal",
    format: "paypal.webhook",
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectError(o: Record<string, unknown>): DetectionResult | null {
  if (typeof o.name !== "string" || !ERROR_NAME_RE.test(o.name)) return null;
  const knownName = (ERROR_NAME_ALIASES[o.name] ?? o.name) in ERROR_NAMES;
  const hasIssues =
    Array.isArray(o.details) && o.details.some((d) => isObj(d) && typeof d.issue === "string");
  const reasons = [
    knownName ? `name "${o.name}" is a documented PayPal error name` : "has an UPPER_SNAKE name",
  ];
  let c: number;
  if (typeof o.debug_id === "string") {
    c = knownName ? 0.95 : 0.85;
    reasons.push("has debug_id");
  } else if (hasIssues) {
    c = knownName ? 0.85 : 0.7;
    reasons.push("has details[].issue");
  } else if (hasLinkRel(o.links, ["information_link"])) {
    c = 0.7;
    reasons.push("has an information_link");
  } else if (knownName && typeof o.message === "string") {
    // `{ name, message }` alone is too generic to claim.
    c = 0.4;
  } else {
    return null;
  }
  return {
    provider: "paypal",
    format: "paypal.api_error",
    confidence: c,
    supported: true,
    reasons,
  };
}

function detectOrder(o: Record<string, unknown>): DetectionResult | null {
  const knownStatus = typeof o.status === "string" && o.status in ORDER_STATUSES;
  const intent = o.intent === "CAPTURE" || o.intent === "AUTHORIZE";
  const units = Array.isArray(o.purchase_units);
  const actionLinks = hasLinkRel(o.links, ["approve", "payer-action"]);
  const reasons: string[] = [];
  if (knownStatus) reasons.push(`status "${String(o.status)}" is an order status`);
  if (intent) reasons.push("intent is CAPTURE or AUTHORIZE");
  if (units) reasons.push("has purchase_units[]");
  if (actionLinks) reasons.push("has an approve or payer-action link");
  let c: number;
  if (units && knownStatus && intent) c = 0.95;
  else if (units && (knownStatus || (intent && typeof o.id === "string"))) c = 0.85;
  else if (knownStatus && actionLinks) c = 0.75;
  else if (knownStatus && intent) c = 0.55;
  else return null;
  return { provider: "paypal", format: "paypal.order", confidence: c, supported: true, reasons };
}

function detectResource(o: Record<string, unknown>): DetectionResult | null {
  const self = linkTarget(findLink(o.links, "self")?.href);
  const selfKind = self && self.kind !== "order" ? self.kind : undefined;
  if (typeof o.status !== "string" && !selfKind) return null;
  const money =
    isObj(o.amount) &&
    typeof o.amount.currency_code === "string" &&
    typeof o.amount.value === "string";
  const markers = [
    isObj(o.seller_receivable_breakdown) && "seller_receivable_breakdown",
    isObj(o.seller_protection) && "seller_protection",
    typeof o.final_capture === "boolean" && "final_capture",
    isObj(o.supplementary_data) &&
      isObj(o.supplementary_data.related_ids) &&
      "supplementary_data.related_ids",
    isObj(o.processor_response) && "processor_response",
  ].filter((x): x is string => Boolean(x));
  const reasons = [
    ...(selfKind ? [`self link points at /v2/payments/${KIND_PLURAL[selfKind]}/`] : []),
    ...(money ? ["amount is { currency_code, value }"] : []),
    ...markers.map((m) => `has ${m}`),
  ];
  let c: number;
  if (selfKind) c = money || markers.length > 0 ? 0.95 : 0.8;
  else if (money && markers.length > 0) c = markers.length > 1 ? 0.9 : 0.85;
  else return null;
  return {
    provider: "paypal",
    format: "paypal.payment_resource",
    confidence: c,
    supported: true,
    reasons,
  };
}

function detectOAuth(o: Record<string, unknown>): DetectionResult | null {
  if (typeof o.error !== "string" || typeof o.error_description !== "string") return null;
  if (!OAUTH_ERROR_NAMES.has(o.error.toUpperCase())) return null;
  // The OAuth error shape is shared by many providers, so this stays below the detection threshold.
  return {
    provider: "paypal",
    format: "paypal.oauth_error",
    confidence: 0.3,
    supported: false,
    reasons: ["has error and error_description like an OAuth token error"],
    unsupportedReason:
      "This looks like an OAuth token error ({ error, error_description }). PayPal's identity API uses this shape, but so do many others; PandaPayLens does not analyze it. Check the client id, secret and environment.",
  };
}

function detect(input: unknown): DetectionResult {
  if (!isObj(input)) return none();

  if (
    isObj(input.webhook_event) &&
    (typeof input.transmission_sig === "string" ||
      typeof input.webhook_id === "string" ||
      typeof input.cert_url === "string")
  ) {
    const inner = detectWebhook(input.webhook_event);
    if (inner && inner.confidence >= 0.5) {
      const reasons = ["verify-webhook-signature body with webhook_event", ...inner.reasons];
      return inner.supported
        ? { ...inner, format: "paypal.webhook.verify_request", reasons }
        : { ...inner, reasons };
    }
  }

  return (
    detectWebhook(input) ??
    detectError(input) ??
    detectOrder(input) ??
    detectResource(input) ??
    detectOAuth(input) ??
    none()
  );
}

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const p = [prefix, i.path.join(".")].filter(Boolean).join(".");
    return `${p || "(root)"}: ${i.message}`;
  });
}

function parseWebhook(
  input: unknown,
  path: string,
): { ok: true; value: PaypalParsed } | { ok: false; issues: string[] } {
  const r = Webhook.safeParse(input);
  if (!r.success) return { ok: false, issues: issuesOf(r.error, path) };
  const info = WEBHOOK_EVENTS[r.data.event_type];
  const raw = r.data.resource;
  const resPath = [path, "resource"].filter(Boolean).join(".");
  let resource: WebhookResource;
  if (info?.resource === "order") {
    const o = Order.safeParse(raw);
    if (!o.success) return { ok: false, issues: issuesOf(o.error, resPath) };
    resource = { type: "order", value: o.data };
  } else if (info) {
    const p = Resource.safeParse(raw);
    if (!p.success) return { ok: false, issues: issuesOf(p.error, resPath) };
    const kind = info.resource === "capture_or_refund" ? inferKind(raw) : info.resource;
    resource = { type: "payment", kind, value: p.data };
  } else {
    // Unknown event: the resource shape is unknown, so only documented
    // identifiers are read and a mismatch is not an error.
    const p = Resource.safeParse(raw);
    resource = { type: "other", value: p.success ? p.data : {} };
  }
  return { ok: true, value: { kind: "webhook", value: r.data, resource, path } };
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PaypalParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case "paypal.api_error": {
      const r = ApiError.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "api_error", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "paypal.order": {
      const r = StandaloneOrder.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "order", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "paypal.payment_resource": {
      const r = StandaloneResource.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      return {
        ok: true,
        value: { kind: "payment_resource", resourceKind: inferKind(r.data), value: r.data },
      };
    }
    case "paypal.webhook":
      return parseWebhook(input, "");
    case "paypal.webhook.verify_request":
      return isObj(input) && isObj(input.webhook_event)
        ? parseWebhook(input.webhook_event, "webhook_event")
        : { ok: false, issues: ["webhook_event: expected an object"] };
    default:
      return { ok: false, issues: [`Unsupported PayPal format "${format}".`] };
  }
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeText(x, 64) ?? "");
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function money(m: { currency_code?: string | undefined; value?: string | undefined } | undefined) {
  const currency = upperCurrency(m?.currency_code);
  return { currency, amountMinor: decimalToMinor(m?.value, currency) };
}

function httpStatusOf(meta: RecordMeta | undefined): number | undefined {
  return meta?.http?.kind === "response" ? meta.http.status : undefined;
}

type ResourceDescription = {
  id: string | undefined;
  status: string | undefined;
  statusInfo: StatusInfo | undefined;
  paymentReference: string | undefined;
  relatedReference: string | undefined;
  orderId: string | undefined;
  amountMinor: string | undefined;
  currency: string | undefined;
  eventTimestamp: string | undefined;
  attributes: Attrs;
};

/**
 * References, status and safe attributes of a capture, authorization or refund.
 * Links to the order come from supplementary_data.related_ids, then the rel=up
 * link, then the purchase unit the resource was nested in.
 */
function describeResource(
  kind: ResourceKind | null,
  r: ResourceT,
  nestedInOrder?: string,
): ResourceDescription {
  const id = paypalId(r.id);
  const related = r.supplementary_data?.related_ids;
  const up = linkTarget(findLink(r.links, "up")?.href);
  const fromUp = (k: LinkTarget["kind"]) => (up?.kind === k ? up.id : undefined);

  const relOrder = paypalId(related?.order_id);
  const orderId = relOrder ?? fromUp("order") ?? nestedInOrder;
  const linkedVia = relOrder
    ? "related_ids"
    : fromUp("order")
      ? "up_link"
      : nestedInOrder
        ? "purchase_unit"
        : null;
  const parentAuthorizationId =
    kind === "authorization"
      ? undefined
      : (paypalId(related?.authorization_id) ?? fromUp("authorization"));
  const parentCaptureId =
    kind === "capture" ? undefined : (paypalId(related?.capture_id) ?? fromUp("capture"));

  const paymentReference = orderId ?? parentAuthorizationId ?? parentCaptureId ?? id;
  const status = r.status;
  const statusInfo = kind && status ? STATUS_TABLES[kind][status] : undefined;
  const reason = r.status_details?.reason;
  const pr = r.processor_response;
  const { amountMinor, currency } = money(r.amount);

  return {
    id,
    status,
    statusInfo,
    paymentReference,
    relatedReference: id && id !== paymentReference ? id : undefined,
    orderId,
    amountMinor,
    currency,
    eventTimestamp: toIsoTimestamp(r.update_time ?? r.create_time),
    attributes: attrs([
      ["resourceKind", kind],
      ["orderId", orderId],
      ["parentAuthorizationId", parentAuthorizationId],
      ["parentCaptureId", parentCaptureId],
      ["linkedVia", linkedVia],
      ["finalCapture", r.final_capture],
      ["statusReason", reason ? safeId(reason, 64) : undefined],
      ["statusReasonDescription", reason ? STATUS_REASONS[reason] : undefined],
      ["processorResponseCode", safeId(pr?.response_code, 16)],
      [
        "processorResponseToken",
        pr?.response_code ? PROCESSOR_RESPONSE_CODES[pr.response_code]?.token : undefined,
      ],
      ["avsCode", safeId(pr?.avs_code, 16)],
      ["cvvCode", safeId(pr?.cvv_code, 16)],
      ["paymentAdviceCode", safeId(pr?.payment_advice_code, 16)],
      ["sellerProtection", safeId(r.seller_protection?.status, 64)],
      ["createTime", toIsoTimestamp(r.create_time)],
      ["updateTime", toIsoTimestamp(r.update_time)],
      ["expirationTime", toIsoTimestamp(r.expiration_time)],
    ]),
  };
}

function describeOrder(o: OrderT, raw: Record<string, unknown>) {
  const id = paypalId(o.id) ?? paypalId(o.order_id);
  const units = o.purchase_units ?? [];
  const count = (k: "captures" | "authorizations" | "refunds") =>
    units.reduce((n, u) => n + (u.payments?.[k]?.length ?? 0), 0);
  // Amounts of several purchase units are not added up: they can differ in currency.
  const { amountMinor, currency } = units.length === 1 ? money(units[0]!.amount) : money(undefined);
  const source = isObj(raw.payment_source)
    ? Object.keys(raw.payment_source)
        .filter((k) => /^[a-z_]{1,32}$/.test(k))
        .slice(0, 5)
    : undefined;
  return {
    id,
    status: o.status,
    amountMinor,
    currency,
    eventTimestamp: toIsoTimestamp(o.update_time ?? o.create_time),
    attributes: attrs([
      ["resourceKind", "order"],
      ["intent", o.intent ? safeId(o.intent, 32) : undefined],
      ["purchaseUnitCount", units.length],
      ["captureCount", count("captures")],
      ["authorizationCount", count("authorizations")],
      ["refundCount", count("refunds")],
      ["paymentSourceTypes", source],
      ["hasApproveLink", hasLinkRel(o.links, ["approve"])],
      ["hasPayerActionLink", hasLinkRel(o.links, ["payer-action"])],
      ["createTime", toIsoTimestamp(o.create_time)],
      ["updateTime", toIsoTimestamp(o.update_time)],
    ]),
  };
}

/** One event per capture, authorization and refund nested in an order's purchase units. */
function nestedPayments(
  o: OrderT,
  orderId: string | undefined,
  ctx: NormalizeContext,
  observed: { observedTimestamp?: string },
): NormalizedEventDraft[] {
  const out: NormalizedEventDraft[] = [];
  (o.purchase_units ?? []).forEach((unit, i) => {
    for (const kind of ["authorization", "capture", "refund"] as const) {
      (unit.payments?.[KIND_PLURAL[kind]] ?? []).forEach((res, j) => {
        const d = describeResource(kind, res, orderId);
        out.push(
          clean({
            sourceFormat: ctx.format,
            eventType: `${kind}.snapshot`,
            eventTypeKnown: true,
            stage: d.statusInfo?.stage ?? kind,
            providerStatus: d.status ? safeText(d.status, 64) : undefined,
            paymentReference: d.paymentReference,
            relatedReference: d.relatedReference,
            eventTimestamp: d.eventTimestamp,
            amountMinor: d.amountMinor,
            currency: d.currency,
            outcome: d.statusInfo?.outcome ?? "unknown",
            attributes: { ...d.attributes, purchaseUnitIndex: i },
            source: {
              recordIndex: ctx.recordIndex,
              path: `purchase_units[${i}].payments.${KIND_PLURAL[kind]}[${j}]`,
            },
            ...observed,
          }),
        );
      });
    }
  });
  return out;
}

/**
 * Event outcomes come from the event name. Two events are refined by the
 * resource status: AUTHORIZATION.CREATED (which also covers pending
 * authorizations) and CAPTURE.REFUNDED (whose resource kind is undocumented).
 */
function webhookOutcome(
  eventType: string,
  info: WebhookEventInfo,
  kind: ResourceKind | null,
  status: string | undefined,
): Outcome {
  if (eventType === "PAYMENT.AUTHORIZATION.CREATED" && status) {
    return AUTHORIZATION_STATUSES[status]?.outcome ?? "unknown";
  }
  if (eventType === "PAYMENT.CAPTURE.REFUNDED" && status) {
    if (kind === "refund") return REFUND_STATUSES[status]?.outcome ?? "unknown";
    if (kind === "capture")
      return status === "REFUNDED" || status === "PARTIALLY_REFUNDED" ? "success" : "unknown";
    return "unknown";
  }
  return info.outcome;
}

const DECLINE_CATEGORIES = new Set<ErrorCategory>([
  "card_declined",
  "insufficient_funds",
  "fraud_or_risk",
  "payment_method_unavailable",
  "authentication_failed",
]);

function normalize(parsed: PaypalParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const httpStatus = httpStatusOf(ctx.meta);

  if (parsed.kind === "api_error") {
    const e = parsed.value;
    const c = classifyApiError(e, httpStatus);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${safeId(c.code, 128) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: httpStatus ? `HTTP ${httpStatus} ${c.canonical}` : c.canonical,
        paymentReference: orderIdFromActionLink(e.links),
        outcome: c.entry && DECLINE_CATEGORIES.has(c.entry.category) ? "failure" : "unknown",
        attributes: attrs([
          ["errorName", safeId(e.name, 128)],
          ["issue", c.issues[0] ? safeId(c.issues[0], 128) : undefined],
          ["detailsCount", e.details?.length ?? 0],
          ["debugId", safeId(e.debug_id, 128)],
          ["httpStatus", httpStatus],
        ]),
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "order") {
    const o = parsed.value;
    const d = describeOrder(o, o);
    const info = d.status ? ORDER_STATUSES[d.status] : undefined;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "order.snapshot",
        eventTypeKnown: true,
        stage: info?.stage ?? "other",
        providerStatus: d.status ? safeText(d.status, 64) : undefined,
        paymentReference: d.id,
        eventTimestamp: d.eventTimestamp,
        amountMinor: d.amountMinor,
        currency: d.currency,
        // COMPLETED maps to unknown: the captures below carry the outcome.
        outcome: info?.outcome ?? "unknown",
        attributes: { ...d.attributes, ...attrs([["httpStatus", httpStatus]]) },
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observed,
      }),
      ...nestedPayments(o, d.id, ctx, observed),
    ];
  }

  if (parsed.kind === "payment_resource") {
    const kind = parsed.resourceKind;
    const d = describeResource(kind, parsed.value);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `${kind ?? "payment_resource"}.snapshot`,
        eventTypeKnown: kind !== null,
        stage: d.statusInfo?.stage ?? kind ?? "other",
        providerStatus: d.status ? safeText(d.status, 64) : undefined,
        paymentReference: d.paymentReference,
        relatedReference: d.relatedReference,
        eventTimestamp: d.eventTimestamp,
        amountMinor: d.amountMinor,
        currency: d.currency,
        outcome: d.statusInfo?.outcome ?? "unknown",
        attributes: { ...d.attributes, ...attrs([["httpStatus", httpStatus]]) },
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observed,
      }),
    ];
  }

  const w = parsed.value;
  const info = WEBHOOK_EVENTS[w.event_type];
  const eventId = safeId(w.id, 256);
  const envelope = attrs([
    ["resourceType", w.resource_type ? safeId(w.resource_type, 32) : undefined],
    ["resourceVersion", w.resource_version ? safeId(w.resource_version, 16) : undefined],
    ["fromVerifyRequest", parsed.path === "webhook_event" ? true : undefined],
  ]);
  const base = {
    sourceFormat: ctx.format,
    eventType: safeText(w.event_type, 128) ?? "unknown",
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? ("other" as const),
    eventReference: eventId,
    // PayPal does not document duplicates; the event id is the only delivery identity.
    deliveryKey: eventId,
    eventTimestamp: toIsoTimestamp(w.create_time),
    source: { recordIndex: ctx.recordIndex, path: parsed.path },
    ...observed,
  };

  const res = parsed.resource;
  if (res.type === "order") {
    const d = describeOrder(res.value, res.value);
    return [
      clean({
        ...base,
        providerStatus: d.status ? safeText(d.status, 64) : undefined,
        paymentReference: d.id,
        amountMinor: d.amountMinor,
        currency: d.currency,
        outcome: info!.outcome,
        attributes: {
          ...d.attributes,
          ...attrs([["resourceUpdateTime", d.eventTimestamp]]),
          ...envelope,
        },
      }),
    ];
  }

  const kind = res.type === "payment" ? res.kind : null;
  const d = describeResource(kind, res.value);
  if (res.type === "other") {
    // Unknown events: only documented related_ids are used, never resource.id.
    const orderId = d.attributes.orderId;
    return [
      clean({
        ...base,
        providerStatus: d.status ? safeText(d.status, 64) : undefined,
        paymentReference: typeof orderId === "string" ? orderId : undefined,
        outcome: "unknown",
        attributes: { ...envelope },
      }),
    ];
  }
  return [
    clean({
      ...base,
      providerStatus: d.status ? safeText(d.status, 64) : undefined,
      paymentReference: d.paymentReference,
      relatedReference: d.relatedReference,
      amountMinor: d.amountMinor,
      currency: d.currency,
      outcome: webhookOutcome(w.event_type, info!, kind, d.status),
      attributes: {
        ...d.attributes,
        ...attrs([["resourceUpdateTime", d.eventTimestamp]]),
        ...envelope,
      },
    }),
  ];
}

type ApiErrorClass = {
  code: string;
  canonical: string;
  issues: string[];
  entry: CatalogEntry | undefined;
  confidence: Confidence;
  nameInfo: (typeof ERROR_NAMES)[string] | undefined;
  issueEntry: (typeof ISSUES)[string] | undefined;
};

/** The first details[].issue decides; the name (or HTTP status) is only a fallback class. */
function classifyApiError(e: ApiErrorT, httpStatus: number | undefined): ApiErrorClass {
  const issues = (e.details ?? [])
    .map((d) => d.issue)
    .filter((i): i is string => typeof i === "string" && i !== "");
  const canonical = ERROR_NAME_ALIASES[e.name] ?? e.name;
  const nameInfo = ERROR_NAMES[canonical];
  const issueEntry = issues[0] ? ISSUES[issues[0]] : undefined;
  let entry: CatalogEntry | undefined;
  let confidence: Confidence = "insufficient";
  if (issueEntry) {
    entry = issueEntry;
    confidence = "strong";
  } else if (nameInfo?.entry) {
    entry = nameInfo.entry;
    confidence = "possible";
  } else if (!nameInfo && httpStatus !== undefined) {
    const byStatus = Object.values(ERROR_NAMES).find((n) => n.http === httpStatus)?.entry;
    if (byStatus) {
      entry = byStatus;
      confidence = "possible";
    }
  }
  return { code: issues[0] ?? e.name, canonical, issues, entry, confidence, nameInfo, issueEntry };
}

function decodeApiError(e: ApiErrorT, ctx: NormalizeContext): DecodedErrorDraft {
  const httpStatus = httpStatusOf(ctx.meta);
  const c = classifyApiError(e, httpStatus);
  const first = (e.details ?? []).find((d) => typeof d.issue === "string") ?? e.details?.[0];

  const subCodes: Record<string, string> = { errorName: e.name };
  if (c.canonical !== e.name) subCodes.normalizedName = c.canonical;
  if (c.issues[0]) subCodes.issue = c.issues[0];
  const debugId = safeId(e.debug_id, 128);
  if (debugId) subCodes.debug_id = debugId;
  if (httpStatus !== undefined) subCodes.httpStatus = String(httpStatus);
  const field = safeId(first?.field, 256);
  if (field) subCodes.field = field;
  const location = safeId(first?.location, 32);
  if (location) subCodes.location = location;
  if (c.issues.length > 1) subCodes.additionalIssues = c.issues.slice(1, 10).join(", ");

  const missing: string[] = [];
  if (!c.issues[0] && c.canonical === "UNPROCESSABLE_ENTITY")
    missing.push(
      "No details[].issue was supplied; a 422 error cannot be classified from its name alone.",
    );
  if (c.issues[0] && !c.issueEntry)
    missing.push(`Issue "${safeText(c.issues[0], 80)}" is not in the PandaPayLens catalog yet.`);
  if (!c.nameInfo)
    missing.push(`Error name "${safeText(e.name, 80)}" is not a documented PayPal error name.`);
  if (c.issues.length > 1)
    missing.push(
      `The error has ${c.issues.length} details entries. PayPal does not document an order or priority, so only the first issue was decoded.`,
    );
  if (!debugId)
    missing.push("No debug_id was supplied; PayPal support uses it to trace the request.");
  if (httpStatus !== undefined && c.nameInfo && c.nameInfo.http !== httpStatus)
    missing.push(
      `HTTP status ${httpStatus} does not match the status documented for ${c.canonical} (${c.nameInfo.http}).`,
    );

  const docs: DocumentationLink[] = [];
  if (c.issueEntry?.api !== "payments")
    docs.push({ title: "PayPal Orders v2 error messages", url: ORDERS_ERRORS_URL });
  if (c.issueEntry && c.issueEntry.api !== "orders")
    docs.push({ title: "PayPal Payments v2 API", url: PAYMENTS_API_URL });
  docs.push({ title: "PayPal common errors overview", url: ERRORS_OVERVIEW_URL });
  docs.push({ title: "PayPal REST API responses", url: RESPONSES_URL });
  if (c.entry?.retry === "retry_conditionally")
    docs.push({ title: "PayPal idempotency (PayPal-Request-Id)", url: IDEMPOTENCY_URL });

  const providerMessage = safeText(first?.description, 300) ?? safeText(e.message, 300);
  const orderId = orderIdFromActionLink(e.links);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: c.code,
    subCodes,
    category: c.entry?.category ?? "unknown",
    ...(providerMessage ? { providerMessage } : {}),
    explanation: c.entry?.explanation ?? "PandaPayLens does not recognize this PayPal error.",
    nextAction:
      c.entry?.nextAction ??
      "Check PayPal's error reference for this name and issue, and quote the debug_id to PayPal support.",
    retry: c.entry?.retry ?? "unknown",
    retryExplanation:
      c.entry?.retryExplanation ?? "Retry safety cannot be assessed for this error.",
    confidence: c.confidence,
    documentation: docs,
    missingInformation: missing,
    ...(orderId ? { paymentReference: orderId } : {}),
  };
}

const STATUS_SENTENCE: Record<string, string> = {
  "capture:DECLINED": "The capture was declined.",
  "capture:FAILED": "The capture failed.",
  "authorization:DENIED": "The authorization was denied.",
};

/** Failed capture or denied authorization, decoded from processor_response and status_details. */
function decodePaymentFailure(
  kind: ResourceKind,
  r: ResourceT,
  statusLabel: string,
  d: ResourceDescription,
  ctx: NormalizeContext,
  path: string,
): DecodedErrorDraft {
  const pr = r.processor_response;
  const code = safeId(pr?.response_code, 16);
  const proc = code ? PROCESSOR_RESPONSE_CODES[code] : undefined;
  const reason = safeId(r.status_details?.reason, 64);

  const subCodes: Record<string, string> = { status: statusLabel };
  if (code) subCodes.response_code = code;
  if (proc) subCodes.response_code_token = proc.token;
  const avs = safeId(pr?.avs_code, 16);
  const cvv = safeId(pr?.cvv_code, 16);
  const advice = safeId(pr?.payment_advice_code, 16);
  if (avs) subCodes.avs_code = avs;
  if (cvv) subCodes.cvv_code = cvv;
  if (advice) subCodes.payment_advice_code = advice;
  if (reason) subCodes.status_reason = reason;

  const missing: string[] = [];
  let entry: CatalogEntry | undefined;
  let confidence: Confidence = "insufficient";
  let tokenOnly: string | undefined;
  if (proc?.entry) {
    entry = proc.entry;
    confidence = "strong";
  } else if (proc && !proc.approved) {
    tokenOnly = proc.token;
    confidence = "possible";
    missing.push(
      `PayPal documents only the token ${proc.token} for response code ${code}; it does not justify a category.`,
    );
  } else if (reason === "DECLINED_BY_RISK_FRAUD_FILTERS") {
    entry = RISK_FILTER_DECLINE;
    confidence = "strong";
  } else if (code && !proc) {
    missing.push(`Processor response code "${code}" is not in the PandaPayLens catalog yet.`);
  } else {
    missing.push(
      "No processor_response.response_code or status_details.reason was supplied, so the reason is unknown.",
    );
  }
  if (advice)
    missing.push(
      `payment_advice_code ${advice} is a card-network advice code whose meaning depends on the card network; it is not interpreted here.`,
    );
  if (!d.orderId)
    missing.push(
      "No order id was found (related_ids or rel=up link); other records of this order cannot be linked.",
    );

  const sentence =
    STATUS_SENTENCE[`${kind}:${statusLabel}`] ??
    (kind === "authorization"
      ? "The authorization was not successful."
      : "The capture was not successful.");
  const docs: DocumentationLink[] = [
    { title: "PayPal processor response codes", url: PROCESSOR_RESPONSE_URL },
    {
      title: kind === "authorization" ? "PayPal authorization status" : "PayPal capture status",
      url: kind === "authorization" ? AUTHORIZATION_STATUS_URL : CAPTURE_STATUS_URL,
    },
    { title: "PayPal: handle payment failures", url: PAYMENT_FAILURES_URL },
  ];
  if (avs || cvv)
    docs.push({ title: "PayPal card decline errors (AVS and CVV)", url: CARD_DECLINE_URL });

  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    code: code ?? reason ?? statusLabel,
    subCodes,
    category: entry?.category ?? "unknown",
    explanation: tokenOnly
      ? `${sentence} The processor returned ${code} (${tokenOnly}).`
      : `${sentence} ${entry?.explanation ?? "PayPal did not say why."}`,
    nextAction:
      entry?.nextAction ??
      "Check the transaction in the PayPal account and ask the buyer for another payment method if needed.",
    retry: entry?.retry ?? "unknown",
    retryExplanation:
      entry?.retryExplanation ?? "Retry safety cannot be assessed without a known reason.",
    confidence,
    documentation: docs,
    missingInformation: missing,
    ...(d.paymentReference ? { paymentReference: d.paymentReference } : {}),
    ...(d.id ? { attemptReference: d.id } : {}),
  };
}

function failureStatus(kind: ResourceKind | null, status: string | undefined): string | undefined {
  if (kind === "capture" && (status === "DECLINED" || status === "FAILED")) return status;
  if (kind === "authorization" && status === "DENIED") return status;
  return undefined;
}

function decodeErrors(parsed: PaypalParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "api_error") return [decodeApiError(parsed.value, ctx)];

  if (parsed.kind === "order") {
    const orderId = paypalId(parsed.value.id);
    const out: DecodedErrorDraft[] = [];
    (parsed.value.purchase_units ?? []).forEach((unit, i) => {
      for (const kind of ["authorization", "capture"] as const) {
        (unit.payments?.[KIND_PLURAL[kind]] ?? []).forEach((res, j) => {
          const label = failureStatus(kind, res.status);
          if (!label) return;
          const d = describeResource(kind, res, orderId);
          out.push(
            decodePaymentFailure(
              kind,
              res,
              label,
              d,
              ctx,
              `purchase_units[${i}].payments.${KIND_PLURAL[kind]}[${j}]`,
            ),
          );
        });
      }
    });
    return out;
  }

  if (parsed.kind === "payment_resource") {
    const kind = parsed.resourceKind;
    const label = failureStatus(kind, parsed.value.status);
    if (!kind || !label) return [];
    return [
      decodePaymentFailure(
        kind,
        parsed.value,
        label,
        describeResource(kind, parsed.value),
        ctx,
        "",
      ),
    ];
  }

  const res = parsed.resource;
  if (res.type !== "payment" || !res.kind) return [];
  const event = parsed.value.event_type;
  const failedEvent = event === "PAYMENT.CAPTURE.DECLINED" || event === "PAYMENT.CAPTURE.DENIED";
  const label =
    failureStatus(res.kind, res.value.status) ??
    (failedEvent ? (res.value.status ?? event.slice("PAYMENT.CAPTURE.".length)) : undefined);
  if (!label) return [];
  const path = [parsed.path, "resource"].filter(Boolean).join(".");
  return [
    decodePaymentFailure(
      res.kind,
      res.value,
      label,
      describeResource(res.kind, res.value),
      ctx,
      path,
    ),
  ];
}

export const paypalAdapter: ProviderAdapter<PaypalParsed> = {
  id: "paypal",
  displayName: "PayPal",
  version: PAYPAL_ADAPTER_VERSION,
  manifest: paypalManifest,
  supportedFormats: [
    {
      id: "paypal.api_error",
      description:
        "REST error response ({ name, message, debug_id, details[{ issue, description, field }] })",
    },
    {
      id: "paypal.order",
      description:
        "Orders v2 order resource with purchase_units[].payments (captures, authorizations, refunds)",
    },
    {
      id: "paypal.payment_resource",
      description: "Payments v2 capture, authorization or refund resource",
    },
    {
      id: "paypal.webhook",
      description:
        "Webhook event (id, event_type, create_time, resource) for Orders v2 and Payments v2",
    },
    {
      id: "paypal.webhook.verify_request",
      description: "verify-webhook-signature request body; the embedded webhook_event is analyzed",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Only PayPal-generated ids (order, authorization, capture, refund).
    // invoice_id, custom_id and reference_id are merchant-chosen and are not used.
    const a = event.attributes;
    const keys = [
      event.paymentReference,
      event.relatedReference,
      a.orderId,
      a.parentAuthorizationId,
      a.parentCaptureId,
    ].filter((x): x is string => typeof x === "string" && x !== "");
    return [...new Set(keys)];
  },
};

export { WEBHOOK_EVENTS as PAYPAL_WEBHOOK_EVENTS };
export * from "./catalog.js";
export default paypalAdapter;
