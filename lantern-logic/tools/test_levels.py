#!/usr/bin/env python3
"""Verify the published campaign data, the levels page and the portal packages.

  python3 tools/test_levels.py [--source ../lantern-logic/data/levels.json]

Checks (exit status 1 on any failure):
  1. every level in levels/data/pK.json passes the daily checker of
     test_daily.py: format, N connected regions, stored solution obeys every
     rule, an independent exact solver finds exactly one solution equal to it
  2. 600 levels in 20 packs of 30, kinds as in the app (every 10th a bonus,
     every other 5th a breather)
  3. with --source: every level equals the app's data/levels.json entry
  4. the JS rules engine (assets/puzzle.js, in Node) solves every level from an
     empty board by applying hint() only, and the result is the stored solution
  5. the website's levels page loads no portal SDK and no ad code, and its
     first load (HTML, CSS, JS, font; level data excluded) stays under 120 KB
  6. the portal zips: index.html at the root, relative paths only, the
     CrazyGames build loads SDK v3 and the adapter, the itch build loads neither
"""

import argparse
import json
import os
import re
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import test_daily as td  # noqa: E402  (check_puzzle and the shared failure list)

WEB = os.path.dirname(HERE)
DATA = os.path.join(WEB, "levels", "data")
PORTAL = os.path.join(WEB, "portal")
check = td.check

JS_SOLVE = r"""
const P = require(process.argv[1]);
const packs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const bad = [];
let steps = 0;
for (const lv of packs) {
  const n = Math.round(Math.sqrt(lv[0].length));
  const p = new P(n, lv[0], lv[1]);
  let k = 0, h;
  while ((h = p.hint()) && k < 4 * n * n) { p.setCell(h.cell, h.state, true); k++; }
  steps += k;
  const sol = p.lanterns().map((i) => (i % n).toString(36)).join('');
  if (!p.isSolved() || sol !== lv[1]) bad.push(lv[3]);
}
console.log(JSON.stringify({ bad, steps }));
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source")
    args = ap.parse_args()

    levels = []
    k = 1
    while os.path.exists(os.path.join(DATA, "p%d.json" % k)):
        with open(os.path.join(DATA, "p%d.json" % k), encoding="utf-8") as f:
            rec = json.load(f)
        check(rec["pack"] == k and rec["first"] == len(levels) + 1, "pack %d header" % k)
        check(len(rec["levels"]) == 30, "pack %d should hold 30 levels" % k)
        levels.extend(rec["levels"])
        k += 1
    check(len(levels) == 600 and k - 1 == 20, "expected 600 levels in 20 packs, got %d in %d" % (len(levels), k - 1))

    # 1. rules + unique solution (same checker as the daily puzzles)
    for i, (regions, solution, kind) in enumerate(levels, 1):
        n = round(len(regions) ** 0.5)
        td.check_puzzle({"n": n, "regions": regions, "solution": solution}, "level %d" % i)
        want = "b" if i % 10 == 0 else "e" if i % 5 == 0 else "n"
        check(kind == want, "level %d kind %s, expected %s" % (i, kind, want))
    print("checked %d levels: rules and unique solution" % len(levels))

    # 3. equal to the app's data
    if args.source:
        with open(args.source, encoding="utf-8") as f:
            src = json.load(f)["levels"]
        code = {"normal": "n", "easy": "e", "bonus": "b"}
        check(len(src) == len(levels), "source has %d levels" % len(src))
        for a, b in zip(src, levels):
            check([a["regions"], a["solution"], code[a["kind"]]] == b and a["n"] ** 2 == len(b[0]),
                  "level %d differs from the app's levels.json" % a["id"])
        print("compared with", args.source)

    # 4. the JS hint engine solves every level without guessing
    payload = json.dumps([[r, s, kd, i] for i, (r, s, kd) in enumerate(levels, 1)])
    out = subprocess.run(["node", "-e", JS_SOLVE, os.path.join(WEB, "assets", "puzzle.js")],
                         input=payload.encode(), capture_output=True, check=True)
    res = json.loads(out.stdout)
    check(not res["bad"], "puzzle.js hints failed to solve levels %s" % res["bad"][:20])
    print("puzzle.js hint() solved all %d levels (%d hint steps)" % (len(levels), res["steps"]))

    # 5. website page: no portal code, small first load
    with open(os.path.join(WEB, "levels", "index.html"), encoding="utf-8") as f:
        page = f.read()
    for bad in ("crazygames", "sdk.", "adsbygoogle", "gamedistribution", "poki", "requestAd"):
        check(bad not in page.lower(), "levels page mentions %r" % bad)
    for js in ("puzzle.js", "board.js", "levels.js"):
        with open(os.path.join(WEB, "assets", js), encoding="utf-8") as f:
            text = f.read()
        check("sdk.crazygames" not in text and "requestAd" not in text, js + " contains portal code")
    total = len(page.encode("utf-8"))
    for name in re.findall(r'(?:href|src)="/lantern-logic/assets/([\w.-]+\.(?:css|js|woff2))', page):
        total += os.path.getsize(os.path.join(WEB, "assets", name))
    check(total < 120 * 1024, "first load is %d bytes, budget 120 KB" % total)
    print("levels page first load: %d bytes (HTML+CSS+JS+font, uncompressed)" % total)

    # 6. portal zips
    for variant in ("crazygames", "itch"):
        path = os.path.join(PORTAL, "lantern-logic-%s.zip" % variant)
        if not check(os.path.exists(path), path + " missing"):
            continue
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            check("index.html" in names, variant + ": index.html must be at the zip root")
            check(sum(n.startswith("data/p") for n in names) == 20, variant + ": 20 level packs")
            html = z.read("index.html").decode("utf-8")
            check(not re.search(r'(?:href|src)="/', html), variant + ": absolute path in index.html")
            has_sdk = "https://sdk.crazygames.com/crazygames-sdk-v3.js" in html and "assets/crazygames.js" in html
            check(has_sdk == (variant == "crazygames"), variant + ": SDK presence wrong")
            print("%s zip: %d files, %d bytes" % (variant, len(names), os.path.getsize(path)))

    if td.failures:
        print("\n%d FAILURE(S)" % len(td.failures))
        sys.exit(1)
    print("\nall level checks passed")


if __name__ == "__main__":
    main()
