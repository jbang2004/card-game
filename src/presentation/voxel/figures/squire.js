/* 晨曦侍从 — Dawn Squire (card squire): a young squire of the dawn — brown hair tied back in a ponytail, no helm,
 * a white-gold breastplate with a gold sun on it over a brown arming coat, gold-rimmed pauldrons, a white skirt with
 * a gold front panel and a short white cape — and, raised on her left arm, a big round white shield with a gold sun
 * (the signature at board scale). A short arming sword in the right hand; the attack is a diagonal downward slash
 * from over the right shoulder, the shield held forward. The shield has its own bone: pose() carries it on the fist. */
EmberVoxelKit.define("squire", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm, cross,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const V = 0.0125;
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // sun: disc r0 with n pointed rays out to r1 (2-D, XY)
  const sun2 = (x, y, r0, r1, n, w) => {
    const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2, f = 1 - Math.abs(((((a / (2 * Math.PI)) * n) % 1) + 1) % 1 - 0.5) * 2;   // 0 on a ray's axis
    return Math.min(r - r0, Math.max(r - (r0 + (r1 - r0) * Math.max(0, 1 - f / w)), r0 * 0.5 - r));
  };

  // ------------------------------------------------------------ prop: short arming sword (grip at 0, blade along +Y)
  const B0 = 0.045, BL = 0.24;
  function sword() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      steel: { c: 0xe2eaf8, rough: 0.3, metal: 0.7, cls: CLS.metal, vary: 0.02 }, steelD: { c: 0x8a96a8, rough: 0.3, metal: 1, cls: CLS.metal },
      gold: { c: 0xd8a844, rough: 0.3, metal: 1, cls: CLS.metal }, grip: { c: 0x5a3a26, rough: 0.8, cls: CLS.leather },
    });
    const o = { bone: "p" };
    sc.limb([0, -0.042, 0], [0, 0.03, 0], 0.0085, 0.0085, { ...o, mat: "grip", k: 0.002 });
    sc.add(S.sphere(0.012), { ...o, mat: "gold", p: [0, -0.05, 0], k: 0.002 });
    sc.add(S.box(0.045, 0.007, 0.009, 0.003), { ...o, mat: "gold", p: [0, 0.036, 0], k: 0.002 });
    for (const s of [1, -1]) sc.add(S.sphere(0.008), { ...o, mat: "gold", p: [s * 0.045, 0.04, 0], k: 0.002 });
    const bw = 0.02;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / BL, 0, 1), w = bw * (u < 0.8 ? 1 - 0.15 * u : (1 - 0.15 * 0.8) * (1 - (u - 0.8) / 0.2)) + 0.0012;
      const dz = Math.abs(z) - (0.006 * (1 - 0.6 * Math.min(1, Math.abs(x) / w)) + 0.0015);
      return Math.max(Math.abs(x) - w, dz, -y, y - BL);
    }, [-bw - 0.004, 0, -0.008, bw + 0.004, BL, 0.008]);
    sc.add(blade, { ...o, mat: "steel", p: [0, B0, 0], k: 0.001 });
    sc.paint(S.custom((x, y, z) => { const u = (y - B0) / BL; return u < 0.02 || u > 0.7 ? 1 : Math.abs(x) - 0.003; }, [-0.03, B0, -0.01, 0.03, B0 + BL, 0.01]),
      { mat: "steelD", soft: 0.0005, only: ["steel"] });
    return sc;
  }

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25;
    humanoidBones(sc, P);
    const capeTop = P.shY - 0.004, capeBot = 0.2, capeZ = -0.105;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.01, -0.09); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.02, -0.12);
    const G = [10 * V, 36 * V, 12 * V];
    sc.bone("shield", "chest", ...G);
    mats(sc, {
      skin: { c: 0xf2d2bc, rough: 0.55, cls: CLS.skin, vary: 0.013 }, skinDeep: { c: 0xd8ac96, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xc07a6c, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x7a5234, rough: 0.6, cls: CLS.hair, vary: 0.1 },
      coat: { c: 0x5a3e2e, rough: 0.8, cls: CLS.cloth, vary: 0.05 },
      plate: { c: 0xdce6f6, rough: 0.28, metal: 0.5, cls: CLS.metal, vary: 0.025 },
      plateD: { c: 0xa8b4cc, rough: 0.32, metal: 0.7, cls: CLS.metal },
      gold: { c: 0xdcaa44, rough: 0.3, metal: 1, cls: CLS.metal, vary: 0.02 },
      cloth: { c: 0xeeeef4, rough: 0.85, cls: CLS.cloth, vary: 0.035 }, clothD: { c: 0xcac6cc, rough: 0.9, cls: CLS.cloth },
      goldC: { c: 0xd8a848, rough: 0.8, cls: CLS.cloth, vary: 0.04 },
      leather: { c: 0x4e3424, rough: 0.6, cls: CLS.leather, vary: 0.06 },
      field: { c: 0xe2e8f4, rough: 0.35, metal: 0.3, cls: CLS.metal, vary: 0.02 },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.95;
    // ---- arming coat over torso and arms
    const armRg = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.3)), lerp(a.E, a.W, 0.5), 0.08); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.05, P.neck[0] + 0.02), ...armRg), "coat", 0.004 * q);
    // ---- plate: bracers, gauntlets, greaves, knee cops, boots
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s), side = s > 0 ? [0, 0.2] : [-0.2, 0];
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.2), lerp(a.E, a.W, 0.97), 0.08), "plate", 0.0065);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.036 * P.hand)), 0.05 * P.hand), "plateD", 0.003);
      sc.limb(lerp(a.E, a.W, 0.84), add(a.W, mul(a.dir, 0.008)), 0.033, 0.037, { mat: "gold", bone: "fore" + n, k: 0.002 });
      wrap(sc, RG.box(...side, P.ankY + 0.028, l.K[1] - 0.01), "plate", 0.008);
      wrap(sc, RG.box(...side, -0.03, P.ankY + 0.028), "plateD", 0.006);
      wrap(sc, RG.box(...side, l.K[1] - 0.01, P.hipY - 0.02), "coat", 0.005);
      sc.add(S.ell(0.034, 0.032, 0.024), { mat: "gold", p: add(l.K, [0, 0.004, 0.036]), bone: "shin" + n, k: 0.003 });
      // pauldron: white dome with a gold rim
      const pc = [s * 0.155, P.shY - 0.004, -0.006], pe = S.ell(0.07, 0.058, 0.078);
      sc.add(S.custom((x, y, z) => Math.max(pe.f(x, y, z), -0.03 - y), [-0.07, -0.03, -0.078, 0.07, 0.058, 0.078]), { mat: "plate", p: pc, bone: "chest", k: 0.003 });
      sc.add(S.custom((x, y, z) => Math.max(Math.abs(pe.f(x, y, z) + 0.004) - 0.006, -0.03 - y, y + 0.014), [-0.085, -0.03, -0.09, 0.085, -0.005, 0.09]), { mat: "gold", p: pc, bone: "chest", k: 0.002 });
    }
    // ---- breastplate with a gold sun, belt with a gold buckle
    sc.add(S.ell(0.112, 0.098, 0.094), { mat: "plate", p: [0, P.chest[0] - 0.004, -0.006], bone: "chest", k: 0.004 });
    sc.limb([0, P.waist[0] + 0.02, -0.004], [0, P.pelvis[0] + 0.03, -0.004], 0.092, 0.1, { mat: "plate", bone: "spine", k: 0.003, sz: 0.8 });
    const sunC = [0, P.chest[0] + 0.005];
    sc.paint(S.custom((x, y, z) => (z < 0.04 ? 1 : sun2(x - sunC[0], y - sunC[1], 0.02, 0.056, 8, 0.5)), [-0.2, 0.5, -0.2, 0.2, 0.9, 0.2]), { mat: "gold", soft: 0.001, only: ["plate"] });
    // gold neckline rim
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, z / 0.9) - 0.052) - 0.006, Math.abs(y - (P.neck[0] + 0.004)) - 0.008), pad([-0.06, P.neck[0] - 0.01, -0.06, 0.06, P.neck[0] + 0.02, 0.06])),
      { mat: "gold", bone: "chest", k: 0.002 });
    wrap(sc, RG.box(-0.2, 0.2, P.pelvis[0] + 0.012, P.pelvis[0] + 0.034), "leather", 0.009);
    sc.add(S.cyl(0.005, 0.017, 0.002), { mat: "gold", p: [0, P.pelvis[0] + 0.023, P.pelvis[3] + 0.04], r: [Math.PI / 2, 0, 0], bone: "root", k: 0.001 });

    // ---- hair: brown cap, side-swept fringe, locks by the cheeks, a ponytail down the back
    sc.part = "hair";
    {
      const ey = P.eyeY, C = add(P.cranC, [0, 0.01, -0.006]), cr = P.cran, R = [cr[0] * 1.08, cr[1] * 1.1, cr[2] * 1.1];
      sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
      for (let i = 0; i < 6; i++) {
        const u = (i / 5) * 2 - 1;
        const root = [0.02 + 0.012 * u, C[1] + R[1] * 0.64, C[2] + R[2] * 0.72];
        const mid = [R[0] * 0.4 * u - 0.012, ey + 0.045, P.faceZ + 0.004 * q];
        const tip = [R[0] * (0.62 * u - 0.12), ey + 0.016 - 0.01 * Math.abs(u), P.faceZ - 0.012 * q * Math.abs(u)];
        strand(sc, [root, mid, tip], 0.012 * q, 0.0018 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
      }
      for (const s of [1, -1]) {
        const root = onEll(C, R, s * 1.1, 0.25, 0.98), tip = [s * R[0] * 1.0, P.chinY - 0.005, C[2] + R[2] * 0.45];
        strand(sc, [root, add(lerp(root, tip, 0.5), [s * 0.008, 0, 0]), tip], 0.013 * q, 0.003 * q, { k: 0.007, taper: 1.1, grooves: 0.001 });
      }
      // tie at the nape, ponytail
      const tie = [0, C[1] - R[1] * 0.3, C[2] - R[2] * 0.95];
      sc.add(S.sphere(0.024), { mat: "hair", p: tie, bone: "head", k: 0.008 });
      sc.add(S.torus(0.017, 0.006), { mat: "goldC", p: add(tie, [0, -0.012, -0.012]), r: [0.6, 0, 0], bone: "head", k: 0.002 });
      const ctrl = [add(tie, [0, -0.01, -0.012]), [0.01, P.neck[0] + 0.01, -0.13], [0.02, P.chest[0] - 0.01, -0.14], [0.03, P.chest[0] - 0.08, -0.13]];
      const sp = strand(sc, ctrl, 0.026, 0.006, { k: 0.01, wg: 5, swell: 0.3, taper: 1.3, wave: 0.006, wd: [1, 0, 0], grooves: 0.0015 });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.05, P.chest[0] - 0.06, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }

    // ---- cloth: white skirt with a gold front panel, a short white cape
    sc.part = "cloth";
    const y0 = P.pelvis[0] + 0.02, y1 = 0.18, h = y0 - y1, r0 = 0.105, r1 = 0.16, szs = 0.85;
    const sk = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.8)), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - 0.006 * u * Math.sin(a * 9 + 0.6);
      return smax(Math.abs(rr) - 0.006, Math.max(-y - h, y), 0.005);
    }, pad([-r1 - 0.02, -h, -r1 * szs - 0.02, r1 + 0.02, 0, r1 * szs + 0.02], 0.02)), { mat: "cloth", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.45, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => (z < 0.03 ? 1 : Math.abs(x) - 0.03 - 0.02 * clamp((y0 - y) / h, 0, 1)), [-1, -1, -1, 1, 1, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - y1 - 0.007) - 0.0065, [-1, 0, -1, 1, 0.4, 1]), { mat: "goldC", soft: 0.001, only: ["cloth"] });
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.08, 0.2, Math.pow(u, 0.8));
      return { u, w, zc: mix(capeZ, capeZ - 0.06, u) - 0.014 * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u) + (0.55 - 0.25 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + 0.01 * (1 + Math.sin(x * 30 + 0.6)) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.24, capeBot, -0.24, 0.24, capeTop, 0.06]), { mat: "cloth", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    // lining: only the inner half of the cape shell (never the coat), gold hem
    sc.paint(S.custom((x, y, z) => (z > -0.04 || y > capeTop + 0.01 || y < capeBot - 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.24, capeBot, -0.24, 0.24, capeTop, 0.06]), { mat: "clothD", soft: 0.001, only: ["cloth"] });
    sc.paint(S.custom((x, y, z) => (z > -0.04 ? 1 : y - capeBot - 0.01 * (1 + Math.sin(x * 30 + 0.6)) - 0.013), [-0.24, capeBot, -0.24, 0.24, capeTop, 0.06]), { mat: "goldC", soft: 0.001, only: ["cloth", "clothD"] });
    for (const s of [1, -1]) sc.add(S.cyl(0.005, 0.013, 0.002), { mat: "gold", p: [s * 0.06, capeTop - 0.014, capeZc(s * 0.06, capeTop - 0.014).zc - 0.009], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.001, part: "cloth" });
    sc.part = "body";

    // ---- round shield on its own bone (local x across, y up, z out of the face): white field, gold rim, gold sun
    const RS = 0.14, th = V, zf = 4 * V, bul = 0.022, rimW = 0.016;
    const zc = (x, y) => zf - bul * ((x * x + y * y) / (RS * RS));
    const SB = pad([-RS, -RS, zf - bul - th, RS, RS, zf + 2 * th]);
    sc.add(S.custom((x, y, z) => { const o = Math.hypot(x, y) - RS, rim = o > -rimW ? V / 2 : 0; return Math.max(o, Math.abs(z - zc(x, y) - rim) - th - rim); }, SB), { mat: "field", p: G, bone: "shield", k: 0.001, vdil: 0.3 });
    const far = (x, y, z) => Math.hypot(x, y) > RS + 0.02 || Math.abs(z - zf) > 0.06;
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : -(Math.hypot(x, y) - RS + rimW)), SB), { mat: "gold", p: G, soft: 0.001, only: ["field"] });
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(sun2(x, y, 0.034, 0.118, 8, 0.5), zc(x, y) - z)), SB), { mat: "gold", p: G, soft: 0.001, only: ["field"] });
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(z - zc(x, y), Math.hypot(x, y) - RS + rimW)), SB), { mat: "leather", p: G, soft: 0.001, only: ["field"] });
    sc.add(S.sphere(0.024), { mat: "gold", p: add(G, [0, 0, zf + 0.004]), bone: "shield", k: 0.002 });
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [{ sc: sword(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  // ------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = EmberVesperThree);
  function carryShield(fig, C, tilt, yaw, roll, free = 0) {
    const T = three(), J = fig.J, o = J.shield;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    const rootQ = fig.root.getWorldQuaternion(new T.Quaternion());
    const chestM = rootQ.clone().invert().multiply(J.chest.getWorldQuaternion(new T.Quaternion())).slerp(new T.Quaternion(), free);
    const want = chestM.multiply(new T.Quaternion().setFromEuler(new T.Euler(tilt, yaw, roll)));
    const P = fig.char.P, a = K.armJoints(P, 1);
    const handM = rootQ.clone().invert().multiply(J.handL.getWorldQuaternion(new T.Quaternion()));
    const fist = C.toM(fig, C.wpos(J.handL)).add(C.V3(...a.dir).applyQuaternion(handM).multiplyScalar(0.044 * P.hand));
    o.position.copy(o.parent.worldToLocal(C.toW(fig, fist)));
    o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rootQ.multiply(want)));
  }
  const HIT = 0.42, LEN = 1.15;
  /* guard: sword low and forward on the right, shield before the left hip. Attack: raise the sword over the right
   * shoulder, shield up (0-0.28) → step in and cut down diagonally across the front (0.3-0.48, contact 0.42) → hold
   * the follow-through low on the left → recover. The sword swings in the plane of U (up, to her right) and F
   * (forward, to her left); the blade points out along the radius and its edge leads. */
  function pose(fig, clip, t, T, C) {
    const V3 = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.4), atk = clip === "attack";
    const r = C.base(fig, atk ? "idle" : clip, atk ? 0 : t, T);
    const P = fig.char.P, reach = P.upArm + P.foreArm;
    let hx = 0.02, hy = -0.25, hz = 0.13, yaw = 0.25, tilt = -0.05, roll = 0.02, free = 0, k = 0, face = null;
    if (atk) {
      const wind = C.bump(0, 0.28, 0.3, 0.4, t), th = C.bump(0.3, HIT, 0.62, 1.05, t);
      k = C.sstep(0, 0.22, t) * (1 - C.sstep(0.7, 1.05, t));
      C.addRot(fig, "root", 0.02 * th, 0.4 * wind - 0.35 * th, 0);
      J.root.position.add(V3(0, -0.03 * wind - 0.05 * th, -0.03 * wind + 0.1 * th));
      C.addRot(fig, "spine", -0.05 * wind + 0.05 * th, 0.15 * wind - 0.12 * th, 0);
      C.addRot(fig, "chest", -0.06 * wind + 0.04 * th, 0.25 * wind - 0.2 * th, 0);
      C.addRot(fig, "head", -0.05 * th, -0.35 * wind + 0.25 * th, 0);
      C.rot(fig, "thighL", -0.7 * th - 0.2 * wind, 0, -0.05); C.rot(fig, "shinL", 0.5 * th + 0.3 * wind, 0, 0); C.rot(fig, "footL", 0.2 * th, 0, 0);
      C.rot(fig, "thighR", 0.42 * th + 0.12 * wind, 0, 0.05); C.rot(fig, "shinR", 0.3 * th + 0.25 * wind, 0, 0); C.rot(fig, "footR", -0.28 * th, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.16 * th, 0, 0); C.rot(fig, "cape2" + s, 0.12 * th, 0, 0); }
      C.rot(fig, "hairB1", 0.4 * th - 0.1 * wind, 0, 0); C.rot(fig, "hairB2", 0.25 * th, 0, 0);
      hx += 0.02 * wind + 0.1 * th; hy += 0.12 * wind + 0.04 * th; hz += 0.06 * wind - 0.12 * th; yaw += -0.1 * wind + 0.45 * th; tilt += 0.05 * wind;
      face = t > 0.06 && t < 0.95 ? "fierce" : null;
    } else if (clip === "hurt") {
      const e = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hx -= 0.03 * e; hy += 0.08 * e; hz += 0.05 * e; yaw -= 0.2 * e;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      hy += 0.08 * up; hz += 0.04 * up;
    }
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    if (clip === "victory") {
      C.aimGrip(fig, "handR", [0.05, 1, 0.1], [0, 0, 1], 1);
    } else {
      let hand = V3(shR.x + 0.02, shR.y - 0.24 + 0.004 * br, shR.z + 0.13), aim = V3(-0.1, 0.75, 0.65).normalize(), fc = V3(-1, 0, 0.2);
      if (clip === "hurt") { const e = Math.exp(-t * 6) * C.sstep(0, 0.05, t); hand.add(V3(-0.03 * e, 0.05 * e, -0.05 * e)); }
      if (k > 0.001) {
        const phi = -0.5 * C.sstep(0.02, 0.28, t) + 2.8 * C.sstep(0.3, 0.46, t) + 0.5 * C.sstep(0.46, 0.66, t);
        const U = V3(-0.4, 1, -0.15).normalize(), F = V3(0.75, -0.12, 0.8).normalize();
        const dir = U.clone().multiplyScalar(Math.cos(phi)).addScaledVector(F, Math.sin(phi)).normalize();
        const mot = U.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(F, Math.cos(phi)).normalize();
        const cen = V3(shR.x * 0.5, shR.y - 0.03, shR.z + 0.1);
        hand = hand.lerp(cen.clone().addScaledVector(dir, reach * 0.78), k);
        aim = aim.lerp(dir, k).normalize(); fc = fc.lerp(mot, k);
      }
      C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V3(shR.x - 0.3, shR.y - 0.2, shR.z - 0.15)), 1);
      C.aimGrip(fig, "handR", [aim.x, aim.y, aim.z], [fc.x, fc.y, fc.z], 1);
    }
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V3(shL.x + hx, shL.y + hy + 0.004 * br, shL.z + hz)), C.toW(fig, V3(shL.x + 0.35, shL.y - 0.1, shL.z - 0.3)), 1);
    carryShield(fig, C, tilt, yaw, roll, free);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return atk ? t < LEN : r;
  }

  return {
    cards: ["squire"], kind: "humanoid", build, pose, scale: 0.9,
    face: { kind: "human", look: { eye: 0x6a8a5a, brow: "#5a3a24", lash: "#24160e", lip: "#c07a6c", skinD: "#dcaa94" } },
    moves: { attack: { clip: "slash", hit: HIT, length: LEN, style: "slash", trail: { prop: "spear", from: [0, B0 + 0.04, 0], to: [0, B0 + BL, 0] } } },
  };
})());
