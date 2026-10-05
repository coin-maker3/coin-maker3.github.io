#!/usr/bin/env python3
"""Generate the Lantern Logic web pages and daily puzzle data.

Run from anywhere; paths are resolved relative to this file. Python 3.8+,
standard library only (plus the `openssl` CLI when reading the encrypted
bundle). Idempotent: the output depends only on the puzzle data and the date.

Puzzle source (first that applies):
  --source PATH            the app's data/daily.json (plain JSON)
  tools/daily.enc          AES-256 bundle of the same data, decrypted with the
                           LANTERN_DAILY_KEY environment variable (GitHub
                           Actions secret). The public repo never contains the
                           plain future puzzles.

Publishing window (T = today's public number in UTC):
  daily/data/N.json        N = 1 .. T+1 (tomorrow is needed by visitors east
                           of UTC). Anything later is deleted if present.
  daily/N/index.html       archive pages N = 1 .. T
  index.html               landing page with puzzle T embedded
  daily/index.html, how-to-play/, privacy/  static pages
  ../sitemap.xml           merged: lantern-logic URLs up to T, others kept
  ../robots.txt            created or given a Sitemap line

Usage:
  python3 tools/build.py [--source daily.json] [--today YYYY-MM-DD]
  python3 tools/build.py --encrypt daily.json   # (re)create tools/daily.enc
"""

import argparse
import datetime as dt
import html
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)                      # .../lantern-logic
SITE_ROOT = os.path.dirname(WEB)                 # repository root
BUNDLE = os.path.join(HERE, "daily.enc")
ORIGIN = "https://coin-maker3.github.io"
BASE = "/lantern-logic/"
URL = ORIGIN + BASE
EPOCH = dt.date(2026, 10, 1)
DAILY_COUNT = 730
STATIC_LASTMOD = "2026-10-05"   # bump when how-to-play / privacy / play change
ASSET_VERSION = "2"             # bump to bust caches of css/js
OPENSSL = ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-md", "sha256"]

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
REGION_COLORS = ["#b37c00", "#438cb6", "#007b5a", "#bbb233", "#00598b", "#a64900",
                 "#9f5e82", "#7d7d7d", "#6d538a", "#815c17", "#509781"]


# ---------------------------------------------------------------- data

def load_puzzles(source):
    if source:
        with open(source, encoding="utf-8") as f:
            raw = json.load(f)
    else:
        if not os.environ.get("LANTERN_DAILY_KEY"):
            sys.exit("build.py: pass --source data/daily.json or set LANTERN_DAILY_KEY to read tools/daily.enc")
        out = subprocess.run(OPENSSL + ["-d", "-in", BUNDLE, "-pass", "env:LANTERN_DAILY_KEY"],
                             check=True, capture_output=True)
        raw = json.loads(out.stdout.decode("utf-8"))
    if raw.get("epoch") != EPOCH.isoformat():
        sys.exit("build.py: unexpected epoch %r" % raw.get("epoch"))
    puzzles = raw["puzzles"]
    if len(puzzles) != DAILY_COUNT:
        sys.exit("build.py: expected %d puzzles, got %d" % (DAILY_COUNT, len(puzzles)))
    return puzzles


def encrypt(source):
    if not os.environ.get("LANTERN_DAILY_KEY"):
        sys.exit("set LANTERN_DAILY_KEY first")
    with open(source, encoding="utf-8") as f:
        raw = json.load(f)
    slim = {"epoch": raw["epoch"], "puzzles": [
        {"id": p["id"], "n": p["n"], "regions": p["regions"], "solution": p["solution"], "tier": p["tier"]}
        for p in raw["puzzles"]]}
    subprocess.run(OPENSSL + ["-salt", "-out", BUNDLE, "-pass", "env:LANTERN_DAILY_KEY"],
                   input=json.dumps(slim, separators=(",", ":")).encode("utf-8"), check=True)
    print("wrote", BUNDLE)


def date_for(number):
    return EPOCH + dt.timedelta(days=number - 1)


def number_for(day):
    return max(1, (day - EPOCH).days + 1)


def puzzle_record(puzzles, number):
    p = puzzles[(number - 1) % DAILY_COUNT]
    return {"number": number, "date": date_for(number).isoformat(), "index": (number - 1) % DAILY_COUNT,
            "n": p["n"], "regions": p["regions"], "solution": p["solution"], "tier": p["tier"]}


# ---------------------------------------------------------------- html bits

def esc(s):
    return html.escape(str(s), quote=True)


