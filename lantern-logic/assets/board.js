/* Lantern Logic board view: SVG art (colours, colour-blind patterns, region
   borders), one button per cell, tap / drag / keyboard input and the win
   lighting. Used by the campaign (levels.js); same drawing and input rules as
   the daily page (app.js) and the app's board_view.gd. No dependencies. */
(function (root) {
  'use strict';

  var P = root.LanternPuzzle;
  var EMPTY = P.EMPTY, MARK = P.MARK, LANTERN = P.LANTERN;
  // App palette (scripts/ui/palette.gd), darkened 22% like Pal.region_color().
  var REGION_COLORS = ['#b37c00', '#438cb6', '#007b5a', '#bbb233', '#00598b', '#a64900',
    '#9f5e82', '#7d7d7d', '#6d538a', '#815c17', '#509781'];
  var REGION_NAMES = ['orange', 'sky blue', 'green', 'yellow', 'blue', 'vermilion',
    'pink', 'grey', 'violet', 'brown', 'teal'];
  var DARK_REGIONS = { 4: true }; // light marks on the one dark region, as in the app

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
  function f3(v) { return Math.round(v * 1000) / 1000; }
  function circ(x, y, rad) {
    return 'M' + f3(x - rad) + ' ' + f3(y) + 'a' + f3(rad) + ' ' + f3(rad) + ' 0 1 0 ' + f3(rad * 2) + ' 0a' +
      f3(rad) + ' ' + f3(rad) + ' 0 1 0 ' + f3(-rad * 2) + ' 0';
  }
  // 4 small marks per cell, one shape per region (the app's _draw_pattern).
  function patternPath(c, r, kind) {
    var out = '', d = 0.11;
    for (var gy = 0; gy < 2; gy++) {
      for (var gx = 0; gx < 2; gx++) {
        var x = c + (gx + 0.5) / 2, y = r + (gy + 0.5) / 2;
        switch (kind) {
          case 0: out += circ(x, y, d * 0.55); break;
          case 1: out += 'M' + f3(x - d) + ' ' + f3(y + d) + 'L' + f3(x + d) + ' ' + f3(y - d); break;
          case 2: out += 'M' + f3(x - d) + ' ' + f3(y - d) + 'L' + f3(x + d) + ' ' + f3(y + d); break;
          case 3: out += 'M' + f3(x - d) + ' ' + f3(y) + 'H' + f3(x + d); break;
          case 4: out += 'M' + f3(x) + ' ' + f3(y - d) + 'V' + f3(y + d); break;
          case 5: out += 'M' + f3(x - d) + ' ' + f3(y) + 'H' + f3(x + d) + 'M' + f3(x) + ' ' + f3(y - d) + 'V' + f3(y + d); break;
          case 6: out += circ(x, y, d * 0.8); break;
          case 7: out += 'M' + f3(x) + ' ' + f3(y - d) + 'L' + f3(x + d) + ' ' + f3(y + d * 0.8) + 'H' + f3(x - d) + 'Z'; break;
          case 8: out += 'M' + f3(x - d * 0.75) + ' ' + f3(y - d * 0.75) + 'h' + f3(d * 1.5) + 'v' + f3(d * 1.5) + 'h' + f3(-d * 1.5) + 'Z'; break;
          case 9: out += circ(x - d * 0.5, y, d * 0.35) + circ(x + d * 0.5, y, d * 0.35); break;
          default: out += 'M' + f3(x - d) + ' ' + f3(y - d * 0.4) + 'L' + f3(x) + ' ' + f3(y + d * 0.5) + 'L' + f3(x + d) + ' ' + f3(y - d * 0.4);
        }
      }
    }
    return out;
  }

  /* opts:
       onTap(i)            a press without moving, or Enter/Space on a cell
       onPaintStart()      first cell of a drag is about to be crossed (snapshot here)
       onPaintEnd(count)   drag finished after crossing `count` cells
       interactive()       false blocks all input
       motion()            false skips the win lighting animation */
  function Board(boardEl, opts) {
    this.el = boardEl;
    this.opts = opts || {};
    this.puzzle = null;
    this.cells = [];
    this.focusIdx = 0;
    this.guide = [];
    this._hintTimer = 0;
    this._bind();
  }

  Board.prototype.setPuzzle = function (puzzle) {
    this.puzzle = puzzle;
    this.focusIdx = 0;
    this.guide = [];
    this.el.classList.remove('won', 'lighting');
    this._build();
    this.render();
  };

  Board.prototype._build = function () {
    var puzzle = this.puzzle, n = puzzle.n, boardEl = this.el, i;
    boardEl.textContent = '';
    boardEl.style.setProperty('--n', n);
    boardEl.setAttribute('aria-label', 'Puzzle board, ' + n + ' by ' + n);
    boardEl.removeAttribute('aria-busy');
    var svg = svgEl('svg', { 'class': 'board-art', viewBox: '0 0 ' + n + ' ' + n, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    var cellsG = svgEl('g', {}), patG = svgEl('g', { 'class': 'patterns' });
    for (i = 0; i < n * n; i++) {
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

    this.cells = [];
    var grid = el('div', 'cells');
    for (var row = 0; row < n; row++) {
      var rowEl = el('div', 'row', { role: 'row' });
      for (var col = 0; col < n; col++) {
        var idx = row * n + col;
        var wrap = el('div', 'gc', { role: 'gridcell' });
        var b = el('button', 'cell' + (DARK_REGIONS[puzzle.regions[idx] % 11] ? ' on-dark' : ''),
          { type: 'button', tabindex: idx === this.focusIdx ? '0' : '-1', 'data-i': idx });
        b.appendChild(el('span', 'glow', { 'aria-hidden': 'true' }));
        b.appendChild(icon('mark', 'mk'));
        b.appendChild(icon('lantern', 'ln'));
        wrap.appendChild(b);
        rowEl.appendChild(wrap);
        this.cells.push(b);
      }
      grid.appendChild(rowEl);
    }
    boardEl.appendChild(grid);
  };

  Board.prototype.cellLabel = function (i) {
    var puzzle = this.puzzle, n = puzzle.n, st = puzzle.cells[i];
    var what = st === LANTERN ? 'lantern' : st === MARK ? 'crossed out' : 'empty';
    return 'Row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1) + ', ' +
      REGION_NAMES[puzzle.regions[i] % 11] + ' region, ' + what;
  };

  Board.prototype.render = function () {
    var puzzle = this.puzzle;
    if (!puzzle) return;
    var bad = puzzle.conflicts();
    for (var i = 0; i < this.cells.length; i++) {
      var b = this.cells[i], st = puzzle.cells[i];
      var s = st === LANTERN ? 'lantern' : st === MARK ? 'mark' : 'empty';
      if (b.getAttribute('data-s') !== s) b.setAttribute('data-s', s);
      b.classList.toggle('auto', st === MARK && puzzle.autoMarks[i] > 0);
      b.classList.toggle('bad', !!bad[i]);
      b.classList.toggle('guide', this.guide.indexOf(i) >= 0);
      var label = this.cellLabel(i) + (bad[i] ? ', breaks a rule' : '') + (this.guide.indexOf(i) >= 0 ? ', highlighted' : '');
      if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    }
  };

  Board.prototype.setPatterns = function (on) { this.el.classList.toggle('show-patterns', !!on); };
  Board.prototype.setGuide = function (cells) { this.guide = cells ? cells.slice() : []; this.render(); };

  Board.prototype.showHint = function (i) {
    this.clearHint();
    if (this.cells[i]) this.cells[i].classList.add('hinted');
    var self = this;
    this._hintTimer = window.setTimeout(function () { self.clearHint(); }, 4000);
  };
  Board.prototype.clearHint = function () {
    window.clearTimeout(this._hintTimer);
    for (var i = 0; i < this.cells.length; i++) this.cells[i].classList.remove('hinted');
  };

  // The page's one authored motion: lanterns light up one after another.
  Board.prototype.celebrate = function (animate) {
    var self = this, boardEl = this.el;
    this.clearHint();
    boardEl.classList.add('won');
    this.puzzle.lanterns().forEach(function (i, k) { self.cells[i].style.setProperty('--d', (k * 110) + 'ms'); });
    if (animate) {
      boardEl.classList.add('lighting');
      window.setTimeout(function () { boardEl.classList.remove('lighting'); }, 1600 + this.puzzle.n * 110);
    }
  };
  Board.prototype.unwin = function () { this.el.classList.remove('won', 'lighting'); };

  Board.prototype.moveFocus = function (i, focus) {
    if (!this.cells[i]) return;
    if (this.cells[this.focusIdx]) this.cells[this.focusIdx].setAttribute('tabindex', '-1');
    this.focusIdx = i;
    this.cells[i].setAttribute('tabindex', '0');
    if (focus) this.cells[i].focus();
    else try { this.cells[i].focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  };

  // ---- input: tap cycles, drag paints crosses (board_view.gd semantics)
  Board.prototype._bind = function () {
    var self = this, boardEl = this.el;
    var pressCell = -1, dragging = false, activePointer = null, painted = 0, started = false;
    function live() { return self.puzzle && (!self.opts.interactive || self.opts.interactive()); }
    function cellAt(x, y) {
      var rect = boardEl.getBoundingClientRect(), n = self.puzzle.n;
      if (x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return -1;
      var c = Math.min(n - 1, Math.max(0, Math.floor((x - rect.left) / rect.width * n)));
      var r = Math.min(n - 1, Math.max(0, Math.floor((y - rect.top) / rect.height * n)));
      return r * n + c;
    }
    function paint(i) {
      if (self.puzzle.cells[i] !== EMPTY) return;
      if (!started) { started = true; if (self.opts.onPaintStart) self.opts.onPaintStart(); }
      self.puzzle.setCell(i, MARK, false);
      painted++;
      self.render();
    }
    boardEl.addEventListener('pointerdown', function (e) {
      if (!live() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var c = cellAt(e.clientX, e.clientY);
      if (c < 0) return;
      e.preventDefault();
      pressCell = c;
      dragging = false;
      started = false;
      painted = 0;
      activePointer = e.pointerId;
      try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      self.moveFocus(c, false);
    });
    boardEl.addEventListener('pointermove', function (e) {
      if (pressCell < 0 || e.pointerId !== activePointer) return;
      var c = cellAt(e.clientX, e.clientY);
      if (c >= 0 && c !== pressCell && !dragging) { dragging = true; paint(pressCell); }
      if (dragging && c >= 0) paint(c);
    });
    function endPress(e, cancelled) {
      if (pressCell < 0 || e.pointerId !== activePointer) return;
      var cell = pressCell;
      pressCell = -1;
      activePointer = null;
      if (!dragging && !cancelled) { if (live() && self.opts.onTap) self.opts.onTap(cell); }
      else if (dragging && painted && self.opts.onPaintEnd) self.opts.onPaintEnd(painted);
      dragging = false;
    }
    boardEl.addEventListener('pointerup', function (e) { endPress(e, false); });
    boardEl.addEventListener('pointercancel', function (e) { endPress(e, true); });
    // Keyboard (Enter/Space) and screen-reader activation arrive as clicks with detail 0.
    boardEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.cell') : null;
      if (!b || e.detail !== 0 || !live()) return;
      var i = +b.getAttribute('data-i');
      self.moveFocus(i, true);
      if (self.opts.onTap) self.opts.onTap(i);
    });
    boardEl.addEventListener('keydown', function (e) {
      if (!self.puzzle) return;
      var n = self.puzzle.n, r = Math.floor(self.focusIdx / n), c = self.focusIdx % n;
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
      self.moveFocus(r * n + c, true);
    });
  };

  Board.icon = icon;
  Board.el = el;
  root.LanternBoard = Board;
})(this);
