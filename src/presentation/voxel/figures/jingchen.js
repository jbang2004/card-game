/* 星焰神·烬辰 — Jingchen, god of star-flame (card jingchen): a towering god with long white hair and golden eyes,
 * black armoured robes edged in gold, spiked gold pauldrons, a gold sun-medallion with a blue star-gem on the breast,
 * a long royal-blue mantle — and behind his head the halo: a gold ring of sun rays. A small sun burns above his open
 * right palm; to attack he lifts both hands, the sun swells over his head into a blazing star, and he hurls it at the
 * target (the effect engine flies the bolt from the sun bone, which pose() carries). */
EmberVoxelKit.define("jingchen", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pad = (b, m = 0.04) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  const star4 = (a, b, d) => S.custom((x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    return Math.max(Math.min(ax / b + ay / a, ax / a + ay / b) * b - b, Math.abs(z) - d);
  }, [-a, -a, -d, a, a, d]);
  const band = (R, w, d, m = 0) => S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - R) - w, Math.abs(z) - d), pad([-R - w, -R - w, -d, R + w, R + w, d], m));

  // ------------------------------------------------------------ prop: the star-flame sun (centre origin)
  function sunProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    const boil = (x, y, z, nx, ny, nz, c) => { const k = 0.82 + 0.3 * vnoise(Math.floor(x / 0.012) * 1.7, Math.floor(y / 0.012) * 1.3, Math.floor(z / 0.012) * 1.9); c[0] *= k; c[1] *= k; c[2] *= k; };
    mats(sc, {
      sun: { c: 0xffa63a, rough: 0.4, emit: 1.7, cls: CLS.glow, pattern: boil }, core: { c: 0xfff0b8, rough: 0.3, emit: 2.2, cls: CLS.glow },
      ring: { c: 0xffd070, rough: 0.3, emit: 1.5, cls: CLS.glow },
    });
    sc.add(S.sphere(0.062), { mat: "sun", bone: "p", k: 0.002 });
    sc.paint(S.custom((x, y, z) => 0.062 - Math.hypot(x - 0.02, y - 0.022, z - 0.03) - 0.028, [-1, -1, -1, 1, 1, 1]), { mat: "core", soft: 0.002 });
    sc.add(band(0.09, 0.004, 0.004), { mat: "ring", bone: "p", r: [1.25, 0, 0.35], k: 0.001, vdil: 0.55 });
    sc.add(band(0.082, 0.0035, 0.0035), { mat: "ring", bone: "p", r: [0.4, 0.9, -0.2], k: 0.001, vdil: 0.55 });
    return sc;
  }

  function hairOf(sc, P) {
    const PX = K.pixel, q = 1.25, ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.004]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.07, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // swept-back crown with a few locks over the brow, parted to the side
    // (pixel: three fat locks, the tips clear of the eyes)
    const NF = PX ? 3 : 4;
    for (let i = 0; i < NF; i++) {
      const u = PX ? [0, 1, 0.5][i] : i / 3, s = PX ? (i === 2 ? 1 : -1) : i < 2 ? -1 : 1;
      const root = [0.01, C[1] + R[1] * 0.72, C[2] + R[2] * 0.58];
      const mid = [s * R[0] * (0.3 + 0.25 * u), ey + 0.058, P.faceZ + 0.004 * q];
      const tip = [s * R[0] * (0.7 + 0.25 * u), PX ? ey + 0.022 - 0.01 * u : ey + 0.0 - 0.02 * u, P.faceZ - 0.018 * q];
      if (PX) strand(sc, [root, mid, tip], 0.02 * q, 0.008 * q, { k: 0.01, taper: 1.2, grooves: 0 });
      else strand(sc, [root, mid, tip], 0.012 * q, 0.002 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
    }
    // locks in front of the shoulders
    for (const s of [1, -1]) {
      const root = onEll(C, R, s * 1.2, 0.2, 0.98);
      const a = [s * R[0] * 1.1, ey - 0.02, C[2] + R[2] * 0.3], b = [s * R[0] * 1.2, P.chinY - 0.04, C[2] + R[2] * 0.3];
      const tip = [s * (P.shX * 0.72), P.chest[0] - 0.06, P.chest[3] + 0.03];
      const sp = PX ? strand(sc, [root, a, b, tip], 0.022 * q, 0.01 * q, { k: 0.012, wg: 4, bone: "head", taper: 1.2, grooves: 0 })
        : strand(sc, [root, a, b, tip], 0.013 * q, 0.003 * q, { wave: 0.006, wd: [s, 0, 0.3], waves: 2, phase: s, k: 0.01, wg: 4, bone: "head" });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0] - 0.04, y); return [["head", 1 - t * 0.7], ["chest", t * 0.7]]; };
    }
    // the long fall down the back to the waist
    const N = PX ? 5 : 8;   // pixel: five broad locks
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1, az = Math.PI + u * (PX ? 1.3 : 1.55), el = 0.35 - 0.25 * Math.abs(u);
      const root = onEll(C, R, az, el, 0.98), out = onEll(C, R, az, -0.4, 1.2);
      const len = 0.38 + 0.05 * (1 - Math.abs(u)) + 0.02 * Math.sin(i * 2.3);
      const tip = [out[0] * 1.3 + u * 0.03, P.neck[0] - len, -P.chest[3] - 0.08];
      const mid = lerp(out, tip, 0.35); mid[2] = Math.min(mid[2], -P.chest[3] - 0.06);
      const sp = PX ? strand(sc, [root, out, mid, tip], (0.034 - 0.006 * Math.abs(u)) * q, 0.013 * q, { k: 0.014, wg: 5, bone: "hairB1", taper: 1.2, grooves: 0 })
        : strand(sc, [root, out, mid, tip], (0.02 - 0.004 * Math.abs(u)) * q, 0.004 * q, { wave: 0.007, wd: [Math.cos(az), 0, 0], waves: 2, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.2, bone: "hairB1", grooves: 0.0012 });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.01, P.neck[0] - 0.36, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    return { C, R };
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25, PX = K.pixel;   // PX: pixel-sprite variant
    humanoidBones(sc, P);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -P.cran[2] * 0.9); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.05, -P.cran[2] * 1.1);
    const HC = [0, P.cranC[1] - 0.005, -0.13];                 // halo centre, behind the head
    sc.bone("halo", "head", ...HC);
    const SUN0 = [-0.08, 0.72, 0.3];                             // the sun rides its own bone (pose() places it)
    sc.bone("sun", "chest", ...SUN0);
    const capeTop = P.shY + 0.004, capeBot = 0.02, capeZ = -P.chest[3] - 0.045;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    mats(sc, PX ? {
      // flat, clearly stepped: white hair, dark robe, royal blue, one bright gold and a darker gold
      skin: { c: 0xecdcd8, rough: 0.55, cls: CLS.skin }, skinDeep: { c: 0xd0b4ae, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb07c72, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xe2e8f6, rough: 0.6, cls: CLS.hair },
      robe: { c: 0x2e2c44, rough: 0.75, cls: CLS.cloth }, robeD: { c: 0x1c1a26, rough: 0.8, cls: CLS.cloth },
      blue: { c: 0x3050b8, rough: 0.8, cls: CLS.cloth }, cape: { c: 0x3050b8, rough: 0.8, cls: CLS.cloth }, lining: { c: 0x1e2860, rough: 0.85, cls: CLS.cloth },
      gold: { c: 0xf0c258, rough: 0.4, metal: 0.3, cls: CLS.metal }, goldD: { c: 0xa87a30, rough: 0.45, metal: 0.3, cls: CLS.metal },
      glove: { c: 0x24222e, rough: 0.5, cls: CLS.leather },
      gem: { c: 0x60b8ff, rough: 0.2, emit: 1.4, cls: CLS.glow },
      haloG: { c: 0xffc040, rough: 0.3, emit: 1.0, cls: CLS.glow }, flame: { c: 0xff8a28, rough: 0.3, emit: 1.1, cls: CLS.glow },
    } : {
      skin: { c: 0xecdcd8, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd0b4ae, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb07c72, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xd4dcf2, rough: 0.5, cls: CLS.hair, vary: 0.07 },
      robe: { c: 0x363450, rough: 0.75, cls: CLS.cloth, vary: 0.05 }, robeD: { c: 0x1c1a26, rough: 0.8, cls: CLS.cloth },
      blue: { c: 0x3050b8, rough: 0.8, cls: CLS.cloth, vary: 0.05 }, cape: { c: 0x3050b8, rough: 0.8, cls: CLS.cloth, vary: 0.05 }, lining: { c: 0x1e2860, rough: 0.85, cls: CLS.cloth },
      gold: { c: 0xe0b458, rough: 0.28, metal: 1, cls: CLS.metal, vary: 0.03 }, goldD: { c: 0x9a7432, rough: 0.35, metal: 1, cls: CLS.metal },
      glove: { c: 0x24222e, rough: 0.5, cls: CLS.leather },
      gem: { c: 0x60b8ff, rough: 0.2, emit: 1.4, cls: CLS.glow },
      haloG: { c: 0xffc860, rough: 0.3, emit: 1.0, cls: CLS.glow }, flame: { c: 0xffa040, rough: 0.3, emit: 1.3, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.97;
    // ---- armoured robe: black torso and sleeves, gold chevrons down the front, sun medallion with a blue gem
    const arms = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.4)), lerp(a.E, a.W, 0.75), 0.09); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.waist[0] - 0.03, P.neck[0] + 0.03), ...arms), "robe", 0.007 * q);
    sc.paint(S.custom((x, y, z) => (z > 0.03 ? Math.abs(Math.abs(x) - 0.03 - 0.6 * (P.chest[0] + 0.06 - y)) - 0.0065 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["robe"] });
    const MC = [0, P.chest[0] + 0.005, P.chest[3] + 0.035];
    sc.add(band(0.034, 0.007, 0.006), { mat: "gold", p: MC, bone: "chest", k: 0.001, vdil: 0.5 });
    sc.add(star4(0.05, 0.009, 0.004), { mat: "gold", p: add(MC, [0, 0, -0.002]), r: [0, 0, Math.PI / 4], bone: "chest", k: 0.001, vdil: 0.5 });
    sc.add(S.sphere(0.017), { mat: "gem", p: add(MC, [0, 0, 0.004]), bone: "chest", k: 0.001 });
    // high collar, gold rim
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, z / 0.95) - 0.045) - 0.006, Math.abs(y - (P.neck[0] + 0.03)) - 0.024), pad([-0.06, P.neck[0], -0.06, 0.06, P.neck[0] + 0.06, 0.06])),
      { mat: "gold", bone: "chest", bones: [["chest", 0.6], ["neck", 0.4]], k: 0.002 });
    // belt and an eight-pointed gold star buckle
    wrap(sc, RG.box(-0.25, 0.25, P.waist[0] - 0.024, P.waist[0] - 0.002), "goldD", 0.01 * q);
    sc.add(star4(0.04, 0.008, 0.005), { mat: "gold", p: [0, P.waist[0] - 0.013, P.waist[2] + 0.05], bone: "spine", k: 0.001, vdil: 0.5 });
    sc.add(star4(0.026, 0.006, 0.005), { mat: "gold", p: [0, P.waist[0] - 0.013, P.waist[2] + 0.052], r: [0, 0, Math.PI / 4], bone: "spine", k: 0.001, vdil: 0.5 });
    // ---- spiked gold pauldrons, gold-cuffed gauntlets
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      const pc = [s * 0.155, P.shY + 0.004, -0.008];
      sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x / 0.07, y / 0.058, z / 0.078) - 1, -0.028 - y), [-0.07, -0.03, -0.08, 0.07, 0.06, 0.08]), { mat: "gold", p: pc, bone: "chest", k: 0.003 });
      sc.paint(S.custom((x, y, z) => Math.abs(y - pc[1] + 0.018) - 0.006, [-1, -1, -1, 1, 1, 1]), { mat: "goldD", soft: 0.001, only: ["gold"] });
      for (const [dx, dz, len] of [[0.02, 0.02, 0.07], [0.035, -0.03, 0.055]]) sc.limb(add(pc, [s * dx, 0.03, dz]), add(pc, [s * (dx + 0.045), 0.03 + len, dz * 1.5]), PX ? 0.016 : 0.013, PX ? 0.006 : 0.0015, { mat: "gold", bone: "chest", k: 0.002, vdil: 0.55 });
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.07 * P.hand), "glove", 0.004 * q);
      sc.limb(lerp(a.E, a.W, 0.62), add(a.W, mul(a.dir, 0.006)), 0.04, 0.047, { mat: "gold", bone: "fore" + n, k: 0.002 });
      sc.paint(S.custom((x, y, z) => { const p = sub([x, y, z], a.W), t = dot(p, a.dir); return Math.abs(t + 0.04) - 0.006; }, [-1, -1, -1, 1, 1, 1]), { mat: "goldD", soft: 0.001, only: ["gold"] });
    }
    // ---- cloth: black robe skirt to the floor with blue panels and gold edging; the long blue mantle
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, h = y0 - 0.005, r0 = P.pelvis[1] * 1.15, r1 = 0.19, szs = 0.82;
    const sk = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.8)), a = Math.atan2(z / szs, x);
      return Math.max(Math.hypot(x, z / szs) - r - (PX ? 0 : 0.005 * u * Math.sin(a * 6 + 0.6)), y, -y - h);
    }, pad([-r1 - 0.02, -h, -r1 * szs - 0.02, r1 + 0.02, 0, r1 * szs + 0.02], 0.02)), { mat: "robe", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.6, sl = sstep(-0.04, 0.04, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    const panel = (y) => 0.022 + 0.05 * clamp((y0 - y) / h, 0, 1);
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(Math.abs(x) - panel(y) - 0.03) - 0.022 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => (z > 0.02 && y < y0 - 0.01 ? Math.abs(Math.abs(x) - panel(y) - 0.004) - 0.005 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["robe", "blue"] });
    sc.paint(S.custom((x, y, z) => (PX ? Math.abs(y - 0.02) - 0.011 : Math.abs(y - 0.015) - 0.0065), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["robe", "blue"] });
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.15, 0.27, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.09, u) - (PX ? 0 : 0.012 * Math.sin((x / w) * 4 * 1.57 + 0.5) * (0.25 + u)) + (0.8 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return Math.max(Math.abs(z - c.zc) - (PX ? 0.009 : 0.005), Math.abs(x) - c.w, y - capeTop, capeBot - y); };
    const capeB = [-0.34, capeBot, -0.32, 0.34, capeTop, 0.12];
    const cp = sc.add(S.custom(capeF, capeB), { mat: "cape", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), capeB), { mat: "lining", soft: 0.001, only: ["cape"] });
    if (!PX) sc.paint(S.custom((x, y, z) => y - capeBot - 0.014, capeB), { mat: "gold", soft: 0.001, only: ["cape", "lining"] });
    sc.part = "body";

    // ---- hair, and a thin gold circlet
    sc.part = "hair";
    const { C, R } = hairOf(sc, P);
    sc.part = "body";
    const cy = C[1] + R[1] * 0.36, cz = C[2] + 0.004, crx = R[0] * 1.03, crz = R[2] * 1.03;
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / crx, (z - cz) / crz) - 1) * crx - 0.005, Math.abs(y - cy) - 0.006), pad([-crx, cy - 0.02, cz - crz, crx, cy + 0.02, cz + crz])), { mat: "gold", bone: "head", k: 0.002 });
    sc.add(star4(0.022, 0.006, 0.004), { mat: "gold", p: [0, cy + 0.012, cz + crz + 0.004], bone: "head", k: 0.001, vdil: 0.5 });
    // ---- the halo: a gold ring of sun rays behind the head (long and short rays, flame-tipped)
    const Rh = 0.125;
    if (PX) {
      // pixel: one thick gold ring and eight fat rays, long gold and short flame, alternating
      sc.add(band(Rh, 0.014, 0.012, 0.05), { mat: "haloG", p: HC, bone: "halo", k: 0.001 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 2, long = i % 2 === 0, len = long ? 0.085 : 0.05;
        const d = [Math.cos(a), Math.sin(a), 0], base = add(HC, mul(d, Rh + 0.008)), tip = add(HC, mul(d, Rh + len));
        sc.limb(base, tip, long ? 0.024 : 0.02, 0.008, { mat: long ? "haloG" : "flame", bone: "halo", k: 0.002, sz: 0.55 });
      }
    } else {
    sc.add(band(Rh, 0.008, 0.006, 0.05), { mat: "haloG", p: HC, bone: "halo", k: 0.001, vdil: 0.4 });
    sc.add(band(Rh - 0.03, 0.004, 0.004, 0.05), { mat: "haloG", p: HC, bone: "halo", k: 0.001, vdil: 0.5 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 2, long = i % 2 === 0, len = long ? 0.075 : 0.04;
      const d = [Math.cos(a), Math.sin(a), 0], base = add(HC, mul(d, Rh + 0.004)), tip = add(HC, mul(d, Rh + len));
      sc.limb(base, tip, long ? 0.011 : 0.008, 0.0015, { mat: long ? "haloG" : "flame", bone: "halo", k: 0.001, vdil: 0.55, sz: 0.55 });
    }
    }
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.03);
    return { sc, P, kind: "humanoid", props: [{ sc: sunProp(), bone: "sun", at: SUN0 }] };
  }

  // ------------------------------------------------------------------ motion
  const HIT = 0.52, LEN = 1.35;
  function placeSun(fig, C, m, s, T) {
    const o = fig.J.sun;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    o.position.copy(o.parent.worldToLocal(C.toW(fig, m)));
    o.rotation.set(0.3, T * 1.2, 0.2);
    o.scale.setScalar(Math.max(0.001, s * (1 + 0.05 * Math.sin(T * 8))));
    o.updateMatrixWorld(true);
  }
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 4);
    C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    J.root.position.y += 0.006 * br;
    fig.root.updateMatrixWorld(true);
    const P = fig.char.P, shL = C.toM(fig, C.wpos(J.armL)), shR = C.toM(fig, C.wpos(J.armR));
    // rest: the right palm held up before him with a small sun burning over it; the left hand low at his side
    const restR = V(shR.x + 0.02, shR.y - 0.13 + 0.004 * br, shR.z + 0.2), restL = V(shL.x + 0.03, shL.y - 0.27, shL.z + 0.06);
    let hR = restR, hL = restL, kR = 1, kL = 1;
    let poleR = V(shR.x - 0.3, shR.y - 0.3, shR.z - 0.1), poleL = V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2);
    let sunM = restR.clone().add(V(0, 0.1, 0.02)), sunS = 0.42, glow = 0.15 * (0.5 + 0.5 * Math.sin(T * 1.5)), face = null;
    if (clip === "attack") {
      // raise both hands, the sun swells above his head (0-0.38) → hurl it forward, release at HIT → hold → lower
      const g = C.bump(0.02, 0.34, 0.38, HIT, t), th = C.bump(0.38, HIT - 0.02, 0.8, 1.25, t);
      C.addRot(fig, "root", 0, 0.1 * g - 0.12 * th, 0);
      J.root.position.add(V(0, 0.01 * g - 0.01 * th, -0.02 * g + 0.05 * th));
      C.addRot(fig, "spine", -0.1 * g + 0.1 * th, 0, 0);
      C.addRot(fig, "chest", -0.12 * g + 0.12 * th, 0.05 * g - 0.08 * th, 0);
      C.addRot(fig, "head", -0.28 * g + 0.1 * th, 0, 0);
      C.rot(fig, "thighL", -0.25 * th, 0, -0.04); C.rot(fig, "shinL", 0.15 * th, 0, 0);
      fig.root.updateMatrixWorld(true);
      const sR = C.toM(fig, C.wpos(J.armR)), sL = C.toM(fig, C.wpos(J.armL)), hd = C.toM(fig, C.wpos(J.head));
      const len = (P.upArm + P.foreArm) * 0.95;
      const over = V(hd.x, hd.y + 0.3, hd.z + 0.04);
      const upR = V(sR.x + 0.05, sR.y + len * 0.85, sR.z + 0.06), upL = V(sL.x - 0.05, sL.y + len * 0.85, sL.z + 0.06);
      const outR = V(sR.x + 0.07, sR.y + 0.06, sR.z + len), outL = V(sL.x - 0.07, sL.y + 0.06, sL.z + len);
      const e1 = C.sstep(0.02, 0.32, t), e2 = C.sstep(0.38, HIT - 0.02, t), e3 = C.sstep(0.82, 1.25, t);
      hR = restR.clone().lerp(upR, e1).lerp(outR, e2).lerp(restR, e3);
      hL = restL.clone().lerp(upL, e1).lerp(outL, e2).lerp(restL, e3);
      poleR = V(sR.x - 0.35, sR.y - 0.1, sR.z - 0.15); poleL = V(sL.x + 0.35, sL.y - 0.1, sL.z - 0.15);
      const front = V(hd.x, sR.y + 0.08, sR.z + len + 0.1);
      sunM = sunM.clone().lerp(over, e1).lerp(front, e2);
      sunS = mix(0.42, 1.25, e1) * (1 - C.sstep(HIT, HIT + 0.04, t)) + 0.42 * C.sstep(0.95, 1.3, t);
      if (t > HIT + 0.04 && t < 0.95) sunS = 0;
      if (t >= 0.95) sunM = restR.clone().add(V(0, 0.1, 0.02));
      glow += 1.0 * C.sstep(0.05, 0.36, t) * (1 - C.sstep(HIT + 0.05, 0.9, t)) + 1.6 * C.bump(HIT - 0.03, HIT, HIT + 0.06, HIT + 0.3, t);
      face = t > 0.05 && t < HIT - 0.02 ? "focus" : t < 0.9 ? "fierce" : null;
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.12 * th, 0, 0); C.rot(fig, "cape2" + s, 0.1 * th, 0, 0); }
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hR = restR.clone().add(V(0.03 * k, 0.06 * k, -0.08 * k)); sunM = hR.clone().add(V(0, 0.1, 0.02));
      glow *= 1 - 0.7 * k;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      fig.root.updateMatrixWorld(true);
      const hd = C.toM(fig, C.wpos(J.head));
      kR = 0;
      hL = restL.clone().lerp(V(shL.x - 0.02, shL.y + 0.22, shL.z + 0.08), up);
      sunM = sunM.clone().lerp(V(hd.x, hd.y + 0.3, hd.z + 0.04), up); sunS = mix(0.42, 1.1, up);
      glow += 1.2 * up; face = up > 0.3 ? "open" : null;
    }
    fig.root.updateMatrixWorld(true);
    if (kL > 0) C.ik(fig, "armL", "foreL", "handL", C.toW(fig, hL), C.toW(fig, poleL), kL);
    if (kR > 0) C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hR), C.toW(fig, poleR), kR);
    if (clip === "victory") { fig.root.updateMatrixWorld(true); }
    placeSun(fig, C, sunM, sunS, T);
    // the halo turns slowly behind his head
    if (J.halo) J.halo.rotation.set(0, 0, T * 0.2);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return clip === "attack" ? t < LEN : clip === "idle" ? true : t < (clip === "hurt" ? 0.6 : 1.6);
  }

  return {
    cards: ["jingchen"], kind: "humanoid", build, pose, scale: 1.4,
    face: { kind: "human", look: { eye: 0xe8a838, brow: "#c8ccdc", lash: "#221c24", lip: "#b07c72", skinD: "#d0b4ae" } },
    moves: { attack: { clip: "sunfall", hit: HIT, length: LEN, style: "bolt", fire: true, ranged: true, windup: 340, emitter: { bone: "sun", offset: [0, 0, 0] } } },
  };
})());
