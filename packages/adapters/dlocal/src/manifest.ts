import type { ProviderManifest } from "@pandapaylens/core";
import {
  ARN_URL,
  AUTH_CAPTURE_URL,
  CALLBACK_URL_DOCS,
  CASH_PAYMENTS_URL,
  CHARGEBACK_CATEGORIES_URL,
  CHARGEBACK_NOTIFICATION_URL,
  CHARGEBACK_STATUS_URL,
  CHARGEBACKS_GUIDE_URL,
  COUNTRY_REFERENCE_URL,
  CREATE_PAYMENT_URL,
  HTTP_ERRORS_CARDS_URL,
  HTTP_ERRORS_PAYMENTS_URL,
  HTTP_ERRORS_REFUNDS_URL,
  NETWORK_RESPONSE_URL,
  NOTIFICATIONS_URL,
  PAYINS_SECURITY_URL,
  PAYMENT_STATUS_URL,
  PAYOUT_ERRORS_V3_URL,
  PAYOUT_NOTIFICATION_V3_URL,
  PAYOUT_STATUS_V3_URL,
  REFUND_STATUS_URL,
  REFUNDS_GUIDE_URL,
  RETRIEVE_PAYMENT_URL,
  THREE_DS_URL,
} from "./catalog.js";

export const DLOCAL_ADAPTER_VERSION = "0.1.0";

const SITE_INDEX = "https://www.dlocal.com/llms.txt";
const INDUSTRY_DATA = "https://docs.dlocal.com/docs/requirements-per-industry";

