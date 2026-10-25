/**
 * Domain types shared by the analysis engine, provider adapters and rules.
 *
 * Nothing in this file may depend on a UI framework, a database, or the network.
 */

export type SafePrimitive = string | number | boolean | null;

export type Outcome = "success" | "failure" | "pending" | "unknown";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Confidence = "confirmed" | "strong" | "possible" | "insufficient";

export type ErrorCategory =
  | "card_declined"
  | "authentication_required"
  | "authentication_failed"
  | "invalid_request"
  | "invalid_amount"
  | "insufficient_funds"
  | "payment_method_unavailable"
  | "fraud_or_risk"
  | "rate_limiting"
  | "provider_unavailable"
  | "network_or_timeout"
  | "duplicate_request"
  | "configuration"
  | "unknown";

export type RetryGuidance =
  | "do_not_retry"
  | "customer_action_required"
  | "retry_conditionally"
  | "safe_to_retry_technical_request"
  | "manual_review"
  | "unknown";

/**
 * Coarse lifecycle stage. It is a display aid only: provider-specific meaning is
 * kept in `eventType` / `providerStatus`. Authorization is not settlement, and a
 * capture is not necessarily settlement either.
 */
export type LifecycleStage =
  | "payment"
  | "authorization"
  | "authentication"
  | "capture"
  | "cancellation"
  | "refund"
  | "dispute"
  | "error"
  | "other";

/** Where in the imported data an event came from, e.g. `[2].notificationItems[0]`. */
export type SourceLocation = {
  /** Zero-based index of the top-level record (array element or JSONL line). */
  recordIndex: number;
  /** JSON path inside that record. Empty string means the record itself. */
  path: string;
};

export type NormalizedEvent = {
  /** Stable, engine-assigned id, unique within one analysis (`ev-<n>`). */
  id: string;
  provider: string;
  sourceFormat: string;

  eventType: string;
  /** Whether the adapter knows this event type and its semantics. */
  eventTypeKnown: boolean;
  stage: LifecycleStage;
  providerStatus?: string;

  /** The provider's own id for this event or delivery, if any (e.g. Stripe `evt_…`). */
  eventReference?: string;
  /** Primary payment identifier (Stripe PaymentIntent, Adyen payment pspReference). */
  paymentReference?: string;
  /** Secondary identifier (Stripe charge, Adyen modification pspReference). */
  relatedReference?: string;
  merchantReference?: string;

  /**
   * Identity used to recognize repeated deliveries of the same business event.
   * Provider-specific: Stripe uses the event id, Adyen eventCode + pspReference.
   */
  deliveryKey?: string;

  /** When the provider says the event happened (ISO 8601, UTC). */
  eventTimestamp?: string;
  /** When the receiver observed it, only if the input says so (ISO 8601, UTC). */
  observedTimestamp?: string;

  /** Minor units as an integer string; never a float. */
  amountMinor?: string;
  currency?: string;

  outcome: Outcome;

  /** Allowlisted, non-sensitive attributes only. */
  attributes: Record<string, SafePrimitive | SafePrimitive[]>;

  /** Order of the event in the imported data (arrival order proxy). */
  sourceIndex: number;
  source: SourceLocation;
};

export type DetectionResult = {
  provider: string;
  /** Machine id of the recognized input family, e.g. `stripe.event.snapshot`. */
  format: string | null;
  /** 0 = no match, 1 = certain structural match. */
  confidence: number;
  /** Whether this adapter can fully analyze the format it recognized. */
  supported: boolean;
  reasons: string[];
  unsupportedReason?: string;
};

export type DocumentationLink = { title: string; url: string };

export type DecodedError = {
  id: string;
  provider: string;
  sourceFormat: string;
  code: string;
  /** Additional provider codes, e.g. Stripe `decline_code`, `advice_code`. */
  subCodes: Record<string, string>;
  category: ErrorCategory;
  /** Provider message, length-limited and treated as plain text. */
  providerMessage?: string;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  confidence: Confidence;
  documentation: DocumentationLink[];
  missingInformation: string[];
  paymentReference?: string;
  /**
   * Identifies the individual attempt (Stripe charge, Adyen pspReference).
   * Two records of the same attempt (API response and webhook) share it.
   */
  attemptReference?: string;
  source: SourceLocation;
};

