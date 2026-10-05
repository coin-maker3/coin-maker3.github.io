#!/usr/bin/env node
/* End-to-end check of the Lantern Logic pages in headless Chromium.

   Serve the repository root first, e.g.
     python3 -m http.server 8080          (from the coin-maker3.github.io folder)
   then
     node lantern-logic/tools/test_web.js [http://localhost:8080] [screenshot-dir]

   Needs the `playwright` package (global or local). Exits non-zero on failure. */
'use strict';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const path = require('path');
const fs = require('fs');

const ORIGIN = process.argv[2] || 'http://localhost:8080';
const SHOTS = process.argv[3] || path.join(require('os').tmpdir(), 'lantern-shots');
const BASE = '/lantern-logic/';
const SHARE_RE = /^Lantern Logic Daily #(\d+) — (\d+)×(\d+) in \d+:\d\d ✨{1,3}\nhttps:\/\/coin-maker3\.github\.io\/lantern-logic\/(daily\/\d+\/)?$/;
const failures = [];
function check(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failures.push(msg); }

function watchConsole(page, bag) {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bag.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => bag.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) bag.push('HTTP ' + r.status() + ': ' + r.url()); });
}

async function cellBox(page, i) {
  return page.locator('.cell[data-i="' + i + '"]').boundingBox();
}

