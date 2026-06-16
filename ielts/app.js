/* =============================================================================
   Band 7 Lab — application logic (full rewrite)
   - Persistent store in localStorage (settings, history, streak, achievements).
   - Router shows/hides view sections; [hidden] is always respected by CSS.
   - Examiner: tool-use forced structured output against MARK_SCHEMA.
   - Iterate loop: Apply per-edit -> Re-mark; result shows old -> new band.
   - Coach: prior pattern names injected so the language fingerprint is stable.
   - Owner mode: Settings is hidden by default; unlocked via /#owner-on.
   - One-time device key via /#setup=sk-ant-… (hash never reaches the server).
   ============================================================================= */
(function () {
"use strict";

if (!window.IELTS_DATA) {
  console.error("tasks.js failed to load — window.IELTS_DATA is missing.");
  return;
}
const { TASK1, TASK2, BAND_DESCRIPTORS } = window.IELTS_DATA;

const STORE_KEY = "ielts_lab_v2";
const ANTHROPIC_DIRECT_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_PROXY_URL = "https://band7-lab.web.app/api/mark";

/* ============================== STORE ============================== */

function defaults() {
  return {
    settings: {
      name: "", target: 7.0,
      apiKey: "",                      // owner override only; normally empty
      model: "claude-opus-4-7",
      ownerMode: false,                // when false: no Settings button visible
      proxyUrl: DEFAULT_PROXY_URL,
    },
    history: [],
    streak: { date: "", count: 0 },
    achievements: [],
  };
}
let store;
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!raw) return defaults();
    const def = defaults();
    return Object.assign(def, raw, {
      settings: Object.assign(def.settings, raw.settings || {}),
    });
  } catch { return defaults(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
store = load();

/* one-off migrations from older stored values */
(function migrate() {
  let dirty = false;
  const s = store.settings;
  if (s.model === "claude-opus-4-8") { s.model = "claude-opus-4-7"; dirty = true; }
  if (s.model === "claude-haiku-4-5") { s.model = "claude-haiku-4-5-20251001"; dirty = true; }
  if (s.proxyUrl === "https://ielts-mark.vercel.app/api/mark") {
    s.proxyUrl = DEFAULT_PROXY_URL; dirty = true;
  }
  if (dirty) save();
})();

/* hash-param boot commands — never reach the server */
(function applyHashCommands() {
  if (!location.hash) return;
  const hp = new URLSearchParams(location.hash.slice(1));
  let dirty = false;
  const setup = hp.get("setup");
  if (setup && setup.startsWith("sk-ant-")) { store.settings.apiKey = setup; dirty = true; }
  if (hp.has("owner-on"))  { store.settings.ownerMode = true;  dirty = true; }
  if (hp.has("owner-off")) { store.settings.ownerMode = false; dirty = true; }
  const proxy = hp.get("proxy");
  if (proxy && /^https:\/\//.test(proxy)) { store.settings.proxyUrl = proxy; dirty = true; }
  if (dirty) {
    save();
    history.replaceState({}, "", location.pathname + location.search);
  }
})();

/* ============================== HELPERS ============================== */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const wordsOf  = (t) => (String(t).trim().match(/\S+/g) || []).length;
const round05  = (x) => Math.round(x * 2) / 2;
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtBand  = (b) => (b == null ? "—" : Number(b).toFixed(1));
const fmtDate  = (ts) => new Date(ts).toLocaleDateString(undefined,
  { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2600);
}

function confirmDialog(text, onYes) {
  $("#confirmText").textContent = text;
  $("#confirmNo").hidden = false;
  $("#confirmYes").textContent = "Yes";
  $("#confirmModal").hidden = false;
  $("#confirmYes").onclick = () => { $("#confirmModal").hidden = true; onYes(); };
  $("#confirmNo").onclick  = () => { $("#confirmModal").hidden = true; };
}
function infoDialog(html) {
  $("#confirmText").innerHTML = html;
  $("#confirmNo").hidden = true;
  $("#confirmYes").textContent = "Close";
  $("#confirmModal").hidden = false;
  $("#confirmYes").onclick = () => {
    $("#confirmModal").hidden = true;
    $("#confirmNo").hidden = false;
    $("#confirmYes").textContent = "Yes";
  };
}

/* ============================== ROUTER ============================== */

const VIEWS = ["home", "picker", "exam", "result", "history", "coach"];
function show(view) {
  // hide the topbar while exam is up (CD-IELTS owns the screen)
  $("#topbar").hidden = view === "exam";
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== view; });
  window.scrollTo(0, 0);
}

/* ============================== OWNER UI ============================== */

function applyOwnerUI() {
  const owner = !!store.settings.ownerMode;
  $("#navSettings").hidden     = !owner;
  $("#editTarget").hidden      = !owner;
  $("#ownerOnlyFields").hidden = !owner;
  $("#resetProgress").hidden   = !owner;
}

/* ============================== HOME ============================== */

const FOCUS_TIPS = {
  task:                         "the task itself — answer every part directly, with a clear position and a real overview up front.",
  coherence_cohesion:           "linking and paragraphing — one clear idea per paragraph, varied linkers (not just Firstly/Secondly).",
  lexical_resource:             "vocabulary — precise, less-common words and natural collocations instead of repeating basic ones.",
  grammatical_range_accuracy:   "grammar — write more complex sentences that are fully error-free; band 7 needs frequent error-free sentences.",
};

function critLabelFor(key, type) {
  if (key === "task") return type === "task1" ? "Task Achievement" : "Task Response";
  return BAND_DESCRIPTORS[key].name;
}

function renderHome() {
  const s = store.settings;
  $("#greeting").textContent = s.name
    ? `Welcome back, ${s.name}. Let's climb to band ${fmtBand(s.target)}.`
    : "Practise IELTS Writing under real exam conditions.";

  const marked = store.history.filter((h) => h.band != null);
  $("#statBest").textContent   = marked.length ? fmtBand(Math.max(...marked.map((h) => h.band))) : "—";
  $("#statTarget").textContent = fmtBand(s.target);
  $("#statStreak").innerHTML   = `${store.streak.count}<span class="stat-unit">d</span>`;
  $("#statCount").textContent  = marked.length;

  renderFocus(marked);
  renderProgressChart(marked, "#progressPanel", "#progressChart", "#progressNote");
  renderRecent();
  renderAchievements();
  applyOwnerUI();

  const owner = !!s.ownerMode;
  if (s.apiKey || s.proxyUrl) {
    $("#apiHint").innerHTML = owner
      ? `Examiner ready · using <b>${esc(s.model)}</b> · proxy <b>${esc(s.proxyUrl)}</b>`
      : `Examiner ready.`;
  } else {
    $("#apiHint").innerHTML = owner
      ? `No marker configured. Add an API key or proxy URL in <b>Settings</b>.`
      : `Setup is incomplete. Ask the owner to configure access.`;
  }
}

function renderFocus(marked) {
  const banner = $("#focusBanner");
  if (marked.length < 1) { banner.hidden = true; return; }
  const recent = marked.slice(-5);
  const sums = {}, counts = {};
  recent.forEach((h) => {
    const c = h.mark && h.mark.criteria;
    if (!c) return;
    ["task","coherence_cohesion","lexical_resource","grammatical_range_accuracy"].forEach((k) => {
      if (c[k] && typeof c[k].band === "number") {
        sums[k]   = (sums[k]   || 0) + c[k].band;
        counts[k] = (counts[k] || 0) + 1;
      }
    });
  });
  let worst = null, worstAvg = 99;
  Object.keys(sums).forEach((k) => {
    const avg = sums[k] / counts[k];
    if (avg < worstAvg) { worstAvg = avg; worst = k; }
  });
  if (!worst) { banner.hidden = true; return; }
  const type = recent[recent.length - 1].type;
  $("#focusText").innerHTML =
    `Your weakest area right now is <b>${esc(critLabelFor(worst, type))}</b> ` +
    `(avg ${worstAvg.toFixed(1)}). Today, focus on ${FOCUS_TIPS[worst]}`;
  banner.hidden = false;
}

function renderRecent() {
  const panel = $("#recentPanel"), list = $("#recentList");
  if (!store.history.length) { panel.hidden = true; return; }
  panel.hidden = false;
  list.innerHTML = store.history.slice(-4).reverse().map(attemptRow).join("");
  bindAttemptRows(list);
}
function attemptRow(h) {
  return `<div class="attempt" data-id="${esc(h.id)}">
    <div class="attempt-band">${fmtBand(h.band)}</div>
    <div class="attempt-meta">
      <div class="attempt-title">${esc(h.title)}</div>
      <div class="attempt-sub">${h.type === "task1" ? "Task 1" : "Task 2"} · ${esc(fmtDate(h.ts))} · ${h.wordCount} words</div>
    </div>
    ${h.mark ? `<button class="attempt-view" type="button">View</button>` : `<span class="attempt-sub">not marked</span>`}
  </div>`;
}
function bindAttemptRows(root) {
  $$(".attempt", root).forEach((row) => {
    const btn = $(".attempt-view", row);
    if (!btn) return;
    btn.onclick = () => {
      const h = store.history.find((x) => x.id === row.dataset.id);
      if (h && h.mark) {
        renderResult([{ task: taskById(h.taskId), answer: h.answer, wordCount: h.wordCount, mark: h.mark }]);
        show("result");
      }
    };
  });
}

const ACHIEVEMENTS = [
  { id: "first_submit", label: "1st", name: "First step",   desc: "Submit your first answer" },
  { id: "first_mark",   label: "✓",   name: "Marked",       desc: "Get your first AI band" },
  { id: "five",         label: "5",   name: "Getting serious", desc: "Write 5 answers" },
  { id: "band6",        label: "6",   name: "Band 6.0",     desc: "Reach band 6.0" },
  { id: "band65",       label: "6.5", name: "Band 6.5",     desc: "Reach band 6.5" },
  { id: "band7",        label: "7",   name: "Band 7 club",  desc: "Reach band 7.0" },
  { id: "band75",       label: "7.5", name: "Band 7.5+",    desc: "Reach band 7.5 or above" },
  { id: "streak3",      label: "3d",  name: "3-day streak", desc: "Practise 3 days running" },
  { id: "streak7",      label: "7d",  name: "7-day warrior",desc: "Practise 7 days running" },
  { id: "pb",           label: "PB",  name: "Personal best",desc: "Beat your best band" },
];
function renderAchievements() {
  $("#achievements").innerHTML = ACHIEVEMENTS.map((a) => {
    const got = store.achievements.includes(a.id);
    return `<div class="ach ${got ? "unlocked" : ""}">
      <span class="ach-ico ${got ? "unlocked" : ""}">${esc(a.label)}</span>
      <span class="ach-txt"><b>${esc(a.name)}</b>${esc(a.desc)}</span>
    </div>`;
  }).join("");
}
function unlock(id) {
  if (store.achievements.includes(id)) return;
  store.achievements.push(id); save();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a) toast(`Milestone unlocked — ${a.name}`);
}

