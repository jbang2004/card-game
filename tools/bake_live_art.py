"""Bake the layered live artwork (EmberLiveArt) of the selectable heroes and of
the cards that have one.

    uv run --python 3.12 --no-project --with pillow --with numpy --with onnxruntime \
        tools/bake_live_art.py            # every hand-rigged entry in RIGS
        tools/bake_live_art.py oracle     # just this illustration
        tools/bake_live_art.py --auto     # every card without a hand rig
        tools/bake_live_art.py --auto wolf fireball

Hand-rigged entries (RIGS below, motion in src/presentation/live-art-rigs.js) name
their layers and effect masks by hand. Every other card is rigged automatically
(`auto_rig`): the figure is split from the background at a depth threshold found
per image (Otsu), its "core" (the body mass) breathes or floats and its
"periphery" (hair, cloth edges, wings, flames) sways, colour masks pick the glow,
sparkles and metal, and the glow's hue picks the particles. The parameters go to
art/live-art/auto.json and src/live-art-auto.js; the shared motion template is in
src/presentation/live-art.js (`autoRig`). Auto cards are stored at 768x1024 (masks
384x512) since a card's art window is never shown larger.

The card illustration itself is the model: assets/anime/overrides/<id>.png
(1086x1448) is split into three layers -- background, figure, and the prop held
in front (astrolabe, sword, bow, lantern; none for some cards) -- each with its own depth, so a
camera at rest reproduces the card pixel for pixel. Hidden areas behind the
figure and the prop are filled by push-pull interpolation; they only show as
thin slivers when the camera turns.

Writes art/live-art/<id>-{bg,body,front,depth,ctrl,flags}.webp and
src/live-art-maps.js. Maps:
  bg     background colour, figure area filled
  body   figure colour + alpha, prop area filled
  front  prop colour + alpha
  depth  R background, G figure, B prop depth (white = near), half size
  ctrl   R twinkle/flow, G metal glint, B glow mask, half size
  flags  R periphery (sways), G core (breathes), B prop mask (the vertex
         shader keeps the prop rigid with it), half size
Depth comes from Depth Anything V2 Small (see tools/bake_card_relief.py).
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "tools/models/depth-anything-v2-small.onnx"
SOURCE = ROOT / "assets/anime/overrides"
OUT = ROOT / "art/live-art"
REGISTRY = ROOT / "src/live-art-maps.js"
AUTO_PARAMS = OUT / "auto.json"
AUTO_REGISTRY = ROOT / "src/live-art-auto.js"
CARDS = ROOT / "src/content/cards.js"
KINDS = ("bg", "body", "front", "depth", "ctrl", "flags")
HALF = {"depth", "ctrl", "flags"}


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def pushpull(col, w):
    """Fill where the weight w is low from where it is high, coarse to fine."""
    levels = [(col * w[..., None], w)]
    c, a = levels[0]
    while min(a.shape) > 2:
        h, wd = a.shape
        c, a = c[: h // 2 * 2, : wd // 2 * 2], a[: h // 2 * 2, : wd // 2 * 2]
        c = c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2]
        a = a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]
        c = c / np.maximum(a, 1e-6)[..., None] * np.minimum(a, 1)[..., None]
        a = np.minimum(a, 1)
        levels.append((c, a))
    c, a = levels[-1]
    out = c / np.maximum(a, 1e-6)[..., None]
    for c, a in reversed(levels[:-1]):
        h, wd = a.shape
        up = np.stack(
            [np.asarray(Image.fromarray(out[..., i].astype(np.float32), "F").resize((wd, h), Image.BILINEAR))
             for i in range(out.shape[2])], -1)
        out = (c / np.maximum(a, 1e-6)[..., None]) * a[..., None] + up * (1 - a[..., None])
    return out


class Portrait:
    def __init__(self, key, session):
        self.key = key
        src = Image.open(SOURCE / f"{key}.png").convert("RGB")
        self.W, self.H = src.size
        self.rgb = np.asarray(src, np.float32) / 255
        x = np.asarray(src.resize((756, 1008), Image.BICUBIC), np.float32) / 255
        x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None]
        d = session.run(None, {session.get_inputs()[0].name: x.astype(np.float32)})[0].squeeze()
        lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
        d = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)  # inverse depth: 1 = near
        self.depth = np.asarray(Image.fromarray(d, "F").resize(src.size, Image.BICUBIC), np.float32).clip(0, 1)
        self.yy, self.xx = np.mgrid[0 : self.H, 0 : self.W].astype(np.float32)
        self.lum = self.rgb @ np.array([0.299, 0.587, 0.114], np.float32)
        self.sat = self.rgb.max(-1) - self.rgb.min(-1)

    # mask helpers, all in source pixels
    def img(self, m):
        return Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))

    def arr(self, im):
        return np.asarray(im, np.float32) / 255

    def blur(self, m, r):
        return self.arr(self.img(m).filter(ImageFilter.GaussianBlur(r)))

    def erode(self, m, n):
        return self.arr(self.img(m).filter(ImageFilter.MinFilter(n)))

    def dilate(self, m, n):
        return self.arr(self.img(m).filter(ImageFilter.MaxFilter(n)))

    def poly(self, pts):
        m = Image.new("L", (self.W, self.H), 0)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        return self.arr(m)

    def band(self, pts, width):
        m = Image.new("L", (self.W, self.H), 0)
        draw = ImageDraw.Draw(m)
        draw.line(pts, fill=255, width=width, joint="curve")
        for x, y in pts:
            draw.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=255)
        return self.arr(m)

    def ellipse(self, cx, cy, ax, ay, degrees):
        a = np.radians(degrees)
        px, py = self.xx - cx, self.yy - cy
        u = px * np.cos(a) + py * np.sin(a)
        v = -px * np.sin(a) + py * np.cos(a)
        return (np.hypot(u / ax, v / ay) <= 1).astype(np.float32)

    def near(self, region, thr):
        """Pixels of `region` clearly nearer than the surface behind it, which is
        interpolated from the depth just outside the region."""
        ring = self.dilate(region, 41) * (1 - region)
        base = pushpull(self.depth[..., None], ring)[..., 0]
        return region * ss(thr * 0.6, thr, self.depth - base)


# --- per-hero rigs: which pixels are the figure, the held prop, and the effect masks
def oracle(p):
    hand = p.poly([(282, 830), (359, 804), (431, 807), (517, 822), (592, 859), (589, 919),
                   (563, 965), (474, 971), (388, 965), (319, 960), (282, 905)]) * ss(0.52, 0.6, p.depth)
    spike = p.poly([(1006, 457), (1037, 431), (1070, 463), (1049, 496), (1013, 496)]) * ss(0.14, 0.22, p.depth)
    front = np.maximum(np.maximum(p.ellipse(1110.4, 970.6, 476, 691, 101.69), hand), spike)
    return dict(fig=0.18, front=front, ctrl=_oracle_ctrl)


def _oracle_ctrl(p, figure, front, bgk, body):
    fine = p.lum - p.blur(p.lum, 6)
    stars = ss(0.10, 0.28, fine) * ss(0.45, 0.7, p.lum) * bgk
    metal = ss(0.45, 0.8, p.lum) * ss(0.25, 0.08, p.sat) * front
    hair = ss(0.55, 0.8, p.lum) * ss(0.18, 0.08, p.sat) * body * (p.yy < p.H * 0.5)
    return stars, metal, hair


def paladin(p):
    region = p.poly([(280, 172), (362, 172), (378, 262), (382, 420), (350, 470), (482, 498), (484, 645),
                     (425, 655), (428, 1448), (218, 1448), (222, 655), (148, 645), (148, 560), (248, 470),
                     (238, 420), (232, 268)])
    return dict(fig=0.16, front=p.near(region, 0.06), plane=True, ctrl=_paladin_ctrl)


def _paladin_ctrl(p, figure, front, bgk, body):
    halo = (1 - ss(250, 360, np.hypot(p.xx - 482, p.yy - 200))) * ss(0.7, 0.95, p.lum) * ss(0.35, 0.12, p.sat)
    metal = ss(0.55, 0.85, p.lum) * ss(0.22, 0.08, p.sat) * front
    return np.zeros_like(p.lum), metal, halo


def archer(p):
    bow = np.clip(p.band([(708, 0), (756, 97), (804, 241), (828, 402), (836, 531), (828, 595)], 70)
                  + p.band([(804, 756), (796, 901), (756, 1062), (676, 1223), (595, 1367), (547, 1448)], 70), 0, 1)
    hand = p.poly([(740, 560), (900, 560), (925, 700), (880, 760), (760, 760), (735, 700)])
    arrow = np.clip(p.band([(300, 505), (1075, 600)], 40) + p.poly([(940, 560), (1086, 580), (1086, 630), (940, 625)]), 0, 1)
    region = np.clip(bow + hand + arrow, 0, 1)
    wood = ss(0.0, 0.06, p.rgb[..., 0] - p.rgb[..., 1])
    front = np.maximum(p.near(region, 0.07), bow * wood * ss(0.35, 0.5, p.depth))
    return dict(fig=0.18, front=front, ctrl=_archer_ctrl)


def _archer_ctrl(p, figure, front, bgk, body):
    fall = p.poly([(770, 700), (900, 700), (930, 1448), (760, 1448)]) * ss(0.55, 0.8, p.lum) * ss(0.3, 0.12, p.sat) * bgk
    metal = ss(0.55, 0.85, p.lum) * ss(0.22, 0.08, p.sat) * front
    sun = ss(0.7, 0.95, p.lum) * bgk * (1 - fall)
    return fall, metal, sun


def soulguide(p):
    region = p.poly([(760, 665), (862, 665), (872, 780), (912, 850), (918, 1212), (842, 1232), (828, 1312),
                     (788, 1312), (778, 1232), (688, 1202), (688, 850), (738, 790), (752, 740)])
    front = p.erode(p.dilate(p.near(region, 0.08), 15), 15) * region
    # the bridge at the lantern's feet comes toward the camera; it is background, not figure
    floor = p.blur(p.poly([(700, 840), (1086, 840), (1086, 1448), (810, 1448), (780, 1330), (730, 1230), (690, 1150)]), 3)
    return dict(fig=0.18, front=front, plane=True, floor=floor, ctrl=_soulguide_ctrl)


def _soulguide_ctrl(p, figure, front, bgk, body):
    fine = p.lum - p.blur(p.lum, 6)
    motes = ss(0.08, 0.25, fine) * ss(0.55, 0.8, p.lum) * bgk * (p.yy > 700)
    r = np.hypot(p.xx - 830, p.yy - 1000)
    glow = np.maximum(ss(0.75, 0.95, p.lum) * (1 - ss(90, 170, r)), (1 - ss(80, 330, r)) * bgk * ss(0.3, 0.7, p.lum) * 0.6)
    metal = ss(0.55, 0.85, p.lum) * ss(0.2, 0.07, p.sat) * body * (p.yy < 700)
    return motes, metal, glow


def fine_points(p, where):
    """Small bright points (stars, sparkles) inside `where`."""
    return ss(0.08, 0.25, p.lum - p.blur(p.lum, 6)) * ss(0.5, 0.75, p.lum) * where


def jingchen(p):
    return dict(fig=0.18, front=np.zeros_like(p.lum), ctrl=_jingchen_ctrl)


def _jingchen_ctrl(p, figure, front, bgk, body):
    sun = (1 - ss(250, 340, np.hypot(p.xx - 620, p.yy - 120))) * ss(0.45, 0.8, p.lum) * bgk
    gold = ss(0.5, 0.8, p.lum) * ss(0.15, 0.4, p.sat) * (p.rgb[..., 0] > p.rgb[..., 2]) * body
    return fine_points(p, bgk * (1 - sun)), gold, sun


def selmyra(p):
    return dict(fig=0.16, front=np.zeros_like(p.lum), ctrl=_selmyra_ctrl)


def _selmyra_ctrl(p, figure, front, bgk, body):
    corona = ss(0.3, 0.65, p.lum) * bgk * (p.yy < 1000)
    water = fine_points(p, (p.yy > 1230).astype(np.float32))
    silver = ss(0.6, 0.9, p.lum) * ss(0.15, 0.05, p.sat) * body * (p.yy < 600)
    return water, silver, corona


def nyx(p):
    # The staff reads only half apart from the gown in depth; it stays in the figure layer.
    return dict(fig=0.35, front=np.zeros_like(p.lum), ctrl=_nyx_ctrl)


def _nyx_ctrl(p, figure, front, bgk, body):
    stars = (1 - ss(60, 110, np.hypot(p.xx - 240, p.yy - 70))) + (1 - ss(120, 210, np.hypot(p.xx - 760, p.yy - 210)))
    glow = np.clip(stars, 0, 1) * ss(0.5, 0.85, p.lum)
    silver = ss(0.6, 0.9, p.lum) * ss(0.2, 0.07, p.sat) * np.maximum(body, front)
    return fine_points(p, np.ones_like(p.lum)) * (1 - glow), silver, glow


def frostking(p):
    sword = p.poly([(222, 280), (332, 280), (334, 370), (348, 460), (334, 1270), (248, 1270), (242, 460), (212, 420)])
    return dict(fig=0.18, front=p.near(sword, 0.06), plane=True, ctrl=_frostking_ctrl)


def _frostking_ctrl(p, figure, front, bgk, body):
    crown = (1 - ss(70, 120, np.hypot(p.xx - 565, p.yy - 215)))
    ice = ss(0.7, 0.95, p.lum) * ss(0.3, 0.08, p.sat) * np.clip(front + crown, 0, 1)
    blade = front * ss(0.55, 0.85, p.lum)
    return fine_points(p, np.ones_like(p.lum)), ice, blade


def ashdragon(p):
    return dict(fig=0.25, front=np.zeros_like(p.lum), ctrl=_ashdragon_ctrl)


def _ashdragon_ctrl(p, figure, front, bgk, body):
    r, g, b = p.rgb[..., 0], p.rgb[..., 1], p.rgb[..., 2]
    lava = ss(0.4, 0.75, p.lum) * ss(0.3, 0.55, p.sat) * ((r > g) & (g > b))
    return np.zeros_like(p.lum), np.zeros_like(p.lum), lava


def storm(p):
    # The flying debris sits at the depth of the clouds; it moves within the figure layer.
    return dict(fig=0.15, front=np.zeros_like(p.lum), ctrl=_storm_ctrl)


def _storm_ctrl(p, figure, front, bgk, body):
    bolt = ss(0.65, 0.92, p.lum)
    return np.zeros_like(p.lum), np.zeros_like(p.lum), bolt


def otsu(values):
    hist, edges = np.histogram(values, bins=64, range=(0, 1))
    w = hist.astype(np.float64) / hist.sum()
    mids = (edges[:-1] + edges[1:]) / 2
    best, at = -1, 0.2
    for i in range(1, 63):
        w0, w1 = w[:i].sum(), w[i:].sum()
        if w0 < 1e-3 or w1 < 1e-3:
            continue
        between = w0 * w1 * ((w[:i] * mids[:i]).sum() / w0 - (w[i:] * mids[i:]).sum() / w1) ** 2
        if between > best:
            best, at = between, edges[i]
    return float(at)


KIND = {"minion": "creature", "spell": "effect", "weapon": "object"}


def card_types():
    text = CARDS.read_text()
    return dict(re.findall(r'id:\s*"([\w-]+)",[\s\S]*?type:\s*"(\w+)"', text))


# Auto cards that also get a rigid prop layer (a held shield or sword): the prop
# region, in source pixels, kept to what is nearer than the figure behind it.
# Blinking eyes for auto cards are in src/presentation/live-art-rigs.js.
AUTO_PROPS = {
    "solaris": [(651, 383), (765, 350), (912, 407), (920, 912), (863, 960), (765, 960), (667, 912), (635, 684)],
    "moonguard": [(366, 488), (488, 420), (560, 380), (630, 400), (700, 488), (700, 912), (586, 1205), (488, 1205), (374, 912)],
    "aurion": [(140, 440), (340, 440), (345, 600), (290, 780), (430, 800), (430, 915), (290, 930), (290, 1448),
               (140, 1448), (145, 930), (30, 915), (30, 800), (170, 780), (150, 600)],
}


def auto_eyes():
    """Blinking eyes that src/presentation/live-art-rigs.js adds to auto cards."""
    text = (ROOT / "src/presentation/live-art-rigs.js").read_text()
    found = {}
    for key, body in re.findall(r"(\w+): \{ auto: true, eyes: \[(.*?)\] \}", text):
        found[key] = [(float(x), float(y)) for x, y in re.findall(r"c: \[([\d.]+), ([\d.]+)\]", body)]
    return found


def auto_rig(p, key=None):
    thr = otsu(p.depth[::4, ::4].ravel())
    share = (p.depth > thr).mean()
    if not 0.05 < share < 0.85:
        # no clear figure against a background: take the nearer part of the scene
        thr = float(np.percentile(p.depth, 55))
    front = p.near(p.poly(AUTO_PROPS[key]), 0.05) if key in AUTO_PROPS else np.zeros_like(p.lum)
    rig = dict(fig=thr, front=front, plane=key in AUTO_PROPS, ctrl=_auto_ctrl, auto=True)
    eyes = auto_eyes().get(key)
    if eyes:
        # A low-angle figure's head can sit farther back than its body, below the
        # threshold: then it would not breathe with the body (a seam at the neck)
        # and its eyes would not blink. Take in what is about as near as the eyes,
        # within reach of them; sky and halo behind the head stay background.
        ex, ey = np.mean(eyes, 0)
        reach = max(90.0, 3.2 * (np.ptp([e[0] for e in eyes]) if len(eyes) > 1 else 40))
        at = float(np.median([p.depth[int(y), int(x)] for x, y in eyes]))
        rig["head"] = (1 - ss(reach, reach * 1.6, np.hypot(p.xx - ex, (p.yy - ey) * 0.8))) * ss(at - 0.12, at - 0.05, p.depth)
    return rig


def _auto_ctrl(p, figure, front, bgk, body):
    sparkle = fine_points(p, np.ones_like(p.lum))
    metal = ss(0.6, 0.9, p.lum) * ss(0.2, 0.07, p.sat) * body
    # Glow is light that stands out from its surroundings: a bright sky or white
    # robe as a whole would otherwise pulse in blotches.
    local = ss(0.03, 0.14, p.lum - p.blur(p.lum, 24))
    glow = np.maximum(ss(0.55, 0.85, p.lum) * ss(0.3, 0.6, p.sat), ss(0.85, 0.97, p.lum)) * local
    return sparkle, metal, glow


def auto_params(key, p, figure, glow):
    """The numbers the shared motion template needs, in source pixels."""
    solid = figure > 0.5
    ys, xs = np.nonzero(solid[::2, ::2])
    xs, ys = xs * 2, ys * 2
    x0, x1 = np.percentile(xs, [2, 98]) if len(xs) else (0, p.W)
    y0, y1 = np.percentile(ys, [2, 98]) if len(ys) else (0, p.H)
    cx, cy = (float(xs.mean()), float(ys.mean())) if len(xs) else (p.W / 2, p.H / 2)
    # The glow's colour picks the particles: embers, frost, arcane motes or leaves.
    lit = glow > 0.5
    particles = "none"
    if lit.mean() > 0.004:
        r, g, b = (p.rgb[lit] ** 1).mean(0)
        hsv = np.asarray(Image.fromarray((p.rgb * 255).astype(np.uint8)).convert("HSV"), np.float32)[lit]
        ang = hsv[:, 0] / 255 * 2 * np.pi
        weight = hsv[:, 1] / 255 + 1e-3
        hue = (np.degrees(np.arctan2((np.sin(ang) * weight).sum(), (np.cos(ang) * weight).sum())) + 360) % 360
        sat = float(weight.mean())
        if sat < 0.18:
            particles = "frost" if b >= r else "embers"
        elif hue < 55 or hue > 330:
            particles = "embers"
        elif hue < 165:
            particles = "leaves"
        elif hue < 215:
            particles = "frost"
        else:
            particles = "motes"
    return {
        "kind": KIND.get(card_types().get(key), "creature"),
        "box": [round(float(v)) for v in (x0, y0, x1, y1)],
        "centre": [round(cx), round(cy)],
        "particles": particles,
        # a per-card phase so no two cards breathe or sway in step
        "phase": round((sum(map(ord, key)) * 0.6180339) % 1 * 6.2832, 3),
    }


RIGS = {"oracle": oracle, "paladin": paladin, "archer": archer, "soulguide": soulguide,
        "jingchen": jingchen, "selmyra": selmyra, "nyx": nyx, "frostking": frostking,
        "ashdragon": ashdragon, "storm": storm}


def bake(key, session):
    p = Portrait(key, session)
    rig = RIGS[key](p) if key in RIGS else auto_rig(p, key)
    rgb, depth = p.rgb, p.depth
    # Hard silhouettes with a ~1px edge: a wide soft edge shows the filled colour
    # behind it as a pale fringe.
    figure = p.blur((depth > rig["fig"]).astype(np.float32), 0.8)
    if "floor" in rig:
        figure *= 1 - rig["floor"]
    if "head" in rig:
        figure = np.maximum(figure, p.blur((rig["head"] > 0.5).astype(np.float32), 0.8))
    front = p.blur((rig["front"] > 0.5).astype(np.float32), 0.8)
    figure = np.maximum(figure, front)
    body = figure * (1 - front)
    # figure layer: what lies behind the prop is extrapolated from around it
    known = 1 - ss(0.2, 0.8, front)
    pre = np.concatenate([rgb * figure[..., None], figure[..., None]], -1)
    filled = pre * known[..., None] + pushpull(pre, known) * (1 - known[..., None])
    body_a = np.clip(filled[..., 3], 0, 1)
    body_c = np.clip(filled[..., :3] / np.maximum(filled[..., 3:4], 1e-4), 0, 1)
    body_c = rgb * body[..., None] + body_c * (1 - body[..., None])
    body_a = np.maximum(body_a * (1 - known) + figure * known, body)
    # background layer: the figure area (plus a margin) is extrapolated
    bgk = 1 - p.dilate(figure, 7)
    bg = rgb * bgk[..., None] + pushpull(rgb, bgk) * (1 - bgk[..., None])

    def extend(values, where):
        return values * where + pushpull(values[..., None], where)[..., 0] * (1 - where)

    # Each layer's depth comes from well inside it: the depth estimate is soft at
    # silhouettes and would otherwise drag edge pixels toward what lies behind.
    d_bg = extend(depth, p.erode(bgk, 9))
    d_body = extend(depth, p.erode((body > 0.9).astype(np.float32), 13))
    solid = (front > 0.9).astype(np.float32)
    if not solid.any():
        d_front = d_body  # no prop: the layer is empty
    elif rig.get("plane"):
        # A rigid prop (sword, lantern) is one plane; its own estimate is noisy.
        m = solid > 0
        A = np.stack([p.xx[m], p.yy[m], np.ones(m.sum())], 1)
        k = np.linalg.lstsq(A, depth[m], rcond=None)[0]
        d_front = np.clip(k[0] * p.xx + k[1] * p.yy + k[2], 0, 1).astype(np.float32)
    else:
        d_front = p.blur(extend(depth, p.erode(solid, 13)), 6)
    twinkle, metal, glow = rig["ctrl"](p, figure, front, bgk, body)
    # Where the figure breathes (its mass) and where it sways (its edges and thin
    # parts), from the silhouette: worked at quarter size, the erosion is wide.
    small = Image.fromarray((figure * 255).astype(np.uint8)).resize((p.W // 4, p.H // 4), Image.BILINEAR)
    solid = (np.asarray(small, np.float32) / 255 > 0.5).astype(np.float32)
    core_q = np.asarray(p.img(solid).filter(ImageFilter.MinFilter(15)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
    core = np.asarray(Image.fromarray((core_q * 255).astype(np.uint8)).resize((p.W, p.H), Image.BILINEAR), np.float32) / 255
    periphery = p.blur(figure * (1 - ss(0.1, 0.9, core)), 10)
    if rig.get("auto"):
        params = auto_params(key, p, figure, glow)
        store = json.loads(AUTO_PARAMS.read_text()) if AUTO_PARAMS.exists() else {}
        store[key] = params
        AUTO_PARAMS.write_text(json.dumps(dict(sorted(store.items())), indent=1) + "\n")

    OUT.mkdir(parents=True, exist_ok=True)

    # Auto cards are only ever shown in a card's art window: 768 wide is plenty.
    scale = 768 / p.W if rig.get("auto") else 1

    def save(kind, a, mode):
        im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), mode)
        size = (round(p.W * scale), round(p.H * scale))
        if kind in HALF:
            size = (size[0] // 2, size[1] // 2)
        if size != im.size:
            im = im.resize(size, Image.LANCZOS if kind not in HALF else Image.BILINEAR)
        # exact: keep colour under zero alpha (filled areas are revealed by motion)
        im.save(OUT / f"{key}-{kind}.webp", quality=88 if scale == 1 else 84, method=6, exact=True)

    save("bg", bg, "RGB")
    save("body", np.concatenate([body_c, body_a[..., None]], -1), "RGBA")
    save("front", np.concatenate([rgb * (front > 0.004)[..., None], front[..., None]], -1), "RGBA")
    save("depth", np.stack([d_bg, d_body, d_front], -1), "RGB")
    save("ctrl", np.stack([twinkle, metal, glow], -1), "RGB")
    save("flags", np.stack([periphery, core, p.blur(front, 6)], -1), "RGB")
    size = sum((OUT / f"{key}-{k}.webp").stat().st_size for k in KINDS)
    print(f"{key}: {size // 1024} KB")


def write_registry():
    ids = sorted(f.name[: -len("-bg.webp")] for f in OUT.glob("*-bg.webp"))
    maps = {i: {k: f"asset:live-art/{i}-{k}.webp" for k in KINDS} for i in ids}
    REGISTRY.write_text(
        "/* Generated by tools/bake_live_art.py; do not edit. */\n"
        "const EmberLiveArtMaps = Object.freeze(" + json.dumps(maps, indent=2) + ");\n"
        'if (typeof module !== "undefined") module.exports = EmberLiveArtMaps;\n'
    )
    store = json.loads(AUTO_PARAMS.read_text()) if AUTO_PARAMS.exists() else {}
    store = {k: v for k, v in store.items() if k in maps and k not in RIGS}
    AUTO_REGISTRY.write_text(
        "/* Generated by tools/bake_live_art.py --auto; do not edit. Parameters of the\n"
        " * shared motion template (EmberLiveArt autoRig) for cards without a hand rig. */\n"
        "const EmberLiveArtAuto = Object.freeze(" + json.dumps(store, indent=1) + ");\n"
        'if (typeof module !== "undefined") module.exports = EmberLiveArtAuto;\n'
    )


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--auto"]:
        wanted = args[1:] or [i for i in card_types() if i not in RIGS]
    else:
        wanted = args or list(RIGS)
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    for key in wanted:
        bake(key, session)
    write_registry()
