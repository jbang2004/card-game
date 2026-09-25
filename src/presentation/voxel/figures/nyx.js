/* 星陨女王·妮克丝 — Nyx, the Starfall Queen (card nyx): a tall sorceress queen with long midnight-indigo hair, a silver
 * tiara crowned with upright ice-blue crystal spikes, a strapless midnight-navy gown with silver star ornaments and a
 * silver girdle with a hanging crystal, a great starry cloak (navy strewn with silver stars, violet lining) and, in her
 * left hand, a star scepter — a dark orb inside a gold armillary ring crossed by an eight-pointed gold star. She raises
 * her right hand to the sky, a falling star gathers above the palm, and she casts it down at the target (the effect
 * engine flies the bolt from the star bone). */
EmberVoxelKit.define("nyx", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const pad = (b, m = 0.04) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // 4-pointed star in the XY plane (half span a, arm half-width b), extruded ±d along Z
  const star4 = (a, b, d) => S.custom((x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    return Math.max(Math.min(ax / b + ay / a, ax / a + ay / b) * b - b, Math.abs(z) - d);
  }, [-a, -a, -d, a, a, d]);
  const band = (R, w, d) => S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - R) - w, Math.abs(z) - d), [-R - w, -R - w, -d, R + w, R + w, d]);

  // ------------------------------------------------------------ props
  // the star scepter (grip at 0, shaft along +Y, face +Z)
  const HEAD = 0.46;
  function scepter() {
    const sc = new Sculpture(), PX = K.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      silver: { c: 0xc4cde4, rough: 0.25, metal: 1, cls: CLS.metal, vary: 0.03 }, silverD: { c: 0x7a82a0, rough: 0.35, metal: 1, cls: CLS.metal },
      gold: { c: 0xe2c276, rough: 0.28, metal: 1, cls: CLS.metal },
      orb: { c: PX ? 0x4658d8 : 0x2a2f86, rough: 0.35, emit: PX ? 0.9 : 0.45, cls: CLS.glow, vary: 0.05 }, core: { c: 0xd8e4ff, rough: 0.3, emit: 1.6, cls: CLS.glow },
    });
    const o = { bone: "p" }, R = 0.0095, bot = -0.2;
    const ym = (bot + HEAD) / 2, yh = (HEAD - bot) / 2;
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, z) - R, Math.abs(y - ym) - yh), pad([-R, bot, -R, R, HEAD, R])), { ...o, mat: "silver", k: 0.001, vdil: 0.4 });
    if (!PX) for (const y of [-0.04, 0.05, 0.3]) sc.add(S.cyl(0.005, R * 1.5, 0.002), { ...o, mat: "gold", p: [0, y, 0], k: 0.001 });
    sc.limb([0, bot - 0.035, 0], [0, bot + 0.01, 0], 0.003, R * 1.3, { ...o, mat: "silverD", k: 0.002, vdil: 0.5 });
    sc.limb([0, HEAD - 0.06, 0], [0, HEAD + 0.005, 0], R * 1.1, R * 1.9, { ...o, mat: "silverD", k: 0.002 });
    const H = [0, HEAD + 0.07, 0];
    // dark orb, gold armillary ring round it, the eight-pointed star crossing it, a spike above
    sc.add(S.sphere(0.036), { ...o, mat: "orb", p: H, k: 0.002 });
    sc.add(band(0.058, 0.005, 0.004), { ...o, mat: "gold", p: H, k: 0.001, vdil: 0.5 });
    if (!PX) sc.add(band(0.058, 0.004, 0.0035), { ...o, mat: "gold", p: H, r: [0, Math.PI / 2, 0], k: 0.001, vdil: 0.5 });
    sc.add(star4(0.095, 0.012, 0.005), { ...o, mat: "gold", p: add(H, [0, 0, 0.012]), k: 0.001, vdil: 0.5 });
    sc.add(star4(0.06, 0.009, 0.0045), { ...o, mat: "silver", p: add(H, [0, 0, 0.014]), r: [0, 0, Math.PI / 4], k: 0.001, vdil: 0.5 });
    sc.add(S.sphere(PX ? 0.022 : 0.012), { ...o, mat: "core", p: add(H, [0, 0, PX ? 0.016 : 0.02]), k: 0.001 });
    return sc;
  }
  // the falling star cast from the raised palm (own bone, scaled by pose)
  function starProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      ray: { c: 0xcfe0ff, rough: 0.3, emit: 1.8, cls: CLS.glow }, halo: { c: 0x8a86ff, rough: 0.3, emit: 1.4, cls: CLS.glow },
      core: { c: 0xffffff, rough: 0.3, emit: 2.2, cls: CLS.glow },
    });
    sc.add(star4(0.1, 0.016, 0.009), { mat: "ray", bone: "p", k: 0.001, vdil: 0.5 });
    sc.add(star4(0.065, 0.012, 0.008), { mat: "halo", bone: "p", r: [0, 0, Math.PI / 4], k: 0.001, vdil: 0.5 });
    sc.add(star4(0.07, 0.013, 0.008), { mat: "ray", bone: "p", r: [Math.PI / 2, 0, 0], k: 0.001, vdil: 0.5 });
    sc.add(S.sphere(0.024), { mat: "core", bone: "p", k: 0.001 });
    return sc;
  }

  function hairOf(sc, P) {
    const q = 1.25, ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.004]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.07, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // centre parting, fringe sweeping out to the temples
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const u = i / 2;
      const root = [s * 0.004, C[1] + R[1] * (0.62 - 0.08 * u), C[2] + R[2] * (0.72 + 0.1 * u)];
      const mid = [s * R[0] * (0.38 + 0.14 * u), ey + 0.05 + 0.006 * u, P.faceZ + 0.002 * q];
      const tip = [s * R[0] * (0.84 + 0.12 * u), ey + 0.006 - 0.02 * u, P.faceZ - 0.016 * q - 0.012 * q * u];
      strand(sc, [root, mid, tip], (0.012 + 0.002 * (1 - u)) * q, 0.002 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
    }
    // long locks in front of the shoulders, over the bodice
    for (const s of [1, -1]) {
      const root = onEll(C, R, s * 1.2, 0.2, 0.98);
      const a = [s * R[0] * 1.1, ey - 0.02, C[2] + R[2] * 0.38];
      const b = [s * R[0] * 1.16, P.chinY - 0.04, C[2] + R[2] * 0.4];
      const tip = [s * (P.shX * 0.62), P.chest[0] - 0.1, P.chest[3] + 0.02];
      const sp = strand(sc, [root, a, b, lerp(b, tip, 0.5), tip], 0.014 * q, 0.003 * q, { wave: 0.007, wd: [s, 0, 0.3], waves: 2.2, phase: s, k: 0.01, wg: 4, bone: "head" });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0] - 0.05, y); return [["head", 1 - t * 0.7], ["chest", t * 0.7]]; };
    }
    // the long fall down the back, over the cloak
    const N = 9;
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1, az = Math.PI + u * 1.6, el = 0.35 - 0.25 * Math.abs(u);
      const root = onEll(C, R, az, el, 0.98), out = onEll(C, R, az, -0.4, 1.22);
      const len = 0.42 + 0.06 * (1 - Math.abs(u)) + 0.02 * Math.sin(i * 2.3);
      const tip = [out[0] * 1.3 + u * 0.04, P.neck[0] - len, -P.chest[3] - 0.07 - 0.015 * (1 - Math.abs(u))];
      const mid = lerp(out, tip, 0.35); mid[2] = Math.min(mid[2], -P.chest[3] - 0.055);
      const sp = strand(sc, [root, out, mid, tip], (0.021 - 0.004 * Math.abs(u)) * q, 0.004 * q, { wave: 0.008, wd: [Math.cos(az), 0, 0], waves: 2.2, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.2, bone: "hairB1", grooves: 0.0012 });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.01, P.neck[0] - 0.4, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    return { C, R };
  }

  /* pixel sprite: a centre-parted fringe of two fat locks a side above the brows, one fat lock each side over the
   * bodice, three broad locks down the back over the cloak (no waves, no thin strands) */
  function hairPx(sc, P) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.004]), cr = P.cran, R = [cr[0] * 1.08, cr[1] * 1.07, cr[2] * 1.1];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    const o = { k: 0.012, taper: 1.1, grooves: 0 };
    for (const s of [1, -1]) {
      const root = [s * 0.005, C[1] + R[1] * 0.68, C[2] + R[2] * 0.7];
      strand(sc, [root, [s * 0.026, ey + 0.056, P.faceZ + 0.004], [s * 0.05, ey + 0.034, P.faceZ - 0.008]], 0.02, 0.009, o);
      strand(sc, [root, [s * 0.05, ey + 0.05, P.faceZ - 0.004], [s * 0.07, ey + 0.004, P.faceZ - 0.026]], 0.019, 0.008, o);
      const sp = strand(sc, [onEll(C, R, s * 1.2, 0.2, 0.98), [s * R[0] * 1.1, ey - 0.02, C[2] + R[2] * 0.38], [s * R[0] * 1.14, P.chinY - 0.04, C[2] + R[2] * 0.4], [s * P.shX * 0.62, P.chest[0] - 0.1, P.chest[3] + 0.02]],
        0.021, 0.012, { k: 0.012, taper: 1.3, wg: 4, bone: "head", grooves: 0 });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0] - 0.05, y); return [["head", 1 - t * 0.7], ["chest", t * 0.7]]; };
    }
    for (const u of [-1, 0, 1]) {
      const az = Math.PI + u * 0.8, root = onEll(C, R, az, 0.35, 0.9), out = onEll(C, R, az, -0.4, 1.16);
      const len = 0.42 + 0.05 * (1 - Math.abs(u));
      const tip = [out[0] * 1.2 + u * 0.04, P.neck[0] - len, -P.chest[3] - 0.075];
      const mid = lerp(out, tip, 0.35); mid[2] = Math.min(mid[2], -P.chest[3] - 0.055);
      const sp = strand(sc, [root, out, mid, tip], 0.044, 0.02, { k: 0.024, taper: 1.3, wg: 5, bone: "hairB1", grooves: 0 });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.01, P.neck[0] - 0.4, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    return { C, R };
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25, PX = K.pixel;
    humanoidBones(sc, P);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -P.cran[2] * 0.9); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.05, -P.cran[2] * 1.1);
    const aR = armJoints(P, -1), EMIT = mul(aR.dir, 0.11);
    sc.bone("star", "handR", ...add(aR.W, EMIT));
    const capeTop = P.shY + 0.004, capeBot = 0.02, capeZ = -P.chest[3] - 0.035;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    mats(sc, {
      skin: { c: 0xe8e0f2, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd8bcc0, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb2506a, rough: 0.4, cls: CLS.lips },
      hair: { c: PX ? 0x2a2256 : 0x3a3c80, rough: 0.55, cls: CLS.hair, vary: 0.08 },
      gown: { c: 0x2c3790, rough: 0.8, cls: CLS.cloth, vary: 0.05 }, gownD: { c: 0x6a52c0, rough: 0.9, cls: CLS.cloth },
      cape: { c: 0x303c96, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, lining: { c: 0x6a52c0, rough: 0.85, cls: CLS.cloth, vary: 0.05 },
      silver: { c: 0xc8d2ea, rough: 0.25, metal: 1, cls: CLS.metal },
      starP: { c: 0xdde6ff, rough: 0.4, emit: 0.5, cls: CLS.glow },
      crystal: { c: 0x86b0ff, rough: 0.2, emit: 0.9, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.93;
    // ---- strapless bodice (shoulders and arms bare), a silver star on the breast, silver armlets and bracelets
    const topY = P.chest[0] + 0.03;
    wrap(sc, RG.box(-X0, X0, P.pelvis[0] - 0.04, topY), "gown", 0.006 * q);
    if (!PX) sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - topY + 0.004) - 0.005, -z - 0.02), [-1, -1, -1, 1, 1, 1]), { mat: "silver", soft: 0.001, only: ["gown"] });
    sc.add(star4(0.03, 0.007, 0.004), { mat: "silver", p: [0, P.chest[0] - 0.02, P.chest[3] + 0.03], bone: "chest", k: 0.001, vdil: 0.55 });
    sc.add(S.sphere(PX ? 0.012 : 0.008), { mat: "crystal", p: [0, P.chest[0] - 0.02, P.chest[3] + 0.034], bone: "chest", k: 0.001 });
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, z / 0.95) - 0.038) - 0.005, Math.abs(y - (P.neck[0] + 0.01)) - 0.008), pad([-0.05, P.neck[0] - 0.01, -0.05, 0.05, P.neck[0] + 0.03, 0.05])),
      { mat: "silver", bone: "neck", bones: [["neck", 0.6], ["chest", 0.4]], k: 0.002 });
    for (const s of [1, -1]) {
      const a = armJoints(P, s);
      wrap(sc, RG.seg(lerp(a.S, a.E, 0.55), lerp(a.S, a.E, 0.72), 0.07), "silver", 0.005 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.82), lerp(a.E, a.W, 0.98), 0.07), "silver", 0.005 * q);
    }
    // ---- skirt: floor-length bell, silver hem and a silver edging on a darker front panel
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, y1 = 0.0, r0 = 0.085, r1 = 0.2, szs = 0.85, h = y0 - y1, zc = -0.01;
    const rAt = (u) => mix(r0, r1, Math.pow(u, 0.7));
    const skirtS = S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = rAt(u), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - (PX ? 0 : 0.01 * u * Math.sin(a * 7 + 0.6));
      return Math.max(rr * 0.85, y, -y - h);
    }, [-r1 - 0.04, -h, -(r1 + 0.05) * szs, r1 + 0.04, 0, (r1 + 0.04) * szs]);
    const sk = sc.add(skirtS, { mat: "gown", p: [0, y0, zc], bone: "root", k: 0.004, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.45, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    const panel = (y) => 0.018 + 0.04 * clamp((y0 - y) / h, 0, 1);
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(x) - panel(y) : 1), [-1, -1, -1, 1, 1, 1]), { mat: "gownD", soft: 0.001, only: ["gown"] });
    if (PX) {
      // pixel sprite: the violet front panel and a silver hem band standing proud of the skirt; no edging, no specks
      const hb = sc.add(S.custom((x, y, z) => { const u = clamp(-y / h, 0, 1); return Math.max(Math.hypot(x, z / szs) - rAt(u) - 0.005, y + h - 0.024, -y - h - 0.002); }, [-r1 - 0.03, -h - 0.01, -(r1 + 0.03) * szs, r1 + 0.03, -h + 0.03, (r1 + 0.03) * szs]),
        { mat: "silver", p: [0, y0, zc], bone: "root", k: 0.002, cs: 0.03, wg: 3 });
      hb.wfn = sk.wfn;
    } else {
    sc.paint(S.custom((x, y, z) => (z > 0.02 && y < y0 - 0.01 ? Math.abs(Math.abs(x) - panel(y) - 0.0058) - 0.0058 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "silver", soft: 0.001, only: ["gown", "gownD"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - 0.012) - 0.0065, [-1, -1, -1, 1, 1, 1]), { mat: "silver", soft: 0.001, only: ["gown", "gownD"] });
    // silver stars scattered on the skirt front
    [[0.1, 0.3], [-0.12, 0.22], [0.14, 0.1], [-0.07, 0.4], [0.06, 0.16], [-0.15, 0.07]].forEach(([x, y]) =>
      sc.paint(star4(0.016, 0.0055, 0.3), { mat: "starP", p: [x, y, 0.2], soft: 0.001, only: ["gown"] }));
    }
    // girdle with a hanging crystal
    const yb = y0 + 0.004;
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, z / 0.82) - 0.092, Math.abs(y) - 0.011), [-0.1, -0.02, -0.1, 0.1, 0.02, 0.1]), { mat: "silver", p: [0, yb, zc], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.002, cs: 0.03, wg: 3 });
    if (!PX) sc.add(S.box(0.004, 0.035, 0.004), { mat: "silver", p: [0, yb - 0.04, zc + 0.082], bone: "root", k: 0.001, vdil: 0.5 });
    sc.add(S.custom((x, y, z) => Math.abs(x) / 0.012 + Math.abs(y) / 0.024 + Math.abs(z) / 0.012 - 1, [-0.012, -0.024, -0.012, 0.012, 0.024, 0.012]), { mat: "crystal", p: [0, yb - 0.09, zc + 0.084], bone: "root", k: 0.001, vdil: 0.5 });
    // ---- the starry cloak: from the shoulders to the floor, wide, violet lining, silver hem, silver stars on the back
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.14, 0.3, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.09, u) - (PX ? 0.01 : 0.018) * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u) + (0.8 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return Math.max(Math.abs(z - c.zc) - 0.0065, Math.abs(x) - c.w, y - capeTop, capeBot + (PX ? 0.008 : 0.008 * (1 + Math.sin(x * 30 + 0.6))) - y); };
    const cp = sc.add(S.custom(capeF, [-0.34, capeBot, -0.3, 0.34, capeTop, 0.12]), { mat: "cape", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.34, capeBot, -0.3, 0.34, capeTop, 0.12]), { mat: "lining", soft: 0.001, only: ["cape"] });
    // pixel sprite: no silver hem paint; four big silver stars laid on the back as flat pieces
    if (PX) [[0.15, 0.5, 9], [-0.16, 0.38, 9], [0.19, 0.22, 8], [-0.17, 0.12, 8]].forEach(([x, y, s]) => {
      const st = sc.add(star4(s * 0.0055, s * 0.0021, 0.003), { mat: "starP", p: [x, y, capeZc(x, y).zc - 0.007], bone: "chest", k: 0.001, vdil: 0.5, wg: 2 });
      st.wfn = cp.wfn;
    });
    else sc.paint(S.custom((x, y, z) => y - capeBot - 0.008 * (1 + Math.sin(x * 30 + 0.6)) - 0.013, [-0.34, capeBot, -0.3, 0.34, capeTop, 0.12]), { mat: "silver", soft: 0.001, only: ["cape", "lining"] });
    if (!PX) [[0.06, 0.62, 5], [-0.12, 0.52, 4], [0.16, 0.36, 5], [-0.04, 0.3, 6], [0.03, 0.46, 3], [-0.19, 0.16, 4], [0.12, 0.14, 4], [-0.1, 0.72, 3], [0.2, 0.58, 3], [-0.2, 0.4, 3]].forEach(([x, y, s]) =>
      sc.paint(star4(s * 0.0055, s * 0.0019, 0.3), { mat: "starP", p: [x, y, -0.25], soft: 0.001, only: ["cape"] }));
    sc.part = "body";

    // ---- hair, tiara and its crystal spikes
    sc.part = "hair";
    const { C, R } = PX ? hairPx(sc, P) : hairOf(sc, P);
    sc.part = "body";
    const cy = C[1] + R[1] * 0.42, cz = C[2] + 0.004, crx = R[0] * 1.03, crz = R[2] * 1.03;
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / crx, (z - cz) / crz) - 1) * crx - 0.005, Math.abs(y - cy) - 0.007 - 0.004 * Math.max(0, (z - cz) / crz)), pad([-crx, cy - 0.02, cz - crz, crx, cy + 0.02, cz + crz])),
      { mat: "silver", bone: "head", k: 0.002 });
    // crystal spikes fanning round the front of the circlet, tallest at the brow, silver prongs between
    const spikes = PX ? [[0, 0.1, 0.019], [0.4, 0.07, 0.015], [-0.4, 0.07, 0.015], [0.8, 0.048, 0.013], [-0.8, 0.048, 0.013]]
      : [[0, 0.1, 0.014], [0.32, 0.068, 0.011], [-0.32, 0.068, 0.011], [0.66, 0.05, 0.009], [-0.66, 0.05, 0.009], [1.0, 0.036, 0.008], [-1.0, 0.036, 0.008]];
    for (const [az, len, w] of spikes) {
      const base = [crx * Math.sin(az), cy + 0.004, cz + crz * Math.cos(az)];
      const dir = norm([Math.sin(az) * 0.3, 1, Math.cos(az) * 0.12]);
      sc.limb(base, add(base, mul(dir, len)), w, PX ? 0.004 : 0.0015, { mat: "crystal", bone: "head", k: 0.002, vdil: 0.6, sz: PX ? 0.7 : 0.6 });
    }
    if (!PX) for (const az of [0.16, -0.16, 0.5, -0.5, 0.84, -0.84]) {
      const base = [crx * Math.sin(az), cy + 0.004, cz + crz * Math.cos(az)];
      sc.limb(base, add(base, [Math.sin(az) * 0.006, 0.028, 0]), 0.006, 0.0015, { mat: "silver", bone: "head", k: 0.001, vdil: 0.55 });
    }
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.03);
    return {
      sc, P, kind: "humanoid",
      props: [{ sc: scepter(), bone: "handL", at: armJoints(P, 1).W, grip: "spear" }, { sc: starProp(), bone: "star", at: add(aR.W, EMIT) }],
    };
  }

  // ------------------------------------------------------------------ motion
  const HIT = 0.5, LEN = 1.3;
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.8);
    C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    fig.root.updateMatrixWorld(true);
    const P = fig.char.P, shL = C.toM(fig, C.wpos(J.armL)), shR = C.toM(fig, C.wpos(J.armR));
    // regal rest: the scepter planted upright at her left, the right hand low and open
    const restL = V(shL.x + 0.12, shL.y - 0.24 + 0.004 * br, shL.z + 0.06), restR = V(shR.x - 0.05, shR.y - 0.28, shR.z + 0.06);
    const poleL = V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2);
    let poleR = V(shR.x - 0.3, shR.y - 0.2, shR.z - 0.2);
    let glow = 0.15 * (0.5 + 0.5 * Math.sin(T * 1.3)), star = 0, face = null;
    let hL = restL, hR = restR, kR = clip === "victory" ? 0 : 1, aimL = [0.14, 1, 0.02];
    if (clip === "attack") {
      // call: the right hand rises high, a star gathers above the palm (0-0.36) → she sweeps it down at the target,
      // cast at HIT → hold (→0.8) → lower (→1.25)
      const g = C.bump(0.02, 0.3, 0.36, HIT, t), reach = C.bump(0.34, HIT - 0.04, 0.8, 1.2, t);
      C.addRot(fig, "root", 0, 0.2 * g - 0.16 * reach, 0);
      J.root.position.add(V(0, 0.012 * g, -0.02 * g + 0.04 * reach));
      C.addRot(fig, "spine", -0.08 * g + 0.08 * reach, 0.06 * g - 0.08 * reach, 0);
      C.addRot(fig, "chest", -0.1 * g + 0.1 * reach, 0.1 * g - 0.1 * reach, 0);
      C.addRot(fig, "head", -0.25 * g + 0.08 * reach, -0.1 * g + 0.12 * reach, 0);
      C.rot(fig, "thighR", -0.25 * reach, 0, 0.03); C.rot(fig, "shinR", 0.15 * reach, 0, 0);
      fig.root.updateMatrixWorld(true);
      const sR = C.toM(fig, C.wpos(J.armR)), len = (P.upArm + P.foreArm) * 0.97;
      const up = V(sR.x - 0.04, sR.y + len * 0.92, sR.z + 0.06), out = V(sR.x + 0.06, sR.y + 0.02, sR.z + len);
      hR = restR.clone().lerp(up, C.sstep(0.02, 0.3, t)).lerp(out, C.sstep(0.36, HIT - 0.02, t)).lerp(restR, C.sstep(0.82, 1.22, t));
      poleR = V(sR.x - 0.35, sR.y - 0.05, sR.z - 0.15);
      // the scepter lifts a little and leans toward the target
      hL = restL.clone().add(V(-0.02 * g, 0.05 * g + 0.02 * reach, 0.05 * reach));
      aimL = [0.04, 1, 0.05 + 0.4 * reach];
      star = C.sstep(0.04, 0.32, t) * (1 - C.sstep(HIT, HIT + 0.04, t));
      glow += 0.9 * C.sstep(0.05, 0.34, t) * (1 - C.sstep(HIT + 0.05, 0.9, t)) + 1.6 * C.bump(HIT - 0.03, HIT, HIT + 0.06, HIT + 0.3, t);
      face = t > 0.05 && t < HIT - 0.02 ? "focus" : t < 0.9 ? "fierce" : null;
      C.rot(fig, "hairB1", 0.12 * reach, 0, 0);
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hL = restL.clone().add(V(0.02 * k, 0.06 * k, -0.04 * k));
      glow *= 1 - 0.8 * k;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      glow += 1.2 * up; star = 0.9 * up;
      face = up > 0.3 ? "open" : null;
    }
    fig.root.updateMatrixWorld(true);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, hL), C.toW(fig, poleL), 1);
    C.aimGrip(fig, "handL", aimL, [0.1, 0, 1], 1);
    if (kR > 0) C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hR), C.toW(fig, poleR), kR);
    if (J.star) {
      J.star.scale.setScalar(Math.max(0.001, star * (1 + 0.1 * Math.sin(T * 9))));
      J.star.rotation.set(0, 0, T * 2.2);
    }
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return clip === "attack" ? t < LEN : clip === "idle" ? true : t < (clip === "hurt" ? 0.6 : 1.6);
  }

  return {
    cards: ["nyx"], kind: "humanoid", build, pose, scale: 1.3,
    face: { kind: "human", look: { eye: 0x6f62d0, brow: "#2c2c5c", lash: "#14121e", lip: "#b2506a", skinD: "#d8bcc0" } },
    moves: { attack: { clip: "starfall", hit: HIT, length: LEN, style: "bolt", ranged: true, windup: 320, emitter: { bone: "star", offset: [0, 0, 0] } } },
  };
})());