function renderProgressChart(marked, panelSel, chartSel, noteSel) {
  const panel = $(panelSel);
  if (marked.length < 2) { if (panel) panel.hidden = true; return; }
  if (panel) panel.hidden = false;
  const pts = marked.slice(-12).map((h) => h.band);
  if (noteSel) {
    const delta = pts[pts.length - 1] - pts[0];
    $(noteSel).textContent = delta > 0
      ? `▲ up ${delta.toFixed(1)} band since you started`
      : delta < 0
      ? `${delta.toFixed(1)} band — keep going`
      : "holding steady";
  }
  $(chartSel).innerHTML = bandSpark(pts, store.settings.target);
}
function bandSpark(values, target) {
  const W = 320, H = 120, pl = 24, pb = 18, pt = 10, pr = 8;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const lo = 4, hi = 9;
  const x = (i) => pl + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const y = (v) => pt + plotH - ((v - lo) / (hi - lo)) * plotH;
  let grid = "";
  [5,6,7,8,9].forEach((g) => {
    grid += `<line x1="${pl}" y1="${y(g)}" x2="${W - pr}" y2="${y(g)}" stroke="#243152"/>
      <text x="2" y="${y(g) + 3}" font-size="8">${g}</text>`;
  });
  const tgt = target >= lo && target <= hi
    ? `<line x1="${pl}" y1="${y(target)}" x2="${W - pr}" y2="${y(target)}" stroke="#ffb454" stroke-dasharray="4 3"/>`
    : "";
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="#84baff"/>`).join("");
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">${grid}${tgt}
    <path d="${path}" fill="none" stroke="#5b8cff" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}

/* ============================== PICKER ============================== */

function openPicker(mode) {
  if (mode === "full") { startExam("full"); return; }
  const list = mode === "task1" ? TASK1 : TASK2;
  $("#pickerTitle").textContent = mode === "task1"
    ? "Task 1 — describe the visual"
    : "Task 2 — write the essay";
  let html = `<button class="picker-card random" type="button" data-pick="__random">
    <div class="picker-thumb">⇄</div>
    <div class="picker-info">
      <div class="picker-kicker">Recommended</div>
      <div class="picker-title">Random — closest to real exam</div>
      <div class="picker-desc">Give me a ${mode === "task1" ? "Task 1 chart" : "Task 2 question"} I haven't seen.</div>
    </div></button>`;
  html += list.map((t) => `<button class="picker-card" type="button" data-pick="${esc(t.id)}">
    <div class="picker-thumb">${mode === "task1" ? thumbFor(t) : "T2"}</div>
    <div class="picker-info">
      <div class="picker-kicker">${esc(t.qType || t.chartKind || "")}</div>
      <div class="picker-title">${esc(t.title)}</div>
      <div class="picker-desc">${esc(promptPreview(t.prompt))}</div>
    </div></button>`).join("");
  $("#pickerList").innerHTML = html;
  $$("#pickerList .picker-card").forEach((c) => {
    c.onclick = () => {
      let id = c.dataset.pick;
      if (id === "__random") id = list[Math.floor(Math.random() * list.length)].id;
      startExam("single", id);
    };
  });
  show("picker");
}
const promptPreview = (p) => {
  const flat = String(p).replace(/\s+/g, " ");
  return flat.length > 120 ? flat.slice(0, 117) + "…" : flat;
};
const thumbFor = (t) => renderChart(t.chart, true);

/* ============================== EXAM ============================== */

const exam = {
  tasks: [], answers: [], active: 0,
  mode: "single", remaining: 0, timer: null,
  warned10: false, warned5: false, warned1: false,
};

function taskById(id) { return TASK1.concat(TASK2).find((t) => t.id === id); }
function minutesFor(type) { return type === "task1" ? 20 : 40; }
function minWordsFor(type) { return type === "task1" ? 150 : 250; }

function startExam(mode, id) {
  exam.mode = mode; exam.active = 0;
  exam.warned10 = exam.warned5 = exam.warned1 = false;
  if (mode === "full") {
    exam.tasks = [
      TASK1[Math.floor(Math.random() * TASK1.length)],
      TASK2[Math.floor(Math.random() * TASK2.length)],
    ];
    exam.remaining = 60 * 60;
  } else {
    exam.tasks = [taskById(id)];
    exam.remaining = minutesFor(exam.tasks[0].type) * 60;
  }
  exam.answers = exam.tasks.map(() => "");
  buildExamUI();
  show("exam");
  $("#answerBox").focus();
  startTimer();
}

function buildExamUI() {
  const tabs = $("#examTabs");
  if (exam.tasks.length > 1) {
    tabs.hidden = false;
    tabs.innerHTML = exam.tasks.map((t, i) =>
      `<button type="button" class="${i === exam.active ? "active" : ""}" data-tab="${i}">Part ${i + 1}</button>`
    ).join("");
    $$("#examTabs button").forEach((b) => (b.onclick = () => switchTab(+b.dataset.tab)));
  } else {
    tabs.hidden = true;
  }
  loadActiveTask();
}

function switchTab(i) {
  exam.answers[exam.active] = $("#answerBox").value;
  exam.active = i;
  $$("#examTabs button").forEach((b) => b.classList.toggle("active", +b.dataset.tab === i));
  loadActiveTask();
}

function loadActiveTask() {
  const t = exam.tasks[exam.active];
  $("#examPhase").textContent  = t.type === "task1" ? "Part 1" : "Part 2";
  $("#examRubric").textContent = t.type === "task1"
    ? "You should spend about 20 minutes on this task. Write at least 150 words."
    : "You should spend about 40 minutes on this task. Write at least 250 words.";
  $("#examStim").innerHTML = stimulusHTML(t);
  const box = $("#answerBox");
  box.value = exam.answers[exam.active];
  box.oninput = () => { exam.answers[exam.active] = box.value; updateWordCount(); };
  updateWordCount();
}

function stimulusHTML(t) {
  let html = `<h3 class="task-prompt-head">${t.type === "task1" ? "Task 1" : "Task 2"}</h3>`;
  html += `<p class="task-prompt">${esc(t.prompt).replace(/\n\n/g, "<br><br>")}</p>`;
  if (t.type === "task1") {
    html += `<div class="chart-wrap"><div class="chart-title">${esc(t.title)}</div>${renderChart(t.chart, false)}</div>`;
  }
  html += `<p class="task-instruction">${esc(t.instruction)}</p>`;
  return html;
}

function updateWordCount() {
  const t = exam.tasks[exam.active];
  const n = wordsOf($("#answerBox").value);
  const min = minWordsFor(t.type);
  $("#wordCount").textContent  = n;
  $("#wordsTarget").textContent = `(${min} min)`;
  $("#cdWords").classList.toggle("ok", n >= min);
}

function startTimer() {
  updateTimer();
  exam.timer = setInterval(() => {
    exam.remaining--;
    updateTimer();
    if (exam.remaining <= 0) {
      clearInterval(exam.timer); exam.timer = null;
      toast("Time's up — submitting your work.");
      doSubmit(true);
    }
  }, 1000);
}
function updateTimer() {
  const m = Math.floor(exam.remaining / 60), s = exam.remaining % 60;
  const el = $("#examTimer");
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("warn",   exam.remaining <= 300 && exam.remaining > 60);
  el.classList.toggle("danger", exam.remaining <= 60);
  // Real CD-IELTS pops a notice at 10 / 5 / 1 minute remaining.
  if (exam.remaining === 600 && !exam.warned10) { exam.warned10 = true; toast("10 minutes remaining."); }
  if (exam.remaining === 300 && !exam.warned5)  { exam.warned5  = true; toast("5 minutes remaining."); }
  if (exam.remaining === 60  && !exam.warned1)  { exam.warned1  = true; toast("1 minute remaining."); }
}
function stopTimer() { if (exam.timer) clearInterval(exam.timer); exam.timer = null; }

function doSubmit(auto) {
  exam.answers[exam.active] = $("#answerBox").value;
  const tooShort = exam.tasks.some((t, i) => wordsOf(exam.answers[i]) < minWordsFor(t.type));
  const empty    = exam.answers.some((a) => wordsOf(a) < 20);
  if (!auto && empty) { toast("Write a bit more before submitting."); return; }
  if (!auto && tooShort) {
    confirmDialog(
      "You're under the recommended word count. That lowers your band — the examiner won't pretend otherwise. Submit anyway?",
      finishSubmit);
    return;
  }
  finishSubmit();
}
function finishSubmit() {
  stopTimer();
  recordStreak();
  unlock("first_submit");
  const records = exam.tasks.map((t, i) => ({ task: t, answer: exam.answers[i], wordCount: wordsOf(exam.answers[i]) }));
  show("result");
  markAll(records);
}
function recordStreak() {
  const t = todayStr();
  if (store.streak.date !== t) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    store.streak.count = (store.streak.date === y) ? store.streak.count + 1 : 1;
    store.streak.date  = t;
  }
  if (store.streak.count >= 3) unlock("streak3");
  if (store.streak.count >= 7) unlock("streak7");
  save();
}

/* ============================== CHARTS ============================== */

function renderChart(chart, thumb) {
  if (!chart) return "";
  switch (chart.kind) {
    case "line":    return lineChart(chart, thumb);
    case "bar":     return barChart(chart, thumb);
    case "table":   return thumb ? "▤" : tableChart(chart);
    case "process": return thumb ? "⟳" : processChart(chart);
    case "pie":     return pieChart(chart, thumb);
    default:        return "";
  }
}
function chartLegend(series) {
  return `<div class="chart-legend">${series.map((s) =>
    `<span><i class="legend-dot" style="background:${s.color}"></i>${esc(s.name)}</span>`
  ).join("")}</div>`;
}
function lineChart(c, thumb) {
  const W = 340, H = 200, pl = 30, pb = 24, pt = 10, pr = 12;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const xs = c.xLabels, n = xs.length;
  const x = (i) => pl + (i / (n - 1)) * plotW;
  const y = (v) => pt + plotH - (v / c.yMax) * plotH;
  let grid = "", step = c.yMax / 5;
  for (let g = 0; g <= c.yMax; g += step)
    grid += `<line x1="${pl}" y1="${y(g)}" x2="${W - pr}" y2="${y(g)}" stroke="#cdd3df"/>
      <text x="2" y="${y(g) + 3}" font-size="9">${g}</text>`;
  const xlab = thumb ? "" : xs.map((l, i) =>
    `<text x="${x(i)}" y="${H - 8}" font-size="9" text-anchor="middle">${esc(l)}</text>`).join("");
  const lines = c.series.map((s) => {
    const p = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const dots = thumb ? "" : s.values.map((v, i) =>
      `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join("");
    return `<path d="${p}" fill="none" stroke="${s.color}" stroke-width="${thumb ? 2 : 2.4}"/>${dots}`;
  }).join("");
  const svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">${grid}${xlab}${lines}</svg>`;
  return thumb ? svg : svg + chartLegend(c.series);
}
function barChart(c, thumb) {
  const W = 340, H = 200, pl = 30, pb = 30, pt = 10, pr = 12;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const cats = c.categories, ns = c.series.length;
  const groupW = plotW / cats.length, barW = (groupW * 0.7) / ns;
  const y = (v) => pt + plotH - (v / c.yMax) * plotH;
  let grid = "", step = c.yMax / 5;
  for (let g = 0; g <= c.yMax; g += step)
    grid += `<line x1="${pl}" y1="${y(g)}" x2="${W - pr}" y2="${y(g)}" stroke="#cdd3df"/>
      <text x="2" y="${y(g) + 3}" font-size="9">${g}</text>`;
  let bars = "", labels = "";
  cats.forEach((cat, ci) => {
    const gx = pl + ci * groupW + groupW * 0.15;
    c.series.forEach((s, si) => {
      const v = s.values[ci], bx = gx + si * barW;
      bars += `<rect x="${bx.toFixed(1)}" y="${y(v).toFixed(1)}"
        width="${(barW * 0.9).toFixed(1)}" height="${(pt + plotH - y(v)).toFixed(1)}"
        fill="${s.color}" rx="2"/>`;
    });
    if (!thumb)
      labels += `<text x="${(pl + ci * groupW + groupW / 2).toFixed(1)}" y="${H - 16}"
        font-size="8" text-anchor="middle">${esc(cat.length > 10 ? cat.slice(0, 9) + "…" : cat)}</text>`;
  });
  const svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">${grid}${bars}${labels}</svg>`;
  return thumb ? svg : svg + chartLegend(c.series);
}
function tableChart(c) {
  return `<table class="data-table">
    <thead><tr>${c.columns.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${c.rows.map((r) =>
      `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}
