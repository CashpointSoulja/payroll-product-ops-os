// Bundles src/ into a single Cloudflare Worker (dist/worker.js) that serves the
// static files from memory. No runtime dependencies, no bindings.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/data.js": ["data.js", "text/javascript; charset=utf-8"],
  "/scoring.js": ["scoring.js", "text/javascript; charset=utf-8"],
};

const assets = Object.fromEntries(
  Object.entries(files).map(([path, [file, type]]) => [path, { type, body: readFileSync(join(root, "src", file), "utf8") }])
);

const worker = `// Built by scripts/build.mjs from src/. Do not edit by hand.
const ASSETS = ${JSON.stringify(assets)};

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const path = url.pathname === "/index.html" ? "/" : url.pathname;
    const asset = ASSETS[path];
    if (!asset) {
      return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY } });
    }
    const headers = {
      "content-type": asset.type,
      "cache-control": path === "/" ? "no-cache" : "public, max-age=300",
      ...SECURITY,
    };
    return new Response(request.method === "HEAD" ? null : asset.body, { headers });
  },
};
`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "worker.js"), worker);
console.log(`dist/worker.js written (${(worker.length / 1024).toFixed(1)} KB, ${Object.keys(assets).length} routes)`);
