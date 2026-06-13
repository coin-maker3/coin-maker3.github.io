// ─── IELTS Write Pro — App Logic ──────────────────────────────────────────

'use strict';

// ─── State ─────────────────────────────────────────────────────────────────

const state = {
  screen: 'setup',
  mode: 'practice',
  taskType: null,
  task: null,
  chart: null,
  timer: {
    total: 0,
    remaining: 0,
    interval: null,
    running: false
  },
  essay: '',
  wordCount: 0,
  feedback: null,
  quickCheckCard: null
};

// ─── Screen Management ─────────────────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const target = document.getElementById('screen-' + name);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  state.screen = name;
}

// ─── Task Selection ────────────────────────────────────────────────────────

function selectTaskType(type) {
  state.taskType = type;

  document.getElementById('card-task1').classList.remove('selected');
  document.getElementById('card-task2').classList.remove('selected');
  document.getElementById('card-task' + type).classList.add('selected');

  const opts = document.getElementById('setup-options');
  opts.classList.remove('hidden');
}

function setMode(mode) {
  state.mode = mode;
  document.getElementById('btn-practice').classList.toggle('active', mode === 'practice');
  document.getElementById('btn-exam').classList.toggle('active', mode === 'exam');
}

// ─── Generate Task ─────────────────────────────────────────────────────────

function generateTask() {
  if (!state.taskType) {
    showToast('Please select a task type first.', 'error');
    return;
  }

  const pool = state.taskType === '1' ? TASK1_PROMPTS : TASK2_PROMPTS;
  const task = pool[Math.floor(Math.random() * pool.length)];
  state.task = task;

  // Reset editor
  const editor = document.getElementById('essay-editor');
  editor.value = '';
  state.essay = '';
  state.wordCount = 0;
  updateWordCount();

  // Update task badge
  const badge = document.getElementById('task-badge');
  badge.textContent = 'Task ' + state.taskType;
  badge.classList.remove('hidden');

  showScreen('writing');
  renderTaskPanel(task);

  if (state.mode === 'exam') {
    const minutes = state.taskType === '1' ? 20 : 40;
    startTimer(minutes);
    document.getElementById('header-hud').classList.remove('hidden');
  } else {
    stopTimer();
    document.getElementById('header-hud').classList.add('hidden');
    // Still show word counter in HUD for practice
    document.getElementById('header-hud').classList.remove('hidden');
    document.getElementById('timer-display').style.display = 'none';
    document.querySelector('.hud-divider') && (document.querySelector('.hud-divider').style.display = 'none');
  }
}

// ─── Render Task Panel ─────────────────────────────────────────────────────

function renderTaskPanel(task) {
  const panel = document.getElementById('task-panel');

  // Destroy previous chart
  destroyChart();

  if (state.taskType === '1') {
    panel.innerHTML = `
      <div class="task-type-label">IELTS Academic Writing Task 1</div>
      <h2 class="task-title">${escapeHtml(task.title)}</h2>
      <p class="task-instruction">${escapeHtml(task.instruction)}</p>
      <p class="task-question">${escapeHtml(task.question).replace(/\n/g, '<br>')}</p>
      <div class="task-chart-container">
        <canvas id="task-chart"></canvas>
      </div>
    `;
    // We need innerHTML to process tags so re-apply the question with proper html
    panel.querySelector('.task-instruction').innerHTML = escapeHtml(task.instruction);
    panel.querySelector('.task-question').innerHTML = escapeHtml(task.question).replace(/\n/g, '<br>');
    renderChart(task.chartConfig);
  } else {
    panel.innerHTML = `
      <div class="task-type-label">IELTS Academic Writing Task 2</div>
      <h2 class="task-title">Essay Prompt</h2>
      <div class="task-prompt-text">${escapeHtml(task.prompt).replace(/\n/g, '<br>')}</div>
      <div class="task-meta">
        <span class="meta-item">Suggested time: ${task.suggestedTime} minutes</span>
        <span class="meta-item">Minimum: 250 words</span>
      </div>
    `;
  }

  // Update word count target label
  const target = state.taskType === '1' ? 150 : 250;
  const label = document.getElementById('word-count-label');
  if (label) label.textContent = '0 / ' + target + ' words';
}

// ─── Chart Rendering ───────────────────────────────────────────────────────

function destroyChart() {
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
}

