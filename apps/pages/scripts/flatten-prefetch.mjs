// Next.js static export writes segment prefetch payloads as nested folders
// (route/__next.a/b/__PAGE__.txt) but the client requests them with dots
// (route/__next.a.b.__PAGE__.txt). GitHub Pages serves files literally, so
// add flattened copies next to the originals.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));
let copied = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) flatten(dir, p);
    else walk(p);
  }
}

/** Copies every file under `segDir` to `<routeDir>/<segDir name>.<sub>.<path>`. */
function flatten(routeDir, segDir) {
  const stack = [segDir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) stack.push(p);
      else {
        const flat = relative(routeDir, p).split(sep).join(".");
        copyFileSync(p, join(routeDir, flat));
        copied++;
      }
    }
  }
}

walk(out);
console.log(`[flatten] Added ${copied} prefetch file copies.`);
