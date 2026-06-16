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
const { TASK1, TASK2, BAND_DESCRIPTORS, MODULES } = window.IELTS_DATA;

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
    drills: [],                        // drill attempts: {ts, pattern, score, total}
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

/* postWithRetry — wrap a JSON POST in one transparent retry on 5xx or
   network failures, with 1.5s backoff. Handles Anthropic transient blips
   and the Firebase Cloud Function's cold start (which can occasionally
   exceed the client's timeout perception even though the request succeeds
   server-side). Anything 4xx is returned as-is — no retry. */
async function postWithRetry(url, opts) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status >= 500 && res.status < 600 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error("network");
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

const VIEWS = ["home", "picker", "exam", "result", "history", "coach", "drill", "vault", "staged", "learn", "module"];
const NAV_FOR_VIEW = {
  learn:  "navLearn",
  module: "navLearn",
  coach:  "navCoach",
  drill:  "navCoach",
  history:"navHistory",
  vault:  "navVault",
};
function show(view) {
  // hide the topbar while exam is up (CD-IELTS owns the screen)
  $("#topbar").hidden = view === "exam";
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== view; });
  // Topbar highlight: only the nav button matching the active view gets the
  // brand colour. Previously the Learn button was always highlighted because
  // it had a permanent .primary-nav class.
  $$(".topnav .ghost-btn").forEach((b) => b.classList.remove("active"));
  const navId = NAV_FOR_VIEW[view];
  if (navId) { const b = document.getElementById(navId); if (b) b.classList.add("active"); }
  window.scrollTo(0, 0);
}

/* ============================== OWNER UI ============================== */

function applyOwnerUI() {
  const owner = !!store.settings.ownerMode;
  // Settings is visible to everyone — Saja can change her name + target
  // and reset her own progress. The owner-only fields (API key, model,
  // proxy URL) stay hidden for non-owner sessions.
  $("#navSettings").hidden     = false;
  $("#editTarget").hidden      = false;
  $("#ownerOnlyFields").hidden = !owner;
  $("#resetProgress").hidden   = false;
  // Vault button is shown once the candidate has any tracked spellings.
  const v = vaultStats();
  $("#navVault").hidden = v.total === 0;
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
  renderLearnCtaProgress();
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
  bindAttemptRows(list, renderHome);
}
function attemptRow(h) {
  const owner = !!store.settings.ownerMode;
  return `<div class="attempt" data-id="${esc(h.id)}">
    <div class="attempt-band">${fmtBand(h.band)}</div>
    <div class="attempt-meta">
      <div class="attempt-title">${esc(h.title)}</div>
      <div class="attempt-sub">${h.type === "task1" ? "Task 1" : "Task 2"} · ${esc(fmtDate(h.ts))} · ${h.wordCount} words</div>
    </div>
    ${h.mark ? `<button class="attempt-view" type="button">View</button>` : `<span class="attempt-sub">not marked</span>`}
    ${owner ? `<button class="attempt-delete" type="button" title="Delete this attempt (owner only)">✕</button>` : ""}
  </div>`;
}
function bindAttemptRows(root, refresh) {
  $$(".attempt", root).forEach((row) => {
    const view = $(".attempt-view", row);
    if (view) {
      view.onclick = (e) => {
        e.stopPropagation();
        const h = store.history.find((x) => x.id === row.dataset.id);
        if (h && h.mark) {
          renderResult([{ task: taskById(h.taskId), answer: h.answer, wordCount: h.wordCount, mark: h.mark }]);
          show("result");
        }
      };
    }
    const del = $(".attempt-delete", row);
    if (del) {
      del.onclick = (e) => {
        e.stopPropagation();
        confirmDialog(
          "Delete this attempt? It will be removed from history, the Coach's pattern aggregation, and the spelling vault.",
          () => {
            deleteAttempt(row.dataset.id);
            toast("Attempt deleted — Saja's progression is clean.");
            if (typeof refresh === "function") refresh();
          }
        );
      };
    }
  });
}

/* Owner-only: delete a single attempt and back the vault out cleanly so
   the Coach + trajectory + vault never see Ali's testing entries. */
function deleteAttempt(id) {
  const idx = store.history.findIndex((h) => h.id === id);
  if (idx < 0) return;
  const deleted = store.history[idx];
  store.history.splice(idx, 1);
  // Vault cleanup: for each misspelling in the deleted mark, recompute
  // whether the word still appears in any remaining marked attempt.
  if (deleted && deleted.mark && Array.isArray(deleted.mark.misspellings) && store.vault && store.vault.words) {
    const stillNeeded = new Set();
    store.history.forEach((h) => {
      const ms = h.mark && h.mark.misspellings;
      if (!ms) return;
      ms.forEach((m) => {
        const k = String(m.correct || "").trim().toLowerCase();
        if (k) stillNeeded.add(k);
      });
    });
    deleted.mark.misspellings.forEach((m) => {
      const k = String(m.correct || "").trim().toLowerCase();
      if (!k) return;
      if (!stillNeeded.has(k)) {
        delete store.vault.words[k];
      } else {
        const entry = store.vault.words[k];
        if (entry && entry.essays_seen_in > 0) entry.essays_seen_in -= 1;
      }
    });
  }
  save();
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

function renderLearnCtaProgress() {
  const el = $("#learnCtaProgress");
  if (!el) return;
  if (!Array.isArray(MODULES)) { el.innerHTML = ""; return; }
  const total = MODULES.length;
  const mastered = MODULES.filter((m) => moduleState(m.id).mastered).length;
  const inProgress = MODULES.filter((m) => {
    const st = moduleState(m.id);
    return !st.mastered && st.correct > 0;
  }).length;
  el.innerHTML = `<div class="learn-cta-mastered">${mastered}<span>/${total}</span></div>
    <div class="learn-cta-prog-label">mastered</div>
    ${inProgress > 0 ? `<div class="learn-cta-prog-sub">+${inProgress} in progress</div>` : ""}`;
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

let pickerSessionMode = "exam";  // "exam" (one-shot 40 min) or "practice" (staged plan-then-write)

function openPicker(mode) {
  if (mode === "full") { startExam("full"); return; }
  const list = mode === "task1" ? TASK1 : TASK2;
  $("#pickerTitle").textContent = mode === "task1"
    ? "Task 1 — describe the visual"
    : "Task 2 — write the essay";
  // Mode toggle is shown only for Task 2 (staging makes most sense there).
  const toggle = $("#modeToggle");
  if (mode === "task2") {
    toggle.hidden = false;
    $$(".mode-btn", toggle).forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === pickerSessionMode);
      b.onclick = () => {
        pickerSessionMode = b.dataset.mode;
        $$(".mode-btn", toggle).forEach((x) => x.classList.toggle("active", x.dataset.mode === pickerSessionMode));
      };
    });
  } else {
    toggle.hidden = true;
  }
  let html = `<button class="picker-card random" type="button" data-pick="__random">
    <div class="picker-thumb">⇄</div>
    <div class="picker-info">
      <div class="picker-kicker">Recommended</div>
      <div class="picker-title">Random — closest to real exam</div>
      <div class="picker-desc">Give me a ${mode === "task1" ? "Task 1 chart" : "Task 2 question"} I haven't seen.</div>
    </div></button>`;
  html += list.map((t) => `<div class="picker-card" data-pick="${esc(t.id)}" tabindex="0" role="button">
    <div class="picker-thumb">${mode === "task1" ? thumbFor(t) : "T2"}</div>
    <div class="picker-info">
      <div class="picker-kicker">${esc(t.qType || t.chartKind || "")}</div>
      <div class="picker-title">${esc(t.title)}</div>
      <div class="picker-desc">${esc(promptPreview(t.prompt))}</div>
    </div>
  </div>`).join("");
  $("#pickerList").innerHTML = html;
  $$("#pickerList .picker-card").forEach((c) => {
    c.onclick = () => {
      let id = c.dataset.pick;
      if (id === "__random") id = list[Math.floor(Math.random() * list.length)].id;
      // Practice mode applies to Task 2 only. The Plan-with-me and
      // Brainstorm-ideas helpers live inside Practice mode's planning stage.
      if (mode === "task2" && pickerSessionMode === "practice") {
        startStagedSession(id);
      } else {
        startExam("single", id);
      }
    };
    c.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); }
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
  plan: "",   // when started from staged practice mode, the candidate's plan stays visible alongside the prompt
};

function taskById(id) { return TASK1.concat(TASK2).find((t) => t.id === id); }
function minutesFor(type) { return type === "task1" ? 20 : 40; }
function minWordsFor(type) { return type === "task1" ? 150 : 250; }