def long_date(d):
    return "%s %d %s %d" % (WEEKDAYS[d.weekday()], d.day, MONTHS[d.month - 1], d.year)


def short_date(d):
    return "%s %d %s" % (WEEKDAYS[d.weekday()][:3], d.day, MONTHS[d.month - 1][:3])


ICONS = """<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<symbol id="i-lantern" viewBox="0 0 40 40"><path d="M16.2 10a3.8 3.8 0 0 1 7.6 0" fill="none" stroke="#4a2814" stroke-width="1.8"/><rect x="14" y="8.8" width="12" height="3" rx="1" fill="#5a3219"/><rect x="14" y="28.2" width="12" height="3" rx="1" fill="#5a3219"/><ellipse cx="20" cy="20" rx="10.2" ry="9.4" style="fill:var(--body,#ffc45c)" stroke="#963f14" stroke-width="1.3"/><path d="M16.4 11.6c-2.6 5-2.6 11.8 0 16.8M23.6 11.6c2.6 5 2.6 11.8 0 16.8" fill="none" style="stroke:var(--rib,#db8232)" stroke-width="0.9"/><circle cx="20" cy="20" r="3.1" fill="#fff7d6"/></symbol>
<symbol id="i-mark" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></symbol>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></symbol>
<symbol id="i-restart" viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8.2"/><path d="M3.5 3.5v4.7h4.7"/></symbol>
<symbol id="i-hint" viewBox="0 0 24 24"><path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2V16h5v-.2c0-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></symbol>
<symbol id="i-share" viewBox="0 0 24 24"><path d="M12 15V3.5"/><path d="M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17l-5.38 2.85 1.03-6L3.3 9.6l6-.9z"/></symbol>
<symbol id="i-left" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>
<symbol id="i-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M7.5 4.8v14.4L19 12z"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
</svg>"""


def ico(name, cls="ico"):
    return '<svg class="%s" aria-hidden="true" focusable="false"><use href="#i-%s"/></svg>' % (cls, name)


def head(title, desc, path, extra="", og_type="website", jsonld=None, noindex=False):
    canonical = ORIGIN + path
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">%s</script>\n' % json.dumps(jsonld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#261634">
<meta name="color-scheme" content="dark">
{robots}<link rel="icon" href="{base}assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="{base}assets/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="{base}assets/apple-touch-icon.png">
<link rel="preload" href="{base}assets/fraunces-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{base}assets/site.css?v={v}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Lantern Logic">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{url}assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Lantern Logic: a coloured puzzle grid with glowing paper lanterns on a night sky">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{url}assets/og.png">
{extra}{ld}</head>
""".format(title=esc(title), desc=esc(desc), canonical=esc(canonical), base=BASE, url=URL, v=ASSET_VERSION,
           og_type=og_type, extra=extra, ld=ld,
           robots='<meta name="robots" content="noindex">\n' if noindex else "")


def site_header(current):
    links = [("how-to-play/", "Rules", "rules", ""), ("daily/", "Archive", "archive", "wide"), ("levels/", "Levels", "levels", "")]
    nav = "".join('<a href="%s%s"%s%s>%s</a>' % (BASE, href, ' class="%s"' % cls if cls else "",
                                                 ' aria-current="page"' if key == current else "", label)
                  for href, label, key, cls in links)
    return """<body>
<a class="skip" href="#main">Skip to content</a>
{icons}
<header class="site-head">
<a class="brand" href="{base}"{cur}><svg aria-hidden="true" focusable="false"><use href="#i-lantern"/></svg>Lantern Logic</a>
<nav class="nav" aria-label="Main">{nav}</nav>
</header>
""".format(icons=ICONS, base=BASE, nav=nav, cur=' aria-current="page"' if current == "home" else "")


def site_footer(scripts=True):
    js = ""
    if scripts:
        js = ('<script src="{b}assets/puzzle.js?v={v}" defer></script>\n'
              '<script src="{b}assets/app.js?v={v}" defer></script>\n').format(b=BASE, v=ASSET_VERSION)
    return """<footer class="site-foot">
