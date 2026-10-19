# Payroll Product Ops OS

**An unofficial concept** of the operating system a Staff Product Operations Manager would run for a global payroll product: collect and quantify product challenges, prioritise them with a transparent model, drive country-by-country GTM rollouts, root-cause what breaks, and review it all on a fixed weekly cadence.

> **Sample data.** Every customer, person, figure and incident is synthetic, created for this concept. Statutory rules are summarised for realism, not advice. Not affiliated with or endorsed by Deel. The Deel name and logo appear only to frame the concept.

| | |
|---|---|
| **Live app** | https://payroll-product-ops-os.ayomideahmedcp.workers.dev |
| **90-second walkthrough** | https://drive.google.com/file/d/1Of0wQrw75Aj_HQfbbpJzI2LLa32EESDh/view |
| **Built for** | Staff Product Operations Manager, FinTech (Deel) |

## What's inside

| Module | What it shows | The operating principle |
|---|---|---|
| **01 · Intake** | 20 synthetic feedback themes (UK SSP day-one rule change, Irish sick leave eligibility, German continued pay vs. Krankengeld, payroll funding reconciliation, SEPA returns, KYC holds, tax year-end…) each quantified by signals, accounts, ARR exposure, segment and compliance risk | Themes, not tickets. A published, adjustable scoring model; compliance 5 is always P0; overrides change the band, never the score, and need a written reason |
| **02 · GTM rollout** | A statutory sick pay engine launching in 6 countries over 3 waves: country × workstream readiness matrix (product, legal, ops partners, FinOps, support, sales, data), go / no-go gates, risk register | Money movement is a launch workstream. Any failed gate is a no-go, whatever the readiness % |
| **03 · Root cause** | 5 RCAs: issue → hypotheses (with rejected ones kept) → evidence → root cause → fix → verification, plus 5 whys and a timeline | "Fixed" means the metric that broke has recovered |
| **04 · Cadence** | Mon triage · Tue risk radar · Wed prioritisation forum · Thu launch stand-up + RCA review · Fri digest, with a pre-read and scorecard generated from the other three modules | Meetings make decisions; status comes from the data |

### The scoring model

```
score = 100 × Σ(weight × factor) × confidence × effort discount

reach       log-scaled accounts affected (saturates at 1,000)        30%
revenue     log-scaled ARR exposure (saturates at $10M)               30%
compliance  1 cosmetic … 5 statutory breach / money not moving        25%
strategic   fit with current launches and segment bets                15%

P0 ≥ 70 · P1 ≥ 55 · P2 ≥ 40 · P3 < 40 · compliance 5 → always P0
```

Every theme's drawer shows each factor's contribution and the arithmetic. Full rationale in the [PRD](docs/PRD.md#41-feedback-intake-board).

## Docs

| Doc | Purpose |
|---|---|
| [PRD](docs/PRD.md) | Problem, goals, users, requirements, scoring spec, data model, risks |
| [ELI5](docs/ELI5.md) | The whole thing explained simply |
| [Five whys](docs/FIVE_WHYS.md) | Why this system needs to exist, plus one incident traced to its root |
| [Jobs to be done](docs/JTBD.md) | Job stories for product ops, PMs, compliance, FinOps, FinCrime, support, CSMs |
| [Metrics](docs/METRICS.md) | North star, input and outcome metrics, guardrails, SQL definitions |
| [Test plan and results](docs/TEST_PLAN.md) | Strategy, 31 unit/build tests, 17 end-to-end checks, live and video QA, defects found and fixed |
| [Viability memo](docs/VIABILITY_MEMO.md) | An honest read of this seat's seniority bar against my background, and the route I'd take |
| [v2 roadmap](docs/ROADMAP_V2.md) | Now / next / later: real ingestion, warehouse metrics, deadline factor, decision log |
| [Design sheet](docs/DESIGN_SHEET.md) | Brand tokens read from deel.com's public stylesheets and how they're applied |
| [Walkthrough script](docs/WALKTHROUGH_SCRIPT.md) | Scene-by-scene script for the video |

## Run it

No dependencies to install.

```bash
npm run build      # bundles src/ into dist/worker.js
npm run serve      # http://localhost:8787
npm test           # 31 unit + build tests (node:test)
npm run test:e2e   # 17 browser checks (needs Playwright + Chromium available)
```

Deploy to Cloudflare Workers (free tier):

```bash
npx wrangler deploy   # uses wrangler.toml → dist/worker.js
```

## How it's built

- Plain HTML, CSS and ES modules in [`src/`](src). No framework, no runtime dependencies.
- **Deterministic:** a fixed "as of" date (Mon 19 Oct 2026), no randomness, no network calls. A test enforces this.
- [`scripts/build.mjs`](scripts/build.mjs) inlines the files into a single Cloudflare Worker with a strict CSP.
- Logged feedback and weight changes persist only in your browser (`localStorage`, with an in-memory fallback). "Reset sample data" clears them.

```
src/
  index.html   shell, logo, notice, footer
  styles.css   design tokens mirrored from deel.com
  scoring.js   pure scoring, ranking, readiness and date functions
  data.js      synthetic themes, launch, RCAs, cadence
  app.js       hash router and the four modules
tests/         scoring, data integrity, worker build
scripts/       build, local server, end-to-end checks
docs/          PRD, ELI5, five whys, JTBD, metrics, test plan, memo, roadmap, design sheet
```

---

Ayo Ahmed, independent concept.
