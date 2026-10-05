#!/usr/bin/env python3
"""Build the web campaign: /lantern-logic/levels/ (all 600 levels).

  python3 tools/build_levels.py --source ../lantern-logic/data/levels.json
  python3 tools/build_levels.py            # rebuild the page from the committed data

Outputs (relative to lantern-logic/):
  levels/data/pK.json   pack K (30 levels): {"pack":K,"first":F,"levels":[[regions, solution, kind]]}
                        kind: "n" normal, "e" breather (every 5th), "b" bonus (every 10th)
  levels/index.html     the campaign page (level select, game, tutorial, settings)

The page reuses the site's head, header, footer and icons from build.py, so it
always matches the daily pages. Levels are not time-gated, so their data is
public; the daily puzzles stay in the encrypted bundle. Standard library only.
Not run by the daily workflow (it has no access to the app's levels.json).
"""

import argparse
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as site  # noqa: E402  (head, header, footer, icons, write)

WEB = site.WEB
LEVELS_DIR = os.path.join(WEB, "levels")
DATA_DIR = os.path.join(LEVELS_DIR, "data")
PER_PACK = 30
KIND_CODE = {"normal": "n", "easy": "e", "bonus": "b"}

# Icons the campaign needs on top of build.ICONS.
EXTRA_ICONS = """<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></symbol>
<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></symbol>
</svg>"""

ico = site.ico


# ---------------------------------------------------------------- data

def load_source(path):
    with open(path, encoding="utf-8") as f:
        levels = json.load(f)["levels"]
    for k, lv in enumerate(levels, 1):
        if lv["id"] != k:
            sys.exit("levels.json: level %d has id %s" % (k, lv["id"]))
    return levels


def write_packs(levels):
    os.makedirs(DATA_DIR, exist_ok=True)
    packs = (len(levels) + PER_PACK - 1) // PER_PACK
    for k in range(1, packs + 1):
        chunk = levels[(k - 1) * PER_PACK: k * PER_PACK]
        rec = {"pack": k, "first": chunk[0]["id"],
               "levels": [[lv["regions"], lv["solution"], KIND_CODE[lv.get("kind", "normal")]] for lv in chunk]}
        site.write(os.path.join(DATA_DIR, "p%d.json" % k), json.dumps(rec, separators=(",", ":")) + "\n")
    for name in os.listdir(DATA_DIR):   # no stale packs
        if name.startswith("p") and name.endswith(".json") and int(name[1:-5]) > packs:
            os.remove(os.path.join(DATA_DIR, name))


def read_packs():
    """All levels from the committed pack files, in order: [(regions, solution, kind)]."""
    out = []
    k = 1
    while os.path.exists(os.path.join(DATA_DIR, "p%d.json" % k)):
        with open(os.path.join(DATA_DIR, "p%d.json" % k), encoding="utf-8") as f:
            rec = json.load(f)
        if rec["first"] != len(out) + 1:
            sys.exit("pack %d starts at %d, expected %d" % (k, rec["first"], len(out) + 1))
        out.extend(rec["levels"])
        k += 1
    if not out:
        sys.exit("no level data in %s; run with --source" % DATA_DIR)
    return out


def size_of(regions):
    n = int(round(len(regions) ** 0.5))
    assert n * n == len(regions)
    return n


