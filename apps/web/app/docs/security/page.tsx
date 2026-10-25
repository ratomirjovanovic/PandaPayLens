import type { Metadata } from "next";
import { DocPage } from "@/components/DocPage";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security and privacy",
  description:
    "How PandaPayLens keeps imported payment data local: in-browser analysis, a restrictive Content Security Policy, no storage, no telemetry, and redaction of sensitive fields.",
  alternates: { canonical: "/docs/security" },
};

export default function SecurityPage() {
  return (
    <DocPage
      title="Security and privacy"
      lead="Treat every payment log as sensitive. PandaPayLens is designed so that your data never needs to leave your machine."
    >
      <h2>What happens to your data</h2>
      <ul>
        <li>
          Parsing, analysis and exports run in your browser, in a Web Worker. There is no
          server-side analysis endpoint.
        </li>
        <li>
          The page&apos;s Content Security Policy sets <code>connect-src &apos;self&apos;</code>, so
          the browser blocks requests to any other origin. The site makes no requests that contain
          your input.
        </li>
        <li>
          Imported data is not written to cookies, localStorage, sessionStorage or IndexedDB.
          Reloading the page clears it. Only your theme choice is stored.
        </li>
        <li>No analytics, session replay, or third-party scripts are loaded.</li>
        <li>
          Exports are generated locally and saved through your browser&apos;s download mechanism.
        </li>
      </ul>

      <h2>Sensitive fields</h2>
      <p>
        Card numbers, security codes, expiry data, secrets and API keys, tokens and signatures,
        names, emails, phone numbers, addresses, IPs and bank details are hidden in the data
        inspector and never exported. Normalization copies only allowlisted fields, and free text is
        scanned for card numbers (Luhn-checked), keys, emails and IBANs as a second layer.
      </p>
      <p>
        <strong>Redaction is best effort.</strong> Pattern matching cannot guarantee that a document
        is anonymized. Avoid pasting production data that contains full card numbers or security
        codes, and review exports before sharing them.
      </p>

      <h2>Untrusted input</h2>
      <ul>
        <li>
          JSON is parsed strictly, with limits on size, nesting depth, record count and string
          length. Analysis is stopped if it takes too long.
        </li>
        <li>Prototype-pollution keys are removed before analysis.</li>
        <li>
          Imported values are always rendered as text, never as HTML. Markdown exports escape all
          imported values.
        </li>
        <li>
          URLs inside payloads are never fetched. Documentation links point only to Stripe and Adyen
          documentation.
        </li>
      </ul>

      <h2>Self-hosting</h2>
      <p>
        The analyzer is a static, database-free Next.js application. Self-hosted instances run
        independently and have no connection to the official site. Keep the security headers from{" "}
        <code>proxy.ts</code> and <code>next.config.ts</code> when deploying.
      </p>

      <h2>What we don&apos;t claim</h2>
      <p>
        PandaPayLens is not PCI DSS certified and has not had an independent penetration test.
        Security statements on this page describe controls that are implemented and covered by
        automated tests in the repository.
      </p>

      <h2>Reporting a vulnerability</h2>
      <p>
        Please report vulnerabilities privately through GitHub&apos;s private vulnerability
        reporting on the <a href={`${REPO_URL}/security`}>repository&apos;s Security tab</a>. See{" "}
        <code>SECURITY.md</code> for supported versions and the disclosure process. Do not include
        real payment data in reports.
      </p>
    </DocPage>
  );
}