function processChart(c) {
  const steps = c.steps.map((s, i) =>
    `<div class="proc-step"><span class="proc-num">${i + 1}</span><span>${esc(s)}</span></div>`).join("");
  return `<div class="proc-steps">${steps}</div>${c.cyclic ? '<div class="proc-cyclic">↻ the cycle then repeats</div>' : ""}`;
}
function pieChart(c, thumb) {
  if (thumb) return "◴";
  const r = 54, cy = 72;
  const centers = c.charts.length === 2 ? [92, 248] : [170];
  let svg = `<svg class="chart-svg" viewBox="0 0 340 170">`;
  c.charts.forEach((pie, pi) => {
    const cx = centers[pi];
    const total = pie.slices.reduce((a, s) => a + s.value, 0);
    let ang = -90;
    pie.slices.forEach((s) => {
      const sweep = (s.value / total) * 360;
      svg += pieArc(cx, cy, r, ang, ang + sweep, s.color);
      ang += sweep;
    });
    svg += `<text x="${cx}" y="${cy + r + 22}" font-size="11" text-anchor="middle" fill="#16213a">${esc(pie.title)}</text>`;
  });
  svg += `</svg>`;
  return svg + chartLegend(c.charts[0].slices.map((s) => ({ name: s.name, color: s.color })));
}
function pieArc(cx, cy, r, a0, a1, color) {
  const p0 = pol(cx, cy, r, a1), p1 = pol(cx, cy, r, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `<path d="M${cx},${cy} L${p0.x},${p0.y} A${r},${r} 0 ${large} 0 ${p1.x},${p1.y} Z"
    fill="${color}" stroke="#fff" stroke-width="1"/>`;
}
function pol(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: (cx + r * Math.cos(a)).toFixed(1), y: (cy + r * Math.sin(a)).toFixed(1) };
}

