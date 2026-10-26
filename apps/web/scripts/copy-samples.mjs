// Copies the synthetic sample fixtures to public/samples so the analyzer can
// load examples from its own origin, whatever their format (JSON or form text).
// Also copies the demo video and its poster from docs/media to public/media.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const fixtures = join(repo, "fixtures");
const out = join(here, "..", "public", "samples");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const samples = JSON.parse(readFileSync(join(fixtures, "samples.json"), "utf8"));
for (const s of samples) copyFileSync(join(fixtures, s.file), join(out, `${s.id}.txt`));
const media = join(here, "..", "public", "media");
rmSync(media, { recursive: true, force: true });
mkdirSync(media, { recursive: true });
for (const f of ["pandapaylens-demo.mp4", "pandapaylens-demo.jpg"])
  copyFileSync(join(repo, "docs", "media", f), join(media, f));
console.log(`[samples] Copied ${samples.length} samples and the demo video.`);
