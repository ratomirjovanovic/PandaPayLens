#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { EXIT, run } from "./cli.js";

let code: number;
try {
  code = run(process.argv.slice(2), {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    readStdin: () => readFileSync(0, "utf8"),
    readFile: (p) => readFileSync(p, "utf8"),
    color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
  });
} catch (e) {
  process.stderr.write(`Internal error: ${e instanceof Error ? e.message : String(e)}\n`);
  code = EXIT.INTERNAL;
}
process.exitCode = code;
