// Verifies the static export before it is published to GitHub Pages.
// Fails the build if a required route is missing, if anything admin- or
// server-related leaked into the output, or if paths ignore the base path.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));
const basePath = (process.env.PAGES_BASE_PATH ?? "/PandaPayLens").replace(/\/$/, "");
const errors = [];

const required = [
  "index.html",
  "404.html",
  ".nojekyll",
  "analyze/index.html",
  "examples/index.html",
  "providers/index.html",
  "providers/stripe/index.html",
  "docs/index.html",
  "docs/security/index.html",
  "sitemap.xml",
  "robots.txt",
  "samples/stripe-insufficient-funds.txt",
];
for (const f of required) if (!existsSync(join(out, f))) errors.push(`missing ${f}`);

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(out);

// Nothing from the admin area or server runtime may be published.
for (const f of files) {
  const rel = relative(out, f).replace(/\\/g, "/");
  if (/^(admin|api)\//.test(rel)) errors.push(`server-only route exported: ${rel}`);
  if (!/\.(html|js|txt|xml|json|css)$/.test(f)) continue;
  const text = readFileSync(f, "utf8");
  for (const needle of [
    "DATABASE_URL",
    "DATABASE_MIGRATION_URL",
    "BETTER_AUTH_SECRET",
    "RESEND_API_KEY",
    "postgres://",
    "postgresql://",
  ]) {
    if (text.includes(needle)) errors.push(`${rel} contains "${needle}"`);
  }
  // Server-only routes of this app. A path on another host (for example a
  // provider's documentation at https://docs.example.com/api/authentication)
  // is not a reference to these routes.
  const serverRoute = new RegExp(`(?:(?<![\\w.-])|(?<=${basePath}))/api/(?:admin|auth)\\b`).exec(
    text,
  );
  if (serverRoute) errors.push(`${rel} references the server route "${serverRoute[0]}"`);
  if (rel.endsWith(".html")) {
    if (/(?:src|href)="\/_next\//.test(text))
      errors.push(`${rel} references /_next/ without the base path`);
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(text)?.[1];
    if (canonical && !canonical.startsWith("https://"))
      errors.push(`${rel} has a non-absolute canonical URL: ${canonical}`);
    if (!text.includes('http-equiv="Content-Security-Policy"'))
      errors.push(`${rel} has no Content-Security-Policy meta tag`);
  }
}

const home = readFileSync(join(out, "index.html"), "utf8");
if (!home.includes(`${basePath}/_next/`))
  errors.push(`index.html does not load assets from ${basePath}/_next/`);

if (errors.length) {
  console.error(`Static export verification failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`[verify] ${files.length} files OK (base path ${basePath}).`);
