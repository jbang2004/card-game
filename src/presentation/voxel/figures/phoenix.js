/* 不灭凤凰 — the undying phoenix (card phoenix): a great bird hovering upright, its wings raised in a tall V and curling in
 * at the tips (the card's heart-shaped silhouette), plumage white at the arm shading to sky and deep blue at the
 * feather ends, the tips lit ember-gold, a swept white-and-gold crest, a gold beak, long plumes streaming below, and the
 * signature: a golden flame burning in a gold ring at its breast. Own skeleton (kind "bird") and own clips: slow
 * hovering wingbeats, a diving wing-chop with the talons thrown forward, a flinch, and a rising victory beat.
 * Feathers, crest and plumes are cloth/hair parts (world lattice, one bone per feather); the body is rigid per bone. */
EmberVoxelKit.define("phoenix", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, add, sub, mul, lerp, norm, CLS, mats, sideName, spline } = K;

  // palette (from the card art: white-blue plumage, gold beak/crest, a golden flame heart) — one table to retint
  const PAL = {
    white: 0xcad9fd, light: 0x94b4f4, blue: 0x5480e4, deep: 0x2f4fb8, tip: 0xf4a838, seam: 0xa4b8e8,
    gold: 0xe0b85a, goldD: 0xa07a2c, flame: 0xf0a030, flameHot: 0xfff0c0, eye: 0x1c2c78,
  };

  // ---------------------------------------------------------------- landmarks (facing +Z, +X = its left)
  const B = {
    root: [0, 0.4, 0], chest: [0, 0.5, 0.02], neck: [0, 0.58, 0.05], neck2: [0, 0.665, 0.085], head: [0, 0.745, 0.08],
    tail: [[0, 0.34, -0.06], [0, 0.23, -0.11], [0, 0.12, -0.15]],
  };
  const HC = [0, 0.77, 0.1], Hs = 1.3;                               // skull centre, head scale (board readability)
  const WG = { S: [0.07, 0.56, -0.04], E: [0.2, 0.665, -0.09], W: [0.3, 0.84, -0.11], H: [0.35, 0.95, -0.12] };
  const wingOf = (s) => { const x = (p) => [p[0] * s, p[1], p[2]]; return { S: x(WG.S), E: x(WG.E), W: x(WG.W), H: x(WG.H), x }; };
  // primaries (hand, wing3): tips fanning from the top (curling in over the head) round to the outside
  const PRIM = [[0.27, 1.13, -0.04], [0.37, 1.13, -0.08], [0.46, 1.07, -0.11], [0.53, 0.97, -0.12], [0.57, 0.85, -0.12], [0.58, 0.72, -0.11], [0.56, 0.6, -0.1]];   // top tips cup forward
  const TRAIL = 2;
  // secondaries: the inner ones sweep down and in, so the lower lobes of the two wings close toward a point below the
  // body (the card's heart shape)
  const secTip = (w, s, u) => add(lerp(w.W, w.E, u), [s * (0.1 - 0.17 * u), -0.36 - 0.13 * u, -0.03 + 0.08 * u]);                                                    // the primary whose edge draws the slash trail

  function segD(p, a, b) {
    const ab = sub(b, a), ap = sub(p, a), t = clamp((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / Math.max(1e-12, ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]), 0, 1);
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
  }
  // a flat feather: spline through ctrl, radius r0 → r1, thin across z (the wing plane faces ±Z); bounds padded in z so
  // the voxelizer's block cull, which samples 8-voxel block centres through the prim grid, never misses a thin blade
  function feather(sc, ctrl, r0, r1, o) {
    const pts = spline(ctrl, 10).map((p, i) => [...p, mix(r0, r1, Math.pow(i / 10, 1.4)) * (1 + 0.25 * Math.sin(Math.PI * Math.min(1, i / 7)))]);
    const ch = S.chain(pts, 0.32);
    const sh = S.custom(ch.f, [ch.b[0], ch.b[1], ch.b[2] - 0.06, ch.b[3], ch.b[4], ch.b[5] + 0.06]);
    return sc.add(sh, Object.assign({ mat: "feather", p: [0, 0, 0], k: 0.004, cs: 0.03, wg: 3, sigma: 0.003, vdil: 0.55 }, o));
  }

  function build() {
    const sc = new Sculpture();
    sc.bone("root", null, ...B.root);
    sc.bone("chest", "root", ...B.chest); sc.bone("neck", "chest", ...B.neck); sc.bone("neck2", "neck", ...B.neck2); sc.bone("head", "neck2", ...B.head);
    sc.bone("tail1", "root", ...B.tail[0]); sc.bone("tail2", "tail1", ...B.tail[1]); sc.bone("tail3", "tail2", ...B.tail[2]);
    for (const s of [1, -1]) {
      const n = sideName(s), w = wingOf(s);
      sc.bone("wing1" + n, "chest", ...w.S); sc.bone("wing2" + n, "wing1" + n, ...w.E); sc.bone("wing3" + n, "wing2" + n, ...w.W);
      sc.bone("thigh" + n, "root", s * 0.045, 0.37, 0.02); sc.bone("shin" + n, "thigh" + n, s * 0.05, 0.3, 0.05); sc.bone("foot" + n, "shin" + n, s * 0.05, 0.235, 0.06);
    }
    mats(sc, {
      plume: { c: PAL.white, rough: 0.7, cls: CLS.fur, vary: 0.04 }, plumeB: { c: PAL.light, rough: 0.7, cls: CLS.fur, vary: 0.04 },
      seam: { c: PAL.seam, rough: 0.7, cls: CLS.fur },
      feather: { c: PAL.white, rough: 0.6, cls: CLS.cloth, vary: 0.03 }, light: { c: PAL.light, rough: 0.6, cls: CLS.cloth, vary: 0.03 },
      blue: { c: PAL.blue, rough: 0.55, cls: CLS.cloth, vary: 0.04 }, deep: { c: PAL.deep, rough: 0.55, cls: CLS.cloth, vary: 0.04 },
      tip: { c: PAL.tip, rough: 0.4, emit: 0.75, cls: CLS.glow },   // ember-lit feather ends
      gold: { c: PAL.gold, rough: 0.3, metal: 1, cls: CLS.metal }, goldD: { c: PAL.goldD, rough: 0.4, metal: 1, cls: CLS.metal },
      flame: { c: PAL.flame, rough: 0.3, emit: 1.1, cls: CLS.glow }, flameHot: { c: PAL.flameHot, rough: 0.3, emit: 1.8, cls: CLS.glow },
      eye: { c: PAL.eye, rough: 0.2, emit: 0.35, cls: CLS.glow },
    });
    const P = { mat: "plume" };
    // ---- body: an upright egg, the breast puffed forward, a long S neck, an oversized head
    sc.add(S.ell(0.085, 0.12, 0.085), { ...P, p: [0, 0.43, -0.01], r: [0.25, 0, 0], bone: "root", k: 0.03 });
    sc.add(S.ell(0.08, 0.085, 0.075), { ...P, p: [0, 0.515, 0.035], r: [0.3, 0, 0], bone: "chest", k: 0.03 });
    const nk = spline([[0, 0.55, 0.04], [0, 0.62, 0.085], [0, 0.69, 0.08], [0, 0.75, 0.085]], 9).map((p, i) => [...p, mix(0.05, 0.033, i / 9)]);
    sc.add(S.chain(nk.slice(0, 4)), { ...P, p: [0, 0, 0], bone: "neck", k: 0.02 });
    sc.add(S.chain(nk.slice(3, 8)), { ...P, p: [0, 0, 0], bone: "neck2", k: 0.02 });
    sc.add(S.ell(0.042 * Hs, 0.04 * Hs, 0.05 * Hs), { ...P, p: HC, bone: "head", k: 0.02 });
    // beak: a gold wedge with a hooked tip, dark gape line
    const bk = spline([[0, HC[1] - 0.004, HC[2] + 0.045 * Hs], [0, HC[1] - 0.012, HC[2] + 0.09 * Hs], [0, HC[1] - 0.03, HC[2] + 0.108 * Hs]], 6).map((p, i) => [...p, mix(0.022, 0.004, i / 6)]);
    sc.add(S.chain(bk), { mat: "gold", p: [0, 0, 0], bone: "head", k: 0.006, vdil: 0.5 });
    sc.paint(S.box(0.03, 0.0035, 0.05), { mat: "goldD", p: [0, HC[1] - 0.016, HC[2] + 0.08 * Hs], soft: 0.001, only: ["gold"] });
    // eyes: deep blue glints on the sides of the head under a white brow
    for (const s of [1, -1]) sc.add(S.ell(0.006, 0.009, 0.012), { mat: "eye", p: [s * 0.043 * Hs, HC[1] + 0.006, HC[2] + 0.02 * Hs], r: [0, s * 0.5, 0], bone: "head", k: 0.002, vdil: 0.6 });
    // back and nape blue, the breast and face white, a scalloped feather pattern on the breast
    sc.paint(S.custom((x, y, z) => z + 0.02 - 0.12 * (y - 0.45), [-1, -1, -1, 1, 1, 1]), { mat: "plumeB", soft: 0.002, only: ["plume"] });
    sc.paint(S.custom((x, y, z) => (Math.floor((y + 0.9 * Math.abs(x)) / 0.0125) % 3 === 0 && z > 0.03 && y < 0.6 ? -1 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "seam", soft: 0.001, only: ["plume"] });
    // ---- the flame heart: a gold ring on the breast with a golden flame burning in it, a drop pendant below
    const HP = [0, 0.47, 0.1], f = 1.3;   // heart centre, scale (the signature must read at board size)
    sc.add(S.torus(0.042 * f, 0.009), { mat: "gold", p: HP, r: [Math.PI / 2 - 0.3, 0, 0], bone: "chest", k: 0.002, vdil: 0.55 });
    const fl = [[0, HP[1] - 0.03 * f, HP[2] + 0.004, 0.028 * f], [0, HP[1] - 0.004 * f, HP[2] + 0.012, 0.03 * f], [0, HP[1] + 0.03 * f, HP[2] + 0.01, 0.017 * f], [0.006, HP[1] + 0.062 * f, HP[2] + 0.004, 0.004]];
    sc.add(S.chain(fl), { mat: "flame", p: [0, 0, 0], bone: "chest", k: 0.006 });
    for (const s of [1, -1]) sc.add(S.chain([[s * 0.02 * f, HP[1] - 0.01, HP[2] + 0.006, 0.012 * f], [s * 0.034 * f, HP[1] + 0.03 * f, HP[2], 0.003]]), { mat: "flame", p: [0, 0, 0], bone: "chest", k: 0.004, vdil: 0.55 });
    sc.paint(S.ell(0.018 * f, 0.026 * f, 0.05), { mat: "flameHot", p: [0, HP[1] - 0.004, HP[2] + 0.02], soft: 0.002, only: ["flame"] });
    sc.add(S.chain([[0, HP[1] - 0.06, HP[2] - 0.006, 0.006], [0, HP[1] - 0.085, HP[2] - 0.012, 0.009], [0, HP[1] - 0.1, HP[2] - 0.014, 0.002]]), { mat: "gold", p: [0, 0, 0], bone: "chest", k: 0.003, vdil: 0.55 });
    // ---- legs: feathered thighs, gold shanks, three forward talons and a hind one
    for (const s of [1, -1]) {
      const n = sideName(s);
      sc.add(S.ell(0.04, 0.05, 0.045), { ...P, p: [s * 0.045, 0.34, 0.03], bone: "thigh" + n, k: 0.02 });
      sc.limb([s * 0.05, 0.3, 0.05], [s * 0.05, 0.235, 0.06], 0.012, 0.01, { mat: "gold", bone: "shin" + n, k: 0.004 });
      for (const c of [-1, 0, 1]) sc.limb([s * 0.05, 0.232, 0.062], [s * 0.05 + c * 0.02, 0.21, 0.1], 0.007, 0.0025, { mat: "goldD", bone: "foot" + n, k: 0.003, vdil: 0.5 });
      sc.limb([s * 0.05, 0.232, 0.058], [s * 0.05, 0.215, 0.03], 0.006, 0.0025, { mat: "goldD", bone: "foot" + n, k: 0.003, vdil: 0.5 });
    }

    // ---- wings (cloth: world lattice, each feather on its own bone)
    sc.inPart("cloth", () => {
      for (const s of [1, -1]) {
        const n = sideName(s), w = wingOf(s), b1 = "wing1" + n, b2 = "wing2" + n, b3 = "wing3" + n;
        // leading edge: a thick white arm with a covert ridge
        sc.limb(w.S, w.E, 0.034, 0.028, { mat: "feather", bone: b1, k: 0.01, cs: 0.03, wg: 3, sigma: 0.003 });
        sc.limb(w.E, w.W, 0.028, 0.022, { mat: "feather", bone: b2, k: 0.01, cs: 0.03, wg: 3, sigma: 0.003 });
        sc.limb(w.W, w.H, 0.022, 0.012, { mat: "feather", bone: b3, k: 0.008, cs: 0.03, wg: 3, sigma: 0.003 });
        // primaries off the hand, curling in at the top
        PRIM.forEach((tp, i) => {
          const t = w.x(tp), root = lerp(w.W, w.H, clamp(1 - i / 5, 0, 1)), mid = add(lerp(root, t, 0.5), [s * 0.018 * (i < 2 ? -1 : 1), 0.012, -0.008]);
          feather(sc, [root, mid, t], 0.03, 0.011, { bone: b3 });
        });
        // secondaries off the forearm, hanging down and out into the lower lobe of the wing
        for (let i = 0; i < 6; i++) {
          const u = i / 5, root = lerp(w.W, w.E, u), t = secTip(w, s, u);
          feather(sc, [root, add(lerp(root, t, 0.5), [s * 0.02, 0, 0]), t], 0.034, 0.012, { bone: b2 });
        }
        // tertials off the upper arm, shorter, tucking in toward the body
        for (let i = 0; i < 3; i++) {
          const u = 0.25 + 0.35 * i, root = lerp(w.E, w.S, u), t = add(root, [s * (0.035 - 0.015 * i), -0.28 + 0.03 * i, -0.03]);
          feather(sc, [root, lerp(root, t, 0.5), t], 0.034, 0.013, { bone: b1 });
        }
        // plumage bands by distance from the arm: white → sky → blue → deep, glowing cyan tips
        const armD = (x, y, z) => { const p = [x, y, z]; return Math.min(segD(p, w.S, w.E), segD(p, w.E, w.W), segD(p, w.W, w.H)); };
        const side = (x) => s * x > 0.02 ? 0 : 1;   // stay on this side of the body
        sc.paint(S.custom((x, y, z) => Math.max(0.075 - armD(x, y, z), side(x)), [-1, -1, -1, 1, 1, 1]), { mat: "light", soft: 0.002, only: ["feather"] });
        sc.paint(S.custom((x, y, z) => Math.max(0.15 - armD(x, y, z), side(x)), [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.002, only: ["feather"] });
        sc.paint(S.custom((x, y, z) => Math.max(0.23 - armD(x, y, z), side(x)), [-1, -1, -1, 1, 1, 1]), { mat: "deep", soft: 0.002, only: ["feather"] });
        const tips = [...PRIM.map(w.x), ...[0, 1, 2, 3, 4, 5].map((i) => secTip(w, s, i / 5))];
        sc.paint(S.custom((x, y, z) => Math.max(0.3 - armD(x, y, z), side(x)), [-1, -1, -1, 1, 1, 1]), { mat: "tip", soft: 0.002, only: ["feather"] });
        for (const t of tips) sc.paint(S.sphere(0.05), { mat: "tip", p: t, soft: 0.002, only: ["feather", "light", "blue", "deep"] });
      }
      // tail: five long plumes streaming down behind the legs, fanned, curling at the ends
      const twf = (x, y) => { const u = clamp((0.36 - y) / 0.32, 0, 1); return [["root", 1 - sstep(0, 0.2, u)], ["tail1", sstep(0, 0.2, u) * (1 - sstep(0.3, 0.55, u))], ["tail2", sstep(0.3, 0.55, u) * (1 - sstep(0.65, 0.9, u))], ["tail3", sstep(0.65, 0.9, u)]]; };
      [[-0.16, 0.06, -0.19], [-0.08, 0.02, -0.23], [0, -0.005, -0.25], [0.08, 0.02, -0.23], [0.16, 0.06, -0.19]].forEach(([x, y, z], i) => {
        const root = [x * 0.12, 0.34, -0.06], c = Math.sign(x) || 1, tip = [x + c * 0.045, y + 0.03, z + 0.03];
        feather(sc, [root, [x * 0.45, 0.22, z * 0.7], [x * 0.9, y + 0.07, z], tip], 0.024, 0.011, { mat: "feather", bone: "tail2" }).wfn = twf;
        sc.paint(S.sphere(0.05), { mat: "tip", p: tip, soft: 0.002, only: ["feather", "light", "blue", "deep"] });
      });
      sc.paint(S.custom((x, y, z) => Math.max(y - 0.26, z + 0.02), [-1, -1, -1, 1, 1, 1]), { mat: "light", soft: 0.002, only: ["feather"] });
      sc.paint(S.custom((x, y, z) => Math.max(y - 0.16, z + 0.02), [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.002, only: ["feather", "light"] });
    });
    // ---- crest (hair part on the head): three long plumes swept up and back, the middle one gold
    sc.inPart("hair", () => {
      [[0, 0.12, "gold"], [0.028, 0.1, "plume"], [-0.028, 0.1, "plume"], [0.045, 0.075, "plumeB"], [-0.045, 0.075, "plumeB"]].forEach(([x, L, mat]) => {
        const r = [x, HC[1] + 0.04 * Hs, HC[2] - 0.01];
        const pts = spline([r, [x * 1.4, r[1] + L * 0.6, r[2] - L * 0.4], [x * 1.8, r[1] + L * 0.9, r[2] - L * 1.0], [x * 2.1, r[1] + L * 0.95, r[2] - L * 1.4]], 10).map((p, i) => [...p, mix(0.016, 0.004, i / 10)]);
        sc.add(S.chain(pts, 0.6), { mat, p: [0, 0, 0], bone: "head", k: 0.004, vdil: 0.55 });
      });
      // cheek feathers sweeping back from behind the eyes
      for (const s of [1, -1]) sc.add(S.chain(spline([[s * 0.045 * Hs, HC[1] - 0.01, HC[2] - 0.01], [s * 0.056 * Hs, HC[1] - 0.004, HC[2] - 0.05], [s * 0.052 * Hs, HC[1] + 0.01, HC[2] - 0.09]], 6).map((p, i) => [...p, mix(0.012, 0.003, i / 6)])), { mat: "plumeB", p: [0, 0, 0], bone: "head", k: 0.004, vdil: 0.55 });
    });
    return { sc, kind: "bird", props: [] };
  }

  // ---------------------------------------------------------------- motion
  /* per-side wing: flap (+ = raised), sweep (+ = back), fold (+ = elbow/wrist bent down), twist (+ = leading edge up) */
  function wings(fig, C, s, flap, sweep, fold, twist) {
    const n = sideName(s);
    C.rot(fig, "wing1" + n, twist, s * sweep, s * flap);
    C.rot(fig, "wing2" + n, 0, s * sweep * 0.3, -s * fold);
    C.rot(fig, "wing3" + n, 0, 0, -s * fold * 0.7);
  }
  const HOVER = 0.06;
  function pose(fig, clip, t, T, C) {
    if (clip !== "idle" && clip !== "attack" && clip !== "hurt" && clip !== "victory") return undefined;
    const { rot, off, bump, sstep: ss } = C;
    // hovering: slow deep wingbeats, the body rising on the downstroke; plumes trail and sway
    const ph = T * 2.4, beat = Math.sin(ph), lag = Math.sin(ph - 0.7);
    let y = HOVER + 0.018 * Math.sin(ph + Math.PI * 0.8), z = 0, pitch = 0.04, yaw = 0.06 * Math.sin(T * 0.45), roll = 0.03 * Math.sin(T * 0.7);
    let flap = 0.14 * beat, sweep = 0.12 + 0.05 * beat, fold = 0.1 * lag, twist = 0.05 * beat;
    let neck = -0.04 + 0.02 * Math.sin(ph + 1), head = 0.03 * Math.sin(T * 0.9), headY = 0.18 * Math.sin(T * 0.5), tail = 0.08 + 0.05 * Math.sin(ph - 1.2), tailY = 0.08 * Math.sin(T * 0.8);
    let legs = 0.1, glow = 0.25 + 0.15 * Math.sin(T * 5.3) * Math.sin(T * 3.1), done = true;
    let fL = 0, fR = 0;   // extra per-side flap
    if (clip === "attack") {
      // rise and rear back, wings high (0-0.28) → dive at the target, both wings chop forward and down, talons thrown
      // forward (contact 0.42) → follow through (→0.6) → beat back up to the hover (→1.1)
      const up = bump(0, 0.26, 0.28, 0.38, t), dv = bump(0.28, 0.4, 0.6, 1.0, t), chop = ss(0.3, 0.42, t) * (1 - ss(0.6, 0.98, t));
      const shake = bump(0.42, 0.45, 0.52, 0.6, t) * Math.sin(t * 80) * 0.02;
      y += 0.08 * up - 0.07 * dv; z += -0.06 * up + 0.24 * dv;
      pitch += -0.35 * up + 0.55 * dv + shake;
      flap += 0.4 * up - 0.95 * chop; sweep += 0.35 * up - 0.95 * chop; fold += -0.15 * up + 0.25 * chop; twist += 0.2 * up - 0.3 * chop;
      fR -= 0.15 * chop;
      neck += -0.3 * up + 0.35 * dv; head += 0.25 * up - 0.45 * dv; headY *= 1 - Math.max(up, dv);
      tail += -0.2 * up + 0.7 * dv; legs += 0.3 * up - 1.1 * dv;
      glow += 0.3 * up + 1.3 * bump(0.36, 0.42, 0.5, 0.75, t);
      done = t < 1.1;
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * ss(0, 0.05, t);
      y += 0.02 * k; z -= 0.07 * k; pitch -= 0.35 * k; roll += 0.1 * k;
      flap += 0.35 * k; sweep -= 0.2 * k; fold -= 0.15 * k;
      neck -= 0.3 * k; head -= 0.3 * k; headY += 0.3 * k; tail -= 0.3 * k; legs += 0.3 * k;
      glow *= 1 - 0.6 * k;
      done = t < 0.6;
    } else if (clip === "victory") {
      // climb with three great beats, head thrown back in a cry, the heart blazing
      const upv = bump(0, 0.3, 1.2, 1.6, t), b = Math.sin(clamp(t / 1.2, 0, 1) * Math.PI * 6) * upv;
      y += 0.08 * upv + 0.02 * b; pitch -= 0.12 * upv;
      flap += 0.3 * b + 0.1 * upv; sweep += 0.1 * b; fold += 0.12 * Math.sin(clamp(t / 1.2, 0, 1) * Math.PI * 6 - 0.8) * upv;
      neck -= 0.25 * upv; head -= 0.45 * upv; headY *= 1 - upv; tail += 0.15 * upv;
      glow += 1.2 * upv;
      done = t < 1.6;
    }
    off(fig, "root", 0, y, z);
    rot(fig, "root", pitch, yaw, roll);
    rot(fig, "chest", 0.02 * beat, 0, 0);
    rot(fig, "neck", neck, headY * 0.3, 0); rot(fig, "neck2", neck * 0.6, headY * 0.3, 0); rot(fig, "head", head, headY * 0.4, 0.04 * Math.sin(T * 0.6));
    wings(fig, C, 1, flap + fL, sweep, fold, twist); wings(fig, C, -1, flap + fR, sweep, fold, twist);
    rot(fig, "tail1", tail, tailY, 0); rot(fig, "tail2", tail * 0.6 + 0.06 * Math.sin(ph - 1.8), tailY * 1.2, 0); rot(fig, "tail3", tail * 0.4 + 0.08 * Math.sin(ph - 2.4), tailY * 1.4, 0);
    for (const n of ["L", "R"]) { rot(fig, "thigh" + n, -legs, 0, 0); rot(fig, "shin" + n, 0.35 + 0.3 * Math.max(0, legs), 0, 0); rot(fig, "foot" + n, -0.2 + 0.5 * Math.min(0, -legs + 0.1), 0, 0); }
    C.emitBoost(fig, glow);
    return done;
  }

  const trailTip = sub(wingOf(-1).x(PRIM[TRAIL]), wingOf(-1).W);
  return {
    cards: ["phoenix"], kind: "bird", build, scale: 1.15, pose,
    moves: { attack: { clip: "dive", hit: 0.42, length: 1.1, style: "slash", tint: 0x8fd8ff, trail: { bone: "wing3R", from: [0, 0, 0], to: trailTip.map((v) => +v.toFixed(3)) } } },
  };
})());
