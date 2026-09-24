/* 渡魂引路人 — the soul guide (card soulguide): a tall silver-haired ferryman of souls — long straight silver hair
 * blowing back, a white hooded mantle (hood down, bunched round the neck) and a white cloak to the ground over a black
 * robe with silver bands, a silver crescent pauldron on the left shoulder, black gloves, and a silver gothic lantern
 * with a pale soul-light carried low in his right hand. The lantern hangs on its own bone (posed upright under the
 * fist by pose()); his attack swings it up at the target and the spell leaves the lantern. */
EmberVoxelKit.define("soulguide", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, rotY2, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, bell, strand, onEll } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // square (rotated 45°: four points front/back/left/right) cross-section, half-diagonal a
  const diamond = (x, z, a) => (Math.abs(x) + Math.abs(z)) * 0.7071 - a * 0.7071;
  const hex = (x, z, a) => Math.max(Math.abs(x) * 0.866 + Math.abs(z) * 0.5, Math.abs(z)) - a;

  // ------------------------------------------------------------ prop: the soul lantern (origin at the hanging ring)
  function lanternProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      silver: { c: 0x9ea6ba, rough: 0.28, metal: 1, cls: CLS.metal, vary: 0.03 }, silverD: { c: 0x4c5264, rough: 0.35, metal: 1, cls: CLS.metal },
      core: { c: 0xf4f2ff, rough: 0.3, emit: 1.8, cls: CLS.glow }, glass: { c: 0xa9b4ec, rough: 0.3, emit: 1.05, cls: CLS.glow },
    });
    const o = { bone: "p" }, g = 1.25;
    sc.add(S.torus(0.011 * g, 0.0032), { ...o, mat: "silver", p: [0, -0.008 * g, 0], r: [Math.PI / 2, 0, 0], k: 0.001, vdil: 0.6 });
    // spired cap
    sc.add(S.custom((x, y, z) => Math.max(hex(x, z, 0.008 * g + (-0.018 * g - y) * 1.05), y + 0.018 * g, -0.046 * g - y), pad([-0.045, -0.05, -0.045, 0.045, -0.015, 0.045], 0.01)), { ...o, mat: "silverD", k: 0.001 });
    // cage: a tall hexagon of glass, silver posts, gothic arches at the top of each pane (painted), rims
    const y0 = -0.047 * g, y1 = -0.135 * g, ap = 0.032 * g;
    sc.add(S.custom((x, y, z) => Math.max(hex(x, z, ap - 0.004), y - y0, y1 - y), pad([-0.04, y1, -0.04, 0.04, y0, 0.04], 0.01)), { ...o, mat: "glass", k: 0.001 });
    sc.add(S.cyl(0.022 * g, 0.017 * g), { ...o, mat: "core", p: [0, (y0 + y1) / 2 - 0.004, 0], k: 0.002 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6, rr = ap / 0.866;
      sc.limb([Math.cos(a) * rr, y0, Math.sin(a) * rr], [Math.cos(a) * rr, y1, Math.sin(a) * rr], 0.0042, 0.0042, { ...o, mat: "silver", k: 0.001, vdil: 0.6 });
    }
    sc.paint(S.custom((x, y, z) => Math.max(y0 - 0.016 - y, y - y0), [-1, -1, -1, 1, 1, 1]), { mat: "silverD", soft: 0.001, only: ["glass"] });
    for (const [y, m] of [[y0, "silver"], [y1, "silver"]]) sc.add(S.custom((x, yy, z) => Math.max(hex(x, z, ap + 0.005), Math.abs(yy - y) - 0.005), pad([-0.05, y - 0.006, -0.05, 0.05, y + 0.006, 0.05], 0.01)), { ...o, mat: m, k: 0.001 });
    // tapering base, a crescent and a point hanging under it
    sc.add(S.custom((x, y, z) => Math.max(hex(x, z, 0.004 + (y - (y1 - 0.03)) * 0.9), y - y1, y1 - 0.03 - y), pad([-0.04, y1 - 0.035, -0.04, 0.04, y1, 0.04], 0.01)), { ...o, mat: "silverD", k: 0.001 });
    sc.add(S.arc(0.016, 0.0036, 2.2), { ...o, mat: "silver", p: [0, y1 - 0.05, 0], r: [0, 0, Math.PI], k: 0.001, vdil: 0.6 });
    sc.add(S.custom((x, y, z) => Math.max(diamond(x, z, 0.006 * (1 - clamp((y1 - 0.052 - y) / 0.03, 0, 1))), y - (y1 - 0.052), y1 - 0.085 - y), pad([-0.01, y1 - 0.09, -0.01, 0.01, y1 - 0.05, 0.01], 0.01)), { ...o, mat: "silver", k: 0.001, vdil: 0.6 });
    return sc;
  }

  function hair(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.006]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.06, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // side-parted fringe swept to his right, clear of the eyes
    for (let i = 0; i < 6; i++) {
      const u = i / 5, s = i < 4 ? -1 : 1, uu = i < 4 ? u / 0.6 : (i - 4);
      const root = [0.018 * q, C[1] + R[1] * (0.64 - 0.05 * uu), C[2] + R[2] * (0.7 + 0.08 * uu)];
      const mid = [0.018 * q + s * R[0] * (0.25 + 0.2 * uu), ey + 0.062, P.faceZ + 0.004 * q];
      const tip = s < 0 ? [-R[0] * (0.6 + 0.3 * uu), ey + 0.032 - 0.02 * uu, P.faceZ - 0.012 * q - 0.014 * q * uu] : [R[0] * (0.82 + 0.14 * uu), ey + 0.05 - 0.012 * uu, P.faceZ - 0.024 * q - 0.012 * q * uu];
      strand(sc, [root, mid, tip], 0.0115 * q, 0.0018 * q, { k: 0.007, taper: 1.2 });
    }
    // locks in front of the ears to the chest
    for (const s of [1, -1]) for (let j = 0; j < 2; j++) {
      const n = sideName(s), o = j - 0.5;
      const root = onEll(C, R, s * (1.2 + 0.12 * o), 0.25, 0.98);
      const a = [s * R[0] * (1.05 + 0.04 * o), ey - 0.02 * q, C[2] + R[2] * (0.45 - 0.1 * o)];
      const b = [s * R[0] * (1.1 + 0.04 * o), P.chinY - 0.02 * q, C[2] + R[2] * (0.4 - 0.1 * o)];
      const tip = [s * P.shX * (0.8 + 0.1 * o), P.neck[0] - 0.08 * q, P.chest[3] * 0.75 - 0.012 * o];
      const sp = strand(sc, [root, a, b, tip], 0.012 * q, 0.0025 * q, { wave: 0.004 * q, wd: [s, 0, 0.3], waves: 2, phase: j, k: 0.009, wg: 4, bone: "hair" + n });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - 0.1, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
    // the long straight mass behind, blowing back and out to his left
    const len = 0.3, N = 9;
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1, az = Math.PI + u * 1.6, el = 0.35 - 0.25 * Math.abs(u);
      const root = onEll(C, R, az, el, 0.98), out = onEll(C, R, az, -0.3, 1.2);
      const l = len * (0.85 + 0.2 * (1 - Math.abs(u))) + 0.015 * Math.sin(i * 2.3);
      const tip = [out[0] * 1.15 + 0.05 + u * 0.02, P.neck[0] - l, -P.chest[3] - 0.07 - 0.03 * (1 - Math.abs(u))];
      const mid = lerp(out, tip, 0.45); mid[2] -= 0.02;
      const sp = strand(sc, [root, out, mid, tip], (0.021 - 0.004 * Math.abs(u)) * q, 0.003 * q, { wave: 0.006 * q, wd: [1, 0, 0], waves: 1.6, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.2, bone: "hairB1" });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.01, P.neck[0] - l, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = fam === "chunky" ? 1.25 : 1;
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.012, capeBot = 0.02, capeZ = -P.chest[3] - 0.036;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairL", "head", 0.05, P.eyeY - 0.03, 0.03); sc.bone("hairR", "head", -0.05, P.eyeY - 0.03, 0.03);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -P.cran[2] * 0.9); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.05, -P.cran[2] * 1.1);
    const aR = armJoints(P, -1), grip = add(aR.W, mul(aR.dir, 0.044 * P.hand)), hang = add(grip, [0, -0.012, 0]);
    sc.bone("lantern", "handR", ...hang);
    mats(sc, {
      skin: { c: 0xf0d8c8, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd6b0a0, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xbc8a80, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xaab4d2, rough: 0.5, cls: CLS.hair, vary: 0.08 },
      robe: { c: 0x2c2d3a, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, robeD: { c: 0x1b1b24, rough: 0.9, cls: CLS.cloth },
      white: { c: 0xb4bcd6, rough: 0.9, cls: CLS.cloth, vary: 0.035 }, whiteD: { c: 0x7a82a0, rough: 0.9, cls: CLS.cloth },
      silver: { c: 0xa8b0c4, rough: 0.28, metal: 1, cls: CLS.metal, vary: 0.03 }, silverD: { c: 0x5e6476, rough: 0.35, metal: 1, cls: CLS.metal },
      glove: { c: 0x25242d, rough: 0.55, cls: CLS.leather, vary: 0.06 },
      sash: { c: 0x3a3a48, rough: 0.6, cls: CLS.leather, vary: 0.06 },
    });
    body(sc, P, fam, { elf: false });
    const X0 = P.shX * 0.93;
    // ---- torso: black tunic with a silver-edged high collar opening
    const upArm = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.55)), lerp(a.S, a.E, 1.02), 0.085); });
    wrap(sc, RG.or(RG.box(-X0 * 1.3, X0 * 1.3, P.hipY - 0.12, P.neck[0] + 0.03), ...upArm), "robe", 0.006 * q);
    sc.paint(S.custom((x, y, z) => (z > 0.02 && y > P.waist[0] ? Math.abs(x - 0.022) - 0.006 : 1), [-0.3, -0.3, -0.3, 0.3, 1.2, 0.3]), { mat: "silverD", soft: 0.001, only: ["robe"] });
    // fitted sleeves with long black gloves, silver cuffs
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      wrap(sc, RG.seg(lerp(a.S, a.E, 0.4), lerp(a.E, a.W, 0.55), 0.075), "robe", 0.006 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.5), add(a.W, mul(a.dir, 0.02)), 0.075), "glove", 0.007 * q);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.05 * P.hand), "glove", 0.003 * q);
      sc.add(S.cyl(0.008, 0.041, 0.003), { mat: "silver", p: lerp(a.E, a.W, 0.52), R: rotY2(...a.dir), bone: "fore" + n, k: 0.002 });
    }
    // silver crescent pauldron on the left shoulder: a dome, two lames, a crescent badge
    {
      const a = armJoints(P, 1), pc = [0.16, P.shY - 0.004, -0.01], pe = S.ell(0.07, 0.06, 0.08);
      sc.add(S.custom((x, y, z) => Math.max(pe.f(x, y, z), -0.03 - y), [-0.07, -0.03, -0.08, 0.07, 0.06, 0.08]), { mat: "silver", p: pc, bone: "armL", bones: [["armL", 0.7], ["chest", 0.3]], k: 0.003 });
      sc.add(S.ell(0.068, 0.02, 0.078), { mat: "silverD", p: add(pc, [0.012, -0.035, 0]), r: [0, 0, -0.5], bone: "armL", k: 0.002 });
      sc.add(S.arc(0.02, 0.005, 2.1), { mat: "silverD", p: add(pc, [0.02, 0.012, 0.074]), r: [0, 0.35, 0], bone: "armL", k: 0.001, vdil: 0.6 });
      void a;
    }
    // ---- cloth: black floor-length robe, sash, white mantle with a fallen hood, white cloak
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, y1 = 0.004, r0 = 0.09, r1 = 0.19, szs = 0.84, h = y0 - y1, zc = -0.004;
    const rAt = (u) => mix(r0, r1, Math.pow(u, 0.62));
    const skirtS = S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), a = Math.atan2(z / szs, x);
      return Math.max((Math.hypot(x, z / szs) - rAt(u) - 0.008 * u * Math.sin(a * 8 + 0.6)) * 0.85, y, -y - h);
    }, [-r1 - 0.02, -h, -(r1 + 0.02) * szs, r1 + 0.02, 0, (r1 + 0.02) * szs]);
    const sk = sc.add(skirtS, { mat: "robe", p: [0, y0, zc], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.6, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    // a silver-edged front panel and hem
    const panel = (y) => 0.024 + 0.028 * clamp((y0 - y) / h, 0, 1);
    sc.paint(S.custom((x, y, z) => (z > 0.03 ? Math.abs(Math.abs(x) - panel(y)) - 0.006 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "silverD", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - (y1 + 0.022)) - 0.006, [-1, -1, -1, 1, 1, 1]), { mat: "silverD", soft: 0.001, only: ["robe"] });
    // sash with a silver diamond clasp and a hanging silver charm
    const yb = y0 + 0.004, sash = S.custom((x, y, z) => Math.max(Math.hypot(x, (z - zc) / 0.84) - 0.1, Math.abs(y - yb) - 0.02), pad([-0.11, yb - 0.03, -0.1, 0.11, yb + 0.03, 0.1], 0.01));
    sc.add(sash, { mat: "sash", p: [0, 0, 0], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.003, cs: 0.03, wg: 3 });
    sc.add(S.custom((x, y, z) => Math.max((Math.abs(x) + Math.abs(y)) * 0.7071 - 0.014, Math.abs(z) - 0.004), [-0.022, -0.022, -0.006, 0.022, 0.022, 0.006]), { mat: "silver", p: [0, yb, zc + 0.088], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.001, vdil: 0.6 });
    const ch0 = sc.add(S.chain([[0.024, yb - 0.01, zc + 0.086, 0.0035], [0.03, yb - 0.08, zc + 0.1, 0.0035]]), { mat: "silver", p: [0, 0, 0], bone: "root", k: 0.001, vdil: 0.6 });
    ch0.wfn = sk.wfn;
    sc.add(S.custom((x, y, z) => Math.max((Math.abs(x) + Math.abs(y) * 0.6) * 0.7071 - 0.01, Math.abs(z) - 0.004), [-0.02, -0.03, -0.006, 0.02, 0.03, 0.006]), { mat: "silver", p: [0.031, yb - 0.1, zc + 0.104], bone: "root", k: 0.001, vdil: 0.6 }).wfn = sk.wfn;
    // white mantle over the shoulders, open at the front, a grey hem
    const mTop = P.neck[0] + 0.018 * q, mBot = P.chest[0] - 0.035 * q;
    bell(sc, mTop, mBot, P.neck[2] * 2.0, P.shX + P.delt * 1.35, "white", { t: 0.0075, sz: (P.chest[3] * 1.8) / (P.shX + P.delt), folds: 8, amp: 0.008 * q, z: -0.014, slit: 0.05 * q, pw: 0.45, bones: [["chest", 1]] });
    sc.paint(S.custom((x, y, z) => Math.max(y - (mBot + 0.01), mBot - 0.012 - y, Math.hypot(x, z) - 0.26, 0.1 - Math.hypot(x, z * 1.3)), [-1, -1, -1, 1, 1, 1]), { mat: "whiteD", soft: 0.001, only: ["white"] });
    // cowl: the fallen hood bunched round the neck, its bag lying on the upper back
    sc.add(S.custom((x, y, z) => Math.hypot(Math.hypot(x, (z + 0.016) / 0.95) - 0.064, (y - (P.neck[0] + 0.016)) * 1.2) - 0.02, pad([-0.1, P.neck[0], -0.1, 0.1, P.neck[0] + 0.06, 0.08])),
      { mat: "white", p: [0, 0, 0], bone: "chest", k: 0.004, bones: [["chest", 0.75], ["neck", 0.25]] });
    const bagC = [0, P.neck[0] - 0.005, -P.chest[3] - 0.06];
    sc.add(S.minus(S.ell(0.085, 0.075, 0.05), S.at(S.ell(0.07, 0.06, 0.04), 0, 0.03, 0.02), 0.01), { mat: "white", p: bagC, r: [-0.35, 0, 0], bone: "chest", k: 0.006 });
    sc.paint(S.ell(0.07, 0.06, 0.04), { mat: "whiteD", p: add(bagC, [0, 0.03, 0.016]), soft: 0.004, only: ["white"] });
    // silver clasps at the collar
    for (const s of [1, -1]) sc.add(S.cyl(0.004, 0.012, 0.002), { mat: "silver", p: [s * 0.05, P.neck[0] + 0.004, P.chest[3] + 0.03], r: [Math.PI / 2 - 0.3, 0, 0], bone: "chest", k: 0.001 });
    // white cloak from the shoulders to the floor, wrapping round the sides; grey lining, silver hem band
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.13, 0.255, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.09, u) - 0.018 * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u) + (0.75 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + 0.01 * (1 + Math.sin(x * 34 + 0.6)) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.31, capeBot, -0.28, 0.31, capeTop, 0.1]), { mat: "white", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.07 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.31, capeBot, -0.28, 0.31, capeTop, 0.1]), { mat: "whiteD", soft: 0.001, only: ["white"] });
    sc.paint(S.custom((x, y, z) => (z > 0.07 ? 1 : y - capeBot - 0.01 * (1 + Math.sin(x * 34 + 0.6)) - 0.014), [-0.31, capeBot, -0.28, 0.31, capeTop, 0.1]), { mat: "silverD", soft: 0.001, only: ["white"] });
    sc.part = "hair";
    hair(sc, P, q);
    sc.part = "body";
    return { sc, P, kind: "humanoid", props: [{ sc: lanternProp(), bone: "lantern", at: hang }] };
  }

  // ------------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = { q1: new EmberVesperThree.Quaternion(), q2: new EmberVesperThree.Quaternion(), q3: new EmberVesperThree.Quaternion(), e: new EmberVesperThree.Euler() });
  function fistM(fig, C, name) {
    const a = armJoints(fig.char.P, name === "handL" ? 1 : -1), h = fig.J[name];
    fig.root.updateMatrixWorld(true);
    return C.toM(fig, h.localToWorld(C.V3(...a.dir).multiplyScalar(0.044 * fig.char.P.hand)));
  }
  /** hang the lantern under the right fist, upright in the figure's frame, swinging by (sx, sz) */
  function hangLantern(fig, C, sx, sz) {
    const { q1, q2, q3, e } = three(), o = fig.J.lantern, h = fig.J.handR;
    if (!o) return;
    const m = fistM(fig, C, "handR").add(C.V3(0, -0.012, 0));
    o.position.copy(h.worldToLocal(C.toW(fig, m)));
    h.getWorldQuaternion(q1).invert();
    fig.root.getWorldQuaternion(q2);
    q3.setFromEuler(e.set(sx, -0.3, sz));
    o.quaternion.copy(q1.multiply(q2).multiply(q3));
    o.updateMatrixWorld(true);
  }

  function pose(fig, clip, t, T, C) {
    const V = C.V3, br = Math.sin((T * C.TAU) / 3.4);
    const shift = (x, y, z) => fig.J.root.position.add(V(x, y, z));
    C.base(fig, "idle", 0, T);
    // hair and cloak stir in a wind from ahead
    C.addRot(fig, "hairB1", 0.12 + 0.05 * Math.sin(T * 1.9), 0, 0.05 * Math.sin(T * 1.3)); C.addRot(fig, "hairB2", 0.1 + 0.06 * Math.sin(T * 2.3 + 0.7), 0, 0);
    for (const s of ["L", "R"]) C.addRot(fig, "cape2" + s, 0.06 + 0.04 * Math.sin(T * 1.8 + (s === "L" ? 0 : 1.2)), 0, 0);
    fig.root.updateMatrixWorld(true);
    const shL = C.toM(fig, C.wpos(fig.J.armL)), shR = C.toM(fig, C.wpos(fig.J.armR));
    // idle: the lantern carried low and forward on the right, the left hand at his side
    let rh = V(shR.x - 0.02, shR.y - 0.25 + 0.006 * br, shR.z + 0.15), lh = V(shL.x + 0.05, shL.y - 0.27, shL.z + 0.05);
    let sx = 0.06 * Math.sin(T * 1.9), sz = 0.05 * Math.sin(T * 1.4), glow = 0.12 * (0.5 + 0.5 * Math.sin(T * 2.1)), face = null, done;
    if (clip === "idle") done = true;
    else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      C.addRot(fig, "spine", -0.22 * k, 0, 0.12 * k); C.addRot(fig, "chest", -0.28 * k, 0, 0.08 * k); C.addRot(fig, "head", -0.3 * k, 0.2 * k, 0.12 * k);
      shift(0, -0.02 * k, -0.05 * k);
      rh.add(V(-0.03 * k, 0.05 * k, -0.06 * k)); lh.add(V(0.05 * k, 0.08 * k, 0.02 * k));
      sx -= 0.6 * k; glow *= 1 - 0.8 * k;
      face = t < 0.45 ? "hurt" : null; done = t < 0.6;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      C.addRot(fig, "chest", -0.1 * up, 0, 0); C.addRot(fig, "head", -0.2 * up, 0, 0);
      rh.lerp(V(shR.x - 0.02, shR.y + 0.28, shR.z + 0.08), up);
      glow += 1.0 * up; sx += 0.12 * Math.sin(t * 7) * up;
      face = up > 0.3 ? "closed" : null; done = t < 1.6;
    } else if (clip === "attack") {
      // swing the lantern back past the hip, left hand raised to point the way (0-0.3) → sweep it up and out at the
      // target at arm's length, the soul-light leaves the lantern at 0.42 → hold → lower it
      const back = C.bump(0.02, 0.28, 0.32, 0.4, t), th = C.bump(0.32, 0.42, 0.62, 1.05, t), rel = C.bump(0.4, 0.43, 0.5, 0.75, t);
      const point = C.bump(0.05, 0.3, 0.7, 1.05, t);
      C.addRot(fig, "root", 0.04 * th, -0.3 * back + 0.22 * th, 0);
      shift(0, -0.012 * back - 0.02 * th, -0.02 * back + 0.05 * th);
      C.addRot(fig, "spine", -0.05 * back + 0.08 * th, -0.1 * back + 0.08 * th, 0);
      C.addRot(fig, "chest", -0.06 * back + 0.06 * th, -0.12 * back + 0.1 * th, 0);
      C.addRot(fig, "head", 0.05 * back - 0.06 * th, 0.2 * back - 0.12 * th, 0);
      C.addRot(fig, "thighR", -0.25 * th, 0, 0); C.addRot(fig, "shinR", 0.15 * th, 0, 0);
      fig.root.updateMatrixWorld(true);
      const sL = C.toM(fig, C.wpos(fig.J.armL)), sR = C.toM(fig, C.wpos(fig.J.armR)), reach = (fig.char.P.upArm + fig.char.P.foreArm) * 0.95;
      const low = V(sR.x - 0.02, sR.y - 0.25 + 0.006 * br, sR.z + 0.15);
      rh = low.lerp(V(sR.x - 0.08, sR.y - 0.2, sR.z - 0.14), back).lerp(V(sR.x + 0.04, sR.y + 0.02, sR.z + reach), th);
      lh = V(sL.x + 0.05, sL.y - 0.27, sL.z + 0.05).lerp(V(sL.x + 0.02, sL.y - 0.02, sL.z + reach * 0.9), point);
      sx += 0.55 * back - 0.6 * th + 0.2 * rel; glow += 0.4 * back + 1.5 * rel;
      face = t > 0.04 && t < 0.36 ? "focus" : th > 0.3 ? "fierce" : null; done = t < 1.2;
    } else return undefined;
    fig.root.updateMatrixWorld(true);
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, rh), C.toW(fig, V(shR.x - 0.35, shR.y - 0.2, shR.z - 0.2)), 1);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, lh), C.toW(fig, V(shL.x + 0.3, shL.y - 0.25, shL.z - 0.15)), 1);
    hangLantern(fig, C, sx, sz);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    return done;
  }

  return {
    cards: ["soulguide"], kind: "humanoid", build, pose, scale: 1.05,
    face: { kind: "human", look: { eye: 0x8e96c4, brow: "#8a8e9e", lash: "#2a2a34", lip: "#b8867c", skinD: "#d6b0a0" } },
    moves: { attack: { clip: "guide", hit: 0.42, length: 1.2, style: "bolt", ranged: true, windup: 280, emitter: { bone: "lantern", offset: [0, -0.115, 0] } } },
  };
})());
