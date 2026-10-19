# PRD: Payroll Product Ops OS

**Status:** v1 shipped as a concept · **Owner:** Ayo Ahmed · **Live:** https://payroll-product-ops-os.ayomideahmedcp.workers.dev
**Sample data only.** Every customer, person, figure and incident is synthetic.

---

## 1. Problem

A global payroll product hears about its problems through six or more channels: support tickets, CSM notes, sales loss reasons, payroll ops escalations, in-app feedback, and the compliance calendar. Each channel has its own tool, its own vocabulary and its own idea of "urgent".

The result is predictable:

- **The loudest channel wins.** 400 tickets about a confusing pay date outrank 12 tickets about a statutory filing that is quietly going late.
- **Nobody can say what a problem is worth.** Items arrive without accounts affected, ARR exposure or compliance risk, so prioritisation turns into opinion.
- **Launches slip country by country.** A payroll feature isn't "launched" until legal, ops partners, FinOps, support and sales are ready *in each country*, and that readiness lives in a dozen spreadsheets.
- **Fixes don't get verified.** An incident is closed when the code ships, not when the metric that broke recovers, so the same class of bug comes back at the next statutory change.
- **Meetings collect status instead of making decisions.**

Payroll makes all of this worse because mistakes are regulated, time-boxed (tax years, filing windows) and land in someone's bank account.

## 2. Goal

Give a Staff Product Operations lead **one operating loop** that turns scattered signals into ranked, quantified, owned decisions, ships them country by country, and proves fixes worked, all reviewed on a fixed weekly rhythm.

### Success criteria for the concept

| Criterion | Measure |
|---|---|
| A reviewer understands the loop in under 2 minutes | Walkthrough video ≤ 90 s covers all four modules |
| Prioritisation is explainable | Every score decomposes into visible factor contributions; overrides carry a written reason |
| Ranking is reproducible | Same inputs give the same ranking; unit-tested |
| Rollout readiness is legible per country | Every country × workstream cell has owner, status, due date and note |
| RCAs show reasoning, not just conclusions | Every RCA lists competing hypotheses, including at least one rejected with evidence |
| Weekly meetings are pre-read driven | Cadence page builds its agenda from the other three modules |

### Non-goals (v1)

- Live integrations with ticketing, CRM or engineering tools (see [ROADMAP_V2.md](ROADMAP_V2.md)).
- Multi-user editing, permissions or audit history.
- Payroll calculation itself. Statutory rules are summarised to make the scenarios realistic, not to give advice.

## 3. Users

| User | What they need from this |
|---|---|
| **Staff Product Ops (primary)** | One place to run triage, prioritisation, launches, RCAs and the weekly digest |
| Payroll PMs | A ranked, evidenced backlog and a clear "why" for each decision |
| Head of Product, Payroll | Decision forum inputs; confidence that compliance risk can't be out-voted |
| Payroll Ops / in-country partners | A route for escalations that turns into tracked work |
| FinOps / FinCrime / TechOps | Money-movement risks (funding, reclaim, payouts, KYC holds) treated as product issues, not side-channel favours |
| Support & CSM leads | Proof their signals were counted, and launch enablement on time |

Full job stories: [JTBD.md](JTBD.md).

## 4. Scope and requirements

### 4.1 Feedback intake board

