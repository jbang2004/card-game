#!/usr/bin/env python3
"""Package the web build for publishing as a claude.ai Artifact.

    python3 tools/build_artifact.py <out-dir>

An Artifact serves at most 255 files of at most 15 MB each (binary) or 16 MB
(text), and its page loads nothing from other hosts. dist/ has hundreds of
separate images, so this build inlines every image and sound into the module
that uses it (as the single-file build does) and keeps one script per module,
except the live artwork: each illustration's six maps become one JSON pack,
fetched only when that card is shown (EmberLiveArt resolves `pack:` URLs).

Writes <out-dir>/index.html (the page), styles.css, scripts/*.js and
live/<id>.json, and fails if any file or the file count breaks those limits.
Run `python3 build.py` first so the embedded art in art/ is current.
"""
import base64
import hashlib
import struct
import io
import json
import re
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, ART = ROOT / "src", ROOT / "art"
TOKEN = re.compile(r"/\*([A-Z_]+)\*/")
MIME = {".png": "png", ".webp": "webp", ".jpg": "jpeg"}
FILE_LIMIT = 15 * 1024 * 1024
COUNT_LIMIT = 255
TITLE = "琥珀战记 · 战场试玩"


def data_uri(rel):
    path = ART / rel
    if not path.is_file():
        raise FileNotFoundError(f"art/{rel} is missing: run python3 build.py first")
    return f"data:image/{MIME[path.suffix]};base64," + base64.b64encode(path.read_bytes()).decode()


def embed(text):
    return re.sub(r"asset:([\w/.-]+)", lambda m: shrink_image(data_uri(m[1])), text)


# A big picture made lossless (a cut-out with its alpha, a theme backdrop) is re-encoded lossy for the Artifact:
# near the same to the eye, a fraction of the bytes (cached by content, like the live layers below)
BIG_IMAGE = 250_000
IMAGE_QUALITY = 82


def shrink_image(uri):
    raw = base64.b64decode(uri.split(",", 1)[1]) if uri.startswith("data:image/") else b""
    if len(raw) < BIG_IMAGE:
        return uri
    try:
        from PIL import Image
    except ImportError:
        return uri
    key = hashlib.sha1(raw + f"img{IMAGE_QUALITY}".encode()).hexdigest()[:20]
    hit = CACHE / f"{key}.webp"
    if not hit.exists():
        img = Image.open(io.BytesIO(raw))
        out = io.BytesIO()
        img.save(out, "WEBP", quality=IMAGE_QUALITY, alpha_quality=90, method=6)
        CACHE.mkdir(parents=True, exist_ok=True)
        hit.write_bytes(out.getvalue() if len(out.getvalue()) < len(raw) * 0.9 else raw)
    return "data:image/webp;base64," + base64.b64encode(hit.read_bytes()).decode()


# The realistic figures (EmberModelArt, tools/model_art.cjs) are too large to ship as made: each model's mesh is
# deflated (`z`: EmberModelFigures inflates it with DecompressionStream) and its texture re-encoded as WebP of at most
# TEX_MAX px (with Pillow when it is installed; without it the texture stays as made and the build may exceed the limit).
TEX_MAX = 1024
TEX_QUALITY = 68
MODEL_LINE = re.compile(r"^(  )(\w+): (\{.*\})(,?)$", re.M)


def shrink_texture(uri):
    try:
        from PIL import Image
    except ImportError:
        return uri
    img = Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("RGB")
    k = min(1, TEX_MAX / max(img.size))
    if k < 1:
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, "WEBP", quality=TEX_QUALITY, method=6)
    return "data:image/webp;base64," + base64.b64encode(out.getvalue()).decode()


