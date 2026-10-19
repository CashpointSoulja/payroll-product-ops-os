import {
  AS_OF, AS_OF_LABEL, COUNTRIES, AREAS, SEGMENTS, STATUSES, SOURCE_LABELS,
  FEEDBACK, LAUNCH, RCAS, CADENCE, RHYTHM, SCORECARD,
} from "./data.js";
import {
  DEFAULT_WEIGHTS, EFFORT, CONFIDENCE, BANDS, STATUS, COMPLIANCE_FLOOR,
  scoreItem, rankItems, signalCount, normaliseWeights, readiness, gateVerdict, daysBetween, median,
} from "./scoring.js";

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso, withYear = false) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? " " + y : ""}`;
};
const fmtMoney = (n) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${n}`;
};
const fmtInt = (n) => n.toLocaleString("en-GB");
const country = (code) => COUNTRIES[code] || { name: code, flag: "" };
const countryLabel = (code) => `${country(code).flag} ${country(code).name}`;
const slug = (s) => String(s).replace(/[^A-Za-z0-9_]+/g, "-").replace(/-$/, "");
const chip = (label, cls = "") => `<span class="chip chip--${esc(slug(cls || label))}">${esc(label)}</span>`;
const OPEN = new Set(["New", "Triaged", "In discovery", "Committed"]);
const FACTOR_LABEL = { reach: "Reach", revenue: "Revenue", compliance: "Compliance", strategic: "Strategic fit" };
const FACTOR_COLOR = { reach: "#5938b7", revenue: "#0067df", compliance: "#ed5e2a", strategic: "#15740f" };

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

// ---------- state ----------

const state = {
  weights: { ...DEFAULT_WEIGHTS, ...store.get("ppo.weights", {}) },
  custom: store.get("ppo.items", []),
  filters: { q: "", area: "", country: "", segment: "", band: "", includeClosed: false },
  gtmRiskOnly: false,
  rca: RCAS[0].id,
  justAdded: null,
};

const allItems = () => [...FEEDBACK, ...state.custom];
const ranked = () => rankItems(allItems(), state.weights);
const defaultRanks = () => new Map(rankItems(allItems(), DEFAULT_WEIGHTS).map((r) => [r.item.id, r.rank]));
const weightsAreDefault = () => Object.keys(DEFAULT_WEIGHTS).every((k) => Math.abs(state.weights[k] - DEFAULT_WEIGHTS[k]) < 1e-9);

// ---------- router ----------

const ROUTES = { "": overview, intake, gtm, rca, cadence };

