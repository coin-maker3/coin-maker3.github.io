/* Lantern Logic campaign: 600 levels, level select, tutorial, settings.
   Rules: puzzle.js (port of puzzle.gd). Board view: board.js.
   Progress rules follow scripts/autoload/game.gd: level N unlocks when N-1 has
   stars, best stars and best time are kept, 3 free hints per local day shared
   with the daily page. Optional portal adapter: window.LL_PORTAL (portal builds
   only; the website has none). No other dependencies. */
(function () {
  'use strict';

  var P = window.LanternPuzzle, Board = window.LanternBoard;
  var EMPTY = P.EMPTY, MARK = P.MARK, LANTERN = P.LANTERN;
  var FREE_HINTS_PER_DAY = 3;
  var PER_PACK = 30;
  var MIDGAME_AFTER_LEVEL = 20, MIDGAME_EVERY = 4;
  var portal = window.LL_PORTAL || null;
  var cfg = {};
  try { cfg = JSON.parse(document.getElementById('ll-config').textContent); } catch (e) { cfg = {}; }
  var COUNT = cfg.count || 600;
  var PACKS = Math.ceil(COUNT / PER_PACK);

  function $(id) { return document.getElementById(id); }
  var el = Board.el, icon = Board.icon;

  // ------------------------------------------------------------ storage
  // Same record as the daily page (lanternlogic.web.v1), so hints and
  // settings are shared. Every access is wrapped; failures keep an
  // in-memory copy for this visit.
  var KEY = 'lanternlogic.web.v1';
  var backend = null;
  var data = {};
  // The daily page shares this record: re-read it and write back only the
  // keys this page owns, so another open tab's progress is never overwritten.
  var OWN = ['settings', 'hints', 'levelStars', 'levelTimes', 'levelProgress', 'ui', 'tutorialDone'];
  function save() {
    try {
      if (!backend) return;
      var fresh = JSON.parse(backend.getItem(KEY) || '{}') || {};
      OWN.forEach(function (k) { if (k in data) fresh[k] = data[k]; else delete fresh[k]; });
      backend.setItem(KEY, JSON.stringify(fresh));
    } catch (e) { /* memory only */ }
  }
  function bucket(name) {
    if (!data[name] || typeof data[name] !== 'object') data[name] = {};
    return data[name];
  }
  function loadStore() {
    try { backend = (portal && portal.storage) || window.localStorage; } catch (e) { backend = null; }
    try {
      var raw = backend ? backend.getItem(KEY) : null;
      data = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== 'object') data = {};
    } catch (e) { data = {}; }
  }
  var settings, levelStars, levelTimes;
  function initState() {
    settings = bucket('settings');
    if (typeof settings.autoX !== 'boolean') settings.autoX = true;
    if (typeof settings.patterns !== 'boolean') settings.patterns = false;
    if (typeof settings.reduceMotion !== 'boolean') settings.reduceMotion = false;
    levelStars = bucket('levelStars');
    levelTimes = bucket('levelTimes');
  }
  function hintsLeft() {
    var h = bucket('hints'), today = P.dateKey(P.localToday());
    if (h.date !== today) { h.date = today; h.left = FREE_HINTS_PER_DAY; save(); }
    return h.left;
  }
  function stars(id) { return +levelStars[id] || 0; }
  function isUnlocked(id) { return id === 1 || stars(id - 1) > 0; }
  function highestUnlocked() {
    var lv = 1;
    while (lv < COUNT && stars(lv) > 0) lv++;
    return lv;
  }
  function totalStars() {
    var t = 0;
    for (var k in levelStars) t += +levelStars[k] || 0;
    return t;
  }
  function recordLevel(id, st, secs) {
    levelStars[id] = Math.max(st, stars(id));
    if (!(id in levelTimes) || secs < levelTimes[id]) levelTimes[id] = Math.round(secs * 10) / 10;
    save();
  }
  function motionOn() {
    if (settings.reduceMotion) return false;
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ------------------------------------------------------------ level data
  function sizeOf(id) { return parseInt((cfg.sizes || '')[id - 1], 36) || 0; }
  function kindOf(id) { var k = (cfg.kinds || '')[id - 1]; return k === 'b' ? 'bonus' : k === 'e' ? 'easy' : 'normal'; }
  function packOf(id) { return Math.floor((id - 1) / PER_PACK) + 1; }
  function kindLabel(id) { var k = kindOf(id); return k === 'bonus' ? 'Bonus' : k === 'easy' ? 'Breather' : ''; }
  var packCache = {};
  function loadPack(k) {
    if (packCache[k]) return packCache[k];
    var url = cfg.data + 'p' + k + '.json' + (cfg.v ? '?v=' + cfg.v : '');
    packCache[k] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (err) { delete packCache[k]; throw err; });
    return packCache[k];
  }
  function levelRecord(id) {
    return loadPack(packOf(id)).then(function (p) {
      var row = p.levels[id - p.first];
      return { id: id, n: Math.round(Math.sqrt(row[0].length)), regions: row[0], solution: row[1] };
    });
  }

  // ------------------------------------------------------------ views
  var views = ['select', 'game', 'tutorial', 'settings'];
  var current = null;
  function show(name, title) {
    views.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    if (current === 'game' && name !== 'game') leaveGame();
    if (name === 'select' || name === 'settings') gameplay(false);
    current = name;
    document.title = title + (cfg.site ? ' — Lantern Logic' : '');
    var h = $('view-' + name).querySelector('[data-focus]');
    if (h && document.activeElement !== document.body && document.activeElement) {
      try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    }
    window.scrollTo(0, 0);
  }

  function route() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var m;
    if ((m = /^level\/(\d+)$/.exec(h))) return openLevel(Math.max(1, Math.min(COUNT, +m[1])));
    if (h === 'tutorial') return openTutorial();
    if (h === 'settings') return openSettings();
    if ((m = /^pack\/(\d+)$/.exec(h))) return openSelect(Math.max(1, Math.min(PACKS, +m[1])));
    if (!data.tutorialDone && !Object.keys(levelStars).length) {
      location.replace('#/tutorial');
      return openTutorial();
    }
    return openSelect();
  }

  // ------------------------------------------------------------ level select
  var selPack = 1;
  function packSizes(k) {
    var lo = 99, hi = 0;
    for (var id = (k - 1) * PER_PACK + 1; id <= Math.min(COUNT, k * PER_PACK); id++) {
      lo = Math.min(lo, sizeOf(id)); hi = Math.max(hi, sizeOf(id));
    }
    return lo === hi ? lo + '×' + lo : lo + '×' + lo + ' to ' + hi + '×' + hi;
  }
  function packStars(k) {
    var t = 0;
    for (var id = (k - 1) * PER_PACK + 1; id <= Math.min(COUNT, k * PER_PACK); id++) t += stars(id);
    return t;
  }
  function starRow(n, cls) {
    var s = el('span', cls || 'tile-stars', { 'aria-hidden': 'true' });
    for (var i = 0; i < 3; i++) s.appendChild(icon('star', 'star' + (i < n ? ' on' : '')));
    return s;
  }
  function openSelect(pack) {
    var next = highestUnlocked();
    if (pack) selPack = pack;
    else selPack = +bucket('ui').pack || packOf(next);
    selPack = Math.max(1, Math.min(PACKS, selPack));
    var cont = $('continue');
    cont.href = '#/level/' + next;
    $('continue-label').textContent = (Object.keys(levelStars).length ? 'Continue: level ' : 'Start: level ') + next;
    $('total-stars').textContent = totalStars() + ' of ' + COUNT * 3 + ' stars · ' + Object.keys(levelStars).length + ' of ' + COUNT + ' levels solved';
    renderDailyCard();
    renderPack();
    renderPackList();
    show('select', 'Levels');
  }
  function renderPack() {
    var k = selPack, first = (k - 1) * PER_PACK + 1, last = Math.min(COUNT, k * PER_PACK);
    bucket('ui').pack = k;
    save();
    $('pack-title').textContent = 'Pack ' + k;
    $('pack-meta').textContent = 'Levels ' + first + '–' + last + ' · ' + packSizes(k) + ' · ' + packStars(k) + '/' + (last - first + 1) * 3 + ' stars';
    $('pack-prev').disabled = k <= 1;
    $('pack-next').disabled = k >= PACKS;
    var tiles = $('tiles'), next = highestUnlocked();
    tiles.textContent = '';
    for (var id = first; id <= last; id++) {
      var li = el('li'), un = isUnlocked(id), st = stars(id), kind = kindOf(id);
      var label = 'Level ' + id + ', ' + sizeOf(id) + ' by ' + sizeOf(id) + (kindLabel(id) ? ', ' + kindLabel(id).toLowerCase() + ' level' : '');
      var t;
      if (un) {
        t = el('a', 'tile', { href: '#/level/' + id });
        label += st ? ', ' + st + ' of 3 stars' : ', not solved yet';
        if (id === next && !st) { t.classList.add('is-next'); t.setAttribute('aria-current', 'step'); }
      } else {
        t = el('span', 'tile is-locked', { 'aria-disabled': 'true' });
        label += ', locked';
      }
      if (kind === 'bonus') t.classList.add('is-bonus');
      t.setAttribute('aria-label', label);
      t.appendChild(el('span', 'tile-num')).textContent = String(id);
      t.appendChild(un ? starRow(st) : icon('lock', 'ico tile-lock'));
      li.appendChild(t);
      tiles.appendChild(li);
    }
  }
  function renderPackList() {
    var list = $('packs');
    list.textContent = '';
    for (var k = 1; k <= PACKS; k++) {
      var first = (k - 1) * PER_PACK + 1, last = Math.min(COUNT, k * PER_PACK);
      var un = isUnlocked(first), ps = packStars(k);
      var b = el('button', 'pack-row' + (k === selPack ? ' is-current' : ''), { type: 'button', 'data-pack': k });
      if (k === selPack) b.setAttribute('aria-current', 'true');
      b.appendChild(el('span', 'pack-name')).textContent = 'Pack ' + k;
      b.appendChild(el('span', 'pack-range')).textContent = first + '–' + last + ' · ' + packSizes(k);
      var right = el('span', 'pack-score');
      if (un) { right.appendChild(icon('star', 'ico star on')); right.appendChild(document.createTextNode(ps + '/' + (last - first + 1) * 3)); }
      else { right.appendChild(icon('lock', 'ico')); right.appendChild(el('span', 'sr-only')).textContent = 'locked'; }
      b.appendChild(right);
      var li = el('li');
      li.appendChild(b);
      list.appendChild(li);
    }
  }
  function renderDailyCard() {
    var card = $('daily-card');
    if (!card) return;
    var days = bucket('days'), today = P.localToday();
    var done = !!days[P.dateKey(today)];
    var d = today, streak = 0;
    if (!done) d = P.addDays(d, -1);
    while (days[P.dateKey(d)] && streak < 10000) { streak++; d = P.addDays(d, -1); }
    $('daily-text').textContent = 'Daily #' + P.dailyNumberFor(today) + (done ? ' · solved today' : ' · a new board every day') +
      (streak ? ' · ' + streak + (streak === 1 ? ' day' : ' days') + ' streak' : '');
  }

  // ------------------------------------------------------------ game
  var board = null, puzzle = null, level = 0, gameToken = 0;
  var elapsedMs = 0, startedAt = 0, running = false, tick = 0;
  var solved = false, interactive = false, hintsUsed = 0, mistakes = 0, playing = false;
  var completedSinceAd = 0;

  function setStatus(id, text, kind) {
    var s = $(id);
    s.textContent = text || '';
    s.className = 'status' + (kind ? ' is-' + kind : '');
  }
  function elapsedSeconds() { return (elapsedMs + (running ? performance.now() - startedAt : 0)) / 1000; }
  function renderTime() { $('timer').textContent = P.formatTime(elapsedSeconds()); }
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
  function gameplay(on) {
    if (!portal || playing === on) return;
    playing = on;
    try { if (on) portal.gameplayStart(); else portal.gameplayStop(); } catch (e) { /* adapter errors never break play */ }
  }

  function saveProgress() {
    if (!puzzle || solved || current !== 'game') return;
    var prog = bucket('levelProgress');
    var any = puzzle.cells.some(function (c) { return c !== EMPTY; });
    if (!any && elapsedSeconds() < 1) { delete prog[level]; save(); return; }
    prog[level] = { c: puzzle.cells.join(''), a: puzzle.autoMarks.slice(), t: Math.round(elapsedSeconds() * 1000), h: hintsUsed, m: mistakes };
    var keys = Object.keys(prog).sort(function (a, b) { return b - a; });
    if (keys.length > 6) keys.filter(function (k) { return +k !== level; }).slice(5).forEach(function (k) { delete prog[k]; });
    save();
  }

  function renderGame() {
    board.render();
    var any = puzzle.cells.some(function (c) { return c !== EMPTY; });
    $('btn-undo').disabled = solved || !puzzle.history.length;
    $('btn-restart').disabled = solved || !any;
    var left = hintsLeft(), hb = $('btn-hint');
    var adHint = left <= 0 && portal && portal.rewardedAvailable && portal.rewardedAvailable();
    $('hint-count').textContent = adHint ? '+1' : String(left);
    hb.disabled = solved || (left <= 0 && !adHint);
    hb.setAttribute('aria-label', adHint ? 'Hint: watch a short ad for one more hint' : 'Hint, ' + left + ' left today');
  }
  function applySettings() {
    if (board) board.setPatterns(settings.patterns);
    if (tutBoard) tutBoard.setPatterns(settings.patterns);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    [['opt-autox', 'autoX'], ['opt-patterns', 'patterns'], ['set-autox', 'autoX'], ['set-patterns', 'patterns'], ['set-motion', 'reduceMotion']].forEach(function (p) {
      var b = $(p[0]);
      if (b) b.setAttribute('aria-checked', settings[p[1]] ? 'true' : 'false');
    });
  }

  function afterChange() {
    renderGame();
    if (puzzle.isSolved()) onSolved();
    else saveProgress();
  }
  function tap(i) {
    if (!interactive) return;
    startTimer();
    gameplay(true);
    var nxt = P.nextState(puzzle.cells[i]);
    puzzle.snapshot();
    puzzle.setCell(i, nxt, settings.autoX);
    if (nxt === LANTERN && puzzle.lanternConflictsAt(i)) {
      mistakes++;
      setStatus('status', 'That lantern breaks a rule: it shares a row, column or colour, or touches another lantern.', 'error');
    } else setStatus('status', '');
    board.clearHint();
    afterChange();
  }
  function undo() {
    if (solved || !interactive) return;
    if (puzzle.undo()) { setStatus('status', ''); board.clearHint(); afterChange(); }
  }
  function restart() {
    if (solved || !interactive) return;
    puzzle.snapshot();
    var hist = puzzle.history.slice();
    puzzle.restart();
    puzzle.history = hist; // restart itself can be undone
    setStatus('status', 'Board cleared. Undo brings it back.', 'info');
    board.clearHint();
    afterChange();
  }
  function useHint() {
    if (solved || !interactive) return;
    if (hintsLeft() <= 0) {
      if (portal && portal.rewardedAvailable && portal.rewardedAvailable()) {
        setStatus('status', 'Loading a short ad for one more hint…', 'info');
        stopTimer();
        gameplay(false);
        var token = gameToken;
        portal.showRewarded(function (granted) {
          if (token !== gameToken || current !== 'game') return;
          if (granted) {
            bucket('hints').left = hintsLeft() + 1; // like Game.grant_hint()
            save();
            useHint();
          } else {
            setStatus('status', 'No ad is available right now. Free hints refill tomorrow.', 'error');
            renderGame();
          }
        });
        return;
      }
      setStatus('status', 'No hints left today. Free hints refill tomorrow.', 'error');
      renderGame();
      return;
    }
    var h = puzzle.hint();
    if (!h) return;
    bucket('hints').left = hintsLeft() - 1;
    save();
    hintsUsed++;
    startTimer();
    gameplay(true);
    puzzle.snapshot();
    puzzle.setCell(h.cell, h.state, settings.autoX);
    board.showHint(h.cell);
    setStatus('status', h.reason, 'hint');
    afterChange();
  }

  function onSolved() {
    if (solved) return;
    solved = true;
    interactive = false;
    stopTimer();
    var secs = elapsedSeconds(), st = P.starsFor(hintsUsed, mistakes);
    var prevBest = levelTimes[level];
    recordLevel(level, st, secs);
    delete bucket('levelProgress')[level];
    save();
    if (level > MIDGAME_AFTER_LEVEL) completedSinceAd++;
    renderGame();
    board.celebrate(motionOn());
    if (portal) { try { portal.happytime(); } catch (e) { /* ignore */ } }
    gameplay(false);
    showWin(secs, st, prevBest);
  }

  function shareText(secs, st) {
    var sparkles = '';
    for (var i = 0; i < st; i++) sparkles += '✨';
    var t = 'Lantern Logic Level ' + level + ' — ' + puzzle.n + '×' + puzzle.n + ' in ' + P.formatTime(secs) + ' ' + sparkles;
    return cfg.shareUrl ? t + '\n' + cfg.shareUrl : t;
  }
  function showWin(secs, st, prevBest) {
    var starsEl = $('win-stars');
    starsEl.textContent = '';
    for (var s = 0; s < 3; s++) starsEl.appendChild(icon('star', 'star' + (s < st ? ' on' : '')));
    starsEl.setAttribute('aria-label', st + ' of 3 stars');
    $('win-time').textContent = P.formatTime(secs);
    var best = levelTimes[level];
    $('win-detail').textContent = 'Hints used: ' + hintsUsed + ' · Mistakes: ' + mistakes +
      (prevBest !== undefined && secs < prevBest ? ' · New best time' : (prevBest !== undefined ? ' · Best ' + P.formatTime(best) : ''));
    var text = shareText(secs, st);
    $('share-preview').textContent = text.split('\n')[0];
    $('win').setAttribute('data-share', text);
    $('share-msg').textContent = '';
    var nx = $('btn-next');
    nx.hidden = level >= COUNT;
    $('win-last').hidden = level < COUNT;
    $('win').hidden = false;
    renderLevelStats();
    setStatus('status', st === 3 ? 'Solved with three stars!' : 'Solved! Every lantern is lit.', 'ok');
    var h = $('win-title');
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }
  function renderLevelStats() {
    $('stat-stars').textContent = stars(level) + ' / 3';
    $('stat-best').textContent = level in levelTimes ? P.formatTime(levelTimes[level]) : '–';
    $('stat-total').textContent = String(totalStars());
    $('stat-hints').textContent = String(hintsLeft());
  }

  // Midgame ads (portal builds only): at a natural break after a completed
  // level, from level 21 on, at most once per 4 completed levels.
  function afterLevel(go) {
    if (!portal || !portal.showMidgame || completedSinceAd < MIDGAME_EVERY) return go();
    completedSinceAd = 0;
    portal.showMidgame(go);
  }

  function leaveGame() {
    saveProgress();
    stopTimer();
    gameplay(false);
    if (board) board.clearHint();
    gameToken++;
  }

  function openLevel(id) {
    if (current === 'game') leaveGame();
    var token = ++gameToken;
    level = id;
    $('level-title').textContent = 'Level ' + id;
    $('level-meta').textContent = sizeOf(id) + '×' + sizeOf(id) + (kindLabel(id) ? ' · ' + kindLabel(id) : '') + ' · Pack ' + packOf(id);
    $('win').hidden = true;
    $('locked').hidden = true;
    $('view-game').classList.remove('is-locked');
    $('prev-level').href = '#/level/' + Math.max(1, id - 1);
    $('prev-level').hidden = id <= 1;
    $('next-level').href = '#/level/' + Math.min(COUNT, id + 1);
    $('next-level').hidden = id >= COUNT || !isUnlocked(id + 1);
    $('pack-link').href = '#/pack/' + packOf(id);
    setStatus('status', '');
    elapsedMs = 0; running = false; window.clearInterval(tick);
    solved = false; interactive = false; hintsUsed = 0; mistakes = 0;
    renderTime();
    show('game', 'Level ' + id);
    if (!isUnlocked(id)) {
      puzzle = null;
      $('view-game').classList.add('is-locked');
      $('locked').hidden = false;
      $('locked-text').textContent = 'Solve level ' + (id - 1) + ' to unlock level ' + id + '.';
      $('locked-link').href = '#/level/' + highestUnlocked();
      $('locked-link-label').textContent = 'Play level ' + highestUnlocked();
      $('board').textContent = '';
      ['btn-undo', 'btn-restart', 'btn-hint'].forEach(function (b) { $(b).disabled = true; });
      renderLevelStats();
      return;
    }
    $('board').setAttribute('aria-busy', 'true');
    levelRecord(id).then(function (rec) {
      if (token !== gameToken) return;
      puzzle = new P(rec.n, rec.regions, rec.solution);
      board.setPuzzle(puzzle);
      applySettings();
      var prog = bucket('levelProgress')[id];
      if (prog && typeof prog.c === 'string' && prog.c.length === rec.n * rec.n) {
        for (var i = 0; i < rec.n * rec.n; i++) {
          puzzle.cells[i] = +prog.c[i] || 0;
          puzzle.autoMarks[i] = +(prog.a && prog.a[i]) || 0;
        }
        elapsedMs = +prog.t || 0;
        hintsUsed = +prog.h || 0;
        mistakes = +prog.m || 0;
        renderTime();
        setStatus('status', 'Welcome back. Your board was kept; the timer resumes on your next move.', 'info');
      }
      interactive = true;
      renderGame();
      renderLevelStats();
      if (id + 1 <= COUNT && packOf(id + 1) !== packOf(id)) loadPack(packOf(id + 1)).catch(function () {});
    }, function () {
      if (token !== gameToken) return;
      $('board').removeAttribute('aria-busy');
      setStatus('status', 'This level could not be loaded. Check your connection and try again.', 'error');
    });
  }

  // ------------------------------------------------------------ tutorial
  // Three steps, as in scripts/screens/tutorial_screen.gd.
  var TUT_REGIONS = 'AABBACCBDDCBDCCB', TUT_SOLUTION = '1302';
  var tutBoard = null, tutPuzzle = null, tutStep = 0, tutDone = false, tutAutoX = false;
  function openTutorial() {
    show('tutorial', 'How to play');
    loadStep(0);
  }
  function loadStep(s) {
    tutStep = s;
    tutDone = false;
    $('tut-next').disabled = true;
    tutBoard.unwin();
    var p;
    if (s === 0) {
      p = new P(4, TUT_REGIONS, TUT_SOLUTION);
      [p.idx(0, 1), p.idx(1, 3), p.idx(2, 0)].forEach(function (i) { p.cells[i] = LANTERN; });
      tutAutoX = false;
      tutPuzzle = p;
      tutBoard.setPuzzle(p);
      tutBoard.setGuide([p.idx(3, 2)]);
      $('tut-title').textContent = '1 / 3 · Light the lanterns';
      $('tut-text').textContent = 'Every row, every column and every colour needs exactly one lantern. Tap the glowing cell twice to light the last lantern.';
      finishStepSetup();
    } else if (s === 1) {
      p = new P(4, TUT_REGIONS, TUT_SOLUTION);
      p.cells[p.idx(1, 3)] = LANTERN;
      tutAutoX = false;
      tutPuzzle = p;
      tutBoard.setPuzzle(p);
      tutBoard.setGuide([p.idx(0, 2), p.idx(1, 2), p.idx(2, 2)]);
      $('tut-title').textContent = '2 / 3 · Lanterns never touch';
      $('tut-text').textContent = 'Not even diagonally! Tap a cell once to mark it with a cross, or drag across cells to mark many. Mark the glowing cells next to the lantern.';
      finishStepSetup();
    } else {
      $('tut-title').textContent = '3 / 3 · Your first puzzle';
      $('tut-text').textContent = 'Use both rules to solve this board. Tip: a colour that fits in one row rules out the rest of that row.';
      tutAutoX = true;
      tutPuzzle = null;
      levelRecord(1).then(function (rec) {
        if (tutStep !== 2 || current !== 'tutorial') return;
        tutPuzzle = new P(rec.n, rec.regions, rec.solution);
        tutBoard.setPuzzle(tutPuzzle);
        finishStepSetup();
      }, function () { finishTutorial(); });
    }
  }
  function finishStepSetup() {
    tutBoard.setPatterns(settings.patterns);
    setStatus('tut-status', '');
    gameplay(true);
  }
  function tutCheck() {
    tutBoard.render();
    var ok = false;
    if (tutStep === 1) ok = tutBoard.guide.every(function (i) { return tutPuzzle.cells[i] === MARK; });
    else ok = tutPuzzle.isSolved();
    if (ok && !tutDone) {
      tutDone = true;
      tutBoard.setGuide([]);
      $('tut-next').disabled = false;
      if (tutStep === 2) {
        tutBoard.celebrate(motionOn());
        gameplay(false);
        $('tut-text').textContent = "Wonderful! You're ready. Choose Next to start playing.";
      } else {
        $('tut-text').textContent = 'Nice! Choose Next.';
      }
      setStatus('tut-status', tutStep === 2 ? 'Solved! Every lantern is lit.' : 'Step done.', 'ok');
      try { $('tut-next').focus({ preventScroll: true }); } catch (e) { $('tut-next').focus(); }
    }
  }
  function finishTutorial() {
    data.tutorialDone = true;
    save();
    gameplay(false);
    location.hash = '#/';
  }

  // ------------------------------------------------------------ settings
  function openSettings() {
    $('reset-confirm').hidden = true;
    $('btn-reset').hidden = false;
    setStatus('settings-status', '');
    applySettings();
    show('settings', 'Settings');
  }

  // ------------------------------------------------------------ share
  function share() {
    var text = $('win').getAttribute('data-share');
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
        navigator.clipboard.writeText(text).then(function () { done('Result copied to the clipboard.', 'ok'); }, fallbackCopy);
      } else fallbackCopy();
    }
    if (navigator.share && cfg.site) {
      navigator.share({ text: text }).then(function () { done('Shared.', 'ok'); }, function (err) {
        if (err && err.name === 'AbortError') return;
        copy();
      });
    } else copy();
  }

  // ------------------------------------------------------------ wiring
  function bindSwitch(ids, keyName, onMsg, offMsg) {
    ids.forEach(function (id) {
      var b = $(id);
      if (!b) return;
      b.addEventListener('click', function () {
        settings[keyName] = !settings[keyName];
        save();
        applySettings();
        var msg = settings[keyName] ? onMsg : offMsg;
        setStatus(id.indexOf('set-') === 0 ? 'settings-status' : 'status', msg, 'info');
      });
    });
  }

  function boot() {
    loadStore();
    initState();
    board = new Board($('board'), {
      onTap: tap,
      onPaintStart: function () { puzzle.snapshot(); startTimer(); gameplay(true); },
      onPaintEnd: function () { setStatus('status', ''); afterChange(); },
      interactive: function () { return interactive; }
    });
    tutBoard = new Board($('tut-board'), {
      onTap: function (i) {
        if (tutDone) return;
        tutPuzzle.snapshot();
        tutPuzzle.setCell(i, P.nextState(tutPuzzle.cells[i]), tutAutoX && settings.autoX);
        tutCheck();
      },
      onPaintStart: function () { tutPuzzle.snapshot(); },
      onPaintEnd: tutCheck,
      interactive: function () { return !tutDone && !!tutPuzzle; }
    });
    $('btn-undo').addEventListener('click', undo);
    $('btn-restart').addEventListener('click', restart);
    $('btn-hint').addEventListener('click', useHint);
    $('btn-share').addEventListener('click', share);
    $('btn-next').addEventListener('click', function () { afterLevel(function () { location.hash = '#/level/' + (level + 1); }); });
    $('btn-levels').addEventListener('click', function () { afterLevel(function () { location.hash = '#/pack/' + packOf(level); }); });
    $('btn-again').addEventListener('click', function () {
      if (!puzzle) return;
      puzzle.restart();
      board.unwin();
      solved = false; interactive = true; hintsUsed = 0; mistakes = 0; elapsedMs = 0;
      $('win').hidden = true;
      renderTime();
      setStatus('status', 'Fresh board. More stars or a faster time replace your best.', 'info');
      renderGame();
      board.moveFocus(0, true);
    });
    $('pack-prev').addEventListener('click', function () { selPack--; renderPack(); renderPackList(); });
    $('pack-next').addEventListener('click', function () { selPack++; renderPack(); renderPackList(); });
    $('packs').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-pack]') : null;
      if (!b) return;
      selPack = +b.getAttribute('data-pack');
      renderPack();
      renderPackList();
      var t = $('pack-title');
      try { t.scrollIntoView({ block: 'start', behavior: motionOn() ? 'smooth' : 'auto' }); } catch (err) { t.scrollIntoView(); }
      try { t.focus({ preventScroll: true }); } catch (err) { t.focus(); }
    });
    $('tut-skip').addEventListener('click', finishTutorial);
    $('tut-next').addEventListener('click', function () { if (tutStep < 2) loadStep(tutStep + 1); else finishTutorial(); });
    $('btn-reset').addEventListener('click', function () { $('reset-confirm').hidden = false; $('btn-reset').hidden = true; $('reset-cancel').focus(); });
    $('reset-cancel').addEventListener('click', function () { $('reset-confirm').hidden = true; $('btn-reset').hidden = false; $('btn-reset').focus(); });
    $('reset-ok').addEventListener('click', function () {
      ['levelStars', 'levelTimes', 'levelProgress', 'ui'].forEach(function (k) { delete data[k]; });
      delete data.tutorialDone;
      save();
      initState();
      $('reset-confirm').hidden = true;
      $('btn-reset').hidden = false;
      setStatus('settings-status', 'Campaign progress cleared.', 'ok');
    });
    bindSwitch(['opt-autox', 'set-autox'], 'autoX', 'Auto-cross on: placing a lantern crosses out the cells it rules out.', 'Auto-cross off.');
    bindSwitch(['opt-patterns', 'set-patterns'], 'patterns', 'Colour patterns on.', 'Colour patterns off.');
    bindSwitch(['set-motion'], 'reduceMotion', 'Animations reduced.', 'Animations follow your system setting.');
    document.addEventListener('keydown', function (e) {
      if (current === 'game' && (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (current !== 'game') return;
      if (document.hidden) { if (running) { stopTimer(); $('view-game').setAttribute('data-paused', '1'); } saveProgress(); gameplay(false); }
      else if ($('view-game').getAttribute('data-paused')) { $('view-game').removeAttribute('data-paused'); if (!solved) startTimer(); }
    });
    window.addEventListener('pagehide', saveProgress);
    window.addEventListener('hashchange', route);
    applySettings();
    if (portal && portal.loaded) { try { portal.loaded(); } catch (e) { /* ignore */ } }
    route();
    document.documentElement.classList.add('is-ready');
  }

  if (portal && portal.ready) portal.ready(boot);
  else boot();
})();
