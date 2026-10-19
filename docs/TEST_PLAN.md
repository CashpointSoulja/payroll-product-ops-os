# Test plan and results

**Run date:** 19 October 2026 · **Build:** `dist/worker.js` from `src/` at the commit that adds this file
**Result:** 31/31 unit and build tests pass · 17/17 end-to-end browser checks pass · live deployment verified · walkthrough video reviewed frame-by-frame and transcribed.

## 1. Strategy

| Layer | What it protects | How | Command |
|---|---|---|---|
| Unit: scoring model | The prioritisation logic is correct, bounded, deterministic and explainable | `node:test`, no dependencies | `npm test` |
| Unit: data integrity | Every theme is quantified; every cross-link resolves; every RCA has a full chain | `node:test` | `npm test` |
| Build / worker | The Worker serves every route with correct types and security headers; no tool attribution; no clock or randomness in the front end | `node:test` against the built worker's `fetch` handler | `npm test` |
| End to end | Real user flows in Chromium, including mobile width and blocked storage | Playwright script | `npm run build && npm run test:e2e` |
| Live smoke | The deployed URL serves the same build | HTTP checks against workers.dev | manual (below) |
| Visual / manual | Brand fidelity, layout at 1440 / 1536 / 390 px, keyboard use | Screenshots + review | manual (below) |
| Video QA | The walkthrough shows what it says, in sync, with no defects | Frame contact sheets + speech-to-text of the final file | manual (below) |

## 2. Unit and build tests: 31/31 pass

`npm test` → `# tests 31 · # pass 31 · # fail 0` (≈ 0.4 s)

**Scoring model (17)**

| # | Test | Result |
|---|---|---|
| 1 | Same input gives the same score every time (50 runs) | ✅ |
| 2 | Factors normalise to 0..1 and saturate (1,000 accounts; $10M) | ✅ |
| 3 | Score bounded 0..100 | ✅ |
| 4 | Factor contributions add up to the pre-discount value | ✅ |
| 5 | Confidence and effort discount the score monotonically | ✅ |
| 6 | Band thresholds inclusive at the boundary (70 / 55 / 40) | ✅ |
| 7 | Compliance 5 is always P0 and flagged as a floor when the score is lower | ✅ |
| 8 | A logged override changes the band, never the score; invalid bands are ignored | ✅ |
| 9 | Weights are re-normalised; all-zero falls back to defaults | ✅ |
| 10 | Ranking is independent of input order | ✅ |
| 11 | Ties break on ARR exposure, then id | ✅ |
| 12 | 100% compliance weight puts compliance-5 items first | ✅ |
| 13 | Sample data lands in every band (P0–P3) | ✅ |
| 14 | Readiness weighting (done 1, on track 0.6, at risk 0.3, else 0) | ✅ |
| 15 | Gate verdict: any fail is no-go; any pending is pending | ✅ |
| 16 | Date maths uses UTC calendar days, including across a DST change | ✅ |
| 17 | Median and signal-count helpers | ✅ |

**Data integrity (9)**

| # | Test | Result |
|---|---|---|
| 18 | `AS_OF` is a Monday | ✅ |
| 19 | Every theme is complete: valid enums, quantified, dates in order, only "New" may be untriaged, overrides carry a reason | ✅ |
| 20 | Cross-links resolve (theme ↔ RCA ↔ risk ↔ launch country) | ✅ |
| 21 | Rollout matrix complete: 6 countries × 7 workstreams, each with status, due date, note | ✅ |
| 22 | Waves in date order; GA dates are Mondays after `AS_OF` | ✅ |
| 23 | Every gate has a result for every country | ✅ |
| 24 | Risks have owner, mitigation and trigger | ✅ |
| 25 | Every RCA has the full chain, ≥ 2 hypotheses, ≥ 1 rejected, 5 whys; verified RCAs have no open hypothesis | ✅ |
| 26 | Every ritual has inputs, outputs, a shipped artefact and a rule | ✅ |

**Build / worker (5)**

| # | Test | Result |
|---|---|---|
| 27 | All 6 paths return 200 with the right content type, CSP and `nosniff` | ✅ |
| 28 | Unknown path 404, POST 405, HEAD returns no body | ✅ |
| 29 | Logo label, sample-data notice and footer credit each appear exactly once | ✅ |
| 30 | No tool-attribution phrases in source, build, README or docs (pattern list in `tests/build.test.js`) | ✅ |
| 31 | Front end is deterministic: no `Date.now()`, `new Date()`, `Math.random`, `fetch`, XHR or WebSocket | ✅ |

## 3. End-to-end browser checks: 17/17 pass

`npm run build && npm run test:e2e` (Chromium, 1440×900 unless stated)

