"""Bake the studio environment that polished areas of a relief card reflect.

    uv run --python 3.12 --no-project --with pillow --with numpy tools/bake_relief_studio.py

Writes art/relief/studio.webp: LEVELS square tiles side by side, sharp to fully
rough. Each tile is a stereographic view of the world seen from the card
(+z toward the viewer): p = d.xy / (1 + d.z) / SPAN + .5. Stereographic is
conformal, so a plain Gaussian per tile stands in for the roughness lobe.
Values are HDR, stored as sqrt(radiance / RANGE); card-relief.js decodes with
the same constants.
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "art/relief/studio.webp"
TILE = 128
SPAN = 2.2
RANGE = 6.0
LOBES = [0.02, 0.06, 0.12, 0.22, 0.35, 0.5]  # radians, one per tile
WORK = 4  # supersample so the sharp tile keeps clean softbox edges


def blur(a, radius):
    r = max(1, int(radius * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / radius) ** 2).astype(np.float32)
    k /= k.sum()
    for axis in (0, 1):
        pad = [(r, r) if i == axis else (0, 0) for i in range(3)]
        a = np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), axis, np.pad(a, pad, "edge"))
    return a.astype(np.float32)


def box(az, el, az0, az1, el0, el1, soft):
    def edge(v, lo, hi):
        return np.clip((v - lo) / soft, 0, 1) * np.clip((hi - v) / soft, 0, 1)
    return edge(az, az0, az1) * edge(el, el0, el1)


def studio(n):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    px = ((x + 0.5) / n - 0.5) * SPAN
    py = (0.5 - (y + 0.5) / n) * SPAN
    rr = px * px + py * py
    d = np.stack([2 * px, 2 * py, 1 - rr]) / (1 + rr)  # inverse stereographic
    az = np.degrees(np.arctan2(d[0], d[2]))
    el = np.degrees(np.arcsin(np.clip(d[1], -1, 1)))

    # Lit room: a broad ceiling bounce straight ahead, so head-on metal gets back the
    # diffuse light the shader removes from it, falling to a dark surround. Turning the
    # card therefore both brightens and darkens polished areas.
    ahead = np.degrees(np.arccos(np.clip(d[2], -1, 1)))
    glow = 0.22 + 0.83 * np.clip((62 - ahead) / 40, 0, 1) ** 1.5
    # A black flag just right of centre gives metal a dark line to travel across.
    glow *= 1 - 0.8 * box(az, el, 11, 19, -70, 70, 2.5)
    room = np.array([0.94, 0.97, 1.0])[:, None, None] * glow * (0.8 + 0.2 * np.clip(d[1] + 0.5, 0, 1))
    # Key softbox, upper left, with the cross seam of a gridded diffuser.
    key = box(az, el, -58, -22, 10, 50, 5.0)
    key *= 1 - 0.35 * np.exp(-((az + 40) / 1.2) ** 2) - 0.35 * np.exp(-((el - 30) / 1.2) ** 2)
    # Tall warm strip on the right, a low cool kicker, and a floor bounce.
    strip = box(az, el, 28, 38, -34, 52, 3.0)
    kicker = box(az, el, -30, 30, -62, -48, 6.0)
    floor = np.clip(-d[1] - 0.35, 0, 1) ** 1.5
    # Pin lights make small sparkles on engraved metal.
    pins = sum(np.exp(-(((az - a) ** 2 + (el - e) ** 2) / 3.0)) for a, e in [(-8, 56), (14, 60), (52, 20), (-66, -8)])
    return (room
            + np.array([0.95, 0.98, 1.00])[:, None, None] * key * 4.2
            + np.array([1.00, 0.84, 0.62])[:, None, None] * strip * 3.4
            + np.array([0.45, 0.70, 0.90])[:, None, None] * kicker * 1.2
            + np.array([0.30, 0.24, 0.20])[:, None, None] * floor * 0.5
            + np.array([1.00, 0.97, 0.90])[:, None, None] * pins * 5.0).transpose(1, 2, 0).astype(np.float32)


def main():
    n = TILE * WORK
    sharp = studio(n)
    per_radian = n / SPAN / 2  # d.xy / (1 + d.z) ~ angle / 2 near the tile centre
    tiles = []
    for lobe in LOBES:
        level = blur(sharp, lobe * per_radian)
        level = level.reshape(TILE, WORK, TILE, WORK, 3).mean(axis=(1, 3))
        tiles.append(np.sqrt(np.clip(level / RANGE, 0, 1)))
    strip = np.concatenate(tiles, axis=1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((strip * 255 + 0.5).astype(np.uint8), "RGB").save(OUT, quality=90, method=6)
    print(OUT.name, OUT.stat().st_size, strip.shape)


if __name__ == "__main__":
    main()
