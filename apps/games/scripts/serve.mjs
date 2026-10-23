// Dev server for the games origin: serves this folder the way the live bucket will.
// Usage: node scripts/serve.mjs [port]   (default 3001)
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.argv[2] || process.env.GAMES_PORT || 3001);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".pck": "application/octet-stream",
  ".json": "application/json",
  ".png": "image/png", // builds/<id>/poster.png: the start-screen picture (share pages, the frame before Play)
};
// Only what the bucket holds: the loader, engines, builds.
const allowed = ["play.html", "engine" + sep, "builds" + sep];

http
  .createServer((req, res) => {
    const path = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^([\\/])+/, "") || "play.html";
    const file = join(root, path);
    if (!file.startsWith(root + sep) || !allowed.some((a) => path === a || path.startsWith(a))) {
      return res.writeHead(404).end("not found");
    }
    let size;
    try {
      size = statSync(file).size;
    } catch {
      return res.writeHead(404).end("not found");
    }
    const ext = extname(file);
    const immutable = path.startsWith("engine" + sep) || (path.startsWith("builds" + sep) && ext !== ".json");
    res.writeHead(200, {
      "content-type": types[ext] || "application/octet-stream",
      "content-length": size,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-content-type-options": "nosniff",
    });
    createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () => console.log(`games origin on http://127.0.0.1:${port}/play.html?g=robot-runner`));