function route() {
  const [name = "", ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  const view = ROUTES[name] ? name : "";
  closeOverlay();
  $$(".tabs a").forEach((a) =>
    a.dataset.route === (view || "overview") ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")
  );
  // Fresh container per render so listeners never stack across navigations.
  const container = document.createElement("div");
  container.innerHTML = ROUTES[view](rest);
  $("#main").replaceChildren(container);
  wire[view || "overview"]?.(container, rest);
  window.scrollTo(0, 0);
}

const wire = {};

// ---------- overview ----------

function launchNumbers() {
  const w1 = LAUNCH.waves[0];
  const rd = w1.countries.map((c) => readiness(LAUNCH.cells[c]));
  return {
    w1,
    w1Readiness: Math.round(rd.reduce((a, b) => a + b, 0) / rd.length),
    daysToW1: daysBetween(AS_OF, w1.ga),
    atRisk: Object.values(LAUNCH.cells).flatMap((c) => Object.values(c)).filter((c) => c.status === "at_risk" || c.status === "blocked").length,
  };
}

function overview() {
  const r = ranked();
  const open = r.filter((x) => OPEN.has(x.item.status));
  const exposure = open.reduce((a, x) => a + x.item.arrExposure, 0);
  const p0 = open.filter((x) => x.s.band === "P0").length;
  const signals = allItems().reduce((a, i) => a + signalCount(i), 0);
  const L = launchNumbers();
  const openRcas = RCAS.filter((x) => x.status !== "Verified");
  const top = open.slice(0, 5);
  const fails = LAUNCH.gates.flatMap((g) => L.w1.countries.filter((c) => g.results[c] === "fail").map((c) => ({ g, c })));
  const escalated = LAUNCH.risks.filter((x) => x.status === "Escalated");
  return `
  <section class="hero">
    <div class="eyebrow">Payroll · Product operations</div>
    <h1>One operating loop for payroll product challenges.</h1>
    <p>Collect every signal, put a number on it, rank it with a model anyone can read, ship it country by country, and root-cause what breaks. Then review all of it on a fixed weekly rhythm.</p>
    <div class="hero__actions">
      <a class="btn btn--light" href="#/intake">Open the intake board</a>
      <a class="btn btn--outline-light" href="#/cadence">See this week's cadence</a>
    </div>
    <div class="kpis">
      ${kpi(open.length, "Open themes")}
      ${kpi(fmtMoney(exposure), "ARR exposed on open themes")}
      ${kpi(p0, "Open P0s")}
      ${kpi(`${L.w1Readiness}%`, `Wave 1 readiness`)}
      ${kpi(`T-${L.daysToW1}`, `Days to Wave 1 GA`)}
      ${kpi(openRcas.length, "RCAs not yet verified")}
    </div>
  </section>

  <div class="loop">
    ${loopStep(1, "Collect", "Tickets, CSM notes, sales blockers, ops escalations, in-app feedback and the compliance radar, deduplicated into themes.", `${fmtInt(signals)} signals → ${allItems().length} themes`, "#/intake")}
    ${loopStep(2, "Quantify & prioritise", "Accounts, ARR exposure, compliance risk and strategic fit, scored by a weighted model with a compliance floor.", `${p0} P0 · ${open.filter((x) => x.s.band === "P1").length} P1 open`, "#/intake")}
    ${loopStep(3, "Ship by country", "A rollout matrix of countries × workstreams with owners, gates and a risk register.", `${L.atRisk} cells at risk or blocked`, "#/gtm")}
    ${loopStep(4, "Root-cause", "Issue → hypotheses → evidence → fix → verification. Nothing closes until the metric that broke recovers.", `${openRcas.length} open · ${RCAS.length - openRcas.length} verified`, "#/rca")}
    ${loopStep(5, "Review weekly", "Five rituals, each with a fixed input and a written output, ending in a Friday digest.", "Pre-read built from this data", "#/cadence")}
  </div>

  <div class="split">
    <div class="card">
      <div class="card__head"><h2>Top of the board</h2><a class="small" href="#/intake">All themes →</a></div>
      <ul class="list">
        ${top.map((x) => `
          <li>
            ${chip(x.s.band, x.s.band)}
            <div class="grow"><a href="#/intake/${esc(x.item.id)}">${esc(x.item.title)}</a>
              <div class="small muted">${esc(countryLabel(x.item.country))} · ${fmtMoney(x.item.arrExposure)} · ${x.item.accounts} accounts</div></div>
            <b class="num">${x.s.score}</b>
          </li>`).join("")}
      </ul>
    </div>
    <div class="card">
      <div class="card__head"><h2>Needs a decision this week</h2><span class="small muted">${esc(AS_OF_LABEL)}</span></div>
      <ul class="list">
        ${fails.map(({ g, c }) => `
          <li>${chip("Gate fail", "fail")}<div class="grow">${esc(country(c).flag)} ${esc(country(c).name)}: ${esc(g.name)}
            <div class="small muted">${esc(g.evidence?.[c] || g.criterion)}</div></div></li>`).join("")}
        ${escalated.map((x) => `
          <li>${chip("Escalated", "Escalated")}<div class="grow">${esc(x.title)}
            <div class="small muted">Trigger: ${esc(x.trigger)}</div></div></li>`).join("")}
        ${openRcas.map((x) => `
          <li>${chip(x.status, x.status)}<div class="grow"><a href="#/rca/${esc(x.id)}">${esc(x.id)}</a>: ${esc(x.title)}</div></li>`).join("")}
      </ul>
    </div>
  </div>`;
}

const kpi = (v, l) => `<div class="kpi"><div class="kpi__v">${esc(v)}</div><div class="kpi__l">${esc(l)}</div></div>`;
const loopStep = (n, t, p, stat, href) => `
  <a class="loop__step" href="${href}"><span class="loop__n">${n}</span><h3>${esc(t)}</h3><p>${esc(p)}</p><span class="loop__stat">${esc(stat)}</span></a>`;

// ---------- intake ----------

function intake() {
  return `
  <div class="page-head">
    <div>
      <div class="eyebrow">01 · Feedback intake</div>
      <h1>Collect, quantify, prioritise</h1>
      <p>Each row is a theme, not a ticket: raw signals are deduplicated, then sized by accounts affected, ARR exposure and compliance risk. Move the weights and the ranking updates live. Any forum override is logged with a reason.</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn--ghost" data-act="reset">Reset sample data</button>
      <button class="btn" data-act="log">+ Log feedback</button>
    </div>
  </div>
  <div class="kpis kpis--light" id="intake-kpis" style="margin:0 0 16px"></div>
  <div class="intake">
    <aside class="card model" aria-label="Scoring model">
      <div class="card__head" style="margin-bottom:4px"><h2>Scoring model</h2><button class="btn btn--ghost btn--sm" data-act="weights-reset">Default weights</button></div>
      <div class="formula">score = 100 × Σ(weight × factor)<br>&nbsp;&nbsp;× confidence × effort discount<br><br>P0: score ≥ 70, or compliance 5</div>
      ${Object.keys(DEFAULT_WEIGHTS).map((k) => `
        <div class="slider">
          <label for="w-${k}"><span>${FACTOR_LABEL[k]}</span><span data-wv="${k}"></span></label>
          <input type="range" id="w-${k}" min="0" max="100" step="5" value="${Math.round(state.weights[k] * 100)}" data-w="${k}">
          <small>${factorHelp(k)}</small>
        </div>`).join("")}
      <div class="bands">
        ${BANDS.map((b) => `<div>${chip(b.id, b.id)}<span>${esc(b.label)}: ${b.id === "P3" ? "below 40" : "score ≥ " + b.min}</span></div>`).join("")}
        <div>${chip("floor", "floor")}<span>Compliance 5 is always P0</span></div>
      </div>
      <details style="margin-top:14px" class="small">
        <summary style="cursor:pointer;font-weight:500">Effort and confidence</summary>
        <table style="margin-top:8px"><tbody>
          ${Object.entries(EFFORT).map(([, v]) => `<tr><td>${esc(v.label)}</td><td class="num">× ${v.discount}</td></tr>`).join("")}
          ${Object.entries(CONFIDENCE).map(([, v]) => `<tr><td>${esc(v.label)}</td><td class="num">× ${v.factor}</td></tr>`).join("")}
        </tbody></table>
      </details>
    </aside>
    <section class="card" style="padding:16px">
      <div class="filters" role="search">
        <input type="search" placeholder="Search themes" aria-label="Search themes" data-f="q" value="${esc(state.filters.q)}">
        ${select("area", "All areas", AREAS)}
        ${select("country", "All countries", Object.keys(COUNTRIES), (c) => countryLabel(c))}
        ${select("segment", "All segments", SEGMENTS)}
        ${select("band", "All priorities", BANDS.map((b) => b.id))}
        <label class="toggle"><input type="checkbox" data-f="includeClosed" ${state.filters.includeClosed ? "checked" : ""}> Include shipped & won't do</label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Priority</th><th>Theme</th><th class="num">Signals</th><th class="num">Accounts</th><th class="num">ARR</th><th>Compliance</th><th>Score</th><th>Status</th>
          </tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <p class="small muted" id="count" style="margin-top:10px"></p>
    </section>
  </div>`;
}

function factorHelp(k) {
  return {
    reach: "Customer accounts affected, log-scaled; saturates at 1,000.",
    revenue: "ARR of affected accounts + blocked pipeline, log-scaled; saturates at $10M.",
    compliance: "1 = cosmetic … 5 = statutory breach or money not moving.",
    strategic: "Fit with current launches and segment bets (1–5).",
  }[k];
}

function select(key, all, options, labelFn = (x) => x) {
  return `<select data-f="${key}" aria-label="${esc(all)}"><option value="">${esc(all)}</option>${options
    .map((o) => `<option value="${esc(o)}" ${state.filters[key] === o ? "selected" : ""}>${esc(labelFn(o))}</option>`)
    .join("")}</select>`;
}

function renderRows(root) {
  const f = state.filters;
  const base = defaultRanks();
  const showMove = !weightsAreDefault();
  const rows = ranked().filter(({ item, s }) =>
    (f.includeClosed || OPEN.has(item.status)) &&
    (!f.area || item.area === f.area) &&
    (!f.country || item.country === f.country) &&
    (!f.segment || item.segment === f.segment) &&
    (!f.band || s.band === f.band) &&
    (!f.q || `${item.id} ${item.title} ${item.summary} ${item.area}`.toLowerCase().includes(f.q.toLowerCase()))
  );
  $("#rows", root).innerHTML = rows.length
    ? rows.map(({ item, s, rank }) => {
        const delta = base.get(item.id) - rank;
        const move = showMove && delta ? `<span class="rank-move ${delta > 0 ? "up" : "down"}">${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}</span>` : "";
        return `<tr data-id="${esc(item.id)}" class="${state.justAdded === item.id ? "is-new" : ""}" tabindex="0">
          <td><span class="rank">${rank}</span>${move}</td>
          <td>${chip(s.band, s.band)}${s.override ? ` ${chip("override", "override")}` : s.floor ? ` ${chip("floor", "floor")}` : ""}</td>
          <td class="title"><strong>${esc(item.title)}</strong><span class="muted">${esc(item.id)} · ${esc(item.area)} · ${esc(countryLabel(item.country))} · ${esc(item.segment)}</span></td>
          <td class="num">${fmtInt(signalCount(item))}</td>
          <td class="num">${fmtInt(item.accounts)}</td>
          <td class="num">${fmtMoney(item.arrExposure)}</td>
          <td>${complianceDots(item.compliance)}</td>
          <td><div class="scorebar"><div class="scorebar__track"><div class="scorebar__fill" style="width:${s.score}%"></div></div><b>${s.score}</b></div></td>
          <td>${chip(item.status, item.status)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="9" class="empty">No themes match these filters.</td></tr>`;
  $("#count", root).textContent = `Showing ${rows.length} of ${allItems().length} themes · ranked by priority band, then score, then ARR exposure`;
  state.justAdded = null;

  const open = ranked().filter((x) => OPEN.has(x.item.status));
  const triage = allItems().filter((i) => i.triagedOn).map((i) => daysBetween(i.firstSeen, i.triagedOn));
  $("#intake-kpis", root).innerHTML = [
    kpi(open.length, "Open themes"),
    kpi(fmtMoney(open.reduce((a, x) => a + x.item.arrExposure, 0)), "ARR exposure (open)"),
    kpi(open.filter((x) => x.s.band === "P0").length, "Open P0"),
    kpi(open.filter((x) => x.item.status === "New").length, "Awaiting triage"),
    kpi(`${median(triage)} d`, "Median time to triage"),
    kpi(`${Math.round((100 * allItems().filter((i) => i.accounts > 0 && i.arrExposure > 0).length) / allItems().length)}%`, "Themes fully quantified"),
  ].join("");
}

function complianceDots(n) {
  return `<span title="Compliance risk ${n} of 5" aria-label="Compliance risk ${n} of 5" style="white-space:nowrap">${[1, 2, 3, 4, 5]
    .map((i) => `<span class="dot" style="color:${i <= n ? (n >= COMPLIANCE_FLOOR ? "#ed5e2a" : "#1b1b1b") : "#e6e6e6"};margin-right:2px"></span>`)
    .join("")}</span>`;
}

function syncWeightLabels(root) {
  const w = normaliseWeights(state.weights);
  for (const k of Object.keys(w)) {
    const el = $(`[data-wv="${k}"]`, root);
    if (el) el.textContent = `${Math.round(w[k] * 100)}%`;
  }
}

wire.intake = (root, rest) => {
  syncWeightLabels(root);
  renderRows(root);
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.w) {
      state.weights[t.dataset.w] = Number(t.value) / 100;
      store.set("ppo.weights", state.weights);
      syncWeightLabels(root);
      renderRows(root);
    } else if (t.dataset.f) {
      state.filters[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value;
      renderRows(root);
    }
  });
  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "log") return openLogForm();
    if (act === "weights-reset") {
      state.weights = { ...DEFAULT_WEIGHTS };
      store.del("ppo.weights");
      $$("[data-w]", root).forEach((el) => (el.value = Math.round(DEFAULT_WEIGHTS[el.dataset.w] * 100)));
      syncWeightLabels(root);
      return renderRows(root);
    }
    if (act === "reset") {
      state.custom = [];
      state.weights = { ...DEFAULT_WEIGHTS };
      store.del("ppo.items");
      store.del("ppo.weights");
      return route();
    }
    const row = e.target.closest("tr[data-id]");
    if (row) openItem(row.dataset.id);
  });
  root.addEventListener("keydown", (e) => {
    const row = e.target.closest?.("tr[data-id]");
    if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openItem(row.dataset.id); }
  });
  if (rest[0]) openItem(rest[0]);
};

function openItem(id) {
  const item = allItems().find((i) => i.id === id);
  if (!item) return;
  const s = scoreItem(item, state.weights);
  const r = ranked().find((x) => x.item.id === id);
  const w = normaliseWeights(state.weights);
  const rca = item.links?.rca && RCAS.find((x) => x.id === item.links.rca);
  const triage = item.triagedOn ? `${daysBetween(item.firstSeen, item.triagedOn)} d` : "not yet triaged";
  openDrawer(`
    <div class="drawer__head">
      <div style="flex:1">
        <div class="small muted" style="margin-bottom:6px">${esc(item.id)} · rank ${r.rank} of ${allItems().length}</div>
        <h2>${esc(item.title)}</h2>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${chip(`${s.band} · ${s.bandLabel}`, s.band)} ${chip(item.status, item.status)}
          ${s.override ? chip(`Model said ${s.modelBand}`, "override") : ""}${s.floor && !s.override ? chip("Compliance floor", "floor") : ""}</div>
      </div>
      <button class="close" data-close aria-label="Close">×</button>
    </div>
    <div class="drawer__body">
      <section><p>${esc(item.summary)}</p></section>
      <section>
        <h3>Quantified</h3>
        <dl class="kv">
          <dt>Accounts affected</dt><dd class="num">${fmtInt(item.accounts)}</dd>
          <dt>ARR exposure</dt><dd class="num">${fmtMoney(item.arrExposure)}</dd>
          <dt>Segment</dt><dd>${esc(item.segment)}</dd>
          <dt>Country</dt><dd>${esc(countryLabel(item.country))}</dd>
          <dt>Area</dt><dd>${esc(item.area)}</dd>
          <dt>Compliance risk</dt><dd>${item.compliance} / 5 ${complianceDots(item.compliance)}</dd>
          <dt>Effort</dt><dd>${esc(EFFORT[item.effort].label)}</dd>
          <dt>Confidence</dt><dd>${esc(CONFIDENCE[item.confidence].label)}</dd>
          <dt>First seen</dt><dd>${fmtDate(item.firstSeen, true)} · triage ${esc(triage)}</dd>
          <dt>Owner</dt><dd>${esc(item.owner)}</dd>
        </dl>
      </section>
      <section>
        <h3>Signals (${fmtInt(signalCount(item))})</h3>
        <div class="sources">${Object.entries(item.sources).map(([k, v]) => `<span class="chip">${esc(SOURCE_LABELS[k] || k)} · ${v}</span>`).join("")}</div>
      </section>
      <section>
        <h3>Why it scores ${s.score}</h3>
        <div class="contrib">
          ${Object.keys(w).map((k) => `
            <div class="contrib__row"><span>${FACTOR_LABEL[k]}</span>
              <div class="contrib__track"><div class="contrib__fill" style="width:${Math.round(s.normalised[k] * 100)}%;background:${FACTOR_COLOR[k]}"></div></div>
              <span class="num small">${s.contributions[k]} pts</span></div>`).join("")}
        </div>
        <div class="calc">
          ${Object.keys(w).map((k) => `${FACTOR_LABEL[k].padEnd(13, " ")} ${(w[k] * 100).toFixed(0).padStart(3, " ")}% × ${s.normalised[k].toFixed(2)} = ${s.contributions[k]}`).join("<br>")}<br>
          value ${s.value} × confidence ${s.confidence} × effort ${s.effort} = <b>${s.score}</b>
        </div>
        ${s.override ? `<p class="small" style="margin-top:10px"><b>Override to ${esc(s.override.band)}</b> (${esc(s.override.by)}): ${esc(s.override.reason)}</p>` : ""}
      </section>
      <section>
        <h3>Decision log</h3>
        <p>${esc(item.decision || "No decision yet.")}</p>
      </section>
      ${rca || item.links?.launch ? `<section><h3>Linked</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
        ${rca ? `<a class="btn btn--ghost btn--sm" href="#/rca/${esc(rca.id)}">${esc(rca.id)} · ${esc(rca.status)}</a>` : ""}
        ${item.links?.launch ? `<a class="btn btn--ghost btn--sm" href="#/gtm">SSPE rollout · ${esc(countryLabel(item.links.launch))}</a>` : ""}
      </div></section>` : ""}
    </div>`);
}

function openLogForm() {
  openModal(`
    <div class="drawer__head"><h2>Log feedback</h2><button class="close" data-close aria-label="Close">×</button></div>
    <form class="modal__body" id="log-form" novalidate>
      <div class="form-grid">
        <label class="field field--full">Theme<input name="title" required minlength="8" placeholder="e.g. Ireland: sick leave not paid for employees on probation"></label>
        <label class="field field--full">What's happening<textarea name="summary" rows="2" placeholder="One or two sentences. Who is affected and what goes wrong."></textarea></label>
        <label class="field">Source<select name="source">${Object.entries(SOURCE_LABELS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
        <label class="field">Signals (raw reports)<input name="signals" type="number" min="1" value="1" inputmode="numeric"></label>
        <label class="field">Country<select name="country">${Object.keys(COUNTRIES).map((c) => `<option value="${c}">${esc(countryLabel(c))}</option>`).join("")}</select></label>
        <label class="field">Area<select name="area">${AREAS.map((a) => `<option>${esc(a)}</option>`).join("")}</select></label>
        <label class="field">Segment<select name="segment">${SEGMENTS.map((a) => `<option>${esc(a)}</option>`).join("")}</select></label>
        <label class="field">Accounts affected<input name="accounts" type="number" min="0" value="10" inputmode="numeric"></label>
        <label class="field">ARR exposure (USD)<input name="arrExposure" type="number" min="0" step="1000" value="100000" inputmode="numeric"><small>ARR of affected accounts + blocked pipeline</small></label>
        <label class="field">Compliance risk<select name="compliance">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${n}${n === 5 ? " · statutory breach / money not moving" : n === 1 ? " · cosmetic" : ""}</option>`).join("")}</select></label>
        <label class="field">Strategic fit<select name="strategic">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="field">Effort<select name="effort">${Object.entries(EFFORT).map(([k, v]) => `<option value="${k}" ${k === "M" ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
        <label class="field">Confidence<select name="confidence">${Object.entries(CONFIDENCE).map(([k, v]) => `<option value="${k}" ${k === "medium" ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
      </div>
      <div class="preview" aria-live="polite"><span class="small muted">Live score</span><b id="pv-score">—</b><span id="pv-band"></span></div>
      <p class="error" id="form-error" hidden></p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn--ghost" data-close>Cancel</button>
        <button type="submit" class="btn">Add to board</button>
      </div>
    </form>`);
  const form = $("#log-form");
  const read = () => {
    const d = Object.fromEntries(new FormData(form));
    const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
    return {
      id: nextId(),
      title: d.title.trim(),
      summary: d.summary.trim() || "Logged via intake form.",
      area: d.area,
      country: d.country,
      segment: d.segment,
      sources: { [d.source]: Math.max(1, n(d.signals)) },
      accounts: n(d.accounts),
      arrExposure: n(d.arrExposure),
      compliance: Number(d.compliance),
      strategic: Number(d.strategic),
      effort: d.effort,
      confidence: d.confidence,
      status: "New",
      owner: "Unassigned",
      firstSeen: AS_OF,
      triagedOn: null,
      links: {},
      decision: "Logged this week; goes to Monday signal triage.",
    };
  };
  const preview = () => {
    const s = scoreItem(read(), state.weights);
    $("#pv-score").textContent = s.score;
    $("#pv-band").innerHTML = `${chip(`${s.band} · ${s.bandLabel}`, s.band)}${s.floor ? " " + chip("Compliance floor", "floor") : ""}`;
  };
  form.addEventListener("input", preview);
  preview();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = read();
    const err = $("#form-error");
    if (item.title.length < 8) {
      err.hidden = false;
      err.textContent = "Give the theme a title of at least 8 characters.";
      return $("[name=title]", form).focus();
    }
    state.custom = [...state.custom, item];
    store.set("ppo.items", state.custom);
    state.justAdded = item.id;
    state.filters = { ...state.filters, q: "", area: "", country: "", segment: "", band: "" };
    closeOverlay();
    location.hash === "#/intake" ? route() : (location.hash = "#/intake");
  });
  $("[name=title]", form).focus();
}

function nextId() {
  const max = allItems().reduce((m, i) => Math.max(m, Number(i.id.split("-")[1]) || 0), 2000);
  return `FB-${Math.max(max, 2000) + 1}`;
}

// ---------- GTM ----------

function gtm() {
  const L = LAUNCH;
  return `
  <div class="page-head">
    <div>
      <div class="eyebrow">02 · Go-to-market rollout</div>
      <h1>${esc(L.name)} <span class="muted" style="font-weight:400">· ${esc(L.code)}</span></h1>
      <p>${esc(L.goal)}</p>
    </div>
  </div>
  <div class="launch-head">
    <div class="card">
      <div class="card__head"><h2>Waves</h2><span class="small muted">As of ${esc(fmtDate(AS_OF, true))}</span></div>
      <div class="waves">
        ${L.waves.map((w) => `
          <div class="wave">
            <div class="wave__t">${esc(w.name)} · T-${daysBetween(AS_OF, w.ga)} days</div>
            <div class="wave__d">GA ${esc(fmtDate(w.ga, true))}</div>
            <div class="wave__c">${w.countries.map((c) => `<div><span>${esc(countryLabel(c))}</span><span class="num">${readiness(L.cells[c])}% ${chip(gateVerdict(L.gates, c), gateVerdict(L.gates, c))}</span></div>`).join("")}</div>
          </div>`).join("")}
      </div>
      <h3 style="margin:18px 0 6px">Due in the next 14 days</h3>
      <ul class="list small list--tight">${upcoming(14).slice(0, 5).map((x) => `
        <li><span class="num muted" style="width:52px;flex:none">${esc(fmtDate(x.cell.due))}</span>${chip(STATUS[x.cell.status].label, x.cell.status)}
          <div class="grow">${esc(countryLabel(x.c))} · ${esc(x.w.name)} <span class="muted">· ${esc(x.w.owner)}</span></div></li>`).join("")}</ul>
      ${upcoming(14).length > 5 ? `<p class="small muted" style="margin-top:6px">+ ${upcoming(14).length - 5} more due by ${esc(fmtDate(upcoming(14).at(-1).cell.due))}</p>` : ""}
    </div>
    <div class="card">
      <div class="card__head"><h2>Success metrics</h2></div>
      <ul class="list small">${L.successMetrics.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
      <dl class="kv small" style="margin-top:12px"><dt>Sponsor</dt><dd>${esc(L.sponsor)}</dd><dt>Launch DRI</dt><dd>${esc(L.dri)}</dd></dl>
    </div>
  </div>

  <section class="card" style="margin-bottom:16px">
    <div class="card__head">
      <h2>Readiness matrix</h2>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div class="legend">${Object.entries(STATUS).map(([k, v]) => chip(v.label, k)).join("")}</div>
        <label class="toggle"><input type="checkbox" data-risk-only ${state.gtmRiskOnly ? "checked" : ""}> At risk & blocked only</label>
      </div>
    </div>
    <div class="table-wrap"><table class="matrix" id="matrix"></table></div>
    <p class="small muted" style="margin-top:10px">Readiness = average of workstream weights (done 1, on track 0.6, at risk 0.3, blocked or not started 0). <span class="risk-flag">!</span> = linked to the risk register. Click a cell for detail.</p>
  </section>

  <div class="split" style="margin-top:0">
    <section class="card">
      <div class="card__head"><h2>Go / no-go gates</h2><span class="small muted">All must pass at T-7</span></div>
      <div class="table-wrap"><table class="gates">
        <thead><tr><th>Gate</th>${Object.keys(L.cells).map((c) => `<th title="${esc(country(c).name)}">${esc(country(c).flag)} ${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${L.gates.map((g) => `<tr><td><b style="font-weight:500">${esc(g.name)}</b><div class="small muted">${esc(g.criterion)}</div></td>
          ${Object.keys(L.cells).map((c) => `<td title="${esc(g.evidence?.[c] || "")}">${gateMark(g.results[c])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
    </section>
    <section class="card">
      <div class="card__head"><h2>Risk register</h2><span class="small muted">Sorted by likelihood × impact</span></div>
      <ul class="list">${[...L.risks].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact || a.id.localeCompare(b.id)).map((r) => `
        <li><span class="heat" style="${heatStyle(r.likelihood * r.impact)}" title="Likelihood ${r.likelihood} × impact ${r.impact}">${r.likelihood * r.impact}</span>
          <div class="grow"><b style="font-weight:500">${esc(r.id)} · ${esc(r.title)}</b> ${chip(r.status, r.status)}
            <div class="small muted">${esc(r.owner)} · Mitigation: ${esc(r.mitigation)}</div>
            <div class="small muted">Trigger: ${esc(r.trigger)}</div></div></li>`).join("")}</ul>
    </section>
  </div>`;
}

function upcoming(days) {
  return Object.entries(LAUNCH.cells)
    .flatMap(([c, cells]) => LAUNCH.workstreams.map((w) => ({ c, w, cell: cells[w.id] })))
    .filter((x) => x.cell.status !== "done" && daysBetween(AS_OF, x.cell.due) >= 0 && daysBetween(AS_OF, x.cell.due) <= days)
    .sort((x, y) => x.cell.due.localeCompare(y.cell.due) || x.c.localeCompare(y.c));
}

const gateMark = (r) => r === "pass" ? chip("✓", "pass") : r === "fail" ? chip("✕", "fail") : chip("…", "pending");
const heatStyle = (n) => n >= 15 ? "background:#ffbfb7;color:#8e2626" : n >= 9 ? "background:#ffe27c;color:#5c4600" : "background:#e6f7e0;color:#005b01";

function renderMatrix(root) {
  const L = LAUNCH;
  const visible = (cell) => !state.gtmRiskOnly || cell.status === "at_risk" || cell.status === "blocked";
  $("#matrix", root).innerHTML = `
    <thead><tr><th>Country</th>${L.workstreams.map((w) => `<th>${esc(w.name)}<div class="small muted" style="text-transform:none;letter-spacing:0;font-weight:400">${esc(w.owner)}</div></th>`).join("")}<th>Readiness</th></tr></thead>
    <tbody>${L.waves.map((wave) => wave.countries.map((c) => {
      const cells = L.cells[c];
      const rd = readiness(cells);
      return `<tr><td class="country">${esc(countryLabel(c))}<div class="small muted">${esc(wave.name)} · ${esc(fmtDate(wave.ga))}</div></td>
        ${L.workstreams.map((w) => {
          const cell = cells[w.id];
          return `<td class="cell" data-c="${c}" data-w="${w.id}" tabindex="0">${visible(cell) ? `${chip(STATUS[cell.status].label, cell.status)}${cell.risk ? '<span class="risk-flag" aria-label="has risk">!</span>' : ""}` : ""}</td>`;
        }).join("")}
        <td><div class="ready"><div class="ready__track"><div class="ready__fill" style="width:${rd}%"></div></div><b class="num">${rd}%</b></div></td></tr>`;
    }).join("")).join("")}</tbody>`;
}

wire.gtm = (root) => {
  renderMatrix(root);
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-risk-only]")) { state.gtmRiskOnly = e.target.checked; renderMatrix(root); }
  });
  const open = (td) => td && openCell(td.dataset.c, td.dataset.w);
  root.addEventListener("click", (e) => open(e.target.closest("td.cell")));
  root.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e.target.closest?.("td.cell")); });
};

function openCell(c, wId) {
  const cell = LAUNCH.cells[c][wId];
  const ws = LAUNCH.workstreams.find((w) => w.id === wId);
  const wave = LAUNCH.waves.find((w) => w.countries.includes(c));
  const risk = cell.risk && LAUNCH.risks.find((r) => r.id === cell.risk);
  const related = allItems().filter((i) => i.links?.launch === c);
  openDrawer(`
    <div class="drawer__head"><div style="flex:1"><div class="small muted" style="margin-bottom:6px">${esc(wave.name)} · GA ${esc(fmtDate(wave.ga, true))}</div>
      <h2>${esc(countryLabel(c))} · ${esc(ws.name)}</h2><div style="margin-top:10px">${chip(STATUS[cell.status].label, cell.status)}</div></div>
      <button class="close" data-close aria-label="Close">×</button></div>
    <div class="drawer__body">
      <section><dl class="kv"><dt>Owner</dt><dd>${esc(ws.owner)}</dd><dt>Due</dt><dd>${esc(fmtDate(cell.due, true))} (${daysBetween(AS_OF, cell.due)} days)</dd><dt>Country readiness</dt><dd>${readiness(LAUNCH.cells[c])}%</dd><dt>Gate verdict</dt><dd>${chip(gateVerdict(LAUNCH.gates, c), gateVerdict(LAUNCH.gates, c))}</dd></dl></section>
      <section><h3>Status note</h3><p>${esc(cell.note)}</p></section>
      ${risk ? `<section><h3>Risk ${esc(risk.id)} · L${risk.likelihood} × I${risk.impact}</h3><p><b style="font-weight:500">${esc(risk.title)}</b></p>
        <p class="small" style="margin-top:6px">Mitigation: ${esc(risk.mitigation)}</p><p class="small muted" style="margin-top:4px">Trigger: ${esc(risk.trigger)} · Owner: ${esc(risk.owner)}</p></section>` : ""}
      ${related.length ? `<section><h3>Intake themes in scope</h3><ul class="list">${related.map((i) => `<li>${chip(scoreItem(i, state.weights).band, scoreItem(i, state.weights).band)}<div class="grow"><a href="#/intake/${esc(i.id)}">${esc(i.title)}</a></div></li>`).join("")}</ul></section>` : ""}
    </div>`);
}

// ---------- RCA ----------

function rca(rest) {
  if (rest[0] && RCAS.some((r) => r.id === rest[0])) state.rca = rest[0];
  return `
  <div class="page-head">
    <div>
      <div class="eyebrow">03 · Root cause analysis</div>
      <h1>Issue → hypothesis → evidence → fix → verification</h1>
      <p>Every hypothesis is written down and closed with evidence, including the ones that turned out wrong. A fix is verified only when the metric that broke has recovered.</p>
    </div>
  </div>
  <div class="rca">
    <div class="rca-list" role="list">${RCAS.map((r) => `
      <button class="rca-item" role="listitem" data-rca="${esc(r.id)}" aria-pressed="${r.id === state.rca}">
        <div style="display:flex;gap:6px;flex-wrap:wrap">${chip(r.status, r.status)} ${chip(r.severity)}</div>
        <h3>${esc(r.title)}</h3>
        <div class="small muted">${esc(r.id)} · opened ${esc(fmtDate(r.opened, true))} · ${esc(r.owner)}</div>
      </button>`).join("")}</div>
    <article class="card" id="rca-detail"></article>
  </div>`;
}

function renderRca(root) {
  const r = RCAS.find((x) => x.id === state.rca);
  const verified = r.status === "Verified";
  const step = (n, title, body, done = true) => `<div class="step"><span class="step__n ${done ? "step__n--done" : ""}">${n}</span><div><h3>${esc(title)}</h3>${body}</div></div>`;
  $("#rca-detail", root).innerHTML = `
    <div class="card__head" style="align-items:flex-start">
      <div><div class="small muted">${esc(r.id)} · ${esc(r.severity)} · owner ${esc(r.owner)}</div><h2 style="font-size:22px;margin-top:4px">${esc(r.title)}</h2></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${chip(r.status, r.status)}
        ${r.links.feedback ? `<a class="btn btn--ghost btn--sm" href="#/intake/${esc(r.links.feedback)}">${esc(r.links.feedback)}</a>` : ""}
        ${r.links.risk ? `<a class="btn btn--ghost btn--sm" href="#/gtm">${esc(r.links.risk)}</a>` : ""}</div>
    </div>
    <p style="background:var(--latte-125);border-radius:8px;padding:10px 12px;margin-bottom:18px"><b style="font-weight:600">Impact.</b> ${esc(r.impact)}</p>
    <div class="chain">
      ${step(1, "Issue", `<p>${esc(r.issue)}</p>`)}
      ${step(2, "Hypotheses & evidence", r.hypotheses.map((h) => `
        <div class="hyp"><div class="hyp__top"><span>${esc(h.text)}</span><span class="chip v-${esc(h.verdict)}">${esc(h.verdict)}</span></div><p>${esc(h.evidence)}</p></div>`).join(""))}
      ${step(3, "Root cause", `<p>${esc(r.rootCause)}</p>`)}
      ${step(4, "Fix", `<p>${esc(r.fix)}</p>`, r.status !== "Investigating")}
      ${step(5, "Verification", `<p>${esc(r.verification)}</p>`, verified)}
    </div>
    <div class="split" style="margin-top:4px">
      <div><h3 class="small muted" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:8px">5 whys</h3><ol class="whys">${r.whys.map((w) => `<li><span>${esc(w)}</span></li>`).join("")}</ol></div>
      <div><h3 class="small muted" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:8px">Timeline</h3><ul class="timeline">${r.timeline.map(([d, t]) => `<li><span class="muted num">${esc(fmtDate(d, true))}</span><span>${esc(t)}</span></li>`).join("")}</ul></div>
    </div>`;
}

wire.rca = (root) => {
  renderRca(root);
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rca]");
    if (!b) return;
    state.rca = b.dataset.rca;
    $$("[data-rca]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    history.replaceState(null, "", `#/rca/${state.rca}`);
    renderRca(root);
  });
};

// ---------- cadence ----------

function cadence() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const r = ranked();
  const forum = r.filter((x) => x.item.status === "Triaged").slice(0, 5);
  const untriaged = r.filter((x) => x.item.status === "New");
  const L = launchNumbers();
  const w1Cells = L.w1.countries.flatMap((c) => LAUNCH.workstreams.map((w) => ({ c, w, cell: LAUNCH.cells[c][w.id] }))).filter((x) => x.cell.status === "at_risk" || x.cell.status === "blocked");
  const fails = LAUNCH.gates.flatMap((g) => L.w1.countries.filter((c) => g.results[c] === "fail").map((c) => `${country(c).flag} ${g.name}`));
  const openRcas = RCAS.filter((x) => x.status !== "Verified");
  return `
  <div class="page-head">
    <div>
      <div class="eyebrow">04 · Weekly cadence</div>
      <h1>What gets reviewed, with whom, and what ships</h1>
      <p>Five rituals, each with a fixed input and a written output. The pre-read below is built from the intake board, rollout tracker and RCA log, so the meetings discuss decisions instead of collecting status.</p>
    </div>
  </div>
  <div class="week">${days.map((d) => `
    <div class="day"><h3>${d}</h3>${CADENCE.filter((c) => c.day === d).map((c) => `
      <button class="ritual ${c.mins ? "" : "ritual--async"}" data-ritual="${esc(c.name)}">
        <span class="time">${esc(c.time)}${c.mins ? ` · ${c.mins} min` : " · async"}</span>
        <h4>${esc(c.name)}</h4>
        <div class="small muted">${esc(c.who[0])}</div>
        <div class="ships">Ships: ${esc(c.ships)}</div>
      </button>`).join("")}</div>`).join("")}</div>

  <div class="split" style="align-items:start">
    <section class="card preread">
      <div class="card__head"><h2>This week's pre-read</h2><span class="small muted">${esc(AS_OF_LABEL)} · built from the data</span></div>
      <h3>Mon · Signal triage: ${untriaged.length} themes need an owner</h3>
      <ul class="list">${untriaged.map((x) => `<li>${chip(x.s.band, x.s.band)}<div class="grow"><a href="#/intake/${esc(x.item.id)}">${esc(x.item.title)}</a><div class="small muted">${esc(x.item.decision)}</div></div></li>`).join("")}</ul>
      <h3>Wed · Prioritisation forum: top ${forum.length} triaged themes for commit / decline</h3>
      <ul class="list">${forum.map((x) => `<li>${chip(x.s.band, x.s.band)}<div class="grow"><a href="#/intake/${esc(x.item.id)}">${esc(x.item.title)}</a><div class="small muted">Score ${x.s.score} · ${fmtMoney(x.item.arrExposure)} · ${x.item.accounts} accounts${x.s.override ? " · forum override logged" : ""}</div></div></li>`).join("")}</ul>
      <h3>Thu · Launch stand-up: Wave 1 at T-${L.daysToW1}, ${L.w1Readiness}% ready</h3>
      <ul class="list">
        ${fails.map((f) => `<li>${chip("Gate fail", "fail")}<div class="grow">${esc(f)}</div></li>`).join("")}
        ${w1Cells.map((x) => `<li>${chip(STATUS[x.cell.status].label, x.cell.status)}<div class="grow">${esc(countryLabel(x.c))} · ${esc(x.w.name)}<div class="small muted">${esc(x.cell.note)}</div></div></li>`).join("")}
      </ul>
      <h3>Thu · RCA review: ${openRcas.length} not yet verified</h3>
      <ul class="list">${openRcas.map((x) => `<li>${chip(x.status, x.status)}<div class="grow"><a href="#/rca/${esc(x.id)}">${esc(x.id)}</a>: ${esc(x.title)}<div class="small muted">${esc(x.verification)}</div></div></li>`).join("")}</ul>
    </section>
    <div class="grid">
      <section class="card">
        <div class="card__head"><h2>Weekly scorecard</h2><span class="small muted">Fri digest, section 1</span></div>
        <div class="table-wrap"><table class="scorecard">
          <thead><tr><th>Metric</th><th class="num">Target</th><th class="num">Last wk</th><th class="num">This wk</th><th></th></tr></thead>
          <tbody>${SCORECARD.map((m) => {
            const improved = m.better === "down" ? m.now < m.prev : m.now > m.prev;
            return `<tr><td style="white-space:normal">${esc(m.metric)}</td><td class="num">${esc(m.target)}${esc(m.unit)}</td><td class="num muted">${m.prev}${esc(m.unit)}</td><td class="num"><b>${m.now}${esc(m.unit)}</b></td>
              <td><span class="trend ${improved ? "good" : "bad"}">${m.now > m.prev ? "▲" : "▼"}</span></td></tr>`;
          }).join("")}</tbody>
        </table></div>
      </section>
      <section class="card">
        <div class="card__head"><h2>Beyond the week</h2></div>
        <ul class="list">${RHYTHM.map((x) => `<li><span class="chip">${esc(x.cadence)}</span><div class="grow"><b style="font-weight:500">${esc(x.name)}</b><div class="small muted">${esc(x.who)} · ${esc(x.what)}</div></div></li>`).join("")}</ul>
      </section>
    </div>
  </div>`;
}

wire.cadence = (root) => {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ritual]");
    if (!b) return;
    const c = CADENCE.find((x) => x.name === b.dataset.ritual);
    openDrawer(`
      <div class="drawer__head"><div style="flex:1"><div class="small muted" style="margin-bottom:6px">${esc(c.day)} · ${esc(c.time)}${c.mins ? ` · ${c.mins} min` : " · async"}</div><h2>${esc(c.name)}</h2></div>
        <button class="close" data-close aria-label="Close">×</button></div>
      <div class="drawer__body">
        <section><h3>Who</h3><div class="sources">${c.who.map((w) => `<span class="chip">${esc(w)}</span>`).join("")}</div></section>
        <section><h3>Inputs</h3><p>${esc(c.inputs)}</p></section>
        <section><h3>Outputs</h3><p>${esc(c.outputs)}</p></section>
        <section><h3>What ships</h3><p>${esc(c.ships)}</p></section>
        <section><h3>House rule</h3><p><b style="font-weight:500">${esc(c.rule)}</b></p></section>
      </div>`);
  });
};

wire.overview = () => {};

// ---------- overlays ----------

let lastFocus = null;
function openDrawer(html) { mountOverlay(`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true">${html}</aside>`); }
function openModal(html) { mountOverlay(`<div class="scrim" data-close></div><div class="modal" role="dialog" aria-modal="true">${html}</div>`); }
function mountOverlay(html) {
  lastFocus = document.activeElement;
  const root = $("#drawer-root");
  root.innerHTML = html;
  root.onclick = (e) => { if (e.target.closest("[data-close]")) closeOverlay(); };
  $(".close", root)?.focus();
}
function closeOverlay() {
  const root = $("#drawer-root");
  if (!root.innerHTML) return;
  root.innerHTML = "";
  lastFocus?.focus?.();
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });

// ---------- boot ----------

$("#asof").textContent = `Data as of ${AS_OF_LABEL}`;
window.addEventListener("hashchange", route);
route();