| # | Flow | Result |
|---|---|---|
| E1 | All five routes render with a heading and no console errors | ✅ |
| E2 | Active tab follows the route | ✅ |
| E3 | Overview KPIs computed from data (3 open P0s, T-14) | ✅ |
| E4 | Intake: 16 open themes by default, 20 with closed included | ✅ |
| E5 | Filters narrow the board (Ireland → 1; search "krankengeld" → 1) | ✅ |
| E6 | Moving weights re-ranks live and shows ▲/▼ movement; "Default weights" restores the exact order | ✅ |
| E7 | Row opens a drawer with the score breakdown (61.4, compliance floor); Escape closes it | ✅ |
| E8 | Log feedback validates the title | ✅ |
| E9 | Log feedback previews score and band live; new theme FB-2001 added and highlighted | ✅ |
| E10 | Logged theme persists across reload; "Reset sample data" removes it | ✅ |
| E11 | Deep link `#/intake/FB-1042` opens that theme | ✅ |
| E12 | GTM: 42 cells; risk filter shows 8; Ireland × Product drawer shows risk R-01 | ✅ |
| E13 | RCA list switches detail and updates the URL; `#/rca/RCA-031` deep link; 5 whys | ✅ |
| E14 | Cadence: 6 rituals; pre-read built from data; ritual drawer | ✅ |
| E15 | No horizontal page scroll at 390 px on any route | ✅ |
| E16 | Works with `localStorage` blocked (private mode): renders and adds in memory | ✅ |
| E17 | No console errors across the whole run | ✅ |

## 4. Live deployment smoke test: pass

Target: https://payroll-product-ops-os.ayomideahmedcp.workers.dev (Cloudflare Workers, free tier, workers.dev route enabled, no auth).

| Check | Result |
|---|---|
| `GET /` → 200 `text/html`, contains "unofficial concept" and "Ayo Ahmed, independent concept" | ✅ |
| `GET /app.js`, `/data.js`, `/scoring.js` → 200 `text/javascript` | ✅ |
| `GET /styles.css` → 200 `text/css` | ✅ |
| `GET /nope` → 404 | ✅ |
| Deployed bundle byte-identical to `dist/worker.js` in the repo | ✅ (rebuilt after deploy: no diff) |

## 5. Manual visual and accessibility review

| Check | Result |
|---|---|
| Brand tokens match [DESIGN_SHEET.md](DESIGN_SHEET.md) (ink, latte, purple gradient hero, pill buttons, Inter) | ✅ |
| Deel logo top-left, labelled "unofficial concept" | ✅ |
| Sample-data notice shown once, at the top | ✅ |
| Layout at 1440, 1536 (125% scale) and 390 px | ✅ after fixes D2–D3 |
| Keyboard: rows and matrix cells focusable, Enter opens, Escape closes, focus returns | ✅ |
| Status never conveyed by colour alone (chips carry text) | ✅ |
| `prefers-reduced-motion` respected | ✅ |

## 6. Walkthrough video QA

**Method:** the final MP4 was reviewed as contact sheets (one frame every 2 s, 45 frames) plus targeted full-resolution frames, and the audio track of the *uploaded file* was run through speech-to-text with timestamps and compared with the scene timeline.

| Check | Result |
|---|---|
| Duration | 89.4 s ✅ |
| Resolution / codec | 1920×1080, H.264 + AAC, 5.8 MB ✅ |
| Cursor visible and moving in every scene; clicks show a ripple | ✅ |
| Narration matches the action on screen (e.g. "push the compliance weight up" while the slider moves; "Ireland is failing its parallel-run gate" while the Ireland drawer is open) | ✅ |
| Narration segments start on their scene cues | ✅ Scenes 2–6 within 0.4 s (transcript 15.8, 38.4, 56.5, 69.0, 82.0 s vs. cues 16.2, 38.4, 56.5, 69.0, 82.0 s). Scene 1 starts after a 1 s lead-in; speech-to-text reports the first segment from 0. |
| Name read correctly in the closing line | ✅ after fix D9 |
| No browser UI, localhost URL or tool branding in frame or file metadata | ✅ after fixes D7 and D10 |
| Drive file: anyone with the link can view; checksum matches the local file | ✅ |

## 7. Defects found and fixed

| # | Found by | Defect | Fix |
|---|---|---|---|
| D1 | E2E console check | CSP blocked inline `style` attributes (bars, chips) | Allowed inline styles; scripts remain `'self'` only |
| D2 | Screenshot review | Intake table overflowed at 1440 px; score and status clipped | Folded segment into the theme line; tightened padding |
| D3 | Screenshot review | Country names wrapped inside wave cards | Wider waves card; no-wrap with ellipsis |
| D4 | Screenshot review | Unicode subscript "ᵢ" rendered as a comma in the formula | Plain-text formula |
| D5 | Screenshot review | Empty space under the waves card | Added "Due in the next 14 days" list (first 5 + count) |
| D6 | Code review | Event listeners stacked on `#main` on every navigation | Fresh container per render |
| D7 | Video frame review | Kiosk mode didn't apply: browser UI and `localhost` URL visible, page clipped | Persistent-context launch at DIP window size |
| D8 | Video frame review | End caption overflowed its box and covered the footer credit | Wider box, moved above the footer |
| D9 | Speech-to-text of the video | Name read as "I-O Ahmed" | Re-voiced the closing line phonetically; transcript now reads "Ayo Ahmed" |
| D10 | File inspection | Encoder tags in the MP4 metadata | Stripped (bit-exact remux, SEI removed) |
| T1 | E2E | Test expected 9 at-risk/blocked cells; data has 8 | Test corrected (the overview card also says 8) |
| T2 | E2E | Test matched drawer text case-sensitively; heading is CSS-uppercased | Case-insensitive match |

## 8. Known limitations (not defects)

- Logged feedback is stored only in the viewer's browser. There is no shared backend by design (deterministic, static concept).
- The heading typeface substitutes Inter for Deel's licensed face.
- Statutory rules are summarised for realism and are not payroll or legal advice.
