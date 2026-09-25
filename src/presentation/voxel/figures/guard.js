/* 铁誓卫士 — Ironoath Guard (card guard): a heavy knight in silver full plate — sugarloaf great helm with a T visor,
 * royal-blue cowl, tabard and cape, a tall kite shield (winged silver star on deep blue) on the left fist and a long
 * steel spear. The shield has its own bone: pose() carries it on the fist, facing the way the chest faces, and raises
 * it to brace during the spear clip's wind-up. */
EmberVoxelKit.define("guard", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm, cross,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body } = K;
  const V = 0.0125;                                   // body voxel: crisp one-voxel features sit on multiples of it
  const row = (j) => (j + 0.5) * V;                   // centre of voxel row / column j
  const angD = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  /* curved plate round an axis: point A, unit axis d, angle 0 toward unit `ref` (⊥ d), angle +π/2 toward d × ref;
   * covers axial t0..t1, |angle - ac| < am, radius R (+ flare toward t1), half thickness th */
  function ringPlate(A, d, ref, R, t0, t1, ac, am, th, flare = 0) {
    const e = cross(d, ref), rr = R + Math.max(0, flare) + th + 0.004, A0 = add(A, mul(d, t0)), A1 = add(A, mul(d, t1));
    return S.custom((x, y, z) => {
      const px = x - A[0], py = y - A[1], pz = z - A[2], t = px * d[0] + py * d[1] + pz * d[2];
      const rx = px - d[0] * t, ry = py - d[1] * t, rz = pz - d[2] * t, r = Math.hypot(rx, ry, rz);
      const u = clamp((t - t0) / (t1 - t0), 0, 1), Rr = R + flare * u;
      const a = Math.atan2(rx * e[0] + ry * e[1] + rz * e[2], rx * ref[0] + ry * ref[1] + rz * ref[2]);
      return Math.max(Math.abs(r - Rr) - th, t0 - t, t - t1, (Math.abs(angD(a, ac)) - am) * Rr);
    }, [0, 1, 2].map((i) => Math.min(A0[i], A1[i]) - rr).concat([0, 1, 2].map((i) => Math.max(A0[i], A1[i]) + rr)));
  }
  /* generous bounds: the voxelizer skips a whole 8³ block when the prims listed at the block's centre are all
   * subtractive or far away, so thin, isolated or carved parts pad their bounds to reach the neighbouring block centres */
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // capsule distance in 2-D with a tapering radius
  function seg2(x, y, ax, ay, bx, by, r0, r1) {
    const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) - mix(r0, r1, t);
  }

  // ------------------------------------------------------------ props
  function guardSpear() {
    const sc = new Sculpture(), PX = EmberVoxelKit.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      shaft: { c: 0x3b2b20, rough: 0.7, cls: CLS.wood, vary: 0.08 }, grip: { c: 0x223158, rough: 0.8, cls: CLS.leather },
      steel: { c: 0xb4c5e0, rough: 0.25, metal: 1, cls: CLS.metal }, steelD: { c: 0x72819a, rough: 0.35, metal: 1, cls: CLS.metal },
    });
    const R = PX ? 0.013 : 0.0105, top = 0.5, bot = -0.46;
    sc.limb([0, bot, 0], [0, top, 0], R * 1.05, R * 0.92, { mat: "shaft", bone: "p", k: 0.002 });
    if (PX) {
      // pixel: one fat grip wrap, a plain socket and a broad two-cube-thick leaf blade
      sc.add(S.cyl(0.04, R * 1.3, 0.004), { mat: "grip", p: [0, 0, 0], bone: "p", k: 0.002 });
      sc.limb([0, top - 0.04, 0], [0, top + 0.03, 0], R * 1.25, R * 1.6, { mat: "steelD", bone: "p", k: 0.002 });
      const bl = 0.2, bw = 0.034;
      sc.add(S.custom((x, y, z) => {
        const u = clamp(y / bl, 0, 1), w = bw * Math.sin(Math.PI * Math.pow(u, 0.62)) * (1 - 0.25 * u) + 0.004;
        return Math.max(Math.abs(x) - w, Math.abs(z) - (0.012 * (1 - 0.5 * u) + 0.004), -y, y - bl);
      }, [-bw - 0.004, 0, -0.018, bw + 0.004, bl, 0.018]), { mat: "steel", p: [0, top + 0.028, 0], bone: "p", k: 0.001 });
      return sc;
    }
    for (const y of [-0.036, 0.036]) sc.add(S.cyl(0.018, R * 1.3, 0.003), { mat: "grip", p: [0, y, 0], bone: "p", k: 0.002 });
    sc.add(S.cyl(0.014, R * 1.3, 0.004), { mat: "steelD", p: [0, bot + 0.01, 0], bone: "p", k: 0.002 });
    // socket, collar, two short lugs under the blade
    sc.limb([0, top - 0.04, 0], [0, top + 0.03, 0], R * 1.15, R * 1.45, { mat: "steelD", bone: "p", k: 0.002 });
    sc.add(S.cyl(0.005, R * 1.9, 0.002), { mat: "steel", p: [0, top - 0.035, 0], bone: "p", k: 0.001 });
    for (const s of [1, -1]) sc.limb([s * 0.008, top + 0.018, 0], [s * 0.036, top + 0.048, 0], 0.0065, 0.0025, { mat: "steel", bone: "p", k: 0.002, sz: 0.55 });
    // long leaf blade with a midrib
    const bl = 0.2, bw = 0.026, y0 = top + 0.028;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / bl, 0, 1), w = bw * Math.sin(Math.PI * Math.pow(u, 0.62)) * (1 - 0.25 * u) + 0.0015;
      const dz = Math.abs(z) - (0.0058 * (1 - u) + 0.0012) * (1 - 0.6 * Math.min(1, Math.abs(x) / w));
      return Math.max((Math.abs(x) - w) * 0.8, dz, -y, y - bl);
    }, [-bw - 0.002, 0, -0.008, bw + 0.002, bl, 0.008]);
    sc.add(blade, { mat: "steel", p: [0, y0, 0], bone: "p", k: 0.001 });
    return sc;
  }
  const SPEAR_TIP = 0.5 + 0.028 + 0.2;

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), PX = K.pixel;   // PX: pixel-sprite variant — flat plates, clean cloth
    humanoidBones(sc, P);
    const capeTop = P.shY - 0.01, capeBot = 0.1, capeZ = -0.11;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("tabard", "root", 0, 0.53, 0.1);
    /* shield grip at rest: just in front of the tabard and clear of it (so its cubes stay whole and the bake lattice stays
     * small), on cube boundaries so the emblem is symmetric; pose() carries it on the fist */
    const G = [12 * V, 36 * V, 11 * V];
    sc.bone("shield", "chest", ...G); sc.bone("shieldTip", "shield", G[0], G[1] - 0.3, G[2]);
    mats(sc, {
      // the base body is the under-armour: whatever the plates leave open reads as dark mail
      skin: { c: 0x3e4552, rough: 0.55, metal: 0.4, cls: CLS.metal, vary: 0.04 }, lips: { c: 0x3e4552, rough: 0.55, cls: CLS.metal },
      plate: { c: 0x93a3bb, rough: 0.3, metal: 0.6, cls: CLS.metal, vary: 0.03 },
      plateM: { c: 0x8290ab, rough: 0.32, metal: 0.6, cls: CLS.metal },   // vambraces: the bent forearm faces the key light head-on
      plateD: { c: 0x5e6b80, rough: 0.35, metal: 1, cls: CLS.metal },
      plateL: { c: 0xaec3e8, rough: 0.25, metal: 1, cls: CLS.metal },
      visor: { c: 0x0b0d13, rough: 0.9, cls: CLS.cloth },
      blue: { c: 0x3d63c0, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, blueD: { c: 0x233a82, rough: 0.9, cls: CLS.cloth },
      trim: { c: 0x9db3dc, rough: 0.6, cls: CLS.cloth },
      leather: { c: 0x563923, rough: 0.6, cls: CLS.leather, vary: 0.08 },
      shieldBlue: { c: 0x2c4fa6, rough: 0.45, metal: PX ? 0 : 0.35, cls: CLS.metal, vary: 0.03 }, shieldBack: { c: 0x3e2e22, rough: 0.7, cls: CLS.wood },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const q = P.hand, wr = (region, mat, t) => K.wrap(sc, region, mat, t);
    // ---- plate on the limbs
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s), side = s > 0 ? [0, 0.2] : [-0.2, 0];
      wr(K.RG.seg(lerp(a.S, a.E, 0.35), lerp(a.S, a.E, 0.94), 0.08), "plate", 0.006);                 // rerebrace
      wr(K.RG.seg(lerp(a.E, a.W, 0.12), lerp(a.E, a.W, 0.97), 0.08), "plateM", 0.0075);               // vambrace
      wr(K.RG.ball(add(a.W, mul(a.dir, 0.036 * q)), 0.05 * q), "plateD", 0.0035);                      // gauntlet
      wr(K.RG.box(...side, l.K[1] + 0.03, P.hipY + 0.03), "plate", 0.0065);                             // cuisse
      wr(K.RG.box(...side, P.ankY + 0.028, l.K[1] - 0.022), "plate", 0.0085);                          // greave
      wr(K.RG.box(...side, -0.03, P.ankY + 0.028), "plateD", 0.006);                                     // sabaton
      // flared gauntlet cuff, couter, poleyn with a side wing
      sc.limb(lerp(a.E, a.W, 0.84), add(a.W, mul(a.dir, 0.008)), 0.034, 0.039, { mat: "plateD", bone: "fore" + n, k: 0.002 });
      sc.add(S.ell(0.03, 0.03, 0.026), { mat: "plate", p: add(a.E, [s * 0.006, 0.004, -0.018]), bone: "fore" + n, k: 0.003 });
      sc.add(S.ell(0.037, 0.034, 0.024), { mat: "plate", p: add(l.K, [0, 0.004, 0.036]), bone: "shin" + n, k: 0.003 });
      if (!PX) sc.add(S.ell(0.012, 0.028, 0.026), { mat: "plateD", p: add(l.K, [s * 0.045, 0.004, 0.012]), bone: "shin" + n, k: 0.002 });
      // pauldron: big dome on the shoulder (rides the torso) + two lames on the upper arm
      const pc = [s * 0.165, P.shY - 0.002, -0.008], pe = S.ell(0.08, 0.068, 0.088);
      sc.add(S.custom((x, y, z) => Math.max(pe.f(x, y, z), -0.032 - y), [-0.08, -0.032, -0.088, 0.08, 0.068, 0.088]),
        { mat: "plate", p: pc, bone: "chest", k: 0.003 });   // the clavicles never move: riding the chest saves a bake pass
      const d = norm(sub(a.E, a.S)), ref = norm(sub([s, 0, 0], mul(d, s * d[0])));
      sc.add(ringPlate(a.S, d, ref, 0.062, 0.03, 0.058, 0, 1.95, 0.0055, 0.006), { mat: "plate", bone: "arm" + n, k: 0.002 });
      if (!PX) sc.add(ringPlate(a.S, d, ref, 0.058, 0.054, 0.082, 0, 1.85, 0.0055, 0.006), { mat: "plateD", bone: "arm" + n, k: 0.002 });
      // tassets over the thighs (two lames)
      const tc = [s * 0.064, 0, 0.004];
      sc.add(ringPlate([tc[0], P.hipY + 0.012, tc[2]], [0, -1, 0], [0, 0, 1], 0.082, 0, 0.05, s * 0.55, 1.25, 0.0055, 0.008), { mat: "plate", bone: "thigh" + n, k: 0.002 });
      sc.add(ringPlate([tc[0], P.hipY - 0.034, tc[2]], [0, -1, 0], [0, 0, 1], 0.088, 0, 0.05, s * 0.55, 1.25, 0.0055, 0.008), { mat: "plateD", bone: "thigh" + n, k: 0.002 });
    }
    // ---- torso: globose breast- and backplate (hides the base body's bust), keel ridge, fauld, belt and medallion
    sc.add(S.ell(0.12, 0.104, 0.102), { mat: "plate", p: [0, P.chest[0] - 0.004, -0.01], bone: "chest", k: 0.004 });
    sc.add(S.ell(0.012, 0.075, 0.02), { mat: "plate", p: [0, P.chest[0] - 0.02, 0.075], bone: "chest", k: 0.004 });
    sc.limb([0, 0.588, -0.006], [0, 0.525, -0.006], 0.1, 0.108, { mat: "plate", bone: "spine", k: 0.003, sz: 0.8 });
    sc.limb([0, 0.53, -0.006], [0, 0.458, -0.006], 0.108, 0.118, { mat: "plate", bone: "root", k: 0.003, sz: 0.8 });
    if (!PX) for (const j of [36, 38]) sc.paint(S.box(0.2, 0.004, 0.2), { mat: "plateD", p: [0, row(j), 0], soft: 0.001, only: ["plate"] });
    wr(K.RG.box(-0.16, 0.16, row(42) - 0.006, row(43) + 0.006), "leather", 0.0055);
    if (!PX) sc.add(S.cyl(0.005, 0.021, 0.002), { mat: "plateL", p: [0, (row(42) + row(43)) / 2, 0.088], r: [Math.PI / 2, 0, 0], bone: "root", k: 0.001 });
    // ---- great helm: barrel + sugarloaf dome, comb ridge, T visor (carved one cube deep, painted dark)
    // sugarloaf: a barrel that flares a little at the bottom, an ogive dome that comes to a blunt point
    const hz = -0.01, hrx = 0.086, hrz = 0.094, yMid = 0.918, yBot = 0.78, dry = 0.1;
    const hk = (y) => (y > yMid ? Math.pow(Math.cos(Math.min(1, (y - yMid) / dry) * Math.PI / 2), 0.62) : 1 + 0.05 * clamp((yMid - y) / (yMid - yBot), 0, 1));
    const helmF = (x, y, z) => Math.max((Math.hypot(x / hrx, (z - hz) / hrz) - hk(y)) * hrx, yBot - y, y - yMid - dry);
    sc.add(S.custom(helmF, pad([-hrx * 1.06, yBot, hz - hrz * 1.06, hrx * 1.06, yMid + dry, hz + hrz * 1.06])), { mat: "plate", p: [0, 0, 0], bone: "head", k: 0.002 });
    const comb = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20, a = u * Math.PI, yy = yMid + dry * Math.sin(a) * 0.96, zz = Math.cos(a) >= 0 ? 1 : -1; comb.push([0, yy + 0.002, hz + zz * hrz * hk(yy) * Math.abs(Math.cos(a)) ** 0.35 + zz * 0.004, 0.0085]); }
    for (let i = 1; i <= 3; i++) comb.unshift([0, yMid - i * 0.012, hz + hrz * hk(yMid - i * 0.012) + 0.004, 0.0085]);
    sc.add(S.chain(comb), { mat: "plateL", p: [0, 0, 0], bone: "head", k: 0.002, vdil: 0.5 });
    const eyeRow = row(70);
    const shellOf = (x, y, z) => -(helmF(x, y, z) + 0.013);    // < 0 in the outer 1.3 cm of the helm (and outside it)
    const visorCut = S.custom((x, y, z) => Math.max(Math.min(Math.max(Math.abs(x) - 0.058, Math.abs(y - eyeRow) - 0.0058), Math.max(Math.abs(x) - V, Math.abs(y - 0.848) - 0.027)), -z, shellOf(x, y, z)),
      [-0.07, 0.8, 0, 0.07, 0.9, 0.12]);
    sc.add(visorCut, { op: "sub", mat: "plate", p: [0, 0, 0], bone: "head", k: 0.001 });
    sc.paint(S.custom((x, y, z) => (y < 0.815 || y > 0.89 || z < 0 ? 1 : Math.max(Math.min(Math.max(Math.abs(x) - 0.058, Math.abs(y - eyeRow) - 0.0058), Math.max(Math.abs(x) - V, Math.abs(y - 0.848) - 0.027)), -z, helmF(x, y, z) + 0.03 < 0 ? 1 : -1)), [-0.07, 0.8, 0, 0.07, 0.9, 0.12]),
      { mat: "visor", p: [0, 0, 0], soft: 0.001 });
    // brow band just above the slit
    if (!PX) sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - row(71)) - 0.0058, -z - 0.03), [-0.1, 0.87, -0.05, 0.1, 0.9, 0.12]), { mat: "plateL", p: [0, 0, 0], soft: 0.001, only: ["plate"] });
    // ---- cloth: rolled cowl round the neck with a short mantle, tabard (front panel), cape
    sc.part = "cloth";
    sc.add(S.custom((x, y, z) => Math.hypot(Math.hypot(x, z / 0.92) - 0.06, (y - 0.766) * 1.15) - 0.022, pad([-0.085, 0.74, -0.08, 0.085, 0.79, 0.08])),
      { mat: "blue", p: [0, 0, 0], bone: "chest", k: 0.004, bones: [["chest", 0.7], ["neck", 0.3]] });
    K.bell(sc, 0.772, 0.7, 0.056, 0.086, "blue", { t: 0.007, sz: 1.05, folds: 8, amp: PX ? 1e-6 : 0.004, pw: 0.5, z: 0.004, bones: [["chest", 1]] });
    if (!PX) sc.add(S.cyl(0.004, 0.018, 0.002), { mat: "plateL", p: [0.028, 0.735, 0.086], r: [Math.PI / 2 - 0.35, 0, 0], bone: "chest", k: 0.001, part: "cloth" });
    const tab = (x, y, z) => {
      const u = clamp((0.528 - y) / 0.33, 0, 1), w = mix(0.06, 0.074, u), zc = mix(0.098, 0.108, u) + (PX ? 0 : 0.004) * u * Math.sin((x / w) * 4.7 + 0.4);
      return smax(Math.abs(z - zc) - 0.0055, Math.max(Math.abs(x) - w, y - 0.528, 0.198 - y), 0.004);
    };
    const tp = sc.add(S.custom(tab, pad([-0.08, 0.19, 0.08, 0.08, 0.53, 0.12])), { mat: "blue", p: [0, 0, 0], bone: "tabard", k: 0.003, wg: 1 });
    tp.wfn = (x, y) => { const u = sstep(0.5, 0.33, y); return [["root", 1 - u], ["tabard", u]]; };
    sc.paint(S.custom((x, y, z) => (z < 0.07 || y > 0.54 ? 1 : Math.max(tab(x, y, z) - 0.004, Math.min(y - 0.22, Math.abs(x) > mix(0.06, 0.074, clamp((0.528 - y) / 0.33, 0, 1)) - 0.011 ? -1 : 1))), [-0.08, 0.19, 0.08, 0.08, 0.53, 0.12]),
      { mat: "trim", p: [0, 0, 0], soft: 0.001, only: ["blue"] });
    // cape: hangs from between the pauldrons, wraps a little round the sides, darker lining
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.075, 0.25, Math.pow(u, 0.8));
      return { u, w, zc: mix(capeZ, capeZ - 0.085, u) - (PX ? 0.006 : 0.017) * Math.sin((x / w) * (PX ? 2 : 5) * 1.57 + 0.5) * (0.25 + u) + (0.55 - 0.25 * u) * (x * x) / w };
    };
    const hem = (x) => (PX ? 0.006 : 0.011 * (1 + Math.sin(x * 36 + 0.6)));   // pixel: a straight hem
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - (PX ? 0.008 : 0.0065), Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + hem(x) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.28, capeBot, -0.24, 0.28, capeTop, 0.06]), { mat: "blue", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.07 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.28, capeBot, -0.24, 0.28, capeTop, 0.06]), { mat: "blueD", p: [0, 0, 0], soft: 0.001, only: ["blue"] });
    // pale trim along the wavy hem, silver clasps where the cape meets the pauldrons
    if (!PX) sc.paint(S.custom((x, y, z) => (z > 0.02 || y > capeBot + 0.05 ? 1 : y - capeBot - hem(x) - (PX ? 0.02 : 0.0135)), [-0.28, capeBot, -0.24, 0.28, capeTop, 0.06]), { mat: "trim", p: [0, 0, 0], soft: 0.001, only: ["blue"] });
    if (!PX) for (const s of [1, -1]) sc.add(S.cyl(0.005, 0.013, 0.002), { mat: "plateL", p: [s * 0.062, capeTop - 0.016, capeZc(s * 0.062, capeTop - 0.016).zc - 0.009], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.001, part: "cloth" });
    sc.part = "body";
    // ---- kite shield on its own bone (local: x across, y up, z out of the face), grip at G. The face is two cubes
    // thick with its mid-surface on a cube boundary, the rim one cube proud of it; star and wings are painted on the
    // front layer, the back layer is wood.
    const W = 0.138, yT = 0.27, yB = -0.3, H = yT - yB, th = V, zf = 4 * V, bul = PX ? 0 : 0.02, rimW = PX ? 0.022 : 0.017;
    const hw = (y) => W * Math.pow(Math.max(0, 1 - Math.pow(clamp((yT - y) / H, 0, 1), 2.1)), 0.62);
    const outl = (x, y) => Math.max(Math.abs(x) - hw(y), y - (yT + 0.014 * (1 - (x / W) ** 2)), yB - y);
    const zc = (x) => zf - bul * (x / W) ** 2;
    const SB = pad([-W, yB, zf - bul - th, W, yT + 0.02, zf + 2 * th]);
    sc.add(S.custom((x, y, z) => { const o = outl(x, y), rim = o > -rimW ? V / 2 : 0; return Math.max(o, Math.abs(z - zc(x) - rim) - th - rim); }, SB), { mat: "shieldBlue", p: G, bone: "shield", k: 0.001, vdil: 0.3 });
    // winged four-point star: arms two cubes wide (long lower arm), three feathers a side sweeping up and out
    const ey = 2 * V;
    const emblem = (x, y) => {
      const Y = y - ey, X = Math.abs(x);
      if (PX) {   // pixel: one bold four-point star, no wings
        const b = Y > 0 ? 0.09 : 0.13, a = 0.07, w = (t) => 0.008 + 0.022 * Math.pow(Math.max(0, 1 - t), 2);
        return Math.min(Math.max(X - w(Math.abs(Y) / b), Math.abs(Y) - b), Math.max(Math.abs(Y) - w(X / a), X - a));
      }
      const b = Y > 0 ? 0.15 : 0.215, a = 0.086;
      const w0 = PX ? 1.6 * V : V, wv = w0 + (0.034 - w0) * Math.pow(Math.max(0, 1 - Math.abs(Y) / b), 3), wh = w0 + (0.03 - w0) * Math.pow(Math.max(0, 1 - X / a), 3);
      let d = Math.min(Math.max(X - wv, Math.abs(Y) - b), Math.max(Math.abs(Y) - wh, X - a));
      // feathers: two-row bars climbing one row per two columns (clean pixel steps), one row thick at the tip
      for (const [yb, xe] of [[-0.022, 0.104], [-0.06, 0.096], [-0.098, 0.084]]) d = Math.min(d, Math.max(Math.abs(Y - yb - 0.5 * (X - 0.018)) - (X < xe - 0.02 ? V : V / 2), X - xe, 0.018 - X));
      return d;
    };
    const far = (x, y, z) => Math.abs(x) > W + 0.02 || y < yB - 0.02 || y > yT + 0.04 || Math.abs(z - zf) > 0.06;
    sc.paint(S.custom((x, y, z) => { if (far(x, y, z)) return 1; const o = outl(x, y); return Math.max(o, -(o + rimW)); }, SB), { mat: "plate", p: G, soft: 0.001, only: ["shieldBlue"] });
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(emblem(x, y), zc(x) - z, outl(x, y) + rimW)), SB), { mat: "plateL", p: G, soft: 0.001, only: ["shieldBlue"] });
    sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(z - zc(x), outl(x, y) + rimW)), SB), { mat: "shieldBack", p: G, soft: 0.001, only: ["shieldBlue"] });
    // crisp material borders on everything added over the base body (plates, cloth, shield)
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return {
      sc, P, kind: "humanoid",
      props: [{ sc: guardSpear(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }],
    };
  }

  // ------------------------------------------------------------ motion
  /* the shared humanoid clip, then: left fist carried in front of the hip (shield arm), the shield placed on the fist
   * facing where the chest faces (turned out a little), the tabard swinging with the forward thigh */
  function pose(fig, clip, t, T, C) {
    const r = C.base(fig, clip, t, T);
    const THREE = EmberVesperThree, V3 = C.V3, J = fig.J;
    fig.root.updateMatrixWorld(true);
    const shL = C.toM(fig, C.wpos(J.armL)), br = Math.sin((T * C.TAU) / 3.4);
    let hx = 0.045, hy = -0.27, hz = 0.1, yaw = 0.3, tilt = -0.05, roll = 0.03;
    if (clip === "attack") {
      const wind = C.bump(0, 0.26, 0.3, 0.42, t), th = C.bump(0.32, 0.44, 0.62, 1.05, t);
      hx += -0.05 * wind + 0.05 * th; hy += 0.09 * wind - 0.02 * th; hz += 0.1 * wind;
      yaw += -0.4 * wind + 0.35 * th; tilt += 0.08 * wind;
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hx -= 0.03 * k; hy += 0.08 * k; hz += 0.06 * k; yaw -= 0.25 * k;
    }
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V3(shL.x + hx, shL.y + hy + 0.004 * br, shL.z + hz)), C.toW(fig, V3(shL.x + 0.35, shL.y - 0.1, shL.z - 0.3)), 1);
    fig.root.updateMatrixWorld(true);
    const o = J.shield;
    if (o) {
      const rootQ = fig.root.getWorldQuaternion(new THREE.Quaternion());
      const chestM = rootQ.clone().invert().multiply(J.chest.getWorldQuaternion(new THREE.Quaternion()));
      const want = chestM.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, roll)));
      const P = fig.char.P, a = EmberVoxelKit.armJoints(P, 1);
      const handM = rootQ.clone().invert().multiply(J.handL.getWorldQuaternion(new THREE.Quaternion()));
      const fist = C.toM(fig, C.wpos(J.handL)).add(V3(...a.dir).applyQuaternion(handM).multiplyScalar(0.044 * P.hand));
      o.position.copy(o.parent.worldToLocal(C.toW(fig, fist)));
      o.quaternion.copy(o.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ.multiply(want)));
    }
    if (J.tabard) {
      const E = new THREE.Euler();
      const xl = E.setFromQuaternion(J.thighL.quaternion).x, xr = E.setFromQuaternion(J.thighR.quaternion).x;
      C.rot(fig, "tabard", 0.85 * Math.min(xl, xr, 0) + 0.25 * Math.max(0, Math.min(xl, xr)), 0, 0);
    }
    fig.root.updateMatrixWorld(true);
    return r;
  }

  return {
    cards: ["guard"], kind: "humanoid", build, pose, scale: 1.05,
    moves: { attack: { clip: "spear", style: "thrust", trail: { prop: "spear", from: [0, 0.32, 0], to: [0, SPEAR_TIP, 0] } } },
  };
})());
