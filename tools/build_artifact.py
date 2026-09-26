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
TITLE = "烬域 · 战场试玩"


def data_uri(rel):
    path = ART / rel
    if not path.is_file():
        raise FileNotFoundError(f"art/{rel} is missing: run python3 build.py first")
    return f"data:image/{MIME[path.suffix]};base64," + base64.b64encode(path.read_bytes()).decode()


def embed(text):
    return re.sub(r"asset:([\w/.-]+)", lambda m: data_uri(m[1]), text)


# The realistic figures (EmberModelArt, tools/model_art.cjs) are too large to ship as made: each model's mesh is
# deflated (`z`: EmberModelFigures inflates it with DecompressionStream) and its texture re-encoded as WebP of at most
# TEX_MAX px (with Pillow when it is installed; without it the texture stays as made and the build may exceed the limit).
TEX_MAX = 1024
TEX_QUALITY = 75
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


def shrink_models(text):
    def one(m):
        entry = json.loads(m[3])
        if "bin" not in entry or entry.get("z"):
            return m[0]
        deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
        entry["bin"] = base64.b64encode(deflate.compress(base64.b64decode(entry["bin"])) + deflate.flush()).decode()
        entry["z"] = 1
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
        write(f"live/{key}.json", json.dumps({k: data_uri(v[len("asset:"):]) for k, v in kinds.items()}))
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
