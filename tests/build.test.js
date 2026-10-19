import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let worker;

before(async () => {
  execFileSync(process.execPath, [join(root, "scripts/build.mjs")]);
  worker = (await import(pathToFileURL(join(root, "dist/worker.js")).href + `?t=${Date.now()}`)).default;
});

const get = (path, method = "GET") => worker.fetch(new Request(`https://example.test${path}`, { method }));

test("serves every route with the right content type and security headers", async () => {
  for (const [path, type] of [["/", "text/html"], ["/index.html", "text/html"], ["/styles.css", "text/css"], ["/app.js", "text/javascript"], ["/data.js", "text/javascript"], ["/scoring.js", "text/javascript"]]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.ok(res.headers.get("content-type").startsWith(type), path);
    assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  }
});

test("unknown paths 404, non-GET methods 405, HEAD has no body", async () => {
  assert.equal((await get("/nope")).status, 404);
  assert.equal((await get("/", "POST")).status, 405);
  const head = await get("/", "HEAD");
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("page carries the required framing exactly once", async () => {
  const html = await (await get("/")).text();
  assert.equal(html.match(/class="brand__tag">unofficial concept</g).length, 1, "logo label");
  assert.equal(html.match(/Sample data\./g).length, 1);
  assert.equal(html.match(/Ayo Ahmed, independent concept/g).length, 1);
  assert.match(html, /aria-label="Deel logo"/);
});

test("no tool attribution in source, build or docs", () => {
  const banned = /generated (by|with)|co-authored-by|powered by|made with|built with/i;
  const files = [
    ...readdirSync(join(root, "src")).map((f) => join(root, "src", f)),
    join(root, "dist/worker.js"),
    join(root, "README.md"),
    ...readdirSync(join(root, "docs")).map((f) => join(root, "docs", f)),
  ];
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), banned, f);
});

test("front end is deterministic: no clock, randomness or network calls", () => {
  for (const f of ["app.js", "data.js", "scoring.js"]) {
    const src = readFileSync(join(root, "src", f), "utf8");
    assert.doesNotMatch(src, /Date\.now\(|new Date\(\)|Math\.random|fetch\(|XMLHttpRequest|WebSocket/, f);
  }
});
