export type Release = {
  version: string;
  date: string;
  status: "unreleased" | "released";
  changes: string[];
};

/** Public release history. Keep in sync with CHANGELOG.md. */
export const RELEASES: Release[] = [
  {
    version: "0.13.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "Plain text with one name: value pair per line is read, pasted alone or as a text/plain response body.",
      "Verotel FlexPay status pages are analyzed as a snapshot of the sale.",
      "Billing and shipping address groups are hidden, and form fields named like built-in object members are read correctly.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "Worldpay WPG and cnpAPI XML responses and notifications are analyzed.",
      'Event times are used only with a time zone; times read as UTC because the provider documents no zone are marked "UTC assumed".',
      "Findings show documentation links for every provider, and the unsafe retry finding links more providers' idempotency pages.",
      "Checkout.com no longer appears as a strong alternative for Razorpay payment ids.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "XML input is read safely: no DOCTYPE or entity declarations, bounded depth, element count and text length.",
      "XML responses are analyzed for emerchantpay, Skrill, Authorize.net, BlueSnap and Inpay (ISO 20022 status reports).",
      "The getting-started page lists every accepted input format, and the demo has two XML examples.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "Identical records from providers without a delivery id are recognized as a possible repeated delivery and counted once, so a refund delivered twice no longer looks like two refunds.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "Provider list grouped by support level, and an Analyze as <provider> button for records that resemble a provider.",
      "Official documentation links are shown for every provider's decoded errors.",
      "Events without their own timestamp stay where they occurred in the timeline.",
      "Redaction covers the sensitive fields of the newer providers, including Flutterwave's verif-hash header, provider keys and UPI ids.",
      "Text redaction and the PayU India scrubber run in linear time on any input.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "New adapters with limited support: BlueSnap, PayU India, Razorpay, Paystack and Flutterwave.",
      "40 of 42 roadmap providers can now be analyzed; Pavilion Payments and Epoch publish no developer documentation.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "New adapters with limited support: Paysafe, Airwallex, Rapyd, dLocal and EBANX.",
      "35 of 42 roadmap providers can now be analyzed.",
      "Verified research for BlueSnap, PayU India, Razorpay, Paystack and Flutterwave.",
      "Redaction covers Nuvei checksum, session, card and payer fields.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "New adapters with limited support: Worldpay (Access Worldpay JSON), Cybersource, Authorize.net and Nuvei.",
      "30 of 42 roadmap providers can now be analyzed.",
      "Events linked by a transaction or root id are no longer reported as missing a reference.",
      "Redaction covers more card, track and credential field names.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "Documentation verified for Worldpay, Cybersource, Authorize.net and Nuvei; adapters are next.",
      "Plain-text HTTP error bodies are passed to adapters, and HTML error pages keep their status code.",
      "DECTA decodes its documented plain-text error texts when DECTA is selected.",
      "The repeated-attempt retry finding gives payout and non-card advice instead of card-only advice.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "High-risk wave HR-3 with limited support: Finrax (crypto payments and payouts), Inpay (bank transfers and payouts), DECTA (card acquiring) and Trustly (pay-by-bank, EU and North America).",
      "Underpaid crypto payments are shown as an unknown outcome, never as a success.",
      "JSON with trailing commas or comments, as in provider documentation examples, is accepted with a warning.",
      "26 of 42 roadmap providers can now be analyzed.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "High-risk wave HR-2 with limited support: emerchantpay, Ecommpay, Paymentwall, NMI, MiFinity, AstroPay, Skrill and eZeeWallet.",
      "Form examples split over lines that start with & are joined; form bodies labelled text/plain or text/html are parsed.",
      "XML input is reported as an unsupported format instead of a JSON error.",
      "Status responses that list past operations are no longer reported as out-of-order arrivals (rule catalog 2026.10.2).",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "High-risk wave HR-1 with limited support: CCBill, Segpay, Verotel, NETbilling, PXP Financial and Trust Payments.",
      "Qualification gate for all 20 high-risk candidates: 18 documentation verified, 2 blocked.",
      "Lifecycle rules for rebills, chargebacks, payouts, refunds and amount mismatches.",
      "GET callbacks, pasted callback URLs and status-only error responses are analyzed.",
      "New logo and provider directory filters for high-risk categories.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-25",
    status: "released",
    changes: [
      "Analysis engine for JSON, JSON Lines, URL-encoded form data and raw HTTP messages, with provider detection, correlation and deterministic rules (catalog 2026.10.0).",
      "Error decoder, timeline with filters, data inspector, findings and JSON/Markdown/PNG export.",
      "Supported providers: Stripe and Adyen. Limited support: payabl., Checkout.com, PayPal, Braintree, Mollie and Square.",
      "Provider directory with capability status for all 22 roadmap providers.",
      "GitHub Pages demo built from the same pages and engine.",
      "Optional admin area for the hosted app: magic link sign-in, passkey MFA, RBAC and audit log.",
      "Offline CLI with a configurable failure threshold.",
    ],
  },
];