export const dlocalManifest: ProviderManifest = {
  id: "dlocal",
  displayName: "dLocal",
  version: DLOCAL_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // Not claimed: acquiring (the pages read name an acquirer as a separate
  // party), gateway, payment_facilitator, wallet (dLocal accepts third-party
  // wallets) and orchestration.
  categories: ["card_processing", "alternative_payment_method", "merchant_account_intermediary"],
  sectors: [
    { sector: "Digital and subscriptions", source: SITE_INDEX },
    { sector: "Subscriptions", source: INDUSTRY_DATA },
    { sector: "eLearning", source: SITE_INDEX },
    { sector: "SaaS", source: SITE_INDEX },
    { sector: "Streaming", source: SITE_INDEX },
    {
      sector: "Gaming (video game publishers)",
      source: "https://www.dlocal.com/industries/gaming-subvertical/",
    },
    {
      sector: "Crypto and stablecoins",
      source: "https://www.dlocal.com/our-industries-v2/crypto-industry/",
    },
    {
      sector: "Money remittance",
      source: "https://www.dlocal.com/our-industries/money-remittance-industry/",
    },
    { sector: "Financial services", source: SITE_INDEX },
    { sector: "Payroll and HR", source: SITE_INDEX },
    { sector: "Marketplaces, retail and delivery", source: INDUSTRY_DATA },
    { sector: "Retail", source: SITE_INDEX },
    { sector: "Ride-hailing", source: SITE_INDEX },
    { sector: "Food delivery", source: SITE_INDEX },
    { sector: "Travel", source: SITE_INDEX },
    { sector: "Digital advertising", source: SITE_INDEX },
    { sector: "Wallets and account funding", source: INDUSTRY_DATA },
  ],
  regions:
    "Licensed entities (www.dlocal.com/legal/regulatory-disclosure/): Dlocal Ltd, authorised by the MFSA (Malta) as an electronic money institution and payment institution, currently operating under its payment institution authorisation; Dlocal Corp LLP, registered with FinCEN as a money services business, which collects payments from users in emerging markets on behalf of merchants; Dlocal OpCo UK Ltd, authorised by the FCA as an authorised payment institution. The country reference lists 64 countries in Latin America, Africa, the Middle East and Asia (the website says 44+ countries, the industry pages 60+ emerging markets). Documented local limits: India cross-border (PACB) data rules, Pix only in Brazil, Mobile Money in eight countries, Brazilian benefit cards limited by business type. Gambling, adult content and forex are not documented as sectors.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers, built from the field tables, OpenAPI response schemas and JSON examples on docs.dlocal.com (Payins payment, refund and chargeback objects and notifications, the HTTP error envelope, the Payouts v3 payout object and its notification, the Payouts v2 form-encoded notification and the dLocal for Platforms notification envelope). Values are invented; none is an official dLocal example.",
  dependencies: [
    "Local voucher, Pix and bank transfer networks to which dLocal routes local payment methods (for example a Boleto issued through a local bank)",
    "Acquirers and processors named only by processor_id on chargebacks (values not documented)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "dlocal.payins.payment",
      description:
        "Payins API (X-Version 2.1) payment object (status, status_code, status_detail) from POST /payments, POST /secure_payments, GET /payments/{id}, capture and cancel responses, and the payment notification",
      status: "supported",
    },
    {
      id: "dlocal.payins.refund",
      description:
        "Refund object (payment_id, order_refund_id, amount_refunded, status, status_code) from POST /refunds, GET /refunds/{id} and the refund notification",
      status: "limited",
    },
    {
      id: "dlocal.payins.chargeback",
      description:
        "Chargeback notification and object (payment_id, chargeback_date, reason_code, status, status_code)",
      status: "limited",
    },
    {
      id: "dlocal.api_error",
      description:
        "HTTP error envelope (code, message, param) shared by the Payins API and Payouts v3; the code tables differ per family",
      status: "limited",
    },
    {
      id: "dlocal.payouts_v3.payout",
      description:
        "Payouts v3 (X-Version 3.0) payout object (status, status_code, status_detail, on_hold, last_updated) from GET /payouts/v3 and the payout notification",
      status: "limited",
    },
    {
      id: "dlocal.payins.callback",
      description:
        "Browser callback_url POST (paymentId, status, date, signature); dLocal says not to use its status as final (recognized but not analyzed)",
      status: "unsupported",
    },
    {
      id: "dlocal.payouts_v2.notification",
      description:
        "Legacy Payouts v2 form-encoded notification (cashout_id, status_reason, control) without a status field (recognized but not analyzed)",
      status: "unsupported",
    },
    {
      id: "dlocal.platforms.notification",
      description:
        "dLocal for Platforms notification envelope (event_type, account_id, payload); out of first scope (recognized but not analyzed)",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Payment and payout rejection codes are decoded per object type, but an
    // HTTP error body does not show whether it came from the Payins API or
    // Payouts v3, and twelve codes mean different things in the two families.
    errorDecoding: "limited",
    paymentResponses: "supported",
    // No event id or type in notifications, the object kind is inferred from
    // fields, and the Payouts v3 notification signature is not documented.
    webhookParsing: "limited",
    // Payins objects carry no status change time and ordering is not documented.
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has dLocal-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "payment-status", title: "Payment status codes", url: PAYMENT_STATUS_URL },
    { topic: "create-payment", title: "Create a payment", url: CREATE_PAYMENT_URL },
    { topic: "retrieve-payment", title: "Retrieve a payment", url: RETRIEVE_PAYMENT_URL },
    {
      topic: "http-errors-payments",
      title: "HTTP errors: payments",
      url: HTTP_ERRORS_PAYMENTS_URL,
    },
    { topic: "http-errors-refunds", title: "HTTP errors: refunds", url: HTTP_ERRORS_REFUNDS_URL },
    { topic: "http-errors-cards", title: "HTTP errors: saved cards", url: HTTP_ERRORS_CARDS_URL },
    {
      topic: "payins-security",
      title: "Payins security, signature and idempotency",
      url: PAYINS_SECURITY_URL,
    },
    { topic: "notifications", title: "Receive notifications", url: NOTIFICATIONS_URL },
    { topic: "callback-url", title: "Configure the callback URL", url: CALLBACK_URL_DOCS },
    { topic: "network-response", title: "Network response data", url: NETWORK_RESPONSE_URL },
    { topic: "3ds", title: "3D Secure", url: THREE_DS_URL },
    { topic: "auth-capture", title: "Authorization and capture", url: AUTH_CAPTURE_URL },
    { topic: "cash-payments", title: "Cash payments", url: CASH_PAYMENTS_URL },
    { topic: "arn", title: "Acquirer reference number notifications", url: ARN_URL },
    { topic: "refunds", title: "Refunds", url: REFUNDS_GUIDE_URL },
    { topic: "refund-status", title: "Refund status codes", url: REFUND_STATUS_URL },
    { topic: "chargebacks", title: "Chargebacks", url: CHARGEBACKS_GUIDE_URL },
    { topic: "chargeback-status", title: "Chargeback status", url: CHARGEBACK_STATUS_URL },
    {
      topic: "chargeback-notification",
      title: "Chargeback notification",
      url: CHARGEBACK_NOTIFICATION_URL,
    },
    {
      topic: "chargeback-categories",
      title: "Chargeback reason codes",
      url: CHARGEBACK_CATEGORIES_URL,
    },
    { topic: "payout-status-v3", title: "Payouts v3 statuses", url: PAYOUT_STATUS_V3_URL },
    {
      topic: "payout-errors-v3",
      title: "Payouts v3 error and rejection codes",
      url: PAYOUT_ERRORS_V3_URL,
    },
    {
      topic: "payout-notifications-v3",
      title: "Payouts v3 notifications",
      url: PAYOUT_NOTIFICATION_V3_URL,
    },
    { topic: "country-reference", title: "Country reference", url: COUNTRY_REFERENCE_URL },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "none documented (notifications carry no event id, delivery id or event type)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "dLocal retries Payins notifications until it gets a 2xx (hourly, then every 12 hours for 4 days) and says the same Payouts v3 notification may arrive several times. Each notification is a full snapshot of the payment, refund, chargeback or payout object without an event id, so compare the object's id, status and status_code (and last_updated for payouts) with what you stored, make the handler idempotent, and retrieve the object from dLocal before acting on a snapshot that looks older.",
    docsUrl: NOTIFICATIONS_URL,
  },
  limitations: [
    "Notifications carry no event id, delivery id or event type, so no delivery key is set and repeated deliveries are not reported as duplicates. Identical snapshots of one object are grouped by its id. The object kind (payment, refund, chargeback, payout) is inferred from its fields.",
    "status_code is decoded only together with the object type: payment (statuses, pending sub-codes, 39 rejection codes), refund, chargeback and Payouts v3 (statuses and 21 rejection codes) each have their own table. A bare number is never decoded on its own.",
    "An HTTP error body does not show whether it came from the Payins API (payments, refunds or saved cards) or from Payouts v3. A code listed by only one family or page is decoded with that meaning. Codes documented with different HTTP statuses (3001, 3003, 4001, 5009, 5010) are told apart when the HTTP status is supplied; the others with several documented meanings (for example 5007, 5008, 5011 to 5015, 5023, 5050) are shown with every meaning and lower confidence.",
    "Payins objects carry created_date and approved_date but no status change time. approved_date is used for approved statuses and created_date otherwise, so two snapshots of one payment can share a time and keep input order. Delivery order is not documented and retries can deliver an older snapshot late. Payouts v3 use last_updated.",
    "Cash vouchers, Pix and bank transfers stay PENDING until the payer pays; only the notification or a status query is final. An unpaid voucher ends as REJECTED 340.",
    "A capture is a new payment with its own id and the authorization_id of the authorization; both ids link the events. Refunds and chargebacks link through payment_id. Merchant references (order_id, order_refund_id, original_order_id, external_id) are shown but never used to link events.",
    "Chargeback reason codes depend on the card network, and the chargeback carries no card brand. Codes listed by several networks (for example Mexico and Elo 41, 74, 75, 80, 82, 85) are shown with every reading. chargeback_stage and processor_id values are not documented and are shown as supplied.",
    "Refund rejections have no documented sub-codes, and status_code is an integer in some refund and chargeback examples and a string in others; both are accepted.",
    "The raw network codes in the optional acquirer block (network_response_code) are not listed by dLocal and are shown as supplied. When a Mastercard merchant_advice_code is present, its retry advice takes precedence, as dLocal documents.",
    "Payouts v3 amounts are not read: the documented field list names amount_details.debit without its structure. The payout flow diagrams are images only, and the Payouts v3 notification signature and retry count are not documented.",
    "Not analyzed: the browser callback_url POST (dLocal says not to use its status as final), the legacy Payouts v2 form notification (no status field, status_reason values not documented) and dLocal for Platforms notifications are recognized only. Enrollment, dispute upload, account validation and sandbox tool responses are not recognized.",
    "Signatures (Authorization V2-HMAC-SHA256, callback signature, Payouts v2 control, Payload-Signature, bearer tokens) are sensitive and never verified; a pasted notification is not treated as authentic. Only the presence of a signature header is shown.",
    "Card data, payer and beneficiary names, local tax ids (CPF, CNPJ, CURP, RFC, DNI and others), bank accounts, Pix keys, 3D Secure values, ARNs, scheme references and notification URLs are never copied.",
    "Category and retry guidance per code are PandaPayLens suggestions; dLocal's own advice (5052 retry later, the Mastercard merchant advice codes) is reflected. A request timeout (HTTP 504, code 5010) is shown as a conditional retry because the original outcome is unknown.",
  ],
  samples: ["dlocal-status-700", "dlocal-voucher-expired"],
};
