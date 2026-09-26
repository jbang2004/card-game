/* 血月行者 — Blood-moon Walker (card leech): a pale, red-eyed noble of the night — a black hood over long straight
 * black hair, a high collar, a long black coat that splits open at the front and swings into a ragged cloak, all
 * lined in blood red, black gloves ending in crimson talons on the right hand, and a glowing blood orb held up in the
 * left (the signature at board scale). The attack is a lunging overhand rake with the talons; the orb flares as he
 * drinks. */
EmberVoxelKit.define("leech", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  const hash = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const tearN = (u) => { const k = Math.floor(u), f = u - k; return (1 - Math.abs(2 * f - 1)) * (0.35 + 0.65 * hash(k)); };
  // pixel sprite: a few big regular teeth instead (a third of the frequency); K.pixel is read per call
  const tearPx = (u) => { const f = u / 3 - Math.floor(u / 3); return 0.8 * (1 - Math.abs(2 * f - 1)); };
  const tear = (u) => (EmberVoxelKit.pixel ? tearPx(u) : tearN(u));
  const PF = FAM.chunky, AR = armJoints(PF, -1), AL = armJoints(PF, 1);
  const TALON = 0.075;                                   // talon length past the knuckles
  const ORB_AT = add(AL.W, mul(AL.dir, 0.105 * PF.hand));

  // ------------------------------------------------------------ prop: the blood orb (centre at 0)
  function orb() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      blood: { c: 0xa0101c, rough: 0.2, emit: 0.75, cls: CLS.glow }, bloodD: { c: 0x5a0610, rough: 0.3, emit: 0.5, cls: CLS.glow },
      hot: { c: 0xffb0a0, rough: 0.2, emit: 1.4, cls: CLS.glow },
    });
    sc.add(S.sphere(0.036), { bone: "p", mat: "blood", p: [0, 0, 0], k: 0.002 });
    // a dark swirl band and one hot glint
    if (!EmberVoxelKit.pixel) sc.paint(S.custom((x, y, z) => Math.abs(y - 0.012 * Math.sin(Math.atan2(z, x) * 2)) - 0.005, [-0.04, -0.04, -0.04, 0.04, 0.04, 0.04]), { mat: "bloodD", p: [0, 0, 0], soft: 0.001, only: ["blood"] });
    sc.paint(S.sphere(EmberVoxelKit.pixel ? 0.016 : 0.012), { mat: "hot", p: [-0.016, 0.02, 0.022], soft: 0.001, only: ["blood"] });
    return sc;
  }

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25, PX = K.pixel;   // PX: pixel sprite — fat locks, regular teeth, no specks
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.004, capeBot = 0.06, capeZ = -P.chest[3] - 0.035;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairL", "head", 0.05, P.eyeY - 0.04, 0.02); sc.bone("hairR", "head", -0.05, P.eyeY - 0.04, 0.02);
    mats(sc, {
      skin: { c: 0xe2dadc, rough: 0.55, cls: CLS.skin, vary: 0.012 }, skinDeep: { c: 0xcbb2ac, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xa87078, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x26232e, rough: 0.55, cls: CLS.hair, vary: 0.12 },
      hood: { c: 0x46434f, rough: 0.9, cls: CLS.cloth, vary: 0.05 }, hoodIn: { c: 0x17141b, rough: 0.9, cls: CLS.cloth },
      coat: { c: 0x3e3b47, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, cloak: { c: 0x3e3b47, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, coatD: { c: 0x2a2831, rough: 0.9, cls: CLS.cloth },
      lining: { c: 0x8e1c2a, rough: 0.85, cls: CLS.cloth, vary: 0.05 },
      vest: { c: 0x4a2030, rough: 0.6, cls: CLS.leather, vary: 0.05 },
      glove: { c: 0x25232a, rough: 0.55, cls: CLS.leather }, leather: { c: 0x2e2a30, rough: 0.6, cls: CLS.leather, vary: 0.06 },
      boots: { c: 0x2c2a31, rough: 0.5, cls: CLS.leather, vary: 0.06 },
      silver: { c: 0xb4bcc8, rough: 0.28, metal: 1, cls: CLS.metal },
      talon: { c: 0xb0141e, rough: 0.3, emit: 0.55, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.97, legX = 0.17;
    // ---- coat over torso and arms; dark red waistcoat in the open V; belt; gloves; boots
    const armRg = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.3)), lerp(a.E, a.W, 0.95), 0.09); });
    const vcut = S.custom((x, y, z) => (z > 0 ? Math.abs(x) - Math.max(0, (y - (P.chest[0] - 0.03)) * 0.55) : 1), [-0.3, -0.3, 0, 0.3, 1.2, 0.3]);
    wrap(sc, RG.box(-X0, X0, P.pelvis[0] - 0.03, P.neck[0] + 0.02), "vest", 0.004 * q);
    wrap(sc, RG.or(RG.minus(RG.box(-X0, X0, P.pelvis[0] - 0.03, P.neck[0] + 0.03), vcut), ...armRg), "coat", 0.0065 * q);
    if (!PX) for (const y of [P.chest[0] - 0.02, P.waist[0] + 0.01]) sc.add(S.box(0.007, 0.004, 0.004, 0.001), { mat: "silver", p: [0, y, P.chest[3] + 0.03 - (y < P.chest[0] - 0.05 ? 0.012 : 0)], bone: y < P.chest[0] - 0.05 ? "spine" : "chest", k: 0.001 });
    wrap(sc, RG.box(-0.25, 0.25, P.waist[0] - 0.035, P.waist[0] - 0.015), "leather", 0.0085 * q);
    if (!PX) sc.add(S.box(0.014, 0.012, 0.004, 0.002), { mat: "silver", p: [0, P.waist[0] - 0.025, P.waist[2] + 0.035], bone: "spine", k: 0.001 });
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.07 * P.hand), "glove", 0.003 * q);
      // turned-back cuffs showing the red lining
      sc.limb(lerp(a.E, a.W, 0.78), lerp(a.E, a.W, 0.98), 0.037, 0.043, { mat: "lining", bone: "fore" + n, k: 0.002 });
    }
    wrap(sc, RG.box(-legX, legX, -0.02, P.kneeY + 0.02), "boots", 0.006 * q);
    wrap(sc, RG.box(-legX, legX, P.kneeY + 0.005, P.kneeY + 0.02), "leather", 0.0075 * q);
    wrap(sc, RG.box(-legX, legX, P.kneeY + 0.02, P.pelvis[0]), "coatD", 0.003 * q);
    // talons on the right glove: four hooked claws off the knuckles, glowing blood red
    {
      const a = AR, d = a.dir, n = norm([d[1], -d[0], 0]), z = [0, 0, 1];
      const nT = PX ? 3 : 4, tk = PX ? 1.7 : 1;   // pixel: three fat talons
      for (let i = 0; i < nT; i++) {
        const w = (i - (nT - 1) / 2) * (PX ? 0.017 : 0.013), base = add(add(a.W, mul(d, 0.07 * P.hand)), add(mul(z, w), mul(n, 0.004)));
        const tip = add(add(base, mul(d, TALON)), mul(n, -0.022));
        sc.limb(base, lerp(base, tip, 0.6), 0.0058 * tk, 0.0042 * tk, { mat: "talon", bone: "handR", k: 0.002, vdil: 0.5 });
        sc.limb(lerp(base, tip, 0.55), tip, 0.0045 * tk, 0.0015 * tk, { mat: "talon", bone: "handR", k: 0.002, vdil: 0.5 });
      }
    }
    // ---- hair: fringe inside the hood, long straight locks spilling out down the chest
    sc.part = "hair";
    {
      const ey = P.eyeY, C = add(P.cranC, [0, 0.003, -0.004]), cr = P.cran, R = [cr[0] * 1.06, cr[1] * 1.06, cr[2] * 1.07];
      sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
      // side-parted fringe sweeping to his right
      if (PX) for (const u of [0, 0.5, 1]) {   // pixel: three fat locks sweeping to his right, tips beside the eyes
        const root = [0.02, C[1] + R[1] * 0.64, C[2] + R[2] * 0.72];
        const mid = [0.02 - R[0] * (0.25 + 0.35 * u), ey + 0.058 - 0.006 * u, P.faceZ + 0.002 * q];
        const tip = [-R[0] * (0.7 + 0.4 * u), ey + 0.034 - 0.028 * u, P.faceZ - 0.016 * q - 0.014 * q * u];
        strand(sc, [root, mid, tip], 0.019 * q, 0.004 * q, { k: 0.008, taper: 1.2, grooves: 0 });
      }
      else for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const root = [0.02, C[1] + R[1] * 0.64, C[2] + R[2] * 0.72];
        const mid = [0.02 - R[0] * (0.25 + 0.35 * u), ey + 0.056 - 0.006 * u, P.faceZ + 0.002 * q];
        const tip = [-R[0] * (0.62 + 0.4 * u), ey + 0.03 - 0.02 * u, P.faceZ - 0.014 * q - 0.014 * q * u];
        strand(sc, [root, mid, tip], 0.012 * q, 0.0018 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
      }
      for (const s of [1, -1]) for (let j = 0; j < (PX ? 2 : 3); j++) {
        const o = PX ? j - 0.5 : j - 1, n = sideName(s);
        const root = onEll(C, R, s * (1.15 + 0.12 * o), 0.2, 0.98);
        const a = [s * R[0] * (1.1 + 0.04 * o), ey - 0.02, C[2] + R[2] * (0.4 - 0.1 * o)];
        const b = [s * R[0] * (1.12 + 0.05 * o), P.chinY - 0.03, C[2] + R[2] * (0.5 - 0.12 * o)];
        const tip = [s * P.shX * (0.66 + 0.1 * o), P.chest[0] - 0.02 - 0.015 * Math.abs(o), P.chest[3] + 0.028 - 0.012 * o];
        const sp = strand(sc, [root, a, b, lerp(b, tip, 0.5), tip], (PX ? 0.02 : 0.014 - 0.002 * Math.abs(o)) * q, (PX ? 0.006 : 0.0025) * q, { k: 0.01, wg: 4, taper: 1.3, bone: "hair" + n, grooves: PX ? 0 : undefined });
        sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0], y); return [["head", 1 - t], ["hair" + n, t * 0.5], ["chest", t * 0.5]]; };
      }
    }
    // ---- cloth: hood, high collar, coat skirt, cloak
    sc.part = "cloth";
    const hc = add(P.cranC, [0, -P.cran[1] * 0.04, -P.cran[2] * 0.08]), hr = [P.cran[0] * 1.3, P.cran[1] * 1.2, P.cran[2] * 1.28], ht = 0.0075;
    const hoodShape = (e) => S.union(S.ell(hr[0] - e, hr[1] - e, hr[2] - e), S.at(S.ell(hr[0] * 1.02 - e, hr[1] * 0.9 - e, hr[2] * 0.78 - e), 0, -hr[1] * 0.78, -hr[2] * 0.32), 0.03);
    const faceOpen = S.at(S.ell(P.face[0] * 1.55, (P.crown - P.chinY) * 0.6, 0.12), 0, (P.eyeY - hc[1]) - 0.02, (P.faceZ - hc[2]) + 0.1 - 0.04);
    const hood = S.minus(S.minus(hoodShape(0), hoodShape(ht * 2), 0), faceOpen, 0.004);
    const hp = sc.add(hood, { mat: "hood", p: hc, bone: "head", k: 0.006, cs: 0.03 });
    hp.wfn = (x, y) => { const u = sstep(P.chinY, P.neck[0] - 0.01, y); return [["head", 1 - u], ["neck", u * 0.5], ["chest", u * 0.5]]; };
    sc.paint(hoodShape(ht), { mat: "hoodIn", p: hc, soft: 0.002, only: ["hood"] });
    // high collar: a flared band standing up round the back and sides of the neck, red inside
    const cy0 = P.neck[0] - 0.005, cy1 = P.chinY + 0.02;
    const collar = (x, y, z) => { const u = clamp((y - cy0) / (cy1 - cy0), 0, 1), r = mix(0.066, 0.092, u * u); return Math.max(Math.abs(Math.hypot(x, (z + 0.01) / 0.95) - r) - 0.0065, cy0 - y, y - cy1, z - 0.035 + 0.02 * u); };
    const cl = sc.add(S.custom(collar, pad([-0.1, cy0, -0.11, 0.1, cy1, 0.05], 0.02)), { mat: "coat", p: [0, 0, 0], bone: "chest", k: 0.003, bones: [["chest", 0.8], ["neck", 0.2]] });
    sc.paint(S.custom((x, y, z) => { const u = clamp((y - cy0) / (cy1 - cy0), 0, 1); return Math.hypot(x, (z + 0.01) / 0.95) - mix(0.066, 0.092, u * u) + 0.001; }, [-0.1, cy0 - 0.01, -0.11, 0.1, cy1 + 0.01, 0.05]), { mat: "lining", p: [0, 0, 0], soft: 0.001, only: ["coat"] });
    // coat skirt: waist to mid-calf, solid (no inner surface to pay for), split open at the front with red edges
    const y0 = P.waist[0] - 0.02, yb = P.kneeY - 0.1, h = y0 - yb, r0 = P.pelvis[1] * 1.12, r1 = 0.17, sz = 0.82;
    const slitW = (u) => 0.006 + 0.06 * u;
    const skF = (x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.85)), a = Math.atan2(z / sz, x);
      const rr = Math.hypot(x, z / sz) - r - (PX ? 0 : 0.007) * u * Math.sin(a * 7 + 0.6);
      return smax(Math.max(rr, z > 0 ? slitW(u) - Math.abs(x) : -1), Math.max(-y - h + 0.03 * tear(a * 4 + 2), y), 0.004);
    };
    const sk = sc.add(S.custom(skF, pad([-r1 - 0.02, -h, -r1 * sz - 0.02, r1 + 0.02, 0, r1 * sz + 0.02], 0.02)), { mat: "coat", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.75, sl = sstep(-0.04, 0.04, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => { const u = clamp((y0 - y) / h, 0, 1); return z < 0 || y > y0 + 0.01 ? 1 : Math.abs(x) - slitW(u) - (PX ? 0.024 : 0.013); }, [-0.3, 0, -0.3, 0.3, y0 + 0.02, 0.3]), { mat: "lining", p: [0, 0, 0], soft: 0.001, only: ["coat"] });
    // cloak: shoulders to the ankles, torn into tails, red inside
    const ch = capeTop - capeBot;
    const capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.12, 0.27, Math.pow(u, 0.75));
      return { u, w, zc: mix(capeZ, capeZ - 0.08, u) - (PX ? 0.006 : 0.018) * Math.sin((x / w) * (PX ? 2 : 5) * 1.57 + 0.5) * (0.25 + u) + (0.7 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.006, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + (PX ? 0.07 * tear(x * 14 + 3) : 0.11 * tear(x * 20 + 3)) - y), 0.005); };
    const cp = sc.add(S.custom(capeF, pad([-0.3, capeBot, -0.3, 0.3, capeTop, 0.1])), { mat: "cloak", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (y > capeTop + 0.01 || z > 0.1 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.3, capeBot, -0.3, 0.3, capeTop, 0.1]), { mat: "lining", p: [0, 0, 0], soft: 0.001, only: ["cloak"] });
    sc.part = "body";
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [{ sc: orb(), bone: "handL", at: ORB_AT }] };
  }

  // ------------------------------------------------------------ motion
  const HIT = 0.4, LEN = 1.15;
  // turn a hand so its knuckle axis (the forearm direction at bind) points along model direction `to`
  function aimFist(fig, C, name, to, k = 1) {
    const h = fig.J[name], a = armJoints(fig.char.P, name === "handL" ? 1 : -1);
    if (!h || k <= 0) return;
    fig.root.updateMatrixWorld(true);
    const w = C.wpos(h), from = h.localToWorld(C.V3(...a.dir).multiplyScalar(0.1)).sub(w);
    const want = C.toW(fig, C.toM(fig, w).add(C.V3(...to).normalize().multiplyScalar(0.1))).sub(w);
    C.turnBone(h, from, from.clone().lerp(want, k));
  }
  /* shared idle / hurt / victory, then the orb held up in the left hand (as on the card) and the talons hanging
   * ready; attack: step back and cock the talons high behind the right shoulder (0-0.3), lunge and rake them down
   * across to the lower left (0.3-0.5, contact at 0.4, the orb flares), hold, recover */
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, P = fig.char.P, br = Math.sin((T * C.TAU) / 3.4);
    C.base(fig, clip === "attack" ? "idle" : clip, t, T);
    let wind = 0, th = 0, glow = 0.15 * (0.5 + 0.5 * Math.sin(T * 2.4)), up = 0;
    if (clip === "attack") {
      wind = C.bump(0, 0.28, 0.3, 0.4, t); th = C.bump(0.3, 0.42, 0.62, 1.05, t);
      C.addRot(fig, "root", 0.06 * th - 0.04 * wind, 0.35 * wind - 0.3 * th, 0);
      C.off(fig, "root", 0, -0.02 * wind - 0.05 * th, -0.05 * wind + 0.1 * th);
      C.addRot(fig, "spine", -0.08 * wind + 0.14 * th, 0.15 * wind - 0.12 * th, 0);
      C.addRot(fig, "chest", -0.1 * wind + 0.12 * th, 0.2 * wind - 0.2 * th, -0.05 * wind);
      C.addRot(fig, "head", 0.05 * wind - 0.08 * th, -0.3 * wind + 0.25 * th, 0);
      C.rot(fig, "thighL", -0.7 * th - 0.15 * wind, 0, -0.06); C.rot(fig, "shinL", 0.55 * th + 0.25 * wind, 0, 0); C.rot(fig, "footL", 0.15 * th, 0, 0);
      C.rot(fig, "thighR", 0.45 * th + 0.25 * wind, 0, 0.06); C.rot(fig, "shinR", 0.35 * th + 0.2 * wind, 0, 0); C.rot(fig, "footR", -0.25 * th, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.12 * th + 0.05 * wind, 0, 0); C.rot(fig, "cape2" + s, 0.1 * th, 0, 0); }
      glow += 1.8 * C.bump(0.38, 0.44, 0.6, 0.95, t);
      C.setFace(fig, t > 0.05 && t < 0.95 ? "fierce" : "open");
    } else if (clip === "victory") {
      up = C.bump(0, 0.3, 1.2, 1.6, t); glow += 1.2 * up;
    } else if (clip === "idle") {
      C.addRot(fig, "head", 0.05, -0.12, 0.04);
    }
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    const reach = P.upArm + P.foreArm;
    // left: orb held up before the shoulder ⇄ drawn in toward the chest during the rake ⇄ raised high in victory
    const hurtK = clip === "hurt" ? Math.exp(-t * 6) * C.sstep(0, 0.05, t) : 0;
    const orbHand = V(shL.x + 0.06, shL.y - 0.07 + 0.006 * br, shL.z + 0.17)
      .lerp(V(shL.x - 0.02, shL.y - 0.12, shL.z + 0.12), Math.max(th, wind) * 0.8)
      .lerp(V(shL.x + 0.02, shL.y + 0.2, shL.z + 0.1), up)
      .add(V(0.03 * hurtK, -0.05 * hurtK, -0.06 * hurtK));
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, orbHand), C.toW(fig, V(shL.x + 0.3, shL.y - 0.25, shL.z - 0.1)), 1);
    aimFist(fig, C, "handL", [0.15, 0.9 - 0.3 * up, 0.35], 1);
    // right: talons hanging ready ⇄ the rake (bezier through the contact point at s = 0.5)
    if (clip !== "victory") {
      const rest = V(shR.x - 0.05, shR.y - 0.25 + 0.004 * br, shR.z + 0.05);
      const W0 = V(shR.x - 0.1, shR.y + 0.13, shR.z - 0.04), C0 = V(shR.x + 0.06, shR.y - 0.05, shR.z + reach * 0.9), F0 = V(shR.x + 0.22, shR.y - 0.24, shR.z + 0.1);
      const Cc = C0.clone().multiplyScalar(2).addScaledVector(W0, -0.5).addScaledVector(F0, -0.5);
      const s = C.sstep(0.3, 0.5, t), bz = (s) => W0.clone().multiplyScalar((1 - s) * (1 - s)).addScaledVector(Cc, 2 * s * (1 - s)).addScaledVector(F0, s * s);
      const k = Math.max(wind, th);
      const hand = rest.clone().lerp(bz(s), k);
      const tan = bz(Math.min(1, s + 0.05)).sub(bz(Math.max(0, s - 0.05)));
      const clawDir = V(0.1, -1, 0.35).lerp(V(0, 1, -0.2), wind).lerp(tan.normalize().add(V(0, 0, 0.6)).normalize(), th).normalize();
      C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V(shR.x - 0.3, shR.y - 0.2, shR.z - 0.15)), 1 - hurtK * 0.5);
      aimFist(fig, C, "handR", [clawDir.x, clawDir.y, clawDir.z], 1);
    }
    C.emitBoost(fig, glow);
    fig.root.updateMatrixWorld(true);
    return clip === "idle" ? true : t < (clip === "attack" ? LEN : clip === "hurt" ? 0.6 : 1.6);
  }

  return {
    cards: ["leech"], kind: "humanoid", build, pose, scale: 1.0,
    face: { kind: "human", look: { eye: 0xc0202e, brow: "#1c1a22", lash: "#0e0c12", lip: "#9a6a70", skinD: "#cdb4ae" } },
    // the realistic model casts a blood bolt from the orb in its left hand (EmberModelFigures); this sculpt rakes in place
    moves: { attack: { clip: "rake", hit: HIT, length: LEN, style: "bolt", ranged: true, windup: 280, tint: 0xd0203a, emitter: { bone: "handL", offset: [0, 0, 0] } } },
  };
})());
