"""Shrink a Tripo base-colour atlas for the battlefield and pad its islands (called by tools/model_art.cjs).

    python tools/model_texture.py in.(jpg|png) out.jpg [size]
    python tools/model_texture.py --luma tex.jpg uv.f32 luma.u8     (each uv pair's texel brightness, 0–255)
    python tools/model_texture.py --rgb tex.jpg uv.f32 rgb.u8       (each uv pair's texel colour, 3 bytes)

A retopologised Tripo model's texture is an atlas of many small islands on black gutters; a triangle whose uvs graze
an island's edge samples the gutter and shows as a black speck. The gutter is the near-black area connected to the
atlas border (painted dark details such as the eyes sit inside the skin and are not connected), and each island's
colour is bled out over it for a few pixels. Needs the art dependencies (requirements-art.txt: Pillow, numpy).
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

if sys.argv[1] == "--rgb":
    tex = np.asarray(Image.open(sys.argv[2]).convert("RGB"))
    uv = np.fromfile(sys.argv[3], np.float32).reshape(-1, 2)
    th, tw, _ = tex.shape
    x = np.clip((uv[:, 0] * tw).astype(int), 0, tw - 1); y = np.clip((uv[:, 1] * th).astype(int), 0, th - 1)
    tex[y, x].astype(np.uint8).tofile(sys.argv[4])
    sys.exit(0)

if sys.argv[1] == "--luma":
    tex = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(np.float32)
    uv = np.fromfile(sys.argv[3], np.float32).reshape(-1, 2)
    th, tw, _ = tex.shape
    x = np.clip((uv[:, 0] * tw).astype(int), 0, tw - 1); y = np.clip((uv[:, 1] * th).astype(int), 0, th - 1)
    (tex[y, x] @ np.array([0.3, 0.59, 0.11], np.float32)).clip(0, 255).astype(np.uint8).tofile(sys.argv[4])
    sys.exit(0)

src, dst = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
img = Image.open(src).convert("RGB")
img = img.resize((size, size), Image.LANCZOS) if img.size != (size, size) else img
px = np.asarray(img).astype(np.float32)
h, w, _ = px.shape
dark = (px @ np.array([0.3, 0.59, 0.11], np.float32)) < 14

# the gutter: dark pixels flood-filled from the border
gutter = np.zeros((h, w), bool)
q = deque()
for y in range(h):
    for x in (0, w - 1):
        if dark[y, x] and not gutter[y, x]:
            gutter[y, x] = True; q.append((y, x))
for x in range(w):
    for y in (0, h - 1):
        if dark[y, x] and not gutter[y, x]:
            gutter[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not gutter[ny, nx]:
            gutter[ny, nx] = True; q.append((ny, nx))

# bleed the islands outward over the gutter
todo = gutter.copy()
for _ in range(8):
    if not todo.any():
        break
    acc = np.zeros_like(px); cnt = np.zeros((h, w), np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        known = np.roll(np.roll(~todo, dy, 0), dx, 1)
        acc += np.roll(np.roll(px, dy, 0), dx, 1) * known[..., None]; cnt += known
    fill = todo & (cnt > 0)
    px[fill] = acc[fill] / cnt[fill][:, None]
    todo &= ~fill
Image.fromarray(px.clip(0, 255).astype(np.uint8)).save(dst, quality=85)
print(f"{dst}: {size}px, gutter {gutter.mean():.0%} padded")