export type DiagnosticFinding = {
  ruleId: string;
  ruleVersion: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  explanation: string;
  evidenceEventIds: string[];
  evidenceErrorIds?: string[];
  recommendedAction?: string;
  documentationUrl?: string;
  limitations: string[];
};

export type TransactionGroup = {
  id: string;
  provider: string;
  /** Identifiers that linked these events together. */
  references: string[];
  eventIds: string[];
  /** Outcome of the latest event by event time, if determinable. */
  latestOutcome: Outcome;
};

export type ProviderAdapter<Parsed = unknown> = {
  id: string;
  displayName: string;
  version: string;
  /** Input families this adapter fully supports. */
  supportedFormats: readonly { id: string; description: string }[];

  detect(input: unknown): DetectionResult;
  /** Validate the input against the detected format. Never throws. */
  parse(input: unknown, format: string): { ok: true; value: Parsed } | { ok: false; issues: string[] };
  normalize(parsed: Parsed, ctx: NormalizeContext): NormalizedEventDraft[];
  /** Errors carried by the input. A webhook batch can contain several. */
  decodeErrors(parsed: Parsed, ctx: NormalizeContext): DecodedErrorDraft[];
  /**
   * Keys that link events into one transaction. Keys are namespaced by the
   * engine per provider, so adapters return bare identifiers.
   */
  correlationKeys(event: NormalizedEvent): string[];
};

export type NormalizeContext = {
  format: string;
  recordIndex: number;
  /** Receipt time supplied via the PandaPayLens envelope, if any. */
  observedTimestamp?: string;
};

export type NormalizedEventDraft = Omit<NormalizedEvent, "id" | "sourceIndex" | "provider">;

export type DecodedErrorDraft = Omit<DecodedError, "id" | "provider">;

export type AnalysisContext = {
  events: readonly NormalizedEvent[];
  errors: readonly DecodedError[];
  groups: readonly TransactionGroup[];
  /** True when arrival order is only inferred from file order. */
  arrivalOrderInferred: boolean;
};

export type DiagnosticRule = {
  id: string;
  version: string;
  /** Provider ids this rule understands; `*` means provider-agnostic. */
  providers: readonly string[];
  description: string;
  evaluate(context: AnalysisContext): Omit<DiagnosticFinding, "ruleId" | "ruleVersion">[];
};

export type WarningCode =
  | "DANGEROUS_KEY_REMOVED"
  | "SENSITIVE_DATA_DETECTED"
  | "UNSUPPORTED_RECORD"
  | "AMBIGUOUS_PROVIDER"
  | "INVALID_RECORD"
  | "RULE_FAILED"
  | "UNSAFE_INTEGER"
  | "NO_ANALYZABLE_RECORDS";

export type AnalysisWarning = {
  code: WarningCode;
  message: string;
  recordIndex?: number;
};

export type RecordSummary = {
  recordIndex: number;
  status: "analyzed" | "unsupported" | "invalid";
  provider: string | null;
  format: string | null;
  confidence: number;
  reasons: string[];
  /** Other adapters that also matched this record. */
  alternatives: { provider: string; format: string | null; confidence: number }[];
};

export type AnalysisResult = {
  meta: {
    analyzedAt: string;
    coreVersion: string;
    catalogVersion: string;
    rules: { id: string; version: string }[];
    adapters: { id: string; version: string }[];
    providerOverride: string | null;
    durationMs: number;
  };
  records: RecordSummary[];
  /** Sorted by event time, then observation time, then source order. */
  events: NormalizedEvent[];
  groups: TransactionGroup[];
  errors: DecodedError[];
  findings: DiagnosticFinding[];
  warnings: AnalysisWarning[];
  sensitiveData: { detected: boolean; fieldPaths: string[] };
  suggestedView: "decoder" | "timeline";
  arrivalOrderInferred: boolean;
};
