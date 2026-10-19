import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AS_OF, COUNTRIES, AREAS, SEGMENTS, STATUSES, SOURCE_LABELS, FEEDBACK, LAUNCH, RCAS, CADENCE, SCORECARD,
} from "../src/data.js";
import { EFFORT, CONFIDENCE, STATUS, BANDS } from "../src/scoring.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

test("AS_OF is a Monday", () => {
  assert.equal(new Date(`${AS_OF}T00:00:00Z`).getUTCDay(), 1);
});

test("feedback items are complete and valid", () => {
  const ids = new Set();
  for (const i of FEEDBACK) {
    assert.ok(!ids.has(i.id), `duplicate ${i.id}`);
    ids.add(i.id);
    assert.match(i.id, /^FB-\d{4}$/);
    assert.ok(i.title.length >= 20 && i.summary.length >= 40, i.id);
    assert.ok(AREAS.includes(i.area), `${i.id} area`);
    assert.ok(COUNTRIES[i.country], `${i.id} country`);
    assert.ok(SEGMENTS.includes(i.segment), `${i.id} segment`);
    assert.ok(STATUSES.includes(i.status), `${i.id} status`);
    assert.ok(EFFORT[i.effort] && CONFIDENCE[i.confidence], `${i.id} effort/confidence`);
    assert.ok(i.compliance >= 1 && i.compliance <= 5 && i.strategic >= 1 && i.strategic <= 5, i.id);
    assert.ok(Number.isInteger(i.accounts) && i.accounts > 0 && i.arrExposure > 0, `${i.id} quantified`);
    for (const k of Object.keys(i.sources)) assert.ok(SOURCE_LABELS[k], `${i.id} source ${k}`);
    assert.ok(validDate(i.firstSeen) && i.firstSeen <= AS_OF, `${i.id} firstSeen`);
    if (i.triagedOn) assert.ok(validDate(i.triagedOn) && i.triagedOn >= i.firstSeen && i.triagedOn <= AS_OF, `${i.id} triagedOn`);
    else assert.equal(i.status, "New", `${i.id}: only New items may be untriaged`);
    if (i.override) assert.ok(BANDS.some((b) => b.id === i.override.band) && i.override.reason.length > 20, `${i.id} override needs a reason`);
  }
});

test("cross-links resolve", () => {
  const rcaIds = new Set(RCAS.map((r) => r.id));
  const riskIds = new Set(LAUNCH.risks.map((r) => r.id));
  const fbIds = new Set(FEEDBACK.map((f) => f.id));
  for (const i of FEEDBACK) {
    if (i.links.rca) assert.ok(rcaIds.has(i.links.rca), `${i.id} → ${i.links.rca}`);
    if (i.links.launch) assert.ok(LAUNCH.cells[i.links.launch], `${i.id} → ${i.links.launch}`);
  }
  for (const r of RCAS) {
    if (r.links.feedback) assert.ok(fbIds.has(r.links.feedback), `${r.id} → ${r.links.feedback}`);
    if (r.links.risk) assert.ok(riskIds.has(r.links.risk), `${r.id} → ${r.links.risk}`);
  }
  for (const [c, cells] of Object.entries(LAUNCH.cells))
    for (const [w, cell] of Object.entries(cells)) if (cell.risk) assert.ok(riskIds.has(cell.risk), `${c}/${w}`);
});

test("rollout matrix is complete: every country × workstream has status, due date and note", () => {
  const countries = LAUNCH.waves.flatMap((w) => w.countries);
  assert.deepEqual(Object.keys(LAUNCH.cells).sort(), [...countries].sort());
  for (const c of countries)
    for (const w of LAUNCH.workstreams) {
      const cell = LAUNCH.cells[c][w.id];
      assert.ok(cell, `${c}/${w.id} missing`);
      assert.ok(STATUS[cell.status], `${c}/${w.id} status`);
      assert.ok(validDate(cell.due) && cell.note.length > 5, `${c}/${w.id}`);
    }
});

test("waves are in date order and GA dates are Mondays after AS_OF", () => {
  let prev = AS_OF;
  for (const w of LAUNCH.waves) {
    assert.ok(w.ga > prev, w.id);
    assert.equal(new Date(`${w.ga}T00:00:00Z`).getUTCDay(), 1, `${w.id} GA is a Monday`);
    prev = w.ga;
  }
});

test("every gate has a result for every country", () => {
  for (const g of LAUNCH.gates)
    for (const c of Object.keys(LAUNCH.cells)) assert.ok(["pass", "fail", "pending"].includes(g.results[c]), `${g.id}/${c}`);
});

test("risks have owner, mitigation and trigger", () => {
  for (const r of LAUNCH.risks) {
    assert.ok(r.likelihood >= 1 && r.likelihood <= 5 && r.impact >= 1 && r.impact <= 5, r.id);
    assert.ok(r.owner && r.mitigation.length > 20 && r.trigger.length > 5, r.id);
  }
});

test("each RCA has the full chain: issue → hypotheses → root cause → fix → verification, plus 5 whys", () => {
  for (const r of RCAS) {
    assert.ok(r.issue && r.rootCause && r.fix && r.verification && r.impact, r.id);
    assert.ok(r.hypotheses.length >= 2, `${r.id} needs competing hypotheses`);
    for (const h of r.hypotheses) assert.ok(["supported", "rejected", "testing"].includes(h.verdict) && h.evidence.length > 15, r.id);
    assert.ok(r.hypotheses.some((h) => h.verdict === "rejected"), `${r.id} should show a disproven hypothesis`);
    if (r.status === "Verified") assert.ok(r.hypotheses.every((h) => h.verdict !== "testing"), `${r.id} verified with open hypothesis`);
    assert.equal(r.whys.length, 5, `${r.id} five whys`);
    for (const [d] of r.timeline) assert.ok(validDate(d), `${r.id} timeline`);
  }
});

test("cadence rituals each have inputs, outputs and a shipped artefact", () => {
  for (const c of CADENCE) assert.ok(c.inputs && c.outputs && c.ships && c.rule && c.who.length >= 3, c.name);
  for (const m of SCORECARD) assert.ok(["up", "down"].includes(m.better) && typeof m.now === "number", m.metric);
});