function renderChart(chartConfig) {
  const canvas = document.getElementById('task-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  state.chart = new Chart(ctx, chartConfig);
}

// ─── Timer ─────────────────────────────────────────────────────────────────

function startTimer(minutes) {
  stopTimer();
  state.timer.total = minutes * 60;
  state.timer.remaining = state.timer.total;
  state.timer.running = true;

  updateTimerDisplay();

  state.timer.interval = setInterval(() => {
    if (state.timer.remaining <= 0) {
      stopTimer();
      showToast("Time's up! Submitting your response...", 'warning');
      submitEssay();
      return;
    }
    state.timer.remaining--;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
  }
  state.timer.running = false;
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (!display) return;
  display.textContent = formatTime(state.timer.remaining);

  // Warning color when < 5 minutes
  if (state.timer.remaining < 300) {
    display.classList.add('timer-warning');
  } else {
    display.classList.remove('timer-warning');
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

// ─── Word Count ────────────────────────────────────────────────────────────

function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function updateWordCount() {
  const text = state.essay;
  const count = text.trim().length === 0 ? 0 : countWords(text);
  state.wordCount = count;

  const target = state.taskType === '1' ? 150 : 250;

  // Header HUD counter
  const hudCount = document.getElementById('word-count');
  if (hudCount) hudCount.textContent = count;

  // Editor footer label
  const label = document.getElementById('word-count-label');
  if (label) label.textContent = count + ' / ' + target + ' words';

  // Progress bar
  const fill = document.getElementById('word-progress-fill');
  if (fill) {
    const pct = Math.min((count / target) * 100, 100);
    fill.style.width = pct + '%';

    if (count < target * 0.5) {
      fill.style.backgroundColor = '#ef4444';
    } else if (count < target) {
      fill.style.backgroundColor = '#f59e0b';
    } else {
      fill.style.backgroundColor = '#d4a843';
    }
  }
}

// ─── Modal (API Key) ───────────────────────────────────────────────────────

function openModal() {
  const modal = document.getElementById('modal-apikey');
  const input = document.getElementById('input-apikey');
  const saved = localStorage.getItem('ielts_pro_key') || '';
  input.value = saved;
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 100);
}

function closeModal() {
  document.getElementById('modal-apikey').classList.add('hidden');
}

function saveApiKey() {
  const input = document.getElementById('input-apikey');
  const key = input.value.trim();

  if (!key) {
    showToast('Please enter an API key.', 'error');
    return;
  }
  if (!key.startsWith('sk-ant-')) {
    showToast('Invalid key format. Claude keys start with sk-ant-', 'error');
    return;
  }

  localStorage.setItem('ielts_pro_key', key);
  showToast('API key saved successfully!', 'success');
  closeModal();

  // Hide the no-key banner if visible
  const banner = document.getElementById('no-key-banner');
  if (banner) banner.remove();
}

function getApiKey() {
  return localStorage.getItem('ielts_pro_key') || '';
}

// ─── Toast Notifications ───────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast toast-' + type;
  toast.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// ─── Quick Check ───────────────────────────────────────────────────────────

async function quickCheck() {
  const apiKey = getApiKey();
  if (!apiKey) {
    openModal();
    showToast('Please set your API key first.', 'error');
    return;
  }

  if (state.wordCount < 50) {
    showToast('Write at least 50 words before using Quick Check.', 'error');
    return;
  }

  const btn = document.getElementById('btn-quick-check');
  btn.disabled = true;
  btn.textContent = 'Checking...';

  // Remove previous quick check card
  removeQuickCheckCard();

  try {
    const result = await quickCheckEssay({
      apiKey,
      taskType: state.taskType,
      essayText: state.essay,
      wordCount: state.wordCount
    });

    showQuickCheckCard(result);
  } catch (err) {
    showToast('Quick check failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Quick Check';
  }
}

function showQuickCheckCard(result) {
  removeQuickCheckCard();

  const card = document.createElement('div');
  card.id = 'quick-check-card';
  card.className = 'quick-check-card';

  const overall = result.overall || result.overall_band || 0;
  const ta = result.ta || 0;
  const cc = result.cc || 0;
  const lr = result.lr || 0;
  const gr = result.gr || 0;

  card.innerHTML = `
    <div class="qc-header">
      <span class="qc-title">Estimated Scores</span>
      <button class="qc-close" onclick="removeQuickCheckCard()">✕</button>
    </div>
    <div class="qc-overall">Band <strong>${overall}</strong></div>
    <div class="qc-scores">
      <div class="qc-score-row"><span>Task Achievement</span><span class="qc-val">${ta}</span></div>
      <div class="qc-score-row"><span>Coherence & Cohesion</span><span class="qc-val">${cc}</span></div>
      <div class="qc-score-row"><span>Lexical Resource</span><span class="qc-val">${lr}</span></div>
      <div class="qc-score-row"><span>Grammatical Range</span><span class="qc-val">${gr}</span></div>
    </div>
    <p class="qc-note">Estimated mid-writing score — not your final grade.</p>
  `;

  // Insert after the quick check button
  const btn = document.getElementById('btn-quick-check');
  btn.parentNode.insertBefore(card, btn.nextSibling);
  state.quickCheckCard = card;
}

function removeQuickCheckCard() {
  const existing = document.getElementById('quick-check-card');
  if (existing) existing.remove();
  state.quickCheckCard = null;
}

// ─── Submit Essay ──────────────────────────────────────────────────────────

async function submitEssay() {
  const apiKey = getApiKey();
  if (!apiKey) {
    openModal();
    showToast('Please set your API key to get feedback.', 'error');
    return;
  }

  const target = state.taskType === '1' ? 150 : 250;
  if (state.wordCount < target) {
    const proceed = confirm(
      `Your response is ${state.wordCount} words, below the minimum of ${target}. The examiner will penalise this.\n\nSubmit anyway?`
    );
    if (!proceed) return;
  }

  if (state.wordCount < 10) {
    showToast('Please write something before submitting.', 'error');
    return;
  }

  stopTimer();
  removeQuickCheckCard();
  showScreen('analyzing');
  startAnalyzingAnimation();

  // Build task prompt text
  let taskPromptText = '';
  if (state.taskType === '1') {
    taskPromptText = (state.task.instruction || '') + '\n\n' + (state.task.question || '');
  } else {
    taskPromptText = state.task.prompt || '';
  }

  try {
    const result = await analyzeEssay({
      apiKey,
      taskType: state.taskType,
      taskPrompt: taskPromptText,
      essayText: state.essay,
      wordCount: state.wordCount
    });

    state.feedback = result;
    displayFeedback(result);
    showScreen('feedback');
  } catch (err) {
    showScreen('writing');
    showToast('Analysis failed: ' + err.message, 'error');
  }
}

// ─── Analyzing Screen Animation ────────────────────────────────────────────

function startAnalyzingAnimation() {
  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active', 'done');
  });

  const activate = (id, delay) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        // Mark previous as done
        const idx = steps.indexOf(id);
        if (idx > 0) {
          const prev = document.getElementById(steps[idx - 1]);
          if (prev) {
            prev.classList.remove('active');
            prev.classList.add('done');
          }
        }
        el.classList.add('active');
      }
    }, delay);
  };

  activate('step-1', 0);
  activate('step-2', 1500);
  activate('step-3', 3000);
  activate('step-4', 4500);
}

