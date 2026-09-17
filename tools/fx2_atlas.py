#!/usr/bin/env python3
"""Pack the hand-authored fx2 textures into POT atlases for the fx2 engine.

Authoring-only: the sources are generated bitmaps that do not live in the repo,
so this is **not** wired into build.py (unlike tools/fx_shaders.py). The scratch
copy under `tools/.scratch/fx2-flipbooks` was deleted on 2026-09-18 — 源图已不在
仓库，重打图集需自备素材。Every `--*-src` flag must be passed explicitly (there
is no default path). Run it by hand whenever the source art changes:

    .venv/bin/python3 tools/fx2_atlas.py --src <folder with the 8 slam PNGs>
    .venv/bin/python3 tools/fx2_atlas.py --strike-src <folder with 17 PNGs>

Either flag may be given alone: patch_engine **merges** into the existing
ATLAS_CELLS block instead of rewriting it, so repacking one atlas never drops
the other one's cells (the slam sources are long gone from disk).

V2（2026-09-17）：`--merge-slam` 已把 atlas-slam 里仍在用的格子搬进 atlas-strike，并删掉了
atlas-slam.webp（片元纹理单元 9 → 8）。下面 `--src` 那一支是历史记录：再跑它会重新生成一张
引擎不再加载的 atlas-slam，并把格子写回图集号 0 —— 要重打这批素材，应改成直接打进
atlas-strike 空出来的格子。

Atlas 0 — assets/fx2/atlas-slam.webp (2048x1024, four 512 columns x two rows; V2 已删除):

    row 0:  flash | ring-annulus | shockwave | cracks
    row 1:  dustwave | smoke | embers | rock block

The rock block is the top half of the last 512 cell: a 4x2 grid of 128px slots
holding the six chroma-keyed rocks (six used, two empty). Each rock is fitted
into the middle 112px of its slot so that mip levels pull in transparent black
instead of the neighbouring rock.

Atlas 1 — assets/fx2/atlas-strike.webp (2048x2048, the six plain-attack
families). Mixed cell sizes: the big plates (arcs / beams / lances / trails /
streams / bursts) take 512 cells, the four small ones (flash, embers, sparks,
orb) share the (1,3) cell as a 2x2 grid of 256 slots, and the tileable fire
texture takes the top 512x256 half of (2,3).

Every strike plate is **cropped to its own content bbox and aspect-fitted**
into its cell. That is what makes the "left = attacker, right = target"
convention exact: after the crop the art touches the cell's left edge, so a
quad drawn with ax = 0 starts the streak at the attacker instead of a
guessed-at fraction inside the frame. It also stops a 1254px frame from
spending three quarters of its pixels on black margin.

Colour convention (matches atom-sprite.glsl):
  * additive plates (everything but the rocks) keep RGB and get alpha = 255 —
    their own luminance is the coverage, the shader derives alpha from it;
  * the rocks keep their real alpha and are drawn with kind 1.
"""
from pathlib import Path
import argparse
import json
import re
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_IMAGE = ROOT / 'assets/fx2/atlas-slam.webp'
STRIKE_IMAGE = ROOT / 'assets/fx2/atlas-strike.webp'
ENGINE = ROOT / 'src/fx2-engine.js'
CHROMA = Path.home() / '.codex/skills/.system/imagegen/scripts/remove_chroma_key.py'

ATLAS_W, ATLAS_H = 2048, 1024
STRIKE_W, STRIKE_H = 2048, 2048
CELL = 512
SMALL = 256
# 每格四周留出的空白比例：mip 链缩到十几像素时相邻格会互相渗色，着色器里的
# 0.25% inset 只挡得住半个像素，真正的隔离要在打包时留。
CELL_PAD = 0.03
ROCK_SLOT = 128
ROCK_FIT = 112

# 打包时转成灰度的格子：它们的色相必须由技能主色决定，不能由素材钉死。
# ring-annulus 的原图是一圈火，加色相乘只能压暗通道、压不出冷色，冰系随从的
# 重击照样是橙的；转灰之后 col 才真正说了算（火系随从传橙色，出来还是橙）。
DESATURATE = {'ringAnnulus'}

