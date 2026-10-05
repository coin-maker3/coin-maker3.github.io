# Lantern Logic: web portal packages

Not part of the website: nothing on the site links here, the folder is not in
the sitemap, and `index.html` here is `noindex`. Rebuild everything with

```bash
python3 lantern-logic/tools/build_portal.py            # zips, from the committed level data
python3 lantern-logic/tools/build_portal.py --covers   # also redraw covers (Pillow + ../lantern-logic/store/icon_512.png)
```

| File | What |
|---|---|
| `lantern-logic-crazygames.zip` | CrazyGames build: `index.html` at the root, CrazyGames HTML5 SDK v3 + adapter `assets/crazygames.js`, 30 files, about 94 KB |
| `lantern-logic-itch.zip` | itch.io build: no SDK, no ads, one link to the free daily on the website, 29 files, about 92 KB |
| `crazygames/covers/` | `cover-landscape-1920x1080.png`, `cover-portrait-800x1200.png`, `cover-square-800x800.png`, plus `thumb-800x450.png` and `icon-512x512.png` |
| `crazygames/listing.md` | Title, description, controls, tags to paste into the CrazyGames form |
| `gamedistribution-poki.md` | What GameDistribution and Poki would need |
| `src/crazygames.js` | Adapter source (copied into the CrazyGames zip) |

Both builds are the same campaign as `/lantern-logic/levels/` (600 levels,
tutorial, settings, stars, hints, unlocks), with relative paths only. The daily
puzzle is not included: its future puzzles are never published in the clear,
and the portals do not allow pulling content from another site.

## CrazyGames adapter (src/crazygames.js)

| Game event | SDK call |
|---|---|
| page start | `SDK.init()`, then `game.loadingStart()`; `game.loadingStop()` once the first view is drawn |
| first move on a board, tutorial step shown | `game.gameplayStart()` |
| level solved | `game.happytime()`, then `game.gameplayStop()` |
| leaving a board, tab hidden, menus | `game.gameplayStop()` |
| out of free hints, player presses Hint (+1) | `ad.requestAd('rewarded')`; one hint on `adFinished` |
| Next / Levels after a solved level, from level 21 on, at most once per 4 solved levels | `ad.requestAd('midgame')`; the game continues on `adFinished` or `adError` |
| progress | `SDK.data` (CrazyGames account, local fallback when logged out) |

Never during the tutorial (it has no hint button and no Next-level break). If
the SDK fails to load or init, the game runs without ads or cloud saves
(tested). The game has no sound, so nothing needs muting during ads.
