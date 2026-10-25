// Regenerates the provider table in README.md from the adapter manifests, so
// the README never claims more (or less) than the registry.
// Run after `pnpm build:packages`: node scripts/update-readme-providers.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MANIFESTS, ROADMAP } from "../packages/providers/dist/manifests.js";

const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
const readme = readFileSync(readmePath, "utf8");

const rows = MANIFESTS.map((m) => {
  const c = m.capabilities;
  return `| ${m.displayName} | ${m.status} | ${c.errorDecoding} | ${c.paymentResponses} | ${c.webhookParsing} | ${c.timeline} | ${c.correlation} |`;
});
const table = [
  "| Provider | Overall | Errors | API responses | Webhooks | Timeline | Correlation |",
  "|---|---|---|---|---|---|---|",
  ...rows,
].join("\n");

const start = readme.indexOf("<!-- providers:start -->");
const end = readme.indexOf("<!-- providers:end -->");
if (start < 0 || end < 0) throw new Error("README is missing the providers markers.");
const intro = `${MANIFESTS.length} of ${ROADMAP.length} roadmap providers can be analyzed today. "Supported" means implemented and covered by tests; "limited" means it works with documented gaps. Research candidates and planned providers are listed on the [providers page](https://ratomirjovanovic.github.io/PandaPayLens/providers/) and are not counted here.`;
const next = `${readme.slice(0, start)}<!-- providers:start -->\n\n${intro}\n\n${table}\n\n${readme.slice(end)}`;
writeFileSync(readmePath, next);
console.log(`[readme] ${MANIFESTS.length} providers in the table.`);
