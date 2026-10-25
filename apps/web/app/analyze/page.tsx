import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace } from "@/features/analyze/Workspace";

export const metadata: Metadata = {
  title: "Analyze payment JSON",
  description:
    "Paste Stripe or Adyen errors, events and webhooks. Decode errors, rebuild the event timeline and get deterministic findings. Runs entirely in your browser.",
  alternates: { canonical: "/analyze" },
  // Private analysis content is never indexed; the page itself carries no data.
  robots: { index: true, follow: true },
};

export default function AnalyzePage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