<div class="inner">
<nav aria-label="Footer">
<a href="{b}">Today's puzzle</a><a href="{b}daily/">Puzzle archive</a><a href="{b}levels/">600 levels</a><a href="{b}how-to-play/">How to play</a><a href="{b}play/">App version (38 MB)</a><a href="{b}privacy/">Privacy</a>
</nav>
<p>Lantern Logic: Queens Puzzle. Free, no ads, no tracking. Coming soon on Google Play.</p>
<p>Fonts: Fraunces (SIL Open Font License), self-hosted.</p>
</div>
</footer>
{js}</body>
</html>
""".format(b=BASE, js=js)


def game_section(rec, mode, prev_link="", next_link=""):
    """The playable board. JS fills the board; the rest is real HTML."""
    d = dt.date.fromisoformat(rec["date"])
    n = rec["n"]
    data = json.dumps({k: rec[k] for k in ("number", "date", "n", "regions", "solution")}, separators=(",", ":"))
    pager = ""
    if mode == "archive":
        pager = '<nav class="pager" aria-label="Other daily puzzles">%s<a class="pager-mid" href="%s">%sToday\'s puzzle</a>%s</nav>' % (
            prev_link, BASE, ico("calendar"), next_link)
    return """<section class="play" id="play" data-mode="{mode}" aria-labelledby="puzzle-title">
