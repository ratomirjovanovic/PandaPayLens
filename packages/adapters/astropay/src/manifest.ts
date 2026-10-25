import type { ProviderManifest } from "@pandapaylens/core";
import {
  CASHOUT_V1_CALLBACKS_URL,
  CASHOUT_V1_ERRORS_URL,
  CASHOUT_V1_GETTING_STARTED_URL,
  CHECKOUT_CALLBACK_URL,
  CHECKOUT_REFUND_URL,
  CHECKOUT_STATUS_URL,
  DIRECT_PAYMENT_BRAZIL_URL,
  DIRECT_PAYMENT_CALLBACKS_URL,
  DIRECT_PAYMENT_ERRORS_URL,
  DIRECT_WITHDRAWAL_CALLBACKS_URL,
  DIRECT_WITHDRAWAL_CANCEL_REASONS_URL,
  PLATFORM_ERRORS_URL,
  QR_CALLBACKS_URL,
  QR_SECURITY_URL,
  WOF_ERRORS_URL,
  WOF_FUNDS_PULLING_URL,
} from "./catalog.js";

export const ASTROPAY_ADAPTER_VERSION = "0.1.0";

const BUSINESS = "https://www.astropay.com/business";
const ADOBE_BLOG =
  "https://www.astropay.com/blog/astropay-wallet-now-available-on-adobe-commerce-empowering-merchants-to-reach-millions-across-emerging-markets";

