/* Lantern Logic web daily: board UI, input, timer, hints, streaks, share.
   Rules live in puzzle.js (a port of the app's puzzle.gd). No dependencies. */
(function () {
  'use strict';

  var P = window.LanternPuzzle;
  var EMPTY = P.EMPTY, MARK = P.MARK, LANTERN = P.LANTERN;
  var BASE = '/lantern-logic/';
  var SITE = 'https://coin-maker3.github.io' + BASE;
  var FREE_HINTS_PER_DAY = 3;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // App palette (scripts/ui/palette.gd), darkened 22% like Pal.region_color().
  var REGION_COLORS = ['#b37c00', '#438cb6', '#007b5a', '#bbb233', '#00598b', '#a64900',
    '#9f5e82', '#7d7d7d', '#6d538a', '#815c17', '#509781'];
  var REGION_NAMES = ['orange', 'sky blue', 'green', 'yellow', 'blue', 'vermilion',
    'pink', 'grey', 'violet', 'brown', 'teal'];
  var DARK_REGIONS = { 4: true }; // luminance < 0.33: draw light marks (as in the app)

  // ------------------------------------------------------------ storage
  // Everything is wrapped: private mode, blocked storage or quota errors
  // fall back to an in-memory copy for this visit.
  var KEY = 'lanternlogic.web.v1';
  var data = {};
  try {
    var raw = window.localStorage.getItem(KEY);
    data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== 'object') data = {};
  } catch (e) { data = {}; }
  // The levels page shares this record: re-read it and write back only the
  // keys this page owns, so another open tab's progress is never overwritten.
  var OWN = ['settings', 'hints', 'days', 'results', 'progress'];
  function save() {
    try {
      var fresh = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {};
      OWN.forEach(function (k) { if (k in data) fresh[k] = data[k]; });
      window.localStorage.setItem(KEY, JSON.stringify(fresh));
    } catch (e) { /* memory only */ }
  }
  function bucket(name) {
    if (!data[name] || typeof data[name] !== 'object') data[name] = {};
    return data[name];
  }
  var settings = bucket('settings');
  if (typeof settings.autoX !== 'boolean') settings.autoX = true;
  if (typeof settings.patterns !== 'boolean') settings.patterns = false;

  // ------------------------------------------------------------ helpers
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function icon(name, cls) {
    var s = svgEl('svg', { 'class': cls || 'ico', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svgEl('use', { href: '#i-' + name }));
    return s;
  }
  function parseKey(k) {
    var p = String(k).split('-');
    return { year: +p[0], month: +p[1], day: +p[2] };
  }
  function longDate(d) {
    var t = new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
    return WEEKDAYS[t.getUTCDay()] + ' ' + d.day + ' ' + MONTHS[d.month - 1] + ' ' + d.year;
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ------------------------------------------------------------ streaks
  // Like Game.current_streak(): consecutive solved days ending today (or
  // yesterday if today is not solved yet). Only puzzles solved on their own
  // day count, as in the app where only today's daily can be played.
  function dayDone(d) { return !!bucket('days')[P.dateKey(d)]; }
  function currentStreak() {
    var d = P.localToday();
    if (!dayDone(d)) d = P.addDays(d, -1);
    var s = 0;
    while (dayDone(d) && s < 10000) { s++; d = P.addDays(d, -1); }
    return s;
  }
  function bestStreak() {
    var keys = Object.keys(bucket('days')).sort(), best = 0, run = 0, prev = -1e9;
    keys.forEach(function (k) {
      var dn = P.dayNumber(parseKey(k));
      run = dn === prev + 1 ? run + 1 : 1;
      prev = dn;
      best = Math.max(best, run);
    });
    return best;
  }
  function hintsLeft() {
    var h = bucket('hints'), today = P.dateKey(P.localToday());
    if (h.date !== today) { h.date = today; h.left = FREE_HINTS_PER_DAY; save(); }
    return h.left;
  }

  // ------------------------------------------------------------ archive list marks
  function markArchive() {
    var res = bucket('results');
    var links = document.querySelectorAll('[data-solved-check]');
    for (var i = 0; i < links.length; i++) {
      var num = links[i].getAttribute('data-solved-check');
      if (res[num]) {
        links[i].classList.add('is-solved');
        var badge = links[i].querySelector('.solved-badge');
        if (badge) { badge.hidden = false; badge.textContent = P.formatTime(res[num].time); }
      }
    }
  }

  // ------------------------------------------------------------ game
  var root = $('play');
  markArchive();
  if (!root) return;

  var boardEl = $('board');
  var timerEl = $('timer');
  var statusEl = $('status');
  var undoBtn = $('btn-undo');
  var restartBtn = $('btn-restart');
  var hintBtn = $('btn-hint');
  var hintCount = $('hint-count');
  var winEl = $('win');
  var mode = root.getAttribute('data-mode');

  var puzzle = null, info = null;
  var cellEls = [];
  var focusIdx = 0;
  var elapsedMs = 0, startedAt = 0, running = false, tick = 0;
  var solved = false, interactive = false;
  var hintsUsed = 0, mistakes = 0;
  var hintTimer = 0;

  function todayNumber() { return P.dailyNumberFor(P.localToday()); }
  function elapsedSeconds() { return (elapsedMs + (running ? performance.now() - startedAt : 0)) / 1000; }

  function setStatus(text, kind) {
    statusEl.textContent = text || '';
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
  }

  // ---- timer
  function renderTime() { timerEl.textContent = P.formatTime(elapsedSeconds()); }
  function startTimer() {
    if (running || solved) return;
    running = true;
    startedAt = performance.now();
    tick = window.setInterval(renderTime, 250);
  }
  function stopTimer() {
    if (!running) return;
    elapsedMs += performance.now() - startedAt;
    running = false;
    window.clearInterval(tick);
    renderTime();
  }
  var pausedByHide = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (running) { stopTimer(); pausedByHide = true; }
      saveProgress();
    } else {
      if (pausedByHide && !solved) startTimer();
      pausedByHide = false;
      if (mode === 'today' && info && todayNumber() !== info.number && (!running || solved)) {
        setStatus('A new daily puzzle is ready. Reload the page to play it.', 'info');
      }
    }
  });
  window.addEventListener('pagehide', saveProgress);

  // ---- progress (an unfinished board survives a reload)
  function saveProgress() {
    if (!puzzle || solved) return;
    var prog = bucket('progress');
    var any = puzzle.cells.some(function (c) { return c !== EMPTY; });
    if (!any && elapsedSeconds() < 1) { delete prog[info.number]; save(); return; }
    prog[info.number] = { c: puzzle.cells.join(''), a: puzzle.autoMarks.slice(), t: Math.round(elapsedSeconds() * 1000), h: hintsUsed, m: mistakes };
    // keep only the latest few boards
    var keys = Object.keys(prog).sort(function (a, b) { return b - a; });
    keys.slice(8).forEach(function (k) { delete prog[k]; });
    save();
  }
  function clearProgress() {
    delete bucket('progress')[info.number];
    save();
  }

  // ---- board construction
  function buildBoard() {
    var n = puzzle.n;
    boardEl.textContent = '';
    boardEl.style.setProperty('--n', n);
    boardEl.setAttribute('aria-label', 'Puzzle board, ' + n + ' by ' + n);
    boardEl.removeAttribute('aria-busy');

    // Layer 1: colours, colour-blind patterns, grid and region borders.
    var svg = svgEl('svg', { 'class': 'board-art', viewBox: '0 0 ' + n + ' ' + n, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    var cellsG = svgEl('g', {}), patG = svgEl('g', { 'class': 'patterns' });
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n, g = puzzle.regions[i];
      cellsG.appendChild(svgEl('rect', { x: c, y: r, width: 1.02, height: 1.02, fill: REGION_COLORS[g % REGION_COLORS.length] }));
      patG.appendChild(svgEl('path', { d: patternPath(c, r, g % 11), 'class': 'pat pat-' + (g % 11) }));
    }
    svg.appendChild(cellsG);
    svg.appendChild(patG);
    svg.appendChild(svgEl('rect', { 'class': 'win-wash', x: 0, y: 0, width: n, height: n }));
    var thin = '', thick = '';
    for (var r2 = 0; r2 < n; r2++) {
      for (var c2 = 0; c2 < n; c2++) {
        var k = r2 * n + c2;
        if (c2 + 1 < n) {
          var seg = 'M' + (c2 + 1) + ' ' + r2 + 'V' + (r2 + 1);
          if (puzzle.regions[k + 1] !== puzzle.regions[k]) thick += seg; else thin += seg;
        }
        if (r2 + 1 < n) {
          var seg2 = 'M' + c2 + ' ' + (r2 + 1) + 'H' + (c2 + 1);
          if (puzzle.regions[k + n] !== puzzle.regions[k]) thick += seg2; else thin += seg2;
        }
      }
    }
    svg.appendChild(svgEl('path', { d: thin, 'class': 'grid-thin' }));
    svg.appendChild(svgEl('path', { d: thick, 'class': 'grid-thick' }));
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: n, height: n, 'class': 'grid-frame' }));
    boardEl.appendChild(svg);

    // Layer 2: one button per cell, rows for assistive tech.
    cellEls = [];
    var grid = el('div', 'cells');
    for (var row = 0; row < n; row++) {
      var rowEl = el('div', 'row', { role: 'row' });
      for (var col = 0; col < n; col++) {
        var idx = row * n + col;
        var wrap = el('div', 'gc', { role: 'gridcell' });
        var b = el('button', 'cell' + (DARK_REGIONS[puzzle.regions[idx] % 11] ? ' on-dark' : ''), { type: 'button', tabindex: idx === focusIdx ? '0' : '-1' });
        b.setAttribute('data-i', idx);
        b.appendChild(el('span', 'glow', { 'aria-hidden': 'true' }));
        b.appendChild(icon('mark', 'mk'));
        b.appendChild(icon('lantern', 'ln'));
        wrap.appendChild(b);
        rowEl.appendChild(wrap);
        cellEls.push(b);
      }
      grid.appendChild(rowEl);
    }
    boardEl.appendChild(grid);
    applySettings();
  }

  // Colour-blind patterns: 4 small marks per cell, one shape per region (app's _draw_pattern).
  function patternPath(c, r, kind) {
    var out = '', d = 0.11;
    for (var gy = 0; gy < 2; gy++) {
      for (var gx = 0; gx < 2; gx++) {
        var x = c + (gx + 0.5) / 2, y = r + (gy + 0.5) / 2;
        var f = function (v) { return Math.round(v * 1000) / 1000; };
        switch (kind) {
          case 0: out += circ(x, y, d * 0.55); break;
          case 1: out += 'M' + f(x - d) + ' ' + f(y + d) + 'L' + f(x + d) + ' ' + f(y - d); break;
          case 2: out += 'M' + f(x - d) + ' ' + f(y - d) + 'L' + f(x + d) + ' ' + f(y + d); break;
          case 3: out += 'M' + f(x - d) + ' ' + f(y) + 'H' + f(x + d); break;
          case 4: out += 'M' + f(x) + ' ' + f(y - d) + 'V' + f(y + d); break;
          case 5: out += 'M' + f(x - d) + ' ' + f(y) + 'H' + f(x + d) + 'M' + f(x) + ' ' + f(y - d) + 'V' + f(y + d); break;
          case 6: out += circ(x, y, d * 0.8); break;
          case 7: out += 'M' + f(x) + ' ' + f(y - d) + 'L' + f(x + d) + ' ' + f(y + d * 0.8) + 'H' + f(x - d) + 'Z'; break;
          case 8: out += 'M' + f(x - d * 0.75) + ' ' + f(y - d * 0.75) + 'h' + f(d * 1.5) + 'v' + f(d * 1.5) + 'h' + f(-d * 1.5) + 'Z'; break;
          case 9: out += circ(x - d * 0.5, y, d * 0.35) + circ(x + d * 0.5, y, d * 0.35); break;
          default: out += 'M' + f(x - d) + ' ' + f(y - d * 0.4) + 'L' + f(x) + ' ' + f(y + d * 0.5) + 'L' + f(x + d) + ' ' + f(y - d * 0.4);
        }
      }
    }
    return out;
  }
  function circ(x, y, rad) {
    var f = function (v) { return Math.round(v * 1000) / 1000; };
    return 'M' + f(x - rad) + ' ' + f(y) + 'a' + f(rad) + ' ' + f(rad) + ' 0 1 0 ' + f(rad * 2) + ' 0a' + f(rad) + ' ' + f(rad) + ' 0 1 0 ' + f(-rad * 2) + ' 0';
  }

  function cellLabel(i) {
    var n = puzzle.n, st = puzzle.cells[i];
    var what = st === LANTERN ? 'lantern' : st === MARK ? 'crossed out' : 'empty';
    return 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + ', ' +
      REGION_NAMES[puzzle.regions[i] % 11] + ' region, ' + what;
  }

  function render() {
    var bad = puzzle.conflicts();
    for (var i = 0; i < cellEls.length; i++) {
      var b = cellEls[i], st = puzzle.cells[i];
      var s = st === LANTERN ? 'lantern' : st === MARK ? 'mark' : 'empty';
      if (b.getAttribute('data-s') !== s) b.setAttribute('data-s', s);
      b.classList.toggle('auto', st === MARK && puzzle.autoMarks[i] > 0);
      b.classList.toggle('bad', !!bad[i]);
      var label = cellLabel(i) + (bad[i] ? ', breaks a rule' : '');
      if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    }
    var any = puzzle.cells.some(function (c) { return c !== EMPTY; });
    undoBtn.disabled = solved || !puzzle.history.length;
    restartBtn.disabled = solved || !any;
    var left = hintsLeft();
    hintCount.textContent = String(left);
    hintBtn.disabled = solved || left <= 0;
    hintBtn.setAttribute('aria-label', 'Hint, ' + left + ' left today');
  }

  function applySettings() {
    boardEl.classList.toggle('show-patterns', !!settings.patterns);
    var a = $('opt-autox'), p = $('opt-patterns');
    if (a) a.setAttribute('aria-checked', settings.autoX ? 'true' : 'false');
    if (p) p.setAttribute('aria-checked', settings.patterns ? 'true' : 'false');
  }

  // ---- moves
  function afterChange() {
    render();
    if (puzzle.isSolved()) onSolved(true);
    else saveProgress();
  }

  function tap(i) {
    if (!interactive) return;
    startTimer();
    var old = puzzle.cells[i], nxt = P.nextState(old);
    puzzle.snapshot();
    puzzle.setCell(i, nxt, settings.autoX);
    if (nxt === LANTERN && puzzle.lanternConflictsAt(i)) {
      mistakes++;
      setStatus('That lantern breaks a rule: it shares a row, column or colour, or touches another lantern.', 'error');
    } else {
      setStatus('');
    }
    clearHintRing();
    afterChange();
  }

  var dragSnapshot = false, painted = 0;
  function paint(i) {
    if (puzzle.cells[i] !== EMPTY) return;
    if (!dragSnapshot) { puzzle.snapshot(); dragSnapshot = true; startTimer(); }
    puzzle.setCell(i, MARK, false);
    painted++;
    render();
  }

  function undo() {
    if (solved || !interactive) return;
    if (puzzle.undo()) { setStatus(''); clearHintRing(); afterChange(); }
  }

  function restart() {
    if (solved || !interactive) return;
    puzzle.snapshot();
    var hist = puzzle.history.slice();
    puzzle.restart();
    puzzle.history = hist; // restart itself can be undone
    setStatus('Board cleared. Undo brings it back.', 'info');
    clearHintRing();
    afterChange();
  }

  function useHint() {
    if (solved || !interactive) return;
    if (hintsLeft() <= 0) {
      setStatus('No hints left today. Free hints refill tomorrow.', 'error');
      render();
      return;
    }
    var h = puzzle.hint();
    if (!h) return;
    bucket('hints').left = hintsLeft() - 1;
    save();
    hintsUsed++;
    startTimer();
    puzzle.snapshot();
    puzzle.setCell(h.cell, h.state, settings.autoX);
    clearHintRing();
    cellEls[h.cell].classList.add('hinted');
    hintTimer = window.setTimeout(clearHintRing, 4000);
    setStatus(h.reason, 'hint');
    afterChange();
  }
  function clearHintRing() {
    window.clearTimeout(hintTimer);
    for (var i = 0; i < cellEls.length; i++) cellEls[i].classList.remove('hinted');
  }

  // ---- input: tap cycles, drag paints crosses (board_view.gd semantics)
  var pressCell = -1, dragging = false, activePointer = null;
  function cellAt(x, y) {
    var rect = boardEl.getBoundingClientRect(), n = puzzle.n;
    if (x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return -1;
    var c = Math.min(n - 1, Math.max(0, Math.floor((x - rect.left) / rect.width * n)));
    var r = Math.min(n - 1, Math.max(0, Math.floor((y - rect.top) / rect.height * n)));
    return r * n + c;
  }
  boardEl.addEventListener('pointerdown', function (e) {
    if (!interactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var c = cellAt(e.clientX, e.clientY);
    if (c < 0) return;
    e.preventDefault();
    pressCell = c;
    dragging = false;
    dragSnapshot = false;
    painted = 0;
    activePointer = e.pointerId;
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    moveFocus(c, false);
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (pressCell < 0 || e.pointerId !== activePointer) return;
    var c = cellAt(e.clientX, e.clientY);
    if (c >= 0 && c !== pressCell && !dragging) { dragging = true; paint(pressCell); }
    if (dragging && c >= 0) paint(c);
  });
  function endPress(e, cancelled) {
    if (pressCell < 0 || e.pointerId !== activePointer) return;
    if (!dragging && !cancelled) tap(pressCell);
    else if (dragging && painted) { setStatus(''); afterChange(); }
    pressCell = -1;
    dragging = false;
    activePointer = null;
  }
  boardEl.addEventListener('pointerup', function (e) { endPress(e, false); });
  boardEl.addEventListener('pointercancel', function (e) { endPress(e, true); });
  // Keyboard (Enter/Space) and screen-reader activation arrive as clicks with detail 0.
  boardEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.cell') : null;
    if (!b || e.detail !== 0) return;
    var i = +b.getAttribute('data-i');
    moveFocus(i, true);
    tap(i);
  });
  boardEl.addEventListener('keydown', function (e) {
    if (!puzzle) return;
    var n = puzzle.n, r = Math.floor(focusIdx / n), c = focusIdx % n;
    switch (e.key) {
      case 'ArrowUp': r = Math.max(0, r - 1); break;
      case 'ArrowDown': r = Math.min(n - 1, r + 1); break;
      case 'ArrowLeft': c = Math.max(0, c - 1); break;
      case 'ArrowRight': c = Math.min(n - 1, c + 1); break;
      case 'Home': c = 0; break;
      case 'End': c = n - 1; break;
      default: return;
    }
    e.preventDefault();
    moveFocus(r * n + c, true);
  });
  function moveFocus(i, focus) {
    if (cellEls[focusIdx]) cellEls[focusIdx].setAttribute('tabindex', '-1');
    focusIdx = i;
    cellEls[i].setAttribute('tabindex', '0');
    if (focus) cellEls[i].focus();
    else cellEls[i].focus({ preventScroll: true });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      undo();
    }
  });

  undoBtn.addEventListener('click', undo);
  restartBtn.addEventListener('click', restart);
  hintBtn.addEventListener('click', useHint);
  function bindSwitch(id, keyName, onMsg, offMsg) {
    var b = $(id);
    if (!b) return;
    b.addEventListener('click', function () {
      settings[keyName] = !settings[keyName];
      save();
      applySettings();
      setStatus(settings[keyName] ? onMsg : offMsg, 'info');
    });
  }
  bindSwitch('opt-autox', 'autoX', 'Auto-cross on: placing a lantern crosses out the cells it rules out.', 'Auto-cross off.');
  bindSwitch('opt-patterns', 'patterns', 'Colour patterns on.', 'Colour patterns off.');

  // ---- win
  function onSolved(fresh) {
    if (solved) return;
    solved = true;
    interactive = false;
    stopTimer();
    clearHintRing();
    var secs = elapsedSeconds();
    var stars = P.starsFor(hintsUsed, mistakes);
    var countsForStreak = info.number === todayNumber();
    if (fresh) {
      var res = bucket('results'), prev = res[info.number];
      if (!prev || secs < prev.time) res[info.number] = { time: secs, stars: stars, n: puzzle.n };
      if (countsForStreak) bucket('days')[P.dateKey(P.localToday())] = info.number;
      clearProgress();
      save();
    }
    render();
    boardEl.classList.add('won');
    // light the lanterns one after another (the page's one authored motion)
    puzzle.lanterns().forEach(function (i, k) { cellEls[i].style.setProperty('--d', (k * 110) + 'ms'); });
    if (fresh && !reducedMotion()) {
      boardEl.classList.add('lighting');
      window.setTimeout(function () { boardEl.classList.remove('lighting'); }, 1600 + puzzle.n * 110);
    }
    showWin(secs, stars, countsForStreak, fresh);
    renderStats();
  }

  function shareUrl() {
    // Archive pages exist up to UTC today; a visitor ahead of UTC shares the home page.
    return info.number <= P.dailyNumberFor(P.utcToday()) ? SITE + 'daily/' + info.number + '/' : SITE;
  }

  function showWin(secs, stars, countsForStreak, fresh) {
    var starsEl = $('win-stars');
    starsEl.textContent = '';
    for (var s = 0; s < 3; s++) starsEl.appendChild(icon('star', 'star' + (s < stars ? ' on' : '')));
    starsEl.setAttribute('aria-label', stars + ' of 3 stars');
    $('win-time').textContent = P.formatTime(secs);
    $('win-detail').textContent = fresh
      ? 'Hints used: ' + hintsUsed + ' · Mistakes: ' + mistakes
      : 'Your best time for this puzzle.';
    var streakEl = $('win-streak');
    if (countsForStreak) {
      var st = currentStreak();
      streakEl.textContent = 'Streak: ' + st + (st === 1 ? ' day' : ' days');
      streakEl.hidden = false;
    } else {
      streakEl.textContent = 'Archive puzzles do not change your streak.';
      streakEl.hidden = false;
    }
    var text = P.shareText(info.number, puzzle.n, secs, stars);
    $('share-preview').textContent = text;
    winEl.setAttribute('data-share', text + '\n' + shareUrl());
    updateNext();
    winEl.hidden = false;
    setStatus(fresh ? 'Solved! Every lantern is lit.' : 'You already solved this one.', 'ok');
    if (fresh) {
      var h = $('win-title');
      try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    }
  }

  function updateNext() {
    var nx = $('win-next');
    if (!nx) return;
    if (info.number === todayNumber()) {
      var now = new Date();
      var mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var mins = Math.max(1, Math.round((mid - now) / 60000));
      nx.textContent = 'Next puzzle in ' + (mins >= 60 ? Math.floor(mins / 60) + ' h ' : '') + (mins % 60) + ' min.';
    } else {
      nx.textContent = '';
    }
  }

  function share() {
    var text = winEl.getAttribute('data-share');
    var msg = $('share-msg');
    function done(t, kind) { msg.textContent = t; msg.className = 'share-msg' + (kind ? ' is-' + kind : ''); }
    function fallbackCopy() {
      var ta = el('textarea', 'sr-only');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done('Result copied to the clipboard.', 'ok');
      else done('Copy failed. Select the result above and copy it by hand.', 'error');
    }
    function copy() {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () {
          done('Result copied to the clipboard.', 'ok');
        }, fallbackCopy);
      } else fallbackCopy();
    }
    if (navigator.share) {
      navigator.share({ text: text }).then(function () { done('Shared.', 'ok'); }, function (err) {
        if (err && err.name === 'AbortError') return;
        copy();
      });
    } else copy();
  }
  $('btn-share').addEventListener('click', share);
  $('btn-again').addEventListener('click', function () {
    solved = false;
    interactive = true;
    hintsUsed = 0;
    mistakes = 0;
    elapsedMs = 0;
    puzzle.restart();
    boardEl.classList.remove('won', 'lighting');
    winEl.hidden = true;
    $('share-msg').textContent = '';
    renderTime();
    setStatus('Fresh board. A faster time replaces your best.', 'info');
    render();
    moveFocus(0, true);
  });

  // ---- stats strip
  function renderStats() {
    var res = bucket('results'), keys = Object.keys(res);
    $('stat-streak').textContent = String(currentStreak());
    $('stat-best-streak').textContent = String(bestStreak());
    $('stat-solved').textContent = String(keys.length);
    var best = null;
    keys.forEach(function (k) { if (puzzle && res[k].n === puzzle.n && (best === null || res[k].time < best)) best = res[k].time; });
    $('stat-best-label').textContent = puzzle ? 'Best ' + puzzle.n + '×' + puzzle.n : 'Best time';
    $('stat-best').textContent = best === null ? '–' : P.formatTime(best);
  }

  // ---- start
  function start(d) {
    info = d;
    puzzle = new P(d.n, d.regions, d.solution);
    var date = parseKey(d.date);
    $('puzzle-title').textContent = 'Daily #' + d.number;
    $('puzzle-meta').textContent = longDate(date) + ' · ' + d.n + '×' + d.n;
    focusIdx = 0;
    buildBoard();
    var prog = bucket('progress')[d.number];
    var res = bucket('results')[d.number];
    if (prog && typeof prog.c === 'string' && prog.c.length === d.n * d.n) {
      for (var i = 0; i < d.n * d.n; i++) {
        puzzle.cells[i] = +prog.c[i] || 0;
        puzzle.autoMarks[i] = +(prog.a && prog.a[i]) || 0;
      }
      elapsedMs = +prog.t || 0;
      hintsUsed = +prog.h || 0;
      mistakes = +prog.m || 0;
      interactive = true;
      renderTime();
      render();
      setStatus('Welcome back. Your board was kept; the timer resumes on your next move.', 'info');
    } else if (res) {
      // already solved: show the lit board and the best result
      for (var r = 0; r < d.n; r++) puzzle.cells[r * d.n + puzzle.solution[r]] = LANTERN;
      elapsedMs = res.time * 1000;
      hintsUsed = 0;
      mistakes = 0;
      renderTime();
      onSolved(false);
      $('win-stars').setAttribute('aria-label', res.stars + ' of 3 stars');
      var stars = $('win-stars').querySelectorAll('.star');
      for (var s = 0; s < stars.length; s++) stars[s].classList.toggle('on', s < res.stars);
      var text = P.shareText(d.number, d.n, res.time, res.stars);
      $('share-preview').textContent = text;
      winEl.setAttribute('data-share', text + '\n' + shareUrl());
    } else {
      interactive = true;
      render();
    }
    root.classList.add('is-ready');
    renderStats();
  }

  function unavailable(num, fallback) {
    boardEl.removeAttribute('aria-busy');
    root.classList.add('is-unavailable');
    $('puzzle-title').textContent = 'Daily #' + num;
    $('puzzle-meta').textContent = 'Not published yet';
    var box = $('unavailable');
    box.hidden = false;
    var link = $('unavailable-link');
    link.href = BASE + 'daily/' + fallback + '/';
    link.textContent = 'Play Daily #' + fallback + ' instead';
    [undoBtn, restartBtn, hintBtn].forEach(function (b) { b.disabled = true; });
    renderStats();
  }

  var embedded = null;
  try { embedded = JSON.parse($('puzzle-data').textContent); } catch (e) { embedded = null; }
  if (mode === 'today') {
    var want = todayNumber();
    if (embedded && embedded.number === want) start(embedded);
    else {
      boardEl.setAttribute('aria-busy', 'true');
      fetch(BASE + 'daily/data/' + want + '.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(start, function () {
        if (embedded) unavailable(want, embedded.number);
      });
    }
  } else if (embedded) {
    start(embedded);
  }
})();
