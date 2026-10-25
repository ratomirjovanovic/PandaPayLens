import type { Metadata } from "next";
import { DocPage } from "@/components/DocPage";
import { MAINTAINER_URL, REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "PandaPayLens is a free, open-source, local-first developer tool for payment debugging, maintained by Ratomir Jovanovic.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <DocPage title="About PandaPayLens">
      <p>
        PandaPayLens is a free, open-source, local-first developer tool that decodes payment errors,
        reconstructs observed transaction event timelines, and explains diagnostic findings. The
        first release supports Stripe and Adyen through independent, versioned adapters.
      </p>
      <h2>Principles</h2>
      <ul>
        <li>Correctness and trust matter more than the number of features.</li>
        <li>Analysis is deterministic and explainable. There is no AI in the diagnostic path.</li>
        <li>Your data stays on your machine. No registration, no provider credentials.</li>
        <li>
          Observed facts are kept apart from inferences, and every finding states its limitations.
        </li>
        <li>
          You can use, inspect, extend and self-host PandaPayLens without depending on this site.
        </li>
      </ul>
      <h2>Maintainer</h2>
      <p>
        PandaPayLens is maintained by <a href={MAINTAINER_URL}>Ratomir Jovanovic</a>. Source code,
        issues and discussions are on <a href={REPO_URL}>GitHub</a>. The project is licensed under
        the Apache License 2.0.
      </p>
      <h2>Not affiliated</h2>
      <p>
        PandaPayLens is an independent project and is not affiliated with or endorsed by Stripe or
        Adyen. Product names are used only to describe compatibility.
      </p>
    </DocPage>
  );
}
