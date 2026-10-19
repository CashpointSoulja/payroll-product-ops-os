import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEIGHTS, BANDS, scoreItem, rankItems, normalise, normaliseWeights, bandFor,
  readiness, gateVerdict, daysBetween, median, signalCount,
} from "../src/scoring.js";
import { FEEDBACK } from "../src/data.js";

const base = {
  id: "T-1", accounts: 100, arrExposure: 1_000_000, compliance: 3, strategic: 3,
  effort: "S", confidence: "high", sources: { support: 3, ops: 2 },
};

test("same input gives the same score every time", () => {
  const runs = new Set(Array.from({ length: 50 }, () => JSON.stringify(scoreItem(base))));
  assert.equal(runs.size, 1);
});

test("factors are normalised into 0..1 and saturate", () => {
  const n = normalise({ ...base, accounts: 0, arrExposure: 0, compliance: 1, strategic: 1 });
  assert.deepEqual(n, { reach: 0, revenue: 0, compliance: 0, strategic: 0 });
  const big = normalise({ ...base, accounts: 1e6, arrExposure: 1e12, compliance: 5, strategic: 5 });
  assert.deepEqual(big, { reach: 1, revenue: 1, compliance: 1, strategic: 1 });
  assert.equal(normalise({ ...base, accounts: 1000 }).reach, 1);
});

test("score is bounded 0..100", () => {
  const max = scoreItem({ ...base, accounts: 1e6, arrExposure: 1e12, compliance: 5, strategic: 5 });
  assert.equal(max.score, 100);
  const min = scoreItem({ ...base, accounts: 0, arrExposure: 0, compliance: 1, strategic: 1 });
  assert.equal(min.score, 0);
});

test("contributions add up to the pre-discount value", () => {
  const s = scoreItem(base);
  const sum = Object.values(s.contributions).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - s.value) <= 0.2, `${sum} vs ${s.value}`);
});

test("confidence and effort discount the score", () => {
  const hi = scoreItem(base).score;
  assert.ok(scoreItem({ ...base, confidence: "medium" }).score < hi);
  assert.ok(scoreItem({ ...base, confidence: "low" }).score < scoreItem({ ...base, confidence: "medium" }).score);
  assert.ok(scoreItem({ ...base, effort: "XL" }).score < scoreItem({ ...base, effort: "L" }).score);
});

test("band thresholds are inclusive at the boundary", () => {
  for (const b of BANDS) assert.equal(bandFor(b.min, 1).id, b.id);
  assert.equal(bandFor(69.9, 1).id, "P1");
  assert.equal(bandFor(39.9, 1).id, "P3");
});

test("compliance 5 is always P0 and flagged as a floor when the score is lower", () => {
  const s = scoreItem({ ...base, accounts: 1, arrExposure: 1000, compliance: 5, strategic: 1, confidence: "low", effort: "XL" });
  assert.equal(s.band, "P0");
  assert.equal(s.floor, true);
  assert.ok(s.score < 70);
});

test("a logged override changes the band but never the score", () => {
  const plain = scoreItem(base);
  const over = scoreItem({ ...base, override: { band: "P0", reason: "deadline", by: "forum" } });
  assert.equal(over.score, plain.score);
  assert.equal(over.band, "P0");
  assert.equal(over.modelBand, plain.band);
  const bogus = scoreItem({ ...base, override: { band: "P9", reason: "x", by: "y" } });
  assert.equal(bogus.band, plain.band, "invalid override band is ignored");
});

test("weights are normalised; all-zero falls back to defaults", () => {
  const w = normaliseWeights({ reach: 2, revenue: 2, compliance: 0, strategic: 0 });
  assert.deepEqual(w, { reach: 0.5, revenue: 0.5, compliance: 0, strategic: 0 });
  assert.deepEqual(normaliseWeights({ reach: 0, revenue: 0, compliance: 0, strategic: 0 }), { ...DEFAULT_WEIGHTS });
});

test("ranking is stable and fully ordered", () => {
  const a = rankItems(FEEDBACK).map((r) => r.item.id);
  const b = rankItems([...FEEDBACK].reverse()).map((r) => r.item.id);
  assert.deepEqual(a, b, "input order must not affect ranking");
  assert.equal(new Set(a).size, FEEDBACK.length);
});

test("ties break on ARR exposure, then id", () => {
  const t1 = { ...base, id: "T-B" };
  const t2 = { ...base, id: "T-A" };
  const t3 = { ...base, id: "T-C", arrExposure: base.arrExposure + 1 };
  const ids = rankItems([t1, t2, t3]).map((r) => r.item.id);
  assert.equal(ids[0], "T-C");
  assert.deepEqual(ids.slice(1), ["T-A", "T-B"]);
});

test("moving the compliance weight to 100% puts compliance-5 items first", () => {
  const r = rankItems(FEEDBACK, { reach: 0, revenue: 0, compliance: 1, strategic: 0 });
  const topNonP0 = r.find((x) => x.s.band !== "P0");
  for (const x of r.slice(0, r.indexOf(topNonP0))) assert.equal(x.s.band, "P0");
});

test("sample data lands in every band", () => {
  const bands = new Set(rankItems(FEEDBACK).map((r) => r.s.band));
  assert.deepEqual([...bands].sort(), ["P0", "P1", "P2", "P3"]);
});

test("readiness weights statuses", () => {
  assert.equal(readiness({ a: { status: "done" }, b: { status: "done" } }), 100);
  assert.equal(readiness({ a: { status: "done" }, b: { status: "blocked" } }), 50);
  assert.equal(readiness({ a: { status: "on_track" } }), 60);
  assert.equal(readiness({}), 0);
});

test("gate verdict: any fail is no-go, any pending is pending", () => {
  const g = (r) => [{ results: { X: r[0] } }, { results: { X: r[1] } }];
  assert.equal(gateVerdict(g(["pass", "pass"]), "X"), "go");
  assert.equal(gateVerdict(g(["pass", "pending"]), "X"), "pending");
  assert.equal(gateVerdict(g(["pending", "fail"]), "X"), "no-go");
});

test("date maths uses UTC calendar days, independent of local time zone", () => {
  assert.equal(daysBetween("2026-10-19", "2026-11-02"), 14);
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2); // spans EU DST change
  assert.equal(daysBetween("2026-11-02", "2026-10-19"), -14);
});

test("median and signal count", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), 0);
  assert.equal(signalCount(base), 5);
});
