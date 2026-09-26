/* 冥月神·瑟弥拉 — Selmyra, goddess of the dark moon (card selmyra): a tall pale goddess in a floor-length black gown
 * with a pale front panel and silver trim, wide black sleeves lined in moon-grey, long silver hair to the waist, a
 * silver circlet crowned by a glowing upright crescent between spikes — and behind her head the eclipse: a black disc
 * ringed by a burning pale-blue corona. She reaches out an open hand and a small dark moon forms in the palm and is
 * cast (the effect engine flies the bolt from the palm emitter). */
EmberVoxelKit.define("selmyra", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, rotY2, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, strand, onEll } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pad = (b, m = 0.04) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // crescent in the XY plane, horns up: disc r minus a disc (r2) shifted up by o; extruded ±d along Z
  const crescent = (r, r2, o, d) => S.custom((x, y, z) => Math.max(Math.hypot(x, y) - r, -(Math.hypot(x, y - o) - r2), Math.abs(z) - d), [-r, -r, -d, r, r, d]);

  // the dark moon cast from her palm (prop, 0.75 cm cubes): a black sphere, a thin pale crescent of light on one side
  function moonProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      void: { c: 0x14121e, rough: 0.5, emit: 0.15, cls: CLS.glow },
      rim: { c: 0xbfd8ff, rough: 0.3, emit: 1.8, cls: CLS.glow },
    });
    sc.add(S.sphere(0.046), { mat: "void", bone: "p", k: 0.003 });
    sc.paint(S.custom((x, y, z) => 0.046 - Math.hypot(x + 0.014, y - 0.004, z + 0.006), [-1, -1, -1, 1, 1, 1]), { mat: "rim", soft: 0.001 });
    sc.add(S.torus(0.064, 0.004), { mat: "rim", bone: "p", r: [1.2, 0, 0.3], k: 0.002, vdil: 0.6 });
    return sc;
  }

  function hairOf(sc, P) {
    const PX = K.pixel, q = 1.25, ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.004]), cr = P.cran, R = [cr[0] * 1.07, cr[1] * 1.07, cr[2] * 1.08];
    // cap with the face cut out
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.78, cr[2] * 0.7), 0, -cr[1] * 0.48, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // centre-parted curtain fringe sweeping to the temples
    // (pixel: two fat locks a side instead of four)
    const NF = PX ? 2 : 4;
    for (const s of [1, -1]) for (let i = 0; i < NF; i++) {
      const u = i / (NF - 1);
      const root = [s * 0.004, C[1] + R[1] * (0.62 - 0.08 * u), C[2] + R[2] * (0.72 + 0.1 * u)];
      const mid = [s * R[0] * (0.34 + 0.12 * u), ey + 0.048 + 0.006 * u, P.faceZ + 0.002 * q];
      const tip = [s * R[0] * (0.78 + 0.12 * u), ey + 0.012 - 0.018 * u, P.faceZ - 0.014 * q - 0.012 * q * u];
      if (PX) strand(sc, [root, mid, tip], 0.02 * q, 0.008 * q, { k: 0.01, taper: 1.2, grooves: 0 });
      else strand(sc, [root, mid, tip], (0.011 + 0.002 * (1 - u)) * q, 0.0018 * q, { k: 0.007, taper: 1.2, grooves: 0.001 });
    }
    // long locks in front of the shoulders, down over the chest
    for (const s of [1, -1]) for (let j = 0; j < (PX ? 1 : 2); j++) {
      const n = sideName(s);
      const root = onEll(C, R, s * (1.15 + 0.15 * j), 0.2, 0.98);
      const a = [s * R[0] * (1.08 + 0.05 * j), ey - 0.02, C[2] + R[2] * (0.4 - 0.12 * j)];
      const b = [s * R[0] * (1.12 + 0.06 * j), P.chinY - 0.04, C[2] + R[2] * (0.45 - 0.15 * j)];
      const tip = [s * (P.shX * 0.55 + 0.02 * j), P.chest[0] - 0.08 - 0.03 * j, P.chest[3] + 0.028 - 0.02 * j];
      const sp = PX ? strand(sc, [root, a, b, lerp(b, tip, 0.5), tip], 0.022 * q, 0.01 * q, { k: 0.012, wg: 4, bone: "head", taper: 1.2, grooves: 0 })
        : strand(sc, [root, a, b, lerp(b, tip, 0.5), tip], 0.0125 * q, 0.003 * q, { wave: 0.006, wd: [s, 0, 0.3], waves: 2.2, phase: j * 1.7, k: 0.01, wg: 4, bone: "head" });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chest[0] - 0.05, y); return [["head", 1 - t * 0.7], ["chest", t * 0.7]]; };
    }
    // the fall down the back to the waist, over the gown
    const N = PX ? 5 : 11;   // pixel: five broad locks
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1, az = Math.PI + u * (PX ? 1.3 : 1.6), el = 0.35 - 0.25 * Math.abs(u);
      const root = onEll(C, R, az, el, 0.98), out = onEll(C, R, az, -0.4, 1.2);
      const len = 0.4 + 0.06 * (1 - Math.abs(u)) + 0.02 * Math.sin(i * 2.3);
      const tip = [out[0] * 1.25 + u * 0.03, P.neck[0] - len, -P.chest[3] - 0.065 - 0.015 * (1 - Math.abs(u))];
      const mid = lerp(out, tip, 0.35); mid[2] = Math.min(mid[2], -P.chest[3] - 0.05);
      const sp = PX ? strand(sc, [root, out, mid, tip], (0.036 - 0.006 * Math.abs(u)) * q, 0.014 * q, { k: 0.014, wg: 5, bone: "hairB1", taper: 1.2, grooves: 0 })
        : strand(sc, [root, out, mid, tip], (0.019 - 0.004 * Math.abs(u)) * q, 0.004 * q, { wave: 0.007, wd: [Math.cos(az), 0, 0], waves: 2.2, phase: i * 1.7, k: 0.012, wg: 5, swell: 0.2, bone: "hairB1", grooves: 0.0012 });
      sp.wfn = (x, y) => { const t = sstep(C[1] - 0.01, P.neck[0] - 0.4, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }
    return { C, R };
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = 1.25, PX = K.pixel;   // PX: pixel-sprite variant
    humanoidBones(sc, P);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -P.cran[2] * 0.9); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.05, -P.cran[2] * 1.1);
    const aR = armJoints(P, -1), EMIT = mul(aR.dir, 0.13);
    sc.bone("moon", "handR", ...add(aR.W, EMIT));
    const HC = [0, 0.9, -0.16];                     // the eclipse, behind the head
    sc.bone("halo", "chest", ...HC);
    const capeTop = P.shY + 0.004, capeBot = 0.02;
    K.capeBones(sc, P, capeTop, capeBot, -P.chest[3] - 0.03);
    mats(sc, PX ? {
      // flat, clearly stepped: pale silver hair, a darker moon-grey panel/lining, bright silver trim, black gown
      skin: { c: 0xf0e2ea, rough: 0.55, cls: CLS.skin }, skinDeep: { c: 0xd4c0c4, rough: 0.6, cls: CLS.skin },
      lips: { c: 0x9a6c7c, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xd4daee, rough: 0.6, cls: CLS.hair },
      gown: { c: 0x1e1b2a, rough: 0.8, cls: CLS.cloth }, gownD: { c: 0x121019, rough: 0.9, cls: CLS.cloth },
      veil: { c: 0x747c9e, rough: 0.85, cls: CLS.cloth },
      silver: { c: 0xeef2ff, rough: 0.4, metal: 0.2, cls: CLS.metal },
      moonG: { c: 0xd8e8ff, rough: 0.3, emit: 1.1, cls: CLS.glow },
      corona: { c: 0x74aaff, rough: 0.3, emit: 1.15, cls: CLS.glow },
      void: { c: 0x0d0c14, rough: 0.9, cls: CLS.cloth },
    } : {
      skin: { c: 0xf0e2ea, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd4c0c4, rough: 0.6, cls: CLS.skin },
      lips: { c: 0x9a6c7c, rough: 0.4, cls: CLS.lips },
      hair: { c: 0xbac2dc, rough: 0.55, cls: CLS.hair, vary: 0.07 },
      gown: { c: 0x1e1b2a, rough: 0.8, cls: CLS.cloth, vary: 0.04 }, gownD: { c: 0x121019, rough: 0.9, cls: CLS.cloth },
      veil: { c: 0x98a0c0, rough: 0.85, cls: CLS.cloth, vary: 0.04 },
      silver: { c: 0xc8d0e2, rough: 0.25, metal: 1, cls: CLS.metal },
      moonG: { c: 0xd8e8ff, rough: 0.3, emit: 1.1, cls: CLS.glow },
      corona: { c: 0x9cc4ff, rough: 0.3, emit: 1.6, cls: CLS.glow },
      void: { c: 0x0d0c14, rough: 0.9, cls: CLS.cloth },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const X0 = P.shX * 0.93;
    // ---- gown: bodice and full-length sleeves, a high collar, silver trim down the front and a crescent brooch
    const arms = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.5)), a.W, 0.085); });
    wrap(sc, RG.or(RG.box(-X0, X0, P.pelvis[0] - 0.04, P.neck[1] - 0.03), ...arms), "gown", 0.005 * q);
    sc.add(S.ell(0.07, 0.06, 0.03), { mat: "gown", p: [0, P.chest[0] + 0.012, P.chest[3] + 0.004], bone: "chest", k: 0.01 });
    sc.add(PX ? crescent(0.03, 0.023, 0.013, 0.008) : crescent(0.026, 0.021, 0.012, 0.004), { mat: "silver", p: [0, P.chest[0] + 0.035, P.chest[3] + 0.034], bone: "chest", k: 0.001, vdil: 0.55 });
    // collar ring
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, z / 0.95) - 0.05) - 0.006, Math.abs(y - (P.neck[0] + 0.02)) - 0.012), pad([-0.06, P.neck[0], -0.06, 0.06, P.neck[0] + 0.04, 0.06])),
      { mat: "silver", bone: "chest", bones: [["chest", 0.6], ["neck", 0.4]], k: 0.002 });
    // wide sleeves from above the elbow, flaring to a deep mouth at the wrist, lined in moon-grey
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      const top = lerp(a.S, a.E, 0.65), end = add(a.W, mul(a.dir, 0.004)), d = norm(sub(end, top)), L = Math.hypot(...sub(end, top));
      const rs = (u) => mix(0.05, 0.09, Math.pow(u, 1.6)), Rs = rotY2(...d);
      const sl = sc.add(S.custom((x, y, z) => { const u = clamp(y / L, 0, 1); return Math.max(Math.hypot(x, z) - rs(u), -y, y - L - 0.02 * Math.max(0, -x * s * 10)); }, [-0.1, -0.01, -0.1, 0.1, L + 0.03, 0.1]),
        { mat: "gown", p: top, R: Rs, bone: "fore" + n, k: 0.004, cs: 0.03, sigma: 0.006 });
      const tE = dot(sub(a.E, top), d) / L;
      sl.wfn = (x, y, z) => { const t = dot(sub([x, y, z], top), d) / L, w = sstep(tE - 0.12, tE + 0.1, t); return [["arm" + n, 1 - w], ["fore" + n, w]]; };
      // hollow mouth: the lining shows as a ring, the hand inside the dark
      sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, z) - rs(1) + 0.012, L - 0.03 - y, y - L - 0.05), [-0.1, L - 0.04, -0.1, 0.1, L + 0.06, 0.1]), { op: "sub", p: top, R: Rs, bone: "fore" + n, k: 0.002 });
      sc.paint(S.custom((x, y, z) => Math.max(L - 0.03 - y, Math.hypot(x, z) - rs(1) - 0.02, rs(1) - 0.024 - Math.hypot(x, z)), [-1, -1, -1, 1, 1, 1]), { mat: "veil", p: top, R: Rs, soft: 0.001, only: ["gown"] });
      sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - (L - 0.02)) - 0.006, Math.hypot(x, z) - rs(1) - 0.02), [-1, -1, -1, 1, 1, 1]), { mat: "silver", p: top, R: Rs, soft: 0.001, only: ["gown"] });
    }
    // ---- skirt: a solid floor-length bell with a pale front panel, silver hem, dark underside
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, y1 = 0.0, r0 = 0.085, r1 = 0.2, szs = 0.85, h = y0 - y1, zc = -0.01;
    const rAt = (u) => mix(r0, r1, Math.pow(u, 0.7));
    const skirtS = S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), r = rAt(u), a = Math.atan2(z / szs, x);
      const rr = Math.hypot(x, z / szs) - r - (PX ? 0 : 0.01 * u * Math.sin(a * 7 + 0.6)) - 0.02 * u * u * Math.max(0, -Math.sin(a));
      return Math.max(rr * 0.85, y, -y - h);
    }, [-r1 - 0.04, -h, -(r1 + 0.05) * szs, r1 + 0.04, 0, (r1 + 0.04) * szs]);
    const sk = sc.add(skirtS, { mat: "gown", p: [0, y0, zc], bone: "root", k: 0.004, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.45, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    const panel = (y) => 0.02 + 0.05 * clamp((y0 - y) / h, 0, 1);
    sc.paint(S.custom((x, y, z) => (z > 0.02 ? Math.abs(x) - panel(y) : 1), [-1, -1, -1, 1, 1, 1]), { mat: "veil", soft: 0.001, only: ["gown"] });
    if (!PX) sc.paint(S.custom((x, y, z) => (z > 0.02 && y < y0 - 0.01 ? Math.abs(Math.abs(x) - panel(y) - 0.0058) - 0.0058 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "silver", soft: 0.001, only: ["gown", "veil"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - 0.012) - 0.0065, [-1, -1, -1, 1, 1, 1]), { mat: "silver", soft: 0.001, only: ["gown", "veil"] });
    // mantle: a floor-length black cape falling from the shoulders, lined in moon-grey, silver hem
    K.cape(sc, P, capeTop, capeBot, P.shX * 1.05, P.shX * 2.1, "gown", PX ? { folds: 3, amp: 0.006, t: 0.009 } : { folds: 7, amp: 0.012, t: 0.0065 });
    sc.paint(S.custom((x, y, z) => (z > -0.06 ? 1 : Math.abs(y - capeBot - 0.008) - 0.0065), [-1, -1, -1, 1, 1, 1]), { mat: "silver", soft: 0.001, only: ["gown"] });
    // sash: a silver girdle at the waist
    const yb = y0 + 0.004;
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, z / 0.82) - 0.092, Math.abs(y) - 0.011), [-0.1, -0.02, -0.1, 0.1, 0.02, 0.1]), { mat: "silver", p: [0, yb, zc], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.002, cs: 0.03, wg: 3 });
    sc.part = "body";

    // ---- hair, circlet and the crescent crown
    sc.part = "hair";
    const { C, R } = hairOf(sc, P);
    sc.part = "body";
    const cy = C[1] + R[1] * 0.42, cz = C[2] + 0.004, crx = R[0] * 1.02, crz = R[2] * 1.02;
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / crx, (z - cz) / crz) - 1) * crx - 0.005, Math.abs(y - cy) - 0.006 - 0.004 * Math.max(0, (z - cz) / crz)), pad([-crx, cy - 0.02, cz - crz, crx, cy + 0.02, cz + crz])),
      { mat: "silver", bone: "head", k: 0.002 });
    // the great crescent rising from the brow, and spikes fanning back along the circlet
    sc.add(PX ? crescent(0.06, 0.046, 0.034, 0.012) : crescent(0.052, 0.042, 0.03, 0.0065), { mat: "moonG", p: [0, cy + (PX ? 0.066 : 0.058), cz + crz * 0.8], r: [-0.2, 0, 0], bone: "head", k: 0.001, vdil: 0.6 });
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(x) * 1.6 + Math.abs(y - 0.012) * 0.9 - 0.02, Math.abs(z) - 0.005), [-0.02, -0.01, -0.006, 0.02, 0.035, 0.006]), { mat: "silver", p: [0, cy + 0.006, cz + crz * 0.98], r: [-0.2, 0, 0], bone: "head", k: 0.001 });
    for (const s of [1, -1]) for (const [az, len, el] of PX ? [[0.7, 0.07, 1.0], [1.3, 0.055, 0.85]] : [[0.55, 0.07, 1.05], [1.0, 0.06, 0.95], [1.45, 0.045, 0.8]]) {
      const base = [s * crx * Math.sin(az), cy + 0.004, cz + crz * Math.cos(az)];
      const dir = norm([s * Math.sin(az) * Math.cos(el) * 0.9, Math.sin(el), Math.cos(az) * Math.cos(el) * 0.4 - 0.25]);
      sc.limb(base, add(base, mul(dir, len)), PX ? 0.013 : 0.009, PX ? 0.006 : 0.0015, { mat: "silver", bone: "head", k: 0.002, vdil: 0.55 });
    }

    // ---- the eclipse: a one-cube black disc ringed by a thick glowing corona with a few flares, on its own bone
    const Rh = 0.155;
    if (PX) {
      // pixel: a black disc set well back inside a broad, deeper corona ring with six fat flares (the step between them
      // keeps the mesh simplifier from smearing the ring's glow across the flat disc)
      // it is sized to frame the sprite's enlarged (×1.55) head: a smaller ring would sit hidden behind it
      const Rp = 0.225, fl = (x, y) => 0.045 * Math.pow(Math.max(0, Math.cos(Math.atan2(y, x) * 3 + Math.PI / 2)), 4);
      sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, y) - Rp, Math.abs(z) - 0.007), pad([-Rp, -Rp, -0.015, Rp, Rp, 0.015])), { mat: "void", p: HC, bone: "halo", k: 0.001 });
      sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - Rp - 0.017) - 0.017 - fl(x, y), Math.abs(z) - 0.017), pad([-Rp - 0.08, -Rp - 0.08, -0.016, Rp + 0.08, Rp + 0.08, 0.016])),
        { mat: "corona", p: HC, bone: "halo", k: 0.001 });
    } else {
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, y) - Rh, Math.abs(z) - 0.004), pad([-Rh, -Rh, -0.01, Rh, Rh, 0.01])), { mat: "void", p: HC, bone: "halo", k: 0.001, vdil: 0.3 });
    const flare = (x, y) => { const a = Math.atan2(y, x); return 0.008 * Math.pow(Math.max(0, Math.cos(a * 6)), 8) + 0.004 * Math.pow(Math.max(0, Math.cos(a * 11 + 0.7)), 6); };
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - Rh - 0.009) - 0.009 - flare(x, y), Math.abs(z) - 0.007), pad([-Rh - 0.04, -Rh - 0.04, -0.01, Rh + 0.04, Rh + 0.04, 0.01])),
      { mat: "corona", p: HC, bone: "halo", k: 0.001, vdil: 0.4 });
    }
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.03);
    return { sc, P, kind: "humanoid", props: [{ sc: moonProp(), bone: "moon", at: add(aR.W, EMIT) }] };
  }

  // ------------------------------------------------------------------ motion
  const HIT = 0.5, LEN = 1.3;
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.8);
    C.base(fig, clip === "attack" ? "idle" : clip, clip === "attack" ? 0 : t, T);
    // a slow float: the gown hides the feet, the whole figure drifts on a long breath
    J.root.position.y += 0.006 * br;
    fig.root.updateMatrixWorld(true);
    const P = fig.char.P, shL = C.toM(fig, C.wpos(J.armL)), shR = C.toM(fig, C.wpos(J.armR));
    // regal rest: left hand before the waist, right hand low and open at her side
    const restL = V(shL.x - 0.07, shL.y - 0.28, shL.z + 0.1), restR = V(shR.x - 0.04, shR.y - 0.3, shR.z + 0.05);
    const poleL = V(shL.x + 0.3, shL.y - 0.2, shL.z - 0.2);
    let poleR = V(shR.x - 0.3, shR.y - 0.2, shR.z - 0.2);
    let glow = 0.15 * (0.5 + 0.5 * Math.sin(T * 1.3)), moon = 0, face = null;
    let hL = restL, hR = restR, kL = 1, kR = clip === "victory" ? 0 : 1;
    if (clip === "attack") {
      // gather: draw the right hand back to the shoulder, the dark moon forms (0-0.36) → reach out, palm to the target,
      // cast at HIT → hold the reach (→0.8) → lower (→1.25)
      const g = C.bump(0.02, 0.32, 0.36, HIT, t), reach = C.bump(0.34, HIT - 0.04, 0.8, 1.2, t);
      const rel = C.bump(HIT - 0.03, HIT, HIT + 0.06, HIT + 0.3, t);
      C.addRot(fig, "root", 0, 0.25 * g - 0.18 * reach, 0);
      J.root.position.add(V(0, 0.01 * g, -0.02 * g + 0.04 * reach));
      C.addRot(fig, "spine", -0.05 * g + 0.06 * reach, 0.1 * g - 0.08 * reach, 0);
      C.addRot(fig, "chest", -0.08 * g + 0.08 * reach, 0.12 * g - 0.1 * reach, 0);
      C.addRot(fig, "head", -0.06 * g + 0.04 * reach, -0.2 * g + 0.16 * reach, 0);
      fig.root.updateMatrixWorld(true);
      const sR = C.toM(fig, C.wpos(J.armR)), len = (P.upArm + P.foreArm) * 0.97;
      const back = V(sR.x + 0.02, sR.y - 0.06, sR.z - 0.02), out = V(sR.x + 0.06, sR.y + 0.03, sR.z + len);
      hR = restR.clone().lerp(back, C.sstep(0.02, 0.3, t)).lerp(out, C.sstep(0.34, HIT - 0.03, t)).lerp(restR, C.sstep(0.82, 1.22, t));
      poleR = V(sR.x - 0.35, sR.y - 0.15, sR.z - 0.1);
      hL = restL.clone().lerp(V(shL.x - 0.12, shL.y - 0.14, shL.z + 0.14), g);
      moon = C.sstep(0.04, 0.34, t) * (1 - C.sstep(HIT, HIT + 0.04, t));
      glow += 0.8 * C.sstep(0.05, 0.34, t) * (1 - C.sstep(HIT + 0.05, 0.9, t)) + 1.6 * rel;
      face = t > 0.05 && t < HIT - 0.02 ? "focus" : t < 0.9 ? "fierce" : null;
      C.rot(fig, "hairB1", 0.15 * reach, 0, 0);
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hL = restL.clone().add(V(0.04 * k, 0.1 * k, 0.06 * k));
      glow *= 1 - 0.8 * k;
    } else if (clip === "victory") {
      // the base clip lifts the right arm; the eclipse flares
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      glow += 1.2 * up; moon = 0.8 * up;
      face = up > 0.3 ? "open" : null;
    }
    fig.root.updateMatrixWorld(true);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, hL), C.toW(fig, poleL), kL);
    if (kR > 0) C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hR), C.toW(fig, poleR), kR);
    // the dark moon rides the palm, spinning
    if (J.moon) {
      J.moon.scale.setScalar(Math.max(0.001, moon * (1 + 0.08 * Math.sin(T * 7))));
      J.moon.rotation.set(0.3, T * 1.8, 0.2);
    }
    // the eclipse turns slowly and stays upright behind her head
    if (J.halo) J.halo.rotation.set(0, 0, T * 0.15);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    fig.root.updateMatrixWorld(true);
    return clip === "attack" ? t < LEN : clip === "idle" ? true : t < (clip === "hurt" ? 0.6 : 1.6);
  }

  const aR0 = armJoints(FAM.chunky, -1);
  return {
    cards: ["selmyra"], kind: "humanoid", build, pose, scale: 1.3,
    face: { kind: "human", look: { eye: 0x8f86c8, brow: "#9a9cb0", lash: "#221c2c", lip: "#8e6476", skinD: "#cfbcc2" } },
    moves: { attack: { clip: "cast", hit: HIT, length: LEN, style: "bolt", ranged: true, windup: 320, emitter: { bone: "handR", offset: mul(aR0.dir, 0.13) } } },
  };
})());
