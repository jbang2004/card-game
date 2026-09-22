"""Bake relief maps for EmberCardRelief and regenerate src/card-relief-maps.js.

    uv run --python 3.12 --no-project --with pillow --with numpy --with onnxruntime \
        tools/bake_card_relief.py --cards            # every id in src/content/cards.js
        tools/bake_card_relief.py paladin wolf       # just these ids
        tools/bake_card_relief.py                    # only rewrite the registry

Reads assets/anime/<id>.webp and writes art/relief/<id>-height.webp and -orm.webp.
A 768x1024 portrait bakes at 384x512 and also gets -normal.webp, because it is
shown large; a 336x448 card keeps a full-size height map (crisp silhouettes are
what make the layers separate), a 168x224 orm, and the shader derives normals. height: white = near. orm: R = foil mask, G = roughness,
B = metalness.
Depth comes from Depth Anything V2 Small (ONNX, Apache-2.0). The 99 MB weight
file is a local authoring input and is not tracked:
tools/.scratch/card-relief/model/model.onnx
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "tools/.scratch/card-relief/model/model.onnx"
SOURCE = ROOT / "assets/anime"
OUT = ROOT / "art/relief"
REGISTRY = ROOT / "src/card-relief-maps.js"
PORTRAIT = (768, 1024)
_session = None


def blur(a, radius):
    r = max(1, int(radius * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / radius) ** 2).astype(np.float32)
    k /= k.sum()
    for axis in (0, 1):
        pad = [(r, r) if i == axis else (0, 0) for i in range(2)]
        a = np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), axis, np.pad(a, pad, "edge"))
    return a.astype(np.float32)


def estimate_depth(rgb, infer):
    global _session
    if _session is None:
        _session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    x = np.asarray(rgb.resize(infer, Image.BICUBIC), dtype=np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = _session.run(None, {_session.get_inputs()[0].name: x})[0].squeeze()
    lo, hi = np.percentile(d, 1), np.percentile(d, 99)
    d = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)  # inverse depth: 1 = near
    return np.asarray(Image.fromarray(d, "F").resize(rgb.size, Image.BICUBIC), dtype=np.float32)


def bake(key):
    rgb = Image.open(SOURCE / f"{key}.webp").convert("RGB")
    portrait = rgb.size == PORTRAIT
    # Inference sizes are multiples of 14 at 3:4; filter radii are authored at portrait scale.
    infer, size, unit = ((756, 1008), (384, 512), 1.0) if portrait else ((518, 686), (168, 224), rgb.width / 768)
    a = np.asarray(rgb, dtype=np.float32) / 255
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    depth = blur(estimate_depth(rgb, infer), 1.6 * unit)
    # Painted micro relief: band-passed luminance reads as embossed brushwork and engraving.
    detail = blur(lum, 1.0 * unit) - blur(lum, 6.0 * unit)
    height = np.clip(depth + detail * 0.05, 0, 1)

    hsv = np.asarray(rgb.convert("HSV"), dtype=np.float32) / 255
    hue, sat, val = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    gold = np.clip((sat - 0.28) / 0.25, 0, 1) * np.clip((val - 0.45) / 0.25, 0, 1)
    gold *= ((hue > 22) & (hue < 58)).astype(np.float32)
    # Flame and glowing orbs share gold's hue but are emissive: far more saturated, or blown out.
    gold *= np.clip((0.8 - sat) / 0.15, 0, 1) * np.clip((0.985 - val) / 0.06, 0, 1)
    contrast = blur(np.abs(lum - blur(lum, 4.0 * unit)), 3.0 * unit)
    steel = np.clip(contrast / 0.09, 0, 1) * np.clip((0.3 - sat) / 0.2, 0, 1) * np.clip((depth - 0.45) / 0.2, 0, 1)
    metal = blur(np.clip(gold + steel * 0.7, 0, 1), 1.2 * unit)
    rough = np.clip(0.92 - metal * 0.62 - np.clip((val - 0.9) / 0.1, 0, 1) * 0.08, 0.2, 1)

    def save(name, arr, mode=None, at=None):
        im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), mode)
        im.resize(at or size, Image.LANCZOS).save(OUT / f"{key}-{name}.webp", quality=88, method=6)

    # A card's height map keeps the illustration's own resolution: layers only read as
    # separate when their silhouettes stay crisp. The material map can be coarse.
    save("height", height, "L", None if portrait else rgb.size)
    save("orm", np.dstack([metal, rough, metal]), "RGB")
    if portrait:
        # Gentle macro slope from depth; engraving detail is kept for metal, muted on cloth and sky.
        gy, gx = np.gradient(blur(depth, 2.5) * 4.0 + detail * (0.5 + 2.2 * metal))
        n = np.dstack([-gx, gy, np.full_like(gx, 0.06)])
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        save("normal", n * 0.5 + 0.5, "RGB")
    print(key, sum(p.stat().st_size for p in OUT.glob(f"{key}-*.webp")))


def write_registry():
    maps = {}
    for path in sorted(OUT.glob("*-*.webp")):
        key, kind = path.stem.rsplit("-", 1)
        if kind in ("height", "normal", "orm"):
            maps.setdefault(key, {})[kind] = f"asset:relief/{path.name}"
    body = json.dumps(maps, indent=2, sort_keys=True)
    REGISTRY.write_text("/* Generated by tools/bake_card_relief.py from art/relief. */\n"
                        f"const EmberCardReliefMaps = Object.freeze({body});\n")
    print(REGISTRY.name, len(maps), "ids")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    keys = sys.argv[1:]
    if keys == ["--cards"]:
        keys = re.findall(r'^\s*id: "(\w+)",', (ROOT / "src/content/cards.js").read_text(), re.M)
    for key in dict.fromkeys(keys):
        # Portrait-sized hero maps are hand-checked; a bulk run must not silently redo them.
        if sys.argv[1:] == ["--cards"] and (OUT / f"{key}-normal.webp").exists():
            continue
        bake(key)
    write_registry()
