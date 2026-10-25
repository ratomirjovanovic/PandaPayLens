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
    status: "unreleased",
    changes: [
      "Analysis engine with bounded JSON/JSONL parsing, provider detection, correlation and deterministic rules.",
      "Stripe adapter: API errors, PaymentIntent snapshots, snapshot webhook events.",
      "Adyen adapter: Standard payment webhooks, payment responses, API errors.",
      "Nine diagnostic rules, rule catalog 2026.10.0.",
      "Web analyzer with error decoder, timeline, data inspector, findings and JSON/Markdown/PNG export.",
      "Offline CLI with configurable failure threshold.",
    ],
  },
];
