// Reports client JavaScript size after `next build` and fails when it grows
// past the budget. Adapters and error catalogs belong in the analysis worker
// chunk, not in page bundles; this keeps that honest as providers are added.
import { appendFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const dir = join(process.cwd(), "apps/web/.next/static/chunks");
const BUDGET_PAGE_GZIP = Number(process.env.PAGE_JS_BUDGET_KB ?? 450) * 1024;
// The analysis worker holds the engine and every adapter catalog. It loads
// only when an analysis runs, so it has its own budget.
const BUDGET_WORKER_GZIP = Number(process.env.WORKER_JS_BUDGET_KB ?? 800) * 1024;
// A string that only the analysis engine contains.
const WORKER_MARKER = "No supported provider format matched this record.";

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".js"))
      files.push({
        path: p.slice(dir.length + 1),
        size: statSync(p).size,
        gzip: gzipSync(readFileSync(p)).length,
        worker: readFileSync(p, "utf8").includes(WORKER_MARKER),
      });
  }
};
walk(dir);
files.sort((a, b) => b.gzip - a.gzip);
const total = files.reduce((n, f) => n + f.gzip, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const lines = [
  `Client JS: ${files.length} chunks, ${kb(total)} gzip in total`,
  "",
  "Largest chunks (gzip):",
  ...files
    .slice(0, 10)
    .map((f) => `  ${kb(f.gzip).padStart(10)}  ${f.path}${f.worker ? "  (analysis worker)" : ""}`),
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Bundle size\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`,
  );

const worker = files.filter((f) => f.worker);
const pages = files.filter((f) => !f.worker);
let failed = false;
if (worker.length === 0) {
  console.error("No analysis worker chunk found; the engine may have moved into a page bundle.");
  failed = true;
}
for (const f of worker) {
  if (f.gzip > BUDGET_WORKER_GZIP) {
    console.error(
      `Worker chunk ${f.path} is ${kb(f.gzip)} gzip, over the ${kb(BUDGET_WORKER_GZIP)} budget.`,
    );
    failed = true;
  }
}
if (pages[0] && pages[0].gzip > BUDGET_PAGE_GZIP) {
  console.error(
    `Largest page chunk ${pages[0].path} is ${kb(pages[0].gzip)} gzip, over the ${kb(BUDGET_PAGE_GZIP)} budget.`,
  );
  failed = true;
}
if (failed) process.exit(1);
