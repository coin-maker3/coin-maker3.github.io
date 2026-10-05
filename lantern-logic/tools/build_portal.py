#!/usr/bin/env python3
"""Build the web-portal packages of the Lantern Logic campaign.

  python3 tools/build_portal.py            # zips from the committed level data
  python3 tools/build_portal.py --covers   # also redraw the cover images (needs Pillow)

Outputs (relative to lantern-logic/portal/):
  lantern-logic-crazygames.zip   CrazyGames: index.html at the zip root, SDK v3
                                 loaded from sdk.crazygames.com, adapter src/crazygames.js
  lantern-logic-itch.zip         itch.io HTML5 upload: no SDK, no ads
  crazygames/covers/*.png        cover images (1920x1080, 800x1200, 800x800, 800x450, 512x512)

Both builds are self-contained (relative paths only) and hold the same files as
the website's campaign: site.css, levels.css, puzzle.js, board.js, levels.js,
the Fraunces font and the 20 level packs. The daily puzzle is not included (it
lives on the website and its future puzzles are never published in the clear).
The website itself never loads any portal code. Standard library only, except
--covers.
"""

import argparse
import io
import json
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as site  # noqa: E402
import build_levels as lv  # noqa: E402

WEB = site.WEB
ASSETS = os.path.join(WEB, "assets")
PORTAL = os.path.join(WEB, "portal")
ZIP_DATE = (2026, 10, 5, 0, 0, 0)   # fixed timestamps: identical input gives an identical zip
SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js"


def read(path, mode="r"):
    with open(path, mode, **({"encoding": "utf-8"} if mode == "r" else {})) as f:
        return f.read()


