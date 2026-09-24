/* 暮光精灵 — the twilight fairy (card wisp): a small elf-eared sprite with long pale-green blonde hair and a leaf
 * crown, a strapless dress of pointed green leaves over a pale veil, leaf bracers and greaves, and two pairs of
 * glowing green dragonfly wings veined in gold. She hovers, knees drawn up, a swirling green spirit orb floating over
 * her raised left palm; the orb rides its own bone (placed by pose()) and the arcane bolt leaves from it. */
EmberVoxelKit.define("wisp", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const V = 0.0125, vb = (x) => Math.round(x / V) * V;

  // leaf blade along +Y from 0 to len, half width wid, half thickness th (pointed tip, rounded base)
  const leaf = (len, wid, th) => S.custom((x, y, z) => {
    const u = clamp(y / len, 0, 1), w = wid * Math.sin(Math.PI * Math.pow(u, 0.7)) + 1e-4;
    return Math.max(Math.abs(x) - w, Math.abs(z) - th, -y, y - len);
  }, [-wid, 0, -th, wid, len, th]);

  // wings: all four panels lie in one plane behind the shoulder blades (bind = idle spread); upper pair up and out,
  // lower pair down and out. Each: root, direction (x, y in the plane), length, max half width
  const WZ = vb(-0.1);
  const WINGS = [
    { key: "U", root: [0.03, 0.7], dir: [0.8, 0.6], len: 0.46, w: 0.125 },
    { key: "D", root: [0.03, 0.64], dir: [0.8, -0.6], len: 0.3, w: 0.08 },
  ];

  // the spirit orb (prop, 0.75 cm cubes): a hot core in a green glow, one swirling ring and a spark
  function orbProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      core: { c: 0xeafff0, rough: 0.3, emit: 1.8, cls: CLS.glow },
      glow: { c: 0x4fcf7a, rough: 0.3, emit: 1.0, cls: CLS.glow },
      swirl: { c: 0x8ff0b0, rough: 0.3, emit: 1.2, cls: CLS.glow },
    });
    const o = { bone: "p" };
    sc.add(S.sphere(0.046), { ...o, mat: "glow", k: 0.002 });
    sc.paint(S.sphere(0.028), { mat: "core", soft: 0.002 });
    sc.add(S.arc(0.064, 0.005, 2.3), { ...o, mat: "swirl", r: [1.2, 0.4, 0.3], k: 0.002, vdil: 0.6 });
    sc.add(S.arc(0.057, 0.0045, 1.6), { ...o, mat: "swirl", r: [-0.5, 1.1, 2.4], k: 0.002, vdil: 0.6 });
    return sc;
  }

  function hair(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.006, -0.006]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.05, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.5, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // soft parted fringe, clear of the eyes
    const fr = [[-0.9, 0.02, -0.25], [-0.55, 0.01, -0.2], [-0.2, 0.018, 0.1], [0.2, 0.018, -0.1], [0.55, 0.01, 0.2], [0.9, 0.02, 0.25]];
    fr.forEach(([u, dy, sw], i) => {
      const root = onEll(C, R, u * 0.45, 0.88, 0.94);
      const tip = [R[0] * (0.8 * u + sw * 0.3), ey + (0.03 + dy) * q, P.faceZ + (0.008 - 0.016 * Math.abs(u)) * q];
      const mid = add(lerp(root, tip, 0.45), mul(norm(sub(lerp(root, tip, 0.45), C)), 0.014 * q));
      strand(sc, [root, mid, tip], (0.013 + 0.002 * (i % 2)) * q, 0.002 * q, { k: 0.007, taper: 1.1, grooves: 0.001 });
    });
    // long locks in front of the ears down past the collarbones
    for (const s of [1, -1]) {
      const n = sideName(s), root = onEll(C, R, s * 1.2, 0.3, 0.98);
      const a = [s * R[0] * 1.04, ey - 0.02 * q, C[2] + R[2] * 0.3], b = [s * R[0] * 1.1, P.chinY - 0.03 * q, C[2] + R[2] * 0.2];
      const tip = [s * P.shX * 0.8, P.neck[0] - 0.1 * q, P.chest[3] * 0.4];
      const sp = strand(sc, [root, a, b, tip], 0.013 * q, 0.0025 * q, { wave: 0.005 * q, wd: [s, 0, 0.2], waves: 2, phase: s, k: 0.008, wg: 4, bone: "hair" + n });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - 0.1, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
    // the long back fall: a mass down between the shoulder blades, locks flicking out at the ends (skinned to hairB1/2)
    const top = C[1] - R[1] * 0.2, bot = P.chest[0] - 0.08;
    const bwf = (x, y) => { const t = sstep(C[1], top - 0.06, y), t2 = sstep(P.neck[0], bot, y); return [["head", 1 - t], ["hairB1", t * (1 - t2)], ["hairB2", t * t2]]; };
    const back = sc.add(S.ell(R[0] * 1.02, R[1] * 0.9, R[2] * 0.62), { mat: "hair", p: add(C, [0, -R[1] * 0.4, -R[2] * 0.44]), bone: "head", k: 0.03, wg: 5 });
    back.wfn = bwf;
    for (let i = 0; i < 7; i++) {
      const u = (i / 6) * 2 - 1, az = Math.PI + u * 1.2;
      const root = onEll(C, R, az, -0.3, 1.0);
      const tip = [u * 0.09 + (i % 2 ? 0.012 : -0.012), bot - 0.02 * (1 - Math.abs(u)), -P.chest[3] - 0.05 - 0.02 * (1 - Math.abs(u))];
      const mid = [u * 0.075, mix(root[1], tip[1], 0.45), -P.chest[3] - 0.05];
      strand(sc, [root, mid, tip], 0.03 * q * (1 - 0.25 * Math.abs(u)), 0.004 * q, { k: 0.02, bone: "hairB1", wg: 5, taper: 1.2, grooves: 0.0016, gf: 110, wave: 0.006, wd: [1, 0, 0], phase: i }).wfn = bwf;
    }
    // leaf crown: a spray of leaves over her left temple, a small green gem, one leaf on the right
    const lc = onEll(C, R, 0.75, 0.62, 1.0);
    [[0, 0.7, -0.5, 0.05], [0.25, 0.95, 0.3, 0.046], [-0.3, 0.3, -0.9, 0.042], [0.5, 1.4, 0.8, 0.036], [-0.5, 0.05, -1.3, 0.034]].forEach(([dx, rx, rz, L], i) =>
      sc.add(leaf(L * q, 0.011 * q, 0.004), { mat: i % 2 ? "leafL" : "leaf", p: add(lc, [dx * 0.02, 0, 0]), r: [rx - 0.6, 0.6, rz - 0.4], bone: "head", k: 0.002, vdil: 0.55 }));
    sc.add(S.sphere(0.009 * q), { mat: "gem", p: add(lc, [0.004, 0.004, 0.012]), bone: "head", k: 0.002, vdil: 0.6 });
    const lr = onEll(C, R, -0.95, 0.7, 1.0);
    sc.add(leaf(0.034 * q, 0.01 * q, 0.004), { mat: "leaf", p: lr, r: [-0.4, -0.5, 0.7], bone: "head", k: 0.002, vdil: 0.55 });
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = fam === "chunky" ? 1.25 : 1;
    humanoidBones(sc, P);
    sc.bone("hairL", "head", 0.05, P.eyeY - 0.03, 0.03); sc.bone("hairR", "head", -0.05, P.eyeY - 0.03, 0.03);
    sc.bone("hairB1", "head", 0, P.chinY, -0.07); sc.bone("hairB2", "hairB1", 0, P.chest[0] - 0.02, -0.1);
    for (const s of [1, -1]) for (const w of WINGS) sc.bone("wing" + w.key + sideName(s), "chest", s * w.root[0], w.root[1], WZ);
    const aL = armJoints(P, 1), orbAt = add(aL.W, [0, 0.07, 0]);
    sc.bone("orb", "handL", ...orbAt);
    mats(sc, {
      skin: { c: 0xf4dccb, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xdcb4a0, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xd08a84, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xd4e0b4, rough: 0.5, cls: CLS.hair, vary: 0.08 },
      leaf: { c: 0x3a6a34, rough: 0.6, cls: CLS.plant, vary: 0.06 }, leafL: { c: 0x6e9e48, rough: 0.6, cls: CLS.plant, vary: 0.06 },
      leafD: { c: 0x274a28, rough: 0.65, cls: CLS.plant, vary: 0.05 },
      veil: { c: 0xb4e8c8, rough: 0.9, cls: CLS.cloth, vary: 0.03 }, veilD: { c: 0x7cc8a0, rough: 0.9, cls: CLS.cloth },
      gold: { c: 0xd6bd62, rough: 0.3, metal: 1, cls: CLS.metal },
      gem: { c: 0x3fd07a, rough: 0.2, emit: 0.9, cls: CLS.glow },
      wing: { c: 0x52c890, rough: 0.5, emit: 0.14, cls: CLS.skin, vary: 0.04 }, wingIn: { c: 0x2c9a6c, rough: 0.5, emit: 0.1, cls: CLS.skin, vary: 0.04 },
      vein: { c: 0xc8d060, rough: 0.3, emit: 0.35, cls: CLS.glow }, rim: { c: 0xa8f4cc, rough: 0.3, emit: 0.7, cls: CLS.glow },
    });
    body(sc, P, fam, {});
    const X0 = P.shX * 0.93, legX = 0.17, yTop = P.bust[0] + 0.03;
    // ---- strapless leaf bodice: dark leaves with pale leaf-tip chevrons, gold edge and a gem at the neckline
    wrap(sc, RG.box(-X0 * 1.05, X0 * 1.05, P.hipY - 0.03, yTop), "leaf", 0.006 * q);
    sc.paint(S.custom((x, y, z) => { const v = y - P.waist[0] + 0.7 * Math.abs(x); return Math.abs(((v % 0.05) + 0.05) % 0.05 - 0.025) - 0.007; }, [-1, -1, -1, 1, 1, 1]), { mat: "leafL", soft: 0.001, only: ["leaf"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - yTop + 0.006) - 0.0062, [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["leaf", "leafL"] });
    sc.add(S.sphere(0.011 * q), { mat: "gem", p: [0, yTop - 0.004, P.bust[2] + P.bust[3] * 0.4 + 0.012], bone: "chest", k: 0.002, vdil: 0.6 });
    // choker with a gem
    wrap(sc, RG.box(-0.1, 0.1, P.neck[0] + 0.028, P.neck[0] + 0.044), "leaf", 0.004 * q);
    sc.add(S.sphere(0.0075 * q), { mat: "gem", p: [0, P.neck[0] + 0.03, P.neck[2] + 0.01], bone: "neck", k: 0.002, vdil: 0.6 });
    // ---- leaf bracers and greaves, gold cuffs, a leaf point at each elbow and knee
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.25), lerp(a.W, a.E, -0.02), 0.07), "leaf", 0.006 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.25), lerp(a.E, a.W, 0.33), 0.07), "gold", 0.0065 * q);
      sc.add(leaf(0.06 * q, 0.014 * q, 0.005), { mat: "leafL", p: lerp(a.E, a.W, 0.35), r: [0, 0, s * (Math.PI - 0.35)], bone: "fore" + n, k: 0.002, vdil: 0.55 });
      sc.add(leaf(0.075 * q, 0.02 * q, 0.006), { mat: "leaf", p: add(l.K, [0, -0.07, P.calf[0] + 0.012]), r: [-0.15, 0, 0], bone: "shin" + n, k: 0.003, vdil: 0.55 });
    }
    wrap(sc, RG.box(-legX, legX, -0.02, P.kneeY - 0.035), "leafD", 0.006 * q);
    wrap(sc, RG.box(-legX, legX, P.kneeY - 0.05, P.kneeY - 0.035), "gold", 0.0065 * q);
    wrap(sc, RG.box(-legX, legX, 0.09, 0.105), "gold", 0.0065 * q);

    // ---- cloth: pale veil to the knees (longer behind), leaf-petal skirt over it, the wings
    sc.part = "cloth";
    const skirtRig = (y0, h) => (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.75, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    const petals = (y0, h0, dp, r0, r1, N, back, mat, t0) => {
      const H = h0 + dp + back, rAt = (u) => mix(r0, r1, Math.pow(u, 0.7)), szs = 0.84;
      const f = (x, y, z) => {
        const a = Math.atan2(z, x), tri = 1 - 2 * Math.abs((((a * N) / (2 * Math.PI) + t0) % 1 + 1) % 1 - 0.5);
        const hh = h0 + dp * tri + back * sstep(0.02, -0.12, z);
        const u = clamp(-y / H, 0, 1);
        return Math.max((Math.hypot(x, z / szs) - rAt(u)) * 0.85, y, -y - hh);
      };
      const pr = sc.add(S.custom(f, [-r1 - 0.02, -H, -(r1 + 0.02) * szs, r1 + 0.02, 0, (r1 + 0.02) * szs]), { mat, p: [0, y0, -0.004], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
      pr.wfn = skirtRig(y0, H);
      return pr;
    };
    const ys = P.waist[0] - 0.02;
    petals(ys, 0.11, 0.06, 0.085, 0.17, 5, 0.2, "veil", 0.25);
    sc.paint(S.custom((x, y, z) => y - (ys - 0.2) + 0.03 * Math.sin(x * 60), [-1, -1, -1, 1, 1, 1]), { mat: "veilD", soft: 0.002, only: ["veil"] });
    const sk = petals(ys + 0.004, 0.08, 0.07, 0.09, 0.19, 9, 0.0, "leaf", 0);
    sc.paint(S.custom((x, y, z) => { const a = Math.atan2(z, x); return Math.sin(a * 9) > 0.3 ? -1 : 1; }, [-1, -1, -1, 1, 1, 1]), { mat: "leafL", soft: 0.001, only: ["leaf"] });
    void sk;
    // wings (bounds padded ±9 cm in z: the voxelizer's block cull samples block centres through the prim grid, a thin plate's
    // tight bounds would miss them): flat panels two voxels thick in the plane z = WZ, a darker inner field, gold veins and a pale glowing rim
    for (const s of [1, -1]) {
      const n = sideName(s);
      for (const w of WINGS) {
        const r0 = [s * w.root[0], w.root[1]], d = norm([s * w.dir[0], w.dir[1], 0]), L = w.len, W = w.w;
        const prof = (u) => W * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.62))), 0.8) * (1 - 0.1 * u);
        const loc = (x, y) => { const px = x - r0[0], py = y - r0[1]; return [px * d[0] + py * d[1], -px * d[1] + py * d[0]]; };   // along, across
        // (the across term is divided by its slope so the field never overestimates the distance — block culling relies on it)
        const shape = (x, y, z) => {
          const [u, v] = loc(x, y), uu = clamp(u / L, 0.004, 0.996), p = prof(uu), vv = v * s + 0.25 * p;
          const g = 1.25 * (prof(Math.min(1, uu + 0.004)) - prof(Math.max(0, uu - 0.004))) / (0.008 * L);
          return Math.max((Math.abs(vv) - p) / Math.sqrt(1 + g * g), -u, u - L, Math.abs(z - WZ) - 0.004);
        };
        const bx = [r0[0] - 0.02, r0[0] + s * (L + 0.02)].sort((a, b) => a - b), by = [r0[1] - L - 0.02, r0[1] + L + 0.02];
        const wo = { wg: 3, sigma: 0.003, k: 0.002, cs: 0.03, vdil: 0.5 };
        sc.add(S.custom(shape, [bx[0], by[0], WZ - 0.09, bx[1], by[1], WZ + 0.09]), { ...wo, mat: "wing", p: [0, 0, 0], bone: "wing" + w.key + n });
        // paints stay inside their own panel (every panel is the same material, so an unbounded paint would colour the others)
        const at = (fn) => S.custom((x, y, z) => { const [u, v] = loc(x, y), uu = clamp(u / L, 0, 1); return Math.max(fn(u, v * s + 0.25 * prof(uu), prof(uu), uu), shape(x, y, WZ) - 0.012); }, [-1, -1, -1, 1, 1, 1]);
        sc.paint(at((u, v, p, uu) => Math.max(Math.abs(v) - p * 0.55, 0.05 - u)), { mat: "wingIn", soft: 0.001, only: ["wing"] });
        sc.paint(at((u, v, p) => p - 0.0085 - Math.abs(v)), { mat: "rim", soft: 0.001, only: ["wing"] });
        sc.paint(at((u, v, p, uu) => Math.min(Math.abs(v - 0.2 * p) - 0.004, Math.abs(v + 0.45 * p * uu) - 0.004, Math.abs(u - 0.62 * L) + Math.abs(v) * 0.2 - 0.005)), { mat: "vein", soft: 0.001, only: ["wing", "wingIn"] });
      }
      sc.add(S.sphere(0.014), { mat: "gold", p: [s * 0.03, 0.67, WZ + 0.004], bone: "wingU" + n, k: 0.002, wg: 3, sigma: 0.003, cs: 0.03 });
    }
    sc.part = "hair";
    hair(sc, P, q);
    sc.part = "body";
    return { sc, P, kind: "humanoid", props: [{ sc: orbProp(), bone: "orb", at: orbAt }] };
  }

  // ------------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = { q1: new EmberVesperThree.Quaternion(), q2: new EmberVesperThree.Quaternion(), q3: new EmberVesperThree.Quaternion(), e: new EmberVesperThree.Euler() });
  /** put the orb at model point m (it is a child of handL, so re-parented in hand space), spinning, scaled */
  function placeOrb(fig, C, m, spin, scale) {
    const { q1, q2, q3, e } = three(), o = fig.J.orb, h = fig.J.handL;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    o.position.copy(h.worldToLocal(C.toW(fig, m)));
    h.getWorldQuaternion(q1).invert();
    fig.root.getWorldQuaternion(q2);
    q3.setFromEuler(e.set(0.4 * Math.sin(spin * 0.6), spin, 0.3));
    o.quaternion.copy(q1.multiply(q2).multiply(q3));
    o.scale.setScalar(scale);
    o.updateMatrixWorld(true);
  }
  const HOVER = 0.11;
  function hoverBody(fig, C, T) {
    const bob = Math.sin(T * 2.1), drift = Math.sin(T * 0.7);
    C.off(fig, "root", 0.006 * drift, HOVER + 0.018 * bob, 0);
    C.rot(fig, "root", 0.06 + 0.02 * bob, 0.08 * Math.sin(T * 0.5), 0.03 * drift);
    C.rot(fig, "spine", 0.02, 0, -0.02); C.rot(fig, "chest", -0.04 - 0.02 * bob, 0.04 * drift, 0.02);
    C.rot(fig, "neck", -0.04, 0.05 * Math.sin(T * 0.6), 0.04); C.rot(fig, "head", 0.02 * Math.sin(T * 0.9), -0.12 + 0.1 * Math.sin(T * 0.43), 0.06);
    // legs: her left knee drawn up in front, the right shin folded back (as on the card)
    C.rot(fig, "thighL", -0.55 + 0.04 * bob, 0, -0.04); C.rot(fig, "shinL", 0.95 + 0.05 * bob, 0, 0); C.rot(fig, "footL", 0.55, 0, 0);
    C.rot(fig, "thighR", 0.12 - 0.04 * bob, 0, 0.05); C.rot(fig, "shinR", 1.05 - 0.05 * bob, 0, 0); C.rot(fig, "footR", 0.65, 0, 0);
    C.rot(fig, "hairB1", 0.1 + 0.05 * Math.sin(T * 1.6), 0, 0.04 * Math.sin(T * 1.1)); C.rot(fig, "hairB2", 0.12 + 0.07 * Math.sin(T * 1.6 - 0.8), 0, 0);
  }
  /** wings: sweep (back +) with a fast flutter, flap (up +) */
  function wings(fig, C, T, sweep, flutter, flap, speed = 1) {
    for (const s of [1, -1]) {
      const n = sideName(s), f = Math.sin(T * 13 * speed + (s > 0 ? 0 : 0.4));
      C.rot(fig, "wingU" + n, -0.05, s * (sweep + flutter * f), s * flap);
      C.rot(fig, "wingD" + n, 0.05, s * (sweep * 0.9 + flutter * Math.sin(T * 13 * speed - 1.1 + (s > 0 ? 0 : 0.4))), s * flap * 0.6);
    }
  }

  function pose(fig, clip, t, T, C) {
    if (clip !== "idle" && clip !== "attack" && clip !== "hurt" && clip !== "victory") return undefined;
    const V3 = C.V3, br = Math.sin(T * 2.1);
    C.base(fig, "idle", 0, T);
    hoverBody(fig, C, T);
    const shift = (x, y, z) => fig.J.root.position.add(V3(x, y, z));
    fig.root.updateMatrixWorld(true);
    let sweep = 0.42, flutter = 0.14, flap = 0, speed = 1, glow = 0.12 * (0.5 + 0.5 * Math.sin(T * 1.7)), face = null, done = true, osc = 1 + 0.05 * Math.sin(T * 4.3);
    // idle: left palm raised out to her side holding the orb; right arm loose and a little out
    const shL = C.toM(fig, C.wpos(fig.J.armL)), shR = C.toM(fig, C.wpos(fig.J.armR));
    let m = V3(shL.x + 0.15, shL.y + 0.01 + 0.008 * br, shL.z + 0.12), kR = 0, rhand = null;
    C.addRot(fig, "armR", 0.1, 0, -0.3); C.addRot(fig, "foreR", -0.25, 0, 0);
    if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      shift(0, 0.02 * k, -0.07 * k);
      C.addRot(fig, "root", -0.4 * k, 0, 0.1 * k); C.addRot(fig, "chest", -0.2 * k, 0, 0.08 * k); C.addRot(fig, "head", -0.25 * k, 0.2 * k, 0.1 * k);
      C.addRot(fig, "armR", 0, 0, -0.5 * k); C.addRot(fig, "thighL", 0.3 * k, 0, 0); C.addRot(fig, "thighR", -0.2 * k, 0, 0);
      m.add(V3(0.03 * k, 0.04 * k, -0.06 * k)); osc *= 1 - 0.4 * k;
      sweep -= 0.3 * k; flap += 0.35 * k; flutter += 0.1 * k;
      face = t < 0.45 ? "hurt" : null; done = t < 0.6;
    } else if (clip === "victory") {
      // a twirl upward, both arms raised, the orb flares over her head
      const up = C.bump(0, 0.3, 1.2, 1.6, t), spin = C.TAU * C.sstep(0.1, 1.1, t);
      shift(0, 0.06 * up, 0);
      C.addRot(fig, "root", -0.1 * up, spin, 0); C.addRot(fig, "head", -0.25 * up, 0, 0);
      C.addRot(fig, "armR", -2.2 * up, 0, 0.3 * up);
      fig.root.updateMatrixWorld(true);
      const hd = C.toM(fig, C.wpos(fig.J.head));
      m.lerp(V3(hd.x + 0.06, hd.y + 0.2, hd.z + 0.04), up);
      osc *= 1 + 0.35 * up; glow += 0.9 * up; speed = 1 + 0.5 * up; flap += 0.15 * up;
      face = up > 0.3 ? "closed" : null; done = t < 1.6;
    } else if (clip === "attack") {
      // draw the orb in to her chest, both hands round it, wings swept up (0-0.32) → lean in and push the left palm at the
      // target, release at 0.45 → the orb is gone → it re-forms over her palm and she settles (→1.2)
      const g = C.bump(0.02, 0.28, 0.32, 0.42, t), th = C.bump(0.32, 0.44, 0.64, 1.02, t), rel = C.bump(0.43, 0.46, 0.52, 0.75, t);
      shift(0, 0.02 * g - 0.015 * th, -0.03 * g + 0.06 * th);
      C.addRot(fig, "root", -0.12 * g + 0.2 * th, 0.25 * g - 0.15 * th, 0);
      C.addRot(fig, "chest", -0.06 * g + 0.08 * th, 0.1 * g - 0.1 * th, 0);
      C.addRot(fig, "head", 0.1 * g - 0.12 * th, -0.1 * g + 0.2 * th, -0.06);
      C.addRot(fig, "thighL", 0.2 * th, 0, 0); C.addRot(fig, "shinR", 0.2 * th, 0, 0);
      fig.root.updateMatrixWorld(true);
      const chest = C.toM(fig, C.wpos(fig.J.chest)).add(V3(0.02, 0.04, 0.17));
      const sL = C.toM(fig, C.wpos(fig.J.armL)), reach = (fig.char.P.upArm + fig.char.P.foreArm) * 0.95;
      const push = V3(sL.x - 0.02, sL.y + 0.02, sL.z + reach + 0.06);
      m = m.clone().lerp(chest, C.sstep(0.02, 0.28, t)).lerp(push, C.sstep(0.32, 0.43, t)).lerp(V3(shL.x + 0.15, shL.y + 0.01, shL.z + 0.12), C.sstep(0.7, 1.05, t));
      kR = g; rhand = chest.clone().add(V3(-0.07, 0.05, 0.0));
      const gone = C.sstep(0.45, 0.5, t) * (1 - C.sstep(0.7, 0.95, t));
      osc *= (1 + 0.45 * C.sstep(0.05, 0.3, t) * (1 - C.sstep(0.44, 0.47, t))) * (1 - 0.94 * gone);
      glow += 0.5 * C.sstep(0.05, 0.3, t) * (1 - C.sstep(0.46, 0.6, t)) + 1.1 * rel;
      sweep += 0.25 * g - 0.3 * th; flap += 0.25 * g - 0.1 * th; flutter += 0.08 * th; speed = 1 + 0.6 * g;
      face = t > 0.04 && t < 0.36 ? "focus" : th > 0.3 ? "fierce" : null; done = t < 1.2;
    }
    wings(fig, C, T, sweep, flutter, flap, speed);
    fig.root.updateMatrixWorld(true);
    // left hand under the orb, knuckles up; the right hand arches over it while she gathers
    const sl = C.toM(fig, C.wpos(fig.J.armL));
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, m.clone().add(V3(0.0, -0.065, -0.02))), C.toW(fig, V3(sl.x + 0.3, sl.y - 0.3, sl.z - 0.2)), 1);
    if (kR > 0.001 && rhand) {
      const sr = C.toM(fig, C.wpos(fig.J.armR));
      C.ik(fig, "armR", "foreR", "handR", C.toW(fig, rhand), C.toW(fig, V3(sr.x - 0.3, sr.y - 0.25, sr.z - 0.2)), kR);
    }
    void shR;
    placeOrb(fig, C, m, T * 1.8, Math.max(0.05, osc));
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    return done;
  }

  return {
    cards: ["wisp"], kind: "humanoid", build, pose, scale: 0.85,
    face: { kind: "human", look: { eye: 0x4fae6a, brow: "#a8a878", lash: "#2a2a1c", lip: "#d08a84", skinD: "#dcb4a0" } },
    moves: { attack: { clip: "cast", hit: 0.45, length: 1.2, style: "bolt", ranged: true, tint: 0x6cf29a, emitter: { bone: "orb", offset: [0, 0, 0] } } },
  };
})());