function startExam(mode, id, opts = {}) {
  exam.mode = mode; exam.active = 0;
  exam.warned10 = exam.warned5 = exam.warned1 = false;
  exam.plan = opts.plan || "";
  if (mode === "full") {
    exam.tasks = [
      TASK1[Math.floor(Math.random() * TASK1.length)],
      TASK2[Math.floor(Math.random() * TASK2.length)],
    ];
    exam.remaining = 60 * 60;
  } else {
    exam.tasks = [taskById(id)];
    // Practice mode subtracts the suggested planning time so the total
    // budget still maps onto the real-exam 40 minutes for Task 2.
    const total = minutesFor(exam.tasks[0].type) * 60;
    exam.remaining = opts.minutesOverride ? opts.minutesOverride * 60 : total;
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
  // Practice mode: surface the candidate's plan alongside the prompt.
  if (exam.plan && t.type === "task2") {
    html += `<div class="staged-plan-shown">
      <div class="staged-plan-shown-label">YOUR PLAN</div>
      <div class="staged-plan-shown-text">${esc(exam.plan)}</div>
    </div>`;
  }
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
    "- misspellings: for every GENUINE spelling error in the script, return an entry with",
    "  'wrong' (the misspelled token, verbatim, lowercased), 'correct' (canonical spelling),",
    "  and 'context' (up to 8 words of surrounding context from the script so the candidate",
    "  can locate it). Do NOT include word-choice errors here — only spelling. These feed",
    "  the candidate's personal Spelling Vault, which uses spaced repetition to drill them.",
    "  If there are no spelling errors, return an empty array.",
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
  const traj = collectTrajectory();
  if (traj && traj.totalMarked >= 1) {
    u += `CANDIDATE'S TRAJECTORY ON THIS APP (use this to make the feedback feel like a tutor who REMEMBERS them):\n`;
    u += `- Essays marked so far: ${traj.totalMarked}\n`;
    if (traj.last5Bands.length) {
      u += `- Bands (oldest → newest): ${traj.last5Bands.map((b) => Number(b).toFixed(1)).join(" → ")}\n`;
    }
    if (traj.trends.length > 0) {
      u += `- Pattern frequency change (% of essays containing each pattern, EARLY → RECENT):\n`;
      traj.trends.forEach((t2) => {
        const dir = t2.delta < -0.05 ? "↓ improving" : t2.delta > 0.05 ? "↑ getting worse" : "→ flat";
        u += `    • ${t2.name}: ${Math.round(t2.early * 100)}% → ${Math.round(t2.recent * 100)}%   ${dir}\n`;
      });
    }
    u += `\nIn your examiner_summary and next_band_advice, REFERENCE this trajectory explicitly. Name progress already made (e.g. "you've cut your spelling errors in half since attempt 1"). Name the remaining biggest blocker. Be the tutor who remembers them, not a stranger seeing the script for the first time.\n\n`;
  }
  u += `CANDIDATE'S ANSWER (${r.wordCount} words):\n"""\n${r.answer}\n"""`;
  return u;
}

function collectTrajectory() {
  const marked = store.history.filter((h) => h.band != null);
  if (marked.length === 0) return null;
  const last5Bands = marked.slice(-5).map((h) => h.band);
  const totalMarked = marked.length;

  // Compare pattern frequency: first half of attempts vs last half (or first attempt vs the rest if only 2).
  const split = Math.max(1, Math.floor(marked.length / 2));
  const earlyEssays  = marked.slice(0, split);
  const recentEssays = marked.slice(-split);

  const seenNames = {};
  const tally = (essays) => {
    const t = {};
    essays.forEach((h) => {
      const ps = h.mark && h.mark.recurring_patterns;
      if (!ps) return;
      ps.forEach((p) => {
        const key = (p.name || "").trim().toLowerCase();
        if (!key) return;
        if (!seenNames[key]) seenNames[key] = p.name;
        t[key] = (t[key] || 0) + 1;
      });
    });
    return t;
  };
  const earlyTally  = tally(earlyEssays);
  const recentTally = tally(recentEssays);

  const trends = [];
  const allKeys = new Set([...Object.keys(earlyTally), ...Object.keys(recentTally)]);
  allKeys.forEach((key) => {
    const early  = (earlyTally[key]  || 0) / Math.max(earlyEssays.length, 1);
    const recent = (recentTally[key] || 0) / Math.max(recentEssays.length, 1);
    trends.push({ name: seenNames[key], early, recent, delta: recent - early });
  });
  trends.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { totalMarked, last5Bands, trends: trends.slice(0, 5) };
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
    misspellings: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          wrong:   { type: "string" },   // exact misspelled token from the script (lowercase)
          correct: { type: "string" },   // canonical correct spelling
          context: { type: "string" },   // up to ~8 words of surrounding context from the script
        },
        required: ["wrong", "correct", "context"],
      },
    },
    examiner_summary: { type: "string" },
    next_band_advice: { type: "string" },
  },
  required: ["under_length","criteria","key_strengths","priority_fixes",
    "upgrade_edits","recurring_patterns","misspellings","examiner_summary","next_band_advice"],
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
  try {
    if (useDevice) {
      res = await postWithRetry(ANTHROPIC_DIRECT_URL, {
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
      res = await postWithRetry(s.proxyUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  } catch {
    const e = new Error("Cannot reach the marker."); e.code = "NEEDS_KEY"; throw e;
  }
  if (res.status === 404 || res.status === 503) {
    const e = new Error("The marker is not configured on this device."); e.code = "NEEDS_KEY"; throw e;
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
  ingestVault(r.mark);
  save();
}

/* ============================== SPELLING VAULT ============================== */
/* Every misspelling the marker tags is added here with a spaced-repetition
   schedule. Words graduate to "mastered" after 3 consecutive correct
   drill attempts. The vault feeds the dedicated Drill Mode view.
   Intervals: 1d -> 3d -> 7d -> 14d -> mastered (3 correct in a row at 14d). */
const VAULT_INTERVALS = [1, 3, 7, 14];

function ensureVault() {
  if (!store.vault) store.vault = { words: {} };
  if (!store.vault.words) store.vault.words = {};
  return store.vault;
}

function ingestVault(mark) {
  if (!mark || !Array.isArray(mark.misspellings)) return;
  const v = ensureVault();
  mark.misspellings.forEach((m) => {
    if (!m || !m.correct) return;
    const key = String(m.correct).trim().toLowerCase();
    if (!key) return;
    const wrong = String(m.wrong || "").trim().toLowerCase();
    if (!v.words[key]) {
      v.words[key] = {
        correct: String(m.correct).trim(),
        wrong_variants: [],
        first_seen: Date.now(),
        last_drilled: 0,
        interval_days: 1,
        streak: 0,
        mastered: false,
        contexts: [],
        essays_seen_in: 0,
      };
    }
    const entry = v.words[key];
    if (wrong && !entry.wrong_variants.includes(wrong)) entry.wrong_variants.push(wrong);
    if (m.context && !entry.contexts.includes(m.context)) entry.contexts.push(m.context);
    entry.essays_seen_in += 1;
  });
}

function vaultStats() {
  ensureVault();
  const all = Object.values(store.vault.words);
  const active   = all.filter((e) => !e.mastered);
  const mastered = all.filter((e) => e.mastered);
  const due = active.filter((e) => Date.now() >= (e.last_drilled + e.interval_days * 86400000));
  return { total: all.length, active: active.length, mastered: mastered.length, due: due.length };
}

function vaultDueWords(limit) {
  ensureVault();
  const all = Object.values(store.vault.words).filter((e) => !e.mastered);
  const now = Date.now();
  const sorted = all
    .filter((e) => now >= (e.last_drilled + e.interval_days * 86400000))
    .sort((a, b) => (a.last_drilled || 0) - (b.last_drilled || 0));
  return limit ? sorted.slice(0, limit) : sorted;
}

function vaultActiveWords(limit) {
  ensureVault();
  const all = Object.values(store.vault.words).filter((e) => !e.mastered);
  const sorted = all.sort((a, b) => (a.last_drilled || 0) - (b.last_drilled || 0));
  return limit ? sorted.slice(0, limit) : sorted;
}

function vaultMarkResult(wordKey, correct) {
  ensureVault();
  const entry = store.vault.words[wordKey];
  if (!entry) return;
  entry.last_drilled = Date.now();
  if (correct) {
    entry.streak += 1;
    const idx = VAULT_INTERVALS.indexOf(entry.interval_days);
    if (idx >= 0 && idx < VAULT_INTERVALS.length - 1) {
      entry.interval_days = VAULT_INTERVALS[idx + 1];
    }
    if (entry.streak >= 3 && entry.interval_days === VAULT_INTERVALS[VAULT_INTERVALS.length - 1]) {
      entry.mastered = true;
    }
  } else {
    entry.streak = 0;
    entry.interval_days = VAULT_INTERVALS[0];
  }
  save();
}

function renderVault() {
  ensureVault();
  show("vault");
  const stats = vaultStats();
  const body = $("#vaultBody");

  if (stats.total === 0) {
    body.innerHTML = `<button class="back-btn" type="button" data-back>← Home</button>
      <h2 class="view-title">Spelling Vault</h2>
      <div class="result-hero">
        <div class="result-hero-label">Personal spelling vault</div>
        <div class="result-hero-band">📚</div>
        <div class="result-hero-target">Words you misspelled will land here automatically after each essay is marked. You'll then drill them on a spaced-repetition schedule until they stick.</div>
      </div>`;
    $$("[data-back]", body).forEach((b) => (b.onclick = () => { show("home"); renderHome(); }));
    return;
  }

  const active = vaultActiveWords();
  const dueNow = vaultDueWords();

  let html = `<button class="back-btn" type="button" data-back>← Home</button>
    <h2 class="view-title">Spelling Vault</h2>
    <div class="stat-row">
      <div class="stat-card"><span class="stat-label">Words tracked</span><span class="stat-value">${stats.total}</span></div>
      <div class="stat-card"><span class="stat-label">Active</span><span class="stat-value">${stats.active}</span></div>
      <div class="stat-card"><span class="stat-label">Mastered</span><span class="stat-value">${stats.mastered}</span></div>
      <div class="stat-card"><span class="stat-label">Due now</span><span class="stat-value" style="color:${stats.due > 0 ? "var(--accent)" : "var(--good)"}">${stats.due}</span></div>
    </div>

    <div class="result-actions">
      ${stats.due > 0 ? `<button class="primary-btn" id="vaultDrillDue" type="button">Drill ${stats.due} word${stats.due === 1 ? "" : "s"} due now ▸</button>` : ""}
      ${stats.active > 0 ? `<button class="secondary-btn" id="vaultDrillAny" type="button">Drill any ${Math.min(stats.active, 10)} active</button>` : ""}
    </div>

    <div class="panel" style="margin-top:18px">
      <div class="panel-head"><h2>Your vault</h2><span class="panel-note">${stats.active} active · ${stats.mastered} mastered</span></div>
      ${[...active, ...Object.values(store.vault.words).filter((e) => e.mastered)].map((entry) => `<div class="vault-word ${entry.mastered ? "mastered" : ""}">
        <div class="vault-word-correct">${esc(entry.correct)}</div>
        <div class="vault-word-meta">
          ${entry.mastered
            ? `<span class="vault-mastered">Mastered ✓</span>`
            : `<span class="vault-interval">${entry.interval_days}d interval · streak ${entry.streak}</span>`}
          ${entry.wrong_variants.length ? `<span class="vault-variants">Wrote: ${entry.wrong_variants.map((v) => esc(v)).join(", ")}</span>` : ""}
        </div>
      </div>`).join("")}
    </div>`;

  body.innerHTML = html;
  $$("[data-back]", body).forEach((b) => (b.onclick = () => { show("home"); renderHome(); }));
  if ($("#vaultDrillDue")) $("#vaultDrillDue").onclick = () => runVaultDrill(vaultDueWords(10));
  if ($("#vaultDrillAny")) $("#vaultDrillAny").onclick = () => runVaultDrill(vaultActiveWords(10));
}

function runVaultDrill(words) {
  if (!words || !words.length) { toast("Nothing to drill right now."); return; }
  show("vault");
  const body = $("#vaultBody");
  let html = `<button class="back-btn" type="button" id="vaultDrillBack">← Back to vault</button>
    <h2 class="view-title">Spelling drill — ${words.length} word${words.length === 1 ? "" : "s"}</h2>
    <p class="section-lead">For each word, type the correct spelling. Press <b>Mark all</b> at the bottom.</p>`;
  words.forEach((entry, i) => {
    const variant = entry.wrong_variants[entry.wrong_variants.length - 1] || "—";
    const context = entry.contexts[entry.contexts.length - 1] || "";
    html += `<div class="drill-card" data-vault-i="${i}" data-vault-key="${esc(entry.correct.toLowerCase())}">
      <p class="drill-prompt"><b>${i + 1}.</b> You wrote: <span class="vault-wrong-tag">${esc(variant)}</span>
        ${context ? `<br><span class="vault-context">in "${esc(context)}"</span>` : ""}</p>
      <input class="drill-input" type="text" data-vault-input="${i}"
             autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
             placeholder="Type the correct spelling">
      <div class="drill-result" data-vault-result="${i}" hidden></div>
    </div>`;
  });
  html += `<div class="result-actions">
    <button class="secondary-btn" id="vaultDrillCancel" type="button">Back to vault</button>
    <button class="primary-btn"   id="vaultDrillMark"   type="button">Mark all ▸</button>
  </div>
  <div id="vaultDrillSummary"></div>`;
  body.innerHTML = html;

  $("#vaultDrillBack").onclick   = () => renderVault();
  $("#vaultDrillCancel").onclick = () => renderVault();

  $("#vaultDrillMark").onclick = () => {
    let score = 0;
    words.forEach((entry, i) => {
      const input = $(`[data-vault-input="${i}"]`);
      const card  = $(`[data-vault-i="${i}"]`);
      const resEl = $(`[data-vault-result="${i}"]`);
      input.disabled = true;
      const userAns = input.value.trim().toLowerCase();
      const correctAns = entry.correct.trim().toLowerCase();
      const right = userAns === correctAns;
      vaultMarkResult(correctAns, right);
      resEl.hidden = false;
      resEl.className = `drill-result ${right ? "right" : "wrong"}`;
      card.classList.add(right ? "right" : "wrong");
      if (right) {
        resEl.innerHTML = `<b>✓ Correct.</b>`;
        score++;
      } else {
        resEl.innerHTML = `<b>✗ Not quite.</b>
          <span class="drill-result-correct">Correct: ${esc(entry.correct)}</span>`;
      }
    });
    const sum = $("#vaultDrillSummary");
    sum.innerHTML = `<div class="result-hero" style="margin-top:16px">
      <div class="result-hero-label">Drill score</div>
      <div class="result-hero-band">${score}/${words.length}</div>
      <div class="result-hero-note">Correct answers extend the interval before you see the word again. Wrong answers reset it. Three correct in a row at 14-day interval = mastered.</div>
    </div>
    <div class="result-actions">
      <button class="primary-btn" id="vaultBackToVault" type="button">Back to vault</button>
    </div>`;
    $("#vaultBackToVault").onclick = () => renderVault();
    $("#vaultDrillMark").disabled = true;
    $("#vaultDrillMark").textContent = `Marked: ${score}/${words.length}`;
  };

  setTimeout(() => { const f = $('[data-vault-input="0"]'); if (f) f.focus(); }, 50);
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

  // Find a previous attempt of the same prompt (for same-prompt diff feature)
  let comparable = null;
  if (single) {
    const r = records[0];
    const others = store.history
      .filter((h) => h.taskId === r.task.id && h.mark && h.answer !== r.answer)
      .sort((a, b) => b.ts - a.ts);
    if (others.length > 0) comparable = others[0];
  }

  let html = `<div class="result-hero">
    <div class="result-hero-label">${single ? "Estimated band" : "Overall Writing band"}</div>
    <div class="result-hero-band">${fmtBand(headBand)}</div>
    <div class="result-hero-target">${hit
      ? `<b class="hit">✓ at or above your target of ${fmtBand(target)}</b>`
      : `${(target - headBand).toFixed(1)} band below your target of <b class="miss">${fmtBand(target)}</b>`}</div>
    ${subBands ? `<div class="result-hero-note">${esc(subBands)}</div>` : ""}
    <div class="result-hero-note">AI estimate against the official IELTS band descriptors. Real exams are marked by certified humans and can differ by ~0.5 band.</div>
  </div>`;

  if (comparable) {
    const cBand   = records[0].mark.band;
    const delta   = round05(cBand - comparable.band);
    const arrow   = delta > 0 ? "▲" : delta < 0 ? "▼" : "→";
    const cls     = delta > 0 ? "up" : delta < 0 ? "down" : "";
    html += `<div class="compare-banner">
      <div class="compare-banner-text">
        <b class="${cls}">${arrow} You've written this prompt before</b>
        <span>Previous: Band ${fmtBand(comparable.band)} → now: Band ${fmtBand(cBand)}</span>
      </div>
      <button class="secondary-btn" id="compareBtn" type="button">Compare side-by-side ▸</button>
    </div>`;
  }

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
  if (comparable) {
    $("#compareBtn").onclick = () => renderCompare(records[0], comparable);
  }
  $("#againBtn").onclick = () => openPicker(records[0].task.type);
  $("#homeBtn").onclick  = () => { show("home"); renderHome(); };
}

function renderCompare(current, previous) {
  const cBand = current.mark.band;
  const pBand = previous.band;
  const delta = round05(cBand - pBand);
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "→";
  const cls   = delta > 0 ? "up" : delta < 0 ? "down" : "";
  const sub   = delta > 0
    ? `Up ${delta.toFixed(1)} band on the same prompt — that's measurable improvement.`
    : delta === 0
    ? "Same band — look at the side-by-side and check what carried over from last time."
    : "Band dropped — compare the texts and find the structural difference.";

  // Build criteria comparison: previous's per-criterion bands vs current's
  const order = [
    ["task",                       current.task.type === "task1" ? "Task Achievement" : "Task Response"],
    ["coherence_cohesion",         "Coherence & Cohesion"],
    ["lexical_resource",           "Lexical Resource"],
    ["grammatical_range_accuracy", "Grammatical Range & Accuracy"],
  ];
  const cm = current.mark.criteria, pm = previous.mark.criteria;
  const critRows = order.map(([k, n]) => {
    const pv = pm && pm[k] ? pm[k].band : "—";
    const cv = cm && cm[k] ? cm[k].band : "—";
    const d = (typeof pv === "number" && typeof cv === "number") ? cv - pv : null;
    const dStr = d === null ? "" : d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "→";
    const dCls = d === null ? "" : d > 0 ? "up" : d < 0 ? "down" : "";
    return `<tr>
      <td>${esc(n)}</td>
      <td style="text-align:center">${pv}</td>
      <td style="text-align:center">${cv}</td>
      <td style="text-align:center" class="${dCls}">${dStr}</td>
    </tr>`;
  }).join("");

  $("#resultBody").innerHTML = `<button class="back-btn" type="button" id="cmpBack">← Back to current result</button>
    <h2 class="view-title">${esc(current.task.title)} — side-by-side</h2>

    <div class="delta-banner">
      <b class="${cls}">${arrow} Band ${fmtBand(pBand)} → ${fmtBand(cBand)}</b>
      <span class="delta-sub">${esc(sub)}</span>
    </div>

    <table class="compare-table">
      <thead><tr><th>Criterion</th><th>Previous</th><th>Now</th><th>Δ</th></tr></thead>
      <tbody>${critRows}</tbody>
    </table>

    <div class="compare-grid">
      <div class="compare-col">
        <h3>Previous attempt — Band ${fmtBand(pBand)}</h3>
        <div class="compare-sub">${esc(fmtDate(previous.ts))} · ${previous.wordCount} words</div>
        <div class="your-answer">${esc(previous.answer)}</div>
      </div>
      <div class="compare-col compare-col-current">
        <h3>This attempt — Band ${fmtBand(cBand)}</h3>
        <div class="compare-sub">just now · ${current.wordCount} words</div>
        <div class="your-answer">${esc(current.answer)}</div>
      </div>
    </div>

    <div class="result-actions">
      <button class="secondary-btn" id="cmpResult" type="button">Back to current result</button>
      <button class="primary-btn"   id="cmpHome"   type="button">Back to dashboard</button>
    </div>`;

  const backToResult = () => {
    renderResult([current]);
  };
  $("#cmpBack").onclick   = backToResult;
  $("#cmpResult").onclick = backToResult;
  $("#cmpHome").onclick   = () => { show("home"); renderHome(); };
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
    bindAttemptRows(list, renderHistory);
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
      if (!tally[key]) tally[key] = { name: p.name, count: 0, rule: p.rule, fix: p.fix, example: p.example, examples: [] };
      tally[key].count += 1;
      if (p.example) tally[key].examples.push(p.example);
      // keep the most recent rule / fix / example as authoritative
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
    <p class="section-lead">The habits that keep showing up in your writing, most frequent first. Tap <b>Drill this pattern</b> on any of them — your AI tutor will generate 5 short personalised exercises targeted at <em>that one weakness</em>, using your own examples.</p>
    ${patterns.map((p, idx) => `<div class="pattern" data-pattern-key="${esc(p.name.toLowerCase())}">
      <div class="pat-name">${esc(p.name)} <span class="pat-count">×${p.count}</span></div>
      ${p.rule    ? `<div class="pat-rule">${esc(p.rule)}</div>` : ""}
      ${p.example ? `<div class="pat-eg">"${esc(p.example)}"</div>` : ""}
      ${p.fix     ? `<div class="pat-fix">${esc(p.fix)}</div>` : ""}
      <div class="pat-action">
        <button type="button" data-drill-idx="${idx}">Drill this pattern →</button>
      </div>
    </div>`).join("")}
  </div>`;

  if (Array.isArray(store.drills) && store.drills.length) {
    const recent = store.drills.slice(-5).reverse();
    html += `<div class="result-section">
      <h3>Recent drills</h3>
      ${recent.map((d) => `<div class="attempt">
        <div class="attempt-band">${d.score}/${d.total}</div>
        <div class="attempt-meta">
          <div class="attempt-title">${esc(d.pattern)}</div>
          <div class="attempt-sub">${esc(fmtDate(d.ts))}</div>
        </div>
      </div>`).join("")}
    </div>`;
  }

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

  // Wire the Drill-this-pattern buttons.
  $$("[data-drill-idx]").forEach((btn) => {
    btn.onclick = () => {
      const idx = +btn.dataset.drillIdx;
      const p = patterns[idx];
      if (!p) return;
      openDrill(p);
    };
  });

  show("coach");
}

/* ============================== PROMPT DECONSTRUCTION ============================== */
/* "Plan with me" tool. Before writing, the candidate clicks a button on a
   Task 2 picker card. Claude returns a structured breakdown of the prompt:
   type, parts to address, required position, suggested paragraph structure,
   and the common pitfall for this prompt type. This directly fixes the
   single biggest reason Task Response is capped at 5: skipping a half of
   the prompt because it was not consciously read. */

const DECONSTRUCT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    prompt_type: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          label: { type: "string" },
          why_it_matters: { type: "string" },
        },
        required: ["label", "why_it_matters"],
      },
    },
    required_position: { type: "string" },
    suggested_structure: { type: "array", items: { type: "string" } },
    key_phrases_to_address: { type: "array", items: { type: "string" } },
    common_pitfall: { type: "string" },
  },
  required: ["prompt_type", "parts", "required_position",
    "suggested_structure", "key_phrases_to_address", "common_pitfall"],
};

async function deconstructPrompt(task) {
  const s = store.settings;
  const body = {
    model: s.model,
    max_tokens: 1024,
    system: [
      "You are an IELTS Writing tutor preparing a candidate to plan an essay.",
      "Decode the prompt for them — type, parts, position, structure — so they",
      "do not skip a half of the question (the single most common cause of a",
      "capped Task Response score). Be precise and concrete. Address Task 2",
      "prompts specifically — opinion, discussion, advantages/disadvantages,",
      "problem-solution, and two-part direct-question are the recognised types.",
      "",
      "For 'parts', list every distinct thing the prompt requires the candidate",
      "to address. For 'why_it_matters', explain what happens to the band if",
      "this part is skipped (this trains the candidate to take it seriously).",
      "For 'suggested_structure', 4 bullet points: intro / body 1 / body 2 / conclusion,",
      "each one sentence saying what that paragraph must contain.",
      "For 'key_phrases_to_address', literal phrases from the prompt the essay",
      "MUST engage with (e.g. 'governments', 'employers', 'this development').",
      "'common_pitfall' is the single most frequent failure mode for this prompt type.",
      "",
      "Call the deconstruct_prompt tool. Do not write prose.",
    ].join("\n"),
    messages: [{ role: "user", content: `PROMPT TO DECONSTRUCT:\n\n${task.prompt}` }],
    tools: [{
      name: "deconstruct_prompt",
      description: "Return a structured breakdown of an IELTS Writing Task 2 prompt.",
      input_schema: DECONSTRUCT_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "deconstruct_prompt" },
  };
  const useDevice = !!s.apiKey;
  let res;
  try {
    res = useDevice
      ? await postWithRetry(ANTHROPIC_DIRECT_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": s.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(body),
        })
      : await postWithRetry(s.proxyUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
  } catch {
    const e = new Error("Cannot reach the marker."); e.code = "NEEDS_KEY"; throw e;
  }
  if (res.status === 404 || res.status === 503) {
    const e = new Error("Marker is not configured."); e.code = "NEEDS_KEY"; throw e;
  }
  if (!res.ok) throw new Error(`Plan generator failed (${res.status}).`);
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use" && b.name === "deconstruct_prompt");
  if (!block || !block.input) throw new Error("Plan generator returned no result.");
  return block.input;
}

async function openDeconstruct(task) {
  $("#deconstructModal").hidden = false;
  $("#deconBody").innerHTML = markingSpinner("Reading the prompt with you…");
  startTicker();
  try {
    const plan = await deconstructPrompt(task);
    stopTicker();
    renderDeconstruct(task, plan);
  } catch (err) {
    stopTicker();
    $("#deconBody").innerHTML = `<p class="section-lead">${esc(err.message)}</p>
      <div class="decon-actions">
        <button class="secondary-btn" id="deconCancel" type="button">Close</button>
        <button class="primary-btn"   id="deconRetry"  type="button">Try again</button>
      </div>`;
    $("#deconCancel").onclick = () => { $("#deconstructModal").hidden = true; };
    $("#deconRetry").onclick  = () => openDeconstruct(task);
  }
}

function renderDeconstruct(task, plan) {
  const html = `
    <div class="decon-prompt">${esc(task.prompt).replace(/\n\n/g, "<br><br>")}</div>

    <div class="decon-section">
      <h3>Prompt type</h3>
      <span class="decon-pill">${esc(plan.prompt_type)}</span>
    </div>

    <div class="decon-section">
      <h3>What the prompt asks (every part)</h3>
      <ol class="decon-list">
        ${plan.parts.map((p) => `<li>
          <b>${esc(p.label)}</b>
          <span class="decon-why">${esc(p.why_it_matters)}</span>
        </li>`).join("")}
      </ol>
    </div>

    <div class="decon-section">
      <h3>Position required</h3>
      <p style="margin:0;font-size:14px;line-height:1.5;color:var(--muted)">${esc(plan.required_position)}</p>
    </div>

    <div class="decon-section">
      <h3>Paragraph structure to aim for</h3>
      <ol class="decon-list">
        ${plan.suggested_structure.map((s) => `<li>${esc(s)}</li>`).join("")}
      </ol>
    </div>

    <div class="decon-section">
      <h3>Phrases from the prompt your essay must engage with</h3>
      <div>${plan.key_phrases_to_address.map((k) => `<span class="decon-key">${esc(k)}</span>`).join("")}</div>
    </div>

    <div class="decon-section">
      <h3>The common pitfall to avoid</h3>
      <div class="decon-pitfall">${esc(plan.common_pitfall)}</div>
    </div>

    <div class="decon-actions">
      <button class="secondary-btn" id="deconLater" type="button">Maybe later</button>
      <button class="primary-btn"   id="deconStart" type="button">Start writing this ▸</button>
    </div>`;
  $("#deconBody").innerHTML = html;
  $("#deconLater").onclick = () => { $("#deconstructModal").hidden = true; };
  $("#deconStart").onclick = () => {
    $("#deconstructModal").hidden = true;
    startExam("single", task.id);
  };
}

/* ============================== LEARN — Master the X ============================== */
/* Structured learning path. Each module isolates ONE micro-skill:
   - Master the Introduction
   - Master the Topic Sentence
   - Master Idea Development
   - Master Linking Words
   - Master the Conclusion
   - Master Articles & Inflections
   Flow: read the concept + good/bad examples -> try it (write a short
   piece) -> Claude marks ONLY on that skill -> pass increments mastery.
   3 passes = module mastered. Progress persists in store.modules. */

const MODULE_MARK_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    pass:             { type: "boolean" },
    score:            { type: "integer" },
    feedback:         { type: "string" },
    specific_issues:  { type: "array", items: { type: "string" } },
    improved_version: { type: "string" },
  },
  required: ["pass", "score", "feedback", "specific_issues", "improved_version"],
};

function moduleState(id) {
  if (!store.modules) store.modules = {};
  if (!store.modules[id]) {
    store.modules[id] = {
      attempts: 0, correct: 0, mastered: false,
      last_score: 0, last_attempt: 0,
      passed_prompt_indexes: [],   // which try-it prompt indexes have been passed (genuine generalisation)
    };
  }
  // Backfill for older stored modules.
  if (!Array.isArray(store.modules[id].passed_prompt_indexes)) store.modules[id].passed_prompt_indexes = [];
  return store.modules[id];
}

/* Pick the next try-it prompt: prefer one the candidate has not yet
   passed (so 3 correct = 3 different scenarios = real generalisation).
   If they've passed every prompt, pick a random one for refresher. */
function pickNextTryIt(module) {
  const prompts = Array.isArray(module.try_it_prompts) && module.try_it_prompts.length
    ? module.try_it_prompts
    : (module.try_it_prompt ? [module.try_it_prompt] : []);
  if (!prompts.length) return { index: 0, text: "", total: 0 };
  const state = moduleState(module.id);
  const allIdxs = prompts.map((_, i) => i);
  const unpassed = allIdxs.filter((i) => !state.passed_prompt_indexes.includes(i));
  const pool = unpassed.length > 0 ? unpassed : allIdxs;
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { index: idx, text: prompts[idx], total: prompts.length };
}

function renderLearn() {
  show("learn");
  const body = $("#learnBody");

  const foundation = MODULES.filter((m) => m.tier === "foundation");
  const polish     = MODULES.filter((m) => m.tier === "polish");

  const cardFor = (m) => {
    const state = moduleState(m.id);
    const progress = state.mastered
      ? `<span class="module-badge mastered">Mastered ✓</span>`
      : `<span class="module-badge">${state.correct}/${m.mastery_target} scenarios</span>`;
    const tierTag = m.tier === "foundation"
      ? `<span class="module-tier-badge foundation">Pre-exam gate</span>`
      : `<span class="module-tier-badge polish">Polish</span>`;
    return `<div class="module-card ${state.mastered ? "mastered" : ""}" data-module-id="${esc(m.id)}" tabindex="0" role="button">
      <div class="module-card-head">
        <div class="module-card-title">${esc(m.title)}</div>
        ${progress}
      </div>
      <div class="module-card-short">${esc(m.short)}</div>
      <div class="module-card-meta">${tierTag}<span>Lifts: <b>${esc(m.blocks)}</b></span></div>
    </div>`;
  };

  const foundationMastered = foundation.filter((m) => moduleState(m.id).mastered).length;
  const allFoundationDone  = foundationMastered === foundation.length;

  body.innerHTML = `<button class="back-btn" type="button" data-back>← Home</button>
    <h2 class="view-title">Master the skills</h2>
    <p class="section-lead">Each module isolates ONE micro-skill. Read the concept, see good vs bad examples, write your own. The marker is strict on that one skill. Master ${MODULES[0].mastery_target} different scenarios per module — that's real generalisation, not the same task three times.</p>

    <div class="module-section">
      <div class="module-section-head">
        <h3>Pre-exam gates — get these right before timed practice</h3>
        <span class="module-section-progress">${foundationMastered} of ${foundation.length} mastered</span>
      </div>
      <p class="module-section-lead">${allFoundationDone
        ? "All foundation skills mastered. You're ready to focus on polish and timed practice."
        : "These are mechanical / structural skills. They have nothing to do with how good your English is — but skipping any of them caps your band. Master all foundation modules before serious exam practice."}</p>
      <div class="module-list">${foundation.map(cardFor).join("")}</div>
    </div>

    <div class="module-section">
      <div class="module-section-head">
        <h3>Polish — lifts you from 6.5 toward 7+</h3>
      </div>
      <p class="module-section-lead">Once the foundations are solid, these refinements move your score from "good enough" to "band 7".</p>
      <div class="module-list">${polish.map(cardFor).join("")}</div>
    </div>`;

  $$("[data-back]", body).forEach((b) => (b.onclick = () => { show("home"); renderHome(); }));
  $$(".module-card", body).forEach((c) => {
    c.onclick = () => openModule(c.dataset.moduleId);
    c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); } };
  });
}

function openModule(id) {
  const m = MODULES.find((x) => x.id === id);
  if (!m) { renderLearn(); return; }
  const state = moduleState(id);
  show("module");
  const body = $("#moduleBody");

  body.innerHTML = `<button class="back-btn" type="button" id="modBack">← Back to Learn</button>
    <div class="module-head">
      <h2 class="view-title">${esc(m.title)}</h2>
      <div class="module-meta">Lifts: <b>${esc(m.blocks)}</b> · ${state.mastered ? `<span class="module-badge mastered">Mastered ✓</span>` : `${state.correct}/${m.mastery_target} correct`}</div>
    </div>

    <div class="module-why">
      <div class="module-why-label">Why this matters</div>
      <div>${esc(m.why)}</div>
    </div>

    <div class="result-section">
      <h3>The concept</h3>
      <div class="module-concept">${m.concept.map((line) => line ? `<p>${esc(line)}</p>` : `<div style="height:6px"></div>`).join("")}</div>
    </div>

    <div class="result-section">
      <h3>Examples — band 7+ vs band 5</h3>
      ${m.examples.map((ex) => `<div class="module-example module-example-${ex.kind}">
        <div class="module-example-label">${ex.kind === "good" ? "Band 7+" : "Band 5"}</div>
        <div class="module-example-prompt"><b>Prompt:</b> ${esc(ex.prompt)}</div>
        <div class="module-example-text">${esc(ex.text)}</div>
        <div class="module-example-why">${esc(ex.why)}</div>
      </div>`).join("")}
    </div>

    ${m.walkthrough ? `<div class="result-section">
      <h3>Walk through one with me</h3>
      <p class="section-lead">Before you try it yourself, here's exactly how I'd think about this. Step by step, out loud.</p>
      <div class="walkthrough">
        <div class="walkthrough-scenario">
          <div class="walkthrough-scenario-label">THE PROMPT WE'LL DO TOGETHER</div>
          <div>${esc(m.walkthrough.scenario)}</div>
        </div>
        ${m.walkthrough.steps.map((step, i) => `<div class="walkthrough-step">
          <div class="walkthrough-step-num">${i + 1}</div>
          <div class="walkthrough-step-body">
            <div class="walkthrough-step-label">${esc(step.label)}</div>
            <div class="walkthrough-step-thinking">${esc(step.thinking)}</div>
          </div>
        </div>`).join("")}
        <div class="walkthrough-final">
          <div class="walkthrough-final-label">PUTTING IT TOGETHER — THE FINAL RESULT</div>
          <div class="walkthrough-final-text">${esc(m.walkthrough.final_text)}</div>
        </div>
      </div>
    </div>` : ""}

    <div class="result-actions">
      <button class="primary-btn" id="modTryIt" type="button">Now try it yourself ▸</button>
    </div>`;

  $("#modBack").onclick   = () => renderLearn();
  $("#modTryIt").onclick  = () => startModuleTryIt(id);
}

function startModuleTryIt(id) {
  const m = MODULES.find((x) => x.id === id);
  if (!m) { renderLearn(); return; }
  show("module");
  const body = $("#moduleBody");

  const state = moduleState(id);
  const next = pickNextTryIt(m);
  const passedCount = state.passed_prompt_indexes.length;

  body.innerHTML = `<button class="back-btn" type="button" id="modTryBack">← Back to concept</button>
    <h2 class="view-title">${esc(m.title)} — try it</h2>
    <p class="section-lead">Scenario ${passedCount + 1} of ${m.mastery_target} you need to pass. ${next.total > 1 ? `Each try-it picks a different scenario, so mastery means you can do this skill across <b>${m.mastery_target} different prompts</b> — not the same one three times.` : ""}</p>

    <div class="module-tryit-prompt" data-prompt-idx="${next.index}">${esc(next.text).replace(/\n/g, "<br>")}</div>

    ${Array.isArray(m.hints) && m.hints.length ? `<div class="hints-section">
      <div class="hints-label">Stuck? Tap a hint to expand it. You can use as many as you need.</div>
      ${m.hints.map((h) => `<details class="hint-item">
        <summary>${esc(h.label)}</summary>
        <div class="hint-text">${esc(h.text)}</div>
      </details>`).join("")}
    </div>` : ""}

    <label class="staged-textarea-label" for="modTryText">Your submission</label>
    <textarea id="modTryText" class="staged-plan-textarea" style="min-height:140px"
      spellcheck="false" autocorrect="off" autocapitalize="off"
      placeholder="Type your answer here…"></textarea>

    <div class="result-actions">
      <button class="secondary-btn" id="modTryCancel" type="button">Back</button>
      <button class="primary-btn"   id="modTrySubmit" type="button">Get my mark ▸</button>
    </div>`;

  $("#modTryBack").onclick   = () => openModule(id);
  $("#modTryCancel").onclick = () => openModule(id);
  $("#modTrySubmit").onclick = async () => {
    const text = $("#modTryText").value.trim();
    if (text.length < 10) { toast("Write at least a short answer first."); return; }
    body.innerHTML = markingSpinner("Marking your attempt on this one skill…");
    startTicker();
    try {
      const mark = await markModule(m, text, next.text);
      stopTicker();
      const st = moduleState(id);
      st.attempts += 1;
      st.last_attempt = Date.now();
      st.last_score = mark.score;
      if (mark.pass) {
        // Only count if it's a NEW prompt scenario (so mastery = generalising).
        if (!st.passed_prompt_indexes.includes(next.index)) {
          st.passed_prompt_indexes.push(next.index);
        }
        st.correct = st.passed_prompt_indexes.length;
        if (st.correct >= m.mastery_target) st.mastered = true;
      }
      save();
      renderModuleResult(id, mark, text, next.index);
    } catch (err) {
      stopTicker();
      body.innerHTML = `<div class="panel">
        <h3>Couldn't mark</h3>
        <p class="section-lead">${esc(err.message)}</p>
        <div class="result-actions">
          <button class="secondary-btn" id="modErrBack" type="button">Back to module</button>
          <button class="primary-btn" id="modErrRetry" type="button">Try again</button>
        </div>
      </div>`;
      $("#modErrBack").onclick  = () => openModule(id);
      $("#modErrRetry").onclick = () => startModuleTryIt(id);
    }
  };

  setTimeout(() => { const t = $("#modTryText"); if (t) t.focus(); }, 50);
}

function renderModuleResult(id, mark, submission, scenarioIdx) {
  const m = MODULES.find((x) => x.id === id);
  if (!m) { renderLearn(); return; }
  const state = moduleState(id);
  show("module");
  const body = $("#moduleBody");

  const passCls = mark.pass ? "pass" : "fail";
  const passLbl = mark.pass ? "✓ Pass — scenario cleared" : "Not yet — keep working";
  const scoreLabel = ["", "Below band 5", "Band 5", "Band 6", "Band 6.5", "Band 7+"][mark.score] || `Score ${mark.score}/5`;
  const totalScenarios = Array.isArray(m.try_it_prompts) ? m.try_it_prompts.length : 1;
  const newScenario = mark.pass && typeof scenarioIdx === "number" && !state.passed_prompt_indexes.slice(0, -1).includes(scenarioIdx);

  body.innerHTML = `<button class="back-btn" type="button" id="modResBack">← Back to module</button>
    <div class="module-result-hero ${passCls}">
      <div class="module-result-label">${esc(m.title)}</div>
      <div class="module-result-pass">${passLbl}</div>
      <div class="module-result-score">${esc(scoreLabel)} · ${state.correct}/${m.mastery_target} scenarios passed${state.mastered ? " — MASTERED ✓" : ""}</div>
      ${totalScenarios > 1 ? `<div class="result-hero-note">${state.mastered ? `You've cleared this skill across ${state.correct} different scenarios. Genuine generalisation.` : `${m.mastery_target - state.correct} more new scenario${m.mastery_target - state.correct === 1 ? "" : "s"} to pass for mastery (out of ${totalScenarios} available).`}</div>` : ""}
    </div>

    <div class="result-section">
      <h3>Examiner's feedback</h3>
      <p style="font-size:14px; line-height:1.6; color:var(--muted)">${esc(mark.feedback)}</p>
    </div>

    ${mark.specific_issues && mark.specific_issues.length ? `<div class="result-section">
      <h3>Specific issues in your submission</h3>
      <ul class="bullets">${mark.specific_issues.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </div>` : ""}

    <div class="result-section">
      <h3>Your version vs band-7 version</h3>
      <div class="compare-grid">
        <div class="compare-col">
          <h3>Your submission</h3>
          <div class="your-answer">${esc(submission)}</div>
        </div>
        <div class="compare-col compare-col-current">
          <h3>Band-7 rewrite</h3>
          <div class="your-answer">${esc(mark.improved_version)}</div>
        </div>
      </div>
    </div>

    <div class="result-actions">
      ${state.mastered ? `<button class="primary-btn" id="modResLearn" type="button">Back to Learn — pick the next skill</button>`
        : `<button class="secondary-btn" id="modResAgain" type="button">Try this skill again</button>
           <button class="primary-btn" id="modResLearn" type="button">Back to all modules</button>`}
    </div>`;

  $("#modResBack").onclick = () => openModule(id);
  if ($("#modResAgain")) $("#modResAgain").onclick = () => startModuleTryIt(id);
  $("#modResLearn").onclick = () => renderLearn();
}

async function markModule(module, submission, scenarioPrompt) {
  const s = store.settings;
  const ctx = scenarioPrompt || (Array.isArray(module.try_it_prompts) ? module.try_it_prompts[0] : module.try_it_prompt) || "";
  const body = {
    model: s.model,
    max_tokens: 1024,
    system: [
      "You are an IELTS Writing tutor. The candidate is drilling ONE micro-skill in isolation.",
      "Mark the submission STRICTLY on this skill only. Ignore problems with other skills",
      "(those are covered in other modules — don't mix them in here).",
      "",
      "Scoring:",
      "- pass: TRUE only if the submission clearly demonstrates this skill at band-7 level.",
      "- score: 1-5 where 1=below band 5, 2=band 5, 3=band 6, 4=band 6.5, 5=band 7+.",
      "- feedback: 2-3 sentences saying exactly what was good or what's missing on THIS skill.",
      "- specific_issues: 0-4 short bullets pointing to exact phrases in the candidate's text.",
      "- improved_version: rewrite the candidate's submission as a band-7+ version of the SAME idea,",
      "  fixing only what's relevant to this skill. Keep the candidate's voice and content.",
      "",
      "Be strict but not harsh. The candidate is learning. If they don't yet demonstrate the skill,",
      "fail it cleanly — they need to know exactly what to fix.",
      "",
      "Call the mark_module tool. Do not write prose.",
    ].join("\n"),
    messages: [{
      role: "user",
      content:
        `SKILL TO MARK: ${module.skill_description}\n\n` +
        `THE TRY-IT PROMPT (context only):\n${ctx}\n\n` +
        `CANDIDATE'S SUBMISSION:\n"""\n${submission}\n"""\n\n` +
        `Mark on the skill above only.`,
    }],
    tools: [{
      name: "mark_module",
      description: "Return a focused mark for one micro-skill.",
      input_schema: MODULE_MARK_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "mark_module" },
  };

  const useDevice = !!s.apiKey;
  let res;
  try {
    res = useDevice
      ? await postWithRetry(ANTHROPIC_DIRECT_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": s.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(body),
        })
      : await postWithRetry(s.proxyUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
  } catch {
    const e = new Error("Cannot reach the marker."); e.code = "NEEDS_KEY"; throw e;
  }
  if (res.status === 404 || res.status === 503) {
    const e = new Error("Marker is not configured."); e.code = "NEEDS_KEY"; throw e;
  }
  if (!res.ok) throw new Error(`Module marker failed (${res.status}).`);
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use" && b.name === "mark_module");
  if (!block || !block.input) throw new Error("Module marker returned no result.");
  return block.input;
}

/* ============================== STAGED PRACTICE MODE ============================== */
/* The candidate cannot write Task 2 until they have planned. Stage 1: type
   a bullet plan (with help from Plan-with-me and Brainstorm-ideas as
   optional support). Stage 2: write the full essay with the plan pinned to
   the prompt panel so they never lose sight of it. Submit -> standard mark.
   Total time still 40 minutes (3 of which go to planning, 37 to writing). */

let stagedTaskId = null;

function startStagedSession(taskId) {
  stagedTaskId = taskId;
  renderPlanStage();
}

function renderPlanStage() {
  const task = taskById(stagedTaskId);
  if (!task) { show("home"); renderHome(); return; }
  $("#stagedBody").innerHTML = `
    <button class="back-btn" type="button" id="stagedBack">← Back to picker</button>
    <div class="staged-progress">
      <div class="staged-stage active"><span class="staged-num">1</span> Plan <span class="staged-time">~3 min</span></div>
      <div class="staged-stage"><span class="staged-num">2</span> Write <span class="staged-time">~37 min</span></div>
    </div>
    <h2 class="view-title">Plan first, then write</h2>
    <p class="section-lead">Bullet-point your position and the 2-3 main ideas you'll develop. The plan stays pinned alongside the prompt while you write so you never drift. Use the Claude tools below if you're stuck.</p>

    <div class="staged-prompt-box">
      <div class="staged-prompt-label">PROMPT</div>
      <div class="staged-prompt-text">${esc(task.prompt).replace(/\n\n/g, "<br><br>")}</div>
    </div>

    <label class="staged-textarea-label" for="stagedPlan">Your plan</label>
    <textarea id="stagedPlan" class="staged-plan-textarea"
      spellcheck="false" autocorrect="off" autocapitalize="off"
      placeholder="Position: I largely agree because…
Main idea 1: …
Main idea 2: …
(Optional) Counter-argument I'll concede: …
Conclusion direction: …"></textarea>

    <div class="staged-help-actions">
      <button class="secondary-btn" id="stagedDecon" type="button">📋 Read prompt with me</button>
      <button class="secondary-btn" id="stagedIdeas" type="button">💡 Brainstorm ideas</button>
    </div>

    <div class="result-actions">
      <button class="secondary-btn" id="stagedCancel" type="button">Cancel</button>
      <button class="primary-btn"   id="stagedContinue" type="button">Continue to writing ▸</button>
    </div>`;
  show("staged");

  $("#stagedBack").onclick   = () => { stagedTaskId = null; openPicker("task2"); };
  $("#stagedCancel").onclick = () => { stagedTaskId = null; openPicker("task2"); };
  $("#stagedDecon").onclick  = () => openDeconstruct(task);
  $("#stagedIdeas").onclick  = () => openIdeaBank(task);
  $("#stagedContinue").onclick = () => {
    const plan = $("#stagedPlan").value.trim();
    if (plan.length < 20) {
      toast("Write at least a brief plan before continuing — even rough bullet points are fine.");
      return;
    }
    const id = stagedTaskId;
    stagedTaskId = null;
    // 37 minutes for writing (3 already spent planning) — keeps the 40-min Task 2 budget intact.
    startExam("single", id, { plan: plan, minutesOverride: 37 });
  };

  setTimeout(() => { const t = $("#stagedPlan"); if (t) t.focus(); }, 50);
}

/* ============================== IDEA BANK ============================== */
/* "Brainstorm ideas." Before writing, Claude returns a structured idea bank
   for the prompt: candidate positions (with rationale), 4-5 supporting
   arguments (each with a real-world example), 3 counter-arguments (each
   with a brief how-to-concede line), and 2-3 sample thesis statements.
   Solves the "no ideas at this moment" problem the user named explicitly. */

const IDEA_BANK_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    candidate_positions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          stance: { type: "string" },
          why_take_this: { type: "string" },
        },
        required: ["stance", "why_take_this"],
      },
    },
    supporting_arguments: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          argument:          { type: "string" },
          example:           { type: "string" },
          best_for_position: { type: "string" },
        },
        required: ["argument", "example", "best_for_position"],
      },
    },
    counter_arguments: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          argument:               { type: "string" },
          example:                { type: "string" },
          how_to_concede_or_rebut:{ type: "string" },
        },
        required: ["argument", "example", "how_to_concede_or_rebut"],
      },
    },
    sample_thesis_statements: { type: "array", items: { type: "string" } },
  },
  required: ["candidate_positions", "supporting_arguments",
    "counter_arguments", "sample_thesis_statements"],
};