def page(variant, levels):
    cfg = lv.config(levels, "data/", False,
                    site.URL if variant == "itch" else None)
    sdk = ""
    scripts = ["assets/puzzle.js", "assets/board.js", "assets/levels.js"]
    if variant == "crazygames":
        sdk = '<script src="%s"></script>\n' % SDK_URL
        scripts.insert(0, "assets/crazygames.js")
    tags = "".join('<script src="%s?v=%s" defer></script>\n' % (s, cfg["v"]) for s in scripts)
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lantern Logic: Queens Puzzle</title>
<meta name="description" content="600 calm Queens-style logic puzzles: one lantern in every row, column and colour, and lanterns never touch.">
<meta name="theme-color" content="#261634">
<meta name="color-scheme" content="dark">
<link rel="icon" href="assets/icon-192.png" type="image/png">
<link rel="preload" href="assets/fraunces-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css?v={v}">
<link rel="stylesheet" href="assets/levels.css?v={v}">
{sdk}</head>
<body>
{icons}
{extra}
<header class="portal-head"><span class="brand"><svg aria-hidden="true" focusable="false"><use href="#i-lantern"/></svg>Lantern Logic</span></header>
{body}{tags}</body>
</html>
""".format(v=cfg["v"], sdk=sdk, icons=site.ICONS, extra=lv.EXTRA_ICONS, body=lv.body(variant, cfg), tags=tags)


def files_for(variant, levels):
    """{zip path: bytes} of one build."""
    css = read(os.path.join(ASSETS, "site.css")).replace('url("%sassets/fraunces-600.woff2")' % site.BASE,
                                                          'url("fraunces-600.woff2")')
    assert site.BASE not in css, "site.css still has an absolute path"
    out = {
        "index.html": page(variant, levels).encode("utf-8"),
        "assets/site.css": css.encode("utf-8"),
        "assets/levels.css": read(os.path.join(ASSETS, "levels.css"), "rb"),
        "assets/puzzle.js": read(os.path.join(ASSETS, "puzzle.js"), "rb"),
        "assets/board.js": read(os.path.join(ASSETS, "board.js"), "rb"),
        "assets/levels.js": read(os.path.join(ASSETS, "levels.js"), "rb"),
        "assets/fraunces-600.woff2": read(os.path.join(ASSETS, "fraunces-600.woff2"), "rb"),
        "assets/fraunces-OFL.txt": read(os.path.join(ASSETS, "fraunces-OFL.txt"), "rb"),
        "assets/icon-192.png": read(os.path.join(ASSETS, "icon-192.png"), "rb"),
    }
    if variant == "crazygames":
        out["assets/crazygames.js"] = read(os.path.join(PORTAL, "src", "crazygames.js"), "rb")
    for name in sorted(os.listdir(lv.DATA_DIR)):
        if re.fullmatch(r"p\d+\.json", name):
            out["data/" + name] = read(os.path.join(lv.DATA_DIR, name), "rb")
    for path, blob in out.items():   # nothing may point back at the website's absolute paths
        if path.endswith((".html", ".css", ".js")):
            text = blob.decode("utf-8")
            assert not re.search(r'(href|src)="/', text), path + " has an absolute URL"
            if variant != "crazygames":
                assert SDK_URL not in text and "crazygames.js" not in text, path + " loads the CrazyGames SDK"
    return out


def write_zip(path, files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, files[name])
    data = buf.getvalue()
    old = read(path, "rb") if os.path.exists(path) else None
    if old != data:
        with open(path, "wb") as f:
            f.write(data)
    return len(data)


def write_tree(root, files):
    """Unpacked copy for local testing (not committed)."""
    for name, blob in files.items():
        p = os.path.join(root, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(blob)


# ---------------------------------------------------------------- covers

def make_covers(icon_src):
    from PIL import Image, ImageDraw, ImageFont
    import make_og as art
    out_dir = os.path.join(PORTAL, "crazygames", "covers")
    os.makedirs(out_dir, exist_ok=True)
    rs, sol = "ABCCCCBBCCCCBBCCCCBDDEECBDDDEEBDDDDF", "031425"   # campaign level 11, unique solution
    regions = [[ord(rs[r * 6 + c]) - 65 for c in range(6)] for r in range(6)]
    lant = [(r, int(sol[r])) for r in range(6)]

    def cover(w, h, layout):
        img = art.gradient(w, h, art.BG_TOP, art.BG_BOTTOM).convert("RGBA")
        art.stars(img, int(w * h / 5000), 11)
        unit = min(w, h)
        if layout == "landscape":
            size = int(h * 0.66)
            art.board(img, int(w * 0.585), (h - size) // 2 + int(h * 0.02), size, 6, regions, lant)
            tsize, tx, ty = int(h * 0.115), int(w * 0.05), int(h * 0.42)
        else:   # portrait / square: title on top, board below
            size = int(w * (0.74 if layout == "portrait" else 0.56))
            art.board(img, (w - size) // 2, int(h * (0.40 if layout == "portrait" else 0.36)), size, 6, regions, lant)
            tsize, tx, ty = int(unit * 0.14), None, int(h * (0.13 if layout == "portrait" else 0.09))
        for (fx, fy, fs) in ([(0.08, 0.16, 0.05), (0.47, 0.12, 0.035), (0.44, 0.82, 0.04)] if layout == "landscape"
                             else [(0.12, 0.06, 0.05), (0.86, 0.09, 0.04)]):
            x, y, s = w * fx, h * fy, unit * fs * (1.6 if layout != "landscape" else 1)
            img.alpha_composite(art.glow(img.size, (x, y), s * 1.4, (255, 190, 90), 1.0))
            art.lantern(ImageDraw.Draw(img, "RGBA"), x, y, s)
        d = ImageDraw.Draw(img, "RGBA")
        font = ImageFont.truetype(art.TITLE_FONT, tsize)
        title = "Lantern Logic"
        tw = d.textlength(title, font=font)
        if tx is None:
            tx = (w - tw) / 2
        d.text((tx, ty), title, font=font, fill=(255, 226, 170))
        return img.convert("RGB")

    specs = [("cover-landscape-1920x1080.png", 1920, 1080, "landscape"),
             ("cover-portrait-800x1200.png", 800, 1200, "portrait"),
             ("cover-square-800x800.png", 800, 800, "square")]
    for name, w, h, layout in specs:
        cover(w, h, layout).save(os.path.join(out_dir, name), optimize=True)
    big = Image.open(os.path.join(out_dir, "cover-landscape-1920x1080.png"))
    big.resize((800, 450), Image.LANCZOS).save(os.path.join(out_dir, "thumb-800x450.png"), optimize=True)
    Image.open(icon_src).convert("RGB").resize((512, 512), Image.LANCZOS).save(
        os.path.join(out_dir, "icon-512x512.png"), optimize=True)
    return sorted(os.listdir(out_dir))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--covers", action="store_true", help="redraw cover images (Pillow)")
    ap.add_argument("--icon", default=os.path.join(WEB, "..", "..", "lantern-logic", "store", "icon_512.png"),
                    help="the app's store/icon_512.png")
    ap.add_argument("--unpacked", metavar="DIR", help="also write unpacked builds to DIR/<variant>/ for testing")
    args = ap.parse_args()
    levels = lv.read_packs()
    os.makedirs(PORTAL, exist_ok=True)
    for variant in ("crazygames", "itch"):
        files = files_for(variant, levels)
        size = write_zip(os.path.join(PORTAL, "lantern-logic-%s.zip" % variant), files)
        raw = sum(len(b) for b in files.values())
        print("%-11s %3d files, %6d bytes unpacked, zip %6d bytes" % (variant, len(files), raw, size))
        if args.unpacked:
            write_tree(os.path.join(args.unpacked, variant), files)
    if args.covers:
        print("covers:", ", ".join(make_covers(os.path.abspath(args.icon))))


if __name__ == "__main__":
    main()