<div class="play-head">
<div><h1 id="puzzle-title">Daily #{num}</h1><p class="puzzle-meta" id="puzzle-meta">{when} · {n}×{n}</p></div>
<div class="timer" role="timer" aria-label="Time taken">{clock}<span id="timer">0:00</span></div>
</div>
<div class="board-wrap"><div class="board" id="board" role="grid" aria-label="Puzzle board, {n} by {n}" style="--n:{n}"></div></div>
<noscript><div class="noscript"><p>The puzzle board needs JavaScript. You can still read <a href="{b}how-to-play/">how to play</a>.</p></div></noscript>
<div class="unavailable" id="unavailable" hidden><p><strong>Today's puzzle isn't published yet.</strong></p><p>New puzzles appear just after midnight UTC. Check the date on your device, or play the latest one.</p><a class="btn btn-primary" id="unavailable-link" href="{b}">Play the latest puzzle</a></div>
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
<p class="win-detail" id="win-streak" hidden></p>
<p class="share-preview" id="share-preview"></p>
<div class="win-actions">
<button class="btn btn-primary" type="button" id="btn-share">{share}<span>Share result</span></button>
<button class="btn btn-ghost" type="button" id="btn-again">{restart}<span>Play again</span></button>
</div>
<p class="share-msg" id="share-msg" role="status" aria-live="polite"></p>
<p class="win-next" id="win-next"></p>
</div>
<dl class="stats" id="stats">
<div><dt>Day streak</dt><dd id="stat-streak">0</dd></div>
<div><dt>Best streak</dt><dd id="stat-best-streak">0</dd></div>
<div><dt>Solved</dt><dd id="stat-solved">0</dd></div>
<div><dt id="stat-best-label">Best {n}×{n}</dt><dd id="stat-best">–</dd></div>
</dl>
{pager}
</section>
<script type="application/json" id="puzzle-data">{data}</script>
""".format(mode=mode, num=rec["number"], when=esc(long_date(d)), n=n, b=BASE, data=data, pager=pager,
           clock=ico("clock"), undo=ico("undo"), restart=ico("restart"), hint=ico("hint"), share=ico("share"))


def recent_list_sized(puzzles, numbers):
    items = []
    for num in numbers:
        d = date_for(num)
        n = puzzles[(num - 1) % DAILY_COUNT]["n"]
        items.append('<li><a href="{b}daily/{num}/" data-solved-check="{num}" aria-label="Daily #{num}, {lw}, {n} by {n}">'
                     '<span class="num">#{num}</span><span class="when">{when}</span>'
                     '<span class="size"><span class="solved-badge" hidden></span> {n}×{n}</span></a></li>'
                     .format(b=BASE, num=num, when=esc(short_date(d)), lw=esc(long_date(d)), n=n))
    return '<ul class="recent">%s</ul>' % "".join(items)


def jsonld_site():
    return {"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "@id": URL + "#website", "name": "Lantern Logic", "url": URL,
         "description": "A free daily Queens-style logic puzzle you can play in the browser.", "inLanguage": "en"},
        {"@type": "VideoGame", "@id": URL + "#game", "name": "Lantern Logic: Queens Puzzle", "url": URL,
         "description": "A calm region-logic puzzle: place one lantern in every row, column and colour region, "
                        "and no two lanterns may touch, not even diagonally. A new daily puzzle every day, 600 levels in the full game.",
         "genre": ["Puzzle", "Logic puzzle"], "gamePlatform": ["Web browser", "Android"],
         "applicationCategory": "Game", "playMode": "SinglePlayer", "inLanguage": "en",
         "image": URL + "assets/og.png", "isAccessibleForFree": True,
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
         "publisher": {"@type": "Organization", "name": "Lantern Logic"}}]}


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = f.read()
    if old != text:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)


# ---------------------------------------------------------------- pages

def page_home(puzzles, today_num):
    rec = puzzle_record(puzzles, today_num)
    title = "Lantern Logic — free daily Queens-style logic puzzle"
    desc = ("Play today's Lantern Logic puzzle free in your browser: place one lantern in every row, column and "
            "colour region, with no two touching. A new Queens-style daily logic puzzle every day.")
    recent = list(range(today_num, max(0, today_num - 7), -1))
    body = """<main id="main">
{game}
<div class="content">
<div class="split">
<section class="prose" aria-labelledby="about">
<h2 id="about">A calm logic puzzle, new every day</h2>
<p class="lead">Lantern Logic is a free daily logic puzzle in the Queens style. Every board is a square grid split into coloured regions; light exactly one lantern in every row, every column and every colour, and keep the lanterns apart, so no two touch, not even at the corners.</p>
<p>Each puzzle has exactly one solution and never needs a guess. Start with the smallest regions, cross out every cell a lantern rules out, and the board slowly lights up. Most days take a few minutes over a cup of tea.</p>
<p>If you know <strong>Star Battle</strong> with one star per row, the rules will feel familiar. New to it? <a href="{b}how-to-play/">Read the rules with pictures</a>, then come back to today's board.</p>
<h2>Same puzzle everywhere, every day</h2>
<p>The daily puzzle changes at midnight in your own time zone, and everyone on the same calendar date plays the same numbered board, in the browser or in the app. Finish it, then share your time and stars without spoiling the solution.</p>
</section>
<section aria-labelledby="recent">
<h2 id="recent">Recent puzzles</h2>
{recent}
<p style="margin-top:12px"><a href="{b}daily/">All daily puzzles</a></p>
</section>
</div>
<section class="app-card" style="margin-top:48px" aria-labelledby="full">
<h2 id="full">Want more than one a day?</h2>
<p class="soon">Play all 600 levels free in your browser, from gentle 5×5 boards to tricky 11×11 ones, with stars, hints and the same rules as the app. It opens in a moment and has no ads.</p>
<div class="row-btns"><a class="btn btn-primary" href="{b}levels/">{play}<span>Play the full game</span></a><span class="soon">Prefer the app build? <a href="{b}play/">Play the app version</a> (about a 38 MB download).</span></div>
<p class="soon">Coming soon on Google Play.</p>
</section>
<section class="faq" style="margin-top:48px" aria-labelledby="faq">
<h2 id="faq">Questions</h2>
<div><h3>Is this the Queens puzzle?</h3><p>It uses the same rules as Queens-style puzzles: one piece per row, column and colour region, and pieces may not touch. Here the pieces are lanterns. Lantern Logic is an independent game and is not affiliated with any other puzzle publisher.</p></div>
<div><h3>Do I ever need to guess?</h3><p>No. Every board has exactly one solution and can be solved step by step with logic. Stuck? The hint button shows the next forced move and explains why (three free hints a day).</p></div>
<div><h3>How do the controls work?</h3><p>Tap a cell once for a cross, twice for a lantern, three times to clear it. Drag across cells to cross out several at once. With a keyboard, use the arrow keys and press Space or Enter.</p></div>
<div><h3>Can I play older puzzles?</h3><p>Yes. Every past daily puzzle stays in the <a href="{b}daily/">archive</a>. Only puzzles solved on their own day count towards your streak.</p></div>
<div><h3>Do you track me?</h3><p>No cookies, no analytics, no ads. Your streak and best times stay in your own browser. See the <a href="{b}privacy/">privacy policy</a>.</p></div>
</section>
</div>
</main>
""".format(game=game_section(rec, "today"), b=BASE, recent=recent_list_sized(puzzles, recent), play=ico("play"))
    return head(title, desc, BASE, jsonld=jsonld_site()) + site_header("home") + body + site_footer()


def page_daily(puzzles, num, today_num):
    rec = puzzle_record(puzzles, num)
    d = date_for(num)
    n = rec["n"]
    title = "Lantern Logic Daily #%d — free Queens-style logic puzzle" % num
    desc = ("Play Lantern Logic Daily #%d (%s), a %d×%d Queens-style logic puzzle: one lantern in every row, "
            "column and colour region, none touching. Free, in your browser, no download." % (num, long_date(d), n, n))
    path = "%sdaily/%d/" % (BASE, num)
    prev_link = next_link = ""
    links = ""
    if num > 1:
        prev_link = '<a href="%sdaily/%d/" rel="prev">%s#%d</a>' % (BASE, num - 1, ico("left"), num - 1)
        links += '<link rel="prev" href="%sdaily/%d/">\n' % (URL, num - 1)
    if num < today_num:
        next_link = '<a href="%sdaily/%d/" rel="next">#%d%s</a>' % (BASE, num + 1, num + 1, ico("right"))
        links += '<link rel="next" href="%sdaily/%d/">\n' % (URL, num + 1)
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Lantern Logic", "item": URL},
        {"@type": "ListItem", "position": 2, "name": "Daily archive", "item": URL + "daily/"},
        {"@type": "ListItem", "position": 3, "name": "Daily #%d" % num, "item": ORIGIN + path}]}
    body = """<main id="main">
{game}
<div class="content">
<section class="prose" aria-labelledby="rules">
<h2 id="rules">How to solve Daily #{num}</h2>
<p>Light one lantern in each of the {n} rows, each of the {n} columns and each of the {n} coloured regions. Lanterns may not touch each other, not even diagonally. There is exactly one solution, and you can reach it without guessing.</p>
<p>Tap once to cross a cell out, twice for a lantern. Drag to cross out many cells. <a href="{b}how-to-play/">Full rules and tips</a>.</p>
<p>This was the daily puzzle for {when}. Solving it here keeps your best time; only the puzzle of the day counts towards your streak. <a href="{b}">Play today's puzzle</a>.</p>
</section>
</div>
</main>
""".format(game=game_section(rec, "archive", prev_link, next_link), num=num, n=n, b=BASE, when=esc(long_date(d)))
    return head(title, desc, path, extra=links, jsonld=ld) + site_header("archive") + body + site_footer()


def page_archive(puzzles, today_num):
    title = "Daily puzzle archive — Lantern Logic"
    desc = ("Every Lantern Logic daily puzzle so far, from #1 to #%d. Free Queens-style logic puzzles to play in "
            "your browser, one for each day." % today_num)
    by_month = {}
    for num in range(today_num, 0, -1):
        d = date_for(num)
        by_month.setdefault((d.year, d.month), []).append(num)
    sections = []
    for (y, m), nums in by_month.items():
        sections.append('<section class="month" aria-labelledby="m-%d-%d"><h2 id="m-%d-%d">%s %d</h2>%s</section>' % (
            y, m, y, m, MONTHS[m - 1], y, recent_list_sized(puzzles, nums)))
    body = """<main id="main" class="page">
