// Copies shared static files into the GitHub Pages app before a build:
// synthetic samples and the app icon. Generated files are git-ignored.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const repo = join(app, "..", "..");
const out = join(app, "public", "samples");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const samples = JSON.parse(readFileSync(join(repo, "fixtures", "samples.json"), "utf8"));
for (const s of samples) copyFileSync(join(repo, "fixtures", s.file), join(out, `${s.id}.txt`));
copyFileSync(join(repo, "apps", "web", "app", "icon.svg"), join(app, "app", "icon.svg"));
// GitHub Pages: do not run Jekyll over the export (it hides _next/).
mkdirSync(join(app, "public"), { recursive: true });
copyFileSync(join(here, "nojekyll"), join(app, "public", ".nojekyll"));
console.log(`[pages] Prepared ${samples.length} samples.`);
