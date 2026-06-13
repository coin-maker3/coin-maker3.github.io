/* ============================================================================
   IELTS Writing Lab — application logic
   - Authentic exam timing (Task 1: 20 min / 150+ words, Task 2: 40 min / 250+,
     Full test: 60 min) with live word count.
   - Strict AI examiner powered by the real Claude model over the Anthropic API,
     grounded in the official public band descriptors (see tasks.js).
   - Engagement: streaks, target-band gap, milestones, band-over-time chart,
     and a "weakest criterion" focus so practice always has a next step.
   ========================================================================== */
(function () {
"use strict";

const { TASK1, TASK2, BAND_DESCRIPTORS } = window.IELTS_DATA;
const STORE_KEY = "ielts_lab_v1";
const API_URL = "https://api.anthropic.com/v1/messages";

/* ---------------------------------------------------------------- storage */
const defaultStore = () => ({
  settings: { name: "", target: 7.0, apiKey: "", model: "claude-opus-4-8" },
  history: [],            // {id, ts, taskId, type, title, answer, wordCount, mark|null, band|null}
  streak: { date: "", count: 0 },
  achievements: [],
});
let store = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!raw) return defaultStore();
    return Object.assign(defaultStore(), raw,
      { settings: Object.assign(defaultStore().settings, raw.settings || {}) });
  } catch { return defaultStore(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }

/* ----------------------------------------------------------------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wordsOf = (t) => (String(t).trim().match(/\S+/g) || []).length;
const round05 = (x) => Math.round(x * 2) / 2;
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtBand = (b) => (b == null ? "—" : Number(b).toFixed(1));
const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined,
  { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
function confirmDialog(text, onYes) {
  $("#confirmText").textContent = text;
  $("#confirmModal").hidden = false;
  $("#confirmYes").onclick = () => { $("#confirmModal").hidden = true; onYes(); };
  $("#confirmNo").onclick = () => { $("#confirmModal").hidden = true; };
}

/* ------------------------------------------------------------------ router */
const VIEWS = ["home", "picker", "exam", "result", "history"];
function show(view) {
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== view; });
  window.scrollTo(0, 0);
}

/* ============================================================ DASHBOARD === */
function renderHome() {
  const s = store.settings;
  $("#greeting").textContent = s.name
    ? `Welcome back, ${s.name}. Let’s climb to band ${fmtBand(s.target)}.`
    : "Let’s get you to your target band.";

  const marked = store.history.filter((h) => h.band != null);
  const best = marked.length ? Math.max(...marked.map((h) => h.band)) : null;
  $("#statBest").textContent = fmtBand(best);
  $("#statTarget").textContent = fmtBand(s.target);
  $("#statStreak").innerHTML = store.streak.count + '<span class="unit">d</span>';
  $("#statCount").textContent = marked.length;

  renderFocus(marked);
  renderProgressChart(marked, "#progressPanel", "#progressChart", "#progressNote");
  renderRecent();
  renderAchievements();

  // API hint
  $("#apiHint").innerHTML = s.apiKey
    ? `Examiner ready · using <b>${esc(s.model)}</b>`
    : `Add your Anthropic API key in <b>⚙︎ Settings</b> to switch on AI band scoring.`;
}

const FOCUS_TIPS = {
  task: "the task itself — answer every part directly and put a clear position/overview up front.",
  coherence_cohesion: "linking and paragraphing — one clear idea per paragraph, varied linkers (not just 'firstly/secondly').",
  lexical_resource: "vocabulary — use precise, less-common words and natural collocations instead of repeating basic ones.",
  grammatical_range_accuracy: "grammar — write more complex sentences that are fully error-free; band 7 needs frequent error-free sentences.",
};
function critLabel(key, type) {
  if (key === "task") return type === "task1" ? "Task Achievement" : "Task Response";
  return BAND_DESCRIPTORS[key].name;
}
function renderFocus(marked) {
  const banner = $("#focusBanner");
  if (marked.length < 1) { banner.hidden = true; return; }
  const recent = marked.slice(-5);
  const sums = {}, counts = {};
  recent.forEach((h) => {
    const c = h.mark && h.mark.criteria; if (!c) return;
    ["task", "coherence_cohesion", "lexical_resource", "grammatical_range_accuracy"].forEach((k) => {
      if (c[k] && typeof c[k].band === "number") {
        sums[k] = (sums[k] || 0) + c[k].band; counts[k] = (counts[k] || 0) + 1;
      }
    });
  });
  let worst = null, worstAvg = 99;
  Object.keys(sums).forEach((k) => {
    const a = sums[k] / counts[k]; if (a < worstAvg) { worstAvg = a; worst = k; }
  });
  if (!worst) { banner.hidden = true; return; }
  const type = recent[recent.length - 1].type;
  $("#focusText").innerHTML =
    `Your weakest area right now is <b>${esc(critLabel(worst, type))}</b> ` +
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
  return `<div class="attempt" data-id="${h.id}">
    <div class="attempt-band">${fmtBand(h.band)}</div>
    <div class="attempt-meta"><div class="t">${esc(h.title)}</div>
      <div class="d">${h.type === "task1" ? "Task 1" : "Task 2"} · ${fmtDate(h.ts)} · ${h.wordCount} words</div></div>
    ${h.mark ? '<button class="attempt-view">View</button>' : '<span class="d">not marked</span>'}
  </div>`;
}
function bindAttemptRows(root) {
  $$(".attempt", root).forEach((row) => {
    const btn = $(".attempt-view", row); if (!btn) return;
    btn.onclick = () => {
      const h = store.history.find((x) => x.id === row.dataset.id);
      if (h && h.mark) { renderResult([{ task: taskById(h.taskId), answer: h.answer, wordCount: h.wordCount, mark: h.mark }]); show("result"); }
    };
  });
}

