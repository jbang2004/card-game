/* 灵狼 — a spirit wolf called by the gods (card spiritwolf): a lean adult wolf of glowing jade light, a darker teal
 * core under a pale, luminous coat, flame-like wisps streaming back from the neck, spine, elbows and a long blazing
 * tail, fangs bared, bright eyes. The glow pulses at rest and flares on the pounce. */
EmberVoxelKit.define("spiritwolf", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, rotY2, add, sub, mul, lerp, norm, X, CLS, mats, sideName, quadBones, spline } = K;
  function spiritwolf() {
    const sc = new Sculpture();
    const Hs = 1.18, Ps = 1.2, Ls = 0.95;
    const y = (v) => v * Ls, bodyY = (v) => v - (1 - Ls) * 0.16;
    const G = {
      root: [0, bodyY(0.25), -0.13], spine: [0, bodyY(0.255), -0.02], chest: [0, bodyY(0.26), 0.09], neck: [0, bodyY(0.29), 0.16], head: [0, bodyY(0.34), 0.23], jaw: [0, bodyY(0.34) - 0.02 * Hs, 0.275 + 0.02 * Hs],
      tail: [[0, bodyY(0.28), -0.2], [0, bodyY(0.3), -0.27], [0, bodyY(0.33), -0.34]],
      front: [[0.046, bodyY(0.28), 0.13], [0.048, y(0.17), 0.11], [0.045, y(0.065), 0.13], [0.045, 0.022, 0.15]],
      back: [[0.05, bodyY(0.265), -0.15], [0.054, y(0.17), -0.1], [0.05, y(0.09), -0.185], [0.05, 0.022, -0.16]],
      ear: [0.03 * Hs, bodyY(0.4), 0.235],
    };
    quadBones(sc, G);
    mats(sc, {
      fur: { c: 0x4aa878, rough: 0.8, emit: 0.18, cls: CLS.fur, vary: 0.1, fur: 1 }, furDark: { c: 0x236b50, rough: 0.8, emit: 0.1, cls: CLS.fur, vary: 0.1, fur: 1 },
      furLight: { c: 0xa6ebbe, rough: 0.8, emit: 0.35, cls: CLS.fur, vary: 0.06, fur: 0.8 }, furLeg: { c: 0x62bd8c, rough: 0.8, emit: 0.25, cls: CLS.fur, vary: 0.08, fur: 0.3 },
      furFace: { c: 0x52ad7e, rough: 0.8, emit: 0.18, cls: CLS.fur, vary: 0.06, fur: 0.25 }, muzzle: { c: 0xb8f0cc, rough: 0.8, emit: 0.3, cls: CLS.fur, vary: 0.04, fur: 0.2 },
      paw: { c: 0xd2fbe0, rough: 0.8, emit: 0.6, cls: CLS.fur, vary: 0.04, fur: 0.12 },
      flame: { c: 0xd8ffe6, rough: 0.5, emit: 1.3, cls: CLS.glow, vary: 0.05 }, flameMid: { c: 0x86e6ae, rough: 0.6, emit: 0.8, cls: CLS.glow, vary: 0.06 },
      nose: { c: 0x0e3a30, rough: 0.3, cls: CLS.skin }, mouth: { c: 0x0f3b31, rough: 0.6, cls: CLS.skin }, fang: { c: 0xf2fff6, rough: 0.3, emit: 0.6, cls: CLS.glow },
      claw: { c: 0xe6fff0, rough: 0.4, emit: 0.8, cls: CLS.glow }, eye: { c: 0xeafff4, rough: 0.2, emit: 2.0, cls: CLS.glow },
    });
    const furD = (amp, f = 85) => (x, yy, z) => { const u = z * f * 0.45 + 1.8 * vnoise(x * f * 0.35, yy * f * 0.35, 3.1); const fr = u - Math.floor(u); return amp * (fr * fr) * (0.6 + 0.4 * vnoise(x * f, yy * f, z * f)); };
    const fk = (a, f) => ({ disp: furD(a, f), dispAmp: a });
    // lean body: deep chest, tucked belly
    sc.add(S.ell(0.062, 0.08, 0.1), { mat: "fur", p: add(G.chest, [0, -0.02, 0]), bone: "chest", k: 0.035, ...fk(0.006) });
    sc.add(S.ell(0.048, 0.056, 0.1), { mat: "fur", p: add(G.spine, [0, -0.006, 0]), bone: "spine", k: 0.045, sigma: 0.025, ...fk(0.006) });
    sc.add(S.ell(0.054, 0.062, 0.07), { mat: "fur", p: add(G.root, [0, -0.004, -0.005]), bone: "root", k: 0.04, ...fk(0.006) });
    const hc = add(G.head, [0, 0.02 * Hs, 0.02 * Hs]);
    sc.limb(add(G.chest, [0, 0.01, 0.05]), add(hc, [0, -0.02 * Hs, -0.03 * Hs]), 0.058, 0.044 * Hs, { mat: "fur", bone: "neck", k: 0.035, bones: [["neck", 0.7], ["chest", 0.3]], ...fk(0.008) });
    sc.add(S.ell(0.064, 0.074, 0.05), { mat: "furLight", p: add(G.chest, [0, -0.005, 0.085]), bone: "chest", bones: [["chest", 0.6], ["neck", 0.4]], k: 0.03, ...fk(0.016, 60) });
    // wedge head, long muzzle, snarl: open-mouth shadow, bared fangs
    sc.add(S.ell(0.045 * Hs, 0.04 * Hs, 0.048 * Hs), { mat: "furFace", p: hc, bone: "head", k: 0.02, ...fk(0.003) });
    for (const s of [1, -1]) sc.add(S.ell(0.028 * Hs, 0.026 * Hs, 0.028 * Hs), { mat: "muzzle", p: add(hc, [s * 0.036 * Hs, -0.022 * Hs, 0.006 * Hs]), bone: "head", k: 0.02, ...fk(0.012, 75) });
    const mzL = 0.075;
    sc.limb(add(hc, [0, -0.01 * Hs, 0.028 * Hs]), add(hc, [0, -0.018 * Hs, (0.03 + mzL) * Hs]), 0.025 * Hs, 0.015 * Hs, { mat: "muzzle", bone: "head", k: 0.018, sx: 1.05 });
    sc.add(S.ell(0.011 * Hs, 0.009 * Hs, 0.009 * Hs), { mat: "nose", p: add(hc, [0, -0.011 * Hs, (0.036 + mzL) * Hs + 0.004 * Hs]), bone: "head", k: 0.006, cs: 0.05 });
    sc.limb(add(hc, [0, -0.037 * Hs, 0.03 * Hs]), add(hc, [0, -0.04 * Hs, (0.03 + mzL * 0.85) * Hs]), 0.014 * Hs, 0.009 * Hs, { mat: "muzzle", bone: "jaw", k: 0.01 });
    sc.paint(S.ell(0.02 * Hs, 0.006 * Hs, 0.03 * Hs), { mat: "mouth", p: add(hc, [0, -0.03 * Hs, (0.03 + mzL * 0.55) * Hs]), soft: 0.002 });
    for (const s of [1, -1]) sc.limb(add(hc, [s * 0.012 * Hs, -0.024 * Hs, (0.03 + mzL * 0.78) * Hs]), add(hc, [s * 0.012 * Hs, -0.04 * Hs, (0.03 + mzL * 0.8) * Hs]), 0.004, 0.0015, { mat: "fang", bone: "head", k: 0.002, vdil: 0.5 });
    // glowing slanted eyes under a heavy brow
    for (const s of [1, -1]) {
      sc.add(S.ell(0.011 * Hs, 0.0055 * Hs, 0.007 * Hs), { mat: "eye", p: add(hc, [s * 0.021 * Hs, 0.004 * Hs, 0.042 * Hs]), r: [0, s * 0.35, s * 0.35], bone: "head", k: 0.003, cs: 0.03 });
      sc.limb(add(hc, [s * 0.008 * Hs, 0.014 * Hs, 0.046 * Hs]), add(hc, [s * 0.034 * Hs, 0.02 * Hs, 0.036 * Hs]), 0.006 * Hs, 0.005 * Hs, { mat: "furDark", bone: "head", k: 0.004 });
    }
    // ears laid back a little
    for (const s of [1, -1]) {
      const n = sideName(s), base = add(hc, [s * 0.028 * Hs, 0.024 * Hs, -0.01]), tip = add(base, [s * 0.018 * Hs, 0.058 * Hs, -0.03]);
      sc.limb(base, tip, 0.022 * Hs, 0.0018, { mat: "furFace", bone: "ear" + n, k: 0.012, sz: 0.42 });
      sc.add(S.ell(0.011 * Hs, 0.024 * Hs, 0.004), { mat: "flameMid", op: "sub", p: add(lerp(base, tip, 0.38), [0, 0, 0.01]), R: rotY2(...sub(tip, base)), bone: "ear" + n, k: 0.004, cut: "flameMid" });
    }
    // legs with glowing paws and claws
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.limb(F[0], F[1], 0.03, 0.021, { mat: "fur", bone: "scap" + n, k: 0.025, ...fk(0.005) });
      sc.limb(F[1], F[2], 0.018, 0.014, { mat: "furLeg", bone: "elb" + n, k: 0.012 });
      sc.limb(F[2], F[3], 0.014, 0.016, { mat: "furLeg", bone: "wri" + n, k: 0.01 });
      sc.add(S.ell(0.021 * Ps, 0.015 * Ps, 0.027 * Ps), { mat: "paw", p: add(F[3], [0, -0.004, 0.012]), bone: "fpaw" + n, k: 0.01 });
      sc.add(S.ell(0.042, 0.072, 0.052), { mat: "fur", p: add(B[0], [0, -0.034, 0.012]), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.03, ...fk(0.005) });
      sc.limb(B[1], B[2], 0.021, 0.013, { mat: "furLeg", bone: "stif" + n, k: 0.014 });
      sc.limb(B[2], B[3], 0.013, 0.015, { mat: "furLeg", bone: "hock" + n, k: 0.01 });
      sc.add(S.ell(0.02 * Ps, 0.014 * Ps, 0.026 * Ps), { mat: "paw", p: add(B[3], [0, -0.004, 0.012]), bone: "bpaw" + n, k: 0.01 });
      for (const [P4, bn] of [[F[3], "fpaw" + n], [B[3], "bpaw" + n]]) for (let c = -1; c <= 1; c++) sc.add(S.ell(0.003, 0.003, 0.005), { mat: "claw", p: add(P4, [c * 0.009 * Ps, -0.008, 0.034 * Ps]), bone: bn, k: 0.003, cs: 0.05 });
    }
    // flame wisps: tapered curls streaming up and back, pale at the tip
    const wisp = (base, ctrl, r, bone, bones) => {
      const pts = spline([base, ...ctrl], 12).map((p, j) => [p[0], p[1], p[2], mix(r, 0.0015, Math.pow(j / 12, 1.1))]);
      const w = sc.add(S.chain(pts), { mat: "flameMid", p: [0, 0, 0], bone, k: 0.008 });
      if (bones) w.bones = bones.map(([b, v]) => [sc.boneIndex.get(b), v]);
      sc.paint(S.sphere(r * 1.6), { mat: "flame", p: pts[10].slice(0, 3), soft: 0.004, only: ["flameMid"] });
      return w;
    };
    // mane of flames along the neck and spine
    const ridge = [[G.neck, 0.062, 0.05, "neck"], [lerp(G.neck, G.chest, 0.5), 0.07, 0.06, "chest"], [G.chest, 0.07, 0.062, "chest"], [lerp(G.chest, G.spine, 0.5), 0.062, 0.055, "spine"], [G.spine, 0.055, 0.05, "spine"], [lerp(G.spine, G.root, 0.5), 0.05, 0.045, "root"]];
    ridge.forEach(([p, h, len, bone], i) => {
      const b = add(p, [0, h - 0.012, 0]), sway = (i % 2 ? 1 : -1) * 0.012;
      wisp(b, [add(b, [sway, len * 0.7, -len * 0.35]), add(b, [-sway * 0.5, len * 1.05, -len * 1.2])], 0.021, bone);
    });
    for (const s of [1, -1]) {
      // cheek and throat flames
      const c0 = add(hc, [s * 0.045 * Hs, -0.02 * Hs, -0.01]);
      wisp(c0, [add(c0, [s * 0.03, 0.005, -0.035]), add(c0, [s * 0.035, 0.035, -0.075])], 0.012, "head");
      // elbow and hock flames
      const e = X(G.front[1], s), h = X(G.back[1], s);
      wisp(add(e, [s * 0.01, 0, -0.01]), [add(e, [s * 0.02, 0.01, -0.04]), add(e, [s * 0.02, 0.045, -0.07])], 0.01, "elb" + (s > 0 ? "L" : "R"));
      wisp(add(h, [s * 0.01, 0.02, -0.02]), [add(h, [s * 0.02, 0.03, -0.05]), add(h, [s * 0.02, 0.07, -0.08])], 0.012, "hip" + (s > 0 ? "L" : "R"));
    }
    // long blazing tail raised in a flame arc
    const T0 = G.tail[0], tp = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14; tp.push([0.015 * Math.sin(u * 5), T0[1] + 0.13 * u - 0.02 * u * u, T0[2] - 0.2 * u + 0.05 * u * u, (0.022 + 0.02 * Math.sin(u * 2.8)) * (1 - 0.8 * u * u) + 0.003]); }
    const tail = sc.add(S.chain(tp), { mat: "fur", p: [0, 0, 0], bone: "tail1", k: 0.02, ...fk(0.012, 60) });
    const tw = (x, yy, z) => { const u = clamp((T0[2] - z) / 0.15, 0, 1); return [["root", 1 - sstep(0, 0.15, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.2) * 2.5)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.55) * 2.8)], ["tail3", sstep(0.6, 0.95, u)]]; };
    tail.wfn = tw;
    for (let i = 0; i < 4; i++) {
      const b = tp[5 + i * 2].slice(0, 3), sd = i % 2 ? 1 : -1;
      const w = wisp(b, [add(b, [sd * 0.02, 0.035, -0.02]), add(b, [sd * 0.01, 0.07, -0.06])], 0.013, "tail2");
      w.wfn = tw;
    }
    sc.paint(S.sphere(0.04), { mat: "flame", p: tp[14].slice(0, 3), soft: 0.02 });
    // darker teal core along the flanks, luminous underside and brow
    sc.paint(S.ell(0.07, 0.035, 0.16), { mat: "furDark", p: [0, bodyY(0.24), -0.03], soft: 0.03, amt: 0.6 });
    sc.paint(S.ell(0.09, 0.05, 0.22), { mat: "furLight", p: [0, bodyY(0.16), 0], soft: 0.035 });
    sc.paint(S.rcone(0.05 * Hs, 0.007 * Hs, 0.004 * Hs), { mat: "muzzle", p: add(hc, [0, -0.004 * Hs, 0.045 * Hs]), R: rotY2(0, 1, -0.55), soft: 0.005, fur: 0.25 });
    sc.faceKind = "spiritwolf";
    return { sc, kind: "quadruped", props: [], G, Hs };
  }

  /* idle and hurt: the shared quadruped, with the spirit glow breathing; attack: a low pounce — crouch (0-0.26),
   * spring with the jaws wide (0.26-0.38), snap at the contact (0.4) with a flare, worry, hop back (→1.05) */
  function pose(fig, clip, t, T, C) {
    const { rot, off, bump } = C;
    let glow = 0.12 + 0.12 * Math.sin(T * 2.1);
    if (clip !== "attack") {
      const r = C.base(fig, clip, t, T);
      C.emitBoost(fig, glow + (clip === "hurt" ? 0.8 * Math.exp(-t * 5) : 0));
      return r;
    }
    C.base(fig, "idle", 0, T);
    const cr = bump(0, 0.22, 0.26, 0.34, t), lg = bump(0.26, 0.38, 0.52, 0.9, t), hop = Math.sin(clamp((t - 0.26) / 0.26, 0, 1) * Math.PI);
    const open = bump(0.28, 0.36, 0.39, 0.42, t), worry = bump(0.4, 0.44, 0.54, 0.64, t) * Math.sin(t * 55);
    off(fig, "root", 0, -0.04 * cr + 0.04 * hop, -0.02 * cr + 0.12 * lg);
    rot(fig, "root", 0.12 * cr - 0.08 * lg, 0.1 * Math.sin(t * 38) * cr, 0);
    rot(fig, "chest", 0.08 * cr - 0.06 * lg, 0, 0);
    rot(fig, "neck", 0.22 * cr + 0.14 * lg, 0.12 * worry, 0);
    rot(fig, "head", 0.1 * cr - 0.1 * lg, 0.25 * worry, 0.1 * worry);
    rot(fig, "jaw", 0.8 * open + 0.1 * lg, 0, 0);
    for (const s of ["L", "R"]) {
      rot(fig, "scap" + s, 0.3 * cr - 1.0 * lg, 0, 0); rot(fig, "elb" + s, 0.6 * cr - 0.2 * lg, 0, 0); rot(fig, "wri" + s, 0.35 * lg, 0, 0);
      rot(fig, "hip" + s, -0.4 * cr + 0.75 * lg, 0, 0); rot(fig, "stif" + s, -0.5 * cr + 0.2 * lg, 0, 0); rot(fig, "hock" + s, 0.45 * cr, 0, 0);
      rot(fig, "ear" + s, -0.5 * cr - 0.4 * lg, 0, 0);
    }
    rot(fig, "tail1", -0.25 * lg - 0.2 * cr, 0.2 * Math.sin(t * 30), 0);
    glow += 0.25 * cr + 1.4 * bump(0.34, 0.4, 0.5, 0.8, t);
    C.emitBoost(fig, glow);
    return t < 1.05;
  }

  return {
    cards: ["spiritwolf"], kind: "quadruped", build: spiritwolf, scale: 1.15, pose,
    moves: { attack: { clip: "pounce", style: "bite", hit: 0.4, length: 1.05, reach: 0.26 } },
  };
})());
