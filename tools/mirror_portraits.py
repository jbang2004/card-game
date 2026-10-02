#!/usr/bin/env python3
"""The mirror heroes' portraits (docs/design/CAST_V2.md): each hero's original, flipped left-right, regraded to black jade,
the eyes lit violet, and a square cut-in on the eyes.

    .venv/bin/python tools/mirror_portraits.py            # nahira frederia rowan liol
    .venv/bin/python tools/portrait_assets.py mirrornahira ...   # then to webp; tools/cutin_assets.py assets/portraits/cutin

Writes assets/portraits/mirror<hero>.png and assets/portraits/cutin/mirror<hero>.png. The eye boxes are the ones the heroes'
live art blinks with (src/presentation/live-art-rigs.js), mirrored.
"""
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

R = Path(__file__).resolve().parent.parent / "assets/portraits"
EYES = {"nahira": [(457, 238, 30, 13), (566, 267, 22, 11)], "frederia": [(488, 208, 24, 10), (575, 190, 20, 9)],
        "rowan": [(412, 314, 26, 11), (503, 298, 20, 9)], "liol": [(505, 228, 22, 9), (593, 220, 18, 8)]}
STOPS = [(0.0, (0.015, 0.02, 0.03)), (0.35, (0.07, 0.13, 0.14)), (0.7, (0.30, 0.46, 0.46)), (1.0, (0.80, 0.93, 0.90))]
PURPLE = np.array([0.62, 0.28, 1.0], np.float32)


def twin(hero, eyes):
    im = ImageOps.mirror(Image.open(R / f"{hero}.png").convert("RGB"))
    W, H = im.size
    a = np.asarray(im).astype(np.float32) / 255
    lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    out = np.zeros_like(a)
    for c in range(3):
        out[..., c] = np.interp(lum ** 0.85, [s[0] for s in STOPS], [s[1][c] for s in STOPS])
    out = 0.82 * out + 0.18 * a * 0.55
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.38) / (H * 0.7)) ** 2)
    out *= (1 - 0.55 * np.clip(d - 0.35, 0, 1))[..., None]
    glow = np.zeros((H, W), np.float32)
    for x, y, hw, hh in eyes:
        glow = np.maximum(glow, np.exp(-(((xx - (W - x)) / (hw * 0.9)) ** 2 + ((yy - y) / (hh * 1.3)) ** 2)))
    wide = np.asarray(Image.fromarray((glow * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(np.float32) / 255
    out = np.clip(out + glow[..., None] * PURPLE * 1.1 + wide[..., None] * PURPLE * 0.45, 0, 1)
    img = Image.fromarray((out * 255).astype(np.uint8))
    img.save(R / f"mirror{hero}.png")
    cx, cy = W - sum(e[0] for e in eyes) / 2, sum(e[1] for e in eyes) / 2
    x0 = int(max(0, min(cx - 300, W - 600))); y0 = int(max(0, min(cy - 230, H - 600)))
    os.makedirs(R / "cutin", exist_ok=True)
    img.crop((x0, y0, x0 + 600, y0 + 600)).resize((1024, 1024), Image.LANCZOS).save(R / f"cutin/mirror{hero}.png")


if __name__ == "__main__":
    for hero, eyes in EYES.items():
        twin(hero, eyes)
        print("mirror" + hero)
