// Builds the published `pandapaylens` package: one bundled ESM build of the
// CLI and the library entry (no runtime dependencies), and type declarations
// that resolve without the unpublished workspace packages.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = join(pkg, "..");
const dist = join(pkg, "dist");

// tsc wrote declarations and unbundled JavaScript; keep only the declarations.
for (const f of readdirSync(dist)) if (/\.(js|js\.map|d\.ts\.map)$/.test(f)) rmSync(join(dist, f));

await build({
  entryPoints: [join(pkg, "src/bin.ts"), join(pkg, "src/index.ts")],
  outdir: dist,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node22",
  chunkNames: "chunk-[hash]",
  legalComments: "none",
  // Smaller download; identifiers stay readable in stack traces.
  minifyWhitespace: true,
  minifySyntax: true,
  logLevel: "warning",
});

// Types of the bundled workspace packages, with their imports rewritten.
const TYPES = ["core", "providers", "rules"];
const rewrite = (text, prefix) =>
  text
    .replace(/(from |import\()"@pandapaylens\/(core|providers|rules)"/g, `$1"${prefix}$2/index.js"`)
    .replace(/\n\/\/# sourceMappingURL=.*$/, "\n");
for (const name of TYPES) {
  const src = join(packages, name, "dist");
  const out = join(dist, "types", name);
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(src).filter((f) => f.endsWith(".d.ts")))
    writeFileSync(join(out, f), rewrite(readFileSync(join(src, f), "utf8"), "../"));
}
for (const f of readdirSync(dist).filter((f) => f.endsWith(".d.ts")))
  writeFileSync(join(dist, f), rewrite(readFileSync(join(dist, f), "utf8"), "./types/"));

copyFileSync(join(packages, "..", "LICENSE"), join(pkg, "LICENSE"));