/* ============================== EXAMINER ============================== */

function buildSystem(type) {
  const firstName = type === "task1" ? "Task Achievement" : "Task Response";
  const firstDesc = type === "task1" ? BAND_DESCRIPTORS.task1 : BAND_DESCRIPTORS.task2;
  const crits = [
    [firstName, firstDesc],
    ["Coherence & Cohesion",       BAND_DESCRIPTORS.coherence_cohesion],
    ["Lexical Resource",           BAND_DESCRIPTORS.lexical_resource],
    ["Grammatical Range & Accuracy", BAND_DESCRIPTORS.grammatical_range_accuracy],
  ];
  const descBlock = crits.map(([name, d]) => {
    const lines = Object.keys(d.bands).sort((a, b) => b - a)
      .map((b) => `  Band ${b}: ${d.bands[b]}`).join("\n");
    return `${name}:\n${lines}`;
  }).join("\n\n");

  return [
    "You are a senior, certified IELTS Writing examiner. You mark to the official",
    "IELTS public band descriptors and you are CALIBRATED and CONSERVATIVE. Your",
    "job is to tell the candidate their TRUE level, never to flatter them.",
    "",
    `This is an IELTS Academic Writing ${type === "task1" ? "Task 1" : "Task 2"} answer.`,
    "Score each of the four criteria as a WHOLE band from 0 to 9 (no half bands per",
    "criterion) by choosing the single band whose descriptor best matches the script.",
    "",
    "OFFICIAL BAND DESCRIPTORS (apply literally):",
    descBlock,
    "",
    "STRICT CALIBRATION RULES — do NOT over-promise:",
    "- Band 7 Grammatical Range & Accuracy requires a VARIETY of complex structures AND",
    "  FREQUENT error-free sentences. If grammar errors are noticeable or recurring,",
    "  the band is 6 (or lower). Most candidates aiming for 7 are really at 6 or 6.5",
    "  because of grammar and vocabulary — say so honestly when it is true.",
    "- Band 7 Lexical Resource requires some less-common vocabulary used with awareness",
    "  of collocation. Basic, repetitive or error-prone vocabulary is band 6 or below.",
    "- Award band 8/9 ONLY for genuinely near-flawless, sophisticated writing.",
    type === "task1"
      ? "- For Task 1, judge whether the candidate selects key features, gives a clear overview, and reports figures ACCURATELY against the supplied data. Inaccurate or invented figures lower Task Achievement."
      : "- For Task 2, check that EVERY part of the question is answered with a clear position and developed, supported ideas. Partly-answered tasks cap Task Response at 5-6.",
    "- If the answer is under the minimum length (Task 1 < 150 words, Task 2 < 250),",
    "  the first criterion must reflect under-development (usually 5 or below).",
    "- 'evidence' for each criterion MUST refer to SPECIFIC wording from the script and",
    "  tie it to the descriptor. Be concrete, not generic.",
    "- Be honest and practical, never harsh for its own sake, but never inflate a band.",
    "",
    "ALSO PRODUCE — this is what makes you a COACH, not just a scorer:",
    "- recurring_patterns: 2 to 4 of the candidate's HABITUAL weaknesses. For each:",
    "  a short CONSISTENT name, the rule in one line, ONE example quoted verbatim from",
    "  THIS script, and how to fix it. Track patterns across essays by reusing names.",
    "- upgrade_edits: the SMALLEST set of surgical changes (4-7) that would lift THIS",
    "  script by about one whole band. 'before' MUST be an exact, verbatim quote from",
    "  the candidate's text. 'after' is your improved version. 'criterion' is one of:",
    "  'Task', 'Coherence & Cohesion', 'Lexical Resource', 'Grammar'. 'why' explains",
    "  the move in one short line. Prefer minimal, teachable edits over wholesale rewriting.",
    "",
    "Always call the report_mark tool with the structured object. Do not write prose.",
  ].join("\n");
}

