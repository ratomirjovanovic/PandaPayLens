import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/DocPage";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to use PandaPayLens: supported input, the receipt-time envelope, findings, retry guidance, exports, the CLI and the TypeScript packages.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return (
    <DocPage
      title="Getting started"
      lead="PandaPayLens explains payment errors and reconstructs event timelines from the JSON you already have."
    >
      <h2>1. Provide input</h2>
      <p>
        Open the <Link href="/analyze">analyzer</Link> and paste JSON, drop <code>.json</code> or{" "}
        <code>.jsonl</code> files, or load an <Link href="/examples">example</Link>. You can mix
        several files in one session; events from different files are correlated if they share
        identifiers.
      </p>
      <p>Accepted shapes:</p>
      <ul>
        <li>A single JSON object (an API error, a PaymentIntent, a webhook body).</li>
        <li>A JSON array of such objects.</li>
        <li>JSON Lines: one object per line.</li>
        <li>URL-encoded form data, as many postbacks and callbacks are sent.</li>
        <li>
          A raw HTTP request or response, including its status line and headers, or a callback URL
          with the data in its query string.
        </li>
        <li>
          An XML document. Documents with a DOCTYPE or entity declarations are rejected for safety.
        </li>
      </ul>
      <p>
        Default limits: 5 MB per file, 20 MB per session, 5,000 records, nesting depth 64. Larger or
        deeper input fails with a clear message instead of freezing the page.
      </p>

      <h3>Recording when you received a webhook</h3>
      <p>
        Providers include when an event was created, but not when your system received it. To
        analyze arrival order, wrap each record in the PandaPayLens envelope:
      </p>
      <pre>
        <code>{`{ "receivedAt": "2026-10-25T10:00:03Z", "payload": { …the webhook body… } }`}</code>
      </pre>
      <p>
        Without it, PandaPayLens assumes the order of records in your input is the arrival order and
        says so in every affected finding.
      </p>

      <h2>2. Read the results</h2>
      <ul>
        <li>
          <strong>Error decoder</strong>: the code, category, explanation, suggested next step,
          retry guidance, confidence and documentation link. Stripe&apos;s <code>code</code>,{" "}
          <code>decline_code</code> and <code>advice_code</code> stay separate; the advice code
          takes precedence for retry guidance.
        </li>
        <li>
          <strong>Timeline</strong>: events grouped into transactions by explicit identifiers
          (PaymentIntent, charge, pspReference, originalReference). Switch between event time and
          receipt order, and filter by provider, type, status, reference or time range.
        </li>
        <li>
          <strong>Data inspector</strong>: each input record after redaction, with the reasons it
          was or wasn&apos;t recognized.
        </li>
        <li>
          <strong>Findings</strong>: deterministic rules with severity, confidence, evidence,
          limitations and a recommended next step.
        </li>
      </ul>

      <h3>Retry guidance</h3>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>do_not_retry</code>
            </td>
            <td>The same request will fail again, or retrying could be penalized.</td>
          </tr>
          <tr>
            <td>
              <code>customer_action_required</code>
            </td>
            <td>
              The customer must authenticate, correct details, or choose another method first.
            </td>
          </tr>
          <tr>
            <td>
              <code>retry_conditionally</code>
            </td>
            <td>
              A later attempt may succeed. When the original outcome is unknown, verify it first and
              reuse the idempotency key.
            </td>
          </tr>
          <tr>
            <td>
              <code>safe_to_retry_technical_request</code>
            </td>
            <td>A technical retry (with backoff and the same idempotency key) is appropriate.</td>
          </tr>
          <tr>
            <td>
              <code>manual_review</code> / <code>unknown</code>
            </td>
            <td>No safe automatic conclusion is possible.</td>
          </tr>
        </tbody>
      </table>
      <p>These are diagnostic categories, not instructions to send a payment.</p>

      <h3>Findings</h3>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>What it reports</th>
          </tr>
        </thead>
        <tbody>
          {[
            [
              "DUPLICATE_DELIVERY",
              "The same provider event appears more than once. Expected provider behavior, not proof of double processing.",
            ],
            [
              "OUT_OF_ORDER_ARRIVAL",
              "An event arrived after one created later. Not a defect by itself.",
            ],
            ["CONFLICTING_OBSERVATIONS", "Copies of one event report different states."],
            ["PAYMENT_FAILURE", "The provider reported a failed payment, capture or refund."],
            [
              "UNRESOLVED_OUTCOME",
              "No final success or failure is visible in the supplied events.",
            ],
            [
              "POTENTIAL_STATE_INCONSISTENCY",
              "States contradict documented transitions (e.g. a PaymentIntent changing after succeeded).",
            ],
            [
              "POSSIBLE_RETRY_RISK",
              "Unknown-outcome errors, repeated attempts after do-not-retry declines, or several authorised payments for one merchantReference.",
            ],
            ["MISSING_REFERENCE", "Events that cannot be linked to a payment."],
            ["UNKNOWN_EVENT_TYPE", "Event types PandaPayLens has no semantics for yet."],
          ].map(([rule, text]) => (
            <tr key={rule}>
              <td>
                <code>{rule}</code>
              </td>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. Export</h2>
      <p>
        Download a JSON or Markdown report, or a PNG of the timeline. Reports include the analysis
        time, PandaPayLens and rule-catalog versions, recognized formats, events, findings,
        confidence, limitations and redaction status. Identifiers are masked unless you opt in;
        blocked fields such as card data and secrets are never exported.
      </p>

      <h2>Command line</h2>
      <pre>
        <code>{`npx @pandapaylens/cli analyze events.json
pandapaylens decode error.json --format markdown
pandapaylens timeline - < webhooks.jsonl
pandapaylens analyze log.json --fail-on medium   # exit 1 on medium+ findings
pandapaylens examples                            # list bundled samples`}</code>
      </pre>
      <p>
        Exit codes: 0 ok, 1 findings at or above <code>--fail-on</code>, 2 invalid input, 3
        unsupported provider or format, 4 internal error.
      </p>

      <h2>Library</h2>
      <pre>
        <code>{`import { analyzeText } from "@pandapaylens/core";
import { stripeAdapter } from "@pandapaylens/stripe";
import { adyenAdapter } from "@pandapaylens/adyen";
import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";

const r = analyzeText(json, {
  adapters: [stripeAdapter, adyenAdapter],
  rules: defaultRules,
  catalogVersion: RULE_CATALOG_VERSION,
});
if (r.ok) console.log(r.result.findings);`}</code>
      </pre>
      <p>Package names are provisional until publication.</p>
    </DocPage>
  );
}
