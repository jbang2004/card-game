/* 幽灵狼 — a small grey wolf pup (card pup): oversized head and paws, cream face mask and cheeks, big amber eyes,
 * tall soft ears. Token-sized; the pounce bite is its own clip (head level, jaws snap at the contact). */
EmberVoxelKit.define("pup", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, rotY2, add, sub, mul, lerp, norm, X, CLS, mats, sideName, quadBones } = K;
  function pup() {
    const sc = new Sculpture();
    const Hs = 1.5, Ps = 1.5, Ls = 0.78;
    const y = (v) => v * Ls, bodyY = (v) => v - (1 - Ls) * 0.16;
    const G = {
      root: [0, bodyY(0.23), -0.1], spine: [0, bodyY(0.235), -0.02], chest: [0, bodyY(0.235), 0.07], neck: [0, bodyY(0.27), 0.13], head: [0, bodyY(0.335), 0.19], jaw: [0, bodyY(0.335) - 0.02 * Hs, 0.235 + 0.02 * Hs],
      tail: [[0, bodyY(0.26), -0.16], [0, bodyY(0.245), -0.22], [0, bodyY(0.22), -0.27]],
      front: [[0.045, bodyY(0.26), 0.1], [0.048, y(0.165), 0.09], [0.046, y(0.06), 0.105], [0.046, 0.022, 0.125]],
      back: [[0.05, bodyY(0.245), -0.12], [0.053, y(0.16), -0.08], [0.05, y(0.085), -0.15], [0.05, 0.022, -0.13]],
      ear: [0.032 * Hs, bodyY(0.4) + 0.04 * (Hs - 1), 0.2],
    };
    quadBones(sc, G);
    mats(sc, {
      fur: { c: 0x8b8a8c, rough: 0.9, cls: CLS.fur, vary: 0.12, fur: 1 }, furDark: { c: 0x5e5c5f, rough: 0.9, cls: CLS.fur, vary: 0.12, fur: 1 },
      furLight: { c: 0xe3e3e6, rough: 0.9, cls: CLS.fur, vary: 0.05, fur: 0.8 }, furLeg: { c: 0xa9a8ac, rough: 0.9, cls: CLS.fur, vary: 0.06, fur: 0.3 },
      furFace: { c: 0x97959a, rough: 0.9, cls: CLS.fur, vary: 0.06, fur: 0.25 }, muzzle: { c: 0xebebee, rough: 0.9, cls: CLS.fur, vary: 0.04, fur: 0.2 },
      paw: { c: 0xd8d8dc, rough: 0.9, cls: CLS.fur, vary: 0.04, fur: 0.12 },
      nose: { c: 0x17151a, rough: 0.3, cls: CLS.skin }, earIn: { c: 0xd8c2b6, rough: 0.8, cls: CLS.skin }, claw: { c: 0x4a4446, rough: 0.4, cls: CLS.skin },
    });
    // blocky layered tufts pointing back (the chunky family's fur)
    const furD = (amp, f = 85) => (x, yy, z) => { const u = z * f * 0.45 + 1.8 * vnoise(x * f * 0.35, yy * f * 0.35, 3.1); const fr = u - Math.floor(u); return amp * (fr * fr) * (0.6 + 0.4 * vnoise(x * f, yy * f, z * f)); };
    const fk = (a, f) => ({ disp: furD(a, f), dispAmp: a });
    // round puppy body
    sc.add(S.ell(0.066, 0.078, 0.085), { mat: "fur", p: add(G.chest, [0, -0.02, 0]), bone: "chest", k: 0.035, ...fk(0.007) });
    sc.add(S.ell(0.058, 0.062, 0.085), { mat: "fur", p: add(G.spine, [0, -0.012, 0]), bone: "spine", k: 0.045, sigma: 0.025, ...fk(0.007) });
    sc.add(S.ell(0.062, 0.066, 0.066), { mat: "fur", p: add(G.root, [0, -0.005, -0.005]), bone: "root", k: 0.04, ...fk(0.007) });
    const hc = add(G.head, [0, 0.022 * Hs, 0.02 * Hs]);
    sc.limb(add(G.chest, [0, 0.01, 0.05]), add(hc, [0, -0.02 * Hs, -0.03 * Hs]), 0.058, 0.05 * Math.sqrt(Hs), { mat: "fur", bone: "neck", k: 0.035, bones: [["neck", 0.7], ["chest", 0.3]], ...fk(0.008) });
    sc.add(S.ell(0.068, 0.07, 0.05), { mat: "furLight", p: add(G.chest, [0, 0.0, 0.07]), bone: "chest", bones: [["chest", 0.6], ["neck", 0.4]], k: 0.03, ...fk(0.018, 60) });
    // big round head, short button muzzle, fluffy cheeks
    sc.add(S.ell(0.05 * Hs, 0.046 * Hs, 0.048 * Hs), { mat: "furFace", p: hc, bone: "head", k: 0.02, ...fk(0.003) });
    for (const s of [1, -1]) sc.add(S.ell(0.03 * Hs, 0.028 * Hs, 0.028 * Hs), { mat: "muzzle", p: add(hc, [s * 0.038 * Hs, -0.024 * Hs, 0.01 * Hs]), bone: "head", k: 0.02, ...fk(0.012, 75) });
    const mz = 0.62;
    sc.limb(add(hc, [0, -0.014 * Hs, 0.028 * Hs]), add(hc, [0, -0.02 * Hs, (0.03 + 0.055 * mz) * Hs]), 0.025 * Hs, 0.018 * Hs, { mat: "muzzle", bone: "head", k: 0.018, sx: 1.15 });
    sc.add(S.ell(0.012 * Hs, 0.009 * Hs, 0.009 * Hs), { mat: "nose", p: add(hc, [0, -0.011 * Hs, (0.036 + 0.055 * mz) * Hs + 0.006 * Hs]), bone: "head", k: 0.006, cs: 0.05 });
    sc.limb(add(hc, [0, -0.036 * Hs, 0.03 * Hs]), add(hc, [0, -0.035 * Hs, (0.03 + 0.045 * mz) * Hs]), 0.014 * Hs, 0.011 * Hs, { mat: "muzzle", bone: "jaw", k: 0.01 });
    // eye sockets (the pixel face sits in them)
    for (const s of [1, -1]) sc.add(S.ell(0.012 * Hs, 0.0075 * Hs, 0.008 * Hs), { mat: "furFace", op: "sub", p: add(hc, [s * 0.021 * Hs, 0.004 * Hs, 0.045 * Hs]), bone: "head", k: 0.008 });
    // tall ears with a pale hollow
    for (const s of [1, -1]) {
      const n = sideName(s), base = add(hc, [s * 0.032 * Hs, 0.026 * Hs, -0.006]), tip = add(base, [s * 0.02 * Hs, 0.064 * Hs, -0.01]);
      sc.limb(base, tip, 0.026 * Hs, 0.0022, { mat: "furFace", bone: "ear" + n, k: 0.012, sz: 0.42 });
      sc.add(S.ell(0.014 * Hs, 0.028 * Hs, 0.0045), { mat: "earIn", op: "sub", p: add(lerp(base, tip, 0.38), [0, 0, 0.011]), R: rotY2(...sub(tip, base)), bone: "ear" + n, k: 0.004, cut: "earIn" });
    }
    // stubby legs, big pale paws
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.limb(F[0], F[1], 0.031, 0.024, { mat: "fur", bone: "scap" + n, k: 0.025, ...fk(0.006) });
      sc.limb(F[1], F[2], 0.021, 0.017, { mat: "furLeg", bone: "elb" + n, k: 0.012 });
      sc.limb(F[2], F[3], 0.017, 0.018, { mat: "furLeg", bone: "wri" + n, k: 0.01 });
      sc.add(S.ell(0.022 * Ps, 0.016 * Ps, 0.027 * Ps), { mat: "paw", p: add(F[3], [0, -0.004, 0.012]), bone: "fpaw" + n, k: 0.01 });
      sc.add(S.ell(0.044, 0.068, 0.05), { mat: "fur", p: add(B[0], [0, -0.03, 0.012]), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.03, ...fk(0.006) });
      sc.limb(B[1], B[2], 0.022, 0.016, { mat: "furLeg", bone: "stif" + n, k: 0.014 });
      sc.limb(B[2], B[3], 0.016, 0.017, { mat: "furLeg", bone: "hock" + n, k: 0.01 });
      sc.add(S.ell(0.021 * Ps, 0.015 * Ps, 0.026 * Ps), { mat: "paw", p: add(B[3], [0, -0.004, 0.012]), bone: "bpaw" + n, k: 0.01 });
      for (const [P4, bn] of [[F[3], "fpaw" + n], [B[3], "bpaw" + n]]) for (let c = -1; c <= 1; c++) sc.add(S.ell(0.003, 0.003, 0.004), { mat: "claw", p: add(P4, [c * 0.009 * Ps, -0.008, 0.033 * Ps]), bone: bn, k: 0.003, cs: 0.05 });
    }
    // short fluffy tail, carried up a little
    const tp = [], T0 = G.tail[0];
    for (let i = 0; i <= 10; i++) { const u = i / 10; tp.push([0, T0[1] + 0.02 * u - 0.05 * u * u, T0[2] - 0.13 * u, (0.026 + 0.016 * Math.sin(u * 2.5)) * (1 - 0.7 * u * u) + 0.004]); }
    const tail = sc.add(S.chain(tp), { mat: "fur", p: [0, 0, 0], bone: "tail1", k: 0.02, ...fk(0.014, 60) });
    tail.wfn = (x, yy, z) => { const u = clamp((T0[2] - z) / 0.13, 0, 1); return [["root", 1 - sstep(0, 0.15, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.2) * 2.5)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.55) * 2.8)], ["tail3", sstep(0.6, 0.95, u)]]; };
    // silhouette tufts: chest ruff, cheek fluff, a cowlick on the crown
    const tuft = (base, dir, len, r, mat, bone) => sc.limb(base, add(base, mul(norm(dir), len)), r, 0.0012, { mat, bone, k: 0.006 });
    for (let i = 0; i < 6; i++) { const a = -1.1 + (i / 5) * 2.2; tuft(add(G.chest, [0.045 * Math.sin(a), -0.03 + 0.03 * Math.cos(a * 1.3), 0.09]), [Math.sin(a) * 0.8, -0.6, 0.35], 0.032, 0.012, "furLight", "chest"); }
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) tuft(add(hc, [s * 0.056 * Hs, -0.018 * Hs - 0.01 * i, 0.004 - 0.008 * i]), [s, -0.4 - 0.2 * i, -0.4], 0.024 * Hs, 0.01 * Hs, "muzzle", "head");
    for (let i = 0; i < 3; i++) tuft(add(hc, [(i - 1) * 0.012, 0.042 * Hs, -0.004]), [(i - 1) * 0.5, 1, -0.6], 0.03, 0.01, "furFace", "head");
    // markings: darker saddle, cream belly, pale brow spots and blaze
    sc.paint(S.ell(0.055, 0.03, 0.13), { mat: "furDark", p: [0, bodyY(0.32), -0.05], soft: 0.035, amt: 0.7 });
    sc.paint(S.ell(0.09, 0.05, 0.2), { mat: "furLight", p: [0, bodyY(0.15), 0], soft: 0.035 });
    sc.paint(S.rcone(0.05 * Hs, 0.008 * Hs, 0.004 * Hs), { mat: "muzzle", p: add(hc, [0, -0.004 * Hs, 0.045 * Hs]), R: rotY2(0, 1, -0.55), soft: 0.005, fur: 0.25 });
    for (const s of [1, -1]) sc.paint(S.sphere(0.008 * Hs), { mat: "muzzle", p: add(hc, [s * 0.02 * Hs, 0.022 * Hs, 0.04 * Hs]), soft: 0.003 });
    sc.face({ bone: "head", cls: [5], c: add(hc, [0, 0.0, 0.045 * Hs]), size: [0.05 * Hs, 0.04 * Hs], depth: 0.03, nz: 0.2 });
    sc.faceKind = "wolf";
    return { sc, kind: "quadruped", props: [], G, Hs };
  }

  /* pounce bite: crouch and wiggle (0-0.28) → spring forward, head level, jaws wide (0.28-0.4) → snap shut at the
   * contact (0.42) and worry the bite (→0.6) → hop back (→1.1). Idle and hurt come from the shared quadruped. */
  function pose(fig, clip, t, T, C) {
    if (clip !== "attack") return undefined;
    const { rot, off, sstep, bump } = C;
    C.base(fig, "idle", 0, T);
    const cr = bump(0, 0.24, 0.28, 0.36, t), lg = bump(0.28, 0.4, 0.55, 0.95, t), hop = Math.sin(clamp((t - 0.28) / 0.28, 0, 1) * Math.PI);
    const open = bump(0.3, 0.38, 0.41, 0.44, t), worry = bump(0.42, 0.46, 0.56, 0.66, t) * Math.sin(t * 55);
    off(fig, "root", 0, -0.035 * cr + 0.045 * hop, -0.02 * cr + 0.1 * lg);
    rot(fig, "root", 0.14 * cr - 0.1 * lg, 0.12 * Math.sin(t * 38) * cr, 0);
    rot(fig, "chest", 0.08 * cr - 0.06 * lg, 0, 0);
    rot(fig, "neck", 0.2 * cr + 0.12 * lg, 0.12 * worry, 0);
    rot(fig, "head", 0.1 * cr - 0.08 * lg, 0.25 * worry, 0.1 * worry);
    rot(fig, "jaw", 0.75 * open + 0.1 * lg, 0, 0);
    for (const s of ["L", "R"]) {
      rot(fig, "scap" + s, 0.3 * cr - 0.9 * lg, 0, 0); rot(fig, "elb" + s, 0.6 * cr - 0.2 * lg, 0, 0); rot(fig, "wri" + s, 0.35 * lg, 0, 0);
      rot(fig, "hip" + s, -0.4 * cr + 0.7 * lg, 0, 0); rot(fig, "stif" + s, -0.5 * cr + 0.2 * lg, 0, 0); rot(fig, "hock" + s, 0.45 * cr, 0, 0);
      rot(fig, "ear" + s, -0.4 * cr - 0.5 * lg, 0, 0);
    }
    rot(fig, "tail1", 0.3 * lg - 0.2 * cr, 0.25 * Math.sin(t * 30), 0);
    C.setFace(fig, "fierce");
    return t < 1.1;
  }

  return {
    cards: ["pup"], kind: "quadruped", build: pup, scale: 1.1, pose,
    face: { kind: "wolf", look: { eye: 0xe0922e, rim: "#2a211b" }, params: (ch) => { const b = ch.faces[0], q = 1.5; return { cx: b.c[0], cy: b.c[1] + 0.004 * q, dx: 0.021 * q }; } },
    moves: { attack: { clip: "pounce", style: "bite", hit: 0.42, length: 1.1, reach: 0.24 } },
  };
})());