<h1>Daily puzzle archive</h1>
<div class="prose"><p>One new puzzle every day since 1 October 2026. Pick any day to play it; your solved puzzles show their best time. Today's puzzle is on the <a href="{b}">home page</a>.</p></div>
{sections}
</main>
""".format(b=BASE, sections="\n".join(sections))
    return head(title, desc, BASE + "daily/") + site_header("archive") + body + site_footer()


def mini_board(regions, lanterns=(), marks=(), rings=(), label=""):
    """Small inline-SVG board for the rules page. rings: (r, c, 'ok'|'no')."""
    h, w = len(regions), len(regions[0])
    parts = ['<svg class="mini" viewBox="-0.08 -0.08 %s %s" role="img" aria-label="%s">' % (w + 0.16, h + 0.16, esc(label))]
    for r in range(h):
        for c in range(w):
            parts.append('<rect x="%d" y="%d" width="1.01" height="1.01" fill="%s"/>' % (c, r, REGION_COLORS[regions[r][c]]))
    thin, thick = [], []
    for r in range(h):
        for c in range(w):
            if c + 1 < w:
                (thick if regions[r][c + 1] != regions[r][c] else thin).append("M%d %dV%d" % (c + 1, r, r + 1))
            if r + 1 < h:
                (thick if regions[r + 1][c] != regions[r][c] else thin).append("M%d %dH%d" % (c, r + 1, c + 1))
    parts.append('<path d="%s" stroke="#120c1a" stroke-width="0.04" fill="none"/>' % "".join(thin))
    parts.append('<path d="%s" stroke="#120c1a" stroke-width="0.12" stroke-linecap="square" fill="none"/>' % "".join(thick))
    parts.append('<rect x="0" y="0" width="%d" height="%d" stroke="#120c1a" stroke-width="0.14" fill="none"/>' % (w, h))
    for (r, c) in marks:
        parts.append('<path d="M%.2f %.2fl.36 .36m0 -.36l-.36 .36" stroke="rgba(30,16,40,.8)" stroke-width="0.09" stroke-linecap="round"/>' % (c + 0.32, r + 0.32))
    for (r, c) in lanterns:
        parts.append('<use href="#i-lantern" x="%.2f" y="%.2f" width=".84" height=".84"/>' % (c + 0.08, r + 0.08))
    for (r, c, kind) in rings:
        parts.append('<rect class="%s" x="%.2f" y="%.2f" width=".88" height=".88" rx=".12"/>' % (kind, c + 0.06, r + 0.06))
    parts.append("</svg>")
    return "".join(parts)


def page_rules():
    title = "How to play Lantern Logic — rules of the Queens-style puzzle"
    desc = ("Learn the rules of Lantern Logic, a Queens-style logic puzzle: one lantern per row, column and colour "
            "region, and lanterns never touch, even diagonally. Controls, hints and solving tips with pictures.")
    # small example boards
    ex = [[0, 0, 1, 1], [0, 2, 2, 1], [3, 3, 2, 1], [3, 2, 2, 1]]
    full = mini_board(ex, [(0, 1), (1, 3), (2, 0), (3, 2)],
                      label="A solved 4 by 4 board: one lantern in each row, column and colour, none touching")
    rowcol = mini_board(ex, [(1, 3)], marks=[(1, 0), (1, 1), (1, 2), (0, 3), (2, 3), (3, 3), (0, 2), (2, 2)],
                        label="A lantern rules out its row, its column, its neighbours and the rest of its colour")
    touch = mini_board([[0, 0, 1], [2, 4, 1], [2, 3, 3]], [(1, 1), (0, 0)], rings=[(0, 0, "no"), (1, 1, "no")],
                       label="Two lanterns touching diagonally break the rule")
    cycle = mini_board([[1, 1, 1]], [(0, 2)], marks=[(0, 1)],
                       label="Tap cycle: an empty cell, a crossed-out cell, a lantern")
    region = mini_board(ex, rings=[(2, 0, "ok"), (2, 1, "ok"), (3, 0, "ok")],
                        label="The small region in the corner has only three cells, so start there")
    confine = mini_board([[0, 0, 0, 1], [2, 2, 3, 1], [2, 3, 3, 1], [2, 2, 3, 3]],
                         marks=[(0, 3)], rings=[(0, 0, "ok"), (0, 1, "ok"), (0, 2, "ok")],
                         label="The orange region lies in the top row, so the last cell of that row is crossed out")
    body = """<main id="main" class="page">
