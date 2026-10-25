import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminEnabled } from "@/lib/admin/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  // Without configuration the admin area does not exist (self-hosted analyzer-only mode).
  if (!adminEnabled()) notFound();
  return <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>;
}
