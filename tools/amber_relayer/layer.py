"""Re-layer one card illustration with a real figure matte and a painted background plate.

Why: tools/bake_live_art.py splits the figure from the background at a depth threshold, so hair
and the ear beside the face fall into the background, and what lies behind the figure is
push-pull interpolation (a smear). Turning the card then shows a hole next to the face.

Per card, in work/<id>/ (gitignored): source.png (the card illustration, assets/anime/overrides/<id>.png),
plate.png and figure.png from gen.py (the painting without the subject; the subject alone on a flat key colour).
Outputs in work/<id>/out/ (768x1024; depth 384x512): bg.png body.png front.png depth.png + debug images, which
tools/bake_amber_layers.py then turns into art/amber/.

    python3 gen.py <id> plate|figure     # two codex-image calls per card (about a minute each)
    uv run --python 3.12 --no-project --with pillow --with numpy --with onnxruntime python layer.py <id>...

The figure's pixels stay the source's own: the guide only says where the figure is, the plate
says what is behind it, and the matte is refined where source and plate differ. Foreground
colour is then solved with the matting equation S = a*F + (1-a)*P so no background tints the edge.

"""
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORK = HERE / "work"
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(HERE))
import bake_live_art as B  # noqa: E402  (pushpull, ss)
import align as A  # noqa: E402  (similarity alignment of the generated figure)

OUT = HERE
_O = [HERE]
MODEL = ROOT / "tools/models/depth-anything-v2-small.onnx"
SIZE = (768, 1024)


def load(p, size=None):
    im = Image.open(p).convert("RGB")
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im, np.float32) / 255


def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def dil(a, n):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(n | 1)), np.float32) / 255


def ero(a, n):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(n | 1)), np.float32) / 255


def save_rgb(a, name):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(_O[0] / name)


def save_gray(a, name):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "L").save(_O[0] / name)


def shift_to(src, ref, mask, search=24):
    """Translation (dx, dy) that best lines `src` up with `ref` over `mask`, by gradient correlation
    on a coarse grid. Generated edits drift by a few pixels; a rigid shift is all we correct."""
    def grad(a):
        g = a @ np.array([0.299, 0.587, 0.114], np.float32)
        gy, gx = np.gradient(blur(g, 1.5) if g.ndim == 2 else g)
        return np.hypot(gx, gy)
    gs, gr = grad(src), grad(ref)
    k = 4
    gs, gr, m = gs[::k, ::k], gr[::k, ::k], mask[::k, ::k] > 0.5
    best, arg = -1, (0, 0)
    for dy in range(-search // k, search // k + 1):
        for dx in range(-search // k, search // k + 1):
            a = np.roll(np.roll(gs, dy, 0), dx, 1)
            v = (a[m] * gr[m]).sum() / (np.linalg.norm(a[m]) * np.linalg.norm(gr[m]) + 1e-6)
            if v > best:
                best, arg = v, (dx * k, dy * k)
    return arg, best


def shifted(a, dx, dy):
    return np.roll(np.roll(a, dy, 0), dx, 1)


def depth_of(rgb, session):
    x = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).resize((756, 1008), Image.BICUBIC), np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None]
    d = session.run(None, {session.get_inputs()[0].name: x.astype(np.float32)})[0].squeeze()
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)
    H, W = rgb.shape[:2]
    return np.asarray(Image.fromarray(d, "F").resize((W, H), Image.BICUBIC), np.float32).clip(0, 1)




def keyness(F, key):
    """How much each pixel looks like the chroma-key colour (0 = not at all, >0.5 = clearly the backdrop)."""
    if key == "magenta":
        return np.minimum(F[..., 0], F[..., 2]) - F[..., 1]
    return F[..., 1] - np.maximum(F[..., 0], F[..., 2])


def iou(a, b):
    a, b = a > 0.5, b > 0.5
    return float((a & b).sum() / max(1, (a | b).sum()))


def iou_align(G, M, scales, k=6):
    """Scale + shift that best lays the generated silhouette G over the subject mask M (from source-vs-plate), by overlap area."""
    Gs = (G[::k, ::k] > 0.5).astype(np.float32); Ms = (M[::k, ::k] > 0.5).astype(np.float32)
    FM = np.fft.rfft2(Ms); best = (-1, None)
    for s in scales:
        h, w = int(round(Gs.shape[0] * s)), int(round(Gs.shape[1] * s))
        Gr = np.asarray(Image.fromarray(Gs, "F").resize((w, h), Image.BILINEAR))
        pad = np.zeros_like(Ms); hh, ww = min(h, Ms.shape[0]), min(w, Ms.shape[1]); pad[:hh, :ww] = Gr[:hh, :ww]
        c = np.fft.irfft2(FM * np.conj(np.fft.rfft2(pad)), s=Ms.shape)
        u = pad.sum() + Ms.sum() - c; r = c / np.maximum(u, 1)
        iy, ix = np.unravel_index(np.argmax(r), r.shape)
        ty = iy - Ms.shape[0] if iy > Ms.shape[0] // 2 else iy
        tx = ix - Ms.shape[1] if ix > Ms.shape[1] // 2 else ix
        if r[iy, ix] > best[0]: best = (float(r[iy, ix]), (s, tx * k, ty * k))
    return best


