// Requests every official documentation URL that adapters, catalogs,
// manifests and rules cite, and fails when one is clearly broken (404, 410,
// a "page not found" redirect or a host that does not resolve). Many
// documentation sites block or rate limit automated requests, so 401, 403,
// 429 and 5xx answers are reported as unverified instead of failing.
// Needs no install or build: node scripts/check-doc-links.mjs
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../packages/", import.meta.url));
const CONCURRENT_HOSTS = 8;
const TIMEOUT_MS = 25_000;
const HOST_DELAY_MS = 300;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const NOT_FOUND_PAGE = /page-?not-?found|\/404(?:[/.?#]|$)/i;

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "tests") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) files.push(p);
  }
};
walk(root);

/** URL -> first file that cites it. */
const urls = new Map();
const add = (url, file) => {
  const clean = url.replace(/[.,;:]+$/, "");
  if (/[{}]/.test(clean)) return; // templates such as https://{prefix}.api...
  const host = URL.canParse(clean) ? new URL(clean).hostname : "";
  if (!host.includes(".")) return; // placeholders such as https://host/path
  if (!urls.has(clean)) urls.set(clean, relative(join(root, ".."), file).replaceAll("\\", "/"));
};

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // Base constants such as `const DOCS = "https://..."` and constants built
  // from them; a constant used only as a prefix is not a page of its own.
  const consts = {};
  for (const m of src.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*"(https:\/\/[^"]+)"/g))
    consts[m[1]] = m[2];
  for (const m of src.matchAll(
    /const\s+([A-Z][A-Z0-9_]*)\s*=\s*`\$\{([A-Z][A-Z0-9_]*)\}([^`$]*)`/g,
  ))
    if (consts[m[2]]) consts[m[1]] = consts[m[2]] + m[3];
  const prefixes = new Set();
  const found = [];
  for (const m of src.matchAll(/`\$\{([A-Z][A-Z0-9_]*)\}([^`$]*)`/g)) {
    if (!consts[m[1]]) continue;
    prefixes.add(consts[m[1]]);
    found.push(consts[m[1]] + m[2]);
  }
  for (const m of src.matchAll(/\b([A-Z][A-Z0-9_]*)\s*\+\s*"([^"]*)"/g)) {
    if (!consts[m[1]]) continue;
    prefixes.add(consts[m[1]]);
    found.push(consts[m[1]] + m[2]);
  }
  for (const m of src.matchAll(/https:\/\/[^\s"'`<>)\\]+/g)) found.push(m[0]);
  for (const url of found) if (!prefixes.has(url)) add(url, file);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(url) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(3000);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await res.body?.cancel();
      if (res.status === 404 || res.status === 410)
        return { kind: "broken", detail: `${res.status}` };
      if (res.ok && NOT_FOUND_PAGE.test(new URL(res.url).pathname + new URL(res.url).search))
        return { kind: "broken", detail: `redirects to ${res.url}` };
      if (res.ok) return { kind: "ok" };
      last = { kind: "unverified", detail: `${res.status}` };
      if (res.status !== 429 && res.status < 500) return last;
    } catch (err) {
      const code = err?.cause?.code ?? err?.name ?? "error";
      if (code === "ENOTFOUND") return { kind: "broken", detail: "host does not resolve" };
      last = { kind: "unverified", detail: String(code) };
    }
  }
  return last;
}

const byHost = new Map();
for (const url of urls.keys()) {
  const host = new URL(url).hostname;
  if (!byHost.has(host)) byHost.set(host, []);
  byHost.get(host).push(url);
}
const results = new Map();
const queue = [...byHost.values()];
await Promise.all(
  Array.from({ length: CONCURRENT_HOSTS }, async () => {
    for (let list = queue.shift(); list; list = queue.shift()) {
      for (const url of list) {
        results.set(url, await check(url));
        await sleep(HOST_DELAY_MS);
      }
    }
  }),
);

const broken = [...results].filter(([, r]) => r.kind === "broken");
const unverified = [...results].filter(([, r]) => r.kind === "unverified");
const line = ([url, r]) => `- ${url} (${r.detail}) in ${urls.get(url)}`;
const report = [
  `Checked ${results.size} documentation links: ${broken.length} broken, ${unverified.length} unverified.`,
  ...(broken.length ? ["", "Broken:", ...broken.map(line)] : []),
  ...(unverified.length
    ? ["", "Unverified (blocked, rate limited or unavailable):", ...unverified.map(line)]
    : []),
].join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
process.exitCode = broken.length ? 1 : 0;
