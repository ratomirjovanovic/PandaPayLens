import type {
  Confidence,
  ErrorCategory,
  Outcome,
  RetryGuidance,
  Severity,
} from "@pandapaylens/core";

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  card_declined: "Card declined",
  authentication_required: "Authentication required",
  authentication_failed: "Authentication failed",
  invalid_request: "Invalid request",
  invalid_amount: "Invalid amount",
  insufficient_funds: "Insufficient funds",
  payment_method_unavailable: "Payment method unavailable",
  fraud_or_risk: "Fraud or risk-related",
  rate_limiting: "Rate limiting",
  provider_unavailable: "Provider service unavailable",
  network_or_timeout: "Network or timeout",
  duplicate_request: "Duplicate request",
  configuration: "Configuration problem",
  unknown: "Unknown error",
};

export const RETRY_LABEL: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry",
  customer_action_required: "Customer action required",
  retry_conditionally: "Retry conditionally",
  safe_to_retry_technical_request: "Safe to retry (technical request)",
  manual_review: "Manual review",
  unknown: "Unknown",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: "Confirmed from supplied evidence",
  strong: "Strong indication",
  possible: "Possible",
  insufficient: "Insufficient evidence",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "bg-fail/15 text-fail border-fail/40",
  high: "bg-fail/10 text-fail border-fail/30",
  medium: "bg-warn/10 text-warn border-warn/30",
  low: "bg-info/10 text-info border-info/30",
  info: "bg-bg-subtle text-fg-muted border-border",
};

export const OUTCOME_CLASS: Record<Outcome, string> = {
  success: "text-ok",
  failure: "text-fail",
  pending: "text-warn",
  unknown: "text-fg-muted",
};

export const OUTCOME_DOT: Record<Outcome, string> = {
  success: "bg-ok",
  failure: "bg-fail",
  pending: "bg-warn",
  unknown: "bg-fg-muted",
};

export const RETRY_CLASS: Record<RetryGuidance, string> = {
  do_not_retry: "text-fail",
  customer_action_required: "text-warn",
  retry_conditionally: "text-warn",
  safe_to_retry_technical_request: "text-ok",
  manual_review: "text-warn",
  unknown: "text-fg-muted",
};