# name -> (source file, column, row) in the 4x2 grid of 512px cells
PLATES = {
    'flash': ('flash.png', 0, 0),
    'ringAnnulus': ('ring-annulus.png', 1, 0),
    'shockwave': ('shockwave.png', 2, 0),
    'cracks': ('cracks-v2.png', 3, 0),
    'dustwave': ('dustwave.png', 0, 1),
    'smoke': ('smoke.png', 1, 1),
    'embers': ('embers.png', 2, 1),
}
ROCK_ORIGIN = (3 * CELL, 1 * CELL)  # top-left of the rock block
ROCK_SHEET = ('rocks-green.png', 3, 2)  # file, columns, rows in the source sheet

# ---------------------------------------------------------------- atlas-strike
#
# 六个平砍族的手绘素材。大件 512、小件 256（小件四张合住 (1,3) 那一格）。
# name -> (source file, column, row) in the 4x4 grid of 512px cells
STRIKE_PLATES = {
    'breathStream': ('breath-stream.png', 2, 2),
    'slashArc': ('slash-arc.png', 0, 0),
    'slashDraw': ('slash-draw2.png', 1, 0),
    'clawMarks': ('claw-marks.png', 2, 0),
    'clawTrail': ('claw-trail.png', 3, 0),
    'arrowTrail': ('arrow-trail.png', 0, 1),
    'arrowHit': ('arrow-hit.png', 1, 1),
    'spearLance': ('spear-lance.png', 2, 1),
    'spearHit': ('spear-hit.png', 3, 1),
    'boltBeam': ('bolt-beam.png', 0, 2),
    'boltHit': ('bolt-hit.png', 1, 2),
    'boltBeam2': ('bolt-beam2.png', 3, 3),
    'breathFlames': ('breath-flames.png', 3, 2),
    'breathScorch': ('breath-scorch.png', 0, 3),
}
# 小件：(源文件, 256 槽在 (1,3) 这格里的 col, row)
STRIKE_SMALL_CELL = (1, 3)
STRIKE_SMALL = {
    'flashWhite': ('flash-white.png', 0, 0),
    'embersCool': ('embers-cool.png', 1, 0),
    'slashSparks': ('slash-sparks.png', 0, 1),
    'boltOrb': ('bolt-orb.png', 1, 1),
}
# 可横向平铺的火流纹理。它**不能**走 _fit_plate：裁 bbox 会切掉左右两端，
# 补 CELL_PAD 会在两端塞黑边，两样都会把"左右无缝"毁掉，滚动时就多一道缝。
# 所以整帧原样缩到槽里（512×256，放 (2,3) 那格的上半），下半留空。
# 代价：这一格不能吃 atlasCell 的 inset 夹取（夹取 = 钳住 u，环绕就没了），
# mip 链在格子左右边界会各串进邻格一点。它左边是 breathStream 的右端（暗）、
# 右边就是图集边缘，而且这一层永远画在 ≤0.55 的 alpha 上，量不出来。
STRIKE_TILE = ('breath-tile.png', 'breathTile', 2, 3, 512, 256)

# 转灰的格子：色相必须由技能主色（学派色）决定。留色的只有火系吐息几张 ——
# 它们本来就该是橙的，兑白之后仍然是火。
STRIKE_KEEP_COLOR = {'breathFlames', 'breathScorch',
                     'breathStream', 'breathTile'}

