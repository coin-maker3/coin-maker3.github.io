#!/usr/bin/env python3
"""One-off art for the web pages (needs Pillow; NOT run by the daily workflow).

Draws the 1200x630 Open Graph / Twitter card image and the favicons in the
same style as the app's store art (warm night sky, coloured regions, glowing
paper lanterns). Drawing helpers mirror lantern-logic/tools/make_art.py.

  python3 tools/make_og.py [path/to/icon_512.png]

Outputs (relative to lantern-logic/):
  assets/og.png                1200x630 share card
  assets/apple-touch-icon.png  180x180
  assets/icon-192.png          192x192 (manifest-free, used as large favicon)
  assets/favicon-32.png        32x32
"""

import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(HERE, "assets")

BG_TOP = (38, 22, 52)
BG_BOTTOM = (12, 9, 22)
REGION = [(230, 159, 0), (86, 180, 233), (0, 158, 115), (240, 228, 66),
          (0, 114, 178), (213, 94, 0), (204, 121, 167), (160, 160, 160)]
GOLD = (255, 196, 92)
TITLE_FONT = os.path.join(ASSETS, "fraunces-600.woff2")
BODY_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def stars(img, count, seed):
    rng = random.Random(seed)
    d = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    for _ in range(count):
        x, y = rng.uniform(0, w), rng.uniform(0, h * 0.85)
        r = rng.uniform(0.6, 1.7) * w / 700
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 240, 220, rng.randint(70, 190)))


def glow(size, center, radius, color, strength=1.0):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    for k in range(24, 0, -1):
        r = radius * k / 24
        a = int(150 * strength * (1 - k / 24) ** 1.6)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return layer.filter(ImageFilter.GaussianBlur(radius / 8))


def lantern(d, cx, cy, s):
    w = s * 0.62
    h = s * 0.7
    d.arc([cx - w * 0.22, cy - h * 0.82, cx + w * 0.22, cy - h * 0.38], 180, 360,
          fill=(70, 40, 20), width=max(2, int(s * 0.05)))
    d.rounded_rectangle([cx - w * 0.32, cy - h * 0.58, cx + w * 0.32, cy - h * 0.44],
                        radius=s * 0.03, fill=(90, 50, 25))
    d.rounded_rectangle([cx - w * 0.32, cy + h * 0.44, cx + w * 0.32, cy + h * 0.58],
                        radius=s * 0.03, fill=(90, 50, 25))
    d.ellipse([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=GOLD,
              outline=(150, 70, 20), width=max(2, int(s * 0.035)))
    for k in (-1, 1):
        d.arc([cx - w * 0.22, cy - h / 2, cx + w * 0.22, cy + h / 2],
              90 if k > 0 else 270, 270 if k > 0 else 90, fill=(220, 130, 50),
              width=max(1, int(s * 0.025)))
    d.ellipse([cx - w * 0.16, cy - h * 0.2, cx + w * 0.16, cy + h * 0.2], fill=(255, 245, 200))


def board(img, x0, y0, size, n, regions, lanterns):
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([x0 - 10, y0 - 10, x0 + size + 10, y0 + size + 10], radius=18, fill=(18, 12, 26, 255))
    cell = size / n
    pad = max(2, int(cell * 0.06))
    for r in range(n):
        for c in range(n):
            col = tuple(int(v * 0.78) for v in REGION[regions[r][c]])
            d.rounded_rectangle([x0 + c * cell + pad / 2, y0 + r * cell + pad / 2,
                                 x0 + (c + 1) * cell - pad / 2, y0 + (r + 1) * cell - pad / 2],
                                radius=cell * 0.08, fill=col + (255,))
    for (r, c) in lanterns:
        img.alpha_composite(glow(img.size, (x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell), cell * 1.1, (255, 190, 90), 1.2))
    d = ImageDraw.Draw(img, "RGBA")
    for (r, c) in lanterns:
        lantern(d, x0 + (c + 0.5) * cell, y0 + (r + 0.55) * cell, cell * 0.85)


def make_og():
    w, h = 1200, 630
    img = gradient(w, h, BG_TOP, BG_BOTTOM).convert("RGBA")
    stars(img, 150, 9)
    # campaign level 11 of the app (a valid board with a unique solution)
    rs, sol = "ABCCCCBBCCCCBBCCCCBDDEECBDDDEEBDDDDF", "031425"
    regions = [[ord(rs[r * 6 + c]) - 65 for c in range(6)] for r in range(6)]
    lant = [(r, int(sol[r])) for r in range(6)]
    board(img, 730, 105, 420, 6, regions, lant)
    for (x, y, s) in [(80, 80, 46), (600, 70, 30), (640, 560, 34)]:
        img.alpha_composite(glow(img.size, (x, y), s * 1.4, (255, 190, 90), 1.0))
        lantern(ImageDraw.Draw(img, "RGBA"), x, y, s)
    d = ImageDraw.Draw(img, "RGBA")
    title = ImageFont.truetype(TITLE_FONT, 92)
    sub = ImageFont.truetype(TITLE_FONT, 44)
    body = ImageFont.truetype(BODY_FONT, 28)
    d.text((70, 170), "Lantern Logic", font=title, fill=(255, 226, 170))
    d.text((72, 290), "A daily Queens-style puzzle", font=sub, fill=GOLD)
    d.text((74, 392), "One lantern in every row, column", font=body, fill=(236, 224, 242))
    d.text((74, 432), "and colour. Lanterns never touch.", font=body, fill=(236, 224, 242))
    d.text((74, 500), "Free in your browser, new every day", font=body, fill=(196, 180, 210))
    return img.convert("RGB")


def main():
    icon_src = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(ASSETS, exist_ok=True)
    make_og().save(os.path.join(ASSETS, "og.png"), optimize=True)
    if icon_src:
        icon = Image.open(icon_src).convert("RGB")
        icon.resize((180, 180), Image.LANCZOS).save(os.path.join(ASSETS, "apple-touch-icon.png"), optimize=True)
        icon.resize((192, 192), Image.LANCZOS).save(os.path.join(ASSETS, "icon-192.png"), optimize=True)
        icon.resize((32, 32), Image.LANCZOS).save(os.path.join(ASSETS, "favicon-32.png"), optimize=True)
    print("written to", ASSETS)


if __name__ == "__main__":
    main()
