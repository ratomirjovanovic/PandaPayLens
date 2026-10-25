// Copies the synthetic sample fixtures to public/samples so the analyzer can
// load examples from its own origin, whatever their format (JSON or form text).
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "..", "fixtures");
const out = join(here, "..", "public", "samples");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const samples = JSON.parse(readFileSync(join(fixtures, "samples.json"), "utf8"));
for (const s of samples) copyFileSync(join(fixtures, s.file), join(out, `${s.id}.txt`));
console.log(`[samples] Copied ${samples.length} samples.`);