# -------------------------------------------------------------------- atlas-fb
#
# 第 12 轮加的第三张图集：Effekseer 风格的**序列帧（flipbook）**与带状素材。
# 2048×2048，按 512 的网格切 16 槽：
#
#   (0,0)-(1,1)  impactFb    4×4 / 16 帧，1024²（每帧 256）
#   (2,0)-(3,1)  slashArcFb  4×4 / 16 帧，1024²
#   (0,2) smokeFb  (1,2) fireFb  (2,2) electricFb  (3,2) lightningFb  各 512²
#   (0,3)-(1,3)  swordRibbon 1024×512（刀光带，u 沿长度）
#   (2,3) groundCrack 512²                         (3,3) 空
#
# **不重打 atlas-strike**：那张图是 quality=88 的有损 webp，重编码会让所有
# 格子的纹素整体微抖，已验收的 fireball / execute 差分就不再是 0。
#
# 序列帧格子的 UV 矩形是**整块网格**，行列数在配方里给（ctx.flipbook 的
# frames: {cols, rows}），着色器按 frame 的整数部分切帧、小数部分在相邻两帧
# 之间 mix。所以这里绝对不能走 _fit_plate —— 裁 bbox 会把网格切歪。
FB_IMAGE = ROOT / 'assets/fx2/atlas-fb.webp'
FB_W, FB_H = 2048, 2048
# name -> (源文件, x, y, 宽, 高)。全部按 512 网格对齐。
FB_PLATES = {
    'impactFb':    ('impact-flipbook-4x4.png',          0 * CELL, 0 * CELL, 1024, 1024),
    'slashArcFb':  ('slash-arc-flipbook-4x4.png',       2 * CELL, 0 * CELL, 1024, 1024),
    'smokeFb':     ('smoke-flipbook-4x4.png',           0 * CELL, 2 * CELL, 512, 512),
    'fireFb':      ('fire-flipbook-4x4.png',            1 * CELL, 2 * CELL, 512, 512),
    'electricFb':  ('electric-impact-flipbook-4x4.png', 2 * CELL, 2 * CELL, 512, 512),
    'lightningFb': ('lightning-flipbook-4x4.png',       3 * CELL, 2 * CELL, 512, 512),
    'swordRibbon': ('sword-trail-ribbon.png',           0 * CELL, 3 * CELL, 1024, 512),
    'groundCrack': ('ground-crack-decal.png',           2 * CELL, 3 * CELL, 512, 512),
}
# 留色的格子（火的序列帧本来就是橙红的，转灰再上色只会把它变成一团白火）。
FB_KEEP_COLOR = {'fireFb'}
# 加色素材的"灰底"要在打包时削掉：见 _lift_floor。(floor, gamma, vignette)
FB_LIFT_FLOOR = {'groundCrack': (0.22, 1.35, 0.55)}

# ----------------------------------------------------------------- atlas-spell
#
# 第 13 轮的第四张图集：九个法术技能的序列帧。2048×2048，512 网格 16 槽：
#
#   (0,0)-(1,1)  holyPillar      4×4 / 16 帧，1024²（每帧 256）—— 正视光柱，
#                画到 2.2 倍卡高，是全场最大的一件，值 1024
#   (2,0)-(3,1)  lightningStrike 4×4 / 16 帧，1024²（同上，落雷也画得很高）
#   (0,2) frostBurst  (1,2) frostField  (2,2) healRise   (3,2) shieldHex
#   (0,3) natureBurst (1,3) voidImplode (2,3) siphonOrbs (3,3) arcaneBurst
#                各 512²（每帧 128）
#
# 素材是 RGBA 的：先合成到纯黑底再转灰，这样 alpha 里的形状就变成亮度，
# 和 atlas-fb / atlas-strike 的"加色贴图"约定一致（亮度即覆盖率，alpha=255）。
#
# 这张图**不重打 atlas-slam / atlas-strike / atlas-fb**：那三张都是有损 webp，
# 重编码会让已验收的族整体纹素微抖。
SPELL_IMAGE = ROOT / 'assets/fx2/atlas-spell.webp'
SPELL_W, SPELL_H = 2048, 2048
SPELL_PLATES = {
    'holyPillar':      ('holy-pillar.png',      0 * CELL, 0 * CELL, 1024),
    'lightningStrike': ('lightning-strike.png', 2 * CELL, 0 * CELL, 1024),
    'frostBurst':      ('frost-burst.png',      0 * CELL, 2 * CELL, 512),
    'frostField':      ('frost-field.png',      1 * CELL, 2 * CELL, 512),
    'healRise':        ('heal-rise.png',        2 * CELL, 2 * CELL, 512),
    'shieldHex':       ('shield-hex.png',       3 * CELL, 2 * CELL, 512),
    'natureBurst':     ('nature-burst.png',     0 * CELL, 3 * CELL, 512),
    'voidImplode':     ('void-implode.png',     1 * CELL, 3 * CELL, 512),
    'siphonOrbs':      ('siphon-orbs.png',      2 * CELL, 3 * CELL, 512),
    'arcaneBurst':     ('arcane-burst.png',     3 * CELL, 3 * CELL, 512),
}
# 两张素材的形状外面还挂着一层淡灰底晕。加色渲染下那层灰是实打实的光，
# 画在战场上就是一块发亮的圆斑。按**帧**削掉（不是按整张图 —— 4×4 网格上
# 做全图径向衰减会把外圈的四帧一起压暗）。(floor, gamma)
SPELL_LIFT_FLOOR = {'frostField': (0.12, 1.20), 'shieldHex': (0.14, 1.20)}


