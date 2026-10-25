import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

/**
 * Static export for GitHub Pages. Reuses the pages and components of
 * apps/web, without the server-only parts (admin, API routes, proxy).
 */
const basePath = (process.env.PAGES_BASE_PATH ?? "/PandaPayLens").replace(/\/$/, "");
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// Canonical origin for shared content. Until a main domain is configured
// this is the GitHub Pages URL itself.
const siteUrl = process.env.CANONICAL_SITE_URL ?? `https://ratomirjovanovic.github.io${basePath}`;

const config: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_DEMO: "1",
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default config;