const ACHIEVEMENTS = [
  { id: "first_submit", ico: "✍️", name: "First step", desc: "Submit your first answer" },
  { id: "first_mark", ico: "🎓", name: "Marked", desc: "Get your first AI band" },
  { id: "five", ico: "🖐️", name: "Getting serious", desc: "Write 5 answers" },
  { id: "band6", ico: "📗", name: "Band 6.0", desc: "Reach band 6.0" },
  { id: "band65", ico: "📘", name: "Band 6.5", desc: "Reach band 6.5" },
  { id: "band7", ico: "🏅", name: "Band 7 club", desc: "Reach band 7.0" },
  { id: "band75", ico: "🏆", name: "Band 7.5+", desc: "Reach band 7.5 or above" },
  { id: "streak3", ico: "🔥", name: "3-day streak", desc: "Practise 3 days running" },
  { id: "streak7", ico: "⚡", name: "7-day warrior", desc: "Practise 7 days running" },
  { id: "pb", ico: "📈", name: "Personal best", desc: "Beat your best band" },
];
function renderAchievements() {
  $("#achievements").innerHTML = ACHIEVEMENTS.map((a) => {
    const got = store.achievements.includes(a.id);
    return `<div class="ach ${got ? "unlocked" : ""}">
      <span class="ach-ico">${a.ico}</span>
      <span class="ach-txt"><b>${esc(a.name)}</b>${esc(a.desc)}</span></div>`;
  }).join("");
}
function unlock(id) {
  if (store.achievements.includes(id)) return;
  store.achievements.push(id); save();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a) toast(`${a.ico} Milestone unlocked — ${a.name}`);
}