function buildUser(r) {
  const t = r.task;
  let u = `TASK TYPE: IELTS Academic ${t.type === "task1" ? "Task 1" : "Task 2"}\n\n`;
  u += `QUESTION / PROMPT:\n${t.prompt}\n\n`;
  if (t.type === "task1" && t.dataFacts) {
    u += `WHAT THE VISUAL SHOWS (the candidate could see the chart; use this only to check the accuracy of figures they report):\n${t.dataFacts}\n\n`;
  }
  const prior = collectPriorPatternNames();
  if (prior.length) {
    u += `THIS CANDIDATE HAS PRIOR MARKED ESSAYS. In those, you previously named these recurring patterns:\n`;
    u += prior.map((n) => `  - ${n}`).join("\n");
    u += `\nIf any recur in the script below, REUSE THE SAME NAME so the Coach can track them. Only invent a new name when the pattern is genuinely distinct.\n\n`;
  }
  u += `CANDIDATE'S ANSWER (${r.wordCount} words):\n"""\n${r.answer}\n"""`;
  return u;
}

function collectPriorPatternNames() {
  const tally = {};
  store.history.forEach((h) => {
    const ps = h.mark && h.mark.recurring_patterns;
    if (!ps) return;
    ps.forEach((p) => {
      const name = (p.name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!tally[key]) tally[key] = { name, count: 0 };
      tally[key].count += 1;
    });
  });
  return Object.values(tally)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((e) => e.name);
}

const critSchema = () => ({
  type: "object", additionalProperties: false,
  properties: { band: { type: "integer" }, evidence: { type: "string" } },
  required: ["band", "evidence"],
});

const MARK_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    under_length: { type: "boolean" },
    criteria: {
      type: "object", additionalProperties: false,
      properties: {
        task:                          critSchema(),
        coherence_cohesion:            critSchema(),
        lexical_resource:              critSchema(),
        grammatical_range_accuracy:    critSchema(),
      },
      required: ["task","coherence_cohesion","lexical_resource","grammatical_range_accuracy"],
    },
    key_strengths: { type: "array", items: { type: "string" } },
    priority_fixes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          issue:   { type: "string" }, why: { type: "string" },
          fix:     { type: "string" }, example: { type: "string" },
        },
        required: ["issue","why","fix","example"],
      },
    },
    upgrade_edits: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          before:    { type: "string" }, after: { type: "string" },
          criterion: { type: "string" }, why:   { type: "string" },
        },
        required: ["before","after","criterion","why"],
      },
    },
    recurring_patterns: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          name:    { type: "string" }, rule:    { type: "string" },
          example: { type: "string" }, fix:     { type: "string" },
        },
        required: ["name","rule","example","fix"],
      },
    },
    examiner_summary: { type: "string" },
    next_band_advice: { type: "string" },
  },
  required: ["under_length","criteria","key_strengths","priority_fixes",
    "upgrade_edits","recurring_patterns","examiner_summary","next_band_advice"],
};