| # | Requirement | v1 |
|---|---|---|
| I-1 | Items are **themes** (deduplicated), each with raw signal counts by source | ✅ |
| I-2 | Every theme is quantified: accounts affected, ARR exposure (ARR of affected accounts + blocked pipeline), segment, country, area | ✅ |
| I-3 | Transparent scoring model with adjustable weights; ranking updates live | ✅ |
| I-4 | Compliance floor: compliance risk 5 is always P0, whatever the score | ✅ |
| I-5 | Forum overrides change the band, never the score, and require a written reason | ✅ |
| I-6 | Per-item breakdown showing each factor's contribution and the arithmetic | ✅ |
| I-7 | Log new feedback through a form with live score preview | ✅ (stored in the viewer's browser) |
| I-8 | Filters: search, area, country, segment, priority; open vs. closed | ✅ |
| I-9 | Links from a theme to its RCA and launch | ✅ |

**Scoring model**

```
factor        normalisation                                       default weight
reach         log10(1 + accounts) / log10(1 + 1,000)  (cap 1)     30%
revenue       log10(1 + ARR/$1k) / log10(1 + 10,000)  (cap 1)     30%
compliance    (risk − 1) / 4      risk ∈ 1..5                      25%
strategic     (fit − 1) / 4       fit ∈ 1..5                       15%

value  = Σ weight × factor                    (weights re-normalised to sum to 1)
score  = 100 × value × confidence × effort    confidence: high 1.0 · medium 0.8 · low 0.5
                                              effort:     S 1.0 · M 0.85 · L 0.7 · XL 0.55
band   = P0 ≥ 70 · P1 ≥ 55 · P2 ≥ 40 · P3 < 40
floor  = compliance 5 → P0
```

Why these choices:

- **Log scaling** stops a single huge-volume theme from swamping everything; going from 10 to 100 accounts matters more than going from 900 to 990.
- **Effort is a discount, not a divisor.** Classic RICE divides by effort, which buries large statutory work. Payroll can't defer a tax-year change because it's big.
- **The compliance floor is a hard rule, not a weight.** No weighting should be able to rank a statutory breach below a UX improvement.
- **Overrides are logged, not hidden.** The sample data includes one (FB-1075, P2 → P1, hard statutory deadline) and flags it as a candidate for a model change, which is how the model gets better.

### 4.2 GTM rollout tracker

| # | Requirement | v1 |
|---|---|---|
| G-1 | Launch header: goal, success metrics, sponsor, DRI | ✅ |
| G-2 | Waves with GA dates and T-minus counters from a fixed "as of" date | ✅ |
| G-3 | Readiness matrix: country × workstream, each cell with owner, status, due date, note | ✅ |
| G-4 | Workstreams include money movement (FinOps & funding) alongside product, legal, ops, support, sales and data | ✅ |
| G-5 | Readiness % per country from a published weighting | ✅ |
| G-6 | Go / no-go gates per country with evidence | ✅ |
| G-7 | Risk register with likelihood × impact, owner, mitigation and trigger | ✅ |
| G-8 | Filter to at-risk / blocked only | ✅ |

### 4.3 Root cause analysis log

| # | Requirement | v1 |
|---|---|---|
| R-1 | Chain: issue → hypotheses (with verdicts and evidence) → root cause → fix → verification | ✅ |
| R-2 | At least one rejected hypothesis shown per RCA | ✅ (enforced by test) |
| R-3 | Five whys and a dated timeline | ✅ |
| R-4 | Status distinguishes "fix shipped" from "verified" | ✅ |
| R-5 | Links back to intake theme and launch risk | ✅ |

### 4.4 Weekly cadence

| # | Requirement | v1 |
|---|---|---|
| C-1 | Five rituals with time, attendees, inputs, outputs, what ships, and a house rule | ✅ |
| C-2 | Pre-read generated from the board, tracker and RCA log | ✅ |
| C-3 | Weekly scorecard with targets and week-on-week trend | ✅ |
| C-4 | Monthly / quarterly / per-statutory-change rhythm | ✅ |

## 5. Data model (v1)

```
FeedbackTheme { id, title, summary, area, country, segment,
                sources{support, csm, sales, ops, inApp, compliance},
                accounts, arrExposure, compliance(1-5), strategic(1-5),
                effort(S|M|L|XL), confidence(high|medium|low),
                status, owner, firstSeen, triagedOn, links{rca, launch},
                decision, override{band, reason, by}? }

Launch { name, goal, successMetrics[], sponsor, dri,
         waves[{id, ga, countries[]}], workstreams[{id, name, owner}],
         cells[country][workstream]{status, due, note, risk?},
         gates[{id, name, criterion, results[country], evidence[country]?}],
         risks[{id, title, country, likelihood, impact, owner, mitigation, trigger, status}] }

RCA { id, title, status, severity, opened, owner, links{feedback, risk},
      impact, issue, hypotheses[{text, verdict, evidence}],
      rootCause, fix, verification, whys[5], timeline[[date, event]] }
```

## 6. Technical approach

- Static, framework-free front end (HTML, CSS, ES modules). No build-time dependencies.
- **Deterministic:** no system clock (fixed `AS_OF` date), no randomness, no network calls. Covered by a test that greps the source.
- Served by a single Cloudflare Worker (`dist/worker.js`) that holds the files in memory. Free tier, no bindings.
- Strict CSP: scripts from self only.
- Visual language mirrors deel.com's public stylesheet: see [DESIGN_SHEET.md](DESIGN_SHEET.md).

## 7. Risks and open questions

| Risk / question | Note |
|---|---|
| Weights encode politics | Mitigated by publishing them, showing contributions and logging overrides. v2 adds backtesting. |
| ARR exposure double-counts accounts across themes | Acceptable for ranking (it's a per-theme lens); portfolio totals are labelled "exposed", not "at risk". |
| Readiness % can look healthier than reality | Gates are separate from readiness and any fail is a no-go, whatever the %. |
| Compliance scoring is subjective | v2: map to a rubric owned by Payroll Compliance (statutory breach, filing late, employee harm, cosmetic). |