// ─── Display Feedback ──────────────────────────────────────────────────────

function displayFeedback(data) {
  // Overall band score
  const overallEl = document.getElementById('overall-score');
  if (overallEl) {
    overallEl.textContent = data.overall_band;
    overallEl.className = 'overall-score';
    if (data.overall_band >= 7) {
      overallEl.classList.add('score-green');
    } else if (data.overall_band >= 6) {
      overallEl.classList.add('score-amber');
    } else {
      overallEl.classList.add('score-red');
    }
  }

  // Summary
  const summaryEl = document.getElementById('feedback-summary');
  if (summaryEl) summaryEl.textContent = data.summary || '';

  // Score bars - animate after a short delay so CSS transitions fire
  const scores = data.scores || {};
  setTimeout(() => {
    animateScoreBar('bar-ta', 'val-ta', scores.task_achievement || 0);
    animateScoreBar('bar-cc', 'val-cc', scores.coherence_cohesion || 0);
    animateScoreBar('bar-lr', 'val-lr', scores.lexical_resource || 0);
    animateScoreBar('bar-gr', 'val-gr', scores.grammatical_range || 0);
  }, 150);

  // Annotated essay
  annotateEssay(state.essay, data.highlights || []);

  // Detailed feedback sections
  renderDetailedFeedback(data.feedback || {});
}

function animateScoreBar(barId, valId, score) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (!bar || !val) return;

  val.textContent = score;
  const pct = (score / 9) * 100;

  // Set color
  if (score >= 7) {
    bar.style.backgroundColor = '#d4a843';
  } else if (score >= 5.5) {
    bar.style.backgroundColor = '#f59e0b';
  } else {
    bar.style.backgroundColor = '#ef4444';
  }

  // Trigger transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.width = pct + '%';
    });
  });
}