async function generateIdeaBank(task) {
  const s = store.settings;
  const body = {
    model: s.model,
    max_tokens: 2048,
    system: [
      "You are an IELTS Writing tutor preparing a candidate to write a Task 2 essay.",
      "Many candidates have the LANGUAGE but not the IDEAS at the moment of writing.",
      "Generate a structured idea bank for this prompt so the candidate can pick a",
      "stance and have arguments + concrete examples ready.",
      "",
      "Rules:",
      "- 2 or 3 'candidate_positions' covering the realistic stances on this prompt",
      "  (e.g. agree, disagree, both-sides-with-tilt). Each has a one-sentence",
      "  rationale for why a candidate might choose it.",
      "- 4 to 6 'supporting_arguments'. Each has a clear argument + a concrete real-world",
      "  example (a country/city/policy/study/historical event/named programme). Tag",
      "  which candidate position it best supports.",
      "- 3 'counter_arguments' the candidate should be aware of, each with a brief",
      "  example AND a one-line tactic for how to concede or rebut without weakening",
      "  their own position.",
      "- 2 to 3 'sample_thesis_statements' — full sentences a band-7+ candidate might",
      "  open with, each clearly committing to one of the candidate_positions.",
      "- All ideas must be IELTS-appropriate (general academic register, not technical/",
      "  professional). Avoid medical / niche-profession content — IELTS is profession-blind.",
      "",
      "Call the generate_idea_bank tool. Do not write prose.",
    ].join("\n"),
    messages: [{ role: "user", content: `TASK 2 PROMPT:\n\n${task.prompt}` }],
    tools: [{
      name: "generate_idea_bank",
      description: "Return a structured idea bank for a Task 2 prompt.",
      input_schema: IDEA_BANK_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "generate_idea_bank" },
  };

  const useDevice = !!s.apiKey;
  let res;
  try {
    res = useDevice
      ? await postWithRetry(ANTHROPIC_DIRECT_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": s.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(body),
        })
      : await postWithRetry(s.proxyUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
  } catch {
    const e = new Error("Cannot reach the marker."); e.code = "NEEDS_KEY"; throw e;
  }
  if (res.status === 404 || res.status === 503) {
    const e = new Error("Marker is not configured."); e.code = "NEEDS_KEY"; throw e;
  }
  if (!res.ok) throw new Error(`Idea generator failed (${res.status}).`);
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use" && b.name === "generate_idea_bank");
  if (!block || !block.input) throw new Error("Idea generator returned no result.");
  return block.input;
}

async function openIdeaBank(task) {
  $("#ideaModal").hidden = false;
  $("#ideaBody").innerHTML = markingSpinner("Brainstorming ideas with you…");
  startTicker();
  try {
    const bank = await generateIdeaBank(task);
    stopTicker();
    renderIdeaBank(task, bank);
  } catch (err) {
    stopTicker();
    $("#ideaBody").innerHTML = `<p class="section-lead">${esc(err.message)}</p>
      <div class="decon-actions">
        <button class="secondary-btn" id="ideaCancel" type="button">Close</button>
        <button class="primary-btn"   id="ideaRetry"  type="button">Try again</button>
      </div>`;
    $("#ideaCancel").onclick = () => { $("#ideaModal").hidden = true; };
    $("#ideaRetry").onclick  = () => openIdeaBank(task);
  }
}

function renderIdeaBank(task, bank) {
  const html = `
    <div class="decon-prompt">${esc(task.prompt).replace(/\n\n/g, "<br><br>")}</div>

    <div class="decon-section">
      <h3>Positions you could take</h3>
      ${bank.candidate_positions.map((p) => `<div class="idea-position">
        <div class="idea-stance">${esc(p.stance)}</div>
        <div class="idea-why">${esc(p.why_take_this)}</div>
      </div>`).join("")}
    </div>

    <div class="decon-section">
      <h3>Supporting arguments + real examples</h3>
      ${bank.supporting_arguments.map((a) => `<div class="idea-arg idea-arg-support">
        <div class="idea-arg-head">${esc(a.argument)}</div>
        <div class="idea-arg-eg">e.g. ${esc(a.example)}</div>
        <div class="idea-arg-tag">Best for: ${esc(a.best_for_position)}</div>
      </div>`).join("")}
    </div>

    <div class="decon-section">
      <h3>Counter-arguments + how to handle</h3>
      ${bank.counter_arguments.map((c) => `<div class="idea-arg idea-arg-counter">
        <div class="idea-arg-head">${esc(c.argument)}</div>
        <div class="idea-arg-eg">e.g. ${esc(c.example)}</div>
        <div class="idea-arg-tag">How to concede/rebut: ${esc(c.how_to_concede_or_rebut)}</div>
      </div>`).join("")}
    </div>

    <div class="decon-section">
      <h3>Sample thesis statements</h3>
      ${bank.sample_thesis_statements.map((t) => `<div class="idea-thesis">${esc(t)}</div>`).join("")}
    </div>

    <div class="decon-actions">
      <button class="secondary-btn" id="ideaLater" type="button">Maybe later</button>
      <button class="primary-btn"   id="ideaStart" type="button">Start writing this ▸</button>
    </div>`;
  $("#ideaBody").innerHTML = html;
  $("#ideaLater").onclick = () => { $("#ideaModal").hidden = true; };
  $("#ideaStart").onclick = () => {
    $("#ideaModal").hidden = true;
    startExam("single", task.id);
  };
}

/* ============================== DRILL MODE ============================== */
/* The Coach knows the candidate's recurring patterns. Drill Mode lets her
   practise them in isolation: Claude generates 5 personalised micro-exercises
   targeting THAT pattern, using HER actual misspelled/misused words. Each
   answer is matched against the accepted-answer list and a score persists. */

const DRILL_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    exercises: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          prompt:      { type: "string" },
          accept:      { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
        },
        required: ["prompt", "accept", "explanation"],
      },
    },
    closing_advice: { type: "string" },
  },
  required: ["exercises", "closing_advice"],
};

