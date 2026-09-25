/* 夜幕刺客 — Nightfall Assassin (card assassin): a lithe hooded killer in black leather — charcoal hood with a pointed
 * peak and a silver star pin, a black scarf wound up to the chin, a strapped leather cuirass with a plated left
 * shoulder, a long black cloak lined in blood red, and one oversized silver dagger with a spiked guard (the signature
 * at board scale). Her attack is a low lunge with a backhand slash from the left shoulder out past the right hip. */
EmberVoxelKit.define("assassin", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, bell, strand, onEll } = K;
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];

  // 4-pointed star in the XY plane (half span a, arm half-width b), ±d thick
  const star4 = (a, b, d) => S.custom((x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    return Math.max(Math.min(ax / b + ay / a, ax / a + ay / b) * b - b, Math.abs(z) - d);
  }, [-a, -a, -d, a, a, d]);

  // ------------------------------------------------------------ prop: the dagger (grip at 0, blade along +Y)
  const BLADE0 = 0.048, BLADE = 0.2;
  function dagger() {
    const sc = new Sculpture(), PX = EmberVoxelKit.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      steel: { c: 0xd4dde6, rough: 0.2, metal: 1, cls: CLS.metal, vary: 0.02 }, steelD: { c: 0x7d8894, rough: 0.3, metal: 1, cls: CLS.metal },
      silver: { c: 0xaab4c0, rough: 0.3, metal: 1, cls: CLS.metal }, grip: { c: 0x2a2226, rough: 0.8, cls: CLS.leather },
    });
    const o = { bone: "p" };
    // wrapped grip through the fist, pommel knob
    sc.limb([0, -0.045, 0], [0, 0.03, 0], 0.0085, 0.0085, { ...o, mat: "grip", k: 0.002 });
    sc.add(S.sphere(0.013), { ...o, mat: "silver", p: [0, -0.052, 0], k: 0.002 });
    // guard: a flat bar with three spikes a side, swept toward the blade
    sc.add(S.box(0.036, 0.007, 0.009, 0.002), { ...o, mat: "silver", p: [0, 0.038, 0], k: 0.002 });
    if (PX) for (const s of [1, -1]) sc.limb([s * 0.03, 0.038, 0], [s * 0.05, 0.068, 0], 0.01, 0.005, { ...o, mat: "silver", k: 0.002 });   // pixel: one fat spike a side
    else for (const s of [1, -1]) {
      sc.limb([s * 0.03, 0.038, 0], [s * 0.052, 0.07, 0], 0.0065, 0.0022, { ...o, mat: "silver", k: 0.002, vdil: 0.5 });
      sc.limb([s * 0.03, 0.036, 0], [s * 0.058, 0.03, 0], 0.005, 0.002, { ...o, mat: "silver", k: 0.002, vdil: 0.5 });
      sc.limb([s * 0.014, 0.04, 0], [s * 0.022, 0.066, 0], 0.005, 0.002, { ...o, mat: "silver", k: 0.002, vdil: 0.5 });
    }
    // long leaf blade, a slight curve toward -X, a dark fuller down the middle
    const bw = 0.031;
    const cx = (u) => -0.012 * u * u;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / BLADE, 0, 1), w = bw * Math.pow(Math.max(0, 1 - u), 0.7) * (0.8 + 0.35 * Math.sin(Math.PI * Math.min(1, u * 2.2))) + 0.0012;
      const X = x - cx(u), dz = PX ? Math.abs(z) - (0.011 * (1 - 0.5 * u) + 0.004) : Math.abs(z) - (0.0075 * (1 - u) + 0.0022) * (1 - 0.55 * Math.min(1, Math.abs(X) / w));
      return Math.max((Math.abs(X) - w) * 0.8, dz, -y, y - BLADE);
    }, [-bw - 0.02, 0, -0.016, bw + 0.004, BLADE, 0.016]);
    sc.add(blade, { ...o, mat: "steel", p: [0, BLADE0, 0], k: 0.001 });
    if (!PX) sc.paint(S.custom((x, y, z) => { const u = (y - BLADE0) / BLADE; return u < 0.03 || u > 0.62 ? 1 : Math.abs(x - cx(u)) - 0.0035; }, [-0.04, BLADE0, -0.01, 0.04, BLADE0 + BLADE, 0.01]),
      { mat: "steelD", p: [0, 0, 0], soft: 0.0005, only: ["steel"] });
    return sc;
  }

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25, PX = K.pixel;   // PX: pixel sprite — fewer straps, clear value steps
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.004, capeBot = 0.16, capeZ = -P.chest[3] - 0.03;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    mats(sc, {
      skin: { c: 0xf0d6cc, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd4aea2, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb07a78, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x2c2b38, rough: 0.6, cls: CLS.hair, vary: 0.12 },
      hood: { c: 0x575866, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, hoodIn: { c: 0x1c1b22, rough: 0.9, cls: CLS.cloth },
      scarf: { c: 0x3a3944, rough: 0.9, cls: CLS.cloth, vary: 0.05 },
      suit: { c: PX ? 0x2a2932 : 0x3b3a45, rough: 0.7, cls: CLS.leather, vary: 0.05 },
      armor: { c: PX ? 0x62646f : 0x565866, rough: 0.45, cls: CLS.leather, vary: 0.06 }, armorD: { c: 0x30303a, rough: 0.5, cls: CLS.leather },
      strap: { c: 0x25242b, rough: 0.6, cls: CLS.leather },
      silver: { c: 0xb4bfcc, rough: 0.28, metal: 1, cls: CLS.metal }, plate: { c: 0x5a606e, rough: 0.35, metal: 0.8, cls: CLS.metal, vary: 0.03 },
      cloak: { c: 0x4c4a58, rough: 0.9, cls: CLS.cloth, vary: 0.05 }, lining: { c: 0x9a2230, rough: 0.85, cls: CLS.cloth, vary: 0.05 },
      boots: { c: PX ? 0x2a2932 : 0x34333c, rough: 0.55, cls: CLS.leather, vary: 0.06 },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.95, legX = 0.17;
    // ---- black leather bodysuit, cuirass, belts
    const armRg = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.3)), a.W, 0.08); });
    wrap(sc, RG.or(RG.box(-X0, X0, -0.02, P.neck[0] + 0.02), ...armRg), "suit", 0.003 * q);
    wrap(sc, RG.box(-X0, X0, P.waist[0] - 0.03, P.chest[0] + 0.05), "armor", 0.007 * q);
    if (!PX) for (const y of [P.chest[0] - 0.035, P.waist[0] + 0.005]) wrap(sc, RG.box(-X0, X0, y - 0.004, y + 0.004), "armorD", 0.0085 * q);
    // cross strap over the chest (right shoulder to left hip) with a silver ring
    {
      const A = [-P.shX * 0.75, P.shY + 0.01, 0], B0 = [P.pelvis[1] * 0.9, P.waist[0] - 0.02, 0];
      const d = norm(sub(B0, A)), n = norm([d[1], -d[0], 0]);
      wrap(sc, RG.band(A, n, 0.0075 * q, RG.box(-X0, X0, P.waist[0] - 0.03, P.shY + 0.05)), "strap", 0.0095 * q);
      if (!PX) sc.add(S.torus(0.01, 0.0035), { mat: "silver", p: [0.002, P.chest[0] + 0.012, P.chest[3] + 0.034], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.001 });
    }
    wrap(sc, RG.box(-0.25, 0.25, P.pelvis[0] + 0.02, P.pelvis[0] + 0.036), "strap", 0.006 * q);
    if (!PX) wrap(sc, RG.band([0, P.pelvis[0] - 0.005, 0], [-0.2, 1, 0], 0.007 * q, RG.box(-0.2, 0.2, P.pelvis[0] - 0.06, P.waist[0])), "strap", 0.005 * q);
    if (!PX) sc.add(S.box(0.012, 0.01, 0.004, 0.002), { mat: "silver", p: [0, P.pelvis[0] + 0.028, P.pelvis[3] + 0.028], bone: "root", k: 0.001 });
    for (const s of [1, -1]) sc.add(S.box(0.018, 0.02, 0.012, 0.005), { mat: "armor", p: [s * P.pelvis[1] * 0.85, P.pelvis[0] - 0.01, P.pelvis[3] * 0.5], r: [0, s * 0.5, 0], bone: "root", k: 0.003 });
    // ---- limbs: bracers with silver studs, fingerless dark gloves, knee guards, tall boots
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.1), a.W, 0.08), "armor", 0.007 * q);
      if (!PX) for (const u of [0.25, 0.75]) wrap(sc, RG.seg(lerp(a.E, a.W, u - 0.035), lerp(a.E, a.W, u + 0.035), 0.08), "strap", 0.0085 * q);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.065 * P.hand), "strap", 0.0025 * q);
      sc.add(S.ell(0.034, 0.03, 0.022), { mat: "armor", p: add(l.K, [0, 0.006, 0.036]), bone: "shin" + n, k: 0.003 });
      if (!PX) sc.add(S.sphere(0.006), { mat: "silver", p: add(l.K, [0, 0.008, 0.058]), bone: "shin" + n, k: 0.001 });
      const bootTop = P.kneeY - 0.012;
      wrap(sc, RG.box(s > 0 ? 0 : -legX, s > 0 ? legX : 0, -0.02, bootTop), "boots", 0.006 * q);
      wrap(sc, RG.box(s > 0 ? 0 : -legX, s > 0 ? legX : 0, bootTop - 0.014, bootTop), "strap", 0.0075 * q);
      if (!PX) wrap(sc, RG.box(s > 0 ? 0 : -legX, s > 0 ? legX : 0, P.ankY + 0.02, P.ankY + 0.032), "strap", 0.0075 * q);
    }
    // plated left shoulder: two overlapping lames (the right one is bare leather, as on the card)
    {
      const a = armJoints(P, 1);
      sc.add(S.custom((x, y, z) => Math.max(S.ell(0.062, 0.05, 0.064).f(x, y, z), -0.02 - y), [-0.062, -0.02, -0.064, 0.062, 0.05, 0.064]), { mat: "plate", p: [a.S[0] + 0.012, a.S[1] + 0.006, -0.004], r: [0, 0, -0.35], bone: "armL", k: 0.002 });
      sc.add(S.custom((x, y, z) => Math.max(S.ell(0.058, 0.04, 0.06).f(x, y, z), -0.012 - y), [-0.058, -0.012, -0.06, 0.058, 0.04, 0.06]), { mat: "armorD", p: [a.S[0] + 0.03, a.S[1] - 0.03, -0.004], r: [0, 0, -0.55], bone: "armL", k: 0.002 });
      if (!PX) sc.add(S.sphere(0.006), { mat: "silver", p: [a.S[0] + 0.01, a.S[1] + 0.058, 0.02], bone: "armL", k: 0.001 });
    }
    // ---- hair: dark fringe and cheek locks inside the hood
    sc.part = "hair";
    {
      const ey = P.eyeY, C = add(P.cranC, [0, 0.003, -0.004]), cr = P.cran, R = [cr[0] * 1.06, cr[1] * 1.06, cr[2] * 1.07];
      sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
      if (PX) for (const u of [-1, 0, 1]) {   // pixel: three fat locks, tips above the eye band in the middle
        const root = [0.012 * u, C[1] + R[1] * 0.62, C[2] + R[2] * 0.72];
        const mid = [R[0] * 0.42 * u + 0.006, ey + 0.045, P.faceZ + 0.004 * q];
        const tip = [R[0] * (0.75 * u + 0.05), ey + 0.028 - 0.03 * Math.abs(u), P.faceZ - 0.016 * q * Math.abs(u)];
        strand(sc, [root, mid, tip], 0.019 * q, 0.004 * q, { k: 0.008, taper: 1.2, grooves: 0 });
      }
      else for (let i = 0; i < 6; i++) {
        const u = (i / 5) * 2 - 1;
        const root = [0.012 * u, C[1] + R[1] * 0.62, C[2] + R[2] * 0.72];
        const mid = [R[0] * 0.42 * u + 0.006, ey + 0.04, P.faceZ + 0.004 * q];
        const tip = [R[0] * (0.6 * u + 0.1), ey + 0.012 - 0.01 * Math.abs(u), P.faceZ - 0.012 * q * Math.abs(u)];
        strand(sc, [root, mid, tip], 0.012 * q, 0.0018 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
      }
      for (const s of [1, -1]) {
        const root = onEll(C, R, s * 1.1, 0.25, 0.98), tip = [s * R[0] * 0.98, P.chinY + 0.006, C[2] + R[2] * 0.5];
        strand(sc, [root, add(lerp(root, tip, 0.5), [s * 0.006, 0, 0]), tip], 0.013 * q, 0.002 * q, { k: 0.007, taper: 1.1, grooves: 0.001 });
      }
    }
    // ---- cloth: hood, scarf, capelet, cloak
    sc.part = "cloth";
    // hood: a deep cowl over the skull with a pointed peak over the brow, open over the face, falling to the shoulders
    const hc = add(P.cranC, [0, -P.cran[1] * 0.04, -P.cran[2] * 0.08]), hr = [P.cran[0] * 1.3, P.cran[1] * 1.22, P.cran[2] * 1.28], ht = 0.0075;
    const hoodShape = (e) => S.union(S.union(S.ell(hr[0] - e, hr[1] - e, hr[2] - e), S.at(S.ell(hr[0] * 0.98 - e, hr[1] * 0.9 - e, hr[2] * 0.78 - e), 0, -hr[1] * 0.78, -hr[2] * 0.3), 0.03),
      S.at(S.ell(0.03 - e * 0.5, 0.04 - e * 0.5, 0.06 - e * 0.5), 0, hr[1] * 0.78, hr[2] * 0.08), 0.035);
    const faceOpen = S.at(S.ell(P.face[0] * 1.32, (P.crown - P.chinY) * 0.56, 0.12), 0, (P.eyeY - hc[1]) - 0.012, (P.faceZ - hc[2]) + 0.1 - 0.03);
    const hood = S.minus(S.minus(hoodShape(0), hoodShape(ht * 2), 0), faceOpen, 0.004);
    const hp = sc.add(hood, { mat: "hood", p: hc, bone: "head", k: 0.006, cs: 0.03 });
    hp.wfn = (x, y) => { const u = sstep(P.chinY, P.neck[0] - 0.01, y); return [["head", 1 - u], ["neck", u * 0.5], ["chest", u * 0.5]]; };
    sc.paint(hoodShape(ht), { mat: "hoodIn", p: hc, soft: 0.002, only: ["hood"] });
    // silver star pin on the hood's peak
    sc.add(star4(0.026, 0.007, 0.004), { mat: "silver", p: add(hc, [0, hr[1] * 0.55, hr[2] * 0.86]), r: [-0.55, 0, 0], bone: "head", k: 0.001, vdil: 0.5, part: "body" });
    // scarf: two thick rolls wound round the neck up to the chin, a tail down the chest
    for (const [y, r, t] of [[P.neck[0] + 0.012, 0.056, 0.022], [P.chinY + 0.004, 0.05, 0.02]]) {
      const pr = sc.add(S.custom((x, yy, z) => Math.hypot(Math.hypot(x, (z + 0.006) / 0.95) - r - (PX ? 0 : 0.003) * Math.sin(Math.atan2(x, z) * 6), (yy - y) * 1.2) - t, pad([-0.09, y - 0.03, -0.09, 0.09, y + 0.03, 0.09], 0.02)),
        { mat: "scarf", p: [0, 0, 0], bone: "neck", k: 0.006 });
      pr.wfn = (x, yy) => { const u = sstep(P.neck[0], P.chinY + 0.01, yy); return [["chest", 0.6 * (1 - u)], ["neck", 0.4 + 0.2 * u], ["head", 0.4 * u]]; };
    }
    strand(sc, [[0.03, P.neck[0] + 0.005, 0.07], [0.045, P.chest[0] + 0.02, P.chest[3] + 0.03], [0.05, P.chest[0] - 0.06, P.chest[3] + 0.028]], 0.02, 0.012, { mat: "scarf", bone: "chest", k: 0.006, grooves: 0, flat: 1 });
    // capelet over the shoulders, the long cloak behind, lined in red
    bell(sc, P.neck[0] + 0.02, P.chest[0] - 0.02, P.neck[2] * 1.9, P.shX + P.delt * 1.2, "cloak", { t: 0.0075, sz: (P.chest[3] * 1.8) / (P.shX + P.delt), folds: 9, amp: PX ? 1e-6 : 0.006, z: -0.012, slit: 0.05, pw: 0.45, bones: [["chest", 1]] });
    const ch = capeTop - capeBot, tear = PX
      ? (u) => { const f = u / 3 - Math.floor(u / 3); return 0.9 * (1 - Math.abs(2 * f - 1)); }   // pixel: a few big regular teeth
      : (u) => { const k = Math.floor(u), f = u - k; return (1 - Math.abs(2 * f - 1)) * (0.4 + 0.6 * Math.abs(Math.sin(k * 12.9898) * 43758.5 % 1)); };
    const capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.12, 0.29, Math.pow(u, 0.75));
      return { u, w, zc: mix(capeZ, capeZ - 0.1, u) - (PX ? 0.006 : 0.016) * Math.sin((x / w) * (PX ? 2 : 5) * 1.57 + 0.5) * (0.25 + u) + (0.75 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + 0.06 * tear(x * 22 + 5) + 0.03 * sstep(0.05, 0.25, -x) - y), 0.005); };
    const cp = sc.add(S.custom(capeF, pad([-0.31, capeBot, -0.3, 0.31, capeTop, 0.1])), { mat: "cloak", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (y > capeTop + 0.01 || z > 0.1 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.31, capeBot, -0.3, 0.31, capeTop, 0.1]), { mat: "lining", p: [0, 0, 0], soft: 0.001, only: ["cloak"] });
    sc.part = "body";
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [{ sc: dagger(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  // ------------------------------------------------------------ motion
  const HIT = 0.4, LEN = 1.1;
  /* the shared idle, then: a knife-ready guard (dagger forward and low, left hand open by the hip), and the attack —
   * coil low with the dagger cocked over the left shoulder (0-0.3), lunge and whip it backhand across and out past
   * the right hip (0.3-0.44), hold the follow-through, recover (→1.05) */
  function pose(fig, clip, t, T, C) {
    if (clip === "hurt" || clip === "victory") return undefined;
    C.base(fig, "idle", 0, T);
    const V = C.V3, P = fig.char.P, br = Math.sin((T * C.TAU) / 3.4), J = fig.J;
    const reach = P.upArm + P.foreArm;
    let wind = 0, th = 0, face = null;
    if (clip === "attack") {
      wind = C.bump(0, 0.28, 0.3, 0.4, t); th = C.bump(0.3, 0.42, 0.6, 1.05, t);
      C.addRot(fig, "root", 0.08 * th, 0.5 * wind - 0.2 * th, 0);
      C.off(fig, "root", 0, -0.05 * wind - 0.07 * th, -0.03 * wind + 0.12 * th);
      C.addRot(fig, "spine", 0.1 * wind + 0.14 * th, 0.2 * wind - 0.1 * th, 0);
      C.addRot(fig, "chest", 0.06 * th, 0.3 * wind - 0.15 * th, 0.06 * wind);
      C.addRot(fig, "head", -0.08 * wind - 0.1 * th, -0.5 * wind + 0.35 * th, 0);
      C.rot(fig, "thighL", -0.85 * th - 0.35 * wind, 0, -0.08); C.rot(fig, "shinL", 0.7 * th + 0.55 * wind, 0, 0); C.rot(fig, "footL", 0.15 * th, 0, 0);
      C.rot(fig, "thighR", 0.5 * th + 0.2 * wind, 0, 0.08); C.rot(fig, "shinR", 0.45 * th + 0.4 * wind, 0, 0); C.rot(fig, "footR", -0.3 * th, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.18 * th + 0.08 * wind, 0, 0); C.rot(fig, "cape2" + s, 0.18 * th, 0, 0); }
      face = t > 0.06 && t < 0.95 ? "fierce" : null;
    } else {
      // idle: a slight crouch, weight forward
      C.addRot(fig, "root", 0.05, 0, 0); C.off(fig, "root", 0, -0.012, 0);
      C.rot(fig, "thighL", -0.2, 0, -0.05); C.rot(fig, "shinL", 0.3, 0, 0); C.rot(fig, "footL", -0.08, 0, 0);
      C.rot(fig, "thighR", 0.1, 0, 0.05); C.rot(fig, "shinR", 0.22, 0, 0); C.rot(fig, "footR", -0.3, 0, 0);
      C.addRot(fig, "head", 0.06, 0, 0);
    }
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    // right hand: guard point ⇄ slash arc (angle a from forward, + toward her left; high on the left, low on the right)
    const guard = V(shR.x + 0.02, shR.y - 0.2 + 0.004 * br, shR.z + 0.15);
    let hand = guard, aim = V(-0.55, 0.75, 0.5).normalize(), fc = V(0.2, 0, 1);
    const k = Math.max(wind, th);
    if (k > 0.001) {
      const a = 1.4 - 2.55 * C.sstep(0.31, 0.49, t) + 0.5 * C.sstep(0.62, 1.0, t);
      const piv = V(shR.x + 0.06, shR.y - 0.04, shR.z + 0.02), r = reach * 0.86;
      const arc = V(piv.x + r * Math.sin(a), piv.y + 0.09 * Math.sin(a) - 0.04 * (1 - Math.cos(a)), piv.z + r * Math.cos(a) * (a > 0 ? 0.55 : 1));
      hand = guard.clone().lerp(arc, k);
      aim = aim.clone().lerp(V(Math.sin(a) * 1.2, 0.05, Math.cos(a)).normalize(), k).normalize();
    }
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V(shR.x - 0.3, shR.y - 0.25, shR.z - 0.05)), 1);
    fc.lerp(V(0, 1, 0), k);
    C.aimGrip(fig, "handR", [aim.x, aim.y, aim.z], [fc.x, fc.y, fc.z], 1);
    // left hand: open by the hip ⇄ thrown back for balance during the lunge
    const lh = V(shL.x + 0.08, shL.y - 0.24 + 0.004 * br, shL.z + 0.06).lerp(V(shL.x + 0.2, shL.y - 0.1, shL.z - 0.14), th).lerp(V(shL.x + 0.02, shL.y - 0.16, shL.z + 0.14), wind);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, lh), C.toW(fig, V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2)), 1);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return clip === "idle" ? true : t < LEN;
  }

  return {
    cards: ["assassin"], kind: "humanoid", build, pose, scale: 0.95,
    face: { kind: "human", look: { eye: 0x5f7394, brow: "#1e1c24", lash: "#0f0e14", lip: "#a8716e", skinD: "#d8b2a6" } },
    moves: { attack: { clip: "slash", hit: HIT, length: LEN, style: "slash", trail: { prop: "spear", from: [0, BLADE0 + 0.03, 0], to: [0, BLADE0 + BLADE, 0] } } },
  };
})());
