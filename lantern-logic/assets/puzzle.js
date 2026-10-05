/* Lantern Logic puzzle model: a line-by-line port of the app's
   scripts/core/puzzle.gd (rules, conflicts, win, auto-cross, undo, hints)
   and the daily-number maths of scripts/autoload/game.gd.
   Works in the browser (window.LanternPuzzle) and in Node (module.exports). */
(function (root) {
  'use strict';

  var EMPTY = 0, MARK = 1, LANTERN = 2;
  var ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  var DAILY_COUNT = 730;
  var DAY_MS = 86400000;

  function Puzzle(n, regionStr, solutionStr) {
    this.n = n;
    this.regions = [];
    for (var i = 0; i < n * n; i++) this.regions.push(regionStr.charCodeAt(i) - 65);
    this.solution = [];
    for (var r = 0; r < n; r++) this.solution.push(ALPHABET.indexOf(solutionStr[r]));
    this.cells = new Array(n * n).fill(EMPTY);
    this.autoMarks = new Array(n * n).fill(0);
    this.history = [];
  }

  Puzzle.prototype.idx = function (r, c) { return r * this.n + c; };

  Puzzle.prototype.isSolutionCell = function (i) {
    return this.solution[Math.floor(i / this.n)] === i % this.n;
  };

  Puzzle.prototype.regionCells = function (g) {
    var out = [];
    for (var i = 0; i < this.n * this.n; i++) if (this.regions[i] === g) out.push(i);
    return out;
  };

  // Cells a lantern on i attacks: same row, column, region or touching.
  Puzzle.prototype.attackedBy = function (i) {
    var n = this.n, out = [], r = Math.floor(i / n), c = i % n;
    for (var j = 0; j < n * n; j++) {
      if (j === i) continue;
      var rr = Math.floor(j / n), cc = j % n;
      if (rr === r || cc === c || this.regions[j] === this.regions[i] ||
          (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1)) out.push(j);
    }
    return out;
  };

  Puzzle.prototype.lanterns = function () {
    var out = [];
    for (var i = 0; i < this.n * this.n; i++) if (this.cells[i] === LANTERN) out.push(i);
    return out;
  };

  function lanternsClash(a, b, n, regs) {
    var ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
    return ra === rb || ca === cb || regs[a] === regs[b] ||
      (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
  }

  // Set of lantern cells that break a rule with another lantern.
  Puzzle.prototype.conflicts = function () {
    var out = {}, ls = this.lanterns();
    for (var x = 0; x < ls.length; x++) {
      for (var y = x + 1; y < ls.length; y++) {
        if (lanternsClash(ls[x], ls[y], this.n, this.regions)) { out[ls[x]] = true; out[ls[y]] = true; }
      }
    }
    return out;
  };

  Puzzle.prototype.isSolved = function () {
    return this.lanterns().length === this.n && Object.keys(this.conflicts()).length === 0;
  };

  Puzzle.prototype.snapshot = function () {
    this.history.push([this.cells.slice(), this.autoMarks.slice()]);
    if (this.history.length > 500) this.history.shift();
  };

  Puzzle.prototype.undo = function () {
    if (!this.history.length) return false;
    var s = this.history.pop();
    this.cells = s[0];
    this.autoMarks = s[1];
    return true;
  };

  Puzzle.prototype.restart = function () {
    this.cells.fill(EMPTY);
    this.autoMarks.fill(0);
    this.history = [];
  };

  Puzzle.nextState = function (state) { return (state + 1) % 3; };

  // Applies a state to a cell (call snapshot() first for undo). Returns the
  // cells that were auto-marked, nearest first.
  Puzzle.prototype.setCell = function (i, state, autoX) {
    var rippled = [], old = this.cells[i], n = this.n, j, k;
    if (old === state) return rippled;
    if (old === LANTERN && autoX) {
      var att0 = this.attackedBy(i);
      for (k = 0; k < att0.length; k++) {
        j = att0[k];
        if (this.autoMarks[j] > 0) {
          this.autoMarks[j] -= 1;
          if (this.autoMarks[j] === 0 && this.cells[j] === MARK) this.cells[j] = EMPTY;
        }
      }
    }
    this.cells[i] = state;
    this.autoMarks[i] = 0;
    if (state === LANTERN && autoX) {
      var r = Math.floor(i / n), c = i % n;
      var att = this.attackedBy(i);
      var dist = function (a) { return Math.max(Math.abs(Math.floor(a / n) - r), Math.abs(a % n - c)); };
      att.sort(function (a, b) { return dist(a) - dist(b); });
      for (k = 0; k < att.length; k++) {
        j = att[k];
        if (this.cells[j] === EMPTY) {
          this.cells[j] = MARK;
          this.autoMarks[j] = 1;
          rippled.push(j);
        } else if (this.cells[j] === MARK && this.autoMarks[j] > 0) {
          this.autoMarks[j] += 1;
        }
      }
    }
    return rippled;
  };

  // Did placing a lantern on i create a conflict?
  Puzzle.prototype.lanternConflictsAt = function (i) {
    var ls = this.lanterns();
    for (var k = 0; k < ls.length; k++) {
      if (ls[k] !== i && lanternsClash(i, ls[k], this.n, this.regions)) return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- hints
  // Returns {cell, state, reason} for the next logically forced step, in the
  // same order as the app (corrections, singles, confinement, eliminations,
  // then any missing solution lantern). null when solved.
  Puzzle.prototype.hint = function () {
    var n = this.n, i, k, u;
    for (i = 0; i < n * n; i++) {
      if (this.cells[i] === LANTERN && !this.isSolutionCell(i)) {
        return { cell: i, state: EMPTY, reason: "This lantern can't be right - remove it." };
      }
    }
    for (i = 0; i < n * n; i++) {
      if (this.cells[i] === MARK && this.isSolutionCell(i)) {
        return { cell: i, state: LANTERN, reason: 'A lantern belongs here.' };
      }
    }
    var cand = this._candidates();
    var units = this._units();
    for (k = 0; k < units.length; k++) {
      u = units[k];
      if (this._unitHasLantern(u.cells)) continue;
      var opts = u.cells.filter(function (x) { return cand[x]; });
      if (opts.length === 1) {
        return { cell: opts[0], state: LANTERN, reason: 'Only one spot is left in this ' + u.name + '.' };
      }
    }
    // region confined to a single row/column clears the rest of that line
    for (var g = 0; g < n; g++) {
      var rc = this.regionCells(g);
      if (this._unitHasLantern(rc)) continue;
      var rows = [], cols = [];
      for (k = 0; k < rc.length; k++) {
        i = rc[k];
        if (cand[i]) {
          if (rows.indexOf(Math.floor(i / n)) < 0) rows.push(Math.floor(i / n));
          if (cols.indexOf(i % n) < 0) cols.push(i % n);
        }
      }
      if (rows.length === 1) {
        for (var c = 0; c < n; c++) {
          var j = this.idx(rows[0], c);
          if (cand[j] && this.regions[j] !== g && this.cells[j] === EMPTY) {
            return { cell: j, state: MARK, reason: 'One colour must use this row, so this cell is out.' };
          }
        }
      }
      if (cols.length === 1) {
        for (var r2 = 0; r2 < n; r2++) {
          var j2 = this.idx(r2, cols[0]);
          if (cand[j2] && this.regions[j2] !== g && this.cells[j2] === EMPTY) {
            return { cell: j2, state: MARK, reason: 'One colour must use this column, so this cell is out.' };
          }
        }
      }
    }
    // a lantern here would wipe out every option of some unit
    for (i = 0; i < n * n; i++) {
      if (!cand[i] || this.cells[i] !== EMPTY) continue;
      var att = {};
      this.attackedBy(i).forEach(function (x) { att[x] = true; });
      for (k = 0; k < units.length; k++) {
        u = units[k];
        if (u.cells.indexOf(i) >= 0 || this._unitHasLantern(u.cells)) continue;
        var left = false;
        for (var m = 0; m < u.cells.length; m++) {
          if (cand[u.cells[m]] && !att[u.cells[m]]) { left = true; break; }
        }
        if (!left) {
          return { cell: i, state: MARK, reason: 'A lantern here would leave a ' + u.name + ' with no space.' };
        }
      }
    }
    for (var r = 0; r < n; r++) {
      var q = this.idx(r, this.solution[r]);
      if (this.cells[q] !== LANTERN) return { cell: q, state: LANTERN, reason: 'This lantern is forced.' };
    }
    return null;
  };

  Puzzle.prototype._units = function () {
    var n = this.n, out = [], r, c;
    for (r = 0; r < n; r++) {
      var a = [];
      for (c = 0; c < n; c++) a.push(this.idx(r, c));
      out.push({ name: 'row', cells: a });
    }
    for (c = 0; c < n; c++) {
      var b = [];
      for (r = 0; r < n; r++) b.push(this.idx(r, c));
      out.push({ name: 'column', cells: b });
    }
    for (var g = 0; g < n; g++) out.push({ name: 'colour region', cells: this.regionCells(g) });
    return out;
  };

  Puzzle.prototype._unitHasLantern = function (cells) {
    for (var k = 0; k < cells.length; k++) if (this.cells[cells[k]] === LANTERN) return true;
    return false;
  };

  Puzzle.prototype._candidates = function () {
    var n = this.n, cand = new Array(n * n).fill(true), i;
    for (i = 0; i < n * n; i++) if (this.cells[i] === MARK || this.cells[i] === LANTERN) cand[i] = false;
    var ls = this.lanterns();
    for (var k = 0; k < ls.length; k++) {
      this.attackedBy(ls[k]).forEach(function (j) { cand[j] = false; });
    }
    return cand;
  };

  // ---------------------------------------------------------------- scoring

  // 3 stars: no hints and no mistakes. 2: at most 1 hint and 3 mistakes. 1: solved.
  Puzzle.starsFor = function (hintsUsed, mistakes) {
    if (hintsUsed === 0 && mistakes === 0) return 3;
    if (hintsUsed <= 1 && mistakes <= 3) return 2;
    return 1;
  };

  function pad2(v) { return (v < 10 ? '0' : '') + v; }

  Puzzle.formatTime = function (seconds) {
    var s = Math.floor(seconds);
    if (s >= 3600) return Math.floor(s / 3600) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60);
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  };

  // Same text as Game.daily_share_text in the app.
  Puzzle.shareText = function (number, size, seconds, stars) {
    var sparkles = '';
    for (var i = 0; i < stars; i++) sparkles += '✨';
    return 'Lantern Logic Daily #' + number + ' — ' + size + '×' + size + ' in ' +
      Puzzle.formatTime(seconds) + ' ' + sparkles;
  };

  // ---------------------------------------------------------------- dates
  // Calendar-day number of a {year, month, day} date (like Game.day_number).
  function dayNumber(d) { return Math.floor(Date.UTC(d.year, d.month - 1, d.day, 12) / DAY_MS); }
  var EPOCH_DAY = dayNumber({ year: 2026, month: 10, day: 1 });

  // Index into the 730-puzzle list: dates before the epoch map to 0, wraps after 730.
  Puzzle.dailyIndexFor = function (d) {
    var k = dayNumber(d) - EPOCH_DAY;
    return k < 0 ? 0 : k % DAILY_COUNT;
  };
  // Public number (#1 = 2026-10-01), never wraps.
  Puzzle.dailyNumberFor = function (d) { return Math.max(1, dayNumber(d) - EPOCH_DAY + 1); };
  Puzzle.indexForNumber = function (num) { return (num - 1) % DAILY_COUNT; };
  Puzzle.localToday = function (now) {
    now = now || new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  };
  Puzzle.utcToday = function (now) {
    now = now || new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  };
  Puzzle.dateKey = function (d) { return d.year + '-' + pad2(d.month) + '-' + pad2(d.day); };
  Puzzle.addDays = function (d, delta) {
    var t = new Date((dayNumber(d) + delta) * DAY_MS + 43200000);
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
  };
  Puzzle.dayNumber = dayNumber;

  Puzzle.EMPTY = EMPTY;
  Puzzle.MARK = MARK;
  Puzzle.LANTERN = LANTERN;

  if (typeof module !== 'undefined' && module.exports) module.exports = Puzzle;
  else root.LanternPuzzle = Puzzle;
})(this);
