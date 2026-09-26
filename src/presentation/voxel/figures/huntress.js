/* 荒野之矛 — hooded elf huntress with a leaf spear (card huntress). */
EmberVoxelKit.define("huntress", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, lin, vnoise, fbm, clamp, mix, sstep, rotm, rotY2, smax, TAU, add, sub, mul, lerp, norm, cross, X,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, handFrame, hand, foot, head,
    RG, wrap, bell, skirt, cape, capeBones, lock, cuff, spline, strand, onEll, chibiHair,
    spearProp, bowProp, quiverProp, QF, quadBones, scaleG } = K;
  /* pixel sprite: three fat fringe locks that clear the eye band, two plain locks a side (no waves) */
  function huntressHairPx(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.002, -0.004]), cr = P.cran, R = [cr[0] * 1.06, cr[1] * 1.06, cr[2] * 1.07];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    for (const [tx, ty, tz, r] of [[0.5, 0.026, -0.002, 0.019], [1.0, -0.004, -0.022, 0.017], [-0.9, 0.004, -0.022, 0.016]]) {
      const s = Math.sign(tx), root = [-0.006 + s * 0.004, C[1] + R[1] * 0.62, C[2] + R[2] * 0.74];
      const mid = [R[0] * tx * 0.55, ey + 0.046, P.faceZ + 0.004 * q], tip = [R[0] * tx, ey + ty, P.faceZ + tz * q];
      strand(sc, [root, mid, tip], r * q, 0.004 * q, { k: 0.008, taper: 1.2, grooves: 0 });
    }
    const hairLen = 0.3 * (q > 1 ? 0.85 : 1);
    for (const s of [1, -1]) for (let j = 0; j < 2; j++) {
      const o = j - 0.5, n = sideName(s);
      const root = onEll(C, R, s * (1.2 + 0.2 * o), 0.1, 0.98);
      const a = [s * R[0] * (1.12 + 0.08 * o), ey - 0.015 * q, C[2] + R[2] * (0.45 - 0.16 * o)];
      const b = [s * R[0] * (1.18 + 0.12 * o), P.chinY - 0.025 * q, C[2] + R[2] * (0.55 - 0.2 * o)];
      const tip = [s * P.shX * (0.62 + 0.2 * o), ey - hairLen * (s > 0 ? 1 : 0.88), P.chest[3] + 0.02 - 0.016 * o];
      const sp = strand(sc, [root, a, b, lerp(b, tip, 0.5), tip], 0.02 * q, 0.006 * q, { k: 0.012, wg: 4, swell: 0.2, bone: "hair" + n, grooves: 0 });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - hairLen * 0.8, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
  }
  /* pixel sprite: the kit spear with a blade and leaf guards thick enough to survive the sprite (same grip and length) */
  function spearPx(fam) {
    const sc = spearProp(fam), Lf = fam === "chibi" ? 0.8 : fam === "chunky" ? 0.92 : 1.05, top = Lf * 0.5;
    sc.prims = sc.prims.filter((p) => p.mat !== "steel" && p.mat !== "leaf");
    const bl = 0.16, bw = 0.032;
    sc.add(S.custom((x, y, z) => {
      const u = clamp(y / bl, 0, 1), w = bw * Math.sin(Math.PI * Math.pow(u, 0.75)) * (1 - 0.15 * u) + 0.003;
      return Math.max(Math.abs(x) - w, Math.abs(z) - (0.011 * (1 - 0.5 * u) + 0.004), -y, y - bl);
    }, [-bw - 0.004, 0, -0.016, bw + 0.004, bl, 0.016]), { mat: "steel", p: [0, top + 0.01, 0], bone: "p", k: 0.001 });
    for (const s of [1, -1]) sc.add(S.ell(0.012, 0.03, 0.008), { mat: "leaf", p: [s * 0.022, top - 0.012, 0.004], r: [0, 0, s * 0.7], bone: "p", k: 0.002 });
    return sc;
  }
  function huntressHair(sc, P, fam) {
    if (fam === "chibi") return chibiHair(sc, P, "huntress");
    if (K.pixel) return huntressHairPx(sc, P, fam === "chunky" ? 1.25 : 1);
    const chib = false, q = fam === "chunky" ? 1.25 : 1;
    const ey = P.eyeY, C = add(P.cranC, [0, 0.002, -0.004]), cr = P.cran, R = [cr[0] * 1.06, cr[1] * 1.06, cr[2] * 1.07];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // side-swept fringe (to her left)
    for (let i = 0; i < 7; i++) {
      const u = i / 6, s = i < 5 ? 1 : -1, uu = i < 5 ? u / (4 / 6) : (i - 5) / 1;
      const root = [-0.008 * q + s * 0.003, C[1] + R[1] * (0.6 - 0.05 * uu), C[2] + R[2] * (0.72 + 0.08 * uu)];
      const mid = [-0.006 + s * R[0] * (0.3 + 0.22 * uu), ey + (chib ? 0.1 : 0.034), P.faceZ + 0.003 * q];
      const tip = [s * R[0] * (0.55 + 0.3 * uu), ey + (chib ? 0.03 : 0.006) - (chib ? 0.04 : 0.014) * uu, P.faceZ - 0.01 * q - 0.012 * q * uu];
      strand(sc, [root, mid, tip], 0.0105 * q, 0.0016 * q, { k: 0.007, taper: 1.2 });
    }
    // long wavy locks spilling out of the hood over the shoulders and chest
    const hairLen = (chib ? 0.2 : 0.3) * (fam === "chunky" ? 0.85 : 1);
    for (const s of [1, -1]) for (let j = 0; j < 4; j++) {
      const o = j - 1.5, n = sideName(s);
      const root = onEll(C, R, s * (1.2 + 0.1 * o), 0.1, 0.98);
      const a = [s * R[0] * (1.12 + 0.04 * o), ey - 0.015 * q, C[2] + R[2] * (0.45 - 0.08 * o)];
      const b = [s * R[0] * (1.18 + 0.06 * o), P.chinY - 0.025 * q, C[2] + R[2] * (0.55 - 0.1 * o)];
      const tip = [s * P.shX * (0.62 + 0.1 * o), ey - hairLen * (s > 0 ? 1 : 0.88) * (1 - 0.06 * Math.abs(o)), P.chest[3] + 0.02 - 0.008 * o];
      const sp = strand(sc, [root, a, b, lerp(b, tip, 0.5), tip], (0.013 - 0.001 * Math.abs(o)) * q, 0.0025 * q, { wave: 0.008 * q, wd: [s, 0, 0.35], waves: 2.4 + 0.2 * o, phase: j * 1.3, k: 0.011, wg: 4, swell: 0.2, bone: "hair" + n });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - hairLen * 0.8, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
  }

  function huntress(fam) {
    const P = FAM[fam], sc = new Sculpture(), PX = K.pixel;   // PX: pixel sprite — fewer, fatter shapes, calm folds
    humanoidBones(sc, P);
    const chib = fam === "chibi", q = chib ? 1.7 : fam === "chunky" ? 1.25 : 1;
    const capeTop = P.shY + 0.01, capeBot = chib ? P.kneeY + 0.02 : mix(P.kneeY, P.hipY, 0.2);
    capeBones(sc, P, capeTop, capeBot, -P.chest[3] - 0.02);
    sc.bone("hairL", "head", 0.04, P.eyeY - 0.03, 0.03); sc.bone("hairR", "head", -0.04, P.eyeY - 0.03, 0.03);
    mats(sc, {
      skin: { c: 0xf1cdb4, rough: 0.55, cls: CLS.skin, vary: 0.02 }, skinDeep: { c: 0xd9a58c, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xc97f76, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x6a4127, rough: 0.58, cls: CLS.hair, vary: 0.1 },
      hood: { c: 0x3d6b35, rough: 0.85, cls: CLS.cloth, vary: 0.06 }, hoodIn: { c: 0x223d20, rough: 0.9, cls: CLS.cloth },
      cape: { c: 0x3a6632, rough: 0.85, cls: CLS.cloth, vary: 0.06 },
      tunic: { c: 0x46743a, rough: 0.85, cls: CLS.cloth, vary: 0.05 },
      corset: { c: 0x4e301d, rough: 0.6, cls: CLS.leather, vary: 0.1 }, strap: { c: 0x2f1c11, rough: 0.65, cls: CLS.leather },
      boots: { c: 0x533421, rough: 0.55, cls: CLS.leather, vary: 0.1 }, bootDark: { c: 0x3a2416, rough: 0.6, cls: CLS.leather },
      bracer: { c: 0x5c3b24, rough: 0.55, cls: CLS.leather, vary: 0.1 }, glove: { c: 0x3a2618, rough: 0.6, cls: CLS.leather },
      gold: { c: 0xd2ad5c, rough: 0.3, metal: 1, cls: CLS.metal },
    });
    body(sc, P, fam);
    const X0 = P.shX * 0.93, legX = 0.17;
    // tunic (torso, with a scooped neckline) → leather corset → belts
    const neckCut = RG.ball([0, P.neck[0] + 0.02 * q, P.chest[3] * 0.6], P.chest[3] * 0.75);
    wrap(sc, RG.box(-X0, X0, P.pelvis[0] - 0.02, P.neck[0] + 0.012), "tunic", 0.003 * q);
    wrap(sc, RG.box(-X0, X0, P.waist[0] - 0.035 * q, P.chest[0] - P.chest[2] * 0.25), "corset", 0.006 * q);
    if (PX) wrap(sc, RG.box(-X0, X0, P.waist[0] - 0.012 * q, P.waist[0] + 0.004 * q), "strap", 0.0045 * q);
    else for (const dy of [-0.022, -0.004, 0.014]) wrap(sc, RG.box(-X0, X0, P.waist[0] + dy * q - 0.0025 * q, P.waist[0] + dy * q + 0.0025 * q), "strap", 0.0035 * q);
    wrap(sc, RG.band([0, P.pelvis[0] + P.pelvis[2] * 0.25, 0], [0, 1, -0.25], 0.006 * q, RG.box(-0.2, 0.2, P.pelvis[0] - 0.05, P.waist[0])), "strap", 0.0045 * q);
    // skirt
    sc.part = "cloth";
    skirt(sc, P, P.pelvis[0] + P.pelvis[2] * 0.3, mix(P.hipY, P.kneeY, chib ? 0.3 : 0.4), P.pelvis[1] * 1.14 + 0.006, P.pelvis[1] * (chib ? 1.4 : 1.36), "tunic", { folds: PX ? 4 : 7, amp: PX ? 0.004 : chib ? 0.01 : 0.008, sz: 0.86, t: 0.006 * (chib ? 1.4 : 1) });
    sc.part = "body";
    // thigh-high boots, bracers, gloves
    for (const s of [1, -1]) {
      const n = sideName(s), l = legJoints(P, s), a = armJoints(P, s);
      const bootTop = mix(P.kneeY, P.hipY, chib ? 0.4 : 0.42);
      wrap(sc, RG.box(s > 0 ? 0 : -legX, s > 0 ? legX : 0, -0.02, bootTop), "boots", 0.005 * q);
      wrap(sc, RG.box(s > 0 ? 0 : -legX, s > 0 ? legX : 0, bootTop - 0.012 * q, bootTop), "bootDark", 0.0035 * q);
      wrap(sc, RG.ball(add(l.K, [0, 0.004, P.thigh[1] * 0.8]), P.thigh[1] * 0.9), "bootDark", 0.004 * q);
      wrap(sc, RG.box(s > 0 ? 0 : -legX, s > 0 ? legX : 0, -0.02, 0.012 * q), "bootDark", 0.003 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.08), a.W, 0.07), "bracer", 0.0045 * q);
      if (!PX) for (const u of [0.14, 0.5, 0.86]) wrap(sc, RG.seg(lerp(a.E, a.W, u - 0.025), lerp(a.E, a.W, u + 0.025), 0.07), "strap", 0.0025 * q);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.05 * P.hand), "glove", 0.002 * q);
    }
    // cape + capelet over the shoulders
    sc.part = "cloth";
    cape(sc, P, capeTop, capeBot, P.shX * 0.95, P.shX * (chib ? 1.5 : 1.9), "cape", { folds: PX ? 3 : 6, amp: PX ? 0.006 : chib ? 0.012 : 0.01, t: chib ? 0.009 : 0.0065 });
    bell(sc, P.neck[0] + 0.012 * q, P.chest[0] - P.chest[2] * 0.35, P.neck[2] * 1.9, P.shX + P.delt * 1.15, "cape", { t: chib ? 0.01 : 0.0065, sz: (P.chest[3] * 1.5) / (P.shX + P.delt), folds: 9, amp: (PX ? 1e-6 : 0.006) * q, z: -0.006, bones: [["chest", 1]] });
    // hood (up): hugs the skull and hair, open over the face, drapes down behind the neck
    const hc = add(P.cranC, [0, -P.cran[1] * 0.06, -P.cran[2] * 0.06]), hr = [P.cran[0] * 1.26, P.cran[1] * 1.2, P.cran[2] * 1.24], ht = chib ? 0.011 : 0.0065;
    const hoodSolid = S.union(S.ell(...hr), S.at(S.ell(hr[0] * 0.95, hr[1] * 0.9, hr[2] * 0.75), 0, -hr[1] * 0.75, -hr[2] * 0.35), 0.03);
    const faceOpen = S.at(S.ell(P.face[0] * (chib ? 1.2 : 1.45) * (PX ? 1.15 : 1), (P.crown - P.chinY) * (chib ? 0.5 : 0.62) * (PX ? 1.08 : 1), 0.12 * (chib ? 2 : 1)), 0, (P.eyeY - hc[1]) - 0.004, (P.faceZ - hc[2]) + 0.1 * (chib ? 1.6 : 1) - (chib ? 0.06 : 0.035));
    const hood = S.minus(S.minus(hoodSolid, S.union(S.ell(hr[0] - ht * 2, hr[1] - ht * 2, hr[2] - ht * 2), S.at(S.ell(hr[0] * 0.95 - ht * 2, hr[1] * 0.9 - ht * 2, hr[2] * 0.75 - ht * 2), 0, -hr[1] * 0.75, -hr[2] * 0.35), 0.03)), faceOpen, 0.004);
    // pixel: open the hood's front below the eyes too, so no hood rim creeps over the cheeks
    const hoodPx = PX ? S.minus(hood, S.at(S.box(0.1, (P.eyeY - 0.02 - (P.chinY - 0.07)) / 2, 0.07, 0.004), 0, (P.eyeY - 0.02 + P.chinY - 0.07) / 2 - hc[1], 0.05 - hc[2]), 0.004) : hood;
    sc.add(hoodPx, { mat: "hood", p: hc, bone: "head", k: 0.006, cs: 0.03, wfn: null });
    sc.prims[sc.prims.length - 1].wfn = (x, y) => { const u = sstep(P.chinY, P.neck[0] - 0.01, y); return [["head", 1 - u], ["neck", u * 0.5], ["chest", u * 0.5]]; };
    sc.paint(S.union(S.ell(hr[0] - ht, hr[1] - ht, hr[2] - ht), S.at(S.ell(hr[0] * 0.95 - ht, hr[1] * 0.9 - ht, hr[2] * 0.75 - ht), 0, -hr[1] * 0.75, -hr[2] * 0.35), 0.03), { mat: "hoodIn", p: hc, soft: 0.002, only: ["hood"] });
    if (!PX) sc.add(S.cyl(0.003 * q, 0.009 * q, 0.002), { mat: "gold", p: [0, P.shY - 0.02 * q, P.chest[3] + 0.024 * q], r: [Math.PI / 2 - 0.3, 0, 0], bone: "chest", k: 0.002 });
    // hair: cap under the hood, side-swept fringe, long wavy locks over the shoulders
    sc.part = "hair";
    huntressHair(sc, P, fam);
    sc.part = "body";
    sc.faceKind = "huntress";
    return { sc, P, kind: "humanoid", props: [{ sc: PX ? spearPx(fam) : spearProp(fam), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }] };
  }

  return {
    cards: ["huntress"], kind: "humanoid", build: huntress,
    face: { kind: "human", look: { eye: 0x6f8a3a, brow: "#4a2a18", lash: "#1d110b", lip: "#c07c6c", skinD: "#dfab92" } },
    moves: { attack: { clip: "spear", style: "thrust", trail: { prop: "spear", from: [0, 0.3, 0], to: [0, 0.62, 0] } } },
  };
})());
