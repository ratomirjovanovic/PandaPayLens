export type Release = {
  version: string;
  date: string;
  status: "unreleased" | "released";
  changes: string[];
};

/** Public release history. Keep in sync with CHANGELOG.md. */
export const RELEASES: Release[] = [
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
