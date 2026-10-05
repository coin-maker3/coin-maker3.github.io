# GameDistribution and Poki: what would be needed

Not built yet. Both need their own SDK in place of the CrazyGames one. The
campaign already talks to portals through one small interface
(`window.LL_PORTAL`: `ready`, `loaded`, `storage`, `gameplayStart`,
`gameplayStop`, `happytime`, `rewardedAvailable`, `showRewarded`,
`showMidgame`), so each portal is one adapter file, about 80 lines like
`src/crazygames.js`, plus a variant in `tools/build_portal.py`.

## GameDistribution

- Account: sign up at gamedistribution.com (developer), create the game in
  the developer portal to get its **game ID**.
- SDK: their HTML5 SDK (`gdsdk`), configured with `window.GD_OPTIONS = { gameId, onEvent }`.
  Midgame breaks with `gdsdk.showAd()`, rewarded with `gdsdk.showAd('rewarded')`
  (after a preload). The game must pause on `SDK_GAME_PAUSE` and resume on
  `SDK_GAME_START` (we have no sound, so pausing the timer is enough).
- Upload: HTML5 zip with `index.html` at the root, plus thumbnails (512×512
  and other sizes from their form; `crazygames/covers/` can be resized).
- Rules to keep: no external links, no other ad networks, ads only at natural breaks.
- Work: `src/gamedistribution.js` adapter, add the variant to the build
  script, test with their SDK debug mode, then submit for QA.

## Poki

- Poki for Developers is selective: you apply with the game (or a playable
  link) and Poki decides whether to work with it. Poki often asks for web
  exclusivity, so **decide before uploading to CrazyGames** if Poki matters most.
- SDK: Poki SDK (`PokiSDK.init()`, `gameLoadingFinished()`, `gameplayStart()`,
  `gameplayStop()`, `commercialBreak()` for midgame breaks, `rewardedBreak()`
  for the extra hint; both return promises).
- They test load time and mobile play closely; this build (under 100 KB) suits that.
- Rules to keep: no external links, no own ads, no sign-in walls.
- Work: `src/poki.js` adapter (same interface), a build variant, then apply
  through Poki for Developers with the itch.io page or a private test link.
