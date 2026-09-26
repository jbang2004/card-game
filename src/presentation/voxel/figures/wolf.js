/* 月影幼狼 — grey wolf pup, pale belly, ice-blue eyes (card wolf). */
EmberVoxelKit.define("wolf", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, lin, vnoise, fbm, clamp, mix, sstep, rotm, rotY2, smax, TAU, add, sub, mul, lerp, norm, cross, X,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, handFrame, hand, foot, head,
    RG, wrap, bell, skirt, cape, capeBones, lock, cuff, spline, strand, onEll, chibiHair,
    spearProp, bowProp, quiverProp, QF, quadBones, scaleG } = K;
  function wolf(fam) {
    const sc = new Sculpture();
    const PX = K.pixel;                                              // pixel-sprite variant: clean big shapes, no fur noise
    const chib = fam === "chibi", chunky = fam === "chunky", anime = fam === "anime";
    const Hs = chib ? 1.55 : chunky ? 1.22 : anime ? 1.08 : 1;   // head scale
    const Ps = chib ? 1.35 : chunky ? 1.3 : 1;                     // paw scale
    const Ls = chib ? 0.62 : chunky ? 0.88 : anime ? 1.04 : 1;     // leg length
    const y = (v) => v * Ls + (1 - Ls) * 0.0;                       // squash legs
    const bodyY = (v) => v - (1 - Ls) * 0.16;
    let G = {
      root: [0, bodyY(0.235), -0.12], spine: [0, bodyY(0.24), -0.02], chest: [0, bodyY(0.24), 0.08], neck: [0, bodyY(0.27), 0.15], head: [0, bodyY(0.33) + 0.01 * (Hs - 1), 0.215], jaw: [0, bodyY(0.33) - 0.02 * Hs, 0.26 + 0.02 * Hs],
      tail: [[0, bodyY(0.27), -0.19], [0, bodyY(0.25), -0.26], [0, bodyY(0.22), -0.32]],
      front: [[0.045, bodyY(0.27), 0.12], [0.048, y(0.165), 0.105], [0.045, y(0.06), 0.125], [0.045, 0.022, 0.145]],
      back: [[0.05, bodyY(0.25), -0.14], [0.053, y(0.16), -0.095], [0.05, y(0.085), -0.175], [0.05, 0.022, -0.15]],
      ear: [0.032 * Hs, bodyY(0.39) + 0.04 * (Hs - 1), 0.23],
    };
    quadBones(sc, G);
    mats(sc, {
      fur: { c: 0x80838b, rough: 0.9, cls: CLS.fur, vary: 0.12, fur: 1 }, furDark: { c: 0x55575e, rough: 0.9, cls: CLS.fur, vary: 0.12, fur: 1 },
      furLight: { c: 0xe2e0da, rough: 0.9, cls: CLS.fur, vary: 0.05, fur: 0.85 }, furLeg: { c: 0xb9babe, rough: 0.9, cls: CLS.fur, vary: 0.06, fur: 0.3 },
      furFace: { c: 0x8e9198, rough: 0.9, cls: CLS.fur, vary: 0.06, fur: 0.25 }, muzzle: { c: 0xe6e5e1, rough: 0.9, cls: CLS.fur, vary: 0.04, fur: 0.2 },
      paw: { c: 0xd9d8d4, rough: 0.9, cls: CLS.fur, vary: 0.04, fur: 0.12 },
      nose: { c: 0x17151a, rough: 0.3, cls: CLS.skin }, earIn: { c: 0xc9b6b3, rough: 0.8, cls: CLS.skin }, claw: { c: 0x2a2626, rough: 0.4, cls: CLS.skin },
    });
    // fur surface by family: soft noise (real), layered tufts pointing back (Blizzard), smooth with a few spikes (anime/chibi)
    const furD = (amp, f = 85) => chunky
      ? (x, yy, z) => { const u = z * f * 0.45 + 1.8 * vnoise(x * f * 0.35, yy * f * 0.35, 3.1); const fr = u - Math.floor(u); return amp * (fr * fr) * (0.6 + 0.4 * vnoise(x * f, yy * f, z * f)); }
      : anime || chib ? (x, yy, z) => amp * 0.25 * (0.5 + 0.5 * fbm(x * f * 0.6, yy * f * 0.6, z * f * 0.6, 2))
      : (x, yy, z) => amp * (0.5 + 0.5 * fbm(x * f, yy * f, z * f, 2));
    const fk = (a, f) => (PX ? {} : { disp: furD(a, f), dispAmp: a });
    const fl = chunky ? 1.8 : chib ? 0.8 : 1;
    // torso: deep chest, tucked belly, rump
    sc.add(S.ell(0.066, 0.083, 0.098), { mat: "fur", p: add(G.chest, [0, -0.02, 0]), bone: "chest", k: 0.035, ...fk(0.004 * fl) });
    sc.add(S.ell(0.054, 0.062, 0.1), { mat: "fur", p: add(G.spine, [0, -0.012, 0]), bone: "spine", k: 0.045, sigma: 0.025, ...fk(0.004 * fl) });
    sc.add(S.ell(0.058, 0.066, 0.072), { mat: "fur", p: add(G.root, [0, -0.005, -0.005]), bone: "root", k: 0.04, ...fk(0.004 * fl) });
    // neck + ruff
    const hc = add(G.head, [0, 0.022 * Hs, 0.02 * Hs]);
    sc.limb(add(G.chest, [0, 0.01, 0.05]), add(hc, [0, -0.02 * Hs, -0.03 * Hs]), 0.06, 0.048 * Math.sqrt(Hs), { mat: "fur", bone: "neck", k: 0.035, bones: [["neck", 0.7], ["chest", 0.3]], ...fk(0.005 * fl) });
    sc.add(S.ell(0.07, 0.075, 0.05), { mat: "furLight", p: add(G.chest, [0, 0.0, 0.085]), bone: "chest", bones: [["chest", 0.6], ["neck", 0.4]], k: 0.03, ...fk(0.012 * fl, 60) });
    // head: cranium, cheek fluff, short pup muzzle, nose, jaw
    sc.add(S.ell(0.05 * Hs, 0.047 * Hs, 0.052 * Hs), { mat: "furFace", p: hc, bone: "head", k: 0.02, ...fk(0.002 * fl) });
    for (const s of [1, -1]) sc.add(S.ell(0.032 * Hs, 0.03 * Hs, 0.03 * Hs), { mat: "muzzle", p: add(hc, [s * 0.04 * Hs, -0.024 * Hs, 0.008 * Hs]), bone: "head", k: 0.02, ...fk(0.009 * fl, 75) });
    const mz = chib ? 0.55 : anime ? 0.85 : 1;
    sc.limb(add(hc, [0, -0.012 * Hs, 0.028 * Hs]), add(hc, [0, -0.02 * Hs, (0.03 + 0.055 * mz) * Hs]), 0.026 * Hs, 0.016 * Hs, { mat: "muzzle", bone: "head", k: 0.018, sx: 1.1 });
    sc.add(S.ell(0.012 * Hs, 0.009 * Hs, 0.009 * Hs), { mat: "nose", p: add(hc, [0, -0.012 * Hs, (0.036 + 0.055 * mz) * Hs + 0.006 * Hs]), bone: "head", k: 0.006, cs: 0.05 });
    sc.limb(add(hc, [0, -0.037 * Hs, 0.03 * Hs]), add(hc, [0, -0.036 * Hs, (0.03 + 0.047 * mz) * Hs]), 0.014 * Hs, 0.01 * Hs, { mat: "muzzle", bone: "jaw", k: 0.01 });
    for (const s of [1, -1]) sc.add(S.ell(0.012 * Hs, 0.0075 * Hs, 0.008 * Hs), { mat: "furFace", op: "sub", p: add(hc, [s * 0.021 * Hs, 0.004 * Hs, 0.047 * Hs]), bone: "head", k: 0.008 });
    // ears: tall triangles with a hollow
    for (const s of [1, -1]) {
      const eK = PX ? 1.2 : 1;
      const n = sideName(s), base = add(hc, [s * 0.03 * Hs, 0.028 * Hs, -0.006]), tip = add(base, [s * 0.016 * Hs * eK, 0.072 * Hs * (chib ? 0.9 : 1) * eK, -0.012]);
      sc.limb(base, tip, 0.024 * Hs * eK, PX ? 0.004 : 0.0018, { mat: "furFace", bone: "ear" + n, k: 0.012, sz: 0.42 });
      sc.add(S.ell(0.012 * Hs, 0.03 * Hs, 0.0045), { mat: "earIn", op: "sub", p: add(lerp(base, tip, 0.38), [0, 0, 0.011]), R: rotY2(...sub(tip, base)), bone: "ear" + n, k: 0.004, cut: "earIn" });
    }
    // legs
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.limb(F[0], F[1], 0.031, 0.022, { mat: "fur", bone: "scap" + n, k: 0.025, ...fk(0.004 * fl) });
      sc.limb(F[1], F[2], 0.019, 0.014, { mat: "furLeg", bone: "elb" + n, k: 0.012 });
      sc.limb(F[2], F[3], 0.0145, 0.016, { mat: "furLeg", bone: "wri" + n, k: 0.01 });
      sc.add(S.ell(0.022 * Ps, 0.016 * Ps, 0.028 * Ps), { mat: "paw", p: add(F[3], [0, -0.004, 0.012]), bone: "fpaw" + n, k: 0.01 });
      sc.add(S.ell(0.044, 0.074, 0.052), { mat: "fur", p: add(B[0], [0, -0.035, 0.012]), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.03, ...fk(0.004 * fl) });
      sc.limb(B[1], B[2], 0.022, 0.0135, { mat: "furLeg", bone: "stif" + n, k: 0.014 });
      sc.limb(B[2], B[3], 0.0135, 0.0155, { mat: "furLeg", bone: "hock" + n, k: 0.01 });
      sc.add(S.ell(0.021 * Ps, 0.015 * Ps, 0.027 * Ps), { mat: "paw", p: add(B[3], [0, -0.004, 0.012]), bone: "bpaw" + n, k: 0.01 });
      if (!PX) for (const [P4, bn] of [[F[3], "fpaw" + n], [B[3], "bpaw" + n]]) for (let c = -1; c <= 1; c++) sc.add(S.ell(0.0035, 0.003, 0.006), { mat: "claw", p: add(P4, [c * 0.009 * Ps, -0.012, 0.037 * Ps]), bone: bn, k: 0.003, cs: 0.05 });
    }
    // bushy tail, carried low
    const tp = [];
    const T0 = G.tail[0];
    for (let i = 0; i <= 12; i++) { const u = i / 12; tp.push([0, T0[1] - 0.02 * u - 0.09 * u * u, T0[2] - 0.2 * u, ((0.026 + 0.018 * Math.sin(u * 2.5)) * (1 - 0.75 * u * u) + 0.004) * (PX ? 1.25 : 1)]); }
    const tail = sc.add(S.chain(tp), { mat: "fur", p: [0, 0, 0], bone: "tail1", k: 0.02, ...fk(0.012 * fl, 60) });
    tail.wfn = (x, yy, z) => { const u = clamp((T0[2] - z) / 0.2, 0, 1); return [["root", 1 - sstep(0, 0.15, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.2) * 2.5)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.55) * 2.8)], ["tail3", sstep(0.6, 0.95, u)]]; };
    if (PX) {
      // pixel: a few big clean tufts — a three-point chest ruff, one cheek tuft a side
      const tuft = (base, dir, len, r, mat, bone) => sc.limb(base, add(base, mul(norm(dir), len)), r, 0.004, { mat, bone, k: 0.008 });
      for (let i = 0; i < 3; i++) { const a = -0.7 + i * 0.7; tuft(add(G.chest, [0.042 * Math.sin(a), -0.03, 0.11]), [Math.sin(a) * 0.6, -0.8, 0.3], 0.045, 0.02, "furLight", "chest"); }
      for (const s of [1, -1]) tuft(add(hc, [s * 0.05 * Hs, -0.024 * Hs, 0.0]), [s, -0.5, -0.4], 0.03 * Hs, 0.014 * Hs, "muzzle", "head");
    } else if (anime || chunky) {
      // silhouette tufts: ruff, cheeks, back of the neck, tail tip
      const tuft = (base, dir, len, r, mat, bone, bones) => { const t = sc.limb(base, add(base, mul(norm(dir), len)), r, 0.0012, { mat, bone, k: 0.006 }); if (bones) t.bones = bones.map(([b, w]) => [sc.boneIndex.get(b), w]); return t; };
      for (let i = 0; i < 7; i++) { const a = -1.2 + (i / 6) * 2.4; tuft(add(G.chest, [0.05 * Math.sin(a), -0.03 + 0.03 * Math.cos(a * 1.3), 0.105]), [Math.sin(a) * 0.8, -0.6, 0.35], 0.03 * (chunky ? 1.2 : 1), 0.012, "furLight", "chest"); }
      for (const s of [1, -1]) for (let i = 0; i < 3; i++) tuft(add(hc, [s * 0.056 * Hs, -0.02 * Hs - 0.01 * i, 0.004 - 0.008 * i]), [s, -0.45 - 0.2 * i, -0.4], 0.022 * Hs, 0.009 * Hs, "muzzle", "head");
      for (let i = 0; i < 4; i++) tuft(add(G.neck, [0, 0.05 - 0.01 * i, -0.02 - 0.03 * i]), [0, 0.5, -1], 0.028, 0.012, "fur", "neck", [["neck", 0.6], ["chest", 0.4]]);
    }
    // markings: dark saddle, pale underside, white blaze, pale tail tip
    sc.paint(S.ell(0.055, 0.03, 0.15), { mat: "furDark", p: [0, bodyY(0.33), -0.07], soft: 0.035, amt: 0.8 });
    sc.paint(S.ell(0.09, 0.05, 0.22), { mat: "furLight", p: [0, bodyY(0.15), 0], soft: 0.035 });
    if (!PX) sc.paint(S.rcone(0.055 * Hs, 0.007 * Hs, 0.004 * Hs), { mat: "muzzle", p: add(hc, [0, -0.005 * Hs, 0.045 * Hs]), R: rotY2(0, 1, -0.55), soft: 0.005, fur: 0.25 });
    sc.paint(S.sphere(0.045), { mat: "furLight", p: add(tp[12], [0, 0, 0]), soft: 0.03 });
    sc.face({ bone: "head", cls: [5], c: add(hc, [0, 0.0, 0.045 * Hs]), size: [0.05 * Hs, 0.04 * Hs], depth: 0.03, nz: 0.2 });
    sc.faceKind = "wolf";
    return { sc, kind: "quadruped", props: [], G, Hs };
  }

  return {
    cards: ["wolf"], kind: "quadruped", build: wolf, scale: 1.25,
    face: { kind: "wolf", look: { eye: 0x8fd6ff }, params: (ch) => { const b = ch.faces[0], q = 1.25; return { cx: b.c[0], cy: b.c[1] + 0.004 * q, dx: 0.021 * q }; } },
    moves: { attack: { clip: "bite", style: "bite" } },
  };
})());