def _keyed_rocks(src: Path, work: Path) -> list[Image.Image]:
    """Chroma-key the green-screen sheet, then cut it into individual rocks."""
    keyed = work / 'rocks-rgba.png'
    subprocess.run(
        [sys.executable, str(CHROMA), '--input', str(src), '--out', str(keyed),
         '--key-color', '#00ff00', '--soft-matte',
         '--transparent-threshold', '40', '--opaque-threshold', '110',
         '--edge-contract', '1', '--edge-feather', '1', '--despill', '--force'],
        check=True, stdout=subprocess.DEVNULL)
    sheet = Image.open(keyed).convert('RGBA')
    cols, rows = ROCK_SHEET[1], ROCK_SHEET[2]
    tw, th = sheet.width // cols, sheet.height // rows
    out = []
    for r in range(rows):
        for c in range(cols):
            tile = sheet.crop((c * tw, r * th, (c + 1) * tw, (r + 1) * th))
            box = tile.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            if box is None:
                raise ValueError('Rock tile %d,%d is empty after keying' % (c, r))
            tile = tile.crop(box)
            scale = ROCK_FIT / max(tile.width, tile.height)
            tile = tile.resize(
                (max(1, round(tile.width * scale)), max(1, round(tile.height * scale))),
                Image.LANCZOS)
            out.append(tile)
    return out