<h1>How to play</h1>
<div class="prose">
<p class="lead">Lantern Logic is a Queens-style logic puzzle. The board is a square grid of N×N cells split into N coloured regions. Your job is to light N lanterns.</p>
<h2>The rules</h2>
</div>
<div class="prose" style="margin-top:14px">
<div class="figure">{full}<p><strong>One per row, column and colour</strong>Every row, every column and every coloured region holds exactly one lantern.</p></div>
<div class="figure">{touch}<p><strong>Lanterns never touch</strong>No two lanterns may be neighbours, and that includes the four diagonal neighbours. Lanterns that break a rule glow red.</p></div>
<div class="figure">{rowcol}<p><strong>Every lantern rules cells out</strong>A lantern clears the rest of its row and column, every cell around it, and the rest of its colour. With auto-cross on, these crosses appear for you.</p></div>
<p>Each puzzle has exactly one solution and can be solved by logic alone, without guessing.</p>
<h2>Controls</h2>
<div class="figure">{cycle}<p><strong>Tap to cycle</strong>Tap a cell once for a cross (a note that no lantern goes there), twice for a lantern, and a third time to clear it.</p></div>
<ul>
<li><strong>Drag</strong> across empty cells to cross them all out in one go.</li>
<li><strong>Undo</strong> steps back one move (Ctrl+Z or ⌘Z on a keyboard). <strong>Restart</strong> clears the board, and can be undone too.</li>
<li><strong>Hint</strong> makes the next logically forced move and tells you why. You get three free hints a day.</li>
<li><strong>Keyboard:</strong> move between cells with the arrow keys and press Space or Enter to cycle a cell.</li>
<li><strong>Colour patterns</strong> add a small shape to each region, so the board never relies on colour alone.</li>
</ul>
<h2>Scoring</h2>
<p>Three stars for a solve with no hints and no mistakes (a mistake is placing a lantern that breaks a rule). Two stars for at most one hint and three mistakes. One star for any solve. Your time and stars make the share text, for example “Lantern Logic Daily #12 — 7×7 in 2:41 ✨✨✨”.</p>
<h2>Solving tips</h2>
<div class="figure">{region}<p><strong>Small regions first</strong>A region with only a few free cells is the best place to start. When one cell of a row, column or colour is left, the lantern must go there.</p></div>
<div class="figure">{confine}<p><strong>Regions trapped in one line</strong>If every free cell of a colour lies in one row, that colour's lantern will use that row, so every other cell of the row can be crossed out. The same works for columns.</p></div>
<p><strong>Count lines.</strong> If two colours fit only inside the same two rows, those two rows belong to them, and every other colour can be crossed out of those rows.</p>
<p><strong>Try a lantern in your head.</strong> If a lantern on a cell would leave some row, column or colour with no space at all, that cell must be a cross.</p>
<h2>Where does the puzzle come from?</h2>
<p>The same family of puzzles is known as Queens puzzles and as one-star <strong>Star Battle</strong>. Lantern Logic has its own boards: every one is checked by a solver for a single solution and by a logic rater to make sure no guessing is needed.</p>
<p><a class="btn btn-primary" href="{b}" style="margin-top:8px">{play}<span>Play today's puzzle</span></a></p>
</div>
</main>
""".format(full=full, touch=touch, rowcol=rowcol, cycle=cycle, region=region, confine=confine, b=BASE, play=ico("play"))
    return head(title, desc, BASE + "how-to-play/", jsonld=jsonld_site()) + site_header("rules") + body + site_footer(scripts=False)


def page_privacy():
    title = "Privacy policy — Lantern Logic"
    desc = "Lantern Logic collects no personal data: no cookies, no analytics, no ads. Progress stays on your device, on the web and in the app."
    body = """<main id="main" class="page">
