"""Similarity alignment (scale + shift) of the generated figure over the source: FFT cross-correlation of edge maps, then a local search."""
import numpy as np
from PIL import Image, ImageFilter

def gray(a): return a @ np.array([0.299, 0.587, 0.114], np.float32)

def grad(g, r=1.2):
    im = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    a = np.asarray(im, np.float32) / 255
    gy, gx = np.gradient(a)
    return np.hypot(gx, gy)

def coarse(F, S, scales, k=4):
    Sg = grad(gray(S))[::k, ::k]; Fg = grad(gray(F))[::k, ::k]
    H, W = Sg.shape
    FS = np.fft.rfft2(Sg)
    best = (-1, None)
    for s in scales:
        h, w = int(round(Fg.shape[0] * s)), int(round(Fg.shape[1] * s))
        Fs = np.asarray(Image.fromarray(Fg.astype(np.float32), "F").resize((w, h), Image.BILINEAR))
        pad = np.zeros_like(Sg); hh, ww = min(h, H), min(w, W); pad[:hh, :ww] = Fs[:hh, :ww]
        c = np.fft.irfft2(FS * np.conj(np.fft.rfft2(pad)), s=Sg.shape)
        iy, ix = np.unravel_index(np.argmax(c), c.shape)
        v = c[iy, ix] / (np.linalg.norm(pad) * np.linalg.norm(Sg) + 1e-6)
        ty = iy - H if iy > H // 2 else iy
        tx = ix - W if ix > W // 2 else ix
        if v > best[0]: best = (v, (s, tx * k, ty * k))
    return best

def warp(a, s, tx, ty, pad=500):
    """Place `a` scaled by s at (tx, ty) on a canvas of its own size, edge-replicating outside."""
    h, w = a.shape[:2]
    ap = np.pad(a, ((pad, pad), (pad, pad)) + ((0, 0),) * (a.ndim - 2), mode="edge")
    out = []
    chans = [ap] if ap.ndim == 2 else [ap[..., i] for i in range(ap.shape[2])]
    for ch in chans:
        im = Image.fromarray(ch.astype(np.float32), "F")
        t = im.transform((w, h), Image.AFFINE, (1 / s, 0, -tx / s + pad, 0, 1 / s, -ty / s + pad), resample=Image.BILINEAR)
        out.append(np.asarray(t, np.float32))
    return out[0] if len(out) == 1 else np.stack(out, -1)

