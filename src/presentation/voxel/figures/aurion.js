/* 曙日神·奥瑞恩 — Aurion, god of the dawn sun (card aurion): a towering god in white-and-gold plate and long white
 * robes lined in deep blue — long pale-gold hair under a tall spiked sun crown, a gold sun on the breastplate, broad
 * layered pauldrons — and behind his head the risen sun: a pale burning disc ringed in gold with long rays (the
 * signature at board scale, with his size). He leans on a colossal two-handed greatsword planted point-down, as on the
 * card; the attack lifts it in both hands up in front and over the head and brings it down in a great cleave. */
EmberVoxelKit.define("aurion", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const V = 0.0125;
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // sun: disc r0 with n pointed rays out to r1 (2-D, XY); w = ray half-width as a fraction of the sector
  const sun2 = (x, y, r0, r1, n, w) => {
    const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2, f = 1 - Math.abs(((((a / (2 * Math.PI)) * n) % 1) + 1) % 1 - 0.5) * 2;
    return Math.min(r - r0, Math.max(r - (r0 + (r1 - r0) * Math.max(0, 1 - f / w)), r0 * 0.5 - r));
  };

  // ------------------------------------------------------------ prop: the greatsword (grip at 0, blade along +Y)
  const B0 = 0.05, BL = 0.6;
  function greatsword() {
    const sc = new Sculpture(), PX = K.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      steel: { c: 0xe4ecf8, rough: 0.3, metal: 0.7, cls: CLS.metal, vary: 0.02 }, steelD: { c: 0x98a4b8, rough: 0.3, metal: 0.9, cls: CLS.metal },
      gold: { c: 0xdcaa44, rough: 0.3, metal: 1, cls: CLS.metal, vary: 0.02 }, grip: { c: 0x4a3222, rough: 0.8, cls: CLS.leather },
    });
    const o = { bone: "p" };
    sc.limb([0, -0.13, 0], [0, 0.03, 0], 0.011, 0.011, { ...o, mat: "grip", k: 0.002 });
    sc.add(S.ell(0.016, 0.02, 0.012), { ...o, mat: "gold", p: [0, -0.148, 0], k: 0.002 });
    // cross-guard: a broad bar sweeping up at the ends, a sun boss in the middle
    for (const s of [1, -1]) sc.limb([0, 0.036, 0], [s * 0.1, 0.058, 0], 0.013, 0.008, { ...o, mat: "gold", k: 0.003, sz: 0.7 });
    for (const s of [1, -1]) sc.limb([s * 0.095, 0.056, 0], [s * 0.12, 0.09, 0], 0.009, 0.003, { ...o, mat: "gold", k: 0.002, vdil: 0.5 });
    sc.add(S.custom((x, y, z) => Math.max(sun2(x, y, 0.018, 0.038, 8, 0.45), Math.abs(z) - 0.011), [-0.04, -0.04, -0.013, 0.04, 0.04, 0.013]), { ...o, mat: "gold", p: [0, 0.042, 0], k: 0.001 });
    const bw = 0.034;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / BL, 0, 1), w = bw * (u < 0.86 ? 1 - 0.12 * u : (1 - 0.12 * 0.86) * (1 - (u - 0.86) / 0.14)) + 0.0012;
      const dz = Math.abs(z) - (PX ? 0.008 * (1 - 0.4 * Math.min(1, Math.abs(x) / w)) + 0.002 : 0.0065 * (1 - 0.6 * Math.min(1, Math.abs(x) / w)) + 0.0015);   // pixel: a thicker blade
      return Math.max(Math.abs(x) - w, dz, -y, y - BL);
    }, [-bw - 0.004, 0, -0.01, bw + 0.004, BL, 0.01]);
    sc.add(blade, { ...o, mat: "steel", p: [0, B0, 0], k: 0.001 });
    // gold ricasso at the root, a dark fuller up the middle
    sc.paint(S.custom((x, y, z) => y - B0 - 0.045, [-0.05, B0, -0.02, 0.05, B0 + 0.06, 0.02]), { mat: "gold", soft: 0.0005, only: ["steel"] });
    if (!PX) sc.paint(S.custom((x, y, z) => { const u = (y - B0) / BL; return u < 0.09 || u > 0.75 ? 1 : Math.abs(x) - 0.004; }, [-0.05, B0, -0.02, 0.05, B0 + BL, 0.02]), { mat: "steelD", soft: 0.0005, only: ["steel"] });
    return sc;
  }

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25, PX = K.pixel;   // PX: pixel-sprite variant
    humanoidBones(sc, P);
    const capeTop = P.shY - 0.004, capeBot = 0.08, capeZ = -0.11;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.01, -0.09); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.05, -0.12);
    const SUN = [0, 0.95, -0.17];
    sc.bone("sun", "chest", ...SUN);
    mats(sc, PX ? {
      // flat, clearly stepped: warm gold hair, cream sun disc inside a saturated gold ring, white plate and cloth, deep blue
      skin: { c: 0xecc8b0, rough: 0.55, cls: CLS.skin }, skinDeep: { c: 0xd8ac98, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb87a6c, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xf4d888, rough: 0.6, cls: CLS.hair },
      mail: { c: 0x2c3c7c, rough: 0.8, cls: CLS.cloth },
      disc: { c: 0xfff2d4, rough: 0.3, emit: 0.7, cls: CLS.glow }, halo: { c: 0xf4b030, rough: 0.3, emit: 1.0, cls: CLS.glow },
      plate: { c: 0xdce6f6, rough: 0.45, metal: 0.2, cls: CLS.metal },
      plateD: { c: 0x98a6c0, rough: 0.45, metal: 0.2, cls: CLS.metal },
      gold: { c: 0xe8b040, rough: 0.4, metal: 0.3, cls: CLS.metal },
      cloth: { c: 0xf2f2f8, rough: 0.85, cls: CLS.cloth }, clothD: { c: 0x2a3a7a, rough: 0.9, cls: CLS.cloth },
      goldC: { c: 0xdca640, rough: 0.8, cls: CLS.cloth },
      leather: { c: 0x5a3c26, rough: 0.6, cls: CLS.leather },
    } : {
      skin: { c: 0xecc8b0, rough: 0.55, cls: CLS.skin, vary: 0.013 }, skinDeep: { c: 0xd8ac98, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb87a6c, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xf2e4bc, rough: 0.6, cls: CLS.hair, vary: 0.08 },
      mail: { c: 0x2c3c7c, rough: 0.8, cls: CLS.cloth, vary: 0.05 },
      disc: { c: 0xfff0c8, rough: 0.3, emit: 1.3, cls: CLS.glow }, halo: { c: 0xf4c85a, rough: 0.3, emit: 1.2, cls: CLS.glow },
      plate: { c: 0xdce6f6, rough: 0.28, metal: 0.5, cls: CLS.metal, vary: 0.025 },
      plateD: { c: 0xa8b4cc, rough: 0.32, metal: 0.7, cls: CLS.metal },
      gold: { c: 0xdcaa44, rough: 0.3, metal: 1, cls: CLS.metal, vary: 0.02 },
      cloth: { c: 0xeeeef4, rough: 0.85, cls: CLS.cloth, vary: 0.035 }, clothD: { c: 0x2a3a7a, rough: 0.9, cls: CLS.cloth, vary: 0.05 },
      goldC: { c: 0xd8a848, rough: 0.8, cls: CLS.cloth, vary: 0.04 },
      leather: { c: 0x5a3c26, rough: 0.6, cls: CLS.leather, vary: 0.06 },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.95;
    // ---- mail under the plate (whatever the plate leaves open)
    const armRg = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.3)), lerp(a.E, a.W, 0.5), 0.08); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.05, P.neck[0] + 0.02), ...armRg), "mail", 0.004 * q);
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s), side = s > 0 ? [0, 0.2] : [-0.2, 0];
      wrap(sc, RG.seg(lerp(a.S, a.E, 0.35), lerp(a.S, a.E, 0.94), 0.08), "plate", 0.006);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.15), lerp(a.E, a.W, 0.97), 0.08), "plate", 0.007);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.036 * P.hand)), 0.05 * P.hand), "plateD", 0.0035);
      sc.limb(lerp(a.E, a.W, 0.84), add(a.W, mul(a.dir, 0.008)), 0.034, 0.039, { mat: "gold", bone: "fore" + n, k: 0.002 });
      sc.add(S.ell(0.03, 0.03, 0.026), { mat: "gold", p: add(a.E, [s * 0.006, 0.004, -0.018]), bone: "fore" + n, k: 0.003 });
      wrap(sc, RG.box(...side, -0.03, P.ankY + 0.028), "plateD", 0.006);
      // pauldron: a big layered white dome with a gold rim and a gold ridge
      const pc = [s * 0.165, P.shY + 0.002, -0.008], pe = S.ell(0.084, 0.07, 0.09);
      sc.add(S.custom((x, y, z) => Math.max(pe.f(x, y, z), -0.034 - y), [-0.084, -0.034, -0.09, 0.084, 0.07, 0.09]), { mat: "plate", p: pc, bone: "chest", k: 0.003 });
      sc.add(S.custom((x, y, z) => Math.max(Math.abs(pe.f(x, y, z) + 0.004) - 0.006, -0.034 - y, y + 0.016), [-0.1, -0.034, -0.1, 0.1, -0.005, 0.1]), { mat: "gold", p: pc, bone: "chest", k: 0.002 });
      sc.add(S.ell(0.07, 0.012, 0.012), { mat: "gold", p: add(pc, [0, 0.06, 0]), r: [0, 0, s * 0.35], bone: "chest", k: 0.002 });
    }
    // ---- breastplate with a gold sun, fauld, belt
    sc.add(S.ell(0.12, 0.104, 0.1), { mat: "plate", p: [0, P.chest[0] - 0.004, -0.008], bone: "chest", k: 0.004 });
    sc.limb([0, P.waist[0] + 0.02, -0.004], [0, P.pelvis[0] + 0.03, -0.004], 0.098, 0.106, { mat: "plate", bone: "spine", k: 0.003, sz: 0.8 });
    sc.paint(S.custom((x, y, z) => (z < 0.04 ? 1 : sun2(x, y - P.chest[0] - 0.008, 0.02, 0.06, 8, 0.5)), [-0.2, 0.5, -0.2, 0.2, 0.9, 0.2]), { mat: "gold", soft: 0.001, only: ["plate"] });
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, z / 0.9) - 0.054) - 0.007, Math.abs(y - (P.neck[0] + 0.008)) - 0.012), pad([-0.07, P.neck[0] - 0.01, -0.07, 0.07, P.neck[0] + 0.03, 0.07])),
      { mat: "gold", bone: "chest", bones: [["chest", 0.7], ["neck", 0.3]], k: 0.002 });
    wrap(sc, RG.box(-0.2, 0.2, P.pelvis[0] + 0.012, P.pelvis[0] + 0.034), "leather", 0.009);
    sc.add(S.cyl(0.005, 0.02, 0.002), { mat: "gold", p: [0, P.pelvis[0] + 0.023, P.pelvis[3] + 0.04], r: [Math.PI / 2, 0, 0], bone: "root", k: 0.001 });

    // ---- hair: golden cap, fringe, locks by the cheeks, a long fall down the back
    sc.part = "hair";
    const ey = P.eyeY, HC = add(P.cranC, [0, 0.01, -0.006]), cr = P.cran, HR = [cr[0] * 1.08, cr[1] * 1.1, cr[2] * 1.1];
    sc.add(S.minus(S.ell(...HR), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: HC, bone: "head", k: 0.006 });
    // fringe (pixel: three fat locks whose tips stop above the eye band)
    const NF = PX ? 3 : 6;
    for (let i = 0; i < NF; i++) {
      const u = (i / (NF - 1)) * 2 - 1;
      const root = [0.012 * u, HC[1] + HR[1] * 0.6, HC[2] + HR[2] * 0.74];
      const mid = [HR[0] * 0.42 * u, ey + 0.045, P.faceZ + 0.004 * q];
      const tip = [HR[0] * 0.66 * u, PX ? ey + 0.03 - 0.008 * Math.abs(u) : ey + 0.014 - 0.01 * Math.abs(u), P.faceZ - 0.012 * q * Math.abs(u)];
      if (PX) strand(sc, [root, mid, tip], 0.02 * q, 0.009 * q, { k: 0.01, taper: 1.2, grooves: 0 });
      else strand(sc, [root, mid, tip], 0.012 * q, 0.0018 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
    }
    for (const s of [1, -1]) {
      const root = onEll(HC, HR, s * 1.15, 0.2, 0.98), a = [s * HR[0] * 1.06, ey - 0.03, HC[2] + HR[2] * 0.3], tip = [s * (P.shX * 0.55), P.chest[0] + 0.02, P.chest[3] + 0.02];
      const sp = PX ? strand(sc, [root, a, lerp(a, tip, 0.5), tip], 0.022 * q, 0.01 * q, { k: 0.012, wg: 4, taper: 1.2, grooves: 0 })
        : strand(sc, [root, a, lerp(a, tip, 0.5), tip], 0.016 * q, 0.004 * q, { k: 0.01, wg: 4, wave: 0.005, wd: [s, 0, 0], grooves: 0.0012 });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0], y); return [["head", 1 - t * 0.7], ["chest", t * 0.7]]; };
    }
    const NB = PX ? 4 : 6;   // pixel: four broad locks down the back
    for (let i = 0; i < NB; i++) {
      const u = (i / (NB - 1)) * 2 - 1, az = Math.PI + u * (PX ? 1.1 : 1.25);
      const root = onEll(HC, HR, az, 0.3, 0.98), out = onEll(HC, HR, az, -0.45, 1.15);
      const tip = [out[0] * 1.2, P.chest[0] - 0.12 - 0.03 * (1 - Math.abs(u)), -0.17 - 0.01 * (1 - Math.abs(u))];
      const mid = lerp(out, tip, 0.4); mid[2] = Math.min(mid[2], -0.14);
      const sp = PX ? strand(sc, [root, out, mid, tip], 0.042 - 0.006 * Math.abs(u), 0.016, { k: 0.014, wg: 5, bone: "hairB1", taper: 1.2, grooves: 0 })
        : strand(sc, [root, out, mid, tip], 0.024 - 0.004 * Math.abs(u), 0.005, { wave: 0.007, wd: [Math.cos(az), 0, 0], waves: 2, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.2, bone: "hairB1", grooves: 0.0014 });
      sp.wfn = (x, y) => { const t = sstep(HC[1] - 0.02, P.chest[0] - 0.1, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    sc.part = "body";
    // ---- sun crown: a gold circlet, spikes fanning up round the front, the middle one tallest
    const cy = HC[1] + HR[1] * 0.3, cz = HC[2], crx = HR[0] * 1.02, crz = HR[2] * 1.02;
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / crx, (z - cz) / crz) - 1) * crx - 0.006, Math.abs(y - cy) - 0.008), pad([-crx, cy - 0.02, cz - crz, crx, cy + 0.02, cz + crz])),
      { mat: "gold", bone: "head", k: 0.002 });
    for (const az of PX ? [0, 0.6, -0.6] : [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
      const len = 0.075 - 0.035 * Math.abs(az) / 1.2 + (az === 0 ? 0.02 : 0);
      const base = [crx * Math.sin(az), cy + 0.004, cz + crz * Math.cos(az)];
      const dir = norm([Math.sin(az) * 0.35, 1, Math.cos(az) * 0.3]);
      sc.limb(base, add(base, mul(dir, len * (PX ? 1.25 : 1))), PX ? 0.02 : 0.011, PX ? 0.007 : 0.0015, { mat: "gold", bone: "head", k: 0.002, vdil: 0.55, sz: PX ? 0.75 : 0.6 });
    }

    // ---- the risen sun behind his head, on its own bone: a pale burning disc, a gold ring and 16 long rays
    const Rd = 0.15;
    if (PX) {
      // pixel: a big cream disc sized to frame the sprite's enlarged head, set back inside a thick raised gold ring, and
      // eight fat gold rays (long and short) — relief, not paint, so the mesh simplifier cannot smear the ring's colour
      const Rp = 0.2, W = 0.02;
      const ray = (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2, k = (((a / (2 * Math.PI)) * 8) % 1 + 1) % 1, f = Math.abs(k - 0.5) * 2;
        const long = Math.round((((a / (2 * Math.PI)) * 8) % 8 + 8) % 8) % 2 ? 0.065 : 0.11;
        return Math.max(r - Rp - 2 * W - long * Math.max(0, 1 - (1 - f) / 0.32), Rp + W - r); };
      sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, y) - Rp, Math.abs(z) - 0.008), pad([-Rp, -Rp, -0.01, Rp, Rp, 0.01])), { mat: "disc", p: SUN, bone: "sun", k: 0.001 });
      sc.add(S.custom((x, y, z) => Math.max(Math.min(Math.abs(Math.hypot(x, y) - Rp - W) - W, ray(x, y)), Math.abs(z) - 0.015), pad([-Rp - 0.16, -Rp - 0.16, -0.016, Rp + 0.16, Rp + 0.16, 0.016])),
        { mat: "halo", p: SUN, bone: "sun", k: 0.001 });
    } else {
    const rays = (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x), f = Math.abs(((((a / (2 * Math.PI)) * 16) % 1) + 1) % 1 - 0.5) * 2;
      const long = Math.floor(((a / (2 * Math.PI)) * 16 + 16.5)) % 2 ? 0.12 : 0.075;
      return Math.max(r - Rd - 0.01 - long * Math.pow(Math.max(0, (f - 0.6) / 0.4), 0.7), Rd - r); };
    sc.add(S.custom((x, y, z) => Math.max(Math.min(Math.hypot(x, y) - Rd - 0.012, rays(x, y)), Math.abs(z) - 0.005), pad([-Rd - 0.14, -Rd - 0.14, -0.01, Rd + 0.14, Rd + 0.14, 0.01], 0.03)),
      { mat: "disc", p: SUN, bone: "sun", k: 0.001, vdil: 0.4 });
    sc.paint(S.custom((x, y, z) => Math.max(Rd - 0.004 - Math.hypot(x, y), 0), pad([-Rd - 0.14, -Rd - 0.14, -0.02, Rd + 0.14, Rd + 0.14, 0.02])), { mat: "halo", p: SUN, soft: 0.001, only: ["disc"] });
    }

    // ---- cloth: floor-length surcoat skirt, long cape
    sc.part = "cloth";
    const y0 = P.pelvis[0] + 0.02, y1 = 0.05, h = y0 - y1, r0 = 0.11, r1 = 0.17, szs = 0.82;
    const sk = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.85)), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - (PX ? 0 : 0.008 * u * Math.sin(a * 9 + 0.6));
      // a split up the front from the knees
      const slit = z > 0 ? 0.018 * sstep(0.45, 0.9, u) - Math.abs(x) : -1;
      return Math.max(smax(rr, Math.max(-y - h, y), 0.005), slit);
    }, pad([-r1 - 0.02, -h, -r1 * szs - 0.02, r1 + 0.02, 0, r1 * szs + 0.02], 0.02)), { mat: "cloth", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.45, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => (PX ? Math.abs(y - y1 - 0.012) - 0.012 : Math.abs(y - y1 - 0.007) - 0.0065), [-1, 0, -1, 1, 0.3, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => (z < 0.03 ? 1 : Math.abs(Math.abs(x) - 0.03) - 0.0065), [-1, -1, -1, 1, 1, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    if (!PX) sc.paint(S.custom((x, y, z) => (z < 0.03 ? 1 : sun2(x, y - 0.24, 0.012, 0.03, 8, 0.5)), [-1, -1, -1, 1, 1, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.09, 0.26, Math.pow(u, 0.75));
      return { u, w, zc: mix(capeZ, capeZ - 0.1, u) - (PX ? 0 : 0.018 * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u)) + (0.55 - 0.25 * u) * (x * x) / w };
    };
    const hem = (x) => (PX ? 0.006 : 0.012 * (1 + Math.sin(x * 30 + 0.6)));   // pixel: a straight hem
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - (PX ? 0.009 : 0.0065), Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + hem(x) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.3, capeBot, -0.3, 0.3, capeTop, 0.06]), { mat: "cloth", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > -0.04 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.3, capeBot, -0.3, 0.3, capeTop, 0.06]), { mat: "clothD", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => (z > -0.04 ? 1 : y - capeBot - hem(x) - (PX ? 0.02 : 0.014)), [-0.3, capeBot, -0.3, 0.3, capeTop, 0.06]), { mat: "goldC", soft: 0.001, only: ["cloth", "clothD"] });
    for (const s of [1, -1]) sc.add(S.cyl(0.005, 0.015, 0.002), { mat: "gold", p: [s * 0.064, capeTop - 0.014, capeZc(s * 0.064, capeTop - 0.014).zc - 0.009], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.001, part: "cloth" });
    sc.part = "body";

    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [{ sc: greatsword(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  // ------------------------------------------------------------ motion
  const HIT = 0.44, LEN = 1.25;
  /* the greatsword swings (right hand on the grip, the left joins below it through the attack) in the plane of up U and forward F: angle φ from U toward F, the hand on a circle round a
   * centre by the right shoulder, the blade pointing out along the radius. Rest φ ≈ 2.55 (planted point-down before
   * him, as on the card); the attack raises it up in front and over the head (φ → -0.8, 0-0.3), cleaves down
   * (→ 1.6 at contact) and returns. */
  const phiOf = (clip, t) => {
    if (clip === "victory") return 2.55 - 2.55 * sstep(0, 0.3, t) + 2.55 * sstep(1.2, 1.6, t);
    if (clip !== "attack") return 2.55;
    return 2.55 - 3.35 * sstep(0.0, 0.3, t) + 2.45 * sstep(0.32, 0.47, t) + 0.9 * sstep(0.72, 1.15, t);
  };
  function pose(fig, clip, t, T, C) {
    const V3 = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.8), atk = clip === "attack";
    const r = C.base(fig, atk ? "idle" : clip, atk ? 0 : t, T);
    const P = fig.char.P, reach = P.upArm + P.foreArm;
    let face = null, two = 0, glow = 0.2 * (0.5 + 0.5 * Math.sin(T * 1.2));
    if (atk) {
      const wind = C.bump(0, 0.28, 0.32, 0.42, t), th = C.bump(0.32, HIT, 0.66, 1.1, t);
      two = C.sstep(0, 0.2, t) * (1 - C.sstep(0.8, 1.15, t));
      C.addRot(fig, "root", 0, 0.15 * wind - 0.15 * th, 0);
      J.root.position.add(V3(0, 0.01 * wind - 0.05 * th, -0.02 * wind + 0.07 * th));
      C.addRot(fig, "spine", -0.08 * wind + 0.1 * th, 0.08 * wind - 0.06 * th, 0);
      C.addRot(fig, "chest", -0.1 * wind + 0.1 * th, 0.1 * wind - 0.08 * th, 0);
      C.addRot(fig, "head", 0.06 * wind - 0.08 * th, -0.08 * wind, 0);
      C.rot(fig, "thighL", -0.55 * th - 0.1 * wind, 0, -0.05); C.rot(fig, "shinL", 0.4 * th + 0.1 * wind, 0, 0); C.rot(fig, "footL", 0.15 * th, 0, 0);
      C.rot(fig, "thighR", 0.38 * th + 0.08 * wind, 0, 0.05); C.rot(fig, "shinR", 0.28 * th + 0.1 * wind, 0, 0); C.rot(fig, "footR", -0.22 * th, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.15 * th, 0, 0); C.rot(fig, "cape2" + s, 0.12 * th, 0, 0); }
      C.rot(fig, "hairB1", 0.3 * th - 0.1 * wind, 0, 0); C.rot(fig, "hairB2", 0.2 * th, 0, 0);
      glow += 0.5 * C.bump(0.05, 0.3, 0.4, 0.5, t) + 1.6 * C.bump(HIT - 0.04, HIT, HIT + 0.08, HIT + 0.45, t);
      face = t > 0.06 && t < 1.0 ? "fierce" : null;
    } else if (clip === "victory") glow += 1.2 * C.bump(0, 0.3, 1.2, 1.6, t);
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    const phi = phiOf(clip, t);
    const U = V3(-0.08, 1, 0).normalize(), F = V3(0.15, 0, 1).normalize();
    const dir = U.clone().multiplyScalar(Math.cos(phi)).addScaledVector(F, Math.sin(phi)).normalize();
    const mot = U.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(F, Math.cos(phi)).normalize();
    // at rest the sword is planted before him, the hand on the grip; the attack swings from nearer the midline
    const cen = V3(shR.x * mix(0.55, 0.3, two), shR.y - 0.06, shR.z + 0.1);
    const rad = reach * (0.8 - 0.1 * Math.max(0, Math.cos(phi)) + 0.25 * Math.min(0, Math.cos(phi)));
    const hand = cen.clone().addScaledVector(dir, rad).add(V3(0, 0.003 * br, 0));
    if (clip === "hurt") { const e = Math.exp(-t * 6) * C.sstep(0, 0.05, t); hand.add(V3(-0.02 * e, 0.04 * e, -0.05 * e)); }
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V3(shR.x - 0.3, shR.y - 0.2, shR.z - 0.15)), 1);
    C.aimGrip(fig, "handR", [dir.x, dir.y, dir.z], [-0.2 + mot.x, mot.y, mot.z], 1);
    fig.root.updateMatrixWorld(true);
    // left hand: relaxed at his side ⇄ on the grip below the right hand
    const rest = V3(shL.x + 0.05, shL.y - 0.27 + 0.004 * br, shL.z + 0.04);
    let lh = rest;
    const pr = fig.props && fig.props.find((p) => p.bone === "handR");
    if (pr && two > 0.001) lh = rest.clone().lerp(C.toM(fig, pr.holder.localToWorld(V3(0, -0.095, 0))), two);
    if (clip === "hurt") { const e = Math.exp(-t * 6) * C.sstep(0, 0.05, t); lh.add(V3(0.04 * e, 0.08 * e, 0.04 * e)); }
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, lh), C.toW(fig, V3(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2)), 1);
    // the sun turns slowly behind his head and flares as the blade lands
    if (J.sun) J.sun.rotation.set(0, 0, T * 0.2);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return atk ? t < LEN : r;
  }

  return {
    cards: ["aurion"], kind: "humanoid", build, pose, scale: 1.42,
    face: { kind: "human", look: { eye: 0xc89a3a, brow: "#a88040", lash: "#3a2412", lip: "#b87a6c", skinD: "#d4a288" } },
    moves: { attack: { clip: "godcleave", hit: HIT, length: LEN, style: "slash", trail: { prop: "spear", from: [0, B0 + 0.16, 0], to: [0, B0 + BL, 0] } } },
  };
})());