def build(src_dir: Path) -> dict:
    atlas = Image.new('RGBA', (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    cells = {}

    for name, (file, col, row) in PLATES.items():
        img = Image.open(src_dir / file).convert('RGB').resize((CELL, CELL), Image.LANCZOS)
        if name in DESATURATE:
            img = img.convert('L').convert('RGB')
        plate = img.convert('RGBA')
        plate.putalpha(255)
        x, y = col * CELL, row * CELL
        atlas.paste(plate, (x, y))
        cells[name] = (x, y, CELL, CELL)

    with tempfile.TemporaryDirectory() as tmp:
        rocks = _keyed_rocks(src_dir / ROCK_SHEET[0], Path(tmp))
    for i, rock in enumerate(rocks):
        sx = ROCK_ORIGIN[0] + (i % 4) * ROCK_SLOT
        sy = ROCK_ORIGIN[1] + (i // 4) * ROCK_SLOT
        ox = sx + (ROCK_SLOT - rock.width) // 2
        oy = sy + (ROCK_SLOT - rock.height) // 2
        atlas.paste(rock, (ox, oy))
        cells['rock%d' % i] = (sx, sy, ROCK_SLOT, ROCK_SLOT)

    OUT_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT_IMAGE, 'WEBP', quality=88, method=6, exact=False)
    return cells


def _fit_plate(img: Image.Image, size: int) -> Image.Image:
    """Crop to the art's own bbox, then aspect-fit it centred into a size² tile.

    The bbox crop is what makes the direction convention exact (see the module
    docstring); the aspect fit is what keeps a horizontal streak horizontal
    once the engine draws the cell as a square quad.
    """
    grey = img.convert('L')
    box = grey.point(lambda v: 255 if v > 10 else 0).getbbox()
    if box is not None:
        img = img.crop(box)
    inner = max(1, round(size * (1 - 2 * CELL_PAD)))
    scale = inner / max(img.width, img.height)
    img = img.resize((max(1, round(img.width * scale)),
                      max(1, round(img.height * scale))), Image.LANCZOS)
    tile = Image.new('RGB', (size, size), (0, 0, 0))
    tile.paste(img, ((size - img.width) // 2, (size - img.height) // 2))
    return tile


def build_strike(src_dir: Path) -> dict:
    atlas = Image.new('RGBA', (STRIKE_W, STRIKE_H), (0, 0, 0, 0))
    cells = {}

    def place(name, file, x, y, size):
        img = Image.open(src_dir / file).convert('RGB')
        tile = _fit_plate(img, size)
        if name not in STRIKE_KEEP_COLOR:
            tile = tile.convert('L').convert('RGB')
        plate = tile.convert('RGBA')
        plate.putalpha(255)
        atlas.paste(plate, (x, y))
        cells[name] = (x, y, size, size)

    for name, (file, col, row) in STRIKE_PLATES.items():
        place(name, file, col * CELL, row * CELL, CELL)
    ox, oy = STRIKE_SMALL_CELL[0] * CELL, STRIKE_SMALL_CELL[1] * CELL
    for name, (file, col, row) in STRIKE_SMALL.items():
        place(name, file, ox + col * SMALL, oy + row * SMALL, SMALL)

    # 平铺纹理：整帧原样缩放，不裁 bbox、不留 padding（见 STRIKE_TILE 的说明）
    file, name, col, row, tw, th = STRIKE_TILE
    img = Image.open(src_dir / file).convert('RGB').resize((tw, th), Image.LANCZOS)
    plate = img.convert('RGBA')
    plate.putalpha(255)
    x, y = col * CELL, row * CELL
    atlas.paste(plate, (x, y))
    cells[name] = (x, y, tw, th)

    STRIKE_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(STRIKE_IMAGE, 'WEBP', quality=88, method=6, exact=False)
    return cells


def _lift_floor(img: Image.Image, floor: float, gamma: float, vignette: float) -> Image.Image:
    """Kill an additive plate's grey floor and its square corners.

    The crack decal's art is a slab of cracked earth: the cracks themselves are
    white, but the slab around them is a mid grey that covers the whole frame.
    Drawn additively (luminance = coverage) that grey is a **visible rectangle
    of light** on the battlefield — measured at 380ms it was the single largest
    thing on screen. So: subtract the floor, renormalise, push with a gamma,
    and multiply by a radial falloff so the frame's corners go to true black.
    """
    import math
    src = img.convert('L')
    w, h = src.size
    px = src.load()
    out = Image.new('L', (w, h))
    op = out.load()
    inv = 1.0 / max(1e-3, 1.0 - floor)
    for y in range(h):
        dy = (y / (h - 1)) * 2 - 1
        for x in range(w):
            v = (px[x, y] / 255.0 - floor) * inv
            if v <= 0:
                op[x, y] = 0
                continue
            dx = (x / (w - 1)) * 2 - 1
            r = math.hypot(dx, dy)
            k = 1.0 if r < vignette else max(0.0, 1.0 - (r - vignette) / max(1e-3, 1.0 - vignette))
            op[x, y] = int(round(255 * min(1.0, v ** gamma) * k * k))
    return out.convert('RGB')


def _lift_floor_grid(img: Image.Image, floor: float, gamma: float) -> Image.Image:
    """_lift_floor 的序列帧版：逐帧削底，不做径向衰减。

    网格素材不能用整张图的径向衰减 —— 那会把外圈的帧整片压暗。序列帧的
    每一帧本来就是居中构图、四角已经是黑的，所以只需要把中间那层灰底晕
    减掉再用 gamma 推一下对比。
    """
    src = img.convert('L')
    import numpy as np
    a = np.asarray(src).astype('float32') / 255.0
    a = np.clip((a - floor) / max(1e-3, 1.0 - floor), 0.0, 1.0) ** gamma
    out = Image.fromarray((a * 255.0 + 0.5).astype('uint8'), 'L')
    return out.convert('RGB')


def build_spell(src_dir: Path) -> dict:
    """Pack atlas-spell: the nine spell skills' flipbook grids."""
    atlas = Image.new('RGBA', (SPELL_W, SPELL_H), (0, 0, 0, 0))
    cells = {}
    for name, (file, x, y, size) in SPELL_PLATES.items():
        img = Image.open(src_dir / file)
        if img.mode == 'RGBA':
            # alpha 合成到纯黑：加色约定下"亮度即覆盖率"
            img = Image.alpha_composite(
                Image.new('RGBA', img.size, (0, 0, 0, 255)), img)
        img = img.convert('RGB')
        if name in SPELL_LIFT_FLOOR:
            img = _lift_floor_grid(img, *SPELL_LIFT_FLOOR[name])
        else:
            img = img.convert('L').convert('RGB')
        if img.size != (size, size):
            img = img.resize((size, size), Image.LANCZOS)
        plate = img.convert('RGBA')
        plate.putalpha(255)
        atlas.paste(plate, (x, y))
        cells[name] = (x, y, size, size)
    SPELL_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(SPELL_IMAGE, 'WEBP', quality=86, method=6, exact=False)
    return cells


def build_fb(src_dir: Path) -> dict:
    """Pack atlas-fb: the flipbook grids, the ribbon strip and the crack decal.

    Everything here follows the additive convention (RGB is the coverage,
    alpha = 255); only fireFb keeps its own hue.
    """
    atlas = Image.new('RGBA', (FB_W, FB_H), (0, 0, 0, 0))
    cells = {}
    for name, (file, x, y, w, h) in FB_PLATES.items():
        img = Image.open(src_dir / file).convert('RGB')
        if name in FB_LIFT_FLOOR:
            img = _lift_floor(img, *FB_LIFT_FLOOR[name])
        if (img.width, img.height) != (w, h):
            img = img.resize((w, h), Image.LANCZOS)
        if name not in FB_KEEP_COLOR:
            img = img.convert('L').convert('RGB')
        plate = img.convert('RGBA')
        plate.putalpha(255)
        atlas.paste(plate, (x, y))
        cells[name] = (x, y, w, h)
    FB_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(FB_IMAGE, 'WEBP', quality=86, method=6, exact=False)
    return cells


def uv_table(cells: dict, w: int, h: int, atlas_id: int) -> dict:
    """Pixel rects -> (u0, v0, u1, v1, atlas), rounded for a stable diff."""
    out = {}
    for name, (x, y, cw, ch) in cells.items():
        out[name] = [round(x / w, 6), round(y / h, 6),
                     round((x + cw) / w, 6), round((y + ch) / h, 6), atlas_id]
    return out


ENTRY_RE = re.compile(r'^\s*(\w+):\s*\[([^\]]*)\],\s*$')


def _read_table(text: str) -> dict:
    """Parse the ATLAS_CELLS block already in the engine, so a partial repack
    (only --src, or only --strike-src) keeps the other atlas's cells."""
    out = {}
    for line in text.splitlines():
        m = ENTRY_RE.match(line)
        if not m:
            continue
        nums = [float(v) for v in m.group(2).split(',')]
        if len(nums) == 4:
            nums.append(0.0)  # 早期只有 atlas-slam 一张图的格子
        out[m.group(1)] = [round(v, 6) for v in nums[:4]] + [int(nums[4])]
    return out


def patch_engine(tables: list) -> None:
    text = ENGINE.read_text()
    begin = '  // >>> ATLAS_CELLS (generated by tools/fx2_atlas.py) >>>\n'
    end = '  // <<< ATLAS_CELLS <<<\n'
    pattern = re.compile(re.escape(begin) + '.*?' + re.escape(end), re.S)
    old = pattern.search(text)
    if not old:
        raise ValueError('ATLAS_CELLS markers missing from src/fx2-engine.js')
    merged = _read_table(old.group(0))
    for table in tables:
        # 重打某一张图集 = 重新定义**这张图集的全部格子**：先把旧表里属于它的
        # 条目整批删掉，再写新的。只 update 不删的话，改名或删掉一张素材之后
        # 旧键会永远留在表里，指向一块已经被别人占用的 UV（breathCone 就是这么
        # 变成 breathStream 的影子的）。另一张图集的格子一个都不动。
        if table:
            atlas_id = next(iter(table.values()))[4]
            merged = {k: v for k, v in merged.items() if v[4] != atlas_id}
        merged.update(table)
    lines = ['  const ATLAS_CELLS = Object.freeze({']
    for name, uv in sorted(merged.items(), key=lambda kv: (kv[1][4], kv[1][1], kv[1][0])):
        lines.append('    %s: [%s],' % (name, ', '.join(repr(v) for v in uv)))
    lines.append('  });\n')
    body = begin + '\n'.join(lines) + end
    ENGINE.write_text(pattern.sub(lambda _: body, text, count=1))


# ------------------------------------------------------------ V2：并掉 atlas-slam
#
# 2026-09-17 的表现层 V2 删掉了一批格子（刀痕残留、电蚀、焦痕、旧版光带/电束/火焰
# 贴图、护盾穹顶），atlas-strike 空出了 8 个 512 格。atlas-slam 剩下还在用的 6 块
# （flash / ringAnnulus / shockwave / dustwave / embers / 碎石块）正好搬进去，片元
# 着色器从 9 个纹理单元回到 WebGL1 保证的 8 个。
#
# 源图早已不在磁盘上，所以这里是**从现有的两张 webp 里按像素搬格子**：slam 的格子
# 与 strike 的格子都是 512×512（slam 是 2048×1024 的 4×2），逐像素拷贝、不缩放，
# 打包时留的 CELL_PAD 原样跟过去。只重编码 atlas-strike 一次（quality 90，alpha 无损）。

# slam 格子名 → atlas-strike 里的目标格（列, 行）。目标格必须是 V2 删掉的那些。
MERGE_SLAM = {
    'flash': (0, 0),         # 原 slashArc（刀痕残留）
    'ringAnnulus': (1, 0),   # 原 slashDraw
    'shockwave': (2, 0),     # 原 clawMarks
    'dustwave': (2, 1),      # 原 spearLance
    'embers': (0, 2),        # 原 boltBeam
    '@rocks': (1, 2),        # 原 boltHit（电蚀残留）；碎石块只占上半格
}
# 搬完之后仍然没人用、清成黑底的 strike 格（省体积）
MERGE_BLANK = [(3, 2), (3, 3)]   # 原 breathFlames / boltBeam2
# 从表里删掉、不再引用的格子（atlas-spell 的 shieldHex 不重编码那张图，只删表项）
MERGE_DROP = {'cracks', 'smoke', 'slashArc', 'slashDraw', 'clawMarks', 'spearLance',
              'boltBeam', 'boltHit', 'breathFlames', 'boltBeam2', 'shieldHex'}
ROCK_BLOCK = (1536, 512, 512, 256)  # atlas-slam 里碎石块的像素矩形


def merge_slam() -> None:
    slam = Image.open(OUT_IMAGE).convert('RGBA')
    strike = Image.open(STRIKE_IMAGE).convert('RGBA')
    text = ENGINE.read_text()
    begin = '  // >>> ATLAS_CELLS (generated by tools/fx2_atlas.py) >>>\n'
    end = '  // <<< ATLAS_CELLS <<<\n'
    block = re.search(re.escape(begin) + '.*?' + re.escape(end), text, re.S)
    table = _read_table(block.group(0))
    before = {'slam': OUT_IMAGE.stat().st_size, 'strike': STRIKE_IMAGE.stat().st_size}
    new = {k: v for k, v in table.items() if k not in MERGE_DROP and v[4] != 0}
    for name, (col, row) in MERGE_SLAM.items():
        dx, dy = col * CELL, row * CELL
        if name == '@rocks':
            x, y, w, h = ROCK_BLOCK
            strike.paste(Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)), (dx, dy))
            strike.paste(slam.crop((x, y, x + w, y + h)), (dx, dy))
            for rock, uv in table.items():
                if not rock.startswith('rock'):
                    continue
                px, py = uv[0] * ATLAS_W - x, uv[1] * ATLAS_H - y
                pw, ph = (uv[2] - uv[0]) * ATLAS_W, (uv[3] - uv[1]) * ATLAS_H
                new[rock] = [round((dx + px) / STRIKE_W, 6), round((dy + py) / STRIKE_H, 6),
                             round((dx + px + pw) / STRIKE_W, 6), round((dy + py + ph) / STRIKE_H, 6), 1]
            continue
        uv = table[name]
        sx, sy = round(uv[0] * ATLAS_W), round(uv[1] * ATLAS_H)
        strike.paste(slam.crop((sx, sy, sx + CELL, sy + CELL)), (dx, dy))
        new[name] = [round(dx / STRIKE_W, 6), round(dy / STRIKE_H, 6),
                     round((dx + CELL) / STRIKE_W, 6), round((dy + CELL) / STRIKE_H, 6), 1]
    for col, row in MERGE_BLANK:
        strike.paste(Image.new('RGBA', (CELL, CELL), (0, 0, 0, 255)), (col * CELL, row * CELL))
    strike.save(STRIKE_IMAGE, 'WEBP', quality=90, method=6, alpha_quality=100)
    OUT_IMAGE.unlink()
    lines = ['  const ATLAS_CELLS = Object.freeze({']
    for name, uv in sorted(new.items(), key=lambda kv: (kv[1][4], kv[1][1], kv[1][0])):
        lines.append('    %s: [%s],' % (name, ', '.join(repr(v) for v in uv)))
    lines.append('  });\n')
    ENGINE.write_text(text.replace(block.group(0), begin + '\n'.join(lines) + end))
    after = STRIKE_IMAGE.stat().st_size
    print(f'atlas-slam  {before["slam"]:,} bytes -> 删除')
    print(f'atlas-strike {before["strike"]:,} -> {after:,} bytes')
    print(f'格子 {len(table)} -> {len(new)}')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--src', help='Folder holding the eight slam source PNGs')
    ap.add_argument('--strike-src', help='Folder holding the 17 strike PNGs')
    ap.add_argument('--fb-src', help='Folder holding the eight flipbook / ribbon PNGs')
    ap.add_argument('--spell-src', help='Folder holding the ten spell flipbook PNGs')
    ap.add_argument('--no-patch', action='store_true', help='Only write the image')
    ap.add_argument('--merge-slam', action='store_true',
                    help='V2: move the still-used atlas-slam cells into atlas-strike and drop atlas-slam')
    args = ap.parse_args()
    if args.merge_slam:
        merge_slam()
        return
    if not args.src and not args.strike_src and not args.fb_src and not args.spell_src:
        ap.error('pass --src and/or --strike-src and/or --fb-src and/or --spell-src')
    tables = []
    if args.src:
        cells = build(Path(args.src).expanduser())
        tables.append(uv_table(cells, ATLAS_W, ATLAS_H, 0))
        size = OUT_IMAGE.stat().st_size
        print(f'{OUT_IMAGE.relative_to(ROOT)}  {ATLAS_W}x{ATLAS_H}  {size:,} bytes')
    if args.strike_src:
        cells = build_strike(Path(args.strike_src).expanduser())
        tables.append(uv_table(cells, STRIKE_W, STRIKE_H, 1))
        size = STRIKE_IMAGE.stat().st_size
        print(f'{STRIKE_IMAGE.relative_to(ROOT)}  {STRIKE_W}x{STRIKE_H}  {size:,} bytes')
    if args.fb_src:
        cells = build_fb(Path(args.fb_src).expanduser())
        tables.append(uv_table(cells, FB_W, FB_H, 2))
        size = FB_IMAGE.stat().st_size
        print(f'{FB_IMAGE.relative_to(ROOT)}  {FB_W}x{FB_H}  {size:,} bytes')
    if args.spell_src:
        cells = build_spell(Path(args.spell_src).expanduser())
        tables.append(uv_table(cells, SPELL_W, SPELL_H, 3))
        size = SPELL_IMAGE.stat().st_size
        print(f'{SPELL_IMAGE.relative_to(ROOT)}  {SPELL_W}x{SPELL_H}  {size:,} bytes')
    if not args.no_patch:
        patch_engine(tables)
    for table in tables:
        print(json.dumps(table, indent=1))


if __name__ == '__main__':
    main()
