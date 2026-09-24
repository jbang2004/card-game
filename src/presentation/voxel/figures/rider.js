/* 霜牙狼骑 — the frost-fang wolf rider (card rider): an armoured knight in steel-blue plate with ice-crystal pauldrons,
 * a white fur mantle, a helm with a glowing visor and a tall crystal crest, and a blue cape streaming back, riding a
 * big white-and-blue frost wolf in crystal barding (a chamfron with an ice horn, shoulder spikes, glowing eyes).
 * One sculpture on one skeleton: the wolf's quadruped bones, and the rider's own chain (hips on the wolf's spine →
 * torso → chest → head, two arms) so the rider rides every motion of the mount. The ice blade is a prop in the
 * rider's right fist. Attack: the wolf lunges while the rider raises the blade and cuts down (slash). */
EmberVoxelKit.define("rider", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, rotY2, add, sub, mul, lerp, norm, X, CLS, mats, sideName, quadBones, spline } = K;
  const k = 1.08;
  const P3 = (x, y, z) => [x * k, y * k, z * k];
  const G = {
    root: P3(0, 0.285, -0.14), spine: P3(0, 0.3, -0.02), chest: P3(0, 0.31, 0.1), neck: P3(0, 0.35, 0.17), head: P3(0, 0.405, 0.235), jaw: P3(0, 0.385, 0.3),
    tail: [P3(0, 0.3, -0.21), P3(0, 0.27, -0.28), P3(0, 0.22, -0.33)],
    front: [P3(0.05, 0.33, 0.13), P3(0.052, 0.2, 0.115), P3(0.05, 0.075, 0.135), P3(0.05, 0.024, 0.155)],
    back: [P3(0.055, 0.3, -0.16), P3(0.058, 0.19, -0.105), P3(0.054, 0.095, -0.195), P3(0.054, 0.024, -0.17)],
    ear: P3(0.03, 0.47, 0.235),
  };
  // the rider, seated on the wolf's back (model space, not scaled with the mount)
  const seatY = G.spine[1] + 0.1, seatZ = G.spine[2] - 0.01;
  const R = {
    hip: [0, seatY + 0.02, seatZ], waist: [0, seatY + 0.07, seatZ], chest: [0, seatY + 0.15, seatZ - 0.005], neck: [0, seatY + 0.215, seatZ - 0.005],
    sh: (s) => [s * 0.085, seatY + 0.19, seatZ - 0.005],
    el: (s) => (s > 0 ? [0.11, seatY + 0.12, seatZ + 0.03] : [-0.115, seatY + 0.125, seatZ + 0.035]),
    wr: (s) => (s > 0 ? [0.075, seatY + 0.085, seatZ + 0.1] : [-0.1, seatY + 0.105, seatZ + 0.11]),
    knee: (s) => [s * 0.09, seatY - 0.035, seatZ + 0.07], ank: (s) => [s * 0.095, seatY - 0.12, seatZ + 0.03],
  };

  function blade() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      ice: { c: 0x9fd6ff, rough: 0.2, metal: 0.3, emit: 0.45, cls: CLS.glow, vary: 0.05 }, iceCore: { c: 0xe8f8ff, rough: 0.15, emit: 1.0, cls: CLS.glow },
      grip: { c: 0x243052, rough: 0.7, cls: CLS.leather }, steel: { c: 0x8ea4c8, rough: 0.3, metal: 1, cls: CLS.metal },
    });
    sc.limb([0, -0.06, 0], [0, 0.03, 0], 0.009, 0.009, { mat: "grip", bone: "p", k: 0.002 });
    sc.add(S.ell(0.012, 0.012, 0.012), { mat: "steel", p: [0, -0.066, 0], bone: "p", k: 0.002 });
    // crystal crossguard: two ice spurs angled up
    for (const s of [1, -1]) sc.limb([0, 0.035, 0], [s * 0.05, 0.06, 0], 0.009, 0.003, { mat: "ice", bone: "p", k: 0.003, vdil: 0.5 });
    // long faceted blade: diamond section, widening then tapering to a point, a bright core down the middle
    const L = 0.34, W = 0.026;
    const bladeSh = S.custom((x, y, z) => {
      const u = clamp(y / L, 0, 1), w = W * (0.75 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u)) * (1 - Math.pow(u, 3)) + 0.002;
      return Math.max(Math.abs(x) / w + Math.abs(z) / 0.009 - 1, -y, y - L) * Math.min(w, 0.009);
    }, [-W * 1.3, 0, -0.01, W * 1.3, L, 0.01]);
    sc.add(bladeSh, { mat: "ice", p: [0, 0.04, 0], bone: "p", k: 0.001 });
    sc.paint(S.box(0.005, L * 0.4, 0.02), { mat: "iceCore", p: [0, 0.04 + L * 0.42, 0], soft: 0.003 });
    return sc;
  }

  function build() {
    const sc = new Sculpture();
    const Hs = 1.12 * k, Ps = 1.3;
    quadBones(sc, G);
    // rider chain
    sc.bone("rHip", "spine", ...R.hip); sc.bone("rTorso", "rHip", ...R.waist); sc.bone("rChest", "rTorso", ...R.chest); sc.bone("rHead", "rChest", ...R.neck);
    for (const s of [1, -1]) { const n = sideName(s); sc.bone("rArm" + n, "rChest", ...R.sh(s)); sc.bone("rFore" + n, "rArm" + n, ...R.el(s)); sc.bone("rHand" + n, "rFore" + n, ...R.wr(s)); }
    sc.bone("rCape", "rChest", 0, seatY + 0.18, seatZ - 0.07);
    mats(sc, {
      // mount
      fur: { c: 0xb0bef0, rough: 0.85, cls: CLS.fur, vary: 0.07, fur: 1 }, furBlue: { c: 0x4f68b4, rough: 0.85, cls: CLS.fur, vary: 0.1, fur: 1 },
      furLight: { c: 0xc4d2ff, rough: 0.85, cls: CLS.fur, vary: 0.05, fur: 0.8 }, furLeg: { c: 0xa2b0ea, rough: 0.85, cls: CLS.fur, vary: 0.06, fur: 0.3 },
      furFace: { c: 0xb6c4f2, rough: 0.85, cls: CLS.fur, vary: 0.05, fur: 0.25 }, nose: { c: 0x10121c, rough: 0.3, cls: CLS.skin }, mouth: { c: 0x2a1822, rough: 0.6, cls: CLS.skin },
      fang: { c: 0xdde6ff, rough: 0.3, cls: CLS.skin }, claw: { c: 0x2c3456, rough: 0.4, cls: CLS.skin }, earIn: { c: 0x3c4a80, rough: 0.8, cls: CLS.skin },
      eye: { c: 0xbfeaff, rough: 0.2, emit: 2.2, cls: CLS.glow },
      crystal: { c: 0x8cc8ff, rough: 0.2, metal: 0.3, emit: 0.35, cls: CLS.glow, vary: 0.05 }, crystalHi: { c: 0xdff4ff, rough: 0.15, emit: 0.8, cls: CLS.glow },
      steel: { c: 0x5c6f9c, rough: 0.3, metal: 0.7, cls: CLS.metal, vary: 0.03 }, steelD: { c: 0x2c3658, rough: 0.35, metal: 0.8, cls: CLS.metal },
      steelL: { c: 0x8ea6e0, rough: 0.25, metal: 0.8, cls: CLS.metal }, strap: { c: 0x232a44, rough: 0.7, cls: CLS.leather },
      // rider
      mantle: { c: 0xc8d6ff, rough: 0.9, cls: CLS.fur, vary: 0.05, fur: 0.9 }, cape: { c: 0x3c5eb4, rough: 0.8, cls: CLS.cloth, vary: 0.05 }, capeIn: { c: 0x22356e, rough: 0.8, cls: CLS.cloth },
      visor: { c: 0x9fe4ff, rough: 0.2, emit: 2.0, cls: CLS.glow }, under: { c: 0x1c2240, rough: 0.6, cls: CLS.cloth },
    });
    const furD = (amp, f = 70) => (x, yy, z) => { const u = z * f * 0.45 + 1.8 * vnoise(x * f * 0.35, yy * f * 0.35, 3.1); const fr = u - Math.floor(u); return amp * (fr * fr) * (0.6 + 0.4 * vnoise(x * f, yy * f, z * f)); };
    const fk = (a, f) => ({ disp: furD(a, f), dispAmp: a });
    const spike = (base, dir, len, r, mat, bone, o = {}) => sc.limb(base, add(base, mul(norm(dir), len)), r, 0.0015, Object.assign({ mat, bone, k: 0.004, vdil: 0.5 }, o));

    // ================= mount: frost wolf
    sc.add(S.ell(0.08 * k, 0.098 * k, 0.115 * k), { mat: "fur", p: add(G.chest, P3(0, -0.02, 0)), bone: "chest", k: 0.04, ...fk(0.007) });
    sc.add(S.ell(0.064 * k, 0.07 * k, 0.11 * k), { mat: "fur", p: add(G.spine, P3(0, -0.01, 0)), bone: "spine", k: 0.05, sigma: 0.03, ...fk(0.006) });
    sc.add(S.ell(0.066 * k, 0.076 * k, 0.08 * k), { mat: "fur", p: add(G.root, [0, -0.005, 0]), bone: "root", k: 0.045, ...fk(0.006) });
    const hc = add(G.head, [0, 0.018 * Hs, 0.018 * Hs]);
    sc.limb(add(G.chest, P3(0, 0.02, 0.05)), add(hc, [0, -0.02 * Hs, -0.03 * Hs]), 0.07 * k, 0.05 * Hs, { mat: "fur", bone: "neck", k: 0.04, bones: [["neck", 0.7], ["chest", 0.3]], ...fk(0.008) });
    sc.add(S.ell(0.075 * k, 0.09 * k, 0.06 * k), { mat: "furLight", p: add(G.chest, P3(0, 0.0, 0.095)), bone: "chest", bones: [["chest", 0.55], ["neck", 0.45]], k: 0.035, ...fk(0.02, 50) });
    // head: snarling, mouth open, fangs
    sc.add(S.ell(0.046 * Hs, 0.04 * Hs, 0.05 * Hs), { mat: "furFace", p: hc, bone: "head", k: 0.02, ...fk(0.003) });
    for (const s of [1, -1]) sc.add(S.ell(0.028 * Hs, 0.026 * Hs, 0.028 * Hs), { mat: "furLight", p: add(hc, [s * 0.038 * Hs, -0.022 * Hs, 0.004]), bone: "head", k: 0.02, ...fk(0.012, 70) });
    const mzL = 0.078;
    sc.limb(add(hc, [0, -0.008 * Hs, 0.028 * Hs]), add(hc, [0, -0.016 * Hs, (0.03 + mzL) * Hs]), 0.027 * Hs, 0.016 * Hs, { mat: "furFace", bone: "head", k: 0.018, sx: 1.05 });
    sc.add(S.ell(0.012 * Hs, 0.009 * Hs, 0.009 * Hs), { mat: "nose", p: add(hc, [0, -0.009 * Hs, (0.036 + mzL) * Hs + 0.002 * Hs]), bone: "head", k: 0.006, cs: 0.05 });
    sc.limb(add(hc, [0, -0.038 * Hs, 0.03 * Hs]), add(hc, [0, -0.044 * Hs, (0.03 + mzL * 0.8) * Hs]), 0.015 * Hs, 0.01 * Hs, { mat: "furLight", bone: "jaw", k: 0.01 });
    sc.paint(S.ell(0.022 * Hs, 0.007 * Hs, 0.034 * Hs), { mat: "mouth", p: add(hc, [0, -0.03 * Hs, (0.03 + mzL * 0.55) * Hs]), soft: 0.002 });
    for (const s of [1, -1]) spike(add(hc, [s * 0.013 * Hs, -0.024 * Hs, (0.03 + mzL * 0.8) * Hs]), [0, -1, 0.1], 0.016 * Hs, 0.0042, "fang", "head", { k: 0.002 });
    for (const s of [1, -1]) sc.add(S.ell(0.011 * Hs, 0.0055 * Hs, 0.007 * Hs), { mat: "eye", p: add(hc, [s * 0.022 * Hs, 0.004 * Hs, 0.043 * Hs]), r: [0, s * 0.35, s * 0.3], bone: "head", k: 0.003, cs: 0.03 });
    // chamfron: a crystal plate down the brow and nose, an ice horn on the forehead
    sc.add(S.box(0.022 * Hs, 0.006, 0.05 * Hs, 0.004), { mat: "crystal", p: add(hc, [0, 0.024 * Hs, 0.05 * Hs]), r: [0.28, 0, 0], bone: "head", k: 0.003 });
    spike(add(hc, [0, 0.03 * Hs, 0.02 * Hs]), [0, 1, 0.35], 0.06 * Hs, 0.012 * Hs, "crystal", "head");
    for (const s of [1, -1]) spike(add(hc, [s * 0.03 * Hs, 0.022 * Hs, 0.02 * Hs]), [s * 0.5, 0.8, -0.2], 0.035 * Hs, 0.008 * Hs, "crystal", "head");
    for (const s of [1, -1]) {
      const n = sideName(s), base = add(hc, [s * 0.03 * Hs, 0.024 * Hs, -0.012]), tip = add(base, [s * 0.016 * Hs, 0.058 * Hs, -0.03]);
      sc.limb(base, tip, 0.022 * Hs, 0.002, { mat: "furFace", bone: "ear" + n, k: 0.012, sz: 0.42 });
      sc.add(S.ell(0.011 * Hs, 0.024 * Hs, 0.0045), { mat: "earIn", op: "sub", p: add(lerp(base, tip, 0.38), [0, 0, 0.011]), R: rotY2(...sub(tip, base)), bone: "ear" + n, k: 0.004, cut: "earIn" });
    }
    // legs, with crystal greaves on the forelegs
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.add(S.ell(0.042 * k, 0.078 * k, 0.056 * k), { mat: "fur", p: add(F[0], P3(0, -0.04, -0.004)), bone: "scap" + n, bones: [["scap" + n, 0.7], ["chest", 0.3]], k: 0.035, ...fk(0.006) });
      sc.limb(F[0], F[1], 0.035 * k, 0.026 * k, { mat: "fur", bone: "scap" + n, k: 0.025, ...fk(0.006) });
      sc.limb(F[1], F[2], 0.022 * k, 0.017 * k, { mat: "furLeg", bone: "elb" + n, k: 0.012 });
      sc.limb(F[2], F[3], 0.017 * k, 0.019 * k, { mat: "furLeg", bone: "wri" + n, k: 0.01 });
      sc.add(S.ell(0.025 * Ps, 0.017 * Ps, 0.03 * Ps), { mat: "furLight", p: add(F[3], [0, -0.004, 0.012]), bone: "fpaw" + n, k: 0.01 });
      sc.add(S.ell(0.024 * k, 0.05 * k, 0.022 * k), { mat: "crystal", p: add(lerp(F[1], F[2], 0.45), [s * 0.004, 0, 0.008]), bone: "elb" + n, k: 0.004 });
      sc.add(S.ell(0.052 * k, 0.086 * k, 0.062 * k), { mat: "fur", p: add(B[0], P3(0, -0.04, 0.012)), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.035, ...fk(0.006) });
      sc.limb(B[1], B[2], 0.026 * k, 0.016 * k, { mat: "furLeg", bone: "stif" + n, k: 0.014 });
      sc.limb(B[2], B[3], 0.016 * k, 0.018 * k, { mat: "furLeg", bone: "hock" + n, k: 0.01 });
      sc.add(S.ell(0.024 * Ps, 0.016 * Ps, 0.029 * Ps), { mat: "furLight", p: add(B[3], [0, -0.004, 0.012]), bone: "bpaw" + n, k: 0.01 });
      for (const [P4, bn] of [[F[3], "fpaw" + n], [B[3], "bpaw" + n]]) for (let c = -1; c <= 1; c++) sc.add(S.ell(0.0035, 0.0035, 0.005), { mat: "claw", p: add(P4, [c * 0.011 * Ps, -0.008, 0.036 * Ps]), bone: bn, k: 0.002 });
      // crystal spikes over the shoulder
      for (let i = 0; i < 3; i++) spike(add(F[0], [s * 0.035, 0.025 - 0.02 * i, -0.01 - 0.025 * i]), [s * 0.8, 0.6, -0.3], (0.05 - 0.01 * i) * k, 0.011 * k, i ? "crystal" : "crystalHi", "scap" + n);
    }
    // blue streaks through the white coat (as the card: blue saddle, cheek and shoulder markings)
    sc.paint(S.ell(0.075 * k, 0.04 * k, 0.2 * k), { mat: "furBlue", p: [0, G.spine[1] + 0.06 * k, -0.02], soft: 0.03, amt: 0.85, only: ["fur"] });
    for (const s of [1, -1]) sc.paint(S.ell(0.01, 0.018 * Hs, 0.03 * Hs), { mat: "furBlue", p: add(hc, [s * 0.042 * Hs, 0.008 * Hs, -0.006]), soft: 0.006, only: ["furFace"] });
    // tail
    const T0 = G.tail[0], tp = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; tp.push([0, T0[1] - 0.03 * u - 0.09 * u * u, T0[2] - 0.22 * u, (0.028 + 0.022 * Math.sin(u * 2.6)) * (1 - 0.7 * u * u) + 0.005]); }
    const tail = sc.add(S.chain(tp), { mat: "fur", p: [0, 0, 0], bone: "tail1", k: 0.022, ...fk(0.016, 55) });
    tail.wfn = (x, yy, z) => { const u = clamp((T0[2] - z) / 0.2, 0, 1); return [["root", 1 - sstep(0, 0.15, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.2) * 2.5)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.55) * 2.8)], ["tail3", sstep(0.6, 0.95, u)]]; };
    sc.paint(S.sphere(0.05), { mat: "furBlue", p: tp[12].slice(0, 3), soft: 0.03 });
    // saddle and girth
    sc.add(S.ell(0.07, 0.022, 0.085), { mat: "steelD", p: [0, seatY - 0.025, seatZ], bone: "spine", k: 0.006 });
    sc.add(S.torus(0.078 * k, 0.007), { mat: "strap", p: [0, G.spine[1] - 0.005, seatZ + 0.02], r: [0, 0, Math.PI / 2], bone: "spine", k: 0.002 });

    // ================= rider
    const rb = (b) => ({ bone: b, bones: [[b, 1]] });
    // legs astride the wolf: armoured thighs forward, greaves down the flanks, sabatons
    for (const s of [1, -1]) {
      const hp = [s * 0.05, seatY + 0.005, seatZ - 0.005];
      sc.limb(hp, R.knee(s), 0.03, 0.025, { mat: "steel", k: 0.006, ...rb("rHip") });
      sc.add(S.ell(0.022, 0.018, 0.022), { mat: "steelL", p: add(R.knee(s), [0, 0.004, 0.012]), k: 0.004, ...rb("rHip") });
      sc.limb(R.knee(s), R.ank(s), 0.023, 0.02, { mat: "steel", k: 0.005, ...rb("rHip") });
      sc.add(S.ell(0.022, 0.018, 0.038), { mat: "steelD", p: add(R.ank(s), [0, -0.01, 0.02]), k: 0.004, ...rb("rHip") });
      spike(add(R.knee(s), [s * 0.015, 0.01, 0.01]), [s * 0.6, 0.5, 0.6], 0.03, 0.008, "crystal", "rHip", { bones: [["rHip", 1]] });
    }
    // torso: under-armour, breastplate, faulds
    sc.add(S.ell(0.062, 0.04, 0.05), { mat: "under", p: R.hip, k: 0.01, ...rb("rHip") });
    sc.add(S.ell(0.058, 0.05, 0.048), { mat: "steelD", p: R.waist, k: 0.012, ...rb("rTorso") });
    sc.add(S.ell(0.074, 0.062, 0.056), { mat: "steel", p: add(R.chest, [0, -0.01, 0.004]), k: 0.014, ...rb("rChest") });
    sc.add(S.box(0.012, 0.045, 0.012, 0.004), { mat: "steelL", p: add(R.chest, [0, -0.012, 0.052]), r: [0.2, 0, Math.PI / 4], k: 0.004, ...rb("rChest") });
    // white fur mantle round the shoulders
    sc.add(S.ell(0.09, 0.03, 0.068), { mat: "mantle", p: add(R.neck, [0, -0.028, -0.004]), k: 0.012, ...rb("rChest"), ...fk(0.012, 60) });
    // pauldrons: steel domes crowned with ice crystals
    for (const s of [1, -1]) {
      const n = sideName(s), sh = R.sh(s);
      sc.add(S.ell(0.04, 0.032, 0.044), { mat: "steel", p: add(sh, [s * 0.012, 0.006, 0]), k: 0.006, ...rb("rChest") });
      spike(add(sh, [s * 0.02, 0.025, 0]), [s * 0.35, 1, -0.15], 0.075, 0.014, "crystal", "rChest", { bones: [["rChest", 1]] });
      spike(add(sh, [s * 0.04, 0.012, -0.012]), [s * 0.9, 0.6, -0.3], 0.045, 0.01, "crystalHi", "rChest", { bones: [["rChest", 1]] });
      // arms: steel upper arm, gauntleted forearm, fist
      sc.limb(sh, R.el(s), 0.024, 0.02, { mat: "steelD", k: 0.006, ...rb("rArm" + n) });
      sc.limb(R.el(s), R.wr(s), 0.022, 0.02, { mat: "steel", k: 0.006, ...rb("rFore" + n) });
      sc.add(S.ell(0.022, 0.022, 0.024), { mat: "steelD", p: add(R.wr(s), mul(norm(sub(R.wr(s), R.el(s))), 0.012)), k: 0.004, ...rb("rHand" + n) });
    }
    // helm: rounded steel helm, glowing visor slit, cheek guards, tall crystal crest
    const hd = add(R.neck, [0, 0.055, 0.002]);
    sc.add(S.ell(0.046, 0.052, 0.05), { mat: "steel", p: hd, k: 0.008, ...rb("rHead") });
    sc.add(S.box(0.034, 0.006, 0.02), { mat: "visor", p: add(hd, [0, -0.002, 0.042]), k: 0.002, ...rb("rHead") });
    sc.add(S.ell(0.038, 0.018, 0.04), { mat: "steelD", p: add(hd, [0, -0.034, 0.014]), k: 0.006, ...rb("rHead") });
    spike(add(hd, [0, 0.04, -0.004]), [0, 1, -0.25], 0.1, 0.017, "crystal", "rHead", { bones: [["rHead", 1]] });
    for (const s of [1, -1]) spike(add(hd, [s * 0.03, 0.03, -0.004]), [s * 0.45, 1, -0.35], 0.055, 0.01, "crystalHi", "rHead", { bones: [["rHead", 1]] });
    sc.paint(S.box(0.004, 0.06, 0.06), { mat: "steelL", p: add(hd, [0, 0.03, 0.01]), soft: 0.002, only: ["steel"] });
    // cape: streaming back over the wolf's haunches (cloth: skinned smoothly from the rider's chest to the wolf's rump)
    sc.inPart("cloth", () => {
      const cTop = [0, seatY + 0.19, seatZ - 0.055], cBot = [0, seatY + 0.02, seatZ - 0.22];
      const cape = sc.limb(cTop, cBot, 0.03, 0.046, { mat: "cape", k: 0.006, sx: 2.6, sz: 0.24, bone: "rCape" });
      cape.wfn = (x, yy, z) => { const u = clamp((cTop[1] - yy) / (cTop[1] - cBot[1]), 0, 1); return [["rChest", 1 - sstep(0, 0.5, u)], ["rCape", 1 - Math.abs(u - 0.5) * 1.4], ["root", sstep(0.5, 1, u)]]; };
      sc.paint(S.ell(0.2, 0.2, 0.02), { mat: "capeIn", p: [0, seatY + 0.1, seatZ - 0.12], R: rotY2(0, 0.35, 1), soft: 0.004, only: ["cape"] });
    });
    sc.faceKind = "rider";
    const hand = R.wr(-1);
    return { sc, kind: "quadruped", G, Hs, props: [{ sc: blade(), bone: "rHandR", at: add(hand, mul(norm(sub(hand, R.el(-1))), 0.012)), grip: "blade", rot: [0.75, 0, 0.12] }] };
  }

  /* idle: the shared quadruped for the wolf, the rider breathing, glancing about, the blade held forward;
   * attack "charge": the wolf lunges (0.25-0.42) while the rider winds the blade up over the right shoulder (0-0.3)
   * and cuts down and across at the contact (0.42), then both settle (→1.2); hurt: the shared recoil plus the rider
   * rocking back */
  function pose(fig, clip, t, T, C) {
    const { rot, off, bump, sstep } = C;
    const r = C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    const br = Math.sin((T * C.TAU) / 3.2), look = Math.sin(T * 0.45);
    rot(fig, "tail1", 0.1, 0.18 * Math.sin(T * 1.6), 0); rot(fig, "tail2", 0, 0.14 * Math.sin(T * 1.6 - 0.8), 0); rot(fig, "tail3", 0, 0.14 * Math.sin(T * 1.6 - 1.6), 0);
    rot(fig, "rTorso", 0.02 * br, 0.05 * look, 0);
    rot(fig, "rChest", 0.02 * br, 0.05 * look, 0);
    rot(fig, "rHead", 0, 0.2 * look, 0);
    rot(fig, "rArmR", -0.05 + 0.03 * br, 0, 0); rot(fig, "rArmL", 0.03 * br, 0, 0);
    rot(fig, "rCape", 0.08 + 0.05 * Math.sin(T * 1.5), 0, 0.04 * Math.sin(T * 1.1));
    let glow = 0.1 + 0.1 * Math.sin(T * 1.9);
    if (clip === "hurt") {
      const kk = Math.exp(-t * 6) * sstep(0, 0.05, t);
      rot(fig, "rTorso", -0.25 * kk, 0.1 * kk, 0.1 * kk); rot(fig, "rHead", -0.3 * kk, 0.2 * kk, 0);
    }
    if (clip !== "attack") { C.emitBoost(fig, glow); return r; }
    const wind = bump(0, 0.28, 0.32, 0.42, t), cut = sstep(0.32, 0.42, t) * (1 - sstep(0.62, 1.05, t));
    const cr = bump(0, 0.2, 0.25, 0.32, t), lg = bump(0.25, 0.4, 0.56, 0.95, t), hop = Math.sin(clamp((t - 0.25) / 0.3, 0, 1) * Math.PI);
    // mount: gather and lunge, jaws snapping
    off(fig, "root", 0, -0.03 * cr + 0.035 * hop, -0.02 * cr + 0.12 * lg);
    rot(fig, "root", 0.1 * cr - 0.06 * lg, 0, 0);
    rot(fig, "chest", 0.06 * cr - 0.05 * lg, 0, 0);
    rot(fig, "neck", 0.2 * cr + 0.1 * lg, 0, 0); rot(fig, "head", 0.08 * cr - 0.08 * lg, 0, 0);
    rot(fig, "jaw", 0.55 * bump(0.28, 0.36, 0.42, 0.5, t), 0, 0);
    for (const s of ["L", "R"]) {
      rot(fig, "scap" + s, 0.3 * cr - 0.8 * lg, 0, 0); rot(fig, "elb" + s, 0.55 * cr - 0.2 * lg, 0, 0); rot(fig, "wri" + s, 0.3 * lg, 0, 0);
      rot(fig, "hip" + s, -0.35 * cr + 0.6 * lg, 0, 0); rot(fig, "stif" + s, -0.4 * cr + 0.2 * lg, 0, 0); rot(fig, "hock" + s, 0.4 * cr, 0, 0);
      rot(fig, "ear" + s, -0.5 * (cr + lg), 0, 0);
    }
    // rider: twist and raise the blade high over the right shoulder → cut down and across to the front-left
    rot(fig, "rTorso", -0.06 * wind + 0.14 * cut, -0.3 * wind + 0.3 * cut, 0);
    rot(fig, "rChest", -0.08 * wind + 0.12 * cut, -0.25 * wind + 0.3 * cut, 0.05 * wind);
    rot(fig, "rHead", 0.05 * cut, 0.25 * wind - 0.2 * cut, 0);
    rot(fig, "rArmL", -0.3 * wind, 0, 0.4 * wind);
    fig.root.updateMatrixWorld(true);
    const V3 = C.V3, sh = C.toM(fig, C.wpos(fig.J.rArmR)), sw = sstep(0.32, 0.42, t), amt = Math.max(wind, cut);
    const hUp = V3(-0.03, 0.12, -0.02), hCut = V3(0.05, -0.07, 0.13);
    const hand = sh.clone().add(hUp.clone().lerp(hCut, sw));
    C.ik(fig, "rArmR", "rForeR", "rHandR", C.toW(fig, hand), C.toW(fig, sh.clone().add(V3(-0.3, -0.15, -0.05))), amt);
    const dUp = V3(-0.25, 0.8, -0.55).normalize(), dCut = V3(0.35, -0.2, 0.92).normalize(), d = dUp.lerp(dCut, sw).normalize();
    C.aimGrip(fig, "rHandR", [d.x, d.y, d.z], [-1, 0, 0], amt);
    rot(fig, "rCape", 0.08 + 0.35 * lg + 0.1 * wind, 0, 0);
    glow += 0.5 * wind + 1.2 * bump(0.38, 0.43, 0.55, 0.85, t);
    C.emitBoost(fig, glow);
    return t < 1.2;
  }

  return {
    cards: ["rider"], kind: "quadruped", build, scale: 1.2, pose,
    moves: { attack: { clip: "charge", style: "slash", hit: 0.42, length: 1.2, reach: 0.34, trail: { prop: "blade", from: [0, 0.1, 0], to: [0, 0.38, 0] } } },
  };
})());
