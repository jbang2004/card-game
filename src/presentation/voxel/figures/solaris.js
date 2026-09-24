/* 逐日者·索拉 — Sola the Sun-Chaser (card solaris): a sun knight in white-and-gold plate — long flowing golden hair
 * under a spiked gold crown and, behind her head, a great gold sun halo (a burning ring with long rays: the signature
 * at board scale); a white surcoat and a long white cape lined in deep navy, navy under-sleeves, a gold sun on the
 * breastplate, a white heater shield with a gold sun on the left arm and a radiant arming sword with a gold sun hilt.
 * The attack sweeps the sword up in front and over the head and cuts down, the halo flaring at contact. */
EmberVoxelKit.define("solaris", (() => {
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

  // ------------------------------------------------------------ prop: the sun sword (grip at 0, blade along +Y)
  const B0 = 0.05, BL = 0.36;
  function sunsword() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      steel: { c: 0xeef2fa, rough: 0.3, metal: 0.7, cls: CLS.metal, vary: 0.02 }, steelD: { c: 0x98a4b8, rough: 0.3, metal: 0.9, cls: CLS.metal },
      gold: { c: 0xdcaa44, rough: 0.3, metal: 1, cls: CLS.metal, vary: 0.02 }, grip: { c: 0x4a3222, rough: 0.8, cls: CLS.leather },
    });
    const o = { bone: "p" };
    sc.limb([0, -0.05, 0], [0, 0.03, 0], 0.009, 0.009, { ...o, mat: "grip", k: 0.002 });
    sc.add(S.ell(0.016, 0.02, 0.012), { ...o, mat: "gold", p: [0, -0.064, 0], k: 0.002 });
    // cross-guard: a broad bar sweeping up at the ends, a sun boss in the middle
    for (const s of [1, -1]) sc.limb([0, 0.036, 0], [s * 0.07, 0.05, 0], 0.01, 0.0065, { ...o, mat: "gold", k: 0.003, sz: 0.7 });
    for (const s of [1, -1]) sc.limb([s * 0.066, 0.048, 0], [s * 0.084, 0.07, 0], 0.008, 0.003, { ...o, mat: "gold", k: 0.002, vdil: 0.5 });
    sc.add(S.custom((x, y, z) => Math.max(sun2(x, y, 0.014, 0.03, 8, 0.45), Math.abs(z) - 0.01), [-0.032, -0.032, -0.012, 0.032, 0.032, 0.012]), { ...o, mat: "gold", p: [0, 0.042, 0], k: 0.001 });
    const bw = 0.025;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / BL, 0, 1), w = bw * (u < 0.86 ? 1 - 0.12 * u : (1 - 0.12 * 0.86) * (1 - (u - 0.86) / 0.14)) + 0.0012;
      const dz = Math.abs(z) - (0.0065 * (1 - 0.6 * Math.min(1, Math.abs(x) / w)) + 0.0015);
      return Math.max(Math.abs(x) - w, dz, -y, y - BL);
    }, [-bw - 0.004, 0, -0.01, bw + 0.004, BL, 0.01]);
    sc.add(blade, { ...o, mat: "steel", p: [0, B0, 0], k: 0.001 });
    // gold ricasso at the root, a dark fuller up the middle
    sc.paint(S.custom((x, y, z) => y - B0 - 0.045, [-0.05, B0, -0.02, 0.05, B0 + 0.06, 0.02]), { mat: "gold", soft: 0.0005, only: ["steel"] });
    sc.paint(S.custom((x, y, z) => { const u = (y - B0) / BL; return u < 0.09 || u > 0.75 ? 1 : Math.abs(x) - 0.004; }, [-0.05, B0, -0.02, 0.05, B0 + BL, 0.02]), { mat: "steelD", soft: 0.0005, only: ["steel"] });
    return sc;
  }

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25;
    humanoidBones(sc, P);
    const capeTop = P.shY - 0.004, capeBot = 0.16, capeZ = -0.11;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.01, -0.09); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.05, -0.12);
    const G = [11 * V, 36 * V, 12 * V];
    sc.bone("shield", "chest", ...G);
    const HALO = [0, 0.92, -0.16];
    sc.bone("halo", "chest", ...HALO);
    mats(sc, {
      skin: { c: 0xf2d4c2, rough: 0.55, cls: CLS.skin, vary: 0.013 }, skinDeep: { c: 0xd8ac98, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xc07a70, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xf0dca6, rough: 0.6, cls: CLS.hair, vary: 0.08 },
      mail: { c: 0x2c3c7c, rough: 0.8, cls: CLS.cloth, vary: 0.05 },
      halo: { c: 0xf4c85a, rough: 0.3, emit: 1.1, cls: CLS.glow }, haloL: { c: 0xfff0b8, rough: 0.3, emit: 1.6, cls: CLS.glow },
      plate: { c: 0xdce6f6, rough: 0.28, metal: 0.5, cls: CLS.metal, vary: 0.025 },
      plateD: { c: 0xa8b4cc, rough: 0.32, metal: 0.7, cls: CLS.metal },
      gold: { c: 0xdcaa44, rough: 0.3, metal: 1, cls: CLS.metal, vary: 0.02 },
      cloth: { c: 0xeeeef4, rough: 0.85, cls: CLS.cloth, vary: 0.035 }, clothD: { c: 0x2a3a7a, rough: 0.9, cls: CLS.cloth, vary: 0.05 },
      goldC: { c: 0xd8a848, rough: 0.8, cls: CLS.cloth, vary: 0.04 },
      leather: { c: 0x5a3c26, rough: 0.6, cls: CLS.leather, vary: 0.06 },
      field: { c: 0xe2e8f4, rough: 0.35, metal: 0.3, cls: CLS.metal, vary: 0.02 },
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
    for (let i = 0; i < 6; i++) {
      const u = (i / 5) * 2 - 1;
      const root = [0.012 * u, HC[1] + HR[1] * 0.6, HC[2] + HR[2] * 0.74];
      const mid = [HR[0] * 0.42 * u, ey + 0.045, P.faceZ + 0.004 * q];
      const tip = [HR[0] * 0.66 * u, ey + 0.014 - 0.01 * Math.abs(u), P.faceZ - 0.012 * q * Math.abs(u)];
      strand(sc, [root, mid, tip], 0.012 * q, 0.0018 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
    }
    for (const s of [1, -1]) {
      const root = onEll(HC, HR, s * 1.15, 0.2, 0.98), a = [s * HR[0] * 1.06, ey - 0.03, HC[2] + HR[2] * 0.3], tip = [s * (P.shX * 0.55), P.chest[0] + 0.02, P.chest[3] + 0.02];
      const sp = strand(sc, [root, a, lerp(a, tip, 0.5), tip], 0.016 * q, 0.004 * q, { k: 0.01, wg: 4, wave: 0.005, wd: [s, 0, 0], grooves: 0.0012 });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0], y); return [["head", 1 - t * 0.7], ["chest", t * 0.7]]; };
    }
    for (let i = 0; i < 6; i++) {
      const u = (i / 5) * 2 - 1, az = Math.PI + u * 1.25;
      const root = onEll(HC, HR, az, 0.3, 0.98), out = onEll(HC, HR, az, -0.45, 1.15);
      const tip = [out[0] * 1.2, P.chest[0] - 0.12 - 0.03 * (1 - Math.abs(u)), -0.17 - 0.01 * (1 - Math.abs(u))];
      const mid = lerp(out, tip, 0.4); mid[2] = Math.min(mid[2], -0.14);
      const sp = strand(sc, [root, out, mid, tip], 0.024 - 0.004 * Math.abs(u), 0.005, { wave: 0.007, wd: [Math.cos(az), 0, 0], waves: 2, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.2, bone: "hairB1", grooves: 0.0014 });
      sp.wfn = (x, y) => { const t = sstep(HC[1] - 0.02, P.chest[0] - 0.1, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    sc.part = "body";
    // ---- sun crown: a gold circlet, spikes fanning up round the front, the middle one tallest
    const cy = HC[1] + HR[1] * 0.3, cz = HC[2], crx = HR[0] * 1.02, crz = HR[2] * 1.02;
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / crx, (z - cz) / crz) - 1) * crx - 0.006, Math.abs(y - cy) - 0.008), pad([-crx, cy - 0.02, cz - crz, crx, cy + 0.02, cz + crz])),
      { mat: "gold", bone: "head", k: 0.002 });
    for (const az of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
      const len = 0.075 - 0.035 * Math.abs(az) / 1.2 + (az === 0 ? 0.02 : 0);
      const base = [crx * Math.sin(az), cy + 0.004, cz + crz * Math.cos(az)];
      const dir = norm([Math.sin(az) * 0.35, 1, Math.cos(az) * 0.3]);
      sc.limb(base, add(base, mul(dir, len)), 0.011, 0.0015, { mat: "gold", bone: "head", k: 0.002, vdil: 0.55, sz: 0.6 });
    }

    // ---- the sun halo behind the head, on its own bone: a burning ring, a pale inner rim and 12 long rays
    const Rh = 0.13;
    const rays = (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x), f = Math.abs(((((a / (2 * Math.PI)) * 12) % 1) + 1) % 1 - 0.5) * 2; // 1 on a ray's axis
      const long = Math.floor(((a / (2 * Math.PI)) * 12 + 12.5)) % 2 ? 0.1 : 0.07;
      return Math.max(r - Rh - 0.01 - long * Math.pow(Math.max(0, (f - 0.55) / 0.45), 0.7), Rh - r); };
    sc.add(S.custom((x, y, z) => Math.max(Math.min(Math.abs(Math.hypot(x, y) - Rh) - 0.016, rays(x, y)), Math.abs(z) - 0.005), pad([-Rh - 0.12, -Rh - 0.12, -0.01, Rh + 0.12, Rh + 0.12, 0.01], 0.03)),
      { mat: "halo", p: HALO, bone: "halo", k: 0.001, vdil: 0.4 });
    sc.paint(S.custom((x, y, z) => Math.abs(Math.hypot(x, y) - Rh + 0.008) - 0.0065, pad([-Rh, -Rh, -0.02, Rh, Rh, 0.02])), { mat: "haloL", p: HALO, soft: 0.001, only: ["halo"] });

    // ---- cloth: floor-length surcoat skirt, long cape
    sc.part = "cloth";
    const y0 = P.pelvis[0] + 0.02, y1 = 0.05, h = y0 - y1, r0 = 0.105, r1 = 0.155, szs = 0.82;
    const sk = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.85)), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - 0.008 * u * Math.sin(a * 9 + 0.6);
      // a split up the front from the knees
      const slit = z > 0 ? 0.018 * sstep(0.45, 0.9, u) - Math.abs(x) : -1;
      return Math.max(smax(rr, Math.max(-y - h, y), 0.005), slit);
    }, pad([-r1 - 0.02, -h, -r1 * szs - 0.02, r1 + 0.02, 0, r1 * szs + 0.02], 0.02)), { mat: "cloth", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.45, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => Math.abs(y - y1 - 0.007) - 0.0065, [-1, 0, -1, 1, 0.3, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => (z < 0.03 ? 1 : Math.abs(Math.abs(x) - 0.03) - 0.0065), [-1, -1, -1, 1, 1, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => (z < 0.03 ? 1 : sun2(x, y - 0.24, 0.012, 0.03, 8, 0.5)), [-1, -1, -1, 1, 1, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.085, 0.21, Math.pow(u, 0.75));
      return { u, w, zc: mix(capeZ, capeZ - 0.1, u) - 0.018 * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u) + (0.55 - 0.25 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + 0.012 * (1 + Math.sin(x * 30 + 0.6)) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.3, capeBot, -0.3, 0.3, capeTop, 0.06]), { mat: "cloth", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > -0.04 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.3, capeBot, -0.3, 0.3, capeTop, 0.06]), { mat: "clothD", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => (z > -0.04 ? 1 : y - capeBot - 0.012 * (1 + Math.sin(x * 30 + 0.6)) - 0.014), [-0.3, capeBot, -0.3, 0.3, capeTop, 0.06]), { mat: "goldC", soft: 0.001, only: ["cloth", "clothD"] });
    for (const s of [1, -1]) sc.add(S.cyl(0.005, 0.015, 0.002), { mat: "gold", p: [s * 0.064, capeTop - 0.014, capeZc(s * 0.064, capeTop - 0.014).zc - 0.009], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.001, part: "cloth" });
    sc.part = "body";

    // ---- kite shield on its own bone (local x across, y up, z out of the face): white field, gold rim, gold sun
    const W = 0.13, yT = 0.2, yB = -0.24, H = yT - yB, th = V, zf = 4 * V, bul = 0.02, rimW = 0.016;
    const hw = (y) => W * Math.pow(Math.max(0, 1 - Math.pow(clamp((yT - y) / H, 0, 1), 2.1)), 0.62);
    const outl = (x, y) => Math.max(Math.abs(x) - hw(y), y - (yT + 0.014 * (1 - (x / W) ** 2)), yB - y);
    const zc = (x) => zf - bul * (x / W) ** 2;
    const SB = pad([-W, yB, zf - bul - th, W, yT + 0.02, zf + 2 * th]);
    sc.add(S.custom((x, y, z) => { const o = outl(x, y), rim = o > -rimW ? V / 2 : 0; return Math.max(o, Math.abs(z - zc(x) - rim) - th - rim); }, SB), { mat: "field", p: G, bone: "shield", k: 0.001, vdil: 0.3 });
    const far = (x, y, z) => Math.abs(x) > W + 0.02 || y < yB - 0.02 || y > yT + 0.04 || Math.abs(z - zf) > 0.06;
    sc.paint(S.custom((x, y, z) => { if (far(x, y, z)) return 1; const o = outl(x, y); return Math.max(o, -(o + rimW)); }, SB), { mat: "gold", p: G, soft: 0.001, only: ["field"] });
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(sun2(x, y - 0.0, 0.03, 0.105, 8, 0.5), zc(x) - z, outl(x, y) + rimW)), SB), { mat: "gold", p: G, soft: 0.001, only: ["field"] });
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(z - zc(x), outl(x, y) + rimW)), SB), { mat: "leather", p: G, soft: 0.001, only: ["field"] });
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [{ sc: sunsword(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  // ------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = EmberVesperThree);
  function carryShield(fig, C, tilt, yaw, roll) {
    const T = three(), J = fig.J, o = J.shield;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    const rootQ = fig.root.getWorldQuaternion(new T.Quaternion());
    const chestM = rootQ.clone().invert().multiply(J.chest.getWorldQuaternion(new T.Quaternion()));
    const want = chestM.multiply(new T.Quaternion().setFromEuler(new T.Euler(tilt, yaw, roll)));
    const P = fig.char.P, a = K.armJoints(P, 1);
    const handM = rootQ.clone().invert().multiply(J.handL.getWorldQuaternion(new T.Quaternion()));
    const fist = C.toM(fig, C.wpos(J.handL)).add(C.V3(...a.dir).applyQuaternion(handM).multiplyScalar(0.044 * P.hand));
    o.position.copy(o.parent.worldToLocal(C.toW(fig, fist)));
    o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rootQ.multiply(want)));
  }
  const HIT = 0.44, LEN = 1.25;
  /* the sword swings in the plane of up U and forward F: angle φ from U toward F, the hand on a circle round a
   * centre by the right shoulder, the blade pointing out along the radius. Rest φ ≈ 2.8 (point down before the right
   * foot, as on the card); the attack raises it up in front and over the head (φ → -0.8, 0-0.3), cleaves down
   * (→ 1.6 at contact) and returns. */
  const phiOf = (clip, t) => {
    if (clip === "victory") return 2.8 - 2.8 * sstep(0, 0.3, t) + 2.8 * sstep(1.2, 1.6, t);
    if (clip !== "attack") return 2.8;
    return 2.8 - 3.6 * sstep(0.0, 0.3, t) + 2.45 * sstep(0.32, 0.47, t) + 1.15 * sstep(0.72, 1.15, t);
  };
  function pose(fig, clip, t, T, C) {
    const V3 = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.4), atk = clip === "attack";
    const r = C.base(fig, atk ? "idle" : clip, atk ? 0 : t, T);
    const P = fig.char.P, reach = P.upArm + P.foreArm;
    let hx = 0.03, hy = -0.26, hz = 0.12, yaw = 0.3, tilt = -0.05, roll = 0.02, face = null;
    if (atk) {
      const wind = C.bump(0, 0.28, 0.32, 0.42, t), th = C.bump(0.32, HIT, 0.66, 1.1, t);
      C.addRot(fig, "root", 0, 0.2 * wind - 0.2 * th, 0);
      J.root.position.add(V3(0, 0.01 * wind - 0.05 * th, -0.03 * wind + 0.09 * th));
      C.addRot(fig, "spine", -0.08 * wind + 0.08 * th, 0.1 * wind - 0.08 * th, 0);
      C.addRot(fig, "chest", -0.1 * wind + 0.08 * th, 0.12 * wind - 0.1 * th, 0);
      C.addRot(fig, "head", 0.05 * wind - 0.06 * th, -0.1 * wind, 0);
      C.rot(fig, "thighL", -0.6 * th - 0.1 * wind, 0, -0.05); C.rot(fig, "shinL", 0.45 * th + 0.1 * wind, 0, 0); C.rot(fig, "footL", 0.15 * th, 0, 0);
      C.rot(fig, "thighR", 0.4 * th + 0.08 * wind, 0, 0.05); C.rot(fig, "shinR", 0.3 * th + 0.1 * wind, 0, 0); C.rot(fig, "footR", -0.25 * th, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.15 * th, 0, 0); C.rot(fig, "cape2" + s, 0.12 * th, 0, 0); }
      C.rot(fig, "hairB1", 0.3 * th - 0.1 * wind, 0, 0); C.rot(fig, "hairB2", 0.2 * th, 0, 0);
      // shield swung out to the left, clear of the cleave
      hx += 0.08 * wind + 0.12 * th; hy += 0.06 * wind + 0.04 * th; hz += -0.02 * wind - 0.1 * th; yaw += 0.3 * wind + 0.5 * th;
      face = t > 0.06 && t < 1.0 ? "fierce" : null;
    } else if (clip === "hurt") {
      const e = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hx -= 0.03 * e; hy += 0.08 * e; hz += 0.05 * e; yaw -= 0.2 * e;
    }
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    const phi = phiOf(clip, t);
    const U = V3(-0.22, 1, 0).normalize(), F = V3(0.38, 0, 1).normalize();
    const dir = U.clone().multiplyScalar(Math.cos(phi)).addScaledVector(F, Math.sin(phi)).normalize();
    const mot = U.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(F, Math.cos(phi)).normalize();
    const cen = V3(shR.x * 0.6, shR.y - 0.06, shR.z + 0.1);
    const rad = reach * (0.8 - 0.1 * Math.max(0, Math.cos(phi)));
    const hand = cen.clone().addScaledVector(dir, rad).add(V3(0, 0.003 * br, 0));
    if (clip === "hurt") { const e = Math.exp(-t * 6) * C.sstep(0, 0.05, t); hand.add(V3(-0.02 * e, 0.04 * e, -0.05 * e)); }
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V3(shR.x - 0.3, shR.y - 0.2, shR.z - 0.15)), 1);
    C.aimGrip(fig, "handR", [dir.x, dir.y, dir.z], [-1, 0, 0].map((v, i) => v * 0.2 + [mot.x, mot.y, mot.z][i]), 1);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V3(shL.x + hx, shL.y + hy + 0.004 * br, shL.z + hz)), C.toW(fig, V3(shL.x + 0.35, shL.y - 0.1, shL.z - 0.3)), 1);
    carryShield(fig, C, tilt, yaw, roll);
    // the halo turns slowly, stays upright behind the head and flares as the blade lands
    if (J.halo) J.halo.rotation.set(0, 0, T * 0.25);
    let glow = 0.15 * (0.5 + 0.5 * Math.sin(T * 1.5));
    if (atk) glow += 0.5 * C.bump(0.05, 0.3, 0.4, 0.5, t) + 1.6 * C.bump(HIT - 0.04, HIT, HIT + 0.08, HIT + 0.4, t);
    else if (clip === "victory") glow += 1.2 * C.bump(0, 0.3, 1.2, 1.6, t);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return atk ? t < LEN : r;
  }

  return {
    cards: ["solaris"], kind: "humanoid", build, pose, scale: 1.2,
    face: { kind: "human", look: { eye: 0x9a6a3a, brow: "#b88c48", lash: "#3a2412", lip: "#c47468", skinD: "#dcae98" } },
    moves: { attack: { clip: "sunslash", hit: HIT, length: LEN, style: "slash", trail: { prop: "spear", from: [0, B0 + 0.12, 0], to: [0, B0 + BL, 0] } } },
  };
})());
