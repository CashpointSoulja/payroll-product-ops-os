// End-to-end checks in a real Chromium against the built worker.
// Usage: npm run build && npm run test:e2e   (needs Playwright installed locally or globally)
import { createServer } from "node:http";
import { createRequire } from "node:module";
import worker from "../dist/worker.js";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(`${process.env.NODE_PATH || "/usr/local/lib/node_modules"}/playwright`));
}

const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
const server = createServer(async (req, res) => {
  const r = await worker.fetch(new Request(BASE + req.url, { method: req.method }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT);

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.message.split("\n")[0] });
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const rows = () => page.locator("#rows tr[data-id]").count();

await check("All five routes render with a heading and no console errors", async () => {
  for (const r of ["", "intake", "gtm", "rca", "cadence"]) {
    await page.goto(`${BASE}/#/${r}`);
    await page.waitForSelector("main h1");
  }
  expect(errors.length === 0, errors.join(" | "));
});

await check("Active tab follows the route", async () => {
  await page.goto(`${BASE}/#/gtm`);
  const current = await page.locator('.tabs a[aria-current="page"]').textContent();
  expect(current === "GTM rollout", current);
});

await check("Overview KPIs are computed from the data (3 open P0s, T-14)", async () => {
  await page.goto(`${BASE}/#/`);
  const text = await page.locator(".hero .kpis").innerText();
  expect(/3\s+Open P0s/.test(text) && /T-14/.test(text), text);
});

await check("Intake shows 16 open themes by default, 20 with closed included", async () => {
  await page.goto(`${BASE}/#/intake`);
  expect((await rows()) === 16, `got ${await rows()}`);
  await page.check('[data-f="includeClosed"]');
  expect((await rows()) === 20, `got ${await rows()}`);
  await page.uncheck('[data-f="includeClosed"]');
});

await check("Filters narrow the board (country = Ireland → 1 row)", async () => {
  await page.selectOption('[data-f="country"]', "IE");
  expect((await rows()) === 1, `got ${await rows()}`);
  await page.selectOption('[data-f="country"]', "");
  await page.fill('[data-f="q"]', "krankengeld");
  expect((await rows()) === 1, `search got ${await rows()}`);
  await page.fill('[data-f="q"]', "");
});

await check("Moving weights re-ranks live and shows rank movement", async () => {
  const before = await page.locator("#rows tr[data-id]").evaluateAll((els) => els.map((e) => e.dataset.id));
  for (const [k, v] of [["reach", 100], ["revenue", 0], ["compliance", 0], ["strategic", 0]])
    await page.locator(`[data-w="${k}"]`).fill(String(v));
  const after = await page.locator("#rows tr[data-id]").evaluateAll((els) => els.map((e) => e.dataset.id));
  expect(JSON.stringify(before) !== JSON.stringify(after), "order unchanged");
  expect((await page.locator(".rank-move").count()) > 0, "no movement markers");
  expect((await page.locator('[data-wv="reach"]').textContent()) === "100%", "weight label");
  await page.click('[data-act="weights-reset"]');
  const reset = await page.locator("#rows tr[data-id]").evaluateAll((els) => els.map((e) => e.dataset.id));
  expect(JSON.stringify(before) === JSON.stringify(reset), "reset did not restore order");
  expect((await page.locator(".rank-move").count()) === 0, "markers remain after reset");
});

await check("Row opens a drawer with the score breakdown; Escape closes it", async () => {
  await page.click('tr[data-id="FB-1057"]');
  const t = await page.locator(".drawer").innerText();
  expect(/why it scores 61\.4/i.test(t) && /Compliance floor/i.test(t), t.slice(0, 200));
  await page.keyboard.press("Escape");
  expect((await page.locator(".drawer").count()) === 0, "drawer still open");
});

await check("Log feedback validates the title", async () => {
  await page.click('[data-act="log"]');
  await page.fill('[name="title"]', "short");
  await page.click('button[type="submit"]');
  expect(await page.locator("#form-error").isVisible(), "no error shown");
});

await check("Log feedback previews the score live and adds the theme to the board", async () => {
  await page.fill('[name="title"]', "Ireland: sick leave not paid for employees on probation");
  await page.selectOption('[name="country"]', "IE");
  await page.selectOption('[name="compliance"]', "5");
  const band = await page.locator("#pv-band").innerText();
  expect(/P0/.test(band), band);
  await page.click('button[type="submit"]');
  await page.waitForSelector('tr[data-id="FB-2001"]');
  expect((await rows()) === 17, `got ${await rows()}`);
  expect(await page.locator('tr[data-id="FB-2001"]').evaluate((e) => e.classList.contains("is-new")), "not highlighted");
});

await check("Logged theme persists across reload; Reset sample data removes it", async () => {
  await page.reload();
  await page.waitForSelector('tr[data-id="FB-2001"]');
  await page.click('[data-act="reset"]');
  await page.waitForSelector("#rows tr[data-id]");
  expect((await page.locator('tr[data-id="FB-2001"]').count()) === 0, "still present");
});

await check("Deep link #/intake/FB-1042 opens that theme", async () => {
  await page.goto(`${BASE}/#/intake/FB-1042`);
  await page.waitForSelector(".drawer");
  expect(/SSP waiting days/.test(await page.locator(".drawer h2").innerText()), "wrong drawer");
});

await check("GTM matrix: 6 countries × 7 workstreams; risk filter; cell drawer shows linked risk", async () => {
  await page.goto(`${BASE}/#/gtm`);
  expect((await page.locator("#matrix td.cell").count()) === 42, "cell count");
  await page.check("[data-risk-only]");
  const chips = await page.locator("#matrix td.cell .chip").count();
  expect(chips === 8, `risk-only chips ${chips}`);
  await page.uncheck("[data-risk-only]");
  await page.click('td.cell[data-c="IE"][data-w="product"]');
  expect(/R-01/.test(await page.locator(".drawer").innerText()), "no risk in drawer");
});

await check("RCA list switches detail and updates the URL; deep link works", async () => {
  await page.goto(`${BASE}/#/rca`);
  await page.click('[data-rca="RCA-038"]');
  expect(/funding received/.test(await page.locator("#rca-detail h2").innerText()), "detail not switched");
  expect(page.url().endsWith("#/rca/RCA-038"), page.url());
  await page.goto(`${BASE}/#/rca/RCA-031`);
  expect(/April 2026/.test(await page.locator("#rca-detail h2").innerText()), "deep link");
  expect((await page.locator(".whys li").count()) === 5, "five whys");
});

await check("Cadence: 6 rituals, pre-read built from data, ritual drawer", async () => {
  await page.goto(`${BASE}/#/cadence`);
  expect((await page.locator(".ritual").count()) === 6, "ritual count");
  const pre = await page.locator(".preread").innerText();
  expect(/3 themes need an owner/.test(pre) && /Wave 1 at T-14/.test(pre), pre.slice(0, 200));
  await page.click('[data-ritual="Prioritisation forum"]');
  expect(/written reason/.test(await page.locator(".drawer").innerText()), "drawer");
});

await check("No horizontal page scroll at 390px on any route", async () => {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const r of ["", "intake", "gtm", "rca", "cadence"]) {
    await m.goto(`${BASE}/#/${r}`);
    await m.waitForSelector("main h1");
    const [sw, w] = await m.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw <= w, `${r || "overview"}: ${sw} > ${w}`);
  }
  await m.close();
});

await check("Works with storage blocked (private mode): renders and adds in memory", async () => {
  const c = await browser.newContext();
  await c.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/#/intake`);
  await p.click('[data-act="log"]');
  await p.fill('[name="title"]', "Storage-blocked test theme for intake");
  await p.click('button[type="submit"]');
  await p.waitForSelector('tr[data-id="FB-2001"]');
  expect(errs.length === 0, errs.join(" | "));
  await c.close();
});

await check("No console errors across the whole run", async () => {
  expect(errors.length === 0, errors.join(" | "));
});

await browser.close();
server.close();

const pad = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(pad)}${r.ok ? "" : `  → ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
