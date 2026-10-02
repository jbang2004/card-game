#!/usr/bin/env python3
"""The mirror heroes (docs/design/CAST_V2.md): a dark black-jade twin of each hero's model.

    .venv/bin/python tools/mirror_glb.py nahira frederia rowan liol

Reads tools/models/real/<id>.body.glb (the Tripo export of the hero) and writes mirror<id>.body.glb beside it: the same
mesh, skeleton and uv, its base colour texture regraded to black jade with a cold sheen (the portrait twin is made the
same way, see assets/portraits/mirror<id>.png). tools/model_prep.cjs and tools/model_art.cjs then treat it as a figure
of its own.
"""
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REAL = ROOT / "tools/models/real"
STOPS = [(0.0, (0.015, 0.02, 0.03)), (0.35, (0.07, 0.13, 0.14)), (0.7, (0.30, 0.46, 0.46)), (1.0, (0.80, 0.93, 0.90))]


def grade(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    out = np.zeros_like(a)
    for c in range(3):
        out[..., c] = np.interp(lum ** 0.85, [s[0] for s in STOPS], [s[1][c] for s in STOPS])
    out = np.clip(0.82 * out + 0.18 * a * 0.55, 0, 1)
    return Image.fromarray((out * 255).astype(np.uint8))


def read(path):
    data = path.read_bytes()
    assert data[:4] == b"glTF"
    jlen, _ = struct.unpack("<II", data[12:20])
    doc = json.loads(data[20:20 + jlen])
    off = 20 + jlen
    blen, _ = struct.unpack("<II", data[off:off + 8])
    return doc, data[off + 8:off + 8 + blen]


def write(path, doc, blob):
    j = json.dumps(doc, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    blob += b"\0" * (-len(blob) % 4)
    path.write_bytes(b"glTF" + struct.pack("<II", 2, 12 + 8 + len(j) + 8 + len(blob)) + struct.pack("<I4s", len(j), b"JSON") + j + struct.pack("<I4s", len(blob), b"BIN\0") + blob)


def twin(src, dst):
    doc, blob = read(src)
    views = doc["bufferViews"]
    parts = [blob[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in views]
    done = set()
    for m in doc["materials"]:
        t = m.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if not t:
            continue
        img = doc["images"][doc["textures"][t["index"]]["source"]]
        if img["bufferView"] in done:
            continue
        done.add(img["bufferView"])
        src_img = Image.open(io.BytesIO(parts[img["bufferView"]]))
        buf = io.BytesIO()
        grade(src_img).save(buf, "JPEG", quality=92)
        parts[img["bufferView"]] = buf.getvalue()
        img["mimeType"] = "image/jpeg"
    out, at = b"", 0
    for v, p in zip(views, parts):
        out += b"\0" * (-len(out) % 4)
        v["byteOffset"], v["byteLength"] = len(out), len(p)
        out += p
    doc["buffers"][0]["byteLength"] = len(out)
    write(dst, doc, out)


if __name__ == "__main__":
    for hero in sys.argv[1:]:
        src = REAL / f"{hero}.body.glb"
        dst = REAL / f"mirror{hero}.body.glb"
        twin(src, dst)
        print(f"{hero}: {src.stat().st_size // 1024} KB -> {dst.name} {dst.stat().st_size // 1024} KB")