def pack_mesh(raw, entry):
    """the mesh laid out as EmberModelFigures reads it (positions, uvs: 16-bit; joints, weights: bytes; triangles), each
    16-bit array as its low bytes then its high bytes and the 16-bit triangle indices as zig-zagged deltas: the same
    size, but it deflates far better (`z` 2 — models.js unpacks it)"""
    n, t3, wide = entry["count"], entry["tris"] * 3, entry.get("wide")
    out, o = bytearray(raw), 0
    for size, kind in ((n * 6, 1), (n * 4, 1), (n * 4, 0), (n * 4, 0), (t3 * (4 if wide else 2), 0 if wide else 2)):
        if kind:
            vals = list(struct.unpack_from(f"<{size // 2}H", raw, o))
            if kind == 2:
                prev, zz = 0, []
                for v in vals:
                    d = ((v - prev + 32768) & 0xFFFF) - 32768
                    zz.append(((d << 1) ^ (d >> 31)) & 0xFFFF)
                    prev = v
                vals = zz
            h = size // 2
            out[o:o + h] = bytes(v & 255 for v in vals)
            out[o + h:o + size] = bytes(v >> 8 for v in vals)
        o += -(-size // 4) * 4
    return bytes(out)


# The live artwork's big layers (the painting, the figure cut out of it, what stands in front) are re-encoded a little
# lighter (LIVE_QUALITY) for the same reason; its depth and control maps stay as made. Results are cached by content.
LIVE_QUALITY = 72
LIVE_LAYERS = ("bg", "body", "front")
CACHE = ROOT / "tools" / "models" / "cache" / "artifact"


def shrink_live(kind, uri):
    if kind not in LIVE_LAYERS:
        return uri
    try:
        from PIL import Image
    except ImportError:
        return uri
    raw = base64.b64decode(uri.split(",", 1)[1])
    key = hashlib.sha1(raw + f"{LIVE_QUALITY}".encode()).hexdigest()[:20]
    hit = CACHE / f"{key}.webp"
    if not hit.exists():
        img = Image.open(io.BytesIO(raw))
        out = io.BytesIO()
        img.save(out, "WEBP", quality=LIVE_QUALITY, method=6)
        CACHE.mkdir(parents=True, exist_ok=True)
        hit.write_bytes(out.getvalue() if len(out.getvalue()) < len(raw) else raw)
    return "data:image/webp;base64," + base64.b64encode(hit.read_bytes()).decode()


def shrink_models(text):
    def one(m):
        entry = json.loads(m[3])
        if "bin" not in entry or entry.get("z"):
            return m[0]
        deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
        raw = pack_mesh(base64.b64decode(entry["bin"]), entry)
        entry["bin"] = base64.b64encode(deflate.compress(raw) + deflate.flush()).decode()
        entry["z"] = 2
        if entry.get("tex", "").startswith("data:image/"):
            entry["tex"] = shrink_texture(entry["tex"])
        return f"{m[1]}{m[2]}: {json.dumps(entry, separators=(',', ':'))}{m[4]}"
    return MODEL_LINE.sub(one, text)


def main(out):
    out.mkdir(parents=True, exist_ok=True)
    for old in list(out.glob("scripts/*.js")) + list(out.glob("live/*.json")):
        old.unlink()
    registry = json.loads((ROOT / "config/build.json").read_text())
    template = (SRC / "template.html").read_text()
    files = {}

    def write(rel, text):
        target = out / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        files[rel] = target.stat().st_size


    # Live artwork: one JSON pack per illustration, the registry points into them.
    maps_src = (SRC / registry["LIVE_ART_MAPS"]).read_text()
    maps = json.loads(re.search(r"Object\.freeze\((\{.*?\})\);", maps_src, re.S)[1])
    packed = {}
    for key, kinds in maps.items():
        write(f"live/{key}.json", json.dumps({k: shrink_live(k, data_uri(v[len("asset:"):])) for k, v in kinds.items()}))
        packed[key] = {k: f"pack:live/{key}.json#{k}" for k in kinds}
    sources = {}
    for token, rel in registry.items():
        sources[token] = (
            "const EmberLiveArtMaps = Object.freeze(" + json.dumps(packed) + ");\n"
            if token == "LIVE_ART_MAPS"
            else shrink_models((SRC / rel).read_text()) if token.startswith("VOXEL_MODEL_ART")
            else embed((SRC / rel).read_text())
        )

    def script(match):
        rel = "scripts/" + registry[match[1]]
        write(rel, sources[match[1]])
        return f'<script src="./{rel}" defer></script>'

    page = re.sub(r"<script>/\*([A-Z_]+)\*/</script>", script, template)
    css = []

    def style(match):
        css.append(TOKEN.sub(lambda m: sources[m[1]], match[1]))
        return '<link rel="stylesheet" href="./styles.css">'

    page = re.sub(r"<style>(.*?)</style>", style, page, flags=re.S)
    write("styles.css", "\n".join(css))
    if TOKEN.search(page):
        raise ValueError("unresolved build token")
    # The Artifact wraps the page in its own document skeleton: keep the head's
    # contents at the top and drop the document tags.
    page = re.sub(r"<!DOCTYPE html>|</?html[^>]*>|</?head>|</?body>", "", page, flags=re.I)
    page = re.sub(r"<title>.*?</title>", f"<title>{TITLE}</title>", page, count=1)
    write("index.html", page)

    too_big = {k: v for k, v in files.items() if v > FILE_LIMIT}
    if too_big or len(files) > COUNT_LIMIT:
        raise SystemExit(f"Artifact limits exceeded: {len(files)} files; oversized {too_big}")
    total = sum(files.values())
    print(f"{len(files)} files, {total / 1e6:.1f} MB; largest "
          + ", ".join(f"{k} {v / 1e6:.1f} MB" for k, v in sorted(files.items(), key=lambda kv: -kv[1])[:3]))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]).resolve())
