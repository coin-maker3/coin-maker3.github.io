# Lantern Logic on the web: notes

Built 5 October 2026. Everything under `lantern-logic/` plus the root
`sitemap.xml`, `robots.txt` and `.github/workflows/lantern-daily.yml`.
This file is not in the sitemap.

## What is here

| URL | What |
|---|---|
| `/lantern-logic/` | Landing page with today's daily puzzle playable inline |
| `/lantern-logic/daily/N/` | Archive page for every daily from #1 (2026-10-01) to today (UTC), playable, with prev/next links |
| `/lantern-logic/daily/` | Archive list by month |
| `/lantern-logic/daily/data/N.json` | One small JSON per day, published up to UTC today + 1 |
| `/lantern-logic/how-to-play/` | Rules, controls, scoring and tips with inline-SVG example boards |
| `/lantern-logic/privacy/` | Privacy policy for the web pages and the app |
| `/lantern-logic/play/` | The Godot web export of the full game (moved from `/lantern-logic/`) |
| `assets/` | `site.css`, `puzzle.js` (rules engine), `app.js` (UI), Fraunces font (OFL, 16 KB subset), `og.png` 1200×630, favicons |
| `tools/` | Generator, tests, encrypted puzzle bundle, OG-image script |

Plain HTML, CSS and vanilla JS. No build step to serve, no framework, no
third-party scripts, fonts, CDNs, cookies, analytics or ads. The daily page
weighs about 71 KB uncompressed (HTML 15 KB, CSS 18 KB, JS 39 KB, data
embedded) plus the 16 KB font.

## Same puzzle, same rules as the app

* `assets/puzzle.js` is a line-by-line port of `scripts/core/puzzle.gd`:
  attack set (same row, column, region, or any of the 8 neighbours, so
  diagonal touching is forbidden: verified in `lanterns_clash`), conflicts,
  win check (N lanterns and no conflicts), tap cycle empty → cross → lantern,
  auto-cross with per-cell counters so removing a lantern takes back only its
  own crosses, undo (500 steps, restart is undoable), hints in the app's exact
  order, stars (`stars_for`), time format and share text.
* Drag-marking follows `board_view.gd`: press on a cell and move to another
  cell, and every empty cell touched becomes a cross (no auto-cross); a press
  without moving is a tap.
* Daily maths follows `game.gd`: index = days since 2026-10-01 of the
  visitor's **local** calendar date, clamped to 0 before the epoch and wrapping
  after 730 (`k % 730`); the public number `#N = days + 1` never wraps
  (`daily_number_for`). The web loads `daily/data/N.json`, whose puzzle is
  `daily.json[(N - 1) % 730]`.
* Mistakes count like the app (placing a lantern that clashes). Three free
  hints per local day, as in the app.
* Colour-blind patterns reproduce the 11 shapes of `_draw_pattern`; the
  region colours are the palette's Okabe-Ito set darkened by 22 % like
  `Pal.region_color`, and marks turn light on the one dark region as in the app.

### Verified against the real GDScript

Godot 4.6.1 (headless) ran the app's own `Game.daily_index_for`,
`daily_number_for` and `daily_share_text` for 8 dates (2026-09-15,
2026-10-01, 10-05, 10-06, 12-25, 2027-02-28, 2028-02-29 and 2028-09-30 = #731,
which wraps to index 0). The results are stored in `tools/app_reference.json`
with each puzzle only as a sha256, so no future puzzle is revealed.
The same run solved 9 daily puzzles by repeatedly applying `hint()`; the JS
port produced the identical 174-step sequence (cells, states and reason texts).

## How the daily workflow works

The public repository must never hold future puzzles in the clear, and the
app repository is private. So:

1. `tools/daily.enc` holds all 730 daily puzzles, encrypted with AES-256-CBC
   (`openssl enc -pbkdf2 -iter 200000 -md sha256`).
2. The repository secret **`LANTERN_DAILY_KEY`** decrypts it. The key is not
   in any repository.
