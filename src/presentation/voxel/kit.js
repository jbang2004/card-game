/* EmberVoxelKit — the building blocks every voxel figure is sculpted from (see
 * docs/design/MINIATURES.md): body families (proportion landmarks), a humanoid body with
 * head and fist hands, garment helpers that wrap the body (wrap / bell / skirt / cape),
 * clumped hair strands, props, a quadruped skeleton, and the figure registry. Figures
 * live one per file in presentation/voxel/figures/ and call EmberVoxelKit.define().
 * Pure math over EmberSculpt: runs in the page, a worker or Node. */
(function (root) {
  "use strict";
  const K = root.EmberSculpt || (typeof require !== "undefined" ? require("./sculpt.js") : null);
  const { S, Sculpture, lin, vnoise, fbm, clamp, mix, sstep, rotm, rotY2, smax } = K;
  const TAU = Math.PI * 2;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const lerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const X = (p, s) => [p[0] * s, p[1], p[2]]; // mirror to side s

  // ------------------------------------------------------------ body families
  const FAM = {
    real: {
      heads: 7.2,
      crown: 1.0, cran: [0.047, 0.06, 0.061], cranC: [0, 0.942, -0.008],
      face: [0.037, 0.034, 0.044], faceC: [0, 0.914, 0.008], chinY: 0.862, faceZ: 0.052, eyeY: 0.922, eyeX: 0.0185,
      neck: [0.8, 0.885, 0.0245, 0.0215],
      shX: 0.094, shY: 0.815, delt: 0.029,
      chest: [0.735, 0.074, 0.078, 0.052], bust: [0.715, 0.035, 0.036, 0.031],
      waist: [0.632, 0.056, 0.043], pelvis: [0.553, 0.083, 0.058, 0.056],
      hipX: 0.051, hipY: 0.528, kneeX: 0.052, kneeY: 0.29, ankX: 0.064, ankY: 0.05,
      thigh: [0.056, 0.032], calf: [0.03, 0.036, 0.019], foot: [0.125, 0.028, 0.03],
      upArm: 0.162, foreArm: 0.142, abd: 0.6, armR: [0.028, 0.02, 0.023, 0.016], hand: 1.0,
      earLen: 0.042, eyeScale: 1,
    },
    chunky: {
      heads: 5.2,
      crown: 1.0, cran: [0.07, 0.086, 0.084], cranC: [0, 0.912, -0.012],
      face: [0.058, 0.052, 0.064], faceC: [0, 0.864, 0.008], chinY: 0.79, faceZ: 0.072, eyeY: 0.876, eyeX: 0.0275,
      neck: [0.74, 0.83, 0.034, 0.03],
      shX: 0.13, shY: 0.752, delt: 0.048,
      chest: [0.668, 0.1, 0.09, 0.07], bust: [0.652, 0.046, 0.05, 0.042],
      waist: [0.566, 0.068, 0.054], pelvis: [0.49, 0.1, 0.06, 0.07],
      hipX: 0.062, hipY: 0.466, kneeX: 0.066, kneeY: 0.25, ankX: 0.078, ankY: 0.056,
      thigh: [0.07, 0.042], calf: [0.04, 0.05, 0.03], foot: [0.16, 0.042, 0.04],
      upArm: 0.13, foreArm: 0.13, abd: 0.62, armR: [0.04, 0.03, 0.042, 0.027], hand: 1.55,
      earLen: 0.058, eyeScale: 1.3,
    },
    anime: {
      heads: 6.8,
      crown: 1.0, cran: [0.053, 0.066, 0.06], cranC: [0, 0.934, -0.006],
      face: [0.044, 0.036, 0.045], faceC: [0, 0.9, 0.004], chinY: 0.853, faceZ: 0.049, eyeY: 0.903, eyeX: 0.0205,
      neck: [0.79, 0.872, 0.0195, 0.0175],
      shX: 0.082, shY: 0.804, delt: 0.023,
      chest: [0.728, 0.064, 0.072, 0.047], bust: [0.71, 0.031, 0.032, 0.028],
      waist: [0.636, 0.047, 0.037], pelvis: [0.568, 0.074, 0.052, 0.05],
      hipX: 0.046, hipY: 0.545, kneeX: 0.046, kneeY: 0.3, ankX: 0.056, ankY: 0.045,
      thigh: [0.049, 0.026], calf: [0.025, 0.03, 0.015], foot: [0.105, 0.022, 0.024],
      upArm: 0.16, foreArm: 0.145, abd: 0.58, armR: [0.021, 0.016, 0.018, 0.013], hand: 0.9,
      earLen: 0.048, eyeScale: 1.6,
    },
    chibi: {
      heads: 2.7,
      crown: 1.0, cran: [0.19, 0.17, 0.172], cranC: [0, 0.82, -0.01],
      face: [0.165, 0.12, 0.15], faceC: [0, 0.72, 0.02], chinY: 0.635, faceZ: 0.168, eyeY: 0.745, eyeX: 0.075,
      neck: [0.58, 0.66, 0.036, 0.034],
      shX: 0.105, shY: 0.575, delt: 0.046,
      chest: [0.515, 0.098, 0.075, 0.078], bust: [0.51, 0.04, 0.05, 0.036],
      waist: [0.45, 0.085, 0.072], pelvis: [0.39, 0.1, 0.06, 0.08],
      hipX: 0.055, hipY: 0.37, kneeX: 0.058, kneeY: 0.2, ankX: 0.062, ankY: 0.05,
      thigh: [0.058, 0.046], calf: [0.044, 0.05, 0.038], foot: [0.11, 0.045, 0.045],
      upArm: 0.105, foreArm: 0.1, abd: 0.55, armR: [0.042, 0.036, 0.038, 0.034], hand: 1.9,
      earLen: 0.11, eyeScale: 4,
    },
  };

  // ------------------------------------------------------------ helpers
  function mats(sc, table) { for (const [k, v] of Object.entries(table)) sc.mat(k, Object.assign({}, v, { color: lin(v.c) })); }
  const CLS = { cloth: 0, skin: 1, hair: 2, leather: 3, metal: 4, fur: 5, glow: 6, wood: 7, lips: 8, eye: 9, plant: 10 };
  // arm joints from family params, A-pose
  function armJoints(P, s) {
    const S0 = [s * P.shX, P.shY, -0.004];
    const a = P.abd, a2 = P.abd * 0.92;
    const E = add(S0, [s * Math.sin(a) * P.upArm, -Math.cos(a) * P.upArm, -0.006]);
    const W = add(E, [s * Math.sin(a2) * P.foreArm, -Math.cos(a2) * P.foreArm, 0.012]);
    const dir = norm(sub(W, E));
    return { S: S0, E, W, dir };
  }
  function legJoints(P, s) {
    return { H: [s * P.hipX, P.hipY, 0], K: [s * P.kneeX, P.kneeY, 0.006], A: [s * P.ankX, P.ankY, -0.006] };
  }
  const sideName = (s) => (s > 0 ? "L" : "R");

  // bones shared by every humanoid
  function humanoidBones(sc, P) {
    sc.bone("root", null, 0, P.pelvis[0], 0);
    sc.bone("spine", "root", 0, P.waist[0], 0);
    sc.bone("chest", "spine", 0, P.chest[0] - P.chest[2] * 0.3, 0);
    sc.bone("neck", "chest", 0, P.neck[0], -0.004);
    sc.bone("head", "neck", 0, P.neck[1], 0);
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s);
      sc.bone("clav" + n, "chest", s * 0.018, P.shY - 0.004, 0);
      sc.bone("arm" + n, "clav" + n, ...a.S);
      sc.bone("fore" + n, "arm" + n, ...a.E);
      sc.bone("hand" + n, "fore" + n, ...a.W);
      sc.bone("thigh" + n, "root", ...l.H);
      sc.bone("shin" + n, "thigh" + n, ...l.K);
      sc.bone("foot" + n, "shin" + n, ...l.A);
    }
  }

  // bare body in skin (clothes are added on top as inflated shells)
  function body(sc, P, fam, o = {}) {
    const sk = { mat: "skin" };
    // torso
    sc.add(S.ell(P.pelvis[1], P.pelvis[2], P.pelvis[3]), { ...sk, p: [0, P.pelvis[0], -0.004], bone: "root", k: 0.02 });
    sc.add(S.ell(P.waist[1], (P.chest[0] - P.pelvis[0]) * 0.5, P.waist[2]), { ...sk, p: [0, P.waist[0], 0.002], bone: "spine", k: 0.03, sigma: 0.02 });
    sc.add(S.ell(P.chest[1], P.chest[2], P.chest[3]), { ...sk, p: [0, P.chest[0], -0.004], bone: "chest", k: 0.03, sigma: 0.02 });
    for (const s of [1, -1]) sc.add(S.sphere(P.bust[3]), { ...sk, p: [s * P.bust[1], P.bust[0], P.bust[2] - P.bust[3] * 0.35], bone: "chest", k: 0.018 });
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s);
      // trapezius slope + deltoid
      sc.limb([s * 0.01, P.neck[0] + 0.01, -0.012], add(a.S, [-s * 0.012, 0.014, -0.006]), P.neck[2] * 1.05, P.delt * 0.62, { ...sk, bone: "chest", k: 0.02, sigma: 0.015 });
      sc.add(S.ell(P.delt * 1.02, P.delt * 1.12, P.delt), { ...sk, p: add(a.S, [s * 0.004, -0.006, 0]), bone: "arm" + n, k: 0.016, bones: [["arm" + n, 0.75], ["clav" + n, 0.25]] });
      // arms
      sc.limb(a.S, a.E, P.armR[0], P.armR[1], { ...sk, bone: "arm" + n, k: 0.012 });
      sc.limb(a.E, add(a.E, mul(a.dir, P.foreArm * 0.45)), P.armR[1] * 1.02, P.armR[2], { ...sk, bone: "fore" + n, k: 0.012 });
      sc.limb(add(a.E, mul(a.dir, P.foreArm * 0.4)), a.W, P.armR[2], P.armR[3], { ...sk, bone: "fore" + n, k: 0.014 });
      hand(sc, P, s, a, "skin");
      // legs
      sc.add(S.ell(P.thigh[0] * 0.92, P.thigh[0] * 1.05, P.thigh[0] * 0.9), { ...sk, p: [s * P.hipX * 0.85, P.hipY - P.thigh[0] * 0.2, -P.pelvis[3] * 0.42], bone: "root", bones: [["root", 0.55], ["thigh" + n, 0.45]], k: 0.025 });
      sc.limb(l.H, l.K, P.thigh[0], P.thigh[1], { ...sk, bone: "thigh" + n, k: 0.02, sigma: 0.016 });
      sc.add(S.sphere(P.thigh[1] * 0.75), { ...sk, p: add(l.K, [0, 0.004, P.thigh[1] * 0.5]), bone: "shin" + n, bones: [["shin" + n, 0.5], ["thigh" + n, 0.5]], k: 0.012 });
      sc.limb(l.K, l.A, P.calf[0], P.calf[2], { ...sk, bone: "shin" + n, k: 0.014 });
      sc.add(S.ell(P.calf[1] * 0.85, (l.K[1] - l.A[1]) * 0.26, P.calf[1] * 0.8), { ...sk, p: add(lerp(l.K, l.A, 0.3), [0, 0, -P.calf[1] * 0.25]), bone: "shin" + n, k: 0.02 });
      foot(sc, P, s, l, "skin");
    }
    // neck
    sc.limb([0, P.neck[0], -0.008], [0, P.neck[1], 0.0], P.neck[2], P.neck[3], { ...sk, bone: "neck", k: 0.018, bones: [["neck", 0.8], ["chest", 0.2]] });
    head(sc, P, fam, o);
  }

  // relaxed fist: palm, curled fingers, knuckle ridge, thumb wrapped over (frame: d = forearm, n = palm normal, z = thumb side)
  function handFrame(P, s, a) {
    const d = a.dir, n = norm(cross(d, [0, 0, s])), z = norm(cross(n, d));
    return { d, n, z: s > 0 ? z : mul(z, -1) };
  }
  function hand(sc, P, s, a, mat) {
    const nm = sideName(s), q = P.hand, { d, n, z } = handFrame(P, s, a);
    const at = (u, v, w) => add(a.W, add(mul(d, u * q), add(mul(n, v * q), mul(z, w * q))));
    const bone = "hand" + nm;
    const R = (() => { const zz = z; const xx = n; const yy = d; return [xx[0], yy[0], zz[0], xx[1], yy[1], zz[1], xx[2], yy[2], zz[2]]; })();
    sc.add(S.box(0.0075 * q, 0.0135 * q, 0.0105 * q, 0.0065 * q), { mat, p: at(0.024, 0, 0), R, bone, k: 0.008 });
    sc.add(S.box(0.0085 * q, 0.0085 * q, 0.0105 * q, 0.0065 * q), { mat, p: at(0.047, 0.006, 0.0), R, bone, k: 0.006 });
    sc.limb(at(0.043, -0.005, -0.009), at(0.043, -0.005, 0.009), 0.0068 * q, 0.0062 * q, { mat, bone, k: 0.005 });
    sc.limb(at(0.012, 0.003, 0.011), at(0.036, 0.011, 0.014), 0.0072 * q, 0.0058 * q, { mat, bone, k: 0.006 });
  }
  function foot(sc, P, s, l, mat, inflate = 0) {
    const n = sideName(s), [len, w, h] = P.foot;
    sc.add(S.ell(w + inflate, h * 0.62 + inflate, len * 0.5 + inflate), { mat, p: add(l.A, [0, -l.A[1] + h * 0.55, len * 0.24]), bone: "foot" + n, k: 0.012 });
    sc.add(S.ell(w * 0.85 + inflate, h * 0.7 + inflate, w * 1.1 + inflate), { mat, p: add(l.A, [0, -l.A[1] + h * 0.65, -0.004]), bone: "foot" + n, k: 0.012 });
  }

  // ------------------------------------------------------------ heads
  function head(sc, P, fam, o) {
    const sk = { mat: "skin", bone: "head" };
    const C = P.cranC, ez = P.faceZ, ey = P.eyeY, cy = P.chinY, hh = P.crown - cy, F = P.face, FC = P.faceC;
    sc.add(S.ell(...P.cran), { ...sk, p: C, k: 0.02, sigma: 0.01 });
    if (fam === "chibi") {
      // round skull, soft full cheeks, tiny chin and nose
      sc.add(S.ell(...F), { ...sk, p: FC, k: 0.06 });
      for (const s of [1, -1]) sc.add(S.ell(0.06, 0.05, 0.05), { ...sk, p: [s * 0.085, cy + 0.07, ez - 0.07], k: 0.05 });
      sc.add(S.ell(0.045, 0.03, 0.04), { ...sk, p: [0, cy + 0.028, ez - 0.035], k: 0.05 });
      sc.add(S.sphere(0.007), { ...sk, p: [0, ey - 0.05, ez + 0.004], k: 0.012 });
    } else {
      const jw = { real: 0.74, chunky: 0.9, anime: 0.72 }[fam];
      // midface (cheeks, eye region)
      sc.add(S.ell(...F), { ...sk, p: FC, k: 0.022 });
      // lower face: egg taper from the cheeks to a small chin
      const top = [0, FC[1] - F[1] * 0.2, FC[2] - F[2] * 0.12], bot = [0, cy + hh * 0.075, ez - hh * (fam === "anime" ? 0.1 : 0.12)];
      sc.limb(top, bot, F[0] * jw, hh * (fam === "chunky" ? 0.09 : fam === "anime" ? 0.052 : 0.058), { ...sk, k: 0.018, sz: 0.8 });
      sc.add(S.ell(hh * (fam === "chunky" ? 0.1 : 0.062), hh * 0.055, hh * 0.058), { ...sk, p: [0, cy + hh * 0.055, ez - hh * (fam === "anime" ? 0.09 : 0.1)], k: 0.012 });
      if (fam !== "anime") for (const s of [1, -1]) {
        sc.add(S.ell(hh * 0.075, hh * 0.045, hh * 0.055), { ...sk, p: [s * F[0] * 0.64, ey - hh * 0.085, ez - hh * 0.13], k: 0.016, feat: true }); // cheekbone
        if (fam === "chunky") sc.limb([s * P.eyeX * 1.75, ey + hh * 0.085, ez - hh * 0.11], [s * 0.003, ey + hh * 0.09, ez - hh * 0.04], hh * 0.05, hh * 0.035, { ...sk, k: 0.012, feat: true }); // brow ridge
        sc.add(S.ell(P.eyeX * 0.62, hh * 0.032, hh * 0.05), { ...sk, op: "sub", p: [s * P.eyeX, ey + hh * 0.012, ez + hh * 0.02], k: 0.01, feat: true }); // shallow socket
      } else for (const s of [1, -1]) sc.add(S.ell(P.eyeX * 0.8, hh * 0.06, hh * 0.05), { ...sk, op: "sub", p: [s * P.eyeX, ey, ez + hh * 0.03], k: 0.012, feat: true });
      // nose: narrow bridge, small tip, tucked nostrils (features are mostly painted)
      if (fam === "anime") sc.limb([0, ey - hh * 0.06, ez - hh * 0.02], [0, ey - hh * 0.155, ez + hh * 0.028], hh * 0.012, hh * 0.018, { ...sk, k: 0.006, feat: true });
      else {
        const b = fam === "chunky" ? 0.95 : 1;
        // slim straight bridge, small soft tip, barely-there nostril wings
        sc.limb([0, ey + hh * 0.0, ez - hh * 0.055], [0, ey - hh * 0.145 * b, ez + hh * 0.004 * b], hh * 0.0085 * b, hh * 0.013 * b, { ...sk, k: 0.01, feat: true });
        sc.add(S.sphere(hh * 0.017 * b), { ...sk, p: [0, ey - hh * 0.152 * b, ez - hh * 0.002 * b], k: 0.009, feat: true });
        for (const s of [1, -1]) sc.add(S.sphere(hh * 0.01 * b), { ...sk, p: [s * hh * 0.02 * b, ey - hh * 0.157 * b, ez - hh * 0.024], k: 0.01, feat: true });
        const my = cy + (ey - cy) * 0.31;
        sc.add(S.ell(hh * 0.04 * b, hh * 0.014, hh * 0.014), { mat: "lips", bone: "head", p: [0, my - hh * 0.016, ez - hh * 0.062], k: 0.006, cs: 0.4, feat: true });
      }
    }
    // pointed elf ears, swept up and back
    if (o.elf !== false) for (const s of [1, -1]) {
      const base = [s * (P.cran[0] * 0.9), ey - (fam === "chibi" ? 0.03 : hh * 0.06), C[2] - P.cran[2] * 0.12];
      const L = P.earLen, tip = add(base, [s * L * 0.5, L * 0.7, -L * 0.55]);
      sc.limb(base, tip, fam === "chibi" ? 0.03 : fam === "chunky" ? 0.015 : 0.011, 0.0016, { ...sk, k: 0.008, sx: 0.42, vdil: 0.6 });
      sc.add(S.ell(0.0035, L * 0.28, L * 0.1), { ...sk, op: "sub", p: add(lerp(base, tip, 0.35), [s * 0.005, 0, 0.004]), R: rotY2(...sub(tip, base)), k: 0.004, cut: "skinDeep", feat: true });
    }
    const fh = (ey - cy) * (fam === "chibi" ? 1.2 : 1.35);
    sc.face({ bone: "head", cls: [1, 8], c: [0, ey - (ey - cy) * 0.28, ez], size: [F[0] * (fam === "chibi" ? 0.95 : 1.1), fh], depth: fam === "chibi" ? 0.12 : 0.045, nz: 0.1 });
  }

  // ------------------------------------------------------------ garment helpers
  // regions (model space) for wraps
  const RG = {
    box: (x0, x1, y0, y1, z0 = -0.4, z1 = 0.4) => S.custom((x, y, z) => Math.max(x0 - x, x - x1, y0 - y, y - y1, z0 - z, z - z1), [x0, y0, z0, x1, y1, z1]),
    // cylinder around segment a→b with flat caps
    seg(a, b, r) {
      const ab = sub(b, a), L = Math.hypot(...ab), d = mul(ab, 1 / L);
      const mn = [0, 1, 2].map((i) => Math.min(a[i], b[i]) - r), mx = [0, 1, 2].map((i) => Math.max(a[i], b[i]) + r);
      return S.custom((x, y, z) => {
        const px = x - a[0], py = y - a[1], pz = z - a[2], t = px * d[0] + py * d[1] + pz * d[2];
        return Math.max(Math.hypot(px - d[0] * t, py - d[1] * t, pz - d[2] * t) - r, -t, t - L);
      }, [...mn, ...mx]);
    },
    ball: (c, r) => S.custom((x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r]),
    // band |dist to plane through p with normal n| < w, clipped by a box
    band(p, n, w, clip) {
      const nn = norm(n);
      return S.custom((x, y, z) => Math.max(Math.abs((x - p[0]) * nn[0] + (y - p[1]) * nn[1] + (z - p[2]) * nn[2]) - w, clip.f(x, y, z)), clip.b);
    },
    or: (...rs) => rs.reduce((a, b) => S.union(a, b, 0)),
    minus: (a, b) => S.minus(a, b, 0),
  };
  const wrap = (sc, region, mat, t, o = {}) => sc.wrap(region, Object.assign({ mat, t, p: [0, 0, 0], bone: "root" }, o));

  /* bell: open shell hanging from y0 (radius r0) to y1 (radius r1) with a fast
   * outward profile (capelets, mantles); folds; front slit optional */
  function bell(sc, y0, y1, r0, r1, mat, o = {}) {
    const h = y0 - y1, t = o.t || 0.0065, sz = o.sz || 0.8, folds = o.folds || 10, amp = o.amp || 0.004, pw = o.pw || 0.35, zc = o.z || 0;
    const f = (x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, pw));
      const a = Math.atan2(z / sz, x);
      const rr = Math.hypot(x, z / sz) - r - amp * u * Math.sin(a * folds + 0.4);
      let dd = smax(Math.abs(rr) - t, Math.max(-y - h, y), t * 0.9);
      if (o.slit && z > 0) dd = Math.max(dd, o.slit * (0.25 + u) - Math.abs(x));
      return dd;
    };
    const R = Math.max(r0, r1) + amp + t;
    return sc.add(S.custom(f, [-R, -h, -R * sz, R, 0, R * sz]), { mat, p: [0, y0, zc], bone: o.bone || "chest", k: o.k ?? 0.004, cs: 0.03, wg: o.wg || 2, bones: o.bones || null });
  }

  // skirt: flared cone shell with folds; weights from pelvis to thighs
  function skirt(sc, P, y0, y1, r0, r1, mat, o = {}) {
    const h = y0 - y1, folds = o.folds || 9, amp = o.amp || 0.006, t = o.t || 0.005, sz = o.sz || 0.85;
    const f = (x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.8));
      const a = Math.atan2(z / sz, x);
      const rr = Math.hypot(x, z / sz) - r - amp * u * Math.sin(a * folds + 0.6);
      const band = Math.max(-y - h, y);
      return smax(Math.abs(rr) - t, band, t * 0.9);
    };
    const R = Math.max(r0, r1) + amp + t;
    const p = sc.add(S.custom(f, [-R, -h, -R * sz, R, 0, R * sz]), { mat, p: [0, y0, o.z || 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    p.wfn = (x, y, z) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.7, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    return p;
  }

  // cape hanging behind the shoulders to height yb; folds; bones cape1/2 L/R
  function cape(sc, P, yTop, yb, wTop, wBot, mat, o = {}) {
    const zT = o.zTop ?? -P.chest[3] - 0.014, zB = o.zBot ?? zT - 0.07, h = yTop - yb, t = o.t || 0.0065, folds = o.folds || 7, amp = o.amp || 0.01;
    const f = (x, y, z) => {
      const u = clamp((yTop - y) / h, 0, 1);
      const w = mix(wTop, wBot, Math.pow(u, 0.8));
      const zc = mix(zT, zB, u) - amp * Math.sin((x / w) * folds * 1.57 + 0.5) * (0.25 + u);
      const curve = (0.9 - 0.4 * u) * (x * x) / Math.max(w, 1e-3);
      const dz = z - (zc + curve);
      const side = Math.abs(x) - w;
      const band = Math.max(y - yTop, yb - y);
      return smax(Math.abs(dz) - t, Math.max(side, band), t * 0.9);
    };
    const W = Math.max(wTop, wBot) + 0.02;
    const pr = sc.add(S.custom(f, [-W, yb, Math.min(zT, zB) - amp * 2 - 0.02, W, yTop, Math.max(zT, zB) + 0.9 * W + 0.02]), { mat, p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    pr.wfn = (x, y, z) => {
      const u = clamp((yTop - y) / h, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    return pr;
  }
  function capeBones(sc, P, yTop, yb, z) {
    for (const s of [1, -1]) {
      const n = sideName(s);
      sc.bone("cape1" + n, "chest", s * 0.03, yTop - 0.02, z);
      sc.bone("cape2" + n, "cape1" + n, s * 0.05, mix(yTop, yb, 0.45), z - 0.03);
    }
  }

  // hair lock: quadratic bezier from root to tip with optional S-wave, grooves along the strands
  function lock(sc, A, B, C, r0, r1, o = {}) {
    const pts = [], N = o.n || 16, wv = o.wave || 0, wd = o.waveDir || [1, 0, 0];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      let p = [u * u * A[0] + 2 * u * t * B[0] + t * t * C[0], u * u * A[1] + 2 * u * t * B[1] + t * t * C[1], u * u * A[2] + 2 * u * t * B[2] + t * t * C[2]];
      if (wv) p = add(p, mul(wd, wv * Math.sin(t * Math.PI * (o.waves || 2) + (o.phase || 0)) * Math.min(1, t * 2.5)));
      const r = mix(r0, r1, Math.pow(t, o.taper || 1.3)) * (o.swell ? 1 + o.swell * Math.sin(Math.PI * Math.min(1, t * 1.6)) : 1);
      pts.push([p[0], p[1], p[2], r]);
    }
    const grooves = o.grooves ?? 0.0022, gf = o.gf ?? 150;
    return sc.add(S.chain(pts, o.flat || 1), {
      mat: o.mat || "hair", p: [0, 0, 0], bone: o.bone || "head", k: o.k ?? 0.009, cs: 0.05, wg: o.wg || 0, sigma: 0.01,
      disp: grooves ? (x, y, z) => grooves * (0.5 + 0.5 * vnoise(x * gf, y * gf * 0.1, z * gf)) : null, dispAmp: grooves,
    });
  }
  const cuff = (sc, p, d, r, hh, mat, bone) => sc.add(S.cyl(hh, r, Math.min(hh, 0.003)), { mat, p, R: rotY2(...d), bone, k: 0.003, cs: 0.02 });

  // ------------------------------------------------------------ hair (clumped strands)
  // Catmull-Rom through control points → [[x,y,z], ...]
  function spline(ctrl, n) {
    const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * (ctrl.length - 1), k = Math.min(Math.floor(t), ctrl.length - 2), u = t - k;
      const p0 = P[k], p1 = P[k + 1], p2 = P[k + 2], p3 = P[k + 3];
      out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u * u * u)));
    }
    return out;
  }
  /* one strand clump: ctrl points, root radius → tip radius; wave across `wd`;
   * o.flat squashes the section along o.flatN (e.g. the scalp normal) */
  function strand(sc, ctrl, r0, r1, o = {}) {
    const pts = spline(ctrl, o.n || 18);
    const wv = o.wave || 0, wd = o.wd || [1, 0, 0];
    const pr = pts.map((p, i) => {
      const t = i / (pts.length - 1);
      const w = wv ? mul(wd, wv * Math.sin(t * Math.PI * (o.waves || 2) + (o.phase || 0)) * sstep(0, 0.35, t)) : [0, 0, 0];
      const r = mix(r0, r1, Math.pow(t, o.taper || 1.6)) * (1 + (o.swell || 0) * Math.sin(Math.PI * Math.min(1, t * 1.5)));
      return [p[0] + w[0], p[1] + w[1], p[2] + w[2], r];
    });
    const g = o.grooves ?? 0.0012, gf = o.gf ?? 260;
    return sc.add(S.chain(pr), {
      mat: o.mat || "hair", p: [0, 0, 0], bone: o.bone || "head", k: o.k ?? 0.01, cs: 0.05, wg: o.wg || 0, sigma: 0.01,
      disp: g ? (x, y, z) => g * vnoise(x * gf, y * gf * 0.12, z * gf) : null, dispAmp: g,
    });
  }
  // point on an ellipsoid (centre c, radii r) at spherical angles: az around Y from +Z, el up from the equator
  const onEll = (c, r, az, el, k = 1) => [c[0] + r[0] * k * Math.sin(az) * Math.cos(el), c[1] + r[1] * k * Math.sin(el), c[2] + r[2] * k * Math.cos(az) * Math.cos(el)];


  function chibiHair(sc, P, who) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.006, -0.006]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.07, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.9, cr[1] * 0.74, cr[2] * 0.7), 0, -cr[1] * 0.5, cr[2] * 0.66), 0.03), { mat: "hair", p: C, bone: "head", k: 0.01 });
    const long = who === "vesper";
    if (long) {
      const back = sc.add(S.ell(R[0] * 1.02, R[1] * 0.95, R[2] * 0.72), { mat: "hair", p: add(C, [0, -R[1] * 0.42, -R[2] * 0.42]), bone: "head", k: 0.04, wg: 5 });
      back.wfn = (x, y) => { const t = sstep(C[1], C[1] - R[1] * 1.3, y); return [["head", 1 - t * 0.6], ["hairB1", t * 0.6]]; };
      for (let i = 0; i < 7; i++) {
        const u = (i / 6) * 2 - 1, az = Math.PI + u * 1.35;
        const root = onEll(C, R, az, -0.35, 1.0), tip = add(onEll(C, R, az, -1.05, 1.08), [0, -0.05 - 0.03 * (1 - Math.abs(u)), -0.02]);
        const sp = strand(sc, [root, lerp(root, tip, 0.5), tip], 0.045, 0.006, { k: 0.03, bone: "hairB1", wg: 5, taper: 1.2, grooves: 0.002, gf: 90 });
        sp.wfn = back.wfn;
      }
    }
    // bangs: big pointed locks from the crown over the forehead
    const nb = 6;
    for (let i = 0; i < nb; i++) {
      const u = (i / (nb - 1)) * 2 - 1, sw = who === "huntress" ? 0.35 : 0;
      const root = [0.01 * u, C[1] + R[1] * 0.78, C[2] + R[2] * 0.45];
      const mid = [R[0] * (0.45 * u + sw * 0.2), C[1] + R[1] * 0.45, C[2] + R[2] * 0.98];
      const tip = [R[0] * (0.62 * u + sw * 0.25), ey + 0.07 - 0.03 * Math.abs(u), P.faceZ + 0.012 - 0.03 * Math.abs(u)];
      strand(sc, [root, mid, tip], 0.042, 0.004, { k: 0.025, taper: 1.1, grooves: 0.002, gf: 90 });
    }
    // side locks hugging the cheeks
    for (const s of [1, -1]) {
      const n = sideName(s);
      const root = onEll(C, R, s * 1.2, 0.15, 0.98);
      const a = [s * R[0] * 0.98, ey - 0.02, C[2] + R[2] * 0.42], tip = [s * R[0] * (long ? 0.85 : 0.75), P.chinY - (long ? 0.06 : 0.1), C[2] + R[2] * 0.5];
      const sp = strand(sc, [root, a, tip], 0.04, 0.007, { k: 0.025, bone: who === "huntress" ? "hair" + n : "head", wg: 4, taper: 1.2, grooves: 0.002, gf: 90 });
      if (who === "huntress") sp.wfn = (x, y) => { const t = sstep(ey, P.chinY - 0.1, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
    if (long) sc.add(S.custom((x, y, z) => { const u = clamp((y + 0.018) / 0.036, 0, 1), w = 0.009 * Math.sin(Math.PI * u); return Math.max(Math.abs(z) - w, Math.abs(x) - 0.0025, -(y + 0.018), y - 0.018); }, [-0.003, -0.018, -0.01, 0.003, 0.018, 0.01]),
      { mat: "leaf", p: onEll(C, R, 1.5, 0.55, 1.03), r: [0.9, 0.2, -0.5], s: 2.6, bone: "head", k: 0.002 });
  }


  // ------------------------------------------------------------ props
  function spearProp(fam) {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      wood: { c: 0x6b4325, rough: 0.7, cls: CLS.wood, vary: 0.12 }, steel: { c: 0xcfd7dc, rough: 0.28, metal: 1, cls: CLS.metal },
      gold: { c: 0xc9a352, rough: 0.35, metal: 1, cls: CLS.metal }, leaf: { c: 0x76a843, rough: 0.6, cls: CLS.plant }, wrap: { c: 0x3a2214, rough: 0.8, cls: CLS.leather },
    });
    const Lf = fam === "chibi" ? 0.8 : fam === "chunky" ? 0.92 : 1.05, R = fam === "chibi" ? 0.013 : fam === "chunky" ? 0.011 : 0.0085;
    // shaft along +Y centred at the grip (0)
    sc.limb([0, -Lf * 0.42, 0], [0, Lf * 0.5, 0], R * 1.05, R * 0.9, { mat: "wood", bone: "p", k: 0.002 });
    for (const y of [-0.02, 0.02]) sc.add(S.cyl(0.018, R * 1.35, 0.003), { mat: "wrap", p: [0, y, 0], bone: "p", k: 0.002 });
    const top = Lf * 0.5;
    sc.add(S.cyl(0.012, R * 1.6, 0.003), { mat: "gold", p: [0, top, 0], bone: "p", k: 0.002 });
    // leaf-shaped blade (flattened in z)
    const bl = fam === "chibi" ? 0.13 : 0.16, bw = fam === "chibi" ? 0.034 : 0.028;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / bl, 0, 1), w = bw * Math.sin(Math.PI * Math.pow(u, 0.75)) * (1 - 0.15 * u);
      const dx = Math.abs(x) - w, dz = Math.abs(z) - (0.004 * (1 - u) + 0.0008) * (1 - Math.abs(x) / (w + 1e-4) * 0.7);
      return Math.max(dx * 0.8, dz, -y, y - bl);
    }, [-bw, 0, -0.006, bw, bl, 0.006]);
    sc.add(blade, { mat: "steel", p: [0, top + 0.01, 0], bone: "p", k: 0.001 });
    // leaf ornaments under the blade
    for (const s of [1, -1]) {
      const lf = S.custom((x, y, z) => { const u = clamp(y / 0.07, 0, 1), w = 0.013 * Math.sin(Math.PI * u); return Math.max(Math.abs(x) - w, Math.abs(z) - 0.0022, -y, y - 0.07); }, [-0.014, 0, -0.003, 0.014, 0.07, 0.003]);
      sc.add(lf, { mat: "leaf", p: [s * 0.012, top - 0.005, 0.004], r: [0.3, 0, s * 2.5], bone: "p", k: 0.002 });
    }
    return sc;
  }
  function bowProp(fam) {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      wood: { c: 0x7a5232, rough: 0.55, cls: CLS.wood, vary: 0.12, pattern: (x, y, z, nx, ny, nz, c) => { const g = 0.85 + 0.15 * Math.sin(y * 420 + 6 * vnoise(x * 80, y * 20, z * 80)); c[0] *= g; c[1] *= g; c[2] *= g; } },
      grip: { c: 0x3a2618, rough: 0.8, cls: CLS.leather }, brass: { c: 0xb08d57, rough: 0.35, metal: 1, cls: CLS.metal }, leaf: { c: 0x6f9a3c, rough: 0.6, cls: CLS.plant },
      string: { c: 0xe8e0c8, rough: 0.6, cls: CLS.cloth },
    });
    const L = fam === "chibi" ? 0.26 : fam === "chunky" ? 0.3 : 0.33, t = fam === "chibi" ? 0.012 : 0.0085;
    // recurve limbs in the YZ plane (bow faces +Z): belly curves forward, tips flick back
    for (const s of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, y = s * (0.03 + u * L);
        const z = -0.05 * Math.sin(u * Math.PI * 0.9) + 0.035 * sstep(0.78, 1, u);
        pts.push([0, y, z + 0.02, mix(t, t * 0.45, u)]);
      }
      sc.add(S.chain(pts, 1), { mat: "wood", p: [0, 0, 0], bone: "p", k: 0.004 });
      sc.add(S.sphere(t * 0.7), { mat: "brass", p: [0, s * (0.03 + L), 0.055], bone: "p", k: 0.002 });
      const lf = S.custom((x, y, z) => { const u = clamp(y / 0.05, 0, 1), w = 0.01 * Math.sin(Math.PI * u); return Math.max(Math.abs(z) - w, Math.abs(x) - 0.0022, -y, y - 0.05); }, [-0.003, 0, -0.011, 0.003, 0.05, 0.011]);
      sc.add(lf, { mat: "leaf", p: [0.004, s * 0.05, 0.005], r: [s > 0 ? -0.4 : Math.PI + 0.4, 0, 0], bone: "p", k: 0.002 });
    }
    sc.limb([0, -0.035, 0.022], [0, 0.035, 0.022], t * 1.3, t * 1.3, { mat: "grip", bone: "p", k: 0.004 });
    // string
    sc.limb([0, -(0.03 + L), 0.052], [0, 0.03 + L, 0.052], 0.0016, 0.0016, { mat: "string", bone: "p", k: 0.0005 });
    return sc;
  }
  function quiverProp(fam) {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      leather: { c: 0x5a3822, rough: 0.7, cls: CLS.leather, vary: 0.1 }, trim: { c: 0x3a2416, rough: 0.8, cls: CLS.leather }, brass: { c: 0xb08d57, rough: 0.35, metal: 1, cls: CLS.metal },
      shaft: { c: 0x8a6a44, rough: 0.7, cls: CLS.wood }, fletch: { c: 0xe8e2d2, rough: 0.8, cls: CLS.cloth }, fletch2: { c: 0x3f6b35, rough: 0.8, cls: CLS.cloth },
    });
    const L = fam === "chibi" ? 0.2 : 0.26, r = fam === "chibi" ? 0.03 : 0.024;
    sc.limb([0, -L / 2, 0], [0, L / 2, 0], r * 0.85, r, { mat: "leather", bone: "p", k: 0.004 });
    for (const y of [-L / 2 + 0.01, L / 2 - 0.006]) sc.add(S.torus(r * (y > 0 ? 1.02 : 0.88), 0.0035), { mat: "trim", p: [0, y, 0], bone: "p", k: 0.002 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, px = Math.cos(a) * r * 0.5, pz = Math.sin(a) * r * 0.5;
      sc.limb([px, L / 2 - 0.02, pz], [px * 1.2, L / 2 + 0.03, pz * 1.2], 0.0025, 0.0025, { mat: "shaft", bone: "p", k: 0.001 });
      sc.add(S.box(0.0012, 0.022, 0.007, 0.001), { mat: i % 2 ? "fletch" : "fletch2", p: [px * 1.25, L / 2 + 0.05, pz * 1.25], r: [0, a, 0], bone: "p", k: 0.001 });
    }
    return sc;
  }


  // ------------------------------------------------------------ quadrupeds
  const QF = {
    // wolf pup: big head, big paws, fluffy
    wolf: {
      real: { s: 1, head: 1, paw: 1, leg: 1, fluff: 1, eye: 1 },
      chunky: { s: 1, head: 1.25, paw: 1.35, leg: 0.85, fluff: 1.2, eye: 1.2 },
      anime: { s: 1, head: 1.1, paw: 1.05, leg: 1.05, fluff: 1.1, eye: 1.3 },
      chibi: { s: 1, head: 1.7, paw: 1.4, leg: 0.7, fluff: 1, eye: 1.8 },
    },
    stag: {
      real: { s: 1, head: 1, leg: 1, eye: 1, antler: 1 },
      chunky: { s: 1, head: 1.25, leg: 0.8, eye: 1.2, antler: 1.1 },
      anime: { s: 1, head: 1.05, leg: 1.1, eye: 1.2, antler: 1.05 },
      chibi: { s: 1, head: 1.7, leg: 0.6, eye: 1.8, antler: 0.9 },
    },
  };
  function quadBones(sc, G) {
    sc.bone("root", null, ...G.root);
    sc.bone("spine", "root", ...G.spine);
    sc.bone("chest", "spine", ...G.chest);
    sc.bone("neck", "chest", ...G.neck);
    sc.bone("head", "neck", ...G.head);
    sc.bone("jaw", "head", ...G.jaw);
    sc.bone("tail1", "root", ...G.tail[0]); sc.bone("tail2", "tail1", ...G.tail[1]); sc.bone("tail3", "tail2", ...G.tail[2]);
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.bone("scap" + n, "chest", ...F[0]); sc.bone("elb" + n, "scap" + n, ...F[1]); sc.bone("wri" + n, "elb" + n, ...F[2]); sc.bone("fpaw" + n, "wri" + n, ...F[3]);
      sc.bone("hip" + n, "root", ...B[0]); sc.bone("stif" + n, "hip" + n, ...B[1]); sc.bone("hock" + n, "stif" + n, ...B[2]); sc.bone("bpaw" + n, "hock" + n, ...B[3]);
      sc.bone("ear" + n, "head", ...X(G.ear, s));
    }
  }
  // scale a landmark table around the ground point below the chest
  const scaleG = (G, k) => { const f = (p) => (Array.isArray(p[0]) ? p.map(f) : [p[0] * k, p[1] * k, p[2] * k]); const o = {}; for (const [key, v] of Object.entries(G)) o[key] = Array.isArray(v) ? f(v) : v; return o; };


  // ------------------------------------------------------------ registry
  // spec: { cards: [card ids], kind: "humanoid" | "quadruped" | <custom>, build(fam) → { sc, P?, G?, kind, props },
  //         face?: { kind, look, params?(ch) }, moves: { attack: {...} }, pose?(fig, clip, t, T, C), scale?, fam? }
  const figures = new Map(), byCard = new Map();
  // the scripts this pipeline loaded from, in order (sculpt, voxelize, kit, figures): EmberVoxelBaker rebuilds the
  // pipeline from them inside a worker
  const scripts = root.EmberVoxelScripts || (root.EmberVoxelScripts = []);
  const here = () => { const el = typeof document !== "undefined" ? document.currentScript : null; if (el && !scripts.includes(el)) scripts.push(el); };
  here();
  function define(id, spec) {
    here();
    const s = Object.assign({ id, fam: "chunky", scale: 1, cards: [id] }, spec);
    figures.set(id, s);
    for (const c of s.cards) byCard.set(c, id);
    return s;
  }
  /** a figure's voxel bake — pure data (typed arrays and plain objects), so it can be made in a worker and posted:
   *  { id, ch: { kind, P, G, Hs, faces, fam }, main, props: [{ bone, at, grip, rot, bake }], ms } */
  function bakeData(id, V, VPROP) {
    const VX = root.EmberVoxel || (typeof require !== "undefined" ? require("./voxelize.js") : null);
    const spec = figures.get(id);
    if (!spec) throw new Error("unknown voxel figure " + id);
    const clock = typeof performance !== "undefined" ? performance : Date, t0 = clock.now();
    const ch = spec.build(spec.fam);
    const main = VX.voxelize(ch.sc, { v: V });
    const props = (ch.props || []).map((p) => ({ bone: p.bone, at: p.at, grip: p.grip, rot: p.rot, bake: VX.voxelize(p.sc, { v: VPROP, dilate: { body: 0.5 } }) }));
    return { id, ch: { kind: ch.kind, P: ch.P, G: ch.G, Hs: ch.Hs, faces: ch.sc.faces, fam: spec.fam }, main, props, ms: clock.now() - t0 };
  }

  const api = {
    S, Sculpture, lin, vnoise, fbm, clamp, mix, sstep, rotm, rotY2, smax, TAU,
    add, sub, mul, lerp, norm, cross, X,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, handFrame, hand, foot, head,
    RG, wrap, bell, skirt, cape, capeBones, lock, cuff, spline, strand, onEll, chibiHair,
    spearProp, bowProp, quiverProp, QF, quadBones, scaleG,
    define, bakeData, scripts, get: (id) => figures.get(id), ids: () => [...figures.keys()],
    forCard: (cardId) => (byCard.has(cardId) ? figures.get(byCard.get(cardId)) : null),
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EmberVoxelKit = api;
})(typeof self !== "undefined" ? self : this);