async function generateDrill(pattern) {
  const s = store.settings;
  const examples = (pattern.examples || []).slice(0, 8);
  const body = {
    model: s.model,
    max_tokens: 2048,
    system: [
      "You are a focused IELTS Writing tutor. The candidate has a specific recurring",
      "weakness identified across their essays. Generate exactly 5 targeted micro-",
      "exercises that test ONLY this pattern.",
      "",
      "Rules for each exercise:",
      "- One sentence, or a short fill-in-the-blank, or a rewrite task.",
      "- The pattern under test must be the dominant issue in the exercise.",
      "- Have a clear, unambiguous correct answer (or a very small set of accepted answers).",
      "- Where possible, use vocabulary and topics the candidate is likely to meet in",
      "  IELTS Academic Writing Task 2 (education, environment, technology, society,",
      "  work, health). Avoid medical / profession-specific topics — IELTS is profession-blind.",
      "- Where the pattern involves spelling, use the candidate's actual misspelled words.",
      "",
      "'accept' is an array of acceptable answers — keep variants minimal but cover the",
      "obvious alternatives (e.g. with/without trailing punctuation, common synonyms).",
      "Each answer string MUST be lowercased and trimmed.",
      "'explanation' is one short sentence saying why the correct answer is right.",
      "'closing_advice' is one short paragraph summarising how to internalise this pattern.",
      "",
      "Call the generate_drill tool. Do not write prose.",
    ].join("\n"),
    messages: [{
      role: "user",
      content:
        `RECURRING PATTERN: ${pattern.name}\n\n` +
        `RULE: ${pattern.rule || "(not stated)"}\n\n` +
        `FIX GUIDANCE: ${pattern.fix || "(not stated)"}\n\n` +
        `EXAMPLES FROM THE CANDIDATE'S OWN ESSAYS:\n${examples.length ? examples.map(e => `  - ${e}`).join("\n") : "  (no examples logged yet)"}\n\n` +
        `Generate exactly 5 personalised drills.`,
    }],
    tools: [{
      name: "generate_drill",
      description: "Return a personalised 5-exercise drill targeting one recurring pattern.",
      input_schema: DRILL_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "generate_drill" },
  };

  const useDevice = !!s.apiKey;
  let res;
  try {
    res = useDevice
      ? await postWithRetry(ANTHROPIC_DIRECT_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": s.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(body),
        })
      : await postWithRetry(s.proxyUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
  } catch {
    const e = new Error("Cannot reach the marker."); e.code = "NEEDS_KEY"; throw e;
  }
  if (res.status === 404 || res.status === 503) {
    const e = new Error("Marker is not configured."); e.code = "NEEDS_KEY"; throw e;
  }
  if (!res.ok) throw new Error(`Drill generator failed (${res.status}).`);
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use" && b.name === "generate_drill");
  if (!block || !block.input || !Array.isArray(block.input.exercises) || block.input.exercises.length === 0) {
    throw new Error("Drill generator returned no exercises.");
  }
  return block.input;
}

async function openDrill(pattern) {
  show("drill");
  $("#drillBody").innerHTML = markingSpinner(`Generating personalised drills for: ${esc(pattern.name)}…`);
  startTicker();
  try {
    const spec = await generateDrill(pattern);
    stopTicker();
    renderDrill(pattern, spec);
  } catch (err) {
    stopTicker();
    $("#drillBody").innerHTML = `<button class="back-btn" type="button" id="drillBack">← Coach</button>
      <div class="panel">
        <h3>Couldn't generate drill</h3>
        <p class="section-lead">${esc(err.message)}</p>
        <button class="primary-btn" id="drillRetry" type="button">Try again</button>
      </div>`;
    $("#drillBack").onclick  = () => renderCoach();
    $("#drillRetry").onclick = () => openDrill(pattern);
  }
}

function renderDrill(pattern, spec) {
  let html = `<button class="back-btn" type="button" id="drillBack">← Coach</button>
    <h2 class="view-title">Drill — ${esc(pattern.name)}</h2>
    <div class="drill-pattern-info">
      <div class="pat-name">${esc(pattern.name)}</div>
      ${pattern.rule ? `<div class="pat-rule">${esc(pattern.rule)}</div>` : ""}
      ${pattern.fix  ? `<div class="pat-fix">${esc(pattern.fix)}</div>` : ""}
    </div>
    <p class="section-lead">${spec.exercises.length} short exercises personalised to your essays. Type each answer, then press <b>Mark all</b> at the bottom.</p>`;

  spec.exercises.forEach((ex, i) => {
    html += `<div class="drill-card" data-drill-card="${i}">
      <p class="drill-prompt"><b>${i + 1}.</b> ${esc(ex.prompt)}</p>
      <input class="drill-input" type="text" data-input="${i}"
             autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <div class="drill-result" data-result="${i}" hidden></div>
    </div>`;
  });

  html += `<div class="result-actions">
    <button class="secondary-btn" id="drillCancel" type="button">Back to Coach</button>
    <button class="primary-btn"   id="drillMark"   type="button">Mark all ▸</button>
  </div>
  <div id="drillSummary"></div>`;

  $("#drillBody").innerHTML = html;
  $("#drillBack").onclick   = () => renderCoach();
  $("#drillCancel").onclick = () => renderCoach();

  $("#drillMark").onclick = () => {
    let score = 0;
    spec.exercises.forEach((ex, i) => {
      const input = $(`[data-input="${i}"]`);
      const userRaw = input.value.trim();
      const userLow = userRaw.toLowerCase();
      const accepts = (ex.accept || []).map((a) => String(a).toLowerCase().trim());
      const right = accepts.includes(userLow);
      const resultEl = $(`[data-result="${i}"]`);
      const card = $(`[data-drill-card="${i}"]`);
      input.disabled = true;
      resultEl.hidden = false;
      resultEl.className = `drill-result ${right ? "right" : "wrong"}`;
      card.classList.add(right ? "right" : "wrong");
      if (right) {
        resultEl.innerHTML = `<b>✓ Correct.</b> ${esc(ex.explanation || "")}`;
        score++;
      } else {
        const expected = accepts[0] || "(no expected answer logged)";
        resultEl.innerHTML = `<b>✗ Not quite.</b> ${esc(ex.explanation || "")}
          <span class="drill-result-correct">Accepted answer: ${esc(expected)}</span>`;
      }
    });

    if (!Array.isArray(store.drills)) store.drills = [];
    store.drills.push({
      ts: Date.now(),
      pattern: pattern.name,
      score: score, total: spec.exercises.length,
    });
    save();

    const sum = $("#drillSummary");
    const pct = Math.round(100 * score / spec.exercises.length);
    sum.innerHTML = `<div class="result-hero" style="margin-top:16px">
      <div class="result-hero-label">Drill score</div>
      <div class="result-hero-band">${score}/${spec.exercises.length}</div>
      <div class="result-hero-target">${pct >= 80 ? `<b class="hit">Strong — keep this pattern under control in your next essay.</b>` : pct >= 50 ? `<b class="miss">Half-way — try another drill or write a fresh essay.</b>` : `<b class="miss">Pattern still active — drill again before your next essay.</b>`}</div>
      <div class="result-hero-note">${esc(spec.closing_advice || "")}</div>
    </div>
    <div class="result-actions">
      <button class="secondary-btn" id="drillAgain" type="button">Drill this pattern again</button>
      <button class="primary-btn"   id="drillToCoach" type="button">Back to Coach</button>
    </div>`;

    $("#drillAgain").onclick   = () => openDrill(pattern);
    $("#drillToCoach").onclick = () => renderCoach();

    $("#drillMark").disabled = true;
    $("#drillMark").textContent = `Marked: ${score}/${spec.exercises.length}`;
  };

  // focus first input for fast typing
  setTimeout(() => { const first = $(`[data-input="0"]`); if (first) first.focus(); }, 50);
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
$("#navVault").onclick    = renderVault;
$("#navLearn").onclick    = renderLearn;
$("#editTarget").onclick  = openSettings;
$$("[data-back]").forEach((b) => (b.onclick = () => { show("home"); renderHome(); }));
$$("[data-start]").forEach((b) => (b.onclick = () => openPicker(b.dataset.start)));
$("#learnCta").onclick = renderLearn;

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
$("#deconClose").onclick    = () => ($("#deconstructModal").hidden = true);
$("#ideaClose").onclick     = () => ($("#ideaModal").hidden = true);
$("#resetProgress").onclick = () => confirmDialog(
  "Full reset: this wipes your essay history, spelling vault, mastered modules, drill scores, streak and milestones. Settings (your name, target band, examiner config) stay. Continue?",
  () => {
    const keepSettings = { ...store.settings };
    store = defaults();
    store.settings = keepSettings;
    save();
    $("#settingsModal").hidden = true;
    show("home"); renderHome();
    toast("Full reset done — clean slate.");
  }
);

/* ============================== CD-IELTS RULES ============================== */
/* When the exam screen is active, mimic the real CD-IELTS browser environment:
   - Disable F5 / Ctrl+R (reload) — accidental refresh would wipe the attempt.
   - Disable Ctrl+P (print) and Ctrl+F (browser find) — neither is available
     in the real test.
   - Disable right-click context menu inside the exam screen (no spell-check
     workaround, no "Inspect element" to peek at structure).
   - Allow Cut / Copy / Paste / Undo / Redo (Ctrl+X/C/V/Z/Y) — the real exam does.
   - Warn before navigating away while the timer is running. */
function isExamActive() {
  const el = document.getElementById("view-exam");
  return el && !el.hidden && exam.timer;
}
document.addEventListener("keydown", (e) => {
  if (!isExamActive()) return;
  const k = (e.key || "").toLowerCase();
  if (k === "f5") { e.preventDefault(); toast("Refresh is disabled during the exam."); return; }
  if (e.ctrlKey || e.metaKey) {
    if (k === "r") { e.preventDefault(); toast("Refresh is disabled during the exam."); return; }
    if (k === "p") { e.preventDefault(); toast("Print is disabled during the exam."); return; }
    if (k === "f") { e.preventDefault(); toast("Browser find is disabled during the exam."); return; }
  }
}, true);
document.getElementById("view-exam").addEventListener("contextmenu", (e) => {
  if (isExamActive()) e.preventDefault();
});
window.addEventListener("beforeunload", (e) => {
  if (isExamActive()) { e.preventDefault(); e.returnValue = ""; }
});

// first render
renderHome();
show("home");

})();