// ─── Essay Annotation ─────────────────────────────────────────────────────

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function annotateEssay(essayText, highlights) {
  const container = document.getElementById('annotated-essay');
  if (!container) return;

  if (!highlights || highlights.length === 0) {
    container.innerHTML = escapeHtml(essayText).replace(/\n/g, '<br>');
    return;
  }

  // Find positions of each highlight phrase in the essay
  const positions = [];
  highlights.forEach(h => {
    if (!h.phrase || !h.type) return;
    const idx = essayText.indexOf(h.phrase);
    if (idx === -1) return;
    positions.push({
      start: idx,
      end: idx + h.phrase.length,
      phrase: h.phrase,
      type: h.type,
      comment: h.comment || ''
    });
  });

  // Sort by start position
  positions.sort((a, b) => a.start - b.start);

  // Remove overlaps (keep first occurrence / lower start index)
  const filtered = [];
  let lastEnd = 0;
  for (const p of positions) {
    if (p.start >= lastEnd) {
      filtered.push(p);
      lastEnd = p.end;
    }
  }

  // Build HTML output
  let html = '';
  let cursor = 0;

  for (const p of filtered) {
    if (p.start > cursor) {
      html += escapeHtml(essayText.slice(cursor, p.start)).replace(/\n/g, '<br>');
    }
    const escapedPhrase = escapeHtml(p.phrase);
    const escapedComment = escapeHtml(p.comment);
    html += `<mark class="hl-${p.type}">${escapedPhrase}<span class="hl-tip">${escapedComment}</span></mark>`;
    cursor = p.end;
  }

  // Remaining text
  if (cursor < essayText.length) {
    html += escapeHtml(essayText.slice(cursor)).replace(/\n/g, '<br>');
  }

  container.innerHTML = html;
}

// ─── Detailed Feedback Sections ────────────────────────────────────────────

function renderDetailedFeedback(feedback) {
  const container = document.getElementById('feedback-details');
  if (!container) return;

  const criteria = [
    { key: 'task_achievement', label: 'Task Achievement', id: 'ta' },
    { key: 'coherence_cohesion', label: 'Coherence & Cohesion', id: 'cc' },
    { key: 'lexical_resource', label: 'Lexical Resource', id: 'lr' },
    { key: 'grammatical_range', label: 'Grammatical Range & Accuracy', id: 'gr' }
  ];

  const scores = (state.feedback && state.feedback.scores) || {};

  container.innerHTML = criteria.map(c => {
    const score = scores[c.key] || 0;
    const text = feedback[c.key] || 'No feedback available.';
    return `
      <div class="feedback-accordion open" id="acc-${c.id}">
        <button class="acc-header" onclick="toggleAccordion('acc-${c.id}')">
          <span class="acc-label">${escapeHtml(c.label)}</span>
          <span class="acc-score">${score}</span>
          <span class="acc-arrow">▾</span>
        </button>
        <div class="acc-body">
          <p>${escapeHtml(text)}</p>
        </div>
      </div>
    `;
  }).join('');
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
}

// ─── Practice Again ────────────────────────────────────────────────────────

function practiceAgain() {
  stopTimer();
  destroyChart();
  removeQuickCheckCard();

  state.task = null;
  state.taskType = null;
  state.essay = '';
  state.wordCount = 0;
  state.feedback = null;
  state.mode = 'practice';

  // Reset editor
  const editor = document.getElementById('essay-editor');
  if (editor) editor.value = '';

  // Reset header HUD
  document.getElementById('header-hud').classList.add('hidden');
  document.getElementById('task-badge').classList.add('hidden');

  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.style.display = '';
    timerDisplay.textContent = '20:00';
    timerDisplay.classList.remove('timer-warning');
  }

  const divider = document.querySelector('.hud-divider');
  if (divider) divider.style.display = '';

  // Reset task card selection
  document.getElementById('card-task1').classList.remove('selected');
  document.getElementById('card-task2').classList.remove('selected');
  document.getElementById('setup-options').classList.add('hidden');

  // Reset mode buttons
  setMode('practice');

  showScreen('setup');
}

// ─── Initialisation ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Essay editor - input listener
  const editor = document.getElementById('essay-editor');
  if (editor) {
    editor.addEventListener('input', (e) => {
      state.essay = e.target.value;
      updateWordCount();
    });
  }

  // API key save button
  const saveBtn = document.getElementById('btn-save-key');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveApiKey);
  }

  // Enter key in API key input
  const keyInput = document.getElementById('input-apikey');
  if (keyInput) {
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveApiKey();
    });
  }

  // Show a subtle banner if no API key set
  if (!localStorage.getItem('ielts_pro_key')) {
    const setupContainer = document.querySelector('.setup-container');
    if (setupContainer) {
      const banner = document.createElement('div');
      banner.id = 'no-key-banner';
      banner.className = 'no-key-banner';
      banner.innerHTML = `
        <span>⚙ Set your Claude API key to enable AI feedback.</span>
        <button onclick="openModal()" class="banner-btn">Add Key →</button>
      `;
      setupContainer.insertBefore(banner, setupContainer.firstChild);
    }
  }

  // Close modal on overlay click (already handled via onclick on overlay)
  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
});