/* progress chart (also used in History) */
function renderProgressChart(marked, panelSel, chartSel, noteSel) {
  const panel = $(panelSel);
  if (marked.length < 2) { if (panel) panel.hidden = true; return; }
  if (panel) panel.hidden = false;
  const pts = marked.slice(-12).map((h) => h.band);
  if (noteSel) {
    const delta = pts[pts.length - 1] - pts[0];
    $(noteSel).textContent = delta > 0 ? `▲ up ${delta.toFixed(1)} band since you started`
      : delta < 0 ? `${delta.toFixed(1)} band — keep going` : "holding steady";
  }
  $(chartSel).innerHTML = lineSpark(pts, store.settings.target);
}
function lineSpark(values, target) {
  const W = 320, H = 120, pl = 24, pb = 18, pt = 10, pr = 8;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const lo = 4, hi = 9;
  const x = (i) => pl + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const y = (v) => pt + plotH - ((v - lo) / (hi - lo)) * plotH;
  let grid = "";
  [5, 6, 7, 8, 9].forEach((g) => {
    grid += `<line x1="${pl}" y1="${y(g)}" x2="${W - pr}" y2="${y(g)}" stroke="#243152" stroke-width="1"/>
      <text x="2" y="${y(g) + 3}" font-size="8">${g}</text>`;
  });
  const tgt = target >= lo && target <= hi
    ? `<line x1="${pl}" y1="${y(target)}" x2="${W - pr}" y2="${y(target)}" stroke="#ffb454" stroke-dasharray="4 3" stroke-width="1"/>` : "";
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="#7cc4ff"/>`).join("");
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%">${grid}${tgt}
    <path d="${path}" fill="none" stroke="#5b8cff" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}

/* ============================================================== PICKER === */
let pickerMode = "task2";
function openPicker(mode) {
  pickerMode = mode;
  if (mode === "full") { startExam("full"); return; } // full test: no per-task pick
  const list = mode === "task1" ? TASK1 : TASK2;
  $("#pickerTitle").textContent = mode === "task1"
    ? "Task 1 — describe the visual" : "Task 2 — write the essay";
  let html = `<button class="picker-card picker-random" data-pick="__random">
    <div class="picker-thumb">🎲</div>
    <div class="picker-info"><div class="pk">Recommended</div>
      <div class="pt">Surprise me</div>
      <div class="pd">Get a random ${mode === "task1" ? "Task 1 chart" : "Task 2 question"} — closest to real exam conditions.</div></div></button>`;
  html += list.map((t) => `<button class="picker-card" data-pick="${t.id}">
    <div class="picker-thumb">${mode === "task1" ? thumbFor(t) : "📝"}</div>
    <div class="picker-info"><div class="pk">${esc(t.qType || t.chartKind || "")}</div>
      <div class="pt">${esc(t.title)}</div>
      <div class="pd">${esc(stripPrompt(t.prompt))}</div></div></button>`).join("");
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
const stripPrompt = (p) => String(p).replace(/\s+/g, " ").slice(0, 120) + "…";
function thumbFor(t) { return renderChart(t.chart, true); }

/* =============================================================== EXAM ==== */
const exam = { tasks: [], answers: [], active: 0, mode: "single", remaining: 0, timer: null };

function taskById(id) { return TASK1.concat(TASK2).find((t) => t.id === id); }
function taskMins(type) { return type === "task1" ? 20 : 40; }
function taskMin(type) { return type === "task1" ? 150 : 250; }

function startExam(mode, id) {
  exam.mode = mode; exam.active = 0;
  if (mode === "full") {
    exam.tasks = [
      TASK1[Math.floor(Math.random() * TASK1.length)],
      TASK2[Math.floor(Math.random() * TASK2.length)],
    ];
    exam.remaining = 60 * 60;
  } else {
    exam.tasks = [taskById(id)];
    exam.remaining = taskMins(exam.tasks[0].type) * 60;
  }
  exam.answers = exam.tasks.map(() => "");
  buildExamUI();
  show("exam");
  $("#answerBox").focus();
  startTimer();
}

function buildExamUI() {
  const multi = exam.tasks.length > 1;
  // tabs
  const stimTabs = $("#stimTabs"), writeTabs = $("#writeTabs");
  if (multi) {
    stimTabs.hidden = writeTabs.hidden = false;
    const mk = (cls) => exam.tasks.map((t, i) =>
      `<button class="${cls} ${i === exam.active ? "active" : ""}" data-tab="${i}">${i === 0 ? "Task 1" : "Task 2"}</button>`).join("");
    stimTabs.innerHTML = mk("stim-tab"); writeTabs.innerHTML = mk("write-tab");
    $$("[data-tab]").forEach((b) => (b.onclick = () => switchTab(+b.dataset.tab)));
  } else { stimTabs.hidden = writeTabs.hidden = true; }
  loadActive();
}
function switchTab(i) {
  exam.answers[exam.active] = $("#answerBox").value;
  exam.active = i;
  $$(".stim-tab, .write-tab").forEach((b) => b.classList.toggle("active", +b.dataset.tab === i));
  loadActive();
}
function loadActive() {
  const t = exam.tasks[exam.active];
  $("#examPhase").textContent = t.type === "task1" ? "Task 1" : "Task 2";
  $("#stimScroll").innerHTML = stimulusHTML(t);
  const box = $("#answerBox");
  box.value = exam.answers[exam.active];
  box.oninput = onAnswerInput;
  $("#examFootHint").textContent = t.type === "task1"
    ? "Aim for 170–190 words in ~20 min." : "Aim for 260–290 words in ~40 min.";
  updateWordCount();
}
function stimulusHTML(t) {
  let h = `<p class="task-prompt">${esc(t.prompt).replace(/\n\n/g, "<br><br>")}</p>`;
  if (t.type === "task1") {
    h += `<div class="chart-wrap"><div class="chart-title">${esc(t.title)}</div>${renderChart(t.chart)}</div>`;
  }
  h += `<p class="task-rubric">${esc(t.instruction)}</p>`;
  return h;
}
function onAnswerInput() { exam.answers[exam.active] = $("#answerBox").value; updateWordCount(); }
function updateWordCount() {
  const t = exam.tasks[exam.active];
  const n = wordsOf($("#answerBox").value);
  const min = taskMin(t.type);
  $("#wordCount").textContent = n;
  $("#wordsTarget").textContent = `/ ${min} min`;
  $(".exam-words").classList.toggle("ok", n >= min);
}
function startTimer() {
  updateTimer();
  exam.timer = setInterval(() => {
    exam.remaining--; updateTimer();
    if (exam.remaining <= 0) {
      clearInterval(exam.timer);
      toast("Time’s up — submitting your work.");
      doSubmit(true);
    }
  }, 1000);
}
function updateTimer() {
  const m = Math.floor(exam.remaining / 60), s = exam.remaining % 60;
  const el = $("#examTimer");
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("warn", exam.remaining <= 300 && exam.remaining > 60);
  el.classList.toggle("danger", exam.remaining <= 60);
}
function stopTimer() { if (exam.timer) clearInterval(exam.timer); exam.timer = null; }

$("#examQuit").onclick = () => confirmDialog(
  "Quit this attempt? Your writing won’t be saved.", () => { stopTimer(); show("home"); renderHome(); });

$("#submitBtn").onclick = () => doSubmit(false);

function doSubmit(auto) {
  // capture current tab
  exam.answers[exam.active] = $("#answerBox").value;
  // under-length / empty checks (skip if auto-submit by timer)
  const tooShort = exam.tasks.some((t, i) => wordsOf(exam.answers[i]) < taskMin(t.type));
  const empty = exam.answers.some((a) => wordsOf(a) < 20);
  if (!auto && empty) { toast("Write a bit more before submitting."); return; }
  if (!auto && tooShort) {
    confirmDialog("You’re under the recommended word count. That genuinely lowers your band — the examiner won’t pretend otherwise. Submit anyway?",
      () => finishSubmit());
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
  // Always attempt marking: markOne uses the device key if set, otherwise the
  // secure server endpoint (/api/mark). If neither is available it raises a
  // NEEDS_KEY error and markAll shows the "add a key" screen.
  markAll(records);
}
function recordStreak() {
  const t = todayStr();
  if (store.streak.date === t) { /* already today */ }
  else {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    store.streak.count = (store.streak.date === y) ? store.streak.count + 1 : 1;
    store.streak.date = t;
  }
  if (store.streak.count >= 3) unlock("streak3");
  if (store.streak.count >= 7) unlock("streak7");
  save();
}

/* =========================================================== MARKING ===== */
async function markAll(records) {
  $("#resultBody").innerHTML = markingSpinner();
  startTicker();
  try {
    for (let i = 0; i < records.length; i++) {
      $("#tickerLabel").textContent = records.length > 1
        ? `Marking Task ${i + 1} of ${records.length}…` : "The examiner is reading your writing…";
      records[i].mark = await markOne(records[i]);
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
    ts: Date.now(), taskId: r.task.id, type: r.task.type, title: r.task.title,
    answer: r.answer, wordCount: r.wordCount, mark: r.mark, band: r.mark.band,
  });
  save();
}
function afterMarkAchievements(records) {
  unlock("first_mark");
  const marked = store.history.filter((h) => h.band != null);
  if (marked.length >= 5) unlock("five");
  const prevBest = Math.max(0, ...marked.slice(0, -records.length).map((h) => h.band));
  const best = Math.max(...marked.map((h) => h.band));
  if (best >= 6) unlock("band6");
  if (best >= 6.5) unlock("band65");
  if (best >= 7) unlock("band7");
  if (best >= 7.5) unlock("band75");
  if (best > prevBest && prevBest > 0) unlock("pb");
}

/* ---- the examiner prompt (grounded in official band descriptors) ---- */
function buildSystem(type) {
  const firstKey = "task";
  const firstName = type === "task1" ? "Task Achievement" : "Task Response";
  const firstDesc = type === "task1" ? BAND_DESCRIPTORS.task1 : BAND_DESCRIPTORS.task2;
  const crits = [
    [firstName, firstDesc],
    ["Coherence & Cohesion", BAND_DESCRIPTORS.coherence_cohesion],
    ["Lexical Resource", BAND_DESCRIPTORS.lexical_resource],
    ["Grammatical Range & Accuracy", BAND_DESCRIPTORS.grammatical_range_accuracy],
  ];
  let descBlock = crits.map(([name, d]) => {
    const lines = Object.keys(d.bands).sort((a, b) => b - a)
      .map((b) => `  Band ${b}: ${d.bands[b]}`).join("\n");
    return `${name}:\n${lines}`;
  }).join("\n\n");

  return [
    "You are a senior, certified IELTS Writing examiner. You mark to the official",
    "IELTS public band descriptors and you are CALIBRATED and CONSERVATIVE. Your job",
    "is to tell the candidate their TRUE level, never to flatter them.",
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
    "- 'evidence' for each criterion must refer to SPECIFIC wording from the script and",
    "  tie it to the descriptor. Be concrete, not generic.",
    "- corrected_sentences must take ACTUAL sentences from the candidate and correct them.",
    "- Be honest and practical, never harsh for its own sake, but never inflate a band.",
    "",
    "Return ONLY the structured JSON object requested.",
  ].join("\n");
}
function buildUser(r) {
  const t = r.task;
  let u = `TASK TYPE: IELTS Academic ${t.type === "task1" ? "Task 1" : "Task 2"}\n\n`;
  u += `QUESTION / PROMPT:\n${t.prompt}\n\n`;
  if (t.type === "task1" && t.dataFacts) {
    u += `WHAT THE VISUAL ACTUALLY SHOWS (use this to check the candidate's accuracy; the candidate could see the chart, not this text):\n${t.dataFacts}\n\n`;
  }
  u += `CANDIDATE'S ANSWER (${r.wordCount} words):\n"""\n${r.answer}\n"""`;
  return u;
}

