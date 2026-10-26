// Minimal static server that mimics GitHub Pages for the export in ./out:
// serves it under the base path, resolves directory index.html files and
// returns 404.html for unknown paths. Used by the end-to-end tests.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));
const basePath = (process.env.PAGES_BASE_PATH ?? "/PandaPayLens").replace(/\/$/, "");
const port = Number(process.env.PORT ?? 3200);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === basePath) {
    res.writeHead(301, { Location: `${basePath}/` }).end();
    return;
  }
  if (!url.pathname.startsWith(`${basePath}/`)) {
    res.writeHead(404).end("Not found");
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname.slice(basePath.length))).replace(
    /^([/\\])+/,
    "",
  );
  if (rel.includes("..")) {
    res.writeHead(400).end();
    return;
  }
  let file = join(out, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  let status = 200;
  if (!existsSync(file)) {
    file = join(out, "404.html");
    status = 404;
  }
  res.writeHead(status, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${out} at http://localhost:${port}${basePath}/`));
