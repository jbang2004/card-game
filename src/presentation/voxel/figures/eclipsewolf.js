/* 蚀月狼王 — the eclipse wolf king (card eclipsewolf): a huge long-legged wolf in midnight navy with a shaggy silver
 * mane and ruff spiking out round the neck and shoulders, glowing ice-blue eyes, pale claws, a long brush tail — and
 * the eclipse itself, a black disc ringed by a blue corona, hanging behind its shoulders like a crown. Attack: it
 * rears and rakes a forepaw down (slash, trail on the claws). */
EmberVoxelKit.define("eclipsewolf", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, rotY2, add, sub, mul, lerp, norm, X, CLS, mats, sideName, quadBones, spline } = K;
  const k = 1.18;                                          // the king is a size up from the pack (and spec.scale on top)
  const P3 = (x, y, z) => [x * k, y * k, z * k];
  const G = {
    root: P3(0, 0.285, -0.14), spine: P3(0, 0.3, -0.02), chest: P3(0, 0.31, 0.1), neck: P3(0, 0.36, 0.17), head: P3(0, 0.425, 0.235), jaw: P3(0, 0.405, 0.3),
    tail: [P3(0, 0.3, -0.21), P3(0, 0.26, -0.28), P3(0, 0.2, -0.33)],
    front: [P3(0.05, 0.33, 0.13), P3(0.052, 0.2, 0.115), P3(0.05, 0.075, 0.135), P3(0.05, 0.024, 0.155)],
    back: [P3(0.055, 0.3, -0.16), P3(0.058, 0.19, -0.105), P3(0.054, 0.095, -0.195), P3(0.054, 0.024, -0.17)],
    ear: P3(0.03, 0.49, 0.235),
  };
  function wolfKing() {
    const sc = new Sculpture();
    const Hs = 1.12 * k, Ps = 1.3;
    quadBones(sc, G);
    const ecl = P3(0, 0.54, 0.0);
    sc.bone("eclipse", "chest", ...ecl);
    mats(sc, {
      fur: { c: 0x3a4896, rough: 0.85, cls: CLS.fur, vary: 0.1, fur: 1 }, furDark: { c: 0x232b62, rough: 0.85, cls: CLS.fur, vary: 0.1, fur: 1 },
      mane: { c: 0xb2c0f0, rough: 0.85, cls: CLS.fur, vary: 0.07, fur: 1 }, maneShade: { c: 0x6c7cc4, rough: 0.85, cls: CLS.fur, vary: 0.08, fur: 1 },
      furLeg: { c: 0x323f86, rough: 0.85, cls: CLS.fur, vary: 0.08, fur: 0.3 }, furFace: { c: 0x3a4894, rough: 0.85, cls: CLS.fur, vary: 0.06, fur: 0.25 },
      muzzle: { c: 0xa8b6ea, rough: 0.85, cls: CLS.fur, vary: 0.05, fur: 0.2 }, nose: { c: 0x0c0d16, rough: 0.3, cls: CLS.skin },
      claw: { c: 0xc4d0f4, rough: 0.35, cls: CLS.skin }, earIn: { c: 0x151936, rough: 0.8, cls: CLS.skin },
      eye: { c: 0xbfeaff, rough: 0.2, emit: 2.2, cls: CLS.glow }, disc: { c: 0x07080f, rough: 0.9, cls: CLS.skin },
      corona: { c: 0x8fd0ff, rough: 0.3, emit: 1.8, cls: CLS.glow }, coronaHot: { c: 0xe6f6ff, rough: 0.3, emit: 2.4, cls: CLS.glow },
    });
    const furD = (amp, f = 70) => (x, yy, z) => { const u = z * f * 0.45 + 1.8 * vnoise(x * f * 0.35, yy * f * 0.35, 3.1); const fr = u - Math.floor(u); return amp * (fr * fr) * (0.6 + 0.4 * vnoise(x * f, yy * f, z * f)); };
    const fk = (a, f) => ({ disp: furD(a, f), dispAmp: a });
    // torso: huge chest, lean waist, strong haunches
    sc.add(S.ell(0.08 * k, 0.1 * k, 0.115 * k), { mat: "fur", p: add(G.chest, P3(0, -0.02, 0)), bone: "chest", k: 0.04, ...fk(0.007) });
    sc.add(S.ell(0.062 * k, 0.072 * k, 0.11 * k), { mat: "fur", p: add(G.spine, P3(0, -0.01, 0)), bone: "spine", k: 0.05, sigma: 0.03, ...fk(0.006) });
    sc.add(S.ell(0.066 * k, 0.078 * k, 0.08 * k), { mat: "fur", p: add(G.root, [0, -0.005, 0]), bone: "root", k: 0.045, ...fk(0.006) });
    const hc = add(G.head, [0, 0.018 * Hs, 0.018 * Hs]);
    sc.limb(add(G.chest, P3(0, 0.02, 0.05)), add(hc, [0, -0.02 * Hs, -0.03 * Hs]), 0.07 * k, 0.05 * Hs, { mat: "fur", bone: "neck", k: 0.04, bones: [["neck", 0.7], ["chest", 0.3]], ...fk(0.008) });
    // head: broad skull, long heavy muzzle, glowing eyes under a hard brow
    sc.add(S.ell(0.046 * Hs, 0.04 * Hs, 0.05 * Hs), { mat: "furFace", p: hc, bone: "head", k: 0.02, ...fk(0.003) });
    const mzL = 0.08;
    sc.limb(add(hc, [0, -0.008 * Hs, 0.028 * Hs]), add(hc, [0, -0.017 * Hs, (0.03 + mzL) * Hs]), 0.027 * Hs, 0.016 * Hs, { mat: "furFace", bone: "head", k: 0.018, sx: 1.05 });
    sc.add(S.ell(0.012 * Hs, 0.009 * Hs, 0.009 * Hs), { mat: "nose", p: add(hc, [0, -0.01 * Hs, (0.036 + mzL) * Hs + 0.002 * Hs]), bone: "head", k: 0.006, cs: 0.05 });
    sc.limb(add(hc, [0, -0.036 * Hs, 0.03 * Hs]), add(hc, [0, -0.038 * Hs, (0.03 + mzL * 0.85) * Hs]), 0.015 * Hs, 0.01 * Hs, { mat: "muzzle", bone: "jaw", k: 0.01 });
    sc.paint(S.ell(0.03 * Hs, 0.018 * Hs, 0.07 * Hs), { mat: "muzzle", p: add(hc, [0, -0.03 * Hs, 0.06 * Hs]), soft: 0.004 });
    for (const s of [1, -1]) {
      sc.add(S.ell(0.011 * Hs, 0.0055 * Hs, 0.007 * Hs), { mat: "eye", p: add(hc, [s * 0.022 * Hs, 0.004 * Hs, 0.043 * Hs]), r: [0, s * 0.35, s * 0.3], bone: "head", k: 0.003, cs: 0.03 });
      sc.limb(add(hc, [s * 0.008 * Hs, 0.015 * Hs, 0.047 * Hs]), add(hc, [s * 0.036 * Hs, 0.02 * Hs, 0.036 * Hs]), 0.006 * Hs, 0.005 * Hs, { mat: "furDark", bone: "head", k: 0.004 });
    }
    // ears: tall, swept back
    for (const s of [1, -1]) {
      const n = sideName(s), base = add(hc, [s * 0.028 * Hs, 0.026 * Hs, -0.01]), tip = add(base, [s * 0.014 * Hs, 0.066 * Hs, -0.024]);
      sc.limb(base, tip, 0.024 * Hs, 0.002, { mat: "furFace", bone: "ear" + n, k: 0.012, sz: 0.42 });
      sc.add(S.ell(0.012 * Hs, 0.028 * Hs, 0.0045), { mat: "earIn", op: "sub", p: add(lerp(base, tip, 0.38), [0, 0, 0.011]), R: rotY2(...sub(tip, base)), bone: "ear" + n, k: 0.004, cut: "earIn" });
    }
    // long powerful legs, big paws, pale claws
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.add(S.ell(0.042 * k, 0.08 * k, 0.056 * k), { mat: "fur", p: add(F[0], P3(0, -0.04, -0.004)), bone: "scap" + n, bones: [["scap" + n, 0.7], ["chest", 0.3]], k: 0.035, ...fk(0.006) });
      sc.limb(F[0], F[1], 0.036 * k, 0.026 * k, { mat: "fur", bone: "scap" + n, k: 0.025, ...fk(0.006) });
      sc.limb(F[1], F[2], 0.022 * k, 0.017 * k, { mat: "furLeg", bone: "elb" + n, k: 0.012 });
      sc.limb(F[2], F[3], 0.017 * k, 0.019 * k, { mat: "furLeg", bone: "wri" + n, k: 0.01 });
      sc.add(S.ell(0.024 * Ps, 0.017 * Ps, 0.03 * Ps), { mat: "furLeg", p: add(F[3], [0, -0.004, 0.012]), bone: "fpaw" + n, k: 0.01 });
      sc.add(S.ell(0.052 * k, 0.088 * k, 0.062 * k), { mat: "fur", p: add(B[0], P3(0, -0.04, 0.012)), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.035, ...fk(0.006) });
      sc.limb(B[1], B[2], 0.026 * k, 0.016 * k, { mat: "furLeg", bone: "stif" + n, k: 0.014 });
      sc.limb(B[2], B[3], 0.016 * k, 0.018 * k, { mat: "furLeg", bone: "hock" + n, k: 0.01 });
      sc.add(S.ell(0.023 * Ps, 0.016 * Ps, 0.029 * Ps), { mat: "furLeg", p: add(B[3], [0, -0.004, 0.012]), bone: "bpaw" + n, k: 0.01 });
      for (const [P4, bn, big] of [[F[3], "fpaw" + n, 1], [B[3], "bpaw" + n, 0.8]]) for (let c = -1; c <= 1; c++) {
        const a = add(P4, [c * 0.011 * Ps, -0.004, 0.036 * Ps]);
        sc.limb(a, add(a, [c * 0.002, -0.014 * big, 0.016 * big]), 0.0045, 0.0015, { mat: "claw", bone: bn, k: 0.002, vdil: 0.5 });
      }
      // shaggy feathering behind the forearms
      for (let i = 0; i < 3; i++) { const b = lerp(F[1], F[0], 0.15 + 0.25 * i); sc.limb(add(b, [s * 0.01, 0, -0.02]), add(b, [s * 0.02, -0.035, -0.055]), 0.016, 0.002, { mat: "fur", bone: "scap" + n, k: 0.006 }); }
    }
    // the mane: a thick silver ruff round the throat and chest, and spikes fanning out over the shoulders and neck
    sc.add(S.ell(0.08 * k, 0.1 * k, 0.07 * k), { mat: "mane", p: add(G.chest, P3(0, 0.02, 0.09)), bone: "chest", bones: [["chest", 0.55], ["neck", 0.45]], k: 0.035, ...fk(0.02, 50) });
    const spike = (base, dir, len, r, mat, bone, bones) => { const t = sc.limb(base, add(base, mul(norm(dir), len)), r, 0.0015, { mat, bone, k: 0.007 }); if (bones) t.bones = bones.map(([b, w]) => [sc.boneIndex.get(b), w]); return t; };
    // throat and chest ruff hanging down in points
    for (let i = 0; i < 9; i++) { const a = -1.25 + (i / 8) * 2.5; spike(add(G.chest, P3(0.06 * Math.sin(a), -0.04 + 0.035 * Math.cos(a * 1.2), 0.13)), [Math.sin(a) * 0.6, -1, 0.3], 0.06 * k, 0.018 * k, i % 3 === 1 ? "maneShade" : "mane", "chest"); }
    // collar: a ring of spikes round the neck, sweeping back
    for (const [ring, zo, lenK] of [[0.2, 0.02, 1.1], [0.55, -0.01, 1], [0.9, -0.04, 0.8]]) for (let i = 0; i < 11; i++) {
      const a = (i / 10) * Math.PI * 1.4 - Math.PI * 0.7, s = Math.sin(a), c = Math.cos(a);   // a = 0 → top of the neck
      const base = add(lerp(G.neck, G.chest, ring), P3(0.058 * s, 0.055 * c, zo));
      spike(base, [s * 0.9, c * 0.5 + 0.1, -0.8], (0.075 + 0.03 * c) * k * lenK, 0.024 * k, (i + ring * 10) % 4 < 1 ? "maneShade" : (i + ring * 10) % 5 < 1 ? "fur" : "mane", "neck", [["neck", 0.6 - 0.4 * ring], ["chest", 0.4 + 0.4 * ring]]);
    }
    // cheek tufts
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) spike(add(hc, [s * 0.042 * Hs, -0.02 * Hs - 0.012 * i, -0.004 - 0.01 * i]), [s, -0.3 - 0.25 * i, -0.55], 0.04 * Hs, 0.013 * Hs, "mane", "head");
    // dark hackles along the spine
    for (let i = 0; i < 6; i++) {
      const u = i / 5, p = lerp(G.chest, G.root, u), bone = u < 0.35 ? "chest" : u < 0.75 ? "spine" : "root";
      spike(add(p, [0, 0.085 * k - 0.012 * u, 0]), [0, 0.6, -1], (0.055 - 0.02 * u) * k, 0.02 * k, "furDark", bone);
    }
    // long brush tail carried low, silver underside
    const T0 = G.tail[0], tp = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14; tp.push([0, T0[1] - 0.04 * u - 0.1 * u * u, T0[2] - 0.24 * u + 0.02 * u * u, (0.03 + 0.024 * Math.sin(u * 2.6)) * (1 - 0.7 * u * u) + 0.005]); }
    const tail = sc.add(S.chain(tp), { mat: "fur", p: [0, 0, 0], bone: "tail1", k: 0.022, ...fk(0.016, 55) });
    tail.wfn = (x, yy, z) => { const u = clamp((T0[2] - z) / 0.22, 0, 1); return [["root", 1 - sstep(0, 0.15, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.2) * 2.5)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.55) * 2.8)], ["tail3", sstep(0.6, 0.95, u)]]; };
    sc.paint(S.sphere(0.05), { mat: "mane", p: tp[14].slice(0, 3), soft: 0.03 });
    // markings: darker saddle, silver belly and inner legs
    sc.paint(S.ell(0.07 * k, 0.035 * k, 0.17 * k), { mat: "furDark", p: [0, G.spine[1] + 0.06 * k, -0.02], soft: 0.035, amt: 0.8 });
    sc.paint(S.ell(0.05 * k, 0.03 * k, 0.16 * k), { mat: "maneShade", p: [0, G.spine[1] - 0.075 * k, 0], soft: 0.03, amt: 0.7 });
    // the eclipse: black disc, blue corona with a hot inner rim and flares, facing forward over the shoulders
    sc.add(S.cyl(0.006, 0.062 * k, 0.002), { mat: "disc", p: ecl, r: [Math.PI / 2 - 0.25, 0, 0], bone: "eclipse", k: 0.002 });
    sc.add(S.torus(0.07 * k, 0.009), { mat: "corona", p: ecl, r: [Math.PI / 2 - 0.25, 0, 0], bone: "eclipse", k: 0.002 });
    sc.add(S.torus(0.063 * k, 0.005), { mat: "coronaHot", p: add(ecl, [0, -0.002, 0.004]), r: [Math.PI / 2 - 0.25, 0, 0], bone: "eclipse", k: 0.002 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, L = (i % 2 ? 0.02 : 0.035) * k, c = Math.cos(a), s = Math.sin(a);
      const dir = [c, s * Math.cos(0.25), -s * Math.sin(0.25)], b = add(ecl, mul(dir, 0.072 * k));
      sc.limb(b, add(b, mul(dir, L)), 0.007, 0.0015, { mat: "corona", bone: "eclipse", k: 0.002, vdil: 0.5 });
    }
    sc.faceKind = "eclipsewolf";
    return { sc, kind: "quadruped", props: [], G, Hs };
  }

  /* idle: the shared quadruped (slow wag), the corona breathing and the eclipse bobbing; attack "rake": rear on the
   * haunches with the left forepaw high (0-0.3) → lunge and rake it down across the target (0.3-0.42, contact 0.42,
   * corona flare) → hold (→0.56) → drop back to all fours (→1.2) */
  function pose(fig, clip, t, T, C) {
    const { rot, off, bump, sstep } = C;
    const r = C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    const wag = Math.sin(T * 1.4);
    rot(fig, "tail1", 0.1, 0.2 * wag, 0); rot(fig, "tail2", 0, 0.15 * Math.sin(T * 1.4 - 0.8), 0); rot(fig, "tail3", 0, 0.15 * Math.sin(T * 1.4 - 1.6), 0);
    off(fig, "eclipse", 0, 0.008 * Math.sin(T * 1.3), 0);
    rot(fig, "eclipse", 0, 0, 0.3 * T);
    let glow = 0.15 + 0.15 * Math.sin(T * 1.7);
    if (clip !== "attack") { C.emitBoost(fig, glow); return r; }
    const rear = bump(0, 0.28, 0.32, 0.44, t), sw = sstep(0.3, 0.42, t) * (1 - sstep(0.6, 1.1, t)), lunge = bump(0.3, 0.42, 0.58, 1.05, t);
    const shake = bump(0.42, 0.44, 0.5, 0.58, t) * Math.sin(t * 90) * 0.02;
    rot(fig, "root", -0.55 * rear + 0.12 * lunge, 0.15 * rear - 0.1 * lunge, 0);
    off(fig, "root", 0, 0.03 * rear, -0.03 * rear + 0.14 * lunge);
    rot(fig, "spine", -0.08 * rear, 0, 0);
    rot(fig, "chest", -0.12 * rear + 0.08 * lunge, 0, 0.1 * lunge);
    rot(fig, "neck", 0.35 * rear + 0.1 * lunge + shake, 0, 0);
    rot(fig, "head", 0.15 * rear - 0.05 * lunge, -0.15 * lunge, 0);
    rot(fig, "jaw", 0.45 * bump(0.1, 0.3, 0.5, 0.7, t), 0, 0);
    // the raking paw (L): raised high and forward → swept down and across, claws leading
    const up = rear * (1 - sw);
    rot(fig, "scapL", -1.9 * up - 0.9 * sw + 0.7 * sw * sstep(0.42, 0.56, t), 0, 0.25 * up - 0.35 * sw);
    rot(fig, "elbL", 1.1 * up + 0.2 * sw, 0, 0);
    rot(fig, "wriL", -0.5 * up + 0.3 * sw, 0, 0);
    // the other forepaw tucked, hind legs set under the rear
    rot(fig, "scapR", -0.6 * rear - 0.3 * lunge, 0, 0); rot(fig, "elbR", 1.2 * rear, 0, 0); rot(fig, "wriR", -0.4 * rear, 0, 0);
    for (const s of ["L", "R"]) { rot(fig, "hip" + s, 0.6 * rear - 0.2 * lunge, 0, 0); rot(fig, "stif" + s, -0.35 * rear, 0, 0); rot(fig, "hock" + s, 0.25 * rear, 0, 0); rot(fig, "ear" + s, -0.5 * rear, 0, 0); }
    glow += 0.4 * rear + 1.6 * bump(0.38, 0.43, 0.52, 0.85, t);
    C.emitBoost(fig, glow);
    return t < 1.2;
  }

  return {
    cards: ["eclipsewolf"], kind: "quadruped", build: wolfKing, scale: 1.3, pose,
    moves: { attack: { clip: "rake", style: "slash", hit: 0.42, length: 1.2, reach: 0.3, trail: { bone: "wriL", from: [0, -0.02, 0.01], to: [0, -0.075, 0.07] } } },
  };
})());