const MARK_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    under_length: { type: "boolean" },
    criteria: {
      type: "object", additionalProperties: false,
      properties: {
        task: critSchema(), coherence_cohesion: critSchema(),
        lexical_resource: critSchema(), grammatical_range_accuracy: critSchema(),
      },
      required: ["task", "coherence_cohesion", "lexical_resource", "grammatical_range_accuracy"],
    },
    key_strengths: { type: "array", items: { type: "string" } },
    priority_fixes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { issue: { type: "string" }, why: { type: "string" }, fix: { type: "string" }, example: { type: "string" } },
        required: ["issue", "why", "fix", "example"],
      },
    },
    corrected_sentences: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { original: { type: "string" }, improved: { type: "string" } },
        required: ["original", "improved"],
      },
    },
    examiner_summary: { type: "string" },
    next_band_advice: { type: "string" },
  },
  required: ["under_length", "criteria", "key_strengths", "priority_fixes",
    "corrected_sentences", "examiner_summary", "next_band_advice"],
};
function critSchema() {
  return {
    type: "object", additionalProperties: false,
    properties: { band: { type: "integer" }, evidence: { type: "string" } },
    required: ["band", "evidence"],
  };
}

async function markOne(r) {
  const s = store.settings;
  const body = {
    model: s.model,
    max_tokens: 3500,
    system: buildSystem(r.task.type),
    messages: [{ role: "user", content: buildUser(r) }],
    output_config: { format: { type: "json_schema", schema: MARK_SCHEMA } },
  };
  if (!/haiku/.test(s.model)) body.output_config.effort = "high";

  // Two ways to reach the examiner:
  //  1) a key saved in this browser (Settings)  -> call Anthropic directly
  //  2) no device key                           -> call our own /api/mark,
  //     which uses the secure server key (Vercel env var). On a host with no
  //     backend (e.g. plain GitHub Pages) this 404s -> NEEDS_KEY -> add-key UI.
  const useDevice = !!s.apiKey;
  let res;
  if (useDevice) {
    res = await fetch(API_URL, {
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
      res = await fetch("/api/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      const e = new Error("offline"); e.code = "NEEDS_KEY"; throw e;
    }
    if (res.status === 404 || res.status === 503) {
      const e = new Error("no server key"); e.code = "NEEDS_KEY"; throw e;
    }
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try {
      const e = await res.json();
      const m = e.error && e.error.message ? e.error.message : "";
      if (res.status === 401) msg = "Your API key was rejected. Check it in Settings (it should start with sk-ant-).";
      else if (res.status === 400 && /credit|balance|billing/i.test(m)) msg = "Your Anthropic account needs credit/billing set up to use the API.";
      else if (res.status === 429) msg = "Rate limited by Anthropic — wait a moment and try again.";
      else if (m) msg = m;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("The model declined to mark this text. Try a different answer.");
  const block = (data.content || []).find((b) => b.type === "text");
  if (!block) throw new Error("No response from the examiner. Try again.");
  let mark;
  try { mark = JSON.parse(block.text); }
  catch { throw new Error("Couldn’t read the examiner’s response. Please try again."); }

  // compute the band ourselves from the four whole-band criteria (reliable arithmetic)
  const c = mark.criteria;
  const vals = ["task", "coherence_cohesion", "lexical_resource", "grammatical_range_accuracy"]
    .map((k) => c[k].band);
  mark.band = round05(vals.reduce((a, b) => a + b, 0) / 4);
  return mark;
}

/* ---- marking spinner / ticker ---- */
const TICKER = [
  "Reading for task achievement…", "Checking your overview and main ideas…",
  "Tracing coherence and paragraphing…", "Weighing vocabulary range and precision…",
  "Auditing grammar for error-free sentences…", "Comparing against the band descriptors…",
  "Calibrating an honest band — no inflation…",
];
let tickerInt, tickerI = 0;
function markingSpinner() {
  return `<div class="marking"><div class="spinner"></div>
    <p id="tickerLabel">The examiner is reading your writing…</p>
    <p class="ticker" id="tickerStep">${TICKER[0]}</p></div>`;
}
function startTicker() { tickerI = 0; tickerInt = setInterval(() => {
  tickerI = (tickerI + 1) % TICKER.length;
  const el = $("#tickerStep"); if (el) el.textContent = TICKER[tickerI];
}, 2200); }
function stopTicker() { clearInterval(tickerInt); }

function renderMarkError(err, records) {
  $("#resultBody").innerHTML = `<div class="panel">
    <h3>Couldn’t complete marking</h3>
    <p style="color:var(--muted)">${esc(err.message)}</p>
    <div class="result-actions">
      <button class="secondary-btn" id="errSettings">Open Settings</button>
      <button class="primary-btn" id="errRetry">Try again</button>
    </div></div>
    <div class="result-section"><h3>Your answer</h3>
      <div class="your-answer">${esc(records[0].answer)}</div></div>`;
  $("#errSettings").onclick = openSettings;
  $("#errRetry").onclick = () => markAll(records);
}

function renderNoKey(records) {
  const r = records[0];
  $("#resultBody").innerHTML = `<div class="panel">
    <h3>🔑 Add your key to get a band</h3>
    <p style="color:var(--muted)">The AI examiner needs your Anthropic API key to score this.
    It’s stored only on this device. Until then, here’s the examiner-standard model answer and a self-check.</p>
    <div class="result-actions"><button class="primary-btn" id="nkSettings">Add API key in Settings</button></div>
  </div>
  <div class="result-section"><h3>📝 Your answer (${r.wordCount} words)</h3>
    <div class="your-answer">${esc(r.answer) || "—"}</div></div>
  ${selfCheckHTML(r.task.type)}
  ${modelAnswerHTML(r.task)}`;
  $("#nkSettings").onclick = openSettings;
  bindModelToggle();
}
function selfCheckHTML(type) {
  const first = type === "task1" ? BAND_DESCRIPTORS.task1 : BAND_DESCRIPTORS.task2;
  const items = [
    [first.name, first.bands["7"]],
    ["Coherence & Cohesion", BAND_DESCRIPTORS.coherence_cohesion.bands["7"]],
    ["Lexical Resource", BAND_DESCRIPTORS.lexical_resource.bands["7"]],
    ["Grammatical Range & Accuracy", BAND_DESCRIPTORS.grammatical_range_accuracy.bands["7"]],
  ];
  return `<div class="result-section"><h3>✅ Band 7 self-check</h3>
    <div class="crit-grid">${items.map(([n, d]) =>
      `<div class="crit"><div class="crit-name">${esc(n)}</div>
       <div class="crit-comment">${esc(d)}</div></div>`).join("")}</div></div>`;
}

/* ============================================================ RESULT ===== */
function renderResult(records) {
  const single = records.length === 1;
  let combined = null;
  if (!single) {
    const t1 = records.find((r) => r.task.type === "task1").mark.band;
    const t2 = records.find((r) => r.task.type === "task2").mark.band;
    combined = round05((t1 + t2 * 2) / 3);
  }
  const headBand = single ? records[0].mark.band : combined;
  const target = store.settings.target;
  const hit = headBand >= target;

  let html = `<div class="result-hero">
    <div class="result-overall-label">${single ? "Estimated band" : "Overall Writing band"}</div>
    <div class="result-overall">${fmtBand(headBand)}</div>
    <div class="result-vs-target">${hit
      ? `<b class="hit">✓ at or above your target of ${fmtBand(target)}</b>`
      : `${(target - headBand).toFixed(1)} band below your target of <b class="miss">${fmtBand(target)}</b>`}</div>
    ${!single ? `<div class="marking-note">Task 1 ${fmtBand(records.find(r=>r.task.type==="task1").mark.band)} · Task 2 ${fmtBand(records.find(r=>r.task.type==="task2").mark.band)} (Task 2 counts double)</div>` : ""}
    <div class="marking-note">AI estimate using the official IELTS band descriptors. Real exams are marked by certified humans and can differ by ~0.5 band.</div>
  </div>`;

  records.forEach((r, i) => {
    if (!single) html += `<h2 style="margin:6px 2px 12px">${i === 0 ? "Task 1" : "Task 2"} — ${esc(r.task.title)}</h2>`;
    html += reportHTML(r);
  });

  html += `<div class="result-actions">
    <button class="secondary-btn" id="againBtn">Practise again</button>
    <button class="primary-btn" id="homeBtn">Back to dashboard</button>
  </div>`;

  $("#resultBody").innerHTML = html;
  bindModelToggle();
  $("#againBtn").onclick = () => openPicker(records[0].task.type);
  $("#homeBtn").onclick = () => { show("home"); renderHome(); };
}

function reportHTML(r) {
  const m = r.mark, type = r.task.type;
  const order = [
    ["task", type === "task1" ? "Task Achievement" : "Task Response"],
    ["coherence_cohesion", "Coherence & Cohesion"],
    ["lexical_resource", "Lexical Resource"],
    ["grammatical_range_accuracy", "Grammatical Range & Accuracy"],
  ];
  let html = `<div class="crit-grid">`;
  order.forEach(([k, name]) => {
    const c = m.criteria[k] || { band: 0, evidence: "" };
    html += `<div class="crit"><div class="crit-top">
      <span class="crit-name">${esc(name)}</span>
      <span class="crit-band">${c.band}</span></div>
      <div class="crit-meter"><i style="width:${(c.band / 9 * 100).toFixed(0)}%"></i></div>
      <div class="crit-comment">${esc(c.evidence)}</div></div>`;
  });
  html += `</div>`;

  html += `<div class="result-section"><h3>🧭 Examiner’s summary</h3>
    <p style="font-size:14px;line-height:1.55">${esc(m.examiner_summary)}</p></div>`;

  if (m.key_strengths && m.key_strengths.length)
    html += section("💪 What’s working", `<ul class="bullets">${m.key_strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`);

  if (m.priority_fixes && m.priority_fixes.length)
    html += section("🛠️ Fix these first (biggest band gains)",
      m.priority_fixes.map((f) => `<div class="fix">
        <div class="fix-issue">${esc(f.issue)}</div>
        <div class="fix-why">${esc(f.why)}</div>
        <div class="fix-how">→ ${esc(f.fix)}</div>
        ${f.example ? `<div class="fix-eg">${esc(f.example)}</div>` : ""}</div>`).join(""));

  if (m.corrected_sentences && m.corrected_sentences.length)
    html += section("✏️ Sentence corrections",
      m.corrected_sentences.map((c) => `<div class="correction">
        <div class="corr-orig">${esc(c.original)}</div>
        <div class="corr-new">${esc(c.improved)}</div></div>`).join(""));

  html += section("🎯 To reach the next half-band",
    `<p style="font-size:14px;line-height:1.55">${esc(m.next_band_advice)}</p>`);

  html += `<div class="result-section"><h3>📝 Your answer (${r.wordCount} words)</h3>
    <div class="your-answer">${esc(r.answer)}</div></div>`;
  html += modelAnswerHTML(r.task);
  return html;
}
function section(title, body) {
  return `<div class="result-section"><h3>${title}</h3>${body}</div>`;
}
function modelAnswerHTML(t) {
  if (!t.modelAnswer) return "";
  return `<div class="result-section">
    <button class="model-toggle" data-model="${t.id}">📖 Show a band-8+ model answer ▾</button>
    <div class="model-answer" id="ma-${t.id}" hidden>${esc(t.modelAnswer)}</div></div>`;
}
function bindModelToggle() {
  $$("[data-model]").forEach((btn) => {
    btn.onclick = () => {
      const el = $("#ma-" + btn.dataset.model);
      el.hidden = !el.hidden;
      btn.textContent = (el.hidden ? "📖 Show a band-8+ model answer ▾" : "📖 Hide model answer ▴");
    };
  });
}

/* ============================================================= HISTORY === */
function renderHistory() {
  const marked = store.history.filter((h) => h.band != null);
  renderProgressChart(marked, "#historyChartPanel", "#historyChart", null);
  const list = $("#historyList");
  if (!store.history.length) { list.innerHTML = `<p style="color:var(--muted)">No attempts yet. Your band history will appear here.</p>`; return; }
  list.innerHTML = store.history.slice().reverse().map(attemptRow).join("");
  bindAttemptRows(list);
  show("history");
}

/* ============================================================== CHARTS === */
function renderChart(chart, thumb) {
  switch (chart.kind) {
    case "line": return lineChart(chart, thumb);
    case "bar": return barChart(chart, thumb);
    case "table": return thumb ? "📋" : tableChart(chart);
    case "process": return thumb ? "🔄" : processChart(chart);
    case "pie": return pieChart(chart, thumb);
    default: return "";
  }
}
function legend(series) {
  return `<div class="chart-legend">${series.map((s) =>
    `<span><i class="legend-dot" style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}
function lineChart(c, thumb) {
  const W = 340, H = 200, pl = 30, pb = 24, pt = 10, pr = 12;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const xs = c.xLabels, n = xs.length;
  const x = (i) => pl + (i / (n - 1)) * plotW;
  const y = (v) => pt + plotH - (v / c.yMax) * plotH;
  let grid = "", ticks = c.yMax / 5;
  for (let g = 0; g <= c.yMax; g += ticks)
    grid += `<line x1="${pl}" y1="${y(g)}" x2="${W - pr}" y2="${y(g)}" stroke="#243152"/>
      <text x="2" y="${y(g) + 3}" font-size="9">${g}</text>`;
  let xlab = xs.map((l, i) => `<text x="${x(i)}" y="${H - 8}" font-size="9" text-anchor="middle">${esc(l)}</text>`).join("");
  let lines = c.series.map((s) => {
    const p = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const dots = thumb ? "" : s.values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join("");
    return `<path d="${p}" fill="none" stroke="${s.color}" stroke-width="${thumb ? 2 : 2.4}"/>${dots}`;
  }).join("");
  const svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%">${grid}${thumb ? "" : xlab}${lines}</svg>`;
  return thumb ? svg : svg + legend(c.series);
}
function barChart(c, thumb) {
  const W = 340, H = 200, pl = 30, pb = 30, pt = 10, pr = 12;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const cats = c.categories, ns = c.series.length;
  const groupW = plotW / cats.length, barW = (groupW * 0.7) / ns;
  const y = (v) => pt + plotH - (v / c.yMax) * plotH;
  let grid = "", ticks = c.yMax / 5;
  for (let g = 0; g <= c.yMax; g += ticks)
    grid += `<line x1="${pl}" y1="${y(g)}" x2="${W - pr}" y2="${y(g)}" stroke="#243152"/>
      <text x="2" y="${y(g) + 3}" font-size="9">${g}</text>`;
  let bars = "", labels = "";
  cats.forEach((cat, ci) => {
    const gx = pl + ci * groupW + groupW * 0.15;
    c.series.forEach((s, si) => {
      const v = s.values[ci], bx = gx + si * barW;
      bars += `<rect x="${bx.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(barW * 0.9).toFixed(1)}" height="${(pt + plotH - y(v)).toFixed(1)}" fill="${s.color}" rx="2"/>`;
    });
    if (!thumb) labels += `<text x="${(pl + ci * groupW + groupW / 2).toFixed(1)}" y="${H - 16}" font-size="8" text-anchor="middle">${esc(cat.length > 10 ? cat.slice(0, 9) + "…" : cat)}</text>`;
  });
  const svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%">${grid}${bars}${labels}</svg>`;
  return thumb ? svg : svg + legend(c.series);
}
function tableChart(c) {
  return `<table class="data-table"><thead><tr>${c.columns.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${c.rows.map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function processChart(c) {
  const steps = c.steps.map((s, i) => `<div class="proc-step">
    <span class="proc-num">${i + 1}</span><span>${esc(s)}</span></div>`).join("");
  return `<div class="proc-steps">${steps}</div>${c.cyclic ? '<div class="proc-cyclic">↻ the cycle then repeats</div>' : ""}`;
}
function pieChart(c, thumb) {
  if (thumb) return "🥧";
  const r = 54, cy = 72;
  const centers = c.charts.length === 2 ? [92, 248] : [170];
  let svg = `<svg class="chart-svg" viewBox="0 0 340 170" width="100%">`;
  c.charts.forEach((pie, pi) => {
    const cx = centers[pi];
    const total = pie.slices.reduce((a, s) => a + s.value, 0);
    let ang = -90;
    pie.slices.forEach((s) => {
      const sweep = (s.value / total) * 360;
      svg += arc(cx, cy, r, ang, ang + sweep, s.color);
      ang += sweep;
    });
    svg += `<text x="${cx}" y="${cy + r + 22}" font-size="11" text-anchor="middle" fill="#eaf0fb">${esc(pie.title)}</text>`;
  });
  svg += `</svg>`;
  return svg + legend(c.charts[0].slices.map((s) => ({ name: `${s.name}`, color: s.color })));
}
function arc(cx, cy, r, a0, a1, color) {
  const p0 = pol(cx, cy, r, a1), p1 = pol(cx, cy, r, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `<path d="M${cx},${cy} L${p0.x},${p0.y} A${r},${r} 0 ${large} 0 ${p1.x},${p1.y} Z" fill="${color}" stroke="#0f1626" stroke-width="1"/>`;
}
function pol(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: (cx + r * Math.cos(a)).toFixed(1), y: (cy + r * Math.sin(a)).toFixed(1) };
}

/* ============================================================ SETTINGS === */
function openSettings() {
  const s = store.settings;
  $("#setName").value = s.name || "";
  $("#setTarget").value = fmtBand(s.target);
  $("#setApiKey").value = s.apiKey || "";
  $("#setModel").value = s.model;
  $("#keyStatus").textContent = s.apiKey ? "✓ Key saved on this device" : "";
  $("#keyStatus").className = "key-status " + (s.apiKey ? "ok" : "");
  $("#settingsModal").hidden = false;
}
$("#settingsSave").onclick = () => {
  const s = store.settings;
  s.name = $("#setName").value.trim();
  s.target = parseFloat($("#setTarget").value);
  s.apiKey = $("#setApiKey").value.trim();
  s.model = $("#setModel").value;
  save();
  $("#settingsModal").hidden = true;
  toast("Settings saved");
  renderHome();
};
$("#settingsClose").onclick = () => ($("#settingsModal").hidden = true);
$("#resetProgress").onclick = () => confirmDialog(
  "This deletes all your attempts, progress and saved key from this device. Continue?",
  () => { store = defaultStore(); save(); $("#settingsModal").hidden = true; renderHome(); show("home"); toast("All data cleared"); });

/* ============================================================== WIRING ==== */
$("#brandHome").onclick = () => { show("home"); renderHome(); };
$("#navSettings").onclick = openSettings;
$("#navHistory").onclick = renderHistory;
$("#editTarget").onclick = openSettings;
$$("[data-back]").forEach((b) => (b.onclick = () => { show("home"); renderHome(); }));
$$("[data-start]").forEach((b) => (b.onclick = () => openPicker(b.dataset.start)));

// first-run: prefill target select default
renderHome();
show("home");

})();
