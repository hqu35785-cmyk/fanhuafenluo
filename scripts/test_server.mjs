import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(process.env.SITE_ROOT || process.cwd());
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

function resolveRequest(url) {
  const parsed = new URL(url, `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  const candidate = path.resolve(ROOT, `.${pathname}`);
  const relative = path.relative(ROOT, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return candidate;
}

const server = http.createServer((request, response) => {
  const file = resolveRequest(request.url || "/");
  if (!file) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end("Not Found");
      return;
    }
    response.setHeader("Content-Type", mimeTypes.get(path.extname(file).toLowerCase()) || "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file)
      .on("error", () => response.writeHead(500).end("Read error"))
      .pipe(response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`test server listening on http://${HOST}:${PORT}/index.html`);
});

function shutdown() {
  server.close(error => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