async function markEssay(r) {
  const s = store.settings;
  const body = {
    model: s.model,
    max_tokens: 4096,
    system: buildSystem(r.task.type),
    messages: [{ role: "user", content: buildUser(r) }],
    tools: [{
      name: "report_mark",
      description: "Return the IELTS examiner mark for this script using the official band descriptors.",
      input_schema: MARK_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "report_mark" },
  };
  const useDevice = !!s.apiKey;
  let res;
  if (useDevice) {
    res = await fetch(ANTHROPIC_DIRECT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": s.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
  } else {
    try {
      res = await fetch(s.proxyUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      const e = new Error("Cannot reach the marker."); e.code = "NEEDS_KEY"; throw e;
    }
    if (res.status === 404 || res.status === 503) {
      const e = new Error("The marker is not configured on this device."); e.code = "NEEDS_KEY"; throw e;
    }
  }
  if (!res.ok) {
    let msg = `Marking request failed (${res.status}).`;
    try {
      const e = await res.json();
      const m = (e.error && e.error.message) || "";
      if (res.status === 401) msg = "Your API key was rejected. Open Settings and check it starts with sk-ant-.";
      else if (res.status === 400 && /credit|balance|billing/i.test(m)) msg = "The Anthropic account needs billing set up.";
      else if (res.status === 429) msg = "Rate limited — wait a moment and try again.";
      else if (m) msg = m;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("The model declined to mark this text. Try a different answer.");
  const block = (data.content || []).find((b) => b.type === "tool_use" && b.name === "report_mark");
  if (!block || !block.input) throw new Error("The examiner returned no structured mark. Please try again.");
  const mark = block.input;
  const c = mark.criteria;
  const vals = ["task","coherence_cohesion","lexical_resource","grammatical_range_accuracy"].map((k) => c[k].band);
  mark.band = round05(vals.reduce((a, b) => a + b, 0) / 4);
  return mark;
}

/* ============================== MARKING FLOW ============================== */

const TICKER = [
  "Reading for task achievement…",
  "Tracing coherence and paragraphing…",
  "Weighing vocabulary range and precision…",
  "Auditing grammar for error-free sentences…",
  "Comparing against the official band descriptors…",
  "Finding your recurring patterns…",
  "Engineering the smallest edits to lift your band…",
  "Calibrating an honest band — no inflation…",
];
let tickerInt, tickerI = 0;
function markingSpinner(label) {
  return `<div class="marking">
    <div class="spinner"></div>
    <p id="markingLabel">${esc(label || "The examiner is reading your writing…")}</p>
    <p class="marking-step" id="markingStep">${TICKER[0]}</p>
  </div>`;
}
function startTicker() {
  tickerI = 0;
  tickerInt = setInterval(() => {
    tickerI = (tickerI + 1) % TICKER.length;
    const el = $("#markingStep");
    if (el) el.textContent = TICKER[tickerI];
  }, 2200);
}
function stopTicker() { clearInterval(tickerInt); }

async function markAll(records) {
  $("#resultBody").innerHTML = markingSpinner(records.length > 1 ? "Marking Task 1 of 2…" : "");
  startTicker();
  try {
    for (let i = 0; i < records.length; i++) {
      const lbl = $("#markingLabel");
      if (lbl && records.length > 1) lbl.textContent = `Marking Task ${i + 1} of ${records.length}…`;
      records[i].mark = await markEssay(records[i]);
    }
    stopTicker();
    records.forEach(saveAttempt);
    afterMarkAchievements(records);
    renderResult(records);
  } catch (err) {
    stopTicker();
    if (err && err.code === "NEEDS_KEY") renderNoKey(records);
    else renderMarkError(err, records);
  }
}
function saveAttempt(r) {
  store.history.push({
    id: "a" + Date.now() + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    taskId: r.task.id, type: r.task.type, title: r.task.title,
    answer: r.answer, wordCount: r.wordCount,
    mark: r.mark, band: r.mark.band,
  });
  save();
}
function afterMarkAchievements(records) {
  unlock("first_mark");
  const marked = store.history.filter((h) => h.band != null);
  if (marked.length >= 5) unlock("five");
  const prevBest = Math.max(0, ...marked.slice(0, -records.length).map((h) => h.band));
  const best     = Math.max(...marked.map((h) => h.band));
  if (best >= 6)   unlock("band6");
  if (best >= 6.5) unlock("band65");
  if (best >= 7)   unlock("band7");
  if (best >= 7.5) unlock("band75");
  if (best > prevBest && prevBest > 0) unlock("pb");
}

function renderMarkError(err, records) {
  $("#resultBody").innerHTML = `<div class="panel">
    <h3>Couldn't complete marking</h3>
    <p class="section-lead">${esc(err.message)}</p>
    <div class="result-actions">
      <button class="primary-btn" id="errRetry" type="button">Try again</button>
      <button class="secondary-btn" id="errHome"  type="button">Back to dashboard</button>
    </div>
  </div>
  <div class="result-section">
    <h3>Your answer (${records[0].wordCount} words)</h3>
    <div class="your-answer">${esc(records[0].answer)}</div>
  </div>`;
  $("#errRetry").onclick = () => markAll(records);
  $("#errHome").onclick  = () => { show("home"); renderHome(); };
}

function renderNoKey(records) {
  const r = records[0];
  const owner = !!store.settings.ownerMode;
  $("#resultBody").innerHTML = `<div class="panel">
    <h3>The examiner isn't reachable</h3>
    <p class="section-lead">${owner
      ? "Check that the proxy URL and API key are correctly set in Settings."
      : "Setup is incomplete on this device. Ask the owner to configure access. The model answer below is still useful for self-comparison."}</p>
    <div class="result-actions">
      ${owner ? `<button class="primary-btn" id="nkSettings" type="button">Open Settings</button>` : ""}
      <button class="secondary-btn" id="nkHome" type="button">Back to dashboard</button>
    </div>
  </div>
  <div class="result-section">
    <h3>Your answer (${r.wordCount} words)</h3>
    <div class="your-answer">${esc(r.answer) || "—"}</div>
  </div>
  ${selfCheckHTML(r.task.type)}
  ${modelAnswerHTML(r.task)}`;
  if ($("#nkSettings")) $("#nkSettings").onclick = openSettings;
  $("#nkHome").onclick = () => { show("home"); renderHome(); };
  bindModelToggle();
}

function selfCheckHTML(type) {
  const first = type === "task1" ? BAND_DESCRIPTORS.task1 : BAND_DESCRIPTORS.task2;
  const items = [
    [first.name, first.bands["7"]],
    ["Coherence & Cohesion",           BAND_DESCRIPTORS.coherence_cohesion.bands["7"]],
    ["Lexical Resource",               BAND_DESCRIPTORS.lexical_resource.bands["7"]],
    ["Grammatical Range & Accuracy",   BAND_DESCRIPTORS.grammatical_range_accuracy.bands["7"]],
  ];
  return `<div class="result-section">
    <h3>Band 7 self-check</h3>
    <div class="crit-grid">${items.map(([n, d]) =>
      `<div class="crit"><div class="crit-name">${esc(n)}</div>
       <div class="crit-evidence">${esc(d)}</div></div>`).join("")}</div>
  </div>`;
}

/* ============================== RESULT ============================== */

function renderResult(records) {
  const single = records.length === 1;
  let overall = null;
  if (!single) {
    const t1 = records.find((r) => r.task.type === "task1").mark.band;
    const t2 = records.find((r) => r.task.type === "task2").mark.band;
    overall = round05((t1 + t2 * 2) / 3);
  }
  const headBand = single ? records[0].mark.band : overall;
  const target = store.settings.target;
  const hit = headBand >= target;
  const subBands = !single
    ? `Task 1: ${fmtBand(records.find(r=>r.task.type==="task1").mark.band)} · Task 2: ${fmtBand(records.find(r=>r.task.type==="task2").mark.band)} (Task 2 counts double)`
    : "";

  let html = `<div class="result-hero">
    <div class="result-hero-label">${single ? "Estimated band" : "Overall Writing band"}</div>
    <div class="result-hero-band">${fmtBand(headBand)}</div>
    <div class="result-hero-target">${hit
      ? `<b class="hit">✓ at or above your target of ${fmtBand(target)}</b>`
      : `${(target - headBand).toFixed(1)} band below your target of <b class="miss">${fmtBand(target)}</b>`}</div>
    ${subBands ? `<div class="result-hero-note">${esc(subBands)}</div>` : ""}
    <div class="result-hero-note">AI estimate against the official IELTS band descriptors. Real exams are marked by certified humans and can differ by ~0.5 band.</div>
  </div>`;

  records.forEach((r, i) => {
    if (!single) html += `<h2 class="view-title">${i === 0 ? "Task 1" : "Task 2"} — ${esc(r.task.title)}</h2>`;
    html += reportHTML(r);
  });

  html += `<div class="result-actions">
    <button class="secondary-btn" id="againBtn" type="button">Practise again</button>
    <button class="primary-btn"   id="homeBtn"  type="button">Back to dashboard</button>
  </div>`;

  $("#resultBody").innerHTML = html;
  bindModelToggle();
  bindIterateActions(records);
  $("#againBtn").onclick = () => openPicker(records[0].task.type);
  $("#homeBtn").onclick  = () => { show("home"); renderHome(); };
}

function reportHTML(r) {
  const m = r.mark, type = r.task.type;
  const order = [
    ["task",                       type === "task1" ? "Task Achievement" : "Task Response"],
    ["coherence_cohesion",         "Coherence & Cohesion"],
    ["lexical_resource",           "Lexical Resource"],
    ["grammatical_range_accuracy", "Grammatical Range & Accuracy"],
  ];

  let html = `<div class="crit-grid">${order.map(([k, name]) => {
    const c = m.criteria[k] || { band: 0, evidence: "" };
    return `<div class="crit">
      <div class="crit-head">
        <span class="crit-name">${esc(name)}</span>
        <span class="crit-band">${c.band}</span>
      </div>
      <div class="crit-meter"><i style="width:${(c.band / 9 * 100).toFixed(0)}%"></i></div>
      <div class="crit-evidence">${esc(c.evidence)}</div>
    </div>`;
  }).join("")}</div>`;

  html += `<div class="result-section">
    <h3>Examiner's summary</h3>
    <p style="font-size:14px;line-height:1.55;color:var(--muted)">${esc(m.examiner_summary)}</p>
  </div>`;

  if (m.key_strengths && m.key_strengths.length)
    html += `<div class="result-section">
      <h3>What's working</h3>
      <ul style="margin:0;padding-left:18px">${m.key_strengths.map((s) =>
        `<li style="margin-bottom:6px;font-size:14px;line-height:1.5">${esc(s)}</li>`).join("")}</ul>
    </div>`;

  if (m.priority_fixes && m.priority_fixes.length)
    html += `<div class="result-section">
      <h3>Fix these first (biggest band gains)</h3>
      ${m.priority_fixes.map((f) => `<div class="fix">
        <div class="fix-issue">${esc(f.issue)}</div>
        <div class="fix-why">${esc(f.why)}</div>
        <div class="fix-how">→ ${esc(f.fix)}</div>
        ${f.example ? `<div class="fix-eg">${esc(f.example)}</div>` : ""}
      </div>`).join("")}
    </div>`;

  if (m.upgrade_edits && m.upgrade_edits.length)
    html += `<div class="result-section">
      <h3>Your essay, one band higher — apply the edits, then re-mark</h3>
      <p class="section-lead">Apply any surgical edit below. The patch goes into <b>your own</b> essay text. Apply a few, hit Re-mark, and watch the band move.</p>
      ${m.upgrade_edits.map((e, ei) => `<div class="upgrade" data-edit-task="${esc(r.task.id)}" data-edit-idx="${ei}">
        <span class="upg-tag">${esc(e.criterion)}</span>
        <div class="upg-pair">
          <div class="upg-before">${esc(e.before)}</div>
          <div class="upg-after">${esc(e.after)}</div>
        </div>
        <div class="upg-row">
          <span class="upg-why">${esc(e.why)}</span>
          <button class="upg-apply" type="button"
                  data-apply-task="${esc(r.task.id)}" data-apply-idx="${ei}">Apply</button>
        </div>
      </div>`).join("")}
      <div class="remark-bar" data-remark-task="${esc(r.task.id)}" hidden>
        <span class="remark-status" id="remarkStatus-${esc(r.task.id)}">0 edits applied</span>
        <button class="primary-btn" type="button" data-remark="${esc(r.task.id)}">Re-mark with my edits ▸</button>
      </div>
    </div>`;

  if (m.recurring_patterns && m.recurring_patterns.length)
    html += `<div class="result-section">
      <h3>Your recurring patterns — the Coach is tracking these</h3>
      ${m.recurring_patterns.map((p) => `<div class="pattern">
        <div class="pat-name">${esc(p.name)}</div>
        <div class="pat-rule">${esc(p.rule)}</div>
        <div class="pat-eg">"${esc(p.example)}"</div>
        <div class="pat-fix">${esc(p.fix)}</div>
      </div>`).join("")}
    </div>`;

  html += `<div class="result-section">
    <h3>To reach the next half-band</h3>
    <p style="font-size:14px;line-height:1.55;color:var(--muted)">${esc(m.next_band_advice)}</p>
  </div>`;

  html += `<div class="result-section">
    <h3>Your answer, with errors highlighted</h3>
    <p class="section-lead">Hover a <mark class="redpen">highlight</mark> to see the proposed fix.</p>
    <div class="your-answer">${redPen(r.answer, m.upgrade_edits || [])}</div>
  </div>`;

  html += modelAnswerHTML(r.task);
  return html;
}

function redPen(answer, edits) {
  let html = esc(answer);
  const placed = [];
  edits.forEach((e, i) => {
    if (!e || !e.before) return;
    const needle = esc(e.before);
    const idx = html.indexOf(needle);
    if (idx < 0) return;
    html = html.slice(0, idx) + `${i}` + html.slice(idx + needle.length);
    placed.push({ i, needle, e });
  });
  placed.forEach(({ i, needle, e }) => {
    const tip = esc((e.after ? "→ " + e.after : "") + (e.why ? " · " + e.why : ""));
    html = html.replace(`${i}`, `<mark class="redpen" title="${tip}">${needle}</mark>`);
  });
  return html.replace(/\n/g, "<br>");
}

function modelAnswerHTML(t) {
  if (!t.modelAnswer) return "";
  return `<div class="result-section">
    <button class="model-toggle" data-model="${esc(t.id)}" type="button">Show a band-8+ model answer ▾</button>
    <div class="model-answer" id="ma-${esc(t.id)}" hidden>${esc(t.modelAnswer)}</div>
  </div>`;
}
function bindModelToggle() {
  $$("[data-model]").forEach((btn) => {
    btn.onclick = () => {
      const el = $("#ma-" + btn.dataset.model);
      el.hidden = !el.hidden;
      btn.textContent = el.hidden ? "Show a band-8+ model answer ▾" : "Hide model answer ▴";
    };
  });
}

/* ============================== ITERATE LOOP ============================== */

const iterate = {};  // taskId -> { workingAnswer, applied: Set<number> }

function bindIterateActions(records) {
  records.forEach((r) => {
    const tid = r.task.id;
    if (!iterate[tid]) iterate[tid] = { workingAnswer: r.answer, applied: new Set() };
    $$(`[data-apply-task="${tid}"]`).forEach((btn) => {
      const idx = +btn.dataset.applyIdx;
      if (iterate[tid].applied.has(idx)) {
        btn.textContent = "✓ Applied"; btn.disabled = true; btn.classList.add("applied");
      }
      btn.onclick = () => {
        if (iterate[tid].applied.has(idx)) return;
        const edit = r.mark.upgrade_edits[idx];
        if (!edit) return;
        const w = iterate[tid].workingAnswer;
        if (!w.includes(edit.before)) {
          toast("That phrase has already been replaced by another edit.");
          btn.disabled = true; return;
        }
        iterate[tid].workingAnswer = w.replace(edit.before, edit.after);
        iterate[tid].applied.add(idx);
        btn.textContent = "✓ Applied"; btn.disabled = true; btn.classList.add("applied");
        const bar    = document.querySelector(`[data-remark-task="${tid}"]`);
        const status = document.getElementById(`remarkStatus-${tid}`);
        if (bar) bar.hidden = false;
        if (status) {
          const n = iterate[tid].applied.size;
          status.textContent = `${n} edit${n === 1 ? "" : "s"} applied · word count ${wordsOf(iterate[tid].workingAnswer)}`;
        }
      };
    });
    const remarkBtn = document.querySelector(`[data-remark="${tid}"]`);
    if (remarkBtn) {
      remarkBtn.onclick = async () => {
        const patched   = iterate[tid].workingAnswer;
        const newRecord = { task: r.task, answer: patched, wordCount: wordsOf(patched) };
        const prevBand  = r.mark.band;
        $("#resultBody").innerHTML = markingSpinner("Re-marking with your edits applied…");
        startTicker();
        try {
          newRecord.mark = await markEssay(newRecord);
          stopTicker();
          saveAttempt(newRecord);
          afterMarkAchievements([newRecord]);
          iterate[tid] = { workingAnswer: patched, applied: new Set() };
          renderResultWithDelta([newRecord], prevBand);
        } catch (err) {
          stopTicker();
          if (err && err.code === "NEEDS_KEY") renderNoKey([newRecord]);
          else renderMarkError(err, [newRecord]);
        }
      };
    }
  });
}

function renderResultWithDelta(records, prevBand) {
  renderResult(records);
  const r = records[0];
  const delta = round05(r.mark.band - prevBand);
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
  const cls   = delta > 0 ? "up" : delta < 0 ? "down" : "";
  const sub   = delta > 0
    ? `Up ${delta.toFixed(1)} band by applying your edits. This is the path up — keep going.`
    : delta === 0
    ? "Same band — apply the rest of the edits, or extend under-developed paragraphs by 40-60 words."
    : "Some edits introduced new issues. Review which ones, and keep edits minimal.";
  const banner = document.createElement("div");
  banner.className = "delta-banner";
  banner.innerHTML = `<b class="${cls}">${arrow} Band ${fmtBand(prevBand)} → ${fmtBand(r.mark.band)}</b>
    <span class="delta-sub">${esc(sub)}</span>`;
  const body = $("#resultBody");
  body.insertBefore(banner, body.firstChild);
}

/* ============================== HISTORY ============================== */

function renderHistory() {
  const marked = store.history.filter((h) => h.band != null);
  renderProgressChart(marked, "#historyChartPanel", "#historyChart", null);
  const list = $("#historyList");
  if (!store.history.length) {
    list.innerHTML = `<p style="color:var(--muted)">No attempts yet. Your band history will appear here.</p>`;
  } else {
    list.innerHTML = store.history.slice().reverse().map(attemptRow).join("");
    bindAttemptRows(list);
  }
  show("history");
}

/* ============================== COACH ============================== */

function renderCoach() {
  const marked = store.history.filter((h) => h.band != null);
  const body = $("#coachBody");

  if (!marked.length) {
    body.innerHTML = `<div class="result-hero">
      <div class="result-hero-label">Your AI Coach</div>
      <div class="result-hero-band">🧠</div>
      <div class="result-hero-target">Submit a couple of essays and your Coach will learn your patterns, then build the path to band ${fmtBand(store.settings.target)}.</div>
    </div>`;
    show("coach"); return;
  }

  const tally = {};
  marked.forEach((h) => {
    const ps = h.mark && h.mark.recurring_patterns;
    if (!ps) return;
    ps.forEach((p) => {
      const key = (p.name || "").trim().toLowerCase();
      if (!key) return;
      if (!tally[key]) tally[key] = { name: p.name, count: 0, rule: p.rule, fix: p.fix, example: p.example };
      tally[key].count += 1;
      Object.assign(tally[key], { rule: p.rule, fix: p.fix, example: p.example });
    });
  });
  const patterns = Object.values(tally).sort((a, b) => b.count - a.count);

  const best   = Math.max(...marked.map((h) => h.band));
  const recent = marked.slice(-3);
  const recentAvg = recent.reduce((a, h) => a + h.band, 0) / recent.length;
  const target = store.settings.target;
  let status, klass;
  if (recentAvg >= target)               { status = "On track — you're hitting your target in recent essays. Keep it stable under exam pressure."; klass = "hit"; }
  else if (recentAvg >= target - 0.5)    { status = "Almost there — about half a band to go. The patterns below are what stand between you and it."; klass = "miss"; }
  else                                   { status = "Building — keep practising. Your Coach has found exactly what to work on first."; klass = "miss"; }

  const top = patterns[0];
  let html = `<h2 class="view-title">Your Coach</h2>
    <div class="result-hero">
      <div class="result-hero-label">Recent form</div>
      <div class="result-hero-band">${fmtBand(round05(recentAvg))}</div>
      <div class="result-hero-target"><b class="${klass}">Target ${fmtBand(target)}</b> · best so far ${fmtBand(best)}</div>
      <div class="result-hero-note">${esc(status)}</div>
    </div>`;

  if (top) {
    html += `<div class="focus-banner" style="margin-bottom:18px">
      <span class="focus-icon">●</span>
      <span>The #1 thing between you and band ${fmtBand(target)} right now: <b>${esc(top.name)}</b> — appeared in ${top.count} of your essays. ${esc(top.fix || "")}</span>
    </div>`;
  }

  html += `<div class="panel">
    <div class="panel-head"><h2>Band over time</h2></div>
    <div class="progress-chart" id="coachChart"></div>
  </div>`;

  html += `<div class="result-section">
    <h3>Your language fingerprint</h3>
    <p class="section-lead">The habits that keep showing up in your writing, most frequent first. Beat these and your band moves.</p>
    ${patterns.map((p) => `<div class="pattern">
      <div class="pat-name">${esc(p.name)} <span class="pat-count">×${p.count}</span></div>
      ${p.rule    ? `<div class="pat-rule">${esc(p.rule)}</div>` : ""}
      ${p.example ? `<div class="pat-eg">"${esc(p.example)}"</div>` : ""}
      ${p.fix     ? `<div class="pat-fix">${esc(p.fix)}</div>` : ""}
    </div>`).join("")}
  </div>`;

  html += `<div class="result-actions">
    <button class="primary-btn" id="coachPractise" type="button">Practise Task 2 now →</button>
  </div>`;

  body.innerHTML = html;
  if (marked.length >= 2) {
    $("#coachChart").innerHTML = bandSpark(marked.slice(-12).map((h) => h.band), target);
  } else {
    $("#coachChart").innerHTML = `<p class="section-lead">One more marked essay unlocks your trend line.</p>`;
  }
  $("#coachPractise").onclick = () => openPicker("task2");
  show("coach");
}

/* ============================== SETTINGS ============================== */

function openSettings() {
  const s = store.settings;
  $("#setName").value   = s.name || "";
  $("#setTarget").value = fmtBand(s.target);
  if ($("#setModel")) $("#setModel").value = s.model;
  if ($("#setApiKey")) $("#setApiKey").value = s.apiKey || "";
  if ($("#setProxy"))  $("#setProxy").value  = s.proxyUrl || "";
  $("#settingsModal").hidden = false;
}

/* ============================== CD-IELTS HIDE ============================== */

function showHideOverlay() { $("#cdHideOverlay").hidden = false; }
function hideHideOverlay() { $("#cdHideOverlay").hidden = true;  }

/* ============================== BOOT / WIRING ============================== */

$("#brandHome").onclick   = () => { show("home"); renderHome(); };
$("#navSettings").onclick = openSettings;
$("#navHistory").onclick  = renderHistory;
$("#navCoach").onclick    = renderCoach;
$("#editTarget").onclick  = openSettings;
$$("[data-back]").forEach((b) => (b.onclick = () => { show("home"); renderHome(); }));
$$("[data-start]").forEach((b) => (b.onclick = () => openPicker(b.dataset.start)));

$("#examQuit").onclick = () => confirmDialog(
  "Quit this attempt? Your writing won't be saved.",
  () => { stopTimer(); show("home"); renderHome(); }
);
$("#examHelp").onclick = () => infoDialog(`
  <h3 style="margin:0 0 10px;font-size:16px;color:var(--text)">IELTS Writing exam</h3>
  <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:var(--muted)">
    <b style="color:var(--text)">Task 1</b> — describe a chart, graph, table or process. 150+ words in about 20 minutes.<br>
    <b style="color:var(--text)">Task 2</b> — write an essay in response to the prompt. 250+ words in about 40 minutes. <i>Task 2 counts twice.</i>
  </p>
  <p style="margin:0;font-size:13px;line-height:1.55;color:var(--muted)">
    Spell-check is off — same as the real exam.<br>
    Hide pauses the screen, but the clock keeps running.<br>
    Submit when finished — you'll get a band against the official descriptors.
  </p>`);
$("#examHide").onclick = showHideOverlay;
$("#cdResume").onclick = hideHideOverlay;
$("#submitBtn").onclick = () => doSubmit(false);

$("#settingsSave").onclick = () => {
  const s = store.settings;
  s.name = $("#setName").value.trim();
  s.target = parseFloat($("#setTarget").value);
  if ($("#setModel"))  s.model    = $("#setModel").value;
  if ($("#setApiKey")) s.apiKey   = $("#setApiKey").value.trim();
  if ($("#setProxy"))  s.proxyUrl = $("#setProxy").value.trim() || DEFAULT_PROXY_URL;
  save();
  $("#settingsModal").hidden = true;
  toast("Settings saved");
  renderHome();
};
$("#settingsClose").onclick = () => ($("#settingsModal").hidden = true);
$("#resetProgress").onclick = () => confirmDialog(
  "This deletes all your attempts, progress and saved key from this device. Continue?",
  () => {
    const owner = store.settings.ownerMode;
    store = defaults();
    store.settings.ownerMode = owner; // keep owner mode so the owner doesn't lose access
    save();
    $("#settingsModal").hidden = true;
    show("home"); renderHome();
    toast("All data cleared");
  }
);

// first render
renderHome();
show("home");

})();
