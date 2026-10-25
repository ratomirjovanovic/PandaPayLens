// Reports client JavaScript size after `next build` and fails when it grows
// past the budget. Adapters and error catalogs belong in the analysis worker
// chunk, not in page bundles; this keeps that honest as providers are added.
import { appendFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const dir = join(process.cwd(), "apps/web/.next/static/chunks");
const BUDGET_PAGE_GZIP = Number(process.env.PAGE_JS_BUDGET_KB ?? 450) * 1024;

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
  ...files.slice(0, 10).map((f) => `  ${kb(f.gzip).padStart(10)}  ${f.path}`),
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Bundle size\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`,
  );

// The largest single chunk is a proxy for the heaviest page/worker payload.
if (files[0] && files[0].gzip > BUDGET_PAGE_GZIP) {
  console.error(
    `Largest chunk ${files[0].path} is ${kb(files[0].gzip)} gzip, over the ${kb(BUDGET_PAGE_GZIP)} budget.`,
  );
  process.exit(1);
}