3. `.github/workflows/lantern-daily.yml` runs at 00:05 UTC (and on manual
   dispatch): `python3 lantern-logic/tools/build.py` writes the data files up to
   UTC today + 1, archive pages and the home page up to UTC today, merges the
   root sitemap and makes sure robots.txt has the Sitemap line; then
   `tools/test_daily.py` re-verifies every published puzzle (unique solution,
   rules hold, equal to the app's data, nothing published beyond the window),
   and the job commits and pushes only if something changed, then asks GitHub
   Pages to rebuild. Re-running on the same day changes nothing (tested).
4. `build.py` also deletes any data file beyond UTC today + 1 and any archive
   page beyond today, so a mistaken run with a wrong date cannot leak days.

Why publish tomorrow's data: a visitor at UTC+14 reaches the next calendar
date at 10:00 UTC, so it must be online before then. The 00:05 run leaves
about ten hours of margin for a late or retried Actions run.

If the run fails, the site keeps working: visitors whose local date has no
data yet see a "not published yet" card that links to the latest puzzle.

**Setup needed once:** add the secret in *Settings → Secrets and variables →
Actions → New repository secret*, name `LANTERN_DAILY_KEY`. The value was
sent to the owner with the routine's notification. Then run the workflow once
from the Actions tab (workflow_dispatch) to check it. Without the secret the
workflow fails on purpose, and the site stops advancing after #6.

Regenerating or rotating: `export LANTERN_DAILY_KEY=...; python3 tools/build.py --encrypt path/to/daily.json`.
Building locally from the app's data instead: `python3 tools/build.py --source ../lantern-logic/data/daily.json`.

### Puzzle 731 onwards

On 2028-09-30 the number becomes #731 and the puzzle wraps to index 0, exactly
like the app. The workflow keeps going without changes.

## Tests

From the repository root:

```bash
python3 lantern-logic/tools/test_daily.py --source ../lantern-logic/data/daily.json --godot-hints gt.json
python3 -m http.server 8080 &
node lantern-logic/tools/test_web.js http://localhost:8080 /tmp/shots
```

Results on 5 October 2026:

* `test_daily.py`: 6 published puzzles (#1 to #6) unique and rule-abiding,
  equal to the app's `daily.json`; 8 reference dates match the GDScript index,
  number and share text, with 8 puzzles compared by hash; hint port identical
  on 9 puzzles. Separately, the same checker passed all 730 daily puzzles and
  rejected a deliberately broken one.
* `test_web.js` (headless Chromium): today's puzzle solved by clicking the
  solution cells at 390×844 and 1440×900, win state, streak 1, three sparkles,
  share text `Lantern Logic Daily #5 — 9×9 in 0:00 ✨✨✨` plus the archive
  link; reload keeps the result; keyboard play (arrows, Enter, Space), cell
  labels, auto-cross, conflict glow and error status, undo, restart, drag
  crosses, hint (count, reason, highlight), colour patterns; UTC+14 and UTC−10
  visitors get #6 and #4; a far-future device date gets the empty state; a
  crawl of all 10 page URLs and their assets found no broken links and no
  console errors; `/play/` boots the Godot game (canvas up, loader removed, only
  SwiftShader WebGL notices in the console).
* Layout checked at 320, 360, 390, 768, 1024 and 1440 px: no horizontal
  scrolling, and every control outside the board is at least 44 px.

## Decisions

* **Timer starts on the first move**, not on page load, because the board sits
  on a landing page that people read first. It pauses while the tab is hidden
  (the app pauses on focus loss). An unfinished board, time, hints and
  mistakes survive a reload.
* **Streaks** count only a puzzle solved on its own local date, as in the app
  where only today's daily can be played. Archive solves keep a best time per
  puzzle but leave the streak alone.
* **Share link**: the archive URL of the puzzle (`/daily/N/`), or the home page
  when the visitor is ahead of UTC and that archive page does not exist yet.
  Web Share API first, then the async clipboard, then `execCommand('copy')`,
  then a message to copy the visible preview by hand.
* **Dark theme only**: the game, store art and use scene (evening play) are
  all night-sky, so there is no light variant. `color-scheme: dark` themes form
  controls and scrollbars.
* **One authored motion**: on a win the lanterns light up one after another
  (glow bloom, exponential ease-out, 110 ms stagger) and the board takes a warm
  wash. Crosses only fade in briefly. `prefers-reduced-motion` turns all of it
  off.
* **Board cells** are as large as the screen allows: 9×9 boards give about
  42 px cells at 390 px and 34 px at 320 px (the app has the same constraint);
  drag-marking helps there. Every other control is at least 44 px.
* **Font**: Fraunces 600, cut to Latin and instanced to one weight
  (16 KB WOFF2), for headings only; body text uses the system UI font.
* **Wording**: "Queens-style" and "Star Battle" only, no other brand names.
  The full-game link says it is about a 38 MB download. "Coming soon on Google
  Play" is plain text with no badge.
* **Privacy contact**: the store policy had a placeholder e-mail; the web
  policy points to the public repository's issues instead. Replace it with a
  support address when there is one (also needed for Play).
* `/play/` keeps the Godot shell untouched except for a fuller title, meta
  description, canonical URL and theme colour.

## Left to do

* Add the `LANTERN_DAILY_KEY` secret (above), or the site stops at #6.
* When the Play listing is live, swap the "Coming soon" line for a plain link.
* Search Console: submit `https://coin-maker3.github.io/sitemap.xml`.
