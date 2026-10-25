// Copies the synthetic sample fixtures into dist/samples so the published CLI
// can run `pandapaylens examples <id>` without the repository.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "..", "fixtures");
const out = join(here, "..", "dist", "samples");
const samples = JSON.parse(readFileSync(join(fixtures, "samples.json"), "utf8"));
mkdirSync(out, { recursive: true });
for (const s of samples) copyFileSync(join(fixtures, s.file), join(out, `${s.id}.txt`));
writeFileSync(
  join(out, "index.json"),
  JSON.stringify(
    samples.map(({ file, ...s }) => s),
    null,
    2,
  ),
);
