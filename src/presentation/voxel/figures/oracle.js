/* 星界观测者 — the astral stargazer (card oracle): a silver-haired seer with her hair up in a knot pinned by a gold
 * star, a black high-collared gown over a pale under-robe, a deep navy mantle and cloak strewn with gold stars, and a
 * great silver astrolabe on her left arm — a ringed dial of night sky with an eight-pointed gold star at its heart.
 * The astrolabe rides its own bone (posed by pose() on her left fist), and its dial on a child bone that turns; she
 * raises it at the target, the dial spins up and the spell leaves the star at its heart. */
EmberVoxelKit.define("oracle", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, rotY2, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, bell, strand, onEll } = K;
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // 4-pointed star in the XY plane (half span a, arm half-width b), extruded ±d along Z
  const star4 = (a, b, d) => S.custom((x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    return Math.max(Math.min(ax / b + ay / a, ax / a + ay / b) * b - b, Math.abs(z) - d);
  }, [-a, -a, -d, a, a, d]);
  // flat band ring in the XY plane: radius R, half width w, half thickness d
  const band = (R, w, d) => S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - R) - w, Math.abs(z) - d), [-R - w, -R - w, -d, R + w, R + w, d]);
  const RIM = 0.14;                                    // astrolabe outer radius (model units)

  // ------------------------------------------------------------ props: the astrolabe (rim + turning dial), centre origin, face +Z
  function rimProp() {
    const sc = new Sculpture(), PX = K.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      silver: { c: 0xb4bccf, rough: 0.28, metal: 1, cls: CLS.metal, vary: 0.03 }, silverD: { c: 0x6a7186, rough: 0.35, metal: 1, cls: CLS.metal },
      gold: { c: 0xdcb45e, rough: 0.3, metal: 1, cls: CLS.metal },
    });
    const o = { bone: "p" };
    sc.add(band(RIM, 0.011, 0.0075), { ...o, mat: "silver", k: 0.001 });
    if (!PX) sc.paint(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - RIM) - 0.004, -z), [-1, -1, -1, 1, 1, 1]), { mat: "silverD", soft: 0.001, only: ["silver"] });
    sc.add(band(RIM - 0.02, PX ? 0.007 : 0.004, PX ? 0.005 : 0.004), { ...o, mat: "gold", k: 0.001, vdil: 0.6 });
    // orbs set in the rim, a crescent finial at the bottom
    for (const a of [0.5, 2.1, 3.7, 5.2]) sc.add(S.sphere(0.013), { ...o, mat: "silver", p: [Math.cos(a) * RIM, Math.sin(a) * RIM, 0.004], k: 0.001 });
    if (!PX) sc.add(S.arc(0.02, 0.004, 2.0), { ...o, mat: "gold", p: [0, -RIM - 0.03, 0], r: [0, 0, Math.PI], k: 0.001, vdil: 0.6 });
    return sc;
  }
  function dialProp() {
    const sc = new Sculpture(), PX = K.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      sky: { c: 0x2a3a82, rough: 0.5, emit: 0.18, cls: CLS.glow, vary: 0.05 }, dot: { c: 0xc8d4ff, rough: 0.4, emit: 0.9, cls: CLS.glow },
      silver: { c: 0xb4bccf, rough: 0.28, metal: 1, cls: CLS.metal, vary: 0.03 },
      gold: { c: 0xe0b860, rough: 0.28, metal: 1, cls: CLS.metal }, core: { c: 0xfff0c8, rough: 0.3, emit: 1.6, cls: CLS.glow },
    });
    const o = { bone: "p" }, Rd = RIM - 0.026;
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, y) - Rd, Math.abs(z) - 0.003), [-Rd, -Rd, -0.004, Rd, Rd, 0.004]), { ...o, mat: "sky", k: 0.001 });
    // a scatter of pale star points on the sky
    // pixel sprite: no star specks or hairline rings on the sky — the gold star and its bright heart carry the dial
    if (!PX) {
      [[0.07, 0.03], [-0.05, 0.08], [-0.085, -0.03], [0.03, -0.09], [0.09, -0.05], [-0.02, 0.1]].forEach(([x, y]) =>
        sc.paint(S.box(0.004, 0.004, 0.02), { mat: "dot", p: [x, y, 0], soft: 0.001, only: ["sky"] }));
      sc.add(band(0.066, 0.0035, 0.005), { ...o, mat: "silver", k: 0.001, vdil: 0.6 });
      sc.add(band(0.034, 0.003, 0.005), { ...o, mat: "silver", k: 0.001, vdil: 0.6 });
    }
    // the eight-pointed star: four long rays, four short diagonals, proud of the dial
    sc.add(star4(Rd - 0.004, 0.013, 0.006), { ...o, mat: "gold", p: [0, 0, 0.004], k: 0.001, vdil: 0.5 });
    sc.add(star4(0.07, 0.01, 0.005), { ...o, mat: "gold", p: [0, 0, 0.004], r: [0, 0, Math.PI / 4], k: 0.001, vdil: 0.5 });
    sc.add(S.sphere(PX ? 0.022 : 0.013), { ...o, mat: "core", p: [0, 0, 0.008], k: 0.001 });
    if (!PX) sc.add(S.sphere(0.009), { ...o, mat: "silver", p: [0.066, 0, 0.006], k: 0.001 });
    return sc;
  }

  function hair(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.006]), cr = P.cran, R = [cr[0] * 1.06, cr[1] * 1.05, cr[2] * 1.07];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // hair swept up: a knot at the back of the crown, wrapped once
    const knot = onEll(C, R, Math.PI, 0.55, 1.12);
    sc.add(S.ell(0.046, 0.04, 0.04), { mat: "hair", p: knot, bone: "head", k: 0.012 });
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, z) - 0.042) - 0.006, Math.abs(y) - 0.008), [-0.06, -0.01, -0.06, 0.06, 0.01, 0.06]), { mat: "hairD", p: add(knot, [0, 0.004, 0]), r: [0.6, 0, 0], bone: "head", k: 0.002 });
    // soft side-swept fringe, clear of the eyes
    for (let i = 0; i < 5; i++) {
      const u = i / 4;
      const root = [0.02 * q - 0.004 * i, C[1] + R[1] * (0.64 - 0.04 * u), C[2] + R[2] * (0.7 + 0.06 * u)];
      const mid = [R[0] * (0.1 - 0.5 * u), ey + 0.064, P.faceZ + 0.004 * q];
      const tip = [-R[0] * (0.35 + 0.55 * u), ey + 0.044 - 0.018 * u, P.faceZ - 0.012 * q - 0.016 * q * u];
      strand(sc, [root, mid, tip], 0.0115 * q, 0.0018 * q, { k: 0.007, taper: 1.2 });
    }
    strand(sc, [onEll(C, R, 0.9, 0.7, 1.0), [R[0] * 0.9, ey + 0.04, P.faceZ - 0.03 * q], [R[0] * 1.02, ey + 0.004, P.faceZ - 0.04 * q]], 0.011 * q, 0.002 * q, { k: 0.007, taper: 1.2 });
    // long locks left loose in front of the ears, down over the collar
    for (const s of [1, -1]) {
      const n = sideName(s), root = onEll(C, R, s * 1.25, 0.25, 0.98);
      const a = [s * R[0] * 1.06, ey - 0.02 * q, C[2] + R[2] * 0.42], b = [s * R[0] * 1.12, P.chinY - 0.02 * q, C[2] + R[2] * 0.38];
      const tip = [s * P.shX * 0.85, P.neck[0] - 0.12 * q, P.chest[3] * 0.8];
      const sp = strand(sc, [root, a, b, tip], 0.012 * q, 0.0022 * q, { wave: 0.006 * q, wd: [s, 0, 0.2], waves: 2.2, phase: s, k: 0.009, wg: 4, bone: "hair" + n });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - 0.12, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
    // gold star pin in the knot
    sc.add(star4(0.022, 0.0075, 0.004), { mat: "gold", p: add(knot, [0.04, 0.012, 0.01]), r: [0, Math.PI / 2 - 0.3, 0.4], bone: "head", k: 0.001, vdil: 0.55 });
  }

  /* pixel sprite: the knot, two fat fringe locks swept to her right above the brow, a lock at the left temple, one fat
   * lock each side down over the collar, a bigger gold star pin */
  function hairPx(sc, P) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.006]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.06, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    const knot = onEll(C, R, Math.PI, 0.55, 1.12);
    sc.add(S.ell(0.05, 0.044, 0.044), { mat: "hair", p: knot, bone: "head", k: 0.012 });
    const o = { k: 0.012, taper: 1.1, grooves: 0 }, root = [0.02, C[1] + R[1] * 0.7, C[2] + R[2] * 0.62];
    strand(sc, [root, [-0.004, ey + 0.062, P.faceZ + 0.006], [-0.04, ey + 0.04, P.faceZ - 0.004]], 0.021, 0.009, o);
    strand(sc, [root, [-0.036, ey + 0.06, P.faceZ - 0.002], [-0.066, ey + 0.012, P.faceZ - 0.026]], 0.02, 0.008, o);
    strand(sc, [onEll(C, R, 0.7, 0.75, 1.0), [R[0] * 0.88, ey + 0.045, P.faceZ - 0.03], [R[0] * 1.02, ey + 0.006, P.faceZ - 0.045]], 0.019, 0.009, o);
    for (const s of [1, -1]) {
      const n = sideName(s);
      const sp = strand(sc, [onEll(C, R, s * 1.25, 0.25, 0.98), [s * R[0] * 1.07, ey - 0.025, C[2] + R[2] * 0.42], [s * R[0] * 1.12, P.chinY - 0.025, C[2] + R[2] * 0.38], [s * P.shX * 0.82, P.neck[0] - 0.13, P.chest[3] * 0.8]],
        0.02, 0.011, { k: 0.012, taper: 1.3, wg: 4, bone: "hair" + n, grooves: 0 });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - 0.12, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
    sc.add(star4(0.032, 0.011, 0.005), { mat: "gold", p: add(knot, [0.044, 0.014, 0.012]), r: [0, Math.PI / 2 - 0.3, 0.4], bone: "head", k: 0.001, vdil: 0.55 });
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = fam === "chunky" ? 1.25 : 1, PX = K.pixel;
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.01, capeBot = 0.02, capeZ = -P.chest[3] - 0.032;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairL", "head", 0.05, P.eyeY - 0.03, 0.03); sc.bone("hairR", "head", -0.05, P.eyeY - 0.03, 0.03);
    // the astrolabe: parked in front of the chest at bind (pose() carries it on the left fist); the dial turns inside
    const A0 = [0.1, 0.5, 0.3];
    sc.bone("astro", "chest", ...A0); sc.bone("dial", "astro", ...A0);
    mats(sc, {
      skin: { c: 0xf2dccf, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd8b4a4, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xc47f7a, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xb3bbd6, rough: 0.5, cls: CLS.hair, vary: 0.08 }, hairD: { c: 0x8990ae, rough: 0.55, cls: CLS.hair },
      gown: { c: 0x24242f, rough: 0.8, cls: CLS.cloth, vary: 0.05 },
      pale: { c: 0xbcc2d8, rough: 0.9, cls: CLS.cloth, vary: 0.03 },
      navy: { c: 0x2f44a8, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, navyD: { c: 0x1d2a6e, rough: 0.9, cls: CLS.cloth },
      gold: { c: 0xdcb45e, rough: 0.3, metal: 1, cls: CLS.metal },
    });
    body(sc, P, fam, { elf: false });
    const X0 = P.shX * 0.93;
    // ---- gown: black bodice, fitted black sleeves with pale cuffs, gold star brooch at the throat
    const upArm = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.55)), lerp(a.S, a.E, 1.02), 0.085); });
    wrap(sc, RG.or(RG.box(-X0 * 1.3, X0 * 1.3, P.hipY - 0.12, P.neck[0] + 0.03), ...upArm), "gown", 0.006 * q);
    for (const s of [1, -1]) {
      const a = armJoints(P, s);
      wrap(sc, RG.seg(lerp(a.S, a.E, 0.4), lerp(a.E, a.W, 0.8), 0.075), "gown", 0.006 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.8), add(a.W, mul(a.dir, 0.004)), 0.075), "pale", 0.008 * q);
    }
    // ---- cloth: pale under-robe to the floor with the black gown open over it, sash, mantle, star cloak, collar
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, y1 = 0.004, r0 = 0.09, r1 = 0.19, szs = 0.84, h = y0 - y1, zc = -0.004;
    const rAt = (u) => mix(r0, r1, Math.pow(u, 0.62));
    const skirtS = S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), a = Math.atan2(z / szs, x);
      return Math.max((Math.hypot(x, z / szs) - rAt(u) - (PX ? 0 : 0.008 * u * Math.sin(a * 8 + 0.6))) * 0.85, y, -y - h);
    }, [-r1 - 0.02, -h, -(r1 + 0.02) * szs, r1 + 0.02, 0, (r1 + 0.02) * szs]);
    const sk = sc.add(skirtS, { mat: "gown", p: [0, y0, zc], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.6, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    // the gown parts over the pale under-robe in a widening front panel, gold edging
    const panel = (y) => 0.02 + 0.07 * clamp((y0 - y) / h, 0, 1);
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(x) - panel(y) : 1), [-1, -1, -1, 1, 1, 1]), { mat: "pale", soft: 0.001, only: ["gown"] });
    if (!PX) sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(Math.abs(x) - panel(y) - 0.005) - 0.005 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["gown"] });
    // sash with a gold star clasp
    const yb = y0 + 0.004, sash = S.custom((x, y, z) => Math.max(Math.hypot(x, (z - zc) / 0.84) - 0.098, Math.abs(y - yb) - 0.016), pad([-0.11, yb - 0.03, -0.1, 0.11, yb + 0.03, 0.1], 0.01));
    sc.add(sash, { mat: "navy", p: [0, 0, 0], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.003, cs: 0.03, wg: 3 });
    sc.add(star4(0.024, 0.008, 0.004), { mat: "gold", p: [0, yb, zc + 0.086], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.001, vdil: 0.55 });
    // high collar, gold rim, star brooch
    const cy0 = P.neck[0] - 0.012, cy1 = P.chinY + 0.01;
    const col = sc.add(S.custom((x, y, z) => { const rr = (Math.hypot(x / 0.052, (z + 0.004) / 0.048) - 1) * 0.05; return Math.max(Math.abs(rr) - 0.005, cy0 - y, y - cy1); }, pad([-0.07, cy0, -0.07, 0.07, cy1, 0.07], 0.01)),
      { mat: "gown", p: [0, 0, 0], bone: "chest", k: 0.003, cs: 0.03, wg: 4 });
    col.wfn = (x, y) => { const u = sstep(cy0, cy1, y); return [["chest", 1 - 0.5 * u], ["neck", 0.5 * u]]; };
    if (!PX) sc.paint(S.custom((x, y, z) => cy1 - 0.005 - y, [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["gown"] });
    sc.add(star4(0.028, 0.009, 0.004), { mat: "gold", p: [0, P.neck[0] - 0.03, P.chest[3] + 0.034], bone: "chest", k: 0.001, vdil: 0.55 });
    // navy mantle over the shoulders, open at the front, gold hem
    const mTop = P.neck[0] + 0.012 * q, mBot = P.chest[0] - 0.03 * q;
    bell(sc, mTop, mBot, P.neck[2] * 2.0, P.shX + P.delt * 1.35, "navy", { t: 0.0075, sz: (P.chest[3] * 1.8) / (P.shX + P.delt), folds: 8, amp: PX ? 0.0001 : 0.008 * q, z: -0.014, slit: 0.05 * q, pw: 0.45, bones: [["chest", 1]] });
    if (PX) {
      // pixel sprite: the gold hem is a short band of its own round the mantle's lower edge (paint would bleed onto the cloak)
      const r0m = P.neck[2] * 2.0, r1m = P.shX + P.delt * 1.35, yA = mBot + 0.016, uA = (mTop - yA) / (mTop - mBot), rA = mix(r0m, r1m, Math.pow(uA, 0.45));
      bell(sc, yA, mBot - 0.002, rA, r1m + 0.002, "gold", { t: 0.0105, sz: (P.chest[3] * 1.8) / (P.shX + P.delt), folds: 8, amp: 0.0001, z: -0.014, slit: 0.05 * q, pw: 1, bones: [["chest", 1]] });
    } else sc.paint(S.custom((x, y, z) => Math.max(y - (mBot + 0.01), mBot - 0.012 - y, Math.hypot(x, z) - 0.26, 0.1 - Math.hypot(x, z * 1.3)), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["navy"] });
    // star cloak to the floor, wrapping the sides; darker lining, gold hem
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.13, 0.26, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.08, u) - (PX ? 0.009 : 0.016) * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u) + (0.75 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + (PX ? 0.008 : 0.008 * (1 + Math.sin(x * 34 + 0.6))) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.3, capeBot, -0.27, 0.3, capeTop, 0.1]), { mat: "navy", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.07 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.3, capeBot, -0.27, 0.3, capeTop, 0.1]), { mat: "navyD", soft: 0.001, only: ["navy"] });
    if (!PX) sc.paint(S.custom((x, y, z) => (z > 0.07 ? 1 : y - capeBot - 0.008 * (1 + Math.sin(x * 34 + 0.6)) - 0.012), [-0.3, capeBot, -0.27, 0.3, capeTop, 0.1]), { mat: "gold", soft: 0.001, only: ["navy"] });
    // gold stars strewn over the back of the cloak and the mantle's shoulders (projected along Z / X); the pixel sprite
    // has four bigger ones, laid on the cloak as flat gold pieces (painted specks smear on the simplified mesh)
    if (PX) [[0.07, 0.56, 9], [-0.09, 0.42, 9], [0.1, 0.26, 8], [-0.06, 0.14, 8]].forEach(([x, y, sz]) => {
      const st = sc.add(star4(sz * 0.0055, sz * 0.0021, 0.003), { mat: "gold", p: [x, y, capeZc(x, y).zc - 0.007], bone: "chest", k: 0.001, vdil: 0.5, wg: 2 });
      st.wfn = cp.wfn;
    });
    else [[0.06, 0.62, 5], [-0.1, 0.5, 4], [0.14, 0.34, 4], [-0.04, 0.26, 5], [0.02, 0.44, 3], [-0.16, 0.14, 4], [0.1, 0.12, 3]].forEach(([x, y, sz]) =>
      sc.paint(star4(sz * 0.0055, sz * 0.0019, 0.3), { mat: "gold", p: [x, y, -0.2], soft: 0.001, only: ["navy"] }));
    for (const s of [1, -1]) sc.paint(PX ? star4(0.028, 0.01, 0.3) : star4(0.022, 0.0075, 0.3), { mat: "gold", p: [s * 0.2, P.shY - 0.02, -0.01], r: [0, Math.PI / 2, 0], soft: 0.001, only: ["navy"] });
    sc.part = "hair";
    if (PX) hairPx(sc, P); else hair(sc, P, q);
    sc.part = "body";
    return { sc, P, kind: "humanoid", props: [{ sc: rimProp(), bone: "astro", at: A0 }, { sc: dialProp(), bone: "dial", at: A0 }] };
  }

  // ------------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = { q1: new EmberVesperThree.Quaternion(), q2: new EmberVesperThree.Quaternion(), q3: new EmberVesperThree.Quaternion(), e: new EmberVesperThree.Euler() });
  /** place the astrolabe centre at model point m, face turned by (tilt, yaw), the dial spun by `spin` */
  function placeAstro(fig, C, m, tilt, yaw, spin) {
    const { q1, q2, q3, e } = three(), o = fig.J.astro, d = fig.J.dial;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    o.position.copy(o.parent.worldToLocal(C.toW(fig, m)));
    o.parent.getWorldQuaternion(q1).invert();
    fig.root.getWorldQuaternion(q2);
    q3.setFromEuler(e.set(tilt, yaw, 0));
    o.quaternion.copy(q1.multiply(q2).multiply(q3));
    if (d) { d.position.set(0, 0, 0); d.quaternion.setFromEuler(e.set(0, 0, spin)); }
    o.updateMatrixWorld(true);
  }
  /** a point on the astrolabe's rim (angle a in its face plane) in model space */
  function rimPoint(C, m, tilt, yaw, a, r) {
    const { q3, e } = three();
    q3.setFromEuler(e.set(tilt, yaw, 0));
    return C.V3(Math.cos(a) * r, Math.sin(a) * r, 0).applyQuaternion(q3).add(m);
  }

  function pose(fig, clip, t, T, C) {
    const V = C.V3, br = Math.sin((T * C.TAU) / 3.4);
    const shift = (x, y, z) => fig.J.root.position.add(V(x, y, z));
    C.base(fig, "idle", 0, T);
    fig.root.updateMatrixWorld(true);
    const shL = C.toM(fig, C.wpos(fig.J.armL)), shR = C.toM(fig, C.wpos(fig.J.armR));
    // idle: the astrolabe stood on her left side, facing out-front; the right hand rests on its face
    let m = V(shL.x + 0.1, shL.y - 0.25 + 0.006 * br, shL.z + 0.17), tilt = -0.08, yaw = 0.5, spin = T * 0.35;
    let lA = 2.6, rA = 3.6, rIn = 0.75, glow = 0.1 * (0.5 + 0.5 * Math.sin(T * 1.9)), face = null, done;
    if (clip === "idle") done = true;
    else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      C.addRot(fig, "spine", -0.22 * k, 0, 0.12 * k); C.addRot(fig, "chest", -0.28 * k, 0, 0.08 * k); C.addRot(fig, "head", -0.3 * k, 0.2 * k, 0.12 * k);
      shift(0, -0.02 * k, -0.05 * k);
      m.add(V(0.02 * k, 0.03 * k, -0.07 * k)); tilt += 0.3 * k; yaw += 0.25 * k; glow *= 1 - 0.8 * k;
      face = t < 0.45 ? "hurt" : null; done = t < 0.6;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      C.addRot(fig, "chest", -0.12 * up, 0, 0); C.addRot(fig, "head", -0.28 * up, 0, 0);
      fig.root.updateMatrixWorld(true);
      const hd = C.toM(fig, C.wpos(fig.J.head));
      m.lerp(V(hd.x + 0.04, hd.y + 0.18, hd.z + 0.1), up); tilt = mix(tilt, 0.5, up); yaw = mix(yaw, 0, up);
      lA = mix(lA, 3.5, up); rA = mix(rA, 5.9, up); rIn = mix(rIn, 1, up);
      spin += 5 * C.sstep(0, 1.2, t); glow += 1.1 * up;
      face = up > 0.3 ? "closed" : null; done = t < 1.6;
    } else if (clip === "attack") {
      // raise the astrolabe before her (0-0.3), the dial winding up → thrust it at the target, release at 0.42
      const up = C.sstep(0.02, 0.3, t) * (1 - C.sstep(0.68, 1.08, t)), ch = C.bump(0.02, 0.28, 0.32, 0.42, t), th = C.bump(0.32, 0.42, 0.62, 1.05, t);
      const rel = C.bump(0.4, 0.43, 0.5, 0.75, t);
      C.addRot(fig, "root", 0.04 * th, 0.2 * ch - 0.1 * th, 0);
      shift(0, -0.012 * ch - 0.02 * th, -0.02 * ch + 0.05 * th);
      C.addRot(fig, "spine", -0.08 * ch + 0.08 * th, 0, 0); C.addRot(fig, "chest", -0.08 * ch + 0.06 * th, 0.1 * ch - 0.06 * th, 0);
      C.addRot(fig, "head", -0.05 * ch, -0.12 * ch, 0);
      C.addRot(fig, "thighL", -0.2 * th, 0, 0); C.addRot(fig, "shinL", 0.12 * th, 0, 0);
      fig.root.updateMatrixWorld(true);
      const chest = C.toM(fig, C.wpos(fig.J.chest));
      const high = V(chest.x + 0.03, chest.y + 0.02, chest.z + 0.24), out = V(chest.x + 0.02, chest.y + 0.03, chest.z + 0.31);
      m.lerp(high, up).lerp(out, th * 0.9);
      tilt = mix(tilt, -0.1, up); yaw = mix(yaw, 0, up);
      lA = mix(lA, 0.25, up); rA = mix(rA, 2.9, up); rIn = mix(rIn, 1, up);
      spin += C.TAU * 1.5 * C.sstep(0.02, 0.45, t) + 10 * C.sstep(0.42, 1.0, t) * (1 - 0.5 * C.sstep(0.6, 1.1, t));
      glow += 0.5 * up + 1.4 * rel;
      face = t > 0.04 && t < 0.36 ? "focus" : th > 0.3 ? "fierce" : null; done = t < 1.2;
    } else return undefined;
    placeAstro(fig, C, m, tilt, yaw, spin);
    // hands on the rim (left grips it, right rests on it; the right hand moves in onto the face at idle)
    const lh = rimPoint(C, m, tilt, yaw, lA, RIM - 0.01).add(V(0, 0, -0.03));
    const rh = rimPoint(C, m, tilt, yaw, rA, (RIM - 0.01) * rIn).add(V(0, 0, 0.02 * (1 - rIn) - 0.02));
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, lh), C.toW(fig, V(shL.x + 0.35, shL.y - 0.25, shL.z - 0.15)), 1);
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, rh), C.toW(fig, V(shR.x - 0.3, shR.y - 0.3, shR.z - 0.1)), 1);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    return done;
  }

  return {
    cards: ["oracle"], kind: "humanoid", build, pose, scale: 0.95,
    face: { kind: "human", look: { eye: 0x5f7fd0, brow: "#8d93aa", lash: "#2a2a38", lip: "#c47f7a", skinD: "#d8b4a4" } },
    moves: { attack: { clip: "chart", hit: 0.42, length: 1.2, style: "bolt", ranged: true, windup: 280, emitter: { bone: "dial", offset: [0, 0, 0.02] } } },
  };
})());
