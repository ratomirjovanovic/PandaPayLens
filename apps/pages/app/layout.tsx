import "@/app/globals.css";
import { RootShell, rootMetadata, rootViewport } from "@/components/RootShell";

export const metadata = rootMetadata;
export const viewport = rootViewport;

/**
 * GitHub Pages cannot send response headers, so the policy is a meta tag.
 * Inline scripts are needed by the static Next.js runtime (no per-request
 * nonce exists in a static build). connect-src 'self' keeps the key
 * guarantee: the page cannot send data to another origin.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return <RootShell csp={CSP}>{children}</RootShell>;
}
