/* 薇丝珀 · 暗影游侠 — the ranger hero: elf archer, dark hair, green mantle, bow and quiver (card archer, hero ranger). */
EmberVoxelKit.define("vesper", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, lin, vnoise, fbm, clamp, mix, sstep, rotm, rotY2, smax, TAU, add, sub, mul, lerp, norm, cross, X,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, handFrame, hand, foot, head,
    RG, wrap, bell, skirt, cape, capeBones, lock, cuff, spline, strand, onEll, chibiHair,
    spearProp, bowProp, quiverProp, QF, quadBones, scaleG } = K;
  function vesperHair(sc, P, fam) {
    if (fam === "chibi") return chibiHair(sc, P, "vesper");
    const chib = false, q = fam === "chunky" ? 1.25 : 1;
    const ey = P.eyeY, C = add(P.cranC, [0, 0.003, -0.004]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.07, cr[2] * 1.08];
    const partX = 0.006 * q;
    // cap with the hairline cut out of the face
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // combed strands from the part over the crown
    for (const s of [1, -1]) for (let i = 0; i < 7; i++) {
      const u = i / 6, az0 = 0.05 + u * 2.6;
      const root = onEll(C, R, s > 0 ? 0 : 0, 0.55 + 0.9 * u, 1.0); root[0] = partX + s * 0.002;
      const tipAz = s * (0.9 + 0.35 * u), tipEl = 0.1 - 0.15 * u;
      strand(sc, [root, onEll(C, R, s * (0.35 + 0.3 * u), 0.72 - 0.1 * u, 1.04), onEll(C, R, tipAz, tipEl, 1.04)], 0.0085 * q, 0.004 * q, { k: 0.008, grooves: 0.001 });
    }
    // curtain fringe: sweeps from the part over the forehead to the temples
    for (const s of [1, -1]) for (let i = 0; i < 5; i++) {
      const u = i / 4;
      const root = [partX + s * 0.004, C[1] + R[1] * (0.62 - 0.08 * u), C[2] + R[2] * (0.72 + 0.1 * u)];
      // kept above the brow line so both eyes read (the tips reach the temples, outside the eyes)
      const mid = [partX + s * R[0] * (0.35 + 0.1 * u), ey + (chib ? 0.1 : 0.047) + 0.006 * u, P.faceZ + 0.002 * q];
      const tip = [s * R[0] * (0.74 + 0.12 * u), ey + (chib ? 0.02 : 0.016) - (chib ? 0.05 : 0.014) * u, P.faceZ - 0.012 * q - 0.012 * q * u];
      strand(sc, [root, mid, tip], (0.01 + 0.002 * (1 - u)) * q, 0.0016 * q, { k: 0.007, taper: 1.2 });
    }
    // a short forelock at the part closes the forehead gap between the two curtains
    strand(sc, [[partX, C[1] + R[1] * 0.66, C[2] + R[2] * 0.7], [partX - 0.004 * q, ey + 0.058, P.faceZ + 0.004 * q], [partX - 0.012 * q, ey + 0.04, P.faceZ + 0.003 * q]], 0.011 * q, 0.003 * q, { k: 0.007, taper: 1.1 });
    // face-framing strands in front of the ears, wavy, to the collarbone
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const o = i - 1;
      const root = onEll(C, R, s * (1.15 + 0.12 * o), 0.25, 1.0);
      strand(sc, [root, [s * R[0] * (1.08 + 0.05 * o), ey - 0.01 * q, C[2] + R[2] * (0.35 - 0.1 * o)], [s * R[0] * (1.05 + 0.08 * o), P.chinY - 0.02 * q, C[2] + R[2] * (0.28 - 0.12 * o)], [s * P.shX * (0.58 + 0.1 * o), P.neck[0] - 0.035 * q * (1 - 0.3 * Math.abs(o)), P.chest[3] * 0.5]],
        0.011 * q, 0.0022 * q, { wave: 0.006 * q, wd: [s, 0, 0], waves: 2.2, phase: i, k: 0.009, wg: 4, bone: "head" });
      sc.prims[sc.prims.length - 1].wfn = (x, y) => { const t = sstep(ey, P.neck[0] - 0.02, y); return [["head", 1 - t * 0.5], ["neck", t * 0.5]]; };
    }
    // voluminous wavy back mass: clumps from the back of the scalp to mid-back
    const backLen = (chib ? 0.22 : 0.19) * (fam === "chunky" ? 0.9 : 1);
    const N = 15;
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1, az = Math.PI + u * 1.75, el = 0.35 - 0.25 * Math.abs(u);
      const root = onEll(C, R, az, el, 0.98);
      const out = onEll(C, R, az, -0.35, 1.22);
      const len = backLen * (0.85 + 0.2 * (1 - Math.abs(u))) + 0.012 * Math.sin(i * 2.3);
      const tip = [out[0] * 1.05 + u * 0.01, P.neck[0] - len, Math.min(out[2], -P.chest[3] - 0.008 - 0.012 * (1 - Math.abs(u)))];
      const mid = lerp(out, tip, 0.45); mid[2] -= 0.01;
      const sp = strand(sc, [root, out, mid, tip], (0.017 - 0.004 * Math.abs(u)) * q, 0.0028 * q, { wave: 0.008 * q, wd: [Math.cos(az), 0, -Math.sin(az) * 0.3], waves: 2.3, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.25, bone: "hairB1" });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.01, P.neck[0] - backLen, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    // leaf clip on the left side
    sc.add(S.custom((x, y, z) => { const u = clamp((y + 0.018) / 0.036, 0, 1), w = 0.009 * Math.sin(Math.PI * u); return Math.max(Math.abs(z) - w, Math.abs(x) - 0.0025, -(y + 0.018), y - 0.018); }, [-0.003, -0.018, -0.01, 0.003, 0.018, 0.01]),
      { mat: "leaf", p: onEll(C, R, 1.9, 0.3, 1.05), r: [0.9, 0.2, -0.5], s: q, bone: "head", k: 0.002 });
  }

  // chibi hair: a helmet-like mass that hugs the big head, a few big pointed locks
  function vesper(fam) {
    const P = FAM[fam], sc = new Sculpture();
    humanoidBones(sc, P);
    const chib = fam === "chibi", q = chib ? 1.7 : fam === "chunky" ? 1.25 : 1;
    const capeTop = P.shY + 0.004, capeBot = chib ? P.ankY + 0.08 : mix(P.ankY, P.kneeY, 0.3);
    capeBones(sc, P, capeTop, capeBot, -P.chest[3] - 0.025);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -P.cran[2] * 0.9); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.02, -P.cran[2] * 0.9);
    mats(sc, {
      skin: { c: 0xecc3a6, rough: 0.55, cls: CLS.skin, vary: 0.02 }, skinDeep: { c: 0xd29c80, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xb8736a, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x2e2018, rough: 0.58, cls: CLS.hair, vary: 0.12 },
      cloak: { c: 0x3f6d36, rough: 0.85, cls: CLS.cloth, vary: 0.06 }, cloakIn: { c: 0x27431f, rough: 0.9, cls: CLS.cloth },
      shirt: { c: 0xd8ccae, rough: 0.9, cls: CLS.cloth, vary: 0.04 },
      jerkin: { c: 0x3e281b, rough: 0.6, cls: CLS.leather, vary: 0.1 },
      bracer: { c: 0x6c4529, rough: 0.5, cls: CLS.leather, vary: 0.12 },
      glove: { c: 0x2a1c14, rough: 0.6, cls: CLS.leather },
      belt: { c: 0x4d3020, rough: 0.6, cls: CLS.leather, vary: 0.08 },
      pants: { c: 0x3a3428, rough: 0.85, cls: CLS.cloth, vary: 0.05 },
      boots: { c: 0x3b271a, rough: 0.55, cls: CLS.leather, vary: 0.1 },
      brass: { c: 0xb8935a, rough: 0.32, metal: 1, cls: CLS.metal },
      leaf: { c: 0x6f9a3c, rough: 0.6, cls: CLS.plant },
    });
    body(sc, P, fam);
    const X0 = P.shX * 0.93, legX = 0.17, jBot = P.pelvis[0] - P.pelvis[2] * 0.3;
    // linen shirt with sleeves to the elbow
    const armR = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.3)), lerp(a.S, a.E, 1.05), 0.08); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.02, P.neck[0] + 0.035), ...armR), "shirt", 0.003 * q);
    // leather jerkin: sleeveless, V-neck
    const vcut = S.custom((x, y, z) => (z > 0 ? Math.abs(x) - Math.max(0, (y - (P.chest[0] - 0.015 * q)) * 0.6) : 1), [-0.3, -0.3, 0, 0.3, 1.2, 0.3]);
    wrap(sc, RG.minus(RG.box(-X0 * 0.97, X0 * 0.97, jBot, P.neck[0] + 0.02), vcut), "jerkin", 0.0055 * q);
    // belts: waist belt, hip belt (tilted), buckle, quiver strap across the chest
    wrap(sc, RG.box(-0.25, 0.25, P.waist[0] - 0.02 * q, P.waist[0] - 0.004 * q), "belt", 0.004 * q);
    wrap(sc, RG.band([0, P.pelvis[0] + P.pelvis[2] * 0.1, 0], [0.18, 1, -0.2], 0.0065 * q, RG.box(-0.2, 0.2, P.pelvis[0] - 0.06, P.waist[0])), "belt", 0.004 * q);
    {
      const A = [-P.shX * 0.7, P.shY + 0.01, 0], B0 = [P.pelvis[1] * 0.85, P.pelvis[0], 0];
      const dir = norm(sub(B0, A)), n = norm(cross(dir, [0, 0, 1]));
      wrap(sc, RG.band(A, n, 0.0075 * q, RG.box(-X0, X0, P.pelvis[0] - 0.02, P.shY + 0.05)), "belt", 0.004 * q);
    }
    sc.add(S.box(0.011 * q, 0.009 * q, 0.003, 0.002), { mat: "brass", p: [0, P.waist[0] - 0.012 * q, P.waist[2] + 0.02 * q], bone: "spine", k: 0.002 });
    for (const s of [1, -1]) sc.add(S.box(0.016 * q, 0.018 * q, 0.01 * q, 0.005), { mat: "belt", p: [s * (P.pelvis[1] * 0.78), P.pelvis[0] - 0.005, P.pelvis[3] * 0.6], r: [0, s * 0.5, 0], bone: "root", k: 0.004, cs: 0.03 });
    // bracers, gloves, trousers, knee boots
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.1), a.W, 0.07), "bracer", 0.005 * q);
      for (const u of [0.12, 0.92]) wrap(sc, RG.seg(lerp(a.E, a.W, u - 0.03), lerp(a.E, a.W, u + 0.03), 0.07), "belt", 0.003 * q);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.05 * P.hand), "glove", 0.002 * q);
    }
    wrap(sc, RG.box(-legX, legX, -0.02, jBot + 0.03), "pants", 0.003 * q);
    const bootTop = P.kneeY + 0.03 * q;
    wrap(sc, RG.box(-legX, legX, -0.02, bootTop), "boots", 0.005 * q);
    wrap(sc, RG.box(-legX, legX, bootTop - 0.02 * q, bootTop), "boots", 0.004 * q);
    wrap(sc, RG.box(-legX, legX, -0.02, 0.012 * q), "belt", 0.003 * q);
    // cloak: long cape + thick cowl round the neck + folded hood
    sc.part = "cloth";
    cape(sc, P, capeTop, capeBot, P.shX * 1.0, P.shX * (chib ? 1.55 : 2.1), "cloak", { folds: 7, amp: chib ? 0.014 : 0.012, t: chib ? 0.009 : 0.0065 });
    // shoulder mantle: a shell over the shoulders, open at the front below the collar
    bell(sc, P.neck[0] + 0.014 * q, P.chest[0] - 0.012 * q, P.neck[2] * 1.85, P.shX + P.delt * 1.25, "cloak", { t: chib ? 0.011 : 0.0075, sz: (P.chest[3] * 1.75) / (P.shX + P.delt), folds: 9, amp: 0.006 * q, z: -0.012, slit: 0.045 * q, pw: 0.45, bones: [["chest", 1]] });
    sc.add(S.ell(P.shX * 0.55, 0.035 * q, 0.03 * q), { mat: "cloak", p: [0, P.neck[0] + 0.005, -P.chest[3] - 0.03], r: [0.4, 0, 0], bone: "chest", k: 0.012, cs: 0.03 });
    sc.paint(S.ell(P.shX * 0.5, 0.02 * q, 0.012 * q), { mat: "cloakIn", p: [0, P.neck[0] + 0.03, -P.chest[3] - 0.012], soft: 0.006, only: ["cloak"] });
    sc.part = "body";
    const lb = S.custom((x, y, z) => { const u = clamp((y + 0.02) / 0.04, 0, 1), w = 0.012 * Math.sin(Math.PI * u); return Math.max(Math.abs(x) - w, Math.abs(z) - 0.003, -(y + 0.02), y - 0.02); }, [-0.013, -0.02, -0.004, 0.013, 0.02, 0.004]);
    sc.add(lb, { mat: "brass", p: [P.shX * 0.5, P.shY - 0.03, P.chest[3] + 0.022 * q], r: [-0.2, 0, 0.5], s: q, bone: "chest", k: 0.002 });
    // hair: clumped strands (cap, combed crown, curtain fringe, framing strands, wavy back mass)
    sc.part = "hair";
    vesperHair(sc, P, fam);
    sc.part = "body";
    sc.faceKind = "vesper";
    return {
      sc, P, kind: "humanoid",
      props: [
        { sc: bowProp(fam), bone: "handL", at: armJoints(P, 1).W, grip: "bow" },
        { sc: quiverProp(fam), bone: "chest", at: [-0.035 * q, P.chest[0] + 0.01, -P.chest[3] - 0.034 * q], rot: [0.12, 0, 0.35], grip: "back" },
      ],
    };
  }
  return {
    cards: ["archer", "hero:ranger"], kind: "humanoid", build: vesper,
    face: { kind: "human", look: { eye: 0x6f8f5a, brow: "#2a1a12", lash: "#150c08", lip: "#b27466", skinD: "#d8a58c" } },
    moves: { attack: { clip: "bow", style: "arrow", ranged: true, windup: 300 } },
  };
})());
