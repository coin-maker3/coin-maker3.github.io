#!/usr/bin/env python3
"""Verify the published daily data and the web port against the app.

  python3 tools/test_daily.py [--source daily.json] [--today YYYY-MM-DD] [--godot-hints gt.json]

Checks (exit status 1 on any failure):
  1. every published daily/data/N.json: format, N connected regions, the stored
     solution obeys every rule (one lantern per row / column / region, no two
     touching incl. diagonally) and an independent exact solver finds exactly
     one solution, equal to the stored one
  2. publishing window: data only up to UTC today + 1, archive pages and
     sitemap entries only up to UTC today
  3. the web's date maths (assets/puzzle.js, run in Node) gives the same index,
     public number and share text as the app's GDScript for the dates in
     tools/app_reference.json (recorded with Godot 4.6.1), and the web puzzle
     for that number is the app's puzzle (sha256 match)
  4. with --source (or LANTERN_DAILY_KEY to read tools/daily.enc): every published file equals the app's daily.json entry
  5. with --godot-hints: hint sequences of the JS port equal GDScript's
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
ROOT = os.path.dirname(WEB)
EPOCH = dt.date(2026, 10, 1)
ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
URL = "https://coin-maker3.github.io/lantern-logic/"

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)
        print("FAIL", msg)
    return cond


def connected(n, regions, g):
    cells = [i for i in range(n * n) if regions[i] == g]
    if not cells:
        return False
    seen, stack = {cells[0]}, [cells[0]]
    while stack:
        i = stack.pop()
        r, c = divmod(i, n)
        for rr, cc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            j = rr * n + cc
            if 0 <= rr < n and 0 <= cc < n and j not in seen and regions[j] == g:
                seen.add(j)
                stack.append(j)
    return len(seen) == len(cells)


def valid_solution(n, regions, sol):
    if sorted(sol) != list(range(n)):          # one per row (by format) and per column
        return False
    if sorted(regions[r * n + sol[r]] for r in range(n)) != list(range(n)):   # one per region
        return False
    for r in range(n - 1):                      # no touching: adjacent rows differ by >= 2 columns
        if abs(sol[r] - sol[r + 1]) <= 1:
            return False
    return True


def solutions(n, regions, limit=2):
    """Independent exact search, column-set + region-set backtracking by row."""
    found = []
    sol = [0] * n

    def rec(r, used_cols, used_regs):
        if r == n:
            found.append(sol[:])
            return len(found) >= limit
        for c in range(n):
            if c in used_cols or regions[r * n + c] in used_regs:
                continue
            if r > 0 and abs(sol[r - 1] - c) <= 1:
                continue
            sol[r] = c
            if rec(r + 1, used_cols | {c}, used_regs | {regions[r * n + c]}):
                return True
        return False

    rec(0, frozenset(), frozenset())
    return found


def check_puzzle(rec, label):
    n = rec["n"]
    rs = rec["regions"]
    if not check(len(rs) == n * n and len(rec["solution"]) == n, label + ": bad sizes"):
        return
    regions = [ord(ch) - 65 for ch in rs]
    check(sorted(set(regions)) == list(range(n)), label + ": expected regions 0..n-1")
    check(all(connected(n, regions, g) for g in range(n)), label + ": a region is not connected")
    sol = [ALPHABET.index(ch) for ch in rec["solution"]]
    check(valid_solution(n, regions, sol), label + ": stored solution breaks a rule")
    found = solutions(n, regions, 2)
    check(len(found) == 1, label + ": %d solutions, expected exactly 1" % len(found))
    if found:
        check(found[0] == sol, label + ": unique solution differs from the stored one")


def node_eval(js):
    out = subprocess.run(["node", "-e", js], check=True, capture_output=True)
    return json.loads(out.stdout.decode("utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source")
    ap.add_argument("--today")
    ap.add_argument("--godot-hints")
    args = ap.parse_args()
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(dt.timezone.utc).date()
    today_num = (today - EPOCH).days + 1

    # 1 + 2: published data
    data_dir = os.path.join(WEB, "daily", "data")
    nums = sorted(int(m.group(1)) for m in (re.fullmatch(r"(\d+)\.json", f) for f in os.listdir(data_dir)) if m)
    check(nums == list(range(1, today_num + 2)), "data files should be exactly 1..%d, found %s" % (today_num + 1, nums[-3:]))
    published = {}
    for num in nums:
        with open(os.path.join(data_dir, "%d.json" % num), encoding="utf-8") as f:
            rec = json.load(f)
        published[num] = rec
        label = "daily #%d" % num
        check(rec["number"] == num and rec["index"] == (num - 1) % 730, label + ": number/index mismatch")
        check(rec["date"] == (EPOCH + dt.timedelta(days=num - 1)).isoformat(), label + ": date mismatch")
        check_puzzle(rec, label)
    pages = sorted(int(d) for d in os.listdir(os.path.join(WEB, "daily")) if d.isdigit())
    check(pages == list(range(1, today_num + 1)), "archive pages should be 1..%d" % today_num)
    with open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8") as f:
        sm = f.read()
    sm_nums = sorted(int(x) for x in re.findall(re.escape(URL) + r"daily/(\d+)/", sm))
    check(sm_nums == list(range(1, today_num + 1)), "sitemap daily entries should be 1..%d" % today_num)
    check("NOTES.md" not in sm and "/tools/" not in sm, "sitemap must not list NOTES.md or tools")
    with open(os.path.join(WEB, "index.html"), encoding="utf-8") as f:
        home = f.read()
    m = re.search(r'<script type="application/json" id="puzzle-data">(.*?)</script>', home)
    check(m and json.loads(m.group(1))["number"] == today_num, "home page embeds today's puzzle")
    print("published data: %d puzzles verified (unique, rules hold), archive 1..%d" % (len(nums), today_num))

    # 3: web date maths and share text vs. the app (GDScript reference)
    with open(os.path.join(HERE, "app_reference.json"), encoding="utf-8") as f:
        ref = json.load(f)
    puzzle_js = json.dumps(os.path.join(WEB, "assets", "puzzle.js"))
    dates = json.dumps([r["date"] for r in ref["dates"]])
    web = node_eval(
        "const P=require(%s);const ds=%s;console.log(JSON.stringify(ds.map(k=>{const [y,m,d]=k.split('-').map(Number);"
        "const o={year:y,month:m,day:d};const num=P.dailyNumberFor(o);"
        "return {index:P.dailyIndexFor(o),number:num,share:P.shareText(num,0,%d,%d)};})))"
        % (puzzle_js, dates, ref["share_example_seconds"], ref["share_example_stars"]))
    source = None
    if args.source or os.environ.get("LANTERN_DAILY_KEY"):
        sys.path.insert(0, HERE)
        import build  # noqa: E402  (reads --source or decrypts tools/daily.enc)
        source = build.load_puzzles(args.source)
    compared = 0
    for r, w in zip(ref["dates"], web):
        label = "date %s" % r["date"]
        check(w["index"] == r["index"], label + ": web index %d != app %d" % (w["index"], r["index"]))
        check(w["number"] == r["number"], label + ": web number %d != app %d" % (w["number"], r["number"]))
        size = int(re.search(r"— (\d+)×", r["share"]).group(1))
        expect = r["share"].replace("— %d×%d" % (size, size), "— 0×0")
        check(w["share"] == expect, label + ": share text differs: %r vs %r" % (w["share"], expect))
        p = published.get(w["number"])
        if p is None and source is not None:
            p = source[w["index"]]
        if p is not None:
            h = hashlib.sha256((p["regions"] + ":" + p["solution"]).encode()).hexdigest()
            check(h == r["sha256"], label + ": web puzzle for #%d is not the app's puzzle" % w["number"])
            compared += 1
    print("app reference: %d dates match the GDScript index/number/share text; %d puzzles compared by hash"
          % (len(web), compared))
    if source is not None:
        check(compared >= 5, "need at least 5 sample dates compared against the app's puzzles")

    # 4: full equality with the app data
    if source is not None:
        for num, rec in published.items():
            s = source[(num - 1) % 730]
            check((rec["n"], rec["regions"], rec["solution"]) == (s["n"], s["regions"], s["solution"]),
                  "daily #%d differs from the app's daily.json" % num)
        print("app data: all %d published files equal the app's daily.json entries" % len(published))

    # 5: hint port vs GDScript
    if args.godot_hints:
        with open(args.godot_hints, encoding="utf-8") as f:
            gt = json.load(f)
        if source is None:
            sys.exit("--godot-hints needs --source")
        cases = [{"index": h["index"], "p": source[h["index"]]} for h in gt["hints"]]
        js = node_eval(
            "const P=require(%s);const cs=%s;console.log(JSON.stringify(cs.map(c=>{const z=new P(c.p.n,c.p.regions,c.p.solution);"
            "const seq=[];let g=0;while(!z.isSolved()&&g<400){const h=z.hint();if(!h)break;z.snapshot();z.setCell(h.cell,h.state,true);"
            "seq.push([h.cell,h.state,h.reason]);g++;}return {index:c.index,seq:seq,cells:z.cells};})))" % (puzzle_js, json.dumps(cases)))
        for a, b in zip(gt["hints"], js):
            check(a["seq"] == b["seq"] and a["cells"] == b["cells"],
                  "hint sequence for daily index %d differs from GDScript" % a["index"])
        print("hints: %d puzzles solved hint-by-hint identically to GDScript (%d steps)"
              % (len(js), sum(len(h["seq"]) for h in js)))

    print("\nALL DATA CHECKS PASSED" if not failures else "\n%d FAILED" % len(failures))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
