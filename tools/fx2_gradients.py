#!/usr/bin/env python3
"""Rebuild assets/fx2/gradients.webp — the 256xN 1D colour-ramp table.

The first five rows (fire / lightning / arcane / ember / slash) were baked by a
script that no longer lives in this repo, so they are **read back out of the
existing file and copied verbatim**: touching them would change every skill
that already passed review (fireball / execute are the acceptance baselines).
Only the rows appended after them are generated here.

    .venv/bin/python3 tools/fx2_gradients.py

The engine uploads whatever height the file has and passes it as `uGradRows`,
so adding rows needs no shader change — only the `G` table in fx2-engine.js.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/fx2/gradients.webp'
WIDTH = 256
KEEP_ROWS = 5  # fire / lightning / arcane / ember / slash — never regenerated

# name -> [(position 0..1, (r, g, b))]. Position 0 is the cold/outer end of the
# ramp, 1 the white-hot core; atom-dissolve maps its tone value into [0.20, 1]
# so the very bottom of the ramp is only reached by stray erosion pixels.
NEW_ROWS = [
    ('frost', [
        (0.00, (0x0a, 0x1c, 0x38)), (0.30, (0x18, 0x5b, 0x9e)),
        (0.58, (0x4f, 0xb4, 0xe6)), (0.80, (0xa8, 0xe6, 0xff)),
        (1.00, (0xf2, 0xfd, 0xff)),
    ]),
    ('holy', [
        (0.00, (0x3a, 0x22, 0x06)), (0.30, (0x9c, 0x6c, 0x14)),
        (0.58, (0xe8, 0xb4, 0x3c)), (0.80, (0xff, 0xe6, 0x9c)),
        (1.00, (0xff, 0xfb, 0xea)),
    ]),
    ('nature', [
        (0.00, (0x0c, 0x24, 0x10)), (0.30, (0x27, 0x6b, 0x2c)),
        (0.58, (0x6a, 0xc4, 0x4a)), (0.80, (0xc2, 0xf0, 0x8c)),
        (1.00, (0xf4, 0xff, 0xe2)),
    ]),
    ('void', [
        (0.00, (0x14, 0x06, 0x26)), (0.30, (0x4a, 0x16, 0x76)),
        (0.58, (0x8e, 0x45, 0xd6)), (0.80, (0xcf, 0xa4, 0xff)),
        (1.00, (0xf6, 0xee, 0xff)),
    ]),
    ('blood', [
        (0.00, (0x24, 0x03, 0x06)), (0.30, (0x7a, 0x0d, 0x14)),
        (0.58, (0xc8, 0x22, 0x26)), (0.80, (0xf2, 0x74, 0x62)),
        (1.00, (0xff, 0xdc, 0xcf)),
    ]),
]


def ramp(stops):
    stops = sorted(stops)
    out = []
    for i in range(WIDTH):
        t = i / (WIDTH - 1)
        lo = stops[0]
        hi = stops[-1]
        for a, b in zip(stops, stops[1:]):
            if a[0] <= t <= b[0]:
                lo, hi = a, b
                break
        span = hi[0] - lo[0]
        k = 0.0 if span <= 0 else (t - lo[0]) / span
        out.append(tuple(round(lo[1][c] + (hi[1][c] - lo[1][c]) * k) for c in range(3)))
    return out


def generate() -> Image.Image:
    old = Image.open(OUT).convert('RGB')
    if old.width != WIDTH or old.height < KEEP_ROWS:
        raise ValueError('unexpected gradients.webp geometry: %r' % (old.size,))
    keep = old.crop((0, 0, WIDTH, KEEP_ROWS))
    img = Image.new('RGB', (WIDTH, KEEP_ROWS + len(NEW_ROWS)))
    img.paste(keep, (0, 0))
    for r, (_name, stops) in enumerate(NEW_ROWS):
        for x, rgb in enumerate(ramp(stops)):
            img.putpixel((x, KEEP_ROWS + r), rgb)
    # lossless: 256xN is a couple of hundred bytes either way, and a lossy
    # ramp would put banding into every gradient lookup in the engine.
    img.save(OUT, 'WEBP', lossless=True, quality=100, method=6)
    return img


if __name__ == '__main__':
    im = generate()
    print(OUT.relative_to(ROOT), im.size, OUT.stat().st_size, 'bytes')
    for i, (name, _s) in enumerate(NEW_ROWS):
        print('  row', KEEP_ROWS + i, '=', name)
