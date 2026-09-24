/* 引火学徒 — a young mage apprentice: messy dark hair, navy high-collared robe with gold stars and
 * wide sleeves, cupping a fire star between his hands (card spark). */
EmberVoxelKit.define("spark", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, rotY2, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // 4-pointed star in the XY plane (half span a, arm half-width b), extruded ±d along Z (pseudo-distance)
  const star4 = (a, b, d) => S.custom((x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y);
    return Math.max(Math.min(ax / b + ay / a, ax / a + ay / b) * b - b, Math.abs(z) - d);
  }, [-a, -a, -d, a, a, d]);
  // ring band around an axis: |along d from c| < w and radius < r
  const ring = (c, d, w, r) => S.custom((x, y, z) => {
    const p = [x - c[0], y - c[1], z - c[2]], t = dot(p, d);
    return Math.max(Math.abs(t) - w, Math.hypot(p[0] - d[0] * t, p[1] - d[1] * t, p[2] - d[2] * t) - r);
  }, [-9, -9, -9, 9, 9, 9]);

  // the fire star: a hot white star through an orange heart, one swirling ember arc (prop, 0.75 cm cubes)
  function orbProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      // mid-value albedo + moderate emit stays saturated through the grade; only the core is meant to bleach white
      core: { c: 0xfff0d0, rough: 0.3, emit: 1.8, cls: CLS.glow },
      star: { c: 0xecbc58, rough: 0.3, emit: 0.95, cls: CLS.glow },
      fire: { c: 0xb86a1c, rough: 0.4, emit: 0.7, cls: CLS.glow },
      ember: { c: 0xa8461a, rough: 0.4, emit: 0.6, cls: CLS.glow },
    });
    const o = { bone: "p" }, g = 1.25;
    sc.add(S.sphere(0.034 * g), { ...o, mat: "fire", p: [0, 0, 0], k: 0.004 });
    // hot star through the heart: four long rays, two short ones front and back, small diagonals
    const spike = (d, len, r0, mat) => sc.limb(mul(norm(d), 0.01 * g), mul(norm(d), len * g), r0 * g, 0.0016, { ...o, mat, k: 0.006, cs: 0.05 });
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) spike(d, 0.068, 0.014, "core");
    for (const d of [[0, 0, 1], [0, 0, -1]]) spike(d, 0.05, 0.013, "core");
    for (const d of [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0]]) spike(d, 0.046, 0.01, "star");
    sc.add(S.arc(0.058 * g, 0.0036, 2.1), { ...o, mat: "ember", p: [0, 0, 0], r: [1.25, 0.3, 0.35], k: 0.002, vdil: 0.6 });
    return sc;
  }

  function sparkHair(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.008, -0.006]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.05, cr[2] * 1.08];
    // cap with the face cut out
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.52, cr[2] * 0.7), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // spikes: cones from inside the skull out through the cap (az round Y from the front, el up from the equator)
    const spike = (az, el, az2, el2, len, r0) => sc.limb(onEll(C, R, az, el, 0.55), onEll(C, R, az2, el2, len), r0 * q, 0.0015 * q, { mat: "hair", bone: "head", k: 0.005 });
    // crown: tousled spikes fanning up and back
    [[2.2, 1.0, 2.35, 0.6, 1.34], [2.75, 1.15, 2.85, 0.66, 1.38], [3.3, 1.2, 3.25, 0.62, 1.4], [3.85, 1.1, 3.75, 0.6, 1.36], [4.35, 0.95, 4.2, 0.52, 1.32],
      [1.6, 1.1, 1.75, 0.8, 1.28], [4.7, 1.05, 4.55, 0.78, 1.26], [0.8, 1.25, 0.95, 0.98, 1.2], [5.5, 1.25, 5.35, 1.0, 1.19]]
      .forEach(([a, e, a2, e2, l], i) => spike(a, e, a2, e2, l, 0.021 + 0.003 * (i % 2)));
    // sides and nape: spikes flicking out and down
    for (const s of [1, -1]) { spike(s * 1.45, 0.3, s * 1.62, -0.28, 1.3, 0.02); spike(s * 2.05, 0.2, s * 2.2, -0.45, 1.3, 0.02); }
    [[2.7, -0.1, 2.75, -0.72, 1.26], [3.14, -0.05, 3.14, -0.8, 1.26], [3.58, -0.1, 3.53, -0.72, 1.26]].forEach(([a, e, a2, e2, l]) => spike(a, e, a2, e2, l, 0.022));
    // messy fringe: locks falling over the forehead to the brows, tips kicked alternately left and right
    const fr = [[-0.92, 0.012, -1], [-0.56, 0.004, 1], [-0.2, 0.016, -1], [0.14, 0.0, 1], [0.48, 0.014, -1], [0.86, 0.006, 1]];
    fr.forEach(([u, dy, j], i) => {
      const root = onEll(C, R, u * 0.5, 0.86, 0.94);
      const tip = [R[0] * (0.72 * u + 0.12 * j), ey + (0.024 + dy) * q, P.faceZ + (0.01 - 0.014 * Math.abs(u)) * q];
      const mid = add(lerp(root, tip, 0.45), mul(norm(sub(lerp(root, tip, 0.45), C)), 0.014 * q));
      strand(sc, [root, mid, tip], (0.0125 + 0.002 * (i % 2)) * q, 0.0016 * q, { k: 0.007, taper: 1.05, grooves: 0.001 });
    });
    // locks in front of the ears down to the jaw
    for (const s of [1, -1]) {
      const root = onEll(C, R, s * 1.05, 0.45, 0.96), tip = [s * R[0] * 1.02, P.chinY + 0.022 * q, C[2] + R[2] * 0.42];
      strand(sc, [root, add(lerp(root, tip, 0.5), [s * 0.008 * q, 0, 0]), tip], 0.013 * q, 0.0016 * q, { k: 0.007, taper: 1.05, grooves: 0.001 });
    }
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = fam === "chunky" ? 1.25 : 1;
    humanoidBones(sc, P);
    const aR = armJoints(P, -1), orbAt = add(aR.W, mul(aR.dir, 0.128));
    sc.bone("orb", "handR", ...orbAt);       // the fire star rides on the right hand (posed explicitly by pose())
    mats(sc, {
      skin: { c: 0xf2cfb7, rough: 0.55, cls: CLS.skin, vary: 0.02 }, skinDeep: { c: 0xdcaa90, rough: 0.6, cls: CLS.skin },
      lips: { c: 0xcf8f80, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x46301f, rough: 0.6, cls: CLS.hair, vary: 0.1 },
      robe: { c: 0x2a3668, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, robeIn: { c: 0x131832, rough: 0.9, cls: CLS.cloth },
      shirt: { c: 0xdcdcdf, rough: 0.9, cls: CLS.cloth, vary: 0.03 },
      gold: { c: 0xdcb25e, rough: 0.3, metal: 1, cls: CLS.metal },
      belt: { c: 0x533420, rough: 0.6, cls: CLS.leather, vary: 0.08 }, beltD: { c: 0x2f1d12, rough: 0.65, cls: CLS.leather },
      pants: { c: 0x2b2d42, rough: 0.85, cls: CLS.cloth, vary: 0.05 },
      boots: { c: 0x5c3c26, rough: 0.55, cls: CLS.leather, vary: 0.1 }, bootD: { c: 0x3a2517, rough: 0.6, cls: CLS.leather },
    });
    body(sc, P, fam, { elf: false });
    const X0 = P.shX * 0.93, legX = 0.17;
    // ---- torso: linen shirt, navy robe open in a narrow V down the front, gold piping
    const vw = (y) => 0.011 + Math.max(0, y - 0.6) * 0.3;
    const vcut = S.custom((x, y, z) => (z > 0.01 ? Math.abs(x) - vw(y) : 1), [-0.3, -0.3, 0, 0.3, 1.2, 0.3]);
    const upArm = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.55)), lerp(a.S, a.E, 1.02), 0.085); });
    wrap(sc, RG.box(-X0, X0, P.pelvis[0] - 0.03, P.neck[0] + 0.045), "shirt", 0.003 * q);
    wrap(sc, RG.minus(RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.03, P.neck[0] + 0.045), ...upArm), vcut), "robe", 0.006 * q);
    sc.paint(S.custom((x, y, z) => (z > 0.02 && y < P.neck[0] + 0.02 ? Math.abs(Math.abs(x) - vw(y) - 0.0058) - 0.0058 : 1), [-0.3, -0.3, -0.3, 0.3, 1.2, 0.3]), { mat: "gold", soft: 0.001, only: ["robe"] });
    // gold star on the right breast, gold seams round the upper arms
    sc.paint(star4(0.024, 0.0075, 0.03), { mat: "gold", p: [-0.056, P.chest[0] + 0.024, P.chest[3] + 0.012], soft: 0.001, only: ["robe"] });
    sc.paint(star4(0.036, 0.011, 0.03), { mat: "gold", p: [0.00625, 0.68125, -P.chest[3] - 0.012], soft: 0.001, only: ["robe"] });   // and a big one between the shoulder blades (on a voxel centre, so both arms land)
    for (const s of [1, -1]) { const a = armJoints(P, s), d = norm(sub(a.E, a.S)); sc.paint(ring(lerp(a.S, a.E, 0.42), d, 0.0058, 0.09), { mat: "gold", soft: 0.001, only: ["robe"] }); }
    // wide sleeves from above the elbow to the wrist: solid bells with a gold band, the linen under-sleeve showing at the mouth
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      const top = lerp(a.S, a.E, 0.7), end = add(a.W, mul(a.dir, -0.004)), d = norm(sub(end, top)), L = Math.hypot(...sub(end, top));
      const rs = (u) => mix(0.046, 0.066, Math.pow(u, 1.5)), Rs = rotY2(...d), inS = (x, z) => Math.hypot(x, z) - rs(1) - 0.012;
      const sl = sc.add(S.custom((x, y, z) => { const u = clamp(y / L, 0, 1); return Math.max(Math.hypot(x, z) - rs(u), -y, y - L); }, [-0.08, -0.01, -0.08, 0.08, L + 0.01, 0.08]),
        { mat: "robe", p: top, R: Rs, bone: "fore" + n, k: 0.004, cs: 0.03, sigma: 0.006 });
      const tE = dot(sub(a.E, top), d) / L;
      sl.wfn = (x, y, z) => { const t = dot(sub([x, y, z], top), d) / L, w = sstep(tE - 0.12, tE + 0.1, t); return [["arm" + n, 1 - w], ["fore" + n, w]]; };
      sc.paint(S.custom((x, y, z) => Math.max(L - 0.007 - y, inS(x, z)), [-1, -1, -1, 1, 1, 1]), { mat: "shirt", p: top, R: Rs, soft: 0.001, only: ["robe"] });
      sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - (L - 0.022)) - 0.0055, inS(x, z)), [-1, -1, -1, 1, 1, 1]), { mat: "gold", p: top, R: Rs, soft: 0.001, only: ["robe"] });
    }
    // ---- legs: dark trousers, brown boots with a dark turned cuff
    const bootTop = 0.215;
    wrap(sc, RG.box(-legX, legX, -0.02, P.pelvis[0] - 0.02), "pants", 0.003 * q);
    wrap(sc, RG.box(-legX, legX, -0.02, bootTop), "boots", 0.005 * q);
    wrap(sc, RG.box(-legX, legX, bootTop - 0.016, bootTop), "bootD", 0.006 * q);
    wrap(sc, RG.box(-legX, legX, -0.02, 0.012 * q), "bootD", 0.003 * q);

    // ---- cloth: robe skirt, belt, stand collar (the sleeves are body parts so their cubes follow the forearms)
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.014, y1 = 0.2, r0 = 0.09, r1 = 0.2, szs = 0.8, h = y0 - y1, zc = -0.006;
    const rAt = (u) => mix(r0, r1, Math.pow(u, 0.55));
    const skirtS = S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = rAt(u), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - 0.008 * u * Math.sin(a * 9 + 0.6);
      return Math.max(rr * 0.85, y, -y - h);
    }, [-r1 - 0.02, -h, -(r1 + 0.02) * szs, r1 + 0.02, 0, (r1 + 0.02) * szs]);
    const sk = sc.add(skirtS, { mat: "robe", p: [0, y0, zc], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.7, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    // open front showing the linen under-robe, gold piping, gold hem, dark underside
    const panel = (x, y, z) => { const u = clamp((y0 - y) / h, 0, 1); return 0.014 + 0.03 * u; };
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(x) - panel(x, y, z) : 1), [-1, -1, -1, 1, 1, 1]), { mat: "shirt", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(Math.abs(x) - panel(x, y, z) - 0.0058) - 0.0058 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - (y1 + 0.009)) - 0.0062, [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["robe", "shirt"] });
    sc.paint(S.custom((x, y, z) => Math.max(y - (y1 + 0.004), Math.hypot(x, (z - zc) / szs) - (r1 - 0.016)), [-1, -1, -1, 1, 1, 1]), { mat: "robeIn", soft: 0.001 });
    // belt: a leather band over the skirt's waist, star buckle, a hanging tail
    const yb = y0 - 0.002, belt = S.custom((x, y, z) => Math.max(Math.hypot(x, z / 0.82) - 0.1, Math.abs(y) - 0.016), [-0.11, -0.02, -0.1, 0.11, 0.02, 0.1]);
    sc.add(belt, { mat: "belt", p: [0, yb, zc], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.003, cs: 0.03, wg: 3 });
    sc.paint(S.custom((x, y, z) => Math.abs(Math.abs(y - yb) - 0.0125) - 0.003, [-1, -1, -1, 1, 1, 1]), { mat: "beltD", soft: 0.001, only: ["belt"] });
    sc.add(star4(0.026, 0.0085, 0.004), { mat: "gold", p: [0.006, yb, zc + 0.082 + 0.004], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.002, cs: 0.02, vdil: 0.55, wg: 3 });
    const tailX = -0.034, tailZ = (y) => zc + rAt(clamp((y0 - y) / h, 0, 1)) * szs * 0.97 + 0.004;
    const tail = sc.add(S.custom((x, y, z) => Math.max(Math.abs(x - tailX) - 0.0105, Math.abs(z - tailZ(y)) - 0.0042, y - (yb - 0.012), (yb - 0.1) - y), [tailX - 0.012, yb - 0.1, 0, tailX + 0.012, yb, 0.2]),
      { mat: "belt", p: [0, 0, 0], bone: "root", k: 0.002, cs: 0.02, wg: 3 });
    tail.wfn = sk.wfn;
    sc.add(star4(0.016, 0.0055, 0.0035), { mat: "gold", p: [tailX, yb - 0.09, tailZ(yb - 0.09) + 0.004], bone: "root", k: 0.002, cs: 0.02, vdil: 0.55, wg: 3 }).wfn = sk.wfn;
    // stand collar, open at the front, gold rim and a star on the right flap
    const cy0 = P.neck[0] - 0.012, cy1 = P.chinY + 0.014, crx = 0.054, crz = 0.05;
    const collar = S.custom((x, y, z) => {
      const u = clamp((y - cy0) / (cy1 - cy0), 0, 1), f = 1 + 0.08 * u;
      const rr = (Math.hypot(x / (crx * f), (z + 0.004) / (crz * f)) - 1) * crx;
      const open = z > 0 ? 0.013 + 0.022 * u - Math.abs(x) : -1;
      return Math.max(Math.abs(rr) - 0.005, cy0 - y, y - cy1, open);
    }, [-0.08, cy0 - 0.01, -0.08, 0.08, cy1 + 0.01, 0.08]);
    const col = sc.add(collar, { mat: "robe", p: [0, 0, 0], bone: "chest", k: 0.003, cs: 0.03, wg: 4 });
    col.wfn = (x, y) => { const u = sstep(cy0, cy1, y); return [["chest", 1 - 0.5 * u], ["neck", 0.5 * u]]; };
    const inCol = (x, y, z) => Math.max(Math.hypot(x, z + 0.004) - 0.09, cy0 - 0.012 - y);
    sc.paint(S.custom((x, y, z) => Math.max(cy1 - 0.005 - y, inCol(x, y, z)), [-1, -1, -1, 1, 1, 1]), { mat: "gold", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => Math.max(Math.hypot(x, (z + 0.004) * 1.08) - crx * 0.98, cy0 - 0.012 - y), [-1, -1, -1, 1, 1, 1]), { mat: "robeIn", soft: 0.001, only: ["robe"] });
    sc.paint(star4(0.015, 0.005, 0.03), { mat: "gold", p: [-0.03, mix(cy0, cy1, 0.45), 0.05], soft: 0.001, only: ["robe"] });
    sc.part = "hair";
    sparkHair(sc, P, q);
    sc.part = "body";
    sc.faceKind = "spark";
    return { sc, P, kind: "humanoid", props: [{ sc: orbProp(), bone: "orb", at: orbAt }] };
  }

  // ------------------------------------------------------------------ motion
  let TQ = null;   // three.js scratch objects, made on first pose (the page has three; Node bakes never pose)
  const three = () => TQ || (TQ = { T: EmberVesperThree, q1: new EmberVesperThree.Quaternion(), q2: new EmberVesperThree.Quaternion(), q3: new EmberVesperThree.Quaternion(), e: new EmberVesperThree.Euler() });
  /** put the fire star at model point m (child of handR, so it is re-parented in hand space), upright and spinning */
  function placeOrb(fig, C, m, spin, scale) {
    const { q1, q2, q3, e } = three(), o = fig.J.orb, h = fig.J.handR;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    o.position.copy(h.worldToLocal(C.toW(fig, m)));
    h.getWorldQuaternion(q1).invert();
    fig.root.getWorldQuaternion(q2);
    q3.setFromEuler(e.set(0.3 * Math.sin(spin * 0.7), spin, 0.25));
    o.quaternion.copy(q1.multiply(q2).multiply(q3));
    o.scale.setScalar(scale);
    o.updateMatrixWorld(true);
  }
  /** bend a hand at the wrist so its fist points along model-space direction `to` (amount k) */
  function aimFist(fig, C, name, to, k = 1) {
    const h = fig.J[name], a = fig.char.P && armJoints(fig.char.P, name === "handL" ? 1 : -1);
    if (!h || !a || k <= 0) return;
    fig.root.updateMatrixWorld(true);
    const w = C.wpos(h), from = h.localToWorld(C.V3(...a.dir).multiplyScalar(0.1)).sub(w);
    const want = C.toW(fig, C.toM(fig, w).add(C.V3(...to).normalize().multiplyScalar(0.1))).sub(w);
    C.turnBone(h, from, from.clone().lerp(want, k));
  }
  /** turn a hand (world) toward the figure's frame rotated by ez about Z (amount k): ±2.57 stands the fist up, local +Z forward */
  function orientHand(fig, C, name, ez, k) {
    const { T, q1, q2, q3, e } = three(), h = fig.J[name];
    if (!h || k <= 0) return;
    fig.root.updateMatrixWorld(true);
    h.getWorldQuaternion(q1).slerp(fig.root.getWorldQuaternion(q2).multiply(q3.setFromEuler(e.set(0, 0, ez))), k);
    h.quaternion.copy(h.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q1));
    h.updateMatrixWorld(true);
  }
  // hands round the star: right hand arched over it, left hand cupped under it
  function cradle(fig, C, m, k = 1, spread = 0) {
    const shR = C.toM(fig, C.wpos(fig.J.armR)), shL = C.toM(fig, C.wpos(fig.J.armL));
    const hR = C.V3(m.x - 0.085 - spread, m.y + 0.06 + spread * 0.5, m.z - 0.03);
    const hL = C.V3(m.x + 0.075 + spread, m.y - 0.075 - spread * 0.5, m.z - 0.035);
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hR), C.toW(fig, C.V3(shR.x - 0.3, shR.y - 0.2, shR.z - 0.2)), k);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, hL), C.toW(fig, C.V3(shL.x + 0.3, shL.y - 0.25, shL.z - 0.2)), k);
    aimFist(fig, C, "handR", [0.75, -0.45, 0.35], k);    // knuckles over the top of the star
    aimFist(fig, C, "handL", [-0.55, 0.55, 0.45], k);    // cupped up under it
  }
  const HOLD = [0.025, 0.59, 0.2];   // where the star floats while he cradles it (model space)

  function pose(fig, clip, t, T, C) {
    // every clip = the shared idle + deltas, so clips start and end on the idle pose
    const V = C.V3, br = Math.sin((T * C.TAU) / 3.4);
    const shift = (x, y, z) => fig.J.root.position.add(V(x, y, z));
    const gaze = (k) => { C.addRot(fig, "neck", 0.06 * k, 0, 0); C.addRot(fig, "head", 0.12 * k, 0.12 * k, 0); };   // looking down at the star
    C.base(fig, "idle", 0, T);
    if (clip === "idle" || clip === "hurt" || clip === "victory") {
      const m = V(HOLD[0], HOLD[1] + 0.008 * br, HOLD[2]);
      let face = null, flare = 0.12 * (0.5 + 0.5 * Math.sin(T * 2.3)), sc = 1 + 0.04 * Math.sin(T * 5.1), spread = 0;
      if (clip === "hurt") {
        const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
        gaze(1 - k);
        C.addRot(fig, "spine", -0.22 * k, 0, 0.12 * k); C.addRot(fig, "chest", -0.28 * k, 0, 0.08 * k); C.addRot(fig, "head", -0.3 * k, 0.2 * k, 0.12 * k);
        shift(0, -0.02 * k, -0.05 * k);
        m.add(V(0.01 * k, 0.03 * k, -0.04 * k)); sc *= 1 - 0.35 * k; spread = 0.05 * k;
        face = t < 0.45 ? "hurt" : null;
      } else if (clip === "victory") {
        // lift the star overhead in both hands, it flares
        const up = C.bump(0, 0.3, 1.2, 1.6, t), bob = Math.sin(t * 9) * up;
        gaze(1 - up);
        C.addRot(fig, "chest", -0.14 * up, 0, 0); C.addRot(fig, "neck", -0.1 * up, 0, 0); C.addRot(fig, "head", -0.3 * up, 0, 0);
        shift(0, 0.012 * Math.abs(bob), 0);
        fig.root.updateMatrixWorld(true);
        const top = C.toM(fig, C.wpos(fig.J.head));
        m.lerp(V(0.0, top.y + 0.2, top.z + 0.05), up);
        flare += 0.9 * up; sc *= 1 + 0.3 * up; spread = 0.01 * up;
        face = up > 0.3 ? "fierce" : null;
      } else gaze(1);
      fig.root.updateMatrixWorld(true);
      cradle(fig, C, m, 1, spread);
      placeOrb(fig, C, m, T * 1.6, sc);
      C.emitBoost(fig, flare);
      if (face) C.setFace(fig, face);
      return clip === "idle" ? true : t < (clip === "hurt" ? 0.6 : 1.6);
    }
    if (clip === "attack") {
      // gather the star to the chest and feed it (0-0.32) → both palms thrust forward, release at 0.45 → hold → re-form and settle
      const ch = C.bump(0.02, 0.3, 0.34, 0.44, t), th = C.bump(0.33, 0.45, 0.62, 1.05, t), rel = C.bump(0.42, 0.45, 0.5, 0.72, t);
      gaze(1 - Math.max(ch, th));
      C.addRot(fig, "root", 0.06 * th, 0.35 * ch - 0.12 * th, 0);
      shift(0, -0.015 * ch - 0.03 * th, -0.02 * ch + 0.07 * th);
      C.addRot(fig, "spine", -0.1 * ch + 0.12 * th, 0.12 * ch - 0.1 * th, 0);
      C.addRot(fig, "chest", -0.08 * ch + 0.1 * th, 0.15 * ch - 0.1 * th, 0);
      C.addRot(fig, "head", 0.12 * ch - 0.06 * th, -0.3 * ch + 0.18 * th, 0);
      C.addRot(fig, "thighL", -0.55 * th, 0, 0); C.addRot(fig, "shinL", 0.33 * th, 0, 0); C.addRot(fig, "footL", 0.17 * th, 0, 0);
      C.addRot(fig, "thighR", 0.3 * th, 0, 0); C.addRot(fig, "shinR", 0.12 * th, 0, 0); C.addRot(fig, "footR", -0.12 * th, 0, 0);
      fig.root.updateMatrixWorld(true);
      const hold = V(HOLD[0], HOLD[1] + 0.008 * br, HOLD[2]);
      const chest = C.toM(fig, C.wpos(fig.J.chest)).add(V(0.0, 0.03, 0.16));
      const shR = C.toM(fig, C.wpos(fig.J.armR)), shL = C.toM(fig, C.wpos(fig.J.armL));
      const reach = (fig.char.P.upArm + fig.char.P.foreArm) * 0.95;
      const push = V((shR.x + shL.x) * 0.5, shR.y - 0.04, shR.z + reach);
      // hands: cradle the star (hold → chest) ⇄ both palms thrust forward, fists up (so the emitter, handR +Z, faces the target)
      const m0 = hold.clone().lerp(chest, C.sstep(0.02, 0.3, t)).lerp(hold, C.sstep(0.7, 1.1, t));
      const pw = C.sstep(0.33, 0.42, t) * (1 - C.sstep(0.72, 1.0, t));
      if (pw < 0.999) cradle(fig, C, m0, 1, 0.02 * ch);
      if (pw > 0.001) {
        const wR = V(push.x - 0.03, push.y + 0.01, push.z - 0.05), wL = V(push.x + 0.055, push.y - 0.012, push.z - 0.065);
        C.ik(fig, "armR", "foreR", "handR", C.toW(fig, wR), C.toW(fig, V(shR.x - 0.3, shR.y - 0.25, shR.z)), pw);
        C.ik(fig, "armL", "foreL", "handL", C.toW(fig, wL), C.toW(fig, V(shL.x + 0.3, shL.y - 0.25, shL.z)), pw);
        orientHand(fig, C, "handR", -2.57, pw); orientHand(fig, C, "handL", 2.57, pw);
      }
      // star path: cradled → at the emitter in front of the right palm for the release → gone → re-formed in the cradle
      fig.root.updateMatrixWorld(true);
      const emitM = C.toM(fig, fig.J.handR.localToWorld(V(0, 0, 0.06)));
      const m = m0.clone().lerp(emitM, C.sstep(0.33, 0.43, t) * (1 - C.sstep(0.7, 0.9, t)));
      const grow = 1 + 0.4 * C.sstep(0.05, 0.3, t) * (1 - C.sstep(0.44, 0.47, t)), gone = C.sstep(0.45, 0.5, t) * (1 - C.sstep(0.68, 0.95, t));
      placeOrb(fig, C, m, T * 1.6 + C.TAU * C.sstep(0.02, 0.45, t), Math.max(0.05, grow * (1 - 0.92 * gone)));
      C.emitBoost(fig, 0.1 + 0.45 * C.sstep(0.05, 0.3, t) * (1 - C.sstep(0.46, 0.6, t)) + 1.1 * rel);
      C.setFace(fig, t < 0.36 && t > 0.04 ? "focus" : th > 0.3 ? "fierce" : "open");
      return t < 1.2;
    }
    return undefined;
  }

  return {
    cards: ["spark"], kind: "humanoid", build, scale: 0.9,
    face: { kind: "human", look: { eye: 0xd8952f, brow: "#2e1d14", lash: "#1a0f0a", lip: "#c98a78", skinD: "#dfae94" } },
    moves: { attack: { clip: "cast", hit: 0.45, length: 1.2, style: "bolt", ranged: true, emitter: { bone: "handR", offset: [0, 0, 0.06] } } },
    pose,
  };
})());