def layer(card, key="green"):
    D = WORK / card
    O = D / "out"; O.mkdir(exist_ok=True); _O[0] = O
    S = load(D / "source.png")
    H, W = S.shape[:2]
    P = load(D / "plate.png", (W, H))
    F = load(D / "figure.png", (W, H))
    info = {"card": card}

    # 1. silhouette guide from the key-colour figure
    guide = 1 - B.ss(0.25, 0.75, keyness(F, key))
    save_gray(guide, "dbg_guide.png")

    # 2. the plate must lie over the source outside the subject; find its drift where the two already agree
    P0 = P
    agree = blur(np.abs(S - P0).max(-1), 3.0) < 0.08
    (pdx, pdy), pscore = shift_to(P0, S, agree.astype(np.float32))
    P = shifted(P0, pdx, pdy)
    info["plate_shift"] = [int(pdx), int(pdy), round(float(pscore), 3)]
    diff0 = np.abs(S - P).max(-1)
    M = (B.ss(0.06, 0.16, blur(diff0, 2.0)) > 0.5).astype(np.float32)
    M = dil(ero(M, 7), 11)                      # the subject as seen by source-vs-plate (noisy rim, no thin hair)

    # 3. similarity alignment of the generated figure: edge maps first, then check / replace it by overlap with M
    v, (s0, tx0, ty0) = A.coarse(F, S, np.arange(0.85, 1.451, 0.01))
    Sg = A.grad(A.gray(S)); Fg = A.grad(A.gray(F)); best = (v, (s0, tx0, ty0))
    for ds in (-0.006, -0.003, 0, 0.003, 0.006):
        for dy in range(-8, 9, 2):
            for dx in range(-8, 9, 2):
                Fw = A.warp(Fg, s0 + ds, tx0 + dx, ty0 + dy)
                m = Fw > 0.02
                sc_ = (Fw[m] * Sg[m]).sum() / (np.linalg.norm(Fw[m]) * np.linalg.norm(Sg[m]) + 1e-6)
                if sc_ > best[0]: best = (sc_, (s0 + ds, tx0 + dx, ty0 + dy))
    edge_tf = best[1]
    iou_edge = iou(A.warp(guide.astype(np.float32), *map(float, edge_tf)), M)
    ov, (so, txo, tyo) = iou_align(guide, M, np.arange(0.85, 1.451, 0.01))
    # refine the overlap alignment at half resolution
    bo = (iou(A.warp(guide.astype(np.float32), so, txo, tyo), M), (so, txo, tyo))
    for ds in (-0.008, -0.004, 0, 0.004, 0.008):
        for dy in range(-12, 13, 3):
            for dx in range(-12, 13, 3):
                u = iou(A.warp(guide.astype(np.float32)[::2, ::2], so + ds, (txo + dx) / 2, (tyo + dy) / 2), M[::2, ::2])
                if u > bo[0]: bo = (u, (so + ds, txo + dx, tyo + dy))
    info["align"] = {"edge": [round(float(best[0]), 3), round(iou_edge, 3), [round(float(x), 3) for x in edge_tf]], "overlap": [round(bo[0], 3), [round(float(x), 3) for x in bo[1]]]}
    sc, tx, ty = edge_tf if iou_edge >= bo[0] - 0.02 else bo[1]
    info["align"]["used"] = "edge" if iou_edge >= bo[0] - 0.02 else "overlap"
    guide = A.warp(guide.astype(np.float32), float(sc), float(tx), float(ty))
    save_gray(guide, "dbg_guide_aligned.png"); save_gray(M, "dbg_subject_mask.png")
    away = 1 - dil(guide, 61)

    # 4. match the plate's colours to the source where the two should agree
    far = away > 0.5
    Pm = P.copy()
    for c in range(3):
        a, b = P[..., c][far], S[..., c][far]
        gain = b.std() / max(a.std(), 1e-4)
        Pm[..., c] = np.clip((P[..., c] - a.mean()) * gain + b.mean(), 0, 1)
    diff = np.abs(S - Pm).max(-1)
    save_gray(np.clip(diff * 3, 0, 1), "dbg_diff.png")
    info["plate_diff"] = round(float(diff[far].mean()), 4)

    # 4. the matte: sure inside from the guide, the rest of its rim decided by source-vs-plate
    g = guide > 0.5
    core = ero(g.astype(np.float32), 9) > 0.5
    reach = dil(g.astype(np.float32), 23) > 0.5
    d_s = blur(diff, 1.0)
    rim = B.ss(0.05, 0.16, d_s)
    support = B.ss(0.05, 0.4, blur(dil(g.astype(np.float32), 9), 2.0))
    alpha = np.where(core, 1.0, np.where(reach, rim * support, 0.0)).astype(np.float32)
    live = ((alpha > 0.10) | core).astype(np.float32)
    keep = core.astype(np.float32)
    for _ in range(160):
        nxt = np.minimum(dil(keep, 3), live)
        if np.array_equal(nxt > 0.5, keep > 0.5):
            break
        keep = nxt
    alpha = alpha * blur(keep, 0.8)
    alpha = np.maximum(alpha, blur(core.astype(np.float32), 0.8))
    alpha = blur(alpha, 0.7)
    save_gray(alpha, "dbg_alpha.png")
    info["alpha_area"] = round(float((alpha > 0.5).mean()), 3)

    # 5. foreground colour by the matting equation, then fill under zero alpha for motion
    safe = np.maximum(alpha, 0.04)[..., None]
    Fc = np.clip((S - (1 - alpha)[..., None] * Pm) / safe, 0, 1)
    Fc = np.where((alpha > 0.04)[..., None], Fc, S)
    known = B.ss(0.35, 0.9, alpha)
    body_c = Fc * known[..., None] + B.pushpull(Fc, known) * (1 - known[..., None])
    body_c = np.clip(body_c, 0, 1)

    # 6. background: the source everywhere the figure is not; the generated plate behind the figure
    m = B.ss(0.0, 1.0, blur(dil(alpha, 15), 4.0))
    bg = S * (1 - m[..., None]) + Pm * m[..., None]

    comp = alpha[..., None] * body_c + (1 - alpha)[..., None] * bg
    err = np.abs(comp - S)
    info["rest_err"] = [round(float(err.mean()), 4), round(float(np.percentile(err, 99)), 4)]
    save_gray(np.clip(err.max(-1) * 6, 0, 1), "dbg_rest_error.png")

    # 7. depth: figure from the source, background from the plate (each estimated on its own image)
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    d_src = depth_of(S, session)
    d_plate = depth_of(Pm, session)
    d_body = B.pushpull(d_src[..., None], ero((alpha > 0.9).astype(np.float32), 13))[..., 0]
    d_body = np.where(ero((alpha > 0.9).astype(np.float32), 13) > 0.5, d_src, d_body)
    d_bg = blur(d_plate, 3.0)

    # 8. write at card size
    def rs(a, size, mode=Image.LANCZOS):
        arr = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
        return Image.fromarray(arr).resize(size, mode)

    half = (SIZE[0] // 2, SIZE[1] // 2)
    rs(bg, SIZE).save(O / "bg.png")
    rgba = np.concatenate([body_c, alpha[..., None]], -1)
    pre = rgba.copy(); pre[..., :3] *= pre[..., 3:4]
    chans = [np.asarray(Image.fromarray((np.clip(pre[..., i], 0, 1) * 255 + 0.5).astype(np.uint8)).resize(SIZE, Image.LANCZOS), np.float32) / 255 for i in range(4)]
    a = np.stack(chans, -1)
    col = np.where(a[..., 3:4] > 0.01, a[..., :3] / np.maximum(a[..., 3:4], 1e-4), 0)
    ks = B.ss(0.05, 0.5, a[..., 3])
    col = col * ks[..., None] + B.pushpull(col, ks) * (1 - ks[..., None])
    Image.fromarray((np.clip(np.concatenate([col, a[..., 3:4]], -1), 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(O / "body.png")
    Image.fromarray(np.zeros((SIZE[1], SIZE[0], 4), np.uint8), "RGBA").save(O / "front.png")
    depth = np.stack([d_bg, d_body, d_body], -1)
    rs(depth, half, Image.BILINEAR).save(O / "depth.png")
    save_rgb(comp, "dbg_rest_composite.png")
    import json
    (O / "info.json").write_text(json.dumps(info))
    return info


if __name__ == "__main__":
    import json
    descs = json.load(open(HERE / "descs.json"))
    for card in sys.argv[1:]:
        info = layer(card, descs[card]["key"])
        print(json.dumps(info), flush=True)
