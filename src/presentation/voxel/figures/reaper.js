/* 黯月收割者 — Dark-moon Reaper (card reaper): a faceless wraith in a deep black cowl — nothing inside but two
 * ember-red eyes — a floor-length robe and cloak that tear into ragged tails, flared torn sleeves, iron gauntlets, a
 * silver gothic cross hanging down the front, and a great scythe whose long curved blade carries a glowing blood-red
 * edge (the signature at board scale). The attack is a two-handed overhead reap: the scythe goes up over the right
 * shoulder and comes down in front, the blade hooking into the target. */
EmberVoxelKit.define("reaper", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, bell } = K;
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  const hash = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // torn hem: triangular teeth of random depth (0..1)
  const tear = (u) => { const k = Math.floor(u), f = u - k; return (1 - Math.abs(2 * f - 1)) * (0.35 + 0.65 * hash(k)); };

  // ------------------------------------------------------------ prop: the scythe (grip at 0, shaft along +Y, blade along +Z)
  const TOP = 0.46, BL = 0.4;
  const spine = (z) => { const u = clamp(z / BL, 0, 1); return TOP + 0.035 + 0.05 * Math.sin(u * 2.2) - 0.16 * u * u * u; };   // top edge of the blade
  const width = (z) => { const u = clamp(z / BL, 0, 1); return 0.058 * Math.pow(1 - u, 0.75) + 0.004; };
  function scythe() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      shaft: { c: 0x6a5656, rough: 0.7, cls: CLS.wood, vary: 0.08 }, iron: { c: 0x5a5e6c, rough: 0.35, metal: 0.9, cls: CLS.metal, vary: 0.03 },
      silver: { c: 0xa8b0bc, rough: 0.3, metal: 1, cls: CLS.metal }, blade: { c: 0x7c8390, rough: 0.25, metal: 1, cls: CLS.metal, vary: 0.02 },
      edge: { c: 0xd8202a, rough: 0.3, emit: 0.9, cls: CLS.glow },
    });
    const o = { bone: "p" }, R = 0.0105, bot = -0.44;
    // the shaft is thin and long: padded bounds so every voxel block along it is visited
    const ym = (bot + TOP + 0.02) / 2, yh = (TOP + 0.02 - bot) / 2;
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, z) - R, Math.abs(y - ym) - yh), pad([-R, bot, -R, R, TOP + 0.02, R])), { ...o, mat: "shaft", p: [0, 0, 0], k: 0.001, vdil: 0.4 });
    for (const y of [-0.3, 0.12, 0.3]) sc.add(S.cyl(0.005, R * 1.4, 0.002), { ...o, mat: "silver", p: [0, y, 0], k: 0.001 });
    sc.limb([0, bot - 0.03, 0], [0, bot + 0.02, 0], 0.004, R * 1.3, { ...o, mat: "iron", k: 0.002 });
    // head: iron socket with a back spike and two short thorns
    sc.limb([0, TOP - 0.05, 0], [0, TOP + 0.075, 0], R * 1.3, R * 1.5, { ...o, mat: "iron", k: 0.002 });
    sc.limb([0, TOP + 0.05, -0.01], [0, TOP + 0.09, -0.09], 0.01, 0.002, { ...o, mat: "iron", k: 0.002, vdil: 0.5 });
    sc.limb([0, TOP + 0.07, 0], [0, TOP + 0.13, 0.004], 0.008, 0.002, { ...o, mat: "iron", k: 0.002, vdil: 0.5 });
    for (const s of [1, -1]) sc.limb([s * 0.01, TOP - 0.02, 0], [s * 0.045, TOP + 0.01, 0], 0.006, 0.002, { ...o, mat: "iron", k: 0.002, vdil: 0.5 });
    // blade: a long crescent in the YZ plane, thick at the spine, the hooked tip dropping; lower edge glows red
    const blade = S.custom((x, y, z) => {
      const top = spine(z), w = width(z), u = clamp((top - y) / w, 0, 1);
      return Math.max(y - top, top - w - y, -z, z - BL, Math.abs(x) - (0.0065 * (1 - u) + 0.0022));
    }, [-0.01, TOP - 0.2, 0, 0.01, TOP + 0.12, BL]);
    sc.add(blade, { ...o, mat: "blade", p: [0, 0, 0], k: 0.001, vdil: 0.4 });
    sc.paint(S.custom((x, y, z) => (z < 0.01 || z > BL + 0.01 ? 1 : y - (spine(z) - width(z) + 0.011)), [-0.02, TOP - 0.22, -0.01, 0.02, TOP + 0.12, BL + 0.01]),
      { mat: "edge", p: [0, 0, 0], soft: 0.0005, only: ["blade"] });
    return sc;
  }

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25;
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.006, capeBot = 0.02, capeZ = -P.chest[3] - 0.04;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    mats(sc, {
      // bare "skin" is the void inside the robe: whatever the cloth leaves open reads as darkness
      skin: { c: 0x0c0a10, rough: 0.9, cls: CLS.cloth }, lips: { c: 0x0c0a10, rough: 0.9, cls: CLS.cloth }, skinDeep: { c: 0x0c0a10, rough: 0.9, cls: CLS.cloth },
      eyeGlow: { c: 0xc81010, cls: CLS.glow, emit: 0.75, rough: 0.4 },
      robe: { c: 0x4e4658, rough: 0.9, cls: CLS.cloth, vary: 0.05 }, robeD: { c: 0x2e2834, rough: 0.9, cls: CLS.cloth },
      cloak: { c: 0x463e52, rough: 0.9, cls: CLS.cloth, vary: 0.05 }, lining: { c: 0x70202e, rough: 0.9, cls: CLS.cloth, vary: 0.05 },
      hood: { c: 0x4e4658, rough: 0.9, cls: CLS.cloth, vary: 0.05 }, hoodIn: { c: 0x09070c, rough: 0.95, cls: CLS.cloth },
      iron: { c: 0x565a68, rough: 0.35, metal: 0.9, cls: CLS.metal, vary: 0.03 }, ironD: { c: 0x33353f, rough: 0.45, metal: 0.8, cls: CLS.metal },
      silver: { c: 0xb0b8c4, rough: 0.28, metal: 1, cls: CLS.metal }, gold: { c: 0xb0904e, rough: 0.35, metal: 1, cls: CLS.metal },
      leather: { c: 0x2a2228, rough: 0.6, cls: CLS.leather },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.97;
    // ---- robe over torso and arms, belt, gauntlets
    const armRg = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.3)), lerp(a.E, a.W, 0.9), 0.09); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.04, P.neck[0] + 0.03), ...armRg), "robe", 0.006 * q);
    wrap(sc, RG.box(-0.25, 0.25, P.waist[0] - 0.02, P.waist[0] - 0.002), "leather", 0.009 * q);
    sc.add(S.box(0.013, 0.012, 0.004, 0.002), { mat: "silver", p: [0, P.waist[0] - 0.011, P.waist[2] + 0.035], bone: "spine", k: 0.001 });
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.07 * P.hand), "iron", 0.004 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.75), add(a.W, mul(a.dir, 0.01)), 0.08), "ironD", 0.008 * q);
      // flared torn sleeve from the elbow past the wrist
      const A = lerp(a.E, a.W, 0.3), B = add(a.W, mul(a.dir, 0.012)), d = a.dir, L = Math.hypot(...sub(B, A));
      const sleeve = S.custom((x, y, z) => {
        const px = x - A[0], py = y - A[1], pz = z - A[2], t = px * d[0] + py * d[1] + pz * d[2];
        const r = Math.hypot(px - d[0] * t, py - d[1] * t, pz - d[2] * t), u = clamp(t / L, 0, 1), rr = mix(0.042, 0.07, u * u);
        const ang = Math.atan2(pz - d[2] * t, (px - d[0] * t) * s);
        return Math.max(Math.abs(r - rr) - 0.0065, -t, t - L - 0.02 * tear(ang * 2.2 + 3));
      }, pad([Math.min(A[0], B[0]) - 0.08, Math.min(A[1], B[1]) - 0.08, -0.1, Math.max(A[0], B[0]) + 0.08, Math.max(A[1], B[1]) + 0.08, 0.1], 0.02));
      sc.add(sleeve, { mat: "robe", p: [0, 0, 0], bone: "fore" + n, k: 0.002, part: "cloth" });
    }
    // ---- silver gothic cross on a chain down the front, gold studs on the collar
    sc.add(S.box(0.004, 0.06, 0.004), { mat: "silver", p: [0, P.chest[0] + 0.02, P.chest[3] + 0.044], r: [-0.08, 0, 0], bone: "chest", k: 0.001, vdil: 0.5 });
    {
      const c = [0, P.waist[0] + 0.02, P.waist[2] + 0.05];
      sc.add(S.box(0.007, 0.038, 0.005, 0.001), { mat: "silver", p: c, bone: "spine", k: 0.001 });
      sc.add(S.box(0.026, 0.007, 0.005, 0.001), { mat: "silver", p: add(c, [0, 0.014, 0]), bone: "spine", k: 0.001 });
      for (const [dx, dy] of [[0.026, 0.014], [-0.026, 0.014], [0, 0.04], [0, -0.04]]) sc.add(S.sphere(0.0065), { mat: "gold", p: add(c, [dx, dy, 0.001]), bone: "spine", k: 0.001 });
    }
    // ---- head: void face, ember eyes (the field is scaled so each eye stays one bright cube)
    const ember = S.custom((x, y, z) => (Math.hypot(x * 0.7, y, z) - 0.0045) * 6, [-0.008, -0.005, -0.005, 0.008, 0.005, 0.005]);
    for (const s of [1, -1]) sc.add(ember, { mat: "eyeGlow", p: [s * 0.028, P.eyeY - 0.004, P.faceZ - 0.004], bone: "head", k: 0.001, cs: 0.01, vdil: 0.6 });
    // ---- cloth: deep pointed cowl, torn mantle, floor-length robe skirt, ragged cloak
    sc.part = "cloth";
    const hc = add(P.cranC, [0, -P.cran[1] * 0.02, -P.cran[2] * 0.02]), hr = [P.cran[0] * 1.36, P.cran[1] * 1.26, P.cran[2] * 1.4], ht = 0.008;
    const hoodShape = (e) => S.union(S.union(S.ell(hr[0] - e, hr[1] - e, hr[2] - e), S.at(S.ell(hr[0] * 1.02 - e, hr[1] * 0.95 - e, hr[2] * 0.8 - e), 0, -hr[1] * 0.8, -hr[2] * 0.3), 0.03),
      S.at(S.ell(0.035 - e * 0.5, 0.05 - e * 0.5, 0.07 - e * 0.5), 0, hr[1] * 0.72, -hr[2] * 0.1), 0.04);
    const faceOpen = S.at(S.ell(P.face[0] * 1.2, (P.crown - P.chinY) * 0.52, 0.12), 0, (P.eyeY - hc[1]) - 0.018, (P.faceZ - hc[2]) + 0.1 - 0.012);
    const hood = S.minus(S.minus(hoodShape(0), hoodShape(ht * 2), 0), faceOpen, 0.004);
    const hp = sc.add(hood, { mat: "hood", p: hc, bone: "head", k: 0.006, cs: 0.03 });
    hp.wfn = (x, y) => { const u = sstep(P.chinY, P.neck[0] - 0.01, y); return [["head", 1 - u], ["neck", u * 0.5], ["chest", u * 0.5]]; };
    sc.paint(hoodShape(ht), { mat: "hoodIn", p: hc, soft: 0.002, only: ["hood"] });
    // mantle: bell over the shoulders with a torn hem
    const my0 = P.neck[0] + 0.03, myH = 0.13, mr0 = P.neck[2] * 2, mr1 = P.shX + P.delt * 1.35, msz = (P.chest[3] * 1.9) / mr1;
    const mant = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / myH, 0, 1), r = mix(mr0, mr1, Math.pow(u, 0.45)), a = Math.atan2(z / msz, x);
      const rr = Math.hypot(x, z / msz) - r - 0.006 * u * Math.sin(a * 9 + 0.4);
      return smax(Math.abs(rr) - 0.0075, Math.max(-y - myH + 0.035 * tear(a * 4 + 7), y), 0.006);
    }, pad([-mr1 - 0.02, -myH, -mr1 * msz - 0.02, mr1 + 0.02, 0, mr1 * msz + 0.02], 0.02)), { mat: "robe", p: [0, my0, -0.012], bone: "chest", k: 0.004, cs: 0.03, wg: 2, bones: [["chest", 1]] });
    // robe skirt: waist to the floor, flaring, torn hem (solid: the legs inside are never seen, and a solid cone has no inner surface to pay for); weights from the root down to the thighs
    const y0 = P.waist[0] - 0.01, h = y0 - 0.01, r0 = P.pelvis[1] * 1.12, r1 = 0.165, sz = 0.8;
    const sk = sc.add(S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = mix(r0, r1, Math.pow(u, 0.9)), a = Math.atan2(z / sz, x);
      const rr = Math.hypot(x, z / sz) - r - 0.009 * u * Math.sin(a * 8 + 0.6);
      return smax(rr, Math.max(-y - h + 0.07 * tear(a * 3.5 + 1) * u, y), 0.006);
    }, pad([-r1 - 0.02, -h, -r1 * sz - 0.02, r1 + 0.02, 0, r1 * sz + 0.02], 0.02)), { mat: "robe", p: [0, y0, 0], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.75, sl = sstep(-0.04, 0.04, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => y - 0.17 - 0.05 * tear(Math.atan2(z, x) * 3.5 + 1), [-0.3, 0, -0.3, 0.3, 0.3, 0.3]), { mat: "robeD", p: [0, 0, 0], soft: 0.001, only: ["robe"] });
    // cloak: from the shoulders to the floor, wide, deep folds, torn into tails
    const ch = capeTop - capeBot;
    const capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.13, 0.25, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.07, u) - 0.02 * Math.sin((x / w) * 6 * 1.57 + 0.5) * (0.25 + u) + (0.7 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.006, Math.max(Math.abs(x) - c.w + 0.03 * tear(y * 20 + 2) * c.u, y - capeTop, capeBot + 0.14 * tear(x * 18 + 5) - y), 0.005); };
    const cp = sc.add(S.custom(capeF, pad([-0.35, capeBot, -0.34, 0.35, capeTop, 0.1])), { mat: "cloak", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (y > capeTop + 0.01 || z > 0.1 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.35, capeBot, -0.34, 0.35, capeTop, 0.1]), { mat: "lining", p: [0, 0, 0], soft: 0.001, only: ["cloak"] });
    sc.part = "body";
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [{ sc: scythe(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  // ------------------------------------------------------------ motion
  const HIT = 0.46, LEN = 1.3;
  /* scythe held upright at the right side, blade out over the head to the left (as on the card); the left hand
   * joins on the shaft for the reap. Swing angle φ in the plane of up U and forward F: shaft = cos φ·U + sin φ·F,
   * the blade (holder +Z) leads along the motion, so it points forward overhead and hooks down at the target. */
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.4);
    C.base(fig, clip === "attack" ? "idle" : clip, t, T);
    if (clip === "idle") { C.addRot(fig, "head", 0.1, 0, 0); C.addRot(fig, "chest", 0.05, 0, 0); }
    let wind = 0, th = 0, glow = 0.1 * Math.sin(T * 1.9);
    if (clip === "attack") {
      wind = C.bump(0, 0.3, 0.34, 0.44, t); th = C.bump(0.34, 0.47, 0.68, 1.15, t);
      C.addRot(fig, "root", 0.1 * th - 0.04 * wind, 0.35 * wind - 0.4 * th, 0);
      C.off(fig, "root", 0, 0.015 * wind - 0.06 * th, -0.03 * wind + 0.09 * th);
      C.addRot(fig, "spine", -0.1 * wind + 0.2 * th, 0.15 * wind - 0.12 * th, 0);
      C.addRot(fig, "chest", -0.12 * wind + 0.18 * th, 0.2 * wind - 0.15 * th, 0);
      C.addRot(fig, "head", 0.1 * wind - 0.1 * th, -0.2 * wind + 0.2 * th, 0);
      C.rot(fig, "thighL", -0.6 * th - 0.2 * wind, 0, -0.05); C.rot(fig, "shinL", 0.45 * th + 0.2 * wind, 0, 0);
      C.rot(fig, "thighR", 0.35 * th, 0, 0.05); C.rot(fig, "shinR", 0.3 * th + 0.1 * wind, 0, 0);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.08 * th, 0, 0.04 * Math.sin(T * 1.3)); C.rot(fig, "cape2" + s, 0.06 * th, 0, 0); }
      glow += 1.4 * C.bump(0.3, 0.44, 0.55, 0.9, t);
      C.setFace(fig, "fierce");
    }
    fig.root.updateMatrixWorld(true);
    const shR = C.toM(fig, C.wpos(J.armR)), shL = C.toM(fig, C.wpos(J.armL));
    if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      C.aimGrip(fig, "handR", [-0.1, 1, 0.1], [1, 0.3, 0.3], 1);
      C.emitBoost(fig, 0.2 + 1.2 * up);
      return t < 1.6;
    }
    // hold: right hand low at the side, shaft upright; reap: both hands on the shaft through the swing
    const hold = V(shR.x - 0.03, shR.y - 0.24 + 0.004 * br, shR.z + 0.1);
    const k = Math.max(wind, th);
    const phi = -0.75 * C.sstep(0.02, 0.3, t) + 2.65 * C.sstep(0.34, 0.54, t) - 1.9 * C.sstep(0.7, 1.15, t);
    const U = V(-0.2, 1, -0.05).normalize(), F = V(0.3, 0, 1).normalize();
    const dir = U.clone().multiplyScalar(Math.cos(phi)).addScaledVector(F, Math.sin(phi)).normalize();
    const mot = U.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(F, Math.cos(phi)).normalize();
    const cen = V(shR.x * 0.35, shR.y - 0.1, shR.z + 0.12);
    const hand = hold.clone().lerp(cen.clone().addScaledVector(dir, 0.1), k);
    const aim = V(-0.1, 1, 0.08).lerp(dir, k).normalize(), face = V(1, 0.15, 0.35).lerp(mot, k);
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hand), C.toW(fig, V(shR.x - 0.3, shR.y - 0.2, shR.z - 0.1)), 1);
    C.aimGrip(fig, "handR", [aim.x, aim.y, aim.z], [face.x, face.y, face.z], 1);
    fig.root.updateMatrixWorld(true);
    const pr = fig.props.find((p) => p.bone === "handR");
    if (pr && k > 0.001) {
      const lowOnShaft = C.toM(fig, pr.holder.localToWorld(V(0, -0.2, 0)));
      C.ik(fig, "armL", "foreL", "handL", C.toW(fig, lowOnShaft), C.toW(fig, V(shL.x + 0.3, shL.y - 0.25, shL.z - 0.1)), k);
    } else {
      C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V(shL.x + 0.05, shL.y - 0.25 + 0.004 * br, shL.z + 0.03)), C.toW(fig, V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2)), 1);
    }
    C.emitBoost(fig, glow);
    fig.root.updateMatrixWorld(true);
    return clip === "idle" ? true : t < (clip === "attack" ? LEN : clip === "hurt" ? 0.6 : 1.6);
  }

  return {
    cards: ["reaper"], kind: "humanoid", build, pose, scale: 1.15,
    moves: { attack: { clip: "reap", hit: HIT, length: LEN, style: "slash", trail: { prop: "spear", from: [0, spine(0.08) - 0.02, 0.08], to: [0, spine(BL) - 0.004, BL] } } },
  };
})());