async function solveByClicking(page) {
  const d = await page.evaluate(() => {
    const t = document.getElementById('puzzle-title').textContent;
    return { title: t, n: +getComputedStyle(document.getElementById('board')).getPropertyValue('--n') };
  });
  const num = +d.title.replace(/\D/g, '');
  const rec = await page.evaluate((u) => fetch(u).then((r) => r.json()), BASE + 'daily/data/' + num + '.json');
  for (let r = 0; r < rec.n; r++) {
    const c = parseInt(rec.solution[r], 36);
    const i = r * rec.n + c;
    // empty -> cross -> lantern
    await page.locator('.cell[data-i="' + i + '"]').click();
    await page.locator('.cell[data-i="' + i + '"]').click();
  }
  return rec;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await playwright.chromium.launch();

  // ---------------------------------------------------------------- solve today at two sizes
  for (const [w, h, tag] of [[390, 844, 'mobile'], [1440, 900, 'desktop']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'mobile' ? 2 : 1, hasTouch: tag === 'mobile' });
    const page = await ctx.newPage();
    const errs = [];
    watchConsole(page, errs);
    await page.goto(ORIGIN + BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#play.is-ready');
    const local = await page.evaluate(() => LanternPuzzle.dailyNumberFor(LanternPuzzle.localToday()));
    const title = await page.textContent('#puzzle-title');
    check(title === 'Daily #' + local, tag + ': home shows the local daily number (' + title + ')');
    await page.screenshot({ path: path.join(SHOTS, 'home-' + tag + '.png') });
    const rec = await solveByClicking(page);
    await page.waitForSelector('#win:not([hidden])', { timeout: 5000 });
    const share = await page.getAttribute('#win', 'data-share');
    const preview = await page.textContent('#share-preview');
    check(SHARE_RE.test(share), tag + ': share text format: ' + JSON.stringify(share));
    check(preview.startsWith('Lantern Logic Daily #' + rec.number + ' — ' + rec.n + '×' + rec.n + ' in ') && preview.endsWith('✨✨✨'),
      tag + ': clean solve earns three sparkles: ' + preview);
    check(await page.locator('#board.won').count() === 1, tag + ': board is in the won state');
    check((await page.textContent('#status')).includes('Solved'), tag + ': status announces the win');
    check((await page.textContent('#stat-streak')) === '1', tag + ': streak is 1 after solving today');
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(SHOTS, 'solved-' + tag + '.png'), fullPage: false });
    await page.locator('#win').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, 'solved-' + tag + '-win.png') });
    // reload keeps the result
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#win:not([hidden])');
    check(true, tag + ': reload shows the solved result');
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= w, tag + ': no horizontal scroll (' + sw + ')');
    check(errs.length === 0, tag + ': no console errors on home ' + JSON.stringify(errs));
    await ctx.close();
  }

  // ---------------------------------------------------------------- interactions on an archive page
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errs = [];
    watchConsole(page, errs);
    await page.goto(ORIGIN + BASE + 'daily/1/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#play.is-ready');
    const n = await page.evaluate(() => JSON.parse(document.getElementById('puzzle-data').textContent).n);
    // keyboard: focus first cell, move right, Enter twice -> lantern
    await page.locator('.cell[data-i="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const focused = await page.evaluate(() => document.activeElement.getAttribute('data-i'));
    check(+focused === n + 1, 'keyboard: arrows move focus (now ' + focused + ')');
    await page.keyboard.press('Enter');
    check((await page.getAttribute('.cell[data-i="' + (n + 1) + '"]', 'data-s')) === 'mark', 'keyboard: Enter crosses a cell');
    await page.keyboard.press(' ');
    check((await page.getAttribute('.cell[data-i="' + (n + 1) + '"]', 'data-s')) === 'lantern', 'keyboard: Space places a lantern');
    const label = await page.getAttribute('.cell[data-i="' + (n + 1) + '"]', 'aria-label');
    check(/^Row 2, column 2, .+ region, lantern/.test(label), 'screen-reader label: ' + label);
    const autoCount = await page.locator('.cell.auto[data-s="mark"]').count();
    check(autoCount > 0, 'auto-cross marked ' + autoCount + ' cells');
    // conflict: a lantern on the same row via mouse (cell r1, c n-1, after clearing its auto cross)
    const j = n + (n - 1);
    await page.locator('.cell[data-i="' + j + '"]').click(); // auto-cross -> lantern? (cycle from mark)
    const sj = await page.getAttribute('.cell[data-i="' + j + '"]', 'data-s');
    if (sj !== 'lantern') await page.locator('.cell[data-i="' + j + '"]').click();
    check(await page.locator('.cell.bad').count() === 2, 'conflict glow on both clashing lanterns');
    check((await page.getAttribute('#status', 'class')).includes('is-error'), 'conflict shows an error status');
    // undo
    await page.click('#btn-undo');
    await page.click('#btn-undo');
    check(await page.locator('.cell.bad').count() === 0, 'undo removes the clash');
    // restart then drag-mark a row
    await page.click('#btn-restart');
    check(await page.locator('.cell[data-s="lantern"]').count() === 0, 'restart clears the board');
    const a = await cellBox(page, (n - 1) * n), b = await cellBox(page, (n - 1) * n + 3);
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    const dragged = await page.evaluate((nn) => [0, 1, 2, 3].map((k) => document.querySelector('.cell[data-i="' + ((nn - 1) * nn + k) + '"]').getAttribute('data-s')), n);
    check(dragged.every((s) => s === 'mark'), 'drag paints crosses: ' + dragged.join(','));
    // hint
    const before = +(await page.textContent('#hint-count'));
    await page.click('#btn-hint');
    const after = +(await page.textContent('#hint-count'));
    check(after === before - 1, 'hint uses one of today\'s hints (' + before + ' -> ' + after + ')');
    check((await page.textContent('#status')).length > 5, 'hint explains itself: ' + (await page.textContent('#status')));
    check(await page.locator('.cell.hinted').count() === 1, 'hint highlights a cell');
    // patterns toggle
    await page.click('#opt-patterns');
    check(await page.locator('#board.show-patterns').count() === 1, 'colour patterns toggle on');
    await page.screenshot({ path: path.join(SHOTS, 'archive-interactions-mobile.png') });
    // pager
    check(await page.locator('.pager a[rel="next"]').count() === 1 && await page.locator('.pager a[rel="prev"]').count() === 0, 'day #1 has next but no prev');
    check(errs.length === 0, 'no console errors on archive page ' + JSON.stringify(errs));
    await ctx.close();
  }

  // ---------------------------------------------------------------- time zones and unpublished days
  {
    const ctx = await browser.newContext({ timezoneId: 'Pacific/Kiritimati', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z')); // local 6 Oct
    await page.goto(ORIGIN + BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#play.is-ready');
    check((await page.textContent('#puzzle-title')) === 'Daily #6', 'UTC+14 on 6 Oct local gets Daily #6 from daily/data/6.json');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ timezoneId: 'Pacific/Honolulu', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-10-05T06:00:00Z')); // local 4 Oct
    await page.goto(ORIGIN + BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#play.is-ready');
    check((await page.textContent('#puzzle-title')) === 'Daily #4', 'UTC-10 on 4 Oct local gets Daily #4');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2030-01-01T12:00:00Z'));
    await page.goto(ORIGIN + BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#unavailable:not([hidden])');
    check(true, 'a far-future device date shows the "not published yet" state');
    await page.screenshot({ path: path.join(SHOTS, 'unavailable-mobile.png') });
    await ctx.close();
  }

  // ---------------------------------------------------------------- every page type: console + crawl links
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const seen = new Set(), queue = [BASE], bad = [];
    while (queue.length) {
      const u = queue.shift();
      if (seen.has(u)) continue;
      seen.add(u);
      if (u.startsWith(BASE + 'play/')) continue; // checked separately below
      const errs = [];
      watchConsole(page, errs);
      const resp = await page.goto(ORIGIN + u, { waitUntil: 'networkidle' });
      if (!resp || resp.status() !== 200) { bad.push(u + ' -> ' + (resp && resp.status())); continue; }
      const refs = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href], link[href], script[src], img[src]').forEach((e) => out.push(e.getAttribute('href') || e.getAttribute('src')));
        return out;
      });
      page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
      if (errs.length) bad.push(u + ' console: ' + errs.join(' | '));
      for (const r of refs) {
        if (!r || r.startsWith('#') || r.startsWith('mailto:')) continue;
        const abs = new URL(r, ORIGIN + u);
        if (abs.origin === 'https://coin-maker3.github.io') {
          abs.protocol = 'http:'; // canonical/og URLs: check the local copy of the same path
          const local = abs.pathname;
          if (local.startsWith(BASE) && !seen.has(local) && /\/$|\.html$/.test(local)) queue.push(local);
          const st = (await page.request.get(ORIGIN + local)).status();
          if (st !== 200) bad.push(u + ' -> ' + r + ' (' + st + ')');
        } else if (abs.origin === new URL(ORIGIN).origin) {
          if (abs.pathname.startsWith(BASE) && !seen.has(abs.pathname) && /\/$|\.html$/.test(abs.pathname)) queue.push(abs.pathname);
          const st = (await page.request.get(abs.href)).status();
          if (st !== 200) bad.push(u + ' -> ' + r + ' (' + st + ')');
        }
      }
    }
    check(bad.length === 0, 'crawled ' + seen.size + ' pages: all links/assets resolve, no console errors ' + JSON.stringify(bad));
    await ctx.close();
  }

  // ---------------------------------------------------------------- the Godot build at /play/
  {
    const ctx = await browser.newContext({ viewport: { width: 540, height: 1000 } });
    const page = await ctx.newPage();
    const errs = [];
    watchConsole(page, errs);
    await page.goto(ORIGIN + BASE + 'play/', { waitUntil: 'load' });
    await page.waitForSelector('#canvas');
    // the engine removes its loading overlay (#status) once the game has started
    await page.waitForFunction(() => !document.getElementById('status') && document.getElementById('canvas').width > 0,
      null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const state = await page.evaluate(() => ({
      canvas: !!document.getElementById('canvas'),
      w: document.getElementById('canvas').width,
      overlayRemoved: !document.getElementById('status'),
    }));
    await page.screenshot({ path: path.join(SHOTS, 'play-godot.png') });
    check(state.canvas && state.w > 0 && state.overlayRemoved, '/play/ boots the Godot game ' + JSON.stringify(state));
    const unexpected = errs.filter((e) => !/WebGL|GPU stall|swiftshader|GroupMarkerNotSet|Automatic fallback to software WebGL/i.test(e));
    check(unexpected.length === 0, '/play/ has no unexpected console errors ' + JSON.stringify(unexpected));
    if (errs.length) console.log('     (ignored GPU/WebGL notices: ' + (errs.length - unexpected.length) + ')');
    await ctx.close();
  }

  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILED' : '\nALL WEB CHECKS PASSED');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
