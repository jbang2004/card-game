/* 烬翼斥候 — a silver-haired scout in white-silver armour over a navy suit, borne up by two
 * mechanical wings of long steel blades with amber-lit joints (card sentinel). */
EmberVoxelKit.define("sentinel", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const V = 0.0125, vb = (x) => Math.round(x / V) * V;   // snap to a voxel boundary (a plate ±t < V/2 there is exactly 2 voxels thick)

  // wing layout (bind pose): struts from a back plate to a hub over each shoulder; four blades per wing, all pointing
  // straight up from the hub, two voxels thick and stacked a voxel apart in depth like a closed fan — the pose opens it
  const WING = { mount: [0.052, 0.735, -0.088], hub: [0.152, 0.862, -0.118], z0: vb(-0.14), dz: 3 * V, len: [0.5, 0.53, 0.46, 0.37], w: 0.045 };
  const BLADES = WING.len.length;
  const bladeZ = (k) => WING.z0 - k * WING.dz;

  function sentinelHair(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.008, -0.008]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.05, cr[2] * 1.08];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.52, cr[2] * 0.7), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    const spike = (az, el, az2, el2, len, r0, dy = 0) => sc.limb(onEll(C, R, az, el, 0.55), add(onEll(C, R, az2, el2, len), [0, dy, 0]), r0 * q, 0.0015 * q, { mat: "hair", bone: "head", k: 0.005 });
    // windswept: long spikes streaming back from the crown and temples
    [[0.6, 1.25, 2.7, 0.6, 1.5], [1.2, 1.1, 2.55, 0.4, 1.48], [-1.2, 1.1, -2.55, 0.4, 1.48], [0, 1.35, 3.14, 0.72, 1.55], [2.2, 1.0, 2.9, 0.22, 1.5], [-2.2, 1.0, -2.9, 0.22, 1.5],
      [3.14, 0.9, 3.14, 0.3, 1.55], [2.6, 0.6, 2.95, -0.1, 1.45], [-2.6, 0.6, -2.95, -0.1, 1.45], [-0.6, 1.25, -2.7, 0.6, 1.5]]
      .forEach(([a, e, a2, e2, l], i) => spike(a, e, a2, e2, l, 0.022 + 0.003 * (i % 2)));
    for (const s of [1, -1]) { spike(s * 1.4, 0.35, s * 1.85, -0.25, 1.38, 0.019); spike(s * 1.75, 0.1, s * 2.2, -0.5, 1.32, 0.018); spike(s * 1.15, 0.8, s * 1.75, 0.35, 1.42, 0.021); spike(s * 0.85, 0.55, s * 1.5, 0.1, 1.36, 0.018); spike(s * 1.3, 0.55, s * 1.62, 0.42, 1.4, 0.019); }
    // fringe: pointed locks swept across the forehead to his right, a few falling between the eyes
    const fr = [[0.95, 0.03, -0.2], [0.62, 0.016, -0.35], [0.3, 0.004, -0.4], [0.0, -0.004, -0.3], [-0.32, 0.01, -0.25], [-0.64, 0.02, -0.15], [-0.95, 0.03, -0.05]];
    fr.forEach(([u, dy, sw], i) => {
      const root = onEll(C, R, u * 0.5 + 0.1, 0.9, 0.94);
      const tip = [R[0] * (0.78 * u + sw * 0.5), ey + (0.02 + dy) * q, P.faceZ + (0.012 - 0.016 * Math.abs(u)) * q];
      const mid = add(lerp(root, tip, 0.45), mul(norm(sub(lerp(root, tip, 0.45), C)), 0.016 * q));
      strand(sc, [root, mid, tip], (0.013 + 0.002 * (i % 2)) * q, 0.0016 * q, { k: 0.007, taper: 1.05, grooves: 0.001 });
    });
    for (const s of [1, -1]) {
      const root = onEll(C, R, s * 1.1, 0.45, 0.96), tip = [s * R[0] * 1.04, P.chinY + 0.03 * q, C[2] + R[2] * 0.38];
      strand(sc, [root, add(lerp(root, tip, 0.5), [s * 0.008 * q, 0, 0]), tip], 0.013 * q, 0.0016 * q, { k: 0.007, taper: 1.05, grooves: 0.001 });
    }
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = fam === "chunky" ? 1.25 : 1;
    humanoidBones(sc, P);
    for (const s of [1, -1]) {
      const n = sideName(s), X = (p) => [s * p[0], p[1], p[2]];
      sc.bone("wing1" + n, "chest", ...X(WING.mount));
      sc.bone("wing2" + n, "wing1" + n, ...X(WING.hub));
      for (let k = 0; k < BLADES; k++) sc.bone("blade" + (k + 1) + n, "wing2" + n, ...X(WING.hub));
    }
    sc.bone("scarf1", "chest", 0, 0.782, -0.07); sc.bone("scarf2", "scarf1", 0, 0.7, -0.2);
    mats(sc, {
      skin: { c: 0xf1cfbd, rough: 0.55, cls: CLS.skin, vary: 0.02 }, skinDeep: { c: 0xd9a993, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xc98c80, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xbfc8e2, rough: 0.5, cls: CLS.hair, vary: 0.07 },
      suit: { c: 0x1f2438, rough: 0.8, cls: CLS.cloth, vary: 0.05 },
      armor: { c: 0xb4c0d8, rough: 0.32, metal: 1, cls: CLS.metal }, armorD: { c: 0x66718c, rough: 0.4, metal: 1, cls: CLS.metal },
      inlay: { c: 0x2a4aa6, rough: 0.45, metal: 0.3, cls: CLS.metal },
      strap: { c: 0x5a3a25, rough: 0.6, cls: CLS.leather, vary: 0.08 }, gold: { c: 0xd2ab5a, rough: 0.3, metal: 1, cls: CLS.metal },
      glove: { c: 0x24262f, rough: 0.6, cls: CLS.leather }, boot: { c: 0x2a2d3b, rough: 0.55, cls: CLS.leather, vary: 0.06 },
      scarf: { c: 0x2d4088, rough: 0.85, cls: CLS.cloth, vary: 0.06 }, scarfD: { c: 0x1d2a5e, rough: 0.9, cls: CLS.cloth },
      wing: { c: 0xacb9d6, rough: 0.26, metal: 1, cls: CLS.metal }, wingD: { c: 0x6c7896, rough: 0.35, metal: 0.9, cls: CLS.metal },
      wingIn: { c: 0x2a4aa6, rough: 0.4, metal: 0.4, cls: CLS.metal },
      amber: { c: 0xbe6c1e, rough: 0.3, emit: 0.9, cls: CLS.glow }, amberHot: { c: 0xffe6b0, rough: 0.3, emit: 1.8, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const X0 = P.shX * 0.93, legX = 0.17;
    // ---- navy flight suit everywhere, silver cuirass with a blue keel line, belts
    wrap(sc, RG.box(-0.4, 0.4, -0.02, P.neck[0] + 0.03), "suit", 0.003 * q);
    const cuirass = RG.box(-X0 * 1.02, X0 * 1.02, P.waist[0] + 0.012, P.neck[0] + 0.022);
    wrap(sc, cuirass, "armor", 0.008 * q);
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.max(Math.abs(x) - 0.0065, y - (P.neck[0] - 0.005)) : 1), [-1, -1, -1, 1, 1, 1]), { mat: "inlay", soft: 0.001, only: ["armor"] });
    sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - (P.waist[0] + 0.018)) - 0.0062, Math.abs(x) - X0 * 1.05), [-1, -1, -1, 1, 1, 1]), { mat: "inlay", soft: 0.001, only: ["armor"] });
    wrap(sc, RG.box(-0.2, 0.2, P.waist[0] - 0.03 * q, P.waist[0] - 0.006 * q), "strap", 0.005 * q);
    sc.add(S.box(0.012 * q, 0.01 * q, 0.004, 0.002), { mat: "gold", p: [0, P.waist[0] - 0.018 * q, P.waist[2] + 0.022 * q], bone: "spine", k: 0.002 });
    {   // bandolier across the chest from the right shoulder to the left hip
      const A = [-P.shX * 0.72, P.shY + 0.012, 0], B0 = [P.pelvis[1] * 0.8, P.waist[0] - 0.02, 0];
      const dir = norm(sub(B0, A)), nrm = norm([dir[1], -dir[0], 0]);
      wrap(sc, RG.band(A, nrm, 0.0072 * q, RG.box(-X0 * 1.1, X0 * 1.1, P.waist[0] - 0.04, P.shY + 0.05)), "strap", 0.012 * q);
      const bk = lerp(A, B0, 0.36);
      sc.add(S.box(0.01 * q, 0.0085 * q, 0.004, 0.002), { mat: "gold", p: [bk[0], bk[1], P.chest[3] + 0.028 * q], r: [0, 0, Math.atan2(dir[1], dir[0]) + Math.PI / 2], bone: "chest", k: 0.002 });
    }
    // ---- pauldrons: two stacked plates per shoulder, blue rim
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), up = add(a.S, [s * 0.02, 0.022, 0]);
      const o = { bone: "arm" + n, bones: [["arm" + n, 0.7], ["clav" + n, 0.3]], k: 0.004, cs: 0.03 };
      sc.add(S.ell(0.05, 0.03, 0.056), { ...o, mat: "armor", p: up, r: [0, 0, s * -0.55] });
      sc.add(S.ell(0.042, 0.025, 0.05), { ...o, mat: "armor", p: add(up, [s * 0.024, -0.033, 0.002]), r: [0, 0, s * -0.75] });
      sc.paint(S.custom((x, y, z) => { const t = y - (up[1] - 0.052) - (s * (x - up[0])) * -0.5; return Math.max(Math.abs(t) - 0.0062, Math.hypot(x - up[0] - s * 0.02, z - up[2]) - 0.09, X0 * 1.04 - s * x); }, [-1, -1, -1, 1, 1, 1]), { mat: "inlay", soft: 0.001, only: ["armor"] });
      // vambraces with a blue stripe, dark gloves
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.18), lerp(a.W, a.E, -0.02), 0.07), "armor", 0.006 * q);
      wrap(sc, RG.seg(lerp(a.E, a.W, 0.45), lerp(a.E, a.W, 0.55), 0.07), "inlay", 0.0065 * q);
      wrap(sc, RG.ball(add(a.W, mul(a.dir, 0.035 * P.hand)), 0.05 * P.hand), "glove", 0.003 * q);
    }
    // ---- legs: knee guards, greaves, boots with steel toe caps
    const bootTop = 0.2;
    wrap(sc, RG.box(-legX, legX, -0.02, bootTop), "boot", 0.005 * q);
    wrap(sc, RG.box(-legX, legX, 0.06, P.kneeY - 0.02, 0.0, 0.4), "armor", 0.009 * q);
    wrap(sc, RG.box(-legX, legX, -0.02, 0.045, 0.03, 0.4), "armorD", 0.006 * q);
    for (const s of [1, -1]) {
      const n = sideName(s), l = legJoints(P, s);
      sc.add(S.ell(0.036, 0.042, 0.03), { mat: "armor", p: add(l.K, [0, 0.008, P.thigh[1] * 0.72]), bone: "shin" + n, bones: [["shin" + n, 0.6], ["thigh" + n, 0.4]], k: 0.006, cs: 0.03 });
      sc.add(S.ell(0.045, 0.06, 0.03), { mat: "armor", p: add(lerp(l.H, l.K, 0.4), [s * 0.012, 0, P.thigh[0] * 0.78]), r: [0.12, 0, 0], bone: "thigh" + n, k: 0.006, cs: 0.03 });
    }

    // ---- cloth: scarf and the wings
    sc.part = "cloth";
    // scarf: a thick roll round the neck and two tails streaming from the nape
    const sy = P.neck[0] + 0.034;
    sc.add(S.custom((x, y, z) => Math.hypot(Math.hypot(x / 1.0, (z + 0.004) / 0.92) - 0.05, (y - sy) * 1.1) - 0.018, [-0.075, sy - 0.022, -0.075, 0.075, sy + 0.022, 0.075]),
      { mat: "scarf", p: [0, 0, 0], bone: "chest", bones: [["chest", 0.7], ["neck", 0.3]], k: 0.004, cs: 0.03, wg: 2 });
    for (const s of [1, -1]) {
      const a = [s * 0.022, sy + 0.004, -0.062], b = [s * 0.05, sy - 0.07, -0.19], c = [s * 0.075, sy - 0.1, -0.31];
      const pts = K.spline([a, b, c], 16).map((p, i) => [p[0], p[1], p[2], mix(0.015, 0.011, i / 16)]);
      const tail = sc.add(S.chain(pts), { mat: s > 0 ? "scarf" : "scarfD", p: [0, 0, 0], bone: "scarf1", k: 0.004, cs: 0.03, wg: 2 });
      tail.wfn = (x, y, z) => { const u = clamp((-0.062 - z) / 0.25, 0, 1); return [["chest", 1 - sstep(0, 0.25, u)], ["scarf1", Math.max(0, 1 - Math.abs(u - 0.4) * 2.2)], ["scarf2", sstep(0.45, 1, u)]]; };
    }
    // back plate joining the wing struts
    sc.add(S.box(0.07, 0.052, 0.018, 0.012), { mat: "armorD", p: [0, 0.702, -0.083], bone: "chest", k: 0.004, cs: 0.03, wg: 3, sigma: 0.003 });
    sc.add(S.box(0.05, 0.036, 0.008, 0.006), { mat: "armor", p: [0, 0.706, -0.1], bone: "chest", k: 0.003, cs: 0.03, wg: 3, sigma: 0.003 });
    sc.add(S.cyl(0.005, 0.011, 0.002), { mat: "amber", p: [0, 0.706, -0.109], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.002, cs: 0.02, wg: 3, sigma: 0.003 });
    for (const s of [1, -1]) {
      const n = sideName(s), X = (p) => [s * p[0], p[1], p[2]], M = X(WING.mount), H = X(WING.hub);
      const zb = bladeZ(BLADES - 1) - 0.012, zf = WING.hub[2] + 0.02, hz = (zf - zb) / 2, hc = [H[0], H[1], (zf + zb) / 2];
      const wo = { wg: 3, sigma: 0.003, k: 0.003, cs: 0.03 };
      // strut: shoulder mount → hub, a joint collar at each end
      sc.limb(M, H, 0.019, 0.016, { ...wo, mat: "wing", bone: "wing1" + n, sx: 1, sz: 0.8 });
      sc.add(S.sphere(0.022), { ...wo, mat: "armorD", p: M, bone: "wing1" + n });
      // hub: a drum through the blade roots, amber lens facing forward, dark rings
      sc.add(S.cyl(hz, 0.03, 0.006), { ...wo, mat: "wing", p: hc, r: [Math.PI / 2, 0, 0], bone: "wing2" + n });
      for (const zr of [zf - 0.006, zb + 0.006]) sc.paint(S.custom((x, y, z) => Math.max(Math.abs(z - zr) - 0.004, Math.hypot(x - H[0], y - H[1]) - 0.04), [-1, -1, -1, 1, 1, 1]), { mat: "wingD", soft: 0.001, only: ["wing"] });
      sc.add(S.cyl(0.004, 0.024, 0.002), { ...wo, mat: "wingD", p: [H[0], H[1], zf + 0.001], r: [Math.PI / 2, 0, 0], bone: "wing2" + n });
      sc.add(S.cyl(0.004, 0.0155, 0.002), { ...wo, mat: "amber", p: [H[0], H[1], zf + 0.006], r: [Math.PI / 2, 0, 0], bone: "wing2" + n });
      sc.add(S.cyl(0.003, 0.0075, 0.001), { ...wo, mat: "amberHot", p: [H[0], H[1], zf + 0.011], r: [Math.PI / 2, 0, 0], bone: "wing2" + n });
      // blades: flat steel plates two voxels thick, a blue fuller down the middle, a darker trailing edge
      for (let k = 0; k < BLADES; k++) {
        const L = WING.len[k], w = WING.w, z0 = bladeZ(k), x0 = H[0], y0 = H[1];
        // blade frame: u up the blade (+Y), v across it (outward = +s·X), sharp asymmetric tip
        const top = (u) => (u < 0.72 * L ? w : mix(w, -0.2 * w, (u - 0.72 * L) / (0.28 * L)));
        const bot = (u) => (u < 0.52 * L ? -w : mix(-w, -0.2 * w, (u - 0.52 * L) / (0.48 * L)));
        const f = (x, y, z) => { const u = y - y0, v = s * (x - x0), ww = u < 0.07 ? 0.72 : 1; return Math.max(v - top(u) * ww, bot(u) * ww - v, -u, u - L, Math.abs(z - z0) - 0.004); };
        sc.add(S.custom(f, [x0 - w - 0.01, y0 - 0.01, z0 - 0.006, x0 + w + 0.01, y0 + L + 0.01, z0 + 0.006]), { ...wo, mat: "wing", p: [0, 0, 0], bone: "blade" + (k + 1) + n });
        const fuller = (x, y, z) => { const u = y - y0, v = s * (x - x0); return Math.max(Math.abs(v - 0.12 * w) - 0.0105, 0.12 * L - u, u - 0.62 * L, Math.abs(z - z0) - 0.01); };
        sc.paint(S.custom(fuller, [-1, -1, -1, 1, 1, 1]), { mat: "wingIn", soft: 0.001, only: ["wing"] });
        const edge = (x, y, z) => { const u = y - y0, v = s * (x - x0); return Math.max(v - bot(u) - 0.0115, bot(u) - 0.004 - v, 0.06 - u, Math.abs(z - z0) - 0.01); };
        sc.paint(S.custom(edge, [-1, -1, -1, 1, 1, 1]), { mat: "wingD", soft: 0.001, only: ["wing"] });
      }
    }
    sc.part = "hair";
    sentinelHair(sc, P, q);
    sc.part = "body";
    sc.faceKind = "sentinel";
    return { sc, P, kind: "humanoid", props: [] };
  }

  // ------------------------------------------------------------------ motion
  const HOVER = 0.085;
  const FAN = [0.22, 0.52, 0.82, 1.12];          // open fan: blade angle from straight up toward the outside (rad)
  /** wings: per side { flap (up +), sweep (back +), pitch — the whole wing about its shoulder mount; yaw (hub turned so the fan
   *  faces sideways, − = its outer blades swing forward), roll (hub pitched, + = blades sweep forward and down) — about the hub;
   *  spread (0 closed … 1 open … >1 wide), lift (fan angle offset) } */
  function wings(fig, C, L, R) {
    for (const [s, w] of [[1, L], [-1, R]]) {
      const n = s > 0 ? "L" : "R", sp = w.spread ?? 1, off = w.lift ?? 0;
      C.rot(fig, "wing1" + n, w.pitch || 0, s * (w.sweep || 0), s * (w.flap || 0));
      C.rot(fig, "wing2" + n, w.roll || 0, s * (w.yaw || 0), 0);
      for (let k = 0; k < BLADES; k++) C.rot(fig, "blade" + (k + 1) + n, 0, 0, -s * (FAN[k] * sp + off));
    }
  }
  function hoverBody(fig, C, T, lean = 0.16) {
    const bob = Math.sin(T * 2.3), drift = Math.sin(T * 0.8);
    C.off(fig, "root", 0.006 * drift, HOVER + 0.014 * bob, 0);
    C.rot(fig, "root", lean + 0.02 * bob, 0.06 * Math.sin(T * 0.55), 0.025 * drift);
    C.rot(fig, "spine", 0.03, 0, -0.01); C.rot(fig, "chest", -0.05 - 0.02 * bob, 0.03 * drift, 0);
    C.rot(fig, "neck", -0.06, 0.04 * Math.sin(T * 0.6), 0); C.rot(fig, "head", -0.05 + 0.02 * Math.sin(T * 0.9), 0.1 * Math.sin(T * 0.43), 0.03 * Math.sin(T * 0.61));
    // legs trail, one knee drawn up
    C.rot(fig, "thighL", -0.12 + 0.03 * bob, 0, -0.05); C.rot(fig, "shinL", 0.55 + 0.05 * bob, 0, 0); C.rot(fig, "footL", 0.55, 0, 0);
    C.rot(fig, "thighR", 0.22 - 0.03 * bob, 0, 0.05); C.rot(fig, "shinR", 0.4 - 0.04 * bob, 0, 0); C.rot(fig, "footR", 0.6, 0, 0);
    // arms loose, a little out from the body
    C.rot(fig, "armL", 0.22, 0, 0.02 + 0.04 * bob); C.rot(fig, "foreL", -0.4, 0.25, 0);
    C.rot(fig, "armR", 0.1, 0, -0.06 - 0.04 * bob); C.rot(fig, "foreR", -0.55, -0.25, 0);
    // scarf tails stream and ripple
    C.rot(fig, "scarf1", -0.15 + 0.08 * Math.sin(T * 3.1), 0.05 * Math.sin(T * 2.3), 0); C.rot(fig, "scarf2", 0.12 * Math.sin(T * 3.1 - 1.2), 0.08 * Math.sin(T * 2.7), 0);
  }
  function idleWings(T) {
    const b = Math.sin(T * 2.3 + 0.6);
    const w = { flap: -0.1 + 0.1 * b, sweep: 0.48 + 0.05 * b, spread: 1 + 0.05 * b, lift: 0 };
    return [w, { ...w }];
  }
  const lerpW = (a, b, t) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = mix(a[k] ?? (k === "spread" ? 1 : 0), b[k] ?? (k === "spread" ? 1 : 0), t); return o; };

  function pose(fig, clip, t, T, C) {
    C.base(fig, "idle", 0, T);
    hoverBody(fig, C, T);
    let [wl, wr] = idleWings(T), face = null, glow = 0.1 * (0.5 + 0.5 * Math.sin(T * 1.9));
    // clip layers are deltas on top of the hover, so every clip starts and ends on the idle pose
    const lift = (x, y, z) => fig.J.root.position.add(C.V3(x, y, z));
    if (clip === "attack") {
      // rise and raise the wings (0-0.26) → dive forward, the hubs chop both blade fans over the top and down in front
      // (contact 0.42) → follow through (→0.6) → climb back to the hover (→1.1)
      const up = C.bump(0, 0.24, 0.26, 0.36, t), dv = C.bump(0.26, 0.4, 0.6, 1.02, t), cut = C.sstep(0.28, 0.42, t) * (1 - C.sstep(0.62, 1.0, t));
      lift(0, 0.07 * up - 0.06 * dv, -0.05 * up + 0.22 * dv);
      C.addRot(fig, "root", -0.22 * up + 0.42 * dv, 0.08 * dv, 0);
      C.addRot(fig, "chest", -0.07 * up + 0.17 * dv, 0, 0); C.addRot(fig, "head", 0.15 * up - 0.25 * dv, 0, 0);
      C.addRot(fig, "thighL", 0.3 * dv, 0, 0); C.addRot(fig, "shinL", 0.25 * up, 0, 0);
      C.addRot(fig, "thighR", 0.35 * dv, 0, 0); C.addRot(fig, "shinR", 0.2 * dv, 0, 0);
      // arms: drawn back on the rise, the right fist driving forward on the dive, the left swept back
      C.addRot(fig, "armR", -1.4 * dv + 0.2 * up, 0, 0.2 * dv + 0.35 * up); C.addRot(fig, "foreR", 0.3 * dv, 0.25 * dv, 0);
      C.addRot(fig, "armL", 0.3 * dv + 0.1 * up, 0, -0.12 * dv + 0.23 * up); C.addRot(fig, "foreL", 0.2 * dv, -0.25 * dv, 0);
      // the hubs turn each fan edge-on and chop it from up-back, over the top, to forward (contact) and on down
      const raised = { flap: 0.25, sweep: 0.2, spread: 1.05, lift: -0.05, yaw: -1.15, roll: -0.95 };
      const struck = { flap: -0.1, sweep: 0.1, spread: 0.5, lift: 0.35, yaw: -1.15, roll: mix(0.95, 1.5, C.sstep(0.42, 0.62, t)) };
      wl = lerpW(lerpW(wl, raised, up), struck, cut); wr = lerpW(lerpW(wr, raised, up), struck, cut);
      glow = 0.2 + 1.4 * C.bump(0.3, 0.42, 0.5, 0.75, t);
      face = t < 0.26 ? "focus" : t < 0.8 ? "fierce" : null;
      C.addRot(fig, "scarf1", -0.4 * dv, 0, 0); C.addRot(fig, "scarf2", 0.2 * Math.sin(t * 20) * dv, 0, 0);
    } else if (clip === "hurt") {
      // knocked back: pitched up and back, limbs thrown out, wings flare wide
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      lift(0, 0.03 * k, -0.07 * k);
      C.addRot(fig, "root", -0.45 * k, 0, 0.1 * k);
      C.addRot(fig, "chest", -0.2 * k, 0, 0.08 * k); C.addRot(fig, "head", -0.25 * k, 0.2 * k, 0.1 * k);
      C.addRot(fig, "armL", 0, 0, 0.6 * k); C.addRot(fig, "armR", 0, 0, -0.6 * k);
      C.addRot(fig, "thighL", -0.3 * k, 0, 0); C.addRot(fig, "thighR", -0.2 * k, 0, 0);
      const flare = { flap: 0.35, sweep: 0.1, spread: 1.35, lift: -0.15 };
      wl = lerpW(wl, flare, k); wr = lerpW(wr, flare, k);
      face = t < 0.45 ? "hurt" : null;
    } else if (clip === "victory") {
      // climb a little, wings thrown wide and high, fist raised
      const up = C.bump(0, 0.3, 1.2, 1.6, t), bob = Math.sin(t * 7) * up;
      lift(0, 0.05 * up + 0.01 * bob, 0);
      C.addRot(fig, "root", -0.16 * up, 0, 0);
      C.addRot(fig, "armR", -2.6 * up, 0, 0.36 * up); C.addRot(fig, "foreR", 0.3 * up, 0.25 * up, 0);
      C.addRot(fig, "chest", -0.05 * up, 0.1 * up, 0); C.addRot(fig, "head", -0.17 * up, 0, 0);
      const wide = { flap: 0.3 + 0.08 * bob, sweep: 0.2, spread: 1.3, lift: -0.12 };
      wl = lerpW(wl, wide, up); wr = lerpW(wr, wide, up);
      glow = 0.1 + 0.8 * up;
      face = up > 0.3 ? "fierce" : null;
    }
    wings(fig, C, wl, wr);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    return clip === "idle" ? true : t < (clip === "attack" ? 1.1 : clip === "hurt" ? 0.6 : 1.6);
  }

  return {
    cards: ["sentinel"], kind: "humanoid", build, scale: 1.0,
    face: { kind: "human", look: { eye: 0x7fa4d8, brow: "#7d869c", lash: "#23202a", lip: "#c08478", skinD: "#dcab96" } },
    moves: { attack: { clip: "dive", hit: 0.42, length: 1.1, style: "slash", trail: { bone: "blade3L", from: [0, 0.08, bladeZ(2) - WING.hub[2]], to: [0, WING.len[2] - 0.01, bladeZ(2) - WING.hub[2]] } } },
    pose,
  };
})());
