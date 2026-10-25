import type { Metadata } from "next";
import { DocPage } from "@/components/DocPage";
import { ADAPTERS } from "@/lib/analyzer";

export const metadata: Metadata = {
  title: "Supported providers and formats",
  description:
    "Which Stripe and Adyen payloads PandaPayLens supports: API errors, PaymentIntents, snapshot webhook events, Adyen Standard webhooks and payment responses.",
  alternates: { canonical: "/docs/providers" },
};

export default function ProvidersPage() {
  return (
    <DocPage
      title="Providers and formats"
      lead="Each provider has its own adapter with explicit, versioned semantics. Nothing is detected just because a string mentions a provider's name."
    >
      {ADAPTERS.map((a) => (
        <section key={a.id}>
          <h2>
            {a.displayName}{" "}
            <span className="text-sm font-normal text-fg-muted">adapter {a.version}</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Format id</th>
                <th>Input</th>
              </tr>
            </thead>
            <tbody>
              {a.supportedFormats.map((f) => (
                <tr key={f.id}>
                  <td>
                    <code>{f.id}</code>
                  </td>
                  <td>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <h2>Stripe semantics</h2>
      <ul>
        <li>
          <code>code</code>, <code>decline_code</code> and <code>advice_code</code> are decoded
          separately. Retry guidance uses the most specific signal: advice code, then decline code,
          then error code, then error type.
        </li>
        <li>
          An <code>api_error</code> does not say whether the request took effect. PandaPayLens
          recommends verifying the object&apos;s state before trying again with the same idempotency
          key.
        </li>
        <li>
          Events are linked by PaymentIntent and charge ids. Duplicate deliveries are recognized by
          event id.
        </li>
        <li>
          A PaymentIntent snapshot&apos;s <code>created</code> time is when the PaymentIntent was
          created, not when its status was observed, so snapshots have no event time on the
          timeline.
        </li>
        <li>
          <strong>Not supported yet:</strong> v2 thin events (<code>v2.core.event</code>). They
          carry no embedded object, so they are recognized and explained, but not analyzed.
        </li>
      </ul>
      <p>
        References: <a href="https://docs.stripe.com/error-codes">Stripe error codes</a>,{" "}
        <a href="https://docs.stripe.com/declines/codes">decline codes</a>,{" "}
        <a href="https://docs.stripe.com/webhooks">webhooks</a>.
      </p>

      <h2>Adyen semantics</h2>
      <ul>
        <li>
          Standard webhooks are read from <code>notificationItems[].NotificationRequestItem</code>.
          Each item becomes its own event.
        </li>
        <li>
          Modifications (capture, refund, cancellation) are linked to the payment through{" "}
          <code>originalReference</code>. <code>merchantReference</code> is never used to merge
          payments, because it can be reused across attempts; it is only used to flag possible
          duplicate charges.
        </li>
        <li>
          Duplicate deliveries are recognized by <code>eventCode</code> + <code>pspReference</code>,
          not by timestamp.
        </li>
        <li>
          <code>CAPTURE</code> or <code>REFUND</code> with <code>success=true</code> means Adyen
          processed the request. It does not mean funds settled or reached the shopper.
        </li>
        <li>
          On successful authorisations Adyen&apos;s <code>reason</code> field holds the auth code,
          card summary and expiry; PandaPayLens drops it.
        </li>
        <li>
          <strong>Not supported yet:</strong> other webhook families (Balance Platform, Management,
          etc.). They are recognized and explained, but not analyzed.
        </li>
      </ul>
      <p>
        References:{" "}
        <a href="https://docs.adyen.com/development-resources/webhooks/webhook-types">
          webhook types
        </a>
        ,{" "}
        <a href="https://docs.adyen.com/development-resources/webhooks/handle-webhook-events">
          handling webhook events
        </a>
        , <a href="https://docs.adyen.com/development-resources/refusal-reasons">refusal reasons</a>
        .
      </p>

      <h2>Adding a provider</h2>
      <p>
        A new adapter needs input schemas, synthetic fixtures, documentation, tests and
        supported-version metadata. See <code>CONTRIBUTING.md</code> in the repository.
      </p>
    </DocPage>
  );
}
