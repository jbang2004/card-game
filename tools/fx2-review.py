"""送审拼图：把一个技能族的 4 帧裁切、横排、缩放成一张 review 图。

需要 Pillow（`.venv`），不参与 build.py。

    .venv/bin/python tools/fx2-review.py [--box=x0,y0,x1,y1] <族名> <帧1..4.png>

投射物族（arrow / spear）要看得到整条飞行路径，用 --box 换一个覆盖
"施法者 → 目标"的取景；近战族用默认的目标周围 500×310。

裁切区域固定为目标点 (800, 295) 周围的 500×310，四帧横排，**每帧** 640 宽，
写到 output/fx2-integration-20260916/shots/fx2/review-<族名>.png。
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/fx2-integration-20260916/shots/fx2"
BOX = (550, 140, 1050, 450)  # 目标 (800,295) 周围 500×310
TILE_WIDTH = 640  # 每帧 640 宽（整图 = 640 × 帧数）
GAP = 6


def build(name, frames, box=BOX):
    tiles = [Image.open(f).convert("RGB").crop(box) for f in frames]
    w, h = tiles[0].size
    strip = Image.new("RGB", (w * len(tiles) + GAP * (len(tiles) - 1), h), (12, 12, 14))
    for i, tile in enumerate(tiles):
        strip.paste(tile, (i * (w + GAP), 0))
    draw = ImageDraw.Draw(strip)
    for i, f in enumerate(frames):
        draw.text((i * (w + GAP) + 8, 8), Path(f).stem.split("-")[-1], fill=(255, 235, 150))
    width = TILE_WIDTH * len(tiles)
    scale = width / strip.width
    strip = strip.resize((width, max(1, round(strip.height * scale))), Image.LANCZOS)
    target = OUT / ("review-%s.png" % name)
    target.parent.mkdir(parents=True, exist_ok=True)
    strip.save(target)
    return target


if __name__ == "__main__":
    args = sys.argv[1:]
    box = BOX
    if args and args[0].startswith("--box="):
        box = tuple(int(v) for v in args.pop(0)[6:].split(","))
    print(build(args[0], args[1:], box))
