import type { Metadata } from "next";
import { DocPage } from "@/components/DocPage";
import { RELEASES } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "PandaPayLens release history.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return (
    <DocPage title="Changelog">
      {RELEASES.map((r) => (
        <section key={r.version}>
          <h2>
            {r.version}{" "}
            <span className="text-sm font-normal text-fg-muted">
              {r.status === "unreleased" ? "unreleased" : r.date}
            </span>
          </h2>
          <ul>
            {r.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ))}
    </DocPage>
  );
}
