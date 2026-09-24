/* 白霜之王 — the White Frost King (card frostking): a tall armoured king with swept silver hair and a silver crown of
 * upright ice spikes, a great white fur mantle over the shoulders, a white coat with a royal-blue front and a silver
 * breastplate set with an ice star, a floor-length white robe split at the front over silver greaves, a blue cape and
 * black gauntlets — and an ice greatsword, a long pale-blue crystal blade under a silver star crossguard (the
 * signature at board scale). At rest he stands with the sword point-down at his side, a hand on the pommel; the attack
 * is a two-handed overhead cleave from over the right shoulder down across the target. */
EmberVoxelKit.define("frostking", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const pad = (b, m = 0.04) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  const star4 = (a, b, d) => S.custom((x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    return Math.max(Math.min(ax / b + ay / a, ax / a + ay / b) * b - b, Math.abs(z) - d);
  }, [-a, -a, -d, a, a, d]);

  // ------------------------------------------------------------ prop: the ice greatsword (grip at 0, blade along +Y, flat in XY)
  const B0 = 0.075, BL = 0.56, BW = 0.034;
  function sword() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      grip: { c: 0x243052, rough: 0.8, cls: CLS.leather }, silver: { c: 0xc6d2ea, rough: 0.22, metal: 1, cls: CLS.metal, vary: 0.03 },
      silverD: { c: 0x7684a4, rough: 0.35, metal: 1, cls: CLS.metal },
      ice: { c: 0x9fd0ff, rough: 0.15, emit: 0.35, cls: CLS.glow, vary: 0.05 }, iceD: { c: 0x5d95e0, rough: 0.2, emit: 0.3, cls: CLS.glow },
      iceL: { c: 0xe4f4ff, rough: 0.15, emit: 0.9, cls: CLS.glow }, gem: { c: 0x6ab8ff, rough: 0.2, emit: 1.4, cls: CLS.glow },
    });
    const o = { bone: "p" };
    sc.limb([0, -0.075, 0], [0, 0.035, 0], 0.0115, 0.0115, { ...o, mat: "grip", k: 0.002 });
    sc.add(S.sphere(0.017), { ...o, mat: "silver", p: [0, -0.09, 0], k: 0.002 });
    sc.add(star4(0.028, 0.007, 0.004), { ...o, mat: "silver", p: [0, -0.1, 0], k: 0.001, vdil: 0.5 });
    // crossguard: a wide silver bar with ice-spike tips and a star on the hub
    sc.add(S.box(0.075, 0.011, 0.012, 0.004), { ...o, mat: "silver", p: [0, 0.048, 0], k: 0.002 });
    for (const s of [1, -1]) sc.limb([s * 0.07, 0.048, 0], [s * 0.1, 0.075, 0], 0.011, 0.002, { ...o, mat: "ice", k: 0.002, vdil: 0.5 });
    sc.add(star4(0.04, 0.01, 0.007), { ...o, mat: "silver", p: [0, 0.05, 0], k: 0.001, vdil: 0.5 });
    sc.add(S.sphere(0.01), { ...o, mat: "gem", p: [0, 0.05, 0.008], k: 0.001 });
    // blade: long, slightly waisted, faceted — pale edges, darker midrib, a sharp tip
    const blade = S.custom((x, y, z) => {
      const u = clamp((y - B0) / BL, 0, 1), w = BW * (1 - 0.12 * Math.sin(u * Math.PI)) * (u > 0.86 ? (1 - u) / 0.14 : 1) + 0.002;
      const dz = Math.abs(z) - (0.009 * (1 - Math.abs(x) / (w + 1e-4)) + 0.002);
      return Math.max(Math.abs(x) - w, dz, B0 - y, y - B0 - BL);
    }, pad([-BW, B0, -0.012, BW, B0 + BL, 0.012], 0.02));
    sc.add(blade, { ...o, mat: "ice", k: 0.001, vdil: 0.3 });
    sc.paint(S.custom((x, y, z) => Math.abs(x) - 0.006, [-1, -1, -1, 1, 1, 1]), { mat: "iceD", soft: 0.001, only: ["ice"] });
    sc.paint(S.custom((x, y, z) => { const u = clamp((y - B0) / BL, 0, 1), w = BW * (1 - 0.12 * Math.sin(u * Math.PI)) * (u > 0.86 ? (1 - u) / 0.14 : 1); return y < B0 + 0.01 ? 1 : w - 0.009 - Math.abs(x); }, [-1, -1, -1, 1, 1, 1]), { mat: "iceL", soft: 0.001, only: ["ice"] });
    return sc;
  }

  function hairOf(sc, P) {
    const q = 1.25, ey = P.eyeY, C = add(P.cranC, [0, 0.006, -0.006]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.07, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.74, cr[2] * 0.7), 0, -cr[1] * 0.5, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // swept fringe: locks parting off-centre and falling past the brow to the cheeks
    for (let i = 0; i < 6; i++) {
      const u = i / 5, s = u < 0.4 ? -1 : 1, v = Math.abs(u - 0.35);
      const root = [0.012, C[1] + R[1] * 0.7, C[2] + R[2] * 0.6];
      const mid = [s * R[0] * (0.2 + 0.6 * v), ey + 0.06, P.faceZ + 0.006 * q];
      const tip = [s * R[0] * (0.45 + 0.7 * v), ey - 0.01 - 0.03 * v, P.faceZ - 0.014 * q - 0.02 * v];
      strand(sc, [root, mid, tip], 0.013 * q, 0.002 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
    }
    // side locks over the ears to the jaw
    for (const s of [1, -1]) strand(sc, [onEll(C, R, s * 1.1, 0.3, 0.98), [s * R[0] * 1.08, ey - 0.02, C[2] + R[2] * 0.3], [s * R[0] * 1.0, P.chinY - 0.01, C[2] + R[2] * 0.35]], 0.014 * q, 0.003 * q, { k: 0.008, taper: 1.2 });
    // the back: swept locks to the nape and upper back, lifting a little in the wind
    const N = 5;
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1, az = Math.PI + u * 1.5;
      const root = onEll(C, R, az, 0.35, 0.98), out = onEll(C, R, az, -0.35, 1.15);
      const tip = [out[0] * 1.2, P.neck[0] - 0.12 - 0.03 * (1 - Math.abs(u)), -P.chest[3] - 0.06];
      const sp = strand(sc, [root, out, tip], (0.02 - 0.004 * Math.abs(u)) * q, 0.004 * q, { wave: 0.006, wd: [Math.cos(az), 0, 0], phase: i, k: 0.012, wg: 5, bone: "hairB1", grooves: 0.0012 });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.02, P.neck[0] - 0.1, y); return [["head", 1 - t], ["hairB1", t]]; };
    }
    return { C, R };
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25;
    humanoidBones(sc, P);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -P.cran[2] * 0.9);
    const capeTop = P.shY + 0.004, capeBot = 0.06, capeZ = -P.chest[3] - 0.045;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    const furry = (x, y, z, nx, ny, nz, c) => { const k = 1 + 0.08 * vnoise(Math.floor(x / 0.02), Math.floor(y / 0.02), Math.floor(z / 0.02)) - (ny < -0.3 ? 0.12 : 0); c[0] *= k; c[1] *= k; c[2] *= k; };
    mats(sc, {
      skin: { c: 0xe6dce8, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd0b4b4, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb88480, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xbcc8ea, rough: 0.5, cls: CLS.hair, vary: 0.07 },
      white: { c: 0xbccdf2, rough: 0.85, cls: CLS.cloth, vary: 0.035 }, whiteD: { c: 0xa6b4d2, rough: 0.9, cls: CLS.cloth },
      blue: { c: 0x2f56b8, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, cape: { c: 0x2f56b8, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, lining: { c: 0xb4c6ee, rough: 0.9, cls: CLS.cloth, vary: 0.03 },
      fur: { c: 0xd2e0ff, rough: 0.95, cls: CLS.fur, vary: 0.05, fur: 0.8, pattern: furry },
      plate: { c: 0xaebcd8, rough: 0.28, metal: 0.7, cls: CLS.metal, vary: 0.03 }, plateD: { c: 0x66748e, rough: 0.35, metal: 1, cls: CLS.metal },
      glove: { c: 0x262a36, rough: 0.5, cls: CLS.leather },
      leather: { c: 0x46557e, rough: 0.6, cls: CLS.leather },
      ice: { c: 0x8cc4ff, rough: 0.2, emit: 0.8, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.97;
    // ---- coat: white torso and sleeves, blue front, silver breastplate with an ice star, belt
    const armRg = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.4)), lerp(a.E, a.W, 0.7), 0.09); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.04, P.neck[0] + 0.03), ...armRg), "white", 0.007 * q);
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(x) - 0.04 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.001, only: ["white"] });
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x / 0.112, (y) / 0.075, (z + 0.012) / 0.098) - 1, 0.004 - y), pad([-0.12, -0.08, -0.12, 0.12, 0.08, 0.1])), { mat: "plate", p: [0, P.chest[0] - 0.035, 0], bone: "chest", k: 0.003 });
    sc.add(star4(0.036, 0.009, 0.005), { mat: "plate", p: [0, P.chest[0] + 0.0, P.chest[3] + 0.034], bone: "chest", k: 0.001, vdil: 0.5 });
    sc.add(S.sphere(0.011), { mat: "ice", p: [0, P.chest[0], P.chest[3] + 0.04], bone: "chest", k: 0.001 });
    wrap(sc, RG.box(-0.25, 0.25, P.waist[0] - 0.024, P.waist[0] - 0.002), "leather", 0.01 * q);
    sc.add(S.box(0.018, 0.014, 0.005, 0.002), { mat: "plate", p: [0, P.waist[0] - 0.013, P.waist[2] + 0.046], bone: "spine", k: 0.001 });
    // ---- arms and legs: silver vambraces, black gauntlets, dark breeches, silver greaves and sabatons
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s), side = s > 0 ? [0, 0.2] : [-0.2, 0];
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.55), lerp(a.E, a.W, 0.97), 0.08), "plate", 0.008 * q);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.07 * P.hand), "glove", 0.004 * q);
      sc.limb(lerp(a.E, a.W, 0.86), add(a.W, mul(a.dir, 0.008)), 0.042, 0.047, { mat: "plateD", bone: "fore" + n, k: 0.002 });
      wrap(sc, RG.box(...side, l.K[1] - 0.02, P.hipY + 0.03), "leather", 0.006);
      wrap(sc, RG.box(...side, P.ankY + 0.02, l.K[1] - 0.01), "plate", 0.009);
      wrap(sc, RG.box(...side, -0.03, P.ankY + 0.02), "plateD", 0.007);
      sc.add(S.ell(0.04, 0.036, 0.026), { mat: "plate", p: add(l.K, [0, 0.004, 0.038]), bone: "shin" + n, k: 0.003 });
      sc.add(star4(0.026, 0.007, 0.004), { mat: "ice", p: add(l.K, [0, 0.004, 0.066]), bone: "shin" + n, k: 0.001, vdil: 0.5 });
    }
    // ---- cloth: the white robe split at the front, blue lining showing along the split, silver hem; blue cape
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, h = y0 - 0.01, r0 = P.pelvis[1] * 1.15, r1 = 0.18, szs = 0.8;
    const slit = (u) => 0.012 + 0.085 * Math.pow(u, 0.9);
    const sk = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.8)), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - 0.004 * u * Math.sin(a * 6 + 0.6);
      return Math.max(rr, y, -y - h, z > 0 ? slit(u) - Math.abs(x) : -1);
    }, pad([-r1 - 0.02, -h, -r1 * szs - 0.02, r1 + 0.02, 0, r1 * szs + 0.02], 0.02)), { mat: "white", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.75, sl = sstep(-0.04, 0.04, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => { const u = clamp((y0 - y) / h, 0, 1); return z > 0.03 && y < y0 - 0.01 ? Math.abs(x) - slit(u) - 0.024 : 1; }, [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.001, only: ["white"] });
    sc.paint(S.custom((x, y, z) => { const u = clamp((y0 - y) / h, 0, 1); return z > 0.03 && y < y0 - 0.01 ? Math.abs(Math.abs(x) - slit(u) - 0.03) - 0.006 : 1; }, [-1, -1, -1, 1, 1, 1]), { mat: "plate", soft: 0.001, only: ["white", "blue"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - 0.016) - 0.0065, [-1, -1, -1, 1, 1, 1]), { mat: "plate", soft: 0.001, only: ["white", "blue"] });
    // cape: from the shoulders to the floor, wide, blue outside, white lining
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.13, 0.24, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.09, u) - 0.012 * Math.sin((x / w) * 4 * 1.57 + 0.5) * (0.25 + u) + (0.8 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return Math.max(Math.abs(z - c.zc) - 0.005, Math.abs(x) - c.w, y - capeTop, capeBot - y); };
    const cp = sc.add(S.custom(capeF, [-0.34, capeBot, -0.32, 0.34, capeTop, 0.12]), { mat: "cape", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    // the lining faces forward; only the cape's own voxels take it (the robe is a different material)
    const capeB = [-0.34, capeBot, -0.32, 0.34, capeTop, 0.12];
    sc.paint(S.custom((x, y, z) => (y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), capeB), { mat: "lining", soft: 0.001, only: ["cape"] });
    sc.paint(S.custom((x, y, z) => (z > capeZ + 0.02 ? 1 : y - capeBot - 0.014), capeB), { mat: "plate", soft: 0.001, only: ["cape", "lining"] });
    // fur mantle: a thick shaggy collar over the shoulders, falling in a short bell
    const my0 = P.neck[0] + 0.035, myH = 0.12, mr0 = P.neck[2] * 2.1, mr1 = P.shX + P.delt * 1.7, msz = 0.85;
    const shag = (x, y, z) => 0.005 * Math.pow(Math.abs(vnoise(x * 60, y * 30, z * 60)), 0.5);
    sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / myH, 0, 1), r = mix(mr0, mr1, Math.pow(u, 0.5));
      const rr = Math.hypot(x, z / msz) - r;
      return Math.max(Math.abs(rr) - 0.011 - 0.006 * (1 - u), -y - myH + 0.02 * Math.abs(Math.sin(Math.atan2(z, x) * 7)), y - 0.01);
    }, pad([-mr1 - 0.03, -myH - 0.02, -mr1 * msz - 0.03, mr1 + 0.03, 0.03, mr1 * msz + 0.03], 0.02)), { mat: "fur", p: [0, my0, -0.012], bone: "chest", k: 0.006, cs: 0.03, disp: shag, dispAmp: 0.005, bones: [["chest", 1]] });
    sc.part = "body";

    // ---- hair and the ice crown
    sc.part = "hair";
    const { C, R } = hairOf(sc, P);
    sc.part = "body";
    const cy = C[1] + R[1] * 0.4, cz = C[2] + 0.004, crx = R[0] * 1.04, crz = R[2] * 1.04;
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / crx, (z - cz) / crz) - 1) * crx - 0.006, Math.abs(y - cy) - 0.009), pad([-crx, cy - 0.02, cz - crz, crx, cy + 0.02, cz + crz])), { mat: "plate", bone: "head", k: 0.002 });
    for (let i = -4; i <= 4; i++) {
      const az = i * 0.36, front = Math.cos(az);
      const len = 0.02 + 0.04 * front * front + (i === 0 ? 0.04 : 0);
      const base = [crx * Math.sin(az), cy + 0.006, cz + crz * Math.cos(az)];
      sc.limb(base, add(base, [Math.sin(az) * 0.012, len, Math.cos(az) * 0.006]), i === 0 ? 0.014 : 0.01, 0.0015, { mat: i % 2 ? "plate" : "ice", bone: "head", k: 0.002, vdil: 0.6, sz: 0.65 });
    }
    sc.add(S.sphere(0.009), { mat: "ice", p: [0, cy, cz + crz + 0.004], bone: "head", k: 0.001 });
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.03);
    return { sc, P, kind: "humanoid", props: [{ sc: sword(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  // ------------------------------------------------------------ motion
  const HIT = 0.46, LEN = 1.3;
  /* swing angle φ in the plane of up U and forward F: blade = cos φ·U + sin φ·F; the blade's flat faces the plane normal
   * so the edge leads. Wind-up raises it back over the right shoulder, the cleave carries it down through the front. */
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.6);
    C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    let wind = 0, th = 0, glow = 0.1 * (0.5 + 0.5 * Math.sin(T * 1.7));
    if (clip === "attack") {
      wind = C.bump(0, 0.3, 0.34, 0.44, t); th = C.bump(0.34, 0.48, 0.7, 1.15, t);
      C.addRot(fig, "root", 0.08 * th - 0.04 * wind, 0.4 * wind - 0.45 * th, 0);
      J.root.position.add(V(0, 0.015 * wind - 0.05 * th, -0.03 * wind + 0.08 * th));
      C.addRot(fig, "spine", -0.1 * wind + 0.18 * th, 0.15 * wind - 0.12 * th, 0);
      C.addRot(fig, "chest", -0.12 * wind + 0.16 * th, 0.2 * wind - 0.15 * th, 0);
      C.addRot(fig, "head", 0.1 * wind - 0.08 * th, -0.25 * wind + 0.25 * th, 0);
      C.rot(fig, "thighL", -0.55 * th - 0.2 * wind, 0, -0.05); C.rot(fig, "shinL", 0.4 * th + 0.2 * wind, 0, 0);
      C.rot(fig, "thighR", 0.3 * th, 0, 0.05); C.rot(fig, "shinR", 0.3 * th + 0.1 * wind, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.1 * th, 0, 0); C.rot(fig, "cape2" + s, 0.08 * th, 0, 0); }
      glow += 1.3 * C.bump(0.3, 0.44, 0.55, 0.9, t);
      C.setFace(fig, "fierce");
    }
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    if (clip === "victory") {
      // raise the sword to the sky
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      C.aimGrip(fig, "handR", [-0.1, 1, 0.1], [1, 0, 0.2], 1);
      C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V(shL.x + 0.04, shL.y - 0.26, shL.z + 0.04)), C.toW(fig, V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2)), 1);
      C.emitBoost(fig, 0.2 + 1.2 * up);
      fig.root.updateMatrixWorld(true);
      return t < 1.6;
    }
    // rest: sword point-down at the right side, hand on the pommel; the left hand relaxed at the hip
    const hold = V(shR.x - 0.05, shR.y - 0.14 + 0.004 * br, shR.z + 0.15);
    const k = Math.max(wind, th);
    const phi = -0.8 * C.sstep(0.02, 0.3, t) + 3.0 * C.sstep(0.34, 0.52, t) - 2.0 * C.sstep(0.72, 1.15, t);
    const U = V(-0.25, 1, -0.1).normalize(), F = V(0.35, 0, 1).normalize();
    const dir = U.clone().multiplyScalar(Math.cos(phi)).addScaledVector(F, Math.sin(phi)).normalize();
    const nrm = V().crossVectors(U, F).normalize();
    const cen = V(shR.x * 0.3, shR.y - 0.08, shR.z + 0.12);
    const hand = hold.clone().lerp(cen.clone().addScaledVector(dir, 0.1), k);
    const aim = V(-0.06, -1, 0.1).normalize().lerp(dir, k).normalize(), face = V(0, 0, 1).lerp(nrm, k);
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V(shR.x - 0.3, shR.y - 0.2, shR.z - 0.1)), 1);
    C.aimGrip(fig, "handR", [aim.x, aim.y, aim.z], [face.x, face.y, face.z], 1);
    fig.root.updateMatrixWorld(true);
    const pr = fig.props.find((p) => p.bone === "handR");
    if (pr && k > 0.001) {
      const low = C.toM(fig, pr.holder.localToWorld(V(0, -0.06, 0)));
      C.ik(fig, "armL", "foreL", "handL", C.toW(fig, low), C.toW(fig, V(shL.x + 0.3, shL.y - 0.25, shL.z - 0.1)), k);
    } else {
      const hk = clip === "hurt" ? Math.exp(-t * 6) * C.sstep(0, 0.05, t) : 0;
      C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V(shL.x + 0.05 + 0.03 * hk, shL.y - 0.26 + 0.004 * br + 0.08 * hk, shL.z + 0.04)), C.toW(fig, V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2)), 1);
    }
    C.emitBoost(fig, glow);
    fig.root.updateMatrixWorld(true);
    return clip === "idle" ? true : t < (clip === "attack" ? LEN : clip === "hurt" ? 0.6 : 1.6);
  }

  return {
    cards: ["frostking"], kind: "humanoid", build, pose, scale: 1.35,
    face: { kind: "human", look: { eye: 0x6fa8e8, brow: "#9aa4bc", lash: "#1e2230", lip: "#b08078", skinD: "#d0b4b4" } },
    moves: { attack: { clip: "cleave", hit: HIT, length: LEN, style: "slash", trail: { prop: "spear", from: [0, B0 + 0.08, 0], to: [0, B0 + BL, 0] } } },
  };
})());