def content_version(levels):
    """Short hash of the data and the campaign scripts, used to bust caches."""
    h = hashlib.sha256()
    h.update(json.dumps(levels, separators=(",", ":")).encode())
    for name in ("puzzle.js", "board.js", "levels.js", "levels.css", "site.css"):
        with open(os.path.join(WEB, "assets", name), "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:8]


def config(levels, data_url, site_mode, share_url):
    return {"count": len(levels),
            "sizes": "".join("%x" % size_of(lv[0]) for lv in levels),
            "kinds": "".join(lv[2] for lv in levels),
            "data": data_url, "v": content_version(levels), "site": site_mode, "shareUrl": share_url}


# ---------------------------------------------------------------- page

def body(variant, cfg):
    """Shared markup of the campaign. variant: 'site', 'crazygames' or 'itch'."""
    is_site = variant == "site"
    daily_card = ""
    about = ""
    if is_site:
        daily_card = ('<a class="daily-card" id="daily-card" href="{b}">{cal}<span class="daily-copy"><strong>Today\'s daily puzzle</strong>'
                      '<span id="daily-text">A new board every day</span></span>{right}</a>').format(
            b=site.BASE, cal=ico("calendar"), right=ico("right"))
        about = """<section class="prose camp-about" aria-labelledby="about-levels">
<h2 id="about-levels">About the levels</h2>
<p>The 600 levels come in 20 packs of 30. Boards grow from gentle 5×5 grids to tricky 11×11 ones; every fifth level is a breather and every tenth a harder bonus. Solving a level unlocks the next one.</p>
<p>Solve without hints or mistakes for three stars; one hint and up to three mistakes still earn two. You get three free hints a day, shared with the <a href="{b}">daily puzzle</a>, and every board has exactly one solution that you can reach without guessing. New to the rules? <a href="#/tutorial">Take the short tutorial</a> or read <a href="{b}how-to-play/">how to play</a>.</p>
<p>Your stars, best times and unfinished board stay in this browser. Nothing is sent anywhere.</p>
</section>""".format(b=site.BASE)
    portal_note = ""
    if variant == "itch":
        portal_note = ('<p class="portal-note">A new free daily puzzle every day at '
                       '<a href="https://coin-maker3.github.io/lantern-logic/" target="_blank" rel="noopener">coin-maker3.github.io/lantern-logic</a>.</p>')
    sw = '<button class="switch" type="button" role="switch" id="{id}" aria-checked="false"{desc}><span class="track" aria-hidden="true"></span>{label}</button>'
    return """<main id="main" class="campaign">
<noscript><div class="noscript"><p>The levels need JavaScript to play.</p></div></noscript>
<section class="view camp" id="view-select" hidden aria-labelledby="sel-title">
<div class="camp-head">
<div><h1 id="sel-title" tabindex="-1" data-focus>600 levels</h1><p class="puzzle-meta" id="total-stars">0 of 1800 stars</p></div>
<a class="btn btn-primary" id="continue" href="#/level/1">{play}<span id="continue-label">Start: level 1</span></a>
</div>
{daily_card}
<div class="pack-nav">
<button class="btn btn-icon" type="button" id="pack-prev" aria-label="Previous pack">{left}</button>
<div class="pack-head"><h2 id="pack-title" tabindex="-1">Pack 1</h2><p class="puzzle-meta" id="pack-meta"></p></div>
<button class="btn btn-icon" type="button" id="pack-next" aria-label="Next pack">{right}</button>
</div>
<ol class="tiles" id="tiles" aria-labelledby="pack-title"></ol>
<div class="camp-links"><a class="btn btn-ghost" href="#/tutorial">{hint}<span>How to play</span></a><a class="btn btn-ghost" href="#/settings">{gear}<span>Settings</span></a></div>
<h2 class="packs-title" id="packs-title">All packs</h2>
<ol class="packs" id="packs" aria-labelledby="packs-title"></ol>
{about}{portal_note}
</section>
<section class="play view" id="view-game" hidden aria-labelledby="level-title">
<div class="play-head">
<div><h1 id="level-title" tabindex="-1" data-focus>Level 1</h1><p class="puzzle-meta" id="level-meta"></p></div>
<div class="timer" role="timer" aria-label="Time taken">{clock}<span id="timer">0:00</span></div>
</div>
<div class="board-wrap"><div class="board" id="board" role="grid" aria-label="Puzzle board"></div></div>
<div class="unavailable" id="locked" hidden><p><strong>This level is locked.</strong></p><p id="locked-text"></p><a class="btn btn-primary" id="locked-link" href="#/">{play}<span id="locked-link-label">Play</span></a></div>
<p class="status" id="status" role="status" aria-live="polite"></p>
<div class="toolbar">
<button class="btn" type="button" id="btn-undo" disabled>{undo}<span>Undo</span></button>
<button class="btn" type="button" id="btn-restart" disabled>{restart}<span>Restart</span></button>
<button class="btn" type="button" id="btn-hint" aria-label="Hint">{hint}<span>Hint <span class="count" id="hint-count">3</span></span></button>
</div>
<div class="toggles">
<button class="switch" type="button" role="switch" id="opt-autox" aria-checked="true"><span class="track" aria-hidden="true"></span>Auto-cross</button>
<button class="switch" type="button" role="switch" id="opt-patterns" aria-checked="false"><span class="track" aria-hidden="true"></span>Colour patterns</button>
</div>
<div class="win" id="win" hidden>
<h2 id="win-title" tabindex="-1">Solved!</h2>
<div class="win-stars" id="win-stars" role="img" aria-label="Stars"></div>
<p class="win-time" id="win-time">0:00</p>
<p class="win-detail" id="win-detail"></p>
<p class="win-detail" id="win-last" hidden>You lit every lantern in all 600 levels. Amazing!</p>
<p class="share-preview" id="share-preview"></p>
<div class="win-actions">
<button class="btn btn-primary" type="button" id="btn-next"><span>Next level</span>{right}</button>
<button class="btn" type="button" id="btn-share">{share}<span>Share</span></button>
<button class="btn btn-ghost" type="button" id="btn-levels">{grid}<span>Levels</span></button>
<button class="btn btn-ghost" type="button" id="btn-again">{restart}<span>Play again</span></button>
</div>
<p class="share-msg" id="share-msg" role="status" aria-live="polite"></p>
</div>
<dl class="stats">
<div><dt>Your stars</dt><dd id="stat-stars">0 / 3</dd></div>
<div><dt>Best time</dt><dd id="stat-best">–</dd></div>
<div><dt>All stars</dt><dd id="stat-total">0</dd></div>
<div><dt>Hints today</dt><dd id="stat-hints">3</dd></div>
</dl>
<nav class="pager" aria-label="Other levels"><a id="prev-level" href="#/">{left}Previous</a><a class="pager-mid" id="pack-link" href="#/">{grid}All levels</a><a id="next-level" href="#/">Next{right}</a></nav>
</section>
<section class="play view tut" id="view-tutorial" hidden aria-labelledby="tut-title">
<div class="play-head"><div><h1 id="tut-title" tabindex="-1" data-focus>How to play</h1><p class="tut-text" id="tut-text" aria-live="polite"></p></div></div>
<div class="board-wrap"><div class="board" id="tut-board" role="grid" aria-label="Tutorial board"></div></div>
<p class="status" id="tut-status" role="status" aria-live="polite"></p>
<div class="toolbar">
<button class="btn btn-ghost" type="button" id="tut-skip"><span>Skip</span></button>
<button class="btn btn-primary" type="button" id="tut-next" disabled><span>Next</span>{right}</button>
</div>
</section>
<section class="view settings" id="view-settings" hidden aria-labelledby="set-title">
<h1 id="set-title" tabindex="-1" data-focus>Settings</h1>
<div class="set-list">
<div class="set-row">{sw_autox}<p id="d-autox">Placing a lantern crosses out every cell it rules out. Removing it takes back only its own crosses.</p></div>
<div class="set-row">{sw_pat}<p id="d-pat">Adds a small shape to each colour region, so the board never relies on colour alone.</p></div>
<div class="set-row">{sw_motion}<p id="d-motion">Turns off the win animation and other movement. It is always off when your device asks for reduced motion.</p></div>
</div>
<p class="status" id="settings-status" role="status" aria-live="polite"></p>
<h2>Progress</h2>
<p class="soon">Your progress is saved {where}.</p>
<div class="reset">
<button class="btn" type="button" id="btn-reset">{restart}<span>Reset level progress</span></button>
<div class="reset-confirm" id="reset-confirm" hidden>
<p>Clear the stars, best times and tutorial for all 600 levels? Daily puzzle results are kept. This cannot be undone.</p>
<div class="row-btns"><button class="btn" type="button" id="reset-cancel">Cancel</button><button class="btn btn-danger" type="button" id="reset-ok">Reset</button></div>
</div>
</div>
<p><a class="btn btn-ghost" href="#/">{left}<span>Back to levels</span></a></p>
</section>
</main>
<script type="application/json" id="ll-config">{cfg}</script>
""".format(play=ico("play"), left=ico("left"), right=ico("right"), hint=ico("hint"), gear=ico("gear"), grid=ico("grid"),
           clock=ico("clock"), undo=ico("undo"), restart=ico("restart"), share=ico("share"),
           daily_card=daily_card, about=about, portal_note=portal_note,
           sw_autox=sw.format(id="set-autox", label="Auto-cross", desc=' aria-describedby="d-autox"'),
           sw_pat=sw.format(id="set-patterns", label="Colour patterns", desc=' aria-describedby="d-pat"'),
           sw_motion=sw.format(id="set-motion", label="Reduce motion", desc=' aria-describedby="d-motion"'),
           where="in this browser" if variant != "crazygames" else "with your CrazyGames account when you are logged in, otherwise in this browser",
           cfg=json.dumps(cfg, separators=(",", ":")).replace("</", "<\\/"))


def page_site(levels):
    title = "Lantern Logic — 600 free Queens-style puzzle levels"
    desc = ("Play all 600 Lantern Logic levels free in your browser: Queens-style logic puzzles from 5×5 to 11×11 "
            "with stars, hints and a short tutorial. No download, no ads.")
    cfg = config(levels, site.BASE + "levels/data/", True, site.URL + "levels/")
    ld = {"@context": "https://schema.org", "@type": "VideoGame", "@id": site.URL + "levels/#game",
          "name": "Lantern Logic: Queens Puzzle — 600 levels", "url": site.URL + "levels/",
          "description": desc, "genre": ["Puzzle", "Logic puzzle"], "gamePlatform": ["Web browser"],
          "applicationCategory": "Game", "playMode": "SinglePlayer", "inLanguage": "en",
          "image": site.URL + "assets/og.png", "isAccessibleForFree": True,
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}
    extra = '<link rel="stylesheet" href="%sassets/levels.css?v=%s">\n' % (site.BASE, cfg["v"])
    scripts = "".join('<script src="%sassets/%s?v=%s" defer></script>\n' % (site.BASE, s, cfg["v"])
                      for s in ("puzzle.js", "board.js", "levels.js"))
    footer = site.site_footer(scripts=False).replace("</body>", scripts + "</body>")
    header = site.site_header("levels").replace("</svg>\n<header", "</svg>\n" + EXTRA_ICONS + "\n<header", 1)
    return site.head(title, desc, site.BASE + "levels/", extra=extra, jsonld=ld) + header + body("site", cfg) + footer


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", help="the app's data/levels.json")
    args = ap.parse_args()
    if args.source:
        write_packs(load_source(args.source))
    levels = read_packs()
    site.write(os.path.join(LEVELS_DIR, "index.html"), page_site(levels))
    print("levels page: %d levels in %d packs (v=%s)" % (len(levels), (len(levels) + PER_PACK - 1) // PER_PACK,
                                                         content_version(levels)))


if __name__ == "__main__":
    main()