export const astropayManifest: ProviderManifest = {
  id: "astropay",
  displayName: "AstroPay",
  version: ASTROPAY_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  categories: ["wallet", "alternative_payment_method", "gateway"],
  sectors: [
    { sector: "Gaming", source: "https://www.astropay.com/use-cases/gaming" },
    {
      sector: "Gaming (Gaming Operator, UK merchant terms)",
      source: "https://www.astropay.com/united-kingdom/t-c-agreement-for-legal-entities",
    },
    { sector: "Marketplace", source: BUSINESS },
    { sector: "Payroll", source: BUSINESS },
    { sector: "Retail", source: ADOBE_BLOG },
    { sector: "Digital services", source: ADOBE_BLOG },
    { sector: "Subscription", source: ADOBE_BLOG },
  ],
  regions:
    "Licensed entities: Larstal Limited (FCA EMI), Larstal Denmark ApS (Danish FSA EMI), AstroPay Global (IOM) Limited (IOM FSA money transmission), AP Digital (IOM) Limited (IOM convertible virtual currency registration), Astro Instituicao de Pagamento Ltda (Brazilian Central Bank). Checkout targets Latin America and emerging markets. Public Direct Payment country pages: Argentina, Brazil, Mexico; Direct Withdrawal: Argentina, Brazil, Chile, Colombia, Ecuador, India, Mexico, Peru. Brazil: the CPF must match the payer, a PIX payment is valid 30 minutes, at most BRL 50,000 per payment, with daily and monthly per-user limits. Cashouts are not reversible.",
  documentationAccess: "partial",
  fixtureProvenance:
    "Synthetic payloads built from the documented field tables and the request, response, error and callback shapes on AstroPay's public developer pages; identifiers and values are invented and contain PPLsynth. Cashout V1 error texts are invented around the documented key words because only paraphrases were available. They are not official AstroPay examples.",
  dependencies: [
    "Unnamed local payment providers chosen by AstroPay for Direct Payment (automatic provider selection and fallback)",
    "PIX (Brazil) for Direct Payment and Direct Withdrawal",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "astropay.checkout.create_response",
      description:
        "Checkout create payment response (POST /v1/payments: payment_external_id, status)",
      status: "supported",
    },
    {
      id: "astropay.checkout.callback",
      description:
        "Checkout callback (payment_external_id, payment_status, payment_info.payment_amount); RSA Partner-Signature",
      status: "limited",
    },
    {
      id: "astropay.checkout.payment",
      description:
        "Payment object with a Checkout-only status (EXPIRED), with payment_transactions steps",
      status: "supported",
    },
    {
      id: "astropay.wof.payment",
      description:
        "Wallet on File payment object with a Wallet on File-only status (AUTHORIZED, CAPTURED, REVERSED and partial variants)",
      status: "supported",
    },
    {
      id: "astropay.payment_object",
      description:
        "Checkout or Wallet on File payment object whose family is not visible; only statuses both families document identically are interpreted",
      status: "limited",
    },
    {
      id: "astropay.cashout_v1",
      description:
        "Wallet Payouts / Cashouts V1 response and callback (cashout_id, merchant_cashout_id, status); HMAC Signature header",
      status: "supported",
    },
    {
      id: "astropay.direct_payment",
      description:
        "Direct Payment response and callback (deposit_external_id, merchant_deposit_id, status)",
      status: "supported",
    },
    {
      id: "astropay.direct_withdrawal",
      description:
        "Direct Withdrawal response and callback (cashout_external_id, merchant_cashout_id, status, cancel reason in description)",
      status: "supported",
    },
    {
      id: "astropay.qr.callback",
      description:
        "QR Payments deposit callback (deposit_external_id, payment_code_external_id, amount, status); HMAC Signature header",
      status: "limited",
    },
    {
      id: "astropay.merchant_gateway.error",
      description:
        "OneTouch / merchant-api error envelope (error, description, internal_term, reasons, detail) of Direct Payment, Direct Withdrawal and QR Payments",
      status: "supported",
    },
    {
      id: "astropay.partner.error",
      description:
        "Checkout and Wallet on File error body (error plus message or description): refund, auth-capture and account linking tables",
      status: "limited",
    },
    {
      id: "astropay.cashout_v1.error",
      description:
        "Cashouts V1 error, which has no machine code; decoded from the documented description text and HTTP status only",
      status: "limited",
    },
    {
      id: "astropay.wallet_deposit",
      description:
        "Classic wallet Deposit API (OneTouch deposit) callback with deposit_user_id: its documentation is in a private section that was not read (recognized but not analyzed)",
      status: "unsupported",
    },
    {
      id: "astropay.platform.error",
      description:
        "Platform (Partners API, BaaS) error codes (out of first scope; recognized but not analyzed)",
      status: "unsupported",
    },
    {
      id: "astropay.platform.webhook",
      description:
        "Platform webhooks sent to {baseWebhookUrl}/{eventName} (out of first scope; recognized but not analyzed)",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Tables rebuilt from content bundles, Cashout V1 decoded by text only and
    // Partner codes whose meaning depends on an operation the record does not show.
    errorDecoding: "limited",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has AstroPay-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "checkout-callback",
      title: "Checkout callback and statuses",
      url: CHECKOUT_CALLBACK_URL,
    },
    { topic: "checkout-status", title: "Checkout payment status", url: CHECKOUT_STATUS_URL },
    {
      topic: "checkout-refund",
      title: "Checkout refunds and refund errors",
      url: CHECKOUT_REFUND_URL,
    },
    {
      topic: "wof-funds-pulling",
      title: "Wallet on File funds pulling",
      url: WOF_FUNDS_PULLING_URL,
    },
    { topic: "wof-errors", title: "Wallet on File errors", url: WOF_ERRORS_URL },
    {
      topic: "cashout-v1",
      title: "Cashouts V1 getting started (statuses)",
      url: CASHOUT_V1_GETTING_STARTED_URL,
    },
    {
      topic: "cashout-v1-callbacks",
      title: "Cashouts V1 callbacks",
      url: CASHOUT_V1_CALLBACKS_URL,
    },
    { topic: "cashout-v1-errors", title: "Cashouts V1 error codes", url: CASHOUT_V1_ERRORS_URL },
    {
      topic: "direct-payment-callbacks",
      title: "Direct Payment callbacks",
      url: DIRECT_PAYMENT_CALLBACKS_URL,
    },
    {
      topic: "direct-payment-errors",
      title: "Direct Payment error codes",
      url: DIRECT_PAYMENT_ERRORS_URL,
    },
    {
      topic: "direct-payment-brazil",
      title: "Direct Payment Brazil (PIX, CANCELLED not final)",
      url: DIRECT_PAYMENT_BRAZIL_URL,
    },
    {
      topic: "direct-withdrawal-callbacks",
      title: "Direct Withdrawal callbacks",
      url: DIRECT_WITHDRAWAL_CALLBACKS_URL,
    },
    {
      topic: "direct-withdrawal-cancel-reasons",
      title: "Direct Withdrawal cancel reasons",
      url: DIRECT_WITHDRAWAL_CANCEL_REASONS_URL,
    },
    { topic: "qr-callbacks", title: "QR Payments callbacks", url: QR_CALLBACKS_URL },
    {
      topic: "qr-security",
      title: "QR Payments security and authentication",
      url: QR_SECURITY_URL,
    },
    {
      topic: "platform-errors",
      title: "Platform error codes (out of scope)",
      url: PLATFORM_ERRORS_URL,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "product family, AstroPay identifier and status (merchant callbacks carry no event or delivery id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "AstroPay retries callbacks (Checkout until acknowledged, Direct Payment up to 4 more attempts) and sends no event id. Treat a callback with the same AstroPay identifier and status as a repeat, answer 200 OK, and make the handler idempotent on that identifier. A Brazil Direct Payment can move from CANCELLED to APPROVED, so a later status must still be processed.",
    docsUrl: DIRECT_PAYMENT_CALLBACKS_URL,
  },
  limitations: [
    "The classic wallet Deposit API (OneTouch deposit with merchant_deposit_id and deposit_user_id) is documented only in unlisted /docs/private/ sections that were not read. It is not implemented. Callbacks with deposit_user_id are recognized but not analyzed; a classic deposit callback without that field shares Direct Payment field names and would be read with Direct Payment semantics.",
    "AstroPay's developer site is client-rendered, and the research rebuilt its tables from the site's public content bundles, so a value can sit in the wrong cell. Confidence is kept modest: strong only when a code matches exactly and a second documented column agrees (the HTTP status, or the final CANCELLED status for cancel reasons); otherwise possible.",
    "Cashouts V1 errors have no machine code. They are matched on documented key words in the description text and on the HTTP status, from paraphrased descriptions, with possible confidence at most. Texts that match no row stay unknown.",
    "Checkout and Wallet on File reuse some error codes with different meanings per operation (refund, auth-capture, account linking). The operation is not in the error body; the HTTP status narrows it where the tables differ, and otherwise every documented meaning is shown with possible confidence.",
    "AstroPay runs several product families with their own identifiers, statuses and signature schemes. Each family has its own format and status table and they are never mixed. Checkout and Wallet on File share one payment object: the family is taken from a status only one of them documents; for shared statuses only meanings both families document identically are used.",
    "The Platform API (Partners API, BaaS) is out of first scope: Platform-only error codes and webhooks sent to {baseWebhookUrl}/{eventName} with Partner signature headers are recognized but not analyzed. Generic codes that the Platform shares with other APIs are not used for recognition.",
    "Merchant callbacks carry no event or delivery id. Repeated deliveries are recognized by product family, AstroPay identifier and status. end_status_date is not part of the key because its meaning differs between pages (status change time for Cashouts, callback send time for QR).",
    "end_status_date is documented without a time zone, so it is shown as an attribute and not placed on the timeline; values that carry a zone are used. The payment object has no per-step timestamps and delivery order is not documented, so most AstroPay events are ordered by input order.",
    "In Brazil a Direct Payment in CANCELLED is not final and can become APPROVED after 30 minutes. The callback does not name the country, so every Direct Payment CANCELLED is shown as a failure flagged as possibly not final.",
    "The full Direct Payment status list is not documented; Direct Withdrawal CREATED appears only in a create example; a QR create example returns ACTIVE although the field is typed PENDING, APPROVED or CANCELLED. Undocumented statuses stay unknown.",
    "The payment object amount fields carry no documented currency, so they are not converted. Cashouts V1, Direct Payment and Direct Withdrawal responses and callbacks carry no documented amount. Only Checkout callbacks (payment_info.payment_amount) and QR callbacks show amounts.",
    "Signatures (HMAC Signature header, RSA Partner-Signature header) are sensitive and never verified; a pasted callback is not treated as authentic. Only the presence of a signature header is shown. Direct Payment and Direct Withdrawal callback signing is not stated on their callback pages.",
    "Wallet on File webhooks are documented without a payload or signature format and are not recognized. Checkout refund callbacks are sent if configured but their payload is not documented.",
    "AstroPay documents no chargeback, dispute or settlement events in any public family. Chargebacks cannot be shown on the timeline.",
    "AstroPay describes its error lists as the most common ones; other codes stay unknown. Category and retry per code are PandaPayLens suggestions, with AstroPay's own advice reflected where it gives one. A payment creation timeout, which AstroPay says to try again, is shown as a conditional retry because the original outcome is unknown.",
    "Merchant references (merchant_payment_id, merchant_deposit_id, merchant_cashout_id) are never used to link events, and user identifiers (merchant_user_id, user_id, cashout_user_id, deposit_user_id) are not copied. No identifier links one family to another.",
    "The approved Direct Withdrawal description (for example SPCD_1000) has no documented code space; it is shown as text only. Payment transaction results drift between OK/FAILED and APPROVED, and is_reversable/is_reversible are both read.",
    "QR Payments: only the deposit callback is analyzed; payment code creation and status, the POS API and user onboarding are not. The older Direct API ('AstroPay Direct has changed!') and the /api reference page were not examined and are not supported.",
    "Orchestration and card processing are not claimed as categories because AstroPay's role there is unclear. Sector eligibility depends on jurisdiction, licensing and underwriting; 'Gaming' is AstroPay's word and is not documented as including or excluding any specific gambling vertical.",
  ],
  samples: ["astropay-withdrawal-cancelled", "astropay-gateway-timeout"],
};
