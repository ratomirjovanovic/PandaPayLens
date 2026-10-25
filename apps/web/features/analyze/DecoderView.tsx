import { maskIdentifier, type AnalysisResult } from "@pandapaylens/core";
import { CATEGORY_LABEL, CONFIDENCE_LABEL, RETRY_CLASS, RETRY_LABEL } from "./labels";
import { CopyButton } from "./CopyButton";
import { isOfficialDocUrl as safeDoc } from "@/lib/doc-links";

export function DecoderView({ result, showIds }: { result: AnalysisResult; showIds: boolean }) {
  if (!result.errors.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-fg-muted">
        No provider error was found in this input.{" "}
        {result.events.length > 0
          ? "Open the timeline to see the events."
          : "See the warnings in the findings panel."}
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {result.errors.map((e) => (
        <li key={e.id}>
          <article
            aria-labelledby={`${e.id}-title`}
            className="rounded-xl border border-border bg-card p-5"
          >
            <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
                {e.provider}
              </span>
              <h3
                id={`${e.id}-title`}
                className="min-w-0 break-all font-mono text-lg font-semibold"
              >
                {e.code}
              </h3>
              <span className="ml-auto text-sm text-fg-muted">{CATEGORY_LABEL[e.category]}</span>
            </header>
            {Object.keys(e.subCodes).length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-2 text-xs">
                {Object.entries(e.subCodes).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-border bg-bg px-2 py-1">
                    <dt className="inline text-fg-muted">{k}: </dt>
                    <dd className="inline break-all font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-4 leading-relaxed">{e.explanation}</p>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium text-fg-muted">Suggested next step</dt>
              <dd>{e.nextAction}</dd>
              <dt className="font-medium text-fg-muted">Retry guidance</dt>
              <dd>
                <span className={`font-semibold ${RETRY_CLASS[e.retry]}`}>
                  {RETRY_LABEL[e.retry]}
                </span>
                <span className="block text-fg-muted">{e.retryExplanation}</span>
              </dd>
              <dt className="font-medium text-fg-muted">Confidence</dt>
              <dd>{CONFIDENCE_LABEL[e.confidence]}</dd>
              {e.providerMessage && (
                <>
                  <dt className="font-medium text-fg-muted">Provider message</dt>
                  <dd className="break-words rounded-md bg-code px-2 py-1 font-mono text-xs">
                    {e.providerMessage}
                  </dd>
                </>
              )}
              {e.paymentReference && (
                <>
                  <dt className="font-medium text-fg-muted">Payment reference</dt>
                  <dd className="flex items-center gap-2 font-mono text-xs">
                    {showIds ? e.paymentReference : maskIdentifier(e.paymentReference)}
                    {showIds && (
                      <CopyButton text={e.paymentReference} label="Copy payment reference" />
                    )}
                  </dd>
                </>
              )}
              {e.missingInformation.length > 0 && (
                <>
                  <dt className="font-medium text-fg-muted">Missing information</dt>
                  <dd>
                    <ul className="list-disc pl-4 text-warn">
                      {e.missingInformation.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
              {e.documentation.some((d) => safeDoc(d.url)) && (
                <>
                  <dt className="font-medium text-fg-muted">Documentation</dt>
                  <dd className="flex flex-col gap-1">
                    {e.documentation
                      .filter((d) => safeDoc(d.url))
                      .map((d) => (
                        <a
                          key={d.url + d.title}
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline underline-offset-2"
                        >
                          {d.title} ↗
                        </a>
                      ))}
                  </dd>
                </>
              )}
            </dl>
            {result.events.length <= 1 && (
              <p className="mt-4 border-t border-border pt-3 text-xs text-fg-muted">
                Only this record was supplied, so the complete transaction history is not available.
                Retry guidance is diagnostic, not an instruction to resend a payment.
              </p>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
