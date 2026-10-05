/* CrazyGames adapter for the Lantern Logic campaign (portal build only; the
   website never loads this file or the SDK). Talks to the CrazyGames HTML5
   SDK v3 (window.CrazyGames.SDK) and exposes the small interface levels.js
   expects as window.LL_PORTAL. Every SDK call is guarded: if the SDK is
   missing, fails to init or throws, the game still runs, just without ads
   or cloud saves. window.__LL_PORTAL_LOG records the calls in order (tests). */
(function () {
  'use strict';
  var log = window.__LL_PORTAL_LOG = [];
  var sdk = null, ready = false, adBusy = false, memory = {};

  function rec(name) { log.push(name); }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function usable() { return ready && sdk && sdk.environment !== 'disabled'; }

  // Progress: the SDK data module (synced to the player's CrazyGames account,
  // falls back to local storage when logged out), else localStorage, else memory.
  var storage = {
    getItem: function (k) {
      if (usable() && sdk.data) { var v = safe(function () { return sdk.data.getItem(k); }); if (v !== undefined) return v; }
      var w = safe(function () { return window.localStorage.getItem(k); });
      return w !== undefined ? w : (k in memory ? memory[k] : null);
    },
    setItem: function (k, v) {
      memory[k] = v;
      if (usable() && sdk.data) { safe(function () { sdk.data.setItem(k, v); }); return; }
      safe(function () { window.localStorage.setItem(k, v); });
    }
  };

  function requestAd(type, done) {
    if (!usable() || adBusy) { done(false); return; }
    adBusy = true;
    rec('requestAd:' + type);
    var finished = false;
    function end(ok, what) {
      if (finished) return;
      finished = true;
      adBusy = false;
      rec(what);
      done(ok);
    }
    var r = safe(function () {
      sdk.ad.requestAd(type, {
        adStarted: function () { rec('adStarted:' + type); },
        adFinished: function () { end(true, 'adFinished:' + type); },
        adError: function () { end(false, 'adError:' + type); }
      });
      return true;
    });
    if (!r) end(false, 'adError:' + type);
  }

  window.LL_PORTAL = {
    storage: storage,
    ready: function (boot) {
      var started = false;
      function go() { if (!started) { started = true; boot(); } }
      sdk = safe(function () { return window.CrazyGames && window.CrazyGames.SDK; }) || null;
      if (!sdk) { rec('sdk:missing'); go(); return; }
      rec('init');
      var timer = window.setTimeout(function () { rec('init:timeout'); go(); }, 5000);
      var p = safe(function () { return sdk.init(); });
      Promise.resolve(p).then(function () {
        ready = true;
        rec('init:ok:' + sdk.environment);
        if (usable()) { rec('loadingStart'); safe(function () { sdk.game.loadingStart(); }); }
        window.clearTimeout(timer);
        go();
      }, function () { rec('init:failed'); window.clearTimeout(timer); go(); });
    },
    loaded: function () { if (usable()) { rec('loadingStop'); safe(function () { sdk.game.loadingStop(); }); } },
    gameplayStart: function () { if (usable()) { rec('gameplayStart'); safe(function () { sdk.game.gameplayStart(); }); } },
    gameplayStop: function () { if (usable()) { rec('gameplayStop'); safe(function () { sdk.game.gameplayStop(); }); } },
    happytime: function () { if (usable()) { rec('happytime'); safe(function () { sdk.game.happytime(); }); } },
    // Rewarded ad for one extra hint: only offered when out of free hints.
    rewardedAvailable: function () { return usable(); },
    showRewarded: function (done) { requestAd('rewarded', done); },
    // Midgame ad at a natural break; the game continues however it ends.
    showMidgame: function (cont) { requestAd('midgame', function () { cont(); }); }
  };
})();
