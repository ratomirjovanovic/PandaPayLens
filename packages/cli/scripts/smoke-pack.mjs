// Packs the `pandapaylens` package, installs the tarball into an empty
// project and checks that the binary runs and that the library imports and
// type-checks without the workspace. Run after `pnpm build`.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(pkg, "..", "..", "node_modules", "typescript", "bin", "tsc");
const shell = process.platform === "win32";
const tmp = mkdtempSync(join(tmpdir(), "ppl-pack-"));
const fail = (msg) => {
  throw new Error(`[smoke-pack] ${msg}`);
};

try {
  execFileSync("pnpm", ["pack", "--pack-destination", tmp], { cwd: pkg, stdio: "ignore", shell });
  const tarball = readdirSync(tmp).find((f) => f.endsWith(".tgz"));
  if (!tarball) fail("pnpm pack produced no tarball.");

  const app = join(tmp, "app");
  mkdirSync(app);
  writeFileSync(join(app, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync(
    "npm",
    ["install", join("..", tarball), "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
    { cwd: app, stdio: "ignore", shell },
  );

  const installed = join(app, "node_modules", "pandapaylens");
  const meta = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  if (meta.dependencies && Object.keys(meta.dependencies).length > 0)
    fail(`the package has runtime dependencies: ${Object.keys(meta.dependencies).join(", ")}`);
  const bin = join(installed, meta.bin.pandapaylens);
  const cli = (...args) => execFileSync(process.execPath, [bin, ...args], { encoding: "utf8" });

  if (!cli("version").includes(meta.version))
    fail("`pandapaylens version` does not print the version.");
  const samples = JSON.parse(
    readFileSync(join(installed, "dist", "samples", "index.json"), "utf8"),
  );
  if (!cli("examples").includes(samples[0].id))
    fail("`pandapaylens examples` does not list the samples.");
  const report = cli(
    "analyze",
    join(installed, "dist", "samples", `${samples[0].id}.txt`),
    "--format",
    "json",
  );
  if (!Array.isArray(JSON.parse(report).events))
    fail("`pandapaylens analyze` printed no JSON report.");

  writeFileSync(
    join(app, "check.ts"),
    `import { analyze, ADAPTERS, defaultRules, type AnalysisResult } from "pandapaylens";
const r = analyze('{"type":"charge.failed"}');
const events: AnalysisResult["events"] | undefined = r.ok ? r.result.events : undefined;
console.log(ADAPTERS.length > 0 && defaultRules.length > 0 && events !== undefined ? "ok" : "fail");
`,
  );
  execFileSync(
    process.execPath,
    [
      tsc,
      "--strict",
      "--noEmit",
      "--skipLibCheck",
      "false",
      "--module",
      "nodenext",
      "--target",
      "es2022",
      "check.ts",
    ],
    { cwd: app, stdio: "inherit" },
  );
  execFileSync(process.execPath, [tsc, "--module", "nodenext", "--target", "es2022", "check.ts"], {
    cwd: app,
  });
  if (execFileSync(process.execPath, ["check.js"], { cwd: app, encoding: "utf8" }).trim() !== "ok")
    fail("the library import did not analyze the sample.");

  console.log(`[smoke-pack] ${tarball} installs, runs and type-checks.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
