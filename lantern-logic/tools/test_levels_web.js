#!/usr/bin/env node
/* End-to-end check of the campaign (/lantern-logic/levels/) and the portal
   builds in headless Chromium.

     python3 -m http.server 8080                         (repository root)
     python3 lantern-logic/tools/build_portal.py --unpacked /tmp/ll-portal
     (cd /tmp/ll-portal && python3 -m http.server 8081)
     node lantern-logic/tools/test_levels_web.js [http://localhost:8080] [http://localhost:8081] [shots]

   The CrazyGames SDK is replaced by a stub (no network) that records every
   call, so the adapter's calls can be checked in order. Exits non-zero on failure. */
'use strict';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const path = require('path');
const fs = require('fs');

const ORIGIN = process.argv[2] || 'http://localhost:8080';
const PORTAL = process.argv[3] || 'http://localhost:8081';
const SHOTS = process.argv[4] || path.join(require('os').tmpdir(), 'lantern-level-shots');
const LV = ORIGIN + '/lantern-logic/levels/';
const KEY = 'lanternlogic.web.v1';
const failures = [];
function check(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failures.push(msg); }

function watch(page) {
  const bag = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bag.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => bag.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) bag.push('HTTP ' + r.status() + ': ' + r.url()); });
  return bag;
}
function pack(base, k) { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'data', 'p' + k + '.json'), 'utf8')); }
function level(id) {
  const p = pack(null, Math.floor((id - 1) / 30) + 1);
  const row = p.levels[id - p.first];
  return { n: Math.round(Math.sqrt(row[0].length)), regions: row[0], solution: row[1] };
}
async function solve(page, boardSel, rec) {
  for (let r = 0; r < rec.n; r++) {
    const i = r * rec.n + parseInt(rec.solution[r], 36);
    const cell = page.locator(boardSel + ' .cell[data-i="' + i + '"]');
    // empty -> cross -> lantern (solution cells are never auto-crossed)
    await cell.click();
    await cell.click();
  }
}
async function noHScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}
async function smallTargets(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('main a, main button, header a, footer a').forEach((e) => {
      if (e.closest('.board') || e.closest('.prose') || e.closest('.portal-note')) return;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.height < 44 || r.width < 44) out.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    return out;
  });
}
const SEED_DAY = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function seedState(upTo, hintsLeft) {
  const st = {}, tm = {};
  for (let i = 1; i <= upTo; i++) { st[i] = 3; tm[i] = 60; }
  const s = { tutorialDone: true, levelStars: st, levelTimes: tm, settings: { autoX: true, patterns: false, reduceMotion: false } };
  if (hintsLeft !== undefined) s.hints = { date: SEED_DAY(), left: hintsLeft };
  return s;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await playwright.chromium.launch();
  const L1 = level(1);

  // ------------------------------------------------------------ website, two sizes
  for (const [w, h, tag] of [[390, 844, 'mobile'], [1440, 900, 'desktop']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: tag === 'mobile' });
    const page = await ctx.newPage();
    const errs = watch(page);
    const foreign = [];
    page.on('request', (r) => { if (!r.url().startsWith(ORIGIN)) foreign.push(r.url()); });
    const t0 = Date.now();
    await page.goto(LV, { waitUntil: 'load' });
    await page.waitForSelector('#view-tutorial:not([hidden]) #tut-board .cell');
    check(page.url().endsWith('#/tutorial'), tag + ': first visit opens the tutorial (' + (Date.now() - t0) + ' ms to a playable board)');
    await page.screenshot({ path: path.join(SHOTS, tag + '-tutorial.png') });
    // step 1: tap the glowing cell twice
    check(await page.locator('#tut-board .cell.guide').count() === 1, tag + ': step 1 highlights one cell');
    await page.locator('#tut-board .cell.guide').click();
    await page.locator('#tut-board .cell.guide').click();
    check(await page.locator('#tut-next').isEnabled(), tag + ': step 1 done, Next enabled');
    await page.click('#tut-next');
    // step 2: cross the three glowing cells
    const guides = await page.locator('#tut-board .cell.guide').evaluateAll((els) => els.map((e) => e.getAttribute('data-i')));
    check(guides.length === 3, tag + ': step 2 highlights three cells');
    for (const i of guides) await page.locator('#tut-board .cell[data-i="' + i + '"]').click();
    check(await page.locator('#tut-next').isEnabled(), tag + ': step 2 done');
    await page.click('#tut-next');
    await page.waitForSelector('#tut-board[style*="--n: 5"] .cell, #tut-board .cell[data-i="24"]');
    await solve(page, '#tut-board', L1);
    check(await page.locator('#tut-board.won').count() === 1 && await page.locator('#tut-next').isEnabled(), tag + ': step 3 (level 1 board) solved in the tutorial');
    await page.click('#tut-next');
    await page.waitForSelector('#view-select:not([hidden]) .tile');
    check(await page.locator('a.tile').count() === 1, tag + ': level select after the tutorial, only level 1 open');
    check(await noHScroll(page), tag + ': level select has no horizontal scroll');
    const small1 = await smallTargets(page);
    check(small1.length === 0, tag + ': level select touch targets >= 44px ' + JSON.stringify(small1));
    await page.screenshot({ path: path.join(SHOTS, tag + '-select.png'), fullPage: true });

    // level 1
    await page.click('a.tile.is-next');
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    check(await noHScroll(page), tag + ': game view has no horizontal scroll');
    const small2 = await smallTargets(page);
    check(small2.length === 0, tag + ': game view touch targets >= 44px ' + JSON.stringify(small2));
    await solve(page, '#board', L1);
    await page.waitForSelector('#win:not([hidden])');
    const win = await page.evaluate(() => ({
      on: document.querySelectorAll('#win-stars .star.on').length,
      label: document.getElementById('win-stars').getAttribute('aria-label'),
      share: document.getElementById('win').getAttribute('data-share'),
      tile: null
    }));
    check(win.on === 3 && win.label === '3 of 3 stars', tag + ': level 1 solved with 3 stars shown');
    check(/^Lantern Logic Level 1 — 5×5 in \d+:\d\d ✨✨✨\nhttps:\/\/coin-maker3\.github\.io\/lantern-logic\/levels\/$/.test(win.share), tag + ': share text ' + JSON.stringify(win.share));
    await page.screenshot({ path: path.join(SHOTS, tag + '-win.png'), fullPage: tag === 'mobile' });
    await page.click('#btn-levels');
    await page.waitForSelector('#view-select:not([hidden])');
    const tiles = await page.evaluate(() => ({ open: document.querySelectorAll('a.tile').length, stars1: document.querySelectorAll('a.tile[href="#/level/1"] .star.on').length, next: document.querySelector('a.tile.is-next') && document.querySelector('a.tile.is-next').getAttribute('href') }));
    check(tiles.open === 2 && tiles.stars1 === 3 && tiles.next === '#/level/2', tag + ': level 2 unlocked, level 1 tile shows 3 stars ' + JSON.stringify(tiles));

    // reload keeps progress, no tutorial again
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#view-select:not([hidden]) .tile');
    const after = await page.evaluate(() => ({ url: location.hash, total: document.getElementById('total-stars').textContent, open: document.querySelectorAll('a.tile').length }));
    check(after.open === 2 && /^3 of 1800 stars/.test(after.total), tag + ': reload keeps progress ' + JSON.stringify(after));

    // hints on level 2, then an unfinished board survives a reload
    await page.goto(LV + '#/level/2');
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    await page.click('#btn-hint');
    const hint = await page.evaluate(() => ({ count: document.getElementById('hint-count').textContent, status: document.getElementById('status').textContent, ring: document.querySelectorAll('#board .cell.hinted').length }));
    check(hint.count === '2' && hint.status.length > 10 && hint.ring === 1, tag + ': hint used: count 2, reason shown, cell ringed ' + JSON.stringify(hint));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    const kept = await page.evaluate(() => ({ status: document.getElementById('status').textContent, filled: document.querySelectorAll('#board .cell:not([data-s="empty"])').length, hints: document.getElementById('hint-count').textContent }));
    check(/Welcome back/.test(kept.status) && kept.filled > 0 && kept.hints === '2', tag + ': unfinished level 2 kept across reload ' + JSON.stringify(kept));

    // keyboard play
    await page.locator('#board .cell[data-i="0"]').focus();
    await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => document.activeElement.getAttribute('data-i'));
    const before = await page.locator('#board .cell[data-i="1"]').getAttribute('data-s');
    await page.keyboard.press('Enter');
    const afterKey = await page.locator('#board .cell[data-i="1"]').getAttribute('data-s');
    const label = await page.locator('#board .cell[data-i="1"]').getAttribute('aria-label');
    check(focused === '1' && before !== afterKey && /^Row 1, column 2, .+ region, /.test(label), tag + ': arrow keys + Enter play a cell, labelled ' + JSON.stringify(label));

    // hints are shared with the daily page (same local record)
    await page.goto(ORIGIN + '/lantern-logic/', { waitUntil: 'load' });
    await page.waitForSelector('#board .cell');
    check(await page.locator('#hint-count').textContent() === '2', tag + ': daily page shows the same 2 hints left');
    check(await page.locator('a.btn-primary[href="/lantern-logic/levels/"]').count() === 1, tag + ': landing page "Play the full game" points to /levels/');
    check(await page.locator('a[href="/lantern-logic/play/"]').count() >= 1, tag + ': /play/ still linked');

    // mid-campaign level
    await page.goto(LV + '#/settings');
    await page.waitForSelector('#view-settings:not([hidden])');
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, seedState(299)]);
    await page.goto(LV + '#/level/300');
    await page.reload();
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    const L300 = level(300);
    const meta = await page.locator('#level-meta').textContent();
    check(meta.startsWith(L300.n + '×' + L300.n) && /Bonus/.test(meta), tag + ': level 300 loads (' + meta + ')');
    await solve(page, '#board', L300);
    await page.waitForSelector('#win:not([hidden])');
    check(true, tag + ': level 300 solved');
    await page.screenshot({ path: path.join(SHOTS, tag + '-level300.png') });
    await page.goto(LV + '#/level/450');
    await page.waitForSelector('#locked:not([hidden])');
    check(/Solve level 449/.test(await page.locator('#locked-text').textContent()), tag + ': locked level shows the unlock rule');

    // settings
    await page.goto(LV + '#/settings');
    await page.waitForSelector('#view-settings:not([hidden])');
    check(await noHScroll(page), tag + ': settings has no horizontal scroll');
    const small3 = await smallTargets(page);
    check(small3.length === 0, tag + ': settings touch targets >= 44px ' + JSON.stringify(small3));
    await page.click('#set-patterns');
    await page.click('#set-motion');
    check(await page.evaluate(() => document.documentElement.classList.contains('reduce-motion')), tag + ': reduce motion applies');
    await page.screenshot({ path: path.join(SHOTS, tag + '-settings.png'), fullPage: true });
    await page.goto(LV + '#/level/1');
    await page.waitForSelector('#board.show-patterns .cell');
    check(true, tag + ': colour patterns setting reaches the board');
    await page.click('#set-patterns').catch(() => {});

    check(foreign.length === 0, tag + ': no third-party requests ' + JSON.stringify(foreign));
    check(errs.length === 0, tag + ': no console errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  // ------------------------------------------------------------ 320 px
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const page = await ctx.newPage();
    const errs = watch(page);
    for (const route of ['#/tutorial', '#/', '#/level/1', '#/settings']) {
      await page.goto(LV + route);
      await page.waitForTimeout(250);
      if (route === '#/tutorial') await page.evaluate(([k, s]) => { localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seedState(0)]);
      check(await noHScroll(page), '320px ' + route + ': no horizontal scroll');
    }
    check(errs.length === 0, '320px: no console errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  // ------------------------------------------------------------ CrazyGames build, SDK stubbed
  const STUB = `
    window.__SDK = [];
    (function () {
      var store = {};
      try { var seed = JSON.parse(sessionStorage.getItem('__seed') || 'null'); if (seed) store[${JSON.stringify(KEY)}] = JSON.stringify(seed); } catch (e) {}
      function rec(n) { window.__SDK.push(n); }
      window.CrazyGames = { SDK: {
        environment: 'crazygames',
        init: function () { rec('init'); return Promise.resolve(); },
        game: {
          loadingStart: function () { rec('loadingStart'); }, loadingStop: function () { rec('loadingStop'); },
          gameplayStart: function () { rec('gameplayStart'); }, gameplayStop: function () { rec('gameplayStop'); },
          happytime: function () { rec('happytime'); }
        },
        ad: { requestAd: function (type, cb) { rec('requestAd:' + type); setTimeout(function () { cb.adStarted && cb.adStarted(); setTimeout(function () { rec('adFinished:' + type); cb.adFinished && cb.adFinished(); }, 30); }, 30); } },
        data: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); rec('data.setItem'); } }
      } };
    })();`;
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('https://sdk.crazygames.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
    const page = await ctx.newPage();
    const errs = watch(page);
    const calls = () => page.evaluate(() => window.__SDK.filter((c) => c !== 'data.setItem'));
    await page.goto(PORTAL + '/crazygames/', { waitUntil: 'load' });
    await page.waitForSelector('#view-tutorial:not([hidden]) #tut-board .cell');
    await page.locator('#tut-board .cell.guide').click();
    await page.locator('#tut-board .cell.guide').click();
    await page.click('#tut-skip');
    await page.waitForSelector('#view-select:not([hidden])');
    let c = await calls();
    check(JSON.stringify(c.slice(0, 3)) === '["init","loadingStart","loadingStop"]', 'crazygames: init, loadingStart, loadingStop first ' + JSON.stringify(c));
    check(c.includes('gameplayStart') && c[c.length - 1] === 'gameplayStop' && !c.some((x) => x.startsWith('requestAd')), 'crazygames: tutorial = gameplayStart/Stop, no ads ' + JSON.stringify(c));
    const saves = await page.evaluate(() => window.__SDK.filter((x) => x === 'data.setItem').length);
    check(saves > 0, 'crazygames: progress saved through SDK.data (' + saves + ' writes)');

    // levels 21..24 solved in a row, then the 4th Next shows one midgame ad
    await page.evaluate((s) => sessionStorage.setItem('__seed', JSON.stringify(s)), seedState(20, 0));
    await page.goto(PORTAL + '/crazygames/#/level/21');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    await page.evaluate(() => { window.__SDK.length = 0; });
    for (const id of [21, 22, 23, 24]) {
      await page.waitForFunction((t) => document.getElementById('level-title').textContent === t, 'Level ' + id);
      await page.waitForSelector('#board .cell');
      await solve(page, '#board', level(id));
      await page.waitForSelector('#win:not([hidden])');
      await page.click('#btn-next');
    }
    await page.waitForFunction(() => document.getElementById('level-title').textContent === 'Level 25');
    await page.waitForSelector('#board .cell');
    c = await calls();
    const expect = ['gameplayStart', 'happytime', 'gameplayStop'];
    const want = [].concat(expect, expect, expect, expect, ['requestAd:midgame', 'adFinished:midgame']);
    check(JSON.stringify(c) === JSON.stringify(want), 'crazygames: 4 wins -> happytime each, one midgame ad after the 4th ' + JSON.stringify(c));

    // out of free hints: the hint button offers a rewarded ad and grants one hint
    await page.evaluate(() => { window.__SDK.length = 0; });
    check(await page.locator('#hint-count').textContent() === '+1' && await page.locator('#btn-hint').isEnabled(), 'crazygames: out of hints -> hint button offers an ad');
    await page.click('#btn-hint');
    await page.waitForFunction(() => document.getElementById('status').className === 'status is-hint');
    c = await calls();
    check(JSON.stringify(c) === '["requestAd:rewarded","adFinished:rewarded","gameplayStart"]', 'crazygames: rewarded ad, then the hint is applied ' + JSON.stringify(c));
    check(await page.locator('#board .cell.hinted').count() === 1, 'crazygames: hinted cell shown after the ad');
    await page.screenshot({ path: path.join(SHOTS, 'crazygames-level25.png') });
    check(errs.length === 0, 'crazygames: no console errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  // ------------------------------------------------------------ CrazyGames build with the SDK blocked, itch build
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('https://sdk.crazygames.com/**', (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto(PORTAL + '/crazygames/#/level/1', { waitUntil: 'load' });
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    await solve(page, '#board', L1);
    await page.waitForSelector('#win:not([hidden])');
    check(true, 'crazygames: still playable when the SDK cannot load');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errs = watch(page);
    const foreign = [];
    page.on('request', (r) => { if (!r.url().startsWith(PORTAL)) foreign.push(r.url()); });
    await page.goto(PORTAL + '/itch/', { waitUntil: 'load' });
    await page.waitForSelector('#view-tutorial:not([hidden])');
    await page.goto(PORTAL + '/itch/#/level/1');
    await page.waitForSelector('#view-game:not([hidden]) #board .cell');
    await solve(page, '#board', L1);
    await page.waitForSelector('#win:not([hidden])');
    check(foreign.length === 0 && errs.length === 0, 'itch: level 1 playable, no SDK, no outside requests, no errors ' + JSON.stringify(foreign.concat(errs)));
    await page.screenshot({ path: path.join(SHOTS, 'itch-win.png') });
    await ctx.close();
  }

  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILURE(S)' : '\nall campaign web checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
