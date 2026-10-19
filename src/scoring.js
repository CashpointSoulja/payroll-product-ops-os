// Pure, deterministic functions shared by the UI and the test suite.
// No clock, no randomness, no network: same inputs always give the same outputs.

export const DEFAULT_WEIGHTS = Object.freeze({
  reach: 0.3,
  revenue: 0.3,
  compliance: 0.25,
  strategic: 0.15,
});

// Effort is a discount, not a divisor, so a large-but-critical item is never buried.
export const EFFORT = Object.freeze({
  S: { label: "S (≤1 wk)", discount: 1.0 },
  M: { label: "M (2–4 wks)", discount: 0.85 },
  L: { label: "L (5–8 wks)", discount: 0.7 },
  XL: { label: "XL (9+ wks)", discount: 0.55 },
});

export const CONFIDENCE = Object.freeze({
  high: { label: "High: reproduced + data pulled", factor: 1.0 },
  medium: { label: "Medium: reproduced, partial data", factor: 0.8 },
  low: { label: "Low: anecdotal", factor: 0.5 },
});

// Saturation points for log scaling. Beyond these, more volume adds no score.
export const REACH_SATURATION = 1000; // customer accounts affected
export const REVENUE_SATURATION_K = 10000; // $10M ARR exposure, in $k

export const BANDS = Object.freeze([
  { id: "P0", min: 70, label: "Fix now" },
  { id: "P1", min: 55, label: "Next sprint" },
  { id: "P2", min: 40, label: "This quarter" },
  { id: "P3", min: 0, label: "Monitor" },
]);

export const COMPLIANCE_FLOOR = 5; // statutory breach or money-movement failure

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const round1 = (n) => Math.round(n * 10) / 10;

export function signalCount(item) {
  return Object.values(item.sources || {}).reduce((a, b) => a + b, 0);
}

export function normalise(item) {
  const reach = clamp01(Math.log10(1 + item.accounts) / Math.log10(1 + REACH_SATURATION));
  const revenue = clamp01(
    Math.log10(1 + item.arrExposure / 1000) / Math.log10(1 + REVENUE_SATURATION_K)
  );
  const compliance = clamp01((item.compliance - 1) / 4);
  const strategic = clamp01((item.strategic - 1) / 4);
  return { reach, revenue, compliance, strategic };
}

export function normaliseWeights(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const out = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) out[k] = (weights[k] || 0) / total;
  return out;
}

export function scoreItem(item, weights = DEFAULT_WEIGHTS) {
  const w = normaliseWeights(weights);
  const n = normalise(item);
  const contributions = {};
  let value = 0;
  for (const k of Object.keys(w)) {
    contributions[k] = w[k] * n[k];
    value += contributions[k];
  }
  const confidence = CONFIDENCE[item.confidence].factor;
  const effort = EFFORT[item.effort].discount;
  const score = round1(100 * value * confidence * effort);
  const band = bandFor(score, item.compliance);
  const override = item.override && BANDS.some((b) => b.id === item.override.band) ? item.override : null;
  return {
    score,
    value: round1(100 * value),
    normalised: n,
    contributions: Object.fromEntries(
      Object.entries(contributions).map(([k, v]) => [k, round1(100 * v)])
    ),
    confidence,
    effort,
    modelBand: band.id,
    band: override ? override.band : band.id,
    bandLabel: BANDS.find((b) => b.id === (override ? override.band : band.id)).label,
    floor: band.floor,
    override,
  };
}

export function bandFor(score, compliance) {
  if (compliance >= COMPLIANCE_FLOOR) return { ...BANDS[0], floor: score < BANDS[0].min };
  const band = BANDS.find((b) => score >= b.min);
  return { ...band, floor: false };
}

// Stable ranking: score desc, then ARR exposure desc, then id asc.
export function rankItems(items, weights = DEFAULT_WEIGHTS) {
  return items
    .map((item) => ({ item, s: scoreItem(item, weights) }))
    .sort(
      (a, b) =>
        bandOrder(a.s.band) - bandOrder(b.s.band) ||
        b.s.score - a.s.score ||
        b.item.arrExposure - a.item.arrExposure ||
        a.item.id.localeCompare(b.item.id)
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

const bandOrder = (id) => BANDS.findIndex((b) => b.id === id);

// ---- GTM readiness ----

export const STATUS = Object.freeze({
  done: { label: "Done", weight: 1 },
  on_track: { label: "On track", weight: 0.6 },
  at_risk: { label: "At risk", weight: 0.3 },
  blocked: { label: "Blocked", weight: 0 },
  not_started: { label: "Not started", weight: 0 },
});

export function readiness(cells) {
  const list = Object.values(cells);
  if (!list.length) return 0;
  const total = list.reduce((a, c) => a + STATUS[c.status].weight, 0);
  return Math.round((100 * total) / list.length);
}

export function gateVerdict(gates, country) {
  const results = gates.map((g) => g.results[country]);
  if (results.some((r) => r === "fail")) return "no-go";
  if (results.some((r) => r === "pending")) return "pending";
  return "go";
}

// ---- dates (fixed "as of" date, never the system clock) ----

export function daysBetween(fromIso, toIso) {
  const a = Date.UTC(...isoParts(fromIso));
  const b = Date.UTC(...isoParts(toIso));
  return Math.round((b - a) / 86400000);
}

function isoParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

export function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
