#!/usr/bin/env python3
"""Portrait stills: assets/portraits/<id>.png -> assets/portraits/<id>.webp (768x1024, 3:4 centre crop).

Heroes, bosses and rival opponents have their own art (src/content/portraits.js), separate from the 97 cards.
The build embeds `asset:portraits/<id>.webp` and mirrors it to art/portraits/.

    uv run --python 3.12 --no-project --with pillow python3 tools/portrait_assets.py [<id> ...]

Without ids every png in assets/portraits is converted. The png stays as the source of truth.
"""
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'assets/portraits'
SIZE = (768, 1024)
QUALITY = 86


def convert(png):
    img = Image.open(png).convert('RGB')
    w, h = img.size
    want = SIZE[0] / SIZE[1]
    if w / h > want:  # too wide: crop the sides
        nw = round(h * want)
        img = img.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
    elif w / h < want:  # too tall: crop top and bottom, keeping the top (the face) a little favoured
        nh = round(w / want)
        top = round((h - nh) * 0.35)
        img = img.crop((0, top, w, top + nh))
    img = img.resize(SIZE, Image.LANCZOS)
    out = png.with_suffix('.webp')
    img.save(out, 'WEBP', quality=QUALITY, method=6)
    return out


if __name__ == '__main__':
    ids = sys.argv[1:]
    sources = [DIR / f'{i}.png' for i in ids] if ids else sorted(DIR.glob('*.png'))
    for png in sources:
        out = convert(png)
        print(f'{png.name} -> {out.name} {out.stat().st_size // 1024} KB')
