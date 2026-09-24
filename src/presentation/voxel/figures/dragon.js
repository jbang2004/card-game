/* 烬喉幼龙 — Emberthroat Whelp: a young black dragon sitting up on its haunches — charcoal armour scales, pale
 * banded belly plates, swept-back horns, a spiky ridge from the crown to the tail, half-folded bat wings raised behind
 * it with glowing amber membranes (they spread for the breath, the roar and a hit), ember eyes with slit pupils and a
 * smouldering mouth that opens for the fire breath (card dragon). Wings are cloth-part membranes skinned smoothly
 * across wing1-3 / wf1-3; the bind pose is the idle pose, so the idle voxels stay crisp. */
EmberVoxelKit.define("dragon", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, add, sub, mul, lerp, norm, cross, CLS, mats, sideName, quadBones, spline } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const V = 0.0125;                                              // body voxel (EmberVoxelRender.V)
  const row = (y) => (Math.round(y / V - 0.5) + 0.5) * V;        // nearest voxel-row centre on the world lattice

  // ---------------------------------------------------------------- landmarks (sitting up, facing +Z)
  const Hs = 1.2;                                                // head scale (a whelp: big head, big horns)
  const YM = row(0.478);                                         // mouth line: one empty voxel row between the jaws
  const HC = [0, YM + 0.036 * Hs, 0.1];                          // skull centre
  const SN = HC[2] + 0.112 * Hs;                                 // snout tip
  const G = {
    root: [0, 0.14, -0.08], spine: [0, 0.225, -0.035], chest: [0, 0.31, 0.01], neck: [0, 0.37, 0.035], head: [0, YM + 0.002, HC[2] - 0.028 * Hs], jaw: [0, YM + 0.001, HC[2] + 0.012 * Hs],
    tail: [[0, 0.09, -0.155], [0.03, 0.046, -0.228], [0.095, 0.03, -0.262]],
    front: [[0.058, 0.3, 0.058], [0.07, 0.19, 0.06], [0.072, 0.07, 0.08], [0.072, 0.022, 0.104]],
    back: [[0.066, 0.14, -0.07], [0.104, 0.13, 0.03], [0.098, 0.036, -0.058], [0.098, 0.02, 0.036]],
    ear: [0.046 * Hs, YM + 0.02 * Hs, HC[2] - 0.02 * Hs],
  };
  const TAIL = [[0.165, 0.028, -0.238], [0.212, 0.032, -0.172]];        // tail4, tail5 (curling round the left side)
  const TIP = [0.228, 0.05, -0.1];
  // left wing (mirrored for the right): shoulder, elbow, wrist (the raised peak), three fingers, trailing root on the back, thumb claw
  const WG = { S: [0.042, 0.37, -0.04], E: [0.108, 0.478, -0.11], W: [0.15, 0.625, -0.105], F: [[0.275, 0.48, -0.2], [0.225, 0.335, -0.215], [0.15, 0.255, -0.18]], B: [0.05, 0.255, -0.085], T: [0.156, 0.672, -0.082] };
  const wingOf = (s) => { const x = (p) => [p[0] * s, p[1], p[2]]; return { S: x(WG.S), E: x(WG.E), W: x(WG.W), F: WG.F.map(x), B: x(WG.B), T: x(WG.T) }; };
  // wing-plane axis per side: a positive turn about it fans a finger away from the trailing edge
  const fanAxis = (s) => { const w = wingOf(s); return norm(cross(sub(w.F[2], w.W), sub(w.F[0], w.W))); };
  const AX = { L: fanAxis(1), R: fanAxis(-1) };
  const JAW_OPEN = 0.62;                                         // jaw drop (rad) while breathing fire

  // ---------------------------------------------------------------- helpers
  function segDist(p, a, b) { return segD(p[0], p[1], p[2], a, b); }
  function segD(x, y, z, a, b) {                                 // distance from (x, y, z) to segment ab (no allocation)
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
    const t = clamp((px * abx + py * aby + pz * abz) / Math.max(abx * abx + aby * aby + abz * abz, 1e-12), 0, 1);
    return Math.hypot(px - abx * t, py - aby * t, pz - abz * t);
  }
  // smooth skin weights for world-lattice (cloth) prims: inverse square distance to each bone's segment
  function segWeights(list, e = 0.008) {
    const n = list.length, out = list.map(([b]) => [b, 0]);
    return (x, y, z) => {
      let tot = 0;
      for (let i = 0; i < n; i++) { const d = segD(x, y, z, list[i][1], list[i][2]), w = 1 / (d * d + e * e); out[i][1] = w; tot += w; }
      for (let i = 0; i < n; i++) out[i][1] /= tot;
      return out;
    };
  }
  /* membrane panel: triangle sheet a-b-c (half thickness t) with the edge b-c scalloped inward by `dip`
   * (unsigned triangle distance after Quilez, constants precomputed) */
  function panel(a, b, c, t, dip) {
    const ba = sub(b, a), cb = sub(c, b), ac = sub(a, c), nor = cross(ba, ac);
    const e1 = cross(ba, nor), e2 = cross(cb, nor), e3 = cross(ac, nor), nl = len(nor);
    const d1 = dot(ba, ba), d2 = dot(cb, cb), d3 = dot(ac, ac);
    let cut = null;
    if (dip > 0) {
      const e = sub(c, b), n = cross(e, sub(a, b)), mid = lerp(b, c, 0.5), h = len(e) / 2;
      let out = norm(cross(e, n)); if (dot(out, sub(a, mid)) > 0) out = mul(out, -1);
      const R = (h * h + dip * dip) / (2 * dip);
      cut = [...add(mid, mul(out, R - dip)), R];
    }
    const edge = (vx, vy, vz, wx, wy, wz, dd) => { const k = clamp((vx * wx + vy * wy + vz * wz) / dd, 0, 1); return Math.hypot(vx * k - wx, vy * k - wy, vz * k - wz); };
    const mn = [0, 1, 2].map((i) => Math.min(a[i], b[i], c[i]) - t), mx = [0, 1, 2].map((i) => Math.max(a[i], b[i], c[i]) + t);
    return S.custom((x, y, z) => {
      const pax = x - a[0], pay = y - a[1], paz = z - a[2], pbx = x - b[0], pby = y - b[1], pbz = z - b[2], pcx = x - c[0], pcy = y - c[1], pcz = z - c[2];
      const sg = Math.sign(e1[0] * pax + e1[1] * pay + e1[2] * paz) + Math.sign(e2[0] * pbx + e2[1] * pby + e2[2] * pbz) + Math.sign(e3[0] * pcx + e3[1] * pcy + e3[2] * pcz);
      let d = sg < 2 ? Math.min(edge(ba[0], ba[1], ba[2], pax, pay, paz, d1), edge(cb[0], cb[1], cb[2], pbx, pby, pbz, d2), edge(ac[0], ac[1], ac[2], pcx, pcy, pcz, d3))
        : Math.abs(nor[0] * pax + nor[1] * pay + nor[2] * paz) / nl;
      d -= t;
      if (cut) d = Math.max(d, cut[3] - Math.hypot(x - cut[0], y - cut[1], z - cut[2]));
      return d;
    }, [...mn, ...mx]);
  }

  function dragon() {
    const sc = new Sculpture();
    quadBones(sc, G);
    sc.bone("tail4", "tail3", ...TAIL[0]); sc.bone("tail5", "tail4", ...TAIL[1]);
    for (const s of [1, -1]) {
      const n = sideName(s), w = wingOf(s);
      sc.bone("wing1" + n, "chest", ...w.S); sc.bone("wing2" + n, "wing1" + n, ...w.E); sc.bone("wing3" + n, "wing2" + n, ...w.W);
      for (let i = 1; i <= 3; i++) sc.bone("wf" + i + n, "wing3" + n, ...w.W);
    }
    mats(sc, {
      scale: { c: 0x3f3d54, rough: 0.55, cls: CLS.skin, vary: 0.05 }, scaleDk: { c: 0x2a2939, rough: 0.5, cls: CLS.skin, vary: 0.03 },
      belly: { c: 0xb4a898, rough: 0.7, cls: CLS.skin, vary: 0.03 }, bellySeam: { c: 0x877c78, rough: 0.7, cls: CLS.skin },
      horn: { c: 0x5c5667, rough: 0.45, cls: CLS.skin, vary: 0.03 }, hornTip: { c: 0xb8aeb8, rough: 0.4, cls: CLS.skin },
      claw: { c: 0x8a8290, rough: 0.4, cls: CLS.skin }, wingBone: { c: 0x2c2a3a, rough: 0.5, cls: CLS.skin },
      membrane: { c: 0xd0732a, rough: 0.75, emit: 0.12, cls: CLS.skin, vary: 0.04 }, membraneDk: { c: 0x9c4c1c, rough: 0.75, emit: 0.05, cls: CLS.skin, vary: 0.04 },
      eye: { c: 0xd8840e, rough: 0.2, emit: 0.22, cls: CLS.glow }, pupil: { c: 0x1a0c06, rough: 0.3, cls: CLS.skin }, ember: { c: 0xbc3a08, rough: 0.3, emit: 0.28, cls: CLS.glow },
    });
    const B = { mat: "scale" }, q = Hs;
    const hp = (x, y, z) => add(HC, [x * q, y * q, z * q]);        // head-space point
    // ---- torso: haunch-heavy pelvis, belly leaning back, deep chest pushed forward
    sc.add(S.ell(0.08, 0.072, 0.082), { ...B, p: [0, 0.125, -0.075], bone: "root", k: 0.03 });
    sc.add(S.ell(0.074, 0.09, 0.074), { ...B, p: [0, 0.215, -0.028], r: [0.35, 0, 0], bone: "spine", k: 0.035 });
    sc.add(S.ell(0.08, 0.09, 0.082), { ...B, p: [0, 0.3, 0.024], r: [0.28, 0, 0], bone: "chest", k: 0.035 });
    // ---- neck: thick at the chest, an S up to the skull
    const n0 = [0, 0.345, 0.03], n1 = [0, 0.405, 0.062], n2 = [0, YM + 0.004, HC[2] - 0.035];
    const nwf = (x, y) => { const u = clamp((y - n0[1]) / (n2[1] - n0[1]), 0, 1); return [["chest", 1 - sstep(0.05, 0.25, u)], ["neck", sstep(0.05, 0.25, u) * (1 - sstep(0.84, 0.98, u))], ["head", sstep(0.84, 0.98, u)]]; };
    sc.limb(n0, n1, 0.057, 0.047, { ...B, bone: "neck", k: 0.03 }).wfn = nwf;
    sc.limb(n1, n2, 0.047, 0.039, { ...B, bone: "neck", k: 0.03 }).wfn = nwf;
    // ---- head: round skull, tapering snout and lower jaw with flat inner faces on either side of the mouth row
    sc.add(S.ell(0.049 * q, 0.043 * q, 0.05 * q), { ...B, p: HC, bone: "head", k: 0.02 });
    const zs0 = HC[2] + 0.005 * q;
    const taper = (w0, w1, h0, h1, z0, z1, up) => S.custom((x, y, z) => {
      const u = clamp((z - z0) / (z1 - z0), 0, 1), w = mix(w0, w1, u), h = mix(h0, h1, u), dy = up ? y - YM : YM - y;
      return Math.max(Math.abs(x) - w, dy - h, -0.003 - dy, z - z1, z0 - z);
    }, [-w0, YM - h0 - 0.004, z0, w0, YM + h0 + 0.004, z1]);
    sc.add(taper(0.033 * q, 0.021 * q, 0.036 * q, 0.022 * q, zs0, SN, true), { ...B, p: [0, 0, 0], bone: "head", k: 0.016 });              // snout
    sc.add(S.ell(0.017 * q, 0.01 * q, 0.02 * q), { ...B, p: [0, YM + 0.025 * q, SN - 0.02 * q], bone: "head", k: 0.012 });                 // nose ridge
    sc.add(taper(0.03 * q, 0.017 * q, 0.028 * q, 0.015 * q, zs0 - 0.01, SN - 0.008, false), { ...B, p: [0, 0, 0], bone: "jaw", k: 0.012 }); // lower jaw
    sc.add(S.ell(0.036 * q, 0.02 * q, 0.026 * q), { ...B, p: [0, YM - 0.012 * q, HC[2] + 0.004 * q], bone: "jaw", k: 0.016 });              // jowls
    sc.add(S.box(0.05 * q, 0.0066, 0.075 * q), { ...B, op: "sub", p: [0, YM, HC[2] + 0.095 * q], bone: "head", k: 0.001 });              // the mouth row
    // glowing throat, palate and tongue (the lip ring stays dark; the glow shows through the mouth row and when the jaw drops)
    const zb = HC[2] + 0.004 * q, zf = SN - 0.016;
    sc.paint(S.box(0.0135, 0.02, (zf - zb) / 2), { mat: "ember", p: [0, YM, (zf + zb) / 2], soft: 0.001 });
    for (const s of [1, -1]) sc.add(S.sphere(0.0045), { mat: "ember", p: [s * 0.011 * q, YM + 0.024 * q, SN - 0.001], bone: "head", k: 0.002, vdil: 0.6 });   // nostrils
    // eyes: amber with a slit pupil (a voxel column in the middle, seen from the side), under a heavy frowning brow
    const eyeC = [0.037 * q, row(HC[1] + 0.005 * q), (Math.round(HC[2] / V + 0.038 * q / V - 0.5) + 0.5) * V];
    for (const s of [1, -1]) {
      const ec = [s * eyeC[0], eyeC[1], eyeC[2]];
      sc.add(S.ell(0.015 * q, 0.011 * q, 0.005 * q), { mat: "eye", p: ec, r: [0, s * 0.95, 0], bone: "head", k: 0.003, cs: 0.05, vdil: 0.55 });
      sc.paint(S.box(0.03, 0.02, 0.0045), { mat: "pupil", p: [s * (eyeC[0] + 0.015), eyeC[1], eyeC[2]], soft: 0.001, only: ["eye"] });
      sc.limb(hp(s * 0.014, 0.028, 0.052), hp(s * 0.05, 0.035, 0.014), 0.011 * q, 0.009 * q, { mat: "scaleDk", bone: "head", k: 0.01 });
    }
    // horns: two long sweeps back and up, two short ones below
    for (const s of [1, -1]) {
      const hq = q * 1.15;
      const horn = spline([hp(s * 0.026, 0.03, -0.012), add(HC, [s * 0.046 * hq, 0.058 * hq, -0.052 * hq]), add(HC, [s * 0.062 * hq, 0.076 * hq, -0.098 * hq]), add(HC, [s * 0.072 * hq, 0.102 * hq, -0.138 * hq]), add(HC, [s * 0.076 * hq, 0.134 * hq, -0.16 * hq])], 10)
        .map((p, i) => [...p, mix(0.017 * q, 0.003, Math.pow(i / 10, 0.9))]);
      sc.add(S.chain(horn), { mat: "horn", p: [0, 0, 0], bone: "head", k: 0.006, vdil: 0.5 });
      sc.paint(S.sphere(0.04), { mat: "hornTip", p: horn[10].slice(0, 3), soft: 0.004, only: ["horn"] });
      const h2 = spline([hp(s * 0.042, 0.012, -0.022), hp(s * 0.066, 0.016, -0.066), hp(s * 0.078, 0.034, -0.108)], 6).map((p, i) => [...p, mix(0.011 * q, 0.0025, i / 6)]);
      sc.add(S.chain(h2), { mat: "horn", p: [0, 0, 0], bone: "head", k: 0.005, vdil: 0.5 });
      sc.paint(S.sphere(0.02), { mat: "hornTip", p: h2[6].slice(0, 3), soft: 0.004, only: ["horn"] });
      // cheek frills (ear bones): three dark spines fanning back with amber webbing
      const en = "ear" + sideName(s), sp = [];
      for (let i = 0; i < 3; i++) {
        const b0 = hp(s * 0.042, -0.018 - 0.006 * i, -0.006 - 0.008 * i), d = norm([s * 0.55, 0.12 - 0.32 * i, -0.85]);
        sp.push([b0, add(b0, mul(d, (0.056 - 0.012 * i) * q))]);
        sc.limb(sp[i][0], sp[i][1], 0.009, 0.0015, { mat: "scaleDk", bone: en, k: 0.004, vdil: 0.5 });
      }
      for (let i = 0; i < 2; i++) sc.add(panel(sp[i][0], lerp(sp[i][0], sp[i][1], 0.85), lerp(sp[i + 1][0], sp[i + 1][1], 0.85), 0.003, 0.006), { mat: "membrane", p: [0, 0, 0], bone: en, k: 0.002, vdil: 0.55 });
    }
    // ---- legs: big shoulders and haunches, thick forearms, clawed feet
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => [p[0] * s, p[1], p[2]]), Bk = G.back.map((p) => [p[0] * s, p[1], p[2]]);
      sc.add(S.ell(0.036, 0.06, 0.042), { ...B, p: add(F[0], [0, -0.03, -0.004]), bone: "scap" + n, bones: [["scap" + n, 0.7], ["chest", 0.3]], k: 0.03 });
      sc.limb(F[0], F[1], 0.034, 0.026, { ...B, bone: "scap" + n, k: 0.02 });
      sc.limb(F[1], F[2], 0.025, 0.02, { ...B, bone: "elb" + n, k: 0.014 });
      sc.limb(F[2], F[3], 0.02, 0.021, { ...B, bone: "wri" + n, k: 0.01 });
      sc.add(S.ell(0.03, 0.016, 0.034), { ...B, p: add(F[3], [0, -0.004, 0.012]), bone: "fpaw" + n, k: 0.01 });
      sc.limb(add(F[1], [s * 0.012, 0.006, -0.012]), add(F[1], [s * 0.02, 0.018, -0.042]), 0.008, 0.0015, { mat: "scaleDk", bone: "elb" + n, k: 0.004, vdil: 0.5 });   // elbow spur
      sc.add(S.ell(0.052, 0.064, 0.08), { ...B, p: add(lerp(Bk[0], Bk[1], 0.42), [0, 0.004, 0]), r: [0.1, 0, 0], bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.03 });
      sc.limb(Bk[1], Bk[2], 0.025, 0.017, { ...B, bone: "stif" + n, k: 0.014 });
      sc.limb(Bk[2], Bk[3], 0.017, 0.019, { ...B, bone: "hock" + n, k: 0.01 });
      sc.add(S.ell(0.027, 0.014, 0.03), { ...B, p: add(Bk[3], [0, -0.004, 0.012]), bone: "bpaw" + n, k: 0.01 });
      for (const [P4, bn] of [[F[3], "fpaw" + n], [Bk[3], "bpaw" + n]]) for (let c = -1; c <= 1; c++) {
        const a = add(P4, [c * 0.014, -0.004, 0.032]);
        sc.limb(a, add(a, [c * 0.004, -0.013, 0.017]), 0.0065, 0.0015, { mat: "claw", bone: bn, k: 0.003, vdil: 0.5 });
      }
    }
    // ---- tail: thick at the root, curling round the left side along the ground; one chain per tail bone (tight bounds)
    const TP = [[0, 0.12, -0.13], G.tail[0], G.tail[1], G.tail[2], TAIL[0], TAIL[1], TIP], TBN = ["root", "tail1", "tail2", "tail3", "tail4", "tail5"];
    const NT = 24, tp = spline(TP, NT).map((p, i) => [...p, mix(0.046, 0.006, Math.pow(i / NT, 0.8))]);
    for (let j = 0; j < 6; j++) sc.add(S.chain(tp.slice(j * 4, j * 4 + 5)), { ...B, p: [0, 0, 0], bone: TBN[j], k: 0.004 });
    // ---- dorsal ridge: plates from the crown down the neck and back to the tail tip
    const ridge = [
      [hp(0, 0.034, -0.034), [0, 1, -0.7], 0.032, "head"], [hp(0, 0.008, -0.058), [0, 0.5, -1], 0.03, "head"],
      [[0, 0.452, 0.03], [0, 0.35, -1], 0.032, "neck"], [[0, 0.418, 0.01], [0, 0.35, -1], 0.032, "neck"], [[0, 0.385, -0.012], [0, 0.4, -1], 0.03, "neck"],
      [[0, 0.35, -0.036], [0, 0.35, -1], 0.028, "chest"], [[0, 0.31, -0.056], [0, 0.3, -1], 0.028, "chest"],
      [[0, 0.265, -0.082], [0, 0.35, -1], 0.026, "spine"], [[0, 0.22, -0.1], [0, 0.35, -1], 0.024, "spine"], [[0, 0.172, -0.126], [0, 0.4, -1], 0.022, "root"],
    ];
    for (let i = 3; i <= 21; i += 3) { const p = tp[i], r = tp[i + 1], d = norm(sub(r, p)); ridge.push([[p[0], p[1] + p[3] * 0.8, p[2]], [d[0] * 0.5, 1, d[2] * 0.5], 0.012 + p[3] * 0.35, TBN[Math.min(5, Math.floor(i / 4))]]); }
    for (const [p, d, L, bone] of ridge) sc.limb(p, add(p, mul(norm(d), L)), L * 0.36, 0.0015, { mat: "scaleDk", bone, k: 0.005, vdil: 0.5 });
    // ---- belly plates: pale chevron bands from under the jaw down to the belly
    const halfW = (y) => (y < 0.2 ? mix(0.03, 0.046, clamp((y - 0.08) / 0.1, 0, 1)) : y < 0.33 ? 0.054 : mix(0.052, 0.03, clamp((y - 0.33) / 0.1, 0, 1)));
    const zFront = (y) => (y < 0.34 ? mix(-0.05, 0.05, clamp((y - 0.08) / 0.26, 0, 1)) : mix(0.05, 0.075, clamp((y - 0.34) / 0.12, 0, 1)));
    const front = (x, y, z) => Math.max(Math.abs(x) - halfW(y), zFront(y) - z, y - (YM - 0.03), 0.07 - y);
    sc.paint(S.custom(front, [-0.1, 0, -0.2, 0.1, 0.6, 0.3]), { mat: "belly", soft: 0.002, only: ["scale"] });
    sc.paint(S.custom((x, y, z) => (Math.floor((y - 0.3 * Math.abs(x)) / V) % 3 === 0 ? front(x, y, z) : 1), [-0.1, 0, -0.2, 0.1, 0.6, 0.3]), { mat: "bellySeam", soft: 0.002, only: ["scale"] });
    // ---- wings (cloth: world lattice, skinned smoothly across arm, fingers and body)
    sc.inPart("cloth", () => {
      for (const s of [1, -1]) {
        const n = sideName(s), w = wingOf(s);
        const seg = { body: ["chest", w.S, w.B], w1: ["wing1" + n, w.S, w.E], w2: ["wing2" + n, w.E, w.W], th: ["wing3" + n, w.W, w.T], f: w.F.map((F, i) => ["wf" + (i + 1) + n, w.W, F]) };
        const rig = (pr, list) => { pr.wfn = segWeights(list); return pr; };
        rig(sc.limb(w.S, w.E, 0.015, 0.012, { mat: "wingBone", bone: "wing1" + n, k: 0.006 }), [seg.body, seg.w1, seg.w2]);
        rig(sc.limb(w.E, w.W, 0.012, 0.01, { mat: "wingBone", bone: "wing2" + n, k: 0.006 }), [seg.w1, seg.w2, seg.th]);
        rig(sc.add(S.sphere(0.014), { mat: "wingBone", p: w.W, bone: "wing3" + n, k: 0.004 }), [seg.w2, seg.th]);
        rig(sc.add(S.chain(spline([w.W, lerp(w.W, w.T, 0.6), w.T, add(w.T, [s * 0.004, -0.004, 0.02])], 8).map((p, i) => [...p, mix(0.01, 0.002, i / 8)])), { mat: "claw", p: [0, 0, 0], bone: "wing3" + n, k: 0.004 }), [seg.th]);
        w.F.forEach((F, i) => rig(sc.limb(w.W, add(F, mul(norm(sub(F, w.W)), 0.018)), 0.0095, 0.003, { mat: "wingBone", bone: "wf" + (i + 1) + n, k: 0.004 }), [seg.w2, seg.f[i]]));
        const t = 0.0035, P = [
          [[w.W, w.F[0], w.F[1]], 0.042, [seg.f[0], seg.f[1]]],
          [[w.W, w.F[1], w.F[2]], 0.036, [seg.f[1], seg.f[2]]],
          [[w.W, w.F[2], w.B], 0.034, [seg.f[2], seg.w2, seg.w1, seg.body]],
          [[w.W, w.E, w.B], 0, [seg.w2, seg.w1, seg.body, seg.f[2]]],
          [[w.E, w.S, w.B], 0, [seg.w1, seg.body, seg.w2]],
        ];
        for (const [[a, b, c], dip, list] of P) rig(sc.add(panel(a, b, c, t, dip), { mat: "membrane", p: [0, 0, 0], bone: "wing2" + n, k: 0.003 }), list);
        // the membrane darkens toward the arm and the body, glows toward the trailing edge
        sc.paint(S.custom((x, y, z) => { const p = [x, y, z]; return Math.min(segDist(p, w.S, w.E), segDist(p, w.E, w.W), segDist(p, w.S, w.B)) - 0.03; }, [-1, -1, -1, 1, 1, 1]), { mat: "membraneDk", soft: 0.002, only: ["membrane"] });
      }
    });
    return { sc, kind: "quadruped", props: [], G };
  }

  // ---------------------------------------------------------------- motion
  let H = null;                                                  // scratch three.js objects (page only)
  const scratch = () => H || (H = { q: new EmberVesperThree.Quaternion(), q1: new EmberVesperThree.Quaternion(), q2: new EmberVesperThree.Quaternion(), v: new EmberVesperThree.Vector3(), e: new EmberVesperThree.Euler() });
  function spin(fig, name, ax, a) { const o = fig.J[name]; if (!o || !a) return; const h = scratch(); o.quaternion.multiply(h.q.setFromAxisAngle(h.v.set(ax[0], ax[1], ax[2]), a)); }
  // slerp a bone from its current (idle) rotation toward rest·euler(x, y, z) by k
  function blendRot(fig, name, x, y, z, k) {
    const o = fig.J[name]; if (!o) return;
    const h = scratch();
    h.q1.copy(o.quaternion); h.q2.copy(fig.rest.get(o).q).multiply(h.q.setFromEuler(h.e.set(x, y, z)));
    o.quaternion.slerpQuaternions(h.q1, h.q2, k);
  }
  /* wing: lift (raise the arm), sweep (+ = back), fold (elbow/wrist, + = open), fan (+ = spread the fingers) */
  function wing(fig, C, s, lift, sweep, fold, fan) {
    const n = sideName(s), ax = AX[n];
    C.rot(fig, "wing1" + n, 0, s * sweep, s * lift);
    C.rot(fig, "wing2" + n, 0, 0, 0); spin(fig, "wing2" + n, ax, -fold * 0.5);
    C.rot(fig, "wing3" + n, 0, 0, 0); spin(fig, "wing3" + n, ax, -fold * 0.4);
    spin(fig, "wf1" + n, ax, fan); spin(fig, "wf2" + n, ax, fan * 0.45); spin(fig, "wf3" + n, ax, -fan * 0.15);
  }
  function pose(fig, clip, t, T, C) {
    const { rot, off, sstep, bump } = C;
    const hurt = clip === "hurt";
    C.base(fig, hurt ? "hurt" : "idle", hurt ? t : 0, T);
    // slow tail sway on the ground (replaces the shared puppy wag), tip curls
    const sw = Math.sin(T * 0.9);
    rot(fig, "tail1", 0, 0.08 * sw, 0); rot(fig, "tail2", 0, 0.1 * Math.sin(T * 0.9 - 0.6), 0); rot(fig, "tail3", 0, 0.12 * Math.sin(T * 0.9 - 1.2), 0);
    rot(fig, "tail4", 0, 0.14 * Math.sin(T * 0.9 - 1.8), 0); rot(fig, "tail5", -0.12 - 0.1 * Math.sin(T * 1.3), 0.16 * Math.sin(T * 0.9 - 2.4), 0);
    // wings: breathe with the chest, now and then a flick of the fingers
    const br = Math.sin((T * C.TAU) / 3.2);
    const flick = (s) => bump(0, 0.1, 0.2, 0.55, (T + (s > 0 ? 0 : 2.3)) % 6.1);
    const W = { L: [0.03 * br, 0, 0.04 * br, 0.12 * flick(1)], R: [0.03 * br, 0, 0.04 * br, 0.12 * flick(-1)] };
    let emit = 0.06 * (0.5 + 0.5 * Math.sin(T * 1.9)), ret = clip === "idle" || t < 1;
    if (clip === "attack") {
      // rear back and draw breath (0-0.36, wings lift) → thrust the head forward, jaws open at 0.45 → hold the gout (→0.85) → recover
      const env = sstep(0, 0.1, t) * (1 - sstep(1.08, 1.3, t));
      const wind = sstep(0.02, 0.34, t) * (1 - sstep(0.34, 0.46, t));
      const thr = sstep(0.34, 0.45, t) * (1 - sstep(0.86, 1.22, t));
      const open = sstep(0.37, 0.45, t) * (1 - sstep(0.84, 1.05, t));
      const hold = bump(0.44, 0.5, 0.8, 0.95, t), shake = hold * Math.sin(t * 75) * 0.025;
      blendRot(fig, "root", -0.13 * wind + 0.07 * thr, 0, 0, env);
      off(fig, "root", 0, 0.012 * wind, -0.02 * wind + 0.03 * thr);
      blendRot(fig, "spine", -0.05 * wind + 0.03 * thr, 0, 0, env);
      blendRot(fig, "chest", -0.1 * wind + 0.06 * thr + 0.03 * wind * Math.sin(t * 20), 0, 0, env);
      blendRot(fig, "neck", -0.42 * wind + 0.5 * thr, 0, 0, env);
      blendRot(fig, "head", -0.3 * wind - 0.36 * thr + shake, 0.4 * shake, 0, env);
      blendRot(fig, "jaw", 0.1 * wind + JAW_OPEN * open, 0, 0, env);
      for (const s of ["L", "R"]) { rot(fig, "scap" + s, 0.1 * thr - 0.08 * wind, 0, 0); rot(fig, "elb" + s, -0.1 * thr, 0, 0); }
      for (const n of ["L", "R"]) W[n] = [W[n][0] + 0.42 * wind + 0.08 * thr, -0.25 * thr, W[n][2] + 0.35 * wind + 0.2 * thr, W[n][3] + 0.3 * wind + 0.2 * thr];
      rot(fig, "tail1", -0.15 * wind + 0.05 * thr, 0.08 * sw, 0);
      emit += 0.15 * wind + 0.6 * hold + 0.35 * open;
      ret = t < 1.3;
    } else if (hurt) {
      // the shared recoil plus flaring wings, a pained gape and a lash of the tail
      const k = Math.exp(-t * 6) * sstep(0, 0.05, t), fl = bump(0, 0.06, 0.12, 0.55, t);
      rot(fig, "jaw", 0.35 * k, 0, 0);
      for (const n of ["L", "R"]) W[n] = [W[n][0] + 0.32 * fl, -0.2 * fl, W[n][2] + 0.4 * fl, W[n][3] + 0.3 * fl];
      rot(fig, "tail2", 0, 0.1 * Math.sin(T * 0.9 - 0.6) + 0.3 * k, 0); rot(fig, "tail4", 0, 0.4 * k, 0);
      ret = t < 0.6;
    } else if (clip === "victory") {
      // wings thrown wide with two beats, head up, a roar
      const up = bump(0, 0.3, 1.2, 1.6, t), beat = Math.sin(clamp((t - 0.3) / 0.9, 0, 1) * Math.PI * 4) * up;
      blendRot(fig, "neck", -0.25 * up, 0, 0, up); blendRot(fig, "head", -0.35 * up, 0, 0, up);
      rot(fig, "jaw", 0.5 * bump(0.3, 0.45, 0.9, 1.2, t), 0, 0);
      for (const n of ["L", "R"]) W[n] = [0.45 * up + 0.15 * beat, -0.2 * up, 0.45 * up, 0.3 * up];
      emit += 0.5 * bump(0.3, 0.45, 0.9, 1.2, t);
      ret = t < 1.6;
    }
    wing(fig, C, 1, ...W.L); wing(fig, C, -1, ...W.R);
    C.emitBoost(fig, emit);
    return ret;
  }

  /* breath emitter, in the jaw bone's frame: the centre of the open mouth at the contact (jaw dropped by JAW_OPEN) —
   * halfway between the upper lip tip and the dropped lower lip tip, rotated back into the jaw's rest frame */
  const mouth = (() => {
    const up = sub([0, YM + 0.004, SN - 0.008], G.jaw), lo = sub([0, YM - 0.006, SN - 0.02], G.jaw), c = Math.cos(JAW_OPEN), sn = Math.sin(JAW_OPEN);
    const loOpen = [0, lo[1] * c - lo[2] * sn, lo[1] * sn + lo[2] * c], m = lerp(up, loOpen, 0.5);
    return [0, +(m[1] * c + m[2] * sn).toFixed(4), +(-m[1] * sn + m[2] * c).toFixed(4)];
  })();
  return {
    cards: ["dragon"], kind: "quadruped", build: dragon, scale: 1.15, pose,
    moves: { attack: { clip: "breath", hit: 0.45, length: 1.3, style: "breath", ranged: true, emitter: { bone: "jaw", offset: mouth } } },
  };
})());
