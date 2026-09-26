/* 银灯灵狐 — the silver-lantern spirit fox (card moonfox): a slender white fox with a lavender sheen, tall ears with
 * dark tips, a narrow muzzle and violet eyes; its signature is the huge brush of a tail sweeping up behind it in a
 * crescent, whose tip burns as a pale blue lantern flame (a moon mark glows on the brow to match). */
EmberVoxelKit.define("moonfox", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, rotY2, add, sub, mul, lerp, norm, X, CLS, mats, sideName, quadBones, spline } = K;
  const TAIL = (() => {
    // the tail's centre line: back and up from the rump, over the top, curling forward — [x, y, z, r]
    const ctrl = [[0, 0.285, -0.17], [0.025, 0.29, -0.27], [0.075, 0.36, -0.35], [0.13, 0.48, -0.37], [0.17, 0.57, -0.3], [0.18, 0.58, -0.2], [0.155, 0.53, -0.14]];
    const pts = spline(ctrl, 30);
    return pts.map((p, i) => { const u = i / 30; return [p[0], p[1], p[2], 0.022 + 0.066 * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.3 * u) + 0.006 * (1 - u)]; });
  })();
  function fox() {
    const sc = new Sculpture();
    const PX = K.pixel;                                              // pixel-sprite variant: clean fur, a big bright lantern
    const Hs = 1.2, Ps = 1.1, Ls = 0.95;
    const y = (v) => v * Ls, bodyY = (v) => v - (1 - Ls) * 0.16;
    const G = {
      root: [0, bodyY(0.245), -0.1], spine: [0, bodyY(0.25), -0.01], chest: [0, bodyY(0.255), 0.08], neck: [0, bodyY(0.29), 0.14], head: [0, bodyY(0.35), 0.2], jaw: [0, bodyY(0.35) - 0.02 * Hs, 0.245 + 0.02 * Hs],
      tail: [TAIL[3].slice(0, 3), TAIL[12].slice(0, 3), TAIL[22].slice(0, 3)],
      front: [[0.04, bodyY(0.275), 0.11], [0.042, y(0.17), 0.1], [0.04, y(0.065), 0.115], [0.04, 0.02, 0.13]],
      back: [[0.045, bodyY(0.26), -0.12], [0.048, y(0.17), -0.075], [0.045, y(0.09), -0.155], [0.045, 0.02, -0.135]],
      ear: [0.03 * Hs, bodyY(0.42), 0.2],
    };
    quadBones(sc, G);
    mats(sc, {
      fur: { c: 0xbcc6ee, rough: 0.85, cls: CLS.fur, vary: 0.06, fur: 1 }, furShade: { c: 0x8f94d6, rough: 0.85, cls: CLS.fur, vary: 0.07, fur: 1 },
      furLight: { c: 0xd0daff, rough: 0.85, cls: CLS.fur, vary: 0.04, fur: 0.8 }, furLeg: { c: 0xa4acea, rough: 0.85, cls: CLS.fur, vary: 0.05, fur: 0.3 },
      furFace: { c: 0xc6cff4, rough: 0.85, cls: CLS.fur, vary: 0.04, fur: 0.25 }, earTip: { c: 0x4a4460, rough: 0.8, cls: CLS.fur, vary: 0.05, fur: 0.3 },
      earIn: { c: 0x9f8fb4, rough: 0.8, cls: CLS.skin }, nose: { c: 0x1c1826, rough: 0.3, cls: CLS.skin }, claw: { c: 0x575070, rough: 0.4, cls: CLS.skin },
      lantern: { c: PX ? 0x7cc4ff : 0xbfe0ff, rough: 0.4, emit: 1.1, cls: CLS.glow, vary: 0.05 }, flame: { c: 0xeef8ff, rough: 0.3, emit: 1.8, cls: CLS.glow },
      mark: { c: 0xa9cfff, rough: 0.4, emit: 1.4, cls: CLS.glow },
    });
    const furD = (amp, f = 85) => (x, yy, z) => { const u = z * f * 0.45 + 1.8 * vnoise(x * f * 0.35, yy * f * 0.35, 3.1); const fr = u - Math.floor(u); return amp * (fr * fr) * (0.6 + 0.4 * vnoise(x * f, yy * f, z * f)); };
    const fk = (a, f) => (PX ? {} : { disp: furD(a, f), dispAmp: a });
    // slim body
    sc.add(S.ell(0.052, 0.068, 0.085), { mat: "fur", p: add(G.chest, [0, -0.018, 0]), bone: "chest", k: 0.035, ...fk(0.006) });
    sc.add(S.ell(0.042, 0.05, 0.09), { mat: "fur", p: add(G.spine, [0, -0.006, 0]), bone: "spine", k: 0.045, sigma: 0.025, ...fk(0.005) });
    sc.add(S.ell(0.048, 0.056, 0.06), { mat: "fur", p: add(G.root, [0, -0.004, -0.005]), bone: "root", k: 0.04, ...fk(0.006) });
    const hc = add(G.head, [0, 0.02 * Hs, 0.018 * Hs]);
    sc.limb(add(G.chest, [0, 0.01, 0.04]), add(hc, [0, -0.02 * Hs, -0.028 * Hs]), 0.048, 0.036 * Hs, { mat: "fur", bone: "neck", k: 0.03, bones: [["neck", 0.7], ["chest", 0.3]], ...fk(0.007) });
    // fluffy white chest ruff
    sc.add(S.ell(0.056, 0.066, 0.046), { mat: "furLight", p: add(G.chest, [0, 0.005, 0.07]), bone: "chest", bones: [["chest", 0.55], ["neck", 0.45]], k: 0.03, ...fk(0.018, 60) });
    // head: rounded skull, cheek fluff, long narrow pointed muzzle
    sc.add(S.ell(0.04 * Hs, 0.036 * Hs, 0.042 * Hs), { mat: "furFace", p: hc, bone: "head", k: 0.018, ...fk(0.003) });
    for (const s of [1, -1]) sc.add(S.ell(0.026 * Hs, 0.022 * Hs, 0.026 * Hs), { mat: "furLight", p: add(hc, [s * 0.034 * Hs, -0.02 * Hs, 0.0]), bone: "head", k: 0.018, ...fk(0.012, 75) });
    const mzL = 0.07;
    sc.limb(add(hc, [0, -0.01 * Hs, 0.024 * Hs]), add(hc, [0, -0.02 * Hs, (0.028 + mzL) * Hs]), 0.02 * Hs, 0.009 * Hs, { mat: "furFace", bone: "head", k: 0.016 });
    sc.add(S.ell(0.008 * Hs, 0.007 * Hs, 0.007 * Hs), { mat: "nose", p: add(hc, [0, -0.018 * Hs, (0.03 + mzL) * Hs]), bone: "head", k: 0.005, cs: 0.05 });
    sc.limb(add(hc, [0, -0.03 * Hs, 0.026 * Hs]), add(hc, [0, -0.03 * Hs, (0.024 + mzL * 0.85) * Hs]), 0.011 * Hs, 0.006 * Hs, { mat: "furLight", bone: "jaw", k: 0.008 });
    for (const s of [1, -1]) sc.add(S.ell(0.011 * Hs, 0.007 * Hs, 0.008 * Hs), { mat: "furFace", op: "sub", p: add(hc, [s * 0.019 * Hs, 0.004 * Hs, 0.039 * Hs]), bone: "head", k: 0.007 });
    // tall ears, dark tips, lilac hollow
    for (const s of [1, -1]) {
      const eK = PX ? 1.15 : 1;
      const n = sideName(s), base = add(hc, [s * 0.026 * Hs, 0.024 * Hs, -0.008]), tip = add(base, [s * 0.022 * Hs * eK, 0.078 * Hs * eK, -0.008]);
      sc.limb(base, tip, 0.024 * Hs * eK, PX ? 0.005 : 0.002, { mat: "furFace", bone: "ear" + n, k: 0.01, sz: 0.4 });
      sc.add(S.ell(0.012 * Hs, 0.032 * Hs, 0.004), { mat: "earIn", op: "sub", p: add(lerp(base, tip, 0.36), [0, 0, 0.01]), R: rotY2(...sub(tip, base)), bone: "ear" + n, k: 0.004, cut: "earIn" });
      sc.paint(S.sphere((PX ? 0.028 : 0.022) * Hs), { mat: "earTip", p: add(tip, [0, 0.004, 0]), soft: 0.004 });
    }
    // slender legs, dainty paws
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.limb(F[0], F[1], 0.026, 0.017, { mat: "fur", bone: "scap" + n, k: 0.022, ...fk(0.004) });
      sc.limb(F[1], F[2], 0.014, 0.011, { mat: "furLeg", bone: "elb" + n, k: 0.01 });
      sc.limb(F[2], F[3], 0.011, 0.012, { mat: "furLeg", bone: "wri" + n, k: 0.008 });
      sc.add(S.ell(0.016 * Ps, 0.012 * Ps, 0.022 * Ps), { mat: "furLight", p: add(F[3], [0, -0.004, 0.01]), bone: "fpaw" + n, k: 0.008 });
      sc.add(S.ell(0.036, 0.062, 0.046), { mat: "fur", p: add(B[0], [0, -0.03, 0.01]), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.028, ...fk(0.004) });
      sc.limb(B[1], B[2], 0.018, 0.011, { mat: "furLeg", bone: "stif" + n, k: 0.012 });
      sc.limb(B[2], B[3], 0.011, 0.012, { mat: "furLeg", bone: "hock" + n, k: 0.008 });
      sc.add(S.ell(0.016 * Ps, 0.012 * Ps, 0.022 * Ps), { mat: "furLight", p: add(B[3], [0, -0.004, 0.01]), bone: "bpaw" + n, k: 0.008 });
      if (!PX) for (const [P4, bn] of [[F[3], "fpaw" + n], [B[3], "bpaw" + n]]) for (let c = -1; c <= 1; c += 2) sc.add(S.ell(0.0028, 0.0028, 0.004), { mat: "claw", p: add(P4, [c * 0.005 * Ps, -0.007, 0.028 * Ps]), bone: bn, k: 0.002, cs: 0.05 });
    }
    // the great tail: skinned along its arc (root → tail1 → tail2 → tail3), a lavender shade on its underside,
    // the tip a pale-blue lantern flame
    const arcU = (x, yy, z) => { let best = 1e9, bi = 0; for (let i = 0; i < TAIL.length; i++) { const d = (x - TAIL[i][0]) ** 2 + (yy - TAIL[i][1]) ** 2 + (z - TAIL[i][2]) ** 2; if (d < best) { best = d; bi = i; } } return bi / (TAIL.length - 1); };
    const tailW = (x, yy, z) => { const u = arcU(x, yy, z); return [["root", 1 - sstep(0, 0.12, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.15) * 3.2)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.45) * 3.2)], ["tail3", sstep(0.5, 0.8, u)]]; };
    const soft = (amp, f) => PX ? {} : ({ disp: (x, yy, z) => amp * (0.5 + 0.5 * vnoise(x * f, yy * f * 0.5, z * f)), dispAmp: amp });
    const tail = sc.add(S.chain(TAIL, 0.85), { mat: "fur", p: [0, 0, 0], bone: "tail1", k: 0.02, ...soft(0.008, 70) });
    tail.wfn = tailW;
    sc.paint(S.custom((x, yy, z) => { let best = 1e9; for (const p of TAIL) best = Math.min(best, Math.hypot(x - p[0], yy - p[1] + p[3] * 0.9, z - p[2])); return best - 0.03; }, [-1, -1, -1, 1, 1, 1]), { mat: "furShade", soft: 0.01, amt: 0.55, only: ["fur"] });
    const tipC = TAIL[TAIL.length - 1];
    sc.paint(S.sphere(PX ? 0.085 : 0.07), { mat: "lantern", p: tipC.slice(0, 3), soft: PX ? 0.004 : 0.02 });
    sc.paint(S.sphere(PX ? 0.04 : 0.03), { mat: "flame", p: add(tipC.slice(0, 3), [0, 0.01, 0.01]), soft: PX ? 0.004 : 0.012 });
    const fl = sc.add(S.chain(spline([add(tipC.slice(0, 3), [0, 0.01, 0]), add(tipC.slice(0, 3), [0, 0.04, 0.03]), add(tipC.slice(0, 3), [0, 0.075, 0.02])].map((q) => PX ? add(tipC.slice(0, 3), mul(sub(q, tipC.slice(0, 3)), 1.3)) : q), 8).map((p, j) => [...p, PX ? mix(0.028, 0.006, j / 8) : mix(0.018, 0.002, j / 8)])), { mat: "flame", p: [0, 0, 0], bone: "tail3", k: 0.01 });
    fl.wfn = () => [["tail3", 1]];
    // markings: soft lavender shading on the back and flanks, white underside
    sc.paint(S.ell(0.045, 0.028, 0.13), { mat: "furShade", p: [0, bodyY(0.3), -0.02], soft: 0.035, amt: 0.4 });
    sc.paint(S.ell(0.08, 0.045, 0.2), { mat: "furLight", p: [0, bodyY(0.17), 0], soft: 0.03 });
    sc.face({ bone: "head", cls: [5], c: add(hc, [0, 0.0, 0.04 * Hs]), size: [0.045 * Hs, 0.036 * Hs], depth: 0.03, nz: 0.2 });
    sc.faceKind = "wolf";
    return { sc, kind: "quadruped", props: [], G, Hs };
  }

  /* idle: the shared quadruped with the big tail swaying slowly (not the pup's wag) and the lantern breathing;
   * attack: a light fox pounce — crouch (0-0.26), arcing spring with jaws open (0.26-0.38), snap at the contact (0.4),
   * the tail flung up behind, lantern flaring → land and recover (→1.05) */
  function pose(fig, clip, t, T, C) {
    const { rot, off, bump } = C;
    const r = C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    const sw = Math.sin(T * 1.1);
    rot(fig, "tail1", 0.03 * sw, 0.08 * sw, 0); rot(fig, "tail2", 0.04 * Math.sin(T * 1.1 - 0.7), 0.1 * Math.sin(T * 1.1 - 0.7), 0); rot(fig, "tail3", 0.06 * Math.sin(T * 1.1 - 1.4), 0.12 * Math.sin(T * 1.1 - 1.4), 0);
    let glow = 0.1 + 0.15 * Math.sin(T * 2.4) + 0.06 * Math.sin(T * 7.3);
    if (clip !== "attack") { C.emitBoost(fig, glow); return r; }
    const cr = bump(0, 0.22, 0.26, 0.34, t), lg = bump(0.26, 0.38, 0.52, 0.9, t), hop = Math.sin(clamp((t - 0.26) / 0.3, 0, 1) * Math.PI);
    const open = bump(0.28, 0.36, 0.39, 0.42, t);
    off(fig, "root", 0, -0.035 * cr + 0.06 * hop, -0.02 * cr + 0.12 * lg);
    rot(fig, "root", 0.14 * cr - 0.12 * lg, 0.1 * Math.sin(t * 40) * cr, 0);
    rot(fig, "chest", 0.08 * cr - 0.06 * lg, 0, 0);
    rot(fig, "neck", 0.25 * cr + 0.2 * lg, 0, 0);
    rot(fig, "head", 0.1 * cr - 0.05 * lg, 0, 0);
    rot(fig, "jaw", 0.7 * open, 0, 0);
    for (const s of ["L", "R"]) {
      rot(fig, "scap" + s, 0.3 * cr - 1.0 * lg, 0, 0); rot(fig, "elb" + s, 0.6 * cr - 0.2 * lg, 0, 0); rot(fig, "wri" + s, 0.35 * lg, 0, 0);
      rot(fig, "hip" + s, -0.4 * cr + 0.75 * lg, 0, 0); rot(fig, "stif" + s, -0.5 * cr + 0.2 * lg, 0, 0); rot(fig, "hock" + s, 0.45 * cr, 0, 0);
      rot(fig, "ear" + s, -0.35 * cr - 0.3 * lg, 0, 0);
    }
    rot(fig, "tail1", -0.25 * cr + 0.35 * lg, 0.15 * Math.sin(t * 30) * cr, 0); rot(fig, "tail2", 0.2 * lg, 0, 0);
    glow += 0.3 * cr + 1.2 * bump(0.34, 0.4, 0.5, 0.8, t);
    C.emitBoost(fig, glow);
    C.setFace(fig, "fierce");
    return t < 1.05;
  }

  return {
    cards: ["moonfox"], kind: "quadruped", build: fox, scale: 1.05, pose,
    face: { kind: "wolf", look: { eye: 0x8f7fe0, rim: "#2e2940" }, params: (ch) => { const b = ch.faces[0], q = 1.2; return { cx: b.c[0], cy: b.c[1] + 0.004 * q, dx: 0.019 * q }; } },
    moves: { attack: { clip: "pounce", style: "bite", hit: 0.4, length: 1.05, reach: 0.22 } },
  };
})());