<h1>Privacy policy</h1>
<div class="prose">
<p><em>Last updated: 5 October 2026</em></p>
<p>This policy covers both the Lantern Logic website (this site, including the daily puzzle, the 600 levels and the app version in the browser) and the Android app <strong>Lantern Logic: Queens Puzzle</strong>.</p>
<h2>What we collect</h2>
<p><strong>Nothing.</strong> Neither the website nor the app collects, transmits, sells or shares any personal data or usage data. There are no accounts, no analytics, no tracking, no advertising and no third-party scripts, fonts or embeds.</p>
<h2>The website</h2>
<ul>
<li><strong>No cookies.</strong> The site sets no cookies of any kind.</li>
<li><strong>Local storage only.</strong> To remember your streak, best times, an unfinished board, today's remaining hints and your settings (auto-cross, colour patterns), the page saves a small record in your browser's local storage. It never leaves your device and is never sent to us. Clear it at any time by clearing this site's data in your browser. In private browsing, it disappears when you close the window.</li>
<li><strong>The 600 levels</strong> keep their progress in the same local record: stars and best times per level, an unfinished level, whether you finished the tutorial, and the same three daily hints as the daily puzzle.</li>
<li><strong>The app version in the browser</strong> stores its progress in your browser's storage in the same way.</li>
<li><strong>Hosting.</strong> The site is hosted on GitHub Pages. Like any web host, GitHub may record technical data such as IP addresses in server logs for security and operation; see GitHub's own privacy statement. We have no access to those logs and add nothing to them.</li>
</ul>
<h2>The app</h2>
<p>The app works fully offline and makes no network requests. To remember your progress it saves a small file on your device (level stars and times, daily results and streak, remaining hints and your settings). This file never leaves your device. Delete it with <strong>Settings → Reset progress</strong> or by uninstalling the app.</p>
<p>The Android app requests only the vibration permission, for optional haptic feedback that you can turn off in Settings.</p>
<h2>Sharing your result</h2>
<p>When you press <strong>Share</strong> after a daily puzzle, a short text such as “Lantern Logic Daily #12 — 7×7 in 2:41 ✨✨✨” (plus a link to the puzzle on the website) is passed to your device's share sheet or copied to your clipboard. Nothing is sent anywhere unless you choose to paste or share it.</p>
<h2>Advertising</h2>
<p>Neither the website nor the current app shows ads. If that ever changes, this policy and the store listing will be updated first.</p>
<p>Lantern Logic may also be offered on third-party web game portals. A copy played on a portal runs inside that portal's page, which may show ads and keep your progress in your portal account; the portal's own privacy policy applies there. The website you are reading has no ads and no portal code.</p>
<h2>Children</h2>
<p>Lantern Logic is suitable for all ages and collects no data from anyone, including children.</p>
<h2>Changes and contact</h2>
<p>Changes to this policy are published on this page with a new date. For questions, open an issue on the website's public repository, <a href="https://github.com/coin-maker3/coin-maker3.github.io/issues">coin-maker3/coin-maker3.github.io</a>.</p>
</div>
</main>
"""
    return head(title, desc, BASE + "privacy/") + site_header("") + body + site_footer(scripts=False)


# ---------------------------------------------------------------- sitemap / robots

def merge_sitemap(today_num):
    path = os.path.join(SITE_ROOT, "sitemap.xml")
    keep = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for block in re.findall(r"<url>.*?</url>", text, flags=re.S):
            loc = re.search(r"<loc>\s*(.*?)\s*</loc>", block, flags=re.S)
            if loc and not loc.group(1).startswith(URL):
                keep.append(block.strip())
    today = date_for(today_num).isoformat()
    entries = [(URL, today, "daily", "1.0"),
               (URL + "how-to-play/", STATIC_LASTMOD, "monthly", "0.8"),
               (URL + "daily/", today, "daily", "0.7"),
               (URL + "levels/", STATIC_LASTMOD, "weekly", "0.9"),
               (URL + "play/", STATIC_LASTMOD, "monthly", "0.5"),
               (URL + "privacy/", STATIC_LASTMOD, "yearly", "0.3")]
    for num in range(today_num, 0, -1):
        entries.append((URL + "daily/%d/" % num, date_for(num).isoformat(), "yearly", "0.5"))
    urls = keep + ["<url><loc>%s</loc><lastmod>%s</lastmod><changefreq>%s</changefreq><priority>%s</priority></url>" % e
                   for e in entries]
    out = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % "\n".join(urls))
    write(path, out)


def ensure_robots():
    path = os.path.join(SITE_ROOT, "robots.txt")
    line = "Sitemap: %s/sitemap.xml" % ORIGIN
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        if line not in text:
            write(path, text.rstrip("\n") + "\n\n" + line + "\n")
    else:
        write(path, "User-agent: *\nAllow: /\n\n" + line + "\n")


# ---------------------------------------------------------------- main

def build(puzzles, today):
    if today < EPOCH:
        sys.exit("build.py: today (%s) is before the first daily puzzle" % today)
    today_num = number_for(today)
    last_data = today_num + 1

    data_dir = os.path.join(WEB, "daily", "data")
    os.makedirs(data_dir, exist_ok=True)
    for num in range(1, last_data + 1):
        write(os.path.join(data_dir, "%d.json" % num),
              json.dumps(puzzle_record(puzzles, num), separators=(",", ":")) + "\n")
    # never publish later days: remove anything beyond the window
    for name in os.listdir(data_dir):
        m = re.fullmatch(r"(\d+)\.json", name)
        if not m or int(m.group(1)) > last_data:
            os.remove(os.path.join(data_dir, name))
    daily_dir = os.path.join(WEB, "daily")
    for name in os.listdir(daily_dir):
        if re.fullmatch(r"\d+", name) and int(name) > today_num:
            shutil.rmtree(os.path.join(daily_dir, name))

    for num in range(1, today_num + 1):
        write(os.path.join(daily_dir, str(num), "index.html"), page_daily(puzzles, num, today_num))
    write(os.path.join(daily_dir, "index.html"), page_archive(puzzles, today_num))
    write(os.path.join(WEB, "index.html"), page_home(puzzles, today_num))
    write(os.path.join(WEB, "how-to-play", "index.html"), page_rules())
    write(os.path.join(WEB, "privacy", "index.html"), page_privacy())
    merge_sitemap(today_num)
    ensure_robots()
    print("built daily #1..#%d (data to #%d) for %s" % (today_num, last_data, today.isoformat()))
    return today_num


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", help="plain daily.json from the app repo")
    ap.add_argument("--today", help="override UTC today (YYYY-MM-DD)")
    ap.add_argument("--encrypt", metavar="DAILY_JSON", help="write tools/daily.enc from this file and exit")
    args = ap.parse_args()
    if args.encrypt:
        encrypt(args.encrypt)
        return
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(dt.timezone.utc).date()
    build(load_puzzles(args.source), today)


if __name__ == "__main__":
    main()
