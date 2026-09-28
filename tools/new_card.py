#!/usr/bin/env python3
"""Bring newly authored cards' art into the game in one go.

    python3 tools/new_card.py <id>=<image> [<id>=<image> ...] --note 'where the art came from'
    python3 tools/new_card.py --bake <id> [<id> ...]      # only re-bake (after hand edits)

For each card (already defined in src/content/cards.js):
  1. the illustration is normalised to the portrait source size (1086x1448, 3:4 centre crop) and registered as an
     individual source (assets/anime/overrides/<id>.png + overrides.json + a manifest entry);
  2. config/characters.json gets the card with a default crop focus (edit it after looking at the hand/board crop);
  3. tools/pack_card_assets.py packs every card WebP;
  4. the card-relief maps (tools/bake_card_relief.py) and the automatic live artwork (tools/bake_live_art.py --auto)
     are baked for these ids;
  5. python3 build.py.

Steps 1 and 4 need Pillow / numpy / onnxruntime: they run through `uv run` with the same flags as the bake scripts.
The image is used as given apart from the crop: look at it before running this.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets/anime"
SIZE = (1086, 1448)
# the crop focus (vertical %, 0 = top) a new card starts from; minions frame the face, spells the centre
FOCUS = {"minion": 18, "spell": 30, "weapon": 30}
UV = ["uv", "run", "--python", "3.12", "--no-project", "--with", "pillow", "--with", "numpy", "--with", "onnxruntime"]


def cards():
    data = json.loads(subprocess.check_output(["node", "-e", 'console.log(JSON.stringify(require("./src/data.js").create().cards))'], cwd=ROOT))
    return {c["id"]: c for c in data}


def normalise(src, dst):
    code = (
        "import sys\nfrom PIL import Image, ImageOps\n"
        f"im = Image.open(sys.argv[1]).convert('RGB')\n"
        f"ImageOps.fit(im, {SIZE}, method=Image.Resampling.LANCZOS).save(sys.argv[2])\n"
    )
    subprocess.check_call(UV + ["python", "-c", code, str(src), str(dst)], cwd=ROOT)


def register(pairs, note):
    known = cards()
    manifest = json.loads((ART / "manifest.json").read_text())
    overrides = json.loads((ART / "overrides.json").read_text())
    chars_path = ROOT / "config/characters.json"
    chars = json.loads(chars_path.read_text())
    for cid, image in pairs:
        if cid not in known:
            sys.exit(f"{cid}: define the card in src/content/cards.js first")
        target = ART / "overrides" / f"{cid}.png"
        normalise(Path(image).resolve(), target)
        overrides[cid] = {"source": f"overrides/{cid}.png", "note": note}
        # pack_card_assets fills in the rest (hashes, sizes, source) from the override
        manifest["items"].setdefault(cid, {"file": f"{cid}.webp"})
        chars["cards"].setdefault(cid, {"staticKey": cid, "focus": FOCUS[known[cid]["type"]]})
        print(f"registered {cid} <- {image}")
    (ART / "overrides.json").write_text(json.dumps(overrides, ensure_ascii=False, indent=2) + "\n")
    (ART / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    chars_path.write_text(json.dumps(chars, ensure_ascii=False, indent=2) + "\n")
    # pack_card_assets needs Pillow for the overrides it re-encodes
    subprocess.check_call(UV + ["tools/pack_card_assets.py"], cwd=ROOT)


def bake(ids):
    subprocess.check_call(UV + ["tools/bake_card_relief.py", *ids], cwd=ROOT)
    subprocess.check_call(UV + ["tools/bake_live_art.py", "--auto", *ids], cwd=ROOT)
    subprocess.check_call([sys.executable, "build.py"], cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("items", nargs="+", help="<id>=<image>, or ids with --bake")
    parser.add_argument("--note", help="provenance note stored with the art")
    parser.add_argument("--bake", action="store_true", help="only re-bake relief and live art, then build")
    args = parser.parse_args()
    if args.bake:
        bake(args.items)
        return
    pairs = [item.split("=", 1) for item in args.items]
    if any(len(p) != 2 for p in pairs) or not args.note:
        parser.error("give <id>=<image> pairs and --note")
    register(pairs, args.note)
    bake([cid for cid, _ in pairs])


if __name__ == "__main__":
    main()
